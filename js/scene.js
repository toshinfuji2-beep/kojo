// レンダラ・カメラ・ライト・ポスト処理・部屋（床と奥2面の壁）
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { GPU, gpuPre, makePost, gpuFail, gpuDirty, isWebKit } from './scenegpu.js?v=202611211556';
import { CFG, ITEM, houseBox, roomAt, wallPlan, entryPoint } from './data.js?v=202611211556';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { wallCanvas, floorCanvas, canvasToTex, texHook, loadTex, FLOOR_PBR, WALL_PBR, ANISO, doormatTex, domaTex, sharedTex } from './textures.js?v=202611211556';
import { SKY } from './skyview.js?v=202611211556';
import { outInit, outHouse, outTick, outBgRange, outBgFull, OUT_M } from './outside.js?v=202611211556';
import { extInit, extHouse, extLite, extTick, extPending, extBakeNow } from './exterior.js?v=202611211556';
import { roofInit, roofHouse, roofTick, roofRise, roofShake } from './roof.js?v=202611211556';   // 引いて見たときの外から見た家（屋根・外壁・窓・玄関。roof.js）

export const WH = CFG.WALL_H;
// 夕方〜夜の電球色（2700Kあたりのアンバー）。部屋の中はあたたかく、影はやわらかく。窓の外の青さは窓の絵(textures.js sky)で出す
const DAY = { exp: 1.15, env: .5, hemi: .48, hemiC: 0xffd9a4, gnd: 0xb88458, sun: 2.6, sunC: 0xffc480, fill: .48, fillC: 0xc8d0ee };
// 電気を消した夜：灰色に色が抜けないよう、環境光（白っぽい）はほぼ切り、青い半球光・月の光で濃い青に染める
const NIGHT = { exp: 1.2, env: .05, hemi: .5, hemiC: 0x4a62d0, gnd: 0x2a2f78, sun: .7, sunC: 0x7a96ff, fill: .3, fillC: 0x5a6fd0 };
const IOS_EXP = .94;   // iPhone の画面（P3・明るい）で昼の床・壁が白飛びしないよう、露出を少し下げる
const PITCH = 34 * Math.PI / 180, BASE_YAW = 45 * Math.PI / 180, MAXYAW = 35 * Math.PI / 180, FOV = 22;
export const isSmall = () => (('ontouchstart' in window) || navigator.maxTouchPoints > 0) || Math.min(innerWidth, innerHeight) < 500;
export const cam = { yaw: 0, zoom: 1, panx: 0, pany: 0, h: 0, tgt: 0, dirty: true, mode: 'iso', ca: null, cp: 0, cty: 0 };
// カメラの向き：iso=いつもの斜め（ドラッグで回せる）/ top=真上 / wallL・wallR=その壁を正面から（壁かけを置きやすい）
const VIEWS = { iso: null, top: { a: 0, p: 88.5 * Math.PI / 180, ty: 0 }, wallL: { a: Math.PI / 2, p: 6 * Math.PI / 180, ty: CFG.WALL_H * .5 }, wallR: { a: 0, p: 6 * Math.PI / 180, ty: CFG.WALL_H * .5 } };
export function setCamMode(m) { if (!(m in VIEWS)) m = 'iso'; if (cam.mode === 'eye' || EYE.tr) { EYE.tr = null; EYE.feed = null; EYE.has = false; EYE.drag = false; } cam.mode = m; cam.yaw = 0; cam.zoom = 1; cam.panx = cam.pany = 0; cam.dirty = true; }
// ドラッグで自由に回す（free）：横=左右の向き（360°ぐるっと）、縦=見下ろす角度（ほぼ真横〜真上）
const P_MIN = 6 * Math.PI / 180, P_MAX = 88.5 * Math.PI / 180;
const tyOf = p => { const d = p * 180 / Math.PI; return d <= 34 ? CFG.WALL_H * (.5 - .15 * (d - 6) / 28) : CFG.WALL_H * .35 * (1 - (d - 34) / 54.5); };   // 見る高さ：横から=壁の中ほど、真上=床
export function orbit(dx, dy) {
  if (cam.mode !== 'free') { cam.fa = cam.ca != null ? cam.ca : BASE_YAW; cam.fp = cam.ca != null ? cam.cp : PITCH; cam.mode = 'free'; }
  cam.fa += dx;   // 横はぐるっと 360°（制限なし）
  cam.fp = Math.max(P_MIN, Math.min(P_MAX, cam.fp + dy)); cam.dirty = true;
}
export const E = {};   // renderer, scene, camera, itemsG, fxG, ...
// 目線の間、自分の体は「カメラには映さず、影だけ落とす」：体をレイヤー1だけに入れる（メインのカメラはレイヤー0だけ見る）。影を描くときだけ、影のカメラがレイヤー1も見る
const EYE_BODY_L = 1;
export function eyeBody(g, hide) {   // 体の全部（スプライト含む）のレイヤーを切りかえる。変えたら true
  const m = hide ? 1 << EYE_BODY_L : 1; let ch = false;
  g.traverse(o => { if (o.layers.mask !== m) { o.layers.mask = m; ch = true; } });
  return ch;
}
let mobile = false, ios = false, quality = 'std', pool = [], gridLines = null, roomG = null, sun = null, fill = null, ownedTex = [];
let DL = [], roofWant = false, doorK = -1, SG = {}, hBox = { x0: 0, z0: 0, x1: 6, z1: 6 }, rBox = { x0: 0, z0: 0, x1: 6, z1: 6 }, curRooms = [];
let gp = null;   // WebGPU の後処理（scenegpu.js）。null なら従来の composer の経路
const caps = () => { const r = E.renderer; if (!GPU.on) return { tex: r.capabilities.maxTextureSize || 4096, ms: r.capabilities.maxSamples || 4, an: r.capabilities.getMaxAnisotropy() || 4 }; const l = (r.backend && r.backend.device && r.backend.device.limits) || {}; return { tex: l.maxTextureDimension2D || 4096, ms: 4, an: 16 }; };   // WebGPU の MSAA は4まで
let composer = null, gtao = null, bloom = null, smaa = null, gtaoScale = 1, blob = null, effQ = 'std', moving = false, moveT = 0, camSig = '';

// 家のまわりの背景（空）と庭は js/outside.js（朝・昼・晩の時計で変わる。電気のオン・オフでは変わらない）
function blobTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d'), g = c.createRadialGradient(128, 128, 20, 128, 128, 128);
  g.addColorStop(0, 'rgba(70,40,15,.6)'); g.addColorStop(.55, 'rgba(70,40,15,.24)'); g.addColorStop(1, 'rgba(70,40,15,0)');
  c.fillStyle = g; c.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const DBG = new URLSearchParams(location.search);
