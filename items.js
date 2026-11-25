// 사찰마다 간직한 상징물 (소개서의 '차례로 담을 모습'을 수월에 담음)
// 조계사 팔각십층석탑은 regional.js(탑), 금산사 미륵삼존은 regional.js(미륵전)에서 그림
// - 법당 앞 마당 양옆(탑 높이쯤, 길을 바라보게)과 법당 옆 마당에 놓음
// - 모두 코드로 그린 단순한 모양 (실제 사진·도면·글씨를 옮기지 않음, 현판 글씨도 보통 글꼴)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hipRoofGeo, gableRoofGeo } from './hall.js?v=16';
import { R, standingGwaneum, stoneTiers, paljakParts } from './regional.js?v=36';
import { stripUV, ensureUV } from './tex.js?v=5';
import { reliefStatue } from './relief.js?v=1';

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
  const put = (g, mat) => { const n = ensureUV(g.index ? g.toNonIndexed() : g); for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); n.clearGroups(); (L.get(mat) || L.set(mat, []).get(mat)).push(n); return n; };
  return {
    put,
    box: (w, hh, d, mat, x, y, z, ry = 0) => { const g = new THREE.BoxGeometry(w, hh, d); if (mat.userData.strip) stripUV(g, w, hh, d); if (ry) g.rotateY(ry); g.translate(x, y, z); return put(g, mat); },
    cyl: (rt, rb, hh, seg, mat, x, y, z) => { const g = new THREE.CylinderGeometry(rt, rb, hh, seg); if (seg === 8) g.rotateY(Math.PI / 8); g.translate(x, y, z); return put(g, mat); },
    ball: (r, mat, x, y, z, sx = 1, sy = 1, sz = 1, det = 0) => { const g = new THREE.IcosahedronGeometry(r, det); g.scale(sx, sy, sz); g.translate(x, y, z); return put(g, mat); },
    limb: (mat, a, b, r0, r1, seg = 6) => { const d = V(b.x - a.x, b.y - a.y, b.z - a.z), len = d.length(); const g = new THREE.CylinderGeometry(r1, r0, len, seg); g.translate(0, len / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z); return put(g, mat); },
    flush(parent, { shadow = true, noOcc = false } = {}) { const out = []; for (const [mat, gs] of L) { const m = new THREE.Mesh(mergeGeometries(gs), mat); m.castShadow = shadow; m.receiveShadow = true; if (noOcc) m.userData.noOcc = true; parent.add(m); out.push(m); } L.clear(); return out; },
  };
}
// 팔작지붕 붙이기: 그룹에 메시로(paljakMesh) · 합치는 부품에(paljakPut). 반환은 기와 메시
function paljakMesh(g, Lr, Wr, H, y, x = 0, z = 0) { let roof = null; for (const [geo, mat] of paljakParts(Lr, Wr, H)) { const m = mesh(g, geo, mat, x, y, z, mat !== R.under && mat !== R.eave); m.receiveShadow = mat !== R.under && mat !== R.roofTile; if (mat === R.roofTile) roof = m; } return roof; }
function paljakPut(P, Lr, Wr, H, x, y, z) { for (const [geo, mat] of paljakParts(Lr, Wr, H)) { geo.translate(x, y, z); P.put(geo, mat); } }
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
  (h.signs || (h.signs = [])).push(g); // 누르면 가까운 상징물 안내판을 크게 읽기
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
  if (!gable && !thatch) paljakMesh(g, w + 1.3, d + 1.3, roofH * 1.12, top);
  else { const geo = gable ? gableRoofGeo(THREE, w + 1.2, d + 1.6, roofH, .1) : hipRoofGeo(THREE, w + 1.3, d + 1.3, roofH, Math.max(.3, w - d * .7), .05); mesh(g, geo, roofMat, 0, top, 0).receiveShadow = false; }
  if (gable) mesh(g, new THREE.BoxGeometry(w + 1.3, .2, .24), h.MAT.stoneDark, 0, top + roofH + .04, 0);
  if (plaque) plate(h, g, plaque, plaqueW, 0, top - .15 - plaqueW * 138 / 512 / 2, d / 2 + .1, { px: 50 }); // 현판 윗단이 단청 띠에 가리지 않게
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

