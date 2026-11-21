// 端末ごとの WebGPU の試験（scenegpu.js の runTrial が、必要なときだけ読み込む）。
// 見えない小さな画面（640x360）に、家の中と同じ組み立て（影・照明・陰影 GTAO・光のにじみ・ACES・SMAA）の小さなシーンを描き、
// ① WebGPU が最後まで動くか（adapter・device・初期化・描画・エラー・device lost）、② 1フレームの時間が WebGL（今の経路）と比べてどうか、を見る。
// 数十フレームを 6 枚ずつの束で描き、束ごとに GPU の終わりを待って測る（先に warm 回分は、シェーダーの用意なので数えない）。
// 合否は scenegpu.js の judge() が決める。ここは「測って、失敗したら理由を返す」だけ。ページ本体の画面には一切触らない。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

const W = 640, H = 360;
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error('timeout')), ms))]);
const gone = st => document.hidden || !!(st.away && st.away());   // 裏に回った・いま試験をしてはいけない画面（家の中）になった
const tick = () => new Promise(r => setTimeout(r, 0));   // 束のあいだに、ページ本体へ時間を返す
const msg = e => String(e && e.message || e).slice(0, 60);

// 家の中をまねた小さなシーン：床・壁・家具（影を落とす）・太陽と補助光・半球光・あかり2つ
function buildScene() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe9e6f2);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
  for (let i = 0; i < 160; i++) { c.fillStyle = 'hsl(35,' + (30 + i % 30) + '%,' + (55 + i % 25) + '%)'; c.fillRect(i * 7 % 128, i * 13 % 128, 24, 6); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 4);
  const std = (col, o) => new THREE.MeshStandardMaterial(Object.assign({ color: col, roughness: .7 }, o));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), std(0xffffff, { map: tex })); floor.rotation.x = -Math.PI / 2; floor.position.set(4, 0, 4); floor.receiveShadow = true; scene.add(floor);
  const w1 = new THREE.Mesh(new THREE.BoxGeometry(8, 3, .2), std(0xf0e4d0)), w2 = new THREE.Mesh(new THREE.BoxGeometry(.2, 3, 8), std(0xf0e4d0));
  w1.position.set(4, 1.5, -.1); w2.position.set(-.1, 1.5, 4); [w1, w2].forEach(m => { m.castShadow = m.receiveShadow = true; scene.add(m); });
  const geos = [new THREE.BoxGeometry(1, 1, 1), new THREE.SphereGeometry(.5, 20, 14), new THREE.CylinderGeometry(.4, .5, 1, 18), new THREE.TorusGeometry(.4, .12, 10, 24)];
  for (let i = 0; i < 36; i++) {
    const m = new THREE.Mesh(geos[i % 4], std(new THREE.Color().setHSL((i * .07) % 1, .45, .6), { roughness: .4 + (i % 5) * .1 }));
    m.position.set(.8 + (i % 6) * 1.15, .5 + (i % 3) * .12, .8 + Math.floor(i / 6) * 1.15); m.rotation.y = i; m.castShadow = m.receiveShadow = true; scene.add(m);
  }
  scene.add(new THREE.HemisphereLight(0xfff3e0, 0xa07850, 1.1));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.2); sun.position.set(8, 10, 5); sun.target.position.set(4, 0, 4); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 }); sun.shadow.bias = -.0006; sun.shadow.normalBias = .02;
  scene.add(sun, sun.target);
  [[2, 1.6, 2], [6, 1.6, 5]].forEach(p => { const l = new THREE.PointLight(0xffb060, 8, 7, 1.8); l.position.set(...p); scene.add(l); });
  const camera = new THREE.PerspectiveCamera(30, W / H, 1, 100); camera.position.set(13, 11, 13); camera.lookAt(4, .8, 4); camera.updateMatrixWorld(true);
  return { scene, camera };
}

// 束ごとに測る。frame() = 1フレーム描く、sync() = GPU の終わりを待つ。返り値 = 束ごとの「1フレームの ms」の下 1/4 の値
// 最初の数束は、シェーダーのコンパイルやパイプラインの作成で何倍も遅くなる（測りたいのは、そのあとの定常の速さ）。
// なので、束の時間が落ち着く（それまでの最小の 1.5 倍以内の束が 2 回続く）まで「準備」として数えず、落ち着いてから st.batches 束を測る。
async function measure(frame, sync, st, failNow) {
  const per = [], t00 = performance.now(); let best = Infinity, calm = 0;
  for (let b = 0; ; b++) {
    if (gone(st)) throw new Error('hidden');   // 裏に回る・家に入ると rAF・GPU の待ちが止まって測れない（あとでやり直す）
    const t0 = performance.now();
    for (let i = 0; i < st.per; i++) frame();
    await sync();
    const ms = (performance.now() - t0) / st.per;
    failNow();    if (b < st.warm) best = Math.min(best, ms);
    else if (calm < 2 && b < st.warm + st.warmMax && performance.now() - t00 < st.warmTime) { calm = ms <= best * 1.5 ? calm + 1 : 0; best = Math.min(best, ms); }   // まだ準備
    else per.push(ms);
    await tick();
    if (per.length >= st.batches) break;
  }
  per.sort((a, b) => a - b);
  return per[(per.length - 1) >> 2];   // 下から 1/4 の値（ほかの処理の割り込みは遅い側にしか出ないので、中央値より、ふだんの速さに近い）
}

