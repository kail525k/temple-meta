// Meshy로 만든 아기 스님 GLB(믹사모 뼈대 + 걷기·달리기)를 불러와 앱의 아바타로 쓰기
// - 걷기/달리기: 이동 속도에 맞춰 섞어 재생 (제자리 걸음이 되도록 골반의 앞뒤 이동은 제거)
// - 합장·절·삼배: 로드할 때 팔(IK)·허리·무릎 자세를 미리 계산해 두고, 매 프레임 가중치만큼 섞음
// - 눈 깜빡임·감은 눈: 텍스처에서 눈동자 위치를 찾아 그 위에 '감은 눈' 그림을 덧씌움
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export async function loadMonkGLB(url, { height = 1.11, onProgress } = {}) {
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url, e => onProgress && e.total && onProgress(e.loaded / e.total));
  const scene = gltf.scene, root = new THREE.Group(), turn = new THREE.Group();
  turn.add(scene); root.add(turn);

  // 메시·뼈 찾기
  const meshes = [], bones = [];
  scene.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; meshes.push(o);
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(m => { if (m.isMeshStandardMaterial) { m.metalness = 0; m.roughness = Math.max(m.roughness ?? .6, .62); m.envMapIntensity = .6; } });
    }
    if (o.isBone) bones.push(o);
  });
  const bone = name => { const n = norm(name); return bones.find(b => norm(b.name).endsWith(n)) || null; };
  const B = {};
  for (const k of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot']) B[k] = bone(k);
  const info = { bones: bones.map(b => b.name), clips: gltf.animations.map(a => `${a.name} ${a.duration.toFixed(2)}s`), found: Object.fromEntries(Object.entries(B).map(([k, v]) => [k, !!v])) };

  // 크기 맞추기 (키 height m) + 발이 바닥에 닿게
  scene.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(scene, true);
  const s = height / Math.max(1e-6, box.max.y - box.min.y);
  scene.scale.multiplyScalar(s); scene.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(scene, true);
  scene.position.y -= box.min.y; scene.position.x -= (box.min.x + box.max.x) / 2; scene.updateMatrixWorld(true);

  const W = new THREE.Vector3(), wp = o => o.getWorldPosition(new THREE.Vector3()), wq = o => o.getWorldQuaternion(new THREE.Quaternion());

  // 얼굴 방향 확인: 텍스처에서 찾은 눈이 머리 중심보다 앞(+Z)에 있어야 함
  const eyes = findEyes(meshes, B.Head);
  info.eyes = eyes ? eyes.map(e => e.c.toArray().map(v => +v.toFixed(3))) : null;
  if (eyes && B.Head) { const hz = wp(B.Head).z, ez = (eyes[0].c.z + eyes[1].c.z) / 2; if (ez < hz) { turn.rotation.y = Math.PI; } }
  root.updateMatrixWorld(true);

  // 쉬는 자세(A포즈) 저장
  const rest = new Map(); bones.forEach(b => rest.set(b, { q: b.quaternion.clone(), p: b.position.clone() }));
  const restQ = b => rest.get(b).q;

  // 모델 공간(root 기준) 축을 뼈의 로컬 축으로 바꿔 회전시키는 도우미 (쉬는 자세 기준으로 한 번 계산)
  const rootQinv = wq(root).invert();
  const localAxis = (b, axis) => axis.clone().applyQuaternion(rootQinv.clone().multiply(wq(b)).invert());
  const axisRot = (b, axis, ang) => new THREE.Quaternion().setFromAxisAngle(localAxis(b, axis), ang);

  // ── 합장 자세: 두 손이 가슴 앞에서 만나도록 팔 IK ──
  const hapQ = new Map();
  const solveArm = (side) => {
    const sh = B[side + 'Arm'], el = B[side + 'ForeArm'], hd = B[side + 'Hand']; if (!sh || !el || !hd) return;
    const S = wp(sh), E = wp(el), H = wp(hd), a = S.distanceTo(E), b = E.distanceTo(H);
    const sgn = Math.sign(S.x - (B.Hips ? wp(B.Hips).x : 0)) || (side === 'Left' ? 1 : -1);
    const chestY = B.Spine2 ? wp(B.Spine2).y : S.y - a * .4;
    const T = new THREE.Vector3(sgn * (a + b) * .06, (S.y + chestY) / 2 - (a + b) * .05, S.z + (a + b) * .62);
    let d = S.distanceTo(T); const maxd = (a + b) * .985; if (d > maxd) { T.sub(S).setLength(maxd).add(S); d = maxd; }
    const ca = THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), ang = Math.acos(ca);
    const dir = T.clone().sub(S).normalize(), pole = new THREE.Vector3(sgn * .6, -1, -.35).normalize();
    const bend = pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    const E2 = S.clone().add(dir.clone().multiplyScalar(Math.cos(ang) * a)).add(bend.multiplyScalar(Math.sin(ang) * a));
    // 위팔
    const shW = wq(sh), shW2 = new THREE.Quaternion().setFromUnitVectors(E.clone().sub(S).normalize(), E2.clone().sub(S).normalize()).multiply(shW);
    const shParent = wq(sh.parent), shL = shParent.clone().invert().multiply(shW2);
    // 아래팔
    const elW = wq(el), elRestDir = H.clone().sub(E).normalize(), elRestRel = shW.clone().invert().multiply(elW); // 위팔 기준 상대 회전
    const elW1 = shW2.clone().multiply(elRestRel); // 위팔만 돌렸을 때 아래팔
    const curDir = elRestDir.clone().applyQuaternion(shW.clone().invert()).applyQuaternion(shW2);
    const elW2 = new THREE.Quaternion().setFromUnitVectors(curDir, T.clone().sub(E2).normalize()).multiply(elW1);
    const elL = shW2.clone().invert().multiply(elW2);
    // 손: 손끝이 위를 향하게
    const hdW = wq(hd), hdRel = elW.clone().invert().multiply(hdW), hdW1 = elW2.clone().multiply(hdRel);
    const handDir = T.clone().sub(E2).normalize();
    const hdW2 = new THREE.Quaternion().setFromUnitVectors(handDir, new THREE.Vector3(-sgn * .15, 1, .25).normalize()).multiply(hdW1);
    const hdL = elW2.clone().invert().multiply(hdW2);
    hapQ.set(sh, shL); hapQ.set(el, elL); hapQ.set(hd, hdL);
  };
  solveArm('Left'); solveArm('Right');

  // ── 무릎 꿇기: 정강이를 뒤로 접고 골반을 무릎 높이만큼 내림 ──
  const kneelQ = new Map();
  for (const sd of ['Left', 'Right']) if (B[sd + 'Leg']) kneelQ.set(B[sd + 'Leg'], restQ(B[sd + 'Leg']).clone().multiply(axisRot(B[sd + 'Leg'], X, 1.45)));
  for (const sd of ['Left', 'Right']) if (B[sd + 'Foot']) kneelQ.set(B[sd + 'Foot'], restQ(B[sd + 'Foot']).clone().multiply(axisRot(B[sd + 'Foot'], X, .7)));
  const kneeH = B.LeftLeg ? wp(B.LeftLeg).y : height * .15;
  const hipsDrop = Math.max(0, kneeH - height * .025);
  // 월드에서 '아래로 hipsDrop' 만큼을 골반 부모의 로컬 좌표로 바꿔 둠 (뼈대가 눕혀져 있어도 맞게)
  let dropVec = new THREE.Vector3();
  if (B.Hips) { const hw = wp(B.Hips), par = B.Hips.parent; dropVec = par.worldToLocal(hw.clone().add(new THREE.Vector3(0, -hipsDrop, 0))).sub(par.worldToLocal(hw.clone())); }

  // 허리 숙이기 축 (뼈마다 로컬 축)
  const spineBones = [['Spine', .5], ['Spine1', .3], ['Spine2', .2]].filter(([k]) => B[k]).map(([k, w]) => ({ b: B[k], w, ax: localAxis(B[k], X) }));
  const headAx = B.Head ? { x: localAxis(B.Head, X), z: localAxis(B.Head, new THREE.Vector3(0, 0, 1)) } : null;

  // ── 애니메이션 ──
  const mixer = new THREE.AnimationMixer(scene);
  const clip = re => gltf.animations.find(a => re.test(a.name));
  const walkClip = clip(/walk/i) || gltf.animations[0], runClip = clip(/run/i) || null;
  const hipsName = B.Hips ? B.Hips.name : null;
  const stripRoot = c => {
    if (!c || !hipsName) return c;
    c = c.clone();
    for (const t of c.tracks) if (t.name.endsWith('.position') && t.name.startsWith(THREE.PropertyBinding.sanitizeNodeName(hipsName))) {
      const r = rest.get(B.Hips).p, v = t.values; for (let i = 0; i < v.length; i += 3) { v[i] = r.x; v[i + 2] = r.z; }
    }
    return c;
  };
  const walk = walkClip ? mixer.clipAction(stripRoot(walkClip)) : null, run = runClip && runClip !== walkClip ? mixer.clipAction(stripRoot(runClip)) : null;
  const hipsAnimated = !!hipsName && [walkClip, runClip].some(c => c && c.tracks.some(t => t.name.startsWith(THREE.PropertyBinding.sanitizeNodeName(hipsName) + '.position')));
  [walk, run].forEach(a => { if (a) { a.play(); a.setEffectiveWeight(0); } });
  let runMix = 0;

  // ── 감은 눈 덧씌우기 ──
  const lids = [];
  if (eyes && B.Head) {
    const tex = lidTexture(eyes[0].skin);
    for (const e of eyes) {
      const w = e.w * 1.35, h = e.h * 1.3;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: .6, polygonOffset: true, polygonOffsetFactor: -4 }));
      const p = e.c.clone().addScaledVector(e.n, .004 * height);
      m.position.copy(p); m.lookAt(p.clone().add(e.n)); m.renderOrder = 3; m.visible = false;
      B.Head.attach(m); lids.push(m);
    }
  }

  let bodyHide = null;
  function update(dt, st) {
    // 걷기·달리기 섞기
    const wantRun = st.speed > 5 && run ? 1 : 0; runMix += (wantRun - runMix) * Math.min(1, dt * 6);
    if (walk) { walk.setEffectiveWeight(st.walkAmp * (1 - runMix)); walk.timeScale = Math.max(.6, st.speed / 3.6) * 1.15; }
    if (run) { run.setEffectiveWeight(st.walkAmp * runMix); run.timeScale = Math.max(.6, st.speed / 7); }
    if (!walk && !run) bones.forEach(b => b.quaternion.copy(restQ(b)));
    mixer.update(dt);
    // 합장
    if (st.hap > 0) for (const [b, q] of hapQ) b.quaternion.slerp(q, st.hap);
    // 무릎 꿇기
    if (B.Hips && !hipsAnimated) B.Hips.position.copy(rest.get(B.Hips).p);
    if (st.kneel > 0) {
      for (const [b, q] of kneelQ) b.quaternion.slerp(q, st.kneel);
      if (B.Hips) B.Hips.position.addScaledVector(dropVec, st.kneel);
    }
    // 허리 숙이기
    if (st.bend) { const tot = st.bend * (st.kneel > .3 ? 1.35 : .85); for (const { b, w, ax } of spineBones) b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(ax, tot * w)); }
    // 고개 (끄덕임·갸웃)
    if (headAx && (st.headX || st.headZ)) {
      B.Head.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(headAx.x, st.headX || 0)).multiply(new THREE.Quaternion().setFromAxisAngle(headAx.z, st.headZ || 0));
    }
    // 눈
    const shut = st.closed || st.blink; lids.forEach(m => { m.visible = shut; });
  }
  return { root, scene, mixer, update, info, lids, B };
}

