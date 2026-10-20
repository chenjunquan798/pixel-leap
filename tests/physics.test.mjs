import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorld } from '../src/core/world.js';
import { PHYS, JUMP_HEIGHT } from '../src/core/config.js';

function flatWorld() {
  const w = createWorld({ seed: 7 });
  // 清掉自动生成的平台，只留地面，方便做纯物理断言
  w.platforms = w.platforms.filter((p) => p.type === 'ground');
  return w;
}

test('跳跃高度落在 190–205 px（PRD 8.2：约 196 px）', () => {
  const w = flatWorld();
  const p = w.player;
  p.y = 400;
  p.prevY = 400;
  p.vy = -PHYS.JUMP_VY;
  let peak = p.y;
  for (let i = 0; i < 120; i++) {
    w.step();
    peak = Math.min(peak, p.y);
  }
  const height = 400 - peak;
  assert.ok(height >= 190 && height <= 205, `jump height was ${height.toFixed(2)}`);
  assert.ok(Math.abs(JUMP_HEIGHT - 196.2) < 0.5);
});

test('1500 px/s 下落不会穿透 12px 厚的平台', () => {
  const w = flatWorld();
  const p = w.player;
  const plat = {
    id: 999,
    x: 220,
    y: 300,
    w: 80,
    h: 12,
    type: 'normal',
    state: 'solid',
    timer: 0,
    spring: false,
    springUsed: false,
    amp: 0,
    omega: 0,
    phase: 0,
    cx: 260,
  };
  w.platforms.push(plat);
  p.x = 260;
  p.y = 270;
  p.prevY = 270;
  p.vy = 1500;
  for (let i = 0; i < 2; i++) w.step();
  assert.equal(p.y, 300, 'should snap to platform top');
  assert.equal(p.vy, -PHYS.JUMP_VY, 'should bounce');
});

test('平台边缘 9px 容错：轻微擦边仍能落地', () => {
  const w = flatWorld();
  const plat = {
    id: 1000,
    x: 100,
    y: 300,
    w: 80,
    h: 12,
    type: 'normal',
    state: 'solid',
    timer: 0,
    spring: false,
    springUsed: false,
    amp: 0,
    omega: 0,
    phase: 0,
    cx: 140,
  };
  w.platforms.push(plat);
  const p = w.player;
  p.x = 180 + 5 + 13; // 脚底只与平台重叠 5px
  p.y = 280;
  p.prevY = 280;
  p.vy = 300;
  let bounced = false;
  for (let i = 0; i < 14; i++) {
    w.step();
    if (p.vy < -900) bounced = true;
  }
  assert.ok(bounced, 'expected bounce on tolerance edge');

  // 超出容错 20px 应当直接穿过
  const w2 = flatWorld();
  w2.platforms.push({ ...plat, id: 1001 });
  const p2 = w2.player;
  p2.x = 180 + 20 + 13;
  p2.y = 280;
  p2.prevY = 280;
  p2.vy = 300;
  let bounced2 = false;
  for (let i = 0; i < 14; i++) {
    w2.step();
    if (p2.vy < -900) bounced2 = true;
  }
  assert.ok(!bounced2, 'should keep falling when outside tolerance');
});

test('从下方穿过平台不会被判定落地', () => {
  const w = flatWorld();
  w.platforms.push({
    id: 1002,
    x: 180,
    y: 300,
    w: 100,
    h: 12,
    type: 'normal',
    state: 'solid',
    timer: 0,
    spring: false,
    springUsed: false,
    amp: 0,
    omega: 0,
    phase: 0,
    cx: 230,
  });
  const p = w.player;
  p.x = 230;
  p.y = 330;
  p.prevY = 330;
  p.vy = -900;
  w.step();
  assert.ok(p.vy < 0, 'still moving up');
  assert.ok(p.y < 330, 'passed through the platform');
});

test('松手后水平速度归零，且不会粘滞', () => {
  const w = flatWorld();
  w.input.right = true;
  for (let i = 0; i < 20; i++) w.step();
  assert.ok(w.player.vx > 0);
  w.input.right = false;
  for (let i = 0; i < 20; i++) w.step();
  assert.equal(w.player.vx, 0);
});

test('同时按左右会互相抵消并停止', () => {
  const w = flatWorld();
  w.input.left = true;
  w.input.right = true;
  const x0 = w.player.x;
  for (let i = 0; i < 30; i++) w.step();
  assert.ok(Math.abs(w.player.x - x0) < 1e-6, 'x should not drift');
});

test('第一次起跳后镜头才会跟随，且只向上', () => {
  const w = createWorld({ seed: 3 });
  const camStart = w.cameraY;
  for (let i = 0; i < 10; i++) w.step();
  assert.equal(w.cameraY, camStart, 'camera stays put near the ground');
  // 直接把角色抬到高位，镜头应当只上不下
  w.player.y = 100;
  w.step();
  const camUp = w.cameraY;
  assert.ok(camUp < camStart);
  w.player.y = 690;
  w.step();
  assert.equal(w.cameraY, camUp, 'camera never scrolls down');
});

test('跌出屏幕底部 +110px 判定死亡', () => {
  const w = flatWorld();
  w.player.y = w.cameraY + 720 + PHYS.DEATH_MARGIN + 60;
  w.player.prevY = w.player.y - 10;
  w.player.vy = 900;
  w.step();
  assert.equal(w.dead, true);
  assert.ok(w.events.some((e) => e.type === 'dead'));
});
