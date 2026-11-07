// 2つの場所（丘の上の広場、湖のほとり）を、three.js の基本の形だけで組み立てる。
// 朝の、おとぎ話のような可愛い村。外の素材は使わない。
import * as THREE from 'three';

const mats = {};
// 景色は、光だけだと決めた色より暗く、くすんで写る。色の一部を自分で光らせて、アニメらしい明るい色にする。
// 人物（VRM）の明るさには影響しない
const GLOW = 0.32;
function mat(key, opts) {
  if (!mats[key]) {
    const o = { ...opts };
    if (o.emissive === undefined && o.color !== undefined) { o.emissive = o.color; o.emissiveIntensity = GLOW; }
    mats[key] = new THREE.MeshLambertMaterial(o);
  }
  return mats[key];
}
const C = {
  grass: 0x9fd67a, grass2: 0x8ccb6c, path: 0xf8e4d8, stone: 0xf1e6da,
  white: 0xfffaf4, pink: 0xf7a8c4, pink2: 0xfcd0de, mint: 0xa8e6cf, sky: 0x9fd3f2,
  lemon: 0xfff0a0, lav: 0xcdb8f0, red: 0xf07a8a, wood: 0xe7c79e,
  leaf: 0x7fcf7a, leaf2: 0x6fbf6e, trunk: 0xb08060, water: 0x8fd6ec,
};

function box(w, h, d, m, x, y, z, ry = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  return mesh;
}
function cyl(rt, rb, h, m, x, y, z, seg = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.position.set(x, y, z);
  return mesh;
}
function ball(r, m, x, y, z, seg = 12) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4)), m);
  mesh.position.set(x, y, z);
  return mesh;
}
function cone(r, h, m, x, y, z, seg = 12) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m);
  mesh.position.set(x, y, z);
  return mesh;
}
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// 朝の空。上は青、地平線は淡い桃色。
function makeSky(sunDir) {
  const geo = new THREE.SphereGeometry(400, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { sunDir: { value: sunDir.clone().normalize() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vDir; uniform vec3 sunDir;
      void main(){
        float h = vDir.y;
        vec3 top = vec3(0.40, 0.66, 0.95);
        vec3 mid = vec3(0.66, 0.84, 1.00);
        vec3 hor = vec3(1.00, 0.90, 0.88);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h));
        c = mix(c, top, smoothstep(0.18, 0.75, h));
        if (h < 0.0) c = mix(hor, vec3(0.80, 0.90, 0.95), smoothstep(0.0, -0.2, h));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        c += vec3(1.0, 0.95, 0.80) * pow(s, 10.0) * 0.35;
        c = mix(c, vec3(1.0, 0.99, 0.92), smoothstep(0.9988, 0.9995, s));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(geo, m);
  sky.renderOrder = -1;
  return sky;
}

// ふわふわの雲
function clouds(group, seed, count, radius, yMin, yMax) {
  const r = rng(seed);
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const geo = new THREE.SphereGeometry(1, 12, 8);
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2;
    const d = radius * (0.8 + r() * 0.3);
    const c = new THREE.Group();
    const n = 4 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const s = 5 + r() * 6;
      const b = new THREE.Mesh(geo, m);
      b.position.set((k - n / 2) * 6 + r() * 3, r() * 3, r() * 4);
      b.scale.set(s, s * 0.7, s);
      c.add(b);
    }
    c.position.set(Math.cos(a) * d, yMin + r() * (yMax - yMin), Math.sin(a) * d);
    c.lookAt(0, c.position.y, 0);
    group.add(c);
  }
}

function makeLights(group, sunDir) {
  group.add(new THREE.HemisphereLight(0xfff8f0, 0xb0d0a0, 1.4));
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.2);
  sun.position.copy(sunDir).multiplyScalar(50);
  group.add(sun);
}

// まるい木（緑、または花の咲いた桃色）
function tree(group, x, z, s = 1, kind = 'green') {
  group.add(cyl(0.12 * s, 0.17 * s, 1.5 * s, mat('trunk', { color: C.trunk }), x, 0.75 * s, z, 8));
  const col = kind === 'pink' ? [0xf8bcd4, 0xfbd3e2] : [C.leaf, C.leaf2];
  group.add(ball(1.0 * s, mat('lf' + col[0], { color: col[0] }), x, 2.1 * s, z, 14));
  group.add(ball(0.72 * s, mat('lf' + col[1], { color: col[1] }), x + 0.55 * s, 2.5 * s, z - 0.2 * s, 12));
  group.add(ball(0.65 * s, mat('lf' + col[1], { color: col[1] }), x - 0.5 * s, 2.45 * s, z + 0.25 * s, 12));
}

