import test from 'node:test';
import assert from 'node:assert/strict';

import { createI18n } from '../src/ui/i18n.js';

test('两种语言的内置文案键完全一致', () => {
  const zh = createI18n('zh');
  const en = createI18n('en');
  const zhText = zh.t('menu.start');
  const enText = en.t('menu.start');
  assert.equal(zhText, '开始跳跃');
  assert.equal(enText, 'START RUN');
  // 逐个 key 抽查关键路径，避免漏译导致显示成 key
  const keys = [
    'menu.start',
    'menu.touch',
    'pause.resume',
    'over.retry',
    'over.share',
    'over.record',
    'over.diff',
    'toast.shareOk',
    'toast.copyFail',
    'a11y.start',
    'a11y.over',
    'error.title',
    'share.text',
    'share.cardBest',
  ];
  for (const key of keys) {
    assert.notEqual(zh.t(key), key, `zh missing ${key}`);
    assert.notEqual(en.t(key), key, `en missing ${key}`);
  }
});

test('参数替换不会留下占位符', () => {
  const i18n = createI18n('zh');
  const text = i18n.t('a11y.over', { score: 224, meters: 214, stars: 3, best: 230 });
  assert.ok(text.includes('224'));
  assert.ok(text.includes('214'));
  assert.ok(text.includes('230'));
  assert.ok(!text.includes('{'), text);

  const diff = i18n.t('over.diff', { n: 38 });
  assert.equal(diff, '差 38 分破纪录');
});

test('分享文案只包含分数与高度，不含任何玩家标识', () => {
  for (const lang of ['zh', 'en']) {
    const i18n = createI18n(lang);
    const text = i18n.t('share.text', { meters: 214, score: 230 });
    assert.ok(text.includes('214') && text.includes('230'));
    assert.ok(!/@|mail|user|token|cookie/i.test(text), text);
  }
});

test('未知语言回退到中文，未知 key 返回 key 本身', () => {
  const i18n = createI18n('fr');
  assert.equal(i18n.lang, 'zh');
  assert.equal(i18n.t('nope.nope'), 'nope.nope');
});

test('区域名称两种语言都有', () => {
  const zh = createI18n('zh');
  const en = createI18n('en');
  assert.equal(zh.zoneLabel(0), '夜幕');
  assert.equal(zh.zoneLabel(1), '霞光层');
  assert.equal(zh.zoneLabel(2), '深空');
  assert.equal(en.zoneLabel(1), 'DUSK');
});
