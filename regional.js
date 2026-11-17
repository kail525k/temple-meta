// 지역·사찰마다 다른 모습 (위레브)
// - 권역 풍경: 나무 종류(전나무·소나무·대나무·동백·귤·은행·단풍), 뒷산 높이·눈, 서울은 빌딩 숲, 제주는 한라산·현무암 돌담
// - 사찰 상징물: 월정사 팔각구층석탑, 법주사 팔상전, 불국사 석가탑·다보탑, 신흥사 통일대불, 금산사 미륵전,
//   통도사 금강계단, 해인사 장경판전, 백양사 쌍계루, 선암사 승선교, 관음사 석불 길, 조계사 노거수 등
// 모두 코드로 그린 단순한 모양(실제 사진·도면을 옮기지 않음)
import * as THREE from 'three';
import { hipRoofGeo, gableRoofGeo } from './hall.js?v=8';
import { createSchool, tankFish } from './fish.js?v=5';

const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, flatShading: true, ...extra });
const R = {
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
// 해동용궁사 사사자 석탑: 네 마리 돌사자가 받친 삼층석탑
function lion3(h, x, z) {
  const { box, add } = h, S = .9;
  box(2.5 * S, .4, 2.5 * S, h.MAT.stone, x, .2, z);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lx = x + sx * .72 * S, lz = z + sz * .72 * S, ry = Math.atan2(sx, sz);
    const g = new THREE.Group(); g.position.set(lx, .4, lz); g.rotation.y = ry; h.site.add(g);
    const mk = (geo, px, py, pz, sx2 = 1, sy = 1, sz2 = 1) => { const m = new THREE.Mesh(geo, R.granite); m.position.set(px, py, pz); m.scale.set(sx2, sy, sz2); m.castShadow = true; g.add(m); return m; };
    mk(new THREE.SphereGeometry(.24, 10, 8), 0, .3, -.05, .9, 1.1, 1.2);        // 앉은 몸
    mk(new THREE.SphereGeometry(.2, 10, 8), 0, .6, .1, 1.1, 1, 1);               // 갈기 머리
    mk(new THREE.SphereGeometry(.1, 8, 6), 0, .56, .27, 1, .8, .8);              // 주둥이
    for (const s2 of [-1, 1]) mk(new THREE.CylinderGeometry(.05, .06, .36, 6), s2 * .1, .18, .16);
  }
  box(.36, .82, .36, R.granite2, x, .81, z);
  box(2.1 * S, .2, 2.1 * S, h.MAT.stoneDark, x, 1.32, z);
  const up = { ...h, add: (geo, m, px, py, pz, s) => add(geo, m, px, py + 1.42, pz, s), box: (w, hh, d, m, px, py, pz) => add(new THREE.BoxGeometry(w, hh, d), m, px, py + 1.42, pz) };
  stoneTiers(up, x, z, 3, .78);
  return 1.25 * S;
}
// 탑 종류에 맞춰 세우기 → 탑돌이 중심 반환
export function buildPagoda(h, type, PZ) {
  const { col } = h;
  let r, x = 0;
  if (type === 'octa9') r = octa9(h, 0, PZ);
  else if (type === 'wood5') r = wood5(h, 0, PZ);
  else if (type === 'stone5') r = stoneTiers(h, 0, PZ, 5, 1.05, true);
  else if (type === 'stone7') r = stoneTiers(h, 0, PZ, 7, 1.1);
  else if (type === 'lion') r = lion3(h, 0, PZ);
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
  const { box, add, col, L, D } = h, list = [...((T.style && T.style.extras) || [])], SX = L / 2 + 3.2;
  const out = {}, fig = h.fig || (h.fig = []); // fig: 나중에 3D 존상 모델로 바꿔 끼울 바깥 불상·보살상 자리
  if (T.style && T.style.bigStand) list.push('bigStand');
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
    if (kind === 'cairns') { // 통일의 돌탑: 세계 성지에서 가져온 돌을 쌓아 올린 작은 돌탑들
      for (const [x, z, n] of [[-4.6, D / 2 + 2.2, 7], [-5.8, D / 2 + 3.4, 5], [4.6, D / 2 + 2.4, 6], [5.9, D / 2 + 3.2, 8], [-6.2, D / 2 + 1.2, 4], [6.4, D / 2 + 1.4, 5]]) {
        let y = 0; for (let i = 0; i < n; i++) { const r = .34 - i * .028, m = add(new THREE.IcosahedronGeometry(r, 0), i % 2 ? R.rock : R.granite2, x + (Math.random() - .5) * .06, y + r * .45, z + (Math.random() - .5) * .06); m.scale.y = .55; m.rotation.y = Math.random() * 3; y += r * .78; }
        col(x, z, .35, .35);
      }
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
      let loaded = false; // Meshy로 만든 황어·우럭 모델은 휴휴암에 처음 왔을 때 불러옴 (못 불러오면 직접 만든 모양 그대로) → 수조 물고기도 같은 모델로
      out.anim = dt => { if (!loaded) { loaded = true; for (const k of ['hwangeo', 'ureok']) school.loadModel(k, `./assets/fish-${k}.glb?v=1`).then(ok => { if (ok) for (const a of tanks) a.use(k, school.model(k)); }); } school.update(dt); for (const a of tanks) a(dt); };
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
  const HXc = L / 2 + 3.2, HZc = -1.4, HR = 2.4, HY = 2.4, HS1 = HZc + HR + 2.6; // 해수관음 언덕
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
// 십이지신상 하나: 받침돌 + 도포 + 띠 동물 머리 (화강암)
function zodiac(h, x, y, z, ry, i) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; h.site.add(g);
  const S = R.granite, S2 = R.granite2;
  const mk = (geo, mat, px, py, pz, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m; };
  mk(new THREE.BoxGeometry(.56, .22, .5), S2, 0, .11, 0);
  mk(new THREE.LatheGeometry([[0, 0], [.2, 0], [.19, .05], [.15, .45], [.17, .58], [.1, .66], [0, .68]].map(([r, yy]) => new THREE.Vector2(r, yy)), 12), S, 0, .22, 0);
  for (const sx of [-1, 1]) mk(new THREE.SphereGeometry(.06, 8, 6), S, sx * .07, .62, .12, 1, 1, 1.2); // 모은 두 손
  const hy = 1.0, head = (sx, sy, sz) => mk(new THREE.SphereGeometry(.13, 12, 10), S, 0, hy, 0, sx, sy, sz);
  const ear = (px, py, r = .05, sx = 1, sy = 1) => { for (const s of [-1, 1]) mk(new THREE.SphereGeometry(r, 8, 6), S, s * px, py, -.01, sx, sy, .5); };
  const horn = (px, py, len = .14, tilt = .5) => { for (const s of [-1, 1]) { const c = mk(new THREE.ConeGeometry(.03, len, 6), S2, s * px, py, 0); c.rotation.z = -s * tilt; } };
  const snout = (len, r = .06, py = hy - .02) => { const c = mk(new THREE.CylinderGeometry(r * .8, r, len, 8), S, 0, py, .11 + len / 2 - .04); c.rotation.x = Math.PI / 2; };
  switch (i) {
    case 0: head(1, 1, 1.05); ear(.1, hy + .1, .06); snout(.08, .04); break;                    // 쥐
    case 1: head(1.15, 1, 1.1); horn(.13, hy + .1, .16, 1.0); snout(.08, .08); break;           // 소
    case 2: head(1.15, 1.05, 1.05); ear(.1, hy + .11, .045); snout(.06, .07); break;            // 범
    case 3: head(1, 1, 1); for (const s of [-1, 1]) { const e = mk(new THREE.CylinderGeometry(.025, .035, .22, 6), S, s * .05, hy + .2, -.02); e.rotation.z = -s * .15; } break; // 토끼
    case 4: head(1.05, 1, 1.15); horn(.07, hy + .14, .2, .35); snout(.14, .06); break;          // 용
    case 5: head(.85, .9, 1.2); snout(.1, .05); break;                                          // 뱀
    case 6: head(.9, 1.1, 1.05); ear(.06, hy + .15, .04, .6, 1.6); snout(.18, .065, hy - .05); break; // 말
    case 7: head(1, 1, 1); for (const s of [-1, 1]) { const t = mk(new THREE.TorusGeometry(.06, .022, 6, 12), S2, s * .12, hy + .04, 0); t.rotation.y = Math.PI / 2; } snout(.07, .06); break; // 양
    case 8: head(1, 1, .95); ear(.14, hy, .05, .6, 1); mk(new THREE.SphereGeometry(.08, 8, 6), S2, 0, hy - .03, .09, 1, .8, .6); break; // 원숭이
    case 9: head(.9, 1, 1); mk(new THREE.BoxGeometry(.03, .1, .14), R.redCol, 0, hy + .15, 0); mk(new THREE.ConeGeometry(.035, .1, 6), S2, 0, hy, .15).rotation.x = Math.PI / 2; break; // 닭
    case 10: head(1, 1, 1.05); ear(.12, hy + .02, .05, .6, 1.5); snout(.1, .06); break;          // 개
    default: head(1.15, 1.05, 1); ear(.11, hy + .1, .05, 1.2, .7); snout(.05, .07); break;      // 돼지
  }
  h.col(x, z, .3, .3);
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
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; if (Math.abs(Math.sin(a) - 1) < .25) continue; const r = .6 + Math.random() * .5, m = add(new THREE.IcosahedronGeometry(r, 0), i % 2 ? R.rock2 : R.rock, x + Math.cos(a) * (HR + .3), r * .4, z + Math.sin(a) * (HR + .3)); m.scale.y = .7; }
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
