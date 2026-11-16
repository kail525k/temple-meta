// 지역·사찰마다 다른 모습 (위레브)
// - 권역 풍경: 나무 종류(전나무·소나무·대나무·동백·귤·은행·단풍), 뒷산 높이·눈, 서울은 빌딩 숲, 제주는 한라산·현무암 돌담
// - 사찰 상징물: 월정사 팔각구층석탑, 법주사 팔상전, 불국사 석가탑·다보탑, 신흥사 통일대불, 금산사 미륵전,
//   통도사 금강계단, 해인사 장경판전, 백양사 쌍계루, 선암사 승선교, 관음사 석불 길, 조계사 노거수 등
// 모두 코드로 그린 단순한 모양(실제 사진·도면을 옮기지 않음)
import * as THREE from 'three';
import { hipRoofGeo, gableRoofGeo } from './hall.js?v=6';

const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, flatShading: true, ...extra });
const R = {
  bronze: M('#8a6b3a', { metalness: .45, roughness: .45 }), roofTile: M('#4f5b69', { side: THREE.DoubleSide }), redCol: M('#9b3b2b'),
  white: M('#f3e6cc'), wood: M('#7d5a3c'), lattice: M('#5a4330'), water: new THREE.MeshStandardMaterial({ color: '#5d8fa6', roughness: .15, metalness: .2, emissive: '#1d3f52', emissiveIntensity: .35 }),
  band: M('#2e8b74'), granite: M('#d4cdbf'), granite2: M('#b9b2a4'),
};

/* ───────── 탑 ───────── */
// 돌탑 n층 (s: 크기 배율, bronze: 청동 상륜)
function stoneTiers(h, x, z, n, s = 1, bronze = false) {
  const { box, add, MAT } = h;
  box(2.4 * s, .45 * s, 2.4 * s, MAT.stone, x, .225 * s, z); box(1.9 * s, .4 * s, 1.9 * s, MAT.stone, x, .65 * s, z);
  let y = .85 * s;
  for (let i = 0; i < n; i++) {
    const f = 1 - i * .5 / n, w = 1.15 * f * s, hh = (i ? .8 * (1 - i * .55 / n) * .82 : .8) * s;
    box(w, hh, w, MAT.stone, x, y + hh / 2, z); y += hh;
    box(w + .85 * f * s, .17 * s, w + .85 * f * s, MAT.stoneDark, x, y + .085 * s, z); y += .17 * s;
    box(w * .7, .12 * s, w * .7, MAT.stone, x, y + .06 * s, z); y += .12 * s;
  }
  const fm = bronze ? R.bronze : MAT.stoneDark;
  add(new THREE.CylinderGeometry(.05 * s, .07 * s, (bronze ? 1.5 : .9) * s, 8), fm, x, y + (bronze ? .75 : .45) * s, z);
  for (let i = 0; i < (bronze ? 5 : 3); i++) add(new THREE.SphereGeometry((.1 - i * .012) * s, 10, 8), fm, x, y + (.25 + i * .25) * s, z);
  if (bronze) add(new THREE.ConeGeometry(.32 * s, .3 * s, 12), R.bronze, x, y + .1 * s, z);
  return 1.25 * s;
}
// 월정사 팔각구층석탑: 팔각 몸돌 9층 + 청동 상륜
function octa9(h, x, z) {
  const { add } = h, C = (rt, rb, hh, mat, y) => add(new THREE.CylinderGeometry(rt, rb, hh, 8), mat, x, y + hh / 2, z);
  C(1.7, 1.8, .35, h.MAT.stone, 0); C(1.35, 1.4, .3, h.MAT.stone, .35); C(.95, 1.25, .25, R.granite, .65);
  let y = .9;
  for (let i = 0; i < 9; i++) {
    const r = .72 * (1 - i * .045), hh = i ? .36 - i * .01 : .62;
    C(r, r, hh, R.granite, y); y += hh;
    C(r + .22, r + .42, .13, h.MAT.stoneDark, y); y += .13;
  }
  add(new THREE.CylinderGeometry(.05, .08, 1.8, 8), R.bronze, x, y + .9, z);
  for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(.2 - i * .02, .2 - i * .02, .05, 12), R.bronze, x, y + .3 + i * .22, z);
  add(new THREE.SphereGeometry(.1, 10, 8), R.bronze, x, y + 1.85, z);
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
  const { box, add } = h, S = 1.1;
  box(2.7 * S, .5, 2.7 * S, h.MAT.stone, x, .25, z);
  for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) box(dx ? .5 : .9, .25, dz ? .5 : .9, h.MAT.stone, x + dx * 1.6 * S, .125, z + dz * 1.6 * S);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(.24, 1.1, .24, R.granite, x + sx * .78 * S, 1.05, z + sz * .78 * S);
  box(.5, 1.1, .5, R.granite, x, 1.05, z);
  box(2.1 * S, .18, 2.1 * S, h.MAT.stoneDark, x, 1.69, z);
  const rail = (r, hh, y) => { const m = add(new THREE.CylinderGeometry(r, r, hh, 8, 1, true), R.granite2, x, y, z); m.material.side = THREE.DoubleSide; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; box(.08, hh + .1, .08, R.granite, x + Math.sin(a) * r, y, z + Math.cos(a) * r); } };
  rail(.95, .36, 1.98); add(new THREE.CylinderGeometry(.55, .55, .6, 8), R.granite, x, 2.08, z);
  rail(.68, .26, 2.52); add(new THREE.CylinderGeometry(.62, .34, .26, 8), R.granite, x, 2.78, z);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; box(.07, .5, .07, R.granite, x + Math.sin(a) * .42, 3.1, z + Math.cos(a) * .42); }
  add(new THREE.CylinderGeometry(.22, .9, .2, 8), h.MAT.stoneDark, x, 3.42, z);
  add(new THREE.CylinderGeometry(.04, .07, .9, 8), h.MAT.stoneDark, x, 3.95, z);
  for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(.1 - i * .015, 10, 8), h.MAT.stoneDark, x, 3.75 + i * .22, z);
  return 1.5;
}
// 탑 종류에 맞춰 세우기 → 탑돌이 중심 반환
export function buildPagoda(h, type, PZ) {
  const { col } = h;
  let r, x = 0;
  if (type === 'octa9') r = octa9(h, 0, PZ);
  else if (type === 'wood5') r = wood5(h, 0, PZ);
  else if (type === 'stone5') r = stoneTiers(h, 0, PZ, 5, 1.05, true);
  else if (type === 'stone7') r = stoneTiers(h, 0, PZ, 7, 1.1);
  else if (type === 'pair') { // 서쪽 석가탑 · 동쪽 다보탑 (법당을 바라볼 때 왼쪽·오른쪽)
    x = -3.5; r = stoneTiers(h, x, PZ, 3, 1.12);
    const r2 = dabotap(h, 3.5, PZ); col(3.5, PZ, r2, r2);
  } else r = stoneTiers(h, 0, PZ, 3);
  col(x, PZ, r, r);
  return { x, r };
}

