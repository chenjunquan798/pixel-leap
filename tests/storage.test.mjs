import test from 'node:test';
import assert from 'node:assert/strict';

import { createStore, sanitizeState, DEFAULT_STATE } from '../src/platform/storage.js';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

test('正常读取最高分与静音设置', () => {
  const storage = fakeStorage({ 'pixelLeap.v2': JSON.stringify({ best: 230, muted: true, lang: 'en' }) });
  const store = createStore(storage);
  assert.equal(store.corrupted, false);
  assert.equal(store.getState().best, 230);
  assert.equal(store.getState().muted, true);
  assert.equal(store.getState().lang, 'en');
});

test('损坏的 JSON 会复位并标记 corrupted，而不是抛错', () => {
  const storage = fakeStorage({ 'pixelLeap.v2': '{"best": 230,' });
  const store = createStore(storage);
  assert.equal(store.corrupted, true);
  assert.equal(store.getState().best, 0);
  // 继续写入不会报错，且下一次读取干净
  assert.equal(store.setBest(50), 50);
  const again = createStore(storage);
  assert.equal(again.corrupted, false);
  assert.equal(again.getState().best, 50);
});

test('非法字段被重置而不是污染状态', () => {
  const res = sanitizeState({ best: -5, muted: 'yes', lang: 'fr', ledger: 'nope' });
  assert.equal(res.repaired, true);
  assert.equal(res.state.best, 0);
  assert.equal(res.state.muted, false);
  assert.equal(res.state.lang, 'zh');
  assert.deepEqual(res.state.ledger, []);
});

test('setBest 只增不减', () => {
  const store = createStore(fakeStorage());
  store.setBest(120);
  store.setBest(80);
  assert.equal(store.getState().best, 120);
});

test('localStorage 不可写时不阻断（隐私模式）', () => {
  const storage = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
    removeItem: () => {},
  };
  const store = createStore(storage);
  assert.equal(store.corrupted, true);
  assert.equal(store.getState().best, DEFAULT_STATE.best);
  assert.equal(store.setBest(10), 10); // 内存里仍然可用
  assert.equal(store.getState().best, 10);
});

test('本地账本最多保留 200 条', () => {
  const store = createStore(fakeStorage());
  for (let i = 0; i < 250; i++) store.pushLedger({ t: i, type: 'run_end', score: i });
  const ledger = store.getState().ledger;
  assert.equal(ledger.length, 200);
  assert.equal(ledger[ledger.length - 1].score, 249);
});
