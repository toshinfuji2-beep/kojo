// ドーパミン演出の部品：はじめての実績（この端末に保存）・部屋の「にぎやかさ」の点数と星・ピコの数字のカウントアップ・買った瞬間の段階つき演出
// DOM と データだけ（ゲームの状態は main.js から引数で受け取る）。すべて短く・なめらかに。動きを減らす設定のときは控えめ（motionOK）。
import { h, fmt } from './ui.js?v=202611211556';
import { motionOK, confetti, flyCoins, sparkleAt } from './guide.js?v=202611211556';

const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
};

// ===== はじめての実績 =====
// g = 丸いバッジに入れる1文字。ここに無い id は無視する（保存のゴミを表に出さない）
export const ACH = [
  { id: 'open', g: '開', t: 'はじめてのひらき', d: '扉やひきだしを、はじめて開けた' },
  { id: 'curtain', g: '朝', t: 'あさのひかり', d: 'カーテンを、はじめて開け閉めした' },
  { id: 'light', g: '灯', t: 'あかりをともす', d: '灯りを、はじめてつけ消しした' },
  { id: 'screen', g: '映', t: 'スタート！', d: 'テレビやパソコンを、はじめてつけた' },
  { id: 'clock', g: '時', t: '時をつげる', d: '時計を、はじめて鳴らした' },
  { id: 'water', g: '水', t: 'はじめての水やり', d: '植物に、はじめて水をあげた' },
  { id: 'pet', g: '愛', t: 'ふれあい', d: 'ぬいぐるみや小鳥と、はじめてふれあった' },
  { id: 'music', g: '音', t: 'ミニコンサート', d: '楽器や音楽を、はじめて鳴らした' },
  { id: 'spin', g: '回', t: 'くるくる', d: '回るものを、はじめて回した' },
  { id: 'feed', g: '魚', t: 'おさかなごはん', d: '水槽の魚に、はじめてごはんをあげた' },
  { id: 'touch', g: '触', t: 'さわってみた', d: '家具を、はじめてさわって遊んだ' },
  { id: 'playall', g: '極', t: 'あそび名人', d: 'いろいろな遊びを、ぜんぶ体験した' },
  { id: 'play30', g: '達', t: 'あそびの達人', d: '家具で、30回あそんだ' },
  { id: 'place_first', g: '初', t: 'はじめての家具', d: '家具を、はじめて置いた' },
  { id: 'place_appliance', g: '電', t: 'はじめての家電', d: '家電を、はじめて置いた' },
  { id: 'place_goods', g: '雑', t: 'はじめての雑貨', d: '雑貨を、はじめて置いた' },
  { id: 'place_wall', g: '壁', t: 'はじめての壁かけ', d: '壁かけを、はじめて置いた' },
  { id: 'rare', g: '輝', t: 'レアゲット', d: '高いランクの品を、はじめて置いた' },
  { id: 'star3', g: '★', t: 'にぎやかな部屋', d: '部屋のにぎやかさが ★3 になった' },
  { id: 'star5', g: '星', t: '夢のお部屋', d: '部屋のにぎやかさが ★5 になった' }
];
const ACH_IDS = new Set(ACH.map(a => a.id));
const PLAY_KEYS = ['open', 'curtain', 'light', 'screen', 'clock', 'water', 'pet', 'music', 'spin', 'feed'];   // 「あそび名人」に必要な種類
const aKey = uid => 'kojoHouse.ach.v1.' + uid;
let mem = {};   // テスト・保存できないときの置き場
export function achData(uid) {
  const k = aKey(uid); let o = null;
  try { o = JSON.parse(LS.get(k) || 'null'); } catch (e) { o = null; }
  if (!o || typeof o !== 'object') o = mem[k] || { done: {}, n: 0 };
  if (!o.done || typeof o.done !== 'object') o.done = {}; o.n = +o.n || 0; mem[k] = o; return o;
}
const saveAch = (uid, o) => { mem[aKey(uid)] = o; LS.set(aKey(uid), JSON.stringify(o)); };
let toastQ = 0;
// 解放して、トーストを出す。新しく解放できたら true。onSfx は音の関数
export function unlock(uid, id, onSfx) {
  if (!uid || !ACH_IDS.has(id)) return false; const o = achData(uid); if (o.done[id]) return false;
  o.done[id] = Date.now(); saveAch(uid, o); showAch(ACH.find(a => a.id === id), onSfx); return true;
}
function showAch(a, onSfx) {
  const slot = toastQ++; setTimeout(() => { toastQ = Math.max(0, toastQ - 1); }, 3400);
  const el = h('div', { cls: 'ach-toast', role: 'status' }, [h('span', { cls: 'ach-g', text: a.g }), h('span', { cls: 'ach-tx' }, [h('i', { text: '実績かいほう' }), h('b', { text: a.t }), h('em', { text: a.d })])]);
  el.style.setProperty('--slot', String(Math.min(slot, 3))); (document.getElementById('stage') || document.body).appendChild(el);   // 家の画面の中央（右上のボタンに重ならない）
  if (onSfx) onSfx('ach');
  setTimeout(() => el.classList.add('out'), 3000); setTimeout(() => el.remove(), 3400);
}
// さわって遊んだ（種類 key）：はじめてなら実績。遊んだ回数も数える
export function played(uid, key, onSfx) {
  if (!uid) return; const o = achData(uid); o.n++; saveAch(uid, o);
  unlock(uid, key, onSfx); if (o.n >= 30) unlock(uid, 'play30', onSfx);
  if (PLAY_KEYS.every(k => o.done[k])) unlock(uid, 'playall', onSfx);
}
// 家具を置いた：はじめての家具・カテゴリ・レア
export function placed(uid, d, tier, onSfx) {
  if (!uid || !d) return; unlock(uid, 'place_first', onSfx);
  if (d.cat === 'appliance' || d.cat === 'goods' || d.cat === 'wall') unlock(uid, 'place_' + d.cat, onSfx);
  if (tier >= 2) unlock(uid, 'rare', onSfx);
}
// プロフィールに出す一覧
export function achBody(uid) {
  const o = achData(uid), n = ACH.filter(a => o.done[a.id]).length;
  const list = h('div', { cls: 'ach-list' }); ACH.forEach(a => { const on = !!o.done[a.id]; list.appendChild(h('div', { cls: 'ach-it' + (on ? ' on' : ''), title: on ? a.d : '' }, [h('span', { cls: 'ach-g', text: on ? a.g : '？' }), h('span', { cls: 'ach-nm', text: on ? a.t : '？？？' }), h('span', { cls: 'ach-ds', text: on ? a.d : 'まだ見つけていないよ' })])); });
  return h('div', { cls: 'ach-box' }, [h('div', { cls: 'ach-h', text: '実績 ' + n + ' / ' + ACH.length }), list]);
}

