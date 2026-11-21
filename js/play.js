// さわって遊ぶ家具の仕組み：「使う」の状態・なめらかな動き（補間）・保存（この端末）・小さな3D演出の粒
// 動かすのは、その品物の部品だけ（物理演算なし）。動いている間だけ main.js が描き直す（busy）。止まれば描き直しも止まる。
// 各品物の動きの中身は play_rigs.js。ここは、どの品物にも共通の「状態・補間・粒・保存」だけ。
import { THREE } from './mk.js?v=202611211556';
import { gpuDirty } from './scenegpu.js?v=202611211556';
import { rigFor } from './play_rigs.js?v=202611211556';

// main.js が差し込む：音（tone・sweep は効果音オフなら鳴らさない）・画面のキラッ・灯りの組み直し・はじめての実績
const H = { tone() { }, sweep() { }, sparkle() { }, relight() { }, roomLight() { }, used() { }, get() { }, put() { } };
export function init(o) { Object.assign(H, o); }
const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

// ===== 状態の保存（この端末だけ。家ごと・品物ごとに、いまの状態を覚える） =====
const LSK = 'kojoHouse.play.v1';
let saved = {}, scope = '', canSave = false, srv = false;
try { const o = JSON.parse(localStorage.getItem(LSK) || '{}'); if (o && typeof o === 'object') saved = o; } catch (e) { saved = {}; }
function persist() {
  if (!canSave) return;
  try { const ks = Object.keys(saved); if (ks.length > 24) delete saved[ks[0]]; localStorage.setItem(LSK, JSON.stringify(saved)); } catch (e) { }
}
// tid = 家のID。save=false（テスト・デモ）のときは、覚えない
// srv=true（サーバーつなぎ）：状態は家のデータの品物の s（H.get / H.put）に持つ。みんなの画面で同じになる。端末の保存は使わない
export function setScope(tid, save, server) { scope = String(tid == null ? '' : tid); canSave = !!save && !!scope; srv = !!server; }
const stGet = (uid, def) => { if (srv) { const v = H.get(uid); return v === 0 || v === 1 ? v : def; } const m = canSave && saved[scope]; const v = m ? m[uid] : undefined; return v === 0 || v === 1 ? v : def; };
function stSet(uid, v, def) {
  if (srv) { H.put(uid, v, def); return; }
  if (!canSave) return;
  const m = saved[scope] || (saved[scope] = {});
  if (v === def) delete m[uid]; else m[uid] = v;
  if (!Object.keys(m).length) delete saved[scope];
  persist();
}

// ===== 補間のなめらかさ =====
const clamp01 = v => Math.max(0, Math.min(1, v));
export const ease = {
  out: p => 1 - Math.pow(1 - p, 3),
  back: p => { const c1 = 1.25, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },   // 少しいきすぎて戻る（はずみ）
  io: p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2,
  quad: p => 1 - (1 - p) * (1 - p)
};

