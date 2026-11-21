// さわって遊ぶ家具：品物ごとの「動き」の中身。rigFor(def, 組み立てたモデル, 道具) が、その品物の rig（使うときの動き）を返す。無ければ null。
// rig = { key（種類。実績に使う）, ach（はじめての実績の名前）, labels:[0のときの「使う」, 1のときの「使う」]（開閉・オンオフ）／ pulse:true と label（1回きりの動き）,
//         def（はじめの状態）, dur・durOff（かかる秒）, pose(k)（0〜1のとき、部品をどう置くか）, fire(on)（音・粒）, tick(ts,dt)（動き続けるもの。続くなら true）, light・dim・temp・auto }
// 部品は、モデル側が name を付けたもの（pivot('door_low') など）を getObjectByName で見つける。動かすのは部品の回転・位置・大きさ・材質の値だけ。
import { THREE } from './mk.js?v=202611211556';

const clamp01 = v => Math.max(0, Math.min(1, v));
const lerp = (a, b, k) => a + (b - a) * k;
const part = (g, n) => g.getObjectByName(n);
const rnd = (a, b) => a + Math.random() * (b - a);
// 品物の子ぜんぶを1つの入れ物に移す（さわったときに、置き場所の動きとぶつからず、まるごとぷるんと動かせる）。pivot は入れ物の根もと
function wrap(g, px, py, pz) {
  const w = new THREE.Group(); w.name = 'inner'; w.position.set(px || 0, py || 0, pz || 0);
  [...g.children].forEach(c => { c.position.x -= px || 0; c.position.y -= py || 0; c.position.z -= pz || 0; w.add(c); }); g.add(w); return w;
}
// 音のレシピ（tone / sweep は main.js から。効果音オフなら鳴らない）
const SND = {
  door: (A, on) => on ? (A.sweep(240, 520, .14, 'triangle', .07), A.tone(170, 0, .08, 'square', .035)) : (A.tone(150, 0, .07, 'square', .07), A.tone(105, .045, .12, 'sine', .09)),
  drawer: (A, on) => { A.sweep(on ? 180 : 320, on ? 330 : 170, .2, 'sawtooth', .028); A.tone(on ? 240 : 130, on ? .16 : .15, .07, 'sine', .06); },
  glass: (A, on) => { A.tone(2400, 0, .09, 'sine', .04); A.tone(3100, .05, .1, 'sine', .03); A.sweep(on ? 220 : 340, on ? 380 : 200, .15, 'triangle', .035); },
  click: (A, on) => on ? (A.tone(1500, 0, .025, 'square', .045), A.tone(2300, .035, .05, 'square', .035)) : (A.tone(1800, 0, .025, 'square', .04), A.tone(1100, .035, .05, 'square', .035)),
  cloth: (A, on) => { A.sweep(on ? 260 : 520, on ? 620 : 240, .3, 'sine', .03); A.sweep(on ? 380 : 700, on ? 800 : 300, .22, 'triangle', .018); },
  ding: A => { A.tone(1568, 0, .55, 'sine', .09); A.tone(2093, 0, .7, 'sine', .045); },
  boing: A => { A.tone(520, 0, .08, 'sine', .1); A.tone(780, .07, .12, 'sine', .1); },
  pof: A => { A.sweep(240, 110, .16, 'sine', .08); A.tone(90, .02, .12, 'sine', .06); },
  sparkle: A => [1568, 2093, 2637].forEach((f, i) => A.tone(f, i * .06, .2, 'sine', .04))
};
const topOf = d => d.wall ? { x: d.w / 2, y: d.h, z: .15 } : { x: 0, y: d.h, z: 0 };
const midOf = d => d.wall ? { x: d.w / 2, y: d.h / 2, z: .2 } : { x: 0, y: d.h * .55, z: .1 };

// ===== 開け閉め（扉・ひきだし）=====
// spec = [[部品の name, 'ry'（回転y）|'pz'（前へすべる）, 最大の値, はじめ, おわり], ...]（はじめ・おわりは動きの中での時間割り。0〜1）
function openRig(g, A, d, spec, o) {
  const P = spec.map(([n, prop, max, a, b]) => { const ob = part(g, n); return ob && { o: ob, prop, max, a: a || 0, b: b == null ? 1 : b, z0: ob.position.z }; }).filter(Boolean);
  if (!P.length) return null; o = o || {};
  return {
    key: 'door', ach: 'open', labels: o.labels || ['開ける', '閉める'], dur: o.dur || .6, durOff: .75,
    pose(k) {
      P.forEach(x => {
        let u = Math.max(0, (k - x.a) / (x.b - x.a)); u = Math.min(1, u) + (k > 1 ? k - 1 : 0);
        if (x.prop === 'ry') x.o.rotation.y = x.max * u; else x.o.position.z = x.z0 + x.max * u;
      });
    },
    fire(on) {
      SND[o.snd || 'door'](A, on);
      if (o.mist && on) A.burst('puff', 6, o.mist, { spread: .35, up: .12, size: .5, life: 1.2, grow: .9, vz: .25 });
      if (o.ding && !on) { A.tone(1568, .28, .5, 'sine', .09); A.tone(2093, .28, .7, 'sine', .045); A.burst('star', 3, topOf(d), { spread: .2, up: .5, size: .1, delay: .28 }); }
      if (o.stars && on) A.burst('star', 3, o.stars, { spread: .25, up: .35, size: .09, life: .9, delay: .2 });
    }
  };
}

