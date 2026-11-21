// 目安箱：生徒の「こうしてほしい・こまっていること・アイデア」を、担任助手だけが読む。
// ・生徒（家の中の左下のボタン）：入力 → 4けたの番号 → サーバー（suggestion_post。1人1日3通・空と同じ文は断る）
// ・あり／なしの切りかえはない：サーバーが版27以上なら、家の中でいつでも出す（settings.suggestions_on は使わない・残すだけ）
// ・投稿の一覧は個人の気持ちなので、サーバー側で担任助手のパスワードが要る（admin_suggestion_list）。
//   ホームの「校舎のお知らせ」の板を、3秒以内に10回タップ → この端末に「一覧を表示する」の印（もう一度10回タップで消える）
import { h, modal, closeModal, confirmDlg, toast, passField } from './ui.js?v=202611211556';
import { SV, schemaAtLeast, errText, rpc, rememberedAdmin, rememberAdmin, SUGOK_KEY } from './server.js?v=202611211556';
import { motionOK } from './guide.js?v=202611211556';
import { busyBtn, loadHint } from './loading.js?v=202611211556';

export const SUG_SCHEMA = 27;   // サーバーがこの版以上のときだけ使える
export const SUG_MAX = 400;
const KEY = 'kojoHouse.meyasuShow';
export const sugAvailable = () => !!SV.on && schemaAtLeast(SUG_SCHEMA);   // 生徒のボタンを出してよいか
export const POST_ICO = '<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V10a7 7 0 0 1 14 0v11"/><path d="M3 21h18"/><path d="M9 11h6"/><path d="M12 15v6"/></svg>';
const ROT_ICO = '<svg class="ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18.5h2"/></svg>';
const CHECK_ICO = '<svg viewBox="0 0 52 52" width="64" height="64" aria-hidden="true"><circle class="mx-c" cx="26" cy="26" r="23" fill="none" stroke="currentColor" stroke-width="4"/><path class="mx-k" d="M15 27l8 8 15-17" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// ===== 生徒：送る =====
// 書きかけ（draft）は端末にも残す：うっかり「とじる」・アプリを閉じても消えない（送れたら消す）
const DKEY = 'kojoHouse.meyasuDraft';
let draft = ''; try { draft = localStorage.getItem(DKEY) || ''; } catch (e) { }
const keepDraft = v => { draft = v; try { if (v) localStorage.setItem(DKEY, v); else localStorage.removeItem(DKEY); } catch (e) { } };
// env = { nick, getPin()（番号。やめたら null）, post(body, pin)（サーバーへ。結果 {ok,err} か null）, dropPin() }
export function suggestDlg(env) {
  const ta = h('textarea', { cls: 'mx-ta', maxlength: String(SUG_MAX), rows: '5', placeholder: 'こうしてほしい・こまっていること・アイデア、なんでも書いてね', 'aria-label': '目安箱に送る内容', value: draft });
  const cnt = h('span', { cls: 'mx-cnt', text: '' }), upd = () => { keepDraft(ta.value); cnt.textContent = ta.value.length + ' / ' + SUG_MAX; };
  ta.addEventListener('input', upd); upd();
  const body = h('div', { cls: 'mx-dlg' }, [
    h('p', { cls: 'hint', text: 'こうしてほしい・こまっていること・アイデアを送ってね。担任助手が読みます。' }),
    h('p', { cls: 'mx-rot', 'aria-hidden': 'true' }), ta, h('div', { cls: 'mx-foot' }, [h('small', { text: '1日3通まで。名前（ニックネーム）つきで届きます' }), cnt])
  ]);
  const send = h('button', { cls: 'btn coral', text: '送る', onclick: async () => {
    const t = ta.value.trim(); if (!t) { toast('内容を書いてね', 'ng'); ta.focus(); return; }
    if (t.length > SUG_MAX) { toast(SUG_MAX + '字までです', 'ng'); return; }
    closeModal(); const pin = await env.getPin();
    if (pin === null) { suggestDlg(env); return; }   // 番号をやめたら、書いた内容を残したまま戻る
    const r = await env.post(t, pin);
    if (!r) { suggestDlg(env); return; }
    if (!r.ok) { if (r.err === 'pin' || r.err === 'locked') env.dropPin && env.dropPin(); toast(errText(r.err), 'ng'); suggestDlg(env); return; }
    keepDraft(''); thanks();
  } });
  const rot = body.querySelector('.mx-rot'); rot.innerHTML = ROT_ICO + '<span>たてにすると打ちやすいよ</span>';   // 横向きのスマホのときだけ出る（style.css）。縦向き・PC では隠す
  // 「とじる」は送るボタンからはなして左はしに。書きかけがあれば、とっておくことを伝える（消えない）
  const shut = h('button', { cls: 'btn mx-shut', text: 'とじる', onclick: () => { closeModal(); if (ta.value.trim()) toast('書いたところは、とっておくね'); } });
  modal('目安箱', body, [shut, send], 'meyasu');
  setTimeout(() => ta.focus(), 60);
}
function thanks() {
  const ic = h('div', { cls: 'mx-ok' + (motionOK() ? ' anim' : '') }); ic.innerHTML = CHECK_ICO;
  const body = h('div', { cls: 'mx-thx' }, [ic, h('b', { text: 'とどいたよ。ありがとう！' }), h('p', { cls: 'hint', text: '担任助手が読みます。' })]);
  modal('目安箱', body, [h('button', { cls: 'btn coral', text: 'とじる', onclick: closeModal })], 'meyasu');
  setTimeout(() => { if (body.isConnected) closeModal(); }, 2600);
}