// 花の群れ
const flowerStem = new THREE.CylinderGeometry(0.015, 0.015, 1, 4);
const flowerHead = new THREE.SphereGeometry(1, 6, 4);
function flowers(group, x, z, w, d, seed, n = 30, y0 = 0) {
  const r = rng(seed);
  const cols = [C.pink, 0xffffff, C.lemon, C.lav, 0xff9fb0];
  const stem = mat('stem', { color: 0x5faa58 });
  for (let i = 0; i < n; i++) {
    const fx = x + (r() - 0.5) * w, fz = z + (r() - 0.5) * d;
    const h = 0.18 + r() * 0.18;
    const st = new THREE.Mesh(flowerStem, stem);
    st.scale.y = h;
    st.position.set(fx, y0 + h / 2, fz);
    group.add(st);
    const col = cols[Math.floor(r() * cols.length)];
    const hd = new THREE.Mesh(flowerHead, mat('fl' + col, { color: col }));
    hd.scale.setScalar(0.07 + r() * 0.04);
    hd.position.set(fx, y0 + h, fz);
    group.add(hd);
  }
}

function bench(group, x, z, ry, color = C.mint) {
  const g = new THREE.Group();
  const wood = mat('bench' + color, { color });
  const leg = mat('benchleg', { color: C.white });
  g.add(box(1.6, 0.08, 0.45, wood, 0, 0.45, 0));
  g.add(box(1.6, 0.36, 0.06, wood, 0, 0.75, -0.2));
  g.add(box(0.07, 0.45, 0.45, leg, -0.7, 0.22, 0));
  g.add(box(0.07, 0.45, 0.45, leg, 0.7, 0.22, 0));
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  group.add(g);
}

// 白い柱に、まるい色の灯り
function lamp(group, x, z, col = C.pink2) {
  group.add(cyl(0.05, 0.07, 2.8, mat('lampPost', { color: C.white }), x, 1.4, z, 8));
  group.add(ball(0.22, mat('lampBall' + col, { color: col, emissive: col, emissiveIntensity: 0.35 }), x, 2.95, z, 12));
  group.add(cone(0.24, 0.18, mat('lampCap', { color: C.white }), x, 3.2, z, 12));
}

// 白い木の柵
function picket(group, x1, z1, x2, z2) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const ang = -Math.atan2(z2 - z1, x2 - x1);
  const m = mat('picket', { color: C.white });
  const rail = box(len, 0.06, 0.05, m, (x1 + x2) / 2, 0.5, (z1 + z2) / 2);
  rail.rotation.y = ang;
  group.add(rail);
  const n = Math.max(2, Math.round(len / 0.35));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = box(0.08, 0.7, 0.04, m, x1 + (x2 - x1) * t, 0.35, z1 + (z2 - z1) * t);
    p.rotation.y = ang;
    group.add(p);
  }
}

// 手すり（白と桃色）
function railing(group, x1, z1, x2, z2, y = 0) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const ang = -Math.atan2(z2 - z1, x2 - x1);
  const top = box(len, 0.08, 0.08, mat('railTop', { color: C.pink }), (x1 + x2) / 2, y + 1.0, (z1 + z2) / 2);
  top.rotation.y = ang;
  group.add(top);
  const n = Math.max(2, Math.round(len / 0.5));
  const white = mat('railPost', { color: C.white });
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    group.add(cyl(0.035, 0.035, 1.0, white, x1 + (x2 - x1) * t, y + 0.5, z1 + (z2 - z1) * t, 6));
  }
}

// おとぎ話の家：色の壁、とんがり屋根、まるい窓
function house(group, x, z, ry, w, d, h, wall, roof, seed) {
  const g = new THREE.Group();
  g.add(box(w, h, d, mat('wall' + wall, { color: wall }), 0, h / 2, 0));
  const r = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.9, 4), mat('roof' + roof, { color: roof }));
  r.position.y = h + h * 0.45;
  r.rotation.y = Math.PI / 4;
  g.add(r);
  const win = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  const frame = mat('frame', { color: C.white });
  for (const sx of [-w * 0.25, w * 0.25]) {
    const f = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), frame);
    f.position.set(sx, h * 0.62, d / 2 + 0.01);
    g.add(f);
    const wi = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), win);
    wi.position.set(sx, h * 0.62, d / 2 + 0.02);
    g.add(wi);
  }
  g.add(box(0.6, 1.0, 0.05, mat('door', { color: 0xc58b64 }), 0, 0.5, d / 2 + 0.02));
  if (rng(seed + 1)() > 0.5) g.add(box(0.3, 0.8, 0.3, mat('chim', { color: 0xe9b8a0 }), w * 0.25, h + h * 0.6, 0));
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  group.add(g);
  return g;
}

