// 窓の外の世界（本物の 3D）。家のまわりに「外の世界」の別シーンを three.js で組み立て、家の中心から CubeCamera でキューブマップに焼く。
// 窓の板は、見る向きでキューブマップを引く（skyview.js / skyview_tsl.js。ボックス投影で窓の位置によるずれも補正）。
// 焼くのは「窓が見えてから、空いている時間に1回（昼・夜の2枚）」と、画質が「高」以上のときのゆっくりした雲の流れの更新（約9秒に1回・描いたときだけ）。
// 焼きあがるまでは今のシェーダーの景色（skysrc.js）を出し、焼けたらなめらかに切りかえる。失敗したら（あるいは ?ext=0 なら）今のシェーダーのまま。
// 置くもの：家の庭（outside.js の芝の島・木・植え込み・花・柵・街灯。家のまわりに見える庭と同じ形・同じ季節の葉の色）、島のむこうの草地と遠くの木立、山なみ、空（雲・太陽・月・星）。
// 昼（k=0）と夜（k=1）の庭の色は outside.js の時間帯の色（昼・夜）。朝は、昼と夜の2枚を night で混ぜる。天気（くもり・雨・雪）は、空の色・光・霧（遠くのかすみ）に反映する。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GPU, gpuPre, gpuDirty } from './scenegpu.js?v=202611211556';
import { SKY } from './skyview.js?v=202611211556';
import { outGardenBuild, outGardenTint, OUT_GY } from './outside.js?v=202611211556';

const Q = new URLSearchParams(location.search);
const EYE_H = 1.7;   // キューブマップを焼く高さ（地面から）
// ----- 乱数・ノイズ -----
const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const ih = (x, y) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
const sm01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function vn(x, y) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = ih(xi, yi), b = ih(xi + 1, yi), c = ih(xi, yi + 1), d = ih(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, y, oct) { let s = 0, a = .5; for (let i = 0; i < oct; i++) { s += a * vn(x, y); x = x * 2.03 + 3.1; y = y * 2.03 + 1.7; a *= .5; } return s; }
const lin = c => Math.pow(Math.max(0, c), 2.2), srgb = c => Math.pow(Math.max(0, c), 1 / 2.2);
const css = (r, g, b) => 'rgb(' + [r, g, b].map(v => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(',') + ')';

// ----- 時間帯の色（skysrc.js と同じ色）。k = 0 昼 〜 1 夜（.5 = 夕方）。ph = [昼, 夕方, 夜] の重み -----
const PAL = {
  hor: [[.70, .84, .95], [1, .66, .42], [.22, .26, .50]], mid: [[.26, .54, .90], [.76, .58, .72], [.09, .13, .34]], top: [[.05, .20, .62], [.22, .30, .60], [.035, .06, .20]],
  gnd: [[.68, .72, .78], [.64, .52, .52], [.07, .09, .16]], lit: [[1, .95, .84], [1, .55, .30], [.55, .66, 1]], amb: [[.60, .70, .84], [.54, .44, .58], [.13, .17, .34]]
};
const phase = k => { const wD = 1 - sm01(.1, .5, k), wN = sm01(.5, .9, k); return [wD, Math.max(1 - wD - wN, 0), wN]; };
const pick = (a, ph) => [0, 1, 2].map(c => a[0][c] * ph[0] + a[1][c] * ph[1] + a[2][c] * ph[2]);

// ----- 見た目の部品：色つき（頂点色）の形を作って、同じ材質のものを1つにまとめる -----
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
const C = h => new THREE.Color(h);
export function prep(g) {   // 頂点色・法線・UV だけにそろえる（まとめるため、インデックスもなくす）
  if (g.index) g = g.toNonIndexed();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}
// 色をつける：c = THREE.Color（りんかく）、f(x,y,z,nx,ny,nz) = 明るさの係数（なければ 1）
function paint(g, c, f) {
  const p = g.attributes.position, n = g.attributes.normal, a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const k = f ? f(p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)) : 1; a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
export function place(g, x, y, z, ry, sx, sy, sz) { _e.set(0, ry || 0, 0); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx == null ? 1 : sx, sy == null ? (sx == null ? 1 : sx) : sy, sz == null ? (sx == null ? 1 : sx) : sz); _m.compose(_p, _q, _s); g.applyMatrix4(_m); return g; }
const cy = (rt, rb, h, seg, c, f) => paint(prep(new THREE.CylinderGeometry(rt, rb, h, seg)), c, f);
// ふくらんだ葉のかたまり：球をすこしでこぼこに（法線はもとの球のまま＝なめらか）。上が明るく、下が暗く、ところどころ色むら
export function blob(r, c, seed, up, det) {
  const g = prep(new THREE.IcosahedronGeometry(1, det == null ? 2 : det)), p = g.attributes.position, n = g.attributes.normal, a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), dz = .86 + .28 * vn(x * 2.2 + seed, y * 2.2 + z * 2.2), sp = vn(x * 6 + seed * 3, z * 6 + y * 6);
    n.setXYZ(i, x, y, z); p.setXYZ(i, x * r * dz, y * r * dz * (up || 1), z * r * dz);
    const k = (.62 + .5 * (y * .5 + .5)) * (.88 + .24 * sp); a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k * (1 + .06 * y);
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}

