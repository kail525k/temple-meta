// 사찰 제보함: 지도에 아직 없는 작은 절을 스님·종무소·신도가 알려 주면, 운영자가 검토해서 순례길에 넣음
// 제보는 temple_report_submit 함수로만 저장 (내용 검사 + 하루 횟수 제한), 저장된 제보는 운영자만 볼 수 있음
const SB_URL = 'https://tozyoprymcvznkeqmrqp.supabase.co';
const SB_KEY = 'sb_publishable_7FGPTjvPHWj-oF_EiiSjcg_MI63-mqE'; // 공개용 키 (제보 함수 호출만 가능, 제보 목록은 못 읽음)
const SIDO = ['서울', '경기', '인천', '강원', '충북', '충남', '대전', '세종', '전북', '전남', '광주', '경북', '대구', '경남', '부산', '울산', '제주'];
const ERR = {
  empty_name: '사찰 이름을 적어 주세요',
  empty_place: '주소나 지도 링크 중 하나는 꼭 적어 주세요',
  empty_contact: '검토 결과를 알려 드릴 연락처를 적어 주세요',
  no_agree: '연락처 수집·이용에 동의해 주세요',
  bad_link: '지도 링크는 https:// 로 시작하는 주소여야 해요',
  too_many: '한 기기에서 하루 5건까지 제보할 수 있어요. 내일 다시 해 주세요',
  busy: '오늘 제보가 많아 잠시 뒤에 다시 받아요',
};

const CSS = `
#reportModal{position:fixed;inset:0;background:rgba(30,25,15,.5);display:none;align-items:center;justify-content:center;z-index:32;padding:12px}
#reportModal.show{display:flex}
#reportModal .box{width:min(560px,100%);max-height:90vh;display:flex;flex-direction:column;overflow:hidden}
#reportModal header{display:flex;align-items:center;gap:10px;padding:12px 12px 10px 16px;border-bottom:1px solid var(--line,#e6dcc8)}
#reportModal header div{flex:1}#reportModal header b{font-size:16px}#reportModal header small{display:block;font-size:12px;color:#8a7a62;margin-top:2px;line-height:1.45}
#reportModal header button{border:0;border-radius:99px;padding:8px 14px;font-weight:600;background:#efe6d4;cursor:pointer;font-family:inherit}
#reportForm{overflow:auto;padding:12px 16px 16px;display:grid;gap:10px}
#reportForm label{display:grid;gap:4px;font-size:13px;font-weight:600;color:#4a3a28}
#reportForm label i{font-style:normal;color:#b5452e}
#reportForm label small{font-weight:400;color:#8a7a62;font-size:11.5px;display:block;margin-top:1px}
#reportForm input,#reportForm select,#reportForm textarea{font:inherit;font-size:14px;padding:9px 10px;border:1px solid #d9ccb3;border-radius:10px;background:#fffdf8;color:#2b1d14;width:100%;box-sizing:border-box}
#reportForm textarea{min-height:64px;resize:vertical}
#reportForm .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#reportForm .agree{display:flex;gap:8px;align-items:flex-start;font-weight:400;font-size:12.5px;color:#5a4a36;line-height:1.45}
#reportForm .agree input{width:auto;margin-top:3px}
#reportForm .send{border:0;border-radius:12px;padding:12px;font-weight:700;font-size:15px;background:#8c3a2a;color:#fff;cursor:pointer;font-family:inherit}
#reportForm .send:disabled{opacity:.6;cursor:default}
#reportForm .msg{font-size:13px;min-height:18px;color:#b5452e}
#reportDone{display:none;padding:28px 18px;text-align:center;line-height:1.6;color:#4a3a28}
#reportDone b{font-size:17px;display:block;margin-bottom:6px}
#reportDone button{margin-top:14px;border:0;border-radius:99px;padding:9px 18px;font-weight:600;background:#efe6d4;cursor:pointer;font-family:inherit}
@media (max-width:480px){#reportForm .row{grid-template-columns:1fr}}
`;

