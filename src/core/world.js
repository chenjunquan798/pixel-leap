// 世界模拟：物理、平台生成、碰撞、计分、镜头。
// 这里不碰 DOM / Canvas，因此可以在 Node 里跑机器人爬升测试（PRD 8.6）。

import {
  PHYS,
  VIEW,
  STEP,
  BANDS,
  SAFE_ZONE_PX,
  MAX_GAP,
  MAX_DX,
  CRUMBLE_DELAY,
  ZONE_THRESHOLDS,
} from './config.js';
import { makeRng, rangeFrom } from './rng.js';
import { computeScore, heightMeters } from './score.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

export function bandFor(meters) {
  for (let i = 0; i < BANDS.length; i++) {
    if (meters < BANDS[i].maxM) return { band: BANDS[i], index: i };
  }
  return { band: BANDS[BANDS.length - 1], index: BANDS.length - 1 };
}

function bandProgress(band, meters) {
  if (!isFinite(band.maxM)) return clamp((meters - band.minM) / 500, 0, 1);
  return clamp((meters - band.minM) / (band.maxM - band.minM), 0, 1);
}

export function zoneFor(meters) {
  if (meters >= ZONE_THRESHOLDS[1]) return 2;
  if (meters >= ZONE_THRESHOLDS[0]) return 1;
  return 0;
}

export function createWorld(options = {}) {
  const world = {
    seed: options.seed ?? 1,
    rng: null,
    time: 0,
    cameraY: 0,
    startY: PHYS.START_FEET_Y,
    minY: PHYS.START_FEET_Y,
    platforms: [],
    stars: [],
    events: [],
    input: { left: false, right: false },
    dead: false,
    deadAt: 0,
    zone: 0,
    zoneReached: new Set(),
    nextY: 0,
    cursorX: VIEW.W / 2,
    nextId: 1,
    player: {
      x: VIEW.W / 2,
      y: PHYS.START_FEET_Y,
      prevY: PHYS.START_FEET_Y,
      vx: 0,
      vy: 0,
      w: PHYS.PLAYER_W,
      h: PHYS.PLAYER_H,
      face: 1,
      squash: 0,
      blink: 0,
      landFx: 0,
    },
    stats: {
      score: 0,
      meters: 0,
      stars: 0,
      heightPx: 0,
      landings: 0,
      bounces: 0,
    },
  };

  world.reset = (seed) => resetWorld(world, seed);
  world.step = () => stepWorld(world);
  world.press = (dir) => {
    if (dir === 'left') world.input.left = true;
    if (dir === 'right') world.input.right = true;
  };
  world.release = (dir) => {
    if (dir === 'left') world.input.left = false;
    if (dir === 'right') world.input.right = false;
    if (dir === 'all') {
      world.input.left = false;
      world.input.right = false;
    }
  };
  world.snapshot = () => ({
    score: world.stats.score,
    meters: world.stats.meters,
    stars: world.stats.stars,
    heightPx: world.stats.heightPx,
    zone: world.zone,
    dead: world.dead,
    bestAtEnd: 0,
  });

  resetWorld(world, options.seed ?? 1);
  return world;
}

function resetWorld(world, seed) {
  world.seed = seed >>> 0 || 1;
  world.rng = makeRng(world.seed);
  world.time = 0;
  world.cameraY = 0;
  world.minY = world.startY;
  world.platforms.length = 0;
  world.stars.length = 0;
  world.events.length = 0;
  world.dead = false;
  world.deadAt = 0;
  world.zone = 0;
  world.zoneReached = new Set();
  world.nextId = 1;
  world.cursorX = VIEW.W / 2;
  world.input.left = false;
  world.input.right = false;
  world.stats = { score: 0, meters: 0, stars: 0, heightPx: 0, landings: 0, bounces: 0 };

  const p = world.player;
  p.x = VIEW.W / 2;
  p.y = world.startY;
  p.prevY = p.y;
  p.vx = 0;
  p.vy = -PHYS.JUMP_VY;
  p.face = 1;
  p.squash = 0;
  p.blink = 0;
  p.landFx = 0;

  // 地面：起始平台，永久存在
  world.platforms.push({
    id: world.nextId++,
    x: 0,
    y: world.startY + 4,
    w: VIEW.W,
    h: 40,
    type: 'ground',
    state: 'solid',
    timer: 0,
    spring: false,
    springUsed: false,
    amp: 0,
    omega: 0,
    phase: 0,
    cx: VIEW.W / 2,
  });

  // 第一块平台固定在正上方（PRD 6.2 / 8.5）
  world.nextY = world.startY - 96;
  spawnPlatform(world, true);
  // 第一颗星在首次跳跃路径上
  const first = world.platforms[world.platforms.length - 1];
  world.stars.push({
    id: world.nextId++,
    x: first.x + first.w / 2,
    y: first.y - 64,
    taken: false,
    phase: 0.4,
  });

  // 预生成首屏上方的平台，保证开局没有空档
  ensurePlatforms(world);
}

