import { roofUV, stripUV, paintBand, paintRoof, doorTex } from './tex.js?v=1';
// 법당 하나 — 앞면이 +z. 계단으로 올라가 안으로 들어가고, 가운데 방석에서 삼배를 올릴 수 있게 내부까지 만든 모델 (위레브)
// L: 정면 폭, D: 측면 깊이(실제 건물 크기에서 가져옴), buddhas: 불단 위 부처님 수(1 또는 3)
// roof: 'hip'(팔작) | 'gable'(맞배) | 'cross'(아자 지붕) · stories: 2면 바깥이 2층(중층) · plain: 단청 없는 나무 빛 · sign: 현판 글자 텍스처
// altar: 불단 위 존상 [{k, s}] (보는 사람 기준 왼쪽→오른쪽) — k: sakya·amita·yaksa·biro(앉은 부처), bosal(앉은 보살), bosalS(선 보살), disciple(선 제자), chunsu(천수관음), buddhaS(선 부처)
export function buildHall(THREE, { L = 15, D = 13, buddhas = 3, altar = null, roof: roofType = 'hip', stories = 1, plain = false, sign = null } = {}) {
  const g = new THREE.Group();
  const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, flatShading: true, ...extra });
  const MAT = {
    stone: M('#cfc7b6'), wall: M('#f3e6cc'), col: M('#9b3b2b'), band: M('#2e8b74'), bandRed: M('#c2452d'),
    roof: M('#4f5b69', { side: THREE.DoubleSide }), ridge: M('#2f343a'), floor: M('#b98b5c', { flatShading: false, roughness: .55 }),
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
  const R0 = FY + H + .14;
  const hipRoof = (lr, wr, rh, y, ridge = true) => {
    const rlx = Math.max(.6, lr - wr * .95);
    const m = add(hipRoofGeo(THREE, lr, wr, rh, rlx, Math.min(.8, wr * .06)), MAT.roof, 0, y, 0); m.receiveShadow = false;
    if (ridge) { box(rlx + .5, .42, .5, MAT.ridge, 0, y + rh + .12, 0); for (const sx of [-1, 1]) box(.35, .75, .42, MAT.ridge, sx * (rlx / 2 + .25), y + rh + .35, 0); }
  };
  let signY = FY + H + .5, signZ = D / 2 - .18, signW = Math.min(2.6, L * .2);
  if (stories >= 2) {
    // 아래층 지붕(낮게) → 2층 벽 → 윗지붕
    const UL = L - 2.6, UD = D - 2.6, UH = 2.5;
    hipRoof(Lr, Wr, RH * .5, R0, false);
    box(UL, UH, UD, MAT.wall, 0, R0 + UH / 2, 0);
    for (let i = 0; i <= 4; i++) { const x = -UL / 2 + UL * i / 4; for (const sz of [-1, 1]) box(.22, UH, .22, MAT.col, x, R0 + UH / 2, sz * (UD / 2 + .02)); }
    for (const sz of [-1, 1]) box(UL + .1, .34, .26, MAT.band, 0, R0 + UH - .1, sz * (UD / 2 + .04));
    for (const sz of [-1, 1]) for (let i = 0; i < 4; i++) box(UL / 4 - .5, .9, .06, MAT.lattice, -UL / 2 + UL * (i + .5) / 4, R0 + UH * .45, sz * (UD / 2 + .05));
    hipRoof(UL + 2 * o, UD + 2 * o, (UD + 2 * o) * .34, R0 + UH);
    signY = R0 + UH * .75; signZ = UD / 2 + .1; signW = Math.min(2.4, UL * .26);
  } else if (roofType === 'gable') {
    const m = add(gableRoofGeo(THREE, Lr, Wr, RH * .92, .25), MAT.roof, 0, R0, 0); m.receiveShadow = false;
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
    hipRoof(Lr, Wr, RH, R0);
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
    hipRoof(Lr, Wr, RH, R0);
  }
  // 현판: 실제 법당 이름 (검은 바탕 금색 글씨)
  if (sign) {
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(signW, signW * .3), new THREE.MeshStandardMaterial({ map: sign, roughness: .6, emissive: '#ffffff', emissiveMap: sign, emissiveIntensity: .15 }));
    bd.position.set(0, signY, signZ + .14); g.add(bd);
    box(signW + .14, signW * .3 + .14, .08, MAT.col, 0, signY, signZ + .08);
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
