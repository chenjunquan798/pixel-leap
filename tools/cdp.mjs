// 轻量 CDP 工具：用 Edge 的无头实例做真实渲染验证。
// 用法：node tools/cdp.mjs <url> <outDir> [--w=480] [--h=720]
// 会加载页面、检查 console 错误、点击开始、截图，并输出状态 JSON。

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333 + (Number(process.env.CDP_SLOT) || 0);

const [, , url, outDir = 'build/shots', ...rest] = process.argv;
const arg = (name, fallback) => {
  const found = rest.find((r) => r.startsWith(`--${name}=`));
  return found ? found.split('=')[1] : fallback;
};
const W = Number(arg('w', 480));
const H = Number(arg('h', 720));
const PREFIX = arg('prefix', 'shot');
const PROFILE = path.resolve('build/edge-profile');

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(PROFILE, { recursive: true });

const edge = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
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

async function getWsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  throw new Error('CDP endpoint never came up');
}

const wsUrl = await getWsUrl();
const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const consoleErrors = [];
const pageErrors = [];

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
    return;
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const type = msg.params.type;
    if (type === 'error' || type === 'warning') {
      consoleErrors.push(
        `${type}: ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`
      );
    }
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    pageErrors.push(
      msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text
    );
  }
  if (msg.method === 'Log.entryAdded') {
    const e = msg.params.entry;
    if (e.level === 'error') consoleErrors.push(`log: ${e.text} ${e.url || ''}`);
  }
});

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description || 'evaluate failed');
  }
  return res.result.value;
}

async function shot(name) {
  const res = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const file = path.join(outDir, `${PREFIX}-${name}.png`);
  fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
  return file;
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: W,
  height: H,
  deviceScaleFactor: 1,
  mobile: W < 700,
});
if (W < 700) {
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
}
await send('Page.navigate', { url });
await sleep(1200);
await evaluate('localStorage.clear()');
await send('Page.reload');
await sleep(1500);

const report = { url, viewport: `${W}x${H}`, consoleErrors, pageErrors, steps: [] };

report.steps.push({ name: 'menu', state: await evaluate('window.PixelLeap && window.PixelLeap.state') });
report.screens = [await shot('1-menu')];

// Tab 顺序：从 body 开始连按 Tab，记录焦点落点（PRD A11Y-01）
report.tabOrder = [];
await evaluate("document.activeElement && document.activeElement.blur(); document.body.focus();");
for (let i = 0; i < 6; i++) {
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await sleep(60);
  report.tabOrder.push(await evaluate('document.activeElement && document.activeElement.id'));
}

// 开始游戏
await evaluate("document.getElementById('btn-start').click()");
await sleep(900);
report.steps.push({ name: 'playing', state: await evaluate('window.PixelLeap && window.PixelLeap.state') });
report.screens.push(await shot('2-playing'));

// 按住右方向键 1.2 秒
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
await sleep(1200);
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
report.steps.push({ name: 'after-input', state: await evaluate('window.PixelLeap && window.PixelLeap.state') });
report.screens.push(await shot('3-playing-input'));

// 暂停
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'p', code: 'KeyP', windowsVirtualKeyCode: 80 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'p', code: 'KeyP', windowsVirtualKeyCode: 80 });
await sleep(400);
report.steps.push({ name: 'paused', state: await evaluate('window.PixelLeap && window.PixelLeap.state') });
report.screens.push(await shot('4-paused'));

// 继续
await evaluate("document.getElementById('btn-resume').click()");
await sleep(300);

// 直接结算：把角色丢到屏幕外
await evaluate(`(() => { const w = window.PixelLeap.world; w.player.y = w.cameraY + 1200; w.player.prevY = w.player.y - 20; w.player.vy = 900; return 'dropped'; })()`);
await sleep(700);
report.steps.push({ name: 'over', state: await evaluate('window.PixelLeap && window.PixelLeap.state') });
report.screens.push(await shot('5-over'));

report.hud = await evaluate(`({
  score: document.getElementById('hud-score').textContent,
  height: document.getElementById('hud-height').textContent,
  stars: document.getElementById('hud-star-count').textContent,
  overScore: document.getElementById('over-score').textContent,
  overDiff: document.getElementById('over-diff').textContent,
  shareHidden: document.getElementById('btn-share').hidden,
  live: document.getElementById('live').textContent,
  mode: window.PixelLeap.state.mode,
  touchVisible: !document.getElementById('touch').hidden,
  touchPadDisplay: getComputedStyle(document.getElementById('touch')).display,
  maxTouchPoints: navigator.maxTouchPoints,
  hasTouchStart: 'ontouchstart' in window,
  coarse: matchMedia('(pointer: coarse)').matches,
  bodyClass: document.body.className
})`);

report.focus = await evaluate('document.activeElement && document.activeElement.id');

// 分享：模拟「用户在系统面板点了取消」，必须走复制兜底并给出 toast
report.share = await evaluate(`(async () => {
  const btn = document.getElementById('btn-share');
  const info = {
    hasShare: typeof navigator.share === 'function',
    hasClipboard: !!(navigator.clipboard && navigator.clipboard.writeText),
    hidden: btn.hidden
  };
  // 让 Web Share 直接以 AbortError 结束，等价于用户取消
  try {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: () => Promise.reject(Object.assign(new Error('cancel'), { name: 'AbortError' }))
    });
  } catch (e) { info.stubError = String(e); }
  btn.click();
  await new Promise((r) => setTimeout(r, 2000));
  return {
    ...info,
    toast: document.getElementById('toast').textContent,
    toastHidden: document.getElementById('toast').hidden,
    disabledAfter: btn.disabled,
    ledger: window.PixelLeap.summary(),
    events: JSON.parse(window.PixelLeap.exportLedger()).events.filter((e) => String(e.type).startsWith('share'))
  };
})()`);
report.screens.push(await shot('6-share-toast'));

// 语言切换
await evaluate("document.getElementById('btn-lang').click()");
await sleep(300);
report.i18n = await evaluate(`({
  lang: document.documentElement.lang,
  title: document.title,
  start: document.getElementById('btn-start').textContent,
  retry: document.getElementById('btn-retry').textContent,
  mute: document.getElementById('btn-mute').getAttribute('aria-label')
})`);
report.screens.push(await shot('7-english'));

report.errors = { consoleErrors, pageErrors };

// 减弱动效：重新加载，确认动画关闭时依然能进菜单、不报错
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});
await send('Page.reload');
await sleep(1400);
report.reduced = await evaluate(`({
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  mode: window.PixelLeap.state.mode,
  attractY: Math.round(window.PixelLeap.attract.player.y),
  vy: Math.round(window.PixelLeap.attract.player.vy)
})`);
report.screens.push(await shot('8-reduced'));

// 键盘全流程：空格开始 → P 暂停 → Esc 继续（PRD FR-02 / FR-10）
const key = async (k, code, vk) => {
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
  await sleep(260);
};
await evaluate('document.activeElement && document.activeElement.blur();');
await key(' ', 'Space', 32);
const k1 = await evaluate('window.PixelLeap.state.mode');
await key('p', 'KeyP', 80);
const k2 = await evaluate('window.PixelLeap.state.mode');
await key('Escape', 'Escape', 27);
const k3 = await evaluate('window.PixelLeap.state.mode');
report.keyboard = { afterSpace: k1, afterP: k2, afterEscape: k3 };

console.log(JSON.stringify(report, null, 2));

ws.close();
edge.kill();
process.exit(0);