export function initScene(canvas, stage) {
  mobile = isSmall(); ios = mobile && isWebKit();   // ios = iPhone・iPad（WebKit）。?dev=ios で PC でも確認できる
  const pre = gpuPre(), r = pre ? pre.r : new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });   // WebGPU が使えるときだけ新しい経路（main.js が boot の前に準備する）
  Object.assign(E, { renderer: r });
  if (!GPU.on) { const sr = r.shadowMap.render.bind(r.shadowMap); r.shadowMap.render = (ls, sc, cm) => { cm.layers.enable(EYE_BODY_L); try { sr(ls, sc, cm); } finally { cm.layers.disable(EYE_BODY_L); } }; }   // WebGL：影の描画のあいだだけ、カメラがレイヤー1も見る
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = DAY.exp * (ios ? IOS_EXP : 1);
  r.shadowMap.enabled = true; r.shadowMap.type = GPU.on ? THREE.PCFShadowMap : DBG.get('sm') === 'pcf' || ios ? THREE.PCFSoftShadowMap : THREE.VSMShadowMap;   // WebGPU 版の VSM（three r170）は GPU のエラーになるので PCF（ぼかしの広さ＝radius を画質で変えられる）
  ANISO.v = Math.max(4, Math.min(16, caps().an));   // 模様は GPU が出せる最大の細かさで（斜めから見てもぼやけない）
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(FOV, 1, 1, 600);
  if (GPU.on) camera.coordinateSystem = pre.WG.WebGPUCoordinateSystem;   // 奥行きの向きを WebGPU 用に（これを先に決めておかないと、描くたびに投影行列が作り直される）
  scene.background = outInit(scene, { onDirty: () => { cam.dirty = true; }, aspect: () => (E.W || 16) / (E.H || 10) });   // 背景の空と庭（outside.js）
  Object.assign(E, { renderer: r, scene, camera, stage, canvas }); roofInit(scene);
  // 環境光（室内の反射・拡散）
  const pm = GPU.on ? new pre.WG.PMREMGenerator(r) : new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  scene.environmentIntensity = DAY.env;
  E.hemi = new THREE.HemisphereLight(DAY.hemiC, 0xa07850, DAY.hemi); scene.add(E.hemi);
  sun = new THREE.DirectionalLight(DAY.sunC, DAY.sun); sun.castShadow = true; sun.shadow.bias = ios ? -0.0004 : -0.0006; sun.shadow.normalBias = ios ? 0.03 : 0.02; sun.shadow.radius = 4; sun.shadow.blurSamples = 25; scene.add(sun, sun.target); E.sun = sun;
  if (GPU.on) { const ly = sun.shadow.camera.layers; let mk = ly.mask; Object.defineProperty(ly, 'mask', { get: () => mk | (1 << EYE_BODY_L), set: v => { mk = v; }, configurable: true }); }   // WebGPU：影のカメラ（毎回メインのカメラのレイヤーで上書きされる）が、いつもレイヤー1も見る
  fill = new THREE.DirectionalLight(DAY.fillC, DAY.fill); scene.add(fill, fill.target);
  roomG = new THREE.Group(); E.itemsG = new THREE.Group(); E.fxG = new THREE.Group(); E.othersG = new THREE.Group(); E.roomPick = roomG; scene.add(roomG, E.itemsG, E.fxG, E.othersG);   // itemsG / fxG = 今いる部屋のローカル座標、othersG = ほかの部屋の家具（家の座標）
  blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.renderOrder = -1; scene.add(blob);
  for (let i = 0; i < 6; i++) { const p = new THREE.PointLight(0xffb060, 0, 7, 1.8); p.visible = false; scene.add(p); pool.push(p); }
  texHook.onLoad = () => { cam.dirty = true; };
  if (GPU.on) {
    try { gp = makePost(scene, camera); } catch (e) { console.error('gpu post', e); gpuFail('post: ' + (e && e.message || e)); }
  } else try {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(r, rt);
    composer.addPass(new RenderPass(scene, camera));
    gtao = new GTAOPass(scene, camera, 512, 512);
    gtao.updateGtaoMaterial({ radius: .5, distanceExponent: 1.2, thickness: 1.5, scale: 1.8, samples: 16, distanceFallOff: 1 });
    gtao.updatePdMaterial({ lumaPhi: 24, depthPhi: 3, normalPhi: 8, radius: 20, rings: 3, samples: 16 });
    // 法線は深度から再構成（法線RTを使うと環境によって壁に黒い四角が出るため）＋数値誤差のNaN対策
    { const m = gtao.gtaoMaterial; m.fragmentShader = m.fragmentShader.replace('sqrt(1. - cosHorizons * cosHorizons)', 'sqrt(max(vec2(0.), 1. - cosHorizons * cosHorizons))').replace('acos(cosHorizons.y) - acos(cosHorizons.x)', 'acos(clamp(cosHorizons.y, -1., 1.)) - acos(clamp(cosHorizons.x, -1., 1.))').replace('float nx = dot', 'cosHorizons = clamp(cosHorizons, -1., 1.); float nx = dot'); m.defines.NORMAL_VECTOR_TYPE = 0; m.needsUpdate = true; }
    gtao.blendIntensity = 1.0;
    // 陰影(GTAO)は全部の物を別の素材に置きかえて奥行き・向きを描くので、名札・♪のスプライトの四角い板まで物あつかいされ、
    // 壁ぎわで頭の上に明るい四角（壁の板のようなもの）が浮き出る。陰影を計算する間だけスプライトを隠す（色の絵はすでに描いてある）
    { const gr = gtao.render.bind(gtao); gtao.render = (...a) => { const hid = []; scene.traverseVisible(o => { if (o.isSprite || o.userData.noAO) hid.push(o); }); hid.forEach(o => { o.visible = false; }); try { gr(...a); } finally { hid.forEach(o => { o.visible = true; }); } }; }
    // 陰影のぼかしを2回重ねる（WebGPU 版と同じ。1回だと物のふちに粒が残る）。2回目は別のノイズ絵で、1回目の結果を半分の半径でもう一度ぼかす
    const pd2m = (() => { const u = gtao.pdMaterial.uniforms, sv = ['tDiffuse', 'tNormal', 'tDepth'].map(k => [k, u[k].value]); sv.forEach(([k]) => { u[k].value = null; }); try { return gtao.pdMaterial.clone(); } finally { sv.forEach(([k, v]) => { u[k].value = v; }); } })(); pd2m.uniforms.tNoise.value = gtao.generateNoise(); let pd2rt = gtao.pdRenderTarget.clone();
    { const rp = gtao.renderPass.bind(gtao);
      gtao.renderPass = (rd, mat, rt, ...a) => {
        rp(rd, mat, rt, ...a);
        if (mat !== gtao.pdMaterial || DBG.get('pd2') === '0') return;
        const m1 = gtao.pdMaterial, u1 = m1.uniforms, u2 = pd2m.uniforms;
        for (const k of ['tNormal', 'tDepth', 'resolution', 'cameraProjectionMatrixInverse', 'lumaPhi', 'depthPhi', 'normalPhi']) u2[k].value = u1[k].value;
        u2.radius.value = Math.max(1, u1.radius.value * .5); u2.tDiffuse.value = gtao.pdRenderTarget.texture;
        let ch = false; for (const k in m1.defines) if (pd2m.defines[k] !== m1.defines[k]) { pd2m.defines[k] = m1.defines[k]; ch = true; } if (ch) pd2m.needsUpdate = true;
        rp(rd, pd2m, pd2rt, 0xffffff, 1.0);
        [gtao.pdRenderTarget, pd2rt] = [pd2rt, gtao.pdRenderTarget];   // 仕上がりを pdRenderTarget に（このあとの合成はそこから読む）
      }; }
    const so = gtao.setSize.bind(gtao); gtao.setSize = (w, h) => { const sw = Math.max(2, w * gtaoScale | 0), sh = Math.max(2, h * gtaoScale | 0); so(sw, sh); pd2rt.setSize(sw, sh); };
    if (DBG.get('only') !== '1') composer.addPass(gtao);
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .26, .6, 1.1); if (DBG.get('only') !== '1') composer.addPass(bloom);
    composer.addPass(new OutputPass());
    smaa = new SMAAPass(1, 1); smaa.enabled = false; composer.addPass(smaa);   // 縁のギザギザ取り（最後に。MSAA で取りきれない細い線・影の縁を整える）
  } catch (e) { console.error('composer', e); composer = null; }
  extInit(r, { mobile, onDirty: () => { cam.dirty = true; }, canBake: () => !holdFrame });   // 窓の外の世界（3D）：窓が見えてから、空いている時間に焼く（exterior.js）
  setQuality(quality);
  if (gtao && DBG.get('ao') === '0') gtao.enabled = false;
  if (bloom && DBG.get('bloom') === '0') bloom.enabled = false;
  resize();
}
export function qualityDefault() { return 'std'; }   // はじめは「標準」（設定で高・最高を選んだ人は、その選んだ画質のまま）
// 画質の3段階。pr=描く細かさ（画面の何倍の点数で描くか。超えると縮小して滑らかに＝スーパーサンプリング）、shadow=影の細かさ、msaa=縁のなめらかさ
function qcfg(q) {
  const dpr = window.devicePixelRatio || 1, { tex: maxTex, ms: maxMs } = caps();
  // iPhone（WebKit）：dpr 3 を全部使うと GPU が重いので、標準 2・高 2.5（総画素数でも抑える）・最高 3。MSAA は 4 まで（iOS の WebGL2 の実用上限）、SMAA は高から。影は PCFSoft の 2048。陰影は高から（半分の解像度・サンプル少なめ＋デノイズ）
  if (ios) {
    if (q === 'ultra') return { pr: Math.min(dpr, 3), shadow: Math.min(2048, maxTex), gtao: true, gscale: .5, gs: 16, pd: { radius: 16, rings: 3, samples: 16 }, msaa: Math.min(4, maxMs), smaa: true, lights: 3 };
    if (q === 'high') return { pr: Math.min(dpr, 2.5), shadow: Math.min(2048, maxTex), gtao: true, gscale: .5, gs: 16, pd: { radius: 14, rings: 3, samples: 16 }, msaa: Math.min(4, maxMs), smaa: true, lights: 2 };
    return { pr: Math.min(dpr, 2), shadow: Math.min(2048, maxTex), gtao: false, gscale: .5, gs: 8, pd: { radius: 9, rings: 3, samples: 16 }, msaa: Math.min(4, maxMs), smaa: false, lights: 2 };
  }
  if (q === 'ultra') return { pr: Math.min(Math.max(dpr * 1.5, 2), 4), shadow: Math.min(mobile ? 3072 : 4096, maxTex), gtao: true, gscale: 1, gs: 16, pd: { radius: 20, rings: 4, samples: 24 }, msaa: Math.min(16, maxMs), smaa: true, lights: mobile ? 3 : 6 };
  if (q === 'high') return { pr: mobile ? Math.min(dpr, 3) : (dpr < 2 ? 2 : Math.min(dpr, 3)), shadow: Math.min(mobile ? 2048 : 3072, maxTex), gtao: true, gscale: .5, gs: 16, pd: { radius: 20, rings: 3, samples: 16 }, msaa: Math.min(8, maxMs), smaa: true, lights: mobile ? 2 : 5 };
  return { pr: Math.min(dpr, 2), shadow: mobile ? 2048 : 1024, gtao: !mobile, gscale: .5, gs: 8, pd: { radius: 20, rings: 3, samples: 16 }, msaa: Math.min(4, maxMs), smaa: false, lights: mobile ? 2 : 3 };   // スマホの標準は陰影なし（重いので）
}
let curCfg = null;
const SHADOW_R_GPU = { std: 2, high: 3, ultra: 4 };
// いまの画面の大きさと動き中かどうかから、実際の pixelRatio を決める（総画素数・テクスチャ上限をこえない。動いている間は軽く）
function targetPR() {
  const c = curCfg, W = E.W || 1, H = E.H || 1, maxTex = caps().tex;
  let pr = Math.min(c.pr, Math.sqrt((ios ? 4.2e6 : 22e6) / (W * H)), maxTex / Math.max(W, H));   // iPhone は総画素数を 420 万までに（GPU・メモリを守る）
  return Math.max(.75, pr);
}
function applyPR() {
  const pr = targetPR(), r = E.renderer; if (Math.abs(r.getPixelRatio() - pr) < 1e-3) return;
  r.setPixelRatio(pr); if (composer) { composer.setPixelRatio(pr); composer.setSize(E.W, E.H); }
}
// q = ユーザーが選んだ画質（保存はしない・保存は呼び出し側）。effQ = いま実際に使っている画質（重いと自動で下がる）
function aoApply(c) {
  if (gtao) { gtao.enabled = c.gtao; gtaoScale = c.gscale; gtao.updateGtaoMaterial({ samples: c.gs }); gtao.updatePdMaterial(Object.assign({ lumaPhi: 24, depthPhi: 3, normalPhi: 8 }, c.pd, DBG.get('pdr') ? { radius: +DBG.get('pdr') } : {})); }
}
export function setQuality(q) { quality = q; applyQuality(q); }
function applyQuality(q) {
  effQ = q; const c = curCfg = qcfg(q);
  extLite(q === 'std');   // 標準の画質では、外の世界も簡単に（物を減らす・影なし）
  SKY.fine.value = q === 'std' ? 0 : 1;   // 窓の外の細かいもの（鳥・車・雨雪・蛍・流れ星）は、標準の画質では描かない
  if (GPU.on) c.shadow = Math.min(mobile ? 2048 : 3072, caps().tex);   // WebGPU 版は影の大きさを途中で変えると GPU がエラーを出すので、画質によらず一定
  if (GPU.on) sun.shadow.radius = q === 'ultra' ? SHADOW_R_GPU.ultra : q === 'high' ? SHADOW_R_GPU.high : SHADOW_R_GPU.std;   // WebGPU：影のふちのやわらかさ（画質「最高」ほどふんわり。WebGL の VSM に近づける）
  if (sun.shadow.mapSize.x !== c.shadow) { sun.shadow.mapSize.set(c.shadow, c.shadow); if (sun.shadow.map && !GPU.on) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  if (composer) for (const t of [composer.renderTarget1, composer.renderTarget2]) if (t.samples !== c.msaa) { t.samples = c.msaa; t.dispose(); }
  aoApply(c);   // 陰影の粒（ノイズ）は半分の解像度だとなめらかにぼける。全解像度にするとざらざらの粒が縁に出るので、最高だけ全解像度＋強めのぼかし
  if (smaa) smaa.enabled = c.smaa;
  if (bloom) bloom.strength = mobile ? .2 : .28;
  if (gp) gp.apply(c, mobile ? .2 : .28, { ao: DBG.get('ao') !== '0' && DBG.get('only') !== '1', bloom: DBG.get('bloom') !== '0' && DBG.get('only') !== '1' });
  moving = false; clearTimeout(moveT);
  resize(); cam.dirty = true;
}
export function resize() {
  if (holdFrame) return;   // 写真を撮っている間は大きさを変えない（終わったあとに合わせ直す）
  const s = E.stage.getBoundingClientRect(), w = Math.max(1, Math.round(s.width)), h = Math.max(1, Math.round(s.height));
  if (w === E.W && h === E.H && E.renderer.getPixelRatio() === targetPR()) return;   // 同じ大きさなら何もしない（setSize で描画面が消えて、ちらつくため）
  E.W = w; E.H = h; E.camera.aspect = w / h;
  E.renderer.setPixelRatio(targetPR()); E.renderer.setSize(w, h, false);
  if (composer) { composer.setPixelRatio(E.renderer.getPixelRatio()); composer.setSize(w, h); }
  cam.dirty = true;
}
let holdFrame = false, capT = null;   // 写真を撮っている間だけ、ふだんの描画を止める（capT = そのあいだ止めておく窓の外の時間）
export function renderFrame() { if (!holdFrame) drawFrame(); }
function drawFrame() {
  // カメラが動いている間も細かさは変えない（変えると陰影の粒が動く間だけ変わって、影がもやもやして見えるため）。動いている間は fps の計測だけ止める
  if (outTick(performance.now(), E.camera)) cam.dirty = true;   // 朝・昼・晩の切りかえ（約1秒）
  if (capT == null) { stepNight(); SKY.time.value = (performance.now() / 1000) % 7200; } else SKY.time.value = capT; extTick(performance.now(), E.itemsG);   // 窓の外の動き（雲・木・星）は描いたときだけ進む
  const c = cam, sg = c.ca + ',' + c.cp + ',' + c.cty + ',' + c.zoom + ',' + c.panx + ',' + c.pany + ',' + c.h + (cam.mode === 'eye' || EYE.tr ? ',' + EYE.pos.x.toFixed(3) + ',' + EYE.pos.z.toFixed(3) + ',' + EYE.cy.toFixed(3) + ',' + EYE.cp.toFixed(3) + ',' + EYE.fov.toFixed(2) + (EYE.tr ? ',' + EYE.tr.t : '') : '');
  if (sg !== camSig) {
    camSig = sg;
    if (!moving) { moving = true; pfReset(); }
    clearTimeout(moveT); moveT = setTimeout(() => { moving = false; pfReset(); }, 150);
  }
  { const k = EYE.tr ? Math.min(1, EYE.tr.t / EYE.tr.dur) : 1, ak = EYE.tr ? 1 - .85 * Math.sin(Math.PI * k) : 1;   // 目線に入る・出る 0.6 秒だけ、陰影（GTAO）をなめらかに弱める（近くの人の体にカメラが寄ると、陰影が粒になるため。始めと終わりは元の強さ）
    if (gtao && gtao.blendIntensity !== ak) gtao.blendIntensity = ak; if (gp) gp.setAo(ak); }
  if (gp && DBG.get('post') !== '0') gp.render(); else if (composer && DBG.get('post') !== '0') composer.render(); else E.renderer.render(E.scene, E.camera);
}
// ===== 写真：いまの視点のまま、写真用の最高画質で、4K 以上の細かさで1枚描く =====
// ・撮る間だけ、画質の設定に関係なく最高にする（影の細かさとぼかし・陰影は全解像度＋サンプル多め＋ぼかし2回・窓の外の細かいもの）。終わったら全部もとに戻す
// ・最終の大きさの2倍で描いてから、きれいに半分に縮める（スーパーサンプリング。ふちのギザギザとざらつきが消える）。大きいので、画面を何枚かのタイルに分けて描いてつなぐ
//   （投影行列をずらして同じ視点のまま分ける。ふちの重なり＝のりしろを描いて捨てるので、陰影・にじみのつなぎ目が出ない。タイルの間は時間・窓の外を止める）
// ・画面と同じ canvas を使うので、撮っている間は canvas を隠し、撮る直前の画面の絵を重ねて見せておく（ちらつかない）。タイルの間に1フレーム待って、画面が固まって見えないようにする
// iPhone（ios）は、メモリの上限が小さいので予算を下げる（長い辺 2560px・4M 画素・タイル 1280 角・影の地図と MSAA は増やさない）。落ちた端末は次から小さめに撮る
// names=false なら、名札・ふきだし・♪（スプライト）と方眼は写さない。返り値は { canvas, scale, ios }（描けなければ null）。重くて落ちそうな端末は、小さめに撮りなおす
const nextTick = () => new Promise(res => { let d = false; const f = () => { if (!d) { d = true; res(); } }; requestAnimationFrame(f); setTimeout(f, 150); });
const shadowSize = n => { const sh = sun.shadow; sh.mapSize.set(n, n); for (const k of ['map', 'mapPass']) if (sh[k]) { sh[k].dispose(); sh[k] = null; } };   // 影の大きさを変える（VSM はぼかし用の絵（mapPass）も作り直さないと、古い大きさのまま描いて影が壊れる）
// 撮影中の印：撮り始めに付け、保存まで終わったら消す。次に開いたとき残っていたら（＝前回タブが落ちた）、一段小さい大きさから撮る（kh.photoLvl = 0〜2）
const PH_BUSY = 'kh.photoBusy', PH_LVL = 'kh.photoLvl';
const photoLvl = () => { try { return Math.max(0, Math.min(2, +localStorage.getItem(PH_LVL) || 0)); } catch (e) { return 0; } };
(() => { try { if (localStorage.getItem(PH_BUSY)) { localStorage.removeItem(PH_BUSY); localStorage.setItem(PH_LVL, String(Math.min(2, photoLvl() + 1))); } } catch (e) { } })();
export function photoMark(on) { try { if (on) localStorage.setItem(PH_BUSY, String(Date.now())); else localStorage.removeItem(PH_BUSY); } catch (e) { } }
export async function capturePhoto(opts) {
  const names = !!(opts && opts.names), r = E.renderer, W = E.W, H = E.H; if (!r || !W || !H || holdFrame) return null;
  const cv = r.domElement, cam3 = E.camera, big = !mobile && !ios, cc = caps();
  const gv = gridLines ? gridLines.visible : false, base = r.getPixelRatio(), ms0 = composer ? composer.renderTarget1.samples : 0, smaa0 = smaa ? smaa.enabled : false, fine0 = SKY.fine.value, hid = [];
  const sh = sun.shadow, sz0 = sh.mapSize.x, rad0 = sh.radius, bs0 = sh.blurSamples, cfg0 = curCfg;
  const pe0 = cam3.projectionMatrix.elements.slice(), pi0 = cam3.projectionMatrixInverse.elements.slice();
  const gpOpts = () => ({ ao: DBG.get('ao') !== '0' && DBG.get('only') !== '1', bloom: DBG.get('bloom') !== '0' && DBG.get('only') !== '1' });
  const bloomS = mobile ? .2 : .28;
  if (extPending()) { try { await extBakeNow(); } catch (e) {} }   // 窓の外の世界がまだ焼けていなければ、先に焼く（写真に3Dの外の世界を写す）
  const cover = document.createElement('canvas');
  holdFrame = true;
  try {
    // 撮る直前の画面の絵（これを重ねて見せたまま、canvas は隠す）
    drawFrame(); cover.width = cv.width; cover.height = cv.height; cover.getContext('2d').drawImage(cv, 0, 0);
    cover.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none'; try { const z = getComputedStyle(cv).zIndex; if (z && z !== 'auto') cover.style.zIndex = z; } catch (e) { }
    cv.parentNode.insertBefore(cover, cv.nextSibling); cv.style.visibility = 'hidden';
    capT = SKY.time.value;   // ここから、窓の外の時間を止める（タイルごとに雲の位置が変わらない）
    if (!names) { E.scene.traverseVisible(o => { if (o.isSprite || o.userData.noAO) hid.push(o); }); hid.forEach(o => { o.visible = false; }); }
    if (names && E.photoLabels) E.photoLabels(true);   // 名札は普段 HTML の文字なので、写真では 3D の名札を出す
    if (gridLines) gridLines.visible = false;
    // ---- 写真用の最高画質 ----
    SKY.fine.value = 1;
    if (!GPU.on) {   // WebGL：影を細かく、ぼかしを広く（細かくした分、ぼかしの半径も増やして、ぼけ方は画面と同じに）
      const S1 = ios ? sz0 : Math.min(big ? 4096 : 3072, cc.tex);   // iPhone は影の地図を大きくしない（メモリを守る）
      if (S1 > sz0) { shadowSize(S1); sh.radius = rad0 * S1 / sz0; sh.blurSamples = Math.max(bs0, 33); }
    } else sun.shadow.radius = SHADOW_R_GPU.ultra;   // WebGPU：PCF のぼかしを最大に（影の大きさは途中で変えない）
    const aoGs = ios ? 20 : 28, pdr = ios ? 28 : 36, pdSamples = ios ? 24 : 32;
    if (composer) {
      const msP = ios ? ms0 : Math.min(4, ms0 || 4);   // 大きい絵では MSAA を 4 まで（iPhone は増やさない）。縁は2倍描きと SMAA で整える
      for (const t of [composer.renderTarget1, composer.renderTarget2]) if (t.samples !== msP) { t.samples = msP; t.dispose(); }
      if (smaa) smaa.enabled = true;
      aoApply({ gtao: true, gscale: 1, gs: aoGs, pd: { radius: pdr, rings: 4, samples: pdSamples } });
    }
    if (gp) gp.apply(Object.assign({}, cfg0, { gtao: true, gscale: 1, gs: aoGs, pdr, smaa: true }), bloomS, gpOpts());
    // ---- 大きさとタイル ----
    // iPhone は、タブのメモリの上限が小さく、超えると画面ごと読み込み直しになる。長い辺 2560px・合計 4M 画素まで、タイルは 1280 角（見積もりは docs/decisions.md）
    const SS = 2, maxFin = ios ? 4e6 : mobile ? 14e6 : 16e6, sizes = [], lvl = photoLvl();   // lvl = 前に落ちた端末は、一段（二段）小さい大きさから始める
    for (const k of ios ? [1, .75, .55] : [1, .62, .38]) {   // 落ちたら、小さめにしてもう一度（最後は 4K を切ってもよいが、元の画面よりは大きく）
      let fs = Math.min((ios ? 2560 : big ? 5120 : 3840) * k / Math.max(W, H), Math.sqrt(maxFin / (W * H))); fs = Math.max(ios ? 1 : 1.2, fs);
      sizes.push(fs);
    }
    sizes.splice(0, Math.min(lvl, sizes.length - 1));
    let tileLog = '';
    const out = document.createElement('canvas'), tcv = document.createElement('canvas'), probe = document.createElement('canvas'); probe.width = probe.height = 8;   // 判定用の 8×8 は1つを使いまわす
    const px = probe.getContext('2d', { willReadFrequently: true });
    photoMark(true);   // 撮っている間の印（落ちたら、次に開いたときに小さめから撮る）。保存まで終わったら photo.js が消す
    let done = false, lastErr = null;
    for (const fs of sizes) {
      if (done) break;
      const FW = Math.round(W * fs), FH = Math.round(H * fs), RW = FW * SS, RH = FH * SS;
      const m = ios ? 64 : mobile ? 96 : 128, TS = Math.min(cc.tex, ios ? 1280 : mobile ? 2048 : 2560), tw = Math.min(RW, (TS - 2 * m) & ~1), th = Math.min(RH, (TS - 2 * m) & ~1);
      const vw = tw + 2 * m, vh = th + 2 * m;
      try {
        out.width = FW; out.height = FH; tcv.width = vw; tcv.height = vh;
        const oc = out.getContext('2d'), tc = tcv.getContext('2d'); oc.imageSmoothingEnabled = true; oc.imageSmoothingQuality = 'high';
        r.setPixelRatio(1); r.setSize(vw, vh, false); if (composer) { composer.setPixelRatio(1); composer.setSize(vw, vh); }
        const nx = Math.ceil(RW / tw), ny = Math.ceil(RH / th);
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          const cx = Math.min(i * tw, RW - tw), cy = Math.min(j * th, RH - th);   // この枚が受け持つ範囲（最後の枚は手前の枚と重ねる）
          const rx0 = cx - m, ry0 = cy - m, sx = RW / vw, sy = RH / vh, ox = sx - 2 * rx0 / vw - 1, oy = 1 - sy + 2 * ry0 / vh;   // 全体の画面の座標 → この枚の座標
          const e = cam3.projectionMatrix.elements, ei = cam3.projectionMatrixInverse;
          for (let k = 0; k < 16; k += 4) { e[k] = sx * pe0[k] + ox * pe0[k + 3]; e[k + 1] = sy * pe0[k + 1] + oy * pe0[k + 3]; e[k + 2] = pe0[k + 2]; e[k + 3] = pe0[k + 3]; }
          ei.copy(cam3.projectionMatrix).invert();
          outBgRange(rx0 / RW, (rx0 + vw) / RW, ry0 / RH, (ry0 + vh) / RH);   // 背景の空（画面いっぱいに張る絵）も、この枚が受け持つぶんだけ
          drawFrame(); r.shadowMap.autoUpdate = false;   // 影の絵は視点によらないので、最初の1枚だけ作る（あとは使いまわす）
          const grab = () => {   // タイルを 2D の canvas へ写す。真っ黒・透明なら false
            tc.clearRect(0, 0, vw, vh); tc.drawImage(cv, 0, 0);
            px.clearRect(0, 0, 8, 8); px.drawImage(tcv, m, m, tw, th, 0, 0, 8, 8); const d = px.getImageData(0, 0, 8, 8).data;
            for (let q = 0; q < d.length; q += 4) if (d[q + 3] > 0 && (d[q] | d[q + 1] | d[q + 2]) > 0) return true;
            return false;
          };
          let ok = grab();
          if (!ok) { await nextTick(); ok = grab(); }   // WebGPU：描いた直後に読めない端末は、1フレーム待つ
          if (!ok) throw new Error('blank tile');
          oc.drawImage(tcv, m, m, tw, th, cx / SS, cy / SS, tw / SS, th / SS);   // ちょうど半分に縮める（2×2 の平均）
          await nextTick();   // 画面が固まって見えないように、1枚ごとに1フレーム返す
        }
        done = true; tileLog = nx + 'x' + ny + ' ' + vw + 'px';
      } catch (e) { lastErr = e; console.error('photo tile', e); if (r.getContext && !GPU.on) { try { if (r.getContext().isContextLost()) break; } catch (e2) { } } }
    }
    tcv.width = tcv.height = 0; probe.width = probe.height = 0;   // 使い終わった canvas はすぐ放す
    if (DBG.get('photolog') === '1') console.info('photo', { ios, w: out.width, h: out.height, mpx: +(out.width * out.height / 1e6).toFixed(2), lvl, tile: tileLog });
    if (!done) { out.width = out.height = 0; return null; }
    return { canvas: out, scale: out.width / W, ios };
  } finally {
    hid.forEach(o => { o.visible = true; });
    if (names && E.photoLabels) E.photoLabels(false);
    if (gridLines) gridLines.visible = gv;
    cam3.projectionMatrix.fromArray(pe0); cam3.projectionMatrixInverse.fromArray(pi0);
    SKY.fine.value = fine0; outBgFull();
    if (!GPU.on) { if (sh.mapSize.x !== sz0) shadowSize(sz0); sh.radius = rad0; sh.blurSamples = bs0; } else sun.shadow.radius = rad0;
    if (composer) { for (const t of [composer.renderTarget1, composer.renderTarget2]) if (t.samples !== ms0) { t.samples = ms0; t.dispose(); } if (smaa) smaa.enabled = smaa0; aoApply(cfg0); }
    if (gp) gp.apply(cfg0, bloomS, gpOpts());
    r.setPixelRatio(base); r.setSize(W, H, false); if (composer) { composer.setPixelRatio(base); composer.setSize(W, H); }
    r.shadowMap.autoUpdate = true; r.shadowMap.needsUpdate = true; capT = null; holdFrame = false; resize(); cam.dirty = true; drawFrame();   // すぐ元の大きさで描き直す（canvas を見せてから、重ねた絵を外す）
    cv.style.visibility = ''; cover.remove(); cover.width = cover.height = 0; pfReset();
  }
}

