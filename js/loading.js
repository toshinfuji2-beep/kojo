// 待ちの表示の共通部品（動かすのは transform と opacity だけ／絵文字なし／動きを減らす設定のときは控えめな点滅だけ）
//  ・busyBtn(btn, promise|fn)   ボタンの「送信中」：中身が跳ねる点に変わり（幅は変えない・二度押し不可）、成功でチェックがポン、失敗で小さく揺れる
//  ・busyOverlay(text, opt)     少し長い待ちの表示（ピコのコインがくるくる回って跳ねる）。250ms 未満なら何も出さず、出したら最低 400ms は出す。返り値の done() で閉じる
//  ・bootScene(msg)             最初の読み込み画面（家が組み上がり、コインが積み上がる）
//  ・netWatch(name, promise)    server.js の rpc を見張って、待ちが長いときだけ busyOverlay を出す（動きは変えない）
import { h } from './ui.js?v=202611211556';

const SHOW_AFTER = 250, SHOW_MIN = 400, BTN_AFTER = 150, BTN_MIN = 320, OK_HOLD = 650;
const mql = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const reduced = () => !!(mql && mql.matches);
const NS = 'http://www.w3.org/2000/svg';
const CHECK = '<svg class="bz-chk" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

// ===== 上に出す待ちの表示 =====
let tickets = [], root = null, timer = 0, shownAt = 0, hideT = 0, quiet = 0, seq = 0;
function paint() {
  const live = tickets.slice(-1)[0], soft = tickets.every(t => t.soft);
  if (!root) {
    root = h('div', { cls: 'bz', role: 'status', 'aria-live': 'polite' }, [h('div', { cls: 'bz-card' }, [
      h('div', { cls: 'bz-stage', 'aria-hidden': 'true' }, [h('i', { cls: 'bz-sh' }), h('i', { cls: 'bz-hop' }, [h('i', { cls: 'bz-coin' })])]),
      h('span', { cls: 'bz-t' }), h('span', { cls: 'bz-dots', 'aria-hidden': 'true' }, [h('i'), h('i'), h('i')])])]);
    document.body.appendChild(root); shownAt = Date.now();
  }
  clearTimeout(hideT); root.classList.remove('out'); root.classList.toggle('soft', soft);
  root.querySelector('.bz-t').textContent = live ? live.text : '';
}
function maybeShow() {
  timer = 0; if (!tickets.length || quiet > 0) return;
  paint();
}
function maybeHide() {
  if (tickets.length) return;
  clearTimeout(timer); timer = 0;
  if (!root) return;
  const wait = Math.max(0, shownAt + SHOW_MIN - Date.now());
  clearTimeout(hideT);
  hideT = setTimeout(() => { if (!root || tickets.length) return; root.classList.add('out'); hideT = setTimeout(() => { if (root && !tickets.length) { root.remove(); root = null; } }, 200); }, wait);
}
// 返り値の done() を呼ぶと閉じる（何度呼んでも安全）。opt.soft：画面をふさがない小さな表示（バックグラウンドの保存など）
export function busyOverlay(text, opt) {
  const t = { id: ++seq, text: String(text || 'つなぎ中'), soft: !!(opt && opt.soft) };
  tickets.push(t);
  if (root) paint(); else if (!timer) timer = setTimeout(maybeShow, SHOW_AFTER);
  return function done() { const i = tickets.indexOf(t); if (i < 0) return; tickets.splice(i, 1); if (root && tickets.length) paint(); maybeHide(); };
}
// promise が終わるまで busyOverlay を出す。結果はそのまま返す（失敗も、そのまま投げる）
export function withBusy(text, p, opt) { const done = busyOverlay(text, opt); return Promise.resolve(p).finally(done); }

