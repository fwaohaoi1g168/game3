// 花まつりの朝：一人称で歩いて、人と話す 3D のアドベンチャー
import * as THREE from 'three';
import { Chara } from './chara.js';
import { buildPark, buildLake, Festival } from './world.js';
import { CHARAS, AREAS, SCRIPTS } from './story.js';
import * as snd from './sound.js';
import * as bgm from './bgm.js';

// 場所ごとの BGM（public/bgm/<名前>.ogg）
const AREA_BGM = { park: 'hiroba', lake: 'mizuumi' };

// ------------------------------------------------------------
// 画面
// ------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
// 手前の切り口は 0.1。小さすぎると奥行きの精度が落ちて、遠くの重なった面がちらつく
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 900);
scene.add(camera);
// 人物を正面から明るく照らす明かり。朝日が湖の側（奥）の低いところにあり、こちらを向いた人物が逆光になって
// 顔や服がくすんでいたので、カメラの少し上・左から当てる（アニメの順光）。カメラについて動く
const keyLight = new THREE.DirectionalLight(0xfffaf4, 1.05);
keyLight.position.set(-0.8, 1.2, 1);
keyLight.target.position.set(0, 0, -4);
camera.add(keyLight, keyLight.target);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const festival = new Festival(scene, () => snd.bell());

// ------------------------------------------------------------
// 状態
// ------------------------------------------------------------
const HOME = {
  kaho: { area: 'park', x: 1.2, z: -14.6, yaw: Math.PI },
  rin: { area: 'lake', x: 20, z: -16.6, yaw: Math.PI },
};
const EYE = 1.5;
const player = { x: 0, z: 10.5, yaw: 0, pitch: 0, bob: 0, stepDist: 0 };
let flags = {};
let mode = 'loading'; // loading | title | walk | script | menu
let areaId = null;
let area = null;
const areas = {};
const chars = {};
const charArea = {};
let fixedCam = null; // { pos, look }
let talkTo = null; // 話している相手の id
let zoneCooldown = 0;
let lastBump = 0;
const timer = new THREE.Timer();
let time = 0;

