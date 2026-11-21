// 担任助手モードの「見取り図」：役割ごとのタブ・どこからでも生徒を探す・生徒カード・ホームの「今日やること」
// admin.js から ctx（状態と操作の入口）をもらって動く。本名が見えるのは担任助手モードの中だけ
import { h, modal, closeModal, toast, iconNode } from './ui.js?v=202611211556';
import { SV } from './server.js?v=202611211556';
import { faceImg } from './meui.js?v=202611211556';
import { sameDayImport, startPassed, fmtAt, retireDlg } from './admin2.js?v=202611211556';

// ===== タブのまとまり：役割ごとに5つ。ふだんの仕事は「ホーム」と「検索」から入れる =====
export const TAB_NAMES = { home: 'ホーム', roster: '名簿', teams: 'チーミ編成', link: 'ひもづけ', pins: '番号を忘れたとき', staffme: '担任助手me-', score: '向上得点', stay: '在校時間', event: '特別ピコ', gift: 'QRプレゼント', gacha: '物理ガチャ', notice: 'お知らせ', meyasu: '目安箱', mission: 'ミッション', poster: '掲示', set: '設定' };
export const GROUPS = [
  { k: 'home', n: 'ホーム', ico: 'home', tabs: ['home'] },
  { k: 'people', n: '生徒・チーミ', ico: 'people', tabs: ['roster', 'teams', 'link', 'pins', 'staffme'] },
  { k: 'pico', n: 'ピコ・得点', ico: 'star', tabs: ['score', 'stay', 'event', 'gift', 'gacha'] },
  { k: 'info', n: 'お知らせ・掲示', ico: 'megaphone', tabs: ['notice', 'mission', 'poster', 'meyasu'] },
  { k: 'set', n: '設定', ico: 'gear', tabs: ['set'] }
];
export const groupOf = tab => GROUPS.find(g => g.tabs.includes(tab)) || GROUPS[0];
export const groupTabs = g => g.tabs.filter(t => t !== 'link' || SV.on);

// ===== 今日やること =====
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
// [{ k, group, n, text, sub, tab, urgent }]。ctx.S()＝名簿モデル。サーバー版のときだけの項目もある
export function todos(ctx) {
  const S0 = ctx.S(), out = [], st = S0.students, tm = S0.teams, inTeam = new Set(); tm.forEach(t => t.members.forEach(u => inTeam.add(u)));
  const linked = st.filter(s => s.link).length;
  if (SV.on) {
    const pend = SV.rows.filter(r => !r.approved).length;
    if (pend) out.push({ k: 'pend', group: 'people', n: pend, text: '承認まち ' + pend + '人', sub: '名簿の人にひもづけます', tab: 'link', urgent: true });
    const ps = ctx.A.pinStatus, locked = ps ? Object.keys(ps).filter(u => ps[u] && ps[u].locked).length : 0;
    if (locked) out.push({ k: 'lock', group: 'people', n: locked, text: '番号ロック中 ' + locked + '人', sub: 'まちがいが続いてロックされています', tab: 'pins', urgent: true });
  }
  const noTeam = st.filter(s => !inTeam.has(s.uid) && !s.retired).length;
  if (noTeam) out.push({ k: 'noteam', group: 'people', n: noTeam, text: 'チーミ未所属 ' + noTeam + '人', sub: 'チーミに入れます', tab: 'teams' });
  const unconf = SV.on ? tm.filter(t => !t.confirmed && t.members.length).length : 0;
  if (unconf) out.push({ k: 'unconf', group: 'people', n: unconf, text: '未確定のチーミ ' + unconf + 'つ', sub: '確定すると、生徒が名前をえらべます', tab: 'teams' });
  if (SV.on && linked && startPassed()) {
    [['score', '向上得点'], ['stay', '在校時間']].forEach(([kind, nm]) => {
      if (sameDayImport(S0.scoreLog, kind)) return;
      const last = (S0.scoreLog || []).find(l => (l.kind || 'score') === kind && !l.undone);
      out.push({ k: 'imp_' + kind, group: 'pico', n: 0, text: '今日の' + nm + 'がまだです', sub: last ? '最後の取り込み ' + fmtAt(last.at) : 'まだ一度も取り込んでいません', tab: kind });
    });
  }
  const today = ymd(new Date()), soon = ymd(new Date(Date.now() + 2 * 864e5));
  (ctx.notices() || []).filter(n => n.date).forEach(n => {
    if (n.date < today) out.push({ k: 'nt_' + n.id, group: 'info', n: 0, text: 'お知らせ「' + n.title + '」の日が過ぎています', sub: '消すか、書きなおします', tab: 'notice' });
    else if (n.date <= soon) out.push({ k: 'nt_' + n.id, group: 'info', n: 0, text: 'お知らせ「' + n.title + '」がもうすぐ（' + n.date.slice(5).replace('-', '/') + '）', sub: '', tab: 'notice' });
  });
  return out;
}
export function todoCards(ctx, items) {
  const box = h('div', { cls: 'todo-box' });
  if (!items.length) { box.appendChild(h('div', { cls: 'todo-none' }, [h('span', { cls: 'ok', text: '✓' }), h('b', { text: '今日やることは、いまのところありません' })])); return box; }
  box.appendChild(h('div', { cls: 'todo-hd', text: '今日やること' }));
  const grid = h('div', { cls: 'todo-grid' }); box.appendChild(grid);
  items.slice(0, 8).forEach(it => grid.appendChild(h('button', { cls: 'todo-card' + (it.urgent ? ' urgent' : ''), onclick: () => ctx.go(it.tab) }, [
    h('span', { cls: 'td-n', text: it.n ? String(it.n) : '!' }), h('span', { cls: 'td-t' }, [h('b', { text: it.text }), it.sub ? h('small', { text: it.sub }) : null]), h('span', { cls: 'td-go', text: '›', 'aria-hidden': 'true' })])));
  return box;
}

