// WebAudio 合成音效与轻柔背景音。
// 首次用户手势后才初始化（PRD FR-11：默认不自动播放）；任何失败都不阻断游戏。

export function createAudio(opts = {}) {
  let ac = null;
  let master = null;
  let musicGain = null;
  let noiseBuffer = null;
  let muted = !!opts.muted;
  let ready = false;
  let musicTimer = null;
  let nextNote = 0;
  let noteIndex = 0;
  let zone = 0;
  let failed = false;

  // 三个区域各用一条五声音阶，避免刺耳
  const SCALES = [
    [220, 261.63, 293.66, 329.63, 392, 440],
    [196, 233.08, 261.63, 311.13, 349.23, 392],
    [174.61, 207.65, 233.08, 261.63, 311.13, 349.23],
  ];

  function init() {
    if (ready) {
      unlock();
      return true;
    }
    if (failed) return false;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      failed = true;
      if (opts.onError) opts.onError();
      return false;
    }
    try {
      ac = new AC();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.85;
      master.connect(ac.destination);
      musicGain = ac.createGain();
      musicGain.gain.value = 0;
      musicGain.connect(master);
      noiseBuffer = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.4), ac.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      ready = true;
      unlock();
      return true;
    } catch {
      failed = true;
      if (opts.onError) opts.onError();
      return false;
    }
  }

  function unlock() {
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume().catch(() => {});
  }

  function tone({ freq, freq2, dur = 0.09, type = 'square', gain = 0.14, delay = 0, dest = null }) {
    if (!ready || muted) return;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freq2) osc.frequency.exponentialRampToValueAtTime(Math.max(24, freq2), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest || master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function noise({ dur = 0.12, gain = 0.12, freq = 900, delay = 0 }) {
    if (!ready || muted || !noiseBuffer) return;
    const t0 = ac.currentTime + delay;
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.8;
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  const SFX = {
    land() {
      tone({ freq: 300, freq2: 470, dur: 0.075, type: 'square', gain: 0.11 });
    },
    spring() {
      tone({ freq: 320, freq2: 1100, dur: 0.18, type: 'square', gain: 0.13 });
      noise({ dur: 0.1, gain: 0.06, freq: 1600 });
    },
    star() {
      tone({ freq: 880, dur: 0.07, type: 'sine', gain: 0.13 });
      tone({ freq: 1320, dur: 0.09, type: 'sine', gain: 0.1, delay: 0.06 });
    },
    crack() {
      noise({ dur: 0.14, gain: 0.14, freq: 700 });
      tone({ freq: 180, freq2: 90, dur: 0.1, type: 'square', gain: 0.07 });
    },
    dead() {
      tone({ freq: 300, freq2: 70, dur: 0.45, type: 'sawtooth', gain: 0.1 });
    },
    best() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone({ freq: f, dur: 0.12, type: 'square', gain: 0.1, delay: i * 0.085 })
      );
    },
    ui() {
      tone({ freq: 560, dur: 0.035, type: 'square', gain: 0.06 });
    },
  };

  function play(name) {
    if (!ready || muted) return;
    const fn = SFX[name];
    if (fn) fn();
  }

  // 极简背景琶音：0.5s 一个音，低八度铺底，音量很低
  function scheduleMusic() {
    if (!ready || muted || !musicTimer) return;
    const scale = SCALES[zone] || SCALES[0];
    while (nextNote < ac.currentTime + 0.6) {
      const freq = scale[noteIndex % scale.length] * (noteIndex % 8 < 4 ? 1 : 2);
      tone({
        freq,
        dur: 0.42,
        type: 'triangle',
        gain: 0.035,
        delay: Math.max(0, nextNote - ac.currentTime),
        dest: musicGain,
      });
      if (noteIndex % 8 === 0) {
        tone({
          freq: scale[0] / 2,
          dur: 1.1,
          type: 'sine',
          gain: 0.05,
          delay: Math.max(0, nextNote - ac.currentTime),
          dest: musicGain,
        });
      }
      noteIndex++;
      nextNote += 0.5;
    }
  }

  return {
    get ready() {
      return ready;
    },
    get muted() {
      return muted;
    },
    init,
    unlock,
    play,
    setZone(z) {
      zone = z;
    },
    setMuted(next) {
      muted = !!next;
      if (master && ac) master.gain.setTargetAtTime(muted ? 0 : 0.85, ac.currentTime, 0.02);
    },
    startMusic() {
      if (!ready || musicTimer || muted) return;
      nextNote = ac.currentTime + 0.15;
      musicGain.gain.setTargetAtTime(0.55, ac.currentTime, 0.6);
      musicTimer = setInterval(scheduleMusic, 250);
      scheduleMusic();
    },
    stopMusic() {
      if (musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
      if (ready) musicGain.gain.setTargetAtTime(0, ac.currentTime, 0.15);
    },
  };
}
