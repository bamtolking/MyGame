// ─────────────────────────────────────────────────────────────────────────────
// 적 로스터 — 칼퇴 서바이버
//
// 체력 설계 기준 (BRIEF 밸런스 목표 + 2차 개정 봇 측정):
//  - hp는 '시간 배율 적용 전' 기본값. 실제 체력 = hp × 구간 hpMul(0초 1.0 → 533초 9.5 → 600초 14) × 스테이지 hpMul
//    (office 1 / crunch 1.35 / dinner 1.7 / holiday 1.8) × 저주·야근 강도.
//  - 일반 적 10~20, 떼(swarm) 7~9, 분열 자식 4~6, 탱커 45~65, 엘리트 240~360.
//  - 뒤 스테이지일수록 같은 역할의 기본 체력·접촉 피해도 조금씩 높다(스테이지 hpMul과 곱해져 체감 1.3~1.5배/스테이지).
//  - 보스 hp는 '절대 체력'이다: 엔진은 보스에 구간/이벤트 hpMul을 곱하지 않는다(sim hpScale(w, true)).
//    실제 = hp × 스테이지 hpMul × 저주·야근 강도. 목표 TTK = '그 시점 예상 단일 DPS × 25~45초'.
//    뒤 스테이지 보스는 기본 hp를 거의 같게 두고 스테이지 배율만 받는다 → 실효 1.0/1.3/1.6/1.7배 수준(복지 성장을 따라감).
//      team_lead 1500 ≈ 1.5k  |  bujang      44000 ≈ 44k   (office, ×1.0)
//      pm        1700 ≈ 2.3k  |  director    42000 ≈ 57k   (crunch, ×1.35)
//      toast     1700 ≈ 2.9k  |  bomb_bujang 42000 ≈ 71k   (dinner, ×1.7)
//      uncle     1700 ≈ 3.1k  |  big_aunt    42000 ≈ 76k   (holiday, ×1.8)
//    봇 실측 TTK(잡몹 포함): 중간 보스 중앙값 ≈ 30~40초, 최종 보스 ≈ 40~70초(18:00 전 67초 창).
//    중간 보스는 약 30초 안에 잡혀 12:00 점심이 '승리의 한 끼'가 되도록(점심 뒤까지 쫓아오지 않게) 잡았다.
//  - 보스 패턴 가독성 규칙:
//    · slam windup ≥ (radius + 12) / 130 + 0.3초 — 기본 이동속도로 예고 원을 빠져나갈 수 있고 폰 반응 시간 0.3초를 준다.
//    · wall/ring이 보스 탄막과 겹칠 때 적 사이 틈 ≥ 플레이어 지름의 1.4배(≈35u): 틈 = 2π·R/count − 2·적 반지름.
//    · 최종 보스 enrage cdMul ≥ 0.65, 소환 수는 minAlive 위에 얹힌다는 걸 감안해 4~8.
//  - 접촉 피해: 일반 4~8, 강한 적 10~14, 보스 20~30. 평균 경험치 ≈ 1.3(대부분 1, 탱커/분열체 2~3).
// ─────────────────────────────────────────────────────────────────────────────
import type { EnemyDef } from './types';

// ───────────────────────────── 공용 ─────────────────────────────
const COMMON: EnemyDef[] = [
  {
    id: 'mini_memo', name: '작은 쪽지', sprite: '📝', tint: '#d69e2e',
    hp: 4, speed: 64, damage: 3, radius: 9, xp: 1,
    behavior: 'chase',
  },
];

