// 渲染器：背景 + 世界 + 粒子 + 屏幕震动。
// 只负责画，不改模拟状态。

import { VIEW } from '../core/config.js';
import { C } from './palette.js';
import { createBackground } from './background.js';
import { drawPlayer, drawPlatform, drawStar } from './sprites.js';

export function createRenderer(canvas) {
  let ctx = canvas.getContext('2d', { alpha: false });
  let bg = createBackground();
  let particles = [];
  let floats = [];
  let shakeMag = 0;
  let shakeT = 0;
  const shakeDur = 0.26;
  let lowQuality = false;

  function add(p) {
    if (particles.length > 220) particles.shift();
    particles.push(p);
  }

  function burst(x, y, count, opts) {
    // 低端机降级：粒子减半，玩法与碰撞完全不变（PRD FR-12）
    const n = lowQuality ? Math.max(1, Math.round(count / 2)) : count;
    for (let i = 0; i < n; i++) {
      const a =
        opts.angle === undefined
          ? Math.random() * Math.PI * 2
          : opts.angle + (Math.random() - 0.5) * opts.spread;
      const sp = opts.speed * (0.4 + Math.random() * 0.9);
      add({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp + (opts.vyBias || 0),
        life: opts.life * (0.7 + Math.random() * 0.6),
        max: opts.life,
        size: opts.size * (0.6 + Math.random() * 0.8),
        color: opts.colors[(Math.random() * opts.colors.length) | 0],
        gravity: opts.gravity || 0,
        drag: opts.drag === undefined ? 1.6 : opts.drag,
      });
    }
  }

  const api = {
    reset() {
      particles = [];
      floats = [];
      shakeMag = 0;
      shakeT = 0;
    },

    shake(mag) {
      shakeMag = Math.max(shakeMag, mag);
      shakeT = shakeDur;
    },

    setQuality(low) {
      lowQuality = !!low;
    },

    // 画布上下文恢复后重建离屏天空缓存（离屏 canvas 也可能一起失效）
    rebuild() {
      ctx = canvas.getContext('2d', { alpha: false });
      bg = createBackground();
    },

    emit(events, world, opts = {}) {
      // 减弱动效时粒子直接减半（PRD A11Y-05 / 9.4），不只是变慢
      const k = opts.reduced ? 0.5 : 1;
      for (const ev of events) {
        if (ev.type === 'land') {
          burst(ev.x, ev.y - 2, 6 * k, {
            speed: 90,
            angle: -Math.PI / 2,
            spread: Math.PI,
            life: 0.32,
            size: 3,
            colors: ['#FFF3D6', '#E8D3A9', '#FFFFFF'],
            gravity: 220,
          });
        } else if (ev.type === 'spring') {
          burst(ev.x, ev.y - 8, 12 * k, {
            speed: 210,
            angle: -Math.PI / 2,
            spread: Math.PI * 0.8,
            life: 0.5,
            size: 3,
            colors: ['#FFD166', '#FFF0B8', '#E0446F'],
            gravity: 420,
          });
          if (!opts.reduced) api.shake(5);
        } else if (ev.type === 'star') {
          burst(ev.x, ev.y, 14 * k, {
            speed: 180,
            life: 0.55,
            size: 3,
            colors: ['#FFD166', '#FFF0B8', '#FFFFFF'],
            gravity: 60,
          });
          floats.push({ x: ev.x, y: ev.y - 6, text: '+10', life: 0.9, max: 0.9, color: C.gold });
        } else if (ev.type === 'crack') {
          burst(ev.x, ev.y + 4, 8 * k, {
            speed: 120,
            life: 0.45,
            size: 3,
            colors: ['#E8873C', '#FFB877', '#A85419'],
            gravity: 520,
          });
        } else if (ev.type === 'dead') {
          burst(ev.x, ev.y, 16 * k, {
            speed: 190,
            angle: -Math.PI / 2,
            spread: Math.PI,
            life: 0.75,
            size: 4,
            colors: ['#FFF3D6', '#E8D3A9', '#E0446F'],
            gravity: 340,
          });
        }
      }
    },

    draw(world, time, opts = {}) {
      const reduced = !!opts.reduced;
      updateParticles(opts.dt || 0, reduced);
      const camY = world.cameraY;

      ctx.globalAlpha = 1;
      bg.draw(ctx, camY, world.stats.meters, time, reduced, lowQuality);

      let shakeX = 0;
      let shakeY = 0;
      if (!reduced && shakeT > 0) {
        const k = shakeT / shakeDur;
        shakeX = Math.round(Math.sin(time * 92) * shakeMag * k);
        shakeY = Math.round(Math.cos(time * 81) * shakeMag * k * 0.7);
      }

      ctx.save();
      ctx.translate(shakeX, shakeY - camY);

      // 平台：从屏幕上方到下方绘制
      const plats = world.platforms.slice().sort((a, b) => a.y - b.y);
      for (const plat of plats) {
        if (plat.state === 'gone') continue;
        const y = plat.y;
        if (y < camY - 60 || y > camY + VIEW.H + 60) continue;
        drawPlatform(ctx, plat, time);
      }

      for (const star of world.stars) {
        if (star.taken) continue;
        if (star.y < camY - 30 || star.y > camY + VIEW.H + 30) continue;
        drawStar(ctx, star, time);
      }

      if (!world.dead) drawPlayer(ctx, world.player, time);

      for (const p of particles) {
        const a = Math.max(0, Math.min(1, p.life / p.max));
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.ceil(p.size), Math.ceil(p.size));
      }
      ctx.globalAlpha = 1;

      for (const f of floats) {
        const a = Math.max(0, Math.min(1, f.life / f.max));
        ctx.globalAlpha = a;
        ctx.fillStyle = f.color;
        ctx.font = '700 16px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(f.text, Math.round(f.x), Math.round(f.y));
        ctx.globalAlpha = 1;
      }

      ctx.restore();
      ctx.textAlign = 'left';
    },
  };

  function updateParticles(dt, reduced) {
    const d = reduced ? dt * 0.6 : dt;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= d;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * d;
      p.x += p.vx * d;
      p.y += p.vy * d;
      const drag = Math.max(0, 1 - p.drag * d);
      p.vx *= drag;
      p.vy *= drag;
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= d;
      f.y -= 26 * d;
      if (f.life <= 0) floats.splice(i, 1);
    }
    if (shakeT > 0) {
      shakeT -= dt;
      if (shakeT <= 0) shakeMag = 0;
    }
  }

  return api;
}
