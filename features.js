// 산사 체험 도구: 소리(목탁·염주·범종·환경음, 모두 웹오디오로 합성), 목탁·염주 화면, 오늘 할 일, 기록 저장
// 녹음 파일을 쓰지 않고 소리를 직접 만들어서 저작권 걱정이 없고 가볍게 동작함

/* ───────── 저장 (이 기기에만) ───────── */
const KEY = 'templeMeta.v1';
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
export function createStore() {
  let d = {}; try { d = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { }
  if (d.day !== today()) { d.day = today(); d.todo = {}; d.counts = {}; }
  d.todo = d.todo || {}; d.counts = d.counts || {}; d.wishes = d.wishes || {}; d.tiles = d.tiles || {}; d.tlan = d.tlan || {}; d.vol = d.vol || { amb: .35, sfx: .7, ambOn: false };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { } };
  return {
    d, save,
    count(k, n = 1) { d.counts[k] = (d.counts[k] || 0) + n; save(); return d.counts[k]; },
    get(k) { return d.counts[k] || 0; },
    wishes(rid) { return d.wishes[rid] || (d.wishes[rid] = []); },
    tiles(rid) { return d.tiles[rid] || (d.tiles[rid] = []); },       // 기와 불사 (권역별)
    tlan(name) { return d.tlan[name] || (d.tlan[name] = []); },       // 절 마당 연등 (사찰별)
  };
}

/* ───────── 오늘 할 일 ───────── */
export const TODO = [
  ['hap', '🙏 합장 인사하기'],
  ['enter', '🛕 법당에 들어가기'],
  ['sambae', '🙇 부처님께 삼배 올리기'],
  ['incense', '🪔 향 한 자루 올리기'],
  ['sit', '🧘 방석에 앉아 30초 쉬기'],
  ['moktak', '🪵 목탁 21번 치기'],
  ['beads', '📿 염주 한 바퀴(108알) 돌리기'],
  ['bell', '🔔 범종 치기'],
  ['tap', '🪷 탑돌이 세 바퀴'],
  ['wish', '🏮 소원 연등 걸기'],
  ['giwa', '✍️ 기와에 소원 적어 올리기'],
  ['unryeok', '🧹 운력: 싸리비로 마당 쓸기·걸레로 마루 닦기'],
  ['visit', '🗺 다른 사찰 한 곳 더 가 보기'],
];
export function initTodo(store, toast, sound) {
  const btn = document.getElementById('btnTodo'), panel = document.getElementById('todoPanel');
  const render = () => {
    const done = TODO.filter(([k]) => store.d.todo[k]).length;
    btn.textContent = `📋 ${done}/${TODO.length}`;
    panel.innerHTML = `<b>오늘 산사에서 할 일</b><small>${done === TODO.length ? '오늘 할 일을 모두 마쳤어요 🙏' : '하나씩 해 보면 자동으로 체크돼요'}</small>` +
      TODO.map(([k, t]) => `<div class="${store.d.todo[k] ? 'on' : ''}"><i>${store.d.todo[k] ? '✓' : ''}</i>${t}</div>`).join('');
  };
  btn.onclick = () => { panel.classList.toggle('show'); render(); };
  render();
  return (k) => {
    if (store.d.todo[k]) return; store.d.todo[k] = true; store.save(); render();
    const t = TODO.find(x => x[0] === k); if (t) { toast(`✓ 오늘 할 일: ${t[1]}`, 2600); sound.chime(); }
  };
}

