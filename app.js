// 온라인 사찰 참배 체험판 — 권역(서울·경남 등)마다 한 장면에 큰 사찰들을 축소해 모아 두고, 사찰마다 법당 하나를 실제 크기로 재현 (위레브)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBabyMonk } from './avatar.js?v=4';
import { loadMonkGLB, shareClip, loadClip } from './monk-glb.js?v=6';
import { buildHall } from './hall.js?v=11';
import { buildPagoda, buildExtras, buildBackdrop, buildSea, buildHyuhyu, yonggungFrame, buildYonggung, treeKit } from './regional.js?v=29';
import { buildItems, buildLantern, buildGate } from './items.js?v=5';
import { BOARDS, boardKey, boardSign, initBoards, openBoard, isBoardOpen } from './boards.js?v=4';
import { createWalkTo } from './walkto.js?v=1';
import { loadStatue } from './statue.js?v=1';
import { connectTogether, myIdentity, saveNick, offerError } from './together.js?v=3';
import { REGIONS } from './temples.js?v=13';
import { loadMonk, myMonk, redeem, forgetMonk, pingMonk, monkRoster, monkBadge, checkBadge, monkLabel, plainNick, monkError } from './monk.js?v=1';
import { createStore, createSound, initTodo, initRituals, initSoundPanel } from './features.js?v=9';
import { initStats, addBow, initRanks, flushStats, statsDebug } from './ranks.js?v=1';
import { initMobileClean } from './mobile.js?v=2';

/* ───────── 설정 ───────── */
// hall: 법당(주불전) 실제 좌표. 브이월드 건물 중 이 좌표에 가장 가까운 건물을 법당으로 씀
const QS = new URLSearchParams(location.search);
const HASH_R = location.hash.slice(1); // 아티팩트 안에서는 주소 뒤 #지역 으로 권역을 고름
const REGION = REGIONS.find(r => r.id === (QS.get('r') || HASH_R)) || REGIONS[0]; // 권역 = 한 장면(나중엔 한 방/서버)
const CFG = {
  vworldKey: '8047AF94-B2B2-49BC-9C11-746A988127D4',
  naverKeyId: '0fdr2ec8dd',
  temple: { name: REGION.temples[0].name }, // 지금 가까이 있는 사찰 (돌아다니면 바뀜)
  hall: { name: REGION.temples[0].hall, lat: REGION.temples[0].lat, lng: REGION.temples[0].lng, buddhas: REGION.temples[0].buddhas },
  half: { lat: 0.0009, lng: 0.0011 }, // 조회 범위(약 ±100m)
};

/* ───────── 디버그 ───────── */
const DBG = { page: location.origin, three: THREE.REVISION };
// Claude 아티팩트 안에서는 바깥 연결(브이월드·네이버 거리뷰·함께 순례·제보함)이 막혀 있어 그 기능은 끄고 사이트로 안내
const OFFLINE = !!window.JEOLLO_ARTIFACT, SITE = 'https://temple-meta.vercel.app/';
const dbgEl = document.getElementById('dbg');
function dbg(k, v) { DBG[k] = v; renderDbg(); }
function renderDbg() { dbgEl.textContent = Object.entries(DBG).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n'); }
document.getElementById('dbgBtn').onclick = () => dbgEl.classList.toggle('show');
if (!QS.has('dbg')) document.getElementById('dbgBtn').style.display = 'none'; // 🛠 상태는 개발용 (?dbg=1 일 때만)
window.addEventListener('error', e => dbg('jsError', String(e.message)));
renderDbg();
const toastEl = document.getElementById('toast');
let toastT;
function toast(msg, ms = 2400) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), ms); }
/* 기록(이 기기) · 소리 · 오늘 할 일 */
const store = createStore(), sound = createSound(store);
addEventListener('pointerdown', () => sound.unlock(), { once: true }); addEventListener('keydown', () => sound.unlock(), { once: true });
const done = initTodo(store, toast, sound);
initBoards(() => done('board')); // 안내판 읽기 창
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
  if (OFFLINE) return Promise.reject(new Error('offline'));
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
  if (t.addr) try { // 제보로 들어온 작은 절: 도로명주소로 그 자리 건물을 바로 찾음 (매번 불러오고 저장하지 않음)
    const d = await vworldJSONP('search', { service: 'search', request: 'search', version: '2.0', crs: 'EPSG:4326', size: '5', page: '1', query: t.addr, type: 'address', category: 'road', format: 'json', errorformat: 'json' }, 9000);
    const it = ((d.response && d.response.result && d.response.result.items) || []).find(near);
    if (it) return { lat: +it.point.y, lng: +it.point.x, via: '도로명주소 ' + ((it.address && it.address.bldnm) || '') };
  } catch (e) { }
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
  if (OFFLINE) return Promise.reject(new Error('offline'));
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
function pickHall(feats, ref, templeName, byAddr = false) {
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
      // 주소로 찾은 작은 절: 한 번지에 법당·요사채가 같은 이름으로 여러 채 → 주소 점(보통 길가 요사채)보다 가장 큰 채를 법당으로 (항공사진으로 확인)
      if (byAddr) score = name.includes(templeName) && Math.hypot(cx, cz) < 40 ? 30 - Math.min(area, 600) / 25 : 99;
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
// 실제 하늘: 지역마다 다른 하늘 사진(Poly Haven, CC0)을 하늘 공에 입힘 · 사진 속 해를 게임의 해 쪽으로 돌려 맞추고, 지평선 근처는 안개색으로 이어서 산·바다와 자연스럽게 맞물림
const SKY_PHOTO = { seoul: 'miyako', gyeonggi: 'jeju', gangwon: 'gangwon', chungcheong: 'quarry', jeonbuk: 'jeju', jeonnam: 'miyako', gyeongbuk: 'quarry', gyeongnam: 'blouberg', jeju: 'jeju' };
const SKY_SUNU = { jeju: .5999, gangwon: .6233, miyako: .5999, quarry: .608, blouberg: .03 };
const SKY_HOR = { jeju: '#ced7d2', gangwon: '#aab7c9', miyako: '#d1d9d8', quarry: '#bed0d6', blouberg: '#c3c2bb' }; // 사진 지평선 색 → 안개·먼 산 색도 맞춤
const SUN_DIR = new THREE.Vector3(50, 100, 35).normalize();
const skyMat = new THREE.ShaderMaterial({
  uniforms: { uTop: { value: new THREE.Color('#5aa6e0') }, uHor: { value: SKY }, uSunC: { value: new THREE.Color('#fff2d8') }, uSunDir: { value: SUN_DIR }, uPhoto: { value: null }, uPK: { value: 0 }, uYaw: { value: 0 } },
  vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 uTop, uHor, uSunC, uSunDir; uniform sampler2D uPhoto; uniform float uPK, uYaw; varying vec3 vD;
    void main(){ vec3 d = normalize(vD); float h = d.y;
      vec3 col = mix(uHor, uTop, smoothstep(0.0, 0.55, h));
      col = mix(col, uHor * 0.92, smoothstep(0.0, -0.2, h));
      float s = max(dot(d, normalize(uSunDir)), 0.0);
      col += uSunC * (pow(s, 900.0) * 4.0 + pow(s, 14.0) * 0.32);
      if (uPK > 0.001 && h > 0.0) { float u = atan(d.z, d.x) * 0.15915494 + 0.5 + uYaw; float v = asin(clamp(h, 0.0, 1.0)) * 0.63661977;
        vec3 ph = texture2D(uPhoto, vec2(fract(u), clamp(v, 0.004, 0.996))).rgb;
        col = mix(col, ph, smoothstep(0.0, 0.07, h) * uPK); }
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
  side: THREE.BackSide, depthWrite: false, fog: false,
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 18), skyMat); skyDome.renderOrder = -10; skyDome.frustumCulled = false; scene.add(skyDome);
{ const name = SKY_PHOTO[REGION.id] || 'jeju';
  SKY.set(SKY_HOR[name]); scene.fog.color.copy(SKY);
  new THREE.TextureLoader().load(`./assets/sky/${name}.jpg?v=1`, t => {
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; skyMat.uniforms.uPhoto.value = t;
    skyMat.uniforms.uYaw.value = SKY_SUNU[name] - (Math.atan2(SUN_DIR.z, SUN_DIR.x) / (Math.PI * 2) + .5);
    skyDome.userData.on = true; dbg('sky', name);
  }, undefined, () => dbg('sky', 'fail ' + name)); }
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
const ENV = REGION.env || {};
const H_GOLD = new THREE.MeshStandardMaterial({ color: '#e2b347', metalness: .65, roughness: .3, emissive: '#6a4a08', emissiveIntensity: .55, flatShading: true });
if (ENV.grass) MAT.grass.color.set(ENV.grass);
MAT.wallStone = ENV.basalt ? M('#4a494d') : MAT.stone; // 제주는 검은 현무암 돌담
if (ENV.basalt) MAT.wallCap = M('#3a3a3e');
const ground = new THREE.Mesh(new THREE.CircleGeometry(600, 64), MAT.grass);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

/* ───────── 법당 + 마당 (법당 기준 좌표: 앞 = +z) ───────── */
let HX = 0, HZ = 0, TH = 0, cosT = 1, sinT = 0, NX = 0, NZ = 1;
const L2W = (lx, lz) => [HX + lx * cosT + lz * sinT, HZ - lx * sinT + lz * cosT];
const W2L = (x, z) => { const dx = x - HX, dz = z - HZ; return [dx * cosT - dz * sinT, dx * sinT + dz * cosT]; };
const obstacles = []; // 월드 기준 회전 사각형 {cx,cz,c,s,hu,hv}
let hall = null, YARD = null, startL = [0, 20];
function addCollider(c) { const [cx, cz] = L2W(c.cx, c.cz); obstacles.push({ cx, cz, c: cosT, s: -sinT, hu: c.hx, hv: c.hz }); }
function inObstacle(wx, wz, r = 0) { for (const ob of obstacles) { const dx = wx - ob.cx, dz = wz - ob.cz, du = dx * ob.c + dz * ob.s, dv = -dx * ob.s + dz * ob.c; if (Math.abs(du) < ob.hu + r && Math.abs(dv) < ob.hv + r) return true; } return false; }
// 사찰 좌표의 그 자리가 발로 닿는 평평한 마당인가 (낙엽·비질하는 동자승 자리: 계곡물·돌난간·나무 울타리·다리 위는 아님)
function openGround(lx, lz, r = .3) { const [x, z] = L2W(lx, lz); return !inObstacle(x, z, r) && !blockedAt(x, z, 0) && groundAt(x, z, 0) < .05; }
function clearLine(x0, z0, x1, z1) { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / .45); for (let i = 1; i <= n; i++) if (!openGround(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, .2)) return false; return true; }
// 권역 안 사찰들: 사찰마다 자기 좌표틀(법당 기준)이 있고, 아바타와 가장 가까운 사찰의 틀을 '지금 사찰'로 씀
const temples = []; let cur = null, sharedLights = null, RG = 30, RB = 90;
function setFrame(T) { HX = T.hx; HZ = T.hz; TH = T.th; cosT = Math.cos(TH); sinT = Math.sin(TH); NX = Math.sin(TH); NZ = Math.cos(TH); }
function useTemple(T) {
  cur = T; setFrame(T); hall = T.hall; YARD = T.YARD; startL = T.startL;
  CFG.temple = { name: T.name }; CFG.hall = { name: T.hallName, lat: T.ref.lat, lng: T.ref.lng, buddhas: T.buddhas };
  if (sharedLights && hall) sharedLights.forEach((l, k) => { hall.group.add(l); l.position.copy(T.lightPos[k]); });
  const h1 = document.querySelector('#title h1'), p = document.querySelector('#title p');
  if (h1) h1.innerHTML = `${T.name} ${T.hallName} <small>${REGION.name} · ${T.where}</small>`;
  if (p) p.textContent = (T.note ? T.note : `${REGION.name}의 큰 사찰 ${temples.length}곳을 걸어서 돌아볼 수 있어요`) + (ENV.note ? ` · ${ENV.note}` : '');
  document.title = `${T.name} · 수월`;
  leavesOf(T); dustOf(T); ensureNpc(T); // 운력: 마당 낙엽 · 법당 마루 먼지 · 비질하는 동자승
  if (myMonk()) try { monkPing(); } catch (e) { } // 스님이 다른 절로 옮기면 '계신 절'도 바로 바뀜
}

// 불단 구성 문자열 'amita biro:1.15 sakya' → [{k, s}]
function parseAltar(a) {
  if (!a) return null; const ws = a.trim().split(/\s+/), mid = ws.length % 2 ? (ws.length - 1) / 2 : -1;
  return ws.map((w, i) => { const [k, sc] = w.split(':'); return { k, s: sc ? +sc : i === mid ? 1 : /^(sakya|amita|yaksa|biro)$/.test(k) ? .86 : .8 }; });
}
function siteSize(info) { return { L: clamp(info.width * .92, 11, 18), D: clamp(info.depth * .92, 10, 14.5) }; }
function buildSite(info, T) {
  const { L, D } = siteSize(info);
  setFrame(T);
  dbg('hall.' + T.name, `${T.hallName} 정면 ${L.toFixed(1)}m × 측면 ${D.toFixed(1)}m · 실제 방향 ${(info.th * 180 / Math.PI).toFixed(0)}° · ${T.via}`);
  const st = T.style || {}, ex = st.extras || [];
  hall = buildHall(THREE, { L, D, buddhas: T.buddhas, altar: parseAltar(T.altar), roof: st.roof, stories: st.stories, plain: st.plain, sign: nameTex(T.hallName, '#2b1d14', '#f2cf72', 50) });
  const site = new THREE.Group(); site.position.set(HX, 0, HZ); site.rotation.y = TH; scene.add(site);
  site.add(hall.group);
  hall.colliders.forEach(addCollider);
  const loc = [];
  const add = (geo, mat, x, y, z, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; site.add(m); return m; };
  const box = (w, h, d, mat, x, y, z) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  const col = (cx, cz, hx, hz) => { const c = { cx, cz, hx, hz }; loc.push(c); addCollider(c); };

  // 마당과 박석길
  const hyu = st.layout === 'hyuhyu', yg = st.layout === 'yonggung';
  const back = hyu ? 18 : yg ? 6 : ex.includes('janggyeong') ? 12.5 : ex.includes('flatRock') ? 9 : ex.includes('gyedan') ? 9 : ex.includes('magokDaeung') ? 16 : ex.includes('whiteGwaneum') ? 7.5 : ex.includes('hyodae') ? 6.5 : 0; // 뒤뜰에 상징물이 있으면 마당을 뒤로 넓힘
  const YX = L / 2 + 6, YZ0 = -D / 2 - 2 - back, YZ1 = D / 2 + 19;
  YARD = { x0: -YX, x1: YX, z0: YZ0, z1: YZ1 };
  const yard = add(new THREE.PlaneGeometry(2 * YX, YZ1 - YZ0), MAT.yard, 0, .02, (YZ0 + YZ1) / 2, false); yard.rotation.x = -Math.PI / 2;
  const path = add(new THREE.PlaneGeometry(2.8, YZ1 - D / 2 - 1.2), MAT.path, 0, .03, (D / 2 + 1.2 + YZ1) / 2, false); path.rotation.x = -Math.PI / 2;
  // 낮은 담장 + 앞쪽 문
  const GW = st.gate === 'jogye' ? 4.35 : st.gate === 'sammun' ? 3.85 : 1.6; // 일주문 반폭 (범어사 조계문은 돌기둥 넷, 용주사는 삼문)
  const WH = .95, wall = (w, d, x, z) => { box(w, WH, d, MAT.wallStone, x, WH / 2, z); box(w + .2, .18, d + .2, MAT.wallCap, x, WH + .09, z); col(x, z, w / 2 + .05, d / 2 + .05); };
  if (!hyu) { // 휴휴암은 담장 없이 숲속 곶에 열려 있음
    for (const sx of [-1, 1]) if (!(yg && sx < 0)) wall(.45, YZ1 - YZ0, sx * YX, (YZ0 + YZ1) / 2); // 해동용궁사 왼쪽은 바닷물 길
    if (!st.sea) wall(2 * YX + .45, .45, 0, YZ0); // 바다 사찰은 뒤가 바다 (흰 돌난간)
    for (const sx of [-1, 1]) wall(YX - GW, .45, sx * (GW + (YX - GW) / 2), YZ1);
  }
  if (!st.gate) {
  for (const sx of [-1, 1]) { add(new THREE.CylinderGeometry(.16, .18, 3, 10), MAT.red, sx * 1.6, 1.5, YZ1); col(sx * 1.6, YZ1, .25, .25); }
  box(4.2, .3, 1.2, MAT.wallCap, 0, 3.1, YZ1); box(3.6, .25, .3, MAT.red, 0, 2.8, YZ1);
  }
  const SL = D / 2 + 4.4;
  if (!yg && !st.lantern) { // 석등 (법당 바로 앞) — 해동용궁사는 그 자리에 사사자 석탑 · 법주사 쌍사자석등·화엄사 큰 석등은 items.js
  add(new THREE.CylinderGeometry(.42, .5, .3, 8), MAT.stone, 0, .15, SL); add(new THREE.CylinderGeometry(.12, .14, .95, 8), MAT.stone, 0, .78, SL);
  box(.62, .14, .62, MAT.stone, 0, 1.3, SL); box(.46, .5, .46, MAT.stone, 0, 1.62, SL); box(.3, .26, .48, MAT.fire, 0, 1.62, SL);
  add(new THREE.ConeGeometry(.52, .38, 8), MAT.stoneDark, 0, 2.06, SL); add(new THREE.SphereGeometry(.1, 10, 8), MAT.stoneDark, 0, 2.3, SL);
  col(0, SL, .55, .55);
  }
  // 탑 (사찰마다 다름: 삼층·오층·칠층 석탑, 팔각구층석탑, 목탑, 석가탑·다보탑)
  const YG = yg ? yonggungFrame({ L, D, YX, YZ1 }) : null;
  const PZ = yg ? YG.PZ : D / 2 + 10.5, H = { THREE, add, box, col, MAT, L, D, YX, YZ0, YZ1, SL, PZ, RG, nameTex, site, fig: [] };
  if (st.gate) buildGate(H, st.gate, T);
  let lanSpot = null; if (st.lantern && !yg) { const r = buildLantern(H, st.lantern, SL); if (r) lanSpot = { lx: 0, lz: SL, r: 2.6, ...r }; }
  if (hyu) { H.fishX = -6.2; H.fishZ = YZ0 - 7.3; H.fishAt = { lx: -6.2, lz: YZ0 - 2.4 }; H.fishStall = { lx: -9.2, lz: YZ0 + 2.7 }; }
  if (st.sea) T.seaRect = buildSea(H, hyu ? { gap: [-10.2, -2.2, 3.4], side: st.seaSide || 0, clear: { x: -6.2, z: -7.9, rx: 9.6, rz: 4.1 } } : yg ? { gap: YG.gap } : {});
  if (yg && T.seaRect) T.seaRect.inlet = { x0: -YX - 7, x1: -YX + .3, z0: YZ0 - 1, z1: YG.ZB + .5 };
  let PG = null; if (st.pagoda !== 'none') { const pg = buildPagoda(H, st.pagoda, PZ); PG = pg; const [px, pz] = L2W(pg.x, PZ); T.pagoda = { x: px, z: pz }; T.pagodaR = Math.max(yg ? 2.0 : 2.7, pg.r + .75); } else T.pagoda = null;
  // 사찰 상징물 (법당 옆 마당·뒤뜰)
  const exo = buildExtras(H, T), ito = buildItems(H, T); T.spots = [...(exo.spots || []), ...ito.spots, ...(lanSpot ? [lanSpot] : []), ...(st.pagoda === 'octa10' ? [{ lx: 0, lz: PZ + 3, r: 3.2, name: '조계사 팔각십층석탑', story: '부처님 진신사리를 모신 팔각 10층 석탑이에요' }] : [])]; T.site = site; T.bigBuddha = exo.bigBuddha; T.mini = exo.mini; T.fish = exo.fish; T.anim = exo.anim; T.wishStone = exo.wishStone;
  if (hyu) buildHyuhyu(H, T);
  if (yg) { buildYonggung(H, T, YG); const hh = hall.heightAt; hall.heightAt = (lx, lz) => Math.max(hh(lx, lz), YG.ground(lx, lz)); }
  T.figs = H.fig; // 바깥 불상·보살상 자리 (3D 존상 모델을 불러오면 바꿔 끼움)
  // 마당 위를 가로지르는 연등 줄 (조계사처럼 마당을 덮는 연등 지붕도) — 색깔별로 한 번에 그림
  const lanGeo = new THREE.IcosahedronGeometry(.21, 1), tasGeo = new THREE.CylinderGeometry(.02, .04, .22, 6), LM = MAT.lotus.length;
  const lanM = Array.from({ length: LM }, () => []), tasM = Array.from({ length: LM }, () => []), m4 = new THREE.Matrix4();
  const gy = (x, z) => yg ? YG.ground(x, z) : 0;
  const rows = yg ? [D / 2 + 7.3, D / 2 + 12.2, D / 2 + 13.4, D / 2 + 16.6] : st.lanRows ? st.lanRows.map(o => D / 2 + o) : st.lanterns === 'canopy' ? Array.from({ length: Math.floor((YZ1 - 2 - (D / 2 + 5)) / 1.5) }, (_, i) => D / 2 + 5 + i * 1.5).filter(z => Math.abs(z - PZ) > 2) : [D / 2 + 7.2, D / 2 + 13.5, D / 2 + 17];
  let k = 0;
  for (const z of rows) {
    const x0 = -YX + (st.lanInset || .6), x1 = YX - (st.lanInset || .6), wy = Math.max(gy(0, z), gy(x0, z)); // 양옆에 긴 건물이 있는 절은 연등 줄을 안쪽에서 맴
    for (const x of [x0, x1]) { const b = gy(x, z), hp = 3.4 + wy - b; add(new THREE.CylinderGeometry(.05, .06, hp, 6), MAT.line, x, b + hp / 2, z); col(x, z, .12, .12); }
    const wire = add(new THREE.CylinderGeometry(.01, .01, x1 - x0, 4), MAT.line, 0, 3.25 + wy, z, false); wire.rotation.z = Math.PI / 2;
    for (let x = x0 + .9; x < x1 - .5; x += st.lanterns === 'canopy' ? .7 : .95) {
      const c = k++ % LM; lanM[c].push(new THREE.Matrix4().compose(new THREE.Vector3(x, 2.95 + wy, z), new THREE.Quaternion(), new THREE.Vector3(1, .85, 1)));
      tasM[(c + 2) % LM].push(new THREE.Matrix4().makeTranslation(x, 2.67 + wy, z));
    }
  }
  T.wire = { z: rows[0], x0: -YX + (st.lanInset || .6), x1: YX - (st.lanInset || .6), step: st.lanterns === 'canopy' ? .7 : .95, items: [], k: 0 };
  for (let c = 0; c < LM; c++) for (const [geo, arr] of [[lanGeo, lanM[c]], [tasGeo, tasM[c]]]) { if (!arr.length) continue; const im = new THREE.InstancedMesh(geo, MAT.lotus[c], arr.length); arr.forEach((mm, i) => im.setMatrixAt(i, mm)); site.add(im); }
  // 일주문 현판 (안팎 양쪽)
  if (!st.gate) for (const side of [1, -1]) {
    const bd = add(new THREE.PlaneGeometry(2.3, .62), new THREE.MeshStandardMaterial({ map: nameTex(T.name, '#3a2418', '#f2cf72', 46), roughness: .7 }), 0, 2.35, YZ1 + side * .2, false);
    if (side < 0) bd.rotation.y = Math.PI;
  }
  // 일주문 오른쪽 팻말: "주지스님이신가요? 스님으로 등록해 드려요" — 팻말 앞에서 [스님 등록 신청]
  { const sx = 2.75, sz = YZ1 + 1.7, b = gy(sx, sz), wood = MAT.trunk;
    for (const px of [-.66, .66]) add(new THREE.CylinderGeometry(.05, .06, 1.78, 8), wood, sx + px, b + .89, sz);
    const face = new THREE.MeshStandardMaterial({ map: monkSignTex(T.name), roughness: .85 }), edge = new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: .9 });
    const bd = new THREE.Mesh(new THREE.BoxGeometry(1.52, 1.02, .06), [edge, edge, edge, edge, face, edge]); bd.position.set(sx, b + 1.24, sz); bd.castShadow = true; site.add(bd);
    add(new THREE.BoxGeometry(1.66, .07, .14), wood, sx, b + 1.78, sz); // 지붕턱
    col(sx, sz, .85, .12); T.sign = { lx: sx, lz: sz }; }
  // 안내판: 일주문 왼쪽 사찰 안내판 + 유적·상징물 앞 안내판 (가까이 가서 [📜 안내판 읽기] 또는 팻말을 누르면 크게 읽기)
  { const SXe = L / 2 + 3.2, sp = T.spots, ex = (st.extras || []), first = k => (BOARDS[k] ? BOARDS[k].p[0] : '');
    for (const p of sp) p.board = boardKey(p.name);
    const sign = (key, lx, lz, ry, o = {}) => { if (!BOARDS[key] || yg && !o.yg) return; boardSign(H, lx, lz, ry, key, { y0: gy(lx, lz), title: o.title });
      sp.push({ lx: lx + Math.sin(ry) * 1.1, lz: lz + Math.cos(ry) * 1.1, r: 2.2, name: o.title || key, story: o.story || first(key), board: key }); };
    const at = (key, lx, lz, r) => { if (BOARDS[key] && !sp.some(q => q.board === key && Math.hypot(q.lx - lx, q.lz - lz) < 1.5)) sp.push({ lx, lz, r, name: key, story: first(key), board: key }); };
    if (BOARDS[T.name]) sign(T.name, -2.75, YZ1 + 1.7, 0, { title: T.name + ' 안내', story: BOARDS[T.name].tag + ' · 안내판을 읽어 보세요', yg: true });
    const PK = { '조계사': '조계사 팔각십층석탑', '월정사': '월정사 팔각구층석탑', '법주사': '법주사 팔상전', '마곡사': '마곡사 오층석탑', '불국사': '불국사 석가탑', '선운사': '선운사 육층석탑', '직지사': '직지사 대웅전 앞 삼층석탑', '금산사': '금산사 육각다층석탑' }[T.name];
    if (PG && PK) { const R0 = (T.pagodaR || 2.7) + 1.5, s0 = PG.x > .1 ? 1 : -1; at(PK, PG.x, PZ, (T.pagodaR || 2.7) + 2); sign(PK, PG.x + s0 * R0, PZ + 1.3, -s0 * .45); }
    if (PG && st.pagoda === 'pair') { const k2 = '불국사 다보탑', R0 = (T.pagodaR || 2.7) + 1.6; at(k2, -PG.x, PZ, (T.pagodaR || 2.7) + 2); sign(k2, -PG.x + R0, PZ + 1.3, -.45); }
    if (ex.includes('buldu')) { at('와우정사 황금 불두', 0, PZ + 3, 3.6); sign('와우정사 황금 불두', -3.4, PZ + 2.6, .4); }
    if (st.bigStand && st.bigStand.name) { const k = T.name + ' ' + st.bigStand.name; at(k, -SXe, 2.6, 3.4); sign(k, -SXe + 1.7, 3.0, .35); }
    if (ex.includes('bigBuddha')) { at('신흥사 통일대불', -SXe, 2.0, 3.4); sign('신흥사 통일대불', -SXe + 1.7, 2.8, .35); }
    if (exo.mireuk) { const M = exo.mireuk; sign('금산사 미륵전', M.sign[0], M.sign[1], M.ry + .4); }
    if (exo.bangdeung) { const B = exo.bangdeung; sign('금산사 금강계단 · 오층석탑', B.x - 2.0, B.zt + 3.3, -.4); }
    if (st.pagoda === 'octa9s') at('월정사 석조보살좌상', .9, PZ + 2.9, 2.4);
    if (ex.includes('gyedan')) { at('통도사 금강계단', 0, -D / 2 - 2.4, 3.6); sign('통도사 금강계단', -(L / 2 + 2.6), -D / 2 - .6, Math.PI / 2); }
    if (ex.includes('janggyeong')) { at('해인사 장경판전', 0, -D / 2 - 1.4, 3.0); sign('해인사 장경판전', -(L / 2 + 2.6), -D / 2 - .6, Math.PI / 2); }
    if (ex.includes('pond')) { at('백양사 쌍계루', SXe, 1.6, 3.4); sign('백양사 쌍계루', SXe + .9, D / 2 + 1.3, 0); }
    if (ex.includes('bridge')) { at('선암사 승선교', SXe - 1.4, D / 2 + 5.4, 3.0); sign('선암사 승선교', SXe - 2.4, D / 2 + 5.2, -.5); }
    if (ex.includes('stoneBuddhas')) { at('관음사 돌부처 길', 0, YZ1 - 4, 3.0); sign('관음사 돌부처 길', 3.6, YZ1 - 2.4, -.35); }
    const HK = { '수덕사': '수덕사 대웅전', '화엄사': '화엄사 각황전', '봉선사': '봉선사 큰법당' }[T.name]; if (HK) sign(HK, -(L / 2 - 1.2), D / 2 + 1.4, 0);
    if (lanSpot && boardKey(lanSpot.name)) sign(boardKey(lanSpot.name), 1.9, SL + .3, -.5);
    T.signs = H.signs || []; }
  { const BA = st.broomAt || {}, bx = (BA.side || 1) * (YX - (BA.inset ?? 1.1)), bz = BA.z != null ? D / 2 + BA.z : Math.min(D / 2 + 5.5, YZ1 - 3), b = gy(bx, bz); // 싸리비 걸이 (운력: 마당 쓸기)
    for (const pz of [-.5, .5]) add(new THREE.CylinderGeometry(.035, .04, 1.3, 6), MAT.trunk, bx, b + .65, bz + pz);
    add(new THREE.CylinderGeometry(.028, .028, 1.1, 6), MAT.trunk, bx, b + 1.22, bz).rotation.x = Math.PI / 2;
    for (const k of [-.24, .02, .26]) { const br = makeBroom(); br.position.set(bx + .07, b + 1.2, bz + k); br.rotation.z = -.16 + k * .2; site.add(br); }
    col(bx, bz, .25, .62); T.broomAt = { lx: bx - .8 * (BA.side || 1), lz: bz }; }
  startL = st.start ? [st.start[0], D / 2 + st.start[1]] : [0, st.startNear ? YZ1 - 1.2 : YZ1 - 3]; // 마당 앞쪽에 계곡·누각이 있는 절은 일주문 바로 안에서 시작
  T.hall = hall; T.YARD = YARD; T.startL = startL; T.L = L; T.D = D;
  const [ycx, ycz] = L2W(0, (YZ0 + YZ1) / 2); T.cx = ycx; T.cz = ycz;
  return { L, D };
}
/* ───────── 운력(運力): 마당 낙엽 쓸기 · 법당 마루 닦기 ─────────
   스님들이 날마다 하는 청소를 함께 — 싸리비 걸이에서 비를 들고 걸으면 앞의 낙엽이 쓸려 나가고,
   법당 안에서 걸레를 들고 다니면 마루의 먼지 자국이 닦임 · 낙엽은 나무에서 조금씩 다시 떨어짐 · 마당마다 비질하는 동자승 */
