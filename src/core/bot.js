// 机器人：瞄准「顶点下方最高的平台」。
// 用于两条路径：菜单页的自动演示、以及 Node 里的 300 秒爬升测试（PRD 8.6）。

import { PHYS } from './config.js';

export function robotDirection(world) {
  const p = world.player;
  const apex = p.vy < 0 ? p.y - (p.vy * p.vy) / (2 * PHYS.GRAVITY) : p.y;
  let target = null;
  for (const plat of world.platforms) {
    if (plat.state === 'gone') continue;
    if (plat.y <= apex + 1) continue;
    if (!target || plat.y < target.y) target = plat;
  }
  if (!target) return 0;
  const err = target.x + target.w / 2 - p.x;
  if (Math.abs(err) < 3) return 0;
  return Math.sign(err);
}

export function robotStep(world) {
  const dir = robotDirection(world);
  world.input.left = dir < 0;
  world.input.right = dir > 0;
  world.step();
}
