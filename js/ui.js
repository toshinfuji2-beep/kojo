// 画面共通の小道具（要素づくり・モーダル・トースト）
export const $ = id => document.getElementById(id);
export const fmt = n => Math.round(n).toLocaleString('en-US');
export function h(tag, attrs, kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) { if (attrs[k] == null) continue; if (k === 'text') e.textContent = attrs[k]; else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]); else if (k === 'cls') e.className = attrs[k]; else if (k === 'value') e.value = attrs[k]; else e.setAttribute(k, attrs[k]); }
  (kids || []).forEach(c => c != null && e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  if (attrs && attrs.ico) { e.insertBefore(iconNode(attrs.ico, attrs.icoSize), e.firstChild); e.classList.add('has-ico'); }
  return e;
}
// ===== 線のアイコン（絵文字のかわり。24×24・currentColor。文字と同じ色・太さでそろう）=====
// h(..., { ico: '名前', text: '...' }) でボタン・見出しの先頭に入る／emptyBox・iconNode は名前を受ける（知らない名前は、そのままの文字を入れる）
const GEAR_D = 'M10.14 4.53L10.56 1.9L13.44 1.9L13.86 4.53L15.97 5.4L18.12 3.84L20.16 5.88L18.6 8.03L19.47 10.14L22.1 10.56L22.1 13.44L19.47 13.86L18.6 15.97L20.16 18.12L18.12 20.16L15.97 18.6L13.86 19.47L13.44 22.1L10.56 22.1L10.14 19.47L8.03 18.6L5.88 20.16L3.84 18.12L5.4 15.97L4.53 13.86L1.9 13.44L1.9 10.56L4.53 10.14L5.4 8.03L3.84 5.88L5.88 3.84L8.03 5.4Z M12 8.6a3.4 3.4 0 1 0 0 6.8a3.4 3.4 0 1 0 0-6.8Z';
export const ICO = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.5c2.8 0 4.5 1.7 4.5 4.5"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  megaphone: '<path d="M3 10v4h3l8 4V6L6 10zM17 9.5c1.3.8 2 1.7 2 2.5s-.7 1.7-2 2.5M7 14l1 5h2.5l-1-4.5"/>',
  gear: '<path fill="currentColor" fill-rule="evenodd" stroke-width="1.4" d="' + GEAR_D + '"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
  unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 017.5-2"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8c-2-4-6-3-5 0M12 8c2-4 6-3 5 0"/>',
  ticket: '<path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4z"/><path d="M14 7v2M14 11v2M14 15v2"/>',
  capsule: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><circle cx="12" cy="12" r="2"/>',
  folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  refresh: '<path d="M20 11a8 8 0 00-14-4L4 9M4 4v5h5M4 13a8 8 0 0014 4l2-2M20 20v-5h-5"/>',
  hash: '<path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  coin: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/>',
  fish: '<path d="M2 12c3-4 7-5 11-3l5-3-1 6 1 6-5-3c-4 2-8 1-11-3z"/><circle cx="8.5" cy="11" r=".8"/>',
  paw: '<circle cx="7" cy="10" r="1.8"/><circle cx="12" cy="7" r="1.8"/><circle cx="17" cy="10" r="1.8"/><path d="M7 17c0-3 2-5 5-5s5 2 5 5c0 2-2 3-3 3-1 0-1.5-.6-2-.6s-1 .6-2 .6c-1 0-3-1-3-3z"/>',
  bag: '<path d="M5 8h14l1 13H4zM9 8V6a3 3 0 016 0v2"/>',
  ribbon: '<circle cx="12" cy="9" r="5"/><path d="M9 13l-2 8 5-3 5 3-2-8"/>',
  shirt: '<path d="M8 4L3 7l2 4 3-1v10h8V10l3 1 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 5.5 8 4z"/>',
  box: '<path d="M3 8l9-5 9 5v9l-9 5-9-5zM3 8l9 5 9-5M12 13v9"/>',
  pencil: '<path d="M4 20l1-5L16 4l4 4L9 19zM14 6l4 4"/>',
  swap: '<path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  party: '<path d="M4 20l4-11 7 7zM13 5l1 2M18 9l2-1M17 4v2"/>',
  crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
  pin: '<path d="M9 3h6l-1 6 3 3v2H7v-2l3-3zM12 14v7"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M12 14v4M8 20h8"/>',
  sofa: '<path d="M5 11V8a2 2 0 012-2h10a2 2 0 012 2v3M3 12a2 2 0 014 0v3h10v-3a2 2 0 014 0v5H3zM6 17v2M18 17v2"/>',
  hand: '<path d="M8 12V6a1.5 1.5 0 013 0v5M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6a1.5 1.5 0 013 0v7c0 4-2 7-6 7-3 0-4-2-6-5l-1-2a1.5 1.5 0 012.5-1.5L8 14"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  chevR: '<path d="M9 5l7 7-7 7"/>',
  chevL: '<path d="M15 5l-7 7 7 7"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 11c.7.6 1 1.3 1 2h5c0-.7.3-1.4 1-2A6 6 0 0012 3z"/>',
  warn: '<path d="M12 3l10 18H2zM12 10v5M12 18v.5"/>',
  camera: '<path d="M4 8h3l1.6-2.5h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14"/>',
  share: '<path d="M12 15V4M8 8l4-4 4 4M6 12v7h12v-7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};
