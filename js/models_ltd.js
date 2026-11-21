// 非売品（QRプレゼント・ミッションの報酬）の3Dモデル。ふつうの品と見分けられるよう、金色・特別な飾りつき（オリジナル造形）
// はずれ品（腐った魚）もここ
import { THREE, M, MW, MM, MT, MF, MG, MGLASS, G, box, rbox, cyl, sph, cone, lathe, add, torus, plane, halo, lightAt } from './mk.js?v=202611211556';
import { puffy } from './soft.js?v=202611211556';
import { texOf } from './textures.js?v=202611211556';

const gold = () => MM(0xf3c33a, .18), gold2 = () => MM(0xd9a21f, .3);
// 星（押し出し）
function star(r, depth, mat) {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * .45 : r; i ? sh.lineTo(Math.cos(a) * rr, -Math.sin(a) * rr) : sh.moveTo(Math.cos(a) * rr, -Math.sin(a) * rr); }
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: depth * .3, bevelSize: depth * .3, bevelSegments: 2 }), mat);
  m.geometry.center(); m.castShadow = true; return m;
}
// 金のトロフィー：大きめのカップ＋てっぺんの星＋台の金のプレート
export function build_ltdtrophy(d) {
  const g = G(), au = gold();
  add(g, rbox(.36, .08, .26, .02, MW('#3a2010'), 0, 0, 0), rbox(.3, .06, .2, .02, MW('#4a2a14'), 0, .08, 0), box(.16, .04, .005, gold2(), 0, .04, .132));
  add(g, cyl(.035, .06, .12, au, 0, .14, 0, 16), lathe([[0, 0], [.07, .02], [.12, .1], [.19, .26], [.22, .4], [.205, .42], [.16, .3], [.03, .08]], au, 0, .26, 0, 28));
  [-1, 1].forEach(s => { const t = torus(.085, .014, au, s * .22, .55, 0); t.scale.set(.75, 1, 1); add(g, t); });
  const st = star(.08, .025, au); st.position.set(0, .8, 0); add(g, st, cyl(.012, .012, .08, au, 0, .68, 0, 8));
  return g;
}
// 金の合格だるま：金色の体・白い顔・赤いまゆ
export function build_ltddaruma(d) {
  const g = G(), au = gold(), face = M('#fff8e6', { roughness: .4 }), ink = M('#2a2220');
  add(g, sph(.27, au, 0, .3, 0, 1.1), sph(.17, face, 0, .36, .17, .85));
  [-1, 1].forEach(s => add(g, sph(.03, ink, s * .07, .38, .33), box(.12, .025, .02, M('#c0392b'), s * .07, .43, .32)));
  add(g, box(.1, .012, .02, ink, 0, .28, .33), box(.22, .02, .02, M('#c0392b'), 0, .15, .26).rotateX(.3));
  const st = star(.05, .015, M('#c0392b')); st.position.set(0, .22, .26); add(g, st);
  return g;
}
// 金の地球儀：金の球に海と陸のしま模様の帯、金の台と輪
export function build_ltdglobe(d) {
  const g = G(), au = gold(), sea = MM(0xfff1b8, .25);
  add(g, cyl(.14, .17, .05, au, 0, 0, 0, 24), cyl(.02, .025, .14, au, 0, .05, 0, 10));
  const ball = sph(.2, sea, 0, .42, 0); ball.geometry = new THREE.SphereGeometry(.2, 32, 22); add(g, ball);
  for (let i = 0; i < 3; i++) { const b = torus(.2, .012, au, 0, .42, 0); b.rotation.x = Math.PI / 2; b.rotation.y = i * .9; b.rotation.z = .3; add(g, b); }
  const ring = torus(.25, .012, au, 0, .42, 0); ring.rotation.z = .4; add(g, ring);
  const st = star(.04, .012, au); st.position.set(0, .7, 0); add(g, st);
  return g;
}
// 合格さくらの鉢：金の鉢に、ピンクの花が咲いた小さな桜の木
export function build_ltdsakura(d) {
  const g = G(), au = gold(), bark = M('#6b4630', { roughness: .9 }), pk = ['#ffc2d6', '#ffaac6', '#ffd9e6', '#ff9fbd'];
  add(g, lathe([[0, 0], [.1, 0], [.15, .04], [.17, .13], [.15, .15], [.12, .14], [0, .13]], au, 0, 0, 0, 28), torus(.16, .012, au, 0, .14, 0).rotateX(Math.PI / 2), cyl(.14, .14, .01, M('#4a3426', { roughness: 1 }), 0, .14, 0, 24));
  const tr = cyl(.022, .035, .3, bark, 0, .15, 0, 10); tr.rotation.z = .06; add(g, tr);
  [[-.7, .1], [.65, .12]].forEach(([rz, x]) => { const bg = G(); bg.position.set(0, .33, 0); bg.rotation.z = rz; bg.add(cyl(.01, .016, .17, bark, 0, 0, 0, 6)); add(g, bg); });
  [[0, .58, 0, .12], [-.12, .5, .02, .09], [.13, .52, -.03, .1], [-.04, .47, .1, .08], [.06, .64, .04, .07], [-.09, .62, -.05, .07], [.16, .42, .04, .06], [-.17, .42, -.02, .06]].forEach(([x, y, z, r], i) => add(g, sph(r, M(pk[i % 4], { roughness: .8 }), x, y, z)));
  for (let i = 0; i < 26; i++) { const a = i * 2.4, rr = .05 + (i % 5) * .05, h = .52 + ((i * 7) % 9) * .02, f = sph(.012, M(pk[i % 4], { roughness: .8 }), Math.sin(a) * (.08 + (i % 4) * .03), h - ((i * 5) % 7) * .02, Math.cos(a) * (.06 + (i % 3) * .03), .6); add(g, f); }
  for (let i = 0; i < 9; i++) { const a = i * 2.1; const p = sph(.012, M(pk[i % 4], { roughness: .8 }), Math.sin(a) * (.04 + (i % 4) * .025), .152, Math.cos(a) * (.03 + (i % 3) * .035), .35); add(g, p); }   // 土に落ちた花びら
  return g;
}
// 星空のスノードーム：ガラス玉の中に夜空と星と小さな家・金の台
export function build_ltdsnowglobe(d) {
  const g = G(), au = gold(), cy = .36, R = .21;
  add(g, lathe([[0, 0], [.17, 0], [.21, .03], [.2, .08], [.16, .13], [.14, .17], [0, .17]], au, 0, 0, 0, 32), torus(.14, .012, gold2(), 0, .17, 0).rotateX(Math.PI / 2));
  const sky = new THREE.Mesh(new THREE.SphereGeometry(R * .94, 32, 22), new THREE.MeshStandardMaterial({ color: '#1b2a6a', roughness: 1, side: THREE.BackSide })); sky.position.y = cy; add(g, sky);
  const gl = MGLASS(0xe8f4ff, .16); const ball = sph(R, gl, 0, cy, 0); ball.castShadow = false; ball.renderOrder = 3; add(g, ball);
  for (let i = 0; i < 16; i++) { const y = 1 - (i + .5) / 16 * 1.7, rr = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.4, s = sph(.008 + (i % 3) * .003, MG(0xffe27a, 2), Math.sin(a) * rr * R * .9, cy + y * R * .9, Math.cos(a) * rr * R * .9); s.castShadow = false; add(g, s); }
  const st = star(.035, .01, MG(0xffe27a, 2)); st.position.set(.05, cy + .13, -.1); add(g, st);
  const snow = sph(R * .94, M('#f4f8ff', { roughness: 1 }), 0, cy - R * .94 * .72, 0, .3); add(g, snow);
  const top = cy - R * .94 * .72 + R * .94 * .3 - .01;
  add(g, rbox(.07, .05, .06, .008, M('#fff3dc', { roughness: .7 }), -.02, top, .01), rbox(.012, .02, .012, .003, M('#c9524e'), .004, top + .05, -.004), rbox(.014, .014, .003, .002, MG(0xffd36a, 2.2), -.02, top + .012, .042));
  const rf = cone(.052, .045, M('#d9504e', { roughness: .6 }), -.02, top + .05, .01, 4); rf.rotation.y = Math.PI / 4; add(g, rf);
  [[.06, .03, .045], [.085, -.03, .035]].forEach(([x, z, h]) => add(g, cone(.022, h, M('#2f7a4f', { roughness: .8 }), x, top - .005, z, 8), cone(.017, h * .8, M('#3a8a5a', { roughness: .8 }), x, top + h * .55, z, 8)));
  const fl = G(); for (let i = 0; i < 14; i++) { const a = i * 2.4, r = .02 + (i % 5) * .025, s = sph(.0045, M('#ffffff', { emissive: 0xffffff, emissiveIntensity: .6 }), Math.sin(a) * r, cy - .08 + ((i * 5) % 11) * .018, Math.cos(a) * r); s.castShadow = false; fl.add(s); } add(g, fl);
  g.userData.anim = t => { fl.rotation.y = t * .5; fl.position.y = Math.sin(t * 1.3) * .006; };
  return g;
}
// 金の万年筆とペン立て：くるみ色の台に、金のペン立てと、台にのせた金の万年筆
export function build_ltdpen(d) {
  const g = G(), au = gold(), au2 = gold2(), wd = MW('#4a2a14'), navy = M('#1c2342', { roughness: .3, metalness: .2 });
  add(g, rbox(.5, .035, .2, .012, wd, 0, 0, 0), box(.5, .008, .004, au2, 0, .014, .1));
  add(g, lathe([[0, 0], [.065, 0], [.075, .02], [.08, .12], [.085, .125], [.07, .13], [.06, .1], [0, .02]], au, -.17, .035, -.02, 24));   // 金のペン立て
  [[.28, .2, navy], [-.25, .17, MM(0xd9a21f, .3)]].forEach(([rz, L, mat]) => { const pg = G(); pg.position.set(-.17, .09, -.02); pg.rotation.z = rz; pg.add(cyl(.007, .007, L, mat, 0, 0, 0, 8), cone(.007, .02, au, 0, L, 0, 8)); add(g, pg); });
  // 台にのせた万年筆（横向き）：金の受けに、紺の軸・金の輪・クリップ・ペン先
  [.04, .16].forEach(x => add(g, rbox(.02, .02, .03, .006, au, x, .035, .045), rbox(.014, .008, .03, .004, au2, x, .055, .045)));
  const body = cyl(.016, .016, .2, navy, 0, 0, 0, 14); body.rotation.z = Math.PI / 2; body.position.set(.1, .077, .045); add(g, body);
  [.04, .16].forEach(x => { const b = cyl(.0175, .0175, .008, au, 0, 0, 0, 14); b.rotation.z = Math.PI / 2; b.position.set(x, .077, .045); add(g, b); });
  add(g, box(.07, .004, .008, au, .07, .097, .045), sph(.008, au, .035, .097, .045));
  const nib = cone(.014, .045, au, 0, 0, 0, 12); nib.rotation.z = Math.PI / 2; nib.position.set(.2225, .077, .045); add(g, nib);
  const tip = sph(.004, au2, .245, .077, .045); add(g, tip);
  return g;
}
// 金メダルの額：机に立てる額。紺のビロードの台に、金メダルとリボン
export function build_ltdmedal(d) {
  const g = G(), au = gold(), au2 = gold2(), fr = new THREE.Group(); fr.position.set(0, .02, 0); fr.rotation.x = -.14; g.add(fr);
  add(g, rbox(.34, .03, .3, .012, MW('#3a2010'), 0, 0, -.04));
  add(fr, rbox(.34, .42, .035, .014, au, 0, 0, 0), rbox(.29, .37, .02, .008, M('#1d2750', { roughness: .95 }), 0, .025, .012));
  [[-.04, .25, '#d9423f'], [.04, -.25, '#fbf8f1']].forEach(([x, rz, c]) => { const r = rbox(.06, .16, .004, .001, M(c, { roughness: .6 }), 0, 0, 0); r.rotation.z = rz; r.position.set(x, .29, .026); add(fr, r); });
  const md = cyl(.1, .1, .014, au, 0, 0, 0, 40); md.rotation.x = Math.PI / 2; md.position.set(0, .175, .03); add(fr, md);
  const md2 = cyl(.08, .08, .006, au2, 0, 0, 0, 40); md2.rotation.x = Math.PI / 2; md2.position.set(0, .175, .038); add(fr, md2);
  const st = star(.055, .01, au); st.position.set(0, .175, .047); add(fr, st);
  const rg = torus(.025, .008, au, 0, .295, .03); add(fr, rg);
  const leg = rbox(.05, .4, .02, .006, MW('#3a2010'), 0, 0, 0); leg.rotation.x = .32; leg.position.set(0, .2, -.08); add(g, leg);
  return g;
}
// 虹色のランタン：金のふちのガラスの中で、虹の7色がやさしく光る（灯りになる）
export function build_ltdlantern(d) {
  const g = G(), au = gold(), au2 = gold2(), cols = [0xff4a4a, 0xff9a3a, 0xffe03a, 0x4ad06a, 0x3ab8ff, 0x5a6aff, 0xb26aff];
  add(g, cyl(.11, .125, .03, au, 0, 0, 0, 24), cyl(.095, .095, .012, au2, 0, .03, 0, 24));
  const mats = cols.map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.1, roughness: .5 })), disc = [];
  cols.forEach((c, i) => { const m = cyl(.07, .07, .036, mats[i], 0, .042 + i * .034, 0, 20); m.castShadow = false; disc.push(m); add(g, m); });
  const gl = lathe([[.1, .04], [.115, .12], [.115, .26], [.1, .3]], MGLASS(0xf4eaff, .22), 0, 0.01, 0, 24); gl.castShadow = false; add(g, gl);
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; add(g, cyl(.006, .006, .27, au, Math.sin(a) * .113, .045, Math.cos(a) * .113, 6)); }
  add(g, cyl(.11, .09, .03, au, 0, .31, 0, 24), cone(.06, .05, au, 0, .34, 0, 16), sph(.012, au2, 0, .395, 0));
  const h = torus(.07, .008, au, 0, .41, 0); h.scale.y = .8; add(g, h);
  const hl = halo(0xfff0d8, .7, 0, .19, 0, .4); add(g, hl);
  g.userData.anim = t => { disc.forEach((m, i) => { m.material.emissiveIntensity = 1.1 + .4 * Math.sin(t * 1.4 + i * .9); }); hl.material.opacity = .4; };
  lightAt(g, 0, .2, 0, 0xffe8d0, 1.5, 3.4, false);
  return g;
}
// 王冠のクッション：赤いふかふかクッションに、金の王冠
export function build_ltdcrown(d) {
  const g = G(), au = gold(), au2 = gold2(), red = MF('#c8283c', 'cloth');
  add(g, puffy(.42, .1, .34, red, 0, 0, 0, { puff: .7 }));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => add(g, sph(.018, au, sx * .21, .03, sz * .17), cyl(.004, .004, .05, au2, sx * .22, -.01, sz * .18, 5)));
  const y0 = .095;
  add(g, lathe([[.085, 0], [.1, 0], [.108, .075], [.095, .075]], au, 0, y0, 0, 32), cyl(.092, .092, .02, MF('#8a1626', 'cloth'), 0, y0 + .005, 0, 24));
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, x = Math.sin(a) * .1, z = Math.cos(a) * .1; add(g, cone(.026, .06, au, x, y0 + .07, z, 4), sph(.012, au, x, y0 + .136, z)); }
  [[0, '#ff4a6a'], [1, '#4aa8ff'], [2, '#4ad08a'], [3, '#ff4a6a'], [4, '#4aa8ff'], [5, '#4ad08a']].forEach(([i, c]) => { const a = i * Math.PI / 3 + Math.PI / 6; add(g, sph(.011, M(c, { roughness: .2, emissive: c, emissiveIntensity: .25 }), Math.sin(a) * .105, y0 + .035, Math.cos(a) * .105)); });
  add(g, sph(.014, M('#ff4a6a', { roughness: .2, emissive: 0xff4a6a, emissiveIntensity: .3 }), 0, y0 + .035, .108));
  return g;
}
// はずれ品：腐った魚。くすんだ緑の体・×の目・ほね・もわもわのにおい
export function build_rottenfish(d) {
  const g = G(), skin = M('#6f7d46', { roughness: .95 }), belly = M('#a39a62', { roughness: .95 }), dark = M('#4a5532', { roughness: .95 }), ink = M('#2a2a22'), spot = M('#5a4a2a', { roughness: 1 });
  const plate = cyl(.3, .26, .03, M('#e8e4d8', { roughness: .5 }), 0, 0, 0, 28); plate.scale.z = .7; add(g, plate);
  const body = sph(.14, skin, 0, .12, 0); body.scale.set(1.7, .7, .8); add(g, body);
  const bl = sph(.11, belly, 0, .09, .03); bl.scale.set(1.6, .45, .7); add(g, bl);
  const tail = cone(.09, .14, dark, .28, .06, 0, 4); tail.rotation.z = Math.PI / 2; tail.scale.set(.5, 1, 1); add(g, tail);
  add(g, cone(.05, .08, dark, -.02, .19, 0, 4));   // せびれ
  [[-.08, .15, .08, .03], [.06, .17, .07, .025], [.12, .12, .09, .02], [-.02, .1, .1, .022]].forEach(([x, y, z, r]) => { const s = sph(r, spot, x, y, z); s.scale.z = .4; add(g, s); });   // くさったしみ
  // ×の目
  [[-.17, .15, .085]].forEach(([x, y, z]) => { add(g, sph(.03, M('#f2efe2'), x, y, z, 1)); [.7, -.7].forEach(r => { const b = box(.045, .008, .006, ink, x, y - .004, z + .028); b.rotation.z = r; add(g, b); }); });
  // ほねが見えている（背中の一部）
  const bone = M('#f4f0e2', { roughness: .6 });
  for (let i = 0; i < 4; i++) add(g, box(.008, .05, .008, bone, -.04 + i * .05, .17, .07).rotateX(.3));
  add(g, box(.18, .01, .01, bone, .035, .19, .06));
  // ハエ1ぴき
  add(g, sph(.012, ink, .05, .36, .05), sph(.012, M('#cfe8ff', { transparent: true, opacity: .7 }), .04, .375, .05, .4), sph(.012, M('#cfe8ff', { transparent: true, opacity: .7 }), .06, .375, .05, .4));
  // もわもわ（ゆっくりゆれる）
  const fume = G(), fm = M('#7fb03a', { transparent: true, opacity: .8, roughness: 1 });
  [[-.1, .3], [.0, .38], [.1, .31], [-.04, .46], [.06, .5]].forEach(([x, y], i) => { const t = torus(.035 + (i % 3) * .008, .011, fm, x, y, 0); add(fume, t); });
  add(g, fume);
  g.userData.anim = t => { fume.position.y = Math.sin(t * 1.6) * .02; fume.children.forEach((c, i) => { c.rotation.y = t * (1 + i * .3); }); };
  return g;
}

