// 生徒側の画面：チーミ選択・メンバー選択・ランキング・チーミ詳細（本名・名簿の番号は出さない。出すのは nick だけ）
import { $, h, fmt, modal, closeModal, openSheet, toast, emptyBox, loadingBox, HINTS, uiAnim, iconNode } from './ui.js?v=202611211556';
import { bootScene } from './loading.js?v=202611211556';
import { rankTeams } from './parse.js?v=202611211556';
import { faceImg, pinPad } from './meui.js?v=202611211556';
import { dayInfo, startText, NOTICE_KIND, shortDate, phaseOf, rangeText, todayStr } from './mission.js?v=202611211556';
import { nickOf } from './me.js?v=202611211556';
import { hasNewUpdates } from './updates.js?v=202611211556';
import { sugEntry, sugToggle, sugHome, sugShown, sugView, setSugView, sugSeg } from './meyasu.js?v=202611211556';
import { motionOK } from './guide.js?v=202611211556';
export const ctx = { staffOk: () => true, getS: null, enter: null, openAdmin: null, loadDemo: null, meId: null, teamAuth: null, myUid: null, createMe: null, canCreate: null, houseThumb: null, openSettings: null, warm: null, msPending: null };
const S = () => ctx.getS();
const HUES = [12, 28, 150, 190, 215, 265, 330, 45];
export const hue = id => { let x = 2166136261; for (const c of String(id)) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619) >>> 0; } return HUES[x % HUES.length]; };
export const confirmedTeams = () => S().teams.filter(t => t.confirmed);
export const rankInfo = () => { const m = new Map(S().students.map(s => [s.uid, s.earned || 0])); return rankTeams(confirmedTeams(), id => m.get(id) || 0); };
const stuOf = uid => S().students.find(x => x.uid === uid);
const nickById = uid => nickOf(stuOf(uid));
let viewTeam = null;   // メンバー選択中のチーミID
// あいことばを入れて開いたチーミ。「‹ チーミ一覧」でもどると閉じる（家から出たときは同じチーミのまま＝次の人がすぐ選べる）
let unlocked = null;
export const showTeamMembers = id => { viewTeam = id; unlocked = id; };
async function openTeam(t) {
  if (unlocked === t.id) { viewTeam = t.id; renderSelect(); return; }
  if (ctx.teamAuth) {   // サーバー版：あいことばはサーバーで確かめる（通ったらこの端末が覚える）
    if (await ctx.teamAuth(t)) { unlocked = viewTeam = t.id; renderSelect(); }
    return;
  }
  for (let k = 0; k < 3; k++) {
    const v = await pinPad(t.name + 'のあいことば', k ? 'ちがいます。もう一度' : 'チーミのメンバーだけが知っている4けたの数字');
    if (v == null) return;
    if (v === t.code) { unlocked = viewTeam = t.id; renderSelect(); return; }
  }
  toast('あいことばが違います。担任助手に聞いてください', 'ng');
}
// ホームの背景の飾り（自前SVG。空→芝のグラデーションの上に、雲・丘・草・葉っぱ。利用者の文字は入れない）
const LEAF = (x, y, s, rot, c) => '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ') scale(' + s + ')"><path d="M0 0C-14-10-14-34 0-48 14-34 14-10 0 0Z" fill="' + c + '"/><path d="M0 0V-40" stroke="#fff" stroke-opacity=".55" stroke-width="2" fill="none"/></g>';
const CLOUD = (x, y, s) => '<g class="dk-cloud" transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path d="M0 30C-24 30-24 4 0 4 2-18 36-24 48-6 74-12 92 10 82 30Z" fill="#fff" opacity=".92"/></g>';
const TUFT = (x, y, c) => '<g transform="translate(' + x + ' ' + y + ')" fill="' + c + '"><path d="M0 0C-2-14-8-20-12-24 -4-22 2-12 4 0Z"/><path d="M2 0C4-18 10-26 16-30 14-20 10-10 8 0Z"/></g>';
const DECO = '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMax slice" aria-hidden="true">'
  + CLOUD(90, 120, 1.3) + CLOUD(820, 70, 1.6) + CLOUD(560, 230, .9) + CLOUD(1020, 300, 1.1)
  + '<path d="M0 800V640C170 600 330 630 520 650S900 610 1200 640V800Z" fill="#c6e6a2"/>'
  + '<path d="M0 800V700C200 676 380 704 600 712S980 690 1200 706V800Z" fill="#aedb86"/>'
  + [[70, 720], [230, 760], [430, 744], [700, 770], [900, 738], [1100, 764]].map(([x, y]) => TUFT(x, y, '#8cc765')).join('')
  + [[150, 690, '#fff'], [520, 726, '#ffd98a'], [780, 700, '#f7a8a0'], [1040, 724, '#fff']].map(([x, y, c]) => '<g><circle cx="' + x + '" cy="' + y + '" r="5" fill="' + c + '"/><circle cx="' + x + '" cy="' + y + '" r="2" fill="#f5c542"/></g>').join('')
  + LEAF(40, 560, 1.2, -25, '#9bd47a') + LEAF(1160, 540, 1.4, 28, '#8ccc6c') + LEAF(1120, 600, 1, 60, '#b4e08e')
  + '</svg>';
