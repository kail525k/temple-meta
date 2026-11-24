// 사진처럼 보이는 조각상 (사천왕 등)
// - 생성한 조각상 그림(배경 투명 WebP)을 얇은 판에 붙이되, 그림 윤곽 안쪽을 둥글게 부풀려 앞면을 입체(부조)로 만듦
// - 옆에서 봐도 종이처럼 납작하지 않고, 앞에서 보면 실제 조각상 사진과 같은 모습
// - 그림은 위레브가 Gemini로 새로 만든 것 (실제 특정 불상을 옮긴 것이 아님)
import * as THREE from 'three';

const cache = new Map();
const loadImg = url => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });

// 높이 1 기준 부조 판 (가로 = 그림 비율), 부풀림 = depth (높이에 대한 비율)
function build(url, depth) {
  const key = url + '|' + depth;
  if (cache.has(key)) return cache.get(key);
  const p = loadImg(url).then(im => {
    const W = im.naturalWidth, H = im.naturalHeight, aspect = W / H, nx = 60, ny = Math.round(nx / aspect);
    const cv = document.createElement('canvas'); cv.width = nx; cv.height = ny;
    const c2 = cv.getContext('2d', { willReadFrequently: true }); c2.drawImage(im, 0, 0, nx, ny);
    const px = c2.getImageData(0, 0, nx, ny).data, N = nx * ny, d = new Float32Array(N);
    for (let i = 0; i < N; i++) d[i] = px[i * 4 + 3] > 40 ? 1e6 : 0;
    const at = (x, y) => (x < 0 || y < 0 || x >= nx || y >= ny) ? 0 : d[y * nx + x];
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { const i = y * nx + x; if (d[i]) d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.41, at(x + 1, y - 1) + 1.41); }
    for (let y = ny - 1; y >= 0; y--) for (let x = nx - 1; x >= 0; x--) { const i = y * nx + x; if (d[i]) d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.41, at(x - 1, y + 1) + 1.41); }
    const R = nx * .2; let z = new Float32Array(N);
    for (let i = 0; i < N; i++) { const t = Math.min(d[i] / R, 1); z[i] = d[i] ? 1 - (1 - t) * (1 - t) : 0; } // 가장자리는 둥글게, 안쪽은 도톰하게
    for (let k = 0; k < 2; k++) { const z2 = new Float32Array(N); // 부드럽게
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { let s = 0, n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx < 0 || yy < 0 || xx >= nx || yy >= ny) continue; s += z[yy * nx + xx]; n++; } z2[y * nx + x] = d[y * nx + x] ? s / n : 0; }
      z = z2; }
    const front = new THREE.PlaneGeometry(aspect, 1, nx - 1, ny - 1); front.translate(0, .5, 0);
    const pos = front.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, z[i] * depth);
    front.computeVertexNormals();
    const back = front.clone(); const bp = back.attributes.position; // 뒷면: 얕게 부풀린 거울 모양 (뒤로 돌아가 봐도 비지 않게)
    for (let i = 0; i < bp.count; i++) bp.setZ(i, -bp.getZ(i) * .55);
    const ix = back.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = t; }
    back.computeVertexNormals();
    const tex = new THREE.Texture(im); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.needsUpdate = true;
    return { front, back, tex, aspect };
  });
  cache.set(key, p); return p;
}

// parent 안 (x, y, z)에 바닥을 대고 ry 쪽을 바라보게 세움 · h: 높이(m)
export function reliefStatue(parent, url, { x = 0, y = 0, z = 0, ry = 0, h = 2, depth = .12, glow = .14, backTint = 0x5a5550, mirror = false } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.scale.set(mirror ? -h : h, h, h); parent.add(g);
  build(url, depth).then(({ front, back, tex }) => {
    const mf = new THREE.MeshStandardMaterial({ map: tex, alphaTest: .5, roughness: .72, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: glow });
    const mb = new THREE.MeshStandardMaterial({ map: tex, alphaTest: .5, roughness: .9, color: backTint });
    for (const [geo, m] of [[front, mf], [back, mb]]) { const o = new THREE.Mesh(geo, m); o.castShadow = true; o.receiveShadow = true; g.add(o); }
  }).catch(() => { });
  return g;
}
