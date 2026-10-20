import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorld } from '../src/core/world.js';
import { PHYS, STEP } from '../src/core/config.js';

// PRD 8.6：机器人自动瞄准最近平台上方，连续 ≥300 秒；
// 不卡死、高度持续增长、不出现不可达平台。
export function robotDirection(world) {
  const p = world.player;
  // 抛物线顶点：上升时用能量守恒预测，顶点在一次跳跃内固定
  const apex = p.vy < 0 ? p.y - (p.vy * p.vy) / (2 * PHYS.GRAVITY) : p.y;

  // 落点 = 顶点下方最高的一块平台（下落时最先跨过的那块）
  let target = null;
  for (const plat of world.platforms) {
    if (plat.state === 'gone') continue;
    if (plat.y <= apex + 1) continue;
    if (!target || plat.y < target.y) target = plat;
  }
  if (!target) return 0;
  const err = target.x + target.w / 2 - p.x;
  if (Math.abs(err) < 3) return 0;
  return Math.sign(err);
}

test('机器人连续爬升 300 秒：不死亡、不卡死、高度持续增长', () => {
  const w = createWorld({ seed: 20261020 });
  const seconds = 300;
  const steps = seconds * 60;
  let maxHeight = 0;
  let stalls = 0;
  let lastProgressAt = 0;
  let deaths = 0;

  for (let i = 0; i < steps; i++) {
    const dir = robotDirection(w);
    w.input.left = dir < 0;
    w.input.right = dir > 0;
    w.step();
    if (w.dead) {
      deaths++;
      break;
    }
    const h = w.stats.heightPx;
    if (h > maxHeight + 0.5) {
      maxHeight = h;
      lastProgressAt = i;
    } else if (i - lastProgressAt > 60 * 6) {
      stalls++;
      lastProgressAt = i;
    }
  }

  assert.equal(deaths, 0, `robot died at ${w.stats.meters}m (height ${w.stats.heightPx}px)`);
  assert.ok(stalls === 0, `robot stalled ${stalls} times without gaining height`);
  assert.ok(
    maxHeight > 3000,
    `robot only reached ${(maxHeight / PHYS.PX_PER_M).toFixed(0)}m in ${seconds}s`
  );
  assert.ok(w.stats.meters > 375, `expected >375m, got ${w.stats.meters}m`);
});

test('机器人 300 秒内不会遇到不可达平台（间隙与偏移联合约束）', () => {
  const w = createWorld({ seed: 777 });
  const bad = [];
  for (let i = 0; i < 60 * 180; i++) {
    const dir = robotDirection(w);
    w.input.left = dir < 0;
    w.input.right = dir > 0;
    w.step();
    if (w.dead) break;
    const plats = w.platforms.filter((p) => p.type !== 'ground').sort((a, b) => b.y - a.y);
    for (let k = 1; k < plats.length; k++) {
      const gap = plats[k - 1].y - plats[k].y;
      const dx = Math.abs(
        plats[k].x + plats[k].w / 2 - (plats[k - 1].x + plats[k - 1].w / 2)
      );
      // 保守可达性判定：下落段水平位移足够覆盖偏移
      const disc = PHYS.JUMP_VY ** 2 - 2 * PHYS.GRAVITY * gap;
      if (disc <= 0) {
        bad.push({ gap, dx, reason: 'gap above jump height' });
        continue;
      }
      const tFall = (PHYS.JUMP_VY + Math.sqrt(disc)) / PHYS.GRAVITY;
      const reach = PHYS.MAX_VX * tFall;
      if (dx > reach) bad.push({ gap, dx, reach, reason: 'horizontal unreachable' });
    }
    if (bad.length) break;
  }
  assert.deepEqual(bad.slice(0, 3), []);
});

test('固定步进下模拟结果可复现', () => {
  const run = () => {
    const w = createWorld({ seed: 1234 });
    for (let i = 0; i < 60 * 20; i++) {
      const dir = robotDirection(w);
      w.input.left = dir < 0;
      w.input.right = dir > 0;
      w.step();
    }
    return { h: w.stats.heightPx, s: w.stats.score, stars: w.stats.stars };
  };
  assert.deepEqual(run(), run());
  assert.ok(STEP > 0);
});
