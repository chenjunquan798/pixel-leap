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

// 结算页「差多少」文案用的差值；已破纪录时返回 0。
export function pointsToBest(score, best) {
  return Math.max(0, best - score + 1);
}
