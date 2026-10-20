// 本地事件账本（Plan B：不上报任何网络请求）。
// 只记录游戏过程的分桶数据，供玩家自己导出或内部研究使用。

const SESSION_GAP_MS = 30 * 60 * 1000;

export function createLedger(store) {
  let sessionId = 1;
  let lastAt = 0;

  function record(type, data = {}) {
    const now = Date.now();
    if (lastAt && now - lastAt > SESSION_GAP_MS) sessionId++;
    lastAt = now;
    const entry = {
      t: now,
      session: sessionId,
      type,
      ...bucketize(data),
    };
    store.pushLedger(entry);
    return entry;
  }

  function bucketize(data) {
    const out = { ...data };
    for (const key of Object.keys(out)) {
      const value = out[key];
      // 不写入任何可能的可识别信息：只保留数字与短枚举
      if (typeof value === 'string' && value.length > 40) out[key] = value.slice(0, 40);
      if (typeof value === 'string' && /[^\w.:\-|]/.test(value)) out[key] = 'other';
    }
    return out;
  }

  function summary() {
    const events = store.getState().ledger;
    const runs = events.filter((e) => e.type === 'run_end');
    const sessions = new Set(events.map((e) => e.session));
    const scores = runs.map((e) => e.score).filter((n) => typeof n === 'number');
    const shares = events.filter((e) => e.type === 'share_outcome');
    return {
      events: events.length,
      sessions: sessions.size,
      runs: runs.length,
      best: scores.length ? Math.max(...scores) : 0,
      avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      shares: shares.length,
    };
  }

  function exportJSON() {
    return JSON.stringify(
      { app: 'pixel-leap', plan: 'B', exportedAt: new Date().toISOString(), summary: summary(), events: store.getState().ledger },
      null,
      2
    );
  }

  return { record, summary, exportJSON };
}