// ----- 絵（canvas の模様）-----
function cvs(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
function ctex(c, rep, sRGB) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep, rep); t.anisotropy = 4; if (sRGB !== false) t.colorSpace = THREE.SRGBColorSpace; return t; }
function sunSpriteTex() { return ctex(cvs(256, 256, (c, w, h) => { let g = c.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.055, 'rgba(255,255,255,1)'); g.addColorStop(.075, 'rgba(255,255,255,.55)'); g.addColorStop(.16, 'rgba(255,255,255,.22)'); g.addColorStop(.4, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }), 0); }
function moonSpriteTex() {
  return ctex(cvs(256, 256, (c, w, h) => {
    let g = c.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,248,225,.5)'); g.addColorStop(.3, 'rgba(255,248,225,.14)'); g.addColorStop(1, 'rgba(255,248,225,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.beginPath(); c.arc(128, 128, 36, 0, 6.283); c.fillStyle = '#fffbe8'; c.fill(); c.save(); c.clip();
    [[-10, -8, 10], [12, 6, 12], [-4, 16, 7], [14, -14, 6], [-18, 8, 6]].forEach(([x, y, r]) => { c.beginPath(); c.arc(128 + x, 128 + y, r, 0, 6.283); c.fillStyle = 'rgba(190,180,150,.35)'; c.fill(); }); c.restore();
  }), 0);
}

// ----- 季節・天気 -----
export function season() { const ov = new URLSearchParams(location.search).get('season'); if (ov === 'green' || ov === 'spring' || ov === 'autumn' || ov === 'winter') return ov; const m = new Date().getMonth() + 1; return m >= 10 && m <= 11 ? 'autumn' : m === 3 || m === 4 ? 'spring' : m === 12 || m <= 2 ? 'winter' : 'green'; }
export const LEAF = { green: [0x4f9a3a, 0x3f8a46, 0x62a640, 0x2f7a44], autumn: [0x4f9a3a, 0xe0a030, 0xd8602a, 0x3f8a46, 0xe8c040], spring: [0x6fb04a, 0xf2b8c8, 0x5fa648, 0xf6d0da], winter: [0x4a8a44, 0x3a7a40, 0x5a9a4a, 0x2f6a40] };

