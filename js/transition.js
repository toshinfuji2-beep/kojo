// 画面の切り替えの演出（斜めのスラッシュ）。家に入るときは「濃紺の帯が右から斜めに差し込んで画面をおおう → 斜めのストライプの上に me- の顔とチーミ名がすべり込む → 斜めの線で上下に割れて家が見える」。
// 家 → ホームは「左から帯が差し込んで家をおおう → 右へ抜けてホームが出る」。
// 動かすのは transform・opacity だけ（clip-path は割れる形として固定するだけ。メインスレッドが忙しくてもなめらか）。幕で隠れている間に、切り替えの重い準備（swap）をする。
// 次の画面・前の画面が1フレームも見えないように：帯がおおい切ってから swap／家はカメラの初期位置と描画1回まで幕の下で終えてから割る／幕は先に hidden にしてからアニメを外す。
// prefers-reduced-motion では短いフェードだけ。
let veil = null, vtop = null, busy = false, lastPt = null;
const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const raf2 = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
// 確認用：window.__vslow = 5 で演出を5倍ゆっくりにする（画像を撮るため。ふだんは 1）
export const vdur = ms => ms * (+(window.__vslow) > 0 ? +window.__vslow : 1);
const SK = 'skewX(-18deg)', EASE_COVER = 'cubic-bezier(.25,.5,.25,1)', EASE_IN = 'cubic-bezier(.5,0,.9,.4)', EASE_OUT = 'cubic-bezier(.1,.6,.3,1)', EASE_SPLIT = 'cubic-bezier(.45,0,.85,.45)';
try { addEventListener('pointerdown', e => { lastPt = { x: e.clientX, y: e.clientY, t: performance.now() }; }, true); } catch (e) { }
// 直前に押した位置（2.5秒以内）。キーボードなどで入ったときは null。演出では使わないが、呼び出し側との互換のため残す
export const lastPress = () => (lastPt && performance.now() - lastPt.t < 2500 ? { x: lastPt.x, y: lastPt.y } : null);
// 割れる前の中身（上半分・下半分に同じものを2枚）
const half = c => '<div class="vc ' + c + '"><div class="vbody"><b class="vstr"></b><span class="vspd">' +
  [[8, .0, 'c'], [19, .35, ''], [31, .6, ''], [44, .15, 'c'], [57, .5, ''], [68, .8, ''], [79, .25, 'c'], [90, .65, '']].map(a => '<i class="' + a[2] + '" style="top:' + a[0] + '%;animation-delay:-' + a[1] + 's"></i>').join('') +
  '</span><i class="vband"></i><div class="vmid"><span class="vfw"><span class="vface"></span></span><div class="vnw"><b class="vname"></b><i class="vsh"></i></div></div></div></div>';
