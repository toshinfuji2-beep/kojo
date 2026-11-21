// 引いて見たときの「外から見た家」（屋根・外壁・窓・玄関）。ふだん（寄っているとき）は、中を見せるための低い壁の断面のまま。
// カメラのズームがしきい値より引けたら、外壁が地面から立ち上がり、そのあと屋根が上からすっと降りてくる。寄りなおすと、屋根が上がって壁が沈む。
// ・屋根は家の形（rooms の和集合）から自動で作る寄棟（よせむね）。「ふちからの距離（L∞）× 勾配」の高さの面なので、1部屋でも、L字・コの字・増築でも破綻しない。
//   軒を .45 出し、鼻隠し（白）・軒天・棟と隅棟の瓦（かまぼこ形）・煙突を付ける。瓦の面は瓦の模様（段）の canvas。
// ・外壁は、家の外周の外側に薄い板（しっくい）を貼る。窓（ガラス・格子・額縁・窓台）・玄関ドア（庇のように奥まる）・灯り・石の土台・角の柱。
// ・できあがる動き（P：0→1 を、全部 P の関数で決める＝途中で向きが変わっても飛ばない）：外壁は角から4つの組が順に「ぽよん」と立ち上がり、窓・玄関はそのあと1つずつ「ぽん」と出る。
//   屋根は軒→瓦の面ごとに時間差で降りて着地でつぶれて戻り、棟→煙突が最後。着地で土ぼこり・きらきら・カメラの小さなゆれ（動きを減らす設定では出さない）。部品は作りなおさず、位置とスケールだけ変える。
// ・軽く：家の形が変わったときだけ作りなおし（あいた時間に1回。引く前に済ませておく）。材質ごとに1つにまとめる（外壁は組ごと・窓や玄関は1つずつ・屋根は面ごとに分けるので、draw call は 40 前後。三角形の数は同じ）。影は落とさない。止まっているときは描画を要求しない。
// ・scene.js が呼ぶ：roofInit(scene)・roofHouse(rooms)（家を組みなおしたとき）・roofTick(dt, want, snap)（毎フレーム。動いている間 true）・roofRise()（玄関ドアを閉じる割合）
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CFG, roomAt, houseBox, entranceOf } from './data.js?v=202611211556';
import { ANISO } from './textures.js?v=202611211556';

const WH = CFG.WALL_H, OT = .3, SH = .1, OV = .75, GS = .125, K = .66, FT = .05, DROP = .17;
const YTOP = WH + .35, YBOT = -.3, YE = WH + .4 - K * (OV - OT);   // 外壁の上と下／軒先の高さ（壁の線で、屋根の面が WH+.4 になる）
const LIFT = 7, SINK = YTOP - YBOT + .3, DUR = 1.45, DURB = 1.15;               // 屋根が浮いている高さ／外壁が沈んでいる深さ／切りかえにかかる秒
let G = null, shellG = null, roofG = null, want = false, P = 0, geos = [], builtKey = '', rooms0 = null, fresh = false, A = null;
const NB = 4, BD = .07, BL = .3, UD = .17, UL = .22, RS = .46, RL = .3, LF = .55, SQA = .06;   // 外壁の組の数・組どうしのずれ・立ち上がりの長さ／窓のずれ・長さ（P の割合）／屋根の始まり・長さ・落ちきる割合・着地のつぶれ
const mats = {};