// ===== 自動で一段下げる：動いていない間の平均 fps が 3 秒ぶん 40 を切ったら（最高→高→標準）。その回だけ・保存しない・知らせない =====
let pfPrev = 0, pfPrevR = false, pfSum = 0, pfN = 0, slowN = 0; const pfT0 = performance.now();
function pfReset() { pfSum = 0; pfN = 0; pfPrevR = false; }
export function perfTick(t, will) {
  if (will && pfPrevR && !moving && t - pfT0 > 5000 && DBG.get('aq') !== '0') {   // 起動直後の読み込み中は数えない。続けて描いた2フレームの間隔だけ数える
    const d = t - pfPrev;
    if (d > 0 && d < 250) {
      pfSum += d; pfN++;
      if (pfSum >= 3000 && pfN >= 60) {
        const fps = 1000 * pfN / pfSum; pfReset();
        if (fps < (ios ? 27 : 40)) { const nx = effQ === 'ultra' ? 'high' : effQ === 'high' ? 'std' : null; if (nx) applyQuality(nx); }
        // WebGPU で、いちばん軽い画質（標準）でも 20fps を切る状態が続いたら（3秒ずつ2回）、WebGL に戻して、その端末は WebGL として記録する
        if (GPU.on) { if (effQ === 'std' && fps < 20 && t - pfT0 > 12000) { if (++slowN >= 2) gpuFail('slow:' + fps.toFixed(0) + 'fps'); } else slowN = 0; }   // iPhone は低電力モード（30fps 上限）や 60/120Hz の揺れで下げすぎないよう、基準を 27 に
      }
    }
  }
  pfPrev = t; pfPrevR = !!will;
}

