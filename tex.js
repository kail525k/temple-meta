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
// 합치는 부품(parts)에 UV가 없는 도형이 섞이면 합치기가 실패하므로 빈 UV를 채움
export function ensureUV(g) { if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }
