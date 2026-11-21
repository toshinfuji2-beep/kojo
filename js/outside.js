// 家の外の風景：朝・昼・晩（端末の時計）に合わせた「背景の空」と「家のまわりの庭（3D）」。
// ・時刻：端末の時計の「小数の時間」から、朝・昼・夕方・晩の見た目をなめらかに補間する（KEYS）。太陽・月は時刻に合わせて弧を描いて動く（skyPos）。
//   確認用に ?tod=morning|noon|night（時間帯）や ?hour=18.2（時刻）で固定できる。開いたままでも30秒ごとに見て、少し動くだけならそのまま・大きく変わったら約1秒かけてなめらかに切りかえる。
//   庭の物の影は、太陽（夜は月）の高さ・向きから、伸びる向きと長さを決める（lightOf／shadowUpdate。影は1つの mesh のまま、頂点の位置だけ更新する）。
// ・背景の空：画面いっぱいに張る絵（canvas）に、グラデーション・太陽・月・星・雲を描く。画面の縦横比に合わせて描くので、丸が横長にゆがまない。
//   写真（タイル撮影）でも同じ空になるよう、全体の一部（u0〜u1, t0〜t1）だけを描き直せる（outBgRange）。
// ・庭：家の床の少し下に、家より一回り大きい芝生の島と、木・植え込み・花・柵・街灯を置く。増築で家の形が変わるたびに、置きなおす（outHouse）。
//   光の影響を受けない材質（電気の on/off で見た目が変わらない）。材質ごとに1つにまとめて描く（描画の回数をふやさない）。
//   庭の物は reg に覚えておき、増築で家の形が変わっても今ある物の場所は動かさず、広がった分にだけ足す（島はのびるアニメ）。
//   12/24 の夜（?xmas=1 で確認）は、木・柵・家のまわりにイルミネーション（光の玉1つの mesh＋にじみ1つの mesh）。
//   scene.js の roomG には入れない（タップの当たり判定・カメラの寄り引き・家具の置き場所判定に庭が入らない）。
// ・外の景色（空・庭・窓の外：SKY.night）は時計の時間帯に従い、電気スイッチでは変わらない。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GPU, gpuDirty } from './scenegpu.js?v=202611211556';
import { SKY } from './skyview.js?v=202611211556';
import { prep, place, blob, season, LEAF } from './exterior.js?v=202611211556';
import { isSmall } from './scene.js?v=202611211556';
import { roofRise } from './roof.js?v=202611211556';   // 引いて外壁・屋根が出ている割合（そのときは中が見えないので、手前の木を縮めない）

const Q = new URLSearchParams(location.search);
const OUT_M = 5, OUT_R = 3.2;   // 島の余白（家のはしから島のふちまで）と角の丸み（庭を歩く判定 yard.js へは outYard() で渡す）
const GY = -.34;   // 芝のてっぺんの高さ（家の床の下 −0.3 の、少し下。接地影 blob は −0.32）

// ----- 時間帯ごとの見た目（色は 0〜255、tint は材質の色にかける倍率）-----
// sky = 上・中・下の3色、cloud = [濃さ, R, G, B]。太陽・月の位置は色の表ではなく、時刻（h）から弧を描いて決める（sky()）
const TOD = {
  dawn: { sky: [[56, 66, 150], [226, 138, 160], [255, 176, 124], [255, 214, 160]], moon: 0, star: .3, cloud: [.95, 255, 176, 178], night: .45, bg: 1.05, grass: [.72, .7, 1], props: [.78, .72, 1], soil: [.7, .66, .9], lamp: .7 },
  morning: { sky: [[110, 180, 236], [190, 218, 240], [247, 226, 206], [255, 224, 176]], moon: 0, star: 0, cloud: [.95, 255, 230, 214], night: .3, bg: 1.18, grass: [1.12, 1.02, .8], props: [1.1, 1, .86], soil: [1.05, .95, .85], lamp: 0 },
  noon: { sky: [[44, 120, 220], [100, 176, 238], [176, 216, 248], [226, 242, 252]], moon: 0, star: 0, cloud: [1, 255, 255, 255], night: 0, bg: 1.12, grass: [1, 1, 1], props: [1, 1, 1], soil: [1, 1, 1], lamp: 0 },
  golden: { sky: [[66, 134, 224], [150, 182, 236], [250, 214, 178], [255, 228, 185]], moon: 0, star: 0, cloud: [1, 255, 226, 192], night: 0, bg: 1.12, grass: [1.08, .98, .84], props: [1.08, .97, .86], soil: [1.04, .95, .86], lamp: .05 },
  sunset: { sky: [[78, 68, 150], [214, 96, 126], [255, 138, 84], [255, 196, 110]], moon: 0, star: .1, cloud: [1, 255, 150, 128], night: .15, bg: 1.08, grass: [.98, .78, .72], props: [1, .76, .72], soil: [.95, .78, .72], lamp: .45 },
  dusk: { sky: [[26, 28, 92], [96, 62, 140], [208, 100, 118], [255, 150, 110]], moon: .7, star: .5, cloud: [.55, 214, 140, 168], night: .6, bg: 1.02, grass: [.5, .52, 1.1], props: [.55, .56, 1.05], soil: [.5, .5, .95], lamp: .9 },
  night: { sky: [[8, 12, 40], [20, 32, 88], [42, 52, 120], [60, 70, 140]], moon: 1, star: 1, cloud: [0, 200, 210, 255], night: 1, bg: 1, grass: [.3, .44, 1.5], props: [.42, .52, 1.35], soil: [.34, .4, .95], lamp: 1 }
};
// 時刻 → 見た目（キーの間はなめらかに補間）
// 時間帯の並び：[日の出・日の入りからのずれ（時間）, 見た目]。日の出 sr・日の入り ss は日付から決める（sunTimes）。昼の長さは冬 9.75 時間〜夏 14.5 時間
const KEYS_REL = [['sr', -1, 'night'], ['sr', .3, 'dawn'], ['sr', 1.8, 'morning'], ['sr', 4.9, 'noon'], ['ss', -3, 'noon'], ['ss', -1.2, 'golden'], ['ss', -.1, 'sunset'], ['ss', .9, 'dusk'], ['ss', 2.1, 'night']];
const TOD_H = { morning: 7.5, noon: 12.5, night: 22 };   // ?tod= で固定したときの時刻
// 今の時刻（小数の時間）。?hour=18.2 で時刻を、?tod=morning|noon|night で時間帯を固定できる（確認用）
function hourNow() {
  const hf = parseFloat(Q.get('hour')); if (isFinite(hf)) return Math.min(24, Math.max(0, hf));
  const f = Q.get('tod'); if (TOD_H[f] != null) return TOD_H[f];
  const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}
const xmasOn = () => { const f = Q.get('xmas'); if (f === '1') return true; if (f === '0') return false; const d = new Date(); return d.getMonth() === 11 && d.getDate() === 24; };   // 12/24（?xmas=1 で強制、?xmas=0 で止める）
const motionOK = () => { try { return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return true; } };
const lerpV = (a, b, k) => Array.isArray(a) ? a.map((v, i) => lerpV(v, b[i], k)) : a + (b - a) * k;
const lerpP = (a, b, k) => { const o = {}; for (const key in a) o[key] = lerpV(a[key], b[key], k); return o; };
// 今日の日付（?date=2026-06-21 で固定できる。確認用）。開いたまま日付をまたいだら、次の更新（30秒ごと）で自然に切りかわる
function dateNow() {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(Q.get('date') || ''); if (m) { const d = new Date(+m[1], +m[2] - 1, +m[3]); if (!isNaN(d)) return d; }
  return new Date();
}
// 日の出・日の入り（小数の時間）：東京あたりの目安。冬至ごろ 6.75／16.5、夏至ごろ 4.5／19.0 を、日付（夏至からの日数の余弦）でなめらかに補間する。位置情報は使わない
const stCache = { k: '', v: null };
function sunTimes() {
  const d = dateNow(), k = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate(); if (stCache.k === k) return stCache.v;
  const doy = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 864e5), s = (Math.cos(6.2832 * (doy - 172) / 365) + 1) / 2, sr = 6.75 - 2.25 * s, ss = 16.5 + 2.5 * s;
  const keys = [[0, 'night'], ...KEYS_REL.map(([w, dt, n]) => [(w === 'sr' ? sr : ss) + dt, n]), [24, 'night']];
  stCache.k = k; stCache.v = { sr, ss, keys }; return stCache.v;
}
function paramsAt(h) {
  const KEYS = sunTimes().keys, hm = ((h % 24) + 24) % 24; let i = 0; while (i < KEYS.length - 2 && hm >= KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1], p = lerpP(TOD[a[1]], TOD[b[1]], sstep(a[0], b[0], hm)); p.h = h; return p;
}
// 太陽（日の出〜日の入り）・月（夜）の位置：東（画面の左）から西（右）へ弧を描く。x, y は画面に対する割合（y は 0 = 上）、e = 高さ（0〜1）
function skyPos(h) {
  const { sr: SR, ss: SS } = sunTimes(), hh = ((h % 24) + 24) % 24, hm = hh < SR ? hh + 24 : hh, day = hm < SS, t = day ? (hm - SR) / (SS - SR) : (hm - SS) / (24 + SR - SS), e = Math.sin(Math.PI * t), phi = (t - .5) * Math.PI * .85;
  return { day, e, phi, x: .5 + .4 * Math.sin(phi), y: .8 - (day ? .68 : .6) * e };
}
// 影の向き（dx, dz = 光のくる向き。家の奥から手前へ影が伸びる）・長さ（m = 物の高さに対する倍率。低い太陽ほど長い）・濃さ（太陽の間は濃く、夜は月明かりで薄く）
function lightOf(p) {
  const s = skyPos(p.h), alt = (s.day ? 1.12 : .87) * s.e, c = Math.cos(s.phi), n = Math.sin(s.phi);
  return { dx: -.7071 * c + .7071 * n, dz: -.7071 * c - .7071 * n, m: Math.min(3, 1 / Math.tan(Math.max(.05, alt))), op: s.day ? .55 * sstep(0, .2, s.e) : .24 * p.moon * sstep(0, .25, s.e) };
}

let scene = null, onDirty = () => { }, aspectOf = () => 1.6, cur = null, from = null, to = null, target = NaN, t0 = 0, timer = 0;
let bgCv = null, bgTex = null, lastA = 0, dirtyBg = true;
let islandMesh = null, isD = null, isT = null, isAnim = null, builtXmas = false;   // 島：いま見えている大きさ・目標の大きさ・のびるアニメ
let shRef = null, shE = [], shL = null, shDirty = true;   // 影の板（shRef = まとめた mesh と頂点の記録、shE = 影1つぶんの情報）
let lit = [], litB = null, litH = null, litK = 0, litDirty = true, lKey = '';   // イルミネーション（litK = 夜の度合い 0〜1）
let garden = null, mats = null, lastBox = null, lastDoor = null, lastYard = null, yardVer = 0, hides = [], hKey = '', occ = [];   // occ = 木・植え込みの「さえぎる範囲」（名札を薄くする判定用）
const BW = 1280, BH = 640;