// ===== タブ（上段：まとまり／下段：その中の画面）と、どこからでも使える生徒検索 =====
export function nav(ctx, items) {
  const A = ctx.A, cur = groupOf(A.tab), badge = k => items.filter(i => i.group === k).reduce((a, i) => a + (i.n || 1), 0);
  const top = h('div', { cls: 'adm-top' }), gs = h('div', { cls: 'adm-groups', role: 'tablist' });
  GROUPS.forEach(g => {
    const n = g.k === cur.k ? 0 : badge(g.k);
    gs.appendChild(h('button', { cls: 'adm-tab' + (g.k === cur.k ? ' on' : ''), 'data-group': g.k, role: 'tab', 'aria-selected': g.k === cur.k ? 'true' : 'false', title: g.n, onclick: () => ctx.go((A.last && A.last[g.k] && groupTabs(g).includes(A.last[g.k])) ? A.last[g.k] : groupTabs(g)[0]) }, [h('span', { cls: 'at-ico', 'aria-hidden': 'true' }, [iconNode(g.ico, 20)]), h('span', { cls: 'at-t', text: g.n }), n ? h('i', { cls: 'at-n', text: n > 9 ? '9+' : String(n) }) : null]));
  });
  top.appendChild(gs); top.appendChild(finder(ctx));
  const wrap = h('div', { cls: 'adm-nav' }, [top]), subs = groupTabs(cur);
  if (subs.length > 1) {
    const row = h('div', { cls: 'adm-subs', role: 'tablist' });
    subs.forEach(t => { const n = items.filter(i => i.tab === t).reduce((a, i) => a + (i.n || 1), 0); row.appendChild(h('button', { cls: 'adm-sub' + (A.tab === t ? ' on' : ''), 'data-tab': t, role: 'tab', 'aria-selected': A.tab === t ? 'true' : 'false', onclick: () => ctx.go(t) }, [h('span', { text: TAB_NAMES[t] }), n && A.tab !== t ? h('i', { cls: 'at-n', text: n > 9 ? '9+' : String(n) }) : null])); });
    wrap.appendChild(row);
  }
  return wrap;
}