// ───────── 실제 사진과 맞춘 모습 (2026.11): 계곡과 다리, 문, 누각, 노거수 ─────────
// 마당을 가로지르는 계곡: 물 + 양쪽 돌축대 + 바위 · 가운데 다리 자리(gap)만 비워 두고 물에는 못 들어감
// (돌축대·바위는 따로따로 그려야 함 — 한 덩어리로 합치면 다리 자리까지 막는 상자가 됨)
function streamAcross(h, zc, { wd = 3.0, half, gap = 1.4, bankH = .85, rocks = 7, rnd = Math.random } = {}) {
  const wt = mesh(h.site, new THREE.PlaneGeometry(2 * half, wd + .3), R.water, 0, .045, zc, false); wt.rotation.x = -Math.PI / 2;
  for (const sx of [-1, 1]) {
    const len = half - gap, cx = sx * (gap + len / 2);
    for (const sz of [-1, 1]) { mesh(h.site, new THREE.BoxGeometry(len, bankH, .46), R.rock2, cx, bankH / 2, zc + sz * (wd / 2 + .23)); mesh(h.site, new THREE.BoxGeometry(len, .1, .56), R.granite, cx, bankH + .05, zc + sz * (wd / 2 + .23)); }
    const P = parts();
    for (let i = 0; i < rocks; i++) { const x = sx * (gap + .6 + rnd() * (len - 1.2)), z = zc + (rnd() - .5) * (wd - .6); P.ball(.22 + rnd() * .22, rnd() < .5 ? R.rock : R.rock2, x, .08, z, 1.3, .55, 1, 0); }
    P.flush(h.site);
    h.col(cx, zc, len / 2, wd / 2 + .46);
  }
}
// 무지개(홍예) 돌다리: 아래가 반원으로 뚫린 돌덩이 + 홍예석 테 + 양끝 돌계단 (위는 걸어서 건넘)
function archBridge(h, zc, { len = 4.4, w = 2.8, deck = 1.0, r = .8, steps = 3, mat = R.granite, arches = 1 } = {}) {
  const sh = new THREE.Shape(), L2 = len / 2, cs = arches > 1 ? (len - 2 * r - .5) / (arches - 1) : 0, cx = i => -cs * (arches - 1) / 2 + i * cs; // 홍예 여러 칸이면 고르게 나눔
  sh.moveTo(-L2, 0); for (let i = 0; i < arches; i++) { sh.lineTo(cx(i) - r, 0); sh.absarc(cx(i), 0, r, Math.PI, 0, true); } sh.lineTo(L2, 0); sh.lineTo(L2, deck); sh.lineTo(-L2, deck); sh.lineTo(-L2, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false, curveSegments: 18 }); geo.rotateY(Math.PI / 2); geo.translate(-w / 2, 0, 0);
  mesh(h.site, geo, mat, 0, 0, zc);
  for (let i = 0; i < arches; i++) for (const sx of [-1, 1]) { const ring = mesh(h.site, new THREE.TorusGeometry(r + .09, .1, 6, 20, Math.PI), R.granite2, sx * (w / 2 + .02), 0, zc - cx(i), false); ring.rotation.y = Math.PI / 2; }
  for (const se of [-1, 1]) for (let i = 0; i < steps; i++) { const hh = deck * (i + 1) / (steps + 1); mesh(h.site, new THREE.BoxGeometry(w * .86, hh, .36), R.granite2, 0, hh / 2, zc + se * (L2 + .18 + (steps - 1 - i) * .36)); }
  return { L2, deck, end: L2 + steps * .36 };
}
// 송광사 우화각: 삼청교 위에 앉은 긴 누각 (빨간 기둥 · 팔작지붕이 다리 방향으로 길게)
function uhwagak(h, zc, deck) {
  const len = 4.2, hw = 1.18, ph = 2.15, P = parts();
  for (const sx of [-1, 1]) for (const z of [-1.95, -.65, .65, 1.95]) mesh(h.site, new THREE.CylinderGeometry(.11, .12, ph, 10), R.redCol, sx * hw, deck + ph / 2, zc + z);
  for (const sx of [-1, 1]) { // 낮은 난간 (기둥 사이)
    mesh(h.site, new THREE.BoxGeometry(.07, .07, len), R.wood, sx * (hw + .02), deck + .63, zc); // 난간 윗면이 발보다 0.6m 넘게 높아야 올라서지 못함
    for (let z = -1.85; z <= 1.86; z += .3) mesh(h.site, new THREE.BoxGeometry(.04, .6, .04), R.lattice, sx * (hw + .02), deck + .3, zc + z);
  }
  const yb = deck + ph;
  P.box(2 * hw + .3, .2, len + .3, R.band, 0, yb + .1, zc); P.box(2 * hw + .5, .14, len + .5, R.redCol, 0, yb + .27, zc);
  for (let z = -2.1; z <= 2.11; z += .42) for (const sx of [-1, 1]) P.box(.5, .12, .14, R.band, sx * (hw + .2), yb + .4, zc + z); // 서까래 끝
  paljakPut(P, 2 * hw + 2.2, len + 2.0, 1.35, 0, yb + .34, zc);
  P.flush(h.site);
  const g = grp(h, 0, zc + len / 2 + .2); plate(h, g, '우화각', 1.1, 0, yb - .05, 0, { px: 44 });
}
// 일주문 바꿔 세우기: 범어사 조계문(돌기둥 네 개 + 짧은 나무기둥 · 맞배지붕 · 풍판), 용주사 삼문(가운데가 높은 솟을삼문)
export function buildGate(h, kind, T) {
  const Z = h.YZ1, P = parts();
  if (kind === 'jogye') {
    for (const x of [-4.35, -1.5, 1.5, 4.35]) {
      mesh(h.site, new THREE.CylinderGeometry(.44, .52, 1.95, 18), R.granite, x, .975, Z);  // 아랫부분은 지름 1m 남짓한 배흘림 돌기둥
      mesh(h.site, new THREE.CylinderGeometry(.4, .44, .12, 18), R.granite2, x, 2.01, Z);
      mesh(h.site, new THREE.CylinderGeometry(.3, .33, .8, 14), R.redCol, x, 2.47, Z);      // 그 위에 짧고 굵은 나무기둥
      h.col(x, Z, .55, .55);
    }
    P.box(9.2, .22, .3, R.redCol, 0, 2.97, Z); P.box(9.35, .14, .46, R.band, 0, 3.15, Z);   // 창방 · 평방
    for (let x = -4.5; x <= 4.51; x += .5) { P.box(.2, .3, .9, R.band, x, 3.37, Z); P.box(.15, .14, 1.35, R.redCol, x, 3.58, Z); } // 다포 공포 (3출목)
    P.box(9.8, .16, 1.8, R.band, 0, 3.72, Z);
    const roof = gableRoofGeo(THREE, 11.4, 3.7, 1.4, .16); roof.translate(0, 3.8, Z); P.put(roof, R.roofTile);
    P.box(11.6, .26, .34, h.MAT.stoneDark, 0, 5.24, Z);                                          // 용마루
    const fw = new THREE.Shape(); fw.moveTo(-1.6, 0); fw.lineTo(1.6, 0); fw.lineTo(0, 1.25); fw.lineTo(-1.6, 0);
    for (const sx of [-1, 1]) { const g2 = new THREE.ShapeGeometry(fw); g2.rotateY(Math.PI / 2); g2.translate(sx * 5.5, 3.82, Z); P.put(g2, FUNG()); } // 풍판
    P.flush(h.site);
    const g = grp(h, 0, Z + .32);
    plate(h, g, '조계문', 1.5, 0, 2.62, 0, { px: 46 }); plate(h, g, '선찰대본산', 1.85, -2.92, 2.62, 0, { px: 40 }); plate(h, g, '금정산 범어사', 1.95, 2.92, 2.62, 0, { px: 38 });
    const gi = grp(h, 0, Z - .32, Math.PI); plate(h, gi, T.name, 1.5, 0, 2.62, 0, { px: 46 });
    return 4.35;
  }
  if (kind === 'sammun') {
    const wall = M('#efe6d2'), door = M('#9b3b2b');
    for (const x of [-3.7, -1.5, 1.5, 3.7]) { mesh(h.site, new THREE.BoxGeometry(.28, Math.abs(x) < 2 ? 3.1 : 2.6, .28), R.redCol, x, Math.abs(x) < 2 ? 1.55 : 1.3, Z); h.col(x, Z, .2, .2); }
    for (const sx of [-1, 1]) { // 양옆 칸: 닫힌 붉은 문 + 흰 벽
      mesh(h.site, new THREE.BoxGeometry(1.92, 2.0, .12), door, sx * 2.6, 1.0, Z); mesh(h.site, new THREE.BoxGeometry(1.92, .6, .14), wall, sx * 2.6, 2.3, Z);
      mesh(h.site, new THREE.BoxGeometry(.03, 1.9, .14), R.lattice, sx * 2.6, 1.0, Z);
      h.col(sx * 2.6, Z, 1.0, .16);
    }
    for (const sx of [-1, 1]) { const d = mesh(h.site, new THREE.BoxGeometry(1.4, 2.3, .08), door, sx * (1.5 - .1), 1.15, Z - .72); d.rotation.y = sx * -Math.PI / 2; d.position.x = sx * 1.42; } // 가운데 문: 안쪽으로 활짝
    P.box(3.4, .2, .5, R.band, 0, 3.1, Z); P.box(2.6, .2, .5, R.band, -2.6, 2.6, Z); P.box(2.6, .2, .5, R.band, 2.6, 2.6, Z);
    const r1 = gableRoofGeo(THREE, 4.0, 2.5, 1.0, .12); r1.translate(0, 3.2, Z); P.put(r1, R.roofTile);
    for (const sx of [-1, 1]) { const r2 = gableRoofGeo(THREE, 2.8, 2.2, .85, .1); r2.translate(sx * 2.65, 2.7, Z); P.put(r2, R.roofTile); }
    P.box(4.1, .2, .26, h.MAT.stoneDark, 0, 4.22, Z);
    P.flush(h.site);
    for (const side of [1, -1]) { const g = grp(h, 0, Z + side * .28, side > 0 ? 0 : Math.PI); plate(h, g, T.name, 1.5, 0, 2.7, 0, { px: 46 }); }
    return 3.85;
  }
  return 1.6;
}
let FUNG_ = null; const FUNG = () => FUNG_ || (FUNG_ = M('#7d5a3c', { side: THREE.DoubleSide }));
// 육모지붕: 꼭대기에서 오목하게 흘러내리다 여섯 귀가 살짝 들림 (아래·위 두 겹)
function hexRoofGeo(R0, H, lift, N = 10) {
  const pos = [], idx = [], ring = (r, y, k) => { for (let i = 0; i < 6 * 4; i++) { const a = i / 24 * Math.PI * 2 + Math.PI / 6, corner = Math.pow(Math.abs(Math.cos(3 * (a - Math.PI / 6))), 6), rr = r * (1 / Math.cos(((a - Math.PI / 6) % (Math.PI / 3)) - Math.PI / 6)); pos.push(Math.sin(a) * rr, y + lift * corner * Math.pow(r / R0, 3) * k, Math.cos(a) * rr); } };
  for (let j = 0; j <= N; j++) { const t = j / N, r = R0 * (1 - t), y = H * (1 - Math.pow(1 - t, 1.7)); ring(r, y, 1); }
  for (let j = 0; j < N; j++) for (let i = 0; i < 24; i++) { const a = j * 24 + i, b = j * 24 + (i + 1) % 24, c = a + 24, d = b + 24; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const n = g.toNonIndexed(); n.computeVertexNormals(); n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n;
}
let BOWL_ = null; const BOWL = () => BOWL_ || (BOWL_ = M('#cbc4b6', { side: THREE.DoubleSide }));
// 용주사 홍살문: 붉은 두 기둥 위에 화살 같은 붉은 살 + 가운데 태극 (지붕 없음)
function hongsalmun(h, z) {
  const red = M('#b23a2c'), P = parts();
  for (const sx of [-1, 1]) { mesh(h.site, new THREE.CylinderGeometry(.14, .16, 5.6, 12), red, sx * 2.4, 2.8, z); h.col(sx * 2.4, z, .22, .22); }
  for (const y of [4.55, 5.3]) P.box(5.4, .16, .16, red, 0, y, z);
  for (let x = -2.15; x <= 2.16; x += .36) { P.box(.06, 1.25, .06, red, x, 5.1, z); P.put(new THREE.ConeGeometry(.06, .2, 4).translate(x, 5.82, z), red); }
  const tg = new THREE.CircleGeometry(.32, 24, 0, Math.PI); tg.translate(0, 6.15, z + .05); P.put(tg, M('#c0392b', { side: THREE.DoubleSide }));
  const tb = new THREE.CircleGeometry(.32, 24, Math.PI, Math.PI); tb.translate(0, 6.15, z + .05); P.put(tb, M('#2c5aa0', { side: THREE.DoubleSide }));
  for (const dx of [-.16, 0, .16]) P.box(.035, dx ? .32 : .46, .035, red, dx, 6.62 + (dx ? 0 : .07), z);
  P.box(.4, .04, .04, red, 0, 6.48, z);
  P.flush(h.site);
}
// 용주사 천보루: 정면 5칸 2층 누각 · 아래층은 기둥만 서 있는 통로(누하진입), 앞줄은 높은 돌기둥 · 위층은 강당
function cheonboru(h, zc) {
  const xs = [-5.7, -3.6, -1.5, 1.5, 3.6, 5.7], zs = [-1.5, 0, 1.5], y1 = 2.4, P = parts();
  for (const x of xs) for (const dz of zs) {
    if (dz > 0) mesh(h.site, new THREE.BoxGeometry(.34, y1, .34), R.granite, x, y1 / 2, zc + dz); // 앞줄 장대 돌기둥
    else { mesh(h.site, new THREE.BoxGeometry(.4, .3, .4), R.granite2, x, .15, zc + dz); mesh(h.site, new THREE.CylinderGeometry(.15, .16, y1 - .3, 10), R.redCol, x, .3 + (y1 - .3) / 2, zc + dz); }
  }
  P.box(12.1, .22, 3.5, R.wood, 0, y1 + .11, zc);                       // 위층 마루
  const uh = 1.75, yu = y1 + .22;
  for (const x of xs) for (const dz of [-1.5, 1.5]) P.cyl(.13, .14, uh, 10, R.redCol, x, yu + uh / 2, zc + dz);
  for (let i = 0; i < 5; i++) { const x0 = xs[i], x1 = xs[i + 1], cx = (x0 + x1) / 2, bw = x1 - x0 - .3; // 칸마다 살창 분합문
    for (const dz of [-1.5, 1.5]) { P.box(bw, uh - .5, .06, R.lattice, cx, yu + .25 + (uh - .5) / 2, zc + dz); P.box(bw, .25, .07, M('#efe6d2'), cx, yu + .12, zc + dz); } }
  for (const sx of [-1, 1]) P.box(.08, uh, 3.0, M('#efe6d2'), sx * 5.7, yu + uh / 2, zc);
  P.box(12.3, .1, .06, R.wood, 0, yu + .55, zc + 1.75); for (let x = -6; x <= 6.01; x += .4) P.box(.04, .5, .04, R.lattice, x, yu + .3, zc + 1.75); // 앞 난간
  P.box(12.4, .24, 3.5, R.band, 0, yu + uh + .12, zc);
  for (let x = -6.2; x <= 6.21; x += .5) for (const dz of [-1, 1]) P.box(.14, .14, .7, R.band, x, yu + uh + .3, zc + dz * 1.95); // 공포
  paljakPut(P, 14.2, 5.4, 2.1, 0, yu + uh + .36, zc);
  P.flush(h.site);
  const g = grp(h, 0, zc + 1.82); plate(h, g, '천보루', 1.7, 0, yu + uh - .2, 0, { px: 46 });
  const gi = grp(h, 0, zc - 1.82, Math.PI); plate(h, gi, '홍제루', 1.7, 0, yu + uh - .2, 0, { px: 46 });
}
// 용주사 천왕문: 정면 3칸 맞배지붕 · 가운데 칸으로 지나가고, 양옆 칸에 사천왕 네 분 (1980년 이후 새로 지음)
// 가운데 길을 막지 않도록 왼쪽·오른쪽 칸을 따로 합치고, 길 위를 가로지르는 것은 모두 머리보다 높게
function cheonwangmun(h, zc) {
  const xs = [-4.2, -1.6, 1.6, 4.2], hc = 3.5, D2 = 3.6, wallW = K().wallW, k = K();
  for (const x of xs) for (const z of [-D2 / 2, 0, D2 / 2]) { if (Math.abs(x) > 4 && !z) continue; // 기둥: 하나씩 (부딪힘 상자가 길을 덮지 않게)
    mesh(h.site, new THREE.BoxGeometry(.42, .26, .42), R.granite2, x, .13, zc + z); mesh(h.site, new THREE.CylinderGeometry(.15, .16, hc - .26, 10), R.redCol, x, .26 + (hc - .26) / 2, zc + z); }
  mesh(h.site, new THREE.BoxGeometry(3.0, .025, D2 + 1.0), h.MAT.stone, 0, .045, zc, false);                   // 가운데 길 박석 (밟고 지나감)
  // 사천왕 (Gemini로 새로 만든 채색 목조상 그림 → 입체 부조) · 들어서며 오른쪽(동): 앞 지국천왕(칼)·뒤 증장천왕(용과 여의주) / 왼쪽(서): 앞 다문천왕(비파)·뒤 광목천왕(삼지창과 보탑)
  const kings = [['k4', 'k3'], ['k1', 'k2']], KD = './assets/tex/kings/';
  for (const sx of [-1, 1]) {
    const P = parts(), cx = sx * 2.9, bw = 2.6;
    P.box(bw + .5, .3, D2 + .5, h.MAT.stone, cx, .15, zc);                                    // 기단
    P.box(bw, .35, D2 - .1, R.wood, cx, .47, zc);                                             // 사천왕을 모신 단
    P.box(.14, hc, D2, wallW, sx * 4.2, hc / 2, zc);                                          // 바깥 벽
    for (const sz of [-1, 1]) { const wz = zc + sz * D2 / 2;                                   // 앞뒤: 아래는 화방벽, 위는 붉은 홍살 (밖에서도 사천왕이 들여다보임)
      P.box(bw, 1.05, .16, wallW, cx, .525, wz); P.box(bw, .1, .18, R.redCol, cx, 1.1, wz); P.box(bw, .12, .18, R.redCol, cx, hc - .06, wz);
      for (let bx = cx - bw / 2 + .12; bx <= cx + bw / 2 - .11; bx += .13) P.box(.045, hc - 1.27, .06, R.redCol, bx, (1.15 + hc - .12) / 2, wz); }
    for (let z = -D2 / 2 + .3; z <= D2 / 2 - .29; z += .55) P.box(.07, .95, .07, R.redCol, sx * 1.66, .475, zc + z); // 길 쪽 붉은 난간
    for (const y of [.5, .92]) P.box(.06, .07, D2 - .4, R.redCol, sx * 1.66, y, zc);
    kings[sx < 0 ? 0 : 1].forEach((n, i) => reliefStatue(h.site, KD + n + '.webp', { x: sx * 3.0, y: .645, z: zc + (i ? -.86 : .86), ry: -sx * Math.PI / 2 + sx * (i ? -.42 : .42), h: 2.68, depth: .13 })); // 가운데 길을 보되, 앞 두 분은 들어오는 쪽·뒤 두 분은 나가는 쪽으로 살짝 돌아섬
    P.flush(h.site);
    h.col(cx + sx * .05, zc, 1.38, D2 / 2 + .1);
  }
  const Q = parts(), top = hc + .3, W = 8.4;                                                  // 길 위로 지나가는 것 (모두 머리 위)
  for (const z of [-D2 / 2, 0, D2 / 2]) Q.box(W + .3, .3, .3, R.band, 0, hc + .15, zc + z);
  for (const x of xs) Q.box(.3, .3, D2 + .3, R.band, x, hc + .15, zc);
  for (const x of xs) for (const sz of [-1, 1]) Q.box(.2, .18, .5, R.band, x, hc - .02, zc + sz * (D2 / 2 + .18)); // 익공
  Q.box(3.2, .2, .22, R.redCol, 0, 2.45, zc);                                                 // 문 위 인방 + 홍살
  for (let x = -1.4; x <= 1.41; x += .2) Q.box(.04, .48, .04, R.redCol, x, 2.75, zc);
  const roof = gableRoofGeo(THREE, W + 1.8, D2 + 2.8, 1.55, .12); roof.translate(0, top, zc); Q.put(roof, R.roofTile);
  { const hz = D2 / 2 + .15, rz = (D2 + 2.8) / 2, yAt = z => top + 1.55 * (1 - Math.abs(z) / rz) - .06, sh = new THREE.Shape(); // 양옆 박공 (지붕 아래 세모 벽)
    sh.moveTo(-hz, hc + .25); sh.lineTo(hz, hc + .25); sh.lineTo(hz, yAt(hz)); sh.lineTo(0, yAt(0)); sh.lineTo(-hz, yAt(-hz)); sh.closePath();
    for (const sx of [-1, 1]) { const gw = new THREE.ExtrudeGeometry(sh, { depth: .12, bevelEnabled: false }); gw.rotateY(Math.PI / 2); gw.translate(sx * 4.2 - .06, 0, zc); Q.put(gw, wallW); } }
  Q.box(W + 1.9, .22, .28, h.MAT.stoneDark, 0, top + 1.59, zc);
  Q.flush(h.site);
  const gf = grp(h, 0, zc + D2 / 2 + .17); plate(h, gf, '천왕문', 1.5, 0, hc - .2, 0, { px: 50 });
  return { top };
}
// 전나무: 곧은 줄기 (아래는 가지 없이) + 층층이 원뿔 잎
function firTree(Pc, trunks, h, x, z, s, rnd) {
  const k = K(), th = 2.4 * s;
  trunks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, (th + 1.6 * s) / 2, z), new THREE.Quaternion(), new THREE.Vector3(s, (th + 1.6 * s) / 4, s))); // 줄기는 한꺼번에 그림 (부딪힘은 h.col)
  for (let i = 0; i < 5; i++) { const r = (1.35 - i * .22) * s, hh = (1.9 - i * .18) * s; Pc.put(new THREE.ConeGeometry(r, hh, 8).translate(x + (rnd() - .5) * .1, th + i * 1.15 * s + hh / 2, z), i % 2 ? k.juniper : k.leaf2); }
  h.col(x, z, .25, .25);
}
export function buildItems(h, T) {
  const list = (T.style && T.style.items) || [], out = { spots: [] }; if (!list.length) return out;
  const { L, D, YX, YZ1 } = h, IX = h.IX ?? YX, k = K(), rnd = rng(T.name);
  const SX = L / 2 + 3.25, FZ = D / 2 + 10.4, FX = L / 4 + 4.6; // 법당 옆 마당 가운데 · 앞마당 양옆(탑 높이) 자리
  const spot = (g, ox, oz, r, name, story) => { const [lx, lz] = toSite(g, ox, oz); out.spots.push({ lx, lz, r, name, story }); };
  const spotAt = (lx, lz, r, name, story) => out.spots.push({ lx, lz, r, name, story });
  const RIGHT = -Math.PI / 2, LEFT = Math.PI / 2; // 앞마당 오른쪽 자리는 길(왼쪽)을, 왼쪽 자리는 길(오른쪽)을 바라봄
  for (const kind of list) {
    if (kind === 'panjeon') { // 봉은사 판전: 맞배지붕 전각 + 추사가 떠나기 사흘 전 쓴 '板殿' 현판
      const g = grp(h, FX, FZ, RIGHT);
      smallHall(h, g, { w: 3.6, d: 2.4, hh: 1.7, gable: true, roofH: .95, plaque: '板殿', plaqueW: 1.0 });
      colG(h, g, 0, 0, 2.1, 1.5);
      signpost(h, ...toSite(g, -2.6, 1.9), RIGHT, '판전', '추사 김정희가 생애 마지막에 쓴 현판');
      spot(g, 0, 2.2, 3.4, '봉은사 판전', '추사 김정희가 세상을 떠나기 며칠 전에 쓴 ‘판전’ 현판이 걸려 있어요');
    }
    if (kind === 'yongjuBell') { // 용주사 범종각: 국보 동종을 모신 한 칸 종각 (치지 않고 보기만) · 누리집 가람 배치도대로 대웅보전 앞 왼쪽, 오른쪽 법고각과 마주 봄
      const g = grp(h, -(L / 2 + 2.7), D / 2 + 2.6, LEFT), P = parts();
      P.box(2.8, .25, 2.8, h.MAT.stone, 0, .125, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.cyl(.1, .11, 2.4, 8, R.redCol, sx * 1.15, 1.45, sz * 1.15);
      P.box(2.5, .16, .16, R.redCol, 0, 2.5, 0); P.box(2.5, .12, 2.5, R.band, 0, 2.62, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(.08, .5, .08, R.lattice, sx * 1.15, .5, sz * .6), P.box(.08, .5, .08, R.lattice, sx * .6, .5, sz * 1.15);
      for (const [a, b] of [[[-1.15, 1.15], [1.15, 1.15]], [[-1.15, -1.15], [1.15, -1.15]], [[-1.15, -1.15], [-1.15, 1.15]], [[1.15, -1.15], [1.15, 1.15]]]) { const cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]); P.box(a[0] === b[0] ? .07 : len, .07, a[0] === b[0] ? len : .07, R.lattice, cx, .72, cz); } // 낮은 난간
      P.flush(g);
      paljakMesh(g, 3.6, 3.6, 1.2, 2.68);
      const S = .95, prof = [[0, 0], [.6, 0], [.59, .05], [.55, .16], [.5, .48], [.46, .86], [.42, 1.08], [.36, 1.18], [.22, 1.24], [0, 1.25]].map(([r, y]) => new THREE.Vector2(r * S, y * S));
      const bellM = new THREE.MeshStandardMaterial({ color: '#5a6246', metalness: .62, roughness: .42 });
      mesh(g, new THREE.LatheGeometry(prof, 40), bellM, 0, .62, 0);
      mesh(g, new THREE.CylinderGeometry(.04, .05, .5, 8), bellM, .12, .62 + 1.25 * S + .2, 0);                // 음통
      const loop = mesh(g, new THREE.TorusGeometry(.12, .035, 6, 14), bellM, -.05, .62 + 1.25 * S + .14, 0);     // 용뉴
      mesh(g, new THREE.CylinderGeometry(.02, .02, .26, 6), R.lattice, 0, 2.3, 0);
      for (const sx of [-1, 1]) { const f = mesh(g, new THREE.PlaneGeometry(.22, .34), new THREE.MeshStandardMaterial({ color: '#7d8460', metalness: .5, roughness: .5, side: THREE.DoubleSide }), sx * .44, 1.15, .02, false); f.rotation.y = sx * 1.2; } // 비천상 자리
      plate(h, g, '용주사 동종', 1.1, 0, 2.38, 1.36, { px: 40 });
      colG(h, g, 0, 0, 1.5, 1.5);
      signpost(h, ...toSite(g, -1.9, 1.7), LEFT, '국보 · 용주사 동종', '하늘을 나는 비천상이 새겨진 범종');
      spot(g, 0, 2.2, 3.4, '용주사 동종', '국보 · 하늘을 나는 비천상과 삼존상이 새겨진 범종이에요');
    }
    if (kind === 'hyohaeng') { // 용주사 효행 이야기: 부모은중경 열 가지 은혜 판
      const g = grp(h, 7.7, YZ1 + 3.3, -Math.PI / 4), P = parts(); // 부모은중경탑 곁, 들어오는 길을 비스듬히 바라봄
      const B = boardTex('효행 이야기', ['*정조가 아버지 사도세자를 위해 세운 효심의 절', '*부모은중경 — 부모님의 열 가지 은혜',
        '1  아이를 품어 지키고 보호해 주신 은혜', '2  낳으실 때 큰 고통을 겪으신 은혜', '3  자식을 낳고 근심을 잊으신 은혜', '4  쓴 것은 삼키고 단 것은 먹여 주신 은혜', '5  마른자리 아기 누이고 젖은 자리 누우신 은혜',
        '6  젖을 먹여 길러 주신 은혜', '7  더러운 것을 씻어 주신 은혜', '8  먼 길 떠나면 걱정하시는 은혜', '9  자식 위해 궂은일도 마다 않으신 은혜', '10 끝까지 가엾이 여기시는 은혜'], { size: 31, gap: 50 });
      const bw = 2.6, bh = bw * B.ratio;
      for (const sx of [-1, 1]) P.cyl(.06, .07, bh + .75, 8, h.MAT.trunk, sx * (bw / 2 + .02), (bh + .75) / 2, 0);
      P.box(bw + .14, bh + .1, .06, h.MAT.trunk, 0, .6 + bh / 2, -.04);
      P.flush(g);
      mesh(g, new THREE.PlaneGeometry(bw, bh), new THREE.MeshStandardMaterial({ map: B.tex, roughness: .7 }), 0, .6 + bh / 2, .0, false);
      const r = mesh(g, gableRoofGeo(THREE, bw + .7, .9, .32, .08), R.roofTile, 0, .65 + bh + .08, 0); r.receiveShadow = false;
      h.col(7.7, YZ1 + 3.3, 1.0, 1.0);
      spot(g, 0, 1.4, 2.4, '용주사 효행 이야기', '정조가 아버지 사도세자를 위해 세운 절 · 부모은중경의 열 가지 은혜를 읽어 보세요');
    }
    if (kind === 'yongjuDrum') { // 용주사 법고각: 대웅보전을 사이에 두고 범종각과 마주 보는 한 칸 전각 · 예불 때 치는 큰 북
      const g = grp(h, L / 2 + 2.7, D / 2 + 2.6, RIGHT), P = parts();
      P.box(2.8, .25, 2.8, h.MAT.stone, 0, .125, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.cyl(.1, .11, 2.4, 8, R.redCol, sx * 1.15, 1.45, sz * 1.15);
      P.box(2.5, .16, .16, R.redCol, 0, 2.5, 0); P.box(2.5, .12, 2.5, R.band, 0, 2.62, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(.08, .5, .08, R.lattice, sx * 1.15, .5, sz * .6), P.box(.08, .5, .08, R.lattice, sx * .6, .5, sz * 1.15);
      for (const [a, b] of [[[-1.15, 1.15], [1.15, 1.15]], [[-1.15, -1.15], [1.15, -1.15]], [[-1.15, -1.15], [-1.15, 1.15]], [[1.15, -1.15], [1.15, 1.15]]]) { const cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]); P.box(a[0] === b[0] ? .07 : len, .07, a[0] === b[0] ? len : .07, R.lattice, cx, .72, cz); } // 낮은 난간
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(.09, 1.05, .09, R.wood, sx * .55, .77, sz * .3); // 북 받침 틀
      for (const sz of [-1, 1]) P.box(1.25, .09, .09, R.wood, 0, 1.25, sz * .3);
      P.flush(g);
      paljakMesh(g, 3.6, 3.6, 1.2, 2.68);
      const drumY = 1.82, body = new THREE.CylinderGeometry(.6, .6, .62, 28); body.rotateX(Math.PI / 2); // 북통: 붉은 몸통, 가죽 면이 앞(길 쪽)을 봄
      mesh(g, body, M('#a3352b'), 0, drumY, 0);
      const skin = M('#eadcbc', { side: THREE.DoubleSide }), gold = M('#d9a441');
      for (const sz of [-1, 1]) { const f = mesh(g, new THREE.CircleGeometry(.57, 28), skin, 0, drumY, sz * .315, false); if (sz < 0) f.rotation.y = Math.PI;
        mesh(g, new THREE.TorusGeometry(.6, .035, 6, 28), gold, 0, drumY, sz * .28, false);
        const tg = new THREE.CircleGeometry(.2, 20, 0, Math.PI), tb = new THREE.CircleGeometry(.2, 20, Math.PI, Math.PI); // 태극
        const a = mesh(g, tg, M('#c0392b', { side: THREE.DoubleSide }), 0, drumY, sz * .322, false), b = mesh(g, tb, M('#2c5aa0', { side: THREE.DoubleSide }), 0, drumY, sz * .322, false);
        if (sz < 0) { a.rotation.y = Math.PI; b.rotation.y = Math.PI; } }
      plate(h, g, '법고각', .9, 0, 2.38, 1.36, { px: 42 });
      colG(h, g, 0, 0, 1.5, 1.5);
      spot(g, 0, 2.2, 3.0, '용주사 법고각', '대웅보전을 사이에 두고 범종각과 마주 보는 한 칸 전각 · 예불 때 치는 큰 북(법고)을 모셨어요');
    }
    if (kind === 'yongjuCheonwang') { // 용주사 천왕문: 홍살문 앞(바깥), 순례 마당에서 들어오는 길 위
      const zc = YZ1 + 11.8;
      cheonwangmun(h, zc);
      signpost(h, -5.7, zc + 2.6, 0, '천왕문', '사천왕 네 분이 절을 지키는 문', 1.35);
      spotAt(0, zc + 2.4, 2.6, '용주사 천왕문', '절에 들어서며 처음 만나는 문 · 양옆에 사천왕 네 분을 모셨어요');
    }
    if (kind === 'yongjuApproach') { // 용주사 들어오는 길 왼쪽 효행박물관 앞: 남쪽(천왕문 쪽) 고려 오층석탑 · 북쪽(삼문 쪽) 부모은중경탑 — 2020년 호성전 화재 뒤 박물관 옆으로 옮김
      const r1 = stoneTiers(h, -6.2, YZ1 + 8.4, 5, .95); h.col(-6.2, YZ1 + 8.4, r1, r1); // 고려 오층석탑 (효행박물관 앞 왼쪽)
      const r2 = stoneTiers(h, -6.2, YZ1 + 3.6, 3, .9, false, { slim: .9 }); h.col(-6.2, YZ1 + 3.6, r2, r2); // 부모은중경탑 (1981, 효행박물관 앞 오른쪽)
      signpost(h, -4.55, YZ1 + 9.2, 0, '오층석탑', '고려 때 화강암 탑 · 높이 4.5m', 1.25);
      signpost(h, -4.55, YZ1 + 4.9, 0, '부모은중경탑', '부모님 은혜를 새긴 삼층탑', 1.25);
      spotAt(-4.9, YZ1 + 8.4, 1.8, '용주사 오층석탑', '효행박물관 앞 왼쪽에 선 고려 때 오층석탑이에요');
      spotAt(-4.9, YZ1 + 3.6, 1.8, '용주사 부모은중경탑', '부모은중경의 글귀를 새긴 삼층석탑 · 2020년 호성전 화재 뒤 효행박물관 옆으로 옮겼어요');
    }
    if (kind === 'yongjuMore') { // 용주사 누리집 가람 배치도·전각 안내에 있으나 빠졌던 곳 (2026.11)
      const two = (g, { w, d, h1 = 2.6, h2 = 2.3, plaque, low }) => { // 2층 전각: 아래층은 벽과 창, 위층은 팔작지붕 법당
        const P = parts(), y0 = .3; P.box(w + .5, y0, d + .5, h.MAT.stone, 0, y0 / 2, 0); P.box(w, h1, d, k.wallW, 0, y0 + h1 / 2, 0);
        for (let i = 0; i < 4; i++) P.box(w * .16, h1 * .42, .05, R.lattice, -w * .36 + i * w * .24, y0 + h1 * .55, d / 2 + .02);
        P.box(1.1, h1 * .72, .05, k.dark, 0, y0 + h1 * .36, d / 2 + .03);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.cyl(.09, .1, h1, 8, R.redCol, sx * w / 2, y0 + h1 / 2, sz * d / 2);
        P.box(w + .1, .16, d + .1, R.band, 0, y0 + h1 - .08, 0); P.flush(g);
        paljakMesh(g, w + 1.1, d + 1.1, .42, y0 + h1 + .02);                                      // 아래층 처마
        const g2 = new THREE.Group(); g2.position.y = y0 + h1 + .05; g.add(g2);
        smallHall(h, g2, { w: w - 1.2, d: d - 1.1, hh: h2, roofH: 1.25, plaque, plaqueW: 1.3 });
        if (low) plate(h, g, low, .9, 0, y0 + h1 * .82, d / 2 + .06, { px: 44 });
      };
      const shed = (g, { w, d, hh = 1.9, plaque }) => smallHall(h, g, { w, d, hh, gable: true, roofH: .8, plaque, plaqueW: Math.min(1.1, w * .4) });
      // ── 안마당 동쪽 바깥: 관음전(2층, 1층 종무소) · 접견실 · 수각 · 해우소
      { const w = 10, d = 4.4, g = grp(h, YX - 3.3, 4.5, RIGHT); two(g, { w, d, plaque: '관음전', low: '종무소' }); colG(h, g, 0, 0, w / 2 + .3, d / 2 + .3);
        signpost(h, YX - 6.6, 10.2, RIGHT, '관음전 · 종무소', '2층 관음전 · 1층 종무소(문의)', 1.4);
        spot(g, 0, 3.4, 3.2, '용주사 관음전', '2층에 관세음보살을 모신 전각 · 1층은 종무소예요'); }
      { const g = grp(h, YX - 3.3, 12.3, RIGHT); shed(g, { w: 3.6, d: 3.0, plaque: '접견실' }); colG(h, g, 0, 0, 2.1, 1.8); }
      { const g = grp(h, YX - 1.6, 15.6, RIGHT), P = parts(); // 수각: 돌확에 약수가 흐르는 작은 정자
        P.box(1.8, .5, .8, R.granite, 0, .25, -.1); P.box(1.5, .06, .55, glow('#7fb6c8', .35), 0, .48, -.1);
        P.cyl(.03, .03, .6, 6, M('#7d6a3c'), 0, .82, -.42); for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.cyl(.07, .08, 1.9, 8, R.redCol, sx * .95, .95, sz * .7);
        P.flush(g); mesh(g, gableRoofGeo(THREE, 2.6, 2.1, .6, .08), R.roofTile, 0, 1.9, 0); plate(h, g, '수각', .7, 0, 1.75, .76, { px: 44 }); colG(h, g, 0, 0, 1.1, .9); }
      { const g = grp(h, YX - 3.3, 19.3, RIGHT); shed(g, { w: 3.6, d: 2.6, plaque: '해우소' }); colG(h, g, 0, 0, 2.1, 1.6); }
      // ── 안마당 서쪽 바깥: 요사채 · 천보루 왼쪽 앞 불음각(1985 범종)
      { const w = 11, d = 4.2, g = grp(h, -(YX - 3.2), 13.6, LEFT); smallHall(h, g, { w, d, hh: 2.1, gable: true, roofH: 1.1, plaque: '요사채', plaqueW: 1.2 }); colG(h, g, 0, 0, w / 2 + .3, d / 2 + .3); }
      { const g = grp(h, -9.6, D / 2 + 14.8, LEFT), P = parts();
        P.box(2.6, .25, 2.6, h.MAT.stone, 0, .125, 0); // 천보루 행각과 삼문 줄행랑 사이에 끼므로 조금 작게
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.cyl(.11, .12, 2.6, 8, R.redCol, sx * 1.05, 1.55, sz * 1.05);
        P.box(2.3, .16, .16, R.redCol, 0, 2.7, 0); P.box(2.3, .12, 2.3, R.band, 0, 2.82, 0); P.flush(g);
        paljakMesh(g, 3.3, 3.3, 1.15, 2.88);
        const S = 1.0, prof = [[0, 0], [.6, 0], [.59, .05], [.55, .16], [.5, .48], [.46, .86], [.42, 1.08], [.36, 1.18], [.22, 1.24], [0, 1.25]].map(([r, y]) => new THREE.Vector2(r * S, y * S));
        const bm = new THREE.MeshStandardMaterial({ color: '#6b5a3a', metalness: .6, roughness: .4 });
        mesh(g, new THREE.LatheGeometry(prof, 40), bm, 0, .55, 0); mesh(g, new THREE.TorusGeometry(.13, .04, 6, 14), bm, 0, .55 + 1.25 * S + .14, 0);
        mesh(g, new THREE.CylinderGeometry(.02, .02, .3, 6), R.lattice, 0, 2.45, 0);
        const dang = new THREE.CylinderGeometry(.07, .07, 1.1, 10); dang.rotateZ(Math.PI / 2); mesh(g, dang, R.wood, -1.15, 1.2, 0); // 당목
        plate(h, g, '불음각', .95, 0, 2.6, 1.22, { px: 44 }); colG(h, g, 0, 0, 1.4, 1.4);
        signpost(h, ...toSite(g, -1.9, 2.0), LEFT, '불음각', '아침저녁 예불 때 울리는 범종 (1985)', 1.4);
        spot(g, 0, 2.4, 3.4, '용주사 불음각', '천보루 왼쪽 앞 · 아침저녁 예불 때 울리는 큰 범종을 모셨어요'); }
      // ── 대웅보전 뒤: 전강대종사 사리탑 (2005, 높이 7m 삼층석탑 · 법천사 지광국사탑을 본뜸) — 크기를 줄여 나타냄
      { const x = IX - 10.4, z = -11.2, P = parts(), G = R.granite, G2 = R.granite2, g = grp(h, x, z, 0);
        P.box(3.6, .25, 3.6, G2, 0, .125, 0); P.box(3.0, .35, 3.0, G, 0, .42, 0);
        P.box(2.5, .55, 2.5, G, 0, .87, 0); for (const sx of [-1, 1]) for (const sz of [-.5, .5]) { P.box(.5, .3, .04, G2, sz * 1.6, .87, sx * 1.26); P.box(.04, .3, .5, G2, sx * 1.26, .87, sz * 1.6); } // 기단 면 조각
        P.box(2.7, .16, 2.7, G2, 0, 1.22, 0); P.box(2.1, .5, 2.1, G, 0, 1.55, 0); P.box(2.4, .14, 2.4, G2, 0, 1.87, 0);
        let y = 1.94; [[1.15, .95, 2.2], [.95, .5, 1.85], [.8, .45, 1.6]].forEach(([b, hh, rw], i) => {     // 탑신 3층 + 지붕돌
          P.box(b, hh, b, G, 0, y + hh / 2, 0); if (!i) for (const sx of [-1, 1]) { P.box(.4, .5, .03, G2, 0, y + hh / 2, sx * b / 2); P.box(.03, .5, .4, G2, sx * b / 2, y + hh / 2, 0); } // 1층 팔상성도 면
          y += hh; P.box(rw, .16, rw, G2, 0, y + .08, 0); P.box(rw * .72, .14, rw * .72, G2, 0, y + .23, 0); y += .3; });
        P.cyl(.16, .24, .25, 8, G, 0, y + .12, 0); P.ball(.2, G2, 0, y + .42, 0, 1, .8, 1); P.cyl(.05, .08, .7, 8, G, 0, y + .85, 0); P.ball(.1, G2, 0, y + 1.25, 0); // 상륜
        P.flush(g); h.col(x, z, 1.9, 1.9);
        signpost(h, x - 3.0, z + 1.6, 0, '전강대종사 사리탑', '2005년 · 높이 7m 삼층석탑', 1.5);
        spotAt(x - 2.4, z + 2.6, 3.2, '용주사 전강대종사 사리탑', '중앙선원 조실이던 전강 스님의 사리를 모신 삼층석탑(2005)이에요'); }
      // ── 뒷담 너머 소나무 숲: 중앙선원 (1986, 스님들이 정진하는 선원 · 들어갈 수 없음)
      { const z = h.YZ0 - 8.5, g = grp(h, 4, z, 0); smallHall(h, g, { w: 13, d: 5.4, hh: 2.3, roofH: 1.4, plaque: '중앙선원', plaqueW: 1.4 });
        const g2 = grp(h, 14.4, z + 3.2, RIGHT); smallHall(h, g2, { w: 6, d: 4, hh: 2.0, roofH: 1.1 });
        colG(h, g, 0, 0, 7, 3); colG(h, g2, 0, 0, 3.3, 2.3);
        signpost(h, 4, h.YZ0 + 1.3, 0, '중앙선원 (담 너머)', '스님들이 정진하는 선원 · 조용히 지나 주세요', 1.6);
        spotAt(4, h.YZ0 + 2.4, 3.2, '용주사 중앙선원', '담 너머 소나무 숲속, 스님들이 정진하는 선원이에요 (들어갈 수 없어요)'); }
      // ── 들어오는 길: 왼쪽 효행박물관 · 해우소, 오른쪽 카페 화산(사천왕문 옆) · 매표소 · 식수대 · 효림당
      { const w = 11, d = 5.2, g = grp(h, -11.2, YZ1 + 6.5, LEFT); smallHall(h, g, { w, d, hh: 2.5, roofH: 1.4, plaque: '효행박물관', plaqueW: 1.6 }); colG(h, g, 0, 0, w / 2 + .3, d / 2 + .3);
        spot(g, 0, 3.6, 3.4, '용주사 효행박물관', '부모은중경판과 정조의 글 등 성보를 모신 박물관이에요'); }
      { const g = grp(h, -8.4, YZ1 + 14.2, LEFT); shed(g, { w: 3.6, d: 2.6, plaque: '해우소' }); colG(h, g, 0, 0, 2.1, 1.6); }
      { const w = 6.5, d = 4.2, zc = YZ1 + 11.8, g = grp(h, 9.6, zc, RIGHT); smallHall(h, g, { w, d, hh: 2.2, gable: true, roofH: 1.0, plaque: '카페 화산', plaqueW: 1.3 }); colG(h, g, 0, 0, w / 2 + .3, d / 2 + .3);
        const P = parts(); for (const dz of [-1.6, 1.6]) { P.cyl(.38, .38, .06, 14, R.wood, 6.3, .72, zc + dz); P.cyl(.05, .06, .72, 8, R.wood, 6.3, .36, zc + dz);
          for (const dx of [-.62, .62]) P.cyl(.18, .18, .42, 10, M('#9b7a52'), 6.3 + dx, .21, zc + dz); } P.flush(h.site); h.col(6.3, zc, 1, 2.2);
        signpost(h, 6.2, zc - 3.1, 0, '카페 화산', '사천왕문 옆 쉼터 · 09:00–18:00', 1.4);
        spot(g, 0, 3.4, 3.0, '용주사 카페 화산', '사천왕문 옆 쉼터 · 주지 스님이 그린 그림도 걸려 있어요'); }
      { const g = grp(h, 6.3, YZ1 + 7.6, RIGHT); shed(g, { w: 2.0, d: 1.6, hh: 1.9, plaque: '매표소' }); colG(h, g, 0, 0, 1.3, 1.1); }
      { const P = parts(), x = 5.4, z = YZ1 + 5.0; P.box(1.4, .7, .7, R.granite, x, .35, z); P.box(1.2, .05, .5, glow('#7fb6c8', .35), x, .68, z); // 식수대
        P.box(.08, .5, .08, M('#8c8c8c', { metalness: .5 }), x, .95, z - .22); P.flush(h.site); h.col(x, z, .8, .45); }
      { const w = 9, d = 4.6, g = grp(h, 18.4, YZ1 + 6.4, RIGHT); smallHall(h, g, { w, d, hh: 2.2, gable: true, roofH: 1.1, plaque: '효림당', plaqueW: 1.2 }); colG(h, g, 0, 0, w / 2 + .3, d / 2 + .3); }
    }
    if (kind === 'yongjuUpper') { // 용주사 대웅보전 둘레 (누리집 가람 배치도): 왼쪽 시방칠등각(옛 칠성각) · 그 너머 천불전(옛 향로전 자리, 동쪽으로 문), 오른쪽 호성전(사도세자 제각) · 그 오른쪽 지장전
      { const g = grp(h, -(IX - 5.4), 1.9, 0); // 시방칠등각: 대웅보전과 천불전 사이
        smallHall(h, g, { w: 3.0, d: 2.2, hh: 1.65, gable: true, roofH: .9, plaque: '시방칠등각', plaqueW: 1.25 });
        colG(h, g, 0, 0, 1.75, 1.35);
        spot(g, 0, 2.0, 2.4, '용주사 시방칠등각', '옛 칠성각 · 칠성탱화와 산신·독성탱화를 모신 맞배지붕 전각이에요'); }
      { const w = 3.4, d = 2.6, hh = 1.95, g = grp(h, -(IX - 1.9), -2.6, LEFT); // 천불전: 동쪽을 뺀 세 면에 아홉 층 단 + 가운데 삼세불
        smallHall(h, g, { w, d, hh, roofH: 1.0, open: 2.6, plaque: '천불전', plaqueW: 1.0 });
        colG(h, g, 0, 0, w / 2 + .3, d / 2 + .3);
        const NT = 9, ty = t => .42 + t * .165, P = parts();
        for (let t = 0; t < NT; t++) P.box(w - .4, .07, .2, R.wood, 0, ty(t), -d / 2 + .25);
        for (const sx of [-1, 1]) for (let t = 0; t < NT; t++) P.box(.2, .07, d - .65, R.wood, sx * (w / 2 - .26), ty(t), -.08);
        P.box(1.3, .32, .5, R.redCol, 0, .46, -d / 2 + .8); P.flush(g);
        const one = mergeGeometries([new THREE.ConeGeometry(.04, .06, 8).translate(0, .03, 0), new THREE.SphereGeometry(.019, 8, 6).translate(0, .078, 0)]), pts = [];
        for (let t = 0; t < NT; t++) for (let i = 0; i < 32; i++) pts.push([-w / 2 + .3 + i * (w - .6) / 31, ty(t) + .035, -d / 2 + .25]);
        for (const sx of [-1, 1]) for (let t = 0; t < NT; t++) for (let i = 0; i < 13; i++) pts.push([sx * (w / 2 - .26), ty(t) + .035, -d / 2 + .45 + i * (d - 1.05) / 12]);
        const im = new THREE.InstancedMesh(one, k.buddhaW, pts.length), m4 = new THREE.Matrix4();
        pts.forEach(([px, py, pz], i) => { m4.makeTranslation(px, py, pz); im.setMatrixAt(i, m4); }); g.add(im);
        for (const [dx, kk] of [[-.42, 'biro'], [0, 'sakya'], [.42, 'amita']]) { // 가운데 삼세불 (석가모니·비로자나·아미타)
          const ph = new THREE.Group(); ph.position.set(dx, .62, -d / 2 + .8); g.add(ph); mesh(ph, new THREE.SphereGeometry(.15, 12, 8), R.gold, 0, .14, 0).scale.set(1.2, .9, .9); mesh(ph, new THREE.SphereGeometry(.09, 12, 8), R.gold, 0, .34, 0);
          const [fx, fz] = toSite(g, dx, -d / 2 + .8); h.fig.push({ k: kk, tint: 'gold', lx: fx, ly: .62, lz: fz, h: dx ? .52 : .58, ry: g.rotation.y, ph: [ph] }); }
        spot(g, 0, 2.3, 2.8, '용주사 천불전', '옛 향로전 자리에 1993년 지은 법당 · 세 면의 아홉 층 단에 작은 부처님 천 분을 모셨어요'); }
      { const w = 3.6, d = 2.6, g = grp(h, IX - 7.5, -.4, 0); // 호성전: 사도세자·혜경궁 홍씨·정조·효의왕후의 위패 (오른쪽 곁에 지장전)
        smallHall(h, g, { w, d, hh: 1.85, roofH: 1.05, open: 2.0, plaque: '호성전', plaqueW: 1.0 });
        colG(h, g, 0, 0, w / 2 + .3, d / 2 + .3);
        const P = parts(), z0 = -d / 2 + .55;
        P.box(1.7, .5, .5, R.redCol, 0, .55, z0); P.box(1.8, .05, .56, R.wood, 0, .82, z0);
        for (let i = 0; i < 4; i++) { const x = -.54 + i * .36; P.box(.15, .44, .05, M('#2b2420'), x, 1.07, z0); P.box(.2, .07, .09, R.gold, x, 1.3, z0); P.box(.2, .05, .1, R.wood, x, .86, z0); } // 위패 넷
        P.flush(g);
        spot(g, 0, 2.2, 2.6, '용주사 호성전', '정조가 아버지 사도세자의 위패를 모시려고 대웅보전 곁에 지은 전각이에요'); }
      { const w = 3.3, d = 2.4, hh = 1.75, g = grp(h, IX - 2.65, -.4, 0); // 지장전: 정면 3칸·측면 2칸 맞배지붕 · 가운데 칸에만 문 · 지장삼존과 명부시왕
        smallHall(h, g, { w, d, hh, gable: true, roofH: .95, open: 1.15, plaque: '지장전', plaqueW: 1.0 });
        colG(h, g, 0, 0, w / 2 + .3, d / 2 + .3);
        const P = parts(), z0 = -d / 2 + .5, y0 = .3, gold = R.gold, robe = M('#8a3a2c'), robe2 = M('#3f6a5a'), skin = M('#e6c9a0'), hat = k.dark;
        P.box(1.5, .42, .45, R.redCol, 0, y0 + .21, z0);                                                     // 불단
        P.ball(.2, gold, 0, y0 + .58, z0 + .04, 1.25, .62, .9); P.ball(.14, gold, 0, y0 + .82, z0, 1.05, 1.25, .8); // 지장보살: 민머리 스님 모습
        P.ball(.085, M('#4d6b66'), 0, y0 + 1.03, z0 + .01, 1, 1.08, 1); P.cyl(.007, .007, .62, 5, gold, .2, y0 + .78, z0 + .08); // 석장
        for (const sx of [-1, 1]) { const x = sx * .52; // 도명존자(스님) · 무독귀왕(관복)
          P.cyl(.07, .1, .48, 8, sx < 0 ? robe : robe2, x, y0 + .66, z0 + .06); P.ball(.065, sx < 0 ? M('#d6b88f') : skin, x, y0 + .96, z0 + .06);
          if (sx > 0) P.box(.1, .06, .1, hat, x, y0 + 1.04, z0 + .06); }
        for (const sx of [-1, 1]) { P.box(.32, .2, d - .75, R.wood, sx * (w / 2 - .26), y0 + .1, .05); // 양옆 벽을 따라 앉은 명부시왕 다섯 분씩
          for (let i = 0; i < 5; i++) { const z = -d / 2 + .52 + i * .33, x = sx * (w / 2 - .26);
            P.cyl(.06, .08, .26, 8, i % 2 ? robe2 : robe, x, y0 + .33, z); P.ball(.05, skin, x, y0 + .51, z); P.box(.1, .055, .07, hat, x, y0 + .58, z); } }
        P.flush(g);
        spot(g, 0, 2.1, 2.4, '용주사 지장전', '지장보살과 저승의 열 왕(명부시왕)을 모신 전각 · 1894년 만의사에서 옮겨 온 존상들이에요'); }
    }
    if (kind === 'yonghwagak') { // 봉녕사 용화각: 대적광전 오른쪽 · 1970년대 법당 터를 닦다 땅속에서 나온 고려 후기 석조삼존불 (모래가 많은 돌이라 많이 닳음, 연꽃 대좌는 또렷)
      const w = 3.4, d = 2.6, hh = 2.0, g = grp(h, YX - 4.0, -1.0, 0);
      smallHall(h, g, { w, d, hh, roofH: 1.05, open: 2.6, plaque: '용화각', plaqueW: 1.0 });
      colG(h, g, 0, 0, w / 2 + .3, d / 2 + .3);
      const sand = M('#b9a689', { roughness: 1 }), sand2 = M('#a79478', { roughness: 1 }), P = parts(), zz = -d / 2 + .62, y0 = .62;
      P.box(2.7, .32, .86, h.MAT.stone, 0, .46, zz);                                  // 불단
      const seat = (x, r) => { P.cyl(r * .78, r * .92, .16, 16, sand2, x, y0 + .08, zz); // 연꽃 대좌 (꽃잎은 또렷하게)
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; P.ball(r * .26, sand, x + Math.sin(a) * r * .9, y0 + .15, zz + Math.cos(a) * r * .9, 1, .55, 1, 1); }
        return y0 + .2; };
      { const yb = seat(0, .46); // 본존: 앉은 모습 · 오른손은 무릎, 왼손은 가슴 (닳아서 윤곽만)
        P.ball(.38, sand, 0, yb + .14, zz + .04, 1.25, .42, .82, 1);
        P.ball(.27, sand, 0, yb + .5, zz - .02, 1.02, 1.5, .78, 1);
        P.ball(.15, sand2, 0, yb + .96, zz, 1, 1.08, .95, 1); P.ball(.07, sand2, 0, yb + 1.1, zz - .01, 1, 1, 1, 0);
        P.ball(.07, sand2, .24, yb + .2, zz + .26, 1, .8, 1.2, 0); P.ball(.07, sand2, -.08, yb + .55, zz + .18, 1, .8, .9, 0); }
      for (const sx of [-1, 1]) { const x = sx * .92, yb = seat(x, .28); // 좌우 협시: 선 모습 (형체가 많이 닳음)
        P.ball(.18, sand, x, yb + .46, zz, 1, 2.5, .78, 1);
        P.ball(.11, sand2, x, yb + 1.0, zz, 1, 1.1, .95, 1); }
      P.flush(g);
      spot(g, 0, 2.3, 2.8, '봉녕사 용화각 석조삼존불', '1970년대 땅속에서 나온 고려 후기 돌부처님 세 분 · 많이 닳았지만 연꽃 대좌는 또렷해요');
    }
    if (kind === 'yaksaBojeon') { // 봉녕사 약사보전: 대적광전 왼쪽
      const g = grp(h, -(YX - 4.0), -.6, 0);
      smallHall(h, g, { w: 3.4, d: 2.6, hh: 1.9, roofH: 1.05, plaque: '약사보전', plaqueW: 1.1 });
      colG(h, g, 0, 0, 2.0, 1.6);
      spot(g, 0, 2.2, 2.6, '봉녕사 약사보전', '대적광전 왼쪽 · 아픈 이를 낫게 해 주는 약사여래를 모신 전각이에요');
    }
    if (kind === 'hyangha') { // 봉녕사 향하당(종무소): 마당 오른쪽 앞 · 곁 담장을 따라 능소화
      const g = grp(h, YX - 1.75, D / 2 + 10.4, RIGHT);
      smallHall(h, g, { w: 4.6, d: 2.4, hh: 1.9, gable: true, roofH: .95, plaque: '향하당', plaqueW: 1.0 });
      colG(h, g, 0, 0, 2.6, 1.5);
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
      paljakMesh(g, w + 1.4, d + 1.4, 1.1, 3.05);
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
      signpost(h, -2.5, YZ1 + 5.8, Math.PI / 2, '십리벚꽃길', '화개장터에서 쌍계사까지 이어지는 벚꽃길', 1.5); // 일주문 왼쪽은 사찰 안내판 자리 · 벚나무 사이에서 길을 바라봄
      spotAt(0, YZ1 + 8, 4.5, '쌍계사 십리벚꽃길', '화개장터에서 쌍계사까지 봄마다 벚꽃이 길을 덮어요');
    }
    if (kind === 'uhwagak') { // 송광사: 일주문을 지나 계곡 위 무지개다리 삼청교 + 그 위 누각 우화각을 건너 경내로 (탑·석등은 없음)
      const zc = D / 2 + 15.3;
      streamAcross(h, zc, { wd: 3.0, half: YX - .25, gap: 1.4, bankH: .85, rnd });
      const b = archBridge(h, zc, { len: 4.4, w: 2.8, deck: 1.0, r: .82, steps: 3 });
      uhwagak(h, zc, b.deck);
      signpost(h, -2.8, zc + 2.85, 0, '우화각 · 삼청교', '계곡 위 무지개다리와 그 위 누각', 1.5);
      spotAt(0, zc, 3.4, '송광사 우화각 · 삼청교', '계곡 위 무지개다리(삼청교)와 그 위 누각(우화각)을 건너 경내로 들어가요');
    }
    if (kind === 'geukrakgyo') { // 마곡사: 태화천이 절을 남원·북원으로 가르고, 극락교를 건너 북원(대광보전·오층석탑)으로
      const zc = D / 2 + 16.05, w = 3.0, bl = 4.2; // 탑돌이 길(탑에서 2.7m)과 일주문 사이에 맞춤
      streamAcross(h, zc, { wd: 3.6, half: YX - .25, gap: w / 2, bankH: .55, rocks: 12, rnd });
      const b = archBridge(h, zc, { len: bl, w, deck: .66, r: .42, steps: 2, mat: R.granite2, arches: 3 }); // 홍예 세 칸 · 평평한 다리
      for (const sx of [-1, 1]) { // 흰 돌난간
        mesh(h.site, new THREE.BoxGeometry(.12, .1, bl), R.rail, sx * (w / 2 - .08), b.deck + .66, zc);
        for (let z = -bl / 2 + .1; z <= bl / 2 - .09; z += .6) mesh(h.site, new THREE.BoxGeometry(.15, .66, .15), R.rail, sx * (w / 2 - .08), b.deck + .33, zc + z);
      }
      signpost(h, -2.9, zc + 2.45, 0, '극락교', '태화천을 건너 북원으로', 1.4);
      spotAt(0, zc, 3.6, '마곡사 극락교 · 태화천', '태화천을 사이에 두고 남원과 북원으로 나뉜 절이에요 · 극락교를 건너면 북원이에요');
    }
    if (kind === 'cheonbo') { // 용주사: 홍살문 → 삼문(양옆 줄행랑) → 세존 사리탑 → 천보루 아래 통로 → 대웅보전 (정조가 궁궐처럼 지은 왕실 원찰)
      const zc = D / 2 + 11.0, wallW = M('#efe6d2');
      hongsalmun(h, YZ1 + 6.5);
      signpost(h, -3.3, YZ1 + 8.7, .55, '홍살문', '신성한 곳임을 알리는 붉은 문', 1.3);
      spotAt(0, YZ1 + 6.5, 2.4, '용주사 홍살문', '왕릉이나 궁궐 앞에 세우는 붉은 홍살문이 절 앞에 서 있어요');
      cheonboru(h, zc);
      signpost(h, -3.3, zc + 2.75, 0, '천보루 · 보물', '아래로 걸어 들어가는 2층 누각', 1.45);
      signpost(h, 3.3, zc + 2.75, 0, '세존 사리탑', '부처님 사리를 모셨다는 고려 오층석탑', 1.45);
      spotAt(0, zc + 2.3, 2.0, '용주사 천보루', '1790년 정조 때 세운 2층 누각 · 아래 통로를 지나면 대웅보전이에요');
      spotAt(0, YZ1 - 1.1, 1.9, '용주사 세존 사리탑', '삼문과 천보루 사이에 선 고려 오층석탑 · 부처님 사리를 모셨다고 전해져요');
      for (const sx of [-1, 1]) { // 삼문 양옆 줄행랑: 담장 안쪽에 붙은 긴 맞배지붕 행랑 (집마다 따로 합침)
        const xa = 4.25, xb = IX - .35, ln = xb - xa, cx = sx * (xa + xb) / 2, z = YZ1 - .95, n = Math.max(3, Math.round(ln / 1.6)), P = parts();
        P.box(ln, .25, 1.8, h.MAT.stone, cx, .125, z);
        P.box(ln, 1.9, 1.5, wallW, cx, 1.2, z + .05);
        for (let i = 0; i <= n; i++) P.cyl(.09, .1, 1.95, 8, R.redCol, sx * (xa + ln * i / n), 1.22, z - .78);
        for (let i = 0; i < n; i++) P.box(ln / n * .42, .46, .05, R.lattice, sx * (xa + ln * (i + .5) / n), 1.55, z - .72); // 작은 창
        P.box(ln + .1, .16, 1.75, R.band, cx, 2.2, z);
        const rr = gableRoofGeo(THREE, ln + .4, 2.6, .8, .08); rr.translate(cx, 2.28, z); P.put(rr, R.roofTile);
        P.flush(h.site); h.col(cx, z, ln / 2, .9);
      }
    }
    if (kind === 'firRoad') { // 월정사 전나무숲길: 일주문 밖 길 양옆으로 곧게 자란 전나무
      const Pc = parts(), tr = [], zMax = YZ1 + Math.max(9, (h.RG || 20) - 10.5);
      for (let z = YZ1 + 2.8; z < zMax; z += 2.1 + rnd() * .6) for (const sx of [-1, 1]) {
        firTree(Pc, tr, h, sx * (3.0 + rnd() * .5), z + rnd() * .5, 1.15 + rnd() * .35, rnd);
        if (rnd() < .65) firTree(Pc, tr, h, sx * (4.7 + rnd() * .8), z + 1.1, .95 + rnd() * .4, rnd);
      }
      Pc.flush(h.site);
      { const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(.13, .2, 4, 7).translate(0, 0, 0), k.bark, tr.length); tr.forEach((m4, i) => im.setMatrixAt(i, m4)); im.castShadow = true; im.receiveShadow = true; h.site.add(im); }
      signpost(h, 2.35, YZ1 + 3.7, -Math.PI / 2, '전나무숲길', '일주문에서 금강교까지 1km 남짓', 1.4);
      spotAt(0, YZ1 + 6, 4.2, '월정사 전나무숲길', '일주문에서 금강교까지 1km 남짓 전나무가 늘어선 숲길이에요');
    }
    if (kind === 'seongnyeonji') { // 법주사 석련지 (국보): 구름무늬 받침 위에 올린 커다란 돌 연꽃 물그릇
      const g = grp(h, -FX, FZ, LEFT), P = parts(), G = R.granite, G2 = R.granite2, GD = BOWL();
      P.cyl(1.05, 1.1, .14, 8, G2, 0, .07, 0); P.cyl(.82, .92, .12, 8, G, 0, .2, 0); P.cyl(.68, .78, .1, 8, G, 0, .31, 0); // 8각 바닥돌 · 굄
      for (let i = 0; i < 8; i++) { const a = (i + .5) / 8 * Math.PI * 2; P.ball(.18, G, Math.sin(a) * .58, .4, Math.cos(a) * .58, 1.3, .45, 1.3); } // 복련
      P.cyl(.34, .44, .3, 10, G, 0, .5, 0);
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; P.ball(.2 + rnd() * .08, G2, Math.sin(a) * .3, .72 + (i % 3) * .07, Math.cos(a) * .3, 1.3, .7, 1.3, 1); } // 구름무늬 받침
      const prof = [[.42, 0], [.75, .06], [1.05, .22], [1.25, .48], [1.33, .78], [1.3, .9], [1.2, .92], [1.15, .55], [.95, .35], [.5, .26], [0, .24]].map(([r, y]) => new THREE.Vector2(r, y));
      P.put(new THREE.LatheGeometry(prof, 32).translate(0, .9, 0), GD); // 위가 열린 큰 돌그릇
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, pt = new THREE.SphereGeometry(1, 10, 6); pt.scale(.2, .34, .08); pt.rotateX(-.35); pt.rotateY(a); pt.translate(Math.sin(a) * 1.27, 1.32, Math.cos(a) * 1.27); P.put(pt, G2); } // 연잎 돋을새김
      for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; P.box(.07, .2, .07, G2, Math.sin(a) * 1.25, 1.92, Math.cos(a) * 1.25); } // 동자주
      P.put(new THREE.TorusGeometry(1.25, .035, 4, 40).rotateX(Math.PI / 2).translate(0, 2.02, 0), G2); // 난간대
      P.flush(g);
      const wt = mesh(g, new THREE.CircleGeometry(1.12, 28), R.water, 0, 1.68, 0, false); wt.rotation.x = -Math.PI / 2;
      { // 보호각: 붉은 기둥 여섯 · 육모지붕 · 낮은 붉은 난간 (지금은 이 안에 모셔 둠)
        const Q = parts(), RR = 2.25, ph = 2.7;
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6, px = Math.sin(a) * RR, pz = Math.cos(a) * RR; mesh(g, new THREE.CylinderGeometry(.11, .12, ph, 10), R.redCol, px, ph / 2, pz); }
        for (let i = 0; i < 6; i++) { const a0 = i / 6 * Math.PI * 2 + Math.PI / 6, a1 = a0 + Math.PI / 3, mx = (Math.sin(a0) + Math.sin(a1)) / 2 * RR, mz = (Math.cos(a0) + Math.cos(a1)) / 2 * RR, ry = (a0 + a1) / 2;
          Q.box(RR + .2, .2, .16, R.band, mx, ph + .02, mz, ry);
          if (i !== 0) mesh(g, new THREE.BoxGeometry(RR - .25, .08, .08, 1, 1, 1).rotateY(ry), R.redCol, mx, .62, mz); } // 낮은 난간 (앞 한 칸은 열어 둠)
        const roof = hexRoofGeo(RR + 1.15, 1.6, .34); roof.translate(0, ph + .12, 0); Q.put(roof, R.roofTile); // 처마 귀가 들린 육모지붕
        Q.put(new THREE.CylinderGeometry(RR + 1.05, RR + .2, .12, 6, 1, true).rotateY(Math.PI / 6).translate(0, ph + .1, 0), R.band);
        Q.put(new THREE.SphereGeometry(.16, 10, 8).translate(0, ph + 1.6, 0), h.MAT.stoneDark);
        Q.flush(g);
      }
      colG(h, g, 0, 0, 1.4, 1.4);
      signpost(h, ...toSite(g, 1.9, 1.5), LEFT, '석련지 · 국보', '돌로 만든 연꽃 모양 물그릇', 1.45);
      spot(g, 0, 2.2, 3.4, '법주사 석련지', '구름 위에 뜬 연꽃 같은 통일신라의 돌 물그릇이에요');
    }
    if (kind === 'hwaeomTwin') { // 화엄사 동·서 오층석탑: 대웅전 앞마당에 나란히 선 통일신라 석탑 (각황전에서 보면 오른쪽 앞)
      const z = FZ + .6, xw = FX - 1.9, xe = FX + 1.9;
      stoneTiers(h, xw, z, 5, .88);                            // 서탑: 2층 기단
      stoneTiers(h, xe, z, 5, .88, false, { single: true });    // 동탑: 단층 기단
      h.col(xw, z, 1.2, 1.2); h.col(xe, z, 1.0, 1.0);
      signpost(h, FX, z + 2.6, 0, '동·서 오층석탑', '대웅전 앞마당에 나란히 선 보물', 1.45);
      spotAt(FX, z + 2.3, 3.4, '화엄사 동·서 오층석탑', '대웅전 앞마당에 나란히 선 통일신라 석탑 두 기예요');
    }
    if (kind === 'baeksong') { // 조계사 백송 (천연기념물): 하얗게 벗겨지는 껍질 · 위에서 갈라진 가지 중 대웅전 쪽 세 가지만 살아 있음
      const x = SX + .3, z = -1.6, Pt = parts(), Pb = parts(), wb = M('#e9e7df'), wg = M('#b9bcae'), nd = M('#6f9660');
      Pt.cyl(.28, .36, 4.4, 9, wb, x, 2.2, z); Pt.cyl(.36, .5, .3, 9, wb, x, .15, z);
      for (let i = 0; i < 14; i++) Pt.box(.12 + rnd() * .1, .22 + rnd() * .3, .05, wg, x + Math.cos(i * 1.7) * .3, .4 + rnd() * 3.8, z + Math.sin(i * 1.7) * .3, -i * 1.7); // 얼룩덜룩한 흰 껍질
      stoneRing(Pt, x, z, 1.25, h.MAT.stoneDark);
      Pt.flush(h.site);
      const top = V(x, 4.3, z);
      for (const [dx, dy, dz] of [[-2.4, 2.3, -.7], [-2.0, 3.2, .9], [-1.0, 3.7, -.2]]) { // 대웅전(왼쪽) 쪽으로 뻗은 세 가지
        const e = V(x + dx, 4.3 + dy, z + dz), mid = V(x + dx * .45, 4.3 + dy * .65, z + dz * .4);
        Pb.limb(wb, top, mid, .22, .16, 7); Pb.limb(wb, mid, e, .16, .08, 6);
      }
      for (let j = 0; j < 26; j++) { const a = rnd() * 6.28, rr = Math.sqrt(rnd()) * 2.1; Pb.ball(.5 + rnd() * .3, rnd() < .6 ? nd : M('#5a8350'), x - 1.4 + Math.cos(a) * rr, 7.1 + (rnd() - .4) * 1.4 - rr * .3, z + Math.sin(a) * rr * .9, 1.15, .62, 1.15, 1); } // 둥근 솔잎 머리
      Pb.flush(h.site);
      for (const [dx, dz] of [[-1.7, -.4], [-1.5, .7]]) mesh(h.site, new THREE.CylinderGeometry(.05, .05, 5.2, 6), M('#5b5f63'), x + dx, 2.6, z + dz); // 버팀대
      h.col(x, z, 1.25, 1.25);
      signpost(h, x - 1.6, z + 1.8, 0, '조계사 백송', '천연기념물 · 하얀 껍질의 소나무', 1.4);
      spotAt(x - .8, z + 1.6, 3.0, '조계사 백송', '나무껍질이 하얗게 벗겨지는 귀한 소나무예요');
    }

    if (kind === 'hwaeomDaeung') { // 화엄사 대웅전 (보물, 정면 5칸): 각황전 오른쪽 · 앞마당에 동·서 오층석탑
      const g = grp(h, FX + .9, D / 2 + 4.4);
      smallHall(h, g, { w: 6.0, d: 4.0, hh: 2.4, roofH: 1.6, plaque: '대웅전', plaqueW: 1.3 });
      for (let i = 1; i < 5; i++) mesh(g, new THREE.CylinderGeometry(.09, .1, 2.4, 8), R.redCol, -3 + i * 1.2, 1.5, 2.0);
      colG(h, g, 0, 0, 3.3, 2.3);
      spot(g, -2.4, 3.6, 3.0, '화엄사 대웅전', '각황전 오른쪽, 동·서 오층석탑 뒤에 선 화엄사의 대웅전이에요');
    }
    if (kind === 'chimgye') { // 송광사 침계루 (2026 보물): 계곡을 베고 선 정면 7칸 2층 누각 — 계곡 쪽 기둥은 물가에, 반대편은 축대 위에
      const zc = D / 2 + 15.3, x0 = -3.6, x1 = -(YX - .6), cx = (x0 + x1) / 2, len = x0 - x1, zb = zc - 1.9, dep = 3.4, z0 = zb - dep / 2, y1 = 2.0, P = parts();
      const xs = Array.from({ length: 8 }, (_, i) => x1 + len * i / 7);
      for (const x of xs) { // 아래층: 물가 쪽 긴 돌기둥 · 축대 쪽 짧은 기둥
        mesh(h.site, new THREE.BoxGeometry(.3, y1, .3), R.granite, x, y1 / 2, zb + dep / 2 - .1);
        mesh(h.site, new THREE.BoxGeometry(.3, y1, .3), R.granite, x, y1 / 2, zb - dep / 2 + .15);
      }
      P.box(len + .4, .9, .5, R.rock2, cx, .45, z0 + .1);                              // 축대
      P.box(len + .6, .2, dep + .4, R.wood, cx, y1 + .1, zb);                          // 위층 마루
      const uh = 1.8, yu = y1 + .2;
      for (const x of xs) for (const sz of [-1, 1]) P.cyl(.12, .13, uh, 10, R.redCol, x, yu + uh / 2, zb + sz * dep / 2);
      for (let i = 0; i < 7; i++) { const cxx = (xs[i] + xs[i + 1]) / 2, bw = len / 7 - .3; for (const sz of [-1, 1]) P.box(bw, uh - .7, .06, R.lattice, cxx, yu + .35 + (uh - .7) / 2, zb + sz * dep / 2); }
      for (const sx of [x0, x1]) P.box(.08, uh, dep, M('#efe6d2'), sx, yu + uh / 2, zb);
      P.box(len + .5, .1, .06, R.wood, cx, yu + .55, zb + dep / 2 + .25); for (let x = x1; x <= x0 + .01; x += .4) P.box(.04, .5, .04, R.lattice, x, yu + .3, zb + dep / 2 + .25); // 계곡 쪽 난간
      P.box(len + .6, .26, dep + .3, R.band, cx, yu + uh + .13, zb);
      paljakPut(P, len + 2.6, dep + 2.4, 1.8, cx, yu + uh + .26, zb);
      P.flush(h.site);
      const g = grp(h, cx, zb + dep / 2 + .3); plate(h, g, '침계루', 1.3, 0, yu + uh - .15, 0, { px: 46 });
      h.col(cx, z0 + .5, len / 2 + .3, .9);
      for (const [dz, r] of [[-1.15, .34], [-.38, .3], [.4, .33], [1.16, .3]]) mesh(h.site, new THREE.CylinderGeometry(r, r + .05, .22, 9), R.rock, 6.3 + dz * .3, .11, zc + dz); // 징검다리
      spotAt(cx, zb - dep / 2 - 1.6, 3.4, '송광사 침계루', '계곡을 베고 선 2층 누각 · 스님들이 공부하던 강학 공간이에요');
    }
    if (kind === 'yongjuWings') { // 용주사: 천보루 양옆 7칸 행각 + 동쪽 나유타료(승당)·서쪽 만수리실(선당)이 대웅보전까지 ㅁ자로 마당을 감쌈
      const zc = D / 2 + 11.0, wall = M('#efe6d2'); // 천보루 자리 (cheonbo와 같게)
      for (const sx of [-1, 1]) { // 집마다 따로 합쳐야 부딪힘 상자가 마당을 덮지 않음
        let P = parts();
        const xa = 6.0, xb = IX - 2.9, cx = sx * (xa + xb) / 2, ln = xb - xa; // 행각
        P.box(ln, .3, 2.6, h.MAT.stone, cx, .15, zc); P.box(ln, 2.2, 2.2, wall, cx, 1.4, zc);
        for (let i = 0; i <= 7; i++) for (const sz of [-1, 1]) P.cyl(.1, .11, 2.2, 8, R.redCol, sx * (xa + ln * i / 7), 1.4, zc + sz * 1.1);
        for (let i = 0; i < 7; i++) P.box(ln / 7 - .4, .7, .05, R.lattice, sx * (xa + ln * (i + .5) / 7), 1.75, zc - 1.12);
        P.box(ln + .1, .2, 2.3, R.band, cx, 2.45, zc);
        const r1 = gableRoofGeo(THREE, ln + .6, 3.6, 1.1, .1); r1.translate(cx, 2.55, zc); P.put(r1, R.roofTile);
        P.flush(h.site); P = parts();
        const bz0 = D / 2 + 3.2, bz1 = zc + 1.3, bx = sx * (IX - 1.45), bl = bz1 - bz0, bzc = (bz0 + bz1) / 2; // 나유타료·만수리실 (마당 양옆 긴 집)
        P.box(2.9, .35, bl, h.MAT.stone, bx, .175, bzc); P.box(2.5, 2.3, bl - .3, wall, bx, 1.5, bzc);
        for (let i = 0; i <= 8; i++) for (const sx2 of [-1, 1]) P.cyl(.1, .11, 2.3, 8, R.wood, bx + sx2 * 1.25, 1.5, bz0 + .15 + (bl - .3) * i / 8);
        for (let i = 0; i < 8; i++) P.box(.05, 1.1, (bl - .3) / 8 - .45, R.lattice, bx - sx * 1.27, 1.45, bz0 + .15 + (bl - .3) * (i + .5) / 8); // 마당 쪽 창호
        P.box(2.6, .2, bl - .2, R.band, bx, 2.7, bzc);
        const r2 = gableRoofGeo(THREE, bl + .4, 3.8, 1.2, .1); r2.rotateY(Math.PI / 2); r2.translate(bx, 2.8, bzc); P.put(r2, R.roofTile);
        P.flush(h.site);
        h.col(cx, zc, ln / 2, 1.3); h.col(bx, bzc, 1.45, bl / 2);
        const g = grp(h, bx - sx * 1.3, bzc, sx > 0 ? -Math.PI / 2 : Math.PI / 2); plate(h, g, sx > 0 ? '나유타료' : '만수리실', 1.3, 0, 2.35, 0, { px: 44 });
      }
      spotAt(IX - 4.4, D / 2 + 7.4, 2.6, '용주사 나유타료 · 만수리실', '천보루 양옆 행각에 이어 승당·선당이 마당을 ㅁ자로 감싸요');
    }
    if (kind === 'manseru') { // 선운사 만세루 (보물): 대웅보전 앞 정면 9칸 맞배지붕 강당 — 다듬지 않은 굵은 나무 기둥, 대웅보전 쪽은 활짝 열림
      const zc = D / 2 + 14.6, w = Math.min(13.5, 2 * YX - 12), d = 3.6, hh = 3.0, nat = M('#8a6a4a'), P = parts();
      mesh(h.site, new THREE.BoxGeometry(w + .6, .3, d + .6), h.MAT.stone, 0, .15, zc);                 // 돌기단
      mesh(h.site, new THREE.BoxGeometry(w, .2, d), R.wood, 0, .4, zc);                                  // 마루 (올라가 앉을 수 있음)
      for (let i = 0; i <= 9; i++) for (const sz of [-1, 0, 1]) { if (sz === 0 && (i === 0 || i === 9)) continue; const x = -w / 2 + w * i / 9, r = (i === 0 || i === 9) ? .2 : .14 + rnd() * .03; // 귀기둥은 아주 굵은 자연목
        const c = mesh(h.site, new THREE.CylinderGeometry(r * .9, r, hh, 8), nat, x, .5 + hh / 2, zc + sz * d / 2); c.rotation.z = (rnd() - .5) * .04; }
      mesh(h.site, new THREE.BoxGeometry(w, hh - .3, .08), R.wood, 0, .5 + (hh - .3) / 2, zc + d / 2);   // 바깥(일주문 쪽)은 판장문 (벽마다 따로 그려야 안을 걸어 다님)
      for (let i = 0; i < 9; i++) P.box(.04, hh - .4, .1, R.lattice, -w / 2 + w * (i + .5) / 9, .5 + (hh - .4) / 2, zc + d / 2 + .02);
      for (const sx of [-1, 1]) mesh(h.site, new THREE.BoxGeometry(.08, hh - .3, d), R.wood, sx * w / 2, .5 + (hh - .3) / 2, zc);
      P.flush(h.site);
      const Q = parts();
      Q.box(w + .3, .26, d + .3, nat, 0, .5 + hh + .13, zc);
      const roof = gableRoofGeo(THREE, w + 1.6, d + 2.6, 1.7, .14); roof.translate(0, .5 + hh + .26, zc); Q.put(roof, R.roofTile);
      Q.box(w + 1.7, .24, .3, h.MAT.stoneDark, 0, .5 + hh + 2.0, zc);
      Q.flush(h.site);
      for (const sz of [1, -1]) { const g = grp(h, 0, zc + sz * (d / 2 + .12), sz > 0 ? 0 : Math.PI); plate(h, g, '만세루', 1.4, 0, .5 + hh - .3, 0, { px: 46 }); }
      h.col(0, zc + d / 2 - .1, w / 2 + .2, .2); for (const sx of [-1, 1]) h.col(sx * w / 2, zc, .2, d / 2 + .2);
      spotAt(0, zc - d / 2 - 1.2, 3.6, '선운사 만세루', '정면 9칸, 우리나라 사찰 누각 가운데 가장 큰 강당이에요 · 대웅보전 쪽으로 활짝 열려 있어요');
    }
    if (kind === 'gaunruSite') { // 고운사 가운루 터: 계곡을 가로지른 2층 누각(보물)이 2025년 3월 산불로 불타 지금은 돌 주초만 남은 자리 · 줄을 둘러 보호
      const cx = -(L / 2 + 2.1), cz = D / 2 + 13.4, w = 7.0, d = 2.6, P = parts(), Pr = parts();
      const bed = mesh(h.site, new THREE.PlaneGeometry(w + 1.6, d + 1.2), M('#b9ab90'), cx, .03, cz, false); bed.rotation.x = -Math.PI / 2; // 물이 거의 마른 계곡 바닥
      for (let i = 0; i < 14; i++) P.ball(.18 + rnd() * .2, i % 2 ? R.rock : R.rock2, cx + (rnd() - .5) * (w + 1), .08, cz + (rnd() - .5) * (d + .6), 1, .5, 1);
      for (const sz of [-1, 1]) for (let i = 0; i < 6; i++) { const x = cx - w / 2 + .5 + i * (w - 1) / 5, z = cz + sz * d / 2 * .7;
        P.box(.62, .14, .62, R.granite, x, .07, z); P.box(.36, .35 + rnd() * .55, .36, R.granite2, x, .3, z); }        // 돌 주초와 남은 돌기둥 밑동
      for (const sx of [-1, 1]) P.box(.5, .45, d + .4, R.granite2, cx + sx * (w / 2 + .1), .22, cz);                   // 양 끝 축대
      const fx = w / 2 + .5, fz = d / 2 + .5, rope = M('#c9b48a');
      for (const [x, z] of [[-fx, -fz], [0, -fz], [fx, -fz], [-fx, fz], [0, fz], [fx, fz]]) Pr.cyl(.05, .06, .8, 6, k.bark2 || R.rock2, cx + x, .4, cz + z);
      for (const z of [-fz, fz]) Pr.box(2 * fx, .03, .03, rope, cx, .68, cz + z);
      for (const x of [-fx, fx]) Pr.box(.03, .03, 2 * fz, rope, cx + x, .68, cz);
      P.flush(h.site); Pr.flush(h.site, { noOcc: true });
      h.col(cx, cz, fx + .1, fz + .1);
      spotAt(cx + fx + 1.6, cz, 3.0, '고운사 가운루 터', '최치원이 처음 세웠다는 계곡 위 누각 자리 · 2025년 산불로 불타 복원을 준비하고 있어요');
    }
    if (kind === 'gounNahan') { // 고운사 나한전과 삼층석탑(높이 2.5m): 대웅보전 동쪽 언덕 · 나한전은 옛 대웅전
      const x = L / 2 + 3.3, g = grp(h, x, -1.2);
      smallHall(h, g, { w: 3.4, d: 2.6, hh: 1.7, roofH: 1.0, plaque: '나한전', plaqueW: 1.0 });
      colG(h, g, 0, 0, 2.0, 1.6);
      stoneTiers(h, x, D / 2 - 1.6, 3, .62);
      h.col(x, D / 2 - 1.6, 1.0, 1.0);
      spotAt(x - 1.8, D / 2, 2.8, '고운사 삼층석탑', '나한전 앞에 선 높이 2.5m의 단정한 삼층석탑이에요');
    }
    if (kind === 'burntForest') { // 고운사 사찰림: 2025년 산불로 탄 줄기 사이로 새순이 돋는 숲 (나무를 새로 심지 않고 스스로 되살아나게 둠) · 마당 바깥에만
      const trunk = new THREE.MeshStandardMaterial({ color: '#2e2925', roughness: 1, flatShading: true }), sprout = M('#8cc06a'), sprout2 = M('#6fa957');
      const tr = [], sp = [], q = new THREE.Quaternion(), e = new THREE.Euler(), z0 = (h.YZ0 ?? -D / 2 - 2) - 1.5;
      for (let i = 0; i < 260 && tr.length < 70; i++) {
        const x = (rnd() - .5) * 2 * (YX + 13), z = -D / 2 - 14 + rnd() * (YZ1 + D / 2 + 20);
        if (Math.abs(x) < YX + 1.2 && z > z0 && z < YZ1 + 1.5) continue; // 마당 안은 비움
        if (Math.abs(x) < 3.2 && z > YZ1 - 1) continue;                           // 일주문 앞 길도 비움
        const ht = 2.2 + rnd() * 4.8, br = rnd() < .3;
        e.set((rnd() - .5) * .12, rnd() * 6, (rnd() - .5) * .12); q.setFromEuler(e);
        tr.push(new THREE.Matrix4().compose(new THREE.Vector3(x, (br ? ht * .55 : ht) / 2, z), q, new THREE.Vector3(.7 + rnd() * .5, br ? ht * .55 : ht, .7 + rnd() * .5)));
        for (let j = 0; j < 3; j++) { const a = rnd() * 6.3, r = .35 + rnd() * .7, s = .3 + rnd() * .45;
          sp.push(new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(a) * r, s * .5, z + Math.sin(a) * r), new THREE.Quaternion(), new THREE.Vector3(s, s, s))); }
      }
      const tg = new THREE.CylinderGeometry(.11, .17, 1, 6), im = new THREE.InstancedMesh(tg, trunk, tr.length); tr.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; h.site.add(im);
      const sg = new THREE.IcosahedronGeometry(.5, 0), half = Math.ceil(sp.length / 2);
      for (const [mat, list] of [[sprout, sp.slice(0, half)], [sprout2, sp.slice(half)]]) { const ims = new THREE.InstancedMesh(sg, mat, list.length); list.forEach((m, i) => ims.setMatrixAt(i, m)); h.site.add(ims); }
      spotAt(YX - 1.4, D / 2 + 7, 2.6, '고운사 사찰림', '2025년 산불로 탄 숲이 스스로 되살아나고 있어요 · 탄 줄기 둘레로 새순이 돋아요');
    }
    if (kind === 'neungsohwa') { // 봉녕사 능소화: 여름이면 대적광전·향하당 곁 담장을 타고 주황 꽃이 핌 (법당 오른쪽 담장)
      const P = parts(), x = YX - .2, orange = glow('#f08a3a', .3), orange2 = glow('#f6a65a', .25);
      for (let z = D / 2 - 5.5; z < D / 2 + 3.5; z += .55) {
        P.ball(.32 + rnd() * .15, rnd() < .5 ? k.leaf : k.leaf2, x - .1, 1.0 + rnd() * .6, z, .7, 1.2, 1, 1);
        for (let j = 0; j < 3; j++) { const fy = .5 + rnd() * 1.3; P.put(new THREE.ConeGeometry(.07, .2, 6).rotateX(Math.PI).translate(x - .35 - rnd() * .1, fy, z + (rnd() - .5) * .5), rnd() < .6 ? orange : orange2); }
      }
      P.flush(h.site, { noOcc: true });
      spotAt(x - 1.6, D / 2 - 1, 2.6, '봉녕사 능소화', '여름이면 담장을 타고 주황빛 능소화가 피어요');
    }
    if (kind === 'hyangTree') { // 봉녕사 향나무 (800년 넘음): 대적광전 앞뜰 · 용이 기어가듯 비틀린 줄기와 가지가 낮고 넓게 퍼지고, 버팀목이 가지를 받침
      const x = L / 4 + 2.4, z = D / 2 + 3.5, P = parts(), Pf = parts();
      let p = V(x, 0, z), a = rnd() * 6;
      for (let i = 0; i < 4; i++) { a += 1.2; const q = V(p.x + Math.cos(a) * .32 - .12, p.y + .38, p.z + Math.sin(a) * .32); P.limb(k.bark2, p, q, .42 - i * .04, .38 - i * .04, 8); p = q; } // 굵고 비틀린 밑동
      for (let b = 0; b < 6; b++) {
        const ang = b / 6 * Math.PI * 2 + rnd() * .4, len = 2.2 + rnd() * 1.1;
        let s0 = p, s1 = null;
        for (let seg = 1; seg <= 3; seg++) { const t = seg / 3, wob = (rnd() - .5) * .5; s1 = V(p.x + Math.cos(ang + wob) * len * t, p.y + .25 * seg - (seg === 3 ? .5 : 0) + rnd() * .2, p.z + Math.sin(ang + wob) * len * t); P.limb(k.bark, s0, s1, .22 - seg * .04, .18 - seg * .04, 6); // 구불구불 옆으로 뻗는 가지
          for (let j = 0; j < 2; j++) Pf.ball(.5 + rnd() * .25, rnd() < .55 ? k.juniper : k.juniper2, s1.x + (rnd() - .5) * .9, s1.y + .35 + rnd() * .35, s1.z + (rnd() - .5) * .9, 1.15, .62, 1.15, 1);
          s0 = s1; }
        if (b % 2 === 0) mesh(h.site, new THREE.CylinderGeometry(.06, .07, s1.y, 6), k.plank, s1.x, s1.y / 2, s1.z); // 버팀목
      }
      for (let j = 0; j < 7; j++) Pf.ball(.6 + rnd() * .25, k.juniper, x + (rnd() - .5) * 1.4, p.y + .5 + rnd() * .6, z + (rnd() - .5) * 1.4, 1.15, .7, 1.15, 1);
      stoneRing(P, x, z, 3.1, h.MAT.stoneDark);
      P.flush(h.site); Pf.flush(h.site);
      h.col(x, z, 2.9, 2.9);
      signpost(h, x - 3.6, z + 2.4, -Math.PI / 2, '봉녕사 향나무', '800년쯤 된 노거수', 1.4);
      spotAt(x - 3.3, z + 1.2, 3.4, '봉녕사 향나무', '봉녕사와 역사를 함께해 온 800년쯤 된 향나무예요');
    }

  }
  return out;
}