// ───────────────────────────── 월요일 사무실 (office) ─────────────────────────────
const OFFICE: EnemyDef[] = [
  {
    id: 'spam', name: '스팸 메일', sprite: '📧', tint: '#3182ce',
    hp: 7, speed: 68, damage: 5, radius: 11, xp: 1,
    behavior: 'zigzag', params: { wobble: 26, freq: 1.6 },
    intro: '[광고] 스팸 메일 도착! 수신 거부는 불가능합니다.',
  },
  {
    id: 'memo', name: '결재 서류', sprite: '📄', tint: '#718096',
    hp: 12, speed: 48, damage: 6, radius: 12, xp: 1,
    behavior: 'chase',
  },
  {
    id: 'phone', name: '전화벨', sprite: '📞', tint: '#e53e3e',
    hp: 14, speed: 50, damage: 7, radius: 12, xp: 1,
    behavior: 'dash', params: { dashRange: 170, dashSpeed: 300, dashDur: 0.45, dashCd: 3.2 },
    intro: '따르릉! 받으면 일이 늘어나는 전화. 벨이 멈추면 돌진합니다!',
  },
  {
    id: 'meeting', name: '회의 초대', sprite: '📅', tint: '#805ad5',
    hp: 16, speed: 40, damage: 6, radius: 13, xp: 1, knockbackResist: 0.3,
    behavior: 'chase',
    intro: '회의 초대가 도착했습니다. [거절] 버튼은 없습니다.',
  },
  {
    id: 'kpi', name: 'KPI 그래프', sprite: '📊', tint: '#2f855a',
    hp: 48, speed: 34, damage: 10, radius: 16, xp: 4, knockbackResist: 0.6, armor: 1,
    behavior: 'chase',
    intro: 'KPI가 우상향 중입니다. 체력도요. 느리지만 단단합니다.',
  },
  {
    id: 'binder', name: '서류 뭉치', sprite: '🗂️', tint: '#b7791f',
    hp: 26, speed: 40, damage: 7, radius: 15, xp: 3, knockbackResist: 0.3,
    behavior: 'chase', split: { into: 'memo', count: 3 },
    intro: '서류 뭉치를 치면 결재 서류가 쏟아집니다. 원래 그렇습니다.',
  },
  {
    id: 'chat', name: '단톡방 알림', sprite: '💬', tint: '#ecc94b',
    hp: 10, speed: 52, damage: 5, radius: 11, xp: 1,
    behavior: 'ranged', params: { keep: 190, shotCd: 2.6, shotSpeed: 150, shotDamage: 6 },
    intro: '단톡방 알림 999+. 멀리서 "확인 부탁드립니다"를 쏴댑니다.',
  },
  {
    id: 'deadline', name: '마감 임박', sprite: '⌛', tint: '#dd6b20',
    hp: 9, speed: 86, damage: 7, radius: 11, xp: 1,
    behavior: 'chase',
    intro: '마감이 빠르게 다가옵니다! (마감은 원래 빠릅니다)',
  },
  // 엘리트
  {
    id: 'printer', name: '고장난 프린터', sprite: '🖨️', tint: '#4a5568',
    hp: 240, speed: 30, damage: 12, radius: 22, xp: 25, knockbackResist: 0.85, armor: 1,
    elite: true,
    behavior: 'spawner', params: { spawnCd: 4, spawnId: 'memo', spawnCount: 2 },
    abilities: [
      { kind: 'ring', cooldown: 6, params: { bullets: 8, speed: 130, damage: 7 }, shout: '용지 걸림! 용지 걸림!' },
    ],
    intro: '고장난 프린터가 서류를 토해냅니다.',
  },
  // 중간 보스
  {
    id: 'team_lead', name: '팀장님', sprite: '😒', tint: '#2b6cb0',
    hp: 1500, speed: 50, damage: 20, radius: 40, xp: 60, knockbackResist: 1,
    boss: true, body: { suit: '#4a5568', tie: '#3182ce' },
    behavior: 'chase',
    abilities: [
      { kind: 'summon', cooldown: 10, params: { enemy: 'memo', count: 4, radius: 90 }, shout: '이것도 좀 같이 봐줘요~' },
      { kind: 'aimed', cooldown: 5, params: { bullets: 3, spreadDeg: 30, speed: 170, damage: 8 }, shout: '보고서 양식이 이게 아니잖아요' },
      { kind: 'charge', cooldown: 9, hpBelow: 0.6, params: { speed: 280, dur: 0.8, windup: 0.8 }, shout: '잠깐 나 좀 봐요!' },
      // 첫 보스는 패턴 4개만. '긴급 회의 소집'(wall) 포위는 부장님에서 처음 등장한다.
      { kind: 'enrage', cooldown: 1, hpBelow: 0.3, params: { speedMul: 1.3, cdMul: 0.7 }, shout: '이건 팀장 선에서 안 끝나요!!' },
    ],
    intro: '팀장님: 회의를 위한 회의를 여는 분. "잠깐 얘기 좀 할까요?"',
  },
  // 최종 보스
  {
    id: 'bujang', name: '부장님', sprite: '😤', tint: '#9b2c2c',
    hp: 44000, speed: 54, damage: 25, radius: 50, xp: 150, knockbackResist: 1,
    boss: true, body: { suit: '#1f2937', tie: '#b91c1c' },
    behavior: 'chase',
    abilities: [
      { kind: 'summon', cooldown: 9, params: { enemy: 'binder', count: 4, radius: 110 }, shout: '이거 오늘까지 되죠?' },
      { kind: 'ring', cooldown: 6.5, params: { bullets: 14, speed: 150, damage: 10 }, shout: '라떼는 말이야~!' },
      { kind: 'slam', cooldown: 8, params: { radius: 90, damage: 26, windup: 1.1 }, shout: '이게 최선입니까?' },
      { kind: 'wall', cooldown: 18, hpBelow: 0.75, params: { enemy: 'meeting', count: 20, radius: 185 }, shout: '긴급 회의 소집! 전원 회의실로!' },
      { kind: 'hazard', cooldown: 12, hpBelow: 0.5, params: { count: 4, radius: 55, dps: 12, dur: 6 }, shout: '오늘 야근할 사람~? (전원 지목)' },
      { kind: 'enrage', cooldown: 1, hpBelow: 0.25, params: { speedMul: 1.35, cdMul: 0.7 }, shout: '오늘 회식이다! 아무도 못 가!' },
    ],
    intro: '부장님: 17시에만 나타나는 업무 요청의 화신.',
  },
];