// かな・全角半角・大文字小文字・空白のちがいを無視して探す（ひらがなで打ってもカタカナのかなに当たる）
const norm = t => String(t || '').normalize('NFKC').replace(/[\s　]+/g, '').toLowerCase().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
export function findPeople(ctx, q) {
  const k = norm(q); if (!k) return [];
  const S0 = ctx.S(), out = [], linked = new Set(S0.students.map(s => s.link).filter(Boolean));
  const tn = id => { const t = id && S0.teams.find(x => x.id === id); return t ? t.name : ''; };
  const score = hay => { let best = 9; hay.forEach(([x, w]) => { const v = norm(x); if (!v) return; const i = v.indexOf(k); if (i >= 0) best = Math.min(best, v.startsWith(k) ? w : w + 3); }); return best; };
  S0.students.forEach(s => { const t = ctx.teamOf(s.uid), r = score([[s.nick, 0], [s.name, 0], [s.kana, 1], [t ? t.name : '', 2], [s.id, 2]]); if (r < 9) out.push({ s, rank: r, team: t ? t.name : '' }); });
  if (SV.on) SV.rows.filter(r => !linked.has(r.uid)).forEach(r => { const rk = score([[r.nick, 0], [tn(r.teamId), 2]]); if (rk < 9) out.push({ r, rank: rk, team: tn(r.teamId) }); });
  return out.sort((a, b) => a.rank - b.rank).slice(0, 8);
}
let outsideBound = false;
function finder(ctx) {
  const A = ctx.A, inp = h('input', { type: 'search', cls: 'fd-in', placeholder: '生徒をさがす', title: '名前・ニックネーム・チーミ名でさがせます（Ctrl+F）', 'aria-label': '生徒をさがす（名前・ニックネーム・チーミ名）', autocomplete: 'off', spellcheck: 'false', 'data-search': '1', maxlength: '30' });
  const panel = h('div', { cls: 'fd-panel', hidden: '' }), box = h('div', { cls: 'adm-find' }, [h('span', { cls: 'fd-ico', 'aria-hidden': 'true' }, [iconNode('search', 18)]), inp, panel]);
  let list = [], at = 0;
  const open = i => { const it = list[i]; if (!it) return; panel.hidden = true; inp.value = ''; inp.blur(); studentCard(ctx, it.s ? { uid: it.s.uid } : { me: it.r.uid }); };
  const mark = () => [...panel.querySelectorAll('.fd-item')].forEach((b, i) => { b.classList.toggle('on', i === at); if (i === at) b.scrollIntoView({ block: 'nearest' }); });
  const draw = () => {
    list = findPeople(ctx, inp.value); at = 0; panel.innerHTML = '';
    if (!inp.value.trim()) { panel.hidden = true; return; }
    panel.hidden = false;
    if (!list.length) { panel.appendChild(h('div', { cls: 'fd-none', text: '見つかりません' })); return; }
    list.forEach((it, i) => {
      const s = it.s, r = it.r || (s && s.link ? SV.rows.find(x => x.uid === s.link) : null), nick = (s ? s.nick : r.nick) || '';
      const sub = [s ? s.name : '（名簿の人にまだ結べていません）', it.team || 'チーミなし'].join(' ／ ');
      panel.appendChild(h('button', { cls: 'fd-item' + (i === 0 ? ' on' : ''), type: 'button', onmousedown: e => e.preventDefault(), onclick: () => open(i) }, [
        r && r.me ? faceImg(r.me, 'face', 'mini') : h('span', { cls: 'mini none' }), h('span', { cls: 'fd-t' }, [h('b', { text: (s && s.staff ? '★' : '') + (nick || (s ? s.name : 'まだ')) }), h('small', { text: sub })]),
        !s ? h('span', { cls: 'tag warn', text: '承認まち' }) : s.retired ? h('span', { cls: 'tag', text: '休止' }) : null]));
    });
  };
  inp.addEventListener('input', draw); inp.addEventListener('focus', () => { if (inp.value.trim()) draw(); });
  inp.addEventListener('keydown', e => {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (!list.length) return; e.preventDefault(); at = (at + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length; mark(); }
    else if (e.key === 'Enter') { if (list.length) { e.preventDefault(); e.stopPropagation(); open(at); } }
    else if (e.key === 'Escape') { inp.value = ''; panel.hidden = true; }
  });
  if (!outsideBound) { outsideBound = true; document.addEventListener('pointerdown', e => { document.querySelectorAll('.adm-find .fd-panel').forEach(p => { if (!p.parentNode.contains(e.target)) p.hidden = true; }); }, true); }
  return box;
}