// ===== カメラ（小さめ画角の透視。部屋がぴったり収まる距離＋レンズシフトで中央寄せ） =====
export function resetCam() { if (cam.mode === 'eye') return; cam.yaw = 0; cam.zoom = 1; cam.panx = cam.pany = 0; cam.dirty = true; }
export function addYaw(d) { if (cam.mode !== 'iso') return; cam.yaw += d; cam.dirty = true; }
export function setZoom(z) { if (cam.mode === 'eye') return; cam.zoom = Math.max(.4, Math.min(3.2, z)); cam.dirty = true; }
// 一定以上引いたら（ROOF_ON 以下）、外から見た家（屋根・外壁）が出る。寄りなおすと（ROOF_OFF 以上）元の断面にもどる（間は今の状態を保つ＝ちらつかない）。切りかえは時間でなめらかに（roof.js）
const ROOF_ON = .66, ROOF_OFF = .74;
// 自分が庭に出ている間は、引き具合に関わらず外から見た家（屋根・外壁・閉じたドア）にする（main.js の viewerOutTick）
let roofForced = false;
export function roofForce(on) { roofForced = !!on; cam.dirty = true; }
function roofUpdate(dt, snap) {
  if (cam.mode !== 'iso' && cam.mode !== 'free') roofWant = false; else if (roofForced || cam.zoom <= ROOF_ON) roofWant = true; else if (cam.zoom >= ROOF_OFF) roofWant = false;
  const r = roofTick(dt, roofWant, snap, E.camera), k = roofRise();
  if (k !== doorK) { doorK = k; DL.forEach(l => { l.rotation.y = -1.3 * (1 - k); }); }   // 玄関のドアも、外壁が立ち上がるにつれて閉まる
  return r;
}
const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _dir = new THREE.Vector3();
let fitD = 0;
function place(c, D) { c.position.copy(_t).addScaledVector(_dir, D); c.up.set(0, 1, 0); c.lookAt(_t); c.updateMatrixWorld(true); }
function bounds(c, b) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const X of [b.x0, b.x1]) for (const Y of [-.3, WH]) for (const Z of [b.z0, b.z1 + .5]) { _v.set(X, Y, Z).project(c); x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y); }
  return [x0, x1, y0, y1];
}
// 壁の組 SG のキー：-x/+x/-z/+z = 外向きがその向きの壁（外壁と今いる部屋の壁）、ix/iz = ほかの部屋どうしの壁、cXZ = 角の柱
// N = 壁がカメラ側（手前）にどれだけ向いているか。0.08 未満（奥・真横）なら天井まで（境目はヒステリシス：天井まで→腰は0.10超、腰→天井までは0.06未満。境目の角度でちらちら入れ替わらない）
function wallView(a, P) {
  const sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }, kp = sm((26 * Math.PI / 180 - P) / (10 * Math.PI / 180)), dx = Math.sin(a), dz = Math.cos(a);
  const N = { '-x': -dx, '+x': dx, '-z': -dz, '+z': dz, ix: Math.abs(dx), iz: Math.abs(dz) };
  const tallOf = (k, was) => N[k] < (was ? .1 : .06), sink = k => N[k] < .08 ? 0 : kp * sm((N[k] - .2) / .3);
  Object.keys(SG).forEach(k => {
    const o = SG[k]; let tall, kk;
    if (k[0] === 'c') { const xk = k[1] === '1' ? '+x' : '-x', zk = k[2] === '1' ? '+z' : '-z'; tall = tallOf(xk, o.tall.visible) && tallOf(zk, o.tall.visible); kk = Math.max(sink(xk), sink(zk)); }
    else { tall = tallOf(k, o.tall.visible); kk = sink(k); }
    o.tall.visible = tall; o.cut.visible = !tall && kk < .98; o.cut.scale.y = Math.max(.001, 1 - kk);
  });
  const L = tallOf('-x', E.wallTall && E.wallTall.L), R = tallOf('-z', E.wallTall && E.wallTall.R);   // 今いる部屋の壁かけの壁（L = -x、R = -z）が天井まであるか
  if (!E.wallTall || E.wallTall.L !== L || E.wallTall.R !== R) { E.wallTall = { L, R }; E.wallVer = (E.wallVer || 0) + 1; }
}
// 庭にいる人（E.camPts：世界の座標。main.js が毎フレーム入れる）も画面に入るよう、家全体の箱をそのぶん広げる。広げ・もどしはなめらかに追う（急に視点が飛ばない）
let yb = null, ybBusy = false;
function yardBox(base, pts, snap, dt) {
  let t = base;
  if (pts && pts.length) { t = { x0: base.x0, z0: base.z0, x1: base.x1, z1: base.z1 }; for (const p of pts) { t.x0 = Math.min(t.x0, p[0] - 1); t.z0 = Math.min(t.z0, p[1] - 1); t.x1 = Math.max(t.x1, p[0] + 1); t.z1 = Math.max(t.z1, p[1] + 1); } }
  if (!yb || snap) { yb = { x0: t.x0, z0: t.z0, x1: t.x1, z1: t.z1 }; ybBusy = false; return yb; }
  const k = Math.min(1, dt * 4); ybBusy = false;
  for (const key of ['x0', 'z0', 'x1', 'z1']) { const d = t[key] - yb[key]; if (Math.abs(d) < .005) yb[key] = t[key]; else { yb[key] += d * k; ybBusy = true; } }
  return yb;
}
function normalCam(dt, snap) {
  const wallV = cam.mode === 'wallL' || cam.mode === 'wallR';
  const c = E.camera, free = cam.mode === 'free', v = VIEWS[cam.mode], bx = wallV ? rBox : yardBox(hBox, E.camPts, snap, dt), span = Math.max(bx.x1 - bx.x0, bx.z1 - bx.z0);   // 壁正面ビューは今いる部屋、ほかは家全体
  let ta = free ? cam.fa : v ? v.a : BASE_YAW + cam.yaw; const tp = free ? cam.fp : v ? v.p : PITCH, tty = free ? tyOf(cam.fp) : v ? v.ty : WH * .35;
  // 向きの切り替えはなめらかに（角度・高さを目標へ近づける。ドラッグ中は手に速くついてくる）
  let turning = false;
  if (cam.ca != null) { const T2 = Math.PI * 2, d0 = ta - cam.ca; ta = cam.ca + d0 - T2 * Math.round(d0 / T2); }   // 何周回しても、近い向きへ回る
  if (cam.ca == null || snap) { cam.ca = ta; cam.cp = tp; cam.cty = tty; }
  else { const k = Math.min(1, dt * (free ? 20 : 7)); [['ca', ta], ['cp', tp], ['cty', tty]].forEach(([key, t]) => { const d = t - cam[key]; if (Math.abs(d) < 1e-3) cam[key] = t; else { cam[key] += d * k; turning = true; } }); }
  const a = cam.ca, P = cam.cp;
  // 壁の高さ：カメラから見て奥になる壁は天井まで、手前になる壁は腰の高さ（低い角度でこちらを向くと、さらに沈める）。360°どこから見ても部屋の中が見える
  if (EYE.tr && EYE.tr.dir === 'out' && EYE.tr.t < EYE.tr.dur * .45) eyeWalls(); else wallView(a, P);   // 目線から戻る最初のうちは、壁を高いまま（いきなり低くならない）
  E.othersG.visible = !(cam.mode === 'wallL' || cam.mode === 'wallR');
  _t.set((bx.x0 + bx.x1) / 2, cam.cty, (bx.z0 + bx.z1) / 2); _dir.set(Math.sin(a) * Math.cos(P), Math.sin(P), Math.cos(a) * Math.cos(P));
  c.aspect = E.W / E.H; c.fov = FOV; c.zoom = 1; c.near = 1; c.far = 600; c.updateProjectionMatrix();
  const fy = mobile ? .94 : .9, fx = .94;
  let D = fitD || span * 6; for (let i = 0; i < 6; i++) { place(c, D); const [x0, x1, y0, y1] = bounds(c, bx); D *= Math.max((x1 - x0) / 2 / fx, (y1 - y0) / 2 / fy); }
  cam.tgt = D; const vh = cam.vb && cam.vb.hA > 0; if (vh) cam.h = cam.vb.hA + (D - cam.vb.hA) * cam.vb.k; else if (!cam.h || snap) cam.h = D; else { cam.h += (D - cam.h) * Math.min(1, dt * 9); if (Math.abs(cam.h - D) < .01) cam.h = D; }
  fitD = D;
  const Dc = cam.h; place(c, Dc); c.near = Math.max(1, Dc * .3); c.far = Dc * 3; c.updateProjectionMatrix();
  const [x0, x1, y0, y1] = bounds(c, bx);
  c.zoom = cam.zoom; c.updateProjectionMatrix();
  const e = c.projectionMatrix.elements; e[8] = cam.zoom * (x0 + x1) / 2 - 2 * cam.panx; e[9] = cam.zoom * (y0 + y1) / 2 + 2 * cam.pany + .035;
  const vb = cam.vb; if (vb) { const k = vb.k, A = vb.A || [e[0], e[8], e[5], e[9]], B = vb.B || [e[0], e[8], e[5], e[9]]; e[0] = A[0] + (B[0] - A[0]) * k; e[8] = A[1] + (B[1] - A[1]) * k; e[5] = A[2] + (B[2] - A[2]) * k; e[9] = A[3] + (B[3] - A[3]) * k; }   // パネルの開閉中：見た目を前の形から今の形へ（canvas は作り直さない）
  c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
  const rf = roofUpdate(dt, snap);
  const sk = roofShake(); if (sk[0] || sk[1]) { e[8] += sk[0]; e[9] += sk[1]; c.projectionMatrixInverse.copy(c.projectionMatrix).invert(); }   // 屋根が着地したときの、ごく小さなゆれ（roof.js。動きを減らす設定では0）
  return (!vh && cam.h !== D) || turning || rf || (!wallV && ybBusy);
}
// パネル開閉アニメ用：幅 w の画面になったときの映り方を、幅 Wt（省略はいまの E.W）の canvas の座標へ直して返す（[e0, e8, e5, e9]、.h = そのときのカメラ距離）
export function probeCam(w, Wt) {
  const W = E.W, c = E.camera, h0 = cam.h, ca = cam.ca, cp = cam.cp, cty = cam.cty; Wt = Wt || W; const sn = cam.mode !== 'eye' && !EYE.tr; E.W = w; c.aspect = w / E.H; updateCamera(0, sn);   // その幅で落ち着いたときの形（距離も。目線のときは、目線の状態を動かさない）
  const e = c.projectionMatrix.elements, r = w / Wt, out = [e[0] * r, 1 - r * (1 - e[8]), e[5], e[9]]; out.h = sn ? cam.h : 0;
  cam.h = h0; cam.ca = ca; cam.cp = cp; cam.cty = cty; E.W = W; c.aspect = W / E.H; updateCamera(0, false); return out;
}
// ===== 自分の目線（eye）：自分の me- の目の高さから部屋を見わたす =====
// ・首：yaw（左右・ぐるっと）と pitch（上下・±35°）。ドラッグ中は手についてきて、放すと慣性でなめらかに止まる。画角（fov）は2本指・ホイールで少し変える
// ・歩くとき：位置はなめらかに追いかけ、上下にほんの少しだけゆれる。首は歩く向きへゆっくり向く（止まったら、最後の向きのまま）
// ・入る・出る：今のカメラ ↔ 目線を 0.6 秒でなめらかに飛ぶ。位置・向き・画角・レンズのずれを同じ割合で混ぜる
const EYE_FOV0 = 50, EYE_FOV_MIN = 36, EYE_FOV_MAX = 75, EYE_PMAX = 35 * Math.PI / 180, EYE_TR = .6, EYE_M = .14;
export const EYE = { feed: null, has: false, pos: new THREE.Vector3(), yaw: 0, pitch: 0, cy: 0, cp: 0, vy: 0, vp: 0, drag: false, lastT: 0, quiet: 9, fov: EYE_FOV0, fovT: EYE_FOV0, tr: null, saved: null };
const ease3 = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, wrapPi = a => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
const capPose = () => { const c = E.camera, e = c.projectionMatrix.elements; return { pos: c.position.clone(), q: c.quaternion.clone(), fov: c.fov, zoom: c.zoom, e8: e[8], e9: e[9], near: c.near, far: c.far }; };
function putPose(A, B, t) {
  const c = E.camera, lg = (a, b) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t), li = (a, b) => a + (b - a) * t;
  c.position.lerpVectors(A.pos, B.pos, t); c.quaternion.slerpQuaternions(A.q, B.q, t); c.up.set(0, 1, 0); c.updateMatrixWorld(true);
  c.fov = li(A.fov, B.fov); c.zoom = li(A.zoom, B.zoom); c.near = lg(A.near, B.near); c.far = lg(A.far, B.far); c.updateProjectionMatrix();
  const e = c.projectionMatrix.elements; e[8] = li(A.e8, B.e8); e[9] = li(A.e9, B.e9); c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
}
// 目線のとき、壁はぜんぶ天井まで（部屋の中から見るので、手前の壁を低くしない）
function eyeWalls() {
  Object.keys(SG).forEach(k => { const o = SG[k]; if (!o.tall.visible) o.tall.visible = true; if (o.cut.visible) o.cut.visible = false; });
  if (!E.wallTall || !E.wallTall.L || !E.wallTall.R) { E.wallTall = { L: true, R: true }; E.wallVer = (E.wallVer || 0) + 1; }
}
// main.js が毎フレーム渡す：f = { x, y, z（目の位置・家の座標）, ry（からだの向き）, hd（歩く向き）, moving, amp（歩きの大きさ 0〜1）, ph（歩きの位相）, snap }
export function eyeFeed(f) { EYE.feed = f; }
export function enterEye(f) {
  if (cam.mode === 'eye' || !f) return false;
  EYE.saved = { mode: cam.mode, yaw: cam.yaw, zoom: cam.zoom, panx: cam.panx, pany: cam.pany, fa: cam.fa, fp: cam.fp };
  const from = capPose(); EYE.feed = f; EYE.has = false;
  EYE.yaw = EYE.cy = f.ry; EYE.pitch = EYE.cp = -.04; EYE.vy = EYE.vp = 0; EYE.drag = false; EYE.quiet = 9; EYE.fov = EYE.fovT = EYE_FOV0;
  EYE.tr = { dir: 'in', t: 0, dur: EYE_TR, from }; cam.mode = 'eye'; cam.dirty = true; return true;
}
export function exitEye(to) {
  if (cam.mode !== 'eye') return false;
  const s = EYE.saved || { mode: 'iso', yaw: 0, zoom: 1, panx: 0, pany: 0 }, from = capPose();
  cam.mode = s.mode; cam.yaw = s.yaw; cam.zoom = s.zoom; cam.panx = s.panx; cam.pany = s.pany; if (s.mode === 'free') { cam.fa = s.fa; cam.fp = s.fp; }
  if (to && to in VIEWS && to !== s.mode) { cam.mode = to; cam.yaw = 0; cam.zoom = 1; cam.panx = cam.pany = 0; }   // 戻り先を指定されたら（視点のメニューから別の向きを選んだとき）そこへ
  EYE.drag = false; EYE.tr = { dir: 'out', t: 0, dur: EYE_TR, from }; cam.dirty = true; return true;
}
export const eyeHidden = () => { const t = EYE.tr; if (t) return t.dir === 'in' ? t.t / t.dur >= .8 : t.t / t.dur < .12; return cam.mode === 'eye'; };   // 自分の体を隠す間
export function eyeGrab() { EYE.vy = EYE.vp = 0; }   // 指がふれたら、流れている首を止める
export function eyeTurn(a) { if (cam.mode === 'eye') { EYE.yaw += a; EYE.quiet = 0; cam.dirty = true; } }   // キーボード（Q/E）で首を回す
// dx, dy = 指の動き（画面の点）。ふれた世界がついてくる向き（右へドラッグ → 左を向く、下へ → 上を向く）。上下は ±35°
export function eyeLook(dx, dy) {
  if (cam.mode !== 'eye') return;
  const k = EYE.fov * Math.PI / 180 / Math.max(1, E.H) * 1.15, now = performance.now(), dtm = Math.max(.004, Math.min(.05, (now - EYE.lastT) / 1000)); EYE.lastT = now;
  const ay = dx * k, p0 = EYE.pitch;
  EYE.yaw += ay; EYE.pitch = Math.max(-EYE_PMAX, Math.min(EYE_PMAX, EYE.pitch + dy * k));
  EYE.vy = EYE.vy * .5 + ay / dtm * .5; EYE.vp = EYE.vp * .5 + (EYE.pitch - p0) / dtm * .5; EYE.quiet = 0; EYE.drag = true; cam.dirty = true;
}
export function eyeRelease(stop) {
  if (!EYE.drag) return;
  if (stop || performance.now() - EYE.lastT > 90) EYE.vy = EYE.vp = 0;
  EYE.drag = false; EYE.quiet = 0; EYE.vy = Math.max(-3.5, Math.min(3.5, EYE.vy)); EYE.vp = Math.max(-2, Math.min(2, EYE.vp));   // 流れすぎない（いちばん速いはじきでも 40° ほど）
}
export function eyeZoom(ratio) { if (cam.mode !== 'eye') return; EYE.fovT = Math.max(EYE_FOV_MIN, Math.min(EYE_FOV_MAX, EYE.fovT / ratio)); cam.dirty = true; }
const _ef = new THREE.Vector3(), _et = new THREE.Vector3();
function eyeCamera(dt, snap) {
  const c = E.camera, tr = EYE.tr, eye = cam.mode === 'eye'; let busy = false;
  if (eye) {
    const f = EYE.feed;
    if (f) {
      // ① 首：慣性・歩く向きへ・ドラッグへの追従
      if (!EYE.drag) {
        EYE.yaw += EYE.vy * dt; EYE.pitch += EYE.vp * dt;
        if (EYE.pitch > EYE_PMAX || EYE.pitch < -EYE_PMAX) { EYE.pitch = Math.max(-EYE_PMAX, Math.min(EYE_PMAX, EYE.pitch)); EYE.vp = 0; }
        const dk = Math.exp(-dt * 5.5); EYE.vy *= dk; EYE.vp *= dk; if (Math.abs(EYE.vy) < .003) EYE.vy = 0; if (Math.abs(EYE.vp) < .003) EYE.vp = 0;
        EYE.quiet += dt;
        if (f.moving && EYE.quiet > .9) { EYE.yaw += wrapPi((f.hd == null ? EYE.yaw : f.hd) - EYE.yaw) * (1 - Math.exp(-dt * 1.7)); EYE.pitch += (-.03 - EYE.pitch) * (1 - Math.exp(-dt * 1.1)); }   // 歩く向きへ、ゆっくり
      }
      const kk = snap ? 1 : 1 - Math.exp(-dt * (EYE.drag ? 34 : 20));
      EYE.cy += wrapPi(EYE.yaw - EYE.cy) * kk; EYE.cp += (EYE.pitch - EYE.cp) * kk; EYE.fov += (EYE.fovT - EYE.fov) * (snap ? 1 : 1 - Math.exp(-dt * 14));
      // ② 位置：目の高さへ。上下のゆれは、歩きの一歩ごとにほんの少し
      const bob = Math.abs(Math.sin(f.ph || 0)) * (f.amp || 0) * .02;
      _et.set(f.x + Math.sin(EYE.cy) * .08, f.y + bob, f.z + Math.cos(EYE.cy) * .08);
      if (!EYE.has || snap || f.snap || EYE.pos.distanceToSquared(_et) > 9) { EYE.pos.copy(_et); EYE.has = true; } else EYE.pos.lerp(_et, 1 - Math.exp(-dt * 16));
      // 部屋の外へは出さない（壁の手前でとめる）
      const cb = f.out ? { x0: hBox.x0 - OUT_M, z0: hBox.z0 - OUT_M, x1: hBox.x1 + OUT_M, z1: hBox.z1 + OUT_M } : rBox;   // 庭に出ているときは、庭の島の中まで
      EYE.pos.x = Math.max(cb.x0 + EYE_M, Math.min(cb.x1 - EYE_M, EYE.pos.x)); EYE.pos.z = Math.max(cb.z0 + EYE_M, Math.min(cb.z1 - EYE_M, EYE.pos.z));
      busy = EYE.drag || EYE.vy !== 0 || EYE.vp !== 0 || f.moving || Math.abs(wrapPi(EYE.yaw - EYE.cy)) > 1e-3 || Math.abs(EYE.pitch - EYE.cp) > 1e-3 || Math.abs(EYE.fovT - EYE.fov) > .02 || EYE.pos.distanceToSquared(_et) > 1e-6;
    }
    if (!tr || tr.t / tr.dur >= .5) eyeWalls();
    E.othersG.visible = true;
  }
  const poseEye = () => {
    const cp = Math.cos(EYE.cp); _ef.set(Math.sin(EYE.cy) * cp, Math.sin(EYE.cp), Math.cos(EYE.cy) * cp);
    c.aspect = E.W / E.H; c.fov = EYE.fov; c.zoom = 1; c.near = .06; c.far = 90; c.position.copy(EYE.pos); c.up.set(0, 1, 0); c.lookAt(_et.copy(EYE.pos).add(_ef)); c.updateMatrixWorld(true); c.updateProjectionMatrix();
    const e = c.projectionMatrix.elements; e[8] = 0; e[9] = 0; c.projectionMatrixInverse.copy(c.projectionMatrix).invert(); return capPose();
  };
  if (tr) {
    tr.t = snap ? tr.dur : Math.min(tr.dur, tr.t + dt); const k = ease3(tr.t / tr.dur);
    if (tr.dir === 'in') putPose(tr.from, poseEye(), k); else { normalCam(dt, snap); putPose(tr.from, capPose(), k); }
    if (tr.t >= tr.dur) { EYE.tr = null; if (tr.dir === 'out') { EYE.feed = null; EYE.has = false; } }
    cam.dirty = true; return true;
  }
  if (eye) poseEye();
  return busy;
}
// パネルの開閉中（cam.vb）：目線のときも、見た目を前の形から今の形へ（normalCam と同じ。入る・出る途中は混ぜない）
function eyeVb() {
  const vb = cam.vb; if (!vb) return; const c = E.camera, e = c.projectionMatrix.elements, k = vb.k, cur = [e[0], e[8], e[5], e[9]], A = vb.A || cur, B = vb.B || cur;
  e[0] = A[0] + (B[0] - A[0]) * k; e[8] = A[1] + (B[1] - A[1]) * k; e[5] = A[2] + (B[2] - A[2]) * k; e[9] = A[3] + (B[3] - A[3]) * k; c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
}
export function updateCamera(dt, snap) {
  if (cam.mode === 'eye' || EYE.tr) { const r = eyeCamera(dt, snap), rf = roofUpdate(dt, snap); if (!EYE.tr) eyeVb(); return r || rf; }
  return normalCam(dt, snap);
}
export function rayAt(px, py) {
  const rc = new THREE.Raycaster(), v = new THREE.Vector2(px / E.W * 2 - 1, -(py / E.H) * 2 + 1); rc.setFromCamera(v, E.camera); return rc;
}
export function project(p) { const v = p.clone().project(E.camera); return [(v.x + 1) / 2 * E.W, (1 - v.y) / 2 * E.H]; }

