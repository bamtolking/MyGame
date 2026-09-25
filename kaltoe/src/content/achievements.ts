// ─────────────────────────────────────────────────────────────────────────────
// 업적 = 해금 연쇄(중독 루프의 척추). 66개 = 해금 33 + 코인 33.
//
// ■ 지표 해석(엔진 진행도 추적과 맞출 것). '누적' = 모든 판 합계, '최고' = 한 판 최고 기록.
//   totalKills 누적 처치 · runKills 한 판 최고 처치 · surviveSec 한 판 최고 생존 초(w.t)
//   clearStage(stage) 그 스테이지 칼퇴 누적 횟수 · clearWithChar(char) 그 캐릭터로 칼퇴 누적 횟수
//   reachLevel 한 판 최고 레벨 · charLevel(char) 그 캐릭터 한 판 최고 레벨
//   totalEvolves 누적 진화 · evolveWeapon(진화 무기 id) 그 진화 누적 횟수 · weaponMax(무기) 최대 레벨 도달 누적
//   totalBossKills 누적 보스 처치 · bossKill(보스 id) 그 보스 누적 처치 · totalCoins 누적 획득 월급
//   ultUses 누적 궁극기 · runsPlayed 누적 판 수(사망·포기 포함) · heatClear 칼퇴한 최고 야근 강도
//   dailyClears 오늘의 업무 누적 칼퇴 · attendanceDays 누적 출석 일수 · lunchPick(점심) 누적 선택
//   overtimeSec 야근 모드 한 판 최고 초 · noHitSec 한 판 최장 무피격 초 · chestsOpened 누적 상자
//   weaponKills(무기) 그 무기 누적 처치(진화 후 처치는 진화 무기 id로 집계됨) · metaRanks 복지 누적 구매 단계
//   lowHpClear 체력 10% 이하로 칼퇴한 누적 횟수 · runCoins 한 판 최고 월급 · pickupItem(아이템) 누적 획득
//
// ■ 해금 연쇄 설계 (김신입, 첫 판 2~4분 사망 기준 예상 시점) — 2차 개정
//   1판차   : 첫 출근(+100) · 레이저 포인터(누적 300) · 사내 인맥(첫 상자) · 참치김밥(12:00 생존)
//             + 코인 업적 2~4개(첫 궁극기·1,000 처치 등) → 첫 판 끝나자마자 복지 2~3개 구매 가능
//   2~4판   : 오늘의 업무(3판) · 토너 폭탄(팀장님) · 자기계발서(Lv20) · 이개발(단축키 번개 1,000) · 종이비행기(Lv30)
//   3~6판   : 포스트잇(첫 진화) · 첫 칼퇴 → 분기 마감 · 실손 보험(5판) · 열정 페이(한 판 5,000) · 법인카드(한 판 월급 300)
//   6~12판  : 야근 모드(부장님 2회 — 해금 직후 칼퇴에서 바로 쓴다) · 야근 강도(보스 누적 10) · 주식 앱 · 키보드(누적 2.5만)
//             · 최디자 · 정인턴(출석 3일) · 도시락/버거/초밥 · 반려 도장 · 팩트 폭격 · 사직서 상비
//   10~20판 : 사내 드론(야근 2분) · 부서 회식(분기 마감 칼퇴) · 윤팀장(보스 누적 20) · 퇴근 알람(강도 1 칼퇴)
//   20~30판 : 한과장(누적 월급 1만) · 인턴 채용(복지 30단계) · 명절 친척집(회식 칼퇴)
//   30판+   : ??? 낙하산(숨김: 강도 5 칼퇴) · 강도 10 · 복지 만렙 · 누적 25만 처치
// ■ 처치 수 기준: 칼퇴하는 판은 실측 9~14k 처치(엔진의 최소 생존 수 보충 때문에 브리프 목표 3,800의 약 3배).
//   엔진 보충식이 max(4, rate)로 바뀌어 한 판 ≈ 6k가 되면 되돌릴 값: 키보드 1만 · 6만→3만 · 25만→10만 · 열정 2,500 · 일당만→5,000
// ─────────────────────────────────────────────────────────────────────────────
import type { AchievementDef } from './types';