// ===== 生徒カード：その人にしたいことを、1つの画面から =====
// ref：{ uid }＝名簿の人 ／ { me }＝名簿にまだ結べていない me-（承認まち）
export function studentCard(ctx, ref) {
  const A = ctx.A, body = h('div', { cls: 'sc' });
  const draw = () => {
    body.innerHTML = '';
    const s = ref.uid ? ctx.stu(ref.uid) : null, row = ref.me ? SV.rows.find(x => x.uid === ref.me) : (s && s.link ? SV.rows.find(x => x.uid === s.link) : null);
    if (!s && !row) { body.appendChild(h('p', { cls: 'hint', text: 'この人は見つかりません（消された可能性があります）' })); return; }
    const t = s ? ctx.teamOf(s.uid) : (row && row.teamId ? ctx.S().teams.find(x => x.id === row.teamId) : null), nick = (s ? s.nick : row && row.nick) || '';
    const ps = (SV.on && A.pinStatus && row && A.pinStatus[row.uid]) || {}, locked = !!ps.locked;
    const tags = [];
    if (s && s.staff) tags.push(['', '★担任助手']);
    if (SV.on) tags.push(s ? (s.link ? ['ok', 'ひもづけ済み'] : ['warn', 'me-まだ']) : ['warn', '承認まち']);
    if (s && s.retired) tags.push(['warn', '休止']);
    if (locked) tags.push(['ng', '番号ロック中']);
    body.appendChild(h('div', { cls: 'sc-head' }, [row && row.me ? faceImg(row.me, 'face', 'mini') : h('span', { cls: 'mini none' }), h('div', { cls: 'sc-who' }, [h('b', { text: s ? s.name : (nick || 'まだ') }), h('small', { text: [nick && s ? 'ニックネーム：' + nick : '', t ? t.name : 'チーミなし', s && s.grade ? s.grade : ''].filter(Boolean).join(' ／ ') })]), h('div', { cls: 'sc-tags' }, tags.map(([c, x]) => h('span', { cls: 'tag ' + c, text: x })))]));
    const acts = h('div', { cls: 'sc-acts' }), act = (ico, text, sub, on, cls, off) => acts.appendChild(h('button', { cls: 'sc-act ' + (cls || ''), disabled: off ? '' : null, onclick: on }, [h('span', { cls: 'sa-ico', 'aria-hidden': 'true' }, [iconNode(ico, 22)]), h('span', { cls: 'sa-t' }, [h('b', { text }), sub ? h('small', { text: sub }) : null])]));
    if (s) {
      act('home', 'チーミを移す', t ? '今は ' + t.name : 'いまは未所属', () => { closeModal(); ctx.assignDlg(s); });
      const canPico = !s.retired && (!SV.on || !!s.link);
      act('star', '特別ピコを配る', canPico ? 'この人だけに' : (s.retired ? '休止中です' : 'ひもづけが先です'), () => { closeModal(); ctx.openEvent(s.uid); }, '', !canPico);
      const pr = ctx.pinRow(s);
      if (SV.on && !s.link) { /* 番号は me- ができてから */ }
      else if (pr && pr.pin) act('key', '番号を忘れた', 'リセット／新しい番号', () => { closeModal(); ctx.forgotPin(pr); });
      else act('key', '番号はまだありません', '本人が決めます', () => { }, '', true);
      if (locked) act('unlock', 'ロックを解除', 'まちがいが続いたため', async () => { if (await ctx.rpcA('admin_unlock_pin', { p_uid: row.uid })) { toast('ロックを解除しました', 'ok'); await ctx.fetchPins(); draw(); } }, 'warn');
      if (SV.on && s.link) {
        act('moon', s.retired ? '休止から復帰' : '休止にする', s.retired ? '' : '退塾・休止（戻せます）', async () => { await retireDlg(ctx.ui(), { key: row.uid, nick, name: s.name, retired: !!s.retired }, s.name); ctx.paint(); studentCard(ctx, ref); });
        act('link', 'ひもづけをはずす', 'まちがえて選んだとき', () => { closeModal(); ctx.unlink(s); });
      }
    }
    if (acts.childNodes.length) body.appendChild(acts);
    if (SV.on && (!s || !s.link) && !(s && s.retired)) {   // 結ぶ相手：名簿の人 ⇔ 承認まちの me-
      const me = h('div', { cls: 'sc-link' });
      if (row && !s) {
        const un = ctx.S().students.filter(m => !m.link).sort((a, b) => ((ctx.teamOf(b.uid) || {}).id === row.teamId) - ((ctx.teamOf(a.uid) || {}).id === row.teamId));
        const sel = h('select', { 'aria-label': (nick || 'この me-') + 'は誰？' }); sel.appendChild(h('option', { value: '', text: '名簿の人を選ぶ…' })); un.forEach(m => sel.appendChild(h('option', { value: m.uid, text: m.name + (ctx.teamOf(m.uid) ? '（' + ctx.teamOf(m.uid).name + '）' : '') })));
        me.appendChild(h('b', { text: 'この me- は、名簿の誰ですか？' })); me.appendChild(h('div', { cls: 'sc-line' }, [sel, h('button', { cls: 'btn mint', text: 'ひもづけて承認', onclick: async () => { const m = ctx.stu(sel.value); if (!m) { toast('名簿の人を選んでね', 'ng'); return; } closeModal(); ctx.link(m, row); } })]));
        me.appendChild(h('button', { cls: 'btn sm', text: 'この me- を削除（まちがい・いたずら）', onclick: () => { closeModal(); ctx.removeMe(row); } }));
      } else if (s) {
        const pend = SV.rows.filter(r => !r.approved && !ctx.S().students.some(m => m.link === r.uid)).sort((a, b) => ((b.teamId === (t || {}).id) - (a.teamId === (t || {}).id)));
        me.appendChild(h('b', { text: 'この人の me- をひもづける' }));
        if (!pend.length) me.appendChild(h('p', { cls: 'hint', text: 'この人はまだ me- を作っていません（生徒が作ると、ここから結べます）' }));
        else {
          const sel = h('select', { 'aria-label': s.name + 'の me-' }); sel.appendChild(h('option', { value: '', text: '承認まちの me- を選ぶ…' })); pend.forEach(r => sel.appendChild(h('option', { value: r.uid, text: (r.nick || 'まだ') + (r.teamId ? '（' + ((ctx.S().teams.find(x => x.id === r.teamId) || {}).name || '') + '）' : '') })));
          me.appendChild(h('div', { cls: 'sc-line' }, [sel, h('button', { cls: 'btn mint', text: 'ひもづけて承認', onclick: () => { const r = SV.rows.find(x => x.uid === sel.value); if (!r) { toast('me- を選んでね', 'ng'); return; } closeModal(); ctx.link(s, r); } })]));
        }
      }
      body.appendChild(me);
    }
  };
  draw();
  modal(ref.uid ? '生徒カード' : '承認まちの me-', body, [h('button', { cls: 'btn', text: 'とじる', onclick: closeModal })], 'wide sc-dlg');
  if (SV.on && !A.pinStatus) ctx.fetchPins().then(() => { if (body.isConnected) draw(); });
}
