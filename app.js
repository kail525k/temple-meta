// 온라인 사찰 참배 체험판 — 사찰마다 법당 하나만 실제 위치·방향·크기로 놓고, 안에 들어가 삼배를 올림 (위레브)
import * as THREE from 'three';
import { createBabyMonk } from './avatar.js?v=4';
import { buildHall } from './hall.js?v=1';

/* ───────── 설정 ───────── */
// hall: 법당(주불전) 실제 좌표. 브이월드 건물 중 이 좌표에 가장 가까운 건물을 법당으로 씀
const CFG = {
  vworldKey: '8047AF94-B2B2-49BC-9C11-746A988127D4',
  naverKeyId: '0fdr2ec8dd',
  temple: { name: '용주사' },
  hall: { name: '대웅보전', lat: 37.212441, lng: 127.005010, buddhas: 3 },
  half: { lat: 0.0009, lng: 0.0011 }, // 조회 범위(약 ±100m)
};

/* ───────── 디버그 ───────── */
const DBG = { page: location.origin, three: THREE.REVISION };
const dbgEl = document.getElementById('dbg');
function dbg(k, v) { DBG[k] = v; renderDbg(); }
function renderDbg() { dbgEl.textContent = Object.entries(DBG).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n'); }
document.getElementById('dbgBtn').onclick = () => dbgEl.classList.toggle('show');
window.addEventListener('error', e => dbg('jsError', String(e.message)));
renderDbg();
const toastEl = document.getElementById('toast');
let toastT;
function toast(msg, ms = 2400) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), ms); }

/* ───────── 좌표 (원점 = 법당 좌표) ───────── */
const R = 6378137;
const LAT0 = CFG.hall.lat, LNG0 = CFG.hall.lng, COS0 = Math.cos(LAT0 * Math.PI / 180);
const toLocal = (lng, lat) => [(lng - LNG0) * Math.PI / 180 * R * COS0, -(lat - LAT0) * Math.PI / 180 * R]; // x=동, z=남
const toLatLng = (x, z) => ({ lat: LAT0 + (-z) / R * 180 / Math.PI, lng: LNG0 + x / (R * COS0) * 180 / Math.PI });

/* ───────── 브이월드 (실시간 호출, 저장하지 않음) ───────── */
function vworldBuildings() {
  return new Promise((resolve, reject) => {
    const cb = '__vw' + Date.now();
    const domain = location.protocol + '//' + location.hostname;
    const { lat, lng } = CFG.hall, h = CFG.half;
    const p = new URLSearchParams({
      service: 'data', request: 'GetFeature', data: 'LT_C_SPBD', key: CFG.vworldKey, domain,
      geomFilter: `BOX(${(lng - h.lng).toFixed(6)},${(lat - h.lat).toFixed(6)},${(lng + h.lng).toFixed(6)},${(lat + h.lat).toFixed(6)})`,
      size: '200', format: 'json', crs: 'EPSG:4326', callback: cb
    });
    const s = document.createElement('script');
    const t = setTimeout(() => { cleanup(); reject(new Error('응답 시간 초과')); }, 15000);
    window[cb] = d => { cleanup(); resolve(d); };
    s.onerror = () => { cleanup(); reject(new Error('스크립트 로드 실패')); };
    function cleanup() { clearTimeout(t); window[cb] = () => {}; s.remove(); }
    s.src = 'https://api.vworld.kr/req/data?' + p;
    dbg('vworld.domain', domain);
    document.head.appendChild(s);
  });
}

