// 지역·사찰마다 다른 모습 (위레브)
// - 권역 풍경: 나무 종류(전나무·소나무·대나무·동백·귤·은행·단풍), 뒷산 높이·눈, 서울은 빌딩 숲, 제주는 한라산·현무암 돌담
// - 사찰 상징물: 월정사 팔각구층석탑, 법주사 팔상전, 불국사 석가탑·다보탑, 신흥사 통일대불, 금산사 미륵전,
//   통도사 금강계단, 해인사 장경판전, 백양사 쌍계루, 선암사 승선교, 관음사 석불 길, 조계사 노거수 등
// 모두 코드로 그린 단순한 모양(실제 사진·도면을 옮기지 않음)
import * as THREE from 'three';
import { hipRoofGeo, gableRoofGeo } from './hall.js?v=11';
import { createSchool, tankFish } from './fish.js?v=6';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, flatShading: true, ...extra });
export const R = {
  bronze: M('#8a6b3a', { metalness: .45, roughness: .45 }), roofTile: M('#4f5b69', { side: THREE.DoubleSide }), redCol: M('#9b3b2b'),
  white: M('#f3e6cc'), wood: M('#7d5a3c'), lattice: M('#5a4330'), water: new THREE.MeshStandardMaterial({ color: '#5d8fa6', roughness: .15, metalness: .2, emissive: '#1d3f52', emissiveIntensity: .35 }),
  band: M('#2e8b74'), granite: M('#d4cdbf'), granite2: M('#b9b2a4'),
  sea: new THREE.MeshStandardMaterial({ color: '#2f7f99', roughness: .25, metalness: .1, emissive: '#0d3446', emissiveIntensity: .45, flatShading: true }),
  shallow: new THREE.MeshStandardMaterial({ color: '#58aebd', roughness: .3, emissive: '#16505c', emissiveIntensity: .4, transparent: true, opacity: .85 }),
  rock: M('#a39f96'), rock2: M('#8d8a83'), marble: M('#f1efe9', { roughness: .55 }), rail: M('#f4f1ea'),
  gold: new THREE.MeshStandardMaterial({ color: '#e0b040', metalness: .7, roughness: .3, emissive: '#6a4a08', emissiveIntensity: .5, flatShading: true }),
  fish: M('#3d4a52'), fishFin: M('#c8643a'),
};
// 서 있는 하얀 관세음보살 (해수관음·지혜관음): 옷자락 실루엣을 돌려 깎은 모양 + 머리·보관·정병·광배
export function standingGwaneum(add, x, y, z, H, ry = 0, mat = R.marble) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; add(g);
  const prof = [[0, 0], [.17, 0], [.165, .04], [.135, .3], [.12, .52], [.13, .66], [.128, .74], [.09, .78], [.05, .8], [0, .8]].map(([r, yy]) => new THREE.Vector2(r * H, yy * H));
  const mk = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; g.add(m); return m; };
  mk(new THREE.LatheGeometry(prof, 18), mat, 0, 0, 0);
  mk(new THREE.SphereGeometry(.068 * H, 16, 12), mat, 0, .855 * H, 0);
  mk(new THREE.CylinderGeometry(.03 * H, .045 * H, .08 * H, 10), mat, 0, .935 * H, -.005 * H);
  mk(new THREE.CylinderGeometry(.055 * H, .06 * H, .03 * H, 12), mat, 0, .9 * H, 0);
  for (const sx of [-1, 1]) { const a = mk(new THREE.CylinderGeometry(.028 * H, .034 * H, .3 * H, 8), mat, sx * .125 * H, .62 * H, .02 * H); a.rotation.z = sx * .12; }
  mk(new THREE.SphereGeometry(.035 * H, 10, 8), mat, .05 * H, .55 * H, .11 * H); mk(new THREE.CylinderGeometry(.008 * H, .014 * H, .07 * H, 8), mat, .05 * H, .6 * H, .11 * H); // 정병
  const halo = mk(new THREE.TorusGeometry(.1 * H, .006 * H, 6, 32), mat, 0, .86 * H, -.07 * H);
  return g;
}


/* ───────── 탑 ───────── */
// 화강암: 표면 결(흑운모·장석 알갱이), 빗물 자국, 지의류(이끼) 얼룩을 세계 좌표로 그려 이음매 없이 덮음
const GRANITE_GLSL = `
float gh(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gh(i), gh(i + vec3(1,0,0)), f.x), mix(gh(i + vec3(0,1,0)), gh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(gh(i + vec3(0,0,1)), gh(i + vec3(1,0,1)), f.x), mix(gh(i + vec3(0,1,1)), gh(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;
function graniteMat(color, { lichen = .5, streak = .5, rough = .9, side = THREE.FrontSide } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, side });
  m.onBeforeCompile = sh => {
    sh.uniforms.uLichen = { value: lichen }; sh.uniforms.uStreak = { value: streak };
    sh.vertexShader = 'varying vec3 vGW; varying vec3 vGN;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vGW = (modelMatrix * vec4(transformed, 1.0)).xyz; vGN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = 'varying vec3 vGW; varying vec3 vGN; uniform float uLichen; uniform float uStreak;\n' + GRANITE_GLSL + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  { vec3 p = vGW; float g1 = gn(p * 46.0), g2 = gn(p * 12.0 + 7.1), big = gn(p * 1.6 + 3.3), big2 = gn(p * 4.3 - 2.0);
    vec3 c = diffuseColor.rgb * (.9 + .14 * g2 + .1 * (g1 - .5));
    c = mix(c, c * .5, smoothstep(.76, .9, g1));
    c = mix(c, min(c * 1.16, vec3(1.0)), smoothstep(.8, .95, gn(p * 29.0 + 11.0)));
    float vert = 1.0 - abs(vGN.y);
    float st = gn(vec3(p.x * 9.0 + p.z * 7.0, p.y * .7, p.z * 9.0 - p.x * 3.0));
    c *= 1.0 - uStreak * .24 * vert * smoothstep(.45, .85, st);
    float li = smoothstep(.56, .8, big * .7 + big2 * .3);
    c = mix(c, vec3(.47, .5, .4) * (.8 + .3 * g2), uLichen * .5 * li * (.35 + .65 * max(vGN.y, 0.0) + .25 * vert));
    if (vGN.y < -.5) c *= .82;
    diffuseColor.rgb = c; }`);
  };
  m.customProgramCacheKey = () => 'granite' + lichen + streak;
  return m;
}
let GR_ = null;
export const GR = () => GR_ || (GR_ = { a: graniteMat('#cfc8ba', { lichen: .5, streak: .55 }), b: graniteMat('#bcb4a5', { lichen: .75, streak: .8 }), rail: graniteMat('#bcb4a5', { lichen: .6, streak: .6, side: THREE.DoubleSide }) });

// 여러 조각을 재질별로 하나로 합쳐(그리기 횟수 줄임) 놓음
function parts() {
  const L = new Map();
  const put = (geo, mat, px = 0, py = 0, pz = 0) => { geo.translate(px, py, pz); const g = geo.index ? geo.toNonIndexed() : geo; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); g.clearGroups(); (L.get(mat) || L.set(mat, []).get(mat)).push(g); return g; };
  const flat = g => { const n = g.toNonIndexed(); n.computeVertexNormals(); return n; };
  return {
    put,
    box: (w, hh, d, mat, px, py, pz) => put(new THREE.BoxGeometry(w, hh, d), mat, px, py, pz),
    frus: (wt, wb, hh, mat, px, py, pz) => { const g = new THREE.CylinderGeometry(wt * Math.SQRT1_2, wb * Math.SQRT1_2, hh, 4, 1); g.rotateY(Math.PI / 4); return put(flat(g), mat, px, py, pz); },
    cyl: (rt, rb, hh, seg, mat, px, py, pz, faceted = false) => { const g = new THREE.CylinderGeometry(rt, rb, hh, seg); if (seg === 8) g.rotateY(Math.PI / 8); return put(faceted ? flat(g) : g, mat, px, py, pz); },
    flush(h, x, z) { for (const [mat, gs] of L) h.add(mergeGeometries(gs), mat, x, 0, z); },
  };
}
// 옥개석(지붕돌): 가운데 평평한 윗면 → 오목하게 흘러내리는 낙수면 → 얇은 처마, 네 귀가 살짝 들림(반전)
function okgaeGeo(W, Wt, t, H, lift, N = 16) {
  const hw = W / 2, a = Wt / W, pos = [], uv = [], idx = [];
  const corner = (x, z) => { const u = Math.max(Math.abs(x), Math.abs(z)) / hw, rim = Math.max(0, (u - .5) / .5); return lift * Math.pow(Math.abs(x * z) / (hw * hw), 2.2) * rim * rim; };
  const yTop = (x, z) => { const u = Math.max(Math.abs(x), Math.abs(z)) / hw, q = Math.min(1, Math.max(0, (u - a) / (1 - a))); return t + H * Math.pow(1 - q, 1.6) + corner(x, z); };
  const V = (x, y, z) => { pos.push(x, y, z); uv.push(x / W + .5, z / W + .5); return pos.length / 3 - 1; };
  const grid = (fy, up) => {
    const b0 = pos.length / 3;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const x = -hw + W * i / N, z = -hw + W * j / N; V(x, fy(x, z), z); }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const A = b0 + j * (N + 1) + i, C = A + 1, B = A + N + 1, D = B + 1, cx = -hw + W * (i + .5) / N, cz = -hw + W * (j + .5) / N;
      for (const [p, q, r] of (cx * cz > 0 ? [[A, B, D], [A, D, C]] : [[A, B, C], [C, B, D]])) up ? idx.push(p, q, r) : idx.push(p, r, q);
    }
  };
  grid(yTop, true); grid(corner, false);
  const side = (x0, z0, x1, z1) => { for (let k = 0; k < N; k++) {
    const xa = x0 + (x1 - x0) * k / N, za = z0 + (z1 - z0) * k / N, xb = x0 + (x1 - x0) * (k + 1) / N, zb = z0 + (z1 - z0) * (k + 1) / N;
    const Ba = V(xa, corner(xa, za), za), Bb = V(xb, corner(xb, zb), zb), Ta = V(xa, yTop(xa, za), za), Tb = V(xb, yTop(xb, zb), zb); idx.push(Ba, Bb, Ta, Ta, Bb, Tb);
  } };
  side(-hw, hw, hw, hw); side(hw, hw, hw, -hw); side(hw, -hw, -hw, -hw); side(-hw, -hw, -hw, hw);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// 신라 전형 석탑 n층 (s: 크기 배율, bronze: 청동 상륜)