let BROOM_M = null;
function makeBroom() {
  if (!BROOM_M) BROOM_M = { h: new THREE.MeshStandardMaterial({ color: '#9b7444', roughness: .8 }), t: new THREE.MeshStandardMaterial({ color: '#5a4636', roughness: .9 }), b: new THREE.MeshStandardMaterial({ color: '#b8995e', roughness: 1 }) };
  const g = new THREE.Group(), m = (geo, mat, y) => { const o = new THREE.Mesh(geo, mat); o.position.y = y; o.castShadow = true; g.add(o); return o; };
  m(new THREE.CylinderGeometry(.016, .02, .64, 6), BROOM_M.h, -.32); m(new THREE.CylinderGeometry(.034, .034, .05, 8), BROOM_M.t, -.63);
  m(new THREE.CylinderGeometry(.034, .15, .36, 10), BROOM_M.b, -.8).scale.z = .42; // 납작하게 퍼진 싸리 가지
  return g; // 손잡이 끝이 원점, 아래로 0.98m
}
// 빗자루질 동작 (Meshy 텍스트→모션 · 같은 믹사모 뼈대) — 불러오면 나·다른 분·동자승 모두 두 손으로 비를 잡고 좌우로 쓸어요
let SWEEP_OK = false;
loadClip('./assets/monk-sweep.glb').then(c => { shareClip('sweep', c); SWEEP_OK = !!c; dbg('sweepClip', c ? `${c.name} ${c.duration.toFixed(2)}s` : '없음'); }).catch(() => dbg('sweepClip', '아직 없음 (어깨에 맨 비로 대신)'));
const _gh1 = new THREE.Vector3(), _gh2 = new THREE.Vector3(), _gd = new THREE.Vector3(), _DOWN = new THREE.Vector3(0, -1, 0);
function gripBroom(br, m, groundY) { // 비 손잡이를 위쪽 손에서 아래쪽 손을 지나 땅까지 — 동작에 따라 매 프레임 맞춤
  const L = m && m.B && m.B.LeftHand, R = m && m.B && m.B.RightHand; if (!L || !R) return null;
  L.getWorldPosition(_gh1); R.getWorldPosition(_gh2);
  const top = _gh1.y >= _gh2.y ? _gh1 : _gh2, low = top === _gh1 ? _gh2 : _gh1;
  _gd.subVectors(low, top); const sep = _gd.length(); if (sep < .015) _gd.set(0, -1, .35); _gd.normalize();
  if (_gd.y > -.45) { _gd.y = -.45; _gd.normalize(); } // 너무 눕지 않게
  br.position.copy(top).addScaledVector(_gd, -.17); // 손잡이 끝이 위쪽 손 위로 조금 더 나오게 (긴 싸리비)
  const len = Math.max(.45, Math.min(1.25, (br.position.y - groundY - .015) / -_gd.y));
  br.quaternion.setFromUnitVectors(_DOWN, _gd); br.scale.setScalar(len / .98);
  return br.userData.tip = (br.userData.tip || new THREE.Vector3()).copy(br.position).addScaledVector(_gd, len);
}
function makeRag() { const g = new THREE.Group(), r = new THREE.Mesh(new THREE.BoxGeometry(.24, .035, .17), new THREE.MeshStandardMaterial({ color: '#e9e3d3', roughness: 1 })); r.castShadow = true; g.add(r); return g; }
function holdTool(parent, kind) { // 모델 단위(키 1.11)로 손 앞에 쥐어 줌
  const m = kind === 'broom' ? makeBroom() : makeRag();
  if (kind === 'broom') { m.scale.setScalar(.75); m.position.set(.13, .5, .18); m.rotation.x = -.82; } else m.position.set(.06, .1, .36);
  parent.add(m); return m;
}
const LEAF_GEO = new THREE.PlaneGeometry(.26, .16).rotateX(-Math.PI / 2), LEAF_COL = ['#c2701f', '#d99a2b', '#9e3f1e', '#7a4a22', '#c4a53a', '#b05a26', '#8c5a26', '#a8281e'];
const DUST_GEO = new THREE.CircleGeometry(.3, 16).rotateX(-Math.PI / 2);
const _cm = new THREE.Matrix4(), _cq = new THREE.Quaternion(), _ce = new THREE.Euler(), _cs = new THREE.Vector3(), _cp = new THREE.Vector3();
function leavesOf(T) { // 그 절 마당 낙엽 (처음 들를 때 만듦 · 법당 앞뒤와 탑 둘레는 비움)
  if (T.leaves) return T.leaves;
  const Y = T.YARD, Hh = T.hall, N = Math.round(Math.min(320, Math.max(140, (Y.x1 - Y.x0) * (Y.z1 - Y.z0) / 4.5))), list = [];
  const pg = T.pagoda ? W2L(T.pagoda.x, T.pagoda.z) : null;
  const heaps = Array.from({ length: 9 }, () => [Y.x0 + 1 + Math.random() * (Y.x1 - Y.x0 - 2), Y.z0 + 1 + Math.random() * (Y.z1 - Y.z0 - 2)]); // 바람에 몰린 낙엽 무더기
  heaps.push([Y.x0 + 1.2, Y.z1 - 2], [Y.x1 - 1.2, Y.z1 - 2], [Y.x0 + 1.2, (Y.z0 + Y.z1) / 2], [Y.x1 - 1.2, (Y.z0 + Y.z1) / 2]); // 담 밑
  const gss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.4;
  const spot = () => { for (let k = 0; k < 30; k++) { const h = Math.random() < .6 ? heaps[Math.floor(Math.random() * heaps.length)] : null; let x = h ? h[0] + gss() : Y.x0 + .9 + Math.random() * (Y.x1 - Y.x0 - 1.8), z = h ? h[1] + gss() : Y.z0 + .9 + Math.random() * (Y.z1 - Y.z0 - 1.8); x = Math.max(Y.x0 + .7, Math.min(Y.x1 - .7, x)); z = Math.max(Y.z0 + .7, Math.min(Y.z1 - .7, z)); if (Math.abs(x) < T.L / 2 + 1.6 && z > -T.D / 2 - 1.6 && z < T.D / 2 + 2.6) continue; if (Hh.isInside(x, z) || (pg && Math.hypot(x - pg[0], z - pg[1]) < (T.pagodaR || 2.4)) || !openGround(x, z)) continue; return [x, z]; } return null; };
  const im = new THREE.InstancedMesh(LEAF_GEO, new THREE.MeshStandardMaterial({ roughness: .9, side: THREE.DoubleSide }), N); im.frustumCulled = false; im.receiveShadow = true;
  const col = new THREE.Color();
  for (let i = 0; i < N; i++) { const p = spot() || [Y.x0 + 1, Y.z1 - 1], L = { x: p[0], z: p[1], y: 0, yaw: Math.random() * 6.28, tilt: (Math.random() - .5) * .5, s: .8 + Math.random() * .5, st: 0, t: 0, vx: 0, vy: 0, vz: 0 }; L.y = (Hh.heightAt ? Hh.heightAt(L.x, L.z) : 0) + .022; list.push(L); im.setColorAt(i, col.set(LEAF_COL[i % LEAF_COL.length]).offsetHSL(0, 0, (Math.random() - .5) * .08)); }
  T.site.add(im); T.leaves = { im, list, spot, regrow: 0 }; list.forEach((L, i) => setLeaf(T.leaves, i)); im.instanceMatrix.needsUpdate = true;
  return T.leaves;
}
function setLeaf(LV, i) { const L = LV.list[i], k = L.st === 2 ? 0 : L.s; _ce.set(L.tilt, L.yaw, L.st === 1 ? L.t * 9 : 0); _cq.setFromEuler(_ce); LV.im.setMatrixAt(i, _cm.compose(_cp.set(L.x, L.y, L.z), _cq, _cs.setScalar(k))); }
function sweepLeaves(T, cx, cz, r, dx, dz) { // 반지름 r 안의 낙엽을 (dx,dz) 쪽으로 쓸어 냄 → 쓴 장수
  const LV = T.leaves; if (!LV) return 0; let n = 0;
  LV.list.forEach((L, i) => { if (L.st !== 0 || Math.hypot(L.x - cx, L.z - cz) > r) return; L.st = 1; L.t = 0; L.vx = dx * 1.5 + (Math.random() - .5) * .8; L.vz = dz * 1.5 + (Math.random() - .5) * .8; L.vy = .8 + Math.random() * .5; n++; });
  return n;
}
function updateLeaves(T, dt) {
  const LV = T && T.leaves; if (!LV) return; let ch = false, gone = 0;
  LV.list.forEach((L, i) => {
    if (L.st === 1) { L.t += dt; L.x += L.vx * dt; L.z += L.vz * dt; L.y += L.vy * dt; L.vy -= 5 * dt; L.s *= 1 - dt * 2.2; if (L.t > .55) L.st = 2; setLeaf(LV, i); ch = true; }
    else if (L.st === 3) { L.t += dt; const k = Math.min(1, L.t / 2.8); L.y = L.y0 + (1 - k) * 2.6; L.x = L.fx + Math.sin(L.t * 2.6) * .25 * (1 - k); L.yaw += dt * 1.5; if (k >= 1) { L.st = 0; L.y = L.y0; } setLeaf(LV, i); ch = true; }
    else if (L.st === 2) gone++;
  });
  LV.regrow += dt; // 나무에서 낙엽이 다시 조금씩 떨어짐
  if (gone && LV.regrow > 4) { LV.regrow = 0; const i = LV.list.findIndex(L => L.st === 2), L = LV.list[i], p = LV.spot(); if (p) { L.fx = L.x = p[0]; L.z = p[1]; L.y0 = (T.hall.heightAt ? T.hall.heightAt(p[0], p[1]) : 0) + .022; L.s = .8 + Math.random() * .5; L.st = 3; L.t = 0; setLeaf(LV, i); ch = true; } }
  if (ch) LV.im.instanceMatrix.needsUpdate = true;
}
function dustOf(T) { // 법당 마루 먼지 자국
  if (T.dust) return T.dust;
  const H = T.hall, I = H.interior, list = [], N = 22, im = new THREE.InstancedMesh(DUST_GEO, new THREE.MeshStandardMaterial({ color: '#9d937f', roughness: 1, transparent: true, opacity: .42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), N);
  im.frustumCulled = false;
  const free = (x, z) => { const [wx, wz] = L2W(x, z); for (const [a, b] of [[0, 0], [.35, 0], [-.35, 0], [0, .35], [0, -.35]]) { const [px, pz] = L2W(x + a, z + b); if (blockedAt(px, pz, H.FY + .02)) return false; } return !(H.cushions || []).some(c => Math.hypot((c.lx ?? c.x) - x, (c.lz ?? c.z) - z) < .7); }; // 방석·기둥 위는 빼고 걸어 다닐 수 있는 마루에만
  for (let i = 0; i < N; i++) { let x = 0, z = 0; for (let k = 0; k < 40; k++) { x = I.ix0 + .6 + Math.random() * (I.ix1 - I.ix0 - 1.2); z = I.iz0 + .6 + Math.random() * (I.iz1 - I.iz0 - 1.2); if (z > H.altarZ + 1.3 && Math.hypot(x - H.bowSpot.lx, z - H.bowSpot.lz) > 1.1 && free(x, z)) break; } list.push({ x, z, s: .7 + Math.random() * .6, d: 1 }); }
  const D = { im, list, back: 0 }; list.forEach((P, i) => setDust(T, D, i)); T.site.add(im); T.dust = D; return D;
}
function setDust(T, D, i) { const P = D.list[i]; D.im.setMatrixAt(i, _cm.compose(_cp.set(P.x, T.hall.FY + .012, P.z), _cq.identity(), _cs.set(P.s * P.d + 1e-3, 1, P.s * P.d + 1e-3))); D.im.instanceMatrix.needsUpdate = true; }

let chore = null, choreSwish = 0, sweepW = 0; // 들고 있는 도구 { kind:'broom'|'rag', mesh, phase, tick, n }
function pickTool(kind) {
  if (sit) standUp(); if (tapdori) stopTapdori(); dropTool(true);
  const world = !!(kind === 'broom' && SWEEP_OK && glb), mesh = world ? makeBroom() : holdTool(glb ? glb.root : avatar, kind); if (world) scene.add(mesh); // 빗자루질 동작이 있으면 두 손에 쥐는 비
  chore = { kind, world, mesh, phase: 0, tick: 0, n: 0 };
  toast(kind === 'broom' ? '🧹 싸리비를 들었어요 · 마당을 걸어 다니면 앞의 낙엽이 쓸려요' : '🧽 걸레를 들었어요 · 마루의 먼지 자국 위로 다니면 깨끗이 닦여요', 3800);
  lastSent = ''; updateNear();
}
function dropTool(silent = false, msg = '') {
  if (!chore) return; chore.mesh.removeFromParent(); const k = chore.kind; chore = null; resetBody(); lastSent = '';
  if (!silent) toast(msg || (k === 'broom' ? '🧹 싸리비를 걸이에 두었어요' : '🧽 걸레를 내려놓았어요'), 2200); updateNear();
}
function choreDone(n, what) { // 운력 공덕
  const total = store.count('unryeok', n);
  if (chore && (chore.kind === 'broom' ? chore.n >= 30 : chore.n >= 8)) done('unryeok');
  if (Math.floor((total - n) / 25) !== Math.floor(total / 25)) toast(`🧹 ${what} · 지금까지 운력 ${total}번 · 수고하셨어요`, 2200);
}
function updateChore(dt, speed) {
  if (cur) updateLeaves(cur, dt);
  updateNpc(dt);
  if (!chore) return;
  const [lx, lz] = W2L(avatar.position.x, avatar.position.z), inside = hall && hall.isInside(lx, lz), moving = speed > .35;
  if (chore.kind === 'broom' && inside) return dropTool(false, '🧹 싸리비는 법당 밖에 두고 들어가요');
  if (chore.kind === 'rag' && !inside) return dropTool(false, '🧽 걸레는 법당 안에 두고 나왔어요');
  if (!sam && !pose && !sit) body.rotation.x += ((chore.kind === 'rag' ? .55 : chore.world ? 0 : .2) * (moving || chore.kind === 'rag' ? 1 : .5) - body.rotation.x) * Math.min(1, dt * 6); // 비질·걸레질 하느라 허리를 숙임 (빗자루질 동작이 있으면 동작대로)
  chore.phase += dt * (moving ? 3 + speed * 1.6 : 2.4); const sw = Math.sin(chore.phase); // 서 있어도 제자리에서 쓸고 닦음
  if (chore.kind === 'broom' && !chore.world) { chore.mesh.rotation.y = sw * (moving ? .55 : .4); chore.mesh.position.x = .13 + sw * .05; }
  else { chore.mesh.position.x = .06 + sw * .12; chore.mesh.position.z = .36 + Math.cos(chore.phase) * .05; }
  chore.tick += dt; if (chore.tick < (moving ? .1 : .28)) return; chore.tick = 0;
  const ry = avatar.rotation.y, fx = Math.sin(ry), fz = Math.cos(ry), sx = Math.cos(ry), sz = -Math.sin(ry);
  const tip = chore.world && chore.mesh.userData.tip, wx = tip ? tip.x : avatar.position.x + fx * .55 + sx * sw * .28, wz = tip ? tip.z : avatar.position.z + fz * .55 + sz * sw * .28; // 비 끝이 닿는 곳
  const [cx, cz] = W2L(wx, wz), [dx1, dz1] = W2L(wx + fx, wz + fz), dx = dx1 - cx, dz = dz1 - cz;
  if (chore.kind === 'broom') {
    const n = sweepLeaves(cur, cx, cz, .55, dx, dz);
    if (n) { chore.n += n; puff(wx, avatar.position.y + .05, wz); if (performance.now() - choreSwish > 230) { choreSwish = performance.now(); sound.sweep(); } choreDone(n, `낙엽 ${chore.n}장 쓸었어요`); }
    else if (performance.now() - choreSwish > 520 && Math.abs(sw) > .9) { choreSwish = performance.now(); sound.sweep(); }
  } else {
    const D = dustOf(cur); let n = 0;
    D.list.forEach((P, i) => { if (P.d <= 0 || Math.hypot(P.x - cx, P.z - cz) > .75) return; P.d = Math.max(0, P.d - .4); setDust(cur, D, i); if (P.d <= 0) n++; });
    if (performance.now() - choreSwish > 420) { choreSwish = performance.now(); sound.wipe(); }
    if (n) { chore.n += n; choreDone(n, `먼지 자국 ${chore.n}곳 닦았어요`); if (D.list.every(P => P.d <= 0)) toast('✨ 법당 마루가 반짝반짝해졌어요 · 부처님 앞이 환해요', 3200); }
  }
}
// 흙먼지 (쓸 때 살짝 피어오름)
const PUFFS = [];
let PUFF_TEX = null;
function puffTex() { // 가장자리가 흐린 동그란 흙먼지 (네모 판이 보이지 않게)
  if (PUFF_TEX) return PUFF_TEX;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.45, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  PUFF_TEX = new THREE.CanvasTexture(c); PUFF_TEX.colorSpace = THREE.SRGBColorSpace; return PUFF_TEX;
}
function puff(x, y, z) {
  let p = PUFFS.find(q => q.t >= 1);
  if (!p) { if (PUFFS.length > 14) return; p = { s: new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex(), color: '#d6c7a2', transparent: true, opacity: 0, depthWrite: false })), t: 1 }; scene.add(p.s); PUFFS.push(p); }
  p.t = 0; p.s.position.set(x + (Math.random() - .5) * .2, y + .08, z + (Math.random() - .5) * .2);
}
function updatePuffs(dt) { for (const p of PUFFS) { if (p.t >= 1) continue; p.t = Math.min(1, p.t + dt * 1.6); p.s.scale.setScalar(.18 + p.t * .55); p.s.position.y += dt * .35; p.s.material.opacity = .5 * (1 - p.t); } }

// 마당 쓰는 동자승 (지금 있는 절 마당을 천천히 돌며 비질)
let npc = null;
function ensureNpc(T) {
  if (!T || !T.leaves) return;
  if (!npc) {
    const g = new THREE.Group(); scene.add(g);
    npc = { g, glb: null, broom: null, label: nickSprite('🧹 마당 쓰는 동자승'), T: null, x: 0, z: 0, goal: null, wait: 1, phase: 0, tick: 0, amp: 0, st: { sit: 0, walkAmp: 0, speed: 0, hap: 0, kneel: 0, bend: .2, headX: .18, headZ: 0, closed: false, blink: false } };
    npc.label.scale.set(1.5, .33, 1); g.add(npc.label);
    loadMonkGLB(MONK_URL, { closedUrl: MONK_CLOSED }).then(m => { npc.glb = m; g.add(m.root); npc.broom = holdTool(m.root, 'broom'); }).catch(e => dbg('npcModelError', e.message));
  }
  if (npc.T === T) return;
  npc.T = T; const p = T.leaves.spot(); npc.x = p ? p[0] : 0; npc.z = p ? p[1] : T.YARD.z1 - 3; npc.goal = null; npc.wait = 1;
}
function updateNpc(dt) {
  if (!npc || !npc.T || npc.T !== cur) { if (npc) { npc.g.visible = false; if (npc.wbroom) npc.wbroom.visible = false; } return; }
  const T = cur, LV = T.leaves; npc.g.visible = true;
  if (!npc.goal && npc.wait <= 0) { // 다음에 쓸 곳: 사람과 떨어진 낙엽 (탑·법당을 가로지르지 않게)
    const [ax, az] = W2L(avatar.position.x, avatar.position.z), pg = T.pagoda ? W2L(T.pagoda.x, T.pagoda.z) : null;
    for (let k = 0; k < 12 && !npc.goal; k++) {
      const L = LV.list[Math.floor(Math.random() * LV.list.length)]; if (L.st !== 0 || Math.hypot(L.x - ax, L.z - az) < 2.5 || Math.hypot(L.x - npc.x, L.z - npc.z) > 9) continue;
      if (pg) { const vx = L.x - npc.x, vz = L.z - npc.z, l2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((pg[0] - npc.x) * vx + (pg[1] - npc.z) * vz) / l2)); if (Math.hypot(npc.x + vx * t - pg[0], npc.z + vz * t - pg[1]) < (T.pagodaR || 2.4) + .4) continue; }
      if (Math.min(Math.abs(L.x), Math.abs(npc.x)) < T.L / 2 + 1.6 && Math.min(L.z, npc.z) < T.D / 2 + 2.6) continue;
      if (!clearLine(npc.x, npc.z, L.x, L.z)) continue; // 계곡·석탑 난간·나무 울타리를 가로지르지 않게
      npc.goal = [L.x, L.z];
    }
    if (!npc.goal) npc.wait = 2;
  }
  let moving = false;
  if (npc.wait > 0) npc.wait -= dt;
  else if (npc.goal) {
    const vx = npc.goal[0] - npc.x, vz = npc.goal[1] - npc.z, d = Math.hypot(vx, vz);
    if (d < .45) { npc.goal = null; npc.wait = 1.5 + Math.random() * 2.5; }
    else {
      const sp = .7; let ux = vx / d, uz = vz / d;
      const busy = (lx, lz) => { const [wx, wz] = L2W(lx, lz); return Math.hypot(avatar.position.x - wx, avatar.position.z - wz) < .62 || othersNear(wx, wz, .62, true).length > 0; };
      if (busy(npc.goal[0], npc.goal[1])) { npc.goal = null; npc.wait = 1; } // 쓸 곳에 사람이 서 있으면 다른 곳으로
      else if (busy(npc.x + ux * .35, npc.z + uz * .35)) { // 앞에 사람이 있으면 옆으로 비켜 감 · 막히면 잠깐 기다림
        let ok = false; for (const a of [.9, -.9, 1.6, -1.6]) { const c = Math.cos(a), sn = Math.sin(a), rx = ux * c + uz * sn, rz = -ux * sn + uz * c; if (!busy(npc.x + rx * .35, npc.z + rz * .35)) { ux = rx; uz = rz; ok = true; break; } }
        if (!ok) npc.wait = .6;
      }
      if (npc.goal && npc.wait <= 0) { npc.x += ux * sp * dt; npc.z += uz * sp * dt; moving = true; npc.ry = Math.atan2(ux, uz); }
    }
  }
  { // 다른 분이 동자승 자리로 들어오면 동자승이 슬쩍 물러남 (내 아바타는 내 쪽에서 막힘)
    const [wx, wz] = L2W(npc.x, npc.z);
    for (const o of othersNear(wx, wz, MONK_R * 2, true)) { const dx = wx - o.x, dz = wz - o.z, dd = Math.hypot(dx, dz) || 1, push = (MONK_R * 2 - dd) * Math.min(1, dt * 4), [ax, az] = W2L(wx + dx / dd * push, wz + dz / dd * push); npc.x = ax; npc.z = az; }
  }
  // 걷거나 서서 쓸 때 비를 좌우로 · 앞의 낙엽을 쓸어 냄
  const sweeping = moving || npc.wait > 0; npc.phase += dt * (sweeping ? 4.2 : 0); const sw = Math.sin(npc.phase);
  if (npc.broom) { npc.broom.rotation.y = sw * .5; npc.broom.position.x = .13 + sw * .05; }
  npc.amp += ((moving ? 1 : 0) - npc.amp) * Math.min(1, dt * 5);
  const [wx, wz] = L2W(npc.x, npc.z);
  npc.g.position.set(wx, T.hall.heightAt ? T.hall.heightAt(npc.x, npc.z) : 0, wz); npc.g.rotation.y = npcYaw(npc.ry || 0); applyWob(npc.glb && npc.glb.root, dt, npc);
  npc.tick += dt; if (sweeping && npc.tick > .3) { npc.tick = 0; const fx = Math.sin(npc.ry || 0), fz = Math.cos(npc.ry || 0), tp = npc.wbroom && npc.wbroom.userData.tip, [tx, tz] = tp ? W2L(tp.x, tp.z) : [npc.x + fx * .5, npc.z + fz * .5]; if (sweepLeaves(T, tx, tz, .45, fx, fz)) { const [px, pz] = L2W(tx, tz); puff(px, npc.g.position.y + .05, pz); } }
  const useClip = SWEEP_OK && npc.glb && npc.glb.hasClip('sweep');
  if (useClip && !npc.wbroom) { if (npc.broom) npc.broom.removeFromParent(); npc.broom = null; npc.wbroom = makeBroom(); scene.add(npc.wbroom); } // 두 손으로 잡는 비로 바꿈
  const S = npc.st; S.walkAmp = npc.amp; S.speed = npc.amp * .8; S.bend = useClip ? 0 : .22; S.sweep = useClip ? 1 : 0; if (npc.glb) npc.glb.update(dt, S);
  if (npc.wbroom) { npc.g.updateMatrixWorld(true); npc.wbroom.visible = true; gripBroom(npc.wbroom, npc.glb, npc.g.position.y); }
}
function npcYaw(localYaw) { // 절 기준 방향 → 세상 방향
  const [ax, az] = L2W(0, 0), [bx, bz] = L2W(Math.sin(localYaw), Math.cos(localYaw)); return Math.atan2(bx - ax, bz - az);
}