/* ───────── 기하 유틸 ───────── */
function ringArea(r) { let a = 0; for (let i = 0; i < r.length; i++) { const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length]; a += x1 * y2 - x2 * y1; } return a / 2; }
function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop(); return lo.concat(up);
}
function obb(pts) {
  const h = hull(pts); let best = null;
  for (let k = 0; k < h.length; k++) {
    const a = h[k], b = h[(k + 1) % h.length];
    const th = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(th), s = Math.sin(th);
    let mnU = 1e9, mxU = -1e9, mnV = 1e9, mxV = -1e9;
    for (const [x, z] of h) { const u = x * c + z * s, v = -x * s + z * c; mnU = Math.min(mnU, u); mxU = Math.max(mxU, u); mnV = Math.min(mnV, v); mxV = Math.max(mxV, v); }
    const area = (mxU - mnU) * (mxV - mnV);
    if (!best || area < best.area) best = { th, c, s, area, mnU, mxU, mnV, mxV };
  }
  return best;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ss = (a, b, t) => { const x = clamp((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };

// 법당 고르기: 설정 좌표에 가장 가까운 절 건물 → 위치·정면 방향·크기
function pickHall(feats) {
  let best = null;
  for (const f of feats) {
    const g = f.geometry, name = (f.properties.buld_nm || '').trim();
    for (const p of (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates])) {
      const ring = p[0].map(([x, y]) => toLocal(x, y));
      if (ring.length < 3) continue;
      const area = Math.abs(ringArea(ring));
      const o = obb(ring), cu = (o.mnU + o.mxU) / 2, cv = (o.mnV + o.mxV) / 2;
      const cx = cu * o.c - cv * o.s, cz = cu * o.s + cv * o.c;
      let score = Math.hypot(cx, cz) + (area < 60 ? 50 : 0) + (name.includes(CFG.temple.name) ? 0 : 25);
      if (!best || score < best.score) best = { score, o, cx, cz, area, name };
    }
  }
  if (!best || best.score > 45) return null;
  const { o } = best, Lu = o.mxU - o.mnU, Lv = o.mxV - o.mnV;
  // 정면 = 남쪽(+z)에 가까운 축
  let nx, nz, width, depth;
  if (Math.abs(o.c) >= Math.abs(o.s)) { nx = -o.s; nz = o.c; width = Lu; depth = Lv; } else { nx = o.c; nz = o.s; width = Lv; depth = Lu; }
  if (nz < 0) { nx = -nx; nz = -nz; }
  return { x: best.cx, z: best.cz, th: Math.atan2(nx, nz), width, depth, area: best.area };
}

/* ───────── 장면 ───────── */
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const SKY = new THREE.Color('#cfe7f5');
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 70, 320);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1200);
scene.add(new THREE.HemisphereLight(0xfffaf0, 0x8fae6a, 1.1));
const sun = new THREE.DirectionalLight(0xfff0d8, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 260 });
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);
const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, flatShading: true, ...extra });
const MAT = {
  grass: M('#a3c47c'), yard: M('#ecdfc3'), path: M('#d9d1c2'), stone: M('#c9c2b4'), stoneDark: M('#a9a295'), wallCap: M('#4f5b69'),
  red: M('#9b3b2b'), trunk: M('#7a5536'), leaf: M('#4f8a4b'), leaf2: M('#64a05a'), line: M('#6b4a2a'), fire: new THREE.MeshBasicMaterial({ color: '#ffd27a' }),
  lotus: ['#f6a5b8', '#ffd86a', '#f48c7a', '#a8e0a0', '#ffffff'].map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .3, roughness: .6, flatShading: true })),
};
const ground = new THREE.Mesh(new THREE.CircleGeometry(600, 64), MAT.grass);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

/* ───────── 법당 + 마당 (법당 기준 좌표: 앞 = +z) ───────── */
let HX = 0, HZ = 0, TH = 0, cosT = 1, sinT = 0, NX = 0, NZ = 1;
const L2W = (lx, lz) => [HX + lx * cosT + lz * sinT, HZ - lx * sinT + lz * cosT];
const W2L = (x, z) => { const dx = x - HX, dz = z - HZ; return [dx * cosT - dz * sinT, dx * sinT + dz * cosT]; };
const obstacles = []; // 월드 기준 회전 사각형 {cx,cz,c,s,hu,hv}
let hall = null, YARD = null, startL = [0, 20];
function addCollider(c) { const [cx, cz] = L2W(c.cx, c.cz); obstacles.push({ cx, cz, c: cosT, s: -sinT, hu: c.hx, hv: c.hz }); }

