// 物理のガチャガチャ（校舎に置くカプセル）：担任助手の「物理ガチャ」タブと、生徒がカプセルのコードを開ける画面。
// 紙には金額を書かない。中身（ピコ）は、使った瞬間にサーバーが束の「当たりの表」から抽選する（schema.sql の gacha_redeem）。
// コードはサーバーにハッシュで保存され、平文は作った瞬間に1回だけ返る（あとから見られない）。
import { h, fmt, modal, closeModal, confirmDlg, toast, iconNode } from './ui.js?v=202611211556';
import { SV, schemaAtLeast, NEED_UPDATE, errText } from './server.js?v=202611211556';
import { qrSvg } from './qr.js?v=202611211556';
import { busyBtn, loadHint } from './loading.js?v=202611211556';
import { STUDENT_URL } from './vault.js?v=202611211556';
import { confetti, flyCoins, motionOK } from './guide.js?v=202611211556';
import { checkPrizes, normCode, fmtCode, batchState, GACHA_MAX, GACHA_ROWS } from './gacha_core.js?v=202611211556';

export const GACHA_SCHEMA = 25;   // サーバーがこの版以上のときだけ使える
const PER_PAGE = 40;              // A4 に 4列×10段
export const gachaUrl = code => STUDENT_URL + '?gift=' + normCode(code);   // 今ある「プレゼントコード」の入口をそのまま使う（どちらの種類かはサーバーが判定）
const pad = n => String(n).padStart(2, '0');
const jstDate = ms => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);   // 日本時間の日付 YYYY-MM-DD
const addDays = (ymd, n) => { const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const stamp = ms => { const d = new Date(ms + 9 * 3600e3); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); };
const STATE = { ok: ['ok', '使える'], end: ['warn', '期限切れ'], off: ['ng', '取り消し'] };

// 画面の状態（束を作るフォーム・一覧・記録）
export const GA = { name: '', count: 200, days: 30, perDay: 1, earned: true, prizes: [{ picos: 100, pct: 70 }, { picos: 500, pct: 25 }, { picos: 3000, pct: 5 }], list: null, loading: false, log: null, logBatch: null, fresh: null };
const tag = (cls, text) => h('span', { cls: 'tag ' + cls, text });

async function loadList(ctx) {
  GA.loading = true; const r = await ctx.rpcA('admin_gacha_list', {}); GA.loading = false; GA.list = r ? r.batches || [] : [];
}
async function loadLog(ctx) {
  const r = await ctx.rpcA('admin_gacha_log', { p_batch: GA.logBatch, p_limit: 200 }); GA.log = r ? r.log || [] : [];
}