// 스님 등록 팻말 글판
function monkSignTex(name) {
  const cv = document.createElement('canvas'); cv.width = 768; cv.height = 512; const c = cv.getContext('2d');
  c.fillStyle = '#f4e7c9'; c.fillRect(0, 0, 768, 512); c.strokeStyle = '#7a5232'; c.lineWidth = 12; c.strokeRect(14, 14, 740, 484);
  c.strokeStyle = '#c99a4a'; c.lineWidth = 3; c.strokeRect(32, 32, 704, 448);
  c.textAlign = 'center'; c.textBaseline = 'middle'; const F = '"Noto Sans KR","Apple SD Gothic Neo",sans-serif', fit = (t, px, w, wt) => { c.font = `${wt} ${px}px ${F}`; let p = px; while (c.measureText(t).width > w && p > 20) { p -= 2; c.font = `${wt} ${p}px ${F}`; } };
  c.fillStyle = '#9b3b2b'; fit('주지스님이신가요?', 74, 660, 800); c.fillText('주지스님이신가요?', 384, 128);
  c.fillStyle = '#3a2418'; fit(`${name} 스님으로 수월에 등록해 드려요`, 40, 660, 700); c.fillText(`${name} 스님으로 수월에 등록해 드려요`, 384, 236);
  fit('금빛 이름표와 가사로 순례객을 맞으실 수 있어요', 32, 660, 500); c.fillStyle = '#6d5232'; c.fillText('금빛 이름표와 가사로 순례객을 맞으실 수 있어요', 384, 298);
  c.fillStyle = '#9b3b2b'; c.beginPath(); if (c.roundRect) c.roundRect(164, 356, 440, 84, 42); else c.rect(164, 356, 440, 84); c.fill();
  c.fillStyle = '#fff'; fit('팻말 앞에서 스님 등록 신청', 36, 400, 700); c.fillText('팻말 앞에서 스님 등록 신청', 384, 399);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// 글자판 텍스처 (현판·표지석)
function nameTex(text, bg, fg, px = 44, sub = '', cw = 512) {
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = sub ? 256 : 138; const c = cv.getContext('2d');
  c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height);
  c.strokeStyle = fg; c.lineWidth = 6; c.strokeRect(10, 10, cv.width - 20, cv.height - 20);
  c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `bold ${px * 2}px "Noto Serif KR","Nanum Myeongjo",serif`; const tw = c.measureText(text).width; // 글이 길면 판에 맞게 줄임
  if (tw > cv.width - 48) c.font = `bold ${Math.floor(px * 2 * (cv.width - 48) / tw)}px "Noto Serif KR","Nanum Myeongjo",serif`;
  c.fillText(text, cv.width / 2, sub ? 100 : cv.height / 2 + 4);
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
  const g = new THREE.Group(); scene.add(g); COMMONS = g;
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
    if ([BELL, RACK, TILE].some(S => S && Math.abs(x * S.uz - z * S.ux) < 2.6 && x * S.ux + z * S.uz > 0)) continue; // 범종각·연등대 가는 쪽도 비움
    add(new THREE.CylinderGeometry(.05, .06, 2.6, 6), MAT.line, x, 1.3, z); add(lanGeo, MAT.lotus[i % MAT.lotus.length], x, 2.55, z, false);
  }
}
/* 사찰 담장 바깥 숲 (마당·길·사찰은 비움) */
function plantTrees() {
  // 권역마다 나무 종류가 다름 (전나무·소나무·대나무·동백·귤·은행·단풍), 사찰 주변엔 그 절의 숲(선운사 동백, 쌍계사 차밭 등)
  const kit = treeKit(), W = ENV.trees || { fir: .5, broad: .5 }, N = ENV.treeN || 900;
  const free = (x, z) => {
    const r = Math.hypot(x, z); if (r < 11) return false;
    for (const S of [BELL, RACK, TILE]) if (S && Math.hypot(x - S.x, z - S.z) < 6.5) return false; // 범종각·연등대·기와 불사 가림 방지
    for (const T of temples) {
      const along = x * T.ux + z * T.uz, side = Math.abs(x * T.uz - z * T.ux);
      if (along > 0 && along < RG + 2 && side < 3.2) return false; // 박석길
      setFrame(T); const [lx, lz] = W2L(x, z), Y = T.YARD;
      if (lx > Y.x0 - 2.5 && lx < Y.x1 + 2.5 && lz > Y.z0 - 2.5 && lz < Y.z1 + 2.5) return false;
      const S = T.seaRect; if (S && lz < S.z1 + 1 && lz > S.z0 && Math.abs(lx) < S.x) return false; // 바다
      if (S && S.cove && lx > S.cove.x0 && lx < S.cove.x1 && lz > S.cove.z0 && lz < S.cove.z1) return false; // 모래 해변
      if (S && S.inlet && lx > S.inlet.x0 && lx < S.inlet.x1 && lz > S.inlet.z0 && lz < S.inlet.z1) return false; // 해동용궁사 물길
    }
    return true;
  };
  let n = 0, tries = 0;
  while (n < N && tries < 20000) {
    tries++;
    const a = Math.random() * Math.PI * 2, r = 9 + Math.pow(Math.random(), .8) * (RB + 70);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!free(x, z)) continue;
    kit.species[kit.pick(W)](x, z, .8 + Math.random() * .9); n++;
  }
  // 절마다 둘레 숲
  for (const T of temples) {
    const gv = T.style && T.style.grove; if (!gv || !kit.species[gv]) continue;
    const Y = T.YARD; let m = 0, t2 = 0;
    while (m < (gv === 'tea' ? 70 : 55) && t2 < 3000) {
      t2++; const lx = Y.x0 - 12 + Math.random() * (Y.x1 - Y.x0 + 24), lz = Y.z0 - 14 + Math.random() * (Y.z1 - Y.z0 + 12);
      setFrame(T); const [x, z] = L2W(lx, lz); if (!free(x, z)) continue;
      kit.species[gv](x, z, gv === 'tea' ? 1 : .8 + Math.random() * .6); m++;
    }
  }
  if (cur) setFrame(cur);
  TREE_SOLIDS = kit.trunks(); kit.commit(scene); buildSolids();
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
/* ───────── 아기 스님끼리 부딪힘: 나·다른 분·동자승이 서로 겹치지 않게 ─────────
   각자 자기 아바타만 비켜남(다가간 쪽이 막힘). 같은 자리에 겹쳐 생기면 서로 반대쪽으로 서서히 벌어짐.
   앉기·삼배·종 치기·탑돌이 중인 사람은 밀리지 않음. 세게 부딪히면 둘 다 살짝 휘청 */
const MONK_R = .27; // 아기 스님 한 명이 차지하는 반지름 (둘이면 0.54m)
let myWob = 0, myWobPh = 0, bumpT = 0;
function sepAngle(otherId) { // 정확히 같은 자리일 때 벌어질 방향: 두 사람이 같은 각을 계산하고 서로 반대로
  const a = ME.id < otherId ? ME.id + otherId : otherId + ME.id; let h = 7; for (let i = 0; i < a.length; i++) h = (h * 31 + a.charCodeAt(i)) | 0;
  return (h >>> 0) / 4294967296 * Math.PI * 2 + (ME.id < otherId ? 0 : Math.PI);
}
function othersNear(x, z, r, skipNpc) { // (x,z) 반지름 r 안의 다른 아기 스님들 (월드)
  const out = [];
  for (const P of peers.values()) if (P.g.visible && P.last) { const d = Math.hypot(P.g.position.x - x, P.g.position.z - z); if (d < r) out.push({ x: P.g.position.x, z: P.g.position.z, y: P.g.position.y, d, P }); }
  if (!skipNpc && npc && npc.g.visible) { const d = Math.hypot(npc.g.position.x - x, npc.g.position.z - z); if (d < r) out.push({ x: npc.g.position.x, z: npc.g.position.z, y: npc.g.position.y, d, P: null, npc: true }); }
  return out;
}
function wobble(k) { myWob = Math.max(myWob, k); myWobPh = 0; }
function peerBlock(dt, moving, mx, mz) {
  if (sit || sam || bellHold || tapdori || pose === 'bow') return; // 이럴 땐 내가 비켜나지 않음 (다가온 쪽이 막힘)
  const p = avatar.position, minD = MONK_R * 2;
  for (const o of othersNear(p.x, p.z, minD)) {
    if (Math.abs(o.y - p.y) > .9) continue; // 단 위·아래로 높이가 다르면 지나감
    let dx = p.x - o.x, dz = p.z - o.z, d = o.d;
    if (d < 1e-3) { const a = o.P ? sepAngle(o.P.id) : Math.random() * 6.283; dx = Math.sin(a); dz = Math.cos(a); d = 1e-3; } else { dx /= d; dz /= d; }
    const over = minD - d, k = moving ? 1 : Math.min(1, dt * 3), nx = p.x + dx * over * k, nz = p.z + dz * over * k; // 걷다 닿으면 바로 막고, 서 있다 겹치면 서서히 벌어짐
    if (!blockedAt(nx, nz, feetY)) { p.x = nx; p.z = nz; } else if (!blockedAt(nx, p.z, feetY)) p.x = nx; else if (!blockedAt(p.x, nz, feetY)) p.z = nz;
    // 걸어가다 정면으로 부딪힘: 살짝 휘청 + 퉁 (상대에게도 알림)
    const into = moving ? -(mx * dx + mz * dz) : 0, key = o.P ? o.P.id : 'npc', was = o.P ? o.P.touch : npc.touch;
    if (into > .55 && !was && performance.now() - bumpT > 700) {
      bumpT = performance.now(); wobble(.2); sound.bump();
      if (o.P) { o.P.wob = .2; o.P.wobPh = 0; if (NET) NET.emit('bump', { to: o.P.id }); } else { npc.wob = .2; npc.wobPh = 0; }
    }
    if (o.P) o.P.touchT = performance.now(); else npc.touchT = performance.now();
  }
  for (const P of peers.values()) P.touch = performance.now() - (P.touchT || 0) < 150;
  if (npc) npc.touch = performance.now() - (npc.touchT || 0) < 150;
  if (!wsClose) pushOut(p, 0.42); clampBound(p);
}
function onBumped(p) { // 다른 분이 나에게 부딪힘: 나도 살짝 휘청하고 한 뼘 밀림
  if (p.to !== ME.id) return; wobble(.18);
  const P = peers.get(p.id); if (!P || sit || sam || bellHold || tapdori || pose === 'bow') return;
  const a = avatar.position, dx = a.x - P.g.position.x, dz = a.z - P.g.position.z, d = Math.hypot(dx, dz) || 1, nx = a.x + dx / d * .12, nz = a.z + dz / d * .12;
  if (!blockedAt(nx, nz, feetY)) { a.x = nx; a.z = nz; }
}
function applyWob(root, dt, o) { // 휘청: 발을 축으로 좌우로 두어 번 흔들리다 멈춤
  if (!root) return; if ((o.wob || 0) < .004) { if (root.rotation.z) root.rotation.z = 0; return; }
  o.wobPh = (o.wobPh || 0) + dt * 14; o.wob *= Math.exp(-dt * 4); root.rotation.z = Math.sin(o.wobPh) * o.wob;
}
/* ───────── 부딪힘·밟고 서기: 화면의 모든 물체를 하나의 덩어리(바닥 모양 + 높이)로 봄 ─────────
   낮은 것(계단·받침·광장 단·바위)은 걸어 오르고, 조금 높은 것은 Space로 뛰어 올라가고, 높은 것은 못 지나감 (스노클링 메타버스와 같은 방식) */
const STEP = .6, BODY_R = .24, HEAD = 1.05; // 걸어 오를 수 있는 턱 높이(계단 두 칸까지) · 몸 반지름 · 머리 높이
let TREE_SOLIDS = [], COMMONS = null;
const SOLID = { list: [], grid: new Map(), cell: 3 };
const ROUND = new Set(['CylinderGeometry', 'ConeGeometry', 'SphereGeometry', 'IcosahedronGeometry', 'DodecahedronGeometry', 'OctahedronGeometry', 'LatheGeometry', 'CapsuleGeometry']);
const SKIPG = new Set(['PlaneGeometry', 'CircleGeometry', 'RingGeometry', 'TorusGeometry', 'ShapeGeometry']);
function solidAdd(o) {
  const R = (o.t === 'c' ? o.r : Math.hypot(o.hu, o.hv)) + BODY_R + .1, C = SOLID.cell, i = SOLID.list.length; SOLID.list.push(o);
  for (let gx = Math.floor((o.cx - R) / C); gx <= Math.floor((o.cx + R) / C); gx++) for (let gz = Math.floor((o.cz - R) / C); gz <= Math.floor((o.cz + R) / C); gz++) {
    const k = gx * 73856093 ^ gz * 19349663; let a = SOLID.grid.get(k); if (!a) SOLID.grid.set(k, a = []); a.push(i);
  }
}
const _sb = new THREE.Box3(), _sv = new THREE.Vector3(), _sc = new THREE.Vector3(), _sh = new THREE.Vector3();
function solidsFrom(root) {
  root.updateMatrixWorld(true);
  root.traverseVisible(m => {
    if (!m.isMesh || m.isInstancedMesh) return;
    const g = m.geometry, t = g.type; if (SKIPG.has(t)) return;
    const mat = Array.isArray(m.material) ? m.material[0] : m.material; if (!mat || (mat.transparent && mat.opacity < .9)) return;
    if (!g.boundingBox) g.computeBoundingBox(); const bb = g.boundingBox, e = m.matrixWorld.elements;
    bb.getCenter(_sc); bb.getSize(_sh).multiplyScalar(.5); _sv.copy(_sc).applyMatrix4(m.matrixWorld);
    const sx = Math.hypot(e[0], e[1], e[2]), sy = Math.hypot(e[4], e[5], e[6]), sz = Math.hypot(e[8], e[9], e[10]);
    const upright = sy > 1e-6 && e[5] / sy > .985;
    let o;
    if (upright) {
      const hy = _sh.y * sy, hu = _sh.x * sx, hv = _sh.z * sz;
      if (ROUND.has(t)) o = { t: 'c', cx: _sv.x, cz: _sv.z, r: Math.max(hu, hv) * (t === 'IcosahedronGeometry' || t === 'SphereGeometry' || t === 'DodecahedronGeometry' ? .85 : 1) };
      else { const ux = e[0] / (sx || 1), uz = e[2] / (sx || 1); o = { t: 'b', cx: _sv.x, cz: _sv.z, c: ux, s: uz, hu, hv }; }
      o.y0 = _sv.y - hy; o.y1 = _sv.y + hy;
    } else { // 비스듬히 놓인 것(다리 판·누운 기둥): 세계 좌표 상자
      _sb.copy(bb).applyMatrix4(m.matrixWorld); _sb.getCenter(_sc); _sb.getSize(_sh).multiplyScalar(.5);
      o = { t: 'b', cx: _sc.x, cz: _sc.z, c: 1, s: 0, hu: _sh.x, hv: _sh.z, y0: _sb.min.y, y1: _sb.max.y };
    }
    if (o.y1 < .06) return;                                         // 바닥에 붙은 판
    if ((o.t === 'c' ? o.r : Math.max(o.hu, o.hv)) < .045) return;   // 실 같은 것
    if ((o.t === 'c' ? o.r : Math.min(o.hu, o.hv)) > 60) return;     // 먼 산·바다
    solidAdd(o);
  });
}
function buildSolids() {
  SOLID.list = []; SOLID.grid = new Map();
  for (const T of temples) if (T.site) solidsFrom(T.site);
  if (COMMONS) solidsFrom(COMMONS);
  for (const [x, z, r, h] of TREE_SOLIDS) solidAdd({ t: 'c', cx: x, cz: z, r, y0: 0, y1: h });
  dbg('solids', SOLID.list.length);
}
function solidsNear(x, z) { const C = SOLID.cell; return SOLID.grid.get(Math.floor(x / C) * 73856093 ^ Math.floor(z / C) * 19349663) || []; }
function solidHit(o, x, z, pad) {
  const dx = x - o.cx, dz = z - o.cz;
  if (o.t === 'c') return dx * dx + dz * dz < (o.r + pad) * (o.r + pad);
  const du = dx * o.c + dz * o.s, dv = -dx * o.s + dz * o.c; return Math.abs(du) < o.hu + pad && Math.abs(dv) < o.hv + pad;
}
// 그 자리에서 밟고 설 높이 (지금 발 높이에서 오를 수 있는 것 중 가장 높은 윗면)
function groundAt(x, z, feet) {
  let h = 0; if (hall) { const [lx, lz] = W2L(x, z); h = hall.heightAt(lx, lz); }
  for (const i of solidsNear(x, z)) { const o = SOLID.list[i]; if (o.y1 > h && o.y1 <= feet + STEP && o.y0 < feet + STEP && solidHit(o, x, z, 0)) h = o.y1; }
  return h;
}
// 몸이 들어갈 수 없는 자리인가 (발보다 STEP 넘게 높고, 머리보다 낮게 시작하는 물체)
function blockedAt(x, z, feet) {
  for (const i of solidsNear(x, z)) { const o = SOLID.list[i]; if (o.y1 > feet + STEP && o.y0 < feet + HEAD && solidHit(o, x, z, BODY_R)) return true; }
  if (hall) { const [lx, lz] = W2L(x, z); if (hall.heightAt(lx, lz) > feet + STEP) return true; }
  return false;
}
function clampBound(p) {
  const r = Math.hypot(p.x, p.z), max = RB - 4;
  if (r > max) { p.x *= max / r; p.z *= max / r; }
}

/* ───────── 아바타 (아기 스님) ───────── */
const { avatar, body, headG, torso, kasa, legs, eyeGroups, closedEyes, faceOpen, placeArms, faceFill } = createBabyMonk();
scene.add(avatar, faceFill, faceFill.target);
// Meshy로 만든 아기 스님 3D 모델(시트 그대로). 못 불러오면 지금의 코드 아바타를 그대로 씀
const MONK_URL = new URLSearchParams(location.search).get('monk') || './assets/baby-monk.glb'; // 이 사이트에서 직접 (외부 CDN이 큰 저장소를 막는 일이 있어서)
const MONK_CLOSED = './assets/monk-eyes-closed.webp'; // 눈 감은 얼굴 (Meshy AI 텍스처 편집)
let glb = null;
const glbReady = loadMonkGLB(MONK_URL, { closedUrl: MONK_CLOSED, onProgress: f => { const m = document.querySelector('#loadBar b'); if (m) m.style.width = Math.max(12, Math.round(f * 100)) + '%'; } })
  .then(m => { glb = m; avatar.add(m.root); body.visible = false; dbg('monk', m.info); if (monkGlbWait || myMonk()) addKasaya(m); return m; })
  .catch(e => { dbg('monkError', e.message); return null; });
let blinkT = 2.5, idleT = 0;

// 불상·보살상 (Meshy로 만든 3D 조형 — 특정 실제 불상을 본뜨지 않고 일반 도상 설명만으로 새로 만든 모델)
// sakya 석가(항마촉지인) · amita 아미타(선정인) · yaksa 약사(약합) · biro 비로자나(지권인) · bosal 앉은 보살 · bosalS 선 보살
// disciple 선 제자 · chunsu 천수관음 · buddhaS 선 부처 · budai 포대화상. 아직 없는 모델은 비슷한 모델이나 코드로 그린 자리표시로 대신함
const ASSET = 'https://cdn.jsdelivr.net/gh/kail525k/temple-meta@';
const STATUE_URL = QS.get('statue') || './assets/buddha.glb';
const KIT_SHA = QS.get('kits') || '5a35011cef232382400aa936e99f3a9cc8ae72ae';
const KIT_HAVE = new Set(['amita', 'biro', 'yaksa', 'bosal', 'bosalS', 'disciple', 'chunsu', 'buddhaS', 'budai', 'yongwang', 'dongja', 'wabul', 'buldu']);
const KIT_URL = k => k === 'sakya' ? STATUE_URL : KIT_HAVE.has(k) ? `./assets/statue-${k}.glb?v=${KIT_SHA.slice(0, 7)}` : null; // 이 사이트에서 직접 (jsDelivr가 큰 저장소를 403으로 막음)
const KIT_FALLBACK = { amita: 'sakya', yaksa: 'sakya', biro: 'sakya', bosal: 'sakya', dongja: 'disciple' };
const KIT_H = { sakya: 2.0, amita: 2.0, yaksa: 2.0, biro: 2.0, bosal: 1.9, bosalS: 2.45, disciple: 2.1, chunsu: 2.5, buddhaS: 2.6, budai: 2.0, wabul: 2.6, yongwang: 2.6, dongja: 1.5, buldu: 6 };
const kitCache = new Map();
function kitFor(k) {
  if (!kitCache.has(k)) {
    const url = KIT_URL(k), local = KIT_HAVE.has(k) ? `${ASSET}${KIT_SHA}/assets/statue-${k}.glb` : null; // 사이트에서 못 받으면 CDN으로 한 번 더
    const p = url ? loadStatue(url, renderer).catch(e => { dbg('kitError.' + k, e.message); return local ? loadStatue(local, renderer).catch(() => null) : null; }) : Promise.resolve(null);
    kitCache.set(k, p.then(kit => kit || (KIT_FALLBACK[k] ? kitFor(KIT_FALLBACK[k]) : null)));
  }
  return kitCache.get(k);
}
const TINT = (() => { const cache = { bronze: new Map(), stone: new Map(), gold: new Map(), marble: new Map(), wood: new Map() };
  const mk = (kind, fn) => m => { const c = cache[kind]; if (!c.has(m)) { const k = m.clone(); fn(k); c.set(m, k); } return c.get(m); };
  return {
    bronze: mk('bronze', k => { k.color.set('#8c7650'); k.metalness = .75; k.roughness = .42; k.emissiveIntensity = .05; }),
    stone: mk('stone', k => { k.map = null; k.emissiveMap = null; k.emissiveIntensity = 0; k.color.set('#a7a29a'); k.metalness = 0; k.roughness = .95; k.envMapIntensity = .25; }),
    gold: mk('gold', k => { k.color.set('#ffd98a'); k.metalness = .8; k.roughness = .3; k.emissiveIntensity = .22; }),
    wood: mk('wood', k => { k.color.set('#c99566'); k.metalness = .05; k.roughness = .62; k.emissiveIntensity = .08; }), // 향나무 목조 (와우정사 와불)
    marble: mk('marble', k => { k.map = null; k.emissiveMap = null; k.emissiveIntensity = 0; k.color.set('#f1eee8'); k.metalness = 0; k.roughness = .55; k.envMapIntensity = .4; }),
  };
})();
const tintObj = (obj, kind) => { if (kind) obj.traverse(o => { if (!o.isMesh) return; o.material = TINT[kind](o.material); if (kind === 'stone') o.castShadow = false; }); };
const isHalo = ch => { const g = ch.geometry; return g && (g.type === 'CircleGeometry' || (g.type === 'TorusGeometry' && g.parameters.radius >= .4)); };
async function enshrineStatues() {
  let n = 0;
  const jobs = [];
  for (const T of temples) for (const sl of (T.hall && T.hall.slots) || []) {
    if (sl.skip) continue;
    jobs.push(kitFor(sl.k || 'sakya').then(kit => {
      if (!kit) return; // 모델이 없으면 코드로 그린 자리표시를 그대로 둠
      const old = sl.obj, s = sl.s;
      old.children.forEach(ch => { if (!isHalo(ch)) ch.visible = false; }); // 두광·신광(뒤쪽 원판)만 남김
      const st = kit.make((KIT_H[sl.k] || 2) * s), d = st.userData.depth;
      if (sl.k === 'wabul') tintObj(st, (T.style && T.style.wabulTint) || null);
      const back = sl.z - .27 * s, cz = Math.min(back + d / 2, sl.z + .95 - d / 2);
      st.position.set(sl.x, sl.y, cz);
      old.parent.add(st); sl.statue = st; n++;
    }));
  }
  // 바깥 불상: 신흥사 통일대불(청동), 관음사 길가 돌부처
  jobs.push(kitFor('sakya').then(kit => {
    if (!kit) return;
    for (const T of temples) {
      if (T.bigBuddha && T.site) { const b = T.bigBuddha, st = kit.make(b.h); tintObj(st, 'bronze'); st.position.set(b.lx, b.ly, b.lz); T.site.add(st); b.statue = st; n++; }
      if (T.mini && T.site) for (const m of T.mini) { const st = kit.make(.95); tintObj(st, 'stone'); st.position.set(m.lx, m.ly, m.lz); st.rotation.y = m.lx > 0 ? -Math.PI / 2 : Math.PI / 2; T.site.add(st); n++; }
    }
  }));
  // 바깥 보살상·입불·포대화상 (해수관음대불, 지혜관음, 큰 입불 등)
  for (const T of temples) for (const f of T.figs || []) jobs.push(kitFor(f.k).then(kit => {
    if (!kit || !T.site) return;
    const st = kit.make(f.h); tintObj(st, f.tint); st.position.set(f.lx, f.ly, f.lz); st.rotation.y = f.ry || 0; T.site.add(st); f.statue = st;
    (f.ph || []).forEach(o => { o.visible = false; }); n++;
  }));
  await Promise.all(jobs);
  for (const T of temples) T.occ = null; // 불상이 들어왔으니 카메라 가림 목록을 다시 모음
  buildSolids();                           // 불상·받침도 부딪히는 물체로
  dbg('statues', n); statuesDone = true;
}
let statuesDone = false;

/* ───────── 입력 ───────── */
const keys = {};
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || rituals.open || isBoardOpen()) return;
  keys[e.code] = true;
  if (e.code === 'KeyE') useContext();
  if (e.code === 'Space') e.preventDefault();
  if (bellHold && (e.code === 'KeyS' || e.code === 'ArrowDown')) bellPullStart();
  if (e.code === 'KeyC') toggleSit();
  if (e.code === 'BracketLeft') setSens(sensLv - 1);
  if (e.code === 'BracketRight') setSens(sensLv + 1);
  if (e.code === 'KeyG') document.getElementById('btnHall').click();
  if (e.code === 'KeyH') document.getElementById('btnHome').click();
  if (e.code === 'KeyM') openMap();
  if (e.code === 'Tab') { e.preventDefault(); openRegions(); }
  if (e.code === 'KeyF') { fpv = !fpv; toast(fpv ? '👀 아기 스님 눈으로 봐요 (F 다시 누르면 돌아와요)' : '🎥 3인칭 시점', 1600); }
  if (e.code === 'Digit1') doHap(); if (e.code === 'Digit2') tryBow(); if (e.code === 'Digit3') toggleSit(); if (e.code === 'Digit4') rituals.openMoktak(); if (e.code === 'Digit5') rituals.openBeads();
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'KeyS' || e.code === 'ArrowDown') bellPullEnd(); });
let yaw = Math.PI, pitch = 0.24, dist = 6;
let feetY = 0, vy = 0, grounded = true, jumpLatch = false, lastY = 0, jumpBtn = false, fpv = false; // 점프·1인칭
const drag = { id: null, x: 0, y: 0 }; let lookT = 0; // lookT: 마지막으로 화면을 끌어 둘러본 때
const ZMIN = 1.4, ZMAX = 110; // 확대·축소 범위 (얼굴 가까이 ~ 권역을 높이서 내려다보기)
const PMIN = -0.85, PMAX = 1.48; // 보는 각도: 아래에서 올려다보기(-) ~ 거의 위에서 내려다보기
const ptrs = new Map(); let pinchD = 0, pinchDist0 = 0, downInfo = null;
canvas.addEventListener('pointerdown', e => {
  if (bellHold && e.button === 0 && (e.pointerType === 'mouse' || isLocked())) { bellPullStart(); return; }
  if (e.pointerType !== 'mouse' && joy.id === null && inJoyZone(e.clientX, e.clientY)) { startJoy(e); return; } // 왼쪽 아래 = 이동 조이스틱
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); pinchDist0 = dist; drag.id = null; downInfo = null; return; }
  if (drag.id !== null) return; drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY; canvas.setPointerCapture(e.pointerId);
  downInfo = { x: e.clientX, y: e.clientY, t: performance.now() };
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId === joy.id) { moveJoy(e); return; }
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size >= 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinchD > 0) dist = clamp(pinchDist0 * pinchD / Math.max(20, d), ZMIN, ZMAX); return; }
  if (e.pointerId !== drag.id || isLocked()) return; lookT = performance.now(); yaw -= (e.clientX - drag.x) * 0.005 * SENS(); pitch = clamp(pitch + (e.clientY - drag.y) * 0.005 * SENS(), PMIN, PMAX); drag.x = e.clientX; drag.y = e.clientY;
});
const endDrag = e => {
  if (e.pointerId === joy.id) { endJoy(e); return; }
  if (bellHold && bellHold.pulling && e.button === 0 && e.pointerType === 'mouse') { bellPullEnd(); ptrs.delete(e.pointerId); return; }
  ptrs.delete(e.pointerId); if (ptrs.size < 2) pinchD = 0;
  if (e.pointerId === drag.id) {
    drag.id = null;
    const tap = e.type === 'pointerup' && downInfo && Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y) < 7 && performance.now() - downInfo.t < 400;
    if (tap) tapAt(e);
    downInfo = null;
  }
};
// 화면을 톡 눌렀을 때: 휴휴암 연화대에서 밥·방생 양동이를 들고 있으면 누른 쪽 물로 던짐, 아니면 PC는 마우스 시점 · 터치는 누른 곳으로 걷기
function tapAt(e) {
  if (fishAimPt) {
    const r = canvas.getBoundingClientRect(), pt = isLocked() ? fishAimPt : fishAimAt((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (pt) { if (fishFood > 0) throwFish(pt); else releaseFish(pt); return; }
  }
  if (FINE && e.pointerType === 'mouse') { if (isLocked()) { if (e.button === 0) clickMove(e, true); } else lockMouse(e); } // PC: 둘러보는 중 왼쪽 클릭 → 가운데 점 자리로 걸어감
  else clickMove(e);
}
// 마우스 감도 10단계 ([ ] 키 또는 왼쪽 아래 −/+), 기기에 저장
const SENS_STEPS = [.35, .5, .65, .8, 1, 1.2, 1.45, 1.75, 2.1, 2.5];
let sensLv = (() => { try { const v = +localStorage.getItem('templeMeta.sens'); return v >= 1 && v <= 10 ? v : 5; } catch (e) { return 5; } })();
const SENS = () => SENS_STEPS[sensLv - 1];
function setSens(lv) {
  sensLv = Math.max(1, Math.min(10, lv)); try { localStorage.setItem('templeMeta.sens', sensLv); } catch (e) { }
  const el = document.getElementById('sensVal'); if (el) el.textContent = sensLv;
  toast(`🖱️ 마우스 감도 ${sensLv} / 10`, 1100);
}
{ const v = document.getElementById('sensVal'); if (v) v.textContent = sensLv;
  const dn = document.getElementById('sensDown'), up = document.getElementById('sensUp');
  if (dn) dn.onclick = () => setSens(sensLv - 1); if (up) up.onclick = () => setSens(sensLv + 1); }
// 3인칭 마우스 시점 (총게임처럼): 화면을 한 번 누르면 마우스로 바로 둘러보고 WASD로 이동, Esc로 해제
const FINE = matchMedia('(pointer: fine)').matches;
const isLocked = () => document.pointerLockElement === canvas;
function lockMouse(ev) {
  if (rituals.open || isLocked()) return;
  const fail = err => { dbg('pointerLock', String(err && err.message || err || 'denied')); if (ev) clickMove(ev); }; // 브라우저가 막으면 예전처럼 누른 곳으로 걷기
  if (!canvas.requestPointerLock) return fail('unsupported');
  try { const p = canvas.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => { try { const q = canvas.requestPointerLock(); if (q && q.catch) q.catch(fail); } catch (e) { fail(e); } }); } catch (e) { fail(e); }
}
document.addEventListener('pointerlockerror', () => dbg('pointerLock', 'error'));
addEventListener('mousemove', e => {
  if (!isLocked()) return;
  yaw -= e.movementX * 0.0021 * SENS(); pitch = clamp(pitch + e.movementY * 0.0021 * SENS(), PMIN, PMAX); intro = -1;
});
document.addEventListener('pointerlockchange', () => {
  document.body.classList.toggle('locked', isLocked());
  if (isLocked() && !store.d.tpsTip) { store.d.tpsTip = 1; store.save(); toast('🖱️ 마우스로 둘러보고 WASD로 걸어요 · Esc를 누르면 마우스가 풀려요', 4200); }
});
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && e.button === 0) bellPullEnd(); }); addEventListener('blur', () => bellPullEnd());
canvas.addEventListener('wheel', e => { e.preventDefault(); zoomBy(Math.exp(e.deltaY * .0024)); }, { passive: false });
// 휠: 한 번에 크게 확대·축소 · 끝까지 당기면 1인칭(FPS), 1인칭에서 밀면 다시 3인칭
let zoomLatch = 0;
function zoomBy(f) {
  const now = performance.now();
  if (fpv && f > 1) { if (now - zoomLatch > 180) { fpv = false; dist = 2.2; zoomLatch = now; } return; }
  if (!fpv && f < 1 && dist <= ZMIN + .01) { if (now - zoomLatch > 180 && !sit) { fpv = true; zoomLatch = now; } return; }
  dist = clamp(dist * f, ZMIN, ZMAX); zoomLatch = now;
}
// 오른쪽 버튼을 누르고 있으면 조준하듯 확대 (FPS 정조준처럼)
let aimZoom = false;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e => { if (e.button === 2) aimZoom = true; });
addEventListener('mouseup', e => { if (e.button === 2) aimZoom = false; });
addEventListener('blur', () => { aimZoom = false; });
addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; if (e.code === 'Equal' || e.code === 'NumpadAdd') zoomBy(1 / 1.45); if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomBy(1.45); });
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
if (document.body.classList.contains('touch')) { // 휴대폰: 사찰 이름 카드는 한 줄로 접어 두고, 누르면 설명·출처·상태까지 펼침
  const tt = document.getElementById('title'), at = document.getElementById('attrib'); if (at) tt.appendChild(at);
  tt.addEventListener('click', e => { if (!e.target.closest('button,a')) tt.classList.toggle('open'); });
}
const joyEl = document.getElementById('joy'), knob = document.getElementById('knob');
{ const jb = document.getElementById('btnJump'); if (jb) { const on = e => { e.preventDefault(); jumpBtn = true; }, off = () => { jumpBtn = false; }; jb.addEventListener('pointerdown', on); jb.addEventListener('pointerup', off); jb.addEventListener('pointercancel', off); jb.addEventListener('pointerleave', off); } }
/* 휴대폰 이동 조이스틱: 맨 아래 왼쪽에 고정 (손가락을 멀리 끌어도 원은 밀려 올라가지 않고 그 자리)
   원 근처를 누르면 잡힘 · 살짝 밀면 천천히, 끝까지 밀면 서서히 빨라짐 */
