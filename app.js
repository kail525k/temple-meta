// 온라인 사찰 참배 체험판 — 권역(서울·경남 등)마다 한 장면에 큰 사찰들을 축소해 모아 두고, 사찰마다 법당 하나를 실제 크기로 재현 (위레브)
import * as THREE from 'three';
import { createBabyMonk } from './avatar.js?v=4';
import { loadMonkGLB } from './monk-glb.js?v=3';
import { buildHall } from './hall.js?v=8';
import { buildPagoda, buildExtras, buildBackdrop, buildSea, buildHyuhyu, yonggungFrame, buildYonggung, treeKit } from './regional.js?v=20';
import { loadStatue } from './statue.js?v=1';
import { connectTogether, myIdentity, saveNick, offerError } from './together.js?v=2';
import { REGIONS } from './temples.js?v=7';
import { createStore, createSound, initTodo, initRituals, initSoundPanel } from './features.js?v=3';

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
  document.title = `${T.name} · 절로`;
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
  const back = hyu ? 18 : yg ? 6 : ex.includes('janggyeong') ? 12.5 : ex.includes('flatRock') ? 9 : ex.includes('gyedan') ? 9 : ex.includes('whiteGwaneum') ? 7.5 : 0; // 뒤뜰에 상징물이 있으면 마당을 뒤로 넓힘
  const YX = L / 2 + 6, YZ0 = -D / 2 - 2 - back, YZ1 = D / 2 + 19;
  YARD = { x0: -YX, x1: YX, z0: YZ0, z1: YZ1 };
  const yard = add(new THREE.PlaneGeometry(2 * YX, YZ1 - YZ0), MAT.yard, 0, .02, (YZ0 + YZ1) / 2, false); yard.rotation.x = -Math.PI / 2;
  const path = add(new THREE.PlaneGeometry(2.8, YZ1 - D / 2 - 1.2), MAT.path, 0, .03, (D / 2 + 1.2 + YZ1) / 2, false); path.rotation.x = -Math.PI / 2;
  // 낮은 담장 + 앞쪽 문
  const WH = .95, wall = (w, d, x, z) => { box(w, WH, d, MAT.wallStone, x, WH / 2, z); box(w + .2, .18, d + .2, MAT.wallCap, x, WH + .09, z); col(x, z, w / 2 + .05, d / 2 + .05); };
  if (!hyu) { // 휴휴암은 담장 없이 숲속 곶에 열려 있음
    for (const sx of [-1, 1]) if (!(yg && sx < 0)) wall(.45, YZ1 - YZ0, sx * YX, (YZ0 + YZ1) / 2); // 해동용궁사 왼쪽은 바닷물 길
    if (!st.sea) wall(2 * YX + .45, .45, 0, YZ0); // 바다 사찰은 뒤가 바다 (흰 돌난간)
    for (const sx of [-1, 1]) wall(YX - 1.6, .45, sx * (1.6 + (YX - 1.6) / 2), YZ1);
  }
  for (const sx of [-1, 1]) { add(new THREE.CylinderGeometry(.16, .18, 3, 10), MAT.red, sx * 1.6, 1.5, YZ1); col(sx * 1.6, YZ1, .25, .25); }
  box(4.2, .3, 1.2, MAT.wallCap, 0, 3.1, YZ1); box(3.6, .25, .3, MAT.red, 0, 2.8, YZ1);
  const SL = D / 2 + 4.4;
  if (!yg) { // 석등 (법당 바로 앞) — 해동용궁사는 그 자리에 사사자 석탑
  add(new THREE.CylinderGeometry(.42, .5, .3, 8), MAT.stone, 0, .15, SL); add(new THREE.CylinderGeometry(.12, .14, .95, 8), MAT.stone, 0, .78, SL);
  box(.62, .14, .62, MAT.stone, 0, 1.3, SL); box(.46, .5, .46, MAT.stone, 0, 1.62, SL); box(.3, .26, .48, MAT.fire, 0, 1.62, SL);
  add(new THREE.ConeGeometry(.52, .38, 8), MAT.stoneDark, 0, 2.06, SL); add(new THREE.SphereGeometry(.1, 10, 8), MAT.stoneDark, 0, 2.3, SL);
  col(0, SL, .55, .55);
  }
  // 탑 (사찰마다 다름: 삼층·오층·칠층 석탑, 팔각구층석탑, 목탑, 석가탑·다보탑)
  const YG = yg ? yonggungFrame({ L, D, YX, YZ1 }) : null;
  const PZ = yg ? YG.PZ : D / 2 + 10.5, H = { THREE, add, box, col, MAT, L, D, YX, YZ0, YZ1, SL, PZ, nameTex, site, fig: [] };
  if (hyu) { H.fishX = -6.2; H.fishZ = YZ0 - 7.3; H.fishAt = { lx: -6.2, lz: YZ0 - 2.4 }; H.fishStall = { lx: -9.2, lz: YZ0 + 2.7 }; }
  if (st.sea) T.seaRect = buildSea(H, hyu ? { gap: [-10.2, -2.2, 3.4], side: st.seaSide || 0, clear: { x: -6.2, z: -7.9, rx: 9.6, rz: 4.1 } } : yg ? { gap: YG.gap } : {});
  if (yg && T.seaRect) T.seaRect.inlet = { x0: -YX - 7, x1: -YX + .3, z0: YZ0 - 1, z1: YG.ZB + .5 };
  if (st.pagoda !== 'none') { const pg = buildPagoda(H, st.pagoda, PZ); const [px, pz] = L2W(pg.x, PZ); T.pagoda = { x: px, z: pz }; T.pagodaR = Math.max(yg ? 2.0 : 2.7, pg.r + .75); } else T.pagoda = null;
  // 사찰 상징물 (법당 옆 마당·뒤뜰)
  const exo = buildExtras(H, T); T.site = site; T.bigBuddha = exo.bigBuddha; T.mini = exo.mini; T.fish = exo.fish; T.anim = exo.anim;
  if (hyu) buildHyuhyu(H, T);
  if (yg) { buildYonggung(H, T, YG); const hh = hall.heightAt; hall.heightAt = (lx, lz) => Math.max(hh(lx, lz), YG.ground(lx, lz)); }
  T.figs = H.fig; // 바깥 불상·보살상 자리 (3D 존상 모델을 불러오면 바꿔 끼움)
  // 마당 위를 가로지르는 연등 줄 (조계사처럼 마당을 덮는 연등 지붕도) — 색깔별로 한 번에 그림
  const lanGeo = new THREE.IcosahedronGeometry(.21, 1), tasGeo = new THREE.CylinderGeometry(.02, .04, .22, 6), LM = MAT.lotus.length;
  const lanM = Array.from({ length: LM }, () => []), tasM = Array.from({ length: LM }, () => []), m4 = new THREE.Matrix4();
  const gy = (x, z) => yg ? YG.ground(x, z) : 0;
  const rows = yg ? [D / 2 + 7.3, D / 2 + 12.2, D / 2 + 13.4, D / 2 + 16.6] : st.lanterns === 'canopy' ? Array.from({ length: Math.floor((YZ1 - 2 - (D / 2 + 5)) / 1.5) }, (_, i) => D / 2 + 5 + i * 1.5).filter(z => Math.abs(z - PZ) > 2) : [D / 2 + 7.2, D / 2 + 13.5, D / 2 + 17];
  let k = 0;
  for (const z of rows) {
    const x0 = -YX + .6, x1 = YX - .6, wy = Math.max(gy(0, z), gy(x0, z));
    for (const x of [x0, x1]) { const b = gy(x, z), hp = 3.4 + wy - b; add(new THREE.CylinderGeometry(.05, .06, hp, 6), MAT.line, x, b + hp / 2, z); col(x, z, .12, .12); }
    const wire = add(new THREE.CylinderGeometry(.01, .01, x1 - x0, 4), MAT.line, 0, 3.25 + wy, z, false); wire.rotation.z = Math.PI / 2;
    for (let x = x0 + .9; x < x1 - .5; x += st.lanterns === 'canopy' ? .7 : .95) {
      const c = k++ % LM; lanM[c].push(new THREE.Matrix4().compose(new THREE.Vector3(x, 2.95 + wy, z), new THREE.Quaternion(), new THREE.Vector3(1, .85, 1)));
      tasM[(c + 2) % LM].push(new THREE.Matrix4().makeTranslation(x, 2.67 + wy, z));
    }
  }
  T.wire = { z: rows[0], x0: -YX + .6, x1: YX - .6, step: st.lanterns === 'canopy' ? .7 : .95, items: [], k: 0 };
  for (let c = 0; c < LM; c++) for (const [geo, arr] of [[lanGeo, lanM[c]], [tasGeo, tasM[c]]]) { if (!arr.length) continue; const im = new THREE.InstancedMesh(geo, MAT.lotus[c], arr.length); arr.forEach((mm, i) => im.setMatrixAt(i, mm)); site.add(im); }
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
const glbReady = loadMonkGLB(MONK_URL, { closedUrl: MONK_CLOSED, onProgress: f => { const m = document.getElementById('loadMsg'); if (m && !document.getElementById('loading').classList.contains('hide')) m.innerHTML = `아기 스님을 모시는 중… ${Math.round(f * 100)}%`; } })
  .then(m => { glb = m; avatar.add(m.root); body.visible = false; dbg('monk', m.info); return m; })
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
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || rituals.open) return;
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
const drag = { id: null, x: 0, y: 0 };
const ZMIN = 1.4, ZMAX = 110; // 확대·축소 범위 (얼굴 가까이 ~ 권역을 높이서 내려다보기)
const PMIN = -0.85, PMAX = 1.48; // 보는 각도: 아래에서 올려다보기(-) ~ 거의 위에서 내려다보기
const ptrs = new Map(); let pinchD = 0, pinchDist0 = 0, downInfo = null;
canvas.addEventListener('pointerdown', e => {
  if (bellHold && e.button === 0 && (e.pointerType === 'mouse' || isLocked())) { bellPullStart(); return; }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); pinchDist0 = dist; drag.id = null; downInfo = null; return; }
  if (drag.id !== null) return; drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY; canvas.setPointerCapture(e.pointerId);
  downInfo = { x: e.clientX, y: e.clientY, t: performance.now() };
});
canvas.addEventListener('pointermove', e => {
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size >= 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinchD > 0) dist = clamp(pinchDist0 * pinchD / Math.max(20, d), ZMIN, ZMAX); return; }
  if (e.pointerId !== drag.id || isLocked()) return; yaw -= (e.clientX - drag.x) * 0.005 * SENS(); pitch = clamp(pitch + (e.clientY - drag.y) * 0.005 * SENS(), PMIN, PMAX); drag.x = e.clientX; drag.y = e.clientY;
});
const endDrag = e => {
  if (bellHold && bellHold.pulling && e.button === 0 && e.pointerType === 'mouse') { bellPullEnd(); ptrs.delete(e.pointerId); return; }
  ptrs.delete(e.pointerId); if (ptrs.size < 2) pinchD = 0;
  if (e.pointerId === drag.id) {
    drag.id = null;
    const tap = e.type === 'pointerup' && downInfo && Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y) < 7 && performance.now() - downInfo.t < 400;
    let fed = false;
    if (tap && fishAimPt) { // 휴휴암 연화대 끝에서 밥(또는 방생 양동이)을 들고 있으면: 누른 쪽 물로 던짐
      const r = canvas.getBoundingClientRect(), pt = isLocked() ? fishAimPt : fishAimAt((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      if (pt) { if (fishFood > 0) throwFish(pt); else releaseFish(pt); fed = true; }
    }
    if (tap && !fed) { if (FINE && e.pointerType === 'mouse') lockMouse(e); else clickMove(e); } // PC: 화면을 누르면 3인칭 마우스 시점, 터치: 누른 곳으로 걷기
    downInfo = null;
  }
};
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
const joyEl = document.getElementById('joy'), knob = document.getElementById('knob');
{ const jb = document.getElementById('btnJump'); if (jb) { const on = e => { e.preventDefault(); jumpBtn = true; }, off = () => { jumpBtn = false; }; jb.addEventListener('pointerdown', on); jb.addEventListener('pointerup', off); jb.addEventListener('pointercancel', off); jb.addEventListener('pointerleave', off); } }
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
if (OFFLINE) { // 거리뷰는 사이트에서: 버튼을 사이트 링크로 바꿈
  const b = document.getElementById('btnPano'), a = document.createElement('a');
  a.id = 'btnPano'; a.className = b.className; a.href = SITE; a.target = '_blank'; a.rel = 'noopener';
  a.innerHTML = '<i>🌐</i><span>사이트에서 거리뷰</span>'; b.replaceWith(a);
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
const camRay = new THREE.Raycaster(), _cPivot = new THREE.Vector3(), _cDir = new THREE.Vector3(), _cOut = new THREE.Vector3();
// 카메라를 가리는 것들(법당 벽·기둥·지붕·담·바위·불상 등): 사찰마다 한 번 모아 둠. 바닥판·연등·나무 잎은 뺌
function occluders(T) {
  if (T.occ) return T.occ;
  const list = [], sph = new THREE.Sphere();
  (T.site || T.hall.group).updateMatrixWorld(true);
  (T.site || T.hall.group).traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.visible) return;
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
    if (!tapdori) {
      const p = avatar.position, nx = p.x + mx * speed * dt, nz = p.z + mz * speed * dt; let ok = true;
      if (blockedAt(p.x, p.z, feetY) || !blockedAt(nx, nz, feetY)) { p.x = nx; p.z = nz; } else if (!blockedAt(nx, p.z, feetY)) p.x = nx; else if (!blockedAt(p.x, nz, feetY)) p.z = nz; else ok = false; // 이미 물체 안(순간이동 직후)이면 빠져나갈 수 있게
      if (!ok && moveTarget) { moveTarget = null; markMove(null); } // 막혀서 못 가면 멈춤
      pushOut(p, 0.42); clampBound(p);
    }
    const face = (isLocked() || fpv) && !moveTarget && !tapdori && iz <= .05 ? yaw + Math.PI : Math.atan2(mx, mz); // 마우스 시점: 시선 방향을 보고 옆걸음
    let d = face - avatar.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); avatar.rotation.y += d * Math.min(1, dt * 10);
    walkT += dt * speed * 2; body.position.y = Math.abs(Math.sin(walkT)) * 0.06; body.rotation.z = Math.sin(walkT) * 0.05;
    walkAmp = Math.min(1, walkAmp + dt * 6);
  } else if (!sam) { body.position.y *= 0.85; body.rotation.z *= 0.85; walkAmp = Math.max(0, walkAmp - dt * 6); }
  else walkAmp = 0;
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
      if (t > 1.2 && sam.rung !== n) { sam.rung = n; bell(.18); toast(`🙇 ${n + 1}배`, 1200); }
    }
  } else if (pose) {
    poseT += poseHold ? 0 : dt; const dur = pose === 'hap' ? 2.2 : 2.0;
    hap = clamp(Math.min(poseT / .35, (dur - poseT) / .45), 0, 1);
    if (pose === 'bow') { body.rotation.x = clamp(Math.min((poseT - .3) / .4, (dur - poseT) / .5), 0, 1) * 0.8; headG.rotation.x = body.rotation.x * .3; }
    if (poseT > dur) { pose = null; resetBody(); }
  }
  if (tapdori) hap = Math.max(hap, .9);
  const ST = { sit: sitW, walkAmp, speed, hap, kneel: body.position.y < 0 ? Math.min(1, -body.position.y / .2) : 0, bend: body.rotation.x, headX: headG.rotation.x, headZ: headG.rotation.z, closed: hap > .5 || (sit && sitW > .6 && sit.inHall), blink: blinkT < .12 };
  if (glb) glb.update(dt, ST);
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
  camGoal.set(avatar.position.x + Math.sin(yaw) * hd, avatar.position.y + 1.2 + Math.sin(effP) * effD, avatar.position.z + Math.cos(yaw) * hd);
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
  camera.lookAt(avatar.position.x + shX, avatar.position.y + 1.05 + Math.max(0, -effP) * Math.min(effD, 3) * .3, avatar.position.z + shZ);
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