// ===== 東進ハイスクール藤沢校のポスター（壁かけ）：緑の地に白い文字。ロゴは assets/toshin_logo.png があれば上に入れる =====
// ロゴの画像はこちらで描かない（本物を正しく使うため、校舎から画像をもらって assets/ に置く）。無いときは文字だけ
export function art_toshin(d) {
  let tex = null, cv0 = null;
  tex = texOf('toshin_poster', 300, 420, (c, w, h, cv) => {
    cv0 = cv;
    const draw = logo => {
      c.fillStyle = '#0b8a3e'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#ffffff'; c.lineWidth = 8; c.strokeRect(14, 14, w - 28, h - 28);
      c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const font = s => '900 ' + s + 'px "Zen Maru Gothic","Hiragino Kaku Gothic ProN","Yu Gothic UI","Meiryo",sans-serif';
      const top = logo ? 190 : 140;
      if (logo) { const lw = 200, lh = lw * (logo.height / logo.width || .5); c.drawImage(logo, (w - lw) / 2, 40 + Math.max(0, (120 - lh) / 2), lw, Math.min(lh, 120)); }
      c.font = font(27); c.fillText('東進ハイスクール', w / 2, top);
      c.fillRect(50, top + 34, w - 100, 4);
      c.font = font(74); c.fillText('藤沢校', w / 2, top + 100);
      c.font = font(20); c.fillText('TOSHIN HIGH SCHOOL', w / 2, h - 52);
    };
    draw(null);
    const im = new Image(); im.onload = () => { draw(im); if (tex) tex.needsUpdate = true; }; im.src = 'assets/toshin_logo.png';
  });
  const g = G(), p = plane(d.w, d.h, MT(tex), d.w / 2, d.h / 2, .012); p.castShadow = false; add(g, p);
  [.1, d.w - .1].forEach(x => add(g, sph(.025, MM(0xd8d8d8), x, d.h - .06, .02))); return g;
}