// ───────────────────────────── 분기 마감 야근 (crunch) ─────────────────────────────
const CRUNCH: EnemyDef[] = [
  {
    id: 'bug', name: '버그', sprite: '🐛', tint: '#38a169',
    hp: 7, speed: 70, damage: 5, radius: 10, xp: 1,
    behavior: 'chase',
    intro: '버그 발견! 하나 고치면 세 마리가 나옵니다.',
  },
  {
    id: 'issue', name: '긴급 이슈', sprite: '🧨', tint: '#e53e3e',
    hp: 12, speed: 62, damage: 6, radius: 12, xp: 1,
    behavior: 'exploder', params: { fuseRange: 60, fuse: 0.8, blastRadius: 70, blastDamage: 14 },
    intro: '긴급 이슈! 가까이 가면 터집니다. 멀리서 처리하세요.',
  },
  {
    id: 'zombie', name: '좀비 동료', sprite: '🧟', tint: '#4a5568',
    hp: 55, speed: 30, damage: 11, radius: 16, xp: 4, knockbackResist: 0.6, armor: 1,
    behavior: 'chase',
    intro: '사흘째 퇴근 못 한 동료입니다. 쉽게 쓰러지지 않습니다.',
  },
  {
    id: 'ghost_task', name: '유령 업무', sprite: '👻', tint: '#a0aec0',
    hp: 11, speed: 58, damage: 6, radius: 12, xp: 1,
    behavior: 'zigzag', params: { wobble: 40, freq: 1.1 },
    intro: '분명히 끝낸 업무가... 다시 나타났다?!',
  },
  {
    id: 'hotfix', name: '핫픽스', sprite: '🩹', tint: '#ed64a6',
    hp: 18, speed: 44, damage: 5, radius: 12, xp: 2,
    behavior: 'healer', params: { healCd: 3, healRadius: 110, healPct: 0.15 },
    intro: '핫픽스가 주변 적을 치료합니다. 땜질부터 끊으세요!',
  },
  {
    id: 'report', name: '주간 보고서', sprite: '📑', tint: '#b7791f',
    hp: 22, speed: 42, damage: 7, radius: 14, xp: 2, knockbackResist: 0.3,
    behavior: 'chase', split: { into: 'mini_memo', count: 4 },
    intro: '주간 보고서를 찢으면 작은 쪽지가 우수수 흩날립니다.',
  },
  {
    id: 'alert', name: '장애 알림', sprite: '🚨', tint: '#c53030',
    hp: 13, speed: 50, damage: 6, radius: 12, xp: 1,
    behavior: 'ranged', params: { keep: 200, shotCd: 2.2, shotSpeed: 170, shotDamage: 7 },
    intro: '장애 알림 폭주! 멀리서 알림을 쏴댑니다.',
  },
  {
    id: 'owl', name: '올빼미 야근러', sprite: '🦉', tint: '#744210',
    hp: 16, speed: 55, damage: 8, radius: 12, xp: 1,
    behavior: 'dash', params: { dashRange: 190, dashSpeed: 330, dashDur: 0.5, dashCd: 2.8 },
    intro: '새벽형 인간 출현. 눈이 번쩍하면 달려듭니다.',
  },
  // 엘리트
  {
    id: 'server', name: '서버 다운', sprite: '🖥️', tint: '#2c5282',
    hp: 280, speed: 28, damage: 13, radius: 24, xp: 30, knockbackResist: 0.9, armor: 2,
    elite: true,
    behavior: 'spawner', params: { spawnCd: 3.5, spawnId: 'bug', spawnCount: 3 },
    abilities: [
      { kind: 'ring', cooldown: 6, params: { bullets: 10, speed: 140, damage: 8 }, shout: '502 Bad Gateway' },
    ],
    intro: '서버 다운! 버그를 끝없이 뿜어냅니다.',
  },
  // 중간 보스
  {
    id: 'pm', name: 'PM', sprite: '🙄', tint: '#6b46c1',
    hp: 1700, speed: 52, damage: 22, radius: 40, xp: 70, knockbackResist: 1,
    boss: true, body: { suit: '#6b46c1', tie: '#f59e0b' },
    behavior: 'chase',
    abilities: [
      { kind: 'summon', cooldown: 7.5, params: { enemy: 'bug', count: 5, radius: 90 }, shout: '이거 간단한 거죠? 금방 되죠?' },
      { kind: 'aimed', cooldown: 4.5, params: { bullets: 4, spreadDeg: 30, speed: 200, damage: 9 }, shout: '요구사항이 살짝 바뀌었어요~' },
      { kind: 'hazard', cooldown: 11, hpBelow: 0.7, params: { count: 3, radius: 50, dps: 10, dur: 5 }, shout: '스펙 추가요! 일정은 그대로고요!' },
      { kind: 'wall', cooldown: 16, hpBelow: 0.5, params: { enemy: 'meeting', count: 16, radius: 175 }, shout: '긴급 회의 소집! 싱크 좀 맞출게요' },
      { kind: 'enrage', cooldown: 1, hpBelow: 0.3, params: { speedMul: 1.35, cdMul: 0.65 }, shout: '고객사가 내일 아침까지래요!!' },
    ],
    intro: 'PM: "개발은 잘 모르지만, 이거 금방 되죠?"',
  },
  // 최종 보스
  {
    id: 'director', name: '본부장', sprite: '😠', tint: '#7f1d1d',
    hp: 42000, speed: 56, damage: 27, radius: 52, xp: 170, knockbackResist: 1,
    boss: true, body: { suit: '#111827', tie: '#7f1d1d' },
    behavior: 'chase',
    abilities: [
      { kind: 'summon', cooldown: 9, params: { enemy: 'zombie', count: 4, radius: 120 }, shout: '야근 인력 긴급 투입!' },
      { kind: 'ring', cooldown: 6, params: { bullets: 18, speed: 160, damage: 11 }, shout: '숫자로 말해! 숫자로!' },
      { kind: 'charge', cooldown: 8, params: { speed: 330, dur: 0.9, windup: 0.7 }, shout: '내 방으로 잠깐 와!' },
      { kind: 'slam', cooldown: 9, hpBelow: 0.7, params: { radius: 100, damage: 30, windup: 1.2 }, shout: '이게 보고서야?!' },
      { kind: 'wall', cooldown: 16, hpBelow: 0.5, params: { enemy: 'meeting', count: 20, radius: 200 }, shout: '긴급 회의 소집! 새벽 2시 전략 회의!' },
      { kind: 'enrage', cooldown: 1, hpBelow: 0.25, params: { speedMul: 1.4, cdMul: 0.65 }, shout: '오늘 아무도 집에 못 간다!!!' },
    ],
    intro: '본부장: 분기 숫자가 안 나오면 퇴근도 안 나온다.',
  },
];

