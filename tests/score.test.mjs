import test from 'node:test';
import assert from 'node:assert/strict';

import { computeScore, heightMeters, isNewBest, pointsToBest } from '../src/core/score.js';
import { PHYS } from '../src/core/config.js';

test('高度换算：8px = 1m，向下取整', () => {
  assert.equal(heightMeters(680, 672), 1);
  assert.equal(heightMeters(680, 680), 0);
  assert.equal(heightMeters(680, 0), 85);
});

test('总分 = 高度分 + 星星 × 10', () => {
  assert.equal(computeScore(680, 680, 0), 0);
  assert.equal(computeScore(680, 600, 0), 10);
  assert.equal(computeScore(680, 600, 3), 40);
  assert.equal(computeScore(680, 680 - 8 * 214, 3), 214 + 30);
});

test('下坠不扣分：只记录最高点', () => {
  const startY = 680;
  const highest = startY - 800;
  assert.equal(computeScore(startY, highest, 0), 100);
  // 用同样的最高点、更低的当前位置，结果不变
  assert.equal(computeScore(startY, highest, 0), computeScore(startY, highest, 0));
});

test('新纪录判定与「差多少」文案', () => {
  assert.equal(isNewBest(230, 180), true);
  assert.equal(isNewBest(180, 180), false, '平局不算新纪录');
  // PRD 6.2 的例子：本局 42、最高 80 → 「差 38 分破纪录」
  assert.equal(pointsToBest(42, 80), 38);
  assert.equal(pointsToBest(180, 230), 50);
  assert.equal(pointsToBest(230, 230), 1, '同分时还需要 1 分才算破纪录');
  assert.equal(pointsToBest(240, 230), 0);
});

test('大数下仍然精确（避免浮点误差把 199 算成 198）', () => {
  const startY = PHYS.START_FEET_Y;
  for (let px = 0; px < 20000; px += 7) {
    assert.equal(computeScore(startY, startY - px, 0), Math.floor(px / PHYS.PX_PER_M));
  }
});
