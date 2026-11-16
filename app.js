// 온라인 사찰 참배 체험판 — 권역(서울·경남 등)마다 한 장면에 큰 사찰들을 축소해 모아 두고, 사찰마다 법당 하나를 실제 크기로 재현 (위레브)
import * as THREE from 'three';
import { createBabyMonk } from './avatar.js?v=4';
import { loadMonkGLB } from './monk-glb.js?v=2';
import { buildHall } from './hall.js?v=4';
import { loadStatue } from './statue.js?v=1';
import { REGIONS } from './temples.js?v=2';
import { createStore, createSound, initTodo, initRituals, initSoundPanel } from './features.js?v=1';

/* ───────── 설정 ───────── */
// hall: 법당(주불전) 실제 좌표. 브이월드 건물 중 이 좌표에 가장 가까운 건물을 법당으로 씀
const QS = new URLSearchParams(location.search);
const REGION = REGIONS.find(r => r.id === QS.get('r')) || REGIONS[0]; // 권역 = 한 장면(나중엔 한 방/서버)
const CFG = {
  vworldKey: '8047AF94-B2B2-49BC-9C11-746A988127D4',
  naverKeyId: '0fdr2ec8dd',
  temple: { name: REGION.temples[0].name }, // 지금 가까이 있는 사찰 (돌아다니면 바뀜)
  hall: { name: REGION.temples[0].hall, lat: REGION.temples[0].lat, lng: REGION.temples[0].lng, buddhas: REGION.temples[0].buddhas },
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
/* 기록(이 기기) · 소리 · 오늘 할 일 */
const store = createStore(), sound = createSound(store);
addEventListener('pointerdown', () => sound.unlock(), { once: true }); addEventListener('keydown', () => sound.unlock(), { once: true });
const done = initTodo(store, toast, sound);
initSoundPanel(sound);

/* ───────── 좌표 (원점 = 법당 좌표) ───────── */
const R = 6378137;
const mkRef = (lat, lng) => ({ lat, lng, cos: Math.cos(lat * Math.PI / 180) });
const toLocalAt = (ref, lng, lat) => [(lng - ref.lng) * Math.PI / 180 * R * ref.cos, -(lat - ref.lat) * Math.PI / 180 * R]; // x=동, z=남
// 장면 속 위치 → 실제 위경도: 지금 사찰의 법당 기준 좌표를 실제 법당 방향으로 되돌려 계산
function toLatLng(x, z) {
  const T = cur; if (!T) return { lat: CFG.hall.lat, lng: CFG.hall.lng };
  const [lx, lz] = W2L(x, z), c = Math.cos(T.info.th), sn = Math.sin(T.info.th);
  const rx = T.info.x + lx * c + lz * sn, rz = T.info.z - lx * sn + lz * c;
  return { lat: T.ref.lat + (-rz) / R * 180 / Math.PI, lng: T.ref.lng + rx / (R * T.ref.cos) * 180 / Math.PI };
}

/* ───────── 브이월드 (실시간 호출, 저장하지 않음) ───────── */
function vworldJSONP(path, params, ms = 15000) {
  return new Promise((resolve, reject) => {
    const cb = '__vw' + Math.random().toString(36).slice(2);
    const p = new URLSearchParams({ ...params, key: CFG.vworldKey, domain: location.protocol + '//' + location.hostname, callback: cb });
    const s = document.createElement('script');
    const t = setTimeout(() => { cleanup(); reject(new Error('응답 시간 초과')); }, ms);
    window[cb] = d => { cleanup(); resolve(d); };
    s.onerror = () => { cleanup(); reject(new Error('스크립트 로드 실패')); };
    function cleanup() { clearTimeout(t); window[cb] = () => {}; s.remove(); }
    s.src = 'https://api.vworld.kr/req/' + path + '?' + p;
    document.head.appendChild(s);
  });
}
// 사찰 법당의 정확한 위치: 브이월드 장소 검색(예: '통도사 대웅전'), 같은 이름의 다른 절은 대략 위치로 거름
async function findHallPoint(t) {
  const norm = v => (v || '').replace(/\s/g, '');
  const near = it => it.point && !/정류장|주차장|입구|화장실/.test(it.title || '') && Math.hypot((+it.point.y - t.lat) * 111, (+it.point.x - t.lng) * 111 * Math.cos(t.lat * Math.PI / 180)) < 12;
  for (const q of [`${t.name} ${t.hall}`, t.q || `${t.where.split(' ')[0]} ${t.name}`, t.name]) {
    try {
      const d = await vworldJSONP('search', { service: 'search', request: 'search', version: '2.0', crs: 'EPSG:4326', size: '10', page: '1', query: q, type: 'place', format: 'json', errorformat: 'json' }, 9000);
      const items = (d.response && d.response.result && d.response.result.items) || [];
      const hit = items.find(it => near(it) && norm(it.title).startsWith(norm(t.name + t.hall))) || items.find(it => near(it) && norm(it.title).startsWith(norm(t.name)));
      if (hit) return { lat: +hit.point.y, lng: +hit.point.x, via: hit.title };
    } catch (e) { }
  }
  return { lat: t.lat, lng: t.lng, via: '대략 위치' };
}
function vworldBuildings(ref) {
  return new Promise((resolve, reject) => {
    const cb = '__vw' + Math.random().toString(36).slice(2);
    const domain = location.protocol + '//' + location.hostname;
    const { lat, lng } = ref, h = CFG.half;
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
function pickHall(feats, ref, templeName) {
  let best = null;
  for (const f of feats) {
    const g = f.geometry, name = (f.properties.buld_nm || '').trim();
    for (const p of (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates])) {
      const ring = p[0].map(([x, y]) => toLocalAt(ref, x, y));
      if (ring.length < 3) continue;
      const area = Math.abs(ringArea(ring));
      const o = obb(ring), cu = (o.mnU + o.mxU) / 2, cv = (o.mnV + o.mxV) / 2;
      const cx = cu * o.c - cv * o.s, cz = cu * o.s + cv * o.c;
      let score = Math.hypot(cx, cz) + (area < 60 ? 50 : 0) + (name.includes(templeName) ? 0 : 25);
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
// 권역 안 사찰들: 사찰마다 자기 좌표틀(법당 기준)이 있고, 아바타와 가장 가까운 사찰의 틀을 '지금 사찰'로 씀
const temples = []; let cur = null, sharedLights = null, RG = 30, RB = 90;
function setFrame(T) { HX = T.hx; HZ = T.hz; TH = T.th; cosT = Math.cos(TH); sinT = Math.sin(TH); NX = Math.sin(TH); NZ = Math.cos(TH); }
function useTemple(T) {
  cur = T; setFrame(T); hall = T.hall; YARD = T.YARD; startL = T.startL;
  CFG.temple = { name: T.name }; CFG.hall = { name: T.hallName, lat: T.ref.lat, lng: T.ref.lng, buddhas: T.buddhas };
  if (sharedLights && hall) sharedLights.forEach((l, k) => { hall.group.add(l); l.position.copy(T.lightPos[k]); });
  const h1 = document.querySelector('#title h1'), p = document.querySelector('#title p');
  if (h1) h1.innerHTML = `${T.name} ${T.hallName} <small>${REGION.name} · ${T.where}</small>`;
  if (p) p.textContent = T.note ? T.note : `${REGION.name}의 큰 사찰 ${temples.length}곳을 걸어서 돌아볼 수 있어요`;
  document.title = `${T.name} ${T.hallName} · ${REGION.name} 온라인 참배`;
}

function siteSize(info) { return { L: clamp(info.width * .92, 11, 18), D: clamp(info.depth * .92, 10, 14.5) }; }
function buildSite(info, T) {
  const { L, D } = siteSize(info);
  setFrame(T);
  dbg('hall.' + T.name, `${T.hallName} 정면 ${L.toFixed(1)}m × 측면 ${D.toFixed(1)}m · 실제 방향 ${(info.th * 180 / Math.PI).toFixed(0)}° · ${T.via}`);
  hall = buildHall(THREE, { L, D, buddhas: T.buddhas });
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
  { const [px, pz] = L2W(0, PZ); T.pagoda = { x: px, z: pz }; }
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
  // 일주문 현판 (안팎 양쪽)
  for (const side of [1, -1]) {
    const bd = add(new THREE.PlaneGeometry(2.3, .62), new THREE.MeshStandardMaterial({ map: nameTex(T.name, '#3a2418', '#f2cf72', 46), roughness: .7 }), 0, 2.35, YZ1 + side * .2, false);
    if (side < 0) bd.rotation.y = Math.PI;
  }
  startL = [0, YZ1 - 3];
  T.hall = hall; T.YARD = YARD; T.startL = startL; T.L = L; T.D = D;
  const [ycx, ycz] = L2W(0, (YZ0 + YZ1) / 2); T.cx = ycx; T.cz = ycz;
  return { L, D };
}
// 글자판 텍스처 (현판·표지석)
function nameTex(text, bg, fg, px = 44, sub = '') {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = sub ? 256 : 138; const c = cv.getContext('2d');
  c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height);
  c.strokeStyle = fg; c.lineWidth = 6; c.strokeRect(10, 10, cv.width - 20, cv.height - 20);
  c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `bold ${px * 2}px "Noto Serif KR","Nanum Myeongjo",serif`; c.fillText(text, cv.width / 2, sub ? 100 : cv.height / 2 + 4);
  if (sub) { c.font = `600 ${px}px "Noto Sans KR",sans-serif`; c.fillText(sub, cv.width / 2, 190); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// 브이월드 실패 시: 설정 좌표에 남향 법당
function defaultHall() { return { x: 0, z: 0, th: 0, width: 15, depth: 13, area: 0 }; }

/* ───────── 권역 배치 ───────── */
// 실제 거리는 수십~수백 km라 그대로 못 걸으니, 가운데 순례 마당(원점) 둘레에 일주문이 마당을 향하게 모음
// 방향은 실제 지리(권역 중심에서 본 방위) 순서를 따르고, 가장 큰 사찰(목록 첫 번째)이 처음 바라보는 정면(북쪽)에 오게 함
function layoutRegion(list) {
  const n = list.length, c = list.reduce((a, t) => [a[0] + t.lat / n, a[1] + t.lng / n], [0, 0]);
  const bearing = t => Math.atan2((t.lng - c[1]) * Math.cos(c[0] * Math.PI / 180), -(t.lat - c[0])); // 원점에서 본 방향 (x=동, z=남)
  const order = list.map((t, i) => ({ t, i, b: n > 1 ? bearing(t) : 0 })).sort((p, q) => p.b - q.b);
  const k0 = order.findIndex(o => o.i === 0), step = Math.PI * 2 / Math.max(1, n);
  const maxHalf = Math.max(...list.map(t => siteSize(t.info).L / 2 + 6));
  RG = n <= 1 ? 16 : Math.max(18, (maxHalf + 3) / Math.sin(Math.min(Math.PI / 2, step / 2))); // 일주문까지 거리 (이웃 담장이 안 겹치게)
  order.forEach((o, j) => {
    const ang = Math.PI + (j - k0) * step; // 0번(가장 큰 사찰)은 북쪽(-z)
    const ux = Math.sin(ang), uz = Math.cos(ang), T = o.t, { D } = siteSize(T.info), YZ1 = D / 2 + 19;
    T.ux = ux; T.uz = uz; T.hx = ux * (RG + YZ1); T.hz = uz * (RG + YZ1); T.th = Math.atan2(-ux, -uz);
  });
  RB = RG + Math.max(...list.map(t => siteSize(t.info).D + 21)) + 30;
}
// 가운데 순례 마당 · 일주문까지 박석길 · 길 입구 표지석 · 연등
function buildCommons() {
  const g = new THREE.Group(); scene.add(g);
  const add = (geo, mat, x, y, z, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; g.add(m); return m; };
  const plaza = add(new THREE.CircleGeometry(8, 40), MAT.yard, 0, .021, 0, false); plaza.rotation.x = -Math.PI / 2;
  const ring = add(new THREE.RingGeometry(8, 8.6, 40), MAT.stone, 0, .025, 0, false); ring.rotation.x = -Math.PI / 2;
  for (const T of temples) {
    const len = RG - 7.6, mid = 7.6 + len / 2;
    const p = add(new THREE.PlaneGeometry(2.8, len + .4), MAT.path, T.ux * mid, .03, T.uz * mid, false); p.rotation.order = 'YXZ'; p.rotation.y = Math.atan2(T.ux, T.uz); p.rotation.x = -Math.PI / 2;
    // 표지석: 길 입구 오른편, 마당 쪽을 바라봄
    const rx = T.uz, rz = -T.ux, sx = T.ux * 9.6 + rx * 2.3, sz = T.uz * 9.6 + rz * 2.3;
    const st = add(new THREE.BoxGeometry(1.25, 1.05, .28), MAT.stone, sx, .6, sz); st.rotation.y = Math.atan2(-T.ux, -T.uz);
    const face = add(new THREE.PlaneGeometry(1.15, .58), new THREE.MeshStandardMaterial({ map: nameTex(T.name, '#e9e2d2', '#5a3a22', 52, `${T.where} · ${T.hallName}`), roughness: .8 }), 0, 0, 0, false);
    st.add(face); face.position.set(0, .1, .145);
    obstacles.push({ cx: sx, cz: sz, c: Math.cos(st.rotation.y), s: -Math.sin(st.rotation.y), hu: .7, hv: .2 });
  }
  buildBellAndRack(g, add);
  // 마당 둘레 연등 기둥
  const lanGeo = new THREE.IcosahedronGeometry(.26, 1);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2 + .3, x = Math.sin(a) * 8.9, z = Math.cos(a) * 8.9;
    if (temples.some(T => Math.abs(x * T.uz - z * T.ux) < 2.4 && x * T.ux + z * T.uz > 0)) continue; // 길 입구는 비움
    if ([BELL, RACK].some(S => S && Math.abs(x * S.uz - z * S.ux) < 2.6 && x * S.ux + z * S.uz > 0)) continue; // 범종각·연등대 가는 쪽도 비움
    add(new THREE.CylinderGeometry(.05, .06, 2.6, 6), MAT.line, x, 1.3, z); add(lanGeo, MAT.lotus[i % MAT.lotus.length], x, 2.55, z, false);
  }
}
/* 사찰 담장 바깥 숲 (마당·길·사찰은 비움) */
function plantTrees() {
  const N = 900, trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.18, .26, 1, 6), MAT.trunk, N);
  const leafA = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), MAT.leaf, N);
  const leafB = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), MAT.leaf2, N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const free = (x, z) => {
    const r = Math.hypot(x, z); if (r < 11) return false;
    for (const S of [BELL, RACK]) if (S && Math.hypot(x - S.x, z - S.z) < 6.5) return false; // 범종각·연등대 가림 방지
    for (const T of temples) {
      const along = x * T.ux + z * T.uz, side = Math.abs(x * T.uz - z * T.ux);
      if (along > 0 && along < RG + 2 && side < 3.2) return false; // 박석길
      setFrame(T); const [lx, lz] = W2L(x, z), Y = T.YARD;
      if (lx > Y.x0 - 2.5 && lx < Y.x1 + 2.5 && lz > Y.z0 - 2.5 && lz < Y.z1 + 2.5) return false;
    }
    return true;
  };
  let n = 0, tries = 0;
  while (n < N && tries < 20000) {
    tries++;
    const a = Math.random() * Math.PI * 2, r = 9 + Math.pow(Math.random(), .8) * (RB + 70);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!free(x, z)) continue;
    const s = .8 + Math.random() * .9, h = 6 * s;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6);
    trunks.setMatrixAt(n, m.compose(v.set(x, h * .2, z), q, sc.set(s, h * .4, s)));
    leafA.setMatrixAt(n, m.compose(v.set(x, h * .55, z), q, sc.set(2.3 * s, h * .55, 2.3 * s)));
    leafB.setMatrixAt(n, m.compose(v.set(x, h * .85, z), q, sc.set(1.6 * s, h * .45, 1.6 * s)));
    n++;
  }
  if (cur) setFrame(cur);
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
  const r = Math.hypot(p.x, p.z), max = RB - 4;
  if (r > max) { p.x *= max / r; p.z *= max / r; }
}