// ------------------------------------------------------------
// 入力
// ------------------------------------------------------------
const keys = new Set();
let handler = null; // 文や選択肢やメニューが開いているときの受け口

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
  snd.unlock();
  bgm.resume();
  keys.add(e.code);
  if (e.repeat && ['Enter', 'Space', 'NumpadEnter', 'Escape'].includes(e.code)) return;
  if (handler) { handler(e.code); return; }
  if (mode === 'walk') {
    if (isOk(e.code)) tryTalk();
    else if (isCancel(e.code)) openPause();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
$('stage').addEventListener('mousedown', (e) => {
  snd.unlock();
  bgm.resume();
  if (e.button !== 0) return;
  if (handler && !e.target.closest('li') && !e.target.closest('#choices div')) handler('Click');
});

function isOk(c) { return c === 'Enter' || c === 'Space' || c === 'NumpadEnter' || c === 'KeyZ'; }
function isCancel(c) { return c === 'Escape' || c === 'KeyX' || c === 'Backspace'; }
function isUp(c) { return c === 'ArrowUp' || c === 'KeyW'; }
function isDown(c) { return c === 'ArrowDown' || c === 'KeyS'; }
function isLeft(c) { return c === 'ArrowLeft' || c === 'KeyA'; }
function isRight(c) { return c === 'ArrowRight' || c === 'KeyD'; }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------
// 文の窓
// ------------------------------------------------------------
// 声：台詞ごとの ogg（public/voice/<v>.ogg）。次の文へ進むと止める
let voice = null;
function stopVoice() {
  if (voice) { voice.pause(); voice.src = ''; voice = null; }
}
function playVoice(id, ch) {
  stopVoice();
  if (!id) return false;
  const a = new Audio(`./voice/${id}.ogg`);
  a.volume = 1;
  voice = a;
  // 声が鳴っている間だけ口を動かす
  a.addEventListener('playing', () => { if (ch && voice === a) ch.talking = true; });
  a.addEventListener('ended', () => { if (ch && voice === a) ch.talking = false; });
  a.addEventListener('error', () => { if (ch && voice === a) ch.talking = false; });
  a.play().catch(() => { if (ch && voice === a) ch.talking = false; });
  return true;
}

function say(nameText, text, who, voiceId) {
  return new Promise((resolve) => {
    const msg = $('msg'), nm = $('name'), tx = $('text'), nx = $('next');
    msg.classList.remove('hidden');
    if (nameText) { nm.textContent = nameText; nm.classList.remove('hidden'); } else nm.classList.add('hidden');
    tx.textContent = '';
    nx.classList.add('hidden');
    let i = 0;
    let done = false;
    const speed = 38; // 1秒の字数
    let acc = 0;
    let last = performance.now();
    const ch = who ? chars[who] : null;
    if (ch) ch.talking = true;
    const voiced = playVoice(voiceId, ch);
    const finish = () => {
      done = true;
      tx.textContent = text;
      nx.classList.remove('hidden');
      if (ch && !voiced) ch.talking = false; // 声があるときは、声が終わるまで口を動かす
    };
    const tick = (now) => {
      if (done) return;
      const skip = keys.has('ControlLeft') || keys.has('ControlRight');
      acc += ((now - last) / 1000) * (skip ? 400 : speed);
      last = now;
      while (acc >= 1 && i < text.length) { i++; acc -= 1; }
      tx.textContent = text.slice(0, i);
      if (i >= text.length) finish();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    let skipTimer = null;
    const next = () => {
      clearInterval(skipTimer);
      stopVoice();
      if (ch) ch.talking = false;
      handler = null;
      resolve();
    };
    skipTimer = setInterval(() => {
      if (done && (keys.has('ControlLeft') || keys.has('ControlRight'))) next();
    }, 80);
    handler = (code) => {
      if (!(isOk(code) || code === 'Click')) return;
      if (!done) finish();
      else next();
    };
  });
}
function hideMsg() { $('msg').classList.add('hidden'); stopVoice(); }

// 選択肢
function choose(opts) {
  return new Promise((resolve) => {
    const box = $('choices');
    box.innerHTML = '';
    let sel = 0;
    const items = opts.map((o, i) => {
      const d = document.createElement('div');
      d.textContent = o.t;
      d.addEventListener('mouseenter', () => { sel = i; draw(); });
      d.addEventListener('click', () => pick(i));
      box.appendChild(d);
      return d;
    });
    const draw = () => items.forEach((d, i) => d.classList.toggle('sel', i === sel));
    const pick = (i) => {
      snd.blip('ok');
      box.classList.add('hidden');
      handler = null;
      resolve(opts[i]);
    };
    draw();
    box.classList.remove('hidden');
    const shownAt = performance.now();
    handler = (code) => {
      if (performance.now() - shownAt < 350) return; // 文を送る連打で選んでしまわないように
      if (isUp(code)) { sel = (sel + opts.length - 1) % opts.length; snd.blip(); draw(); }
      else if (isDown(code)) { sel = (sel + 1) % opts.length; snd.blip(); draw(); }
      else if (isOk(code)) pick(sel);
    };
  });
}

// メニュー（縦か横の一覧）。決めた項目の data-act を返す。Esc なら null
function runMenu(ul, { start = 0, cancel = true, horizontal = false } = {}) {
  return new Promise((resolve) => {
    const items = [...ul.querySelectorAll('li')];
    let sel = Math.min(start, items.length - 1);
    const ok = (i) => !items[i].classList.contains('disabled');
    while (!ok(sel)) sel = (sel + 1) % items.length;
    const draw = () => items.forEach((li, i) => li.classList.toggle('sel', i === sel));
    const move = (d) => {
      let n = sel;
      for (let k = 0; k < items.length; k++) { n = (n + d + items.length) % items.length; if (ok(n)) break; }
      if (n !== sel) { sel = n; snd.blip(); draw(); }
    };
    const done = (v) => {
      items.forEach((li) => { li.onmouseenter = null; li.onclick = null; });
      handler = null;
      resolve(v);
    };
    items.forEach((li, i) => {
      li.onmouseenter = () => { if (ok(i)) { sel = i; draw(); } };
      li.onclick = () => { if (ok(i)) { snd.blip('ok'); done(li.dataset.act); } };
    });
    draw();
    handler = (code) => {
      if ((horizontal ? isLeft(code) : isUp(code))) move(-1);
      else if ((horizontal ? isRight(code) : isDown(code))) move(1);
      else if (isOk(code)) { snd.blip('ok'); done(items[sel].dataset.act); }
      else if (cancel && isCancel(code)) { snd.blip('cancel'); done(null); }
    };
  });
}

async function confirmBox(text) {
  $('confirm-text').textContent = text;
  $('confirm').classList.remove('hidden');
  const r = await runMenu($('confirm-menu'), { start: 1, horizontal: true });
  $('confirm').classList.add('hidden');
  return r === 'yes';
}

// ------------------------------------------------------------
// フェードと場所の名前
// ------------------------------------------------------------
async function fade(to, ms) {
  const f = $('fade');
  f.style.transition = `opacity ${ms}ms ease`;
  f.style.opacity = to;
  if (ms > 0) await sleep(ms + 30);
}
let bannerTimer = null;
function showBanner() {
  const b = $('banner');
  b.textContent = AREAS[areaId].name;
  b.classList.remove('hidden');
  b.style.opacity = 1;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => {
    b.style.opacity = 0;
    bannerTimer = setTimeout(() => b.classList.add('hidden'), 1000);
  }, 3200);
}

// ------------------------------------------------------------
// 場所
// ------------------------------------------------------------
// music：流す曲の名前。null で止める。書かなければ今の曲のまま（起動の準備のときなど）
function loadArea(id, music) {
  if (area) scene.remove(area.group);
  Object.values(chars).forEach((c) => scene.remove(c.root));
  areaId = id;
  area = areas[id];
  scene.add(area.group);
  scene.fog = area.fog;
  for (const [cid, ch] of Object.entries(chars)) {
    if (charArea[cid] === id) { scene.add(ch.root); ch.settle(); }
  }
  snd.setAmbient(area.ambient);
  if (music !== undefined) bgm.play(music);
  zoneCooldown = 0.6;
}

function resetChars() {
  for (const [cid, h] of Object.entries(HOME)) {
    charArea[cid] = h.area;
    chars[cid].place(h.x, h.z, h.yaw);
    chars[cid].setFace('neutral');
    chars[cid].lookAt(null);
  }
}

function blocked(x, z) {
  const r = 0.28;
  const inWalk = area.walk.some((w) => x >= w.x1 && x <= w.x2 && z >= w.z1 && z <= w.z2);
  if (!inWalk) return true;
  for (const o of area.obstacles) if (Math.hypot(x - o.x, z - o.z) < o.r + r) return true;
  for (const [cid, ch] of Object.entries(chars)) {
    if (charArea[cid] !== areaId) continue;
    if (Math.hypot(x - ch.root.position.x, z - ch.root.position.z) < 0.45 + r) return true;
  }
  return false;
}

function walkUpdate(dt) {
  let turn = 0, fwd = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) turn += 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) turn -= 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) fwd += 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) fwd -= 1;
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((g) => g) : null;
  if (gp) {
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    if (Math.abs(ax) > 0.25) turn -= ax;
    if (Math.abs(ay) > 0.25) fwd -= ay;
  }
  const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  player.yaw += turn * 1.9 * dt;
  player.pitch *= 1 - Math.min(1, dt * 4);
  if (fwd !== 0) {
    const sp = (fwd > 0 ? (run ? 4.4 : 2.4) : 1.4) * Math.sign(fwd);
    const dx = -Math.sin(player.yaw) * sp * dt;
    const dz = -Math.cos(player.yaw) * sp * dt;
    const ox = player.x, oz = player.z;
    if (!blocked(ox + dx, oz + dz)) { player.x += dx; player.z += dz; }
    else if (!blocked(ox + dx, oz)) player.x += dx;
    else if (!blocked(ox, oz + dz)) player.z += dz;
    const moved = Math.hypot(player.x - ox, player.z - oz);
    if (moved < 0.002 && time - lastBump > 0.45) { snd.bump(); lastBump = time; }
    player.stepDist += moved;
    player.bob += moved * 4.2;
    if (player.stepDist > (run ? 0.9 : 0.75)) { player.stepDist = 0; snd.step(area.walkSound); }
  }

  // 階段などの場所
  zoneCooldown -= dt;
  if (zoneCooldown <= 0) {
    for (const zn of area.zones) {
      if (player.x >= zn.x1 && player.x <= zn.x2 && player.z >= zn.z1 && player.z <= zn.z2) {
        onZone(zn.id);
        return;
      }
    }
  }
  updatePrompt();
}

