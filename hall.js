import { roofUV, stripUV, paintBand, paintRoof, doorTex, soffitTex, eaveTex, gongpoTex } from './tex.js?v=3';
// 법당 하나 — 앞면이 +z. 계단으로 올라가 안으로 들어가고, 가운데 방석에서 삼배를 올릴 수 있게 내부까지 만든 모델 (위레브)
// L: 정면 폭, D: 측면 깊이(실제 건물 크기에서 가져옴), buddhas: 불단 위 부처님 수(1 또는 3)
// roof: 'hip'(팔작) | 'gable'(맞배) | 'cross'(아자 지붕) · stories: 2면 바깥이 2층(중층) · plain: 단청 없는 나무 빛 · sign: 현판 글자 텍스처
// altar: 불단 위 존상 [{k, s}] (보는 사람 기준 왼쪽→오른쪽) — k: sakya·amita·yaksa·biro(앉은 부처), bosal(앉은 보살), bosalS(선 보살), disciple(선 제자), chunsu(천수관음), buddhaS(선 부처)
export function buildHall(THREE, { L = 15, D = 13, buddhas = 3, altar = null, roof: roofType = 'hip', stories = 1, plain = false, sign = null } = {}) {
  const g = new THREE.Group();
  const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, flatShading: true, ...extra });
  const MAT = {
    stone: M('#cfc7b6'), wall: M('#f3e6cc'), col: M('#9b3b2b'), band: M('#2e8b74'), bandRed: M('#c2452d'),
    roof: M('#4f5b69', { side: THREE.DoubleSide }), ridge: M('#2f343a', { side: THREE.DoubleSide }), floor: M('#b98b5c', { flatShading: false, roughness: .55 }),
    ceil: M('#3e7c69', { side: THREE.DoubleSide }), lattice: M('#d6b47a'), altar: M('#8a2a22', { roughness: .5 }),
    trim: new THREE.MeshStandardMaterial({ color: '#d8a848', metalness: .5, roughness: .35 }),
    gold: new THREE.MeshStandardMaterial({ color: '#d9a943', metalness: .5, roughness: .32, emissive: '#5a3c0c', emissiveIntensity: .45 }),
    petal: new THREE.MeshStandardMaterial({ color: '#e9b77a', metalness: .3, roughness: .4, emissive: '#4a2a0a', emissiveIntensity: .3 }),
    line: M('#5a3a12'), halo: new THREE.MeshStandardMaterial({ color: '#c8552f', roughness: .6, emissive: '#3a1006', emissiveIntensity: .35, side: THREE.DoubleSide }),
    halo2: new THREE.MeshStandardMaterial({ color: '#7a3424', roughness: .7, emissive: '#2a0a04', emissiveIntensity: .3, side: THREE.DoubleSide }),
    panel: M('#6e2a22', { side: THREE.DoubleSide }), cushion: M('#7b2d45', { flatShading: false }), cushion2: M('#9c4436', { flatShading: false }),
    candle: M('#f6f0e2'), flame: new THREE.MeshBasicMaterial({ color: '#ffcf6a' }), bronze: M('#6b5130', { metalness: .4, roughness: .5 }),
    lotus: ['#f6a5b8', '#ffd86a', '#ffffff', '#a8e0a0', '#f48c7a'].map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .3, roughness: .6, flatShading: true })),
    glow: new THREE.MeshBasicMaterial({ color: '#ffd36a', transparent: true, opacity: .6, depthWrite: false }),
  };
  if (plain) { // 단청을 칠하지 않은 옛 나무 빛 (수덕사 대웅전·화엄사 각황전처럼)
    MAT.col.color.set('#7d5a3c'); MAT.band.color.set('#6a4c33'); MAT.bandRed.color.set('#5a3f2a'); MAT.ceil.color.set('#8a6a48'); MAT.wall.color.set('#efe6d2');
  } else paintBand(MAT.band); // 단청 띠 그림 (Gemini로 새로 그린 머리초 문양)
  paintRoof(MAT.roof); // 기와골 그림
  // 팔작지붕 부속: 처마 밑 서까래 · 처마 끝 마구리 · 합각벽 (단청 없는 법당은 나무 빛)
  MAT.under = plain ? M('#6a4c33', { side: THREE.DoubleSide }) : M('#ffffff', { map: soffitTex(), side: THREE.DoubleSide });
  MAT.eave = plain ? M('#4e3826', { side: THREE.DoubleSide }) : M('#ffffff', { map: eaveTex(), side: THREE.DoubleSide });
  MAT.gable = M(plain ? '#5e4430' : '#8a3d2c', { side: THREE.DoubleSide });
  MAT.gongpo = M(plain ? '#c9a27a' : '#ffffff', { map: gongpoTex() }); MAT.gongpo.userData.strip = true; // 다포 공포 띠
  const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, parent) => { const geo = new THREE.BoxGeometry(w, h, d); if (mat.userData.strip) stripUV(geo, w, h, d); return add(geo, mat, x, y, z, parent); };

  const P = .6, H = 3.9, T = .25, SW = 3.2;
  const ix0 = -L / 2 + .6, ix1 = L / 2 - .6, iz0 = -D / 2 + .6, iz1 = D / 2 - 1.3;
  const IW = ix1 - ix0, ID = iz1 - iz0, FY = P + .05;
  const colliders = [];
  const col = (cx, cz, hx, hz) => colliders.push({ cx, cz, hx, hz });

  // 기단 + 앞 계단 (계단으로만 오르내림)
  box(L, P, D, MAT.stone, 0, P / 2, 0);
  for (let i = 0; i < 3; i++) box(SW, P * (3 - i) / 4, .42, MAT.stone, 0, P * (3 - i) / 8, D / 2 + .21 + i * .42);
  const sideW = L / 2 - IW / 2 - T;
  for (const sx of [-1, 1]) {
    col(sx * (IW / 2 + T + sideW / 2), 0, sideW / 2 + .05, D / 2);                       // 옆 기단
    col(sx * (SW / 2 + .1 + (L / 2 - SW / 2 - .1) / 2), D / 2 + .1, (L / 2 - SW / 2 - .1) / 2, .12); // 앞 기단 모서리 (계단 빼고)
  }
  col(0, (-D / 2 + iz0 - T) / 2, L / 2, (iz0 - T + D / 2) / 2);                        // 뒤 기단

  // 마루 (안 + 툇마루)
  const FZ1 = D / 2 - .12;
  box(IW, .05, FZ1 - iz0, MAT.floor, 0, P + .025, (iz0 + FZ1) / 2);

  // 벽: 뒤·양옆, 앞은 문을 들어 올려 활짝 열어 둠
  const JEOK = !(buddhas > 0) && !(altar && altar.length); // 적멸보궁(통도사 대웅전): 불상 없이 불단 뒤 창으로 금강계단의 진신사리를 바라봄
  const WT = IW + 2 * T, winW = Math.min(Math.min(IW - 2.2, 9.5) * .5, 3.6), winY0 = FY + 1.05 + .32, winH = Math.min(H - 1.05 - .32 - .45, 2.1);
  if (!JEOK) box(WT, H, T, MAT.wall, 0, FY + H / 2, iz0 - T / 2);
  else {
    const side = (WT - winW) / 2;
    for (const sx of [-1, 1]) box(side, H, T, MAT.wall, sx * (winW / 2 + side / 2), FY + H / 2, iz0 - T / 2);
    box(winW, winY0 - FY, T, MAT.wall, 0, FY + (winY0 - FY) / 2, iz0 - T / 2);
    const topY = winY0 + winH; box(winW, FY + H - topY, T, MAT.wall, 0, (topY + FY + H) / 2, iz0 - T / 2);
    // 창틀(금빛 테 + 붉은 나무) · 가는 창살 둘
    const fr = .13, fd = T + .08;
    box(winW + 2 * fr, fr, fd, MAT.col, 0, winY0 - fr / 2, iz0 - T / 2); box(winW + 2 * fr, fr, fd, MAT.col, 0, topY + fr / 2, iz0 - T / 2);
    for (const sx of [-1, 1]) box(fr, winH + 2 * fr, fd, MAT.col, sx * (winW / 2 + fr / 2), winY0 + winH / 2, iz0 - T / 2);
    for (const sx of [-1, 1]) box(.04, winH, .05, MAT.col, sx * winW / 6, winY0 + winH / 2, iz0 - T / 2);
    box(winW + 2 * fr + .1, .06, .06, MAT.trim, 0, topY + fr + .03, iz0 + .02); box(winW + 2 * fr + .1, .06, .06, MAT.trim, 0, winY0 - fr - .03, iz0 + .02);
  }
  col(0, iz0 - T / 2, IW / 2 + T, T / 2 + .05);
  for (const sx of [-1, 1]) {
    box(T, H, ID, MAT.wall, sx * (IW / 2 + T / 2), FY + H / 2, (iz0 + iz1) / 2);
    col(sx * (IW / 2 + T / 2), (iz0 + iz1) / 2, T / 2 + .05, ID / 2);
  }
  // 기둥: 앞면(문 자리)과 툇마루 바깥
  const colGeo = new THREE.CylinderGeometry(.19, .22, H, 10), bays = 3, fx = i => ix0 + IW * i / bays;
  for (let i = 0; i <= bays; i++) {
    add(colGeo, MAT.col, fx(i), FY + H / 2, iz1); col(fx(i), iz1, .22, .22);
    add(colGeo, MAT.col, fx(i), FY + H / 2, D / 2 - .35); col(fx(i), D / 2 - .35, .22, .22);
  }
  // 옆·뒤 벽에도 기둥이 드러남 (벽 줄 위에 반쯤 묻힌 기둥)
  for (const sx of [-1, 1]) for (let i = 1; i < 3; i++) add(colGeo, MAT.col, sx * (IW / 2 + T / 2), FY + H / 2, iz0 - T / 2 + (iz1 - iz0 + T / 2) * i / 3);
  for (let i = 0; i <= bays; i++) add(colGeo, MAT.col, fx(i), FY + H / 2, iz0 - T / 2);
  for (const sx of [-1, 1]) { // 소맷돌: 계단 양옆으로 비스듬히 내려오는 돌
    const sl = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1.36, 0), new THREE.Vector2(1.36, .18), new THREE.Vector2(.2, P + .14), new THREE.Vector2(0, P + .14)]);
    const sg = new THREE.ExtrudeGeometry(sl, { depth: .26, bevelEnabled: false }); sg.rotateY(-Math.PI / 2); sg.translate(sx * (SW / 2 + .13) + .13, 0, D / 2 - .1);
    add(sg, MAT.stone, 0, 0, 0);
  }
  // 가운데 칸은 문짝을 들어 올려(들어열개) 드나들고, 양옆 칸은 꽃살문을 닫아 둠 (Gemini로 새로 그린 꽃살문 그림)
  const doorM = M(plain ? '#b89270' : '#ffffff', { map: doorTex(), flatShading: false, roughness: .7 });
  for (let i = 0; i < bays; i++) {
    const cx = (fx(i) + fx(i + 1)) / 2, bw = IW / bays - .3;
    if (i === 1) { box(bw, .07, 1.5, MAT.lattice, cx, FY + H - .5, iz1 + .8); continue; }
    const dh = Math.min(H - .42, bw * 1.4); box(bw, dh, .08, doorM, cx, FY + dh / 2, iz1 + .02); col(cx, iz1, bw / 2, .12);
    if (H - .42 - dh > .05) box(bw, H - .42 - dh, .06, MAT.wall, cx, FY + dh + (H - .42 - dh) / 2, iz1 + .02); // 문 위 남는 벽
  }
  box(IW + .5, .32, .3, MAT.col, 0, FY + H - .16, iz1);
  // 단청 띠
  box(L - .2, .42, .3, MAT.band, 0, FY + H + .1, D / 2 - .35);
  box(L - .2, .1, .32, MAT.bandRed, 0, FY + H - .14, D / 2 - .35);
  box(L - .2, .42, .3, MAT.band, 0, FY + H + .1, -D / 2 + .35);
  for (const sx of [-1, 1]) box(.3, .42, D - .4, MAT.band, sx * (L / 2 - .35), FY + H + .1, 0);
  // 천장 (우물천장 느낌의 초록)
  box(L - .5, .12, D - .5, MAT.ceil, 0, FY + H + .02, 0);

  // 지붕: 팔작(처마 끝이 들린 모양) 또는 맞배, 중층이면 아래 지붕 위에 2층 벽과 윗지붕을 한 번 더
  const o = 1.3, Lr = L + 2 * o, Wr = D + 2 * o, RH = Wr * .34, rl = Math.max(.6, Lr - Wr * .95);
  const GP = .5, R0 = FY + H + .14 + GP; // 기둥 위 공포 높이만큼 지붕을 띄움
  // 공포 띠: 기둥 줄(창방 위)에서 처마 밑까지, 네 면
  { const gy = FY + H + .31, gh = R0 + .12 - gy;
    box(L - .2, gh, .34, MAT.gongpo, 0, gy + gh / 2, D / 2 - .35); box(L - .2, gh, .34, MAT.gongpo, 0, gy + gh / 2, -D / 2 + .35);
    for (const sx of [-1, 1]) box(.34, gh, D - .4, MAT.gongpo, sx * (L / 2 - .35), gy + gh / 2, 0);
    // 공포: 기둥 위(주상포)와 칸마다 둘씩(주간포) — 주두 위로 첨차가 층층이 넓어지고 쇠서가 처마 쪽으로 내밂 (단청 없는 법당은 기둥 위에만)
    const pos = [], nor = [], uvs = [];
    const pbox = (w, hh, d, x, y, z, ry) => { const geo = new THREE.BoxGeometry(w, hh, d); stripUV(geo, w, hh, d); geo.rotateY(ry); geo.translate(x, y, z); const n = geo.toNonIndexed(); pos.push(...n.attributes.position.array); nor.push(...n.attributes.normal.array); uvs.push(...n.attributes.uv.array); };
    const bracket = (x, z, ry) => { const c = Math.cos(ry), sn = Math.sin(ry), P = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c];
      let [px, pz] = P(0, .2); pbox(.3, .14, .3, px, gy + .09, pz, ry);
      for (let i = 0; i < 3; i++) { const y = gy + .23 + i * .17;
        [px, pz] = P(0, .23); pbox(.62 + .3 * i, .1, .15, px, y, pz, ry);                          // 첨차
        const dl = .42 + .26 * i; [px, pz] = P(0, .1 + dl / 2); pbox(.13, .11, dl, px, y + .01, pz, ry); // 쇠서
      } };
    const bw = IW / bays, perBay = plain ? 1 : 3;
    for (const sz of [1, -1]) for (let i = 0; i <= bays * perBay; i++) bracket(fx(0) + bw * i / perBay, sz * (D / 2 - .35), sz > 0 ? 0 : Math.PI);
    const nS = Math.max(2, Math.round((D - 1.2) / (plain ? 3.2 : 1.25)));
    for (const sx of [-1, 1]) for (let i = 1; i < nS; i++) bracket(sx * (L / 2 - .35), -(D / 2 - .6) + (D - 1.2) * i / nS, sx * Math.PI / 2);
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    add(bg, MAT.band, 0, 0, 0).castShadow = false; }
  const hipRoof = (lr, wr, rh, y, opt = {}) => { // 팔작지붕 (opt.skirt: 중층 아래 띠 지붕, opt.hip: 합각 없는 우진각)
    const G = paljakGeo(THREE, lr, wr, rh, Math.min(1.05, wr * .085), opt);
    add(G.roof, MAT.roof, 0, y, 0).receiveShadow = false;
    const u = add(G.under, MAT.under, 0, y, 0); u.castShadow = false; u.receiveShadow = false;
    add(G.eave, MAT.eave, 0, y, 0).castShadow = false;
    add(G.gable, MAT.gable, 0, y, 0); add(G.board, MAT.band, 0, y, 0).castShadow = false; add(G.ridge, MAT.ridge, 0, y, 0);
    return G;
  };
  let signY = FY + H + .62, signZ = D / 2 + .62, signW = Math.min(2.6, L * .2); // 현판은 공포 앞(쇠서 끝보다 바깥)에 걸림
  if (stories >= 2) {
    // 아래층 지붕(낮게) → 2층 벽 → 윗지붕
    const UL = L - 2.6, UD = D - 2.6, UH = 2.5;
    hipRoof(Lr, Wr, RH * .5, R0, { skirt: o + 1.45 }); // 아래 지붕: 처마에서 위층 벽 조금 안쪽까지
    box(UL, UH, UD, MAT.wall, 0, R0 + UH / 2, 0);
    for (let i = 0; i <= 4; i++) { const x = -UL / 2 + UL * i / 4; for (const sz of [-1, 1]) box(.22, UH, .22, MAT.col, x, R0 + UH / 2, sz * (UD / 2 + .02)); }
    for (const sz of [-1, 1]) box(UL + .1, .34, .26, MAT.band, 0, R0 + UH - .1, sz * (UD / 2 + .04));
    for (const sz of [-1, 1]) for (let i = 0; i < 4; i++) box(UL / 4 - .5, .9, .06, MAT.lattice, -UL / 2 + UL * (i + .5) / 4, R0 + UH * .45, sz * (UD / 2 + .05));
    hipRoof(UL + 2 * o, UD + 2 * o, (UD + 2 * o) * .34, R0 + UH);
    signY = R0 + UH * .75; signZ = UD / 2 + .1; signW = Math.min(2.4, UL * .26);
  } else if (roofType === 'gable') {
    const m = add(gableRoofGeo(THREE, Lr, Wr, RH * .92, .25), MAT.roof, 0, R0, 0); m.receiveShadow = false;
    const ug = roofUV(gableRoofGeo(THREE, Lr - .1, Wr - .06, RH * .92, .25), .8, 1.8); ug.translate(0, -.09, 0); // 처마 밑 서까래
    const um = add(ug, MAT.under, 0, R0, 0); um.castShadow = false; um.receiveShadow = false;
    for (const sz of [-1, 1]) { const eg = new THREE.BoxGeometry(Lr, .3, .05), uv = eg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * Lr / .8); add(eg, MAT.eave, 0, R0 - .14, sz * (Wr / 2 - .02)).castShadow = false; } // 처마 끝
    signY = Math.min(signY, R0 + RH * .92 * (Wr / 2 - signZ - .14) / (Wr / 2) - .16 - signW * .15);
    box(Lr + .2, .42, .5, MAT.ridge, 0, R0 + RH * .92 + .12, 0);
    for (const sx of [-1, 1]) box(.35, .7, .42, MAT.ridge, sx * (Lr / 2 + .05), R0 + RH * .92 + .3, 0);
    // 박공(옆면 삼각 벽)과 드러난 나무 뼈대
    const eY = RH * .92 * (1 - D / Wr);
    const sh = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(D / 2, eY), new THREE.Vector2(0, RH * .92 - .05), new THREE.Vector2(-D / 2, eY)]);
    for (const sx of [-1, 1]) {
      const gw = new THREE.Mesh(new THREE.ShapeGeometry(sh), MAT.wall); gw.position.set(sx * (L / 2 - .05), R0, 0); gw.rotation.y = sx * Math.PI / 2; gw.material.side = THREE.DoubleSide; g.add(gw);
      for (const zz of [-D / 4, 0, D / 4]) box(.08, RH * .92 * (1 - Math.abs(zz) * 2 / Wr) - .1, .16, MAT.col, sx * (L / 2 - .02), R0 + (RH * .92 * (1 - Math.abs(zz) * 2 / Wr) - .1) / 2, zz);
      box(.08, .16, D, MAT.col, sx * (L / 2 - .02), R0 + eY * .9, 0);
    }
  } else if (roofType === 'cross' || roofType === 'tee') { // tee: 정(丁)자 지붕 — 앞으로만 맞배가 튀어나옴 (통도사 대웅전) // 아(亞)자 지붕: 팔작 큰 지붕 네 면 가운데에 맞배 지붕이 한 칸씩 튀어나옴 (송광사 대웅보전)
    const G = hipRoof(Lr, Wr, RH, R0, { hip: roofType === 'cross' });
    signY = Math.min(signY, R0 + G.y(Wr / 2 - signZ - .14) - .16 - signW * .15);
    const pw = Math.min(L * .3, 5.2), pd = 1.1, ph = RH * .52, py = R0 + RH * .24;
    for (const sz of roofType === 'tee' ? [1] : [-1, 1]) { // 앞·뒤로 튀어나온 맞배
      const ln = Wr / 2 + pd, geo = gableRoofGeo(THREE, ln, pw, ph, .18); geo.rotateY(Math.PI / 2);
      const m = add(geo, MAT.roof, 0, py, sz * ln / 2); m.receiveShadow = false;
      box(.4, .36, ln, MAT.ridge, 0, py + ph + .1, sz * ln / 2);
      const tri = new THREE.Shape([new THREE.Vector2(-pw / 2 + .5, 0), new THREE.Vector2(pw / 2 - .5, 0), new THREE.Vector2(0, ph - .3)]);
      const gw = new THREE.Mesh(new THREE.ShapeGeometry(tri), M('#6e4b33', { side: THREE.DoubleSide })); /* 박공면: 나무 널판(풍판) */ gw.position.set(0, py + .05, sz * (ln - .35)); g.add(gw);
    }
    if (roofType === 'cross') for (const sx of [-1, 1]) { // 양옆으로 튀어나온 맞배
      const ln = Lr / 2 + pd * .8, pw2 = Math.min(D * .42, 5.4), geo = gableRoofGeo(THREE, ln, pw2, ph * .9, .18);
      const m = add(geo, MAT.roof, sx * ln / 2, py, 0); m.receiveShadow = false;
      box(ln, .36, .4, MAT.ridge, sx * ln / 2, py + ph * .9 + .1, 0);
    }
  } else {
    const G = hipRoof(Lr, Wr, RH, R0);
    signY = Math.min(signY, R0 + G.y(Wr / 2 - signZ - .14) - .16 - signW * .15); // 오목한 처마 밑에 현판이 닿지 않게
  }
  // 현판: 실제 법당 이름 (검은 바탕 금색 글씨) — 처마 끝 띠보다 낮게 걸어야 마당에서 올려다봐도 가리지 않음
  if (stories < 2) signY = Math.min(signY, R0 - .2 - signW * .15);
  if (sign) {
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(signW, signW * .3), new THREE.MeshStandardMaterial({ map: sign, roughness: .6, emissive: '#ffffff', emissiveMap: sign, emissiveIntensity: .15 }));
    const sg = new THREE.Group(); sg.position.set(0, signY, signZ + .08); sg.rotation.x = stories >= 2 ? 0 : -.12; g.add(sg); // 위가 앞으로 살짝 기울어짐
    bd.position.set(0, 0, .06); sg.add(bd);
    box(signW + .14, signW * .3 + .14, .08, MAT.col, 0, 0, 0, sg);
  }

  // 불단(수미단)
  const AW = Math.min(IW - 2.2, 9.5), AD = 1.7, AH = 1.05, AZ = iz0 + .2 + AD / 2;
  box(AW, AH, AD, MAT.altar, 0, FY + AH / 2, AZ);
  box(AW + .2, .1, AD + .2, MAT.trim, 0, FY + AH + .05, AZ);
  box(AW + .1, .12, AD + .1, MAT.trim, 0, FY + .06, AZ);
  col(0, AZ, AW / 2 + .1, AD / 2 + .15);
  // 뒤 벽 탱화 자리 (실제 탱화를 옮기지 않고 붉은 바탕 + 금색 테두리만)
  const PH = H - AH - .35, PY = FY + AH + .15 + PH / 2;
  if (!JEOK) {
    box(AW + .6, PH, .05, MAT.panel, 0, PY, iz0 + .04);
    box(AW + .8, .1, .07, MAT.trim, 0, PY + PH / 2, iz0 + .05); box(AW + .8, .1, .07, MAT.trim, 0, PY - PH / 2, iz0 + .05);
    for (const sx of [-1, 1]) box(.1, PH, .07, MAT.trim, sx * (AW / 2 + .35), PY, iz0 + .05);
  }
  // 부처님 (삼존불 또는 한 분)
  const BY = FY + AH + .1;
  const STAND = k => ['bosalS', 'disciple', 'chunsu', 'buddhaS'].includes(k), WID = k => k === 'wabul' ? 6.0 : STAND(k) ? (k === 'chunsu' ? 1.2 : .8) : 1.45;
  const list = altar && altar.length ? altar : buddhas >= 3 ? [{ k: 'amita', s: .8 }, { k: 'sakya', s: 1 }, { k: 'yaksa', s: .8 }] : buddhas >= 1 ? [{ k: 'sakya', s: 1 }] : [];
  const gap = .25, need = list.reduce((a, it) => a + WID(it.k) * it.s, 0) + Math.max(0, list.length - 1) * gap, fit = Math.min(1.15, (AW - .4) / Math.max(.1, need));
  const slots = []; // 부처님 자리 (나중에 실제 불상 모델로 바꿔 끼움)
  let cx = -need * fit / 2;
  for (const it of list) {
    const w = WID(it.k) * it.s * fit, x = cx + w / 2, s = it.s * fit; cx += w + gap * fit;
    const b = it.k === 'wabul' ? reclining(THREE, MAT, s) : STAND(it.k) ? standing(THREE, MAT, s, it.k) : buddha(THREE, MAT, s); b.position.set(x, BY, AZ - .15); g.add(b);
    slots.push({ x, y: BY, z: AZ - .15, s, k: it.k, stand: STAND(it.k), obj: b });
  }
  const seats = list;
  if (!seats.length) { // 적멸보궁: 불상을 모시지 않음 — 불단엔 공양물만, 예불은 창 너머 금강계단의 진신사리를 향해
    box(1.5, .05, .5, MAT.trim, 0, BY - .02, AZ + .1); // 공양 상
    for (const dx of [-.36, 0, .36]) { add(new THREE.CylinderGeometry(.09, .07, .1, 14), MAT.bronze, dx, BY + .05, AZ + .1); add(new THREE.CylinderGeometry(.075, .075, .02, 14), MAT.candle, dx, BY + .1, AZ + .1); } // 다기(맑은 물 세 잔)
    for (const sx of [-1, 1]) { // 연꽃을 꽂은 화병
      const vx = sx * AW * .3; add(new THREE.CylinderGeometry(.09, .13, .42, 12), MAT.bronze, vx, BY + .21, AZ - .1);
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, f = add(new THREE.IcosahedronGeometry(.1, 0), MAT.lotus[i % MAT.lotus.length], vx + Math.sin(a) * .1, BY + .55 + (i % 2) * .08, AZ - .1 + Math.cos(a) * .1); f.scale.y = .8; }
    }
    const lamp = add(new THREE.SphereGeometry(.12, 12, 10), MAT.glow, 0, BY + .35, AZ - .3); lamp.castShadow = false; // 작은 등불
  }
  // 촛대 둘과 향로
  for (const sx of [-1, 1]) {
    add(new THREE.CylinderGeometry(.06, .06, .42, 10), MAT.candle, sx * AW * .42, FY + AH + .31, AZ + AD / 2 - .25);
    const fl = add(new THREE.ConeGeometry(.04, .13, 8), MAT.flame, sx * AW * .42, FY + AH + .59, AZ + AD / 2 - .25); fl.castShadow = false;
  }
  // 향로는 불단 바로 앞 낮은 향탁 위에 (불상에 가리지 않게)
  const TZ = AZ + AD / 2 + .3, TH = .72;
  box(.9, .06, .44, MAT.trim, 0, FY + TH - .03, TZ); box(.8, TH - .06, .36, MAT.altar, 0, FY + (TH - .06) / 2, TZ);
  col(0, TZ, .5, .27);
  add(new THREE.CylinderGeometry(.16, .12, .2, 16), MAT.bronze, 0, FY + TH + .1, TZ);
  for (const dx of [-.05, 0, .05]) add(new THREE.CylinderGeometry(.008, .008, .32, 4), MAT.line, dx, FY + TH + .32, TZ);
  const incense = { lx: 0, ly: FY + TH + .48, lz: TZ }; // 향 끝 높이

  // 방석: 가운데 맨 앞 방석이 삼배 자리
  const bowSpot = { lx: 0, lz: iz0 + 3.3 };
  const cushGeo = new THREE.BoxGeometry(.78, .09, .78);
  let k = 0; const cushions = [];
  for (let z = bowSpot.lz; z < iz1 - .7; z += 1.3) for (let x = 0; x <= IW / 2 - 1.1; x += 1.25) for (const sx of x ? [-1, 1] : [1]) {
    const c = add(cushGeo, k++ % 2 ? MAT.cushion2 : MAT.cushion, sx * x, FY + .045, z); c.castShadow = false; cushions.push({ lx: sx * x, lz: z });
  }
  const glow = new THREE.Mesh(new THREE.RingGeometry(.58, .74, 40), MAT.glow); glow.rotation.x = -Math.PI / 2; glow.position.set(bowSpot.lx, FY + .1, bowSpot.lz); g.add(glow);

  // 천장에 매단 연등
  const lanGeo = new THREE.IcosahedronGeometry(.24, 1), strGeo = new THREE.CylinderGeometry(.006, .006, 1, 4);
  k = 0;
  for (const z of [iz0 + 3.6, iz0 + 5.6]) { if (z > iz1 - .5) continue; for (const x of [-IW * .32, -IW * .12, IW * .12, IW * .32]) {
    const l = add(lanGeo, MAT.lotus[k++ % MAT.lotus.length], x, FY + H - 1.05, z); l.scale.y = .85; l.castShadow = false;
    const s = add(strGeo, MAT.line, x, FY + H - .45, z); s.scale.y = .9; s.castShadow = false;
  } }

  // 안쪽 조명 (그림자 없이 따뜻하게)
  const inLight = new THREE.PointLight(0xffd9a0, 16, 0, 2); inLight.position.set(0, FY + H - .7, (iz0 + iz1) / 2); g.add(inLight);
  const altarLight = new THREE.PointLight(0xffc878, 7, 0, 2); altarLight.position.set(0, FY + AH + 1.4, AZ + 1.6); g.add(altarLight);

  const heightAt = (lx, lz) => {
    if (Math.abs(lx) <= L / 2 && lz >= -D / 2 && lz <= D / 2) return FY;
    if (Math.abs(lx) <= SW / 2 + .2 && lz > D / 2 && lz < D / 2 + 1.26) return FY * (1 - (lz - D / 2) / 1.26);
    return 0;
  };
  const isInside = (lx, lz) => lx > ix0 && lx < ix1 && lz > iz0 && lz < iz1 + .3;
  const underRoof = (lx, lz) => Math.abs(lx) < L / 2 + o && lz > -D / 2 - o && lz < D / 2 + o;
  return { group: g, colliders, heightAt, isInside, underRoof, bowSpot, glow, L, D, FY, ceilY: FY + H, interior: { ix0, ix1, iz0, iz1 }, lights: [inLight, altarLight], cushions, incense, slots, altarZ: AZ };
}

