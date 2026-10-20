// 零依赖构建：把 src/ 的 ES 模块与样式压成一个自包含的 index.html。
// 交付物没有运行时依赖、没有第三方请求；源码保持模块化便于维护（PRD 15 风险：单文件维护失控）。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// 依赖顺序（先被依赖的在前）
// 动态分享卡是 P1：默认构建不包含它，以满足 PRD 11.6 的 80KB 硬上限；
// 需要更丰富的分享图时用 `node build.mjs --with-card`。
const WITH_CARD = process.argv.includes('--with-card');

const ORDER = [
  'src/core/config.js',
  'src/core/rng.js',
  'src/core/score.js',
  'src/core/world.js',
  'src/core/bot.js',
  'src/render/palette.js',
  'src/render/background.js',
  'src/render/sprites.js',
  'src/render/renderer.js',
  'src/platform/storage.js',
  'src/platform/audio.js',
  'src/platform/ledger.js',
  'src/ui/i18n.js',
  ...(WITH_CARD ? ['src/ui/sharecard.js'] : []),
  'src/platform/share.js',
  'src/ui/ui.js',
  'src/main.js',
];

function stripModule(src) {
  const names = [];
  let body = src;
  // 单行与多行 import 都要去掉
  body = body.replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?[ \t]*\r?\n/gm, '');
  body = body.replace(/^import\s+['"][^'"]+['"];?[ \t]*\r?\n/gm, '');
  body = body.replace(
    /^export\s+(async\s+)?(function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm,
    (_m, a, kind, name) => {
      names.push(name);
      return `${a || ''}${kind} ${name}`;
    }
  );
  if (/^\s*export\s/m.test(body)) {
    throw new Error('Unsupported export form; use `export function|const|let|class`');
  }
  if (/^import\s/m.test(body)) {
    throw new Error('Unresolved import remains after stripping');
  }
  return { body, names };
}

// 只去掉缩进、空行与纯注释行 —— 不会影响 ASI 或字符串
function compact(src) {
  return src
    .split('\n')
    .map((line) => line.replace(/^[ \t]+/, ''))
    .filter((line) => line.trim() && !line.trim().startsWith('//'))
    .join('\n');
}

// 保守的空白压缩：字符串 / 模板 / 注释之外的连续空白压成一个空格，
// 并去掉标点两侧的空格；保留换行以保证 ASI 语义不变。
const PUNCT = '{}()[];,.:<>?=+-*/%&|^!~';
function minifyCode(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      out += ch;
      i++;
      while (i < n) {
        const c = src[i];
        out += c;
        if (c === '\\') {
          out += src[i + 1] || '';
          i += 2;
          continue;
        }
        i++;
        if (c === quote) break;
      }
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      while (i < n && /\s/.test(src[i])) i++;
      const prev = out[out.length - 1] || '';
      const next = src[i] || '';
      const tight = PUNCT.includes(prev) || PUNCT.includes(next);
      // 只在「单词与单词」之间保留一个空格；源文件语句都以分号/大括号收尾
      if (!tight && prev !== '' && next !== '') out += ' ';
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

// CSS：去注释、去多余空白；不触碰值内部的空格
function minifyCss(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('')
    .replace(/\s*([{};])\s*/g, '$1')
    .replace(/:\s+/g, ':')
    .replace(/\s*,\s*/g, ',');
}

const used = new Set();
const chunks = [];
ORDER.forEach((rel, i) => {
  const { body, names } = stripModule(read(rel));
  for (const name of names) {
    if (used.has(name)) throw new Error(`Duplicate top-level export: ${name} (${rel})`);
    used.add(name);
  }
  const id = `__pl_m${i}`;
  chunks.push(`/*${rel.replace('src/', '')}*/`);
  chunks.push(`const ${id}=(function(){`);
  chunks.push(minifyCode(body));
  if (names.length) chunks.push(`return{${names.join(',')}};`);
  chunks.push('})();');
  if (names.length) chunks.push(`const{${names.join(',')}}=${id};`);
});

const js = chunks.join('\n');
const css = minifyCss(read('styles.css'));
const template = read('src/index.template.html');

const html = template
  .replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => js);

const out = path.join(root, 'index.html');
fs.writeFileSync(out, html, 'utf8');

const bytes = Buffer.byteLength(html, 'utf8');
const kb = (bytes / 1024).toFixed(1);
console.log(`built index.html  ${bytes} bytes  (${kb} KB)`);
if (bytes > 80 * 1024) {
  console.log(`WARNING: bundle exceeds the 80 KB budget (${kb} KB)`);
}