export function gachaTab(pane, ctx) {
  const { paint, A } = ctx, again = () => { if (A.tab === 'gacha') paint(); };
  pane.appendChild(h('p', { cls: 'hint', text: '校舎のガチャガチャに入れる、カプセル用のコード（QR＋6文字）を作ります。紙に金額は書かず、生徒が使った瞬間にサーバーが当たりの表から抽選します。1つのコードは1回だけ使えます。' }));
  if (!SV.on) { pane.appendChild(h('div', { cls: 'hint', text: 'この機能はサーバー版でだけ使えます（端末だけのモードでは作れません）。' })); return; }
  if (!schemaAtLeast(GACHA_SCHEMA)) { pane.appendChild(h('div', { cls: 'hint', text: NEED_UPDATE + '。更新するまでガチャは使えません（今までの機能は使えます）。' })); return; }
  if (GA.list == null && !GA.loading) loadList(ctx).then(again);

  // いま作った束：コードの平文はここにしか無い。印刷するまで画面を閉じない
  if (GA.fresh) {
    pane.appendChild(h('div', { cls: 'card ga-fresh' }, [
      h('b', { text: '「' + (GA.fresh.name || '名前なし') + '」のコードを ' + GA.fresh.codes.length + ' 枚 作りました' }),
      h('span', { cls: 'hint', text: 'コードは、この画面でしか見られません（サーバーにはハッシュだけ残ります）。印刷してから閉じてください。画面を再読み込みすると消えます。' }),
      h('div', { cls: 'acts-row' }, [
        h('button', { cls: 'btn coral', text: '印刷する（A4に40枚）', onclick: () => printCodes(ctx, GA.fresh.codes) }),
        h('button', { cls: 'btn sm', text: '印刷した（閉じる）', onclick: async () => { if (await confirmDlg('閉じると、このコードはもう見られません。印刷できましたか？', '閉じる')) { GA.fresh = null; paint(); } } })
      ])
    ]));
  }

  // 1) 束を作る
  pane.appendChild(h('div', { cls: 'sec', text: '1. コードの束を作る' }));
  const name = h('input', { type: 'text', maxlength: '40', placeholder: '束の名前（例：12月 ガチャ1号機）', cls: 'ev-note', 'aria-label': '束の名前' }); name.value = GA.name; name.oninput = () => { GA.name = name.value; };
  const cnt = h('input', { type: 'number', min: '1', max: String(GACHA_MAX), cls: 'ev-amt', 'aria-label': '枚数', inputmode: 'numeric' }); cnt.value = String(GA.count); cnt.oninput = () => { GA.count = Math.floor(+cnt.value || 0); };
  const days = h('input', { type: 'number', min: '1', max: '365', cls: 'ev-amt', 'aria-label': '期限（日）', inputmode: 'numeric' }); days.value = String(GA.days); days.oninput = () => { GA.days = Math.floor(+days.value || 0); };
  const per = h('input', { type: 'number', min: '1', max: '10', cls: 'ev-amt', 'aria-label': '1日の回数', inputmode: 'numeric' }); per.value = String(GA.perDay); per.oninput = () => { GA.perDay = Math.floor(+per.value || 0); };
  const ern = h('label', { cls: 'chk' }), ec = h('input', { type: 'checkbox' }); ec.checked = GA.earned; ec.onchange = () => { GA.earned = ec.checked; }; ern.appendChild(ec); ern.appendChild(h('span', { text: '当たったピコをランキング・ランクにも数える（ふつうはオン）' }));
  // 当たりの表
  const tbl = h('table', { cls: 'tbl ga-tbl' }), sumEl = h('div', { cls: 'stats' });
  const paintSum = () => { const s = Math.round(GA.prizes.reduce((a, r) => a + (+r.pct || 0), 0) * 1000) / 1000, ck = checkPrizes(GA.prizes); sumEl.innerHTML = ''; sumEl.appendChild(tag(ck.ok ? 'ok' : 'ng', '割合の合計 ' + s + '%' + (ck.ok ? '' : '（100% にしてください）'))); };
  tbl.appendChild(h('tr', {}, ['当たり（ピコ）', '割合（%）', ''].map(t => h('th', { text: t }))));
  GA.prizes.forEach((r, i) => {
    const pv = h('input', { type: 'number', min: '1', max: '1000000', step: '100', cls: 'ev-amt sm', 'aria-label': 'ピコ', inputmode: 'numeric' }); pv.value = String(r.picos); pv.oninput = () => { r.picos = Math.floor(+pv.value || 0); paintSum(); };
    const pp = h('input', { type: 'number', min: '0.1', max: '100', step: '0.1', cls: 'ev-amt sm', 'aria-label': '割合', inputmode: 'decimal' }); pp.value = String(r.pct); pp.oninput = () => { r.pct = +pp.value || 0; paintSum(); };
    tbl.appendChild(h('tr', {}, [h('td', {}, [pv, h('span', { text: ' ピコ' })]), h('td', {}, [pp, h('span', { text: ' %' })]), h('td', {}, [GA.prizes.length > 1 ? h('button', { cls: 'btn sm', text: '行を消す', onclick: () => { GA.prizes.splice(i, 1); paint(); } }) : null])]));
  });
  pane.appendChild(h('div', { cls: 'tbl-wrap' }, [tbl]));
  pane.appendChild(h('div', { cls: 'acts-row' }, [GA.prizes.length < GACHA_ROWS ? h('button', { cls: 'btn sm', text: '＋ 行を足す', onclick: () => { GA.prizes.push({ picos: 1000, pct: 1 }); paint(); } }) : null]));
  paintSum(); pane.appendChild(sumEl);
  pane.appendChild(h('div', { cls: 'card ev-form' }, [
    h('div', { cls: 'ev-row' }, [h('span', { cls: 'ev-k', text: '束の名前' }), name]),
    h('div', { cls: 'ev-row' }, [h('span', { cls: 'ev-k', text: '枚数' }), cnt, h('span', { text: '枚（' + GACHA_MAX + '枚まで）' })]),
    h('div', { cls: 'ev-row' }, [h('span', { cls: 'ev-k', text: '期限' }), days, h('span', { text: '日あとまで使える' })]),
    h('div', { cls: 'ev-row' }, [h('span', { cls: 'ev-k', text: '1日の回数' }), per, h('span', { text: '回まで（1人・日本時間・この束で）' })]),
    ern,
    h('div', { cls: 'acts-row' }, [h('button', { cls: 'btn coral', text: 'コードを作る', onclick: () => create(ctx) })])
  ]));

  // 2) 束の一覧
  pane.appendChild(h('div', { cls: 'sec', text: '2. 作った束' }));
  pane.appendChild(h('div', { cls: 'acts-row' }, [h('button', { cls: 'btn sm', text: '一覧を更新', onclick: () => { GA.list = null; paint(); } })]));
  if (GA.list == null) { pane.appendChild(loadHint()); }
  else if (!GA.list.length) { pane.appendChild(h('div', { cls: 'hint', text: 'まだありません' })); }
  else {
    const today = jstDate(Date.now()), box = h('div', { cls: 'gf-list' }); pane.appendChild(box);
    GA.list.forEach(b => {
      const st = batchState(b, today), [tc, tt] = STATE[st];
      box.appendChild(h('div', { cls: 'gf-row ga-row' + (st === 'ok' ? '' : ' off') }, [
        h('span', { cls: 'gf-coin', style: 'font-size:30px' }, [iconNode('capsule', 30)]),
        h('div', { cls: 'gf-main' }, [
          h('b', { text: b.name || '（名前なし）' }),
          h('span', { text: stamp(b.at) + ' 作成・' + b.n + '枚・使われた ' + b.used + '／' + b.n + '・期限 ' + b.expires + '・1日' + b.per_day + '回' + (b.earned ? '' : '・累計に数えない') + (b.by ? '・' + b.by : '') }),
          h('div', { cls: 'gf-break' }, (b.prizes || []).map(p => h('span', { cls: 'gf-chip', text: fmt(p.picos) + 'ピコ ' + p.pct + '%' })))
        ]),
        tag(tc, tt),
        h('button', { cls: 'btn sm', text: '記録', onclick: async () => { GA.logBatch = b.id; await loadLog(ctx); paint(); } }),
        st === 'off' ? null : h('button', { cls: 'btn sm', text: '取り消す', onclick: () => revoke(ctx, b) })
      ]));
    });
  }

  // 3) 使われた記録
  pane.appendChild(h('div', { cls: 'sec', text: '3. 使われた記録' }));
  const bn = GA.logBatch == null ? 'すべての束' : '「' + ((GA.list || []).find(x => x.id === GA.logBatch) || {}).name + '」';
  pane.appendChild(h('div', { cls: 'acts-row' }, [
    h('span', { cls: 'hint', text: bn + '（新しい順・最大200件。ニックネームだけで本名は出ません）' }),
    h('button', { cls: 'btn sm', text: GA.log == null ? '読みこむ' : '更新', onclick: e => busyBtn(e.currentTarget, async () => { await loadLog(ctx); const ok = GA.log != null; paint(); return ok; }) }),
    GA.logBatch != null ? h('button', { cls: 'btn sm', text: 'すべて', onclick: async () => { GA.logBatch = null; await loadLog(ctx); paint(); } }) : null
  ]));
  if (GA.log != null) {
    if (!GA.log.length) pane.appendChild(h('div', { cls: 'hint', text: 'まだ使われていません' }));
    else {
      const t = h('table', { cls: 'tbl ga-log' }); t.appendChild(h('tr', {}, ['いつ', 'だれ', 'ピコ', '束'].map(x => h('th', { text: x }))));
      GA.log.forEach(r => t.appendChild(h('tr', {}, [h('td', { text: stamp(r.at) }), h('td', { cls: 'nm', text: r.nick || '（ニックネームなし）' }), h('td', { cls: 'n strong', text: fmt(r.picos) }), h('td', { cls: 'nm', text: r.batch_name || '' })])));
      pane.appendChild(h('div', { cls: 'tbl-wrap' }, [t]));
    }
  }
}

