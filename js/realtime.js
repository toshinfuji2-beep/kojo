// リアルタイムモード：同じ家を開いている仲間の「いる」と「いまの位置」を、Supabase Realtime の Presence と Broadcast で受け渡す
// ・新しいデータベースは使わない（保存もしない）。送るのは uid・位置・向き・動いているか・部屋の番号だけ（本名・番号・PIN は送らない）
// ・位置は「動いているときだけ」1秒に6回まで。止まっている間は3秒ごとの小さな生存通知だけ。タブが隠れたら抜ける（main.js が join/leave を呼ぶ）
// ・つながらない・切れたときは、画面に何も出さず、少し待って自動でつなぎ直す（失敗しても今までどおり動く）
const KEY = 'kojoHouse.realtime';
export const rtPref = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch (e) { return true; } };   // 既定はオン
export const rtSetPref = on => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { } };
export const RT_GAP = 160, RT_BEAT = 3000;   // 動いているときの最小の間隔(ms)・止まっているときの生存通知の間隔(ms)
const num = (v, lim) => typeof v === 'number' && isFinite(v) && Math.abs(v) < lim;
// 受け取った中身を確かめる（ほかの端末からの値は信用しない）。ふつうでなければ null
function clean(o) {
  if (!o || typeof o !== 'object' || typeof o.u !== 'string' || !o.u || o.u.length > 64 || !num(o.x, 300) || !num(o.y, 300) || !num(o.r, 20)) return null;
  return { u: o.u, x: o.x, y: o.y, r: o.r, m: o.m ? 1 : 0, k: num(o.k, 100) ? o.k | 0 : 0 };
}
const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
// h.onPeer(pose)：仲間の位置が届いた／h.onPresence(uids, poses)：いまいる人（自分も含む）が変わった／h.onChange({u, v})：仲間が家を変えた（保存できた）合図。v は家の版
export function createRealtime(h) {
  const R = { tid: null, uid: null, ready: false, sent: 0, got: 0, uids: [] };
  let sb = null, ch = null, gen = 0, retry = 0, rtimer = 0, last = null, lastAt = 0, trackAt = 0;
  const q = (f, ...a) => { try { return f && f(...a); } catch (e) { } };
  function open() {
    clearTimeout(rtimer); if (!sb || !R.tid || !R.uid) return;
    const my = ++gen, uid = R.uid; let c;
    try {
      c = sb.channel('house:' + R.tid, { config: { broadcast: { self: false }, presence: { key: uid } } });
      c.on('broadcast', { event: 'p' }, m => { const p = clean(m && m.payload); if (p && p.u !== uid && my === gen) { R.got++; q(h.onPeer, p); } });
      c.on('broadcast', { event: 'c' }, m => { const o = m && m.payload; if (o && typeof o.u === 'string' && o.u.length <= 64 && o.u !== uid && num(o.v, 1e12) && my === gen) q(h.onChange, { u: o.u, v: o.v }); });   // 「変わったよ」：受けた側がすぐ取り直す（postgres_changes を待たない）
      c.on('presence', { event: 'sync' }, () => {
        if (my !== gen) return; let st = {}; try { st = c.presenceState() || {}; } catch (e) { }
        const uids = Object.keys(st).filter(k => k.length <= 64), poses = [];
        uids.forEach(k => { const ms = st[k], m = Array.isArray(ms) ? ms[ms.length - 1] : null, p = m && clean(Object.assign({ u: k }, m)); if (p && k !== uid) poses.push(p); });
        R.uids = uids; q(h.onPresence, uids, poses);
      });
      c.subscribe(s => {
        if (my !== gen) return;
        if (s === 'SUBSCRIBED') { R.ready = true; retry = 0; last = null; track(null); }
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') { R.ready = false; clearTimeout(rtimer); rtimer = setTimeout(() => { if (my === gen) { drop(); open(); } }, Math.min(30000, 3000 * Math.pow(2, retry++))); }   // 自動でつなぎ直す（待ちを少しずつ長く）
      });
      ch = c;
    } catch (e) { ch = null; R.ready = false; rtimer = setTimeout(() => { if (my === gen) open(); }, Math.min(30000, 3000 * Math.pow(2, retry++))); }
  }
  function drop() { const c = ch; ch = null; R.ready = false; if (c && sb) { try { sb.removeChannel(c); } catch (e) { } } }
  // 自分の「いる」（と、いまの位置）を Presence に載せる。あとから入った人は、これで最初の位置を合わせる
  function track(p) { if (!ch || !R.ready) return; trackAt = performance.now(); const v = p || last || {}; try { ch.track(v.x == null ? { t: 1 } : { x: v.x, y: v.y, r: v.r, k: v.k }); } catch (e) { } }
  R.join = (client, tid, uid) => { if (R.tid === tid && R.uid === uid && sb === client) return; R.leave(); sb = client; R.tid = tid; R.uid = uid; retry = 0; open(); };
  R.leave = () => { gen++; clearTimeout(rtimer); drop(); const had = R.tid != null; R.tid = R.uid = null; sb = null; last = null; R.uids = []; if (had) q(h.onPresence, [], []); };
  // 自分のアバターの位置（毎フレーム呼んでよい。送るかどうかはここで決める）：p = { x, y, r, m(動いているか), k(部屋の番号) }
  R.send = (p, now) => {
    if (!ch || !R.ready) return false; now = now == null ? performance.now() : now;
    const x = Math.round(p.x * 100) / 100, y = Math.round(p.y * 100) / 100, r = Math.round(wrap(p.r) * 100) / 100, m = p.m ? 1 : 0, k = p.k | 0, gap = now - lastAt;
    const moved = !last || Math.hypot(x - last.x, y - last.y) > .04 || Math.abs(wrap(r - last.r)) > .08 || m !== last.m || k !== last.k;
    if (!(moved ? gap >= RT_GAP : gap >= RT_BEAT)) return false;
    const was = last; last = { x, y, r, m, k }; lastAt = now;
    try { ch.send({ type: 'broadcast', event: 'p', payload: { u: R.uid, x, y, r, m, k } }); R.sent++; } catch (e) { return false; }
    if (was && was.m && !m && now - trackAt > 2000) track(last);   // 止まったとき、いまの位置を Presence にも置く
    return true;
  };
  // 家の保存ができた直後に「変わったよ」を知らせる（版 v だけ。中身はサーバーから取り直す）。送るのは保存のたびなので、少ない
  R.ping = v => { if (!ch || !R.ready || !num(v, 1e12)) return false; try { ch.send({ type: 'broadcast', event: 'c', payload: { u: R.uid, v } }); R.sent++; return true; } catch (e) { return false; } };
  return R;
}