function el() {
  if (veil) return veil;
  veil = document.createElement('div'); veil.id = 'veil'; veil.className = 'veil'; veil.hidden = true; veil.setAttribute('aria-hidden', 'true');
  veil.innerHTML = '<div class="vbands"><i class="vp vp-a"></i><i class="vp vp-w"></i><i class="vp vp-n"></i></div>' + half('vt') + half('vb') + '<i class="vcut"></i><span class="vload"><i></i><i></i><i></i></span>';
  vtop = document.createElement('div'); vtop.id = 'vtop'; vtop.className = 'veil vtop'; vtop.hidden = true; vtop.setAttribute('aria-hidden', 'true');
  document.body.appendChild(veil); document.body.appendChild(vtop); return veil;
}
export const veilBusy = () => busy;
const anim = (e, kf, ms, easing, delay) => { try { return e.animate ? e.animate(kf, { duration: vdur(ms), delay: delay ? vdur(delay) : 0, easing: easing || 'linear', fill: 'both' }) : null; } catch (x) { return null; } };
const fin = (a, ms) => a ? a.finished.then(() => { }, () => { }) : wait(vdur(ms));
const bandKf = (a, b) => [{ transform: 'translateX(' + a + ') ' + SK }, { transform: 'translateX(' + b + ') ' + SK }];
// kind: 'enter'（家に入る）／'leave'（家 → ホーム）。swap は幕がおおい切ったあとに呼ばれる（同期でも async でもよい）。失敗しても幕は必ず開く。
// o: { hue, name, face（me- の顔の画像を作る関数）, sfx（音を鳴らす関数）, beforeOpen（開く直前に1回）, onOpen（開き始め）, onDone（幕が消えたあと）, x, y（使わない） }
export async function veilRun(kind, swap, o) {
  if (busy) { await swap(); return; }
  o = o || {}; busy = true; const v = el(), rm = reduce(), enter = kind === 'enter';
  const snd = k => { try { o.sfx && o.sfx(k); } catch (e) { } };
  const $$ = s => Array.from(v.querySelectorAll(s));
  let keep = [], timers = [];
  const go = (e, kf, ms, easing, delay) => { const a = anim(e, kf, ms, easing, delay); keep.push(a); return a; };
  try {
    v.className = 'veil ' + (enter ? 'enter' : 'leave') + (rm ? ' rm' : ''); v.hidden = false;
    v.style.setProperty('--vh', String(o.hue != null ? o.hue : 28));
    $$('.vname').forEach(n => { n.textContent = enter && o.name ? o.name : ''; }); $$('.vface').forEach(f => { f.textContent = ''; });
    if (rm) {
      v.style.opacity = '0'; void v.offsetWidth;
      await fin(go(v, [{ opacity: 0 }, { opacity: 1 }], 120), 120);
      await swap(); await raf2(); if (o.beforeOpen) o.beforeOpen(); await raf2();
      await fin(go(v, [{ opacity: 1 }, { opacity: 0 }], 140), 140);
      return;
    }
    // ① 帯が差し込んで全面をおおう（入る：右から。順に チーミ色の細い帯 → 白い細線 → 濃紺の本体）。家 → ホームは左から
    const P = $$('.vp'), t1 = enter ? 250 : 230, d1 = enter ? [0, 10, 20] : [0, 10, 20];
    void v.offsetWidth; snd('shu');
    const ca = P.map((p, i) => go(p, bandKf(enter ? '100%' : '-100%', '0%'), t1, EASE_COVER, d1[i]));
    await fin(ca[2], t1 + d1[2]);
    await raf2();   // おおい切ったことを、描画を2回待って確かめてから、次の画面を触る
    const covered = performance.now(), slow = setTimeout(() => v.classList.add('slow'), vdur(600)); timers.push(slow);
    if (enter) {   // ② 濃紺の上に、斜めの帯・顔・チーミ名（帯のアニメは外し、同じ濃紺の本体に切り替える）
      try { const f = o.face && o.face(); if (f) { const fs = $$('.vface'); fs[0].appendChild(f); fs[1].appendChild(f.cloneNode(true)); } } catch (e) { }
      v.classList.add('on'); ca.forEach(a => { try { a && a.cancel(); } catch (e) { } });
      $$('.vband').forEach(e => go(e, [{ transform: 'rotate(-17deg) translateX(-10%)', opacity: 0 }, { transform: 'rotate(-17deg) translateX(0)', opacity: .86 }], 280, EASE_OUT));
      $$('.vfw').forEach(e => go(e, [{ transform: 'translateX(-70vw)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], 240, EASE_OUT, 30));
      $$('.vnw').forEach(e => go(e, [{ transform: 'translateX(70vw)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], 240, EASE_OUT, 80));
      $$('.vsh').forEach(e => go(e, [{ transform: 'translateX(-130%) ' + SK, opacity: 1 }, { transform: 'translateX(330%) ' + SK, opacity: 1 }], 380, 'ease-in-out', 200));
      timers.push(setTimeout(() => snd('pon'), vdur(200)));
    }
    try {
      await swap(); await raf2();
      if (o.beforeOpen) o.beforeOpen();   // 家：カメラの初期位置
      if (enter) await raf2();            // 家の描画が1回終わるまで、幕の下で待つ（真っ黒・位置ちがいの絵を見せない）
    } finally { clearTimeout(slow); v.classList.remove('slow'); }
    if (enter) { const left = vdur(250) - (performance.now() - covered); if (left > 0) await wait(left); }   // 顔が見える最低限の間
    // ③ 開く：入るときは斜めの線で上下に割れる／家 → ホームは右へ抜ける
    if (enter) {
      const t2 = 340, a1 = go($$('.vt')[0], [{ transform: 'translate(0,0)' }, { transform: 'translate(-55vw,-80vh)' }], t2, EASE_SPLIT);
      go($$('.vb')[0], [{ transform: 'translate(0,0)' }, { transform: 'translate(55vw,80vh)' }], t2, EASE_SPLIT);
      go($$('.vcut')[0], [{ opacity: 0, transform: 'rotate(-18deg) scaleX(.2)' }, { opacity: 1, transform: 'rotate(-18deg) scaleX(1)', offset: .35 }, { opacity: 0, transform: 'rotate(-18deg) scaleX(1.1)' }], t2, 'ease-out');
      if (o.onOpen) o.onOpen();
      await fin(a1, t2);
    } else {
      snd('pon'); v.classList.add('out');   // 抜けるときは、帯の左のふち（うしろ側）にチーミ色と白が見えるよう、ずらし方を切り替える（全面をおおっている間なので見えない）
      const d2 = [28, 14, 0], ex = P.map((p, i) => go(p, bandKf('0%', '100%'), 260, EASE_IN, d2[i]));
      await fin(ex[0], 288);
    }
  } finally {
    v.hidden = true;   // 先に隠してから、アニメを外す（外した瞬間に帯が元の位置へ戻って見えるのを防ぐ）
    timers.forEach(clearTimeout); keep.forEach(k => { try { k && k.cancel(); } catch (e) { } }); keep = [];
    v.className = 'veil'; v.style.opacity = ''; busy = false;
    if (o.onDone) { try { o.onDone(); } catch (e) { } }
  }
}
// 家のまわりに、白〜チーミ色の細い光の筋が数本、上へ短く走って消える（寄せ終わりに）。(x,y)＝家のまん中あたり。動きを減らす設定のときは出さない
export function sparkleBurst(x, y, hue) {
  if (reduce()) return; el();
  const list = [], W = innerWidth, H = innerHeight, rx = Math.min(W * .3, 300), ry = Math.min(H * .22, 120), hu = hue != null ? hue : 28;
  for (let i = 0; i < 7; i++) {
    const s = document.createElement('i'); s.className = 'vsp'; const len = 40 + Math.random() * 50; s.style.height = len + 'px';
    s.style.background = 'linear-gradient(to top,' + (i % 2 ? 'rgba(255,255,255,0),#fff' : 'hsla(' + hu + ',85%,66%,0),hsl(' + hu + ',85%,72%)') + ')'; vtop.appendChild(s);
    const px = x + (Math.random() * 2 - 1) * rx, py = y + (Math.random() * 2 - .6) * ry, d = 650 + Math.random() * 350, delay = Math.random() * 350;
    const T = (dy, sc) => 'translate(' + px + 'px,' + py + 'px) rotate(18deg) translateY(' + dy + 'px) scaleY(' + sc + ')';
    let ani = null; try { ani = s.animate([{ transform: T(0, .2), opacity: 0 }, { transform: T(-len * .5, 1), opacity: 1, offset: .3 }, { transform: T(-len * 1.6, .6), opacity: 0 }], { duration: vdur(d), delay: vdur(delay), easing: 'ease-out', fill: 'both' }); } catch (e) { }
    list.push([s, ani]);
  }
  vtop.hidden = false; setTimeout(() => { list.forEach(([s, k]) => { try { k && k.cancel(); } catch (e) { } s.remove(); }); if (!busy) vtop.hidden = true; }, vdur(1500));
}