// きのこの家（小さな飾り）
function mushroom(group, x, z, s, capCol) {
  group.add(cyl(0.35 * s, 0.45 * s, 0.9 * s, mat('stemW', { color: C.white }), x, 0.45 * s, z, 14));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.8 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('cap' + capCol, { color: capCol }));
  cap.position.set(x, 0.85 * s, z);
  group.add(cap);
  const dot = mat('dot', { color: 0xffffff });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const dd = ball(0.1 * s, dot, x + Math.cos(a) * 0.55 * s, 0.85 * s + 0.45 * s, z + Math.sin(a) * 0.55 * s, 8);
    dd.scale.y = 0.4;
    group.add(dd);
  }
  group.add(box(0.28 * s, 0.45 * s, 0.05, mat('door', { color: 0xc58b64 }), x, 0.23 * s, z + 0.4 * s));
}

// あずまや（白い柱、桃色の屋根）
function gazebo(group, x, z) {
  const white = mat('gzW', { color: C.white });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    group.add(cyl(0.07, 0.07, 2.4, white, x + Math.cos(a) * 1.5, 1.2, z + Math.sin(a) * 1.5, 8));
  }
  group.add(cyl(1.75, 1.75, 0.12, white, x, 0.06, z, 6));
  group.add(cone(2.1, 1.3, mat('gzRoof', { color: C.pink }), x, 3.05, z, 6));
  group.add(ball(0.18, mat('gzTop', { color: C.lemon }), x, 3.8, z, 10));
}

// 旗の飾り（三角の旗を糸でつなぐ）
const flagGeo = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(-0.18, 0); shape.lineTo(0.18, 0); shape.lineTo(0, -0.38); shape.closePath();
  return new THREE.ShapeGeometry(shape);
})();
function bunting(group, x1, z1, x2, z2, y) {
  const cols = [C.pink, C.lemon, C.mint, C.sky, C.lav];
  const len = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.max(3, Math.round(len / 0.55));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(new THREE.Vector3(x1 + (x2 - x1) * t, y - Math.sin(t * Math.PI) * 0.5, z1 + (z2 - z1) * t));
  }
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffffff })));
  const ang = -Math.atan2(z2 - z1, x2 - x1);
  for (let i = 0; i < n; i++) {
    const p = pts[i].clone().lerp(pts[i + 1], 0.5);
    const col = cols[i % cols.length];
    const f = new THREE.Mesh(flagGeo, mat('flag' + col, { color: col, emissive: col, emissiveIntensity: 0.3, side: THREE.DoubleSide }));
    f.position.copy(p);
    f.rotation.y = ang;
    group.add(f);
  }
}

// 遠くのお城
function castle(group, x, y, z, s) {
  const g = new THREE.Group();
  const wall = mat('cWall', { color: 0xfdf1f4 });
  const roof = mat('cRoof', { color: 0x9fb8f0 });
  const roof2 = mat('cRoof2', { color: C.pink });
  g.add(box(10, 6, 6, wall, 0, 3, 0));
  g.add(cyl(1.6, 1.6, 12, wall, 0, 6, 0, 16));
  g.add(cone(2.1, 5, roof2, 0, 14.5, 0, 16));
  for (const [tx, tz] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) {
    g.add(cyl(1.1, 1.1, 8, wall, tx, 4, tz, 14));
    g.add(cone(1.5, 3.4, roof, tx, 9.7, tz, 14));
  }
  g.position.set(x, y, z);
  g.scale.setScalar(s);
  group.add(g);
}

function farHills(group, list, y) {
  for (const [hx, hz, hs] of list) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(hs, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('farhill', { color: 0xb3dca0 }));
    hill.scale.y = 0.32;
    hill.position.set(hx, y, hz);
    group.add(hill);
  }
}

// 水（湖）。波を頂点でゆらす。
function makeWater(y, size, cx, cz, amp = 0.05) {
  const geo = new THREE.PlaneGeometry(size, size, 120, 120);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.MeshLambertMaterial({ color: C.water, emissive: C.water, emissiveIntensity: 0.38 });
  const w = new THREE.Mesh(geo, m);
  w.position.set(cx, y, cz);
  const base = geo.attributes.position.array.slice();
  w.userData.update = (t) => {
    const p = geo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      const x = base[i], z = base[i + 2];
      p[i + 1] = (Math.sin(x * 0.4 + t * 0.9) + Math.cos(z * 0.55 + t * 0.7)) * amp;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  };
  return w;
}

