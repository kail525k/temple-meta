// 사찰 제보 운영: 새 제보 텔레그램 알림 · 텔레그램 코드로 관리자 로그인 · 제보 목록/상태 변경
// 비밀값: TELEGRAM_BOT_TOKEN (운영자가 Supabase 대시보드 Edge Function Secrets에 직접 넣음)
import { createClient } from 'npm:@supabase/supabase-js@2';

const SB = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
// 붙여 넣을 때 앞뒤 공백·줄바꿈이나 BotFather 안내 문구가 같이 들어가도 토큰 부분만 골라 씀
const RAW = (Deno.env.get('TELEGRAM_BOT_TOKEN') || '').trim();
const TOKEN = (RAW.match(/\d{5,}:[A-Za-z0-9_-]{30,}/) || [RAW.replace(/^bot/i, '').replace(/\s+/g, '')])[0];
const ADMIN_URL = 'https://temple-meta.vercel.app/admin.html';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const sha = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))).map(b => b.toString(16).padStart(2, '0')).join('');
const cut = (s: string | null, n = 700) => !s ? '' : s.length > n ? s.slice(0, n) + '…' : s;
const STATUS = ['new', 'review', 'done', 'reject'];

async function tg(method: string, body: Record<string, unknown>) {
  if (!TOKEN) throw new Error('no_token');
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error('telegram:' + (j.description || r.status));
  return j.result;
}
async function kv(key: string) { const { data } = await SB.from('admin_kv').select('value').eq('key', key).maybeSingle(); return (data?.value as string) ?? null; }
async function setKv(key: string, value: string | null) {
  if (value === null) await SB.from('admin_kv').delete().eq('key', key);
  else await SB.from('admin_kv').upsert({ key, value, updated_at: new Date().toISOString() });
}
const chatId = () => kv('tg_chat_id');

// 봇에게 /start 를 보낸 1:1 채팅을 운영자 채팅으로 연결 (이미 연결돼 있으면 그대로)
async function link() {
  const have = await chatId(); if (have) return have;
  const ups = await tg('getUpdates', { timeout: 0, allowed_updates: ['message'] }) as Array<{ message?: { text?: string, chat?: { id: number, type: string } } }>;
  const m = [...ups].reverse().find(u => u.message?.chat?.type === 'private' && /^\/start/.test(u.message?.text || ''));
  if (!m) return null;
  const id = String(m.message!.chat!.id); await setKv('tg_chat_id', id);
  await tg('sendMessage', { chat_id: id, text: `🙏 사찰 순례 제보 알림이 연결되었어요.\n새 사찰 제보가 들어오면 여기로 바로 알려 드릴게요.\n관리자 화면: ${ADMIN_URL}` });
  return id;
}

function fmt(r: Record<string, string | number | null>) {
  const L = [`🙏 새 사찰 제보 #${r.id}`, `사찰: ${r.temple_name}${r.sido ? ` (${r.sido})` : ''}`];
  if (r.address) L.push(`주소: ${cut(r.address as string, 200)}`);
  if (r.map_url) L.push(`지도: ${cut(r.map_url as string, 300)}`);
  L.push(`제보: ${r.role}${r.reporter ? ' · ' + cut(r.reporter as string, 40) : ''}`);
  if (r.contact) L.push(`연락처: ${cut(r.contact as string, 100)}`);
  if (r.halls) L.push(`\n전각·부처님: ${cut(r.halls as string)}`);
  if (r.photos) L.push(`\n사진: ${cut(r.photos as string, 500)}`);
  if (r.note) L.push(`\n하고 싶은 말: ${cut(r.note as string)}`);
  L.push(`\n관리자 화면: ${ADMIN_URL}`);
  return L.join('\n');
}

// 아직 알리지 않은 제보만 골라 보냄 (여러 번 불려도 한 번씩만 감)
async function notify() {
  if (!TOKEN) return { sent: 0, reason: 'no_token' };
  const id = (await chatId()) || (await link().catch(() => null));
  if (!id) return { sent: 0, reason: 'not_linked' };
  const { data } = await SB.from('temple_reports').select('*').is('notified_at', null).order('id').limit(10);
  let sent = 0;
  for (const r of data || []) {
    const { data: got } = await SB.from('temple_reports').update({ notified_at: new Date().toISOString() }).eq('id', r.id).is('notified_at', null).select('id');
    if (!got || !got.length) continue;
    try { await tg('sendMessage', { chat_id: id, text: fmt(r), disable_web_page_preview: true }); sent++; }
    catch (e) { await SB.from('temple_reports').update({ notified_at: null }).eq('id', r.id); throw e; }
  }
  return { sent };
}