// 지대석 → 2단 기단(면석에 우주·탱주, 갑석) → 몸돌(우주) + 층급받침 + 옥개석 → 상륜부(노반·복발·앙화·보륜·보개·보주, 찰주)
export function stoneTiers(h, x, z, n, s = 1, bronze = false, o = {}) { // o.single: 단층기단(고려 탑) · o.slim: 몸돌 폭 배율 · o.flat: 지붕돌 귀 반전 약하게
  const { a: GA, b: GB } = GR(), P = parts(), slim = o.slim || 1, lf = o.flat ? .35 : 1;
  P.box((o.single ? 2.1 : 2.62) * s, .12 * s, (o.single ? 2.1 : 2.62) * s, GB, 0, .06 * s, 0); // 지대석
  let y = .12 * s;
  const pillars = (W, H, nt, pw) => { // 우주(모서리 기둥)·탱주(가운데 기둥): 면석에서 살짝 돋을새김
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(pw, H, pw, GA, sx * (W / 2 - pw / 2 + .006 * s), y + H / 2, sz * (W / 2 - pw / 2 + .006 * s));
    for (let k = 1; k <= nt; k++) { const t = -W / 2 + W * k / (nt + 1), o = W / 2 - .008 * s; for (const sd of [-1, 1]) { P.box(pw * .85, H, .03 * s, GA, t, y + H / 2, sd * o); P.box(.03 * s, H, pw * .85, GA, sd * o, y + H / 2, t); } }
  };
  const base = (W, H, nt, lip, next) => {
    P.box(W - .04 * s, H, W - .04 * s, GA, 0, y + H / 2, 0); pillars(W, H, nt, .12 * s); y += H;
    if (lip) { P.box(W + .02 * s, .035 * s, W + .02 * s, GB, 0, y + .0175 * s, 0); y += .035 * s; } // 부연
    const cw = W + .17 * s; P.box(cw, .085 * s, cw, GB, 0, y + .0425 * s, 0); y += .085 * s; // 갑석
    P.frus(next + .26 * s, cw, .06 * s, GB, 0, y + .03 * s, 0); y += .06 * s; // 비스듬히 깎은 윗면
    P.box(next + .13 * s, .04 * s, next + .13 * s, GA, 0, y + .02 * s, 0); y += .04 * s; // 2단 굄
    P.box(next + .06 * s, .035 * s, next + .06 * s, GA, 0, y + .0175 * s, 0); y += .035 * s;
  };
  const bw = i => 1.04 * s * slim * (1 - i * .48 / n); // i층 몸돌 너비
  if (o.single) base(1.78 * s, .78 * s, 1, true, bw(0)); // 단층기단
  else { base(2.36 * s, .4 * s, 2, false, 1.84 * s); base(1.84 * s, .64 * s, n >= 5 ? 1 : 2, true, bw(0)); } // 하층기단 · 상층기단
  for (let i = 0; i < n; i++) {
    const f = 1 - i * .48 / n, w = bw(i), hh = s * (i ? .24 + .2 * f : .74);
    P.box(w - .02 * s, hh, w - .02 * s, GA, 0, y + hh / 2, 0); pillars(w, hh, 0, .1 * s * f); y += hh; // 몸돌 + 우주
    const ns = n >= 5 ? 4 : 5, st = .034 * s * f; // 층급받침
    for (let k = 0; k < ns; k++) { const ww = w + .03 * s + k * .08 * s * f; P.box(ww, st, ww, GB, 0, y + st / 2, 0); y += st; }
    const wn = i < n - 1 ? bw(i + 1) : w * .5, Wr = w + .84 * s * f, tt = .06 * s * f, tH = .19 * s * f;
    P.put(okgaeGeo(Wr, wn + .2 * s * f, tt, tH, .075 * s * f * lf), GB, 0, y, 0); y += tt + tH; // 옥개석
    if (i < n - 1) { P.box(wn + .1 * s * f, .03 * s, wn + .1 * s * f, GA, 0, y + .015 * s, 0); y += .03 * s; P.box(wn + .04 * s * f, .026 * s, wn + .04 * s * f, GA, 0, y + .013 * s, 0); y += .026 * s; }
  }
  // 상륜부
  const lw = bw(n - 1), nb = lw * .5, fm = bronze ? R.bronze : GB, sp = (r, sy) => { const g = new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, sy, 1); return g; };
  P.box(nb, .13 * s, nb, GA, 0, y + .065 * s, 0); y += .13 * s; // 노반
  P.frus(nb * .86, nb + .03 * s, .03 * s, GB, 0, y + .015 * s, 0); y += .03 * s;
  P.put(sp(nb * .42, .72), GA, 0, y, 0); y += nb * .42 * .72; // 복발
  P.cyl(nb * .2, nb * .2, .03 * s, 12, GB, 0, y + .015 * s, 0); y += .03 * s;
  P.cyl(nb * .44, nb * .22, .09 * s, 8, fm, 0, y + .045 * s, 0, true); y += .09 * s; // 앙화
  if (bronze) { // 마곡사 풍마동: 원나라 라마탑을 닮은 청동 보탑 (네모 받침 → 병 모양 몸 → 고리 첨탑 → 일산 → 보주)
    const B = R.bronze;
    P.box(nb * 1.1, .12 * s, nb * 1.1, B, 0, y + .06 * s, 0); P.box(nb * .86, .08 * s, nb * .86, B, 0, y + .16 * s, 0); y += .2 * s;
    const pr = [[.0, 0], [.2, 0], [.22, .04], [.26, .14], [.27, .26], [.24, .36], [.17, .42], [.11, .44], [0, .45]].map(([r, yy]) => new THREE.Vector2(r * s, yy * s));
    P.put(new THREE.LatheGeometry(pr, 16), B, 0, y, 0); y += .44 * s;                       // 병 모양 몸(복발)
    P.cyl(.05 * s, .09 * s, .08 * s, 8, B, 0, y + .04 * s, 0); y += .08 * s;
    for (let k = 0; k < 9; k++) { const r = (.085 - k * .006) * s; P.cyl(r, r + .01 * s, .045 * s, 12, B, 0, y + .0225 * s, 0); y += .05 * s; } // 13층 고리 첨탑을 줄여서
    P.cyl(.04 * s, .17 * s, .06 * s, 12, B, 0, y + .03 * s, 0); y += .06 * s;                         // 일산
    P.put(new THREE.SphereGeometry(.05 * s, 10, 8).translate(0, y + .06 * s, 0), B); P.put(new THREE.ConeGeometry(.03 * s, .14 * s, 8).translate(0, y + .17 * s, 0), B);
    P.flush(h, x, z);
    return 1.32 * s;
  }
  const rings = bronze ? 5 : 3, top = y + (bronze ? 1.2 : .78) * s;
  P.cyl(.026 * s, .03 * s, top - y, 8, fm, 0, (y + top) / 2, 0); // 찰주
  for (let k = 0; k < rings; k++) { const r = (.15 - k * .012) * s; P.cyl(r, r, .04 * s, 16, fm, 0, y + (.08 + k * .12) * s, 0); } // 보륜
  y += (.08 + rings * .12) * s;
  P.cyl(.05 * s, .19 * s, .07 * s, 8, fm, 0, y, 0, true); // 보개
  if (bronze) P.put(new THREE.ConeGeometry(.08 * s, .2 * s, 8), fm, 0, y + .16 * s, 0); // 수연(불꽃)
  P.put(new THREE.SphereGeometry(.05 * s, 10, 8), fm, 0, top - .14 * s, 0); P.put(new THREE.SphereGeometry(.065 * s, 12, 10), fm, 0, top - .02 * s, 0); // 용차·보주
  P.flush(h, x, z);
  return 1.32 * s;
}
// 월정사 팔각구층석탑: 팔각 2단 기단(연꽃 받침) + 팔각 몸돌 9층, 처마 귀마다 풍경, 청동 상륜
function octa9(h, x, z, n = 9) { // n층 (조계사 팔각십층석탑은 n=10)
  const { a: GA, b: GB } = GR(), P = parts(), C = (rt, rb, hh, mat, y, faceted = true) => P.cyl(rt, rb, hh, 8, mat, 0, y + hh / 2, 0, faceted);
  C(1.75, 1.8, .3, GB, 0); C(1.5, 1.6, .26, GA, .3);
  P.cyl(1.22, 1.5, .2, 16, GA, 0, .66, 0); // 연꽃 받침 몸
  for (let i = 0; i < 16; i++) { const a = (i + .5) / 16 * Math.PI * 2, pt = new THREE.SphereGeometry(1, 12, 8); pt.scale(.27, .05, .3); pt.rotateX(.55); pt.rotateY(a); P.put(pt, GA, Math.sin(a) * 1.3, .7, Math.cos(a) * 1.3); // 복련: 엎어 놓은 연잎
    const tip = new THREE.SphereGeometry(1, 8, 6); tip.scale(.07, .04, .09); tip.rotateX(.2); tip.rotateY(a); P.put(tip, GA, Math.sin(a) * 1.55, .58, Math.cos(a) * 1.55); } // 잎 끝이 살짝 들림
  C(1.0, 1.25, .2, GB, .56); C(.92, .92, .32, GA, .76); C(1.12, .95, .12, GB, 1.08); // 중대석·갑석
  let y = 1.2;
  for (let i = 0; i < n; i++) {
    const r = .7 * (1 - i * .45 / n), hh = i ? .34 - i * .09 / n : .6;
    C(r, r, hh, GA, y); y += hh;
    C(r + .1, r, .05, GB, y); y += .05; // 받침
    const R1 = r + .42, R2 = r + .1;
    C(R1, R1, .05, GB, y); C(R2, R1, .1, GB, y + .05); // 처마 · 낙수면
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8, cx = Math.sin(a) * R1 * .98, cz = Math.cos(a) * R1 * .98; // 풍경
      P.cyl(.004, .004, .1, 4, R.bronze, cx, y - .05, cz); P.cyl(.014, .03, .07, 6, R.bronze, cx, y - .13, cz); }
    y += .15;
  }
  P.flush(h, x, z);
  const { add } = h, B = R.bronze;
  add(new THREE.CylinderGeometry(.05, .08, 1.8, 8), B, x, y + .9, z);
  for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(.2 - i * .02, .2 - i * .02, .05, 12), B, x, y + .3 + i * .22, z);
  add(new THREE.SphereGeometry(.1, 10, 8), B, x, y + 1.85, z);
  return 1.8;
}
// 법주사 팔상전: 나무로 지은 5층 목탑
function wood5(h, x, z) {
  const { box, add } = h;
  box(4.4, .7, 4.4, h.MAT.stone, x, .35, z);
  for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) box(dx ? .9 : 1.4, .35, dz ? .9 : 1.4, h.MAT.stone, x + dx * 2.55, .175, z + dz * 2.55);
  let y = .7;
  const tiers = [[3.3, 1.55], [2.75, 1.0], [2.25, .95], [1.75, .9], [1.3, .85]];
  tiers.forEach(([w, hh], i) => {
    box(w, hh, w, R.white, x, y + hh / 2, z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(.16, hh, .16, R.redCol, x + sx * w / 2, y + hh / 2, z + sz * w / 2);
    box(w + .06, .16, w + .06, R.band, x, y + hh - .08, z);
    if (i === 0) for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) box(dx ? .04 : w * .55, hh * .7, dz ? .04 : w * .55, R.lattice, x + dx * (w / 2 + .01), y + hh * .4, z + dz * (w / 2 + .01));
    y += hh;
    const rw = w + 1.5, rh = rw * (i === 4 ? .34 : .2);
    const m = add(hipRoofGeo(THREE, rw, rw, rh, .5, .25), R.roofTile, x, y, z); m.receiveShadow = false;
    y += i === 4 ? rh : rh * .42;
  });
  add(new THREE.CylinderGeometry(.06, .1, 2.2, 8), R.bronze, x, y + 1.1, z);
  for (let i = 0; i < 7; i++) add(new THREE.CylinderGeometry(.24 - i * .02, .24 - i * .02, .05, 12), R.bronze, x, y + .4 + i * .2, z);
  add(new THREE.SphereGeometry(.12, 10, 8), R.bronze, x, y + 2.25, z);
  return 2.3;
}
// 불국사 다보탑 (석가탑은 stoneTiers 3층)
function dabotap(h, x, z) {
  const { a: GA, b: GB } = GR();
  const { box, add } = h, S = 1.1;
  box(2.7 * S, .5, 2.7 * S, GA, x, .25, z);
  for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) box(dx ? .5 : .9, .25, dz ? .5 : .9, GA, x + dx * 1.6 * S, .125, z + dz * 1.6 * S);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(.24, 1.1, .24, GA, x + sx * .78 * S, 1.05, z + sz * .78 * S);
  box(.5, 1.1, .5, GA, x, 1.05, z);
  box(2.1 * S, .18, 2.1 * S, GB, x, 1.69, z);
  const rail = (r, hh, y) => { const m = add(new THREE.CylinderGeometry(r, r, hh, 8, 1, true), GR().rail, x, y, z); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; box(.08, hh + .1, .08, GA, x + Math.sin(a) * r, y, z + Math.cos(a) * r); } };
  rail(.95, .36, 1.98); add(new THREE.CylinderGeometry(.55, .55, .6, 8), GA, x, 2.08, z);
  rail(.68, .26, 2.52); add(new THREE.CylinderGeometry(.62, .34, .26, 8), GA, x, 2.78, z);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; box(.07, .5, .07, GA, x + Math.sin(a) * .42, 3.1, z + Math.cos(a) * .42); }
  add(new THREE.CylinderGeometry(.22, .9, .2, 8), GB, x, 3.42, z);
  add(new THREE.CylinderGeometry(.04, .07, .9, 8), GB, x, 3.95, z);
  for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(.1 - i * .015, 10, 8), GB, x, 3.75 + i * .22, z);
  return 1.5;
}
// 해동용궁사 사사자 석탑: 네 마리 돌사자가 받친 삼층석탑
function lion3(h, x, z, o = {}) { // o.monk: 사자 넷 가운데 합장한 스님상 (화엄사 사사자 삼층석탑) · o.s: 크기
  const { a: GA, b: GB } = GR();
  const { box, add } = h, S = o.s || .9;
  box(2.5 * S, .4, 2.5 * S, GA, x, .2, z);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lx = x + sx * .72 * S, lz = z + sz * .72 * S, ry = Math.atan2(sx, sz);
    const g = new THREE.Group(); g.position.set(lx, .4, lz); g.rotation.y = ry; h.site.add(g);
    const mk = (geo, px, py, pz, sx2 = 1, sy = 1, sz2 = 1) => { const m = new THREE.Mesh(geo, GA); m.position.set(px, py, pz); m.scale.set(sx2, sy, sz2); m.castShadow = true; g.add(m); return m; };
    mk(new THREE.SphereGeometry(.24, 10, 8), 0, .3, -.05, .9, 1.1, 1.2);        // 앉은 몸
    mk(new THREE.SphereGeometry(.2, 10, 8), 0, .6, .1, 1.1, 1, 1);               // 갈기 머리
    mk(new THREE.SphereGeometry(.1, 8, 6), 0, .56, .27, 1, .8, .8);              // 주둥이
    for (const s2 of [-1, 1]) mk(new THREE.CylinderGeometry(.05, .06, .36, 6), s2 * .1, .18, .16);
  }
  if (o.monk) { // 합장한 스님상: 연꽃 받침 위에 서서 머리는 갑석에 닿지 않음
    add(new THREE.CylinderGeometry(.2, .2, .1, 10), GA, x, .45, z);
    add(new THREE.CylinderGeometry(.11, .17, .52, 10), GA, x, .76, z); add(new THREE.SphereGeometry(.09, 10, 8), GA, x, 1.1, z);
    add(new THREE.BoxGeometry(.06, .14, .06), GA, x, .9, z + .14);
  } else box(.36, .82, .36, GB, x, .81, z);
  box(2.1 * S, .2, 2.1 * S, GB, x, 1.32, z);
  const up = { ...h, add: (geo, m, px, py, pz, s) => add(geo, m, px, py + 1.42, pz, s), box: (w, hh, d, m, px, py, pz) => add(new THREE.BoxGeometry(w, hh, d), m, px, py + 1.42, pz) };
  stoneTiers(up, x, z, 3, .7 * S / .9);
  return 1.25 * S;
}
// 탑 둘레 돌난간 (선운사 육층석탑·직지사 삼층석탑처럼 네모나게 두름): 돌기둥 + 두 줄 난간대
export function stoneRail(h, x, z, hw, hd = hw) {
  const { a: GA, b: GB } = GR(), P = parts(), H = .66, pts = [];
  const nx = Math.max(2, Math.round(hw * 2 / .95)), nz = Math.max(2, Math.round(hd * 2 / .95));
  for (let i = 0; i <= nx; i++) for (const sz of [-1, 1]) pts.push([-hw + 2 * hw * i / nx, sz * hd]);
  for (let i = 1; i < nz; i++) for (const sx of [-1, 1]) pts.push([sx * hw, -hd + 2 * hd * i / nz]);
  for (const [px, pz] of pts) { P.box(.13, H, .13, GA, px, H / 2, pz); P.box(.17, .07, .17, GB, px, H + .035, pz); }
  for (const yy of [.24, .5]) { for (const sz of [-1, 1]) P.box(2 * hw, .06, .07, GB, 0, yy, sz * hd); for (const sx of [-1, 1]) P.box(.07, .06, 2 * hd, GB, sx * hw, yy, 0); }
  P.flush(h, x, z);
  h.col(x, z, hw + .1, hd + .1);
}
// 금산사 육각다층석탑: 화강암 연꽃 받침 위에 검은 점판암 지붕돌을 겹겹이 쌓은 작은 육각 탑 (높이 2m 남짓)
let SLATE_ = null; const slate = () => SLATE_ || (SLATE_ = graniteMat('#4a4c50', { lichen: .15, streak: .35 }));
function hexSlate(h, x, z) {
  const { a: GA, b: GB } = GR(), P = parts(), SL = slate(), C = (rt, rb, hh, mat, y) => P.cyl(rt, rb, hh, 6, mat, 0, y + hh / 2, 0, true);
  P.box(2.2, .3, 2.2, GB, 0, .15, 0); // 받침 돌단
  C(.78, .84, .16, GA, .3); C(.62, .72, .14, GA, .46);
  for (let i = 0; i < 12; i++) { const a = (i + .5) / 12 * Math.PI * 2, pt = new THREE.SphereGeometry(1, 10, 6); pt.scale(.16, .06, .2); pt.rotateX(.5); pt.rotateY(a); P.put(pt, GA, Math.sin(a) * .6, .64, Math.cos(a) * .6); } // 복련
  C(.34, .4, .3, GA, .6); C(.6, .42, .1, GA, .9); // 중대석 · 앙련 받침
  let y = 1.0;
  for (let i = 0; i < 11; i++) {
    const f = 1 - i * .5 / 11, br = .24 * f, bh = i ? .06 : .16, rr = .52 * (1 - i * .42 / 11);
    C(br, br, bh, SL, y); y += bh;
    C(rr * .55, rr, .07, SL, y); y += .07; // 얇은 육각 지붕돌
  }
  P.put(new THREE.SphereGeometry(.09, 10, 8), GA, 0, y + .08, 0); P.cyl(.03, .03, .2, 6, GB, 0, y + .1, 0);
  P.flush(h, x, z);
  return 1.15;
}
// 월정사 석조보살좌상(복제본): 탑을 향해 무릎 꿇고 공양하는 보살 · 원통형 높은 보관 (단순한 덩어리로만 그림)
function offeringBosal(h, x, z, ry) { // 월정사 석조보살좌상: 왼 무릎을 세우고 꿇어앉아 두 손으로 공양구를 받든 보살 · 원통형 높은 보관 · 통통한 얼굴
  const { a: GA, b: GB } = GR(), g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; h.site.add(g);
  const mk = (geo, px, py, pz, sx = 1, sy = 1, sz = 1, mat = GA, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); m.rotation.set(rx, 0, rz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const up = new THREE.Vector3(0, 1, 0), limb = (a, b, r) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), n = d.length(); const m = mk(new THREE.CapsuleGeometry(r, Math.max(.01, n - r), 4, 10), (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2); m.quaternion.setFromUnitVectors(up, d.normalize()); return m; };
  mk(new THREE.CylinderGeometry(.7, .76, .26, 8), 0, .13, 0, 1, 1, 1, GB);                         // 팔각 대좌
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, m = mk(new THREE.SphereGeometry(.17, 10, 8), Math.sin(a) * .56, .3, Math.cos(a) * .56, 1, .45, .62); m.rotation.y = a; } // 연꽃잎
  mk(new THREE.CylinderGeometry(.6, .64, .1, 24), 0, .31, 0, 1, 1, 1, GB);
  mk(new THREE.SphereGeometry(.4, 18, 12), 0, .5, -.02, 1.12, .52, 1.2);                            // 꿇어앉은 다리를 덮은 옷자락
  limb([.17, .44, -.05], [.18, .74, .2], .12); mk(new THREE.SphereGeometry(.13, 12, 10), .18, .76, .22); // 세운 왼 무릎
  limb([.18, .74, .22], [.2, .42, .34], .09);                                                        // 정강이
  const pr = [[.3, 0], [.31, .1], [.28, .3], [.24, .5], [.23, .62], [.26, .7], [.22, .78], [.08, .82], [.06, .9]].map(([r, y]) => new THREE.Vector2(r, y));
  mk(new THREE.LatheGeometry(pr, 18), 0, .58, -.04, 1.18, 1, .9);                                   // 옷을 입은 몸 (어깨까지 부드럽게)
  for (const sx of [-1, 1]) { limb([sx * .27, 1.28, -.03], [sx * .25, 1.02, .13], .075); limb([sx * .25, 1.02, .13], [sx * .08, 1.1, .3], .065); } // 앞으로 모은 두 팔
  mk(new THREE.CylinderGeometry(.07, .09, .17, 14), 0, 1.13, .34);                                    // 두 손에 든 공양구
  mk(new THREE.SphereGeometry(.075, 10, 8), 0, 1.24, .34);
  mk(new THREE.SphereGeometry(.165, 18, 14), 0, 1.6, 0, 1, 1.14, .98);                              // 통통한 얼굴
  for (const sx of [-1, 1]) mk(new THREE.BoxGeometry(.06, .3, .1), sx * .15, 1.46, -.05);           // 어깨로 내려온 머리칼
  mk(new THREE.CylinderGeometry(.165, .14, .44, 18), 0, 1.96, -.02);                                // 원통형 높은 보관
  mk(new THREE.CylinderGeometry(.18, .18, .045, 18), 0, 2.19, -.02, 1, 1, 1, GB);
  mk(new THREE.TorusGeometry(.15, .02, 6, 18), 0, 1.8, -.02, 1, 1, 1, GB, Math.PI / 2);            // 보관 테
  h.col(x, z, .66, .66);
}
// 탑 종류에 맞춰 세우기 → 탑돌이 중심 반환
export function buildPagoda(h, type, PZ) {
  const { col } = h;
  let r, x = 0;
  if (type === 'octa9') r = octa9(h, 0, PZ);
  else if (type === 'octa10') r = octa9(h, 0, PZ, 10);
  else if (type === 'wood5') r = wood5(h, 0, PZ);
  else if (type === 'stone5') r = stoneTiers(h, 0, PZ, 5, 1.05, true);
  else if (type === 'stone7') r = stoneTiers(h, 0, PZ, 7, 1.1);
  else if (type === 'lion') r = lion3(h, 0, PZ);
  else if (type === 'stone5p') r = stoneTiers(h, 0, PZ, 5, .82); // 화강암 상륜 오층석탑 (용주사 세존 사리탑, 높이 약 4m)
  else if (type === 'stone6') { stoneTiers(h, 0, PZ, 6, 1.12, false, { single: true, slim: .78, flat: true }); stoneRail(h, 0, PZ, 1.75); r = 1.85; } // 선운사 육층석탑: 단층기단 · 얇고 평평한 지붕돌 · 돌난간
  else if (type === 'twin3') { // 직지사 대웅전 앞 동·서 삼층석탑 (도천사터에서 옮겨 옴) · 둘레 돌난간
    x = -3.9; for (const sx of [-1, 1]) { stoneTiers(h, sx * 3.9, PZ, 3, .98, false, { slim: .9 }); stoneRail(h, sx * 3.9, PZ, 1.6); }
    r = 1.7;
  }
  else if (type === 'hex') r = hexSlate(h, 0, PZ);
  else if (type === 'octa9s') { r = octa9(h, 0, PZ); offeringBosal(h, 0, PZ + 2.25, Math.PI); r = 2.75; } // 월정사: 탑 남쪽에서 탑을 향해 공양하는 보살좌상
  else if (type === 'pair') { // 서쪽 석가탑 · 동쪽 다보탑 (법당을 바라볼 때 왼쪽·오른쪽)
    x = -3.5; r = stoneTiers(h, x, PZ, 3, 1.12);
    const r2 = dabotap(h, 3.5, PZ); col(3.5, PZ, r2, r2);
  } else r = stoneTiers(h, 0, PZ, 3);
  col(x, PZ, r, r);
  return { x, r };
}