/* ───────── 아바타 (아기 스님) ───────── */
const { avatar, body, headG, torso, kasa, legs, eyeGroups, closedEyes, faceOpen, placeArms, faceFill } = createBabyMonk();
scene.add(avatar, faceFill, faceFill.target);
// Meshy로 만든 아기 스님 3D 모델(시트 그대로). 못 불러오면 지금의 코드 아바타를 그대로 씀
const MONK_URL = new URLSearchParams(location.search).get('monk') || 'https://cdn.jsdelivr.net/gh/kail525k/temple-meta@ea753afac051478b6d31f64e96f39f54abba9fec/assets/baby-monk.glb';
let glb = null;
const glbReady = loadMonkGLB(MONK_URL, { onProgress: f => { const m = document.getElementById('loadMsg'); if (m && !document.getElementById('loading').classList.contains('hide')) m.innerHTML = `아기 스님을 모시는 중… ${Math.round(f * 100)}%`; } })
  .then(m => { glb = m; avatar.add(m.root); body.visible = false; dbg('monk', m.info); return m; })
  .catch(e => { dbg('monkError', e.message); return null; });
let blinkT = 2.5, idleT = 0;

// 금동 불상 (Meshy로 만든 실제 3D 조형). 못 불러오면 코드로 그린 불상을 그대로 둠
const STATUE_URL = QS.get('statue') || 'https://cdn.jsdelivr.net/gh/kail525k/temple-meta@898d0acabdb82f4c5bf3bbe52d99d4619ad7b591/assets/buddha.glb';
let statueKit = null;
const statueReady = loadStatue(STATUE_URL, renderer).then(k => (statueKit = k)).catch(e => { dbg('statueError', e.message); return null; });
async function enshrineStatues() {
  const kit = await statueReady; if (!kit) return;
  let n = 0;
  for (const T of temples) for (const sl of (T.hall && T.hall.slots) || []) {
    const old = sl.obj, s = sl.s;
    // 두광·신광(뒤쪽 원판)만 남기고 코드 불상 몸은 숨김
    old.children.forEach(ch => { const g = ch.geometry, halo = g && (g.type === 'CircleGeometry' || (g.type === 'TorusGeometry' && g.parameters.radius >= .4)); if (!halo) ch.visible = false; });
    const st = kit.make(2.0 * s), d = st.userData.depth;
    const back = sl.z - .27 * s, cz = Math.min(back + d / 2, sl.z + .95 - d / 2);
    st.position.set(sl.x, sl.y, cz);
    old.parent.add(st); sl.statue = st; n++;
  }
  dbg('statues', n);
}