function buildSite(info) {
  const L = clamp(info.width * .92, 11, 18), D = clamp(info.depth * .92, 10, 14.5);
  HX = info.x; HZ = info.z; TH = info.th; cosT = Math.cos(TH); sinT = Math.sin(TH); NX = Math.sin(TH); NZ = Math.cos(TH);
  dbg('hall', `${CFG.hall.name} 정면 ${L.toFixed(1)}m × 측면 ${D.toFixed(1)}m · 방향 ${(TH * 180 / Math.PI).toFixed(0)}°`);
  hall = buildHall(THREE, { L, D, buddhas: CFG.hall.buddhas });
  const site = new THREE.Group(); site.position.set(HX, 0, HZ); site.rotation.y = TH; scene.add(site);
  site.add(hall.group);
  hall.colliders.forEach(addCollider);
  const loc = [];
  const add = (geo, mat, x, y, z, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; site.add(m); return m; };
  const box = (w, h, d, mat, x, y, z) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  const col = (cx, cz, hx, hz) => { const c = { cx, cz, hx, hz }; loc.push(c); addCollider(c); };

  // 마당과 박석길
  const YX = L / 2 + 6, YZ0 = -D / 2 - 2, YZ1 = D / 2 + 19;
  YARD = { x0: -YX, x1: YX, z0: YZ0, z1: YZ1 };
  const yard = add(new THREE.PlaneGeometry(2 * YX, YZ1 - YZ0), MAT.yard, 0, .02, (YZ0 + YZ1) / 2, false); yard.rotation.x = -Math.PI / 2;
  const path = add(new THREE.PlaneGeometry(2.8, YZ1 - D / 2 - 1.2), MAT.path, 0, .03, (D / 2 + 1.2 + YZ1) / 2, false); path.rotation.x = -Math.PI / 2;
  // 낮은 담장 + 앞쪽 문
  const WH = .95, wall = (w, d, x, z) => { box(w, WH, d, MAT.stone, x, WH / 2, z); box(w + .2, .18, d + .2, MAT.wallCap, x, WH + .09, z); col(x, z, w / 2 + .05, d / 2 + .05); };
  for (const sx of [-1, 1]) wall(.45, YZ1 - YZ0, sx * YX, (YZ0 + YZ1) / 2);
  wall(2 * YX + .45, .45, 0, YZ0);
  for (const sx of [-1, 1]) wall(YX - 1.6, .45, sx * (1.6 + (YX - 1.6) / 2), YZ1);
  for (const sx of [-1, 1]) { add(new THREE.CylinderGeometry(.16, .18, 3, 10), MAT.red, sx * 1.6, 1.5, YZ1); col(sx * 1.6, YZ1, .25, .25); }
  box(4.2, .3, 1.2, MAT.wallCap, 0, 3.1, YZ1); box(3.6, .25, .3, MAT.red, 0, 2.8, YZ1);
  // 석등 (법당 바로 앞)
  const SL = D / 2 + 4.4;
  add(new THREE.CylinderGeometry(.42, .5, .3, 8), MAT.stone, 0, .15, SL); add(new THREE.CylinderGeometry(.12, .14, .95, 8), MAT.stone, 0, .78, SL);
  box(.62, .14, .62, MAT.stone, 0, 1.3, SL); box(.46, .5, .46, MAT.stone, 0, 1.62, SL); box(.3, .26, .48, MAT.fire, 0, 1.62, SL);
  add(new THREE.ConeGeometry(.52, .38, 8), MAT.stoneDark, 0, 2.06, SL); add(new THREE.SphereGeometry(.1, 10, 8), MAT.stoneDark, 0, 2.3, SL);
  col(0, SL, .55, .55);
  // 삼층 석탑
  const PZ = D / 2 + 10.5;
  box(2.4, .45, 2.4, MAT.stone, 0, .225, PZ); box(1.9, .4, 1.9, MAT.stone, 0, .65, PZ);
  let y = .85;
  for (let i = 0; i < 3; i++) { const w = 1.15 - i * .2, h = .8 - i * .14; box(w, h, w, MAT.stone, 0, y + h / 2, PZ); y += h; box(w + .85, .17, w + .85, MAT.stoneDark, 0, y + .085, PZ); y += .17; box(w * .7, .12, w * .7, MAT.stone, 0, y + .06, PZ); y += .12; }
  add(new THREE.CylinderGeometry(.05, .07, .9, 8), MAT.stoneDark, 0, y + .45, PZ);
  for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(.1 - i * .015, 10, 8), MAT.stoneDark, 0, y + .25 + i * .25, PZ);
  col(0, PZ, 1.25, 1.25);
  // 마당 위를 가로지르는 연등 줄
  const lanGeo = new THREE.IcosahedronGeometry(.21, 1), tasGeo = new THREE.CylinderGeometry(.02, .04, .22, 6);
  let k = 0;
  for (const z of [D / 2 + 7.2, D / 2 + 13.5, D / 2 + 17]) {
    const x0 = -YX + .6, x1 = YX - .6;
    for (const x of [x0, x1]) { add(new THREE.CylinderGeometry(.05, .06, 3.4, 6), MAT.line, x, 1.7, z); col(x, z, .12, .12); }
    const wire = add(new THREE.CylinderGeometry(.01, .01, x1 - x0, 4), MAT.line, 0, 3.25, z, false); wire.rotation.z = Math.PI / 2;
    for (let x = x0 + .9; x < x1 - .5; x += .95) {
      const l = add(lanGeo, MAT.lotus[k++ % MAT.lotus.length], x, 2.95, z, false); l.scale.y = .85;
      add(tasGeo, MAT.lotus[(k + 2) % MAT.lotus.length], x, 2.67, z, false);
    }
  }
  startL = [0, YZ1 - 3];
  return { L, D };
}
// 브이월드 실패 시: 설정 좌표에 남향 법당
function defaultHall() { return { x: 0, z: 0, th: 0, width: 15, depth: 13, area: 0 }; }

