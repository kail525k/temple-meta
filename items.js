// 사찰마다 간직한 상징물 (소개서의 '차례로 담을 모습'을 수월에 담음)
// 조계사 팔각십층석탑은 regional.js(탑), 금산사 미륵삼존은 regional.js(미륵전)에서 그림
// - 법당 앞 마당 양옆(탑 높이쯤, 길을 바라보게)과 법당 옆 마당에 놓음
// - 모두 코드로 그린 단순한 모양 (실제 사진·도면·글씨를 옮기지 않음, 현판 글씨도 보통 글꼴)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hipRoofGeo, gableRoofGeo } from './hall.js?v=8';
import { R, standingGwaneum } from './regional.js?v=26';

const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, flatShading: true, ...extra });
const glow = (c, e = .25) => M(c, { emissive: c, emissiveIntensity: e });
let K_ = null;
const K = () => K_ || (K_ = {
  pink: glow('#f4a3c0', .22), pink2: glow('#f8c3d6', .2), red: glow('#d23f66', .2), red2: glow('#e8708f', .2), white: glow('#f7eff2', .12), white2: glow('#f6d9e3', .15),
  cherry: glow('#f9cfdc', .25), cherry2: glow('#fbe3ea', .2), wis: glow('#9b7fd4', .25), wis2: glow('#c1a5ec', .22),
  leaf: M('#5d8f4e'), leaf2: M('#3f6e3c'), juniper: M('#3d6844'), juniper2: M('#4f7d4f'), bark: M('#5b3f2b'), bark2: M('#43301f'),
  pad: M('#4f8d4a', { side: THREE.DoubleSide }), pad2: M('#64a157', { side: THREE.DoubleSide }), lotus: glow('#f59bb9', .3), lotusC: glow('#f6d35b', .35), stem: M('#5f8f45'), reed: M('#93a85c'),
  thatch: M('#b8955f'), mud: M('#d9c7a3'), wallW: M('#efe3c6'), dark: M('#2e241e', { roughness: 1 }), plank: M('#9a6d47'), plank2: M('#7a5233', { side: THREE.DoubleSide }),
  inside: M('#4a3526', { side: THREE.DoubleSide }), rice: M('#efe9da'), tea: M('#6f8f3e'), cushion: M('#9b3b2b'), cloth: M('#c9a24a'), stele: M('#6f6c68', { roughness: .7 }),
  buddhaW: M('#f4efe4', { roughness: .55 }),
});
const rng = name => { let s = 7; for (const ch of name) s = (s * 31 + ch.charCodeAt(0)) % 2147483647; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// 여러 조각을 재질별로 하나로 합쳐 그리기 횟수를 줄임 (좌표는 놓을 그룹 기준)
function parts() {
  const L = new Map();
  const put = (g, mat) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); n.clearGroups(); (L.get(mat) || L.set(mat, []).get(mat)).push(n); return n; };
  return {
    put,
    box: (w, hh, d, mat, x, y, z, ry = 0) => { const g = new THREE.BoxGeometry(w, hh, d); if (ry) g.rotateY(ry); g.translate(x, y, z); return put(g, mat); },
    cyl: (rt, rb, hh, seg, mat, x, y, z) => { const g = new THREE.CylinderGeometry(rt, rb, hh, seg); if (seg === 8) g.rotateY(Math.PI / 8); g.translate(x, y, z); return put(g, mat); },
    ball: (r, mat, x, y, z, sx = 1, sy = 1, sz = 1, det = 0) => { const g = new THREE.IcosahedronGeometry(r, det); g.scale(sx, sy, sz); g.translate(x, y, z); return put(g, mat); },
    limb: (mat, a, b, r0, r1, seg = 6) => { const d = V(b.x - a.x, b.y - a.y, b.z - a.z), len = d.length(); const g = new THREE.CylinderGeometry(r1, r0, len, seg); g.translate(0, len / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z); return put(g, mat); },
    flush(parent, { shadow = true, noOcc = false } = {}) { const out = []; for (const [mat, gs] of L) { const m = new THREE.Mesh(mergeGeometries(gs), mat); m.castShadow = shadow; m.receiveShadow = true; if (noOcc) m.userData.noOcc = true; parent.add(m); out.push(m); } L.clear(); return out; },
  };
}
function grp(h, x, z, ry = 0) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; h.site.add(g); return g; }
function mesh(g, geo, mat, x, y, z, shadow = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; g.add(m); return m; }
// 그룹 안 좌표(ox, oz)의 상자를 사찰 좌표 충돌 상자로 (그룹은 0·90·180도로만 돌림)
function colG(h, g, ox, oz, hx, hz) { const c = Math.cos(g.rotation.y), s = Math.sin(g.rotation.y), sw = Math.abs(s) > .5; h.col(g.position.x + ox * c + oz * s, g.position.z - ox * s + oz * c, sw ? hz : hx, sw ? hx : hz); }
function toSite(g, ox, oz) { const c = Math.cos(g.rotation.y), s = Math.sin(g.rotation.y); return [g.position.x + ox * c + oz * s, g.position.z - ox * s + oz * c]; }
// 현판·안내판 글씨 판
function plate(h, g, text, w, x, y, z, { sub = '', px = 46, cw = 0, bg = '#2b1d14', fg = '#f2cf72' } = {}) {
  cw = cw || (sub ? 700 : 512); const hh = w * (sub ? 256 : 138) / cw;
  return mesh(g, new THREE.PlaneGeometry(w, hh), new THREE.MeshStandardMaterial({ map: h.nameTex(text, bg, fg, px, sub, cw), roughness: .65 }), x, y, z, false);
}
// 두 기둥 안내판 (그룹 앞 = +z 를 향함)
function signpost(h, x, z, ry, text, sub, w = 1.5) {
  const g = grp(h, x, z, ry), hh = w * 256 / 700;
  for (const px of [-w / 2 + .08, w / 2 - .08]) mesh(g, new THREE.CylinderGeometry(.035, .04, .7 + hh, 6), h.MAT.trunk, px, (.7 + hh) / 2, 0);
  mesh(g, new THREE.BoxGeometry(w + .06, hh + .06, .04), h.MAT.trunk, 0, .7 + hh / 2, -.03);
  plate(h, g, text, w, 0, .7 + hh / 2, .0, { sub, px: 40, cw: 700 });
  colG(h, g, 0, 0, w / 2, .1);
  return g;
}
// 여러 줄 글 판 (효행 이야기 · 현판 이야기)
function boardTex(title, lines, { w = 960, hh = 0, size = 30, gap = 46 } = {}) {
  hh = hh || 150 + lines.length * gap + 40;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = hh; const c = cv.getContext('2d');
  c.fillStyle = '#2b1d14'; c.fillRect(0, 0, w, hh); c.strokeStyle = '#f2cf72'; c.lineWidth = 8; c.strokeRect(16, 16, w - 32, hh - 32);
  c.fillStyle = '#f2cf72'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 56px "Noto Serif KR","Nanum Myeongjo",serif'; c.fillText(title, w / 2, 86);
  c.textAlign = 'left'; c.fillStyle = '#f6ecd6';
  lines.forEach((t, i) => { const bold = t.startsWith('*'); c.font = `${bold ? 700 : 500} ${size}px "Noto Sans KR",sans-serif`; c.fillStyle = bold ? '#f2cf72' : '#f6ecd6'; c.fillText(bold ? t.slice(1) : t, 54, 160 + i * gap); });
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return { tex: tx, ratio: hh / w };
}
// 작은 전각: 기단 · 벽 · 기둥 · 띠 · 지붕 · 현판 (앞 = +z)
function smallHall(h, g, { w, d, hh = 1.8, gable = false, roofH = 1.0, plaque = '', plaqueW = 1.2, open = 0, thatch = false }) {
  const P = parts(), k = K(), y0 = .3;
  P.box(w + .5, y0, d + .5, h.MAT.stone, 0, y0 / 2, 0);
  if (open) { // 앞 가운데를 열어 둔 전각: 뒤·옆 벽 + 앞 양끝 벽, 어두운 안
    P.box(w, hh, .12, thatch ? k.mud : k.wallW, 0, y0 + hh / 2, -d / 2 + .06);
    for (const sx of [-1, 1]) { P.box(.12, hh, d, thatch ? k.mud : k.wallW, sx * (w / 2 - .06), y0 + hh / 2, 0); P.box((w - open) / 2, hh, .12, thatch ? k.mud : k.wallW, sx * (w / 2 - (w - open) / 4), y0 + hh / 2, d / 2 - .06); }
    P.box(w - .3, hh - .05, .03, k.dark, 0, y0 + hh / 2, -d / 2 + .14);
    P.box(w - .24, .04, d - .24, R.wood, 0, y0 + .02, 0);
    P.box(open, .26, .08, R.lattice, 0, y0 + hh - .13, d / 2 - .04);
  } else {
    P.box(w, hh, d, thatch ? k.mud : k.wallW, 0, y0 + hh / 2, 0);
    if (!thatch) { P.box(w * .66, hh * .62, .05, R.lattice, 0, y0 + hh * .42, d / 2 + .02); for (const sx of [-1, 1]) P.box(w * .12, hh * .45, .05, R.lattice, sx * w * .4, y0 + hh * .5, d / 2 + .02); }
    else P.box(.5, hh * .7, .05, R.lattice, 0, y0 + hh * .35, d / 2 + .02);
  }
  if (!thatch) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.cyl(.08, .09, hh, 8, R.redCol, sx * w / 2, y0 + hh / 2, sz * d / 2); P.box(w + .06, .14, d + .06, R.band, 0, y0 + hh - .07, 0); }
  P.flush(g);
  const top = y0 + hh, roofMat = thatch ? K().thatch : R.roofTile;
  const geo = gable ? gableRoofGeo(THREE, w + 1.2, d + 1.6, roofH, .1) : hipRoofGeo(THREE, w + 1.3, d + 1.3, roofH, Math.max(.3, w - d * .7), thatch ? .05 : .26);
  const roof = mesh(g, geo, roofMat, 0, top, 0); roof.receiveShadow = false;
  if (gable) mesh(g, new THREE.BoxGeometry(w + 1.3, .2, .24), h.MAT.stoneDark, 0, top + roofH + .04, 0);
  if (plaque) plate(h, g, plaque, plaqueW, 0, top - .26, d / 2 + .1, { px: 50 });
  return top;
}
// 꽃나무 (매화·벚꽃): 굽은 줄기 + 가지 끝마다 꽃송이
function blossomTree(P, rnd, x, z, s, m1, m2, { spread = 1, lean = .3 } = {}) {
  const k = K(); let a = rnd() * 6.28;
  const p0 = V(x, 0, z), p1 = V(x + Math.cos(a) * lean * s, 1.0 * s, z + Math.sin(a) * lean * s);
  P.limb(k.bark, p0, p1, .2 * s, .15 * s, 7); a += 2.1;
  const p2 = V(p1.x + Math.cos(a) * .35 * s, p1.y + .8 * s, p1.z + Math.sin(a) * .35 * s); P.limb(k.bark, p1, p2, .15 * s, .1 * s, 6);
  const tips = [V(p2.x, p2.y + .45 * s, p2.z)];
  for (let i = 0; i < 6; i++) { const b = a + i * 1.05 + rnd() * .4, from = i < 3 ? p1 : p2, len = (.8 + rnd() * .55) * s * spread;
    const t = V(from.x + Math.cos(b) * len, from.y + (.3 + rnd() * .55) * s, from.z + Math.sin(b) * len); P.limb(k.bark, from, t, .09 * s, .04 * s, 5); tips.push(t); }
  for (const t of tips) for (let j = 0; j < 4; j++) { const r = (.3 + rnd() * .2) * s; P.ball(r, rnd() < .62 ? m1 : m2, t.x + (rnd() - .5) * .7 * s, t.y + (rnd() - .25) * .45 * s, t.z + (rnd() - .5) * .7 * s, 1, .82, 1, 1); }
  for (let j = 0; j < 7; j++) P.ball(.05 * s, m2, x + (rnd() - .5) * 2.6 * s, .03, z + (rnd() - .5) * 2.6 * s, 1, .3, 1); // 떨어진 꽃잎
}
// 낮은 돌 울타리 (원)
function stoneRing(P, x, z, r, mat) { const n = Math.round(r * 9); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; P.box(.22, .26, .14, mat, x + Math.cos(a) * r, .13, z + Math.sin(a) * r, -a); } }
// 연못 (타원) + 돌 테두리
function pond(h, P, x, z, rx, rz) {
  const w = mesh(h.site, new THREE.CircleGeometry(1, 36), R.water, x, .035, z, false); w.rotation.x = -Math.PI / 2; w.scale.set(rx, rz, 1);
  const n = Math.round((rx + rz) * 6); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; P.box(.42, .2, .26, h.MAT.stoneDark, x + Math.cos(a) * (rx + .12), .1, z + Math.sin(a) * (rz + .12), -a + Math.PI / 2); }
  h.col(x, z, rx * .8, rz * .8);
}

