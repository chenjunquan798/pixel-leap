// 主循环与状态机：Boot → Menu → Playing ⇄ Paused → Over → Menu
// 固定 60Hz 物理、渲染帧率无关；最多补 5 步，不追帧（PRD 11.1）。

import { STEP, MAX_STEPS } from './core/config.js';
import { pointsToBest } from './core/score.js';
import { createWorld } from './core/world.js';
import { robotDirection } from './core/bot.js';
import { createRenderer } from './render/renderer.js';
import { createStore, safeStorage } from './platform/storage.js';
import { createAudio } from './platform/audio.js';
import { createLedger } from './platform/ledger.js';
import { createShare } from './platform/share.js';
import { createI18n } from './ui/i18n.js';
import { createUI } from './ui/ui.js';

const params = new URLSearchParams(location.search);
const randomSeed = () => (Math.random() * 0xffffffff) >>> 0;

function hashMessage(text) {
  let h = 5381;
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function boot() {
  const { storage, ephemeral } = safeStorage();
  const store = createStore(storage);
  const initial = store.getState();
  const langParam = params.get('lang');
  const i18n = createI18n(langParam === 'en' || langParam === 'zh' ? langParam : initial.lang);
  if (langParam && langParam !== initial.lang) store.set({ lang: i18n.lang });

  const ui = createUI({ i18n });
  let best = initial.best;
  let muted = initial.muted;
  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mode = 'menu';
  let lastOver = null;
  let lastInput = 'keyboard';
  let sharePending = false;

  ui.applyI18n();
  ui.setBest(best);
  ui.setMuted(muted);

  // 触屏设备显示底部方向键；键盘/鼠标设备保持干净
  const isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
  document.body.classList.toggle('touch-mode', isTouch);

  const audio = createAudio({
    muted,
    onError: () => ui.toast(i18n.t('toast.audio'), 'error'),
  });
  const ledger = createLedger(store);
  const world = createWorld({ seed: randomSeed() });
  const attract = createWorld({ seed: randomSeed() });
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // 减弱动效：菜单背景保持静止，角色站在第一块平台上
    const first = attract.platforms.find((p) => p.type !== 'ground');
    attract.player.x = first.x + first.w / 2;
    attract.player.y = first.y;
    attract.player.prevY = first.y;
    attract.player.vy = 0;
    attract.player.squash = 0;
  }

  let renderer;
  try {
    renderer = createRenderer(ui.els.canvas);
  } catch {
    ui.fatal();
    return;
  }

  const shareApi = createShare({
    t: (key, p) => i18n.t(key, p),
    ledger,
    onToast: (message, kind) => ui.toast(message, kind),
  });

  const search = params.get('ref') || 'direct';
  const widthBucket =
    window.innerWidth < 430 ? 'small' : window.innerWidth < 900 ? 'medium' : 'large';
  ledger.record('page_view', { ref: search, viewport_bucket: widthBucket });
  if (ephemeral) {
    ledger.record('storage_error', { reason: 'unavailable' });
    setTimeout(() => ui.toast(i18n.t('error.storage'), 'error'), 400);
  } else if (store.corrupted) {
    ledger.record('storage_error', { reason: 'parse' });
    setTimeout(() => ui.toast(i18n.t('toast.storage'), 'error'), 400);
  }

  let acc = 0;
  let attractAcc = 0;
  let last = performance.now();
  let clock = 0;
  let activePointer = null;
  let fatalShown = false;
  let slowTime = 0;
  let lowQuality = false;
  let restoreTimer = 0;

  // ------------------------------------------------------------- 状态迁移
  function startGame(source) {
    audio.init();
    audio.unlock();
    audio.play('ui');
    world.reset(randomSeed());
    renderer.reset();
    audio.setZone(0);
    mode = 'playing';
    acc = 0;
    last = performance.now();
    ui.show(null);
    ui.setHud(world.stats);
    ui.setBest(best);
    audio.startMusic();
    ledger.record('run_start', { source, input_type: lastInput });
    ui.announce(i18n.t('a11y.start'));
    ui.els.canvas.focus({ preventScroll: true });
  }

  function retry() {
    if (lastOver) {
      ledger.record('retry', { from_score: lastOver.score, best_score: best });
    }
    startGame('retry');
  }

  function goHome() {
    mode = 'menu';
    audio.stopMusic();
    audio.play('ui');
    ui.show('menu');
    ui.setBest(best);
    ui.focusPrimary('menu');
    ui.announce(i18n.t('a11y.menu', { best }));
  }

  function pause() {
    if (mode !== 'playing') return;
    mode = 'paused';
    audio.stopMusic();
    ui.show('pause');
    ui.announce(i18n.t('a11y.pause'));
    ui.focusPrimary('pause');
    ledger.record('pause', { meters: world.stats.meters, score: world.stats.score });
  }

  function resume() {
    if (mode !== 'paused') return;
    mode = 'playing';
    acc = 0;
    last = performance.now();
    audio.startMusic();
    ui.show(null);
    ui.announce(i18n.t('a11y.resume'));
    ui.els.canvas.focus({ preventScroll: true });
  }

  function endRun() {
    // 一帧内可能补跑多步：死亡后必须立刻拒绝重复结算，
    // 否则局数、最高分与埋点会被重复计数。
    if (mode !== 'playing') return;
    const stats = world.stats;
    ui.setHud(stats);
    const record = stats.score > best;
    if (record) {
      best = stats.score;
      store.setBest(best);
    }
    store.set({
      runs: (store.getState().runs || 0) + 1,
      starsTotal: (store.getState().starsTotal || 0) + stats.stars,
      lastPlayed: Date.now(),
    });
    ledger.record('run_end', {
      score: stats.score,
      meters: stats.meters,
      stars: stats.stars,
      duration_ms: Math.round(world.time * 1000),
      zone: world.zone,
      cause: 'fall',
    });

    mode = 'over';
    audio.stopMusic();
    audio.play(record ? 'best' : 'dead');
    lastOver = {
      score: stats.score,
      meters: stats.meters,
      stars: stats.stars,
      best,
      record,
      diff: pointsToBest(stats.score, best),
    };
    ui.setOver(lastOver);
    ui.show('over');
    const spoken =
      i18n.t('a11y.over', {
        score: stats.score,
        meters: stats.meters,
        stars: stats.stars,
        best,
      }) + (record ? ' ' + i18n.t('a11y.record') : '');
    ui.announce(spoken);
    setTimeout(() => {
      if (mode === 'over') ui.focusPrimary('over');
    }, 80);
  }

  // ------------------------------------------------------------------ 提示
  function handleEvents() {
    if (!world.events.length) return;
    renderer.emit(world.events, world, { reduced });
    for (const ev of world.events) {
      switch (ev.type) {
        case 'land':
          audio.play('land');
          break;
        case 'spring':
          audio.play('spring');
          break;
        case 'star':
          audio.play('star');
          break;
        case 'crack':
          audio.play('crack');
          break;
        case 'zone':
          audio.setZone(ev.zone);
          ui.zoneToast(
            i18n.t('zone.toast', { zone: i18n.zoneLabel(ev.zone), m: ev.meters })
          );
          ledger.record('zone_reach', { zone: ev.zone, meters: ev.meters });
          break;
        case 'milestone':
          ledger.record('milestone', { meters: ev.meters });
          break;
        default:
          break;
      }
    }
  }

  // --------------------------------------------------------------- 主循环
  function stepGame() {
    world.step();
    handleEvents();
    if (world.dead) endRun();
  }

  function stepAttract() {
    if (attract.dead) {
      attract.reset(randomSeed());
      return;
    }
    const dir = robotDirection(attract);
    attract.input.left = dir < 0;
    attract.input.right = dir > 0;
    attract.step();
  }

  function updateHud() {
    ui.setHud(world.stats);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, 0.25);
    clock += dt;

    // 帧时间监控：连续 3 秒平均超过 25ms 就降级画面（PRD FR-12）
    if (mode === 'playing' || mode === 'menu') {
      if (dt > 0.025) slowTime += dt;
      else slowTime = Math.max(0, slowTime - dt * 0.5);
      if (!lowQuality && slowTime > 3) {
        lowQuality = true;
        renderer.setQuality(true);
        ledger.record('device_tier', { tier: 'low' });
      }
    }

    if (mode === 'playing') {
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < MAX_STEPS && mode === 'playing') {
        stepGame();
        acc -= STEP;
        steps++;
      }
      if (steps >= MAX_STEPS) acc = 0; // 掉帧时不追赶
      if (mode === 'playing') updateHud();
    } else if (mode === 'menu' && !reduced) {
      attractAcc += dt;
      let steps = 0;
      while (attractAcc >= STEP && steps < MAX_STEPS) {
        stepAttract();
        attractAcc -= STEP;
        steps++;
      }
      if (steps >= MAX_STEPS) attractAcc = 0;
    } else {
      acc = 0;
    }

    const shown = mode === 'menu' ? attract : world;
    try {
      renderer.draw(shown, clock, { reduced, dt });
    } catch {
      fatal();
    }
  }

  function fatal() {
    if (fatalShown) return;
    fatalShown = true;
    mode = 'fatal';
    audio.stopMusic();
    ledger.record('fatal_error', { type: 'render' });
    ui.fatal();
  }

  // ------------------------------------------------------------------ 输入
  function steerTo(clientX) {
    const rect = ui.els.canvas.getBoundingClientRect();
    const left = clientX < rect.left + rect.width / 2;
    world.input.left = left;
    world.input.right = !left;
  }

  function releaseAll() {
    world.input.left = false;
    world.input.right = false;
  }

  const canvas = ui.els.canvas;

  canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'playing') return;
    activePointer = e.pointerId;
    lastInput = 'pointer';
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    steerTo(e.clientX);
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activePointer) return;
    if (mode !== 'playing') return;
    steerTo(e.clientX);
  });

  function endPointer(e) {
    if (e.pointerId !== activePointer) return;
    activePointer = null;
    releaseAll();
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', endPointer);

  function bindHold(el, dir) {
    if (!el) return;
    const down = (e) => {
      if (mode !== 'playing') return;
      e.preventDefault();
      lastInput = 'pointer';
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (dir === 'left') {
        world.input.left = true;
        world.input.right = false;
      } else {
        world.input.right = true;
        world.input.left = false;
      }
    };
    const up = () => releaseAll();
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }

  bindHold(ui.els.touchLeft, 'left');
  bindHold(ui.els.touchRight, 'right');

  window.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    // 长按的自动重复不能反复切换暂停/静音
    if (e.repeat) return;
    const tag = e.target && e.target.tagName;
    const onButton = tag === 'BUTTON' || tag === 'A';
    const key = e.key;

    if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
      if (mode === 'playing') {
        world.input.left = true;
        lastInput = 'keyboard';
      }
      e.preventDefault();
      return;
    }
    if (key === 'ArrowRight' || key === 'd' || key === 'D') {
      if (mode === 'playing') {
        world.input.right = true;
        lastInput = 'keyboard';
      }
      e.preventDefault();
      return;
    }
    if (key === 'p' || key === 'P' || key === 'Escape') {
      if (mode === 'playing') pause();
      else if (mode === 'paused') resume();
      e.preventDefault();
      return;
    }
    if (key === 'm' || key === 'M') {
      toggleMute();
      return;
    }
    if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
      if (onButton) return;
      if (mode === 'menu') {
        startGame('keyboard');
        e.preventDefault();
      } else if (mode === 'over') {
        retry();
        e.preventDefault();
      } else if (mode === 'paused') {
        resume();
        e.preventDefault();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    const key = e.key;
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') world.input.left = false;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') world.input.right = false;
  });

  window.addEventListener('blur', releaseAll);

  // --------------------------------------------------------------- 按钮绑定
  function toggleMute() {
    muted = !muted;
    store.set({ muted });
    audio.setMuted(muted);
    ui.setMuted(muted);
    ledger.record('mute', { muted });
    if (!muted) {
      audio.play('ui');
      if (mode === 'playing') audio.startMusic();
    }
  }

  function applyLang() {
    const next = i18n.lang === 'zh' ? 'en' : 'zh';
    i18n.set(next);
    store.set({ lang: next });
    ui.applyI18n();
    if (mode === 'over') ui.focusPrimary('over');
    ledger.record('lang', { lang: next });
  }

  async function onShare() {
    if (sharePending || !lastOver) return;
    sharePending = true;
    ui.setShareBusy(true);
    try {
      await shareApi.share(lastOver);
    } catch {
      ui.toast(i18n.t('toast.shareError'), 'error');
    } finally {
      sharePending = false;
      ui.setShareBusy(false);
    }
  }

  ui.els.startBtn.addEventListener('click', () => {
    lastInput = lastInput === 'pointer' ? 'pointer' : 'button';
    startGame('menu');
  });
  ui.els.soundBtn.addEventListener('click', toggleMute);
  ui.els.langBtn.addEventListener('click', applyLang);
  ui.els.pauseBtn.addEventListener('click', pause);
  ui.els.muteBtn.addEventListener('click', toggleMute);
  ui.els.resumeBtn.addEventListener('click', resume);
  ui.els.pauseRestart.addEventListener('click', retry);
  ui.els.pauseHome.addEventListener('click', goHome);
  ui.els.retryBtn.addEventListener('click', retry);
  ui.els.shareBtn.addEventListener('click', onShare);
  ui.els.homeBtn.addEventListener('click', goHome);
  ui.els.refreshBtn.addEventListener('click', () => location.reload());

  // ------------------------------------------------------------ 环境与错误
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      releaseAll();
      if (mode === 'playing') pause();
    } else {
      last = performance.now();
    }
  });

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onMotionChange = (e) => {
    reduced = e.matches;
  };
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionChange);

  canvas.addEventListener('contextlost', (e) => {
    e.preventDefault();
    pause();
    ledger.record('fatal_error', { type: 'context_lost' });
    ui.toast(i18n.t('error.context'), 'error');
    clearTimeout(restoreTimer);
    restoreTimer = setTimeout(() => {
      if (mode !== 'fatal') fatal();
    }, 2500);
  });

  canvas.addEventListener('contextrestored', () => {
    clearTimeout(restoreTimer);
    try {
      renderer.rebuild();
      renderer.reset();
    } catch {
      fatal();
      return;
    }
    ledger.record('context_restored', {});
    ui.toast(i18n.t('error.contextOk'), 'ok');
  });

  window.addEventListener('error', (e) => {
    ledger.record('error', { type: 'uncaught', message_hash: hashMessage(e.message) });
  });
  window.addEventListener('unhandledrejection', (e) => {
    ledger.record('error', {
      type: 'unhandled_rejection',
      message_hash: hashMessage(e.reason && e.reason.message),
    });
  });

  // 调试与手动研究入口（Plan B：完全本地）
  window.PixelLeap = {
    version: '2.0.1',
    get state() {
      return { mode, best, muted, lang: i18n.lang, score: world.stats.score };
    },
    summary: () => ledger.summary(),
    exportLedger: () => ledger.exportJSON(),
    world,
    attract,
    restart: () => startGame('api'),
    pause,
    resume,
  };

  ui.show('menu');
  ui.announce(i18n.t('a11y.menu', { best }));
  requestAnimationFrame((t) => {
    last = t;
    requestAnimationFrame(frame);
  });

  // PWA：只在 http(s) 下挂 manifest 与 Service Worker，
  // 这样直接双击 index.html（file://）也不会有 CORS 报错。
  if (/^https?:$/.test(location.protocol)) {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = 'manifest.webmanifest';
    document.head.appendChild(link);
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      });
    }
  }
}

try {
  boot();
} catch (err) {
  const title = document.getElementById('fatal-title');
  const menu = document.getElementById('screen-menu');
  const fatal = document.getElementById('screen-fatal');
  if (menu) menu.hidden = true;
  if (fatal) fatal.hidden = false;
  if (title) title.textContent = '游戏加载失败，请刷新重试。';
  if (window.console) console.error(err);
}