export const ACHIEVEMENTS: AchievementDef[] = [
  // ═══════════════════════════ 1판차: 첫 출근 ═══════════════════════════
  {
    id: 'a_first_run', name: '첫 출근', icon: '👔',
    desc: '첫 근무(한 판)를 마친다. 조퇴해도 월급은 나온다',
    metric: 'runsPlayed', target: 1, reward: { kind: 'coins', amount: 100 },
  },
  {
    id: 'u_weapon_laser', name: '일 좀 해볼까', icon: '🔴',
    desc: '누적 업무 300건 처리(적 300 처치)',
    metric: 'totalKills', target: 300, reward: { kind: 'weapon', id: 'laser' },
  },
  {
    id: 'u_passive_clover', name: '사내 인맥 개척', icon: '🍀',
    desc: '상자를 처음 연다. 엘리트를 잡으면 떨어진다',
    metric: 'chestsOpened', target: 1, reward: { kind: 'passive', id: 'clover' },
  },
  {
    id: 'u_lunch_gimbap', name: '점심시간 사수', icon: '🍙',
    desc: '12:00(200초)까지 살아남는다. 밥은 먹고 일해야죠',
    metric: 'surviveSec', target: 200, reward: { kind: 'lunch', id: 'gimbap' },
  },
  {
    id: 'a_first_ult', name: '저 오늘부로…', icon: '📨',
    desc: '궁극기를 처음 사용한다. (진짜 내진 않았다)',
    metric: 'ultUses', target: 1, reward: { kind: 'coins', amount: 50 },
  },
  {
    id: 'a_kills_1k', name: '업무 처리 1,000건', icon: '📥',
    desc: '누적 1,000 처치',
    metric: 'totalKills', target: 1000, reward: { kind: 'coins', amount: 100 },
  },
  {
    id: 'a_run_kills_1k', name: '오늘 할 일 끝', icon: '✅',
    desc: '한 판에서 1,000 처치',
    metric: 'runKills', target: 1000, reward: { kind: 'coins', amount: 100 },
  },
  {
    id: 'a_meta_first', name: '복지 첫 신청', icon: '🧾',
    desc: '복지 제도를 처음으로 1단계 구매한다',
    metric: 'metaRanks', target: 1, reward: { kind: 'coins', amount: 50 },
  },

  // ═══════════════════════════ 2~4판: 적응기 ═══════════════════════════
  {
    id: 'u_feature_daily', name: '수습 3일차', icon: '📋',
    desc: '누적 3판 플레이. 오늘의 업무가 도착했습니다! 매일 바뀌는 특별 근무에 도전하세요',
    metric: 'runsPlayed', target: 3, reward: { kind: 'feature', id: 'daily' },
  },
  {
    id: 'u_weapon_toner', name: '팀장님 결재 통과', icon: '🖨️',
    desc: '팀장님을 처음으로 퇴치한다',
    metric: 'bossKill', param: 'team_lead', target: 1, reward: { kind: 'weapon', id: 'toner' },
  },
  {
    id: 'u_passive_selfhelp', name: '자기계발의 시작', icon: '📚',
    desc: '한 판에서 레벨 20 달성',
    metric: 'reachLevel', target: 20, reward: { kind: 'passive', id: 'selfhelp' },
  },
  {
    id: 'u_character_lee', name: '야근 전문가 섭외', icon: '💻',
    desc: '단축키 번개로 누적 1,000 처치. 소문을 들은 개발자가 합류한다',
    metric: 'weaponKills', param: 'ctrlz', target: 1000, reward: { kind: 'character', id: 'lee' },
  },
  {
    id: 'u_weapon_plane', name: '보고서 날리기', icon: '✈️',
    desc: '한 판에서 레벨 30 달성',
    metric: 'reachLevel', target: 30, reward: { kind: 'weapon', id: 'plane' },
  },
  {
    id: 'a_survive_400', name: '오후 3시의 기적', icon: '☀️',
    desc: '15:00(400초)까지 살아남는다',
    metric: 'surviveSec', target: 400, reward: { kind: 'coins', amount: 150 },
  },
  {
    id: 'a_max_pen', name: '볼펜 장인', icon: '🖊️',
    desc: '볼펜 투척을 최대 레벨까지 올린다',
    metric: 'weaponMax', param: 'pen', target: 1, reward: { kind: 'coins', amount: 100 },
  },

  // ═══════════════════════════ 3~6판: 첫 칼퇴 ═══════════════════════════
  {
    id: 'u_weapon_postit', name: '첫 진화', icon: '🗒️',
    desc: '무기를 처음으로 진화시킨다(최대 레벨 무기 + 짝 패시브 → 상자)',
    metric: 'totalEvolves', target: 1, reward: { kind: 'weapon', id: 'postit' },
  },
  {
    id: 'u_stage_crunch', name: '첫 칼퇴', icon: '🌇',
    desc: '월요일 사무실에서 18:00 칼퇴 성공',
    metric: 'clearStage', param: 'office', target: 1, reward: { kind: 'stage', id: 'crunch' },
  },
  {
    id: 'u_feature_overtime', name: '부장님 퇴근시키기', icon: '😤',
    desc: '부장님을 2번 퇴근시킨다. 이제 칼퇴 후 야근 모드를 고를 수 있다',
    metric: 'bossKill', param: 'bujang', target: 2, reward: { kind: 'feature', id: 'overtime' },
  },
  {
    id: 'u_feature_heat', name: '상사 응대의 달인', icon: '🥊',
    desc: '상사(보스) 누적 10회 퇴치. 야근 강도(난이도) 선택이 열린다',
    metric: 'totalBossKills', target: 10, reward: { kind: 'feature', id: 'heat' },
  },
  {
    id: 'u_meta_insurance', name: '수습 기간 종료', icon: '☂️',
    desc: '누적 5판 플레이. 4대 보험 가입 완료 — 복지 [실손 보험] 해금',
    metric: 'runsPlayed', target: 5, reward: { kind: 'meta', id: 'insurance' },
  },
  {
    id: 'u_passive_passion', name: '열정 과다', icon: '🔥',
    desc: '한 판에서 5,000 처치',
    metric: 'runKills', target: 5000, reward: { kind: 'passive', id: 'passion' },
  },
  {
    id: 'u_weapon_card', name: '법카 발급', icon: '💳',
    desc: '한 판에서 업무 중 월급 300 코인을 줍는다 (칼퇴·오늘의 업무 보너스 제외)',
    metric: 'runCoins', target: 300, reward: { kind: 'weapon', id: 'card' },
  },
  {
    id: 'a_evo_fountain', name: '만년필 폭풍', icon: '✒️',
    desc: '볼펜 투척을 진화시킨다 (힌트: 🤹)',
    metric: 'evolveWeapon', param: 'fountain_storm', target: 1, reward: { kind: 'coins', amount: 200 },
  },
  {
    id: 'a_lowhp_clear', name: '구사일생', icon: '🩹',
    desc: '체력 10% 이하로 칼퇴한다. 퇴근길 발걸음이 휘청',
    metric: 'lowHpClear', target: 1, reward: { kind: 'coins', amount: 300 },
  },

  // ═══════════════════════════ 6~12판: 빌드 실험기 ═══════════════════════════
  {
    id: 'u_passive_stocks', name: '월급 모으는 재미', icon: '📈',
    desc: '누적 월급 2,000 코인',
    metric: 'totalCoins', target: 2000, reward: { kind: 'passive', id: 'stocks' },
  },
  {
    id: 'u_weapon_keyboard', name: '엔터 2만 5천 번', icon: '⌨️',
    desc: '누적 25,000 처치',
    metric: 'totalKills', target: 25000, reward: { kind: 'weapon', id: 'keyboard' },
  },
  {
    id: 'u_character_choi', name: '레이저 포인터 장인', icon: '🎨',
    desc: '레이저 포인터로 누적 1,500 처치. 발표 자료를 만든 디자이너가 합류한다',
    metric: 'weaponKills', param: 'laser', target: 1500, reward: { kind: 'character', id: 'choi' },
  },
  {
    id: 'u_character_jung', name: '인턴 면접 합격', icon: '🌱',
    desc: '출석 체크 누적 3일(매일 첫 접속 시 자동). 열정 가득 인턴이 첫 출근한다',
    metric: 'attendanceDays', target: 3, reward: { kind: 'character', id: 'jung' },
  },
  {
    id: 'u_lunch_dosirak', name: '김밥 마니아', icon: '🍱',
    desc: '점심으로 참치김밥을 누적 3번 고른다. 편의점이 눈에 들어오기 시작했다',
    metric: 'lunchPick', param: 'gimbap', target: 3, reward: { kind: 'lunch', id: 'dosirak' },
  },
  {
    id: 'u_lunch_burger', name: '돈까스는 진리', icon: '🍔',
    desc: '점심으로 왕돈까스를 누적 3번 고른다',
    metric: 'lunchPick', param: 'donkatsu', target: 3, reward: { kind: 'lunch', id: 'burger' },
  },
  {
    id: 'u_lunch_sushi', name: '돌고 도는 인생', icon: '🍣',
    desc: '상자를 누적 25개 연다. 슬롯도 회전, 초밥도 회전',
    metric: 'chestsOpened', target: 25, reward: { kind: 'lunch', id: 'sushi' },
  },
  {
    id: 'u_meta_stamp', name: '결재 라인 파악', icon: '⛔',
    desc: '무기를 누적 3회 진화시킨다 — 복지 [반려 도장] 해금',
    metric: 'totalEvolves', target: 3, reward: { kind: 'meta', id: 'stamp' },
  },
  {
    id: 'u_meta_factbomb', name: '무결점 보고서', icon: '🎯',
    desc: '한 판에서 60초 동안 한 대도 안 맞는다 — 복지 [팩트 폭격 교육] 해금',
    metric: 'noHitSec', target: 60, reward: { kind: 'meta', id: 'factbomb' },
  },
  {
    id: 'u_meta_resign', name: '사직서는 늘 가슴에', icon: '✉️',
    desc: '궁극기를 누적 20회 사용한다 — 복지 [사직서 상비] 해금',
    metric: 'ultUses', target: 20, reward: { kind: 'meta', id: 'resign' },
  },
  {
    id: 'a_boss_pm', name: 'PM 설득 성공', icon: '🙄',
    desc: 'PM을 처음으로 퇴치한다. "그건 다음 스프린트에…"',
    metric: 'bossKill', param: 'pm', target: 1, reward: { kind: 'coins', amount: 200 },
  },
  {
    id: 'a_kills_30k', name: '업무 처리 6만 건', icon: '🗃️',
    desc: '누적 60,000 처치',
    metric: 'totalKills', target: 60000, reward: { kind: 'coins', amount: 500 },
  },
  {
    id: 'a_level_40', name: '고인물 사원', icon: '⭐',
    desc: '한 판에서 레벨 40 달성',
    metric: 'reachLevel', target: 40, reward: { kind: 'coins', amount: 200 },
  },
  {
    id: 'a_clear_park', name: '커피 수혈 칼퇴', icon: '🥤',
    desc: '박대리로 칼퇴한다. 오늘 마신 커피 다섯 잔',
    metric: 'clearWithChar', param: 'park', target: 1, reward: { kind: 'coins', amount: 200 },
  },
  {
    id: 'a_chicken_10', name: '치킨은 살 안 쪄요', icon: '🍗',
    desc: '치킨을 누적 10마리 먹는다(체력 전부 회복 아이템)',
    metric: 'pickupItem', param: 'chicken', target: 10, reward: { kind: 'coins', amount: 150 },
  },
  {
    id: 'a_jjajang', name: '짜장면 시키신 분?', icon: '🥢',
    desc: '점심으로 짜장면을 고른다. 역시 사무실엔 짜장면',
    metric: 'lunchPick', param: 'jjajang', target: 1, reward: { kind: 'coins', amount: 50 }, hidden: true,
  },
  {
    id: 'a_daily_1', name: '오늘의 업무 완료', icon: '📋',
    desc: '오늘의 업무(일일 도전)에서 칼퇴한다',
    metric: 'dailyClears', target: 1, reward: { kind: 'coins', amount: 150 },
  },
  {
    id: 'a_attend_7', name: '개근상', icon: '🏅',
    desc: '출석 체크 누적 7일',
    metric: 'attendanceDays', target: 7, reward: { kind: 'coins', amount: 300 },
  },

  // ═══════════════════════════ 10~20판: 새 부서 ═══════════════════════════
  {
    id: 'u_weapon_drone', name: '야근 감시 체제', icon: '🛸',
    desc: '야근 모드에서 2분(120초) 버틴다',
    metric: 'overtimeSec', target: 120, reward: { kind: 'weapon', id: 'drone' },
  },
  {
    id: 'u_stage_dinner', name: '분기 마감 생존', icon: '🌃',
    desc: '분기 마감 야근에서 칼퇴 성공. 부장님이 "오늘 회식이다!"를 외친다',
    metric: 'clearStage', param: 'crunch', target: 1, reward: { kind: 'stage', id: 'dinner' },
  },
  {
    id: 'u_character_yoon', name: '팀장 승진 심사', icon: '🎖️',
    desc: '상사(보스)를 누적 20회 퇴치한다. 이길 수 없다면… 팀장이 되어라.',
    metric: 'totalBossKills', target: 20, reward: { kind: 'character', id: 'yoon' },
  },
  {
    id: 'u_weapon_alarm', name: '칼퇴는 권리', icon: '⏰',
    desc: '야근 강도 1 이상으로 칼퇴한다',
    metric: 'heatClear', target: 1, reward: { kind: 'weapon', id: 'alarm' },
  },
  {
    id: 'a_evolve_10', name: '진화 전문가', icon: '🧬',
    desc: '무기를 누적 10회 진화시킨다',
    metric: 'totalEvolves', target: 10, reward: { kind: 'coins', amount: 300 },
  },
  {
    id: 'a_boss_toast', name: '건배사 끊기', icon: '🥳',
    desc: '건배사 과장을 처음으로 퇴치한다. "짧게 하겠습니다"는 거짓말이었다',
    metric: 'bossKill', param: 'toast_master', target: 1, reward: { kind: 'coins', amount: 250 },
  },
  {
    id: 'a_heat_3', name: '야근이 체질', icon: '🦉',
    desc: '야근 강도 3 이상으로 칼퇴한다',
    metric: 'heatClear', target: 3, reward: { kind: 'coins', amount: 400 },
  },
  {
    id: 'a_nohit_120', name: '투명 인간', icon: '🕶️',
    desc: '한 판에서 120초 동안 한 대도 안 맞는다. 아무도 나를 찾지 않는다',
    metric: 'noHitSec', target: 120, reward: { kind: 'coins', amount: 300 },
  },
  {
    id: 'a_run_coins_800', name: '월급 루팡', icon: '🤑',
    desc: '한 판에서 업무 중 월급 800 코인을 줍는다 (보너스 제외)',
    metric: 'runCoins', target: 800, reward: { kind: 'coins', amount: 400 },
  },
  {
    id: 'a_overtime_300', name: '야근 5분… 아니 5시간', icon: '🥱',
    desc: '야근 모드에서 5분(300초) 버틴다',
    metric: 'overtimeSec', target: 300, reward: { kind: 'coins', amount: 500 },
  },
  {
    id: 'a_daily_10', name: '성실 근무자', icon: '🗓️',
    desc: '오늘의 업무에서 누적 10회 칼퇴한다',
    metric: 'dailyClears', target: 10, reward: { kind: 'coins', amount: 600 },
  },

  // ═══════════════════════════ 20~30판: 베테랑 ═══════════════════════════
  {
    id: 'u_character_han', name: '법카의 달인 스카우트', icon: '💼',
    desc: '누적 월급 10,000 코인. 돈 냄새를 맡은 과장님이 합류한다',
    metric: 'totalCoins', target: 10000, reward: { kind: 'character', id: 'han' },
  },
  {
    id: 'u_meta_intern', name: '회사가 커졌다', icon: '🐣',
    desc: '복지를 누적 30단계 구매한다 — 복지 [인턴 채용] 해금',
    metric: 'metaRanks', target: 30, reward: { kind: 'meta', id: 'intern' },
  },
  {
    id: 'u_stage_holiday', name: '회식 생존자', icon: '🏮',
    desc: '부서 회식에서 칼퇴(?) 성공. 그리고 명절이 다가왔다',
    metric: 'clearStage', param: 'dinner', target: 1, reward: { kind: 'stage', id: 'holiday' },
  },
  {
    id: 'a_evo_bell', name: '6시 정각 종소리', icon: '🔔',
    desc: '퇴근 알람을 진화시킨다 (힌트: 📚)',
    metric: 'evolveWeapon', param: 'clockout_bell', target: 1, reward: { kind: 'coins', amount: 300 },
  },
  {
    id: 'a_lee_50', name: '풀스택 야근러', icon: '🖥️',
    desc: '이개발로 한 판에서 레벨 50 달성',
    metric: 'charLevel', param: 'lee', target: 50, reward: { kind: 'coins', amount: 300 },
  },
  {
    id: 'a_run_kills_5k', name: '일당만', icon: '💯',
    desc: '한 판에서 10,000 처치',
    metric: 'runKills', target: 10000, reward: { kind: 'coins', amount: 500 },
  },
  {
    id: 'a_runs_30', name: '한 달 근속', icon: '📅',
    desc: '누적 30판 플레이',
    metric: 'runsPlayed', target: 30, reward: { kind: 'coins', amount: 500 },
  },

  // ═══════════════════════════ 30판+: 전설의 직장인 ═══════════════════════════
  {
    id: 'u_character_nakha', name: '낙하산 투하', icon: '🪂',
    desc: '야근 강도 5 이상으로 칼퇴한다… 그러자 누군가 조용히 입사했다. "아버지가 여기 사장이셔"',
    metric: 'heatClear', target: 5, reward: { kind: 'character', id: 'nakha' }, hidden: true,
  },
  {
    id: 'a_boss_big_aunt', name: '잔소리 완전 정복', icon: '🧓',
    desc: '큰이모의 잔소리 폭격을 끝까지 이겨낸다. "취업은? 결혼은?"에 드디어 답했다',
    metric: 'bossKill', param: 'big_aunt', target: 1, reward: { kind: 'coins', amount: 1000 },
  },
  {
    id: 'a_heat_10', name: '무한 야근 생존자', icon: '♾️',
    desc: '야근 강도 10으로 칼퇴한다. 전설로 남을 퇴근',
    metric: 'heatClear', target: 10, reward: { kind: 'coins', amount: 1000 }, hidden: true,
  },
  {
    id: 'a_attend_30', name: '출석왕', icon: '👑',
    desc: '출석 체크 누적 30일',
    metric: 'attendanceDays', target: 30, reward: { kind: 'coins', amount: 1000 },
  },
  {
    id: 'a_kills_100k', name: '업무의 신', icon: '🏆',
    desc: '누적 250,000 처치',
    metric: 'totalKills', target: 250000, reward: { kind: 'coins', amount: 1000 },
  },
  {
    // META_UPGRADES maxRank 합계(82)와 맞출 것
    id: 'a_meta_all', name: '신의 직장', icon: '🏰',
    desc: '모든 복지 제도를 만렙(82단계)까지 올린다',
    metric: 'metaRanks', target: 82, reward: { kind: 'coins', amount: 1000 },
  },
];