/* ───────── 소리 ───────── */
export function createSound(store) {
  let ctx = null, sfx, amb, ambNodes = null, birdT = null;
  const V = store.d.vol;
  const unlock = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      sfx = ctx.createGain(); sfx.gain.value = V.sfx; sfx.connect(ctx.destination);
      amb = ctx.createGain(); amb.gain.value = V.ambOn ? V.amb : 0; amb.connect(ctx.destination);
      if (V.ambOn) startAmb();
    } catch (e) { ctx = null; }
    return ctx;
  };
  const noiseBuf = (sec) => { const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate), a = b.getChannelData(0); let last = 0; for (let i = 0; i < a.length; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; a[i] = last * 3.5 + (Math.random() * 2 - 1) * .15; } return b; };
  const env = (g, t, peak, a, d) => { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); };
  const tone = (f, peak, a, d, type = 'sine', f2) => { const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d * .5); env(g, t, peak, a, d); o.connect(g).connect(sfx); o.start(t); o.stop(t + a + d + .05); };
  const burst = (freq, q, peak, d) => { const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf(d + .05); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; env(g, t, peak, .002, d); s.connect(f).connect(g).connect(sfx); s.start(t); };
  function startAmb() {
    if (!ctx || ambNodes) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf(6); s.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    const g = ctx.createGain(); g.gain.value = .5;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .07; lg.gain.value = .3; lfo.connect(lg).connect(g.gain); lfo.start();
    s.connect(lp).connect(g).connect(amb); s.start(); ambNodes = { s, lfo };
    const bird = () => { // 새소리: 짧게 올라가는 휘파람 두세 번
      if (!ambNodes) return; const t0 = ctx.currentTime, n = 2 + (Math.random() * 3 | 0), base = 2600 + Math.random() * 1400;
      for (let i = 0; i < n; i++) { const t = t0 + i * .13, o = ctx.createOscillator(), gg = ctx.createGain(); o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 1.35, t + .07); env(gg, t, .05, .01, .09); o.connect(gg).connect(amb); o.start(t); o.stop(t + .12); }
      birdT = setTimeout(bird, 2500 + Math.random() * 6000);
    };
    birdT = setTimeout(bird, 1500);
  }
  function stopAmb() { if (!ambNodes) return; try { ambNodes.s.stop(); ambNodes.lfo.stop(); } catch (e) { } ambNodes = null; clearTimeout(birdT); }
  return {
    unlock, V,
    setVol(k, v) { V[k] = v; store.save(); if (!ctx) return; if (k === 'sfx') sfx.gain.value = v; if (k === 'amb') amb.gain.value = V.ambOn ? v : 0; },
    setAmb(on) { V.ambOn = on; store.save(); if (!unlock()) return; amb.gain.value = on ? V.amb : 0; on ? startAmb() : stopAmb(); },
    moktak() { if (!unlock()) return; tone(640, .9, .002, .16, 'sine', 430); tone(1290, .18, .002, .05, 'triangle'); burst(1900, 1.4, .5, .045); },
    bead() { if (!unlock()) return; burst(3200, 5, .25, .03); tone(2300, .06, .001, .05); },
    bump() { if (!unlock()) return; tone(230, .32, .003, .11, 'sine', 150); burst(520, .7, .1, .05); }, // 아기 스님끼리 퉁
    sweep() { if (!unlock()) return; burst(1900 + Math.random() * 500, .8, .07, .26); }, // 싸리비 쓱
    wipe() { if (!unlock()) return; burst(700, .6, .05, .2); },
    chime() { if (!unlock()) return; [[1046, .14], [1568, .09], [2093, .05]].forEach(([f, p], i) => setTimeout(() => tone(f, p, .005, 1.4), i * 90)); },
    bell(vol = .3) { if (!unlock()) return; [[196, 1], [392, .45], [588, .18], [784, .08]].forEach(([f, a]) => tone(f, vol * a, .015, 3.2)); },
    // 범종: 낮은 울림 + 살짝 어긋난 두 음이 만드는 맥놀이(웅~웅~)
    bigBell(vol = 1) {
      if (!unlock()) return; const t = ctx.currentTime;
      [[64, .55, 9], [64.6, .45, 9], [128.5, .3, 7], [176, .22, 5.5], [272, .12, 3.5], [410, .06, 2.2]].map(([f, p, d]) => [f, p * vol, d * (.75 + .75 * Math.min(1, vol))]).forEach( /* 세게 칠수록 길게 (맥놀이: 64·64.6Hz 맴돌이) */([f, p, d]) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; env(g, t, p, .02, d); o.connect(g).connect(sfx); o.start(t); o.stop(t + d + .1); });
      const s = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf(.4); lp.type = 'lowpass'; lp.frequency.value = 220; env(g, t, .7 * vol, .004, .3); s.connect(lp).connect(g).connect(sfx); s.start(t);
    },
  };
}

