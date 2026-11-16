// 아기 스님 아바타 — 사용자가 Gemini로 만든 오리지널 '아기 스님(동자승)' 캐릭터 시트를 그대로 옮긴 3D 모델 (위레브)
// 시트 비율: 머리 약 42% · 저고리 약 33% · 바지와 고무신 약 25% (머리는 시트처럼 크게), 큰 귀, 넓은 소매, 왼쪽 어깨에서 내려오는 황토색 가사
import * as THREE from 'three';

export function createBabyMonk() {
  const SM = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .6, ...extra });
  const AV = {
    robe: SM('#c9c7c5'), pants: SM('#bfbdbb'), collar: SM('#d3d1ce'), kasa: SM('#b07c22', { side: THREE.DoubleSide, roughness: .7 }),
    skin: SM('#f7dccd'), bead: SM('#8a5a36', { roughness: .35 }), shoe: SM('#f6f4f1', { roughness: .4 }), earIn: SM('#f2b8a8'),
  };
  const avatar = new THREE.Group(); avatar.scale.setScalar(.74);
  const body = new THREE.Group(); avatar.add(body);
  const shade = m => { m.castShadow = true; return m; };
  const HIP = .46, Y = y => y - HIP;                    // 허리(골반) 높이: 윗몸은 여기를 축으로 숙임
  const upper = new THREE.Group(); upper.position.y = HIP; body.add(upper);

  // 통 넓은 회색 바지 + 흰 고무신
  const pantGeo = new THREE.LatheGeometry([[0, .09], [.12, .09], [.142, .14], [.138, .28], [.15, .42], [.12, .52], [0, .52]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
  const legs = [-1, 1].map(sx => {
    const g = new THREE.Group(); g.position.x = sx * .15; body.add(g);
    g.add(shade(new THREE.Mesh(pantGeo, AV.pants)));
    const shoe = shade(new THREE.Mesh(new THREE.SphereGeometry(.1, 24, 14), AV.shoe)); shoe.scale.set(1, .55, 1.55); shoe.position.set(0, .055, .045); g.add(shoe);
    const toe = shade(new THREE.Mesh(new THREE.SphereGeometry(.05, 14, 10), AV.shoe)); toe.scale.set(.9, .7, 1); toe.position.set(0, .085, .17); g.add(toe);
    return g;
  });

  // 저고리: 아래가 살짝 퍼진 종 모양 (앞뒤로는 조금 납작하게)
  const J = [[0, .45], [.46, .45], [.49, .48], [.47, .56], [.44, .68], [.41, .8], [.38, .92], [.33, .99], [.22, 1.05], [.11, 1.09], [0, 1.1]];
  const rAt = y => { for (let i = 1; i < J.length; i++) { const [r0, y0] = J[i - 1], [r1, y1] = J[i]; if (y <= y1 || i === J.length - 1) { const t = Math.min(1, Math.max(0, (y - y0) / ((y1 - y0) || 1))); return r0 + (r1 - r0) * t; } } return 0; };
  const ZS = .78;
  const torso = shade(new THREE.Mesh(new THREE.LatheGeometry(J.map(([r, y]) => new THREE.Vector2(r, Y(y))), 56), AV.robe)); torso.scale.z = ZS; upper.add(torso);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.1, .11, .18, 16), AV.skin); neck.position.y = Y(1.13); upper.add(neck);
  // 가사: 저고리보다 조금 크고 길게, '왼쪽 어깨 → 오른쪽 허리' 사선 아래만 남김 (앞뒤 모두)
  function kasaGeo() {
    const base = [[.49, .42]].concat(J.slice(2)), dense = [];
    for (let i = 0; i < base.length - 1; i++) for (let k = 0; k < 8; k++) { const t = k / 8; dense.push([base[i][0] + (base[i + 1][0] - base[i][0]) * t, base[i][1] + (base[i + 1][1] - base[i][1]) * t]); }
    dense.push(base[base.length - 1]);
    const g = new THREE.LatheGeometry(dense.map(([r, y]) => new THREE.Vector2(r * 1.035 + .006, Y(y))), 180);
    const pos = g.attributes.position, idx = g.index.array, keep = [];
    const inK = i => { const x = pos.getX(i), y = pos.getY(i) + HIP; return y > .419 && y < .55 + (x + .45) * .9; };
    for (let t = 0; t < idx.length; t += 3) if (inK(idx[t]) && inK(idx[t + 1]) && inK(idx[t + 2])) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    g.setIndex(keep); g.computeVertexNormals(); return g;
  }
  const kasa = shade(new THREE.Mesh(kasaGeo(), AV.kasa)); kasa.scale.z = ZS; upper.add(kasa);
  // 교차한 깃 (오른쪽 깃이 위로 겹침, 끝은 가사 밑으로 들어감)
  const onJacket = (phi, y, off) => { const r = rAt(y) + off; return new THREE.Vector3(Math.sin(phi) * r, Y(y), Math.cos(phi) * r * ZS); };
  const band = (a, b, off = .012) => { const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(onJacket(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, off)); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, .015, 8); };
  upper.add(new THREE.Mesh(band([.45, 1.065], [0, .87]), AV.collar));
  upper.add(new THREE.Mesh(band([-.45, 1.065], [.05, .85], .016), AV.collar));
  // 나무 염주 (가슴까지 늘어짐)
  const beadGeo = new THREE.SphereGeometry(.032, 12, 10);
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2, front = Math.max(0, Math.cos(a)), y = 1.045 - front * .11, r = rAt(y) + .032;
    const b = new THREE.Mesh(beadGeo, AV.bead); b.position.set(Math.sin(a) * r, Y(y), Math.cos(a) * r * ZS + front * .02); upper.add(b);
  }

  // 머리: 정수리·뒤통수는 파르스름한 깎은 머리, 얼굴은 살색 (정점 색으로 부드럽게)
  const HS = new THREE.Vector3(1.0, 1.03, .98), HR = .4; // 시트처럼 옆으로 넓지 않고 동그란 머리
  const headG = new THREE.Group(); headG.position.y = Y(1.55); headG.scale.setScalar(1.16); upper.add(headG); // 시트처럼 목 없이 깃 위에 바로 큰 머리
  const headGeo = new THREE.SphereGeometry(HR, 56, 40);
  {
    const p = headGeo.attributes.position, n = new THREE.Vector3(), cols = [], skin = new THREE.Color('#f7dccd'), scalp = new THREE.Color('#c3ccd3'), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      n.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      const t = .58 * Math.max(n.z, 0) + .1 * (1 - Math.abs(n.z)) - .45 * Math.max(-n.z, 0); // 이마가 넓게 보이도록 머리선을 높게
      const k = THREE.MathUtils.smoothstep(n.y, t - .03, t + .07);
      c.copy(skin).lerp(scalp, k); cols.push(c.r, c.g, c.b);
    }
    headGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  }
  const headM = shade(new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55 }))); headM.scale.copy(HS); headG.add(headM);
  const surf = (x, y, off = 0) => { const zx = x / (HR * HS.x), zy = y / (HR * HS.y); const z = HR * HS.z * Math.sqrt(Math.max(0, 1 - zx * zx - zy * zy)); const nrm = new THREE.Vector3(x / (HS.x * HS.x), y / (HS.y * HS.y), z / (HS.z * HS.z)).normalize(); return { p: new THREE.Vector3(x, y, z).addScaledVector(nrm, off), n: nrm }; };
  const facing = (mesh, x, y, off) => { const s = surf(x, y, off); mesh.position.copy(s.p); mesh.lookAt(s.p.clone().add(s.n)); return mesh; };
  // 큰 귀 (눈 높이)
  for (const sx of [-1, 1]) {
    const ear = shade(new THREE.Mesh(new THREE.SphereGeometry(.118, 20, 14), AV.skin)); ear.scale.set(.48, 1, .8); ear.position.set(sx * .41, -.045, -.01); headG.add(ear);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(.068, 14, 10), AV.earIn); inner.scale.set(.32, 1, .7); inner.position.set(sx * .45, -.045, .018); headG.add(inner);
  }
  // 얼굴: 시트의 얼굴(동그란 큰 눈·옅은 눈썹·볼터치·벌린 웃는 입)을 캔버스에 그려 머리 앞면에 붙임
  // 평소 · 깜빡임 · 합장(지그시 감은 눈 + 다문 미소) 세 장을 바꿔 끼움
  const nose = new THREE.Mesh(new THREE.SphereGeometry(.016, 12, 10), AV.skin); facing(nose, 0, -.128, .004); headG.add(nose);
  const FW = .36;
  const faceGeo = new THREE.SphereGeometry(HR * 1.006, 64, 48, Math.PI / 2 - 1.05, 2.1, Math.PI / 2 - 1.0, 2.0);
  { const p = faceGeo.attributes.position, uv = faceGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * HS.x / FW * .5 + .5, p.getY(i) * HS.y / FW * .5 + .5); uv.needsUpdate = true; }
  const mkTex = mode => { const cv = document.createElement('canvas'); drawFace(cv, mode, FW); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const faceTex = { open: mkTex('open'), blink: mkTex('blink'), calm: mkTex('calm') };
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex.open, transparent: true, depthWrite: false, roughness: .45, polygonOffset: true, polygonOffsetFactor: -4 });
  const faceM = new THREE.Mesh(faceGeo, faceMat); faceM.scale.copy(HS); faceM.renderOrder = 2; headG.add(faceM);
  const face = { closed: false, blink: false, cur: 'open' };
  const applyFace = () => { const m = face.closed ? 'calm' : face.blink ? 'blink' : 'open'; if (m !== face.cur) { face.cur = m; faceMat.map = faceTex[m]; } };
  // 앱 쪽 코드(눈 보이기·깜빡임)와 그대로 맞물리도록 같은 모양의 손잡이를 돌려줌
  const eyeProxy = { set visible(v) { face.closed = !v; applyFace(); }, scale: { set y(v) { face.blink = v < .5; applyFace(); } } };
  const eyeGroups = [eyeProxy], closedEyes = [], faceOpen = [];
  const setFace = mode => { face.closed = mode === 'calm'; face.blink = mode === 'blink'; applyFace(); };

  // 넓은 소매(나팔 모양) + 손: 평소엔 시트처럼 팔을 비스듬히 벌리고, 합장하면 가슴 앞에서 모음
  const sleeveGeo = new THREE.CylinderGeometry(.095, .165, 1, 22), handGeo = new THREE.SphereGeometry(.072, 18, 14), thumbGeo = new THREE.SphereGeometry(.03, 10, 8);
  const arms = [-1, 1].map(sx => {
    const sl = shade(new THREE.Mesh(sleeveGeo, AV.robe)), hd = shade(new THREE.Mesh(handGeo, AV.skin));
    hd.scale.set(.85, 1.1, .7); const th = new THREE.Mesh(thumbGeo, AV.skin); th.position.set(-sx * .05, .02, .03); hd.add(th);
    upper.add(sl, hd); return { sx, sl, hd };
  });
  const _up = new THREE.Vector3(0, 1, 0), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _rest = new THREE.Vector3(), _pray = new THREE.Vector3();
  // 매 프레임 호출됨: 팔 배치 + 앱이 몸 전체에 준 절 동작을 '무릎 꿇고 허리 숙이기'로 바꿔 적용
  function placeArms(hap, swing) {
    const bendIn = body.rotation.x, kneel = body.position.y < 0 ? Math.min(1, -body.position.y / .2) : 0;
    if (bendIn !== 0 || kneel > 0 || upper.rotation.x !== 0) {
      body.rotation.x = 0;
      upper.rotation.x = bendIn * (kneel > .3 ? 1.2 : .8);
      if (kneel > 0) body.position.y = -kneel * .3;
    }
    for (const { sx, sl, hd } of arms) {
      _a.set(sx * .34, Y(.97), .03);
      _rest.set(sx * .64, Y(.56), .05 + swing * sx * .12);
      _pray.set(sx * .045, Y(.95), .46);
      _b.copy(_rest).lerp(_pray, hap);
      _d.subVectors(_b, _a); const len = _d.length(); _d.normalize();
      sl.position.copy(_a).addScaledVector(_d, len * .46); sl.scale.set(1, len * .92, 1); sl.quaternion.setFromUnitVectors(_up, _d);
      hd.position.copy(_b); hd.quaternion.setFromUnitVectors(_up, _d.clone().negate());
    }
  }
  placeArms(0, 0);
  // 얼굴을 밝게 비추는 보조 조명 (카메라 쪽에서)
  const faceFill = new THREE.DirectionalLight(0xfff6ee, 1.8);
  return { avatar, body, headG, torso, kasa, legs, eyeGroups, closedEyes, faceOpen, placeArms, faceFill, setFace };
}

