// 像素跳跳乐 · 核心配置
// 所有数值来自 PRD v2.0 第 8.2 节「物理参数（当前实现基线）」。
// 改动这里等于改动手感，必须同步 tests/ 里的验收断言。

export const VIEW = {
  W: 480,
  H: 720,
};

export const STEP = 1 / 60; // 固定物理步进，与渲染帧率解耦
export const MAX_STEPS = 5; // 一帧最多补 5 步，不追帧

export const PHYS = {
  GRAVITY: 2300, // px/s²
  JUMP_VY: 950, // 普通弹跳，跳跃高度 ≈ 196 px
  SPRING_VY: 1520, // 弹簧弹跳 ≈ 4 块平台
  MAX_VX: 345, // 水平最大速度
  ACCEL: 3200, // 地面/空中加速度（全控制）
  FRICTION: 2600, // 松手后的减速
  CAMERA_LINE: 0.44, // 镜头跟随阈值：屏幕高度 44%
  DEATH_MARGIN: 110, // 跌出屏幕底部 110 px 判定死亡
  PX_PER_M: 8, // 高度换算：8 px = 1 m
  EDGE_TOLERANCE: 9, // 平台边缘横向容错
  CLIMB_NORM: 7000, // 爬升 7000 px 达到最大难度（PRD 8.3，待 M1 校准）
  PLATFORM_H: 12,
  PLAYER_W: 26,
  PLAYER_H: 30,
  START_FEET_Y: 680, // 起始地面高度（世界坐标）
};

// 一次跳跃的理论最高点：v² / 2g ≈ 196.2 px
export const JUMP_HEIGHT = (PHYS.JUMP_VY * PHYS.JUMP_VY) / (2 * PHYS.GRAVITY);

// 难度带：完全对齐 PRD 8.3 的「高度带」表。
// gap / width 为区间，moving / crumble / spring 为该带起止概率。
export const BANDS = [
  {
    minM: 0,
    maxM: 200,
    gap: [66, 96],
    width: [78, 104],
    moving: [0.0, 0.05],
    crumble: [0.0, 0.0],
    spring: [0.075, 0.075],
  },
  {
    minM: 200,
    maxM: 500,
    gap: [75, 107],
    width: [74, 96],
    moving: [0.08, 0.15],
    crumble: [0.05, 0.08],
    spring: [0.075, 0.075],
  },
  {
    minM: 500,
    maxM: 750,
    gap: [85, 116],
    width: [62, 84],
    moving: [0.15, 0.2],
    crumble: [0.1, 0.12],
    spring: [0.06, 0.06],
  },
  {
    minM: 750,
    maxM: Infinity,
    gap: [90, 116],
    width: [52, 72],
    moving: [0.22, 0.22],
    crumble: [0.12, 0.12],
    spring: [0.05, 0.05],
  },
];

// PRD 8.5：前 420 px 不出现特殊平台
export const SAFE_ZONE_PX = 420;
// PRD 8.5：垂直间隙 ≤ 跳跃高度的 60%
export const MAX_GAP = Math.floor(JUMP_HEIGHT * 0.6);
// PRD 8.2：一次跳跃可覆盖的水平偏移上限
export const MAX_DX = 135;

export const ZONE_THRESHOLDS = [200, 500];
export const ZONE_NAMES = ['night', 'dusk', 'space'];
export const ZONE_LABELS_ZH = ['夜幕', '霞光层', '深空'];
export const ZONE_LABELS_EN = ['NIGHTFALL', 'DUSK', 'DEEP SPACE'];

export const CRUMBLE_DELAY = 0.28; // 碎裂平台：先弹一次，0.28s 后消失