// 장경판전 창 너머 판가: 여러 층 선반에 경판 마구리가 빽빽이 꽂힌 모습
let SHELF_ = null;
function shelfMat() {
  if (SHELF_) return SHELF_;
  const c = document.createElement('canvas'); c.width = 256; c.height = 192; const g = c.getContext('2d');
  g.fillStyle = '#1e150f'; g.fillRect(0, 0, 256, 192);
  let r = 11; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let row = 0; row < 4; row++) {
    const y0 = 8 + row * 46, bh = 34;
    for (let x = 2; x < 254;) { const bw = 5 + rnd() * 3, t = 70 + rnd() * 40 | 0; g.fillStyle = `rgb(${t + 18},${t - 8},${t - 30})`; g.fillRect(x, y0 + (rnd() * 4 | 0), bw - 1, bh - (rnd() * 4 | 0)); x += bw; }
    g.fillStyle = '#7a5434'; g.fillRect(0, y0 + bh, 256, 6); // 선반 널
  }
  for (const x of [0, 126, 250]) { g.fillStyle = '#5c3e26'; g.fillRect(x, 0, 6, 192); } // 판가 기둥
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  return SHELF_ = new THREE.MeshStandardMaterial({ map: tx, roughness: .95, emissive: '#2a1a10', emissiveIntensity: .25 });
}
/* ───────── 사찰 상징물 (법당 옆 6m 마당·뒤뜰에 배치) ───────── */
// side: 법당 옆 빈 마당 가운데 x
export function buildExtras(h, T) {
  const { box, add, col, L, D } = h, list = [...((T.style && T.style.extras) || [])], SX = L / 2 + 3.2;
  const out = {}, fig = h.fig || (h.fig = []); // fig: 나중에 3D 존상 모델로 바꿔 끼울 바깥 불상·보살상 자리
  if (T.style && T.style.bigStand) list.push('bigStand');
  for (const kind of list) {
    if (kind === 'oldTree') { // 수백 년 된 노거수 (조계사 회화나무, 봉은사) · 조계사는 백송이 오른쪽에 있어 회화나무를 왼쪽 앞에
      const x = ((T.style && T.style.oldTreeSide) || 1) * (SX - .2), z = D / 2 - 1.5;
      const tr = add(new THREE.CylinderGeometry(.32, .55, 3.6, 8), h.MAT.trunk, x, 1.8, z); tr.rotation.z = .08;
      for (const [dx, dy, dz, r] of [[0, 4.6, 0, 2.3], [-1.4, 4.0, .6, 1.6], [1.3, 4.2, -.5, 1.7], [.2, 5.6, -.2, 1.5]]) { const c = add(new THREE.IcosahedronGeometry(r, 1), h.MAT.leaf, x + dx, dy, z + dz); c.scale.y = .78; }
      col(x, z, .6, .6);
      box(1.9, .3, 1.9, h.MAT.stone, x, .15, z);
    }
    if (kind === 'bigBuddha') { // 신흥사 통일대불: 높은 연화대 위 청동 좌불 (불상은 모델을 불러온 뒤 올림)
      const x = -SX, z = -.6;
      add(new THREE.CylinderGeometry(1.75, 1.95, 1.1, 16), h.MAT.stone, x, .55, z);
      add(new THREE.CylinderGeometry(1.55, 1.65, .45, 16), R.bronze, x, 1.32, z);
      box(1.2, .22, .5, h.MAT.stone, x, .11, z + 2.1);
      col(x, z, 2.0, 2.2);
      out.bigBuddha = { lx: x, ly: 1.55, lz: z, h: 5.2 };
    }
    if (kind === 'bigStand') { // 바깥 큰 입불 (법주사 금동미륵대불·동화사 약사대불·봉은사 미륵대불): 기단 위에 선 부처님
      const b = T.style.bigStand, x = -SX, z = -.4, mat = b.tint === 'gold' ? R.gold : R.granite;
      add(new THREE.CylinderGeometry(2.0, 2.25, .9, 8), h.MAT.stone, x, .45, z);
      add(new THREE.CylinderGeometry(1.55, 1.75, .7, 8), R.granite2, x, 1.25, z);
      add(new THREE.CylinderGeometry(1.25, 1.0, .45, 16), mat, x, 1.82, z);
      box(1.4, .22, .6, h.MAT.stone, x, .11, z + 2.4);
      const ph = standingGwaneum(o => h.site.add(o), x, 2.05, z, b.h * .92, 0, mat);
      fig.push({ k: b.k, tint: b.tint, lx: x, ly: 2.05, lz: z, h: b.h, ry: 0, ph: [ph] });
      if (b.name) add(new THREE.PlaneGeometry(1.7, .42), new THREE.MeshStandardMaterial({ map: h.nameTex(b.name, '#2b1d14', '#f2cf72', 38), roughness: .6 }), x, .62, z + 2.27, false);
      col(x, z, 2.3, 2.3);
    }
    if (kind === 'buldu') { // 와우정사 입구 황금 불두: 돌로 쌓은 받침 위 8m 부처님 머리, 앞에 작은 연못
      const z = h.PZ, by = 1.5;
      add(new THREE.CylinderGeometry(2.2, 2.6, by, 12), R.granite2, 0, by / 2, z);
      for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, r = .35 + Math.random() * .2; add(new THREE.IcosahedronGeometry(r, 0), i % 2 ? R.rock : R.rock2, Math.cos(a) * 2.45, .25 + Math.random() * .9, z + Math.sin(a) * 2.45); }
      const ph = add(new THREE.SphereGeometry(2.3, 20, 14), R.gold, 0, by + 2.6, z); ph.scale.set(.85, 1.1, .9);
      fig.push({ k: 'buldu', lx: 0, ly: by, lz: z, h: 6.0, ry: 0, ph: [ph] });
      const pond = add(new THREE.CylinderGeometry(1.7, 1.7, .06, 24), R.sea || h.MAT.stone, 0, .05, z + 3.9, false); pond.receiveShadow = true;
      add(new THREE.TorusGeometry(1.75, .14, 6, 28), R.granite, 0, .08, z + 3.9).rotation.x = Math.PI / 2;
      col(0, z, 2.7, 2.7); col(0, z + 3.9, 1.9, 1.9);
      out.pagoda = { x: 0, z, r: 2.7 };
    }
    if (kind === 'wishStone') { // 용호사 소원돌: 일주문 지나 올라가 왼쪽편 · 소원 빌기 전 한 번, 빈 뒤 한 번 들어 보는 둥근 돌 (작은 맞배지붕 보호각 + 입간판)
      const x = -(h.YX - 2.4), z = h.YZ1 - 6.2, top = .26, sx0 = x + .2; // 받침 높이 = 아기 스님 허리 · 돌은 받침 앞쪽(스님 쪽) 가장자리에
      // 돌 받침: 화강암 두 단 + 붉은 천 (아기 스님 허리 높이 · 두 손으로 잡을 수 있게 앞쪽이 가까움)
      box(.7, .16, .62, R.granite2, x, .08, z); box(.6, .08, .54, R.granite, x, .2, z);
      box(.5, .02, .46, M('#a3322a'), x, top - .01, z);
      // 소원돌: 지름 26cm 남짓 둥근 화강암 (조금 납작하게)
      const stone = add(new THREE.IcosahedronGeometry(.15, 2), M('#b8b0a2', { roughness: .95 }), sx0, top + .123, z); stone.scale.set(1.05, .82, 1);
      // 작은 보호각: 기둥 네 개 + 맞배지붕
      // 보호각은 카메라를 가리는 것에서 뺌 (지붕 아래에서 돌을 들 때 카메라가 머리 앞으로 당겨지지 않게)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { add(new THREE.CylinderGeometry(.06, .07, 2.3, 8), R.wood, x + sx * .78, 1.15, z + sz * .64).userData.noOcc = true; col(x + sx * .78, z + sz * .64, .1, .1); }
      for (const sx of [-1, 1]) { const r = box(1.0, .06, 2.0, R.roofTile, x + sx * .45, 2.45, z); r.rotation.z = sx * -.42; r.userData.noOcc = true; }
      box(.12, .12, 2.0, R.wallCap || R.roofTile, x, 2.64, z).userData.noOcc = true;
      // 입간판 '소원돌' (안쪽 길에서 보이게 오른쪽을 향함)
      // 입간판 '소원돌': 보호각 앞(일주문 쪽) 담장 가에 · 일주문에서 들어오는 사람을 향함
      { const gx = x - .35, gz = z + 1.35; add(new THREE.PlaneGeometry(.9, .42), new THREE.MeshStandardMaterial({ map: h.nameTex('소원돌', '#3a2418', '#f2cf72', 44), roughness: .7 }), gx, 1.05, gz, false).rotation.y = .35;
        for (const d of [-.36, .36]) add(new THREE.CylinderGeometry(.03, .03, 1.0, 6), R.wood, gx + Math.cos(.35) * d, .5, gz - Math.sin(.35) * d); col(gx, gz, .45, .12); }
      col(x, z, .35, .31);
      // stand: 돌 앞(마당 쪽)에 서는 자리 · grip: 두 손으로 돌을 잡을 때 한 걸음 다가서는 자리
      out.wishStone = { lx: sx0, lz: z, top, stone, r: .15, stand: { lx: x + .95, lz: z }, grip: { lx: sx0 + .3, lz: z } };
    }
    if (kind === 'cairns') { // 통일의 돌탑: 세계 성지에서 가져온 돌을 쌓아 올린 작은 돌탑들
      for (const [x, z, n] of [[-4.6, D / 2 + 2.2, 7], [-5.8, D / 2 + 3.4, 5], [4.6, D / 2 + 2.4, 6], [5.9, D / 2 + 3.2, 8], [-6.2, D / 2 + 1.2, 4], [6.4, D / 2 + 1.4, 5]]) {
        let y = 0; for (let i = 0; i < n; i++) { const r = .34 - i * .028, m = add(new THREE.IcosahedronGeometry(r, 0), i % 2 ? R.rock : R.granite2, x + (Math.random() - .5) * .06, y + r * .45, z + (Math.random() - .5) * .06); m.scale.y = .55; m.rotation.y = Math.random() * 3; y += r * .78; }
        col(x, z, .35, .35);
      }
    }
    if (kind === 'mireuk') { // 금산사 미륵전: 3층 법당 · 앞문을 활짝 열어 안에 모신 미륵삼존(가운데 미륵불, 양옆 보살)이 보임
      // 실제처럼 앞마당 오른쪽에서 마당(왼쪽)을 바라보게: 서향(坐東向西)
      const right = T.style.mireukRight, ry = right ? -Math.PI / 2 : 0, gx = right ? L / 2 + 3.0 : -SX, gz = right ? D / 2 + 7.0 : -.5; // 송대 남쪽 계단 앞으로 지나다닐 틈을 둠
      const G = new THREE.Group(); G.position.set(gx, 0, gz); G.rotation.y = ry; h.site.add(G);
      const W = (lx, lz) => [gx + lx * Math.cos(ry) + lz * Math.sin(ry), gz - lx * Math.sin(ry) + lz * Math.cos(ry)]; // 미륵전 안 좌표 → 사찰 좌표
      const add = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; G.add(m); return m; };
      const box = (w, hh, d, mat, px, py, pz) => add(new THREE.BoxGeometry(w, hh, d), mat, px, py, pz);
      const x = 0, z = 0;
      box(5.2, .5, 4.8, h.MAT.stone, x, .25, z);
      let y = .5; const fl = [[4.6, 4.2, 3.0], [3.7, 3.3, 1.4], [2.9, 2.5, 1.3]];
      fl.forEach(([w, d, hh], i) => {
        if (i === 0) { // 1층: 뒤·옆 벽 + 앞은 가운데를 열고 양끝만 막음 · 안은 어둡게
          box(w, hh, .14, R.white, x, y + hh / 2, z - d / 2 + .07);
          for (const sx of [-1, 1]) { box(.14, hh, d, R.white, x + sx * (w / 2 - .07), y + hh / 2, z); box(w * .1, hh, .14, R.white, x + sx * (w / 2 - w * .05), y + hh / 2, z + d / 2 - .07); }
          box(w - .3, hh - .1, .04, M('#3a2a20', { roughness: 1 }), x, y + hh / 2, z - d / 2 + .16); // 어두운 안벽
          box(w - .3, .06, d - .3, R.wood, x, y + .03, z);                                   // 마루
          box(w * .8, .5, .1, R.lattice, x, y + hh - .25, z + d / 2 - .05);                   // 문 위 살창
          for (const sx of [-1, 1]) for (const k of [0, 1]) { const dr = box(.36, hh - .7, .05, R.lattice, x + sx * (w * .4 - .2 - k * .38), y + (hh - .7) / 2 + .05, z + d / 2 + .02); dr.rotation.y = sx * .9; } // 활짝 접어 연 문짝
          // 불단 + 미륵삼존 (불상 모델을 불러오면 바꿔 끼움)
          box(w * .8, .32, 1.1, R.redCol, x, y + .16, z - d / 2 + .9);
          for (const [dx, k, hh2] of [[0, 'buddhaS', 2.55], [-1.2, 'bosalS', 2.0], [1.2, 'bosalS', 2.0]]) {
            const py = y + .32, pz = z - d / 2 + .9;
            const ph = standingGwaneum(o => G.add(o), x + dx, py, pz, hh2 * .95, 0, R.gold);
            const [fx, fz] = W(x + dx, pz); fig.push({ k, tint: 'gold', lx: fx, ly: py, lz: fz, h: hh2, ry, ph: [ph], parent: G });
          }
        } else box(w, hh, d, R.white, x, y + hh / 2, z);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(.18, hh, .18, R.redCol, x + sx * w / 2, y + hh / 2, z + sz * d / 2);
        box(w + .05, .16, d + .05, R.band, x, y + hh - .08, z);
        if (i) box(w * .6, hh * .55, .05, R.lattice, x, y + hh * .42, z + d / 2 + .02);
        y += hh; const rw = w + 1.6, rd = d + 1.6, rh = rd * (i === 2 ? .36 : .2);
        const m = add(hipRoofGeo(THREE, rw, rd, rh, Math.max(.5, rw - rd * .95), .3), R.roofTile, x, y, z); m.receiveShadow = false;
        y += i === 2 ? rh : rh * .4;
      });
      const bd = add(new THREE.PlaneGeometry(1.3, .4), new THREE.MeshStandardMaterial({ map: h.nameTex('미륵전', '#2b1d14', '#f2cf72', 46), roughness: .6 }), x, .5 + 3.0 + (4.2 + 1.6) * .2 * .4 + 1.4 * .62, z + 3.3 / 2 + .06, false);
      if (right) col(gx, gz, 2.4, 2.6); else col(gx, gz, 2.6, 2.4);
      const [sx0, sz0] = W(0, 3.2); (out.spots || (out.spots = [])).push({ lx: sx0, lz: sz0, r: 3.2, name: '금산사 미륵전', story: '3층 법당 안에 서 계신 미륵삼존 · 문을 활짝 열어 두었어요' });
      out.mireuk = { x: gx, z: gz, ry, front: W(0, 3.4), sign: W(-2.6, 3.2) };
    }
    if (kind === 'cliff') { // 백양사 백학봉: 법당 뒤 숲 위로 우뚝 솟은 흰 바위 봉우리 (멀리 보이는 배경)
      const z0 = -D / 2 - 30;
      [[0, 26, 22, 12, 0], [-10, 17, 16, 10, 2], [10, 20, 15, 10, 1.5], [4, 31, 9, 7, -1], [-4, 23, 10, 8, -.5]].forEach(([dx, hh, w, d, dz]) => {
        const m = add(new THREE.DodecahedronGeometry(1, 1), GR().b, dx, hh * .45 - 2, z0 + dz); m.scale.set(w / 2, hh / 2, d / 2); m.castShadow = false; m.userData.far = true;
      });
    }
    if (kind === 'pond') { // 백양사 쌍계루: 연못가 2층 누각
      const x = SX, zP = 1.6;
      const w = add(new THREE.CircleGeometry(2.4, 28), R.water, x, .035, zP, false); w.rotation.x = -Math.PI / 2;
      for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; box(.5, .22, .3, h.MAT.stoneDark, x + Math.sin(a) * 2.5, .11, zP + Math.cos(a) * 2.5).rotation.y = a; }
      col(x, zP, 2.5, 2.5);
      const z = -2.6;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { box(.28, 1.5, .28, h.MAT.stone, x + sx * 1.35, .75, z + sz * .9); box(.2, 1.3, .2, R.redCol, x + sx * 1.35, 2.2, z + sz * .9); }
      box(3.2, .16, 2.3, R.wood, x, 1.58, z); box(3.1, .12, .08, R.lattice, x, 2.0, z + 1.05);
      box(3.0, .24, 2.1, R.band, x, 2.82, z);
      const m = add(hipRoofGeo(THREE, 4.6, 3.6, 1.25, 1.2, .28), R.roofTile, x, 2.94, z); m.receiveShadow = false;
      col(x, z, 1.6, 1.15);
      const bd = add(new THREE.PlaneGeometry(1.1, .34), new THREE.MeshStandardMaterial({ map: h.nameTex('쌍계루', '#2b1d14', '#f2cf72', 46), roughness: .6 }), x, 2.62, z + 1.18, false);
    }
    if (kind === 'bridge') { // 선암사 승선교(보물): 개울을 가로지르는 반원 무지개다리 — 아치 너머 위쪽으로 강선루가 보임
      const x = SX, zb = D / 2 + 3.2, sw = 1.6;
      const st = add(new THREE.PlaneGeometry(sw, D + 8), R.water, x, .035, .4, false); st.rotation.x = -Math.PI / 2;
      for (const sx of [-1, 1]) for (let z = -D / 2 - 3.4; z < D / 2 + 4.6; z += .9) if (Math.abs(z - zb) > 1.0) box(.35, .25, .6, h.MAT.stoneDark, x + sx * (sw / 2 + .15), .12, z);
      col(x, .4, sw / 2 + .1, D / 2 + 4);
      const r = .95, half = 1.75, sh = new THREE.Shape();             // 홍예: 반원 구멍 + 완만하게 휜 다리 윗면
      sh.moveTo(-half, 0); sh.lineTo(-half, .28); sh.quadraticCurveTo(0, 2.5, half, .28); sh.lineTo(half, 0); sh.lineTo(r, 0);
      sh.absarc(0, 0, r, 0, Math.PI, false); sh.lineTo(-half, 0);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 1.4, bevelEnabled: false, curveSegments: 20 }); geo.translate(0, 0, -.7);
      add(geo, R.granite, x, -.04, zb);
      for (const sz of [-1, 1]) add(new THREE.TorusGeometry(r + .09, .09, 4, 20, Math.PI), R.granite2, x, -.04, zb + sz * .71); // 홍예석 테두리
      const dh = add(new THREE.ConeGeometry(.09, .26, 6), R.granite2, x, r - .12, zb + .3); dh.rotation.x = Math.PI * .6;     // 아치 꼭대기에 매달린 용머리
      const zk = zb - 4.0, kw = 2.5, kd = 1.8;                         // 강선루: 개울 위로 다리를 뻗은 2층 누각
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { box(.22, 1.7, .22, h.MAT.stone, x + sx * kw / 2, .85, zk + sz * kd / 2); box(.17, 1.25, .17, R.redCol, x + sx * kw / 2, 2.32, zk + sz * kd / 2); }
      box(kw + .5, .14, kd + .5, R.wood, x, 1.72, zk);
      for (const sz of [-1, 1]) box(kw + .4, .28, .05, R.lattice, x, 1.94, zk + sz * (kd / 2 + .22));
      box(kw + .3, .22, kd + .3, R.band, x, 2.95, zk);
      const m = add(hipRoofGeo(THREE, kw + 1.9, kd + 1.7, 1.1, 1.0, .28), R.roofTile, x, 3.06, zk); m.receiveShadow = false;
      add(new THREE.PlaneGeometry(.95, .3), new THREE.MeshStandardMaterial({ map: h.nameTex('강선루', '#2b1d14', '#f2cf72', 46), roughness: .6 }), x, 2.72, zk + kd / 2 + .17, false);
      out.bridge = { zb, zk };
    }
    if (kind === 'gyedan') { // 통도사 금강계단: 대웅전 뒤 2단 돌 단과 종 모양 사리탑
      const x = 0, z = -D / 2 - 5.6;
      box(6.0, .55, 6.0, R.granite, x, .275, z); box(4.4, .5, 4.4, R.granite, x, .8, z);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(.3, .7, .3, h.MAT.stoneDark, x + sx * 2.8, .9, z + sz * 2.8);
      for (let i = 0; i < 3; i++) box(1.4, .18 * (3 - i), .4, R.granite2, x, .09 * (3 - i), z + 3.2 + i * .4);
      add(new THREE.CylinderGeometry(.8, .95, .32, 16), R.granite2, x, 1.21, z);
      const bell = add(new THREE.SphereGeometry(.75, 18, 14), R.granite, x, 2.05, z); bell.scale.y = 1.3;
      add(new THREE.CylinderGeometry(.08, .14, .55, 10), R.granite2, x, 3.15, z); add(new THREE.SphereGeometry(.16, 10, 8), R.granite2, x, 3.45, z);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; box(.12, .55, .12, h.MAT.stone, x + Math.sin(a) * 2.0, 1.3, z + Math.cos(a) * 2.0); }
      col(x, z, 3.1, 3.1);
      out.backYard = 9;
    }
    if (kind === 'bangdeung') { // 금산사 송대: 대적광전 오른쪽·미륵전 북쪽의 높은 터 위, 2단 네모 돌단 가운데 종 모양 사리탑(금강계단) + 그 남쪽 고려 오층석탑
      const x = L / 2 + 3.15, tz0 = -D / 2 - 1.0, tz1 = D / 2 + 1.7, TH = .9, zc = -D / 2 + 2.7, zt = D / 2 - 1.5;
      box(5.5, TH, tz1 - tz0, R.granite2, x, TH / 2, (tz0 + tz1) / 2);                           // 송대 (막돌 축대)
      for (let i = 0; i < 9; i++) for (const sz of [tz0, tz1]) box(.62, .26, .06, h.MAT.stoneDark, x - 2.5 + i * .62, .2 + (i % 2) * .3, sz + (sz > 0 ? .03 : -.03)); // 축대 돌 줄눈
      for (const [sz, dir] of [[tz1, 1], [tz0, -1]]) for (let i = 0; i < 3; i++) box(1.8, TH * (i + 1) / 4, .34, R.granite, x, TH * (i + 1) / 8, sz + dir * (.17 + (2 - i) * .34)); // 남·북 돌계단
      const up = { ...h, add: (geo, m, px, py, pz, sh) => add(geo, m, px, py + TH, pz, sh), box: (w, hh, d, m, px, py, pz) => add(new THREE.BoxGeometry(w, hh, d), m, px, py + TH, pz) };
      up.box(5.0, .42, 5.0, R.granite2, x, .21, zc); up.box(3.6, .4, 3.6, R.granite, x, .62, zc);
      for (let i = 0; i < 14; i++) { const t = (i + .5) / 14 * 3.6 - 1.8; for (const sz of [-1, 1]) up.box(.22, .22, .04, R.granite2, x + t, .6, zc + sz * 1.82); for (const sx of [-1, 1]) up.box(.04, .22, .22, R.granite2, x + sx * 1.82, .6, zc + t); } // 기단 벽 돋을새김
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { // 아래 단 돌난간 + 네 귀 사천왕 석상
        const cx = x + sx * 2.3, cz = zc + sz * 2.3;
        up.add(new THREE.CylinderGeometry(.2, .26, .9, 10), R.granite, cx, .87, cz);                         // 갑옷 입은 몸
        up.add(new THREE.SphereGeometry(.15, 10, 8), R.granite, cx, 1.42, cz); up.add(new THREE.CylinderGeometry(.1, .14, .16, 8), R.granite2, cx, 1.6, cz); // 머리 · 투구
        for (const s2 of [-1, 1]) { const a = up.add(new THREE.CylinderGeometry(.06, .07, .5, 6), R.granite, cx + s2 * .24, 1.05, cz); a.rotation.z = s2 * .4; }
        up.add(new THREE.CylinderGeometry(.24, .28, .1, 10), R.granite2, cx, .47, cz);
      }
      for (const sz of [-1, 1]) { up.box(4.3, .06, .07, R.granite2, x, .74, zc + sz * 2.3); up.box(.07, .06, 4.3, R.granite2, x + sz * 2.3, .74, zc); }
      for (let i = 0; i < 3; i++) up.box(1.2, .14 * (i + 1), .36, R.granite2, x, .07 * (i + 1), zc + 2.8 + (2 - i) * .34); // 계단 남쪽 오르는 돌계단
      up.add(new THREE.CylinderGeometry(.78, .9, .28, 16), R.granite2, x, .96, zc);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, pt = up.add(new THREE.SphereGeometry(.2, 8, 6), R.granite, x + Math.sin(a) * .7, 1.12, zc + Math.cos(a) * .7); pt.scale.set(1, .4, 1); } // 연꽃 받침
      const bell = up.add(new THREE.SphereGeometry(.6, 20, 14), R.granite, x, 1.78, zc); bell.scale.set(1, 1.38, 1); // 석종
      up.add(new THREE.CylinderGeometry(.12, .2, .32, 10), R.granite2, x, 2.7, zc); up.add(new THREE.SphereGeometry(.15, 10, 8), R.granite2, x, 2.95, zc);
      col(x, zc, 2.6, 2.6);
      stoneTiers(up, x, zt, 5, .95); col(x, zt, 1.3, 1.3);
      (out.spots || (out.spots = [])).push({ lx: x - .2, lz: zt + 2.4, r: 3.2, name: '금산사 금강계단 · 오층석탑', story: '대적광전 오른쪽 높은 터(송대)에 금강계단과 고려 오층석탑이 나란히 있어요' });
      out.bangdeung = { x, zc, zt, TH };
    }
    if (kind === 'hyodae') { // 화엄사 효대: 각황전 왼쪽 뒤 높은 터 — 국보 사사자 삼층석탑(가운데 합장한 스님상) + 탑을 향해 공양하는 인물상을 품은 석등
      const x = -(L / 2 + 3.1), zc = -D / 2 - 3.4, TH = 1.0;
      box(5.2, TH, 5.6, R.granite2, x, TH / 2, zc); box(5.4, .12, 5.8, R.granite, x, TH + .06, zc);
      for (let i = 0; i < 4; i++) box(1.6, TH * (i + 1) / 5, .32, R.granite, x, TH * (i + 1) / 10, zc + 2.8 + .16 + (3 - i) * .32); // 남쪽 돌계단
      const up = { ...h, add: (geo, m, px, py, pz, sh) => add(geo, m, px, py + TH + .12, pz, sh), box: (w, hh, d, m, px, py, pz) => add(new THREE.BoxGeometry(w, hh, d), m, px, py + TH + .12, pz), site: h.site };
      const tz = zc - .9; lion3(up, x, tz, { monk: true, s: 1.05 }); col(x, tz, 1.4, 1.4);
      const lz = tz + 2.5, Y = TH + .12; // 석등: 간주 자리에 무릎 꿇은 공양상
      add(new THREE.CylinderGeometry(.42, .48, .18, 8), R.granite2, x, Y + .09, lz);
      add(new THREE.CylinderGeometry(.08, .1, .34, 8), R.granite, x, Y + .36, lz); add(new THREE.SphereGeometry(.12, 10, 8), R.granite, x, Y + .6, lz); // 공양상 (탑을 바라봄)
      for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(.06, .06, .6, 6), R.granite2, x + sx * .32, Y + .48, lz);
      add(new THREE.CylinderGeometry(.42, .36, .14, 8), R.granite2, x, Y + .85, lz); box(.36, .42, .36, R.granite, x, Y + 1.13, lz); box(.24, .2, .4, h.MAT.fire, x, Y + 1.13, lz);
      add(new THREE.ConeGeometry(.46, .3, 8), R.granite2, x, Y + 1.49, lz); add(new THREE.SphereGeometry(.08, 8, 6), R.granite2, x, Y + 1.7, lz);
      col(x, lz, .5, .5);
      (out.spots || (out.spots = [])).push({ lx: x + 1.8, lz: lz + .6, r: 3.0, name: '화엄사 사사자 삼층석탑', story: '네 마리 돌사자가 받친 국보 석탑 · 가운데에 합장한 스님상이 서 있어요' });
      out.hyodae = { x, zc, lz };
      out.backYard = Math.max(out.backYard || 0, 6.5);
    }
    if (kind === 'magokDaeung') { // 마곡사 대웅보전: 대광보전 뒤 높은 터 위의 2층 법당 (아래층 정면 5칸, 위층 3칸, 팔작지붕)
      const z = -D / 2 - 10.0, TH = 3.0, w = 10.2, d = 6.6, h1 = 4.0, w2 = 7.0, d2 = 4.4, h2 = 3.0, NS = 10; // 계단 한 단 .28m·너비 .5m (눌러서 걷기 길찾기가 오를 수 있게) // 높은 축대 위라 앞마당에서도 대광보전 지붕 너머로 위층이 보임
      box(w + 3.4, TH, d + 4.6, R.granite2, 0, TH / 2, z); box(w + 3.6, .12, d + 4.8, R.granite, 0, TH + .06, z); // 법당 앞에 걸어 다닐 너른 터
      { const zf = z + (d + 4.6) / 2, sd = 1.7, sr = (TH + .12) / (NS + 1), sl = .5; // 축대 앞면을 따라 양쪽에서 올라가는 돌계단 + 가운데 참
        box(2.0, TH + .12, sd, R.granite2, 0, (TH + .12) / 2, zf + sd / 2);
        for (const sx of [-1, 1]) for (let i = 0; i < NS; i++) { const hh = sr * (i + 1); box(sl, hh, sd, R.granite, sx * (1.0 + (NS - 1 - i) * sl + sl / 2), hh / 2, zf + sd / 2); } }
      const y0 = TH + .12;
      box(w, h1, d, R.white, 0, y0 + h1 / 2, z);
      for (let i = 0; i <= 5; i++) for (const sz of [-1, 1]) box(.22, h1, .22, R.redCol, -w / 2 + w * i / 5, y0 + h1 / 2, z + sz * d / 2);
      for (let i = 0; i < 5; i++) box(w / 5 - .4, h1 - .6, .06, R.lattice, -w / 2 + w * (i + .5) / 5, y0 + (h1 - .6) / 2 + .1, z + d / 2 + .03); // 꽃살문
      box(w + .1, .3, d + .1, R.band, 0, y0 + h1 - .15, z);
      const r1 = add(hipRoofGeo(THREE, w + 2.2, d + 2.2, 1.2, w - d * .6, .3), R.roofTile, 0, y0 + h1, z); r1.receiveShadow = false;
      const y1 = y0 + h1 + .55;
      box(w2, h2, d2, R.white, 0, y1 + h2 / 2, z);
      for (let i = 0; i <= 3; i++) for (const sz of [-1, 1]) box(.2, h2, .2, R.redCol, -w2 / 2 + w2 * i / 3, y1 + h2 / 2, z + sz * d2 / 2);
      for (let i = 0; i < 3; i++) box(w2 / 3 - .5, h2 * .5, .06, R.lattice, -w2 / 2 + w2 * (i + .5) / 3, y1 + h2 * .45, z + d2 / 2 + .03);
      box(w2 + .1, .28, d2 + .1, R.band, 0, y1 + h2 - .14, z);
      const r2 = add(hipRoofGeo(THREE, w2 + 2.2, d2 + 2.2, (d2 + 2.2) * .46, Math.max(.6, w2 - d2 * .8), .32), R.roofTile, 0, y1 + h2, z); r2.receiveShadow = false;
      add(new THREE.PlaneGeometry(1.5, .45), new THREE.MeshStandardMaterial({ map: h.nameTex('대웅보전', '#2b1d14', '#f2cf72', 46), roughness: .6 }), 0, y1 + h2 * .78, z + d2 / 2 + .12, false);
      col(0, z, w / 2 + .3, d / 2 + .3);
      (out.spots || (out.spots = [])).push({ lx: 2.6, lz: z + (d + 4.6) / 2 + 2.4, r: 3.4, name: '마곡사 대웅보전', story: '대광보전 뒤 높은 터에 선 2층 법당이에요' });
      out.backYard = Math.max(out.backYard || 0, 16);
    }
    if (kind === 'janggyeong') { // 해인사 장경판전: 팔만대장경을 모신 긴 맞배 건물 두 채 (살창)
      for (const [z, name] of [[-D / 2 - 4.2, '수다라장'], [-D / 2 - 9.0, '법보전']]) {
        const w = Math.min(L + 2, 20), d = 3.0, hh = 2.6;
        box(w + .4, .35, d + .4, h.MAT.stone, 0, .175, z);
        box(w, hh, d, R.white, 0, .35 + hh / 2, z);
        for (let x = -w / 2; x <= w / 2 + .01; x += w / 8) for (const sz of [-1, 1]) box(.18, hh, .18, R.wood, x, .35 + hh / 2, z + sz * d / 2);
        // 살창: 앞은 아래 창이 크고 위 창이 작고, 뒤는 반대 (바람이 판전 안을 한 바퀴 돌게) · 창 너머로 경판을 꽂은 판가(서가)가 보임
        for (let i = 0; i < 8; i++) for (const sz of [-1, 1]) for (const [yy, big] of [[.7, sz > 0], [2.22, sz < 0]]) {
          const cx = -w / 2 + w * (i + .5) / 8, wh = big ? .78 : .42, ww = w / 8 * .78;
          const sh = add(new THREE.PlaneGeometry(ww, wh), shelfMat(), cx, .35 + yy, z + sz * (d / 2 + .012), false); if (sz < 0) sh.rotation.y = Math.PI;
          const nb = Math.floor(ww / .17 / 2); for (let k = -nb; k <= nb; k++) box(.05, wh, .05, R.lattice, cx + k * .17, .35 + yy, z + sz * (d / 2 + .03));
          box(ww + .08, .06, .07, R.wood, cx, .35 + yy + wh / 2 + .03, z + sz * (d / 2 + .03)); box(ww + .08, .06, .07, R.wood, cx, .35 + yy - wh / 2 - .03, z + sz * (d / 2 + .03));
        }
        const m = add(gableRoofGeo(THREE, w + 1.4, d + 2.2, 1.5, .12), R.roofTile, 0, .35 + hh + .05, z); m.receiveShadow = false;
        box(w + 1.5, .3, .35, h.MAT.stoneDark, 0, .35 + hh + 1.6, z);
        col(0, z, w / 2 + .2, d / 2 + .2);
        const bd = add(new THREE.PlaneGeometry(1.4, .42), new THREE.MeshStandardMaterial({ map: h.nameTex(name, '#2b1d14', '#f2cf72', 46), roughness: .6 }), 0, .35 + hh - .45, z + d / 2 + .1, false);
      }
      out.backYard = 12.5;
    }
    if (kind === 'seaBridge') { // 해동용궁사: 바다로 이어진 물길 위 흰 난간 무지개다리(세 칸)
      const x = SX, zb = -.6, x0 = L / 2 + 1.3, x1 = L / 2 + 5.1;
      const st = add(new THREE.PlaneGeometry(x1 - x0, D / 2 + 4 - (h.YZ0 - .2)), R.sea, (x0 + x1) / 2, .04, (D / 2 + 4 + h.YZ0 - .2) / 2, false); st.rotation.x = -Math.PI / 2;
      for (let z = h.YZ0; z < D / 2 + 4; z += 1.1) for (const xx of [x0 - .2, x1 + .2]) { const r = add(new THREE.IcosahedronGeometry(.45 + Math.random() * .35, 0), Math.random() < .5 ? R.rock : R.rock2, xx, .15, z); r.scale.y = .6; }
      col(x, (D / 2 + 4 + h.YZ0) / 2, (x1 - x0) / 2 + .2, (D / 2 + 4 - h.YZ0) / 2);
      for (const dz of [-1.1, 0, 1.1]) { const a = add(new THREE.TorusGeometry(.85, .16, 6, 16, Math.PI), R.granite, x, 0, zb + dz); a.rotation.y = Math.PI / 2; a.scale.set(1, 1.15, 1); }
      for (const dz of [-1.6, -.55, .55, 1.6]) box(.5, 1.0, .35, R.granite, x, .5, zb + dz);
      box(x1 - x0 + 1.2, .18, 1.5, R.granite, x, 1.06, zb); box(x1 - x0 + 1.2, .18, 1.5, R.granite, x, 1.06, zb + 1.5); box(x1 - x0 + 1.2, .18, 1.5, R.granite, x, 1.06, zb - 1.5);
      for (const sz of [-1, 1]) { box(x1 - x0 + 1.2, .08, .08, R.rail, x, 1.6, zb + sz * 2.2); for (let k = 0; k <= 6; k++) box(.1, .5, .1, R.rail, x - (x1 - x0 + 1.2) / 2 + k * (x1 - x0 + 1.2) / 6, 1.38, zb + sz * 2.2); }
    }
    if (kind === 'goldBudai') { // 황금 포대화상 (배가 둥근 웃는 스님, 자루를 곁에 둠)
      const x = -SX, z = D / 2 - .8, g = new THREE.Group(); g.position.set(x, 0, z); h.site.add(g);
      const mk = (geo, px, py, pz, sx = 1, sy = 1, sz = 1, mat = R.gold) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m; };
      mk(new THREE.CylinderGeometry(1.0, 1.1, .4, 16), 0, .2, 0, 1, 1, 1, h.MAT.stone);
      mk(new THREE.SphereGeometry(.7, 18, 12), 0, .62, .1, 1.25, .5, 1);           // 앉은 다리
      mk(new THREE.SphereGeometry(.66, 20, 14), 0, 1.15, .12, 1, .95, .95);         // 둥근 배
      mk(new THREE.SphereGeometry(.56, 18, 12), 0, 1.55, -.05, 1.05, .9, .9);       // 가슴·어깨
      mk(new THREE.SphereGeometry(.4, 18, 14), 0, 2.12, 0);                          // 머리
      for (const sx of [-1, 1]) { mk(new THREE.SphereGeometry(.1, 10, 8), sx * .38, 2.1, 0, .6, 1.4, .7); mk(new THREE.SphereGeometry(.22, 12, 10), sx * .62, 1.25, .25, 1, 1.6, 1); }
      mk(new THREE.SphereGeometry(.42, 14, 10), .95, .75, -.15, 1, .85, 1);          // 포대(자루)
      fig.push({ k: 'budai', tint: 'gold', lx: x, ly: .4, lz: z, h: 2.3, ry: 0, ph: g.children.slice(1) });
      col(x, z, 1.1, 1.1);
    }
    if (kind === 'whiteGwaneum') { // 바위 언덕 위 하얀 관세음보살 + 돌탑
      const x = -(L / 2) + 1.2, z = h.YZ0 + 3.2;
      for (const [dx, dy, dz, r] of [[0, .9, 0, 2.1], [-1.2, .5, .8, 1.3], [1.3, .6, .5, 1.4], [.3, .4, 1.4, 1.1], [-.6, 1.6, -.2, 1.4]]) { const m = add(new THREE.IcosahedronGeometry(r, 0), Math.random() < .5 ? R.rock : R.rock2, x + dx, dy, z + dz); m.scale.y = .75; m.rotation.y = Math.random() * 3; }
      add(new THREE.CylinderGeometry(1.0, 1.15, .35, 16), R.granite, x, 2.35, z);
      add(new THREE.CylinderGeometry(.75, .95, .3, 16), R.marble, x, 2.68, z);
      const ph = standingGwaneum(o => h.site.add(o), x, 2.83, z, 6.2, 0);
      fig.push({ k: 'bosalS', tint: 'marble', lx: x, ly: 2.83, lz: z, h: 6.6, ry: 0, ph: [ph] });
      col(x, z, 2.3, 2.0);
      if (!list.includes('flatRock')) for (const [dx, dz, hh] of [[3.2, -.6, 2.4], [4.4, .6, 1.8], [-2.9, 1.6, 2.0]]) { add(new THREE.ConeGeometry(.75 * hh / 2.2, hh, 9), R.rock2, x + dx, hh / 2, z + dz); add(new THREE.SphereGeometry(.16, 8, 6), R.rock, x + dx, hh + .1, z + dz); col(x + dx, z + dz, .6, .6); }
    }
    if (kind === 'flatRock') { // 휴휴암 연화대: 바닷가 너른 바위
      const z = h.YZ0 + 2.4;
      const fr = add(new THREE.CylinderGeometry(4.6, 5.0, .14, 11), R.rock, 1.5, .07, z, false); fr.scale.z = .55; fr.receiveShadow = true;
      for (let i = 0; i < 9; i++) { const r = add(new THREE.IcosahedronGeometry(.4 + Math.random() * .5, 0), R.rock2, 1.5 + (Math.random() - .5) * 8, .1, z + (Math.random() - .5) * 2.2, false); r.scale.y = .35; }
      const bd = add(new THREE.PlaneGeometry(1.1, .34), new THREE.MeshStandardMaterial({ map: h.nameTex('연화대', '#2b1d14', '#f2cf72', 46), roughness: .6 }), 5.6, .9, z + 1.6, false);
      add(new THREE.CylinderGeometry(.04, .05, .9, 6), h.MAT.trunk, 5.6, .45, z + 1.55);
    }
    if (kind === 'fish') { // 연화대 옆 황어 떼(수천 마리) · 물고기 밥 판매대 · 방생 수조 — 실제 휴휴암처럼
      const cx = h.fishX ?? 0, cz = h.fishZ ?? h.YZ0 - 6, at = h.fishAt || { lx: cx, lz: h.YZ0 - 1.4 };
      const school = createSchool(h.site, { cx, cz, rx: 5.8, rz: 3.0, n: 680, extra: 40, sea: { x: cx, z: h.YZ0 - 7.9, rx: 9.6, rz: 4.1 }, avoid: { x: -6.2, z: h.YZ0 - 1.2, rx: 4.6, rz: 3.2 } }); // 평소엔 연화대 앞에 모이고, 밥을 던지면 앞바다 어디든 따라감
      // 판매대: 물고기 밥(봉지) + 방생 물고기 수조 두 개
      const st = h.fishStall || { lx: cx - 3.4, lz: h.YZ0 + 2.6 }, g = new THREE.Group(); g.position.set(st.lx, 0, st.lz); g.rotation.y = st.ry || 0; h.site.add(g);
      const P = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
      const wood = M('#8a5d3b'), wood2 = M('#6d4528');
      P(new THREE.BoxGeometry(2.6, .9, .9), wood, 0, .45, 0);
      for (const sx of [-1, 1]) P(new THREE.CylinderGeometry(.05, .05, 2.3, 6), wood2, sx * 1.25, 1.15, -.42);
      const aw = P(new THREE.BoxGeometry(2.9, .06, 1.4), M('#c8402f'), 0, 2.28, .1); aw.rotation.x = .18;
      for (let i = 0; i < 6; i++) P(new THREE.BoxGeometry(.24, .065, 1.41), M('#f3eee4'), -1.2 + i * .48, 2.285, .1).rotation.x = .18;
      const glass = new THREE.MeshStandardMaterial({ color: '#6fb6c6', transparent: true, opacity: .32, roughness: .05, metalness: .1, depthWrite: false }), surf = new THREE.MeshStandardMaterial({ color: '#9fd8e2', transparent: true, opacity: .55, roughness: .1, depthWrite: false });
      const tanks = [];
      for (const [tx, kind] of [[-.65, 'ureok'], [.65, 'hwangeo']]) { const tk = P(new THREE.BoxGeometry(1.0, .5, .56), glass, tx, 1.24, -.08); tk.castShadow = false; const top = P(new THREE.PlaneGeometry(.96, .52), surf, tx, 1.44, -.08); top.rotation.x = -Math.PI / 2; top.castShadow = false; P(new THREE.BoxGeometry(1.06, .08, .62), wood2, tx, .95, -.08); const tg = new THREE.Group(); tg.position.set(tx, 0, -.08); g.add(tg); tanks.push(tankFish(tg, .45, .25, 1.1, kind === 'ureok' ? 4 : 9, kind)); }
      for (let i = 0; i < 6; i++) P(new THREE.BoxGeometry(.15, .15, .06), M(i % 2 ? '#e8c45a' : '#d9a441'), -1.0 + i * .4, .975, .38);  // 물고기 밥 봉지 (수조 앞 낮게)
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .5), new THREE.MeshStandardMaterial({ map: h.nameTex('방생 물고기 · 물고기 밥', '#2b1d14', '#f2cf72', 40, '', 660), roughness: .6 })); sign.position.set(0, 1.92, .47); sign.rotation.x = -.05; g.add(sign);
      const note = new THREE.Mesh(new THREE.PlaneGeometry(2.3, .32), new THREE.MeshStandardMaterial({ map: h.nameTex('작은 물고기 5마리 · 큰 물고기 2마리 · 물고기 밥', '#f6efe2', '#3a2a1c', 34, '', 990), roughness: .7 })); note.position.set(0, .68, .455); g.add(note);
      col(st.lx, st.lz, 1.4, .5);
      out.fish = { school, at, stall: st, feedTo: { lx: cx, lz: cz + 1.6 } };
      let loaded = false; // 황어 떼(720마리)는 가벼운 모델(무늬 색을 꼭짓점에 구운 418면), 우럭(8마리)은 Meshy 원본 · Meshy로 만든 황어·우럭 모델은 휴휴암에 처음 왔을 때 불러옴 (못 불러오면 직접 만든 모양 그대로) → 수조 물고기도 같은 모델로
      out.anim = dt => { if (!loaded) { loaded = true; for (const k of ['hwangeo', 'ureok']) school.loadModel(k, k === 'hwangeo' ? './assets/fish-hwangeo-lo.glb?v=1' : `./assets/fish-${k}.glb?v=1`).then(ok => { if (ok) for (const a of tanks) a.use(k, school.model(k)); }); } school.update(dt); for (const a of tanks) a(dt); };
    }
    if (kind === 'stoneBuddhas') { // 제주 관음사: 길 양옆에 줄지어 앉은 돌부처 (불상은 모델을 불러온 뒤 올림)
      out.mini = [];
      for (let z = D / 2 + 2.6; z < h.YZ1 - 2; z += 1.4) {
        if (Math.abs(z - h.SL) < 1.0 || Math.abs(z - h.PZ) < 3.4) continue;
        for (const sx of [-1, 1]) { box(.62, .32, .62, R.granite2, sx * 2.2, .16, z); col(sx * 2.2, z, .36, .36); out.mini.push({ lx: sx * 2.2, ly: .32, lz: z }); }
      }
    }
  }
  return out;
}