// ───────────────────────────── 부서 회식 (dinner) ─────────────────────────────
const DINNER: EnemyDef[] = [
  {
    id: 'soju', name: '소주병', sprite: '🍶', tint: '#38a169',
    hp: 13, speed: 50, damage: 6, radius: 12, xp: 1,
    behavior: 'chase',
  },
  {
    id: 'beer', name: '생맥주', sprite: '🍺', tint: '#d69e2e',
    hp: 9, speed: 70, damage: 5, radius: 11, xp: 1,
    behavior: 'zigzag', params: { wobble: 30, freq: 1.8 },
    intro: '생맥주 500 추가요~ 비틀비틀 다가옵니다.',
  },
  {
    id: 'samgyup', name: '삼겹살', sprite: '🥓', tint: '#c05621',
    hp: 24, speed: 42, damage: 7, radius: 14, xp: 2, knockbackResist: 0.3,
    behavior: 'chase', split: { into: 'mini_meat', count: 3 },
    intro: '삼겹살을 자르면 고기 조각이 됩니다. 가위질은 막내 몫.',
  },
  {
    id: 'mini_meat', name: '고기 조각', sprite: '🍖', tint: '#9c4221',
    hp: 5, speed: 64, damage: 4, radius: 9, xp: 1,
    behavior: 'chase',
  },
  {
    id: 'mic', name: '노래방 마이크', sprite: '🎤', tint: '#d53f8c',
    hp: 14, speed: 50, damage: 6, radius: 12, xp: 1,
    behavior: 'ranged', params: { keep: 190, shotCd: 2.0, shotSpeed: 175, shotDamage: 7 },
    intro: '"다음 곡 예약했다~" 멀리서 음파가 날아옵니다.',
  },
  {
    id: 'tambourine', name: '탬버린', sprite: '🥁', tint: '#ecc94b',
    hp: 20, speed: 46, damage: 5, radius: 12, xp: 2,
    behavior: 'buffer', params: { buffCd: 4, buffRadius: 130, buffPct: 0.35, buffDur: 3 },
    intro: '탬버린이 흥을 돋웁니다! 주변 적이 빨라져요.',
  },
  {
    id: 'bombshot', name: '폭탄주', sprite: '💣', tint: '#2d3748',
    hp: 14, speed: 64, damage: 6, radius: 12, xp: 1,
    behavior: 'exploder', params: { fuseRange: 65, fuse: 0.75, blastRadius: 80, blastDamage: 15 },
    intro: '폭탄주 제조 완료! 가까이 오면 터집니다.',
  },
  {
    id: 'cheers', name: '건배 잔', sprite: '🥂', tint: '#faf089',
    hp: 16, speed: 55, damage: 8, radius: 12, xp: 1,
    behavior: 'dash', params: { dashRange: 200, dashSpeed: 340, dashDur: 0.5, dashCd: 2.6 },
    intro: '"짠~!" 잔을 부딪치러 돌진합니다.',
  },
  {
    id: 'hangover', name: '숙취', sprite: '🤢', tint: '#68d391',
    hp: 62, speed: 30, damage: 12, radius: 16, xp: 4, knockbackResist: 0.65, armor: 2,
    behavior: 'chase',
    intro: '숙취가 몰려온다... 아주 느리지만 아주 질기다.',
  },
  // 엘리트
  {
    id: 'grill', name: '불판', sprite: '♨️', tint: '#c53030',
    hp: 320, speed: 26, damage: 14, radius: 24, xp: 35, knockbackResist: 0.9, armor: 2,
    elite: true,
    behavior: 'spawner', params: { spawnCd: 3.2, spawnId: 'mini_meat', spawnCount: 3 },
    abilities: [
      { kind: 'hazard', cooldown: 8, params: { count: 2, radius: 45, dps: 10, dur: 4 }, shout: '치이익~ 불판 좀 갈아주세요!' },
    ],
    intro: '달궈진 불판! 고기가 끝없이 구워집니다.',
  },
  // 중간 보스
  {
    id: 'toast_master', name: '건배사 과장', sprite: '🥳', tint: '#b7791f',
    hp: 1700, speed: 52, damage: 23, radius: 42, xp: 80, knockbackResist: 1,
    boss: true, body: { suit: '#92400e', tie: '#facc15' },
    behavior: 'chase',
    abilities: [
      { kind: 'summon', cooldown: 7.5, params: { enemy: 'soju', count: 5, radius: 90 }, shout: '자~ 다들 잔 채우시고!' },
      { kind: 'ring', cooldown: 5.5, params: { bullets: 12, speed: 155, damage: 9 }, shout: '위하여~!!!' },
      { kind: 'charge', cooldown: 8, hpBelow: 0.7, params: { speed: 300, dur: 0.8, windup: 0.7 }, shout: '건배사 2절 들어갑니다!' },
      { kind: 'wall', cooldown: 16, hpBelow: 0.5, params: { enemy: 'beer', count: 16, radius: 175 }, shout: '전원 기립! 잔 들어!' },
      { kind: 'enrage', cooldown: 1, hpBelow: 0.3, params: { speedMul: 1.35, cdMul: 0.65 }, shout: '이제 2차 가야지~!' },
    ],
    intro: '건배사 과장: 건배사만 5분. 삼행시는 덤.',
  },
  // 최종 보스
  {
    id: 'bomb_bujang', name: '폭탄주 부장님', sprite: '🥴', tint: '#9b2c2c',
    hp: 42000, speed: 56, damage: 28, radius: 54, xp: 190, knockbackResist: 1,
    boss: true, body: { suit: '#1e3a8a', tie: '#dc2626' },
    behavior: 'chase',
    abilities: [
      { kind: 'summon', cooldown: 8.5, params: { enemy: 'bombshot', count: 5, radius: 120 }, shout: '폭탄주 제조 들어간다~ 말아!' },
      { kind: 'ring', cooldown: 5.5, params: { bullets: 20, speed: 165, damage: 12 }, shout: '내가 왕년에 말이야~' },
      { kind: 'charge', cooldown: 7.5, params: { speed: 340, dur: 1.0, windup: 0.7 }, shout: '어디 가! 아직 1차야!' },
      { kind: 'hazard', cooldown: 11, hpBelow: 0.7, params: { count: 5, radius: 60, dps: 14, dur: 6 }, shout: '아이고 흘렸네~ 괜찮아 괜찮아' },
      { kind: 'wall', cooldown: 15, hpBelow: 0.5, params: { enemy: 'soju', count: 20, radius: 200 }, shout: '전원 원샷! 잔 비우면 보내줄게!' },
      { kind: 'enrage', cooldown: 1, hpBelow: 0.25, params: { speedMul: 1.45, cdMul: 0.65 }, shout: '노래방 가자!!! 3차!!!' },
    ],
    intro: '폭탄주 부장님: "마지막 한 잔만!" (마지막 아님)',
  },
];