// ===== カーテン =====
// 状態1＝あけた（寄せてある）／0＝しめた。まどは はじめ＝あけた。開けると、そよ風でレースがふわっと揺れる
function curtainRig(g, A, d) {
  const win = g.userData.win; if (!win) return null;
  const c0 = part(g, 'cur0'), c1 = part(g, 'cur1'), sheer = part(g, 'sheer'), lace = part(g, 'lace'), w = win.w, h = win.h; let sw = 0;
  const base = { dur: .8, durOff: .9, key: 'curtain', ach: 'curtain', spring: false };
  const breeze = on => { if (!on) return; sw = 1; A.burst('leaf', 3, { x: w / 2, y: h * .6, z: .3 }, { spread: .3, up: .02, size: .13, life: 2.2, vz: .12, grav: -.01 }); A.sweep(420, 240, .7, 'sine', .02); };
  if (c0 && c1) {
    const cw = win.cw, sc = (w / 2 + .02) / cw, xo = [cw / 2 + .005, w - cw / 2 - .005], xc = [w * .25 - .005, w * .75 + .005], cs = [c0, c1];
    const sw0 = sheer ? (w - .12) * .16 / 2 + .06 : 0; let shk = 1;   // 開けたときは、レースも左に寄せて景色をはっきり見せる（shk＝レースの今の幅の倍率）
    return Object.assign(base, {
      labels: ['カーテンを開ける', 'カーテンを閉める'], def: 1, dim: .9,
      pose(k) { const c = clamp01(1 - k); cs.forEach((m, i) => { m.scale.x = lerp(1, sc, c); m.position.x = lerp(xo[i], xc[i], c); }); if (sheer) { shk = lerp(.16, 1, c); sheer.scale.x = shk; sheer.position.x = lerp(sw0, w / 2, c); } },
      fire(on) { SND.cloth(A, on); breeze(on); A.burst('puff', 3, { x: w / 2, y: h * .5, z: .3 }, { spread: .6, up: .05, size: .3, life: .9, grow: .6 }); },
      tick(ts, dt) {
        if (sw <= 0) return false; sw = Math.max(0, sw - dt / 2.8); const a = sw * sw * (3 - 2 * sw), o = Math.sin(ts * 3.7) * a;
        if (sheer) { sheer.scale.x = shk * (1 + .06 * o); sheer.rotation.y = .14 * a * Math.sin(ts * 2.9); }
        cs.forEach((m, i) => { m.rotation.y = .07 * o * (i ? -1 : 1); });
        if (sw <= 0) { if (sheer) { sheer.scale.x = shk; sheer.rotation.y = 0; } cs.forEach(m => { m.rotation.y = 0; }); }
        return sw > 0;
      }
    });
  }
  if (lace) {
    const lw = win.cw, xg = .06 + lw * .2 / 2;
    return Object.assign(base, {
      labels: ['カーテンを寄せる', 'カーテンを広げる'], def: 0,
      pose(k) { lace.scale.x = lerp(1, .2, k); lace.position.x = lerp(w / 2, xg, k); },
      fire(on) { SND.cloth(A, on); breeze(on); },
      tick(ts, dt) { if (sw <= 0) return false; sw = Math.max(0, sw - dt / 2.4); lace.rotation.y = .1 * sw * Math.sin(ts * 3.1); if (sw <= 0) lace.rotation.y = 0; return sw > 0; }
    });
  }
  return null;
}

// ===== 灯り（つける・消す）=====
// 光る部分（emissive）・光のにじみ・炎を見つけて、つけ消しで強さを変える。材質は、この品物だけのコピーにする
function litRig(g, A, d) {
  const em = [];
  g.traverse(o => {
    const m = o.material;
    if (o.isMesh && m && !Array.isArray(m) && m.emissive && m.emissiveIntensity > 0 && m.emissive.getHex() !== 0 && !m.emissiveMap) {
      o.material = m.clone(); const geo = o.geometry && o.geometry.type;
      em.push({ o, m: o.material, ei: m.emissiveIntensity, col: m.color.clone(), flame: m.emissiveIntensity >= 2 && (geo === 'ConeGeometry' || (geo === 'SphereGeometry' && o.scale.y > 1.15)) });
    } else if (o.isSprite && m) { o.material = m.clone(); em.push({ o, m: o.material, op: o.material.opacity, sprite: true }); }
  });
  const hasLight = !!g.userData.light; if (!em.length && !hasLight) return null;
  const dark = new THREE.Color('#6b655c');
  return {
    key: 'light', ach: 'light', labels: ['つける', '消す'], def: 1, dur: .35, durOff: .5, spring: false, light: hasLight,
    pose(k) {
      em.forEach(x => { if (x.sprite) x.m.opacity = x.op * Math.max(0, k); else if (x.flame) x.o.visible = k > .4; else { x.m.emissiveIntensity = x.ei * Math.max(0, k); x.m.color.copy(dark).lerp(x.col, clamp01(k)); } });
      g.userData.lit = k > .5;
    },
    fire(on) { SND.click(A, on); if (on) { A.burst('star', 4, topOf(d), { spread: .18, up: .3, size: .1, life: .8 }); A.tone(2093, .08, .15, 'sine', .03); } else A.burst('puff', 2, topOf(d), { spread: .1, up: .2, size: .2, life: .8, grow: 1 }); }
  };
}