const joy = { id: null, x: 0, y: 0, ox: 0, oy: 0, sx: 0, sy: 0, t0: 0, far: 0, r: 56, edge: 0 }, JOY_DEAD = .14;
// 휴대폰 걷기 빠르기 (☰ 메뉴에서 바꿈 · 기기에 저장): 끝까지 밀었을 때 걷는 빠르기. 끝에 1초 넘게 대고 있으면 서서히 달림
const WALK_LV = [['느리게', 2.0], ['보통', 2.7], ['빠르게', 3.5]];
let walkLv = (() => { try { const v = +localStorage.getItem('suwol.walkLv'); return v >= 0 && v < 3 && localStorage.getItem('suwol.walkLv') !== null ? v : 1; } catch (e) { return 1; } })();
addEventListener('suwol:walk', () => { walkLv = (walkLv + 1) % 3; try { localStorage.setItem('suwol.walkLv', walkLv); } catch (e) { } toast(`🚶 걷기 빠르기: ${WALK_LV[walkLv][0]} · 조이스틱을 끝까지 1초 넘게 밀면 달려요`, 2600); });
window.__walkLabel = () => '걷기 ' + WALK_LV[walkLv][0];
const joyCenter = () => { const r = joyEl.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width / 2]; };
const inJoyZone = (x, y) => { if (!document.body.classList.contains('touch') || !joyEl.offsetWidth) return false; const [cx, cy, h] = joyCenter(); return Math.hypot(x - cx, y - cy) < h + 30; };
function startJoy(e) {
  const [cx, cy, h] = joyCenter();
  joy.id = e.pointerId; joy.ox = cx; joy.oy = cy; joy.r = Math.max(48, h); joy.sx = e.clientX; joy.sy = e.clientY; joy.t0 = performance.now(); joy.far = 0; joy.x = joy.y = 0; joy.edge = 0;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
  joyEl.classList.add('live'); knob.style.transform = ''; moveJoy(e);
}
function moveJoy(e) {
  let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy, l = Math.hypot(dx, dy);
  joy.far = Math.max(joy.far, Math.hypot(e.clientX - joy.sx, e.clientY - joy.sy));
  const v = Math.min(1, l / joy.r), m = v < JOY_DEAD ? 0 : Math.pow((v - JOY_DEAD) / (1 - JOY_DEAD), 1.5); // 가운데 조금은 가만히 · 살짝 밀면 아주 천천히
  joy.x = l ? dx / l * m : 0; joy.y = l ? dy / l * m : 0;
  const kl = Math.min(l, joy.r) / (l || 1); knob.style.transform = `translate(${dx * kl}px,${dy * kl}px)`;
}
function endJoy(e) {
  if (e.pointerId !== joy.id) return;
  const tap = e.type === 'pointerup' && joy.far < 9 && performance.now() - joy.t0 < 380;
  joy.id = null; joy.x = joy.y = 0; knob.style.transform = '';
  joyEl.classList.remove('live');
  void tap; // 조이스틱을 톡 누른 것은 걷기 명령이 아님 (땅을 톡 누르는 건 조이스틱 밖에서)
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
  let [x, z] = L2W(hall.bowSpot.lx, hall.bowSpot.lz);
  for (const ox of [0, .85, -.85, 1.7, -1.7]) { const [tx, tz] = L2W(hall.bowSpot.lx + ox, hall.bowSpot.lz); if (!othersNear(tx, tz, MONK_R * 1.8, true).length && !blockedAt(tx, tz, hall.FY + .02)) { x = tx; z = tz; break; } } // 다른 분이 절하는 자리면 옆에 나란히
  avatar.position.set(x, hall.FY, z); avatar.rotation.y = faceHall();
  yaw = behind(); dist = 3.6; pitch = .3; intro = -1; pose = null;
  sam = { t: 0, rung: -1 };
  toast('🙇 부처님께 삼배를 올려요');
}
function tryBow() {
  if (sam) return;
  if (nearBowSpot(2.6)) startSambae();
  else { pose = 'bow'; poseT = 0; addBow(1); toast('🙇 공손히 절을 올렸어요'); }
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
function goTemple(T) { dropTool(true); sam = null; pose = null; resetBody(); if (sit) standUp(); if (tapdori) stopTapdori(); moveTarget = null; useTemple(T); const [x, z] = L2W(0, T.YARD.z1 + 2.5); avatar.position.set(x, 0, z); avatar.rotation.y = faceHall(); yaw = behind(); dist = 6; pitch = .24; intro = -1; toast(`🛕 ${T.name}에 왔어요`); }
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
if (OFFLINE) { // 거리뷰는 사이트에서: 버튼을 사이트 링크로 바꿈
  const b = document.getElementById('btnPano'), a = document.createElement('a');
  a.id = 'btnPano'; a.className = b.className; a.href = SITE; a.target = '_blank'; a.rel = 'noopener';
  a.innerHTML = '<i>🌐</i><span>사이트에서 거리뷰</span><em>거리뷰</em>'; b.replaceWith(a);
}
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
  if (TILE) { const [tx, tz] = P(TILE.x, TILE.z); mctx.fillStyle = '#5b636f'; mctx.fillRect(tx - (big ? 8 : 4), tz - (big ? 5 : 3), big ? 16 : 8, big ? 10 : 6); }
  if (RACK) { const [rx, rz] = P(RACK.x, RACK.z); mctx.fillStyle = '#e0a020'; mctx.fillRect(rx - (big ? 9 : 5), rz - 2, big ? 18 : 10, 4); }
  mctx.fillStyle = '#3d7fd6'; for (const Pp of peers.values()) if (Pp.g.visible) { const [px, pz] = P(Pp.g.position.x, Pp.g.position.z); mctx.beginPath(); mctx.arc(px, pz, big ? 6 : 3.5, 0, 7); mctx.fill(); }
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
  else if (inside) html = `<b>${CFG.temple.name} ${CFG.hall.name} 안</b><span>${CFG.hall.buddhas === 0 ? '불상 대신 불단 뒤 창 너머 금강계단(부처님 진신사리)을 향해 삼배를 올려요' : '가운데 빛나는 방석에서 삼배를 올릴 수 있어요'}${bowCount ? ` · 오늘 ${bowCount}번 올렸어요` : ''}</span>`;
  else if (cur && cur.spots && cur.spots.some(p => Math.hypot(lx - p.lx, lz - p.lz) < p.r)) { // 사찰 상징물 가까이: 이름과 간직한 이야기
    const p = cur.spots.filter(q => Math.hypot(lx - q.lx, lz - q.lz) < q.r).sort((a, b) => Math.hypot(lx - a.lx, lz - a.lz) - Math.hypot(lx - b.lx, lz - b.lz))[0];
    html = `<b>${p.name}</b><span>${p.story}</span>`; }
  else if (Math.abs(lx) < hall.L / 2 + 3 && lz > -hall.D / 2 && lz < hall.D / 2 + 8) html = `<b>${CFG.temple.name} ${CFG.hall.name}</b><span>가운데 계단으로 올라가 안으로 들어가 보세요</span>`;
  if (document.body.classList.contains('touch')) { // 휴대폰: 장소가 바뀔 때만 4초 보여 주고 접음 (다니는 길을 가리지 않게)
    if (html === nearLast) return; nearLast = html; clearTimeout(nearT);
    if (!html) { nearEl.style.display = 'none'; return; }
    nearEl.innerHTML = html; nearEl.style.display = 'block'; nearT = setTimeout(() => { nearEl.style.display = 'none'; }, 4000); return;
  }
  nearEl.style.display = html ? 'block' : 'none'; if (html && nearEl.innerHTML !== html) nearEl.innerHTML = html;
}
let nearLast = '', nearT = 0;

/* ───────── 루프 ───────── */
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const clock = new THREE.Clock(); let walkT = 0, walkAmp = 0, frames = 0, fpsT = 0, mmT = 0, glowT = 0;
const stopIntro = () => { intro = -1; };
canvas.addEventListener('pointerdown', stopIntro); addEventListener('keydown', stopIntro); joyEl.addEventListener('pointerdown', stopIntro);
const camGoal = new THREE.Vector3();
const camRay = new THREE.Raycaster(), _cPivot = new THREE.Vector3(), _cDir = new THREE.Vector3(), _cOut = new THREE.Vector3();
// 카메라를 가리는 것들(법당 벽·기둥·지붕·담·바위·불상 등): 사찰마다 한 번 모아 둠. 바닥판·연등·나무 잎은 뺌
function occluders(T) {
  if (T.occ) return T.occ;
  const list = [], sph = new THREE.Sphere();
  (T.site || T.hall.group).updateMatrixWorld(true);
  (T.site || T.hall.group).traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.visible || o.userData.noOcc) return;
    const g = o.geometry, t = g.type; if (t === 'PlaneGeometry' || t === 'CircleGeometry' || t === 'RingGeometry') return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!m || m.transparent || m.side === THREE.BackSide) return;
    if (!g.boundingSphere) g.computeBoundingSphere(); sph.copy(g.boundingSphere).applyMatrix4(o.matrixWorld); if (sph.radius < .35) return;
    list.push(o);
  });
  dbg('occ.' + T.name, list.length);
  return (T.occ = list);
}
function camBlock(goal, pivotY) {
  if (!cur) return goal;
  _cPivot.set(avatar.position.x, pivotY, avatar.position.z); _cDir.subVectors(goal, _cPivot); const len = _cDir.length(); if (len < .3) return goal;
  _cDir.divideScalar(len); camRay.set(_cPivot, _cDir); camRay.near = .25; camRay.far = len;
  let hit = null;
  const hits = camRay.intersectObjects(occluders(cur), false); if (hits.length) hit = hits[0];
  if (!hit) return goal;
  const d = Math.max(.35, hit.distance - .3); return _cOut.copy(_cPivot).addScaledVector(_cDir, d);
}
function loop() { requestAnimationFrame(loop); try { step(); } catch (e) { if (!DBG.loopError) dbg('loopError', e.message); } }
function step() {
  const dt = Math.min(clock.getDelta(), 0.05);
  // 이동
  // 스노클링 메타버스와 같은 방식: W A S D·방향키 = 카메라 기준 앞뒤·옆, Space 점프, Shift 달리기, 마우스(클릭 후)·드래그로 시점
  let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  let iz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + joy.y;
  if (bellHold) { if (keys.KeyW || keys.KeyA || keys.KeyD || keys.ArrowUp || keys.ArrowLeft || keys.ArrowRight || Math.hypot(joy.x, joy.y) > .6) releaseBellRope(); else { ix = 0; iz = 0; } }
  const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
  if (sam && il > .5) { sam = null; resetBody(); toast('삼배를 멈췄어요'); }
  if (il > .05) { moveTarget = null; if (sit) standUp(); if (tapdori) stopTapdori('탑돌이를 멈췄어요'); }
  if (joy.id !== null && il > .9) joy.edge += dt; else joy.edge = Math.max(0, joy.edge - dt * 3);
  let speed = keys.ShiftLeft || keys.ShiftRight ? 7 : joy.id !== null ? WALK_LV[walkLv][1] * (1 + .55 * ss(1.0, 2.2, joy.edge)) : 3.6; // 조이스틱: 끝까지 1초 넘게 밀고 있으면 서서히 달림
  let mx = 0, mz = 0, moving = false;
  if (!sam && !sit && pose !== 'bow') {
    if (chore) speed = Math.min(speed, chore.kind === 'rag' ? 1.6 : chore.world ? 1.3 : 2.4); // 비·걸레를 들면 천천히
    if (il > 0.05) { const c = Math.cos(yaw), s = Math.sin(yaw); mx = ix * c + iz * s; mz = -ix * s + iz * c; moving = true; if (moveTarget) { moveTarget = null; markMove(null); } } // 조이스틱·키로 움직이면 누른 곳 걷기는 그만
    else if (tapdori) { speed = 2.2; const v = tapdoriStep(dt); mx = v[0]; mz = v[1]; moving = true; }
    else if (moveTarget) { // 누른 곳으로: 길(꺾이는 점)을 차례로 따라감
      const M = moveTarget, P = M.pts; let q = P ? P[M.i] : [M.x, 0, M.z], dx = q[0] - avatar.position.x, dz = q[2] - avatar.position.z, d = Math.hypot(dx, dz);
      while (P && M.i < P.length - 1 && d < .45) { M.i++; q = P[M.i]; dx = q[0] - avatar.position.x; dz = q[2] - avatar.position.z; d = Math.hypot(dx, dz); }
      const left = d + (P ? M.rest[M.i] : 0); M.t += dt;
      if (left < .3 || M.t > (M.max || 25)) { const ok2 = left < .6; moveTarget = null; WT.clear(ok2); }
      else { mx = dx / d; mz = dz / d; moving = true; if (!chore) speed = left > 6 ? (document.body.classList.contains('touch') ? 4 : 5) : 3.4; }
    }
  }
  if (moving) {
    if (!tapdori) {
      const p = avatar.position, nx = p.x + mx * speed * dt, nz = p.z + mz * speed * dt; let ok = true;
      if (blockedAt(p.x, p.z, feetY) || !blockedAt(nx, nz, feetY)) { p.x = nx; p.z = nz; } else if (!blockedAt(nx, p.z, feetY)) p.x = nx; else if (!blockedAt(p.x, nz, feetY)) p.z = nz; else ok = false; // 이미 물체 안(순간이동 직후)이면 빠져나갈 수 있게
      if (moveTarget) { if (ok) moveTarget.stuck = 0; else if ((moveTarget.stuck += dt) > .35) { // 막히면 그 자리에서 길을 한 번 더 찾고, 그래도 막히면 멈춤
        const M = moveTarget; if (M.re < 2 && M.pts) { const re = M.re + 1, last = M.pts[M.pts.length - 1]; if (goToW(last[0], last[2], last[1], true)) moveTarget.re = re; else { moveTarget = null; markMove(null); } } else { moveTarget = null; markMove(null); toast('🚧 길이 막혀서 멈췄어요', 1300); } } }
      pushOut(p, 0.42); clampBound(p);
    }
    // 카메라가 걷는 방향 뒤로 천천히 따라 돎 → 왼쪽으로 밀면 왼쪽으로 돌아 걸음 (마우스 시점·1인칭·화면 끌기·뒤로 걷기일 땐 안 함)
    if (il > .05 && !tapdori && !moveTarget && !isLocked() && !fpv && drag.id === null && performance.now() - lookT > 1200 && iz <= .25 * il) {
      const side = Math.abs(ix) / il; let dy = Math.atan2(mx, mz) + Math.PI - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      yaw += Math.sign(dy) * Math.min(Math.abs(dy), dt * 1.15 * side * (speed > 4 ? 1.35 : 1));
    }
    const face = (isLocked() || fpv) && !moveTarget && !tapdori && iz <= .05 ? yaw + Math.PI : Math.atan2(mx, mz); // 마우스 시점: 시선 방향을 보고 옆걸음
    let d = face - avatar.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); avatar.rotation.y += d * Math.min(1, dt * 10);
    walkT += dt * speed * 2 * (il > .05 ? Math.max(.45, Math.min(1, il)) : 1); body.position.y = Math.abs(Math.sin(walkT)) * 0.06; body.rotation.z = Math.sin(walkT) * 0.05;
    walkAmp = Math.min(1, walkAmp + dt * 6);
  } else if (!sam) { body.position.y *= 0.85; body.rotation.z *= 0.85; walkAmp = Math.max(0, walkAmp - dt * 6); }
  else walkAmp = 0;
  peerBlock(dt, moving && !tapdori, mx, mz); // 다른 아기 스님·동자승과 겹치지 않게
  { const o = { wob: myWob, wobPh: myWobPh }; applyWob(glb && glb.root, dt, o); myWob = o.wob; myWobPh = o.wobPh; }
  sitW += ((sit ? 1 : 0) - sitW) * Math.min(1, dt * 5); if (sit) { sit.t += dt; if (sit.t > 30 && sit.inHall && !sit.noted) { sit.noted = true; done('sit'); } }
  updateWorld(dt);
  pickCurrent();
  // 바닥 높이 (기단·계단·마루·광장 단·받침) + Space 점프 (중력)
  {
    const p = avatar.position, seat = sit ? sit.seatY * sitW : 0;
    if (Math.abs(p.y - lastY) > 1e-4) { feetY = p.y; vy = 0; grounded = true; } // 순간이동(사찰 옮기기·앉기)
    const gh = groundAt(p.x, p.z, feetY), jumpKey = (keys.Space || jumpBtn) && !rituals.open;
    if (jumpKey && grounded && !jumpLatch && !sit && !sam && pose !== 'bow' && !tapdori && !bellHold) { vy = 4.7; grounded = false; jumpLatch = true; moveTarget = null; markMove(null); }
    if (!jumpKey) jumpLatch = false;
    if (!grounded || feetY > gh + .32) { grounded = false; vy -= 14 * dt; feetY += vy * dt; if (feetY <= gh) { feetY = gh; vy = 0; grounded = true; } }
    else { feetY += (gh - feetY) * Math.min(1, dt * 16); grounded = true; }
    p.y = feetY + seat; lastY = p.y;
  }
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
      if (t > 1.2 && sam.rung !== n) { sam.rung = n; addBow(1); bell(.18); toast(`🙇 ${n + 1}배`, 1200); }
    }
  } else if (pose) {
    poseT += poseHold ? 0 : dt; const dur = pose === 'hap' ? 2.2 : 2.0;
    hap = clamp(Math.min(poseT / .35, (dur - poseT) / .45), 0, 1);
    if (pose === 'bow') { body.rotation.x = clamp(Math.min((poseT - .3) / .4, (dur - poseT) / .5), 0, 1) * 0.8; headG.rotation.x = body.rotation.x * .3; }
    if (poseT > dur) { pose = null; resetBody(); }
  }
  updateChore(dt, walkAmp > .3 ? speed : 0); updatePuffs(dt);
  sweepW += ((chore && chore.world ? 1 : 0) - sweepW) * Math.min(1, dt * 5);
  if (tapdori) hap = Math.max(hap, .9);
  const ST = { sit: sitW, walkAmp, speed, hap, kneel: body.position.y < 0 ? Math.min(1, -body.position.y / .2) : 0, bend: body.rotation.x, headX: headG.rotation.x, headZ: headG.rotation.z, closed: hap > .5 || (sit && sitW > .6 && sit.inHall), blink: blinkT < .12 };
  ST.sweep = sweepW;
  if (bellHold) { ST.walkAmp = Math.max(ST.walkAmp, bellStep.amp); ST.speed = bellStep.speed; ST.back = bellStep.back; }
  if (bellGrip.w > .02) ST.grip = bellGrip;
  if (wsPose.on) { ST.kneel = Math.max(ST.kneel, wsPose.kneel); ST.bend = wsPose.bend; ST.headX = wsPose.headX; ST.headZ = wsPose.headZ; ST.closed = wsPose.closed; ST.blink = false; ST.hap = 0; if (wsPose.walk) { ST.walkAmp = wsPose.walk; ST.speed = 1.4; } }
  if (wsGrip.w > .02) ST.grip = wsGrip; // 소원돌 양옆을 두 손으로
  if (glb) glb.update(dt, ST);
  if (chore && chore.world && glb) { glb.root.updateMatrixWorld(true); gripBroom(chore.mesh, glb, avatar.position.y); }
  netTick(dt, ST); updatePeers(dt);
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
  camGoal.set(avatar.position.x + bellFocus.x + Math.sin(yaw) * hd, avatar.position.y + 1.2 + bellFocus.y + Math.sin(effP) * effD, avatar.position.z + bellFocus.z + Math.cos(yaw) * hd);
  if (hall && (inside || hall.underRoof(lxA, lzA))) {
    let [cl, cz] = W2L(camGoal.x, camGoal.z); const I = hall.interior;
    if (inside) { cl = clamp(cl, I.ix0 + .3, I.ix1 - .3); cz = Math.max(cz, I.iz0 + .3); }
    if (hall.underRoof(cl, cz)) camGoal.y = Math.min(camGoal.y, hall.ceilY - .7);
    const [x, z] = L2W(cl, cz); camGoal.x = x; camGoal.z = z;
  }
  // 카메라가 벽·지붕·바위를 뚫고 들어가지 않게: 머리에서 카메라 쪽으로 광선을 쏘아 막히면 앞으로 당김
  let shX = 0, shZ = 0; if (isLocked() && !inside) { shX = Math.cos(yaw) * .42; shZ = -Math.sin(yaw) * .42; camGoal.x += shX; camGoal.z += shZ; } // 어깨 너머 시점
  camGoal.copy(camBlock(camGoal, avatar.position.y + 1.15));
  // 아래에서 올려다볼 때: 카메라가 바닥 밑으로 들어가지 않게 바닥 바로 위에 붙이고, 시선은 조금 더 위로
  { let fy = 0; if (hall) { const [fl, fz] = W2L(camGoal.x, camGoal.z); fy = hall.heightAt(fl, fz); } camGoal.y = Math.max(camGoal.y, fy + .16); }
  camera.position.lerp(camGoal, Math.min(1, dt * (isLocked() || drag.id !== null ? 30 : 8))); // 마우스로 돌릴 땐 바로 따라가서 어지럽지 않게
  { const cd = Math.hypot(camera.position.x - avatar.position.x, camera.position.y - avatar.position.y - 1.1, camera.position.z - avatar.position.z); avatar.visible = cd > .8; } // 벽에 바짝 붙어 카메라가 머리까지 오면 몸을 숨겨 시야 확보
  if (camShake > .001) { camera.position.x += (Math.random() - .5) * camShake; camera.position.y += (Math.random() - .5) * camShake; camShake *= Math.exp(-dt * 7); } // 종 칠 때 살짝 떨림
  camera.lookAt(avatar.position.x + shX + bellFocus.x, avatar.position.y + 1.05 + bellFocus.y + Math.max(0, -effP) * Math.min(effD, 3) * .3, avatar.position.z + shZ + bellFocus.z);
  if (fpv && !sit) { // F: 1인칭 (아기 스님 눈높이)
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), cp = Math.cos(pitch), hy = avatar.position.y + 1.02;
    camera.position.set(avatar.position.x + fx * .18, hy, avatar.position.z + fz * .18);
    camera.lookAt(camera.position.x + fx * cp * 5, hy - Math.sin(pitch) * 5, camera.position.z + fz * cp * 5);
    avatar.visible = false;
  }
  { const fov = aimZoom ? 26 : 55; if (Math.abs(camera.fov - fov) > .05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 12); camera.updateProjectionMatrix(); } }
  skyDome.position.copy(camera.position); if (skyDome.userData.on && skyMat.uniforms.uPK.value < 1) skyMat.uniforms.uPK.value = Math.min(1, skyMat.uniforms.uPK.value + dt * .8); // 하늘 사진이 오면 천천히 드러남
  faceFill.position.set(camera.position.x, camera.position.y + 1.2, camera.position.z); faceFill.target.position.set(avatar.position.x, avatar.position.y + 1, avatar.position.z);
  sun.position.set(avatar.position.x + 50, 100, avatar.position.z + 35); sun.target.position.copy(avatar.position);
  if (hall) { glowT += dt; hall.glow.visible = !sam; hall.glow.material.opacity = .35 + .25 * Math.sin(glowT * 3); }
  renderer.render(scene, camera);
  mmT += dt; if (mmT > 0.1) { mmT = 0; drawMinimap(); updateNear(); }
  frames++; fpsT += dt; if (fpsT > 1) { const ll = toLatLng(avatar.position.x, avatar.position.z); DBG.fps = frames; DBG.here = `${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}`; if (dbgEl.classList.contains('show')) renderDbg(); frames = 0; fpsT = 0; }
}


/* ───────── 산사 체험 (앉기 · 탑돌이 · 범종 · 향 · 소원 연등 · 바닥 클릭 이동 · 지도 · 사진) ───────── */
const visited = new Set();
let TILE = null; const GROW = [];
let sit = null, sitW = 0, tapdori = null, moveTarget = null, BELL = null, RACK = null, bellAnim = -1, bellCool = 0;
const rituals = initRituals({ sound, store, toast, done, onUse: () => { if (sit) standUp(); } });
document.getElementById('btnMoktak').onclick = () => rituals.openMoktak();
document.getElementById('btnBeads').onclick = () => rituals.openBeads();