// ----- 背景の空 -----
const rgb = (c, a) => 'rgba(' + c.map(Math.round).join(',') + ',' + a + ')';
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// 全体の絵（横 0〜A、縦 0〜1 の世界。A = 画面の縦横比）のうち、横 u0〜u1・縦 t0〜t1 の割合のぶんだけを canvas いっぱいに描く。
// 横と縦を同じ倍率にしてあるので、画面いっぱいに伸ばして張っても、丸は丸のまま
function paintSky(p, u0, u1, t0, t1) {
  const A = aspectOf(), c = bgCv.getContext('2d'), sy = BH / (t1 - t0), sx = BW / ((u1 - u0) * A);
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, BW, BH);
  c.setTransform(sx, 0, 0, sy, -u0 * A * sx, -t0 * sy);
  const g = c.createLinearGradient(0, 0, 0, 1);
  [0, .46, .8, 1].forEach((st, i) => g.addColorStop(st, 'rgb(' + p.sky[i].map(Math.round).join(',') + ')'));
  c.fillStyle = g; c.fillRect(u0 * A - 1, t0 - 1, (u1 - u0) * A + 2, (t1 - t0) + 2);
  // 星（夜）
  if (p.star > .01) {
    for (let i = 0; i < 90; i++) {
      const x = hash(i * 3 + 1) * A, y = hash(i * 3 + 2) * .78, r = .0028 + hash(i * 3 + 3) * .0022, a = p.star * (.45 + .55 * hash(i + 700));
      if (x < u0 * A - .02 || x > u1 * A + .02 || y < t0 - .02 || y > t1 + .02) continue;
      c.fillStyle = 'rgba(255,248,225,' + a + ')'; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
      if (i % 9 === 0) { c.strokeStyle = 'rgba(255,248,225,' + a * .6 + ')'; c.lineWidth = r * .5; c.beginPath(); c.moveTo(x - r * 3.2, y); c.lineTo(x + r * 3.2, y); c.moveTo(x, y - r * 3.2); c.lineTo(x, y + r * 3.2); c.stroke(); }
    }
  }
  const sp = skyPos(p.h);
  // 月（夜）：時刻に合わせて弧を描く
  const ma = sp.day ? 0 : p.moon * sstep(0, .15, sp.e);
  if (ma > .01) {
    const mx = sp.x * A, my = sp.y, m = ma, gl = c.createRadialGradient(mx, my, .03, mx, my, .24);
    gl.addColorStop(0, 'rgba(190,205,255,' + .38 * m + ')'); gl.addColorStop(1, 'rgba(190,205,255,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(mx, my, .24, 0, 6.2832); c.fill();
    c.fillStyle = 'rgba(246,243,224,' + m + ')'; c.beginPath(); c.arc(mx, my, .045, 0, 6.2832); c.fill();
    c.fillStyle = 'rgba(190,190,180,' + .45 * m + ')';
    [[-.014, -.008, .009], [.016, .01, .007], [-.004, .02, .005]].forEach(([dx, dy, r]) => { c.beginPath(); c.arc(mx + dx, my + dy, r, 0, 6.2832); c.fill(); });
  }
  // 太陽（朝〜夕方）：低いほど大きく赤っぽく、高いほど白っぽく
  const sa = sp.day ? sstep(0, .06, sp.e) : 0;
  if (sa > .01) {
    const x = sp.x * A, y = sp.y, w1 = sstep(0, .45, sp.e), w2 = sstep(.45, 1, sp.e), r = 255, gg = Math.round(140 + 68 * w1 + 39 * w2), b = Math.round(70 + 70 * w1 + 78 * w2), gr = .3 + .14 * (1 - w1), gl = c.createRadialGradient(x, y, .02, x, y, gr);
    gl.addColorStop(0, 'rgba(' + [r, gg, b].join(',') + ',' + .6 * sa + ')'); gl.addColorStop(1, 'rgba(' + [r, gg, b].join(',') + ',0)');
    c.fillStyle = gl; c.beginPath(); c.arc(x, y, gr, 0, 6.2832); c.fill();
    c.fillStyle = 'rgba(' + [Math.min(255, r + 4), Math.min(255, gg + 6), Math.min(255, b + 20)].join(',') + ',' + sa + ')'; c.beginPath(); c.arc(x, y, .05 + .008 * (1 - w1), 0, 6.2832); c.fill();
  }
  // 雲（朝・昼）：丸を重ねて1つの形にし、上は明るく下はほんのり影
  if (p.cloud[0] > .01) {
    const ca = p.cloud[0], cc = p.cloud.slice(1);
    [[.14, .22, .11], [.52, .1, .09], [.88, .36, .12], [.33, .46, .08], [.7, .52, .1]].forEach(([fx, fy, s]) => {
      const x = fx * A, cg = c.createLinearGradient(0, fy - .3 * s, 0, fy + .3 * s);
      cg.addColorStop(0, rgb(cc, ca)); cg.addColorStop(1, rgb(cc.map(v => v * .86), ca));
      c.fillStyle = cg; c.beginPath();
      [[-1, 0, .3], [-.45, -.2, .5], [.25, -.3, .6], [.95, -.1, .4], [1.5, .05, .25]].forEach(([dx, dy, r]) => { c.moveTo(x + (dx + r) * s, fy + dy * s); c.arc(x + dx * s, fy + dy * s, r * s, 0, 6.2832); });
      c.rect(x - s, fy, 2.5 * s, .3 * s); c.fill();
    });
  }
  bgTex.needsUpdate = true;
}
// 写真のタイル用：背景の絵に、全体の横 u0〜u1・縦 t0〜t1（0〜1。0 = 左・上）のぶんだけを描く
export function outBgRange(u0, u1, t0, t1) { if (bgTex && cur) paintSky(cur, u0, u1, t0, t1); }
export function outBgFull() { if (bgTex && cur) { paintSky(cur, 0, 1, 0, 1); lastA = aspectOf(); } }