// 머리(Head 뼈 가중치가 큰) 앞쪽 삼각형을 촘촘히 샘플링해 텍스처가 아주 어두운 곳(눈동자)을 찾음
function findEyes(meshes, headBone) {
  if (!headBone) return null;
  const pts = [], skinCols = [];
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), p = new THREE.Vector3(), n = new THREE.Vector3();
  const headC = headBone.getWorldPosition(new THREE.Vector3());
  for (const mesh of meshes) {
    const g = mesh.geometry, pos = g.attributes.position, uv = g.attributes.uv, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const map = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).map;
    if (!pos || !uv || !map || !map.image) continue;
    const img = map.image, cw = 512, ch = 512, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, cw, ch);
    const data = cx.getImageData(0, 0, cw, ch).data;
    const sample = (u, v) => { u = ((u % 1) + 1) % 1; v = ((v % 1) + 1) % 1; const x = Math.min(cw - 1, u * cw | 0), y = Math.min(ch - 1, (map.flipY ? 1 - v : v) * ch | 0), i = (y * cw + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
    let headIdx = -1; if (mesh.isSkinnedMesh) headIdx = mesh.skeleton.bones.indexOf(headBone);
    const headW = i => { if (headIdx < 0 || !si) return 1; let w = 0; for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === headIdx) w += sw.getComponent(i, k); return w; };
    const idx = g.index ? g.index.array : null, triCount = idx ? idx.length / 3 : pos.count / 3;
    const toW = (i, out) => { mesh.getVertexPosition(i, out); return mesh.localToWorld(out); }; // 양자화·스키닝까지 반영한 실제 위치
    for (let t = 0; t < triCount; t++) {
      const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, c = idx ? idx[t * 3 + 2] : t * 3 + 2;
      if (headW(a) + headW(b) + headW(c) < 1.5) continue;
      toW(a, v0); toW(b, v1); toW(c, v2);
      n.subVectors(v1, v0).cross(p.subVectors(v2, v0)).normalize();
      for (let s1 = 0; s1 < 4; s1++) for (let s2 = 0; s2 < 4 - s1; s2++) {
        const wa = (s1 + .33) / 4.33, wb = (s2 + .33) / 4.33, wc = 1 - wa - wb; if (wc < 0) continue;
        p.set(0, 0, 0).addScaledVector(v0, wa).addScaledVector(v1, wb).addScaledVector(v2, wc);
        const u = uv.getX(a) * wa + uv.getX(b) * wb + uv.getX(c) * wc, v = uv.getY(a) * wa + uv.getY(b) * wb + uv.getY(c) * wc;
        const [r, gg, bb] = sample(u, v), l = .3 * r + .59 * gg + .11 * bb;
        const rel = p.clone().sub(headC);
        if (l < 48) pts.push({ p: p.clone(), n: n.clone(), rel });
        else if (l > 150 && r > bb + 15 && rel.y < 0) skinCols.push([r, gg, bb]);
      }
    }
  }
  if (pts.length < 12) return null;
  // 앞쪽(얼굴 쪽) 판단: 어두운 점들의 평균 방향
  const avg = pts.reduce((s, q) => s.add(q.rel), new THREE.Vector3()).divideScalar(pts.length);
  const fwdZ = Math.sign(avg.z) || 1;
  const front = pts.filter(q => q.rel.z * fwdZ > 0 && q.n.z * fwdZ > 0.15);
  // 좌우 두 덩어리 (x 부호), 입처럼 가운데 아래 있는 건 제외
  const sides = [-1, 1].map(sx => front.filter(q => q.rel.x * sx > .01));
  if (sides.some(sd => sd.length < 5)) return null;
  const skin = skinCols.length ? skinCols.reduce((s, c) => [s[0] + c[0], s[1] + c[1], s[2] + c[2]], [0, 0, 0]).map(v => Math.round(v / skinCols.length)) : [247, 220, 205];
  return sides.map(sd => {
    // 가장 큰 덩어리 주변만 (중앙값 기준)
    const med = new THREE.Vector3(...['x', 'y', 'z'].map(k => sd.map(q => q.p[k]).sort((a, b) => a - b)[sd.length >> 1]));
    const near = sd.filter(q => q.p.distanceTo(med) < .06);
    const c = near.reduce((s, q) => s.add(q.p), new THREE.Vector3()).divideScalar(near.length);
    const nn = near.reduce((s, q) => s.add(q.n), new THREE.Vector3()).normalize();
    const xs = near.map(q => q.p.x), ys = near.map(q => q.p.y);
    return { c, n: nn, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), skin };
  });
}

// 감은 눈: 피부색으로 눈을 덮고, 시트의 합장 얼굴처럼 아래로 둥근 눈썹 모양 선을 그림
function lidTexture(skin) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d');
  const g = c.createRadialGradient(S / 2, S / 2, S * .3, S / 2, S / 2, S * .5);
  const col = `rgb(${skin[0]},${skin[1]},${skin[2]})`;
  g.addColorStop(0, col); g.addColorStop(.8, col); g.addColorStop(1, `rgba(${skin[0]},${skin[1]},${skin[2]},0)`);
  c.fillStyle = g; c.beginPath(); c.ellipse(S / 2, S / 2, S * .5, S * .5, 0, 0, 7); c.fill();
  c.strokeStyle = '#2a1f1c'; c.lineWidth = S * .06; c.lineCap = 'round';
  c.beginPath(); c.ellipse(S / 2, S * .44, S * .3, S * .2, 0, Math.PI * .12, Math.PI * .88); c.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
