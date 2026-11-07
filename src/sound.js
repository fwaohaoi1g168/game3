// 効果音と環境の音を Web Audio でその場で作る。外の音の素材は使わない。
let ctx = null;
let master = null;
let ambient = null;

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noiseBuffer(sec, brown = false) {
  const c = ac();
  const n = Math.floor(c.sampleRate * sec);
  const b = c.createBuffer(1, n, c.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return b;
}

let stepBuf = null;
export function unlock() { ac(); }

// 足音：草（やわらかい）、板（こつこつ）、石
export function step(kind) {
  const c = ac();
  if (!stepBuf) stepBuf = noiseBuffer(0.12);
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = stepBuf;
  const f = c.createBiquadFilter();
  const g = c.createGain();
  if (kind === 'wood') {
    f.type = 'bandpass';
    f.frequency.value = 700 + Math.random() * 150;
    f.Q.value = 3;
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    const o = c.createOscillator();
    const og = c.createGain();
    o.frequency.value = 180 + Math.random() * 20;
    og.gain.setValueAtTime(0.12, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(og).connect(master);
    o.start(t);
    o.stop(t + 0.1);
  } else if (kind === 'stone') {
    f.type = 'bandpass';
    f.frequency.value = 1800 + Math.random() * 400;
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  } else {
    f.type = 'lowpass';
    f.frequency.value = 900 + Math.random() * 300;
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
  }
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export function blip(kind = 'move') {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime;
  o.type = 'sine';
  o.frequency.value = kind === 'ok' ? 880 : kind === 'cancel' ? 330 : 620;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'ok' ? 0.18 : 0.08));
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.2);
}

export function bump() {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime;
  o.type = 'triangle';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.15);
}

// 花まつりの鐘（3回）
export function bell() {
  const c = ac();
  const partials = [[1, 0.5], [2.0, 0.25], [2.76, 0.18], [5.4, 0.08]];
  for (let k = 0; k < 3; k++) {
    const t = c.currentTime + k * 1.1;
    const base = k === 1 ? 659 : 523;
    for (const [m, a] of partials) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = base * m;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(a * 0.35, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 2.7);
    }
  }
}

// 小鳥のさえずり（短く上がり下がりする高い音）
function chirp(dest) {
  const c = ac();
  const t = c.currentTime;
  const n = 2 + Math.floor(Math.random() * 4);
  const base = 2600 + Math.random() * 1600;
  for (let i = 0; i < n; i++) {
    const s = t + i * (0.09 + Math.random() * 0.05);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(base, s);
    o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), s + 0.05);
    o.frequency.exponentialRampToValueAtTime(base * 0.9, s + 0.08);
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.05, s + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.08);
    o.connect(g).connect(dest);
    o.start(s);
    o.stop(s + 0.1);
  }
}

// 環境の音：広場は風と小鳥、湖は小さな水音と小鳥
export function setAmbient(kind) {
  const c = ac();
  if (ambient) {
    const old = ambient;
    clearInterval(old.timer);
    old.gain.gain.setTargetAtTime(0, c.currentTime, 0.4);
    setTimeout(() => { old.nodes.forEach((n) => { try { n.stop(); } catch (e) { /* 止め済み */ } }); old.gain.disconnect(); }, 2000);
    ambient = null;
  }
  if (!kind) return;
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(master);
  const nodes = [];
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(6, true);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  const body = c.createGain();
  if (kind === 'lake') {
    f.frequency.value = 900;
    body.gain.value = 0.12;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.35;
    const lg = c.createGain();
    lg.gain.value = 0.08;
    lfo.connect(lg).connect(body.gain);
    lfo.start();
    nodes.push(lfo);
  } else {
    f.frequency.value = 450;
    body.gain.value = 0.09;
  }
  src.connect(f).connect(body).connect(gain);
  src.start();
  nodes.push(src);
  const timer = setInterval(() => {
    if (Math.random() < (kind === 'park' ? 0.55 : 0.35)) chirp(gain);
  }, 900);
  gain.gain.setTargetAtTime(1, c.currentTime, 0.8);
  ambient = { gain, nodes, timer };
}