function makeSignBoard(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#fff6ee';
  x.fillRect(0, 0, 512, 128);
  x.strokeStyle = '#f29bbb';
  x.lineWidth = 10;
  x.strokeRect(6, 6, 500, 116);
  x.fillStyle = '#c0607e';
  x.font = 'bold 54px "Yu Gothic", "Meiryo", sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshLambertMaterial({ map: tex });
  const side = mat('signside', { color: 0xfff6ee });
  return new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 0.04), [side, side, side, side, m, m]);
}

function sign(group, text, x, z, ry) {
  const s = new THREE.Group();
  s.add(cyl(0.04, 0.04, 1.2, mat('lampPost', { color: C.white }), 0, 0.6, 0, 6));
  const b = makeSignBoard(text);
  b.position.set(0, 1.3, 0);
  s.add(b);
  s.position.set(x, 0, z);
  s.rotation.y = ry;
  group.add(s);
}

// ------------------------------------------------------------
// 丘の上の広場
// ------------------------------------------------------------
export function buildPark() {
  const g = new THREE.Group();
  const sunDir = new THREE.Vector3(0.55, 0.22, -1);
  g.add(makeSky(sunDir));
  clouds(g, 3, 14, 230, 25, 70);
  makeLights(g, sunDir);

  // 地面と小道
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(26, 29), mat('grass', { color: C.grass }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, 0, -1.75);
  g.add(grass);
  const path = mat('path', { color: C.path });
  const p1 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 28), path);
  p1.rotation.x = -Math.PI / 2;
  p1.position.set(0, 0.01, -2);
  g.add(p1);
  const p2 = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.2), path);
  p2.rotation.x = -Math.PI / 2;
  p2.position.set(6, 0.012, -8);
  g.add(p2);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(4.2, 32), path);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.011, -13.2);
  g.add(plaza);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.7, 32), mat('ring', { color: 0xf3c2c9 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.013, -13.2);
  g.add(ring);

  // 丘のふちと、見下ろす村と湖
  g.add(box(60, 30, 1.2, mat('cliff', { color: 0xa9c98a }), 0, -15, -16.8));
  const valley = new THREE.Mesh(new THREE.PlaneGeometry(140, 34), mat('valley', { color: C.grass2 }));
  valley.rotation.x = -Math.PI / 2;
  valley.position.set(0, -21, -34);
  g.add(valley);
  const lake = makeWater(-21.6, 1400, 0, -640, 0.06);
  g.add(lake);
  const r = rng(5);
  const walls = [0xfff3e6, 0xffe3ec, 0xe8f6ff, 0xfff8d6, 0xeafbe8];
  const roofs = [C.pink, C.sky, 0xff9f7a, C.lav, C.mint, C.red];
  for (let i = 0; i < 46; i++) {
    const x = -48 + r() * 96, z = -22 - r() * 22;
    const h = 2 + r() * 2.5;
    house(g, x, z, r() * 0.6 - 0.3, 2.4 + r() * 1.5, 2.4 + r() * 1.5, h, walls[i % walls.length], roofs[Math.floor(r() * roofs.length)], i).position.y = -21;
  }
  for (let i = 0; i < 30; i++) {
    const t = new THREE.Group();
    tree(t, 0, 0, 1.4, r() < 0.3 ? 'pink' : 'green');
    t.position.set(-55 + r() * 110, -21, -24 - r() * 22);
    g.add(t);
  }
  castle(g, -60, -21.6, -150, 1.6);
  farHills(g, [[90, -170, 40], [20, -200, 30], [-120, -190, 45]], -21.6);

  railing(g, -12, -16, 12, -16);

  // 白い柵で囲む（右の奥は階段の口を空ける）
  picket(g, -12.5, -16, -12.5, 12.5);
  picket(g, -12.5, 12.5, 12.5, 12.5);
  picket(g, 12.5, 12.5, 12.5, -6.6);
  picket(g, 12.5, -9.4, 12.5, -16);

  // 階段（右の奥。下へ続く）と花のアーチ
  const stone = mat('stone', { color: C.stone });
  const stone2 = mat('stone2', { color: 0xf7d5dc });
  for (let i = 0; i < 8; i++) g.add(box(0.45, 0.2, 2.6, i % 2 ? stone : stone2, 12.9 + i * 0.45, -0.1 - i * 0.2, -8));
  g.add(box(4, 1.2, 0.3, stone, 14.4, 0.0, -9.45));
  g.add(box(4, 1.2, 0.3, stone, 14.4, 0.0, -6.55));
  const archM = mat('arch', { color: C.white });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.12, 8, 24, Math.PI), archM);
  arch.position.set(12.6, 1.6, -8);
  arch.rotation.y = Math.PI / 2;
  g.add(arch);
  g.add(cyl(0.1, 0.1, 1.6, archM, 12.6, 0.8, -9.35, 8));
  g.add(cyl(0.1, 0.1, 1.6, archM, 12.6, 0.8, -6.65, 8));
  for (let i = 0; i < 16; i++) {
    const a = (i / 15) * Math.PI;
    const col = [C.pink, 0xffffff, C.lemon][i % 3];
    g.add(ball(0.14, mat('fl' + col, { color: col }), 12.6, 1.6 + Math.sin(a) * 1.35, -8 + Math.cos(a) * 1.35, 8));
  }
  sign(g, '↓ 湖のほとり', 11.6, -5.9, -Math.PI / 2);

  // 木、花壇、ベンチ、灯り、旗
  [[-8, 8, 1.1, 'green'], [-9, 1, 1.3, 'pink'], [8, 8, 1.2, 'pink'], [9, 2, 1, 'green'], [-10, -13, 1.2, 'pink'], [9.5, -13, 1.1, 'green'], [-4.5, 5.5, 0.9, 'green'], [5, -1.5, 0.85, 'pink']]
    .forEach(([x, z, s, k]) => tree(g, x, z, s, k));
  flowers(g, -6, 10, 4, 3, 1, 40);
  flowers(g, 6, 10.5, 4, 2.5, 2, 40);
  flowers(g, -10.5, -4, 2.5, 5, 3, 35);
  flowers(g, 7.5, -4.5, 4, 2.5, 4, 35);
  flowers(g, -6, -15, 6, 1.2, 5, 40);
  flowers(g, 7, -15, 6, 1.2, 6, 40);
  flowers(g, 2.6, 5, 1.2, 4, 7, 20);
  bench(g, -2.2, 3, Math.PI / 2, C.mint);
  bench(g, 2.2, -3, -Math.PI / 2, C.pink2);
  bench(g, -3.5, -14.2, 0.35, C.lemon);
  lamp(g, 1.8, 6, C.pink2);
  lamp(g, -1.8, -6, C.lemon);
  lamp(g, 3.5, -12, C.mint);
  lamp(g, 11.3, -10.2, C.lav);
  bunting(g, 1.8, 6, -1.8, -6, 2.8);
  bunting(g, -1.8, -6, 3.5, -12, 2.8);

  // 噴水、あずまや、きのこの家
  const fm = mat('fount', { color: 0xfde7ee });
  g.add(cyl(1.4, 1.5, 0.45, fm, -4, 0.22, -2, 20));
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.25, 20), new THREE.MeshLambertMaterial({ color: C.water, emissive: C.water, emissiveIntensity: 0.38 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(-4, 0.4, -2);
  g.add(water);
  g.add(cyl(0.15, 0.2, 0.9, fm, -4, 0.8, -2, 10));
  g.add(ball(0.32, mat('fountTop', { color: C.sky }), -4, 1.35, -2, 12));
  gazebo(g, -7.5, -8.5);
  mushroom(g, 8.5, -9.5, 1.4, C.red);
  mushroom(g, 10.3, 5.2, 1.0, C.pink);
  mushroom(g, -10.4, 9.8, 1.2, C.lav);

  const fog = new THREE.Fog(0xe8f0fa, 90, 560);

  return {
    group: g,
    fog,
    update: (t) => lake.userData.update(t),
    walk: [
      { x1: -12, z1: -15.2, x2: 12, z2: 12 },
      { x1: 11.9, z1: -9.1, x2: 14, z2: -6.9 },
    ],
    obstacles: [
      { x: -8, z: 8, r: 0.4 }, { x: -9, z: 1, r: 0.45 }, { x: 8, z: 8, r: 0.4 }, { x: 9, z: 2, r: 0.4 },
      { x: -10, z: -13, r: 0.45 }, { x: 9.5, z: -13, r: 0.4 }, { x: -4.5, z: 5.5, r: 0.35 }, { x: 5, z: -1.5, r: 0.35 },
      { x: -4, z: -2, r: 1.55 },
      { x: -2.2, z: 2.4, r: 0.4 }, { x: -2.2, z: 3.6, r: 0.4 },
      { x: 2.2, z: -2.4, r: 0.4 }, { x: 2.2, z: -3.6, r: 0.4 },
      { x: -3.5, z: -14.2, r: 0.75 },
      { x: 1.8, z: 6, r: 0.15 }, { x: -1.8, z: -6, r: 0.15 }, { x: 3.5, z: -12, r: 0.15 }, { x: 11.3, z: -10.2, r: 0.15 },
      { x: 11.6, z: -5.9, r: 0.15 },
      { x: -7.5, z: -8.5, r: 1.8 },
      { x: 8.5, z: -9.5, r: 1.2 }, { x: 10.3, z: 5.2, r: 0.85 }, { x: -10.4, z: 9.8, r: 1.0 },
      { x: 12.6, z: -9.35, r: 0.15 }, { x: 12.6, z: -6.65, r: 0.15 },
    ],
    zones: [{ id: 'stairs_down', x1: 13.2, z1: -9.1, x2: 14.2, z2: -6.9 }],
    walkSound: 'grass',
    ambient: 'park',
    heightAt: (x) => (x > 12.7 ? -(x - 12.7) * 0.44 : 0),
  };
}

// ------------------------------------------------------------
// 湖のほとり
// ------------------------------------------------------------
export function buildLake() {
  const g = new THREE.Group();
  const sunDir = new THREE.Vector3(0.6, 0.2, -1);
  g.add(makeSky(sunDir));
  clouds(g, 7, 16, 240, 22, 65);
  makeLights(g, sunDir);

  // 板の遊歩道
  const deck = mat('deck', { color: C.wood });
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(64, 6.4), deck);
  walk.rotation.x = -Math.PI / 2;
  walk.position.set(0, 0, 1);
  g.add(walk);
  const dl = mat('deckLine', { color: 0xd4b088 });
  // 板の継ぎ目は床から少し浮かせる。床と同じ高さだと、遠くでちらつく
  for (let x = -32; x <= 32; x += 1.2) g.add(box(0.03, 0.006, 6.4, dl, x, 0.006, 1));
  // 遊歩道のふち（湖の側の白い面）。上の面を床より少し下げる。床と同じ高さだと、重なってちらつく
  g.add(box(64, 1.0, 0.6, mat('edge', { color: C.white }), 0, -0.53, -2.3));

  // 湖、はすの葉
  const lake = makeWater(-0.9, 1400, 0, -640, 0.04);
  g.add(lake);
  const pad = mat('pad', { color: 0x8fd47f, side: THREE.DoubleSide });
  const pr = rng(12);
  for (let i = 0; i < 40; i++) {
    const px = -30 + pr() * 60, pz = -4 - pr() * 12, ps = 0.4 + pr() * 0.4, rot = pr() * 6, lotus = pr() < 0.35;
    if (Math.abs(px - 20) < 3) continue;
    const p = new THREE.Mesh(new THREE.CircleGeometry(ps, 14, 0.3, Math.PI * 1.85), pad);
    p.rotation.x = -Math.PI / 2;
    p.rotation.z = rot;
    p.position.set(px, -0.8, pz);
    g.add(p);
    if (lotus) g.add(ball(0.13, mat('lotus', { color: C.pink }), px, -0.72, pz, 8));
  }

  // 手すり（桟橋の口を空ける）
  railing(g, -32, -2, 18.5, -2);
  railing(g, 21.5, -2, 32, -2);

  // 桟橋
  // 桟橋の床は遊歩道の床（z -2.2 まで）と重ならないように、z -2.2 から先だけにする。重なるとちらつく
  const pier = new THREE.Mesh(new THREE.PlaneGeometry(3, 15.8), deck);
  pier.rotation.x = -Math.PI / 2;
  pier.position.set(20, 0.0, -10.1);
  g.add(pier);
  g.add(box(3, 0.25, 16, deck, 20, -0.17, -10)); // 厚み。上の面は床より下
  const postM = mat('post', { color: C.white });
  for (let z = -3; z >= -17; z -= 2.8) {
    // 杭の頭は床より少し下（床と同じ高さだと白い丸がちらつく）
    g.add(cyl(0.12, 0.12, 1.6, postM, 18.6, -0.84, z, 8));
    g.add(cyl(0.12, 0.12, 1.6, postM, 21.4, -0.84, z, 8));
  }
  railing(g, 18.5, -2, 18.5, -18);
  railing(g, 21.5, -2, 21.5, -18);
  railing(g, 18.5, -18, 21.5, -18);
  lamp(g, 18.75, -2.6, C.pink2);
  // 桟橋につないだ小さなボート
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('boat', { color: C.pink2, side: THREE.DoubleSide }));
  hull.scale.set(0.8, 0.45, 1.8);
  boat.add(hull);
  boat.add(box(1.3, 0.06, 0.25, mat('seat', { color: C.white }), 0, -0.05, 0));
  boat.position.set(23.2, -0.75, -9);
  g.add(boat);

  // 陸の側：花の土手と、可愛い家並み
  g.add(box(64, 0.5, 1.4, mat('bank', { color: C.grass }), 0, 0.25, 4.8));
  flowers(g, -14, 4.8, 34, 1, 21, 120, 0.5);
  flowers(g, 14, 4.8, 34, 1, 22, 120, 0.5);
  const walls = [0xfff3e6, 0xffe3ec, 0xe8f6ff, 0xfff8d6, 0xeafbe8, 0xf3eaff];
  const roofs = [C.pink, C.sky, 0xff9f7a, C.lav, C.mint, C.red];
  const r = rng(11);
  for (let i = 0; i < 18; i++) {
    const x = -32 + i * 3.7 + r() * 0.5;
    const h = 2.6 + r() * 1.6;
    house(g, x, 8.2 + r() * 0.8, Math.PI, 3.0, 3.0, h, walls[i % walls.length], roofs[(i * 5) % roofs.length], i + 30);
  }

  // 広場へ上がる階段（左の端）
  const stone = mat('stone', { color: C.stone });
  const stone2 = mat('stone2', { color: 0xf7d5dc });
  for (let i = 0; i < 10; i++) g.add(box(0.5, 0.25 * (i + 1), 2.6, i % 2 ? stone : stone2, -30.25 - i * 0.5, 0.125 * (i + 1), 1.5));
  g.add(box(5.2, 3.2, 0.3, stone, -32.5, 1.6, 0.05));
  g.add(box(5.2, 3.2, 0.3, stone, -32.5, 1.6, 2.95));
  sign(g, '↑ 丘の上の広場', -29.3, 3.6, Math.PI);

  // 向こう岸のお城と丘と木
  castle(g, 30, -0.9, -170, 2.2);
  farHills(g, [[-80, -180, 50], [120, -200, 55], [10, -230, 40]], -0.9);
  for (let i = 0; i < 24; i++) {
    const t = new THREE.Group();
    tree(t, 0, 0, 2.2, r() < 0.35 ? 'pink' : 'green');
    t.position.set(-90 + r() * 180, -0.9, -150 - r() * 30);
    g.add(t);
  }

  // ベンチ、灯り、旗、鉢植え
  bench(g, -18, 3.4, Math.PI, C.mint);
  bench(g, -4, 3.4, Math.PI, C.lemon);
  bench(g, 8, 3.4, Math.PI, C.pink2);
  bench(g, 27, 3.4, Math.PI, C.lav);
  const lampCols = [C.pink2, C.lemon, C.mint, C.lav, C.sky];
  [-24, -12, 0, 12, 24].forEach((x, i) => lamp(g, x, -1.4, lampCols[i]));
  bunting(g, -24, -1.4, -12, -1.4, 2.7);
  bunting(g, -12, -1.4, 0, -1.4, 2.7);
  bunting(g, 0, -1.4, 12, -1.4, 2.7);
  bunting(g, 12, -1.4, 24, -1.4, 2.7);
  const potCols = [C.pink2, C.sky, C.lemon, C.mint, C.lav];
  [-21, -9, 3, 15, 29].forEach((x, i) => {
    g.add(cyl(0.45, 0.35, 0.6, mat('pot' + i, { color: potCols[i] }), x, 0.3, 3.8, 12));
    flowers(g, x, 3.8, 0.6, 0.6, 40 + i, 14, 0.6);
  });

  const fog = new THREE.Fog(0xe8f0fa, 100, 600);
  return {
    group: g,
    fog,
    update: (t) => {
      lake.userData.update(t);
      boat.position.y = -0.75 + Math.sin(t * 1.2) * 0.04;
      boat.rotation.z = Math.sin(t * 0.9) * 0.03;
    },
    walk: [
      { x1: -30, z1: -1.6, x2: 32, z2: 3.0 },
      { x1: 18.9, z1: -17.6, x2: 21.1, z2: -1 },
      { x1: -32, z1: 0.4, x2: -29.5, z2: 2.6 },
    ],
    obstacles: [
      { x: -18, z: 3.4, r: 0.8 }, { x: -4, z: 3.4, r: 0.8 }, { x: 8, z: 3.4, r: 0.8 }, { x: 27, z: 3.4, r: 0.8 },
      { x: -24, z: -1.4, r: 0.15 }, { x: -12, z: -1.4, r: 0.15 }, { x: 0, z: -1.4, r: 0.15 }, { x: 12, z: -1.4, r: 0.15 }, { x: 24, z: -1.4, r: 0.15 },
      { x: -21, z: 3.8, r: 0.5 }, { x: -9, z: 3.8, r: 0.5 }, { x: 3, z: 3.8, r: 0.5 }, { x: 15, z: 3.8, r: 0.5 }, { x: 29, z: 3.8, r: 0.5 },
      { x: 18.75, z: -2.6, r: 0.15 }, { x: -29.3, z: 3.6, r: 0.15 },
    ],
    zones: [{ id: 'stairs_up', x1: -32, z1: 0.4, x2: -31.2, z2: 2.6 }],
    walkSound: 'wood',
    ambient: 'lake',
    heightAt: (x) => (x < -30 ? (-30 - x) * 0.5 : 0),
  };
}