// ================= 外の世界のシーン =================
// 組み立てる（形・材質を1回だけ作る）。状態（昼・夜・天気）は apply() で材質の色・光・空を変える。
// o = { hx, hz（家の半分の大きさ m）, lite（簡単版）, seed }
const BT = { cpu: 0, max: 0, mark: 0 };   // 組み立てにかかった時間（待ちをのぞく）と、いちばん長く止めた1区切り
const Y = () => { const n = performance.now(), d = n - BT.mark; BT.cpu += d; BT.max = Math.max(BT.max, d); return new Promise(r => setTimeout(() => { BT.mark = performance.now(); r(); }, 0)); };
async function build(o) {
  BT.cpu = BT.max = 0; BT.mark = performance.now();
  const R = rng(o.seed || 11), lite = !!o.lite, ss = season(), hx = o.hx, hz = o.hz, L = Math.max(hx, hz) + 5;   // L = 庭の島のはしまで（家の中心から）
  const scene = new THREE.Scene(), W = {};   // W = 状態で色を変える材質
  const lam = (extra) => new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, extra));
  W.leaf = lam(); W.bark = lam();   // 遠くの木だけ（庭は outside.js の庭をそのまま使う）
  const ob = { b: {} }; const add = (key, g) => { (ob.b[key] = ob.b[key] || []).push(g); };
  const meshes = [];
  const fin = (key, mat, shadow) => { if (!ob.b[key] || !ob.b[key].length) return; const g = mergeGeometries(ob.b[key], false); if (!g) return; const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = shadow !== false && !lite; if (shadow === 'r') { m.castShadow = false; m.receiveShadow = !lite; } scene.add(m); meshes.push(m); };

  // --- 庭：家のまわりの芝の島・木・植え込み・花・柵・街灯（outside.js が家の中と同じ庭を作る。家の中心を原点にして置く）---
  W.garden = outGardenBuild({ x0: -hx, x1: hx, z0: -hz, z1: hz }, o.door); scene.add(W.garden.group);
  // 島のむこうの草地（島のふちをかくして、遠くまで続く）と、雪
  W.far = new THREE.Mesh(new THREE.CircleGeometry(360, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6cc04a })); W.far.position.y = OUT_GY - .03; scene.add(W.far);
  W.snow = new THREE.Mesh(new THREE.CircleGeometry(360, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf4f7ff, transparent: true, opacity: 0, depthWrite: false })); W.snow.position.y = OUT_GY - .02; W.snow.visible = false; scene.add(W.snow);
  await Y();   // 区切りごとに間をあける（画面が止まらないように）
  // --- 木 ---
  const tree = (x, z, s, kind, far) => {
    const pal = LEAF[ss], tc = C(0x6b4a30);
    if (kind === 'pine') {   // もみの木（円すいを重ねる）
      add('bark', place(cy(.12 * s, .2 * s, 2 * s, 6, tc), x, s, z)); const c = C(0x2f6a44);
      for (let i = 0; i < 4; i++) { const r = (1.9 - i * .38) * s, g = prep(new THREE.ConeGeometry(r, 2.1 * s, 9)); paint(g, c, (xx, yy) => .55 + .6 * (yy / (2.1 * s) + .5)); add('leaf', place(g, x, (2.4 + i * 1.15) * s, z)); }
      return;
    }
    const h = (2.6 + R() * 1.2) * s; add('bark', place(cy(.13 * s, .24 * s, h, 7, tc, (xx, yy) => .8 + .3 * ((yy / h) + .5)), x, h / 2, z));
    const n = far ? 2 : lite ? 3 : 6, bc = C(pal[Math.floor(R() * pal.length)]);
    for (let i = 0; i < n; i++) { const a = R() * 6.283, rr = i ? (.7 + R() * .8) * s : 0, r = (1.35 + R() * .7) * s * (i ? .8 : 1.15), c = i && R() < .35 ? C(pal[Math.floor(R() * pal.length)]) : bc; add('leaf', place(blob(r, c, R() * 50, .9, far ? 1 : 2), x + Math.cos(a) * rr, h + .4 * s + (i ? R() * 1.2 * s : .5 * s), z + Math.sin(a) * rr)); }
  };

  await Y();   // 区切りごとに間をあける（画面が止まらないように）
  // 遠くの木立（家並みのうしろ）
  for (let i = 0; i < (lite ? 20 : 40); i++) { if (i % 10 === 9) await Y(); const a = R() * 6.283, d = L + 14 + R() * 90; tree(Math.cos(a) * d, Math.sin(a) * d, 1.6 + R() * 1.4, R() < .3 ? 'pine' : 'round', true); }

  for (const k of ['leaf', 'bark']) { fin(k, W[k]); await Y(); }

  await Y();   // 区切りごとに間をあける（画面が止まらないように）
  // --- 山なみ（3 層。遠いほど空の色にかすむ）---
  W.hills = [];
  [[330, 20, 38, 1.3], [395, 38, 60, 1.9], [455, 30, 50, 2.8]].forEach(([rad, base, amp, fq], li) => {
    const N = 240, pos = [], col = [], idx = [];
    for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, nx = Math.cos(a), nz = Math.sin(a); let r = 0, am = .5, p = a * fq * 3 + li * 7.3; for (let k = 0; k < 4; k++) { const n = vn(p, 3.7 + li); r += am * (1 - Math.abs(2 * n - 1) * .9); p = p * 2.1 + 7.3; am *= .5; } const h = base * .5 + amp * r * (.8 + .4 * vn(a * 9 + li, 1));
      pos.push(nx * rad, -10, nz * rad, nx * rad, h, nz * rad); col.push(1, 1, 1, 1, 1, 1); if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })); m.userData.li = li; scene.add(m); W.hills.push(m);
  });

  await Y();   // 区切りごとに間をあける（画面が止まらないように）
  // --- 空・太陽・月 ---
  const domeCv = document.createElement('canvas'); domeCv.width = lite ? 1024 : 2048; domeCv.height = lite ? 512 : 1024;
  const domeTex = new THREE.CanvasTexture(domeCv); domeTex.colorSpace = THREE.SRGBColorSpace; domeTex.generateMipmaps = false; domeTex.minFilter = THREE.LinearFilter;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 32), new THREE.MeshBasicMaterial({ map: domeTex, side: THREE.BackSide, fog: false, depthWrite: false })); dome.renderOrder = -10; scene.add(dome);
  W.dome = { cv: domeCv, tex: domeTex };
  W.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunSpriteTex(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false })); W.sun.scale.set(640, 640, 1); scene.add(W.sun);
  W.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonSpriteTex(), transparent: true, depthWrite: false, fog: false })); W.moon.scale.set(200, 200, 1); scene.add(W.moon);

  // --- 光 ---
  W.hemi = new THREE.HemisphereLight(0xffffff, 0x888866, 1); scene.add(W.hemi);
  W.dir = new THREE.DirectionalLight(0xffffff, 2); scene.add(W.dir, W.dir.target);
  scene.fog = new THREE.Fog(0xcfe0f0, 60, 420);
  W.lite = lite; W.L = L; W.o = o;
  await Y();
  return { scene, W, meshes };
}

