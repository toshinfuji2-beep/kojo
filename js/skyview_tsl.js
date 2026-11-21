// 窓の外の景色の WebGPU 版。skyview.js の WebGL 版（GLSL）と、まったく同じ式（skysrc.js）を使う。
// skysrc.js の式は「WGSL に直せる小さな GLSL」で書いてあり、ここで機械的に WGSL に書きかえて、TSL の wgslFn（1つの関数ノード）として呼ぶ。だから WebGL と WebGPU の見た目はいつもそろう。
// three/webgpu を読むので、WebGPU で描く端末のときだけ scenegpu.js が読み込む（ふだんの端末は取りに行かない）。
import * as WG from 'three/webgpu';
import { SKY_SRC, SKY_CUBE_DIR_SRC, SKY_GLASS_SRC } from './skysrc.js?v=202611211556';

const { Fn, float, vec4, uniform, varying, positionLocal, modelWorldMatrix, modelWorldMatrixInverse, cameraPosition,
  mix, clamp, dot, fwidth, max, wgslFn, cubeTexture, If, vec3, renderGroup, MeshBasicNodeMaterial } = WG;

// GLSL（skysrc.js）→ WGSL。関数ごとに分け、型・変数宣言・コンストラクタを書きかえる。入口（最後の関数）を先頭に置く（wgslFn は先頭の関数を入口にして、残りを後ろにそのままつなぐ）
const TY = { float: 'f32', int: 'i32', vec2: 'vec2<f32>', vec3: 'vec3<f32>', vec4: 'vec4<f32>' };
export function toWgsl(src) {
  const fns = [];
  src = src.replace(/\r\n/g, '\n');   // 改行コードがCRLFでもそのまま読めるように
  src.replace(/^(float|vec2|vec3|vec4)\s+(\w+)\(([^)]*)\)\s*\{\n([\s\S]*?)\n\}/gm, (m, rt, name, params, body) => {
    const ps = params.split(',').map(s => s.trim()).filter(Boolean).map(s => { const [t, n] = s.split(/\s+/); return n + ': ' + TY[t]; }).join(', ');
    const b = body
      .replace(/\b(float|int|vec2|vec3|vec4)\s+(\w+)\s*=/g, (mm, t, n) => 'var ' + n + ': ' + TY[t] + ' =')
      .replace(/\bvec([234])\(/g, 'vec$1<f32>(')
      .replace(/\bfloat\(/g, 'f32(').replace(/\bint\(/g, 'i32(');
    fns.push({ name, code: 'fn ' + name + '(' + ps + ') -> ' + TY[rt] + ' {\n' + b + '\n}' });
    return m;
  });
  const main = fns.pop();
  return [main.code].concat(fns.map(f => f.code)).join('\n');
}

let uNight = null, uTime = null, uFine = null, uWx = null, skyFn = null, dirFn = null, glassFn = null, uCubeK = null, uCtr = null, uBox = null, uPar = null, cubePh = null; const cubeSync = [];
// 全部の窓で共有する値（night・time・fine・wx）。描くたびに SKY の値をうつす
function shared(SKY) {
  if (!uNight) {
    uNight = uniform(0); uTime = uniform(0); uFine = uniform(1); uWx = uniform(new WG.Vector3(0, 0, 0));
    uNight.onRenderUpdate(() => { uNight.value = SKY.night.value; });
    uTime.onRenderUpdate(() => { uTime.value = SKY.time.value; });
    uFine.onRenderUpdate(() => { uFine.value = SKY.fine.value; });
    uWx.onRenderUpdate(() => { uWx.value.copy(SKY.wx.value); });
    skyFn = wgslFn(toWgsl(SKY_SRC));
    // 外の世界（3D）：キューブマップを見る向き（ボックス投影）と、窓らしさの重ねがけ。glassFn は skyFn の補助の関数（skH など）をそのまま使う
    dirFn = wgslFn(toWgsl(SKY_CUBE_DIR_SRC)); glassFn = wgslFn(toWgsl(SKY_GLASS_SRC), [skyFn]);
    uCubeK = uniform(0); uCtr = uniform(new WG.Vector3(0, 1.7, 0)); uBox = uniform(new WG.Vector3(30, 70, 30)); uPar = uniform(.6);
    cubePh = [new WG.WebGLCubeRenderTarget(4).texture, new WG.WebGLCubeRenderTarget(4).texture];   // 焼きあがるまでの、からのキューブマップ
    [uNight, uTime, uFine, uWx, uCubeK, uCtr, uBox, uPar].forEach(u => u.setGroup(renderGroup));   // 全部の窓で同じ値は、「描画ごとに1回」の共有の入れものに（物ごとの入れものだと、動かない窓は値が古いまま）
    uCubeK.onRenderUpdate(() => { uCubeK.value = SKY.cubeG.k.value; uCtr.value.copy(SKY.cube.ctr.value); uBox.value.copy(SKY.cube.box.value); uPar.value = SKY.cube.par.value; cubeSync.forEach(f => f()); });
  }
}

// w×h = 窓の大きさ（m）、SKY = { night, time, fine, wx }（T は昔の絵の入れ物。もう使わない）
export function skyNodeMat(SKY, T, w, h, gain) {
  shared(SKY);
  const uSize = uniform(new WG.Vector2(w, h)), uGain = uniform(gain || .82);
  // 頂点側：板の中の位置 vLp、見ている人の向き vVw（カメラ − この点）、壁にそった位置 vPan（同じ壁の窓どうしで景色がつながる）
  const vLp = varying(positionLocal.xy, 'skLp');
  const camL = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz;
  const vVw = varying(camL.sub(positionLocal), 'skVw');
  const vPan = varying(dot(modelWorldMatrix.mul(vec4(0, 0, 0, 1)).xyz, modelWorldMatrix.mul(vec4(1, 0, 0, 0)).xyz.normalize()), 'skPan');
  const axis = (x, y, z) => varying(modelWorldMatrix.mul(vec4(x, y, z, 0)).xyz.normalize(), 'skA' + x + y + z);
  const vWp = varying(modelWorldMatrix.mul(vec4(positionLocal, 1)).xyz, 'skWp'), vXa = axis(1, 0, 0), vYa = axis(0, 1, 0), vZa = axis(0, 0, 1);
  const cdir = dirFn({ lp0: vLp, vw: vVw, wp: vWp, xa: vXa, ya: vYa, za: vZa, sz: uSize, cen: uCtr, bx: uBox, par: uPar });
  const cA = cubeTexture(cubePh[0], cdir), cB = cubeTexture(cubePh[1], cdir);
  cubeSync.push(() => { if (SKY.cubeG.a.value && cA.value !== SKY.cubeG.a.value) cA.value = SKY.cubeG.a.value; if (SKY.cubeG.b.value && cB.value !== SKY.cubeG.b.value) cB.value = SKY.cubeG.b.value; });
  const m = new MeshBasicNodeMaterial();
  m.colorNode = Fn(() => {
    const nk = clamp(uNight, 0, 1);
    const aa = max(fwidth(vLp.x), 1e-4);   // 画面の1ピクセルの大きさ（m）。微分は分岐の外で計算して渡す
    const old = vec3(0, 0, 0).toVar();
    If(uCubeK.lessThan(.999), () => { old.assign(skyFn({ lp0: vLp, vw: vVw, pan: vPan, aa, nk, t: uTime, sz: uSize, fine: uFine, wx: uWx })); });
    // 外の世界（3D）。キューブマップの引きは分岐の外（微分が要るため）。焼けるまでは uCubeK = 0 で、今の景色のまま
    const cc = glassFn({ lp0: vLp, vw: vVw, aa, nk, t: uTime, sz: uSize, wx: uWx, fine: uFine, col0: mix(cA.rgb, cB.rgb, nk) });
    const c = mix(old, cc, uCubeK);
    return vec4(c.mul(mix(uGain, float(1.05), nk)), 1.0);
  })();
  m.fog = false;
  m.customProgramCacheKey = () => 'kojo-skynode-3:' + w + 'x' + h + ':' + (gain || .82);   // 同じ key の材質は式と値を使いまわされるので、窓の大きさ・明るさごとに別にする
  return m;
}