// ----- 庭 -----
const C = h => new THREE.Color(h), _t = new THREE.Color();
const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
// 頂点色をつける（光を受けない材質なので、向きで少し明暗をつけて立体に見せる）
function paint(g, c) {
  const p = g.attributes.position, n = g.attributes.normal, a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const k = Math.max(.55, .8 + .2 * n.getY(i) + .06 * n.getX(i) + .04 * n.getZ(i)); a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const bxg = (w, h, d, c) => paint(prep(new THREE.BoxGeometry(w, h, d)), c);
// ----- あつ森ふうの木・花の部品（docs/art_style_trees_flowers.md）-----
// 木の葉は「ふっくら丸いかたまり」：暗めの芯の球 ＋ そのまわりに丸い小さなふくらみ（lobe）をぐるりと貼り、ふちをモコモコの丸い縁にする。
// 球の形（ICO1 = 80 三角形。芯もふくらみも同じ形）はモジュールで1回だけ作り、全部のかたまりが拡大・移動して使いまわす（かたまりごとにジオメトリは作らない）。
const ICO1 = new THREE.IcosahedronGeometry(1, 1).attributes.position.array;
// 光の向き（木ごとに setSun で、木の回転ぶんを打ち消して「いつも同じ向きから光が当たる」ようにする）。上が明るく下が暗い差は shadeK
let SUNV = [.3, .88, .36];
const setSun = rot => { const c = Math.cos(rot), s = Math.sin(rot), x = .3, z = .36, l = Math.hypot(x, .88, z); SUNV = [(x * c - z * s) / l, .88 / l, (x * s + z * c) / l]; };
const shadeK = (nx, ny, nz) => { const d = (nx * SUNV[0] + ny * SUNV[1] + nz * SUNV[2]) * .5 + .5; return .44 + .62 * d * d; };   // 明るい面（上・太陽側）1.06 〜 暗い面（下）0.44
const geoOf = o => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(o.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(o.n, 3));
  g.setAttribute('uv', o.uv ? new THREE.Float32BufferAttribute(o.uv, 2) : new THREE.BufferAttribute(new Float32Array(o.p.length / 3 * 2), 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(o.c, 3)); return g;
};
// 単位球 U を、中心 (cx,cy,cz)・半径 (rx,ry,rz) で o に足す。法線はもとの球のまま（なめらか）。bump = でこぼこ（位置だけで決まるので継ぎ目は割れない）、ao = 内側・下側ほど暗く
function addBall(o, U, cx, cy, cz, rx, ry, rz, c, bump, ao, seed) {
  for (let i = 0; i < U.length; i += 3) {
    const x = U[i], y = U[i + 1], z = U[i + 2], d = 1 + bump * Math.sin(x * 4.1 + seed) * Math.cos(y * 3.3 + z * 3.9 + seed * 1.7), k = shadeK(x, y, z) * ao;
    o.p.push(cx + x * rx * d, cy + y * ry * d, cz + z * rz * d); o.n.push(x, y, z); o.c.push(c.r * k, c.g * k, c.b * k);
  }
}
// ===== あつ森の木：葉っぱ1枚ずつの「うろこ」（数値表は docs/art_style_trees_flowers.md）=====
// 樹冠 = 暗い青緑の芯（すき間から空が見えないように）＋ その表面に、カエデ形の大きな葉を外向き・下向きに、屋根瓦のように重ねて貼る。
// 葉1枚の中でも、根もと（上の葉の下になる所）は暗く、先は明るい。かたまりの下側・内側ほど暗い青緑。輪郭は葉先でギザギザになる。
const _fan = (P, cy) => { const t = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; t.push(0, cy, a[0], a[1], b[0], b[1]); } return t; };
const LEAF_P = [[0, 0], [.3, .1], [.46, .3], [.28, .4], [.5, .62], [.2, .72], [0, 1], [-.2, .72], [-.5, .62], [-.28, .4], [-.46, .3], [-.3, .1]], LEAF_T = _fan(LEAF_P, .4);   // 3〜5裂のカエデ・ツタ形（先がとがる）
const BLADE_T = _fan([[0, 0], [.24, .2], [.13, .55], [0, 1], [-.13, .55], [-.24, .2]], .3);   // スギの細いふさ
const CORE_T = new THREE.Color(.04, .16, .15), coreOf = c => c.clone().multiplyScalar(.8).lerp(CORE_T, .1);   // 芯（すき間の奥）：その木の色を暗くして、少しだけ青緑へ
const clamp01 = v => Math.max(0, Math.min(1, v));
// 葉1枚（形 T）を貼る。o = 根もと、d = 長さの向き、w = 幅の向き、nO = 外向きの目安（葉の表をこちらへ向ける）、L = 長さ、W = 幅、curl = 先の反り、c = 基本色、ao = 内側・下側ほど小さい（暗くなる）
function putLeaf(O, T, ox, oy, oz, dx, dy, dz, wx, wy, wz, nox, noy, noz, L, W, curl, c, ao) {
  let nx = wy * dz - wz * dy, ny = wz * dx - wx * dz, nz = wx * dy - wy * dx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
  if (nx * nox + ny * noy + nz * noz < 0) { nx = -nx; ny = -ny; nz = -nz; }
  const dl = (nx * SUNV[0] + ny * SUNV[1] + nz * SUNV[2]) * .5 + .5, S0 = .5 * (dl < .34 ? 0 : dl < .6 ? .5 : 1) + .5 * dl;
  for (let i = 0; i < T.length; i += 2) {
    const u = T[i], v = T[i + 1], cu = curl * v * v * L;
    O.p.push(ox + wx * u * W + dx * v * L + nx * cu, oy + wy * u * W + dy * v * L + ny * cu, oz + wz * u * W + dz * v * L + nz * cu); O.n.push(nx, ny, nz);
    const S = clamp01(.5 * S0 + .32 * v + .5 * ao - .42), sr = c.r * .34, sg = c.g * .54, sb = c.b * .64;   // 影の色は青緑へ寄せる
    O.c.push(sr + (c.r * 1.12 - sr) * S, sg + (c.g * 1.14 - sg) * S, sb + (c.b * .9 - sb) * S);
  }
}
// 葉の絵の板：何枚もの葉が重なった絵（アルファ抜き）を、板1枚に貼る。葉1枚は小さく、板1枚で 8 枚ぶんの葉を表す（三角形は2つ）。濃淡は灰色で描き、頂点の色と掛けあわせる
// 絵の上が板の先（v=1）、下が根もと（v=0）。先の列から先に描き、根もと側の列を最後に描く＝上の段の葉が下の段の葉の付け根をかくす
let _leafTex = null;
function leafTex() {
  if (_leafTex) return _leafTex;
  // 512 四方で細かく描く。葉は丸みのある形（なめらかな曲線）。ふち線は引かない：重なりの境目は、下の葉にかかるやわらかい影と、葉の根もと側の濃さで見せる
  const S = 512, k = S / 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d');
  // あつ森の葉：横に広い扇形。先（外がわ）のふちに、先の丸いやわらかい歯が7つ。根もとはすぼまる。点を結んだ多角形を、中点を通る2次曲線でなめらかにする（歯の先は少しとがったまま残る）
  const OUT = []; for (let i = 0; i <= 96; i++) {
    const a = i / 96 * 6.2832, up = Math.cos(a);   // a = 0 が葉の先、π が根もと
    let r = 1 - .55 * Math.pow(clamp01(-up), 2.2);   // 根もと側をすぼめる
    if (up > -.25) r *= 1 - .3 * Math.pow(Math.abs(Math.sin(a * 3.5)), .55) * clamp01((up + .25) / .45);   // 歯（先がわだけ）
    OUT.push([Math.sin(a) * .6 * r, .5 + up * .5 * r]);
  }
  const shape = (bx, by, sz) => {
    const P = OUT.map(([x, y]) => [bx + x * sz, by - y * sz]); c.beginPath(); c.moveTo((P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2);
    for (let i = 1; i < P.length; i++) { const q = P[(i + 1) % P.length]; c.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + q[0]) / 2, (P[i][1] + q[1]) / 2); } c.closePath();
  };
  const drawLeaf = (bx, by, sz) => {
    bx *= k; by *= k; sz *= k;
    c.save(); c.globalCompositeOperation = 'source-atop'; c.shadowColor = 'rgba(20,20,20,.8)'; c.shadowBlur = 7 * k; c.shadowOffsetY = 9 * k; shape(bx, by, sz); c.fillStyle = 'rgb(150,150,150)'; c.fill(); c.restore();   // 下の葉に落ちるやわらかい影
    shape(bx, by, sz);
    const g = c.createLinearGradient(bx, by, bx, by - sz); g.addColorStop(0, 'rgb(158,158,158)'); g.addColorStop(.5, 'rgb(212,212,212)'); g.addColorStop(1, 'rgb(250,250,250)');
    c.fillStyle = g; c.fill();
    c.save(); shape(bx, by, sz); c.clip(); const h = c.createRadialGradient(bx - sz * .12, by - sz * .7, 0, bx - sz * .12, by - sz * .7, sz * .45); h.addColorStop(0, 'rgba(255,255,255,.35)'); h.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = h; c.fillRect(bx - sz, by - sz * 1.2, sz * 2, sz * 1.4); c.restore();   // 上側のつや
    c.save(); shape(bx, by, sz); c.clip(); c.lineWidth = 1.8 * k; c.lineCap = 'round'; c.strokeStyle = 'rgba(255,255,255,.28)';   // 根もとから扇に広がる、明るいうすい葉脈
    for (const f of [-.5, -.25, 0, .25, .5]) { c.beginPath(); c.moveTo(bx, by - sz * .1); c.quadraticCurveTo(bx + f * sz * .2, by - sz * .45, bx + f * sz * .62, by - sz * (.86 - Math.abs(f) * .3)); c.stroke(); }
    c.restore();
  };
  // 葉は大きく（板1枚に 2〜3 枚ぶん。あつ森は樹冠の横幅に葉が 6〜8 枚ほど）。先の列 → 根もとの列の順に描き、根もと側の葉が上にのる
  [[[70, 150, 130], [186, 146, 130]], [[128, 198, 132], [10, 204, 124], [246, 204, 124]], [[66, 252, 128], [190, 254, 128]]].forEach(row => row.forEach(([x, y, s]) => drawLeaf(x, y, s)));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; _leafTex = t; return t;
}
// 板を1枚貼る。形は putLeaf と同じ向きの決め方（o = 根もと、d = 長さの向き、w = 幅の向き、nO = 外向き）。Q = { p, n, c, uv }
const sband = (a, w, x) => { const t = clamp01((x - a + w) / (2 * w)); return t * t * (3 - 2 * t); };   // なめらかな段
function putPlate(Q, ox, oy, oz, dx, dy, dz, wx, wy, wz, nox, noy, noz, L, W, curl, c, ao, shn) {
  let nx = wy * dz - wz * dy, ny = wz * dx - wx * dz, nz = wx * dy - wy * dx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
  if (nx * nox + ny * noy + nz * noz < 0) { nx = -nx; ny = -ny; nz = -nz; }
  // 明暗は板1枚の向きではなく、かたまりの表面の向き（shn）で決める：となりあう葉は同じ明るさになり、かたまり全体で「上が明るく下が暗い」なめらかな帯になる（板ごとに決めると、向きの小さなばらつきで明暗が飛びとびのモザイクになる）
  const sx = shn ? shn[0] : nx, sy = shn ? shn[1] : ny, sz = shn ? shn[2] : nz;
  const dl = (sx * SUNV[0] + sy * SUNV[1] + sz * SUNV[2]) * .5 + .5, S1 = clamp01(.7 * dl + 1.0 * ao - .66), S = .35 * S1 + .65 * (.45 * sband(.36, .07, S1) + .55 * sband(.74, .06, S1));   // 3段（影・中・明）。段の境はなめらかに
  // 色の段（あつ森の実際の色から：影 #406f5f の灰がかった青緑 → 中 #5ebb62 → 明 #82cf5b の黄緑 → いちばん明るい所 #b7f576）。影は青緑へ、明るい所は黄緑へ、色合いもずらす
  const sr = c.r * .35 + .004, sg = c.g * .27, sb = c.g * .19 + .004, r = sr + (c.r * 2.3 - sr) * S, g = sg + (c.g * 2.15 - sg) * S, b = sb + (c.b * 1.2 - sb) * S;
  for (const [u, v] of [[-.5, 0], [.5, 0], [.5, 1], [-.5, 0], [.5, 1], [-.5, 1]]) {
    const cu = curl * v * v * L;
    Q.p.push(ox + wx * u * W + dx * v * L + nx * cu, oy + wy * u * W + dy * v * L + ny * cu, oz + wz * u * W + dz * v * L + nz * cu); Q.n.push(nx, ny, nz); Q.c.push(r, g, b); Q.uv.push(u + .5, v);
  }
}
// 広葉樹の樹冠。lumps = [[x,y,z,横の半径,縦の半径]…]。O = 芯（球）、Q = 葉の板。yb = 下の平らな面の高さ、yt = てっぺん、LL = 板の大きさ
// かたまりごとに、表面を「上から下へ」の輪にならべ、輪ごとに半周ずらして貼る（屋根瓦）。向きのばらつきは小さい。かたまりの境（ほかのかたまりの表面ぎわ）は暗くして、丸いかたまりが読めるように
function leafCrown(O, Q, lumps, c0, colF, rnd, LL, yb, yt, seed, crk, distinct) {
  const k0 = O.p.length, cc = coreOf(c0);
  lumps.forEach(([x, y, z, rx, ry], j) => addBall(O, ICO1, x, y, z, rx * .8, ry * .82, rx * .8, cc, 0, .8, seed + j));
  for (let i = k0 + 1; i < O.p.length; i += 3) if (O.p[i] < yb) O.p[i] = yb;   // 下側は平らに
  lumps.forEach(([cx, cy, cz, rx, ry], j) => {
    const lc = j === 0 || !distinct ? c0 : colF();   // 1本の木は1つの色（あつ森の木は同じ緑で、明暗だけがかわる）。distinct = 秋の木だけ、かたまりごとに緑・黄・うす橙を分ける
    const plateAt = (th, ph, sk, bk) => {
      const sn = Math.sin(th), cs = Math.cos(th), cp = Math.cos(ph), sp = Math.sin(ph), px = cx + rx * sn * cp, py = cy + ry * cs, pz = cz + rx * sn * sp;
      if (py < yb) return;
      let cr = 0;   // かたまりの境の暗さ
      for (let l = 0; l < lumps.length; l++) if (l !== j) { const q = lumps[l], d = Math.sqrt(((px - q[0]) / q[3]) ** 2 + ((py - q[1]) / q[4]) ** 2 + ((pz - q[2]) / q[3]) ** 2); if (d < .9) return; cr = Math.max(cr, clamp01((1.22 - d) / .3)); }
      let nx = sn * cp / rx, ny = cs / ry, nz = sn * sp / rx; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      let tx = rx * cs * cp, ty = -ry * sn, tz = rx * cs * sp; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      let dx = tx * .85 + nx * .3 + (rnd() - .5) * .08, dy = ty * .85 + ny * .3 - .08 + (rnd() - .5) * .08, dz = tz * .85 + nz * .3 + (rnd() - .5) * .08; const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
      let wx = dy * nz - dz * ny, wy = dz * nx - dx * nz, wz = dx * ny - dy * nx; const wl = Math.hypot(wx, wy, wz) || 1; wx /= wl; wy /= wl; wz /= wl;
      const L = LL * sk * (.85 + .3 * rnd()), c = lc.clone().multiplyScalar(.97 + .06 * rnd());   // 1枚ずつのゆらぎはごく小さく（ほかの色はまぜない）
      const ao = clamp01(.15 * ((py - yb) / Math.max(.1, yt - yb)) + .65 * clamp01((cs + .15) / 1.15) + .2) * (1 - crk * cr);
      const bb = L * (bk || 0);   // 上のまん中は、板の根もとをうしろへずらして、中心をおおう
      putPlate(Q, px - nx * L * .12 - dx * bb, py - ny * L * .12 - dy * bb, pz - nz * L * .12 - dz * bb, dx, dy, dz, wx, wy, wz, nx, ny, nz, L, L, .12, c, ao, [nx, ny, nz]);
    };
    for (let i = 0; i < 4; i++) plateAt(.03, i * 1.5708 + rnd() * .5, 1.15, .55);   // てっぺんのまん中
    const TH = 1.75, nr = Math.max(3, Math.round(TH * (rx + ry) * .5 / (LL * .44)));
    for (let k = 0; k < nr; k++) {
      const th = k === 0 ? .25 : (k + .3) / nr * TH + (rnd() - .5) * .1, m = k === 0 ? 6 : Math.max(2, Math.round(6.2832 * rx * Math.sin(th) / (LL * .55))), ph0 = rnd() * 6.28;
      for (let i = 0; i < m; i++) plateAt(th + (rnd() - .5) * .12, ph0 + (i + (k & 1) * .5) / m * 6.2832 + (rnd() - .5) * .3, 1, k === 0 ? .3 : 0);
    }
    for (let q = 0, nq = Math.round(rx * (rx + ry) * 2.2 / (LL * LL) * 1.1); q < nq; q++) plateAt(Math.acos(1 - rnd() * .85), rnd() * 6.2832, 1.1);   // 上側のすき間をうめる
  });
}
// 実（リンゴ・ナシ）：樹冠の表面に3つ
function fruitsOn(O, lumps, col, rnd, seed) {
  for (let f = 0; f < 3; f++) {
    const q = lumps[1 + ((rnd() * (lumps.length - 1)) | 0)], th = .95 + .35 * rnd(), ph = rnd() * 6.28, sn = Math.sin(th), cp = Math.cos(ph), sp = Math.sin(ph);
    let nx = sn * cp / q[3], ny = Math.cos(th) / q[4], nz = sn * sp / q[3]; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    addBall(O, ICO1, q[0] + q[3] * sn * cp + nx * .1, q[1] + q[4] * Math.cos(th) + ny * .1, q[2] + q[3] * sn * sp + nz * .1, .21, .22, .21, col, 0, 1, seed + f);
  }
}
// スギ：青緑の暗い円錐の芯 ＋ 下へ垂れる細いふさを2周ずつ。段を重ねる
function cedarGeo(O, tiers, c0, colF, rnd, lk) {
  const cc = coreOf(c0), N = 12;
  tiers.forEach(([cx, cy, cz, r, ys], ti) => {
    const h = r * ys * 2.2, yb = cy - h / 2, yt = cy + h / 2;
    for (let i = 0; i < N; i++) {
      const a0 = i / N * 6.2832, a1 = (i + 1) / N * 6.2832;
      for (const [x, y, z, k] of [[cx, yt, cz, .9], [cx + Math.cos(a1) * r * .8, yb, cz + Math.sin(a1) * r * .8, .62], [cx + Math.cos(a0) * r * .8, yb, cz + Math.sin(a0) * r * .8, .62]]) { O.p.push(x, y, z); O.n.push(0, 1, 0); O.c.push(cc.r * k, cc.g * k, cc.b * k); }
    }
    [[.1, 1, .85], [.46, .78, 1]].forEach(([f, lenK, ao0], ri) => {
      const rr = r * (1 - f) * .94, nb = Math.max(9, Math.round(rr * (lk > 1 ? 9 : 13)) + 8), L = r * .72 * lenK;
      for (let i = 0; i < nb; i++) {
        const a = (i + ri * .5) / nb * 6.2832 + (rnd() - .5) * .2, ca = Math.cos(a), sa = Math.sin(a), bx = cx + ca * rr, by = yb + f * h, bz = cz + sa * rr;
        let dx = ca * .5 + (rnd() - .5) * .1, dy = -.86, dz = sa * .5 + (rnd() - .5) * .1; const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
        const c = (rnd() < .14 ? colF() : c0).clone().multiplyScalar(.92 + .16 * rnd()), ao = Math.min(1, ao0 * (.62 + .38 * ti / Math.max(1, tiers.length - 1)));
        putLeaf(O, BLADE_T, bx, by, bz, dx, dy, dz, -sa, 0, ca, ca * .85, .5, sa * .85, L * (.9 + .2 * rnd()), L * 1.2, .15, c, ao);
      }
    });
  });
}
// 幹：太く短く、根もとが広がる（rt = 上の半径、rb = 下の半径、h = 高さ）。縦に樹皮の溝の筋。明るい黄土〜オレンジ茶、影側は赤みのある茶
// あつ森の幹（参考画像の実測：明るい所 #ebae5b・中 #dda359 の暖かい黄土色）：太くほぼまっすぐ（下へ少し太る）。表面はなめらかで、こまかい縦のうすい筋だけ（深い溝はない）。
// 根もとは「スカート」に広げず、丸い根が3〜4本、足の指のように地面へ出る（rootOn）。幹の上のほうは樹冠の影で暗い
function trunkGeo(rt, rb, h, TB, rnd) {
  const O = { p: [], n: [], c: [] }, N = 20, rows = [0, .06, .14, .3, .5, .7, .86, 1], g = [], ph = rnd() * 6;
  for (let j = 0; j < N; j++) g.push(.95 + .05 * Math.sin(j * 2.7 + ph) * Math.cos(j * 1.3));   // こまかい縦の筋（ごくうすく）
  const rad = y => (rt + (rb * 1.06 - rt) * Math.pow(1 - y / h, 1.6)) * (1 + .12 * Math.exp(-y / .12));   // 下へ少し太る。地面ぎわだけ、ほんの少し広がる
  const vt = (i, j) => {
    const y = rows[i] * h, a = j % N / N * 6.2832, nx = Math.cos(a), nz = Math.sin(a), dl = (nx * SUNV[0] + nz * SUNV[2]) * .5 + .5, S = .35 * sband(.42, .08, dl) + .65 * dl;
    const top = 1 - .42 * sstep(.62, 1, rows[i]);   // 樹冠の影
    const k = g[j % N] * top * (.92 + .08 * Math.min(1, y / .3));
    O.p.push(nx * rad(y), y, nz * rad(y)); O.n.push(nx, 0, nz);
    O.c.push((TB.r * .7 + TB.r * .42 * S) * k, (TB.g * .56 + TB.g * .5 * S) * k, (TB.b * .5 + TB.b * .5 * S) * k);   // 影はやや赤茶へ
  };
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < N; j++) { vt(i, j); vt(i, j + 1); vt(i + 1, j); vt(i, j + 1); vt(i + 1, j + 1); vt(i + 1, j); }
  const nr = 3 + (rnd() < .5 ? 1 : 0), a0 = rnd() * 6.28;
  for (let q = 0; q < nr; q++) rootOn(O, a0 + q / nr * 6.2832 + (rnd() - .5) * .5, rb * (1.05 + .25 * rnd()), rb, TB);
  return geoOf(O);
}
// 根1本：幹から外へのびる、丸い先の太いこぶ（横にのびた楕円の玉。下は地面で平ら）。a = 向き、len = 幹の中心からの長さ、rb = 幹の太さ
function rootOn(O, a, len, rb, TB) {
  const ca = Math.cos(a), sa = Math.sin(a), lx = len * .62, ly = rb * .55, lz = rb * .42, cx = ca * (rb * .55 + lx * .55), cz = sa * (rb * .55 + lx * .55);
  for (let i = 0; i < ICO1.length; i += 3) {
    const x = ICO1[i], y = ICO1[i + 1], z = ICO1[i + 2], sw = 1 + .25 * Math.max(0, x);   // 先のほうを少し太く（足の指の先のように丸く）
    const px = x * lx, py = Math.max(0, y * ly * sw), pz = z * lz * sw;
    let nx = x / lx, ny = y / ly, nz = z / lz; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const wx = nx * ca - nz * sa, wz = nx * sa + nz * ca, k = shadeK(wx, ny, wz) * (.8 + .2 * clamp01(py / ly));
    O.p.push(cx + px * ca - pz * sa, py, cz + px * sa + pz * ca); O.n.push(wx, ny, wz); O.c.push(TB.r * k, TB.g * k * .97, TB.b * k * .92);
  }
}
// 枝：a → b（太さ r0 → r1）。葉のかたまりを幹につなぐ（かたまりの芯の中まで差し込む）
const _bq = new THREE.Quaternion(), _bv = new THREE.Vector3(), _bu = new THREE.Vector3(0, 1, 0);
function branchGeo(a, b, r0, r1, c) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), g = cyg(r1, r0, len, 6, c);
  _bv.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(); _bq.setFromUnitVectors(_bu, _bv); g.applyQuaternion(_bq);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); return g;
}
// 楕円（幅 wm・長さ 1。根もと (0,0)・先 (0,1)）を8枚の扇で。中心をふくらませ（dome）、先へ向かってカップ状に反らせる（cup）。花びら・葉に使う。モジュールで1回だけ作って使いまわす
const ellFan = (wm, cup, dome) => {
  const R = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * 6.2832; R.push([wm * Math.sin(a), .5 - .5 * Math.cos(a)]); }
  const rz = y => cup * y * y, out = []; for (let i = 0; i < 8; i++) out.push(0, .5, dome, R[i + 1][0], R[i + 1][1], rz(R[i + 1][1]), R[i][0], R[i][1], rz(R[i][1])); return out;
};
const LEAF_RD = ellFan(.36, .38, .05);   // 花の葉（細長く先がとがり、根もとから外へ反る。チューリップの葉）
// 花の種類：0 = コスモス・パンジー風（5枚の丸い花びら＋丸いしべ）、1 = ヒヤシンス風（茎のてっぺんに小さな丸い花が段々）、2 = チューリップ（6枚が立ち上がったカップ形）
// n = 花びらの数、pt = 花びらの形、tilt = 花びらの立ち上がり（ラジアン。大きいほど立つ）、pl = 花びらの長さ、ctr = しべの半径、h = 茎の高さ
const FLOWERS = [
  { n: 8, pt: ellFan(.5, .1, .15), tilt: .14, pl: .2, ctr: .07, h: .34 },
  { n: 0, fl: 1, pl: 0, ctr: 0, h: .42 },
  { n: 6, pt: ellFan(.78, .45, .4), tilt: 1.2, pl: .25, ctr: 0, h: .36 }
];
// 花1本（短い茎＋丸い葉2枚＋花）を、根もと (0,0,0) の場所に作る。使いまわしの形（花びら・葉）を、向き・傾き・大きさだけ変えて1つの BufferGeometry にまとめる
function flowerGeo(kind, pc, cc, rnd) {
  const F = FLOWERS[kind], pos = [], nor = [], col = [], h = F.h * (.85 + rnd() * .3), lean = (rnd() - .5) * .35, ph = rnd() * 6.28;
  const hx = Math.sin(lean) * h * Math.cos(ph) * .5, hz = Math.sin(lean) * h * Math.sin(ph) * .5, hy = h * Math.cos(lean * .5);   // 茎の先（少し曲げる）
  const tri = (P, ox, oy, oz, dx, dy, dz, wx, wy, wz, L, W, c, k0, k1) => {   // 1枚を貼る。d = 長さの向き、w = 幅の向き。法線 = d × w
    const nx = dy * wz - dz * wy, ny = dz * wx - dx * wz, nz = dx * wy - dy * wx;
    for (let v = 0; v < P.length / 3; v++) {
      const x = P[v * 3] * W, y = P[v * 3 + 1] * L, z = P[v * 3 + 2] * L;
      pos.push(ox + wx * x + dx * y + nx * z, oy + wy * x + dy * y + ny * z, oz + wz * x + dz * y + nz * z); nor.push(nx, ny, nz);
      const k = k0 + (k1 - k0) * Math.min(1, Math.max(0, P[v * 3 + 1])); col.push(c.r * k, c.g * k, c.b * k);
    }
  };
  const ro = rnd() * 6.28, big = .85 + rnd() * .3;
  for (let i = 0; i < F.n; i++) {   // 花びら
    const f = ro + i / F.n * 6.2832, ct = Math.cos(F.tilt), st = Math.sin(F.tilt), dx = Math.cos(f) * ct, dz = Math.sin(f) * ct;
    tri(F.pt, hx, hy, hz, dx, st, dz, -Math.sin(f), 0, Math.cos(f), F.pl * big, F.pl * big, pc, .74, 1.1);
  }
  if (F.fl) for (let j = 0; j < 8; j++) {   // ヒヤシンス：小さな丸い花（8面体）を、茎のてっぺんにらせん状に。上ほど小さく明るい
    const t = j / 7, a = j * 2.4 + ph, rr = .042 * (1 - .5 * t), y = hy - h * .4 * (1 - t), s = .058 * (1 - .4 * t), q = y / hy, k = .78 + .3 * t;
    for (let v = 0; v < 24; v++) { const x = OCT[v * 3], yy = OCT[v * 3 + 1], z = OCT[v * 3 + 2]; pos.push(hx * q + Math.cos(a) * rr + x * s, y + yy * s * 1.15, hz * q + Math.sin(a) * rr + z * s); nor.push(x, yy, z); col.push(pc.r * k, pc.g * k, pc.b * k); }
  }
  if (F.ctr) { const r = F.ctr * big, c = []; for (let i = 0; i < 8; i++) c.push([Math.cos(i * .7854) * r, Math.sin(i * .7854) * r]);   // 丸いしべ（8角形のふくらみ）
    for (let i = 0; i < 8; i++) { const a = c[i], b = c[(i + 1) % 8]; pos.push(hx, hy + .02, hz, hx + a[0], hy + .006, hz + a[1], hx + b[0], hy + .006, hz + b[1]); for (let q = 0; q < 3; q++) { nor.push(0, 1, 0); col.push(cc.r * (q ? .85 : 1.12), cc.g * (q ? .85 : 1.12), cc.b * (q ? .85 : 1.12)); } } }
  const sc = C(0x2f9a45), sw = F.fl ? .02 : .014;   // 茎：細い帯を2枚十字に
  for (const [ax, az] of [[1, 0], [0, 1]]) {
    const q = [[-ax * sw, 0, -az * sw], [ax * sw, 0, az * sw], [hx + ax * sw * .7, hy, hz + az * sw * .7], [hx - ax * sw * .7, hy, hz - az * sw * .7]];
    for (const t of [[0, 1, 2], [0, 2, 3]]) for (const v of t) { pos.push(q[v][0], q[v][1], q[v][2]); nor.push(az, 0, ax); col.push(sc.r * .9, sc.g * .9, sc.b * .9); }
  }
  for (let i = 0; i < 2; i++) {   // 丸い葉2枚（茎の根もとに近いところから、外へ向けてふくらむ）
    const f = ro + i * 3.14 + rnd() * 1.2, fy = h * (.05 + rnd() * .1), dx = Math.cos(f) * .9, dz = Math.sin(f) * .9, dy = .55, il = 1 / Math.hypot(dx, dy, dz), L = .27 + rnd() * .06;
    tri(LEAF_RD, hx * fy / h, fy, hz * fy / h, dx * il, dy * il, dz * il, -Math.sin(f), 0, Math.cos(f), L, L * .75, sc, .7, 1.1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.length / 3 * 2), 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
}
// 雑草：kind 0 = 細くとがった葉が6〜8本立つ房（先は明るい黄緑・根もとは濃い緑。先が外へ少し反る）、kind 1 = クローバー（丸い3つ葉が地面にぺたっと3かたまり）
function weedGeo(kind, rnd, tipC, baseC) {
  const o = { p: [], n: [], c: [] };
  const v3 = (P, c) => { o.p.push(P[0], P[1], P[2]); o.n.push(0, 1, 0); o.c.push(c.r, c.g, c.b); };
  if (kind === 0) {
    const nb = 6 + ((rnd() * 3) | 0), mc = baseC.clone().lerp(tipC, .5);
    for (let i = 0; i < nb; i++) {
      const a = i / nb * 6.2832 + rnd(), rd = .015 + rnd() * .05, h = .24 + rnd() * .2, w = .03 + rnd() * .015, lean = .5 + rnd() * .6, fx = Math.cos(a), fz = Math.sin(a), sx = -fz * w, sz = fx * w;
      const B = [fx * rd, 0, fz * rd], M = [B[0] + fx * lean * h * .3, h * .55, B[2] + fz * lean * h * .3], T = [B[0] + fx * lean * h * .85, h * .93, B[2] + fz * lean * h * .85];
      const q = (P, k) => [P[0] + sx * k, P[1], P[2] + sz * k];
      v3(q(B, -1), baseC); v3(q(B, 1), baseC); v3(q(M, -.62), mc); v3(q(B, 1), baseC); v3(q(M, .62), mc); v3(q(M, -.62), mc); v3(q(M, -.62), mc); v3(q(M, .62), mc); v3(T, tipC);
    }
  } else {
    const hi = tipC.clone().multiplyScalar(1.25);
    for (let g = 0; g < 3; g++) {
      const gx = (g - 1) * .13 + (rnd() - .5) * .05, gz = (rnd() - .5) * .1, ro = rnd() * 6.28;
      for (let l = 0; l < 3; l++) {
        const a = ro + l * 2.0944, lx = gx + Math.cos(a) * .06, lz = gz + Math.sin(a) * .06, r = .055 + rnd() * .02;
        for (let k = 0; k < 6; k++) { const a0 = k / 6 * 6.2832, a1 = (k + 1) / 6 * 6.2832; v3([lx, .045, lz], hi); v3([lx + Math.cos(a0) * r, .02, lz + Math.sin(a0) * r], tipC); v3([lx + Math.cos(a1) * r, .02, lz + Math.sin(a1) * r], tipC); }
      }
    }
  }
  return geoOf(o);
}
const cyg = (rt, rb, h, seg, c) => paint(prep(new THREE.CylinderGeometry(rt, rb, h, seg)), c);
function grassTex() {   // あつ森の芝：明るい緑の地に、うっすらまだらと、向きばらばらの小さな三角（明るいのと濃いの）。色は材質の color と掛けあわせる
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'), r = rngOf(7);
  c.fillStyle = '#e4e4e4'; c.fillRect(0, 0, S, S);
  for (let i = 0; i < 46; i++) { const g = 212 + (r() * 36) | 0, x = r() * S, y = r() * S, q = 22 + r() * 44; c.fillStyle = 'rgba(' + g + ',' + g + ',' + g + ',.5)'; for (const [ox, oy] of [[0, 0], [-S, 0], [S, 0], [0, -S], [0, S]]) { c.beginPath(); c.arc(x + ox, y + oy, q, 0, 6.2832); c.fill(); } }
  for (let i = 0; i < 64; i++) {
    const x = r() * S, y = r() * S, a = r() * 6.2832, q = 9 + r() * 7, v = r() < .5 ? 255 : 186, al = v > 200 ? .75 : .5;
    c.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + al + ')';
    for (const [ox, oy] of [[0, 0], [-S, 0], [S, 0], [0, -S], [0, S]]) { c.beginPath(); for (let k = 0; k < 3; k++) { const t = a + k * 2.0944; c.lineTo(x + ox + Math.cos(t) * q, y + oy + Math.sin(t) * q); } c.closePath(); c.fill(); }
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(.25, .25); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function haloTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'), g = c.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,214,140,1)'); g.addColorStop(.4, 'rgba(255,190,100,.4)'); g.addColorStop(1, 'rgba(255,170,80,0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// イルミネーションのにじみ（白→透明。頂点の色で色をつける）
function glowTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.2, 'rgba(255,255,255,.55)'); g.addColorStop(.5, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// 影の板に貼る絵（まん中が濃く、ふちへなめらかに消える）
function shadowTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.45, 'rgba(0,0,0,.7)'); g.addColorStop(.75, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv);
}
// 丸みのある長方形の島（中心 0,0。半分の大きさ hx, hz、角の丸み r）。y が世界の −z になる向きなので、あとで回す
function islandGeo(hx, hz, r, depth) {
  const s = new THREE.Shape(), q = Math.PI / 2;
  s.moveTo(-hx + r, -hz); s.lineTo(hx - r, -hz); s.absarc(hx - r, -hz + r, r, -q, 0, false); s.lineTo(hx, hz - r); s.absarc(hx - r, hz - r, r, 0, q, false);
  s.lineTo(-hx + r, hz); s.absarc(-hx + r, hz - r, r, q, 2 * q, false); s.lineTo(-hx, -hz + r); s.absarc(-hx + r, -hz + r, r, 2 * q, 3 * q, false);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 14 }); g.rotateX(-Math.PI / 2); return g;
}
// 影の板：5×5 に刻んだ板（頂点ごとの位置は shadowUpdate が太陽に合わせて毎回おきなおす。家の中にはみ出す頂点は壁ぎわへ押し出す）
const SH_N = 5, SU = [], SV = [];
for (let i = 0; i < SH_N; i++) for (let j = 0; j < SH_N; j++) {
  const q = (u, v) => [-1 + 2 * u / SH_N, -1 + 2 * v / SH_N], P0 = q(i, j), P1 = q(i + 1, j), P2 = q(i + 1, j + 1), P3 = q(i, j + 1);
  for (const v of [P0, P2, P1, P0, P3, P2]) { SU.push(v[0]); SV.push(v[1]); }
}
function shGeo() {
  const n = SU.length, g = new THREE.BufferGeometry(), uv = new Float32Array(n * 2), nr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { uv[i * 2] = .5 + .5 * SU[i]; uv[i * 2 + 1] = .5 + .5 * SV[i]; nr[i * 3 + 1] = 1; }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(nr, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}
// 細い棒（a→b。電線・ポール）
const _wo = new THREE.Object3D();
function wireSeg(a, b, w, c) {
  const len = a.distanceTo(b), g = bxg(w, w, len, c), vert = Math.abs(b.y - a.y) > .98 * len; _wo.position.copy(a).add(b).multiplyScalar(.5); _wo.up.set(vert ? 1 : 0, vert ? 0 : 1, 0); _wo.lookAt(b); _wo.updateMatrix(); g.applyMatrix4(_wo.matrix); return g;
}
const LC = [[1, .28, .25], [1, .78, .28], [.35, 1, .5], [.5, .72, 1], [1, .55, .9], [1, .93, .8], [.8, .92, 1]];   // イルミネーションの色（赤・金・緑・青・ピンク・あたたかい白・氷の白）
const extOf = box => ({ cx: (box.x0 + box.x1) / 2, cz: (box.z0 + box.z1) / 2, hx: (box.x1 - box.x0) / 2 + OUT_M, hz: (box.z1 - box.z0) / 2 + OUT_M });
const ISR = OUT_R;   // 島の角の丸み
// 庭の物の台帳：増築で作りなおしても、今ある木・植え込み・花は場所も形もそのまま。広がった分にだけ、続きの乱数で足す
const newReg = () => ({ tree: [], bush: [], flower: [], weed: [], rw: rngOf(3456), rt: rngOf(1234), rb: rngOf(5678), rf: rngOf(9012), ns: 0 });
let reg = newReg();
const lcolOf = (leaf, r) => () => C(leaf[(r() * leaf.length) | 0]);
function build(box, anim, o) {   // o = { mt: 窓の外の景色用の材質（あれば、影・イルミ・縮みの仕組みには入れない）, rec: 置いたものの位置を入れて返す（歩く判定用）, door: 玄関の外の1マスの中心（data.js の entryPoint）}
  o = o || {}; const win = !!o.mt, mt = o.mt || mats, door = o.door, rec = o.rec;
  const { cx, cz, hx, hz } = extOf(box), R = ISR, leaf = LEAF[season()];
  hides = []; occ = []; shE = []; shRef = null; litB = litH = null; lit = []; builtXmas = xmasOn();
  const props = [], leaves = [], bulbs = [], halos = [], shd = [], obs = [], fences = [], gates = [], dens = (isSmall() ? .65 : 1.3), xm = builtXmas && !win, LCAP = isSmall() ? 330 : 640;   // obs = 置いたものの位置と半径（重ならないように）
  let fr = false;   // いま作っているものが「広がった分に足す新しいもの」か（のびる島のあとで根もとから育つ）
  // 島の内側か（縁から s だけ内側）・家からの距離
  const inIsland = (x, z, s) => { const qx = Math.abs(x - cx) - (hx - R), qz = Math.abs(z - cz) - (hz - R); return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - R < -s; };
  const dHouse = (x, z) => Math.hypot(Math.max(box.x0 - x, 0, x - box.x1), Math.max(box.z0 - z, 0, z - box.z1));
  const free = (x, z, r, noFence) => obs.every(o => (noFence && o.fence) || Math.hypot(o.x - x, o.z - z) > o.r + r);
  const tag = (g, x, z, th, oc) => { g.userData.c = [x, z]; g.userData.th = th || 0; if (fr) { g.userData.fr = 1; g.userData.gd = .3 + .25 * hash(x * 3.1 + z * 7.7); } if (oc) { g.userData.occ = oc; occ.push(oc); } return g; };   // 庭の「ひとまとまり」の印（中心の位置・低いものは th=1 で、少しおそく縮む）。カメラと家のあいだに来たら縮ませる（hideUpdate）
  // 地面の影の板（r = 根もとの幅、h = 高さ、q = 影の中心の寄り：細いものは .5）。形は太陽の高さ・向きで shadowUpdate が決める
  const shade = (x, z, r, h, th, q) => { if (win) return; shE.push({ x, z, r, h, q: q || .4 }); shd.push(tag(shGeo(), x, z, th)); };
  // イルミネーションの光の玉（own = 親の物の props 内の番号。親が縮むとき一緒に縮む）。波がわたるように、位置と色で明るさの位相をずらす
  const addL = (x, y, z, ci, own, s) => { if (lit.length < LCAP) lit.push({ x, y, z, c: LC[ci % LC.length], own, s: s || 1, ph: (x + z) * .75 + ci * 1.1, o: null }); };
  // 柵：家のまわりを四角に囲む。手前の2辺（+x 側と +z 側）は真ん中が門のすきま、左（−x）と後ろ（−z）は門なし
  const F = 2.6, post = c => bxg(.1, .72, .1, c), fc = C(0xf1e6cf), gw = C(0x2a5a34), posts = new Set();
  const fx0 = box.x0 - F, fx1 = box.x1 + F, fz0 = box.z0 - F, fz1 = box.z1 + F;
  fr = anim;
  const garland = (x0, z0, x1, z1) => {   // 柵の1区間に、たるませた電線とライト
    const top = GY + .76, n = 5, sag = .2, pts = [], at = s => top - sag * 4 * s * (1 - s);
    for (let i = 0; i <= n; i++) { const s = i / n; pts.push(new THREE.Vector3(x0 + (x1 - x0) * s, at(s), z0 + (z1 - z0) * s)); }
    const segs = []; for (let i = 0; i < n; i++) segs.push(wireSeg(pts[i], pts[i + 1], .016, gw));
    props.push(tag(mergeGeometries(segs), (x0 + x1) / 2, (z0 + z1) / 2, 1)); segs.forEach(g => g.dispose());
    const own = props.length - 1, nb = isSmall() ? 3 : 5;
    for (let j = 0; j < nb; j++) { const s = (j + 1) / (nb + 1); addL(x0 + (x1 - x0) * s, at(s) - .03, z0 + (z1 - z0) * s, j + (x0 + z0 > 0 ? 1 : 0), own); }
  };
  const side = (ax, at, gate) => {   // ax = 'x'（x = at の線。z 方向に並ぶ）/ 'z'（z = at の線。x 方向に並ぶ）
    const a0 = ax === 'x' ? fz0 : fx0, a1 = ax === 'x' ? fz1 : fx1, n = Math.max(2, Math.round((a1 - a0) / 1.2)), st = (a1 - a0) / n, mid = (a0 + a1) / 2;
    if (gate) gates.push(ax === 'x' ? [at, mid] : [mid, at]);
    for (let i = 0; i < n; i++) {
      const p0 = a0 + i * st, p1 = p0 + st, m = (p0 + p1) / 2; if (gate && Math.abs(m - mid) < 1.4) continue;
      fences.push(ax === 'x' ? [at, p0, at, p1] : [p0, at, p1, at]);
      for (const pp of [p0, p1]) { const px = ax === 'x' ? at : pp, pz = ax === 'x' ? pp : at, k = px.toFixed(2) + ',' + pz.toFixed(2); if (!posts.has(k)) { posts.add(k); shade(px, pz, .1, .72, 1, .5); props.push(tag(place(post(fc), px, GY + .36, pz), px, pz, 1)); obs.push({ x: px, z: pz, r: .35, c: .25, k: 'post', fence: 1 }); } }
      for (const y of [.58, .28]) props.push(tag(ax === 'x' ? place(bxg(.05, .07, st, fc), at, GY + y, m) : place(bxg(st, .07, .05, fc), m, GY + y, at), ax === 'x' ? at : m, ax === 'x' ? m : at, 1));
      if (xm) { if (ax === 'x') garland(at, p0, at, p1); else garland(p0, at, p1, at); }
    }
  };
  side('x', fx1, true); side('z', fz1, true); side('x', fx0, false); side('z', fz0, false);
  const offFence = (x, z, r) => Math.abs(x - fx0) > r && Math.abs(x - fx1) > r && Math.abs(z - fz0) > r && Math.abs(z - fz1) > r;   // 柵の線にかからない
  // 街灯：柵の手前の角と、左右の角
  [[fx1 + .5, fz1 + .5], [fx1 + .5, fz0 - .5], [fx0 - .5, fz1 + .5]].forEach(([x, z]) => {
    if (!inIsland(x, z, 1)) return; obs.push({ x, z, r: 1, c: .3, k: 'lamp' });
    shade(x, z, .16, 2.1, 0, .5); props.push(tag(place(cyg(.05, .07, 2.1, 6, C(0x3a3f4c)), x, GY + 1.05, z), x, z), tag(place(bxg(.34, .06, .34, C(0x3a3f4c)), x, GY + 2.16, z), x, z));
    bulbs.push(tag(place(prep(new THREE.SphereGeometry(.15, 8, 6)), x, GY + 1.98, z), x, z));
    const hg = prep(new THREE.PlaneGeometry(3.6, 3.6)); hg.rotateX(-Math.PI / 2); halos.push(tag(place(hg, x, GY + .03, z), x, z));
  });
  // 玄関から柵の門までの「とおり道」には、木・植え込み・花を置かない（庭を歩けるように。歩く判定には使わない c:0）。door = 玄関の外の1マスの中心（data.js の entryPoint）
  if (door) {
    const gx = (fx0 + fx1) / 2, gz = fz1, ps = [[door.x, door.z + 1]];
    for (let x = door.x; Math.abs(x - gx) > 1; x += Math.sign(gx - x)) ps.push([x, door.z + 1]);   // 横：玄関の前から門の前まで
    for (let z = door.z + 1; z < gz + 2.5; z++) ps.push([gx, z]);   // 縦：門を通って柵の外まで
    ps.forEach(([x, z]) => obs.push({ x, z, r: .5, c: 0, k: 'path' }));
  }
  fr = false;
  // 木：家の左右のななめうしろ（標準のカメラで、家にかくれず見える所）に。手前には置かない（家をさえぎるので）。種類は4つ（リンゴの木・スギ・ナシの木・低く広い木＝春は桜）
  // tr = 幹 [上の半径, 下の半径, 高さ]、cr = 冠 [x, y, z, 半径, 縦の倍率, 葉の枚数, 葉の大きさ]、sh = 影の幅（根もとの半径の目安）、r = 置く間隔
  const spring = season() === 'spring', GREENS = [0x3f9e48, 0x46a54e, 0x3a9844, 0x4dac52], AUT = [0xe0b83c, 0x6fae3c, 0xe0a040, 0xa8c040, 0xe8cc4a, 0x5fa83f], AUTB = [0x4f9a3a, 0x5aa43f, 0x4a963a, 0x6bb045, 0xc8aa3a], pink = [0xf2b8c8, 0xf6d0da, 0xe9a0b8, 0xf0a8c0], evg = [0x3f8f66, 0x4a9a6e, 0x357f5b, 0x56a578];
  const FOL = season() === 'green' ? GREENS : season() === 'autumn' ? AUT : leaf;   // 葉の色の組（秋は黄緑・金・黄土・うす橙。真っ赤にしない）
  // あつ森の木（docs/art_style_trees_flowers.md）。tr = 幹 [上の半径, 下の半径, 見える高さ]、cr = 冠のかたまり [x, y, z, 横の半径, 縦の倍率]（スギは段 [x, 段の中心の y, z, 下の半径, 高さの倍率]）、sh = 影の幅、r = 置く間隔、fruit = 実の色
  const TREES = [
    { tr: [.38, .42, 1.55], cr: [[0, 2.35, 0, 1.25, .95], [1, 2.1, .2, .82, .95], [-1, 2.15, -.15, .82, .95], [.1, 3.05, .1, .85, .95], [.25, 2.05, -.95, .72, .95], [-.2, 2.05, .95, .7, .95]], sh: 1.5, r: 1.7, fruit: 0xe0392b },
    { tr: [.27, .3, .9], cr: [[0, 1.6, 0, 1.1, .5], [0, 2.25, 0, .92, .5], [0, 2.85, 0, .74, .5], [0, 3.4, 0, .56, .5], [0, 3.85, 0, .36, .55]], sh: 1.1, r: 1.3, col: evg, cone: 1 },
    { tr: [.31, .34, 1.45], cr: [[0, 2.4, 0, .95, 1.15], [.55, 2.1, .1, .65, .9], [-.55, 2.2, -.1, .65, .9], [0, 3.25, 0, .65, .9], [0, 1.95, .55, .6, .8], [0, 2, -.55, .6, .8]], sh: 1.1, r: 1.4, fruit: 0xc4d84a },
    { tr: [.37, .4, 1.05], cr: [[0, 1.95, 0, 1.3, .85], [1.1, 1.75, .3, .85, .85], [-1.1, 1.8, -.3, .85, .85], [.2, 2.5, 0, .9, .85]], sh: 1.6, r: 1.9, col: spring ? pink : null }
  ];
    const kA = (2 * hx) * (2 * hz) / 256, nT = Math.min(14, Math.max(5, Math.round(5 * kA))), nB = Math.min(22, Math.max(9, Math.round(9 * kA))), nF = Math.min(26, Math.max(10, Math.round(10 * kA)));   // 島が広がるほど、数も増える（基準は 6×6 の家の島）
  // すでにある物のうち、まだ置ける物だけ残す（家が大きくなって重なった物は外す。ほかは動かさない）
  reg.tree = reg.tree.filter(it => { if (!inIsland(it.x, it.z, 1.5) || dHouse(it.x, it.z) < 1.2 || !free(it.x, it.z, 1.5, true) || !offFence(it.x, it.z, .6) || !free(it.x, it.z, .6)) return false; obs.push({ x: it.x, z: it.z, r: it.or, c: it.or / 1.4, k: 'tree' }); return true; });
  reg.bush = reg.bush.filter(it => { if (!inIsland(it.x, it.z, 1) || dHouse(it.x, it.z) < .7 || !free(it.x, it.z, .8)) return false; obs.push({ x: it.x, z: it.z, r: .8, c: .65, k: 'bush' }); return true; });
  reg.flower = reg.flower.filter(it => { if (!inIsland(it.x, it.z, 1) || dHouse(it.x, it.z) < .6 || !free(it.x, it.z, .6)) return false; obs.push({ x: it.x, z: it.z, r: .6, c: .5, k: 'flower' }); return true; });
  // 足りないぶんを、続きの乱数で足す
  const bcs = cx + cz, rt = reg.rt, rb = reg.rb, rf = reg.rf;
  for (let n = 0; n < 400 && reg.tree.length < nT; n++) {
    const x = cx + (rt() - .5) * 2 * (hx - 1.5), z = cz + (rt() - .5) * 2 * (hz - 1.5);
    if (!inIsland(x, z, 1) || dHouse(x, z) < 1.8 || (x - cx) + (z - cz) > 3 || (x - cx) + (z - cz) < -5.5 || Math.abs((x - cx) - (z - cz)) < (box.x1 - box.x0 + box.z1 - box.z0) * .4 || !free(x, z, 1.5, true) || !offFence(x, z, .6) || !free(x, z, .6)) continue;   // 枝は柵の上に張り出してよい（幹は柵にかけない）
    const last = reg.tree.length ? reg.tree[reg.tree.length - 1].kd : -1; let kd = (rt() * TREES.length) | 0; if (kd === last) kd = (kd + 1 + ((rt() * (TREES.length - 1)) | 0)) % TREES.length;   // 同じ種類が続かない
    const ma = .15 + rt() * .45, it = { x, z, kd, sc: 1.2 + rt() * .35, s0: (rt() * 90) | 0, ma, mx1: (1 - ma) * (.3 + rt() * .4), rot: rt() * 6.28, seed: ++reg.ns * 7919 + 13, fr: anim };
    it.or = TREES[kd].r * it.sc * .7; reg.tree.push(it); obs.push({ x, z, r: it.or, c: it.or / 1.4, k: 'tree' });
  }
  for (let n = 0; n < 300 && reg.bush.length < nB; n++) {
    const x = cx + (rb() - .5) * 2 * (hx - 1), z = cz + (rb() - .5) * 2 * (hz - 1), dh = dHouse(x, z);
    if (!inIsland(x, z, 1) || dh < 1.2 || dh > 3.4 || !free(x, z, .8)) continue;
    reg.bush.push({ x, z, br: .45 + rb() * .2, s0: (rb() * 90) | 0, rot: rb() * 6.28, seed: ++reg.ns * 7919 + 13, fr: anim }); obs.push({ x, z, r: .8, c: .65, k: 'bush' });
  }
  const fcols = [0xf0454f, 0xffd83a, 0xfffbe8, 0xff8fb0, 0xff8a3a, 0xb99cff];   // 赤・黄・白・ピンク・オレンジ・むらさき（はっきりした色）
  for (let n = 0; n < 300 && reg.flower.length < nF; n++) {
    const x = cx + (rf() - .5) * 2 * (hx - 1), z = cz + (rf() - .5) * 2 * (hz - 1), dh = dHouse(x, z);
    if (!inIsland(x, z, 1) || dh < 1 || dh > 4 || !free(x, z, .6)) continue;
    reg.flower.push({ x, z, kd: (rf() * FLOWERS.length) | 0, pc: fcols[(rf() * fcols.length) | 0], seed: ++reg.ns * 7919 + 13, fr: anim }); obs.push({ x, z, r: .6, c: .5, k: 'flower' });
  }
  // 雑草のしげみ：庭のあちこちに（歩く判定は作らない。ほかの物と重ならない所だけ）
  const nW = Math.min(24, Math.max(6, Math.round((isSmall() ? 8 : 12) * kA)));
  reg.weed = reg.weed.filter(it => inIsland(it.x, it.z, .8) && dHouse(it.x, it.z) > .6 && free(it.x, it.z, .35));
  for (let n = 0, rw = reg.rw; n < 300 && reg.weed.length < nW; n++) {
    const x = cx + (rw() - .5) * 2 * (hx - .8), z = cz + (rw() - .5) * 2 * (hz - .8);
    if (!inIsland(x, z, .8) || dHouse(x, z) < .7 || !free(x, z, .4)) continue;
    reg.weed.push({ x, z, seed: ++reg.ns * 7919 + 13, fr: anim });
  }
  // 木を作る
  const treeTop = [];
  reg.tree.forEach(it => {
    fr = !!it.fr;
    const T = TREES[it.kd], sc = it.sc, r2 = rngOf(it.seed), cf = T.col ? () => C(T.col[(r2() * T.col.length) | 0]) : lcolOf(FOL, r2), TB = C(0xe6b062); setSun(it.rot);
    // 幹は太く短く・根もとが広がり（根が3〜4本、足のように張り出す）、てっぺんは樹冠の芯の中まで。葉は1枚ずつのうろこ（leafCrown）
    const tb = T.tr[1], parts = [trunkGeo(T.tr[0], tb, T.tr[2] + .6, TB, r2)], O = { p: [], n: [], c: [] }, Q = { p: [], n: [], c: [], uv: [] }, c0 = cf(), lk = isSmall() ? 1.25 : 1;
    if (T.cone) cedarGeo(O, T.cr, c0, cf, r2, lk);
    else {
      const lumps = T.cr.map(([x, y, z, r, ys]) => [x, y, z, r, r * ys]), yb = Math.min(...lumps.map(q => q[1] - q[4] * .62)), yt = Math.max(...lumps.map(q => q[1] + q[4]));
      leafCrown(O, Q, lumps, c0, cf, r2, .74 * lk, yb, yt, it.s0, .5, season() === 'autumn'); if (T.fruit) fruitsOn(O, lumps, C(T.fruit), r2, it.s0);
    }
    parts.push(geoOf(O));
    const oc = { x: it.x, z: it.z, r: Math.max(...T.cr.map(q => Math.hypot(q[0], q[2]) + q[3])) * sc, y0: GY + Math.min(...T.cr.map(q => q[1] - q[3] * q[4])) * sc, y1: GY + Math.max(...T.cr.map(q => q[1] + q[3] * q[4])) * sc, f: 1 };
    props.push(tag(place(mergeGeometries(parts), it.x, GY, it.z, it.rot, sc), it.x, it.z, 0, oc)); parts.forEach(g => g.dispose());
    if (Q.p.length) leaves.push(tag(place(geoOf(Q), it.x, GY, it.z, it.rot, sc), it.x, it.z, 0));
    shade(it.x, it.z, T.sh * sc, oc.y1 - GY, 0, .4);
    if (xm) {   // 木にイルミネーション（冠のまわりに、らせん状に光の玉を巻く）
      const own = props.length - 1, bud = Math.max(8, Math.floor((isSmall() ? 150 : 300) / Math.max(1, reg.tree.length))), tot = T.cr.reduce((a, q) => a + q[3] * q[3] * q[4], 0), cs = Math.cos(it.rot), sn = Math.sin(it.rot);
      T.cr.forEach(([px, py, pz, pr, ys], ci) => {
        const nn = Math.max(3, Math.round(bud * pr * pr * ys / tot)), rr = pr * 1.22;
        for (let j = 0; j < nn; j++) {
          const u = -.55 + 1.55 * (j + .5) / nn, th = j * 2.39996 + ci, sq = Math.sqrt(1 - u * u), lx = px + sq * Math.cos(th) * rr, ly = py + u * rr * ys, lz = pz + sq * Math.sin(th) * rr;
          addL(it.x + (lx * cs + lz * sn) * sc, GY + ly * sc, it.z + (-lx * sn + lz * cs) * sc, j + ci * 2, own);
        }
      });
      if (it.kd === 1 || it.kd === 2) { const q = T.cr[T.cr.length - 1]; treeTop.push({ it, own, kd: it.kd, y: GY + (q[1] + q[3] * q[4] + .35) * sc }); }
    }
  });
  // 植え込み：家のまわりに点々と
  reg.bush.forEach(it => {
    fr = !!it.fr; const r2 = rngOf(it.seed), lc = lcolOf(season() === 'autumn' ? AUTB : FOL, r2), rr = it.br * 1.4; setSun(it.rot);
    const O = { p: [], n: [], c: [] }, Q = { p: [], n: [], c: [], uv: [] }, lumps = [[0, rr * .5, 0, rr * 1.1, rr * .78]];
    leafCrown(O, Q, lumps, lc(), lc, r2, .34 * (isSmall() ? 1.25 : 1), .06, rr * 1.3, it.s0, .12);
    shade(it.x, it.z, rr * .95, .7, 1, .4);
    props.push(tag(place(geoOf(O), it.x, GY, it.z, it.rot), it.x, it.z, 1, { x: it.x, z: it.z, r: rr * 1.1, y0: GY, y1: GY + rr * 1.3, f: 1 }));
    if (Q.p.length) leaves.push(tag(place(geoOf(Q), it.x, GY, it.z, it.rot), it.x, it.z, 1));
  });
  // 花
  reg.flower.forEach(it => {
    fr = !!it.fr; const r2 = rngOf(it.seed), kd = it.kd, pc = C(it.pc), pc2 = C(fcols[(fcols.indexOf(it.pc) + 1) % fcols.length]), cc = C(kd === 1 ? 0xffc83a : 0xffc21a), parts = [];
    // 花壇：2〜3列 × 2〜3行を、ずらした格子に植える（あつ森の花壇のまとまり）。チューリップは赤・黄など2色を交互に
    const cols = season() === 'winter' ? 2 : 3, rows = isSmall() ? 2 : season() === 'spring' ? 3 : 2, sp = .38, ra = r2() * 6.28, ca = Math.cos(ra), sa = Math.sin(ra);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const gx = (i - (cols - 1) / 2) * sp + (j & 1 ? sp / 2 : 0) + (r2() - .5) * .05, gz = (j - (rows - 1) / 2) * sp * .9 + (r2() - .5) * .05;
      parts.push(place(flowerGeo(kd, kd === 2 && (i + j) % 2 ? pc2 : pc, cc, r2), it.x + gx * ca - gz * sa, GY, it.z + gx * sa + gz * ca, r2() * 6.28, 1.15 + r2() * .3));
    }
    props.push(tag(mergeGeometries(parts), it.x, it.z, 1)); parts.forEach(g => g.dispose());
    shade(it.x, it.z, .75, .3, 1, .4);
  });
  // 雑草
  const wk = { green: [0x9fdc5a, 0x2f8a3a, 0x3aa04a], spring: [0xa8e060, 0x2f8a3a, 0x3aa04a], autumn: [0xcdb84a, 0x7a8a3a, 0x7a9a3a], winter: [0xcfcf9a, 0x8a9a6a, 0x8aa07a] }[season()] || [0x9fdc5a, 0x2f8a3a, 0x3aa04a];
  reg.weed.forEach(it => {
    fr = !!it.fr; const r2 = rngOf(it.seed), parts = [], nt = 2 + ((r2() * 2) | 0);
    for (let k = 0; k < nt; k++) { const an = r2() * 6.28, rd = .05 + .25 * r2(); parts.push(place(weedGeo(0, r2, C(wk[0]), C(wk[1])), it.x + Math.cos(an) * rd, GY, it.z + Math.sin(an) * rd, r2() * 6.28, .85 + r2() * .4)); }
    { const an = r2() * 6.28, rd = .2 + .15 * r2(); parts.push(place(weedGeo(1, r2, C(wk[2]), C(wk[1])), it.x + Math.cos(an) * rd, GY, it.z + Math.sin(an) * rd, r2() * 6.28, 1)); }
    props.push(tag(mergeGeometries(parts), it.x, it.z, 1)); parts.forEach(g => g.dispose());
  });
  // ----- 12/24 のイルミネーション：もみの木のてっぺんの星・家のまわりの線・庭の端の雪の結晶 -----
  fr = false;
  if (xm) {
    const RX = .7071, RZ = -.7071;   // 板の横向き（標準のカメラの画面の右）
    const top = treeTop.find(q => q.kd === 1) || treeTop.find(q => q.kd === 2);
    if (top) for (let k = 0; k < 5; k++) {   // 5つ角の星（金色）
      const a = Math.PI / 2 + k * 2 * Math.PI / 5, a2 = a + Math.PI / 5;
      for (const rr of [.17, .34]) addL(top.it.x + RX * Math.cos(a) * rr, top.y + Math.sin(a) * rr, top.it.z + RZ * Math.cos(a) * rr, 1, top.own, 1.3);
      addL(top.it.x + RX * Math.cos(a2) * .17, top.y + Math.sin(a2) * .17, top.it.z + RZ * Math.cos(a2) * .17, 5, top.own, 1);
    }
    // 家のまわり：地面すれすれに、ぐるりと光の玉の線
    const x0 = box.x0 - .5, x1 = box.x1 + .5, z0 = box.z0 - .5, z1 = box.z1 + .5, W = x1 - x0, D = z1 - z0, per = 2 * (W + D), nr = Math.min(isSmall() ? 64 : 130, Math.round(per / .34)), sp = per / nr;
    for (let i = 0; i < nr; i++) {
      const q = i * sp, x = q < W ? x0 + q : q < W + D ? x1 : q < 2 * W + D ? x1 - (q - W - D) : x0, z = q < W ? z0 : q < W + D ? z0 + (q - W) : q < 2 * W + D ? z1 : z1 - (q - 2 * W - D);
      addL(x, GY + .14, z, i % 5, -1, .85);
    }
    // 庭の遠い角に、雪の結晶（細い柱＋6本のうでに光の玉）
    const gi = C(0xcfe3f2), gp = C(0x59606e), nFl = isSmall() ? 1 : 2;
    [[cx + hx - 2.4, cz - hz + 2.4], [cx - hx + 2.4, cz + hz - 2.4]].slice(0, nFl).forEach(([x, z]) => {
      if (!inIsland(x, z, 1.5) || !free(x, z, .9)) return; obs.push({ x, z, r: .9, c: .4, k: 'crystal' });
      const cy = GY + 2.5, PP = (u, v) => new THREE.Vector3(x + RX * u, cy + v, z + RZ * u), segs = [wireSeg(new THREE.Vector3(x, GY, z), new THREE.Vector3(x, cy, z), .05, gp)], ls = [[0, 0, 6]];
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 2 + k * Math.PI / 3;
        segs.push(wireSeg(PP(0, 0), PP(Math.cos(a) * 1.05, Math.sin(a) * 1.05), .022, gi));
        for (const t of isSmall() ? [.4, .7, 1] : [.28, .52, .76, 1]) ls.push([Math.cos(a) * t, Math.sin(a) * t, 6]);
        for (const [t, bl] of isSmall() ? [[.6, .3]] : [[.55, .32], [.8, .2]]) for (const sg of [-1, 1]) {
          const bb = a + sg * Math.PI / 3, qx = Math.cos(a) * t, qy = Math.sin(a) * t, ex = qx + Math.cos(bb) * bl, ey = qy + Math.sin(bb) * bl;
          segs.push(wireSeg(PP(qx, qy), PP(ex, ey), .016, gi)); ls.push([ex, ey, 3]);
        }
      }
      fr = anim; props.push(tag(mergeGeometries(segs), x, z, 0)); segs.forEach(g => g.dispose()); fr = false;
      const own = props.length - 1; ls.forEach(([u, v, ci]) => { const P = PP(u, v); addL(P.x, P.y, P.z, ci, own, 1.1); });
    });
  }
  reg.tree.concat(reg.bush, reg.flower, reg.weed).forEach(it => { it.fr = false; });
  // まとめる（材質ごとに1つ）
  const meshes = [];
  const merged = (list, mat, order) => {
    if (!list.length) return null;
    const objs = []; let off = 0;
    list.forEach(q => { let c = q.userData.c; if (!c) { q.computeBoundingBox(); const b = q.boundingBox; c = [(b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2]; } const n = q.attributes.position.count, f = q.userData.fr ? 1 : 0; objs.push({ off, n, cx: c[0], cz: c[1], th: q.userData.th || 0, f: 1, occ: q.userData.occ, g: f ? 0 : 1, gr: f, gd: q.userData.gd || 0 }); off += n; });
    const g = mergeGeometries(list); list.forEach(q => q.dispose()); const m = new THREE.Mesh(g, mat); if (order != null) m.renderOrder = order; meshes.push(m);
    const rec = { g, base: Float32Array.from(g.attributes.position.array), objs }; hides.push(rec); return { h: rec, mesh: m };
  };
  const IS = win ? { cx, cz, hx, hz } : isD, ig = islandGeo(IS.hx, IS.hz, R, 1.4); ig.translate(IS.cx, GY - 1.4, IS.cz);
  const isl = new THREE.Mesh(ig, [mt.grass, mt.soil]); meshes.push(isl); if (!win) islandMesh = isl;
  shRef = merged(shd, mt.shadow, 1); const pR = merged(props, mt.props); merged(leaves, mt.leaf); merged(bulbs, mt.bulb); merged(halos, mt.halo, 3);
  if (lit.length) buildLit(pR, meshes);
  if (rec) { rec.obs = obs; rec.fences = fences; rec.gates = gates; }
  return meshes;
}
// イルミネーション：光の玉（八面体を1つにまとめた mesh）とにじみ（カメラのほうを向く板を1つにまとめた mesh）。位置・色は litUpdate が毎回書きかえる
const OCT = []; for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) OCT.push(sx, 0, 0, 0, sy, 0, 0, 0, sz);
function buildLit(pR, meshes) {
  const n = lit.length, dyn = a => { a.setUsage(THREE.DynamicDrawUsage); return a; }, huv = new Float32Array(n * 12);
  lit.forEach(l => { l.o = l.own >= 0 && pR ? pR.h.objs[l.own] : null; });
  for (let i = 0; i < n; i++) huv.set([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], i * 12);
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', dyn(new THREE.BufferAttribute(new Float32Array(n * 72), 3))); bg.setAttribute('color', dyn(new THREE.BufferAttribute(new Float32Array(n * 72), 3)));
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', dyn(new THREE.BufferAttribute(new Float32Array(n * 18), 3))); hg.setAttribute('color', dyn(new THREE.BufferAttribute(new Float32Array(n * 18), 3))); hg.setAttribute('uv', new THREE.BufferAttribute(huv, 2));
  litB = new THREE.Mesh(bg, mats.lbulb); litH = new THREE.Mesh(hg, mats.glow); litH.renderOrder = 4; litB.frustumCulled = litH.frustumCulled = false; litH.userData.noAO = true;   // にじみの板は陰影（GTAO）の計算からはずす（四角い影が出ないように）
  meshes.push(litB, litH); litDirty = true;
}
const litAnim = () => lit.length > 0 && litK > .01 && motionOK();
const camKey = () => { if (!hCam) return ''; const e = hCam.matrixWorld.elements; return [e[0], e[1], e[2], e[4], e[5], e[6]].map(v => v.toFixed(3)).join(','); };
function litUpdate(now) {
  if (!litB) return; const on = litK > .01; litB.visible = litH.visible = on; if (!on) return;
  const e = hCam ? hCam.matrixWorld.elements : null, rx = e ? e[0] : .7071, ry = e ? e[1] : 0, rz = e ? e[2] : -.7071, ux = e ? e[4] : 0, uy = e ? e[5] : 1, uz = e ? e[6] : 0, t = now / 1000, an = motionOK();
  const bp = litB.geometry.attributes.position, bc = litB.geometry.attributes.color, hp = litH.geometry.attributes.position, hc = litH.geometry.attributes.color, br = bp.array, bk = bc.array, hr = hp.array, hk = hc.array, K = litK;
  for (let i = 0; i < lit.length; i++) {
    const l = lit[i], o = l.o, f = o ? o.f : 1; let x = l.x, y = l.y, z = l.z;
    if (o) { x = o.cx + (x - o.cx) * f; z = o.cz + (z - o.cz) * f; y = GY + (y - GY) * f; }
    const b = an ? .62 + .38 * Math.sin(t * 1.7 + l.ph) : .8, s = l.s * f * K, q = .085 * s, cr = l.c[0] * (.5 + .9 * b) * K, cg = l.c[1] * (.5 + .9 * b) * K, cb = l.c[2] * (.5 + .9 * b) * K;
    for (let v = 0, o3 = i * 72; v < 24; v++, o3 += 3) { br[o3] = x + OCT[v * 3] * q; br[o3 + 1] = y + OCT[v * 3 + 1] * q; br[o3 + 2] = z + OCT[v * 3 + 2] * q; bk[o3] = cr; bk[o3 + 1] = cg; bk[o3 + 2] = cb; }
    const hs = .4 * s * (.75 + .25 * b), hk0 = (.2 + .5 * b) * K, h0 = i * 18, X = rx * hs, Y = ry * hs, Z = rz * hs, U = ux * hs, V = uy * hs, W = uz * hs;
    const cs = [[-X - U, -Y - V, -Z - W], [X - U, Y - V, Z - W], [X + U, Y + V, Z + W], [-X + U, -Y + V, -Z + W]];
    [0, 1, 2, 0, 2, 3].forEach((c, k) => { const o3 = h0 + k * 3; hr[o3] = x + cs[c][0]; hr[o3 + 1] = y + cs[c][1]; hr[o3 + 2] = z + cs[c][2]; hk[o3] = l.c[0] * hk0; hk[o3 + 1] = l.c[1] * hk0; hk[o3 + 2] = l.c[2] * hk0; });
  }
  bp.needsUpdate = bc.needsUpdate = hp.needsUpdate = hc.needsUpdate = true;
}
// 影を太陽（夜は月）に合わせておきなおす：影の中心を光と反対へずらし、長さにあわせてのばし、向きに合わせて回す。家の中にはみ出す頂点は壁ぎわへ押し出す
function shadowUpdate(L) {
  if (!shRef || !lastBox) return; const { g, base, objs } = shRef.h, p = g.attributes.position.array, X0 = lastBox.x0 - .06, X1 = lastBox.x1 + .06, Z0 = lastBox.z0 - .06, Z1 = lastBox.z1 + .06, y = GY + .015, n = SU.length;
  for (let j = 0; j < shE.length; j++) {
    const e = shE[j], o = objs[j], len = e.h * L.m, sh = len * e.q, ra = e.r + sh, rb = e.r, ox = e.x - L.dx * sh, oz = e.z - L.dz * sh, f = o.f, cx = o.cx, cz = o.cz;
    for (let v = 0; v < n; v++) {
      let x = ox + L.dx * SU[v] * ra - L.dz * SV[v] * rb, z = oz + L.dz * SU[v] * ra + L.dx * SV[v] * rb;
      if (x > X0 && x < X1 && z > Z0 && z < Z1) { const da = x - X0, db = X1 - x, dc = z - Z0, dd = Z1 - z, m = Math.min(da, db, dc, dd); if (m === da) x = X0; else if (m === db) x = X1; else if (m === dc) z = Z0; else z = Z1; }
      const i = (o.off + v) * 3; base[i] = x; base[i + 1] = y; base[i + 2] = z; p[i] = cx + (x - cx) * f; p[i + 1] = GY + (y - GY) * f; p[i + 2] = cz + (z - cz) * f;
    }
  }
  g.attributes.position.needsUpdate = true;
}
function applyShadow(p) {
  const L = lightOf(p); mats.shadow.opacity = L.op;
  if (!shRef) return; shRef.mesh.visible = L.op > .005; if (L.op <= .005) return;
  if (!shDirty && shL && Math.abs(L.dx - shL.dx) + Math.abs(L.dz - shL.dz) + Math.abs(L.m - shL.m) < .002) return;
  shDirty = false; shL = L; shadowUpdate(L);
}
// 島の大きさを、いま見えている大きさ（isD）に作りなおす
function setIsland() { const g = islandGeo(isD.hx, isD.hz, ISR, 1.4); g.translate(isD.cx, GY - 1.4, isD.cz); islandMesh.geometry.dispose(); islandMesh.geometry = g; }
export function outHouse(box, door) {
  lastBox = box; lastDoor = door || null; if (!scene) return;
  const T = extOf(box), had = !!garden && garden.children.length > 0, anim = !!(had && isD && motionOK() && Math.abs(T.hx - isD.hx) + Math.abs(T.hz - isD.hz) + Math.abs(T.cx - isD.cx) + Math.abs(T.cz - isD.cz) > .02);   // 家の形が変わったら、島をのばす
  isT = T; if (!anim) isD = { ...T }; isAnim = anim ? { t0: performance.now() } : null;
  if (garden) { garden.children.forEach(m => m.geometry.dispose()); garden.clear(); }
  else { garden = new THREE.Group(); garden.name = 'outside'; scene.add(garden); }
  const rec = {}; build(box, anim, { rec, door: lastDoor }).forEach(m => { m.matrixAutoUpdate = false; m.updateMatrix(); garden.add(m); });
  lastYard = { box, M: OUT_M, R: OUT_R, obs: rec.obs, fences: rec.fences, gates: rec.gates, ver: ++yardVer };   // 歩く判定 yard.js へ（outYard）
  shDirty = true; litDirty = true;
  if (cur) applyMats(cur);
  hKey = ''; if (hCam) hideUpdate(hCam);
  if (anim) onDirty();
}
// のびるアニメ（島の大きさ・新しい物が根もとから育つ）。終わったら false
function stepIsland(now) {
  const p = Math.min(1, (now - isAnim.t0) / 900), e = 1 - Math.pow(1 - Math.min(1, p / .75), 3), a = isAnim.from || (isAnim.from = { ...isD });
  isD = p >= 1 ? { ...isT } : { cx: a.cx + (isT.cx - a.cx) * e, cz: a.cz + (isT.cz - a.cz) * e, hx: a.hx + (isT.hx - a.hx) * e, hz: a.hz + (isT.hz - a.hz) * e };
  setIsland();
  for (const h of hides) for (const o of h.objs) if (o.gr) o.g = p >= 1 ? 1 : sstep(o.gd, o.gd + .4, p);
  hKey = ''; if (hCam) hideUpdate(hCam); shDirty = true; if (cur) applyShadow(cur);
  if (p >= 1) { isAnim = null; return false; } return true;
}

