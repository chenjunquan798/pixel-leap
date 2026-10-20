// 背景：三套天空 + 视差星层 / 云层 / 远山。
// 天空色带在离屏画布上生成一次（含月/日/行星与抖动过渡），每帧只做 drawImage 与混合。

import { ZONES, zoneBlend, mixHex, C } from './palette.js';
import { makeRng } from '../core/rng.js';
import { VIEW } from '../core/config.js';

const W = VIEW.W;
const H = VIEW.H;

function px(g, x, y, w, h, color, alpha = 1) {
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  g.globalAlpha = 1;
}

// 像素圆：逐行填充，保留锯齿边
function pixelCircle(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    g.fillRect(Math.round(cx - dx), Math.round(cy + dy), dx * 2, 1);
  }
}

function buildSky(zone, index) {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  // 把 8 个色标插值成 14 条色带，边界用棋盘抖动过渡
  const stops = zone.sky;
  const bands = 14;
  const samples = [];
  for (let i = 0; i < bands; i++) {
    const pos = (i / (bands - 1)) * (stops.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(stops.length - 1, lo + 1);
    samples.push(mixHex(stops[lo], stops[hi], pos - lo));
  }
  const bandH = H / bands;

  for (let i = 0; i < bands; i++) {
    g.fillStyle = samples[i];
    g.fillRect(0, Math.floor(i * bandH), W, Math.ceil(bandH) + 1);
    if (i > 0) {
      const edge = Math.round(i * bandH);
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < W; x += 2) {
          if ((x / 2 + y) % 2 === 0) {
            g.fillStyle = samples[i - 1];
            g.fillRect(x, edge + y, 2, 1);
          }
        }
      }
    }
  }

  // 地平线光晕
  const haze = g.createLinearGradient(0, H * 0.62, 0, H);
  haze.addColorStop(0, 'rgba(0,0,0,0)');
  haze.addColorStop(1, hexA(zone.horizon, 0.35));
  g.fillStyle = haze;
  g.fillRect(0, H * 0.62, W, H * 0.38);

  const rng = makeRng(9001 + index * 77);

  if (zone.celestial === 'moon') {
    const mx = 352;
    const my = 126;
    pixelCircle(g, mx, my, 34, '#FFF3D6');
    pixelCircle(g, mx + 8, my + 6, 26, '#F2DFB8');
    pixelCircle(g, mx + 14, my + 12, 20, '#FFF3D6');
    for (const [cx, cy, r] of [[-10, -6, 5], [8, -12, 3], [-4, 14, 4]]) {
      pixelCircle(g, mx + cx, my + cy, r, '#E4CFA4');
    }
    g.globalAlpha = 0.05;
    pixelCircle(g, mx, my, 46, '#FFF3D6');
    g.globalAlpha = 1;
  } else if (zone.celestial === 'sun') {
    const sx = 118;
    const sy = 214;
    // 柔和光晕：多层极低透明度同心圆，避免出现明显的光环硬边
    for (let i = 0; i < 7; i++) {
      g.globalAlpha = 0.022;
      pixelCircle(g, sx, sy, 120 - i * 10, '#FFD166');
    }
    g.globalAlpha = 1;
    pixelCircle(g, sx, sy, 44, '#FFB05C');
    pixelCircle(g, sx, sy, 36, '#FFD166');
    pixelCircle(g, sx, sy - 2, 26, '#FFF0B8');
  } else {
    const px0 = 372;
    const py0 = 138;
    // 带环行星
    g.globalAlpha = 0.5;
    for (let i = -1; i <= 1; i++) {
      px(g, px0 - 62, py0 + 10 + i * 6, 124, 3, '#3E4690', 0.5);
    }
    g.globalAlpha = 1;
    pixelCircle(g, px0, py0, 30, '#242A66');
    pixelCircle(g, px0 - 6, py0 - 6, 22, '#39409B');
    pixelCircle(g, px0 - 10, py0 - 10, 12, '#4E56B8');
    g.globalAlpha = 0.45;
    px(g, px0 - 62, py0 + 16, 124, 3, '#151A44');
    g.globalAlpha = 1;
  }

  // 远处的固定微星
  if (zone.celestial !== 'sun') {
    const count = 110;
    for (let i = 0; i < count; i++) {
      const x = Math.floor(rng() * W);
      const y = Math.floor(rng() * H * 0.8);
      const s = rng() < 0.82 ? 1 : 2;
      px(g, x, y, s, s, zone.star, 0.18 + rng() * 0.5);
    }
  }

  return cv;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function createBackground() {
  let skies = null;

  function ensureSkies() {
    if (skies) return skies;
    skies = ZONES.map((zone, i) => buildSky(zone, i));
    return skies;
  }

  // 视差层：每层有独立的深度系数
  const rng = makeRng(4242);
  const midStars = Array.from({ length: 64 }, () => ({
    x: rng() * W,
    y: rng() * 1000,
    s: rng() < 0.75 ? 2 : 3,
    phase: rng() * 6.28,
    depth: 0.18 + rng() * 0.16,
  }));
  const clouds = Array.from({ length: 9 }, (_, i) => ({
    x: rng() * W,
    y: 120 + rng() * 780,
    w: 46 + rng() * 74,
    h: 12 + rng() * 12,
    depth: 0.26 + rng() * 0.14,
    layer: i % 2,
  }));
  const hills = Array.from({ length: 140 }, (_, i) => {
    const x = i * 4;
    const h = 34 + Math.sin(x * 0.021) * 16 + Math.sin(x * 0.0071 + 1.2) * 26;
    return { x, h };
  });

  function draw(ctx, cameraY, meters, time, reduced, lowQuality) {
    const list = ensureSkies();
    const blend = zoneBlend(meters);
    const zoneIndex = blend[1].alpha > 0.5 ? blend[1].index : blend[0].index;
    const zone = ZONES[zoneIndex];

    // 天空：主区域 + 淡入的下一区域
    ctx.globalAlpha = 1;
    ctx.drawImage(list[zoneIndex], 0, 0);
    if (!reduced) {
      for (const b of blend) {
        if (b.index === zoneIndex || b.alpha <= 0.001) continue;
        ctx.globalAlpha = b.alpha;
        ctx.drawImage(list[b.index], 0, 0);
      }
      ctx.globalAlpha = 1;
    }

    // 视差星层（夜 / 深空）；低端机隔一颗画一颗
    if (zone.celestial !== 'sun') {
      for (let i = 0; i < midStars.length; i++) {
        if (lowQuality && i % 2 === 0) continue;
        const s = midStars[i];
        let sy = s.y - cameraY * s.depth;
        sy = ((sy % 1000) + 1000) % 1000 - 60;
        if (sy < -10 || sy > H + 10) continue;
        const tw = 0.45 + 0.55 * Math.abs(Math.sin(time * 1.6 + s.phase));
        px(ctx, s.x, sy, s.s, s.s, zone.star, 0.35 + tw * 0.55);
      }
    }

    // 远山（仅低空可见）
    if (zone.celestial !== 'planet') {
      const baseY = H * 0.86 + cameraY * 0.1;
      if (baseY < H + 120) {
        for (const hill of hills) {
          px(ctx, hill.x, baseY - hill.h * 1.6, 5, hill.h * 1.6 + 200, zone.hillFar, 0.85);
        }
        for (const hill of hills) {
          const h = hill.h * 0.7;
          px(ctx, hill.x + 2, baseY + 14 - h, 5, h + 200, zone.hillNear, 0.9);
        }
      }
    }

    // 云 / 星云带：由 4 个错落的矩形叠成像素云（低端机减半）
    for (let ci = 0; ci < clouds.length; ci++) {
      if (lowQuality && ci % 2 === 1) continue;
      const cl = clouds[ci];
      let sy = cl.y - cameraY * cl.depth;
      sy = ((sy % 980) + 980) % 980 - 80;
      if (sy < -80 || sy > H + 40) continue;
      const color = cl.layer ? zone.cloudLight : zone.cloud;
      const alpha = zone.celestial === 'planet' ? 0.3 : 0.38;
      px(ctx, cl.x, sy + cl.h * 0.5, cl.w, cl.h * 0.5, color, alpha);
      px(ctx, cl.x + cl.w * 0.12, sy + cl.h * 0.12, cl.w * 0.5, cl.h * 0.55, color, alpha);
      px(ctx, cl.x + cl.w * 0.4, sy, cl.w * 0.3, cl.h * 0.45, color, alpha * 0.9);
      px(ctx, cl.x + cl.w * 0.64, sy + cl.h * 0.3, cl.w * 0.3, cl.h * 0.45, color, alpha * 0.9);
      px(ctx, cl.x + cl.w * 0.16, sy + cl.h * 0.1, cl.w * 0.22, 2, C.cream, alpha * 0.2);
      px(ctx, cl.x + cl.w * 0.1, sy + cl.h, cl.w * 0.8, 2, '#000000', alpha * 0.25);
    }

    // 底部空气感
    const g = ctx.createLinearGradient(0, H * 0.5, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, hexA(zone.tint, 0.5));
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.5, W, H * 0.5);
  }

  return { draw };
}