/* ───────── 사찰 상징물 (법당 옆 6m 마당·뒤뜰에 배치) ───────── */
// side: 법당 옆 빈 마당 가운데 x
export function buildExtras(h, T) {
  const { box, add, col, L, D } = h, list = (T.style && T.style.extras) || [], SX = L / 2 + 3.2;
  const out = {};
  for (const kind of list) {
    if (kind === 'oldTree') { // 수백 년 된 노거수 (조계사 회화나무·백송, 봉은사)
      const x = SX - .2, z = D / 2 - 1.5;
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
    if (kind === 'mireuk') { // 금산사 미륵전: 3층 법당
      const x = -SX, z = -.5;
      box(5.2, .5, 4.8, h.MAT.stone, x, .25, z);
      let y = .5; const fl = [[4.6, 4.2, 2.1], [3.7, 3.3, 1.5], [2.9, 2.5, 1.4]];
      fl.forEach(([w, d, hh], i) => {
        box(w, hh, d, R.white, x, y + hh / 2, z);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(.18, hh, .18, R.redCol, x + sx * w / 2, y + hh / 2, z + sz * d / 2);
        box(w + .05, .16, d + .05, R.band, x, y + hh - .08, z);
        box(w * .6, hh * .55, .05, R.lattice, x, y + hh * .42, z + d / 2 + .02);
        y += hh; const rw = w + 1.6, rd = d + 1.6, rh = rd * (i === 2 ? .36 : .2);
        const m = add(hipRoofGeo(THREE, rw, rd, rh, Math.max(.5, rw - rd * .95), .3), R.roofTile, x, y, z); m.receiveShadow = false;
        y += i === 2 ? rh : rh * .4;
      });
      const bd = add(new THREE.PlaneGeometry(1.3, .4), new THREE.MeshStandardMaterial({ map: h.nameTex('미륵전', '#2b1d14', '#f2cf72', 46), roughness: .6 }), x, .5 + 2.1 + 1.5 * .62, z + 3.3 / 2 + .06, false);
      col(x, z, 2.6, 2.4);
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
    if (kind === 'bridge') { // 선암사 승선교: 개울 위 무지개다리
      const x = SX, zb = 1.2;
      const st = add(new THREE.PlaneGeometry(1.5, D + 4), R.water, x, .035, 0, false); st.rotation.x = -Math.PI / 2;
      for (const sx of [-1, 1]) for (let z = -D / 2 - 1.6; z < D / 2 + 2; z += .9) box(.35, .25, .6, h.MAT.stoneDark, x + sx * .9, .12, z);
      col(x, 0, 1.0, D / 2 + 2);
      const arch = add(new THREE.TorusGeometry(1.15, .2, 6, 18, Math.PI), R.granite, x, 0, zb);
      arch.rotation.y = Math.PI / 2;
      for (const dz of [-.55, .55]) { const a2 = add(new THREE.TorusGeometry(1.15, .16, 6, 18, Math.PI), R.granite2, x, 0, zb + dz); a2.rotation.y = Math.PI / 2; a2.scale.set(1, 1, 1); }
      const deck = add(new THREE.TorusGeometry(1.5, .12, 4, 18, Math.PI * .7), R.granite, x, -.35, zb); deck.rotation.y = Math.PI / 2; deck.rotation.z = Math.PI * .15; deck.scale.z = 9;
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
    if (kind === 'janggyeong') { // 해인사 장경판전: 팔만대장경을 모신 긴 맞배 건물 두 채 (살창)
      for (const [z, name] of [[-D / 2 - 4.2, '수다라장'], [-D / 2 - 9.0, '법보전']]) {
        const w = Math.min(L + 2, 20), d = 3.0, hh = 2.6;
        box(w + .4, .35, d + .4, h.MAT.stone, 0, .175, z);
        box(w, hh, d, R.white, 0, .35 + hh / 2, z);
        for (let x = -w / 2; x <= w / 2 + .01; x += w / 8) for (const sz of [-1, 1]) box(.18, hh, .18, R.wood, x, .35 + hh / 2, z + sz * d / 2);
        for (let i = 0; i < 8; i++) for (const sz of [-1, 1]) for (const yy of [.65, 2.25]) {
          const cx = -w / 2 + w * (i + .5) / 8;
          for (let k = -4; k <= 4; k++) box(.05, .55, .05, R.lattice, cx + k * .17, .35 + yy, z + sz * (d / 2 + .02));
        }
        const m = add(gableRoofGeo(THREE, w + 1.4, d + 2.2, 1.5, .12), R.roofTile, 0, .35 + hh + .05, z); m.receiveShadow = false;
        box(w + 1.5, .3, .35, h.MAT.stoneDark, 0, .35 + hh + 1.6, z);
        col(0, z, w / 2 + .2, d / 2 + .2);
        const bd = add(new THREE.PlaneGeometry(1.4, .42), new THREE.MeshStandardMaterial({ map: h.nameTex(name, '#2b1d14', '#f2cf72', 46), roughness: .6 }), 0, .35 + hh - .45, z + d / 2 + .1, false);
      }
      out.backYard = 12.5;
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
    const a = i / n * Math.PI * 2 + Math.random() * .12, r = RB + 110 + Math.random() * 70;
    const hh = mt.h * (.55 + Math.random() * .5), rad = hh * (1.2 + Math.random() * .5);
    const c = new THREE.Mesh(new THREE.ConeGeometry(rad, hh, 7, 1), i % 2 ? mGreen : mDark); c.position.set(Math.sin(a) * r, hh / 2 - 2, Math.cos(a) * r); c.rotation.y = Math.random() * 3; g.add(c);
    if (mt.rock && hh > mt.h * .8) { const top = new THREE.Mesh(new THREE.ConeGeometry(rad * .28, hh * .26, 6), mt.snow ? mSnow : mRock); top.position.set(c.position.x, hh - 2 - hh * .13 + .5, c.position.z); top.rotation.y = c.rotation.y; g.add(top); }
  }
  if (mt.halla) { // 한라산: 남쪽으로 넓고 완만한 큰 산 + 작은 오름들
    const hm = new THREE.Mesh(new THREE.ConeGeometry(260, 95, 12, 1), M('#5f7f55')); hm.position.set(0, 45, RB + 230); g.add(hm);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(22, 70, 22, 12), M('#8c8f86')); cap.position.set(0, 86, RB + 230); g.add(cap);
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
    commit(scene) {
      for (const k in P) { const arr = lists[k]; if (!arr.length) continue; const im = new THREE.InstancedMesh(P[k][0], P[k][1], arr.length); arr.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = !['red', 'orange', 'bambooLeaf'].includes(k); scene.add(im); }
    },
  };
}
