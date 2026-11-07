// BGM：public/bgm/<名前>.ogg。場所と場面で切り替える。
// 曲を変えるときと、曲の終わりから頭へもどるときは、重ねてなめらかにつなぐ。

// 音量：声（約 -13〜-19 LUFS）より 10dB ほど小さく、どの曲も約 -26 LUFS になるようにした（11/6 測定）
const VOL = { hiroba: 0.18, mizuumi: 0.176, honne: 0.18, matsuri: 0.184 };
// 花まつりはループさせず、最後まで流して終わる
const LOOP = { hiroba: true, mizuumi: true, honne: true, matsuri: false };
const XF = 3; // ループのつなぎ（秒）

let cur = null; // 今の曲 { name, els, timer }
let blocked = false; // ブラウザが自動再生を止めたとき、最初の操作で鳴らしなおす

function ramp(a, to, ms, then) {
  clearInterval(a._ramp);
  const from = a.volume;
  const t0 = performance.now();
  if (!ms || ms <= 0) { a.volume = to; if (then) then(); return; }
  a._ramp = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k >= 1) { clearInterval(a._ramp); if (then) then(); }
  }, 40);
}

function kill(t, a) {
  clearInterval(a._ramp);
  a.pause();
  a.removeAttribute('src');
  a.load();
  t.els = t.els.filter((e) => e !== a);
}

function spawn(t, fadeMs) {
  const a = new Audio(`./bgm/${t.name}.ogg`);
  a.volume = 0;
  a._fade = fadeMs;
  t.els.push(a);
  a.play().then(() => ramp(a, t.vol, fadeMs)).catch(() => { blocked = true; });
}

function startTrack(name, fadeMs) {
  const t = { name, els: [], vol: VOL[name] ?? 0.18, timer: null };
  spawn(t, fadeMs);
  t.timer = setInterval(() => {
    if (!LOOP[name]) return;
    const a = t.els[t.els.length - 1];
    if (!a || a._next || !a.duration || a.paused) return;
    if (a.duration - a.currentTime < XF) {
      a._next = true;
      spawn(t, XF * 1000);
      ramp(a, 0, XF * 1000, () => kill(t, a));
    }
  }, 100);
  return t;
}

function stopTrack(t, ms) {
  clearInterval(t.timer);
  for (const a of [...t.els]) ramp(a, 0, ms, () => kill(t, a));
}

export function play(name, ms = 1500) {
  if (!name) { stop(ms); return; }
  if (cur && cur.name === name) return;
  if (cur) stopTrack(cur, ms);
  cur = startTrack(name, ms);
}

export function stop(ms = 1500) {
  if (cur) stopTrack(cur, ms);
  cur = null;
}

// キーやクリックのあとに呼ぶ。止められていた曲を鳴らす
export function resume() {
  if (!blocked || !cur) return;
  blocked = false;
  for (const a of cur.els) {
    if (a.paused) a.play().then(() => ramp(a, cur ? cur.vol : 0.18, a._fade || 1000)).catch(() => { blocked = true; });
  }
}

export function current() { return cur ? cur.name : null; }

// 確かめ用：今鳴っている曲の様子
export function state() {
  return cur ? { name: cur.name, blocked, els: cur.els.map((a) => ({ t: Math.round(a.currentTime * 10) / 10, v: Math.round(a.volume * 1000) / 1000, paused: a.paused })) } : { name: null, blocked };
}

// 確かめ用：今の曲を、終わりの sec 秒前へ飛ばす（ループのつなぎを見る）
export function debugSeekEnd(sec) {
  const a = cur && cur.els[cur.els.length - 1];
  if (a && a.duration) a.currentTime = a.duration - sec;
}
