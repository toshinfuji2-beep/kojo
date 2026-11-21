// 家の中を WebGPU で描く部品（three r170 の WebGPURenderer ＋ TSL の後処理）と、「その端末で WebGPU を使うか」を決める仕組み。
// ふだんの起動で軽いのは、このファイルだけ（three/webgpu・後処理・試験は、使うと決まったとき／試験が必要なときだけ読み込む）。
//
// 決め方（自動）：
//   1. navigator.gpu がない端末は WebGL（何も読まない）。
//   2. あれば adapter（GPU の識別）を取り、「描画の版・ブラウザ・GPU」の鍵で、この端末の試験の記録（localStorage）を探す。
//   3. 記録があれば従来どおり（合格 → WebGPU、不合格 → WebGL）。試験はしない。
//   4. 記録がなければ、この起動は WebGL で始め、起動が落ち着いてから見えない小さな画面で試験する（gputrial.js）。結果は次の起動から使う。
// 使っている途中で WebGPU が失敗したら（device lost・例外・ひどいコマ落ち）、その端末を WebGL として記録して読み直す。
// さこのアカウントだけ、設定から「自動／WebGPU／WebGL」を選べる（pref。端末ごとに保存）。URL の ?gpu=webgpu・?gpu=webgl は開発用の強制。
import * as THREE from 'three';

export const GPU = { on: false, label: 'WebGL', pref: 'auto', why: '', key: '', needTrial: false, info: '', forced: '' };
export const RENDER_VER = 1;   // WebGPU 版の組み立てを変えたら上げる（上げると、全部の端末がもう一度試験する）
const Q = new URLSearchParams(location.search);
// WebKit（iPhone・iPad の全ブラウザ＝iOS の Chrome/Edge も WebKit、Mac の Safari）か。?dev=ios は確認用に iPhone 扱いにする
export function isWebKit() {
  try {
    if (Q.get('dev') === 'ios') return true;
    const ua = navigator.userAgent || '', other = /Chrome|Chromium|Edg|OPR|Android/.test(ua) && !/CriOS|EdgiOS/.test(ua);
    if (other) return false;
    if (/iPhone|iPad|iPod|CriOS|FxiOS|EdgiOS/.test(ua)) return true;   // iOS はどのブラウザも WebKit
    if (/AppleWebKit/.test(ua) && /Safari|Macintosh/.test(ua)) return true;   // Mac の Safari・iPadOS の Mac 偽装（UA は Macintosh）
    return 'GestureEvent' in window && navigator.vendor === 'Apple Computer, Inc.';
  } catch (e) { return false; }
}

// ===== この端末の保存（localStorage。使えない・壊れていても何も起きない） =====
const K_REC = 'kojo_gpurec', K_PREF = 'kojo_gpupref', K_FB = 'kojo_gpufb';
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const ssGet = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };
try { localStorage.removeItem('kojo_gpu'); localStorage.removeItem('kojo_gpuauto'); } catch (e) {}   // 昔の「描画」の保存（手で選んだ値・自動の記録）は読まずに消す
// 記録 = { k: 鍵, ok: 合格か, gpuMs, glMs: 1フレームの ms, why: 不合格の理由, v: 描画の版, t: 時刻 }。鍵が違えば（GPU・ブラウザ・描画の版が変われば）無いものとして扱う
export function readRec() {
  try { const r = JSON.parse(lsGet(K_REC) || 'null'); return r && typeof r === 'object' && typeof r.k === 'string' && typeof r.ok === 'boolean' ? r : null; } catch (e) { return null; }
}
export function saveRec(rec) { lsSet(K_REC, JSON.stringify(Object.assign({ v: RENDER_VER, t: Date.now() }, rec))); }
export function getPref() { const v = lsGet(K_PREF); return v === 'webgpu' || v === 'webgl' ? v : 'auto'; }
export function setPref(v) { if (v === 'auto') { try { localStorage.removeItem(K_PREF); } catch (e) {} } else lsSet(K_PREF, v === 'webgpu' ? 'webgpu' : 'webgl'); GPU.pref = getPref(); }