/* 법당 담장 바깥 숲 */
function plantTrees() {
  const N = 420, trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.18, .26, 1, 6), MAT.trunk, N);
  const leafA = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), MAT.leaf, N);
  const leafB = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), MAT.leaf2, N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const [cx, cz] = L2W(0, (YARD.z0 + YARD.z1) / 2), r0 = Math.hypot(YARD.x1, (YARD.z1 - YARD.z0) / 2);
  let n = 0, tries = 0;
  while (n < N && tries < 8000) {
    tries++;
    const a = Math.random() * Math.PI * 2, r = r0 * .7 + Math.pow(Math.random(), 1.6) * 160;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, [lx, lz] = W2L(x, z);
    if (lx > YARD.x0 - 2.5 && lx < YARD.x1 + 2.5 && lz > YARD.z0 - 2.5 && lz < YARD.z1 + 2.5) continue;
    if (Math.abs(lx) < 3 && lz > YARD.z1 && lz < YARD.z1 + 14) continue; // 문 앞 진입로
    const s = .8 + Math.random() * .9, h = 6 * s;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6);
    trunks.setMatrixAt(n, m.compose(v.set(x, h * .2, z), q, sc.set(s, h * .4, s)));
    leafA.setMatrixAt(n, m.compose(v.set(x, h * .55, z), q, sc.set(2.3 * s, h * .55, 2.3 * s)));
    leafB.setMatrixAt(n, m.compose(v.set(x, h * .85, z), q, sc.set(1.6 * s, h * .45, 1.6 * s)));
    n++;
  }
  [trunks, leafA, leafB].forEach(im => { im.count = n; im.castShadow = true; scene.add(im); });
}

/* ───────── 충돌 · 경계 ───────── */
function pushOut(p, r) {
  for (const ob of obstacles) {
    const dx = p.x - ob.cx, dz = p.z - ob.cz;
    let du = dx * ob.c + dz * ob.s, dv = -dx * ob.s + dz * ob.c;
    const pu = ob.hu + r - Math.abs(du), pv = ob.hv + r - Math.abs(dv);
    if (pu > 0 && pv > 0) {
      if (pu < pv) du += Math.sign(du || 1) * pu; else dv += Math.sign(dv || 1) * pv;
      p.x = ob.cx + du * ob.c - dv * ob.s; p.z = ob.cz + du * ob.s + dv * ob.c;
    }
  }
}
function clampBound(p) {
  if (!YARD) return;
  const [lx, lz] = W2L(p.x, p.z);
  const cx = clamp(lx, YARD.x0 + .5, YARD.x1 - .5), cz = clamp(lz, YARD.z0 + .5, YARD.z1 + 1.5);
  if (cx !== lx || cz !== lz) { const [x, z] = L2W(cx, cz); p.x = x; p.z = z; }
}

/* ───────── 아바타 (아기 스님) ───────── */
const { avatar, body, headG, torso, kasa, legs, eyeGroups, closedEyes, faceOpen, placeArms, faceFill } = createBabyMonk();
scene.add(avatar, faceFill, faceFill.target);
let blinkT = 2.5, idleT = 0;

/* ───────── 입력 ───────── */
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'KeyE') tryBow(); });
addEventListener('keyup', e => { keys[e.code] = false; });
let yaw = Math.PI, pitch = 0.24, dist = 6;
const drag = { id: null, x: 0, y: 0 };
canvas.addEventListener('pointerdown', e => { if (drag.id !== null) return; drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => { if (e.pointerId !== drag.id) return; yaw -= (e.clientX - drag.x) * 0.006; pitch = clamp(pitch + (e.clientY - drag.y) * 0.004, 0.05, 1.2); drag.x = e.clientX; drag.y = e.clientY; });
const endDrag = e => { if (e.pointerId === drag.id) drag.id = null; };
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', e => { dist = clamp(dist + e.deltaY * 0.01, 3, 22); e.preventDefault(); }, { passive: false });
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
const joyEl = document.getElementById('joy'), knob = document.getElementById('knob');
const joy = { id: null, x: 0, y: 0 };
joyEl.addEventListener('pointerdown', e => { joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); moveJoy(e); });
joyEl.addEventListener('pointermove', e => { if (e.pointerId === joy.id) moveJoy(e); });
const endJoy = e => { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; } };
joyEl.addEventListener('pointerup', endJoy); joyEl.addEventListener('pointercancel', endJoy);
function moveJoy(e) {
  const r = joyEl.getBoundingClientRect(); let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
  const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
  joy.x = dx; joy.y = dy; knob.style.transform = `translate(${dx * 34}px,${dy * 34}px)`;
}