// 状態（昼・夜・天気）を材質・光・空に反映する。k = 0 昼 〜 1 夜、wx = (くもり, 雨, 雪)、drift = 雲の流れ（秒）
function apply(B, k, wx, drift) {
  const { W } = B, ph = phase(k), cov = wx.x, gry = sm01(.55, 1, cov), snow = wx.z, rain = wx.y, lite = W.lite;
  const hor = pick(PAL.hor, ph), mid = pick(PAL.mid, ph), top = pick(PAL.top, ph), gc = pick(PAL.gnd, ph), lc = pick(PAL.lit, ph), ac = pick(PAL.amb, ph);
  const horG = hor.map((v, i) => v + (gc[i] - v) * gry * .6);
  // 方向（太陽・月）：窓の向きを見て、見える向きに
  const az = SUN_AZ, el = 20 - ph[1] * 14 - ph[2] * 20;
  const sunDir = new THREE.Vector3(Math.cos(az) * Math.cos(el * Math.PI / 180), Math.sin(el * Math.PI / 180), Math.sin(az) * Math.cos(el * Math.PI / 180));
  const moonDir = new THREE.Vector3(Math.cos(az + .55) * Math.cos(.62), Math.sin(.62), Math.sin(az + .55) * Math.cos(.62));
  const night = ph[2] > .5;
  // 光
  const lightDir = (night ? moonDir : sunDir).clone().multiplyScalar(160);
  W.dir.position.copy(lightDir); W.dir.target.position.set(0, 0, 0);
  const dc = C(0xffffff), I = (a, b, c) => a * ph[0] + b * ph[1] + c * ph[2];
  dc.setRGB(lin(I(1, 1, .55)), lin(I(.95, .62, .66)), lin(I(.84, .36, 1))); W.dir.color.copy(dc);
  W.dir.intensity = I(3.0, 2.6, 1.8) * (1 - gry * .72 - rain * .1) * (1 - sm01(.35, .65, k) * 0) * (ph[2] > .5 ? 1 : 1);
  W.hemi.color.setRGB(lin(ac[0] * 1.15 * (1 + ph[2] * .9)), lin(ac[1] * 1.15 * (1 + ph[2] * .9)), lin(ac[2] * 1.2 * (1 + ph[2] * .7))); W.hemi.groundColor.setRGB(lin(I(.6, .45, .12)), lin(I(.55, .38, .14)), lin(I(.42, .34, .22)));
  W.hemi.intensity = I(2.2, 2.4, 2.1) * (1 + gry * .3);
  // 霧（遠くのかすみ。雨・雪・くもりは濃く）
  const hz = horG.map(srgb2lin); B.scene.fog.color.setRGB(hz[0], hz[1], hz[2]); B.scene.fog.near = 40 - gry * 14 - rain * 12; B.scene.fog.far = 400 - gry * 160 - rain * 120 - snow * 120;
  // 庭：昼（k=0）・夜（k=1）の色は、家のまわりの庭（outside.js）と同じ。島のむこうの草地も、庭の芝の色に合わせる
  outGardenTint(W.garden, k);
  // 雪：地面が白く
  W.snow.visible = snow > .05; W.snow.material.opacity = Math.min(.92, snow * 1.1); W.leaf.color.setScalar(1 + snow * .3);
  W.garden.mats.grass.color.lerp(_w, Math.min(.85, snow));
  W.far.material.color.copy(W.garden.mats.grass.color);
  // 山：遠いほどかすむ
  W.hills.forEach(m => {
    const li = m.userData.li, bodies = [[.40, .52, .72], [.30, .48, .56], [.27, .50, .32]][li], hk = [.5, .3, .1][li] + gry * .25 + rain * .15, mul = 1 - ph[2] * .75, a = m.geometry.attributes.color, p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const hgt = p.getY(i), t = hgt < 0 ? 1 : 0; const b = [0, 1, 2].map(c => lin(bodies[c]) * mul * (1 + .25 * Math.min(1, hgt / 50)) * (1 - (li ? 0 : 0))); const f = hk + (1 - hk) * .5 * Math.max(0, 1 - hgt / 70); const hh = hor.map(lin); a.setXYZ(i, b[0] + (hh[0] - b[0]) * f, b[1] + (hh[1] - b[1]) * f, b[2] + (hh[2] - b[2]) * f); void t; }
    a.needsUpdate = true;
  });
  // 空の絵
  paintSky(W.dome, k, ph, cov, gry, hor, mid, top, gc, lc, ac, sunDir, moonDir, drift, lite);
  W.dome.tex.needsUpdate = true;
  // 太陽・月
  W.sun.position.copy(sunDir).multiplyScalar(440); W.moon.position.copy(moonDir).multiplyScalar(440);
  const sunA = (1 - sm01(.5, .62, k)) * (1 - gry * .9), moonA = sm01(.45, 1, k) * (1 - gry * .8);
  const sc = [lin(I(1, 1, 1)), lin(I(.93, .5, 1)), lin(I(.74, .24, 1))]; W.sun.material.color.setRGB(Math.pow(sc[0], .45), Math.pow(sc[1], .45), Math.pow(sc[2], .45)); W.sun.material.opacity = sunA; W.sun.visible = sunA > .01;
  W.moon.material.opacity = moonA; W.moon.visible = moonA > .01; W.moon.material.color.setRGB(1, 1, 1);
}
const _w = new THREE.Color(1, 1, 1);
const srgb2lin = c => Math.pow(Math.max(0, c), 2.2);