/* ───────── 입력 ───────── */
const keys = {};
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || rituals.open) return;
  keys[e.code] = true;
  if (e.code === 'KeyE') useContext();
  if (e.code === 'Digit1') doHap(); if (e.code === 'Digit2') tryBow(); if (e.code === 'Digit3') toggleSit(); if (e.code === 'Digit4') rituals.openMoktak(); if (e.code === 'Digit5') rituals.openBeads();
});
addEventListener('keyup', e => { keys[e.code] = false; });
let yaw = Math.PI, pitch = 0.24, dist = 6;
const drag = { id: null, x: 0, y: 0 };
const ZMIN = 1.4, ZMAX = 45; // 확대·축소 범위 (얼굴 가까이 ~ 권역 전체)
const PMIN = -0.85, PMAX = 1.48; // 보는 각도: 아래에서 올려다보기(-) ~ 거의 위에서 내려다보기
const ptrs = new Map(); let pinchD = 0, pinchDist0 = 0, downInfo = null;
canvas.addEventListener('pointerdown', e => {
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); pinchDist0 = dist; drag.id = null; downInfo = null; return; }
  if (drag.id !== null) return; drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY; canvas.setPointerCapture(e.pointerId);
  downInfo = { x: e.clientX, y: e.clientY, t: performance.now() };
});
canvas.addEventListener('pointermove', e => {
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size >= 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinchD > 0) dist = clamp(pinchDist0 * pinchD / Math.max(20, d), ZMIN, ZMAX); return; }
  if (e.pointerId !== drag.id) return; yaw -= (e.clientX - drag.x) * 0.006; pitch = clamp(pitch + (e.clientY - drag.y) * 0.004, PMIN, PMAX); drag.x = e.clientX; drag.y = e.clientY;
});
const endDrag = e => {
  ptrs.delete(e.pointerId); if (ptrs.size < 2) pinchD = 0;
  if (e.pointerId === drag.id) { drag.id = null; if (e.type === 'pointerup' && downInfo && Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y) < 7 && performance.now() - downInfo.t < 400) clickMove(e); downInfo = null; }
};
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', e => { dist = clamp(dist * Math.exp(e.deltaY * .0013), ZMIN, ZMAX); e.preventDefault(); }, { passive: false });
addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; if (e.code === 'Equal' || e.code === 'NumpadAdd') dist = clamp(dist / 1.25, ZMIN, ZMAX); if (e.code === 'Minus' || e.code === 'NumpadSubtract') dist = clamp(dist * 1.25, ZMIN, ZMAX); });
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
let pose = null, poseT = 0, sam = null, bowCount = 0, intro = 0, poseHold = false;
const faceHall = () => Math.atan2(-NX, -NZ), behind = () => Math.atan2(NX, NZ);
const bowPromptEl = document.getElementById('bowPrompt');
let actx = null;
function bell(vol = .3) { sound.bell(vol); }
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
function doHap() { if (sam) return; if (sit) standUp(); pose = 'hap'; poseT = 0; toast('🙏 마음을 모아 합장했어요'); done('hap'); }
document.getElementById('btnHapjang').onclick = doHap;
document.getElementById('btnBow').onclick = tryBow;

document.getElementById('btnHall').onclick = () => {
  if (!hall) return; sam = null; resetBody(); if (sit) standUp(); if (tapdori) stopTapdori(); moveTarget = null;
  const [x, z] = L2W(0, hall.interior.iz1 - .5);
  avatar.position.set(x, hall.FY, z); avatar.rotation.y = faceHall(); yaw = behind(); dist = 3.6; pitch = .28; intro = -1;
  toast(`🛕 ${CFG.hall.name} 안으로 들어왔어요`);
};
document.getElementById('btnHome').onclick = () => { sam = null; resetBody(); if (sit) standUp(); if (tapdori) stopTapdori(); moveTarget = null; placeAtStart(); intro = -1; toast(`📍 ${REGION.name} 순례 마당으로 돌아왔어요`); };
function resetBody() { body.position.y = 0; body.rotation.x = 0; headG.rotation.x = 0; }
function placeAtStart() { const T = temples[0]; if (T && cur !== T) useTemple(T); avatar.position.set(T ? T.ux * 2 : 0, 0, T ? T.uz * 2 : 0); avatar.rotation.y = faceHall(); yaw = behind(); dist = 6; pitch = .24; }
// 사찰로 바로 가기: 그 절 일주문 앞 길에 서서 법당 쪽을 바라봄
function goTemple(T) { sam = null; pose = null; resetBody(); if (sit) standUp(); if (tapdori) stopTapdori(); moveTarget = null; useTemple(T); const [x, z] = L2W(0, T.YARD.z1 + 2.5); avatar.position.set(x, 0, z); avatar.rotation.y = faceHall(); yaw = behind(); dist = 6; pitch = .24; intro = -1; toast(`🛕 ${T.name}에 왔어요`); }
// 가장 가까운 사찰을 '지금 사찰'로
function pickCurrent() {
  if (sam || temples.length < 2) return;
  let best = null, bd = 1e9;
  for (const T of temples) { const d = Math.hypot(avatar.position.x - T.cx, avatar.position.z - T.cz); if (d < bd) { bd = d; best = T; } }
  if (best && best !== cur) useTemple(best);
}

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
function heading() { const ry = avatar.rotation.y - TH + (cur ? cur.info.th : 0), fx = Math.sin(ry), fz = Math.cos(ry); return (Math.atan2(fx, -fz) * 180 / Math.PI + 360) % 360; }
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