/* ───────── 권역 풍경 ───────── */
// 뒷산(멀리 둘러싼 낮은 다각형 산), 서울은 빌딩 숲, 제주는 한라산과 오름
export function buildBackdrop(scene, env, RB) {
  const g = new THREE.Group(); scene.add(g);
  const mt = env.mtn || { h: 50 };
  const mGreen = M('#6f8d5e'), mDark = M('#5d7a52'), mRock = M('#9a9a92'), mSnow = M('#f4f6f8');
  const n = 34;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + Math.random() * .12;
    const hh = mt.h * (.55 + Math.random() * .5), rad = Math.min(70, hh * (1.1 + Math.random() * .4)), r = RB + 45 + rad + Math.random() * 50; // 산자락이 사찰 마당·바다를 덮지 않게
    const c = new THREE.Mesh(new THREE.ConeGeometry(rad, hh, 7, 1), i % 2 ? mGreen : mDark); c.position.set(Math.sin(a) * r, hh / 2 - 2, Math.cos(a) * r); c.rotation.y = Math.random() * 3; g.add(c);
    if (mt.rock && hh > mt.h * .8) { const top = new THREE.Mesh(new THREE.ConeGeometry(rad * .28, hh * .26, 6), mt.snow ? mSnow : mRock); top.position.set(c.position.x, hh - 2 - hh * .13 + .5, c.position.z); top.rotation.y = c.rotation.y; g.add(top); }
  }
  if (mt.halla) { // 한라산: 남쪽으로 넓고 완만한 큰 산 + 작은 오름들
    const hm = new THREE.Mesh(new THREE.ConeGeometry(200, 95, 12, 1), M('#5f7f55')); hm.position.set(0, 45, RB + 260); g.add(hm);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(22, 55, 22, 12), M('#8c8f86')); cap.position.set(0, 86, RB + 260); g.add(cap);
    for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2, r = RB + 40 + Math.random() * 60, hh = 8 + Math.random() * 10; const o = new THREE.Mesh(new THREE.SphereGeometry(hh * 2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M('#7f9c62')); o.scale.y = .5; o.position.set(Math.sin(a) * r, -1, Math.cos(a) * r); g.add(o); }
  }
  if (env.city) { // 서울: 둘레 빌딩 숲
    const N = 90, im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M('#b8bfc8'), N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2 + Math.random() * .05, r = RB + 30 + Math.random() * 70, hh = 12 + Math.random() * 48, w = 8 + Math.random() * 10;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a); im.setMatrixAt(i, m4.compose(v.set(Math.sin(a) * r, hh / 2, Math.cos(a) * r), q, s.set(w, hh, w * .8)));
      im.setColorAt(i, col.set(['#b8bfc8', '#a7b2bd', '#c9ccd1', '#9fa9b3'][i % 4]));
    }
    g.add(im);
  }
  return g;
}