function nearChar() {
  let best = null;
  for (const [cid, ch] of Object.entries(chars)) {
    if (charArea[cid] !== areaId) continue;
    const dx = ch.root.position.x - player.x, dz = ch.root.position.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d > 2.1) continue;
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    const cos = (dx * fx + dz * fz) / (d || 1);
    if (cos < 0.7) continue;
    if (!best || d < best.d) best = { cid, d };
  }
  return best ? best.cid : null;
}

function updatePrompt() {
  const p = $('prompt');
  const c = mode === 'walk' ? nearChar() : null;
  if (c) { p.textContent = `Enter：${CHARAS[c].name}と話す`; p.classList.remove('hidden'); }
  else p.classList.add('hidden');
}

function tryTalk() {
  const c = nearChar();
  if (!c) return;
  let label = null;
  if (c === 'kaho') label = flags.step === 'meet_kaho' ? 'kaho_first' : 'kaho_again';
  if (c === 'rin') label = 'rin_talk';
  if (label) runScript(label);
}

function onZone(id) {
  if (id === 'stairs_down') runScript(flags.step === 'meet_kaho' ? 'stairs_locked' : 'stairs_down');
  else if (id === 'stairs_up') runScript('stairs_up');
}

// ------------------------------------------------------------
// 台本を進める
// ------------------------------------------------------------
let scriptToken = 0;
async function runScript(label) {
  const token = ++scriptToken;
  mode = 'script';
  $('prompt').classList.add('hidden');
  let list = SCRIPTS[label];
  let i = 0;
  while (list && i < list.length) {
    if (token !== scriptToken) return;
    const c = list[i++];
    if (c.if !== undefined) {
      if (flags[c.if] === c.eq) { list = SCRIPTS[c.goto]; i = 0; }
      continue;
    }
    if (c.goto) { list = SCRIPTS[c.goto]; i = 0; continue; }
    const r = await exec(c);
    if (r === 'end') return;
  }
  if (token !== scriptToken) return;
  hideMsg();
  mode = 'walk';
  zoneCooldown = Math.max(zoneCooldown, 0.3);
}

