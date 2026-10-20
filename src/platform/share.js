// 分享回路（PRD 6.4 / FR-14）：
// 只有新纪录才出现分享；Web Share → 复制链接兜底；任何非成功结果都必须有可见反馈。

import { renderShareCard, canvasToBlob } from '../ui/sharecard.js';

const CANONICAL = 'https://chenjunquan798.github.io/pixel-leap/';

export function shareLink() {
  try {
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      const path = location.pathname.replace(/index\.html$/, '');
      return `${location.origin}${path}?ref=share`;
    }
  } catch {
    /* ignore */
  }
  return `${CANONICAL}?ref=share`;
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      // headless / 无权限时 writeText 可能永不 resolve：最多等 700ms 就走兜底
      const ok = await Promise.race([
        navigator.clipboard.writeText(text).then(() => true, () => false),
        new Promise((resolve) => setTimeout(() => resolve('timeout'), 700)),
      ]);
      if (ok === true) return true;
    }
  } catch {
    /* 继续走兜底 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-100px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function createShare({ t, ledger, onToast }) {
  async function share(data) {
    const text = t('share.text', { meters: data.meters, score: data.score });
    const url = shareLink();
    const payload = `${text} ${url}`;

    let file = null;
    /*#card*/
    // 动态分享卡是 P1，默认构建会把这一段整体剔除（PRD 11.6 包体门禁）；
    // 只有 `node build.mjs --with-card` 才会包含 src/ui/sharecard.js 与这段代码。
    if (typeof renderShareCard === 'function') {
      try {
        const canvas = renderShareCard({
          score: data.score,
          best: data.best,
          meters: data.meters,
          stars: data.stars,
          t,
        });
        const blob = await canvasToBlob(canvas);
        if (blob) file = new File([blob], `pixel-leap-${data.score}.png`, { type: 'image/png' });
      } catch {
        ledger.record('share_card_render_failure', { reason: 'render', fallback: 'static' });
      }
    }
    /*#endcard*/

    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const canFiles = !!(file && nav.canShare && nav.canShare({ files: [file] }));
    ledger.record('share_open', {
      score: data.score,
      method: canFiles ? 'web_share_file' : nav.share ? 'web_share' : 'copy',
    });

    // 在同一个用户手势里先把链接写进剪贴板（不 await）：
    // 取消/超时/异常都能立刻给出「已复制」反馈，不必再等第二次异步复制。
    const copyPromise = copyText(payload);

    let outcome = 'unsupported';
    try {
      if (canFiles) {
        outcome = await withTimeout(nav.share({ files: [file], text, title: t('share.title') }));
      } else if (nav.share) {
        outcome = await withTimeout(nav.share({ title: t('share.title'), text, url }));
      }
    } catch (err) {
      outcome = err && err.name === 'AbortError' ? 'cancel' : 'error';
    }

    if (outcome === 'success') {
      ledger.record('share_outcome', {
        method: canFiles ? 'web_share_file' : 'web_share',
        result: 'success',
        score: data.score,
      });
      onToast(t('toast.shareOk'), 'ok');
      return { outcome };
    }

    const copied = await copyPromise;
    ledger.record('share_outcome', {
      method: 'copy',
      result: copied ? outcome : 'copy_failed',
      score: data.score,
    });
    if (!copied) onToast(t('toast.copyFail'), 'error');
    else if (outcome === 'cancel') onToast(t('toast.shareCancel'), 'info');
    else if (outcome === 'unsupported') onToast(t('toast.shareUnsupported'), 'info');
    else onToast(t('toast.shareError'), 'info');
    return { outcome, copied };
  }

  return { share, shareLink };
}

function withTimeout(promise, ms = 6000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve('error');
    }, ms);
    promise.then(
      (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve('success');
        void v;
      },
      (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}