// ===== 画面（テレビ・パソコン・ゲーム）=====
// はじめは今までの絵がついている状態。消すと暗くなり、つけ直すと「映像」（色の動き・ゲーム画面風）が30秒ほど流れる（そのあとは最後の1コマで止める＝描き直しも止まる）
const CH = {
  game(c, W, H, t) {
    const sk = c.createLinearGradient(0, 0, 0, H); sk.addColorStop(0, '#2a1f5e'); sk.addColorStop(1, '#f08a7a'); c.fillStyle = sk; c.fillRect(0, 0, W, H);
    c.fillStyle = '#fff'; for (let i = 0; i < 14; i++) c.fillRect((i * 53 + 11) % W, (i * 31) % (H * .5), 2, 2);
    c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(W * .8, H * .22, 16, 0, 7); c.fill();
    const gy = H * .78; c.fillStyle = '#3fae5a'; c.fillRect(0, gy, W, H - gy); c.fillStyle = '#2d8a46'; for (let i = 0; i < 12; i++) c.fillRect(((i * 24 - t * 120) % (W + 24) + W + 24) % (W + 24) - 12, gy, 12, 4);
    let bx = ((W + 40 - t * 110) % (W + 80)); c.fillStyle = '#c0503f'; c.fillRect(bx, gy - 22, 22, 22); c.fillStyle = '#e8785a'; c.fillRect(bx, gy - 22, 22, 5);
    const jp = (t * 1.3) % 1, jy = jp < .5 ? Math.sin(jp * 2 * Math.PI) * 36 : 0;
    c.fillStyle = '#7fd8ff'; c.fillRect(W * .25, gy - 24 - jy, 20, 24); c.fillStyle = '#fff'; c.fillRect(W * .25 + 12, gy - 18 - jy, 5, 5); c.fillStyle = '#222'; c.fillRect(W * .25 + 14, gy - 16 - jy, 2, 3);
    c.fillStyle = '#fff'; c.font = 'bold 14px sans-serif'; c.fillText('SCORE ' + String(Math.floor(t * 120)).padStart(5, '0'), 8, 20);
  },
  live(c, W, H, t) {
    const bg = c.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#2b1b5a'); bg.addColorStop(1, '#0f5a7a'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const cols = ['#ff6b8a', '#ffb84a', '#ffe27a', '#8ccc6c', '#6fc3e8', '#c79be8']; const n = 14, bw = (W - 24) / n;
    for (let i = 0; i < n; i++) { const hh = (.25 + .7 * Math.abs(Math.sin(t * 3 + i * .7) * Math.cos(t * 1.7 + i * .3))) * H * .7; c.fillStyle = cols[i % cols.length]; c.fillRect(12 + i * bw + 1, H - 12 - hh, bw - 3, hh); }
    c.fillStyle = 'rgba(255,255,255,.9)'; c.font = 'bold 13px sans-serif'; c.fillText('♪ LIVE', 10, 20);
  },
  graph(c, W, H, t) {
    c.fillStyle = '#0f2a44'; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(0, i * H / 5); c.lineTo(W, i * H / 5); c.stroke(); }
    const p = Math.min(1, t / 6), N = 40; c.strokeStyle = '#7ae0b0'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= N * p; i++) { const x = 12 + i / N * (W - 24), y = H - 16 - (i / N) * (H - 60) - Math.sin(i * .6) * 6; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
    c.fillStyle = '#fff'; c.font = 'bold 15px sans-serif'; c.fillText(p >= 1 ? '志望校 合格圏 ✓' : '偏差値 ' + (50 + Math.round(p * 18)), 10, 22);
  },
  code(c, W, H, t) {
    c.fillStyle = '#10161c'; c.fillRect(0, 0, W, H); c.font = '11px monospace'; const off = (t * 22) % 14;
    for (let i = -1; i < 12; i++) { const y = 14 + i * 14 - off, k = (Math.floor(t * 1.6) + i) * 7; c.fillStyle = ['#7ae0b0', '#7fb8ff', '#f2c14e', '#e88aa0'][((k % 4) + 4) % 4]; c.fillRect(10 + ((k * 3) % 3) * 12, y - 7, 20 + ((k * 13) % 90), 5); c.fillStyle = '#5a6a78'; c.fillRect(10 + ((k * 3) % 3) * 12 + 26 + ((k * 13) % 90), y - 7, 30 + ((k * 7) % 40), 5); }
  }
};
function screenRig(g, A, d) {
  const sc = []; g.traverse(o => { const m = o.material; if (o.isMesh && m && !Array.isArray(m) && m.emissiveMap) { o.material = m.clone(); sc.push({ o, m: o.material, ei: m.emissiveIntensity, map: m.map, em: m.emissiveMap }); } });
  if (!sc.length) return null;
  const lap = d.shape === 'laptop', order = lap ? ['code', 'graph', 'game'] : ['game', 'live', 'graph'];
  let tex = null, cv = null, ctx = null, ch = -1, t0 = 0, until = 0, acc = 0, canvasOn = false;
  const draw = (now) => { CH[order[ch % order.length]](ctx, cv.width, cv.height, now - t0); tex.needsUpdate = true; };
  return {
    key: 'screen', ach: 'screen', labels: ['つける', '消す'], def: 1, dur: .3, durOff: .35, spring: false,
    pose(k) { sc.forEach(x => { x.m.emissiveIntensity = x.ei * Math.max(0, k); }); },
    fire(on) {
      SND.click(A, on);
      if (!on) { until = 0; return; }
      if (!tex) { cv = document.createElement('canvas'); cv.width = 256; cv.height = lap ? 160 : 144; ctx = cv.getContext('2d'); tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; }
      ch++; t0 = performance.now() / 1000; until = t0 + 30; acc = 0;
      if (!canvasOn) { canvasOn = true; sc.forEach(x => { x.m.map = tex; x.m.emissiveMap = tex; x.m.needsUpdate = true; }); }
      draw(t0); A.burst('star', 3, midOf(d), { spread: .3, up: .2, size: .09, life: .8 }); A.tone(880, .05, .12, 'sine', .04); A.tone(1320, .12, .16, 'sine', .035);
    },
    tick(ts, dt, e) {
      if (!until || e.to < .5) return false; const now = performance.now() / 1000;
      if (now > until) { draw(until); until = 0; return false; }
      acc += dt; if (acc < .1) return true; acc = 0; draw(now); return true;
    }
  };
}