/* ───────── 미니맵 (권역 전체, 위 = 처음 바라보는 쪽) ───────── */
const mm = document.getElementById('minimap'), mctx = mm.getContext('2d');
function drawMinimap() { if (temples.length) drawRegionMap(mctx, mm.width, mm.height, false); }
function drawRegionMap(mctx, W, H, big) {
  const s = Math.min(W, H) / 2 / (RB - 8), P = (x, z) => [W / 2 + x * s, H / 2 + z * s];
  mctx.clearRect(0, 0, W, H);
  mctx.fillStyle = '#e6efd5'; if (mctx.roundRect) { mctx.beginPath(); mctx.roundRect(0, 0, W, H, 26); mctx.fill(); } else mctx.fillRect(0, 0, W, H);
  mctx.fillStyle = '#efe2c4'; mctx.beginPath(); mctx.arc(W / 2, H / 2, 8 * s, 0, 7); mctx.fill();
  mctx.strokeStyle = '#d8cdb8'; mctx.lineWidth = Math.max(2, 2.8 * s);
  for (const T of temples) { mctx.beginPath(); mctx.moveTo(...P(T.ux * 8, T.uz * 8)); mctx.lineTo(...P(T.ux * RG, T.uz * RG)); mctx.stroke(); }
  for (const T of temples) {
    const Y = T.YARD, poly = (x0, z0, x1, z1) => { setFrame(T); const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([lx, lz]) => P(...L2W(lx, lz))); mctx.beginPath(); pts.forEach((p, i) => i ? mctx.lineTo(...p) : mctx.moveTo(...p)); mctx.closePath(); mctx.fill(); };
    mctx.fillStyle = T === cur ? '#f3dca6' : '#efe2c4'; poly(Y.x0, Y.z0, Y.x1, Y.z1);
    mctx.fillStyle = '#8a4b36'; poly(-T.L / 2, -T.D / 2, T.L / 2, T.D / 2);
    if (T === cur) { const [bx, bz] = P(...L2W(T.hall.bowSpot.lx, T.hall.bowSpot.lz)); mctx.fillStyle = '#ffd36a'; mctx.beginPath(); mctx.arc(bx, bz, 3.5, 0, 7); mctx.fill(); }
    const [tx, tz] = P(T.hx, T.hz); mctx.fillStyle = '#3d2a1c'; mctx.font = `bold ${big ? 24 : 19}px sans-serif`; mctx.textAlign = 'center'; mctx.fillText(T.name, tx, tz - (T.D / 2 + 3) * s);
  }
  if (cur) setFrame(cur);
  if (BELL) { const [bx, bz] = P(BELL.x, BELL.z); mctx.fillStyle = '#4f5a3c'; mctx.beginPath(); mctx.arc(bx, bz, big ? 7 : 4, 0, 7); mctx.fill(); }
  if (RACK) { const [rx, rz] = P(RACK.x, RACK.z); mctx.fillStyle = '#e0a020'; mctx.fillRect(rx - (big ? 9 : 5), rz - 2, big ? 18 : 10, 4); }
  const [ax, az] = P(avatar.position.x, avatar.position.z);
  mctx.save(); mctx.translate(ax, az); mctx.rotate(Math.PI - avatar.rotation.y); mctx.fillStyle = '#d0382b'; mctx.beginPath(); mctx.moveTo(0, -11); mctx.lineTo(7, 7); mctx.lineTo(-7, 7); mctx.closePath(); mctx.fill(); mctx.restore();
}

/* ───────── 안내 ───────── */
const nearEl = document.getElementById('near');
function updateNear() {
  if (!hall) return;
  const [lx, lz] = W2L(avatar.position.x, avatar.position.z);
  const inside = hall.isInside(lx, lz), dBow = Math.hypot(lx - hall.bowSpot.lx, lz - hall.bowSpot.lz);
  updateCtx(inside, dBow, lx, lz); if (inside) done('enter');
  { const Y = YARD; if (lx > Y.x0 && lx < Y.x1 && lz > Y.z0 && lz < Y.z1) { visited.add(cur.name); if (visited.size >= 2) done('visit'); } }
  let html = '';
  if (Math.hypot(avatar.position.x, avatar.position.z) < 9.5) html = `<b>${REGION.name} 순례 마당</b><span>길 입구마다 표지석이 있어요 · 가고 싶은 절 쪽 길로 걸어가 보세요 (사찰 ${temples.length}곳)</span>`;
  else if (inside) html = `<b>${CFG.temple.name} ${CFG.hall.name} 안</b><span>가운데 빛나는 방석에서 삼배를 올릴 수 있어요${bowCount ? ` · 오늘 ${bowCount}번 올렸어요` : ''}</span>`;
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
  if (il > .05) { moveTarget = null; if (sit) standUp(); if (tapdori) stopTapdori('탑돌이를 멈췄어요'); }
  let speed = (keys.ShiftLeft || keys.ShiftRight || il > 0.95 && joy.id !== null ? 7 : 3.6);
  let mx = 0, mz = 0, moving = false;
  if (!sam && !sit && pose !== 'bow') {
    if (il > 0.05) { const c = Math.cos(yaw), s = Math.sin(yaw); mx = ix * c + iz * s; mz = -ix * s + iz * c; moving = true; }
    else if (tapdori) { speed = 2.2; const v = tapdoriStep(dt); mx = v[0]; mz = v[1]; moving = true; }
    else if (moveTarget) {
      const dx = moveTarget.x - avatar.position.x, dz = moveTarget.z - avatar.position.z, d = Math.hypot(dx, dz);
      moveTarget.t += dt; if (d < .35 || moveTarget.t > 25) { moveTarget = null; markMove(null); } else { mx = dx / d; mz = dz / d; moving = true; if (d > 6) speed = 5; }
    }
  }
  if (moving) {
    if (!tapdori) { avatar.position.x += mx * speed * dt; avatar.position.z += mz * speed * dt; }
    if (!tapdori) { pushOut(avatar.position, 0.42); clampBound(avatar.position); }
    let d = Math.atan2(mx, mz) - avatar.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); avatar.rotation.y += d * Math.min(1, dt * 10);
    walkT += dt * speed * 2; body.position.y = Math.abs(Math.sin(walkT)) * 0.06; body.rotation.z = Math.sin(walkT) * 0.05;
    walkAmp = Math.min(1, walkAmp + dt * 6);
  } else if (!sam) { body.position.y *= 0.85; body.rotation.z *= 0.85; walkAmp = Math.max(0, walkAmp - dt * 6); }
  else walkAmp = 0;
  sitW += ((sit ? 1 : 0) - sitW) * Math.min(1, dt * 5); if (sit) { sit.t += dt; if (sit.t > 30 && sit.inHall && !sit.noted) { sit.noted = true; done('sit'); } }
  updateWorld(dt);
  pickCurrent();
  // 바닥 높이 (기단·계단·마루)
  if (hall) { const [lx, lz] = W2L(avatar.position.x, avatar.position.z); avatar.position.y += (hall.heightAt(lx, lz) + (sit ? sit.seatY * sitW : 0) - avatar.position.y) * Math.min(1, dt * 14); }
  const swing = Math.sin(walkT) * walkAmp;
  legs.forEach((g, i) => { g.position.z = (i ? 1 : -1) * swing * .1; g.position.y = Math.max(0, -Math.cos(walkT + (i ? Math.PI : 0))) * .035 * walkAmp; });
  idleT += dt; headG.rotation.z = Math.sin(walkT * .5) * .05 * walkAmp + Math.sin(idleT * 1.3) * .03 * (1 - walkAmp);
  torso.scale.y = kasa.scale.y = 1 + Math.sin(idleT * 2.2) * .012 * (1 - walkAmp);
  // 자세: 합장 · 절 · 삼배
  let hap = 0;
  if (sam) {
    sam.t += sam.hold ? 0 : dt; const per = 2.7, n = Math.floor(sam.t / per), t = sam.t - n * per;
    if (n >= 3) {
      sam = null; resetBody(); bowCount++; done('sambae'); bell(.32); pose = 'hap'; poseT = 1.75; // 합장을 천천히 풀며 마무리
      toast('🙏 삼배를 올렸어요. 마음이 한결 편안해지길 바라요', 3600);
    } else {
      hap = t < 1 ? (n > 0 ? 1 : ss(0, .4, t)) : t < 1.9 ? 1 - .75 * ss(1, 1.4, t) : .25 + .75 * ss(1.9, 2.5, t);
      const kneel = ss(.45, .95, t) * (1 - ss(2, 2.5, t)), bend = ss(1, 1.45, t) * (1 - ss(1.85, 2.3, t));
      body.position.y = -kneel * .2; body.rotation.x = bend * 1.0; headG.rotation.x = bend * .3;
      if (t > 1.2 && sam.rung !== n) { sam.rung = n; bell(.18); toast(`🙇 ${n + 1}배`, 1200); }
    }
  } else if (pose) {
    poseT += poseHold ? 0 : dt; const dur = pose === 'hap' ? 2.2 : 2.0;
    hap = clamp(Math.min(poseT / .35, (dur - poseT) / .45), 0, 1);
    if (pose === 'bow') { body.rotation.x = clamp(Math.min((poseT - .3) / .4, (dur - poseT) / .5), 0, 1) * 0.8; headG.rotation.x = body.rotation.x * .3; }
    if (poseT > dur) { pose = null; resetBody(); }
  }
  if (tapdori) hap = Math.max(hap, .9);
  if (glb) glb.update(dt, { sit: sitW, walkAmp, speed, hap, kneel: body.position.y < 0 ? Math.min(1, -body.position.y / .2) : 0, bend: body.rotation.x, headX: headG.rotation.x, headZ: headG.rotation.z, closed: hap > .5 || (sit && sitW > .6 && sit.inHall), blink: blinkT < .12 });
  placeArms(hap, hap ? 0 : swing);
  const closed = hap > .5;
  eyeGroups.forEach(g => { g.visible = !closed; }); closedEyes.forEach(c => { c.visible = closed; }); faceOpen.forEach(m => { m.visible = !closed; });
  blinkT -= dt; const bs = blinkT < 0.12 ? 0.12 : 1; eyeGroups.forEach(g => { g.scale.y = bs; }); if (blinkT < 0) blinkT = 2 + Math.random() * 3;
  // 처음: 얼굴을 보여 준 뒤 등 뒤로 돌아가는 카메라
  if (intro >= 0) { intro += dt; const t = clamp((intro - 1.4) / 2.4, 0, 1), s = t * t * (3 - 2 * t); yaw = behind() + Math.PI * (1 - s); dist = 4.2 + 1.8 * s; pitch = .16 + .08 * s; if (t >= 1) intro = -1; }
  // 카메라: 법당 안에서는 가깝게, 벽·천장 밖으로 나가지 않게
  let effD = dist, effP = pitch, inside = false, lxA = 0, lzA = 0;
  if (hall) { [lxA, lzA] = W2L(avatar.position.x, avatar.position.z); inside = hall.isInside(lxA, lzA); if (inside) { effD = Math.min(dist, 5.5); effP = Math.min(pitch, .55); } }
  const hd = Math.cos(effP) * effD;
  camGoal.set(avatar.position.x + Math.sin(yaw) * hd, avatar.position.y + 1.2 + Math.sin(effP) * effD, avatar.position.z + Math.cos(yaw) * hd);
  if (hall && (inside || hall.underRoof(lxA, lzA))) {
    let [cl, cz] = W2L(camGoal.x, camGoal.z); const I = hall.interior;
    if (inside) { cl = clamp(cl, I.ix0 + .3, I.ix1 - .3); cz = Math.max(cz, I.iz0 + .3); }
    if (hall.underRoof(cl, cz)) camGoal.y = Math.min(camGoal.y, hall.ceilY - .7);
    const [x, z] = L2W(cl, cz); camGoal.x = x; camGoal.z = z;
  }
  // 아래에서 올려다볼 때: 카메라가 바닥 밑으로 들어가지 않게 바닥 바로 위에 붙이고, 시선은 조금 더 위로
  { let fy = 0; if (hall) { const [fl, fz] = W2L(camGoal.x, camGoal.z); fy = hall.heightAt(fl, fz); } camGoal.y = Math.max(camGoal.y, fy + .16); }
  camera.position.lerp(camGoal, Math.min(1, dt * 8));
  camera.lookAt(avatar.position.x, avatar.position.y + 1.05 + Math.max(0, -effP) * Math.min(effD, 3) * .3, avatar.position.z);
  faceFill.position.set(camera.position.x, camera.position.y + 1.2, camera.position.z); faceFill.target.position.set(avatar.position.x, avatar.position.y + 1, avatar.position.z);
  sun.position.set(avatar.position.x + 50, 100, avatar.position.z + 35); sun.target.position.copy(avatar.position);
  if (hall) { glowT += dt; hall.glow.visible = !sam; hall.glow.material.opacity = .35 + .25 * Math.sin(glowT * 3); }
  renderer.render(scene, camera);
  mmT += dt; if (mmT > 0.1) { mmT = 0; drawMinimap(); updateNear(); }
  frames++; fpsT += dt; if (fpsT > 1) { const ll = toLatLng(avatar.position.x, avatar.position.z); DBG.fps = frames; DBG.here = `${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}`; if (dbgEl.classList.contains('show')) renderDbg(); frames = 0; fpsT = 0; }
}


