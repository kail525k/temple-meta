// 함께 순례하기 (위레브): 같은 권역에 접속한 사람끼리 서로 보이고, 기와·연등을 모두가 함께 봄
// - 실시간: Supabase Realtime 채널 하나(권역별) — 접속자 목록(presence) + 위치·자세(broadcast)
// - 기와·연등: temple_offerings 표에 저장(쓰기는 검사 함수 temple_offer로만), 새로 올라오면 바로 받음
// 이름·연락처 같은 개인정보는 받지 않고, 기기마다 무작위 번호와 지어 준 법명(닉네임)만 씀

const SB_URL = 'https://tozyoprymcvznkeqmrqp.supabase.co';
const SB_KEY = 'sb_publishable_7FGPTjvPHWj-oF_EiiSjcg_MI63-mqE'; // 공개용 키 (읽기 + 검사 함수 호출만 가능)

const A = ['고요한', '맑은', '따뜻한', '푸른', '은은한', '느긋한', '다정한', '환한', '작은', '깊은', '포근한', '반짝이는'];
const N = ['연잎', '풍경', '솔바람', '목탁', '연등', '동백', '산새', '이슬', '달빛', '구름', '염주', '범종', '물소리', '다람쥐', '단풍', '차향'];
export function myIdentity() {
  let id = '', nick = '';
  if (/[?&]guest/.test(location.search)) return { id: crypto.randomUUID(), nick: `${A[Math.random() * A.length | 0]} ${N[Math.random() * N.length | 0]}` }; // 점검용: 한 브라우저에서 두 사람처럼
  try { id = localStorage.getItem('templeMeta.cid') || ''; nick = localStorage.getItem('templeMeta.nick') || ''; } catch (e) { }
  if (!/^[0-9a-f-]{36}$/.test(id)) { id = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)); try { localStorage.setItem('templeMeta.cid', id); } catch (e) { } }
  if (!nick) { nick = `${A[Math.random() * A.length | 0]} ${N[Math.random() * N.length | 0]}`; try { localStorage.setItem('templeMeta.nick', nick); } catch (e) { } }
  return { id, nick };
}
export function saveNick(nick) { try { localStorage.setItem('templeMeta.nick', nick); } catch (e) { } }

const ERR = {
  personal_info: '전화번호처럼 보이는 숫자는 적을 수 없어요',
  link: '링크나 연락처는 적을 수 없어요',
  bad_word: '고운 말로 적어 주세요',
  too_many: '잠시 뒤에 다시 올려 주세요 (10분에 6개까지)',
  busy: '지금 올리는 분이 많아요. 잠시 뒤에 다시 해 주세요',
  empty: '내용을 적어 주세요',
};
export const offerError = e => { const m = String(e && (e.message || e)); for (const k in ERR) if (m.includes(k)) return ERR[k]; return null; };

export async function connectTogether({ region, me, onPeers, onState, onOffer, onStatus }) {
  // 외부 라이브러리는 필요할 때 불러옴 (못 불러와도 앱은 혼자 순례로 계속 동작)
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 20 } } });
  const ch = sb.channel('temple-meta:' + region, { config: { presence: { key: me.id }, broadcast: { self: false } } });
  let joined = false;
  ch.on('presence', { event: 'sync' }, () => onPeers(ch.presenceState()))
    .on('broadcast', { event: 's' }, ({ payload }) => payload && payload.id !== me.id && onState(payload))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'temple_offerings', filter: `region=eq.${region}` }, p => p && p.new && onOffer(p.new))
    .subscribe(async status => {
      joined = status === 'SUBSCRIBED'; onStatus && onStatus(status);
      if (joined) await ch.track({ nick: me.nick, at: Date.now() });
    });
  return {
    get joined() { return joined; },
    send(state) { if (joined) ch.send({ type: 'broadcast', event: 's', payload: state }); },
    retrack() { if (joined) ch.track({ nick: me.nick, at: Date.now() }); },
    async load() {
      const { data, error } = await sb.from('temple_offerings').select('id,region,kind,temple,color,body,nick,created_at').eq('region', region).order('created_at', { ascending: false }).limit(300);
      if (error) throw error; return data || [];
    },
    async offer({ kind, temple = null, color = null, body }) {
      const { data, error } = await sb.rpc('temple_offer', { p_region: region, p_kind: kind, p_temple: temple, p_color: color, p_body: body, p_nick: me.nick, p_client: me.id });
      if (error) throw error; return data;
    },
  };
}
