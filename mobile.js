/* ───────── 휴대폰 깔끔 모드 ─────────
   화면 위에 늘 떠 있던 버튼 16개를 두 개로 모음
   · ☰ 메뉴: 다른 사찰·법당·마당·실제 모습·할 일·연등·기와·사진·순위·함께·소리·안내 (아래에서 올라오는 창)
   · 🙏 기도: 합장·절·앉기·목탁·염주 (누르면 위로 펼쳐짐)
   원래 버튼들은 그대로 두고(숨김) 눌러 주기만 하므로, 기능은 PC와 똑같이 움직임 */
const $ = id => document.getElementById(id);
const MENU = [
  ['btnRegion', '🗺', '다른 사찰'], ['btnHall', '🛕', null], ['btnHome', '📍', '순례 마당'], ['btnPano', '📷', '실제 모습', 'red'],
  ['btnTodo', '📋', null], ['btnWish', '🏮', '소원 연등'], ['btnTile', '✍️', '기와 불사'], ['btnPhoto', '📸', '사진'],
  ['btnRank', '🏆', '순위'], ['btnPeople', '👥', null], ['btnSound', null, '소리'], ['title', 'ⓘ', '안내·출처'],
];
const PRAY = [['btnHapjang', '🙏', '합장'], ['btnBow', '🙇', '절'], ['btnSit', '🧘', '앉기'], ['btnMoktak', '🪵', '목탁'], ['btnBeads', '📿', '염주']];

export function initMobileClean() {
  if (!document.body.classList.contains('touch') || $('btnMenu')) return;
  document.body.classList.add('clean');
  const mk = (tag, id, cls, html) => { const e = document.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; if (html) e.innerHTML = html; document.body.appendChild(e); return e; };
  const dim = mk('div', 'sheetDim');
  const menuBtn = mk('button', 'btnMenu', 'card', '☰<b></b>'); menuBtn.setAttribute('aria-label', '메뉴');
  const prayBtn = mk('button', 'btnPray', 'card', '🙏'); prayBtn.setAttribute('aria-label', '기도');
  const tray = mk('div', 'prayTray', 'card', PRAY.map(([id, i, t]) => `<button data-id="${id}">${i}<small>${t}</small></button>`).join(''));
  const sheet = mk('div', 'menuSheet', 'card', '<i class="hd"></i><div class="g"></div>');
  const grid = sheet.querySelector('.g');

  const label = id => { // 원래 버튼의 지금 글자를 그대로 가져옴 (법당 안으로/밖으로, 할 일 0/13, 함께 3 …)
    const b = $(id); if (!b) return '';
    if (id === 'btnTodo') return '할 일 ' + (b.textContent.match(/\d+\/\d+/) || [''])[0];
    if (id === 'btnPeople') return '함께 ' + (b.textContent.match(/\d+/) || [''])[0];
    const sp = b.querySelector('span'); return (sp ? sp.textContent : b.textContent).trim();
  };
  const panels = () => [...document.querySelectorAll('.panel')];
  const closePanels = () => panels().forEach(p => p.classList.remove('show'));
  const syncDim = () => dim.classList.toggle('show', sheet.classList.contains('show') || panels().some(p => p.classList.contains('show')));
  const closeAll = () => { sheet.classList.remove('show'); tray.classList.remove('show'); prayBtn.classList.remove('on'); closePanels(); syncDim(); };

  const render = () => {
    grid.innerHTML = MENU.map(([id, ic, t, c]) => {
      const icon = ic || ($(id) ? $(id).textContent.trim().slice(0, 2) : '🔈');
      return `<button data-id="${id}" class="${c || ''}">${icon}<small>${t || label(id)}</small></button>`;
    }).join('');
  };
  menuBtn.onclick = () => {
    const open = !sheet.classList.contains('show');
    closeAll(); if (open) { render(); sheet.classList.add('show'); } syncDim();
  };
  grid.onclick = e => {
    const b = e.target.closest('button'); if (!b) return; const id = b.dataset.id;
    sheet.classList.remove('show');
    if (id === 'title') { $('title').classList.add('open'); syncDim(); return; }
    if (/Todo|Rank|People|Sound/.test(id)) closePanels();
    const src = $(id); if (src) src.click();
    syncDim();
  };
  prayBtn.onclick = () => {
    const open = !tray.classList.contains('show');
    closeAll(); tray.classList.toggle('show', open); prayBtn.classList.toggle('on', open);
  };
  tray.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    tray.classList.remove('show'); prayBtn.classList.remove('on');
    const src = $(b.dataset.id); if (src) src.click();
  };
  dim.onclick = closeAll;
  // 할 일 진행(0/13)은 메뉴 버튼 위 작은 숫자로
  const todo = $('btnTodo'), badge = menuBtn.querySelector('b');
  const syncBadge = () => { const m = todo && todo.textContent.match(/(\d+)\/(\d+)/); badge.textContent = m ? (m[1] === m[2] ? '✓' : `${m[1]}/${m[2]}`) : ''; };
  if (todo) new MutationObserver(syncBadge).observe(todo, { childList: true, characterData: true, subtree: true });
  syncBadge();
  // 할 일·순위·함께·소리 창이 열리고 닫힐 때 뒤 배경도 같이
  panels().forEach(p => new MutationObserver(syncDim).observe(p, { attributes: true, attributeFilter: ['class'] }));
}