// ブラウザの名前と大きな版（Chrome 130 など）。GPU の識別とあわせて鍵にする
function browserTag() {
  const ua = navigator.userAgent || '', m = /(Edg|OPR|CriOS|FxiOS|Chrome|Version|Firefox)\/(\d+)/.exec(ua);
  return (m ? m[1] + m[2] : 'ua') + (isWebKit() ? 'w' : '');
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error('timeout')), ms))]);
const infoOf = ad => { const i = (ad && ad.info) || {}; return { vendor: String(i.vendor || ''), architecture: String(i.architecture || ''), device: String(i.device || ''), description: String(i.description || '') }; };
export function gpuKey(ad) { const i = infoOf(ad); return [RENDER_VER, browserTag(), i.vendor, i.architecture, i.device, i.description].join('|').slice(0, 300); }
// adapter を取る（navigator.gpu は試験のにせ物に差し替えられる）。取れなければ null
export async function probeAdapter(gpu) {
  try { return (await withTimeout((gpu || navigator.gpu).requestAdapter({ powerPreference: 'high-performance' }), 2500)) || null; } catch (e) { return null; }
}

// ===== 試験の合否（ここだけで決める。gputrial.js の測った値を受け取る） =====
// gpuMs・glMs = 同じ小さなシーン（後処理つき）の 1 フレームの ms。WebGL の測定が取れなかったら glMs は null
// 不合格：WebGPU が 25ms/フレームより遅い。WebGL と比べて、ふつうの端末は 1.1 倍まで（同じ・より速い）か、16.7ms 以内（60fps）なら合格。iPhone・Mac の Safari（WebKit）は WebGL の 0.8 倍より速くなければ WebGL（安定が第一）
export function judge(gpuMs, glMs, webkit) {
  if (!(gpuMs > 0)) return { ok: false, why: 'nomeasure' };
  if (gpuMs > 25) return { ok: false, why: 'slow:' + gpuMs.toFixed(1) + 'ms' };
  if (glMs > 0) {
    const lim = webkit ? .8 : 1.1;
    if (gpuMs > glMs * lim && (webkit || gpuMs > 16.7)) return { ok: false, why: 'slower-than-webgl' };   // 少し遅くても 16.7ms（60fps）以内なら、WebGPU のほうが画質が高いので合格（iPhone は今のまま）
  }
  return { ok: true, why: '' };
}

// ===== 使っている途中の失敗 → WebGL に戻す（その端末は WebGL として記録する） =====
let failed = false;
export function gpuFail(why, dry) {   // dry = 試験用（記録だけして読み直さない）
  console.error('gpu fallback:', why);
  if (!GPU.on || failed) return false;
  if (Q.get('gpu') === 'webgl' || Q.get('nofb') === '1') return false;   // nofb=1 は確認用（読み直さずエラーを見る）
  failed = true;
  saveRec({ k: GPU.key, ok: false, why: String(why).slice(0, 80) });
  ssSet(K_FB, '1');   // このタブは WebGL で読み直す（強制の WebGPU でもくり返さない）
  if (dry) return true;
  try { const u = new URL(location.href); if (u.searchParams.get('gpu') === 'webgpu') { u.searchParams.set('gpu', 'webgl'); location.replace(u.toString()); } else location.reload(); } catch (e) { return false; }
  return true;
}
export const fallbackReload = gpuFail;   // 古い呼び名