/* ───────── 합장 · 절 · 삼배 ───────── */
let pose = null, poseT = 0, sam = null, bowCount = 0, intro = 0;
const faceHall = () => Math.atan2(-NX, -NZ), behind = () => Math.atan2(NX, NZ);
const bowPromptEl = document.getElementById('bowPrompt');
let actx = null;
function bell(vol = .3) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime;
    [[196, 1], [392, .45], [588, .18], [784, .08]].forEach(([f, a]) => {
      const o = actx.createOscillator(), gn = actx.createGain(); o.type = 'sine'; o.frequency.value = f;
      gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(vol * a, t + .015); gn.gain.exponentialRampToValueAtTime(.0001, t + 3.2);
      o.connect(gn).connect(actx.destination); o.start(t); o.stop(t + 3.3);
    });
  } catch (e) { }
}
function nearBowSpot(maxD) {
  if (!hall) return false;
  const [lx, lz] = W2L(avatar.position.x, avatar.position.z);
  return hall.isInside(lx, lz) && Math.hypot(lx - hall.bowSpot.lx, lz - hall.bowSpot.lz) < maxD;
}
function startSambae() {
  const [x, z] = L2W(hall.bowSpot.lx, hall.bowSpot.lz);
  avatar.position.set(x, hall.FY, z); avatar.rotation.y = faceHall();
  yaw = behind(); dist = 3.6; pitch = .3; intro = -1; pose = null;
  sam = { t: 0, rung: -1 };
  toast('🙇 부처님께 삼배를 올려요');
}
function tryBow() {
  if (sam) return;
  if (nearBowSpot(2.6)) startSambae();
  else { pose = 'bow'; poseT = 0; toast('🙇 공손히 절을 올렸어요'); }
}
document.getElementById('btnHapjang').onclick = () => { if (sam) return; pose = 'hap'; poseT = 0; toast('🙏 마음을 모아 합장했어요'); };
document.getElementById('btnBow').onclick = tryBow;
bowPromptEl.onclick = () => { if (!sam) startSambae(); };
document.getElementById('btnHall').onclick = () => {
  if (!hall) return; sam = null; resetBody();
  const [x, z] = L2W(0, hall.interior.iz1 - .5);
  avatar.position.set(x, hall.FY, z); avatar.rotation.y = faceHall(); yaw = behind(); dist = 3.6; pitch = .28; intro = -1;
  toast(`🛕 ${CFG.hall.name} 안으로 들어왔어요`);
};
document.getElementById('btnHome').onclick = () => { sam = null; resetBody(); placeAtStart(); intro = -1; };
function resetBody() { body.position.y = 0; body.rotation.x = 0; headG.rotation.x = 0; }
function placeAtStart() { const [x, z] = L2W(...startL); avatar.position.set(x, 0, z); avatar.rotation.y = faceHall(); yaw = behind(); dist = 6; pitch = .24; }