// 부처님 (단순한 도형으로 공손하게 표현한 좌상)
// 와불 자리표시: 오른쪽으로 누워 팔을 괸 모습 (모델을 불러오면 바뀜)
function reclining(THREE, MAT, s) {
  const b = new THREE.Group(), L = 6.0 * s, H = 2.4 * s;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.32 * H, L * .62, 6, 14), MAT.gold); body.rotation.z = Math.PI / 2; body.position.set(.08 * L, .34 * H, 0); body.scale.set(1, 1, .8); b.add(body);
  const hd = new THREE.Mesh(new THREE.SphereGeometry(.2 * H, 14, 10), MAT.gold); hd.position.set(-.4 * L, .62 * H, 0); b.add(hd);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(.08 * H, .1 * H, .5 * H, 8), MAT.gold); arm.position.set(-.42 * L, .3 * H, .05); b.add(arm);
  return b;
}
// 선 존상 자리표시 (모델을 불러오기 전·못 불러올 때): 옷자락을 돌려 깎은 금빛 입상
function standing(THREE, MAT, s, k) {
  const b = new THREE.Group(), H = (k === 'disciple' ? 2.2 : 2.5) * s;
  const prof = [[0, 0], [.17, 0], [.16, .05], [.13, .35], [.12, .55], [.135, .7], [.12, .76], [.07, .8], [0, .8]].map(([r, y]) => new THREE.Vector2(r * H, y * H));
  const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 16), MAT.gold); m.castShadow = true; b.add(m);
  const hd = new THREE.Mesh(new THREE.SphereGeometry(.07 * H, 14, 10), MAT.gold); hd.position.y = .86 * H; b.add(hd);
  if (k !== 'disciple') { const c = new THREE.Mesh(new THREE.CylinderGeometry(.04 * H, .06 * H, .08 * H, 10), MAT.gold); c.position.y = .94 * H; b.add(c); }
  return b;
}
function buddha(THREE, MAT, s) {
  const b = new THREE.Group();
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; b.add(m); return m; };
  const S = (r, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h);
  add(new THREE.CylinderGeometry(.62, .5, .26, 32), MAT.gold, 0, .13, 0);                         // 연꽃 대좌
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; const p = add(S(.17, 12, 8), MAT.petal, Math.sin(a) * .62, .27, Math.cos(a) * .62, 1, .5, .55); p.rotation.y = a; }
  add(S(.5, 32, 16), MAT.gold, 0, .44, .05, 1.2, .4, .78);                                         // 결가부좌
  add(S(.38, 32, 20), MAT.gold, 0, .95, 0, 1, 1.32, .78);                                          // 몸
  add(S(.12), MAT.gold, 0, .62, .32, 1.5, .55, 1);                                                 // 선정인 손
  add(S(.27, 32, 24), MAT.gold, 0, 1.62, .02);                                                     // 머리
  add(S(.12, 20, 12), MAT.gold, 0, 1.9, -.01);                                                     // 육계
  for (const sx of [-1, 1]) add(S(.07, 12, 10), MAT.gold, sx * .26, 1.56, 0, .45, 1.7, .7);        // 귀
  const eyeG = new THREE.TorusGeometry(.055, .012, 6, 14, Math.PI);
  for (const sx of [-1, 1]) { const e = add(eyeG, MAT.line, sx * .095, 1.62, .255); e.rotation.z = Math.PI; }   // 지그시 감은 눈
  add(S(.018, 8, 6), MAT.line, 0, 1.72, .262);                                                     // 백호
  add(new THREE.CircleGeometry(.5, 40), MAT.halo, 0, 1.62, -.32);                                  // 두광
  add(new THREE.TorusGeometry(.5, .035, 8, 48), MAT.gold, 0, 1.62, -.31);
  add(new THREE.CircleGeometry(.85, 48), MAT.halo2, 0, 1.05, -.42, 1, 1.25, 1);                    // 신광
  b.scale.setScalar(s);
  return b;
}

