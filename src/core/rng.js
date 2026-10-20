// 确定性随机数：mulberry32。
// 同一个 seed 必然生成同一套平台，这也是「每日挑战 / 回放 / 测试」的基础。

export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rangeFrom(rng, [min, max]) {
  return min + (max - min) * rng();
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}
