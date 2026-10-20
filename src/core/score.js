// 计分规则（PRD 8.4）
// 高度分 = floor((起始 Y − 最高 Y) / 8)，只记最高点，下坠不扣分。
// 星星分 = 每颗 +10。总分 = 高度分 + 星星分。

import { PHYS } from './config.js';

export function heightPxFrom(startY, minY) {
  return Math.max(0, Math.round((startY - minY) * 1000) / 1000);
}

export function heightMeters(startY, minY) {
  return Math.floor(heightPxFrom(startY, minY) / PHYS.PX_PER_M);
}

export function computeScore(startY, minY, stars) {
  return Math.floor(heightPxFrom(startY, minY) / PHYS.PX_PER_M) + stars * 10;
}

export function isNewBest(score, best) {
  return score > best;
}

// 结算页「差多少破纪录」文案用的差值。
// PRD 6.2 的例子是 42 / 80 → 「差 38 分」，即 best - score；
// 同分时返回 1（再得 1 分才算破纪录），已破纪录返回 0。
export function pointsToBest(score, best) {
  const diff = best - score;
  if (diff > 0) return diff;
  return diff === 0 ? 1 : 0;
}
