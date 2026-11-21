// 窓の外の景色：1枚の板の中に、空（大気のグラデーション・太陽のにじみ）・fbm の雲・かすむ山なみ・町なみ（夜は窓あかり・車のライト）・手前の木と生け垣を重ねて見せる（板ポリゴンは増やさない）。
// 絵（テクスチャ）は使わず、全部シェーダーの中で計算する（式は skysrc.js。WebGPU 版も同じ式を使う）。
// 見る角度で重なりがずれて奥行きが出る（遠いほどずれが小さく、手前ほど大きい）。電気のオン・オフ（SKY.night）で、昼 ↔ 夕方 ↔ 夜へなめらかに変わる。
// 動き（雲が流れる・木がゆれる・星がまたたく）は SKY.time で決まる。時間は scene.js が「描いたときだけ」進めるので、止まっている間は描き直しが増えない。
// 天気（晴れ・くもり・雨・雪）は、その日の日付から決まる（SKY.wx）。細かいもの（鳥・車・雨雪・蛍・流れ星）は、画質が「標準」のときは省く（SKY.fine = 0）。
import * as THREE from 'three';
import { gpuPre, GPU } from './scenegpu.js?v=202611211556';
import { SKY_SRC, SKY_CUBE_DIR_SRC, SKY_GLASS_SRC } from './skysrc.js?v=202611211556';

