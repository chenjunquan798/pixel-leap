import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorld, ensurePlatforms } from '../src/core/world.js';
import { PHYS, MAX_GAP, SAFE_ZONE_PX, MAX_DX } from '../src/core/config.js';

test('第一块平台固定在正上方，第一颗星在跳跃路径上', () => {
  const w = createWorld({ seed: 11 });
  const ground = w.platforms.find((p) => p.type === 'ground');
  const first = w.platforms.find((p) => p.type !== 'ground');
  assert.ok(ground, 'ground exists');
  assert.ok(first, 'first platform exists');
  const center = first.x + first.w / 2;
  assert.ok(Math.abs(center - 240) < 1, `first platform centred, got ${center}`);
  assert.ok(first.spring === false && first.type === 'normal', 'first platform is plain');

  const star = w.stars[0];
  assert.ok(star, 'first star exists');
  assert.ok(Math.abs(star.x - center) < 1);
  assert.ok(first.y - star.y > 0 && first.y - star.y < 196, 'star is on the first jump path');
});

test('首屏只有一颗星，且没有任何两颗星重叠（回归：首星被重复生成）', () => {
  for (const seed of [1, 7, 11, 42, 99]) {
    const w = createWorld({ seed });
    const seen = new Set();
    for (const s of w.stars) {
      const key = `${Math.round(s.x)},${Math.round(s.y)}`;
      assert.ok(!seen.has(key), `seed ${seed}: duplicate star at ${key}`);
      seen.add(key);
    }
    const first = w.platforms.find((p) => p.type !== 'ground');
    const near = w.stars.filter(
      (s) => Math.abs(s.x - (first.x + first.w / 2)) < 1 && Math.abs(s.y - (first.y - 64)) < 1
    );
    assert.equal(near.length, 1, `seed ${seed}: first platform must have exactly one star`);
  }
});

test('前 420px 不出现特殊平台', () => {
  for (const seed of [1, 2, 3, 55, 99]) {
    const w = createWorld({ seed });
    const safeLimit = w.startY - SAFE_ZONE_PX;
    for (const plat of w.platforms) {
      if (plat.type === 'ground') continue;
      if (plat.y < safeLimit) continue;
      assert.equal(plat.type, 'normal', `seed ${seed} special platform in safe zone`);
      assert.equal(plat.spring, false, `seed ${seed} spring in safe zone`);
    }
  }
});

test('同一种子生成完全一致，不同种子不同', () => {
  const a = createWorld({ seed: 42 });
  const b = createWorld({ seed: 42 });
  const c = createWorld({ seed: 43 });
  const shape = (w) => w.platforms.map((p) => `${Math.round(p.x)},${Math.round(p.y)},${p.type}`).join('|');
  assert.equal(shape(a), shape(b));
  assert.notEqual(shape(a), shape(c));
});

test('平台间隙 ≤ 跳跃高度的 60%（116px），宽度 ≥ 52px，水平偏移 ≤ 135px', () => {
  for (const seed of [1, 5, 9, 17, 31, 77]) {
    const w = createWorld({ seed });
    for (let i = 0; i < 6000; i++) {
      ensurePlatforms(w);
      w.cameraY -= 6;
      ensurePlatforms(w);
      if (w.platforms.length > 400) break;
    }
    const plats = w.platforms.filter((p) => p.type !== 'ground').sort((a, b) => b.y - a.y);
    assert.ok(plats.length > 20, 'generated a run of platforms');
    for (let i = 1; i < plats.length; i++) {
      const gap = plats[i - 1].y - plats[i].y;
      assert.ok(gap > 0, `platforms ascend, got ${gap}`);
      assert.ok(gap <= MAX_GAP + 0.001, `gap ${gap} exceeds ${MAX_GAP}`);
      assert.ok(gap >= 55, `gap ${gap} too small`);
      assert.ok(plats[i].w >= 52, `width ${plats[i].w} below 52`);
      assert.ok(plats[i].x >= 0 && plats[i].x + plats[i].w <= 480, 'platform inside stage');
      const dx = Math.abs(
        plats[i].x + plats[i].w / 2 - (plats[i - 1].x + plats[i - 1].w / 2)
      );
      assert.ok(dx <= MAX_DX + 0.001, `dx ${dx} exceeds ${MAX_DX}`);
    }
  }
});

test('星星不会生成在不可达的高度', () => {
  const w = createWorld({ seed: 21 });
  for (let i = 0; i < 400; i++) {
    w.cameraY -= 8;
    ensurePlatforms(w);
  }
  for (const star of w.stars) {
    const below = w.platforms
      .filter((p) => p.type !== 'ground' && p.y > star.y)
      .sort((a, b) => a.y - b.y)[0];
    assert.ok(below, 'every star has a platform underneath');
    assert.ok(below.y - star.y < 196, 'star within one jump of its platform');
  }
});

test('难度随高度上升：间隙均值、特殊平台比例、窄平台比例', () => {
  const sample = (minM, maxM, seed) => {
    const w = createWorld({ seed });
    const targetPx = [minM, maxM].map((m) => w.startY - m * PHYS.PX_PER_M);
    let guard = 0;
    while (w.cameraY > targetPx[1] && guard++ < 200000) {
      w.cameraY -= 10;
      ensurePlatforms(w);
    }
    const plats = w.platforms.filter((p) => p.type !== 'ground');
    return plats.filter((p) => p.y >= targetPx[1] && p.y <= targetPx[0]);
  };

  const shallow = sample(0, 200, 5);
  const deep = sample(750, 950, 5);
  const avgGap = (list) => {
    const sorted = [...list].sort((a, b) => b.y - a.y);
    let sum = 0;
    for (let i = 1; i < sorted.length; i++) sum += sorted[i - 1].y - sorted[i].y;
    return sum / (sorted.length - 1);
  };
  const specialRatio = (list) => list.filter((p) => p.type !== 'normal').length / list.length;
  const narrowRatio = (list) => list.filter((p) => p.w <= 62).length / list.length;

  assert.ok(shallow.length > 10 && deep.length > 10);
  assert.ok(avgGap(deep) > avgGap(shallow) + 5, 'gaps widen with height');
  assert.ok(specialRatio(deep) > specialRatio(shallow), 'more specials deeper');
  assert.ok(narrowRatio(deep) > narrowRatio(shallow), 'narrower platforms deeper');
});