export const icoSvg = (name, size) => { const d = ICO[name]; return d ? '<svg class="ic ico-i" viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>' : ''; };
// 名前（または絵文字）から <span class="ico-w">svg</span>。知らない名前なら、そのままの文字を入れる
export function iconNode(name, size) { const e = document.createElement('span'), s = icoSvg(name, size); e.className = 'ico-w'; if (s) e.innerHTML = s; else e.textContent = name || ''; return e; }
export function modal(title, body, acts, cls) {
  dropGhosts(); const d = $('dlg'); d.innerHTML = ''; d.className = cls || ''; d.appendChild(h('h3', { text: title })); d.appendChild(h('div', { cls: 'dlg-body' }, [body]));   // 中身だけスクロールし、タイトルと下のボタンの帯（.acts）は動かない
  const a = h('div', { cls: 'acts' }); (acts || []).forEach(b => a.appendChild(b)); d.appendChild(a); $('modal').hidden = false;
}
// 切り替えのアニメーションを使うか：?test= の確認用ページは、?trans=1 をつけたとき以外は使わない（テストが待たずに状態を見るため）
export const uiAnim = () => { const q = new URLSearchParams(location.search); return !(q.has('test') && !q.has('trans')); };
// 閉じるとき：ダイアログ本体は写しを作らず、すぐ消す（半透明の中身がうしろの画面と重なって見えるのを防ぐ）。背景の暗い幕だけ、中身のない写しを0.1秒で薄くする。
// 写しは animationend と setTimeout の両方で必ず消し、次に開くとき・閉じるときにも残っていれば消す
const dropGhosts = () => { try { document.querySelectorAll('.modal-ghost').forEach(w => w.remove()); } catch (e) { } };
function modalGhost() {
  dropGhosts();
  if (!uiAnim() || $('modal').hidden || !$('dlg').firstChild) return;
  try {
    const w = document.createElement('div'); w.className = 'modal-ghost'; w.setAttribute('aria-hidden', 'true'); document.body.appendChild(w);
    w.addEventListener('animationend', () => w.remove()); setTimeout(() => w.remove(), 160);
  } catch (e) { /* 写しが作れなくても閉じる */ }
}
export function closeModal() { modalGhost(); $('modal').hidden = true; $('dlg').innerHTML = ''; }
export function confirmDlg(msg, ok, title, cancel) {
  return new Promise(res => {
    modal(title || 'かくにん', h('p', { text: msg }), [h('button', { cls: 'btn', text: cancel || 'やめる', onclick: () => { closeModal(); res(false); } }), h('button', { cls: 'btn coral', text: ok || 'OK', onclick: () => { closeModal(); res(true); } })]);
  });
}
// key を渡すと、同じ key の前のトーストは消して新しい物に置きかえる（続けて押しても重ならない）。同じ文面も置きかえる
// undo = { fn, label?, ms? } を渡すと「元に戻す」ボタンつき（8秒ほど出る。担任助手モードの、やり直せる操作用）
export function toast(msg, kind, key, undo) {
  const box = $('toasts'); [...box.children].forEach(c => { if (c.dataset.k === (key || msg)) c.remove(); });
  const t = undo ? h('div', { cls: 'toast has-undo ' + (kind || '') }, [h('span', { cls: 'tt', text: msg }), h('button', { cls: 'toast-undo', text: undo.label || '元に戻す', onclick: () => { t.remove(); undo.fn(); } })]) : h('div', { cls: 'toast ' + (kind || ''), text: msg });
  t.dataset.k = key || msg; box.appendChild(t);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => t.remove(), undo ? (undo.ms || 8000) : 2200);
}
// 画面の角：ボタンは丸い角・ノッチの内側に置く（style.css の --ci-l / --ci-r / --ci-b）。3D の家の絵（canvas）と右パネルの背景だけ端まで使う。切り替えはない
// 全画面シート（担任助手モード・ランキングで使う）
export function openSheet(title, buildBody, onClose) {
  const s = $('sheet'); s.hidden = false; s.innerHTML = '';
  const head = h('div', { cls: 'sh-head' }, [h('div', { cls: 'sh-title', text: title }), h('button', { cls: 'btn sm sh-close', text: 'とじる', onclick: () => closeSheet(onClose) })]);
  const body = h('div', { cls: 'sh-body' }); s.appendChild(head); s.appendChild(body); buildBody(body, head);
  return body;
}
export function closeSheet(onClose) { const s = $('sheet'); s.hidden = true; s.innerHTML = ''; if (onClose) onClose(); }
// ===== パスワード・番号の入力欄（鍵のアイコン・目のボタン・まちがえたときの揺れ）。担任助手まわりで共通に使う =====
// 返り値：box＝置く要素／inp＝input／fail(msg)＝揺らして赤いひとことを出す（入力し直すと消える）。生徒の4けた番号（pinPad）は別
const PF_LOCK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const PF_EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const PF_EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.5 10.5 0 0 1 12 19C5.6 19 2 12 2 12a18 18 0 0 1 4.1-5.1M9.9 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-2.2 3.2M14.1 14.1a3 3 0 0 1-4.2-4.2M2 2l20 20"/></svg>';
export function passField(o) {
  o = o || {};
  const inp = h('input', { type: 'password', cls: 'pass', maxlength: o.maxlength || '64', autocomplete: o.autocomplete || 'current-password', placeholder: o.placeholder || 'パスワード', 'aria-label': o.label || 'パスワード', spellcheck: 'false', autocapitalize: 'off' });
  const lock = h('span', { cls: 'pf-ico', 'aria-hidden': 'true' }); lock.innerHTML = PF_LOCK;
  const eye = h('button', { type: 'button', cls: 'pf-eye', title: '文字を表示する', 'aria-label': '文字を表示する', 'aria-pressed': 'false' }); eye.innerHTML = PF_EYE;
  const err = h('div', { cls: 'pf-err', role: 'alert' }), line = h('div', { cls: 'pf-in' }, [lock, inp, eye]);
  eye.addEventListener('mousedown', e => e.preventDefault());   // 押しても入力欄のフォーカスが外れない
  eye.onclick = () => { const on = inp.type === 'password'; inp.type = on ? 'text' : 'password'; line.classList.toggle('show', on); eye.innerHTML = on ? PF_EYE_OFF : PF_EYE; const t = on ? '文字をかくす' : '文字を表示する'; eye.title = t; eye.setAttribute('aria-label', t); eye.setAttribute('aria-pressed', String(on)); inp.focus(); };
  inp.addEventListener('input', () => { err.textContent = ''; line.classList.remove('bad'); });
  const fail = msg => { err.textContent = msg || ''; line.classList.add('bad'); line.classList.remove('shake'); void line.offsetWidth; line.classList.add('shake'); inp.focus(); inp.select(); };
  return { box: h('div', { cls: 'pf' }, [line, err]), inp, fail };
}
// ===== キーボード：ダイアログの Enter＝主ボタン・Esc＝やめる、シートの Esc、1行の入力欄の Enter＝そのフォームの決定ボタン =====
export const isTextField = el => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|file|range|color)$/.test(el.type)));
const isMain = b => b.classList.contains('coral') || b.classList.contains('mint');
const dlgBtns = () => [...$('dlg').querySelectorAll('.acts button')].filter(b => !b.disabled);
// 主ボタン：珊瑚色・緑のうち いちばん右。なければ、ボタンが1つだけならそれ
export function dlgPrimary() { const bs = dlgBtns(), m = bs.filter(isMain); return m.length ? m[m.length - 1] : bs.length === 1 ? bs[0] : null; }
// やめる側のボタン：「やめる・とじる」などの文言を優先。選択肢が並ぶダイアログの先頭を押さないよう、文言が見つからなければ 非主ボタンが1つのときだけ
export function dlgCancel() { const ps = dlgBtns().filter(b => !isMain(b)); return ps.find(b => /^(やめる|とじる|閉じる|キャンセル|あとで|あとにする|もどる|戻る|いいえ|スキップ|OK)/.test(b.textContent.trim())) || (ps.length === 1 ? ps[0] : null); }
if (typeof window !== 'undefined') window.addEventListener('keydown', e => {
  if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
  const t = e.target, md = $('modal'), sh = $('sheet');
  if (md && !md.hidden) {
    const dlg = $('dlg'); if (dlg.querySelector('.pin-keys')) return;   // 番号入力は pinPad が自分で受ける
    if (e.key === 'Enter') {
      if (t && (t.tagName === 'BUTTON' || t.tagName === 'A' || t.tagName === 'SUMMARY')) return;   // ボタンの上の Enter は、そのボタン自身を押す
      if (t && t.tagName === 'TEXTAREA' && !(e.ctrlKey || e.metaKey)) return;                     // 複数行の中の Enter は改行。Ctrl+Enter で決定
      const b = dlgPrimary(); if (b) { e.preventDefault(); b.click(); }
    } else if (e.key === 'Escape') { const b = dlgCancel(); if (b) { e.preventDefault(); b.click(); } else if (!dlg.classList.contains('sticky')) { e.preventDefault(); closeModal(); } }   // sticky（外側タップで閉じない画面）は、やめるボタンがあるときだけ
    return;
  }
  if (!sh || sh.hidden) return;
  if (e.key === 'Escape') {
    if (isTextField(t)) { t.blur(); e.preventDefault(); return; }   // 入力中の Esc は、まず入力欄から出るだけ（書きかけを失わない）
    const b = sh.querySelector('.sh-close'); if (b) { e.preventDefault(); b.click(); }
  } else if (e.key === 'Enter' && isTextField(t) && !e.shiftKey && !e.altKey) {
    const ta = t.tagName === 'TEXTAREA'; if (ta && !(e.ctrlKey || e.metaKey)) return;
    const root = t.closest('.card, form, .adm-pane'); if (!root) return;
    const bs = [...root.querySelectorAll(ta ? '.btn.mint:not(.sm), .btn.coral:not(.sm)' : '.btn.mint:not(.sm)')].filter(b => !b.disabled);
    if (bs.length === 1) { e.preventDefault(); bs[0].click(); }   // 決定ボタンがはっきり1つのときだけ
  }
});
// 空の状態：絵文字のイラスト＋一言（＋ひとこと補足）
export function emptyBox(icon, text, sub) {
  return h('div', { cls: 'empty' }, [h('div', { cls: 'empty-ico' }, [iconNode(icon, 44)]), h('div', { cls: 'empty-t', text }), sub ? h('div', { cls: 'empty-sub', text: sub }) : null]);
}
// 読み込み中：葉っぱのアニメ＋ひとことヒント（index.html の最初の表示と同じ見た目）
export const HINTS = ['ピコは、向上得点・在校時間・ミッションでたまります', '家具をタップすると、動かす・回す・しまうができます', 'チーミ貯金箱のピコで、みんなの家を広げられます', '2本指で拡大・縮小、ドラッグで視点を変えられます', '壁紙と床は、リフォームで部屋ごとに変えられます'];
export function loadingBox(msg) {
  return h('div', { cls: 'boot', role: 'status' }, [h('div', { cls: 'boot-leaves', 'aria-hidden': 'true' }, [h('i'), h('i'), h('i')]), h('p', { cls: 'boot-t', text: msg || '読み込み中' }), h('p', { cls: 'boot-h', text: 'ヒント：' + HINTS[Math.floor(Math.random() * HINTS.length)] })]);
}