// ===== 時計 =====
function setHands(g, d) {
  const hh = part(g, 'hand_h'), hm = part(g, 'hand_m'); if (!hh || !hm) return;
  const n = new Date(), m = n.getMinutes() + n.getSeconds() / 60, hr = (n.getHours() % 12) + m / 60;
  hh.rotation.z = -hr / 12 * Math.PI * 2; hm.rotation.z = -m / 60 * Math.PI * 2;
}
function clockRig(g, A, d) {
  if (!part(g, 'hand_h')) return null;
  if (d.art === 'wclock') {
    const ck = part(g, 'cuckoo'); const hourN = () => ((new Date().getHours() + 11) % 12) + 1; let N = 3;
    return {
      key: 'clock', ach: 'clock', pulse: true, label: '時報を鳴らす', get dur() { return N * .5 + 1.1; }, init() { setHands(g, d); }, minute() { setHands(g, d); },
      pose(p) {
        const du = N * .5 + 1.1, t = p * du; g.userData.pendK = p > 0 ? 2.2 : 1;
        if (ck) { const up = p <= 0 ? 0 : Math.min(ease01(t / .25), ease01((du - t) / .25)); ck.visible = up > .01; ck.position.y = d.h - .16 + .2 * up; ck.rotation.z = Math.sin(t * 14) * .08 * up; }
      },
      fire() {
        N = Math.min(hourN(), 12); setHands(g, d);
        for (let i = 0; i < N; i++) { A.tone(523, .3 + i * .5, .9, 'sine', .1); A.tone(1047, .3 + i * .5, .6, 'sine', .04); A.tone(262, .3 + i * .5, 1.1, 'sine', .05); }
        A.tone(1175, 0, .1, 'triangle', .08); A.tone(880, .12, .18, 'triangle', .08);
        A.burst('note', Math.min(8, N + 2), { x: d.w / 2, y: d.h + .1, z: .15 }, { spread: .45, up: .35, size: .13, life: 1.6, delay: .3 });
      }
    };
  }
  return {
    key: 'clock', ach: 'clock', pulse: true, label: 'ベルを鳴らす', dur: 1.8, init() { setHands(g, d); }, minute() { setHands(g, d); },
    pose(p) { g.rotation.z = p <= 0 ? 0 : Math.sin(p * 1.8 * 62) * .06 * (p < .75 ? 1 : (1 - p) / .25); },
    fire() { setHands(g, d); for (let i = 0; i < 26; i++) A.tone(i % 2 ? 1319 : 1175, i * .06, .05, 'square', .035); A.burst('note', 4, { x: 0, y: d.h + .05, z: 0 }, { spread: .25, up: .4, size: .1, life: 1.2 }); }
  };
}
const ease01 = v => { v = clamp01(v); return 1 - Math.pow(1 - v, 3); };