// ===== 部屋のにぎやかさ（点数と星）=====
// 置いた物の数と種類で決まる。items = 部屋の items、itemOf(id) = 品物の定義
const CATW = { furniture: 3, appliance: 3, goods: 1.6, wall: 2.4, rug: 2 };
export const STAR_AT = [14, 36, 68, 110, 160];
export function roomScore(items, itemOf) {
  let pts = 0; const ids = new Set(), cats = new Set();
  (items || []).forEach(i => { const d = itemOf(i.id); if (!d) return; pts += (CATW[d.cat] || 1.5) + Math.min(4, (d.price || 0) / 1800); ids.add(d.id); cats.add(d.cat); });
  pts += ids.size * 2 + cats.size * 4; pts = Math.round(pts);
  let stars = 0; STAR_AT.forEach(t => { if (pts >= t) stars++; });
  const prev = stars ? STAR_AT[stars - 1] : 0, next = STAR_AT[stars];
  return { pts, stars, next: next == null ? null : next, frac: next == null ? 1 : (pts - prev) / (next - prev) };
}
// 画面の右上に小さく出すバッジ。update(score) で更新。星が増えた瞬間は、きらっと光る
export function mountScore(parent, onTap) {
  const num = h('b', { cls: 'rs-n', text: '0' }), st = h('span', { cls: 'rs-st' }), bar = h('i', { cls: 'rs-bar' }), fill = h('i'); bar.appendChild(fill);
  const el = h('button', { id: 'roomScore', cls: 'btn rs-chip', type: 'button', 'aria-label': '部屋のにぎやかさ', onclick: () => { if (onTap) onTap(last); } }, [h('span', { cls: 'rs-l', text: 'にぎやかさ' }), st, num, bar]);
  parent.appendChild(el); let last = null, shown = null, anim = 0;
  const paintStars = n => { st.textContent = ''; for (let k = 0; k < 5; k++) st.appendChild(h('s', { cls: k < n ? 'on' : '', text: '★' })); };
  paintStars(0);
  return {
    el,
    update(sc, o) {
      o = o || {}; const was = last; last = sc; el.hidden = !!o.hide; if (o.hide) return;
      paintStars(sc.stars); fill.style.width = Math.round(sc.frac * 100) + '%';
      if (shown == null || o.snap || !motionOK()) { num.textContent = String(sc.pts); shown = sc.pts; }
      else if (sc.pts !== shown) {   // ぱらぱらと数字が増える（短く）
        cancelAnimationFrame(anim); const from = shown, to = sc.pts, t0 = performance.now(), dur = 520; shown = to;
        const step = t => { const k = Math.min(1, (t - t0) / dur); num.textContent = String(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)))); if (k < 1) anim = requestAnimationFrame(step); };
        anim = requestAnimationFrame(step); el.classList.remove('up'); void el.offsetWidth; el.classList.add('up');
      }
      if (was && sc.stars > was.stars && !o.snap) {
        const r = el.getBoundingClientRect(); sparkleAt(r.left + r.width / 2, r.top + r.height / 2); sparkleAt(r.left + 18, r.top + r.height / 2); sparkleAt(r.right - 18, r.top + r.height / 2);
        el.classList.remove('lvup'); void el.offsetWidth; el.classList.add('lvup'); if (o.onUp) o.onUp(sc);
      }
    }
  };
}