// ===== ボタンの「送信中」 =====
// btn：押したボタン／p：Promise か、Promise を返す関数。結果が false・null・{ok:false}・投げた失敗なら「失敗」、それ以外は「成功」
// 返り値は p の結果そのまま（呼ぶ側の流れは変わらない）。
const isFail = r => r === false || r === null || (r && typeof r === 'object' && r.ok === false);
export function busyBtn(btn, p) {
  if (!btn) return Promise.resolve(typeof p === 'function' ? p() : p);
  if (btn._bz) return btn._bz;
  quiet++;
  const kept = [...btn.childNodes], prevW = btn.style.width, prevMin = btn.style.minWidth, prevLabel = btn.getAttribute('aria-label');
  const t0 = Date.now(); let swapped = false, swapT = 0, dead = false;
  const lock = () => { const w = btn.getBoundingClientRect().width; if (w > 0) { btn.style.width = w + 'px'; btn.style.minWidth = w + 'px'; } };
  const restore = () => {
    if (dead) return; dead = true; clearTimeout(swapT);
    btn.replaceChildren(...kept); btn.style.width = prevW; btn.style.minWidth = prevMin; btn.classList.remove('bz-on', 'bz-ok', 'bz-ng');
    btn.removeAttribute('aria-busy'); btn.disabled = false; delete btn._bz;
    if (prevLabel == null) btn.removeAttribute('aria-label'); else btn.setAttribute('aria-label', prevLabel);
  };
  const swap = () => {
    swapped = true; lock(); btn.classList.add('bz-on'); btn.setAttribute('aria-busy', 'true');
    btn.replaceChildren(h('span', { cls: 'bz-spin', 'aria-hidden': 'true' }, [h('i'), h('i'), h('i')]));
  };
  btn.disabled = true; swapT = setTimeout(swap, BTN_AFTER);
  const fin = (ok) => {
    quiet = Math.max(0, quiet - 1);
    const after = () => {
      clearTimeout(swapT);
      if (!swapped) { lock(); btn.classList.add('bz-on'); }
      if (ok) {
        btn.classList.remove('bz-on'); btn.classList.add('bz-ok'); const dn = h('span', { cls: 'bz-done', 'aria-hidden': 'true' }); dn.innerHTML = CHECK; btn.replaceChildren(dn); btn.setAttribute('aria-label', 'できました');
        if (!window.__bzHold) setTimeout(restore, reduced() ? 500 : OK_HOLD);
      } else {
        if (window.__bzHold) { btn.classList.remove('bz-on'); btn.classList.add('bz-ng'); return; }
        restore(); btn.classList.add('bz-ng'); setTimeout(() => btn.classList.remove('bz-ng'), 500);
      }
    };
    // いちど回り出したら、最低 BTN_MIN は見せる（チカッとしない）
    const left = swapped ? Math.max(0, t0 + BTN_AFTER + BTN_MIN - Date.now()) : 0;
    if (left) setTimeout(after, left); else after();
  };
  const run = Promise.resolve().then(() => typeof p === 'function' ? p() : p);
  const res = run.then(r => { fin(!isFail(r)); return r; }, e => { fin(false); throw e; });
  btn._bz = res; res.catch(() => { }); return res;
}

// 画面の中に置く「読みこみ中」（古い文字だけの「読み込み中…」のかわり）。表示は遅らせず、小さなコインと点がなめらかに出る
export function loadHint(text) {
  return h('div', { cls: 'bz-inl', role: 'status' }, [h('i', { cls: 'bz-mc', 'aria-hidden': 'true' }), h('span', { text: text || '読みこみ中' }), h('span', { cls: 'bz-dots', 'aria-hidden': 'true' }, [h('i'), h('i'), h('i')])]);
}

// ===== サーバーの待ちを見張る =====
// 裏で動くもの（画面に出さない）／画面をふさがない小さな表示／画面をふさぐ表示（文言つき）
const QUIET = new Set(['server_info', 'run_due_grants', 'mission_progress', 'admin_pin_status', 'admin_vault_put', 'admin_vault_get', 'admin_logs', 'admin_mark_export']);
const SOFT = {};
const SAVE = { house_commit: 1, team_layout: 1, set_profile: 1 };   // 家・間取り・プロフィールの保存：画面をふさがず、右上の「ぽちぽち」（下の自動セーブの表示）で知らせる
const TXT = {
  check_team_pass: 'あいことばを確かめています', check_pin: '番号を確かめています', set_pin: '番号を決めています', admin_check: 'パスワードを確かめています',
  buy_item: '買っています', buy_wear: '買っています', donate: '貯金箱に入れています', create_me: 'me- を作っています', team_slots: '名簿を見ています',
  gacha_redeem: 'ガチャをあけています', gift_redeem: 'プレゼントをあけています', suggestion_post: '目安箱に送っています', mission_claim: 'ごほうびを受け取っています',
  admin_grant: 'ピコを配っています', admin_event_grant: 'ピコを配っています', staff_score_apply: '取り込んでいます', staff_score_undo: 'もとにもどしています',
  admin_set_passcode: 'パスワードを変えています', admin_gacha_create: 'コードを作っています', admin_launch_reset: 'はじめからにしています', admin_wipe: '消しています'
};
const READ = /(_list|_get|_status|_logs|_log|_export|_counts)$/;
export function netWatch(name, p) {
  if (QUIET.has(name) || !p || typeof p.then !== 'function') return;
  if (SAVE[name]) { saveTrack(p, name === 'house_commit'); return; }
  const soft = !!SOFT[name] || !TXT[name] && !/^admin_|^staff_/.test(name);
  const text = SOFT[name] || TXT[name] || (READ.test(name) ? 'よみこんでいます' : /^admin_|^staff_/.test(name) ? 'ほぞんしています' : 'つなぎ中');
  const done = busyOverlay(text, { soft });
  const end = () => done(); p.then(end, end);
}