async function create(ctx) {
  const ck = checkPrizes(GA.prizes); if (!ck.ok) { toast(ck.err, 'ng'); return; }
  const n = GA.count | 0, d = GA.days | 0, per = GA.perDay | 0;
  if (n < 1 || n > GACHA_MAX) { toast('枚数は 1〜' + GACHA_MAX + ' にしてください', 'ng'); return; }
  if (d < 1 || d > 365) { toast('期限は 1〜365 日にしてください', 'ng'); return; }
  if (per < 1 || per > 10) { toast('1日の回数は 1〜10 にしてください', 'ng'); return; }
  if (!await confirmDlg(n + '枚のコードを作ります（期限 ' + d + '日・1日' + per + '回）。作ったコードは、この画面でしか見られません。', '作る', '束を作る')) return;
  const r = await ctx.rpcA('admin_gacha_create', { p_name: GA.name.trim(), p_count: n, p_prizes: GA.prizes.map(p => ({ picos: p.picos, pct: +p.pct })), p_per_day: per, p_expires: addDays(jstDate(Date.now()), d), p_earned: !!GA.earned });
  if (!r) return;
  GA.fresh = { id: r.batch, name: GA.name.trim(), codes: r.codes || [] }; GA.list = null; GA.log = null;
  ctx.paint(); printCodes(ctx, GA.fresh.codes);
}