async function exec(c) {
  if (c.n !== undefined) { await say(null, c.n, null); return; }
  if (c.s) {
    const ch = chars[c.s];
    if (c.e) ch.setFace(c.e === 'neutral' ? 'neutral' : c.e);
    await say(CHARAS[c.s].name, c.t, c.s, c.v);
    return;
  }
  if (c.choice) {
    const o = await choose(c.choice);
    Object.assign(flags, o.set || {});
    return;
  }
  if (c.set) { Object.assign(flags, c.set); return; }
  if ('bgm' in c && !c.area) { bgm.play(c.bgm, c.ms); return; }
  if (c.fadeOut !== undefined) { hideMsg(); await fade(1, c.fadeOut); return; }
  if (c.fadeIn !== undefined) { await fade(0, c.fadeIn); return; }
  if (c.area) {
    hideMsg();
    loadArea(c.area, c.bgm !== undefined ? c.bgm : AREA_BGM[c.area]);
    player.x = c.pos[0]; player.z = c.pos[1]; player.yaw = c.yaw; player.pitch = 0;
    fixedCam = null;
    talkTo = null;
    talkBlend = 0; lastTalk = null;
    return;
  }
  if (c.place) {
    const ch = chars[c.place];
    charArea[c.place] = areaId;
    if (!ch.root.parent) scene.add(ch.root);
    const yaw = c.face ? Math.atan2(c.face[0] - c.pos[0], c.face[1] - c.pos[1]) : ch.root.rotation.y;
    ch.place(c.pos[0], c.pos[1], yaw);
    ch.lookAt(null);
    return;
  }
  if (c.cam) { fixedCam = { pos: new THREE.Vector3(...c.cam.pos), look: new THREE.Vector3(...c.cam.look), fov: c.cam.fov || WALK_FOV, cur: fixedCam ? fixedCam.cur : null }; return; }
  if (c.look) {
    talkTo = c.look;
    const ch = chars[c.look];
    ch.faceToward(player.x, player.z);
    ch.lookAt(camera);
    await sleep(350);
    return;
  }
  if (c.unlook) {
    hideMsg();
    if (talkTo) {
      const ch = chars[talkTo];
      ch.lookAt(null);
      ch.setFace('neutral');
      const h = HOME[talkTo];
      if (h) ch.targetYaw = h.yaw;
    }
    talkTo = null;
    return;
  }
  if (c.banner) { showBanner(); return; }
  if (c.pushBack) {
    hideMsg();
    player.x -= -Math.sin(player.yaw) * 1.2;
    player.z -= -Math.cos(player.yaw) * 1.2;
    player.yaw += Math.PI;
    zoneCooldown = 0.5;
    return;
  }
  if (c.wait) { await sleep(c.wait); return; }
  if (c.festival !== undefined) { if (c.festival) festival.start(time); else festival.stop(); return; }
  if (c.end) {
    hideMsg();
    await sleep(1500);
    await showTitle();
    return 'end';
  }
}