const HTML = `
<div class="box card">
  <header><div><b>🙏 우리 절도 순례길에 넣어 주세요</b><small>지도에 아직 없는 사찰을 알려 주시면 검토해서 실제 모습대로 만들어 넣어요 · 스님·종무소·신도 누구나 제보할 수 있어요</small></div><button type="button" data-close>닫기</button></header>
  <form id="reportForm" autocomplete="on">
    <label><span>사찰 이름 <i>*</i></span><input name="temple_name" maxlength="60" placeholder="예: ○○사, ○○암" required></label>
    <div class="row">
      <label><span>시·도</span><select name="sido"><option value="">선택</option>${SIDO.map(s => `<option>${s}</option>`).join('')}</select></label>
      <label><span>주소</span><input name="address" maxlength="200" placeholder="도로명 또는 지번 주소"></label>
    </div>
    <label><span>지도 링크 <small>네이버·카카오·구글 지도에서 '공유' 누른 주소 (주소를 적었으면 비워도 돼요)</small></span><input name="map_url" maxlength="500" inputmode="url" placeholder="https://naver.me/…"></label>
    <div class="row">
      <label><span>제보하시는 분</span><select name="role"><option>스님</option><option>종무소</option><option>신도</option><option>기타</option></select></label>
      <label><span>법명·이름</span><input name="reporter" maxlength="40" placeholder="예: ○○ 스님"></label>
    </div>
    <label><span>연락처 <i>*</i> <small>전화번호나 이메일 · 검토 결과와 추가 사진 요청에만 써요 (공개되지 않아요)</small></span><input name="contact" maxlength="100" placeholder="010-…  또는  name@…" required></label>
    <label><span>전각과 모신 부처님 <small>예: 대웅전 석가모니불 좌상·양옆 보살 입상 / 관음전 관세음보살 / 바닷가 와불 / 3층 석탑</small></span><textarea name="halls" maxlength="1500"></textarea></label>
    <label><span>사진 링크 <small>홈페이지·블로그·카페·드라이브 등 사진이 있는 곳 (여러 개면 줄을 바꿔 적어 주세요)</small></span><textarea name="photos" maxlength="1000" placeholder="https://…"></textarea></label>
    <label><span>하고 싶은 말 <small>절의 내력, 꼭 넣고 싶은 곳, 법회·행사 등</small></span><textarea name="note" maxlength="1000"></textarea></label>
    <label class="agree"><input type="checkbox" name="agree"> <span>연락처(전화·이메일)를 제보 검토와 결과 안내에만 쓰고, 반영이 끝나면 지우는 데 동의해요. 동의하지 않으면 제보를 받을 수 없어요.</span></label>
    <div class="msg" aria-live="polite"></div>
    <button class="send" type="submit">제보 보내기</button>
  </form>
  <div id="reportDone"><b>🙏 제보가 접수되었어요</b><span class="no"></span><br>보내 주신 내용을 검토해서 순례길에 넣을게요.<br>사진이나 위치를 더 여쭤봐야 하면 남겨 주신 연락처로 연락드려요.<br><button type="button" data-close>닫기</button></div>
</div>`;

let el = null;
function clientId() { try { const id = localStorage.getItem('templeMeta.cid'); if (/^[0-9a-f-]{36}$/.test(id || '')) return id; } catch (e) { } return null; }

export function openReport({ sido = '', toast = null } = {}) {
  if (!el) {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    el = document.createElement('div'); el.id = 'reportModal'; el.innerHTML = HTML; document.body.appendChild(el);
    const form = el.querySelector('#reportForm'), msg = form.querySelector('.msg'), send = form.querySelector('.send'), done = el.querySelector('#reportDone');
    const close = () => el.classList.remove('show');
    el.addEventListener('click', e => { if (e.target === el || e.target.hasAttribute('data-close')) close(); });
    el.addEventListener('keydown', e => e.stopPropagation()); // 글을 쓰는 동안 WASD·단축키가 움직이지 않게
    form.addEventListener('submit', async e => {
      e.preventDefault(); msg.textContent = '';
      const f = Object.fromEntries(new FormData(form)); f.agree = form.agree.checked;
      if (!f.temple_name.trim()) return (msg.textContent = ERR.empty_name);
      if (!f.address.trim() && !f.map_url.trim()) return (msg.textContent = ERR.empty_place);
      if (!f.contact.trim()) return (msg.textContent = ERR.empty_contact);
      if (f.map_url.trim() && !/^https?:\/\//i.test(f.map_url.trim())) return (msg.textContent = ERR.bad_link);
      if (!f.agree) return (msg.textContent = ERR.no_agree);
      send.disabled = true; send.textContent = '보내는 중…';
      try {
        const r = await fetch(`${SB_URL}/rest/v1/rpc/temple_report_submit`, {
          method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_temple_name: f.temple_name, p_sido: f.sido, p_address: f.address, p_map_url: f.map_url, p_reporter: f.reporter, p_role: f.role, p_contact: f.contact, p_halls: f.halls, p_photos: f.photos, p_note: f.note, p_agree: true, p_client: clientId() }),
        });
        const body = await r.json().catch(() => null);
        if (!r.ok) { const m = String(body && (body.message || body.hint) || ''); throw new Error(Object.keys(ERR).find(k => m.includes(k)) || m || r.status); }
        form.style.display = 'none'; done.style.display = 'block'; done.querySelector('.no').textContent = `접수 번호 ${body}번 · ${f.temple_name}`;
        form.reset();
      } catch (err) {
        msg.textContent = ERR[err.message] || '지금은 보내지 못했어요. 잠시 뒤에 다시 해 주세요';
      } finally { send.disabled = false; send.textContent = '제보 보내기'; }
    });
  }
  const form = el.querySelector('#reportForm'); form.style.display = ''; el.querySelector('#reportDone').style.display = 'none'; form.querySelector('.msg').textContent = '';
  if (sido && !form.sido.value) form.sido.value = sido;
  el.classList.add('show'); setTimeout(() => form.temple_name.focus(), 50);
}
