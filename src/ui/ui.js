// DOM 层：HUD、覆盖层、toast、焦点与 aria-live。
// 所有可见按钮都是真实 <button>，键盘可达，焦点可见（PRD FR-13 / A11Y-01）。

export function createUI({ i18n }) {
  const $ = (id) => document.getElementById(id);
  const els = {
    canvas: $('game'),
    stage: $('stage'),
    hud: $('hud'),
    score: $('hud-score'),
    height: $('hud-height'),
    starCount: $('hud-star-count'),
    pauseBtn: $('btn-pause'),
    muteBtn: $('btn-mute'),
    screens: {
      menu: $('screen-menu'),
      pause: $('screen-pause'),
      over: $('screen-over'),
      fatal: $('screen-fatal'),
    },
    menuBest: $('menu-best'),
    startBtn: $('btn-start'),
    soundBtn: $('btn-sound'),
    langBtn: $('btn-lang'),
    resumeBtn: $('btn-resume'),
    pauseRestart: $('btn-pause-restart'),
    pauseHome: $('btn-pause-home'),
    overScore: $('over-score'),
    overHeight: $('over-height'),
    overStars: $('over-stars'),
    overBest: $('over-best'),
    overRecord: $('over-record'),
    overDiff: $('over-diff'),
    retryBtn: $('btn-retry'),
    shareBtn: $('btn-share'),
    homeBtn: $('btn-home'),
    fatalTitle: $('fatal-title'),
    refreshBtn: $('btn-refresh'),
    toast: $('toast'),
    zoneToast: $('zone-toast'),
    live: $('live'),
    touch: $('touch'),
    touchLeft: $('touch-left'),
    touchRight: $('touch-right'),
    iconOn: document.querySelector('.ico-on'),
    iconOff: document.querySelector('.ico-off'),
  };

  let lastHud = { score: -1, meters: -1, stars: -1 };
  let lastBest = 0;
  let lastOver = null;
  let muted = false;
  let toastTimer = 0;
  let zoneTimer = 0;

  function applyI18n() {
    document.documentElement.lang = i18n.lang === 'zh' ? 'zh-CN' : 'en';
    document.title = i18n.t('app.title');
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      node.textContent = i18n.t(node.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((node) => {
      node.setAttribute('aria-label', i18n.t(node.dataset.i18nAria));
    });
    els.canvas.setAttribute('aria-label', i18n.t('a11y.canvas'));
    els.pauseBtn.setAttribute('aria-label', i18n.t('pause.title'));
    els.soundBtn.textContent = muted ? i18n.t('menu.soundOff') : i18n.t('menu.soundOn');
    els.langBtn.textContent = i18n.lang === 'zh' ? 'EN' : '中文';
    els.muteBtn.setAttribute('aria-label', muted ? i18n.t('menu.unmute') : i18n.t('menu.mute'));
    els.muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    setBest(lastBest);
    if (lastOver) renderOver(lastOver);
    setHud(lastHud.score < 0 ? { score: 0, meters: 0, stars: 0 } : lastHud);
  }

  function setBest(best) {
    lastBest = best;
    els.menuBest.textContent = String(best);
  }

  function setHud(stats) {
    if (stats.score !== lastHud.score) {
      lastHud.score = stats.score;
      els.score.textContent = String(stats.score);
    }
    if (stats.meters !== lastHud.meters) {
      lastHud.meters = stats.meters;
      els.height.textContent = i18n.t('hud.meters', { n: stats.meters });
    }
    if (stats.stars !== lastHud.stars) {
      lastHud.stars = stats.stars;
      els.starCount.textContent = String(stats.stars);
    }
  }

  function show(name) {
    for (const key of Object.keys(els.screens)) {
      els.screens[key].hidden = key !== name;
    }
    const inGame = name === null || name === 'pause' || name === 'over';
    els.hud.hidden = !inGame;
    els.touch.hidden = name !== null;
    // 模态覆盖层打开时，HUD/触控键不应还能被 Tab 到或点到（A11Y-01 / aria-modal）
    if (typeof HTMLElement !== 'undefined' && 'inert' in HTMLElement.prototype) {
      els.hud.inert = name !== null;
      els.touch.inert = name !== null;
    }
  }

  function focusPrimary(name) {
    const map = {
      menu: els.startBtn,
      pause: els.resumeBtn,
      over: els.retryBtn,
      fatal: els.refreshBtn,
    };
    const node = map[name];
    if (node) node.focus({ preventScroll: true });
  }

  function toast(message, kind = 'info') {
    els.toast.textContent = message;
    els.toast.dataset.kind = kind;
    els.toast.hidden = false;
    els.toast.style.animation = 'none';
    void els.toast.offsetWidth;
    els.toast.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 2800);
  }

  function zoneToast(text) {
    els.zoneToast.textContent = text;
    els.zoneToast.hidden = false;
    els.zoneToast.style.animation = 'none';
    void els.zoneToast.offsetWidth;
    els.zoneToast.style.animation = '';
    clearTimeout(zoneTimer);
    zoneTimer = setTimeout(() => {
      els.zoneToast.hidden = true;
    }, 1650);
  }

  function announce(text) {
    els.live.textContent = '';
    setTimeout(() => {
      els.live.textContent = text;
    }, 30);
  }

  function renderOver(data) {
    els.overScore.textContent = String(data.score);
    els.overHeight.textContent = i18n.t('hud.meters', { n: data.meters });
    els.overStars.textContent = String(data.stars);
    els.overBest.textContent = String(data.best);
    els.overRecord.hidden = !data.record;
    if (data.record) {
      els.overDiff.textContent = '';
      els.overDiff.classList.add('is-record');
      els.overDiff.hidden = true;
    } else {
      els.overDiff.textContent = i18n.t('over.diff', { n: data.diff });
      els.overDiff.classList.remove('is-record');
      els.overDiff.hidden = false;
    }
    els.shareBtn.hidden = !data.record;
  }

  function setOver(data) {
    lastOver = data;
    renderOver(data);
  }

  function setMuted(next) {
    muted = !!next;
    els.muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    els.muteBtn.setAttribute('aria-label', muted ? i18n.t('menu.unmute') : i18n.t('menu.mute'));
    els.soundBtn.textContent = muted ? i18n.t('menu.soundOff') : i18n.t('menu.soundOn');
    if (els.iconOn && els.iconOff) {
      els.iconOn.hidden = muted;
      els.iconOff.hidden = !muted;
    }
  }

  function setShareBusy(busy) {
    els.shareBtn.disabled = !!busy;
    els.shareBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
    els.shareBtn.textContent = busy ? '…' : i18n.t('over.share');
  }

  function fatal(message) {
    if (message) els.fatalTitle.textContent = message;
    show('fatal');
    announce(i18n.t('error.title'));
    focusPrimary('fatal');
  }

  return {
    els,
    applyI18n,
    setBest,
    setHud,
    show,
    focusPrimary,
    toast,
    zoneToast,
    announce,
    setOver,
    setMuted,
    setShareBusy,
    fatal,
    get lastHud() {
      return lastHud;
    },
  };
}