// 누른 곳(PC는 둘러보는 중 가운데 점)으로 걸어감: 금빛 동그라미·화살표를 띄우고, 물체·벽을 돌아가는 길을 점선으로 보여 주며 걸음
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), _p = new THREE.Vector3(), _n = new THREE.Vector3();
const WT = createWalkTo({ scene, blockedAt, groundAt, obstacles, bound: () => RB - 4 });
function markMove(p) { if (!p) WT.clear(); }
// 세계 좌표 (x, z)로 길을 찾아 걸어가기 (y: 누른 곳 높이 · 계단 위를 눌렀을 때)
function goToW(x, z, y = feetY, quiet = false) {
  const p = avatar.position, r = WT.find(p.x, p.z, feetY, x, z, y);
  if (r.fail) { moveTarget = null; WT.clear(); if (!quiet) toast(r.fail === 'far' ? '🚶 너무 멀어요 · 조금 가까운 곳을 눌러 주세요' : '🚧 그곳으로는 걸어갈 수 없어요', 1800); DBG.tap = 'nopath ' + r.fail; return false; }
  const P = r.pts, rest = new Float32Array(P.length); for (let i = P.length - 2; i >= 0; i--) rest[i] = rest[i + 1] + Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][2] - P[i][2]);
  const last = P[P.length - 1]; moveTarget = { x: last[0], z: last[2], pts: P, rest, i: 1, t: 0, max: 8 + rest[0] / 1.6, stuck: 0, re: 0 };
  WT.show(P); DBG.tap = `go ${P.length - 1}꺾임 ${rest[0].toFixed(1)}m ${(r.ms || 0).toFixed(0)}ms`;
  if (r.near && !quiet) toast('🚶 그 자리는 들어갈 수 없어서 바로 옆까지 걸어갈게요', 1700);
  return true;
}
const visibleUp = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
function clickMove(e, center = false) {
  if (sam || rituals.open || bellHold) { DBG.tap = 'busy'; return; }
  if (center) ndc.set(0, 0); else { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); }
  ray.setFromCamera(ndc, camera);
  if (cur && cur.signs && cur.signs.length) { // 안내판(팻말)을 누르면 읽기 창
    const hit = ray.intersectObjects(cur.signs, true)[0];
    if (hit && hit.distance < 40) { let key = hit.object.userData.board;
      if (!key) { const [hx, hz] = W2L(hit.point.x, hit.point.z); let bd = 6; for (const p of cur.spots || []) if (p.board) { const d = Math.hypot(p.lx - hx, p.lz - hz); if (d < bd) { bd = d; key = p.board; } } }
      if (key && openBoard(key)) { DBG.tap = 'board'; return; } } }
  // 누른 곳: 사찰 바닥·계단·건물 중 처음 맞은 곳 (머리 위 연등·나뭇잎 옆면은 건너뜀), 없으면 발 높이 평면
  let hp = null; const roots = [cur && cur.site, COMMONS].filter(Boolean);
  for (const h of roots.length ? ray.intersectObjects(roots, true) : []) {
    if (h.distance > 95) break; const m = h.object; if (!m.isMesh || !visibleUp(m) || (m.material && m.material.depthWrite === false)) continue;
    const ny = h.face ? _n.copy(h.face.normal).transformDirection(m.matrixWorld).y : 1;
    if (h.point.y > feetY + 2.4 && ny < .5) continue; hp = h.point; break;
  }
  if (!hp) { if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -avatar.position.y), _p)) { DBG.tap = 'miss'; return; } hp = _p; }
  if (Math.hypot(hp.x - avatar.position.x, hp.z - avatar.position.z) > 70) { DBG.tap = 'far'; toast('🚶 너무 멀어요 · 조금 가까운 곳을 눌러 주세요', 1500); return; }
  if (sit) standUp(); if (tapdori) stopTapdori(); intro = -1;
  goToW(hp.x, hp.z, hp.y);
}

// 앉기: 법당 안이면 가장 가까운 방석에 가부좌(눈 감고 명상), 밖이면 그 자리에 앉아 쉬기
function toggleSit() {
  if (sit) { standUp(); return; }
  if (sam) return; pose = null; moveTarget = null; markMove(null); if (tapdori) stopTapdori();
  const [lx, lz] = W2L(avatar.position.x, avatar.position.z);
  if (hall && hall.isInside(lx, lz)) {
    let best = null, bd = 1e9; for (const c of hall.cushions) { const [cx, cz] = L2W(c.lx, c.lz); if (othersNear(cx, cz, MONK_R * 1.7, true).length) continue; const d = Math.hypot(c.lx - lx, c.lz - lz); if (d < bd) { bd = d; best = c; } } // 다른 분이 앉은 방석은 건너뜀
    if (best) { const [x, z] = L2W(best.lx, best.lz); avatar.position.x = x; avatar.position.z = z; }
    avatar.rotation.y = faceHall();
    sit = { t: 0, seatY: 0, inHall: true }; yaw = behind() + .5; dist = Math.max(dist, 3.2); pitch = .32;
    toast(best ? '🧘 방석에 앉아 마음을 고요히… (움직이면 일어나요)' : '🧘 방석이 모두 차서 이 자리에 앉았어요 · 마음을 고요히… (움직이면 일어나요)', 3200);
  } else { sit = { t: 0, seatY: 0, inHall: false }; toast('🌿 잠깐 앉아 쉬어요 (움직이면 일어나요)'); }
  updateNear();
}
function standUp() { sit = null; updateNear(); }