// ===== 1回きりの動き（揺れる・はずむ・鳴らす）=====
// 入れ物 inner をゆらす：fn(p, inner, A)
function pulse(g, A, d, o) {
  const inner = o.noWrap ? g : wrap(g, o.px, o.py, o.pz);
  return {
    key: o.key, ach: o.ach, pulse: true, label: o.label, dur: o.dur || 1,
    pose(p) {
      if (o.noWrap) { if (p > 0) o.fn(p, inner); return; }   // 品物そのものは触らない（置き場所の回転・大きさと、ぶつからないように）
      if (p <= 0) { inner.rotation.set(0, 0, 0); inner.scale.set(1, 1, 1); inner.position.set(o.px || 0, o.py || 0, o.pz || 0); return; } o.fn(p, inner);
    },
    fire() { if (o.snd) o.snd(A); if (o.fx) o.fx(A, d); }
  };
}
const damp = (p, hz, pw) => Math.sin(p * hz) * Math.pow(1 - p, pw == null ? 1.6 : pw);
const bumpFn = (amp, hz) => (p, w) => { const b = damp(p, hz || 22, 1.3); w.scale.set(1 + amp * .6 * b, 1 - amp * b, 1 + amp * .6 * b); w.position.y = Math.abs(Math.sin(p * Math.PI)) * amp * .5 * (1 - p); };

// 音楽：ピアノ（さわるたび、きらきら星を4音ずつ弾く。続けてさわると曲になる）・ギター・スピーカー
const TWINKLE = [0, 0, 4, 4, 5, 5, 4, 3, 3, 2, 2, 1, 1, 0], FREQ = [261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25];
function pianoRig(g, A, d) {
  const w = d.w, ks = []; let step = 0, cur = [];
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.05, .02, .2), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0, depthWrite: false })); m.position.set(-w / 2 + .3 + i * (w - .6) / 13 * .98, 1.045, .29); m.visible = false; m.raycast = () => { }; g.add(m); ks.push(m); }
  const SP = .17, N = 4, kx = i => ks[i].position.x;
  return {
    key: 'music', ach: 'music', pulse: true, label: 'ひく', dur: N * SP + .45,
    pose(p) { const t = p * (N * SP + .45); ks.forEach(k => { k.visible = false; }); if (p <= 0) return; cur.forEach((ki, j) => { const s = (t - j * SP) / .38; if (s > 0 && s < 1) { const k = ks[ki]; k.visible = true; k.material.opacity = (1 - s) * .9; } }); },
    fire() {
      cur = []; for (let j = 0; j < N; j++) { const deg = TWINKLE[step++ % TWINKLE.length], ki = [0, 2, 4, 5, 7, 9, 11, 13][deg]; cur.push(ki); A.tone(FREQ[deg], j * SP, .6, 'triangle', .13); A.tone(FREQ[deg] * 2, j * SP, .35, 'sine', .035); A.burst('note', 1, { x: kx(ki), y: 1.15, z: .3 }, { spread: .05, up: .5, size: .13, life: 1.3, delay: j * SP }); }
    }
  };
}
function guitarRig(g, A, d) {
  const CH_ = [[164.81, 246.94, 329.63, 392, 493.88, 659.26], [196, 246.94, 293.66, 392, 493.88, 587.33], [130.81, 196, 261.63, 329.63, 392, 523.25], [146.83, 220, 293.66, 369.99, 440, 587.33]]; let step = 0;
  return pulse(g, A, d, {
    key: 'music', ach: 'music', label: 'かきならす', dur: 1.3, fn: (p, w) => { w.rotation.z = damp(p, 40, 1.4) * .03; w.rotation.x = damp(p, 34, 1.4) * .02; },
    snd: () => { const c = CH_[step++ % CH_.length]; c.forEach((f, i) => { A.tone(f, i * .045, 1.1, 'triangle', .075); A.tone(f * 2, i * .045, .5, 'sine', .02); }); },
    fx: (A, d) => A.burst('note', 3, { x: 0, y: .75, z: .1 }, { spread: .25, up: .4, size: .12, life: 1.4, delay: .1 })
  });
}
// 短い曲（スピーカー・ラジオ・レコード）：ペンタトニックの旋律＋ベース。毎回すこし違う
let jing = 0;
function jingle(A, o) {
  const sc = [0, 2, 4, 7, 9, 12, 14, 16], st = 60 / o.bpm / 2; let k = ++jing * 3;
  for (let i = 0; i < o.steps; i++) {
    const n = sc[(k = (k * 5 + 3 + i) % 97) % sc.length], f = o.base * Math.pow(2, n / 12), t = i * st;
    if (i % 4 !== 3) A.tone(f, t, st * 1.6, o.wave || 'triangle', o.vol || .06);
    if (i % 4 === 0) A.tone(o.base / 2 * Math.pow(2, [0, 5, 7, 3][(i / 4) % 4 | 0] / 12), t, st * 3.6, 'sine', .09);
  }
}
function speakerRig(g, A, d) {
  const disc = part(g, 'disc'), rec = d.shape === 'record', dur = rec ? 6.4 : 6;
  return pulse(g, A, d, {
    key: 'music', ach: 'music', label: rec ? 'かける' : '音楽をかける', dur,
    fn: (p, w) => {
      const t = p * dur, beat = Math.pow(Math.abs(Math.sin(t * Math.PI * (rec ? 1.1 : 2))), 6); const sp = Math.min(1, p * 8, (1 - p) * 8);
      if (disc) disc.rotation.y = -t * 3.2 * sp; else w.scale.set(1 + .02 * beat * sp, 1 + .03 * beat * sp, 1 + .02 * beat * sp);
    },
    snd: A2 => jingle(A2, rec ? { bpm: 78, steps: 16, base: 392, vol: .05 } : d.shape === 'radio' ? { bpm: 116, steps: 24, base: 523, wave: 'square', vol: .028 } : { bpm: 104, steps: 22, base: 440, vol: .06 }),
    fx: (A2, dd) => { for (let i = 0; i < 6; i++) A2.burst('note', 1, { x: 0, y: dd.h + .05, z: .05 }, { spread: .3, up: .35, size: .13, life: 1.5, delay: .3 + i * .9 }); }
  });
}