// ===== WebGPU の部品の読み込み（使う端末・試験のときだけ） =====
export async function loadWebGpu() {
  const [WG, aoM, dnM, blM, smM, fxM] = await withTimeout(Promise.all([
    import('three/webgpu'), import('three/addons/tsl/display/GTAONode.js'), import('three/addons/tsl/display/DenoiseNode.js'),
    import('three/addons/tsl/display/BloomNode.js'), import('three/addons/tsl/display/SMAANode.js'), import('three/addons/tsl/display/FXAANode.js')]), 10000);
  return { WG, ao: aoM.ao, denoise: dnM.denoise, bloom: blM.bloom, smaa: smM.smaa, fxaa: fxM.fxaa };
}
// 画面の中身は 'three'（別コピー）で作るので、ライトの種類を対応づける。深度の絵の読み方も直す
export function configureRenderer(WG, r) {
  // three r170 は、動かない物（壁・床・家具）の「シーン全体の値」（環境光の強さなど）を最初の1回のあと更新しない。値を変えた回（gpuDirty）だけ、全部の物で更新するようにする
  const OP = WG.NodeMaterialObserver.prototype;
  if (!OP.__kojoRefresh) { const nr = OP.needsRefresh; OP.needsRefresh = function (ro, nf) { return GPUX.dirty || nr.call(this, ro, nf); }; OP.__kojoRefresh = true; }
  r.library.addLight(WG.DirectionalLightNode, THREE.DirectionalLight);
  r.library.addLight(WG.HemisphereLightNode, THREE.HemisphereLight);
  r.library.addLight(WG.PointLightNode, THREE.PointLight);
  // three r170 は深度の絵を「補間あり」の入れ物で読もうとし、いまの GPU ドライバーにエラーにされる。深度の絵の相棒は「補間なし」にする
  // 'three' の材質のうち userData.gpuNode（ノード材質を返す関数）を持つものは、自動の変換のかわりにそのノード材質を使う（窓の景色。サムネイルは WebGL のまま同じ材質で描ける）
  const lib = r.library, fm = lib.fromMaterial.bind(lib), nodeOf = new WeakMap();
  lib.fromMaterial = m => {
    const mk = m.userData && m.userData.gpuNode; if (typeof mk !== 'function') return fm(m);
    let nm = nodeOf.get(m); if (!nm) { nm = mk(); if (nm) nodeOf.set(m, nm); }
    return nm || fm(m);
  };
  const dv0 = r.backend.device, bu = r.backend.bindingUtils, ocl = bu.createBindingsLayout.bind(bu);   // 深度の絵＋補間なし(Nearest)の入れ物は、GPU に「補間なし」と伝える
  bu.createBindingsLayout = g => { const nf = g.bindings.map(x => !!(x.isSampler && x.texture && x.texture.isDepthTexture && x.texture.compareFunction === null && x.texture.minFilter === WG.NearestFilter && x.texture.magFilter === WG.NearestFilter)), o = dv0.createBindGroupLayout;
    dv0.createBindGroupLayout = d => { (d.entries || []).forEach((e, i) => { if (nf[i] && e.sampler) e.sampler.type = 'non-filtering'; }); return o.call(dv0, d); };
    try { return ocl(g); } finally { dv0.createBindGroupLayout = o; } };
}

const GPUX = { dirty: false };
// 環境光・明るさなど、シーン全体の値を変えたら呼ぶ（WebGPU：次の1回の描画で、全部の物がその値を読み直す）
export const gpuDirty = () => { GPUX.dirty = true; };
let pre = null;   // 準備できた WebGPU 一式（renderer など）
export const gpuPre = () => pre;

