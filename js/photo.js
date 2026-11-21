// 写真（家の画面のカメラボタン）：いまの視点のまま、高い解像度で1枚撮る（ヘッダーなどの UI は入れない・名札は選べる）。
// 流れ：白いフラッシュ＋シャッター音 → 重い描画（scene.js の capturePhoto。4K 以上・写真用の最高画質。時間がかかるときは「写真を仕上げています」を出す）→ 右下に「向上ハウス」と日付を入れる → プレビュー（保存・共有・名札の入り切り）
// iPhone はメモリの上限が小さいので、小さめに描き（scene.js）、保存は JPEG を1回だけ作る。撮影中は印を付け、落ちた端末は次から小さめに撮る。
// 動かすのは transform と opacity だけ。iPhone は a[download] が使いにくいので、画像を大きく出して長押しでも保存できるようにする。
import { h, icoSvg, toast } from './ui.js?v=202611211556';
import { capturePhoto, photoMark } from './scene.js?v=202611211556';
import { busyOverlay } from './loading.js?v=202611211556';

let busy = false, pv = null, withNames = false;
const DBG_LOG = (() => { try { return new URLSearchParams(location.search).get('photolog') === '1'; } catch (e) { return false; } })();
const raf2 = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const two = n => String(n).padStart(2, '0');
const FONT = '"Zen Maru Gothic","Hiragino Maru Gothic ProN","Hiragino Sans","Yu Gothic",sans-serif';
export const photoSupported = () => { try { return !!(document.createElement('canvas').getContext('2d') && window.Blob); } catch (e) { return false; } };

let logoImg = null;
function logo() {   // アイコンの絵（同じ場所の画像）。読めなくても写真は撮れる
  if (logoImg) return logoImg;
  logoImg = new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'assets/icon/icon-192.png'; setTimeout(() => res(null), 1500); });
  return logoImg;
}
const rr = (c, x, y, w, hh, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + hh, r); c.arcTo(x + w, y + hh, x, y + hh, r); c.arcTo(x, y + hh, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
// 右下に、小さなロゴ（アイコン＋「向上ハウス」）と日付
async function stamp(cv, now) {
  const c = cv.getContext('2d'), u = Math.max(13, Math.round(cv.height * .032)), mg = Math.round(u * .95), ih = Math.round(u * 2.1), pad = Math.round(u * .5);
  const date = now.getFullYear() + '.' + two(now.getMonth() + 1) + '.' + two(now.getDate()), img = await logo();
  c.save(); c.textBaseline = 'alphabetic';
  c.font = '900 ' + u + 'px ' + FONT; const w1 = c.measureText('向上ハウス').width;
  const u2 = Math.round(u * .72); c.font = '700 ' + u2 + 'px ' + FONT; const w2 = c.measureText(date).width;
  const tw = Math.max(w1, w2), gap = Math.round(u * .55), bw = Math.round(pad * 2 + (img ? ih + gap : 0) + tw + u * .35), bh = ih + pad * 2, bx = cv.width - mg - bw, by = cv.height - mg - bh;
  c.shadowColor = 'rgba(60,36,12,.28)'; c.shadowBlur = u * .8; c.shadowOffsetY = u * .18; c.fillStyle = 'rgba(255,250,240,.86)'; rr(c, bx, by, bw, bh, bh / 2); c.fill();
  c.shadowColor = 'transparent'; c.strokeStyle = 'rgba(236,211,164,.95)'; c.lineWidth = Math.max(1, u * .08); c.stroke();
  let tx = bx + pad + u * .2;
  if (img) { c.save(); rr(c, bx + pad, by + pad, ih, ih, ih * .26); c.clip(); c.drawImage(img, bx + pad, by + pad, ih, ih); c.restore(); tx = bx + pad + ih + gap; }
  c.fillStyle = '#6b4a2a'; c.font = '900 ' + u + 'px ' + FONT; c.fillText('向上ハウス', tx, by + pad + ih * .5 - u * .02);
  c.fillStyle = '#9a7b57'; c.font = '700 ' + u2 + 'px ' + FONT; c.fillText(date, tx, by + pad + ih * .5 + u2 * 1.08);
  c.restore();
}
const toBlob = (cv, type, q) => new Promise(res => { try { cv.toBlob(b => res(b), type || 'image/png', q); } catch (e) { res(null); } });   // 保存は PNG（圧縮で劣化しない）
const SHARE_PNG_MAX = 14e6;   // これより大きい PNG は共有できない端末があるので、共有には高品質の JPEG（0.95）を使う

// 1枚撮る：{ blob, url, w, h, file } か null
async function shoot(names) {
  const r = await capturePhoto({ names }); if (!r) { photoMark(false); return null; }
  try {
    const now = new Date(); await stamp(r.canvas, now);
    const jpg = !!r.ios;   // iPhone は、メモリを守るため JPEG（0.93）を1回だけ作る（PNG と両方は作らない）
    const blob = jpg ? await toBlob(r.canvas, 'image/jpeg', .93) : await toBlob(r.canvas); if (!blob) return null;
    const ext = jpg ? '.jpg' : '.png', mime = jpg ? 'image/jpeg' : 'image/png';
    const name = 'kojo-house-' + now.getFullYear() + two(now.getMonth() + 1) + two(now.getDate()) + '-' + two(now.getHours()) + two(now.getMinutes()) + two(now.getSeconds()) + ext;
    let file = null; try { file = new File([blob], name, { type: mime }); } catch (e) { }
    let sfile = file;   // 共有に使うファイル（PNG が大きすぎるときは JPEG）
    if (!jpg && blob.size > SHARE_PNG_MAX) { try { const jb = await toBlob(r.canvas, 'image/jpeg', .95); if (jb) sfile = new File([jb], name.replace(/\.png$/, '.jpg'), { type: 'image/jpeg' }); } catch (e) { } }
    if (DBG_LOG) console.info('photo blob', { type: blob.type, mb: +(blob.size / 1e6).toFixed(2) });
    return { blob, name, file, sfile, url: URL.createObjectURL(blob), w: r.canvas.width, h: r.canvas.height };   // プレビューは objectURL（巨大な canvas をもう1枚作らない）
  } finally { r.canvas.width = r.canvas.height = 0; photoMark(false); }   // 大きな絵のメモリをすぐ手放し、撮影中の印を消す
}
function flash() {
  const f = h('div', { cls: 'ph-flash', 'aria-hidden': 'true' }); document.body.appendChild(f);
  let a = null; try { a = f.animate([{ opacity: 0 }, { opacity: reduced() ? .5 : .95, offset: .22 }, { opacity: 0 }], { duration: 420, easing: 'ease-out', fill: 'forwards' }); } catch (e) { }
  return { done: () => new Promise(res => { const end = () => { f.remove(); res(); }; if (a) { a.finished.then(end, end); } else end(); }) };
}
const iosLike = () => { try { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); } catch (e) { return false; } };

