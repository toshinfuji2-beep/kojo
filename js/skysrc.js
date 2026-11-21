// 窓の外の景色の「式」（GLSL の小さな書き方）。WebGL 版（skyview.js）はこのまま GLSL として使い、WebGPU 版（skyview_tsl.js）は同じ文字を WGSL に機械で書きかえて使う。
// だから、WebGL と WebGPU はいつも同じ見た目になる（式は、ここ1か所だけ直す）。
// 書き方の決まり（WGSL に直せる範囲）：
//  - 関数は行のはじめから「型 名前(型 引数, ...) {」で書き、おわりも行のはじめの「}」。いちばん最後の関数が入口（skyScene）。引数は書きかえない（コピーして使う）。
//  - 変数は「型 名前 = 式;」の形でだけ作る（まとめて宣言・宣言だけは使わない）。型は float / int / vec2 / vec3 / vec4。数は必ず小数点つき（1. や .5）。
//  - if の中かっこは省かない。三項演算子・配列・swizzle への代入・out/inout・atan・mod・% は使わない。
//  - clamp / min / max / step / smoothstep は、型をそろえる（ベクトルとスカラーを混ぜない）。smoothstep は edge0 < edge1 だけ。
//  - WGSL の予約語（target, type, set, get, new, use, from, filter, common, mod, meta, match, layout, shared, smooth, final, pass, patch, self, std, module, move, import, loop, case, default, const など）を変数名にしない。
//  - fwidth など微分は入口の外で計算して引数で渡す（分岐の中で使えないため）。
export const SKY_SRC = `
float skH(vec2 p) {
  vec3 q = fract(vec3(p.x, p.y, p.x) * .1031);
  q = q + vec3(dot(q, vec3(q.y, q.z, q.x) + vec3(33.33)));
  return fract((q.x + q.y) * q.z);
}
float skQ(float x) {
  return x * x;
}
float skN(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (vec2(3.) - 2. * f);
  return mix(mix(skH(i), skH(i + vec2(1., 0.)), f.x), mix(skH(i + vec2(0., 1.)), skH(i + vec2(1., 1.)), f.x), f.y);
}
float skN1(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3. - 2. * f);
  return mix(skH(vec2(i, 1.7)), skH(vec2(i + 1., 1.7)), f);
}
vec3 skL(vec3 c) {
  return pow(c, vec3(2.2));
}
vec3 skPh(vec3 ph, vec3 d, vec3 s, vec3 n) {
  return skL(d * ph.x + s * ph.y + n * ph.z);
}
float skFbm(vec2 p, float t, float oct) {
  float a = .5;
  float s = 0.;
  vec2 q = p;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    if (fi < oct) {
      s = s + a * skN(q + vec2(t * (.012 + .006 * fi), t * (.007 * fi - .01)) + vec2(fi * 11.3));
    }
    q = q * 2.03 + vec2(3.1, 1.7);
    a = a * .5;
  }
  return s;
}
float skRidge(float x, float seed, float freq, float rg) {
  float s = 0.;
  float a = .5;
  float p = x * freq + seed;
  for (int i = 0; i < 4; i++) {
    float n = skN1(p);
    n = mix(n, 1. - abs(2. * n - 1.), rg);
    s = s + a * n;
    p = p * 2.1 + 7.3;
    a = a * .5;
  }
  return s / .9375;
}
// 積雲：fbm のノイズで立体感。日の当たる側が明るく、影の側と底が暗い。夜は月明かりのふちだけ光る
vec4 skCloud(vec2 q, float t, float cov, float gry, vec2 ld, float ldl, vec3 ph, vec3 lc, vec3 ac, float fine) {
  float base = mix(.50 + .07 * skN1(q.x * .9 + 4.), .22, gry);
  float thick = mix(.62, 1.7, gry);
  float h01 = (q.y - base) / thick;
  if (h01 < -.05 || h01 > 1.25) {
    return vec4(0.);
  }
  vec2 p = vec2(q.x * 1.5, q.y * 3.2);
  float d = skFbm(p, t, 4. + fine);
  float thr = mix(.57, .36, cov);
  float cd = d - thr + .45 * (.35 - h01);
  float a = smoothstep(0., .14, cd) * smoothstep(0., .035, q.y - base);
  a = max(a, gry * .8 * smoothstep(.2, .7, q.y) * (.65 + .35 * d));
  if (a < .004) {
    return vec4(0.);
  }
  float d2 = skFbm(p + ld * vec2(.34, .3), t, 4.);
  float cd2 = d2 - thr + .45 * (.35 - h01 - ld.y * .05);
  float lit = clamp(.55 + (cd - cd2) * 3.4, 0., 1.);
  lit = lit * mix(.45, 1., smoothstep(-.02, .5, h01)) * mix(1., .72, smoothstep(.1, .45, cd));
  float rim = 1. - smoothstep(0., .17, cd);
  float bodyK = 1. - ph.z * .9;
  vec3 col = ac * .95 + lc * lit * .78 * bodyK + lc * rim * exp(-ldl * 1.5) * (.5 + 2.2 * ph.z) * (1. - gry * .6);
  return vec4(col, a * .96);
}
// 山なみ（空気遠近法：遠いほど地平線の色にかすむ）
vec4 skHill(vec2 q, float aa, float seed, float base, float amp, float freq, float rg, float bump, float hk, vec3 body, vec3 hz, float tint) {
  float rr = skRidge(q.x, seed, freq, rg);
  float h = base + amp * rr + bump * (skN1(q.x * 55. + seed) - .5);
  float m = 1. - smoothstep(h - aa * 1.5, h + aa * 1.5, q.y);
  if (m < .003) {
    return vec4(0.);
  }
  float dh = skRidge(q.x + .04, seed, freq, rg) - skRidge(q.x - .04, seed, freq, rg);
  float sh = 1. + clamp(dh * amp * 7., -.3, .3);
  float hzk = hk + (1. - hk) * .5 * smoothstep(0., .4, h - q.y);
  vec3 c = mix(body * sh * tint, hz, hzk);
  return vec4(c, m);
}
// 家・ビル（1列。q.y = 地面からの高さ）。切り妻の屋根、窓、夜の窓あかり（ついたり消えたり）
vec4 skBuild(vec2 q, float aa, float cw, float seed, float tall, float hs, float wsp, vec3 ph, float t, vec3 hz, float hk, vec3 tint) {
  float id = floor(q.x / cw);
  float lx = q.x / cw - id;
  float h1 = skH(vec2(id, seed));
  float h2 = skH(vec2(id, seed + 1.3));
  float h3 = skH(vec2(id, seed + 2.6));
  float h4 = skH(vec2(id, seed + 3.9));
  float x0 = .05 + .12 * h1;
  float x1 = .95 - .12 * h2;
  float bw = (x1 - x0) * cw;
  float rx = (lx - x0) / (x1 - x0);
  float aaR = aa / bw;
  float isTall = step(1. - tall, h3);
  float wallH = mix(.075 + .085 * h4, .2 + .16 * h4, isTall) * hs;
  float roofH = (1. - isTall) * (.05 + .05 * h1) * min(bw / .15, 1.3);
  float rtop = wallH + roofH * (1. - abs(2. * rx - 1.) / 1.12);
  float xin = smoothstep(-aaR, aaR, rx) * (1. - smoothstep(1. - aaR, 1. + aaR, rx));
  float mWall = (1. - smoothstep(wallH - aa, wallH + aa, q.y)) * xin;
  float xr = smoothstep(-.06 - aaR, -.06 + aaR, rx) * (1. - smoothstep(1.06 - aaR, 1.06 + aaR, rx));
  float mRoof = (1. - smoothstep(rtop - aa, rtop + aa, q.y)) * smoothstep(wallH - .006, wallH - .006 + 2. * aa, q.y) * xr * (1. - isTall);
  float chim = step(.55, h4) * (1. - isTall) * step(.66, rx) * step(rx, .76) * (1. - smoothstep(wallH + roofH * .75 + .03 - aa, wallH + roofH * .75 + .03 + aa, q.y));
  float ant = isTall * step(.7, h1) * step(abs(rx - .5), .012 / bw + aaR) * (1. - smoothstep(wallH + .05 - aa, wallH + .05 + aa, q.y)) * step(wallH, q.y);
  float m = clamp(max(max(mWall, mRoof), max(chim, ant)), 0., 1.);
  if (m < .003) {
    return vec4(0.);
  }
  // 壁と屋根の色（やさしい色）
  float wi = floor(h2 * 5.99);
  vec3 wall = vec3(.95, .89, .78);
  if (wi < 1.) { wall = vec3(.92, .82, .70); }
  else if (wi < 2.) { wall = vec3(.87, .89, .82); }
  else if (wi < 3.) { wall = vec3(.96, .87, .82); }
  else if (wi < 4.) { wall = vec3(.90, .89, .93); }
  else if (wi < 5.) { wall = vec3(.94, .91, .84); }
  float ri = floor(h1 * 4.99);
  vec3 roof = vec3(.71, .40, .29);
  if (ri < 1.) { roof = vec3(.55, .42, .35); }
  else if (ri < 2.) { roof = vec3(.44, .51, .58); }
  else if (ri < 3.) { roof = vec3(.66, .35, .24); }
  else if (ri < 4.) { roof = vec3(.48, .42, .54); }
  vec3 tallc = mix(vec3(.72, .76, .83), vec3(.80, .78, .76), h4);
  wall = mix(wall, tallc, isTall);
  vec3 body = mix(wall, roof, clamp(mRoof / max(m, .001), 0., 1.) * (1. - mWall));
  body = mix(body, vec3(.55, .47, .42), clamp(chim + ant, 0., 1.) * (1. - mWall) * (1. - mRoof));
  body = body * (1. - .2 * smoothstep(.58, .66, rx));
  // 窓
  float wsx = bw / max(floor(bw / wsp), 1.);
  float ix = floor(rx * bw / wsx);
  float fx = rx * bw / wsx - ix;
  float iy = floor((q.y - .018) / (wsp * 1.05));
  float fy = (q.y - .018) / (wsp * 1.05) - iy;
  float ee = clamp(aa / wsx * 1.4, .03, .5);
  float inW = smoothstep(.22, .22 + ee, fx) * (1. - smoothstep(.72 - ee, .72, fx)) * smoothstep(.28, .28 + ee, fy) * (1. - smoothstep(.78 - ee, .78, fy));
  float zone = step(.03, q.y) * step(q.y, wallH - .02) * step(.03, rx) * step(rx, .97) * mWall;
  float avg = smoothstep(.2, .5, aa / wsx);
  inW = mix(inW, .26, avg) * zone;
  vec2 wid = vec2(ix + id * 13., iy + seed * 7.);
  float hw = skH(wid);
  float ft = t * .02 + hw * 40.;
  float kk = floor(ft);
  float lv = mix(skH(wid + vec2(kk * 1.37, 2.)), skH(wid + vec2((kk + 1.) * 1.37, 2.)), smoothstep(.9, 1., fract(ft)));
  float on = smoothstep(.58, .64, lv) * (ph.z + ph.y * .55);
  vec3 winD = mix(vec3(.45, .58, .68), vec3(.62, .74, .80), hw);
  vec3 winL = mix(vec3(1., .78, .46), vec3(1., .66, .36), hw);
  winL = mix(winL, vec3(.72, .86, 1.), step(.9, hw));
  vec3 c = mix(body, winD * .75, inW * (1. - on) * .9);
  c = skL(c) * tint;
  c = mix(c, hz, hk);
  c = c + skL(winL) * on * inW * (3.0 - 1.4 * avg) * (1. - hk * .5);
  return vec4(c, m);
}
// 道と車（遠くの道を車のライトが流れる）。q.y = 地面からの高さ（道は地面より下）
vec4 skRoad(vec2 q, float aa, vec3 ph, float t, float fine, vec3 tint) {
  float ym = (q.y + .026) / .02;
  if (ym < -.5 || ym > 3.3) {
    return vec4(0.);
  }
  float road = (1. - smoothstep(.0, aa * 1.5, abs(q.y + .026) - .026));
  vec3 c = mix(vec3(.42, .43, .46), vec3(.52, .50, .46), step(-.006, q.y)) * tint;
  float night = ph.z + ph.y * .5;
  // 街灯
  float lc = floor(q.x / .46);
  float lxp = (lc + .5) * .46;
  float pole = (1. - smoothstep(.0, aa * 1.2, abs(q.x - lxp) - .0025)) * (1. - smoothstep(.0, aa, q.y - .07)) * step(-.01, q.y);
  vec3 col = mix(c, vec3(.18, .17, .17) * tint, pole);
  float a = max(road, pole);
  vec2 lg = vec2(q.x - lxp, q.y - .075);
  float glow = exp(-dot(lg, lg) / .0009) * night;
  col = col + vec3(1.0, .78, .42) * glow * 1.6;
  a = max(a, clamp(glow, 0., 1.));
  // 車
  if (fine > .5) {
    for (int k = 0; k < 2; k++) {
      float dir = 1. - 2. * float(k);
      float sp = .055 - .012 * float(k);
      float ly = -.02 - .028 * float(k);
      float u = q.x - dir * t * sp;
      float cell = floor(u / .6);
      float hc = skH(vec2(cell, 5. + float(k)));
      float cx = (cell + .12 + .7 * skH(vec2(cell, 6. + float(k)))) * .6 + dir * t * sp;
      float present = step(.4, hc);
      vec2 cd = vec2(q.x - cx, q.y - ly);
      float body = (1. - smoothstep(.0, aa * 1.2, abs(cd.x) - .026)) * (1. - smoothstep(.0, aa * 1.2, abs(cd.y - .006) - .0075)) * present;
      float hh = skH(vec2(cell, 9.));
      vec3 cc = vec3(.78, .30, .25);
      if (hh > .75) { cc = vec3(.90, .90, .88); }
      else if (hh > .5) { cc = vec3(.28, .42, .66); }
      else if (hh > .3) { cc = vec3(.86, .74, .30); }
      col = mix(col, cc * tint, body);
      a = max(a, body);
      vec2 hd = vec2(q.x - (cx + dir * .027), q.y - ly - .002);
      vec3 lcol = mix(vec3(.9, .1, .08), vec3(1., .92, .72), step(0., dir));
      float lg2 = exp(-dot(hd, hd) / .00012) * present * night;
      col = col + lcol * lg2 * 2.6;
      a = max(a, clamp(lg2, 0., 1.));
    }
  }
  return vec4(col, a);
}
// 手前の木：葉のかたまり（枝ごとにゆれの時間をずらす）。すき間から空が見える
vec4 skTree(vec2 q, float aa, float cw, float sc, float seed, float t, vec3 ph, float fine, vec2 ld, float hk, vec3 hz) {
  float id = floor(q.x / cw);
  float h1 = skH(vec2(id, seed));
  float h2 = skH(vec2(id, seed + 1.1));
  float h3 = skH(vec2(id, seed + 2.2));
  float h4 = skH(vec2(id, seed + 3.3));
  if (h4 < .1) {
    return vec4(0.);
  }
  vec2 c = vec2((id + .3 + .4 * h1) * cw, (.62 + .5 * h2) * sc + .05);
  float R = (.30 + .14 * h3) * sc;
  vec2 rel = q - c;
  float gust = .6 + .4 * sin(t * .31 + id * 2.1);
  // 幹
  float tw = .02 * sc + .008 * sc * (1. - clamp((q.y - .05) / max(c.y, .1), 0., 1.));
  float tr = (1. - smoothstep(0., aa * 1.2, abs(q.x - c.x - .01 * sin(t * 1.15 + id * 3.1) * gust * clamp(q.y - .3, 0., 1.)) - tw)) * step(.0, q.y) * step(q.y, c.y - R * .25);
  vec3 bark = mix(vec3(.36, .24, .16), vec3(.25, .17, .12), smoothstep(-.3, .7, (q.x - c.x) / max(tw, .01)));
  bark = bark * (.85 + .3 * skN(vec2(q.x * 60., q.y * 6.)));
  float cov = 0.;
  float rbest = 9.;
  if (length(rel) < R * 1.75) {
    float fz = 1. - smoothstep(.005, .013, aa);
    float e1 = skN(q * 30. + vec2(7.1, 2.3));
    float e2 = mix(.5, skN(q * 66. + vec2(1.7, 9.2)), fz);
    for (int j = 0; j < 6; j++) {
      float fj = float(j);
      float ja = skH(vec2(id * 7. + fj, seed + 4.));
      float jb = skH(vec2(id * 7. + fj, seed + 5.));
      float jk = skH(vec2(id * 7. + fj, seed + 6.));
      float jp = skH(vec2(id * 7. + fj, seed + 7.)) * 6.283;
      vec2 off = vec2((ja - .5) * 1.4, (jb - .42) * 1.1) * step(.5, fj);
      float kk = mix(1., .55 + .4 * jk, step(.5, fj));
      float swa = (sin(t * 1.2 + jp) * .6 + sin(t * 2.4 + jp * 1.7) * .4) * gust * .013 * (.45 + .55 * length(off));
      vec2 bc = c + off * R + vec2(swa, swa * .25);
      float rj = length((q - bc) / (R * kk));
      float cj = 1. - smoothstep(.82, 1.02, rj + (e1 - .5) * .62 + (e2 - .5) * .3);
      cov = max(cov, cj);
      rbest = min(rbest, rj);
    }
    float hole = smoothstep(.62, .70, e1 * .5 + e2 * .5 + .05) * smoothstep(.35, .85, rbest);
    cov = cov * (1. - .88 * hole);
    float vyl = clamp(rel.y / R, -1., 1.);
    float d01 = smoothstep(.1, 1.05, rbest);
    float lt = clamp(.40 + .5 * vyl + .38 * (e2 - .5) + .22 * d01 - .15 + .12 * ld.x * rel.x / R, 0., 1.);
    vec3 dk = vec3(.10, .27, .14);
    vec3 md = vec3(.24, .50, .22);
    vec3 lg = vec3(.52, .75, .30);
    vec3 leaf = mix(mix(dk, md, smoothstep(0., .5, lt)), lg, smoothstep(.5, .95, lt));
    leaf = leaf + vec3(.18, .16, .06) * smoothstep(.86, 1., lt);
    float edge = 1. - smoothstep(.15, .7, cov);
    vec3 tn = vec3(ph.x + ph.y * 1.0 + ph.z * .045, ph.x + ph.y * .78 + ph.z * .07, ph.x + ph.y * .62 + ph.z * .13);
    vec3 lcol = skL(leaf) * tn;
    lcol = lcol + vec3(.06, .09, .22) * edge * ph.z;
    lcol = mix(lcol, hz, hk);
    vec3 bk = skL(bark) * tn;
    bk = mix(bk, hz, hk);
    float tm = tr * (1. - cov);
    float am = max(cov, tr);
    return vec4((lcol * cov + bk * tm) / max(am, .001), am);
  }
  vec3 tn2 = vec3(ph.x + ph.y * 1.0 + ph.z * .045, ph.x + ph.y * .78 + ph.z * .07, ph.x + ph.y * .62 + ph.z * .13);
  vec3 bk2 = mix(skL(bark) * tn2, hz, hk);
  return vec4(bk2, tr);
}
// 鳥（昼。ときどき数羽が横切る）
vec3 skBirds(vec3 col, vec2 p, vec2 sz, float t) {
  float u = fract(t / 40. + .37);
  if (u > .3) {
    return col;
  }
  float s = u / .3;
  vec3 res = col;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float bx = mix(-sz.x * .5 - .25, sz.x * .5 + .25, s) - fi * .09 + (fi - 1.) * .01;
    float by = sz.y * .8 + .06 * sin(s * 7. + fi) + fi * .03 - .04;
    float f = sin(t * 9. + fi * 1.9);
    vec2 d = p - vec2(bx, by);
    float sc = .9 + .2 * fract(fi * .37);
    float cx = d.x / sc;
    float cy = d.y / sc;
    float ax = abs(cx);
    float yw = (.5 * f + .12) * ax * .8 - ax * ax * 5.;
    float th = mix(.0065, .0026, ax / .045);
    float wing = (1. - smoothstep(th * .5, th, abs(cy - yw))) * (1. - smoothstep(.038, .046, ax));
    wing = max(wing, 1. - smoothstep(.004, .008, length(vec2(cx, cy * 1.3))));
    res = mix(res, vec3(.05, .06, .08), wing * .9);
  }
  return res;
}
// 雨（細いすじ。さきに傾けて落ちる）
float skRain(vec2 q, float t, float sc, float spd, float seed, float aa) {
  vec2 p = vec2(q.x * sc + q.y * sc * .12, q.y * sc * .35 + t * spd);
  float cx = floor(p.x);
  float fx = fract(p.x) - .5;
  float h = skH(vec2(cx, seed));
  float yy = fract(p.y * (.8 + h) + h * 7.);
  float sx = 1. - smoothstep(.02, .07, abs(fx));
  return sx * smoothstep(.55, 1., yy) * step(.35, h) * (1. - smoothstep(.4, 1., aa * sc * 2.));
}
// 雪（ふわふわ。ゆれながら落ちる）
float skSnow(vec2 q, float t, float cs, float fall, float seed) {
  vec2 p = vec2(q.x, q.y + t * fall) / cs;
  vec2 id = floor(p);
  vec2 f = fract(p);
  float h = skH(id + vec2(seed));
  float h2 = skH(id + vec2(seed + 9.1, 3.3));
  vec2 c = vec2(.5 + .26 * sin(t * (.5 + h) + h2 * 6.283), .5 + .26 * cos(t * (.4 + h2) + h * 6.283));
  float r = .09 + .07 * h2;
  return (1. - smoothstep(r * .15, r, length(f - c))) * step(.42, h);
}
// ガラスについた水てき（ガラスの面にあるので、見る角度でずれない）
vec3 skDrops(vec2 g, float t) {
  vec2 p = g / .075;
  vec2 id = floor(p);
  vec2 f = fract(p);
  float h = skH(id + vec2(31.));
  float h2 = skH(id + vec2(17.3, 5.1));
  float h3 = skH(id + vec2(3.7, 11.9));
  float slide = step(.78, h3) * fract(t * .012 + h2 * 9.);
  vec2 c = vec2(.22 + .56 * h2, .3 + .4 * h - slide * .9);
  vec2 dd = vec2(f.x - c.x, (f.y - c.y) * .8);
  float r = .1 + .12 * h3;
  float rd = length(dd) / r;
  float ex = step(h, .42) * (1. - smoothstep(.85, 1., fract(t * .012 + h2 * 9.)) * step(.78, h3));
  float inside = (1. - smoothstep(.85, 1., rd)) * ex;
  float rim = smoothstep(.55, .9, rd) * (1. - smoothstep(.9, 1.05, rd)) * ex;
  float spec = (1. - smoothstep(0., .25, length(dd - vec2(-.2 * r, .3 * r)) / r)) * ex;
  float trail = step(.78, h3) * ex * (1. - smoothstep(0., .03, abs(f.x - c.x))) * step(c.y, f.y) * step(f.y, c.y + slide * .9 + .0) * .35;
  return vec3(max(inside, trail), rim, spec);
}
vec3 skyScene(vec2 lp0, vec3 vw, float pan, float aa, float nk, float t, vec2 sz, float fine, vec3 wx) {
  float edx = sz.x * .5 - abs(lp0.x);
  float edy = sz.y * .5 - abs(lp0.y);
  float ed = min(edx, edy);
  float rf = 1. - smoothstep(0., .09, ed);
  float rf2 = rf * rf * .016;
  vec2 ofs = vec2(0., -sign(lp0.y) * rf2);
  if (edx < edy) {
    ofs = vec2(-sign(lp0.x) * rf2, 0.);
  }
  vec2 lp = lp0 + ofs;
  float ys = lp.y + sz.y * .5;
  vec2 tp = clamp(vw.xy / max(vw.z, .3), vec2(-1.8), vec2(1.8)) - vec2(0., .9);
  float wD = 1. - smoothstep(.1, .5, nk);
  float wN = smoothstep(.5, .9, nk);
  float wS = max(1. - wD - wN, 0.);
  vec3 ph = vec3(wD, wS, wN);
  float cov = wx.x;
  float gry = smoothstep(.55, 1., cov);
  float rain = wx.y * fine;
  float snow = wx.z * fine;
  float mist = clamp(rain * .45 + snow * .3 + gry * .2, 0., .8);

  // ---- 空：大気のグラデーション（地平線は明るくかすみ、天頂は深い青）----
  float sy = ys + tp.y * .02;
  vec3 hor = skPh(ph, vec3(.70, .84, .95), vec3(1., .66, .42), vec3(.22, .26, .50));
  vec3 mid = skPh(ph, vec3(.26, .54, .90), vec3(.76, .58, .72), vec3(.09, .13, .34));
  vec3 top = skPh(ph, vec3(.05, .20, .62), vec3(.22, .30, .60), vec3(.035, .06, .20));
  vec3 gcol = skPh(ph, vec3(.68, .72, .78), vec3(.64, .52, .52), vec3(.07, .09, .16));
  float u = 1. - exp(-max(sy, 0.) * 1.15);
  vec3 col = mix(mix(hor, mid, smoothstep(0., .62, u)), top, smoothstep(.38, .95, u));
  col = mix(col, gcol, gry * .85);
  float topY = sz.y - .22;
  float sunY = mix(topY, .20, smoothstep(0., .55, nk));
  float moonA = smoothstep(.45, 1., nk);
  vec2 sunScr = vec2(-sz.x * .17, sunY);
  vec2 moonScr = vec2(sz.x * .16, mix(sz.y * .3, topY - .05, moonA));
  vec2 sp = vec2(lp.x + tp.x * .03 + sz.x * .17, sy);
  vec2 sPos = vec2(0., sunY);
  float sunA = (1. - smoothstep(.5, .62, nk)) * (1. - gry * .9);
  float sd = length(sp - sPos);
  vec3 sunC = mix(vec3(1., .93, .74), vec3(1., .5, .24), clamp(wS * 1.6, 0., 1.));
  float disc = 1. - smoothstep(.04 - aa, .06 + aa, sd);
  float mie = .32 * exp(-sd * 5.) + .1 / (1. + sd * sd * 30.) + .03 * exp(-sd * 1.2);
  col = col + skL(sunC) * (disc * 1.7 + mie * (1. + wS * 1.2)) * sunA;
  // 夕やけ：地平線に近いところに、太陽の側へあかね色がさす
  col = col + skL(vec3(.98, .46, .22)) * wS * exp(-sy * 2.6) * (.45 + .55 * exp(-sp.x * sp.x / .5)) * .6;
  vec2 mp = vec2(lp.x + tp.x * .03 - sz.x * .16, sy);
  vec2 mPos = vec2(0., mix(sz.y * .3, topY - .05, moonA));
  float md = length(mp - mPos);
  float moonD = 1. - smoothstep(.07 - aa, .07 + aa, md);
  float mare = smoothstep(.45, .7, skN((mp - mPos) * 40.)) * .2 + smoothstep(.6, .8, skN((mp - mPos) * 90. + vec2(5.))) * .08;
  float halo = exp(-skQ((md - .27) / .035)) * .05;
  col = col + vec3(1., .97, .85) * (moonD * (1. - mare) * 1.9 + exp(-md * md / .02) * .35 + exp(-md * md / .25) * .08 + halo) * moonA * (1. - gry);
  // 星：夜に近づくとあらわれ、ちかちか光る
  if (nk > .3) {
    vec2 sq = vec2(lp.x + pan * .2 + tp.x * .03, sy) / .1;
    vec2 cell = floor(sq);
    vec2 f = fract(sq);
    float h1 = skH(cell);
    float h2 = skH(cell + vec2(7.3));
    float h3 = skH(cell + vec2(19.1));
    float r = max(.11, aa / .1 * .9);
    float st = (1. - smoothstep(r * .35, r, length(f - vec2(.2 + .6 * h2, .2 + .6 * h3)))) * step(.78, h1);
    float tw = .55 + .45 * sin(t * (1.3 + 3. * h2) + h1 * 40.);
    vec3 stc = mix(vec3(.85, .9, 1.), vec3(1., .88, .72), step(.5, h3));
    col = col + stc * st * tw * 1.7 * smoothstep(.3, .9, nk) * smoothstep(.55, .95, sy) * (1. - gry);
    if (fine > .5 && nk > .55) {
      float band = exp(-skQ((sy * .9 - (lp.x + pan * .2) * .6 - .45) * 2.6));
      col = col + vec3(.45, .5, .8) * band * (skN(vec2(lp.x + pan * .2, sy) * 9.) * .6 + .4) * .06 * smoothstep(.6, 1., nk) * (1. - gry);
      // 流れ星（まれに）
      float su = fract(t / 45. + .2);
      if (su < .035) {
        float sp2 = su / .035;
        vec2 dir = vec2(-.8, -.6);
        vec2 stt = vec2(sz.x * .42, sz.y * .98);
        float hd = sp2 * .75;
        vec2 rp = vec2(lp.x + tp.x * .03, sy) - stt;
        float al = dot(rp, dir);
        float pe = abs(rp.x * dir.y - rp.y * dir.x);
        float tl = clamp(1. - (hd - al) / .3, 0., 1.) * step(al, hd) * step(0., hd - al);
        col = col + vec3(.9, .95, 1.) * tl * tl * (1. - smoothstep(0., .005 + aa, pe)) * 2.2 * sin(sp2 * 3.14159);
      }
    }
  }
  // 光の色（雲・木の陰影に使う）
  vec2 lScr = mix(sunScr, moonScr, smoothstep(.45, .75, nk));
  vec2 ldv = lScr - vec2(lp.x, ys);
  float ldl = length(ldv);
  vec2 ld = ldv / max(ldl, .001);
  vec3 lc = skPh(ph, vec3(1., .95, .84), vec3(1., .55, .30), vec3(.55, .66, 1.)) * (wD + wS * .9 + wN * .38) * (1. - gry * .6);
  vec3 ac = mix(skPh(ph, vec3(.60, .70, .84), vec3(.54, .44, .58), vec3(.13, .17, .34)), gcol * .85, gry * .8);

  // ---- 雲 ----
  vec2 cq = vec2(pan * .2 + lp.x + tp.x * .07 + t * .02, ys + tp.y * .03);
  vec4 cl = skCloud(cq, t, cov, gry, ld, ldl, ph, lc, ac, fine);
  col = cl.rgb * cl.a + col * (1. - cl.a);
  // 鳥（昼。雲より手前）
  if (fine > .5 && nk < .45 && gry < .6 && rain < .1) {
    col = skBirds(col, vec2(lp.x + tp.x * .06, sy), sz, t);
  }

  // ---- 遠景（山・町）：遠いほど青くかすむ ----
  vec3 hz = mix(hor, gcol, gry * .6);
  vec3 nt = vec3(wD + wS * .95 + wN * .07, wD + wS * .74 + wN * .095, wD + wS * .64 + wN * .22);
  float aaY = aa;
  float y1 = ys + tp.y * .05;
  if (y1 < .78) {
    vec4 h1c = skHill(vec2(pan * .3 + lp.x + tp.x * .12, y1), aaY, 3.1, .56, .20, 1.3, .8, .0, .50 + mist * .35, skL(vec3(.40, .52, .72)), hz, 1.);
    h1c = vec4(h1c.rgb * mix(1., .30, wN * .8), h1c.a);
    col = h1c.rgb * h1c.a + col * (1. - h1c.a);
  }
  float y2 = ys + tp.y * .07;
  if (y2 < .66) {
    vec4 h2c = skHill(vec2(pan * .4 + lp.x + tp.x * .17, y2), aaY, 9.4, .43, .18, 1.9, .45, .0, .30 + mist * .35, skL(vec3(.30, .48, .56)), hz, 1.);
    h2c = vec4(h2c.rgb * mix(1., .28, wN * .8), h2c.a);
    col = h2c.rgb * h2c.a + col * (1. - h2c.a);
  }
  float y3 = ys + tp.y * .09;
  if (y3 < .58) {
    vec4 h3c = skHill(vec2(pan * .5 + lp.x + tp.x * .23, y3), aaY, 15.7, .34, .13, 2.8, .15, .014, .10 + mist * .3, skL(vec3(.27, .50, .32)), hz, 1.);
    h3c = vec4(h3c.rgb * mix(1., .22, wN * .8), h3c.a);
    col = h3c.rgb * h3c.a + col * (1. - h3c.a);
  }
  // 遠くのビル
  float y4 = ys + tp.y * .10 - .34;
  if (y4 < .5) {
    vec4 fb = skBuild(vec2(pan * .55 + lp.x + tp.x * .28, y4), aaY, .085, 21.3, .6, .7, .034, ph, t, hz, .38 + mist * .3, nt);
    col = fb.rgb * fb.a + col * (1. - fb.a);
  }
  // 町なみ（家・道・車）
  float ty = ys + tp.y * .12 - .30;
  vec2 tq = vec2(pan * .6 + lp.x + tp.x * .36, ty);
  if (ys + tp.y * .12 < .66) {
    vec4 hs = skBuild(tq, aaY, .27, 33.7, .22, 1., .05, ph, t, hz, mist * .3, nt);
    vec4 rd = skRoad(tq, aaY, ph, t, fine, nt);
    float gnd = 1. - smoothstep(-.004 - aaY, -.004 + aaY, ty);
    vec3 grass = skL(vec3(.50, .70, .40)) * nt;
    col = mix(col, grass, gnd);
    col = rd.rgb * rd.a + col * (1. - rd.a);
    col = hs.rgb * hs.a + col * (1. - hs.a);
  }
  // 雨・雪（遠く）
  if (rain > .01) {
    float rr = skRain(vec2(pan * .5 + lp.x + tp.x * .3, ys + tp.y * .1), t, 38., 3.4, 3., aa);
    col = col + vec3(.6, .66, .76) * rr * .16 * rain * (wD + wS + .2);
  }
  if (snow > .01) {
    float sn = skSnow(vec2(pan * .5 + lp.x + tp.x * .3, ys + tp.y * .1), t, .07, .05, 3.);
    col = col + vec3(.95, .97, 1.) * sn * .5 * snow * (wD + wS + wN * .35);
  }

  // ---- 手前の木と生け垣（風で枝ごとにゆれる）----
  float tyy = ys + tp.y * .25;
  vec3 hzn = mix(hz, vec3(0.), .0);
  if (fine > .5 && ys + tp.y * .17 < 1.1) {
    vec4 bt = skTree(vec2(pan * .6 + lp.x + tp.x * .5, ys + tp.y * .17), aaY, 1.1, .55, 51.1, t, ph, fine, ld, .22 + mist * .3, hz);
    col = bt.rgb * bt.a + col * (1. - bt.a);
  }
  if (tyy < 1.5) {
    vec4 tr = skTree(vec2(pan + lp.x + tp.x * .72, tyy), aaY, 1.9, 1., 7.3, t, ph, fine, ld, mist * .2, hz);
    col = tr.rgb * tr.a + col * (1. - tr.a);
  }
  // 生け垣
  vec2 hq = vec2(pan + lp.x + tp.x * .72, tyy);
  float htop = .11 + .018 * skN1(hq.x * 11.) + .012 * skN1(hq.x * 27.) + .008 * sin(t * 1.3 + hq.x * 3.) * smoothstep(.0, .12, tyy);
  float hm = 1. - smoothstep(htop - aaY, htop + aaY, tyy);
  if (hm > .003) {
    float ln = skN(vec2(hq.x * 40., tyy * 50.));
    float ln2 = mix(.5, skN(vec2(hq.x * 95., tyy * 120.) + vec2(3.)), 1. - smoothstep(.005, .013, aa));
    float hl = clamp(.35 + (tyy - .02) * 2.2 + (ln - .5) * .9 + (ln2 - .5) * .35, 0., 1.);
    vec3 hc = mix(vec3(.12, .31, .17), vec3(.30, .58, .26), hl);
    hc = hc + vec3(.18, .2, .05) * smoothstep(.82, 1., hl);
    vec3 htn = vec3(wD + wS * 1.0 + wN * .045, wD + wS * .78 + wN * .07, wD + wS * .62 + wN * .13);
    vec3 hcol = skL(hc) * htn + vec3(.01, .02, .05) * wN * smoothstep(.5, 1., hl);
    // ちいさな花
    vec2 fp = vec2(hq.x, tyy) / .13;
    vec2 fid = floor(fp);
    vec2 ff = fract(fp);
    float fh = skH(fid + vec2(71.));
    float fh2 = skH(fid + vec2(13.3, 4.4));
    float fl = (1. - smoothstep(.07, .11, length(ff - vec2(.2 + .6 * fh2, .2 + .6 * fh)))) * step(fh, .3) * step(tyy, htop - .02);
    vec3 fcol = mix(vec3(.95, .71, .76), vec3(.98, .88, .54), step(.5, fh2));
    hcol = mix(hcol, skL(fcol) * htn, fl * .9);
    hcol = mix(hcol, skL(vec3(.86, .9, .95)) * (wD + wS * .8 + wN * .12), snow * smoothstep(htop - .035, htop - .005, tyy) * .85);
    col = mix(col, hcol, hm);
  }
  // 蛍（夜、まれに。ふわふわ光る）
  if (fine > .5 && nk > .6 && rain < .1) {
    vec2 flp = vec2(pan + lp.x + tp.x * .6, ys + tp.y * .2) / .3;
    vec2 fid2 = floor(flp);
    vec2 ff2 = fract(flp);
    float f1 = skH(fid2 + vec2(91.));
    float f2 = skH(fid2 + vec2(5.5, 44.));
    float f3 = skH(fid2 + vec2(66.6, 2.));
    vec2 fc = vec2(.5 + .3 * sin(t * (.4 + f2) + f1 * 6.283), .5 + .3 * cos(t * (.33 + f3) + f2 * 6.283));
    float pulse = pow(max(sin(t * (.6 + f3 * .5) + f1 * 40.), 0.), 3.);
    float fdd = length(ff2 - fc) * .3;
    col = col + vec3(.6, 1., .3) * exp(-fdd * fdd / .00012) * pulse * step(.72, f1) * step(.25, ys + tp.y * .2) * smoothstep(.6, 1., nk) * 1.4;
  }
  // 雨・雪（近く）
  if (rain > .01) {
    float rn = skRain(vec2(pan + lp.x + tp.x * .72, tyy), t, 15., 4.6, 8., aa);
    col = col + vec3(.7, .76, .86) * rn * .30 * rain * (wD + wS + .25);
  }
  if (snow > .01) {
    float sn2 = skSnow(vec2(pan + lp.x + tp.x * .72, tyy), t, .11, .12, 12.);
    col = col + vec3(1.) * sn2 * .7 * snow * (wD + wS + wN * .35);
  }
  // 日の光：昼は窓全体にうっすら、あたたかい光がさす
  vec2 dsun = sp - sPos;
  col = col + skL(vec3(1., .82, .55)) * exp(-dot(dsun, dsun) / .45) * .10 * sunA;

  // くもり・雨の日は、すこし暗く色をおさえる
  float lum = dot(col, vec3(.3, .59, .11));
  col = mix(col, vec3(lum), gry * .4) * (1. - gry * .12);

  // ---- ガラス：部屋のうっすらした映りこみと、ふちの屈折のにじみ ----
  float cosv = clamp(vw.z / max(length(vw), .001), 0., 1.);
  float fres = .03 + .5 * pow(1. - cosv, 4.);
  vec3 roomC = skL(vec3(.82, .70, .54)) * mix(.20, .015, nk);
  float rfl = smoothstep(.22, -.02, lp0.y + sz.y * .5 - .1 - .06 * skN1(lp0.x * 3.4 + tp.x * 1.5)) ;
  float sheet = exp(-skQ((lp0.x * .7 - lp0.y * .5 + tp.x * .25 - .12) / .1)) * .5 + exp(-skQ((lp0.x * .7 - lp0.y * .5 + tp.x * .25 + .38) / .035)) * .3;
  col = col + roomC * (fres + .02) * (.5 + rfl * 1.4) + vec3(1., .96, .9) * sheet * mix(.05, .012, nk) * (.5 + fres * 3.);
  float sdw = smoothstep(-.7, .7, lp0.x / (sz.x * .5));
  col = col + mix(vec3(0., .008, .022), vec3(.02, .007, 0.), sdw) * rf * rf * mix(.35, 1., wD);
  if (rain > .01) {
    vec3 dr = skDrops(lp0, t);
    col = mix(col, col * 1.12 + vec3(.02), dr.x * rain);
    col = col * (1. - .3 * dr.y * rain);
    col = col + vec3(.85) * dr.z * .35 * rain * (wD + wS + wN * .3);
  }

  // ふちの内側は枠のかげでほんの少し暗く（奥行きが出る）
  col = col * mix(mix(.62, .8, nk), 1., smoothstep(0., .09, ed));
  return col;
}
`;