// ───────────────────────────── 명절 친척집 (holiday) ─────────────────────────────
// 말풍선 적: sprite는 '💬', label 문구를 말풍선으로 그린다(반지름을 조금 크게).
const HOLIDAY: EnemyDef[] = [
  {
    id: 'nag_job', name: '취업 잔소리', sprite: '💬', label: '취업은?', tint: '#4a5568',
    hp: 14, speed: 52, damage: 7, radius: 14, xp: 1,
    behavior: 'chase',
  },
  {
    id: 'nag_marry', name: '결혼 잔소리', sprite: '💬', label: '결혼은?', tint: '#d53f8c',
    hp: 13, speed: 60, damage: 7, radius: 14, xp: 1,
    behavior: 'zigzag', params: { wobble: 34, freq: 1.3 },
    intro: '"결혼은?" 이리저리 피해도 끈질기게 따라옵니다.',
  },
  {
    id: 'nag_weight', name: '몸무게 잔소리', sprite: '💬', label: '살쪘네?', tint: '#dd6b20',
    hp: 34, speed: 40, damage: 9, radius: 15, xp: 2, knockbackResist: 0.4,
    behavior: 'chase',
    intro: '"살쪘네?" 한마디가 묵직하게 꽂힙니다. (명절 음식 탓입니다)',
  },
  {
    id: 'nag_salary', name: '연봉 잔소리', sprite: '💬', label: '연봉은?', tint: '#2f855a',
    hp: 14, speed: 50, damage: 6, radius: 14, xp: 1,
    behavior: 'ranged', params: { keep: 200, shotCd: 2.4, shotSpeed: 170, shotDamage: 8 },
    intro: '"연봉은?" 멀리서 질문을 던집니다. 대답하면 지는 겁니다.',
  },
  {
    id: 'nag_kids', name: '2세 잔소리', sprite: '💬', label: '애는?', tint: '#805ad5',
    hp: 20, speed: 46, damage: 6, radius: 14, xp: 2,
    behavior: 'buffer', params: { buffCd: 4, buffRadius: 140, buffPct: 0.35, buffDur: 3 },
    intro: '"애는?" 이 한마디에 주변 잔소리가 가속됩니다!',
  },
  {
    id: 'songpyeon', name: '송편', sprite: '🥟', tint: '#9ae6b4',
    hp: 8, speed: 72, damage: 5, radius: 10, xp: 1,
    behavior: 'chase',
    intro: '송편 떼가 굴러옵니다. "더 먹어~ 더 먹어~"',
  },
  {
    id: 'jeon', name: '모둠전', sprite: '🍳', tint: '#d69e2e',
    hp: 64, speed: 30, damage: 12, radius: 17, xp: 4, knockbackResist: 0.65, armor: 2,
    behavior: 'chase',
    intro: '기름진 모둠전. 칼로리만큼 단단합니다.',
  },
  {
    id: 'cousin', name: '사촌동생', sprite: '🧒', tint: '#3182ce',
    hp: 15, speed: 60, damage: 8, radius: 11, xp: 1,
    behavior: 'dash', params: { dashRange: 200, dashSpeed: 350, dashDur: 0.5, dashCd: 2.4 },
    intro: '"폰 줘! 폰 줘!" 사촌동생이 돌진합니다!',
  },
  {
    id: 'dishes', name: '설거지 더미', sprite: '🍽️', tint: '#a0aec0',
    hp: 26, speed: 40, damage: 8, radius: 15, xp: 2, knockbackResist: 0.3,
    behavior: 'chase', split: { into: 'mini_dish', count: 4 },
    intro: '설거지는 끝나지 않는다. 깨면 접시가 쏟아집니다.',
  },
  {
    id: 'mini_dish', name: '접시', sprite: '🥣', tint: '#cbd5e0',
    hp: 6, speed: 64, damage: 4, radius: 9, xp: 1,
    behavior: 'chase',
  },
  {
    id: 'remote', name: 'TV 리모컨', sprite: '📺', tint: '#2d3748',
    hp: 15, speed: 50, damage: 6, radius: 12, xp: 1,
    behavior: 'ranged', params: { keep: 210, shotCd: 2.6, shotSpeed: 180, shotDamage: 8 },
    intro: '채널 쟁탈전 발발! 리모컨이 원거리에서 쏩니다.',
  },
  // 엘리트
  {
    id: 'gift', name: '선물세트', sprite: '🎁', tint: '#c53030',
    hp: 360, speed: 28, damage: 14, radius: 24, xp: 40, knockbackResist: 0.9, armor: 2, shield: 50,
    elite: true,
    behavior: 'spawner', params: { spawnCd: 3, spawnId: 'songpyeon', spawnCount: 3 },
    abilities: [
      { kind: 'aimed', cooldown: 6, params: { bullets: 5, spreadDeg: 50, speed: 170, damage: 9 }, shout: '참치 세트 대방출!' },
    ],
    intro: '명절 선물세트! 포장(보호막)부터 뜯어야 합니다. 송편이 쏟아져요.',
  },
  // 중간 보스
  {
    id: 'uncle', name: '삼촌', sprite: '🧔', tint: '#276749',
    hp: 1700, speed: 54, damage: 24, radius: 42, xp: 90, knockbackResist: 1,
    boss: true, body: { suit: '#166534', tie: '#fde047' },
    behavior: 'chase',
    abilities: [
      { kind: 'summon', cooldown: 8, params: { enemy: 'cousin', count: 4, radius: 100 }, shout: '얘들아~ 저기 형아랑 놀아라!' },
      { kind: 'aimed', cooldown: 5, params: { bullets: 5, spreadDeg: 45, speed: 200, damage: 10 }, shout: '삼촌이 다 너 잘되라고 하는 말이야' },
      { kind: 'slam', cooldown: 8, hpBelow: 0.7, params: { radius: 85, damage: 26, windup: 1.05 }, shout: '허허, 많이 컸네! (등짝 토닥)' },
      { kind: 'wall', cooldown: 16, hpBelow: 0.5, params: { enemy: 'nag_job', count: 16, radius: 175 }, shout: '친척 전원 집합! 근황 토크 시작!' },
      { kind: 'enrage', cooldown: 1, hpBelow: 0.3, params: { speedMul: 1.35, cdMul: 0.65 }, shout: '삼촌 때는 말이다...!' },
    ],
    intro: '삼촌: 주식·코인·부동산 조언을 무료로 제공합니다(원치 않아도).',
  },
  // 최종 보스
  {
    id: 'big_aunt', name: '큰이모', sprite: '🧓', tint: '#97266d',
    hp: 42000, speed: 58, damage: 30, radius: 56, xp: 210, knockbackResist: 1,
    boss: true, body: { suit: '#9d174d', tie: '#fbbf24' },
    behavior: 'chase',
    abilities: [
      { kind: 'summon', cooldown: 7.5, params: { enemy: 'songpyeon', count: 8, radius: 110 }, shout: '밥은 먹고 다니니? 더 먹어, 더!' },
      { kind: 'ring', cooldown: 5.5, params: { bullets: 18, speed: 170, damage: 12 }, shout: '너 그러다 큰일 난다~' },
      { kind: 'aimed', cooldown: 6.5, params: { bullets: 5, spreadDeg: 50, speed: 210, damage: 11 }, shout: '옆집 애는 대기업 갔다더라' },
      { kind: 'hazard', cooldown: 11, hpBelow: 0.7, params: { count: 5, radius: 60, dps: 15, dur: 6 }, shout: '기름 튄다! 전 부칠 땐 저리 가 있어!' },
      { kind: 'wall', cooldown: 15, hpBelow: 0.5, params: { enemy: 'nag_marry', count: 20, radius: 200 }, shout: '온 가족 소집! 다 같이 한마디씩!' },
      { kind: 'enrage', cooldown: 1, hpBelow: 0.25, params: { speedMul: 1.35, cdMul: 0.65 }, shout: '이모가 다 너 잘되라고 그러는 거야!!!' },
    ],
    intro: '큰이모: 명절 잔소리 세계 챔피언. 사랑이 너무 넘치십니다.',
  },
];

export const ENEMIES: EnemyDef[] = [...COMMON, ...OFFICE, ...CRUNCH, ...DINNER, ...HOLIDAY];