// ===== ライト =====
export function setPointLights(list) {
  const cap = curCfg ? curCfg.lights : (mobile ? 2 : 3);
  const sel = list.slice(0, cap);
  pool.forEach((p, i) => { const l = sel[i]; if (!l) { p.visible = false; p.intensity = 0; return; } p.visible = true; p.position.copy(l.pos); p.color.set(l.color); p.userData.i0 = l.intensity; p.userData.d0 = l.dist; p.intensity = l.intensity * nb(); p.distance = l.dist * (1 + .25 * nightK); });
  cam.dirty = true;
}
export function flickerLights(t, list) { pool.forEach((p, i) => { const l = list[i]; if (l && l.flicker && p.visible) p.intensity = l.intensity * nb() * (.9 + .1 * Math.sin(t * 9 + i) + .05 * Math.sin(t * 23)); }); }
// 電気を消す：部屋全体の明かりを落とし、ランプ・キャンドルなどの灯りだけが目立つ夜の雰囲気に。
// 切り替えは約1.1秒かけてなめらかに（明かり・背景・窓の外の景色がいっしょに変わる）。部屋に入った直後（buildHouse のあと）だけは、すぐその状態にする
let nightK = 0, nightA = null, snapNext = true, curtainDim = 0; const nb = () => 1 + .9 * nightK;
const mixN = (a, b, k) => a + (b - a) * k, _nc = new THREE.Color();
function applyNight(k) {
  const s = E.scene; if (GPU.on) gpuDirty();   // WebGPU：環境光の強さなどを、動かない物も読み直す
  s.environmentIntensity = mixN(DAY.env, NIGHT.env, k); E.hemi.intensity = mixN(DAY.hemi, NIGHT.hemi, k) * (1 - .16 * curtainDim);
  E.hemi.color.set(DAY.hemiC).lerp(_nc.set(NIGHT.hemiC), k); E.hemi.groundColor.set(DAY.gnd).lerp(_nc.set(NIGHT.gnd), k);
  sun.intensity = mixN(DAY.sun, NIGHT.sun, k) * (1 - .4 * curtainDim); sun.color.set(DAY.sunC).lerp(_nc.set(NIGHT.sunC), k);
  fill.intensity = mixN(DAY.fill, NIGHT.fill, k); fill.color.set(DAY.fillC).lerp(_nc.set(NIGHT.fillC), k);
  E.renderer.toneMappingExposure = mixN(DAY.exp, NIGHT.exp, k) * (ios ? IOS_EXP : 1);
  pool.forEach(p => { if (p.visible && p.userData.d0) { p.intensity = p.userData.i0 * nb(); p.distance = p.userData.d0 * (1 + .25 * k); } });
}
// 窓のカーテンの閉まりぐあいで、窓の光（太陽の光・空の明るさ）を少し弱める。変わったときだけ
export function setCurtainDim(v) {
  v = Math.max(0, Math.min(1, v || 0)); if (Math.abs(v - curtainDim) < .003) return; curtainDim = v; if (!sun || !E.hemi) return;
  sun.intensity = mixN(DAY.sun, NIGHT.sun, nightK) * (1 - .4 * v); E.hemi.intensity = mixN(DAY.hemi, NIGHT.hemi, nightK) * (1 - .16 * v);
  if (GPU.on) gpuDirty(); cam.dirty = true;
}
export function setNight(on) {
  const to = on ? 1 : 0;
  if (snapNext) { snapNext = false; nightA = null; nightK = to; applyNight(to); cam.dirty = true; return; }
  if (to === (nightA ? nightA.to : nightK)) return;
  nightA = { from: nightK, to, t0: performance.now() }; cam.dirty = true;
}
// 描くたびに少しずつ進める（描いていない間は進めない）。途中の間は次の描画を予約する
function stepNight() {
  if (!nightA) return;
  const p = Math.min(1, (performance.now() - nightA.t0) / 1100); nightK = nightA.from + (nightA.to - nightA.from) * p * p * (3 - 2 * p);
  applyNight(nightK); if (p >= 1) nightA = null; cam.dirty = true;
}

