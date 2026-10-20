// 像素角色与道具的绘制。
// 全部用整数矩形绘制（不做浮点缩放），保证任何缩放倍数下都是干净的像素边。

import { PLATFORM, C } from './palette.js';

const rect = (ctx, x, y, w, h, color) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

// 角色：一只奶油色的小猫，戴青绿色围巾。脚底在原点 (0,0)。
export function drawPlayer(ctx, p, t) {
  const face = p.face || 1;
  const stretch = Math.max(0, Math.min(1, -p.vy / 950)) * 3;
  const squat = (p.squash || 0) * 5;
  const bodyH = Math.max(12, Math.round(20 + stretch - squat));
  const bodyW = Math.max(14, Math.round(20 - stretch * 0.6 + squat * 0.9));
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const blink = p.blink > 0 && p.blink < 0.12;
  const top = -bodyH - 4;

  ctx.save();
  ctx.translate(x, y);

  // 尾巴（跟随面部朝向，随时间摆动）
  const wag = Math.sin(t * 5.5) * 2;
  const tailX = face > 0 ? -bodyW / 2 - 5 : bodyW / 2 + 1;
  rect(ctx, tailX, top + bodyH * 0.55 + wag, 5, 4, C.creamDim);
  rect(ctx, tailX + (face > 0 ? -4 : 4), top + bodyH * 0.38 + wag, 5, 5, C.cream);
  rect(ctx, tailX + (face > 0 ? -4 : 4), top + bodyH * 0.38 + wag, 5, 2, C.pink);

  // 后脚
  rect(ctx, -bodyW / 2 + 1, -4, 6, 4, C.creamDim);
  rect(ctx, bodyW / 2 - 7, -4, 6, 4, C.creamDim);

  // 身体 + 描边（先画外框，再覆盖内部）
  rect(ctx, -bodyW / 2 - 1, top - 1, bodyW + 2, bodyH + 2, '#2A1522');
  rect(ctx, -bodyW / 2, top, bodyW, bodyH, C.cream);
  rect(ctx, -bodyW / 2, top, bodyW, 3, C.white);
  rect(ctx, -bodyW / 2, top + bodyH - 4, bodyW, 4, C.creamDim);

  // 耳朵
  const earY = top - 6;
  rect(ctx, -bodyW / 2 + 1, earY + 2, 5, 6, '#2A1522');
  rect(ctx, -bodyW / 2 + 2, earY + 3, 3, 4, C.pink);
  rect(ctx, bodyW / 2 - 6, earY + 2, 5, 6, '#2A1522');
  rect(ctx, bodyW / 2 - 5, earY + 3, 3, 4, C.pink);

  // 围巾
  const scarfY = top + bodyH - 9;
  rect(ctx, -bodyW / 2, scarfY, bodyW, 4, C.teal);
  rect(ctx, -bodyW / 2, scarfY, bodyW, 1, '#4FE0D0');
  rect(ctx, (face > 0 ? -1 : -5) * 1, scarfY, 5, 7, C.teal);

  // 眼睛
  const eyeY = top + 6;
  const eyeDx = 4;
  const ex1 = -eyeDx - 2 + (face > 0 ? 0 : 1);
  const ex2 = eyeDx - 2 + (face > 0 ? 0 : 1);
  if (blink) {
    rect(ctx, ex1, eyeY + 2, 4, 1, '#2A1522');
    rect(ctx, ex2, eyeY + 2, 4, 1, '#2A1522');
  } else {
    rect(ctx, ex1, eyeY, 4, 5, C.white);
    rect(ctx, ex2, eyeY, 4, 5, C.white);
    rect(ctx, ex1 + (face > 0 ? 1 : 0), eyeY + 1, 2, 3, '#17101F');
    rect(ctx, ex2 + (face > 0 ? 1 : 0), eyeY + 1, 2, 3, '#17101F');
    rect(ctx, ex1 + (face > 0 ? 2 : 1), eyeY + 1, 1, 1, '#FFFDF5');
    rect(ctx, ex2 + (face > 0 ? 2 : 1), eyeY + 1, 1, 1, '#FFFDF5');
  }

  // 腮红 + 嘴
  rect(ctx, -bodyW / 2 + 3, eyeY + 6, 3, 2, '#F0A0B4');
  rect(ctx, bodyW / 2 - 6, eyeY + 6, 3, 2, '#F0A0B4');
  rect(ctx, -1, eyeY + 6, 2, 1, '#2A1522');

  ctx.restore();
}