// 起動のとき1回（main.js が boot の前に await する）。使えるなら GPU.on = true にして renderer を用意しておく。使えないは null、読み直し中は 'reload'
export async function prepareGpu(canvas) {
  GPU.pref = getPref(); GPU.forced = Q.get('gpu') === 'webgpu' || Q.get('gpu') === 'webgl' ? Q.get('gpu') : '';
  if (!navigator.gpu) { GPU.why = 'noapi'; return null; }   // WebGPU のない端末は、何も読まず WebGL
  if (GPU.forced === 'webgl') { GPU.why = 'forced'; return null; }
  let want = GPU.forced === 'webgpu';
  const ad = await probeAdapter();
  GPU.key = gpuKey(ad); GPU.info = ad ? (infoOf(ad).vendor + ' ' + infoOf(ad).architecture).trim() : '';
  if (!want) {
    if (ssGet(K_FB) === '1') { GPU.why = 'fallback'; return null; }   // このタブで一度失敗した
    if (GPU.pref === 'webgl') { GPU.why = 'pref'; return null; }
    if (GPU.pref === 'webgpu') want = true;
    else {
      if (!ad) { GPU.why = 'noadapter'; return null; }
      const rec = readRec();
      if (rec && rec.k === GPU.key) { GPU.why = rec.ok ? '' : rec.why || 'trial'; want = rec.ok; }
      else { GPU.needTrial = true; GPU.why = 'untested'; }   // 初めて：今回は WebGL で始めて、落ち着いてから試験する
    }
  }
  if (!want || !ad) return null;
  let M;
  try { M = await loadWebGpu(); } catch (e) { console.warn('gpu unavailable:', e && e.message || e); GPU.why = 'load'; return null; }   // 部品を読めない（回線が遅い・CDN に届かない）ときは、キャンバスに触らずそのまま従来の経路へ
  let skyMod = null;
  try { skyMod = await withTimeout(import('./skyview_tsl.js?v=202611211556'), 10000); } catch (e) { console.warn('gpu sky unavailable:', e && e.message || e); GPU.why = 'load'; return null; }
  try {   // ここから先で失敗したらキャンバスが WebGPU に使われているので、読み直して従来の経路で起こし直す
    const { WG } = M, r = new WG.WebGPURenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    await withTimeout(r.init(), 6000);
    if (!r.backend || r.backend.isWebGPUBackend !== true) throw new Error('not webgpu backend');
    configureRenderer(WG, r);
    pre = Object.assign({ r, sky: skyMod.skyNodeMat }, M);
    GPU.on = true; GPU.label = 'WebGPU'; window.__kojoGpu = 'WebGPU';   // （画面テスト用の印）
    // 描画の最初の15秒に GPU がエラーを出したら（シェーダーが通らない等）、従来の経路で起こし直す
    const t0 = performance.now(), dv = r.backend.device;
    dv.addEventListener('uncapturederror', e => { console.error('gpu error:', e.error && e.error.message); if (performance.now() - t0 < 15000) gpuFail('uncaptured'); });
    dv.lost.then(i => { if (i.reason !== 'destroyed') gpuFail('lost: ' + i.reason); });
    return pre;
  } catch (e) {
    return gpuFail(e && e.message || e) ? 'reload' : null;
  }
}