/* ───────── 산사 체험 (앉기 · 탑돌이 · 범종 · 향 · 소원 연등 · 바닥 클릭 이동 · 지도 · 사진) ───────── */
const visited = new Set();
let sit = null, sitW = 0, tapdori = null, moveTarget = null, BELL = null, RACK = null, bellAnim = -1, bellCool = 0;
const rituals = initRituals({ sound, store, toast, done, onUse: () => { if (sit) standUp(); } });
document.getElementById('btnMoktak').onclick = () => rituals.openMoktak();
document.getElementById('btnBeads').onclick = () => rituals.openBeads();

// 바닥 클릭 → 그 자리로 걸어감
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), _p = new THREE.Vector3();
const moveMark = new THREE.Mesh(new THREE.RingGeometry(.22, .34, 28), new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: .9, depthWrite: false }));
moveMark.rotation.x = -Math.PI / 2; moveMark.visible = false; scene.add(moveMark);
function markMove(p) { if (!p) { moveMark.visible = false; return; } moveMark.position.set(p.x, avatar.position.y + .05, p.z); moveMark.visible = true; moveMark.userData.t = 0; }
function clickMove(e) {
  if (sam || rituals.open) return;
  const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -avatar.position.y), _p) || _p.distanceTo(avatar.position) > 70) return;
  if (sit) standUp(); if (tapdori) stopTapdori(); intro = -1;
  moveTarget = { x: _p.x, z: _p.z, t: 0 }; markMove(_p);
}

// 앉기: 법당 안이면 가장 가까운 방석에 가부좌(눈 감고 명상), 밖이면 그 자리에 앉아 쉬기
function toggleSit() {
  if (sit) { standUp(); return; }
  if (sam) return; pose = null; moveTarget = null; markMove(null); if (tapdori) stopTapdori();
  const [lx, lz] = W2L(avatar.position.x, avatar.position.z);
  if (hall && hall.isInside(lx, lz)) {
    let best = hall.cushions[0], bd = 1e9; for (const c of hall.cushions) { const d = Math.hypot(c.lx - lx, c.lz - lz); if (d < bd) { bd = d; best = c; } }
    const [x, z] = L2W(best.lx, best.lz); avatar.position.x = x; avatar.position.z = z; avatar.rotation.y = faceHall();
    sit = { t: 0, seatY: .09, inHall: true }; yaw = behind() + .5; dist = Math.max(dist, 3.2); pitch = .32;
    toast('🧘 방석에 앉아 마음을 고요히… (움직이면 일어나요)', 3200);
  } else { sit = { t: 0, seatY: 0, inHall: false }; toast('🌿 잠깐 앉아 쉬어요 (움직이면 일어나요)'); }
  updateNear();
}
function standUp() { sit = null; updateNear(); }