// 平台：颜色 + 形状 + 运动三重编码（PRD 9.2）
export function drawPlatform(ctx, plat, t) {
  const style = PLATFORM[plat.type] || PLATFORM.normal;
  const x = Math.round(plat.x);
  const y = Math.round(plat.y);
  const w = Math.round(plat.w);
  const h = plat.h;

  if (plat.state === 'gone') return;

  // 落地阴影
  ctx.globalAlpha = 0.16;
  rect(ctx, x + 3, y + h + 3, w, 3, '#000000');
  ctx.globalAlpha = 1;

  if (plat.type === 'ground') {
    rect(ctx, x, y, w, h, PLATFORM.ground.body);
    rect(ctx, x, y, w, 6, PLATFORM.grass.body);
    rect(ctx, x, y, w, 2, PLATFORM.grass.light);
    // 草边锯齿
    for (let gx = x; gx < x + w; gx += 8) {
      rect(ctx, gx, y - 3, 4, 3, PLATFORM.grass.body);
      rect(ctx, gx, y - 3, 2, 1, PLATFORM.grass.light);
    }
    rect(ctx, x, y + h - 6, w, 6, PLATFORM.ground.dark);
    for (let gx = x + 6; gx < x + w; gx += 26) rect(ctx, gx, y + 12, 10, 3, PLATFORM.ground.light);
    rect(ctx, x, y, 3, h, PLATFORM.ground.light);
    return;
  }

  const shakeX = plat.state === 'shaking' ? Math.sin(t * 70) * 1.6 : 0;
  const px = Math.round(x + shakeX);

  // 主体：描边 + 三层色
  rect(ctx, px - 1, y - 1, w + 2, h + 2, style.outline);
  rect(ctx, px, y, w, h, style.body);
  rect(ctx, px, y, w, 3, style.light);
  rect(ctx, px, y + h - 4, w, 4, style.dark);

  if (plat.type === 'moving') {
    // 两端亮点，表示「会动」
    rect(ctx, px + 1, y + 3, 3, h - 6, style.light);
    rect(ctx, px + w - 4, y + 3, 3, h - 6, style.light);
    const dir = Math.cos(t * plat.omega + plat.phase);
    const cx = dir > 0 ? px + w - 7 : px + 4;
    rect(ctx, cx, y + 4, 3, 4, '#FFFFFF');
  } else if (plat.type === 'crumble') {
    // 裂纹
    rect(ctx, px + Math.round(w * 0.3), y + 2, 1, 4, style.outline);
    rect(ctx, px + Math.round(w * 0.3) + 1, y + 6, 1, 4, style.outline);
    rect(ctx, px + Math.round(w * 0.68), y + 4, 1, 5, style.outline);
    rect(ctx, px + Math.round(w * 0.68) - 2, y + 8, 2, 1, style.outline);
    if (plat.state === 'shaking') {
      const k = Math.max(0, plat.timer / 0.28);
      ctx.globalAlpha = 0.5 + 0.5 * (1 - k);
      rect(ctx, px + 2, y + 1, w - 4, h - 2, style.light);
      ctx.globalAlpha = 1;
    }
  } else {
    // 普通平台的两个铆钉
    rect(ctx, px + 3, y + 5, 2, 2, style.dark);
    rect(ctx, px + w - 5, y + 5, 2, 2, style.dark);
  }

  if (plat.spring) drawSpring(ctx, plat, t);
}

function drawSpring(ctx, plat, t) {
  const w = 14;
  const x = Math.round(plat.x + plat.w / 2 - w / 2);
  const baseY = Math.round(plat.y);
  const used = plat.springUsed;
  const compress = used ? 1 : 0;
  const coils = 3 - compress;

  // 底座
  rect(ctx, x - 2, baseY - 3, w + 4, 3, C.pink);
  rect(ctx, x - 2, baseY - 3, w + 4, 1, '#FF8FAF');

  let cy = baseY - 4;
  for (let i = 0; i < coils; i++) {
    rect(ctx, x, cy - 3, w, 3, PLATFORM.spring.body);
    rect(ctx, x, cy - 3, w, 1, PLATFORM.spring.light);
    rect(ctx, x + 2, cy - 1, w - 4, 1, PLATFORM.spring.dark);
    cy -= 4;
  }
  // 顶板
  rect(ctx, x - 1, cy - 3, w + 2, 3, PLATFORM.spring.body);
  rect(ctx, x - 1, cy - 3, w + 2, 1, PLATFORM.spring.light);
  if (!used) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 6 + plat.phase);
    ctx.globalAlpha = 0.25 + pulse * 0.35;
    rect(ctx, x - 4, cy - 7, w + 8, 4, PLATFORM.spring.light);
    ctx.globalAlpha = 1;
  }
}

// 星星：先画光晕，再画像素星形
export function drawStar(ctx, star, t) {
  if (star.taken) return;
  const tw = 0.75 + 0.25 * Math.sin(t * 4 + star.phase);
  const x = Math.round(star.x);
  const y = Math.round(star.y);
  const s = tw > 0.92 ? 11 : 9;

  ctx.globalAlpha = 0.18 * tw;
  rect(ctx, x - s, y - s, s * 2, s * 2, C.gold);
  ctx.globalAlpha = 0.9;

  // 像素五角星
  const g = C.gold;
  const d = PLATFORM.spring.dark;
  rect(ctx, x - 1, y - s, 2, s, g);
  rect(ctx, x - s, y - 2, s * 2, 4, g);
  rect(ctx, x - 5, y - 5, 10, 3, g);
  rect(ctx, x - 4, y + 2, 3, 3, g);
  rect(ctx, x + 1, y + 2, 3, 3, g);
  rect(ctx, x - 1, y - s + 1, 2, 2, C.white);
  rect(ctx, x - 3, y - 1, 2, 2, d);
  ctx.globalAlpha = 1;
}