async function revoke(ctx, b) {
  if (!await confirmDlg('「' + (b.name || '名前なし') + '」の、まだ使われていないコード（' + (b.n - b.used) + '枚）を使えなくします。使われた記録は残ります。', '取り消す', '束を取り消す')) return;
  const r = await ctx.rpcA('admin_gacha_revoke', { p_batch: b.id }); if (!r) return;
  toast('取り消しました（使えなくなったコード ' + r.unused + '枚）', 'ok'); GA.list = null; ctx.paint();
}

// 印刷：A4 に 4列×10段＝40枚。QR（2cm角）と6文字のコード、点線の切り取り線。中身は書かない
export function printCodes(ctx, codes) {
  if (!codes || !codes.length) { toast('印刷できるコードがありません', 'ng'); return; }
  const pages = [];
  for (let i = 0; i < codes.length; i += PER_PAGE) {
    const pg = h('div', { cls: 'gk-page' });
    codes.slice(i, i + PER_PAGE).forEach(c => { const qr = h('span', { cls: 'gk-qr', 'aria-hidden': 'true' }); qr.innerHTML = qrSvg(gachaUrl(c)); pg.appendChild(h('div', { cls: 'gk-cell' }, [qr, h('div', { cls: 'gk-r' }, [h('b', { cls: 'gk-t', text: '向上ハウス' }), h('span', { cls: 'gk-s', text: 'ガチャ' }), h('span', { cls: 'gk-code', text: fmtCode(c) })])])); });
    pages.push(pg);
  }
  ctx.printRoot(pages);
}

// ===== 生徒：カプセルを開ける =====
// env = { nick, getPin(), redeem(code, pin), dropPin(), clear()（覚えたコードを消す）, refresh()（サーバーの値を取りなおす）, onWin(picos)（ピコ表示の更新）, sfx(kind)（効果音。音オフの設定は呼ぶ側が守る）, coinTo（コインが飛んでいく先の要素） }
// 開く演出：画面が暗くなる → カプセルが落ちてはずむ → タップ（または自動）で揺れて光がもれる → 上下にパカッ → 光の柱と粒・数字が0から数え上がる。
// 当たりの段階（サーバーの tier）：1 ふつう（白〜金の光）／2 当たり（虹色の光・紙吹雪）／3 大当たり（フラッシュ・光の輪・画面ゆれ・紙吹雪・特別な音）。開く前はどの段階も同じ見た目。
// 動きは transform / opacity が中心。「動きを減らす」設定のときは、短いフェードと数字だけ。
const CAP_SVG = '<svg viewBox="0 0 160 190" width="100%" height="100%" aria-hidden="true"><defs>' +
  '<radialGradient id="gxT" cx="34%" cy="26%" r="85%"><stop offset="0" stop-color="#ffc2b6"/><stop offset=".42" stop-color="#f2564a"/><stop offset="1" stop-color="#a82822"/></radialGradient>' +
  '<radialGradient id="gxB" cx="34%" cy="72%" r="85%"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#eee5d4"/><stop offset="1" stop-color="#a99d88"/></radialGradient></defs>' +
  '<ellipse class="gx-shadow" cx="80" cy="172" rx="52" ry="9" fill="#000" fill-opacity=".38"/>' +
  '<g class="gx-bot"><path d="M20 92 A60 60 0 0 0 140 92 Z" fill="url(#gxB)"/><path d="M34 112 Q50 142 82 148" stroke="#fff" stroke-opacity=".55" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M20 92 A60 60 0 0 0 140 92" stroke="#000" stroke-opacity=".12" stroke-width="2" fill="none"/></g>' +
  '<g class="gx-top"><path d="M20 88 A60 60 0 0 1 140 88 Z" fill="url(#gxT)"/><path d="M36 72 Q40 46 70 34" stroke="#fff" stroke-opacity=".85" stroke-width="8" fill="none" stroke-linecap="round"/><circle cx="86" cy="30" r="3.6" fill="#fff" fill-opacity=".85"/><path d="M20 88 A60 60 0 0 1 140 88" stroke="#000" stroke-opacity=".15" stroke-width="2" fill="none"/></g>' +
  '<rect class="gx-band" x="17" y="86" width="126" height="8" rx="4" fill="#d9cdb6" stroke="#000" stroke-opacity=".12"/></svg>';
