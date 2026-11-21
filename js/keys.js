// キーボードのショートカット（PCのキーボードがある人向け）
// ・ダイアログの Enter（主ボタン）／Esc（やめる）、シートの Esc、1行の入力欄の Enter は ui.js
// ・担任助手モードの Ctrl+数字・Ctrl+F・Ctrl+S は admin.js
// ・ここは「家の中」と「どこでも」のキー。入力欄に文字を打っている間は効かない。ブラウザ標準（Ctrl+R/C/V/Z/T/W など）は上書きしない
import { $, h, modal, closeModal, isTextField } from './ui.js?v=202611211556';

export const SHORTCUTS = [
  ['家の中', [['1〜5', 'パネルのタブ（ショップ・持ち物・リフォーム・間取り・ミッション）'], ['L', '電気をつける・消す'], ['V', '視点を切りかえる'], ['F', '自分の目線にする・やめる（ドラッグで見わたす）'], ['M', 'まとめて選ぶ'], ['Q / E', 'カメラを回す'], ['← →', '部屋を切りかえる（部屋が2つ以上）'], ['Esc', '選択の解除・置くのをやめる']]],
  ['どこでも', [['?', 'この一覧を出す'], ['Ctrl + ,', '設定を開く'], ['Esc', 'もどる（ダイアログ → シート → 家から出る確認）'], ['Enter', 'ダイアログの いちばん目立つボタン'], ['Ctrl + Enter', '複数行の入力欄の中で決定']]],
  ['担任助手モード', [['Ctrl + 1〜5', 'まとまりをきりかえる（ホーム・生徒・ピコ・お知らせ・設定）'], ['Ctrl + 6〜9', 'そのまとまりの中の画面（左から1〜4番め）'], ['Ctrl + F', '生徒をさがす'], ['Ctrl + S', '保存ボタンを押す（ある画面だけ）'], ['Enter', '表の入力欄で、次の行の同じ列へ']]]
];
// タッチだけの端末（スマホ）では、一覧のボタンを出さない：(pointer: coarse) で、キーボードの入力がまだ無いとき
let kbSeen = false;
if (typeof window !== 'undefined') window.addEventListener('keydown', e => { if (e.key && e.key !== 'Unidentified' && e.key !== 'Process') kbSeen = true; }, true);
export const hasKeyboard = () => { try { return kbSeen || !window.matchMedia('(pointer: coarse)').matches; } catch (e) { return true; } };

export function keyHelpDlg() {
  const col = [h('div'), h('div')];
  SHORTCUTS.forEach(([sec, rows], i) => { const c = col[i === 0 ? 0 : 1]; c.appendChild(h('div', { cls: 'kb-sec', text: sec })); rows.forEach(([k, t]) => c.appendChild(h('div', { cls: 'kb-row' }, [h('span', { text: t }), h('kbd', { text: k })]))); });
  modal('キーボードのショートカット', h('div', {}, [h('div', { cls: 'kb-cols' }, col), h('p', { cls: 'hint', text: 'Mac は Ctrl のかわりに ⌘ も使えます。文字を打っている間は、1〜5・L・V などは効きません。Ctrl+R は ブラウザの「読み込み直し」のままです。' })]), [h('button', { cls: 'btn coral', text: 'とじる', onclick: closeModal })], 'kbbox');
}

// c：{ inHouse(), settings(), tab(i), light(), view(), multi(), eye(), yaw(d), room(d), escape() }（main.js が渡す）
export function initKeys(c) {
  window.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
    const mod = e.ctrlKey || e.metaKey, t = e.target, modalOpen = !$('modal').hidden;
    if (mod && !e.altKey && e.key === ',') { if (modalOpen) return; e.preventDefault(); c.settings(); return; }
    if (mod || e.altKey) return;   // ブラウザ標準のショートカットは触らない
    if (isTextField(t) || (t && (t.tagName === 'SELECT' || t.isContentEditable))) return;   // 文字を打っている間は効かない
    if (e.key === '?') { if (!modalOpen) { e.preventDefault(); keyHelpDlg(); } return; }
    if (modalOpen || !$('sheet').hidden) return;   // ダイアログ・シートの Esc/Enter は ui.js
    if (!c.inHouse()) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { e.preventDefault(); c.escape(); return; }
    if (k === 'q' || k === 'e') { e.preventDefault(); c.yaw(k === 'q' ? -1 : 1); return; }   // 押しっぱなしで回り続ける
    if (e.repeat) return;
    if (/^[1-5]$/.test(k)) { e.preventDefault(); c.tab(+k - 1); }
    else if (k === 'l') { e.preventDefault(); c.light(); }
    else if (k === 'v') { e.preventDefault(); c.view(); }
    else if (k === 'f') { e.preventDefault(); c.eye(); }
    else if (k === 'm') { e.preventDefault(); c.multi(); }
    else if (k === 'arrowleft' || k === 'arrowright') { e.preventDefault(); c.room(k === 'arrowleft' ? -1 : 1); }
  });
}