// 얼굴 그림 (머리 앞면 좌표 x·y를 캔버스에 펼친 것, 1단위 = 머리 반지름 기준)
export function drawFace(cv, mode, FW = .36, CS = 1024) {
  cv.width = cv.height = CS; const c = cv.getContext('2d');
  const P = (x, y) => [(x / FW * .5 + .5) * CS, (.5 - y / FW * .5) * CS], U = v => v / FW * .5 * CS;
  c.lineCap = 'round'; c.lineJoin = 'round';
  // 볼터치
  for (const sx of [-1, 1]) {
    const [x, y] = P(sx * .25, -.162), g = c.createRadialGradient(x, y, 0, x, y, U(.088));
    g.addColorStop(0, 'rgba(247,138,140,.62)'); g.addColorStop(.6, 'rgba(247,138,140,.3)'); g.addColorStop(1, 'rgba(247,138,140,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y, U(.088), U(.066), 0, 0, 7); c.fill();
  }
  // 옅은 눈썹
  c.strokeStyle = 'rgba(140,116,104,.62)'; c.lineWidth = U(.012);
  for (const sx of [-1, 1]) { const [x, y] = P(sx * .165, .085); c.beginPath(); c.ellipse(x, y + U(.036), U(.036), U(.036), 0, Math.PI * 1.27, Math.PI * 1.73); c.stroke(); }
  // 눈
  for (const sx of [-1, 1]) {
    const [x, y] = P(sx * .158, -.075), rx = U(.073), ry = U(.082);
    if (mode === 'open') {
      c.fillStyle = '#fdfcfa'; c.beginPath(); c.ellipse(x + sx * U(.002), y + U(.005), rx * 1.03, ry * 1.02, 0, 0, 7); c.fill();
      const g = c.createLinearGradient(x, y - ry, x, y + ry);
      g.addColorStop(0, '#16110f'); g.addColorStop(.5, '#342925'); g.addColorStop(1, '#8d776b');
      c.fillStyle = g; c.beginPath(); c.ellipse(x - sx * U(.002), y - U(.002), rx, ry, 0, 0, 7); c.fill();
      c.fillStyle = 'rgba(10,7,6,.5)'; c.beginPath(); c.ellipse(x, y - U(.008), rx * .5, ry * .52, 0, 0, 7); c.fill();
      c.strokeStyle = '#241a17'; c.lineWidth = U(.012); c.beginPath(); c.ellipse(x, y + U(.002), rx * 1.1, ry * 1.07, 0, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(x - U(.02), y - U(.027), U(.023), U(.026), -.35, 0, 7); c.fill();
      c.beginPath(); c.arc(x + U(.024), y + U(.028), U(.0105), 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.ellipse(x, y + ry * .6, rx * .55, ry * .17, 0, 0, 7); c.fill();
    } else {
      // 감은 눈: 아래로 둥근 곡선 (합장할 땐 조금 더 둥글게)
      c.strokeStyle = '#2a1f1c'; c.lineWidth = U(.012);
      const k = mode === 'calm' ? 1 : .7;
      c.beginPath(); c.ellipse(x, y - U(.02) * k, U(.052), U(.038) * k, 0, Math.PI * .12, Math.PI * .88); c.stroke();
    }
  }
  // 입
  if (mode === 'calm') {
    const [x, y] = P(0, -.172); c.strokeStyle = '#b4545a'; c.lineWidth = U(.01);
    c.beginPath(); c.ellipse(x, y - U(.016), U(.03), U(.022), 0, Math.PI * .15, Math.PI * .85); c.stroke();
  } else {
    const [x, y] = P(0, -.178), w = U(.043), h = U(.05);
    c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x, y - U(.008), x + w, y); c.quadraticCurveTo(x + w * .92, y + h, x, y + h); c.quadraticCurveTo(x - w * .92, y + h, x - w, y); c.closePath();
    c.fillStyle = '#8c2b33'; c.fill();
    c.save(); c.clip(); c.fillStyle = '#f2909a'; c.beginPath(); c.ellipse(x, y + h * .98, w * .72, h * .55, 0, 0, 7); c.fill(); c.restore();
  }
}