/* ───────── 법당 앞 석등 바꾸기 (법주사 쌍사자석등 · 화엄사 큰 석등) ───────── */
export function buildLantern(h, kind, z) {
  const P = parts(), G = R.granite, G2 = R.granite2, F = h.MAT.fire;
  if (kind === 'lion2') { // 법주사 쌍사자석등: 두 사자가 마주 보고 뒷발로 서서 앞발·머리로 윗돌을 받침
    P.cyl(.6, .64, .16, 8, G2, 0, .08, 0); P.cyl(.48, .58, .18, 8, G, 0, .25, 0);
    for (let i = 0; i < 8; i++) { const a = (i + .5) / 8 * Math.PI * 2; P.ball(.11, G, Math.sin(a) * .46, .36, Math.cos(a) * .46, 1.4, .45, 1.4); } // 복련
    P.cyl(.3, .36, .1, 8, G2, 0, .4, 0);
    for (const s of [-1, 1]) {
      const bx = s * .2;
      P.ball(.17, G, bx, .7, 0, 1, 1.55, 1.05, 1);                 // 몸통 (위로 섬)
      P.ball(.13, G, bx * .78, .98, 0, 1.05, 1, 1, 1);             // 가슴
      P.ball(.12, G, bx * .55, 1.18, 0, 1, 1, 1, 1);               // 머리 (안쪽으로 맞닿음)
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; P.ball(.055, G2, bx * .62 + s * Math.cos(a) * .04, 1.18 + Math.sin(a) * .1, Math.cos(a) * .1, 1, 1, 1); } // 갈기
      P.ball(.05, G2, bx * .3, 1.14, 0, 1.2, .8, 1);                // 주둥이
      for (const dz of [-.09, .09]) P.limb(G, V(bx, .56, dz), V(bx * 1.12, .44, dz), .06, .055);   // 뒷다리
      for (const dz of [-.08, .08]) P.limb(G, V(bx * .78, 1.0, dz), V(bx * .25, 1.27, dz), .045, .04); // 앞발을 들어 받침
      P.limb(G2, V(bx * 1.3, .55, 0), V(bx * 1.8, .8, -.05), .035, .02);                               // 꼬리
    }
    P.cyl(.4, .28, .12, 8, G, 0, 1.36, 0);                                 // 상대석 (앙련)
    P.cyl(.25, .25, .38, 8, G, 0, 1.61, 0); P.box(.36, .2, .52, F, 0, 1.61, 0); P.box(.52, .2, .36, F, 0, 1.61, 0); // 화사석 · 불빛 창
    P.cyl(.5, .5, .05, 8, G2, 0, 1.83, 0); P.cyl(.12, .5, .16, 8, G2, 0, 1.93, 0);   // 옥개석
    P.cyl(.07, .1, .12, 8, G, 0, 2.07, 0); P.ball(.08, G, 0, 2.18, 0, 1, 1.2, 1);    // 상륜
    const g = grp(h, 0, z); P.flush(g); h.col(0, z, .62, .62);
    return { name: '법주사 쌍사자석등', story: '국보 · 두 사자가 뒷발로 서서 석등을 받치고 있어요' };
  }
  if (kind === 'giant') { // 화엄사 각황전 앞 큰 석등: 장구 모양 기둥(고복형), 크게 들린 지붕돌 귀꽃
    P.cyl(.98, 1.04, .2, 8, G2, 0, .1, 0); P.cyl(.82, .92, .24, 8, G, 0, .32, 0);
    for (let i = 0; i < 8; i++) { const a = (i + .5) / 8 * Math.PI * 2; P.ball(.2, G, Math.sin(a) * .7, .5, Math.cos(a) * .7, 1.3, .45, 1.3); } // 복련
    P.cyl(.5, .66, .14, 8, G2, 0, .6, 0);
    P.cyl(.2, .24, .5, 8, G, 0, .92, 0); P.ball(.34, G, 0, 1.3, 0, 1, .72, 1, 1); P.cyl(.24, .2, .5, 8, G, 0, 1.68, 0); // 장구 모양 기둥
    P.cyl(.72, .42, .2, 8, G, 0, 2.03, 0);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; P.ball(.18, G, Math.sin(a) * .62, 2.1, Math.cos(a) * .62, 1.3, .5, 1.3); } // 앙련
    P.cyl(.4, .4, .62, 8, G, 0, 2.45, 0); P.box(.56, .34, .9, F, 0, 2.45, 0); P.box(.9, .34, .56, F, 0, 2.45, 0); // 화사석 · 불빛 창
    P.cyl(.95, .95, .06, 8, G2, 0, 2.79, 0); P.cyl(.2, .95, .3, 8, G2, 0, 2.97, 0); // 옥개석
    for (let i = 0; i < 8; i++) { const a = (i + .5) / 8 * Math.PI * 2; P.ball(.08, G2, Math.sin(a) * .9, 2.88, Math.cos(a) * .9, 1, 1.5, 1); } // 귀꽃
    P.cyl(.14, .18, .18, 8, G, 0, 3.2, 0); P.ball(.16, G, 0, 3.42, 0, 1, .8, 1); P.ball(.1, G, 0, 3.62, 0); // 상륜
    const g = grp(h, 0, z); P.flush(g); h.col(0, z, 1.0, 1.0);
    return { name: '화엄사 각황전 앞 석등', story: '국보 · 우리나라에서 가장 큰 석등이에요' };
  }
  return null;
}