// ----- 乱数・テクスチャ -----
const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const mk = (w, h, f) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; f(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = ANISO.v; return t; };
const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
// 瓦：6段。各段は、上が少し暗く（上の段のかげ）、下の縁が明るい。段ごとに半枚ずらす。1枚ずつ色がわずかに違う（u: 1枚=.25、v: 1段=1/6）
const tileTex = () => mk(256, 252, (c, W, H) => {
  const r = rng(7), rh = H / 6, tw = W / 4;
  c.fillStyle = '#4a2a22'; c.fillRect(0, 0, W, H);
  for (let row = 0; row < 6; row++) for (let k = -1; k < 5; k++) {
    const x = k * tw + (row % 2) * tw / 2, y = H - (row + 1) * rh, j = (r() - .5) * 22;
    const g = c.createLinearGradient(0, y, 0, y + rh); g.addColorStop(0, hex(88 + j, 56 + j * .7, 48 + j * .6)); g.addColorStop(.55, hex(112 + j, 70 + j * .7, 59 + j * .6)); g.addColorStop(1, hex(130 + j, 82 + j * .7, 68 + j * .6));
    c.fillStyle = g; c.fillRect(x + 1.5, y, tw - 3, rh - 2);
    c.fillStyle = 'rgba(255,225,190,.28)'; c.fillRect(x + 1.5, y + rh - 4, tw - 3, 2);        // 下の縁のつや
    c.fillStyle = 'rgba(30,12,8,.55)'; c.fillRect(x + 1.5, y + rh - 2, tw - 3, 2);            // 縁の下のかげ
    c.fillStyle = 'rgba(30,12,8,.32)'; c.fillRect(x, y, 2.4, rh); c.fillRect(x + tw - 1.2, y, 1.2, rh);   // 横のつぎめ
  }
});
const plasterTex = () => mk(128, 128, (c, W, H) => {
  const r = rng(11); c.fillStyle = '#e8dcc4'; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 700; i++) { const v = r(), x = r() * W, y = r() * H, s = 1 + r() * 2.2; c.fillStyle = v < .5 ? 'rgba(120,96,64,.07)' : 'rgba(255,250,235,.16)'; c.fillRect(x, y, s, s); }
});
const stoneTex = () => mk(256, 128, (c, W, H) => {
  const r = rng(5); c.fillStyle = '#6f6a62'; c.fillRect(0, 0, W, H);
  for (let row = 0; row < 4; row++) { let x = -r() * 30; const y = row * 32, h = 32; while (x < W) { const w = 40 + r() * 36, v = (r() - .5) * 26; c.fillStyle = hex(150 + v, 144 + v, 132 + v); c.fillRect(x + 2, y + 2, w - 4, h - 4); c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(x + 2, y + 2, w - 4, 3); x += w; } }
});
const brickTex = () => mk(128, 128, (c, W, H) => {
  const r = rng(3); c.fillStyle = '#c8bca8'; c.fillRect(0, 0, W, H);
  for (let row = 0; row < 8; row++) for (let k = -1; k < 4; k++) { const x = k * 32 + (row % 2) * 16, y = row * 16, v = (r() - .5) * 28; c.fillStyle = hex(168 + v, 84 + v * .6, 62 + v * .5); c.fillRect(x + 1.5, y + 1.5, 29, 13); }
});
const doorTex = () => mk(128, 256, (c, W, H) => {
  const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#b97f4c'); g.addColorStop(.5, '#c98e57'); g.addColorStop(1, '#b57a47'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(80,45,20,.22)'; c.lineWidth = 1; for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(i * 21.3, 0); c.lineTo(i * 21.3, H); c.stroke(); }
  c.strokeStyle = 'rgba(70,38,15,.55)'; c.lineWidth = 4; c.strokeRect(16, 16, 96, 90); c.strokeRect(16, 126, 96, 114); c.strokeStyle = 'rgba(255,225,180,.35)'; c.lineWidth = 2; c.strokeRect(20, 20, 88, 82); c.strokeRect(20, 130, 88, 106);
});
function materials() {
  if (mats.tile) return mats;
  const S = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: .85, metalness: 0 }, o));
  Object.assign(mats, {
    tile: S({ map: tileTex(), roughness: .72 }), ridge: S({ color: 0x57342b, roughness: .6 }), trim: S({ color: 0xf2ead8, roughness: .5 }), eave: S({ color: 0xa88a66, roughness: .8, side: THREE.DoubleSide }),
    plaster: S({ map: plasterTex(), roughness: .9 }), stone: S({ map: stoneTex(), roughness: .9 }), brick: S({ map: brickTex(), roughness: .9 }), door: S({ map: doorTex(), roughness: .6 }),
    glass: S({ color: 0x8fb6d2, roughness: .12, metalness: .15, emissive: 0x23405a, emissiveIntensity: .55 }), brass: S({ color: 0xd9b45a, roughness: .3, metalness: .8 }), dark: S({ color: 0x3c3532, roughness: .9 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffd98a })
  });
  return mats;
}

// ----- 形の部品（位置・法線・UV だけにそろえて、材質ごとにまとめる）-----
const prep = g => { if (g.index) g = g.toNonIndexed(); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k); return g; };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _y = new THREE.Vector3(0, 1, 0), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const boxG = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return prep(g); };
// 世界の座標で UV をふりなおす（模様の大きさをそろえる）
function worldUV(g, sc) {
  const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)); if (ay >= ax && ay >= az) u.setXY(i, p.getX(i) * sc, p.getZ(i) * sc); else if (ax >= az) u.setXY(i, p.getZ(i) * sc, p.getY(i) * sc); else u.setXY(i, p.getX(i) * sc, p.getY(i) * sc); }
  return g;
}
// となりあう辺の連なり（マス目の外周）。occ(i,j) = そのマスが家か。返り値 { d: 0=+x 1=-x 2=+z 3=-z の向き, c: 線の位置, a〜b: 線にそった範囲 }
function edgeRuns(occ, i0, i1, j0, j1) {
  const out = [], m = new Map(), add = (d, c, t) => { const k = d + ':' + c; let a = m.get(k); if (!a) m.set(k, a = []); a.push(t); };
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) if (occ(i, j)) {
    if (!occ(i + 1, j)) add(0, i + 1, j); if (!occ(i - 1, j)) add(1, i, j); if (!occ(i, j + 1)) add(2, j + 1, i); if (!occ(i, j - 1)) add(3, j, i);
  }
  m.forEach((ts, k) => { const [d, c] = k.split(':').map(Number); ts.sort((p, q) => p - q); let a = ts[0], p = a; for (let q = 1; q <= ts.length; q++) { const t = ts[q]; if (t !== p + 1) { out.push({ d, c, a, b: p + 1 }); a = t; } p = t; } });
  out.forEach(r => { const ins = t => r.d === 0 ? occ(r.c - 1, t) : r.d === 1 ? occ(r.c, t) : r.d === 2 ? occ(t, r.c - 1) : occ(t, r.c); r.cs = !ins(r.a - 1); r.ce = !ins(r.b); });   // cs/ce = 端が出っぱった角か（false = 入りこんだ角）
  return out;
}