// 空の絵（等距円筒図法の canvas。球にはる）：グラデーション・夕やけ・星・雲
function paintSky(D, k, ph, cov, gry, hor, mid, top, gc, lc, ac, sunDir, moonDir, drift, lite) {
  const cv = D.cv, W = cv.width, H = cv.height, c = cv.getContext('2d');
  // 縦のグラデーション（上＝天頂、まんなか＝地平線、下は地面の下なので地平線の色）
  const g = c.createLinearGradient(0, 0, 0, H), N = 28;
  for (let i = 0; i <= N; i++) {
    const v = i / N, el = (.5 - v) * Math.PI, sy = Math.max(0, Math.sin(el)) * 1.7, u = 1 - Math.exp(-sy * 1.15), a = sm01(0, .62, u), b = sm01(.38, .95, u);
    let col = [0, 1, 2].map(ch => (hor[ch] + (mid[ch] - hor[ch]) * a) * (1 - b) + top[ch] * b);
    col = col.map((x, ch) => x + (gc[ch] - x) * gry * .85);
    g.addColorStop(v, css(col[0], col[1], col[2]));
  }
  c.globalCompositeOperation = 'source-over'; c.fillStyle = g; c.fillRect(0, 0, W, H);
  // 夕やけ：太陽のほうの地平線ぞいにあかね色
  const az = a2u(sunDir), ex = ph[1] * .7 * (1 - gry * .5);
  if (ex > .02) { const gx = az * W; for (const dx of [0, -W, W]) { c.save(); c.translate(gx + dx, H * .5); c.scale(3.2, 1); const rg = c.createRadialGradient(0, 0, 0, 0, 0, H * .26); rg.addColorStop(0, 'rgba(250,118,56,' + .75 * ex + ')'); rg.addColorStop(.5, 'rgba(250,150,90,' + .3 * ex + ')'); rg.addColorStop(1, 'rgba(250,150,90,0)'); c.fillStyle = rg; c.fillRect(-W, -H * .3, W * 2, H * .3); c.restore(); } }
  // 星（夜に近づくとあらわれる）
  const sa = sm01(.3, .9, k) * (1 - gry);
  if (sa > .02) { const r = rng(77); const n = lite ? 500 : 1200; for (let i = 0; i < n; i++) { const u = r(), vv = r() * .47, hh = r(), s = (.6 + hh * hh * 1.8) * (W / 2048) * 1.4; const xx = u * W, yy = vv * H, a = (.35 + .65 * hh) * sa * (vv < .42 ? 1 : (.47 - vv) / .05); c.fillStyle = hh > .7 ? 'rgba(255,225,185,' + a + ')' : 'rgba(215,230,255,' + a + ')'; c.beginPath(); c.arc(xx, yy, s, 0, 6.283); c.fill(); } }
  // 雲
  const cw = lite ? 512 : 768, ch = cw >> 1, cc = D.cc || (D.cc = document.createElement('canvas')); cc.width = cw; cc.height = ch; const cx = cc.getContext('2d'), im = cx.createImageData(cw, ch), d = im.data;
  const litc = lc.map(lin), acl = ac.map(lin), thr = .63 - .27 * cov, off = drift * .05;
  const ld = [sunDir.x, sunDir.z]; const lm = Math.hypot(ld[0], ld[1]) || 1; ld[0] /= lm; ld[1] /= lm;
  const nightK = ph[2];
  for (let j = 0; j < ch * .5; j++) {
    const th = (j + .5) / ch * Math.PI, dy = Math.cos(th), sh = Math.sin(th); if (dy < .02) continue;
    for (let i = 0; i < cw; i++) {
      const phi = (i + .5) / cw * Math.PI * 2, dx = -Math.cos(phi) * sh, dz = Math.sin(phi) * sh, s = 1 / (dy + .2), qx = dx * s * 1.5 + off, qz = dz * s * 1.5;
      const dn = fbm(qx, qz, lite ? 4 : 5), hf = sm01(.02, .2, dy);
      let cd = dn - thr + (.12 - gry * .1) * (1 - dy), a = sm01(0, .16, cd) * hf;
      a = Math.max(a, gry * .8 * sm01(.05, .45, dy) * (.65 + .35 * dn));
      if (a < .004) continue;
      const d2 = fbm(qx + ld[0] * .22, qz + ld[1] * .22, 4), lit = Math.min(1, Math.max(0, .55 + (cd - (d2 - thr + (.12 - gry * .1) * (1 - dy))) * 3.4));
      const rim = 1 - sm01(0, .17, cd), body = 1 - nightK * .9, kk = lit * .78 * body;
      const col = [0, 1, 2].map(ch2 => srgb(acl[ch2] * .95 + litc[ch2] * kk + litc[ch2] * rim * (.5 + 2.2 * nightK) * (1 - gry * .6) * .5));
      const p = (j * cw + i) * 4; d[p] = Math.min(255, col[0] * 255); d[p + 1] = Math.min(255, col[1] * 255); d[p + 2] = Math.min(255, col[2] * 255); d[p + 3] = Math.min(1, a * .96) * 255;
    }
  }
  if (0) document.body.dataset.extCl = JSON.stringify({ litc, acl, thr, off, nightK, ld, px: Array.from(d.slice(4 * (cw * 40 + 100), 4 * (cw * 40 + 110))) });
  cx.putImageData(im, 0, 0); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(cc, 0, 0, cw, ch, 0, 0, W, H);
}
const a2u = v => { let phi = Math.atan2(v.z, -v.x); if (phi < 0) phi += Math.PI * 2; return phi / (Math.PI * 2); };