// ===== 小さな粒（ハート・音符・星・水しぶき・もや）：品物のグループの中に出して、時間で消す =====
const texCache = {};
function ptex(kind) {
  if (texCache[kind]) return texCache[kind];
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'); c.translate(32, 32);
  if (kind === 'heart') { c.fillStyle = '#ff6b8a'; c.beginPath(); c.moveTo(0, 22); c.bezierCurveTo(-34, -2, -22, -28, -2, -14); c.bezierCurveTo(0, -17, 0, -17, 2, -14); c.bezierCurveTo(22, -28, 34, -2, 0, 22); c.fill(); c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(-12, -12, 5, 3, -.6, 0, 7); c.fill(); }
  else if (kind === 'note') { c.fillStyle = '#7fd8ff'; c.beginPath(); c.ellipse(-8, 16, 10, 7, -.4, 0, 7); c.fill(); c.fillRect(0, -22, 4, 38); c.beginPath(); c.moveTo(4, -22); c.quadraticCurveTo(22, -14, 18, 4); c.lineTo(14, 0); c.quadraticCurveTo(16, -10, 4, -14); c.fill(); }
  else if (kind === 'star') { c.fillStyle = '#ffe27a'; c.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 6 : 26, a = i * Math.PI / 4; c.lineTo(Math.sin(a) * r, -Math.cos(a) * r); } c.closePath(); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, 5, 0, 7); c.fill(); }
  else if (kind === 'drop') { c.fillStyle = '#7cc8ff'; c.beginPath(); c.moveTo(0, -24); c.bezierCurveTo(22, 4, 20, 22, 0, 22); c.bezierCurveTo(-20, 22, -22, 4, 0, -24); c.fill(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(-6, 6, 3, 6, .3, 0, 7); c.fill(); }
  else if (kind === 'leaf') { c.fillStyle = '#9ad86a'; c.beginPath(); c.moveTo(-22, 8); c.quadraticCurveTo(-4, -26, 24, -14); c.quadraticCurveTo(16, 18, -22, 8); c.fill(); }
  else if (kind === 'food') { c.fillStyle = '#e8a050'; c.beginPath(); c.arc(0, 0, 12, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(-4, -4, 4, 0, 7); c.fill(); }
  else { const gr = c.createRadialGradient(0, 0, 2, 0, 0, 30); gr.addColorStop(0, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.beginPath(); c.arc(0, 0, 30, 0, 7); c.fill(); }   // puff：やわらかい白いもや
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return (texCache[kind] = t);
}
let parts = [];
// kind: heart / note / star / drop / leaf / food / puff。pos は品物の中の位置、o: spread（横のちらばり）up（上向きの速さ）grav（落ちる強さ）size life delay
export function burst(g, kind, n, pos, o) {
  if (reduced() || !g) return; o = o || {}; n = Math.min(n || 4, 14);
  for (let i = 0; i < n; i++) {
    const m = new THREE.SpriteMaterial({ map: ptex(kind), transparent: true, depthWrite: false, opacity: 0 }), s = new THREE.Sprite(m);
    const sz = (o.size || .12) * 1.4 * (.75 + Math.random() * .5); s.scale.set(sz, sz, 1); s.position.set(pos.x + (Math.random() - .5) * (o.spread || .2), pos.y, pos.z + (Math.random() - .5) * (o.spread || .2)); s.raycast = () => { }; s.renderOrder = 6; g.add(s);
    const sp = o.spread || .2;
    parts.push({ s, g, v: { x: (Math.random() - .5) * sp * 2, y: (o.up != null ? o.up : .5) * (.7 + Math.random() * .6), z: (Math.random() - .5) * sp * 2 + (o.vz || 0) }, t: -(o.delay || 0) - i * .04, life: (o.life || 1) * (.8 + Math.random() * .4), grav: o.grav || 0, sz, grow: o.grow || 0 });
  }
}
function stepParts(dt) {
  parts = parts.filter(p => {
    p.t += dt; if (p.t < 0) return true; const k = p.t / p.life;
    if (k >= 1) { p.g.remove(p.s); p.s.material.dispose(); return false; }
    p.v.y -= p.grav * dt; p.s.position.x += p.v.x * dt; p.s.position.y += p.v.y * dt; p.s.position.z += p.v.z * dt;
    p.s.material.opacity = k < .15 ? k / .15 : (k > .65 ? (1 - k) / .35 : 1);
    const sc = p.sz * (1 + p.grow * k + (k < .2 ? .35 * (1 - k / .2) : 0)); p.s.scale.set(sc, sc, 1); return true;
  });
}

// ===== 品物ごとの状態と補間 =====
// entry = { uid, g, rig, k（いま描いている値 0〜1）, to, from, t, dur, run, pt（pulse の進み。-1 は止まっている）, live（rig.tick が動かしている最中）, autoT }
let list = [], lastTs = 0, uses = 0;
export function reset() { list = []; }
// 品物を組み立てたあと：保存してある状態（なければ初期状態）にすぐ合わせる。rig の無い品物は何もしない
export function attach(uid, g, d) {
  const rig = rigFor(d, g, api(g, d)); if (!rig) return null;
  g.userData.use = rig;
  const def = rig.def == null ? 0 : rig.def, v = rig.pulse || rig.temp ? def : stGet(uid, def);
  const e = { uid, g, rig, k: v, from: v, to: v, t: 0, dur: 1, run: false, pt: -1, live: false, autoT: 0, def };
  if (rig.pose && !rig.pulse) rig.pose(v, e); if (rig.init) rig.init(v, e); g.userData.on = v;
  list.push(e); return e;
}
const find = uid => list.find(e => e.uid === uid);
export const can = uid => !!find(uid);
export function label(uid) { const e = find(uid); if (!e) return ''; const r = e.rig; if (r.pulse) return r.label; return (r.labels || ['つかう', 'つかう'])[e.to >= .5 ? 1 : 0]; }
export const isOn = uid => { const e = find(uid); return !!e && e.to >= .5; };
export const rigKey = uid => { const e = find(uid); return e ? e.rig.key : ''; };
function api(g, d) {
  return { d, g, tone: (...a) => H.tone(...a), sweep: (...a) => H.sweep(...a), burst: (k, n, p, o) => burst(g, k, n, p, o), sparkle: () => H.sparkle(g), relight: () => H.relight(), roomLight: () => H.roomLight() };
}
// 「使う」を押した：開閉・オンオフなら反対へ、1回きりの動き（なでる・水やりなど）なら始める
export function use(uid, ts) {
  const e = find(uid); if (!e) return null; const r = e.rig, slow = reduced() ? .2 : 1;
  uses++;
  if (r.pulse) {
    if (e.pt >= 0 && e.pt < .35) return { rig: r, on: false, busy: true };   // 続けてさわれる（始めて少したったら、やり直せる）
    e.pt = 0; if (r.fire) r.fire(1, e); H.used(r, 1); return { rig: r, on: true };
  }
  go(e, e.to >= .5 ? 0 : 1, ts, false); return { rig: r, on: !!(e.to >= .5) };
}
// 開閉・オンオフを on（0/1）にする。remote=true は、ほかの人の操作が届いた分：保存・音・実績はなし、動きだけなめらかに
function go(e, on, ts, remote) {
  const r = e.rig, slow = reduced() ? .2 : 1;
  e.from = e.k; e.to = on; e.t = 0; e.dur = (r.dur || .55) * slow * (on ? 1 : (r.durOff || .85)); e.run = true; e.autoT = on && r.auto ? (ts || performance.now() / 1000) + r.auto : 0;
  g_on(e, on); if (!r.temp && !remote) stSet(e.uid, on, e.def);
  if (r.fire && !remote) r.fire(on, e); if (r.light) { e.g.userData.lit = !!on; H.relight(); } if (!remote) H.used(r, on);   // 灯りは、つけ消しの瞬間に光源の一覧も組み直す（見た目の明るさは、少しなめらかに追いつく）
}
// ほかの人の状態が届いた：v（0/1。なければはじめの状態）に、その品物だけなめらかに合わせる（作り直さない・保存しない）
export function setTo(uid, v) {
  const e = find(uid); if (!e || e.rig.pulse || e.rig.temp) return false;
  const on = (v === 0 || v === 1 ? v : e.def) >= .5 ? 1 : 0; if ((e.to >= .5 ? 1 : 0) === on) return false;
  go(e, on, performance.now() / 1000, true); return true;
}
const g_on = (e, on) => { e.g.userData.on = on; };
export function busy() { return parts.length > 0 || list.some(e => e.run || e.pt >= 0 || e.live); }
// 窓のカーテンが閉まっているぶん（0〜1）。部屋に入る窓の光をうすくするのに使う
export function dimK() { let m = 0; list.forEach(e => { if (e.rig.dim) m = Math.max(m, clamp01(e.rig.dim * (e.def - e.k))); }); return m; }
// 描くたびに呼ぶ（描いていない間は進めない）
export function tick(ts) {
  const dt = Math.min(.05, Math.max(0, lastTs ? ts - lastTs : .016)); lastTs = ts; let mat = false;
  list.forEach(e => {
    const r = e.rig;
    if (e.run) {
      e.t += dt; const p = clamp01(e.t / e.dur), f = e.to > e.from ? (r.spring === false ? ease.out : ease.back) : ease.quad;
      e.k = e.from + (e.to - e.from) * (p >= 1 ? 1 : f(p)); r.pose(e.k, e); mat = true;
      if (p >= 1) { e.run = false; e.k = e.to; r.pose(e.k, e); if (r.done) r.done(e.to, e); }
    }
    if (e.pt >= 0) {
      e.pt += dt / (r.dur || 1) * (reduced() ? 3 : 1); mat = true;
      if (e.pt >= 1) { e.pt = -1; r.pose(0, e); if (r.done) r.done(0, e); } else r.pose(e.pt, e);
    }
    if (e.autoT && ts > e.autoT && e.to >= .5) { e.autoT = 0; e.from = e.k; e.to = 0; e.t = 0; e.dur = (r.dur || .55) * (r.durOff || .85); e.run = true; g_on(e, 0); if (r.fire) r.fire(0, e); }
    if (r.tick) { const on = r.tick(ts, dt, e); if (on !== e.live) e.live = !!on; if (on) mat = true; }
  });
  if (parts.length) { stepParts(dt); mat = true; }
  if (mat) gpuDirty();   // WebGPU：動かない物扱いの材質（光る部分・色）も、この回は読み直す
  return mat;
}
// 描き直しが止まっていた間に過ぎた時間を、次の描画で一気に進めないための印
export function idle() { lastTs = 0; }
// 時計の針など、時間で変わるものを1分ごとに合わせる
export function minute() { list.forEach(e => { if (e.rig.minute) e.rig.minute(e); }); return list.some(e => e.rig.minute); }
export const count = () => uses;