async function trialGpu(deps, st, ph) {   // ph = いまどの段階か（失敗の理由に付ける）
  const ad = deps.adapter, lim = ad && ad.limits || {};
  if (ad && (ad.isFallbackAdapter || (ad.info && ad.info.isFallbackAdapter))) throw new Error('software-adapter');   // ソフトウェア描画（GPU なし）は使わない
  if (lim.maxTextureDimension2D && lim.maxTextureDimension2D < 4096) throw new Error('limits');
  ph.v = 'load'; const P0 = await deps.loadWebGpu(), WG = P0.WG, canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const r = new WG.WebGPURenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  let bad = '', dv0 = null;
  const failNow = () => { if (bad) throw new Error(bad); };
  try {
    ph.v = 'init'; await withTimeout(r.init(), 6000);
    if (!r.backend || r.backend.isWebGPUBackend !== true) throw new Error('not-webgpu-backend');
    const dv = dv0 = r.backend.device;
    dv.lost.then(i => { if (i.reason !== 'destroyed') bad = bad || 'lost:' + i.reason; });
    dv.addEventListener('uncapturederror', e => { bad = bad || 'error:' + msg(e.error); });
    deps.configureRenderer(WG, r);
    r.setPixelRatio(1); r.setSize(W, H, false); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    const { scene, camera } = buildScene(); camera.coordinateSystem = WG.WebGPUCoordinateSystem;
    ph.v = 'post'; const post = deps.makePost(scene, camera, Object.assign({}, P0, { r }));
    post.apply({ gtao: true, gs: 16, gscale: .5, smaa: true }, .28, { ao: true, bloom: true });
    ph.v = 'render'; const ms = await measure(() => post.render(), () => dv.queue.onSubmittedWorkDone(), st, failNow);
    failNow(); return ms;
  } finally { try { r.dispose(); } catch (e) {} try { dv0 && dv0.destroy && dv0.destroy(); } catch (e) {} }   // 試験用の renderer と device をかたづける（くり返すと GPU の device がたまるため）
}

async function trialGl(st) {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  try {
    r.setPixelRatio(1); r.setSize(W, H, false); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.VSMShadowMap;
    const { scene, camera } = buildScene(), rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }), composer = new EffectComposer(r, rt);
    composer.addPass(new RenderPass(scene, camera));
    const gtao = new GTAOPass(scene, camera, W / 2, H / 2); gtao.updateGtaoMaterial({ radius: .5, distanceExponent: 1.2, thickness: 1.5, scale: 1.8, samples: 16, distanceFallOff: 1 }); composer.addPass(gtao);
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), .28, .6, 1.1)); composer.addPass(new OutputPass()); composer.addPass(new SMAAPass(1, 1));
    composer.setPixelRatio(1); composer.setSize(W, H);
    const gl = r.getContext(), px = new Uint8Array(4);
    return await measure(() => composer.render(), () => { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }, st, () => {});   // 1画素を読んで、GPU の終わりを待つ
  } finally { try { r.dispose(); r.forceContextLoss(); } catch (e) {} }
}

// deps = { gpu, adapter, loadWebGpu, configureRenderer, makePost, judge, webkit, steps, noGl }。
// 1回の悪い結果では決めない：失敗・遅いは、間をあけて最大 3 回まで試し、1回でも合格すれば合格（ゆれの大きい起動直後・重なった処理への備え）。
// ソフトウェア描画・limits 不足は何度やっても同じなので、すぐ不合格。返り値 = { ok, gpuMs, glMs, why, tries: [[gpuMs, glMs, why]...] }。裏に回って測れなかったら { aborted: true }
const HARD = /software-adapter|limits/;
export async function runGpuTrial(deps) {
  const st = Object.assign({ warm: 1, warmMax: 12, warmTime: 8000, batches: 8, per: 6, tries: 3, gap: 2500 }, deps.steps, { away: deps.away }), out = { ok: false, gpuMs: null, glMs: null, why: '', tries: [] };
  let glDone = false;
  for (let n = 0; n < st.tries; n++) {
    if (n) await new Promise(r => setTimeout(r, st.gap));
    if (gone(st)) { out.aborted = true; return out; }
    const rel = deps.hold ? await deps.hold() : null;   // メインの描画が静かになるまで待ち、測っているあいだはメインの描画を止める（同じ GPU の取り合いで ms が何倍にもぶれるため）
    try {
    const ph = { v: 'start' }; let gpuMs = null, why = '';
    try { gpuMs = await withTimeout(trialGpu(deps, st, ph), 40000); } catch (e) { why = 'gpu:' + msg(e) + '@' + ph.v; }
    if (/hidden/.test(why)) { out.aborted = true; return out; }
    if (!why) {
      if (!deps.noGl && !glDone) { try { out.glMs = await withTimeout(trialGl(st), 20000); } catch (e) { if (gone(st)) { out.aborted = true; return out; } out.glMs = null; } glDone = true; }   // WebGL の測定が取れなければ、WebGPU の絶対値だけで見る
      const j = deps.judge(gpuMs, out.glMs, deps.webkit); why = j.ok ? '' : j.why;
    }
    out.tries.push([gpuMs == null ? null : +(+gpuMs).toFixed(2), out.glMs == null ? null : +(+out.glMs).toFixed(2), why.slice(0, 40)]);
    if (gpuMs != null && (out.gpuMs == null || gpuMs < out.gpuMs)) out.gpuMs = gpuMs;
    out.why = why;
    if (!why) { out.ok = true; out.gpuMs = gpuMs; return out; }
    if (HARD.test(why)) break;
    } finally { if (rel) rel(); }
  }
  return out;
}