// 맞배지붕: 앞뒤 두 면, 처마 양 끝만 아주 살짝 들림
export function gableRoofGeo(THREE, Lr, Wr, H, lift) {
  const seg = 12, pos = [], hx = Lr / 2, hz = Wr / 2;
  const lf = u => lift * Math.pow(Math.abs(2 * u - 1), 3);
  for (const s of [1, -1]) for (let k = 0; k < seg; k++) {
    const u0 = k / seg, u1 = (k + 1) / seg, x0 = -hx + Lr * u0, x1 = -hx + Lr * u1;
    const e0 = [x0, lf(u0), s * hz], e1 = [x1, lf(u1), s * hz], r0 = [x0, H, 0], r1 = [x1, H, 0];
    if (s > 0) pos.push(...e0, ...e1, ...r1, ...e0, ...r1, ...r0); else pos.push(...e1, ...e0, ...r0, ...e1, ...r0, ...r1);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); return roofUV(geo);
}
// 처마 끝이 살짝 들린 지붕
export function hipRoofGeo(THREE, Lr, Wr, H, rl, lift) {
  const seg = 12, pos = [];
  const hx = Lr / 2, hz = Wr / 2, rx = rl / 2;
  const lf = u => lift * Math.pow(Math.abs(2 * u - 1), 3);
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function face(E0, E1, Q0, Q1) {
    for (let k = 0; k < seg; k++) {
      const u0 = k / seg, u1 = (k + 1) / seg;
      const e0 = lerp(E0, E1, u0), e1 = lerp(E0, E1, u1); e0[1] += lf(u0); e1[1] += lf(u1);
      const q0 = lerp(Q0, Q1, u0), q1 = lerp(Q0, Q1, u1);
      pos.push(...e0, ...e1, ...q1, ...e0, ...q1, ...q0);
    }
  }
  const A = [-hx, 0, hz], B = [hx, 0, hz], C = [hx, 0, -hz], D = [-hx, 0, -hz], P = [-rx, H, 0], Q = [rx, H, 0];
  face(A, B, P, Q); face(C, D, Q, P); face(B, C, Q, Q); face(D, A, P, P);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return roofUV(geo);
}