// 탑돌이: 탑을 오른쪽에 두고 시계 방향으로 세 바퀴 (합장한 채로)
function startTapdori(T) {
  if (!T || !T.pagoda) return; if (sit) standUp(); moveTarget = null; markMove(null); pose = null;
  const dx = avatar.position.x - T.pagoda.x, dz = avatar.position.z - T.pagoda.z, phi = Math.atan2(dx, -dz);
  tapdori = { cx: T.pagoda.x, cz: T.pagoda.z, r: 2.7, phi, start: phi, laps: 0 }; intro = -1;
  toast('🪷 탑을 오른쪽에 두고 세 바퀴 돌아요 (움직이면 멈춰요)', 3000); updateNear();
}
function tapdoriStep(dt) {
  const t = tapdori; t.phi += dt * 2.2 / t.r;
  avatar.position.x = t.cx + t.r * Math.sin(t.phi); avatar.position.z = t.cz - t.r * Math.cos(t.phi);
  const laps = Math.floor((t.phi - t.start) / (Math.PI * 2));
  if (laps > t.laps) { t.laps = laps; bell(.14); if (laps >= 3) { done('tap'); store.count('tap'); stopTapdori('🪷 탑돌이 세 바퀴를 마쳤어요'); return [Math.cos(t.phi), Math.sin(t.phi)]; } toast(`🪷 ${laps}바퀴`, 1200); }
  return [Math.cos(t.phi), Math.sin(t.phi)];
}
function stopTapdori(msg) { tapdori = null; if (msg) toast(msg); updateNear(); }

// 범종각 · 소원 연등대: 순례 마당 바깥, 사찰로 가는 길 사이 빈 쪽에
function freeAngles(k) {
  const angs = temples.map(T => Math.atan2(T.ux, T.uz)).sort((a, b) => a - b), gaps = [];
  if (angs.length < 2) return Array.from({ length: k }, (_, i) => (angs[0] || Math.PI) + Math.PI + (i - (k - 1) / 2) * .9);
  for (let i = 0; i < angs.length; i++) { const a = angs[i], b = i + 1 < angs.length ? angs[i + 1] : angs[0] + Math.PI * 2; gaps.push({ a, w: b - a }); }
  gaps.sort((p, q) => q.w - p.w); const out = [];
  for (let i = 0; out.length < k; i++) { const g = gaps[i % gaps.length], n = gaps.length >= k ? 1 : Math.ceil(k / gaps.length), j = Math.floor(i / gaps.length); out.push(g.a + g.w * (j + 1) / (n + 1)); }
  return out;
}
function buildBellAndRack(g, add) {
  const [aBell, aRack] = freeAngles(2), R0 = 14;
  // 범종각
  { const ux = Math.sin(aBell), uz = Math.cos(aBell), x = ux * R0, z = uz * R0, grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = Math.atan2(-ux, -uz); g.add(grp);
    const ad = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
    ad(new THREE.BoxGeometry(4.6, .08, 4.6), MAT.stone, 0, .04, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { ad(new THREE.CylinderGeometry(.15, .17, 3.3, 10), MAT.red, sx * 1.85, 1.65, sz * 1.85); const [wx, wz] = [x + (sx * 1.85) * Math.cos(grp.rotation.y) + (sz * 1.85) * Math.sin(grp.rotation.y), z - (sx * 1.85) * Math.sin(grp.rotation.y) + (sz * 1.85) * Math.cos(grp.rotation.y)]; obstacles.push({ cx: wx, cz: wz, c: 1, s: 0, hu: .25, hv: .25 }); }
    const roof = ad(new THREE.ConeGeometry(3.7, 1.5, 4), MAT.wallCap, 0, 4.05, 0); roof.rotation.y = Math.PI / 4;
    ad(new THREE.BoxGeometry(4.2, .22, .22), MAT.red, 0, 3.15, 0);
    const bellProf = [[0, 0], [.64, 0], [.62, .14], [.53, .55], [.47, .95], [.41, 1.12], [.27, 1.2], [0, 1.23]].map(([r, y]) => new THREE.Vector2(r, y));
    const bellM = new THREE.MeshStandardMaterial({ color: '#4f5a3c', metalness: .55, roughness: .45 });
    const bellG = new THREE.Group(); bellG.position.set(0, 3.05, 0); grp.add(bellG);
    const bellMesh = new THREE.Mesh(new THREE.LatheGeometry(bellProf, 32), bellM); bellMesh.position.y = -2.0; bellMesh.castShadow = true; bellG.add(bellMesh);
    const band = new THREE.Mesh(new THREE.TorusGeometry(.6, .025, 6, 32), bellM); band.rotation.x = Math.PI / 2; band.position.y = -1.86; bellG.add(band);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(.12, .035, 8, 16), MAT.line); hook.position.y = -.72; bellG.add(hook);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .7, 6), MAT.line); rope.position.y = -.35; bellG.add(rope);
    // 당목(종 치는 통나무): 마당 쪽에 매달림
    const strG = new THREE.Group(); strG.position.set(0, 2.6, 1.15); grp.add(strG);
    const log = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 1.5, 12), MAT.trunk); log.rotation.x = Math.PI / 2; log.position.set(0, -1.05, .35); log.castShadow = true; strG.add(log);
    for (const sx of [-.45, .45]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 1.05, 4), MAT.line); r.position.set(0, -.52, .35 + sx); strG.add(r); }
    obstacles.push({ cx: x, cz: z, c: 1, s: 0, hu: .75, hv: .75 });
    BELL = { x, z, ux, uz, bellG, strG, stand: [ux * (R0 - 2.4), uz * (R0 - 2.4)] };
  }
  // 소원 연등대
  { const ux = Math.sin(aRack), uz = Math.cos(aRack), x = ux * R0, z = uz * R0, grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = Math.atan2(-ux, -uz); g.add(grp);
    const ad = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
    for (const sx of [-1, 1]) ad(new THREE.CylinderGeometry(.09, .1, 2.9, 8), MAT.trunk, sx * 2.5, 1.45, 0);
    for (const y of [2.75, 2.05]) { const bar = ad(new THREE.CylinderGeometry(.05, .05, 5.1, 8), MAT.trunk, 0, y, 0); bar.rotation.z = Math.PI / 2; }
    const sign = ad(new THREE.PlaneGeometry(1.5, .42), new THREE.MeshStandardMaterial({ map: nameTex('소원 연등', '#3a2418', '#f2cf72', 46), roughness: .7 }), 0, 3.15, .06); sign.castShadow = false;
    obstacles.push({ cx: x, cz: z, c: Math.cos(grp.rotation.y), s: -Math.sin(grp.rotation.y), hu: 2.7, hv: .3 });
    RACK = { x, z, ux, uz, grp, items: [], stand: [ux * (R0 - 2.2), uz * (R0 - 2.2)] };
    for (const w of store.wishes(REGION.id)) hangWish(w, false);
  }
}
function strikeBell() {
  if (!BELL || bellCool > 0) return; bellCool = 2.6; bellAnim = 0; if (sit) standUp();
  avatar.rotation.y = Math.atan2(BELL.x - avatar.position.x, BELL.z - avatar.position.z);
  setTimeout(() => { sound.bigBell(); const n = store.count('bell'); toast(`🔔 범종을 울렸어요 · 오늘 ${n}번`); done('bell'); }, 420);
}
const WISH_COLORS = ['#f6a5b8', '#ffd86a', '#f48c7a', '#a8e0a0', '#ffffff', '#9fc8ff'];
function hangWish(w, fresh = true) {
  if (!RACK) return; const k = RACK.items.length % 16, row = k < 8 ? 0 : 1, col = k % 8, lx = -2.1 + col * .6, ly = row ? 1.62 : 2.32;
  if (RACK.items.length >= 16) { const old = RACK.items.shift(); old.removeFromParent(); }
  const gL = new THREE.Group(); gL.position.set(lx, ly, .02); RACK.grp.add(gL);
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.17, 1), new THREE.MeshStandardMaterial({ color: w.c, emissive: w.c, emissiveIntensity: .35, roughness: .6, flatShading: true })); m.scale.y = .85; gL.add(m);
  const str = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .3, 4), MAT.line); str.position.y = .27; gL.add(str);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = '#fffaf0'; c.fillRect(0, 0, 256, 128); c.fillStyle = '#5a3a22'; c.font = '600 26px sans-serif'; c.textAlign = 'center';
  const t = w.t || ''; c.fillText(t.slice(0, 10), 128, 52); if (t.length > 10) c.fillText(t.slice(10, 20) + (t.length > 20 ? '…' : ''), 128, 90);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(.42, .21), new THREE.MeshStandardMaterial({ map: tex, roughness: .8, side: THREE.DoubleSide })); tag.position.set(0, -.33, .02); gL.add(tag);
  RACK.items.push(gL); if (fresh) { gL.scale.setScalar(.01); gL.userData.grow = 0; }
}
const wishModal = document.getElementById('wishModal');
let wishColor = WISH_COLORS[0];
function openWish() {
  const box = document.getElementById('wishColors'); box.innerHTML = '';
  WISH_COLORS.forEach(c => { const b = document.createElement('button'); b.style.background = c; b.className = c === wishColor ? 'on' : ''; b.onclick = () => { wishColor = c; [...box.children].forEach(x => x.className = ''); b.className = 'on'; }; box.appendChild(b); });
  document.getElementById('wishText').value = ''; wishModal.classList.add('show'); setTimeout(() => document.getElementById('wishText').focus(), 50);
}
document.getElementById('btnWish').onclick = openWish;
document.getElementById('wishCancel').onclick = () => wishModal.classList.remove('show');
document.getElementById('wishHang').onclick = () => {
  const t = document.getElementById('wishText').value.trim(); if (!t) { toast('소원을 한 문장 적어 주세요'); return; }
  const w = { c: wishColor, t: t.slice(0, 40), at: Date.now() }; store.wishes(REGION.id).push(w); if (store.wishes(REGION.id).length > 16) store.wishes(REGION.id).shift(); store.save();
  hangWish(w); wishModal.classList.remove('show'); sound.chime(); done('wish');
  toast('🏮 순례 마당 소원 연등대에 연등을 걸었어요', 3000);
  if (RACK) { avatar.position.set(RACK.stand[0], 0, RACK.stand[1]); avatar.rotation.y = Math.atan2(RACK.x - RACK.stand[0], RACK.z - RACK.stand[1]); yaw = avatar.rotation.y + Math.PI; dist = 5; pitch = .2; }
};