// ===== 家を作る =====
function build(rooms) {
  const M = materials(), parts = {}, add = (k, g) => (parts[k] || (parts[k] = [])).push(g);
  const box = houseBox(rooms), ent = entranceOf(rooms), r8 = v => Math.round(v * 8) / 8;
  // ---- 動きの組：外壁は「家の手前左の角から」近い順に NB 個の組（bucket）、窓・玄関は1つずつの単位（unit）、屋根は面ごと ----
  const occH = (i, j) => roomAt(rooms, i, j) >= 0, runs = edgeRuns(occH, box.x0 - 1, box.x1 + 1, box.z0 - 1, box.z1 + 1);
  const wd = (x, z) => Math.hypot(x - box.x0, (z - box.z1) * .8), rcen = r => r.d < 2 ? [r.c, (r.a + r.b) / 2] : [(r.a + r.b) / 2, r.c];
  let dmin = 1e9, dmax = -1e9; runs.forEach(r => { const c = rcen(r); r.dd = wd(c[0], c[1]); dmin = Math.min(dmin, r.dd); dmax = Math.max(dmax, r.dd); });
  const bkOf = d => dmax > dmin + 1e-6 ? Math.max(0, Math.min(NB - 1, Math.round((d - dmin) / (dmax - dmin) * (NB - 1)))) : 0;
  const bodyP = Array.from({ length: NB }, () => ({})), units = [], addB = (k, g, b) => (bodyP[b][k] || (bodyP[b][k] = [])).push(g);
  const newUnit = (b, px, py, pz) => { const u = { b, px, py, pz, P: {} }; units.push(u); return u; }, addU = (u, k, g) => { g.translate(-u.px, -u.py, -u.pz); (u.P[k] || (u.P[k] = [])).push(g); };
  const clus = new Map(), chP = {};   // 瓦の面（向きごと）／煙突の部品

  // ---- 屋根：ふちからの距離（L∞）× 勾配の高さ。細かい格子（GS=.125）に距離を求め、粗い格子（.25）の面にする ----
  const fx0 = box.x0 - OV, fz0 = box.z0 - OV, NX = Math.round((box.w + 2 * OV) / GS), NZ = Math.round((box.d + 2 * OV) / GS), VX = NX + 1;
  const cell = new Uint8Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = fx0 + (i + .5) * GS, z = fz0 + (j + .5) * GS;
    for (const r of rooms) if (x > r.x - OV && x < r.x + r.w + OV && z > r.z - OV && z < r.z + r.d + OV) { cell[j * NX + i] = 1; break; }
  }
  const cf = (i, j) => (i < 0 || j < 0 || i >= NX || j >= NZ) ? 0 : cell[j * NX + i], D = new Float32Array(VX * (NZ + 1));
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) D[j * VX + i] = (cf(i - 1, j - 1) && cf(i, j - 1) && cf(i - 1, j) && cf(i, j)) ? 1e6 : 0;
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const o = j * VX + i; let v = D[o]; if (!v) continue; if (i > 0) v = Math.min(v, D[o - 1] + 1); if (j > 0) { v = Math.min(v, D[o - VX] + 1); if (i > 0) v = Math.min(v, D[o - VX - 1] + 1); if (i < NX) v = Math.min(v, D[o - VX + 1] + 1); } D[o] = v; }
  for (let j = NZ; j >= 0; j--) for (let i = NX; i >= 0; i--) { const o = j * VX + i; let v = D[o]; if (!v) continue; if (i < NX) v = Math.min(v, D[o + 1] + 1); if (j < NZ) { v = Math.min(v, D[o + VX] + 1); if (i < NX) v = Math.min(v, D[o + VX + 1] + 1); if (i > 0) v = Math.min(v, D[o + VX - 1] + 1); } D[o] = v; }
  const hOf = o => YE + K * D[o] * GS, SQ = Math.sqrt(1 + K * K);
  const vtx = (i, j) => { const o = j * VX + i; return { id: o, x: fx0 + i * GS, y: hOf(o), z: fz0 + j * GS, d: D[o] * GS }; };
  const tris = [];
  const tri = (p, q, r) => {
    if ((q.z - p.z) * (r.x - p.x) - (q.x - p.x) * (r.z - p.z) < 0) { const t = q; q = r; r = t; }   // 上向きの面に
    const ux = q.x - p.x, uy = q.y - p.y, uz = q.z - p.z, vx = r.x - p.x, vy = r.y - p.y, vz = r.z - p.z, nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
    const useZ = Math.abs(nx) > Math.abs(nz);   // 傾きが x 向きの面は、段が z にそう
    const ck = Math.abs(nx) > Math.abs(nz) ? (nx > 0 ? '+x' : '-x') : (nz > 0 ? '+z' : '-z'); let cl = clus.get(ck); if (!cl) clus.set(ck, cl = { pos: [], uv: [], sx: 0, sz: 0, n: 0 });
    [p, q, r].forEach(v => { cl.pos.push(v.x, v.y, v.z); cl.uv.push(useZ ? v.z : v.x, v.d * SQ); cl.sx += v.x; cl.sz += v.z; cl.n++; });
    tris.push({ v: [p, q, r], n: [nx / l, ny / l, nz / l] });
  };
  const NCX = NX / 2, NCZ = NZ / 2;
  for (let cj = 0; cj < NCZ; cj++) for (let ci = 0; ci < NCX; ci++) {
    if (!cell[(2 * cj) * NX + 2 * ci]) continue;
    const a = vtx(2 * ci, 2 * cj), b = vtx(2 * ci + 2, 2 * cj), c = vtx(2 * ci + 2, 2 * cj + 2), d = vtx(2 * ci, 2 * cj + 2), hc = hOf((2 * cj + 1) * VX + 2 * ci + 1);
    if (Math.abs((a.y + c.y) / 2 - hc) <= Math.abs((b.y + d.y) / 2 - hc)) { tri(a, d, c); tri(a, c, b); } else { tri(a, d, b); tri(b, d, c); }   // しわ（棟・隅棟・谷）の側の対角線で割る
  }
  // 棟・隅棟の瓦（かまぼこ形）：面と面が山折りになる辺
  const edges = new Map();
  tris.forEach((t, ti) => { for (let e = 0; e < 3; e++) { const p = t.v[e], q = t.v[(e + 1) % 3], k = Math.min(p.id, q.id) * 1e7 + Math.max(p.id, q.id); let l = edges.get(k); if (!l) edges.set(k, l = []); l.push([ti, e]); } });
  edges.forEach(l => {
    if (l.length !== 2) return; const A = tris[l[0][0]], B = tris[l[1][0]], dn = A.n[0] * B.n[0] + A.n[1] * B.n[1] + A.n[2] * B.n[2]; if (dn > .9995) return;
    const p = A.v[l[0][1]], q = A.v[(l[0][1] + 1) % 3], o = B.v[(l[1][1] + 2) % 3];   // o = B の、辺に乗っていない頂点
    if ((o.x - p.x) * A.n[0] + (o.y - p.y) * A.n[1] + (o.z - p.z) * A.n[2] > -1e-6) return;   // 谷（へこむ辺）には付けない
    _a.set(p.x, p.y, p.z); _b.set(q.x, q.y, q.z); const len = _a.distanceTo(_b) + .07, dir = _b.clone().sub(_a).normalize();
    const g = new THREE.CylinderGeometry(.065, .075, len, 7, 1, false); g.applyMatrix4(_m.compose(_a.clone().add(_b).multiplyScalar(.5).add(_y.clone().multiplyScalar(.035)), _q.setFromUnitVectors(_y, dir), new THREE.Vector3(1, 1, 1))); add('ridge', prep(g));
  });
  // 軒：鼻隠し（白い板）。外周の線にそって
  const occC = (i, j) => i >= 0 && j >= 0 && i < NCX && j < NCZ && cell[(2 * j) * NX + 2 * i] === 1;
  edgeRuns(occC, 0, NCX, 0, NCZ).forEach(r => {
    const sg = (r.d === 0 || r.d === 2) ? 1 : -1, L = (r.d < 2 ? fx0 : fz0) + r.c * .25, ta = (r.d < 2 ? fz0 : fx0) + r.a * .25 - (r.cs ? FT : 0), tb = (r.d < 2 ? fz0 : fx0) + r.b * .25 + (r.ce ? FT : 0), n = L + sg * FT / 2;
    const h = DROP + .03, y = YE - DROP + h / 2;
    addB('trim', r.d < 2 ? boxG(FT, h, tb - ta, n, y, (ta + tb) / 2) : boxG(tb - ta, h, FT, (ta + tb) / 2, y, n), bkOf(r.d < 2 ? wd(n, (ta + tb) / 2) : wd((ta + tb) / 2, n)));
  });
  // 軒天（のきの裏）：全体を1枚の平らな面（下向き）。段ごとにつなぐ
  { const sp = [], su = []; for (let cj = 0; cj < NCZ; cj++) { let i = 0; while (i < NCX) { if (!occC(i, cj)) { i++; continue; } let k = i; while (k < NCX && occC(k, cj)) k++; const x0 = fx0 + i * .25, x1 = fx0 + k * .25, z0 = fz0 + cj * .25, z1 = z0 + .25, y = YE - DROP; sp.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z0, x1, y, z1, x0, y, z1); [[x0, z0], [x1, z0], [x1, z1], [x0, z0], [x1, z1], [x0, z1]].forEach(([u, v]) => su.push(u * .5, v * .5)); i = k; } }
    if (sp.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2)); g.computeVertexNormals(); add('eave', g); } }
  // 煙突：屋根の後ろ側（-x,-z 寄り）の、棟から少し下がった所
  { let mx = 0; for (let o = 0; o < D.length; o++) mx = Math.max(mx, D[o]); mx *= GS;
    if (mx > 1.2) {
      let best = null, bv = 1e9; for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const dw = D[j * VX + i] * GS; if (dw >= mx * .45 && dw <= mx * .62 && dw >= .9) { const v = (fx0 + i * GS) + (fz0 + j * GS) + dw * .2; if (v < bv) { bv = v; best = [i, j]; } } }
      if (best) {
        const cx = fx0 + best[0] * GS, cz = fz0 + best[1] * GS, hs = .27, ys = [[-hs, -hs], [hs, -hs], [-hs, hs], [hs, hs]].map(([dx, dz]) => hOf(Math.min(NZ, Math.max(0, Math.round((cz + dz - fz0) / GS))) * VX + Math.min(NX, Math.max(0, Math.round((cx + dx - fx0) / GS)))));
        const y0 = Math.min(...ys) - .2, y1 = Math.max(...ys) + .75;
        chP.c = [cx, y0, cz]; const addC = (k, g) => { g.translate(-cx, -y0, -cz); (chP[k] || (chP[k] = [])).push(g); };
        addC('brick', worldUV(boxG(hs * 2, y1 - y0, hs * 2, cx, (y0 + y1) / 2, cz), .5));
        addC('cap', worldUV(boxG(hs * 2 + .12, .08, hs * 2 + .12, cx, y1 + .04, cz), .6)); addC('cap', worldUV(boxG(hs * 2 + .08, .06, hs * 2 + .08, cx, y1 - .3, cz), .6));
        addC('flue', boxG(hs * 2 - .14, .02, hs * 2 - .14, cx, y1 + .085, cz));
      }
    }
  }

  // ---- 外壁：家の外周（部屋の外壁の外面）の外側に、薄い板を貼る ----
  const WW = .9, WY0 = .9, WY1 = 2.3;   // 窓の幅・下・上
  runs.forEach(r => {
    const bk = bkOf(r.dd); let U = null; const put = (k, g) => U ? addU(U, k, g) : addB(k, g, bk);
    const sg = (r.d === 0 || r.d === 2) ? 1 : -1, xr = r.d >= 2, ex = xr ? OT : OT + SH;   // xr = x 方向に伸びる壁
    const ts = r.a + (r.cs ? -ex : ex), te = r.b + (r.ce ? ex : -ex), Ln = r.c + sg * OT;
    // 深さ（外面から外へ）da〜db の箱。ta〜tb = 壁にそった範囲
    const W = (part, ta, tb, ya, yb, da, db) => { if (tb - ta < .005 || yb - ya < .005) return; const n0 = Ln + sg * da, n1 = Ln + sg * db, nc = (n0 + n1) / 2, nl = Math.abs(n1 - n0), tc = (ta + tb) / 2, g = xr ? boxG(tb - ta, yb - ya, nl, tc, (ya + yb) / 2, nc) : boxG(nl, yb - ya, tb - ta, nc, (ya + yb) / 2, tc); put(part, part === 'plaster' ? worldUV(g, .4) : part === 'stone' ? worldUV(g, .8) : g); };
    const holes = [];
    const door = ent && r.d === 2 && r.c === rooms[ent.k].z + rooms[ent.k].d && rooms[ent.k].x + ent.x0 >= r.a && rooms[ent.k].x + ent.x1 <= r.b ? rooms[ent.k].x + (ent.x0 + ent.x1) / 2 : null;
    const L = r.b - r.a, n = Math.max(1, Math.floor((L + 1) / 2));
    for (let k = 0; k < n; k++) { const c = r.a + (k + .5) * L / n, t0 = c - WW / 2, t1 = c + WW / 2; if (t0 < ts + .12 || t1 > te - .12) continue; if (door != null && Math.abs(c - door) < .75 + WW / 2 + .2) continue; holes.push({ t0, t1, y0: WY0, y1: WY1, w: 1 }); }
    if (door != null) holes.push({ t0: door - .75, t1: door + .75, y0: .04, y1: 2.42, w: 0 });
    holes.sort((p, q) => p.t0 - q.t0);
    // しっくいの板（穴のまわり）
    let cur = ts; holes.forEach(h => { W('plaster', cur, h.t0, YBOT, YTOP, 0, SH); W('plaster', h.t0, h.t1, YBOT, h.y0, 0, SH); W('plaster', h.t0, h.t1, h.y1, YTOP, 0, SH); cur = h.t1; }); W('plaster', cur, te, YBOT, YTOP, 0, SH);
    // 石の土台（玄関の所は切る）と、軒の下の白い帯
    const band = (part, ya, yb, db, skipDoor) => { let c2 = ts; if (skipDoor && door != null) { W(part, c2, door - .75, ya, yb, 0, db); c2 = door + .75; } W(part, c2, te, ya, yb, 0, db); };
    band('stone', YBOT, .42, SH + .035, true); band('trim', .42, .5, SH + .05, true); band('trim', WH - .2, WH - .1, SH + .04, false);
    holes.forEach(h => {
      const tc = (h.t0 + h.t1) / 2, bw = .07, ym = (h.y0 + h.y1) / 2; U = xr ? newUnit(bk, tc, ym, Ln + sg * .05) : newUnit(bk, Ln + sg * .05, ym, tc);   // 窓・玄関は、自分の真ん中を支点に「ぽん」と出る単位
      W('trim', h.t0 - bw, h.t0, h.y0 - bw, h.y1 + bw, SH, SH + .028); W('trim', h.t1, h.t1 + bw, h.y0 - bw, h.y1 + bw, SH, SH + .028); W('trim', h.t0, h.t1, h.y1, h.y1 + bw, SH, SH + .028);   // 額縁
      if (h.w) {
        W('trim', h.t0 - .12, h.t1 + .12, h.y0 - .08, h.y0, 0, SH + .1);                                      // 窓台
        W('glass', h.t0, h.t1, h.y0, h.y1, .012, .03);                                                         // ガラス
        W('trim', tc - .02, tc + .02, h.y0, h.y1, .01, .05); W('trim', h.t0, h.t1, (h.y0 + h.y1) / 2 - .02, (h.y0 + h.y1) / 2 + .02, .01, .05);   // 格子
        W('trim', h.t0, h.t0 + .04, h.y0, h.y1, .01, .05); W('trim', h.t1 - .04, h.t1, h.y0, h.y1, .01, .05); W('trim', h.t0, h.t1, h.y1 - .04, h.y1, .01, .05); W('trim', h.t0, h.t1, h.y0, h.y0 + .04, .01, .05);   // 窓の枠
      } else {
        W('door', h.t0 + .03, h.t1 - .03, h.y0, h.y1 - .06, .02, .09);                                         // ドア（外壁の面より奥まる）
        W('trim', h.t0 - .25, h.t1 + .25, h.y1 + .1, h.y1 + .17, SH, SH + .3);                                  // 玄関の小さなひさし
        put('brass', worldUV(xr ? boxG(.07, .07, .09, tc + .5, 1.1, Ln + sg * .13) : boxG(.09, .07, .07, Ln + sg * .13, 1.1, tc + .5), 1));
        // 灯り（ドアの横）
        const lx = tc - 1.05, ly = 1.85; put('dark', xr ? boxG(.16, .3, .08, lx, ly, Ln + sg * (SH + .04)) : boxG(.08, .3, .16, Ln + sg * (SH + .04), ly, lx)); put('lamp', xr ? boxG(.1, .2, .1, lx, ly, Ln + sg * (SH + .045)) : boxG(.1, .2, .1, Ln + sg * (SH + .045), ly, lx));
      }
    });
  });
  // 外壁の角の柱（出っぱった角だけ）
  for (let gz = box.z0 - 1; gz <= box.z1 + 1; gz++) for (let gx = box.x0 - 1; gx <= box.x1 + 1; gx++) {
    const q = [occH(gx, gz), occH(gx - 1, gz), occH(gx, gz - 1), occH(gx - 1, gz - 1)]; if (q.filter(Boolean).length !== 1) continue;
    const sx = q[0] || q[2] ? -1 : 1, sz = q[0] || q[1] ? -1 : 1;   // 家の外へ向かう方向
    const px = gx + sx * (OT + SH + .02 - .085), pz = gz + sz * (OT + SH + .02 - .085); addB('trim', boxG(.17, YTOP - YBOT, .17, px, (YTOP + YBOT) / 2, pz), bkOf(wd(px, pz)));
  }
  const grp = new THREE.Group(), gs = new THREE.Group(), hold = [], MAT = { cap: M.stone, flue: M.dark }, anim = { bodies: [], units: [], roofs: [], chim: null, ev: [] }, hx = box.x0 + box.w / 2, hz = box.z0 + box.d / 2;
  const mesh = (k, gl, mat) => { const gm = mergeGeometries(gl); if (!gm) return null; const m = new THREE.Mesh(gm, mat); m.name = 'roof-' + k; m.frustumCulled = false; hold.push(gm); return m; };
  for (let b = 0; b < NB; b++) {   // 外壁：角から順の組。組ごとに1つの Group（材質ごとにまとめた mesh）
    const bg = new THREE.Group(); let any = false;
    Object.keys(bodyP[b]).forEach(k => { const m = mesh(k, bodyP[b][k], M[k]); if (m) { bg.add(m); any = true; } });
    if (any) { gs.add(bg); anim.bodies.push({ g: bg, b }); }
  }
  units.forEach(u => {   // 窓・玄関：1つずつ
    const g = new THREE.Group(); g.position.set(u.px, u.py, u.pz); let any = false;
    Object.keys(u.P).forEach(k => { const m = mesh(k, u.P[k], M[k]); if (m) { g.add(m); any = true; } });
    if (any) { gs.add(g); anim.units.push({ g, b: u.b, py: u.py }); }
  });
  // 屋根：軒天→瓦の面（手前左の角に近い順）→棟→煙突。支点は家の真ん中の軒の高さ（着地のつぶれがここを中心に起きる）
  const rp = (k, gl, mat, sd) => { gl.forEach(g => g.translate(-hx, -YE, -hz)); const m = mesh(k, gl, mat); if (!m) return null; m.position.set(hx, YE, hz); grp.add(m); anim.roofs.push({ o: m, sd }); return m; };
  const pick = (m, n) => { const a = [...m.values()].sort((p, q) => p[0] + p[2] - q[0] - q[2]), o = []; for (let i = 0; i < n && a.length; i++) o.push(a[Math.min(a.length - 1, Math.max(0, Math.round((i + .5) * a.length / n - .5)))]); return o; };
  const facets = [...clus.values()].map(c => ({ c, d: wd(c.sx / c.n, c.sz / c.n) })).sort((p, q) => p.d - q.d), SDR = .14;
  if (parts.eave) rp('eave', parts.eave, M.eave, .02);
  facets.forEach((f, i) => {
    const sd = .02 + i * .035, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(f.c.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(f.c.uv, 2)); g.computeVertexNormals(); rp('tile', [g], M.tile, sd);
    const ed = new Map(); for (let j = 0; j < f.c.pos.length; j += 3) if (Math.abs(f.c.pos[j + 1] - YE) < 1e-4) ed.set(f.c.pos[j].toFixed(2) + ',' + f.c.pos[j + 2].toFixed(2), [f.c.pos[j], YE, f.c.pos[j + 2]]);
    anim.ev.push({ p: RS + sd + RL * LF, pts: pick(ed, 3), dust: 2, spark: 0, shake: .0025 });
  });
  if (parts.ridge) rp('ridge', parts.ridge, M.ridge, SDR);
  let mxd = 0; tris.forEach(t => t.v.forEach(v => { mxd = Math.max(mxd, v.d); })); const tp = new Map(); tris.forEach(t => t.v.forEach(v => { if (v.d >= mxd - 1e-6) tp.set(v.x.toFixed(2) + ',' + v.z.toFixed(2), [v.x, v.y, v.z]); }));
  if (tris.length) anim.ev.push({ p: RS + SDR + RL * LF, pts: pick(tp, 5), dust: 0, spark: 7, shake: .006, snd: true });
  if (chP.c) {
    const cg = new THREE.Group(); cg.position.set(chP.c[0], chP.c[1], chP.c[2]);
    ['brick', 'cap', 'flue'].forEach(k => { if (chP[k]) { const m = mesh(k, chP[k], MAT[k] || M[k]); if (m) cg.add(m); } });
    grp.add(cg); anim.chim = { g: cg, y0: chP.c[1], sd: SDR };
  }
  return { roof: grp, shell: gs, geos: hold, anim };
}

