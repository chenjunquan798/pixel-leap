// 调色板与三区域主题（PRD 9.3 / 9.2）
export const C = {
  ink: '#17101F',
  cream: '#FFF3D6',
  creamDim: '#E8D3A9',
  pink: '#E0446F',
  gold: '#FFD166',
  teal: '#0C7C75',
  white: '#FFFDF5',
};

export const PLATFORM = {
  normal: { body: '#2EC4B6', light: '#7FE7D8', dark: '#14867D', outline: '#07211F' },
  moving: { body: '#5B8CFF', light: '#9DBAFF', dark: '#2F55A8', outline: '#0B1430' },
  crumble: { body: '#E8873C', light: '#FFB877', dark: '#A85419', outline: '#2B1204' },
  spring: { body: '#FFD166', light: '#FFE9A8', dark: '#C69A2E', outline: '#2B1F04' },
  ground: { body: '#6B4A2F', light: '#8B6644', dark: '#452C1A', outline: '#170D06' },
  grass: { body: '#4CAF50', light: '#7BD97F', dark: '#2E6B31' },
};

// 每个区域的天空、远景与氛围色。sky 为自上而下的色带采样点。
export const ZONES = [
  {
    id: 'night',
    sky: ['#08061A', '#0C0A24', '#130F30', '#1B143D', '#241A48', '#2E2154', '#382858', '#422E5C'],
    horizon: '#4A3363',
    star: '#FFF3D6',
    cloud: '#2A2352',
    cloudLight: '#3A3168',
    hillFar: '#1A1338',
    hillNear: '#120D28',
    celestial: 'moon',
    tint: '#171033',
  },
  {
    id: 'dusk',
    sky: ['#2A1140', '#3D1849', '#541C50', '#6E2352', '#8E3050', '#B0434C', '#CE5C45', '#E87A46'],
    horizon: '#FFA45B',
    star: '#FFE3C4',
    cloud: '#F2A07A',
    cloudLight: '#FFC79C',
    hillFar: '#4A1B38',
    hillNear: '#2C1027',
    celestial: 'sun',
    tint: '#8E3050',
  },
  {
    id: 'space',
    sky: ['#020208', '#04040F', '#070818', '#0A0B22', '#0D0F2C', '#101338', '#141745', '#181A4E'],
    horizon: '#22255E',
    star: '#E7ECFF',
    cloud: '#1B2050',
    cloudLight: '#2A3170',
    hillFar: '#0B0D28',
    hillNear: '#070818',
    celestial: 'planet',
    tint: '#0B0C1E',
  },
];

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function mixHex(a, b, t) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

// 区域混合权重：跨越 200m / 500m 时在 ±18m 内淡入淡出
export function zoneBlend(meters) {
  const T = [200, 500];
  const soft = 18;
  if (meters < T[0] - soft) return [{ index: 0, alpha: 1 }, { index: 1, alpha: 0 }];
  if (meters < T[0] + soft) {
    const k = (meters - (T[0] - soft)) / (soft * 2);
    return [{ index: 0, alpha: 1 - k }, { index: 1, alpha: k }];
  }
  if (meters < T[1] - soft) return [{ index: 1, alpha: 1 }, { index: 2, alpha: 0 }];
  if (meters < T[1] + soft) {
    const k = (meters - (T[1] - soft)) / (soft * 2);
    return [{ index: 1, alpha: 1 - k }, { index: 2, alpha: k }];
  }
  return [{ index: 1, alpha: 0 }, { index: 2, alpha: 1 }];
}