// ===== 初めての端末の試験（起動が落ち着いてから、見えない小さな画面で） =====
let trialP = null;
// 試験と、メインの描画の取り合いをさける。main.js は、描くたびに mainRendered() を呼び、TRIAL.pause のあいだは描かない。
// TRIAL.away() = いま試験をしてはいけない（家の中など、3D を描いている画面）。main.js が決める。自動の試験は、3D を描いていない画面（ホーム・チーミ選択・メンバー選択）でだけ行う
export const TRIAL = { pause: false, lastMain: 0, away: () => false };
export const mainRendered = t => { TRIAL.lastMain = t == null ? performance.now() : t; };
// 試験の 1 回ぶんの前に呼ぶ。メインの描画が 1 秒止まるまで待ち（force でなければ最大 10 秒）、そのあいだ・測っているあいだはメインの描画を止める。返り値 = 再開する関数
const holdMain = force => async () => {
  const t0 = performance.now();
  while (!document.hidden && performance.now() - TRIAL.lastMain < 1000 && performance.now() - t0 < (force ? 0 : 10000)) await new Promise(r => setTimeout(r, 250));
  TRIAL.pause = true;
  const to = setTimeout(() => { TRIAL.pause = false; }, 60000);   // 念のため：1 分たっても戻らなければ描画を再開する
  return () => { clearTimeout(to); TRIAL.pause = false; };
};
// 試験して記録する。force = 記録があってもやり直す（さこの「もう一度試験」）。返り値 = 記録（{ ok, gpuMs, glMs, why, k }）
export function runTrial(force, deps) {
  if (trialP) return trialP;
  trialP = (async () => {
    let rec;
    try {
      const gpu = deps && deps.gpu || navigator.gpu, ad = deps && deps.adapter || await probeAdapter(gpu), key = deps && deps.key || gpuKey(ad);
      GPU.key = key || GPU.key;
      const old = readRec();
      if (!force && old && old.k === key) return old;
      let res;
      if (!ad) res = { ok: false, why: 'noadapter' };
      else {
        const T = await withTimeout(import('./gputrial.js?v=202611211556'), 15000);
        res = await T.runGpuTrial({ gpu, adapter: ad, loadWebGpu: (deps && deps.loadWebGpu) || loadWebGpu, configureRenderer: (deps && deps.configureRenderer) || configureRenderer, makePost: (deps && deps.makePost) || makePost, noGl: !!(deps && deps.noGl), judge, webkit: isWebKit(), steps: deps && deps.steps, hold: deps && deps.noHold ? null : holdMain(force), away: force ? null : () => TRIAL.away() });
      }
      if (res.aborted) return { k: key, ok: false, gpuMs: null, glMs: null, why: 'hidden' };   // 裏に回った・家に入った：保存せず、あとでやり直す（scheduleTrial）
      rec = { k: key, ok: !!res.ok, tries: (res.tries || []).slice(0, 3), gpuMs: res.gpuMs == null ? null : +(+res.gpuMs).toFixed(2), glMs: res.glMs == null ? null : +(+res.glMs).toFixed(2), why: String(res.why || '').slice(0, 80) };
    } catch (e) { rec = { k: GPU.key, ok: false, gpuMs: null, glMs: null, why: 'trial:' + String(e && e.message || e).slice(0, 60) }; }
    saveRec(rec); GPU.needTrial = false;
    return readRec() || rec;
  })().finally(() => { trialP = null; });
  return trialP;
}
// 起動が落ち着いてから（ページが見えていて、ブラウザが暇なとき）1回だけ。試験が要らない端末では何もしない
export function scheduleTrial(delay) {
  if (!GPU.needTrial || GPU.on || Q.get('notrial') === '1') return;
  const go = () => {
    if (document.hidden) { document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(go, 1500); }, { once: true }); return; }
    if (TRIAL.away()) { setTimeout(go, 2000); return; }   // 家の中にいる間は始めない（ホームなどに戻るまで待つ）
    runTrial(false).then(r => { if (r && r.why === 'hidden' && GPU.needTrial) scheduleTrial(1500); }, () => {});   // 中断されたら、あらためてやり直す
  };
  setTimeout(() => { if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 8000 }); else go(); }, delay == null ? 4000 : delay);
}