// ===== 外から呼ぶ =====
export function roofInit(scene) {
  G = new THREE.Group(); G.name = 'roof'; G.visible = false; scene.add(G);
}
const keyOf = rooms => rooms.map(r => [r.x, r.z, r.w, r.d].join(',')).join(';');
function clear() {
  if (roofG) { G.remove(roofG); roofG = null; } if (shellG) { G.remove(shellG); shellG = null; } A = null;
  geos.forEach(g => g.dispose()); geos = []; builtKey = '';
}
export function roofHouse(rooms) {   // 家を組みなおしたとき。形が同じなら何もしない。引いている最中なら、すぐ作りなおす（引くまでは作らない）
  if (!G) return; rooms0 = rooms.map(r => ({ x: r.x, z: r.z, w: r.w, d: r.d })); if (keyOf(rooms0) === builtKey) return;
  clear(); if (P > 0 || want) ensure(); else idle();   // 引く前に、あいた時間に作っておく（引いた瞬間にかくつかない）
}
let idleT = 0;
function idle() {
  if (idleT) return; const run = () => { idleT = 0; if (!builtKey) ensure(); };
  idleT = window.requestIdleCallback ? requestIdleCallback(run, { timeout: 5000 }) : setTimeout(run, 2000);
}
function ensure() {
  if (!G || !rooms0) return; builtKey = keyOf(rooms0);
  try { const b = build(rooms0); roofG = b.roof; shellG = b.shell; geos = b.geos; A = b.anim; G.add(shellG, roofG); fresh = true; }
  catch (e) { console.error('roof', e); }
}
// ----- 動き（すべて P の関数。向きが変わっても同じ道すじを逆にたどる）-----
const clamp01 = t => Math.max(0, Math.min(1, t));
const ease = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
const back = (u, c) => { u = clamp01(u) - 1; return 1 + (c + 1) * u * u * u + c * u * u; };   // 行きすぎて戻る（オーバーシュート）
const riseOf = p => ease(p / (3 * BD + BL + .01));
export const roofRise = () => riseOf(P);   // 外壁が立ち上がった割合 0〜1（玄関のドアが閉じる割合にも使う）
export const roofCovers = () => P > RS + .16;   // 屋根が中をおおっている間（札・タップを止める）
const FREEZE = (() => { try { const q = new URLSearchParams(location.search); return q.get('test') && q.get('roofp') != null ? clamp01(+q.get('roofp')) : null; } catch (e) { return null; } })();   // ?test=…&roofp=0.5 : 途中のコマで止めて見る（確認用）
function apply() {
  if (!A) return;
  A.bodies.forEach(o => { const u = clamp01((P - o.b * BD) / BL); o.g.visible = u > 0; o.g.position.y = (back(u, 1.3) - 1) * SINK; });
  A.units.forEach(o => {
    const ub = clamp01((P - o.b * BD) / BL), up = clamp01((P - o.b * BD - UD) / UL), pp = back(up, 2.4);
    o.g.visible = up > 0; o.g.position.y = o.py + (back(ub, 1.3) - 1) * SINK; o.g.scale.setScalar(Math.max(.0001, pp));
  });
  const drop = sd => {   // 屋根の部品：上から落ちて、着地で つぶれて→のびて→戻る
    const u = clamp01((P - RS - sd) / RL), f = Math.min(1, u / LF), v = u > LF ? (u - LF) / (1 - LF) : 0, sq = Math.sin(v * Math.PI * 2) * (1 - v) * SQA, gr = .72 + .28 * ease(f);
    return { u, y: YE + LIFT * (1 - f * f), sx: gr * (1 + sq * .35), sy: gr * (1 - sq) };
  };
  A.roofs.forEach(o => { const d = drop(o.sd); o.o.visible = d.u > 0; o.o.position.y = d.y; o.o.scale.set(d.sx, d.sy, d.sx); });
  if (A.chim) { const d = drop(A.chim.sd), pc = back((P - RS - A.chim.sd - RL * LF) / .12, 2.6); A.chim.g.visible = d.u > 0 && pc > 0; A.chim.g.position.y = A.chim.y0 + (d.y - YE); A.chim.g.scale.setScalar(Math.max(.0001, pc)); }
}
// ----- 着地の土ぼこり・きらきら・カメラのゆれ（少数・軽量。動きを減らす設定では出さない）-----
const calm = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
export const roofEvents = { land: null };   // 屋根の棟が着地した瞬間に1回呼ばれる（main.js が軽い「ぽん」を鳴らす）
const NDUST = 36, NSPK = 18, fxs = [], shk = { a: 0, t: 0 }, SHAKE = [0, 0];
let dustM = null, spkM = null, rcx = 0, rcz = 0;
const blob = draw => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; draw(cv.getContext('2d')); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
function fxInit() {
  if (dustM) return;
  const pl = new THREE.PlaneGeometry(1, 1), mk2 = (n, map, blending, op) => { const m = new THREE.InstancedMesh(pl, new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending, opacity: op, fog: false }), n); m.frustumCulled = false; m.count = 0; m.visible = false; m.name = 'roof-fx'; G.add(m); return m; };
  dustM = mk2(NDUST, blob(c => { const g = c.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,246,226,.95)'); g.addColorStop(.55, 'rgba(240,226,196,.5)'); g.addColorStop(1, 'rgba(240,226,196,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }), THREE.NormalBlending, .85);
  spkM = mk2(NSPK, blob(c => { c.translate(32, 32); c.fillStyle = 'rgba(255,236,160,1)'; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 7 : 30; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); const g = c.createRadialGradient(0, 0, 0, 0, 0, 12); g.addColorStop(0, 'rgba(255,255,230,.95)'); g.addColorStop(1, 'rgba(255,240,170,0)'); c.fillStyle = g; c.fillRect(-32, -32, 64, 64); }), THREE.AdditiveBlending, 1);
}
function land(ev) {
  if (ev.snd && roofEvents.land) try { roofEvents.land(); } catch (e) { }
  if (calm()) return;
  fxInit(); shk.a = Math.max(shk.a, ev.shake); shk.t = 0;
  ev.pts.forEach(p => {
    const ox = p[0] - rcx, oz = p[2] - rcz, l = Math.hypot(ox, oz) || 1;
    for (let i = 0; i < ev.dust; i++) { const sp = .5 + Math.random() * .7; fxs.push({ k: 0, x: p[0] + (Math.random() - .5) * .3, y: p[1] + .05, z: p[2] + (Math.random() - .5) * .3, vx: ox / l * sp + (Math.random() - .5) * .3, vy: .5 + Math.random() * .6, vz: oz / l * sp + (Math.random() - .5) * .3, s: .32 + Math.random() * .22, life: .55 + Math.random() * .3, t: 0 }); }
    for (let i = 0; i < ev.spark; i++) fxs.push({ k: 1, x: p[0] + (Math.random() - .5) * .5, y: p[1] + .15, z: p[2] + (Math.random() - .5) * .5, vx: (Math.random() - .5) * .5, vy: .6 + Math.random() * .9, vz: (Math.random() - .5) * .5, s: .26 + Math.random() * .18, life: .65 + Math.random() * .4, t: -Math.random() * .12, r: Math.random() * 6 });
  });
  for (const kk of [0, 1]) { const mx = kk ? NSPK : NDUST; let n = 0; for (const f of fxs) if (f.k === kk) n++; for (let i = 0; n > mx && i < fxs.length;) { if (fxs[i].k === kk) { fxs.splice(i, 1); n--; } else i++; } }
}
const _dm = new THREE.Matrix4(), _fp = new THREE.Vector3(), _fs = new THREE.Vector3(), _fq = new THREE.Quaternion(), _fq2 = new THREE.Quaternion(), _fz = new THREE.Vector3(0, 0, 1);
function fxStep(dt, cam) {
  if (shk.a > 0) { shk.t += dt; shk.a *= Math.exp(-dt * 9); if (shk.a < .0003) shk.a = 0; }
  SHAKE[0] = shk.a * Math.sin(shk.t * 71); SHAKE[1] = shk.a * Math.sin(shk.t * 53 + 1.3);
  if (!fxs.length || !dustM) { if (dustM) dustM.visible = spkM.visible = false; return shk.a > 0; }
  let nd = 0, ns = 0;
  for (let i = fxs.length - 1; i >= 0; i--) {
    const f = fxs[i]; f.t += dt; if (f.t >= f.life) { fxs.splice(i, 1); continue; }
    if (f.t < 0) continue;
    const k = f.t / f.life; f.x += f.vx * dt; f.z += f.vz * dt; f.y += f.vy * dt; f.vy -= (f.k ? .4 : 1.1) * dt; f.vx *= 1 - dt * 1.5; f.vz *= 1 - dt * 1.5;
    const sc = f.k ? f.s * Math.pow(Math.sin(k * Math.PI), .7) : f.s * (k < .25 ? .55 + k * 1.8 : 1 - (k - .25) / .75 * .98);
    if (cam) { _fq.copy(cam.quaternion); if (f.k) { _fq2.setFromAxisAngle(_fz, f.r + f.t * 3); _fq.multiply(_fq2); } } else _fq.identity();
    _fp.set(f.x, f.y, f.z); _fs.set(sc, sc, sc); _dm.compose(_fp, _fq, _fs);
    if (f.k) { if (ns < NSPK) spkM.setMatrixAt(ns++, _dm); } else if (nd < NDUST) dustM.setMatrixAt(nd++, _dm);
  }
  dustM.count = nd; spkM.count = ns; dustM.visible = nd > 0; spkM.visible = ns > 0; dustM.instanceMatrix.needsUpdate = spkM.instanceMatrix.needsUpdate = true;
  return fxs.length > 0 || shk.a > 0;
}
export const roofShake = () => SHAKE;   // カメラに足す小さなゆれ [dx, dy]（レンズのずれ。止まっているときは 0）
// w = いま引いているか。snap = アニメなしで切りかえ。camera = 土ぼこりをカメラへ向けるのに使う。まだ動いている間（もう1フレーム要る間）は true を返す
export function roofTick(dt, w, snap, camera) {
  if (!G) return false;
  const P0 = P; want = !!w;
  if ((want || P > 0) && !builtKey) ensure();
  const goal = want ? 1 : 0;
  if (FREEZE != null) P = want ? FREEZE : 0; else P = snap ? goal : (P < goal ? Math.min(goal, P + dt / DUR) : Math.max(goal, P - dt / DURB));
  if (rooms0) { const b = houseBox(rooms0); rcx = b.x0 + b.w / 2; rcz = b.z0 + b.d / 2; }
  if (P > P0 && !snap && FREEZE == null && A) A.ev.forEach(ev => { if (P0 < ev.p && P >= ev.p) land(ev); });
  if (P !== P0 || fresh) { fresh = false; G.visible = P > 0 || fxs.length > 0; apply(); }
  const fx = fxStep(Math.min(dt, .05), camera);
  if (P === 0 && !fx) G.visible = false;
  return (FREEZE == null && P !== goal) || fx;
}