// 향 올리기: 향로에 향을 꽂으면 2분 동안 연기가 피어오름
const SMOKE_N = 70, smokeGeo = new THREE.BufferGeometry(), smokePos = new Float32Array(SMOKE_N * 3), smokeLife = new Float32Array(SMOKE_N).fill(-1);
smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
const smoke = new THREE.Points(smokeGeo, new THREE.PointsMaterial({ color: '#e8e4dc', size: .16, transparent: true, opacity: .32, depthWrite: false })); smoke.frustumCulled = false; scene.add(smoke);
let smokeT = 0, smokeAt = null, smokeEmit = 0;
function offerIncense() {
  if (!hall) return; const I = hall.incense, [x, z] = L2W(I.lx, I.lz); smokeAt = { x, y: avatar.position.y - hall.FY + I.ly, z, T: cur }; smokeT = 120;
  if (sit) standUp(); pose = 'hap'; poseT = 0; setTimeout(() => { if (!sam) { pose = 'bow'; poseT = 0; } }, 1300);
  sound.bell(.12); const n = store.count('incense'); toast(`🪔 향 한 자루를 올렸어요 · 오늘 ${n}번`); done('incense');
}

// 상황에 맞는 버튼 (E 키 = 첫 번째)
const ctxBar = document.getElementById('ctxBar'); let ctxKey = '', ctxActs = [];
function updateCtx(inside, dBow, lx, lz) {
  const acts = [];
  if (!sam && !tapdori) {
    if (inside && dBow < 2.2 && !sit) acts.push(['🙇 여기서 삼배 올리기', startSambae]);
    if (inside && !sit) acts.push(['🪔 향 올리기', offerIncense]);
    if (inside) acts.push([sit ? '🙂 일어나기' : '🧘 방석에 앉기', toggleSit]);
    if (!inside && cur && cur.pagoda && Math.hypot(avatar.position.x - cur.pagoda.x, avatar.position.z - cur.pagoda.z) < 4.6) acts.push(['🪷 탑돌이 시작', () => startTapdori(cur)]);
    if (BELL && Math.hypot(avatar.position.x - BELL.x, avatar.position.z - BELL.z) < 3.6) acts.push(['🔔 범종 치기', strikeBell]);
    if (RACK && Math.hypot(avatar.position.x - RACK.x, avatar.position.z - RACK.z) < 3.8) acts.push(['🏮 소원 연등 걸기', openWish]);
  }
  if (tapdori) acts.push(['⏹ 탑돌이 멈추기', () => stopTapdori('탑돌이를 멈췄어요')]);
  const key = acts.map(a => a[0]).join('|'); ctxActs = acts;
  if (key === ctxKey) return; ctxKey = key; ctxBar.innerHTML = '';
  acts.forEach(([t, fn], i) => { const b = document.createElement('button'); b.textContent = t; if (i === 0) b.className = 'main'; b.onclick = () => fn(); ctxBar.appendChild(b); });
}
function useContext() { if (ctxActs[0]) ctxActs[0][1](); else if (sit) standUp(); }
document.getElementById('btnSit').onclick = toggleSit;

// 매 프레임: 연기 · 종 · 표시
function updateWorld(dt) {
  if (bellCool > 0) bellCool -= dt;
  if (BELL && bellAnim >= 0) {
    bellAnim += dt; const t = bellAnim;
    BELL.strG.rotation.x = t < .3 ? -.55 * (t / .3) : t < .42 ? -.55 + .75 * ((t - .3) / .12) : .2 * Math.exp(-(t - .42) * 3) * Math.cos((t - .42) * 9);
    BELL.bellG.rotation.x = t > .42 ? -.06 * Math.exp(-(t - .42) * .8) * Math.sin((t - .42) * 4) : 0;
    if (t > 6) { bellAnim = -1; BELL.strG.rotation.x = 0; BELL.bellG.rotation.x = 0; }
  }
  if (moveMark.visible) { moveMark.userData.t += dt; moveMark.material.opacity = .9 * (.6 + .4 * Math.sin(moveMark.userData.t * 6)); }
  if (RACK) for (const it of RACK.items) if (it.userData.grow !== undefined) { it.userData.grow = Math.min(1, it.userData.grow + dt * 2); it.scale.setScalar(.01 + .99 * it.userData.grow); if (it.userData.grow >= 1) delete it.userData.grow; }
  // 연기
  if (smokeT > 0 && smokeAt) { smokeT -= dt; smokeEmit += dt * 14; }
  for (let i = 0; i < SMOKE_N; i++) {
    if (smokeLife[i] < 0 && smokeEmit >= 1 && smokeAt) { smokeEmit -= 1; smokeLife[i] = 0; smokePos[i * 3] = smokeAt.x + (Math.random() - .5) * .06; smokePos[i * 3 + 1] = smokeAt.y; smokePos[i * 3 + 2] = smokeAt.z + (Math.random() - .5) * .06; }
    if (smokeLife[i] >= 0) { smokeLife[i] += dt; const l = smokeLife[i]; smokePos[i * 3] += Math.sin(l * 2 + i) * .08 * dt; smokePos[i * 3 + 1] += .28 * dt; smokePos[i * 3 + 2] += Math.cos(l * 1.7 + i) * .08 * dt; if (l > 4.5) { smokeLife[i] = -1; smokePos[i * 3 + 1] = -99; } }
  }
  smokeEmit = Math.min(smokeEmit, 3); smokeGeo.attributes.position.needsUpdate = true;
}

// 사진 저장: 지금 화면 그대로 PNG
document.getElementById('btnPhoto').onclick = () => {
  try {
    renderer.render(scene, camera); const url = renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a'); const ts = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(/[: ]/g, '-');
    a.href = url; a.download = `산사순례-${cur ? cur.name : REGION.name}-${ts}.png`; a.click();
    document.body.classList.add('flash'); setTimeout(() => document.body.classList.remove('flash'), 180); toast('📸 사진을 저장했어요');
  } catch (e) { toast('사진을 저장하지 못했어요'); }
};