// ===== 自動セーブの表示（家の画面の右上。ヘッダーのボタン・右はしレールとは重ならない所）=====
// ・保存しているあいだ：小さな「ぽちぽち」（点が円に並んで回る）。終わったらチェックに変わって、ふわっと消える（最低 700ms は見せる＝チカッとしない）
// ・失敗：赤い印と「保存できませんでした。もう一度」（押すとすぐやり直す）。つながらない失敗は、あとで自動でやり直す（3秒 → 7秒 → 15秒ごと）。サーバーが断った失敗は、少し見せて消す（理由は別の表示が出る）
// ・動かすのは opacity と transform だけ。動きを減らす設定のときは、回さずに点灯だけ。
const SV_MIN = 700, SV_OK = 1000, SV_RETRY = [3000, 7000, 15000], SV_NET = /fetch|network|timeout|load failed|offline/i;
const sv = { n: 0, fail: false, net: false, retryable: false, el: null, t0: 0, hideT: 0, doneT: 0, tries: 0, retryT: 0, retryFn: null };
const SV_LABEL = { saving: 'ほぞんしています', ok: 'ほぞんしました', ng: '保存できませんでした。もう一度' };
// 保存をやり直す関数を渡す（やり直すものがあって始めたら true／なければ false）。main.js が登録する
export function onSaveRetry(fn) { sv.retryFn = fn; }
function svEl() {
  if (sv.el && sv.el.isConnected) return sv.el;
  const dots = []; for (let i = 0; i < 8; i++) dots.push(h('i', { style: '--a:' + (i * 45) + 'deg;--d:' + (i * 0.1).toFixed(1) + 's' }));
  const ok = h('span', { cls: 'sv-ok', 'aria-hidden': 'true' }); ok.innerHTML = CHECK;
  const ng = h('span', { cls: 'sv-ng', 'aria-hidden': 'true' }); ng.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v8M12 18v.5"/></svg>';
  const e = h('button', { cls: 'sv-pill', id: 'saveInd', type: 'button', hidden: true, role: 'status', 'aria-live': 'polite' }, [
    h('span', { cls: 'sv-ring', 'aria-hidden': 'true' }, dots), ok, ng, h('span', { cls: 'sv-t', text: SV_LABEL.ng })]);
  e.addEventListener('click', () => { if (e.dataset.s === 'ng') { clearTimeout(sv.retryT); svRetry(); } });
  (document.getElementById('stage') || document.body).appendChild(e); sv.el = e; return e;
}
function svShow(state) {
  const e = svEl(); clearTimeout(sv.hideT); e.dataset.s = state; e.setAttribute('aria-label', SV_LABEL[state]);
  if (e.hidden) { e.hidden = false; void e.offsetWidth; }
  e.classList.add('on');
}
function svHide() {
  const e = sv.el; if (!e) return; e.classList.remove('on');
  sv.hideT = setTimeout(() => { if (!e.classList.contains('on')) e.hidden = true; }, 340);
}
function svBad(r) {   // supabase の返り値（{data, error}）：失敗か
  if (!r || typeof r !== 'object') return false;
  return !!r.error || (r.data && r.data.ok === false);
}
// p：保存の通信の Promise。retry：つながらない失敗のとき、あとで自動でやり直すか
export function saveTrack(p, retry) {
  if (!p || typeof p.then !== 'function') return;
  clearTimeout(sv.doneT); clearTimeout(sv.retryT);
  if (sv.n === 0) { sv.fail = false; sv.net = false; sv.t0 = Date.now(); }
  sv.n++; svShow('saving');
  let ended = false;
  const end = (bad, net) => {
    if (ended) return; ended = true; sv.n = Math.max(0, sv.n - 1);
    if (bad) { sv.fail = true; if (net && retry) sv.net = true; }
    if (sv.n > 0) return;
    sv.doneT = setTimeout(svSettle, Math.max(0, sv.t0 + SV_MIN - Date.now()));
  };
  p.then(r => end(svBad(r), !!(r && r.error && SV_NET.test(String(r.error.message || '')))), () => end(true, true));
}
// 端末だけに保存したとき（サーバーを使わない動き）：すぐ終わる保存を、チェックで見せる
export function saveFlash() { saveTrack(Promise.resolve({ data: { ok: true } }), false); }
function svSettle() {
  if (sv.n > 0) return;
  if (!sv.fail) { sv.tries = 0; svShow('ok'); sv.doneT = setTimeout(svHide, SV_OK); return; }
  svShow('ng');
  if (sv.net) { const d = SV_RETRY[Math.min(sv.tries, SV_RETRY.length - 1)]; sv.tries++; sv.retryT = setTimeout(svRetry, d); }
  else sv.doneT = setTimeout(svHide, 3500);
}
function svRetry() {
  clearTimeout(sv.retryT); let go = false;
  try { go = !!(sv.retryFn && sv.retryFn()); } catch (e) { }
  if (!go) { sv.tries = 0; svHide(); return; }   // やり直すものがない（家を出た・すでに最新）
  sv.retryT = setTimeout(() => { if (sv.n === 0 && sv.el && sv.el.dataset.s === 'ng') svRetry(); }, 5000);   // 送り出せなかったとき（動かし中など）のために、また見に来る
}

