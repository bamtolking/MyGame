// 화면 마크업(제목·일시정지·결과·도감·설정·도움말)과 HUD 골격.
export const APP_HTML = `
<canvas id="cv"></canvas>
<div id="hud">
  <div id="top">
    <div class="bodyrow">
      <img id="bodyicon" alt="" />
      <div class="bodytext"><div id="bodyname">침입자</div><div id="bodyrole">기본 몸</div></div>
      <div id="zonebox"><b id="zonename">1/5</b><span id="zonetime">00:00</span></div>
      <button id="btn-pause" aria-label="일시정지">⏸</button>
    </div>
    <div class="bars">
      <div class="bar"><div class="lab"><span>♥ 체력</span><b id="hptext">50 / 50</b></div><div id="hpbar"><div id="hpfill"></div></div></div>
      <div class="bar"><div class="lab"><span>⬡ 안정도</span><b id="stabtext">—</b></div><div id="stabseg">${Array.from({ length: 10 }, (_, i) => `<div class="seg" id="seg${i}"></div>`).join('')}</div></div>
    </div>
    <div id="skillline">스킬</div>
    <div id="bossbar" class="hidden"><div class="lab"><span id="bosslabel">감시 코어 관리자</span><span id="bosshp"></span></div><div id="bossfill-wrap"><div id="bossfill"></div></div></div>
    <div id="wavestatus" class="hidden"></div>
  </div>
  <div id="tip" class="hidden"><span class="box" id="tiptext"></span></div>
  <div id="toast"></div>
  <div id="banner" class="hidden"></div>
  <div id="controls">
    <div id="stickzone"><div id="stickbase"><div id="stickknob"></div></div><div id="stickhint">이동</div></div>
    <div id="buttons">
      <button class="abtn" id="btn-interact"><span>상호작용</span><small id="interact-sub">없음</small></button>
      <button class="abtn" id="btn-possess"><span id="possess-txt">빙의</span><small id="possess-sub">대상 없음</small><div class="cd"></div></button>
      <button class="abtn" id="btn-skill"><span id="skill-txt">스킬</span><small id="skill-sub"></small><div class="cd"></div></button>
      <button class="abtn" id="btn-attack"><span>공격</span><small id="attack-sub"></small></button>
    </div>
  </div>
</div>
<div id="title" class="screen">
  <h1>갈아타!</h1>
  <div style="font-size:16px;font-weight:800;margin-bottom:6px">바디 하이재킹 <span style="font-size:11px;color:var(--dim)">웹 베타</span></div>
  <div class="tag">죽기 직전 적의 몸을 빼앗아 살아남고,<br/>상황에 맞는 몸을 갈아타며 보안 시설을 돌파하라.</div>
  <div class="menu">
    <button class="mbtn primary" id="t-start">새 침입 시작</button>
    <button class="mbtn hidden" id="t-resume">이어하기</button>
    <button class="mbtn" id="t-codex">몸 도감 · 기록</button>
    <button class="mbtn" id="t-help">도움말</button>
    <button class="mbtn" id="t-settings">설정</button>
  </div>
  <div class="foot" id="title-foot"></div>
</div>
<div id="pause" class="screen hidden">
  <h2>일시정지</h2>
  <div class="menu">
    <button class="mbtn primary" id="p-resume">계속하기</button>
    <button class="mbtn" id="p-help">도움말</button>
    <button class="mbtn" id="p-settings">설정</button>
    <button class="mbtn danger" id="p-quit">포기하고 메인으로</button>
  </div>
  <div class="foot" id="pause-foot"></div>
</div>
<div id="result" class="screen hidden">
  <h2 id="r-title">결과</h2>
  <div class="tag" id="r-sub"></div>
  <div class="panel">
    <div class="chain" id="r-chain"></div>
    <div class="stat" id="r-stat"></div>
    <div id="r-ach" style="font-size:12px;color:var(--green)"></div>
  </div>
  <div class="menu" style="margin-top:14px">
    <button class="mbtn primary" id="r-retry-zone">이 구역부터 재도전</button>
    <button class="mbtn" id="r-restart">처음부터 다시</button>
    <button class="mbtn" id="r-menu">메인으로</button>
  </div>
</div>
<div id="codex" class="screen hidden">
  <h2>몸 도감 · 기록</h2>
  <div class="codex" id="codex-list"></div>
  <div class="panel" style="margin-top:12px"><div style="font-weight:800;margin-bottom:6px">기록</div><div class="stat" id="records"></div></div>
  <div class="panel" style="margin-top:12px"><div style="font-weight:800;margin-bottom:6px">도전과제</div><div id="ach-list"></div></div>
  <div class="menu" style="margin-top:14px"><button class="mbtn" id="c-back">닫기</button></div>
</div>
<div id="settings" class="screen hidden">
  <h2>설정</h2>
  <div class="panel">
    <div class="row"><span>음량</span><input type="range" id="s-volume" min="0" max="100" /></div>
    <div class="row"><span>음소거</span><button class="toggle" id="s-mute">끔</button></div>
    <div class="row"><span>효과 강도(흔들림·파티클)</span><button class="toggle" id="s-fx">보통</button></div>
    <div class="row"><span>튜토리얼 힌트</span><button class="toggle" id="s-hints">켬</button></div>
    <div class="row"><span>피해 숫자 표시</span><button class="toggle" id="s-dmg">켬</button></div>
    <div class="row" id="s-hard-row"><span>어려움 모드 (클리어 후 해금)</span><button class="toggle" id="s-hard">끔</button></div>
  </div>
  <div class="menu" style="margin-top:14px">
    <button class="mbtn" id="s-back">닫기</button>
    <button class="mbtn danger" id="s-reset">저장 데이터 초기화</button>
  </div>
  <div class="foot" id="settings-foot"></div>
</div>
<div id="help" class="screen hidden">
  <h2>도움말</h2>
  <div class="panel help">
    <p><b>조작</b> 왼쪽 화면을 드래그하면 이동. 오른쪽 <b>공격</b>(누르고 있기), <b>스킬</b>, <b>빙의</b>, <b>상호작용</b>. 조준은 자동(조이스틱 방향의 적 우선). PC: WASD/방향키, J 공격, K 스킬, L 빙의, E 상호작용, P 일시정지.</p>
    <p><b>빙의(몸 탈취)</b> 적 체력을 <b>35% 이하</b>로 깎거나 <b>기절</b>시키면 머리 위에 흰 다이아몬드가 뜬다. 가까이 가서 빙의 버튼을 누르면 그 몸이 내 몸이 된다. 남은 체력은 그대로(최소 45%까지는 이식 회복), 안정도는 새 몸 최대치. 빙의 후 1.75초 재사용 대기.</p>
    <p><b>안정도</b> 빼앗은 몸은 시간이 지나고 피해를 받을수록 안정도가 떨어진다. 0이 되면 붕괴가 시작되어 체력이 빠르게 줄어든다. 붕괴 중에도 빙의는 가능하다.</p>
    <p><b>마지막 기회</b> 체력이 0이 되어도 근처(약 3.5칸)에 빙의 가능한 적이 있으면 1초 동안 시간이 느려진다. 그 안에 빙의하면 산다.</p>
    <p><b>몸 역할</b> 정찰병=빠른 이동·질주 / 방패병=전방 방어(포탑 통로) / 폭탄병=벽 너머 폭탄·금 간 벽 파괴 / 저격병=긴 사거리·스위치 작동 / 정비병=감전 기절·단자 조작·수복.</p>
    <p><b>남겨두기</b> 폭탄병을 죽이면 벽을 못 부수고, 저격병을 죽이면 스위치를 못 켠다. 몸으로 쓸 적은 남겨두자.</p>
    <p><b>보스</b> 코어가 잠겨 빙의할 수 없다. 소환되는 경비를 갈아타며 단계별 약점(노드 파괴·노출된 코어)을 노려라.</p>
  </div>
  <div class="menu" style="margin-top:14px"><button class="mbtn" id="h-back">닫기</button></div>
</div>
<div id="confirm" class="screen hidden">
  <h2 id="cf-title">확인</h2>
  <div class="tag" id="cf-text"></div>
  <div class="menu"><button class="mbtn danger" id="cf-yes">예</button><button class="mbtn" id="cf-no">아니오</button></div>
</div>
<div id="notice"></div>
`;