// 큰 지도: 미니맵을 누르면 열림 · 장소를 누르면 바로 이동
const mapModal = document.getElementById('mapModal'), bigMap = document.getElementById('bigMap');
let mapSpots = [];
function openMap() {
  const c = bigMap.getContext('2d'), W = bigMap.width, H = bigMap.height; drawRegionMap(c, W, H, true);
  const s = Math.min(W, H) / 2 / (RB - 8), P = (x, z) => [W / 2 + x * s, H / 2 + z * s];
  mapSpots = [{ n: '순례 마당', x: 0, z: 0, go: () => document.getElementById('btnHome').click() }];
  for (const T of temples) { setFrame(T); const [gx, gz] = L2W(0, T.YARD.z1 + 2.5); mapSpots.push({ n: T.name, x: gx, z: gz, go: () => goTemple(T) }); if (T.pagoda) mapSpots.push({ n: `${T.name} 탑돌이`, x: T.pagoda.x, z: T.pagoda.z, small: 1, go: () => { goTemple(T); avatar.position.set(T.pagoda.x + (avatar.position.x - T.pagoda.x) * 0 + T.ux * 3.2, 0, T.pagoda.z + T.uz * 3.2); } }); }
  if (cur) setFrame(cur);
  if (BELL) mapSpots.push({ n: '범종각', x: BELL.x, z: BELL.z, go: () => { avatar.position.set(BELL.stand[0], 0, BELL.stand[1]); avatar.rotation.y = Math.atan2(BELL.x - BELL.stand[0], BELL.z - BELL.stand[1]); yaw = avatar.rotation.y + Math.PI; dist = 6; pitch = .24; } });
  if (RACK) mapSpots.push({ n: '소원 연등대', x: RACK.x, z: RACK.z, go: () => { avatar.position.set(RACK.stand[0], 0, RACK.stand[1]); avatar.rotation.y = Math.atan2(RACK.x - RACK.stand[0], RACK.z - RACK.stand[1]); yaw = avatar.rotation.y + Math.PI; dist = 6; pitch = .24; } });
  for (const sp of mapSpots) { const [x, y] = P(sp.x, sp.z); sp.px = x; sp.py = y; if (sp.n === '순례 마당' || sp.small) continue; c.fillStyle = '#9b3b2b'; c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); }
  for (const sp of mapSpots.filter(q => !temples.some(T => T.name === q.n))) { c.fillStyle = sp.small ? '#6d5f4b' : '#2e8b74'; c.beginPath(); c.arc(sp.px, sp.py, sp.small ? 5 : 8, 0, 7); c.fill(); c.font = `600 ${sp.small ? 15 : 19}px sans-serif`; c.textAlign = 'center'; c.fillStyle = '#3d2a1c'; c.fillText(sp.n.replace(/^.* /, ''), sp.px, sp.py - 12); }
  mapModal.classList.add('show');
}
bigMap.addEventListener('click', e => {
  const r = bigMap.getBoundingClientRect(), x = (e.clientX - r.left) * bigMap.width / r.width, y = (e.clientY - r.top) * bigMap.height / r.height;
  let best = null, bd = 34; for (const sp of mapSpots) { const d = Math.hypot(sp.px - x, sp.py - y); if (d < bd) { bd = d; best = sp; } }
  if (!best) return; mapModal.classList.remove('show'); sam = null; resetBody(); if (sit) standUp(); if (tapdori) stopTapdori(); moveTarget = null; markMove(null); intro = -1; best.go(); toast(`📍 ${best.n}(으)로 왔어요`);
});
document.getElementById('minimap').onclick = openMap;
document.getElementById('mapClose').onclick = () => mapModal.classList.remove('show');
mapModal.addEventListener('pointerdown', e => { if (e.target === mapModal) mapModal.classList.remove('show'); });

/* ───────── 지역·사찰 고르기 ───────── */
const regionModal = document.getElementById('regionModal'), regionList = document.getElementById('regionList');
function openRegions() {
  regionList.innerHTML = '';
  for (const r of REGIONS) {
    const el = document.createElement('div'); el.className = 'rg' + (r === REGION ? ' on' : '');
    el.innerHTML = `<b>${r.name}${r === REGION ? ' · 지금 여기' : ''}</b><span>${r.temples.map(t => t.name).join(' · ')}</span>`;
    if (r === REGION) {
      const go = document.createElement('div'); go.className = 'go';
      for (const T of temples) { const bt = document.createElement('button'); bt.textContent = `${T.name} 가기`; bt.onclick = e => { e.stopPropagation(); regionModal.classList.remove('show'); goTemple(T); }; go.appendChild(bt); }
      el.appendChild(go);
    } else el.onclick = () => { const q = new URLSearchParams(location.search); q.set('r', r.id); location.search = q.toString(); };
    regionList.appendChild(el);
  }
  regionModal.classList.add('show');
}
document.getElementById('btnRegion').onclick = openRegions;
document.getElementById('regionClose').onclick = () => regionModal.classList.remove('show');
regionModal.addEventListener('pointerdown', e => { if (e.target === regionModal) regionModal.classList.remove('show'); });

/* ───────── 시작 ───────── */
(async function start() {
  const badge = document.getElementById('badge'), msg = document.getElementById('loadMsg');
  msg.innerHTML = `${REGION.name}의 큰 사찰 ${REGION.temples.length}곳으로 가는 중…<br>브이월드에서 실제 법당 위치를 불러오고 있어요`;
  document.querySelector('#title h1').innerHTML = `${REGION.name} 사찰 순례 <small>${REGION.temples.map(t => t.name).join(' · ')}</small>`;
  let ok = 0;
  const list = await Promise.all(REGION.temples.map(async t => {
    const T = { ...t, hallName: t.hall, via: '' };
    const pt = await findHallPoint(t); T.ref = mkRef(pt.lat, pt.lng); T.via = pt.via;
    try {
      const d = await vworldBuildings(T.ref), r = d && d.response;
      if (!r || r.status !== 'OK') { const e = r && r.error; throw new Error(e ? `${e.code} ${e.text}` : r && r.status === 'NOT_FOUND' ? '주변 건물 자료 없음(기본 크기로 지음)' : '응답 형식 오류'); }
      T.info = pickHall(r.result.featureCollection.features, T.ref, t.name);
      if (!T.info) throw new Error('법당 건물을 찾지 못함');
      ok++;
    } catch (e) { dbg('vworld.' + t.name, e.message); T.info = defaultHall(); }
    return T;
  }));
  temples.push(...list);
  badge.textContent = ok === list.length ? `실제 법당 ${ok}곳 위치·크기 반영` : ok ? `실제 법당 ${ok}/${list.length}곳 반영 · 나머지는 기본 크기` : '브이월드 연결 실패 · 기본 법당으로 보여드려요';
  if (ok < list.length) badge.classList.add('err');
  layoutRegion(temples);
  for (const T of temples) { try { buildSite(T.info, T); } catch (e) { dbg('buildError.' + T.name, e.message); } }
  // 법당 조명은 한 벌만 두고 지금 사찰로 옮겨 다님 (조명이 사찰 수만큼 늘면 무거워져서)
  sharedLights = temples[0].hall.lights;
  for (const T of temples) { T.lightPos = T.hall.lights.map(l => l.position.clone()); if (T !== temples[0]) T.hall.lights.forEach(l => l.removeFromParent()); }
  buildCommons();
  try { plantTrees(); } catch (e) { dbg('treeError', e.message); }
  enshrineStatues();
  useTemple(temples[0]);
  placeAtStart();
  camera.position.set(temples[0].ux * 6, 2.2, temples[0].uz * 6);
  await Promise.race([glbReady, new Promise(r => setTimeout(r, 9000))]); // 모델이 늦으면 9초 뒤 코드 아바타로 먼저 시작
  document.getElementById('loading').classList.add('hide');
  canvas.focus();
  loop();
  if (!QS.get('r') && !QS.has('dbg')) setTimeout(openRegions, 4200); // 처음 오면 지역 고르기를 보여 줌
})();

// 점검용 (주소에 ?dbg 가 있을 때만): 카메라·자세를 고정해 확인
if (/[?&]dbg/.test(location.search)) window.__t = {
  front(d = 3, p = .15) { intro = -1; yaw = behind() + Math.PI; dist = d; pitch = p; },
  side(d = 3, p = .15) { intro = -1; yaw = behind() + Math.PI / 2; dist = d; pitch = p; },
  back(d = 3, p = .2) { intro = -1; yaw = behind(); dist = d; pitch = p; },
  hap(hold) { sam = null; pose = 'hap'; poseT = hold ?? 0; poseHold = hold !== undefined; },
  bow(hold) { sam = null; pose = 'bow'; poseT = hold ?? 0; poseHold = hold !== undefined; },
  sam(t) { startSambae(); if (t !== undefined) { sam.t = t; sam.hold = true; } },
  release() { poseHold = false; if (sam) sam.hold = false; },
  walk(on, run) { keys.KeyW = !!on; keys.ShiftLeft = !!run; },
  get glb() { return glb; },
};