async function sendCode() {
  const id = await chatId(); if (!id) throw new Error('not_linked');
  const { data: recent } = await SB.from('admin_codes').select('created_at').gte('created_at', new Date(Date.now() - 86400e3).toISOString()).order('created_at', { ascending: false });
  if (recent && recent.length >= 15) throw new Error('too_many');
  if (recent && recent[0] && Date.now() - Date.parse(recent[0].created_at) < 40e3) throw new Error('wait');
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
  await SB.from('admin_codes').insert({ code_hash: await sha('c:' + code), expires_at: new Date(Date.now() + 10 * 60e3).toISOString() });
  await tg('sendMessage', { chat_id: id, text: `🔐 사찰 순례 관리자 로그인 코드: ${code}\n10분 안에 입력해 주세요. 직접 요청하지 않았다면 무시하세요.` });
}
async function login(raw: unknown) {
  const code = String(raw || '').replace(/\D/g, ''); if (code.length !== 6) throw new Error('bad_code');
  const { data: c } = await SB.from('admin_codes').select('*').eq('used', false).gt('expires_at', new Date().toISOString()).order('id', { ascending: false }).limit(1).maybeSingle();
  if (!c) throw new Error('expired');
  if (c.tries >= 5) throw new Error('too_many_tries');
  if (c.code_hash !== await sha('c:' + code)) { await SB.from('admin_codes').update({ tries: c.tries + 1 }).eq('id', c.id); throw new Error('wrong_code'); }
  await SB.from('admin_codes').update({ used: true }).eq('id', c.id);
  const tok = crypto.randomUUID() + crypto.randomUUID();
  await SB.from('admin_sessions').insert({ token_hash: await sha('s:' + tok), expires_at: new Date(Date.now() + 30 * 86400e3).toISOString() });
  return tok;
}
async function authed(tok: unknown) {
  if (typeof tok !== 'string' || tok.length < 40) return false;
  const { data } = await SB.from('admin_sessions').select('expires_at').eq('token_hash', await sha('s:' + tok)).maybeSingle();
  return !!data && Date.parse(data.expires_at) > Date.now();
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let b: Record<string, unknown> = {}; try { b = await req.json(); } catch { /* 빈 요청 */ }
  try {
    switch (b.action) {
      case 'status': { // 토큰이 맞는지 텔레그램에 물어봐서 봇 아이디를 알려 줌 (토큰 자체는 절대 내보내지 않음)
        let bot = null, tokenError = null;
        if (TOKEN) { try { bot = (await tg('getMe', {}) as { username?: string }).username || null; } catch (e) { tokenError = String((e as Error).message || e); } }
        return json({ token: !!TOKEN, tokenOk: !!bot, bot, tokenError, linked: !!(await chatId()) });
      }
      case 'link': { if (!TOKEN) throw new Error('no_token'); const id = await link(); if (id) await notify().catch(() => null); return json({ linked: !!id }); }
      case 'notify': return json(await notify());
      case 'code': await sendCode(); return json({ ok: true });
      case 'login': return json({ token: await login(b.code) });
    }
    if (!(await authed(b.token))) return json({ error: 'auth' }, 401);
    switch (b.action) {
      case 'list': {
        const { data, error } = await SB.from('temple_reports').select('id,created_at,updated_at,temple_name,sido,address,map_url,reporter,role,contact,halls,photos,note,status,admin_note,notified_at').order('id', { ascending: false }).limit(300);
        if (error) throw error; return json({ items: data });
      }
      case 'update': {
        const p: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (typeof b.status === 'string' && STATUS.includes(b.status)) p.status = b.status;
        if (typeof b.admin_note === 'string') p.admin_note = b.admin_note.slice(0, 2000);
        if (b.clear_contact === true) p.contact = null;
        const { error } = await SB.from('temple_reports').update(p).eq('id', Number(b.id)); if (error) throw error;
        return json({ ok: true });
      }
      case 'test': { const id = await chatId(); if (!id) throw new Error('not_linked'); await tg('sendMessage', { chat_id: id, text: '🔔 테스트 알림이에요. 새 사찰 제보가 오면 이렇게 알려 드려요.' }); await notify().catch(() => null); return json({ ok: true }); }
      case 'unlink': await setKv('tg_chat_id', null); return json({ ok: true });
      case 'logout': await SB.from('admin_sessions').delete().eq('token_hash', await sha('s:' + String(b.token))); return json({ ok: true });
    }
    return json({ error: 'unknown' }, 400);
  } catch (e) { return json({ error: String((e as Error).message || e) }, 400); }
});