/* ───────── 나무 종류 ───────── */
// 한 그루를 여러 부품(줄기·잎 덩어리·꽃 점)으로 나눠 부품별로 InstancedMesh에 모음
export function treeKit() {
  const P = {
    trunk: [new THREE.CylinderGeometry(.18, .26, 1, 6), M('#7a5536')],
    pineTrunk: [new THREE.CylinderGeometry(.16, .24, 1, 6), M('#9a5a3a')],
    fir: [new THREE.ConeGeometry(1, 1, 7), M('#2f5e3a')],
    pine: [new THREE.IcosahedronGeometry(1, 0), M('#3f6b3c')],
    broad: [new THREE.IcosahedronGeometry(1, 1), M('#5f8f4a')],
    broad2: [new THREE.IcosahedronGeometry(1, 1), M('#4f8a4b')],
    maple: [new THREE.IcosahedronGeometry(1, 1), M('#c8452f')],
    maple2: [new THREE.IcosahedronGeometry(1, 1), M('#e0822f')],
    ginkgo: [new THREE.IcosahedronGeometry(1, 1), M('#e8c440')],
    bamboo: [new THREE.CylinderGeometry(.06, .07, 1, 5), M('#6f9a3c')],
    bambooLeaf: [new THREE.IcosahedronGeometry(1, 0), M('#7fb04a')],
    bush: [new THREE.IcosahedronGeometry(1, 1), M('#2e5a35')],
    red: [new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#d0213a', emissive: '#5a0010', emissiveIntensity: .4, flatShading: true })],
    orange: [new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#f39a1e', emissive: '#5a3000', emissiveIntensity: .4, flatShading: true })],
    tea: [new THREE.IcosahedronGeometry(1, 1), M('#4f8a3c')],
  };
  const lists = {}; for (const k in P) lists[k] = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const put = (k, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => { q.setFromEuler(e.set(rx, ry, rz)); lists[k].push(m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz)).clone()); };
  const rnd = Math.random;
  const species = {
    fir(x, z, s) { const h = 8 * s; put('trunk', x, h * .2, z, s, h * .4, s); put('fir', x, h * .45, z, 1.7 * s, h * .45, 1.7 * s, rnd() * 6); put('fir', x, h * .7, z, 1.25 * s, h * .4, 1.25 * s, rnd() * 6); put('fir', x, h * .92, z, .8 * s, h * .32, .8 * s, rnd() * 6); },
    pine(x, z, s) { const h = 6 * s, t = (rnd() - .5) * .25; put('pineTrunk', x, h * .35, z, s, h * .7, s, 0, 0, t); const tx = x - Math.sin(t) * h * .55; put('pine', tx, h * .78, z, 2.1 * s, .7 * s, 1.9 * s, rnd() * 6); put('pine', tx + .9 * s, h * .66, z + .4 * s, 1.3 * s, .5 * s, 1.2 * s, rnd() * 6); put('pine', tx - .8 * s, h * .92, z - .3 * s, 1.2 * s, .45 * s, 1.1 * s, rnd() * 6); },
    broad(x, z, s) { const h = 5.5 * s; put('trunk', x, h * .25, z, s, h * .5, s); put(rnd() < .5 ? 'broad' : 'broad2', x, h * .68, z, 2.3 * s, 2 * s, 2.3 * s, rnd() * 6); },
    maple(x, z, s) { const h = 5 * s; put('trunk', x, h * .25, z, .85 * s, h * .5, .85 * s); put(rnd() < .55 ? 'maple' : 'maple2', x, h * .68, z, 2.1 * s, 1.7 * s, 2.1 * s, rnd() * 6); },
    ginkgo(x, z, s) { const h = 7 * s; put('trunk', x, h * .3, z, .9 * s, h * .6, .9 * s); put('ginkgo', x, h * .62, z, 1.7 * s, 2.6 * s, 1.7 * s, rnd() * 6); },
    bamboo(x, z, s) { for (let i = 0; i < 7; i++) { const bx = x + (rnd() - .5) * 1.6, bz = z + (rnd() - .5) * 1.6, h = 6.5 * s * (.8 + rnd() * .4); put('bamboo', bx, h / 2, bz, s, h, s, 0, (rnd() - .5) * .08, (rnd() - .5) * .08); put('bambooLeaf', bx, h * .92, bz, .9 * s, .5 * s, .9 * s, rnd() * 6); } },
    camellia(x, z, s) { put('bush', x, 1.5 * s, z, 1.6 * s, 1.7 * s, 1.6 * s, rnd() * 6); put('trunk', x, .3 * s, z, .7 * s, .6 * s, .7 * s); for (let i = 0; i < 7; i++) { const a = rnd() * 6.3, b = rnd() * 1.2; put('red', x + Math.cos(a) * 1.5 * s * Math.cos(b - .3), 1.5 * s + Math.sin(b - .3) * 1.5 * s, z + Math.sin(a) * 1.5 * s * Math.cos(b - .3), .13, .13, .13); } },
    tangerine(x, z, s) { put('trunk', x, .35 * s, z, .7 * s, .7 * s, .7 * s); put('bush', x, 1.4 * s, z, 1.4 * s, 1.2 * s, 1.4 * s, rnd() * 6); for (let i = 0; i < 9; i++) { const a = rnd() * 6.3, b = rnd() * 1.1; put('orange', x + Math.cos(a) * 1.35 * s * Math.cos(b - .3), 1.4 * s + Math.sin(b - .3) * 1.15 * s, z + Math.sin(a) * 1.35 * s * Math.cos(b - .3), .14, .14, .14); } },
    tea(x, z, s) { for (let i = -1; i <= 1; i++) put('tea', x + i * 1.1, .45, z, .75, .5, .75, rnd() * 6); },
  };
  return {
    species,
    pick(weights) { let t = rnd() * Object.values(weights).reduce((a, b) => a + b, 0); for (const [k, w] of Object.entries(weights)) { t -= w; if (t <= 0) return k; } return Object.keys(weights)[0]; },
    // 줄기·대나무·덤불 자리 (부딪히는 기둥으로 씀): [x, z, 반지름, 높이]
    trunks() { const out = [], v = new THREE.Vector3(), q2 = new THREE.Quaternion(), sc = new THREE.Vector3();
      for (const k of ['trunk', 'pineTrunk', 'bamboo', 'bush', 'tea']) for (const m of lists[k]) { m.decompose(v, q2, sc); const r = k === 'bush' ? sc.x * .8 : k === 'tea' ? sc.x * .9 : .22 * sc.x; out.push([v.x, v.z, r, k === 'tea' ? .7 : 3]); }
      return out; },
    commit(scene) {
      for (const k in P) { const arr = lists[k]; if (!arr.length) continue; const im = new THREE.InstancedMesh(P[k][0], P[k][1], arr.length); arr.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = !['red', 'orange', 'bambooLeaf'].includes(k); scene.add(im); }
    },
  };
}

/* ───────── 바다 사찰: 법당 뒤로 펼쳐진 바다와 바위 해안 ───────── */
export function buildSea(h, { gap = null, side = 0, clear = null } = {}) {
  const { add, YX, YZ0 } = h, W = 2 * (YX + 22), Dp = 70;
  const sea = add(new THREE.PlaneGeometry(W, Dp), R.sea, 0, .045, YZ0 - .8 - Dp / 2, false); sea.rotation.x = -Math.PI / 2; sea.receiveShadow = false;
  const sh = add(new THREE.PlaneGeometry(W, 3.2), R.shallow, 0, .05, YZ0 - 2.2, false); sh.rotation.x = -Math.PI / 2; sh.receiveShadow = false;
  for (let i = 0; i < 46; i++) {
    const x = (Math.random() - .5) * (W - 6), z = YZ0 - .9 - Math.pow(Math.random(), 2.2) * 9 - (Math.random() < .15 ? Math.random() * 20 : 0), r = .5 + Math.random() * 1.6;
    if (gap && x > gap[0] - 1.2 && x < gap[1] + 1.2 && z > YZ0 - gap[2] - 1.5) continue; // 바위 끝으로 나가는 길은 비움
    if (clear && ((x - clear.x) / (clear.rx + r)) ** 2 + ((z - (YZ0 + clear.z)) / (clear.rz + r)) ** 2 < 1) continue; // 황어 떼가 노는 물은 비움
    const m = add(new THREE.IcosahedronGeometry(r, 0), Math.random() < .5 ? R.rock : R.rock2, x, r * .2, z); m.scale.y = .55 + Math.random() * .3; m.rotation.y = Math.random() * 3;
  }
  // 흰 돌난간 (뒤 담장 대신)
  // gap: 난간을 비워 둔 구간 [x0, x1] (휴휴암 연화대처럼 바위로 내려가는 곳) — 그 구간은 바위 바깥 끝에서 막음
  const segs = gap ? [[-YX, gap[0]], [gap[1], YX]] : [[-YX, YX]];
  for (const [x0, x1] of segs) {
    if (x1 - x0 < .5) continue; const cx = (x0 + x1) / 2;
    add(new THREE.BoxGeometry(x1 - x0, .1, .14), R.rail, cx, .95, YZ0);
    add(new THREE.BoxGeometry(x1 - x0, .08, .12), R.rail, cx, .45, YZ0);
    for (let x = x0; x <= x1 + .01; x += 1.2) add(new THREE.BoxGeometry(.16, 1.05, .16), R.rail, x, .52, YZ0);
    h.col(cx, YZ0, (x1 - x0) / 2 + .2, .25);
  }
  if (gap) h.col((gap[0] + gap[1]) / 2, YZ0 - gap[2], (gap[1] - gap[0]) / 2, .3);
  // side < 0: 왼쪽(바다를 볼 때 왼쪽)에 모래 해변 작은 만
  if (side < 0) {
    const sand = add(new THREE.PlaneGeometry(16, 22), M('#e7dcc0'), -YX - 8, .03, YZ0 + 4, false); sand.rotation.x = -Math.PI / 2;
    const cove = add(new THREE.PlaneGeometry(14, 30), R.sea, -YX - 16, .045, YZ0 + 2, false); cove.rotation.x = -Math.PI / 2;
  }
  return { x: YX + 22, z0: YZ0 - Dp, z1: YZ0, cove: side < 0 ? { x0: -YX - 24, x1: -YX + .5, z0: YZ0 - 14, z1: YZ0 + 16 } : null };
}

/* ───────── 휴휴암: 지도·위성 사진의 배치대로 (일주문 → 묘적전 마당 → 오른쪽 다라니 굴법당 → 바다 쪽 관음범종 → 그 오른쪽 지혜관세음보살 광장 → 아래 연화대) ───────── */
// 법당 기준 좌표: 앞(+z) = 일주문·순례 마당 쪽(내륙), 뒤(-z) = 동해. 바다를 바라볼 때 오른쪽 = +x
export function buildHyuhyu(h, T) {
  const { add, box, col, L, D, YX, YZ0, MAT } = h, out = {};
  // 일주문 앞 돌 멧돼지 한 쌍
  const boar = (x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; h.site.add(g);
    const mk = (geo, px, py, pz, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, R.rock); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m; };
    box(1.1, .3, .7, R.granite2, x, .15, z);
    mk(new THREE.SphereGeometry(.42, 10, 8), 0, .62, 0, 1.4, .85, .9);
    mk(new THREE.SphereGeometry(.26, 10, 8), .55, .7, 0, 1.1, .9, .9);
    mk(new THREE.CylinderGeometry(.09, .11, .16, 8), .82, .66, 0).rotation.z = Math.PI / 2;
    for (const [lx, lz] of [[-.3, -.18], [-.3, .18], [.3, -.18], [.3, .18]]) mk(new THREE.CylinderGeometry(.07, .06, .3, 6), lx, .38, lz);
    for (const sz of [-1, 1]) mk(new THREE.ConeGeometry(.06, .16, 6), .52, .98, sz * .14);
    col(x, z, .6, .4);
  };
  boar(-2.4, h.YZ1 + .9, -Math.PI / 2); boar(2.4, h.YZ1 + .9, -Math.PI / 2);
  // 다라니 굴법당: 법당 오른쪽의 바위 동굴 법당
  { const x = L / 2 + 3.6, z = -.5;
    for (const [dx, dy, dz, r] of [[0, .9, 0, 2.3], [-1.4, .6, -.6, 1.5], [1.3, .7, -.4, 1.6], [.2, 1.9, -.4, 1.5]]) { const m = add(new THREE.IcosahedronGeometry(r, 0), dx ? R.rock2 : R.rock, x + dx, dy, z + dz); m.scale.set(1, .8, .9); }
    const door = add(new THREE.CircleGeometry(.75, 16, 0, Math.PI), M('#1b1612'), x, .02, z + 2.05, false); door.scale.y = 1.6;
    box(1.7, .12, .4, R.granite, x, .06, z + 2.25);
    add(new THREE.PlaneGeometry(1.5, .4), new THREE.MeshStandardMaterial({ map: h.nameTex('다라니굴법당', '#2b1d14', '#f2cf72', 40), roughness: .6 }), x, 1.55, z + 2.12, false);
    col(x, z, 2.2, 2.0);
  }
  // 바다 쪽 아랫마당: 돌 깔린 길
  const ter = add(new THREE.PlaneGeometry(2 * YX - 2, -D / 2 - YZ0 - 1), M('#d8cfbd'), 0, .025, (YZ0 - D / 2) / 2, false); ter.rotation.x = -Math.PI / 2;
  // 관음범종: 아랫마당에서 바다를 보면 바로 앞
  { const x = -2.8, z = -D / 2 - 6.5;
    box(3.6, .3, 3.6, R.granite, x, .15, z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.CylinderGeometry(.12, .14, 2.8, 8), R.redCol, x + sx * 1.45, 1.7, z + sz * 1.45);
    box(3.3, .2, 3.3, R.band, x, 3.15, z);
    const m = add(hipRoofGeo(THREE, 4.8, 4.8, 1.5, .5, .3), R.roofTile, x, 3.25, z); m.receiveShadow = false;
    const bell = add(new THREE.LatheGeometry([[0, 0], [.52, 0], [.5, .12], [.42, .5], [.37, .85], [.3, 1.0], [0, 1.02]].map(([r, y]) => new THREE.Vector2(r, y)), 24), R.gold, x, 1.25, z);
    add(new THREE.PlaneGeometry(1.2, .36), new THREE.MeshStandardMaterial({ map: h.nameTex('관음범종', '#2b1d14', '#f2cf72', 44), roughness: .6 }), x, 2.92, z + 1.67, false);
    col(x, z, 1.9, 1.9);
  }
  // 지혜관세음보살 광장: 범종 오른쪽, 바다를 등지고 선 큰 관음상 + 남순동자 + 동해용왕
  { const x = 5.6, z = -D / 2 - 9.6;
    const pl = add(new THREE.CylinderGeometry(4.6, 4.8, .45, 28), R.granite, x, .225, z); pl.receiveShadow = true;
    for (let i = 0; i <= 16; i++) { const a = Math.PI * .1 + i / 16 * Math.PI * .8; box(.14, .7, .14, R.rail, x + Math.cos(a) * 4.5, .8, z - Math.sin(a) * 4.5); }
    add(new THREE.CylinderGeometry(1.25, 1.45, .7, 18), R.granite2, x, .8, z - 1.2);
    add(new THREE.CylinderGeometry(1.0, 1.1, .3, 18), R.marble, x, 1.3, z - 1.2);
    const fig = h.fig || (h.fig = []);
    fig.push({ k: 'bosalS', tint: 'marble', lx: x, ly: 1.45, lz: z - 1.2, h: 8.2, ry: 0, ph: [standingGwaneum(o => h.site.add(o), x, 1.45, z - 1.2, 7.8, 0)] });
    fig.push({ k: 'dongja', lx: x - 2.7, ly: .45, lz: z + .4, h: 1.5, ry: .25, ph: [standingGwaneum(o => h.site.add(o), x - 2.7, .45, z + .4, 1.5, .25)] }); // 남순동자 (합장한 동자)
    fig.push({ k: 'yongwang', lx: x + 2.8, ly: .45, lz: z + .3, h: 2.6, ry: -.25, ph: [standingGwaneum(o => h.site.add(o), x + 2.8, .45, z + .3, 2.5, -.25, R.gold)] }); // 동해용왕 (진주를 든 용왕)
    add(new THREE.PlaneGeometry(1.8, .44), new THREE.MeshStandardMaterial({ map: h.nameTex('지혜관세음보살', '#2b1d14', '#f2cf72', 38), roughness: .6 }), x, .72, z + 4.62, false);
    col(x, z - 1.2, 1.5, 1.5); col(x - 2.7, z + .4, .4, .4); col(x + 2.8, z + .3, .5, .5);
  }
  // 연화대: 난간이 끊긴 곳에서 바다로 펼쳐진 너른 바위 (황어 떼가 모이는 곳)
  { const x = -6.2, z = YZ0 - 1.2;
    const fr = add(new THREE.CylinderGeometry(4.2, 4.6, .16, 13), R.rock, x, .08, z, false); fr.scale.z = .7; fr.receiveShadow = true;
    for (let i = 0; i < 7; i++) { const r = add(new THREE.IcosahedronGeometry(.5 + Math.random() * .4, 0), R.rock2, x + (Math.random() - .5) * 7, .05, z - 1.5 - Math.random() * 1.6, false); r.scale.y = .3; }
    add(new THREE.PlaneGeometry(1.1, .34), new THREE.MeshStandardMaterial({ map: h.nameTex('연화대', '#2b1d14', '#f2cf72', 46), roughness: .6 }), x + 3.6, .95, YZ0 + .4, false);
    add(new THREE.CylinderGeometry(.04, .05, .95, 6), MAT.trunk, x + 3.6, .47, YZ0 + .35);
    out.flat = { x0: x - 4, x1: x + 4, depth: 2.6, lx: x, lz: z };
  }
  // 바다의 바위: 누운 관세음보살 바위, 거북 바위
  { const x = -9, z = YZ0 - 12.6; // 황어 떼 너머
    for (let i = 0; i < 6; i++) { const r = add(new THREE.IcosahedronGeometry(1.1 - i * .08, 0), R.rock, x + i * 1.6, .25, z - Math.sin(i * .6) * .3); r.scale.set(1.3, .5, .8); }
    const head = add(new THREE.SphereGeometry(.85, 10, 8), R.rock, x - 1.4, .55, z); head.scale.set(1, .8, .9);
    const t = add(new THREE.SphereGeometry(1.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), R.rock2, x - 6, 0, z + 3.5); t.scale.y = .55;
    const th = add(new THREE.SphereGeometry(.55, 10, 8), R.rock2, x - 4.2, .35, z + 3.3); th.scale.set(1.2, .7, .9);
  }
  return out;
}