// 바닥 클릭 → 그 자리로 걸어감
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), _p = new THREE.Vector3();
const moveMark = new THREE.Mesh(new THREE.RingGeometry(.22, .34, 28), new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: .9, depthWrite: false }));
moveMark.rotation.x = -Math.PI / 2; moveMark.visible = false; scene.add(moveMark);
function markMove(p) { if (!p) { moveMark.visible = false; return; } moveMark.position.set(p.x, avatar.position.y + .05, p.z); moveMark.visible = true; moveMark.userData.t = 0; }
function clickMove(e) {
  if (sam || rituals.open || bellHold) return;
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
    sit = { t: 0, seatY: 0, inHall: true }; yaw = behind() + .5; dist = Math.max(dist, 3.2); pitch = .32;
    toast('🧘 방석에 앉아 마음을 고요히… (움직이면 일어나요)', 3200);
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
    for (const a of [0, Math.PI]) { // 당좌: 당목이 닿는 연꽃 자리 (앞뒤)
      const rr = .567 * S + .01, f = new THREE.Group(); f.position.set(Math.sin(a) * rr, HS, Math.cos(a) * rr); f.position.y -= PIV; f.rotation.y = a; bellG.add(f);
      const d = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .03, 20), bellD); d.rotation.x = Math.PI / 2 - .05; f.add(d);
      for (let k = 0; k < 8; k++) { const pa = k / 8 * Math.PI * 2, pt = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), bellM); pt.scale.set(1, 1, .4); pt.position.set(Math.cos(pa) * .1, Math.sin(pa) * .1, .025); f.add(pt); }
    }
    bm(new THREE.CylinderGeometry(.07 * S, .09 * S, .28 * S, 12), bellD, -.12 * S, BY + 1.36 * S, 0); // 음통
    { const dr = bm(new THREE.TorusGeometry(.12 * S, .045 * S, 8, 16, Math.PI * 1.15), bellD, .04 * S, BY + 1.3 * S, 0); dr.rotation.z = -.2; } // 용뉴 (고리 모양 용)
    bm(new THREE.CylinderGeometry(.02, .02, PIV - (.4 + 1.42 * S), 6), MAT.line, .04 * S, -(PIV - (.4 + 1.42 * S)) / 2, 0); // 고리 줄
    // 당목: 밧줄 두 가닥에 매달린 통나무 · 뒤끝에 손으로 당기는 줄
    const LR = PIV - HS, LOGZ = 1.85;
    const strG = new THREE.Group(); strG.position.set(0, PIV, LOGZ); grp.add(strG);
    const log = new THREE.Mesh(new THREE.CylinderGeometry(.12, .13, 1.7, 14), MAT.trunk); log.rotation.x = Math.PI / 2; log.position.set(0, -LR, 0); log.castShadow = true; strG.add(log);
    for (const zz of [-.85, .85]) { const cap = new THREE.Mesh(new THREE.CircleGeometry(.12, 14), new THREE.MeshStandardMaterial({ color: '#9a7350', roughness: .9 })); cap.position.set(0, -LR, zz + Math.sign(zz) * .002); cap.rotation.y = zz > 0 ? 0 : Math.PI; strG.add(cap); }
    for (const zz of [-.55, .55]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, LR, 5), MAT.line); r.position.set(0, -LR / 2, zz); strG.add(r); }
    const pullRope = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, 1, 5), MAT.line); grp.add(pullRope); // 길이·방향은 매 프레임 맞춤
    obstacles.push({ cx: x, cz: z, c: 1, s: 0, hu: 1.05, hv: 1.05 });
    BELL = { x, z, ux, uz, grp, bellG, strG, LR, LOGZ, pullRope, theta: 0, omega: 0, sway: 0, swayV: 0, struck: false, stand: [ux * (R0 - 3.3), uz * (R0 - 3.3)] };
  }
  // 소원 연등대
  { const ux = Math.sin(aRack), uz = Math.cos(aRack), x = ux * R0, z = uz * R0, grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = Math.atan2(-ux, -uz); g.add(grp);
    const ad = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
    for (const sx of [-1, 1]) ad(new THREE.CylinderGeometry(.09, .1, 2.9, 8), MAT.trunk, sx * 2.5, 1.45, 0);
    for (const y of [2.75, 2.05]) { const bar = ad(new THREE.CylinderGeometry(.05, .05, 5.1, 8), MAT.trunk, 0, y, 0); bar.rotation.z = Math.PI / 2; }
    const sign = ad(new THREE.PlaneGeometry(1.5, .42), new THREE.MeshStandardMaterial({ map: nameTex('소원 연등', '#3a2418', '#f2cf72', 46), roughness: .7 }), 0, 3.15, .06); sign.castShadow = false;
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
    const cntSign = ad(new THREE.PlaneGeometry(2.2, .3), new THREE.MeshStandardMaterial({ map: nameTex('지금까지 0장', '#f6efe2', '#3a2a1c', 34, '', 760), roughness: .7 }), 0, 2.72, -1.28); cntSign.castShadow = false; // 누적 기와 수
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
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.25, 1), new THREE.MeshStandardMaterial({ color: w.c, emissive: w.c, emissiveIntensity: .45, roughness: .6, flatShading: true })); m.scale.y = .85; gL.add(m);
  const str = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .4, 4), MAT.line); str.position.y = .38; gL.add(str);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = '#fffaf0'; c.fillRect(0, 0, 256, 128); c.fillStyle = '#5a3a22'; c.font = '600 26px sans-serif'; c.textAlign = 'center';
  const t = w.t || ''; c.fillText(t.slice(0, 10), 128, 52); if (t.length > 10) c.fillText(t.slice(10, 20) + (t.length > 20 ? '…' : ''), 128, 90);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(.46, .23), new THREE.MeshStandardMaterial({ map: tex, roughness: .8, side: THREE.DoubleSide })); tag.position.set(0, -.42, 0); gL.add(tag);
  W.items.push(gL); if (fresh) { gL.userData.base = 1; gL.scale.setScalar(.01); gL.userData.grow = 0; GROW.push(gL); }
}
// 범종 치기: 당목 줄을 잡고(E) → 마우스 왼쪽·S·↓(또는 아래 버튼)를 꾹 누르면 뒤로 당겨지고 → 놓으면 당목이 흔들려 가서 종을 침
let bellHold = null; // { pull: 0~1, pulling }
const _bv = new THREE.Vector3(), _bv2 = new THREE.Vector3(), _bq = new THREE.Quaternion(), _UP = new THREE.Vector3(0, 1, 0);
function grabBell() {
  if (!BELL) return; if (sit) standUp(); if (tapdori) stopTapdori(); moveTarget = null; markMove(null); sam = null; resetBody();
  bellHold = { pull: 0, pulling: false };
  toast(document.body.classList.contains('touch') ? '🔔 당목 줄을 잡았어요 · 아래 [꾹 눌러 당기기]를 누르고 있다가 떼면 종을 쳐요' : '🔔 당목 줄을 잡았어요 · 마우스 왼쪽(또는 S)을 꾹 누르면 뒤로 당기고, 놓으면 종을 쳐요 · E 놓기', 4800);
  updateNear();
}
function releaseBellRope() { if (!bellHold) return; bellHold = null; resetBody(); updateNear(); }
function bellPullStart() { if (bellHold && !bellHold.pulling) { bellHold.pulling = true; BELL.omega = 0; } }
function bellPullEnd() { if (bellHold && bellHold.pulling) { bellHold.pulling = false; bellHold.pull = 0; } } // 당긴 자리에서 놓으면 진자처럼 앞으로 흔들려 감
function strikeBell() { grabBell(); }
{ const bp = document.getElementById('bellPull'); if (bp) { // 꾹 눌러 당기기 버튼 (휴대폰·마우스 모두)
  bp.addEventListener('pointerdown', e => { e.preventDefault(); bp.setPointerCapture(e.pointerId); bellPullStart(); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) bp.addEventListener(ev, () => bellPullEnd());
} }
function ringBell(k) { // k: 0~1 친 세기
  sound.bigBell(.35 + .65 * k); BELL.swayV += .05 + .1 * k;
  const n = store.count('bell'); toast(k > .6 ? `🔔 데엥— 크게 울렸어요 · 오늘 ${n}번` : `🔔 범종을 울렸어요 · 오늘 ${n}번`, 2200); done('bell');
}
function updateBell(dt) {
  const B = BELL; if (!B) return;
  if (bellHold) {
    if (bellHold.pulling) { bellHold.pull = Math.min(1, bellHold.pull + dt * .85); B.theta += (-.5 * bellHold.pull - B.theta) * Math.min(1, dt * 7); B.omega = 0; }
    const pb = bellHold.pulling ? bellHold.pull : 0;
    const ap = B.grp.localToWorld(_bv.set(0, 0, B.LOGZ + 1.3 + .55 * pb)); avatar.position.x = ap.x; avatar.position.z = ap.z;
    const bp = B.grp.localToWorld(_bv2.set(0, 0, 0)); avatar.rotation.y = Math.atan2(bp.x - avatar.position.x, bp.z - avatar.position.z);
    body.rotation.x = -.3 * pb; // 당길수록 몸을 뒤로 젖힘
  }
  if (!(bellHold && bellHold.pulling)) { // 진자: 줄 길이만큼 흔들리다 종(당좌)에 닿으면 울림
    B.omega += (-(9.8 / B.LR) * Math.sin(B.theta) - .55 * B.omega) * dt; B.theta += B.omega * dt;
    const HIT = .053;
    if (B.theta > HIT && B.omega > 0) { const v = B.omega; B.theta = HIT; B.omega = -v * .35; if (v > .18) ringBell(Math.min(1, v / 1.0)); }
  }
  B.strG.rotation.x = B.theta;
  { const bp = document.getElementById('bellPull'); if (bp) { const on = !!bellHold; if (bp._on !== on) { bp._on = on; bp.style.display = on ? 'block' : 'none'; } if (on) bp.style.setProperty('--p', Math.round((bellHold.pulling ? bellHold.pull : 0) * 100) + '%'); } }
  B.swayV += (-14 * B.sway - .8 * B.swayV) * dt; B.sway += B.swayV * dt; B.bellG.rotation.x = -B.sway;
  // 당기는 줄: 당목 뒤끝 → 잡고 있으면 손, 아니면 아래로 늘어짐
  const a = B.strG.localToWorld(_bv.set(0, -B.LR, .85));
  const b = bellHold ? _bv2.set(avatar.position.x + Math.sin(avatar.rotation.y) * .28, avatar.position.y + .78, avatar.position.z + Math.cos(avatar.rotation.y) * .28) : _bv2.copy(a).add(new THREE.Vector3(0, -.75, 0));
  const R = B.pullRope, par = R.parent; par.worldToLocal(a); par.worldToLocal(b);
  const d = b.clone().sub(a), len = Math.max(.05, d.length()); R.position.copy(a).addScaledVector(d, .5); R.scale.set(1, len, 1); R.quaternion.setFromUnitVectors(_UP, d.normalize());
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
    if (RACK && Math.hypot(avatar.position.x - RACK.x, avatar.position.z - RACK.z) < 3.8) acts.push(['🏮 소원 연등 걸기', () => openWish('lantern')]);
    if (TILE && Math.hypot(avatar.position.x - TILE.x, avatar.position.z - TILE.z) < 4.2) acts.push(['✍️ 기와 올리기', () => openWish('tile')]);
    if (!inside && cur && cur.fish) { // 휴휴암: 판매대에서 물고기 밥·방생 물고기를 받아 연화대 끝에서 던지거나 놓아 줌
      const F = cur.fish, dSt = Math.hypot(lx - F.stall.lx, lz - F.stall.lz), dAt = Math.hypot(lx - F.at.lx, lz - F.at.lz);
      if (dSt < 3.2) {
        acts.push([fishFood > 0 ? `🛍️ 물고기 밥 더 받기 (지금 ${fishFood}줌)` : '🛍️ 물고기 밥 한 봉지 받기', () => { fishFood += 8; sound.bead(); toast('🛍️ 물고기 밥 한 봉지(8줌)를 받았어요 · 실제 휴휴암에서는 입구에서 현금 2,000원 · 연화대 끝에서 던지고 싶은 물을 클릭하세요', 4200); updateNear(); }]);
        if (!bucket) { acts.push(['🐟 방생 물고기 받기 · 작은 황어 5마리', () => takeBucket('hwangeo')]); acts.push(['🐟 방생 물고기 받기 · 큰 우럭 2마리', () => takeBucket('ureok')]); }
      }
      if (dAt < 4.6) {
        if (fishFood > 0) acts.push([`🐟 물고기 밥 던지기 (${fishFood}줌)`, throwFish]);
        if (bucket) acts.push(['🙏 방생하기', releaseFish]);
        if (!fishFood && !bucket) acts.push(['🛍️ 판매대에서 물고기 밥·방생 물고기 받아 오기', () => { const [x, z] = L2W(F.stall.lx, F.stall.lz + 1.6); moveTarget = { x, z, t: 0 }; markMove(new THREE.Vector3(x, avatar.position.y, z)); }]);
      }
    }
  }
  if (tapdori) acts.push(['⏹ 탑돌이 멈추기', () => stopTapdori('탑돌이를 멈췄어요')]);
  const key = acts.map(a => a[0]).join('|'); ctxActs = acts;
  if (key === ctxKey) return; ctxKey = key; ctxBar.innerHTML = '';
  acts.forEach(([t, fn], i) => { const b = document.createElement('button'); b.textContent = t; if (i === 0) b.className = 'main'; b.onclick = () => fn(); ctxBar.appendChild(b); });
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

// 매 프레임: 연기 · 종 · 표시
function updateWorld(dt) {
  updateFishAim(dt);
  if (bellCool > 0) bellCool -= dt;
  updateBell(dt);
  if (moveMark.visible) { moveMark.userData.t += dt; moveMark.material.opacity = .9 * (.6 + .4 * Math.sin(moveMark.userData.t * 6)); }
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
    a.href = url; a.download = `절로-${cur ? cur.name : REGION.name}-${ts}.png`; a.click();
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
    if (r === REGION) for (const T of temples) { const bt = document.createElement('button'); bt.textContent = T.name; bt.onclick = e => { e.stopPropagation(); regionModal.classList.remove('show'); goTemple(T); }; go.appendChild(bt); }
    else { for (const t of r.temples) { const bt = document.createElement('button'); bt.textContent = t.name; bt.onclick = e => { e.stopPropagation(); far(t.name); }; go.appendChild(bt); } el.onclick = () => far(null); }
    el.appendChild(go);
    regionList.appendChild(el);
  }
  // 작은 절 제보: 스님·종무소·신도가 알려 주면 검토해서 넣음
  const rp = document.createElement('div'); rp.className = 'rg report';
  rp.innerHTML = `<b>🙏 우리 절도 넣어 주세요</b><span>지도에 없는 작은 절을 알려 주시면 검토해서 실제 모습대로 순례길에 넣어요 · 스님·종무소·신도 누구나</span><div class="go"><button>사찰 제보하기</button></div>`;
  if (OFFLINE) rp.innerHTML = `<b>🙏 우리 절도 넣어 주세요</b><span>사찰 제보는 사이트에서 받아요 · temple-meta.vercel.app</span><div class="go"><a href="${SITE}" target="_blank" rel="noopener" style="display:inline-block;border-radius:99px;padding:5px 10px;font-size:12px;font-weight:600;background:var(--accent);color:#fff;text-decoration:none">사이트에서 제보하기</a></div>`;
  else rp.onclick = () => { regionModal.classList.remove('show'); import('./report.js?v=2').then(m => m.openReport({ sido: REGION.name.split('·')[0], toast })); };
  regionList.appendChild(rp);
  regionModal.classList.add('show');
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
function ensurePeer(id, nick) {
  let P = peers.get(id);
  if (!P) {
    const g = new THREE.Group(); g.visible = false; scene.add(g);
    P = { id, nick: '', g, glb: null, label: null, goal: null, goalSt: null, st: { sit: 0, walkAmp: 0, speed: 0, hap: 0, kneel: 0, bend: 0, headX: 0, headZ: 0, closed: false, blink: false }, last: 0, blinkT: 2 + Math.random() * 3 };
    peers.set(id, P);
    if (peers.size <= 16) loadMonkGLB(MONK_URL, { closedUrl: MONK_CLOSED }).then(m => { if (peers.get(id) !== P) return; P.glb = m; g.add(m.root); }).catch(e => dbg('peerModelError', e.message)); // 16명까지 아기 스님 모습, 그 이상은 이름표만
  }
  if (nick && nick !== P.nick) { P.nick = nick; if (P.label) { P.g.remove(P.label); P.label.material.map.dispose(); } P.label = nickSprite(nick); P.g.add(P.label); }
  return P;
}
function removePeer(id) { const P = peers.get(id); if (!P) return; P.g.removeFromParent(); peers.delete(id); }
function onPeers(state) {
  const keys = new Set(Object.keys(state).filter(k => k !== ME.id));
  for (const k of keys) { const a = state[k]; ensurePeer(k, a && a[0] && a[0].nick); }
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
  P.goalSt = { sit: s[0] || 0, walkAmp: s[1] || 0, speed: s[2] || 0, hap: s[3] || 0, kneel: s[4] || 0, bend: s[5] || 0, headX: s[6] || 0, headZ: s[7] || 0, closed: !!s[8] };
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
      P.glb.update(dt, S);
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
  const msg = { id: ME.id, n: ME.nick, tn, lx, lz, x: q(x), z: q(z), y: q(avatar.position.y), ry: q(avatar.rotation.y), s };
  const key = JSON.stringify(msg);
  if (key === lastSent && netBeat < 2) return; // 가만히 있으면 2초에 한 번만
  lastSent = key; netBeat = 0; NET.send(msg);
}
function renderPeople() {
  const n = peers.size + 1; if (peopleBtn) peopleBtn.textContent = `👥 ${n}`;
  if (!peoplePanel || !peoplePanel.classList.contains('show')) return;
  const list = [...peers.values()].map(P => `<div>🙏 ${esc(P.nick || '순례자')}</div>`).join('') || '<div class="empty">아직 다른 분이 없어요. 주소를 보내 함께 걸어 보세요</div>';
  const st = NET && NET.joined ? '' : ' (연결 중…)';
  peoplePanel.innerHTML = `<b>함께 순례 중 · ${n}명</b><small>${REGION.name} 권역에 지금 접속한 분들이에요${st}</small><div class="me">내 법명 <input id="nickIn" maxlength="12" value="${esc(ME.nick)}"><button id="nickSave">바꾸기</button></div>${list}`;
  document.getElementById('nickSave').onclick = () => {
    const v = document.getElementById('nickIn').value.trim().replace(/\s+/g, ' ').slice(0, 12);
    if (!v) return; if (BAD.test(v)) { toast('고운 이름으로 지어 주세요'); return; }
    ME.nick = v; saveNick(v); if (NET) NET.retrack(); lastSent = ''; toast(`🙏 이제 '${v}'(으)로 보여요`); renderPeople();
  };
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
  try { NET = await connectTogether({ region: REGION.id, me: ME, onPeers, onState, onOffer, onStatus: s => { DBG.net = s; renderPeople(); } }); }
  catch (e) { dbg('netError', e.message); hangLocal(); return; }
  try { const rows = await Promise.race([NET.load(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 7000))]); applyOffers(rows); onlineOffers = true; DBG.offers = rows.length; setTileCount(rows.filter(r => r.kind === 'tile').length); NET.count('tile').then(setTileCount).catch(() => { }); }
  catch (e) { dbg('offerLoadError', e.message); hangLocal(); }
}

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
  canvas.focus();
  loop();
  { let tq = QS.get('t'); if (!tq && OFFLINE) { try { tq = sessionStorage.getItem('jeollo.t'); sessionStorage.removeItem('jeollo.t'); } catch (e) { } } const T = tq && temples.find(t => t.name === tq); if (T) { goTemple(T); intro = -1; } } // 다른 지역 창에서 '○○사 가기'로 왔으면 그 절 앞으로
  if (!QS.get('r') && !REGIONS.some(r => r.id === HASH_R) && !QS.has('dbg')) setTimeout(openRegions, 4200); // 처음 오면 지역 고르기를 보여 줌
})();