/* ───────── 네이버 거리뷰 ───────── */
const modal = document.getElementById('modal'), panoMsg = document.getElementById('panoMsg');
let naverP = null, pano = null, triedEntrance = false;
function showPanoMsg(t) { panoMsg.innerHTML = t; panoMsg.style.display = t ? 'block' : 'none'; }
function loadNaver() {
  if (window.naver?.maps?.Panorama) return Promise.resolve();
  if (naverP) return naverP;
  naverP = new Promise((res, rej) => {
    window.navermap_authFailure = () => { dbg('naver', '인증 실패 — 콘솔 Web 서비스 URL에 ' + location.origin + ' 등록 필요'); rej(new Error('auth')); };
    const s = document.createElement('script');
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${CFG.naverKeyId}&submodules=panorama`;
    s.onerror = () => { dbg('naver', '스크립트 로드 실패'); rej(new Error('script')); };
    s.onload = () => { const t0 = Date.now(); (function wait() { if (window.naver?.maps?.Panorama) { dbg('naver', 'OK'); res(); } else if (Date.now() - t0 > 12000) { dbg('naver', '파노라마 모듈 대기 시간 초과'); rej(new Error('timeout')); } else setTimeout(wait, 120); })(); };
    document.head.appendChild(s);
  });
  naverP.catch(() => { naverP = null; });
  return naverP;
}
function sizePano() {
  const wr = document.getElementById('panoWrap').getBoundingClientRect(), pe = document.getElementById('pano');
  pe.style.width = wr.width + 'px'; pe.style.height = wr.height + 'px';
  if (pano && pano.setSize && window.naver) pano.setSize(new naver.maps.Size(wr.width, wr.height));
}
addEventListener('resize', () => { if (modal.classList.contains('show')) sizePano(); });
function heading() { const fx = Math.sin(avatar.rotation.y), fz = Math.cos(avatar.rotation.y); return (Math.atan2(fx, -fz) * 180 / Math.PI + 360) % 360; }
async function openPano() {
  modal.classList.add('show'); sizePano(); showPanoMsg('네이버 거리뷰를 불러오는 중…');
  try { await loadNaver(); } catch (e) { showPanoMsg('네이버 지도 인증에 실패했어요.<br><small>' + (DBG.naver || e.message) + '</small>'); return; }
  const here = toLatLng(avatar.position.x, avatar.position.z);
  dbg('pano.request', `${here.lat.toFixed(6)}, ${here.lng.toFixed(6)}`);
  const pos = new naver.maps.LatLng(here.lat, here.lng);
  triedEntrance = false;
  if (!pano) {
    pano = new naver.maps.Panorama('pano', { position: pos, pov: { pan: heading(), tilt: 0, fov: 100 }, aroundControl: true, flightSpot: false });
    naver.maps.Event.addListener(pano, 'pano_status', st => {
      const s = typeof st === 'string' ? st : (st && st.status) || String(st);
      dbg('pano.status', s);
      if (s === 'OK') { showPanoMsg(''); const loc = pano.getLocation && pano.getLocation(); if (loc) dbg('pano.photo', `${loc.title || ''} ${loc.photodate || ''}`.trim()); }
      else if (!triedEntrance) { triedEntrance = true; const [x, z] = L2W(0, (hall ? hall.D / 2 : 7) + 75), e = toLatLng(x, z); showPanoMsg('이 자리엔 거리뷰 사진이 없어서<br>절 입구 쪽 길에서 보여드릴게요'); pano.setPosition(new naver.maps.LatLng(e.lat, e.lng)); }
      else showPanoMsg('이 근처는 아직 거리뷰 사진이 없어요');
    });
  } else {
    pano.setPosition(pos); pano.setPov({ pan: heading(), tilt: 0, fov: 100 });
  }
  sizePano();
}
document.getElementById('btnPano').onclick = openPano;
document.getElementById('btnClose').onclick = () => modal.classList.remove('show');

/* ───────── 미니맵 (법당 기준으로 위가 법당) ───────── */
const mm = document.getElementById('minimap'), mctx = mm.getContext('2d');
function drawMinimap() {
  if (!YARD) return;
  const W = mm.width, H = mm.height, pad = 3;
  const sx0 = YARD.x0 - pad, sx1 = YARD.x1 + pad, sz0 = YARD.z0 - pad, sz1 = YARD.z1 + pad;
  const s = Math.min(W / (sx1 - sx0), H / (sz1 - sz0)), ox = (W - (sx1 - sx0) * s) / 2, oz = (H - (sz1 - sz0) * s) / 2;
  const P = (lx, lz) => [ox + (lx - sx0) * s, oz + (lz - sz0) * s];
  const rect = (x0, z0, x1, z1, c) => { const [a, b] = P(x0, z0), [cc, d] = P(x1, z1); mctx.fillStyle = c; mctx.fillRect(a, b, cc - a, d - b); };
  mctx.clearRect(0, 0, W, H);
  mctx.fillStyle = '#e6efd5'; if (mctx.roundRect) { mctx.beginPath(); mctx.roundRect(0, 0, W, H, 26); mctx.fill(); } else mctx.fillRect(0, 0, W, H);
  rect(YARD.x0, YARD.z0, YARD.x1, YARD.z1, '#efe2c4');
  rect(-1.4, hall.D / 2 + 1.2, 1.4, YARD.z1, '#dcd3c3');
  rect(-hall.L / 2, -hall.D / 2, hall.L / 2, hall.D / 2, '#8a4b36');
  const [bx, bz] = P(hall.bowSpot.lx, hall.bowSpot.lz); mctx.fillStyle = '#ffd36a'; mctx.beginPath(); mctx.arc(bx, bz, 5, 0, 7); mctx.fill();
  rect(-1.2, hall.D / 2 + 9.3, 1.2, hall.D / 2 + 11.7, '#a9a295');
  const [lx, lz] = W2L(avatar.position.x, avatar.position.z), [ax, az] = P(lx, lz);
  mctx.save(); mctx.translate(ax, az); mctx.rotate(-(avatar.rotation.y - TH) + Math.PI); mctx.fillStyle = '#d0382b'; mctx.beginPath(); mctx.moveTo(0, -9); mctx.lineTo(6, 6); mctx.lineTo(-6, 6); mctx.closePath(); mctx.fill(); mctx.restore();
}

/* ───────── 안내 ───────── */
const nearEl = document.getElementById('near');
function updateNear() {
  if (!hall) return;
  const [lx, lz] = W2L(avatar.position.x, avatar.position.z);
  const inside = hall.isInside(lx, lz), dBow = Math.hypot(lx - hall.bowSpot.lx, lz - hall.bowSpot.lz);
  bowPromptEl.style.display = inside && !sam && dBow < 2.2 ? 'block' : 'none';
  let html = '';
  if (inside) html = `<b>${CFG.temple.name} ${CFG.hall.name} 안</b><span>가운데 빛나는 방석에서 삼배를 올릴 수 있어요${bowCount ? ` · 오늘 ${bowCount}번 올렸어요` : ''}</span>`;
  else if (Math.abs(lx) < hall.L / 2 + 3 && lz > -hall.D / 2 && lz < hall.D / 2 + 8) html = `<b>${CFG.temple.name} ${CFG.hall.name}</b><span>가운데 계단으로 올라가 안으로 들어가 보세요</span>`;
  nearEl.style.display = html ? 'block' : 'none'; if (html && nearEl.innerHTML !== html) nearEl.innerHTML = html;
}

/* ───────── 루프 ───────── */
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const clock = new THREE.Clock(); let walkT = 0, walkAmp = 0, frames = 0, fpsT = 0, mmT = 0, glowT = 0;
const stopIntro = () => { intro = -1; };
canvas.addEventListener('pointerdown', stopIntro); addEventListener('keydown', stopIntro); joyEl.addEventListener('pointerdown', stopIntro);
const camGoal = new THREE.Vector3();
function loop() { requestAnimationFrame(loop); try { step(); } catch (e) { if (!DBG.loopError) dbg('loopError', e.message); } }
function step() {
  const dt = Math.min(clock.getDelta(), 0.05);
  // 이동
  let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  let iz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + joy.y;
  const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
  if (sam && il > .5) { sam = null; resetBody(); toast('삼배를 멈췄어요'); }
  const speed = (keys.ShiftLeft || keys.ShiftRight || il > 0.95 && joy.id !== null ? 7 : 3.6);
  if (!sam && il > 0.05 && pose !== 'bow') {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const mx = ix * c + iz * s, mz = -ix * s + iz * c;
    avatar.position.x += mx * speed * dt; avatar.position.z += mz * speed * dt;
    pushOut(avatar.position, 0.42); clampBound(avatar.position);
    let d = Math.atan2(mx, mz) - avatar.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); avatar.rotation.y += d * Math.min(1, dt * 10);
    walkT += dt * speed * 2; body.position.y = Math.abs(Math.sin(walkT)) * 0.06; body.rotation.z = Math.sin(walkT) * 0.05;
    walkAmp = Math.min(1, walkAmp + dt * 6);
  } else if (!sam) { body.position.y *= 0.85; body.rotation.z *= 0.85; walkAmp = Math.max(0, walkAmp - dt * 6); }
  else walkAmp = 0;
  // 바닥 높이 (기단·계단·마루)
  if (hall) { const [lx, lz] = W2L(avatar.position.x, avatar.position.z); avatar.position.y += (hall.heightAt(lx, lz) - avatar.position.y) * Math.min(1, dt * 14); }
  const swing = Math.sin(walkT) * walkAmp;
  legs.forEach((g, i) => { g.position.z = (i ? 1 : -1) * swing * .1; g.position.y = Math.max(0, -Math.cos(walkT + (i ? Math.PI : 0))) * .035 * walkAmp; });
  idleT += dt; headG.rotation.z = Math.sin(walkT * .5) * .05 * walkAmp + Math.sin(idleT * 1.3) * .03 * (1 - walkAmp);
  torso.scale.y = kasa.scale.y = 1 + Math.sin(idleT * 2.2) * .012 * (1 - walkAmp);
  // 자세: 합장 · 절 · 삼배
  let hap = 0;
  if (sam) {
    sam.t += dt; const per = 2.7, n = Math.floor(sam.t / per), t = sam.t - n * per;
    if (n >= 3) {
      sam = null; resetBody(); bowCount++; bell(.32); pose = 'hap'; poseT = 1.75; // 합장을 천천히 풀며 마무리
      toast('🙏 삼배를 올렸어요. 마음이 한결 편안해지길 바라요', 3600);
    } else {
      hap = t < 1 ? (n > 0 ? 1 : ss(0, .4, t)) : t < 1.9 ? 1 - .75 * ss(1, 1.4, t) : .25 + .75 * ss(1.9, 2.5, t);
      const kneel = ss(.45, .95, t) * (1 - ss(2, 2.5, t)), bend = ss(1, 1.45, t) * (1 - ss(1.85, 2.3, t));
      body.position.y = -kneel * .2; body.rotation.x = bend * 1.0; headG.rotation.x = bend * .3;
      if (t > 1.2 && sam.rung !== n) { sam.rung = n; bell(.18); toast(`🙇 ${n + 1}배`, 1200); }
    }
  } else if (pose) {
    poseT += dt; const dur = pose === 'hap' ? 2.2 : 2.0;
    hap = clamp(Math.min(poseT / .35, (dur - poseT) / .45), 0, 1);
    if (pose === 'bow') { body.rotation.x = clamp(Math.min((poseT - .3) / .4, (dur - poseT) / .5), 0, 1) * 0.8; headG.rotation.x = body.rotation.x * .3; }
    if (poseT > dur) { pose = null; resetBody(); }
  }
  placeArms(hap, hap ? 0 : swing);
  const closed = hap > .5;
  eyeGroups.forEach(g => { g.visible = !closed; }); closedEyes.forEach(c => { c.visible = closed; }); faceOpen.forEach(m => { m.visible = !closed; });
  blinkT -= dt; const bs = blinkT < 0.12 ? 0.12 : 1; eyeGroups.forEach(g => { g.scale.y = bs; }); if (blinkT < 0) blinkT = 2 + Math.random() * 3;
  // 처음: 얼굴을 보여 준 뒤 등 뒤로 돌아가는 카메라
  if (intro >= 0) { intro += dt; const t = clamp((intro - 1.4) / 2.4, 0, 1), s = t * t * (3 - 2 * t); yaw = behind() + Math.PI * (1 - s); dist = 4.2 + 1.8 * s; pitch = .16 + .08 * s; if (t >= 1) intro = -1; }
  // 카메라: 법당 안에서는 가깝게, 벽·천장 밖으로 나가지 않게
  let effD = dist, effP = pitch, inside = false, lxA = 0, lzA = 0;
  if (hall) { [lxA, lzA] = W2L(avatar.position.x, avatar.position.z); inside = hall.isInside(lxA, lzA); if (inside) { effD = Math.min(dist, 3.6); effP = Math.min(pitch, .3); } }
  camGoal.set(avatar.position.x + Math.sin(yaw) * Math.cos(effP) * effD, avatar.position.y + 1.2 + Math.sin(effP) * effD, avatar.position.z + Math.cos(yaw) * Math.cos(effP) * effD);
  if (hall && (inside || hall.underRoof(lxA, lzA))) {
    let [cl, cz] = W2L(camGoal.x, camGoal.z); const I = hall.interior;
    if (inside) { cl = clamp(cl, I.ix0 + .3, I.ix1 - .3); cz = Math.max(cz, I.iz0 + .3); }
    if (hall.underRoof(cl, cz)) camGoal.y = Math.min(camGoal.y, hall.ceilY - .7);
    const [x, z] = L2W(cl, cz); camGoal.x = x; camGoal.z = z;
  }
  camera.position.lerp(camGoal, Math.min(1, dt * 8));
  camera.lookAt(avatar.position.x, avatar.position.y + 1.05, avatar.position.z);
  faceFill.position.set(camera.position.x, camera.position.y + 1.2, camera.position.z); faceFill.target.position.set(avatar.position.x, avatar.position.y + 1, avatar.position.z);
  sun.position.set(avatar.position.x + 50, 100, avatar.position.z + 35); sun.target.position.copy(avatar.position);
  if (hall) { glowT += dt; hall.glow.visible = !sam; hall.glow.material.opacity = .35 + .25 * Math.sin(glowT * 3); }
  renderer.render(scene, camera);
  mmT += dt; if (mmT > 0.1) { mmT = 0; drawMinimap(); updateNear(); }
  frames++; fpsT += dt; if (fpsT > 1) { const ll = toLatLng(avatar.position.x, avatar.position.z); DBG.fps = frames; DBG.here = `${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}`; if (dbgEl.classList.contains('show')) renderDbg(); frames = 0; fpsT = 0; }
}

/* ───────── 시작 ───────── */
(async function start() {
  const badge = document.getElementById('badge');
  let info = null;
  try {
    const d = await vworldBuildings();
    const r = d && d.response;
    dbg('vworld.status', r && r.status);
    if (!r || r.status !== 'OK') { const e = r && r.error; throw new Error(e ? `${e.code} ${e.text}` : '응답 형식 오류'); }
    const feats = r.result.featureCollection.features;
    dbg('vworld.total', feats.length);
    info = pickHall(feats);
    if (!info) throw new Error('법당 건물을 찾지 못함');
    badge.textContent = `실제 ${CFG.hall.name} 위치·크기 반영`;
  } catch (e) {
    dbg('vworld.error', e.message);
    badge.textContent = '브이월드 연결 실패 · 기본 법당으로 보여드려요'; badge.classList.add('err');
    info = defaultHall();
  }
  buildSite(info);
  try { plantTrees(); } catch (e) { dbg('treeError', e.message); }
  placeAtStart();
  const [cx, cz] = L2W(startL[0], startL[1] - 5);
  camera.position.set(cx, 2.4, cz);
  document.getElementById('loading').classList.add('hide');
  canvas.focus();
  loop();
})();