// ===== 外の世界（3D・キューブマップ）の窓用：上の SKY_SRC の関数（skH など）を使う、2つの入口 =====
// skCubeDir：窓の面の点から「外のどの向きを見るか」と、キューブマップを引く向き（ボックス投影）を返す。
//   lp0 = 窓の板の中の位置、vw = カメラ − この点（板の中）、wp = この点の世界の位置、xa・ya・za = 板の軸（世界の向き。za は部屋の側）、sz = 窓の大きさ、cen = キューブを焼いた中心、bx = 外の世界の箱の半分の大きさ、par = 窓の位置によるずれをどれだけ補正するか
export const SKY_CUBE_DIR_SRC = `
vec3 skCubeDir(vec2 lp0, vec3 vw, vec3 wp, vec3 xa, vec3 ya, vec3 za, vec2 sz, vec3 cen, vec3 bx, float par) {
  float edx = sz.x * .5 - abs(lp0.x);
  float edy = sz.y * .5 - abs(lp0.y);
  float ed = min(edx, edy);
  float rf = 1. - smoothstep(0., .09, ed);
  float rf2 = rf * rf * .016;
  vec2 ofs = vec2(0., -sign(lp0.y) * rf2);
  if (edx < edy) {
    ofs = vec2(-sign(lp0.x) * rf2, 0.);
  }
  vec2 lp = lp0 + ofs;
  vec2 tp = clamp(vw.xy / max(vw.z, .3), vec2(-1.8), vec2(1.8));
  float ks = 1.1 / sz.y;
  vec3 d = normalize(-za + xa * (lp.x * ks - tp.x * .5) + ya * (lp.y * ks - tp.y * .2 + .2));
  vec3 rel = wp - cen;
  vec3 p = vec3(rel.x * par, rel.y, rel.z * par);
  float tx = 1000000000.;
  float ty = 1000000000.;
  float tz = 1000000000.;
  if (d.x > .0001) {
    tx = (bx.x - p.x) / d.x;
  } else if (d.x < -.0001) {
    tx = (-bx.x - p.x) / d.x;
  }
  if (d.y > .0001) {
    ty = (bx.y - p.y) / d.y;
  } else if (d.y < -.0001) {
    ty = (-cen.y - p.y) / d.y;
  }
  if (d.z > .0001) {
    tz = (bx.z - p.z) / d.z;
  } else if (d.z < -.0001) {
    tz = (-bx.z - p.z) / d.z;
  }
  float tt = min(min(tx, ty), tz);
  return p + d * tt;
}
`;
// skGlass：キューブマップの景色（col0）の上に、窓らしさ（雨・雪・ガラスの映りこみ・ふちの暗さ・水てき）を重ねる
export const SKY_GLASS_SRC = `
vec3 skGlass(vec2 lp0, vec3 vw, float aa, float nk, float t, vec2 sz, vec3 wx, float fine, vec3 col0) {
  vec3 col = col0;
  float edx = sz.x * .5 - abs(lp0.x);
  float edy = sz.y * .5 - abs(lp0.y);
  float ed = min(edx, edy);
  float rf = 1. - smoothstep(0., .09, ed);
  float ys = lp0.y + sz.y * .5;
  vec2 tp = clamp(vw.xy / max(vw.z, .3), vec2(-1.8), vec2(1.8)) - vec2(0., .9);
  float wD = 1. - smoothstep(.1, .5, nk);
  float wN = smoothstep(.5, .9, nk);
  float wS = max(1. - wD - wN, 0.);
  float gry = smoothstep(.55, 1., wx.x);
  float rain = wx.y * fine;
  float snow = wx.z * fine;
  if (rain > .01) {
    float rr = skRain(vec2(lp0.x + tp.x * .3, ys + tp.y * .1), t, 38., 3.4, 3., aa);
    col = col + vec3(.6, .66, .76) * rr * .16 * rain * (wD + wS + .2);
    float rn = skRain(vec2(lp0.x + tp.x * .72, ys + tp.y * .25), t, 15., 4.6, 8., aa);
    col = col + vec3(.7, .76, .86) * rn * .30 * rain * (wD + wS + .25);
  }
  if (snow > .01) {
    float sn = skSnow(vec2(lp0.x + tp.x * .3, ys + tp.y * .1), t, .07, .05, 3.);
    col = col + vec3(.95, .97, 1.) * sn * .5 * snow * (wD + wS + wN * .35);
    float sn2 = skSnow(vec2(lp0.x + tp.x * .72, ys + tp.y * .25), t, .11, .12, 12.);
    col = col + vec3(1.) * sn2 * .7 * snow * (wD + wS + wN * .35);
  }
  float cosv = clamp(vw.z / max(length(vw), .001), 0., 1.);
  float fres = .03 + .5 * pow(1. - cosv, 4.);
  vec3 roomC = skL(vec3(.82, .70, .54)) * mix(.20, .015, nk);
  float rfl = smoothstep(.22, -.02, lp0.y + sz.y * .5 - .1 - .06 * skN1(lp0.x * 3.4 + tp.x * 1.5));
  float sheet = exp(-skQ((lp0.x * .7 - lp0.y * .5 + tp.x * .25 - .12) / .1)) * .5 + exp(-skQ((lp0.x * .7 - lp0.y * .5 + tp.x * .25 + .38) / .035)) * .3;
  col = col + roomC * (fres + .02) * (.5 + rfl * 1.4) + vec3(1., .96, .9) * sheet * mix(.05, .012, nk) * (.5 + fres * 3.);
  float sdw = smoothstep(-.7, .7, lp0.x / (sz.x * .5));
  col = col + mix(vec3(0., .008, .022), vec3(.02, .007, 0.), sdw) * rf * rf * mix(.35, 1., wD);
  if (rain > .01) {
    vec3 dr = skDrops(lp0, t);
    col = mix(col, col * 1.12 + vec3(.02), dr.x * rain);
    col = col * (1. - .3 * dr.y * rain);
    col = col + vec3(.85) * dr.z * .35 * rain * (wD + wS + wN * .3);
  }
  col = col * mix(mix(.62, .8, nk), 1., smoothstep(0., .09, ed));
  return col;
}
`;