// ===== ピコの数字：増えるときは、ぱらぱらとカウントアップ（ease-out）。減るときは、すっと =====
export function makeCounter() {
  let cur = null, from = 0, to = 0, t0 = 0, dur = 0, up = false;
  return {
    jump(v) { cur = to = v; up = false; },
    val(target, now, still) {
      if (cur === null) cur = to = target;
      if (target !== to) {
        from = cur; to = target; t0 = now; const dl = to - from; up = dl > 0;
        dur = still ? 1 : (up ? Math.min(1700, 520 + Math.log10(1 + dl) * 300) : 170);
      }
      if (cur !== to) { const p = Math.min(1, (now - t0) / dur), e = up ? 1 - Math.pow(1 - p, 3) : 1 - (1 - p) * (1 - p); cur = p >= 1 ? to : from + (to - from) * e; }
      return cur;
    },
    get counting() { return up && cur !== to; }
  };
}

// ===== 買った（置いた）瞬間の段階つき演出 =====
// 値段・ランクで段階をつける：0=ふつう 1=ちょっといい 2=いい 3=レア（ltd・高ランク）
export function tierOf(d, price) {
  const p = price || 0, r = d.rank || 0;
  if (d.ltd || p >= 6000 || r >= 3) return 3;
  if (p >= 3500 || r >= 2) return 2;
  if (p >= 1500 || r >= 1) return 1; return 0;
}
const BANNER = ['', '', 'すごい！', 'レアゲット！'];
// rect = 品物の画面での位置、coinTo = コインが飛んでいく先の要素、sfx = 音の関数
export function landFx(tier, rect, coinTo, sfx) {
  if (!rect) return; const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  sparkleAt(cx, cy); if (tier >= 1) { sparkleAt(cx - 26, cy + 8); sparkleAt(cx + 26, cy + 8); }
  if (tier >= 1) flyCoins(rect, coinTo, 2 + tier * 2);
  if (tier >= 2) { ring(cx, cy, tier); confetti(tier === 3 ? 72 : 30); flash(tier); }
  if (tier >= 3) banner(BANNER[tier]);
  if (sfx) sfx(tier);
}
function ring(x, y, tier) {
  if (!motionOK()) return; const e = h('div', { cls: 'joy-ring t' + tier, 'aria-hidden': 'true' }); e.style.left = x + 'px'; e.style.top = y + 'px'; document.body.appendChild(e); setTimeout(() => e.remove(), 900);
}
function flash(tier) {
  if (!motionOK()) return; const e = h('div', { cls: 'joy-flash t' + tier, 'aria-hidden': 'true' }); document.body.appendChild(e); setTimeout(() => e.remove(), 700);
}
function banner(t) {
  if (!motionOK() || !t) return; const e = h('div', { cls: 'joy-banner', role: 'status', text: t }); document.body.appendChild(e); setTimeout(() => e.remove(), 1700);
}
export { fmt };
