// 스님 인증 (위레브): 관리자가 드린 초대 코드로 이 기기를 "○○사 ○○ 스님"으로 등록
// - 코드를 넣는 순간 이 기기 안에서 서명 열쇠를 만들고, 공개키만 서버에 올림 (비밀 열쇠는 기기 밖으로 못 나감)
// - 접속 중에는 서명을 붙여 알리고, 다른 사람 화면은 서버 명단의 공개키로 서명이 맞을 때만 스님으로 보여 줌
//   → 이름에 '스님'을 적거나 남의 표식을 베껴도 스님으로 보이지 않음
const FN = 'https://tozyoprymcvznkeqmrqp.supabase.co/functions/v1/temple-admin';
const KEY = 'sb_publishable_7FGPTjvPHWj-oF_EiiSjcg_MI63-mqE';
const ERR = {
  bad_code: '코드 8자리(예: ABCD-EFGH)를 확인해 주세요',
  no_code: '없는 코드이거나 기간(14일)이 지났어요. 관리자에게 새 코드를 받아 주세요',
  bad_key: '이 브라우저에서는 인증을 할 수 없어요. 크롬·사파리 최신판에서 해 주세요',
  revoked: '스님 인증이 해제되었어요',
};
export const monkError = e => { const m = String(e && (e.message || e)); for (const k in ERR) if (m.includes(k)) return ERR[k]; return '잠시 뒤에 다시 해 주세요'; };

async function call(action, body = {}) {
  const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY }, body: JSON.stringify({ action, ...body }) });
  const j = await r.json().catch(() => ({ error: 'http_' + r.status }));
  if (j.error) throw new Error(j.error);
  return j;
}
const enc = s => new TextEncoder().encode(s);
const b64 = buf => { let s = ''; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s); };
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const ALG = { name: 'ECDSA', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', hash: 'SHA-256' };

// 비밀 열쇠는 꺼낼 수 없는 형태로 이 기기 IndexedDB에만 보관
function db() { return new Promise((res, rej) => { const r = indexedDB.open('jeollo-monk', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function tx(mode, fn) { const d = await db(); return new Promise((res, rej) => { const q = fn(d.transaction('k', mode).objectStore('k')); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }

let ME = null; // { id, region, temple, name, key }
const info = m => ({ id: m.id, region: m.region, temple: m.temple, name: m.name });
export const myMonk = () => ME && info(ME);
export async function loadMonk() { try { const v = await tx('readonly', s => s.get('me')); if (v && v.id && v.key) ME = v; } catch (e) { } return myMonk(); }
export async function forgetMonk() { ME = null; try { await tx('readwrite', s => s.delete('me')); } catch (e) { } }
export async function redeem(code) {
  let kp; try { kp = await crypto.subtle.generateKey(ALG, false, ['sign', 'verify']); } catch (e) { throw new Error('bad_key'); }
  const pubkey = b64(await crypto.subtle.exportKey('raw', kp.publicKey));
  const { monk } = await call('monk_redeem', { code, pubkey });
  ME = { ...monk, key: kp.privateKey };
  try { await tx('readwrite', s => s.put(ME, 'me')); } catch (e) { }
  return info(ME);
}
const sign = async msg => b64(await crypto.subtle.sign(SIG, ME.key, enc(msg)));

// 서버에 "지금 여기 계심" 알림 (2분마다) — 지역 목록의 🪷 스님 계심 표시에 씀
let lastT = 0;
export async function pingMonk(region, temple = '') {
  if (!ME) return null;
  const t = Math.max(Date.now(), lastT + 1); lastT = t;
  try { return await call('monk_ping', { id: ME.id, t, region, temple, sig: await sign(`ping|${ME.id}|${t}|${region}|${temple}`) }); }
  catch (e) { if (/revoked|no_monk/.test(e.message)) { await forgetMonk(); return { revoked: true }; } return null; }
}

// 인증된 스님 명단 (공개키 포함) — 1분 동안은 다시 묻지 않음
let roster = null, rosterAt = 0, pending = null;
export async function monkRoster(force = false) {
  if (!force && roster && Date.now() - rosterAt < 60e3) return roster;
  if (!pending) pending = call('monks').then(j => { roster = j.monks || []; rosterAt = Date.now(); return roster; }).catch(() => roster || []).finally(() => { pending = null; });
  return pending;
}
const keys = new Map();
const pub = m => { if (!keys.has(m.id)) keys.set(m.id, crypto.subtle.importKey('raw', b64d(m.pubkey), ALG, false, ['verify'])); return keys.get(m.id); };

// 접속 표식: 내 접속 번호(cid)+시각에 서명 → 다른 번호로 베껴 쓰면 서명이 맞지 않음, 6분 지나면 무효
const FRESH = 6 * 60e3;
export async function monkBadge(cid) { if (!ME) return null; const t = Date.now(); return { id: ME.id, t, sig: await sign(`p|${cid}|${t}`) }; }
export async function checkBadge(cid, b) {
  if (!b || typeof b.id !== 'string' || typeof b.sig !== 'string' || !(Math.abs(Date.now() - b.t) < FRESH)) return null;
  let m = (await monkRoster()).find(x => x.id === b.id);
  if (!m) m = (await monkRoster(true)).find(x => x.id === b.id); // 방금 인증한 스님
  if (!m || !m.pubkey) return null;
  try { return (await crypto.subtle.verify(SIG, await pub(m), b64d(b.sig), enc(`p|${cid}|${b.t}`))) ? info(m) : null; } catch (e) { return null; }
}
export const monkLabel = m => `🪷 ${m.temple} ${m.name} 스님`;
// 인증 안 된 이름에서 '스님'·'주지' 같은 말은 빼고 보여 줌 (사칭 방지)
export const plainNick = n => String(n || '').replace(/\s*(큰\s*)?스\s*님|주지\s*(스님)?|🪷/g, '').trim();
