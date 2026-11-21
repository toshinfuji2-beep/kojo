// 向上ハウス 3D版：チーミ（班）で1つの家を作る。ピコは個人の財布、チーミは貯金箱。ゲームロジック＋three.js 描画
import { fitCalc } from './fit.js?v=202611211556';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { yardGrid, groundY } from './yard.js?v=202611211556';
import { createRealtime, rtPref, rtSetPref } from './realtime.js?v=202611211556';
import { outYard, outHouse, outSetViewerOut } from './outside.js?v=202611211556';
import { CFG, CATS, ITEMS, ITEM, entranceOf, entryPoint, layoutCost, layoutCheck, itemsFit, houseBox, roomAt, wallGaps, wallAllOuter, wallPlan, pairKey, edgesOf, LAYOUT_ERR, migrateRooms, LTD_ITEMS } from './data.js?v=202611211556';
import { TRIAL, mainRendered, GPU, prepareGpu, scheduleTrial, runTrial, isWebKit, getPref, setPref, readRec, judge, gpuFail, gpuKey } from './scenegpu.js?v=202611211556';
import { outCover } from './outside.js?v=202611211556';
import { E, cam, WH, initScene, setQuality, qualityDefault, resize, resetCam, addYaw, orbit, setZoom, updateCamera, probeCam, renderFrame, perfTick, rayAt, project, setPointLights, flickerLights, buildHouse, showGrid, setCamMode, setNight, setCurtainDim, EYE, enterEye, exitEye, eyeFeed, eyeGrab, eyeLook, eyeRelease, eyeTurn, eyeZoom, eyeHidden, eyeBody, roofForce } from './scene.js?v=202611211556';
import { buildItem, fallbackIds } from './models.js?v=202611211556';
import { swatchCanvas, TEXK } from './textures.js?v=202611211556';
import { M, MF, G, box, rbox, sph, cyl, cone } from './mk.js?v=202611211556';
import * as store from './store.js?v=202611211556';
import { roofCovers, roofEvents, roofRise } from './roof.js?v=202611211556';   // 引いて屋根がかかっている間は、中をさわれない・名前の札も出さない
import { mergeRooms } from './housemerge.js?v=202611211556';
import { $, h, fmt, modal, closeModal, confirmDlg, toast, emptyBox, openSheet, uiAnim, iconNode, icoSvg } from './ui.js?v=202611211556';
import { veilRun, veilBusy, lastPress, sparkleBurst, vdur } from './transition.js?v=202611211556';
import { netWatch, withBusy, busyBtn, busyOverlay, onSaveRetry, saveFlash } from './loading.js?v=202611211556';
import { ctx as screenCtx, setInfoSeen, goHome, hue, chooseTeam, renderLoading, renderSelect, openRanking, teamDetailDlg, showTeamMembers } from './screens.js?v=202611211556';
import { buildMe, AV } from './avatar.js?v=202611211556';
import { seededMe, randomMe, nickOf, cleanMe, pinHash, checkPin, WEAR, ME_COUNT, PET_HOME_MIN, PET_HOME_NOTE } from './me.js?v=202611211556';
import { meThumb, meThumbInto, faceImg, pinPad, pinSet, openMeMaker, closeMeMaker } from './meui.js?v=202611211556';
import { planScores } from './parse.js?v=202611211556';
import { todayStr, phaseOf, localTeamStatus, rangeText, condText } from './mission.js?v=202611211556';
import { dailyAdd, dailyUsed, dailyWarn, dailyStatus } from './daily.js?v=202611211556';
import { chooseOperator } from './admin2.js?v=202611211556';
import { initKeys, keyHelpDlg, hasKeyboard } from './keys.js?v=202611211556';
import { actx, openAdminGate, openAdmin, openQuickTeam, adminPreset, adminIdle } from './admin.js?v=202611211556';
import { openPlan } from './plan.js?v=202611211556';
import { coachSeen, setCoachSeen, startCoach, coachOpen, confetti, flyCoins, sparkleAt, bounceEl, motionOK, readSeen, writeSeen, gainBreakdown, welcomeBack, celebrate, unlimitedIntro } from './guide.js?v=202611211556';
import { MODE } from './mode.js?v=202611211556';
import { NET, SV, SvError, svInit, pull as svPull, rpc as svRpc, adminRpc, errText, subscribe as svSubscribe, getMyUid, setMyUid, admLoad, mergeAdmin, vaultRestore, vaultSoon, slotsSync, NEED_UPDATE, loadServerInfo, admSaveLocal, rememberedAdmin, forgetAdmin, schemaAtLeast } from './server.js?v=202611211556';
import { openStaffDesk } from './staffdesk.js?v=202611211556';
import { gachaDlg, GACHA_SCHEMA } from './gacha.js?v=202611211556';
import { suggestDlg, sugAvailable, POST_ICO } from './meyasu.js?v=202611211556';
import { openUpdates, hasNewUpdates } from './updates.js?v=202611211556';
import { takePhoto } from './photo.js?v=202611211556';
import * as PLAY from './play.js?v=202611211556';
import * as JOY from './joy.js?v=202611211556';
NET.watch = netWatch;   // サーバー待ちの表示（js/loading.js）
// iPhone 横向き：ノッチ（ダイナミックアイランド）がどちら側にあるかを <html> の class（notch-l / notch-r）で知らせる。
// iOS は左右どちらにも同じ safe-area をくれるが、ノッチのない側は角の丸みのぶんだけ空ければよい（style.css の --ci-l / --ci-r）
function markNotchSide() {
  const a = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (typeof window.orientation === 'number' ? (window.orientation + 360) % 360 : 0);
  const c = document.documentElement.classList;
  c.toggle('notch-l', a === 90); c.toggle('notch-r', a === 270);
}
markNotchSide();
// ページ全体がずれたままにならないように：キーボードが出入りしたあと・ゴム引きのあとは、いつも原点へ戻す
const pageHome = () => { const e = document.scrollingElement; if (window.scrollY || window.scrollX || (e && (e.scrollTop || e.scrollLeft))) window.scrollTo(0, 0); };
window.addEventListener('scroll', pageHome, { passive: true }); document.addEventListener('focusout', () => setTimeout(pageHome, 60));
if (window.visualViewport) { window.visualViewport.addEventListener('scroll', pageHome); window.visualViewport.addEventListener('resize', pageHome); }
if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', markNotchSide);
window.addEventListener('orientationchange', markNotchSide); window.addEventListener('resize', markNotchSide);
// 最初から横向きで開いたとき、ブラウザの上下のバーの出入りで 100dvh がずれて、下が切れて上に寄ることがある。
// 見えている高さ（visualViewport / innerHeight）を #app の高さにして、回転・全画面・リサイズのあと何度か測りなおす
// iPhone のホーム画面アプリ（PWA）：回転の途中で開くと、innerHeight・visualViewport が「回す前の向き」の高さのまま残り、
// そのあと resize も来ないことがある（横向きなのに縦の高さ → 下が切れる）。画面そのものの大きさ（screen。iPhone では縦向きの値で固定）と
// 今の向き（window.orientation / matchMedia）から「この向きで取りうる最大の高さ」を出し、測った高さがそれを超えたら上限にする
const standalone = () => !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
function landNow() {
  if (typeof window.orientation === 'number') return Math.abs(window.orientation) === 90;
  if (screen.orientation && screen.orientation.type) return screen.orientation.type.startsWith('landscape');
  return window.matchMedia ? matchMedia('(orientation: landscape)').matches : window.innerWidth > window.innerHeight;
}
let fitLast = -1;
// 高さの決め方（計算だけ）は js/fit.js の fitCalc（tools/test_fit.mjs で、にせの値を入れて確かめる）
// 値が古いかどうか：今の向き（landNow）と、innerWidth/innerHeight から見た向きが食いちがう（＝レイアウトがまだ前の向き）
const fitStale = () => { const l = landNow(), wl = window.innerWidth > window.innerHeight; return l !== wl; };
// 古いと分かったら、iOS にもう一度測らせる：viewport の指定を一瞬かえて、次のフレームでもどす（1回の回転につき1度だけ）
let fitNudged = false;
function fitNudge() {
  if (fitNudged) return; fitNudged = true;
  const m = document.querySelector('meta[name=viewport]'); if (!m) return; const c = m.getAttribute('content');
  m.setAttribute('content', c + ',maximum-scale=1.0001'); requestAnimationFrame(() => { m.setAttribute('content', c); window.scrollTo(0, 0); });
}
const typing = () => { const a = document.activeElement; return !!(a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT' || a.isContentEditable)); };
function fitApp() {
  const app = document.getElementById('app'); if (!app) return;
  const vv = window.visualViewport;
  const h = fitCalc({ ih: window.innerHeight, vh: vv ? vv.height + vv.offsetTop : 0, sa: standalone(), sw: screen.width, sh: screen.height, land: landNow(), kb: typing() });
  if (fitStale()) fitNudge(); else fitNudged = false;
  if (h > 100 && h !== fitLast) { fitLast = h; app.style.height = h + 'px'; document.documentElement.style.setProperty('--vvh', h + 'px'); }   // --vvh：見えている高さ（画面いっぱいの重ね絵・ダイアログ・縦向きの目安箱が使う）。変わったときだけ書く
  if (!typing()) pageHome();   // 文字を打っている間は、ページを原点へ戻さない（キーボードで入力欄が隠れないように）
}
// 回転・起動・復帰のあとは、しばらく毎フレーム測りなおす（iPhone は回転がおわってから数百ms〜1秒以上たって値が正しくなる。変わったときだけ書くので軽い）
let fitUntil = 0, fitRaf = 0;
function fitAppSoon() {
  fitApp(); fitUntil = performance.now() + 2500;
  if (!fitRaf) { const tick = () => { fitApp(); fitRaf = performance.now() < fitUntil ? requestAnimationFrame(tick) : 0; }; fitRaf = requestAnimationFrame(tick); }
}
fitAppSoon();
setInterval(() => { if (!document.hidden) fitApp(); }, 1500);   // 知らせが来なかったときの念のため（値が同じなら何もしない）
window.addEventListener('pageshow', fitAppSoon); document.addEventListener('visibilitychange', () => { if (!document.hidden) fitAppSoon(); });
window.addEventListener('resize', fitAppSoon); window.addEventListener('orientationchange', fitAppSoon); window.addEventListener('load', fitAppSoon);
document.addEventListener('fullscreenchange', fitAppSoon); document.addEventListener('webkitfullscreenchange', fitAppSoon);
if (window.visualViewport) window.visualViewport.addEventListener('resize', fitApp);
if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', fitAppSoon);
const QKEY = 'kojoHouse.quality';
// ボタンの置き場所：'top'＝ヘッダーに並べる／'rail'＝右はしに縦に並べる（右はしのときは、視点・電気などの道具もいつも右はし）。選んだ値は端末に保存
// まだ選んでいない端末は、角が丸いスマホ（横向きで safe-area の左右が 0 より大きい＝iPhone のノッチなど）だけ「右はし」、それ以外は「上」。
// 一度「角あり」と分かったら CORNKEY で覚える（回転や読み込み直後の 0 でぶれない）。選んだ値（LAYKEY）がいつも優先
const LAYKEY = 'kojoHouse.layout', CORNKEY = 'kojoHouse.corner';
const railTools = true;
let layoutRail = false, layoutSaved = false, cornerPhone = false;
try { const v = localStorage.getItem(LAYKEY); layoutSaved = v === 'rail' || v === 'top'; layoutRail = v === 'rail'; cornerPhone = localStorage.getItem(CORNKEY) === '1'; } catch (e) { }
// 確認用：?test=...&safe=左,右,下 で safe-area を入れた状態にする（にせの iPhone）
const SAFEQ = TESTQ_SAFE();
function TESTQ_SAFE() { const q = new URLSearchParams(location.search); if (!q.get('test')) return null; const m = /^(\d{1,3}),(\d{1,3}),(\d{1,3})$/.exec(q.get('safe') || ''); return m ? [+m[1], +m[2], +m[3]] : null; }
if (SAFEQ) { const st = document.documentElement.style; st.setProperty('--ci-l', SAFEQ[0] + 'px'); st.setProperty('--ci-r', SAFEQ[1] + 'px'); st.setProperty('--ci-b', SAFEQ[2] + 'px'); }
function measureCorner() {
  if (cornerPhone || layoutSaved) return;
  let l = 0, r = 0;
  if (SAFEQ) { l = SAFEQ[0]; r = SAFEQ[1]; }
  else if (window.innerWidth > window.innerHeight) { const p = document.createElement('div'); p.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)'; document.body.appendChild(p); const cs = getComputedStyle(p); l = parseFloat(cs.paddingLeft) || 0; r = parseFloat(cs.paddingRight) || 0; p.remove(); }
  if (l > 0 || r > 0) { cornerPhone = true; try { localStorage.setItem(CORNKEY, '1'); } catch (e) { } }
}
function syncLayout() { if (layoutSaved) return; measureCorner(); if (layoutRail !== cornerPhone) { layoutRail = cornerPhone; applyRail(); } }
function showErr(msg) { const el = $('err'); if (!el) return; el.hidden = false; el.textContent = 'ERR: ' + msg; console.error('ERR', msg); }
window.addEventListener('error', e => showErr(e.message + ' @' + (e.lineno || '')));
window.addEventListener('unhandledrejection', e => showErr(String(e.reason && e.reason.message || e.reason)));
// ===== 状態 =====
// S = 全体（名簿・チーミ・設定）。T = いま遊んでいるチーミ（家・所持ピコ）。保存層は store.js
let uidN = 1;
function inst(id, x, y, rot) { return { uid: uidN++, id, x, y, rot: rot || 0 }; }
function winst(id, wall, pos, z) { return { uid: uidN++, id, wall, pos, z }; }
const newRoom = store.newRoom;
let S = store.load(); uidN = S.uid || 1;
const TESTQ = new URLSearchParams(location.search).get('test');
// 担任助手の入口を出すか：手元(dev)はいつも。担任助手用URL(kojo-dev)は ?staff（または ?admin）つきで開いたときだけ。
// ?staff なしの kojo-dev は生徒用と同じ見た目（「はじめる」のあとに担任助手の入口が出ない・担任助手ボタンもない）。生徒用(kojo)は出さない
const STAFFQ = (() => { const q = new URLSearchParams(location.search); return q.has('staff') || q.has('admin'); })();
const staffOk = () => MODE === 'dev' || (MODE === 'staff' && STAFFQ);
const DEMOQ = new URLSearchParams(location.search).get('demo');   // ?demo=katsumata : 勝又チーミのお試しの家（サーバーに送らない・保存しない）
let demoMode = false;
let T = null, me = null, adminOn = false, noSave = !!TESTQ || !!DEMOQ;   // me = いま遊んでいる生徒
let saveT = 0;
function save() { if (SV.on) { if (T && me) commitSoon(); return; } clearTimeout(saveT); saveT = setTimeout(saveNow, 200); }
function saveNow() { if (noSave || SV.on) return; S.uid = uidN; store.save(S); if (T) saveFlash(); }
const mul = () => S.settings.priceMul;
const priceOf = d => Math.round(d.price * mul());
const room = () => T.rooms[S.cur.room];
const N = r => (r || room()).w;   // （テスト用：正方形の部屋の一辺）
const sq = (rm, n) => { rm.w = rm.d = n; };
// 玄関：この部屋にあれば、家具を置けないマス。なければ null
let entCache = { key: '', e: null };
function entRect(rm) {
  const k = T.rooms.map(r => r.x + ',' + r.z + ',' + r.w + ',' + r.d).join(';'); if (entCache.key !== k) entCache = { key: k, e: entranceOf(T.rooms) };
  const e = entCache.e; if (!e) return null; const r = T.rooms[e.k]; return r.x === rm.x && r.z === rm.z ? e.rect : null;
}
const roomIdxOf = rm => T.rooms.findIndex(r => r.x === rm.x && r.z === rm.z);
function rankIdx(t) { let r = 0; CFG.RANKS.forEach((k, i) => { if (t >= k.min * mul()) r = i; }); return r; }
const curRank = () => rankIdx(me ? me.earned || 0 : 0);
let quality = qualityDefault();
try { const q = localStorage.getItem(QKEY); if (q === 'std' || q === 'high' || q === 'ultra') quality = q; } catch (e) { }
TEXK.v = quality === 'std' ? 1 : 2;
// ===== サウンド・トースト =====
let AC = null;
function tone(f, t0, dur, type, vol) {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'triangle'; o.frequency.value = f;
    const t = AC.currentTime + t0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || .12, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + .02);
  } catch (e) { }
}
// 最初にさわった瞬間に音の道具を作っておく（あとで演出の音を鳴らすとき、画面が止まらないように）。効果音オフのときは作らない
function warmAudio() {
  try { if (S.sound && !AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC && AC.state === 'suspended') AC.resume(); } catch (e) { }
}
try { ['pointerdown', 'keydown'].forEach(n => addEventListener(n, warmAudio, { capture: true, passive: true })); } catch (e) { }
// 音の高さが f0 → f1 へなめらかに動く短い音（「シュッ」）
function sweep(f0, f1, dur, type, vol) {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime; o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || .08, t + dur * .35); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + .02);
  } catch (e) { }
}
function sfx(k) {
  if (!S.sound) return;
  // 家に入る・出る演出の音。音の道具（AudioContext）がまだ無いときは鳴らさない（作る間、演出が止まらないように。最初の操作のときに作っておく）
  if (k === 'shu' || k === 'pon' || k === 'kiran') {
    if (!AC) return;
    if (k === 'shu') { sweep(240, 1500, .22, 'triangle', .07); sweep(120, 700, .2, 'sine', .05); }
    else if (k === 'pon') { tone(587, 0, .12, 'sine', .1); tone(880, .05, .16, 'triangle', .07); }
    else [1568, 2093, 2637].forEach((f, i) => tone(f, i * .07, .22, 'sine', .05));
    return;
  }
  if (k === 'shutter') { tone(2400, 0, .03, 'square', .04); tone(1100, .05, .07, 'square', .05); tone(700, .11, .09, 'triangle', .04); }
  else if (k === 'buy') { tone(880, 0, .12); tone(1320, .08, .2); }
  else if (k === 'place') { tone(300, 0, .09, 'square', .06); tone(420, .06, .12, 'triangle'); }
  else if (k === 'ng') tone(180, 0, .18, 'sawtooth', .06);
  else if (k === 'coin') { tone(988, 0, .1); tone(1318, .09, .1); tone(1568, .18, .25); }
  else if (k === 'rank') { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .1, .25)); }
  else if (k === 'tap') tone(660, 0, .05, 'triangle', .05);
  else if (k === 'thud') { tone(130, 0, .12, 'sine', .16); tone(84, .02, .16, 'sine', .12); }
  else if (k === 'ach') { [1175, 1568, 2093].forEach((f, i) => tone(f, i * .08, .22, 'sine', .06)); }
  else if (k === 'boing') { tone(520, 0, .08, 'sine', .1); tone(780, .07, .12, 'sine', .1); }
  // 物理ガチャのカプセル（落ちる・揺れる・開く・当たりの段階）
  else if (k === 'gx_drop') { tone(190, 0, .14, 'sine', .14); tone(120, .02, .18, 'sine', .1); }
  else if (k === 'gx_shake') { tone(520, 0, .05, 'square', .05); tone(390, .05, .05, 'square', .04); }
  else if (k === 'gx_open') { tone(300, 0, .12, 'sawtooth', .05); tone(900, .05, .3, 'triangle', .1); tone(1500, .12, .35, 'sine', .08); }
  else if (k === 'gx_win1') { tone(988, 0, .1); tone(1318, .09, .1); tone(1568, .18, .3); }
  else if (k === 'gx_win2') { [659, 784, 988, 1318, 1568].forEach((f, i) => tone(f, i * .08, .28)); }
  else if (k === 'gx_win3') { [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone(f, i * .09, .4, i > 3 ? 'square' : 'triangle', i > 3 ? .07 : .12)); tone(262, 0, .9, 'sawtooth', .05); }
}
roofEvents.land = () => sfx('boing');   // 引いて家ができあがるとき、屋根の棟が着地した瞬間の軽い「ぽん」（音オフなら鳴らない）
function floatText(txt, cls) {
  const r = $('ptsBox').getBoundingClientRect(); const e = h('div', { cls: 'fl ' + cls, text: txt });
  e.style.left = (r.left + r.width / 2 - 30) + 'px'; e.style.top = (r.bottom - 4) + 'px'; document.body.appendChild(e); setTimeout(() => e.remove(), 1200);
}
// ===== 手ごたえの動き（音オフ・動きを減らす設定を尊重：sfx は S.sound、動きは motionOK） =====
const rectOf2 = el => el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
function coinOut() { const e = $('ptsBox'); flyCoins(rectOf2(e), $('bankBox'), 4); bounceEl($('bankBox')); }
function donateFx() { flyCoins(rectOf2($('ptsBox')), $('bankBox'), 6); bounceEl($('bankBox')); }
function sparkleItem(i) { try { const d = ITEM[i.id]; const r = cv.getBoundingClientRect(); let p; if (d.wall) return; const rm = room(); const [w, dd] = dims(d, i.rot); p = project(new THREE.Vector3(i.x + w / 2, .5, i.y + dd / 2).add(E.fxG ? E.fxG.position : new THREE.Vector3())); sparkleAt(r.left + p[0], r.top + p[1]); } catch (e) { } }
let dispPts = 0, dispOut = 0, lastPicosT = null, lastPicosUid = null; const CNT = JOY.makeCounter();
// おかえり表示（前に見たときより増えたとき）の間、上のピコの数字は「増える前」で止めておき、閉じたらカウントアップ＋コインが飛んで吸い込まれる（picoHold = 止めておく値）
let picoHold = null;
const PICO_SEEN_SCHEMA = 29, UNL_INTRO_SCHEMA = 30;
// お試しチーミ（ピコ使い放題）の人が最初に開いたときだけ、「ピコ使い放題」の演出を出す。人ごとに1回：サーバーが覚える（unl_intro_seen。同時に2台で開いても先の1台だけ）。
// 古いサーバー・サーバーなしは、この端末の記録（localStorage。人ごと）。通信に失敗したら出さずに次回へ。出し終わったら next（次の案内）へ。おかえり演出のあとに出る
function unlIntroMaybe(t, st, next) {
  const force = TESTQ === 'unlintro';
  if (st.staff || !(t && t.unlimited)) { next(); return; }
  const at = force ? (+new URLSearchParams(location.search).get('at') || undefined) : undefined;
  const show = () => { if (!(T && me === st)) return; setTimeout(() => { if (!(T && me === st) || !$('modal').hidden) { next(); return; } sfx('coin'); unlimitedIntro(nickOf(st), { onClose: next, at }); }, 350); };
  if (SV.on && !force && schemaAtLeast(UNL_INTRO_SCHEMA)) { svRpc('unl_intro_seen', { p_uid: st.uid }).then(r => { if (r && r.ok && r.first) show(); else next(); }, () => next()); return; }
  const k = 'kojoHouse.unlSeen.' + st.uid; let seen = false; try { seen = localStorage.getItem(k) === '1'; } catch (e) { }
  if (seen) { next(); return; }
  try { if (!(force && at != null)) localStorage.setItem(k, '1'); } catch (e) { }
  show();
}
function picoPopFx(tier) {   // 数がそろった瞬間：ポンと弾み、きらきら（増えたぶんが大きいほど派手に。tier 0〜2）
  const e = document.querySelector('.wb-pico'); if (!e) return; bounceEl(e);
  const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  sparkleAt(cx - 60, cy - 10); sparkleAt(cx + 60, cy - 10);
  if (tier >= 1) { sparkleAt(cx, cy - 30); sparkleAt(cx - 100, cy + 14); sparkleAt(cx + 100, cy + 14); }
  if (tier >= 2) confetti(48);
}
function picoHoldRelease(tier, rect) {   // おかえり表示を閉じた：コインを上のピコへ飛ばし、数字を増やす
  if (picoHold == null) return; picoHold = null;
  flyCoins(rect || { left: innerWidth / 2 - 20, top: innerHeight / 2 - 20, width: 40, height: 40 }, $('ptsBox'), 3 + tier * 3);
  setTimeout(() => { const bx = $('ptsBox'); bx.classList.remove('gain'); void bx.offsetWidth; bx.classList.add('gain'); sfx('coin'); }, 450);
  setTimeout(() => bounceEl($('ptsBox')), 1500);
}
function addPts(n) {
  me.picos += n; lastPicosT = me.picos; floatText((n > 0 ? '+' : '') + fmt(n) + ' ピコ', n > 0 ? 'p' : 'm');
  $('coin').classList.remove('bump'); void $('coin').offsetWidth; $('coin').classList.add('bump');
}
// ===== 配置判定 =====
// rot = 0〜3（0°・90°・180°・270°）。90°と270°のときは幅と奥行きが入れかわる
function dims(d, rot) { return (rot || 0) % 2 ? [d.d, d.w] : [d.w, d.d]; }
const rotY = rot => (rot || 0) * Math.PI / 2;
const nextRot = rot => ((rot || 0) + 1) % 4;
function rectOf(i) { const d = ITEM[i.id], [w, dd] = dims(d, i.rot); return { x0: i.x, y0: i.y, x1: i.x + w, y1: i.y + dd }; }
const ovl = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
// 点 (x,y) に立つときの、ラグの上の面の高さ（models_wall.js の build_rug：厚み .034・ふちから .02 内側までが上の面）。ふちの外 .1 から、ふちまでの間で、なめらかに（位置だけで決まるので、歩いて乗り降りしても足が一瞬ラグにめりこまない。以前は時間でなめらかにしていて、乗る瞬間に足が埋まっていた）
const RUG_H = .035, RUG_RAMP = .1;
const rise = (sd, H) => { const t = (sd + RUG_RAMP) / RUG_RAMP; return t <= 0 ? 0 : t >= 1 ? H : H * t * t * (3 - 2 * t); };   // ふちからの内側へのきょり sd → その高さ（外 .1 から、ふちまでで、なめらかに上がる）
function rugTop(x, y) {
  const rm = room(); if (!rm || !rm.items) return 0; let h = 0;
  { const e = entRect(rm); if (e) {   // 玄関の土間（タイル。上の面 .042）と玄関マット（その上。上の面 .077）：scene.js の「土間・玄関マット」と同じ大きさ
    const cx = (e.x0 + e.x1) / 2, d = rm.d, box = (x0, x1, y0, y1) => Math.min(x - x0, x1 - x, y - y0, y1 - y);
    h = Math.max(rise(box(cx - 1, cx + 1, d - .995, d - .005), .042), rise(box(cx - .6, cx + .6, d - .9, d - .2), .077));
  } }
  for (const i of rm.items) {
    const d = ITEM[i.id]; if (!d || d.cat !== 'rug') continue; const r = rectOf(i);
    const sd = d.round ? Math.min(r.x1 - r.x0, r.y1 - r.y0) / 2 - .02 - Math.hypot(x - (r.x0 + r.x1) / 2, y - (r.y0 + r.y1) / 2) : Math.min(x - r.x0, r.x1 - x, y - r.y0, r.y1 - y) - .02;   // ふちからの内側へのきょり（外は負）
    const v = rise(sd, RUG_H); if (v > h) h = v;
  }
  return h;
}
const isFloor = i => !ITEM[i.id].wall;
const isBig = i => isFloor(i) && !ITEM[i.id].small && !ITEM[i.id].ceil && ITEM[i.id].cat !== 'rug';
const surfZ = d => d.sh != null ? d.sh : d.h;
function hostAt(items, cx, cy) {
  const cell = { x0: cx, y0: cy, x1: cx + 1, y1: cy + 1 };
  return items.find(i => isBig(i) && ITEM[i.id].surface && ovl(rectOf(i), cell));
}
// いす（seat）と机・テーブル（tableTop）は、同じマスに重ねて置ける（机のそばに寄せる・机の下に半分入れる）。それ以外の大きい家具どうしは重ねられない
const seatTable = (a, b) => !!((a.seat && b.tableTop) || (a.tableTop && b.seat));
function placeCheck(rm, d, x, y, rot, ign) {
  const [w, dd] = dims(d, rot);
  if (x < 0 || y < 0 || x + w > rm.w || y + dd > rm.d) return { ok: false, why: '部屋の外には置けません' };
  const R = { x0: x, y0: y, x1: x + w, y1: y + dd }, er = entRect(rm);
  if (!d.ceil && er && ovl(R, er)) return { ok: false, why: '玄関には置けません' };   // 玄関のマスは通り道
  if (d.cat === 'rug') return { ok: true, z: 0 };
  const its = rm.items.filter(i => i.uid !== ign && isFloor(i));
  if (d.ceil) { for (const i of its) if (ITEM[i.id].ceil && ovl(rectOf(i), R)) return { ok: false, why: 'ほかの物があります' }; return { ok: true, z: 0 }; }
  if (!d.small) { for (const i of its) if (ITEM[i.id].cat !== 'rug' && !ITEM[i.id].ceil && ovl(rectOf(i), R) && !seatTable(d, ITEM[i.id])) return { ok: false, why: 'ほかの物があります' }; return { ok: true, z: 0 }; }
  let z = null;
  for (let cx = x; cx < x + w; cx++) for (let cy = y; cy < y + dd; cy++) {
    const cell = { x0: cx, y0: cy, x1: cx + 1, y1: cy + 1 };
    for (const i of its) if (ITEM[i.id].small && ovl(rectOf(i), cell)) return { ok: false, why: 'ほかの物があります' };
    let bigs = its.filter(i => isBig(i) && ovl(rectOf(i), cell));
    if (bigs.length > 1) bigs = bigs.filter(i => !ITEM[i.id].seat);   // 机のそばのいすは、小物の置き場の数に入れない
    let lv = 0;
    if (bigs.length) { if (bigs.length === 1 && ITEM[bigs[0].id].surface) lv = surfZ(ITEM[bigs[0].id]); else return { ok: false, why: 'ここには置けません' }; }
    if (z === null) z = lv; else if (z !== lv) return { ok: false, why: 'ここには置けません' };
  }
  if ((z || 0) + d.h > WH + .001) return { ok: false, why: '高すぎて置けません' };
  return { ok: true, z: z || 0 };
}
function wallCheck(rm, d, wall, pos, z, ign) {
  const n = wall === 'L' ? rm.d : rm.w;
  if (pos < -0.001 || pos + d.w > n + .001) return { ok: false, why: '壁の外には置けません' };
  if (z < 0 || z + d.h > WH + .001) return { ok: false, why: '壁の外には置けません' };
  { const ri = roomIdxOf(rm); if (ri >= 0) for (const [g0, g1] of wallGaps(T.rooms, T.open, ri)[wall] || []) if (pos < g1 - .001 && g0 < pos + d.w - .001) return { ok: false, why: 'ドアの所には掛けられません' }; }
  for (const i of rm.items) if (i.uid !== ign && i.wall === wall) {
    const e = ITEM[i.id]; if (!(pos < i.pos + e.w && i.pos < pos + d.w && z < i.z + e.h && i.z < z + d.h)) continue;
    // ドア（ground）には、ドアの中に収まる壁かけを掛けられる（ドアどうし・壁かけどうしは重ねられない）
    if (!!e.ground !== !!d.ground && (d.ground ? fitsOn(i, e, { pos, z }, d) : fitsOn({ pos, z }, d, i, e))) continue;
    return { ok: false, why: e.ground && !d.ground ? 'ドアからはみ出しています（ドアより小さい物だけ掛けられます）' : 'ほかの物があります' };
  }
  return { ok: true };
}
// 壁かけ a（大きさ ad）が、ドア b（大きさ bd）の中に収まっているか
const fitsOn = (a, ad, b, bd) => a.pos >= b.pos - .001 && a.pos + ad.w <= b.pos + bd.w + .001 && a.z >= b.z - .001 && a.z + ad.h <= b.z + bd.h + .001;
// 壁かけの後ろにあるドア（あれば、その厚みの分だけ手前に出して掛ける）
const DOOR_OFF = .085;
const doorBehind = (rm, i, d) => d.ground ? null : rm.items.find(o => o.uid !== i.uid && o.wall && o.wall === i.wall && ITEM[o.id] && ITEM[o.id].ground && fitsOn(i, d, o, ITEM[o.id])) || null;
function blockedSet(rm, ign) {
  const s = new Set();
  rm.items.forEach(i => { if (i.uid !== ign && isBig(i)) { const r = rectOf(i); for (let x = Math.floor(r.x0); x < Math.ceil(r.x1); x++) for (let y = Math.floor(r.y0); y < Math.ceil(r.y1); y++) s.add(x + ',' + y); } });   // 0.5 マスずれた家具は、かかるマスぜんぶをふさぐ
  return s;
}
// extra = 家具以外に通れないマス（ほかの人がいるマスなど）
// 8方向（ななめ込み）の A*。ななめの費用は √2。角のとなり2マスのどちらかがふさがっているときは、そのななめは通らない（角をすり抜けない）
// 歩ける表：庭に出られるとき（いまの部屋が玄関のある部屋で、庭が置いてあるとき）は、部屋と庭をひとつにした表（yard.js）。出られないときは、部屋だけの表。
// 家具は含まない（呼ぶ側が足す）。座標はどちらも部屋のマス目のまま（表の位置は (cx-ox, cy-oy)）。庭の表は、庭を置きなおす・間取りや部屋が変わったときだけ作りなおす
let YARD = { k: '', ge: null }, ROOMGRID = { ox: 0, oy: 0, w: 0, d: 0, g: null };
function walkBase(rm) {
  const y = outYard(), rooms = T.rooms, k = (y ? y.ver : 0) + '|' + S.cur.room + '|' + rooms.map(r => r.x + ',' + r.z + ',' + r.w + ',' + r.d).join(';');
  if (YARD.k !== k) YARD = { k, ge: y && rm === rooms[S.cur.room] ? yardGrid(rooms, S.cur.room, y) : null };
  if (YARD.ge) return YARD.ge;
  if (ROOMGRID.w !== rm.w || ROOMGRID.d !== rm.d) ROOMGRID = { ox: 0, oy: 0, w: rm.w, d: rm.d, g: new Uint8Array(rm.w * rm.d) };
  return ROOMGRID;
}
const DX8 = [1, 0, -1, 0, 1, 1, -1, -1], DY8 = [0, 1, 0, -1, 1, -1, 1, -1];
// nearest = true … 行き先に行けない（木・植え込み・柵の上、柵のむこうなど）ときは、行ける中でいちばん近いマスまで（庭のタップ用。着けないところをタップしても、歩きだす）
function findPath(rm, sx, sy, tx, ty, extra, nearest) {
  const gd = walkBase(rm), W = gd.w, D = gd.d, ox = gd.ox, oy = gd.oy, bl = blockedSet(rm);
  if (extra) extra.forEach(k => bl.add(k));
  sx -= ox; sy -= oy; tx -= ox; ty -= oy;
  const solid = gd.g.slice(); bl.forEach(k => { const i = k.indexOf(','), x = +k.slice(0, i) - ox, y = +k.slice(i + 1) - oy; if (x >= 0 && y >= 0 && x < W && y < D) solid[y * W + x] = 1; });
  if (nearest) { tx = Math.max(0, Math.min(W - 1, tx)); ty = Math.max(0, Math.min(D - 1, ty)); } else if (tx < 0 || ty < 0 || tx >= W || ty >= D || solid[ty * W + tx]) return null;
  const g = new Float32Array(W * D).fill(1e9), prev = new Int32Array(W * D).fill(-1), done = new Uint8Array(W * D), open = [], s0 = sy * W + sx; let t0 = ty * W + tx;
  const hf = i => { const dx = Math.abs(i % W - tx), dy = Math.abs(((i / W) | 0) - ty); return Math.max(dx, dy) + .4142 * Math.min(dx, dy); };
  g[s0] = 0; open.push(s0);
  while (open.length) {
    let bi = 0, bf = 1e9; for (let i = 0; i < open.length; i++) { const f = g[open[i]] + hf(open[i]); if (f < bf) { bf = f; bi = i; } }
    const c = open[bi]; open[bi] = open[open.length - 1]; open.pop(); if (done[c]) continue; done[c] = 1; if (c === t0) break;
    const x = c % W, y = (c / W) | 0;
    for (let k = 0; k < 8; k++) {
      const dx = DX8[k], dy = DY8[k], nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= D) continue;
      const n = ny * W + nx; if (solid[n] || done[n] || (dx && dy && (solid[y * W + nx] || solid[ny * W + x]))) continue;
      const ng = g[c] + (dx && dy ? 1.4142 : 1); if (ng < g[n]) { g[n] = ng; prev[n] = c; open.push(n); }
    }
  }
  if (prev[t0] < 0 && t0 !== s0) {
    if (!nearest) return null;
    let bc = s0, bd = 1e9; for (let i = 0; i < W * D; i++) if (done[i]) { const dd = Math.hypot(i % W - tx, ((i / W) | 0) - ty); if (dd < bd - 1e-6 || (Math.abs(dd - bd) <= 1e-6 && g[i] < g[bc])) { bd = dd; bc = i; } }
    t0 = bc;
  }
  const path = []; for (let c = t0; c !== s0; c = prev[c]) path.push([c % W + ox, ((c / W) | 0) + oy]); return path.reverse();
}
function freeCellNear(rm, x, y, extra) {
  const bl = blockedSet(rm); let best = null, bd = 1e9;
  if (extra) extra.forEach(k => bl.add(k));
  for (let cx = 0; cx < rm.w; cx++) for (let cy = 0; cy < rm.d; cy++) if (!bl.has(cx + ',' + cy)) { const dd = Math.abs(cx - x) + Math.abs(cy - y); if (dd < bd) { bd = dd; best = [cx, cy]; } }
  return best || [0, 0];
}
// ===== アバター（ロジック）：チーミ全員が家の中を歩く =====
const MAXAV = 24;                      // 描画する最大人数（それ以上は省略）
let AVS = [];                          // 歩く人たちの状態 {id,name,x,y,path,dir,t,idle,moving,ry,g,legs,arms,body,head}
const fnv = s => { let x = 2166136261; for (const c of String(s)) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619) >>> 0; } return x >>> 0; };
const HOODS = ['#a8e6cf', '#f7a8a0', '#ffd98a', '#a9c8f2', '#cdb4f0', '#f5b7d3', '#ffb98a', '#b8e0a0', '#8fd8e0', '#e8d0a8', '#d9a0a0', '#9fb0e8'];
const HAIRS = ['#a9794f', '#5a3e2b', '#2f2622', '#c9955c', '#7a4b3a', '#d7b26d', '#3d3a4f'];
const studentById = uid => S.students.find(s => s.uid === uid);
function randomFreeCells(rm, k) {
  const bl = blockedSet(rm), cells = [];
  for (let x = 0; x < rm.w; x++) for (let y = 0; y < rm.d; y++) if (!bl.has(x + ',' + y)) cells.push([x, y]);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [cells[i], cells[j]] = [cells[j], cells[i]]; }
  return cells.length ? Array.from({ length: k }, (_, i) => cells[i % cells.length]) : Array.from({ length: k }, () => [0, 0]);
}
// 先読みで作った me-（入る前に置いておく。見た目・名札・自分かどうかが同じときだけ、入るときに使い回す）
let warmAv = null;
const avSig = sts => JSON.stringify([sts.map(st => [st.uid, nickOf(st), st.me]), me && me.uid, me && !!me.staff]);
const AVS_STS = () => { const s = T ? T.members.map(studentById).filter(Boolean).slice(0, MAXAV) : []; if (T && me && me.staff) s.push(me); return s; };
function rebuildAvatars() {
  AVS.forEach(a => E.fxG.remove(a.g)); AVS = []; guest = null;
  const sts = T ? T.members.map(studentById).filter(Boolean).slice(0, MAXAV) : [];
  if (T && me && me.staff) sts.push(me);   // 見に来ている担任助手も、★つきの名札で部屋を歩く
  const few = sts.length <= 10, wa = warmAv, wk = avSig(sts); warmAv = null;
  if (wa && T && wa.key === wk) { AVS = wa.list; placeAvatars(); return; }   // 先読みで作っておいた me- をそのまま使う（作り直さない）
  if (wa) wa.list.forEach(a => E.fxG.remove(a.g));
  sts.forEach(st => addAvatar(st, few));
  placeAvatars();
}
function addAvatar(st, few) {
  {
    const id = st.uid, g = makeAvatar(st); g.traverse(o => { if (o.isMesh) o.castShadow = few; });
    E.fxG.add(g);
    const dir = (fnv(id) >>> 3) % 2, tr = idleFace();
    AVS.push({ id, name: nickOf(st), x: 1.5, y: 3.5, path: [], dir, t: Math.random() * 10, idle: 1 + Math.random() * 4, moving: false, ry: tr, tr, react: 0, g, legs: [g.getObjectByName('legL'), g.getObjectByName('legR')], arms: [g.getObjectByName('armL'), g.getObjectByName('armR')], body: g.getObjectByName('body'), head: g.getObjectByName('head') });
  }
}
// ===== 生徒の画面の「担任助手の吹き出し」=====
// 伝言が届くと（家に入ったときは、まだ読んでいないいちばん新しい伝言）、★の担任助手me-が部屋に来て吹き出しで話し、話し終わると帰る
const GUEST = '__guest';
let guest = null;
function staffSay(t, n) {
  if (!n || !T || T.id !== t.id || !me || me.staff || !E.fxG) return false;
  const p = staffList().find(x => x.nick === n.by), nick = n.by || '担任助手';
  if (guest && guest.nick !== nick) dropGuest();
  let a = AVS.find(x => x.id === GUEST);
  if (!a) {
    addAvatar({ uid: GUEST, staff: true, nick, picos: 0, earned: 0, inv: {}, me: p && p.me ? p.me : null }, AVS.length < 10); a = AVS[AVS.length - 1];
    const rm = room(), c = randomFreeCells(rm, 1)[0], fc = freeCellNear(rm, c[0], c[1], avCells(a)); a.x = fc[0] + .5; a.y = fc[1] + .5;
  }
  guest = { nick }; return sayAvatar(GUEST, n.text);
}
function dropGuest() { guest = null; const a = AVS.find(x => x.id === GUEST); if (!a) return; clearSay(a); E.fxG.remove(a.g); AVS = AVS.filter(x => x !== a); cam.dirty = true; }
function placeAvatars() {
  if (!T) return; const rm = room(), cells = randomFreeCells(rm, AVS.length);
  AVS.forEach((a, i) => { a.x = cells[i][0] + .5; a.y = cells[i][1] + .5; a.path = []; a.wp = null; a.v = 0; a.moving = false; a.res = null; a.wait = 0; a.shoe = null; a.shoesOn = null; });
  cam.dirty = true;
}
// 視点を変えたら、しばらく（8秒）みんなその場で向きを保つ：見たい顔がすぐそっぽを向かないように
let holdUntil = 0;
const holdAvatars = () => { holdUntil = performance.now() + 8000; };
// 人は「マスをふさぐ物」ではなく、半径 AV_R の円として扱う（家具はこれまでどおりマスで避ける）。
// 近づいたら少し横へずれる（向かい合ったらお互い右へ・立っている人は空いている側へ）。2人の間が体の幅の和より広ければ通れる。円には食い込まない
// 経路を探すときは人を無視する。立っている人が道をふさいで動けないままのときだけ、その人のマスを避けて探し直す
const standCells = self => {   // 立っている人の円(SEP)にかかるマス
  const s = new Set();
  AVS.forEach(b => {
    if (b === self || b.path.length || Math.hypot(b.x - self.x, b.y - self.y) > 3) return;
    for (let cx = Math.floor(b.x - SEP); cx <= Math.floor(b.x + SEP); cx++) for (let cy = Math.floor(b.y - SEP); cy <= Math.floor(b.y + SEP); cy++) {
      const nx = Math.max(cx, Math.min(cx + 1, b.x)), ny = Math.max(cy, Math.min(cy + 1, b.y)); if (Math.hypot(b.x - nx, b.y - ny) < SEP + .05) s.add(cx + ',' + cy);
    }
  });
  return s;
};
const avCells = self => { const s = new Set(); AVS.forEach(b => { if (b !== self) s.add(Math.floor(b.x) + ',' + Math.floor(b.y)); }); return s; };
// (x,y) に立つと、いまより近づく形でほかの人の円(SEP)に食い込むか。毎フレーム呼ぶので、何も作らない
const SEP = .4, LOOK = 1.3, PAD = .14;   // 体の幅の和(AV_R×2)・よけはじめる距離・すれ違うときの余裕
function hitPerson(a, x, y) {
  if (a.ghost > 0) return false;   // 見張りが2回ほどいても動けないとき、2秒だけ人をすり抜けて進む（人が3人つまった戸口などでの最後の手段）
  for (let i = 0; i < AVS.length; i++) {
    const o = AVS[i]; if (o === a) continue;
    const dx = o.x - x, dy = o.y - y, d2 = dx * dx + dy * dy;
    if (d2 < SEP * SEP - 1e-6) { const ex = o.x - a.x, ey = o.y - a.y; if (d2 < ex * ex + ey * ey - 1e-6) return true; }
  }
  return false;
}
// 行きたい向き (ux,uy) に対する、人からのよけ：横へずれる向きの足し算 (ST.x,ST.y)・正面の人までの距離 (ST.front)・行き先のすぐそばに人がいるか (ST.near)
const ST = { x: 0, y: 0, front: 1e9, near: false };
function steer(a, b, ux, uy, wx, wy) {
  if (a.ghost > 0) { ST.x = ST.y = 0; ST.front = 1e9; ST.near = false; return; }   // すり抜け中は、人をよけない
  let sx = 0, sy = 0, front = 1e9, near = false; const rx = -uy, ry = ux;   // 進行方向の右手（(rx,ry) は向きを90度回した向き）
  for (let i = 0; i < AVS.length; i++) {
    const o = AVS[i]; if (o === a) continue;
    if (Math.hypot(o.x - wx, o.y - wy) < SEP + PAD) near = true;
    const dx = o.x - a.x, dy = o.y - a.y, d = Math.hypot(dx, dy); if (d > LOOK || d < 1e-4) continue;
    const ahead = dx * ux + dy * uy; if (ahead < -SEP * .5) continue;   // うしろの人は気にしない
    const lat = dx * rx + dy * ry, al = Math.abs(lat), need = SEP + PAD;
    if (al >= need && d > need) continue;   // 進む道から十分はなれている
    if (ahead > 0 && al < SEP * .95 && ahead < front) front = ahead;
    let side;
    if (al > .06) side = lat > 0 ? -1 : 1;   // 相手がいる側と反対へ
    else if (o.moving && Math.abs(o.v || 0) > .3 && Math.sin(o.hd || 0) * ux + Math.cos(o.hd || 0) * uy < -.3) side = 1;   // 向かい合い：お互い右へ
    else side = solidAt(b, Math.floor(a.x + rx * .55), Math.floor(a.y + ry * .55)) ? -1 : 1;   // 立っている人が真正面：空いている側へ
    const w = Math.max(0, 1 - al / need) * Math.max(0, 1 - Math.max(ahead, 0) / LOOK) * 2.2;
    sx += side * rx * w; sy += side * ry * w;
  }
  ST.x = sx; ST.y = sy; ST.front = front; ST.near = near;
  if (b.door && Math.abs(a.y - b.door.y) < 1 && a.x > b.door.x0 - 1 && a.x < b.door.x1 + .5) { ST.x = ST.y = 0; }   // 玄関の戸口のまわりでは、人をよけて横へずれない（通れる幅が 0.3 しかなく、横へ押されて戸口にはまるため。ふさがれたら、ふさいでいる人にどいてもらう）
}
function avCell(a) { const b = blk(); return [Math.max(b.ox, Math.min(b.ox + b.w - 1, Math.floor(a.x))), Math.max(b.oy, Math.min(b.oy + b.d - 1, Math.floor(a.y)))]; }
// 庭にいて、庭が使えなくなった（部屋を変えた・間取りが変わった・庭を置きなおした）ときは、いまの表で歩ける、いちばん近いマスへ移す
function rescueAvatar(a, b) {
  const cx = Math.floor(a.x), cy = Math.floor(a.y); let best = null, bd = 1e9;
  for (let iy = 0; iy < b.d; iy++) for (let ix = 0; ix < b.w; ix++) if (!b.g[iy * b.w + ix]) { const dd = (b.ox + ix - cx) ** 2 + (b.oy + iy - cy) ** 2; if (dd < bd) { bd = dd; best = [b.ox + ix, b.oy + iy]; } }
  if (best) { a.x = best[0] + .5; a.y = best[1] + .5; a.path = []; a.wp = null; a.v = 0; a.res = null; a.wait = 0; a.moving = false; }
}
// 庭にいる人の位置（世界の座標）。カメラが、その人たちも画面に入るよう引く（scene.js）。庭に出られないとき・だれも庭にいないときは null
function yardPts() {
  const b = blk(); if (!b.door) return null; const rm = room(), fx = E.fxG.position; let pts = null;
  for (const a of AVS) if (a.x < 0 || a.y < 0 || a.x >= rm.w || a.y >= rm.d) (pts = pts || []).push([fx.x + a.x, fx.z + a.y]);
  return pts;
}
// 画面の点 → 歩ける床のマス。部屋の中、または（庭に出られるとき）庭。なければ null
function floorCell(x, y) {
  const f = floorAt(x, y, 0), rm = room();
  if (f[0] >= 0 && f[1] >= 0 && f[0] < rm.w && f[1] < rm.d) return [Math.floor(f[0]), Math.floor(f[1])];
  const b = blk(); if (!b.door) return null;
  const q = floorAt(x, y, -.34), cx = Math.floor(q[0]), cy = Math.floor(q[1]);   // 庭の地面は、部屋の床より少し低い
  return cx >= b.ox && cy >= b.oy && cx < b.ox + b.w && cy < b.oy + b.d ? [cx, cy] : null;
}
function walkTo(tx, ty, silent) {
  const rm = room(); let best = null, bd = 1e9;
  const mine = me && AVS.find(a => a.id === me.uid);
  if (mine) best = mine; else AVS.forEach(a => { const d = Math.hypot(a.x - tx - .5, a.y - ty - .5) + (a.path.length ? .5 : 0); if (d < bd) { bd = d; best = a; } });
  if (!best) return;
  const [sx, sy] = avCell(best);
  let p = findPath(rm, sx, sy, tx, ty);
  if (!p && (tx < 0 || ty < 0 || tx >= rm.w || ty >= rm.d) && blk().door) p = findPath(rm, sx, sy, tx, ty, null, true);   // 庭では、行けないところをタップしても、いちばん近い行けるところまで歩く
  if (!p) { if (!silent) sfx('ng'); return; }
  if (!p.length) p = [[sx, sy]];   // 今いるマスなら、そのマスの中心へ
  setRoute(best, p); if (!silent) sfx('tap');
}
// ===== 歩く動き =====
// マスの中心を直角にたどらず、①ななめにも進み ②見通しの通る所は直線にまとめ ③曲がり角は一定の速さで向きを変えて、なめらかな曲線にする。
// 速さは出だしにゆっくり加速・止まるときにゆっくり減速（時間ベース。フレームレートに左右されない）。経路を探すのは歩き出すときだけ
const WALK_V = 2.6, WALK_ACC = 5, WALK_DEC = 8, WALK_TURN = 9, AV_R = .2;   // 速さ(マス/秒)・加速・減速・曲がる速さ(rad/秒)・からだの半径
const GAIT_LEN = 1.25;   // 左右1歩ずつ（足の振りの1周期）で進む長さ
let BLK = { rm: null, items: null, n: -1, t: -1e9, w: 0, d: 0, ox: 0, oy: 0, g: null, door: null };
// 家具でふさがっているマスの表（0.25秒ごとに作り直す。毎フレーム・人数ぶん作らない）
function blk() {
  const rm = room(), now = performance.now();
  if (BLK.rm !== rm || BLK.items !== rm.items || BLK.n !== rm.items.length || now - BLK.t > 250) {
    const gd = walkBase(rm), w = gd.w, d = gd.d, ox = gd.ox, oy = gd.oy, g = gd.g.slice();
    blockedSet(rm).forEach(k => { const i = k.indexOf(','), x = +k.slice(0, i) - ox, y = +k.slice(i + 1) - oy; if (x >= 0 && y >= 0 && x < w && y < d) g[y * w + x] = 1; });
    BLK = { rm, items: rm.items, n: rm.items.length, t: now, w, d, ox, oy, g, door: gd.door || null };
  }
  return BLK;
}
const solidAt = (b, cx, cy) => { cx -= b.ox; cy -= b.oy; return cx < 0 || cy < 0 || cx >= b.w || cy >= b.d || b.g[cy * b.w + cx] === 1; };
// (x0,y0)→(x1,y1) の間に、からだの幅ぶんの余裕をもって家具・かべ（と extra のマス）がないか
function clearLine(b, x0, y0, x1, y1, extra) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / .15)), r = .3;
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; if (doorBlock(b, x, y, .08)) return false;
    for (let k = 0; k < 4; k++) { const cx = Math.floor(x + (k & 1 ? r : -r)), cy = Math.floor(y + (k & 2 ? r : -r)); if (solidAt(b, cx, cy) || (extra && extra.has(cx + ',' + cy))) return false; }
  }
  return true;
}
// マスの並び(cells)を、見通しの通る所は省いた「曲がり角の点」(wp)にして、歩かせる
function setRoute(a, cells, extra) {
  const b = blk(), wp = []; let px = a.x, py = a.y;
  const leg = arr => { let i = 0; while (i < arr.length) { let j = arr.length - 1; while (j > i && !clearLine(b, px, py, arr[j][0] + .5, arr[j][1] + .5, extra)) j--; px = arr[j][0] + .5; py = arr[j][1] + .5; wp.push([px, py]); i = j + 1; } };
  // 玄関の戸口のマスを通る道は、戸口の前と中の点をかならず通る（通れる幅は、柱とかべぎわの間の 0.3 しかない。マスの真ん中や、見通しで省いた直線だと、ふちにふれて進めなくなる）
  const dk = b.door ? cells.findIndex(c => c[0] === b.door.x0 && c[1] === b.door.y) : -1;
  if (dk < 0) leg(cells);
  else {
    const dx = b.door.x0 + .35; leg(cells.slice(0, dk));
    if (dk > 0 && cells[dk - 1][0] === b.door.x0) wp[wp.length - 1][0] = dx;
    px = dx; py = b.door.y + .5; wp.push([px, py]); leg(cells.slice(dk + 1));
  }
  if (!a.path.length || a.hd == null) a.hd = a.ry;
  a.path = cells; a.wp = wp; a.res = null; a.wait = 0; a.way = 0;
}
// (x,y) に立てるか：家具・かべに半径ぶん食い込まない、ほかの人の円に食い込まない
// 玄関のかべ（厚み 0.3）の東のはし：入口の東の柱にからだが食い込まない。入口の幅は 1.4（柱のあいだ）。通れるのは、その東がわ（yard.js）。柱より東（家の横の通路）は、かべぎわのマスがふさぐので、ここでは見ない（見ると、家の横の通路へ入れなくなる）
const doorBlock = (b, x, y, m) => !!b.door && y + AV_R > b.door.y && y - AV_R < b.door.y + .36 && x > b.door.x1 - .5 + .001 - (m || 0) && x < b.door.x1 + AV_R + .05;
function standOK(a, b, x, y) {
  if (doorBlock(b, x, y)) return false;
  if (x < b.ox + AV_R || y < b.oy + AV_R || x > b.ox + b.w - AV_R || y > b.oy + b.d - AV_R) return false;
  if (solidAt(b, Math.floor(x - AV_R), Math.floor(y - AV_R)) || solidAt(b, Math.floor(x + AV_R), Math.floor(y - AV_R)) || solidAt(b, Math.floor(x - AV_R), Math.floor(y + AV_R)) || solidAt(b, Math.floor(x + AV_R), Math.floor(y + AV_R))) return false;
  return !hitPerson(a, x, y);
}
// 向き：ry=0 で +y（手前）向き、π/2 で +x 向き。かべは x=0 と y=0 の2面。
// 立ち止まっているときは、かべ側を向かない（0〜π/2 の手前側だけ）。歩いているときは360度どの向きでもよい
const wrapA = v => Math.atan2(Math.sin(v), Math.cos(v));
const FACE_MAX = Math.PI / 2;
// 止まったときの向き：最後に向いていた方向のまま（前は手前へ向き直していたが、みんな同じ向きになって怖いのでやめた）
function standFace(v) { return v == null ? 0 : wrapA(v); }
const idleFace = () => Math.random() * FACE_MAX;
// 立っている人にふさがれたときだけ：その人のマスを避けた道を探し直す。道がなければ止まる（false）
function replanAround(a) {
  const [qx, qy] = avCell(a), dest = a.path[a.path.length - 1], occ = standCells(a), p = findPath(room(), qx, qy, dest[0], dest[1], occ);
  if (p && p.length) { setRoute(a, p, occ); return true; }
  const q = findPath(room(), qx, qy, dest[0], dest[1]);   // 人を避けた道がない（人が戸口に立っているなど）：人を無視した道で進み、ふさがれたらどいてもらう（止まってしまわない）
  if (q && q.length) { setRoute(a, q); a.wait = 0; return true; }
  a.path = []; a.wp = null; a.res = null; a.v = 0; a.tr = standFace(a.tr); return false;
}
// 玄関の「くつ」：家の中ではくつをぬいでいて（くつ下の足）、庭にいる人はくつをはいている。
// ・庭へ出るとき（'on'）：玄関マットの上まで歩いて止まり、正面（外向き）で、足もとにくつがポンと出て（きらっ）、片足ずつはく（1.5秒）。はけたら外へ歩きだす
// ・庭から入るとき（'off'）：玄関マットの上で止まって、片足ずつくつをぬぐ（ぬいだくつは足もとにそろい、きらっと消える）（1.2秒）→ 中へ
// はいているか（a.shoesOn）は、位置から決まる：庭にいる＝はいている／家の中＝ぬいでいる（玄関の近くだけ、しぐさの途中の状態）。ほかの人（リアルタイムの仲間も）も、位置から同じ見た目になるので同期はいらない（仲間は止めずに、戸口できらっと切りかわるだけ）。
// 行き先を変えて玄関を通らなくなったら、しぐさはすぐやめて、位置から決まる見た目にもどる（連打・やめても、庭にいるのにくつ下、にならない）
const SHOE_ON = 1.5, SHOE_OFF = 1.2;
function shoeOut(rm, c) { return c[0] < 0 || c[1] < 0 || c[0] >= rm.w || c[1] >= rm.d; }
function shoeKind(a) {
  const b = blk(), rm = room(); if (!b.door) return null;
  const dx = Math.abs(a.x - (b.door.x0 + .5));
  if (dx > 1.6 || a.y < rm.d - 1.4 || a.y > rm.d + 1.4) { a.shoeX = null; return null; }   // 玄関から離れたら、またできる
  if (a.shoeX || !a.path.length) return null;
  const dOut = shoeOut(rm, a.path[a.path.length - 1]), inRoom = !shoeOut(rm, [a.x, a.y]), fw = Math.cos(a.hd || 0);
  if (inRoom && dOut && !a.shoesOn && fw > .3 && a.y > rm.d - .7 && dx < .7) return 'on';    // 玄関マット（奥行き d-.9〜d-.2）の上
  if (inRoom && !dOut && a.shoesOn && fw < -.3 && a.y < rm.d - .3 && a.y > rm.d - .9 && dx < .9) return 'off';
  return null;
}
function shoeEnd(a, done) { const k = a.shoe.k; a.shoesOn = done ? k === 'on' : k === 'off'; a.shoe = null; }
function stepShoe(a, dt) {
  const s = a.shoe; s.t += dt;
  if (!a.path.length || shoeOut(room(), a.path[a.path.length - 1]) !== (s.k === 'on') || s.t >= s.dur) { shoeEnd(a, s.t >= s.dur); return false; }   // 行き先が変わった・終わった
  if (s.v0 > .3) { s.v0 *= Math.exp(-dt * 12); const nx = a.x + Math.sin(a.hd || 0) * s.v0 * dt, ny = a.y + Math.cos(a.hd || 0) * s.v0 * dt; if (standOK(a, blk(), nx, ny)) { a.x = nx; a.y = ny; } }   // 歩いてきた勢いで、少しすべって止まる
  a.v = 0; a.moving = false; if (s.k === 'on') a.tr = 0; else if (a.hd != null) a.tr = a.hd; return true;   // はくときは、正面（外向き＝手前）
}
// 位置から決まる、くつの状態をそろえる（毎フレーム。しぐさの途中は触らない）。庭にいるのにくつ下ならはく（きらっ）。家の中の奥にいるのにくつをはいていたらぬぐ
function shoeSync(a) {
  const rm = room(); if (!rm || a.shoe) return;
  const out = a.x < 0 || a.y < 0 || a.x >= rm.w || a.y >= rm.d;
  if (a.shoesOn == null) { a.shoesOn = out; return; }
  if (out && !a.shoesOn) { a.shoesOn = true; a.pop = { t: 0 }; }
  else if (!out && a.shoesOn && a.y < rm.d - (a.rt ? .45 : 1.3)) { a.shoesOn = false; a.pop = { t: 0 }; }
}
const ramp = (p, a, b) => Math.max(0, Math.min(1, (p - a) / (b - a))), bump = (p, a, b) => p > a && p < b ? Math.sin((p - a) / (b - a) * Math.PI) : 0, backOut = u => { const c = 1.70158, v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; };
let starTex = null;
// くつの見た目：本物のくつ（shoeG）と くつ下の足（footIn）の切りかえ・足もとに出るくつ（ghost：ポンとはずむ）・きらっ。a.shoe があれば、そのしぐさの進み具合 p から決める
function shoeVis(a, dt) {
  if (!a.shp) a.shp = a.legs.map(l => [l.getObjectByName('shoeG'), l.getObjectByName('footIn')]);
  const on0 = !!a.shoesOn; let r = [on0, on0], gs = [0, 0], sp = [0, 0];   // r[i]＝本物のくつを見せるか・gs[i]＝足もとのくつの大きさ・sp[i]＝きらっ（i：0＝左・1＝右）
  if (a.shoe) {
    const s = a.shoe, p = Math.min(1, s.t / s.dur);
    if (s.k === 'on') { const w1 = .44, w0 = .72, gi = backOut(ramp(p, .12, .30)); r = [p >= w0, p >= w1]; gs = [p < w0 ? gi : Math.max(0, 1 - ramp(p, w0, w0 + .06)), p < w1 ? gi : Math.max(0, 1 - ramp(p, w1, w1 + .06))]; sp = [Math.max(bump(p, .12, .34), bump(p, w0, w0 + .16)), Math.max(bump(p, .12, .34), bump(p, w1, w1 + .16))]; }
    else { const o1 = .24, o0 = .52, td = 1 - ramp(p, .70, .90); r = [p < o0, p < o1]; gs = [p >= o0 ? backOut(ramp(p, o0, o0 + .1)) * td : 0, p >= o1 ? backOut(ramp(p, o1, o1 + .1)) * td : 0]; sp = [Math.max(bump(p, o0, o0 + .16), bump(p, .7, .9)), Math.max(bump(p, o1, o1 + .16), bump(p, .7, .9))]; }
  } else if (a.pop) { a.pop.t += dt; const q = bump(a.pop.t, 0, .5); sp = [q, q]; if (a.pop.t >= .5) a.pop = null; }
  const sy = a.g.userData.shoeY || .33;
  for (let i = 0; i < 2; i++) {
    const [sg, fi] = a.shp[i], l = a.legs[i]; if (sg) sg.visible = r[i]; if (fi) fi.visible = !r[i];
    if (gs[i] > .01 && sg) {   // 足もとのくつ：足の前にポンと出る（はく・ぬぐ）。足のつけ根ではなく、足の高さを中心に大きさを変える
      if (!a.sgh) a.sgh = [null, null];
      if (!a.sgh[i]) { const h = new THREE.Group(), c = sg.clone(true); c.visible = true; c.position.y = sy; h.add(c); h.position.set(l.position.x * 1.15, l.position.y - sy, l.position.z + .15); h.rotation.y = i ? .12 : -.12; a.body.add(h); a.sgh[i] = h; }
      const h = a.sgh[i]; h.visible = true; h.scale.set(l.scale.x * gs[i], l.scale.y * gs[i], l.scale.z * gs[i]);
    } else if (a.sgh && a.sgh[i]) a.sgh[i].visible = false;
    if (sp[i] > .01) {   // きらっ
      if (!starTex) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,240,170,.9)'); g.addColorStop(1, 'rgba(255,230,140,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); c.fillStyle = '#fffbe6'; c.beginPath(); c.moveTo(32, 2); c.lineTo(37, 27); c.lineTo(62, 32); c.lineTo(37, 37); c.lineTo(32, 62); c.lineTo(27, 37); c.lineTo(2, 32); c.lineTo(27, 27); c.closePath(); c.fill(); starTex = new THREE.CanvasTexture(cv); starTex.colorSpace = THREE.SRGBColorSpace; }
      if (!a.spk) a.spk = [null, null];
      if (!a.spk[i]) { const sp0 = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })); sp0.renderOrder = 22; a.g.add(sp0); a.spk[i] = sp0; }
      const q = a.spk[i]; q.visible = true; q.position.set(l.position.x * 1.15, .07 + sp[i] * .05, .17); q.scale.setScalar(.05 + .13 * sp[i]); q.material.opacity = Math.min(1, sp[i] * 1.6); q.material.rotation = a.t * 3;
    } else if (a.spk && a.spk[i]) a.spk[i].visible = false;
  }
}
// 進めないとき、道をふさいでいる人（立っている・ほとんど動いていない人）に、その場からどいてもらう（玄関の戸口は 0.3 の幅しかなく、人が立っていると出入りできないため）。自分の me- と、リアルタイムで動かされている仲間は動かさない。どいた人が行く先は、戸口のまわりを避けた近くのあいたマス
function makeWay(a) {
  const b = blk(), rm = room(), os = [];
  for (const q of AVS) { if (q === a || q.rt || (me && q.id === me.uid) || q.shoe || ((q.v || 0) > .3 && q.path.length)) continue; const d = Math.hypot(q.x - a.x, q.y - a.y); if (d < LOOK + .5) os.push([d, q]); }
  os.sort((p, q) => p[0] - q[0]);
  for (const [, o] of os.slice(0, 3)) {   // 近い人から順に、どいて行ける先がある人を見つける（細い通路に2人並んでいるときは、奥の人から動いてもらう）
    const occ = avCells(o), [sx, sy] = avCell(o), cand = []; let best = null;
    for (let cy = Math.floor(o.y) - 3; cy <= Math.floor(o.y) + 3; cy++) for (let cx = Math.floor(o.x) - 3; cx <= Math.floor(o.x) + 3; cx++) {
      if (solidAt(b, cx, cy) || occ.has(cx + ',' + cy) || Math.hypot(cx + .5 - a.x, cy + .5 - a.y) < 1) continue;
      if (b.door && Math.abs(cx - b.door.x0) <= 1 && Math.abs(cy - b.door.y) <= 1) continue;
      cand.push([Math.hypot(cx - sx, cy - sy) + Math.random() * .5, cx, cy]);
    }
    cand.sort((p, q) => p[0] - q[0]);
    for (let i = 0; i < Math.min(8, cand.length) && !best; i++) { const p = findPath(rm, sx, sy, cand[i][1], cand[i][2], occ); if (p && p.length) best = p; }
    if (best) { setRoute(o, best); o.idle = 2 + Math.random() * 3; return true; }
  }
  return false;
}
// ===== リアルタイム：同じ家を開いている仲間のアバターを、届いた位置へなめらかに歩かせる（js/realtime.js）=====
// 届いている間（RT_STALE ミリ秒以内）だけ、その人のアバターは届いた位置・向きに従う。途切れる・オフにすると、今までのぶらぶら歩きにもどる
const RT_STALE = 7000;
let rtOn = rtPref(), rtUids = [];
const RT = createRealtime({ onPeer: p => rtPeer(p), onPresence: (uids, poses) => rtPresence(uids, poses), onChange: p => { if (rtOn && T && me && p.v > (T.version | 0)) pullApply(); } });   // 仲間が家を変えた合図：自分の版より新しければ、すぐ取り直す（送っていない変更があれば、pullApply が後回しにする）
function rtPeer(p) {
  if (!rtOn || !T || !me || p.u === me.uid) return;
  const a = AVS.find(x => x.id === p.u); if (!a) return;
  if (p.k !== S.cur.room) { a.rt = null; return; }   // ちがう部屋にいる人は、この部屋では歩かせない
  a.rt = { x: p.x, y: p.y, r: p.r, m: p.m, at: performance.now() };
}
function rtPresence(uids, poses) {
  rtUids = uids; paintLive();
  AVS.forEach(a => { if (a.rt && !uids.includes(a.id)) a.rt = null; });   // 家を出た人は、ぶらぶら歩きにもどる
  poses.forEach(p => { const a = AVS.find(x => x.id === p.u); if (a && !a.rt) rtPeer(p); });   // 途中から入ったとき：Presence にある位置で、最初の位置を合わせる
}
function rtDrive(a, dt) {
  const q = a.rt, now = performance.now();
  if (now - q.at > RT_STALE) { a.rt = null; a.v = 0; a.moving = false; return false; }
  const dx = q.x - a.x, dy = q.y - a.y, d = Math.hypot(dx, dy);
  a.path = []; a.wp = null; a.res = null; a.esc = null; a.wait = 0; a.idle = 3; a.react = 0;
  if (d > 3) { a.x = q.x; a.y = q.y; a.v = 0; }   // 離れすぎ（入ったばかり・部屋が変わった）：その場へ合わせる
  else {
    const k = 1 - Math.exp(-dt * 9), vt = d > .03 ? Math.min(WALK_V * 1.3, d * 9) : 0;
    a.x += dx * k; a.y += dy * k; a.v += (vt - a.v) * Math.min(1, dt * 12);
  }
  a.hd = a.tr = q.r; a.moving = a.v > .05; return true;
}
// 自分のアバターの位置を送る（送るかどうかの間引きは realtime.js）。ほかの人の家を見ているだけのとき・オフのときは送らない
function rtSend() {
  if (!RT.ready || !me) return; const m = AVS.find(a => a.id === me.uid); if (!m) return;
  RT.send({ x: m.x, y: m.y, r: m.tr != null ? m.tr : m.ry, m: m.moving ? 1 : 0, k: S.cur.room });
}
// 入る・出る・オン／オフ・タブの表示／非表示に合わせて、つなぐ／抜ける（毎フレーム呼ぶ。変わったときだけ動く）
function rtWatch() {
  const want = rtOn && SV.on && SV.sb && T && me && me.uid && !document.hidden ? T.id : null;
  if (want ? (RT.tid !== want || RT.uid !== me.uid) : RT.tid != null) { if (want) RT.join(SV.sb, want, me.uid); else { RT.leave(); AVS.forEach(a => { a.rt = null; }); } paintLive(); }
}
function paintLive() {
  const b = $('btnLive'); if (!b) return; b.hidden = !(SV.on && SV.sb && T && me);
  const n = Math.max(1, rtUids.length), names = rtUids.map(u => { const s = studentById(u); return s ? nickOf(s) : ''; }).filter(Boolean).join('・');
  b.classList.toggle('on', rtOn); $('liveTxt').textContent = rtOn ? 'いま ' + n + ' 人' : 'ライブ オフ';
  b.title = rtOn ? 'リアルタイム オン' + (names ? '（' + names + '）' : '') + '：タップでオフ' : 'リアルタイム オフ：タップでオン'; b.setAttribute('aria-pressed', rtOn ? 'true' : 'false');
}
function setRealtime(on) { rtOn = !!on; rtSetPref(rtOn); if (!rtOn) rtUids = []; rtWatch(); paintLive(); }
// 自分が庭に出たら：玄関のドアが閉まって、家の外側（屋根・外壁）が立ち上がる見え方にして、庭の自分が画面に入るよう少し引く（0.6秒ほど）。家に入ったらもとの見え方にもどす（ドアも開く）。
// 自分でカメラ（ズーム）を動かしたら、それを優先して、勝手にもどさない
const VO = { on: false, z0: 1, lz: 1, auto: false, back: null }, VO_ZOOM = .62;
function viewerOutTick(dt) {
  const a = me && AVS.find(x => x.id === me.uid), rm = T && room();
  const out = !!(a && rm && (cam.mode === 'iso' || cam.mode === 'free') && blk().door && (a.x < 0 || a.y < 0 || a.x >= rm.w || a.y >= rm.d));
  if (out !== VO.on) {
    VO.on = out; outSetViewerOut(out); roofForce(out);
    if (out) { VO.z0 = cam.zoom; VO.lz = cam.zoom; VO.auto = cam.zoom > VO_ZOOM; VO.back = null; }
    else { VO.back = VO.auto && Math.abs(cam.zoom - VO.lz) < .03 ? VO.z0 : null; VO.auto = false; }   // 自分で動かしていたら、もどさない
  }
  const k = 1 - Math.exp(-dt * 4.5);
  if (VO.on && VO.auto) { if (Math.abs(cam.zoom - VO.lz) > .03) VO.auto = false; else { cam.zoom += (VO_ZOOM - cam.zoom) * k; VO.lz = cam.zoom; cam.dirty = true; } }
  else if (!VO.on && VO.back != null) { if (Math.abs(cam.zoom - VO.lz) > .03) VO.back = null; else { cam.zoom += (VO.back - cam.zoom) * k; VO.lz = cam.zoom; cam.dirty = true; if (Math.abs(cam.zoom - VO.back) < .004) { cam.zoom = VO.back; VO.back = null; } } }
}
function updateAvatar(a, dt) {
  if (a.rt && rtDrive(a, dt)) { a.t += dt; return; }
  a.t += dt; if (a.ghost > 0) a.ghost -= dt;
  { const rm = room(); if (a.x < 0 || a.y < 0 || a.x >= rm.w || a.y >= rm.d) { const b = blk(); if (solidAt(b, Math.floor(a.x), Math.floor(a.y))) rescueAvatar(a, b); } }   // 庭で、庭が使えなくなっていたら、近くの歩ける所へ
  if (a.shoe && stepShoe(a, dt)) return;   // 玄関で、くつをはく・ぬぐ間
  if (a.react > 0) { a.moving = false; a.v = 0; return; }   // タップされて反応している間は、その場で止まる
  if (a.esc && a.esc.rp && a.esc.t <= 0) { a.esc = null; if (!replanAround(a)) return; }   // さがり終わったら、立っている人のマスを避けて道を探し直す
  if (a.path.length && a.wp && a.wp.length) {
    if (!a.shoe) { const k = shoeKind(a); if (k) { a.shoe = { t: 0, dur: k === 'on' ? SHOE_ON : SHOE_OFF, k, v0: a.v || 0 }; a.shoeX = k; a.moving = false; a.tr = a.hd == null ? a.ry : a.hd; return; } }
    const b = blk(), wp = a.wp, sp = a.v || 0;
    let w = wp[0], dx = w[0] - a.x, dy = w[1] - a.y, dist = Math.hypot(dx, dy);
    while (wp.length > 1 && dist < Math.max(.22, sp / WALK_TURN)) { wp.shift(); w = wp[0]; dx = w[0] - a.x; dy = w[1] - a.y; dist = Math.hypot(dx, dy); }   // 角の近くまで来たら、次の点へ向きを変えはじめる
    const fin = wp.length === 1;
    // 向き：行きたい向きへ、一定の速さで回る（急に向きを変えない）。向きが大きくずれているうちは、速さを落とす（大きければ、その場で向きを変えてから）
    // 近くに人がいれば、行きたい向きに「横へずれる分」を足す（人の円をよけて、間も通る）
    let ux = dist > 1e-4 ? dx / dist : 0, uy = dist > 1e-4 ? dy / dist : 0;
    const esc = a.esc && a.esc.t > 0;   // 人にはさまれて進めなくなったとき、探し直す前に少しさがる
    if (esc) { a.esc.t -= dt; ux = a.esc.x; uy = a.esc.y; ST.x = ST.y = 0; ST.front = 1e9; ST.near = false; } else steer(a, b, ux, uy, wp[wp.length - 1][0], wp[wp.length - 1][1]);
    const tx = ux + ST.x, ty = uy + ST.y;
    const dh = dist > 1e-4 && (tx || ty) ? wrapA(Math.atan2(tx, ty) - (a.hd || 0)) : 0, lim = (sp < .5 ? 5.5 : WALK_TURN) * dt, ad = Math.abs(dh);
    a.hd = wrapA((a.hd || 0) + Math.max(-lim, Math.min(lim, dh)));
    let vt = ad > 1.1 ? 0 : WALK_V * (1 - .45 * ad / 1.1);
    if (esc) vt = Math.min(vt, 1.1);
    if (fin) vt = Math.min(vt, Math.sqrt(2 * WALK_DEC * .85 * dist), dist * 4.5 + .05);   // 着くところでは、ゆっくり減速（最後はなめらかに止まる）
    if (ST.front < SEP + .3) vt = Math.min(vt, .35 + Math.max(0, ST.front - SEP) * 3);   // 正面に人がいるうちは、ゆっくり（横へずれる間も、少しは進む）
    const hx = Math.sin(a.hd), hy = Math.cos(a.hd);
    let blocked = ST.front < SEP + .12;
    // 行き先のすぐそばに人が立っているなら、手前まで来たところで着いたことにする（重ならない）
    if (fin && ST.near && dist < 1) { a.path = []; a.wp = null; a.res = null; a.v = 0; a.wait = 0; a.moving = false; a.tr = standFace(a.hd); return; }
    a.res = null;
    a.v = sp + Math.max(-WALK_DEC * dt, Math.min(WALK_ACC * dt, vt - sp));
    const step = a.v * dt;
    if (fin && dist <= Math.max(step, .02)) { a.x = w[0]; a.y = w[1]; a.path = []; a.wp = null; a.res = null; a.v = 0; a.wait = 0; a.moving = false; a.tr = standFace(a.hd); return; }
    const nx = a.x + hx * step, ny = a.y + hy * step, px0 = a.x, py0 = a.y;
    if (standOK(a, b, nx, ny)) { a.x = nx; a.y = ny; }
    else if (Math.abs(hx) > .05 && standOK(a, b, nx, a.y)) a.x = nx;       // 家具のへりは、すべるように進む
    else if (Math.abs(hy) > .05 && standOK(a, b, a.x, ny)) a.y = ny;   // （ほぼ真横・真下を向いているときの、ほとんど動かない「すべり」は、すべれたことにしない）
    else if (doorBlock(b, nx, ny) && standOK(a, b, a.x - Math.max(step, .01), a.y)) a.x -= Math.max(step, .01);   // 玄関の柱にふれて進めないときは、戸口の通れる側（西）へよる（まっすぐ向かうと、横へすべれず止まってしまう）
    else if (dist > 1e-4 && standOK(a, b, a.x + ux * Math.max(step, .01), a.y + uy * Math.max(step, .01))) { a.x += ux * Math.max(step, .01); a.y += uy * Math.max(step, .01); }
    else if (dist > 1e-4 && Math.abs(uy) > .05 && standOK(a, b, a.x, a.y + uy * Math.max(step, .01))) a.y += uy * Math.max(step, .01);
    else if (dist > 1e-4 && Math.abs(ux) > .05 && standOK(a, b, a.x + ux * Math.max(step, .01), a.y)) a.x += ux * Math.max(step, .01);   // 向いている方へは進めないが、行き先の方へなら進める（角にひっかかったまま動けなくならない）
    else { a.v = 0; blocked = true; }
    // 進もうとしているのに、からだがほとんど動かないまま（人をよける力と、玄関の細い入口の壁が、つりあって動けない）が続いたら、ふさがれたものとして扱う（下で、探し直す・あきらめる）
    { const g = a.pg; if (!g || Math.hypot(a.x - g.x, a.y - g.y) > .3) a.pg = { x: a.x, y: a.y, t: 0 }; else if ((g.t += dt) > 3) {
        a.pg = null; a.gc = (a.gc || 0) + 1; if (a.gc >= 1) { a.ghost = 3; a.gc = 0; }
        const dest = a.path[a.path.length - 1], [qx, qy] = avCell(a);
        if (!solidAt(b, qx, qy) && !AVS.some(o => o !== a && Math.hypot(o.x - qx - .5, o.y - qy - .5) < .5)) { a.x = qx + .5; a.y = qy + .5; }
        a.esc = null; const p = findPath(room(), qx, qy, dest[0], dest[1]); if (p && p.length) setRoute(a, p); else { a.path = []; a.wp = null; a.v = 0; a.moving = false; return; }
        a.v = 0; a.fail = 0; a.way = 0; a.moving = false; return;
      } }
    a.stk = Math.hypot(a.x - px0, a.y - py0) < .0015 && sp > .2 ? (a.stk || 0) + dt : 0;   // （sp：このフレームの前の速さ。止められて速さが 0 のままだと、出だしの1歩が .0015 より小さいので、永久に「動けない」のままになっていた＝玄関で出られなくなる原因のひとつ）
    if (a.stk > .4) { a.v = 0; blocked = true; }
    if (blocked && a.v < .5) {
      a.wait = (a.wait || 0) + dt;
      if (a.wait > 1 && (a.way = (a.way || 0) + 1) <= 6 && makeWay(a)) a.wait = .2;   // まず、ふさいでいる人にどいてもらう
      else if (a.wait > 1) {   // 立っている人にふさがれて進めないままなら、その人のマスを避けて探し直す（だめなら止まる）
        if ((a.fail = (a.fail || 0) + 1) > 30) { a.path = []; a.wp = null; a.res = null; a.v = 0; a.wait = 0; a.fail = 0; a.moving = false; a.tr = standFace(a.hd); return; }   // 何度探し直しても進めないときは、あきらめて止まる（ずっとうろうろしない）
        a.wait = 0; let ex = 0, ey = 0;   // まず、まわりの人から遠ざかる向きへ少しさがる（人のあいだにはさまったまま探し直さない）
        for (let i = 0; i < AVS.length; i++) { const o = AVS[i]; if (o === a) continue; const ox = a.x - o.x, oy = a.y - o.y, od = Math.hypot(ox, oy); if (od < LOOK && od > 1e-4) { ex += ox / od; ey += oy / od; } }
        const el = Math.hypot(ex, ey);
        if (el > .1) a.esc = { x: ex / el, y: ey / el, t: .9, rp: true }; else if (!replanAround(a)) return;
      }
    } else if (!blocked) a.wait = 0;
    a.dir = Math.abs(hx) > Math.abs(hy) ? (hx > 0 ? 0 : 2) : (hy > 0 ? 1 : 3);
    a.tr = a.hd;   // 進む向きそのまま（ななめも）
    a.moving = a.v > .05; a.idle = 2 + Math.random() * 5;
  } else {
    a.v = 0; a.wp = null; a.moving = false; a.idle -= dt; a.fail = 0;
    if (a.tr != null) a.tr = standFace(a.tr);   // 止まっても、最後の向きのまま
    if (a.idle <= 0) {
      a.idle = 2 + Math.random() * 5;
      // 自分のme-は、さわって歩かせたとき以外は動かない（向きも変えない）。
      // ほかの人も、視点を変えた直後（holdUntil まで）は、その場で向きを保つ
      if ((me && a.id === me.uid) || performance.now() < holdUntil) return;
      if (Math.random() < .55) { // ぶらぶら歩く
        const rm = room(), [cx, cy] = avCell(a), b = blk(), out = a.x < 0 || a.y < 0 || a.x >= rm.w || a.y >= rm.d;
        let tx = Math.max(0, Math.min(rm.w - 1, cx + (Math.random() * 7 | 0) - 3)), ty = Math.max(0, Math.min(rm.d - 1, cy + (Math.random() * 7 | 0) - 3));
        if (b.door && !out && Math.random() < .2) { tx = b.door.x0 - 2 + (Math.random() * (b.door.x1 - b.door.x0 + 4) | 0); ty = rm.d + 1 + (Math.random() * 3 | 0); }   // ときどき、庭（玄関の前）へ出る
        else if (out && Math.random() < .4) { const c = randomFreeCells(rm, 1)[0]; tx = c[0]; ty = c[1]; }   // 庭から、部屋へもどる
        else if (out) { tx = Math.max(b.door.x0 - 3, Math.min(b.door.x1 + 2, cx + (Math.random() * 7 | 0) - 3)); ty = Math.max(rm.d + 1, Math.min(rm.d + 4, cy + (Math.random() * 7 | 0) - 3)); }   // 庭では、玄関の前のあたりをぶらぶら
        const p = findPath(rm, cx, cy, tx, ty); if (p && p.length) setRoute(a, p);
      } else { a.dir = (a.dir + 1 + (Math.random() * 3 | 0)) % 4; a.tr = wrapA((a.tr != null ? a.tr : a.ry) + (Math.random() < .5 ? -1 : 1) * (.4 + Math.random() * .9)); }   // ほかの人は、ときどき今の向きから少しだけ向きを変える（みんなが同じ方を向かない）
    }
  }
}
// ===== アバター（3Dモデル：オリジナルの学生くん）=====
// 名前ラベル：canvasに文字を描いてSpriteにする（フォントはOS標準の日本語フォント）
// 担任助手（名前が★で始まる）は、金色の★と金のふちどりで目立たせる
// 文字の絵は画面より細かい canvas（LBL_S 倍）に描き、ミップマップで縮める。小さい canvas を縮めると、細い線がにじむ・ちらつくため
const LBL_S = 3;
function lblTex(cv) {
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 4; return tex;
}
function nameSprite(name, mine) {
  const staff = name.startsWith('★'), body = staff ? name.slice(1) : name;
  const cv = document.createElement('canvas'), c = cv.getContext('2d'), font = '800 40px "Hiragino Maru Gothic ProN","Yu Gothic UI","Meiryo","Noto Sans JP",sans-serif';
  c.font = font; const sw = staff ? 44 : 0, tw = Math.min(480, Math.ceil(c.measureText(body).width)); const lw = tw + 40 + sw; cv.width = lw * LBL_S; cv.height = 68 * LBL_S; c.scale(LBL_S, LBL_S);
  c.font = font; c.fillStyle = staff ? 'rgba(255,248,222,.98)' : 'rgba(255,252,244,.97)'; c.strokeStyle = staff ? '#e0a820' : mine ? '#f2877a' : '#b98650'; c.lineWidth = staff ? 6 : 4;
  c.beginPath(); if (c.roundRect) c.roundRect(3, 3, lw - 6, 62, 26); else c.rect(3, 3, lw - 6, 62); c.fill(); c.stroke();
  c.textBaseline = 'middle'; c.textAlign = 'center';
  if (staff) { c.fillStyle = '#f0b400'; c.fillText('★', 20 + sw / 2, 36); }
  c.fillStyle = '#3d2e22'; c.fillText(body, sw + (lw - sw) / 2, 36, 480);
  const tex = lblTex(cv);
  // depthWrite: false … 名札の四角（透明なところも）が奥行きを書くと、壁ぎわで陰影の処理がその四角だけ明るく抜け、頭の上に壁の板が浮き出て見える
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true, toneMapped: false }));
  sp.visible = false; Object.assign(sp.userData, { staff, mine: !!mine, body });   // 3D の名札は写真用（普段は HTML の名札）
  sp.userData.ar = lw / 68; sp.scale.set(sp.userData.ar * .27, .27, 1); sp.center.set(.5, 0); sp.position.y = 1.36; sp.renderOrder = 20; return sp;
}
// 頭の上の名前札は、遠くても近くても同じ見た目の大きさ（画面の高さに合わせて20〜28px）に保つ
const _lv = new THREE.Vector3();
let pops = [];   // 置いた家具がぽんと弾むアニメ
function stepPops(dt) {
  if (!pops.length) return; cam.dirty = true;
  pops = pops.filter(p => { const g = objs.get(p.uid); p.t += dt; if (!g) return p.t < .3; const k = Math.min(1, p.t / .38); g.scale.setScalar(1 + .14 * Math.sin(k * Math.PI) * (1 - k * .4)); if (k >= 1) g.scale.setScalar(1); return k < 1; });
}
// ===== 名札・吹き出しは、画面の上に重ねた HTML の文字で出す（3D の絵を縮めるよりずっとくっきり）。3D の名札は、写真を撮るときだけ出す（photoLabels） =====
// 位置は 3D の頭の上を画面の座標に直して毎フレーム置く（描き直しをする回だけ）。大きさは今までと同じ（画面の高さに合わせて20〜28px・遠近で少し変わる）。壁や家具の後ろでも隠さない（今までと同じ）
let lbLayer = null, lbU = 0, lbGen = 0, lbAvT = -1e9, lbAv = [], lbFresh = false; const lbMap = new Map(), _lp = new THREE.Vector3();
const LB_KMAX = 1.3;   // 近くの人の名札が大きくなりすぎない上限（いつもの大きさの何倍まで）。これを超えて近いと、なめらかに薄くして消す
function lbAvoid(L) {   // 名札をよけたい画面の部品（上の帯・ミッションのカード・右はしのレール・目線をやめる）の枠。毎フレームは測らず、少し間をあけて測り直す
  const now = performance.now(); lbFresh = false; if (now - lbAvT < 300) return lbAv; lbAvT = now; lbFresh = true; lbAv = [];
  const o = L.getBoundingClientRect();
  document.querySelectorAll('#hud>*,#hudSub,#btnMission,#rail,#eyeExit').forEach(e => { if (e.hidden) return; const b = e.getBoundingClientRect(); if (b.width > 1 && b.height > 1) lbAv.push({ l: b.left - o.left - 4, t: b.top - o.top - 4, r: b.right - o.left + 4, b: b.bottom - o.top + 4 }); });
  return lbAv;
}
function lbEl(cls, parent) { const e = document.createElement('div'); e.className = cls; parent.appendChild(e); return e; }
function lbLayerEl() {
  if (lbLayer) return lbLayer;
  const st = document.getElementById('stage'), cv = document.getElementById('cv'); if (!st || !cv) return null;
  lbLayer = document.createElement('div'); lbLayer.id = 'lbLayer'; lbLayer.setAttribute('aria-hidden', 'true'); st.insertBefore(lbLayer, cv.nextSibling); return lbLayer;
}
function lbName(w, sp) {   // 名札（textContent だけで作る。名前を HTML として読ませない）
  const e = lbEl('lb' + (sp.userData.staff ? ' st' : sp.userData.mine ? ' mine' : ''), w);
  if (sp.userData.staff) { lbEl('lb-s', e).textContent = '★'; }
  lbEl('lb-t', e).textContent = sp.userData.body; return e;
}
function photoLabels(on) {   // 写真：3D の名札・吹き出しを一時的に出す／しまう（普段は HTML の方を使うので 3D 側は隠してある）
  AVS.forEach(a => { const l = a.g.userData.lbl; if (l) l.visible = on; if (a.say) a.say.visible = on; });
}
E.photoLabels = photoLabels;
function scaleLabels() {
  const c = E.camera, e5 = c.projectionMatrix.elements[5], px = Math.max(20, Math.min(28, E.H * .03)), L = lbLayerEl(), dpr = window.devicePixelRatio || 1;
  if (L && lbU !== px) { lbU = px; L.style.setProperty('--u', (px / 68) + 'px'); }
  let av = null; if (L) { c.updateMatrixWorld(); lbGen++; av = lbAvoid(L); }
  AVS.forEach(a => { const sp = a.g.userData.lbl; if (!sp) return; sp.getWorldPosition(_lv); const d = _lv.distanceTo(c.position), wh = Math.max(.12, Math.min(.8, px * d * 2 / (E.H * e5))); sp.scale.set(sp.userData.ar * wh, wh, 1);
    if (a.say) { const bh = wh * a.say.userData.hr * (a.say.userData.pop || 1); a.say.scale.set(a.say.userData.ar * bh, bh, 1); }
    if (!L) return;
    let r = lbMap.get(a); if (!r) { const w = lbEl('lbw', L); r = { w, n: lbName(w, sp), sp, sy: null, sayEl: null, shown: true }; lbMap.set(a, r); }
    r.gen = lbGen;
    _lp.copy(_lv).applyMatrix4(c.matrixWorldInverse); const front = _lp.z < -c.near, show = front && !a.eyeH && a.g.visible && !roofCovers();
    if (show !== r.shown) { r.shown = show; r.w.style.display = show ? '' : 'none'; }
    if (!show) return;
    _lp.copy(_lv).project(c);
    let x = (_lp.x * .5 + .5) * E.W, y = (.5 - _lp.y * .5) * E.H; const kr = wh * E.H * e5 / (2 * d) / px, k = Math.min(kr, LB_KMAX);
    if (a.say !== r.sy) {   // 吹き出しの出入り
      if (r.sayEl) { r.sayEl.remove(); r.sayEl = null; }
      r.sy = a.say; r.nw = 0;
      if (a.say) { r.sayEl = lbEl('sb', r.w); lbEl('sb-t', r.sayEl).textContent = a.say.userData.text; }
    }
    // 近すぎる人は、いつもの大きさの上限までにして、さらに近づくとなめらかに薄くして消す
    let op = kr <= LB_KMAX ? 1 : Math.max(0, 1 - (kr - LB_KMAX) / 0.9);
    if (!r.nw || lbFresh) { r.nw = Math.max(r.n.offsetWidth, r.sayEl ? r.sayEl.offsetWidth : 0, 1); r.ext = r.sayEl ? lbU * 100 / 68 + r.sayEl.offsetHeight : lbU; }
    const hw = r.nw * k / 2 + 4, ht = r.ext * k + 4;   // 名札と吹き出しをあわせた枠（x は中心から左右 hw、y は足もと側が原点で上へ ht）
    x = Math.max(hw, Math.min(E.W - hw, x)); y = Math.max(ht + 4, Math.min(E.H - 4, y));   // 画面の外へはみ出さない
    let hit = false; for (let i = 0; i < av.length; i++) { const v = av[i]; if (x + hw > v.l && x - hw < v.r && y > v.t && y - ht < v.b) { hit = true; break; } }
    if (r.ov == null) r.ov = hit ? .2 : 1; else r.ov += ((hit ? .2 : 1) - r.ov) * .25;   // 上の帯などに重なるあいだは薄くする（なめらかに）
    const cv = outCover(c.position, _lv); r.cv = r.cv == null ? cv : r.cv + (cv - r.cv) * .3;   // 庭の木・植え込みのうしろに隠れているあいだは、なめらかに薄くする（家具のうしろは今までどおり）
    op *= r.ov * (1 - r.cv); const os = op.toFixed(2); if (r.os !== os) { r.os = os; r.w.style.opacity = os; r.w.style.visibility = op < .02 ? 'hidden' : ''; }
    x = Math.round(x * dpr) / dpr; y = Math.round(y * dpr) / dpr;
    r.w.style.transform = 'translate(' + x + 'px,' + y + 'px)' + (Math.abs(k - 1) > .02 ? ' scale(' + k.toFixed(3) + ')' : '');
    if (r.sayEl) { const op = Math.max(0, Math.min(1, a.say.material.opacity)); r.sayEl.style.opacity = op.toFixed(2); r.sayEl.style.visibility = op < .01 ? 'hidden' : ''; r.sayEl.style.setProperty('--pop', (a.say.userData.pop || 1).toFixed(3)); }
  });
  if (L) lbMap.forEach((r, a) => { if (r.gen !== lbGen) { r.w.remove(); lbMap.delete(a); } });   // いなくなった人の名札を片づける
}
function makeAvatar(st) {
  const m = cleanMe(st.me) || seededMe(st.uid), g = buildMe(m);
  const sp = nameSprite(nickOf(st).slice(0, 10), !!(me && st.uid === me.uid)); sp.position.y = AV.label * g.userData.h; g.userData.lbl = sp; g.add(sp); return g;
}
// 吹き出し：担任助手が伝言を書くと、★のme-の頭の上（名札のさらに上）にしばらく出る
// 名札と同じ倍率で大きさを変えるので、画面上の大きさは一定。長い文は3行まで（それ以上は「…」）
const SAY_W = 540, SAY_LH = 50, SAY_MAX = 3;
function bubbleSprite(text) {
  const cv = document.createElement('canvas'), c = cv.getContext('2d'), font = '700 38px "Hiragino Maru Gothic ProN","Yu Gothic UI","Meiryo","Noto Sans JP",sans-serif';
  c.font = font; const lines = []; let over = false;
  for (const para of String(text).replace(/\r/g, '').split('\n')) {
    let cur = '';
    for (const ch of para) { if (c.measureText(cur + ch).width > SAY_W) { lines.push(cur); cur = ch; } else cur += ch; }
    lines.push(cur);
  }
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (lines.length > SAY_MAX) { lines.length = SAY_MAX; over = true; }
  if (over) { let l = lines[SAY_MAX - 1]; while (l && c.measureText(l + '…').width > SAY_W) l = l.slice(0, -1); lines[SAY_MAX - 1] = l + '…'; }
  const tw = Math.max(60, ...lines.map(l => Math.ceil(c.measureText(l).width))), pad = 26, tail = 22, bh = lines.length * SAY_LH + pad * 2 - 16;
  const lw = tw + pad * 2 + 8, lh = bh + tail + 8; cv.width = lw * LBL_S; cv.height = lh * LBL_S; c.scale(LBL_S, LBL_S);
  const x0 = 4, y0 = 4, w = lw - 8, mx = lw / 2;
  c.fillStyle = 'rgba(255,255,255,.98)'; c.strokeStyle = '#e0a820'; c.lineWidth = 5; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x0 + 24, y0); c.arcTo(x0 + w, y0, x0 + w, y0 + bh, 24); c.arcTo(x0 + w, y0 + bh, x0, y0 + bh, 24);
  c.lineTo(mx + 16, y0 + bh); c.lineTo(mx, y0 + bh + tail); c.lineTo(mx - 16, y0 + bh);   // 下向きのしっぽ（名札の方へ）
  c.arcTo(x0, y0 + bh, x0, y0, 24); c.arcTo(x0, y0, x0 + w, y0, 24); c.closePath(); c.fill(); c.stroke();
  c.font = font; c.fillStyle = '#3d2e22'; c.textBaseline = 'middle'; c.textAlign = 'left';
  lines.forEach((l, i) => c.fillText(l, x0 + pad, y0 + pad - 8 + SAY_LH * (i + .5)));
  const tex = lblTex(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true, toneMapped: false, opacity: 0 }));
  sp.visible = false; sp.userData.text = String(text);   // 3D の吹き出しは写真用（普段は HTML）
  const hr = lh / 68; sp.userData.ar = lw / lh; sp.userData.hr = hr;
  sp.center.set(.5, -1.12 / hr); sp.renderOrder = 22; return sp;   // 名札（高さ1）のすぐ上に、吹き出しの下端がくる
}
function clearSay(a) { if (!a.say) return; a.g.remove(a.say); a.say.material.map.dispose(); a.say.material.dispose(); a.say = null; }
function sayAvatar(id, text) {
  const a = AVS.find(x => x.id === id); if (!a || !String(text || '').trim()) return false;
  clearSay(a); const sp = bubbleSprite(text), lbl = a.g.userData.lbl; sp.position.y = lbl ? lbl.position.y : 1.36; a.g.add(sp);
  a.say = sp; a.sayAge = 0; a.sayT = Math.min(14, 6 + String(text).length * .1);
  const cp = E.fxG.worldToLocal(E.camera.position.clone()); a.path = []; a.tr = Math.atan2(cp.x - a.x, cp.z - a.y);   // 見ている人の方を向いて、話すあいだは立ち止まる
  a.idle = Math.max(a.idle, a.sayT); cam.dirty = true; return true;
}
function stepSay(a, dt) {
  if (!a.say) return; const mo = $('modal'); a.sayAge = mo && !mo.hidden ? Math.min(a.sayAge + dt, .2) : a.sayAge + dt;   // ダイアログを開いている間は時間を止め、閉じてから見えるように
  const k = a.sayAge, op = Math.min(1, k / .2, (a.sayT - k) / .6); a.say.material.opacity = Math.max(0, op); a.say.userData.pop = 1 + .18 * Math.max(0, 1 - k / .25) * Math.sin(Math.min(1, k / .25) * Math.PI);
  if (k >= a.sayT) { clearSay(a); if (a.id === GUEST) dropGuest(); }   // 話し終わった担任助手は帰る
}
const DIR_RY = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];
function updateAvatarObj(a, dt) {
  const tgt = a.tr == null ? DIR_RY[a.dir] : a.tr; let d = wrapA(tgt - a.ry);
  if (Math.abs(d) > .005) a.ry = wrapA(a.ry + d * (1 - Math.exp(-dt * (a.react > 0 ? 18 : 12)))); else a.ry = tgt;
  // 歩き：足の振りは「進んだ道のり」で進む（速いほど速く、止まると止まる）。大きさは速さに合わせ、止まると自然に戻る
  const v = a.v || 0, br = Math.sin(a.t * 2.2);
  a.ph = (a.ph || 0) + v * dt * (Math.PI * 2 / GAIT_LEN); a.amp = (a.amp || 0) + (Math.min(1, v / WALK_V) - (a.amp || 0)) * (1 - Math.exp(-dt * 10));
  const amp = a.amp, sw = Math.sin(a.ph) * amp, hop = Math.abs(Math.sin(a.ph)) * amp, idl = 1 - amp;   // hop は1周期に2回（一歩ごと）
  let lift = hop * .07, armZ = 0, squash = 0, tilt = 0, se = 0, sk0 = 0, sk1 = 0;
  if (a.shoe) {   // くつをはく・ぬぐ：かがんで、片足ずつ上げる（くつの出入りは shoeVis）。さいごにちょんと跳ねる（歩きの動きとなめらかにつなぐ）
    const s = a.shoe, p = Math.min(1, s.t / s.dur), on = s.k === 'on', ss = x => x * x * (3 - 2 * x);
    se = ss(Math.max(0, Math.min(1, p / .1, (1 - p) / .12))) * .8; sk1 = on ? bump(p, .30, .58) : bump(p, .10, .38); sk0 = on ? bump(p, .58, .86) : bump(p, .38, .66);
    if (p > .9) lift += Math.sin((p - .9) / .1 * Math.PI) * .05; squash += se * .9;
  }
  shoeSync(a); shoeVis(a, dt);
  if (a.react > 0) {   // タップされた反応：ぴょんと跳ねて、片手をふり、首をかしげる
    a.react = Math.max(0, a.react - dt); const p = 1 - a.react / REACT_T;
    const j = p < .45 ? Math.sin(p / .45 * Math.PI) : 0;           // 1回ぴょん
    lift += j * .22; squash = p < .08 ? p / .08 : p < .45 ? 1 - j : 0;   // 跳ぶ前に少しかがむ
    armZ = Math.min(1, p * 5) * Math.min(1, a.react * 4);           // 手をあげて、終わりにおろす
    tilt = Math.sin(Math.min(1, p * 1.6) * Math.PI) * .22;
    if (a.fx) { a.fx.position.y = (AV.fx + p * .45) * (a.g.userData.h || 1); a.fx.material.opacity = Math.min(1, (1 - p) * 3); a.fx.scale.setScalar(.32 * Math.min(1, p * 6)); }
    if (!a.react && a.fx) { a.g.remove(a.fx); a.fx.material.dispose(); a.fx = null; }
  }
  a.legs[0].rotation.x = sw * .7 * (1 - se) + sk0 * 1.05; a.legs[1].rotation.x = -sw * .7 * (1 - se) + sk1 * 1.05; a.arms[0].rotation.x = -sw * .55 * (1 - se) - se * .6; a.arms[1].rotation.x = sw * .55 * (1 - se) - se * .6;   // 足と腕は逆に振る
  a.arms[0].rotation.z = -.12; a.arms[1].rotation.z = .12 + armZ * (2.5 + Math.sin(a.t * 18) * .35);
  const sq = squash * .1, bs = hop * -.03 + br * -.008 * idl;
  a.body.scale.set(1 + bs + sq * .6, 1 + hop * .04 + br * .016 * idl - sq, 1 + bs + sq * .6);
  if (a.fig === undefined) a.fig = a.g.getObjectByName('fig') || null;
  if (a.fig) a.fig.rotation.x = amp * .07 + se * .32;                                    // 歩くとき、ほんの少し前かがみ
  a.g.rotation.z = Math.sin(a.ph) * amp * .04;                                // 一歩ごとに、ほんの少し左右へ揺れる
  // 頭は体より少し遅れてついてくる
  a.head.rotation.z = Math.sin(a.ph - .9) * amp * .05 + (Math.sin(a.t * 1.1) * .025 * idl + tilt); a.head.position.y = (a.head.userData.baseY || .8) + Math.abs(Math.sin(a.ph - .7)) * amp * .012 + br * .004 * idl;
  if (a.pet === undefined) a.pet = a.g.getObjectByName('pet') || null;
  if (a.petin === undefined) a.petin = a.g.getObjectByName('petin') || null;
  if (a.petin) a.petin.rotation.y = Math.sin(a.t * .9) * .12 + Math.sin(a.ph) * amp * .08;   // 水槽・とりかごの中の生き物だけ、ほんの少し向きが変わる（入れ物はゆれない）
  if (a.pet) { a.pet.position.y = Math.abs(Math.sin(a.ph + .5)) * amp * .035; a.pet.rotation.z = Math.sin(a.ph) * amp * .07; }   // ペットも、いっしょに ぴょこぴょこ
  { const gb = blk(), ry = rugTop(a.x, a.y); a.rugY = ry;   // ラグの上では、ラグの厚みぶん上に立つ（足が埋まらない。乗り降りはなめらかに）
    a.g.position.set(a.x, lift + a.rugY + groundY(gb.door ? gb : null, room(), a.x, a.y), a.y); } a.g.rotation.y = a.ry;   // 庭では、地面が床より少し低い
}
// me-をタップしたときの反応。カメラの方を向いて、ぴょん＋手をふる＋頭の上に ♪
const REACT_T = 1.1;
let noteTex = null;
function reactAvatar(a) {
  if (!noteTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 96; const c = cv.getContext('2d');
    c.font = '800 72px "Segoe UI Symbol","Hiragino Maru Gothic ProN","Yu Gothic UI",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 8; c.strokeStyle = '#fffaf0'; c.strokeText('♪', 48, 52); c.fillStyle = '#f2877a'; c.fillText('♪', 48, 52);
    noteTex = new THREE.CanvasTexture(cv); noteTex.colorSpace = THREE.SRGBColorSpace;
  }
  if (!a.fx) { a.fx = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })); a.fx.renderOrder = 21; a.fx.position.x = .28; a.g.add(a.fx); }
  const cp = E.fxG.worldToLocal(E.camera.position.clone());
  a.tr = Math.atan2(cp.x - a.x, cp.z - a.y);   // カメラ（見ている人）の方へ
  a.react = REACT_T; a.idle = Math.max(a.idle, 3); cam.dirty = true; sfx('boing');
}
function hitAvatar(px, py) {
  if (!AVS.length) return null;
  const eyeOn = cam.mode === 'eye', list = AVS.filter(a => !(eyeOn && me && a.id === me.uid));   // 目線のあいだ、自分の体（隠している）にはあたらない
  const hits = rayAt(px, py).intersectObjects(list.map(a => a.g), true);
  for (const h of hits) { let o = h.object; while (o && !list.some(a => a.g === o)) o = o.parent; if (o) return { a: list.find(a => a.g === o), dist: h.distance }; }
  return null;
}
// ===== 自分の目線（scene.js の eye）=====
// 自分の me- の目の高さから部屋を見わたす。体は隠す（映りこまない）。歩く・タップは今までどおり
const EYE_Y = 1.05;   // 目の高さ（からだの高さの倍率 a.g.userData.h をかける）
let eyeLast = null;
const eyeMe = () => (me && AVS.find(a => a.id === me.uid)) || null;
function eyeFeedNow() {
  const a = eyeMe(); if (!a) return null;
  const fx = E.fxG.position, snap = !eyeLast || eyeLast.room !== S.cur.room || Math.hypot(a.x - eyeLast.x, a.y - eyeLast.y) > 2.5;   // 部屋が変わった・ワープしたときは、位置をなめらかに追わずに合わせる
  eyeLast = { x: a.x, y: a.y, room: S.cur.room };
  const rm = room(), gb = blk(), f = { out: a.x < 0 || a.y < 0 || a.x >= rm.w || a.y >= rm.d, x: fx.x + a.x, y: EYE_Y * (a.g.userData.h || 1) + groundY(gb.door ? gb : null, rm, a.x, a.y), z: fx.z + a.y, ry: a.ry, hd: a.hd == null ? null : a.hd, moving: !!a.moving && (a.v || 0) > .4, amp: a.amp || 0, ph: a.ph || 0, snap };
  eyeFeed(f); return f;
}
// 毎フレーム：目線の位置を渡し、自分の体を隠す／戻す
function eyeSelf() {
  const act = cam.mode === 'eye' || !!EYE.tr; if (act) eyeFeedNow();
  const a = eyeMe(); if (!a) return;
  const hide = act && eyeHidden(); if (hide || a.eyeH) { if (eyeBody(a.g, hide)) cam.dirty = true; a.eyeH = hide; }   // 体はカメラに映らないレイヤーへ移す（visible のままなので、足もとの影は落ちる）
}
function enterEyeMode() {
  if (!T || !me || cam.mode === 'eye') return;
  if (!eyeMe()) { toast('目線にできる me- がいません', 'ng'); return; }
  if (ghost) cancelGhost(); if (multi) exitMulti(); if (selUid) setSel(null);
  eyeLast = null; if (enterEye(eyeFeedNow())) { paintCam(); holdAvatars(); }
}
function exitEyeMode(to) { if (exitEye(to)) { paintCam(); holdAvatars(); } }
function toggleEye() { if (cam.mode === 'eye') exitEyeMode(); else enterEyeMode(); paintCam(); }
// 目線のとき、床をタップするとそこへ歩く（家具・壁・ほかの部屋はさわらない）
function eyeTap(x, y) {
  const av = hitAvatar(x, y); if (av) { reactAvatar(av.a); return; }
  if (lrayAt(x, y).ray.direction.y > -.02) return;   // 水平より上は歩かない
  const c = floorCell(x, y); if (c) walkTo(c[0], c[1]);
}
// ===== 3Dワールド =====
const objs = new Map();
let needSync = true, lightList = [], lightOther = [], anims = [], hiG = null, hiArrow = null, hiBase = 0, ghostG = null;
const invalidate = () => { needSync = true; cam.dirty = true; };
function placeObj(g, i, d, rm) {
  rm = rm || room();
  if (i.wall) {
    if (i.wall === 'L') { g.position.set(0, i.z, i.pos + d.w); g.rotation.y = Math.PI / 2; } else { g.position.set(i.pos, i.z, 0); g.rotation.y = 0; }
    if (doorBehind(rm, i, d)) { if (i.wall === 'L') g.position.x += DOOR_OFF; else g.position.z += DOOR_OFF; }   // ドアに掛けた物は、ドアの手前に
  } else {
    const [w, dd] = dims(d, i.rot); let y = 0;
    if (d.small) { const host = hostAt(rm.items, i.x, i.y); if (host) y = surfZ(ITEM[host.id]); }
    g.position.set(i.x + w / 2, y, i.y + dd / 2); g.rotation.y = rotY(i.rot);
  }
}
// 壁かけが入口・壁なしの所にかかっていないか（かかっていれば隠す）
// 壁かけの壁（L / R）が今は腰の高さ（カメラの向きで手前になっている）なら、壁かけを隠す
const wallOn = w => !E.wallTall || E.wallTall[w] !== false;
let seenWallVer = -1;
function applyWallVis() {
  E.itemsG.children.forEach(g => { if (g.userData.wside) g.visible = !g.userData.gapHide && wallOn(g.userData.wside); });
  E.othersG.children.forEach(grp => grp.children.forEach(g => { if (g.userData.wside) g.visible = wallOn(g.userData.wside); }));
}
const inGap = (gaps, i, d) => (gaps[i.wall] || []).some(([g0, g1]) => i.pos < g1 - .001 && g0 < i.pos + d.w - .001);
function sync() {
  needSync = false;
  while (E.itemsG.children.length) E.itemsG.remove(E.itemsG.children[0]);
  while (E.othersG.children.length) E.othersG.remove(E.othersG.children[0]);
  objs.clear(); anims = []; PLAY.reset(); PLAY.setScope(T && T.id, !TESTQ && !DEMOQ, SV.on); lightOther = []; const ls = [], cur = S.cur.room;
  const gaps = wallGaps(T.rooms, T.open, cur);
  room().items.forEach(i => {
    const d = ITEM[i.id]; const g = buildItem(d); g.userData.uid = i.uid; placeObj(g, i, d);
    if (i.wall) { g.userData.wside = i.wall; g.userData.gapHide = inGap(gaps, i, d); g.visible = !g.userData.gapHide && wallOn(i.wall); }
    E.itemsG.add(g); objs.set(i.uid, g); if (g.userData.anim) anims.push(g); PLAY.attach(i.uid, g, d);
  });
  E.itemsG.updateMatrixWorld(true);
  objs.forEach(g => { const l = g.userData.light; if (l && g.visible && g.userData.lit !== false) ls.push({ pos: g.localToWorld(new THREE.Vector3(l.x, l.y, l.z)), color: l.color, intensity: l.intensity, dist: l.dist, flicker: l.flicker }); });
  ls.sort((a, b) => b.intensity - a.intensity);
  // ほかの部屋の家具（選べない。タップするとその部屋に移る）。腰の壁になる所の壁かけは隠す
  T.rooms.forEach((rm, ri) => {
    if (ri === cur) return;
    const grp = new THREE.Group(); grp.position.set(rm.x, 0, rm.z); grp.userData.roomIdx = ri; const og = wallGaps(T.rooms, T.open, ri), lo = [];
    rm.items.forEach(i => {
      const d = ITEM[i.id]; if (!d) return;
      if (i.wall && (!wallAllOuter(T.rooms, ri, i.wall, i.pos, d.w) || inGap(og, i, d))) return;
      const g = buildItem(d); placeObj(g, i, d, rm); if (i.wall) { g.userData.wside = i.wall; g.visible = wallOn(i.wall); } grp.add(g); if (g.userData.anim) anims.push(g);
    });
    E.othersG.add(grp); grp.updateMatrixWorld(true);
    grp.children.forEach(g => { const l = g.userData.light; if (l) lo.push({ pos: g.localToWorld(new THREE.Vector3(l.x, l.y, l.z)), color: l.color, intensity: l.intensity * .8, dist: l.dist, flicker: l.flicker }); });
    lo.sort((a, b) => b.intensity - a.intensity); lightOther.push(...lo.slice(0, 2)); ls.push(...lo.slice(0, 2));
  });
  lightList = ls; setPointLights(ls);
  buildHi(); cam.dirty = true; setCurtainDim(PLAY.dimK()); updateScore();
}
// 灯りをつけ消ししたとき：この部屋の灯りの一覧だけ組み直す（部屋ぜんたいは作り直さない）
function relight() {
  const ls = []; E.itemsG.updateMatrixWorld(true);
  objs.forEach(g => { const l = g.userData.light; if (l && g.visible && g.userData.lit !== false) ls.push({ pos: g.localToWorld(new THREE.Vector3(l.x, l.y, l.z)), color: l.color, intensity: l.intensity, dist: l.dist, flicker: l.flicker }); });
  ls.sort((a, b) => b.intensity - a.intensity); ls.push(...lightOther); lightList = ls; setPointLights(ls); cam.dirty = true;
}
// 先読みで同じ間取り・同じ部屋を組み立て済みなら、入るときの1回だけ組み立てをとばす（GPU への送り込みをやり直さない）
const houseSig = (t, cur) => JSON.stringify([t.rooms.map(r => [r.x, r.z, r.w, r.d, r.floor, r.wall]), t.open || [], cur]);
let warmHouse = null, reuseHouse = false;
function rebuildRoom() { if (reuseHouse) { reuseHouse = false; cam.h = 0; } else { warmHouse = null; buildHouse(T.rooms, T.open || [], S.cur.room); } setNight(!!room().dark); paintLight(); invalidate(); }
// 選択ハイライト
const hiMat = new THREE.MeshBasicMaterial({ color: 0xff6b6b, transparent: true, opacity: .3, depthWrite: false, side: THREE.DoubleSide });
const multiMat = new THREE.MeshBasicMaterial({ color: 0x2fb88e, transparent: true, opacity: .38, depthWrite: false, side: THREE.DoubleSide });
const boxMat = new THREE.MeshBasicMaterial({ color: 0x8fd3c0, transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide });
const arrowMat = new THREE.MeshBasicMaterial({ color: 0xff5252 });
function floorHi(i, mat) {
  const d = ITEM[i.id], r = rectOf(i); let z = 0; if (d.small) { const host = hostAt(room().items, i.x, i.y); if (host) z = surfZ(ITEM[host.id]); }
  const p = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.y1 - r.y0), mat); p.rotation.x = -Math.PI / 2; p.position.set((r.x0 + r.x1) / 2, z + .03, (r.y0 + r.y1) / 2); hiG.add(p);
  return { r, z };
}
function buildHi() {
  if (!hiG) { hiG = new THREE.Group(); E.fxG.add(hiG); }
  hiG.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  while (hiG.children.length) hiG.remove(hiG.children[0]);
  hiArrow = null;
  if (multi) {   // まとめて選ぶ：選んだ物すべてに緑の印、なぞり中は範囲を表示
    room().items.forEach(i => { if (multi.sel.has(i.uid)) floorHi(i, multiMat); });
    const dr = multi.drag; if (dr && dr.kind === 'box' && dr.moved) { const b = boxRect(dr), p = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(.01, b.x1 - b.x0), Math.max(.01, b.y1 - b.y0)), boxMat); p.rotation.x = -Math.PI / 2; p.position.set((b.x0 + b.x1) / 2, .05, (b.y0 + b.y1) / 2); hiG.add(p); }
    return;
  }
  const i = selItem(); if (!i || ghost) return;
  const d = ITEM[i.id];
  if (i.wall) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(d.w + .1, d.h + .1), hiMat); const wg = new THREE.Group(); p.position.set(d.w / 2, d.h / 2, .08); wg.add(p); placeObj(wg, i, d); hiG.add(wg);
  } else {
    const { r, z } = floorHi(i, hiMat);
    const a = new THREE.Mesh(new THREE.ConeGeometry(.16, .3, 4), arrowMat); a.rotation.x = Math.PI; hiBase = z + (d.ceil ? 1.2 : d.h) + .4; a.position.set((r.x0 + r.x1) / 2, hiBase, (r.y0 + r.y1) / 2); hiG.add(a); hiArrow = a;
  }
}
// ===== 電気（部屋ごとにオン・オフ）=====
const setTl = (b, t) => { const e = b.querySelector('.tl'); if (e) e.textContent = t; else b.textContent = t; };
function paintLight() { const b = $('btnLight'); if (!b || !T) return; const dk = !!room().dark; setTl(b, dk ? '電気をつける' : '電気を消す'); b.title = (dk ? '電気をつける' : '電気を消す') + ' (L)'; b.classList.toggle('on', dk); }
function toggleLight() { const rm = room(); rm.dark = !rm.dark; setNight(rm.dark); sfx('tap'); toast(rm.dark ? '電気を消しました' : '電気をつけました', '', 'light'); paintLight(); invalidate(); save(); }
// ===== カメラの向き（斜め・真上・左の壁・右の壁）=====
function paintCam() { document.querySelectorAll('#camModes .btn').forEach(b => b.classList.toggle('on', b.dataset.m === cam.mode)); const on = cam.mode === 'eye'; $('stage').classList.toggle('eyeOn', on); document.body.classList.toggle('eyeOn', on); $('eyeExit').hidden = !on; railFit(); }
// ===== まとめて選ぶ：さわって選ぶ／なぞって範囲で選ぶ／選んだ物をドラッグでまとめて移動 =====
let multi = null;   // { sel: Set(uid), drag: null | {kind:'box',...} | {kind:'move',...} }
function setMultiBtn() { const b = $('btnMulti'); if (b) b.classList.toggle('on', !!multi); }
function enterMulti() {
  if (cam.mode === 'eye') return;   // 目線のあいだは、まとめて選べない
  if (ghost) cancelGhost(); selUid = null; multi = { sel: new Set(), drag: null };
  setMultiBtn(); renderBar(); buildHi(); cam.dirty = true; sfx('tap'); toast('なぞって選び、ドラッグでまとめて動かせます');
}
function exitMulti() { if (!multi) return; cancelDrag(); multi = null; setMultiBtn(); renderBar(); buildHi(); cam.dirty = true; }
const multiItems = () => room().items.filter(i => multi.sel.has(i.uid));
function toggleMultiSel(i) {
  if (!isFloor(i)) { toast('壁かけはまとめて選べません', 'ng'); sfx('ng'); return; }
  if (multi.sel.has(i.uid)) multi.sel.delete(i.uid); else multi.sel.add(i.uid);
  sfx('tap'); renderBar(); buildHi(); cam.dirty = true;
}
function boxRect(b) {
  const r = room(), cx = v => Math.max(0, Math.min(r.w, v)), cy = v => Math.max(0, Math.min(r.d, v));
  return { x0: cx(Math.floor(Math.min(b.f0[0], b.f1[0]))), y0: cy(Math.floor(Math.min(b.f0[1], b.f1[1]))), x1: cx(Math.floor(Math.max(b.f0[0], b.f1[0])) + 1), y1: cy(Math.floor(Math.max(b.f0[1], b.f1[1])) + 1) };
}
function startDrag(x, y) {
  const f = floorAt(x, y, 0), hit = hitTest(x, y);
  if (hit && multi.sel.has(hit.uid)) {
    const rm = room(), set = new Set(multi.sel);
    multiItems().forEach(i => { if (isBig(i)) topsOf(rm, i).forEach(t => set.add(t.uid)); });   // 上にのっている小物もいっしょに
    const its = rm.items.filter(i => set.has(i.uid) && isFloor(i));
    multi.drag = { kind: 'move', f0: f, dx: 0, dy: 0, its, orig: its.map(i => [i.x, i.y]), set };
  } else multi.drag = { kind: 'box', f0: f, f1: f, moved: false };
}
// まとめて dx,dy ずらしても全部置けるか（家具→小物→ラグの順に確かめる）
function groupFits(dr, dx, dy) {
  const rm = room(), tmp = Object.assign({}, rm, { items: rm.items.filter(i => !dr.set.has(i.uid)) });
  const ord = i => { const d = ITEM[i.id]; return d.cat === 'rug' ? 2 : d.small ? 1 : 0; };
  const list = dr.its.map((i, k) => [i, dr.orig[k]]).sort((a, b) => ord(a[0]) - ord(b[0]));
  for (const [i, o] of list) {
    const c = Object.assign({}, i, { x: o[0] + dx, y: o[1] + dy });
    if (!placeCheck(tmp, ITEM[i.id], c.x, c.y, i.rot, -1).ok) return false;
    tmp.items.push(c);
  }
  return true;
}
function dragMove(x, y) {
  const dr = multi.drag, f = floorAt(x, y, 0);
  if (dr.kind === 'box') { dr.f1 = f; dr.moved = true; buildHi(); cam.dirty = true; return; }
  const dx = Math.round(f[0] - dr.f0[0]), dy = Math.round(f[1] - dr.f0[1]);
  if (dx === dr.dx && dy === dr.dy) return;
  if (!groupFits(dr, dx, dy)) return;   // 置けない位置には動かない（最後に置けた位置で止まる）
  dr.dx = dx; dr.dy = dy; dr.its.forEach((i, k) => { i.x = dr.orig[k][0] + dx; i.y = dr.orig[k][1] + dy; });
  sfx('tap'); invalidate();
}
function endDrag() {
  const dr = multi && multi.drag; if (!dr) return; multi.drag = null;
  if (dr.kind === 'box') {
    if (dr.moved) { const b = boxRect(dr); let k = 0; room().items.forEach(i => { if (isFloor(i) && ovl(rectOf(i), b)) { multi.sel.add(i.uid); k++; } }); if (k) sfx('tap'); renderBar(); }
    buildHi(); cam.dirty = true; return;
  }
  if (dr.dx || dr.dy) { sfx('place'); fixAvatar(); save(); }
  buildHi(); cam.dirty = true;
}
function cancelDrag() { const dr = multi && multi.drag; if (!dr) return; if (dr.kind === 'move') endDrag(); else { multi.drag = null; buildHi(); cam.dirty = true; } }
// まとめてしまう：しまえるのは自分が買った物だけ（担任助手モード中はぜんぶ）。番号は1回だけ確かめる
async function multiStow() {
  const all = multiItems(), its = all.filter(canRemove), skip = all.length - its.length; if (!all.length) return;
  if (!its.length) { toast('ほかの人が買った物はしまえません', 'ng'); sfx('ng'); return; }
  if (!await confirmDlg(its.length + '個を持ち物にしまいますか？（上にのっている物は持ち主にもどります）' + (skip ? '\nほかの人が買った ' + skip + '個 はそのままです。' : ''), 'しまう')) return;
  if (!await requirePin()) return;
  const rm = room(); let k = 0; its.forEach(i => { if (rm.items.includes(i)) { stowItem(i, true); multi.sel.delete(i.uid); k++; } });
  toast(k + '個をしまいました', 'ok'); sfx('place'); fixAvatar(); save(); renderBar(); renderPanel(); buildHi();
}
// 配置ゴースト
const gmats = new Map();
function ghostMat(m, ok) {
  const k = m.uuid + ok; let c = gmats.get(k);
  if (!c) { c = m.clone(); c.transparent = true; c.opacity = .62; c.depthWrite = false; if (c.emissive) { c.emissive = new THREE.Color(ok ? 0x2fbf80 : 0xe03030); c.emissiveIntensity = ok ? 0 : .6; c.emissiveMap = null; } gmats.set(k, c); }
  return c;
}
function ghostify(g, ok) { g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.material = Array.isArray(o.material) ? o.material.map(m => ghostMat(m, ok)) : ghostMat(o.material, ok); } }); }
function buildGhost() {
  if (!ghostG) { ghostG = new THREE.Group(); E.fxG.add(ghostG); }
  ghostG.traverse(o => { if (o.isMesh && o.userData.own) o.geometry.dispose(); });
  while (ghostG.children.length) ghostG.remove(ghostG.children[0]);
  cam.dirty = true; if (!ghost || ghost.x == null && !ghost.def.wall) return;
  const g = ghost, d = g.def, ok = g.ok, col = ok ? 0x50c88c : 0xeb5050;
  const ov = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .42, depthWrite: false, side: THREE.DoubleSide });
  const model = buildItem(d); ghostify(model, ok);
  if (d.wall) {
    const wg = new THREE.Group(); wg.add(model); const p = new THREE.Mesh(new THREE.PlaneGeometry(d.w, d.h), ov); p.position.set(d.w / 2, d.h / 2, .1); p.userData.own = true; wg.add(p);
    placeObj(wg, { wall: g.wall, pos: g.pos, z: g.z }, d); ghostG.add(wg);
  } else {
    const [w, dd] = dims(d, g.rot), z = g.z || 0;
    if (g.vcx == null) { g.vcx = g.x + w / 2; g.vcy = g.y + dd / 2; } if (g.va == null) g.va = rotY(g.rot);
    model.position.set(g.vcx, z, g.vcy); model.rotation.y = g.va; ghostG.add(model); g.mdl = model;   // マス目の板は出さない（なめらかに動く見た目の位置は vcx・vcy・va）
  }
}
// ===== サムネイル =====
const iconCache = new Map(); let thumb = null; const thumbQ = [];
function thumbInit() {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setSize(112, 112, false);   // 表示の大きさは img の width/height（CSS）で決まる。中身だけ細かく
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.2; r.setClearColor(0x000000, 0);
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xfff0dc, 0x8a6240, .5)); { const pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; sc.environmentIntensity = .7; pm.dispose(); } const dl = new THREE.DirectionalLight(0xffe0b0, 2.2); dl.position.set(3, 6, 4); sc.add(dl);
  thumb = { r, sc, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 200) };
}
function renderThumb(d) {
  if (!thumb) thumbInit();
  const { r, sc, cam: c } = thumb, m = buildItem(d); m.userData.anim = null; sc.add(m); m.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(m), ctr = bb.getCenter(new THREE.Vector3()), yaw = d.wall ? .45 : Math.PI / 4, pitch = d.wall ? .2 : .55;
  c.position.set(ctr.x + Math.sin(yaw) * Math.cos(pitch) * 20, ctr.y + Math.sin(pitch) * 20, ctr.z + Math.cos(yaw) * Math.cos(pitch) * 20); c.up.set(0, 1, 0); c.lookAt(ctr); c.updateMatrixWorld(true);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const v = new THREE.Vector3();
  for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z]) { v.set(X, Y, Z).applyMatrix4(c.matrixWorldInverse); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  const hh = Math.max(x1 - x0, y1 - y0) / 2 * 1.12, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  c.left = cx - hh; c.right = cx + hh; c.top = cy + hh; c.bottom = cy - hh; c.updateProjectionMatrix();
  r.render(sc, c); const url = r.domElement.toDataURL('image/png'); sc.remove(m); return url;
}
function swatchUrl(d, size) { const k = d.id + '@' + size; let u = iconCache.get(k); if (!u) { u = swatchCanvas(d, size).toDataURL(); iconCache.set(k, u); } return u; }
function makeIcon(d, size) { return swatchUrl(d, size); }
// 壁紙・床の見本：作っておいた物はすぐ、まだなら順番待ちに入れて少しずつ作る（一覧を開く間じゅう固まらないように）
function patIcon(d, img, size) {
  const u = iconCache.get(d.id + '@' + size); if (u) { img.src = u; return; }
  thumbQ.push([d, img, size]); if (thumbQ.length === 1) setTimeout(pumpThumbs, 0);
}
function itemIcon(d, img) {
  const u = iconCache.get(d.id); if (u) { img.src = u; return; }
  thumbQ.push([d, img]); if (thumbQ.length === 1) setTimeout(pumpThumbs, 0);
}
function pumpThumbs() {
  const t0 = performance.now();
  while (thumbQ.length && performance.now() - t0 < 24) {
    // 画面に出ている絵を先に描く（ならびかえ・カテゴリを変えると、前の一覧の絵が列に残っていて、上の品がしばらく空白になるため）
    let qi = thumbQ.findIndex(([, im]) => im.isConnected); if (qi < 0) qi = 0;
    const [d, img, sz] = thumbQ.splice(qi, 1)[0];
    if (sz) { img.src = swatchUrl(d, sz); continue; }
    let u = iconCache.get(d.id); if (!u) { try { u = renderThumb(d); } catch (e) { u = ''; console.error('thumb', d.id, e); } iconCache.set(d.id, u); }
    img.src = u;
  }
  if (thumbQ.length) setTimeout(pumpThumbs, 0);
}
// ===== ホームのチーミカード用：家の小さな絵（斜め視点で1回だけ描いてキャッシュ）=====
const houseCache = new Map(); let hth = null; const houseQ = [];
function houseThumbInit() {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setSize(360, 250, false);
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1; r.setClearColor(0x000000, 0);
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xfff0dc, 0x8a6240, .75)); { const pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; sc.environmentIntensity = .6; pm.dispose(); }
  const dl = new THREE.DirectionalLight(0xffe6c0, 1.6); dl.position.set(6, 10, 8); sc.add(dl);
  hth = { r, sc, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 300) };
}
function houseKey(t) { return [t.id, JSON.stringify(t.open || []), t.rooms.map(rm => [rm.x, rm.z, rm.w, rm.d, rm.wall, rm.floor, rm.items.map(i => i.id + i.x + i.y + (i.rot || 0) + (i.wall || '') + (i.pos || '')).join()].join(':')).join('|')].join('|'); }
// W×HH：絵の大きさ（ふだんは 360×250。掲示用は横2000px）。focus：その部屋だけに寄る（部屋の番号。-1 は全体）
function renderHouse(t, W = 360, HH = 250, focus = -1) {
  if (!hth) houseThumbInit();
  const { r, sc, cam: c } = hth, roomGrp = [], rooms = migrateRooms(t.rooms, t.size0), grp = new THREE.Group(), box = houseBox(rooms), H = 2.6, CUT = 1.1;
  const col = id => new THREE.Color((ITEM[id] || {}).color || '#e8d3ae');
  const mats = rooms.map(rm => ({ f: new THREE.MeshStandardMaterial({ color: col(rm.floor), roughness: .9 }), w: new THREE.MeshStandardMaterial({ color: col(rm.wall), roughness: 1 }) }));
  rooms.forEach((rm, i) => {
    const rg = new THREE.Group(); roomGrp.push(rg); grp.add(rg);
    const fl = new THREE.Mesh(new THREE.BoxGeometry(rm.w, .3, rm.d), mats[i].f); fl.position.set(rm.x + rm.w / 2, -.15, rm.z + rm.d / 2); rg.add(fl);
    rm.items.forEach(it => {
      const d = ITEM[it.id]; if (!d || it.wall) return;
      try { const g = buildItem(d); g.userData.anim = null; const [w, dd] = dims(d, it.rot); g.position.set(rm.x + it.x + w / 2, 0, rm.z + it.y + dd / 2); g.rotation.y = rotY(it.rot); rg.add(g); } catch (e) { /* 1つ作れなくても続ける */ }
    });
  });
  wallPlan(rooms, t.open || []).forEach(sg => {
    if (sg.kind === 'door') return;
    const full = sg.kind === 'out' && (sg.side === 'l' || sg.side === 't'), h = full ? H : CUT, len = sg.a1 - sg.a0, ri = sg.kind === 'out' || sg.kind === 'ent' ? sg.room : sg.hi;
    const th = sg.kind === 'out' ? .22 : .16, off = sg.kind === 'out' && (sg.side === 'r' || sg.side === 'b') ? th / 2 : -th / 2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(sg.ax === 'z' ? th : len, h, sg.ax === 'z' ? len : th), mats[ri].w);
    m.position.set(sg.ax === 'z' ? sg.pos + off : (sg.a0 + sg.a1) / 2, h / 2, sg.ax === 'z' ? (sg.a0 + sg.a1) / 2 : sg.pos + off); grp.add(m);
  });
  sc.add(grp); grp.updateMatrixWorld(true);
  const ctr = new THREE.Vector3((box.x0 + box.x1) / 2, H * .35, (box.z0 + box.z1) / 2), yaw = Math.PI / 4, pitch = .62;
  c.position.set(ctr.x + Math.sin(yaw) * Math.cos(pitch) * 60, ctr.y + Math.sin(pitch) * 60, ctr.z + Math.cos(yaw) * Math.cos(pitch) * 60); c.up.set(0, 1, 0); c.lookAt(ctr); c.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(focus >= 0 && roomGrp[focus] ? roomGrp[focus] : grp); if (focus >= 0) bb.max.y = Math.max(bb.max.y, CUT); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const v = new THREE.Vector3();
  for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z]) { v.set(X, Y, Z).applyMatrix4(c.matrixWorldInverse); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  const asp = W / HH, hh = Math.max((x1 - x0) / asp, y1 - y0) / 2 * 1.08, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  c.left = cx - hh * asp; c.right = cx + hh * asp; c.top = cy + hh; c.bottom = cy - hh; c.updateProjectionMatrix();
  const big = W !== 360 || HH !== 250, pr0 = r.getPixelRatio(); if (big) { r.setPixelRatio(1); r.setSize(W, HH, false); }
  r.render(sc, c); const url = r.domElement.toDataURL('image/png'); sc.remove(grp); if (big) { r.setPixelRatio(pr0); r.setSize(360, 250, false); }
  grp.traverse(o => { if (o.geometry) o.geometry.dispose(); }); return url;
}
function houseThumb(t, cb) {
  if (!t || !t.rooms || !t.rooms.length) { cb(''); return; }
  const k = houseKey(t), hit = houseCache.get(k); if (hit) { cb(hit); return; }
  houseQ.push([t, k, cb]); if (houseQ.length === 1) setTimeout(pumpHouses, 30);
}
// 掲示用の大きな家の絵（横2000px）。全体図と、家具がいちばん多い部屋の寄り（部屋が2つ以上のとき）
function houseHi(t) {
  if (!t || !t.rooms || !t.rooms.length) return { full: '', close: '' };
  const rooms = migrateRooms(t.rooms, t.size0); let best = -1, bn = -1; rooms.forEach((rm, i) => { const n = rm.items.length; if (n > bn) { bn = n; best = i; } });
  let full = '', close = '';
  try { full = renderHouse(t, 2000, 1389); } catch (e) { console.error('houseHi', e); }
  if (rooms.length > 1 && bn > 0) { try { close = renderHouse(t, 1400, 1050, best); } catch (e) { console.error('houseHi', e); } }
  return { full, close, room: best };
}
function pumpHouses() {
  const q = houseQ.shift(); if (!q) return; const [t, k, cb] = q;
  let u = houseCache.get(k); if (!u) { try { u = renderHouse(t); } catch (e) { u = ''; console.error('houseThumb', e); } houseCache.set(k, u); }
  cb(u); if (houseQ.length) setTimeout(pumpHouses, 20);
}
// ===== 選択・配置 =====
let selUid = null, ghost = null;
function setSel(u) { selUid = u; renderBar(); buildHi(); cam.dirty = true; }
function startPlace(id, from, orig) {
  if (cam.mode === 'eye') { toast('目線のあいだは置けません。「目線をやめる」を押してからね', 'ng'); sfx('ng'); return; }
  if (multi) exitMulti();
  const d = ITEM[id]; selUid = null;
  ghost = { def: d, id, rot: orig ? orig.rot || 0 : 0, x: null, y: null, ok: false, from, orig, uid: orig ? orig.uid : null };
  if (d.wall) { ghost.wall = orig && orig.wall || 'R'; ghost.pos = orig ? orig.pos : 1; ghost.z = orig ? orig.z : (d.zb != null ? d.zb : 1.2); evalGhost(); }
  else { const [w, dd] = dims(d, ghost.rot), rm0 = room(); ghost.x = orig ? orig.x : Math.max(0, Math.floor(rm0.w / 2 - w / 2)); ghost.y = orig ? orig.y : Math.max(0, Math.floor(rm0.d / 2 - dd / 2)); evalGhost(); }
  ghost.ang = ghost.va = d.wall ? 0 : rotY(ghost.rot); invalidate(); renderBar(); renderPanel();   // マス目は出さない（置けない所は家具が赤くなる）
}
function evalGhost() {
  const g = ghost, rm = room();
  if (g.def.wall) { const r = wallCheck(rm, g.def, g.wall, g.pos, g.z, g.uid); g.ok = r.ok; g.why = r.why; }
  else { const r = placeCheck(rm, g.def, g.x, g.y, g.rot, g.uid); g.ok = r.ok; g.why = r.why; g.z = r.z || 0; }
  renderBar(); buildGhost();
}
const snap = (v, s) => Math.round(v / s) * s;
// 今いる部屋のローカル座標で見た視線（itemsG / fxG が部屋の角に置かれているぶんをずらす）
function lrayAt(px, py) { const rc = rayAt(px, py); rc.ray.origin.x -= E.fxG.position.x; rc.ray.origin.z -= E.fxG.position.z; return rc; }
function floorAt(px, py, y) {
  const rc = lrayAt(px, py), o = rc.ray.origin, dr = rc.ray.direction; if (Math.abs(dr.y) < 1e-6) return [-99, -99];
  const t = (y - o.y) / dr.y; return [o.x + dr.x * t, o.z + dr.z * t];
}
function wallAt(px, py) {
  const rc = lrayAt(px, py), o = rc.ray.origin, dr = rc.ray.direction, rm = room(), c = [];
  if (Math.abs(dr.x) > 1e-6) { const t = -o.x / dr.x, y = o.y + dr.y * t, u = o.z + dr.z * t; if (t > 0 && u > -.5 && u < rm.d + .5 && y > -.3 && y < WH + .3) c.push({ t, wall: 'L', u, y }); }
  if (Math.abs(dr.z) > 1e-6) { const t = -o.z / dr.z, y = o.y + dr.y * t, u = o.x + dr.x * t; if (t > 0 && u > -.5 && u < rm.w + .5 && y > -.3 && y < WH + .3) c.push({ t, wall: 'R', u, y }); }
  c.sort((a, b) => a.t - b.t); return c[0] || null;
}
function moveGhost(px, py) {
  const g = ghost; if (!g) return; const d = g.def;
  if (d.wall) {
    const w = wallAt(px, py); if (!w) return; const n = w.wall === 'L' ? room().d : room().w;
    g.wall = w.wall; g.pos = Math.max(0, Math.min(n - d.w, snap(w.u - d.w / 2, .5))); g.z = d.ground ? 0 : Math.max(0, Math.min(WH - d.h, snap(w.y - d.h / 2, .5)));   // ground（ドア）はいつも床に立つ
  } else {
    const [w, dd] = dims(d, g.rot); let f = floorAt(px, py, 0);
    if (d.small) {
      const zs = [...new Set(room().items.filter(i => isBig(i) && ITEM[i.id].surface).map(i => surfZ(ITEM[i.id])))].sort((a, b) => b - a);
      for (const z of zs) { const q = floorAt(px, py, z), host = hostAt(room().items.filter(i => i.uid !== g.uid), Math.floor(q[0]), Math.floor(q[1])); if (host && surfZ(ITEM[host.id]) === z) { f = q; break; } }
    }
    const rm = room(); const sp = d.small ? 1 : .5; g.x = Math.max(0, Math.min(rm.w - w, snap(f[0] - w / 2, sp))); g.y = Math.max(0, Math.min(rm.d - dd, snap(f[1] - dd / 2, sp)));   // 大きい家具は 0.5 マスきざみ（小物は1マス）
  }
  evalGhost();
}
function rotateGhost() {
  if (!ghost || ghost.def.wall) return; ghost.rot = nextRot(ghost.rot); ghost.ang += Math.PI / 2; const [w, dd] = dims(ghost.def, ghost.rot), rm = room();
  ghost.x = Math.max(0, Math.min(rm.w - w, ghost.x)); ghost.y = Math.max(0, Math.min(rm.d - dd, ghost.y)); evalGhost(); sfx('tap');
}
function endGhost() { ghost = null; buildGhost(); invalidate(); }
function confirmGhost() {
  const g = ghost; if (!g) return; if (!g.ok) { toast(g.why || 'ここには置けません', 'ng'); sfx('ng'); return; }
  const rm = room();
  if (g.from === 'inv') { me.inv[g.id] = (me.inv[g.id] || 1) - 1; if (me.inv[g.id] <= 0) delete me.inv[g.id]; if (SV.on) pend.take[g.id] = (pend.take[g.id] || 0) + 1; }
  if (!g.uid) uidN = Math.max(uidN, 1 + T.rooms.reduce((m, r) => r.items.reduce((m2, i) => Math.max(m2, i.uid | 0), m), 0));   // サーバーの家には、ほかの端末が置いた家具の uid がすでにある：数えを追い越してから採番（ぶつかると dup で保存できない）
  const o = g.def.wall ? { uid: g.uid || uidN++, id: g.id, wall: g.wall, pos: g.pos, z: g.z } : { uid: g.uid || uidN++, id: g.id, x: g.x, y: g.y, rot: g.rot };
  const ow = g.from === 'move' ? (g.orig && g.orig.owner) : me.uid; if (ow) o.owner = ow;
  rm.items.push(o); endGhost(); if (g.from === 'inv') dropIn(o, g.def); else { sfx('place'); pops.push({ uid: o.uid, t: 0 }); sparkleItem(o); } toast(g.def.name + 'を置きました', 'ok');
  fixAvatar(); save(); renderBar(); renderPanel();
}
function cancelGhost() {
  if (!ghost) return; const g = ghost; endGhost();
  if (g.from === 'move' && g.orig) room().items.push(g.orig);
  renderBar(); renderPanel(); save();
}
// ===== 置く操作のゲームパッド（十字キー・回す・決定・やめる）=====
// ゴースト（置く前の家具）の見た目の位置を、目標へなめらかに近づける
function stepGhost(dt) {
  const g = ghost; if (!g || g.def.wall || g.x == null || !g.mdl || g.vcx == null) return;
  const [w, dd] = dims(g.def, g.rot), tx = g.x + w / 2, ty = g.y + dd / 2, k = 1 - Math.exp(-(dt || .016) * 22);
  g.vcx += (tx - g.vcx) * k; g.vcy += (ty - g.vcy) * k; g.va += (g.ang - g.va) * k;
  if (Math.abs(tx - g.vcx) + Math.abs(ty - g.vcy) + Math.abs(g.ang - g.va) < .004) { g.vcx = tx; g.vcy = ty; g.va = g.ang; } else cam.dirty = true;
  g.mdl.position.x = g.vcx; g.mdl.position.z = g.vcy; g.mdl.rotation.y = g.va;
}
// 画面の「上」「右」にいちばん近い、部屋のたて・よこの向き（カメラを回しても、ボタンの向きが画面と合う）
function padAxes() {
  const f = new THREE.Vector3(); E.camera.getWorldDirection(f); const q = Math.round(Math.atan2(f.x, -f.z) / (Math.PI / 2)), a = q * Math.PI / 2;
  const ux = Math.round(Math.sin(a)), uz = -Math.round(Math.cos(a)); return { ux, uz, rx: -uz, rz: ux };
}
// dir: 'u' 'd' 'l' 'r'（画面の向き）
function padStep(dir) {
  const g = ghost; if (!g) return; const d = g.def, A = padAxes(), sg = dir === 'u' || dir === 'r' ? 1 : -1, rm = room();
  if (d.wall) {
    const n = g.wall === 'L' ? rm.d : rm.w;
    if (dir === 'u' || dir === 'd') { if (!d.ground) g.z = Math.max(0, Math.min(WH - d.h, g.z + (dir === 'u' ? .5 : -.5))); }
    else { const v = (g.wall === 'L' ? A.rz : A.rx) * sg; if (v) g.pos = Math.max(0, Math.min(n - d.w, g.pos + v * .5)); }
  } else {
    const [w, dd] = dims(d, g.rot), st = d.small ? 1 : .5, vx = dir === 'u' || dir === 'd' ? A.ux : A.rx, vz = dir === 'u' || dir === 'd' ? A.uz : A.rz;
    g.x = Math.max(0, Math.min(rm.w - w, g.x + vx * sg * st)); g.y = Math.max(0, Math.min(rm.d - dd, g.y + vz * sg * st));
  }
  evalGhost(); sfx('tap');
}
function renderPad() {
  const p = $('pad'); if (!p) return; const on = !!ghost; p.hidden = !on; $('stage').classList.toggle('padOn', on); if (!on) return;
  $('pdName').textContent = ghost.def.name; $('pdOk').classList.toggle('ng', !ghost.ok); $('pdRot').hidden = !!ghost.def.wall;
}
(function padInit() {
  const p = $('pad'); if (!p) return; let tm = 0, iv = 0;
  const stop = () => { clearTimeout(tm); clearInterval(iv); tm = iv = 0; };
  p.querySelectorAll('[data-d]').forEach(b => {
    const dir = b.dataset.d;
    b.addEventListener('pointerdown', e => { e.preventDefault(); stop(); try { b.setPointerCapture(e.pointerId); } catch (x) { } padStep(dir); tm = setTimeout(() => { iv = setInterval(() => padStep(dir), 120); }, 380); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => b.addEventListener(t, stop));
    b.addEventListener('click', e => { if (e.detail === 0) padStep(dir); });   // キーボード（Enter・スペース）
    b.addEventListener('contextmenu', e => e.preventDefault());
  });
  $('pdRot').onclick = () => rotateGhost(); $('pdOk').onclick = () => confirmGhost(); $('pdNo').onclick = () => cancelGhost();
})();
function fixAvatar() { const rm = room(), bl = blockedSet(rm); AVS.forEach(a => { if (bl.has(Math.floor(a.x) + ',' + Math.floor(a.y))) { const c = freeCellNear(rm, Math.floor(a.x), Math.floor(a.y), avCells(a)); a.x = c[0] + .5; a.y = c[1] + .5; a.path = []; a.wp = null; a.v = 0; a.res = null; } }); cam.dirty = true; }
function topsOf(rm, host) { return rm.items.filter(t => isFloor(t) && ITEM[t.id].small && ovl(rectOf(t), rectOf(host)) && hostAt(rm.items, t.x, t.y) === host); }
// 持ち主の持ち物にもどす（持ち主がいない家具は、操作した人へ）
function giveInv(owner, id) { const st = (owner && studentById(owner)) || me; st.inv[id] = (st.inv[id] || 0) + 1; if (SV.on) { const g = pend.give[st.uid] = pend.give[st.uid] || {}; g[id] = (g[id] || 0) + 1; } }
const canRemove = i => adminOn || !i.owner || (me && i.owner === me.uid);
// 4桁番号：1回入れたら同じ生徒は5分間そのまま（入れた番号はメモリにだけ置く。サーバー版はRPCの中で確かめる）
// 「この端末に番号を覚えさせる」：自分だけのスマホで、本人が選んだときだけ。{uid, pin} を1人分だけ端末(localStorage)に置く（共用の端末では覚えさせない）
const DPKEY = 'kojoHouse.devpin', DPNO = 'kojoHouse.devpinNo';
const devpinGet = () => { try { const o = JSON.parse(localStorage.getItem(DPKEY) || 'null'); return o && typeof o.uid === 'string' && /^\d{4}$/.test(o.pin) ? o : null; } catch (e) { return null; } };
const devpinSet = (uid, pin) => { try { localStorage.setItem(DPKEY, JSON.stringify({ uid, pin })); } catch (e) { } };
const devpinDrop = () => { try { localStorage.removeItem(DPKEY); } catch (e) { } };
const devpinNoList = () => { try { const a = JSON.parse(localStorage.getItem(DPNO) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
const devpinNoSet = (uid, on) => { try { const a = devpinNoList().filter(x => x !== uid); if (on) a.push(uid); localStorage.setItem(DPNO, JSON.stringify(a)); } catch (e) { } };
const devpinOk = st => !!st && !st.staff && !demoMode && !window.__noPin;
let devpinAsking = false;
async function devpinOffer(st, pin) {   // 番号が通ったあと、まだ聞いていない人にだけ1回たずねる
  if (!devpinOk(st) || !/^\d{4}$/.test(pin || '') || devpinAsking) return;
  const dp = devpinGet(); if (dp && dp.uid === st.uid) { if (dp.pin !== pin) devpinSet(st.uid, pin); return; }
  if (devpinNoList().includes(st.uid)) return;
  devpinAsking = true;
  try { if (await confirmDlg('自分だけが使うスマホなら「覚えさせる」。次からは番号を聞かずに買い物などができます。みんなで使う端末では「覚えさせない」にしてください。', '覚えさせる', 'この端末に番号を覚えさせますか？', '覚えさせない')) devpinSet(st.uid, pin); else devpinNoSet(st.uid, true); } finally { devpinAsking = false; }
}
let pinCache = { uid: null, pin: '', until: 0 };
const pinUntil = { set() { }, get() { return 0; } };
const dropPin = () => { pinCache = { uid: null, pin: '', until: 0 }; devpinDrop(); };   // 番号ちがい・ロック：覚えさせた番号も消す（担任助手が番号をかえたとき用）
async function getPin(noOffer) {
  if (window.__noPin || demoMode || !me) return '';
  if (pinCache.uid === me.uid && pinCache.until > Date.now()) return pinCache.pin;
  const dp = devpinOk(me) ? devpinGet() : null;
  if (dp && dp.uid === me.uid) { if (SV.on || !me.pin || checkPin(me, dp.pin)) { pinCache = { uid: me.uid, pin: dp.pin, until: Date.now() + 300000 }; return dp.pin; } devpinDrop(); }
  let v = null;
  if (SV.on) v = await verifyOrSetPin(me);
  else if (!me.pin) { const np = await pinSet({ face: faceImg(me.me, 'face', 'face'), who: nickOf(me) }); if (np) { me.pin = pinHash(np, me.uid); save(); v = np; } }
  else {
    let k = 0;
    for (; k < 3; k++) {
      const x = await pinPad('4けたの番号を入力', k ? '違います。もう一度' : 'ピコが動くので確認します', { face: faceImg(me.me, 'face', 'face'), who: nickOf(me) });
      if (x == null) break; if (checkPin(me, x)) { v = x; break; } sfx('ng');
    }
    if (k >= 3) toast('番号が違います。担任助手に聞いてください', 'ng');
  }
  if (v !== null) { pinCache = { uid: me.uid, pin: v, until: Date.now() + 300000 }; if (!noOffer) await devpinOffer(me, v); }
  return v;
}
const requirePin = async () => (await getPin()) !== null;
// しまう・売る：持ち主だけ（担任助手モード中は可）。自分のものは番号を確かめる
async function gate(i) {
  if (!canRemove(i)) { toast(nickOf(studentById(i.owner)) + 'の物なので動かせません', 'ng'); sfx('ng'); return false; }
  if (adminOn && i.owner && i.owner !== me.uid) return true;
  return requirePin();
}
function payTo(owner, v, itemId) { const st = (owner && studentById(owner)) || me; if (SV.on) pend.sell.push({ uid: st.uid, item: itemId }); if (st === me) addPts(v); else st.picos += v; }
function stowItem(i, silent) {
  const rm = room(), d = ITEM[i.id];
  if (isBig(i)) topsOf(rm, i).forEach(t => { rm.items.splice(rm.items.indexOf(t), 1); giveInv(t.owner, t.id); });
  rm.items.splice(rm.items.indexOf(i), 1); giveInv(i.owner, i.id); if (!silent) toast(d.name + 'をしまいました', 'ok'); invalidate();
}
function selItem() { return room().items.find(i => i.uid === selUid); }
function actMove() { const i = selItem(); if (!i) return; const rm = room(); const hadTops = isBig(i) && topsOf(rm, i).length; if (hadTops) topsOf(rm, i).forEach(t => stowItem(t, true)); rm.items.splice(rm.items.indexOf(i), 1); if (hadTops) toast('上の物は持ち物にしまいました'); startPlace(i.id, 'move', Object.assign({}, i)); }
function actRot() {
  const i = selItem(); if (!i) return; const rot = nextRot(i.rot), r = placeCheck(room(), ITEM[i.id], i.x, i.y, rot, i.uid);
  if (!r.ok) { // 範囲内にずらして再判定
    const d = ITEM[i.id], [w, dd] = dims(d, rot), rm1 = room(); const nx = Math.min(i.x, rm1.w - w), ny = Math.min(i.y, rm1.d - dd), r2 = placeCheck(room(), d, nx, ny, rot, i.uid);
    if (r2.ok && !(isBig(i) && topsOf(room(), i).length)) { i.x = nx; i.y = ny; i.rot = rot; sfx('boing'); pops.push({ uid: i.uid, t: 0 }); save(); invalidate(); buildHi(); return; }
    toast('回転できません', 'ng'); sfx('ng'); return;
  }
  if (isBig(i) && topsOf(room(), i).length) { toast('上の物をどけてください', 'ng'); sfx('ng'); return; }
  i.rot = rot; sfx('boing'); pops.push({ uid: i.uid, t: 0 }); save(); invalidate();
}
async function actStow() { const i = selItem(); if (!i) return; if (!await gate(i)) return; sparkleItem(i); stowItem(i); setSel(null); sfx('place'); fixAvatar(); save(); renderPanel(); }
async function actSell() {
  const i = selItem(); if (!i) return; const d = ITEM[i.id], v = Math.floor(priceOf(d) * CFG.SELL_RATE);
  if (d.ltd) { toast('非売品は売れません（しまうことはできます）', 'ng'); sfx('ng'); return; }
  if (await confirmDlg(d.name + 'を ' + fmt(v) + ' ピコで売りますか？（上に置いたものは持ち主の持ち物に戻ります）', '売る')) {
    if (!await gate(i)) return;
    const rm = room(); if (isBig(i)) topsOf(rm, i).forEach(t => stowItem(t, true));
    rm.items.splice(rm.items.indexOf(i), 1); payTo(i.owner, v, i.id); sfx('coin'); toast(d.name + 'を売って +' + fmt(v) + ' ピコ', 'ok'); setSel(null); invalidate(); save(); renderPanel();
  }
}
// ===== さわって遊ぶ（家具の「使う」）=====
// 品物ごとの動きは js/play_rigs.js、状態と補間は js/play.js。ここは、画面とのつなぎだけ。状態はこの端末に保存（ほかの人の画面には、まだ出ない）
const achSfx = k => { if (k === 'ach') sfx('ach'); };
function sparkleGroup(g) { try { const c = new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3()), p = project(c), r = cv.getBoundingClientRect(); sparkleAt(r.left + p[0], r.top + p[1]); } catch (e) { } }
PLAY.init({
  tone: (f, t0, dur, type, vol) => { if (S.sound) tone(f, t0, dur, type, vol); },
  sweep: (f0, f1, dur, type, vol) => { if (S.sound) sweep(f0, f1, dur, type, vol); },
  sparkle: sparkleGroup, relight, roomLight: () => { if (T && me) toggleLight(); },
  get: uid => { const i = findItem(uid); return i ? (i.s === 1 ? 1 : i.s === 0 ? 0 : undefined) : undefined; },
  put: (uid, v, def) => {   // 状態は家のデータの品物の s に持つ（はじめの状態なら持たない）。レイアウトや値段の計算には入らない。見ているだけの人は保存しない
    if (!SV.on || !me || me.watch) return; const i = findItem(uid); if (!i) return;
    if (v === def) delete i.s; else i.s = v;
    pendS[uid] = v; commitSoon();
  },
  used: rig => { if (me && me.uid && rig.ach) JOY.played(me.uid, rig.ach, achSfx); cam.dirty = true; }
});
const findItem = uid => { if (!T) return null; for (const rm of T.rooms) { const i = rm.items.find(x => String(x.uid) === String(uid)); if (i) return i; } return null; };
let pendS = {}, sRetry = 0;
// 状態（s）を除いた間取りの比べ：開け閉めだけでは「家が変わった」扱いにせず、家全体を作り直さない
const roomsKey = r => JSON.stringify(r, (k, v) => k === 's' ? undefined : v);
const lastKey = () => { try { return lastRoomsJson ? roomsKey(JSON.parse(lastRoomsJson)) : ''; } catch (e) { return ''; } };
// サーバーの状態を、いまの部屋の品物にだけなめらかに当てはめる（部品だけ動く）
function applyStates() { if (!T) return; let any = false; room().items.forEach(i => { if (PLAY.setTo(i.uid, i.s === 1 ? 1 : i.s === 0 ? 0 : undefined)) any = true; }); if (any) { cam.dirty = true; renderBar(); } }
function actUse() {
  const i = selItem(); if (!i) return; const r = PLAY.use(i.uid, performance.now() / 1000); if (!r) return;
  cam.dirty = true; renderBar();
}
// ===== ドーパミン：買った品が空から落ちてきて、ポンと弾む。ランク・値段で演出が豪華になる =====
let drops = [];
const landSfx = t => { sfx('thud'); if (t >= 1) setTimeout(() => sfx('coin'), 120); if (t === 2) setTimeout(() => sfx('rank'), 220); if (t >= 3) setTimeout(() => sfx('gx_win3'), 220); };
function itemRect(g) { try { const c = new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3()), p = project(c), r = cv.getBoundingClientRect(); return { left: r.left + p[0] - 30, top: r.top + p[1] - 30, width: 60, height: 60 }; } catch (e) { return null; } }
function dropIn(o, d) {
  const tier = JOY.tierOf(d, priceOf(d)); if (me && me.uid) JOY.placed(me.uid, d, tier, achSfx);
  if (!motionOK()) { sfx('place'); pops.push({ uid: o.uid, t: 0 }); return; }
  drops.push({ uid: o.uid, tier, t: 0, H: d.wall ? .5 : 2.6 + tier * .5, tf: d.wall ? .22 : .42 + tier * .03, landed: false, w: 0 }); cam.dirty = true;
}
function stepDrops(dt) {
  if (!drops.length) return; cam.dirty = true;
  drops = drops.filter(p => {
    const g = objs.get(p.uid); if (!g) { p.w += dt; return p.w < .6; }
    if (g.userData.by == null) g.userData.by = g.position.y; p.t += dt; const t = p.t, by = g.userData.by; let y = 0, sy = 1;
    if (t < p.tf) y = p.H * (1 - Math.pow(t / p.tf, 2));
    else {
      const u = t - p.tf;
      if (!p.landed) { p.landed = true; JOY.landFx(p.tier, itemRect(g), $('ptsBox'), landSfx); if (p.tier >= 2 && cv.animate) cv.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-5px,3px)' }, { transform: 'translate(4px,-3px)' }, { transform: 'translate(-2px,1px)' }, { transform: 'translate(0,0)' }], { duration: 240, easing: 'ease-out' }); }
      if (u < .26) y = .26 * Math.sin(u / .26 * Math.PI); else if (u < .42) y = .08 * Math.sin((u - .26) / .16 * Math.PI);
      sy = u < .12 ? 1 - .14 * Math.sin(u / .12 * Math.PI) : 1;
    }
    g.position.y = by + y; g.scale.set(1 + (1 - sy) * .5, sy, 1 + (1 - sy) * .5);
    if (t > p.tf + .45) { g.position.y = by; g.scale.setScalar(1); return false; } return true;
  });
}
// ===== ドーパミン：部屋のにぎやかさ（家の右上に小さく）=====
let scoreUI = null, scoreRoom = -1;
function updateScore() {
  if (!T || !me) return;
  if (!scoreUI) scoreUI = JOY.mountScore($('stage'), sc => { if (sc) toast('部屋のにぎやかさ ' + sc.pts + '点' + (sc.next != null ? '（次の ★ まで あと ' + (sc.next - sc.pts) + '点）' : '（★ぜんぶ！）'), 'ok'); });
  const sc = JOY.roomScore(room().items, id => ITEM[id]), snap = scoreRoom !== S.cur.room; scoreRoom = S.cur.room;
  scoreUI.update(sc, { snap, onUp: s => { sfx('rank'); if (me.uid) { if (s.stars >= 3) JOY.unlock(me.uid, 'star3', achSfx); if (s.stars >= 5) JOY.unlock(me.uid, 'star5', achSfx); } } });
}
setInterval(() => { if (!document.hidden && PLAY.minute()) cam.dirty = true; }, 30000);   // 時計の針を今の時刻に合わせる
function renderBar() {
  renderPad();
  const b = $('bar'); b.innerHTML = ''; setTimeout(() => { const on = !b.hidden; $('stage').classList.toggle('barOn', on); if (on) { const dk = $('dock'); $('stage').style.setProperty('--barh', b.offsetHeight + 'px'); $('stage').style.setProperty('--dockh', (dk && dk.offsetParent ? Math.round(dk.getBoundingClientRect().height) : 0) + 'px'); } }, 0);
  const btn = (t, f, cls) => b.appendChild(h('button', { cls: 'btn sm ' + (cls || ''), text: t, onclick: f }));
  if (multi) {
    b.hidden = false; const n = multi.sel.size;
    b.appendChild(h('span', { cls: 'lbl', text: n ? 'えらんだ物 ' + n + '個' : 'さわる・なぞるで選ぶ' }));
    if (n) { btn('解除', () => { multi.sel.clear(); renderBar(); buildHi(); cam.dirty = true; }); btn('しまう', multiStow); }
    btn('おわる', exitMulti, 'mint'); return;
  }
  if (ghost) {
    b.hidden = false; b.appendChild(h('span', { cls: 'lbl', text: ghost.def.name }));
    if (!ghost.def.wall) btn('回転', rotateGhost);
    btn('やめる', cancelGhost); btn('ここに置く', confirmGhost, ghost.ok ? 'mint' : '');
    b.lastChild.style.opacity = ghost.ok ? 1 : .55; return;
  }
  const i = selItem(); if (!i) { b.hidden = true; return; }
  const d = ITEM[i.id]; b.hidden = false; b.appendChild(h('span', { cls: 'lbl', text: d.name }));
  b.appendChild(h('span', { cls: 'own', text: i.owner ? nickOf(studentById(i.owner)) + 'が買った' : 'みんなの' }));
  if (PLAY.can(i.uid)) btn(PLAY.label(i.uid), actUse, 'use');
  btn('移動', actMove); if (!d.wall && !d.small) btn('回転', actRot);
  if (canRemove(i)) { btn('しまう', actStow); btn('売る ' + fmt(priceOf(d) * CFG.SELL_RATE) + 'ピコ', actSell, 'coral'); }
}
// ===== ポインタ =====
const cv = $('cv'), ptrs = new Map(); let pinch0 = null, didGesture = false;
const rel = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); const [x, y] = rel(e); ptrs.set(e.pointerId, { x, y, sx: x, sy: y, moved: false, type: e.pointerType, btn: e.button });
  if (cam.mode === 'eye') eyeGrab();
  if (ptrs.size === 2) { cancelDrag(); eyeRelease(true); const [a, b] = [...ptrs.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.zoom }; pinch0.l = pinch0.d; didGesture = true; }
  else if (ptrs.size === 1) { didGesture = false; if (multi && e.button !== 2) startDrag(x, y); }
  if (ghost && ptrs.size === 1 && e.pointerType !== 'mouse') moveGhost(x, y);
});
cv.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); const [x, y] = rel(e);
  if (!p) { if (ghost && e.pointerType === 'mouse') moveGhost(x, y); return; }
  const dx = x - p.x, dy = y - p.y; p.x = x; p.y = y; if (Math.hypot(x - p.sx, y - p.sy) > 8) p.moved = true;
  if (ptrs.size === 2 && pinch0) {
    const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (cam.mode === 'eye') { eyeZoom(d / Math.max(1, pinch0.l)); pinch0.l = d; }   // 目線：画角を少し変える（パンはしない）
    else {
      setZoom(pinch0.z * d / Math.max(1, pinch0.d));
      // 2本指パン（この指の動きの半分ずつ＝中点の移動量）
      cam.panx += dx / 2 / E.W; cam.pany += dy / 2 / E.H; cam.dirty = true;
    }
  } else if (ptrs.size === 1) {
    if (multi && multi.drag) { if (p.moved) dragMove(x, y); }
    else if (ghost && p.type !== 'mouse') moveGhost(x, y);
    else if (p.btn === 2 || p.moved) { if (cam.mode === 'eye') eyeLook(dx, dy); else { orbit(dx * .006, dy * .006); paintCam(); holdAvatars(); } }
    else if (ghost) moveGhost(x, y);
  }
});
cv.addEventListener('pointerup', e => {
  const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = null;
  if (cam.mode === 'eye' && !ptrs.size) eyeRelease();
  if (multi && multi.drag) { endDrag(); if (p && p.moved) return; }
  if (!p || didGesture) { if (!ptrs.size) didGesture = false; return; }
  if (p.btn === 2) return;
  if (!p.moved) tap(p.x, p.y, p.type);
});
cv.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); pinch0 = null; cancelDrag(); if (cam.mode === 'eye') eyeRelease(); });
cv.addEventListener('wheel', e => { e.preventDefault(); const r = e.deltaY < 0 ? 1.1 : 1 / 1.1; if (cam.mode === 'eye') eyeZoom(r); else setZoom(cam.zoom * r); }, { passive: false });
cv.addEventListener('dblclick', () => resetCam());
// タップした先がどの部屋か（ほかの部屋の家具・床なら、その部屋の番号。壁・今いる部屋なら今の番号）
function pickRoom(px, py) {
  if (T.rooms.length < 2) return -1;
  E.roomPick.updateMatrixWorld(true); E.othersG.updateMatrixWorld(true);
  const rc = rayAt(px, py), hits = rc.intersectObjects([E.roomPick, E.othersG].filter(Boolean), true);
  const shown = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };   // 隠している壁（正面用の高い壁など）はタップの邪魔をしない
  for (const hit of hits) {
    if (!shown(hit.object)) continue;
    let o = hit.object; while (o && o.userData.roomIdx == null && o.parent) o = o.parent;
    if (o && o.userData.roomIdx != null) return o.userData.roomIdx;
    if (hit.object.name !== 'floor') return S.cur.room;   // 壁にさえぎられた
  }
  return -1;
}
function hitTest(px, py) {
  const hits = rayAt(px, py).intersectObjects(E.itemsG.children, true);
  for (const hit of hits) { let o = hit.object; while (o && o.userData.uid == null) o = o.parent; if (o && !o.visible) continue; if (o) { const i = room().items.find(t => t.uid === o.userData.uid); if (i) return i; } }
  return null;
}
function tap(x, y, type) {
  if (ghost) { moveGhost(x, y); if (type === 'mouse') confirmGhost(); return; }
  if (multi) { const hit = hitTest(x, y); if (hit) toggleMultiSel(hit); return; }
  if (cam.mode === 'eye') { eyeTap(x, y); return; }
  if (roofCovers()) return;
  const av = hitAvatar(x, y); if (av) { reactAvatar(av.a); return; }   // me-をさわると、ちょっと反応する
  const hit = hitTest(x, y);
  if (hit) { setSel(hit.uid === selUid ? null : hit.uid); sfx('tap'); if (hit.id && ITEM[hit.id].cat === 'rug') { const f = floorAt(x, y, 0); walkTo(Math.floor(f[0]), Math.floor(f[1])); } return; }
  const pr = pickRoom(x, y); if (pr >= 0 && pr !== S.cur.room) { switchRoom(pr); return; }   // ほかの部屋をタップ → その部屋へ
  setSel(null); const c = floorCell(x, y); if (c) walkTo(c[0], c[1]);   // 部屋の床、または（玄関から出られるとき）庭の地面
}
window.addEventListener('keydown', e => {   // R＝回す（Esc・数字・L・V・M などは keys.js。Ctrl+R はブラウザの読み込み直しなので触らない）
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') || e.ctrlKey || e.metaKey || e.altKey || !$('modal').hidden) return;
  if (e.key === 'r' || e.key === 'R') { if (multi) return; if (ghost) rotateGhost(); else if (selUid && selItem() && !ITEM[selItem().id].wall) actRot(); }
});
// ===== 売買 =====
function owned(d) { return d.cat === 'wallpaper' || d.cat === 'floor' ? T.own[d.cat].includes(d.id) : false; }
async function buy(id, direct) {
  const d = ITEM[id], deco = d.cat === 'wallpaper' || d.cat === 'floor';
  if (d.rank > curRank()) { toast(CFG.RANKS[d.rank].name + 'ランクで解放されます', 'ng'); sfx('ng'); return; }
  if (me.picos < priceOf(d)) { toast('ピコが足りません', 'ng'); sfx('ng'); return; }
  const pin = await getPin(); if (pin === null) return;
  if (SV.on) {
    const r = await svCall('buy_item', { p_uid: me.uid, p_pin: pin, p_item: id });
    if (!r || !r.ok) { if (r) { if (r.err === 'pin' || r.err === 'locked') dropPin(); toast(errText(r.err), 'ng'); sfx('ng'); } return; }
    floatText('-' + fmt(priceOf(d)) + ' ピコ', 'm'); coinOut(); await pullApply(true); sfx('buy');
    if (direct) { afterBuy(d, deco); return true; }
    toast(d.name + 'を購入しました。' + (deco ? 'リフォームで使えます（家のみんなで共有）' : '持ち物から置けます'), 'ok'); return true;
  }
  coinOut(); addPts(-priceOf(d)); $('coin').classList.remove('bump'); void $('coin').offsetWidth; $('coin').classList.add('bump');
  if (deco) { T.own[d.cat].push(id); if (!direct) toast(d.name + 'を購入しました。リフォームで使えます（家のみんなで共有）', 'ok'); }
  else { me.inv[id] = (me.inv[id] || 0) + 1; if (!direct) toast(d.name + 'を購入しました。持ち物から置けます', 'ok'); }
  sfx('buy'); save(); renderPanel(); if (direct) afterBuy(d, deco); return true;
}
// 買ったあと：家具はそのまま置く場面へ、壁紙・床はそのまま使う
function afterBuy(d, deco) {
  boughtId = d.id; setTimeout(() => { boughtId = null; }, 800);
  if (deco) { applyDeco(d.id); toast(d.name + 'を購入して、さっそく使いました', 'ok'); return; }
  toast(d.name + 'を購入。置きたい場所をタップ', 'ok'); startPlace(d.id, 'inv');
}
function applyDeco(id) { const d = ITEM[id]; room()[d.cat === 'wallpaper' ? 'wall' : 'floor'] = id; sfx('place'); toast(d.name + 'にしました', 'ok'); rebuildRoom(); save(); renderPanel(); }
// ===== パネル =====
let tab = 'shop', shopCat = 'all', shopSort = 'def';   // shopSort：ショップのならび（def＝いつもの順 / asc＝安い順 / desc＝高い順）
// ミッションは2か所：部屋の左上の小さなカード（#btnMission）と、パネルのタブの上の帯ボタン（#msTab。押すとパネルにチーミの達成状況）
// 帯ボタンは家具・アイテムのタブとは別の形・色にして、見分けられるようにする
const TABS = [['shop', 'ショップ'], ['inv', '持ち物'], ['reno', 'リフォーム'], ['plan', '間取り']];
function renderTabs() { const t = $('tabs'); t.innerHTML = ''; if (tab !== 'mission' && !TABS.some(([k]) => k === tab)) tab = 'shop'; TABS.forEach(([k, n], i) => t.appendChild(h('button', { cls: 'tab' + (tab === k ? ' on' : ''), text: n, title: n + ' (' + (i + 1) + ')', onclick: () => { tab = k; renderPanel(); } }))); paintMsTab(); }
const MS_ICO = '<svg class="ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4M5 4h12l-2.5 4 2.5 4H5"/></svg>';
function paintMsTab() {
  const b = $('msTab'); if (!b) return;
  b.hidden = !T; if (!T) return;
  const L = missionsSorted().filter(m => phaseOf(m) !== 'over' || canClaim(m)), m = L.find(canClaim) || L[0], st = m ? missionStat(m, T) : null, nw = L.some(canClaim), pend = msPending() && !m;
  const sg = [tab === 'mission', nw, pend, m && m.id, m && m.title, st && st.done, st && st.total].join('|');   // 同じ表示なら作り直さない（realtime のたびに innerHTML を入れ替えるとちらつく）
  if (b._sg === sg && b.firstChild) return; b._sg = sg;
  b.className = 'btn' + (tab === 'mission' ? ' on' : '') + (nw ? ' new' : '') + (!pend && b._pend ? ' fresh' : ''); b._pend = pend;
  b.innerHTML = MS_ICO;
  const tag = nw ? '受け取れる' : tab === 'mission' ? '表示中' : '', pct = st && st.total ? Math.min(100, Math.round(st.done / st.total * 100)) : 0;
  const go = h('span', { cls: 'mt-go', 'aria-hidden': 'true' }); go.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';
  [h('span', { cls: 'mt-k', text: 'ミッション' }), tag ? h('span', { cls: 'mt-tag', text: tag }) : null].forEach(e => e && b.appendChild(e));
  if (pend) { b.appendChild(h('span', { cls: 'mt-bar sk-b' }, [h('i')])); b.appendChild(h('span', { cls: 'mt-n sk-b', text: '0/0人 達成' })); }   // まだ読んでいないあいだは「なし」と言わず、光が流れる枠
  else if (!m) b.appendChild(h('span', { cls: 'mt-s', text: 'いまはなし' }));
  else { b.appendChild(h('span', { cls: 'mt-bar' }, [h('i', { style: 'width:' + pct + '%' })])); b.appendChild(h('span', { cls: 'mt-n', text: st.done + '/' + st.total + '人 達成' })); }
  b.appendChild(go);
  b.onclick = () => { tab = tab === 'mission' ? 'shop' : 'mission'; renderPanel(); sfx('tap'); };
}
function iconEl(d) {
  const e = h('div', { cls: 'ico' }); const im = new Image(); im.alt = ''; im.width = 44; im.height = 44; e.appendChild(im);
  if (d.pat) im.src = makeIcon(d, 88); else itemIcon(d, im);
  return e;
}
function sizeText(d) { return d.wall ? '幅' + d.w : d.w + '×' + d.d; }
// 分類の帯（.chips）の横スクロール位置は、再描画（分類・並び順・タブを押したとき）で作り直しても覚えておいて戻す
let chipSc = 0;
function keepChipsPos(nc) {
  if (!nc) return; nc.scrollLeft = chipSc;
  const on = nc.querySelector('.chip.on'); if (!on) return;   // えらんだ分類のボタンが見える位置に
  const l = on.offsetLeft, r = l + on.offsetWidth;
  if (l < nc.scrollLeft) nc.scrollLeft = Math.max(0, l - 8); else if (r > nc.scrollLeft + nc.clientWidth) nc.scrollLeft = r - nc.clientWidth + 8;
  chipSc = nc.scrollLeft;
}
let lastPanelTab = '', panelSc = 0;
function renderPanel() {
  const oc = $('tabBody').querySelector('.chips'); if (oc) chipSc = oc.scrollLeft;
  const bd0 = $('tabBody'), ms0 = tab === 'mission' && lastPanelTab === 'mission' && bd0.firstChild && bd0.firstChild._ms;
  if (ms0 && T && ms0.tid === T.id && ms0.body.isConnected) { renderTabs(); ms0.update(); return; }   // 同じ ミッション を開いたままなら、作り直さず中身だけ差し替える（ちらつかない）
  renderTabs(); const body = $('tabBody'), sc = body.scrollTop; panelSc = sc; body.innerHTML = '';
  if (tab === 'mission') missionView(body); else if (tab === 'shop') shopView(body); else if (tab === 'inv') invView(body); else if (tab === 'reno') renoView(body); else planView(body);
  body.scrollTop = sc; keepChipsPos(body.querySelector('.chips'));
  if (tab !== lastPanelTab) { lastPanelTab = tab; if (uiAnim()) { body.classList.remove('tab-in'); void body.offsetWidth; body.classList.add('tab-in'); } }   // タブを切り替えたときだけ、中身がふわっと入る
}
// ショップ・持ち物：同じ「タイル」の見た目。タップ＝買う→そのまま置く（壁紙・床は買ってそのまま使う）
let boughtId = null;
function tileEl(d, o) {
  const ico = h('span', { cls: 'tile-ico' }); const im = new Image(); im.alt = ''; im.width = 88; im.height = 88; ico.appendChild(im);
  if (d.pat) patIcon(d, im, 176); else itemIcon(d, im);
  const t = h('button', { cls: 'tile' + (boughtId === d.id ? ' pop' : '') + (o.lock ? ' lock' : '') + (o.poor ? ' poor' : '') + (o.have ? ' have' : ''), onclick: o.onclick, 'aria-label': d.name }, [
    ico, h('span', { cls: 'tile-nm', text: d.name }),
    h('span', { cls: 'tile-meta' }, [o.price != null ? h('span', { cls: 'price' + (o.poor ? ' no' : '') }, [h('span', { cls: 'coin xs' }), h('b', { text: fmt(o.price) })]) : null, o.sub ? h('span', { cls: 'tile-sz', text: o.sub }) : null]),
    o.badge ? h('span', { cls: 'tile-badge' + (o.lock ? ' lk' : ''), text: o.badge, ico: o.lock ? 'lock' : null, icoSize: 12 }) : null
  ]);
  if (o.lock) t.setAttribute('aria-disabled', 'true');
  return t;
}
function shopView(body) {
  if (me && me.staff) { body.appendChild(h('p', { cls: 'staff-note', text: '担任助手は見るだけモードです。家具を選ぶと、動かす・しまう・売るができます（しまう・売るは持ち主に戻ります）。' })); return; }
  const chips = h('div', { cls: 'chips' }); const all = [['all', 'すべて']].concat(CATS.map(c => [c.id, c.name]));
  // ペット（きせかえ）もショップから選べる。サーバー版は schema 版13（wear_items に pet が入る）から
  const ltdList = LTD_ITEMS.filter(d => !d.hazure && !(d.since && SV.on && !(SV.schema >= d.since))); if (ltdList.length) all.splice(1, 0, ['ltd', '限定']);   // プレゼントコードでだけもらえる品（data.js の ltd:true から自動）。ガチャのはずれ（hazure）は出さない
  const petOK = !(SV.on && !(SV.schema >= 13)); if (petOK) all.splice(1, 0, ['pet', 'ペット']);   // 見つけやすいよう「すべて」のとなり else if (shopCat === 'pet') shopCat = 'all';
  all.forEach(([k, n]) => chips.appendChild(h('button', { cls: 'chip' + (shopCat === k ? ' on' : ''), text: n, ico: k === 'pet' ? 'paw' : k === 'ltd' ? 'gift' : null, icoSize: 14, onclick: () => { shopCat = k; renderPanel(); $('tabBody').scrollTop = 0; sfx('tap'); } })));
  body.appendChild(chips);
  if (shopCat === 'pet') { petShopView(body); return; }
  if (shopCat === 'ltd') { ltdShopView(body, ltdList); return; }
  // ならびかえ：いつもの順／安い順／高い順（同じ値段なら、いつもの順のまま）
  body.appendChild(h('div', { cls: 'seg-g shop-sort', role: 'group', 'aria-label': 'ならびかえ' }, [['def', 'いつもの順'], ['asc', '安い順'], ['desc', '高い順']].map(([k, n]) =>
    h('button', { cls: 'seg' + (shopSort === k ? ' on' : ''), text: n, 'aria-pressed': String(shopSort === k), onclick: () => { shopSort = k; renderPanel(); sfx('tap'); } }))));
  let list = ITEMS.filter(d => !d.free && (shopCat === 'all' || d.cat === shopCat)); const grid = h('div', { cls: 'tiles' });
  if (shopSort !== 'def') { const s = shopSort === 'asc' ? 1 : -1; list = list.map((d, i) => [d, i]).sort((a, b) => (priceOf(a[0]) - priceOf(b[0])) * s || a[1] - b[1]).map(x => x[0]); }
  const addTile = d => {
    const lock = d.rank > curRank(), have = owned(d), price = priceOf(d), poor = !have && !lock && me.picos < price, deco = d.cat === 'wallpaper' || d.cat === 'floor', cnt = me.inv[d.id] || 0;
    grid.appendChild(tileEl(d, {
      lock, poor, have, price: have || lock ? null : price, sub: have ? '購入ずみ' : lock ? 'あと ' + fmt(Math.max(0, CFG.RANKS[d.rank].min * mul() - (me.earned || 0))) : poor ? 'あと ' + fmt(price - me.picos) : deco ? '' : sizeText(d),
      badge: lock ? CFG.RANKS[d.rank].name : have ? 'つかう' : cnt ? '持ってる ×' + cnt : '',
      onclick: () => {
        if (lock) { toast(CFG.RANKS[d.rank].name + 'ランクで解放されます', 'ng'); sfx('ng'); return; }
        if (have) { applyDeco(d.id); return; }
        buy(d.id, true);
      }
    }));
  };
  // 最初の画面ぶんだけすぐ作り、残りは1フレームに8msずつ足す（入った直後に固まらない）。スクロール位置を戻す必要があるとき・確認用ページでは一度に作る
  const first = uiAnim() && !panelSc ? 16 : list.length; list.slice(0, first).forEach(addTile);
  if (list.length > first) { let i = first; const pump = () => { if (!grid.isConnected) return; const t0 = performance.now(); while (i < list.length && performance.now() - t0 < 8) addTile(list[i++]); if (i < list.length) requestAnimationFrame(pump); }; requestAnimationFrame(pump); }
  if (!list.length) body.appendChild(h('div', { cls: 'empty' }, [h('div', { cls: 'empty-ico' }, [iconNode('bag', 44)]), h('div', { text: 'このカテゴリはまだ空っぽ' })]));
  body.appendChild(grid);
}
// ショップの「ペット」：タップ＝買う（たしかめてから。買ったらすぐ連れていく）。持っているペットはタップで連れていく／連れているペットはおうちに帰す
// 見た目を試したいときは、下の「きせかえで試着する」から（きせかえのペットタブが試着つきで開く）
// k＝'pet'（ペット）か 'petw'（ペットのおしゃれ。タップ＝つける／つけているのをタップ＝はずす）
async function petTap(i, k) {
  k = k || 'pet'; const pw = k === 'petw';
  const [name] = WEAR[k][i], have = (me.wear || []).includes(k + i), on = ((me.me && me.me[k]) | 0) === i, price = wearPriceOf(k, i), curPet = (me.me && me.me.pet) | 0, homePet = pw && curPet >= PET_HOME_MIN, noPet = pw && (!curPet || homePet), noPetMsg = homePet ? '（' + PET_HOME_NOTE + '）' : '（ペットを連れていると見えるよ）';
  sfx('tap');
  if (on) { if (pw) { if (await setPet(0, k)) toast(name + 'を はずしました', 'ok'); return; } if (await confirmDlg(name + 'を おうちに帰しますか？（いつでも また連れていけます）', '帰す') && await setPet(0)) toast(name + 'は おうちに帰りました', 'ok'); return; }
  if (have) { if (await setPet(i, k)) toast(pw ? name + 'を つけました' + (noPet ? noPetMsg : '') : name + 'を連れていきます', 'ok'); return; }
  if (me.picos < price) { toast('ピコが足りません（あと ' + fmt(price - me.picos) + '）', 'ng'); sfx('ng'); return; }
  if (!await confirmDlg(name + 'を ' + fmt(price) + ' ピコで買いますか？' + (pw ? '（買うと、すぐ ペットに つけます）' : '（買うと、すぐ いっしょに連れていきます）'), '買う')) return;
  if (!await buyWear(me, k, i)) return;
  toast(name + 'を購入しました' + (noPet ? noPetMsg : ''), 'ok'); renderPanel();
  await setPet(i, k);
}
// 連れているペットを変える（0＝なし）。サーバー版は set_profile（4桁番号を確かめる）
async function setPet(i, k) {
  const st = me; if (!await requirePin()) return false;
  const m = cleanMe(Object.assign({}, st.me || {}, { [k || 'pet']: i })); if (!m) return false;
  if (SV.on) {
    const r = await svCall('set_profile', { p_uid: st.uid, p_pin: pinCache.pin, p_nick: st.nick, p_me: m, p_new_pin: null });
    if (!r || !r.ok) { if (r) { if (r.err === 'pin' || r.err === 'locked') dropPin(); toast(errText(r.err), 'ng'); } sfx('ng'); return false; }
    await pullApply(true);
  } else { st.me = m; save(); rebuildAvatars(); }
  meChipKey = ''; renderHud(); renderPanel(); return true;
}
function petShopView(body) {
  const grid = h('div', { cls: 'tiles' }), cur = (me.me && me.me.pet) | 0, wear = me.wear || [];
  WEAR.pet.forEach(([name, base], i) => {
    if (!i || (i >= PET_HOME_MIN && SV.on && !(SV.schema >= 28))) return;   // 0＝なし／水槽・とりかご（8〜）は schema 版28 から
    const have = wear.includes('pet' + i), on = cur === i, price = wearPriceOf('pet', i), poor = !have && me.picos < price;
    const ico = h('span', { cls: 'tile-ico' }); const im = new Image(); im.alt = ''; im.width = 88; im.height = 88; ico.appendChild(im);
    meThumbInto(im, Object.assign({}, me.me || {}, { pet: i }), 'pet');
    const t = h('button', { cls: 'tile' + (poor ? ' poor' : '') + (have ? ' have' : ''), 'aria-label': name, onclick: () => petTap(i) }, [
      ico, h('span', { cls: 'tile-nm', text: name }),
      h('span', { cls: 'tile-meta' }, [have ? null : h('span', { cls: 'price' + (poor ? ' no' : '') }, [h('span', { cls: 'coin xs' }), h('b', { text: fmt(price) })]), have ? h('span', { cls: 'tile-sz', text: on ? 'つれている' : '購入ずみ' }) : null]),   // ペットは値段が大きく、スマホでは「あと○」まで入らない（足りないときは値段が赤）
      have ? h('span', { cls: 'tile-badge', text: on ? 'いっしょ' : 'つれていく' }) : null
    ]);
    grid.appendChild(t);
  });
  body.appendChild(grid);
  // ペットのおしゃれ（schema 版24 から）。絵は、連れているペット（いないときは いぬ）に着せて見せる
  if (!(SV.on && !(SV.schema >= 24))) {
    const cw = (me.me && me.me.petw) | 0, g2 = h('div', { cls: 'tiles' });
    body.appendChild(h('div', { cls: 'shop-sub', text: 'ペットのおしゃれ', ico: 'ribbon', icoSize: 16 }));
    if (cur >= PET_HOME_MIN) body.appendChild(h('p', { cls: 'hint', text: PET_HOME_NOTE }));
    WEAR.petw.forEach(([name], i) => {
      if (!i) return;
      const have = wear.includes('petw' + i), on = cw === i, price = wearPriceOf('petw', i), poor = !have && me.picos < price;
      const ico = h('span', { cls: 'tile-ico' }); const im = new Image(); im.alt = ''; im.width = 88; im.height = 88; ico.appendChild(im);
      meThumbInto(im, Object.assign({}, me.me || {}, { pet: cur && cur < PET_HOME_MIN ? cur : 1, petw: i }), 'pet');
      g2.appendChild(h('button', { cls: 'tile' + (poor ? ' poor' : '') + (have ? ' have' : ''), 'aria-label': name, onclick: () => petTap(i, 'petw') }, [
        ico, h('span', { cls: 'tile-nm', text: name }),
        h('span', { cls: 'tile-meta' }, [have ? null : h('span', { cls: 'price' + (poor ? ' no' : '') }, [h('span', { cls: 'coin xs' }), h('b', { text: fmt(price) })]), have ? h('span', { cls: 'tile-sz', text: on ? 'つけている' : '購入ずみ' }) : null]),
        have ? h('span', { cls: 'tile-badge', text: on ? 'はずす' : 'つける' }) : null
      ]));
    });
    body.appendChild(g2);
  }
  body.appendChild(h('div', { cls: 'empty slim' }, [h('button', { cls: 'btn', text: 'きせかえで試着する', ico: 'shirt', onclick: async () => { sfx('tap'); if (await requirePin()) editMe('wear', { key: 'pet', i: cur || 1 }); } })]));
}
// ショップの「限定」：プレゼントコードでだけもらえる品。値段はなく、並びかえもない。持っていれば持ち物と同じく置ける
function ltdPlaced(id) { let n = 0; if (T) T.rooms.forEach(r => r.items.forEach(i => { if (i.id === id) n++; })); return n; }
function ltdInfoDlg(d) {
  modal(d.name, h('div', {}, [h('p', { cls: 'hint', text: '担任助手が配るプレゼントコード（QR）でもらえるよ。' })]), [
    h('button', { cls: 'btn mint', text: 'コードを入れる', onclick: () => { closeModal(); giftCodeDlg(); } }),
    h('button', { cls: 'btn', text: 'とじる', onclick: closeModal })]);
}
function ltdShopView(body, list) {
  body.appendChild(h('p', { cls: 'hint ltd-note', text: 'プレゼントコードでだけもらえる、とくべつな品だよ' }));
  const grid = h('div', { cls: 'tiles' });
  list.forEach(d => {
    const cnt = me.inv[d.id] || 0, put = ltdPlaced(d.id);
    grid.appendChild(tileEl(d, {
      have: cnt > 0, sub: sizeText(d), badge: cnt ? '持ってる ×' + cnt : put ? '置いてある' : 'プレゼント',
      onclick: () => {
        if (cnt) { startPlace(d.id, 'inv'); return; }
        if (put) { toast('ぜんぶ置いてあるよ。置いた品をタップすると動かせるよ', ''); sfx('tap'); return; }
        sfx('tap'); ltdInfoDlg(d);
      }
    }));
  });
  body.appendChild(grid);
}
function invView(body) {
  const ids = Object.keys(me.inv).filter(k => me.inv[k] > 0);
  if (!ids.length) { body.appendChild(h('div', { cls: 'empty' }, [h('div', { cls: 'empty-ico' }, [iconNode('box', 44)]), h('div', { text: '持ち物はまだ空っぽ' }), h('div', { cls: 'empty-sub', text: 'ショップで買うと、ここから置けます' }), h('button', { cls: 'btn mint', text: 'ショップを見る', onclick: () => { tab = 'shop'; renderPanel(); } })])); return; }
  const grid = h('div', { cls: 'tiles' });
  ids.forEach(id => { const d = ITEM[id]; grid.appendChild(tileEl(d, { sub: (d.ltd ? '非売品・' : '') + sizeText(d), badge: '×' + me.inv[id], onclick: () => startPlace(id, 'inv') })); });
  body.appendChild(grid);
}
function renoView(body) {
  [['wallpaper', '壁紙', 'wall'], ['floor', '床', 'floor']].forEach(([cat, name, key]) => {
    body.appendChild(h('div', { cls: 'sec', text: name + '（' + room().name + '）' })); const g = h('div', { cls: 'swgrid' });
    T.own[cat].forEach(id => { const d = ITEM[id], s = h('div', { cls: 'sw' + (room()[key] === id ? ' on' : ''), onclick: () => applyDeco(id) }); const im = new Image(); im.src = makeIcon(d, 144); s.appendChild(im); s.appendChild(h('div', { cls: 'n', text: d.name })); g.appendChild(s); });
    body.appendChild(g);
  });
  body.appendChild(h('div', { cls: 'empty slim' }, [h('button', { cls: 'btn mint', text: 'ショップで買い足す', onclick: () => { tab = 'shop'; shopCat = 'wallpaper'; renderPanel(); } })]));
}
function bankCard() {
  const c = h('div', { cls: 'card bankcard' }); c.appendChild(h('h4', { text: 'チーミ貯金箱' }));
  c.appendChild(h('div', { cls: 'bankrow' }, [h('span', { cls: 'coin sm' }), h('b', { text: pfmt(T.picos) }), h('i', { text: 'ピコ' })]));
  c.appendChild(h('p', { cls: 'hint', text: 'みんなで貯めて、間取りを変えるのに使います。自分のピコから寄付できます' }));
  c.appendChild(h('button', { cls: 'btn mint', text: '寄付する', onclick: donateDlg }));
  return c;
}
// 間取りタブ：今の家のかんたんな図と、間取りを変える画面への入口
function miniPlan() {
  const NS = 'http://www.w3.org/2000/svg', box = houseBox(T.rooms), m = .6, svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', (box.x0 - m) + ' ' + (box.z0 - m) + ' ' + (box.w + m * 2) + ' ' + (box.d + m * 2)); svg.setAttribute('class', 'mini-plan'); svg.setAttribute('aria-hidden', 'true');
  const parts = T.rooms.map((r, i) => '<rect x="' + r.x + '" y="' + r.z + '" width="' + r.w + '" height="' + r.d + '" rx=".15" fill="' + ((ITEM[r.floor] || {}).color || '#e8d3ae') + '" stroke="' + (i === S.cur.room ? '#f2877a' : '#8a6a44') + '" stroke-width="' + (i === S.cur.room ? .3 : .14) + '"/>');
  svg.innerHTML = parts.join(''); return svg;
}
function planView(body) {
  const cnt = T.n > 0 ? T.n : T.members.length, rm = room(), bb = houseBox(T.rooms);
  body.appendChild(bankCard());
  const c1 = h('div', { cls: 'card' }); c1.appendChild(h('h4', { text: '間取り' }));
  c1.appendChild(miniPlan());
  c1.appendChild(h('p', { cls: 'hint', text: '部屋 ' + T.rooms.length + ' / ' + CFG.MAX_ROOMS + '　家の大きさ ' + bb.w + '×' + bb.d + 'マス' }));
  if (me && me.staff) c1.appendChild(h('p', { cls: 'hint', text: '担任助手は見るだけモードです' }));
  else c1.appendChild(h('button', { cls: 'btn coral', text: '間取りを変える', onclick: openPlanScreen }));
  c1.appendChild(h('p', { cls: 'hint', text: '部屋を広げる・作る・つなげる。貯金箱のピコを使います' }));
  body.appendChild(c1);
  const c2 = h('div', { cls: 'card' }); c2.appendChild(h('h4', { text: '今いる部屋の名前' }));
  const inp = h('input', { type: 'text', maxlength: '8', value: rm.name }); c2.appendChild(inp);
  c2.appendChild(h('button', { cls: 'btn', text: '名前を変える', onclick: () => { rm.name = inp.value.trim().slice(0, 8) || rm.name; save(); renderRooms(); renderPanel(); toast('名前を変更しました', 'ok'); } }));
  body.appendChild(c2);
}
function openPlanScreen() {
  if (!T || !me) return; exitMulti(); cancelGhost(); selUid = null;
  return openPlan({ T, cur: S.cur.room, n: T.n > 0 ? T.n : T.members.length, mul, bank: () => T.picos, run: applyLayoutRun });
}
// 間取りの確定：サーバー版は team_layout（費用・制約はサーバーで確かめる）、端末だけのときはここで反映
async function applyLayoutRun(p) {
  const { rooms, open, cost } = p;
  if (T.picos < cost) { toast('貯金箱のピコが足りません', 'ng'); sfx('ng'); return false; }
  if (SV.on) {
    clearTimeout(ct); await commitHouse();   // 置いた家具を先に保存してから
    const r = await svCall('team_layout', { p_uid: me.uid, p_team: T.id, p_version: T.version, p_rooms: rooms, p_open: open });
    if (!r || !r.ok) { if (r) toast(errText(r.err), 'ng'); sfx('ng'); await pullApply(true); return false; }
    await pullApply(true);
  } else {
    T.picos -= cost; T.rooms = rooms.map(r => { const c = Object.assign({}, r); delete c.k; return c; }); T.open = open.slice();
  }
  if (S.cur.room >= T.rooms.length) S.cur.room = 0;
  placeAvatars(); rebuildRoom(); renderRooms(); renderHud(); renderPanel(); sfx('buy'); confetti(26); toast('間取りを変更しました', 'ok'); if (!SV.on) save();
  return true;
}
// 貯金箱への寄付：自分の所持ピコから。番号を確かめる
function donateDlg() {
  const body = h('div', { cls: 'donate' }); let amt = 0;
  const inp = h('input', { type: 'number', min: '0', step: '100', inputmode: 'numeric', placeholder: '0' }), info = h('div', { cls: 'hint' });
  const set = v => { amt = Math.max(0, Math.min(me.picos, Math.floor(+v || 0))); inp.value = amt ? String(amt) : ''; };
  inp.addEventListener('input', () => { amt = Math.max(0, Math.min(me.picos, Math.floor(+inp.value || 0))); });
  body.appendChild(h('p', { text: 'あなたのピコ：' + pfmt(me.picos) + '　貯金箱：' + pfmt(T.picos) }));
  const q = h('div', { cls: 'quick' }); [1000, 5000, 10000].forEach(v => q.appendChild(h('button', { cls: 'btn sm', text: '+' + fmt(v), onclick: () => set(amt + v) }))); q.appendChild(h('button', { cls: 'btn sm', text: 'ぜんぶ', onclick: () => set(me.picos) }));
  body.appendChild(q); body.appendChild(inp); body.appendChild(info);
  modal('貯金箱に寄付', body, [h('button', { cls: 'btn', text: 'やめる', onclick: closeModal }), h('button', { cls: 'btn coral', text: '寄付する', onclick: async () => {
    amt = Math.min(me.picos, Math.floor(+inp.value || amt)); if (amt <= 0) { toast('ピコの数を入力してください', 'ng'); return; }
    closeModal(); const pin = await getPin(); if (pin === null) return;
    if (SV.on) {
      const r = await svCall('donate', { p_uid: me.uid, p_pin: pin, p_amount: amt });
      if (!r || !r.ok) { if (r) { if (r.err === 'pin' || r.err === 'locked') dropPin(); toast(errText(r.err), 'ng'); } return; }
      floatText('-' + fmt(amt) + ' ピコ', 'm'); sfx('coin'); donateFx(); toast('貯金箱に ' + fmt(amt) + ' ピコを寄付しました', 'ok'); await pullApply(true); return;
    }
    me.picos -= amt; T.picos += amt; floatText('-' + fmt(amt) + ' ピコ', 'm'); sfx('coin'); donateFx(); toast('貯金箱に ' + fmt(amt) + ' ピコを寄付しました', 'ok'); renderHud(); save(); renderPanel();
  } })]);
}
function switchRoom(i) { exitMulti(); cancelGhost(); selUid = null; S.cur.room = i; placeAvatars(); rebuildRoom(); renderRooms(); renderBar(); renderPanel(); save(); }
function renderRooms() { const r = $('rooms'), sl = r.scrollLeft; r.innerHTML = ''; r.hidden = T.rooms.length < 2; T.rooms.forEach((rm, i) => r.appendChild(h('button', { cls: 'rtab' + (i === S.cur.room ? ' on' : ''), text: rm.name, onclick: () => switchRoom(i) }))); r.scrollLeft = sl; }
// ===== HUD・ダイアログ =====
let meChipKey = '';
// 歯車に赤い点：まだ見ていないアップデート情報があるとき
function paintUpdDot() { const n = hasNewUpdates(); document.querySelectorAll('#btnSet,.sel-gear').forEach(b => b.classList.toggle('has-new', n)); }   // 家の中とホームの歯車
function renderHud() {
  if (!T || !me) return;
  paintUpdDot();
  const ri = curRank(), r = CFG.RANKS[ri], nx = CFG.RANKS[ri + 1], e = me.earned || 0, b0 = r.min * mul(), b1 = nx ? nx.min * mul() : 0, pct = nx ? (e - b0) / (b1 - b0) * 100 : 100;
  $('rankName').textContent = r.name; $('rankNext').textContent = nx ? 'あと ' + fmt(Math.max(0, b1 - e)) : 'MAX'; { const bg = 'linear-gradient(90deg,#bdeedd ' + pct + '%,#fffaf0 ' + pct + '%)'; if ($('rank')._bg !== bg) { $('rank')._bg = bg; $('rank').style.background = bg; } }
  $('rank').title = (nx ? '次のランク「' + nx.name + '」まで あと ' + fmt(b1 - e) + ' ピコ' : '最高ランク') + '（押すと ランクのしくみ）'; checkRankUp();
  $('meNick').textContent = nickOf(me) + (adminOn && !me.staff ? '★' : ''); $('meChip').title = nickOf(me) + '（' + T.name + '）';
  const k = me.uid + (me.me ? JSON.stringify(me.me) : ''); if (k !== meChipKey) { meChipKey = k; $('meFace').src = me.me ? meThumb(me.me, 'face') : ''; $('meFace').style.display = me.me ? '' : 'none'; }
  $('btnPend').hidden = !(SV.on && !me.staff && me.approved === false);   // 承認まち：何ができて何ができないかを見せる
  $('bank').textContent = pfmt(T.picos); $('bankBox').title = T.name + 'の貯金箱（タップで寄付）';
  paintNotesBtn(); paintMissionBtn();
  paintNotesBtn(); paintMissionBtn(); paintMeyasuBtn(); paintLive();
}
// 承認まち：担任助手が名簿の人とひもづけるまで
function pendDlg() {
  const ul = h('ul', { cls: 'dm-list' }); ['担任助手が me- を名簿の人と確認すると「承認」されます', 'それまで、得点・在校時間のピコは入りません', '家を見る・歩く・家具を動かすことは今もできます', '早く承認してほしいときは、担任助手に声をかけてください'].forEach(x => ul.appendChild(h('li', { text: x })));
  modal('承認まち', ul, [h('button', { cls: 'btn coral', text: '了解', onclick: closeModal })]);
}
// 自分のチップを押したとき：プロフィール（見た目・きせかえ・切り替え・設定）
function profileDlg() {
  if (!T || !me) return;
  const ri = curRank(), r = CFG.RANKS[ri], nx = CFG.RANKS[ri + 1], e = me.earned || 0, b0 = r.min * mul(), b1 = nx ? nx.min * mul() : 0, pct = nx ? Math.max(0, Math.min(100, (e - b0) / (b1 - b0) * 100)) : 100;
  const body = h('div', { cls: 'prof' });
  const face = me.me ? faceImg(me.me, 'face', 'pf-face') : h('div', { cls: 'pf-face none', text: '？' });
  body.appendChild(h('div', { cls: 'pf-top' }, [face, h('div', { cls: 'pf-who' }, [h('b', { cls: 'pf-nick', text: nickOf(me) }), h('span', { cls: 'pf-team', text: T.name }), h('span', { cls: 'pf-pico' }, [h('span', { cls: 'coin sm' }), h('b', { text: pfmt(me.picos) }), h('i', { text: 'ピコ' })])])]));
  body.appendChild(h('div', { cls: 'pf-rank' }, [h('div', { cls: 'pf-rt' }, [h('b', { text: r.name }), h('span', { text: nx ? '次の ' + nx.name + ' まで あと ' + fmt(Math.max(0, b1 - e)) + ' ピコ' : '最高ランク' })]), h('div', { cls: 'prog' }, [h('i', { style: 'width:' + pct.toFixed(1) + '%' })]), h('div', { cls: 'pf-rk-more' }, [h('button', { cls: 'btn sm', text: 'ランクのしくみ', style: 'white-space:nowrap', onclick: () => { closeModal(); rankDlg(); } })])]));
  const acts = h('div', { cls: 'pf-acts' });
  if (!me.staff) {
    acts.appendChild(h('button', { cls: 'btn', text: 'きせかえ', ico: 'shirt', onclick: async () => { closeModal(); if (await requirePin()) editMe('wear'); } }));
    acts.appendChild(h('button', { cls: 'btn', text: 'me-をつくりなおす', ico: 'pencil', onclick: async () => { closeModal(); if (await requirePin()) editMe(); } }));
  } else acts.appendChild(h('button', { cls: 'btn', text: '担任助手の me-', ico: 'pencil', onclick: () => { closeModal(); editStaffMe(staffList().find(p => p.id === me.staffId) || null); } }));
  acts.appendChild(h('button', { cls: 'btn', text: 'ほかの人に切り替える', ico: 'swap', onclick: () => { closeModal(); leaveTeam(true); } }));
  acts.appendChild(h('button', { cls: 'btn', text: '設定', ico: 'gear', onclick: () => { closeModal(); settingsDlg(); } }));
  body.appendChild(acts); if (me.uid) body.appendChild(JOY.achBody(me.uid));
  modal(nickOf(me) + ' のプロフィール', body, [h('button', { cls: 'btn coral', text: 'とじる', onclick: closeModal })], 'profbox');
}
// ランクのしくみ：ためたピコの合計（earned）で決まる。階段（必要なピコ・解放される家具の数）と、次のランクまでの進みぐあい
function rankDlg() {
  if (!T || !me) return;
  const ri = curRank(), nx = CFG.RANKS[ri + 1], e = me.earned || 0, b0 = CFG.RANKS[ri].min * mul(), b1 = nx ? nx.min * mul() : 0, pct = nx ? Math.max(0, Math.min(100, (e - b0) / (b1 - b0) * 100)) : 100;
  const body = h('div', { cls: 'rkd' });
  body.appendChild(h('div', { cls: 'rkd-how' }, [
    h('p', { text: 'ランクは、これまでにためたピコの合計で決まるよ。買い物で使っても、下がらないよ。' }),
    h('p', { text: '向上得点と在校時間のピコがたまるよ。特別ピコ・プレゼント・ガチャは、合計に入らないものもあるよ。ミッションのごほうびと、家具を売ったピコは、合計に入らないよ。' })]));
  const list = h('div', { cls: 'rkd-list' });
  CFG.RANKS.forEach((k, i) => {
    const n = ITEMS.filter(d => !d.free && d.rank === i).length, st = i < ri ? 'done' : i === ri ? 'now' : 'next';
    list.appendChild(h('div', { cls: 'rkd-row ' + st }, [
      h('span', { cls: 'rkd-mark', text: st === 'done' ? '✓' : String(i + 1) }),
      h('span', { cls: 'rkd-nm' }, [h('b', { text: k.name }), st === 'now' ? h('i', { text: 'いまここ' }) : null]),
      h('span', { cls: 'rkd-need', text: i === 0 ? 'はじめから' : fmt(k.min * mul()) + ' ピコ〜' }),
      h('span', { cls: 'rkd-n', text: n ? '家具 ' + n + ' こ' : '' })]));
    if (st === 'now') list.appendChild(h('div', { cls: 'rkd-bar' }, [h('div', { cls: 'prog' }, [h('i', { style: 'width:' + pct.toFixed(1) + '%' })]), h('span', { text: nx ? 'あと ' + fmt(Math.max(0, b1 - e)) + ' ピコで ' + nx.name : '最高ランク！' })]));
  });
  body.appendChild(list);
  const its = nx ? ITEMS.filter(d => !d.free && d.rank === ri + 1).slice(0, 6) : [];
  if (its.length) {
    const row = h('div', { cls: 'rkd-its' });
    its.forEach(d => { const im = new Image(); im.alt = d.name; im.title = d.name; im.width = 44; im.height = 44; if (d.pat) im.src = makeIcon(d, 88); else itemIcon(d, im); row.appendChild(im); });
    body.appendChild(h('div', { cls: 'rkd-un' }, [h('span', { text: nx.name + ' で使えるようになる家具' }), row]));
  }
  modal('ランクのしくみ', body, [h('button', { cls: 'btn coral', text: 'とじる', onclick: closeModal })], 'rankbox');
}
// 描画の切り替え（さこのアカウントだけ。ほかの人には出さない）：自動（端末ごとの試験の結果にしたがう）／WebGPU／WebGL。選んだ値はこの端末に保存し、読み込み直して反映する
const GPU_ADMIN = '055efd85';   // uid の先頭（ニックネームでなく uid で判定する）
const gpuAdmin = () => !!(me && typeof me.uid === 'string' && me.uid.startsWith(GPU_ADMIN));
const whyJa = w => { w = String(w || ''); return /^slow:/.test(w) ? '遅い ' + w.slice(5) : w === 'slower-than-webgl' ? 'WebGLより遅い' : /timeout/.test(w) ? '時間切れ' : /lost/.test(w) ? 'GPUが止まった' : /software/.test(w) ? 'ソフトウェア描画' : w === 'noadapter' ? 'GPUなし' : w; };   // 不合格の理由（さこ向け・短く）
function gpuRows(body) {
  const pref = getPref(), gb = h('span');
  [['auto', '自動'], ['webgpu', 'WebGPU'], ['webgl', 'WebGL']].forEach(([k, n]) => gb.appendChild(h('button', { cls: 'btn sm' + (pref === k ? ' mint' : ''), text: n, style: 'margin-left:4px;white-space:nowrap', onclick: () => { if (k === pref) return; setPref(k); toast('描画を切りかえます', 'ok'); setTimeout(() => location.reload(), 350); } })));
  body.appendChild(h('div', { cls: 'setrow' }, [h('span', { text: '描画' }), gb]));
  const rec = readRec(), mine = rec && rec.k === GPU.key, ms = v => v == null ? '-' : v + 'ms';
  const nowT = 'いま：' + (GPU.on ? 'WebGPU' : 'WebGL') + (GPU.forced ? '（URLで指定）' : pref === 'auto' ? '（自動）' : '（手で選択）') + (!GPU.on && GPU.why && pref === 'auto' && GPU.why !== 'untested' && GPU.why !== 'noapi' ? '・' + GPU.why : '');
  const tryT = '試験：' + (!navigator.gpu ? 'WebGPU なし' : mine ? (rec.ok ? '合格' : '不合格') + '　WebGPU ' + ms(rec.gpuMs) + '／WebGL ' + ms(rec.glMs) + (rec.ok ? '' : '（' + whyJa(rec.why) + '）') : 'まだ（初回の起動のあとに自動で）');
  const ln = t => h('div', { style: 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis', text: t });
  const triesT = mine && Array.isArray(rec.tries) && rec.tries.length ? '回ごと：' + rec.tries.map((t, i) => (i + 1) + '回目 ' + ms(t[0]) + (t[2] ? '(' + whyJa(t[2]) + ')' : '(合格)')).join('　') : '';
  const re = navigator.gpu ? h('button', { cls: 'btn sm', style: 'white-space:nowrap;flex-shrink:0', text: 'もう一度試験', onclick: async () => { await withBusy('描画を試験しています（少しのあいだ、画面が止まります）', runTrial(true)); closeModal(); settingsDlg(); } }) : null;
  body.appendChild(h('div', { cls: 'setrow' }, [h('span', { style: 'min-width:0;flex:1;font-size:11px;opacity:.75;line-height:1.5' }, [ln(nowT), ln(tryT)].concat(triesT ? [ln(triesT)] : [])), re]));
}
function settingsDlg() {
  const inHouse = !!(T && me) && $('select').hidden;   // ホームから開いたときは、家の中でしか意味のない項目を出さない
  const body = h('div'), snd = h('input', { type: 'checkbox' }); snd.checked = S.sound; snd.onchange = () => { S.sound = snd.checked; save(); if (S.sound) sfx('tap'); };
  body.appendChild(h('div', { cls: 'setrow' }, [h('span', { text: '効果音' }), snd]));
  const qb = h('span'), paintQ = () => { qb.innerHTML = ''; [['std', '標準'], ['high', '高'], ['ultra', '最高']].forEach(([k, n]) => qb.appendChild(h('button', { cls: 'btn sm' + (quality === k ? ' mint' : ''), text: n, style: 'margin-left:4px;white-space:nowrap', onclick: () => { quality = k; try { localStorage.setItem(QKEY, k); } catch (e) { } setQuality(k); paintQ(); } }))); };
  paintQ(); body.appendChild(h('div', { cls: 'setrow' }, [h('span', { text: '画質' }), qb]));
  if (SV.on && SV.sb) { const rb = h('span'), paintR = () => { rb.innerHTML = ''; [[true, 'オン'], [false, 'オフ']].forEach(([k, n]) => rb.appendChild(h('button', { cls: 'btn sm' + (rtOn === k ? ' mint' : ''), text: n, style: 'margin-left:4px;white-space:nowrap', onclick: () => { setRealtime(k); paintR(); } }))); }; paintR(); body.appendChild(h('div', { cls: 'setrow', title: '同じ家を開いている仲間が、その場で動いて見えます' }, [h('span', { text: 'リアルタイム' }), rb])); }
  if (inHouse) {   // ボタンの置き場所（端末に保存）
    const lb = h('span', { style: 'display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end' });
    [[false, '上に並べる'], [true, '右はしに縦に並べる']].forEach(([v, n]) => lb.appendChild(h('button', { cls: 'btn sm' + (layoutRail === v ? ' mint' : ''), text: n, style: 'white-space:nowrap', onclick: () => { layoutRail = v; layoutSaved = true; try { localStorage.setItem(LAYKEY, v ? 'rail' : 'top'); } catch (e) { } applyRail(); closeModal(); settingsDlg(); } })));
    body.appendChild(h('div', { cls: 'setrow', style: 'flex-wrap:wrap;gap:6px' }, [h('span', { text: 'ボタンの置き場所' }), lb]));
  }
  if (gpuAdmin()) gpuRows(body);
  if (inHouse) body.appendChild(h('div', { cls: 'setrow' }, [h('span', { text: 'あそび方' }), h('button', { cls: 'btn sm', text: 'もう一度見る', onclick: () => { closeModal(); setTimeout(() => startCoach(), 150); } })]));
  body.appendChild(h('div', { cls: 'setrow' }, [h('span', { cls: hasNewUpdates() ? 'upd-new' : null, text: 'アップデート情報' }), h('button', { cls: 'btn sm', text: '見る', onclick: () => openUpdates(() => { paintUpdDot(); settingsDlg(); }) })]));
  if (!inHouse) body.appendChild(h('p', { cls: 'set-note', text: 'ほかの設定は、チーミの家に入ってから 家の中の「設定」ボタン（歯車）で出ます' }));
  else if (me && me.staff) body.appendChild(h('div', { cls: 'setrow' }, [h('span', { text: '担任助手の me-' }), h('button', { cls: 'btn sm', text: '見た目をかえる', onclick: () => { closeModal(); editStaffMe(staffList().find(p => p.id === me.staffId) || null); } })]));
  else body.appendChild(h('div', { cls: 'setrow' }, [h('span', { text: 'me-（見た目）' }), h('button', { cls: 'btn sm', text: 'つくりなおす', onclick: async () => { closeModal(); if (await requirePin()) editMe(); } })]));
  if (inHouse && me && !me.staff) body.appendChild(h('div', { cls: 'setrow' }, [h('span', { text: 'プレゼントコード' }), h('button', { cls: 'btn sm', text: 'コードを入れる', onclick: () => { closeModal(); giftCodeDlg(); } })]));
  if (inHouse && devpinOk(me)) {   // この端末に番号を覚えさせる／わすれる
    const dp = devpinGet(), on = !!dp && dp.uid === me.uid, uid = me.uid;
    body.appendChild(h('div', { cls: 'setrow' }, [h('span', { style: 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0', text: 'この端末に番号を覚えさせる' }), h('button', { cls: 'btn sm', style: 'white-space:nowrap;flex-shrink:0', text: on ? 'わすれる' : '覚えさせる', onclick: async () => {
      closeModal();
      if (on) { devpinDrop(); devpinNoSet(uid, true); toast('この端末は番号をわすれました', 'ok'); }
      else { devpinNoSet(uid, false); pinCache = { uid: null, pin: '', until: 0 }; const v = await getPin(true); if (v) { devpinSet(uid, v); toast('この端末に番号を覚えさせました', 'ok'); } }
      settingsDlg();
    } })]));
  }
  if (hasKeyboard()) body.appendChild(h('div', { cls: 'setrow' }, [h('span', { text: 'キーボードのショートカット' }), h('button', { cls: 'btn sm', style: 'white-space:nowrap', text: '一覧を見る', onclick: () => { closeModal(); keyHelpDlg(); } })]));
  if (staffOk()) body.appendChild(h('div', { cls: 'setrow' }, [h('span', { text: '担任助手の人へ' }), h('button', { cls: 'btn sm', text: '担任助手モード', onclick: () => { closeModal(); gateAdmin(); } })]));
  modal('設定', body, [h('button', { cls: 'btn', text: 'とじる', onclick: closeModal })]);
}
function afterLoad() { ghost = null; multi = null; setMultiBtn(); buildGhost(); selUid = null; setCamMode('iso'); paintCam(); tk('avatars', rebuildAvatars); tk('buildHouse', rebuildRoom); tk('rooms', renderRooms); renderHud(); renderBar(); tk('panel', renderPanel); }
// ===== 画面の切り替え：チーミ選択 → メンバー選択 → 家 =====
// me-未作成・ニックネーム未設定なら作成画面へ。番号(PIN)未設定（リセット後）なら決め直してから入る
function enterAs(teamId, uid) {
  const t = S.teams.find(x => x.id === teamId && x.confirmed), st = studentById(uid); if (!t || !st) return;
  if (SV.on) { enterServer(t, st); return; }
  if (!st.me || !st.nick) { makeFlow(t, st, st.me, st.nick); return; }
  if (!st.pin) { pinSet({ face: faceImg(st.me, 'face', 'face'), who: nickOf(st) }).then(np => { if (!np) return; st.pin = pinHash(np, st.uid); pinUntil.set(st.uid, Date.now() + 300000); save(); startHouse(t, st); }); return; }
  startHouse(t, st);
}
function makeFlow(t, st, me0, nick0) {
  openMeMaker({ me: me0, nick: nick0, nextLabel: 'つぎへ（番号をきめる）', cancelLabel: 'もどる', onDone: async (m, nick) => {
    const np = await pinSet({ face: faceImg(m, 'face', 'face'), who: nick, step: '3/3' });
    if (!np) { makeFlow(t, st, m, nick); return; }
    st.me = m; st.nick = nick; st.pin = pinHash(np, st.uid); pinUntil.set(st.uid, Date.now() + 300000); save(); toast('me-を作りました', 'ok'); startHouse(t, st);
  } });
}
// 家の中から、見た目だけ作りなおす（ニックネームも変えられる）
// きせかえを自分のピコで買う（4桁番号を確かめる）。買った物は st.wear に入る（サーバー版は buy_wear で価格をサーバーが確かめる）
const wearPriceOf = (k, i) => Math.round(WEAR[k][i][1] * mul());
async function buyWear(st, k, i) {
  const p = wearPriceOf(k, i); if (st.picos < p) { toast('ピコが足りません', 'ng'); sfx('ng'); return false; }
  if (!await requirePin()) return false;
  if (SV.on) {
    const r = await svCall('buy_wear', { p_uid: st.uid, p_pin: pinCache.pin, p_key: k + i });
    if (!r || !r.ok) { if (r) { if (r.err === 'pin' || r.err === 'locked') dropPin(); toast(errText(r.err), 'ng'); } sfx('ng'); return false; }
    st.picos = Math.max(0, st.picos - p); st.wear = (st.wear || []).concat(k + i); sfx('buy'); renderHud(); return true;
  }
  if (me === st) addPts(-p); else st.picos -= p;
  st.wear = (st.wear || []).concat(k + i); sfx('buy'); save(); renderHud(); return true;
}
function editMe(tab, focus) {
  const st = me;
  // きせかえショップ（買い方は buyWear）
  const shop = { owned: (k, i) => (st.wear || []).includes(k + i), price: wearPriceOf, picos: () => st.picos, picosText: () => pfmt(st.picos), buy: (k, i) => buyWear(st, k, i) };
  // くつしたは schema 版12（wear_items に socks が入る）から、ペットは版13（wear_items に pet が入る）から。サーバーの更新前は、買えないのでタブを出さない
  openMeMaker({ me: st.me, nick: st.nick, shop, noSocks: SV.on && !(SV.schema >= 12), noPet: SV.on && !(SV.schema >= 13), noPetw: SV.on && !(SV.schema >= 24), noPetHome: SV.on && !(SV.schema >= 28), wearOnly: tab === 'wear', focus, onCancel: () => renderPanel(), tab: typeof tab === 'number' ? tab : 0, nextLabel: 'これでけってい', cancelLabel: 'やめる', onDone: async (m, nick) => {
    if (SV.on) {
      const r = await svCall('set_profile', { p_uid: st.uid, p_pin: pinCache.pin, p_nick: nick, p_me: m, p_new_pin: null });
      if (!r || !r.ok) { if (r) { if (r.err === 'pin' || r.err === 'locked') dropPin(); toast(errText(r.err), 'ng'); } return; }
      await pullApply(true); meChipKey = ''; renderHud(); renderPanel(); toast('me- を変更しました', 'ok'); return;
    }
    st.me = m; st.nick = nick; save(); meChipKey = ''; rebuildAvatars(); renderHud(); renderPanel(); toast('me- を変更しました', 'ok');
  } });
}
// 担任助手として家を見に行く（財布なし。家具の移動・しまう・売るは担任助手の権限でできる）
// 担任助手の姿は「担任助手me-」（担任助手モードで作る）から選ぶ。この端末で最後に使った人を覚えておく
const STAFFKEY = 'kojoHouse.staffId';
const getStaffId = () => { try { return localStorage.getItem(STAFFKEY) || ''; } catch (e) { return ''; } };
const setStaffId = id => { try { localStorage.setItem(STAFFKEY, id); } catch (e) { } };
const staffList = () => S.staffMes || [];
const makeStaff = p => ({ uid: '__staff', staff: true, staffId: p ? p.id : null, nick: p ? p.nick : '担任助手', picos: 0, earned: 0, inv: {}, me: p && p.me ? p.me : null });
function pickStaff() {
  const L = staffList(); if (L.length <= 1) return Promise.resolve(L[0] || null);
  const last = L.find(p => p.id === getStaffId()); if (last) return Promise.resolve(last);
  return new Promise(res => {
    const body = h('div', { cls: 'staff-pick' });
    L.forEach(p => body.appendChild(h('button', { cls: 'btn staff-pickbtn', onclick: () => { closeModal(); setStaffId(p.id); res(p); } }, [p.me ? faceImg(p.me, 'face', 'mini') : h('span', { cls: 'mini none' }), h('b', { text: '★' + p.nick })])));
    modal('どの担任助手？', body, [h('button', { cls: 'btn', text: 'やめる', onclick: () => { closeModal(); res(undefined); } })]);
  });
}
async function visitTeam(teamId) {
  const t = S.teams.find(x => x.id === teamId && x.confirmed); if (!t) { toast('確定したチーミだけ見に行けます', 'ng'); return; }
  const prev = me && me.staff ? staffList().find(p => p.id === me.staffId) : null;
  const p = prev || await pickStaff(); if (p === undefined) return;
  startHouseNow(t, makeStaff(p)); adminOn = true; tab = 'inv'; renderHud(); renderPanel(); toast(t.name + 'の家を見ているよ（担任助手）', 'ok');
  if (!p) toast('担任助手モードの「担任助手me-」で、自分の me- を作れます', 'ok');
}
// 見るだけで家に入る（パスワードなし）。何を動かしても保存されない（adminOn=false・commitHouse は止める）
async function watchTeam(teamId) {
  const t = S.teams.find(x => x.id === teamId && x.confirmed); if (!t) { toast('確定したチーミだけ見に行けます', 'ng'); return; }
  if (T) leaveTeam();
  const st = makeStaff(null); st.watch = true; st.nick = '見学'; startHouseNow(t, st); adminOn = false; tab = 'inv'; renderHud(); renderPanel(); toast(t.name + 'の家を見ているよ（見るだけ・保存されません）', 'ok');
}
// ほかのチーミの家へ（担任助手だけ。生徒はあいことばが無いと入れない）
function teamJumpDlg() {
  if (!me || !me.staff) return;
  const body = h('div', { cls: 'picklist' });
  S.teams.filter(t => t.confirmed).forEach(t => body.appendChild(h('button', { cls: 'btn pickbtn' + (T && t.id === T.id ? ' mint' : ''), onclick: () => { closeModal(); if (T && t.id === T.id) return; leaveTeam(); visitTeam(t.id); } }, [h('span', { cls: 'a', text: t.name }), h('span', { cls: 'b', text: t.members.length + '人' + ((t.notes || []).length ? '・伝言 ' + t.notes.length : '') })])));
  modal('ほかのチーミの家へ', body, [h('button', { cls: 'btn', text: 'やめる', onclick: closeModal })]);
}
// 担任助手のme-を作る・変える（担任助手モードの中・家を見ているときの設定から）
function editStaffMe(p, after) {
  openMeMaker({ me: p && p.me, nick: p ? p.nick : '', allWear: true, top: true, nextLabel: 'これでけってい', cancelLabel: 'やめる', onDone: async (m, nick) => {
    const id = p ? p.id : 's' + Date.now().toString(36);
    if (SV.on) {
      const r = await svCall('admin_staff_save', { p_admin: SV.adminPass, p_id: id, p_nick: nick, p_me: m });
      if (!r || !r.ok) { if (r) toast(errText(r.err), 'ng'); return; }
      await pullApply(true);
    } else {
      const L = S.staffMes = S.staffMes || [], i = L.findIndex(x => x.id === id), o = { id, nick, me: m };
      if (i >= 0) L[i] = o; else L.push(o); saveNow();
    }
    setStaffId(id);
    if (me && me.staff && (!me.staffId || me.staffId === id)) { me.staffId = id; me.nick = nick; me.me = m; meChipKey = ''; rebuildAvatars(); renderHud(); }
    toast('担任助手の me- を保存しました', 'ok'); if (after) after();
  } });
}
// ===== 家の伝言板：担任助手だけが書ける。生徒は自分のチーミの家で読む =====
const SEENKEY = 'kojoHouse.seenNotes';
const seenNotes = () => { try { return JSON.parse(localStorage.getItem(SEENKEY) || '{}') || {}; } catch (e) { return {}; } };
const unreadNotes = t => { const s = seenNotes()[t.id] || 0; return (t.notes || []).filter(n => n.at > s).length; };
function markNotesSeen(t) { const s = seenNotes(), last = Math.max(0, ...(t.notes || []).map(n => n.at)); s[t.id] = last; try { localStorage.setItem(SEENKEY, JSON.stringify(s)); } catch (e) { } }
function paintNotesBtn() {
  const b = $('btnNotes'), j = $('btnTeams'); if (!b) return;
  if (!T) { b.hidden = true; if (j) j.hidden = true; return; }
  const n = (T.notes || []).length, u = me && me.staff ? 0 : unreadNotes(T);
  b.hidden = !n && !(me && me.staff); setTl(b, '伝言板' + (n ? '（' + n + '）' : '')); b.classList.toggle('new', u > 0);
  if (j) j.hidden = !(me && me.staff);
}
const fmtAt = ms => { const d = new Date(ms); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
function notesDlg() {
  if (!T) return; const t = T, staff = !!(me && me.staff && adminOn);
  const body = h('div', { cls: 'notes' }), list = h('div', { cls: 'note-list' });
  const paint = () => {
    list.innerHTML = ''; const L = (t.notes || []).slice().reverse();
    if (!L.length) list.appendChild(emptyBox('chat', staff ? 'まだ伝言はありません' : 'まだ伝言はありません', staff ? '下から書けます' : ''));
    L.forEach(n => list.appendChild(h('div', { cls: 'note' }, [h('div', { cls: 'note-hd' }, [h('b', { text: '★' + (n.by || '担任助手') }), h('span', { text: fmtAt(n.at) }), staff ? h('button', { cls: 'note-x', text: '×', 'aria-label': 'この伝言を消す', onclick: () => delNote(t, n, paint) }) : null]), h('div', { cls: 'note-tx', text: n.text })])));
  };
  paint(); body.appendChild(list);
  if (staff) {
    const ta = h('textarea', { cls: 'ta note-in', rows: '3', maxlength: '200', placeholder: t.name + 'のみんなへ（200文字まで）' });
    body.appendChild(ta); body.appendChild(h('button', { cls: 'btn coral', text: '伝言を書く', onclick: async () => { const tx = ta.value; if (await addNote(t, tx)) { ta.value = ''; paint(); if (T === t && me && me.staff) sayAvatar(me.uid, tx.trim().slice(0, 200)); ta.focus(); } } }));   // 書いたあともダイアログは開いたまま（続けて書ける）
  } else body.appendChild(h('div', { cls: 'hint', text: '伝言板は担任助手からのお知らせです' }));
  markNotesSeen(t); paintNotesBtn();
  modal(t.name + 'の伝言板', body, [h('button', { cls: 'btn', text: 'とじる', onclick: closeModal })]);
}
async function addNote(t, text) {
  text = String(text || '').trim().slice(0, 200); if (!text) { toast('伝言を書いてください', 'ng'); return false; }
  const by = (me && me.nick) || '担任助手';
  if (SV.on) { const r = await svCall('admin_note_add', { p_admin: SV.adminPass, p_team: t.id, p_by: by, p_body: text }); if (!r || !r.ok) { if (r) toast(errText(r.err), 'ng'); return false; } await pullApply(true); const nt = S.teams.find(x => x.id === t.id); if (nt) t.notes = nt.notes; }
  else { t.notes = (t.notes || []).concat({ id: String(Date.now()), at: Date.now(), by, text }).slice(-100); saveNow(); }
  sfx('tap'); toast('伝言を書きました', 'ok'); paintNotesBtn(); return true;
}
async function delNote(t, n, after) {
  if (!await confirmDlg('この伝言を消しますか？', '消す')) return;
  if (SV.on) { const r = await svCall('admin_note_delete', { p_admin: SV.adminPass, p_id: n.id }); if (!r || !r.ok) { if (r) toast(errText(r.err), 'ng'); return; } await pullApply(true); const nt = S.teams.find(x => x.id === t.id); if (nt) t.notes = nt.notes; }
  else { t.notes = (t.notes || []).filter(x => x !== n); saveNow(); }
  paintNotesBtn(); after();
}
// ===== 週間ミッション：チーミ全員が条件を達成したら、ひとりずつ報酬を受け取れる =====
// 生徒の画面には「何人中何人が達成」だけを出す（ひとりひとりのコマ数は出さない）
const PHASE = { now: ['実施中', 'ok'], soon: ['これから', ''], over: ['終わった', 'dim'] };
const missionsSorted = () => { const ord = { now: 0, soon: 1, over: 2 }, today = todayStr(); return (S.missions || []).slice().sort((a, b) => ord[phaseOf(a, today)] - ord[phaseOf(b, today)] || (phaseOf(a, today) === 'over' ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start))); };
function missionStat(m, t) {
  if (!t) return { done: 0, total: 0, achieved: false };
  if (SV.on) return (m.teams && m.teams[t.id]) || { done: 0, total: t.n || t.members.length, achieved: false };
  return localTeamStatus(m, t, studentById);
}
const canClaim = m => !!(T && me && !me.staff && phaseOf(m) !== 'soon' && missionStat(m, T).achieved && !(m.claims || []).includes(me.uid));
// 目安箱：道具の並び（右はしレールのときはレール）のボタン。担任助手モードで「あり」のときだけ出る（サーバーが古い版・担任助手の me-・端末だけのモードでは出さない）
function paintMeyasuBtn() {
  const b = $('btnMeyasu'); if (!b) return;
  const on = !!T && !!me && !me.staff && sugAvailable(); const was = b.hidden; b.hidden = !on;
  if (on && !b._ok) { b._ok = true; b.innerHTML = POST_ICO + '<span class="tl">目安箱</span>'; b.onclick = () => suggestDlg({ nick: nickOf(me), getPin, dropPin, post: (body, pin) => svCall('suggestion_post', { p_uid: me.uid, p_pin: pin, p_body: body }) }); }
  if (was !== b.hidden) railFit();   // 出す・出さないが変わったら、右はしレールの並びを詰め直す
}
function paintMissionBtn() {
  const b = $('btnMission'); if (!b) return;
  const L = T ? missionsSorted().filter(m => phaseOf(m) !== 'over' || canClaim(m)) : [], pend = !!T && !L.length && msPending();
  b.hidden = !T || (!L.length && !pend && !(me && me.staff)); if (b.hidden) b._sig = '';
  const nw = L.some(canClaim); b.classList.toggle('new', nw);
  if (b.hidden) return;
  if (pend) {   // まだ読んでいない：同じ大きさの、光が流れる枠（「ありません」は出さない）
    if (b._sig === 'pend') return; b._sig = 'pend'; b.innerHTML = '';
    b.appendChild(h('span', { cls: 'mc-hd' }, [h('b', { text: 'ミッション' }), h('span', { cls: 'tag', text: '実施中', style: 'visibility:hidden' })]));
    b.appendChild(h('span', { cls: 'mc-t sk-b', text: 'ミッションを読み込み中' })); b.appendChild(h('span', { cls: 'mc-row sk-b' }, [h('b', { cls: 'mc-n', text: '0/0人' })])); b.appendChild(h('span', { cls: 'mc-mine sk-b' }, [h('span', { text: 'あなた' }), h('b', { text: '0/0コマ' }), h('span', { text: 'あと0' })]));
    return;
  }
  // 部屋の左上の小さなカード：ミッション名・チーミの達成人数・自分のコマ数。タップでくわしく（missionDlg）
  const m = L.find(canClaim) || L[0], st = m ? missionStat(m, T) : null;
  // 500msごとに呼ばれるので、表示が変わらないときは作り直さない（性能）
  const c0 = !nw && m && me && !me.staff && phaseOf(m) !== 'soon' ? missionCounts(m, T, paintMissionBtn) : null;
  // 自分のコマ数：読めたらそれ／まだなら前に覚えた値／それも無ければ光が流れる枠（読めなかったときだけ出さない）
  const mk = m ? m.id + '|' + T.id : '', want = !nw && m && me && !me.staff && phaseOf(m) !== 'soon';
  let mv = null, mpend = false; if (want) { if (c0) mv = c0[me.uid] || 0; else if (SV.on && progCache.get(mk) !== false) { mv = mineGet(mk); mpend = mv == null; } }
  const sig = [m && m.id, m && m.title, nw, st && st.done, st && st.total, m && phaseOf(m), mv, mpend, me && me.staff].join('|');
  if (b._sig === sig) return; const wasWait = b._sig === 'pend' || b._mp; b._sig = sig; b._mp = mpend;
  b.classList.toggle('fresh', !!wasWait);
  b.innerHTML = '';
  b.appendChild(h('span', { cls: 'mc-hd' }, [
    h('svg-ico'), h('b', { text: 'ミッション' }),
    m ? h('span', { cls: 'tag ' + PHASE[phaseOf(m)][1], text: PHASE[phaseOf(m)][0] }) : null,
    h('span', { cls: 'mc-more', text: 'くわしく ›' })
  ]));
  b.querySelector('svg-ico').outerHTML = '<svg class="ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4M5 4h12l-2.5 4 2.5 4H5"/></svg>';
  if (!m) { b.appendChild(h('span', { cls: 'mc-none', text: '今はミッションがありません' })); b.title = '週間ミッション'; return; }
  const pct = st.total ? Math.round(st.done / st.total * 100) : 0;
  b.appendChild(h('span', { cls: 'mc-t', text: m.title }));
  b.appendChild(h('span', { cls: 'mc-row' }, [h('span', { cls: 'mc-bar' }, [h('i', { style: 'width:' + pct + '%' })]), h('b', { cls: 'mc-n', text: st.done + '/' + st.total + '人' })]));
  if (nw) b.appendChild(h('span', { cls: 'mc-claim', text: '報酬を受け取れます', ico: 'gift', icoSize: 14 }));
  else if (mpend) b.appendChild(h('span', { cls: 'mc-mine sk-b' }, [h('span', { text: 'あなた' }), h('b', { text: '0/0コマ' }), h('span', { text: 'あと0' })]));
  else if (me && !me.staff && phaseOf(m) !== 'soon') {
    const v = mv;
    if (v != null) b.appendChild(h('span', { cls: 'mc-mine' + (v >= m.need ? ' ok' : '') }, [h('span', { text: 'あなた' }), h('b', { text: v + '/' + m.need + 'コマ' }), h('span', { text: v >= m.need ? '✓' : 'あと' + (m.need - v) }) ]));
  }
  b.title = nw ? 'ミッション達成。報酬を受け取れます' : '週間ミッション：' + m.title + '（' + st.done + '/' + st.total + '人 達成）';
}
const rewardText = m => [m.picos ? fmt(m.picos) + ' ピコ' : '', m.item && ITEM[m.item] ? ITEM[m.item].name : ''].filter(Boolean).join(' ＋ ') || 'なし';
// パネルの「ミッション」タブ と ミッションのボタン（同じ中身）
function missionDlg() { if (!T) return; const body = h('div'); missionView(body); modal('週間ミッション', body, [h('button', { cls: 'btn', text: 'とじる', onclick: closeModal })], 'wide'); }
// ひとりひとりの受講コマ数（ノルマに対してどれだけか）。見せるのは自分のチーミの中だけ
// サーバー版は、チーミのあいことばで確かめてから読む（mission_progress）。読めないときは出さない
const progCache = new Map(), progT = new Map(), progBusy = new Set(), progSubs = new Set();   // 達成状況：値／読んだ時刻／読んでいる最中／届いたら知らせてほしい画面
// 自分のコマ数だけ端末に覚える（次に開いたとき、読み込みを待たずに出す）。ほかの人のコマ数は覚えない
const MINEKEY = 'kojoHouse.msMine';
function mineGet(k) { try { const o = JSON.parse(localStorage.getItem(MINEKEY) || '{}'); return o && me && o.uid === me.uid && o.v && typeof o.v[k] === 'number' ? o.v[k] : null; } catch (e) { return null; } }
function mineSet(k, n) { try { if (!me || me.staff) return; let o = JSON.parse(localStorage.getItem(MINEKEY) || '{}'); if (!o || o.uid !== me.uid) o = { uid: me.uid, v: {} }; o.v = o.v || {}; o.v[k] = n; const ks = Object.keys(o.v); if (ks.length > 12) delete o.v[ks[0]]; localStorage.setItem(MINEKEY, JSON.stringify(o)); } catch (e) { } }
const msPending = () => SV.on && SV.missionsOk === null;   // サーバーから週間ミッションをまだ読んでいない
function missionCounts(m, t, repaint) {
  if (!SV.on) return m.counts || {};
  const k = m.id + '|' + t.id, c = progCache.get(k), at = progT.get(k);
  // 前の値は消さずに（いったん出して）裏で読み直す。届いたら、見ている画面を「その部分だけ」差し替える
  if (!progBusy.has(k) && !(at && Date.now() - at < 15000)) {
    progBusy.add(k);
    const done = () => { const fs = [...progSubs]; progSubs.clear(); fs.forEach(f => f()); };
    svRpc('mission_progress', { p_id: m.id, p_team: t.id, p_pass: getTeamCode(t.id) || '' }).then(r => {
      progBusy.delete(k); progT.set(k, Date.now()); progCache.set(k, r && r.ok ? r.counts || {} : false);
      if (r && r.ok && me && !me.staff) mineSet(k, (r.counts || {})[me.uid] || 0);
      done();
    }).catch(() => { progBusy.delete(k); progT.set(k, Date.now()); if (c === undefined) progCache.set(k, false); done(); });
  }
  if (repaint && (progBusy.has(k) || c === undefined)) progSubs.add(repaint);
  return c || null;
}
// ミッションを開くたびに読み直す（担任助手が記録したら反映されるように）。前に読めた値は残す（開いた瞬間から出す）
const clearProg = () => progT.clear();
// 見ている「ミッション」の表示（パネルとダイアログ）。更新は、変わった所の文字・幅だけを差し替える（作り直さない）
const msViews = new Set();
function msViewsUpdate() { msViews.forEach(v => { if (!v.body.isConnected || !T || v.tid !== T.id) msViews.delete(v); else v.update(); }); }
const msSetText = (el, v) => { if (el.textContent === v) return; el.textContent = v; if (el.dataset.ready) { el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); } };
// チーミのひとりひとり。形は最初から決まっていて（届く前は同じ大きさの光る枠）、届いたら fill で数字だけ入れる
function memberBox(m, t) {
  const mem = t.members.map(studentById).filter(s => s && !s.staff), box = h('div', { cls: 'ms-mem' }), mk = m.id + '|' + t.id, isMe = me && !me.staff;
  let mine = null;
  if (isMe) {
    mine = { row: h('div', { cls: 'ms-mine' }, [h('span', { cls: 'mm-k', text: 'あなた' }), h('b', { cls: 'mm-n', text: '0 / ' + m.need + 'コマ' }), h('span', { cls: 'mm-bar' }, [h('i')]), h('span', { cls: 'mm-s', text: 'あと' + m.need + 'コマ' })]) };
    mine.n = mine.row.querySelector('.mm-n'); mine.bar = mine.row.querySelector('i'); mine.s = mine.row.querySelector('.mm-s'); box.appendChild(mine.row);
  }
  const list = h('div', { cls: 'ms-chips' }), chips = mem.map(s => {
    const b = h('b', { text: '0コマ' }), el = h('span', { cls: 'ms-chip' + (me && s.uid === me.uid ? ' me' : '') }, [s.me ? faceImg(s.me, 'face', 'mc-f') : h('span', { cls: 'mc-f none' }), h('span', { cls: 'mc-n', text: nickOf(s) }), b]);
    list.appendChild(el); return { s, el, b };
  });
  box.appendChild(list);
  const fill = c => {
    const known = c ? (isMe ? c[me.uid] || 0 : null) : (isMe ? mineGet(mk) : null);   // 自分の分だけは、前に覚えた値を先に出す
    if (mine) {
      const ok = known != null && known >= m.need, wait = known == null;
      mine.row.classList.toggle('ok', ok); mine.n.classList.toggle('sk-b', wait); mine.s.classList.toggle('sk-b', wait); mine.bar.parentNode.classList.toggle('sk-b', wait);
      if (!wait) { msSetText(mine.n, known + ' / ' + m.need + 'コマ'); mine.bar.style.width = Math.min(100, Math.round(known / m.need * 100)) + '%'; msSetText(mine.s, ok ? '達成 ✓' : 'あと' + (m.need - known) + 'コマ'); mine.n.dataset.ready = mine.s.dataset.ready = '1'; }
    }
    chips.forEach(x => {
      if (!c) { x.b.classList.add('sk-b'); return; }
      const v = c[x.s.uid] || 0, ok = v >= m.need; x.b.classList.remove('sk-b'); x.el.classList.toggle('ok', ok); msSetText(x.b, v + 'コマ' + (ok ? ' ✓' : '')); x.b.dataset.ready = '1';
    });
  };
  fill(null); return { box, fill };
}
function missionView(outer) {
  clearProg();
  let t = T; const body = h('div', { cls: 'missions' }); outer.appendChild(body);
  const view = { body, tid: t.id, update: () => { } }; body._ms = view; msViews.add(view);
  let sigS = null, cards = [];
  const noteText = (m, ph, st) => me && me.staff ? '受講コマ数は 担任助手モードの「ミッション」で記録します' : ph === 'soon' ? '開始までお待ちください' : st.achieved ? '' : ph === 'over' ? '達成なし' : 'あと ' + Math.max(0, st.total - st.done) + '人で達成';
  const structOf = L => L.length ? L.map(m => { const st = missionStat(m, t); return [m.id, m.title, m.start, m.end, m.need, m.picos, m.item, phaseOf(m), me && (m.claims || []).includes(me.uid), canClaim(m), st.achieved, me && me.staff, t.name, t.members.join(',')].join('~'); }).join('|') : msPending() ? 'pend' : 'none';
  const paint = () => {
    body.innerHTML = ''; cards = [];
    const L = missionsSorted(); sigS = structOf(L);
    if (!L.length) { body.appendChild(msPending() ? h('div', { cls: 'ms-card' }, [h('div', { cls: 'ms-hd' }, [h('b', { cls: 'sk-b', text: 'ミッションを読み込み中' })]), h('div', { cls: 'ms-cond sk-b', text: '条件：読み込み中' }), h('div', { cls: 'ms-bar' }, [h('i')]), h('div', { cls: 'ms-prog sk-b', text: 'チーミ：0 / 0人 達成' }), h('div', { cls: 'ms-rew sk-b', text: '報酬（ひとりずつ）：読み込み中' })]) : emptyBox('target', '今はミッションがありません', '次のミッションをお待ちください')); return; }
    L.forEach(m => {
      const ph = phaseOf(m), st = missionStat(m, t), got = me && (m.claims || []).includes(me.uid), pct = st.total ? Math.round(st.done / st.total * 100) : 0;
      const it = m.item && ITEM[m.item];
      let act, note = null;
      if (me && me.staff) act = note = h('span', { cls: 'ms-note', text: noteText(m, ph, st) });
      else if (got) act = h('span', { cls: 'ms-got', text: '受け取りずみ ✓' });
      else if (canClaim(m)) act = h('button', { cls: 'btn coral ms-claim', text: '報酬を受け取る', onclick: () => claimMission(m, update) });
      else act = note = h('span', { cls: 'ms-note', text: noteText(m, ph, st) });
      const mb = memberBox(m, t), bar = h('i', { style: 'width:' + pct + '%' }), pn = h('span', { cls: 'ms-pn' }), pc = h('span', { cls: 'ms-pc' }), prog = h('div', { cls: 'ms-prog' }, [pn, pc]);   // チーミ名（長ければ …）と人数（ひとかたまり）
      const card = h('div', { cls: 'ms-card' + (st.achieved ? ' done' : '') + (ph === 'over' ? ' over' : '') }, [
        h('div', { cls: 'ms-hd' }, [h('span', { cls: 'tag ' + PHASE[ph][1], text: PHASE[ph][0] }), h('b', { text: m.title }), h('span', { cls: 'ms-date', text: rangeText(m) })]),
        h('div', { cls: 'ms-cond', text: '条件：' + condText(m) }),
        h('div', { cls: 'ms-bar' }, [bar]), prog, mb.box,
        h('div', { cls: 'ms-rew' }, [h('span', { text: '報酬（ひとりずつ）：' }), it ? (() => { const im = h('img', { cls: 'ms-ico', alt: '' }); itemIcon(it, im); return im; })() : null, h('b', { text: rewardText(m) })]),
        h('div', { cls: 'ms-act' }, [act])
      ]);
      const upd = () => {
        const mm = (S.missions || []).find(x => x.id === m.id) || m, s2 = missionStat(mm, t), p2 = s2.total ? Math.round(s2.done / s2.total * 100) : 0;
        const w = p2 + '%'; if (bar.style.width !== w) bar.style.width = w;
        const tn = t.name + '：', tx = s2.done + ' / ' + s2.total + '人 達成' + (s2.achieved ? '　チーミ全員クリア！' : ''); if (pn.textContent !== tn) pn.textContent = tn; if (pc.textContent !== tx) pc.textContent = tx;
        if (note) { const nt = noteText(mm, phaseOf(mm), s2); if (note.textContent !== nt) note.textContent = nt; }
        const c = missionCounts(mm, t, update); mb.box.hidden = SV.on && !c && progCache.get(m.id + '|' + t.id) === false;
        mb.fill(c);
      };
      cards.push(upd); body.appendChild(card); upd();
    });
  };
  const update = () => {
    if (!body.isConnected || !T || T.id !== view.tid) return; t = T;
    const L = missionsSorted(); if (structOf(L) !== sigS) { paint(); return; }
    cards.forEach(f => f());
  };
  view.update = update;
  paint();
}
async function claimMission(m, after) {
  if (!canClaim(m)) return;
  if (SV.on) {
    const r = await svCall('mission_claim', { p_uid: me.uid, p_id: m.id }); if (!r) return;
    if (!r.ok) { toast(errText(r.err), 'ng'); sfx('ng'); await pullApply(true); after(); paintMissionBtn(); return; }
    await pullApply(true);
  } else {
    me.picos += m.picos; if (m.item && ITEM[m.item]) { me.inv = me.inv || {}; me.inv[m.item] = (me.inv[m.item] || 0) + 1; }
    m.claims = (m.claims || []).concat(me.uid); saveNow();
  }
  if (m.picos) floatText('+' + fmt(m.picos) + ' ピコ', 'p'); sfx('coin');
  toast('ミッション達成の報酬を受け取りました。' + (m.item && ITEM[m.item] ? '「' + ITEM[m.item].name + '」は持ち物に入りました' : ''), 'ok');
  const fresh = (S.missions || []).find(x => x.id === m.id); if (fresh) Object.assign(m, fresh);
  renderHud(); renderPanel(); paintMissionBtn(); after();
}
// ニックネームが空（担任助手が差し戻した）の人が家に入ったとき：付け直しを求める（番号を確かめてから、me- づくり画面のなまえタブ）
async function nickFixDlg() {
  if (!me || me.nick || me.staff || !T) return;
  if (!await confirmDlg('ニックネームを付け直してください（担任助手から名前の変更を依頼されています）', 'つけなおす', 'ニックネーム')) return;
  if (await requirePin()) editMe(0);
}
// ===== 利用時間（1日あたり。decisions #19）：家にいる時間を端末で日ごとに数え、残り5分で知らせ、超えたら「今日はここまで」 =====
// 対象：サーバー版の生徒だけ（担任助手のme-・担任助手モード・お試しは除く）。上限はサーバーの設定 SV.dailyMin（0＝無制限）。担任助手の「今日だけ解除」は SV.unlocks
const dailyApplies = () => SV.on && SV.dailyMin > 0 && !DEMOQ && !sampleMode;
const dailyState = st => dailyStatus(SV.dailyMin, dailyUsed(st.uid), SV.unlocks && SV.unlocks.has(st.uid));
const dailyBlocked = st => !!st && !st.staff && dailyApplies() && !adminOn && dailyState(st).over;
let dailyLast = 0, dailyEl = null;
function dailyTick() {
  const now = performance.now(), dt = dailyLast ? Math.min(2, (now - dailyLast) / 1000) : 0; dailyLast = now;
  if (!T || !me || me.staff || !dailyApplies() || adminOn || document.visibilityState !== 'visible' || dailyEl) return;
  dailyAdd(me.uid, dt); const s = dailyState(me);
  if (s.warn && dailyWarn(me.uid)) toast('あと ' + Math.max(1, Math.ceil(s.leftSec / 60)) + '分で、今日の利用時間です', 'ok');
  if (s.over) dailyEndScreen(me);
}
// 「今日はここまで。続きは明日」：家にいることはできないが、ホームのお知らせ・ランキングは見られる。担任助手が解除すれば続けられる
function dailyEndScreen(st) {
  if (dailyEl) return;
  let poll = 0;
  const close = () => { clearInterval(poll); if (dailyEl) dailyEl.remove(); dailyEl = null; };
  const recheck = async () => { await pullApply(true); if (!dailyBlocked(st)) { close(); toast('利用時間の制限が解除されました', 'ok'); return true; } return false; };
  poll = setInterval(recheck, 60000);
  dailyEl = h('div', { id: 'dailyEnd', role: 'dialog', 'aria-label': '今日はここまで' }, [h('div', { cls: 'de-box' }, [
    h('div', { cls: 'de-ico' }, [iconNode('moon', 56)]), h('h2', { text: '今日はここまで' }), h('p', { text: '続きは明日。今日の利用時間（' + SV.dailyMin + '分）を使い切りました' }),
    h('p', { cls: 'sub', text: 'ホームのお知らせとランキングは、いつでも見られます' }),
    h('div', { cls: 'de-acts' }, [h('button', { cls: 'btn coral big', text: 'ホームにもどる', onclick: () => { close(); if (T) leaveTeam(); } }), h('button', { cls: 'btn', text: '解除されたか確かめる', onclick: async () => { if (!await recheck()) toast('まだ解除されていません', 'ng'); } })])])]);
  document.body.appendChild(dailyEl);
}
// 計測（?test の確認用）：window.__kperf が配列のときだけ、区間ごとの所要ミリ秒を入れる。ふだんは何もしない
function tk(n, f) { const k = window.__kperf || window.__kpre; if (!k) return f(); const t0 = performance.now(), r = f(); k.push([n, +(performance.now() - t0).toFixed(1)]); return r; }
// 家に入る：押した位置からチーミの色の円が広がる→（おおったかげで家を組み立てる）→まん中から円が開いて家が見える。確認用ページ（?test=）は ?trans=1 のとき以外、幕なしですぐ入る
function startHouse(t, st) {
  if (dailyBlocked(st)) { renderSelect(); dailyEndScreen(st); return; }   // 今日の分を使いきっている人は、家に入れない
  if (!uiAnim()) { startHouseNow(t, st); return; }
  if (veilBusy()) return;   // 幕が動いている間の押し直しは無視
  warmGen++;   // 先読みは止める（入る準備は幕のかげで）
  const p = lastPress() || {};
  veilRun('enter', () => startHouseNow(t, st), { x: p.x, y: p.y, hue: hue(t.id), name: t.name, face: () => st.me ? faceImg(st.me, 'face', 'vface-i') : null, sfx, beforeOpen: dollyInit, onOpen: () => dollyGo(vdur(850), hue(t.id)) });
}
// 「ゲームを始める」の近道：この端末が覚えている情報だけで入れるとき（番号・あいことばの入力がいらない）。
// 押した瞬間に幕（transition.js の veilRun）を動かし始める。確かめ（あいことばの通信）・画面の切り替え・家の組み立ては、すべて幕がおおいきってから。押した直後に、メンバー画面や家が幕より先に見えない。
// 入れる条件に合わなければ false を返す（今までの道：メンバー画面 → 番号・あいことば → 家）。確かめに失敗したら、幕の下でメンバー画面を出す（幕が開くと見える）
function quickEnter(teamId, uid, authed) {
  const t = S.teams.find(x => x.id === teamId && x.confirmed), st = studentById(uid);
  if (!t || !st || st.staff || veilBusy()) return false;
  const own = SV.on ? (st.uid === getMyUid() && !!st.pin) : (!!st.me && !!st.nick && !!st.pin);
  if (!own || !(!SV.on || authed || !t.hasCode || !!getTeamCode(t.id)) || dailyBlocked(st)) return false;
  const swap = async () => {
    let ok = true;
    if (SV.on && !authed && t.hasCode) { try { const r = await svRpc('check_team_pass', { p_team: t.id, p_pass: getTeamCode(t.id) }); ok = !!(r && r.ok); } catch (e) { ok = false; } }
    if (ok) { if (screenCtx.markUnlocked) screenCtx.markUnlocked(t.id); startHouseNow(t, st); }
    else { toast('入れませんでした。もう一度えらんでください', 'ng'); if (screenCtx.quickFail) screenCtx.quickFail(t.id); }
  };
  if (!uiAnim()) { swap(); return true; }
  warmGen++;   // 先読みは止める（入る準備は幕のかげで）
  const p = lastPress() || {};
  veilRun('enter', swap, { x: p.x, y: p.y, hue: hue(t.id), name: t.name, face: () => st.me ? faceImg(st.me, 'face', 'vface-i') : null, sfx, beforeOpen: () => { if (T) dollyInit(); }, onOpen: () => dollyGo(vdur(850), hue(t.id)) });
  return true;
}
// 家に入る演出：3Dのカメラを、少し上・遠くから、いつもの位置へスーッと寄せる（cam の zoom と pany を時間で補間する。scene.js は触らない）。寄せ終わりに、家のまわりへ光の粒
let dolly = null;
function dollyInit() {
  if (reduceMotionNow()) { dolly = null; return; }
  dolly = { z1: cam.zoom, y1: cam.pany, z: cam.zoom * .74, y: cam.pany + .12 }; cam.zoom = dolly.z; cam.pany = dolly.y; cam.dirty = true;
}
function dollyGo(ms, hu) {
  const d = dolly; if (!d) return; const t0 = performance.now();
  const step = now => {
    if (dolly !== d || !T) return;
    if (cam.zoom !== d.z || cam.pany !== d.y) { dolly = null; return; }   // 途中で自分で動かしたら、そこでやめる
    const k = Math.max(0, Math.min(1, (now - t0) / ms)), e = 1 - Math.pow(1 - k, 3);
    d.z = cam.zoom = d.z0 + (d.z1 - d.z0) * e; d.y = cam.pany = d.y0 + (d.y1 - d.y0) * e; cam.dirty = true;
    if (k < 1) requestAnimationFrame(step); else { dolly = null; const r = $('cv').getBoundingClientRect(); sparkleBurst(r.left + r.width * .5, r.top + r.height * .56, hu); sfx('kiran'); }
  };
  d.z0 = d.z; d.y0 = d.y; requestAnimationFrame(step);
}
const reduceMotionNow = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
function startHouseNow(t, st) {
  syncLayout();
  picoHold = null; T = t; me = st; adminOn = false; if (S.cur.teamId !== t.id) S.cur = { teamId: t.id, room: 0, studentId: st.uid }; if (!st.staff) S.cur.studentId = st.uid; if (S.cur.room >= T.rooms.length) S.cur.room = 0;
  reuseHouse = !!warmHouse && warmHouse.tid === t.id && warmHouse.sig === houseSig(t, S.cur.room);
  $('select').hidden = true; $('app').classList.add('in-house'); tab = 'shop'; meChipKey = ''; lastPanelTab = tab;
  dispPts = me.picos; shownPts = -1; if (SV.on) { if (!st.staff) setMyUid(st.uid); lastRoomsJson = JSON.stringify(t.rooms); avKey = ''; } afterLoad(); save();
  houseEntered(t, st);
  if (!st.staff && pendingGift()) setTimeout(() => giftDlg(pendingGift()), 900);   // QRプレゼントを読んでから入ったとき
  if (SV.on && !st.staff && !st.nick) setTimeout(nickFixDlg, 500);   // 担任助手が名前を差し戻したとき：付け直す
  if (!st.staff && unreadNotes(t)) { toast('伝言板に担任助手からの新しい伝言があります', 'ok'); setTimeout(() => { if (T === t && me && me.uid === st.uid) staffSay(t, (t.notes || []).slice(-1)[0]); }, 700); }
  if ((S.missions || []).some(canClaim)) setTimeout(() => toast('チーミ全員でミッション達成。「ミッション」から報酬を受け取れます', 'ok'), 600);
}
// ===== 先読み（2026-11-18）：ホームを見ている間に、自分のチーミの家・家具・壁紙の見本・シェーダーを裏で準備する =====
// 「ゲームを始める」で固まる原因は、家の組み立て・家具のモデル・壁紙の見本の画像・初めて描くときのシェーダーのコンパイル。
// ホームの下（ホームが全面をおおっている）で、ブラウザがひまな時に 8ms ずつ進める。この端末が覚えている自分のチーミ1つ分だけ。入る操作が始まったら止める
let warmKey = '', warmGen = 0;
const idleRun = f => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 400 }) : setTimeout(f, 300));
function scheduleWarm() {
  if (T || me || !uiAnim() || document.hidden) return;
  const u = getMyUid(), st = u && studentById(u), t = st && !st.staff && st.me ? S.teams.find(x => x.confirmed && x.members.includes(u)) : null;
  if (!t) return;
  const key = t.id + '|' + t.version + '|' + t.rooms.length; if (key === warmKey) return;
  warmKey = key; const gen = ++warmGen, ok = () => gen === warmGen && !T && !me;
  const ids = [...new Set(t.rooms.flatMap(r => (r.items || []).map(i => i.id)).filter(id => ITEM[id]))];
  const pats = ITEMS.filter(d => !d.free && d.pat);
  const slice = work => { const t0 = performance.now(); while (performance.now() - t0 < 8 && work()) { } };
  const stepModels = () => { if (!ok()) return; slice(() => { if (!ids.length) return false; buildItem(ITEM[ids.shift()]); return true; }); idleRun(ids.length ? stepModels : stepPats); };
  const stepPats = () => { if (!ok()) return; slice(() => { if (!pats.length) return false; swatchUrl(pats.shift(), 176); return true; }); idleRun(pats.length ? stepPats : stepThumb); };
  const stepThumb = () => { if (!ok()) return; if (!thumb) thumbInit(); idleRun(stepScene); };
  const stepScene = () => {
    if (!ok()) return;
    const sc = S.cur, cr = sc.teamId === t.id && sc.room < t.rooms.length ? sc.room : 0; S.cur = { teamId: t.id, room: cr, studentId: st.uid }; T = t; me = st;
    try { tk('warm:scene', () => { rebuildAvatars(); rebuildRoom(); sync(); setCamMode('iso'); updateCamera(0, true); warmHouse = { tid: t.id, sig: houseSig(t, cr) }; warmAv = { key: avSig(AVS_STS()), list: AVS }; AVS = []; }); } catch (e) { console.error('warm', e); } finally { T = null; me = null; S.cur = sc; }
    // 描く：模様の画像などが読み終わるたびにシェーダー・画像の送り込みがやり直しになるので、読み込みが落ち着く（プログラム数・画像数が変わらなくなる）まで、0.7秒おきに最大6回
    const info = () => { const r = E.renderer.info || {}; return (r.programs ? r.programs.length : '') + '|' + (r.memory ? r.memory.textures : ''); };
    const render = (n, last) => { if (!ok()) return; cam.dirty = true; try { tk('warm:renderFrame', renderFrame); } catch (e) { console.error('warm render', e); } const now = info(); if (n < 6 && now !== last) setTimeout(() => idleRun(() => render(n + 1, now)), 700); };
    const rr = E.renderer; if (rr && rr.compileAsync) rr.compileAsync(E.scene, E.camera).then(() => idleRun(() => render(0, '')), () => idleRun(() => render(0, ''))); else idleRun(() => render(0, ''));
  };
  idleRun(stepModels);
}
// ===== おかえり・お祝い・はじめての案内・みんなの最近（2026-11-11） =====
// 端末ごと・人ごとに「前回見た時点」(kojoHouse.seen.<uid>)と、チーミの家具の一覧(kojoHouse.tsnap.<tid>)を覚える。サーバーは使わない
const hasQ = k => new URLSearchParams(location.search).has(k);
let lastRankIdx = 0, recent = [], recentNew = false;
const cumOf = st => { const u = st.uid; return { sc: st.lastScore != null ? st.lastScore : (S.lastScore || {})[u], st: st.lastStay != null ? st.lastStay : (S.lastStay || {})[u] }; };
const nowSeen = st => Object.assign({ e: st.earned || 0, rk: rankIdx(st.earned || 0) }, cumOf(st));
function snapSeen() {
  if (!T || !me || me.staff || (noSave && !window.__seenTest)) return;
  writeSeen(me.uid, nowSeen(me)); writeTeamSnap(T);
}
const teamSnapKey = t => 'kojoHouse.tsnap.' + t.id;
const itemMap = t => { const m = {}; (t.rooms || []).forEach(r => (r.items || []).forEach(i => { m[i.uid] = [i.id, i.owner || '']; })); return m; };
function writeTeamSnap(t) { try { localStorage.setItem(teamSnapKey(t), JSON.stringify({ items: itemMap(t), bank: t.picos })); } catch (e) { } }
function readTeamSnap(t) { try { return JSON.parse(localStorage.getItem(teamSnapKey(t)) || 'null'); } catch (e) { return null; } }
const ownerNick = u => { const x = u && studentById(u); return x ? nickOf(x) : ''; };
const itemLabel = ([id, ow]) => { const d = ITEM[id]; return d ? (ow ? ownerNick(ow) + 'の' : '') + d.name : ''; };
function pushRecent(text, ico) { recent.unshift({ text, ico }); if (recent.length > 20) recent.pop(); recentNew = true; $('btnRecent').classList.add('new'); }
// 前回の一覧と今の一覧の差から「みんなの最近」を作る（だれの物が置かれた・片付けられた、貯金箱の増減）
function diffInto(prevItems, prevBank, t) {
  const cur = itemMap(t); let added = 0, removed = 0;
  Object.keys(cur).forEach(u => { if (!prevItems[u] && added < 8) { added++; const l = itemLabel(cur[u]); if (l) pushRecent(l + 'が置かれました', 'in'); } });
  Object.keys(prevItems).forEach(u => { if (!cur[u] && removed < 4) { removed++; const l = itemLabel(prevItems[u]); if (l) pushRecent(l + 'が片付けられました', 'out'); } });
  if (prevBank != null && t.picos > prevBank) pushRecent('貯金箱に ' + fmt(t.picos - prevBank) + ' ピコが寄付されました', 'bank');
  else if (prevBank != null && t.picos < prevBank) pushRecent('貯金箱から ' + fmt(prevBank - t.picos) + ' ピコを使いました', 'bank');
}
function noteDiff(oldT, newT) { if (!oldT || oldT.id !== newT.id) return; diffInto(itemMap(oldT), oldT.picos, newT); }
function recentDlg() {
  const list = h('div', { cls: 'rc-list' });
  if (!recent.length) list.appendChild(emptyBox('home', 'まだ新しい動きはありません', 'チーミのだれかが家具を置いたり寄付したりすると、ここに出ます'));
  recent.forEach(r => list.appendChild(h('div', { cls: 'rc-row' }, [h('span', { text: r.text, ico: r.ico === 'bank' ? 'coin' : r.ico === 'out' ? 'box' : 'sofa', icoSize: 16 })])));
  modal('みんなの最近', list, [h('button', { cls: 'btn', text: 'とじる', onclick: closeModal })]); recentNew = false; $('btnRecent').classList.remove('new');
}
// ランクアップ：新しく解放された家具を見せて紙ふぶき（モーダルや案内が出ている間は待つ）
function checkRankUp() {
  if (!T || !me || me.staff) return; const ri = curRank();
  if (ri <= lastRankIdx || !$('modal').hidden || coachOpen() || $('cele')) return;
  const from = lastRankIdx; lastRankIdx = ri;
  const its = ITEMS.filter(d => !d.free && d.rank > from && d.rank <= ri).slice(0, 8).map(d => { const im = new Image(); im.alt = ''; im.width = 52; im.height = 52; if (d.pat) im.src = makeIcon(d, 104); else itemIcon(d, im); return { name: d.name, img: im }; });
  sfx('rank'); celebrate('ランクアップ  ' + CFG.RANKS[ri].name, its.length ? '新しい家具が解放されました' : '', its);
}
function houseEntered(t, st) {
  recent = []; recentNew = false; $('btnRecent').classList.remove('new'); $('btnRecent').hidden = !!st.staff;
  const seen = st.staff ? null : readSeen(st.uid), now = nowSeen(st), ts = readTeamSnap(t);
  lastRankIdx = seen && seen.rk != null ? Math.min(seen.rk, now.rk) : now.rk;
  if (ts) diffInto(ts.items || {}, ts.bank, t);
  const demoOnly = TESTQ && TESTQ !== 'coach' && TESTQ !== 'welcome' && TESTQ !== 'unlintro', persist = !noSave || !!window.__seenTest;
  const coachNext = () => { if (!st.staff && !coachSeen() && !demoOnly && !hasQ('nocoach')) setTimeout(() => { if (T && me === st && $('modal').hidden) startCoach(); }, 500); };
  const after = () => { snapSeen(); if (demoOnly) { coachNext(); return; } unlIntroMaybe(t, st, coachNext); };
  // 「前に見たとき」はサーバーが人ごとに覚えている（別の端末で見た分も含める。pico_seen が前の値を返しつつ今の値で更新するので、同時に2台で開いても演出は先の1台だけ）。
  // 古いサーバー・お試しは、今までどおりこの端末の記録で比べる。通信に失敗したら演出を出さず、記録もせず、次回に回す
  const run = (prevSv, nowE) => {
    const nw = nowE != null && isFinite(nowE) ? Object.assign({}, now, { e: nowE }) : now;
    const sn = prevSv != null ? Object.assign({ sc: null, st: null, rk: nw.rk }, seen || {}, { e: prevSv }) : seen;
    const g = !st.staff && sn && !demoOnly ? gainBreakdown(sn, nw, S.settings.rate, S.settings.stayRate || CFG.STAY_RATE) : null;
    if (g) {
      if (persist) writeSeen(st.uid, nw);
      const tot = g.total, tier = tot < 300 ? 0 : tot < 1500 ? 1 : 2; let wbRect = null;
      setTimeout(() => {
        if (!(T && me === st)) return;
        welcomeBack(nickOf(st), g, { tick: () => { sfx('tap'); if (!wbRect) { const e = document.querySelector('.wb-pico'); wbRect = e ? e.getBoundingClientRect() : null; } }, done: () => { sfx('coin'); picoPopFx(tier); }, onClose: () => { picoHoldRelease(tier, wbRect); after(); } });
        if (!unlimitedNow()) { picoHold = Math.max(0, me.picos - tot); dispPts = picoHold; }
      }, 500);
    } else { if (!st.staff && persist) writeSeen(st.uid, nw); after(); }
  };
  if (!st.staff && !demoOnly && SV.on && schemaAtLeast(PICO_SEEN_SCHEMA)) {
    svRpc('pico_seen', { p_uid: st.uid }).then(r => { if (!(T && me === st)) return; if (r && r.ok) run(r.prev == null ? undefined : +r.prev, +r.now); else after(); }, () => { if (T && me === st) after(); });
  } else run();
}
// 家を出たあとの行き先は、ホーム（大事なお知らせ・「ゲームを始める」がある最初の画面）。toMembers=true のときだけ、そのチーミのメンバー選択へ（「ほかの人に切り替える」）
function leaveTeam(toMembers) {
  snapSeen(); exitMulti(); cancelGhost(); selUid = null; const tid = T && T.id; if (SV.on) { clearTimeout(ct); if (!pendEmpty() || JSON.stringify(T.rooms) !== lastRoomsJson) commitHouse(); } T = null; me = null; adminOn = false; rebuildAvatars(); S.cur.teamId = null; save();
  const toHome = () => { $('app').classList.remove('in-house'); $('bar').hidden = true; $('select').hidden = false; if (toMembers === true && tid) { setInfoSeen(true); showTeamMembers(tid); renderSelect(); } else goHome(); };
  if (uiAnim() && !veilBusy() && $('select').hidden && tid) { const r = $('btnBack').getBoundingClientRect(); veilRun('leave', toHome, { x: r.left + r.width / 2, y: r.top + r.height / 2, hue: hue(tid), sfx }); } else toHome();   // 家 → ホーム：円が広がって家をおおい、ボタンへ縮んでホームが出る（状態はもう片づけ済み。幕が入力を止める）
}
// 担任助手モードを閉じたあと：名簿・チーミ・ピコの変化を画面に反映
function refreshAfterAdmin() {
  if (SV.on) { pullApply(true); return; }
  if (T) {
    const t = S.teams.find(x => x.id === T.id), st = me && (me.staff ? me : studentById(me.uid));
    if (!t || !t.confirmed || !st || (!st.staff && !t.members.includes(st.uid))) { T = null; leaveTeam(); return; }
    T = t; me = st; dispPts = me.picos; rebuildAvatars(); renderHud(); renderPanel();
  } else renderSelect();
}
// ===== サーバー連携（Supabase）=====
// 家の変更は、画面ではすぐ反映（楽観更新）して、RPC(house_commit)でまとめて保存する。競合したら最新を取り直す
const pend = { take: {}, give: {}, sell: [] };
const pendEmpty = () => !Object.keys(pend.take).length && !Object.keys(pend.give).length && !pend.sell.length;
let lastRoomsJson = '', committing = false, ct = 0, deferApply = false, avKey = '';
function showSchemaMissing() { SV.status = 'schema'; const el = $('err'); if (el) { el.hidden = false; el.textContent = 'サーバーの準備がまだです。担任助手に伝えてください（担任助手の人：supabase/schema.sql を実行してください）'; } }
function svFail(e) {
  console.error(e);
  if (e instanceof SvError && e.kind === 'schema') showSchemaMissing();
  else toast(e instanceof SvError && e.kind === 'offline' ? 'ネットにつながりません。少し待って、もう一度試してください' : 'うまくいきませんでした。もう一度試してください', 'ng');
}
async function svCall(name, args) { try { return await svRpc(name, args); } catch (e) { svFail(e); return null; } }
function commitSoon() { clearTimeout(ct); ct = setTimeout(commitHouse, 50); }
// ページを離れる・アプリが裏に回るとき：待っている保存をすぐ出す（サーバー版は家の保存／端末だけのときはローカルの保存）。commitHouse は、送信中・変更なしなら二重に送らない
function flushSave() {
  if (!SV.on) { saveNow(); return; }
  clearTimeout(ct); if (T && me && !me.watch && (JSON.stringify(T.rooms) !== lastRoomsJson || !pendEmpty())) commitHouse();
}
// 保存がぶつかったとき、自分の変更だけをサーバーの最新にのせ直した家を返す（のせられなければ null）。配置の検査は placeCheck / wallCheck（置くときと同じ）
function mergeConflict(team, ps) {
  if (!T || (ghost && ghost.from === 'move') || !lastRoomsJson || !team || !team.data || !Array.isArray(team.data.rooms)) return null;
  const fits = (rm, i) => { const d = ITEM[i.id]; if (!d) return false; return (d.wall ? wallCheck(rm, d, i.wall, i.pos, i.z, i.uid) : placeCheck(rm, d, i.x, i.y, i.rot, i.uid)).ok; };
  try { return mergeRooms(JSON.parse(lastRoomsJson), T.rooms, team.data.rooms, Object.assign({}, ps, pendS), fits); } catch (e) { return null; }
}
async function commitHouse() {
  if (!SV.on || !T || !me || me.watch) return;
  if (committing) { commitSoon(); return; }
  if (ghost && ghost.from === 'move') return;   // 動かし中は、置き終わってから
  const rj = JSON.stringify(T.rooms); if (rj === lastRoomsJson && pendEmpty()) return;
  const baseKey = lastKey(), ps = pendS; pendS = {}; const stateOnly = pendEmpty() && roomsKey(T.rooms) === lastKey();
  const tm = T, mm = me; committing = true; const take = pend.take, give = pend.give, sell = pend.sell; pend.take = {}; pend.give = {}; pend.sell = [];
  const needPin = Object.keys(give).length > 0 || sell.length > 0;
  let r = null, down = false, mg = null;
  try { r = await svRpc('house_commit', { p_uid: me.uid, p_pin: needPin ? pinCache.pin : null, p_admin: adminOn ? SV.adminPass : null, p_team: T.id, p_version: T.version, p_rooms: T.rooms, p_take: take, p_give: give, p_sell: sell }); }
  catch (e) { if (e instanceof SvError && e.kind === 'offline') { down = true; console.error(e); } else svFail(e); }   // つながらないだけなら、変更は持ったまま（下）。ほかの失敗は今までどおり
  committing = false;
  if (down) {   // つながらなかった：画面の変更は消さず、送れなかった分ももどして、あとで自動でやり直す（右上の自動セーブの表示が「もう一度」を出す）
    Object.keys(take).forEach(k => { pend.take[k] = (pend.take[k] || 0) + take[k]; });
    Object.keys(give).forEach(u => { const g = pend.give[u] = pend.give[u] || {}; Object.keys(give[u]).forEach(k => { g[k] = (g[k] || 0) + give[u][k]; }); });
    pend.sell = sell.concat(pend.sell); pendS = Object.assign({}, ps, pendS);
    if (deferApply) deferApply = false;
    return;
  }
  if (r && r.ok) { sRetry = 0; tm.version = r.version; RT.ping(r.version); if (T === tm) lastRoomsJson = rj; mm.inv = r.inv || {}; mm.picos = r.picos | 0; if (T === tm) renderPanel(); }
  else if (r && r.err === 'conflict' && r.team && r.team.data && Array.isArray(r.team.data.rooms) && T === tm && sRetry < 3 && roomsKey(r.team.data.rooms) === baseKey) {
    // 相手の変化が「状態（s）だけ」：警告も巻き戻しもなし。最新の s を取り込み（自分が変えた s は残す）、自分の変更を乗せ直して自動でやり直す
    sRetry++;
    Object.keys(take).forEach(k => { pend.take[k] = (pend.take[k] || 0) + take[k]; });
    Object.keys(give).forEach(u => { const g = pend.give[u] = pend.give[u] || {}; Object.keys(give[u]).forEach(k => { g[k] = (g[k] || 0) + give[u][k]; }); });
    pend.sell = sell.concat(pend.sell); pendS = Object.assign({}, ps, pendS);
    const sm = {}; r.team.data.rooms.forEach(rm => (rm.items || []).forEach(i => { sm[String(i.uid)] = i.s; }));
    T.rooms.forEach(rm => rm.items.forEach(i => { const u = String(i.uid); if (u in pendS) return; if (sm[u] === 1 || sm[u] === 0) i.s = sm[u]; else delete i.s; }));
    tm.version = r.team.version | 0; lastRoomsJson = JSON.stringify(r.team.data.rooms); applyStates(); commitSoon();
  }
  else if (r && r.err === 'conflict' && T === tm && sRetry < 3 && (mg = mergeConflict(r.team, ps))) {
    // 相手が家具を置く・動かす・しまう等をした：自分の変更だけを最新の家にのせ直して、警告なしで自動でやり直す（のせられないときは下の今までの扱い）
    sRetry++;
    Object.keys(take).forEach(k => { pend.take[k] = (pend.take[k] || 0) + take[k]; });
    Object.keys(give).forEach(u => { const g = pend.give[u] = pend.give[u] || {}; Object.keys(give[u]).forEach(k => { g[k] = (g[k] || 0) + give[u][k]; }); });
    pend.sell = sell.concat(pend.sell); pendS = Object.assign({}, ps, pendS);
    T.rooms = mg; tm.version = r.team.version | 0; lastRoomsJson = JSON.stringify(r.team.data.rooms);
    if (selUid != null && !findItem(selUid)) selUid = null;
    rebuildRoom(); renderBar(); fixAvatar(); applyStates(); if (ghost) evalGhost(); renderPanel(); commitSoon();
  }
  else if (r && r.err === 'conflict' && stateOnly && Object.keys(ps).length && sRetry < 3) {   // 開け閉めだけの保存がぶつかった：最新を取り込んで、自分の開け閉めをもう一度つける（音も警告もなし）
    sRetry++; await pullApply(true);
    Object.keys(ps).forEach(u => { const i = findItem(u); if (!i) return; const e = ps[u]; if (e === 1) i.s = 1; else if (e === 0) i.s = 0; PLAY.setTo(i.uid, e); pendS[i.uid] = e; });
    commitSoon();
  }
  else { if (r) { if (r.err === 'pin' || r.err === 'locked') dropPin(); toast(errText(r.err), 'ng'); sfx('ng'); } await pullApply(true); }   // 失敗したら最新の状態にもどす
  if (deferApply) { deferApply = false; pullApply(); }
}
async function pullApply(force) {
  if (!SV.on) return;
  if (!force && (committing || ghost || !pendEmpty() || (T && me && !me.watch && JSON.stringify(T.rooms) !== lastRoomsJson))) { deferApply = true; return; }   // 送っていない変更があるあいだは、サーバーの状態で上書きしない
  let d; try { d = await svPull(); } catch (e) { svFail(e); return; }
  applyServer(d);
}
function applyServer(d) {
  S.students = d.students; S.teams = d.teams; S.settings.priceMul = d.priceMul;
  S.staffMes = d.staffMes || []; S.missions = d.missions || []; S.notices = d.notices || []; S.startDate = d.startDate || '';
  S.teams.forEach(t => { t.notes = (d.notes || []).filter(n => n.teamId === t.id).sort((a, b) => a.at - b.at || a.id - b.id); });
  if (me && me.staff && me.staffId) { const p = S.staffMes.find(x => x.id === me.staffId); if (p) { me.nick = p.nick; me.me = p.me; } }   // 担任助手のme-の変更を反映
  paintNotesBtn(); paintMissionBtn(); paintMsTab(); paintMeyasuBtn();
  if (T) {
    const t = S.teams.find(x => x.id === T.id), st = me && (me.staff ? me : studentById(me.uid));
    if (!t || !t.confirmed || !st) { T = null; leaveTeam(); return; }
    const rj = JSON.stringify(t.rooms), changed = roomsKey(t.rooms) !== lastKey() || JSON.stringify(t.open || []) !== JSON.stringify(T.open || []), k = t.members.join(',') + '|' + t.members.map(u => { const x = studentById(u); return x ? nickOf(x) + JSON.stringify(x.me || '') : ''; }).join('|') + (me && me.staff ? '|staff:' + me.nick + JSON.stringify(me.me || '') : '');
    if (changed || t.picos !== T.picos) noteDiff(T, t);
    const oldNotes = new Set((T.notes || []).map(n => n.id)), newNotes = (t.notes || []).filter(n => !oldNotes.has(n.id) && Math.abs(Date.now() - n.at) < 600000);   // いま届いた伝言
    const lastRj = lastRoomsJson; T = t; me = st; lastRoomsJson = rj; if (S.cur.room >= T.rooms.length) S.cur.room = 0;
    if (k !== avKey) { avKey = k; rebuildAvatars(); }
    if (changed) { rebuildRoom(); renderBar(); fixAvatar(); } else if (rj !== lastRj) applyStates();
    renderRooms(); renderHud(); renderPanel(); msViewsUpdate();   // ミッションの表示（パネル・ダイアログ）は、変わった所だけ差し替える
    if (newNotes.length && me && !me.staff) staffSay(t, newNotes[newNotes.length - 1]);
  } else if (!$('select').hidden) renderSelect();
}
// 他の人の me- を押したとき：その人の番号を確かめる／番号がリセットされた人は決め直す。成功したら入力した番号を返す
async function verifyOrSetPin(st) {
  const face = faceImg(st.me, 'face', 'face'), who = nickOf(st);
  if (!st.pin) {
    const np = await pinSet({ face, who }); if (!np) return null;
    const r = await svCall('set_pin', { p_uid: st.uid, p_new_pin: np }); if (!r || !r.ok) { if (r) toast(errText(r.err), 'ng'); return null; }
    st.pin = 'srv'; return np;
  }
  for (let k = 0; k < 3; k++) {
    const v = await pinPad('4けたの番号を入力', k ? '違います。もう一度' : 'ピコが動くので確認します', { face, who }); if (v == null) return null;
    const r = await svCall('check_pin', { p_uid: st.uid, p_pin: v }); if (!r) return null;
    if (r.ok) return v;
    sfx('ng'); toast(errText(r.err), 'ng'); if (r.err === 'pin' || r.err === 'locked') { const dp = devpinGet(); if (dp && dp.uid === st.uid) devpinDrop(); } if (r.err === 'locked') return null;
  }
  return null;
}
async function enterServer(t, st) {
  if (st.uid !== getMyUid() || !st.pin) {   // 自分の端末の me- でなければ、番号を確かめてから（なりすまし防止）
    const v = await verifyOrSetPin(st); if (v === null) return;
    pinCache = { uid: st.uid, pin: v, until: Date.now() + 300000 }; setMyUid(st.uid); await devpinOffer(st, v);
  }
  startHouse(t, st);
}
// 「＋ me-を作る」：ニックネーム→見た目→番号。サーバーには未承認の生徒として作られ、すぐ家に入れる
// teamId なし（ホームの「はじめての人」）：me-を先に作り、番号のあとで「チーミをえらぶ」。メンバー画面からはチーミが決まっているので飛ばす
// 名前えらび：チーミがきまったら、名簿の「まだ me- を作っていない人」の名前から自分を選ぶ。選ぶと担任助手の確認なしで承認済み（得点が入る）。
//   返り値：枠のキー／''（名前がない・名簿なし・サーバーが古い＝従来どおり承認まち）／null（もどる）／false（サーバーのエラー）
const slotNeedsNo = {};   // 名前の枠ごとに「生徒番号の確認が要るか」（サーバーが教える。番号そのものは来ない）
function pickSlot(tid, m, nick) {
  return new Promise(async res => {
    const t = S.teams.find(x => x.id === tid);
    let r; try { r = await svRpc('team_slots', { p_team: tid, p_pass: getTeamCode(tid) || null }); } catch (e) { if (isSchemaErr(e)) { res(''); return; } svFail(e); res(false); return; }
    if (!r.ok) { toast(errText(r.err), 'ng'); res(false); return; }
    const slots = Array.isArray(r.slots) ? r.slots : [];
    if (!slots.length) { res(''); return; }
    const show = () => {
      const body = h('div', { cls: 'tp' });
      body.appendChild(h('div', { cls: 'tp-who' }, [faceImg(m, 'face', 'face'), h('span', { cls: 'tp-q' }, [h('b', { text: nick }), h('span', { text: 'さんは、だれ？' })])]));
      body.appendChild(h('p', { cls: 'hint', text: (t ? t.name + 'の' : '') + '名簿から、自分の名前をえらんでね。えらぶと、担任助手の確認なしですぐ得点が入ります。' }));
      const list = h('div', { cls: 'picklist tp-list' }); body.appendChild(list);
      slots.forEach(x => list.appendChild(h('button', { cls: 'btn pickbtn', onclick: async () => {
        closeModal();
        if (!await confirmDlg('「' + x.n + '」さん、で まちがいない？\n（まちがえると、ほかの人のピコが入ってしまいます）', 'これです', '名前の確認')) { show(); return; }
        slotNeedsNo[x.k] = !!x.h;
        res(x.k);
      } }, [h('span', { cls: 'a', text: x.n })])));
      modal('自分の名前をえらぼう', body, [h('button', { cls: 'btn', text: 'もどる', onclick: () => { closeModal(); res(null); } }), h('button', { cls: 'btn', text: '名前がない', onclick: () => { closeModal(); res(''); } })]);
    };
    show();
  });
}
// 生徒番号の入力：選んだ名前の本人かどうかを、サーバーが番号で確かめる（返り値：番号の文字列／null＝もどる）
function askStudentNo(m, nick, bad) {
  return new Promise(res => {
    const inp = h('input', { type: 'text', inputmode: 'numeric', maxlength: '12', autocomplete: 'off', cls: 'pass gift-inp', placeholder: '8けたの生徒番号', 'aria-label': '生徒番号' });
    const go = () => { const v = String(inp.value || '').normalize('NFKC').replace(/[^0-9]/g, ''); if (v.length < 6) { toast('生徒番号を入れてください', 'ng'); return; } closeModal(); res(v); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); go(); } });
    const body = h('div', { cls: 'tp' }, [
      h('div', { cls: 'tp-who' }, [faceImg(m, 'face', 'face'), h('span', { cls: 'tp-q' }, [h('b', { text: nick }), h('span', { text: 'さんの 生徒番号は？' })])]),
      h('p', { cls: 'hint', text: bad ? '番号が ちがいます。もう一度たしかめてね。' : '本人かどうか、生徒番号で確かめます。（学生証・塾の案内にある番号）' }), inp]);
    modal('生徒番号を入れてね', body, [h('button', { cls: 'btn', text: 'もどる', onclick: () => { closeModal(); res(null); } }), h('button', { cls: 'btn coral', text: 'つぎへ', onclick: go })]);
    setTimeout(() => inp.focus(), 50);
  });
}
// ===== QRプレゼント（非売品アイテム）：?gift=コード を読んだら、この端末が覚えておき、自分の me- でお家に入ったときに受け取る =====
// コードは URL からすぐ消す（はじめてカードと同じ）。受け取りは本人の4けたの番号で確かめる
const GIFT_KEY = 'kojoHouse.gift';
const normGift = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
const pendingGift = () => { try { return normGift(localStorage.getItem(GIFT_KEY)); } catch (e) { return ''; } };
const setPendingGift = c => { try { if (c) localStorage.setItem(GIFT_KEY, c); else localStorage.removeItem(GIFT_KEY); } catch (e) { } };
const takeUrlGift = () => {
  try {
    const u = new URL(location.href), c = normGift(u.searchParams.get('gift') || '');
    if (u.searchParams.has('gift')) { u.searchParams.delete('gift'); history.replaceState(null, '', u.pathname + u.search + u.hash); }
    return c;
  } catch (e) { return ''; }
};
async function giftPeek(code) {
  if (SV.on) return await svCall('gift_peek', { p_code: code });
  const g = (S.gifts || []).find(x => x.code === code); if (!g) return { ok: false, err: 'gift' };
  if (!g.active || (g.expires && g.expires < todayStr())) return { ok: false, err: 'giftend' };
  if (g.kind === 'once' && g.uses > 0) return { ok: false, err: 'giftused' };
  return { ok: true, item: g.item || '', picos: g.picos | 0, kind: g.kind, note: g.note };
}
async function giftRedeem(code, pin) {
  if (SV.on) return await svCall('gift_redeem', { p_uid: me.uid, p_pin: pin, p_code: code });
  const g = (S.gifts || []).find(x => x.code === code), p = await giftPeek(code); if (!p.ok) return p;
  if ((g.claims || []).includes(me.uid)) return { ok: false, err: 'claimed' };
  g.claims = (g.claims || []).concat(me.uid); g.uses = (g.uses || 0) + 1;
  if (g.item) me.inv[g.item] = (me.inv[g.item] || 0) + 1;
  if (g.picos > 0) { me.picos = (me.picos || 0) + g.picos; if (g.earned !== false) me.earned = (me.earned || 0) + g.picos; }
  save(); return { ok: true, item: g.item || '', picos: g.picos | 0 };
}
// 受け取り画面：何がもらえるかを見せてから、番号で受け取る
async function giftDlg(code) {
  code = normGift(code); if (!code || !T || !me) return;
  if (me.staff) { toast('担任助手の me- では受け取れません（生徒の me- で入ってね）', 'ng'); return; }
  const p = await giftPeek(code);
  if (p && !p.ok && p.err === 'gift' && SV.on && schemaAtLeast(GACHA_SCHEMA)) { gachaOpen(code); return; }   // プレゼントのコードではない：物理ガチャのカプセルのコードかも（どちらかはサーバーが判定）
  if (!p || !p.ok) { if (p) { toast(errText(p.err), 'ng'); if (p.err !== 'pin') setPendingGift(''); } return; }
  const pc = p.picos | 0, d = pc > 0 ? { name: fmt(pc) + ' ピコ', pico: true } : ITEM[p.item]; if (!d) { setPendingGift(''); return; }
  let im; if (d.pico) im = h('div', { cls: 'gift-coin', 'aria-hidden': 'true' }, [iconNode('coin', 84)]); else { im = h('img', { cls: 'gift-ico', alt: '', width: '120', height: '120' }); itemIcon(d, im); }
  const body = h('div', { cls: 'gift-dlg' + (d.pico ? ' pico' : '') }, [
    h('div', { cls: 'gift-burst', 'aria-hidden': 'true' }), im,
    h('div', { cls: 'gift-tag' + (d.hazure ? ' hz' : '') + (d.pico ? ' pc' : ''), text: d.hazure ? 'はずれ…' : d.pico ? 'ピコ' : '非売品' }), h('b', { cls: 'gift-name', text: d.name }), d.hazure ? h('div', { cls: 'gift-note', text: 'ざんねん！ はずれでした。でも記念に飾れます' }) : null,
    p.note ? h('div', { cls: 'gift-note', text: p.note }) : null,
    h('p', { cls: 'hint', text: nickOf(me) + (d.pico ? ' さんのピコに入ります。' : ' さんの持ち物に入ります。') + '4けたの番号で確かめます。' })
  ]);
  modal('プレゼントが届いています', body, [
    h('button', { cls: 'btn', text: 'あとで', onclick: closeModal }),
    h('button', { cls: 'btn coral', text: '受け取る', onclick: async () => {
      closeModal(); const pin = await getPin(); if (pin === null) return;
      const r = await giftRedeem(code, pin);
      if (!r || !r.ok) { if (r) { if (r.err === 'pin' || r.err === 'locked') dropPin(); else setPendingGift(''); toast(errText(r.err), 'ng'); sfx('ng'); } return; }
      setPendingGift(''); if (SV.on) await pullApply(true);
      if (d.pico) { sfx('buy'); lastPicosT = me.picos; floatText('+' + fmt(pc) + ' ピコ', 'p'); picoCelebrate(pc); renderPanel(); return; }
      sfx(d.hazure ? 'ng' : 'buy'); toast(d.name + (d.hazure ? 'を受け取りました…（はずれ）。「持ち物」から置けます' : 'を受け取りました！「持ち物」から置けます'), 'ok'); tab = 'inv'; renderPanel();
    } })
  ], 'gift');
}
// 物理ガチャのカプセル：開ける演出は js/gacha.js
function gachaOpen(code) {
  gachaDlg(code, {
    nick: nickOf(me), getPin: () => getPin(), redeem: (c, pin) => svCall('gacha_redeem', { p_uid: me.uid, p_pin: pin, p_code: c }),
    dropPin: () => dropPin(), clear: () => setPendingGift(''), refresh: () => pullApply(true), sfx,
    onWin: n => { lastPicosT = me.picos; renderPanel(); },
    coinTo: $('ptsBox'), hold: TESTQ ? (window.__gxEnv || {}).hold : ''
  });
}
// ピコが当たったとき：大きく「+○ピコ」を出す（数秒で消える）
function picoCelebrate(n) {
  const el = h('div', { cls: 'pico-win', role: 'status' }, [h('div', { cls: 'pw-coin', 'aria-hidden': 'true' }, [iconNode('coin', 64)]), h('b', { text: '+' + fmt(n) + ' ピコ' }), h('span', { text: 'ピコが当たった！' })]);
  document.body.appendChild(el); el.addEventListener('click', () => el.remove()); setTimeout(() => el.remove(), 2600);
  toast(fmt(n) + ' ピコを受け取りました！', 'ok');
}
// 設定の「プレゼントコード」：QRが読めないときにコードを手で入れる
function giftCodeDlg() {
  const inp = h('input', { type: 'text', maxlength: '12', placeholder: '例：AB23CD45 ／ K7P-3QX', autocomplete: 'off', cls: 'pass gift-inp', 'aria-label': 'プレゼントコード' });
  const go = () => { const c = normGift(inp.value); if (c.length < 6) { toast('コードを入れてください', 'ng'); return; } closeModal(); giftDlg(c); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); go(); } });
  modal('プレゼントコード', h('div', {}, [h('p', { cls: 'hint', text: 'QRプレゼントの紙・画面にある8文字のコード、またはガチャのカプセルに入っているコード（K7P-3QX のような形）を入れてください。' }), inp]), [h('button', { cls: 'btn', text: 'やめる', onclick: closeModal }), h('button', { cls: 'btn coral', text: 'つぎへ', onclick: go })]);
  setTimeout(() => inp.focus(), 50);
}
const bootGift = TESTQ ? '' : takeUrlGift(); if (bootGift) setPendingGift(bootGift);
function createMe(teamId, me0, nick0) {
  if (teamId && !S.teams.find(x => x.id === teamId && x.confirmed)) return;
  const nSteps = teamId ? 3 : 4;
  openMeMaker({ me: me0, nick: nick0, nextLabel: 'つぎへ（番号をきめる）', cancelLabel: 'もどる', stepTeam: !teamId, onCancel: () => renderSelect(), onDone: async (m, nick) => {
    const np = await pinSet({ face: faceImg(m, 'face', 'face'), who: nick, step: '3/' + nSteps });
    if (!np) { createMe(teamId, m, nick); return; }
    let tid = teamId, slot, noBad = false;
    for (;;) {
      if (!tid) { tid = await chooseTeam(m, nick); if (!tid) { createMe(null, m, nick); return; } }   // もどる：me-はそのままで作成画面へ
      if (slot === undefined) {   // 自分の名前をえらぶ（名簿の枠。承認済みで始まる）
        slot = await pickSlot(tid, m, nick);
        if (slot === null || slot === false) { slot = undefined; if (!teamId) { tid = null; continue; } createMe(teamId, m, nick); return; }   // もどる／エラー
      }
      const args = { p_team: tid, p_nick: nick, p_me: m, p_pin: np }; if (slot) args.p_slot = slot;
      if (slot && slotNeedsNo[slot]) {   // 生徒番号：名前の本人かどうかの確認（サーバーが照合）
        const no = await askStudentNo(m, nick, noBad); noBad = false;
        if (no === null) { slot = undefined; continue; }   // もどる：名前えらびにもどる
        args.p_no = no;
      }
      const r = await svCall('create_me', args);
      if (r && r.ok) { await finishCreate(r, tid, np); return; }
      if (r) toast(errText(r.err), 'ng');
      if (r && r.err === 'slotno') { noBad = true; continue; }   // 番号がちがう：同じ名前のまま、番号だけ入れなおす
      if (r && (r.err === 'slot' || r.err === 'slotused' || r.err === 'nolocked')) { slot = undefined; continue; }   // 先に ほかの人が選んでいた：名前えらびをやりなおす
      slot = undefined;
      if (!teamId) { tid = null; continue; }   // チーミ選択にもどる（満員など）
      createMe(teamId, m, nick); return;
    }
  } });
}
// できあがり：「完了！あなたの me- は〇〇チーミの家にいます」を見せてから、そのまま家へ
async function finishCreate(r, teamId, np) {
  const tid = r.team || teamId; setMyUid(r.uid); showTeamMembers(tid); await pullApply(true);
  const st = studentById(r.uid), t = S.teams.find(x => x.id === tid);
  pinCache = { uid: r.uid, pin: np, until: Date.now() + 300000 }; await devpinOffer(st || { uid: r.uid }, np);
  if (!(st && t)) { renderSelect(); return; }
  $('select').hidden = true;   // （選択画面が見えたままにならないように）
  const body = h('div', { cls: 'done-me' }, [faceImg(st.me, 'face', 'face'), h('div', { cls: 'dm-t' }, [h('b', { text: nickOf(st) + 'さん、me- ができました' }), h('span', {}, ['あなたの me- は ', h('span', { cls: 'dm-team', text: t.name + 'チーミ' }), ' の家にいます'])])]);
  const notes = r.slot
    ? ['担任助手の確認は不要です。もうピコ（得点）が入ります', '番号（4けた）を忘れたら、担任助手に言うとリセットしてもらえます']
    : ['今は「承認まち」。確認されるまで、ピコ（得点）は入りません', '家を見る・歩く・家具を動かすことはできます', '番号（4けた）を忘れたら、担任助手に言うとリセットしてもらえます'];
  const ul = h('ul', { cls: 'dm-list' }); notes.forEach(x => ul.appendChild(h('li', { text: x }))); body.appendChild(ul);
  modal('完了', body, [h('button', { cls: 'btn coral big', text: '家に入る', onclick: () => { closeModal(); startHouse(t, st); } })], 'sticky');
}
const isSchemaErr = e => e instanceof SvError && e.kind === 'schema';
const mineStu = () => { const u = getMyUid(), r = u ? (SV.rows.find(x => x.uid === u) || studentById(u)) : null; return r && r.retired ? null : r; };   // 休止の人は、この端末でも「自分」にしない
// 担任助手モード：名簿(本名)はこの端末の localStorage にだけ。サーバーの値を重ねて見せる
async function buildAdm() {
  const d = await withBusy('名簿を準備しています', svPull()), a = admLoad(); let linked = 0;
  try { linked = (await slotsSync(a)).linked; } catch (e) { svFail(e); }   // 選ばれた名前の枠の持ち主を、名簿の人に自動でひもづける
  mergeAdmin(a, d.students, d.teams, d.priceMul); a.scoreLog = [];
  try {
    const lg = await adminRpc('admin_logs', {});
    if (lg.ok) { const k = new Map(a.students.filter(x => x.link).map(x => [x.link, x.uid])); a.scoreLog = lg.logs.map(l => ({ id: l.id, at: l.at, kind: l.kind, mode: l.mode, undone: l.undone, by: l.by || '', undoneBy: l.undone_by || '', note: l.note || '', applied: (l.applied || []).map(x => ({ studentId: x.uid ? k.get(x.uid) || null : null, uid: x.uid, team: x.team, picos: x.picos })) })); }
  } catch (e) { svFail(e); }
  SV.adm = a;
  if (linked) toast('名前えらびで ' + linked + '人が自動でひもづきました', 'ok');
  if (SV.vaultNeed || linked) vaultSoon();
}
// チーミのあいことば（サーバー版）：サーバーで確かめる。通ったらこの端末がチーミごとに覚える（あいことばが変わったら聞き直す）
const TCKEY = 'kojoHouse.teamcode.';
const getTeamCode = id => { try { return localStorage.getItem(TCKEY + id) || ''; } catch (e) { return ''; } };
const setTeamCode = (id, v) => { try { if (v) localStorage.setItem(TCKEY + id, v); else localStorage.removeItem(TCKEY + id); } catch (e) { } };
async function teamAuth(t) {
  if (!t.hasCode) return true;   // あいことば未設定のチーミは、そのまま入れる
  const mem = getTeamCode(t.id);
  if (mem) {
    const r = await svCall('check_team_pass', { p_team: t.id, p_pass: mem });
    if (r && r.ok) return true;
    if (!r) return false;
    if (r.err === 'locked') { toast(errText('locked'), 'ng'); return false; }
    setTeamCode(t.id, '');
  }
  for (let k = 0; k < 3; k++) {
    const v = await pinPad(t.name + 'のあいことば', k ? '違います。もう一度' : 'チーミのメンバーだけが知っている4けたの数字');
    if (v == null) return false;
    const r = await svCall('check_team_pass', { p_team: t.id, p_pass: v }); if (!r) return false;
    if (r.ok) { setTeamCode(t.id, v); return true; }
    sfx('ng'); if (r.err === 'locked') { toast(errText('locked'), 'ng'); return false; }
  }
  toast('あいことばが違います。担任助手に聞いてください', 'ng'); return false;
}
async function svStart() {
  let r;
  try { r = await svInit(); } catch (e) {
    if (e instanceof SvError && e.kind === 'schema') { showSchemaMissing(); S = store.defaultState(); renderSelect(); return; }
    svFail(e); renderSelect(); return;
  }
  if (r !== 'ok') { if (r === 'offline') toast('サーバーにつながらないため、この端末だけで動いています', 'ng'); renderSelect(); return; }
  S = store.defaultState(); noSave = true; screenCtx.loadDemo = null; screenCtx.houseThumb = houseThumb; screenCtx.teamAuth = teamAuth;
  applyServer({ students: SV.rows, teams: SV.teamRows, priceMul: SV.priceMul, staffMes: SV.staffMes, notes: SV.notes, missions: SV.missions, notices: SV.notices, startDate: SV.startDate });   // 最初から、お知らせ・ミッション・伝言板・開始日も出す（前は次の更新まで空だった）
  watchGrants();
  const my = getMyUid(), mine = my && SV.rows.find(x => x.uid === my);
  screenCtx.msPending = msPending;
  if (mine && mine.teamId) { const mt = S.teams.find(x => x.id === mine.teamId); if (mt && mt.confirmed) (S.missions || []).filter(m => phaseOf(m, todayStr()) === 'now').forEach(m => missionCounts(m, mt, () => { })); }   // 家に入る前に、自分のチーミの達成状況を先に取っておく
  if (mine && mine.teamId) showTeamMembers(mine.teamId);   // 自分の端末なら、自分のチーミのメンバー一覧から
  if (!S.teams.some(t => t.confirmed) && !(MODE === 'staff' && STAFFQ) && !new URLSearchParams(location.search).has('admin')) { sampleHouse(); return; }
  renderSelect();
  svSubscribe(() => pullApply());
  if (staffOk() && new URLSearchParams(location.search).has('admin')) gateAdmin();   // 開いたときに担任助手の画面を自動で出さない（?admin のときだけ）。担任助手は右上の「担任助手」ボタンから
  if (staffOk() && (MODE === 'staff' || new URLSearchParams(location.search).has('admin'))) { MODE === 'staff' && !new URLSearchParams(location.search).has('admin') ? openDesk() : gateAdmin(); }
}
// 予約した一律配布（schema 22）：サーバーが教える「次の配布まであと何ミリ秒」を待ち、その時刻ちょうどに run_due_grants を呼ぶ
// だれか1台が呼べば全員に配られ、2台目からは何もしない（サーバー側で1回だけ）。待ち時間はサーバーの時計で決まるので、端末の時計がずれていても大丈夫
let grantTimer = 0;
async function watchGrants() {
  clearTimeout(grantTimer); if (!SV.on) return;
  let r; try { r = await svRpc('run_due_grants'); } catch (e) { return; }   // 古いサーバー（関数なし）・オフラインなら何もしない
  if (r && r.ran) pullApply(true);
  const w = r && r.wait_ms; if (w == null) return;
  grantTimer = setTimeout(watchGrants, Math.min(+w + 300 + Math.random() * 1500, 3 * 3600e3));   // 同時に呼びすぎないよう少しずらす。遠い先なら3時間ごとに確かめ直す
}
// お試しの家「勝又チーミ」：確定したチーミがまだ無いとき・?demo=katsumata・担任助手の「生徒が見る画面」で使う。
// 生徒が入ったときと同じ経路（enterAs → startHouse）で本物の家画面を出す。サーバーには何も送らず、保存もしない（ピコの動く操作もこの端末の中だけ）
let sampleMode = false;
// お試しの家・ピコ無制限のチーミ（担任助手の「おためしチーミ」。サーバーの teams.unlimited）では、ピコ（自分・メンバー・貯金箱）は無制限：
// 使ってもすぐ元に戻し、表示は「∞」。サーバー側もトリガーで満タンに戻すので、ここで戻すのは見た目（「+ピコ」の演出を出さない）のため
const UNL = 99999999, unlimitedNow = () => sampleMode || !!(T && T.unlimited), pfmt = v => unlimitedNow() ? '∞' : fmt(v);
function refillSample() {
  if (!unlimitedNow() || !T || !me) return false;
  let ch = false; const top = o => { if (o && o.picos !== UNL) { o.picos = UNL; ch = true; } };
  top(me); top(T); (T.members || []).forEach(id => top(studentById(id)));
  if (ch) { lastPicosT = dispPts = me.picos; }
  return ch;
}
function sampleHouse() {
  sampleMode = true; demoMode = true; SV.on = false; noSave = true; makeDemo({ katsumata: true }); screenCtx.canCreate = () => false;
  S.students.forEach(s => { s.picos = UNL; }); S.teams.forEach(t => { t.picos = UNL; });
  enterAs(S.teams[0].id, S.teams[0].members[0]);
  document.body.classList.add('sample');
  toast('お試しの家（勝又チーミ）です。保存されません', 'ok');
}
// 見本の家から担任助手モードへ行くときは、本物のサーバーにつなぎ直してから開く
// 担任助手の入口（パスワードなし：家を見る・向上得点）。名簿やチーミ編集は中の「管理者モード」から（パスワード）
// 担任助手の入口：パスワード（管理者パスコード）を確かめてから、家を見る画面を開く。入ったあとの管理者モードは、もう一度は聞かない
function openDesk() { if (!staffOk()) return; if (sampleMode) { gateAdmin(); return; } openAdminGate(() => openStaffDesk({ teams: () => S.teams.filter(t => t.confirmed), watch: watchTeam, openAdmin: () => openAdmin() })); }
function gateAdmin() { if (!staffOk()) return; if (sampleMode) { location.href = location.pathname + '?admin=1'; return; } openAdminGate(); }
let lastT = performance.now(), camAnim = false, lastR = 0, shownPts = -1;
// ===== 右はしのボタン置き場（レール）=====
// DOM の要素を移すだけ（onclick・キーボードの近道・id はそのまま動く）。入りきらないときは、ボタンを小さく → それでも無理なら2列にする
const RAIL_HB = ['btnRank', 'btnSet'], RAIL_TB = ['viewWrap', 'eyeExit', 'btnLight', 'btnPhoto', 'btnMeyasu', 'btnMulti', 'btnNotes', 'btnTeams'];
function applyRail() {
  const rail = $('rail'), b = document.body; b.classList.toggle('rail', layoutRail); b.classList.toggle('railtools', layoutRail && railTools);
  RAIL_HB.forEach(id => (layoutRail ? rail : $('hud')).appendChild($(id)));
  RAIL_TB.forEach(id => { const e = $(id), on = layoutRail && railTools; (on ? rail : $('tools')).appendChild(e); const bt = e.id === 'viewWrap' ? e.querySelector('#btnView') : e, tl = bt && bt.querySelector('.tl'); if (on && bt && tl && !bt.getAttribute('aria-label')) { bt.setAttribute('aria-label', tl.textContent.trim()); if (!bt.title) bt.title = tl.textContent.trim(); } });
  railFit();
}
function railFit() {
  const r = $('rail'); if (!document.body.classList.contains('rail')) return;
  const kids = [...r.children].filter(e => !e.hidden && getComputedStyle(e).display !== 'none'), n = kids.length; const bd = document.body; bd.classList.remove('railsm'); bd.style.setProperty('--rc', '1'); bd.style.setProperty('--rr', String(Math.max(1, n)));
  const cs = getComputedStyle(r), avail = r.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0), gap = parseFloat(cs.rowGap) || 0;
  const need = () => n * (parseFloat(getComputedStyle(r).getPropertyValue('--rb')) || 40) + Math.max(0, n - 1) * gap;
  if (need() > avail) { bd.classList.add('railsm'); if (need() > avail) { const rb = parseFloat(getComputedStyle(r).getPropertyValue('--rb')) || 34, per = Math.max(1, Math.floor((avail + gap) / (rb + gap))), cols = Math.min(3, Math.ceil(n / per)); bd.style.setProperty('--rc', String(cols)); bd.style.setProperty('--rr', String(Math.ceil(n / cols))); } }
}
// ===== 右パネルの開閉（1つずつ・なめらかに）=====
// 動かすのは transform と opacity だけ。はじめに画面の大きさを「パネルなし」の形に決めてしまい（canvas は1回だけ作り直す）、パネルは上に重ねて右へすべらせる。
// 順番：閉じるとき＝① パネルが右へすべって消える（約280ms・ease-in-out）→ ② そのあと、画面が広がる・カメラの映り方を整える（約300ms・ease-out）。
//       開くとき＝① 先に、画面をパネルの分だけ縮める・カメラを整える → ② そのあと、パネルがすべって入る。同時には動かさない（動いている間は、どちらか1つだけ）。
// ①のパネルがすべる間は、3D の描き直しも、パネルの中身の再描画もしない（カメラは止まっている）。will-change は、その動きの間だけ付ける。
// 1フレーム目で飛ばないよう、transform の初期値を先に置き、時間は最初のフレームから数える。連打：動いている途中で押したら、いまの位置から逆向きに戻る。右はしレールのときも同じ。
// 動きを減らす設定のときは、すぐ切り替える。
// pnS（動いている間だけ入る）：{ pw, A, L, dx, p（パネルの閉じ具合 0=開 1=閉）, k（画面・カメラの閉じ具合 0=狭い 1=広い）, tgt, seg }
//   不変の決まり：k が 0 より大きいときは、パネルは必ず閉じ切っている（p=1）。
let pnS = null;
const panelClosed = () => pnS ? pnS.tgt === 1 : $('panel').classList.contains('hide');
const pnBez = (x1, y1, x2, y2) => { const B = (a, b, t) => 3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t; return q => { if (q <= 0) return 0; if (q >= 1) return 1; let t = q; for (let i = 0; i < 8; i++) { const d = (B(x1, x2, t) - q) / (3 * x1 * (1 - t) * (1 - t) + 6 * (x2 - x1) * (1 - t) * t + 3 * (1 - x2) * t * t || 1); t = Math.max(0, Math.min(1, t - d)); } return B(y1, y2, t); }; };
const pnOut = pnBez(.2, .8, .2, 1), pnInOut = pnBez(.45, 0, .2, 1);
const pnLeaves = () => { const out = []; [...$('stage').children].forEach(e => { if (e.id === 'cv') return; if (e.id === 'hud' || e.id === 'dock' || e.id === 'hudSub') out.push(...e.children); else out.push(e); }); return out.filter(e => e.getClientRects().length); };
const pnLefts = L => L.map(e => e.getBoundingClientRect().left);
// いま動かすもの（'p'＝パネル／'k'＝画面とカメラ）を決めて、次の動き（seg）を作る。t0 は最初のフレームで決める（最初のフレームで飛ばない）
function pnPlan(S) {
  const close = S.tgt === 1, ps = $('panel').style; let key = null;
  if (close) key = S.p < 1 ? 'p' : S.k < 1 ? 'k' : null; else key = S.k > 0 ? 'k' : S.p > 0 ? 'p' : null;
  ps.willChange = ''; S.L.forEach(e => { e.style.willChange = ''; });
  if (!key) { S.seg = null; return; }
  const to = close ? 1 : 0, from = S[key];
  S.seg = { key, from, to, t0: null, dur: vdur(key === 'k' ? 300 : 280) * Math.max(.35, Math.abs(to - from)), ease: key === 'k' || !close ? pnOut : pnInOut };
  if (key === 'p') ps.willChange = 'transform, opacity'; else S.L.forEach(e => { e.style.willChange = 'transform'; });
}
function panelSet(close) {
  const p = $('panel'), tg = $('panelToggle'); tg.classList.toggle('closed', close); tg.setAttribute('aria-label', close ? 'パネルを出す' : 'パネルをたたむ');
  if (reduceMotionNow() || !T) { p.classList.toggle('hide', close); setTimeout(resize, 0); return; }
  if (!pnS) {
    const st = $('stage'), hid = p.classList.contains('hide'); if (hid === close) return;
    cam.vb = null; const L = pnLeaves(); let xa, xb, pw, wn;
    if (hid) { xb = pnLefts(L); p.classList.remove('hide'); pw = p.offsetWidth; wn = Math.round(st.getBoundingClientRect().width); xa = pnLefts(L); }   // 広い形を測り、パネルを出して狭い形も測る
    else { xa = pnLefts(L); pw = p.offsetWidth; wn = Math.round(st.getBoundingClientRect().width); }
    const c0 = hid ? 1 : 0, ps = p.style;
    ps.position = 'absolute'; ps.top = '0'; ps.bottom = '0'; ps.right = 'var(--railw,0px)'; ps.zIndex = '7';   // パネルは上に重ねる（画面は広い形になる）
    const A = probeCam(wn, Math.round(st.getBoundingClientRect().width));   // 狭い形の映り方を、広い canvas の座標で（閉じるときも、いまの絵をそのまま保つ）
    if (!hid) xb = pnLefts(L);
    const dx = L.map((_, i) => xa[i] - xb[i]);
    pnS = { pw, A, L, dx, p: c0, k: c0, tgt: c0, seg: null };
    cam.vb = { A, B: null, k: c0, hA: A.h }; panelApply(); resize(); updateCamera(0, false); renderFrame();
  }
  const S = pnS; S.tgt = close ? 1 : 0; pnPlan(S); cam.dirty = true;
}
function panelApply() {
  const S = pnS, ps = $('panel').style, c = S.p;
  ps.transform = 'translate3d(' + (c * 100).toFixed(3) + '%,0,0)'; ps.opacity = String(Math.max(0, Math.min(1, 1 - (c - .5) / .5))); $('panelToggle').style.setProperty('--tp', c.toFixed(4));   // つまみもパネルのふちと一緒に動く
  S.L.forEach((e, i) => { e.style.translate = (S.dx[i] * (1 - S.k)).toFixed(2) + 'px 0'; }); cam.vb.k = S.k;
}
function panelTick(t) {
  const S = pnS; if (!S.seg) pnPlan(S);
  for (let g = 0; g < 2 && S.seg; g++) {   // 1つ終わったら、同じフレームで次の動きの 0 から始める（待ちを挟まない）
    const sg = S.seg; if (sg.t0 == null) sg.t0 = t;
    const q = Math.min(1, Math.max(0, (t - sg.t0) / sg.dur)); S[sg.key] = sg.from + (sg.to - sg.from) * sg.ease(q); panelApply();
    if (sg.key === 'k') cam.dirty = true;   // カメラを動かす間だけ 3D を描き直す（パネルがすべる間は描き直さない）
    if (q < 1) return;
    S[sg.key] = sg.to; panelApply(); pnPlan(S);
  }
  if (S.seg) return;
  const p = $('panel'), ps = p.style; pnS = null; ps.position = ps.top = ps.bottom = ps.right = ps.zIndex = ps.willChange = ps.transform = ps.opacity = ''; p.classList.toggle('hide', S.tgt === 1); $('panelToggle').style.removeProperty('--tp');
  S.L.forEach(e => { e.style.translate = ''; e.style.willChange = ''; }); cam.vb = null; resize(); updateCamera(0, false); renderFrame();
}
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (t - lastT) / 1000); lastT = t; rtWatch();
  if (!T) return;
  if (!me) return;
  if (pnS) panelTick(t);
  if (unlimitedNow() && refillSample()) renderHud();
  if (dispPts !== dispOut) CNT.jump(dispPts);   // 読み込み直後・切り替えなど、外から決めた値は、そのまま
  if (picoHold != null && $('modal').hidden) picoHoldRelease(0, null);   // 「家へ」以外で閉じられたとき
  dispPts = dispOut = CNT.val(picoHold != null ? picoHold : me.picos, performance.now(), !motionOK()); $('ptsBox').classList.toggle('counting', CNT.counting);   // 増えるときはカウントアップ・減るときはすっと
  if (me.uid !== lastPicosUid) { lastPicosUid = me.uid; lastPicosT = me.picos; }
  else if (me.picos !== lastPicosT) { const dlt = me.picos - lastPicosT; lastPicosT = me.picos; if (dlt > 0) { floatText('+' + fmt(dlt) + ' ピコ', 'p'); sfx('coin'); const bx = $('ptsBox'); bx.classList.remove('gain'); void bx.offsetWidth; bx.classList.add('gain'); } }
  const sp = Math.round(dispPts); if (sp !== shownPts) { shownPts = sp; $('pts').textContent = pfmt(sp); }
  if (AVS.length) { AVS.forEach(a => { updateAvatar(a, dt); updateAvatarObj(a, dt); stepSay(a, dt); }); cam.dirty = true; rtSend(); }
  viewerOutTick(dt);
  E.camPts = AVS.length ? yardPts() : null;   // 庭にいる人がいれば、カメラが引いて画面に入れる
  if (needSync) tk('sync(furniture)', sync);
  const cont = anims.length > 0 || lightList.some(l => l.flicker) || (hiArrow && !ghost) || PLAY.busy();
  const will = cam.dirty || camAnim || (cont && t - lastR > 30); perfTick(t, will);
  if (!will) return;
  if (TRIAL.pause) { cam.dirty = true; return; }   // WebGPU の試験の測定中は、メインの描画を止める（GPU の取り合いで測定がぶれるため。さこの「もう一度試験」のときだけ）
  lastR = t; cam.dirty = false; mainRendered(t);
  eyeSelf(); stepPops(dt); stepDrops(dt); camAnim = updateCamera(dt, false); scaleLabels();
  if (E.wallVer !== seenWallVer) { seenWallVer = E.wallVer; applyWallVis(); cam.dirty = true; }
  const ts = t / 1000;
  anims.forEach(g => g.userData.anim(ts)); PLAY.tick(ts); setCurtainDim(PLAY.dimK()); flickerLights(ts, lightList);
  if (hiArrow) hiArrow.position.y = hiBase + Math.sin(ts * 5) * .07;
  stepGhost(dt);
  tk('renderFrame', renderFrame);
}
// ===== 起動 =====
// オープニング：サイトに入ったら最初に出す → 「はじめる」でチーミ選択へ
// 背景は開いた時刻で変える：午前5時〜午後3時前＝昼の空（.day）、午後3時〜午前5時前＝夕方・夜（いままでの絵）。?op=day / ?op=night で確認できる
const isDayTime = (d) => { const f = new URLSearchParams(location.search).get('op'); if (f === 'day') return true; if (f === 'night') return false; const hr = (d || new Date()).getHours(); return hr >= 5 && hr < 15; };
function showOpening() {
  const op = $('opening'), box = $('opMes'); op.hidden = false; op.classList.remove('out'); box.innerHTML = '';
  op.classList.toggle('day', isDayTime());
  for (let i = 0; i < 4; i++) box.appendChild(faceImg(Object.assign(randomMe(), { top: [0, 1, 4, 6][i], hat: [0, 2, 6, 1][i] }), 'full', ''));
  const go = () => { sfx('tap'); op.classList.add('out'); setTimeout(() => { op.hidden = true; }, 460); };
  $('opStart').onclick = go;
  // 右上の小さな「担任助手」入口（生徒用URLには出さない）。担任助手用URLでは ?staff をつけて開き直す → 読み込み後に担任助手の入口が開く
  const old = $('opStaff'); if (old) old.remove();
  if (MODE !== 'student') op.appendChild(h('button', { id: 'opStaff', cls: 'op-staff', type: 'button', text: '担任助手', title: '担任助手の入口', onclick: () => {
    if (staffOk()) { go(); openDesk(); return; }
    const u = new URL(location.href); u.searchParams.set('staff', ''); location.href = u.pathname + u.search.replace('staff=', 'staff') + u.hash;
  } }));
}
// 開いたままのタブの更新：画面が前面に戻ったとき＋10分ごとに version.txt を no-store で見る。違えば小さな帯を出す（押すと再読み込み）。
// テスト・?demo・file:// ・?v= の無い読み込みでは動かさない
export function startUpdateWatch() {
  let mine = ''; try { mine = new URL(import.meta.url).searchParams.get('v') || ''; } catch (e) { }
  if (!mine || (TESTQ && !window.__updWatchTest) || DEMOQ || location.protocol === 'file:' || window.__noUpdateWatch) return;
  let busy = false;
  const check = async () => {
    if (busy || $('updBar')) return; busy = true;
    try {
      let v; if (window.__fetchVersion) v = String(await window.__fetchVersion()).trim(); else { const r = await fetch('version.txt?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return; v = (await r.text()).trim(); }
      if (/^\d{8,14}$/.test(v) && v !== mine) document.body.appendChild(h('div', { id: 'updBar', role: 'status' }, [h('span', { text: '新しい版があります' }), h('button', { cls: 'btn sm coral', text: '更新する', onclick: () => location.reload() })]));
    } catch (e) { /* つながらないときは何もしない */ } finally { busy = false; }
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setInterval(check, 10 * 60 * 1000);
  return check;   // （確認用）
}
function boot() {
  startUpdateWatch();
  if (TESTQ && TESTQ !== 'info') setInfoSeen(true);   // 確認用テストは、お知らせの画面をとばす
  screenCtx.openSettings = settingsDlg; screenCtx.staffOk = staffOk; screenCtx.warm = scheduleWarm; screenCtx.getS = () => S; screenCtx.enter = enterAs; screenCtx.quickEnter = quickEnter; screenCtx.meId = () => me && me.uid; screenCtx.myTeam = () => T && T.id; screenCtx.openAdmin = () => { if (SV.status === 'schema') { showSchemaMissing(); return; } openDesk(); }; screenCtx.myUid = () => getMyUid(); screenCtx.canCreate = () => SV.on; screenCtx.createMe = id => createMe(id || null); screenCtx.houseThumb = houseThumb; screenCtx.loadDemo = () => { makeDemo(); saveNow(); renderSelect(); toast('お試しデータを入れました', 'ok'); };
  actx.getS = () => S; actx.save = save; actx.onUnlock = async () => { adminOn = true; if (SV.on) { try { const vr = await vaultRestore(); if (vr === 'restored') toast('バックアップから名簿を開きました', 'ok'); else if (vr === 'fail') toast('バックアップを開けませんでした（別のパスワードで作られたかも）。上書きはしません', 'ng'); await buildAdm(); } catch (e) { svFail(e); } } renderHud(); }; actx.refresh = refreshAfterAdmin; actx.visit = id => { if (T) leaveTeam(); visitTeam(id); }; actx.reload = async () => { try { await buildAdm(); } catch (e) { svFail(e); } };
  actx.adminCheck = async p => { if (!SV.on) return p === S.settings.passcode; try { const r = await svRpc('admin_check', { p_admin: p }); if (r.ok) { SV.adminPass = p; return true; } return false; } catch (e) { svFail(e); return e instanceof SvError && e.kind === 'schema' ? 'schema' : 'error'; } };   // true / false（ちがう）/ 'schema' / 'error'（通信の問題）
  actx.setS = ns => { S = ns; uidN = Math.max(uidN, S.uid || 1); T = null; $('app').classList.remove('in-house'); $('select').hidden = false; };
  initScene(cv, $('stage')); setQuality(quality);
  $('btnSet').onclick = settingsDlg; $('camReset').onclick = () => { setCamMode('iso'); paintCam(); }; $('btnBack').onclick = leaveTeam; $('btnRank').onclick = () => openRanking(); $('bankBox').onclick = donateDlg; $('meChip').onclick = () => { if (!ghost) profileDlg(); };
  { const rk = $('rank'); rk.onclick = () => { if (!ghost) rankDlg(); }; rk.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && !e.isComposing) { e.preventDefault(); if (!ghost) rankDlg(); } }; }
  const viewPop = on => { $('viewPop').hidden = !on; $('btnView').setAttribute('aria-expanded', on ? 'true' : 'false'); $('btnView').classList.toggle('on', on); };
  $('btnView').onclick = () => viewPop($('viewPop').hidden);
  document.querySelectorAll('#camModes .btn').forEach(b => { b.onclick = () => { const m = b.dataset.m; if (m === 'eye') toggleEye(); else if (cam.mode === 'eye') exitEyeMode(m); else setCamMode(m); paintCam(); holdAvatars(); sfx('tap'); viewPop(false); }; });
  $('eyeExit').onclick = () => { exitEyeMode(); sfx('tap'); };
  const camR = $('camReset').onclick; $('camReset').onclick = () => { if (cam.mode === 'eye') exitEyeMode('iso'); else camR(); holdAvatars(); viewPop(false); };
  document.addEventListener('pointerdown', e => { if (!$('viewPop').hidden && !e.target.closest('#viewWrap')) viewPop(false); }, true);
  $('btnPhoto').onclick = () => takePhoto({ sfx });
  $('btnLight').onclick = toggleLight; $('btnMulti').onclick = () => multi ? exitMulti() : enterMulti();
  // キーボードのショートカット（keys.js）。ボタンにも title で添える
  $('btnSet').title = '設定 (Ctrl+,)'; $('btnView').title = '視点 (V)'; $('btnMulti').title = 'まとめて選ぶ (M)'; $('msTab').title = 'ミッション (5)';
  initKeys({
    inHouse: () => !!(T && me) && $('select').hidden, settings: settingsDlg,
    tab: i => { const k = i < TABS.length ? TABS[i][0] : 'mission'; if (k === 'mission' ? $('msTab').hidden : !TABS.some(([x]) => x === k)) return; if (panelClosed()) $('panelToggle').click(); if (k === 'mission') $('msTab').click(); else { tab = k; renderPanel(); } },
    light: () => { if (T) toggleLight(); }, multi: () => $('btnMulti').click(),
    view: () => { const bs = [...document.querySelectorAll('#camModes .btn')], i = bs.findIndex(b => b.dataset.m === cam.mode); if (bs.length) bs[(i + 1) % bs.length].click(); },
    yaw: d => { if (cam.mode === 'eye') { eyeTurn(-d * .06); return; } orbit(d * .05, 0); paintCam(); holdAvatars(); },
    eye: () => { if (T && me) toggleEye(); },
    room: d => { const n = T.rooms.length; if (n > 1) switchRoom((S.cur.room + d + n) % n); },
    escape: () => { if (ghost) cancelGhost(); else if (multi) exitMulti(); else if (selUid) setSel(null); else if (!$('viewPop').hidden) $('btnView').click(); else if (cam.mode === 'eye') exitEyeMode(); else confirmDlg('家から出て、ホームにもどりますか？', '出る', 'かくにん', 'やめる').then(ok => { if (ok && T) leaveTeam(); }); }
  });
  $('btnRecent').onclick = recentDlg; $('btnLive').onclick = () => { setRealtime(!rtOn); toast(rtOn ? 'リアルタイム オン' : 'リアルタイム オフ', 'ok'); }; document.addEventListener('visibilitychange', rtWatch); window.addEventListener('pagehide', snapSeen); setInterval(snapSeen, 15000);
  $('btnPend').onclick = pendDlg; $('btnMission').onclick = missionDlg; $('btnNotes').onclick = notesDlg; $('btnTeams').onclick = teamJumpDlg;
  actx.editStaff = (p, after) => editStaffMe(p, after); actx.staffList = staffList; actx.itemIcon = itemIcon; actx.houseHi = houseHi;
  $('modal').addEventListener('pointerdown', e => { if (e.target === $('modal') && !$('dlg').classList.contains('sticky')) closeModal(); });
  $('panelToggle').onclick = () => panelSet(!panelClosed());
  applyRail(); syncLayout(); new ResizeObserver(railFit).observe($('main')); window.addEventListener('resize', railFit); window.addEventListener('resize', syncLayout); new MutationObserver(railFit).observe($('rail'), { attributes: true, subtree: true, attributeFilter: ['hidden'] });
  new ResizeObserver(resize).observe($('stage')); window.addEventListener('resize', resize);
  if (DEMOQ === 'katsumata') sampleHouse();
  else if (!TESTQ && !new URLSearchParams(location.search).has('local')) { renderLoading(); svStart(); } else renderSelect();
  requestAnimationFrame(frame);
  if ((!TESTQ && !DEMOQ) || TESTQ === 'opening') showOpening();
  window.addEventListener('pagehide', flushSave); document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
  onSaveRetry(() => { if (!SV.on || !T || !me || me.watch) return false; if (JSON.stringify(T.rooms) === lastRoomsJson && pendEmpty()) return false; commitHouse(); return true; });
  setInterval(renderHud, 500); setInterval(dailyTick, 1000);
  window.__kojo = { toggleEye, get S() { return S; }, get T() { return T; }, get me() { return me; }, pinHash, enterAs, requirePin, donateDlg, editMe, makeFlow, startHouse, meThumb, buy, startPlace, moveGhost, confirmGhost, tap, setSel, cam, project, leaveTeam, setCamMode, toggleLight, enterMulti, exitMulti, get AVS() { return AVS; }, get multi() { return multi; }, get tab() { return tab; }, set tab(v) { tab = v; renderPanel(); } };
  if (TESTQ) { new MutationObserver(() => console.log('TESTOUT ' + document.body.dataset.test)).observe(document.body, { attributes: true, attributeFilter: ['data-test'] }); setTimeout(() => runTest(TESTQ), 400); }
}
// ===== テスト用のサンプル（?test=...）。保存はしない =====
const DEMO_NAMES = '山田 太郎,佐藤 花子,鈴木 一郎,高橋 美咲,田中 蓮,伊藤 結衣,渡辺 大和,中村 あかり,小林 陸,加藤 さくら,吉田 悠真,山本 凛,佐々木 颯太,松本 芽依,井上 翔,木村 ひなた,林 湊,斎藤 美羽,清水 蒼,森田 心春'.split(',');
const DEMO_NICKS = 'ひなた,そら,みお,はると,ゆず,れん,もも,かいと,あおい,りく,こはる,だいち,なな,しおん,ここな,ゆうま,みなと,あん,たいが,さくら'.split(',');
function makeDemo(opt) {
  opt = opt || {};
  S = store.defaultState(); uidN = 1; T = null; me = null;
  S.students = DEMO_NAMES.map((n, i) => {
    const s = store.newStudent(String(101 + i), n);
    if (i < 18) { s.nick = DEMO_NICKS[i]; s.me = seededMe(s.uid); s.pin = pinHash('1234', s.uid); }   // 最後の2人は me-未作成・ニックネームなし
    return s;
  });
  const U = i => S.students[i].uid;
  const groups = [['ひまわり', 0, 6], ['あおぞら', 6, 11], ['もりのくま', 11, 16], ['ほしぞら', 16, opt.partial ? 18 : 20]];
  groups.forEach(([nm, a, b]) => { const t = store.newTeam(store.nextTeamId(S), nm); t.members = S.students.slice(a, b).map(s => s.uid); if (!opt.unconfirmed || nm === 'ひまわり') store.confirmTeamHouse(t); S.teams.push(t); });
  if (!opt.noScore) {
    const rows = S.students.map((s, i) => ({ studentId: s.uid, value: Math.round((((i * 37) % 9) + 1 + (i % 3) * .1) * 10) / 10 }));
    planScores(rows, {}, 'cum', S.settings.rate).forEach(p => { const st = studentById(p.studentId); st.picos += p.picos; st.earned += p.picos; S.lastScore[p.studentId] = p.newLast; });
    S.students.forEach(s => { s.picos = Math.round(s.picos * .6); });   // 少し使った状態
    S.teams.forEach((t, k) => { if (t.confirmed) t.picos = 18000 + k * 9000; });
  }
  const t0 = S.teams[0], r0 = t0.rooms[0];
  sq(r0, t0.size0 || CFG.MIN_SIZE);
  r0.items = [inst('rug1', 2, 2, 0), inst('bed1', 0, 0, 1), inst('desk', 3, 0, 0), inst('chair', 3, 1, 0), inst('shelf1', 0, 5, 0), inst('plantL', 6, 5, 0), inst('laptop', 3, 0, 0), inst('lamp', 4, 0, 0), inst('sofa1', 2, 5, 0), inst('lowtable', 2, 4, 0), inst('cactus', 0, 5, 0), inst('mug', 2, 4, 0), winst('window', 'L', 2, 1.2), winst('wclock', 'R', 0.5, 2.3), winst('poster', 'R', 4, 1.6)];
  r0.items.forEach((it, k) => { if (k % 5 !== 4) it.owner = t0.members[k % t0.members.length]; });
  t0.members.forEach((u, k) => { studentById(u).inv = k === 0 ? { vase: 1, sofa1: 1 } : {}; });
  if (opt.katsumata) {
    // 勝又チーミ：生徒が入ったときと同じ家。メンバーはニックネームだけ（本名なし）。ピコは買い物を試せる分だけ持たせる
    t0.name = '勝又'; t0.members = t0.members.slice(0, 6);
    S.students = t0.members.map(studentById); S.teams = [t0]; S.students.forEach(st => { st.name = st.nick; st.picos = 38000; });
    r0.wall = 'wp_sagewain'; r0.floor = 'fl_whitewash'; t0.own = { wallpaper: ['wp_cream', 'wp_sagewain'], floor: ['fl_wood', 'fl_whitewash'] };
    r0.items = [inst('rug2', 2, 2, 0), inst('bed1', 0, 0, 1), inst('desk', 3, 0, 0), inst('chair', 3, 1, 0), inst('laptop', 3, 0, 0), inst('lamp', 4, 0, 0), inst('shelf1', 0, 5, 0), inst('bookpile', 1, 5, 0), inst('plantL', 6, 5, 0), inst('floorlamp', 6, 0, 0), inst('sofa1', 2, 5, 0), inst('lowtable', 2, 4, 0), inst('mug', 2, 4, 0), inst('cactus', 0, 6, 0), inst('trophy', 4, 5, 0), winst('window', 'L', 2, 1.2), winst('wclock', 'R', 0.5, 2.3), winst('poster', 'R', 4, 1.6), winst('calendar', 'R', 6, 1.6)];
    r0.items.forEach((it, k) => { if (k % 5 !== 4) it.owner = t0.members[k % t0.members.length]; });
    t0.members.forEach((u, k) => { studentById(u).inv = k === 0 ? { vase: 1, plush: 1 } : {}; });
    t0.picos = 24000;
  }
  // 週間ミッションの例（12/1〜12/6・チーミ全員が週4コマ以上）。お試しでは ひまわり の何人かが記録ずみ
  const cnt = {}; t0.members.forEach((u, k) => { cnt[u] = [5, 4, 4, 2, 6, 3][k % 6]; });
  // 校舎のお知らせ（お試し）
  S.notices = [{ id: 'n1', at: Date.now() - 3600000, kind: 'important', title: '12/1(火) から向上ハウスがはじまるよ', body: '受講した分だけピコがもらえるよ。チーミのみんなで家をつくろう！', date: '2026-12-01' }, { id: 'n2', at: Date.now() - 7200000, kind: 'event', title: '冬の家具フェア', body: 'あたたかい家具がそろうよ。くわしくは担任助手まで。', date: '2026-12-12' }, { id: 'n3', at: Date.now() - 86400000, kind: 'info', title: 'あいことばは チーミのみんなだけの ひみつ', body: 'ほかのチーミの人に教えないでね。' }];
  S.missions = [{ id: 'w20261201', title: '週4コマ以上 受講しよう', start: '2026-12-01', end: '2026-12-06', need: 4, picos: 5000, item: 'trophy', counts: cnt, claims: [] }];
}
function runDemoView(mode) {
  const q = new URLSearchParams(location.search);
  // ?test=demo : お試しの「勝又チーミ」の家。生徒と同じ家画面で開き、買い物をしても通信・保存が一切起きない（fetch は止めて数える）
  if (mode === 'demo') {
    const calls = [], rf = window.fetch; window.fetch = (...a) => { calls.push(String(a[0])); return Promise.reject(new Error('テストでは通信しない')); };
    const ls0 = JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]));
    (async () => {
      const out = {}; sampleHouse(); sync();
      out.inHouse = $('select').hidden && $('app').classList.contains('in-house'); out.team = T.name; out.members = T.members.length; out.nick = $('meNick').textContent;
      out.noRealNames = S.students.every(s => s.name === s.nick); out.svOff = !SV.on; out.items = room().items.length; out.sample = document.body.classList.contains('sample');
      out.hud = ['btnBack', 'btnRank', 'btnSet', 'panel', 'bar'].every(id => !!$(id)); out.label = getComputedStyle(document.body, '::after').content;
      const p0 = me.picos; await buy('chair'); out.bought = me.inv.chair === 1 && me.picos === p0 - priceOf(ITEM.chair);
      // ピコ無制限：買ったあとも次の描画で元に戻る・表示は ∞。高い物（間取りの貯金箱払いも）も買える
      await new Promise(r => setTimeout(r, 300)); out.unl = me.picos === UNL && T.picos === UNL && $('pts').textContent === '∞' && $('bank').textContent === '∞';
      const big = ITEMS.filter(d => d.rank <= curRank()).sort((a, b) => priceOf(b) - priceOf(a))[0]; await buy(big.id); out.bigBought = (me.inv[big.id] | 0) >= 1;
      saveNow(); out.fetchCalls = calls.length; out.lsSame = JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])) === ls0;
      window.fetch = rf; document.body.dataset.test = JSON.stringify(out);
    })();
    return 'wait';
  }
  // ?test=keys : Enter＝主ボタン／Esc＝やめる／入力中はショートカットが効かない／数字キーでタブ／担任助手の入口（パスワードの揺れ・覚える・15分で閉じる）／だれが操作しますか
  if (mode === 'keys') {
    const calls = [], rf = window.fetch; window.fetch = (...a) => { calls.push(String(a[0])); return Promise.reject(new Error('テストでは通信しない')); };
    (async () => {
      const out = {}, wait = ms => new Promise(r => setTimeout(r, ms)), hid = () => $('modal').hidden;
      const kd = (el, key, o) => { const ev = new KeyboardEvent('keydown', Object.assign({ key, bubbles: true, cancelable: true }, o || {})); el.dispatchEvent(ev); return ev; };
      const OPK = 'kojoHouse.operator', op0 = localStorage.getItem(OPK), RK = 'kojoHouse.adminRemember', rk0 = localStorage.getItem(RK);
      try {
        sampleHouse(); sync(); await wait(150);
        // ダイアログ：Enter＝主ボタン、Esc＝やめる
        let r = null; confirmDlg('テスト', 'OK').then(v => { r = v; }); await wait(20); kd(document.body, 'Enter'); await wait(20); out.enterOk = r === true && hid();
        r = null; confirmDlg('テスト', 'OK').then(v => { r = v; }); await wait(20); kd(document.body, 'Escape'); await wait(20); out.escCancel = r === false && hid();
        // 複数行の中の Enter は改行（決定しない）。Ctrl+Enter で決定
        let fired = 0; const ta = h('textarea'); modal('t', ta, [h('button', { cls: 'btn', text: 'やめる', onclick: closeModal }), h('button', { cls: 'btn coral', text: '決定', onclick: () => { fired++; closeModal(); } })]);
        kd(ta, 'Enter'); out.taEnter = fired === 0 && !hid(); kd(ta, 'Enter', { ctrlKey: true }); out.taCtrl = fired === 1 && hid();
        // 1行の入力欄の Enter＝決定
        fired = 0; const one = h('input', { type: 'text' }); modal('t', one, [h('button', { cls: 'btn', text: 'やめる', onclick: closeModal }), h('button', { cls: 'btn mint', text: '決定', onclick: () => { fired++; closeModal(); } })]);
        kd(one, 'Enter'); out.inputEnter = fired === 1 && hid();
        // だれが操作しますか：名前の欄で Enter → 「この名前で始める」。覚えた名前があれば聞かない。変える（force）ときだけ聞く
        localStorage.removeItem(OPK); SV.operator = '';
        const pr = chooseOperator(['たなか', 'すずき']); await wait(20); const oi = $('dlg').querySelector('input[type=text]');
        out.opAsk = !hid() && $('dlg').innerText.includes('だれが操作しますか'); oi.value = 'はなこ'; kd(oi, 'Enter'); out.opEnter = (await pr) === 'はなこ' && SV.operator === 'はなこ' && hid();
        const pr2 = chooseOperator(['たなか']); await wait(20); out.opSkip = hid() && (await pr2) === 'はなこ';
        const pr3 = chooseOperator(['たなか'], { force: true }); await wait(20); out.opForce = !hid(); kd(document.body, 'Escape'); out.opEsc = (await pr3) === 'はなこ' && hid();
        // 家の中のショートカット
        out.inHouse = $('select').hidden && !!T;
        kd(document.body, '2'); out.tab2 = tab === 'inv'; kd(document.body, '1'); out.tab1 = tab === 'shop';
        const typ = h('input', { type: 'text' }); document.body.appendChild(typ); typ.focus(); kd(typ, '2'); out.typingIgnored = tab === 'shop'; typ.remove();
        const d0 = !!room().dark; kd(document.body, 'l'); out.light = !!room().dark !== d0; kd(document.body, 'l');
        const ctrlR = kd(document.body, 'r', { ctrlKey: true }); out.ctrlRfree = !ctrlR.defaultPrevented;
        const m0 = cam.mode; kd(document.body, 'v'); out.view = cam.mode !== m0;
        const sel0 = room().items[0]; if (sel0) { setSel(sel0.uid); kd(document.body, 'Escape'); out.escSel = selUid === null; }
        kd(document.body, '?', { shiftKey: true }); out.help = !hid() && $('dlg').innerText.includes('キーボードのショートカット'); kd(document.body, 'Escape'); out.helpEsc = hid();
        kd(document.body, ',', { ctrlKey: true }); out.settings = !hid() && $('dlg').innerText.includes('設定'); out.setRow = $('dlg').innerText.includes('一覧を見る') === hasKeyboard(); kd(document.body, 'Escape'); out.settingsEsc = hid();
        kd(document.body, 'Escape'); out.leaveAsk = !hid() && $('dlg').innerText.includes('家から出て'); kd(document.body, 'Escape'); out.leaveEsc = hid() && !!T;
        // シート：Esc で閉じる（入力中の Esc は、まず入力欄から出るだけ）
        openSheet('テスト', b => { b.appendChild(h('input', { type: 'text', cls: 'sht' })); }); const si = document.querySelector('#sheet .sht'); si.focus();
        kd(si, 'Escape'); out.sheetKeep = !$('sheet').hidden && document.activeElement !== si; kd(document.body, 'Escape'); out.sheetEsc = $('sheet').hidden;
        // 担任助手の入口：まちがえると揺れて赤いひとこと（閉じない）→ 正しい番号で入る → 覚えた端末は聞かない → 15分（ここでは短く）で閉じる
        localStorage.removeItem(RK); let reached = 0; const after = () => { reached++; };
        openAdminGate(after); await wait(80); let pi = $('dlg').querySelector('input.pass');
        out.gate = !!pi && document.activeElement === pi && !!$('dlg').querySelector('.pf-eye') && !!$('dlg').querySelector('.pf-rem input:checked');
        pi.value = '9999'; kd(pi, 'Enter'); await wait(60); out.gateBad = !hid() && $('dlg').querySelector('.pf-in').classList.contains('shake') && $('dlg').querySelector('.pf-err').textContent.length > 0 && reached === 0;
        $('dlg').querySelector('.pf-eye').click(); out.eye = pi.type === 'text'; $('dlg').querySelector('.pf-eye').click(); out.eyeBack = pi.type === 'password';
        pi.value = S.settings.passcode; kd(pi, 'Enter'); await wait(150); out.gateOk = reached === 1 && hid() && rememberedAdmin() === S.settings.passcode;
        $('sheet').hidden || (document.querySelector('#sheet .sh-close') || {}).click?.();
        openAdminGate(after); await wait(80); out.rememberedSkip = hid() && reached === 2;
        forgetAdmin(); openAdminGate(after); await wait(60); out.forgotAsk = !hid(); kd(document.body, 'Escape'); out.gateEsc = hid() && reached === 2;
        // 15分で自動で閉じる（ここでは 200ms にして確かめる）
        adminIdle.ms = 200; openAdminGate(() => openAdmin()); await wait(60); pi = $('dlg').querySelector('input.pass'); pi.value = S.settings.passcode; kd(pi, 'Enter'); await wait(120); out.adminOpen = !$('sheet').hidden;
        // 管理画面：Ctrl+2 で2番目のタブ、Esc で閉じる
        kd(document.body, '2', { ctrlKey: true }); out.adminTab = (document.querySelector('#sheet .adm-tab.on') || {}).textContent === document.querySelectorAll('#sheet .adm-tab')[1].textContent;
        await wait(400); out.idleClosed = $('sheet').hidden; adminIdle.ms = 15 * 60 * 1000; forgetAdmin();
        // 名簿の表：Enter で次の行の同じ列へ
        openAdmin('roster'); await wait(50); const g0 = document.querySelector('.ag-in[data-r="0"][data-c="1"]'); g0.focus(); kd(g0, 'Enter'); await wait(20);
        out.gridNext = document.activeElement && document.activeElement.dataset.r === '1' && document.activeElement.dataset.c === '1';
        kd(document.activeElement, 'Escape'); out.adminEsc1 = !$('sheet').hidden; kd(document.body, 'Escape'); out.adminEsc2 = $('sheet').hidden;
      } catch (e) { out.err = String(e && e.stack || e).slice(0, 300); }
      if (op0 == null) localStorage.removeItem(OPK); else localStorage.setItem(OPK, op0); if (rk0 == null) localStorage.removeItem(RK); else localStorage.setItem(RK, rk0);
      out.fetchCalls = calls.length; window.fetch = rf; document.body.dataset.test = JSON.stringify(out);
    })();
    return 'wait';
  }
  // ?test=demoadm : 担任助手モードのホームに「生徒が見る画面を見る（勝又チーミ）」ボタン
  // ?test=gate : 担任助手のパスワード画面（見た目の確認用。&bad=1 で まちがえた状態、&eye=1 で文字を表示、&val=... で入力ずみ）
  if (mode === 'gate' && q.get('kb')) { makeDemo(); renderSelect(); keyHelpDlg(); return 'ok'; }
  if (mode === 'gate') { makeDemo(); renderSelect(); openAdminGate(); setTimeout(() => { const i = $('dlg').querySelector('input.pass'); if (q.get('val')) i.value = q.get('val'); if (q.get('eye')) $('dlg').querySelector('.pf-eye').click(); if (q.get('bad')) { i.value = '9999'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); } }, 200); return 'ok'; }
  // ?test=loading : 最初の読み込み画面／?test=busyui&s=pend|ok|ng|ovl|soft|lag : 待ちの部品（pend=送信中 ok=成功 ng=失敗 ovl=上に出す待ち soft=小さな待ち lag=にせサーバーを1.5秒遅らせて rpc を見張る）。本物のサーバーには送らない
  if (mode === 'loading') { renderLoading(); const ft = q.get('t'); if (ft) document.querySelectorAll('.bs-p,.bs-glow').forEach(e => { e.style.animationPlayState = 'paused'; e.style.animationDelay = 'calc(var(--i, 0) * .22s - ' + ft + 's)'; }); return 'ok'; }   // &t=秒 でその瞬間に止める（画像確認用）
  if (mode === 'busyui') {
    window.__bzHold = true; makeDemo(); renderSelect(); const s = q.get('s') || 'pend', gaps = []; let last = 0;
    const tick = t => { if (last && t > 3000) gaps.push(t - last); last = t; document.body.dataset.maxgap = String(Math.round(Math.max(0, ...gaps))); requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    const box = h('div', { style: 'position:fixed;left:0;top:0;right:0;z-index:40;display:flex;gap:12px;padding:24px;background:#fff6e5' }), mk = (cls, t) => { const b = h('button', { cls: 'btn ' + cls, text: t }); box.appendChild(b); return b; };
    document.body.appendChild(box);
    if (s === 'pend' || s === 'ok' || s === 'ng') { const f = s === 'pend' ? () => new Promise(() => { }) : () => new Promise(r => setTimeout(() => r(s === 'ok'), 700)); ['coral', 'mint', ''].forEach(c => { const b = mk(c, 'ひらく'); busyBtn(b, f); }); }
    if (s === 'ovl') busyOverlay('あいことばを確かめています');
    if (s === 'soft') busyOverlay('ほぞんしています', { soft: true });
    if (s === 'lag') { import('../tools/mock_sb.js').then(async m => { const mk2 = m.makeMock(); SV.sb = mk2.sb; SV.on = true; window.__lag = +(q.get("lag") || 1500); await svRpc('check_pin', { p_uid: 'x', p_pin: '0000' }).catch(() => { }); document.body.dataset.lagdone = '1'; }); }
    return 'ok';
  }
  if (mode === 'desk') { makeDemo(); renderSelect(); openStaffDesk({ teams: () => S.teams.filter(t => t.confirmed), watch: watchTeam, openAdmin: gateAdmin }); return 'ok'; }
  if (mode === 'watch') { makeDemo(); renderSelect(); watchTeam(S.teams[0].id).then(() => { sync(); document.body.dataset.test = 'ok'; }); return 'wait'; }
  if (mode === 'demoadm') { makeDemo(); renderSelect(); adminPreset({ tab: q.get('tab') || 'home' }); openAdmin(); const b = document.querySelector('.demo-open'); return b ? 'btn: ' + b.textContent : 'no button'; }
  if (mode === 'empty') { S = store.defaultState(); T = null; renderSelect(); return 'ok'; }
  if (mode === 'select') { makeDemo(); renderSelect(); return 'ok'; }
  if (mode === 'demobtn') { const b = [...document.querySelectorAll('#select button')].find(x => x.textContent.includes('お試しデータ')); if (!b) return 'no button'; b.click(); return 'teams=' + S.teams.filter(t => t.confirmed).length; }
  if (mode === 'visit') { makeDemo(); renderSelect(); visitTeam(S.teams[0].id).then(() => { sync(); document.body.dataset.test = 'ok'; }); return 'wait'; }
  // ?test=staffvisit : 担任助手me-で家を見に行く → ★で歩く・伝言を書く・ほかのチーミへ移動・生徒は読むだけ
  if (mode === 'staffvisit') {
    makeDemo(); S.staffMes = [{ id: 's1', nick: 'たなか', me: Object.assign(randomMe(), { hat: 7, top: 4 }) }];
    const out = {}; renderSelect();
    (async () => {
      await visitTeam(S.teams[0].id); sync();
      const sa = AVS.find(a => a.id === '__staff'); out.staffAvatar = !!sa; out.staffName = sa && sa.name; out.teamsBtn = !$('btnTeams').hidden; out.notesBtn = !$('btnNotes').hidden;
      out.added = await addNote(T, 'あしたは 10時から です。がんばろう！'); out.notes = (T.notes || []).length; out.bubble = sayAvatar(me.uid, 'あしたは 10時から です。がんばろう！') && !!AVS.find(a => a.id === me.uid).say;
      notesDlg(); for (const tx of ['1つめ', '2つめ']) { const ta = document.querySelector('#dlg .note-in'), bt = ta && ta.nextElementSibling; if (!bt) break; ta.value = tx; bt.click(); await new Promise(r => setTimeout(r, 30)); }
      out.writeTwice = (T.notes || []).length === out.notes + 2 && !$('modal').hidden && !!document.querySelector('#dlg .note-in'); out.sayText2 = (T.notes || []).slice(-1)[0].text; closeModal();
      const t0 = T.id; leaveTeam(); await visitTeam(S.teams[1].id); out.moved = T && T.id !== t0; out.staffStill = AVS.some(a => a.id === '__staff');
      leaveTeam(); window.__noPin = true; enterAs(S.teams[0].id, S.teams[0].members[0]); await new Promise(r => setTimeout(r, 50));
      out.studentSeesNote = !$('btnNotes').hidden && $('btnNotes').classList.contains('new'); out.studentTeamsBtn = !$('btnTeams').hidden;
      notesDlg(); out.studentCanWrite = !!document.querySelector('#dlg .note-in'); out.noteShown = (document.querySelector('#dlg .note-tx') || {}).textContent;
      document.body.dataset.test = JSON.stringify(out);
    })().catch(e => { out.err = String(e && e.stack || e); document.body.dataset.test = JSON.stringify(out); });
    return 'wait';
  }
  // ?test=stusay : 生徒の画面。家に入ると、まだ読んでいない伝言を担任助手me-が吹き出しで話す → 届いた伝言も話す → 話し終わると帰る
  if (mode === 'stusay') {
    makeDemo(); S.staffMes = [{ id: 's1', nick: 'たなか', me: Object.assign(randomMe(), { hat: 7, top: 4 }) }];
    S.teams[0].notes = [{ id: '1', at: Date.now() - 60000, by: 'たなか', text: 'きょうは 10時から です。みんなで家具をならべよう！' }];
    const out = {}, g = () => AVS.find(a => a.id === GUEST); renderSelect(); window.__noPin = true; enterAs(S.teams[0].id, S.teams[0].members[0]); sync();
    (async () => {
      await new Promise(r => setTimeout(r, 900)); out.guestOnEnter = !!(g() && g().say); out.guestName = g() && g().name;
      if (q.get('shot')) { document.body.dataset.test = 'ok'; return; }
      const d = { students: S.students, teams: S.teams.map(t => Object.assign({}, t)), priceMul: S.settings.priceMul, staffMes: S.staffMes, missions: S.missions, notices: S.notices, startDate: S.startDate,
        notes: S.teams[0].notes.map(n => Object.assign({ teamId: S.teams[0].id }, n)).concat({ id: '2', teamId: S.teams[0].id, at: Date.now(), by: 'たなか', text: 'おつかれさま！' }) };
      applyServer(d); const a = g(); out.guestOnNew = !!(a && a.say); out.oneGuest = AVS.filter(x => x.id === GUEST).length === 1;
      a.sayAge = a.sayT + 1; stepSay(a, 0); out.leftAfter = !g();
      document.body.dataset.test = JSON.stringify(out);
    })().catch(e => { out.err = String(e && e.stack || e); document.body.dataset.test = JSON.stringify(out); });
    return 'wait';
  }
  // ?test=staffroom : 担任助手が家を見ているところ（★の担任助手me-と、伝言板を開いた画面の確認用）（&say=文 で頭の上の吹き出し）
  if (mode === 'staffroom') {
    makeDemo(); S.staffMes = [{ id: 's1', nick: 'たなか', me: Object.assign(randomMe(), { hat: 7, top: 4 }) }];
    S.teams[0].notes = [{ id: '1', at: Date.now() - 86400000, by: 'たなか', text: 'きのうは 家具を ならべてくれて ありがとう！' }, { id: '2', at: Date.now(), by: 'たなか', text: 'あしたは 10時から です。がんばろう！' }];
    studentById(S.teams[0].members[1]).staff = true;
    renderSelect(); visitTeam(S.teams[0].id).then(() => { sync(); if (q.get('notes')) notesDlg(); if (q.get('say')) { const sa = AVS.find(x => x.id === me.uid); if (sa) { sa.x = 2.5; sa.y = 2.5; } sayAvatar(me.uid, q.get('say')); } document.body.dataset.test = 'ok'; });
    return 'wait';
  }
  // ?test=pins : 担任助手モードの「番号」タブ（端末版）
  if (mode === 'pins') {
    makeDemo(); S.students.slice(0, 3).forEach(s => { s.pin = pinHash('1234', s.uid); }); studentById(S.teams[0].members[1]).staff = true;
    renderSelect(); adminPreset({ tab: q.get('tab') || 'pins' }); openAdminGate(); $('dlg').querySelector('input').value = '0000'; $('dlg').querySelector('input').dispatchEvent(new Event('input')); return 'ok';
  }
  // ?test=staffmembers : メンバー選択で、担任助手のme-に★の札
  if (mode === 'staffmembers') { makeDemo(); studentById(S.teams[0].members[1]).staff = true; showTeamMembers(S.teams[0].id); renderSelect(); return 'ok'; }
  if (mode === 'house') { makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]); sync(); return 'ok'; }
  // ?test=plan&cam=iso|top|free&room=0|1|2 : 3部屋（L字のつながり）の家。部屋0とリビングはひとつづき、書斎は入口つき。玄関は手前が外に面したリビング側
  // ?test=planedit : 同じ家で間取り画面を開いた状態（リビングを右に1マス広げた下書き）
  if (mode === 'plan' || mode === 'planedit') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]);
    const rooms = T.rooms, r0 = rooms[0], sz = r0.w; r0.name = '自分の部屋';
    const r1 = store.newRoom('リビング', 7, sz, sz, 0), r2 = store.newRoom('書斎', sz, 5, 0, sz);
    r1.wall = 'wp_sagewain'; r1.floor = 'fl_whitewash'; r2.wall = 'wp_cream'; r2.floor = 'fl_birch';
    r1.items = [inst('rug6', 1, 2), inst('sofa1', 1, 1), inst('lowtable', 1, 3), inst('plantL', 6, 0), inst('lamp', 4, 1), winst('frame', 'R', 2, 1.6), winst('frame', 'L', 1.5, 1.6)].filter(i => ITEM[i.id]);
    r2.items = [inst('desk', 1, 0), inst('chair', 1, 1), inst('shelf1', 5, 0), winst('frame', 'R', 3, 1.7)].filter(i => ITEM[i.id]);
    T.rooms.push(r1, r2); T.open = ['0-1']; T.picos = Math.max(T.picos, 60000);
    S.cur.room = Math.min(2, +(q.get('room') || 0));
    afterLoad(); sync(); setCamMode(q.get('cam') || 'iso'); paintCam(); updateCamera(0, true);
    if (q.get('thumb') === 'err') { setTimeout(() => { try { renderHouse(T); document.body.dataset.test = 'ok'; } catch (e) { document.body.dataset.test = String(e.stack).slice(0, 400); } }, 300); return 'wait'; }
    if (q.get('thumb') != null) { houseThumb(T, u => { const im = new Image(); im.src = u; im.style.cssText = 'position:fixed;left:10px;top:10px;width:360px;height:250px;z-index:999;background:#fde;border:2px solid #333'; document.body.appendChild(im); document.body.dataset.test = 'thumb ' + u.length; }); return 'wait'; }
    if (q.get('tap') != null) { (async () => { const out = {}, wait = ms => new Promise(r => setTimeout(r, ms)), tp = async (x, z) => { await wait(120); const p = project(new THREE.Vector3(x, 0, z)); tap(p[0], p[1], 'touch'); return S.cur.room; }; out.fromRoom0ToLiving = await tp(sz + 3, 3); out.backToRoom0 = await tp(2, 2); out.toStudy = await tp(3, sz + 2); document.body.dataset.test = JSON.stringify(out); })(); return 'wait'; }
    if (mode === 'planedit') { const ctl = openPlanScreen(); window.__plan = ctl; ctl.sel(1); ctl.edgeXY('r', sz + 8, 0); }
    return 'ok';
  }
  // ?test=play&items=fridge,tansu&use=fridge&stop=ms&buy=品物id&ach=実績の名前&prof=1&zoom=1.6&night=1&cam=iso : さわって遊ぶ家具・ドーパミン演出の確認用（にせのサーバー。通信しない）
  //   items＝置く品物のid（,区切り。床の物は手前の列から横に並べ、壁かけは奥の壁に並べる）／use＝「使う」を押す品物のid（ひとつ目が選ばれた状態になる）／buy＝空から落ちる演出を見る品物のid
  //   stop＝その時間（ミリ秒）で画面の更新を止める（途中を撮る）／ach＝実績トーストを出す／prof＝プロフィール（実績の一覧）を開く
  if (mode === 'play') {
    const calls = []; window.fetch = (...a) => { calls.push(String(a[0])); return Promise.reject(new Error('テストでは通信しない')); };
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]);
    const rm = room(); rm.wall = q.get('wall') || 'wp_cream'; rm.floor = q.get('floor') || 'fl_whitewash'; rm.items = [];
    const ids = (q.get('items') || 'fridge,tansu,cabinet').split(','), n = N(), at = (q.get('at') || '0,0').split(',').map(Number); let fx = at[0], fy = at[1], wx = q.get('wat') ? +q.get('wat') : .4;
    ids.forEach(id => {
      const d = ITEM[id]; if (!d) return;
      if (d.wall) { rm.items.push(winst(id, q.get('side') || 'R', wx, d.zb != null ? d.zb : 1.2)); wx += d.w + .3; }
      else { const w = Math.ceil(d.w); if (fx + w > n) { fx = at[0]; fy += 2; } rm.items.push(inst(id, fx, fy, 0)); fx += w; }
    });
    if (q.get('night') === '1') rm.dark = true;
    placeAvatars(); AVS.forEach(a => { a.g.visible = false; }); rebuildRoom(); sync(); setCamMode(q.get('cam') || 'iso'); paintCam(); updateCamera(0, true); if (q.get('zoom')) setZoom(+q.get('zoom'));
    const useIds = (q.get('use') || '').split(',').filter(Boolean);
    if (useIds.length) setTimeout(() => { const it0 = rm.items.find(i => i.id === useIds[0]); if (it0) setSel(it0.uid); useIds.forEach(id => { const it = rm.items.find(i => i.id === id); if (it) PLAY.use(it.uid, performance.now() / 1000); }); cam.dirty = true; }, 700);
    if (q.get('buy')) setTimeout(() => { const d = ITEM[q.get('buy')]; if (!d) return; const o = d.wall ? winst(d.id, 'R', 3, d.zb != null ? d.zb : 1.2) : inst(d.id, 3, 3, 0); rm.items.push(o); invalidate(); dropIn(o, d); }, 500);
    if (q.get('ach')) setTimeout(() => JOY.unlock(me.uid, q.get('ach'), achSfx), 600);
    if (q.get('prof') === '1') setTimeout(() => profileDlg(), 800);
    if (q.get('stop')) setTimeout(() => { const raf = window.requestAnimationFrame.bind(window); let ft = null; window.requestAnimationFrame = cb => raf(t => { if (ft == null) ft = t; cb(ft); }); }, +q.get('stop'));   // 時間を止める
    // fast＝そのぶんの手数だけ、動きを一気に進めて止める（画面の更新が遅い環境でも、同じ場面を撮れる）／fastat＝それを行う時刻（ミリ秒）
    if (+q.get('fast')) setTimeout(() => { let t = performance.now() / 1000; for (let i = 0; i < +q.get('fast'); i++) { if (needSync) sync(); t += .03; PLAY.tick(t); stepDrops(.03); stepPops(.03); } cam.dirty = true; const raf = window.requestAnimationFrame.bind(window); let ft = null; window.requestAnimationFrame = cb => raf(t0 => { if (ft == null) ft = t0; cb(ft); }); }, +q.get('fastat') || 1500);
    window.__play = { use: id => { const it = rm.items.find(i => i.id === id); return it ? PLAY.use(it.uid, performance.now() / 1000) : null; }, state: () => rm.items.map(i => { const g = objs.get(i.uid); return [i.id, g && g.userData.use ? (g.userData.on) : null]; }), rm, dim: () => PLAY.dimK(), busy: () => PLAY.busy(), calls };
    return JSON.stringify({ n: rm.items.length, rigs: rm.items.map(i => { const g = objs.get(i.uid); return [i.id, !!(g && g.userData.use)]; }) });
  }
  // ?test=deco&cam=iso|top|wallL|wallR&night=1&wall=wp_sagewain&floor=fl_whitewash : 第3弾の壁・床・壁かけ・小物を並べた部屋
  if (mode === 'deco') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]);
    const rm = room(); rm.wall = q.get('wall') || 'wp_sagewain'; rm.floor = q.get('floor') || 'fl_whitewash'; rm.items = [];
    const n = N(), P = (id, x, y, r) => rm.items.push(inst(id, x, y, r || 0)), Wl = (id, w, p, z) => rm.items.push(winst(id, w, p, z));
    P('rug6', 2, 2); P('sofa1', 2, 1); P('lowtable', 2, 3); P('candle', 2, 3); P('jar', 3, 3); P('cubeshelf', 0, 0); P('bottles', 0, 0); P('basket', 1, 0); P('plantL', n - 1, 0); P('armchair', 4, 2);
    Wl('cafewin', 'R', 1.2, 1.1); Wl('wplanter', 'R', 2.6, 1.9); Wl('dryflower', 'R', 3.8, 1.5); Wl('switch', 'R', .3, 1.2); Wl('spotrail', 'R', n - 2.2, 2.85);
    Wl('bracket', 'L', 1.2, 2.0); Wl('hookrack', 'L', 2.4, .9); Wl('cafewin', 'L', 3.8, 1.1);
    if (q.get('night') === '1') rm.dark = true;
    placeAvatars(); rebuildRoom(); sync(); setCamMode(q.get('cam') || 'iso'); paintCam(); updateCamera(0, true);
    const out = { n: rm.items.length, thumbErr: ITEMS.filter(d => ['wplanter', 'dryflower', 'bracket', 'switch', 'cafewin', 'hookrack', 'spotrail', 'candle', 'jar', 'basket', 'bottles'].includes(d.id)).filter(d => { try { return !renderThumb(d); } catch (e) { return true; } }).map(d => d.id) };
    return JSON.stringify(out);
  }
  // ?test=rug : ラグ・玄関マットの上で、足の裏がその上の面より下に出ない（埋まらない）ことを数値で確かめる。止まって立つ・歩く・座る手前の姿勢、丸・長方形・タテ長・回転・小さいラグ・ラグの上の家具（&night=1 など画面確認用の入口にもなる）
  //   結果 { min, max, n, worst }：min＝（足の底の最低点 − その真下のラグの上の面）の最小値。-0.003 より小さければ埋まっている。max は浮きすぎ（0.03 より大きい）の確認
  if (mode === 'rug' || mode === 'rugshot') {
    window.fetch = () => Promise.reject(new Error('テストでは通信しない'));
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]);
    const rm = room(); rm.wall = 'wp_cream'; rm.floor = 'fl_whitewash'; rm.items = []; rm.w = rm.d = 12;
    const P = (id, x, y, r) => rm.items.push(inst(id, x, y, r || 0));
    P('rug1', 1, 1); P('rug2', 4, 1); P('rug7', 8, 1); P('rug5', 1, 5); P('rug6', 4, 5); P('rug2', 9, 5, 1); P('rug3', 1, 9); P('sofa1', 4, 9); P('rug4', 8, 8);
    placeAvatars(); rebuildRoom(); sync(); setCamMode(q.get('cam') || 'iso'); paintCam(); updateCamera(0, true);
    const a = eyeMe(); AVS.forEach(o => { if (o !== a) { o.x = -50; o.y = -50; o.idle = 1e9; } }); a.path = []; a.wp = null; a.idle = 1e9;
    const ray = new THREE.Raycaster(), box = new THREE.Box3(), down = new THREE.Vector3(0, -1, 0);
    const rugs = rm.items.filter(i => ITEM[i.id].cat === 'rug'), rugObjs = rugs.map(i => objs.get(i.uid)).filter(Boolean);
    const surf = (x, y) => { ray.set(new THREE.Vector3(x, 2, y), down); const h = ray.intersectObjects(rugObjs, true); return h.length ? h[0].point.y : 0; };   // その点の真下の、ラグの上の面（なければ床 0）
    const foot = () => { E.fxG.updateMatrixWorld(true); let m = 1e9; [a.legs[0], a.legs[1]].forEach(l => { box.setFromObject(l, true); m = Math.min(m, box.min.y); }); return m; };
    const res = { min: 1e9, max: -1e9, n: 0, worst: null, onRug: 0, minFloor: 1e9, minStand: 1e9, maxStand: -1e9 };
    const ent = entRect(rm), entSurf = (x, y) => { E.roomPick.updateMatrixWorld(true); ray.set(new THREE.Vector3(x, .5, y), down); const h = ray.intersectObject(E.roomPick, true).filter(q => q.object.isMesh && q.object.visible); return h.length ? Math.max(0, h[0].point.y) : 0; };   // 玄関の土間・マットの上の面（部屋の静かな部分を真下に撃つ）
    let useEnt = false;
    const rec = (tag) => { const s = useEnt ? entSurf(a.x, a.y) : surf(a.x, a.y), f = foot() - E.fxG.position.y, dlt = f - s; res.n++; if (s > 0 && tag.indexOf('walk') < 0) { if (dlt < res.minStand) res.ws = [tag, +s.toFixed(3), +f.toFixed(4)]; res.minStand = Math.min(res.minStand, dlt); res.maxStand = Math.max(res.maxStand, dlt); } if (s <= 0) res.minFloor = Math.min(res.minFloor, dlt); else res.onRug++; if (s > 0 && dlt < res.min) { res.min = dlt; res.worst = [tag, +a.x.toFixed(2), +a.y.toFixed(2), +s.toFixed(3), +f.toFixed(3)]; } if (s > 0 && dlt > res.max) res.max = dlt; };
    const place = (x, y) => { a.x = x; a.y = y; a.v = 0; a.amp = 0; a.rugY = null; for (let k = 0; k < 40; k++) updateAvatarObj(a, 1 / 60); };
    window.__rugRun = () => {
      if (ent) {   // 玄関の土間・マットの上：立つ・まっすぐ入って（外から）歩く
        useEnt = true; const cx = (ent.x0 + ent.x1) / 2, d = rm.d;
        [[0, -.55], [.45, -.5], [-.45, -.5], [.9, -.5], [0, -.95], [0, -.1], [-.9, -.3]].forEach(([dx, dy], k) => { place(cx + dx, d + dy); rec('ent#' + k); });
        a.rugY = null; a.x = cx; a.y = d - 3; a.v = 2.6; for (let k = 0; k < 100 && a.y < d - .05; k++) { a.y += 2.6 / 60; updateAvatarObj(a, 1 / 60); rec('ent-walk'); }
        useEnt = false;
      }
      rugs.forEach(i => {
        const r = rectOf(i), cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2, w = r.x1 - r.x0, h = r.y1 - r.y0;
        [[0, 0], [.3, .3], [-.3, .2], [w / 2 - .3, 0], [0, h / 2 - .3], [-(w / 2 - .3), -(h / 2 - .3) * .5]].forEach(([dx, dy], k) => { place(cx + dx, cy + dy); rec(i.id + '#' + k); });   // 立つ（中心・ふちのそば）
        a.rugY = null; a.x = Math.max(.3, r.x0 - .5); a.y = cy; a.v = 2.6; for (let k = 0; k < 200 && a.x < rm.w - .3; k++) { a.x += 2.6 / 60; updateAvatarObj(a, 1 / 60); rec(i.id + '-walk'); }   // 歩いて横切る（足を振る）
      });
      return res;
    };
    if (mode === 'rug') { const r = window.__rugRun(); if (r.minStand < -.006 || r.maxStand > .012 || r.min < r.minFloor - .004) return JSON.stringify({ err: 'ラグ・玄関マットで足が埋まる/浮く', min: r.min, minFloor: r.minFloor, stand: [r.minStand, r.maxStand], ws: r.ws, worst: r.worst }); return JSON.stringify({ min: +r.min.toFixed(4), minFloor: +r.minFloor.toFixed(4), stand: [+r.minStand.toFixed(4), +r.maxStand.toFixed(4)], max: +r.max.toFixed(4), n: r.n, onRug: r.onRug, worst: r.worst }); }
    { const at = (q.get('at') || '2,2').split(',').map(Number); place(at[0] + .5, at[1] + .5); a.ry = a.tr = 0; holdAvatars(); updateCamera(0, true); cam.dirty = true; return 'ok'; }
  }
  // ?test=yard : 庭を歩く確認用（にせのサーバー。通信しない）。at=x,y（立つマス。庭は部屋の外の値）&walk=x,y（歩く先のマス）&tx=x,y（そのマスをタップ）&others=1（ほかの人もぶらぶら）&eye=1（目線）&night=1&cam=
  //   結果は window.__yard()（いまの様子）・window.__yardSweep()（いろいろな間取りで、玄関から庭のどこまで行けるか）で取る
  if (mode === 'yard') {
    const calls = []; window.fetch = (...a) => { calls.push(String(a[0])); return Promise.reject(new Error('テストでは通信しない')); };
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]);
    const rm = room(); rm.wall = 'wp_cream'; rm.floor = 'fl_whitewash'; rm.items = [];
    const n = N(), P = (id, x, y, r) => rm.items.push(inst(id, x, y, r || 0));
    P('rug6', 2, 1); P('sofa1', 2, 0); P('plantL', n - 1, 0); P('lamp', 1, 3);
    if (q.get('night') === '1') rm.dark = true;
    placeAvatars(); rebuildRoom(); sync(); setCamMode(q.get('cam') || 'iso'); paintCam(); updateCamera(0, true);
    const a = eyeMe(), at = (q.get('at') || '3,3').split(',').map(Number), oth = q.get('others') === '1';
    a.x = at[0] + .5; a.y = at[1] + .5; a.path = []; a.wp = null; a.v = 0; a.res = null; a.hd = null; a.ry = a.tr = +(q.get('face') || 0) * Math.PI / 180; a.idle = 99;
    AVS.forEach(o => { if (o !== a) o.idle = oth ? 1 : 99; }); if (!oth) holdAvatars();
    if (q.get('eye') === '1') { enterEyeMode(); if (q.get('look')) { const lk = q.get('look').split(',').map(Number); EYE.yaw = EYE.cy = lk[0] * Math.PI / 180; EYE.pitch = EYE.cp = (lk[1] || 0) * Math.PI / 180; } eyeSelf(); updateCamera(0, true); }
    if (q.get('walk')) { const w = q.get('walk').split(',').map(Number); setTimeout(() => walkTo(w[0], w[1], true), 600); }
    if (q.get('tx')) { const w = q.get('tx').split(',').map(Number); setTimeout(() => { const p = project(new THREE.Vector3(E.fxG.position.x + w[0] + .5, w[1] >= room().d || w[0] < 0 || w[0] >= room().w ? -.34 : 0, E.fxG.position.z + w[1] + .5)); tap(p[0], p[1], 'touch'); }, 900); }
    const outside = v => v.x < 0 || v.y < 0 || v.x >= room().w || v.y >= room().d;
    window.__yard = () => { const b = blk(), r = room(); return { me: [+a.x.toFixed(2), +a.y.toFixed(2)], y: +a.g.position.y.toFixed(3), path: a.path.length, moving: !!a.moving, out: AVS.filter(outside).length, n: AVS.length, door: b.door, grid: [b.ox, b.oy, b.w, b.d], room: [r.w, r.d], camPts: E.camPts ? E.camPts.length : 0, fetch: calls.length }; };
    // 玄関の外から、庭のあいているマスのうち、何割まで歩いて行けるか（8方向・角はすり抜けない。あるいは、あいているマスが部屋の外にいくつあるか）
    const reach = b => {
      if (!b.door) return { door: false }; const rr = room(), idx = (x, y) => (y - b.oy) * b.w + (x - b.ox), open = (x, y) => x >= b.ox && y >= b.oy && x < b.ox + b.w && y < b.oy + b.d && !b.g[idx(x, y)];
      const seen = new Set(), st = [[b.door.x0, rr.d]]; seen.add(b.door.x0 + ',' + rr.d); let far = 0;
      while (st.length) { const [x, y] = st.pop(); for (let k = 0; k < 8; k++) { const nx = x + DX8[k], ny = y + DY8[k]; if (!open(nx, ny) || seen.has(nx + ',' + ny)) continue; if (DX8[k] && DY8[k] && (!open(x, ny) || !open(nx, y))) continue; seen.add(nx + ',' + ny); st.push([nx, ny]); } }
      let total = 0, got = 0, beyond = 0, beyondGot = 0; for (let y = b.oy; y < b.oy + b.d; y++) for (let x = b.ox; x < b.ox + b.w; x++) if (open(x, y) && (x < 0 || y < 0 || x >= rr.w || y >= rr.d)) { total++; const s = seen.has(x + ',' + y); if (s) got++; if (y > rr.d + 2) { beyond++; if (s) beyondGot++; } }
      return { door: true, open: total, reached: got, beyond, beyondReached: beyondGot, grid: [b.w, b.d] };
    };
    window.__yardStep = (n, mine, snapCam) => { const track = []; for (let s = 0; s < n; s++) { AVS.forEach(o => { if (!mine || o === a) { updateAvatar(o, 1 / 60); updateAvatarObj(o, 1 / 60); } }); if (s % 30 === 0) track.push([+a.x.toFixed(1), +a.y.toFixed(1), +a.g.position.y.toFixed(2)]); } E.camPts = yardPts(); updateCamera(0, !!snapCam); cam.dirty = true; return track; };   // 時間を進める（画面の更新を待たずに）。自分の動きの記録を返す
    window.__yardMap = () => {   // 歩ける表を文字で（# ふさがり・. あき・o 玄関から行ける・D 玄関の外・R 部屋の中）
      BLK.n = -1; const b = blk(), rr = room(); if (!b.door) return 'なし'; const open = (x, y) => x >= b.ox && y >= b.oy && x < b.ox + b.w && y < b.oy + b.d && !b.g[(y - b.oy) * b.w + (x - b.ox)];
      const seen = new Set([b.door.x0 + ',' + rr.d]), st = [[b.door.x0, rr.d]];
      while (st.length) { const [x, y] = st.pop(); for (let k = 0; k < 8; k++) { const nx = x + DX8[k], ny = y + DY8[k]; if (!open(nx, ny) || seen.has(nx + ',' + ny)) continue; if (DX8[k] && DY8[k] && (!open(x, ny) || !open(nx, y))) continue; seen.add(nx + ',' + ny); st.push([nx, ny]); } }
      const rows = []; for (let y = b.oy; y < b.oy + b.d; y++) { let s = ''; for (let x = b.ox; x < b.ox + b.w; x++) s += (x >= 0 && y >= 0 && x < rr.w && y < rr.d) ? 'R' : x === b.door.x0 && y === rr.d ? 'D' : seen.has(x + ',' + y) ? 'o' : open(x, y) ? '.' : '#'; rows.push(s); } return rows.join('\n');
    };
    // 庭へ出られないことがないかの総当たり（乱数・種つき）：いろいろな間取り・家具・人数・開始位置・行き先で、玄関から庭へ歩かせ、途中の行き先変更・連打も混ぜて、着けなかった回数を数える（&n=回数&seed=種&only=間取り名）
    window.__yardStress = (n, seed, only, noOth, noInt) => {
      let s = (seed | 0) || 1; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }, ri = k => Math.floor(rnd() * k);
      const base = JSON.parse(JSON.stringify(T.rooms)), curr = S.cur.room, r0 = base[0], ids = ['sofa1', 'plantL', 'lamp', 'desk', 'chair', 'rug6'], sav = AVS.slice(), res = { n: 0, fail: 0, nopath: 0, byCase: {}, fails: [] };
      const mk = (x, z, w, d) => { const r = JSON.parse(JSON.stringify(base[0])); r.x = x; r.z = z; r.w = w; r.d = d; r.items = []; return r; };
      const cases = { single: [], right: [[r0.x + r0.w, r0.z, 5, 5]], below: [[r0.x, r0.z + r0.d, 5, 4]], Lshape: [[r0.x + r0.w, r0.z, 4, 4], [r0.x, r0.z + r0.d, 4, 4]] }, names = Object.keys(cases).filter(k => !only || only.includes(k));
      const free = (b, rr) => { const c = []; for (let y = 0; y < rr.d; y++) for (let x = 0; x < rr.w; x++) if (!solidAt(b, x, y)) c.push([x, y]); return c; };
      for (let it = 0; it < n; it++) {
        const name = names[it % names.length], adds = cases[name];
        T.rooms = [JSON.parse(JSON.stringify(base[0])), ...adds.map(ad => mk(...ad))];
        T.rooms[0].w = 4 + ri(4); T.rooms[0].d = 4 + ri(4); if (rnd() < .5) T.rooms[0].items = []; else T.rooms[0].items = [];
        const rm0 = T.rooms[0]; for (let k = ri(5); k > 0; k--) { const d = ITEM[ids[ri(ids.length)]], x = ri(rm0.w), y = ri(rm0.d), rot = ri(4); if (placeCheck(rm0, d, x, y, rot).ok) rm0.items.push(inst(d.id, x, y, rot)); }
        S.cur.room = 0; outHouse(houseBox(T.rooms), entryPoint(T.rooms)); BLK.n = -1; YARD.k = null; const b = blk(), rm = room();
        if (!b.door) continue;
        const a = eyeMe(), cell = free(b, rm), outc = []; for (let y = b.oy; y < b.oy + b.d; y++) for (let x = b.ox; x < b.ox + b.w; x++) if (!solidAt(b, x, y) && (x < 0 || y < 0 || x >= rm.w || y >= rm.d)) outc.push([x, y]);
        if (!cell.length || !outc.length) continue;
        const nOth = noOth ? -1 : ri(Math.min(AVS.length, 6)); AVS.forEach((o, i) => { if (o === a) return; if (noOth) { o.x = -50; o.y = -50; o.path = []; o.wp = null; o.idle = 1e9; o.rt = null; return; } o.path = []; o.wp = null; o.v = 0; o.res = null; o.esc = null; o.wait = 0; o.fail = 0; o.stk = 0; o.shoe = null; o.shoesOn = null; o.shoeX = null; o.rt = null; o.react = 0; const near = rnd() < .5; const c = near ? [b.door.x0 + ri(3) - 1, rm.d + ri(3) - 1] : cell[ri(cell.length)]; const ok = !solidAt(b, c[0], c[1]); o.x = (ok ? c : cell[ri(cell.length)])[0] + .5; o.y = (ok ? c : cell[ri(cell.length)])[1] + .5; o.idle = i > nOth ? 2 + rnd() * 5 : rnd() * 3; });
        const st = rnd() < .3 ? [b.door.x0 + ri(2), rm.d - 1 + ri(2)] : cell[ri(cell.length)];
        a.x = (solidAt(b, st[0], st[1]) ? cell[0] : st)[0] + .5; a.y = (solidAt(b, st[0], st[1]) ? cell[0] : st)[1] + .5; a.path = []; a.wp = null; a.v = 0; a.res = null; a.esc = null; a.wait = 0; a.fail = 0; a.stk = 0; a.shoe = null; a.shoesOn = null; a.shoeX = null; a.hd = null; a.ry = a.tr = rnd() * 6.28; a.idle = 1e9; a.react = 0; a.rt = null;
        let dest = outc[ri(outc.length)], nCmd = 1 + (!noInt && rnd() < .5 ? ri(3) : 0), tNext = rnd() * 3, cmds = 0;
        a.dbgLog = []; walkTo(dest[0], dest[1], true); cmds++; if (!a.path.length) { res.nopath++; continue; }
        let last = a.path[a.path.length - 1], step = 0, tail = 0;
        for (; step < 2400; step++) {
          const t = step / 60;
          if (cmds < nCmd && t > tNext) { cmds++; tNext = t + rnd() * 3; const d2 = rnd() < .5 ? outc[ri(outc.length)] : (rnd() < .5 ? dest : cell[ri(cell.length)]); dest = d2; walkTo(d2[0], d2[1], true); if (a.path.length) last = a.path[a.path.length - 1]; }   // 行き先変更・連打
          AVS.forEach(o => { updateAvatar(o, 1 / 60); shoeSync(o); }); if (step % 10 === 0) { (a.dbgLog = a.dbgLog || []).push([a.wp ? a.wp.map(p => p[0] + ',' + p[1]).join(' ') : 0, +a.x.toFixed(2), +a.y.toFixed(2), +(a.v || 0).toFixed(2), a.path.length, a.wp ? a.wp.map(p => p[0] + ',' + p[1]).join(' ') : 0, +(a.hd || 0).toFixed(2), a.shoe ? 1 : 0, +(a.wait || 0).toFixed(1), a.fail || 0, a.way || 0, a.esc ? 1 : 0, +(a.stk || 0).toFixed(1), [+(a.hd || 0).toFixed(2), [[.05, 0], [0, .05], [-.05, 0], [0, -.05], [.05, .05]].map(([dx, dy]) => standOK(a, blk(), a.x + dx, a.y + dy) ? 1 : 0).join(''), doorBlock(blk(), a.x, a.y) ? 'D' : '-'].join('/') + ' ' + AVS.filter(o => o !== a && Math.hypot(o.x - a.x, o.y - a.y) < 1.2).map(o => [+(o.x - a.x).toFixed(1), +(o.y - a.y).toFixed(1), o.path.length].join('/')).join(';')]); if (a.dbgLog.length > 24) a.dbgLog.shift(); } if (!a.path.length && cmds >= nCmd && ++tail > 20) break;
        }
        res.n++; const dd = Math.hypot(a.x - (last[0] + .5), a.y - (last[1] + .5)), bad = a.path.length > 0 || dd > 1.3 || !!a.shoe;
        if (bad) { res.fail++; res.byCase[name] = (res.byCase[name] || 0) + 1; if (res.fails.length < 8) res.fails.push({ grid: (() => { const o = []; for (let y = Math.floor(a.y) - 2; y <= Math.floor(a.y) + 2; y++) { let r = ''; for (let x = Math.floor(a.x) - 2; x <= Math.floor(a.x) + 2; x++) r += solidAt(b, x, y) ? '#' : '.'; o.push(r); } return o.join('/') + ' @' + (Math.floor(a.x) - 2) + ',' + (Math.floor(a.y) - 2); })(), name, room: [rm.w, rm.d], door: b.door.x0, start: st, dest, last, end: [+a.x.toFixed(2), +a.y.toFixed(2)], left: a.path.length, wp: a.wp && a.wp.slice(0, 3), hd: +(a.hd || 0).toFixed(2), v: +(a.v || 0).toFixed(2), log: a.dbgLog, shoe: a.shoe && a.shoe.k, wait: a.wait, fail: a.fail, stk: +(a.stk || 0).toFixed(2), items: rm0.items.map(i => i.id + '@' + i.x + ',' + i.y + 'r' + (i.rot || 0)), oth: AVS.filter(o => o !== a).map(o => [+o.x.toFixed(1), +o.y.toFixed(1), o.path.length]) }); }
      }
      T.rooms = base; S.cur.room = curr; outHouse(houseBox(T.rooms), entryPoint(T.rooms)); BLK.n = -1; YARD.k = null; return res;
    };
    // out=viewout：自分が庭に出る→ドアが閉まり・引いて外から見た家（ズームが VO_ZOOM へ・roofRise が 1 へ）→入る→もとにもどる（ズーム・屋根）。途中で自分でズームを動かしたら、もどさない
    window.__yardView = () => {
      const tr = [], put = tag => tr.push([tag, +a.x.toFixed(1), +a.y.toFixed(1), +cam.zoom.toFixed(2), +roofRise().toFixed(2), VO.on ? 1 : 0, a.shoesOn ? 1 : 0]);
      const step = (n, tag, ev) => { for (let s = 0; s < n; s++) { updateAvatar(a, 1 / 60); updateAvatarObj(a, 1 / 60); viewerOutTick(1 / 60); updateCamera(1 / 60, false); if (s % 40 === 0) put(tag); } };
      const res = { z0: cam.zoom }; walkTo(6, 13, true); step(420, 'out'); res.out = { zoom: cam.zoom, rise: roofRise(), on: VO.on, shoes: !!a.shoesOn }; walkTo(a.x - .5 | 0, 2, true); step(480, 'in');
      res.back = { zoom: cam.zoom, rise: roofRise(), on: VO.on, shoes: !!a.shoesOn, x: +a.x.toFixed(1), y: +a.y.toFixed(1) };
      walkTo(6, 13, true); step(300, 'out2'); cam.zoom = 1.3; cam.dirty = true; step(60, 'user'); walkTo(4, 2, true); step(480, 'in2'); res.user = { zoom: cam.zoom, on: VO.on };
      res.tr = tr; return res;
    };
    window.__yardObs = () => { const y = outYard(); return y ? y.obs.filter(o => o.k !== 'post').map(o => [o.k, +o.x.toFixed(1), +o.z.toFixed(1), +o.r.toFixed(2), +(o.c == null ? o.r * .5 : o.c).toFixed(2)]) : null; };
    window.__yardRun = goto => {   // goto=x,y（マス）へ歩かせ、最大 40 秒ぶん進めて、着いたか・めり込んだか・止まった時間を返す
      const w = String(goto || '').split(',').map(Number); let found = null; { const c = findPath(room(), avCell(a)[0], avCell(a)[1], w[0], w[1]); found = c ? c.length : null; }
      walkTo(w[0], w[1], true); const b0 = a.path.length; let inside = 0, still = 0, maxStill = 0, steps = 0, shoe = 0, shoeK = ''; const bb = blk();
      for (; steps < 2400 && (a.path.length || steps < 3); steps++) { const px = a.x, py = a.y; updateAvatar(a, 1 / 60); if (a.shoe) { shoe++; shoeK = a.shoe.k; } updateAvatarObj(a, 1 / 60); if (solidAt(bb, Math.floor(a.x), Math.floor(a.y)) && !(a.x >= 0 && a.y >= 0 && a.x < room().w && a.y < room().d)) inside++; if (Math.hypot(a.x - px, a.y - py) < 1e-4) { still++; maxStill = Math.max(maxStill, still); } else still = 0; }
      return { goto: w, pathLen: found, start: b0, end: [+a.x.toFixed(2), +a.y.toFixed(2)], left: a.path.length, secs: +(steps / 60).toFixed(1), inside, shoe: +(shoe / 60).toFixed(2), shoeK, maxStill: +(maxStill / 60).toFixed(2), gy: +a.g.position.y.toFixed(3), dbg: { wp: a.wp && a.wp.slice(0, 3), hd: +(a.hd || 0).toFixed(2), v: +(a.v || 0).toFixed(2), wait: a.wait, esc: !!a.esc, react: a.react, door: bb.door, oth: AVS.filter(o => o !== a).map(o => [+o.x.toFixed(1), +o.y.toFixed(1)]), ST: [+ST.x.toFixed(2), +ST.y.toFixed(2), +ST.front.toFixed(2)] } };
    };
    if (q.get('stop')) setTimeout(() => { const raf = window.requestAnimationFrame.bind(window); let ft = null; window.requestAnimationFrame = cb => raf(t => { if (ft == null) ft = t; cb(ft); }); }, +q.get('stop'));   // 時間を止める（歩いている途中・くつをはく途中を撮る）
    if (q.get('shoeat')) setTimeout(() => { const t0 = +q.get('shoeat'); for (let i = 0; i < 900 && !(a.shoe && a.shoe.t >= t0); i++) { updateAvatar(a, 1 / 60); updateAvatarObj(a, 1 / 60); } const raf = window.requestAnimationFrame.bind(window); let ft = null; window.requestAnimationFrame = cb => raf(t => { if (ft == null) ft = t; cb(ft); }); if (q.get('yaw')) cam.yaw = +q.get('yaw'); if (q.get('zoom2')) { cam.zoom = +q.get('zoom2'); cam.panx = +(q.get('px') || 0); cam.pany = +(q.get('py') || 0); } updateCamera(0, true); cam.dirty = true; if (q.get('focus')) { for (let k = 0; k < 6; k++) { const d0 = blk().door, v = new THREE.Vector3(E.fxG.position.x + d0.x0 + (+q.get('fx') || 0), .1, E.fxG.position.z + room().d - .55).project(E.camera); cam.panx -= v.x / 2; cam.pany += v.y / 2; updateCamera(0, true); E.camera.updateMatrixWorld(true); } }
      if (q.get('clean')) { const st = document.createElement('style'); st.textContent = '#hud,#panel,#rpanel,.dock,#bar,#sidebar,#side,#fab,#viewWrap,#mission,#toast{display:none!important}#stage{inset:0!important;width:100%!important}'; document.head.appendChild(st); }
      document.body.dataset.shoe = a.shoe ? a.shoe.k + ' ' + a.shoe.t.toFixed(2) : 'none'; }, 1100);   // くつのしぐさの途中（shoeat=秒）で止めて撮る
    // vshot=コマ数（&vin=コマ数）：自分を庭へ出し（そのあと入れ）、そのコマ数ぶん進めたところで止める（出る→ドアが閉まる→外から見た家、入る→もどる、の画面確認用）
    if (q.get('vshot')) setTimeout(() => { const stp = n => { for (let i = 0; i < n; i++) { updateAvatar(a, 1 / 60); updateAvatarObj(a, 1 / 60); viewerOutTick(1 / 60); E.camPts = yardPts(); updateCamera(1 / 60, false); } }; walkTo(+(q.get('gx') || 6), +(q.get('gy') || 13), true); stp(+q.get('vshot')); if (q.get('vin')) { walkTo(4, 2, true); stp(+q.get('vin')); } const raf = window.requestAnimationFrame.bind(window); let ft = null; window.requestAnimationFrame = cb => raf(t => { if (ft == null) ft = t; cb(ft); }); cam.dirty = true; }, 1100);
    // out=sweep（いろいろな間取りで庭へ行ける範囲）／out=walk（at から tx,ty へ歩かせて経路を記録。ty は庭の外側も可）の結果を、画面の data-test に出す（テスト用）
    if (q.get('out')) setTimeout(() => { try { document.body.dataset.test = JSON.stringify(q.get('out') === 'obs' ? window.__yardObs() : q.get('out') === 'viewout' ? window.__yardView() : q.get('out') === 'stress' ? window.__yardStress(+q.get('n') || 40, +q.get('seed') || 1, q.get('only') ? q.get('only').split(',') : null, q.get('noth') === '1', q.get('noint') === '1') : q.get('out') === 'sweep' ? window.__yardSweep(q.get('only') ? q.get('only').split(',') : null) : window.__yardRun ? window.__yardRun(q.get('goto')) : 'none'); } catch (e) { document.body.dataset.test = JSON.stringify({ err: String(e && e.stack || e) }); } }, 1200);
    window.__yardSweep = only => {
      const base = JSON.parse(JSON.stringify(T.rooms)), curr = S.cur.room, res = [], r0 = base[0];
      const mk = (x, z, w, d) => { const r = JSON.parse(JSON.stringify(base[0])); r.x = x; r.z = z; r.w = w; r.d = d; r.items = []; return r; };
      const cases = { single: [], right: [[r0.x + r0.w, r0.z, 5, 5]], below: [[r0.x, r0.z + r0.d, 5, 4]], back: [[r0.x, r0.z - 5, 5, 5]], Lshape: [[r0.x + r0.w, r0.z, 4, 4], [r0.x, r0.z + r0.d, 4, 4]], wide: [[r0.x + r0.w, r0.z, 6, 3], [r0.x + r0.w + 6, r0.z, 5, 5]] };
      for (const [name, adds] of Object.entries(cases)) {
        if (only && !only.includes(name)) continue;
        T.rooms = [JSON.parse(JSON.stringify(base[0])), ...adds.map(ad => mk(...ad))];
        outHouse(houseBox(T.rooms), entryPoint(T.rooms));   // 庭だけ置きなおす（部屋の3Dは作りなおさない）
        for (let c = 0; c < T.rooms.length; c++) { S.cur.room = c; BLK.n = -1; res.push(Object.assign({ name, cur: c }, reach(blk()), only && only.length === 1 && c === 0 ? { map: window.__yardMap() } : {})); }
      }
      T.rooms = base; S.cur.room = curr; outHouse(houseBox(T.rooms), entryPoint(T.rooms)); BLK.n = -1; return res;
    };
    // sync=stress（玄関から庭へ出られなかった回数が 0）／sync=viewout（出るとドアが閉まり外から見た家・入るともどる）：すぐ結果を返す（run_browser_tests.sh 用。失敗は err）
    if (q.get('sync') === 'stress') { const r = window.__yardStress(+q.get('n') || 24, +q.get('seed') || 7, null, false, q.get('noint') === '1'); return JSON.stringify(r.fail ? { err: '庭に出られなかった ' + r.fail + '/' + r.n, fails: r.fails.slice(0, 2).map(f => [f.name, f.room, f.door, f.start, f.dest, f.end]) } : { ok: r.n, fail: 0 }); }
    if (q.get('sync') === 'viewout') { const r = window.__yardView(), g = r.out.zoom < .65 && r.out.rise === 1 && r.out.on && r.out.shoes && r.back.zoom > .99 && r.back.rise === 0 && !r.back.on && !r.back.shoes && r.user.zoom === 1.3 && !r.user.on; r.tr = undefined; return JSON.stringify(g ? { ok: 1, out: r.out, back: r.back } : { err: 'viewout', r }); }
    return 'ok';
  }
  // ?test=eye : 自分の目線の確認用（にせのサーバー。通信しない）。at=x,y（立つマス）&face=度（からだの向き）&look=左右,上下（度。首）&fov=度&night=1&noeye=1（入らない）
  //   &snap=1（入る動きをとばす）&walk=x,y（歩く先のマス）&stop=ミリ秒（その時間で画面の更新を止める＝歩いている途中を撮る）&exit=ミリ秒（その時間に目線をやめる）&tx=x,y（その場所をタップ）&near=dx,dy（自分からその分だけ離れた所に別の人を置く）
  if (mode === 'eye') {
    const calls = []; window.fetch = (...a) => { calls.push(String(a[0])); return Promise.reject(new Error('テストでは通信しない')); };
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]);
    const rm = room(); rm.wall = 'wp_cream'; rm.floor = 'fl_whitewash'; rm.items = [];
    const n = N(), P = (id, x, y, r) => rm.items.push(inst(id, x, y, r || 0)), Wl = (id, w, p, z) => rm.items.push(winst(id, w, p, z));
    P('rug6', 2, 2); P('sofa1', 2, 1); P('lowtable', 2, 3); P('plantL', n - 1, 0); P('lamp', 1, 4); P('shelf1', 0, 0);
    Wl('window', 'R', .8, 1.1); Wl('window2', 'R', 3.0, 1.0); Wl('cafewin', 'R', n - 2.2, 1.1); Wl('window2', 'L', 1.2, 1.0); Wl('frame', 'L', 3.4, 1.6);
    if (q.get('night') === '1') rm.dark = true;
    placeAvatars(); rebuildRoom(); sync(); setCamMode('iso'); paintCam(); updateCamera(0, true);
    const a = eyeMe(), at = (q.get('at') || '3,3').split(',').map(Number);
    a.x = at[0] + .5; a.y = at[1] + .5; a.path = []; a.wp = null; a.v = 0; a.res = null; a.hd = null; a.ry = a.tr = +(q.get('face') || 0) * Math.PI / 180; a.idle = 99;
    AVS.forEach(o => { if (o !== a) o.idle = 99; }); holdAvatars();
    if (q.get('near')) { const nr = q.get('near').split(',').map(Number), o = AVS.find(v => v !== a); if (o) { o.x = a.x + nr[0]; o.y = a.y + nr[1]; o.path = []; o.wp = null; o.v = 0; o.res = null; o.hd = null; o.ry = o.tr = Math.atan2(-nr[0], -nr[1]); holdAvatars(); if (q.get('say')) setTimeout(() => sayAvatar(o.id, 'ちょっと長めのひとことを出して、吹き出しの大きさも見るよ'), 800); } }   // near=dx,dy：近くに人を置く（&say=1 で吹き出しも）
    if (q.get('noeye') !== '1') {
      enterEyeMode();
      if (q.get('look')) { const lk = q.get('look').split(',').map(Number); EYE.yaw = EYE.cy = lk[0] * Math.PI / 180; EYE.pitch = EYE.cp = (lk[1] || 0) * Math.PI / 180; }
      if (q.get('fov')) { EYE.fov = EYE.fovT = +q.get('fov'); }
      if (q.get('snap') === '1') { eyeSelf(); updateCamera(0, true); }
    }
    if (q.get('walk')) { const w = q.get('walk').split(',').map(Number); setTimeout(() => walkTo(w[0], w[1], true), 600); }
    if (q.get('tx')) { const w = q.get('tx').split(',').map(Number); setTimeout(() => { const p = project(new THREE.Vector3(E.fxG.position.x + w[0], 0, E.fxG.position.z + w[1])); tap(p[0], p[1], 'touch'); }, 900); }
    if (q.get('exit')) setTimeout(() => exitEyeMode(), +q.get('exit'));
    if (q.get('stop')) setTimeout(() => { const raf = window.requestAnimationFrame.bind(window); let ft = null; window.requestAnimationFrame = cb => raf(t => { if (ft == null) ft = t; cb(ft); }); }, +q.get('stop'));   // 時間を止める（dt=0 のまま描き続ける）
    // ptr=1 : 本物のポインタイベントを流して、首・画角・歩き・編集の禁止を確かめる（結果は data-test に JSON）
    if (q.get('ptr') === '1') (async () => {
      const out = {}, W8 = ms => new Promise(r => setTimeout(r, ms)), pe = (type, id, x, y, o) => cv.dispatchEvent(new PointerEvent(type, Object.assign({ pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: id === 1, button: 0, buttons: 1 }, o || {})));
      let fr = 0; const raf0 = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => raf0(t => { fr++; cb(t); });
      cv.setPointerCapture = () => { }; cv.releasePointerCapture = () => { };   // 作りものの指（番号が本物でない）でも動かすため
      await W8(1500); const r0 = cv.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
      out.start = { mode: cam.mode, yaw: +EYE.cy.toFixed(3), pitch: +EYE.cp.toFixed(3), fov: EYE.fov };
      // 1本指のドラッグ：左へ 200 点 → 右を向く（yaw が減る）。上下は ±35° まで
      pe('pointerdown', 1, cx, cy); for (let i = 1; i <= 10; i++) { pe('pointermove', 1, cx - i * 20, cy + i * 40); await W8(16); }
      out.dragYaw = +(EYE.yaw - +out.start.yaw).toFixed(3); out.dragPitch = +EYE.pitch.toFixed(3); out.pitchLimit = +(35 * Math.PI / 180).toFixed(3);
      pe('pointerup', 1, cx - 200, cy + 400); out.vAfterRelease = [+EYE.vy.toFixed(2), +EYE.vp.toFixed(2)];
      // 慣性（画面の更新はこの試験では進まないので、手で 1/60 秒ずつ進める）：ドラッグして放すと、少し流れて、なめらかに止まる
      { eyeLook(-20, 0); eyeLook(-20, 0); eyeRelease(); const y1 = EYE.yaw, seq = []; for (let i = 0; i < 120; i++) { eyeSelf(); updateCamera(1 / 60, false); seq.push(EYE.cy); }
        const st = seq.map((v, i) => Math.abs(v - (i ? seq[i - 1] : y1))), mx = Math.max(...st); out.inertia = +(EYE.yaw - y1).toFixed(3); out.inertiaMaxStep = +mx.toFixed(4); out.inertiaEndStep = +st[119].toFixed(5); out.vEnd = [EYE.vy, EYE.vp]; } await W8(2500); out.settled = EYE.vy === 0 && EYE.vp === 0;
      // 2本指：ひろげる → 画角が小さく（ズーム）、つめる → 大きく
      const f0 = EYE.fovT; pe('pointerdown', 1, cx - 40, cy); pe('pointerdown', 2, cx + 40, cy, { isPrimary: false }); for (let i = 1; i <= 8; i++) { pe('pointermove', 1, cx - 40 - i * 15, cy); pe('pointermove', 2, cx + 40 + i * 15, cy, { isPrimary: false }); await W8(16); }
      out.pinchOut = [+f0.toFixed(1), +EYE.fovT.toFixed(1)]; const f1 = EYE.fovT;
      for (let i = 1; i <= 8; i++) { pe('pointermove', 1, cx - 160 + i * 20, cy); pe('pointermove', 2, cx + 160 - i * 20, cy, { isPrimary: false }); await W8(16); }
      out.pinchIn = [+f1.toFixed(1), +EYE.fovT.toFixed(1)]; pe('pointerup', 1, cx, cy); pe('pointerup', 2, cx, cy, { isPrimary: false });
      out.panUnchanged = cam.panx === 0 && cam.pany === 0;
      cv.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true })); out.wheel = +EYE.fovT.toFixed(1);
      // 床をタップ → 歩く（首をいっぱい下へ向けてから、足もとのマスを）。家具をタップしても選択されない
      EYE.yaw = 0; EYE.pitch = -.45; for (let i = 0; i < 60; i++) { eyeSelf(); updateCamera(1 / 60, false); } await W8(300);
      const a = eyeMe(), xy = window.__floorXY(a.x + .5, a.y + 3.5); out.tapXY = xy.map(Math.round);
      pe('pointerdown', 1, xy[0], xy[1]); pe('pointerup', 1, xy[0], xy[1]); await W8(300); out.walking = a.path.length > 0 || a.moving;
      const sf = window.__floorXY(2.5, 1.5); a.path = []; a.moving = false; pe('pointerdown', 1, sf[0], sf[1]); pe('pointerup', 1, sf[0], sf[1]); await W8(100); out.selAfterFurnitureTap = selUid || null;
      // 編集：置く・まとめて選ぶ・移動は目線のあいだは動かない
      startPlace('chair', 'inv'); out.ghostBlocked = !ghost; enterMulti(); out.multiBlocked = !multi; out.multiBtnShown = getComputedStyle($('btnMulti')).display !== 'none'; out.exitShown = !$('eyeExit').hidden;
      // 目線の最中に床のマスが変わらないか・やめる
      exitEyeMode(); await W8(1200); out.afterExit = { mode: cam.mode, vis: a.g.layers.test(E.camera.layers), tr: !!EYE.tr, exitHidden: $('eyeExit').hidden, multiBtnShown: getComputedStyle($('btnMulti')).display !== 'none' };
      document.body.dataset.test = JSON.stringify(out);
    })();
    window.__floorXY = (x, z) => { const p = project(new THREE.Vector3(E.fxG.position.x + x, 0, E.fxG.position.z + z)), r = cv.getBoundingClientRect(); return [p[0] + r.left, p[1] + r.top]; };   // マス（小数可）の床の点の、画面上の位置
    if (q.get('adv')) setTimeout(() => { for (let i = 0, n = Math.round(+q.get('adv') * 60); i < n; i++) { eyeSelf(); updateCamera(1 / 60, false); } cam.dirty = true; }, +(q.get('advAt') || 1500));   // adv=秒：カメラだけ手で進める（画面が遅い環境でも、入る・出る動きの途中や終わりを撮れる）
    if (q.get('dbg')) setTimeout(() => console.log('EYEDBG ' + JSON.stringify(window.__eyeTest())), +q.get('dbg'));
    window.__eyeTest = () => ({ cpos: E.camera.position.toArray().map(v => +v.toFixed(2)), near: +E.camera.near.toFixed(3), far: +E.camera.far.toFixed(1), proj: E.camera.projectionMatrix.elements.slice(0, 12).map(v => +v.toFixed(3)), mode: cam.mode, vis: a.g.layers.test(E.camera.layers), calls: calls.length, pos: [EYE.pos.x, EYE.pos.y, EYE.pos.z].map(v => +v.toFixed(2)), yaw: +EYE.cy.toFixed(2), pitch: +EYE.cp.toFixed(2), fov: +EYE.fov.toFixed(1), tr: EYE.tr ? [EYE.tr.dir, +EYE.tr.t.toFixed(2)] : null, ax: +a.x.toFixed(2), ay: +a.y.toFixed(2), eyeY: a.g.userData.h });
    return 'ok';
  }
  // ?test=skywin&cam=iso|wallL|wallR&night=1&yaw=0.3 : 窓（3種類）の外の景色の確認用（昼・夜・見る角度）
  if (mode === 'skywin') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]);
    const rm = room(); rm.wall = 'wp_cream'; rm.floor = 'fl_whitewash'; rm.items = [];
    const n = N(), P = (id, x, y, r) => rm.items.push(inst(id, x, y, r || 0)), Wl = (id, w, p, z) => rm.items.push(winst(id, w, p, z));
    P('rug6', 2, 2); P('sofa1', 2, 1); P('lowtable', 2, 3); P('plantL', n - 1, 0);
    Wl('window', 'R', .8, 1.1); Wl('window2', 'R', 3.0, 1.0); Wl('cafewin', 'R', n - 2.2, 1.1); Wl('window2', 'L', 1.2, 1.0); Wl('cafewin', 'L', 4.0, 1.1);
    if (q.get('night') === '1') rm.dark = true;
    placeAvatars(); rebuildRoom(); sync(); setCamMode(q.get('cam') || 'iso'); cam.yaw = +(q.get('yaw') || 0); cam.zoom = +(q.get('zoom') || 1); cam.panx = +(q.get('px') || 0); cam.pany = +(q.get('py') || 0); paintCam(); updateCamera(0, true);
    if (q.get('toggle') === '1') setTimeout(() => toggleLight(), 4000);
    return 'ok';
  }
  // ?test=natural&cam=iso&night=1 : ナチュラルなキッチン＋リビングの部屋（夕方）。新家具を並べる確認用（無いIDは飛ばす）
  if (mode === 'natural') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]);
    const rm = room(), has = id => !!ITEM[id]; rm.items = [];
    rm.wall = q.get('wall') || (has('wp_paintboard') ? 'wp_paintboard' : 'wp_boardw'); rm.floor = q.get('floor') || (has('fl_herrorange') ? 'fl_herrorange' : 'fl_herrlight');
    const n = N(), P = (id, x, y, r) => { if (has(id)) rm.items.push(inst(id, x, y, r || 0)); }, Wl = (id, w, p, z) => { if (has(id)) rm.items.push(winst(id, w, p, z)); };
    // キッチン（右の壁ぞい）
    P('fridge2', 0, 0); P('sinkunit', 2, 0); P('gasrange', 4, 0); P('wagon', 6, 0);
    P('basket', 1, 0); P('bread', 0, 0); P('dishrack', 2, 0); P('pitcher', 3, 0); P('kettle', 4, 0); P('pot', 5, 0); P('toaster', 6, 0);
    Wl('wallcab', 'R', 2, 1.9); Wl('cafewin', 'R', 6.4, 1.1); Wl('towelbar', 'R', 4.3, 1.5); Wl('hathook', 'R', 5.4, 1.9); Wl('switch', 'R', 7.6, 1.2);
    // リビング・ダイニング
    P('rug6', 3, 3); P('birchtable', 3, 4); P('ladderchair', 3, 5, 2); P('rattanchair', 4, 5, 2); P('ladderchair', 5, 4, 1);
    P('candleglass', 3, 4); P('teapot', 4, 4); P('chocake', 5, 4);
    P(has('linensofa') ? 'linensofa' : 'sofa1', 0, 3, 1); P('sidetable', 0, 5); P('radio', 0, 5); P('woodstove', 0, 6); P('donabe', 0, 6);
    P('ladderrack', 0, 1); P('anthurium', 0, 1); P('lowtable', 1, 6); P('candle', 1, 6); P('mossball', 2, 6); P('plantL', n - 1, 2);
    P('tinbin', n - 1, 0); P('fullmirror', n - 1, 4, 3); P('slippers', 2, 2); P('macrame', 5, 2); P('blanket', 1, 7); P('lantern', 4, 6);
    Wl('cafewin', 'L', 4.2, 1.1); Wl('wreath', 'L', 2.4, 1.6); Wl('dryflower', 'L', 1.0, 1.5);
    rm.dark = q.get('night') === '1';
    placeAvatars(); rebuildRoom(); sync(); setCamMode(q.get('cam') || 'iso'); paintCam(); updateCamera(0, true);
    return JSON.stringify({ n: rm.items.length });
  }
  // ?test=catalog&set=0..4 : 第4弾の新アイテムを床に並べて近くで見る（モデルの出来の確認用）
  if (mode === 'catalog') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]);
    // &ids=a,b,c で並べる品を指定できる（新しい家具の見た目の確認用）
    const rm = room(), a = ITEMS.findIndex(d => d.id === 'fridge2'), b = ITEMS.findIndex(d => d.id === 'menuboard'), set = +(q.get('set') || 0);
    const all = q.get('ids') ? q.get('ids').split(',').map(id => ITEM[id]).filter(Boolean) : ITEMS.slice(a, b + 1);
    rm.items = []; rm.wall = 'wp_paintboard'; rm.floor = 'fl_herrorange'; sq(rm, T.size0 || CFG.MIN_SIZE); const n = N();
    const fl = all.filter(d => !d.wall).slice(set * 12, set * 12 + 12), wl = all.filter(d => d.wall);
    let x = 0, y = 1.4, rowH = 0;
    fl.forEach(d => { const w = d.w, dd = d.d; if (x + w > n) { x = 0; y += rowH + .3; rowH = 0; } rm.items.push(inst(d.id, x, Math.round(y), 0)); x += w + .3; rowH = Math.max(rowH, dd); });
    if (set === 0) wl.forEach((d, i) => rm.items.push(winst(d.id, i < 3 ? 'R' : 'L', 1 + (i % 3) * 2.2, d.zb)));
    // &w=id:壁:位置:高さ,... で壁かけを好きな所に（ドアに掛けた見た目の確認用）。out.wok に置けるかどうか（wallCheck）
    const wok = []; (q.get('w') || '').split(',').filter(Boolean).forEach(s => { const [id, wall, pos, z] = s.split(':'); if (!ITEM[id]) return; wok.push(id + ':' + (wallCheck(rm, ITEM[id], wall, +pos, +z).why || 'ok')); rm.items.push(winst(id, wall, +pos, +z)); });
    placeAvatars(); rebuildRoom(); sync(); setCamMode(q.get('cam') || 'iso'); paintCam(); updateCamera(0, true);
    if (q.get('zoom')) { cam.zoom = +q.get('zoom'); cam.panx = +(q.get('px') || 0); cam.pany = +(q.get('py') || 0); updateCamera(0, true); }
    return JSON.stringify({ n: n, shown: fl.map(d => d.id).join(','), wok });
  }
  // ?test=models : 床・壁以外の全アイテムを作って、自前モデルがなく「ただの箱」になったものを数える
  if (mode === 'models') {
    const bad = []; ITEMS.filter(d => !d.pat).forEach(d => { try { buildItem(d); } catch (e) { bad.push(d.id + ':' + e.message); } });
    return JSON.stringify({ total: ITEMS.filter(d => !d.pat).length, fallback: [...fallbackIds], errors: bad });
  }
  if (mode === 'opening') { makeDemo(); renderSelect(); return 'ok'; }
  // ?test=teamlock : チーミを選ぶと、あいことばを聞かれる。ちがう番号では入れず、正しい番号でメンバー選択へ
  if (mode === 'teamlock') {
    makeDemo(); renderSelect(); const t = S.teams[0], wrong = t.code === '1111' ? '2222' : '1111';
    const key = k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    const out = {}; document.querySelector('#select .tcard').click();
    setTimeout(() => {
      out.askShown = !$('modal').hidden && !!document.querySelector('.pin-keys'); out.membersBefore = !!document.querySelector('.mem-grid');
      [...wrong].forEach(key);
      setTimeout(() => {
        out.stillAsking = !$('modal').hidden; out.membersAfterWrong = !!document.querySelector('.mem-grid');
        [...t.code].forEach(key);
        setTimeout(() => { out.membersAfterRight = !!document.querySelector('.mem-grid'); out.staffStar = nickOf({ nick: 'せんせい', staff: true }); document.body.dataset.test = JSON.stringify(out); }, 400);
      }, 400);
    }, 300);
    return 'wait';
  }
  // ?test=wear : 家の中から me-をかえる → きせかえタブ（ショップつき）。1つ試着中
  if (mode === 'wear') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]); me.picos = 50000; me.wear = ['top3', 'hat1'];
    me.me = Object.assign({}, me.me || {}, { top: 3, hat: 1, hood: 1, hair: 8 }); editMe('wear');
    // ?test=wear&wt=くつした&pick=ルーズ : 開くタブと試着する物（画面確認用）
    const wt = q.get('wt') || 'ぼうし', pk = q.get('pick') || (q.get('wt') ? '' : 'ねこみみ');
    { const ht = [...document.querySelectorAll('#mk .mk-tab')].find(b => b.textContent === wt); if (ht) ht.click(); }   // きせかえは種類ごとのタブ
    const t = pk && [...document.querySelectorAll('#mk .mk-tile.wear')].find(b => b.textContent.includes(pk)); if (t) t.click();
    return JSON.stringify({ tiles: document.querySelectorAll('#mk .mk-tile.wear').length, buyBar: !!document.querySelector('#mk .mk-buy button') });
  }
  // ?test=petshop : 家のショップの「ペット」。ねこを持っていて連れている（リボンも持っている。&petw=番号 で つけている物。&pet=番号 で連れているペット）（&open=番号 で、そのペットを試着した きせかえ を開く）
  if (mode === 'petshop') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]); me.picos = +(q.get('picos') || 1500); me.wear = ['pet2', 'petw2'];
    me.me = Object.assign({}, me.me || {}, { pet: +(q.get('pet') || 2), petw: +(q.get('petw') || 0), hood: 1, hair: 8 }); tab = 'shop'; shopCat = 'pet'; renderPanel();
    if (q.get('sb')) setTimeout(() => { $('tabBody').scrollTop = 1e5; }, 1500);   // &sb=1：下（ペットのおしゃれ）までスクロール
    if (q.get('open')) editMe('wear', { key: 'pet', i: +q.get('open') });
    return JSON.stringify({ tiles: document.querySelectorAll('#tabBody .tile').length, mk: !!document.getElementById('mk'), tab: (document.querySelector('#mk .mk-tab.on') || {}).textContent || '', buyBar: !!document.querySelector('#mk .mk-buy button') });
  }
  // ?test=pet : きせかえの「ペット」タブ。ねこを持っていて、いぬを試着中（&pet=番号 で試着するペットを変える）
  if (mode === 'pet') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]); me.picos = 50000; me.wear = ['pet2'];
    me.me = Object.assign({}, me.me || {}, { pet: 2, hood: 1, hair: 8 }); editMe('wear');
    { const pt = [...document.querySelectorAll('#mk .mk-tab')].find(b => b.textContent === 'ペット'); if (pt) pt.click(); }
    const name = (WEAR.pet[+(q.get('pet') || 1)] || WEAR.pet[1])[0], t = [...document.querySelectorAll('#mk .mk-tile.wear')].find(b => b.textContent.startsWith(name)); if (t) t.click();
    return JSON.stringify({ tiles: document.querySelectorAll('#mk .mk-tile.wear').length, buyBar: !!document.querySelector('#mk .mk-buy button') });
  }
  // ?test=looks : 新しい見た目・きせかえを着た人たちが並ぶ部屋（スクショ確認用）
  if (mode === 'looks') {
    makeDemo(); const t0 = S.teams[0]; t0.members = S.students.map(s => s.uid).slice(0, 12); enterAs(t0.id, t0.members[0]);
    const L = [[8, 3, 1, 0, 5], [9, 2, 3, 3, 4], [10, 4, 4, 5, 0], [11, 5, 2, 2, 3], [12, 1, 6, 1, 2], [13, 6, 5, 6, 5], [0, 0, 7, 7, 1], [3, 1, 2, 4, 0], [4, 2, 1, 0, 3], [6, 3, 5, 2, 4], [8, 4, 3, 1, 2], [9, 5, 0, 6, 0]];
    t0.members.forEach((u, i) => { const st = studentById(u), [hair, top, hat, eye, bag] = L[i]; st.me = Object.assign(randomMe(), { hair, top, hat, eye, bag, acc: i % 6, hood: i % 8, eyeC: i % 7, cheek: i % 5, skin: i % 10, hairC: (i * 3) % 14, mouth: i % 8, brow: i % 6, pet: i % 8 }); });
    studentById(t0.members[1]).staff = true;   // 担任助手（★）の名札の確認用
    const rm = room(); rm.items = []; rebuildAvatars(); rebuildRoom(); sync();
    const n = N(); AVS.forEach((a, i) => { a.x = 1.5 + (i % 4) * 1.6; a.y = 1.5 + Math.floor(i / 4) * 1.8; a.dir = 1; a.ry = a.tr = 0; a.path = []; a.idle = 99; }); holdAvatars();
    cam.zoom = +(q.get('zoom') || 1.25); cam.panx = +(q.get('px') || 0); cam.pany = +(q.get('py') || 0); if (q.get('nohat')) S.teams[0].members.forEach(u => { studentById(u).me.hat = 0; }), rebuildAvatars(), AVS.forEach((a, i) => { a.x = 1.5 + (i % 4) * 1.6; a.y = 1.5 + Math.floor(i / 4) * 1.8; a.ry = a.tr = 0; a.path = []; a.idle = 99; }); cam.dirty = true; return 'ok';
  }
  // ?test=rot4 : 家具が4方向に回る（幅2×奥行1のソファ）
  if (mode === 'rot4') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]); const rm = room(); rm.items = [inst('sofa1', 2, 2)]; sync(); const s = rm.items[0]; setSel(s.uid);
    const seen = []; for (let k = 0; k < 4; k++) { actRot(); const r = rectOf(s); seen.push(s.rot + ':' + (r.x1 - r.x0) + 'x' + (r.y1 - r.y0)); sync(); seen.push('ry=' + Math.round(objs.get(s.uid).rotation.y * 180 / Math.PI)); }
    return JSON.stringify(seen);
  }
  // ?test=hold : 自分のme-は勝手に向きを変えない／視点を変えた直後はほかの人も止まる
  if (mode === 'hold') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]); const mine = AVS.find(a => a.id === me.uid), others = AVS.filter(a => a !== mine);
    const d0 = mine.dir, x0 = mine.x; let mineChanged = 0; for (let s = 0; s < 1200; s++) { AVS.forEach(a => updateAvatar(a, 1 / 60)); if (mine.dir !== d0 || mine.x !== x0) mineChanged++; }
    holdAvatars(); const od = others.map(a => a.dir + ',' + a.x + ',' + a.y); others.forEach(a => { a.path = []; a.idle = 0; a.res = null; }); for (let s = 0; s < 120; s++) others.forEach(a => updateAvatar(a, 1 / 60));
    const othersMoved = others.filter((a, i) => (a.dir + ',' + a.x + ',' + a.y) !== od[i]).length;
    return JSON.stringify({ mineChanged, othersMovedDuringHold: othersMoved });
  }
  // ?test=avoid : 20人を狭い部屋で10秒ぶん歩かせ、同じマスに2人いる瞬間がないか数える
  if (mode === 'avoid') {
    makeDemo(); const t0 = S.teams[0]; t0.members = S.students.map(s => s.uid).slice(0, 14); enterAs(t0.id, t0.members[0]);
    const rm = room(); rm.items = rm.items.filter(i => !isBig(i)); placeAvatars();
    // 重なり＝2人の中心が体の幅の和（SEP）より近い瞬間（円どうしが食い込む）。同じマスにいるのは、すれ違うときにあってよい
    const minD = () => { let m = 9; for (let i = 0; i < AVS.length; i++) for (let j = i + 1; j < AVS.length; j++) m = Math.min(m, Math.hypot(AVS[i].x - AVS[j].x, AVS[i].y - AVS[j].y)); return m; };
    let overlap = 0, steps = 0, moved = 0, worst = 9, ms = 0; const start = AVS.map(a => [a.x, a.y]);
    for (let s = 0; s < 600; s++) {
      if (s % 40 === 0) AVS.forEach(a => { if (!a.path.length) a.idle = 0; });
      const t0 = performance.now(); AVS.forEach(a => updateAvatar(a, 1 / 60)); ms += performance.now() - t0;
      const m = minD(); worst = Math.min(worst, m); if (m < SEP - .02) overlap++; steps++;
    }
    AVS.forEach((a, i) => { if (Math.hypot(a.x - start[i][0], a.y - start[i][1]) > .5) moved++; });
    const out = { avatars: AVS.length, steps, overlap, moved, minDist: +worst.toFixed(3), msPerFrame: +(ms / steps).toFixed(3) };
    // 狭い通路（幅2マス）で、真正面から向かい合った2人がすれ違える／立っている2人の間（体の幅の和より広い）を通れる／重ならない
    const t1 = S.teams[0]; AVS.slice(3).forEach(a => E.fxG.remove(a.g)); AVS = AVS.slice(0, 3);
    const P = AVS[0], Q = AVS[1], W = rm.w, place = (a, x, y) => { a.x = x; a.y = y; a.path = []; a.wp = null; a.v = 0; a.res = null; a.hd = null; a.wait = 0; a.react = 0; a.idle = 99; };
    const go = (a, cx, cy) => { const [sx, sy] = avCell(a), p = findPath(rm, sx, sy, cx, cy); if (p && p.length) setRoute(a, p); };
    const sim = (secs, until) => { let mn = 9, t = 0; for (; t < secs * 60; t++) { AVS.forEach(a => updateAvatar(a, 1 / 60)); mn = Math.min(mn, minD()); if (until()) break; } return { mn: +mn.toFixed(3), t: +(t / 60).toFixed(2) }; };
    rm.items = []; for (let x = 0; x < W; x++) { rm.items.push(inst('shelf1', x, 1, 0)); rm.items.push(inst('shelf1', x, 4, 0)); } BLK.n = -1;
    place(P, .5, 2.5); place(Q, W - .5, 2.5); go(P, W - 1, 2); go(Q, 0, 2);
    const c = sim(12, () => !P.path.length && !Q.path.length);
    out.corridorSwap = P.x > W - 1.2 && Q.x < 1.2; out.corridorMin = c.mn; out.corridorSec = c.t;
    // 立っている2人（中心が 1.1 はなれている＝間は体の幅の和 .8 より広い）の真ん中を、まっすぐ通る
    rm.items = []; BLK.n = -1; const Z = AVS[2];
    place(P, .5, 2.55); place(Q, 3.5, 2.0); place(Z, 3.5, 3.1); go(P, W - 1, 2);
    let maxDev = 0; const g = sim(10, () => { maxDev = Math.max(maxDev, Math.abs(P.y - 2.55)); return !P.path.length; });
    out.gapPass = P.x > W - 1.2 && Q.y === 2.0 && Z.y === 3.1; out.gapMin = g.mn; out.gapDetour = +maxDev.toFixed(2); out.gapSec = g.t;
    // 間が狭すぎる（中心 .6）ときは、通り抜けず、重ならずに止まるか遠回り
    place(P, .5, 2.55); place(Q, 3.5, 2.25); place(Z, 3.5, 2.85); go(P, W - 1, 2);
    const n = sim(14, () => !P.path.length); out.narrowMin = n.mn; out.narrowDetourDone = !P.path.length && P.x > W - 1.2;   // 通れない間は、少しさがって遠回りして着く
    // 道をふさぐ立っている人（通路いっぱい）：重ならない。幅2マスの通路の真ん中に2人が並んで立つと、通れない→遠回りできなければ止まる
    for (let x = 0; x < W; x++) { rm.items.push(inst('shelf1', x, 1, 0)); rm.items.push(inst('shelf1', x, 4, 0)); } BLK.n = -1;
    place(P, .5, 2.5); place(Q, 3.5, 2.3); place(Z, 3.5, 3.0); go(P, W - 1, 2);
    const b = sim(12, () => !P.path.length); out.blockMin = b.mn;
    return JSON.stringify(out);
  }
  // ?test=megrid&k=top|hat|acc|bag|hair&v=bF,bS,bB : 見た目を大きく並べる（服の部品が浮いていないか・髪型の確認用）
  if (mode === 'megrid') {
    const q = new URLSearchParams(location.search), k = q.get('k') || 'top', views = (q.get('v') || (k === 'hair' ? 'hF,h3,hS,hB' : 'bF,bS,bB')).split(','), base = Object.assign(cleanMe({}), JSON.parse(q.get('base') || '{}'));
    const n = ME_COUNT[k] || 7, only = q.get('i');
    document.body.innerHTML = ''; document.body.style.cssText = 'background:#efe6d6;margin:0;font:14px sans-serif;overflow:auto';
    const box = h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;padding:6px' }); document.body.appendChild(box);
    for (let i = 0; i < n; i++) { if (only != null && !only.split(',').includes(String(i))) continue; const m = Object.assign({}, base, { [k]: i }); const cell = h('div', { style: 'background:#fffaf0;border-radius:8px;padding:4px' }, [h('div', { text: k + i })]); views.forEach(v => { const im = new Image(); im.src = meThumb(m, v); cell.appendChild(im); }); box.appendChild(cell); }
    return 'ok';
  }
  // ?test=mission&all=1 : 週間ミッション（端末だけ）。all=1 で全員達成→受け取り。shot=1 は画面確認用（パネルのミッションタブを開いたまま）
  if (mode === 'mission') {
    makeDemo(); const t0 = S.teams[0], m = S.missions[0], td = todayStr(), out = {};
    if (q.get('now') !== '0') { m.start = td; m.end = td; }
    if (q.get('all') === '1') t0.members.forEach(u => { m.counts[u] = 4; });
    enterAs(t0.id, t0.members[0]); missionDlg();
    out.tabShown = !!$('dlg').querySelector('.ms-card'); out.chips = $('dlg').querySelectorAll('.ms-chip').length; out.mine = ($('dlg').querySelector('.ms-mine') || {}).textContent; out.card = $('btnMission').textContent; out.stat = missionStat(m, T); out.btn = !$('btnMission').hidden; out.canClaim = canClaim(m);
    if (q.get('shot') === '1') return JSON.stringify(out);
    const p0 = me.picos; const inv0 = me.inv.trophy | 0;
    claimMission(m, () => { }); out.picos = me.picos - p0; out.trophy = (me.inv.trophy | 0) - inv0; out.again = canClaim(m);
    const st = studentById(t0.members[1]); st.staff = false; out.otherCan = (() => { const m0 = me; me = st; const r = canClaim(m); me = m0; return r; })();
    S.missions[0].counts[t0.members[2]] = 1; out.afterDrop = missionStat(m, T).achieved;
    return JSON.stringify(out);
  }
  // ?test=info : 最初に「大事なお知らせ」（日数・掲示板）→「ゲームを始める」でチーミ選択。ほかのチーミの家のサムネは出さない
  if (mode === 'info') {
    makeDemo(); setInfoSeen(false); if (q.get('start')) S.startDate = q.get('start'); renderSelect(); const out = {};
    out.infoShown = !!document.querySelector('.info-page'); out.day = (document.querySelector('.day-card') || {}).textContent; out.notices = document.querySelectorAll('.nt-item').length; out.teamsHidden = !document.querySelector('.tcard:not(.ghost)');
    if (q.get('shot') === '1') return JSON.stringify(out);
    document.querySelector('.info-go').click(); out.teamsAfter = document.querySelectorAll('.tcard:not(.ghost)').length; out.strip = (document.querySelector('.info-strip') || {}).textContent; out.houseImgs = document.querySelectorAll('.tc-thumb img').length;
    return JSON.stringify(out);
  }
  // ?test=startgame : ホームの「ゲームを始める」。端末が自分の me- を覚えていれば、そのまま家に入る／覚えていなければチーミ選択（shot=1 は覚えている状態のホームを表示）
  if (mode === 'startgame') {
    makeDemo(); window.__noPin = true; const out = {}, u = S.teams[0].members[0]; if (!studentById(u).me) studentById(u).me = randomMe();
    setMyUid(null); setInfoSeen(false); renderSelect(); out.label0 = (document.querySelector('.info-go') || {}).textContent; out.other0 = !!document.querySelector('.info-other');
    document.querySelector('.info-go').click(); out.select0 = !$('select').hidden && !$('app').classList.contains('in-house') && document.querySelectorAll('.tcard:not(.ghost)').length > 0;
    setMyUid(u); setInfoSeen(false); renderSelect(); out.label1 = (document.querySelector('.info-go') || {}).textContent; out.other1 = !!document.querySelector('.info-other');
    if (q.get('shot') === '1') return JSON.stringify(out);
    document.querySelector('.info-go').click();
    setTimeout(() => { out.inHouse = $('select').hidden && $('app').classList.contains('in-house'); out.me = !!me && me.uid === u;
      leaveTeam(); out.leaveHome = !$('select').hidden && !!document.querySelector('.info-go') && !document.querySelector('.mem-grid');   // 家の「‹」は、メンバー選択ではなくホームへ
      enterAs(S.teams[0].id, u); leaveTeam(true); out.leaveMembers = !document.querySelector('.info-go') && !!document.querySelector('.mem-grid');   // 「ほかの人に切り替える」だけは、メンバー選択へ
      setMyUid(null); document.body.dataset.test = JSON.stringify(out); }, 600); return 'wait';
  }
  // ?test=addone : 名簿タブの「1人ずつ足す」表（架空データ）。チーミ0個から新チーミを作りつつ追加／既存チーミへ／チーミなし／番号重複で止まる／表への貼り付け展開（shot=1 は貼り付け後の画面を残す）
  if (mode === 'addone') {
    S.students = []; S.teams = []; renderSelect(); adminPreset({ tab: 'roster' }); openAdmin();
    const log = [], put = (r, c, v) => { const el = document.querySelector('.ag-in[data-r="' + r + '"][data-c="' + c + '"]'); el.value = v; el.dispatchEvent(new Event('input')); };
    const paste = (r, c, txt) => { const el = document.querySelector('.ag-in[data-r="' + r + '"][data-c="' + c + '"]'); const ev = new Event('paste', { bubbles: true, cancelable: true }); ev.clipboardData = { getData: () => txt }; el.dispatchEvent(ev); return ev.defaultPrevented; };
    const go = () => { const b = [...document.querySelectorAll('.addgrid .acts-row .btn')].find(x => /名簿に追加する/.test(x.textContent)); const was = b.disabled; if (!was) b.click(); return !was; };
    const rows = () => document.querySelectorAll('.ag-in[data-c="0"]').length;
    // 1) チーミ0個から、新しいチーミを作りつつ1人
    put(0, 0, 'T001'); put(0, 1, 'テスト 一郎'); put(0, 4, 'テストチーミA'); log.push('1:' + go() + ' stu=' + S.students.length + ' teams=' + S.teams.length + ' mem=' + (S.teams[0] ? S.teams[0].members.length : -1) + ' conf=' + (S.teams[0] && S.teams[0].confirmed));
    // 2) 既存チーミへ ＋ チーミなし
    put(0, 0, 'T002'); put(0, 1, 'テスト 二郎'); put(0, 4, 'テストチーミA'); put(1, 0, 'T003'); put(1, 1, 'テスト 三郎'); log.push('2:' + go() + ' stu=' + S.students.length + ' teams=' + S.teams.length + ' A=' + S.teams[0].members.length);
    // 3) 番号重複（名簿・表の中）で止まる
    put(0, 0, 'T002'); put(0, 1, 'だれか'); const d1 = go(); put(0, 0, 'T004'); put(1, 0, 'T004'); put(1, 1, 'だれか2'); const d2 = go(); log.push('3:dupRoster=' + !d1 + ' dupTable=' + !d2 + ' bad=' + document.querySelectorAll('.ag-tbl tr.bad').length + ' stu=' + S.students.length);
    // 4) 表への貼り付け：2行×5列を最終行(index2)の氏名セルに貼る → 行が増えて右へはみ出す列は捨てる
    renderSelect(); adminPreset({ tab: 'roster', addRows: [] }); openAdmin();
    const n0 = rows(), pv = paste(2, 1,'貼付 一\tヒト イチ\t高1\tテストチーミA\tX\n貼付 二\tヒト ニ\t高2\t新チーミB\tY\n'); const n1 = rows(), A_ = [...document.querySelectorAll('.ag-in')].map(e => e.value).join('|');
    log.push('4:prevented=' + pv + ' rows ' + n0 + '->' + n1 + ' ' + A_);
    // 1セルだけなら普通の貼り付け（横取りしない）
    log.push('5:single=' + !paste(0, 0, 'abc'));
    // 6) 表の枠（セルではない所）を選んでの貼り付け：見出しあり → 列を見出しで決めて、空いている行から追加
    const wrapPaste = txt => { const el = document.querySelector('.ag-wrap'); const ev = new Event('paste', { bubbles: true, cancelable: true }); ev.clipboardData = { getData: () => txt }; el.dispatchEvent(ev); return ev.defaultPrevented; };
    const val = (r, c) => document.querySelector('.ag-in[data-r="' + r + '"][data-c="' + c + '"]').value;
    renderSelect(); adminPreset({ tab: 'roster', addRows: [], lastPaste: null }); openAdmin();
    const w1 = wrapPaste('氏名\t生徒番号\t学年\n甲 一\t5001\t高1\n乙 二\t5002\t高2\n');
    log.push('6:hdr=' + w1 + ' ' + [val(0, 0), val(0, 1), val(0, 3), val(1, 0), val(1, 1), val(1, 3)].join('|') + ' note=' + (document.querySelector('.ag-note-t') || {}).textContent + ' focus=' + document.activeElement.classList.contains('ag-wrap'));
    // 7) 見出しなし・列の順番がばらばら：中身から推定（チーミ名は既存と一致、番号は数字、かな、学年、漢字の氏名）
    const tA = S.teams[0].name;
    const w2 = wrapPaste(tA + '\t高3\t6001\t丙 三\tヘイ サン\n' + tA + '\t高1\t6002\t丁 四\tテイ シ\n');
    log.push('7:nohdr=' + w2 + ' rows=' + rows() + ' ' + [val(2, 0), val(2, 1), val(2, 2), val(2, 3), val(2, 4), val(3, 0), val(3, 1)].join('|'));
    // 8) 検査が効く（重複する番号は赤）・列の入れかえ（1列目を「使わない」にすると、その列が空になる）
    const sel0 = document.querySelector('.ag-map'); sel0.value = ''; sel0.dispatchEvent(new Event('change'));
    log.push('8:remap team=' + JSON.stringify(val(2, 4)) + ' id=' + val(2, 0) + ' bad=' + document.querySelectorAll('.ag-tbl tr.bad').length);
    // 9) 1セルだけの貼り付けは横取りしない
    log.push('9:single=' + !wrapPaste('abc'));
    return log.join(' / ');
  }
  // ?test=secret : ホームの「校舎のお知らせ」の隠し入口。長押し→3秒以内に5回タップで openAdmin が呼ばれる／長押しなしの5回・3秒超過・staffOk=false・指を動かした長押しでは呼ばれない（通信はしない）
  if (mode === 'secret') {
    const rf = window.fetch; window.fetch = () => Promise.reject(new Error('テストでは通信しない'));
    (async () => {
      const out = {}, wait = ms => new Promise(r => setTimeout(r, ms)); let calls = 0; const ok0 = screenCtx.staffOk, op0 = screenCtx.openAdmin;
      screenCtx.openAdmin = () => { calls++; };
      const fresh = () => { makeDemo(); setInfoSeen(false); renderSelect(); calls = 0; return document.querySelector('.home .board'); };
      const pe = (el, type, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0, clientX: x || 5, clientY: y || 5 }));
      const tap = async (el, n) => { for (let i = 0; i < n; i++) { pe(el, 'pointerdown'); await wait(40); pe(el, 'pointerup'); await wait(40); } };
      const long = async (el, ms, move) => { pe(el, 'pointerdown'); if (move) { await wait(100); pe(el, 'pointermove', 5, 60); } await wait(ms); pe(el, 'pointerup'); await wait(30); };
      screenCtx.staffOk = () => true;
      let el = fresh(); out.noMenu = el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })) === false; out.noSelect = getComputedStyle(el).userSelect === 'none';
      await long(el, 900); await tap(el, 4); out.four = calls; await tap(el, 1); out.longThenFive = calls;            // 4回では呼ばれず、5回目で1回だけ
      el = fresh(); await tap(el, 5); out.noLong = calls;                                                              // 長押しなし
      el = fresh(); await long(el, 300); await tap(el, 5); out.shortHold = calls;                                      // 長押しが短い
      el = fresh(); await long(el, 900, true); await tap(el, 5); out.moved = calls;                                    // 指を動かした長押し（スクロール）
      el = fresh(); await long(el, 900); await wait(3200); await tap(el, 5); out.late = calls;                         // 3秒を過ぎたら無効
      await long(el, 900); await tap(el, 5); out.lateRetry = calls;                                                    // もう一度長押しからなら開く
      screenCtx.staffOk = () => false; el = fresh(); await long(el, 900); await tap(el, 5); out.notStaff = calls;      // 担任助手でないなら何もしない
      screenCtx.staffOk = ok0; screenCtx.openAdmin = op0; window.fetch = rf;
      out.pass = out.noMenu && out.noSelect && out.four === 0 && out.longThenFive === 1 && out.noLong === 0 && out.shortHold === 0 && out.moved === 0 && out.late === 0 && out.lateRetry === 1 && out.notStaff === 0;
      document.body.dataset.test = JSON.stringify(out);
    })();
    return 'wait';
  }
  // ?test=noticeadm : 担任助手モードの「お知らせ」タブ
  if (mode === 'noticeadm') { makeDemo(); renderSelect(); adminPreset({ tab: 'notice' }); openAdmin(); return document.querySelectorAll('.nt-adm').length + ' notices, start=' + !!document.querySelector('.nt-startbox'); }
  // ?test=missionadm : 担任助手モードの「ミッション」タブ（コマ数の記録を開いた状態）
  if (mode === 'missionadm') {
    makeDemo(); renderSelect(); adminPreset({ tab: 'mission', mission: 'w20261201', mcounts: Object.assign({}, S.missions[0].counts) }); openAdmin(); return 'ok';
  }
  // ?test=walk : ななめに歩く／家具の角をすり抜けない／マスごとに止まらない（加速・減速はなめらか）／足と腕が逆に振れる
  if (mode === 'walk') {
    makeDemo(); const t0 = S.teams[0]; t0.members = t0.members.slice(0, 1); enterAs(t0.id, t0.members[0]); const rm = room(); rm.items = []; placeAvatars(); rebuildRoom(); sync();
    const a = AVS[0], out = {};
    // 歩かせて記録する（dt 固定。a から見た速さ・位置・足の振り）
    const run = (sx, sy, tx, ty, dt, keep) => {
      a.x = sx + .5; a.y = sy + .5; a.path = []; a.wp = null; a.v = 0; a.res = null; a.hd = null; a.ry = a.tr = 0; a.amp = 0; a.ph = 0; BLK.n = -1;
      const p = findPath(rm, sx, sy, tx, ty); if (!p) return null; setRoute(a, p);
      const rec = { cells: p.length, wps: a.wp.length, v: [], pos: [], hd: [], leg: [], arm: [], t: 0 };
      for (let s = 0; s < 3000 && a.path.length; s++) { updateAvatar(a, dt); updateAvatarObj(a, dt); rec.t += dt; rec.v.push(a.v); rec.pos.push([a.x, a.y]); rec.hd.push(a.hd); rec.leg.push([a.legs[0].rotation.x, a.legs[1].rotation.x]); rec.arm.push([a.arms[0].rotation.x, a.arms[1].rotation.x]); }
      rec.done = !a.path.length; return rec;
    };
    out.diagPath = JSON.stringify(findPath(rm, 1, 1, 4, 4));                // [[2,2],[3,3],[4,4]]（ななめ直進）
    const r1 = run(1, 1, 4, 4, 1 / 60), r2 = run(1, 1, 4, 4, 1 / 30), n = r1.v.length;
    out.wps = r1.wps; out.arrive = r1.done; out.time60 = +r1.t.toFixed(2); out.time30 = +r2.t.toFixed(2);
    let dev = 0; r1.pos.forEach(([x, y]) => { dev = Math.max(dev, Math.abs((x - 1.5) - (y - 1.5)) / Math.SQRT2); }); out.maxDeviation = +dev.toFixed(3);   // まっすぐな線からのずれ
    let stops = 0, vmax = 0, acc = 0; for (let i = 0; i < n; i++) { vmax = Math.max(vmax, r1.v[i]); if (i > 12 && i < n - 12 && r1.v[i] < .3) stops++; if (i) acc = Math.max(acc, Math.abs(r1.v[i] - r1.v[i - 1]) * 60); }
    out.stopsMidWalk = stops; out.vmax = +vmax.toFixed(2); out.v10 = +r1.v[9].toFixed(2); out.maxAcc = +acc.toFixed(1); out.vEnd = r1.v[n - 1];
    let opp = 0, big = 0, armOpp = 0; for (let i = Math.floor(n * .3); i < Math.floor(n * .7); i++) { const [l0, l1] = r1.leg[i], [a0, a1] = r1.arm[i]; if (l0 * l1 < 0 || Math.abs(l0) < .02) opp++; if (l0 * a0 < 0 || Math.abs(l0) < .02) armOpp++; big = Math.max(big, Math.abs(l0)); }
    out.legsAlternate = opp === Math.floor(n * .7) - Math.floor(n * .3); out.armsOppositeLegs = armOpp === opp; out.legSwing = +big.toFixed(2);
    // 家具：机を置き、角をすり抜けず、ふれずに歩く
    rm.items = [inst('desk', 2, 2, 0), inst('chair', 4, 3, 0)]; BLK.n = -1; const bl = blockedSet(rm); let cut = 0, bad = 0, runs = 0, curve = 0, maxTurn = 0, maxSpd = 0;
    const isB = (x, y) => bl.has(x + ',' + y) || x < 0 || y < 0 || x >= rm.w || y >= rm.d;
    for (let sx = 0; sx < rm.w; sx++) for (let sy = 0; sy < rm.d; sy += 2) for (let tx = 0; tx < rm.w; tx += 3) for (let ty = 0; ty < rm.d; ty += 3) {
      if (isB(sx, sy) || isB(tx, ty)) continue; const p = findPath(rm, sx, sy, tx, ty); if (!p) continue;
      let px = sx, py = sy; p.forEach(([x, y]) => { if (x !== px && y !== py && (isB(x, py) || isB(px, y))) cut++; px = x; py = y; });
    }
    [[0, 0, 6, 5], [5, 0, 0, 5], [0, 4, 6, 1], [1, 1, 5, 4], [3, 0, 3, 6]].forEach(([sx, sy, tx, ty]) => {
      if (isB(sx, sy) || isB(tx, ty)) return; const r = run(sx, sy, tx, ty, 1 / 60); if (!r) return; runs++; if (!r.done) bad++; if (r.wps > 1) curve++;
      r.pos.forEach(([x, y]) => { for (const [ox, oy] of [[-.19, -.19], [.19, -.19], [-.19, .19], [.19, .19]]) if (isB(Math.floor(x + ox), Math.floor(y + oy))) bad++; });
      for (let i = 1; i < r.hd.length; i++) maxTurn = Math.max(maxTurn, Math.abs(wrapA(r.hd[i] - r.hd[i - 1])) * 60); r.v.forEach(v => { maxSpd = Math.max(maxSpd, v); });
    });
    out.cornerCuts = cut; out.furnitureHits = bad; out.furnRuns = runs; out.routesWithBends = curve; out.maxTurnRate = +maxTurn.toFixed(1);
    out.stillAfter = (() => { updateAvatarObj(a, 1 / 60); for (let i = 0; i < 90; i++) { updateAvatar(a, 1 / 60); updateAvatarObj(a, 1 / 60); } return +Math.abs(a.legs[0].rotation.x).toFixed(3); })();   // 止まると足の振りは自然に戻る
    return JSON.stringify(out);
  }
  // ?test=walkshot&t=秒&from=x,y&to=x,y : 1人が歩いている途中（歩きはじめて t 秒）で止めて見せる（画像を撮る用）。&pet=1 でペットつき（&petk=番号 で、そのペット。水槽・とりかごは 8〜16）
  if (mode === 'walkshot') {
    makeDemo(); const t0 = S.teams[0]; t0.members = t0.members.slice(0, 1); if (q.get('pet')) studentById(t0.members[0]).me.pet = +q.get('petk') || 2; enterAs(t0.id, t0.members[0]); const rm = room(); rm.items = []; placeAvatars(); rebuildRoom(); sync();
    const a = AVS[0], to = (q.get('to') || '5,5').split(',').map(Number), fr = (q.get('from') || '1,1').split(',').map(Number); a.x = fr[0] + .5; a.y = fr[1] + .5; a.ry = a.tr = 0;
    const p = findPath(rm, fr[0], fr[1], to[0], to[1]); setRoute(a, p);
    for (let s = 0; s < Math.round(+(q.get('t') || 1) * 60); s++) { updateAvatar(a, 1 / 60); updateAvatarObj(a, 1 / 60); }
    cam.zoom = +(q.get('zoom') || 2.4); cam.panx = +(q.get('px') || 0); cam.pany = +(q.get('py') || 0); holdAvatars(); AVS = []; cam.dirty = true; return JSON.stringify({ x: +a.x.toFixed(2), y: +a.y.toFixed(2), v: +a.v.toFixed(2) });
  }
  // ?test=passshot&k=corridor|gap|cross&t=秒 : すれちがいの途中で止めて見せる（画像を撮る用）。corridor＝幅2マスの通路で向かい合う2人／gap＝立っている2人の間を通る／cross＝3人が交差
  if (mode === 'passshot') {
    makeDemo(); const t0 = S.teams[0]; t0.members = t0.members.slice(0, 3); enterAs(t0.id, t0.members[0]); const rm = room(); rm.items = []; placeAvatars(); const W = rm.w, k = q.get('k') || 'corridor';
    const place = (a, x, y) => { a.x = x; a.y = y; a.path = []; a.wp = null; a.v = 0; a.res = null; a.hd = null; a.wait = 0; a.react = 0; a.idle = 99; a.ry = a.tr = 0; };
    const go = (a, cx, cy) => { const [sx, sy] = avCell(a), p = findPath(rm, sx, sy, cx, cy); if (p && p.length) setRoute(a, p); };
    const [P, Q, Z] = AVS;
    if (k === 'corridor') { for (let x = 0; x < W; x++) { rm.items.push(inst('stool', x, 1, 0)); rm.items.push(inst('stool', x, 4, 0)); } place(P, .5, 2.5); place(Q, W - .5, 2.5); go(P, W - 1, 2); go(Q, 0, 2); place(Z, 1.5, 6.5); }
    else if (k === 'gap') { place(P, .5, 2.55); place(Q, 3.5, 2.0); place(Z, 3.5, 3.1); go(P, W - 1, 2); }
    else { place(P, .5, 3.5); place(Q, W - .5, 3.5); place(Z, 3.5, .5); go(P, W - 1, 3); go(Q, 0, 3); go(Z, 3, 6); }
    rebuildRoom(); sync(); BLK.n = -1;
    for (let s = 0; s < Math.round(+(q.get('t') || 1) * 60); s++) AVS.forEach(a => { updateAvatar(a, 1 / 60); updateAvatarObj(a, 1 / 60); });
    cam.zoom = +(q.get('zoom') || 1.6); cam.panx = +(q.get('px') || 0); cam.pany = +(q.get('py') || 0); holdAvatars(); const o = AVS.map(a => [+a.x.toFixed(2), +a.y.toFixed(2)]); AVS = []; cam.dirty = true; return JSON.stringify(o);
  }
  // ?test=facing : 止まっている人はかべ側を向かない／歩くときはななめも／タップでぴょんと反応する
  if (mode === 'facing') {
    makeDemo(); const t0 = S.teams[0]; t0.members = S.students.map(s => s.uid).slice(0, 10); enterAs(t0.id, t0.members[0]);
    const rm = room(); rm.items = rm.items.filter(i => !isBig(i)); placeAvatars(); rebuildRoom(); sync();
    AVS.forEach(a => { a.tr = a.ry = Math.PI; });   // わざと全員かべ向きにしておく
    let badStand = 0, diag = 0, angles = new Set();
    for (let s = 0; s < 1500; s++) {
      if (s % 50 === 0) AVS.forEach(a => { if (!a.path.length) a.idle = 0; });
      AVS.forEach(a => { updateAvatar(a, 1 / 60); updateAvatarObj(a, 1 / 60); if (a.moving) { angles.add(Math.round(a.tr * 4 / Math.PI)); if (Math.abs(Math.sin(2 * a.tr)) > .9) diag++; } });
      if (s > 60) AVS.forEach(a => { if (!a.moving && !a.path.length && a.react <= 0 && Math.abs(wrapA(a.ry - a.tr)) < .01 && (a.ry < -.01 || a.ry > FACE_MAX + .01)) badStand++; });
    }
    const a0 = AVS[1]; a0.path = []; a0.res = null; updateAvatarObj(a0, 0); E.fxG.updateMatrixWorld(true); updateCamera(0, true);
    const wp = a0.g.getObjectByName('head').getWorldPosition(new THREE.Vector3()), [px, py] = project(wp);
    tap(px, py, 'touch'); const reacted = a0.react > 0, hadNote = !!a0.fx;
    let maxLift = 0; for (let s = 0; s < 80; s++) { updateAvatar(a0, 1 / 60); updateAvatarObj(a0, 1 / 60); maxLift = Math.max(maxLift, a0.g.position.y); }
    return JSON.stringify({ badStand, diagSteps: diag, moveAngles: angles.size, reacted, hadNote, maxLift: +maxLift.toFixed(2), noteGone: !a0.fx, standAfter: +a0.tr.toFixed(2) });
  }
  // ?test=multi : まとめて選んで1マス動かす（置けない所には動かない）
  if (mode === 'multi') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]); const rm = room();
    rm.items = [inst('desk', 1, 1), inst('chair', 1, 2), inst('laptop', 1, 1), inst('shelf1', 4, 1)]; sync(); enterMulti();
    const desk = rm.items[0], chair = rm.items[1], top = rm.items[2]; multi.sel.add(desk.uid); multi.sel.add(chair.uid);
    const its = [desk, chair, top], set = new Set(its.map(i => i.uid)), dr = { kind: 'move', its, orig: its.map(i => [i.x, i.y]), set, dx: 0, dy: 0, f0: [0, 0] };
    const okRight = groupFits(dr, 1, 0), blocked = groupFits(dr, 2, 0), outside = groupFits(dr, -2, 0);
    multi.drag = dr; dragMove(...project(new THREE.Vector3(1.0, 0, 0)));   // 画面上で動かしても例外が出ないこと
    multi.drag = null; return JSON.stringify({ okRight, blocked, outside, sel: multi.sel.size });
  }
  if (mode === 'rank' || mode === 'rankp') { makeDemo(); renderSelect(); openRanking(); return 'ok'; }
  if (mode === 'members') { makeDemo(); showTeamMembers(S.teams[0].id); renderSelect(); return 'ok'; }
  if (mode === 'make') { makeDemo(); openMeMaker({ tab: +(q.get('tab') || 0), nick: 'ひなた', me: S.students[0].me, nextLabel: 'つぎへ（番号をきめる）', cancelLabel: 'もどる' }); return 'ok'; }
  if (mode === 'pickteam') { makeDemo(); S.teams.forEach(t => { t.confirmed = true; }); for (let i = S.teams.length; i < +(q.get('n') || 8); i++) S.teams.push(Object.assign({}, S.teams[0], { id: 'x' + i, name: 'チーミ' + (i + 1) })); screenCtx.teamAuth = null; chooseTeam(S.students[0].me, 'ひなた'); return 'ok'; }
  if (mode === 'make1') { makeDemo(); openMeMaker({ nick: '', start: {}, nextLabel: 'つぎへ（番号をきめる）', cancelLabel: 'もどる' }); return 'ok'; }
  if (mode === 'pin') { makeDemo(); pinPad('4けたの番号を入力', 'ピコが動くので確認します', { face: faceImg(S.students[0].me, 'face', 'face'), who: S.students[0].nick }); return 'ok'; }
  if (mode === 'bar') { makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]); sync(); const it = room().items.find(i => i.id === 'desk'); setSel(it.uid); return 'ok'; }
  if (mode === 'bank') { makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]); tab = 'plan'; renderPanel(); return 'ok'; }
  if (mode === 'mes') {
    const el = h('div', { id: 'dbgMes' }); document.body.appendChild(el); let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const row = (t, kids) => { el.appendChild(h('div', { cls: 'dbg-t', text: t })); const r = h('div', { cls: 'dbg-r' }); kids.forEach(k => r.appendChild(k)); el.appendChild(r); };
    const img = (m, k) => { const im = new Image(); im.src = meThumb(m, k); return im; };
    const base = Object.assign({}, S.students.length ? {} : {}, { hair: 0, hairC: 0, skin: 1, eye: 0, nose: 1, mouth: 0, brow: 1, mole: 0, glasses: 0, height: 1, plump: .4, hood: 0 });
    row('かみがた 8', [0, 1, 2, 3, 4, 5, 6, 7].map(i => img(Object.assign({}, base, { hair: i, hairC: i + 1 }), 'hair')));
    row('め 6 + くち 6', [0, 1, 2, 3, 4, 5].map(i => img(Object.assign({}, base, { eye: i, mouth: i, mole: i }), 'face')).concat([0, 1, 2, 3, 4, 5].map(i => img(Object.assign({}, base, { eye: 5 - i, mouth: i, nose: i % 4, brow: i % 5, glasses: i % 5, hairC: i + 2, skin: i }), 'face'))));
    row('ランダムな me- （全身）', Array.from({ length: 9 }, () => img(randomMe(rnd), 'full')));
    return 'ok';
  }
  if (mode === 'detail') { makeDemo(); renderSelect(); openRanking(); teamDetailDlg(S.teams[1]); return 'ok'; }
  if (mode === 'roster') { makeDemo({ noScore: true }); S.students = S.students.slice(0, 2); S.teams = []; renderSelect(); adminPreset({ tab: 'roster', rosterText: '生徒番号\t氏名\tふりがな\t学年\tチーミ\n101\t山田　太郎\tやまだ たろう\t中2\tひまわり\n102\t佐藤 花子\tさとう はなこ\t中3\tあおぞら\n103\t鈴木 一郎\tすずき いちろう\t中2\tひまわり\n\n102\t佐藤 花子\tさとう はなこ\t中3\tあおぞら\n105\t高橋 美咲\tたかはし みさき\t中1\t\n106\t\t\t\t\n107\t伊藤 結衣\tいとう ゆい\t中2\tあおぞら' }); openAdminGate(); S.settings.passcode = '0000'; $('dlg').querySelector('input').value = '0000'; $('dlg').querySelector('input').dispatchEvent(new Event('input')); return 'ok'; }
  if (mode === 'teams') { makeDemo({ noScore: true, unconfirmed: true, partial: true }); S.teams[3].members = S.teams[3].members.slice(0, 1); renderSelect(); adminPreset({ tab: 'teams' }); openAdminGate(); $('dlg').querySelector('input').value = '0000'; $('dlg').querySelector('input').dispatchEvent(new Event('input')); return 'ok'; }
  if (mode === 'stay') {
    makeDemo({ noScore: true }); S.lastStay = { [S.students[0].uid]: 60 };
    const t = '生徒番号\t氏名\t在校時間\n' + S.students.slice(0, 6).map((x, i) => x.id + '\t' + x.name + '\t' + ['1時間30分', '1:05', '90分', '45', '2時間', '0:20'][i]).join('\n') + '\n999\t不明\t1:00\n';
    renderSelect(); adminPreset({ tab: 'stay', stayText: t }); openAdminGate(); $('dlg').querySelector('input').value = '0000'; $('dlg').querySelector('input').dispatchEvent(new Event('input')); return 'ok';
  }
  if (mode === 'score') {
    makeDemo({ noScore: true }); S.lastScore = { [S.students[0].uid]: 3, [S.students[1].uid]: 5 };
    const t = S.students.slice(0, 7).map((s, i) => s.id + '\t' + s.name + '\t' + [3.5, 12.3, 8, 0.4, 20, 5.5, 9][i]).join('\n') + '\n999\tだれか 不明\t4\n' + S.students[8].name.replace(' ', '') + '\t０．５\n' + S.students[9].id + '\t' + S.students[9].name + '\tなし\n';
    S.students.push(store.newStudent('555', '未所属 さん'));
    renderSelect(); adminPreset({ tab: 'score', scoreText: t + '555\t未所属 さん\t2\n' }); openAdminGate(); $('dlg').querySelector('input').value = '0000'; $('dlg').querySelector('input').dispatchEvent(new Event('input')); return 'ok';
  }
  return null;
}
const dlgBtnClick = txt => { const b = [...$('dlg').querySelectorAll('button')].find(x => x.textContent.trim().startsWith(txt)); if (b) b.click(); };
// ?test=svmembers / svlink : サーバー版の画面確認用（にせサーバー）
async function svView(mk, mode) {
  window.__noPin = true; SV.sb = mk.sb; SV.on = true; { const sc = new URLSearchParams(location.search).get('schema'); if (sc != null) mk.db.schema = +sc; if (new URLSearchParams(location.search).get('legacy') === '1') mk.db.legacy = true; await loadServerInfo(); } S = store.defaultState(); noSave = true; screenCtx.loadDemo = null; screenCtx.houseThumb = houseThumb;
  const nicks = ['ひな', 'そら', 'みお', 'れん'];
  for (const n of nicks) await mk.sb.rpc('create_me', { p_team: 't1', p_nick: n, p_me: seededMe(n), p_pin: '1234' });
  mk.db.students[0].approved = true; mk.db.students[0].picos = 4200; mk.db.students[0].earned = 4200; mk.db.teams[0].n = 5;
  await pullApply(true); setMyUid(mk.db.students[0].uid); if (mode !== 'svsel') showTeamMembers('t1'); renderSelect();
  if (mode === 'svgrant') {   // ?test=svgrant : 予約した一律配布。時刻ちょうどに1回だけ・ひもづけ済みの生徒だけ・累計は増やさない
    const D = mk.db.students, out = {}; D[1].approved = true; D[2].approved = true; D[2].staff = true; D[3].approved = false;
    const p0 = D.map(s => s.picos), e0 = D.map(s => s.earned), at = Date.now() + 1200;
    mk.db.grants.push({ id: 'g1', at, picos: 1000, earned: false, note: 'テスト' });
    await watchGrants(); out.before = D.map((s, i) => s.picos - p0[i]).join(',');
    await new Promise(r => setTimeout(r, 3500));
    out.after = D.map((s, i) => s.picos - p0[i]).join(','); out.earned = D.map((s, i) => s.earned - e0[i]).join(',');
    out.ranAtMs = mk.db.calls.filter(c => c[0] === 'run_due_grants').length; await watchGrants(); out.twice = D.map((s, i) => s.picos - p0[i]).join(',');
    out.log = mk.db.log.filter(l => l.kind === 'event').length; out.shown = studentById(D[0].uid).picos === D[0].picos;
    document.body.dataset.test = JSON.stringify(out); return;
  }
  if (mode === 'svunl') {   // ?test=svunl : ピコ無制限のチーミ。オンで全員と貯金箱が満タン・買っても減らない・累計は増えない・表示は∞・オフで0
    const D = mk.db.students, out = {}, e0 = D[0].earned, wait = ms => new Promise(r => setTimeout(r, ms));
    out.badAdmin = ((await svCall('admin_team_unlimited', { p_admin: '9999', p_id: 't1', p_on: true })) || {}).err;
    out.introOff = (await svCall('unl_intro_seen', { p_uid: D[0].uid })).first;   // 無制限でないチーミでは出ない
    await svCall('admin_team_unlimited', { p_admin: '0000', p_id: 't1', p_on: true }); await pullApply(true);
    out.on = D.every(s => s.picos === UNL) && mk.db.teams[0].picos === UNL;
    out.introFirst = (await svCall('unl_intro_seen', { p_uid: D[0].uid })).first; out.introAgain = (await svCall('unl_intro_seen', { p_uid: D[0].uid })).first;   // 最初の1回だけ true
    out.flag = !!S.teams.find(t => t.id === 't1').unlimited;
    enterAs('t1', D[0].uid); await wait(300);
    out.hud = $('pts').textContent; out.bankTxt = $('bank').textContent;
    const d = ITEMS.find(x => !x.rank && x.cat !== 'wallpaper' && x.cat !== 'floor');
    out.bought = await buy(d.id); await wait(300);
    out.afterBuy = D[0].picos === UNL && me.picos === UNL; out.earned = D[0].earned - e0; out.inv = (D[0].inv[d.id] || 0) === 1; out.hud2 = $('pts').textContent;
    await svCall('admin_team_unlimited', { p_admin: '0000', p_id: 't1', p_on: false }); await pullApply(true);
    out.off = D.map(s => s.picos).join(',') + '/' + mk.db.teams[0].picos; out.meOff = me.picos; out.fmtOff = pfmt(0);
    D[0].picos = 50000; await pullApply(true); enterAs('t1', D[0].uid); await wait(300); const d2 = ITEMS.find(x => !x.rank && x.cat !== 'wallpaper' && x.cat !== 'floor' && x.id !== d.id && !x.free); const p5 = D[0].picos; out.boughtOff = await buy(d2.id); out.dbg = [me.picos, priceOf(d2), me.uid === D[0].uid]; await wait(300); out.otherDrops = D[0].picos < p5;   // 無制限でないチーミは、ふつうに減る
    if (out.badAdmin !== 'admin' || !out.on || !out.flag || !out.afterBuy || out.earned !== 0 || !out.inv || out.hud !== '∞' || out.introOff !== false || out.introFirst !== true || out.introAgain !== false || !out.boughtOff || !out.otherDrops) out.err = 'svunl';   // 表示は∞から0へ数字が減っていく演出になるので、値と書き方で確かめる
    document.body.dataset.test = JSON.stringify(out); return;
  }
  if (mode === 'svdone') {   // 確認用：できあがり画面（slot=1 で名前えらびあり）と、承認まちのボタン
    const cr = await svCall('create_me', { p_team: 't1', p_nick: 'ひな', p_me: randomMe(), p_pin: '1234' }); if (new URLSearchParams(location.search).get('slot') === '1') { cr.slot = true; mk.db.students[mk.db.students.length - 1].approved = true; }
    await finishCreate(cr, 't1', '1234'); if (new URLSearchParams(location.search).get('enter') === '1') { dlgBtnClick('家に入る'); }
  }
  // ?test=svgacha&tier=1|2|3&hold=drop|shake&at=ms : 物理ガチャ（生徒）。カプセルのコード → 開ける → 演出 → ピコが入る。at=ms はその時点でアニメを止める（画面確認用）。reduce=1 は「動きを減らす」
  if (mode === 'svgacha') {
    const qq = new URLSearchParams(location.search), tier = +qq.get('tier') || 1, D = mk.db, out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    if (qq.get('reduce') === '1') window.matchMedia = () => ({ matches: true, addEventListener() { }, removeEventListener() { } });
    D.rand = () => ({ 1: .1, 2: .8, 3: .99 })[tier]; D.students[0].pin = ''; D.students[0].approved = true;
    const exp = new Date(Date.now() + 9 * 3600e3 + 30 * 864e5).toISOString().slice(0, 10);
    const b = await svCall('admin_gacha_create', { p_admin: '0000', p_name: 'テスト', p_count: 5, p_prizes: [{ picos: 100, pct: 70 }, { picos: 500, pct: 25 }, { picos: 3000, pct: 5 }], p_per_day: 1, p_expires: exp, p_earned: true });
    setPendingGift(b.codes[0]); enterAs('t1', D.students[0].uid); await wait(1500);
    out.dlg = !!document.querySelector('.ga-dlg'); out.title = (document.querySelector('.ga-ttl') || {}).textContent;
    if (qq.get('shot') === 'dlg') { document.body.dataset.test = JSON.stringify(out); return; }
    const p0 = D.students[0].picos; window.__gxEnv = { hold: qq.get('hold') || '' };
    document.querySelector('#dlg .acts .btn.coral').click(); await wait(300);
    const at = +qq.get('at') || 0, fx = () => document.getElementById('gxFx');
    out.fx = !!fx(); out.tierCls = fx() ? fx().className : '';
    if (at) { await wait(at); document.getAnimations().forEach(a => { try { a.pause(); } catch (e) { } }); document.body.dataset.test = JSON.stringify(Object.assign(out, { cls: fx() ? fx().className : '' })); return; }
    if (qq.get('keep') === '1') { document.body.dataset.test = JSON.stringify(out); return; }   // 画面確認用：開いたまま残す
    await wait(6000); out.num = (document.querySelector('.gx-num') || {}).textContent; out.done = !!(fx() && fx().classList.contains('done'));
    out.got = D.students[0].picos - p0; out.pending = pendingGift(); out.hud = $('pts').textContent;
    const btn = document.querySelector('.gx-close'); if (btn) btn.click(); await wait(500); out.closed = !fx();
    out.again = (await svCall('gacha_redeem', { p_uid: D.students[0].uid, p_pin: '', p_code: b.codes[0] })).err; out.today = (await svCall('gacha_redeem', { p_uid: D.students[0].uid, p_pin: '', p_code: b.codes[1] })).err;
    document.body.dataset.test = JSON.stringify(out); return;
  }
  // ?test=svmeyasu : 目安箱（生徒）。家の中の道具の並び（右はしは &safe=59,24,21 でレール）のボタン（いつでも出る。&old=1 は版26の古いサーバー＝出ない）→ ダイアログ → 送る → 「とどいたよ」。ほかのボタンと重ならず、角に寄らない
  // ?test=svrt : リアルタイム。仲間（にせの2人目）をつなぐ → 「いま 2 人」→ 仲間の位置が届くと、その人のアバターがなめらかに歩く（飛ばない）→ 自分が歩くと仲間に届く（間引き）→ オフにすると送らず・受けず、ぶらぶら歩きにもどる。&hold=1 は仲間が歩いている途中で止める（画面確認用）
  // 描画のループは仮想時間では回らないので、sim() で毎フレームの処理（アバターの更新と送信）を手で回す
  if (mode === 'svrt') {
    const qq = new URLSearchParams(location.search), D = mk.db, out = {}, wait = ms => new Promise(r => setTimeout(r, ms)), { RTBUS } = await import('../tools/mock_sb.js');
    D.students[0].pin = ''; D.students[0].approved = true; D.students[1].approved = true; await pullApply(true);
    const peerUid = D.students[1].uid, got = [], peer = createRealtime({ onPeer: p => got.push(p), onPresence: () => { } });
    let rtN = 0; const P = (x, y, r, m) => peer.send({ x, y, r, m, k: S.cur.room }, performance.now() + 1e6 * (++rtN));   // 仲間の送信は、間引きを通さず毎回送る（仲間の側の間引きは node のテストで確かめる）
    enterAs('t1', D.students[0].uid); await wait(700);
    const sim = async ms => { for (let t = 0; t < ms; t += 16) { AVS.forEach(a => { updateAvatar(a, .016); updateAvatarObj(a, .016); }); rtSend(); await wait(16); } };
    peer.join(mk.sb, 't1', peerUid); await wait(600);
    const pill = $('btnLive'), av = () => AVS.find(a => a.id === peerUid), mine = () => AVS.find(a => a.id === me.uid);
    out.pill = !pill.hidden && pill.textContent.trim(); out.on = pill.classList.contains('on'); out.dot = getComputedStyle(pill.querySelector('.lv-dot')).backgroundColor;
    out.pr = [pill.getBoundingClientRect().left, pill.getBoundingClientRect().right].map(Math.round).join(','); out.hudSub = Math.round($('hudSub').getBoundingClientRect().right);
    const rm = room(), tx = Math.min(rm.w - 1, 4) + .5, ty = Math.min(rm.d - 1, 4) + .5; AVS.forEach(a => { if (a.id !== peerUid) a.idle = 99; });
    const dist = (a, x, y) => Math.round(Math.hypot(a.x - x, a.y - y) * 100) / 100;
    P(1.5, 1.5, 0, 0); await sim(300); out.first = dist(av(), 1.5, 1.5);   // はじめは、その場へ合う
    let maxStep = 0, pv = [av().x, av().y], vmax = 0, k = 0, bad = 0;
    const walk = async n => { for (let i = 0; i < n; i++) { k++; P(1.5 + (tx - 1.5) * k / 24, 1.5 + (ty - 1.5) * k / 24, Math.atan2(tx - 1.5, ty - 1.5), 1); for (let j = 0; j < 10; j++) { await sim(16); const a = av(); maxStep = Math.max(maxStep, Math.hypot(a.x - pv[0], a.y - pv[1])); pv = [a.x, a.y]; vmax = Math.max(vmax, a.v || 0); } } };
    if (qq.get('hold') === '1') { await walk(10); await sim(100); document.body.dataset.test = JSON.stringify(out); return; }
    await walk(24); P(tx, ty, Math.atan2(tx - 1.5, ty - 1.5), 0); await sim(1200);
    const a1 = av(); out.arrived = dist(a1, tx, ty); out.maxStep = Math.round(maxStep * 1000) / 1000; out.maxV = Math.round(vmax * 10) / 10; out.stopped = !a1.moving && (a1.v || 0) < .05; out.follows = !!a1.rt;   // 1フレームに進む最大は 0.1 マス以下（飛ばない）
    // 自分が歩く → 仲間に届く（間引かれる）
    const m0 = mine(); got.length = 0; walkTo(Math.floor(m0.x) === 0 ? 2 : 0, Math.floor(m0.y) === 0 ? 3 : 0, true); await sim(2000); out.recv = got.length; out.recvOk = got.length >= 2 && got.length <= 14 && got.every(g => g.u === me.uid && Object.keys(g).length === 6);
    got.length = 0; await sim(6500); out.stillBeats = got.length;   // 止まっている間は、生存通知だけ（3秒ごと）
    // 仲間が家具を置いた → 「変わったよ」の合図で、1秒以内に自分の画面に出る（サーバーの返事が 0.15 秒かかる想定）
    { window.__lag = 150; const n0 = room().items.length, t0 = performance.now(); D.teams[0].data.rooms[S.cur.room].items.push({ uid: 9101, id: 'lamp', x: 0, y: 5, rot: 0, owner: peerUid }); D.teams[0].version++; peer.ping(D.teams[0].version);
      let w = 0; while (room().items.length === n0 && w < 3000) { await sim(16); w += 16; } out.changeMs = Math.round(performance.now() - t0); out.changeOk = room().items.length === n0 + 1; window.__lag = 0; }
    got.length = 0;
    // オフ：送らない・受けない・チャンネルから抜ける
    setRealtime(false); await sim(300); out.off = { pill: pill.textContent.trim(), chans: (RTBUS.get('house:t1') || new Set()).size, rt: AVS.filter(a => a.rt).length };
    got.length = 0; walkTo(1, 1, true); P(5.5, 5.5, 0, 1); await sim(1500); out.off.recv = got.length; out.off.peerIgnored = !av().rt;
    setRealtime(true); await sim(500); out.again = { pill: pill.textContent.trim(), chans: (RTBUS.get('house:t1') || new Set()).size, pref: rtPref() };
    peer.leave(); await sim(300); out.gone = pill.textContent.trim();
    document.body.dataset.test = JSON.stringify(out); return;
  }
  if (mode === 'svmeyasu') {
    const qq = new URLSearchParams(location.search), D = mk.db, out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    D.students[0].pin = ''; D.students[0].approved = true; D.settings.suggestions_on = false; await pullApply(true); if (qq.get('old') === '1') SV.schema = 26;   // suggestions_on が false でも出る（もう見ない）
    enterAs('t1', D.students[0].uid); await wait(900);
    const b = $('btnMeyasu'); out.shown = !!b && !b.hidden; out.schema = SV.schema;
    if (out.shown) {
      const r = b.getBoundingClientRect(), cs = getComputedStyle(document.documentElement), ciL = parseFloat(cs.getPropertyValue('--ci-l')) || 16;
      out.rect = [r.left, r.top, r.right, r.bottom].map(Math.round).join(','); out.label = b.textContent.trim(); out.hasSvg = !!b.querySelector('svg'); out.noEmoji = !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(b.textContent);
      const hit = [...document.querySelectorAll('#btnMission,#hudSub,#hud,#rooms,#tools .btn,#dock .btn,#bar,#btnPend,#panel')].filter(e => e !== b && e.offsetParent && e.getBoundingClientRect().width).filter(e => { const q = e.getBoundingClientRect(); return !(q.right <= r.left || q.left >= r.right || q.bottom <= r.top || q.top >= r.bottom); });
      out.overlap = hit.map(e => e.id || e.className).join('|'); out.inSafe = r.left >= ciL - 1 || !!b.closest('#tools,#rail'); out.parent = b.parentNode.id; out.oneLine = r.height <= 40 && getComputedStyle(b).whiteSpace === 'nowrap';
      if (qq.get('shot') === 'btn') { document.body.dataset.test = JSON.stringify(out); return; }
      b.click(); await wait(200); out.dlg = !!document.querySelector('#dlg .mx-dlg'); out.cnt = (document.querySelector('.mx-cnt') || {}).textContent;
      const ta = document.querySelector('.mx-ta'); out.max = ta.maxLength;
      if (qq.get('shot') === 'dlg') { ta.value = '食堂の自習スペースに、コンセントがもっとあると助かります。'; ta.dispatchEvent(new Event('input')); document.body.dataset.test = JSON.stringify(out); return; }
      const send = () => [...document.querySelectorAll('#dlg .acts .btn')].find(x => x.textContent === '送る');
      send().click(); await wait(100); out.emptyStays = !!document.querySelector('#dlg .mx-ta') && D.sug.length === 0;   // 空では送れない
      ta.value = 'コンセントがもっとあると助かります'; ta.dispatchEvent(new Event('input')); send().click(); await wait(500);
      out.thanks = (document.querySelector('.mx-thx b') || {}).textContent; out.saved = D.sug.length === 1 && D.sug[0].body === 'コンセントがもっとあると助かります' && D.sug[0].uid === D.students[0].uid;
      if (qq.get('shot') === 'thx') { document.body.dataset.test = JSON.stringify(out); return; }
      document.querySelector('#dlg .acts .btn').click(); await wait(100); out.closed = $('modal').hidden;
      b.click(); await wait(150); { const t2 = document.querySelector('.mx-ta'); out.draftCleared = t2.value === ''; t2.value = 'コンセントがもっとあると助かります'; t2.dispatchEvent(new Event('input')); send().click(); await wait(500); }
      out.dupStays = !!document.querySelector('#dlg .mx-ta') && D.sug.length === 1;   // 同じ文は断る（書いた内容は残る）
    }
    document.body.dataset.test = JSON.stringify(out); return;
  }
  // ?test=svmeyasuhome : ホームの「校舎のお知らせ」の板を3秒以内に10回タップ → 目安箱の一覧（担任助手のパスワードが要る）。再描画でも残り、もう10回で消える。長押し→5回の担任助手入口とは混ざらない
  if (mode === 'svmeyasuhome') {
    const qq = new URLSearchParams(location.search), D = mk.db, out = {}, wait = ms => new Promise(r => setTimeout(r, ms)); let calls = 0;
    const KEY = 'kojoHouse.meyasuShow', op0 = screenCtx.openAdmin, ok0 = screenCtx.staffOk; screenCtx.openAdmin = () => { calls++; }; screenCtx.staffOk = () => true;
    try { localStorage.removeItem(KEY); } catch (e) { } forgetAdmin();
    await pullApply(true);
    for (let i = 0; i < 3; i++) { D.students[i].pin = ''; D.students[i].approved = true; }
    await svCall('suggestion_post', { p_uid: D.students[0].uid, p_pin: '', p_body: '自習室の机がもう少し広いとうれしいです' }); await svCall('suggestion_post', { p_uid: D.students[1].uid, p_pin: '', p_body: '<b>タグ</b>は文字として出るはず\n2行目' });
    D.sug[1].read = true;
    const pe = (el, type, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0, clientX: x || 5, clientY: y || 5 }));
    const tap = async (el, n) => { for (let i = 0; i < n; i++) { pe(el, 'pointerdown'); await wait(30); pe(el, 'pointerup'); await wait(30); } };
    const long = async (el, ms) => { pe(el, 'pointerdown'); await wait(ms); pe(el, 'pointerup'); await wait(30); };
    const fresh = () => { setInfoSeen(false); renderSelect(); return document.querySelector('.home .board'); };
    const card = () => document.querySelector('.mx-home'), flag = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
    const clickBtn = t => [...document.querySelectorAll('#dlg .acts .btn')].find(x => x.textContent === t).click();
    let el = fresh(); out.start = !card() && !flag();
    // 長押しなしの9回では出ない／長押し→5回は担任助手の入口（目安箱は出ない）／3秒を過ぎたら数えなおし
    await tap(el, 9); await wait(300); out.nine = !card() && !flag() && calls === 0;
    el = fresh(); await long(el, 900); await tap(el, 5); await wait(300); out.adminEntry = calls === 1 && !card() && !flag() && !document.querySelector('#dlg .pf');
    el = fresh(); calls = 0; await tap(el, 3); await wait(3200); await tap(el, 7); await wait(300); out.slow = !card() && calls === 0 && !document.querySelector('#dlg .pf');
    // 最初の1回：パスワードを覚えている端末でも、印がなければ必ず入力画面（印がある端末は聞かずに出る）
    { const OK = 'kojoHouse.meyasuOk'; try { localStorage.removeItem(OK); } catch (e) { } localStorage.setItem('kojoHouse.adminRemember', JSON.stringify({ p: D.pass, until: Date.now() + 3600000 }));
      el = fresh(); calls = 0; await tap(el, 10); await wait(400); out.firstAsks = rememberedAdmin() === D.pass && !!document.querySelector('#dlg .pf') && !card() && !flag();
      clickBtn('やめる'); await wait(200);
      try { localStorage.setItem(OK, '1'); } catch (e) { }
      el = fresh(); await tap(el, 10); await wait(500); out.markedNoAsk = !!card() && !document.querySelector('#dlg .pf');
      el = fresh(); await tap(el, 10); await wait(300); out.offKeepsMark = !card() && !flag() && localStorage.getItem(OK) === '1';
      forgetAdmin(); out.forgetClears = localStorage.getItem(OK) === null && rememberedAdmin() === ''; }
    // パスワードを覚えていない：10回で入力画面（担任助手の入口は開かない）→ まちがい（印は付かない）→ 正しいパスワード（一覧が出て、印が付き、端末が覚える）
    el = fresh(); calls = 0; await tap(el, 10); await wait(400); out.ask = !!document.querySelector('#dlg .pf') && calls === 0 && !card();
    { document.querySelector('#dlg .pf input').value = 'wrong-pass'; clickBtn('ひらく'); await wait(400); out.wrong = !!document.querySelector('#dlg .pf-err').textContent && !flag() && !card(); }
    { document.querySelector('#dlg .pf input').value = D.pass; clickBtn('ひらく'); await wait(500); out.shownAfterPw = !!card() && flag() === '1' && rememberedAdmin() === D.pass && $('modal').hidden; }
    out.cards = document.querySelectorAll('.mx-card').length; out.newest = (document.querySelector('.mx-card .mx-body') || {}).textContent; out.noHtml = !document.querySelector('.mx-body b'); out.who = [...document.querySelectorAll('.mx-who')].map(e => e.textContent).join('|');
    out.unreadTag = [...document.querySelectorAll('.mx-st')].map(e => e.textContent).join(',');
    if (qq.get('shot') === 'notice') { [...document.querySelectorAll('.mx-seg button')].find(b => b.textContent === 'お知らせ').click(); await wait(700); document.getAnimations().forEach(a => { try { if (a.effect && a.effect.target && a.effect.target.closest('.hm-flip')) a.finish(); } catch (e) { } }); await wait(100); }
    if (qq.get('shot') === 'mid') card().style.transform = 'rotateY(62deg)';   // 裏返る途中の見た目（確認用に止める）
    if (['home', 'notice', 'mid'].includes(qq.get('shot'))) { document.body.dataset.test = JSON.stringify(out); return; }
    // 既読にする・消す
    [...document.querySelectorAll('.mx-card .btn')].find(x => x.textContent === '既読にする').click(); await wait(300); out.marked = D.sug.filter(x => x.read).length === 2;
    [...document.querySelectorAll('.mx-card .btn')].find(x => x.textContent === '消す').click(); await wait(200); await okDlg(); await wait(300); out.deleted = D.sug.filter(x => x.deleted).length === 1 && document.querySelectorAll('.mx-card').length === 1;
    // 再描画（再読み込みと同じ：印と覚えたパスワードが残る）でも出る
    el = fresh(); await wait(400); out.persist = !!card() && flag() === '1';
    // 切りかえボタン：お知らせ ⇄ 目安箱（何度でも・覚える）。ボタンを押した指は10回タップに数えない
    { const seg = () => document.querySelector('.hm-flip .mx-seg'), pick = t => [...seg().querySelectorAll('button')].find(b => b.textContent === t).click();
      out.segOn = !!seg() && !!card(); pick('お知らせ'); await wait(600); out.toNotice = !card() && !!document.querySelector('.hm-flip .board .nt-list, .hm-flip .board .nt-empty') && !!seg();
      el = fresh(); out.viewKept = !card() && !!seg(); pick('目安箱'); await wait(600); out.toBox = !!card() && !!seg(); await tap(seg().querySelector('button.on'), 10); await wait(200); out.segNoTap = !!card();
      pick('お知らせ'); await wait(600); }
    // もう10回で消える（印も消える）。もう10回で、覚えたパスワードで聞かずに出る
    el = fresh(); await tap(el, 10); await wait(300); out.hidden = !card() && !flag() && !document.querySelector('.mx-seg');
    el = fresh(); await tap(el, 10); await wait(500); out.again = !!card() && flag() === '1' && !document.querySelector('#dlg .pf');
    // パスワードが変わった（サーバー側で変更）：覚えた値でうまくいかないときは一覧を出さず、鍵のカード
    D.pass = 'changed-pass-9'; el = fresh(); await wait(500); out.locked = !!card() && !document.querySelector('.mx-card') && rememberedAdmin() === '' && !!card().querySelector('.btn.coral');
    screenCtx.openAdmin = op0; screenCtx.staffOk = ok0; try { localStorage.removeItem(KEY); } catch (e) { } forgetAdmin();
    out.pass = Object.keys(out).filter(k => out[k] === false).length === 0;
    document.body.dataset.test = JSON.stringify(out); return;
  }
  // ?test=svmeyasuadm : 担任助手モード「目安箱」のまとまり（一覧・既読・消す。あり／なしの切りかえはない）
  if (mode === 'svmeyasuadm') {
    const qq = new URLSearchParams(location.search), D = mk.db, out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    SV.adminPass = '0000'; adminOn = true; D.students.slice(0, 3).forEach(x => { x.approved = true; x.pin = ''; });
    const a = admLoad(); a.students = []; a.teams = []; await pullApply(true); mergeAdmin(a, SV.rows, SV.teamRows, SV.priceMul); a.scoreLog = []; SV.adm = a;
    adminPreset({ tab: 'meyasu' }); openAdmin(); await wait(300);
    const btn = t => [...document.querySelectorAll('.adm-pane .btn')].find(x => x.textContent === t);
    out.noSwitch = !btn('あり') && !btn('なし') && !document.querySelector('.adm-pane .mx-sw');   // あり／なしのボタンはない
    out.hint = /いつでも家の中から送れます/.test((document.querySelector('.adm-pane .hint') || {}).textContent || '');
    await svCall('suggestion_post', { p_uid: D.students[0].uid, p_pin: '', p_body: '体育館の時計がずれています' }); await svCall('suggestion_post', { p_uid: D.students[1].uid, p_pin: '', p_body: '休けい室がほしい' });
    btn('読みこむ').click(); await wait(400); out.cards = document.querySelectorAll('.adm-pane .mx-card').length;
    if (qq.get('shot') === 'list') { document.body.dataset.test = JSON.stringify(out); return; }
    btn('既読にする').click(); await wait(300); out.read = D.sug.filter(x => x.read).length;
    btn('消す').click(); await wait(200); await okDlg(); await wait(300); out.del = D.sug.filter(x => x.deleted).length; out.left = document.querySelectorAll('.adm-pane .mx-card').length;
    document.body.dataset.test = JSON.stringify(out); return;
  }
  // ?test=svgachaadm&n=200 : 物理ガチャ（担任助手）。束を作る → 印刷ページ（A4に40枚）→ 一覧 → 使われた記録 → 取り消し
  if (mode === 'svgachaadm') {
    const qq = new URLSearchParams(location.search), D = mk.db, out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    SV.adminPass = '0000'; adminOn = true; D.students.slice(0, 3).forEach(x => { x.approved = true; x.pin = ''; });
    const a = admLoad(); a.students = []; a.teams = []; await pullApply(true); mergeAdmin(a, SV.rows, SV.teamRows, SV.priceMul); a.scoreLog = []; SV.adm = a;
    adminPreset({ tab: 'gacha', dryPrint: true }); openAdmin(); await wait(300);
    if (qq.get('n')) { const n = document.querySelector('.adm-pane input[aria-label="枚数"]'); n.value = qq.get('n'); n.dispatchEvent(new Event('input')); }
    document.querySelector('.adm-pane input[aria-label="束の名前"]').value = '12月 1号機'; document.querySelector('.adm-pane input[aria-label="束の名前"]').dispatchEvent(new Event('input'));
    if (qq.get('shot') === 'form') { document.body.dataset.test = 'form'; return; }
    [...document.querySelectorAll('.adm-pane .btn.coral')].find(x => x.textContent.includes('コードを作る')).click(); await okDlg(); await wait(400);
    out.cells = document.querySelectorAll('#cardPrint .gk-cell').length; out.pages = document.querySelectorAll('#cardPrint .gk-page').length; out.fresh = !!document.querySelector('.ga-fresh'); out.batches = D.gacha.batches.length;
    out.sample = (document.querySelector('#cardPrint .gk-code') || {}).textContent; out.qr = !!document.querySelector('#cardPrint .gk-qr svg');
    if (qq.get('shot') === 'print') { document.body.dataset.test = JSON.stringify(out); return; }   // 画面確認用：印刷ページを残す
    const codes = [...document.querySelectorAll('#cardPrint .gk-code')].map(e => e.textContent);
    await svCall('gacha_redeem', { p_uid: D.students[0].uid, p_pin: '', p_code: codes[0] }); await svCall('gacha_redeem', { p_uid: D.students[1].uid, p_pin: '', p_code: codes[1] });
    document.querySelector('#cardPrint') && document.querySelector('#cardPrint').remove();
    [...document.querySelectorAll('.adm-pane .btn')].find(x => x.textContent === '印刷した（閉じる）').click(); await okDlg(); await wait(200);
    [...document.querySelectorAll('.adm-pane .btn')].find(x => x.textContent === '一覧を更新').click();
    await wait(500); out.rows = document.querySelectorAll('.ga-row').length; out.used = (document.querySelector('.ga-row .gf-main span') || {}).textContent;
    const lb = [...document.querySelectorAll('.ga-row .btn')].find(x => x.textContent === '記録'); if (lb) { lb.click(); await wait(400); }
    out.log = document.querySelectorAll('.ga-log tr').length - 1; out.nicks = [...document.querySelectorAll('.ga-log td.nm')].map(e => e.textContent).join(',');
    if (qq.get('shot') === 'list') { document.body.dataset.test = JSON.stringify(out); return; }
    [...document.querySelectorAll('.ga-row .btn')].find(x => x.textContent === '取り消す').click(); await okDlg(); await wait(500);
    out.revoked = D.gacha.batches[0].active === false; out.tag = (document.querySelector('.ga-row .tag') || {}).textContent;
    document.body.dataset.test = JSON.stringify(out); return;
  }
  if (mode === 'svlink') {
    SV.adminPass = '0000'; adminOn = true;
    const a = admLoad(); a.students = DEMO_NAMES.slice(0, 6).map((n, i) => ({ uid: 'k' + i, id: String(101 + i), name: n, link: i === 0 ? mk.db.students[0].uid : null })); a.teams = [{ id: 't1', name: 'ひまわり', members: a.students.slice(0, 5).map(x => x.uid) }];
    mergeAdmin(a, SV.rows, SV.teamRows, SV.priceMul); SV.adm = a; adminPreset({ tab: 'link' }); openAdmin();
  }
  // ?test=svhome / svscore / svquick : 担任助手モードのホーム・向上得点の貼り付け（サーバー版）・チーミを作る（にせサーバー）。linked=0 でひもづけ無し、roster=0 で名簿無し
  if (mode === 'svhome' || mode === 'svscore' || mode === 'svquick' || mode === 'svops' || mode === 'svops2' || mode === 'svdaily' || mode === 'svupd' || mode === 'svnotice' || mode === 'svhub') {
    const qq = new URLSearchParams(location.search); SV.adminPass = '0000'; adminOn = true;
    const a = admLoad(); a.students = qq.get('roster') === '0' ? [] : DEMO_NAMES.slice(0, 6).map((n, i) => ({ uid: 'k' + i, id: String(101 + i), name: n, link: qq.get('linked') !== '0' && i < 3 ? mk.db.students[i].uid : null })); a.teams = a.students.length ? [{ id: 't1', name: 'ひまわり', members: a.students.slice(0, 5).map(x => x.uid) }] : [];
    mk.db.students.slice(0, 3).forEach(x => { x.approved = true; });
    await pullApply(true); mergeAdmin(a, SV.rows, SV.teamRows, SV.priceMul); a.scoreLog = []; SV.adm = a;
    adminPreset({ tab: qq.get('tab') || (mode === 'svnotice' ? 'notice' : mode === 'svscore' ? 'score' : 'home'), scoreText: mode === 'svscore' && qq.get('text') !== '0' ? '山田太郎\t12.5\n佐藤花子\t8\n鈴木一郎\t3\n高橋美咲\t5' : '' }); openAdmin();
    if (mode === 'svscore' && qq.get('go') === '1') {   // 「適用する」を押して、サーバーへ送られた中身を調べる（uid と付与ピコだけのはず）
      const b = [...document.querySelectorAll('#sheet button')].find(x => x.textContent.startsWith('適用する')); if (!b) { document.body.dataset.test = 'no apply button: ' + $('sheet').innerText.slice(0, 300); return; } b.click(); await new Promise(r => setTimeout(r, 100)); const cf = [...$('dlg').querySelectorAll('button')].find(x => x.textContent === '適用する'); if (cf) cf.click(); await new Promise(r => setTimeout(r, 300));
      const g = mk.db.calls.find(c => c[0] === 'admin_grant'); document.body.dataset.test = JSON.stringify({ grant: g && g[1], picos: mk.db.students.slice(0, 3).map(x => x.picos), json: JSON.stringify(g && g[1]) }); return;
    }
    if (mode === 'svhub') {   // 担任助手モードの見取り図：今日やること・タブのまとまり・Ctrl+数字・生徒をさがす・生徒カード・元に戻すトースト
      const wait = ms => new Promise(r => setTimeout(r, ms)), o = {}, sheet = () => $('sheet').innerText, kd = (el, key, init) => el.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key, bubbles: true, cancelable: true }, init || {})));
      try {
        await wait(150);
        o.todo = [...document.querySelectorAll('.todo-card')].map(x => x.querySelector('b').textContent);
        o.groups = document.querySelectorAll('#sheet .adm-tab').length; o.subsHome = document.querySelectorAll('#sheet .adm-sub').length;
        kd(document.body, '3', { ctrlKey: true }); await wait(100); o.ctrl3 = (document.querySelector('#sheet .adm-tab.on') || {}).textContent.includes('ピコ・得点'); o.subs = [...document.querySelectorAll('#sheet .adm-sub')].map(x => x.textContent.replace(/\d+$/, '')).join('/');
        kd(document.body, '7', { ctrlKey: true }); await wait(100); o.ctrl7 = (document.querySelector('#sheet .adm-sub.on') || {}).textContent === '在校時間';
        kd(document.body, '1', { ctrlKey: true }); await wait(100);
        // 生徒をさがす（Ctrl+F で入力欄へ → ニックネームの一部で承認まちの me- を探す → Enter で生徒カード）
        kd(document.body, 'f', { ctrlKey: true }); o.ctrlF = document.activeElement.classList.contains('fd-in');
        const inp = document.querySelector('.fd-in'), set = v => { inp.value = v; inp.dispatchEvent(new Event('input')); };
        set('ひまわり'); o.byTeam = document.querySelectorAll('.fd-item').length;
        const pend = SV.rows.find(r => !r.approved); set(pend.nick.slice(0, 2)); o.byNick = document.querySelectorAll('.fd-item').length >= 1;
        set('山田'); o.byName = document.querySelectorAll('.fd-item').length >= 1 && document.querySelector('.fd-item').innerText.includes('山田');
        set('ぜったいにいない'); o.none = !!document.querySelector('.fd-none');
        set(pend.nick); kd(inp, 'Enter'); await wait(150);
        o.card = $('dlg').innerText.includes('承認まちの me-') && $('dlg').innerText.includes('ひもづけて承認');
        const sel = $('dlg').querySelector('select'); sel.value = [...sel.options].find(x => x.value).value; sel.dispatchEvent(new Event('change'));
        [...$('dlg').querySelectorAll('button')].find(x => x.textContent === 'ひもづけて承認').click(); await wait(400);
        o.noConfirm = $('modal').hidden; o.approved = mk.db.calls.some(c => c[0] === 'admin_approve'); o.undoToast = !!document.querySelector('.toast.has-undo');
        document.querySelector('.toast-undo').click(); await wait(400); o.undone = mk.db.calls.some(c => c[0] === 'admin_slot_free');
        // 名簿の人のカード：チーミを移す・特別ピコ
        set('山田'); kd(inp, 'Enter'); await wait(150); o.stuCard = $('dlg').innerText.includes('生徒カード') && $('dlg').innerText.includes('チーミを移す') && $('dlg').innerText.includes('特別ピコを配る');
        [...$('dlg').querySelectorAll('.sc-act')].find(x => x.textContent.includes('特別ピコ')).click(); await wait(150); o.evtTab = (document.querySelector('#sheet .adm-sub.on') || {}).textContent === '特別ピコ' && sheet().includes('えらんでいます');
      } catch (e) { o.err = String(e && e.stack || e); }
      document.body.dataset.test = JSON.stringify(o); return;
    }
    if (mode === 'svnotice') {   // 「お知らせを書く」→ タイトルを入れて「保存」→ サーバーに入るか・ホームに出るか
      const nb = [...document.querySelectorAll('#sheet button')].find(x => x.textContent.includes('お知らせを書く')); nb.click(); await new Promise(r => setTimeout(r, 50));
      const ti = document.getElementById('dlg').querySelector('input[type=text]'); ti.value = 'テストのお知らせ'; ti.dispatchEvent(new Event('input'));
      const sb = [...document.getElementById('dlg').querySelectorAll('button')].find(x => x.textContent === '保存'); sb.click(); await new Promise(r => setTimeout(r, 300));
      const out = { saved: mk.db.notices.length, call: (mk.db.calls.find(c => c[0] === 'admin_notice_save') || [])[1], dlgOpen: !document.getElementById('modal').hidden, toasts: [...document.querySelectorAll('.toast')].map(t => t.textContent) };
      await pullApply(true); out.S = (S.notices || []).length; $('sheet').hidden = true; setInfoSeen(false); renderSelect(); out.home = document.querySelectorAll('.nt-item').length;
      document.body.dataset.test = JSON.stringify(out); return;
    }
    if (mode === 'svops') {   // 運用まわり：チェックリスト・操作者・取り込みの記録/同日2回目の確認/あとで直す一覧・確認用データを消して本番を始める
      const wait = ms => new Promise(r => setTimeout(r, ms)), o = {}, sheet = () => $('sheet').innerText, btn = (root, txt) => [...root.querySelectorAll('button')].find(x => x.offsetParent !== null && x.textContent.trim().startsWith(txt));
      try {
        SV.adminPass = 'newpass-123'; mk.db.pass = 'newpass-123'; admSaveLocal(SV.adm); SV.startDate = '2026-12-01'; SV.exportAt = 0; SV.operator = '';
        const pr = chooseOperator(['たなか', 'すずき'], { force: true }); await wait(50); o.opDlg = $('dlg').innerText.includes('だれが操作しますか') && $('dlg').innerText.includes('すずき'); btn($('dlg'), 'すずき').click(); o.op = await pr; o.opSaved = SV.operator === 'すずき' && localStorage.getItem('kojoHouse.operator') === 'すずき';
        closeModal(); openAdmin(); await wait(100);
        o.checkRows = document.querySelectorAll('#launchCheck .lc-row').length; o.checkTitle = sheet().includes('運用開始までのチェック'); o.noStale = !sheet().includes('サーバーの更新が必要です'); o.exportWarn = sheet().includes('サーバーのデータをまだ保存していません');
        // 取り込み（向上得点）：1回目 → 同じ日の2回目で確認
        adminPreset({ tab: 'score', scoreText: '山田太郎\t12.5\n佐藤花子\t8\n鈴木一郎\t3\n高橋美咲\t5\n不明人\t9' }); openAdmin('score'); await wait(100);
        o.lastNone = sheet().includes('最後の取り込み') && sheet().includes('まだありません');
        btn($('sheet'), '適用する').click(); await wait(200); o.baseDlg = $('dlg').innerText.includes('基準が未記録'); btn($('dlg'), '取り込む').click(); await wait(800); o.badDlg = $('modal').hidden && !!document.querySelector('.toast.has-undo');   // 読めない行の確認はなし（あとで直す一覧に残る）。基準なしの確認だけ1回
        const g1 = mk.db.calls.filter(c => c[0] === 'admin_grant'); o.grant1 = g1.length; o.by = g1[0] && g1[0][1].p_by; o.lastBox = sheet().includes('最後の取り込み') && sheet().includes('すずき'); o.histRow = sheet().includes('直近 1件');
        o.laterList = sheet().includes('あとで直す一覧') && sheet().includes('不明人') && sheet().includes('高橋美咲'); o.laterHints = sheet().includes('まだ me- を作っていない') && sheet().includes('名簿にその人がいない');
        adminPreset({ scoreText: '山田太郎\t12.5\n佐藤花子\t8' }); openAdmin('score'); await wait(100);
        btn($('sheet'), '適用する').click(); await wait(800); o.dupDlg = $('modal').hidden; o.grantAfterCancel = mk.db.calls.filter(c => c[0] === 'admin_grant').length;   // 累計の同日2回目は確認なし（差分だけなので二重にならない。入れたあとに元に戻せる）
        const undo = btn($('sheet'), '取り消す'); o.undoBtn = !!undo; undo.click(); await wait(60); btn($('dlg'), '元に戻す').click(); await wait(300); o.undoneBy = mk.db.log[0].undone_by; o.picosAfterUndo = mk.db.students.slice(0, 3).map(x => x.picos).join(',');
        // 書き出し → 確認用データを消して本番を始める
        mk.db.students.forEach(x => { x.picos = 777; }); openAdmin('set'); await wait(100); o.exportCard = sheet().includes('サーバーのデータを保存（ファイル）');
        btn($('sheet'), 'サーバーのデータを保存').click(); await wait(300); o.exportAt = SV.exportAt > 0 && mk.db.calls.some(c => c[0] === 'admin_mark_export');
        const dz = document.querySelector('#sheet .danger-zone'); dz.open = true; btn(dz, '確認用データを消して本番を始める').click(); await wait(80);
        const dl = $('dlg'); o.wipeText = dl.innerText.includes('消えるもの') && dl.innerText.includes('残るもの') && dl.innerText.includes('名前の枠');
        const go = btn(dl, '消して本番を始める'); o.goDisabled = go.disabled; const ins = dl.querySelectorAll('input');
        const set = (e, v) => { e.value = v; e.dispatchEvent(new Event('input')); };
        set(ins[0], 'wrong-pass'); set(ins[1], '本番開始'); o.goEnabled = !go.disabled; go.click(); await wait(300); o.wrongPassKept = mk.db.students.length > 0 && $('dlg').innerText.includes('消えるもの');
        set(ins[1], 'ちがう'); o.goDisabledPhrase = go.disabled; set(ins[0], 'newpass-123'); set(ins[1], '本番開始'); const exportsBefore = mk.db.calls.filter(c => c[0] === 'admin_export').length;
        go.click(); await wait(600);
        o.wiped = mk.db.students.length === 0 && mk.db.log.length === 0; o.exportedFirst = mk.db.calls.filter(c => c[0] === 'admin_export').length === exportsBefore + 1; o.teamKept = mk.db.teams.length > 0 && mk.db.teams[0].confirmed; o.wipedAt = SV.wipedAt > 0;
        openAdmin('home'); await wait(100); o.wipeRowOk = !!document.querySelector('#launchCheck .lc-row[data-key=wipe].ok'); o.rosterKept = SV.adm.students.length === 6;
      } catch (e) { o.err = String(e && e.stack || e); }
      document.body.dataset.test = JSON.stringify(o); return;
    }
    if (mode === 'svupd') {   // 開いたままのタブ：同じ版なら何も出ない／version.txt が変わっていたら「新しい版があります［更新する］」（本物の通信はしない：版は差しかえで返す）
      const wait = ms => new Promise(r => setTimeout(r, ms)), o = {};
      try {
        window.__updWatchTest = true; let ver = new URL(import.meta.url).searchParams.get('v'); window.__fetchVersion = async () => ver; const check = startUpdateWatch();
        o.hasCheck = typeof check === 'function'; await check(); o.sameNoBar = !$('updBar');
        ver = '209912312359'; await check(); await wait(50); const bar = $('updBar'); o.bar = !!bar && bar.innerText.includes('新しい版があります') && !!bar.querySelector('button') && bar.querySelector('button').textContent === '更新する';
        const r = bar && bar.getBoundingClientRect(); o.barRect = r && [Math.round(r.top), Math.round(r.height), Math.round(r.width)]; o.barSmall = !!r && r.height < 40 && r.top < 20; await check(); o.once = document.querySelectorAll('#updBar').length === 1;
        ver = 'garbage'; $('updBar').remove(); await check(); o.badIgnored = !$('updBar');
      } catch (e) { o.err = String(e && e.stack || e); }
      document.body.dataset.test = JSON.stringify(o); return;
    }
    if (mode === 'svdaily') {   // 利用時間：残り知らせ→「今日はここまで」→家に入れない→担任助手のme-は対象外→今日だけ解除で続けられる
      const wait = ms => new Promise(r => setTimeout(r, ms)), o = {};
      try {
        mk.db.settings.daily_minutes = 1; mk.db.students[1].staff = true; await pullApply(true); o.dailyMin = SV.dailyMin;
        const st = studentById(mk.db.students[0].uid), t = S.teams.find(x => x.id === 't1'); closeModal();
        dailyAdd(st.uid, 35); startHouse(t, st); await wait(100); o.inHouse = !!T && me === st; dailyTick(); await wait(1100); dailyTick(); o.warnToast = $('toasts').innerText.includes('あと');
        dailyAdd(st.uid, 30); dailyTick(); await wait(50); o.overlay = !!$('dailyEnd') && $('dailyEnd').innerText.includes('今日はここまで') && $('dailyEnd').innerText.includes('続きは明日');
        o.homeKept = document.body.innerText.includes('チーミ') || !$('select').hidden;
        if (new URLSearchParams(location.search).get('shot') === '1') { document.body.dataset.test = 'shot'; return; }
        [...$('dailyEnd').querySelectorAll('button')].find(x => x.textContent.startsWith('ホームにもどる')).click(); await wait(100); o.left = !T && !$('dailyEnd');
        startHouse(t, st); await wait(100); o.blocked = !T && !!$('dailyEnd'); const btnc = [...$('dailyEnd').querySelectorAll('button')].find(x => x.textContent.startsWith('解除されたか'));
        btnc.click(); await wait(400); o.stillBlocked = !!$('dailyEnd');
        [...$('dailyEnd').querySelectorAll('button')].find(x => x.textContent.startsWith('ホームにもどる')).click(); await wait(50);
        const stf = studentById(mk.db.students[1].uid); dailyAdd(stf.uid, 500); startHouse(t, stf); await wait(100); o.staffExempt = !!T && me === stf && !$('dailyEnd'); leaveTeam();
        startHouse(t, st); await wait(100); const btn2 = [...$('dailyEnd').querySelectorAll('button')].find(x => x.textContent.startsWith('解除されたか')); await mk.sb.rpc('admin_daily_unlock', { p_admin: mk.db.pass, p_uid: st.uid, p_on: true }); btn2.click(); await wait(500); o.unlocked = !$('dailyEnd');
        startHouse(t, st); await wait(100); o.entersAfterUnlock = !!T && me === st; leaveTeam();
        mk.db.settings.daily_minutes = 0; await pullApply(true); o.noLimit = !dailyBlocked(st) && SV.dailyMin === 0;
      } catch (e) { o.err = String(e && e.stack || e); }
      document.body.dataset.test = JSON.stringify(o); return;
    }
    if (mode === 'svops2') {   // メンバーの変化：休止・名前を戻す・チーミ移動・生徒を1人追加
      const wait = ms => new Promise(r => setTimeout(r, ms)), o = {}, sheet = () => $('sheet').innerText, btn = (root, txt) => [...root.querySelectorAll('button')].find(x => x.offsetParent !== null && x.textContent.trim().startsWith(txt));
      try {
        SV.adminPass = 'newpass-123'; mk.db.pass = 'newpass-123';
        const t2 = JSON.parse(JSON.stringify(mk.db.teams[0])); t2.id = 't2'; t2.name = 'あおぞら'; t2.members = []; t2.n = 3; t2.picos = 0; t2.data.rooms[0].items = []; mk.db.teams.push(t2);
        const u0 = mk.db.students[0].uid; mk.db.teams[0].data.rooms[0].items = [{ uid: 1, id: 'chair', x: 2, y: 2, rot: 0, owner: u0 }, { uid: 2, id: 'sofa1', x: 3, y: 3, rot: 0, owner: mk.db.students[1].uid }];
        a.teams.push({ id: 't2', name: 'あおぞら', members: [] }); mergeAdmin(a, SV.rows, SV.teamRows, SV.priceMul); admSaveLocal(a); await actx.reload(); await pullApply(true);
        SV.operator = 'たなか'; openAdmin('pins'); await wait(150);
        o.pinsBtns = !!btn($('sheet'), '休止') && !!btn($('sheet'), '名前を戻す');
        btn($('sheet'), '休止').click(); await wait(60); o.retireDlg = $('dlg').innerText.includes('ログインできなくなります') && $('dlg').innerText.includes('卒業した人'); btn($('dlg'), '休止にする').click(); await wait(400);
        o.retired = mk.db.students[0].retired === true; o.retiredTag = sheet().includes('休止') && !!btn($('sheet'), '復帰'); o.hiddenFromTeam = !SV.teamRows.find(x => x.id === 't1').members.includes(u0);
        btn($('sheet'), '復帰').click(); await wait(60); btn($('dlg'), '復帰させる').click(); await wait(400); o.restored = mk.db.students[0].retired === false;
        const nb = [...$('sheet').querySelectorAll('button')].filter(x => x.textContent.trim() === '名前を戻す')[1]; nb.click(); await wait(60); btn($('dlg'), '差し戻す').click(); await wait(400); o.nickReset = mk.db.students[1].nick === '' && sheet().includes('まだ');
        // チーミ移動
        openAdmin('teams'); await wait(150); const chip = [...document.querySelectorAll('#sheet .schip')].find(x => x.title === '101'); o.chip = !!chip; chip.click(); await wait(60);
        btn($('dlg'), 'あおぞら').click(); await wait(80); o.moveDlg = $('dlg').innerText.includes('持ち物にもどります') && $('dlg').innerText.includes('チーミ移動'); btn($('dlg'), '移す').click(); await wait(500);
        o.moved = mk.db.students[0].team_id === 't2' && mk.db.teams[1].members.includes(u0) && !mk.db.teams[0].members.includes(u0); o.invBack = mk.db.students[0].inv.chair >= 1; o.houseClean = mk.db.teams[0].data.rooms[0].items.length === 1;
        o.localMoved = !!SV.adm.teams.find(x => x.id === 't2').members.includes(SV.adm.students[0].uid); o.picosKept = mk.db.students[0].picos === 4200;
        // 生徒を1人追加
        openAdmin('home'); await wait(100); const addB = [...$('sheet').querySelectorAll('.home-btn')].find(x => x.textContent.includes('生徒を足す')); o.addBtn = !!addB; addB.click(); await wait(500);
        const set = (e, v) => { e.value = v; e.dispatchEvent(new Event('input')); }, cell = (r, c) => document.querySelector('.ag-in[data-r="' + r + '"][data-c="' + c + '"]'); set(cell(0, 0), '999'); set(cell(0, 1), '途中 参加'); set(cell(0, 4), SV.adm.teams[0].name); btn($('sheet'), '名簿に追加する').click(); await wait(600);
        const ns = SV.adm.students.find(x => x.id === '999'); o.added = !!ns && SV.adm.teams[0].members.includes(ns.uid); await wait(700); o.slotRegistered = mk.db.slots.some(x => x.k === (ns || {}).uid && x.team_id === 't1' && x.name === '途中 参加'); o.doneDlg = [...document.querySelectorAll('.toast')].some(t => t.textContent.includes('追加'));
        o.nameOnlyInSlots = JSON.stringify(mk.db.calls.filter(c => c[0] === 'admin_roster_save')).includes('途中') && !JSON.stringify(mk.db.calls.filter(c => c[0] !== 'admin_roster_save')).includes('途中');
        closeModal(); await pullApply(true); const sNo = studentById(mk.db.students[1].uid); o.nickEmpty = sNo && sNo.nick === ''; startHouse(S.teams.find(x => x.id === 't1'), sNo); await wait(900); o.nickFix = $('dlg').innerText.includes('ニックネームを付け直してください');
      } catch (e) { o.err = String(e && e.stack || e); }
      document.body.dataset.test = JSON.stringify(o); return;
    }
    if (mode === 'svquick') {
      openQuickTeam();
      if (qq.get('go') === '1') {
        const d = $('dlg'), ins = d.querySelectorAll('input'); ins[0].value = 'あおぞら'; ins[1].value = '2468'; ins[2].value = '7'; ins[2].dispatchEvent(new Event('input'));
        [...d.querySelectorAll('button')].find(x => x.textContent === '作って始める').click(); await new Promise(r => setTimeout(r, 500));
        const T2 = mk.db.teams.find(t => t.name === 'あおぞら'); document.body.dataset.test = JSON.stringify({ team: T2 && { n: T2.n, confirmed: T2.confirmed, code: T2.mockCode }, calls: mk.db.calls.map(c => c[0]).join(','), done: $('dlg').innerText.slice(0, 60) }); return;
      }
    }
  }
  document.body.dataset.test = 'ok';
}
// ?test=sv : にせサーバー(tools/mock_sb.js)で、サーバー版の配線（me作成→入室→買う→置く→保存→他の人の変更→競合）を通す
// ?test=svplan : にせサーバーで間取りの配線（指でつまみをドラッグ→部屋を描く→確定→team_layout→反映→house_commit が通る）を確かめる
async function svPlanTest(mk) {
  const out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
  try {
    window.__noPin = true; SV.sb = mk.sb; SV.on = true; S = store.defaultState(); noSave = true; screenCtx.loadDemo = null; screenCtx.houseThumb = houseThumb;
    await pullApply(true);
    const cr = await svCall('create_me', { p_team: 't1', p_nick: 'ひな', p_me: randomMe(), p_pin: '1234' }); setMyUid(cr.uid);
    mk.db.students[0].approved = true; mk.db.students[0].picos = 20000; mk.db.teams[0].picos = 500000; await pullApply(true);
    enterAs('t1', cr.uid); await wait(80);
    const ctl = openPlanScreen(), svg = document.querySelector('.plan-svg'), vbx = svg.getAttribute('viewBox').split(' ').map(Number);
    const fire = (type, x, y) => svg.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 7, bubbles: true, isPrimary: true }));
    const px = () => { const r = svg.getBoundingClientRect(), vb = svg.getAttribute('viewBox').split(' ').map(Number), u = Math.min(r.width / vb[2], r.height / vb[3]); return { r, vb, u, X: gx => r.left + (r.width - vb[2] * u) / 2 + (gx - vb[0]) * u, Y: gz => r.top + (r.height - vb[3] * u) / 2 + (gz - vb[1]) * u }; };
    let g = px(); const h = svg.querySelector('[data-h="r"] circle').getBoundingClientRect();
    out.handlePx = Math.round(h.width);   // つまみの大きさ（32px以上）
    fire('pointerdown', h.left + h.width / 2, h.top + h.height / 2); fire('pointermove', g.X(8), g.Y(3)); fire('pointerup', g.X(8), g.Y(3));
    out.draftW = ctl.draft()[0].w; out.cost1 = ctl.state().cost; out.err1 = ctl.state().err;
    const add = [...document.querySelectorAll('.plan-side button')].find(b => b.textContent.includes('部屋をつくる')); add.click();
    g = px(); fire('pointerdown', g.X(8), g.Y(0)); fire('pointermove', g.X(14), g.Y(6)); fire('pointerup', g.X(14), g.Y(6));
    out.rooms = ctl.draft().length; out.cost2 = ctl.state().cost; out.err2 = ctl.state().err;
    const before = mk.db.teams[0].picos; await ctl.commit(); await wait(200);
    const st = mk.db.teams[0]; out.server = st.data.rooms.map(r => [r.x, r.z, r.w, r.d, r.k]); out.paid = before - st.picos; out.client = T.rooms.map(r => [r.x, r.z, r.w, r.d]); out.version = [T.version, st.version]; out.closed = document.getElementById('sheet').hidden;
    out.costOk = out.paid === out.cost2;
    startPlace('chair', 'inv'); me.inv.chair = 1; startPlace('chair', 'inv'); moveGhost(...project(new THREE.Vector3(2.5, 0, 2.5))); confirmGhost(); await wait(500);
    out.afterCommit = [T.version, mk.db.teams[0].version, mk.db.teams[0].data.rooms[0].items.length];   // 間取り変更のあとも house_commit が通る
    switchRoom(1); await wait(50); out.cur = S.cur.room; out.fx = [E.fxG.position.x, E.fxG.position.z];
  } catch (e) { out.error = String(e && e.stack || e); }
  document.body.dataset.test = JSON.stringify(out);
}
// ?test=svuid : にせサーバーで、すでに家具のある家（uid 1〜3）に、あたらしく開いた端末からテーブルなどを置いても、家具の uid がぶつからず保存できる（本物の house_commit と同じ dup 検査つき）
async function svUidTest(mk) {
  const out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
  try {
    window.__noPin = true; SV.sb = mk.sb; SV.on = true; S = store.defaultState(); noSave = true; screenCtx.loadDemo = null; screenCtx.houseThumb = houseThumb;
    await pullApply(true);
    const cr = await svCall('create_me', { p_team: 't1', p_nick: 'ひな', p_me: randomMe(), p_pin: '1234' }); setMyUid(cr.uid);
    mk.db.students[0].approved = true; mk.db.students[0].picos = 90000; mk.db.students[0].inv = { dtable: 1, lowtable: 1, chair: 1 };
    mk.db.teams[0].data.rooms[0].items.push({ uid: 1, id: 'chair', x: 0, y: 0, rot: 0 }, { uid: 2, id: 'chair', x: 2, y: 0, rot: 0 }, { uid: 3, id: 'lamp', x: 4, y: 0, rot: 0 });   // いまの本番と同じ：uid 1〜3 の家具がある家
    mk.db.teams[0].version++; await pullApply(true); uidN = 1;   // あたらしく開いた端末（uid の数えは 1 から）
    enterAs('t1', cr.uid); await wait(80);
    startPlace('dtable', 'inv'); moveGhost(...project(new THREE.Vector3(3, 0, 4))); confirmGhost(); await wait(500);
    const its = mk.db.teams[0].data.rooms[0].items; out.serverItems = its.length; out.uniq = new Set(its.map(i => i.uid)).size === its.length; out.version = [T.version, mk.db.teams[0].version];
    out.noError = !document.querySelector('#toasts').innerText.includes('エラー');
    startPlace('lowtable', 'inv'); moveGhost(...project(new THREE.Vector3(5, 0, 1))); confirmGhost(); await wait(500);
    out.serverItems2 = mk.db.teams[0].data.rooms[0].items.length; out.version2 = [T.version, mk.db.teams[0].version];
  } catch (e) { out.error = String(e && e.stack || e); }
  document.body.dataset.test = JSON.stringify(out);
}
// ?test=svseat : いすと机・テーブルは同じマスに置ける（机のそば・下に半分）／大きい家具どうしは重ねられない／十字キー（0.5マス）で動く／置いて保存できる（保存できませんでしたが出ない）
async function svSeatTest(mk) {
  const out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
  try {
    window.__noPin = true; SV.sb = mk.sb; SV.on = true; S = store.defaultState(); noSave = true; screenCtx.loadDemo = null; screenCtx.houseThumb = houseThumb;
    await pullApply(true);
    const cr = await svCall('create_me', { p_team: 't1', p_nick: 'ひな', p_me: randomMe(), p_pin: '1234' }); setMyUid(cr.uid);
    mk.db.students[0].approved = true; mk.db.students[0].picos = 90000; mk.db.students[0].inv = { dtable: 1, dchair: 3, sofa1: 1, stool: 1, lamp: 1 };
    await pullApply(true); enterAs('t1', cr.uid); await wait(80);
    const rm = room(), put = async (id, x, y, rot) => { startPlace(id, 'inv'); ghost.x = x; ghost.y = y; ghost.rot = rot || 0; evalGhost(); const ok = ghost.ok, why = ghost.why; if (ok) confirmGhost(); else cancelGhost(); await wait(60); return ok ? 'ok' : why; };
    out.table = await put('dtable', 2, 3);                  // 2x1（x=2..4, y=3..4）
    out.chairBeside = await put('dchair', 4, 3);            // 机の隣
    out.chairSame = await put('dchair', 2.5, 3);            // 机と同じマス（机の下に半分）
    out.chairTwice = await put('dchair', 2.5, 3);           // いすどうしは重ねられない
    out.sofaOnTable = await put('sofa1', 2, 3);             // 大きい家具どうしは重ねられない
    out.stoolOnChair = await put('stool', 3, 3);            // いす（同じマスのいす）に別のいす → 置けない
    startPlace('lamp', 'inv'); ghost.x = 2; ghost.y = 3; evalGhost(); out.lampOnTable = ghost.ok; cancelGhost();   // 小物は今まで通り机の上に置ける
    out.blocked = [...blockedSet(rm)].sort().join(' ');
    // 十字キーで 0.5 マス動く（家具の向き＝画面の向き）
    startPlace('dchair', 'inv'); const x0 = ghost.x, y0 = ghost.y; out.padShown = !$('pad').hidden && $('pad').getBoundingClientRect().width > 100;
    padStep('r'); padStep('r'); padStep('u'); out.step = [ghost.x - x0, ghost.y - y0]; const rot0 = ghost.rot; rotateGhost(); out.rot = [rot0, ghost.rot];
    cancelGhost(); out.padHidden = $('pad').hidden;
    await wait(500);
    const its = mk.db.teams[0].data.rooms[0].items; out.serverItems = its.map(i => i.id + '@' + i.x + ',' + i.y).join(' '); out.version = [T.version, mk.db.teams[0].version];
    out.noError = !document.querySelector('#toasts').innerText.includes('エラー') && !document.body.innerText.includes('保存できませんでした');
  } catch (e) { out.error = String(e && e.stack || e); }
  document.body.dataset.test = JSON.stringify(out);
}
// ?test=devpin : 「この端末に番号を覚えさせる」（にせサーバー）。覚えさせる→番号を聞かない／設定のわすれる／覚えさせない→また聞く・確認は二度と出ない／設定の覚えさせる／番号ちがいで消える
async function devpinTest(mk) {
  const out = {}, wait = ms => new Promise(r => setTimeout(r, ms)), key = k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
  const padUp = () => !$('modal').hidden && !!document.querySelector('.pin-keys'), dlgUp = () => !$('modal').hidden && $('dlg').textContent.includes('覚えさせますか');
  const reset = () => { pinCache = { uid: null, pin: '', until: 0 }; }, typ = async s => { s.split('').forEach(key); await wait(300); };
  try {
    SV.sb = mk.sb; SV.on = true; S = store.defaultState(); noSave = true; screenCtx.loadDemo = null; screenCtx.houseThumb = houseThumb;
    try { localStorage.removeItem(DPKEY); localStorage.removeItem(DPNO); } catch (e) { }
    await pullApply(true);
    const cr = await svCall('create_me', { p_team: 't1', p_nick: 'ひな', p_me: randomMe(), p_pin: '1234' }); setMyUid(cr.uid);
    mk.db.students[0].approved = true; mk.db.students[0].picos = 90000; await pullApply(true);
    enterAs('t1', cr.uid); await wait(80); out.inHouse = !!me && me.uid === cr.uid;
    if (new URLSearchParams(location.search).get('shot') === '1') { settingsDlg(); return; }   // 画面確認用：設定を開いたまま
    // 1) 覚えさせる → 次は番号を聞かない
    let p = requirePin(); await wait(50); out.pad1 = padUp(); await typ('1234'); out.ask1 = dlgUp(); dlgBtnClick('覚えさせる'); out.ok1 = await p;
    out.saved = JSON.stringify(devpinGet()) === JSON.stringify({ uid: cr.uid, pin: '1234' });
    reset(); p = requirePin(); await wait(100); out.pad2 = padUp(); out.ok2 = await p;
    // 2) 設定：わすれる → 「覚えさせない」扱い
    settingsDlg(); out.setBtn = ([...$('dlg').querySelectorAll('.setrow button')].find(b => b.textContent === 'わすれる') || {}).textContent;
    dlgBtnClick('わすれる'); await wait(50); out.forgot = !devpinGet() && devpinNoList().includes(cr.uid); if (!$('modal').hidden) closeModal();
    // 3) 覚えさせない扱い：キャッシュが切れたらまた番号を聞く・確認は出ない
    reset(); p = requirePin(); await wait(50); out.pad3 = padUp(); await typ('1234'); out.ask3 = dlgUp(); out.ok3 = await p;
    pinCache.until = Date.now() - 1; p = requirePin(); await wait(50); out.pad4 = padUp(); await typ('1234'); out.ask4 = dlgUp(); out.ok4 = await p;
    // 4) 設定：覚えさせる（番号を1回入れる）
    settingsDlg(); reset(); dlgBtnClick('覚えさせる'); await wait(80); out.padSet = padUp(); await typ('1234'); await wait(100); out.savedBySet = !!devpinGet() && !devpinNoList().includes(cr.uid); if (!$('modal').hidden) closeModal();
    // 5) 担任助手が番号をかえた → 覚えた番号がちがう → サーバーが pin を返して、覚えた番号が消える
    mk.db.students[0].pin = '9999'; reset(); await buy('chair'); out.droppedOnPinErr = !devpinGet(); await wait(50); if (!$('modal').hidden) closeModal();
    // 6) 入れ直せば、また聞く（覚えさせない一覧にいない人）
    p = requirePin(); await wait(50); out.pad6 = padUp(); await typ('9999'); out.ask6 = dlgUp(); dlgBtnClick('覚えさせる'); out.ok6 = await p; out.saved6 = (devpinGet() || {}).pin;
    out.staffNo = devpinOk({ uid: 'x', staff: true }) === false;
  } catch (e) { out.error = String(e && e.stack || e); }
  try { localStorage.removeItem(DPKEY); localStorage.removeItem(DPNO); } catch (e) { }
  document.body.dataset.test = JSON.stringify(out);
}
// ?test=mslag&lag=ミリ秒&pend=1&seen=1 : 週間ミッションの読み込み中の見え方（にせサーバー。通信しない）。lag＝にせサーバーの rpc（達成状況）を遅らせる／pend=1＝ミッション自体も「まだ読んでいない」状態にする／seen=1＝前に自分のコマ数を覚えている端末
// 家に入ってから 100ms ごとに、左上のカード（#btnMission）と帯（#msTab）の文字と高さを記録する（一瞬「ありません」や 0 が出ないことの確認）
async function msLagTest(mk) {
  const out = {}, wait = ms => new Promise(r => setTimeout(r, ms)), q = new URLSearchParams(location.search);
  try {
    window.__noPin = true; SV.sb = mk.sb; SV.on = true; S = store.defaultState(); noSave = true; screenCtx.loadDemo = null; screenCtx.houseThumb = houseThumb;
    await pullApply(true);
    const cr = await svCall('create_me', { p_team: 't1', p_nick: 'ひな', p_me: randomMe(), p_pin: '1234' }); setMyUid(cr.uid);
    mk.db.students[0].approved = true; await pullApply(true);
    const td = todayStr(); await svCall('admin_mission_save', { p_admin: '0000', p_id: 'wlag', p_title: '週4コマ以上 受講しよう', p_starts: td, p_ends: td, p_need: 4, p_picos: 5000, p_item: 'trophy' });
    await svCall('admin_mission_counts', { p_admin: '0000', p_id: 'wlag', p_entries: { [cr.uid]: 2 } }); await pullApply(true);
    clearProg(); try { localStorage.removeItem('kojoHouse.msMine'); } catch (e) { }
    if (q.get('seen') === '1') mineSet('wlag|t1', 2);
    window.__lag = +(q.get('lag') || 1500); const rpc0 = SV.sb.rpc; if (window.__lag >= 60000) SV.sb.rpc = (n, a) => n === 'mission_progress' ? new Promise(() => { }) : rpc0(n, a);   // 60000 以上＝達成状況がずっと届かない状態で止める（画面確認用）
    const t0 = Date.now(), log = [], snap = () => { const c = $('btnMission'), m = $('msTab'); log.push([Date.now() - t0, c.hidden ? '-' : c.innerText.replace(/\s+/g, ' '), Math.round(c.getBoundingClientRect().height), m.innerText.replace(/\s+/g, ' '), Math.round(m.getBoundingClientRect().height)].join(' | ')); };
    enterAs('t1', cr.uid); await wait(80);
    if (q.get('pend') === '1') { S.missions = []; SV.missionsOk = null; pullApply = async () => { }; paintMissionBtn(); paintMsTab(); }
    // dlg=1：ミッションのダイアログ、dlg=panel：右パネルの帯から開く。開いてから 100ms ごとに、文字・高さ・opacity・作り直し・アニメ再開を記録する
    const dm = q.get('dlg'); let first = null, rebuilt = 0, animRestart = 0, lastAnim = -1;
    const dsnap = () => {
      const root = dm === 'panel' ? $('tabBody') : $('dlg'), card = root.querySelector('.ms-card'), an = (dm === 'panel' ? $('tabBody') : $('dlg')).getAnimations().map(a => a.currentTime);
      if (card && !first) first = card; if (first && card && card !== first) { rebuilt++; first = card; }
      const ct = an.length ? an[0] : -1; if (ct >= 0 && lastAnim >= 0 && ct < lastAnim - 1) animRestart++; lastAnim = ct;
      const op = [root, ...root.querySelectorAll('.ms-card,.ms-mem,.ms-chip')].map(e => (+getComputedStyle(e).opacity).toFixed(2)).filter(v => v !== '1.00').join(',');
      log.push([Date.now() - t0, root.innerText.replace(/\s+/g, ' ').slice(0, 160), root.offsetHeight, 'sk=' + root.querySelectorAll('.sk-b').length, 'op=' + op, 'parts=' + [...root.querySelectorAll('h3,.ms-card,.ms-hd,.ms-cond,.ms-mem,.ms-chips,.ms-rew,.ms-act,.acts')].map(e => e.className.split(' ')[0] + ':' + Math.round(e.getBoundingClientRect().height)).join(',')].join(' | '));
    };
    let hch = 0, rm = 0, hlast = -1; const rt = dm === 'panel' ? $('tabBody') : $('dlg');   // 高さの変わった回数（ResizeObserver）／ミッションのカードが作り直された回数（MutationObserver）
    if (dm) { new ResizeObserver(() => { const hh = Math.round(rt.getBoundingClientRect().height); if (hlast >= 0 && hh !== hlast) hch++; hlast = hh; }).observe(rt); new MutationObserver(ms => ms.forEach(r => r.removedNodes.forEach(n => { if (n.nodeType === 1 && (n.matches('.ms-card') || n.querySelector('.ms-card'))) rm++; }))).observe(rt, { childList: true, subtree: true }); }
    if (q.get('seen') === '1') mineSet('wlag|t1', 2);   // 家に入ったあと（me が決まってから）覚えさせる
    if (dm) { if (dm === 'panel') $('msTab').click(); else missionDlg(); }
    const pv = q.get('pulls') ? setInterval(() => pullApply(true), 400) : 0;   // pulls=1：開いている間、realtime の更新（pullApply）を何度も受ける
    const iv = setInterval(dm ? dsnap : snap, 100); await wait(+(q.get('hold') || 3500)); clearInterval(iv); clearInterval(pv);
    if (dm) { out.heightChanges = hch; out.cardRemoved = rm; out.rebuilt = rebuilt; out.animRestart = animRestart; out.h = [...new Set(log.map(l => l.split(' | ')[2]))].join(','); out.zero = log.filter(l => /0コマ|0 \/ \d+コマ|0\/0|ありません/.test(l) && !l.includes('sk=0')).length; out.heightsN = new Set(log.map(l => l.split(' | ')[2])).size; }
    out.log = log; out.bad = log.filter(l => l.includes('ありません') || l.includes('いまはなし') || /\b0\/0/.test(l) || /\| 0\/\d人/.test(l)).length; out.heights = [...new Set(log.map(l => l.split(' | ')[2]))].join(',');
  } catch (e) { out.err = String(e && e.stack || e); }
  document.body.dataset.test = JSON.stringify(out);
}
// ?test=svplay : 家具の状態（開け閉め・灯り）がチーミのみんなに同じに見えるか（にせサーバー・2人分の流れ）。?schema=26 で古いサーバーの版
async function svPlayTest(mk) {
  const out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
  try {
    window.__noPin = true; SV.sb = mk.sb; SV.on = true; S = store.defaultState(); noSave = true; screenCtx.loadDemo = null; screenCtx.houseThumb = houseThumb;
    const sc = new URLSearchParams(location.search).get('schema'); if (sc != null) mk.db.schema = +sc; await loadServerInfo(); out.schema = SV.schema;
    await pullApply(true);
    const cr = await svCall('create_me', { p_team: 't1', p_nick: 'ひな', p_me: randomMe(), p_pin: '1234' }); setMyUid(cr.uid);
    mk.db.students[0].approved = true; await pullApply(true);
    const R0 = () => mk.db.teams[0].data.rooms[0], dbRm = R0(); dbRm.items = [{ uid: 901, id: 'lamp', x: 1, y: 1, rot: 0, owner: cr.uid }, { uid: 902, id: 'window', wall: 'R', pos: 2, z: 1.1, owner: cr.uid }]; mk.db.teams[0].version++; await pullApply(true);
    enterAs('t1', cr.uid); await wait(300); sync(); await wait(100);
    const g0 = objs.get(901), on = () => [objs.get(901) && objs.get(901).userData.on, objs.get(902) && objs.get(902).userData.on];
    out.start = on();                                   // 灯り・カーテンとも、はじめは 1
    const cost0 = layoutCost(T.rooms.map(r => ({ w: r.w, d: r.d })), T.rooms.map((r, i) => ({ w: r.w, d: r.d, k: i })), 2, 10), ver0 = mk.db.teams[0].version;
    PLAY.use(901, performance.now() / 1000); PLAY.use(902, performance.now() / 1000); await wait(700);
    out.server1 = R0().items.map(i => i.s);              // 保存された：[0,0]
    out.versionUp = mk.db.teams[0].version === ver0 + 1;   // 続けて2つ押しても、まとめて1回
    out.localOnlyKeysKept = T.rooms[0].items.every(i => i.s === 0);
    // 2人目：サーバー側でだれかが開けた → pull で、家を作り直さずに動く
    R0().items[0].s = 1; delete R0().items[1].s; mk.db.teams[0].version++; const sameGrp = objs.get(901); await pullApply(); await wait(1200);
    out.remote = on(); out.noRebuild = objs.get(901) === sameGrp && objs.get(901) === g0;
    out.layoutSame = roomsKey(T.rooms) === lastKey() && layoutCost(T.rooms.map(r => ({ w: r.w, d: r.d })), T.rooms.map((r, i) => ({ w: r.w, d: r.d, k: i })), 2, 10) === cost0;   // 状態は間取りの比べにも値段にも入らない
    // 見ているだけ：保存しない
    me.watch = true; const v1 = mk.db.teams[0].version; PLAY.use(901, performance.now() / 1000); await wait(500); out.watchNoSave = mk.db.teams[0].version === v1; me.watch = false;
    // 別の人の保存と同時（古い版）：開け閉めだけならつけ直して通す
    mk.db.teams[0].version += 3; PLAY.use(902, performance.now() / 1000); await wait(1800);
    out.conflictRecovered = R0().items[1].s === 0 && T.version === mk.db.teams[0].version;
    // A さんが並べ替えを保存する前に、B さんの開け閉めの保存が先に入る：両方残り、警告も出ない
    const mv = findItem(901); mv.x = 4; save(); delete R0().items[1].s; mk.db.teams[0].version++; await wait(1800);
    out.bothKept = R0().items[0].x === 4 && R0().items[1].s === undefined && T.version === mk.db.teams[0].version && findItem(902).s === undefined && objs.get(902).userData.on === 1;
    out.err = document.querySelector('#toasts') ? document.querySelector('#toasts').innerText : '';
  } catch (e) { out.err = String(e && e.stack || e); }
  document.body.dataset.test = JSON.stringify(out);
}
async function svTest(mk) {
  const out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
  try {
    window.__noPin = true; SV.sb = mk.sb; SV.on = true; S = store.defaultState(); noSave = true; screenCtx.loadDemo = null; screenCtx.houseThumb = houseThumb;
    await pullApply(true);
    const cr = await svCall('create_me', { p_team: 't1', p_nick: 'ひな', p_me: randomMe(), p_pin: '1234' }); out.created = !!(cr && cr.ok); setMyUid(cr.uid);
    await pullApply(true); out.unapprovedShown = !!studentById(cr.uid) && studentById(cr.uid).approved === false;
    mk.db.students[0].approved = true; mk.db.students[0].picos = 20000; await pullApply(true);
    enterAs('t1', cr.uid); await wait(80); out.inHouse = !!T && !!me && me.uid === cr.uid; out.size = N();
    await buy('chair'); out.inv = me.inv.chair; out.picos = me.picos;
    startPlace('chair', 'inv'); moveGhost(...project(new THREE.Vector3(2.5, 0, 2.5))); confirmGhost(); await wait(500);
    out.placed = room().items.length; out.serverItems = mk.db.teams[0].data.rooms[0].items.length; out.version = [T.version, mk.db.teams[0].version]; out.owner = !!room().items[0] && room().items[0].owner === cr.uid; out.invAfter = JSON.stringify(me.inv);
    mk.db.teams[0].data.rooms[0].items[0].x = 0; mk.db.teams[0].version++; await pullApply(); out.remoteX = room().items[0].x;
    mk.db.teams[0].version += 5; mk.db.teams[0].data.rooms[0].name = 'あいて'; T.rooms[0].name = 'へんこう'; save(); await wait(600);   // 同じ部屋の名前を両方がちがう値にした：のせ直せないので警告して最新へ
    out.conflictToast = document.querySelector('#toasts').innerText.includes('同時'); out.roomNameAfterConflict = room().name;
    // 相手が家具を置いた・自分は別の家具を動かした：のせ直して警告なし（両方残る）
    await pullApply(true); const n0 = room().items.length, mvu = room().items[0].uid; mk.db.teams[0].data.rooms[0].items.push({ uid: 7001, id: 'lamp', x: 0, y: 5, rot: 0, owner: me.uid }); mk.db.teams[0].version += 2; await pullApply(true);
    mk.db.teams[0].data.rooms[0].items.push({ uid: 7002, id: 'lamp', x: 1, y: 5, rot: 0, owner: me.uid }); mk.db.teams[0].version += 2; findItem(mvu).x = 5; findItem(mvu).y = 5; document.querySelector('#toasts').innerHTML = ''; save(); await wait(900);
    out.mergedNoToast = !document.querySelector('#toasts').innerText.includes('同時'); out.mergedBoth = findItem(7002) && findItem(mvu).x === 5 && mk.db.teams[0].data.rooms[0].items.some(i => i.uid === mvu && i.x === 5) && T.version === mk.db.teams[0].version; out.mergedCount = [n0, room().items.length];
    const bank0 = mk.db.teams[0].picos; mk.db.students[0].picos = 9000; await pullApply(true);
    const r = await svCall('donate', { p_uid: me.uid, p_pin: '', p_amount: 3000 }); out.donateErrWithoutPin = r && r.err;
    // きせかえ：買う（価格はサーバーの表）→ 持ち物に入る／もう一度は買えない／高すぎれば足りない
    mk.db.students[0].picos = 20000; await pullApply(true);
    const bw = await svCall('buy_wear', { p_uid: me.uid, p_pin: '1234', p_key: 'hat1' }); await pullApply(true);
    out.wearBuy = bw && bw.ok; out.wearOwned = JSON.stringify(studentById(me.uid).wear); out.wearAgain = (await svCall('buy_wear', { p_uid: me.uid, p_pin: '1234', p_key: 'hat1' })).err; out.wearPicos = studentById(me.uid).picos;
    // チーミのあいことば：サーバーで確かめる。覚えた端末は聞かれずに通る／まちがいは弾かれる／5回でロック
    mk.db.teams[0].has_code = true; mk.db.teams[0].mockCode = '4321'; await pullApply(true); const tt = S.teams[0];
    out.hasCode = tt.hasCode; setTeamCode('t1', '4321'); out.authRemembered = await teamAuth(tt);
    out.wrongPass = (await svCall('check_team_pass', { p_team: 't1', p_pass: '1111' })).err; for (let k = 0; k < 4; k++) await svCall('check_team_pass', { p_team: 't1', p_pass: '1111' });
    out.lockedAfter5 = (await svCall('check_team_pass', { p_team: 't1', p_pass: '4321' })).err; setTeamCode('t1', '');
    SV.adminPass = '0000'; out.staffSet = (await adminRpc('admin_set_staff', { p_uid: me.uid, p_staff: true })).ok; await pullApply(true); out.staffNick = nickOf(studentById(me.uid));
    // 担任助手の道具（にせサーバー）：番号を決める・担任助手me-・伝言板
    SV.adminPass = '0000'; adminOn = true;
    out.setPin = !!(await svCall('admin_set_pin', { p_admin: '0000', p_uid: cr.uid, p_pin: '5678' }) || {}).ok; out.pinWorks = !!(await svCall('check_pin', { p_uid: cr.uid, p_pin: '5678' }) || {}).ok;
    const ps = await svCall('admin_pin_status', { p_admin: '0000' }); out.pinStatus = ps && ps.ok && !!ps.status[cr.uid] && ps.status[cr.uid].pin;
    await svCall('admin_staff_save', { p_admin: '0000', p_id: 's1', p_nick: 'たなか', p_me: randomMe() }); await pullApply(true); out.staffMes = (S.staffMes || []).length;
    out.noteAdded = await addNote(T, 'がんばろう'); out.notesFromServer = (S.teams.find(x => x.id === 't1').notes || []).length;
    out.noteBadAdmin = ((await svCall('admin_note_add', { p_admin: '9999', p_team: 't1', p_by: 'x', p_body: 'いたずら' })) || {}).err;
    // 週間ミッション（にせサーバー）：全員そろうまで受け取れない → そろったら1回だけ受け取れる
    await adminRpc('admin_set_staff', { p_uid: cr.uid, p_staff: false }); adminOn = false;
    const c2 = await svCall('create_me', { p_team: 't1', p_nick: 'そら', p_me: randomMe(), p_pin: '1111' }); mk.db.students.forEach(s => { s.approved = true; });
    const td = todayStr(); await pullApply(true); enterAs('t1', cr.uid); await wait(50);
    out.msSave = !!(await svCall('admin_mission_save', { p_admin: '0000', p_id: 'wtest', p_title: 'テスト', p_starts: td, p_ends: td, p_need: 4, p_picos: 5000, p_item: 'trophy' }) || {}).ok;
    await svCall('admin_mission_counts', { p_admin: '0000', p_id: 'wtest', p_entries: { [cr.uid]: 4, [c2.uid]: 2 } }); await pullApply(true);
    const ms = () => (S.missions || []).find(x => x.id === 'wtest');
    out.msLoaded = !!ms(); out.msHalf = ms() && JSON.stringify(ms().teams.t1); out.msCanClaimHalf = canClaim(ms());
    out.msNotYet = ((await svCall('mission_claim', { p_uid: cr.uid, p_id: 'wtest' })) || {}).err;
    await svCall('admin_mission_counts', { p_admin: '0000', p_id: 'wtest', p_entries: { [c2.uid]: 5 } }); await pullApply(true);
    out.msAll = ms() && ms().teams.t1.achieved; out.msCanClaim = canClaim(ms()); out.msBtnNew = $('btnMission').classList.contains('new');
    const p0 = studentById(cr.uid).picos; await claimMission(ms(), () => { });
    out.msPicos = studentById(cr.uid).picos - p0; out.msTrophy = (studentById(cr.uid).inv || {}).trophy | 0; out.msClaimedAfter = canClaim(ms());
    out.msTwice = ((await svCall('mission_claim', { p_uid: cr.uid, p_id: 'wtest' })) || {}).err;
    // ひとりひとりのコマ数（あいことばで確かめて読む）・校舎のお知らせ・開始日
    mk.db.teams[0].has_code = false; const pg = await svCall('mission_progress', { p_id: 'wtest', p_team: 't1', p_pass: '' }); out.progMine = pg && pg.ok && pg.counts[cr.uid];
    mk.db.teams[0].has_code = true; mk.db.teams[0].mockCode = '4321'; out.progBadPass = ((await svCall('mission_progress', { p_id: 'wtest', p_team: 't1', p_pass: '0000' })) || {}).err; mk.db.teams[0].has_code = false;
    await svCall('admin_notice_save', { p_admin: '0000', p_id: null, p_kind: 'event', p_title: 'フェア', p_body: 'あるよ', p_date: '2026-12-12' }); await svCall('admin_set_start_date', { p_admin: '0000', p_date: '2026-12-02' }); await pullApply(true);
    out.noticesFromServer = (S.notices || []).map(n => n.kind + ':' + n.title + ':' + n.date).join(','); out.startDate = S.startDate;
    out.calls = mk.db.calls.map(c => c[0]).join(',');
  } catch (e) { out.err = String(e && e.stack || e); }
  document.body.dataset.test = JSON.stringify(out);
}
// ?test=svslotno : 名前をえらんだあとの「生徒番号」の確認（ちがう番号は断る・合えば承認済みで家へ）。?stop=no で番号の画面で止める（画面確認用）
async function svSlotNoTest(mk) {
  const out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
  const press = async str => { for (const c of str) { window.dispatchEvent(new KeyboardEvent('keydown', { key: c, bubbles: true, cancelable: true })); await wait(30); } await wait(300); };
  const dlgText = () => ($('modal').hidden ? '' : $('dlg').innerText);
  const dlgBtn = txt => [...$('dlg').querySelectorAll('button')].find(x => x.textContent.trim().startsWith(txt));
  const makeMe = async nick => { const n = document.querySelector('.mk-nick'); n.value = nick; n.dispatchEvent(new Event('input')); document.querySelector('.mk-foot .btn.coral').click(); await wait(150); await press('1234'); await press('1234'); await wait(400); };
  const typeNo = async v => { const i = $('dlg').querySelector('input'); i.value = v; i.dispatchEvent(new Event('input')); dlgBtn('つぎへ').click(); await wait(500); };
  try {
    window.__noPin = true; SV.sb = mk.sb; SV.on = true; S = store.defaultState(); noSave = true; screenCtx.loadDemo = null; screenCtx.houseThumb = houseThumb; SV.adminPass = '0000'; setMyUid(null);
    await pullApply(true);
    const a = admLoad(); a.students = ['ヤマダタロウ', 'サトウハナコ'].map((n, i) => ({ uid: 'k' + i, id: String(101 + i), name: n, link: null }));
    a.teams = [{ id: 't1', name: 'ひまわり', members: ['k0', 'k1'] }]; SV.adm = a; await slotsSync(a);
    mk.db.slots[0].no = '12345678';   // ヤマダだけ番号つき。サトウは番号なし（番号を聞かれない）
    createMe('t1'); await wait(200); await makeMe('ひな');
    dlgBtn('ヤマダタロウ').click(); await wait(200); dlgBtn('これです').click(); await wait(500);
    out.A_ask = dlgText().includes('生徒番号');
    if (new URLSearchParams(location.search).get('stop') === 'no') { document.body.dataset.test = 'no'; return; }
    await typeNo('99999999'); out.B_bad = dlgText().includes('ちがいます') && mk.db.students.length === 0 && !mk.db.slots[0].uid;
    await typeNo('１２３４５６７８'); await wait(300); out.C_done = dlgText().includes('できました') && !!mk.db.slots[0].uid && mk.db.students[0].approved;
    dlgBtn('家に入る').click(); await wait(300); leaveTeam(); await wait(100); setMyUid(null);
    createMe('t1'); await wait(200); await makeMe('そら'); dlgBtn('サトウハナコ').click(); await wait(200); dlgBtn('これです').click(); await wait(600);
    out.D_noAsk = !dlgText().includes('生徒番号') && dlgText().includes('できました');
    out.ok = out.A_ask && out.B_bad && out.C_done && out.D_noAsk;
  } catch (e) { out.err = String(e && e.stack || e).slice(0, 300); }
  document.body.dataset.test = JSON.stringify(out);
}
// ?test=svslotstu : にせサーバーで「自分の名前をえらんで me- を作る」生徒側の流れを通す
//   （名前えらび→承認済み／先に取られた名前／名前がない→承認まち／あいことばあり／もどる／古いサーバー／担任助手PCへの自動ひもづけ）
async function svSlotStuTest(mk) {
  const out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
  const press = async str => { for (const c of str) { window.dispatchEvent(new KeyboardEvent('keydown', { key: c, bubbles: true, cancelable: true })); await wait(30); } await wait(300); };
  const dlgText = () => ($('modal').hidden ? '' : $('dlg').innerText);
  const dlgBtn = txt => [...$('dlg').querySelectorAll('button')].find(x => x.textContent.trim().startsWith(txt));
  const makeMe = async nick => { const n = document.querySelector('.mk-nick'); n.value = nick; n.dispatchEvent(new Event('input')); document.querySelector('.mk-foot .btn.coral').click(); await wait(150); await press('1234'); await press('1234'); await wait(400); };
  try {
    window.__noPin = true; SV.sb = mk.sb; SV.on = true; S = store.defaultState(); noSave = true; screenCtx.loadDemo = null; screenCtx.houseThumb = houseThumb; SV.adminPass = '0000'; setMyUid(null);
    mk.db.teams.push({ id: 't2', name: 'あおぞら', n: 3, members: [], confirmed: false, picos: 0, size0: 6, data: {}, version: 0 });
    await pullApply(true);
    const a = admLoad(); a.students = ['ヤマダタロウ', 'サトウハナコ', 'スズキイチロウ'].map((n, i) => ({ uid: 'k' + i, id: String(101 + i), name: n, link: null }));
    a.teams = [{ id: 't1', name: 'ひまわり', members: ['k0', 'k1'] }, { id: 't2', name: 'あおぞら', members: ['k2'] }]; SV.adm = a;
    const r0 = await slotsSync(a); out.sync0 = r0.ok && r0.linked === 0;
    out.slots = JSON.stringify(mk.db.slots.map(x => x.team_id + ':' + x.name));   // 確定している t1 の2人だけ（t2 は未確定なので枠なし）
    out.noNumbers = !JSON.stringify(mk.db.calls.filter(c => c[0] === 'admin_roster_save')).includes('101');
    mk.db.teams[0].has_code = true; mk.db.teams[0].mockCode = '4321'; setTeamCode('t1', '4321');
    // A) 名前をえらぶ → 確認 → 承認済みで家へ
    const stopPick = new URLSearchParams(location.search).get('stop') === 'pick';   // 画面確認用：長い名前も足して、名前えらびの画面で止める
    if (stopPick) ['イシヤマサクラコ', 'ホリウチユウ', 'タニモトユウマ', 'ハタモチコウイチロウ'].forEach((n, i) => mk.db.slots.push({ k: 'x' + i, team_id: 't1', name: n, uid: null }));
    createMe('t1'); await wait(200); await makeMe('ひな');
    if (stopPick) { document.body.dataset.test = 'pick'; return; }
    out.A_pick = dlgText(); out.A_names = out.A_pick.includes('ヤマダタロウ') && out.A_pick.includes('サトウハナコ') && !out.A_pick.includes('スズキイチロウ');
    dlgBtn('ヤマダタロウ').click(); await wait(200); out.A_confirm = dlgText(); dlgBtn('これです').click(); await wait(600);
    out.A_done = dlgText(); const s0 = mk.db.students[0]; out.A_approved = s0.approved && mk.db.slots[0].uid === s0.uid; out.A_noPend = !out.A_done.includes('承認まち');
    dlgBtn('家に入る').click(); await wait(300); out.A_in = !!T && !!me && me.uid === s0.uid;
    // 担任助手PCへ：選ばれた枠の持ち主が名簿の人にひもづく
    const r1 = await slotsSync(a); out.B_linked = r1.linked === 1 && a.students[0].link === s0.uid;
    // 2人目のとき、ヤマダは候補から消える。名前がない→承認まち
    leaveTeam(); await wait(100); setMyUid(null); createMe('t1'); await wait(200); await makeMe('そら');
    out.C_names = dlgText().includes('サトウハナコ') && !dlgText().includes('ヤマダタロウ');
    dlgBtn('名前がない').click(); await wait(600); const s1 = mk.db.students[1]; out.C_pending = !s1.approved && !mk.db.slots.some(x => x.uid === s1.uid);
    dlgBtn('家に入る').click(); await wait(300); leaveTeam();
    // D) 選ぶ前に ほかの人に取られた：エラーを出して、名前えらびをやりなおす
    setMyUid(null); createMe('t1'); await wait(200); await makeMe('ゆう');
    mk.db.slots.find(x => x.name === 'サトウハナコ').uid = 'someone';   // 開いている間に取られた
    dlgBtn('サトウハナコ').click(); await wait(200); dlgBtn('これです').click(); await wait(600);
    out.D_retry = dlgText().includes('承認まち') && !mk.db.students.at(-1).approved; out.D_toast = (document.querySelector('.toast') || {}).textContent;   // 残りの名前がなければ、そのまま承認まちで作られる
    dlgBtn('家に入る').click(); await wait(300); leaveTeam();
    // E) あいことばが違うと名前一覧は返らない
    setTeamCode('t1', ''); const bad = await svCall('team_slots', { p_team: 't1', p_pass: '0000' }); out.E_denied = !!bad && !bad.ok && !bad.slots;
    // F) 古いサーバー：名前えらびは飛ばして、従来どおり承認まち
    mk.db.legacy = true; const lg = await svCall('team_slots', { p_team: 't1', p_pass: '4321' }); out.F_legacy = lg === null || !(lg && lg.ok); mk.db.legacy = false;
    // G) まちがえて選んだ人：はずす → 承認まちにもどる、枠が空く
    const fr = await adminRpc('admin_slot_free', { p_k: 'k0', p_uid: s0.uid }); out.G_free = !!fr; await pullApply(true);
    out.G_state = !mk.db.students[0].approved && !mk.db.slots.some(x => x.uid === s0.uid);
    out.calls = mk.db.calls.map(c => c[0]).filter(n => /slot|roster/.test(n)).join(',');
  } catch (e) { out.err = String(e && e.stack || e); }
  document.body.dataset.test = JSON.stringify(out);
}
// ?test=1 : 自動操作の確認用（配置・選択）。結果を body[data-test] に書く
// 案内・おかえり・お祝いのテスト（保存先は localStorage の kojoHouse.* だけ。サーバーには何も送らない）
function guideTest(mode) {
  const out = {}, fin = () => { document.body.dataset.test = JSON.stringify(out); };
  try {
    window.__seenTest = true; setCoachSeen(false);
    makeDemo(); const st = studentById(S.teams[0].members[0]);
    if (mode === 'welcome') {
      const last = (S.lastScore || {})[st.uid] || 0;
      writeSeen(st.uid, { e: st.earned - 6000, sc: last - .3, st: null, rk: rankIdx(st.earned - 6000) });
      enterAs(S.teams[0].id, st.uid);
      setTimeout(() => {
        out.modal = !$('modal').hidden && !!$('dlg').querySelector('.wb'); out.rows = [...$('dlg').querySelectorAll('.wb-row')].map(r => r.textContent);
        out.title = $('dlg').querySelector('h3') && $('dlg').querySelector('h3').textContent;
        const s2 = readSeen(st.uid); out.saved = !!s2 && s2.e === st.earned;
        if (!out.modal || out.rows.length < 2) out.err = 'welcome';
        [...$('dlg').querySelectorAll('.btn')].find(b => b.textContent === '家へ').click();
        setTimeout(() => {
          out.coach = !!$('coach'); if (!out.coach) out.err = 'coach-after-welcome';
          [...$('coach').querySelectorAll('.btn')].find(b => b.textContent === 'スキップ').click(); out.seen = coachSeen(); if (!out.seen) out.err = 'coachSeen';
          // 増えていなければ出ない
          leaveTeam(); setCoachSeen(true); enterAs(S.teams[0].id, st.uid);
          setTimeout(() => { out.noRepeat = $('modal').hidden; if (!out.noRepeat) out.err = 'repeat'; fin(); }, 1500);
        }, 1500);
      }, 2500);
    } else if (mode === 'gpuset') {   // ふつうの人：設定に「描画」の行がなく、古い保存が消え、試験の記録がなければ WebGPU の部品を読まない（WebGL のまま）
      settingsDlg(); out.row = [...$('dlg').querySelectorAll('.setrow')].some(x => /描画|WebGL|WebGPU/.test(x.textContent)); out.legacy = localStorage.getItem('kojo_gpu') !== null || localStorage.getItem('kojo_gpuauto') !== null;
      out.gpuOn = GPU.on; out.webgpuLoaded = performance.getEntriesByType('resource').some(e => /three\.webgpu|GTAONode|DenoiseNode|SMAANode/.test(e.name));
      if (out.row || out.legacy || out.gpuOn || out.webgpuLoaded) out.err = 'gpuset';
      fin();
    } else if (mode === 'gpusaku') {   // さこの判定：uid の先頭が合うときだけ「描画」の行が出る（ニックネームでは出ない）
      enterAs(S.teams[0].id, st.uid);
      const rowOf = () => { settingsDlg(); const r = [...$('dlg').querySelectorAll('.setrow')].some(x => x.firstChild && x.firstChild.textContent === '描画'); closeModal(); return r; };
      if (new URLSearchParams(location.search).get('shot') === '1') { me.uid = '055efd85-0000'; settingsDlg(); return; }   // 画面確認用：さこの設定を開いたまま
      const u0 = me.uid, n0 = me.nick;
      out.normal = rowOf();                                  // ふつうの人：出ない
      me.nick = 'さこ'; out.nickOnly = rowOf(); me.nick = n0;   // ニックネームだけ似せても出ない
      me.uid = '055efd85-0000'; out.saku = rowOf();          // さこの uid：出る
      settingsDlg(); const bs = [...$('dlg').querySelectorAll('.setrow button')].map(b => b.textContent); out.btns = bs.filter(t => /自動|WebGPU|WebGL/.test(t)).join(','); closeModal();
      me.uid = '055efd8'; out.short = rowOf(); me.uid = u0;   // 1文字足りない：出ない
      if (out.normal || out.nickOnly || !out.saku || out.short || out.btns !== '自動,WebGPU,WebGL') out.err = 'gpusaku';
      fin();
    } else if (mode === 'gputrialreal') {   // 本物の端末で試験を1回流して、記録を見る（確認用。この画面では保存も本物）
      runTrial(true).then(r => { out.rec = r; out.info = GPU.info; out.webkit = isWebKit(); fin(); }, e => { out.err = String(e); fin(); });
    } else if (mode === 'gputrial') {   // 試験のロジック：にせの navigator.gpu で、合格・不合格・失敗を確かめる（本物の保存は消す）
      (async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const stub = (o) => ({ WG: { WebGPUCoordinateSystem: 2, WebGPURenderer: class { constructor() { this.shadowMap = {}; this.backend = { isWebGPUBackend: true, device: { lost: o.lost || new Promise(() => { }), addEventListener() { }, destroy() { }, queue: { onSubmittedWorkDone: () => new Promise(r => setTimeout(r, o.cost || 0)) } } }; } async init() { if (o.initFail) throw new Error('init failed'); } setPixelRatio() { } setSize() { } dispose() { } } } });
        const base = (o) => ({ key: 'test-key', adapter: { limits: { maxTextureDimension2D: 8192 }, info: {} }, gpu: {}, steps: { warm: 1, warmMax: 3, batches: 3, per: 3, gap: 5 }, noGl: o.noGl !== false, loadWebGpu: async () => { if (o.loadFail) throw new Error('load failed'); return stub(o); }, configureRenderer() { }, makePost: () => ({ apply() { }, render() { } }) });
        const clear = () => { try { localStorage.removeItem('kojo_gpurec'); } catch (e) { } };
        try {
          clear();
          out.j1 = judge(5, 6, false).ok && judge(6.5, 6, false).ok && judge(7, 6, false).ok && judge(16.7, 6, false).ok && !judge(17, 6, false).ok && !judge(30, null, false).ok && judge(8, null, false).ok;   // 同じ・速い・16.7ms 以内＝合格、17ms 以上で WebGL より遅い・25ms超＝不合格
          out.j2 = !judge(5.5, 6, true).ok && judge(4.5, 6, true).ok && !judge(7, 6, true).ok;                                               // WebKit は 0.8 倍より速くなければ不合格
          out.j3 = !judge(0, 6, false).ok && !judge(NaN, 6, false).ok;                                              // 測れなければ不合格
          const R = async (o, extra) => { clear(); return runTrial(true, Object.assign(base(o), extra || {})); };
          const pass = await R({ cost: 30 }); out.pass = pass.ok === true && pass.k === 'test-key' && pass.gpuMs >= 0;
          out.saved = (readRec() || {}).ok === true;                                                                // 結果が端末に保存される
          const t0 = performance.now(), again = await runTrial(false, base({ cost: 30 })); out.noRerun = performance.now() - t0 < 50 && again.ok === true;   // 2回目は試験しない（保存を返すだけ）
          clear(); const a0 = TRIAL.away; TRIAL.away = () => true; const aw = await runTrial(false, base({ cost: 5 })); TRIAL.away = a0; out.away = aw.why === 'hidden' && !readRec();   // 家の中（試験してはいけない画面）では、始めても中断して保存しない
          const slow = await R({ cost: 120 }); out.slow = slow.ok === false && /slow/.test(slow.why);               // 遅い（束3枚で120ms＝40ms/フレーム）→ 不合格
          const lf = await R({ loadFail: true }); out.loadFail = lf.ok === false && /load failed/.test(lf.why);     // 部品が読めない → 不合格
          const ini = await R({ initFail: true }); out.initFail = ini.ok === false && /init failed/.test(ini.why);  // 初期化に失敗 → 不合格
          let rej; const lostP = new Promise(r => { rej = r; });
          const lo = R({ lost: lostP, cost: 20 }); setTimeout(() => rej({ reason: 'unknown' }), 5); const lr = await lo; out.lost = lr.ok === false && /lost/.test(lr.why);   // device lost → 不合格
          const sw = await R({ cost: 30 }, { adapter: { isFallbackAdapter: true, limits: {}, info: {} } }); out.software = sw.ok === false && /software/.test(sw.why);   // ソフトウェア描画は使わない
          const na = await R({}, { adapter: null, key: 'test-key' }); out.noAdapter = na.ok === false && /noadapter/.test(na.why);   // adapter が取れない（requestAdapter が null を返す）
          // 使っている途中の失敗 → その端末は WebGL として記録される
          clear(); GPU.key = 'test-key'; GPU.on = true; const fr = gpuFail('test', true); GPU.on = false;
          const rr = readRec(); out.failRec = fr === true && rr && rr.ok === false && rr.k === 'test-key' && sessionStorage.getItem('kojo_gpufb') === '1'; sessionStorage.removeItem('kojo_gpufb');
          // 鍵：GPU やブラウザが変われば別の鍵（記録が合わない＝試験し直し）
          out.key = gpuKey({ info: { vendor: 'a', architecture: 'b', device: 'c', description: 'd' } }) !== gpuKey({ info: { vendor: 'a', architecture: 'b', device: 'c', description: 'e' } });
          // 本物の navigator.gpu で、にせの合格をいれない：ふだんの起動のまま WebGPU の部品を読んでいない
          out.noLoad = !performance.getEntriesByType('resource').some(e => /three\.webgpu|GTAONode/.test(e.name)) || !!window.__kojoGpu;
          clear();
          const bad = Object.keys(out).filter(k => out[k] === false); if (bad.length) out.err = 'gputrial:' + bad.join(',');
        } catch (e) { out.err = String(e && e.stack || e); }
        fin();
      })();
    } else if (mode === 'rankinfo') {   // ?test=rankinfo&e=ためたピコ（既定 20000）&to=bottom（下までスクロール）&keep=1（開いたままにする） : 家の中でランクの名前を押す（Enter）→「ランクのしくみ」。通信しない
      enterAs(S.teams[0].id, st.uid);
      setTimeout(() => {
        const q = new URLSearchParams(location.search); me.earned = +(q.get('e') || 20000); renderHud();
        const rk = $('rank'); out.btn = rk.getAttribute('role') === 'button' && rk.tabIndex === 0;
        rk.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        const d = $('dlg'); out.open = !$('modal').hidden && !!d.querySelector('.rkd'); out.title = d.querySelector('h3') && d.querySelector('h3').textContent;
        out.rows = d.querySelectorAll('.rkd-row').length; out.now = [...d.querySelectorAll('.rkd-row.now b')].map(b => b.textContent).join(); out.done = d.querySelectorAll('.rkd-row.done').length; out.its = d.querySelectorAll('.rkd-its img').length; out.bar = d.querySelector('.rkd-bar span') && d.querySelector('.rkd-bar span').textContent;
        if (!out.btn || !out.open || out.rows !== CFG.RANKS.length || out.now !== CFG.RANKS[curRank()].name || !out.its) out.err = 'rankinfo';
        else if (q.get('keep') === '1') { if (q.get('to') === 'bottom') d.querySelector('.dlg-body').scrollTop = 9999; }
        else { [...d.querySelectorAll('.btn')].find(b => b.textContent === 'とじる').click(); out.closed = $('modal').hidden; if (!out.closed) out.err = 'rankinfo-close'; }
        fin();
      }, 1200);
    } else if (mode === 'unlintro') {   // ?test=unlintro : お試しチーミ（ピコ使い放題）の演出。最初の1回だけ・人ごと・おかえり／案内の前に出る。&at=ms でその時点のコマで止める（画面確認用）
      const T0 = S.teams[0], u2 = studentById(T0.members[1]), key = u => 'kojoHouse.unlSeen.' + u, wait = ms => new Promise(r => setTimeout(r, ms));
      try { localStorage.removeItem(key(st.uid)); localStorage.removeItem(key(u2.uid)); } catch (e) { }
      T0.unlimited = true; enterAs(T0.id, st.uid);
      if (new URLSearchParams(location.search).get('at') != null) return;   // 画面確認用：開いたまま
      (async () => {
        await wait(1500); out.shown = !!$('unlin'); out.coins = document.querySelectorAll('#unlin .unl-c').length; out.text = $('unlin') ? $('unlin').textContent : ''; out.noCoachYet = !$('coach');
        if ($('unlin')) $('unlin').click(); await wait(1500); out.closed = !$('unlin'); out.coach = !!$('coach');
        if ($('coach')) [...$('coach').querySelectorAll('.btn')].find(b => b.textContent === 'スキップ').click();
        leaveTeam(); await wait(300); enterAs(T0.id, st.uid); await wait(1500); out.noRepeat = !$('unlin');
        leaveTeam(); await wait(300); enterAs(T0.id, u2.uid); await wait(1500); out.other = !!$('unlin'); if ($('unlin')) $('unlin').click(); await wait(400);
        leaveTeam(); await wait(300); T0.unlimited = false; try { localStorage.removeItem(key(st.uid)); } catch (e) { } enterAs(T0.id, st.uid); await wait(1500); out.notUnl = !$('unlin');
        if (!out.shown || out.coins < 10 || !/使い放題/.test(out.text) || !out.noCoachYet || !out.closed || !out.coach || !out.noRepeat || !out.other || !out.notUnl) out.err = 'unlintro';
        fin();
      })();
    } else if (mode === 'coach') {
      enterAs(S.teams[0].id, st.uid);
      setTimeout(() => {
        out.coach = !!$('coach'); const steps = [];
        for (let k = 0; k < 6 && $('coach'); k++) { steps.push($('coach').querySelector('.coach-t').textContent); const b = [...$('coach').querySelectorAll('.btn')].find(x => x.textContent === '次へ' || x.textContent === 'はじめる'); b.click(); }
        out.steps = steps; out.closed = !$('coach'); out.seen = coachSeen();
        if (steps.length !== 4 || !out.closed || !out.seen) out.err = 'coach';
        settingsDlg(); const re = [...$('dlg').querySelectorAll('.btn')].find(b => b.textContent === 'もう一度見る'); out.again = !!re;
        if (!re) out.err = 'again'; else { re.click(); setTimeout(() => { out.reopen = !!$('coach'); if (!out.reopen) out.err = 'reopen'; fin(); }, 600); }
      }, 1500);
    } else {
      enterAs(S.teams[0].id, st.uid);
      setTimeout(() => {
        me.earned = 99999999; renderHud(); out.cele = !!$('cele'); out.items = $('cele') ? $('cele').querySelectorAll('.cele-it').length : 0; out.t = $('cele') && $('cele').querySelector('.cele-t').textContent;
        if (!out.cele || !out.items) out.err = 'cele'; fin();
      }, 1200);
    }
  } catch (e) { out.err = String(e && e.message || e); fin(); }
}
// ===== 確認用（特別ピコ・QRプレゼント・ミッションの帯ボタン）：?test=evadm / giftadm / gift / mstab =====
const tick = ms => new Promise(r => setTimeout(r, ms || 0));
const okDlg = async () => { await tick(30); const b = document.querySelector('#dlg .acts .btn.coral'); if (b) b.click(); await tick(60); };
async function newTest(mode) {
  const q = new URLSearchParams(location.search);
  // ?test=evadm&bank=1 : 「特別ピコ」（2人えらんで配る→残高・履歴→元に戻す）。shot=1 は配る前の画面
  if (mode === 'evadm') {
    makeDemo(); renderSelect(); adminPreset({ tab: 'event' }); openAdmin(); const out = {}, t0 = S.teams[0], u0 = t0.members[0], u1 = t0.members[1];
    if (q.get('bank')) { document.querySelectorAll('.ev-mode')[1].click(); await tick(); }
    if (q.get('shot') === '1') { if (!q.get('bank')) document.querySelectorAll('.ev-team')[0].querySelector('.ev-th input').click(); return 'ok'; }
    const p0 = studentById(u0).picos, e0 = studentById(u0).earned, b0 = t0.picos;
    if (q.get('bank')) document.querySelector('.ev-teams .ev-chip input').click();
    else { const ins = document.querySelectorAll('.ev-team')[0].querySelectorAll('.ev-chip input'); ins[0].click(); ins[1].click(); }
    document.querySelector('.ev-foot .btn.coral').click(); await okDlg();
    out.gotPicos = studentById(u0).picos - p0; out.gotEarned = studentById(u0).earned - e0; out.bank = t0.picos - b0;
    out.log = (S.scoreLog[0] || {}).kind; out.rows = document.querySelectorAll('.logrow').length;
    const ub = [...document.querySelectorAll('.adm-pane .btn')].find(b => b.textContent.includes('直前の特別ピコ')); if (ub) { ub.click(); await okDlg(); }
    out.afterUndo = studentById(u0).picos - p0; out.bankAfterUndo = t0.picos - b0;
    return JSON.stringify(out);
  }
  // ?test=giftadm&once=1&big=1 : 「QRプレゼント」（発行→一覧）。each は大きなQRが出たまま
  if (mode === 'giftadm') {
    makeDemo(); renderSelect(); adminPreset({ tab: 'gift', dryPrint: true }); openAdmin(); await tick(30);
    if (q.get('once')) { document.querySelectorAll('.ev-mode')[1].click(); await tick(10); }
    if (q.get('pico')) { document.querySelector('.gf-pico').click(); await tick(10); }
    // gacha=1：ガチャセット（既定の表 100×120・500×40・トロフィー×5・はずれ×35＝200枚）を発行して、カプセル用の紙を作る
    if (q.get('gacha')) {
      document.querySelectorAll('.ev-mode')[2].click(); await tick(10);
      const out = { rows: document.querySelectorAll('.gc-tbl tr').length - 1 };
      if (q.get('make') === '0') return JSON.stringify(out);
      [...document.querySelectorAll('.adm-pane .btn.coral')].find(b => b.textContent.includes('ガチャ')).click(); await tick(30);
      document.querySelector('#dlg .acts .btn.coral').click(); await tick(150);
      const G = S.gifts || [];
      Object.assign(out, { gifts: G.length, sets: new Set(G.map(g => g.set)).size, p100: G.filter(g => g.picos === 100).length, p500: G.filter(g => g.picos === 500).length, troph: G.filter(g => g.item === 'ltd_trophy').length, fish: G.filter(g => g.item === 'ltd_fish').length, caps: document.querySelectorAll('#cardPrint .gc-cell').length, pages: document.querySelectorAll('#cardPrint .gc-page').length, noContent: !document.querySelector('#cardPrint').textContent.includes('ピコ'), setRow: document.querySelectorAll('.gf-set').length, chips: document.querySelectorAll('.gf-set .gf-chip').length });
      return JSON.stringify(out);
    }
    if (q.get('make') !== '0') { const btn = [...document.querySelectorAll('.adm-pane .btn.coral')].find(b => b.textContent.includes('発行')); btn.click(); await tick(80); }
    const out = { gifts: (S.gifts || []).length, picos: (S.gifts || []).map(g => g.picos | 0)[0], rows: document.querySelectorAll('.gf-row').length, bigQr: !!document.querySelector('.gf-big-qr svg'), print: document.querySelectorAll('#cardPrint .gp-card').length };
    if (q.get('big') !== '1') closeModal();
    return JSON.stringify(out);
  }
  // ?test=gift : 生徒がQRプレゼントを受け取る（端末だけ）。2回目は「受け取りずみ」。shot=1 は受け取り画面を出したまま
  if (mode === 'gift') {
    makeDemo(); const t0 = S.teams[0], u0 = t0.members[0]; window.__noPin = true;
    const pz = +q.get('pico') || 0;
    S.gifts = [{ code: 'AB23CD45', item: pz ? '' : q.get('item') || 'ltd_trophy', picos: pz, earned: true, kind: 'each', note: '英語ワークショップ', uses: 0, expires: null, active: true, at: Date.now(), claims: [] }];
    setPendingGift('AB23CD45'); enterAs(t0.id, u0); await tick(1300);
    const out = { dlg: !!document.querySelector('.gift-dlg'), name: (document.querySelector('.gift-name') || {}).textContent };
    if (q.get('shot') === '1') return JSON.stringify(out);
    const p0 = me.picos, e0 = me.earned || 0;
    document.querySelector('#dlg .acts .btn.coral').click(); await tick(80);
    if (pz) { out.gotPicos = me.picos - p0; out.gotEarned = (me.earned || 0) - e0; out.win = !!document.querySelector('.pico-win'); }
    out.inv = me.inv[S.gifts[0].item] | 0; out.pending = pendingGift(); out.tab = tab; out.ltdTile = [...document.querySelectorAll('#tabBody .tile-sz')].some(e => e.textContent.includes('非売品'));
    out.again = (await giftRedeem('AB23CD45', '')).err;
    S.gifts[0].active = false; out.stopped = (await giftPeek('AB23CD45')).err;
    return JSON.stringify(out);
  }
  // ?test=pinsadm&forgot=1 : 担任助手「番号を忘れたとき」（端末だけ）。forgot=1 で「番号を忘れた」の選択画面
  if (mode === 'pinsadm') {
    makeDemo(); S.students.forEach((s, i) => { if (i % 4) s.pin = pinHash('1234', s.uid); else delete s.pin; }); renderSelect(); adminPreset({ tab: 'pins' }); openAdmin(); await tick(30);
    if (q.get('forgot')) { const b = [...document.querySelectorAll('#sheet button')].find(x => x.textContent === '番号を忘れた'); if (b) b.click(); }
    return JSON.stringify({ forgotBtns: [...document.querySelectorAll('#sheet button')].filter(x => x.textContent === '番号を忘れた').length, setBtns: [...document.querySelectorAll('#sheet button')].filter(x => x.textContent === '番号を決める').length, choice: document.querySelectorAll('.pin-forgot .ev-mode').length });
  }
  // ?test=poster&kind=team|person|house&name=real|nick|both&shot=1 : 担任助手「掲示」（印刷プレビュー）。1人を未登録・1人を担任助手にして確かめる
  if (mode === 'poster') {
    makeDemo(); const s0 = S.students[0], s1 = S.students[1]; s1.staff = true; const unreg = S.students[2]; const nm0 = unreg.name; unreg.name = '';
    renderSelect(); adminPreset({ tab: 'poster', dryPrint: true }); openAdmin(); await tick(30);
    const kind = q.get('kind') || 'team', ki = { team: 0, person: 1, house: 2 }[kind]; document.querySelectorAll('.adm-pane .ev-mode')[ki].click(); await tick(10);
    const nmi = { real: 0, nick: 1, both: 2 }[q.get('name') || 'real']; [...document.querySelectorAll('.ps-names .btn')][nmi].click(); await tick(10);
    [...document.querySelectorAll('.adm-pane .btn.coral')].find(b => b.textContent.includes('プレビュー')).click(); await tick(kind === 'house' ? 3000 : 60);
    const pv = document.querySelector('.ps-prev'), txt = pv ? pv.textContent : '';
    const out = { pages: document.querySelectorAll('.ps-prev .ps-page').length, rows: document.querySelectorAll('.ps-prev .ps-tbl tr').length, imgs: [...document.querySelectorAll('.ps-prev img')].filter(i => i.src.length > 1000).length, staffShown: kind === 'person' && txt.includes(s1.name), hasReal: txt.includes(s0.name), hasNick: !!s0.nick && txt.includes(s0.nick), unregNote: txt.includes('未登録'), date: txt.includes('時点') };
    if (q.get('shot') !== '1') { document.querySelector('#dlg .acts .btn.coral').click(); await tick(30); out.printPages = document.querySelectorAll('#cardPrint .ps-page').length; }
    unreg.name = nm0; return JSON.stringify(out);
  }
  // ?test=rosterblk : 担任助手「名簿」に、校舎の「チーミ一覧」形式（ブロック）を貼った状態（名前は架空）
  if (mode === 'rosterblk') {
    makeDemo({ noScore: true }); S.students = []; S.teams = []; renderSelect();
    const txt = ['チーム名	種別	チーム担任助手	人数	生徒番号	学年	氏名	かな', '							', 'あおぞら新高2①	低学年	石井	2名				', '				101	高1	山田太郎	ヤマダタロウ', '				102	新高2	佐藤花子	サトウハナコ', '							', 'ひまわり新高2①	低学年	内海	3名				', '				103	高1	鈴木一郎	スズキイチロウ', '				104	高1	高橋美咲	タカハシミサキ'].join('\n');
    adminPreset({ tab: 'roster', rosterText: txt }); openAdmin(); await tick(30);
    if (q.get('go')) { const b = [...document.querySelectorAll('#sheet button')].find(x => x.textContent.startsWith('追加')); if (b) b.click(); await tick(60); }
    return JSON.stringify({ teams: document.querySelectorAll('.team-row').length, students: S.students.length, teamsMade: S.teams.length, plan: S.teams.map(t => t.plan | 0) });
  }
  // ?test=basesc : 向上得点「基準として記録」→ ピコは入らず前回値だけ → そのあと「累計」は増えた分だけ（端末だけ）
  if (mode === 'basesc') {
    makeDemo({ noScore: true }); S.lastScore = {}; const s0 = S.students[0], s1 = S.students[1], p0 = s0.picos, p1 = s1.picos; renderSelect();
    const clickApply = async () => { const b = [...document.querySelectorAll('#sheet .prev .btn.coral')][0]; if (b) b.click(); for (let i = 0; i < 3; i++) { await tick(40); const ok = document.querySelector('#dlg .acts .btn.coral'); if (ok && !$('modal').hidden) ok.click(); } await tick(60); };
    adminPreset({ tab: 'score', scoreMode: 'base', scoreText: s0.name + '\t30\n' + s1.name + '\t12' }); openAdmin(); await tick(30);
    const out = { baseWarn: !!document.querySelector('#sheet .prev .warnbox'), btn: (document.querySelector('#sheet .prev .btn.coral') || {}).textContent };
    await clickApply();
    out.afterBase = { last0: S.lastScore[s0.uid], picos0: s0.picos - p0, log: (S.scoreLog[0] || {}).mode, label: !!document.querySelector('.lastimp .tag') };
    adminPreset({ tab: 'score', scoreMode: 'cum', scoreText: s0.name + '\t31\n' + s1.name + '\t12\n' + S.students[2].name + '\t4' }); openAdmin(); await tick(30);
    out.noBaseWarn = ((document.querySelector('#sheet .prev .warnbox b') || {}).textContent || '');
    await clickApply();
    out.afterCum = { picos0: s0.picos - p0, picos1: s1.picos - p1 };
    return JSON.stringify(out);
  }
  // ?test=itemgrid&ids=a,b : アイテムの絵を大きく並べる（確認用）
  if (mode === 'itemgrid') {
    document.body.innerHTML = ''; document.body.style.cssText = 'background:#efe6d6;margin:0;display:flex;flex-wrap:wrap;gap:8px;padding:8px;font:14px sans-serif';
    (q.get('ids') || '').split(',').filter(id => ITEM[id]).forEach(id => { const im = new Image(); im.width = 180; im.height = 180; itemIcon(ITEM[id], im); document.body.appendChild(h('div', { style: 'background:#fffaf0;border-radius:8px;padding:6px;text-align:center' }, [im, h('div', { text: ITEM[id].name })])); });
    await tick(1500); return 'ok';
  }
  // ?test=mstab&open=0 : パネルの「ミッション」帯ボタン → パネルにミッション（チーミの達成状況）
  if (mode === 'mstab') {
    makeDemo(); const t0 = S.teams[0], m = S.missions[0], td = todayStr(); m.start = td; m.end = td; enterAs(t0.id, t0.members[0]);
    const out = { shown: !$('msTab').hidden, text: $('msTab').textContent, tabs: $('tabs').children.length };
    if (q.get('open') !== '0') { $('msTab').click(); out.panel = !!$('tabBody').querySelector('.ms-card'); out.chips = $('tabBody').querySelectorAll('.ms-chip').length; out.on = $('msTab').classList.contains('on'); }
    return JSON.stringify(out);
  }
  // ?test=shopscroll : ショップの分類・並び順を押しても、分類の帯の横スクロール位置と一覧の縦スクロール位置が保たれる（再描画で先頭に戻らない）
  if (mode === 'shopscroll') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]); tab = 'shop'; shopCat = 'all'; shopSort = 'def'; chipSc = 0; renderPanel(); await tick(50);
    const out = {}, chips = () => $('tabBody').querySelector('.chips'), c0 = chips(); document.head.appendChild(h('style', { text: '#tabBody .chips{max-width:180px;flex:none}' }));   // 帯が必ず横にあふれる幅に（作り直した帯も）
    out.overflow = c0.scrollWidth > c0.clientWidth + 20;
    c0.scrollLeft = 9999; const before = c0.scrollLeft; out.before = before > 0;
    const ch = [...chips().querySelectorAll('.chip')]; ch[ch.length - 2].click(); await tick(50);   // 右のほうの分類を押す
    const c1 = chips();
    out.chipKept = c1.scrollLeft > 0 && Math.abs(c1.scrollLeft - before) <= 60; out.chipOn = !!c1.querySelector('.chip.on');
    const on = c1.querySelector('.chip.on'), vis = on.offsetLeft >= c1.scrollLeft - 1 && on.offsetLeft + on.offsetWidth <= c1.scrollLeft + c1.clientWidth + 1; out.onVisible = vis;
    shopCat = 'all'; renderPanel(); const tb = $('tabBody'); tb.scrollTop = 120; out.scrollable = tb.scrollTop > 0;
    const sc0 = tb.scrollTop; [...tb.querySelectorAll('.shop-sort .seg')][1].click(); await tick(50);   // 安い順
    out.sortKept = $('tabBody').scrollTop === sc0 && shopSort === 'asc';
    return JSON.stringify(out);
  }
  // ?test=shopltd : ショップの「限定」タブ（プレゼントコードでだけもらえる品）。1つ持っている状態で開く。ガチャのはずれは出ない・値段は出ない・並びかえは出ない・持っていない品は案内が開く（&shot=1 なら案内を開いたまま）
  if (mode === 'shopltd') {
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]); me.inv.ltd_trophy = 1; tab = 'shop'; shopCat = 'ltd'; shopSort = 'def'; renderPanel(); await tick(50);
    const out = {}, tb = $('tabBody'), tiles = [...tb.querySelectorAll('.tile')];
    out.chip = [...tb.querySelectorAll('.chip')].map(c => c.textContent).join(','); out.chipOn = tb.querySelector('.chip.on').textContent === '限定';
    out.tiles = tiles.length; out.noFish = !tiles.some(t => t.getAttribute('aria-label') === '腐った魚'); out.noPrice = !tb.querySelector('.tiles .price'); out.noSort = !tb.querySelector('.shop-sort'); out.note = !!tb.querySelector('.ltd-note');
    out.have = tiles.filter(t => t.textContent.includes('持ってる ×1')).length === 1; out.gift = tiles.filter(t => t.querySelector('.tile-badge').textContent === 'プレゼント').length === tiles.length - 1;
    const no = tiles.find(t => t.querySelector('.tile-badge').textContent === 'プレゼント'); no.click(); await tick(50);
    out.dlg = !$('modal').hidden && $('dlg').textContent.includes('プレゼントコード（QR）でもらえるよ') && [...$('dlg').querySelectorAll('button')].some(b => b.textContent === 'コードを入れる');
    const shot = new URLSearchParams(location.search).get('shot'); if (shot === '2') closeModal();   // shot=1：案内を開いたまま／shot=2：案内を閉じて限定タブのまま
    else if (shot !== '1') { closeModal(); shopCat = 'all'; renderPanel(); out.allNoLtd = ![...$('tabBody').querySelectorAll('.tile')].some(t => t.getAttribute('aria-label') === '金のトロフィー'); }
    return JSON.stringify(out);
  }
  // ?test=corner : 画面の角は一本化（設定に「画面の角」の行はない・html に corner の class がつかない・古い保存値は無視）。同じトーストは置きかえ
  if (mode === 'corner') {
    const out = {}, cl = document.documentElement.classList; try { localStorage.setItem('kojoHouse.corner', 'fill'); } catch (e) { }
    out.noClass = !cl.contains('corner-fill') && !cl.contains('corner-avoid');
    toast('電気を消しました', '', 'light'); toast('電気をつけました', '', 'light'); out.toastOne = $('toasts').children.length === 1 && $('toasts').textContent.includes('つけました');
    makeDemo(); renderSelect(); const g = document.querySelector('.sel-gear'); out.homeGear = !!g; g.click(); await tick(50);
    const rows = () => [...$('dlg').querySelectorAll('.setrow')].map(r => r.firstChild.textContent);
    out.homeRows = rows().join(','); out.homeNoPlay = !rows().includes('あそび方') && !rows().includes('画面の角'); closeModal();
    enterAs(S.teams[0].id, S.teams[0].members[0]); await tick(50); out.houseNoClass = !cl.contains('corner-fill'); settingsDlg(); await tick(50);
    out.houseRows = rows().includes('あそび方') && !rows().includes('画面の角');
    try { localStorage.removeItem('kojoHouse.corner'); } catch (e) { }
    return JSON.stringify(out);
  }
  return null;
}
function runTest(mode) {
  const out = {};
  try {
    if (['evadm', 'giftadm', 'gift', 'mstab', 'itemgrid', 'pinsadm', 'rosterblk', 'basesc', 'poster', 'shopscroll', 'shopltd', 'corner'].includes(mode)) { newTest(mode).then(v => { document.body.dataset.test = v || 'none'; }).catch(e => { document.body.dataset.test = 'ERR ' + e.message; console.error(e); }); return; }
    if (mode === 'flow') { import('../tools/flow_test.js').then(m => m.run({ get S() { return S; }, makeDemo, renderSelect, pinHash, $ })); return; }
    if (['svmembers', 'svsel', 'svgrant', 'svunl', 'svdone', 'svlink', 'svhome', 'svscore', 'svquick', 'svops', 'svops2', 'svdaily', 'svupd', 'svnotice', 'svhub'].includes(mode)) { import('../tools/mock_sb.js').then(m => svView(m.makeMock(), mode)); return; }
    if (['svmembers', 'svsel', 'svgrant', 'svunl', 'svdone', 'svlink', 'svhome', 'svscore', 'svquick', 'svops', 'svops2', 'svdaily', 'svupd', 'svnotice', 'svgacha', 'svgachaadm'].includes(mode)) { import('../tools/mock_sb.js').then(m => svView(m.makeMock(), mode)); return; }
    if (['svmembers', 'svsel', 'svgrant', 'svunl', 'svdone', 'svlink', 'svhome', 'svscore', 'svquick', 'svops', 'svops2', 'svdaily', 'svupd', 'svnotice', 'svgacha', 'svgachaadm', 'svmeyasu', 'svmeyasuhome', 'svmeyasuadm', 'svrt'].includes(mode)) { import('../tools/mock_sb.js').then(m => svView(m.makeMock(), mode)); return; }
    if (mode === 'devpin') { import('../tools/mock_sb.js').then(m => devpinTest(m.makeMock())); return; }
    if (mode === 'mslag') { import('../tools/mock_sb.js').then(m => msLagTest(m.makeMock())); return; }
    if (mode === 'svplay') { import('../tools/mock_sb.js').then(m => svPlayTest(m.makeMock())); return; }
    if (mode === 'sv') { import('../tools/mock_sb.js').then(m => svTest(m.makeMock())); return; }
    if (mode === 'svslotno') { import('../tools/mock_sb.js').then(m => svSlotNoTest(m.makeMock())); return; }
    if (mode === 'svslotstu') { import('../tools/mock_sb.js').then(m => svSlotStuTest(m.makeMock())); return; }
    if (mode === 'svplan') { import('../tools/mock_sb.js').then(m => svPlanTest(m.makeMock())); return; }
    if (mode === 'svseat') { import('../tools/mock_sb.js').then(m => svSeatTest(m.makeMock())); return; }
    if (mode === 'svuid') { import('../tools/mock_sb.js').then(m => svUidTest(m.makeMock())); return; }
    const v = runDemoView(mode); if (v) { document.body.dataset.test = v; return; }
    if (mode === 'welcome' || mode === 'coach' || mode === 'gpuset' || mode === 'gpusaku' || mode === 'gputrial' || mode === 'gputrialreal' || mode === 'celebrate' || mode === 'rankinfo' || mode === 'unlintro') { guideTest(mode); return; }
    makeDemo(); enterAs(S.teams[0].id, S.teams[0].members[0]);
    sync();
    const rm = room(); out.items0 = rm.items.length;
    if (mode === '2') { me.inv.sofa1 = 1; startPlace('sofa1', 'inv'); ghost.x = 1; ghost.y = 1; evalGhost(); out.ghostOk = ghost.ok; out.why = ghost.why; $('bar') && 0; document.body.dataset.test = JSON.stringify(out); return; }
    if (mode === '12' || mode === '13') {   // ?test=12 : 机にいすを寄せた部屋（いすは机の下に半分入る）＋置く途中のいす（十字キー・回す・置く）／?test=13 : 置かずにようすだけ
      rm.items = rm.items.filter(i => !isBig(i)); let u = 900; const put = (id, x, y, r) => rm.items.push({ uid: u++, id, x, y, rot: r || 0 });
      put('dtable', 2, 2); put('dchair', 2.5, 3, 0); put('dchair', 3, 1.5, 2); put('dchair', 1.5, 2, 1); put('desk', 4, 4, 0); put('chair', 4.5, 5, 2); rebuildRoom(); sync();
      if (mode === '12') { me.inv.dchair = 1; startPlace('dchair', 'inv'); ghost.x = 4; ghost.y = 2; evalGhost(); out.ok = ghost.ok; }
      document.body.dataset.test = JSON.stringify(out); return;
    }
    if (mode === '3') { me.inv.frame = 1; startPlace('frame', 'inv'); moveGhost(...project(new THREE.Vector3(0, 2, 2.0))); out.wall = ghost.wall; out.pos = ghost.pos; out.z = ghost.z; out.ok = ghost.ok; document.body.dataset.test = JSON.stringify(out); return; }
    if (mode === '10' || mode === '11') {
      sq(rm, T.size0 || CFG.MIN_SIZE); rm.items = [inst('rug1', 2, 2, 0), inst('bed1', 0, 0, 1), inst('desk', 3, 0, 0), inst('chair', 3, 1, 0), inst('shelf1', 0, 5, 0), inst('plantL', 5, 5, 0), inst('laptop', 3, 0, 0), inst('lamp', 4, 0, 0), inst('sofa1', 2, 4, 0), inst('lowtable', 2, 3, 0), inst('cactus', 0, 5, 0), inst('mug', 2, 3, 0), winst('window', 'L', 2, 1.2), winst('wclock', 'R', 0.5, 2.3), winst('poster', 'R', 4, 1.6)];
      if (mode === '11') sq(rm, Math.min(14, rm.w + 4));   // （旧：増築の再配置。いまは間取り画面で広げる）
      placeAvatars(); rebuildRoom(); sync(); out.items = rm.items.map(i => i.id + '@' + (i.wall ? i.wall + i.pos : i.x + ',' + i.y)); document.body.dataset.test = JSON.stringify(out); return;
    }
    if (mode === '7') { rm.items = []; cam.zoom = 3.6; cam.pany = Number(new URLSearchParams(location.search).get('py') || 0); cam.panx = 0; rebuildRoom(); sync(); document.body.dataset.test = 'ok'; return; }
    if (mode === '8' || mode === '9') {
      sq(rm, mode === '8' ? 14 : (T.size0 || CFG.MIN_SIZE)); rm.items = []; rm.floor = 'fl_birch'; rm.wall = 'wp_gingham'; T.own.floor.push('fl_birch'); T.own.wallpaper.push('wp_gingham');
      const NEW = ITEMS.filter(d => !d.pat && !d.wall && d.cat !== 'rug' && !d.small && !d.ceil && ['bunk', 'loft', 'armchair', 'beanbag', 'dtable', 'dchair', 'rtable', 'counter', 'rack', 'dresser', 'bench', 'stool', 'cubeshelf', 'hammock', 'chabudai', 'speaker', 'heater', 'washer', 'robovac', 'aquarium', 'shelf1', 'tansu', 'sofa1'].includes(d.id));
      let x = 0, y = 0, rowH = 0; const n = N(), tops = [];
      NEW.forEach(d => { const w = d.w, dd = d.d; if (x + w > n) { x = 0; y += rowH + 0; rowH = 0; } if (y + dd > n) return; rm.items.push(inst(d.id, x, y, 0)); if (d.surface) tops.push([x, y]); x += w; rowH = Math.max(rowH, dd); });
      const sm = ['cactus', 'flowerpot', 'hourglass', 'penstand', 'mug', 'catplush', 'boardgame', 'omamori', 'microwave', 'humid'];
      tops.forEach((t, i) => { const d = ITEM[sm[i % sm.length]]; rm.items.push(inst(d.id, t[0], t[1], 0)); });
      if (mode === '9') { rm.items = [inst('shelf2', 1, 1, 0), inst('tansu', 4, 1, 0), inst('dresser', 3, 1, 0), inst('cactus', 1, 1, 0), inst('catplush', 2, 1, 0), inst('flowerpot', 4, 1, 0), inst('mug', 3, 1, 0), inst('rug5', 1, 3, 0), inst('armchair', 4, 4, 0), inst('beanbag', 1, 4, 0)]; [['neon', 'R', 3.2, 2.0], ['timetable', 'L', 1.5, 1.6], ['catcher', 'L', 3.5, 1.3]].forEach(([id, w, p, z]) => rm.items.push(winst(id, w, p, z))); }
      rebuildRoom(); sync(); out.n = rm.items.length; document.body.dataset.test = JSON.stringify(out); return;
    }
    if (mode === '6') {
      sq(rm, Math.min(14, (T.size0 || CFG.MIN_SIZE) + 4)); rm.items = []; rm.floor = 'fl_herring'; rm.wall = 'wp_wainscot'; T.own.floor.push('fl_herring'); T.own.wallpaper.push('wp_wainscot');
      const L = [['fireplace', 2, 0], ['cabinet', 5, 0], ['tvboard', 0, 3, 1], ['sofa2', 3, 4], ['pendant', 3, 3], ['globelight', 4, 5], ['floorlamp', 7, 1], ['rug4', 3, 3], ['kotatsu', 5, 6], ['piano', 0, 6, 1], ['vase', 5, 6], ['teaset', 6, 6], ['pie', 5, 7], ['guitar', 7, 4]];
      L.forEach(([id, x, y, r]) => rm.items.push(inst(id, x, y, r || 0)));
      [['frame', 'R', 5.5, 1.6], ['frame2', 'R', 7, 1.6], ['garland', 'L', 3, 2.6], ['sconce', 'L', 6, 1.8], ['aircon', 'R', 0.5, 2.6]].forEach(([id, w, p, z]) => rm.items.push(winst(id, w, p, z)));
      out.empty = ITEMS.filter(d => !d.pat).filter(d => { try { return !renderThumb(d); } catch (e) { out.terr = d.id + ':' + e.message; return true; } }).map(d => d.id);
      rebuildRoom(); sync(); out.n = rm.items.length; out.lights = lightList.length; document.body.dataset.test = JSON.stringify(out); return;
    }
    me.inv.sofa1 = 1; me.inv.vase = 1; startPlace('sofa1', 'inv');
    const p = project(new THREE.Vector3(2.0, 0, 2.5)); moveGhost(p[0], p[1]); out.gx = ghost.x; out.gy = ghost.y; out.gok = ghost.ok; confirmGhost();
    out.items1 = rm.items.length; sync();
    if (mode === '5') { setSel(rm.items[rm.items.length - 1].uid); document.body.dataset.test = JSON.stringify(out); return; }
    const bed = rm.items.find(i => i.id === 'bed1'), bc = project(new THREE.Vector3(1, .4, 1));
    tap(bc[0], bc[1], 'touch'); out.selId = selItem() && selItem().id;
    const sofa = rm.items[rm.items.length - 1]; const sc = project(new THREE.Vector3(sofa.x + 1, .4, sofa.y + .5)); tap(sc[0], sc[1], 'touch'); out.selId2 = selItem() && selItem().id;
    const f = project(new THREE.Vector3(1.5, 0, 3.5)); tap(f[0], f[1], 'touch'); out.sel3 = selUid; out.walk = AVS.length;
  } catch (e) { out.err = String(e && e.stack || e); }
  document.body.dataset.test = JSON.stringify(out);
}
// WebGPU を使う端末か決めて、使うなら準備してから始める（使わない・使えないは従来の WebGL のまま。読み直し中は止まって待つ）
if (await prepareGpu(cv) === 'reload') await new Promise(() => { });
boot();
TRIAL.away = () => $('app').classList.contains('in-house');   // 家の中（入る途中の幕の下も）は 3D を描いているので、試験はしない
if (!new URLSearchParams(location.search).get('test')) scheduleTrial();   // 初めての端末だけ、起動が落ち着いてから見えない画面で WebGPU を試験（次の起動から使う）