// 後処理：シーン → 陰影（GTAO＋ぼかし）→ 光のにじみ → 色の調整（ACES）→ 縁のなめらか化（SMAA）。P = 部品一式（ふだんは起動のときの pre、試験は自前のもの）
export function makePost(scene, camera, P) {
  P = P || pre;
  const { WG, r } = P;
  const { pass, renderOutput, vec4 } = WG;
  const pp = new WG.PostProcessing(r);
  pp.outputColorTransform = false;   // 色の調整は自分で入れる（その後ろに SMAA を置くため）
  // ぼかし用のノイズ絵
  const nz = new Uint8Array(64 * 64 * 4); for (let i = 0; i < nz.length; i++) nz[i] = Math.random() * 255 | 0;
  const noise = new WG.DataTexture(nz, 64, 64); noise.wrapS = noise.wrapT = WG.RepeatWrapping; noise.needsUpdate = true;
  const nz2 = new Uint8Array(64 * 64 * 4); for (let i = 0; i < nz2.length; i++) nz2[i] = Math.random() * 255 | 0;
  const noise2 = new WG.DataTexture(nz2, 64, 64); noise2.wrapS = noise2.wrapT = WG.RepeatWrapping; noise2.needsUpdate = true;
  let scenePass = null, aoNode = null, dnNode = null, dn2Node = null, bloomNode = null, last = '';
  let aoScale = .5;
  const aoMix = WG.uniform(1);   // 陰影の強さ（1＝そのまま、0＝なし）。目線に入る・出る途中だけ弱める
  const api = {
    pp, scenePass: () => scenePass,
    // cfg = scene.js の画質設定（msaa・gtao・gscale・gs・pd・smaa）と bloom の強さ。組み立てが変わるときだけ作り直す
    apply(cfg, bloomStrength, opts) {
      const ms = 0,   // WebGPU 版は MSAA なし（MSAA の深度は陰影の計算で読めない）。縁は描く細かさ（超解像）と SMAA で整える
         key = [ms, cfg.gtao, cfg.gs, cfg.smaa, opts.bloom, opts.ao].join();
      aoScale = cfg.gscale;
      if (key !== last) {
        last = key;
        if (scenePass && scenePass.dispose) scenePass.dispose();
        scenePass = pass(scene, camera, { samples: ms });
        { const dt = scenePass.renderTarget.depthTexture; dt.minFilter = dt.magFilter = WG.NearestFilter; }   // 深度は補間なしで読む（補間つきだと GPU のエラーになる）
        const col = scenePass.getTextureNode('output'), dep = scenePass.getTextureNode('depth');
        let img = col;
        if (cfg.gtao && opts.ao) {
          aoNode = P.ao(dep, null, camera);
          aoNode.radius.value = .5; aoNode.distanceExponent.value = 1.2; aoNode.thickness.value = 1.5; aoNode.scale.value = 1.8; aoNode.distanceFallOff.value = 1; aoNode.SAMPLES.value = cfg.gs;
          const so = aoNode.setSize.bind(aoNode); aoNode.setSize = (w, h) => so(Math.max(2, w * aoScale | 0), Math.max(2, h * aoScale | 0));   // 陰影は半分の解像度で（なめらかにぼける・速い）
          dnNode = P.denoise(aoNode.getTextureNode(), dep, null, WG.texture(noise), camera);
          dn2Node = P.denoise(dnNode, dep, null, WG.texture(noise2), camera);   // ぼかしを2回重ねる（1回では、物のふちの粒々が残って壁がざらざらに見える）
          img = vec4(col.rgb.mul(WG.mix(WG.float(1), dn2Node.r, aoMix)), col.a);
        } else { aoNode = dnNode = dn2Node = null; }
        if (opts.bloom) { bloomNode = P.bloom(img, bloomStrength, .6, 1.1); img = img.add(bloomNode); } else bloomNode = null;
        let out = renderOutput(img, r.toneMapping, r.outputColorSpace);
        if (cfg.smaa) out = P.fxaa(P.smaa(out));   // SMAA は色の差が小さい縁（夜の暗い机など）を見のがすので、差に敏感な FXAA を重ねる（WebGL の MSAA に近いなめらかさ）
        pp.outputNode = out; pp.needsUpdate = true;
      }
      if (aoNode) aoNode.SAMPLES.value = cfg.gs;   // 写真のとき、組み立てを変えずにサンプル数だけ増やす
      const pr0 = cfg.pdr || 20;   // ぼかしの半径（写真のときだけ大きく）
      if (dnNode) { for (const [n, rad] of [[dnNode, pr0], [dn2Node, pr0 / 2]]) { n.lumaPhi.value = 24; n.depthPhi.value = 3; n.normalPhi.value = 8; n.radius.value = rad; } }
      if (bloomNode) bloomNode.strength.value = bloomStrength;
    },
    setAo(k) { aoMix.value = k; },
    render() { try { pp.render(); } finally { GPUX.dirty = false; } }
  };
  return api;
}
