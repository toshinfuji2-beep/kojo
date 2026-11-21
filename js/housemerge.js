// 家の保存がぶつかったときの「3方向マージ」（純関数。画面にも通信にも触らない）。
// base = 直前に保存できた状態、mine = 自分の今の家、theirs = サーバーの最新。
// 自分の変更（base→mine）だけを、家具の uid ごとに theirs へのせ直す。安全に合成できないときは null（呼び出し側は今までどおり警告して最新へ戻す）。
//   ・自分が置いた（base になく mine にある）：theirs に同じ uid があれば不可、なければ追加
//   ・自分がしまった／売った（base にあり mine にない）：theirs が変えていなければ消す。theirs がもう消している・動かしている場合は不可（持ち物の二重の増減を防ぐ）
//   ・自分が動かした・回した（形が変わった）：theirs が同じ家具を変えていなければ採用。同じ形に変えているだけならそのまま。ちがえば不可
//   ・家具の状態 s：ps（自分が変えた uid の表）にある家具だけ自分の s、ほかは theirs の s
//   ・部屋の数・間取り（x,z,w,d）が3つで同じでなければ不可。部屋のほかの項目（名前・壁・床など）は、自分だけが変えたなら自分の、相手だけなら相手の、両方がちがう値なら不可
//   ・合成後に fits(部屋, 家具) で配置を検査する。自分由来の家具、または「theirs では置けていたのに合成後に置けなくなった」家具があれば不可
const canon = v => (v && typeof v === 'object') ? (Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}') : JSON.stringify(v);
const gkey = (it, ri) => canon(Object.assign({}, it, { s: undefined })) + '@' + ri;
const clone = v => JSON.parse(JSON.stringify(v));
function index(rooms) {
  const m = new Map();
  for (let ri = 0; ri < rooms.length; ri++) for (const it of rooms[ri].items) { const u = String(it.uid); if (m.has(u)) return null; m.set(u, { it, ri }); }
  return m;
}
export function mergeRooms(base, mine, theirs, ps, fits) {
  try {
    if (![base, mine, theirs].every(a => Array.isArray(a) && a.length === theirs.length && a.every(r => r && Array.isArray(r.items)))) return null;
    const out = theirs.map(clone);
    for (let ri = 0; ri < theirs.length; ri++) {
      const b = base[ri], m = mine[ri], t = theirs[ri];
      for (const k of ['x', 'z', 'w', 'd']) if (canon(b[k]) !== canon(m[k]) || canon(b[k]) !== canon(t[k])) return null;
      const keys = new Set([...Object.keys(b), ...Object.keys(m), ...Object.keys(t)]); keys.delete('items');
      for (const k of keys) {
        const bv = canon(b[k]), mv = canon(m[k]), tv = canon(t[k]);
        if (mv === bv || mv === tv) continue;   // 自分は変えていない（相手のまま）／同じ値にしただけ
        if (tv !== bv) return null;             // 両方がちがう値に変えた
        if (m[k] === undefined) delete out[ri][k]; else out[ri][k] = clone(m[k]);
      }
    }
    const B = index(base), M = index(mine), T = index(theirs); if (!B || !M || !T) return null;
    const dec = new Map(), mineSrc = new Set(), sMap = ps || {};
    for (const u of new Set([...B.keys(), ...M.keys(), ...T.keys()])) {
      const b = B.get(u), m = M.get(u), t = T.get(u);
      if (!b) { if (m && t) return null; if (m) { dec.set(u, { it: clone(m.it), ri: m.ri }); mineSrc.add(u); } else dec.set(u, { it: clone(t.it), ri: t.ri }); continue; }
      const bk = gkey(b.it, b.ri);
      if (!m) { if (!t || gkey(t.it, t.ri) !== bk) return null; continue; }   // 自分がしまった・売った
      const changed = gkey(m.it, m.ri) !== bk;
      if (!t) { if (changed) return null; continue; }                          // 相手がしまった・売った（自分は形を変えていない）
      const tk = gkey(t.it, t.ri), mk = gkey(m.it, m.ri);
      let src = t;
      if (changed && tk !== mk) { if (tk !== bk) return null; src = m; mineSrc.add(u); }
      const it = clone(src.it), sFrom = (u in sMap) ? m.it : t.it;
      if (sFrom.s === undefined) delete it.s; else it.s = sFrom.s;
      dec.set(u, { it, ri: src.ri });
    }
    const placed = new Set(); out.forEach(r => { r.items = []; });
    theirs.forEach(r => r.items.forEach(i => { const u = String(i.uid), d = dec.get(u); if (d) { out[d.ri].items.push(d.it); placed.add(u); } }));
    mine.forEach(r => r.items.forEach(i => { const u = String(i.uid), d = dec.get(u); if (d && !placed.has(u)) { out[d.ri].items.push(d.it); placed.add(u); } }));
    const noS = its => canon(its.map(i => Object.assign({}, i, { s: undefined })));
    for (let ri = 0; ri < out.length; ri++) {
      const rm = out[ri]; if (rm.items.length > 400) return null;
      if (noS(rm.items) === noS(theirs[ri].items)) continue;   // 相手と同じ並び：検査の必要なし
      for (const it of rm.items) {
        if (fits(rm, it)) continue;
        if (mineSrc.has(String(it.uid))) return null;
        const ti = theirs[ri].items.find(x => String(x.uid) === String(it.uid));
        if (ti && fits(theirs[ri], ti)) return null;   // 相手の家では置けていたのに、合成で置けなくなった
      }
    }
    return out;
  } catch (e) { return null; }
}