// 탑돌이: 탑을 오른쪽에 두고 시계 방향으로 세 바퀴 (합장한 채로)
function startTapdori(T) {
  if (!T || !T.pagoda) return; if (sit) standUp(); moveTarget = null; markMove(null); pose = null;
  const dx = avatar.position.x - T.pagoda.x, dz = avatar.position.z - T.pagoda.z, phi = Math.atan2(dx, -dz);
  tapdori = { cx: T.pagoda.x, cz: T.pagoda.z, r: T.pagodaR || 2.7, phi, start: phi, laps: 0 }; intro = -1;
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
  const [aBell, aRack, aTile] = freeAngles(3), R0 = 14;
  // 범종각
  { const ux = Math.sin(aBell), uz = Math.cos(aBell), x = ux * R0, z = uz * R0, grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = Math.atan2(-ux, -uz); g.add(grp);
    const ad = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
    ad(new THREE.BoxGeometry(4.6, .08, 4.6), MAT.stone, 0, .04, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { ad(new THREE.CylinderGeometry(.15, .17, 3.3, 10), MAT.red, sx * 1.85, 1.65, sz * 1.85); const [wx, wz] = [x + (sx * 1.85) * Math.cos(grp.rotation.y) + (sz * 1.85) * Math.sin(grp.rotation.y), z - (sx * 1.85) * Math.sin(grp.rotation.y) + (sz * 1.85) * Math.cos(grp.rotation.y)]; obstacles.push({ cx: wx, cz: wz, c: 1, s: 0, hu: .25, hv: .25 }); }
    const roof = ad(new THREE.ConeGeometry(3.7, 1.5, 4), MAT.wallCap, 0, 4.05, 0); roof.rotation.y = Math.PI / 4;
    ad(new THREE.BoxGeometry(4.2, .22, .22), MAT.red, 0, 3.15, 0);
    // 명동(울림 구덩이): 종 바로 아래 바닥을 둥글게 파 소리가 울리게
    ad(new THREE.CylinderGeometry(.98, .98, .02, 36), new THREE.MeshStandardMaterial({ color: '#2a241f', roughness: 1 }), 0, .085, 0);
    { const rim = ad(new THREE.TorusGeometry(1.04, .07, 6, 36), MAT.stoneDark, 0, .1, 0); rim.rotation.x = Math.PI / 2; }
    // 범종: 우리 종처럼 낮게(아래가 바닥에서 약 40cm) 매달린 청동 종 — 용뉴·음통, 상대·하대, 유곽(젖꼭지 9개씩 4곳), 당좌(치는 자리 연꽃)
    const S = 1.55, PIV = 3.08, BY = .4 - PIV, HS = .4 + .38 * S; // HS: 당좌 높이
    const bellM = new THREE.MeshStandardMaterial({ color: '#5a6246', metalness: .62, roughness: .42 }), bellD = new THREE.MeshStandardMaterial({ color: '#465036', metalness: .6, roughness: .5 });
    const prof = [[0, 0], [.66, 0], [.65, .05], [.61, .15], [.56, .45], [.51, .82], [.47, 1.06], [.41, 1.17], [.26, 1.24], [0, 1.25]].map(([r, y]) => new THREE.Vector2(r * S, y * S));
    const bellG = new THREE.Group(); bellG.position.set(0, PIV, 0); grp.add(bellG);
    const bm = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; bellG.add(m); return m; };
    bm(new THREE.LatheGeometry(prof, 48), bellM, 0, BY, 0);
    for (const [yy, rr] of [[.08, .655], [.13, .62], [1.1, .455], [1.15, .43]]) { const t = bm(new THREE.TorusGeometry(rr * S, .028 * S, 6, 48), bellD, 0, BY + yy * S, 0); t.rotation.x = Math.PI / 2; } // 하대·상대
    for (let k = 0; k < 4; k++) { // 유곽: 네모 테두리 안에 젖꼭지(유두) 9개
      const a = Math.PI / 4 + k * Math.PI / 2, rr = .5 * S + .012, yy = BY + .9 * S, f = new THREE.Group(); f.position.set(Math.sin(a) * rr, yy, Math.cos(a) * rr); f.rotation.y = a; bellG.add(f);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(.36, .34, .025), bellD); fr.rotation.x = -.11; f.add(fr);
      for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) { const n = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), bellM); n.position.set(u * .1, v * .095, .03 + v * .012); f.add(n); }
    }
    const dangM = bellD.clone(); dangM.emissive = new THREE.Color('#ffc46b'); dangM.emissiveIntensity = 0; // 앞쪽 당좌: 치는 순간 잠깐 빛남
    for (const a of [0, Math.PI]) { // 당좌: 당목이 닿는 연꽃 자리 (앞뒤)
      const rr = .567 * S + .01, f = new THREE.Group(); f.position.set(Math.sin(a) * rr, HS, Math.cos(a) * rr); f.position.y -= PIV; f.rotation.y = a; bellG.add(f);
      const d = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .03, 20), a === 0 ? dangM : bellD); d.rotation.x = Math.PI / 2 - .05; f.add(d);
      for (let k = 0; k < 8; k++) { const pa = k / 8 * Math.PI * 2, pt = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), a === 0 ? dangM : bellM); pt.scale.set(1, 1, .4); pt.position.set(Math.cos(pa) * .1, Math.sin(pa) * .1, .025); f.add(pt); }
    }
    bm(new THREE.CylinderGeometry(.07 * S, .09 * S, .28 * S, 12), bellD, -.12 * S, BY + 1.36 * S, 0); // 음통
    { const dr = bm(new THREE.TorusGeometry(.12 * S, .045 * S, 8, 16, Math.PI * 1.15), bellD, .04 * S, BY + 1.3 * S, 0); dr.rotation.z = -.2; } // 용뉴 (고리 모양 용)
    bm(new THREE.CylinderGeometry(.02, .02, PIV - (.4 + 1.42 * S), 6), MAT.line, .04 * S, -(PIV - (.4 + 1.42 * S)) / 2, 0); // 고리 줄
    // 당목: 밧줄 두 가닥에 매달린 통나무 · 뒤끝에 손으로 당기는 줄
    const LR = PIV - HS, LOGZ = 1.85;
    const strG = new THREE.Group(); strG.position.set(0, PIV, LOGZ); grp.add(strG);
    const logG = new THREE.Group(); strG.add(logG); // 두 줄(평행)에 매달려 수평을 유지한 채 앞뒤로 흔들림
    const log = new THREE.Mesh(new THREE.CylinderGeometry(.12, .13, 1.7, 14), MAT.trunk); log.rotation.x = Math.PI / 2; log.position.set(0, -LR, 0); log.castShadow = true; logG.add(log);
    for (const zz of [-.85, .85]) { const cap = new THREE.Mesh(new THREE.CircleGeometry(.12, 14), new THREE.MeshStandardMaterial({ color: '#9a7350', roughness: .9 })); cap.position.set(0, -LR, zz + Math.sign(zz) * .002); cap.rotation.y = zz > 0 ? 0 : Math.PI; logG.add(cap); }
    const ropes = []; for (const zz of [-.55, .55]) { const rg = new THREE.Group(); rg.position.set(0, 0, zz); strG.add(rg); const r = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, LR, 5), MAT.line); r.position.set(0, -LR / 2, 0); rg.add(r); ropes.push(rg); }
    const ropeGeo = new THREE.CylinderGeometry(.017, .017, 1, 5), ropeSegs = []; // 당기는 줄: 당목 뒤끝 → 두 손 → 손 아래로 늘어진 끝 (마디마다 매 프레임 맞춤)
    for (let i = 0; i < 11; i++) { const m = new THREE.Mesh(ropeGeo, MAT.line); m.castShadow = true; grp.add(m); ropeSegs.push(m); }
    const knot = new THREE.Mesh(new THREE.TorusGeometry(.13, .022, 5, 14), MAT.line); knot.position.set(0, -LR, .7); logG.add(knot); // 당목 뒤쪽에 감은 줄
    const waveM = new THREE.MeshBasicMaterial({ color: '#ffd98c', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }), waves = [], waveGeo = new THREE.RingGeometry(.955, 1, 96);
    for (let i = 0; i < 4; i++) { const w = new THREE.Mesh(waveGeo, waveM.clone()); w.visible = false; w.position.set(0, .4 + .62 * S, 0); w.renderOrder = 3; grp.add(w); waves.push({ m: w, t: -1, k: 0, delay: 0 }); } // 맥놀이처럼 종에서 퍼지는 울림 (늘 화면을 향함)
    obstacles.push({ cx: x, cz: z, c: 1, s: 0, hu: 1.05, hv: 1.05 });
    const GY = .47, HF = .13, Z0 = LOGZ + 1.65, Ay0 = PIV - LR, Az0 = LOGZ + .85, ropeLen = Math.hypot(Ay0 - GY, Z0 - HF - Az0) + .04; // 손 높이·손 앞거리·서는 자리 → 줄 길이
    BELL = { x, z, ux, uz, grp, bellG, strG, logG, ropes, LR, LOGZ, PIV, ropeSegs, waves, dangM, glow: 0, GY, HF, Z0, ropeLen, theta: 0, omega: 0, sway: 0, swayV: 0, struck: false, stand: [ux * (R0 - 3.3), uz * (R0 - 3.3)] };
  }
  // 소원 연등대
  { const ux = Math.sin(aRack), uz = Math.cos(aRack), x = ux * R0, z = uz * R0, grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = Math.atan2(-ux, -uz); g.add(grp);
    const ad = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
    for (const sx of [-1, 1]) ad(new THREE.CylinderGeometry(.09, .1, 3.2, 8), MAT.trunk, sx * 2.5, 1.6, 0);
    for (const y of RACK_BARS) { const bar = ad(new THREE.CylinderGeometry(.05, .05, 5.1, 8), MAT.trunk, 0, y, 0); bar.rotation.z = Math.PI / 2; } // 윗줄 연등 이름표가 아래 가로대보다 위에 오게 간격을 넓힘
    const sign = ad(new THREE.PlaneGeometry(1.5, .42), new THREE.MeshStandardMaterial({ map: nameTex('소원 연등', '#3a2418', '#f2cf72', 46), roughness: .7 }), 0, 3.45, .06); sign.castShadow = false;
    obstacles.push({ cx: x, cz: z, c: Math.cos(grp.rotation.y), s: -Math.sin(grp.rotation.y), hu: 2.7, hv: .3 });
    RACK = { x, z, ux, uz, grp, items: [], stand: [ux * (R0 - 2.2), uz * (R0 - 2.2)] };
  }
  // 기와 불사: 기와에 이름·소원을 적어 올리는 자리 (접수대 + 3단 기와 진열대)
  { const ux = Math.sin(aTile), uz = Math.cos(aTile), x = ux * R0, z = uz * R0, grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = Math.atan2(-ux, -uz); g.add(grp);
    const ad = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
    const B = (w, h, d, mat, px, py, pz) => ad(new THREE.BoxGeometry(w, h, d), mat, px, py, pz);
    B(2.2, .08, .8, MAT.trunk, 0, .78, 1.0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(.08, .78, .08, MAT.trunk, sx * 1.0, .39, 1.0 + sz * .32);
    B(.42, .05, .28, MAT.stoneDark, -.6, .84, 1.0); const br = ad(new THREE.CylinderGeometry(.015, .02, .36, 6), MAT.line, -.1, .84, 1.05); br.rotation.z = Math.PI / 2;
    for (let i = 0; i < 3; i++) { const t = ad(TILE_GEO, TILE_MAT, .62, .86 + i * .05, 1.0); t.rotation.x = -Math.PI / 2; t.scale.set(.8, .8, .8); }
    for (let r = 0; r < 3; r++) { B(4.4, .1, .55, MAT.trunk, 0, 1.05 + r * .55, -r * .5); B(4.4, 1.05 + r * .55, .08, MAT.trunk, 0, (1.05 + r * .55) / 2, -r * .5 - .24); }
    for (const sx of [-1, 1]) B(.12, 3.5, .12, MAT.trunk, sx * 2.3, 1.75, -1.35);
    B(4.7, .1, .12, MAT.trunk, 0, 3.5, -1.35);
    const sign = ad(new THREE.PlaneGeometry(1.5, .42), new THREE.MeshStandardMaterial({ map: nameTex('기와 불사', '#3a2418', '#f2cf72', 46), roughness: .7 }), 0, 3.12, -1.28); sign.castShadow = false;
    const cntSign = ad(new THREE.PlaneGeometry(1.95, .27), new THREE.MeshStandardMaterial({ map: nameTex('지금까지 0장', '#f6efe2', '#3a2a1c', 34, '', 760), roughness: .7 }), 0, .6, 1.37); cntSign.castShadow = false; // 누적 기와 수
    const slots = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) { const m = ad(TILE_GEO, TILE_MAT, -1.75 + c * .5, 1.1 + r * .55 + .23, -r * .5); slots.push(m); }
    obstacles.push({ cx: x, cz: z, c: Math.cos(grp.rotation.y), s: -Math.sin(grp.rotation.y), hu: 2.45, hv: 1.55 });
    TILE = { x, z, ux, uz, grp, slots, k: 0, cntSign, count: 0, stand: [ux * (R0 - 2.7), uz * (R0 - 2.7)] };
  }
}
// 기와 한 장 (안쪽이 오목한 암키와 모양) — 글씨를 쓴 기와는 흰 글씨 그림을 입힘
const TILE_GEO = new THREE.CylinderGeometry(.24, .24, .46, 12, 1, true, -Math.PI * .32, Math.PI * .64);
const TILE_MAT = new THREE.MeshStandardMaterial({ color: '#5b636f', roughness: .7, side: THREE.DoubleSide, flatShading: true });
function tileTexture(text) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 240; const c = cv.getContext('2d');
  c.fillStyle = '#5b636f'; c.fillRect(0, 0, 256, 240); c.strokeStyle = 'rgba(255,255,255,.08)'; for (let x = 8; x < 256; x += 22) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 240); c.stroke(); }
  c.fillStyle = '#fbf7ee'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 34px "Nanum Brush Script","Nanum Pen Script","Noto Serif KR",serif';
  const lines = []; for (let i = 0; i < text.length && lines.length < 3; i += 8) lines.push(text.slice(i, i + 8));
  lines.forEach((ln, i) => c.fillText(ln, 128, 120 + (i - (lines.length - 1) / 2) * 52));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function setTileCount(n) { // 기와는 지워지지 않고 계속 쌓임: 진열대엔 최근 24장, 간판엔 누적 장수
  if (!TILE) return; TILE.count = n; const m = TILE.cntSign.material; m.map && m.map.dispose();
  m.map = nameTex(`지금까지 ${n.toLocaleString('ko-KR')}장 올라왔어요`, '#f6efe2', '#3a2a1c', 34, '', 760); m.needsUpdate = true;
}
function hangTile(w, fresh = true) {
  if (!TILE) return; const m = TILE.slots[TILE.k % TILE.slots.length]; TILE.k++;
  if (m.material !== TILE_MAT) { m.material.map && m.material.map.dispose(); m.material.dispose(); }
  m.material = new THREE.MeshStandardMaterial({ map: tileTexture(w.t || ''), roughness: .7, side: THREE.DoubleSide });
  if (fresh) { m.userData.base = m.scale.x; m.scale.setScalar(.01); m.userData.grow = 0; GROW.push(m); }
}
// 지금 서 있는 절 마당 (연등을 그 절 연등 줄에 달 때)
function templeHere() {
  if (!cur || !cur.wire) return null; const [lx, lz] = W2L(avatar.position.x, avatar.position.z), Y = cur.YARD;
  return lx > Y.x0 && lx < Y.x1 && lz > Y.z0 && lz < Y.z1 + 1 ? cur : null;
}
// 절 마당 연등 줄에 이름표 달린 연등 달기 (원래 연등 사이사이에 조금 낮게)
function hangTempleLantern(T, w, fresh = true) {
  const W = T.wire; if (!W || !T.site) return; const n = Math.max(1, Math.floor((W.x1 - W.x0 - 1.4) / W.step));
  if (W.items.length >= n) { const old = W.items.shift(); old.removeFromParent(); }
  const i = W.k++ % n, lx = W.x0 + .9 + W.step / 2 + i * W.step;
  const gL = new THREE.Group(); gL.position.set(lx, 2.7, W.z); T.site.add(gL);
  gL.add(makeLantern(w.c, .23, .45));
  const str = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .32, 4), MAT.line); str.position.y = .38; gL.add(str);
  const tag = wishTag(w.t, .48); tag.position.set(0, -.23 * 1.55 - .13, 0); gL.add(tag);
  W.items.push(gL); if (fresh) { gL.userData.base = 1; gL.scale.setScalar(.01); gL.userData.grow = 0; GROW.push(gL); }
}
// 범종 치기: 당목 줄을 두 손으로 잡고(E) → 꾹 누르면 뒷걸음치며 당목을 뒤로 끌어올리고 → 놓으면 당목이 흔들려 가 당좌를 침
//   흔들려 돌아올 때 다시 당기면 힘이 더해져 더 크게 울림(하나·둘·셋). 친 세기만큼 소리·빛·울림 물결·화면 떨림
let bellHold = null; // { pull: 0~1, pulling, z: 종에서 선 자리(로컬), v }
const bellStep = { amp: 0, back: false, speed: 0 }, bellGrip = { w: 0, L: new THREE.Vector3(), R: new THREE.Vector3() }, bellFocus = new THREE.Vector3(), _bf = new THREE.Vector3();
let camShake = 0;
const _bv = new THREE.Vector3(), _bv2 = new THREE.Vector3(), _bv3 = new THREE.Vector3(), _bq = new THREE.Quaternion(), _UP = new THREE.Vector3(0, 1, 0), _sd = new THREE.Vector3();
const BELL_TMAX = .45, BELL_TLIM = .56; // 당겨 올리는 각 · 넘지 않는 각
const bellA = (B, th, out) => out.set(0, B.PIV - B.LR * Math.cos(th), B.LOGZ + .85 - B.LR * Math.sin(th)); // 당목 뒤끝(줄 묶은 곳), 범종각 로컬
function bellTaut(B, th) { const A = bellA(B, th, _bv3), dy = A.y - B.GY; return A.z + B.HF + Math.sqrt(Math.max(0, B.ropeLen * B.ropeLen - dy * dy)); } // 줄이 팽팽할 때 서는 자리
// 함께 치기: 줄 잡은 사람이 당목 각도·속도를 보내고(netTick의 b), 친 순간은 이벤트('bell')로 보냄 → 다른 화면에서도 당목·두 손·소리·빛·물결
let bellRemote = null, bellCtrlT = 0, bellToastT = 0; // bellRemote: 다른 분이 움직이는 당목 { id, nick, mode(0 놓음·1 잡음·2 당김), th, om, back, t } · bellCtrlT: 내가 놓은 뒤에도 흔들림을 몇 초 더 보냄
const bellRemoteOn = () => !!(bellRemote && performance.now() - bellRemote.t < 2000 && peers.has(bellRemote.id));
function grabBell() {
  if (!BELL) return;
  if (bellRemoteOn() && bellRemote.mode > 0) { toast(`🔔 ${plainNick(bellRemote.nick) || '다른 분'}님이 당목 줄을 잡고 있어요 · 다 치시면 잡을 수 있어요`, 2800); return; }
  if (sit) standUp(); if (tapdori) stopTapdori(); moveTarget = null; markMove(null); sam = null; resetBody();
  const lp = BELL.grp.worldToLocal(_bv.copy(avatar.position));
  bellHold = { pull: 0, pulling: false, z: Math.max(BELL.Z0 - .4, Math.min(BELL.Z0 + .4, Math.hypot(lp.x, lp.z) || BELL.Z0)), v: 0 };
  const ry = Math.atan2(BELL.x - avatar.position.x, BELL.z - avatar.position.z), tall = innerHeight > innerWidth; yaw = ry + Math.PI + (tall ? .42 : .95); dist = tall ? 4.4 : 4.3; pitch = tall ? .3 : .13; intro = -1; // 종·당목·나를 한 화면에 (가로: 비스듬히 옆에서 · 세로: 등 뒤 조금 위에서)
  toast(document.body.classList.contains('touch') ? '🔔 당목 줄을 잡았어요 · [꾹 눌러 당기기]로 뒤로 끌었다가 떼면 종을 쳐요 · 흔들려 돌아올 때 다시 당기면 더 크게' : '🔔 당목 줄을 잡았어요 · 마우스 왼쪽(또는 S)을 꾹 눌러 뒤로 끌었다가 놓으면 종을 쳐요 · 흔들려 돌아올 때 다시 당기면 더 크게 · E 놓기', 5200);
  updateNear();
}
function releaseBellRope() { if (!bellHold) return; bellHold = null; bellStep.amp = 0; bellCtrlT = 3; resetBody(); updateNear(); }
function bellPullStart() { if (bellHold && !bellHold.pulling) { bellHold.pulling = true; bellHold.pull = Math.max(0, Math.min(1, -BELL.theta / BELL_TMAX)); } } // 지금 당목이 있는 자리부터 이어서 당김
function bellPullEnd() { if (bellHold && bellHold.pulling) bellHold.pulling = false; } // 놓으면 진자처럼 앞으로 흔들려 감
function strikeBell() { grabBell(); }
{ const bp = document.getElementById('bellPull'); if (bp) { // 꾹 눌러 당기기 버튼 (휴대폰·마우스 모두)
  bp.addEventListener('pointerdown', e => { e.preventDefault(); bp.setPointerCapture(e.pointerId); bellPullStart(); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) bp.addEventListener(ev, () => bellPullEnd());
} }
function bellFx(k, vol = 1, shake = 1) { // 소리·당좌 빛·울림 물결·떨림 (내가 쳤을 때도, 다른 분이 쳤을 때도)
  const B = BELL; sound.bigBell((.3 + .7 * k) * vol); B.swayV += .02 + .05 * k; B.glow = Math.max(B.glow, .5 + 1.1 * k); camShake = Math.max(camShake, (.02 + .05 * k) * shake);
  B.waves.forEach((w, i) => { w.t = 0; w.delay = i * 1.65; w.k = k * [1, .7, .45, .28][i]; }); // 맥놀이 박자(약 0.6Hz)로 물결이 몇 번 더 퍼짐
}
function ringBell(k) { // k: 0~1 친 세기
  bellFx(k); if (NET) NET.emit('bell', { k: Math.round(k * 100) / 100 });
  try { if (document.body.classList.contains('touch') && navigator.vibrate) navigator.vibrate(k > .6 ? [40, 50, 25] : 25); } catch (e) {}
  const n = store.count('bell'); toast(k > .65 ? `🔔 데에엥— 크게 울렸어요 · 오늘 ${n}번` : `🔔 범종을 울렸어요 · 오늘 ${n}번`, 2400); done('bell');
}
function onBellEvent(p) { // 다른 분이 범종을 울림: 멀리 있을수록 작게 들림
  if (!BELL) return; const d = Math.hypot(avatar.position.x - BELL.x, avatar.position.z - BELL.z), k = Math.max(0, Math.min(1, +p.k || 0));
  bellFx(k, Math.max(.22, Math.min(1, 1.15 - d / 90)), d < 10 ? .6 : 0);
  if (performance.now() - bellToastT > 3500) { bellToastT = performance.now(); toast(`🔔 ${plainNick(p.n) || '다른 분'}님이 범종을 울렸어요`, 2400); }
}
function onNetEvent(p) { if (p.k === 'bell') onBellEvent(p); else if (p.k === 'bump') onBumped(p); }
function bellRope(B, pts) { // 줄 마디 맞추기: pts는 범종각 로컬 점들
  const S = B.ropeSegs; for (let i = 0; i < S.length; i++) { const m = S[i]; if (i >= pts.length - 1) { m.visible = false; continue; } m.visible = true; _sd.subVectors(pts[i + 1], pts[i]); const L = _sd.length(); m.position.copy(pts[i]).addScaledVector(_sd, .5); m.scale.set(1, Math.max(L, 1e-3), 1); if (L > 1e-5) m.quaternion.setFromUnitVectors(_UP, _sd.multiplyScalar(1 / L)); }
}
const _rp = Array.from({ length: 12 }, () => new THREE.Vector3()), _gL = new THREE.Vector3(), _gR = new THREE.Vector3();
function updateBell(dt) {
  const B = BELL; if (!B) return; dt = Math.min(dt, .05);
  const H = bellHold, HIT = .053, rem = !H && bellRemoteOn() ? bellRemote : null;
  if (H) bellCtrlT = 3; else if (bellCtrlT > 0) bellCtrlT -= dt;
  if (rem) { // 다른 분이 움직이는 당목: 받은 각도·속도로 따라감 (받는 사이엔 속도로 조금 앞질러 맞춤)
    const age = Math.min(.25, (performance.now() - rem.t) / 1000), tt = Math.min(HIT, Math.max(-BELL_TLIM, rem.th + rem.om * age));
    B.omega = rem.om; B.theta += (tt - B.theta) * Math.min(1, dt * 12);
  } else {
    // 당목 진자 + 줄이 팽팽할 때만 끌어당기는 힘 (줄은 밀지 못함)
    if (H && H.pulling) H.pull = Math.min(1, H.pull + dt * .8);
    const tgt = -BELL_TMAX * (H ? H.pull : 0);
    let acc = -(9.8 / B.LR) * Math.sin(B.theta) - .5 * B.omega;
    if (H && H.pulling && B.theta > tgt) acc += 24 * (tgt - B.theta) - 5 * B.omega;
    B.omega += acc * dt; B.theta += B.omega * dt;
    if (B.theta < -BELL_TLIM) { B.theta = -BELL_TLIM; B.omega = Math.max(0, B.omega); }
    if (B.theta > HIT && B.omega > 0) { const v = B.omega; B.theta = HIT; B.omega = -v * .3; if (v > .2) { if (H || bellCtrlT > 0) ringBell(Math.min(1, v / .9)); else bellFx(Math.min(1, v / .9), .6, 0); } else if (v > .06) { sound.bigBell(.12 + v); B.glow = Math.max(B.glow, .3); } } // 내가 움직인 당목만 '울렸어요'로 셈
  }
  B.logG.position.set(0, B.LR * (1 - Math.cos(B.theta)), -B.LR * Math.sin(B.theta)); for (const r of B.ropes) r.rotation.x = B.theta;
  // 종: 거의 안 흔들림 · 당좌 빛 · 울림 물결
  B.swayV += (-14 * B.sway - .8 * B.swayV) * dt; B.sway += B.swayV * dt; B.bellG.rotation.x = -B.sway;
  B.glow = Math.max(0, B.glow - dt * 1.6); B.dangM.emissiveIntensity = B.glow;
  if (B.waves.some(w => w.t >= 0)) B.grp.getWorldQuaternion(_bq).invert().multiply(camera.quaternion);
  for (const w of B.waves) { if (w.t < 0) continue; w.t += dt; const u = (w.t - w.delay) / 2.4; if (u < 0) { w.m.visible = false; continue; } if (u >= 1) { w.t = -1; w.m.visible = false; continue; } w.m.visible = true; const e = 1 - (1 - u) * (1 - u), r = 1.15 + e * 2.6; w.m.scale.set(r, r, 1); w.m.quaternion.copy(_bq); w.m.material.opacity = .55 * w.k * (1 - u) * Math.min(1, u * 8); }
  const A = bellA(B, B.theta, _bv.set(0, 0, 0)); // 줄 묶은 곳 (로컬)
  if (H) {
    // 서는 자리: 당길 땐 줄이 팽팽한 자리까지 뒷걸음, 놓으면 제자리로 걸어 나오며 따라감 (줄 길이보다 멀어질 순 없음)
    const taut = bellTaut(B, B.theta), goal = H.pulling ? taut : B.Z0;
    let nz = H.z + (goal - H.z) * Math.min(1, dt * (H.pulling ? 12 : 4));
    const maxStep = (H.pulling ? 2.4 : 1.1) * dt; nz = H.z + Math.max(-maxStep, Math.min(maxStep, nz - H.z));
    nz = Math.max(A.z + .3, Math.min(taut + .005, nz));
    const v = (nz - H.z) / Math.max(dt, 1e-4); H.z = nz; H.v += (v - H.v) * Math.min(1, dt * 10);
    const ap = B.grp.localToWorld(_bv2.set(0, 0, H.z)); avatar.position.x = ap.x; avatar.position.z = ap.z;
    const cp = B.grp.localToWorld(_bf.set(0, 0, 0)); avatar.rotation.y = Math.atan2(cp.x - avatar.position.x, cp.z - avatar.position.z);
    const sp = Math.abs(H.v); bellStep.amp += (Math.min(1, sp / .35) * .9 - bellStep.amp) * Math.min(1, dt * 8); bellStep.back = H.v > 0; bellStep.speed = 1.4 + sp * 4;
    const lean = H.pulling ? -.34 * (.4 + .6 * H.pull) : H.v < -.25 ? .16 : 0; // 당길수록 뒤로 젖히고, 따라 나갈 땐 앞으로 밀듯이
    body.rotation.x += (lean - body.rotation.x) * Math.min(1, dt * 6);
  }
  // 두 손 자리와 줄 (로컬 → 월드): 내가 잡았으면 내 손, 다른 분이 잡았으면 그분 손
  bellGrip.w += ((H ? 1 : 0) - bellGrip.w) * Math.min(1, dt * 7);
  const RP = rem && rem.mode > 0 ? peers.get(rem.id) : null;
  if (RP && !RP.grip) RP.grip = { w: 0, L: new THREE.Vector3(), R: new THREE.Vector3() };
  if (RP) RP.grip.w += (1 - RP.grip.w) * Math.min(1, dt * 7);
  let n = 0;
  const mine = H || bellGrip.w > .05, holdG = mine ? bellGrip : RP && RP.g.visible ? RP.grip : null;
  if (holdG) {
    const pulling = mine ? !!(H && H.pulling) : rem.mode === 2, fwd = mine && H && !H.pulling && H.v < -.2, lean = mine ? body.rotation.x : RP.st.bend;
    const lz = mine ? (H ? H.z : B.grp.worldToLocal(_bf.copy(avatar.position)).z) : B.grp.worldToLocal(_bf.copy(RP.g.position)).z, reachF = B.HF + (fwd ? .03 : 0) - (pulling ? .02 : 0) + lean * .12;
    const G = _bv2.set(0, B.GY + (pulling ? .02 : 0), lz - reachF), u = _bf.subVectors(A, G); const dAG = u.length(); u.multiplyScalar(1 / Math.max(dAG, 1e-4));
    const Rl = _gR.copy(G), Ll = _gL.copy(G).addScaledVector(u, .06); // 몸 쪽 손(오른손)·앞쪽 손(왼손)
    const slack = Math.max(0, B.ropeLen - dAG), sag = Math.sqrt(slack * dAG) * .55;
    for (let i = 0; i <= 7; i++) { const t = i / 7; _rp[n++].lerpVectors(A, Ll, t).y -= sag * 4 * t * (1 - t); }
    _rp[n].copy(Rl); n++; _rp[n].copy(Rl).addScaledVector(u, -.05).y -= .1; n++; _rp[n].set(_rp[n - 1].x, _rp[n - 1].y - .16, _rp[n - 1].z + .02); n++; // 손 아래로 늘어진 줄 끝
    B.grp.localToWorld(holdG.L.copy(Ll)); B.grp.localToWorld(holdG.R.copy(Rl)); // 아바타 손 목표(월드)
  } else { _rp[0].copy(A); _rp[1].copy(A).add(_bf.set(0, -.45, .05)); _rp[2].copy(A).add(_bf.set(0, -.9, .08)); n = 3; } // 아무도 안 잡으면 당목에서 늘어짐
  bellRope(B, _rp.slice(0, n));
  { const bp = document.getElementById('bellPull'); if (bp) { const on = !!H; if (bp._on !== on) { bp._on = on; bp.style.display = on ? 'block' : 'none'; } if (on) bp.style.setProperty('--p', Math.round((H.pulling ? H.pull : 0) * 100) + '%'); } }
  // 카메라 초점: 줄을 잡고 있으면 나와 당목 사이를 보게
  if (H) { const lc = B.grp.localToWorld(_bf.set(0, 0, B.LOGZ * .8)), tall = innerHeight > innerWidth, f = tall ? .5 : .45; _bv2.set((lc.x - avatar.position.x) * f, tall ? -.62 : -.3, (lc.z - avatar.position.z) * f); } else _bv2.set(0, 0, 0);
  bellFocus.lerp(_bv2, Math.min(1, dt * 3));
}
const WISH_COLORS = ['#f6a5b8', '#ffd86a', '#f48c7a', '#a8e0a0', '#ffffff', '#9fc8ff'];
// 연등: 연꽃잎이 감싼 둥근 등 + 위 뚜껑 + 아래 금빛 술 · 이름표는 종이 꼬리표 (소원 연등대·절 마당 연등 줄 같이 씀)
const RACK_BARS = [3.05, 2.05], LANTERN_PETALS = new Map(), _lc = new THREE.Color();
function petalRing(r) { // 꽃잎 두 줄(엇갈려 8장씩)을 한 덩어리로 — 연등 하나에 메시 몇 개만
  if (LANTERN_PETALS.has(r)) return LANTERN_PETALS.get(r);
  const parts = [];
  for (const [row, n, y, tilt, sc] of [[0, 8, -.42, .55, 1], [1, 8, .05, .35, .9]]) for (let i = 0; i < n; i++) {
    const a = (i + row * .5) / n * Math.PI * 2, gm = new THREE.SphereGeometry(1, 8, 6);
    gm.translate(0, 1, 0); gm.scale(.34 * r * sc, .62 * r * sc, .13 * r); // 아래가 붙고 끝이 뾰족한 꽃잎
    gm.rotateX(-tilt); gm.translate(0, 0, .82 * r); gm.rotateY(a); gm.translate(0, y * r, 0);
    parts.push(gm);
  }
  const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); LANTERN_PETALS.set(r, g); return g;
}
function makeLantern(color, r = .17, glow = .35) {
  const g = new THREE.Group(), c = new THREE.Color(color);
  const prof = [[0, -1], [.42, -.94], [.78, -.68], [.97, -.26], [.98, .16], [.85, .55], [.56, .85], [.22, .99], [0, 1]].map(([x, y]) => new THREE.Vector2(x * r, y * r * .92));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 22), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: glow, roughness: .55 })); body.castShadow = true; g.add(body);
  const pc = _lc.copy(c).lerp(new THREE.Color('#ffffff'), .35).clone();
  g.add(new THREE.Mesh(petalRing(r), new THREE.MeshStandardMaterial({ color: pc, emissive: pc, emissiveIntensity: glow * .8, roughness: .6, side: THREE.DoubleSide })));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.16 * r, .3 * r, .16 * r, 12), new THREE.MeshStandardMaterial({ color: '#8c2f22', roughness: .6 })); cap.position.y = .95 * r; g.add(cap);
  const gold = new THREE.MeshStandardMaterial({ color: '#d9b04e', roughness: .45, metalness: .3 });
  const bead = new THREE.Mesh(new THREE.SphereGeometry(.13 * r, 8, 6), gold); bead.position.y = -.98 * r; g.add(bead);
  const tas = new THREE.Mesh(new THREE.ConeGeometry(.12 * r, .5 * r, 8, 1, true), gold); tas.position.y = -1.32 * r; tas.rotation.x = Math.PI; g.add(tas); // 금빛 술
  return g;
}
function wishTag(text, w = .44) { // 종이 꼬리표: 위에 끈 구멍, 붉은 테, 굵은 글씨 두 줄
  const cv = document.createElement('canvas'); cv.width = 384; cv.height = 192; const c = cv.getContext('2d');
  const rr = (x, y, w2, h, k) => { c.beginPath(); c.moveTo(x + k, y); c.arcTo(x + w2, y, x + w2, y + h, k); c.arcTo(x + w2, y + h, x, y + h, k); c.arcTo(x, y + h, x, y, k); c.arcTo(x, y, x + w2, y, k); c.closePath(); }; // 둥근 네모 (오래된 사파리도 되게)
  c.fillStyle = '#fff8ea'; rr(6, 6, 372, 180, 18); c.fill();
  c.strokeStyle = '#b8432f'; c.lineWidth = 7; rr(14, 14, 356, 164, 12); c.stroke();
  c.fillStyle = '#d9b04e'; c.beginPath(); c.arc(192, 30, 9, 0, 7); c.fill();
  const t = String(text || '').trim().replace(/\s+/g, ' '), lines = []; // 띄어쓰기 기준으로 한 줄 9자 안쪽, 두 줄까지
  for (const wd of t.split(' ')) { let w2 = wd; while (w2.length > 9) { lines.push(w2.slice(0, 9)); w2 = w2.slice(9); } const last = lines[lines.length - 1]; if (last !== undefined && (last + ' ' + w2).length <= 9 && !last.endsWith('\u2026')) lines[lines.length - 1] = last + ' ' + w2; else lines.push(w2); }
  if (lines.length > 2) { lines.length = 2; lines[1] = lines[1].slice(0, 8) + '…'; } if (!lines.length) lines.push('');
  c.fillStyle = '#3e2414'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${lines.length > 1 ? 40 : 46}px "Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif`;
  lines.forEach((ln, i) => c.fillText(ln, 192, 108 + (i - (lines.length - 1) / 2) * 50));
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: .85, side: THREE.DoubleSide })); return m;
}
function hangWish(w, fresh = true) {
  if (!RACK) return; const k = RACK.items.length % 16, row = k < 8 ? 0 : 1, col = k % 8, lx = -2.1 + col * .6, r = .17, ly = RACK_BARS[row] - .43; // 위 가로대에 윗줄, 아래 가로대에 아랫줄
  if (RACK.items.length >= 16) { const old = RACK.items.shift(); old.removeFromParent(); }
  const gL = new THREE.Group(); gL.position.set(lx, ly, .02); RACK.grp.add(gL);
  gL.add(makeLantern(w.c, r, .35));
  const top = r * 1.03, L = RACK_BARS[row] - .04 - ly - top, str = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, L, 4), MAT.line); str.position.y = top + L / 2; gL.add(str);
  const tag = wishTag(w.t, .44); tag.position.set(0, -r * 1.55 - .12, .01); gL.add(tag); // 술 아래 꼬리표 (윗줄도 아래 가로대보다 위)
  RACK.items.push(gL); if (fresh) { gL.scale.setScalar(.01); gL.userData.grow = 0; }
}
const wishModal = document.getElementById('wishModal');
let wishColor = WISH_COLORS[0];
let wishMode = 'lantern';
function openWish(mode = 'lantern') {
  wishMode = mode; const tile = mode === 'tile', T = tile ? null : templeHere(), inp = document.getElementById('wishText');
  document.getElementById('wishTitle').textContent = tile ? '✍️ 기와 올리기' : '🏮 연등 달기';
  document.getElementById('wishSub').textContent = (tile ? '기와 한 장에 이름과 소원을 적어 순례 마당 기와 불사 자리에 올려요' : T ? `${T.name} 마당 연등 줄에 이름표를 달아 걸려요` : '순례 마당 소원 연등대에 걸려요 · 절 마당 안에서 누르면 그 절 연등 줄에 달려요') + (NET && onlineOffers ? ' · 함께 접속한 모든 분께 보여요 (전화번호·주소는 적지 마세요)' : ' · 지금은 이 기기에서만 보여요');
  document.getElementById('wishHang').textContent = tile ? '기와 올리기' : '연등 달기';
  inp.maxLength = tile ? 24 : 40; inp.placeholder = tile ? '이름 · 소원 (24자까지) 예) 김OO 가족 건강' : '소원 한 문장 (40자까지)';
  const box = document.getElementById('wishColors'); box.innerHTML = ''; box.style.display = tile ? 'none' : 'flex';
  WISH_COLORS.forEach(c => { const b = document.createElement('button'); b.style.background = c; b.className = c === wishColor ? 'on' : ''; b.onclick = () => { wishColor = c; [...box.children].forEach(x => x.className = ''); b.className = 'on'; }; box.appendChild(b); });
  document.getElementById('wishText').value = ''; wishModal.classList.add('show'); setTimeout(() => document.getElementById('wishText').focus(), 50);
}
document.getElementById('btnWish').onclick = () => openWish('lantern');
document.getElementById('btnTile').onclick = () => { goTile(); openWish('tile'); };
function goTile() {
  if (!TILE || Math.hypot(avatar.position.x - TILE.x, avatar.position.z - TILE.z) < 4.2) return; if (sit) standUp(); if (tapdori) stopTapdori();
  avatar.position.set(TILE.stand[0], 0, TILE.stand[1]); avatar.rotation.y = Math.atan2(TILE.x - TILE.stand[0], TILE.z - TILE.stand[1]); yaw = avatar.rotation.y + Math.PI; dist = 6; pitch = .24; intro = -1;
}
document.getElementById('wishCancel').onclick = () => wishModal.classList.remove('show');
document.getElementById('wishHang').onclick = async () => {
  const t = document.getElementById('wishText').value.trim(); if (!t) { toast(wishMode === 'tile' ? '기와에 적을 이름이나 소원을 써 주세요' : '소원을 한 문장 적어 주세요'); return; }
  const T = wishMode === 'tile' ? null : templeHere();
  const kind = wishMode === 'tile' ? 'tile' : T ? 'lantern' : 'rack', body = t.slice(0, kind === 'tile' ? 24 : 40);
  const btn = document.getElementById('wishHang'); btn.disabled = true;
  let row = null, localOnly = false;
  if (NET && onlineOffers) {
    try { row = await NET.offer({ kind, temple: T ? T.name : null, color: kind === 'tile' ? null : wishColor, body }); seenOffer.add(row.id); }
    catch (e) { const msg = offerError(e); if (msg) { btn.disabled = false; toast('🙏 ' + msg, 3200); return; } localOnly = true; }
  } else localOnly = true;
  btn.disabled = false; wishModal.classList.remove('show'); sound.chime();
  const w = { c: wishColor, t: body, at: Date.now() };
  if (localOnly) { const L = kind === 'tile' ? store.tiles(REGION.id) : kind === 'lantern' ? store.tlan(T.name) : store.wishes(REGION.id); L.push(w); if (L.length > 30) L.shift(); store.save(); }
  const tail = localOnly ? ' (연결이 불안정해 이 기기에만 저장했어요)' : '';
  if (kind === 'tile') { goTile(); hangTile(w); setTileCount((TILE ? TILE.count : 0) + 1); done('giwa'); toast(`✍️ 기와 불사 자리에 기와를 올렸어요 · 지금까지 ${TILE ? TILE.count : 1}장` + tail, 3200); return; }
  if (kind === 'lantern') { hangTempleLantern(T, w); done('wish'); toast(`🏮 ${T.name} 마당 연등 줄에 연등을 달았어요` + tail, 3200); return; }
  hangWish(w); done('wish'); toast('🏮 순례 마당 소원 연등대에 연등을 걸었어요' + tail, 3200);
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
    if (!inside && cur && cur.pagoda && Math.hypot(avatar.position.x - cur.pagoda.x, avatar.position.z - cur.pagoda.z) < (cur.pagodaR || 2.7) + 1.9) acts.push(['🪷 탑돌이 시작', () => startTapdori(cur)]);
    if (bellHold) acts.push(['✋ 당목 줄 놓기', releaseBellRope]);
    else if (BELL && Math.hypot(avatar.position.x - BELL.x, avatar.position.z - BELL.z) < 4.2) acts.push(['🔔 당목 줄 잡기', grabBell]);
    if (!inside && cur && cur.sign && Math.hypot(lx - cur.sign.lx, lz - cur.sign.lz) < 2.5) acts.push(['🪷 스님 등록 신청', () => openMonkReq(), 'plain']); // 팻말 앞에 다가간 분께만, 눈에 띄는 빨간 버튼은 아님
    if (!inside && cur && cur.broomAt && !chore && Math.hypot(lx - cur.broomAt.lx, lz - cur.broomAt.lz) < 2.3) acts.push(['🧹 싸리비 들기 (마당 쓸기)', () => pickTool('broom')]);
    if (!inside && npc && npc.T === cur && !chore && Math.hypot(lx - npc.x, lz - npc.z) < 2.6) acts.push(['🧹 동자승과 같이 마당 쓸기', () => pickTool('broom')]);
    if (inside && !chore && !sit && !sam) acts.push(['🧽 걸레로 마루 닦기', () => pickTool('rag'), 'plain']);
    if (chore) acts.push([chore.kind === 'broom' ? '🧹 싸리비 내려놓기' : '🧽 걸레 내려놓기', () => dropTool(), 'plain']);
    if (RACK && Math.hypot(avatar.position.x - RACK.x, avatar.position.z - RACK.z) < 3.8) acts.push(['🏮 소원 연등 걸기', () => openWish('lantern')]);
    if (TILE && Math.hypot(avatar.position.x - TILE.x, avatar.position.z - TILE.z) < 4.2) acts.push(['✍️ 기와 올리기', () => openWish('tile')]);
    if (!inside && cur && cur.wishStone && !wsAnim && wsNear()) acts.unshift(wsStep === 1 ? ['🙏 마음속으로 소원 빌기', wsPray] : [wsStep === 2 ? '🪨 소원 빌고 다시 들어 보기' : '🪨 소원돌 들어 보기', () => liftStone(wsStep === 2)]);
    if (!inside && cur && cur.fish) { // 휴휴암: 판매대에서 물고기 밥·방생 물고기를 받아 연화대 끝에서 던지거나 놓아 줌
      const F = cur.fish, dSt = Math.hypot(lx - F.stall.lx, lz - F.stall.lz), dAt = Math.hypot(lx - F.at.lx, lz - F.at.lz);
      if (dSt < 3.2) {
        acts.push([fishFood > 0 ? `🛍️ 밥 더 받기 (${fishFood}줌)` : '🛍️ 물고기 밥 받기', () => { fishFood += 8; sound.bead(); toast('🛍️ 물고기 밥 한 봉지(8줌)를 받았어요 · 실제 휴휴암에서는 입구에서 현금 2,000원 · 연화대 끝에서 던지고 싶은 물을 클릭하세요', 4200); updateNear(); }]);
        if (!bucket) { acts.push(['🐟 방생 황어 5마리', () => takeBucket('hwangeo')]); acts.push(['🐟 방생 우럭 2마리', () => takeBucket('ureok')]); }
      }
      if (dAt < 4.6) {
        if (fishFood > 0) acts.push([`🐟 밥 던지기 (${fishFood}줌)`, throwFish]);
        if (bucket) acts.push(['🙏 방생하기', releaseFish]);
        if (!fishFood && !bucket) acts.push(['🛍️ 판매대로 가기', () => { const [x, z] = L2W(F.stall.lx, F.stall.lz + 1.6); goToW(x, z, avatar.position.y); }]);
      }
    }
  }
  if (!sam && !tapdori && !inside && !chore && cur && cur.spots) { // 안내판 가까이: 크게 펼쳐 읽기
    let bp = null, bd = 1e9; for (const p of cur.spots) { if (!p.board) continue; const d = Math.hypot(lx - p.lx, lz - p.lz); if (d < p.r && d < bd) { bd = d; bp = p; } }
    if (bp) acts.push(['📜 안내판 읽기', () => openBoard(bp.board)]); }
  if (tapdori) acts.push(['⏹ 탑돌이 멈추기', () => stopTapdori('탑돌이를 멈췄어요')]);
  const key = acts.map(a => a[0]).join('|'); ctxActs = acts;
  if (key === ctxKey) return; ctxKey = key; ctxBar.innerHTML = ''; ctxBar.classList.remove('open');
  const mkB = ([t, fn, kind], i, extra) => { const b = document.createElement('button'); b.textContent = t; if (i === 0 && kind !== 'plain') b.className = 'main'; if (extra) b.classList.add('extra'); b.onclick = () => { ctxBar.classList.remove('open'); fn(); }; return b; };
  if (document.body.classList.contains('touch') && acts.length > 1) { // 휴대폰: 길을 가리지 않게 첫 번째 할 일만 작게, 나머지는 ⋯ 를 눌러 펼침
    const row = document.createElement('div'); row.className = 'ctxRow'; row.appendChild(mkB(acts[0], 0));
    const more = document.createElement('button'); more.className = 'more'; more.textContent = '⋯'; more.setAttribute('aria-label', `다른 할 일 ${acts.length - 1}개`);
    more.onclick = () => { ctxBar.classList.toggle('open'); clearTimeout(ctxBar._t); if (ctxBar.classList.contains('open')) ctxBar._t = setTimeout(() => ctxBar.classList.remove('open'), 6000); };
    row.appendChild(more); ctxBar.appendChild(row); acts.slice(1).forEach((a, i) => ctxBar.appendChild(mkB(a, i + 1, true)));
  } else acts.forEach((a, i) => ctxBar.appendChild(mkB(a, i)));
}
function useContext() { if (ctxActs[0]) ctxActs[0][1](); else if (sit) standUp(); }
// 휴휴암 물고기 밥·방생
let fishFood = 0, bucket = null, bucketMesh = null;
function handLocal() { const fw = 0.55, x = avatar.position.x + Math.sin(avatar.rotation.y) * fw, z = avatar.position.z + Math.cos(avatar.rotation.y) * fw; const [lx, lz] = W2L(x, z); return { x: lx, y: avatar.position.y + 1.0, z: lz }; }
// 밥이 떨어질 곳: 화면 가운데(마우스 시점) 또는 누른 곳이 가리키는 물 위 — 노란 동그라미로 보여 주고, 클릭하면 그쪽으로 던짐
const _aimN = new THREE.Vector2(), _aimP = new THREE.Vector3(), _waterPl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.21);
let fishAimPt = null;
const fishAimMark = (() => {
  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: .9, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(.46, .58, 40), mat); ring.rotation.x = -Math.PI / 2; g.add(ring);
  for (let i = 0; i < 6; i++) { const d = new THREE.Mesh(new THREE.CircleGeometry(.045, 8), mat); d.rotation.x = -Math.PI / 2; const a = i / 6 * Math.PI * 2; d.position.set(Math.cos(a) * .2, .002, Math.sin(a) * .2); g.add(d); } // 밥알처럼 흩어진 점
  g.visible = false; g.renderOrder = 3; g.userData = { mat, t: 0 }; scene.add(g); return g;
})();
function fishAimAt(nx = 0, ny = 0) { // 화면 좌표(-1~1)가 가리키는 물 위 (사이트 좌표) · 물이 아니면 같은 방향의 가까운 물
  const S = cur.fish.school, [ax, az] = W2L(avatar.position.x, avatar.position.z);
  _aimN.set(nx, ny); ray.setFromCamera(_aimN, camera);
  let tx, tz; const dr = ray.ray.direction;
  if (dr.y < -.03 && ray.ray.intersectPlane(_waterPl, _aimP)) [tx, tz] = W2L(_aimP.x, _aimP.z);
  else [tx, tz] = W2L(avatar.position.x + dr.x * 20, avatar.position.z + dr.z * 20); // 멀리(하늘)를 보면 그 방향 끝까지
  let dx = tx - ax, dz = tz - az, d = Math.hypot(dx, dz); if (d < .05) return null; dx /= d; dz /= d; d = clamp(d, 2.4, 11);
  for (let k = 0; k < 44; k++) for (const sg of k ? [-1, 1] : [1]) { const dd = d + sg * k * .25; if (dd < 1.6 || dd > 12) continue; const x = ax + dx * dd, z = az + dz * dd; if (S.water(x, z, .45)) return { x, z }; }
  return null;
}
function nearEdge() { const F = cur && cur.fish; if (!F) return false; const [ax, az] = W2L(avatar.position.x, avatar.position.z); return Math.hypot(ax - F.at.lx, az - F.at.lz) < 4.6; }
function updateFishAim(dt) {
  const M = fishAimMark;
  fishAimPt = (fishFood > 0 || bucket) && !sit && !sam && nearEdge() ? fishAimAt(0, 0) : null;
  if (!fishAimPt) { M.visible = false; return; }
  if (!store.d.fishAimTip) { store.d.fishAimTip = 1; store.save(); toast(document.body.classList.contains('touch') ? '🎯 노란 동그라미가 밥이 떨어질 곳이에요 · 던지고 싶은 물 위를 톡 누르세요' : '🎯 노란 동그라미가 밥이 떨어질 곳이에요 · 마우스로 방향을 돌리고 클릭하면 그쪽으로 던져요', 4500); }
  const [x, z] = L2W(fishAimPt.x, fishAimPt.z); M.position.set(x, .22, z); M.visible = true;
  M.userData.t += dt; const k = 1 + Math.sin(M.userData.t * 5) * .08; M.scale.set(k, 1, k); M.rotation.y += dt * .6;
  M.userData.mat.color.set(fishFood > 0 ? '#ffd166' : '#8fe3ff'); // 밥: 노랑 · 방생: 하늘색
}
function towardAvatar(to, maxD) { // 방생은 양동이에서 쏟는 거라 너무 멀리는 못 감
  const [ax, az] = W2L(avatar.position.x, avatar.position.z), d = Math.hypot(to.x - ax, to.z - az); if (d <= maxD) return to;
  for (let dd = maxD; dd > 1.5; dd -= .3) { const x = ax + (to.x - ax) / d * dd, z = az + (to.z - az) / d * dd; if (cur.fish.school.water(x, z, .4)) return { x, z }; }
  return to;
}
function faceTo(to) { const [x, z] = L2W(to.x, to.z); avatar.rotation.y = Math.atan2(x - avatar.position.x, z - avatar.position.z); }
function throwFish(pt) {
  if (!cur || !cur.fish || fishFood <= 0) return;
  const F = cur.fish, to = pt || fishAimPt || fishAimAt(0, 0) || { x: F.feedTo.lx, z: F.feedTo.lz }; faceTo(to);
  fishFood--; F.school.throwFood(handLocal(), to, 24 + Math.floor(Math.random() * 8)); sound.bead();
  pose = 'bow'; poseT = 1.5; poseHold = false; // 팔을 앞으로 뻗듯 몸을 살짝 숙이며 던짐
  if (!store.d.fishTip) { store.d.fishTip = 1; store.save(); toast('🐟 황어 떼가 밥을 향해 몰려와요! 수천 마리가 사는 연화대 앞바다예요', 3600); }
  else if (!fishFood) toast('봉지가 비었어요 · 판매대에서 한 봉지 더 받을 수 있어요', 2600);
  updateNear();
}
function takeBucket(kind) {
  bucket = kind; sound.bead();
  if (!bucketMesh) { bucketMesh = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: '#3d7fc4', roughness: .5 }); const b = new THREE.Mesh(new THREE.CylinderGeometry(.16, .12, .24, 14, 1, true), m); m.side = THREE.DoubleSide; bucketMesh.add(b); const w = new THREE.Mesh(new THREE.CircleGeometry(.15, 14), new THREE.MeshStandardMaterial({ color: '#4fa3b8', roughness: .2 })); w.rotation.x = -Math.PI / 2; w.position.y = .08; bucketMesh.add(w); const hd = new THREE.Mesh(new THREE.TorusGeometry(.15, .012, 6, 16, Math.PI), MAT.line); hd.position.y = .12; bucketMesh.add(hd); }
  bucketMesh.position.set(.32, .45, .18); avatar.add(bucketMesh);
  toast(kind === 'ureok' ? '🪣 새끼 우럭 2마리를 양동이에 담았어요 (현장 2만 원) · 연화대 끝 바닷가에서 놓아 주세요' : '🪣 황어 5마리를 양동이에 담았어요 (현장 2만 원) · 연화대 끝 바닷가에서 놓아 주세요', 4200);
  updateNear();
}
function releaseFish(pt) {
  if (!cur || !cur.fish || !bucket) return;
  const F = cur.fish, to = towardAvatar(pt || fishAimPt || fishAimAt(0, 0) || { x: F.feedTo.lx, z: F.feedTo.lz }, 5); faceTo(to);
  F.school.release(bucket, handLocal(), to); sound.bell ? sound.bell(.25) : sound.bead(); pose = 'hap'; poseT = 0; poseHold = false;
  toast(bucket === 'ureok' ? '🙏 우럭이 깊은 바다로 헤엄쳐 가요 · 생명을 살리는 방생, 공덕을 지었어요' : '🙏 황어들이 무리 속으로 헤엄쳐 가요 · 생명을 살리는 방생, 공덕을 지었어요', 4200);
  bucket = null; if (bucketMesh) avatar.remove(bucketMesh); updateNear();
}
document.getElementById('btnSit').onclick = toggleSit;