// ===== 部屋 =====
function stdMat(o) { return new THREE.MeshStandardMaterial(Object.assign({ roughness: .9, metalness: 0 }, o)); }
function dispose(g) { g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); ownedTex.forEach(t => t.dispose()); ownedTex = []; }
function rep(cv, rx, ry) { const t = canvasToTex(cv, rx, ry); ownedTex.push(t); return t; }
// PBRテクスチャ（Poly Haven）を読み込めたものから順にマテリアルへ差し替える。失敗しても手続きテクスチャのまま。
function pbr(mat, spec, rx, ry, tint) {
  if (!spec) return;
  const set = (key, suf, srgb, extra) => loadTex('assets/tex/' + spec.n + '_' + suf + '.jpg', srgb, rx, ry, t => {
    ownedTex.push(t); mat[key] = t; if (extra) extra(t); mat.needsUpdate = true; cam.dirty = true;
  });
  set('normalMap', 'nor', false); set('roughnessMap', 'rough', false);
  if (spec.diff) set('map', 'diff', true, () => { if (tint != null) mat.color.set(tint); });
  if (spec.ns) mat.normalScale.set(spec.ns, spec.ns);
  mat.roughness = 1;
}
// ===== 家全体（全部の部屋の床・壁・玄関）=====
// rooms = 間取り（x,z,w,d つき）、open = 壁をなくす組、cur = 今いる部屋の番号。
//   今いる部屋の奥2面と、家の奥側(-x,-z)の外壁は天井まで。ほかは腰の高さ(CUT)で切った断面。
//   今いる部屋のローカル座標で家具・アバターを扱えるよう、itemsG / fxG を今いる部屋の角に置く。
export function buildHouse(rooms, open, cur) {
  if (cur >= rooms.length || cur < 0) cur = 0;
  while (roomG.children.length) { const c = roomG.children[0]; roomG.remove(c); dispose(c); }
  const box = houseBox(rooms), cr = rooms[cur]; hBox = box; rBox = { x0: cr.x, z0: cr.z, x1: cr.x + cr.w, z1: cr.z + cr.d }; { const door = entryPoint(rooms); extHouse(box, door); outHouse(box, door); } roofHouse(rooms);
  const T = .3, CUT = 1.1, OPEN = .7, ST = .16, OT = .3;
  E.itemsG.position.set(cr.x, 0, cr.z); E.fxG.position.set(cr.x, 0, cr.z); E.itemsG.updateMatrixWorld(true); E.fxG.updateMatrixWorld(true);
  SG = {}; DL = []; E.wallTall = null; snapNext = true;
  const grpOf = (key, tall) => { let o = SG[key]; if (!o) { o = SG[key] = { tall: new THREE.Group(), cut: new THREE.Group() }; o.tall.visible = false; roomG.add(o.tall, o.cut); } return tall ? o.tall : o.cut; };
  const side = stdMat({ color: 0xa88e72, roughness: .85 }), plain = stdMat({ color: 0xe2d6c0, roughness: .8 }), cap = stdMat({ color: 0xf1e7d2, roughness: .6 });
  const trim = stdMat({ color: 0xf3ebda, roughness: .45 });
  const add = (g, w, h, d, x, y, z, m, shadow) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m || plain); b.position.set(x, y, z); b.receiveShadow = true; b.castShadow = shadow === true; g.add(b); return b; };
  const R = rooms.map((rm, i) => {   // 部屋ごとの床と壁紙
    const fd = ITEM[rm.floor] || ITEM.fl_wood, wd = ITEM[rm.wall] || ITEM.wp_cream, fs = FLOOR_PBR[fd.pat];
    const fm = stdMat({ map: rep(floorCanvas(fd), rm.w / 2, rm.d / 2), roughness: fd.pat === 'carpet' ? 1 : .7 });
    if (fs) { const tint = fs.diff ? new THREE.Color(fd.color).multiplyScalar(1.12) : null; fm.color.set(tint || 0xffffff); pbr(fm, fs, rm.w / (fs.s || 2), rm.d / (fs.s || 2), tint); }
    const floor = new THREE.Mesh(new THREE.BoxGeometry(rm.w, T, rm.d), [side, side, fm, side, side, side]);
    floor.position.set(rm.x + rm.w / 2, -T / 2, rm.z + rm.d / 2); floor.receiveShadow = true; floor.name = 'floor'; floor.userData.roomIdx = i; roomG.add(floor);
    const ws = WALL_PBR[wd.pat], cv = wallCanvas(wd), cache = new Map();
    // len = 壁の長さ、hf = 壁の高さが天井までの何割か（模様の大きさをそろえる）
    const wm = (len, hf) => {
      const key = len + '|' + hf; let m = cache.get(key); if (m) return m;
      m = stdMat({ map: rep(cv, len / 2, hf), roughness: wd.pat === 'tileWall' ? .35 : .9 });
      if (ws) { const tint = ws.diff ? new THREE.Color(ws.white ? 0xffffff : wd.color).multiplyScalar(ws.white ? 1 : 1.08) : null; if (tint) m.color.copy(tint); pbr(m, ws, len / 2 * (ws.rx || 1), (ws.ry || 1.6) * hf, tint); }
      cache.set(key, m); return m;
    };
    return { wm, moldCol: wd.pat === 'wainscot' ? stdMat({ color: 0x5a3219 }) : trim };
  });
  // 壁の板：ax='z'(z方向に伸びる壁、厚みは x 方向) / ax='x'。c0〜c1 = 厚みの範囲、a0〜a1 = 長さの範囲、y0〜y1 = 高さの範囲
  // faces = { px,nx,pz,nz }（壁紙の面）。ほかの面は plain、上面は cap
  const slab = (g, ax, c0, c1, a0, a1, y0, y1, faces) => {
    const M = [plain, plain, cap, plain, plain, plain];
    if (ax === 'z') { M[0] = faces.px || plain; M[1] = faces.nx || plain; } else { M[4] = faces.pz || plain; M[5] = faces.nz || plain; }
    if (y1 >= WH - .01) M[2] = plain;
    const b = new THREE.Mesh(new THREE.BoxGeometry(ax === 'z' ? c1 - c0 : a1 - a0, y1 - y0, ax === 'z' ? a1 - a0 : c1 - c0), M);
    b.position.set(ax === 'z' ? (c0 + c1) / 2 : (a0 + a1) / 2, (y0 + y1) / 2, ax === 'z' ? (a0 + a1) / 2 : (c0 + c1) / 2); b.receiveShadow = true; b.castShadow = false; g.add(b); return b;
  };
  // 巾木・廻り縁（壁紙の面に沿って）。fc = 面の位置、s = 面の向き(+1/-1)
  const trims = (g, ax, fc, s, a0, a1, full, ri) => {
    const l = a1 - a0, c = (a0 + a1) / 2, m = R[ri].moldCol;
    if (ax === 'z') { add(g, .06, .16, l, fc + s * .03, .08, c, trim); if (full) add(g, .1, .1, l, fc + s * .05, WH - .05, c, m); }
    else { add(g, l, .16, .06, c, .08, fc + s * .03, trim); if (full) add(g, l, .1, .1, c, WH - .05, fc + s * .05, m); }
  };
  const wood = stdMat({ color: 0x7a4b2a, roughness: .55 });
  const plan = wallPlan(rooms, open);
  // 同じ壁を、天井までの形（full=true）と腰の高さの形（full=false）の両方で作る。どちらを見せるかはカメラの向きで決める（wallView）
  const seg = (sg, full) => {
    const { ax, pos, a0, a1, kind } = sg, len = a1 - a0, isX = ax === 'z';   // isX: 壁の向きが x 軸に垂直(厚みが x 方向)
    let c0, c1, faces = {}, ri = -1, fc = 0, s = 1, lo = -1, key;
    if (kind === 'out' || kind === 'ent') {
      const sd = sg.side; key = sd === 'l' ? '-x' : sd === 'r' ? '+x' : sd === 't' ? '-z' : '+z'; ri = sg.room;
      if (sd === 'l' || sd === 't') { c0 = pos - OT; c1 = pos; s = 1; fc = pos; } else { c0 = pos; c1 = pos + OT; s = -1; fc = pos; }
    } else { key = sg.hi === cur ? (isX ? '-x' : '-z') : sg.lo === cur ? (isX ? '+x' : '+z') : (isX ? 'ix' : 'iz'); c0 = pos - ST; c1 = pos; ri = sg.hi; s = 1; fc = pos; lo = sg.lo; }
    const g = grpOf(key, full);
    const top = full ? WH : CUT, hf = top / WH;
    const face = (rIdx, len2, positive) => { const m = R[rIdx].wm(len2, hf); const f = {}; if (isX) f[positive ? 'px' : 'nx'] = m; else f[positive ? 'pz' : 'nz'] = m; return f; };
    const seam = (rIdx, a, b, positive, fcc) => {   // 壁紙の面を faces に足し、巾木をつける
      Object.assign(faces, face(rIdx, b - a, positive)); trims(g, isX ? 'z' : 'x', fcc, positive ? 1 : -1, a, b, full, rIdx);
    };
    if (kind === 'door' && !full) return;                                  // 腰の壁の入口 = 切れ目
    if (kind === 'door') {                                                  // 天井までの壁の入口：開口＋ドア枠
      const lt = 2.36; faces = {}; Object.assign(faces, face(sg.hi, len, true), face(lo, len, false));
      slab(g, ax, c0, c1, a0, a1, lt, WH, faces);
      [a0, a1].forEach((e, k) => { const o = k ? -.05 : .05; if (isX) add(g, .22, 2.3, .1, pos - ST / 2, 1.15, e + o, wood, true); else add(g, .1, 2.3, .22, e + o, 1.15, pos - ST / 2, wood, true); });
      if (isX) add(g, .22, .12, len + .1, pos - ST / 2, lt - .06, (a0 + a1) / 2, wood, true); else add(g, len + .1, .12, .22, (a0 + a1) / 2, lt - .06, pos - ST / 2, wood, true);
      return;
    }
    if (kind === 'ent') {
      const cx = (a0 + a1) / 2, pieces = [[a0, cx - OPEN], [cx + OPEN, a1]];
      pieces.forEach(([p, q]) => { const f = {}; Object.assign(f, face(ri, q - p, false)); slab(g, ax, c0, c1, p, q, 0, top, f); trims(g, 'x', fc, -1, p, q, full, ri); });
      if (full) { const f = {}; Object.assign(f, face(ri, OPEN * 2, false)); slab(g, ax, c0, c1, cx - OPEN, cx + OPEN, 2.42, WH, f); }   // 入口の上の壁
      const zf = pos;   // 手前の壁の線
      [-1, 1].forEach(sd => add(g, .1, 2.3, .36, cx + sd * (OPEN + .04), 1.15, zf + .15, wood, true));   // ドア枠（柱）。壁の切り口(OPEN)と同じ面にならないよう、開口へ1cmはみ出させる（面が重なると z-fighting でちらつく）
      add(g, OPEN * 2 + .2, .12, .36, cx, 2.36, zf + .15, wood, true);                                    // ドア枠（まぐさ）
      // 木のドア：外側へ開いている（部屋の中をじゃましない）。ちょうつがいは奥側の柱
      const dc = document.createElement('canvas'); dc.width = 128; dc.height = 256; { const c = dc.getContext('2d'), gg = c.createLinearGradient(0, 0, 128, 0); gg.addColorStop(0, '#b97f4c'); gg.addColorStop(.5, '#c98e57'); gg.addColorStop(1, '#b57a47'); c.fillStyle = gg; c.fillRect(0, 0, 128, 256);
        c.strokeStyle = 'rgba(80,45,20,.22)'; c.lineWidth = 1; for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(i * 21.3, 0); c.lineTo(i * 21.3, 256); c.stroke(); }
        c.strokeStyle = 'rgba(70,38,15,.55)'; c.lineWidth = 4; c.strokeRect(16, 16, 96, 90); c.strokeRect(16, 126, 96, 114); c.strokeStyle = 'rgba(255,225,180,.35)'; c.lineWidth = 2; c.strokeRect(20, 20, 88, 82); c.strokeRect(20, 130, 88, 106); }
      const dtex = canvasToTex(dc, 1, 1); ownedTex.push(dtex);
      const leaf = new THREE.Group(); leaf.position.set(cx - OPEN + .02, 0, zf + .12); leaf.rotation.y = -1.3 * (1 - roofRise()); DL.push(leaf); g.add(leaf);
      const dm = stdMat({ map: dtex, roughness: .6 }), lw = OPEN * 2 - .06;
      add(leaf, lw, 2.22, .07, lw / 2, 1.12, 0, [wood, wood, wood, wood, dm, dm], true);
      const brass = stdMat({ color: 0xd9b45a, roughness: .3, metalness: .8 });
      [0, 1].forEach(i => { const k = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 8), brass); k.position.set(lw - .15, 1.05, i ? -.06 : .06); k.castShadow = true; leaf.add(k); });
      // 土間（タイル）・玄関マット・外の段差。床に平らなので、手前の壁を沈めても残る（1回だけ作る）
      if (full) return;
      // 角を丸めた箱（面取りで光が回り、平らな板に見えない）。大きさ・位置は元のまま
      const rb = (w, h, d, r, x, y, z, m, shadow) => { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m); b.position.set(x, y, z); b.receiveShadow = true; b.castShadow = shadow === true; roomG.add(b); return b; };
      rb(2, .04, .99, .012, cx, .022, zf - .505, stdMat({ map: domaTex(), roughness: .5 }));   // 床・壁と同じ面にならないよう、わずかに浮かせて壁から離す
      const mside = stdMat({ color: 0x6f2c25, roughness: 1 }), mtop = stdMat({ map: doormatTex(), roughness: 1, normalMap: sharedTex('carpet', 'nor', 1.5), roughnessMap: sharedTex('carpet', 'rough', 1.5), normalScale: new THREE.Vector2(.9, .9) });
      rb(1.2, .034, .7, .014, cx, .06, zf - .55, [mside, mside, mtop, mside, mside, mside]);
      // 外の段は、庭の地面（GARDEN_Y = -.34）まで届く石の2段（前は床の高さの薄い板で、庭の上に浮いて見えた）
      const stoneM = stdMat({ color: 0xbdb5a8, roughness: .8, normalMap: sharedTex('floor_stone', 'nor', 1.5), roughnessMap: sharedTex('floor_stone', 'rough', 1.5), normalScale: new THREE.Vector2(.5, .5) });
      rb(OPEN * 2 + .3, .4, .5, .03, cx, -.18, zf + .4, stoneM, true);   // 上の段：上の面 .02（床とほぼ同じ）、下は地面の少し下まで
      rb(OPEN * 2 + .6, .21, .42, .03, cx, -.275, zf + .86, stoneM, true);   // 下の段：上の面 -.17（yard.js の groundY と合わせる）
      return;
    }
    // 外壁・部屋どうしの壁
    if (kind === 'out') seam(ri, a0, a1, s > 0, fc); else { seam(sg.hi, a0, a1, true, pos); seam(lo, a0, a1, false, pos - ST); }
    slab(g, ax, c0, c1, a0, a1, 0, top, faces);
  };
  plan.forEach(sg => { seg(sg, true); seg(sg, false); });
  // 外壁の角（出っぱった角のすき間をふさぐ）
  rooms.forEach(rm => {
    [[0, 0, -1, -1], [1, 0, 1, -1], [0, 1, -1, 1], [1, 1, 1, 1]].forEach(([ix, iz, sx, sz]) => {
      const cx = rm.x + ix * rm.w, cz = rm.z + iz * rm.d;
      if (roomAt(rooms, cx + (sx > 0 ? 0 : -1), cz + (sz > 0 ? 0 : -1)) >= 0 || roomAt(rooms, cx + (sx > 0 ? 0 : -1), cz + (sz > 0 ? -1 : 0)) >= 0 || roomAt(rooms, cx + (sx > 0 ? -1 : 0), cz + (sz > 0 ? 0 : -1)) >= 0) return;
      [WH, CUT].forEach(h => add(grpOf('c' + ix + iz, h === WH), OT, h, OT, cx + sx * OT / 2, h / 2, cz + sz * OT / 2, plain));
    });
  });
  // グリッド（配置中のみ表示。今いる部屋だけ）
  const pts = []; for (let i = 0; i <= cr.w; i++) pts.push(i, .012, 0, i, .012, cr.d); for (let i = 0; i <= cr.d; i++) pts.push(0, .012, i, cr.w, .012, i);
  gridLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .28 }));
  gridLines.visible = false; gridLines.position.set(cr.x, 0, cr.z); roomG.add(gridLines);
  // 今いる部屋の床のふちをうっすら光らせる（部屋が2つ以上のとき）
  if (rooms.length > 1) {
    const gm = new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: .8, depthWrite: false }), th = .16;
    [[cr.w, th, cr.x + cr.w / 2, cr.z + th / 2], [cr.w, th, cr.x + cr.w / 2, cr.z + cr.d - th / 2], [th, cr.d - 2 * th, cr.x + th / 2, cr.z + cr.d / 2], [th, cr.d - 2 * th, cr.x + cr.w - th / 2, cr.z + cr.d / 2]].forEach(([w, d, x, z]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), gm); m.rotation.x = -Math.PI / 2; m.position.set(x, .02, z); m.renderOrder = 2; roomG.add(m);
    });
  }
  // 接地影（家の下の淡い影）
  const S = Math.max(box.w, box.d), bcx = (box.x0 + box.x1) / 2, bcz = (box.z0 + box.z1) / 2;
  blob.scale.set(box.w + S * 1.1, box.d + S * 1.1, 1); blob.position.set(bcx + S * .12, -T - .02, bcz + S * .12);
  // 影の範囲と光の向き（日光は窓のある壁側〜手前から、寒色フィルは反対側から）
  const sc = sun.shadow.camera, r = S * .95 + Math.abs(box.w - box.d) * .3; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = .5; sc.far = S * 4; sc.updateProjectionMatrix();
  sun.position.set(bcx + S * 1.05, S * 1.25, bcz + S * .75); sun.target.position.set(bcx, 0, bcz); sun.target.updateMatrixWorld();
  fill.position.set(bcx - S * .4, S * .8, bcz + S * .9); fill.target.position.set(bcx, 0, bcz); fill.target.updateMatrixWorld();
  curRooms = rooms;
  fitD = 0; cam.h = 0; cam.dirty = true;
}
export const showGrid = on => { if (gridLines && gridLines.visible !== on) { gridLines.visible = on; cam.dirty = true; } };