/* ───────── 목탁 · 염주 화면 ───────── */
export function initRituals({ sound, store, toast, done, onUse }) {
  const ov = document.getElementById('ritual'), stage = document.getElementById('ritualStage'), info = document.getElementById('ritualInfo'), ctrl = document.getElementById('ritualCtrl');
  let mode = null, autoT = null, beadsCv = null, beadOff = 0, beadAnim = 0, raf = 0;
  const close = () => { mode = null; clearInterval(autoT); autoT = null; cancelAnimationFrame(raf); ov.classList.remove('show'); stage.innerHTML = ''; ctrl.innerHTML = ''; };
  ov.addEventListener('pointerdown', e => { if (e.target === ov) close(); });
  document.getElementById('ritualClose').onclick = close;

  // 목탁: 두드리면 소리 + 살짝 눌리는 모양, 자동재생은 염불 박자(0.62초)
  function openMoktak() {
    close(); mode = 'moktak'; ov.classList.add('show'); onUse && onUse('moktak');
    stage.innerHTML = `<div id="mok" role="button" aria-label="목탁 두드리기"><i class="mkShadow"></i><img id="mkbody" src="./assets/moktak-body.webp" alt="" draggable="false" style="left:17.49%;top:10.83%;width:58.42%"><img id="mallet" src="./assets/moktak-mallet.webp" alt="" draggable="false" style="left:49.22%;top:56.12%;width:41.06%"><b id="ttok">똑!</b></div>`; // 실제 목탁 (Gemini로 만든 그림에서 배경을 지움) · 채는 따로 움직임
    const svg = document.getElementById('mok');
    const hit = () => { sound.moktak(); const n = store.count('moktak'); info.innerHTML = `<b>${n}</b><span>오늘 두드린 목탁</span>`; svg.classList.remove('hit'); void svg.offsetWidth; svg.classList.add('hit'); if (n >= 21) done('moktak'); };
    svg.addEventListener('pointerdown', e => { e.preventDefault(); hit(); });
    info.innerHTML = `<b>${store.get('moktak')}</b><span>목탁을 눌러 두드려 보세요</span>`;
    ctrl.innerHTML = `<button id="mokAuto">▶ 자동재생</button>`;
    document.getElementById('mokAuto').onclick = e => { if (autoT) { clearInterval(autoT); autoT = null; e.target.textContent = '▶ 자동재생'; } else { hit(); autoT = setInterval(hit, 620); e.target.textContent = '⏸ 멈추기'; } };
    ritualKey = hit;
  }

  // 염주: 끌어내리거나 누르면 한 알씩 넘어감, 108알이면 한 바퀴
  function openBeads() {
    close(); mode = 'beads'; ov.classList.add('show'); onUse && onUse('beads');
    stage.innerHTML = '<canvas id="beads" width="300" height="440" aria-label="염주 돌리기"></canvas>';
    beadsCv = document.getElementById('beads'); const c = beadsCv.getContext('2d');
    const N = 27, rx = 82, ry = 178, cx = 150, cy = 222;
    const draw = () => {
      beadOff += (Math.floor(beadOff) + (beadAnim > 0 ? 1 : 0) - beadOff) * 0; // 자리 유지
      if (beadAnim > 0) { beadAnim = Math.max(0, beadAnim - .12); }
      const off = store.get('beadsAll') + (1 - beadAnim) - 1;
      c.clearRect(0, 0, 300, 440);
      c.strokeStyle = 'rgba(120,70,30,.35)'; c.lineWidth = 2; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, 7); c.stroke();
      const items = [];
      for (let i = 0; i < N; i++) { const a = (i + off) / N * Math.PI * 2 - Math.PI / 2, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry, z = Math.cos(a); items.push({ x, y, z }); }
      items.sort((p, q) => p.z - q.z);
      for (const { x, y, z } of items) {
        const r = 15 + z * 4, g = c.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
        g.addColorStop(0, '#ffd9ae'); g.addColorStop(.45, '#d98a45'); g.addColorStop(1, '#8c4a1e');
        c.fillStyle = g; c.globalAlpha = .75 + z * .25; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
      }
      c.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    const step = () => {
      const all = store.count('beadsAll'), cur = all % 108 || (all ? 108 : 0), round = Math.ceil(all / 108) || 1;
      sound.bead(); beadAnim = 1;
      info.innerHTML = `<b>${cur}</b><span>/ 108 · ${round}번째 바퀴</span>`;
      if (all % 108 === 0) { sound.chime(); toast(`📿 염주 한 바퀴(108알)를 다 돌렸어요`); done('beads'); }
    };
    let dragY = null;
    beadsCv.addEventListener('pointerdown', e => { dragY = e.clientY; beadsCv.setPointerCapture(e.pointerId); });
    beadsCv.addEventListener('pointermove', e => { if (dragY === null) return; if (e.clientY - dragY > 26) { dragY = e.clientY; step(); } });
    beadsCv.addEventListener('pointerup', e => { if (dragY !== null && Math.abs(e.clientY - dragY) < 6) step(); dragY = null; });
    const all = store.get('beadsAll');
    info.innerHTML = `<b>${all % 108}</b><span>/ 108 · 아래로 쓸어 넘기거나 눌러요</span>`;
    ctrl.innerHTML = '';
    ritualKey = step; draw();
  }
  let ritualKey = null;
  addEventListener('keydown', e => { if (!mode) return; if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); ritualKey && ritualKey(); } if (e.code === 'Escape') close(); }, true);
  return { openMoktak, openBeads, close, get open() { return !!mode; } };
}

/* ───────── 소리 설정 ───────── */
export function initSoundPanel(sound) {
  const btn = document.getElementById('btnSound'), panel = document.getElementById('soundPanel'), V = sound.V;
  const label = () => { btn.textContent = V.ambOn ? '🔊' : '🔈'; };
  panel.innerHTML = `<b>소리</b>
    <label><span>바람·새소리</span><input type="checkbox" id="sAmbOn" ${V.ambOn ? 'checked' : ''}></label>
    <label><span>환경음 크기</span><input type="range" id="sAmb" min="0" max="1" step=".05" value="${V.amb}"></label>
    <label><span>목탁·염주·종 소리</span><input type="range" id="sSfx" min="0" max="1" step=".05" value="${V.sfx}"></label>
    <small>소리는 모두 이 기기에서 직접 만들어 내요 · 염불 음원은 준비 중</small>`;
  btn.onclick = () => { sound.unlock(); panel.classList.toggle('show'); };
  document.getElementById('sAmbOn').onchange = e => { sound.setAmb(e.target.checked); label(); };
  document.getElementById('sAmb').oninput = e => sound.setVol('amb', +e.target.value);
  document.getElementById('sSfx').oninput = e => sound.setVol('sfx', +e.target.value);
  label();
}