// ----- 時間帯の反映 -----
function applyMats(p, mt, grp) {   // mt・grp を省くと、家のまわりの庭（mats・garden）
  mt = mt || mats; grp = grp || garden;
  const set = (m, base, t) => m.color.set(base).multiply(_t.setRGB(t[0], t[1], t[2]));   // もとの色 × 時間帯の倍率
  set(mt.grass, 0x6ed65e, p.grass); set(mt.props, 0xffffff, p.props); set(mt.leaf, 0xffffff, p.props); set(mt.soil, 0xd48c54, p.soil);
  mt.bulb.color.setRGB(.5 + 2.6 * p.lamp, .46 + 1.9 * p.lamp, .38 + .7 * p.lamp); mt.halo.opacity = .8 * p.lamp;
  if (grp) grp.children.forEach(m => { if (m.material === mt.halo) m.visible = p.lamp > .01; });
  if (mt !== mats) return;   // 窓の外の庭は色だけ（光の玉・影はない）
  litK = sstep(.35, .8, p.night); litDirty = true;   // イルミネーション：夜になるとなめらかに点く
  applyShadow(p);   // 影：太陽の向き・長さ・濃さ（夜は月・薄く）
}
function apply(p) {
  cur = p; SKY.night.value = p.night; if (scene) scene.backgroundIntensity = p.bg;
  if (mats) applyMats(p);
  if (bgTex) { paintSky(p, 0, 1, 0, 1); lastA = aspectOf(); }
  if (GPU.on) gpuDirty();
}
// h = 目標の時刻。少し動くだけならそのまま描きなおす（太陽は少しずつ動く）。大きく変わったら約1秒かけてなめらかに
function start(h) {
  if (!cur) { target = h; apply(paramsAt(h)); return; }
  while (h - cur.h > 12) h -= 24; while (cur.h - h > 12) h += 24;   // 0 時をまたいでも、太陽が逆戻りしないように
  if (Math.abs(h - target) < 1e-4) return; target = h;
  if (Math.abs(h - cur.h) < .05) { from = to = null; apply(paramsAt(h)); onDirty(); return; }
  from = cur; to = paramsAt(h); t0 = performance.now(); onDirty();
}
// カメラと家のあいだ（カメラ側）に来た木・植え込み・柵・街灯を、根もとへなめらかに縮める（部屋の中がさえぎられないように）。
// 縮み方はカメラの向きで連続的に決まるので、回すとなめらかに変わる。頂点の位置をその場で書きかえる（描画の回数は増えない。WebGPU でも同じ）。カメラが動いたときだけ計算する
let hCam = null;
// 自分が庭に出ている間は、木・植え込みを縮めない（庭を見たいので、木で人が隠れてもよい。ユーザーの要望）。main.js が毎フレーム知らせる。切りかえはなめらかに
let voT = 0, voK = 0;
export function outSetViewerOut(on) { voT = on ? 1 : 0; }
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function hideUpdate(camera) {
  hCam = camera; if (!lastBox || !hides.length) return;
  const cx = (lastBox.x0 + lastBox.x1) / 2, cz = (lastBox.z0 + lastBox.z1) / 2, dx = camera.position.x - cx, dz = camera.position.z - cz, dist = Math.hypot(dx, dz);
  if (voK !== voT) voK = Math.abs(voT - voK) < .02 ? voT : voK + (voT - voK) * .12;
  const rr = Math.max(roofRise(), voK), key = dx.toFixed(2) + ',' + dz.toFixed(2) + ',' + rr.toFixed(3); if (key === hKey) return; hKey = key;
  // kk：カメラが家の中（一人称）なら縮めない。引いて外壁・屋根が立ち上がるにつれて、縮めた木をなめらかにもとの大きさへ（家の中が見えないので、さえぎる心配がない）
  const R = Math.max(lastBox.x1 - lastBox.x0, lastBox.z1 - lastBox.z0) / 2 + 2, kk = sstep(R * .6, R * 1.1, dist) * (1 - rr), ux = dx / (dist || 1), uz = dz / (dist || 1);   // kk：カメラが家の中（一人称）なら縮めない
  for (const h of hides) {
    const pa = h.g.attributes.position, p = pa.array, b = h.base; let ch = false;
    for (const o of h.objs) {
      const rx = o.cx - cx, rz = o.cz - cz, a = rx * ux + rz * uz - .5 * Math.abs(rx * uz - rz * ux) - o.th * 1.5, f = Math.max(.0005, (1 - sstep(.2, 2.4, a) * kk) * o.g);   // o.g = 新しく足した物が育つ度合い（ふだんは 1）
      if (Math.abs(f - o.f) < .002) continue; o.f = f; if (o.occ) o.occ.f = f; ch = true; litDirty = true;
      for (let i = o.off * 3, e = (o.off + o.n) * 3; i < e; i += 3) { p[i] = o.cx + (b[i] - o.cx) * f; p[i + 1] = GY + (b[i + 1] - GY) * f; p[i + 2] = o.cz + (b[i + 2] - o.cz) * f; }
    }
    if (ch) pa.needsUpdate = true;
  }
}
// 点 p（家の中の人の頭の上など）が、カメラから見て庭の木・植え込みのうしろに隠れている度合い（0〜1）。名札をなめらかに薄くするのに使う。縮んでいる木は、縮んだぶんだけ小さく数える
export function outCover(cp, p) {
  let best = 0; const dx = p.x - cp.x, dz = p.z - cp.z, dy = p.y - cp.y, l2 = dx * dx + dz * dz;
  for (const o of occ) {
    const t = l2 > 1e-6 ? Math.min(1, Math.max(0, ((o.x - cp.x) * dx + (o.z - cp.z) * dz) / l2)) : 0, hy = cp.y + dy * t;
    const r = o.r * o.f, d = Math.hypot(cp.x + dx * t - o.x, cp.z + dz * t - o.z);
    if (hy < o.y0 || hy > o.y1 || d >= r) continue;
    best = Math.max(best, 1 - sstep(r * .65, r, d));
  }
  return best;
}
// 描くたびに呼ぶ。切りかえの間（約1秒）・島ののびるアニメ・イルミネーションのまたたきの間だけ true（次の描画を予約してもらう）。画面の縦横比が変わったときは空を描きなおす
export function outTick(now, camera) {
  if (camera) hideUpdate(camera);
  let act = false; if (voK !== voT) act = true;   // 外に出た/入ったときの木の大きさの切りかえ中は、描きつづける
  if (isAnim && islandMesh) act = stepIsland(now);
  if (lit.length) { const k = camKey(); if (litAnim() || litDirty || k !== lKey) { lKey = k; litDirty = false; litUpdate(now); } if (litAnim()) act = true; }
  if (!cur) return act;
  if (to && from) {
    const p = Math.min(1, (now - t0) / 1000), e = p * p * (3 - 2 * p); apply(lerpP(from, to, e));
    if (p >= 1) { from = null; cur = lerpP(to, to, 0); }
    return p < 1 || act;
  }
  if (Math.abs(aspectOf() - lastA) > 1e-3) { paintSky(cur, 0, 1, 0, 1); lastA = aspectOf(); }
  return act;
}
function makeMats() {
  return {
    grass: new THREE.MeshBasicMaterial({ map: grassTex(), color: 0x6cc04a }), soil: new THREE.MeshBasicMaterial({ color: 0xd48c54 }),
    props: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), leaf: new THREE.MeshBasicMaterial({ map: leafTex(), vertexColors: true, alphaTest: .5, alphaToCoverage: true, side: THREE.DoubleSide }), shadow: new THREE.MeshBasicMaterial({ map: shadowTex(), color: 0x000000, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, opacity: .5 }), bulb: new THREE.MeshBasicMaterial({ color: 0xffe0a0 }),
    halo: new THREE.MeshBasicMaterial({ map: haloTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }),
    lbulb: new THREE.MeshBasicMaterial({ vertexColors: true }), glow: new THREE.MeshBasicMaterial({ map: glowTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  };
}
// ----- 外から使う（窓の外の景色・庭を歩く判定）-----
// 歩く判定用：いまの庭の、置いたものの位置と半径 { box, M, R（島の余白・角の丸み）, obs:[{x,z,r,c,k}], fences:[[x0,z0,x1,z1]], gates:[[x,z]]（柵の門の中心）, ver }（庭を置きなおすたびに ver が増える）
export function outYard() { return lastYard; }
export const OUT_GY = GY;   // 芝のてっぺんの高さ
export { OUT_M, OUT_R };
// 窓の外の景色用：家の箱 box（家の中心が原点でもよい）の庭を、別の材質で組み立てて返す（シーンには入れない）。k = 0 昼〜1 夜で色をつける
// 庭の本体（影・イルミ・手前の縮み・のびる島・物の台帳）の状態には触れない：組み立てのあいだだけ空の状態を使い、あとで元にもどす。窓の外は焼いた絵なので、影・イルミ・縮みは入れない
export function outGardenBuild(box, door) {
  const sv = { hides, occ, shE, shRef, litB, litH, lit, builtXmas, islandMesh, reg };
  hides = []; occ = []; shE = []; shRef = null; litB = litH = null; lit = []; reg = newReg();
  try {
    const mt = makeMats(), g = new THREE.Group(); build(box, false, { mt, door }).forEach(m => { m.matrixAutoUpdate = false; m.updateMatrix(); g.add(m); });
    return { group: g, mats: mt };
  } finally { ({ hides, occ, shE, shRef, litB, litH, lit, builtXmas, islandMesh, reg } = sv); }
}
export function outGardenTint(y, k) { applyMats(lerpP(TOD.noon, TOD.night, k), y.mats, y.group); }
export function outInit(sc, o) {
  scene = sc; onDirty = o.onDirty || onDirty; aspectOf = o.aspect || aspectOf;
  bgCv = document.createElement('canvas'); bgCv.width = BW; bgCv.height = BH;
  bgTex = new THREE.CanvasTexture(bgCv); bgTex.colorSpace = THREE.SRGBColorSpace;
  mats = makeMats();
  start(hourNow());
  const tickAll = () => { start(hourNow()); if (lastBox && garden && xmasOn() !== builtXmas) outHouse(lastBox, lastDoor); };   // 時刻が進んだら太陽を動かす／日付が 12/24 をまたいだらイルミネーションを出し入れ
  clearInterval(timer); timer = setInterval(tickAll, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tickAll(); });
  if (lastBox) outHouse(lastBox, lastDoor);
  return bgTex;
}