// 팔작지붕 (위레브): 아래는 네 면에 처마를 두른 우진각, 위로는 양옆에 세모난 합각벽이 서고 용마루가 길게 뻗음.
// 물매는 오목하게 휘고(처마 쪽은 눕고 용마루 쪽은 섬), 네 귀는 추녀가 들리며 바깥으로 빠짐(앙곡·안허리곡).
// 처마 높이 0 기준 도형 묶음: roof(기와) · under(처마 밑 서까래) · eave(처마 끝 막새·서까래 마구리) · gable(합각벽) · board(박공널) · ridge(용마루·내림마루·추녀마루·합각마루)
// Lr > Wr이면 용마루가 x 방향, 아니면 z 방향(돌려서 만듦). y(d): 처마 끝에서 안쪽으로 d만큼 들어간 곳의 지붕 높이
export function paljakGeo(THREE, Lr, Wr, H, lift = .6, { brk = .56, push = null, ridgeW = null, ridgeH = null, end = null, skirt = 0, hip = false } = {}) {
  const swap = Wr > Lr; if (swap) [Lr, Wr] = [Wr, Lr];
  const sc = Math.min(1, Math.max(.45, Wr / 11)); // 작은 전각은 마루·띠도 가늘게
  ridgeW = ridgeW ?? Math.min(.5, Math.max(.2, Wr * .042)); ridgeH = ridgeH ?? ridgeW * .84; end = end ?? ridgeW * 1.6;
  const hx = Lr / 2, hz = Wr / 2;
  let db = hz * brk; if (hx - db < .35) db = Math.max(.15, hx - .35);
  if (skirt) db = Math.min(skirt, hz - .2);
  if (hip) db = hz; // 합각 없이 네 면이 용마루까지 (우진각) — 아(亞)자 지붕 가운데처럼 사방에 다른 지붕이 붙을 때
  const low = skirt || hip; // 중층 아래 지붕: 처마에서 d=skirt까지만 두른 띠 지붕 (위층 벽이 뚫고 올라감)
  const gx = hx - db, zJ = hz - db, a = .62;
  const Rl = hz * .95, K = push ?? Math.min(.55, hz * .075);
  const h = d => { const s = Math.min(1, Math.max(0, d / hz)); return H * (a * s + (1 - a) * s * s); };
  const NS = 48, arc = [0]; for (let i = 1; i <= NS; i++) { const d0 = hz * (i - 1) / NS, d1 = hz * i / NS; arc.push(arc[i - 1] + Math.hypot(d1 - d0, h(d1) - h(d0))); }
  const S = d => { const f = Math.min(NS, Math.max(0, d / hz * NS)), i = Math.min(NS - 1, Math.floor(f)); return arc[i] + (arc[i + 1] - arc[i]) * (f - i); };
  const cf = (d, e) => (e < Rl ? (1 - e / Rl) ** 2 : 0) * (d < db ? (1 - d / db) ** 1.6 : 0);
  const V = (x, z, d, e) => { const c = cf(d, e); return [x + Math.sign(x) * K * c, h(d) + lift * c, z + Math.sign(z) * K * c]; };
  const out = { roof: [], under: [], eave: [], gable: [], board: [], ridge: [] }, uvs = { roof: [], under: [], eave: [], gable: [], board: [], ridge: [] };
  const tri = (k, p, q, r, tp = [0, 0], tq = [0, 0], tr = [0, 0]) => { out[k].push(...p, ...q, ...r); uvs[k].push(...tp, ...tq, ...tr); };
  const quad = (k, p, q, r, s, tp, tq, tr, ts) => { tri(k, p, q, r, tp, tq, tr); tri(k, p, r, s, tp, tr, ts); };
  const NB = 7, NT = 6, rowsAll = [], rowsLow = [];
  for (let i = 0; i <= NB; i++) rowsLow.push(db * i / NB);
  rowsAll.push(...rowsLow); for (let i = 1; i <= NT; i++) rowsAll.push(db + (hz - db) * i / NT);
  // 면 하나: plan(d, t) → [x, z], 밖을 보는 방향(ox, oz) · 처마 방향 u는 roofUV와 같은 규칙
  const faces = [
    { rows: low ? rowsLow : rowsAll, n: 20, plan: (d, t) => [t * (d < db ? hx - d : gx), hz - d], o: [0, 1] },
    { rows: low ? rowsLow : rowsAll, n: 20, plan: (d, t) => [-t * (d < db ? hx - d : gx), -(hz - d)], o: [0, -1] },
    { rows: rowsLow, n: 10, plan: (d, t) => [hx - d, -t * (hz - d)], o: [1, 0] },
    { rows: rowsLow, n: 10, plan: (d, t) => [-(hx - d), t * (hz - d)], o: [-1, 0] },
  ];
  const TH = .09 * sc, SU = 1.8, SV = 1.8, RU = .8 * sc;
  for (const F of faces) {
    const side = F.o[0] !== 0, grid = F.rows.map(d => { const row = []; for (let j = 0; j <= F.n; j++) { const t = -1 + 2 * j / F.n, [x, z] = F.plan(d, t), e = side ? hz - Math.abs(z) : hx - Math.abs(x); row.push({ p: V(x, z, d, e), u: (x * F.o[1] - z * F.o[0]), v: S(d) }); } return row; });
    for (let k = 0; k < grid.length - 1; k++) for (let j = 0; j < F.n; j++) {
      const A = grid[k][j], B = grid[k][j + 1], C = grid[k + 1][j + 1], D = grid[k + 1][j];
      quad('roof', A.p, B.p, C.p, D.p, [A.u / SU, A.v / SV], [B.u / SU, B.v / SV], [C.u / SU, C.v / SV], [D.u / SU, D.v / SV]);
      const dn = q => [q.p[0], q.p[1] - TH, q.p[2]];
      quad('under', dn(A), dn(D), dn(C), dn(B), [A.u / RU, A.v / SV], [D.u / RU, D.v / SV], [C.u / RU, C.v / SV], [B.u / RU, B.v / SV]);
    }
    let len = 0; const r0 = grid[0];                                     // 처마 끝: 지붕 가장자리에서 아래로 내린 띠
    for (let j = 0; j < F.n; j++) {
      const A = r0[j].p, B = r0[j + 1].p, l = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), EH = .44 * sc; // 겹처마(부연 + 서까래) 두께
      quad('eave', [A[0], A[1] - EH, A[2]], [B[0], B[1] - EH, B[2]], [B[0], B[1] + .02, B[2]], [A[0], A[1] + .02, A[2]], [len / RU, 0], [(len + l) / RU, 0], [(len + l) / RU, 1], [len / RU, 1]);
      len += l;
    }
  }
  const gin = .12 * sc, yb = h(db) - .14 * sc;
  if (!low) { // 합각벽과 박공널 (양옆): 아래 가장자리는 옆 처마 지붕 꼭대기(높이 y(db)) 조금 밑으로 감춤
  const verge = []; for (const d of [...rowsAll.filter(d => d >= db)].reverse()) verge.push([hz - d, h(d)]); // 꼭대기 z=0 → 앞 z=zJ
  const edge = [...[...verge].reverse(), ...verge.slice(1).map(([z, y]) => [-z, y])]; // z: +zJ → 0 → -zJ
  for (const sx of [1, -1]) {
    const pts = sx > 0 ? edge : [...edge].reverse(), xg = sx * (gx - gin);
    let len = 0, BW = .36 * sc;
    for (let i = 0; i < pts.length - 1; i++) {
      const [z0, y0] = pts[i], [z1, y1] = pts[i + 1], l = Math.hypot(z1 - z0, y1 - y0);
      quad('gable', [xg, yb, z0], [xg, yb, z1], [xg, y1 - .02, z1], [xg, y0 - .02, z0]);
      const xb = xg + sx * .04;
      quad('board', [xb, y0 - BW, z0], [xb, y1 - BW, z1], [xb, y1 + .01, z1], [xb, y0 + .01, z0], [len / (4 * BW), 0], [(len + l) / (4 * BW), 0], [(len + l) / (4 * BW), 1], [len / (4 * BW), 1]);
      len += l;
    }
  }
  } // !skirt
  // 마루: 선을 따라 네모난 막대 (윗면 + 양옆 + 끝막음)
  const up = new THREE.Vector3(0, 1, 0);
  function tube(pts, w, hh) {
    const P = pts.map(p => new THREE.Vector3(...p)), n = P.length, L = [], Rr = [];
    for (let i = 0; i < n; i++) { const t = P[Math.min(n - 1, i + 1)].clone().sub(P[Math.max(0, i - 1)]).normalize(), s = new THREE.Vector3().crossVectors(t, up).normalize().multiplyScalar(w / 2); L.push(P[i].clone().sub(s).setY(P[i].y - .06)); Rr.push(P[i].clone().add(s).setY(P[i].y - .06)); }
    const T = v => [v.x, v.y + hh, v.z], B = v => [v.x, v.y, v.z];
    for (let i = 0; i < n - 1; i++) {
      quad('ridge', T(L[i]), T(Rr[i]), T(Rr[i + 1]), T(L[i + 1]));
      quad('ridge', B(L[i]), T(L[i]), T(L[i + 1]), B(L[i + 1]));
      quad('ridge', B(Rr[i + 1]), T(Rr[i + 1]), T(Rr[i]), B(Rr[i]));
    }
    for (const [i, sg] of [[0, 1], [n - 1, -1]]) { if (sg > 0) quad('ridge', B(Rr[i]), T(Rr[i]), T(L[i]), B(L[i])); else quad('ridge', B(L[i]), T(L[i]), T(Rr[i]), B(Rr[i])); }
  }
  function blk(cx, cy, cz, w, hh, dd) { // 상자 (용마루 끝 취두)
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy, y1 = cy + hh, z0 = cz - dd / 2, z1 = cz + dd / 2;
    const c = [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]];
    for (const [a, b, cc, dd2] of [[0, 1, 2, 3], [5, 4, 7, 6], [1, 5, 6, 2], [4, 0, 3, 7], [3, 2, 6, 7]]) quad('ridge', c[a], c[b], c[cc], c[dd2]);
  }
  const RX = gx + (hip ? .05 : .3), yr = H - ridgeH * .35;
  if (!skirt) {
    const ridgePts = []; for (let i = 0; i <= 10; i++) { const x = -RX + 2 * RX * i / 10; ridgePts.push([x, yr + .16 * (Math.abs(x) / RX) ** 4, 0]); }
    tube(ridgePts, ridgeW, ridgeH);
    for (const sx of [-1, 1]) blk(sx * (RX + .05), yr + .1, 0, ridgeW * .75, ridgeH + end * .55, ridgeW * .95);
  }
  const w2 = ridgeW * .66, h2 = ridgeH * .72;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    if (!low) tube(rowsAll.filter(d => d >= db).reverse().map(d => [sx * (gx - .04), h(d), sz * (hz - d)]), w2, h2); // 내림마루 (박공 위)
    const hp = []; for (let i = 0; i <= 8; i++) { const d = db * (1 - i / 8) + .35 * (i / 8); hp.push(V(sx * (hx - d), sz * (hz - d), d, d)); }
    tube(hp, w2, h2);                                                                                        // 추녀마루
  }
  if (!low) for (const sx of [-1, 1]) tube([[sx * (gx - gin + .02), yb + .1 * sc, -zJ], [sx * (gx - gin + .02), yb + .1 * sc, zJ]], .26 * sc, .22 * sc); // 합각 아래 마루
  const geos = {};
  for (const k of Object.keys(out)) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out[k], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs[k], 2)); g.computeVertexNormals();
    if (swap) g.rotateY(Math.PI / 2);
    geos[k] = g;
  }
  geos.y = h; geos.lift = lift; geos.gx = gx;
  return geos;
}