// ================= 管理（焼く・切りかえる） =================
const FADE_MS = Q.get('extfade') === '0' ? 1 : 900;   // 今のシェーダー → 3D の外の世界へ切りかえる長さ（確認用に ?extfade=0 で一瞬）
const SUN_AZ = Q.get('extaz') != null ? +Q.get('extaz') : 4.1;   // 太陽の向き（世界の座標。窓から見えるように）
const X = { on: false, dead: false, cubes: [null, null], cams: [null, null], size: 512, lite: false, hx: 4, hz: 4, hcx: 0, hcz: 0, built: null, builtKey: '', stale: true, step: 0, busy: false, want: false, hasWin: false, lastBake: 0, lastScan: 0, ready: false, fade: null, sunAz: 4.1, ctx: null, baking: false, t0: 0, ms: 0, mem: 0, phaseK: [0, 1], cb: null, timer: 0, dirtyBox: false };
const dbgK = Q.get('extk') != null ? Math.max(0, Math.min(1, +Q.get('extk'))) : null;
export const EXT = X;
const CU = () => GPU.on ? SKY.cubeG : SKY.cube;   // WebGPU のときは WebGPU 用の入れもの（サムネイルの WebGL の窓には、別の GPU のキューブマップを渡さない）

function newCube(size) {
  const opt = { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, colorSpace: THREE.SRGBColorSpace, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter };
  const g = GPU.on ? gpuPre() : null;
  const rt = g ? new g.WG.WebGLCubeRenderTarget(size, opt) : new THREE.WebGLCubeRenderTarget(size, opt);
  const cam = g ? new g.WG.CubeCamera(.3, 700, rt) : new THREE.CubeCamera(.3, 700, rt);
  cam.position.set(0, EYE_H, 0); cam.updateMatrixWorld(true);
  return { rt, cam };
}
function disposeBuilt() {
  const b = X.built; if (!b) return;
  b.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
  if (b.W.dome) b.W.dome.tex.dispose();
  if (b.W.garden) { const m = b.W.garden.mats; [m.grass.map, m.halo.map].forEach(t => t && t.dispose()); }
  X.built = null;
}
function disposeCubes() { X.cubes.forEach((c, i) => { if (c) { c.rt.dispose(); X.cubes[i] = null; } }); X.mem = 0; }
const bytesOf = size => size * size * 6 * 4 * 4 / 3;