/* ───────── 해동용궁사: 지도·위성 사진과 참배 안내의 순서대로 ─────────
   일주문 쪽 언덕(십이지신상 · 교통안전기원탑 · 갓바위 약사여래 · 득남불) → 108 장수계단을 내려가 → 바닷물이 드나드는 물길 위 용문석교
   → 연등이 가득한 마당과 사사자 석탑 → 대웅보전 · 옆 굴법당 · 오른쪽 계단 위 해수관음대불 → 바다 쪽 일출암 지장보살
   법당 기준 좌표: 앞(+z) = 일주문(순례 마당 쪽), 뒤(-z) = 동해. 바다를 볼 때 왼쪽(-x) = 북쪽 물길(용문석교 아래로 이어짐) */
export function yonggungFrame(h) {
  const { L, D, YX, YZ1 } = h, TY = 1.6;
  const ZC0 = D / 2 + 8.6, ZC1 = D / 2 + 10.4, ZB = ZC1 + .3, ZS1 = D / 2 + 14, ZT1 = YZ1 - 2;
  const HXc = L / 2 + 2.45, HZc = -1.4, HR = 1.95, HY = 2.4, HS1 = HZc + HR + 2.6; // 해수관음 언덕 (오른쪽 담과 사이로 일출암 가는 길이 지나감)
  // 걸어 다니는 높이 (언덕·계단·다리)
  const ground = (lx, lz) => {
    if (lz > YZ1 + .05) return 0;
    if (lz >= ZT1) return Math.abs(lx) < 1.45 ? TY * (YZ1 - lz) / (YZ1 - ZT1) : TY;            // 일주문 계단(오름)
    if (lz >= ZB) return Math.abs(lx) < 1.45 && lz < ZS1 ? TY * (lz - ZB) / (ZS1 - ZB) : TY;   // 108 계단(내림) · 언덕 마당
    if (lz > ZC0 - .4 && Math.abs(lx) < 1.5) return .42 * Math.sin(Math.PI * (lz - (ZC0 - .4)) / (ZB - ZC0 + .4)); // 용문석교 무지개 다리
    const dx = lx - HXc, dz = lz - HZc;
    if (dx * dx + dz * dz < HR * HR) return HY;
    if (Math.abs(dx) < .6 && lz >= HZc + HR - .2 && lz < HS1) return HY * (HS1 - lz) / (HS1 - (HZc + HR - .2));
    return 0;
  };
  return { TY, ZC0, ZC1, ZB, ZS1, ZT1, HXc, HZc, HR, HY, HS1, ground, PZ: D / 2 + 4.3, gap: [YX - 4.8, YX - 1.4, 5.6] };
}
// 십이지신상 하나: 받침돌(띠 이름 새김) + 도포 입고 두 손으로 무기를 든 몸 + 띠 동물 머리 (화강암)
const ZODIAC = [['子', '쥐'], ['丑', '소'], ['寅', '호랑이'], ['卯', '토끼'], ['辰', '용'], ['巳', '뱀'], ['午', '말'], ['未', '양'], ['申', '원숭이'], ['酉', '닭'], ['戌', '개'], ['亥', '돼지']];
/* 석상 몸은 Gemini로 그린 실제 화강암 석상 그림(assets/zodiac-atlas.webp)으로 만듦:
   위 두 줄 = 열두 석상 앞모습(256x640 칸), 맨 아래 줄 = 같은 실루엣의 흐린 뒷모습(128x320 칸).
   그림의 실루엣(투명도)을 따라 앞뒤로 둥글게 부풀린 입체라서 돌아가며 봐도 두께가 있음 */