// ===== 最初の読み込み画面：家が組み上がり、コインが積み上がる =====
const HOUSE_PARTS = [
  ['base', '<rect x="14" y="76" width="84" height="8" rx="4" fill="#c98f56"/><rect x="14" y="76" width="84" height="3" rx="1.5" fill="#e6bd88"/>'],
  ['wall', '<rect x="24" y="44" width="64" height="32" rx="3" fill="#fff6e5" stroke="#b98650" stroke-width="2.5"/>'],
  ['door', '<path d="M48 76V61a7 7 0 0 1 14 0v15z" fill="#c98f56" stroke="#8a5a2e" stroke-width="2" stroke-linejoin="round"/><circle cx="58" cy="66" r="1.4" fill="#f5c542"/>'],
  ['win', '<rect x="29" y="52" width="13" height="12" rx="2.5" fill="#a9dcf4" stroke="#8a5a2e" stroke-width="2"/><rect x="70" y="52" width="13" height="12" rx="2.5" fill="#a9dcf4" stroke="#8a5a2e" stroke-width="2"/>'],
  ['chim', '<rect x="68" y="22" width="9" height="16" rx="2" fill="#d9665a" stroke="#a84c43" stroke-width="2"/>'],
  ['roof', '<path d="M17 47L56 16l39 31z" fill="#f2877a" stroke="#d9665a" stroke-width="3" stroke-linejoin="round"/><path d="M30 41l26-20" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round" fill="none"/>']
];
const COIN = (y, i) => '<g class="bs-p bs-c" style="--i:' + (HOUSE_PARTS.length + i) + '"><ellipse cx="128" cy="' + (y + 4) + '" rx="13" ry="5" fill="#d9a021"/><rect x="115" y="' + y + '" width="26" height="4" fill="#d9a021"/><ellipse cx="128" cy="' + y + '" rx="13" ry="5" fill="#f5c542" stroke="#a87414" stroke-width="1.6"/><ellipse cx="128" cy="' + y + '" rx="7" ry="2.5" fill="none" stroke="#d9a021" stroke-width="1.4"/></g>';
export function bootScene(msg, hint) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 150 92'); svg.setAttribute('class', 'bs-svg'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<ellipse class="bs-glow" cx="75" cy="52" rx="66" ry="34" fill="#ffe7a8"/>'
    + HOUSE_PARTS.map((p, i) => '<g class="bs-p" style="--i:' + i + '">' + p[1] + '</g>').join('')
    + [78, 70, 62, 54].map((y, i) => COIN(y, i)).join('');
  const kids = [h('div', { cls: 'bs-scene', 'aria-hidden': 'true' }), h('p', { cls: 'boot-t', text: msg || '読み込み中' })];
  kids[0].appendChild(svg);
  if (hint) kids.push(h('p', { cls: 'boot-h', text: hint }));
  return h('div', { cls: 'boot bs', role: 'status' }, kids);
}
