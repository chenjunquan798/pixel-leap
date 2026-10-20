// 区域视觉验证：把游戏推进到指定高度，截图夜幕 / 霞光层 / 深空三套天空。
// 用法：node tools/zones.mjs <url> <outDir> [--w=] [--h=]

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9343;
const [, , url, outDir = 'build/shots', ...rest] = process.argv;
const arg = (name, fallback) => {
  const found = rest.find((r) => r.startsWith(`--${name}=`));
  return found ? found.split('=')[1] : fallback;
};
const W = Number(arg('w', 390));
const H = Number(arg('h', 844));
const PREFIX = arg('prefix', 'zone');
const PROFILE = path.resolve('build/edge-profile-zones');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(PROFILE, { recursive: true });

const edge = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--hide-scrollbars',
    '--mute-audio',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--window-size=1400,1000',
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 60; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page) {
      ws = new WebSocket(page.webSocketDebuggerUrl);
      break;
    }
  } catch {
    /* retry */
  }
  await sleep(200);
}
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let id = 1;
const pending = new Map();
const errors = [];
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails.text);
  }
});
const send = (method, params = {}) => {
  const n = id++;
  ws.send(JSON.stringify({ id: n, method, params }));
  return new Promise((resolve, reject) => pending.set(n, { resolve, reject }));
};
const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description);
  return res.result.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url });
await sleep(1500);

await evaluate("document.getElementById('btn-start').click()");
await sleep(300);

const bot = (targetMeters) => `(() => {
  const w = window.PixelLeap.world;
  const G = 2300;
  for (let i = 0; i < 60 * 240; i++) {
    if (w.dead) return { dead: true, meters: w.stats.meters };
    if (w.stats.meters >= ${targetMeters}) break;
    const p = w.player;
    const apex = p.vy < 0 ? p.y - (p.vy * p.vy) / (2 * G) : p.y;
    let t = null;
    for (const q of w.platforms) {
      if (q.state === 'gone') continue;
      if (q.y <= apex + 1) continue;
      if (!t || q.y < t.y) t = q;
    }
    const err = t ? t.x + t.w / 2 - p.x : 0;
    w.input.left = err < -3;
    w.input.right = err > 3;
    w.step();
  }
  return { dead: false, meters: w.stats.meters, zone: w.zone };
})()`;

async function capture(name, target) {
  const res = await evaluate(bot(target));
  await evaluate("document.getElementById('btn-pause').click()");
  await sleep(320);
  // 隐藏暂停面板，只保留场景
  await evaluate(
    "document.getElementById('screen-pause').hidden = true; document.getElementById('hud').hidden = false;"
  );
  await sleep(200);
  const shotRes = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const file = path.join(outDir, `${PREFIX}-${name}.png`);
  fs.writeFileSync(file, Buffer.from(shotRes.data, 'base64'));
  await evaluate(
    "document.getElementById('screen-pause').hidden = false; document.getElementById('btn-resume').click();"
  );
  await sleep(200);
  return { file, ...res };
}

const result = [];
result.push(await capture('1-night', 120));
result.push(await capture('2-dusk', 300));
result.push(await capture('3-space', 620));

console.log(JSON.stringify({ result, errors }, null, 2));
ws.close();
edge.kill();
process.exit(0);