function closePv() {
  const p = pv; if (!p) return; pv = null; document.removeEventListener('keydown', p.key, true);
  p.el.classList.remove('on'); setTimeout(() => { p.el.remove(); if (p.cur) URL.revokeObjectURL(p.cur.url); }, 260);
  try { p.back && p.back.focus && p.back.focus(); } catch (e) { }
}
function openPv(first, env) {
  const img = h('img', { alt: '撮った写真', draggable: 'false' }), st = { el: null, cur: first, back: document.activeElement };
  img.src = first.url;
  const sw = h('button', { cls: 'btn ph-name', type: 'button', role: 'switch', 'aria-checked': String(withNames) }, [h('span', { cls: 'ph-sw', 'aria-hidden': 'true' }, [h('i')]), h('span', { cls: 'ph-nt', text: '名札' })]);
  const save = h('button', { cls: 'btn coral ph-save', type: 'button' }), share = h('button', { cls: 'btn mint ph-share', type: 'button', hidden: true }), close = h('button', { cls: 'btn ghost ph-close', type: 'button' });
  save.innerHTML = icoSvg('download', 20) + '<span>保存</span>'; share.innerHTML = icoSvg('share', 20) + '<span>共有</span>'; close.innerHTML = icoSvg('close', 18) + '<span>とじる</span>';
  const tip = h('p', { cls: 'ph-tip', text: iosLike() ? '保存できないときは、写真を長押しして「写真に追加」' : '' });
  const el = h('div', { cls: 'ph-pv', role: 'dialog', 'aria-modal': 'true', 'aria-label': '撮った写真' }, [h('div', { cls: 'ph-box' }, [
    h('div', { cls: 'ph-img' }, [img]), h('div', { cls: 'ph-side' }, [sw, save, share, close, tip])])]);
  st.el = el;
  const canShare = f => { try { return !!(f && navigator.share && navigator.canShare && navigator.canShare({ files: [f] })); } catch (e) { return false; } };
  const paintShare = () => { share.hidden = !canShare(st.cur.sfile); };
  save.onclick = () => {
    const a = document.createElement('a'); a.href = st.cur.url; a.download = st.cur.name; a.rel = 'noopener'; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500);
    toast('写真を保存しました', 'ok'); try { env && env.sfx && env.sfx('tap'); } catch (e) { }
  };
  share.onclick = async () => { try { await navigator.share({ files: [st.cur.sfile], title: '向上ハウス' }); } catch (e) { if (e && e.name !== 'AbortError') toast('共有できませんでした', 'ng'); } };
  close.onclick = closePv;
  el.addEventListener('pointerdown', e => { if (e.target === el) closePv(); });
  let again = false;
  sw.onclick = async () => {   // 名札の入り切り：同じ視点でもう一度撮る（画面は動かない）
    if (again) return; again = true; sw.disabled = true; withNames = !withNames; sw.setAttribute('aria-checked', String(withNames));
    let n = null, bz = busyOverlay('写真を仕上げています'); try { n = await shoot(withNames); } catch (e) { console.error(e); } finally { bz(); }
    again = false; sw.disabled = false;
    if (!n) { withNames = !withNames; sw.setAttribute('aria-checked', String(withNames)); toast('撮りなおせませんでした', 'ng'); return; }
    const old = st.cur; st.cur = n; img.src = n.url; URL.revokeObjectURL(old.url); paintShare();
  };
  st.key = e => { if (e.key === 'Tab') return; e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); closePv(); } };
  document.addEventListener('keydown', st.key, true);
  paintShare(); document.body.appendChild(el); pv = st; void el.offsetWidth;
  requestAnimationFrame(() => { el.classList.add('on'); try { save.focus({ preventScroll: true }); } catch (e) { } });
}
// env = { sfx }。目線のときも、いまの視点のまま撮れる
export async function takePhoto(env) {
  if (busy || pv) return; busy = true;
  const fl = flash();
  try { env && env.sfx && env.sfx('shutter'); } catch (e) { }
  let res = null, bz = null;
  try { await raf2(); bz = busyOverlay('写真を仕上げています'); res = await shoot(withNames); } catch (e) { console.error('photo', e); } finally { if (bz) bz(); }   // フラッシュの最初のフレームを描かせてから、重い描画
  try { await fl.done(); } catch (e) { }
  busy = false;
  if (!res) { toast('写真を撮れませんでした。もう一度ためしてください', 'ng'); return; }
  openPv(res, env);
}
export const photoOpen = () => !!pv || busy;