// 外の世界の大きさ（家の大きさ）が変わったことを知らせる。box = { x0, z0, x1, z1 }
export function extHouse(box, door) {   // door = 玄関の外の1マスの中心（世界の座標。data.js の entryPoint）。庭の木・花を、家の外から見える庭と同じ場所に置くために使う
  if (!box) return;
  const hx = (box.x1 - box.x0) / 2, hz = (box.z1 - box.z0) / 2, cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2;
  const dr = door ? { x: door.x - cx, z: door.z - cz } : null, key = Math.round(hx * 2) + ',' + Math.round(hz * 2) + ',' + (dr ? Math.round(dr.x * 2) + ',' + Math.round(dr.z * 2) : '-');
  const moved = Math.abs(cx - X.hcx) > .01 || Math.abs(cz - X.hcz) > .01;
  X.hcx = cx; X.hcz = cz;
  if (key !== X.houseKey) { X.houseKey = key; X.hx = hx; X.hz = hz; X.door = dr; X.stale = true; if (X.ready) X.want = true; }
  else if (moved && X.ready) { setUniforms(); }
  setUniforms();
}
export function extLite(lite) { lite = !!lite || Q.get('extlite') === '1'; if (lite !== X.lite) { X.lite = lite; X.stale = true; if (X.ready) X.want = true; } }
function setUniforms() {
  const L = Math.max(X.hx, X.hz) + 4, B = L + 28;
  SKY.cube.ctr.value.set(X.hcx, EYE_H, X.hcz); SKY.cube.box.value.set(B, 70, B);
}
export function extInit(renderer, o) {
  X.renderer = renderer; X.mobile = !!(o && o.mobile); X.cb = (o && o.onDirty) || (() => {}); X.canBake = (o && o.canBake) || (() => true);
  X.size = Q.get('extsize') ? +Q.get('extsize') : X.mobile ? 512 : 1024;
  X.on = Q.get('ext') !== '0'; if (!X.on) return;
  try {
    // 8bit(sRGB) なので、特別な拡張は要らない
  } catch (e) { X.on = false; }
  
}
export function extOff(why) { if (X.dead) return; X.dead = true; X.on = false; X.why = String(why || '').slice(0, 60); CU().k.value = 0; CU().a.value = CU().b.value = null; try { disposeCubes(); disposeBuilt(); } catch (e) {} X.cb(); }