function spawnPlatform(world, isFirst = false) {
  const { rng } = world;
  const y = world.nextY;
  const meters = (world.startY - y) / PHYS.PX_PER_M;
  const { band } = bandFor(meters);
  const p = bandProgress(band, meters);

  const inSafeZone = y > world.startY - SAFE_ZONE_PX;

  const widthBase = lerp(band.width[0], band.width[1], p) * (0.9 + rng() * 0.2);
  const w = Math.round(clamp(widthBase, 52, 118));

  // 水平偏移：一次跳跃可覆盖范围（PRD 8.5），首块固定在正上方
  const dx = isFirst ? 0 : (rng() * 2 - 1) * lerp(58, MAX_DX, p);
  const x = clamp(world.cursorX + dx - w / 2, 10, VIEW.W - 10 - w);
  const center = x + w / 2;
  world.cursorX = center;

  // 类型：安全区内一律普通平台
  let type = 'normal';
  let spring = false;
  if (!inSafeZone && !isFirst) {
    const movingP = lerp(band.moving[0], band.moving[1], p);
    const crumbleP = lerp(band.crumble[0], band.crumble[1], p);
    const springP = band.spring[0];
    const roll = rng();
    if (roll < movingP) type = 'moving';
    else if (roll < movingP + crumbleP) type = 'crumble';
    else if (rng() < springP) spring = true;
  }

  const amp = type === 'moving' ? 26 + rng() * 30 : 0;
  const omega = type === 'moving' ? 0.9 + rng() * 0.7 : 0;
  const plat = {
    id: world.nextId++,
    x,
    y,
    // 移动平台：中心在轨道内往返，不能让平台跑出屏幕
    cx: clamp(center, 10 + amp + w / 2, VIEW.W - 10 - amp - w / 2),
    w,
    h: PHYS.PLATFORM_H,
    type,
    state: 'solid',
    timer: 0,
    spring,
    springUsed: false,
    amp,
    omega,
    phase: rng() * Math.PI * 2,
  };
  world.platforms.push(plat);

  // 星星：第一块必出，之后约 55% 概率
  const canStar = type !== 'crumble' && world.stars.length < 7;
  if (canStar && (isFirst || rng() < 0.55)) {
    world.stars.push({
      id: world.nextId++,
      x: plat.cx + (isFirst ? 0 : (rng() * 2 - 1) * 22),
      y: plat.y - (isFirst ? 64 : 58 + rng() * 34),
      taken: false,
      phase: rng() * Math.PI * 2,
    });
  }

  // 下一块的间距：按当前难度带的 gap 区间取值，并硬性不超过跳跃高度的 60%
  const nextMeters = meters + 10;
  const nextBand = bandFor(nextMeters).band;
  const nextP = bandProgress(nextBand, nextMeters);
  const gapBase = lerp(nextBand.gap[0], nextBand.gap[1], nextP);
  const nextGap = clamp(gapBase * (0.9 + rng() * 0.2), 60, Math.min(116, MAX_GAP));
  world.nextY = y - nextGap;
  return plat;
}

function stepWorld(world) {
  if (world.dead) return;
  world.time += STEP;
  world.events.length = 0;

  updateMovingPlatforms(world);
  updatePlayer(world);
  resolveLanding(world);
  updateStars(world);
  updateCrumble(world);
  updateCamera(world);
  updateProgress(world);
  checkDeath(world);
  cleanup(world);
  ensurePlatforms(world);
}

function updateMovingPlatforms(world) {
  const t = world.time;
  for (const plat of world.platforms) {
    if (plat.type !== 'moving' || plat.state === 'gone') continue;
    const offset = Math.sin(t * plat.omega + plat.phase) * plat.amp;
    plat.x = plat.cx + offset - plat.w / 2;
  }
}

function updatePlayer(world) {
  const p = world.player;
  const dir = (world.input.right ? 1 : 0) - (world.input.left ? 1 : 0);

  if (dir !== 0) {
    p.vx += dir * PHYS.ACCEL * STEP;
    p.vx = clamp(p.vx, -PHYS.MAX_VX, PHYS.MAX_VX);
    p.face = dir;
  } else {
    const drag = PHYS.FRICTION * STEP;
    if (Math.abs(p.vx) <= drag) p.vx = 0;
    else p.vx -= Math.sign(p.vx) * drag;
  }

  p.prevY = p.y;
  p.x += p.vx * STEP;
  // 解析积分（velocity Verlet）：常量重力下高度精确，跳跃高度等于 v²/2g
  p.y += p.vy * STEP + 0.5 * PHYS.GRAVITY * STEP * STEP;
  p.vy += PHYS.GRAVITY * STEP;

  p.x = clamp(p.x, p.w / 2 + 2, VIEW.W - p.w / 2 - 2);
  if (p.x <= p.w / 2 + 2 || p.x >= VIEW.W - p.w / 2 - 2) p.vx *= 0.2;

  if (p.squash > 0) p.squash = Math.max(0, p.squash - STEP * 7);
  if (p.landFx > 0) p.landFx = Math.max(0, p.landFx - STEP * 4);
  p.blink -= STEP;
  if (p.blink < -2.4) p.blink = 0.12;
}

