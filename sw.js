// 向上ハウスの Service Worker：校舎の不安定な Wi-Fi でも、画面が開くようにするための「落ちたとき用の保険」。
// ・ネットが良いときは、いつもネット優先で最新の版を取る（ナビゲーション＝index.html は network-first＋タイムアウト）。キャッシュは落ちたときだけ使う
// ・?v= 付きの js/css と CDN の固定バージョンの部品は、中身が変わらないので cache-first
// ・Supabase（*.supabase.co の REST・RPC・Edge Function）は一切さわらない（素通し。Realtime の WebSocket は SW を通らない）
// ・キャッシュに入れるのは js/offline.js（安定した回線のときだけ少しずつ）と、使ったときの取りこぼし。index.html は「全部そろった印」として最後に js/offline.js が入れる
// ・版（V）は tools/stamp.js が書きかえる（version.txt・?v= と同じ値）。版が変わると新しいキャッシュを作り、そろったら古いキャッシュを消す（そろうまで今の版は動き続ける）
//   そろうまでは、途中の版のキャッシュも少し残す（js/offline.js が、変わらない部品をそこから写して、取り直さない）。自分より新しいキャッシュは消さない
'use strict';
const V = '202611280844';
const PREFIX = 'kojo-', CACHE = PREFIX + V;
const NAV_TIMEOUT = 4000;   // ナビゲーションがこれより遅いときは、キャッシュがあればそちらを先に出す
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'greggman.github.io'];
const SCOPE = typeof self !== 'undefined' && self.registration ? self.registration.scope : 'http://localhost/';

// どう扱うか：'skip'（さわらない）/ 'nav' / 'immutable'（cache-first）/ 'asset'（今の版のキャッシュ→ネット→古い版）
function classify(urlStr, method, mode, scope) {
  if (method !== 'GET') return 'skip';
  let u; try { u = new URL(urlStr); } catch (e) { return 'skip'; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'skip';
  const sc = new URL(scope || SCOPE);
  if (u.origin !== sc.origin) return CDN_HOSTS.includes(u.hostname) ? 'immutable' : 'skip';   // supabase.co などの他のサーバーはすべて素通し
  if (!u.pathname.startsWith(sc.pathname)) return 'skip';
  const rel = u.pathname.slice(sc.pathname.length);
  if (rel === 'version.txt' || rel === 'assets.json' || rel === 'sw.js') return 'skip';   // いつも最新を見る必要があるもの
  if (u.searchParams.has('dl')) return 'skip';   // js/offline.js が、版の中身を取り直すとき（?dl=ハッシュ）。古い控えを返さず、ここにも入れない
  if (mode === 'navigate' || rel === '' || rel === 'index.html') return 'nav';
  return /^\d{8,14}$/.test(u.searchParams.get('v') || '') ? 'immutable' : 'asset';
}
const sortedNames = async () => (await caches.keys()).filter(n => n.startsWith(PREFIX)).sort().reverse();   // 新しい版が先
// 「そろった」キャッシュ＝index.html が入っているもの（js/offline.js が最後に入れる）
const isComplete = async name => !!(await (await caches.open(name)).match(SCOPE + 'index.html'));
async function findIndex() {
  for (const n of [CACHE, ...(await sortedNames()).filter(x => x !== CACHE)]) { const r = await (await caches.open(n)).match(SCOPE + 'index.html'); if (r) return r; }
  return null;
}
const KEEP_PARTIAL = 2;   // 今の版がそろうまで残す、途中の古い版のキャッシュの数
// 古いキャッシュを消す。
// ・自分（この Service Worker の版）より新しいキャッシュは消さない（開いたままの画面が、先に新しい版を取りこんでいることがある。消すと、また最初からになる）
// ・今の版がそろっていなければ、そろっている中でいちばん新しい古い版と、それより新しい途中の版（KEEP_PARTIAL こまで）を残す
// ・今の版がそろったら、古い版は全部消す
async function prune() {
  const names = await sortedNames(), keep = new Set([CACHE, ...names.filter(n => n > CACHE)]);
  if (!(await isComplete(CACHE))) {
    let part = 0;
    for (const n of names) {
      if (n >= CACHE) continue;
      if (await isComplete(n)) { keep.add(n); break; }
      if (part < KEEP_PARTIAL && (await (await caches.open(n)).keys()).length) { keep.add(n); part++; }
    }
  }
  await Promise.all(names.filter(n => !keep.has(n)).map(n => caches.delete(n)));
}
const putOk = (req, res) => { if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) return caches.open(CACHE).then(c => c.put(req, res.clone())).catch(() => { }); };   // 容量いっぱいなどは黙って無視
async function navHandler(req) {
  const net = fetch(req).catch(() => null);
  const first = await Promise.race([net, new Promise(r => setTimeout(() => r(null), NAV_TIMEOUT))]);
  if (first && first.ok) return first;
  const c = await findIndex(); if (c) return c;
  return first || (await net) || Response.error();
}
async function immutableHandler(req, ev) {
  const hit = await caches.match(req, { ignoreVary: true }); if (hit) return hit;
  try { const res = await fetch(req); ev.waitUntil(putOk(req, res) || Promise.resolve()); return res; } catch (e) { return Response.error(); }
}
async function assetHandler(req, ev) {
  const own = await (await caches.open(CACHE)).match(req, { ignoreVary: true }); if (own) return own;
  try { const res = await fetch(req); ev.waitUntil(putOk(req, res) || Promise.resolve()); return res; }
  catch (e) { const any = await caches.match(req, { ignoreVary: true }); return any || Response.error(); }
}
if (typeof self !== 'undefined' && self.addEventListener) {
  self.addEventListener('install', ev => { ev.waitUntil(self.skipWaiting()); });   // ここでは何も取らない（先読みは js/offline.js が安定した回線で行う）。URL に ?v= があるので、版が混ざっても取り違えない
  self.addEventListener('activate', ev => { ev.waitUntil(Promise.all([prune(), self.clients.claim()])); });
  self.addEventListener('message', ev => { const t = ev.data && ev.data.type; if (t === 'prune' || t === 'prune2') ev.waitUntil(prune()); });   // 'prune'＝前の版の画面／'prune2'＝いまの画面
  self.addEventListener('fetch', ev => {
    const req = ev.request, k = classify(req.url, req.method, req.mode, SCOPE);
    if (k === 'skip') return;
    ev.respondWith(k === 'nav' ? navHandler(req) : k === 'immutable' ? immutableHandler(req, ev) : assetHandler(req, ev));
  });
}
if (typeof module !== 'undefined') module.exports = { classify, V, CACHE, PREFIX, CDN_HOSTS };   // node のテスト用（ブラウザの SW には module が無いので何も起きない）
