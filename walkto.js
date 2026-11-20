// 누른 곳으로 걸어가기: 누른 자리에 동그라미·화살표를 띄우고, 물체·벽은 돌아가는 길(점선)을 찾아 그 길로 걸어감
// - 0.5m 칸 길찾기(A*): 탑·석등·전각·나무를 돌아가고, 계단은 두 칸 높이(STEP)까지 오름
// - 못 들어가는 곳(법당 지붕·벽 안·물)을 누르면 그 둘레 가까운 자리로 바꿔 줌
import * as THREE from 'three';

export function createWalkTo({ scene, blockedAt, groundAt, obstacles, bound }) {
  /* ── 표시: 금빛 동그라미 + 퍼지는 물결 + 통통 뛰는 화살표 + 길 점선 ── */
  const gold = '#ffd45a';
  const mk = (geo, color, op) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false })); m.renderOrder = 5; return m; };
  const mark = new THREE.Group(); mark.visible = false; scene.add(mark);
  const disc = mk(new THREE.CircleGeometry(.5, 36), gold, .22); disc.rotation.x = -Math.PI / 2; mark.add(disc);
  const ring = mk(new THREE.RingGeometry(.44, .58, 40), gold, .95); ring.rotation.x = -Math.PI / 2; mark.add(ring);
  const edge = mk(new THREE.RingGeometry(.58, .63, 40), '#fff6d8', .9); edge.rotation.x = -Math.PI / 2; mark.add(edge);
  const wave = mk(new THREE.RingGeometry(.52, .6, 40), gold, .6); wave.rotation.x = -Math.PI / 2; mark.add(wave);
  const arrowG = new THREE.ConeGeometry(.17, .38, 4); arrowG.rotateX(Math.PI); // 아래를 가리킴
  const arrow = mk(arrowG, gold, .95); arrow.position.y = 1.15; mark.add(arrow);
  const MAXD = 160, dotGeo = new THREE.CircleGeometry(.11, 14); dotGeo.rotateX(-Math.PI / 2);
  const dots = new THREE.InstancedMesh(dotGeo, new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: .85, depthWrite: false }), MAXD);
  dots.renderOrder = 5; dots.count = 0; dots.frustumCulled = false; scene.add(dots);
  const M4 = new THREE.Matrix4(), DOT = []; // [x, y, z, 경로상 거리]
  let T = 0, fade = 0, path = null, hops = 0;

  function show(pts) { // pts: [[x, y, z], ...] (마지막 = 도착점)
    const g = pts[pts.length - 1]; mark.position.set(g[0], g[1] + .04, g[2]); mark.visible = true; mark.scale.setScalar(1); T = 0; fade = 0;
    for (const m of [disc, ring, edge, arrow]) m.material.opacity = m === disc ? .22 : .95;
    DOT.length = 0; let acc = 0, next = .55;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[2] - a[2]);
      while (next <= acc + L && DOT.length < MAXD) { const u = (next - acc) / L; DOT.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + .05, a[2] + (b[2] - a[2]) * u, next]); next += .62; }
      acc += L;
    }
    while (DOT.length && acc - DOT[DOT.length - 1][3] < .7) DOT.pop(); // 동그라미 안쪽 점은 빼기
    for (let i = 0; i < DOT.length; i++) { M4.makeTranslation(DOT[i][0], DOT[i][1], DOT[i][2]); dots.setMatrixAt(i, M4); }
    dots.count = DOT.length; dots.instanceMatrix.needsUpdate = true;
  }
  function clear(arrived) { if (arrived && mark.visible) fade = .45; else { mark.visible = false; } dots.count = 0; }

  // 매 프레임: 물결·화살표 움직임, 지나간 점 지우기
  function update(dt, px, pz) {
    if (!mark.visible) return;
    T += dt;
    if (fade > 0) { fade -= dt; const k = Math.max(0, fade / .45); mark.scale.setScalar(1 + (1 - k) * .6); for (const m of [disc, ring, edge, wave, arrow]) m.material.opacity = (m === disc ? .22 : .9) * k; if (fade <= 0) { mark.visible = false; for (const m of [disc, ring, edge, arrow]) m.material.opacity = m === disc ? .22 : .95; } return; }
    const w = (T % 1.2) / 1.2; wave.scale.setScalar(1 + w * 1.1); wave.material.opacity = .65 * (1 - w);
    ring.material.opacity = .78 + .2 * Math.sin(T * 6);
    arrow.position.y = 1.05 + Math.abs(Math.sin(T * 3.2)) * .32; arrow.rotation.y += dt * 1.6;
    if (dots.count) { // 아기 스님이 지나간 점은 없앰
      let cut = 0; for (let i = 0; i < Math.min(dots.count, 12); i++) if (Math.hypot(DOT[i][0] - px, DOT[i][2] - pz) < .55) cut = i + 1;
      if (cut) { DOT.splice(0, cut); for (let i = 0; i < DOT.length; i++) { M4.makeTranslation(DOT[i][0], DOT[i][1], DOT[i][2]); dots.setMatrixAt(i, M4); } dots.count = DOT.length; dots.instanceMatrix.needsUpdate = true; }
    }
  }

  /* ── 길찾기 ── */
  const C = .5, BODY = .36;
  // sx,sz,sh: 지금 자리·발 높이, gx,gz,gh: 누른 곳 · 반환 { pts: [[x,y,z]...], near: 누른 곳 대신 가까운 곳으로 바꿨는지, fail }
  function find(sx, sz, sh, gx, gz, gh) {
    const t0 = performance.now(), PAD = 12;
    let x0 = Math.min(sx, gx) - PAD, z0 = Math.min(sz, gz) - PAD;
    let W = Math.ceil((Math.abs(gx - sx) + PAD * 2) / C) + 1, H = Math.ceil((Math.abs(gz - sz) + PAD * 2) / C) + 1;
    if (W > 260 || H > 260) return { fail: 'far' };
    const N = W * H, RB = bound();
    // 1) 회전 사각형 장애물(H.col)을 칸에 칠함 (몸 반지름만큼 넓혀서)
    const obs = new Uint8Array(N);
    for (const ob of obstacles) {
      const ex = Math.abs(ob.c) * ob.hu + Math.abs(ob.s) * ob.hv + BODY, ez = Math.abs(ob.s) * ob.hu + Math.abs(ob.c) * ob.hv + BODY;
      if (ob.cx + ex < x0 || ob.cx - ex > x0 + W * C || ob.cz + ez < z0 || ob.cz - ez > z0 + H * C) continue;
      const i0 = Math.max(0, Math.floor((ob.cx - ex - x0) / C)), i1 = Math.min(W - 1, Math.ceil((ob.cx + ex - x0) / C)), j0 = Math.max(0, Math.floor((ob.cz - ez - z0) / C)), j1 = Math.min(H - 1, Math.ceil((ob.cz + ez - z0) / C));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const dx = x0 + i * C - ob.cx, dz = z0 + j * C - ob.cz, du = dx * ob.c + dz * ob.s, dv = -dx * ob.s + dz * ob.c;
        if (Math.abs(du) < ob.hu + BODY && Math.abs(dv) < ob.hv + BODY) obs[j * W + i] = 1;
      }
    }
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = x0 + i * C, z = z0 + j * C; if (Math.hypot(x, z) > RB) obs[j * W + i] = 1; }
    const cx = i => x0 + i * C, cz = j => z0 + j * C;
    const free = (k, x, z, fromH) => !obs[k] && !blockedAt(x, z, fromH);
    // 2) 출발·도착 칸 (도착 칸에 못 서면 가까운 빈 칸으로)
    const si = Math.round((sx - x0) / C), sj = Math.round((sz - z0) / C), S = sj * W + si;
    let gi = Math.round((gx - x0) / C), gj = Math.round((gz - z0) / C), near = false;
    const okAt = (i, j) => { if (i < 0 || j < 0 || i >= W || j >= H) return false; const x = cx(i), z = cz(j), h = groundAt(x, z, gh + .3); return !obs[j * W + i] && !blockedAt(x, z, h); };
    if (!okAt(gi, gj)) {
      let best = null, bd = 1e9;
      for (let r = 1; r <= 12 && !best; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const i = gi + di, j = gj + dj; if (!okAt(i, j)) continue;
        const d = Math.hypot(di, dj) + .35 * Math.hypot(cx(i) - sx, cz(j) - sz) / C / 20; if (d < bd) { bd = d; best = [i, j]; } }
      if (!best) return { fail: 'blocked' }; [gi, gj] = best; near = true;
    }
    const G = gj * W + gi;
    // 3) A* (8방향, 모서리 자르기 금지, 칸마다 발 높이를 이어 받음 → 계단은 STEP 높이까지 오름)
    const g = new Float32Array(N).fill(Infinity), hh = new Float32Array(N), par = new Int32Array(N).fill(-1), st = new Uint8Array(N);
    const heap = [], hv = (i, j) => { const dx = Math.abs(i - gi), dz = Math.abs(j - gj); return (Math.max(dx, dz) + .4142 * Math.min(dx, dz)); };
    const push = (f, k) => { heap.push([f, k]); let n = heap.length - 1; while (n) { const p = (n - 1) >> 1; if (heap[p][0] <= heap[n][0]) break; [heap[p], heap[n]] = [heap[n], heap[p]]; n = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let n = 0; for (;;) { const l = n * 2 + 1, r = l + 1; let m = n; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === n) break; [heap[m], heap[n]] = [heap[n], heap[m]]; n = m; } } return top; };
    g[S] = 0; hh[S] = sh; push(hv(si, sj), S);
    let bestK = S, bestH = hv(si, sj), n = 0;
    const D8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
    while (heap.length && n < 45000) {
      const [, k] = pop(); if (st[k] === 2) continue; st[k] = 2; n++;
      const i = k % W, j = (k - i) / W; const h0 = hh[k], hk = hv(i, j); if (hk < bestH) { bestH = hk; bestK = k; }
      if (k === G) break;
      for (const [di, dj, c] of D8) {
        const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; const nk = nj * W + ni; if (st[nk] === 2) continue;
        const x = cx(ni), z = cz(nj); if (!free(nk, x, z, h0)) continue;
        if (di && dj && (!free(j * W + ni, cx(ni), z0 + j * C, h0) || !free(nj * W + i, x0 + i * C, z, h0))) continue;
        const nh = groundAt(x, z, h0), cost = g[k] + c + (nh > h0 + .05 ? .3 : 0);
        if (cost < g[nk]) { g[nk] = cost; hh[nk] = nh; par[nk] = k; push(cost + hv(ni, nj), nk); }
      }
    }
    let end = st[G] === 2 ? G : bestK; if (end !== G) near = true;
    if (end === S) return { fail: 'blocked', ms: performance.now() - t0 };
    const cells = []; for (let k = end; k !== -1; k = par[k]) cells.push(k); cells.reverse();
    // 4) 줄이기: 곧게 갈 수 있는 칸은 건너뜀 (0.25m마다 확인)
    const P = cells.map(k => { const i = k % W, j = (k - i) / W; return [cx(i), hh[k], cz(j)]; });
    P[0] = [sx, sh, sz];
    const clearLine = (a, b) => { const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n2 = Math.ceil(L / .25), hl = Math.min(a[1], b[1]);
      if (Math.abs(a[1] - b[1]) > .05) return false; // 높이가 바뀌는 곳(계단)은 칸 길 그대로
      for (let q = 1; q < n2; q++) { const u = q / n2, x = a[0] + (b[0] - a[0]) * u, z = a[2] + (b[2] - a[2]) * u, ii = Math.round((x - x0) / C), jj = Math.round((z - z0) / C); if (obs[jj * W + ii] || blockedAt(x, z, hl)) return false; } return true; };
    const out = [P[0]]; let a = 0;
    while (a < P.length - 1) { let b = P.length - 1; while (b > a + 1 && !clearLine(P[a], P[b])) b--; out.push(P[b]); a = b; }
    return { pts: out, near, ms: performance.now() - t0, n };
  }
  return { mark, show, clear, update, find };
}
