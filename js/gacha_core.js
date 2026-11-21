// 物理のガチャガチャ（カプセルのコード）の、画面にもテストにも使う小さな部品（DOM なし）。本物の抽選・検査はサーバー（schema.sql の gacha_redeem / admin_gacha_create）。
export const GACHA_CH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // 見まちがえやすい 0 O 1 I L を除く（サーバーの _gacha_new_code と同じ）
export const GACHA_LEN = 6;
export const GACHA_MAX = 1000;     // 1つの束に作れる枚数
export const GACHA_ROWS = 10;      // 当たりの表の行数
export const normCode = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
export const fmtCode = c => { const s = normCode(c); return s.length === GACHA_LEN ? s.slice(0, 3) + '-' + s.slice(3) : s; };
// 当たりの表 [{ picos, pct }] を確かめる。返り値：{ ok, sum, err }（ピコは 1〜1,000,000 の整数、割合は 0 より大きく合計 100%）
export function checkPrizes(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > GACHA_ROWS) return { ok: false, sum: 0, err: '当たりの表は 1〜' + GACHA_ROWS + ' 行です' };
  let sum = 0;
  for (const r of rows) {
    if (!r || !Number.isInteger(r.picos) || r.picos < 1 || r.picos > 1000000) return { ok: false, sum, err: 'ピコは 1〜1,000,000 の整数にしてください' };
    if (!(+r.pct > 0) || +r.pct > 100) return { ok: false, sum, err: '割合は 0 より大きく 100 以下にしてください' };
    sum += +r.pct;
  }
  sum = Math.round(sum * 1000) / 1000;
  return Math.abs(sum - 100) < 0.001 ? { ok: true, sum, err: '' } : { ok: false, sum, err: '割合の合計が ' + sum + '% です（100% にしてください）' };
}
// 抽選：r は [0,1) の乱数。表の順に割合をたし、r×100 が入る行を返す（サーバーも同じ数え方）
export function pickPrize(rows, r) {
  let acc = 0; const x = r * 100;
  for (const p of rows) { acc += +p.pct; if (x < acc) return p; }
  return rows[rows.length - 1];
}
// 演出の段階（サーバーの gacha_redeem の tier と同じ）：1 ふつう／2 当たり（割合30%以下）／3 大当たり（10%以下）。行が1つだけなら 1
export const tierOf = (rows, p) => (rows.length < 2 ? 1 : +p.pct <= 10 ? 3 : +p.pct <= 30 ? 2 : 1);
// 束の状態：'ok'（使える）／'end'（期限切れ）／'off'（取り消し）。today は 'YYYY-MM-DD'
export const batchState = (b, today) => (!b.active ? 'off' : (b.expires && b.expires < today ? 'end' : 'ok'));