// 점검용 (주소에 ?dbg 가 있을 때만): 카메라·자세를 고정해 확인
if (/[?&]dbg/.test(location.search) || location.hash === '#dbg') window.__t = {
  pos: () => { const p = avatar.position, [lx, lz] = W2L(p.x, p.z); return { lx: +lx.toFixed(2), lz: +lz.toFixed(2), y: +p.y.toFixed(3), feet: +feetY.toFixed(3), grounded, solids: SOLID.list.length }; },
  key: (code, on) => { keys[code] = on; },
  probe: (lx, lz, feet) => { const [x, z] = L2W(lx, lz); const f = feet ?? feetY; const near = solidsNear(x, z).map(i => SOLID.list[i]).filter(o => solidHit(o, x, z, BODY_R)).map(o => ({ t: o.t, y0: +o.y0.toFixed(2), y1: +o.y1.toFixed(2), r: o.r && +o.r.toFixed(2), hu: o.hu && +o.hu.toFixed(2), hv: o.hv && +o.hv.toFixed(2) })); return { hAt: hall && +hall.heightAt(lx, lz).toFixed(3), g: +groundAt(x, z, f).toFixed(3), blocked: blockedAt(x, z, f), near }; },
  front(d = 3, p = .15) { intro = -1; yaw = behind() + Math.PI; dist = d; pitch = p; },
  side(d = 3, p = .15) { intro = -1; yaw = behind() + Math.PI / 2; dist = d; pitch = p; },
  back(d = 3, p = .2) { intro = -1; yaw = behind(); dist = d; pitch = p; },
  hap(hold) { sam = null; pose = 'hap'; poseT = hold ?? 0; poseHold = hold !== undefined; },
  bow(hold) { sam = null; pose = 'bow'; poseT = hold ?? 0; poseHold = hold !== undefined; },
  sam(t) { startSambae(); if (t !== undefined) { sam.t = t; sam.hold = true; } },
  release() { poseHold = false; if (sam) sam.hold = false; },
  walk(on, run) { keys.KeyW = !!on; keys.ShiftLeft = !!run; },
  get glb() { return glb; },
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
  go(i, lx, lz) { const T = temples[i]; goTemple(T); if (lz !== undefined) { const [x, z] = L2W(lx, lz); avatar.position.set(x, 0, z); } return T.name; },
};
