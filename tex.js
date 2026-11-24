// 사실감용 텍스처 (Gemini로 새로 그린 그림 — 특정 사찰을 베끼지 않은 전통 양식 문양) · 위레브
// - 단청 띠: 4:1 가로 띠, 좌우 반복. 띠 높이 하나에 그림 한 벌(가로 = 높이×4)이 들어가게 UV를 늘림
// - 기와: 1:1, 수키와 줄이 세로(지붕 물매 방향)로 이어짐. 지붕 면마다 처마 방향 = u, 물매 방향 = v
import * as THREE from 'three';
const cache = {};
function load(url, { repeat = true, aniso = 4 } = {}) {
  if (cache[url]) return cache[url];
  const t = new THREE.TextureLoader().load(url);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (cache[url] = t);
}
export const TEX_V = 1;
export const dancheongTex = () => load('./assets/tex/dancheong.webp?v=' + TEX_V);
export const roofTex = () => load('./assets/tex/giwa.webp?v=' + TEX_V);
export const stoneTex = () => load('./assets/tex/gidan.webp?v=' + TEX_V);  // 장대석 2단 (1:1, 한 장 = 기단 높이)
export const wallTex = () => load('./assets/tex/wall.webp?v=' + TEX_V);    // 기둥 사이 벽 한 칸 (위 벽화 · 아래 회벽 · 하인방)
export const yardTex = () => load('./assets/tex/yard.webp?v=' + TEX_V);    // 마사토 마당 (1:1 심리스)
export const pathTex = () => load('./assets/tex/path.webp?v=' + TEX_V);    // 박석 참배길 (1:1 심리스)
export const doorTex = () => load('./assets/tex/door.webp?v=' + TEX_V, { repeat: false }); // 꽃살 사분합문 두 짝 (1:1.4)
// 단청 재질: 색을 흰색으로 두고 그림을 그대로 보여 줌. userData.strip → 상자 UV를 띠 비율로 늘림
export function paintBand(mat) { if (!mat || mat.userData.strip) return mat; mat.map = dancheongTex(); mat.color.set('#ffffff'); mat.userData.strip = true; mat.needsUpdate = true; return mat; }
export function paintRoof(mat, tint = '#f4f6f8') { if (!mat || mat.userData.roofTex) return mat; mat.map = roofTex(); mat.color.set(tint); mat.userData.roofTex = true; mat.needsUpdate = true; return mat; }
// 상자(BoxGeometry) UV를 띠 비율로: 앞뒤·위아래 면은 가로(w), 옆면은 깊이(d) 방향으로 그림이 반복
export function stripUV(geo, w, h, d) {
  const uv = geo.attributes.uv; if (!uv) return geo;
  const unit = Math.max(.05, h) * 4, span = [d, d, w, w, w, w];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setX(k, uv.getX(k) * span[f] / unit); }
  uv.needsUpdate = true; return geo;
}
// 지붕 UV: 면이 바라보는 쪽(±x/±z 중 가까운 쪽)을 기준으로 u = 처마 방향, v = 물매 방향 (한 장 = su × sv m)
export function roofUV(geo, su = 1.8, sv = 1.8) {
  const p = geo.attributes.position, n = p.count, uv = new Float32Array(n * 2), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    nn.subVectors(c, b).cross(b.clone().sub(a)).normalize(); if (nn.y < 0) nn.negate();
    const hx = Math.abs(nn.x) > Math.abs(nn.z) ? Math.sign(nn.x) : 0, hz = hx ? 0 : Math.sign(nn.z) || 1, k = 1 / Math.max(.35, nn.y);
    for (let j = 0; j < 3; j++) { const q = [a, b, c][j]; uv[(i + j) * 2] = (q.x * hz - q.z * hx) / su; uv[(i + j) * 2 + 1] = -(q.x * hx + q.z * hz) * k / sv; }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geo;
}
// 처마 밑(서까래 + 사이 개판)과 처마 끝(막새 줄 + 서까래 마구리 연화 머리) — 캔버스로 그림. 한 장 가로 = 서까래 두 개
function canvasTex(key, w, h, draw) {
  if (cache[key]) return cache[key];
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (cache[key] = t);
}
export const soffitTex = () => canvasTex('soffit', 128, 32, (c, w, h) => {
  c.fillStyle = '#8c3b2c'; c.fillRect(0, 0, w, h);                       // 개판(주토)
  for (const x0 of [0, w / 2]) {
    const rw = w * .3, x = x0 + w / 4 - rw / 2;
    c.fillStyle = '#1d4339'; c.fillRect(x - 3, 0, rw + 6, h);           // 그늘
    c.fillStyle = '#3e8a74'; c.fillRect(x, 0, rw, h);                   // 서까래(뇌록)
    c.fillStyle = '#5fae95'; c.fillRect(x + rw * .3, 0, rw * .22, h);   // 둥근 서까래에 비친 빛
  }
});
export const eaveTex = (single = false) => single ? canvasTex('eave1', 128, 64, (c, w, h) => { // 홑처마: 막새 줄 + 서까래 마구리
  c.fillStyle = '#1c3a32'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#4b535b'; c.fillRect(0, 0, w, 18);
  for (let x = 8; x < w; x += 16) { c.fillStyle = '#626c75'; c.beginPath(); c.arc(x, 10, 6.5, 0, Math.PI * 2); c.fill(); c.fillStyle = '#3c434a'; c.beginPath(); c.arc(x, 10, 2.5, 0, Math.PI * 2); c.fill(); }
  for (const cx of [w / 4, w * 3 / 4]) [[19, '#2f7a63'], [15, '#f0cf62'], [11, '#c8432e'], [7, '#f6efe0'], [3.5, '#2f5f96']].forEach(([r, col]) => { c.fillStyle = col; c.beginPath(); c.arc(cx, 41, r, 0, Math.PI * 2); c.fill(); });
}) : canvasTex('eave2', 128, 96, (c, w, h) => { // 겹처마: 막새 줄 · 부연 마구리(네모) · 서까래 마구리(둥근 연화)
  c.fillStyle = '#1c3a32'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#4b535b'; c.fillRect(0, 0, w, 16);                      // 막새 줄
  for (let x = 8; x < w; x += 16) { c.fillStyle = '#626c75'; c.beginPath(); c.arc(x, 9, 6, 0, Math.PI * 2); c.fill(); c.fillStyle = '#3c434a'; c.beginPath(); c.arc(x, 9, 2.3, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#2b5a4c'; c.fillRect(0, 16, w, 30);                     // 부연 줄 (평고대 그늘)
  for (const cx of [w / 4, w * 3 / 4]) {
    c.fillStyle = '#e9c45c'; c.fillRect(cx - 13, 19, 26, 24); c.fillStyle = '#2f7a63'; c.fillRect(cx - 10, 22, 20, 18); // 부연 마구리: 노란 테 + 녹 바탕
    c.fillStyle = '#f6efe0'; for (const [dx, dy] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) { c.beginPath(); c.arc(cx + dx, 31 + dy, 2.4, 0, Math.PI * 2); c.fill(); } // 매화점
    c.fillStyle = '#c8432e'; c.beginPath(); c.arc(cx, 31, 2.6, 0, Math.PI * 2); c.fill();
    [[19, '#2f7a63'], [15, '#f0cf62'], [11, '#c8432e'], [7, '#f6efe0'], [3.5, '#2f5f96']].forEach(([r, col]) => { c.fillStyle = col; c.beginPath(); c.arc(cx, 71, r, 0, Math.PI * 2); c.fill(); }); // 서까래 마구리
  }
});
// 공포 띠 바탕: 평방(아래)·장혀(위) 사이 포벽(주토) + 연꽃 그림 — 공포(첨차·쇠서)는 hall.js에서 입체로 붙임. 4:1 띠
export const gongpoTex = () => canvasTex('gongpo', 512, 128, (c, w, h) => {
  c.fillStyle = '#7d3527'; c.fillRect(0, 0, w, h);                                // 포벽
  c.fillStyle = '#15241f'; c.fillRect(0, 0, w, 14);                               // 처마 밑 그늘
  const bar = (y, hh, col) => { c.fillStyle = col; c.fillRect(0, y, w, hh); c.fillStyle = '#efe6cf'; c.fillRect(0, y + 2, w, 1.5); c.fillRect(0, y + hh - 3.5, w, 1.5); };
  bar(14, 16, '#2b6656'); bar(104, 24, '#3f8a73');                                // 장혀 · 평방
  for (let i = 0; i < 6; i++) { const cx = w * (i + .5) / 6, cy = 66;               // 포벽 연꽃
    c.fillStyle = '#a24a33'; c.beginPath(); c.ellipse(cx, cy, 22, 16, 0, 0, Math.PI * 2); c.fill();
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; c.fillStyle = k % 2 ? '#f1d27a' : '#f4f0e2'; c.beginPath(); c.ellipse(cx + Math.cos(a) * 10, cy + Math.sin(a) * 7, 6, 3.5, a, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#d0452f'; c.beginPath(); c.arc(cx, cy, 4, 0, Math.PI * 2); c.fill();
  }
});
// 합치는 부품(parts)에 UV가 없는 도형이 섞이면 합치기가 실패하므로 빈 UV를 채움
export function ensureUV(g) { if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }
