// 本地存储：只保存游戏偏好与最高分（PRD 12.2）。
// 解析失败、隐私模式、写入失败都不能阻断游戏。

const KEY = 'pixelLeap.v2';

export const DEFAULT_STATE = {
  v: 2,
  best: 0,
  muted: false,
  lang: 'zh',
  runs: 0,
  starsTotal: 0,
  lastPlayed: 0,
  ledger: [],
};

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

export function sanitizeState(raw) {
  const out = { ...DEFAULT_STATE };
  if (!raw || typeof raw !== 'object') return { state: out, repaired: true };
  let repaired = false;
  if (isFiniteNumber(raw.best) && raw.best >= 0 && raw.best < 1e9) out.best = Math.floor(raw.best);
  else if (raw.best !== undefined) repaired = true;
  if (typeof raw.muted === 'boolean') out.muted = raw.muted;
  else if (raw.muted !== undefined) repaired = true;
  if (raw.lang === 'zh' || raw.lang === 'en') out.lang = raw.lang;
  else if (raw.lang !== undefined) repaired = true;
  if (isFiniteNumber(raw.runs)) out.runs = Math.max(0, Math.floor(raw.runs));
  if (isFiniteNumber(raw.starsTotal)) out.starsTotal = Math.max(0, Math.floor(raw.starsTotal));
  if (isFiniteNumber(raw.lastPlayed)) out.lastPlayed = raw.lastPlayed;
  if (Array.isArray(raw.ledger)) out.ledger = raw.ledger.slice(-200);
  return { state: out, repaired };
}

export function createStore(storage) {
  let backend = storage;
  let state = { ...DEFAULT_STATE };
  let corrupted = false;

  try {
    const raw = backend.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const res = sanitizeState(parsed);
      state = res.state;
      corrupted = res.repaired;
    }
  } catch {
    corrupted = true;
    state = { ...DEFAULT_STATE };
  }

  function persist() {
    try {
      backend.setItem(KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  return {
    corrupted,
    getState: () => state,
    set(patch) {
      state = { ...state, ...patch };
      return persist();
    },
    setBest(best) {
      if (best > state.best) state.best = best;
      persist();
      return state.best;
    },
    pushLedger(entry) {
      state.ledger = [...state.ledger, entry].slice(-200);
      persist();
    },
    clear() {
      state = { ...DEFAULT_STATE };
      try {
        backend.removeItem(KEY);
      } catch {
        /* ignore */
      }
    },
  };
}

// 浏览器环境下取一个可用的 storage；失败时返回内存实现（隐私模式）。
export function safeStorage() {
  try {
    const probe = '__pl_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const mem = new Map();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    };
  }
}
