// 文案集中管理（PRD 9.5 / 10.2）。中文默认，英文 P1 已内置。
// 规则：开始/操作按钮动词优先；失败不说「你失败了」。

const ZH = {
  'app.title': '像素跳跳乐 Pixel Leap — 打开即玩的浏览器跳跃小游戏',
  'menu.kicker': '零安装 · 再来一局',
  'menu.best': '最高分',
  'menu.start': '开始跳跃',
  'menu.controls': '移动',
  'menu.touch': '触屏：按住屏幕左右两侧移动',
  'menu.soundOn': '音效 开',
  'menu.soundOff': '音效 关',
  'menu.mute': '静音',
  'menu.unmute': '取消静音',
  'menu.lang': 'EN',
  'menu.privacy': '隐私',
  'menu.tagline': '打开即玩 · 无广告 · 无登录',

  'hud.meters': '{n} m',

  'pause.kicker': 'PAUSED',
  'pause.title': '暂停',
  'pause.hint': '喘口气，星星不会跑。',
  'pause.resume': '继续',
  'pause.restart': '重开',
  'pause.home': '回首页',

  'over.kicker': 'RUN COMPLETE',
  'over.title': '本局结束',
  'over.points': '分',
  'over.height': '高度',
  'over.stars': '星星',
  'over.best': '最高分',
  'over.record': '新纪录！',
  'over.diff': '差 {n} 分破纪录',
  'over.retry': '再来一次',
  'over.share': '分享成绩',
  'over.home': '返回首页',

  'zone.night': '夜幕',
  'zone.dusk': '霞光层',
  'zone.space': '深空',
  'zone.toast': '{zone} · {m} m',

  'toast.audio': '音频不可用，游戏继续。',
  'toast.storage': '本地存档损坏，最高分已重置。',
  'toast.shareOk': '分享成功。',
  'toast.shareCancel': '已取消分享，链接已复制。',
  'toast.shareError': '分享失败，链接已复制。',
  'toast.shareUnsupported': '当前浏览器不支持分享，链接已复制。',
  'toast.copyFail': '复制失败，请手动复制地址栏链接。',

  'a11y.canvas': '游戏画面。左右方向键移动，P 键暂停。',
  'a11y.start': '游戏开始。左右移动，踩住平台。',
  'a11y.pause': '游戏已暂停。按继续或 P 恢复。',
  'a11y.resume': '游戏继续。',
  'a11y.menu': '主菜单。最高分 {best}。按空格开始。',
  'a11y.over': '本局结束，得分 {score}，高度 {meters} 米，星星 {stars} 颗。最高分 {best}。',
  'a11y.record': '新纪录！',

  'error.title': '游戏加载失败，请刷新重试。',
  'error.body': '画面初始化没有成功。刷新页面即可重新开始。',
  'error.refresh': '刷新页面',
  'error.storage': '本地存档不可用，本局仍可正常游玩。',
  'error.context': '画面暂时中断，正在尝试恢复…',
  'error.contextOk': '画面已恢复。',

  'share.title': '像素跳跳乐',
  'share.text': '我在像素跳跳乐跳到 {meters} 米、{score} 分，来挑战我！',
  'share.cardBest': '最高 {best}',
  'share.cardCta': '打开即玩，来挑战我',
};

const EN = {
  'app.title': 'Pixel Leap — a zero-install browser jumper',
  'menu.kicker': 'ZERO INSTALL · ONE MORE RUN',
  'menu.best': 'BEST',
  'menu.start': 'START RUN',
  'menu.controls': 'MOVE',
  'menu.touch': 'Touch: hold left or right half of the screen',
  'menu.soundOn': 'SOUND ON',
  'menu.soundOff': 'SOUND OFF',
  'menu.mute': 'Mute',
  'menu.unmute': 'Unmute',
  'menu.lang': '中文',
  'menu.privacy': 'Privacy',
  'menu.tagline': 'Plays instantly · No ads · No sign-in',

  'hud.meters': '{n} m',

  'pause.kicker': 'PAUSED',
  'pause.title': 'Paused',
  'pause.hint': 'Take a breath. The stars can wait.',
  'pause.resume': 'Resume',
  'pause.restart': 'Restart',
  'pause.home': 'Menu',

  'over.kicker': 'RUN COMPLETE',
  'over.title': 'Run complete',
  'over.points': 'PTS',
  'over.height': 'Height',
  'over.stars': 'Stars',
  'over.best': 'Best',
  'over.record': 'NEW BEST',
  'over.diff': '{n} pts to beat your best',
  'over.retry': 'ONE MORE RUN',
  'over.share': 'Share score',
  'over.home': 'Back to menu',

  'zone.night': 'NIGHTFALL',
  'zone.dusk': 'DUSK',
  'zone.space': 'DEEP SPACE',
  'zone.toast': '{zone} · {m} m',

  'toast.audio': 'Audio unavailable. The game continues.',
  'toast.storage': 'Saved score was damaged and has been reset.',
  'toast.shareOk': 'Shared.',
  'toast.shareCancel': 'Share cancelled. Link copied.',
  'toast.shareError': 'Share failed. Link copied.',
  'toast.shareUnsupported': 'Sharing is not supported here. Link copied.',
  'toast.copyFail': 'Copy failed — please copy the address bar link.',

  'a11y.canvas': 'Game screen. Left and right arrows move. P pauses.',
  'a11y.start': 'Game started. Move left and right, land on platforms.',
  'a11y.pause': 'Game paused. Press Resume or P to continue.',
  'a11y.resume': 'Game resumed.',
  'a11y.menu': 'Main menu. Best score {best}. Press space to start.',
  'a11y.over': 'Run complete. Score {score}, height {meters} meters, {stars} stars. Best score {best}.',
  'a11y.record': 'New best!',

  'error.title': "Couldn't load the game. Please refresh.",
  'error.body': 'The renderer failed to start. Refresh the page to try again.',
  'error.refresh': 'Refresh',
  'error.storage': 'Local storage is unavailable. You can still play.',
  'error.context': 'The screen was interrupted. Trying to restore…',
  'error.contextOk': 'Screen restored.',

  'share.title': 'Pixel Leap',
  'share.text': 'I hit {meters}m / {score} pts in Pixel Leap — beat me!',
  'share.cardBest': 'BEST {best}',
  'share.cardCta': 'Plays instantly — beat me',
};

const DICTS = { zh: ZH, en: EN };

export function createI18n(lang = 'zh') {
  let current = DICTS[lang] ? lang : 'zh';
  return {
    get lang() {
      return current;
    },
    set(next) {
      current = DICTS[next] ? next : 'zh';
    },
    t(key, params) {
      const table = DICTS[current] || ZH;
      let s = table[key];
      if (s === undefined) s = ZH[key];
      if (s === undefined) return key;
      if (params) {
        for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]));
      }
      return s;
    },
    zoneLabel(zone) {
      return this.t(['zone.night', 'zone.dusk', 'zone.space'][zone] || 'zone.night');
    },
  };
}