// ------------------------------------------------------------
// 花まつり：下の村から風船がのぼり、花びらが舞う
// ------------------------------------------------------------
export class Festival {
  constructor(scene, onBell) {
    this.scene = scene;
    this.onBell = onBell;
    this.active = false;
    this.group = new THREE.Group();
    this.balloons = [];
    this.petals = null;
    this.next = 0;
    this.ballGeo = new THREE.SphereGeometry(0.55, 14, 10);
    this.lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.65, 0), new THREE.Vector3(0, -2, 0)]);
    this.lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  }
  start(t) {
    this.stop();
    this.active = true;
    this.scene.add(this.group);
    this.next = t;
    if (this.onBell) this.onBell();
    const n = 500;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = -14 + Math.random() * 28;
      pos[i * 3 + 1] = Math.random() * 12;
      pos[i * 3 + 2] = -32 + Math.random() * 26;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.petals = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffb7cf, size: 0.12, transparent: true, opacity: 0.95, depthWrite: false }));
    this.group.add(this.petals);
    for (let k = 0; k < 24; k++) this.spawn(-2 + Math.random() * 16);
  }
  stop() {
    this.active = false;
    this.scene.remove(this.group);
    this.group = new THREE.Group();
    this.balloons = [];
    this.petals = null;
  }
  update(t, dt) {
    if (!this.active) return;
    if (t > this.next && this.balloons.length < 90) {
      for (let k = 0; k < 4; k++) this.spawn();
      this.next = t + 0.35;
    }
    for (const b of this.balloons) {
      b.obj.position.y += b.v * dt;
      b.obj.position.x += (Math.sin(t * 0.8 + b.ph) * 0.4 + 0.3) * dt;
      b.obj.rotation.z = Math.sin(t * 1.3 + b.ph) * 0.15;
    }
    this.balloons = this.balloons.filter((b) => {
      if (b.obj.position.y > 45) { this.group.remove(b.obj); return false; }
      return true;
    });
    if (this.petals) {
      const p = this.petals.geometry.attributes.position.array;
      for (let i = 0; i < p.length; i += 3) {
        p[i] += (0.6 + Math.sin(t + i) * 0.3) * dt;
        p[i + 1] -= 0.7 * dt;
        p[i + 2] += Math.cos(t * 0.7 + i) * 0.2 * dt;
        if (p[i + 1] < -1 || p[i] > 15) { p[i] = -15 + Math.random() * 10; p[i + 1] = 8 + Math.random() * 6; }
      }
      this.petals.geometry.attributes.position.needsUpdate = true;
    }
  }
  spawn(y0) {
    const cols = [0xff9fbf, 0xfff08a, 0x9fe6c8, 0xa8d6ff, 0xcdb3ff, 0xffffff, 0xffb38a];
    const col = cols[Math.floor(Math.random() * cols.length)];
    const obj = new THREE.Group();
    const b = new THREE.Mesh(this.ballGeo, mat('balloon' + col, { color: col, emissive: col, emissiveIntensity: 0.55 }));
    b.scale.y = 1.2;
    obj.add(b);
    obj.add(new THREE.Line(this.lineGeo, this.lineMat));
    obj.position.set(-26 + Math.random() * 52, (y0 === undefined ? -2 + Math.random() * 4 : y0), -20 - Math.random() * 28);
    this.group.add(obj);
    this.balloons.push({ obj, v: 2.2 + Math.random() * 1.6, ph: Math.random() * 6 });
  }
}