// ------------------------------------------------------------
// カメラ
// ------------------------------------------------------------
const tmpV = new THREE.Vector3();
const WALK_FOV = 60;
const TALK_FOV = 30; // 話すときは画角をしぼって、腰から上を大きく写す
const TALK_DIST = 2.25;
let talkBlend = 0; // 0＝歩くときの目線、1＝話すときの寄り
let lastTalk = null;
const camA = { pos: new THREE.Vector3(), q: new THREE.Quaternion() };
const camB = { pos: new THREE.Vector3(), q: new THREE.Quaternion() };
const lookHelper = new THREE.PerspectiveCamera(); // カメラの向き（-z）で lookAt する

function setFov(f) {
  if (Math.abs(camera.fov - f) > 0.01) { camera.fov = f; camera.updateProjectionMatrix(); }
}

// 話している相手を、腰から上で写す位置（文の窓の上に体が収まるように）
function talkShot(id, out) {
  const ch = chars[id];
  const p = ch.root.position;
  ch.bone('head').getWorldPosition(tmpV);
  let dx = player.x - p.x, dz = player.z - p.z;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len; dz /= len;
  const ground = area.heightAt(p.x, p.z);
  out.pos.set(p.x + dx * TALK_DIST, tmpV.y - 0.05, p.z + dz * TALK_DIST);
  lookHelper.position.copy(out.pos);
  lookHelper.lookAt(p.x, Math.max(ground + 0.6, tmpV.y - 0.27), p.z);
  out.q.copy(lookHelper.quaternion);
}

