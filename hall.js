// 법당 하나 — 앞면이 +z. 계단으로 올라가 안으로 들어가고, 가운데 방석에서 삼배를 올릴 수 있게 내부까지 만든 모델 (위레브)
// L: 정면 폭, D: 측면 깊이(실제 건물 크기에서 가져옴), buddhas: 불단 위 부처님 수(1 또는 3)
export function buildHall(THREE, { L = 15, D = 13, buddhas = 3 } = {}) {
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
  const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, parent) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);

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
  box(IW + 2 * T, H, T, MAT.wall, 0, FY + H / 2, iz0 - T / 2);
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
  // 들어 올린 문짝(들어열개)과 인방
  for (let i = 0; i < bays; i++) box(IW / bays - .3, .07, 1.5, MAT.lattice, (fx(i) + fx(i + 1)) / 2, FY + H - .5, iz1 + .8);
  box(IW + .5, .32, .3, MAT.col, 0, FY + H - .16, iz1);
  // 단청 띠
  box(L - .2, .42, .3, MAT.band, 0, FY + H + .1, D / 2 - .35);
  box(L - .2, .1, .32, MAT.bandRed, 0, FY + H - .14, D / 2 - .35);
  box(L - .2, .42, .3, MAT.band, 0, FY + H + .1, -D / 2 + .35);
  for (const sx of [-1, 1]) box(.3, .42, D - .4, MAT.band, sx * (L / 2 - .35), FY + H + .1, 0);
  // 천장 (우물천장 느낌의 초록)
  box(L - .5, .12, D - .5, MAT.ceil, 0, FY + H + .02, 0);

  // 팔작풍 지붕: 처마 끝이 살짝 들린 모양
  const o = 1.3, Lr = L + 2 * o, Wr = D + 2 * o, RH = Wr * .34, rl = Math.max(.6, Lr - Wr * .95);
  const roof = add(hipRoofGeo(THREE, Lr, Wr, RH, rl, Math.min(.8, Wr * .06)), MAT.roof, 0, FY + H + .14, 0);
  roof.receiveShadow = false;
  box(rl + .5, .42, .5, MAT.ridge, 0, FY + H + .14 + RH + .12, 0);
  for (const sx of [-1, 1]) box(.35, .75, .42, MAT.ridge, sx * (rl / 2 + .25), FY + H + .14 + RH + .35, 0);

  // 불단(수미단)
  const AW = Math.min(IW - 2.2, 9.5), AD = 1.7, AH = 1.05, AZ = iz0 + .2 + AD / 2;
  box(AW, AH, AD, MAT.altar, 0, FY + AH / 2, AZ);
  box(AW + .2, .1, AD + .2, MAT.trim, 0, FY + AH + .05, AZ);
  box(AW + .1, .12, AD + .1, MAT.trim, 0, FY + .06, AZ);
  col(0, AZ, AW / 2 + .1, AD / 2 + .15);
  // 뒤 벽 탱화 자리 (실제 탱화를 옮기지 않고 붉은 바탕 + 금색 테두리만)
  const PH = H - AH - .35, PY = FY + AH + .15 + PH / 2;
  box(AW + .6, PH, .05, MAT.panel, 0, PY, iz0 + .04);
  box(AW + .8, .1, .07, MAT.trim, 0, PY + PH / 2, iz0 + .05); box(AW + .8, .1, .07, MAT.trim, 0, PY - PH / 2, iz0 + .05);
  for (const sx of [-1, 1]) box(.1, PH, .07, MAT.trim, sx * (AW / 2 + .35), PY, iz0 + .05);
  // 부처님 (삼존불 또는 한 분)
  const BY = FY + AH + .1;
  const seats = buddhas >= 3 ? [[0, 1], [-AW * .33, .78], [AW * .33, .78]] : buddhas >= 1 ? [[0, 1]] : [];
  const slots = []; // 부처님 자리 (나중에 실제 불상 모델로 바꿔 끼움)
  for (const [x, s] of seats) { const b = buddha(THREE, MAT, s); b.position.set(x, BY, AZ - .15); g.add(b); slots.push({ x, y: BY, z: AZ - .15, s, obj: b }); }
  if (!seats.length) { // 적멸보궁: 불상 대신 진신사리를 모신 종 모양 사리탑
    add(new THREE.CylinderGeometry(.55, .62, .22, 16), MAT.bronze, 0, BY + .11, AZ - .15);
    const bell = add(new THREE.SphereGeometry(.42, 20, 14), MAT.gold, 0, BY + .62, AZ - .15); bell.scale.y = 1.25;
    add(new THREE.CylinderGeometry(.06, .1, .5, 10), MAT.gold, 0, BY + 1.33, AZ - .15);
    add(new THREE.SphereGeometry(.1, 12, 10), MAT.gold, 0, BY + 1.62, AZ - .15);
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

// 처마 끝이 살짝 들린 지붕
function hipRoofGeo(THREE, Lr, Wr, H, rl, lift) {
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
  return geo;
}
