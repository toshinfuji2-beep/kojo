// 庭を歩く判定：家のまわりの庭（outside.js が置く芝の島・木・植え込み・花・柵・街灯）を、「もうひとつの部屋」として歩けるようにする。
// 庭のマスも、今いる部屋のマス目の座標のまま（部屋の左奥の角が 0,0。庭は負の値や部屋の外の値になる）。歩く表（grid）は、部屋＋庭をひとつにした長方形。
// 部屋と庭をつなぐのは、いま見ている部屋の「玄関」（data.js の entranceOf）の外の1列だけ。ほかの部屋・家のかべぎわ（1マス）・島の外・置いたもの・柵はふさぐ。
// 玄関のない部屋（玄関はどれか1部屋）では庭へは出られない（yardGrid が null）。保存データ（rooms など）は変えない。位置はクライアントだけの状態。
import { roomAt, houseBox, entranceOf } from './data.js?v=202611211556';

export const GARDEN_Y = -.34;   // 庭の地面の高さ（outside.js の OUT_GY と同じ）。部屋の床は 0

// rooms = 間取り、cur = いま見ている部屋、y = outside.js の outYard()（庭を置いた箱・島の余白 M と角の丸み R・置いたもの・柵・門）
// 返り値 { ox, oy, w, d, g, door:{x0,x1,y} }：マス (cx,cy)（部屋の座標）の表の位置は (cy-oy)*w + (cx-ox)。g[...] = 1 ならふさがれ（歩けない）。
// 部屋のなかのマスは 0（家具は呼ぶ側が足す）。庭に出られないときは null
export function yardGrid(rooms, cur, y) {
  const cr = rooms[cur]; if (!cr || !y || !y.box || !y.obs) return null;
  const box = houseBox(rooms), b = y.box;
  if (b.x0 !== box.x0 || b.z0 !== box.z0 || b.x1 !== box.x1 || b.z1 !== box.z1) return null;   // 庭がまだ今の間取りで置かれていない
  const ent = entranceOf(rooms); if (!ent || ent.k !== cur) return null;
  const M = y.M, R = y.R, ox = box.x0 - M - cr.x, oy = box.z0 - M - cr.z, w = box.w + 2 * M, d = box.d + 2 * M;
  const g = new Uint8Array(w * d).fill(1), sf = new Uint8Array(w * d);   // sf = 低い植え込み・花だけでふさがれたマス（門までの道がふさがれたときだけ、通れるようにあける）
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2, hx = w / 2, hz = d / 2;
  // 島の内側か（縁から s だけ内側。outside.js の inIsland と同じ式）
  const inIsland = (x, z, s) => { const qx = Math.abs(x - cx) - (hx - R), qz = Math.abs(z - cz) - (hz - R); return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - R < -s; };
  // 玄関のドアは、開いた戸が西のはしらにあるので、通れるのは東がわの1列（x1-1）だけ。入口の外の1マスと、戸の前の1マス（西どなりの1つ奥）で通りぬけをさだめる
  const fz = cr.z + cr.d, door = { x0: ent.x1 - 1, x1: ent.x1, y: cr.d };
  const rects = y.fences.map(([x0, z0, x1, z1]) => [Math.min(x0, x1) - .12, Math.min(z0, z1) - .12, Math.max(x0, x1) + .12, Math.max(z0, z1) + .12]);
  for (let iy = 0; iy < d; iy++) for (let ix = 0; ix < w; ix++) {
    const wx = cr.x + ox + ix, wz = cr.z + oy + iy;   // マスの左奥の角（世界のマス）
    if (wx >= cr.x && wx < cr.x + cr.w && wz >= cr.z && wz < cr.z + cr.d) { g[iy * w + ix] = 0; continue; }   // 今の部屋の中
    if (roomAt(rooms, wx, wz) >= 0) continue;   // ほかの部屋
    const isDoor = wz === fz && wx === cr.x + door.x0;   // 玄関の外の1マス
    if (wz === fz + 1 && wx === cr.x + door.x0 - 1) continue;   // 開いた戸の前
    let ring = false;
    for (let dx = -1; dx <= 1 && !ring; dx++) for (let dz = -1; dz <= 1; dz++) if (roomAt(rooms, wx + dx, wz + dz) >= 0) { ring = true; break; }   // 家のかべぎわ（かべを通り抜けない）
    if (ring && !isDoor) continue;
    if (!inIsland(wx, wz, .3) || !inIsland(wx + 1, wz, .3) || !inIsland(wx, wz + 1, .3) || !inIsland(wx + 1, wz + 1, .3)) continue;   // 島のふち
    let hit = false, soft = true;   // soft = ふさいでいるのが、低い植え込み・花だけ（木・街灯・柱・柵ではない）
    // マスの中心から見て、置いたものの半径 c の中にあるマスだけふさぐ（庭がせまいので、少しでもかかるマスまではふさがない）。柵は、マスの中心から 0.45 以内の線だけ
    for (const o of y.obs) if (Math.hypot(o.x - (wx + .5), o.z - (wz + .5)) < (o.c == null ? o.r * .5 : o.c)) { hit = true; if (o.k !== 'bush' && o.k !== 'flower') { soft = false; break; } }
    if (!hit || soft) for (const f of rects) if (f[0] < wx + .95 && wx + .05 < f[2] && f[1] < wz + .95 && wz + .05 < f[3]) { hit = true; soft = false; break; }
    if (!hit) g[iy * w + ix] = 0; else if (soft) sf[iy * w + ix] = 1;
  }
  // 柵の門：門の中心のマスは必ずあける（柱のふちにかかっても、門は通れるように）
  for (const [gx, gz] of y.gates || []) {
    const wx = Math.floor(gx), wz = Math.floor(gz), ix = wx - cr.x - ox, iy = wz - cr.z - oy;
    if (ix >= 0 && iy >= 0 && ix < w && iy < d && roomAt(rooms, wx, wz) < 0 && inIsland(wx + .5, wz + .5, .3)) g[iy * w + ix] = 0;
  }
  // 玄関の外の1マスから各門まで歩いて行けないとき（家と柵のあいだの1マス幅の通路に、植え込み・花が植わっている）は、
  // 植え込み・花のマスを数がいちばん少ない道だけあける（通路が植え込みでふさがって、柵の外の庭へ出られなくなるのを防ぐ）
  const si = (fz - cr.z - oy) * w + (cr.x + door.x0 - cr.x - ox);
  if (g[si] === 0) {
    const cost = new Float32Array(w * d).fill(1e9), prev = new Int32Array(w * d).fill(-1), done = new Uint8Array(w * d), open = [si];
    const ok = i => g[i] === 0 || sf[i] === 1;
    cost[si] = 0;
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (cost[open[i]] < cost[open[bi]]) bi = i;
      const c = open[bi]; open[bi] = open[open.length - 1]; open.pop(); if (done[c]) continue; done[c] = 1;
      const x = c % w, yy = (c / w) | 0;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue; const nx = x + dx, ny = yy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= d) continue;
        const n = ny * w + nx; if (done[n] || !ok(n) || (dx && dy && (!ok(yy * w + nx) || !ok(ny * w + x)))) continue;
        const nc = cost[c] + (dx && dy ? 1.4142 : 1) + (sf[n] ? 8 : 0); if (nc < cost[n]) { cost[n] = nc; prev[n] = c; open.push(n); }
      }
    }
    for (const [gx, gz] of y.gates || []) {
      const ix = Math.floor(gx) - cr.x - ox, iy = Math.floor(gz) - cr.z - oy; if (ix < 0 || iy < 0 || ix >= w || iy >= d) continue;
      for (let c = iy * w + ix; c >= 0 && c !== si && done[c]; c = prev[c]) if (sf[c]) { g[c] = 0; sf[c] = 0; }
    }
  }
  return { ox, oy, w, d, g, door };
}

// 地面の高さ（部屋の床 0 → 庭の地面 GARDEN_Y）。ge = yardGrid の結果、rm = 今の部屋（w,d）。玄関の外では1マスぶんかけて、なめらかに下る
export function groundY(ge, rm, x, y) {
  if (!ge || (x >= 0 && x <= rm.w && y >= 0 && y <= rm.d)) return 0;
  const dr = ge.door;
  if (y > rm.d && x > dr.x0 - .6 && x < dr.x1 + .6) { const d = y - rm.d, st = (e, w) => { const t = Math.max(0, Math.min(1, (d - e + w) / (2 * w))); return t * t * (3 - 2 * t); }; return .02 + (-.19) * st(.66, .07) + (GARDEN_Y + .17) * st(1.08, .07); }   // 玄関の外の石の2段（scene.js：上の面 .02 → -.17 → 地面）に合わせて、1段ずつ下りる
  return GARDEN_Y;
}