// ===== 一覧（担任助手モードの中と、ホームの隠し表示で共通） =====
const pad = n => String(n).padStart(2, '0');
const stamp = ms => { const d = new Date(ms + 9 * 3600e3); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); };
// o = { list, onMark(id, read)→Promise<bool>, onDelete(id)→Promise<bool>, onChange() }。本文は textContent だけで入れる
export function sugCards(o) {
  const box = h('div', { cls: 'mx-list' });
  if (!o.list.length) { box.appendChild(h('div', { cls: 'hint', text: 'まだ投稿はありません' })); return box; }
  o.list.forEach(r => {
    const mark = h('button', { cls: 'btn sm', text: r.read ? '未読にもどす' : '既読にする', onclick: async () => { if (await o.onMark(r.id, !r.read)) { r.read = !r.read; o.onChange(); } } });
    const del = h('button', { cls: 'btn sm mx-del', text: '消す', onclick: async () => { if (!await confirmDlg('この投稿を消します。もとにはもどせません。', '消す', '投稿を消す')) return; if (await o.onDelete(r.id)) { o.list.splice(o.list.indexOf(r), 1); o.onChange(); } } });
    box.appendChild(h('div', { cls: 'mx-card c' + ((String(r.id).split('').reduce((a, ch) => a + ch.charCodeAt(0), 0)) % 4) + (r.read ? ' read' : '') }, [   // 付せんの色は投稿ごとに決まる（並べかえても同じ色）
      h('div', { cls: 'mx-meta' }, [h('span', { cls: 'mx-st' + (r.read ? ' on' : ''), text: r.read ? '既読' : '新着' }), h('span', { cls: 'mx-at', text: stamp(+r.at || 0) }), h('span', { cls: 'mx-who', text: [r.team, r.nick].filter(Boolean).join(' / ') })]),
      h('p', { cls: 'mx-body', text: r.body || '' }),
      h('div', { cls: 'mx-acts' }, [del, mark])   // 消すは左はし・既読は右（まちがえて押さないよう、はなす。押しても確認が出る）
    ]));
  });
  return box;
}

// ===== 担任助手モード：「目安箱」のまとまり（一覧・既読・消す） =====
const AD = { list: null, unread: 0 };
export function sugTab(pane, ctx) {
  pane.appendChild(h('p', { cls: 'hint', text: '生徒が家の中の左下のボタンから送った、こうしてほしい・こまっていること・アイデアです。ニックネームとチーミ名だけで、本名は出ません。生徒はいつでも家の中から送れます。' }));
  if (!SV.on) { pane.appendChild(h('div', { cls: 'hint', text: 'この機能はサーバー版でだけ使えます。' })); return; }
  if (!schemaAtLeast(SUG_SCHEMA)) { pane.appendChild(h('div', { cls: 'hint', text: 'サーバーの更新が必要です。更新するまで目安箱は使えません（今までの機能は使えます）。' })); return; }
  pane.appendChild(h('div', { cls: 'sec', text: '届いた投稿' + (AD.list ? '（未読 ' + AD.list.filter(x => !x.read).length + '件）' : '') }));
  pane.appendChild(h('div', { cls: 'acts-row' }, [h('button', { cls: 'btn sm', text: AD.list ? '更新' : '読みこむ', onclick: e => busyBtn(e.currentTarget, async () => { const r = await ctx.rpcA('admin_suggestion_list', {}); if (r) { AD.list = r.list || []; ctx.paint(); } return !!r; }) })]));
  if (AD.list) pane.appendChild(sugCards({
    list: AD.list, onChange: ctx.paint,
    onMark: async (id, read) => !!await ctx.rpcA('admin_suggestion_mark', { p_id: id, p_read: read }),
    onDelete: async id => !!await ctx.rpcA('admin_suggestion_delete', { p_id: id })
  }));
}