// 용호사 소원돌: 소원 빌기 전에 한 번 들어 보고(가볍게 들림) → 마음속으로 소원을 빌고(합장) → 다시 들어 보면 꿈쩍하지 않음
// 소원돌은 늘 소원을 들어줌(빈 뒤엔 언제나 꿈쩍 않음) · 소원은 어디에도 적거나 보내지 않음
let wsStep = 0, wsAnim = null, wsClose = false; // wsClose: 돌을 잡으려고 받침 바로 앞까지 다가선 동안 (받침에 밀려나지 않게)
const wsEase = t => t * t * (3 - 2 * t), wsS = (a, b, t) => wsEase(clamp((t - a) / (b - a), 0, 1));
// 소원돌 들기 자세: 두 손은 돌 양옆을 잡고(IK) · 무릎을 굽혀 허리를 숙였다가 일어서며 들어 올림
const wsGrip = { w: 0, L: new THREE.Vector3(), R: new THREE.Vector3() };
const wsPose = { on: false, kneel: 0, bend: 0, headX: 0, headZ: 0, closed: false, walk: 0 };
const _wsC = new THREE.Vector3(), _wsX = new THREE.Vector3(), _wsF = new THREE.Vector3();
function wsNear() { const W = cur && cur.wishStone; if (!W) return false; const [x, z] = L2W(W.lx, W.lz); return Math.hypot(avatar.position.x - x, avatar.position.z - z) < 2.4; }
function wsStand() {
  const W = cur.wishStone, [sx, sz] = L2W(W.stand.lx, W.stand.lz), [x, z] = L2W(W.lx, W.lz);
  if (sit) standUp(); if (tapdori) stopTapdori(); if (chore) dropTool(true); moveTarget = null;
  avatar.position.set(sx, avatar.position.y, sz); avatar.rotation.y = Math.atan2(x - sx, z - sz);
  yaw = avatar.rotation.y - Math.PI * .53; dist = 3.3; pitch = .17; intro = -1; // 옆에서 낮게: 지붕 아래로 돌과 아기 스님의 두 손이 함께 보이게
}
function wsHands(W, w) { // 두 손 목표: 돌의 왼쪽·오른쪽 옆구리 (스님 쪽으로 살짝)
  W.stone.getWorldPosition(_wsC); const ry = avatar.rotation.y;
  _wsX.set(Math.cos(ry), 0, -Math.sin(ry)); _wsF.set(Math.sin(ry), 0, Math.cos(ry));
  const sd = W.r * 1.05 + .03;
  wsGrip.L.copy(_wsC).addScaledVector(_wsX, sd).addScaledVector(_wsF, -.035); wsGrip.L.y -= .012;
  wsGrip.R.copy(_wsC).addScaledVector(_wsX, -sd).addScaledVector(_wsF, -.035); wsGrip.R.y -= .012;
  wsGrip.w = w;
}
function wsSlide(A, k) { // 서는 자리(k=0) ↔ 잡는 자리(k=1) 사이를 걸음
  avatar.position.x = A.p0[0] + (A.p1[0] - A.p0[0]) * k; avatar.position.z = A.p0[1] + (A.p1[1] - A.p0[1]) * k;
}
function wsBegin(kind) {
  const W = cur && cur.wishStone; if (!W || wsAnim) return null; wsStand();
  const g = W.grip || W.stand, [gx, gz] = L2W(g.lx, g.lz);
  wsAnim = { kind, t: 0, W, T: cur, at: [avatar.position.x, avatar.position.z], p0: [avatar.position.x, avatar.position.z], p1: [gx, gz] };
  pose = null; poseHold = false; resetBody(); wsClose = true; Object.assign(wsPose, { on: true, kneel: 0, bend: 0, headX: 0, headZ: 0, closed: false, walk: 0 });
  return wsAnim;
}
function liftStone(heavy) {
  if (!wsBegin(heavy ? 'heavy' : 'light')) return; sound.bead();
  if (!heavy && !store.d.wsTip) { store.d.wsTip = 1; store.save(); toast('🪨 용호사 소원돌은 소원을 빌기 전에 한 번, 빈 뒤에 한 번 들어 보는 돌이에요 · 빈 뒤에 꿈쩍하지 않으면 소원을 들어준대요', 4200); }
  updateNear();
}
function wsPray() {
  if (!cur || !cur.wishStone || wsAnim) return; wsStand();
  wsAnim = { kind: 'pray', t: 0, W: cur.wishStone, T: cur, at: [avatar.position.x, avatar.position.z] };
  pose = 'hap'; poseT = .5; poseHold = true; sound.bell ? sound.bell(.12) : sound.bead();
  toast('🙏 눈을 감고 마음속으로 소원을 빌어 보세요 · 소원은 어디에도 적히지 않아요', 3400); updateNear();
}
function wsEnd(msg, step) {
  const A = wsAnim; if (!A) return; const W = A.W;
  W.stone.position.set(W.lx, W.top + W.r * .82, W.lz); W.stone.rotation.set(0, 0, 0);
  if (A.p0 && A.T === cur) wsSlide(A, 0); // 서는 자리로
  wsAnim = null; wsClose = false; wsPose.on = false; wsGrip.w = 0; poseHold = false; if (pose) { pose = null; resetBody(); }
  if (step !== undefined) wsStep = step; if (msg) toast(msg, 3800); updateNear();
}
// 머리 위 작은 표시: 땀방울(힘쓸 때) · !? (안 들릴 때) · 반짝(소원 성취) · 가뿐! (가볍게 들릴 때)
let wsEmo = null;
function wsEmote(kind, dur) {
  if (!wsEmo) {
    const mk = draw => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; draw(cv.getContext('2d')); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
    const drop = (c, x, y, s, r) => { c.save(); c.translate(x, y); c.rotate(r); c.scale(s, s); c.beginPath(); c.moveTo(0, -46); c.bezierCurveTo(14, -18, 30, 2, 30, 20); c.arc(0, 20, 30, 0, Math.PI); c.bezierCurveTo(-30, 2, -14, -18, 0, -46); c.closePath();
      c.fillStyle = '#7cc8f2'; c.fill(); c.lineWidth = 6; c.strokeStyle = '#2f7fb5'; c.stroke(); c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(-10, 18, 7, 12, -.4, 0, 7); c.fill(); c.restore(); };
    const star = (c, x, y, r, col) => { c.save(); c.translate(x, y); c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * .28 : r; c.lineTo(Math.sin(a) * rr, -Math.cos(a) * rr); } c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = 4; c.strokeStyle = 'rgba(150,100,10,.7)'; c.stroke(); c.restore(); };
    const word = (c, t, size, fill) => { c.font = `900 ${size}px "Noto Sans KR", "Malgun Gothic", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = 16; c.strokeStyle = '#fff'; c.strokeText(t, 128, 132); c.fillStyle = fill; c.fillText(t, 128, 132); };
    wsEmo = { sp: new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false })), kind: '', t: 0, dur: 0, tex: {
      sweat: mk(c => { drop(c, 150, 120, 1.25, .35); drop(c, 82, 160, .8, -.25); }),
      huh: mk(c => word(c, '!?', 170, '#c0392b')),
      wow: mk(c => { star(c, 128, 110, 70, '#ffd54f'); star(c, 54, 178, 34, '#ffe082'); star(c, 200, 190, 28, '#ffe082'); }),
      light: mk(c => word(c, '가뿐!', 92, '#2e7d32')),
    } };
    wsEmo.sp.renderOrder = 20; wsEmo.sp.visible = false; scene.add(wsEmo.sp);
  }
  wsEmo.kind = kind; wsEmo.t = 0; wsEmo.dur = dur; wsEmo.sp.material.map = wsEmo.tex[kind]; wsEmo.sp.material.needsUpdate = true; wsEmo.sp.visible = true;
}
const _emR = new THREE.Vector3();
function updateWsEmote(dt) {
  const E = wsEmo; if (!E || !E.sp.visible) return; E.t += dt;
  if (E.t > E.dur) { E.sp.visible = false; return; }
  const pop = E.t < .18 ? wsEase(E.t / .18) * 1.15 : E.t < .3 ? 1.15 - .15 * wsEase((E.t - .18) / .12) : 1, fade = clamp((E.dur - E.t) / .25, 0, 1);
  _emR.setFromMatrixColumn(camera.matrixWorld, 0); // 화면 오른쪽
  const bob = E.kind === 'sweat' ? Math.abs(Math.sin(E.t * 5)) * .04 : Math.sin(E.t * 3) * .015;
  E.sp.position.copy(avatar.position).addScaledVector(_emR, .34); E.sp.position.y += 1.14 + bob;
  E.sp.scale.setScalar(.36 * pop); E.sp.material.opacity = fade;
}
function updateWishStone(dt) {
  updateWsEmote(dt);
  const A = wsAnim; if (!A) return; A.t += dt; const W = A.W, st = W.stone, t = A.t, base = W.top + W.r * .82;
  if (A.T !== cur || Math.hypot(avatar.position.x - A.at[0], avatar.position.z - A.at[1]) > .9) { wsEnd('', A.kind === 'pray' ? 1 : wsStep); return; } // 걸어 나가면 멈춤
  if (A.kind === 'pray') {
    if (t > 3.6) { sound.chime(); wsEnd('🪨 소원을 빌었으면 소원돌을 다시 한 번 들어 보세요', 2); }
    return;
  }
  // 공통: 한 걸음 다가서기(0~.45) → 무릎 굽혀 허리 숙이고 두 손으로 잡기(.35~.8)
  const P = wsPose, heavy = A.kind === 'heavy', back = heavy ? 3.3 : 3.4;
  const inK = wsS(0, .45, t), outK = wsS(back, back + .45, t);
  wsSlide(A, inK * (1 - outK)); P.walk = (t < .45 || (t > back && t < back + .45)) ? .55 : 0;
  const crouch = wsS(.35, .8, t);
  // 돌의 위치 (받침 위 → 가슴 앞)
  const [ax, az] = W2L(avatar.position.x, avatar.position.z); let dx = W.lx - ax, dz = W.lz - az; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  const hx = ax + dx * .21, hz = az + dz * .21, hy = .43; // 가슴 앞에 안는 자리 (얼굴은 가리지 않게)
  if (!heavy) { // 가볍게: 들어 올림(.9~1.5) → 잠깐 들고 가뿐!(1.5~2.5) → 내려놓기(2.5~3.1) → 손 떼기(3.1~3.35)
    const up = wsS(.9, 1.5, t) * (1 - wsS(2.5, 3.1, t)), hold = t > 1.5 && t < 2.5 ? Math.sin((t - 1.5) / 1 * Math.PI) : 0;
    st.position.set(W.lx + (hx - W.lx) * up, base + (hy - base) * up + hold * .045, W.lz + (hz - W.lz) * up);
    st.rotation.set(0, 0, 0);
    P.bend = .5 * crouch * (1 - up) + .05 * up; P.kneel = .2 * crouch * (1 - up);
    P.headX = -.1 * hold; P.headZ = 0; P.closed = false;
    wsHands(W, crouch * (1 - wsS(3.1, 3.35, t)));
    if (t > 1.55 && !A.said) { A.said = 1; wsEmote('light', 1.1); }
    if (t > 3.05 && !A.down) { A.down = 1; sound.bead(); }
    if (t > back + .5) { wsEnd('🪨 돌이 가볍게 들렸어요 · 이제 마음속으로 소원을 빌어 보세요', 1); }
  } else { // 다시 들기: 영차·영차·영차 세 번 힘을 줘도 꿈쩍하지 않음 → 손을 떼고 !? → 서는 자리로
    const strain = wsS(.85, 1.0, t) * (1 - wsS(2.6, 2.8, t)), ph = Math.max(0, t - .9), pulse = strain * (.5 - .5 * Math.cos(ph * 2 * Math.PI / .62));
    P.bend = .5 * crouch * (1 - wsS(2.75, 3.1, t)) - .18 * pulse; P.kneel = (.2 + .08 * pulse) * crouch * (1 - wsS(2.75, 3.1, t));
    P.headX = -.14 * pulse + .06 * wsS(2.8, 3.0, t) * (1 - wsS(3.4, 3.7, t)); P.headZ = Math.sin(t * 41) * .03 * strain;
    P.closed = strain > .3; // 질끈 감은 눈
    const k = strain;
    st.position.set(W.lx + Math.sin(t * 41) * .006 * k, base + (.5 + .5 * Math.sin(t * 27)) * .005 * k + .003 * pulse, W.lz + Math.sin(t * 33 + 1) * .004 * k);
    st.rotation.z = Math.sin(t * 29) * .035 * k;
    wsHands(W, crouch * (1 - wsS(2.7, 2.95, t)));
    if (t > 1.15 && !A.sweat) { A.sweat = 1; wsEmote('sweat', 1.6); }
    if (t > 2.8 && !A.huh) { A.huh = 1; wsEmote('huh', 1.1); sound.bead(); }
    if (t > back + .5) {
      store.count('wishstone'); sound.chime();
      wsEnd('🪨 돌이 꿈쩍도 하지 않네요 · 소원돌이 소원을 들어준대요 🙏', 0);
      avatar.rotation.y += Math.PI; yaw = avatar.rotation.y + .3; dist = 3.2; pitch = .2; // 마당 쪽으로 돌아서서 웃으며 합장 (얼굴이 보이게)
      pose = 'hap'; poseT = 0; poseHold = false; wsEmote('wow', 2.4); // 합장으로 마무리 + 반짝
    }
  }
}

// 매 프레임: 연기 · 종 · 표시
function updateWorld(dt) {
  updateFishAim(dt);
  updateWishStone(dt);
  if (bellCool > 0) bellCool -= dt;
  updateBell(dt);
  WT.update(dt, avatar.position.x, avatar.position.z); // 누른 곳 동그라미·길 점선
  for (const T of temples) if (T.anim && T === cur) T.anim(dt); // 지금 있는 사찰만 (황어 떼 등)
  for (let i = GROW.length - 1; i >= 0; i--) { const it = GROW[i]; it.userData.grow = Math.min(1, it.userData.grow + dt * 2); it.scale.setScalar((.01 + .99 * it.userData.grow) * (it.userData.base || 1)); if (it.userData.grow >= 1) { delete it.userData.grow; GROW.splice(i, 1); } }
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
    a.href = url; a.download = `수월-${cur ? cur.name : REGION.name}-${ts}.png`; a.click();
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
  if (TILE) mapSpots.push({ n: '기와 불사', x: TILE.x, z: TILE.z, go: () => { avatar.position.set(TILE.stand[0], 0, TILE.stand[1]); avatar.rotation.y = Math.atan2(TILE.x - TILE.stand[0], TILE.z - TILE.stand[1]); yaw = avatar.rotation.y + Math.PI; dist = 6; pitch = .24; } });
  if (RACK) mapSpots.push({ n: '소원 연등대', x: RACK.x, z: RACK.z, go: () => { avatar.position.set(RACK.stand[0], 0, RACK.stand[1]); avatar.rotation.y = Math.atan2(RACK.x - RACK.stand[0], RACK.z - RACK.stand[1]); yaw = avatar.rotation.y + Math.PI; dist = 6; pitch = .24; } });
  for (const sp of mapSpots) { const [x, y] = P(sp.x, sp.z); sp.px = x; sp.py = y; if (sp.n === '순례 마당' || sp.small) continue; c.fillStyle = '#9b3b2b'; c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); }
  for (const sp of mapSpots.filter(q => !temples.some(T => T.name === q.n))) { c.fillStyle = sp.small ? '#6d5f4b' : '#2e8b74'; c.beginPath(); c.arc(sp.px, sp.py, sp.small ? 5 : 8, 0, 7); c.fill(); c.font = `600 ${sp.small ? 15 : 19}px sans-serif`; c.textAlign = 'center'; c.fillStyle = '#3d2a1c'; c.fillText(sp.small ? sp.n.replace(/^.* /, '') : sp.n, sp.px, sp.py - 12); }
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
    el.innerHTML = `<b>${r.name}${r === REGION ? ' · 지금 여기' : ''}</b>`;
    // 모든 지역에 절 이름 버튼: 지금 지역은 바로 걸어가고, 다른 지역은 그 지역을 불러와 그 절 앞에 섬
    const go = document.createElement('div'); go.className = 'go';
    const far = (tn) => { if (OFFLINE) { try { sessionStorage.setItem('jeollo.t', tn || ''); } catch (e) { } location.hash = r.id; location.reload(); return; } const q = new URLSearchParams(location.search); q.set('r', r.id); if (tn) q.set('t', tn); else q.delete('t'); location.search = q.toString(); };
    if (r === REGION) for (const T of temples) { const bt = document.createElement('button'); bt.textContent = T.name; bt.dataset.r = r.id; bt.dataset.t = T.name; bt.onclick = e => { e.stopPropagation(); regionModal.classList.remove('show'); goTemple(T); }; go.appendChild(bt); }
    else { for (const t of r.temples) { const bt = document.createElement('button'); bt.textContent = t.name; bt.dataset.r = r.id; bt.dataset.t = t.name; bt.onclick = e => { e.stopPropagation(); far(t.name); }; go.appendChild(bt); } el.onclick = () => far(null); }
    el.appendChild(go);
    regionList.appendChild(el);
  }
  // 작은 절 제보: 스님·종무소·신도가 알려 주면 검토해서 넣음
  const rp = document.createElement('div'); rp.className = 'rg report';
  rp.innerHTML = `<b>🙏 우리 절도 넣어 주세요</b><span>지도에 없는 작은 절을 알려 주시면 검토해서 실제 모습대로 순례길에 넣어요 · 스님·종무소·신도 누구나</span><div class="go"><button>사찰 제보하기</button></div>`;
  if (OFFLINE) rp.innerHTML = `<b>🙏 우리 절도 넣어 주세요</b><span>사찰 제보는 사이트에서 받아요 · temple-meta.vercel.app</span><div class="go"><a href="${SITE}" target="_blank" rel="noopener" style="display:inline-block;border-radius:99px;padding:5px 10px;font-size:12px;font-weight:600;background:var(--accent);color:#fff;text-decoration:none">사이트에서 제보하기</a></div>`;
  else rp.onclick = () => { regionModal.classList.remove('show'); import('./report.js?v=5').then(m => m.openReport({ sido: REGION.name.split('·')[0], toast })); };
  regionList.appendChild(rp);
  regionModal.classList.add('show');
  if (!OFFLINE) monkRoster(true).then(list => { // 지금 접속해 계신 인증 스님의 절에 🪷 표시
    for (const bt of regionList.querySelectorAll('button[data-t]')) {
      const here = list.filter(m => m.live && m.cur_region === bt.dataset.r && m.cur_temple === bt.dataset.t);
      if (here.length) { bt.classList.add('monkHere'); bt.textContent = '🪷 ' + bt.dataset.t; bt.title = here.map(m => `${m.temple} ${m.name} 스님`).join(', ') + ' 계심'; }
    }
  });
}
document.getElementById('btnRegion').onclick = openRegions;
document.getElementById('regionClose').onclick = () => regionModal.classList.remove('show');
regionModal.addEventListener('pointerdown', e => { if (e.target === regionModal) regionModal.classList.remove('show'); });

/* ───────── 함께 순례하기: 같은 권역 접속자 보이기 · 기와·연등 함께 보기 ───────── */
const ME = myIdentity();
let NET = null, onlineOffers = false;
const seenOffer = new Set(), peers = new Map();
const peopleBtn = document.getElementById('btnPeople'), peoplePanel = document.getElementById('peoplePanel');
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BAD = /(씨발|시발|ㅅㅂ|ㅆㅂ|병신|ㅂㅅ|개새|좆|존나|썅|니미|fuck|shit)/i;
function nickSprite(nick) {
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 72; const c = cv.getContext('2d');
  c.font = '600 32px "Noto Sans KR",sans-serif'; const w = Math.min(310, c.measureText(nick).width + 40);
  c.fillStyle = 'rgba(255,250,240,.9)'; c.beginPath(); if (c.roundRect) c.roundRect((320 - w) / 2, 8, w, 56, 28); else c.rect((320 - w) / 2, 8, w, 56); c.fill();
  c.fillStyle = '#5a3a22'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(nick, 160, 37);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true })); sp.scale.set(1.3, .29, 1); sp.position.y = 1.52; sp.renderOrder = 5; return sp;
}
// 인증된 스님 이름표: 금빛 바탕 + 🪷 (서버 명단의 공개키로 서명이 맞을 때만)
function monkSprite(text) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 84; const c = cv.getContext('2d');
  c.font = '700 32px "Noto Sans KR",sans-serif'; const w = Math.min(500, c.measureText(text).width + 48);
  const gr = c.createLinearGradient(0, 8, 0, 76); gr.addColorStop(0, '#fff1bf'); gr.addColorStop(1, '#f0c862');
  c.fillStyle = gr; c.strokeStyle = '#b07a1e'; c.lineWidth = 3; c.beginPath(); if (c.roundRect) c.roundRect((512 - w) / 2, 10, w, 62, 31); else c.rect((512 - w) / 2, 10, w, 62); c.fill(); c.stroke();
  c.fillStyle = '#4a2a0c'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 42);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true })); sp.scale.set(2.05, .34, 1); sp.position.y = 1.56; sp.renderOrder = 6; return sp;
}
// 가사(袈裟): 괴색 조각 천을 이어 붙인 모양, 왼쪽 어깨에서 오른쪽 옆구리로 비스듬히 두름 · 가슴뼈에 붙여 절·앉기 동작을 따라감
let KASAYA_MAT = null;
function kasayaMat() { // 붉은 가사: 조각 천(조·엽)을 금빛 테로 이어 붙인 모양 — 기본 아기 스님의 갈색 가사와 한눈에 구분
  if (KASAYA_MAT) return KASAYA_MAT;
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192; const c = cv.getContext('2d');
  c.fillStyle = '#a5321f'; c.fillRect(0, 0, 512, 192);
  for (let i = 0; i < 14; i++) for (let k = 0; k < 3; k++) { c.fillStyle = (i + k) % 2 ? 'rgba(60,0,0,.12)' : 'rgba(255,190,150,.07)'; c.fillRect(i * 36.6, k * 64, 36.6, 64); }
  c.strokeStyle = '#d9ad52'; c.lineWidth = 4; for (let x = 0; x <= 512; x += 36.6) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 192); c.stroke(); }
  for (const y of [64, 128]) { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); }
  c.lineWidth = 9; c.strokeRect(4, 4, 504, 184);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  return KASAYA_MAT = new THREE.MeshStandardMaterial({ map: t, roughness: .8, side: THREE.DoubleSide });
}
function addKasaya(m) { // 몸통을 두르고 왼쪽 어깨로 넘어가는 가사 · 가슴뼈에 붙여 절·앉기 동작을 따라감
  if (!m || m.kasaya || !m.B) return; const sp = m.B.Spine2 || m.B.Spine1 || m.B.Spine; if (!sp) return;
  m.root.updateMatrixWorld(true);
  const c = sp.getWorldPosition(new THREE.Vector3()); m.root.worldToLocal(c);
  const u = 1, mat = kasayaMat(); // 모델 자체 단위(키 1.11)로 만듦 → 아바타 전체 크기(0.74 등)는 그대로 따라감
  const g = new THREE.Group();
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(.176 * u, .228 * u, .35 * u, 32, 1, true), mat); wrap.rotation.z = .3; wrap.castShadow = true; g.add(wrap);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(.15 * u, .045 * u, 6, 20, Math.PI), mat); strap.rotation.y = Math.PI / 2; strap.scale.set(1, 1, .32); strap.position.set(.1 * u, .075 * u, .005 * u); g.add(strap); // 왼쪽 어깨 자락
  g.position.set(c.x, .395 * u, c.z + .008 * u);
  m.root.add(g); m.root.updateMatrixWorld(true); sp.attach(g); m.kasaya = g;
}
function removeKasaya(m) { if (m && m.kasaya) { m.kasaya.removeFromParent(); m.kasaya = null; } }
function refreshLabel(P) {
  if (P.label) { P.g.remove(P.label); P.label.material.map.dispose(); }
  P.label = P.monk ? monkSprite(monkLabel(P.monk)) : nickSprite(plainNick(P.nick) || '순례자'); P.g.add(P.label);
}
function setPeerMonk(P, info) {
  if ((P.monk && P.monk.id) === (info && info.id)) return;
  P.monk = info; refreshLabel(P);
  if (P.glb) { if (info) addKasaya(P.glb); else removeKasaya(P.glb); }
  renderPeople();
}
function ensurePeer(id, nick) {
  let P = peers.get(id);
  if (!P) {
    const g = new THREE.Group(); g.visible = false; scene.add(g);
    P = { id, nick: '', g, glb: null, label: null, goal: null, goalSt: null, st: { sit: 0, walkAmp: 0, speed: 0, hap: 0, kneel: 0, bend: 0, headX: 0, headZ: 0, closed: false, blink: false }, last: 0, blinkT: 2 + Math.random() * 3 };
    peers.set(id, P);
    if (peers.size <= 16) loadMonkGLB(MONK_URL, { closedUrl: MONK_CLOSED }).then(m => { if (peers.get(id) !== P) return; P.glb = m; g.add(m.root); if (P.monk) addKasaya(m); }).catch(e => dbg('peerModelError', e.message)); // 16명까지 아기 스님 모습, 그 이상은 이름표만
  }
  if (nick && nick !== P.nick) { P.nick = nick; refreshLabel(P); }
  return P;
}
function removePeer(id) { const P = peers.get(id); if (!P) return; if (bellRemote && bellRemote.id === id) bellRemote = null; P.g.removeFromParent(); if (P.wbroom) P.wbroom.removeFromParent(); peers.delete(id); }
function onPeers(state) {
  const keys = new Set(Object.keys(state).filter(k => k !== ME.id));
  for (const k of keys) {
    const a = state[k], meta = a && a[0], P = ensurePeer(k, meta && meta.nick), mk = meta && meta.mk;
    if (mk) checkBadge(k, mk).then(info => { const P2 = peers.get(k); if (P2) setPeerMonk(P2, info); }); else if (P.monk) setPeerMonk(P, null);
  }
  for (const id of [...peers.keys()]) if (!keys.has(id)) removePeer(id);
  renderPeople();
}
function onState(p) {
  const P = ensurePeer(p.id, p.n);
  let x = p.x, z = p.z;
  // 절 마당 안에서는 '그 절 기준 위치'로 받아서, 기기마다 법당 크기가 조금 달라도 같은 자리에 보이게
  if (p.tn) { const T = temples.find(t => t.name === p.tn); if (T) { setFrame(T); [x, z] = L2W(p.lx, p.lz); if (cur) setFrame(cur); } }
  P.goal = { x, y: p.y || 0, z, ry: p.ry || 0 };
  const s = p.s || [];
  if ((p.tl || 0) !== (P.tl || 0)) { P.tl = p.tl || 0; if (P.toolM) { P.toolM.removeFromParent(); P.toolM = null; } if (P.tl) P.toolM = holdTool(P.glb ? P.glb.root : P.g, P.tl === 1 ? 'broom' : 'rag'); } // 함께 운력: 다른 분의 비·걸레
  P.goalSt = { sit: s[0] || 0, walkAmp: s[1] || 0, speed: s[2] || 0, hap: s[3] || 0, kneel: s[4] || 0, bend: s[5] || 0, headX: s[6] || 0, headZ: s[7] || 0, closed: !!s[8] };
  const b = Array.isArray(p.b) ? p.b : null; P.bell = b ? +b[0] || 0 : 0; P.back = !!(b && b[3]); // 범종 당목
  if (b && !bellHold) bellRemote = { id: p.id, nick: p.n, mode: P.bell, th: (+b[1] || 0) / 1000, om: (+b[2] || 0) / 1000, back: P.back, t: performance.now() };
  else if (!b && bellRemote && bellRemote.id === p.id) bellRemote = null;
  if (!P.last) { P.g.position.set(x, P.goal.y, z); P.g.rotation.y = P.goal.ry; }
  P.last = performance.now(); P.g.visible = true;
}
function updatePeers(dt) {
  const k = Math.min(1, dt * 9); // 접속 목록(presence)에서 나가면 사라짐 · 다른 창을 보고 있으면 마지막 자세로 멈춰 있음
  for (const P of peers.values()) {
    if (!P.goal) continue;
    const g = P.g; g.position.x += (P.goal.x - g.position.x) * k; g.position.y += (P.goal.y - g.position.y) * k; g.position.z += (P.goal.z - g.position.z) * k;
    let d = P.goal.ry - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += d * k;
    if (P.glb && P.goalSt) {
      const S = P.st, G = P.goalSt; for (const key of ['sit', 'walkAmp', 'speed', 'hap', 'kneel', 'bend', 'headX', 'headZ']) S[key] += (G[key] - S[key]) * k; S.closed = G.closed;
      P.blinkT -= dt; S.blink = P.blinkT < .12; if (P.blinkT < 0) P.blinkT = 2 + Math.random() * 3;
      const pc = P.tl === 1 && SWEEP_OK && P.glb.hasClip('sweep'); S.sweep = pc ? 1 : 0; if (pc) S.bend = 0;
      if (P.grip && !(P.bell > 0 && bellRemoteOn() && bellRemote.id === P.id)) P.grip.w = Math.max(0, P.grip.w - dt * 5); // 당목 줄을 놓으면 손을 내림
      S.grip = P.grip && P.grip.w > .02 ? P.grip : null; S.back = P.bell > 0 && P.back;
      P.glb.update(dt, S); applyWob(P.glb.root, dt, P);
      if (pc) { if (P.toolM) { P.toolM.removeFromParent(); P.toolM = null; } if (!P.wbroom) { P.wbroom = makeBroom(); scene.add(P.wbroom); } g.updateMatrixWorld(true); gripBroom(P.wbroom, P.glb, g.position.y); }
      else if (P.wbroom) { P.wbroom.removeFromParent(); P.wbroom = null; if (P.tl === 1) P.toolM = holdTool(P.glb.root, 'broom'); }
      if (P.toolM && P.tl === 1) { P.ph = (P.ph || 0) + dt * (3 + S.speed * 1.6) * (S.walkAmp > .2 ? 1 : 0); P.toolM.rotation.y = Math.sin(P.ph) * .55 * S.walkAmp; }
    }
  }
}
let netT = 0, netBeat = 0, lastSent = '';
function netTick(dt, ST) {
  if (!NET || !NET.joined) return;
  netT += dt; netBeat += dt; if (netT < .11) return; netT = 0;
  const q = v => Math.round(v * 100) / 100, x = avatar.position.x, z = avatar.position.z;
  let tn = '', lx = 0, lz = 0;
  if (cur && cur.YARD) { const [a, b] = W2L(x, z), Y = cur.YARD; if (a > Y.x0 - 4 && a < Y.x1 + 4 && b > Y.z0 - 4 && b < Y.z1 + 6) { tn = cur.name; lx = q(a); lz = q(b); } }
  const s = [q(ST.sit), q(ST.walkAmp), q(ST.speed), q(ST.hap), q(ST.kneel), q(ST.bend), q(ST.headX), q(ST.headZ), ST.closed ? 1 : 0];
  const msg = { id: ME.id, n: ME.nick, tn, lx, lz, x: q(x), z: q(z), y: q(avatar.position.y), ry: q(avatar.rotation.y), s, tl: chore ? (chore.kind === 'broom' ? 1 : 2) : 0 };
  if (BELL && (bellHold || bellCtrlT > 0)) msg.b = [bellHold ? (bellHold.pulling ? 2 : 1) : 0, Math.round(BELL.theta * 1000), Math.round(BELL.omega * 1000), bellHold && bellStep.back ? 1 : 0]; // 범종 당목: 잡음/당김·각도·속도·뒷걸음
  const key = JSON.stringify(msg);
  if (key === lastSent && netBeat < (msg.b ? .5 : 2)) return; // 가만히 있으면 2초에 한 번만 (당목 줄을 잡고 있으면 0.5초)
  lastSent = key; netBeat = 0; NET.send(msg);
}
function renderPeople() {
  const n = peers.size + 1; if (peopleBtn) peopleBtn.textContent = `👥 ${n}`;
  if (!peoplePanel || !peoplePanel.classList.contains('show')) return;
  const ps = [...peers.values()].sort((a, b) => !!b.monk - !!a.monk);
  const list = ps.map(P => P.monk ? `<div class="monk">${esc(monkLabel(P.monk))}</div>` : `<div>🙏 ${esc(plainNick(P.nick) || '순례자')}</div>`).join('') || '<div class="empty">아직 다른 분이 없어요. 주소를 보내 함께 걸어 보세요</div>';
  const mm = myMonk();
  const monkBox = OFFLINE ? '' : mm ? `<div class="monkme on">${esc(monkLabel(mm))} · 인증된 기기예요<button id="monkOff">인증 풀기</button></div>` : `<div class="monkme"><a href="#" id="monkOpen">🪷 스님이신가요? 인증 코드 넣기</a> <a href="#" id="monkReq" style="font-weight:500;color:#8a7a62">· 코드 신청</a><span id="monkForm" hidden><input id="monkCode" maxlength="11" placeholder="초대 코드 (예: ABCD-EFGH)" autocomplete="off" autocapitalize="characters"><button id="monkGo">인증</button></span></div>`;
  const st = NET && NET.joined ? '' : ' (연결 중…)';
  peoplePanel.innerHTML = `<b>함께 순례 중 · ${n}명</b><small>${REGION.name} 권역에 지금 접속한 분들이에요${st}</small><div class="me">내 법명 <input id="nickIn" maxlength="12" value="${esc(ME.nick)}"><button id="nickSave">바꾸기</button></div>${monkBox}${list}`;
  wireMonkBox();
  document.getElementById('nickSave').onclick = () => {
    const v = document.getElementById('nickIn').value.trim().replace(/\s+/g, ' ').slice(0, 12);
    if (!v) return; if (BAD.test(v)) { toast('고운 이름으로 지어 주세요'); return; }
    if (plainNick(v) !== v && !myMonk()) { toast('🪷 스님 표시는 인증된 스님만 쓸 수 있어요 · 스님이시면 아래에서 인증 코드를 넣어 주세요', 3600); return; }
    ME.nick = v; saveNick(v); if (NET) NET.retrack(); lastSent = ''; toast(`🙏 이제 '${v}'(으)로 보여요`); renderPeople();
  };
}
function openMonkReq(T = cur) { // 주지스님 등록 신청 (일주문 옆 팻말·👥 창)
  if (!T) return; if (OFFLINE) { window.open(SITE, '_blank', 'noopener'); return; }
  import('./report.js?v=5').then(m => m.openMonkRequest({ temple: T.name, region: REGION.name, where: T.where || '', sido: REGION.name.split('·')[0] }));
}
function wireMonkBox() {
  const $ = id => document.getElementById(id);
  if ($('monkReq')) $('monkReq').onclick = e => { e.preventDefault(); openMonkReq(); };
  if ($('monkOpen')) $('monkOpen').onclick = e => { e.preventDefault(); $('monkOpen').hidden = true; $('monkForm').hidden = false; $('monkCode').focus(); };
  const go = async () => {
    const b = $('monkGo'), v = $('monkCode').value; if (!v.trim()) return; b.disabled = true;
    try { const m = await redeem(v); toast(`🪷 ${m.temple} ${m.name} 스님, 인증되었어요 · 이제 다른 순례자에게 스님으로 보여요`, 4200); await applyMyMonk(); }
    catch (e) { b.disabled = false; toast('🪷 ' + monkError(e), 3800); }
  };
  if ($('monkGo')) { $('monkGo').onclick = go; $('monkCode').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') go(); }; }
  if ($('monkOff')) $('monkOff').onclick = async () => { if (!window.confirm('이 기기의 스님 인증을 풀까요? 다시 하려면 관리자에게 새 코드를 받아야 해요.')) return; await forgetMonk(); await applyMyMonk(); toast('인증을 풀었어요'); };
}
// 내가 인증된 스님이면: 머리 위 금빛 이름표 + 가사, 2분마다 서명 표식 갱신·서버에 '지금 여기 계심' 알림
let myMonkLabel = null, monkTimer = 0, monkPingAt = 0, monkPingTemple = null;
async function applyMyMonk() {
  const mm = myMonk();
  if (myMonkLabel) { avatar.remove(myMonkLabel); myMonkLabel.material.map.dispose(); myMonkLabel = null; }
  if (mm) { myMonkLabel = monkSprite(monkLabel(mm)); avatar.add(myMonkLabel); if (glb) addKasaya(glb); else monkGlbWait = true; }
  else removeKasaya(glb);
  if (NET) NET.retrack(); lastSent = ''; renderPeople();
  clearInterval(monkTimer); monkTimer = 0;
  if (mm && NET) { monkPing(true); monkTimer = setInterval(() => { if (NET) NET.retrack(); monkPing(true); }, 120e3); }
}
let monkGlbWait = false;
async function monkPing(force = false) {
  if (!myMonk() || OFFLINE) return; const tn = cur ? cur.name : '';
  if (!force && tn === monkPingTemple && Date.now() - monkPingAt < 30e3) return;
  monkPingAt = Date.now(); monkPingTemple = tn;
  const r = await pingMonk(REGION.id, tn);
  if (r && r.revoked) { toast('🪷 이 기기의 스님 인증이 해제되었어요', 3600); applyMyMonk(); }
}
if (peopleBtn) peopleBtn.onclick = () => { ['todoPanel', 'soundPanel'].forEach(i => document.getElementById(i).classList.remove('show')); peoplePanel.classList.toggle('show'); renderPeople(); };
function hangOffer(r, fresh) {
  const w = { c: r.color || '#ffd86a', t: r.body, at: Date.parse(r.created_at) };
  if (r.kind === 'tile') hangTile(w, fresh);
  else if (r.kind === 'rack') hangWish(w, fresh);
  else { const T = temples.find(t => t.name === r.temple); if (T) hangTempleLantern(T, w, fresh); }
}
function applyOffers(rows) {
  const pick = (f, n) => rows.filter(f).slice(0, n).reverse();
  const list = [...pick(r => r.kind === 'tile', 24), ...pick(r => r.kind === 'rack', 16), ...temples.flatMap(T => pick(r => r.kind === 'lantern' && r.temple === T.name, 30))];
  for (const r of list) { seenOffer.add(r.id); hangOffer(r, false); }
}
function onOffer(r) {
  if (!r || seenOffer.has(r.id)) return; seenOffer.add(r.id); hangOffer(r, true); if (r.kind === 'tile') setTileCount((TILE ? TILE.count : 0) + 1);
  const where = r.kind === 'tile' ? '기와 불사 자리에 기와를' : r.kind === 'rack' ? '소원 연등대에 연등을' : `${r.temple} 마당에 연등을`;
  toast(`${r.kind === 'tile' ? '✍️' : '🏮'} ${r.nick || '순례자'}님이 ${where} 올렸어요`, 2600);
}
function hangLocal() { for (const w of store.wishes(REGION.id)) hangWish(w, false); for (const w of store.tiles(REGION.id)) hangTile(w, false); setTileCount(Math.max(TILE ? TILE.count : 0, store.tiles(REGION.id).length)); for (const T of temples) for (const w of store.tlan(T.name)) hangTempleLantern(T, w, false); }
async function startTogether() {
  if (OFFLINE) { hangLocal(); return; }
  await loadMonk().catch(() => null);
  try { NET = await connectTogether({ region: REGION.id, me: ME, onPeers, onState, onOffer, onEvent: onNetEvent, onStatus: s => { DBG.net = s; renderPeople(); }, extra: async () => { const b = await monkBadge(ME.id); return b ? { mk: b } : {}; } }); }
  catch (e) { dbg('netError', e.message); hangLocal(); return; }
  if (myMonk()) applyMyMonk();
  try { const rows = await Promise.race([NET.load(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 7000))]); applyOffers(rows); onlineOffers = true; DBG.offers = rows.length; setTileCount(rows.filter(r => r.kind === 'tile').length); NET.count('tile').then(setTileCount).catch(() => { }); }
  catch (e) { dbg('offerLoadError', e.message); hangLocal(); }
}

/* ───────── 시작 ───────── */
(async function start() {
  const badge = document.getElementById('badge');
  document.querySelector('#title h1').innerHTML = `${REGION.name} 사찰 순례 <small>${REGION.temples.map(t => t.name).join(' · ')}</small>`;
  let ok = 0;
  const list = await Promise.all(REGION.temples.map(async t => {
    const T = { ...t, hallName: t.hall, via: '' };
    const pt = await findHallPoint(t); T.ref = mkRef(pt.lat, pt.lng); T.via = pt.via;
    try {
      const d = await vworldBuildings(T.ref), r = d && d.response;
      if (!r || r.status !== 'OK') { const e = r && r.error; throw new Error(e ? `${e.code} ${e.text}` : r && r.status === 'NOT_FOUND' ? '주변 건물 자료 없음(기본 크기로 지음)' : '응답 형식 오류'); }
      T.info = pickHall(r.result.featureCollection.features, T.ref, t.name, !!t.addr && /^도로명주소/.test(T.via));
      if (!T.info) throw new Error('법당 건물을 찾지 못함');
      ok++;
    } catch (e) { dbg('vworld.' + t.name, e.message); T.info = defaultHall(); }
    return T;
  }));
  temples.push(...list);
  badge.textContent = ok === list.length ? `실제 법당 ${ok}곳 위치·크기 반영` : ok ? `실제 법당 ${ok}/${list.length}곳 반영 · 나머지는 기본 크기` : '브이월드 연결 실패 · 기본 법당으로 보여드려요';
  if (ok < list.length) badge.classList.add('err');
  layoutRegion(temples);
  for (const T of temples) { try { buildSite(T.info, T); } catch (e) { dbg('buildError.' + T.name, e.message); console.error('buildError', T.name, e.stack); } }
  // 법당 조명은 한 벌만 두고 지금 사찰로 옮겨 다님 (조명이 사찰 수만큼 늘면 무거워져서)
  sharedLights = temples[0].hall.lights;
  for (const T of temples) { T.lightPos = T.hall.lights.map(l => l.position.clone()); if (T !== temples[0]) T.hall.lights.forEach(l => l.removeFromParent()); }
  try { buildBackdrop(scene, ENV, RB); } catch (e) { dbg('backdropError', e.message); }
  buildCommons();
  try { plantTrees(); } catch (e) { dbg('treeError', e.message); }
  enshrineStatues();
  startTogether();
  useTemple(temples[0]);
  placeAtStart();
  camera.position.set(temples[0].ux * 6, 2.2, temples[0].uz * 6);
  await Promise.race([glbReady, new Promise(r => setTimeout(r, 9000))]); // 모델이 늦으면 9초 뒤 코드 아바타로 먼저 시작
  document.getElementById('loading').classList.add('hide');
  if (document.body.classList.contains('touch')) { let seen = true; try { seen = !!localStorage.getItem('suwol.tapHint'); localStorage.setItem('suwol.tapHint', '1'); } catch (e) { } if (!seen) setTimeout(() => toast('👆 가고 싶은 곳을 톡 누르면 금빛 동그라미가 생기고 그리로 걸어가요', 4200), 7000); }
  canvas.focus();
  loop();
  setTimeout(() => toast('🙏 수월하세요 · 오늘 하루도 수월하시길 바라요', 3200), 900); // 수월의 인사
  initStats({ getNick: () => ME.nick, isSitting: () => !!sit, monkSig: c => monkBadge(c) }); initRanks(); // 🏆 순위: 절 · 좌선 · 머문 시간
  initMobileClean(); // 휴대폰: 버튼은 메뉴(☰)·기도(🙏)로 모으고 화면을 넓게
  if (document.body.classList.contains('touch') && !store.d.joyTip) setTimeout(() => { store.d.joyTip = 1; store.save(); toast('👈 아래 동그라미를 밀면 걷고, 땅을 톡 누르면 그곳으로 가요', 4200); }, 4800);
  { let tq = QS.get('t'); if (!tq && OFFLINE) { try { tq = sessionStorage.getItem('jeollo.t'); sessionStorage.removeItem('jeollo.t'); } catch (e) { } } const T = tq && temples.find(t => t.name === tq); if (T) { goTemple(T); intro = -1; } } // 다른 지역 창에서 '○○사 가기'로 왔으면 그 절 앞으로
  if (!QS.get('r') && !REGIONS.some(r => r.id === HASH_R) && !QS.has('dbg')) setTimeout(openRegions, 4200); // 처음 오면 지역 고르기를 보여 줌
})();

// 점검용 (주소에 ?dbg 가 있을 때만): 카메라·자세를 고정해 확인
if (/[?&]dbg/.test(location.search) || location.hash === '#dbg') window.__t = {
  pos: () => { const p = avatar.position, [lx, lz] = W2L(p.x, p.z); return { lx: +lx.toFixed(2), lz: +lz.toFixed(2), y: +p.y.toFixed(3), feet: +feetY.toFixed(3), grounded, solids: SOLID.list.length }; },
  key: (code, on) => { keys[code] = on; },
  bell: () => BELL && { th: +BELL.theta.toFixed(3), om: +BELL.omega.toFixed(3), hold: bellHold && { ...bellHold }, sway: +BELL.sway.toFixed(3), glow: +BELL.glow.toFixed(2), remote: bellRemoteOn() ? { mode: bellRemote.mode, nick: bellRemote.nick } : null, peerGrip: [...peers.values()].map(P => P.grip ? +P.grip.w.toFixed(2) : null) },
  get net() { return NET && NET.joined; },
  bellAt: () => BELL && { x: BELL.x, z: BELL.z, ux: BELL.ux, uz: BELL.uz },
  wishTest(n = 12) { const tx = ['우리가족 건강 행복 사랑', '합격 기원', '부모님 오래오래 건강하세요', '주원 채원 무럭무럭', '평화', '마음의 평안을 얻게 해 주세요', '사업 번창', '건강']; for (let i = 0; i < n; i++) hangWish({ t: tx[i % tx.length], c: WISH_COLORS[i % WISH_COLORS.length] }, false); if (RACK) { avatar.position.set(RACK.stand[0], 0, RACK.stand[1]); avatar.rotation.y = Math.atan2(RACK.x - RACK.stand[0], RACK.z - RACK.stand[1]); yaw = avatar.rotation.y + Math.PI; dist = 4.5; pitch = .12; intro = -1; } },
  yardTest(n = 4) { const T = cur; if (!T) return; for (let i = 0; i < n; i++) hangTempleLantern(T, { t: ['우리가족 건강 행복 사랑', '합격 기원', '평화', '사업 번창'][i % 4], c: WISH_COLORS[(i + 2) % WISH_COLORS.length] }, false); },
  me: () => ({ x: +avatar.position.x.toFixed(3), z: +avatar.position.z.toFixed(3), wob: +myWob.toFixed(3) }),
  walkTo(x, z) { moveTarget = { x, z, t: 0 }; },
  others: () => [...peers.values()].map(P => ({ x: +P.g.position.x.toFixed(3), z: +P.g.position.z.toFixed(3), wob: +(P.wob || 0).toFixed(3) })),
  place(x, z, ry) { avatar.position.x = x; avatar.position.z = z; if (ry !== undefined) avatar.rotation.y = ry; intro = -1; },
  cam(y, d, p) { yaw = y; dist = d; pitch = p; intro = -1; },
  npcAt: () => npc && { x: +npc.x.toFixed(2), z: +npc.z.toFixed(2), goal: npc.goal, open: npc.T ? openGround(npc.x, npc.z, 0) : null },
  leafAudit: () => { const T = cur, LV = T && T.leaves; if (!LV) return null; let bad = 0; for (const L of LV.list) if (L.st === 0 && !openGround(L.x, L.z, 0)) bad++; return { n: LV.list.length, bad }; },
  snap(lx, ly, lz, tx, ty, tz, fov = 55) { const [x, z] = L2W(lx, lz), [X, Z] = L2W(tx, tz), f0 = camera.fov; camera.position.set(x, ly, z); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(X, ty, Z); renderer.render(scene, camera); camera.fov = f0; camera.updateProjectionMatrix(); }, // 사진 대조용: 사찰 좌표로 카메라를 바로 놓고 한 장
  view: () => ({ yaw: +yaw.toFixed(3), face: +avatar.rotation.y.toFixed(3), joy: { ...joy }, mv: !!moveTarget, tap: DBG.tap, sam: !!sam, bell: !!bellHold }),
  peers: () => [...peers.values()].map(P => ({ nick: P.nick, vis: P.g.visible, bell: P.bell || 0, glb: !!P.glb })),
  probe: (lx, lz, feet) => { const [x, z] = L2W(lx, lz); const f = feet ?? feetY; const near = solidsNear(x, z).map(i => SOLID.list[i]).filter(o => solidHit(o, x, z, BODY_R)).map(o => ({ t: o.t, y0: +o.y0.toFixed(2), y1: +o.y1.toFixed(2), r: o.r && +o.r.toFixed(2), hu: o.hu && +o.hu.toFixed(2), hv: o.hv && +o.hv.toFixed(2) })); return { hAt: hall && +hall.heightAt(lx, lz).toFixed(3), g: +groundAt(x, z, f).toFixed(3), blocked: blockedAt(x, z, f), near }; },
  front(d = 3, p = .15) { intro = -1; yaw = behind() + Math.PI; dist = d; pitch = p; },
  side(d = 3, p = .15) { intro = -1; yaw = behind() + Math.PI / 2; dist = d; pitch = p; },
  back(d = 3, p = .2) { intro = -1; yaw = behind(); dist = d; pitch = p; },
  hap(hold) { sam = null; pose = 'hap'; poseT = hold ?? 0; poseHold = hold !== undefined; },
  bow(hold) { sam = null; pose = 'bow'; poseT = hold ?? 0; poseHold = hold !== undefined; },
  sam(t) { startSambae(); if (t !== undefined) { sam.t = t; sam.hold = true; } },
  release() { poseHold = false; if (sam) sam.hold = false; },
  walk(on, run) { keys.KeyW = !!on; keys.ShiftLeft = !!run; },
  sweepOK(v = true) { SWEEP_OK = v; },
  goTo(lx, lz) { const [x, z] = L2W(lx, lz); moveTarget = { x, z, t: 0 }; },
  path(lx, lz, y) { const [x, z] = L2W(lx, lz); goToW(x, z, y ?? feetY); return { tap: DBG.tap, mt: moveTarget && { n: moveTarget.pts.length, len: +moveTarget.rest[0].toFixed(1) } }; },
  tapAt(nx, ny) { clickMove({ clientX: (nx + 1) / 2 * canvas.clientWidth, clientY: (1 - ny) / 2 * canvas.clientHeight }); return { tap: DBG.tap, mt: moveTarget && { n: moveTarget.pts ? moveTarget.pts.length : 0, len: moveTarget.rest ? +moveTarget.rest[0].toFixed(1) : 0 } }; },
  toBell() { if (!BELL) return false; avatar.position.set(BELL.stand[0], 0, BELL.stand[1]); avatar.rotation.y = Math.atan2(BELL.x - BELL.stand[0], BELL.z - BELL.stand[1]); yaw = avatar.rotation.y + Math.PI; dist = 6; pitch = .24; intro = -1; return true; },
  ws: () => cur && cur.wishStone && { lx: cur.wishStone.lx, lz: cur.wishStone.lz, step: wsStep, anim: wsAnim && wsAnim.kind, t: wsAnim && +wsAnim.t.toFixed(2) },
  tp(lx, lz, ry) { const [x, z] = L2W(lx, lz); avatar.position.x = x; avatar.position.z = z; if (ry !== undefined) avatar.rotation.y = ry; },
  npc: () => npc && { x: +npc.x.toFixed(2), z: +npc.z.toFixed(2), vis: npc.g.visible, glb: !!npc.glb, goal: npc.goal, wait: +npc.wait.toFixed(2) },
  chore: () => chore && { kind: chore.kind, n: chore.n, world: chore.world, sweepW: +sweepW.toFixed(2), tip: chore.mesh.userData.tip && chore.mesh.userData.tip.toArray().map(v => +v.toFixed(2)), me: avatar.position.toArray().map(v => +v.toFixed(2)), sc: +chore.mesh.scale.x.toFixed(2), hands: glb && glb.B ? ['LeftHand', 'RightHand'].map(k => glb.B[k] && glb.B[k].getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(2))) : null, inScene: !!chore.mesh.parent && chore.mesh.parent.type },
  get glb() { return glb; }, get renderer() { return renderer; }, get scene() { return scene; },
  stats: () => statsDebug(), statFlush: () => flushStats(),
  get cur() { return cur; },
  get statuesDone() { return statuesDone; },
  // 점검: 절마다 법당 불상·바깥 불상이 모델로 다 들어왔는지
  audit: () => temples.map(T => ({ name: T.name, hall: T.hallName,
    altar: ((T.hall && T.hall.slots) || []).filter(s => !s.skip).map(s => s.k + (s.statue ? '✓' : '✗')).join(' '),
    out: [...(T.figs || []).map(f => f.k + (f.statue ? '✓' : '✗')), ...(T.bigBuddha ? ['big' + (T.bigBuddha.statue ? '✓' : '✗')] : [])].join(' ') })),
  inside(i) { goTemple(temples[i]); document.getElementById('btnHall').click(); const [x, z] = L2W(0, hall.interior.iz1 - .2); avatar.position.set(x, hall.FY, z); fpv = true; pitch = -.08; intro = -1; },
  outside() { fpv = false; },
  fishGo(where = 'at') { const F = cur && cur.fish; if (!F) return null; const P = where === 'stall' ? { lx: F.stall.lx, lz: F.stall.lz + 1.6 } : F.at; const [x, z] = L2W(P.lx, P.lz); avatar.position.set(x, avatar.position.y, z); faceTo({ x: F.feedTo.lx, z: F.feedTo.lz }); intro = -1; yaw = avatar.rotation.y + Math.PI; dist = 5; pitch = .35; return P; },
  acts: () => ctxActs.map(a => a[0]), act: i => ctxActs[i] && ctxActs[i][1](),
  faceL(lx, lz) { faceTo({ x: lx, z: lz }); }, fishState: () => ({ food: fishFood, bucket }),
  go(i, lx, lz) { const T = temples[i]; goTemple(T); if (lz !== undefined) { const [x, z] = L2W(lx, lz); avatar.position.set(x, 0, z); } return T.name; },
};