function resolveLanding(world) {
  const p = world.player;
  if (p.vy <= 0) return;

  let target = null;
  for (const plat of world.platforms) {
    if (plat.state === 'gone') continue;
    const top = plat.y;
    // 横扫碰撞：上一帧脚底在平台顶之上，本帧跨过顶部
    if (p.prevY > top + 1.5) continue;
    if (p.y < top) continue;
    // 横向：允许 9 px 的边缘容错（PRD 8.5）
    const overlap =
      Math.min(p.x + p.w / 2, plat.x + plat.w) - Math.max(p.x - p.w / 2, plat.x);
    if (overlap < -PHYS.EDGE_TOLERANCE) continue;
    if (!target || plat.y < target.y) target = plat;
  }
  if (!target) return;

  land(world, target);
}

function land(world, plat) {
  const p = world.player;
  const isSpring = plat.spring && !plat.springUsed;

  p.y = plat.y;
  p.vy = isSpring ? -PHYS.SPRING_VY : -PHYS.JUMP_VY;
  p.squash = isSpring ? 1.5 : 1;
  p.landFx = 1;

  world.stats.landings += 1;
  world.stats.bounces += 1;
  world.events.push({
    type: isSpring ? 'spring' : 'land',
    platformType: plat.type,
    x: p.x,
    y: plat.y,
    vy: p.vy,
  });

  if (isSpring) {
    plat.springUsed = true;
  }
  if (plat.type === 'crumble' && plat.state === 'solid') {
    plat.state = 'shaking';
    plat.timer = CRUMBLE_DELAY;
    world.events.push({ type: 'crack', x: plat.x + plat.w / 2, y: plat.y });
  }
}

function updateStars(world) {
  const p = world.player;
  const cx = p.x;
  const cy = p.y - p.h / 2;
  for (const star of world.stars) {
    if (star.taken) continue;
    // PRD FR-06：横向 <20px / 纵向 <24px
    if (Math.abs(star.x - cx) < 20 && Math.abs(star.y - cy) < 24) {
      star.taken = true;
      world.stats.stars += 1;
      world.events.push({ type: 'star', x: star.x, y: star.y, total: world.stats.stars });
    }
  }
}

function updateCrumble(world) {
  for (const plat of world.platforms) {
    if (plat.state !== 'shaking') continue;
    plat.timer -= STEP;
    if (plat.timer <= 0) {
      plat.state = 'gone';
      world.events.push({ type: 'platformGone', x: plat.x + plat.w / 2, y: plat.y });
    }
  }
}

function updateCamera(world) {
  const line = world.player.y - VIEW.H * PHYS.CAMERA_LINE;
  if (line < world.cameraY) world.cameraY = line;
}

function updateProgress(world) {
  const p = world.player;
  if (p.y < world.minY) world.minY = p.y;
  world.stats.heightPx = world.startY - world.minY;
  world.stats.meters = heightMeters(world.startY, world.minY);
  world.stats.score = computeScore(world.startY, world.minY, world.stats.stars);

  const zone = zoneFor(world.stats.meters);
  if (zone !== world.zone) {
    world.zone = zone;
    world.events.push({ type: 'zone', zone, meters: world.stats.meters });
  }
  if (world.stats.meters >= 200 && !world.zoneReached.has(200)) {
    world.zoneReached.add(200);
    world.events.push({ type: 'milestone', meters: 200 });
  }
  if (world.stats.meters >= 500 && !world.zoneReached.has(500)) {
    world.zoneReached.add(500);
    world.events.push({ type: 'milestone', meters: 500 });
  }
}

function checkDeath(world) {
  const p = world.player;
  if (p.y - p.h > world.cameraY + VIEW.H + PHYS.DEATH_MARGIN) {
    world.dead = true;
    world.deadAt = world.time;
    world.events.push({
      type: 'dead',
      score: world.stats.score,
      meters: world.stats.meters,
      stars: world.stats.stars,
      heightPx: Math.round(world.stats.heightPx),
      duration: world.time,
    });
  }
}

function cleanup(world) {
  const limit = world.cameraY + VIEW.H + 600;
  if (world.platforms.length > 48) {
    world.platforms = world.platforms.filter((plat) => plat.type === 'ground' || plat.y < limit);
  }
  if (world.stars.length > 12) {
    world.stars = world.stars.filter((star) => !star.taken && star.y < limit);
  }
}

// 平台生成是惰性的：调用方（主循环 / 机器人）在推进前补齐画面外平台。
export function ensurePlatforms(world) {
  const limit = world.cameraY - 260;
  let guard = 0;
  while (world.nextY > limit && guard++ < 200) {
    spawnPlatform(world);
  }
}

// 供测试与调试使用：从外部注入一块平台
export function resetSeed(world, seed) {
  resetWorld(world, seed);
}
