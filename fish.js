// 휴휴암 연화대 앞바다의 황어 떼 · 물고기 밥 던지기 · 방생
// 실제 모습: 연화대(광어바위) 옆 얕은 바다에 황어 수천 마리가 모여 있고, 입구에서 파는 물고기 밥(현장 2,000원)을 던지면 몰려듦.
// 방생 물고기(황어·새끼 우럭 등)는 수조에서 사서 바다로 놓아 줌 (현장 2만 원: 작은 물고기 5마리 · 큰 물고기 2마리)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const SWIM = { value: 0 }; // 꼬리 흔들기 시간 (모든 물고기 공용)

// 몸통이 +z(머리)~-z(꼬리) 길이 1인 물고기: 꼬리 쪽일수록 크게 좌우로 휘며 헤엄침
function swimMat(base) {
  const m = base.clone();
  m.onBeforeCompile = sh => {
    sh.uniforms.uSwim = SWIM;
    sh.vertexShader = 'uniform float uSwim;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float swPh = 0.0;
      #ifdef USE_INSTANCING
        swPh = instanceMatrix[3].x * 3.7 + instanceMatrix[3].z * 2.3;
      #endif
      float swK = clamp(0.45 - transformed.z, 0.0, 1.0);
      transformed.x += sin(uSwim * 10.0 + swPh - transformed.z * 6.5) * 0.09 * swK * swK;`);
  };
  m.customProgramCacheKey = () => 'swim-fish';
  return m;
}

// 모델을 불러오기 전에 쓰는 물고기: 옆으로 납작한 유선형 몸 + 꼬리·등지느러미, 몸 색은 꼭짓점 색
function fishGeo(kind) {
  const hw = kind === 'ureok';
  const prof = hw ? [[0, -.5], [.03, -.42], [.08, -.3], [.13, -.1], [.15, .1], [.14, .26], [.11, .38], [.06, .47], [0, .5]]
    : [[0, -.5], [.022, -.43], [.055, -.32], [.09, -.12], [.105, .08], [.1, .25], [.075, .38], [.04, .47], [0, .5]];
  const body = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 14);
  body.rotateX(Math.PI / 2); body.scale(.46, 1, 1);
  const tri = (pts) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pts.length * 2).fill(0), 2)); g.computeVertexNormals(); return g; };
  const tail = tri([[0, 0, -.44], [0, .17, -.68], [0, .02, -.57], [0, 0, -.44], [0, -.02, -.57], [0, -.17, -.68]]);
  const dors = tri(hw ? [[0, .13, .18], [0, .24, .02], [0, .13, -.18]] : [[0, .09, .12], [0, .19, .02], [0, .09, -.06]]);
  const anal = tri([[0, -.07, -.12], [0, -.14, -.22], [0, -.06, -.28]]);
  const g = mergeGeometries([body.toNonIndexed(), tail, dors, anal]);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  const back = new THREE.Color(hw ? '#3b3530' : '#41545f'), belly = new THREE.Color(hw ? '#8f8578' : '#dfe6ea'), gold = new THREE.Color('#e3a43a'), fin = new THREE.Color(hw ? '#4a3f36' : '#d8743c');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), onFin = Math.abs(x) < 1e-4 && (z < -.44 || Math.abs(y) > .1);
    if (onFin) c.copy(fin);
    else {
      c.copy(belly).lerp(back, THREE.MathUtils.smoothstep(y, -.02, .07));
      if (!hw) for (const s of [.035, -.005, -.045]) if (Math.abs(y - s) < .011 && z > -.36 && z < .36) c.lerp(gold, .85); // 황어: 굵은 황금색 줄 세 개
      if (hw && Math.sin(z * 31 + y * 23) > .55) c.multiplyScalar(.7);                                                   // 우럭: 얼룩
      if (z > .36 && Math.abs(y - .02) < .02 && Math.abs(x) > .02) c.set('#111111');                                    // 눈
    }
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// 부드러운 가장자리 원판 (물밑 그늘·물비늘 막)
function softDisc(color, alpha) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
  const g = v => { const k = Math.round(255 * v); return `rgb(${k},${k},${k})`; }; // alphaMap은 초록 채널을 씀 → 검은 바탕에 회색 단계로
  x.fillStyle = '#000'; x.fillRect(0, 0, 128, 128);
  const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, g(alpha)); gr.addColorStop(.6, g(alpha * .85)); gr.addColorStop(1, g(0));
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  return new THREE.MeshBasicMaterial({ color, alphaMap: t, transparent: true, depthWrite: false });
}

export function createSchool(site, { cx, cz, rx = 5.5, rz = 3.6, n = 650, extra = 30, sea = null, avoid = null } = {}) {
  const N = n + extra, Y0 = .07, Y1 = .19;
  const hMat = swimMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .35, metalness: .45, side: THREE.DoubleSide }));
  const mesh = new THREE.InstancedMesh(fishGeo('hwangeo'), hMat, N); mesh.frustumCulled = false; mesh.castShadow = false; site.add(mesh);
  // 물밑 그늘과 물비늘 막: 물고기가 물속에 있는 것처럼
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 40), softDisc('#1d4c57', .75)); floor.rotation.x = -Math.PI / 2; floor.scale.set(rx * 1.25, rz * 1.25, 1); floor.position.set(cx, .052, cz); site.add(floor);
  const film = new THREE.Mesh(new THREE.CircleGeometry(1, 40), softDisc('#5fb4c0', .22)); film.rotation.x = -Math.PI / 2; film.scale.set(rx * 1.2, rz * 1.2, 1); film.position.set(cx, Y1 + .025, cz); film.renderOrder = 2; site.add(film);
  const inside = (x, z, pad = 0) => ((x - cx) / (rx - pad)) ** 2 + ((z - cz) / (rz - pad)) ** 2 < 1;   // 평소 모여 노는 곳
  // 헤엄칠 수 있는 물: 연화대 앞 넓은 바다(sea) 중 바위(avoid)를 뺀 곳 — 밥을 던지면 이 안 어디든 따라감
  const S0 = sea || { x: cx, z: cz, rx, rz };
  const water = (x, z, pad = 0) => ((x - S0.x) / (S0.rx - pad)) ** 2 + ((z - S0.z) / (S0.rz - pad)) ** 2 < 1 && !(avoid && ((x - avoid.x) / (avoid.rx + pad)) ** 2 + ((z - avoid.z) / (avoid.rz + pad)) ** 2 < 1);
  let feedSpot = null; // 마지막으로 밥을 던진 곳: 한동안 그 근처에 머묾
  // 무리(떼): 각 무리의 목표 지점이 천천히 옮겨 다니고, 물고기는 자기 무리 목표 + 개인 간격을 따라감 (사람 서 있는 바위 쪽에 더 빽빽)
  const G = Array.from({ length: 9 }, (_, k) => ({ x: cx, z: cz, t: 0, k }));
  const pick = gp => { if (feedSpot && feedSpot.t > 0) for (let k = 0; k < 12; k++) { const a = Math.random() * 6.3, r = Math.sqrt(Math.random()) * 2.2, x = feedSpot.x + Math.cos(a) * r, z = feedSpot.z + Math.sin(a) * r * .7; if (water(x, z, .6)) { gp.x = x; gp.z = z; gp.t = 2 + Math.random() * 3; return; } }
    for (let k = 0; k < 20; k++) { const a = Math.random() * 6.3, r = Math.sqrt(Math.random()) * .85, x = cx + Math.cos(a) * rx * r, z = cz + Math.abs(Math.sin(a)) * rz * r * (Math.random() < .65 ? 1 : -1); if (inside(x, z, 1)) { gp.x = x; gp.z = z; gp.t = 4 + Math.random() * 6; return; } } };
  G.forEach(pick);
  const F = [];
  for (let i = 0; i < N; i++) {
    let x, z; do { x = cx + (Math.random() * 2 - 1) * rx; z = cz + (Math.random() * 2 - 1) * rz; } while (!inside(x, z, .3));
    F.push({ x, z, y: Y0 + Math.random() * (Y1 - Y0 - .03), h: Math.random() * 6.3, sp: .3, s: .34 + Math.random() * .14, on: i < n, tgt: -1, look: Math.random(), vy: 0, air: 0, out: 0, kind: 'hwangeo', g: G[i % G.length], ox: (Math.random() - .5) * 2.6, oz: (Math.random() - .5) * 1.8, tw: Math.random() * 6 });
  }
  // 물고기 밥 알갱이
  const PM = 260, pellets = [], pGeo = new THREE.DodecahedronGeometry(.028, 0), pMesh = new THREE.InstancedMesh(pGeo, new THREE.MeshStandardMaterial({ color: '#8a5a2b', roughness: .8 }), PM);
  pMesh.frustumCulled = false; site.add(pMesh);
  // 물 튀김 고리
  const rings = Array.from({ length: 16 }, () => { const r = new THREE.Mesh(new THREE.RingGeometry(.06, .1, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.visible = false; site.add(r); return { m: r, t: 9 }; });
  let ri = 0; const splash = (x, z, big = 1) => { const r = rings[ri++ % rings.length]; r.t = 0; r.big = big; r.m.position.set(x, Y1 + .04, z); r.m.visible = true; };
  // 방생: 양동이에서 뛰어드는 물고기 (우럭은 따로)
  const uMat = swimMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: .15, side: THREE.DoubleSide }));
  const UM = 8, uMesh = new THREE.InstancedMesh(fishGeo('ureok'), uMat, UM); uMesh.frustumCulled = false; site.add(uMesh);
  const U = Array.from({ length: UM }, () => ({ on: false }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), hide = new THREE.Matrix4().makeScale(0, 0, 0);
  let t = 0;
  const api = {
    mesh, center: { x: cx, z: cz }, inside, water,
    model: k => k === 'ureok' ? uMesh : mesh,
    // 밥 한 줌 던지기: from(사이트 좌표의 손 위치) → to 근처에 흩뿌림
    throwFood(from, to, count = 26) {
      let k = 0;
      for (let i = 0; i < PM && k < count; i++) {
        const p = pellets[i]; if (p && p.st !== 'gone') continue;
        let tx = to.x, tz = to.z; for (let tr = 0; tr < 6; tr++) { const ang = Math.random() * 6.3, rr = Math.sqrt(Math.random()) * 1.1; if (water(to.x + Math.cos(ang) * rr, to.z + Math.sin(ang) * rr)) { tx = to.x + Math.cos(ang) * rr; tz = to.z + Math.sin(ang) * rr; break; } }
        const T = .5 + Math.hypot(tx - from.x, tz - from.z) * .05 + Math.random() * .15;
        pellets[i] = { st: 'fly', x: from.x, y: from.y, z: from.z, vx: (tx - from.x) / T, vz: (tz - from.z) / T, vy: (Y1 + .03 - from.y + 4.9 * T * T) / T, t: 0 }; k++;
      }
      feedSpot = { x: to.x, z: to.z, t: 12 }; for (const gp of G) gp.t = Math.random() * .6; // 무리들이 곧바로 그쪽으로
      return k;
    },
    // 방생: kind 'hwangeo'(작은 물고기 5마리) | 'ureok'(큰 물고기 2마리)
    release(kind, from, to) {
      const cnt = kind === 'ureok' ? 2 : 5;
      for (let c = 0; c < cnt; c++) {
        const tx = to.x + (Math.random() - .5) * 1.4, tz = to.z + (Math.random() - .5) * 1.4, T = .6 + c * .12;
        const o = { x: from.x, y: from.y, z: from.z, vx: (tx - from.x) / T, vz: (tz - from.z) / T, vy: (Y1 - from.y + 4.9 * T * T) / T, air: T + .05, delay: c * .22, h: Math.atan2(tx - from.x, tz - from.z), s: kind === 'ureok' ? .62 : .42, out: 0 };
        if (kind === 'ureok') { const u = U.find(u => !u.on); if (u) Object.assign(u, o, { on: true, t: 0 }); }
        else { const f = F.find(f => !f.on); if (f) Object.assign(f, o, { on: true, jump: true, kind: 'hwangeo', tgt: -1 }); }
      }
    },
    // Meshy로 만든 물고기 모델로 바꾸기 (불러오지 못하면 지금 모양 그대로)
    async loadModel(kind, url) {
      try {
        const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
        const gltf = await loader.loadAsync(url); let src = null; gltf.scene.traverse(o => { if (!src && o.isMesh) src = o; }); if (!src) return false;
        gltf.scene.updateMatrixWorld(true); const g = src.geometry.clone();
        for (const k of ['position', 'normal']) { const a = g.attributes[k]; if (a && !(a.array instanceof Float32Array)) { const f = new Float32Array(a.count * 3); for (let i = 0; i < a.count; i++) f.set([a.getX(i), a.getY(i), a.getZ(i)], i * 3); g.setAttribute(k, new THREE.BufferAttribute(f, 3)); } }
        g.applyMatrix4(src.matrixWorld);
        g.computeBoundingBox(); const b = g.boundingBox, s = new THREE.Vector3(); b.getSize(s); const c = new THREE.Vector3(); b.getCenter(c); g.translate(-c.x, -c.y, -c.z);
        if (s.x > s.z) g.rotateY(-Math.PI / 2);                     // 몸길이를 z축으로
        g.computeBoundingBox(); const L = g.boundingBox.max.z - g.boundingBox.min.z; g.scale(1 / L, 1 / L, 1 / L);
        // 머리 쪽을 +z로: 머리 쪽 몸통이 꼬리자루보다 옆으로 두꺼움
        const p = g.attributes.position; let wH = 0, wT = 0; for (let i = 0; i < p.count; i++) { const z = p.getZ(i), ax = Math.abs(p.getX(i)); if (z > .15 && z < .35) wH = Math.max(wH, ax); else if (z < -.15 && z > -.35) wT = Math.max(wT, ax); } if (wT > wH) g.rotateY(Math.PI);
        g.computeBoundingBox(); const bb = g.boundingBox; g.translate(0, -(bb.max.y + bb.min.y) / 2, 0); g.computeVertexNormals();
        const base = src.material.clone(); if (g.attributes.color) { base.vertexColors = true; base.map = null; } base.side = THREE.DoubleSide; base.metalness = Math.min(base.metalness ?? 0, kind === 'hwangeo' ? .35 : .1); base.roughness = Math.max(base.roughness ?? .5, .35);
        const target = kind === 'ureok' ? uMesh : mesh; target.geometry.dispose(); target.geometry = g; target.material = swimMat(base);
        return true;
      } catch (err) { return false; }
    },
    update(dt) {
      t += dt; SWIM.value += dt * (1 + Math.min(1.2, api.frenzy));
      // 밥알: 날아가 물에 떨어지면 잠시 떠 있다가 가라앉음
      const floating = [];
      for (let i = 0; i < PM; i++) {
        const p = pellets[i];
        if (!p || p.st === 'gone') { pMesh.setMatrixAt(i, hide); continue; }
        p.t += dt;
        if (p.st === 'fly') { p.vy -= 9.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y <= Y1 + .03) { p.y = Y1 + .03; p.st = 'float'; p.t = 0; if (Math.random() < .25) splash(p.x, p.z, .5); } }
        else { p.y = Y1 + .03 - Math.min(.12, p.t * .015); if (p.t > 9) p.st = 'gone'; else floating.push(i); }
        pMesh.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z));
      }
      pMesh.instanceMatrix.needsUpdate = true;
      if (feedSpot) feedSpot.t -= dt;
      for (const gp of G) { gp.t -= dt; if (gp.t <= 0) pick(gp); }
      api.frenzy = Math.max(0, (api.frenzy || 0) - dt * .3); if (floating.length) api.frenzy = Math.min(2, api.frenzy + dt * 1.5);
      // 황어
      for (let i = 0; i < N; i++) {
        const f = F[i];
        if (!f.on) { mesh.setMatrixAt(i, hide); continue; }
        if (f.air > 0 || f.delay > 0) { // 방생: 양동이에서 바다로 포물선
          if (f.delay > 0) { f.delay -= dt; mesh.setMatrixAt(i, hide); continue; }
          f.air -= dt; f.vy -= 9.8 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
          if (f.y <= Y1 && f.vy < 0) { f.y = Y1 - .02; f.air = 0; splash(f.x, f.z, 1.4); for (let k = 0; k < 8 && !water(f.x, f.z, .2); k++) { f.x = cx + (f.x - cx) * .85; f.z = cz + (f.z - cz) * .85; } }
          e.set(-Math.atan2(f.vy, Math.hypot(f.vx, f.vz)) * .8, f.h, 0, 'YXZ'); q.setFromEuler(e); mesh.setMatrixAt(i, m4.compose(v.set(f.x, f.y, f.z), q, sc.setScalar(f.s))); continue;
        }
        // 목표: 가까운 밥알 (0.4초마다 다시 고름)
        f.look -= dt;
        if (f.look <= 0) {
          f.look = .3 + Math.random() * .25; f.tgt = -1; let bd = 196;
          for (let k = 0; k < floating.length; k += Math.max(1, floating.length >> 5)) { const p = pellets[floating[k]], d = (p.x - f.x) ** 2 + (p.z - f.z) ** 2; if (d < bd) { bd = d; f.tgt = floating[k]; } }
        }
        let want, speed;
        const p = f.tgt >= 0 ? pellets[f.tgt] : null;
        if (p && p.st === 'float') {
          want = Math.atan2(p.x - f.x, p.z - f.z); speed = 1.7 + (i % 7) * .1;
          const d = Math.hypot(p.x - f.x, p.z - f.z);
          if (d < .16) { p.st = 'gone'; f.tgt = -1; if (Math.random() < .35) splash(f.x, f.z, .35); if (Math.random() < .12) f.vy = 1.6; }
          f.y += (Y1 - .015 - f.y) * Math.min(1, dt * 4);                                     // 물 위로 입을 내밀며 몰려듦
        } else {
          f.tgt = -1;
          const gx = f.g.x + f.ox + Math.sin(t * .4 + f.tw) * .6, gz = f.g.z + f.oz + Math.cos(t * .33 + f.tw) * .4;  // 무리 따라 느긋하게
          want = Math.atan2(gx - f.x, gz - f.z) + Math.sin(t * 1.3 + f.tw) * .35;
          const dg = Math.hypot(gx - f.x, gz - f.z);
          speed = (.22 + (i % 5) * .04) * Math.min(1.6, .5 + dg * .5);
          f.y += ((Y0 + .02 + (i % 9) * .009) - f.y) * Math.min(1, dt * 1.2);
        }
        let dh = want - f.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); f.h += dh * Math.min(1, dt * (p ? 5 : 1.6));
        f.sp += (speed - f.sp) * Math.min(1, dt * 2.5);
        const nx = f.x + Math.sin(f.h) * f.sp * dt, nz = f.z + Math.cos(f.h) * f.sp * dt; if (water(nx, nz, .15)) { f.x = nx; f.z = nz; } else if (water(nx, f.z, .15)) f.x = nx; else if (water(f.x, nz, .15)) f.z = nz; else f.h += 2.5 * dt;
        if (f.vy > 0 || f.y > Y1 + .01) { f.vy -= 9.8 * dt; f.y += f.vy * dt; if (f.y < Y1 - .01) { f.y = Y1 - .01; f.vy = 0; splash(f.x, f.z, .6); } }
        e.set(f.vy > 0 ? -.6 : 0, f.h, Math.sin(t * 2 + i) * .05, 'YXZ'); q.setFromEuler(e);
        mesh.setMatrixAt(i, m4.compose(v.set(f.x, Math.min(f.y, Y1 + .4), f.z), q, sc.setScalar(f.s)));
      }
      mesh.instanceMatrix.needsUpdate = true;
      // 우럭: 뛰어들어 물속으로 깊이 사라짐
      for (let i = 0; i < UM; i++) {
        const u = U[i]; if (!u.on) { uMesh.setMatrixAt(i, hide); continue; }
        if (u.delay > 0) { u.delay -= dt; uMesh.setMatrixAt(i, hide); continue; }
        if (u.air > 0) { u.air -= dt; u.vy -= 9.8 * dt; u.x += u.vx * dt; u.y += u.vy * dt; u.z += u.vz * dt; if (u.y <= Y1 && u.vy < 0) { u.air = 0; u.y = Y1 - .02; splash(u.x, u.z, 1.6); } }
        else { u.out += dt; u.x += Math.sin(u.h) * .9 * dt; u.z += Math.cos(u.h) * .9 * dt; u.y = Y1 - .02 - u.out * .05; if (u.out > 3.2) u.on = false; }
        e.set(u.air > 0 ? -Math.atan2(u.vy, Math.hypot(u.vx, u.vz)) * .8 : .25, u.h, 0, 'YXZ'); q.setFromEuler(e);
        const fade = u.air > 0 ? 1 : Math.max(0, 1 - u.out / 3.2);
        uMesh.setMatrixAt(i, m4.compose(v.set(u.x, u.y, u.z), q, sc.setScalar(u.s * (.4 + .6 * fade))));
      }
      uMesh.instanceMatrix.needsUpdate = true;
      for (const r of rings) { if (r.t > 1.2) { r.m.visible = false; continue; } r.t += dt; const s = 1 + r.t * 5 * (r.big || 1); r.m.scale.set(s, s, 1); r.m.material.opacity = Math.max(0, .75 * (1 - r.t / 1.2)); }
    },
  };
  api.frenzy = 0;
  return api;
}

// 방생 수조 안의 작은 물고기들 (판매대 장식)
export function tankFish(group, w, d, y, n = 8, kind = 'hwangeo') {
  const g = fishGeo(kind), m = swimMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .4, metalness: kind === 'ureok' ? .1 : .3, side: THREE.DoubleSide }));
  const im = new THREE.InstancedMesh(g, m, n); im.frustumCulled = false; group.add(im);
  const S = Array.from({ length: n }, (_, i) => ({ a: Math.random() * 6.3, r: .1 + Math.random() * .2, sp: (.5 + Math.random() * .6) * (i % 2 ? 1 : -1), y: y + Math.random() * .2 }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), k0 = kind === 'ureok' ? .3 : .22, sc = new THREE.Vector3(k0, k0, k0), up = new THREE.Vector3(0, 1, 0);
  const fn = dt => { S.forEach((s, i) => { s.a += s.sp * dt; q.setFromAxisAngle(up, -s.a + (s.sp > 0 ? 0 : Math.PI)); im.setMatrixAt(i, m4.compose(v.set(Math.cos(s.a) * s.r * w * 2, s.y, Math.sin(s.a) * s.r * d * 2), q, sc)); }); im.instanceMatrix.needsUpdate = true; };
  fn.use = (k, src) => { if (k !== kind || !src) return; im.geometry = src.geometry; im.material = src.material; };
  return fn;
}