/* ───────── 사찰 상징물 ───────── */
export function buildItems(h, T) {
  const list = (T.style && T.style.items) || [], out = { spots: [] }; if (!list.length) return out;
  const { L, D, YX, YZ1 } = h, k = K(), rnd = rng(T.name);
  const SX = L / 2 + 3.25, FZ = D / 2 + 10.4, FX = L / 4 + 4.6; // 법당 옆 마당 가운데 · 앞마당 양옆(탑 높이) 자리
  const spot = (g, ox, oz, r, name, story) => { const [lx, lz] = toSite(g, ox, oz); out.spots.push({ lx, lz, r, name, story }); };
  const spotAt = (lx, lz, r, name, story) => out.spots.push({ lx, lz, r, name, story });
  const RIGHT = -Math.PI / 2, LEFT = Math.PI / 2; // 앞마당 오른쪽 자리는 길(왼쪽)을, 왼쪽 자리는 길(오른쪽)을 바라봄
  for (const kind of list) {
    if (kind === 'panjeon') { // 봉은사 판전: 맞배지붕 전각 + 추사가 떠나기 사흘 전 쓴 '板殿' 현판
      const g = grp(h, FX, FZ, RIGHT);
      smallHall(h, g, { w: 3.6, d: 2.4, hh: 1.7, gable: true, roofH: .95, plaque: '板殿', plaqueW: 1.0 });
      colG(h, g, 0, 0, 2.1, 1.5);
      signpost(h, ...toSite(g, -2.6, 1.9), RIGHT, '판전', '추사 김정희가 세상을 떠나기 사흘 전에 쓴 현판');
      spot(g, 0, 2.2, 3.4, '봉은사 판전', '추사 김정희가 세상을 떠나기 사흘 전에 쓴 ‘판전’ 현판이 걸려 있어요');
    }
    if (kind === 'yongjuBell') { // 용주사 동종: 작은 종각에 모신 국보 범종 (치지 않고 보기만)
      const g = grp(h, -FX, FZ, LEFT), P = parts();
      P.box(2.8, .25, 2.8, h.MAT.stone, 0, .125, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.cyl(.1, .11, 2.4, 8, R.redCol, sx * 1.15, 1.45, sz * 1.15);
      P.box(2.5, .16, .16, R.redCol, 0, 2.5, 0); P.box(2.5, .12, 2.5, R.band, 0, 2.62, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(.08, .5, .08, R.lattice, sx * 1.15, .5, sz * .6), P.box(.08, .5, .08, R.lattice, sx * .6, .5, sz * 1.15);
      for (const [a, b] of [[[-1.15, 1.15], [1.15, 1.15]], [[-1.15, -1.15], [1.15, -1.15]], [[-1.15, -1.15], [-1.15, 1.15]], [[1.15, -1.15], [1.15, 1.15]]]) { const cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]); P.box(a[0] === b[0] ? .07 : len, .07, a[0] === b[0] ? len : .07, R.lattice, cx, .72, cz); } // 낮은 난간
      P.flush(g);
      const roof = mesh(g, hipRoofGeo(THREE, 3.6, 3.6, 1.1, .4, .3), R.roofTile, 0, 2.68, 0); roof.receiveShadow = false;
      const S = .95, prof = [[0, 0], [.6, 0], [.59, .05], [.55, .16], [.5, .48], [.46, .86], [.42, 1.08], [.36, 1.18], [.22, 1.24], [0, 1.25]].map(([r, y]) => new THREE.Vector2(r * S, y * S));
      const bellM = new THREE.MeshStandardMaterial({ color: '#5a6246', metalness: .62, roughness: .42 });
      mesh(g, new THREE.LatheGeometry(prof, 40), bellM, 0, .62, 0);
      mesh(g, new THREE.CylinderGeometry(.04, .05, .5, 8), bellM, .12, .62 + 1.25 * S + .2, 0);                // 음통
      const loop = mesh(g, new THREE.TorusGeometry(.12, .035, 6, 14), bellM, -.05, .62 + 1.25 * S + .14, 0);     // 용뉴
      mesh(g, new THREE.CylinderGeometry(.02, .02, .26, 6), R.lattice, 0, 2.3, 0);
      for (const sx of [-1, 1]) { const f = mesh(g, new THREE.PlaneGeometry(.22, .34), new THREE.MeshStandardMaterial({ color: '#7d8460', metalness: .5, roughness: .5, side: THREE.DoubleSide }), sx * .44, 1.15, .02, false); f.rotation.y = sx * 1.2; } // 비천상 자리
      plate(h, g, '용주사 동종', 1.1, 0, 2.38, 1.36, { px: 40 });
      colG(h, g, 0, 0, 1.5, 1.5);
      signpost(h, ...toSite(g, 1.9, 1.7), LEFT, '국보 · 용주사 동종', '하늘을 나는 비천상이 새겨진 범종');
      spot(g, 0, 2.2, 3.4, '용주사 동종', '국보 · 하늘을 나는 비천상과 삼존상이 새겨진 범종이에요');
    }
    if (kind === 'hyohaeng') { // 용주사 효행 이야기: 부모은중경 열 가지 은혜 판
      const g = grp(h, FX, FZ, RIGHT), P = parts();
      const B = boardTex('효행 이야기', ['*정조가 아버지 사도세자를 위해 세운 효심의 절', '*부모은중경 — 부모님의 열 가지 은혜',
        '1  아이를 품어 지키고 보호해 주신 은혜', '2  낳으실 때 큰 고통을 겪으신 은혜', '3  자식을 낳고 근심을 잊으신 은혜', '4  쓴 것은 삼키고 단 것은 먹여 주신 은혜', '5  마른자리 아기 누이고 젖은 자리 누우신 은혜',
        '6  젖을 먹여 길러 주신 은혜', '7  더러운 것을 씻어 주신 은혜', '8  먼 길 떠나면 걱정하시는 은혜', '9  자식 위해 궂은일도 마다 않으신 은혜', '10 끝까지 가엾이 여기시는 은혜'], { size: 31, gap: 50 });
      const bw = 2.6, bh = bw * B.ratio;
      for (const sx of [-1, 1]) P.cyl(.06, .07, bh + .75, 8, h.MAT.trunk, sx * (bw / 2 + .02), (bh + .75) / 2, 0);
      P.box(bw + .14, bh + .1, .06, h.MAT.trunk, 0, .6 + bh / 2, -.04);
      P.flush(g);
      mesh(g, new THREE.PlaneGeometry(bw, bh), new THREE.MeshStandardMaterial({ map: B.tex, roughness: .7 }), 0, .6 + bh / 2, .0, false);
      const r = mesh(g, gableRoofGeo(THREE, bw + .7, .9, .32, .08), R.roofTile, 0, .65 + bh + .08, 0); r.receiveShadow = false;
      colG(h, g, 0, 0, bw / 2 + .1, .2);
      spot(g, 0, 1.4, 3.0, '용주사 효행 이야기', '정조가 아버지 사도세자를 위해 세운 절 · 부모은중경의 열 가지 은혜를 읽어 보세요');
    }
    if (kind === 'lotusPond') { // 봉선사 연꽃단지: 길 양옆 연못에 연잎과 분홍 연꽃
      const P = parts();
      for (const s of [-1, 1]) {
        const cx = s * FX, cz = FZ, rx = 2.3, rz = 2.4;
        pond(h, P, cx, cz, rx, rz);
        for (let i = 0; i < 30; i++) { const a = rnd() * 6.28, rr = Math.sqrt(rnd()) * .9, px = cx + Math.cos(a) * rx * rr, pz = cz + Math.sin(a) * rz * rr, pr = .16 + rnd() * .18, up = rnd() < .3;
          const pd = new THREE.CylinderGeometry(pr, pr, .02, 12, 1, false, .3, 5.9); pd.rotateY(rnd() * 6); pd.translate(px, up ? .25 + rnd() * .25 : .055, pz); P.put(pd, rnd() < .5 ? k.pad : k.pad2);
          if (up) P.limb(k.stem, V(px, .03, pz), V(px, .25, pz), .012, .012, 4); }
        for (let i = 0; i < 11; i++) { const a = rnd() * 6.28, rr = Math.sqrt(rnd()) * .8, px = cx + Math.cos(a) * rx * rr, pz = cz + Math.sin(a) * rz * rr, fy = .35 + rnd() * .35;
          P.limb(k.stem, V(px, .03, pz), V(px, fy, pz), .014, .012, 4);
          if (rnd() < .3) { P.ball(.07, k.lotus, px, fy + .07, pz, .8, 1.5, .8); continue; } // 봉오리
          for (let j = 0; j < 7; j++) { const b = j / 7 * 6.28; const pt = new THREE.SphereGeometry(.09, 8, 6); pt.scale(.55, 1.15, .32); pt.rotateZ(.55); pt.rotateY(b); pt.translate(px + Math.cos(b) * .06, fy + .07, pz - Math.sin(b) * .06); P.put(pt, k.lotus); }
          P.cyl(.04, .035, .04, 8, k.lotusC, px, fy + .06, pz); }
        for (let i = 0; i < 9; i++) { const a = rnd() * 6.28, px = cx + Math.cos(a) * (rx + .05), pz = cz + Math.sin(a) * (rz + .05); P.limb(k.reed, V(px, 0, pz), V(px + (rnd() - .5) * .2, .7 + rnd() * .4, pz + (rnd() - .5) * .2), .02, .008, 3); }
      }
      P.flush(h.site);
      signpost(h, -FX + 1.2, FZ + 3.0, LEFT * 0, '연꽃단지', '여름이면 연못 가득 연꽃이 피어요');
      spotAt(-FX, FZ, 3.6, '봉선사 연꽃단지', '여름이면 연못 가득 분홍 연꽃이 피어요'); spotAt(FX, FZ, 3.6, '봉선사 연꽃단지', '여름이면 연못 가득 분홍 연꽃이 피어요');
    }
    if (kind === 'kimgu') { // 마곡사 백범 명상길: 백범당 + 김구 선생이 심은 향나무 + 디딤돌 길
      const g = grp(h, FX, FZ, RIGHT);
      smallHall(h, g, { w: 3.0, d: 2.2, hh: 1.5, roofH: .85, plaque: '백범당', plaqueW: 1.0 });
      colG(h, g, 0, 0, 1.75, 1.35);
      const P = parts(), [jx, jz] = toSite(g, 2.4, .3); // 향나무: 굽은 줄기에 뭉게뭉게 짙은 잎
      P.limb(k.bark2, V(jx, 0, jz), V(jx + .2, 1.1, jz - .1), .16, .12, 6); P.limb(k.bark2, V(jx + .2, 1.1, jz - .1), V(jx - .1, 2.0, jz + .1), .12, .07, 6);
      for (const [dx, dy, dz, r] of [[.2, 1.3, 0, .55], [-.25, 1.75, .15, .5], [.1, 2.25, 0, .42], [.4, 1.9, -.2, .36], [-.1, 2.6, 0, .28]]) P.ball(r, rnd() < .5 ? k.juniper : k.juniper2, jx + dx, dy, jz + dz, 1, .8, 1, 1);
      h.col(jx, jz, .3, .3);
      for (let x = 1.8; x < FX - 1.8; x += .62) P.ball(.2, h.MAT.stoneDark, x, .03, FZ + Math.sin(x * 1.7) * .2, 1.2, .25, 1);           // 길에서 백범당까지 디딤돌
      for (let z = D / 2 + 6.6; z > -D / 2 + 1.4; z -= .62) P.ball(.2, h.MAT.stoneDark, SX + Math.sin(z * 1.3) * .35, .03, z, 1.2, .25, 1); // 법당 옆 명상길
      P.box(1.2, .12, .4, R.wood, SX + .9, .42, -D / 2 + 1.2); for (const dx of [-.45, .45]) P.box(.1, .4, .3, R.wood, SX + .9 + dx, .2, -D / 2 + 1.2); h.col(SX + .9, -D / 2 + 1.2, .65, .25); // 쉬어 가는 의자
      P.flush(h.site);
      signpost(h, ...toSite(g, -2.6, 1.7), RIGHT, '백범 명상길', '김구 선생이 출가해 머물던 곳 · 백범당과 향나무');
      spot(g, 0, 2.2, 3.6, '마곡사 백범 명상길', '김구 선생이 머리를 깎고 머물던 곳이에요 · 백범당 옆 향나무는 선생이 심었어요');
      spotAt(SX, -D / 2 + 2, 2.2, '백범 명상길', '법당 옆 디딤돌을 따라 천천히 걸어 보세요');
    }
    if (kind === 'maaebul') { // 선운사 도솔암 마애불: 바위 절벽에 새긴 앉은 부처님 (불상 모델을 반쯤 바위에 묻어 돋을새김처럼)
      const x = -(L / 2 + 3.4), z = -D / 2 + 1.1, P = parts();
      P.box(3.9, 4.2, 1.2, R.rock2, x, 2.1, z - .35);
      for (const [dx, dy, dz, r] of [[-1.5, 1.2, .1, .85], [1.5, 1.4, 0, .9], [-1.4, 3.2, -.1, .85], [1.45, 3.3, -.2, .9], [0, 4.3, -.3, 1.2], [-.8, 4.1, -.2, .8], [.9, 4.2, -.3, .85], [-1.7, .4, .2, .55], [1.7, .45, .2, .55]]) P.ball(r, rnd() < .5 ? R.rock : R.rock2, x + dx, dy, z + dz, 1, 1, .7);
      P.box(2.6, 3.3, .1, M('#9a958b'), x, 2.0, z + .27); // 깎아 다듬은 면
      P.box(2.2, .45, 1.3, R.granite2, x, .225, z + .75); // 부처님을 모신 돌단
      P.flush(h.site);
      const halo = mesh(h.site, new THREE.TorusGeometry(.55, .045, 6, 28), M('#8a857b'), x, 2.55, z + .33); const halo2 = mesh(h.site, new THREE.TorusGeometry(1.15, .05, 6, 32), M('#8a857b'), x, 1.85, z + .33); halo2.scale.y = 1.3; // 머리 광배 · 몸 광배
      const ph = new THREE.Group(); ph.position.set(x, .45, z + .7); h.site.add(ph);
      mesh(ph, new THREE.SphereGeometry(.6, 14, 10), M('#a19b90'), 0, .5, 0).scale.set(1.2, .8, .5);
      mesh(ph, new THREE.SphereGeometry(.42, 14, 10), M('#a19b90'), 0, 1.25, 0).scale.set(1, 1.2, .5);
      mesh(ph, new THREE.SphereGeometry(.28, 14, 10), M('#a19b90'), 0, 1.85, 0).scale.set(1, 1.1, .6);
      h.fig.push({ k: 'amita', tint: 'stone', lx: x, ly: .45, lz: z + .62, h: 2.4, ry: 0, ph: [ph] });
      h.col(x, z + .1, 2.1, 1.15);
      signpost(h, x + 1.9, z + 1.6, 0, '도솔암 마애불', '도솔산 절벽에 새긴 큰 부처님');
      spotAt(x, z + 1.2, 3.0, '선운사 도솔암 마애불', '도솔산 절벽에 새긴 큰 부처님 · 고려 때 새긴 것으로 전해져요');
    }
    if (kind === 'bisarigusi') { // 송광사 비사리구시: 통나무 속을 파낸 커다란 밥통
      const g = grp(h, FX, FZ, RIGHT), P = parts(), len = 4.0, r = .55;
      const sh = new THREE.CylinderGeometry(r, r, len, 18, 1, true, Math.PI, Math.PI); sh.rotateZ(Math.PI / 2); sh.translate(0, .95, 0); P.put(sh, k.plank2); // 아래쪽 반원 통 (x 방향으로 눕힘, 위가 열림)
      for (const sx of [-1, 1]) { const cap = new THREE.CircleGeometry(r, 18, Math.PI, Math.PI); cap.rotateY(sx * Math.PI / 2); cap.translate(sx * len / 2, .95, 0); P.put(cap, k.plank2); }
      P.box(len - .1, .05, r * 1.4, k.inside, 0, .5, 0); // 안쪽 바닥
      for (const dz of [-1, 1]) P.box(len, .07, .09, R.lattice, 0, .95, dz * r); // 위 테두리
      for (const sx of [-1.2, 1.2]) { P.box(.5, .42, 1.25, R.granite2, sx, .21, 0); }
      for (let i = 0; i < 18; i++) P.ball(.12, k.rice, (rnd() - .5) * (len - .6), .62, (rnd() - .5) * .6, 1.2, .45, 1.2); // 밥알 대신 하얀 밥
      P.flush(g);
      colG(h, g, 0, 0, len / 2 + .1, .65);
      signpost(h, ...toSite(g, -1.6, 1.4), RIGHT, '비사리구시', '4,000명이 먹을 밥을 담던 나무 밥통');
      spot(g, 0, 1.4, 3.4, '송광사 비사리구시', '4,000명이 먹을 밥을 담던 나무 밥통이에요');
    }
    if (kind === 'hongmae') { // 화엄사 각황전 곁 홍매화
      const P = parts(), x = SX, z = D / 2 - 1.6;
      blossomTree(P, rnd, x, z, 1.15, k.red, k.red2); stoneRing(P, x, z, 1.05, h.MAT.stoneDark); P.flush(h.site);
      h.col(x, z, .35, .35);
      signpost(h, x - 1.0, z + 1.6, 0, '각황전 홍매화', '봄이면 각황전 곁에 짙붉게 피는 매화', 1.4);
      spotAt(x, z + 1, 2.8, '화엄사 홍매화', '봄이면 각황전 곁에 짙붉은 매화가 피어요');
    }
    if (kind === 'iljiam') { // 대흥사 일지암: 초의선사가 차를 가꾸던 초가 + 작은 연못 · 찻자리
      const g = grp(h, FX, FZ, RIGHT);
      smallHall(h, g, { w: 2.6, d: 2.0, hh: 1.35, roofH: .9, thatch: true, plaque: '일지암', plaqueW: .9 });
      colG(h, g, 0, 0, 1.55, 1.25);
      const P = parts(), [px, pz] = toSite(g, -2.1, .6), [tx, tz] = toSite(g, .2, 2.0);
      pond(h, P, px, pz, .75, .6);
      P.box(.7, .32, .5, R.granite2, tx, .16, tz); P.cyl(.06, .05, .08, 10, k.white, tx - .12, .36, tz); P.cyl(.06, .05, .08, 10, k.white, tx + .12, .36, tz); P.cyl(.09, .08, .12, 10, k.tea, tx, .38, tz - .1);
      for (const s of [-1, 1]) { const [cx, cz] = toSite(g, .2 + s * .65, 2.0); P.box(.36, .07, .36, k.cushion, cx, .035, cz); }
      for (let i = 0; i < 7; i++) { const [bx, bz] = toSite(g, -1.6 + i * .5, -1.6); P.ball(.32, k.tea, bx, .28, bz, 1, .7, 1, 1); } // 뒤뜰 차나무
      P.flush(h.site); h.col(tx, tz, .4, .3);
      signpost(h, ...toSite(g, 2.2, 1.7), RIGHT, '일지암', '초의선사가 차를 가꾸며 머물던 차의 성지');
      spot(g, 0, 2.2, 3.4, '대흥사 일지암', '초의선사가 차를 가꾸며 머물던 곳 · 우리 차 문화의 성지예요');
    }
    if (kind === 'hyeonpan') { // 대흥사 현판 이야기: 무량수각 (추사 현판 자리) + 현판 안내판
      const g = grp(h, -FX, FZ - .4, LEFT);
      smallHall(h, g, { w: 3.2, d: 2.2, hh: 1.6, roofH: .9, plaque: '無量壽閣', plaqueW: 1.3 });
      colG(h, g, 0, 0, 1.85, 1.35);
      const B = boardTex('대흥사 현판 이야기', ['*옛 명필의 글씨가 걸린 절', '대웅보전  —  원교 이광사', '무량수각  —  추사 김정희', '표충사  —  정조 임금'], { size: 36, gap: 62 });
      const gb = grp(h, ...toSite(g, -2.7, .4), LEFT), bw = 1.6, bh = bw * B.ratio, P = parts();
      for (const sx of [-1, 1]) P.cyl(.05, .06, bh + .6, 8, h.MAT.trunk, sx * (bw / 2 + .02), (bh + .6) / 2, 0); P.flush(gb);
      mesh(gb, new THREE.PlaneGeometry(bw, bh), new THREE.MeshStandardMaterial({ map: B.tex, roughness: .7 }), 0, .55 + bh / 2, .02, false);
      colG(h, gb, 0, 0, bw / 2 + .1, .15);
      spot(g, 0, 2.2, 3.6, '대흥사 현판 이야기', '대웅보전은 원교 이광사, 무량수각은 추사 김정희, 표충사는 정조 임금의 글씨예요');
    }
    if (kind === 'gobulmae') { // 백양사 고불매
      const P = parts(), x = -SX, z = D / 2 - 1.6;
      blossomTree(P, rnd, x, z, 1.2, k.pink, k.pink2, { spread: 1.1 }); stoneRing(P, x, z, 1.1, h.MAT.stoneDark); P.flush(h.site);
      h.col(x, z, .35, .35);
      signpost(h, x + 1.0, z + 1.6, 0, '고불매', '천연기념물 · 봄마다 연분홍 꽃을 피우는 오래된 매화', 1.4);
      spotAt(x, z + 1, 2.8, '백양사 고불매', '천연기념물 · 봄마다 연분홍 꽃을 피우는 오래된 매화예요');
    }
    if (kind === 'seonammae') { // 선암사 선암매
      const P = parts(), x = -SX, z = D / 2 - 1.6;
      blossomTree(P, rnd, x, z, 1.25, k.white, k.white2, { spread: 1.15, lean: .45 }); stoneRing(P, x, z, 1.1, h.MAT.stoneDark); P.flush(h.site);
      h.col(x, z, .35, .35);
      signpost(h, x + 1.0, z + 1.6, 0, '선암매', '천연기념물 · 수백 년 된 매화', 1.3);
      spotAt(x, z + 1, 2.8, '선암사 선암매', '천연기념물 · 수백 년 동안 봄마다 꽃을 피워 온 매화예요');
    }
    if (kind === 'samindang') { // 선암사 삼인당: 길쭉한 알 모양 연못 속 작은 섬
      const P = parts(), cx = -FX, cz = FZ, rx = 1.7, rz = 2.6;
      pond(h, P, cx, cz, rx, rz);
      P.ball(.62, M('#7d8c5a'), cx, .02, cz - 1.2, 1, .35, 1, 1); P.ball(.5, h.MAT.stoneDark, cx, .0, cz - 1.2, 1.1, .2, 1.1);
      P.limb(k.bark, V(cx, .1, cz - 1.2), V(cx + .1, 1.0, cz - 1.25), .07, .05, 5);
      for (const [dx, dy, dz, r] of [[0, 1.2, 0, .45], [.25, 1.0, .1, .35], [-.25, 1.05, -.1, .35]]) P.ball(r, k.leaf, cx + dx, dy, cz - 1.2 + dz, 1, .8, 1, 1);
      P.flush(h.site);
      signpost(h, cx + 1.4, cz + 3.0, 0, '삼인당', '알 모양 연못 속 작은 섬 · 도선국사가 만들었다고 전해요');
      spotAt(cx, cz, 3.4, '선암사 삼인당', '길쭉한 알 모양 연못 가운데 작은 섬이 있어요 · 도선국사가 만들었다고 전해져요');
    }
    if (kind === 'cheongun') { // 불국사 청운교·백운교: 돌 축대 위 자하문으로 오르는 두 단 돌계단 (아래 무지개 홍예)
      const x = -(L / 2 + 3.35), zc = -1.7, TW = 4.2, TD = 2.4, TH2 = 1.9, P = parts();
      P.box(TW, TH2, TD, R.granite2, x, TH2 / 2, zc);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) P.box(TW / 4 - .06, TH2 / 3 - .06, .04, R.granite, x - TW / 2 + TW / 8 + i * TW / 4, (j + .5) * TH2 / 3, zc + TD / 2 + .01); // 축대 돌
      P.box(TW + .2, .12, TD + .2, R.granite, x, TH2 + .06, zc);
      const SW = 1.2, n1 = 9, n2 = 9, rise = TH2 / (n1 + n2), run = .2, z0 = zc + TD / 2; // 위 청운교(축대 쪽) · 아래 백운교
      for (let i = 0; i < n2; i++) P.box(SW, rise, run, R.granite, x, TH2 - rise * (i + .5), z0 + run * (i + .5));          // 청운교
      const zl = z0 + run * n2, land = .45; P.box(SW, rise * n1, land, R.granite, x, rise * n1 / 2, zl + land / 2);             // 층계참
      for (let i = 0; i < n1; i++) P.box(SW, rise, run, R.granite, x, rise * n1 - rise * (i + .5), zl + land + run * (i + .5)); // 백운교
      const zEnd = zl + land + run * n1;
      for (const sx of [-1, 1]) { P.limb(R.granite2, V(x + sx * (SW / 2 + .06), TH2 + .2, z0), V(x + sx * (SW / 2 + .06), rise * n1 + .2, zl), .06, .06, 6); P.limb(R.granite2, V(x + sx * (SW / 2 + .06), rise * n1 + .2, zl + land), V(x + sx * (SW / 2 + .06), .25, zEnd), .06, .06, 6); }
      P.flush(h.site);
      for (const [zz, rr] of [[(zl + land + zEnd) / 2, .42], [(z0 + zl) / 2, .5]]) { const a = mesh(h.site, new THREE.TorusGeometry(rr, .09, 6, 14, Math.PI), R.granite, x, 0, zz); a.rotation.y = Math.PI / 2; } // 홍예
      const g = grp(h, x, zc - .1);
      const gate = new THREE.Group(); gate.position.y = TH2 + .12; g.add(gate);
      smallHall(h, gate, { w: 2.2, d: 1.5, hh: 1.3, roofH: .7, open: 1.0, plaque: '紫霞門', plaqueW: .9 });
      h.col(x, (zc - TD / 2 + zEnd) / 2, TW / 2, (zEnd - zc + TD / 2) / 2);
      signpost(h, x + 1.75, zEnd + .6, 0, '청운교 · 백운교', '자하문으로 오르는 33계단 돌다리 (국보)', 1.5);
      spotAt(x, zEnd + .4, 3.0, '불국사 청운교 · 백운교', '국보 · 자하문으로 오르는 33계단 돌다리예요 · 아래에 무지개 모양 홍예가 있어요');
    }
    if (kind === 'cheonbul') { // 직지사 천불전: 앞을 열어 둔 전각 안 층층이 앉은 하얀 작은 부처님들
      const g = grp(h, -FX, FZ, LEFT), w = 4.0, d = 2.8, hh = 2.0;
      smallHall(h, g, { w, d, hh, roofH: 1.0, open: 3.0, plaque: '천불전', plaqueW: 1.0 });
      colG(h, g, 0, 0, w / 2 + .3, d / 2 + .3);
      const P = parts(); for (let t = 0; t < 6; t++) P.box(w - .4, .1, .26, R.wood, 0, .42 + t * .27, -d / 2 + .25 + t * 0 ); // 뒤 단
      for (const sx of [-1, 1]) for (let t = 0; t < 6; t++) P.box(.26, .1, d - .6, R.wood, sx * (w / 2 - .27), .42 + t * .27, -.1);
      P.box(.9, .45, .6, R.redCol, 0, .52, -d / 2 + .75); P.flush(g);
      const one = mergeGeometries([new THREE.ConeGeometry(.045, .07, 8).translate(0, .035, 0), new THREE.SphereGeometry(.022, 8, 6).translate(0, .09, 0)]);
      const spots = [];
      for (let t = 0; t < 6; t++) for (let i = 0; i < 34; i++) spots.push([-w / 2 + .32 + i * (w - .64) / 33, .47 + t * .27, -d / 2 + .25]);
      for (const sx of [-1, 1]) for (let t = 0; t < 6; t++) for (let i = 0; i < 18; i++) spots.push([sx * (w / 2 - .27), .47 + t * .27, -d / 2 + .5 + i * (d - 1.1) / 17]);
      const im = new THREE.InstancedMesh(one, k.buddhaW, spots.length), m4 = new THREE.Matrix4();
      spots.forEach(([px, py, pz], i) => { m4.makeTranslation(px, py, pz); im.setMatrixAt(i, m4); }); g.add(im);
      const ph = new THREE.Group(); ph.position.set(0, .75, -d / 2 + .75); g.add(ph); mesh(ph, new THREE.SphereGeometry(.22, 12, 8), R.gold, 0, .2, 0).scale.set(1.2, .9, .9); mesh(ph, new THREE.SphereGeometry(.14, 12, 8), R.gold, 0, .5, 0);
      const [fx, fz] = toSite(g, 0, -d / 2 + .75); h.fig.push({ k: 'sakya', tint: 'gold', lx: fx, ly: .75, lz: fz, h: .85, ry: g.rotation.y, ph: [ph] });
      signpost(h, ...toSite(g, -2.6, 1.7), LEFT, '천불전', '천 분의 부처님을 모신 법당');
      spot(g, 0, 2.4, 3.6, '직지사 천불전', '층층이 앉은 하얀 부처님들 · 천 분의 부처님을 모신 법당이에요');
    }
    if (kind === 'chusa') { // 은해사 추사 현판: 보화루(2층 누각) + 불광 현판 + 안내판
      const g = grp(h, FX, FZ, RIGHT), w = 4.0, d = 2.6, P = parts();
      P.box(w + .4, .25, d + .4, h.MAT.stone, 0, .125, 0);
      for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) P.cyl(.13, .15, 1.4, 8, R.granite2, sx * w / 2, .95, sz * d / 2); // 아래층 돌기둥 (아래로 지나다님)
      P.box(w + .2, .14, d + .2, R.wood, 0, 1.72, 0);
      P.box(w, 1.25, d, k.wallW, 0, 2.42, 0); P.box(w * .7, .7, .05, R.lattice, 0, 2.4, d / 2 + .02);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.cyl(.08, .09, 1.25, 8, R.redCol, sx * w / 2, 2.42, sz * d / 2);
      P.box(w + .06, .14, d + .06, R.band, 0, 3.0, 0); P.flush(g);
      const roof = mesh(g, hipRoofGeo(THREE, w + 1.4, d + 1.4, 1.0, w - d * .6, .28), R.roofTile, 0, 3.05, 0); roof.receiveShadow = false;
      plate(h, g, '寶華樓', 1.2, 0, 2.86, d / 2 + .1, { px: 50 });
      for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) colG(h, g, sx * w / 2, sz * d / 2, .2, .2);
      const gb = grp(h, -FX, FZ, LEFT), Q = parts(); // 불광 현판 (큰 글씨)
      for (const sx of [-1, 1]) Q.cyl(.07, .08, 2.3, 8, R.redCol, sx * 1.1, 1.15, 0); Q.box(2.5, .12, .5, R.band, 0, 2.32, 0); Q.flush(gb);
      mesh(gb, gableRoofGeo(THREE, 3.0, 1.2, .38, .1), R.roofTile, 0, 2.38, 0).receiveShadow = false;
      plate(h, gb, '佛光', 1.7, 0, 1.75, .06, { px: 62 });
      colG(h, gb, 0, 0, 1.25, .2);
      signpost(h, ...toSite(gb, 0, 1.6), LEFT, '추사 김정희의 글씨', '대웅전 · 보화루 · 불광 현판이 은해사에 전해요', 1.6);
      spot(g, 0, 2.4, 3.6, '은해사 보화루', '‘보화루’ 현판은 추사 김정희의 글씨예요'); spot(gb, 0, 1.6, 3.2, '은해사 불광 현판', '추사 김정희가 크게 쓴 ‘불광’ · 은해사에는 추사의 현판이 여럿 전해요');
    }
    if (kind === 'jajangmae') { // 통도사 자장매
      const P = parts(), x = SX, z = D / 2 - 1.6;
      blossomTree(P, rnd, x, z, 1.15, k.red2, k.pink, { spread: 1.05 }); stoneRing(P, x, z, 1.05, h.MAT.stoneDark); P.flush(h.site);
      h.col(x, z, .35, .35);
      signpost(h, x - 1.0, z + 1.6, 0, '자장매', '자장율사의 뜻을 기려 이름 붙인 홍매', 1.4);
      spotAt(x, z + 1, 2.8, '통도사 자장매', '통도사를 세운 자장율사를 기려 이름 붙인 홍매화예요');
    }
    if (kind === 'wisteria') { // 범어사 등나무 군락: 시렁 위로 뒤엉킨 등나무 줄기와 늘어진 보랏빛 꽃송이 (아래로 걸어 들어갈 수 있음)
      const cx = -FX, cz = FZ, P = parts(), Q = parts(), W2 = 1.4, D2 = 2.2, PH = 2.3;
      for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) { P.cyl(.07, .08, PH, 8, R.wood, cx + sx * W2, PH / 2, cz + sz * D2); h.col(cx + sx * W2, cz + sz * D2, .12, .12); }
      for (const sx of [-1, 1]) P.box(.1, .1, D2 * 2 + .4, R.wood, cx + sx * W2, PH, cz);
      for (let i = 0; i < 7; i++) P.box(W2 * 2 + .4, .07, .07, R.wood, cx, PH + .08, cz - D2 + i * D2 / 3);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { // 기둥을 감고 오르는 줄기
        let p = V(cx + sx * (W2 - .25), 0, cz + sz * (D2 - .4));
        for (let j = 1; j <= 5; j++) { const a = j * 1.4, q = V(cx + sx * W2 + Math.cos(a) * .18, j * PH / 5, cz + sz * (D2 - .2) + Math.sin(a) * .18); P.limb(k.bark2, p, q, .07, .06, 5); p = q; }
        P.limb(k.bark2, p, V(cx, PH + .15, cz + sz * .4), .06, .04, 5);
      }
      for (let i = 0; i < 80; i++) Q.ball(.22 + rnd() * .16, rnd() < .35 ? k.leaf : rnd() < .5 ? k.leaf2 : k.wis2, cx + (rnd() - .5) * W2 * 2.4, PH + .2 + rnd() * .35, cz + (rnd() - .5) * D2 * 2.3, 1.3, .6, 1.3, 0);
      for (let i = 0; i < 170; i++) { const c = new THREE.ConeGeometry(.06 + rnd() * .03, .4 + rnd() * .35, 7); c.rotateX(Math.PI); c.translate(cx + (rnd() - .5) * W2 * 2.1, PH - .1 - rnd() * .12, cz + (rnd() - .5) * D2 * 2.05); Q.put(c, rnd() < .55 ? k.wis : k.wis2); }
      P.box(1.4, .1, .4, R.wood, cx, .42, cz); for (const dx of [-.55, .55]) P.box(.1, .42, .32, R.wood, cx + dx, .21, cz); h.col(cx, cz, .72, .22);
      P.flush(h.site, { noOcc: true }); Q.flush(h.site, { noOcc: true }); // 시렁 위 잎·꽃은 카메라 가림에서 뺌 (아래로 들어가도 카메라가 당겨지지 않게)
      signpost(h, cx + 1.9, cz + 2.9, 0, '등나무 군락', '금정산 범어사 계곡의 천연기념물 등나무 숲', 1.5);
      spotAt(cx, cz, 3.2, '범어사 등나무 군락', '천연기념물 · 봄이면 보랏빛 등꽃이 주렁주렁 늘어져요');
    }
    if (kind === 'jingamStele') { // 쌍계사 진감선사탑비: 거북 받침(귀부) 위 비석 + 용 머릿돌(이수)
      const g = grp(h, -FX, FZ, LEFT), P = parts(), G = R.granite2, S = k.stele;
      P.box(2.2, .2, 1.6, h.MAT.stone, 0, .1, 0);
      P.ball(.78, G, 0, .42, -.05, 1.05, .45, 1.35, 1);               // 거북 등
      P.ball(.28, G, 0, .45, .95, .9, .75, 1.2, 1);                   // 머리
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.ball(.18, G, sx * .7, .25, sz * .6, 1.2, .6, 1, 0); // 발
      for (let i = 0; i < 9; i++) P.ball(.12, R.granite, ((i % 3) - 1) * .32, .73, (Math.floor(i / 3) - 1) * .38 - .05, 1, .25, 1, 0); // 등 무늬
      P.box(.95, .14, .42, G, 0, .82, -.05);                          // 비좌
      P.box(.82, 1.75, .22, S, 0, 1.76, -.05);                        // 비신
      P.box(1.05, .42, .34, G, 0, 2.84, -.05);                        // 이수
      for (let i = 0; i < 6; i++) P.ball(.13, G, -.42 + i * .17, 3.08 + Math.sin(i * 1.3) * .05, -.05, 1, 1, 1.1, 0); // 서린 용
      P.flush(g);
      plate(h, g, '眞鑑禪師大空塔碑', .6, 0, 2.2, .07, { px: 30, cw: 900, bg: '#5d5a56', fg: '#e6e0d4' }).rotation.z = 0;
      colG(h, g, 0, 0, 1.0, .85);
      signpost(h, ...toSite(g, 1.9, 1.3), LEFT, '진감선사탑비', '국보 · 최치원이 글을 짓고 쓴 비', 1.4);
      spot(g, 0, 1.6, 3.2, '쌍계사 진감선사탑비', '국보 · 최치원이 글을 짓고 글씨도 쓴 비석이에요');
    }
    if (kind === 'cherryRoad') { // 쌍계사 십리벚꽃길: 일주문 밖 길 양옆 벚나무
      const P = parts();
      for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) { const x = sx * (3.3 + rnd() * .4), z = YZ1 + 4 + i * 3.4 + rnd() * .5; blossomTree(P, rnd, x, z, 1.25, k.cherry, k.cherry2, { spread: 1.2, lean: .2 }); h.col(x, z, .3, .3); }
      P.flush(h.site);
      signpost(h, -2.75, YZ1 + 1.7, 0, '십리벚꽃길', '화개장터에서 쌍계사까지 이어지는 벚꽃길', 1.5);
      spotAt(0, YZ1 + 8, 4.5, '쌍계사 십리벚꽃길', '화개장터에서 쌍계사까지 봄마다 벚꽃이 길을 덮어요');
    }
  }
  return out;
}