function updateCamera(dt) {
  if (fixedCam) {
    if (!fixedCam.cur) fixedCam.cur = { pos: fixedCam.pos.clone(), look: fixedCam.look.clone(), fov: camera.fov };
    const k = Math.min(1, dt * 2.2);
    fixedCam.cur.pos.lerp(fixedCam.pos, k);
    fixedCam.cur.look.lerp(fixedCam.look, k);
    fixedCam.cur.fov += ((fixedCam.fov || WALK_FOV) - fixedCam.cur.fov) * k;
    camera.position.copy(fixedCam.cur.pos);
    camera.lookAt(fixedCam.cur.look);
    setFov(fixedCam.cur.fov);
    talkBlend = 0;
    return;
  }
  if (talkTo) {
    // 話す相手のほうへ体を向けておく（話し終えたとき、相手の前に立っているように）
    const p = chars[talkTo].root.position;
    const dx = p.x - player.x, dz = p.z - player.z;
    const goalYaw = Math.atan2(-dx, -dz);
    let d = goalYaw - player.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    player.yaw += d * Math.min(1, dt * 4);
    player.pitch += (0 - player.pitch) * Math.min(1, dt * 4);
    lastTalk = talkTo;
  }
  talkBlend += ((talkTo ? 1 : 0) - talkBlend) * Math.min(1, dt * 3.5);
  if (!talkTo && talkBlend < 0.002) { talkBlend = 0; lastTalk = null; }

  const bob = Math.sin(player.bob) * 0.025;
  camA.pos.set(player.x, EYE + area.heightAt(player.x, player.z) + bob, player.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  camA.q.copy(camera.quaternion);
  if (talkBlend > 0 && lastTalk) {
    talkShot(lastTalk, camB);
    const e = talkBlend * talkBlend * (3 - 2 * talkBlend);
    camera.position.lerpVectors(camA.pos, camB.pos, e);
    camera.quaternion.slerpQuaternions(camA.q, camB.q, e);
    setFov(WALK_FOV + (TALK_FOV - WALK_FOV) * e);
  } else {
    camera.position.copy(camA.pos);
    setFov(WALK_FOV);
  }
}

// ------------------------------------------------------------
// セーブとロード
// ------------------------------------------------------------
const SLOT_KEY = (n) => `yuunagi_save_${n}`;
function readSlot(n) {
  try { return JSON.parse(localStorage.getItem(SLOT_KEY(n))); } catch (e) { return null; }
}
function fmtTime(ms) {
  const d = new Date(ms);
  const p = (v) => String(v).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fillSlots(forLoad) {
  const ul = $('slots-menu');
  ul.innerHTML = '';
  for (let n = 1; n <= 3; n++) {
    const s = readSlot(n);
    const li = document.createElement('li');
    li.dataset.act = String(n);
    li.textContent = s ? `${n}　${AREAS[s.area].name}　${fmtTime(s.time)}` : `${n}　―― 空き ――`;
    if (forLoad && !s) li.classList.add('disabled');
    ul.appendChild(li);
  }
  return ul;
}
function hasAnySave() { return [1, 2, 3].some((n) => readSlot(n)); }

async function saveMenu() {
  $('slots-title').textContent = 'セーブ';
  $('slots').classList.remove('hidden');
  for (;;) {
    const r = await runMenu(fillSlots(false));
    if (!r) break;
    const n = Number(r);
    if (readSlot(n) && !(await confirmBox(`${n}番に上書きしますか？`))) continue;
    localStorage.setItem(SLOT_KEY(n), JSON.stringify({ area: areaId, x: player.x, z: player.z, yaw: player.yaw, flags, time: Date.now() }));
    snd.blip('ok');
    fillSlots(false);
    await sleep(250);
    break;
  }
  $('slots').classList.add('hidden');
}

async function loadMenu() {
  $('slots-title').textContent = 'ロード';
  $('slots').classList.remove('hidden');
  let picked = null;
  for (;;) {
    const r = await runMenu(fillSlots(true));
    if (!r) break;
    if (await confirmBox(`${r}番をロードしますか？`)) { picked = readSlot(Number(r)); break; }
  }
  $('slots').classList.add('hidden');
  return picked;
}

async function startFromSave(s) {
  scriptToken++;
  handler = null;
  mode = 'script';
  hideMsg();
  $('pause').classList.add('hidden');
  await fade(1, 600);
  $('title').classList.add('hidden');
  festival.stop();
  flags = { ...s.flags };
  resetChars();
  loadArea(s.area, AREA_BGM[s.area]);
  player.x = s.x; player.z = s.z; player.yaw = s.yaw; player.pitch = 0;
  fixedCam = null;
  talkTo = null;
  talkBlend = 0; lastTalk = null;
  await fade(0, 800);
  showBanner();
  mode = 'walk';
}

// ------------------------------------------------------------
// メニュー（歩いているときの Esc）
// ------------------------------------------------------------
async function openPause() {
  mode = 'menu';
  $('prompt').classList.add('hidden');
  snd.blip();
  const pause = $('pause');
  pause.classList.remove('hidden');
  let start = 0;
  for (;;) {
    const r = await runMenu($('pause-menu'), { start });
    if (r === 'save') { start = 1; pause.classList.add('hidden'); await saveMenu(); pause.classList.remove('hidden'); continue; }
    if (r === 'load') {
      start = 2;
      pause.classList.add('hidden');
      const s = await loadMenu();
      if (s) { await startFromSave(s); return; }
      pause.classList.remove('hidden');
      continue;
    }
    if (r === 'help') { start = 3; await showHelp(); continue; }
    if (r === 'title') {
      start = 4;
      if (await confirmBox('タイトルへもどりますか？')) { pause.classList.add('hidden'); await showTitle(); return; }
      continue;
    }
    break; // つづける / Esc
  }
  pause.classList.add('hidden');
  mode = 'walk';
}

function showHelp() {
  return new Promise((resolve) => {
    $('help').classList.remove('hidden');
    handler = (code) => {
      if (isOk(code) || isCancel(code) || code === 'Click') {
        $('help').classList.add('hidden');
        handler = null;
        resolve();
      }
    };
  });
}

// ------------------------------------------------------------
// タイトル
// ------------------------------------------------------------
async function showTitle() {
  scriptToken++;
  mode = 'title';
  handler = null;
  hideMsg();
  $('choices').classList.add('hidden');
  $('prompt').classList.add('hidden');
  $('banner').classList.add('hidden');
  await fade(1, 500);
  festival.stop();
  fixedCam = null;
  talkTo = null;
  talkBlend = 0; lastTalk = null;
  flags = {};
  resetChars();
  loadArea('park');
  snd.setAmbient(null);
  bgm.play('hiroba'); // タイトルは広場の曲
  player.x = 0; player.z = 10.5; player.yaw = 0; player.pitch = 0;
  const title = $('title');
  title.classList.remove('hidden');
  const loadLi = title.querySelector('[data-act="load"]');
  await fade(0, 600);
  for (;;) {
    loadLi.classList.toggle('disabled', !hasAnySave());
    const r = await runMenu($('title-menu'), { cancel: false });
    if (r === 'new') {
      bgm.stop(900); // 冒頭の文は曲なし（環境の音だけ）
      await fade(1, 700);
      title.classList.add('hidden');
      flags = {};
      resetChars();
      runScript('prologue');
      return;
    }
    if (r === 'load') {
      title.classList.add('hidden');
      const s = await loadMenu();
      if (s) { await startFromSave(s); return; }
      title.classList.remove('hidden');
      continue;
    }
    if (r === 'quit') {
      window.close();
    }
  }
}

// ------------------------------------------------------------
// 毎フレーム
// ------------------------------------------------------------
function frame() {
  timer.update();
  const dt = Math.min(0.05, timer.getDelta());
  time += dt;
  if (area) {
    if (mode === 'walk') walkUpdate(dt);
    area.update(time);
    for (const [cid, ch] of Object.entries(chars)) if (charArea[cid] === areaId) ch.update(dt);
    updateCamera(dt);
    festival.update(time, dt);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------
// はじまり
// ------------------------------------------------------------
async function boot() {
  const ld = $('loading');
  areas.park = buildPark();
  areas.lake = buildLake();
  const ids = Object.keys(CHARAS);
  const prog = {};
  const show = () => {
    const v = ids.reduce((a, id) => a + (prog[id] || 0), 0) / ids.length;
    ld.textContent = `よみこみ中… ${Math.round(v * 100)}%`;
  };
  await Promise.all(ids.map(async (id) => {
    chars[id] = await Chara.load(CHARAS[id].model, (e) => { if (e.total) { prog[id] = e.loaded / e.total; show(); } });
  }));
  resetChars();
  // 最初の描画で重い準備を済ませておく
  loadArea('lake');
  scene.add(chars.kaho.root);
  updateCamera(0);
  renderer.compile(scene, camera);
  loadArea('park');
  snd.setAmbient(null);
  ld.classList.add('hidden');
  requestAnimationFrame(frame);
  window.__game = { player, flags: () => flags, chars, get mode() { return mode; }, runScript, loadArea, camera, renderer, scene, areas, get area() { return area; }, get music() { return bgm.state(); }, seekMusicEnd: bgm.debugSeekEnd };
  await showTitle();
}

boot().catch((e) => {
  $('loading').textContent = '読みこみに失敗しました：' + e.message;
  console.error(e);
});