// ===== 品物のきまり =====
const PLANTS = ['plant', 'cactus', 'flowerpot', 'anthurium', 'mossball'];
const PETS = ['plush', 'catplush'];
const SOFT = ['bed', 'sofa', 'cushion', 'beanbag', 'armchair', 'hammock', 'blanket', 'linensofa', 'bunk', 'loft'];
const LIGHTS = ['lamp', 'floorlamp', 'pendant', 'globelight', 'candle', 'candleglass', 'lantern', 'fireplace', 'woodstove'];
const LIGHT_ART = ['sconce', 'neon', 'spotrail'];
export function rigFor(d, g, A) {
  if (!d || !g) return null;
  const sh = d.shape, art = d.art;
  try {
    if (d.cat === 'rug' || d.cat === 'wallpaper' || d.cat === 'floor') return null;
    // ---- 扉・ひきだし ----
    if (sh === 'fridge') return openRig(g, A, d, [['door_low', 'ry', 1.95, 0, 1], ['door_up', 'ry', 1.85, .15, 1]], { mist: { x: 0, y: 1.0, z: .55 } });
    if (sh === 'fridge2') return openRig(g, A, d, [['fdoor0', 'ry', -1.9, 0, 1], ['fdoor1', 'ry', 1.9, 0, 1]], { mist: { x: 0, y: 1.2, z: .55 } });
    if (sh === 'drawers') return openRig(g, A, d, [['drawer2', 'pz', .38, 0, .64], ['drawer1', 'pz', .38, .18, .82], ['drawer0', 'pz', .38, .36, 1]], { snd: 'drawer', labels: ['ひきだしを開ける', 'ひきだしを閉める'], stars: { x: 0, y: d.h - .1, z: .25 } });
    if (sh === 'cabinet') return openRig(g, A, d, [['cdoor0', 'ry', -1.9, 0, 1], ['cdoor1', 'ry', 1.9, 0, 1], ['cdoor_u0', 'ry', -1.8, .15, 1], ['cdoor_u1', 'ry', 1.8, .15, 1]], { snd: 'glass', stars: { x: 0, y: d.h - .5, z: .2 } });
    if (sh === 'microwave') return openRig(g, A, d, [['mdoor', 'ry', 1.75, 0, 1]], { ding: true, dur: .45 });
    if (sh === 'washer') return openRig(g, A, d, [['wdoor', 'ry', -1.9, 0, 1]], { dur: .55, stars: { x: 0, y: .6, z: .4 } });
    if (sh === 'shelf') {
      const bk = part(g, 'pullbook'); if (bk) { const z0 = bk.position.z, r0 = bk.rotation.x; return { key: 'door', ach: 'open', labels: ['本をぬく', '本をもどす'], dur: .5, durOff: .45, pose(k) { bk.position.z = z0 + .2 * k; bk.rotation.x = r0 - .22 * k; bk.position.y += 0; }, fire(on) { A.sweep(on ? 300 : 500, on ? 520 : 260, .16, 'triangle', .03); A.tone(on ? 700 : 400, .1, .05, 'sine', .03); if (on) A.burst('star', 3, { x: bk.position.x, y: bk.position.y + .15, z: .35 }, { spread: .15, up: .3, size: .08, life: .8 }); } }; }
    }
    // ---- 窓のカーテン ----
    if (art === 'window' || art === 'cafewin') return curtainRig(g, A, d);
    // ---- 灯り ----
    if (LIGHTS.includes(sh) || LIGHT_ART.includes(art)) { const r = litRig(g, A, d); if (r) return r; }
    // ---- 画面 ----
    if (['tv', 'tvboard', 'laptop', 'console'].includes(sh)) { const r = screenRig(g, A, d); if (r) return r; }
    // ---- 時計 ----
    if (sh === 'alarm' || art === 'wclock') { const r = clockRig(g, A, d); if (r) return r; }
    // ---- 植物の水やり ----
    if (PLANTS.includes(sh) || art === 'wplanter') {
      return pulse(g, A, d, {
        key: 'water', ach: 'water', label: '水やり', dur: 1.7,
        fn: (p, w) => { const a = damp(p, 20, 1.8); w.rotation.z = a * .07; w.rotation.x = damp(p, 16, 1.8) * .045; const s = 1 + .05 * Math.sin(Math.min(1, p * 1.6) * Math.PI); w.scale.set(s, s, s); },
        snd: A2 => { for (let i = 0; i < 7; i++) A2.tone(rnd(1300, 2100), .04 + i * .07, .05, 'sine', .035); A2.tone(988, .7, .12, 'sine', .04); A2.tone(1318, .78, .2, 'sine', .04); },
        fx: (A2, dd) => { A2.burst('drop', 9, { x: 0, y: dd.h + .35, z: 0 }, { spread: .45, up: -.15, grav: 2.2, size: .09, life: .9 }); A2.burst('star', 4, { x: 0, y: dd.h * .7, z: 0 }, { spread: .4, up: .25, size: .1, life: 1, delay: .6 }); }
      });
    }
    // ---- ペット ----
    if (PETS.includes(sh)) {
      const cat = sh === 'catplush';
      return pulse(g, A, d, {
        key: 'pet', ach: 'pet', label: 'なでる', dur: 1.15, fn: bumpFn(.16, 18),
        snd: A2 => { if (cat) { A2.sweep(900, 620, .26, 'sine', .06); A2.tone(1100, .2, .1, 'sine', .035); } else SND.boing(A2); },
        fx: (A2, dd) => A2.burst('heart', 5, { x: 0, y: dd.h + .1, z: 0 }, { spread: .25, up: .4, size: .15, life: 1.4 })
      });
    }
    if (sh === 'birdcage') {
      return pulse(g, A, d, {
        key: 'pet', ach: 'pet', label: 'ことりを呼ぶ', dur: 1.2, fn: (p, w) => { w.rotation.z = damp(p, 34, 1.5) * .05; w.position.y = Math.abs(Math.sin(p * 20)) * .012 * (1 - p); },
        snd: A2 => [2349, 2637, 3136, 2793, 3136].forEach((f, i) => { A2.tone(f, i * .09, .08, 'sine', .05); A2.tone(f * 1.01, i * .09, .06, 'sine', .02); }),
        fx: (A2, dd) => A2.burst('note', 3, { x: 0, y: dd.h * .75, z: 0 }, { spread: .2, up: .4, size: .1, life: 1.3 })
      });
    }
    // ---- 楽器・音 ----
    if (sh === 'piano') return pianoRig(g, A, d);
    if (sh === 'guitar') return guitarRig(g, A, d);
    if (sh === 'speaker' || sh === 'radio' || sh === 'record') return speakerRig(g, A, d);
    // ---- 回る ----
    if (sh === 'fan') {
      const bl = part(g, 'blades'); if (bl) return { key: 'spin', ach: 'spin', labels: ['つける', '止める'], temp: true, auto: 25, dur: .9, durOff: 1.1, spring: false, pose() { }, tick(ts, dt, e) { if (e.k < .01) return false; bl.rotation.z -= dt * 24 * e.k; return true; }, fire(on) { A.sweep(on ? 110 : 280, on ? 300 : 90, .7, 'sawtooth', .02); if (on) A.burst('puff', 4, { x: 0, y: 1.0, z: .5 }, { spread: .15, up: 0, size: .35, life: 1.2, grow: 1, vz: .6, delay: .3 }); } };
    }
    if (sh === 'globe') {
      const ball = (() => { let b = null; g.traverse(o => { if (o.isMesh && o.geometry && o.geometry.type === 'SphereGeometry' && o.material && o.material.map && !b) b = o; }); return b; })();
      if (ball) { ball.rotation.order = 'ZYX'; return pulse(g, A, d, { noWrap: true, key: 'spin', ach: 'spin', label: 'くるくる回す', dur: 2.6, fn: p => { ball.rotation.y = (1 - Math.pow(1 - p, 3)) * Math.PI * 6; }, snd: A2 => A2.sweep(300, 900, .6, 'sine', .035), fx: (A2, dd) => A2.burst('star', 4, { x: 0, y: .65, z: 0 }, { spread: .3, up: .3, size: .09, life: 1 }) }); }
    }
    if (sh === 'hourglass') {
      const w0 = wrap(g, 0, .2, 0); return { key: 'spin', ach: 'spin', labels: ['ひっくり返す', 'もどす'], dur: .7, durOff: .7, pose(k) { w0.rotation.z = Math.PI * k; w0.position.y = .2 + Math.sin(Math.min(1, k) * Math.PI) * .1; }, fire() { A.sweep(500, 300, .3, 'sine', .03); A.tone(1200, .5, .06, 'sine', .03); A.burst('star', 3, { x: 0, y: .25, z: 0 }, { spread: .2, up: .3, size: .08, life: .9, delay: .5 }); } };
    }
    if (sh === 'daruma' || sh === 'ltddaruma') {
      return pulse(g, A, d, { key: 'touch', ach: 'touch', label: 'ころがす', dur: 1.6, fn: (p, w) => { w.rotation.z = damp(p, 14, 1.4) * .5; }, snd: A2 => { A2.tone(330, 0, .1, 'sine', .08); A2.tone(262, .22, .1, 'sine', .07); A2.tone(330, .5, .1, 'sine', .06); A2.tone(392, .8, .14, 'sine', .05); }, fx: (A2, dd) => A2.burst('star', 3, { x: 0, y: dd.h * .6, z: 0 }, { spread: .3, up: .3, size: .1, life: .9, delay: .6 }) });
    }
    if (sh === 'trophy' || sh === 'ltdtrophy') {
      return pulse(g, A, d, { key: 'touch', ach: 'touch', label: 'かかげる', dur: 1.4, fn: (p, w) => { w.rotation.y = (1 - Math.pow(1 - Math.min(1, p * 1.2), 3)) * Math.PI * 2; w.position.y = Math.sin(Math.min(1, p * 1.5) * Math.PI) * .12; }, snd: SND.sparkle, fx: (A2, dd) => A2.burst('star', 8, { x: 0, y: dd.h * .8, z: 0 }, { spread: .45, up: .5, size: .12, life: 1.2 }) });
    }
    if (sh === 'aquarium') {
      return pulse(g, A, d, { noWrap: true, key: 'feed', ach: 'feed', label: 'ごはんをあげる', dur: 2.2, fn: () => { }, snd: A2 => { for (let i = 0; i < 6; i++) A2.tone(rnd(500, 1000), .15 + i * .22, .05, 'sine', .035); A2.sweep(300, 900, .25, 'sine', .03); }, fx: (A2, dd) => { A2.burst('food', 10, { x: 0, y: dd.h - .05, z: 0 }, { spread: dd.w * .35, up: 0, grav: .5, size: .07, life: 1.6 }); A2.burst('puff', 5, { x: 0, y: .3, z: 0 }, { spread: dd.w * .3, up: .35, size: .1, life: 1.6, grow: .5, delay: .4 }); } });
    }
    if (art === 'switch') return pulse(g, A, d, { noWrap: true, key: 'light', ach: 'light', label: '電気を切りかえる', dur: .3, fn: () => { }, snd: A2 => SND.click(A2, true), fx: A2 => A2.roomLight() });
    if (art === 'aircon') return pulse(g, A, d, { noWrap: true, key: 'touch', ach: 'touch', label: 'ぴっ', dur: 1.8, fn: () => { }, snd: A2 => { A2.tone(1760, 0, .06, 'square', .04); A2.tone(2349, .08, .1, 'square', .04); A2.sweep(160, 320, 1.2, 'sawtooth', .012); }, fx: (A2, dd) => A2.burst('puff', 7, { x: dd.w / 2, y: .1, z: .25 }, { spread: dd.w * .35, up: -.12, size: .38, life: 1.5, grow: .8, vz: .15, delay: .15 }) });
    // ---- ぽふっ（やわらかい家具）----
    if (SOFT.includes(sh)) return pulse(g, A, d, { key: 'touch', ach: 'touch', label: 'ぽふっ', dur: .9, fn: (p, w) => { const b = damp(p, 16, 1.2); w.scale.set(1 - .05 * b, 1 - .13 * b, 1 - .05 * b); }, snd: SND.pof, fx: (A2, dd) => A2.burst('puff', 4, { x: 0, y: dd.h * .6, z: 0 }, { spread: dd.w * .4, up: .25, size: .3, life: .9, grow: .8 }) });
    // ---- そのほか：壁かけは、ゆらす／置き物は、ぴょん ----
    if (d.wall) return pulse(g, A, d, { px: d.w / 2, py: d.h, key: 'touch', ach: 'touch', label: 'ゆらす', dur: 1.2, fn: (p, w) => { w.rotation.z = damp(p, 22, 1.6) * .09; }, snd: A2 => { A2.tone(660, 0, .05, 'triangle', .05); A2.tone(880, .07, .08, 'triangle', .04); }, fx: A2 => A2.burst('star', 2, { x: d.w / 2, y: d.h * .5, z: .2 }, { spread: d.w * .3, up: .2, size: .08, life: .8 }) });
    return pulse(g, A, d, { key: 'touch', ach: 'touch', label: 'つつく', dur: .8, fn: bumpFn(.1, 20), snd: SND.boing, fx: (A2, dd) => A2.burst('star', 3, { x: 0, y: dd.h + .05, z: 0 }, { spread: .2, up: .35, size: .09, life: .8 }) });
  } catch (e) { console.error('rig', d.id, e); return null; }
}
