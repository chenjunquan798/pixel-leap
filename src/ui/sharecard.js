// 1200 × 630 分享卡（PRD 9.7）。
// 只画分数、游戏名、最高分与链接；不含任何玩家标识。

import { ZONES, PLATFORM, C, mixHex } from '../render/palette.js';
import { drawPlayer } from '../render/sprites.js';

const W = 1200;
const H = 630;

function band(ctx, colors, x, y, w, h) {
  const n = colors.length;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[i];
    const y0 = y + (h / n) * i;
    ctx.fillRect(x, y0, w, h / n + 1);
  }
  // 抖动过渡
  for (let i = 1; i < n; i++) {
    const edge = y + (h / n) * i;
    ctx.fillStyle = colors[i - 1];
    for (let row = 0; row < 3; row++) {
      for (let cx = 0; cx < w; cx += 3) {
        if ((cx / 3 + row) % 2 === 0) ctx.fillRect(x + cx, edge + row, 3, 1);
      }
    }
  }
}

function roundRect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function renderShareCard({ score, best, meters, stars, t }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const dusk = ZONES[1];

  // 天空
  band(ctx, dusk.sky.map((c) => mixHex(c, '#2A1030', 0.25)), 0, 0, W, H);
  ctx.globalAlpha = 0.35;
  const sun = ctx.createRadialGradient(880, 520, 20, 880, 520, 280);
  sun.addColorStop(0, '#FFD166');
  sun.addColorStop(1, 'rgba(255,209,102,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(600, 240, 600, 400);
  ctx.globalAlpha = 1;

  // 星点
  for (let i = 0; i < 70; i++) {
    const x = (i * 137.5) % W;
    const y = (i * 71.3) % (H * 0.62);
    const s = i % 7 === 0 ? 3 : 2;
    ctx.globalAlpha = 0.15 + ((i * 37) % 40) / 100;
    ctx.fillStyle = '#FFE3C4';
    ctx.fillRect(Math.floor(x), Math.floor(y), s, s);
  }
  ctx.globalAlpha = 1;

  // 远山剪影
  for (let i = 0; i < 90; i++) {
    const x = i * 14;
    const h = 60 + Math.sin(x * 0.012) * 30 + Math.sin(x * 0.004 + 2) * 40;
    ctx.fillStyle = dusk.hillFar;
    ctx.fillRect(x, H - h - 40, 15, h);
  }
  for (let i = 0; i < 90; i++) {
    const x = i * 14;
    const h = 40 + Math.sin(x * 0.018 + 1) * 22 + Math.sin(x * 0.006) * 26;
    ctx.fillStyle = dusk.hillNear;
    ctx.fillRect(x, H - h - 10, 15, h + 10);
  }

  // 左侧压暗，保证文字可读
  const shade = ctx.createLinearGradient(0, 0, 760, 0);
  shade.addColorStop(0, 'rgba(12,6,20,0.82)');
  shade.addColorStop(0.62, 'rgba(12,6,20,0.55)');
  shade.addColorStop(1, 'rgba(12,6,20,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 900, H);

  // 场景：平台 + 角色（3 倍像素缩放）
  ctx.save();
  ctx.translate(600, 120);
  ctx.scale(3, 3);
  const plats = [
    { x: 196, y: 150, w: 56, type: 'moving', state: 'solid', h: 12, spring: false, amp: 0, omega: 1, phase: 0 },
    { x: 150, y: 104, w: 44, type: 'crumble', state: 'solid', h: 12, spring: false, amp: 0, omega: 1, phase: 0 },
    { x: 208, y: 58, w: 52, type: 'normal', state: 'solid', h: 12, spring: true, springUsed: false, amp: 0, omega: 1, phase: 0 },
  ];
  for (const p of plats) {
    const style = PLATFORM[p.type];
    ctx.fillStyle = style.outline;
    ctx.fillRect(p.x - 1, p.y - 1, p.w + 2, p.h + 2);
    ctx.fillStyle = style.body;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = style.light;
    ctx.fillRect(p.x, p.y, p.w, 3);
    ctx.fillStyle = style.dark;
    ctx.fillRect(p.x, p.y + p.h - 4, p.w, 4);
  }
  // 弹簧
  ctx.fillStyle = PLATFORM.spring.body;
  ctx.fillRect(232, 44, 14, 12);
  ctx.fillStyle = C.pink;
  ctx.fillRect(230, 52, 18, 4);

  // 星星
  ctx.fillStyle = C.gold;
  ctx.fillRect(292, 70, 10, 4);
  ctx.fillRect(290, 66, 3, 12);
  ctx.fillRect(299, 66, 3, 12);
  ctx.fillRect(295, 62, 3, 3);

  // 角色
  ctx.save();
  ctx.translate(232, 52);
  ctx.scale(3, 3);
  drawPlayer(ctx, { x: 0, y: 0, vy: -520, face: 1, squash: 0, blink: 0 }, 0.6);
  ctx.restore();
  ctx.restore();

  // 标题
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.cream;
  ctx.font = '900 46px Impact, "Arial Black", system-ui, sans-serif';
  ctx.fillText('PIXEL LEAP', 76, 112);
  ctx.fillStyle = C.gold;
  ctx.font = '700 28px "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif';
  ctx.fillText('像素跳跳乐', 78, 152);

  // 分数
  const scoreText = String(score);
  const size = scoreText.length >= 5 ? 132 : scoreText.length === 4 ? 156 : 176;
  ctx.font = `900 ${size}px Impact, "Arial Black", system-ui, sans-serif`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#241026';
  ctx.strokeText(scoreText, 72, 356);
  ctx.fillStyle = C.gold;
  ctx.fillText(scoreText, 72, 356);

  const scoreW = ctx.measureText(scoreText).width;
  ctx.fillStyle = C.cream;
  ctx.font = '700 26px "Microsoft YaHei", system-ui, sans-serif';
  ctx.fillText(t('over.points'), 84 + scoreW, 352);

  // 高度 / 星星
  ctx.fillStyle = 'rgba(255,243,214,0.88)';
  ctx.font = '600 26px "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif';
  ctx.fillText(`${t('over.height')} ${meters} m   ·   ★ ${stars}`, 80, 402);

  // 最高分标签
  const bestText = t('share.cardBest', { best });
  ctx.font = '700 24px "Microsoft YaHei", system-ui, sans-serif';
  const bw = ctx.measureText(bestText).width + 40;
  roundRect(ctx, 76, 428, bw, 48, 8, C.cream);
  ctx.fillStyle = C.ink;
  ctx.fillText(bestText, 96, 460);

  // CTA + 链接
  ctx.fillStyle = 'rgba(255,243,214,0.72)';
  ctx.font = '600 24px "Microsoft YaHei", system-ui, sans-serif';
  ctx.fillText(t('share.cardCta'), 80, 528);
  ctx.fillStyle = 'rgba(255,243,214,0.5)';
  ctx.font = '500 20px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText('chenjunquan798.github.io/pixel-leap', 80, 566);

  // 像素边框
  ctx.strokeStyle = 'rgba(255,243,214,0.85)';
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 18, W - 36, H - 36);
  ctx.strokeStyle = 'rgba(23,16,31,0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, W - 56, H - 56);
  // 四角装饰
  for (const [x, y] of [[18, 18], [W - 34, 18], [18, H - 34], [W - 34, H - 34]]) {
    ctx.fillStyle = C.gold;
    ctx.fillRect(x, y, 16, 16);
  }

  return canvas;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    if (canvas.toBlob) canvas.toBlob((blob) => resolve(blob), 'image/png', 0.92);
    else resolve(null);
  });
}
