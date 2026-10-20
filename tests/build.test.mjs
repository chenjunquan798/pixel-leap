import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const exists = fs.existsSync(INDEX);

test('构建产物存在', () => {
  assert.ok(exists, '先运行 `node build.mjs` 生成 index.html');
});

const html = exists ? fs.readFileSync(INDEX, 'utf8') : '';
// 只取无属性的 <script>（游戏 bundle），不要匹配 JSON-LD 的 <script type=...>
const scriptMatch = html.match(/<script>\r?\n([\s\S]*?)\r?\n<\/script>/);
const script = scriptMatch ? scriptMatch[1] : '';
const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';

// PRD 11.6 的 80KB 按十进制字节理解（PRD 自己的 57KB 基线 = 57,044 B）
const BUDGET = 80000;

test('包体在预算内（PRD 11.2：首屏 JS ≤80KB，整包 ≤80KB）', () => {
  const jsBytes = Buffer.byteLength(script, 'utf8');
  const totalBytes = Buffer.byteLength(html, 'utf8');
  assert.ok(jsBytes <= BUDGET, `inline JS ${jsBytes} B exceeds ${BUDGET} B`);
  assert.ok(totalBytes <= BUDGET, `index.html ${totalBytes} B exceeds the ${BUDGET} B budget`);
});

test('配色对比度达到 WCAG AA（A11Y-03）', () => {
  const rgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = (hex) => {
    const [r, g, b] = rgb(hex);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const contrast = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const over = (fg, bg, alpha) => {
    const a = rgb(fg);
    const b = rgb(bg);
    const mix = a.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)));
    return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  };

  // 主 CTA：白字压在渐变的两端
  assert.ok(contrast('#ffffff', '#cc3a5c') >= 4.5, 'CTA gradient top');
  assert.ok(contrast('#ffffff', '#a8244a') >= 4.5, 'CTA gradient bottom');
  // tagline：68% cream 压在面板底色上
  assert.ok(contrast(over('#fff3d6', '#14101f', 0.68), '#14101f') >= 4.5, 'tagline');
  // HUD 主文字与深色天空
  assert.ok(contrast('#fff3d6', '#17101f') >= 4.5, 'HUD cream on ink');
});

test('内联脚本语法有效', () => {
  assert.doesNotThrow(() => new Function(script), 'bundle should compile');
  assert.ok(!script.includes('</script'), 'script must not contain a closing tag');
});

test('零第三方请求：没有外部脚本、样式、字体', () => {
  assert.ok(!/<script[^>]+src=/i.test(html), 'no external scripts');
  assert.ok(!/<link[^>]+rel=["']stylesheet/i.test(html), 'no external stylesheets');
  assert.ok(!/@import/i.test(css), 'no css @import');
  assert.ok(!/fonts\.(googleapis|gstatic)/i.test(html), 'no web fonts');
  // 页面里出现的 http(s) 只允许是 canonical / OG / sitemap 这类元数据
  const urls = [...html.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) => m[0]);
  const allowed = (u) =>
    u.startsWith('https://chenjunquan798.github.io/') ||
    u.startsWith('https://schema.org') ||
    u.startsWith('http://www.w3.org/');
  const offenders = urls.filter((u) => !allowed(u));
  assert.deepEqual(offenders, [], `unexpected external urls: ${offenders.join(', ')}`);
});

test('SEO / 社交元数据齐全', () => {
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<title>[^<]*像素跳跳乐[^<]*<\/title>/);
  assert.match(html, /name="description" content="[^"]{20,}"/);
  assert.match(html, /rel="canonical" href="https:\/\/chenjunquan798\.github\.io\/pixel-leap\/"/);
  assert.match(html, /property="og:image" content="[^"]+og-image\.png"/);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /property="og:image:height" content="630"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /"@type":"VideoGame"/);
  assert.match(script, /manifest\.webmanifest/, 'manifest is wired at runtime');
  assert.match(script, /serviceWorker/);
  assert.match(html, /name="viewport" content="[^"]*width=device-width/);
});

test('无障碍骨架：aria-live、真实按钮、可见焦点样式', () => {
  assert.match(html, /id="live"[^>]*aria-live="polite"/);
  assert.match(html, /aria-atomic="true"/);
  assert.match(css, /:focus-visible/);
  // 所有 <button> 都要有 type，避免表单默认行为
  const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(buttons.length >= 10, `expected several buttons, got ${buttons.length}`);
  for (const b of buttons) assert.match(b, /type="(button|submit)"/, `missing type: ${b}`);
  // 主 CTA 与暂停键必须存在
  assert.match(html, /id="btn-start"/);
  assert.match(html, /id="btn-pause"/);
  assert.match(html, /id="share"[^>]*hidden|id="btn-share"[^>]*hidden/);
});

test('关键文案与 PRD 9.5 / 10.2 一致', () => {
  const required = [
    '开始跳跃',
    '再来一次',
    '新纪录！',
    '喘口气，星星不会跑。',
    '游戏开始。左右移动，踩住平台。',
    '游戏已暂停。按继续或 P 恢复。',
    '本局结束，得分',
    '游戏加载失败，请刷新重试。',
    '音频不可用，游戏继续。',
    '本地存档损坏，最高分已重置。',
  ];
  for (const text of required) {
    assert.ok(html.includes(text), `missing copy: ${text}`);
  }
});

test('不引入第三方框架痕迹', () => {
  assert.ok(!/react|vue|angular|jquery|three\.js/i.test(script), 'bundle should be hand-written');
});

test('静态资源存在且体积合理', () => {
  const assets = [
    'assets/og-image.png',
    'assets/icon-192.png',
    'assets/icon-512.png',
    'manifest.webmanifest',
    'sw.js',
    'robots.txt',
    'sitemap.xml',
    'privacy.html',
  ];
  for (const rel of assets) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `missing ${rel}`);
  }
  const og = fs.statSync(path.join(ROOT, 'assets/og-image.png'));
  assert.ok(og.size <= 150 * 1024, `og image ${(og.size / 1024).toFixed(1)}KB over 150KB`);
});