function deco(root) { const d = h('div', { cls: 'sel-deco', 'aria-hidden': 'true' }); d.innerHTML = DECO; root.appendChild(d); }
// 読み込み中：ロゴ＋ゆっくり光るカードの骨組み（素の文字にしない）
export function renderLoading(msg) {
  const root = $('select'); root.innerHTML = ''; deco(root);
  root.appendChild(h('div', { cls: 'sel-head' }, [h('div', { cls: 'sel-logo' }, [h('img', { cls: 'logo-ico', src: 'assets/icon/icon-rounded.svg', alt: '' }), h('b', { text: '向上ハウス' })])]));
  const row = h('div', { cls: 'tc-row skel-row' }); [0, 1, 2].forEach(i => row.appendChild(h('div', { cls: 'tcard skel', style: '--hu:' + [28, 150, 215][i] }, [h('div', { cls: 'tc-thumb' }), h('div', { cls: 'tc-info' }, [h('div', { cls: 'sk-line w60' }), h('div', { cls: 'sk-line w80' }), h('div', { cls: 'sk-line w40' })])])));
  root.appendChild(bootScene(msg || 'つなぎ中', 'ヒント：' + HINTS[Math.floor(Math.random() * HINTS.length)]));
}
const tcFaces = (t) => {
  const box = h('div', { cls: 'tc-faces' }), ms = t.members.map(stuOf).filter(Boolean), show = ms.slice(0, 5);
  show.forEach(st => box.appendChild(st.me ? faceImg(st.me, 'face', 'tf') : h('span', { cls: 'tf none', text: '？' })));
  if (ms.length > show.length) box.appendChild(h('span', { cls: 'tf more', text: '+' + (ms.length - show.length) }));
  return box;
};
// ホームの歯車（家の中の歯車と同じ形。アップデート情報の赤い点も出る）
const GEAR = '<svg class="ic" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" d="M10.14 4.53L10.56 1.9L13.44 1.9L13.86 4.53L15.97 5.4L18.12 3.84L20.16 5.88L18.6 8.03L19.47 10.14L22.1 10.56L22.1 13.44L19.47 13.86L18.6 15.97L20.16 18.12L18.12 20.16L15.97 18.6L13.86 19.47L13.44 22.1L10.56 22.1L10.14 19.47L8.03 18.6L5.88 20.16L3.84 18.12L5.4 15.97L4.53 13.86L1.9 13.44L1.9 10.56L4.53 10.14L5.4 8.03L3.84 5.88L5.88 3.84L8.03 5.4Z M12 8.6a3.4 3.4 0 1 0 0 6.8a3.4 3.4 0 1 0 0-6.8Z"/></svg>';
function gearBtn() { const b = h('button', { cls: 'btn sm sel-gear' + (hasNewUpdates() ? ' has-new' : ''), title: '設定', 'aria-label': '設定', onclick: () => { if (ctx.openSettings) ctx.openSettings(); } }); b.innerHTML = GEAR; return b; }
const PIN_KEY = 'kojoHouse.pinTeam';
const pinTeam = () => { try { return localStorage.getItem(PIN_KEY) || ''; } catch (e) { return ''; } };
const setPinTeam = id => { try { if (id) localStorage.setItem(PIN_KEY, id); else localStorage.removeItem(PIN_KEY); } catch (e) { } };
let lastView = -1;
export function renderSelect() {
  const root = $('select'); root.innerHTML = ''; deco(root);
  const teams = confirmedTeams(), ri = rankInfo(), rankOf = new Map(ri.list.map(r => [r.team.id, r.rank]));
  let vt = viewTeam && teams.find(t => t.id === viewTeam);
  if (viewTeam && !vt) viewTeam = null;
  if (!infoSeen) vt = null;   // ホーム（大事なお知らせ）を見る前は、覚えているチーミがあってもホームから
  root.appendChild(h('div', { cls: 'sel-head' }, [
    // 左上のロゴ＝ホーム（大事なお知らせ）にもどるボタン
    h('button', { cls: 'sel-logo home-link', title: 'ホームにもどる', 'aria-label': 'ホームにもどる', onclick: goHome }, [h('img', { cls: 'logo-ico', src: 'assets/icon/icon-rounded.svg', alt: '' }), h('b', { text: '向上ハウス' })]),
    vt ? h('button', { cls: 'btn sm', text: '‹ チーミ一覧', onclick: () => { viewTeam = unlocked = null; renderSelect(); } }) : null,
    vt ? h('span', { cls: 'sel-team', style: '--hu:' + hue(vt.id), text: vt.name }) : null,
    h('div', { cls: 'sel-sp' }),
    !vt && infoSeen && teams.length && ctx.canCreate && ctx.canCreate() ? h('button', { cls: 'btn coral sm sel-new', onclick: startCreate }, [h('span', { cls: 'sn-plus', text: '＋' }), h('span', { cls: 'sn-t', text: 'はじめての人：me-をつくる' })]) : null,
    // 更新：ページを読み込み直して、最新の情報でオープニングから（担任助手が入れた得点・お知らせなどをすぐ見たいとき）
    h('button', { cls: 'btn sm sel-reload', title: '最新の情報に更新して、はじめの画面にもどる', 'aria-label': '最新の情報に更新', onclick: () => location.reload() }, [h('span', { cls: 'rl-ico', text: '↻' }), h('span', { text: '更新' })]),
    teams.length ? h('button', { cls: 'btn sm', text: 'ランキング', onclick: () => openRanking() }) : null,
    ctx.staffOk() ? h('button', { cls: 'btn sm', text: '担任助手', onclick: () => ctx.openAdmin() }) : null,
    gearBtn()
  ]));
  const body = h('div', { cls: 'sel-body' }); root.appendChild(body);
  // 面が変わったときだけ（ホーム→チーミ選択→メンバー選択）、新しい面を少しスライドさせてフェードイン。もどるときは逆向き
  { const vk = !infoSeen ? 0 : vt ? 2 : 1; if (lastView >= 0 && vk !== lastView && uiAnim()) body.classList.add(vk > lastView ? 'sel-fwd' : 'sel-back'); lastView = vk; }
  if (!infoSeen) { infoView(body); if (ctx.warm) ctx.warm(); return; }   // まず全員が「ホーム（大事なお知らせ）」を見てから、チーミ選択へ
  if (!teams.length) {
    body.appendChild(h('div', { cls: 'sel-empty' }, [
      h('div', { cls: 'se-art', 'aria-hidden': 'true' }, [h('span', { cls: 'se-house' }, [iconNode('home', 76)]), h('span', { cls: 'se-spark s1' }, [iconNode('sparkle', 30)]), h('span', { cls: 'se-spark s2' }, [iconNode('star', 26)])]),
      h('div', { cls: 'big', text: 'まだ家がありません' }),
      h('p', { cls: 'sel-note', text: '担任助手がチーミを作ると、ここに家がならびます' }),
      h('div', { cls: 'sel-acts' }, [ctx.staffOk() ? h('button', { cls: 'btn mint', text: '担任助手モードへ', onclick: () => ctx.openAdmin() }) : null, ctx.loadDemo ? h('button', { cls: 'btn', text: 'お試しデータで遊ぶ', onclick: () => ctx.loadDemo() }) : null]),
      ctx.loadDemo ? h('p', { cls: 'sel-note', text: 'お試し：4つのチーミ・20人のサンプルが入ります（あとで担任助手モードの設定から全リセットできます）' }) : null]));
    return;
  }
  if (vt) { membersView(body, vt); return; }
  body.appendChild(infoStrip());
  const bar = h('div', { cls: 'sel-bar' }); body.appendChild(bar);
  bar.appendChild(h('div', { cls: 'sel-lead', text: 'チーミをえらぼう' }));
  const row = h('div', { cls: 'tc-row n' + Math.min(teams.length, 4) }); body.appendChild(row);
  // ピン止め：えらんだチーミ1つを一番左上に（この端末だけが覚える。ほかは今までどおりの順）
  const pinned = teams.some(t => t.id === pinTeam()) ? pinTeam() : '';
  const order = pinned ? [teams.find(t => t.id === pinned), ...teams.filter(t => t.id !== pinned)] : teams;
  order.forEach(t => {
    const hu = hue(t.id), r = rankOf.get(t.id), info = ri.list.find(x => x.team === t), on = t.id === pinned;
    // ほかのチーミの家の中は見せない（家のサムネは出さず、チーミの色の家マークだけ）
    const thumb = h('div', { cls: 'tc-thumb' }, [h('span', { cls: 'tc-ph' }, [iconNode('home', 40)])]);
    // カードがボタンなので、ピンはカードの中ではなく、包む枠の上に重ねる（ボタンの中にボタンを入れない）
    const cell = h('div', { cls: 'tc-cell' + (on ? ' pinned' : ''), style: '--hu:' + hu }); row.appendChild(cell);
    cell.appendChild(h('button', { cls: 'tc-pin' + (on ? ' on' : ''), title: on ? 'ピン止めをはずす' : '一番左上にピン止め', 'aria-label': (on ? 'ピン止めをはずす：' : '一番左上にピン止め：') + t.name, 'aria-pressed': on ? 'true' : 'false', onclick: () => {
      setPinTeam(on ? '' : t.id); renderSelect();
      toast(on ? 'ピン止めをはずしました' : '「' + t.name + '」を一番左上にピン止めしました', 'ok');
    } }, [h('span', { cls: 'tp-ico', 'aria-hidden': 'true' }, [iconNode('pin', 18)])]));
    cell.insertBefore(h('button', { cls: 'tcard', style: '--hu:' + hu, onclick: () => openTeam(t) }, [
      h('div', { cls: 'tc-thumb-wrap' }, [thumb, h('span', { cls: 'tc-rank r' + (r <= 3 ? r : 0), text: r + '位', ico: r === 1 ? 'crown' : null, icoSize: 14 }), h('span', { cls: 'tc-n', text: t.members.length + '人' })]),
      h('div', { cls: 'tc-info' }, [
        h('div', { cls: 'tc-name', text: t.name }),
        tcFaces(t),
        h('div', { cls: 'tc-pico' }, [h('span', { cls: 'coin sm' }), h('b', { text: fmt(info ? info.per : 0) }), h('i', { text: 'ピコ/1人' })])
      ])
    ]), cell.firstChild);
  });
  if (teams.length < 3) row.appendChild(h('div', { cls: 'tcard ghost', 'aria-hidden': 'true' }, [h('span', { cls: 'tg-ico' }, [iconNode('home', 28)]), h('span', { cls: 'tg-t', text: '次のチーミを準備中' })]));
}
// ===== 大事なお知らせ（チーミ選択の前に、全員が見る）：ゲームの日数・校舎の掲示板 =====
let infoSeen = false;
export const setInfoSeen = v => { infoSeen = !!v; };
// 「ゲームを始める」の近道（main.js の quickEnter）から：入れたとき／確かめに失敗したとき。画面は幕の下で変える
ctx.markUnlocked = id => { infoSeen = true; unlocked = viewTeam = id; };
ctx.quickFail = id => { unlocked = null; infoSeen = true; viewTeam = id; renderSelect(); };
function noticeList(L) {
  const box = h('div', { cls: 'nt-list' });
  if (!L.length) box.appendChild(h('div', { cls: 'nt-empty', text: 'お知らせはありません' }));
  L.forEach(n => box.appendChild(h('div', { cls: 'nt-item k-' + n.kind }, [
    h('div', { cls: 'nt-hd' }, [n.at && Date.now() - n.at < 3 * 86400000 ? h('span', { cls: 'nt-new', text: 'NEW' }) : null, h('span', { cls: 'tag ' + NOTICE_KIND[n.kind][1], text: NOTICE_KIND[n.kind][0] }), h('b', { text: n.title }), n.date ? h('span', { cls: 'nt-date', text: shortDate(n.date), ico: 'calendar', icoSize: 14 }) : null]),
    n.body ? h('div', { cls: 'nt-body', text: n.body }) : null
  ])));
  return box;
}
// ホーム：左上のロゴからいつでももどれる
export function goHome() { infoSeen = false; viewTeam = unlocked = null; renderSelect(); }
// ホームの上の帯：昼の町（絵は固定のSVG。利用者の文字は入れない）
const HERO_ART = '<svg class="hh-art" viewBox="0 0 1200 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true">'
  + '<circle cx="1010" cy="58" r="34" fill="#fff6c9"/><circle cx="1010" cy="58" r="52" fill="#fff6c9" opacity=".35"/>'
  + '<g class="hh-clouds" fill="#fff" opacity=".9"><ellipse cx="180" cy="52" rx="54" ry="16"/><ellipse cx="214" cy="42" rx="34" ry="18"/><ellipse cx="640" cy="40" rx="44" ry="13"/><ellipse cx="668" cy="32" rx="26" ry="14"/><ellipse cx="860" cy="80" rx="36" ry="10"/></g>'
  + '<path d="M0 220V150C140 118 260 132 400 150S640 120 800 128 1060 160 1200 136V220Z" fill="#bfe6b8"/>'
  + '<path d="M0 220V176C180 158 330 172 520 180S860 160 1200 170V220Z" fill="#9fd39b"/>'
  + [[520, 136, 40, '#f7a8a0'], [600, 148, 30, '#a9c8f2'], [690, 140, 38, '#ffd98a'], [790, 132, 44, '#cdb4f0'], [880, 146, 32, '#a8e6cf']].map(([x, y, w, c]) =>
    '<g><rect x="' + (x - w / 2) + '" y="' + y + '" width="' + w + '" height="' + (w * .72) + '" rx="3" fill="#fffaf0"/><path d="M' + (x - w / 2 - 6) + ' ' + (y + 2) + 'L' + x + ' ' + (y - w * .55) + 'L' + (x + w / 2 + 6) + ' ' + (y + 2) + 'Z" fill="' + c + '"/><rect x="' + (x - w * .12) + '" y="' + (y + w * .32) + '" width="' + (w * .24) + '" height="' + (w * .4) + '" rx="2" fill="#c98f62"/><rect x="' + (x + w * .18) + '" y="' + (y + w * .12) + '" width="' + (w * .16) + '" height="' + (w * .16) + '" rx="2" fill="#a9dcf5"/></g>').join('')
  + LEAF(1100, 212, .7, 20, '#7fc16a')
  + '<g fill="#6fb36a"><circle cx="470" cy="166" r="14"/><circle cx="486" cy="160" r="11"/><circle cx="830" cy="168" r="13"/><circle cx="950" cy="162" r="12"/></g>'
  + '</svg>';