const capMini = () => { const e = h('div', { cls: 'gx-mini', 'aria-hidden': 'true' }); e.innerHTML = CAP_SVG.replace(/id="gx([TB])"/g, 'id="gm$1"').replace(/url\(#gx([TB])\)/g, 'url(#gm$1)'); return e; };

export async function gachaDlg(code, env) {
  code = normCode(code); if (!code) return;
  const body = h('div', { cls: 'ga-dlg' }, [capMini(), h('b', { cls: 'ga-ttl', text: 'ガチャのカプセルだ！' }), h('p', { cls: 'hint', text: '開けると、ピコがもらえるよ（中身は開けてのお楽しみ）。' + env.nick + ' さんのピコに入ります。4けたの番号で確かめます。' })]);
  modal('ガチャ', body, [
    h('button', { cls: 'btn', text: 'あとで', onclick: closeModal }),
    h('button', { cls: 'btn coral', text: '開ける', onclick: async () => {
      closeModal(); const pin = await env.getPin(); if (pin === null) return;
      const r = await env.redeem(code, pin);
      if (!r || !r.ok) { if (r) { if (r.err === 'pin' || r.err === 'locked') env.dropPin(); else env.clear(); toast(errText(r.err), 'ng'); } return; }
      env.clear(); await env.refresh(); showReveal(r, env);
    } })
  ], 'gift');
}

const TIER_TXT = { 1: 'ピコゲット！', 2: '当たり！', 3: '大当たり！！' };
// 開く演出（返り値：画面を片づける関数。テスト用）
export function showReveal(r, env) {
  const old = document.getElementById('gxFx'); if (old) old.remove();
  const tier = r.tier === 3 ? 3 : r.tier === 2 ? 2 : 1, calm = !motionOK(), sfx = k => { try { if (env.sfx) env.sfx(k); } catch (e) { } };
  const cap = h('div', { cls: 'gx-cap' }), prize = h('b', { cls: 'gx-num', text: '+0' }), parts = h('div', { cls: 'gx-parts', 'aria-hidden': 'true' });
  cap.innerHTML = CAP_SVG; cap.appendChild(h('i', { cls: 'gx-leak' }));
  const hint = h('div', { cls: 'gx-hint', text: 'タップして開けよう！' });
  const btn = h('button', { cls: 'btn coral gx-close', text: 'とじる' });
  const world = h('div', { cls: 'gx-world' }, [h('i', { cls: 'gx-rays' }), h('i', { cls: 'gx-pillar' }), h('i', { cls: 'gx-ring' }), h('i', { cls: 'gx-ring r2' }), h('i', { cls: 'gx-ring r3' }), parts, cap,
    h('div', { cls: 'gx-res', role: 'status' }, [h('span', { cls: 'gx-tier', text: TIER_TXT[tier] }), prize, h('span', { cls: 'gx-sub', text: 'ピコが ' + env.nick + ' さんに入ったよ' })])]);
  const root = h('div', { id: 'gxFx', cls: 'gx t' + tier + (calm ? ' calm' : ''), role: 'dialog', 'aria-label': 'ガチャのカプセル' }, [h('i', { cls: 'gx-bg' }), world, h('i', { cls: 'gx-flash' }), hint, btn]);
  document.body.appendChild(root);
  let opened = false, closed = false, timers = [];
  const later = (f, ms) => { timers.push(setTimeout(f, ms)); };
  const close = () => { if (closed) return; closed = true; timers.forEach(clearTimeout); document.removeEventListener('keydown', onKey, true); root.classList.add('out'); setTimeout(() => root.remove(), calm ? 0 : 260); };
  const onKey = e => { if (e.key === 'Escape' && !e.isComposing) { e.preventDefault(); e.stopPropagation(); if (opened) close(); else start(); } };
  document.addEventListener('keydown', onKey, true);
  btn.onclick = e => { e.stopPropagation(); close(); };

  const count = (ms, then) => {   // 0 から当たりの数まで数え上がる
    const t0 = performance.now(), total = r.picos | 0; let last = -1;
    const step = t => { if (closed) return; const k = Math.min(1, (t - t0) / ms), v = Math.round(total * (1 - Math.pow(1 - k, 3))); if (v !== last) { last = v; prize.textContent = '+' + fmt(v); } if (k < 1) next(); else then(); };
    const next = () => { let f = false; const go = () => { if (f) return; f = true; step(performance.now()); }; requestAnimationFrame(go); setTimeout(go, 60); };   // 裏のタブなどで rAF が止まっても、数字は最後まで進む
    next();
  };
  const burst = () => {   // 中からあふれる光の粒
    const cols = tier === 1 ? ['#fff6c8', '#ffe27a', '#ffd04a', '#fff'] : ['#ff6b6b', '#ffd93d', '#6bff95', '#4dd8ff', '#b36bff', '#fff'], n = 14 + tier * 8;
    for (let k = 0; k < n; k++) {
      const p = h('i'), a = Math.random() * Math.PI * 2, d = 90 + Math.random() * (110 + tier * 50), s = 4 + Math.random() * 6;
      p.style.cssText = 'width:' + s + 'px;height:' + s + 'px;background:' + cols[k % cols.length] + ';box-shadow:0 0 ' + (s * 2) + 'px ' + cols[k % cols.length];
      parts.appendChild(p);
      if (p.animate) p.animate([{ transform: 'translate(0,0) scale(.4)', opacity: 1 }, { transform: 'translate(' + Math.cos(a) * d + 'px,' + (Math.sin(a) * d - 40) + 'px) scale(1)', opacity: 1, offset: .55 }, { transform: 'translate(' + Math.cos(a) * d * 1.15 + 'px,' + (Math.sin(a) * d * 1.15 + 60) + 'px) scale(.2)', opacity: 0 }], { duration: 900 + Math.random() * 700, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'forwards' });
    }
  };
  const doOpen = () => {
    if (closed) return; root.classList.remove('shake'); root.classList.add('open'); sfx('gx_open');
    if (env.onWin) env.onWin(r.picos);
    burst();
    if (tier === 3 && world.animate) world.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-9px,5px)' }, { transform: 'translate(8px,-6px)' }, { transform: 'translate(-6px,-4px)' }, { transform: 'translate(5px,4px)' }, { transform: 'translate(0,0)' }], { duration: 560, easing: 'ease-out' });
    if (tier >= 2) { confetti(tier === 3 ? 90 : 44); if (tier === 3) later(() => confetti(60), 650); }
    try { if (env.coinTo) flyCoins(cap.getBoundingClientRect(), env.coinTo, 5 + tier * 3); } catch (e) { }
    later(() => sfx('gx_win' + tier), 260);
    later(() => count(tier === 3 ? 1500 : 1100, () => { root.classList.add('done'); }), 250);
  };
  const start = () => {   // カタカタ揺れて、光がもれて、パカッ
    if (opened) return; opened = true; timers.forEach(clearTimeout); timers = [];
    root.classList.add('shake'); hint.classList.add('off');
    [0, 170, 340, 510, 680].forEach(ms => later(() => sfx('gx_shake'), ms));
    if (env.hold !== 'shake') later(doOpen, 980);   // env.hold は画面確認用（途中で止める）
  };
  if (calm) {   // 動きを減らす：カプセルなし。数字だけをすぐ出す
    opened = true; root.classList.add('open', 'done'); hint.classList.add('off'); prize.textContent = '+' + fmt(r.picos); if (env.onWin) env.onWin(r.picos); sfx('gx_win1'); return close;
  }
  root.addEventListener('click', () => { if (!opened) start(); });
  sfx('gx_drop');   // 落ちてきて はずむ
  later(() => sfx('gx_drop'), 520);
  if (env.hold !== 'drop') later(start, 3000);   // タップされなくても自動で開く
  return close;
}