// 描くたびに呼ぶ（scene.js の drawFrame の最初）。窓が見えているか調べ、焼く予約・つなぎの動きをする。root = 家具の入れもの
export function extTick(now, root) {
  if (!X.on || X.dead) return;
  if (now - X.lastScan > 900) {
    X.lastScan = now; let f = false; if (root) root.traverse(o => { if (!f && o.isMesh && o.material && o.material.userData && o.material.userData.skyWin) f = true; });
    X.hasWin = f || Q.get('ext') === '1'; if (X.hasWin && !X.ready && !X.want) X.want = true;
  }
  // つなぎ（焼けたら、今のシェーダー → キューブマップへなめらかに）
  if (X.fade) { const p = Math.min(1, (now - X.fade.t0) / FADE_MS); CU().k.value = X.fade.from + (X.fade.to - X.fade.from) * p * p * (3 - 2 * p); if (GPU.on) gpuDirty(); X.cb(); if (p >= 1) X.fade = null; }   // WebGPU：動かない窓も、この回に値を読み直す（gpuDirty）
  // 雲を流す：高以上の画質で、窓が見えているとき、約9秒に1回だけ焼き直す（描いたときだけ）
  if (X.ready && !X.want && X.hasWin && !X.lite && !X.mobile && now - X.lastBake > 9000 && Q.get('extdrift') !== '0') { X.drift = true; X.want = true; }
  if (X.want && !X.busy && !X.baking) { X.busy = true; clearTimeout(X.timer); X.timer = setTimeout(run, X.ready ? 80 : 350); }
}
export function extPending() { return X.on && !X.dead && X.want && !X.ready; }
export async function extBakeNow() {
  if (!X.on || X.dead) return;
  while (X.baking) await new Promise(res => setTimeout(res, 30));
  if (!X.ready && X.want) { clearTimeout(X.timer); X.busy = true; await runNow(); }
}

function dayWx() { return SKY.wx.value; }
async function runNow() {
  if (X.baking) return; X.baking = true; X.busy = true;
  try {
    const t0 = performance.now(), r = X.renderer, drift = performance.now() / 1000 % 7200, wx = dayWx();
    // 外の世界を組み立てる（大きさ・画質が変わっていたら作りなおす）
    const key = X.houseKey + ',' + X.lite + ',' + (GPU.on ? 'g' : 'w') + ',' + X.size;
    if (!X.built || X.builtKey !== key) {
      disposeBuilt(); const bb = await build({ hx: X.hx, hz: X.hz, door: X.door, lite: X.lite, shadow: X.mobile ? 1024 : 2048, seed: 11 }); X.built = bb; X.builtKey = key;
      if (!X.cubes[0] || X.cubes[0].rt.width !== X.size || X.cubesGpu !== GPU.on) { disposeCubes(); X.cubes = [newCube(X.size), newCube(X.size)]; X.cubesGpu = GPU.on; X.mem = bytesOf(X.size) * 2; }
      X.tBuild = performance.now() - t0; X.needAll = true;
    }
    const ks = dbgK != null ? [dbgK, dbgK] : [0, 1];
    const nk = SKY.night.value, targets = X.needAll || !X.ready ? [0, 1] : (nk < .02 ? [0] : nk > .98 ? [1] : [0, 1]);
    let tPaint = 0, tDraw = 0;
    for (const i of targets) {
      const q0 = performance.now(); apply(X.built, ks[i], wx, drift); tPaint += performance.now() - q0;
      const c = X.cubes[i]; if (GPU.on) { /* WebGPU：同期の render でよい */ }
      const prevAuto = r.shadowMap.autoUpdate, tm = r.toneMapping, xr = r.xr.enabled;
      const q1 = performance.now(); try { r.toneMapping = THREE.NoToneMapping; c.cam.update(r, X.built.scene); } finally { tDraw += performance.now() - q1; r.toneMapping = tm; r.shadowMap.autoUpdate = prevAuto; r.xr.enabled = xr; }
      await new Promise(res => setTimeout(res, 0));   // 1枚ごとに間をあける（画面が止まらないように）
    }
    X.needAll = false; X.lastBake = performance.now(); X.ms = X.lastBake - t0;
    CU().a.value = X.cubes[0].rt.texture; CU().b.value = X.cubes[1].rt.texture; setUniforms();
    if (!X.ready) { X.ready = true; X.fade = { t0: performance.now(), from: CU().k.value, to: 1 }; }
    X.want = false; X.drift = false; if (GPU.on) gpuDirty(); X.cb(); window.__extInfo = X.info = { ms: Math.round(X.ms), build: Math.round(BT.cpu), chunkMax: Math.round(BT.max), buildWall: Math.round(X.tBuild || 0), paint: Math.round(tPaint), draw: Math.round(tDraw), size: X.size, memMB: Math.round(X.mem / 1048576), lite: X.lite, gpu: GPU.on, why: GPU.why, label: GPU.label };
  } catch (e) {
    console.error('exterior bake', e); extOff('bake:' + (e && e.message || e));
  } finally { X.baking = false; X.busy = false; }
}
function run() { if (!X.canBake()) { X.timer = setTimeout(run, 400); return; } runNow(); }   // 写真を撮っている間などは待つ（busy のまま）