const WD = '日月火水木金土';
// ホームのあいさつの下：みんなを元気づける・応援するひとこと（開くたびにランダム）
const CHEERS = ['今日もここに来たあなたは、それだけで一歩前進！', 'コツコツの1コマが、いちばんの近道', 'きのうの自分より、ちょっとだけ先へ', 'つかれたら少し休んで、また進もう', 'チーミのみんながついてるよ', 'できた！をひとつずつ増やしていこう', 'あなたのがんばり、ちゃんと見てるよ', '小さな積み重ねが、大きな力になる', '今日の一問が、未来の自信になる', '苦手は、伸びしろ！', '昨日できなかったことが、今日できるかも', 'あせらず、あきらめず、いっしょにいこう', '集中した時間は、ぜったいウソをつかない', 'ここまで来たあなたは、すごい', 'ナイスファイト！今日もいこう', '深呼吸して、まずは1問から', 'みんなでがんばれば、家も夢も大きくなる', '完璧じゃなくていい。続けることがいちばん', '一歩ずつでも、前に進んでいれば大丈夫', '今日のがんばりが、チーミのみんなの力になる'];
const cheer = () => CHEERS[Math.floor(Math.random() * CHEERS.length)];
function greet() {
  const d = new Date(), hr = d.getHours();
  return { hi: hr >= 4 && hr < 11 ? 'おはよう' : hr >= 11 && hr < 18 ? 'こんにちは' : 'こんばんは', date: (d.getMonth() + 1) + '月' + d.getDate() + '日(' + WD[d.getDay()] + ')' };
}
// 今週のミッション（ゲームを始める前なので、中身だけ。達成の人数はお家の中で）
function missionTeaser() {
  const today = todayStr(), L = (S().missions || []).filter(m => phaseOf(m, today) !== 'over').sort((a, b) => a.start.localeCompare(b.start));
  const m = L.find(x => phaseOf(x, today) === 'now') || L[0], pend = !m && !!ctx.msPending && ctx.msPending();   // まだ読んでいないあいだは「お待ちください」と言わず、光が流れる枠
  if (pend) return h('div', { cls: 'hm-card hm-ms' }, [h('div', { cls: 'hm-k' }, [h('span', { cls: 'hm-ico' }, [iconNode('target', 20)]), h('b', { text: '今週のミッション' })]), h('div', { cls: 'hm-ms-t sk-b', text: 'ミッションを読み込み中' }), h('div', { cls: 'hm-ms-s sk-b', text: '0000-00-00 〜 0000-00-00' })]);
  return h('div', { cls: 'hm-card hm-ms' }, [
    h('div', { cls: 'hm-k' }, [h('span', { cls: 'hm-ico' }, [iconNode('target', 20)]), h('b', { text: '今週のミッション' }), m ? h('span', { cls: 'tag ' + (phaseOf(m, today) === 'now' ? 'ok' : ''), text: phaseOf(m, today) === 'now' ? '実施中' : 'これから' }) : null]),
    m ? h('div', { cls: 'hm-ms-t', text: m.title }) : h('div', { cls: 'hm-none', text: '次のミッションをお待ちください' }),
    m ? h('div', { cls: 'hm-ms-s' }, [h('span', { text: rangeText(m) }), m.picos ? h('span', { cls: 'hm-rew' }, [h('span', { cls: 'coin sm' }), h('b', { text: fmt(m.picos) }), h('i', { text: 'ピコ' })]) : null]) : null
  ]);
}
// チーミの順位（上位3つ。チーミ単位だけ）
function rankMini() {
  const ri = rankInfo(); if (!ri.list.length) return null;
  return h('button', { cls: 'hm-card hm-rk', onclick: () => openRanking() }, [
    h('div', { cls: 'hm-k' }, [h('span', { cls: 'hm-ico' }, [iconNode('trophy', 20)]), h('b', { text: 'チーミの順位' }), h('span', { cls: 'hm-more', text: 'ぜんぶ見る ›' })]),
    h('div', { cls: 'hm-rk-l' }, ri.list.slice(0, 3).map(r => h('div', { cls: 'hm-rk-r', style: '--hu:' + hue(r.team.id) }, [h('span', { cls: 'medal m' + r.rank, text: String(r.rank) }), h('span', { cls: 'hm-rk-n', text: r.team.name }), h('b', { text: fmt(r.per) }), h('i', { text: 'ピコ/1人' })])))
  ]);
}
// みんなの記録：全員で集めたピコ・参加している me- の数・チーミの数（ひとりひとりの数字は出さない）
function homeStats() {
  const st = S().students.filter(s => !s.staff && !s.retired), total = st.reduce((a, s) => a + (s.earned || 0), 0), n = st.filter(s => s.me).length, nt = confirmedTeams().length;
  if (!n && !nt) return null;
  const tile = (ico, k, v, u) => h('div', { cls: 'hs-tile' }, [h('span', { cls: 'hs-ico' }, [iconNode(ico, 20)]), h('span', { cls: 'hs-t' }, [h('i', { text: k }), h('b', {}, [h('span', { text: v }), h('small', { text: u })])])]);
  return h('div', { cls: 'home-stats-row' }, [tile('coin', 'みんなで集めたピコ', fmt(total), 'ピコ'), tile('hand', '参加している me-', String(n), '人'), tile('home', 'チーミの数', String(nt), 'つ')]);
}
// 「ゲームを始める」：この端末が覚えている自分の me-（確定したチーミのメンバー）がいれば、そのまま家へ。いなければチーミ選択
function rememberedMe() {
  const u = ctx.myUid && ctx.myUid(); if (!u) return null;
  const st = stuOf(u); if (!st || st.staff || st.retired || !st.me) return null;
  const t = confirmedTeams().find(x => x.members.includes(u)); return t ? { st, t } : null;
}
function startButtons() {
  const goSelect = () => { infoSeen = true; viewTeam = null; renderSelect(); }, mm = rememberedMe();
  if (!mm) return h('button', { cls: 'btn coral info-go', onclick: goSelect }, [h('span', { text: 'ゲームを始める' }), h('span', { cls: 'arr', text: '→' })]);
  const { st, t } = mm;
  return h('div', { cls: 'info-start' }, [
    h('button', { cls: 'info-other', text: 'ほかの人・チーミをえらぶ', onclick: goSelect }),
    h('button', { cls: 'btn coral info-go', onclick: async () => {
      if (ctx.quickEnter && ctx.quickEnter(t.id, st.uid, unlocked === t.id)) return;   // 近道：押した瞬間に幕を動かし始める（メンバー画面の描き直しなどは挟まない。家の組み立ては幕がおおってから）
      infoSeen = true; renderSelect();   // 番号の入力などでやめたとき、そのチーミのメンバー画面に残る
      if (unlocked !== t.id && ctx.teamAuth && !await ctx.teamAuth(t)) { viewTeam = null; renderSelect(); return; }
      unlocked = viewTeam = t.id; renderSelect(); ctx.enter(t.id, st.uid);
    } }, [faceImg(st.me, 'face', 'ig-face'), h('span', { cls: 'ig-txt' }, [h('span', { text: 'ゲームを始める' }), h('small', { text: nickOf(st) })]), h('span', { cls: 'arr', text: '→' })])
  ]);
}
// 担任助手の隠し入口：「校舎のお知らせ」の板を長押し（約0.8秒・指を動かさない）→ 3秒以内に5回タップ → 担任助手モードの入口（パスワードの画面などは今までどおり）。
// 成功するまで見た目は変えない。長押しで出る右クリック・文字選択・iOSのメニューは止める（中の文字は読めるまま）。スクロールで指が動いたら取り消す。
function secretEntry(el) {
  let timer = 0, press = null, armedUntil = 0, taps = 0, longDone = false;
  const off = () => { clearTimeout(timer); timer = 0; };
  el.style.userSelect = 'none'; el.style.webkitUserSelect = 'none'; el.style.webkitTouchCallout = 'none';
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', e => {
    if (e.button > 0 || e.isPrimary === false) return;
    press = { x: e.clientX, y: e.clientY }; longDone = false; off();
    if (armedUntil && Date.now() > armedUntil) { armedUntil = 0; taps = 0; }
    if (!armedUntil) timer = setTimeout(() => { timer = 0; if (press && ctx.staffOk()) { longDone = true; } }, 800);
  });
  el.addEventListener('pointermove', e => { if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) { off(); press = null; longDone = false; } });
  el.addEventListener('pointercancel', () => { off(); press = null; longDone = false; });
  el.addEventListener('pointerup', () => {
    const ok = !!press; off(); press = null;
    if (longDone) { longDone = false; armedUntil = Date.now() + 3000; taps = 0; try { navigator.vibrate && navigator.vibrate(10); } catch (e) { } return; }
    if (!ok || !armedUntil) return;
    if (Date.now() > armedUntil) { armedUntil = 0; taps = 0; return; }
    if (++taps >= 5) { armedUntil = 0; taps = 0; if (ctx.staffOk()) ctx.openAdmin(); }
  });
  return el;
}
function infoView(body) {
  const L = S().notices || [], g = greet(), d = dayInfo(S().startDate);
  const hero = h('div', { cls: 'home-hero' + (d.before ? ' before' : '') });
  hero.innerHTML = HERO_ART;
  hero.appendChild(h('div', { cls: 'hh-txt' }, [h('div', { cls: 'hh-date', text: g.date }), h('div', { cls: 'hh-hi', text: g.hi }), h('div', { cls: 'hh-sub', text: cheer() })]));
  hero.appendChild(h('div', { cls: 'hh-day' }, d.before ? [
    h('div', { cls: 'dc-k', text: 'スタートまで' }), h('div', { cls: 'dc-n' }, [h('span', { cls: 'dc-a', text: 'あと' }), h('b', { text: String(d.left) }), h('span', { cls: 'dc-u', text: '日' })]), h('div', { cls: 'dc-s', text: startText(d.start) + ' スタート' })
  ] : [
    h('div', { cls: 'dc-k', text: '向上ハウス' }), h('div', { cls: 'dc-n' }, [h('b', { text: String(d.day) }), h('span', { cls: 'dc-u', text: '日目' })]), h('div', { cls: 'dc-s', text: startText(d.start) + ' スタートから' })
  ]));
  // 丘の上に、みんなの me- が数人（毎回ちがう人。ニックネームも本名も出さない）
  const withMe = S().students.filter(s => s.me && !s.staff && !s.retired), crowd = h('div', { cls: 'hh-crowd', 'aria-hidden': 'true' });
  withMe.slice().sort(() => Math.random() - .5).slice(0, 5).forEach((s, i) => { const im = faceImg(s.me, 'full', 'hh-me'); im.style.setProperty('--i', i); crowd.appendChild(im); });
  if (crowd.children.length) hero.appendChild(crowd);
  // 「校舎のお知らせ」の欄：目安箱の表示がオンなら、同じ場所で 掲示板 ⇄ 目安箱（くるっと裏返る）。10回タップでオン／オフ
  const ten = () => sugToggle(() => renderSelect());
  const flip = h('div', { cls: 'hm-flip' });
  const pick = v => flipTo(v);
  const mkBoard = () => sugEntry(secretEntry(h('div', { cls: 'board' }, [h('div', { cls: 'board-top' }, [h('div', { cls: 'board-hd' }, [h('span', { cls: 'board-pin' }, [iconNode('pin', 20)]), h('b', { text: '校舎のお知らせ' }), L.length ? h('span', { cls: 'board-n', text: L.length + '件' }) : null]), sugShown() && sugHome ? sugSeg('notice', pick) : null]), noticeList(L)])), ten);
  const mkBox = () => { const c = sugHome(() => renderSelect(), () => sugSeg('box', pick)); return c ? sugEntry(secretEntry(c), ten) : null; };
  const build = v => (v === 'box' && mkBox()) || mkBoard();
  let flipping = false;
  const flipTo = v => {
    if (flipping) return; setSugView(v);
    const old = flip.firstChild, nw = build(v);
    if (!old || !old.animate || !motionOK()) { flip.replaceChildren(nw); return; }
    flipping = true;
    // 90度（真横）で中身を入れ替える。animation の終わりが来ない（裏のタブなど）ときも、タイマーで必ず入れ替える
    let done = false;
    const swap = () => {
      if (done) return; done = true; flip.replaceChildren(nw); flipping = false;
      nw.animate([{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(0deg)' }], { duration: 180, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' });
    };
    try { old.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(90deg)' }], { duration: 180, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' }).finished.then(swap, swap); } catch (e) { swap(); }
    setTimeout(swap, 260);
  };
  flip.appendChild(build(sugShown() ? sugView() : 'notice'));
  body.appendChild(h('div', { cls: 'info-page home' }, [
    hero, homeStats(),
    h('div', { cls: 'hm-grid' }, [
      flip,
      h('div', { cls: 'home-side' }, [missionTeaser(), rankMini()])
    ]),
    startButtons()
  ]));
}
// チーミ選択の上に、小さく（押すと大事なお知らせにもどる）
function infoStrip() {
  const d = dayInfo(S().startDate), L = S().notices || [], top = L[0];
  return h('button', { cls: 'info-strip', onclick: () => { infoSeen = false; renderSelect(); } }, [
    h('span', { cls: 'is-day', text: d.before ? 'スタートまで あと' + d.left + '日' : d.day + '日目' }),
    h('span', { cls: 'is-nt', text: top ? top.title : '校舎のお知らせ', ico: 'pin', icoSize: 16 }),
    h('span', { cls: 'is-more', text: 'お知らせを見る' })
  ]);
}
// ホームの「＋ はじめての人：me-をつくる」：me-作成（ニックネーム→見た目→番号）→ チーミをえらぶ →（あいことば）→ そのまま家に入る
// （チーミを先に決めず、me- を自由に作ってから、担任助手が用意したチーミの中から選ぶ。teamId を渡さない createMe がこの流れ）
function startCreate() { if (confirmedTeams().length) ctx.createMe(null); }
// 作ったあとの「チーミをえらぶ」：押したチーミ（あいことばを通ったもの）の id を返す。「もどる」「やめる」は null
export function chooseTeam(m, nick) {
  return new Promise(res => {
    const show = () => {
      const teams = confirmedTeams(), body = h('div', { cls: 'tp' });
      body.appendChild(h('div', { cls: 'tp-who' }, [faceImg(m, 'face', 'face'), h('span', { cls: 'tp-q' }, [h('b', { text: nick }), h('span', { text: 'さんのチーミは？' })])]));
      const list = h('div', { cls: 'picklist tp-list' }); body.appendChild(list);
      if (!teams.length) list.appendChild(emptyBox('hand', '選べるチーミがありません', '担任助手に聞いてください'));
      teams.forEach(t => list.appendChild(h('button', { cls: 'btn pickbtn', style: '--hu:' + hue(t.id), onclick: async () => {
        closeModal();
        if (unlocked !== t.id && ctx.teamAuth && !await ctx.teamAuth(t)) { show(); return; }   // あいことばが通らなければ、チーミ選択にもどる（me-はそのまま）
        unlocked = viewTeam = t.id; res(t.id);
      } }, [h('span', { cls: 'a', text: t.name }), h('span', { cls: 'b', text: t.members.length + '人' })])));
      modal('チーミをえらぼう', body, [h('button', { cls: 'btn', text: 'もどる', onclick: () => { closeModal(); res(null); } })]);
    };
    show();
  });
}
// 自分のme-を押して入る
function membersView(body, t) {
  body.appendChild(h('div', { cls: 'sel-lead', text: '自分を選ぶ' }));
  const grid = h('div', { cls: 'mem-grid', style: '--hu:' + hue(t.id) }); body.appendChild(grid);
  const mine = ctx.myUid && ctx.myUid(), list = t.members.map(stuOf).filter(Boolean).sort((a, b) => (b.uid === mine) - (a.uid === mine));
  list.forEach(st => {
    const face = st.me ? faceImg(st.me, 'face', 'face') : h('div', { cls: 'face none', text: '？' });
    // 担任助手の me- は、金色のふちと「担任助手」の札でひと目でわかるように
    grid.appendChild(h('button', { cls: 'mem' + (st.me ? '' : ' new') + (st.uid === mine ? ' mine' : '') + (st.staff ? ' staff' : ''), onclick: () => ctx.enter(t.id, st.uid) }, [st.staff ? h('span', { cls: 'mem-badge', text: '★担任助手' }) : null, face, h('span', { cls: 'mn', text: nickOf(st) }), h('span', { cls: 'ms', text: st.uid === mine ? 'あなた' : st.me ? (st.pin ? '' : 'ばんごうを決める') : 'me-をつくる' })]));
  });
  if (ctx.canCreate && ctx.canCreate()) grid.appendChild(h('button', { cls: 'mem add', onclick: () => ctx.createMe(t.id) }, [h('span', { cls: 'face plus', text: '＋' }), h('span', { cls: 'mn', text: 'me-を作る' }), h('span', { cls: 'ms', text: 'はじめての人' })]));
  else if (!list.length) grid.appendChild(emptyBox('hand', 'メンバーがいません', '担任助手がチーミに入れてくれます'));
}
// ===== ランキング：チーミ単位だけ =====
// 個人のランキング・メンバー別の得点は出さない（だれでも見られる画面に、ひとりひとりの成績を出さないため）
export function openRanking() {
  openSheet('ランキング', (body) => teamRank(body));
}
function teamRank(body) {
  const ri = rankInfo();
  if (!ri.list.length) { body.appendChild(emptyBox('trophy', 'まだチーミがありません', 'チーミができると順位が出ます')); return; }
  body.appendChild(h('div', { cls: 'rk-note', text: '1人あたりのピコ（メンバーが集めたピコの合計 ÷ 人数）でくらべています' }));
  const mt = ctx.myTeam && ctx.myTeam(), mi = mt ? ri.list.findIndex(r => r.team.id === mt) : -1;
  if (mi >= 0) {   // 自分のチーミ：1つ上まで あと○（1人あたり）
    const r = ri.list[mi], up = ri.list.slice(0, mi).reverse().find(x => x.per > r.per);
    body.appendChild(h('div', { cls: 'rk-me' }, [h('b', { text: r.team.name + '：' + r.rank + '位' }), h('span', { text: up ? '1つ上の ' + up.team.name + ' まで あと ' + fmt(Math.ceil(up.per - r.per)) + '（1人あたり）' : '1位です。この調子で' })]));
  }
  const max = Math.max(1, ...ri.list.map(r => r.score));
  const list = h('div', { cls: 'rk-list' }); body.appendChild(list);
  list.appendChild(h('div', { cls: 'rk-row rk-h' }, [h('span', { cls: 'c-r', text: '順位' }), h('span', { cls: 'c-n', text: 'チーミ' }), h('span', { cls: 'c-m', text: '人数' }), h('span', { cls: 'c-p', text: '合計' }), h('span', { cls: 'c-s', text: '1人あたり' }), h('span', { cls: 'c-g', text: '差' })]));
  ri.list.forEach(r => {
    const t = r.team, medal = r.rank <= 3 ? ' m' + r.rank : '';
    list.appendChild(h('div', { cls: 'rk-row', style: '--hu:' + hue(t.id) + ';--w:' + (r.score / max * 100).toFixed(1) + '%' }, [
      h('span', { cls: 'c-r' }, [h('span', { cls: 'medal' + medal, text: String(r.rank) })]),
      h('span', { cls: 'c-n', text: t.name }), h('span', { cls: 'c-m', text: r.count + '人' }),
      h('span', { cls: 'c-p', text: fmt(r.total) }), h('span', { cls: 'c-s' }, [h('b', { text: fmt(r.per) })]),
      h('span', { cls: 'c-g', text: r.rank === 1 && r.gap === 0 ? (ri.list.filter(x => x.rank === 1).length > 1 ? '同点' : 'トップ') : r.gap === 0 ? '同点' : '-' + fmt(r.gap) })
    ]));
  });
  body.appendChild(h('div', { cls: 'rk-note', text: 'ランキングはチーミ単位だけ。ひとりひとりの得点は表示しません' }));
}
// ===== チーミ詳細 =====
// ふつうはチーミ全体の数字だけ。メンバー別の集めたピコは担任助手モードの中（admin=true）だけで表示する
export function teamDetailDlg(t, admin) {
  const body = h('div'), mem = t.members.map(stuOf).filter(Boolean), total = mem.reduce((a, s) => a + (s.earned || 0), 0);
  body.appendChild(h('div', { cls: 'td-sum' }, [
    h('div', {}, [h('i', { text: '貯金箱' }), h('b', { text: fmt(t.picos) + ' ピコ' })]),
    h('div', {}, [h('i', { text: '1人あたり' }), h('b', { text: fmt(total / Math.max(1, mem.length)) + ' ピコ' })]),
    h('div', {}, [h('i', { text: '人数' }), h('b', { text: mem.length + '人' })])
  ]));
  if (admin) {
    body.appendChild(h('div', { cls: 'sec', text: 'メンバー別の集めたピコ（担任助手だけに表示）' }));
    const rows = mem.map(s => ({ s, v: s.earned || 0 })).sort((a, b) => b.v - a.v);
    const max = Math.max(1, ...rows.map(r => r.v)), box = h('div', { cls: 'td-list' });
    if (!rows.length) box.appendChild(emptyBox('hand', 'メンバーがいません'));
    rows.forEach((r, i) => box.appendChild(h('div', { cls: 'td-row' + (r.v ? '' : ' zero') }, [
      h('span', { cls: 'td-rk', text: String(i + 1) }), h('span', { cls: 'td-nm', text: r.s.name + (r.s.nick ? '（' + r.s.nick + '）' : '') }),
      h('span', { cls: 'td-bar' }, [h('i', { style: 'width:' + (r.v / max * 100).toFixed(1) + '%' })]),
      h('span', { cls: 'td-v', text: fmt(r.v) }), h('span', { cls: 'td-pc', text: total ? Math.round(r.v / total * 100) + '%' : '-' })
    ])));
    body.appendChild(box);
  }
  modal(t.name, body, [h('button', { cls: 'btn', text: 'とじる', onclick: closeModal })], admin ? 'wide' : undefined);
}
