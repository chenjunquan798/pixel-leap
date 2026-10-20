import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorld, ensurePlatforms } from '../src/core/world.js';
import { PHYS, CRUMBLE_DELAY, STEP } from '../src/core/config.js';

function bare() {
  const w = createWorld({ seed: 5 });
  w.platforms = w.platforms.filter((p) => p.type === 'ground');
  w.stars.length = 0;
  return w;
}

function addPlatform(w, props) {
  const plat = {
    id: 900 + w.platforms.length,
    x: 200,
    y: 400,
    w: 80,
    h: PHYS.PLATFORM_H,
    type: 'normal',
    state: 'solid',
    timer: 0,
    spring: false,
    springUsed: false,
    amp: 0,
    omega: 0,
    phase: 0,
    cx: 240,
    ...props,
  };
  w.platforms.push(plat);
  return plat;
}

test('星星只计一次：+10 且不会重复收集', () => {
  const w = bare();
  const p = w.player;
  p.y = 500;
  p.prevY = 500;
  p.vy = -100;
  w.stars.push({ id: 1, x: p.x, y: p.y - p.h / 2, taken: false, phase: 0 });
  w.step();
  assert.equal(w.stats.stars, 1, 'star collected');
  assert.ok(w.events.some((e) => e.type === 'star'));
  const scoreAfter = w.stats.score;
  for (let i = 0; i < 10; i++) w.step();
  assert.equal(w.stats.stars, 1, 'must not re-collect the same star');
  assert.ok(w.stats.score >= scoreAfter);
});

test('弹簧：一次性高弹，之后回到普通弹跳', () => {
  const w = bare();
  addPlatform(w, { y: 400, spring: true });
  const p = w.player;
  p.x = 240;
  p.y = 380;
  p.prevY = 380;
  p.vy = 260;
  for (let i = 0; i < 4; i++) w.step();
  assert.equal(p.vy, -PHYS.SPRING_VY, 'first spring bounce is high');
  assert.ok(w.events.some((e) => e.type === 'spring'));

  // 落地后弹簧已被用掉：再落一次是普通弹跳
  const plat = w.platforms.find((q) => q.spring);
  assert.equal(plat.springUsed, true);
  p.y = 380;
  p.prevY = 380;
  p.vy = 260;
  for (let i = 0; i < 4; i++) w.step();
  assert.equal(p.vy, -PHYS.JUMP_VY, 'second bounce is a normal one');
});

test('碎裂平台：先弹一次，0.28s 后消失，不再可站立', () => {
  const w = bare();
  const plat = addPlatform(w, { y: 400, type: 'crumble' });
  const p = w.player;
  p.x = 240;
  p.y = 380;
  p.prevY = 380;
  p.vy = 260;
  const events = [];
  let minVy = 0;
  for (let i = 0; i < 6; i++) {
    w.step();
    events.push(...w.events);
    minVy = Math.min(minVy, p.vy);
  }
  assert.equal(plat.state, 'shaking');
  assert.ok(events.some((e) => e.type === 'crack'), 'crack event fired');
  assert.ok(Math.abs(minVy + PHYS.JUMP_VY) < 1, 'still bounces once');

  for (let i = 0; i < Math.ceil(CRUMBLE_DELAY / STEP) + 2; i++) w.step();
  assert.equal(plat.state, 'gone');
});

test('移动平台往返且不越界；踩上去仍是普通弹跳', () => {
  const w = bare();
  const plat = addPlatform(w, { y: 400, type: 'moving', amp: 40, omega: 1.2, cx: 240 });
  const xs = [];
  // 跑满一个完整往返周期（ω=1.2 → ≈5.2s）
  for (let i = 0; i < 400; i++) {
    w.step();
    xs.push(plat.x);
    assert.ok(plat.x >= 0 && plat.x + plat.w <= 480, 'stays inside the stage');
  }
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  assert.ok(max - min > 40, `actually moves (range ${Math.round(max - min)})`);

  const p = w.player;
  p.x = plat.x + plat.w / 2;
  p.y = plat.y - 20;
  p.prevY = p.y;
  p.vy = 260;
  let bounced = false;
  for (let i = 0; i < 8; i++) {
    w.step();
    if (p.vy < -900) bounced = true;
  }
  assert.ok(bounced, 'landing on a moving platform bounces normally');
});

test('越过 200m / 500m 各触发一次区域事件与里程碑', () => {
  const w = bare();
  const moveTo = (meters) => {
    const y = w.startY - meters * PHYS.PX_PER_M;
    w.player.y = y;
    w.player.prevY = y;
    w.player.vy = -1;
    w.cameraY = y - 300;
    w.step();
  };

  moveTo(120);
  assert.equal(w.events.some((e) => e.type === 'zone'), false, 'no zone change yet');
  moveTo(205);
  const zoneEvt = w.events.find((e) => e.type === 'zone');
  assert.ok(zoneEvt, 'zone event fired');
  assert.equal(zoneEvt.zone, 1);
  assert.ok(w.events.some((e) => e.type === 'milestone' && e.meters === 200));
  moveTo(230);
  assert.equal(w.events.some((e) => e.type === 'milestone' && e.meters === 200), false, 'once only');

  moveTo(510);
  assert.ok(w.events.some((e) => e.type === 'zone' && e.zone === 2));
  assert.ok(w.events.some((e) => e.type === 'milestone' && e.meters === 500));
});

test('吃掉多颗星星后仍然继续生成新星星（回归：星星配额被已吃掉的星星卡死）', () => {
  const w = createWorld({ seed: 31 });
  let guard = 0;
  while (w.stars.length < 7 && guard++ < 600) {
    w.cameraY -= 60;
    ensurePlatforms(w);
  }
  assert.ok(w.stars.length >= 7, `star pool should fill, got ${w.stars.length}`);

  // 全部吃掉，模拟连续收集
  for (const star of w.stars) star.taken = true;
  w.step(); // cleanup 回收已吃掉的星星

  w.cameraY -= 900;
  ensurePlatforms(w);
  const live = w.stars.filter((s) => !s.taken).length;
  assert.ok(live > 0, 'new stars must keep spawning after all previous ones were collected');
});

test('死亡后继续调用 step 不会重复触发 dead 事件或改变统计', () => {
  const w = bare();
  w.player.y = w.cameraY + 720 + PHYS.DEATH_MARGIN + 30;
  w.player.prevY = w.player.y - 10;
  w.player.vy = 1200;
  w.step();
  assert.ok(w.dead);
  const score = w.stats.score;
  const meters = w.stats.meters;

  w.events.length = 0;
  for (let i = 0; i < 5; i++) w.step();
  assert.equal(w.events.filter((e) => e.type === 'dead').length, 0);
  assert.equal(w.stats.score, score);
  assert.equal(w.stats.meters, meters);
});

test('坠落结算事件携带本局统计', () => {
  const w = bare();
  w.player.y = w.cameraY + 720 + PHYS.DEATH_MARGIN + 30;
  w.player.prevY = w.player.y - 10;
  w.player.vy = 1200;
  w.step();
  const dead = w.events.find((e) => e.type === 'dead');
  assert.ok(dead);
  assert.equal(typeof dead.score, 'number');
  assert.equal(typeof dead.meters, 'number');
  assert.equal(typeof dead.duration, 'number');
});