// ===== ホーム：隠しの入口と、一覧のカード =====
export const sugShown = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
const setShown = v => { try { if (v) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) { } };
const VKEY = 'kojoHouse.meyasuView';   // 掲示板か目安箱か（目安箱の表示がオンのときだけ意味がある）
export const sugView = () => { if (!sugShown()) return 'notice'; try { return localStorage.getItem(VKEY) === 'notice' ? 'notice' : 'box'; } catch (e) { return 'box'; } };
export const setSugView = v => { try { if (v === 'notice') localStorage.setItem(VKEY, 'notice'); else localStorage.removeItem(VKEY); } catch (e) { } };
// 見出しの右上の「お知らせ｜目安箱」の切りかえ（cur＝いま出している方）。押した指はカードの10回タップに数えない
export function sugSeg(cur, onPick) {
  const btns = [['notice', 'お知らせ'], ['box', '目安箱']].map(([v, t]) => h('button', { cls: 'mx-sb' + (v === cur ? ' on' : ''), type: 'button', text: t, 'aria-pressed': v === cur ? 'true' : 'false', onclick: () => {
    if (v === cur) return; cur = v; el.classList.toggle('r', v === 'box');   // 選ばれている印はスッとすべる
    btns.forEach((b, i) => { const on = (i === 1) === (v === 'box'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    onPick(v);
  } }));
  const el = h('div', { cls: 'mx-seg' + (cur === 'box' ? ' r' : ''), role: 'group', 'aria-label': '表示の切りかえ' }, [h('span', { cls: 'mx-th', 'aria-hidden': 'true' })].concat(btns));
  ['pointerdown', 'pointerup'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation()));
  return el;
}
const okMark = () => { try { return localStorage.getItem(SUGOK_KEY) === '1'; } catch (e) { return false; } };
const setOkMark = v => { try { if (v) localStorage.setItem(SUGOK_KEY, '1'); else localStorage.removeItem(SUGOK_KEY); } catch (e) { } };
// 覚えたパスワードを使ってよいのは、この端末で目安箱のパスワードを一度通したあとだけ（最初の1回は必ず入力画面）
const remPass = () => okMark() ? rememberedAdmin() : '';
let sessPass = '', cache = null;   // 覚えていない端末では、このページを開いている間だけパスワードを持つ
const listCall = async pw => { try { return await rpc('admin_suggestion_list', { p_admin: pw }); } catch (e) { return null; } };
// 担任助手のパスワードで一覧を取る。覚えた値があれば聞かない。なければ（または変わっていれば）入力画面。返り値：{ pass, r } か null
export async function sugAuth() {
  const rem = remPass();
  if (rem) {
    const r = await listCall(rem);
    if (r && r.ok) { sessPass = rem; return { pass: rem, r }; }
    if (!r) { toast('つながりませんでした。あとでもう一度', 'ng'); return null; }
    if (r.err !== 'admin') { toast(errText(r.err), 'ng'); return null; }   // パスワードが変わっていたら、server.js が覚えた値を消す → 入力画面へ
  }
  return new Promise(res => {
    const pf = passField({ placeholder: 'パスワード', label: '担任助手のパスワード' }), keep = h('input', { type: 'checkbox' }); keep.checked = true;
    let busy = false, done = false; const fin = v => { if (!done) { done = true; res(v); } };
    const go = async () => {
      if (busy) return; if (!pf.inp.value) { pf.fail('パスワードを入れてね'); return; } busy = true;
      const pw = pf.inp.value, r = await listCall(pw); busy = false;
      if (!r) { toast('つながりませんでした。あとでもう一度', 'ng'); return false; }
      if (!r.ok) { pf.inp.value = ''; pf.fail(r.err === 'admin' ? 'パスワードがちがいます' : errText(r.err)); return false; }
      if (keep.checked) { rememberAdmin(pw); setOkMark(true); } else setOkMark(false); sessPass = pw; closeModal(); fin({ pass: pw, r });
    };
    pf.inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) go(); });
    modal('目安箱を見る', h('div', {}, [h('p', { text: '担任助手のパスワードを入れてね' }), pf.box, h('label', { cls: 'pf-rem' }, [keep, h('span', { text: 'この端末を覚える' }), h('small', { text: '自分専用の端末だけ' })])]),
      [h('button', { cls: 'btn', text: 'やめる', onclick: () => { closeModal(); fin(null); } }), h('button', { cls: 'btn coral', text: 'ひらく', onclick: e => busyBtn(e.currentTarget, go) })]);
    setTimeout(() => pf.inp.focus(), 50);
  });
}
// 10回タップで 表示 ⇄ かくす（rerender＝ホームの描き直し）
export async function sugToggle(rerender) {
  if (sugShown()) { setShown(false); setSugView('box'); sessPass = ''; cache = null; toast('目安箱の一覧をかくしました', 'ok'); rerender(); return; }
  if (!SV.on || !schemaAtLeast(SUG_SCHEMA)) return;
  const a = await sugAuth(); if (!a) return;   // パスワードが通らなければ、一覧は出さず、印も付けない
  setShown(true); setSugView('box'); cache = a.r.list || []; toast('目安箱の一覧を表示します', 'ok'); rerender();
}
// ホームに置く一覧のカード（印がないときは null）。中身はあとから入る
export function sugHome(rerender, seg) {
  if (!sugShown() || !SV.on || !schemaAtLeast(SUG_SCHEMA)) return null;
  const box = h('div', { cls: 'mx-home board' });
  const paint = list => {
    box.innerHTML = '';
    const un = list ? list.filter(x => !x.read).length : 0;
    box.appendChild(h('div', { cls: 'board-top' }, [h('div', { cls: 'board-hd' }, [h('span', { cls: 'mx-ico', 'aria-hidden': 'true' }), h('b', { text: '目安箱' }), list && un ? h('span', { cls: 'board-n', text: '新着 ' + un + '件' }) : null, h('button', { cls: 'btn sm mx-re', text: '更新', onclick: load })]), seg ? seg() : null]));
    if (!list) { box.appendChild(loadHint()); return; }
    box.appendChild(sugCards({
      list, onChange: () => paint(list),
      onMark: async (id, read) => { const r = await call('admin_suggestion_mark', { p_id: id, p_read: read }); return !!(r && r.ok); },
      onDelete: async id => { const r = await call('admin_suggestion_delete', { p_id: id }); return !!(r && r.ok); }
    }));
  };
  const locked = () => { box.innerHTML = ''; box.appendChild(h('div', { cls: 'board-top' }, [h('div', { cls: 'board-hd' }, [h('span', { cls: 'mx-ico', 'aria-hidden': 'true' }), h('b', { text: '目安箱' })]), seg ? seg() : null])); box.appendChild(h('div', { cls: 'hint', text: '読むには、担任助手のパスワードが要ります' })); box.appendChild(h('button', { cls: 'btn sm coral', text: 'パスワードを入れる', onclick: async () => { const a = await sugAuth(); if (a) { cache = a.r.list || []; paint(cache); } } })); };
  const call = async (name, a) => { const pw = sessPass || remPass(); if (!pw) { locked(); return null; } try { const r = await rpc(name, Object.assign({ p_admin: pw }, a)); if (r && r.ok === false && r.err === 'admin') { sessPass = ''; locked(); } else if (r && r.ok === false) toast(errText(r.err), 'ng'); return r; } catch (e) { toast('つながりませんでした。あとでもう一度', 'ng'); return null; } };
  const load = async () => {
    const pw = sessPass || remPass(); if (!pw) { locked(); return; }
    const r = await listCall(pw);
    if (r && r.ok) { sessPass = pw; cache = r.list || []; paint(cache); } else if (r && r.err === 'admin') { sessPass = ''; locked(); } else if (!cache) { box.innerHTML = ''; box.appendChild(h('div', { cls: 'hint', text: 'つながりませんでした' })); }
  };
  paint(cache); load();
  return box;
}

// ===== 隠しの入口：長押しなしで、3秒以内に10回タップ =====
// 担任助手モードの入口（長押し→5回）とぶつからない：長押し（0.5秒以上）をしたら数えなおし、その後3.5秒は数えない。指が動いたタップ（スクロール）も数えない
export function sugEntry(el, onTen) {
  let taps = [], press = null, quiet = 0;
  const reset = () => { taps = []; };
  el.addEventListener('pointerdown', e => { if (e.button > 0 || e.isPrimary === false) return; press = { x: e.clientX, y: e.clientY, t: Date.now() }; });
  el.addEventListener('pointermove', e => { if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) { press = null; reset(); } });
  el.addEventListener('pointercancel', () => { press = null; reset(); });
  el.addEventListener('pointerup', () => {
    const p = press; press = null; if (!p) return;
    const now = Date.now();
    if (now - p.t >= 500) { reset(); quiet = now + 3500; return; }
    if (now < quiet) return;
    taps.push(now); taps = taps.filter(t => now - t <= 3000);
    if (taps.length >= 10) { reset(); onTen(); }
  });
  return el;
}
