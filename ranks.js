// 순위 (수월): 절 횟수 · 방석에 앉아 있던 시간(좌선) · 화면을 켜고 머문 시간
// - 기기마다 무작위 기록 번호와 비밀 열쇠를 이 기기에만 보관 (함께 순례할 때 남에게 보이는 번호와 다름)
// - 쌓인 만큼 1분마다 서버에 보냄 · 서버는 실제로 흐른 시간보다 많이 받지 않음 (켜 둔 만큼만 쌓임)
// - 인증된 스님 기기면 서명을 붙여 보내서 순위에 🪷 금빛으로 표시
const FN = 'https://tozyoprymcvznkeqmrqp.supabase.co/functions/v1/temple-admin';
const KEY = 'sb_publishable_7FGPTjvPHWj-oF_EiiSjcg_MI63-mqE';

const uuid = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
function ident() {
  if (/[?&]guest/.test(location.search)) return { sid: uuid(), skey: uuid() + uuid() }; // 점검용: 창마다 다른 사람
  let sid = '', skey = '';
  try { sid = localStorage.getItem('suwol.sid') || ''; skey = localStorage.getItem('suwol.skey') || ''; } catch (e) { }
  if (!/^[0-9a-f-]{36}$/.test(sid) || skey.length < 20) {
    sid = uuid(); skey = uuid() + uuid();
    try { localStorage.setItem('suwol.sid', sid); localStorage.setItem('suwol.skey', skey); } catch (e) { }
  }
  return { sid, skey };
}
const ID = ident();

async function call(action, body = {}, keepalive = false) {
  const r = await fetch(FN, { method: 'POST', keepalive, headers: { 'Content-Type': 'application/json', apikey: KEY }, body: JSON.stringify({ action, ...body }) });
  const j = await r.json().catch(() => ({ error: 'http_' + r.status }));
  if (j.error) throw new Error(j.error);
  return j;
}

/* ── 기록 모으기 ── */
const acc = { bows: 0, sit: 0, stay: 0 }; // 아직 보내지 않은 기록 (시간은 초)
let opts = null, sending = false, lastTick = 0, lastErr = '';
export const addBow = (n = 1) => { acc.bows += n; };
function tick() {
  const now = performance.now(), d = Math.min((now - lastTick) / 1000, 5); lastTick = now;
  if (document.visibilityState !== 'visible') return; // 화면을 켜 둔 동안만
  acc.stay += d;
  if (opts.isSitting()) acc.sit += d;
}
export async function flushStats(keepalive = false) {
  if (sending || !opts) return null;
  const add = { bows: acc.bows, sit: Math.floor(acc.sit), stay: Math.floor(acc.stay) };
  if (!add.bows && add.stay < 5) return null;
  sending = true;
  try {
    const monk = opts.monkSig ? await opts.monkSig('stat:' + ID.sid).catch(() => null) : null;
    const j = await call('stat', { id: ID.sid, key: ID.skey, nick: opts.getNick(), add, ...(monk ? { monk } : {}) }, keepalive);
    if (!j.skipped) { acc.bows -= add.bows; acc.sit -= add.sit; acc.stay -= add.stay; } // 서버가 잘라 낸 나머지는 버림
    lastErr = '';
    if (panel && panel.classList.contains('show')) load();
    return j;
  } catch (e) { lastErr = String(e.message || e); return null; } finally { sending = false; }
}
export const statsDebug = () => ({ ...acc, sid: ID.sid, err: lastErr });
export function initStats(o) {
  opts = o; lastTick = performance.now();
  setInterval(tick, 1000);
  setInterval(() => flushStats(), 60e3);
  document.addEventListener('visibilitychange', () => { tick(); if (document.visibilityState === 'hidden') flushStats(true); });
}

/* ── 🏆 순위 화면 ── */
let panel = null, per = 'today', met = 'bows', data = null, timer = 0, busy = false;
const MET = [['bows', '🙇 절'], ['sit', '🧘 좌선'], ['stay', '🕰 머문 시간']];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dur = s => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h}시간 ${m}분` : m ? `${m}분` : `${s}초`; };
const val = (k, v) => k === 'bows' ? `${Number(v).toLocaleString()}번` : dur(v);
const medal = i => ['🥇', '🥈', '🥉'][i] || String(i + 1);
function render() {
  if (!panel) return;
  const list = data && data[per] && data[per][met] || [];
  const mine = data && data.me && data.me[per] && data.me[per][met];
  const rows = list.map((r, i) => `<li class="${r.monk ? 'monk' : ''} ${r.me ? 'me' : ''}"><em>${medal(i)}</em><span>${r.monk ? '🪷 ' + esc(r.monk) : esc(r.nick)}</span><b>${val(met, r.v)}</b></li>`).join('');
  const meLine = !data ? '' : mine && mine.rank ? `나 · <b>${mine.rank}위</b> · ${val(met, mine.v)}` : '아직 기록이 없어요 · 1분쯤 지나면 들어가요';
  panel.innerHTML = `<b>🏆 순위</b><small>${per === 'today' ? '오늘(밤 12시에 새로 시작)' : '처음부터 모은 기록'} · 1분마다 모여요</small>
    <div class="rkTabs">${[['today', '오늘'], ['all', '전체']].map(([k, t]) => `<button data-per="${k}" class="${per === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="rkTabs">${MET.map(([k, t]) => `<button data-met="${k}" class="${met === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    ${!data ? `<div class="rkEmpty">${busy ? '순위를 불러오는 중…' : '순위를 불러오지 못했어요 · 잠시 뒤에 다시 열어 주세요'}</div>` : rows ? `<ol>${rows}</ol>` : `<div class="rkEmpty">${per === 'today' ? '오늘은 아직 기록이 없어요 · 첫 번째가 되어 보세요 🙏' : '아직 기록이 없어요'}</div>`}
    ${meLine ? `<div class="rkMe">${meLine}</div>` : ''}
    <small class="rkNote">절은 한 번 절할 때마다(삼배는 3번), 좌선은 방석에 앉아 있는 동안, 머문 시간은 화면을 켜 둔 동안 쌓여요 · 순위에는 이름(법명)만 보여요</small>`;
}
async function load() {
  busy = true; if (!data) render();
  try { data = await call('ranks', { id: ID.sid, key: ID.skey }); } catch (e) { lastErr = String(e.message || e); }
  busy = false; render();
}
export function initRanks() {
  const btn = document.getElementById('btnRank'); panel = document.getElementById('rankPanel');
  if (!btn || !panel) return;
  btn.onclick = () => {
    document.querySelectorAll('.panel.show').forEach(p => { if (p !== panel) p.classList.remove('show'); });
    panel.classList.toggle('show');
    clearInterval(timer);
    if (panel.classList.contains('show')) { load(); flushStats(); timer = setInterval(() => { if (panel.classList.contains('show')) load(); else clearInterval(timer); }, 30e3); }
  };
  document.getElementById('topBtns').addEventListener('click', e => { if (!e.target.closest('#btnRank')) panel.classList.remove('show'); });
  panel.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.per) per = b.dataset.per; if (b.dataset.met) met = b.dataset.met; render();
  });
}