// 日付から決める天気。cover = くもりぐあい（0 快晴〜1 どんより）、rain・snow = 雨・雪の強さ
function dayWeather() {
  let force = '';
  try { force = new URLSearchParams(location.search).get('wx') || ''; } catch (e) {}
  const d = new Date(), key = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
  const hr = k => { const x = Math.sin(key * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const r = hr(1), fair = .18 + hr(2) * .24, snowOk = d.getMonth() === 11 || d.getMonth() <= 1;
  let k = force || (r < .56 ? 'fair' : r < .76 ? 'part' : r < .86 ? 'cloudy' : r < .94 ? 'rain' : snowOk ? 'snow' : 'cloudy');
  if (k === 'snow' && !snowOk && !force) k = 'cloudy';
  const W = { clear: [.08, 0, 0], fair: [fair, 0, 0], part: [.5, 0, 0], cloudy: [1, 0, 0], rain: [.95, .9, 0], snow: [.9, 0, .9] };
  const v = W[k] || W.fair;
  return new THREE.Vector3(v[0], v[1], v[2]);
}

// 全部の窓で共有する値：night = 0（昼）〜1（夜）、time = 秒、fine = 細かいものを描くか（0/1）、wx = 天気（くもり・雨・雪）
export const SKY = { night: { value: 0 }, time: { value: 0 }, fine: { value: 1 }, wx: { value: dayWeather() } };
// 外の世界（3D）をキューブマップに焼いたもの（exterior.js が焼く）。a = 昼、b = 夜（night で混ぜる）、k = 0（今のシェーダーの景色）〜 1（キューブマップ）のつなぎ、ctr = 焼いた中心（世界の座標）、box = 外の世界の箱の半分の大きさ、par = 窓の位置によるずれの補正の強さ
SKY.cube = { a: { value: null }, b: { value: null }, k: { value: 0 }, ctr: { value: new THREE.Vector3(0, 1.7, 0) }, box: { value: new THREE.Vector3(30, 70, 30) }, par: { value: .6 } };
SKY.cubeG = { a: { value: null }, b: { value: null }, k: { value: 0 } };   // WebGPU の窓用（WebGL のサムネイルの窓とは別の入れもの）

const VERT_DECL = 'varying vec2 vLp; varying vec3 vVw; varying float vPan; varying vec3 vWp, vXa, vYa, vZa;';
// 見ている人（カメラ）の向き vVw = 板の中での「カメラ − この点」。vPan = 壁にそった位置（同じ壁の窓どうしで景色がつながる）
const VERT_BODY = `
  vLp = position.xy;
  vec3 camL = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  vVw = camL - position;
  vPan = dot(modelMatrix[3].xyz, normalize(modelMatrix[0].xyz));
  vWp = (modelMatrix * vec4(position, 1.0)).xyz; vXa = normalize(modelMatrix[0].xyz); vYa = normalize(modelMatrix[1].xyz); vZa = normalize(modelMatrix[2].xyz);`;
const FRAG_DECL = `
uniform float uNight, uTime, uGain, uFine, uCubeK, uPar; uniform vec2 uSize; uniform vec3 uWx, uCtr, uBox; uniform samplerCube uCubeA, uCubeB;
varying vec2 vLp; varying vec3 vVw; varying float vPan; varying vec3 vWp, vXa, vYa, vZa;
${SKY_SRC}
${SKY_CUBE_DIR_SRC}
${SKY_GLASS_SRC}`;
const FRAG_BODY = `
  float nk = clamp(uNight, 0.0, 1.0);
  float aa = max(fwidth(vLp.x), 1e-4);
  vec3 skOld = vec3(0.0);
  if (uCubeK < .999) skOld = skyScene(vLp, vVw, vPan, aa, nk, uTime, uSize, uFine, uWx);
  vec3 skCol = skOld;
  if (uCubeK > .001) {   // 外の世界（3D）：キューブマップを見る向きで引き、窓らしさを重ねる。つなぎの間は今のシェーダーの景色とまぜる
    vec3 cdir = skCubeDir(vLp, vVw, vWp, vXa, vYa, vZa, uSize, uCtr, uBox, uPar);
    vec3 cc = mix(textureCube(uCubeA, cdir).rgb, textureCube(uCubeB, cdir).rgb, nk);
    cc = skGlass(vLp, vVw, aa, nk, uTime, uSize, uWx, uFine, cc);
    skCol = mix(skOld, cc, uCubeK);
  }
  diffuseColor.rgb = skCol * mix(uGain, 1.05, nk);`;

// 窓の景色の材質。w×h は窓の大きさ（m）。ここで作るのは WebGL の材質（サムネイルも WebGL で描くので、いつもこれ）。
// WebGPU で描くときは、scenegpu.js の configureRenderer が userData.gpuNode を見て、同じ式（skysrc.js）を WGSL にして使う skyview_tsl.js の材質に差しかえる
export function skyMat(w, h, gain) {
  const sz = new THREE.Vector2(w, h), m = new THREE.MeshBasicMaterial({ color: 0xffffff }), gn = { value: gain || .82 };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uNight: SKY.night, uTime: SKY.time, uFine: SKY.fine, uWx: SKY.wx, uSize: { value: sz }, uGain: gn, uCubeK: SKY.cube.k, uPar: SKY.cube.par, uCtr: SKY.cube.ctr, uBox: SKY.cube.box, uCubeA: SKY.cube.a, uCubeB: SKY.cube.b });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VERT_DECL).replace('#include <begin_vertex>', '#include <begin_vertex>' + VERT_BODY);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + FRAG_DECL).replace('#include <map_fragment>', '#include <map_fragment>' + FRAG_BODY);
  };
  m.customProgramCacheKey = () => GPU.on ? 'kojo-skyview-3:' + w + 'x' + h + ':' + (gain || .82) : 'kojo-skyview-3';   // WebGL：窓の大きさ・明るさは材質ごとの値（uniform）なので、プログラム（重いシェーダー）は全部の窓で1つを使いまわす。WebGPU：同じ key の窓は最初の1つの値（窓の大きさ）を使いまわされるので、大きさ・明るさごとに別にする
  m.userData.gpuNode = () => { const g = gpuPre(); return g && g.sky ? g.sky(SKY, null, w, h, gain) : null; };
  m.userData.skyWin = true;   // 窓の材質の印（exterior.js が、窓が見えているかを調べるのに使う）
  m.clone = () => skyMat(w, h, gain);   // 置くときの半透明ゴーストは、同じ景色の材質を作り直す
  return m;
}