const ZA = { cw: 256, ch: 640, bw: 128, bh: 320, W: 1536, H: 1600, gx: 32, gy: 80, w: .5, h: 1.24, zf: .17, zb: .15 };
let ZA_P = null;
function zodiacAtlas() {
  return ZA_P || (ZA_P = new Promise((ok, no) => {
    new THREE.TextureLoader().load('./assets/zodiac-atlas.webp?v=1', tex => {
      try {
        tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
        const cv = document.createElement('canvas'); cv.width = ZA.W; cv.height = ZA.ch * 2;
        const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(tex.image, 0, 0);
        const px = cx.getImageData(0, 0, ZA.W, ZA.ch * 2).data, geos = [];
        const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: .5, side: THREE.DoubleSide, roughness: .92, color: '#ffffff', emissive: '#69655c', emissiveMap: tex });
        ok({ mat, geo: i => geos[i] || (geos[i] = zodiacGeo(i, px)) });
      } catch (e) { no(e); }
    }, undefined, no);
  }));
}
function zodiacGeo(i, px) {
  const { gx, gy, cw, ch } = ZA, nx = gx + 1, ny = gy + 1, N = nx * ny, x0 = (i % 6) * cw, y0 = Math.floor(i / 6) * ch;
  const al = (fx, fy) => { const X = Math.round(fx), Y = Math.round(fy); return (X < 0 || Y < 0 || X >= cw || Y >= ch) ? 0 : px[((y0 + Y) * ZA.W + x0 + X) * 4 + 3]; };
  const sx = (cw - 1) / gx, sy = (ch - 1) / gy, ins = new Uint8Array(N), D = new Float32Array(N), VX = new Float32Array(N), VY = new Float32Array(N);
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
    const k = r * nx + c, X = c * sx, Y = r * sy; VX[k] = X; VY[k] = Y;
    let s = 0, n = 0; for (let dy = -2; dy <= 2; dy += 2) for (let dx = -2; dx <= 2; dx += 2) { s += al(X + dx, Y + dy); n++; }
    ins[k] = s / n > 127 ? 1 : 0;
  }
  // 바깥까지의 거리 (모따기 거리 두 번 훑기) → 가장자리는 둥글게 깎고 가운데일수록 두껍게
  for (let k = 0; k < N; k++) D[k] = ins[k] ? 1e6 : 0;
  const at = (r, c) => (r < 0 || c < 0 || r >= ny || c >= nx) ? 0 : D[r * nx + c];
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) { const k = r * nx + c; if (!ins[k]) continue; D[k] = Math.min(D[k], at(r - 1, c) + 1, at(r, c - 1) + 1, at(r - 1, c - 1) + 1.414, at(r - 1, c + 1) + 1.414); }
  for (let r = ny - 1; r >= 0; r--) for (let c = nx - 1; c >= 0; c--) { const k = r * nx + c; if (!ins[k]) continue; D[k] = Math.min(D[k], at(r + 1, c) + 1, at(r, c + 1) + 1, at(r + 1, c + 1) + 1.414, at(r + 1, c - 1) + 1.414); }
  let Dm = 1; for (let k = 0; k < N; k++) Dm = Math.max(Dm, D[k]);
  let T = new Float32Array(N);
  for (let k = 0; k < N; k++) if (ins[k]) { const dd = D[k] - .5, q = Math.min(1, dd / 3); T[k] = .42 * Math.sqrt(q * (2 - q)) + .58 * Math.sqrt(dd / Dm); }
  for (let it = 0; it < 2; it++) { const U = T.slice(); for (let r = 1; r < gy; r++) for (let c = 1; c < gx; c++) { const k = r * nx + c; if (ins[k]) U[k] = (2 * T[k] + T[k - 1] + T[k + 1] + T[k - nx] + T[k + nx]) / 6; } T = U; }
  // 실루엣 한 칸 바깥 점까지 그물을 두고, 그 점들은 그림의 윤곽선 위로 옮겨 앞뒤 면이 윤곽에서 딱 만나게 함
  const keep = new Uint8Array(N);
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) if (ins[r * nx + c]) for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && rr < ny && cc < nx) keep[rr * nx + cc] = 1; }
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
    const k = r * nx + c; if (!keep[k] || ins[k]) continue;
    let ux = 0, uy = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if ((dr || dc) && rr >= 0 && cc >= 0 && rr < ny && cc < nx && ins[rr * nx + cc]) { const l = Math.hypot(dc, dr); ux += dc / l; uy += dr / l; } }
    const l = Math.hypot(ux, uy); if (l < 1e-6) continue; ux /= l; uy /= l;
    for (let s = 0; s <= 1.5 * sx; s += .5) if (al(VX[k] + ux * s, VY[k] + uy * s) > 127) { VX[k] += ux * s; VY[k] += uy * s; break; }
  }
  const pos = [], uv = [], idx = [], fi = new Int32Array(N).fill(-1), bi = new Int32Array(N).fill(-1);
  for (let k = 0; k < N; k++) {
    if (!keep[k]) continue;
    const x = (VX[k] / (cw - 1) - .5) * ZA.w, y = (1 - VY[k] / (ch - 1)) * ZA.h, t = ins[k] ? T[k] : 0;
    fi[k] = pos.length / 3; pos.push(x, y, ZA.zf * t); uv.push((x0 + VX[k] + .5) / ZA.W, 1 - (y0 + VY[k] + .5) / ZA.H);
    bi[k] = pos.length / 3; pos.push(x, y, -ZA.zb * t); uv.push((i * ZA.bw + VX[k] / (cw - 1) * (ZA.bw - 1) + .5) / ZA.W, 1 - (ch * 2 + VY[k] / (ch - 1) * (ZA.bh - 1) + .5) / ZA.H);
  }
  for (let r = 0; r < gy; r++) for (let c = 0; c < gx; c++) {
    const a = r * nx + c, b = a + 1, d = a + nx, e = d + 1;
    if (fi[a] < 0 || fi[b] < 0 || fi[d] < 0 || fi[e] < 0) continue;
    idx.push(fi[a], fi[d], fi[b], fi[b], fi[d], fi[e]); idx.push(bi[a], bi[b], bi[d], bi[b], bi[e], bi[d]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
let ZEYE = null;
function zodiac(h, x, y, z, ry, i) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(1.2); h.site.add(g);
  const S = R.granite, S2 = R.granite2, EYE = ZEYE || (ZEYE = new THREE.MeshStandardMaterial({ color: '#34322d', roughness: .5 }));
  const mk = (geo, mat, px, py, pz, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m; };
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const seg = (mat, p, q, r0, r1 = r0) => { _a.set(...p); _b.set(...q); const L = _a.distanceTo(_b), m = mk(new THREE.CylinderGeometry(r1, r0, L, 10), mat, (_a.x + _b.x) / 2, (_a.y + _b.y) / 2, (_a.z + _b.z) / 2); m.quaternion.setFromUnitVectors(UP, _b.clone().sub(_a).normalize()); return m; };
  // 받침돌 + 띠 이름
  mk(new THREE.BoxGeometry(.6, .24, .54), S2, 0, .12, 0);
  const [hj, nm] = ZODIAC[i], plate = mk(new THREE.PlaneGeometry(.44, .15), new THREE.MeshStandardMaterial({ map: h.nameTex(`${hj} ${nm}`, '#55524b', '#efe7d6', 46), roughness: .8 }), 0, .12, .272); plate.castShadow = false;
  h.col(x, z, .34, .34);
  const B = .24;
  // 석상 몸: 그림으로 만든 입체 (그림을 못 불러오면 아래의 도형 석상으로 대신함)
  zodiacAtlas().then(A => { const m = new THREE.Mesh(A.geo(i), A.mat); m.position.y = B; m.castShadow = true; m.receiveShadow = true; m.name = 'zodiac' + i; g.add(m); }).catch(() => proc());
  function proc() {
  // 도포: 아래로 퍼진 옷자락 · 띠 · 맞깃 · 넓은 소매 · 모은 두 손
  mk(new THREE.LatheGeometry([[0, 0], [.27, 0], [.26, .05], [.2, .36], [.17, .6], [.2, .72], [.15, .8], [.07, .85], [0, .86]].map(([r, yy]) => new THREE.Vector2(r, yy)), 16), S, 0, B, 0);
  mk(new THREE.TorusGeometry(.183, .022, 6, 20), S2, 0, B + .42, 0).rotation.x = Math.PI / 2;
  for (const sx of [-1, 1]) { const c = mk(new THREE.BoxGeometry(.035, .2, .02), S2, sx * .045, B + .7, .155); c.rotation.z = sx * .55; c.rotation.x = -.25; }
  for (const sx of [-1, 1]) { seg(S, [sx * .19, B + .72, 0], [sx * .07, B + .46, .17], .07, .095); mk(new THREE.SphereGeometry(.045, 8, 6), S, sx * .035, B + .47, .22); }
  // 두 손에 든 것: 칼 · 지팡이(고리) · 창 · 홀
  const w = i % 4, gx = 0, gz = .24;
  if (w === 0) { mk(new THREE.BoxGeometry(.035, .5, .012), S2, gx, B + .78, gz); mk(new THREE.BoxGeometry(.13, .025, .04), S2, gx, B + .52, gz); mk(new THREE.SphereGeometry(.025, 8, 6), S2, gx, B + .4, gz); }
  else if (w === 1) { seg(S2, [gx, .26, gz], [gx, B + 1.05, gz], .016); mk(new THREE.TorusGeometry(.06, .012, 6, 16), S2, gx, B + 1.1, gz); }
  else if (w === 2) { seg(S2, [gx, .26, gz], [gx, B + 1.1, gz], .015); mk(new THREE.ConeGeometry(.035, .14, 8), S2, gx, B + 1.17, gz); }
  else { const t = mk(new THREE.BoxGeometry(.07, .3, .015), S2, gx, B + .62, gz + .01); t.rotation.x = -.2; }
  // 머리
  const hy = B + .86 + .12, head = (sx, sy, sz, dy = 0, dz = 0) => mk(new THREE.SphereGeometry(.14, 16, 12), S, 0, hy + dy, dz, sx, sy, sz);
  const eyes = (ex, ey, ez, r = .022) => { for (const s of [-1, 1]) mk(new THREE.SphereGeometry(r, 8, 6), EYE, s * ex, hy + ey, ez); };
  const nose = (py, pz, r = .02) => mk(new THREE.SphereGeometry(r, 8, 6), EYE, 0, hy + py, pz);
  switch (i) {
    case 0: // 쥐: 뾰족한 주둥이, 크고 둥근 귀, 수염
      head(1, .95, 1.05); { const sn = mk(new THREE.ConeGeometry(.065, .15, 12), S, 0, hy - .03, .19); sn.rotation.x = Math.PI / 2; } nose(-.03, .265, .018);
      for (const s of [-1, 1]) { const e = mk(new THREE.CylinderGeometry(.075, .075, .02, 16), S, s * .11, hy + .11, -.01); e.rotation.x = Math.PI / 2; e.rotation.z = s * .3; for (const k of [-1, 1]) seg(S2, [s * .04, hy - .03 + k * .01, .2], [s * .16, hy - .02 + k * .03, .19], .004); }
      eyes(.055, .04, .12); break;
    case 1: // 소: 넓은 주둥이·콧구멍, 옆으로 휜 뿔, 옆 귀
      head(1.15, 1, 1.05); mk(new THREE.SphereGeometry(.1, 12, 10), S, 0, hy - .06, .13, 1.15, .8, .75); for (const s of [-1, 1]) mk(new THREE.SphereGeometry(.018, 6, 6), EYE, s * .04, hy - .06, .205);
      for (const s of [-1, 1]) { const hn = mk(new THREE.TorusGeometry(.1, .024, 6, 12, Math.PI * .65), S2, s * .2, hy + .1, -.01); hn.rotation.z = s > 0 ? -.2 : Math.PI + .2; mk(new THREE.SphereGeometry(.05, 8, 6), S, s * .18, hy + .02, -.02, 1.2, .6, .5); }
      eyes(.07, .05, .12); break;
    case 2: // 호랑이: 넓은 얼굴, 볼록한 볼, 둥근 귀, 이마 줄무늬
      head(1.12, 1.02, 1.02); for (const s of [-1, 1]) mk(new THREE.SphereGeometry(.055, 10, 8), S, s * .045, hy - .05, .115); nose(-.025, .16, .022);
      for (const s of [-1, 1]) mk(new THREE.SphereGeometry(.05, 10, 8), S, s * .11, hy + .12, -.01, 1, 1, .55);
      for (const k of [-1, 0, 1]) mk(new THREE.BoxGeometry(.018, .06, .02), S2, k * .035, hy + .1, .11).rotation.z = k * .3;
      eyes(.06, .04, .125); break;
    case 3: // 토끼: 길게 선 두 귀, 동그란 볼
      head(1, 1, 1); for (const s of [-1, 1]) { const e = mk(new THREE.SphereGeometry(.04, 10, 8), S, s * .05, hy + .26, -.02, 1, 4, .6); e.rotation.z = -s * .12; mk(new THREE.SphereGeometry(.04, 8, 6), S, s * .035, hy - .05, .115); }
      nose(-.02, .15, .015); eyes(.06, .04, .12); break;
    case 4: // 용: 긴 주둥이, 뒤로 뻗은 뿔, 갈기, 늘어진 수염, 굵은 눈썹
      head(1, .95, 1.05); mk(new THREE.BoxGeometry(.15, .1, .2), S, 0, hy - .04, .17); for (const s of [-1, 1]) mk(new THREE.SphereGeometry(.015, 6, 6), EYE, s * .04, hy - .01, .27);
      for (const s of [-1, 1]) { const hn = mk(new THREE.ConeGeometry(.025, .24, 6), S2, s * .06, hy + .17, -.08); hn.rotation.x = -.7; hn.rotation.z = -s * .2; mk(new THREE.BoxGeometry(.07, .025, .04), S2, s * .055, hy + .08, .115).rotation.z = s * .3; const wh = mk(new THREE.TorusGeometry(.12, .008, 4, 12, Math.PI * .6), S2, s * .1, hy - .12, .22); wh.rotation.y = s * Math.PI / 2; }
      for (let k = 0; k < 4; k++) mk(new THREE.ConeGeometry(.03, .1, 5), S2, 0, hy + .12 - k * .07, -.12 - k * .02).rotation.x = -1.2;
      eyes(.06, .05, .12, .026); break;
    case 5: // 뱀: 납작한 머리, 뒤로 펼친 목 덮개
      mk(new THREE.SphereGeometry(.14, 16, 12), S2, 0, hy - .02, -.07, 1.5, 1.3, .35); head(.85, .7, 1.35, -.02, .04);
      eyes(.07, .02, .14, .02); for (const s of [-1, 1]) mk(new THREE.SphereGeometry(.008, 6, 6), EYE, s * .02, hy - .03, .23); break;
    case 6: // 말: 앞아래로 긴 얼굴, 선 귀, 목 뒤 갈기
      head(.85, 1, 1); seg(S, [0, hy - .02, .06], [0, hy - .12, .26], .075, .07); for (const s of [-1, 1]) mk(new THREE.SphereGeometry(.016, 6, 6), EYE, s * .035, hy - .13, .3);
      for (const s of [-1, 1]) mk(new THREE.ConeGeometry(.03, .11, 6), S, s * .06, hy + .17, -.02);
      for (let k = 0; k < 5; k++) mk(new THREE.BoxGeometry(.03, .06, .05), S2, 0, hy + .14 - k * .06, -.1 - k * .02);
      eyes(.08, .04, .09); break;
    case 7: // 양: 옆으로 말린 뿔, 작은 주둥이, 턱수염
      head(1, 1, 1); for (const s of [-1, 1]) { const hn = mk(new THREE.TorusGeometry(.065, .028, 6, 14, Math.PI * 1.6), S2, s * .13, hy + .03, -.01); hn.rotation.y = Math.PI / 2; }
      mk(new THREE.SphereGeometry(.07, 10, 8), S, 0, hy - .06, .12, 1, .8, .8); nose(-.04, .18, .015);
      mk(new THREE.ConeGeometry(.03, .1, 6), S2, 0, hy - .16, .09).rotation.x = Math.PI;
      eyes(.06, .04, .12); break;
    case 8: // 원숭이: 납작한 얼굴판, 양옆 둥근 귀, 눈두덩
      head(1, 1, .95); mk(new THREE.SphereGeometry(.14, 14, 10), S2, 0, hy - .02, .07, .7, .7, .45);
      for (const s of [-1, 1]) { const e = mk(new THREE.CylinderGeometry(.05, .05, .02, 14), S, s * .15, hy, -.01); e.rotation.z = Math.PI / 2; }
      mk(new THREE.BoxGeometry(.13, .025, .03), S, 0, hy + .05, .12); nose(-.03, .14, .014);
      eyes(.045, .02, .135); break;
    case 9: // 닭: 볏, 부리, 턱 아래 늘어진 살
      head(.85, .95, .95); for (let k = 0; k < 3; k++) mk(new THREE.SphereGeometry(.04, 8, 6), S2, 0, hy + .13 + (k === 1 ? .03 : 0), -.04 + k * .05, .5, 1, 1);
      { const bk = mk(new THREE.ConeGeometry(.035, .1, 8), S2, 0, hy - .01, .17); bk.rotation.x = Math.PI / 2; } mk(new THREE.SphereGeometry(.03, 8, 6), S2, 0, hy - .09, .12, .7, 1.5, .7);
      eyes(.07, .03, .1); break;
    case 10: // 개: 주둥이·코, 양옆으로 처진 귀
      head(1, 1, 1.02); seg(S, [0, hy - .04, .08], [0, hy - .05, .22], .065, .058); nose(-.03, .23, .022);
      for (const s of [-1, 1]) { const e = mk(new THREE.SphereGeometry(.05, 10, 8), S, s * .14, hy - .01, -.01, .5, 1.4, .8); e.rotation.z = s * .25; }
      eyes(.06, .045, .12); break;
    default: // 돼지: 납작한 코판·콧구멍, 앞으로 접힌 세모 귀
      head(1.12, 1.02, 1); { const sn = mk(new THREE.CylinderGeometry(.065, .07, .07, 14), S, 0, hy - .03, .15); sn.rotation.x = Math.PI / 2; } for (const s of [-1, 1]) mk(new THREE.SphereGeometry(.014, 6, 6), EYE, s * .025, hy - .03, .186);
      for (const s of [-1, 1]) { const e = mk(new THREE.ConeGeometry(.05, .1, 4), S, s * .09, hy + .12, .03); e.rotation.x = .9; e.rotation.z = -s * .2; }
      eyes(.07, .04, .12); break;
  }
  }
}
export function buildYonggung(h, T, F) {
  const { add, box, col, L, D, YX, YZ0, YZ1, MAT } = h, { TY, ZC0, ZC1, ZB, ZS1, ZT1, HXc, HZc, HR, HY, HS1 } = F, fig = h.fig || (h.fig = []);
  const plane = (w, d, mat, x, y, z) => { const p = add(new THREE.PlaneGeometry(w, d), mat, x, y, z, false); p.rotation.x = -Math.PI / 2; p.receiveShadow = true; return p; };
  const sign = (text, x, y, z, w = 1.5, ry = 0, fs = 40) => { const p = add(new THREE.PlaneGeometry(w, w * .27), new THREE.MeshStandardMaterial({ map: h.nameTex(text, '#2b1d14', '#f2cf72', fs), roughness: .6 }), x, y, z, false); p.rotation.y = ry; return p; };
  const post = (x, y, z, hh = .8) => add(new THREE.CylinderGeometry(.04, .05, hh, 6), MAT.trunk, x, y + hh / 2, z);
  const rail = (x0, z0, x1, z1, y = 0) => { // 흰 돌난간
    const len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    for (const yy of [.95, .45]) { const b = add(new THREE.BoxGeometry(.12, .09, len), R.rail, cx, y + yy, cz); b.rotation.y = a; }
    for (let t = 0; t <= len + .01; t += 1.2) add(new THREE.BoxGeometry(.16, 1.05, .16), R.rail, x0 + (x1 - x0) * t / len, y + .52, z0 + (z1 - z0) * t / len);
  };
  const rocks = (x0, z0, x1, z1, n, r0 = .4, r1 = .9) => { for (let i = 0; i < n; i++) { const t = i / Math.max(1, n - 1), r = r0 + Math.random() * (r1 - r0); const m = add(new THREE.IcosahedronGeometry(r, 0), Math.random() < .5 ? R.rock : R.rock2, x0 + (x1 - x0) * t + (Math.random() - .5) * .6, r * .25, z0 + (z1 - z0) * t + (Math.random() - .5) * .6); m.scale.y = .6 + Math.random() * .3; m.rotation.y = Math.random() * 3; } };

  // ① 바닷물이 드나드는 물길: 왼쪽(북쪽) 바다에서 들어와 일주문 언덕과 마당 사이를 가로지름
  const XW = -YX - 6;
  plane(-YX - XW, ZC1 - YZ0 + 1, R.sea, (XW - YX) / 2, .045, (YZ0 + ZC1) / 2 - .5);
  plane(YX - XW + .5, ZC1 - ZC0, R.sea, (XW + YX) / 2, .046, (ZC0 + ZC1) / 2);
  rocks(-YX - .3, YZ0 + .5, -YX - .3, ZC0 - .4, 16, .35, .7); rocks(XW + .4, YZ0, XW + .4, ZB + 3, 14, .6, 1.2);
  for (const x0 of [-YX + .4, 3.4]) rocks(x0, ZC0 + .05, x0 === 3.4 ? YX - .2 : -3.4, ZC0 + .05, 8, .25, .45); // 다리 양옆은 비워 둠
  rail(-YX, YZ0, -YX, ZC0 - .35); col(-YX - .1, (YZ0 + ZC0) / 2, .2, (ZC0 - YZ0) / 2);
  for (const [x0, x1] of [[-YX - 6, -1.62], [1.62, YX + .4]]) col((x0 + x1) / 2, (ZC0 + ZC1) / 2, (x1 - x0) / 2, (ZC1 - ZC0) / 2 + .1);
  // ② 용문석교: 물길 위 흰 난간 무지개 다리 (다리 위에서 동전을 던지며 소원을 빎)
  { const z0 = ZC0 - .4, z1 = ZB, n = 9;
    for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, za = z0 + (z1 - z0) * t0, zb = z0 + (z1 - z0) * t1, ya = .42 * Math.sin(Math.PI * t0), yb = .42 * Math.sin(Math.PI * t1), len = Math.hypot(zb - za, yb - ya);
      const d = add(new THREE.BoxGeometry(2.9, .16, len + .02), R.granite, 0, (ya + yb) / 2 - .06, (za + zb) / 2); d.rotation.x = -Math.atan2(yb - ya, zb - za); }
    const a = add(new THREE.TorusGeometry(.75, .14, 6, 16, Math.PI), R.granite2, 0, -.2, (ZC0 + ZC1) / 2); a.rotation.y = Math.PI / 2;
    for (const sx of [-1, 1]) for (let i = 0; i <= 6; i++) { const t = i / 6, z = z0 + (z1 - z0) * t, y = .42 * Math.sin(Math.PI * t); add(new THREE.BoxGeometry(.14, .62, .14), R.rail, sx * 1.42, y + .31, z); }
    for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) { const t0 = i / 6, t1 = (i + 1) / 6, za = z0 + (z1 - z0) * t0, zb = z0 + (z1 - z0) * t1, ya = .42 * Math.sin(Math.PI * t0) + .6, yb = .42 * Math.sin(Math.PI * t1) + .6; const b = add(new THREE.BoxGeometry(.09, .08, Math.hypot(zb - za, yb - ya)), R.rail, sx * 1.42, (ya + yb) / 2, (za + zb) / 2); b.rotation.x = -Math.atan2(yb - ya, zb - za); }
    for (const sx of [-1, 1]) col(sx * 1.55, (z0 + z1) / 2, .08, (z1 - z0) / 2);
    sign('용문석교', 1.9, .95, ZC0 - .55, 1.1); post(1.9, 0, ZC0 - .6, .82);
  }
  // ③ 일주문 언덕: 축대 위 마당 (일주문 계단으로 올라와 108 장수계단으로 내려감)
  { const MW = MAT.wallStone, wd = 2 * YX;
    for (const sx of [-1, 1]) { const w = YX - 1.45; box(w, TY, ZS1 - ZB, MW, sx * (1.45 + w / 2), TY / 2, (ZB + ZS1) / 2); box(w, TY, YZ1 - .25 - ZT1, MW, sx * (1.45 + w / 2), TY / 2, (ZT1 + YZ1 - .25) / 2); }
    box(wd, TY, ZT1 - ZS1, MW, 0, TY / 2, (ZS1 + ZT1) / 2);
    for (const sx of [-1, 1]) { plane(YX - 1.45, YZ1 - .25 - ZB, MAT.yard, sx * (1.45 + (YX - 1.45) / 2), TY + .014, (ZB + YZ1 - .25) / 2); }
    plane(2.8, ZT1 - ZS1, MAT.path, 0, TY + .02, (ZS1 + ZT1) / 2);
    // 108 장수계단 (내림) · 일주문 계단 (오름)
    const steps = (za, zb, up) => { const n = Math.round(Math.abs(zb - za) / .3), dz = (zb - za) / n; for (let i = 0; i < n; i++) { const hh = TY * (up ? (n - i) / n : (i + 1) / n); box(2.9, hh, Math.abs(dz) + .01, R.granite, 0, hh / 2, za + dz * (i + .5)); } };
    steps(ZB, ZS1, false); steps(ZT1, YZ1 - .1, true);
    for (const sx of [-1, 1]) { col(sx * 1.55, (ZB + ZS1) / 2, .1, (ZS1 - ZB) / 2); col(sx * 1.55, (ZT1 + YZ1) / 2, .1, (YZ1 - ZT1) / 2); col(sx * (1.45 + (YX - 1.45) / 2), (ZB + ZS1) / 2 - .1, (YX - 1.45) / 2, (ZS1 - ZB) / 2 - .05); }
    // 계단 양옆 연등 난간 (낮은 돌기둥 위 연등)
    for (const sx of [-1, 1]) for (let z = ZB + .2; z < ZS1; z += .55) { const y = TY * (z - ZB) / (ZS1 - ZB); add(new THREE.BoxGeometry(.14, .5, .14), R.granite2, sx * 1.55, y + .25, z); add(new THREE.IcosahedronGeometry(.15, 1), MAT.lotus[(Math.round(z * 3) + (sx > 0 ? 2 : 0)) % MAT.lotus.length], sx * 1.55, y + .66, z, false); }
    sign('108 장수계단', -2.6, TY + .92, ZS1 + .25, 1.4); post(-2.6, TY, ZS1 + .2, .82);
    rail(-YX, ZB, -YX, YZ1 - .3, TY); col(-YX - .1, (ZB + YZ1) / 2, .2, (YZ1 - ZB) / 2);
    // 일주문 (해동제일관음성지): 108계단 꼭대기
    for (const sx of [-1, 1]) { add(new THREE.CylinderGeometry(.17, .19, 3.0, 10), MAT.red, sx * 1.75, TY + 1.5, ZS1 + .35); col(sx * 1.75, ZS1 + .35, .22, .22); }
    box(4.4, .28, 1.0, MAT.wallCap, 0, TY + 3.1, ZS1 + .35); box(3.8, .22, .3, MAT.red, 0, TY + 2.82, ZS1 + .35);
    for (const s of [1, -1]) { const b = sign('해동제일관음성지', 0, TY + 2.45, ZS1 + .35 + s * .17, 2.2, s > 0 ? 0 : Math.PI, 34); }
    // 십이지신상: 길 양옆에 여섯씩 (자 축 인 묘 진 사 / 오 미 신 유 술 해)
    const zz = (ZS1 + ZT1) / 2 + .2;
    for (let i = 0; i < 12; i++) { const sx = i < 6 ? -1 : 1, k = i % 6; zodiac(h, sx * (2.2 + k * .85), TY, zz, sx < 0 ? .55 : -.55, i); }
    sign('십이지신상', -4.3, TY + .3, zz + 1.0, 1.2, 0, 40);
    // 교통안전기원탑 (오층석탑)
    const up = dy => ({ ...h, add: (geo, m, x, y, z, s) => add(geo, m, x, y + dy, z, s), box: (w, hh, d, m, x, y, z) => add(new THREE.BoxGeometry(w, hh, d), m, x, y + dy, z) });
    const tx = -(YX - 2.4), tz = zz - .2; stoneTiers(up(TY), tx, tz, 5, .62); col(tx, tz, .8, .8); sign('교통안전기원탑', tx, TY + .42, tz + 1.05, 1.3, 0, 36);
    // 갓바위 약사여래 (동해 갓바위 부처): 돌부처 머리 위 넓적한 갓돌
    { const x = YX - 2.4, z = zz - .2;
      box(1.5, .5, 1.3, R.granite2, x, TY + .25, z); col(x, z, .8, .7);
      fig.push({ k: 'yaksa', tint: 'stone', lx: x, ly: TY + .5, lz: z, h: 1.6, ry: 0, ph: [] });
      add(new THREE.CylinderGeometry(.62, .66, .1, 16), R.granite2, x, TY + .5 + 1.6 * .985, z - .02);
      sign('갓바위 약사여래', x, TY + .3, z + .8, 1.3, 0, 34); }
    // 득남불 (미륵좌상 석불): 계단 초입 — 코와 배를 만지면 아들을 얻는다는 이야기
    { const x = 2.7, z = ZS1 + .9; box(.9, .35, .8, R.granite2, x, TY + .175, z); col(x, z, .5, .45);
      fig.push({ k: 'sakya', tint: 'stone', lx: x, ly: TY + .35, lz: z, h: 1.1, ry: -.4, ph: [] });
      sign('득남불', x, TY + .2, z + .48, .8, -.4, 44); }
  }
  // ④ 굴법당(미륵전): 대웅보전 왼쪽 바위 동굴 법당
  { const x = -(L / 2 + 3.2), z = -1.6;
    for (const [dx, dy, dz, r] of [[0, .9, 0, 2.2], [-1.3, .6, -.5, 1.5], [1.2, .7, -.6, 1.5], [.1, 1.9, -.5, 1.4]]) { const m = add(new THREE.IcosahedronGeometry(r, 0), dx ? R.rock2 : R.rock, x + dx, dy, z + dz); m.scale.set(1, .8, .9); }
    const door = add(new THREE.CircleGeometry(.72, 16, 0, Math.PI), new THREE.MeshStandardMaterial({ color: '#1b1612', roughness: 1 }), x, .02, z + 1.98, false); door.scale.y = 1.55;
    box(1.6, .12, .4, R.granite, x, .06, z + 2.2); sign('굴법당 (미륵전)', x, 1.5, z + 2.06, 1.4);
    col(x, z, 2.1, 1.9);
  }
  // ⑤ 해수관음대불: 대웅보전 오른쪽 계단 위 바위 언덕
  { const x = HXc, z = HZc;
    const hill = add(new THREE.CylinderGeometry(HR, HR + .5, HY, 12), R.rock, x, HY / 2, z); hill.scale.z = 1;
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; if (Math.abs(Math.sin(a) - 1) < .25 || Math.cos(a) > .15) continue; /* 앞(계단)·오른쪽(길)은 비움 */ const r = .6 + Math.random() * .5, m = add(new THREE.IcosahedronGeometry(r, 0), i % 2 ? R.rock2 : R.rock, x + Math.cos(a) * (HR + .3), r * .4, z + Math.sin(a) * (HR + .3)); m.scale.y = .7; }
    plane(HR * 2 - .2, HR * 2 - .2, R.granite, x, HY + .01, z).geometry = new THREE.CircleGeometry(HR - .1, 20);
    const n = 9; for (let i = 0; i < n; i++) { const hh = HY * (n - i) / n, z0 = HZc + HR - .2 + (HS1 - (HZc + HR - .2)) * i / n, dz = (HS1 - (HZc + HR - .2)) / n; box(1.3, hh, dz + .01, R.granite, x, hh / 2, z0 + dz / 2); }
    add(new THREE.CylinderGeometry(1.0, 1.15, .4, 16), R.granite2, x, HY + .2, z - .5);
    add(new THREE.CylinderGeometry(.85, .95, .25, 16), R.marble, x, HY + .52, z - .5);
    const ph = standingGwaneum(o => h.site.add(o), x, HY + .64, z - .5, 6.2, 0);
    fig.push({ k: 'bosalS', tint: 'marble', lx: x, ly: HY + .64, lz: z - .5, h: 6.8, ry: 0, ph: [ph] });
    col(x, z - .5, 1.1, 1.1);
    // 언덕 가장자리 (계단 입구만 열어 둠)
    col(x - HR - .2, z, .15, HR + .3); col(x + HR + .2, z, .15, HR + .3); col(x, z - HR - .2, HR + .3, .15);
    for (const sx of [-1, 1]) col(x + sx * (HR / 2 + .55), z + HR + .1, HR / 2 - .2, .15);
    for (const sx of [-1, 1]) col(x + sx * .72, (HZc + HR + HS1) / 2, .08, (HS1 - HZc - HR) / 2);
    sign('해수관음대불', x + 1.15, .95, HS1 + .1, 1.3, 0, 38); post(x + 1.15, 0, HS1 + .05, .82);
  }
  // ⑥ 용궁단: 법당 뒤 바닷가 작은 단
  { const x = -3.6, z = -D / 2 - 4.2;
    box(3.0, .35, 2.4, R.granite, x, .175, z); box(2.2, 1.6, 1.6, R.white, x, 1.15, z);
    for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(.1, .11, 1.6, 8), R.redCol, x + sx * 1.0, 1.15, z + .82);
    const m = add(hipRoofGeo(THREE, 3.2, 2.6, .9, .5, .3), R.roofTile, x, 1.95, z); m.receiveShadow = false;
    sign('용궁단', x, 1.62, z + .83, 1.0, 0, 46);
    col(x, z, 1.5, 1.2);
  }
  // ⑦ 일출암과 지장보살: 난간이 끊긴 곳에서 바다로 나간 바위 끝
  { const [g0, g1, gd] = F.gap, x = (g0 + g1) / 2, zEnd = YZ0 - gd + .6;
    const fr = add(new THREE.BoxGeometry(g1 - g0 + .6, .2, gd), R.rock, x, .1, YZ0 - gd / 2, true); fr.receiveShadow = true;
    rocks(g0 - .8, YZ0 - .8, g0 - .8, YZ0 - gd, 5, .3, .55); rocks(g1 + .8, YZ0 - .8, g1 + .8, YZ0 - gd, 5, .3, .55);
    col(g0 - .35, YZ0 - gd / 2, .15, gd / 2); col(g1 + .35, YZ0 - gd / 2, .15, gd / 2);
    for (const [dx, dy, dz, r] of [[0, .55, 0, 1.15], [-.8, .35, .4, .8], [.7, .4, -.3, .9]]) { const m = add(new THREE.IcosahedronGeometry(r, 0), R.rock2, x + dx, dy, zEnd + dz - .4); m.scale.y = .75; }
    fig.push({ k: 'disciple', tint: 'bronze', lx: x, ly: 1.15, lz: zEnd - .4, h: 2.1, ry: 0, ph: [standingGwaneum(o => h.site.add(o), x, 1.15, zEnd - .4, 2.0, 0, R.bronze)] });
    col(x, zEnd - .4, 1.0, .9);
    sign('일출암 · 지장보살', x, .95, YZ0 - .9, 1.4); post(x - .9, 0, YZ0 - .95, .82);
  }
  return {};
}
