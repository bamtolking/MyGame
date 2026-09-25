// ─────────────────────────────────────────────────────────────────────────────
// 스테이지 4종 — 칼퇴 서바이버
//
// 게임 시계: 600초 = 09:00→18:00 (1시간 ≈ 66.7초)
//   10:00=67s  11:00=133s  11:30=167s(중간 보스)  12:00=200s(점심)  13:00=267s
//   14:00=333s  15:00=400s  16:00=467s  17:00=533s(최종 보스)  17:30=567s  18:00=600s
//
// 모든 스테이지가 같은 '하루 일과표(DAY)'를 쓴다: 구간 경계·소환 속도·최소 생존 수·체력 배율 곡선.
// 스테이지마다 다른 것 = 소환 풀(적 구성, 13종 풀을 DAY 구간이 인덱스로 참조), 이벤트, rateMul, 스테이지 hpMul/coinMul.
//
// ■ 2차 개정(헤드리스 봇 측정 반영)
//  - 초반(0~230초) 체력 배율·소환 속도를 낮췄다: 무투자 봇 6판 중 5판이 143~320초에 사망(12:00 Lv 8~9)하던 구간.
//  - 11:15~11:30(150~167초) '폭풍 전 고요' 구간을 넣어 중간 보스 등장이 또렷하게 읽히게 했다(185초 떼 이벤트 삭제).
//  - 15:00 '탕비실 타임'(400~415초)·16:48 '폭풍 전야'(520~533초) 숨 고르기 구간 추가 → 오후에도 긴장·이완이 약 60초 주기.
//  - 후반 체력 배율을 올렸다(600초 10 → 14): 엔진의 최소 생존 수 보충(초당 max(8, 2×rate))이 강한 빌드에겐 명목 소환의
//    3배 유입을 만들어 처치 수가 브리프 목표의 2~3배로 폭주했다. 후반 적이 조금 더 버티게 해 화면 밀도를 유지한다.
//    (엔진 보충식이 max(4, rate)로 바뀌면 565~600 구간 끝 배율을 12 정도로 되돌려도 된다.)
//  - 명절 친척집 스테이지 배율 2.1 → 1.8, 소환 ×1.15 → ×1.1: 초반 체력 유입이 사무실의 2.6배라 복지 ₩30k 봇도 0/6이었다.
//
// 목표(office, 보통 빌드): 처치 100초 ≈ 350 / 200초 ≈ 1,000 / 400초 ≈ 3,000 / 600초 ≈ 6,000
//   (실측: 칼퇴하는 빌드는 엔진 보충 때문에 400초 ≈ 5k / 600초 ≈ 11k — 경험치 곡선 후반 가속으로 레벨 폭주만 막았다)
//   동시 적(minAlive 하한) 초반 10~40 / 중반 80~150 / 후반 160~210 (강한 빌드는 처치 속도 때문에 30~170)
//   구간 hpMul 0초 1.0 → 200초 2.0 → 400초 5.0 → 533초 9.5 → 600초 14
// 엘리트 7회 + 중간 보스 + 최종 보스 = 상자 9개 → 진화 2~4회가 현실적.
// 이벤트 시각은 스테이지마다 5~15초씩 어긋나게 두어(정시 메시지·보스 제외) 대본이 외워지지 않게 한다.
// ─────────────────────────────────────────────────────────────────────────────
import type { SpawnEntry, SpawnSegment, StageDef } from './types';

interface DaySlot {
  from: number; to: number;
  /** 스테이지 풀(13종) 중 몇 번째를 쓸지 */
  p: number;
  rate: number; rateEnd: number;
  minAlive: number;
  hpMul: number; hpMulEnd: number;
}

/** 하루 일과표. 16구간, 0~600초를 빈틈없이 덮는다. p = 스테이지 풀 인덱스(0~12). */
const DAY: readonly DaySlot[] = [
  { from: 0,   to: 30,  p: 0,  rate: 1.4, rateEnd: 2.2, minAlive: 10,  hpMul: 1.0,  hpMulEnd: 1.1 },  // 09:00 출근
  { from: 30,  to: 70,  p: 1,  rate: 2.2, rateEnd: 3.2, minAlive: 20,  hpMul: 1.1,  hpMulEnd: 1.3 },  // 09:27 메일 확인
  { from: 70,  to: 110, p: 2,  rate: 2.8, rateEnd: 3.6, minAlive: 32,  hpMul: 1.3,  hpMulEnd: 1.5 },  // 10:03 주간 회의
  { from: 110, to: 150, p: 3,  rate: 3.6, rateEnd: 4.4, minAlive: 40,  hpMul: 1.5,  hpMulEnd: 1.7 },  // 10:39 오전 러시
  { from: 150, to: 167, p: 3,  rate: 3.0, rateEnd: 3.0, minAlive: 30,  hpMul: 1.7,  hpMulEnd: 1.75 }, // 11:15 폭풍 전 고요(보스 등장 예고)
  { from: 167, to: 200, p: 4,  rate: 3.2, rateEnd: 3.6, minAlive: 35,  hpMul: 1.75, hpMulEnd: 2.0 },  // 11:30 중간 보스전
  { from: 200, to: 230, p: 5,  rate: 1.5, rateEnd: 2.5, minAlive: 15,  hpMul: 2.0,  hpMulEnd: 2.3 },  // 12:00 점심 직후 식곤증 휴식
  { from: 230, to: 280, p: 6,  rate: 5.2, rateEnd: 6.2, minAlive: 80,  hpMul: 2.3,  hpMulEnd: 3.0 },  // 12:27 오후 업무 폭탄
  { from: 280, to: 340, p: 7,  rate: 6.2, rateEnd: 7.2, minAlive: 110, hpMul: 3.0,  hpMulEnd: 3.9 },  // 13:12
  { from: 340, to: 400, p: 8,  rate: 7.2, rateEnd: 7.8, minAlive: 150, hpMul: 3.9,  hpMulEnd: 5.0 },  // 14:06
  { from: 400, to: 415, p: 9,  rate: 4.0, rateEnd: 4.0, minAlive: 100, hpMul: 5.0,  hpMulEnd: 5.5 },  // 15:00 탕비실 타임(숨 고르기)
  { from: 415, to: 460, p: 9,  rate: 7.5, rateEnd: 8.5, minAlive: 160, hpMul: 5.5,  hpMulEnd: 7.0 },  // 15:13
  { from: 460, to: 520, p: 10, rate: 8.5, rateEnd: 9.0, minAlive: 190, hpMul: 7.0,  hpMulEnd: 9.1 },  // 15:54 퇴근 전 몰아치기
  { from: 520, to: 533, p: 10, rate: 4.0, rateEnd: 4.0, minAlive: 120, hpMul: 9.1,  hpMulEnd: 9.5 },  // 16:48 폭풍 전야(보스 직전 정적)
  { from: 533, to: 565, p: 11, rate: 5.5, rateEnd: 6.5, minAlive: 160, hpMul: 9.5,  hpMulEnd: 10.5 }, // 17:00 최종 보스전(보스에 집중)
  { from: 565, to: 600, p: 12, rate: 8.0, rateEnd: 9.5, minAlive: 210, hpMul: 10.5, hpMulEnd: 14 },   // 17:28 퇴근 직전 총력전
];

/** 풀 축약 표기: { memo: 6, spam: 3 } → SpawnEntry[] */
type Pool = Readonly<Record<string, number>>;

const r2 = (n: number) => Math.round(n * 100) / 100;

function pool(p: Pool): SpawnEntry[] {
  return Object.entries(p).map(([enemy, weight]) => ({ enemy, weight }));
}

/** DAY 구간에 스테이지별 풀(13개)을 입힌다. rateMul은 소환 속도·최소 생존 수에 곱한다. */
function timeline(pools: readonly Pool[], rateMul = 1): SpawnSegment[] {
  return DAY.map(s => ({
    from: s.from,
    to: s.to,
    pool: pool(pools[Math.min(s.p, pools.length - 1)]),
    rate: r2(s.rate * rateMul),
    rateEnd: r2(s.rateEnd * rateMul),
    minAlive: Math.round(s.minAlive * rateMul),
    hpMul: s.hpMul,
    hpMulEnd: s.hpMulEnd,
  }));
}

/**
 * 엘리트 이벤트 체력 배율(구간 배율 대신 쓰인다).
 * 초반 둘은 그 시점 구간 배율 수준(첫 상자가 확실히 나오게), 이후는 구간 배율의 약 1.4~1.6배(후반 엘리트도 몇 초는 버티도록).
 *   e1 ≈ 85~95초 · e2 ≈ 140~150초 · e3 ≈ 245~260초 · e4 ≈ 315~330초 · e5 ≈ 385~395초 · e6 ≈ 455~465초 · e7 ≈ 500~510초
 */
const ELITE_HP = { e1: 1.2, e2: 1.7, e3: 3.6, e4: 5.2, e5: 7.5, e6: 10.5, e7: 13.5 } as const;
/**
 * 보스 이벤트 체력 배율 = 1. 엔진은 보스에 구간/이벤트 배율을 곱하지 않고 enemies.ts의 hp를 절대 체력으로 쓴다.
 * 스키마 기본값(= 현재 구간 배율)이 끼어들지 않도록 1로 명시.
 */
const MID_BOSS_HP = 1;
const FINAL_BOSS_HP = 1;

// ───────────────────────────── 월요일 사무실 ─────────────────────────────
const OFFICE: StageDef = {
  id: 'office',
  name: '월요일 사무실',
  subtitle: '메일 폭탄 주의',
  desc: '평범한 월요일. 메일은 쌓이고 전화는 울리고, 부장님은 17시에 뭔가를 들고 오신다. 오늘은 반드시 칼퇴한다.',
  icon: '🏢',
  palette: { floor: '#1c2430', floorAlt: '#212b39', line: '#34425a', accent: '#3de0ff', fog: '#050a14' },
  decor: ['📌', '🗑️', '💼', '📚', '🔌', '🧻'],
  timeline: timeline([
    { memo: 10, spam: 3 },                                                              // 0-30
    { memo: 8, spam: 4, phone: 2 },                                                     // 30-70
    { memo: 7, spam: 4, phone: 3, deadline: 2, chat: 1 },                               // 70-110
    { memo: 6, spam: 3, phone: 3, deadline: 3, chat: 2, kpi: 1, binder: 1 },            // 110-167
    { memo: 6, spam: 3, phone: 2, deadline: 3, chat: 2, kpi: 1 },                       // 167-200 팀장님
    { memo: 6, spam: 4, kpi: 1 },                                                       // 200-230 휴식
    { memo: 5, spam: 3, phone: 3, deadline: 3, chat: 2, kpi: 2, binder: 2 },            // 230-280
    { memo: 4, spam: 3, phone: 3, deadline: 4, chat: 3, kpi: 2, binder: 2, meeting: 1 },// 280-340
    { memo: 4, spam: 3, phone: 3, deadline: 4, chat: 3, kpi: 3, binder: 3, meeting: 2 },// 340-400
    { memo: 3, spam: 3, phone: 4, deadline: 4, chat: 3, kpi: 3, binder: 3, meeting: 2 },// 400-460 (탕비실 타임 포함)
    { memo: 3, spam: 3, phone: 4, deadline: 5, chat: 4, kpi: 4, binder: 3, meeting: 2 },// 460-533 (폭풍 전야 포함)
    { memo: 5, spam: 3, deadline: 3, chat: 2, kpi: 2 },                                 // 533-565 부장님
    { memo: 3, spam: 4, phone: 4, deadline: 6, chat: 4, kpi: 4, binder: 3, meeting: 3 },// 565-600
  ]),
  events: [
    { at: 0, kind: 'message', text: '09:00 출근 완료. 오늘의 목표: 칼퇴!' },
    { at: 40, kind: 'swarm', enemy: 'spam', count: 24, text: '📧 전체 회신 폭탄이 쏟아진다!' },
    { at: 67, kind: 'message', text: '10:00 주간 회의가 시작되었다' },
    { at: 85, kind: 'elite', enemy: 'printer', hpMul: ELITE_HP.e1, text: '🖨️ 용지 걸림! 프린터 폭주' },
    { at: 110, kind: 'ring', enemy: 'meeting', count: 16, radius: 180, text: '📅 긴급 회의 소집! 포위를 뚫어라' },
    { at: 125, kind: 'burst', enemy: 'deadline', count: 18, text: '⌛ 오전 마감 건이 몰려온다!' },
    { at: 133, kind: 'message', text: '11:00 "5분만 시간 되세요?" (1시간)' },
    { at: 145, kind: 'elite', enemy: 'printer', hpMul: ELITE_HP.e2, text: '🖨️ 프린터가 또 고장 났다' },
    { at: 157, kind: 'message', text: '11:15 팀장님 자리가 비었다… 불길하다' },
    { at: 167, kind: 'boss', enemy: 'team_lead', hpMul: MID_BOSS_HP, text: '11:30 팀장님: "잠깐 얘기 좀 할까요?"' },
    { at: 202, kind: 'message', text: '12:00 점심시간! 잠시 평화가 찾아왔다' },
    { at: 229, kind: 'burst', enemy: 'memo', count: 30, text: '12:30 미뤄 둔 결재가 몰려온다' },
    { at: 250, kind: 'elite', enemy: 'printer', hpMul: ELITE_HP.e3, text: '🖨️ 컬러 인쇄 폭주! 프린터 과열' },
    { at: 267, kind: 'message', text: '13:00 오후 회의 3연속 확정' },
    { at: 285, kind: 'swarm', enemy: 'spam', count: 40, text: '📧 "전체 회신" 누른 사람 누구야?!' },
    { at: 300, kind: 'ring', enemy: 'meeting', count: 22, radius: 190, text: '📅 긴급 회의 소집! (오늘만 세 번째)' },
    { at: 320, kind: 'elite', enemy: 'printer', hpMul: ELITE_HP.e4, text: '🖨️ 토너 부족인데 왜 더 세졌지?' },
    { at: 333, kind: 'message', text: '14:00 "이거 급한 건데요~" (전부 급함)' },
    { at: 360, kind: 'burst', enemy: 'kpi', count: 10, text: '📊 KPI 중간 점검! 그래프가 떼로 온다' },
    { at: 390, kind: 'elite', enemy: 'printer', hpMul: ELITE_HP.e5, text: '🖨️ 1,000장 양면 인쇄 시작' },
    { at: 400, kind: 'message', text: '15:00 탕비실 타임. 과자는 이미 품절' },
    { at: 425, kind: 'ring', enemy: 'meeting', count: 26, radius: 200, text: '📅 전 부서 합동 긴급 회의!' },
    { at: 445, kind: 'swarm', enemy: 'spam', count: 55, text: '📧 수신자 1,200명 전체 회신 대란!' },
    { at: 460, kind: 'elite', enemy: 'printer', hpMul: ELITE_HP.e6, text: '🖨️ 프린터가 A3 모드로 진화했다' },
    { at: 467, kind: 'message', text: '16:00 "퇴근 전에 잠깐 볼까요?"' },
    { at: 490, kind: 'burst', enemy: 'deadline', count: 35, text: '⌛ 금일 마감 건 총출동!' },
    { at: 505, kind: 'elite', enemy: 'printer', hpMul: ELITE_HP.e7, text: '🖨️ 마지막 프린터! 진화를 끝내라' },
    { at: 522, kind: 'message', text: '16:50 복도 끝에서 부장님 발소리가…' },
    { at: 533, kind: 'boss', enemy: 'bujang', hpMul: FINAL_BOSS_HP, text: '17:00 부장님: "퇴근 전에 이것만 좀…"' },
    { at: 567, kind: 'message', text: '17:30 가방을 슬쩍 챙긴다' },
    { at: 575, kind: 'swarm', enemy: 'spam', count: 50, text: '📧 퇴근 직전 메일 폭격!' },
    { at: 589, kind: 'message', text: '17:50 부장님을 설득(물리)하라!' },
  ],
  finalBoss: 'bujang',
  // 야근 모드: 사무실에 밤이 찾아온다 — 다음 스테이지(분기 마감)의 맛보기
  overtimePool: pool({ memo: 3, deadline: 5, phone: 4, chat: 4, kpi: 4, binder: 3, meeting: 3, bug: 3, owl: 2, zombie: 2, printer: 0.1 }),
  coinMul: 1,
  hpMul: 1,
};

// ───────────────────────────── 분기 마감 야근 ─────────────────────────────
const CRUNCH: StageDef = {
  id: 'crunch',
  name: '분기 마감 야근',
  subtitle: '서버가 먼저 퇴근했다',
  desc: '분기 마감 D-1. 불 꺼진 사무실엔 모니터 불빛과 버그뿐. 본부장님은 오늘 밤 "숫자"를 원하신다. 🧨는 멀리서 처리하세요.',
  icon: '🌃',
  palette: { floor: '#121a2e', floorAlt: '#152036', line: '#243457', accent: '#38bdf8', fog: '#010309' },
  decor: ['🍕', '🥤', '🔌', '💾', '🍜', '🧃'],
  timeline: timeline([
    { bug: 6, memo: 4, ghost_task: 2 },                                                                   // 0-30
    { bug: 6, memo: 3, ghost_task: 3, owl: 2 },                                                           // 30-70
    { bug: 5, memo: 2, ghost_task: 3, owl: 3, alert: 2, issue: 1 },                                       // 70-110
    { bug: 5, ghost_task: 3, owl: 3, alert: 2, issue: 2, zombie: 1, report: 1 },                          // 110-167
    { bug: 5, ghost_task: 3, owl: 2, alert: 2, issue: 2, zombie: 1 },                                     // 167-200 PM
    { bug: 6, ghost_task: 3, zombie: 1 },                                                                 // 200-230 휴식
    { bug: 4, ghost_task: 3, owl: 3, alert: 3, issue: 2, zombie: 2, report: 2, hotfix: 1 },               // 230-280
    { bug: 4, ghost_task: 3, owl: 3, alert: 3, issue: 3, zombie: 2, report: 2, hotfix: 1, deadline: 2 },   // 280-340
    { bug: 4, ghost_task: 3, owl: 3, alert: 3, issue: 3, zombie: 3, report: 3, hotfix: 2, deadline: 2 },   // 340-400
    { bug: 3, ghost_task: 3, owl: 4, alert: 3, issue: 3, zombie: 3, report: 3, hotfix: 2, deadline: 3 },   // 400-460 (탕비실 타임 포함)
    { bug: 3, ghost_task: 3, owl: 4, alert: 4, issue: 4, zombie: 4, report: 3, hotfix: 2, deadline: 3 },   // 460-533 (폭풍 전야 포함)
    { bug: 5, ghost_task: 3, zombie: 2, alert: 2, hotfix: 1 },                                            // 533-565 본부장
    { bug: 4, ghost_task: 3, owl: 4, alert: 4, issue: 4, zombie: 4, report: 3, hotfix: 3, deadline: 4 },   // 565-600
  ], 1.05),
  events: [
    { at: 0, kind: 'message', text: '09:00 어제 퇴근을 못 했는데 벌써 9시' },
    { at: 46, kind: 'swarm', enemy: 'bug', count: 26, text: '🐛 QA 버그 리포트가 무더기로 왔다!' },
    { at: 67, kind: 'message', text: '10:00 버그 38건 접수. 전부 "긴급"' },
    { at: 91, kind: 'elite', enemy: 'server', hpMul: ELITE_HP.e1, text: '🖥️ 서버 다운! 버그가 새어 나온다' },
    { at: 116, kind: 'ring', enemy: 'meeting', count: 18, radius: 180, text: '📅 긴급 회의 소집! 장애 대응 회의!' },
    { at: 133, kind: 'message', text: '11:00 "간단한 수정이에요~" (아님)' },
    { at: 136, kind: 'burst', enemy: 'issue', count: 8, text: '🧨 장애 연쇄 폭발! 거리 유지!' },
    { at: 148, kind: 'elite', enemy: 'server', hpMul: ELITE_HP.e2, text: '🖥️ 재부팅했는데 또 다운됐다' },
    { at: 157, kind: 'message', text: '11:15 PM이 메신저에서 "입력 중…"' },
    { at: 167, kind: 'boss', enemy: 'pm', hpMul: MID_BOSS_HP, text: '11:30 PM: "잠깐 통화 가능하세요?"' },
    { at: 202, kind: 'message', text: '12:00 컵라면 3분… 이 3분만은 평화' },
    { at: 229, kind: 'burst', enemy: 'owl', count: 14, text: '12:30 새벽형 인간들이 깨어났다!' },
    { at: 256, kind: 'elite', enemy: 'printer', hpMul: ELITE_HP.e3, text: '🖨️ 밤에도 프린터는 고장 난다' },
    { at: 267, kind: 'message', text: '13:00 금요일 오후 배포 확정…' },
    { at: 290, kind: 'swarm', enemy: 'ghost_task', count: 30, text: '👻 완료한 티켓이 전부 재오픈!' },
    // 시그니처: 같은 초에 버그 떼 둘(엔진이 각각 무작위 방향에서 보낸다)
    { at: 305, kind: 'swarm', enemy: 'bug', count: 26, text: '🐛 배포 직후 버그 대량 발생!' },
    { at: 305, kind: 'swarm', enemy: 'bug', count: 26 },
    { at: 326, kind: 'elite', enemy: 'server', hpMul: ELITE_HP.e4, text: '🖥️ 트래픽 폭주! 서버가 비명을 지른다' },
    { at: 333, kind: 'message', text: '14:00 롤백 회의가 소집되었다' },
    { at: 367, kind: 'burst', enemy: 'report', count: 14, text: '📑 주간 보고서 마감 10분 전!' },
    { at: 395, kind: 'elite', enemy: 'server', hpMul: ELITE_HP.e5, text: '🖥️ DB 서버까지 다운!' },
    { at: 400, kind: 'message', text: '15:00 재부팅 대기 중. 잠깐 숨 돌리자' },
    { at: 431, kind: 'ring', enemy: 'meeting', count: 26, radius: 200, text: '📅 "다들 카메라 켜 주세요"' },
    { at: 451, kind: 'swarm', enemy: 'bug', count: 60, text: '🐛 버그 대이동! 서버실을 탈출했다' },
    { at: 462, kind: 'elite', enemy: 'server', hpMul: ELITE_HP.e6, text: '🖥️ 백업 서버마저…!' },
    { at: 467, kind: 'message', text: '16:00 "이번 분기 숫자 나왔어?"' },
    { at: 495, kind: 'burst', enemy: 'issue', count: 24, text: '🧨 장애 알림 폭주! 터지기 직전!' },
    { at: 510, kind: 'elite', enemy: 'server', hpMul: ELITE_HP.e7, text: '🖥️ 마지막 서버! 진화를 끝내라' },
    { at: 522, kind: 'message', text: '16:50 본부장실 불이 켜졌다…' },
    { at: 533, kind: 'boss', enemy: 'director', hpMul: FINAL_BOSS_HP, text: '17:00 본부장: "숫자 가져와!"' },
    { at: 567, kind: 'message', text: '17:30 서버가 먼저 퇴근했다' },
    { at: 578, kind: 'swarm', enemy: 'ghost_task', count: 50, text: '👻 내일 할 일이 오늘로 당겨졌다' },
    { at: 589, kind: 'message', text: '17:50 커밋. 푸시. 그리고… 퇴근!' },
  ],
  finalBoss: 'director',
  overtimePool: pool({ bug: 3, ghost_task: 3, owl: 4, alert: 4, issue: 4, zombie: 4, report: 3, hotfix: 3, deadline: 3, server: 0.1 }),
  unlockedBy: 'u_stage_crunch',
  coinMul: 1.15,
  hpMul: 1.25,
};

// ───────────────────────────── 부서 회식 ─────────────────────────────
const DINNER: StageDef = {
  id: 'dinner',
  name: '부서 회식',
  subtitle: '1차에서 끝날 리 없다',
  desc: '"오늘 회식 필참!" 고깃집 불판 위로 소주병이 행군한다. 폭탄주 부장님이 3차를 외치기 전에 탈출하라.',
  icon: '🍻',
  palette: { floor: '#261612', floorAlt: '#2e1b15', line: '#40261c', accent: '#ff8a3d', fog: '#0c0402' },
  decor: ['🥢', '🧂', '🥬', '🧄', '🌶️', '🧅'],
  timeline: timeline([
    { soju: 8, beer: 4 },                                                                               // 0-30
    { soju: 7, beer: 4, cheers: 2 },                                                                    // 30-70
    { soju: 6, beer: 4, cheers: 3, samgyup: 2, mic: 1 },                                                // 70-110
    { soju: 5, beer: 4, cheers: 3, samgyup: 2, mic: 2, bombshot: 1, tambourine: 1 },                    // 110-167
    { soju: 5, beer: 3, cheers: 2, samgyup: 2, mic: 2, bombshot: 2, hangover: 1 },                      // 167-200 건배사 과장
    { soju: 5, beer: 4, samgyup: 2 },                                                                   // 200-230 휴식
    { soju: 4, beer: 3, cheers: 3, samgyup: 3, mic: 3, bombshot: 2, tambourine: 2, hangover: 2 },       // 230-280
    { soju: 4, beer: 3, cheers: 3, samgyup: 3, mic: 3, bombshot: 3, tambourine: 2, hangover: 2 },       // 280-340
    { soju: 3, beer: 3, cheers: 4, samgyup: 3, mic: 3, bombshot: 3, tambourine: 2, hangover: 3 },       // 340-400
    { soju: 3, beer: 3, cheers: 4, samgyup: 3, mic: 4, bombshot: 3, tambourine: 3, hangover: 3 },       // 400-460 (탕비실 타임 포함)
    { soju: 3, beer: 3, cheers: 4, samgyup: 4, mic: 4, bombshot: 4, tambourine: 3, hangover: 4 },       // 460-533 (폭풍 전야 포함)
    { soju: 5, beer: 3, samgyup: 2, hangover: 2, tambourine: 1 },                                       // 533-565 폭탄주 부장님
    { soju: 3, beer: 4, cheers: 5, samgyup: 3, mic: 4, bombshot: 4, tambourine: 3, hangover: 4 },       // 565-600
  ], 1.1),
  events: [
    { at: 0, kind: 'message', text: '09:00 공지: "오늘 회식 전원 참석"' },
    { at: 35, kind: 'swarm', enemy: 'beer', count: 26, text: '🍺 벌써 생맥주 환영이 보인다…' },
    { at: 67, kind: 'message', text: '10:00 회식 장소 공지: 역시 부장님 단골 고깃집' },
    { at: 80, kind: 'elite', enemy: 'grill', hpMul: ELITE_HP.e1, text: '♨️ 불판이 달아올랐다! 고기 투하' },
    { at: 104, kind: 'ring', enemy: 'soju', count: 18, radius: 180, text: '🍶 "한 바퀴 돌아가며 한 잔씩!"' },
    { at: 119, kind: 'burst', enemy: 'cheers', count: 16, text: '🥂 "짠!" 사방에서 잔이 날아든다' },
    { at: 133, kind: 'message', text: '11:00 "오늘 저녁 다들 비워 둔 거지?"' },
    { at: 140, kind: 'elite', enemy: 'grill', hpMul: ELITE_HP.e2, text: '♨️ "불판 좀 갈아 주세요~" (안 갈아 줌)' },
    { at: 157, kind: 'message', text: '11:15 건배사 과장님이 목을 가다듬는다' },
    { at: 167, kind: 'boss', enemy: 'toast_master', hpMul: MID_BOSS_HP, text: '11:30 건배사 과장: "한 말씀 드리자면~"' },
    { at: 202, kind: 'message', text: '12:00 점심은 가볍게… 저녁이 무섭다' },
    { at: 229, kind: 'burst', enemy: 'bombshot', count: 10, text: '12:30 폭탄주 제조 시연회 개최!' },
    { at: 244, kind: 'elite', enemy: 'grill', hpMul: ELITE_HP.e3, text: '♨️ 불판 2호기 가동!' },
    { at: 267, kind: 'message', text: '13:00 법카 한도 확인 완료' },
    { at: 279, kind: 'swarm', enemy: 'beer', count: 40, text: '🍺 생맥주 무한 리필 이벤트!' },
    { at: 294, kind: 'ring', enemy: 'tambourine', count: 14, radius: 190, text: '🥁 탬버린 부대가 흥을 돋우며 에워싼다' },
    { at: 314, kind: 'elite', enemy: 'grill', hpMul: ELITE_HP.e4, text: '♨️ 불판 위에 불판을 올렸다?!' },
    { at: 333, kind: 'message', text: '14:00 누군가 벌써 노래방을 예약했다' },
    // 시그니처: 폭탄주가 멀찍이 둘러싸고 조여 온다 — 가까워지기 전에 한 곳을 뚫어라
    { at: 360, kind: 'ring', enemy: 'bombshot', count: 12, radius: 230, text: '💣 폭탄주 원샷 릴레이!' },
    { at: 384, kind: 'elite', enemy: 'grill', hpMul: ELITE_HP.e5, text: '♨️ 사장님 서비스 불판 등장!' },
    { at: 400, kind: 'message', text: '15:00 숙취해소제 공동구매 마감' },
    { at: 419, kind: 'ring', enemy: 'soju', count: 28, radius: 200, text: '🍶 "원샷! 원샷!" 소주병에 포위됐다' },
    { at: 439, kind: 'swarm', enemy: 'beer', count: 60, text: '🍺 맥주 타워가 무너졌다!' },
    { at: 454, kind: 'elite', enemy: 'grill', hpMul: ELITE_HP.e6, text: '♨️ 초대형 불판! 숯불 추가요!' },
    { at: 467, kind: 'message', text: '16:00 택시 앱 즐겨찾기 등록 완료' },
    { at: 484, kind: 'burst', enemy: 'cheers', count: 30, text: '🥂 "마지막 건배~!" (마지막 아님)' },
    { at: 499, kind: 'elite', enemy: 'grill', hpMul: ELITE_HP.e7, text: '♨️ 마지막 불판! 진화 못 하면 3차행' },
    { at: 522, kind: 'message', text: '16:50 부장님이 잔을 채우기 시작하셨다…' },
    { at: 533, kind: 'boss', enemy: 'bomb_bujang', hpMul: FINAL_BOSS_HP, text: '17:00 폭탄주 부장님: "자, 잔 들어!"' },
    { at: 567, kind: 'message', text: '17:30 "1차는 가볍게~" (가볍지 않음)' },
    { at: 575, kind: 'swarm', enemy: 'cheers', count: 40, text: '🥂 건배 러시! 잔이 쏟아진다' },
    { at: 589, kind: 'message', text: '17:50 18시 정각에 「먼저 일어나 보겠습니다!」를 외쳐라' },
  ],
  finalBoss: 'bomb_bujang',
  // 야근 모드 = 노래방 2차
  overtimePool: pool({ mic: 5, tambourine: 4, beer: 3, cheers: 4, bombshot: 4, hangover: 4, soju: 3, samgyup: 2, grill: 0.1 }),
  unlockedBy: 'u_stage_dinner',
  coinMul: 1.3,
  hpMul: 1.7,
};

// ───────────────────────────── 명절 친척집 ─────────────────────────────
const HOLIDAY: StageDef = {
  id: 'holiday',
  name: '명절 친척집',
  subtitle: '잔소리 무한 리필',
  desc: '따끈한 장판 위로 날아드는 "취업은?" "결혼은?". 큰이모의 덕담 폭격을 버티고 무사히 귀경하라.',
  icon: '🎑',
  palette: { floor: '#2a2016', floorAlt: '#36291b', line: '#4a3822', accent: '#ffcf5a', fog: '#0b0703' },
  decor: ['🍊', '🍐', '🍎', '🧧', '🌰', '🎐'],
  timeline: timeline([
    { nag_job: 6, songpyeon: 5 },                                                                                         // 0-30
    { nag_job: 5, songpyeon: 4, nag_marry: 3, cousin: 2 },                                                                // 30-70
    { nag_job: 4, songpyeon: 4, nag_marry: 3, cousin: 3, nag_salary: 2 },                                                 // 70-110
    { nag_job: 4, songpyeon: 4, nag_marry: 3, cousin: 3, nag_salary: 2, jeon: 1, dishes: 1, nag_weight: 1 },              // 110-167
    { nag_job: 4, songpyeon: 4, nag_marry: 3, cousin: 2, nag_salary: 2, jeon: 1, remote: 1 },                             // 167-200 삼촌
    { songpyeon: 6, nag_job: 3, jeon: 1 },                                                                                // 200-230 휴식
    // 230초~: 원거리(연봉 잔소리·리모컨) 비중을 12~14%(사무실 수준)로 제한 — 탄막이 봇 사망 원인 1위라서
    { nag_job: 3, songpyeon: 4, nag_marry: 3, cousin: 3, nag_salary: 2, nag_weight: 2, jeon: 2, dishes: 2, remote: 1, nag_kids: 1 }, // 230-280
    { nag_job: 3, songpyeon: 3, nag_marry: 3, cousin: 3, nag_salary: 2, nag_weight: 2, jeon: 2, dishes: 2, remote: 1, nag_kids: 1 }, // 280-340
    { nag_job: 3, songpyeon: 3, nag_marry: 3, cousin: 4, nag_salary: 2, nag_weight: 2, jeon: 3, dishes: 3, remote: 2, nag_kids: 2 }, // 340-400
    { nag_job: 3, songpyeon: 3, nag_marry: 3, cousin: 4, nag_salary: 2, nag_weight: 3, jeon: 3, dishes: 3, remote: 2, nag_kids: 2 }, // 400-460 (탕비실 타임 포함)
    { nag_job: 3, songpyeon: 3, nag_marry: 4, cousin: 4, nag_salary: 2, nag_weight: 3, jeon: 4, dishes: 3, remote: 2, nag_kids: 2 }, // 460-533 (폭풍 전야 포함)
    { songpyeon: 5, nag_job: 3, nag_marry: 2, jeon: 2, nag_kids: 1 },                                                     // 533-565 큰이모
    { nag_job: 3, songpyeon: 4, nag_marry: 4, cousin: 5, nag_salary: 2, nag_weight: 3, jeon: 4, dishes: 3, remote: 2, nag_kids: 3 }, // 565-600
  ], 1.1),
  events: [
    { at: 0, kind: 'message', text: '09:00 친척집 도착. 현관부터 시선 집중' },
    { at: 50, kind: 'swarm', enemy: 'songpyeon', count: 26, text: '🥟 "송편 쪘다~ 먹고 가라~"' },
    { at: 67, kind: 'message', text: '10:00 차례상 완료. 잔소리도 준비 완료' },
    { at: 95, kind: 'elite', enemy: 'gift', hpMul: ELITE_HP.e1, text: '🎁 선물세트 도착! 포장부터 뜯어라' },
    { at: 120, kind: 'ring', enemy: 'nag_job', count: 16, radius: 180, text: '💬 빙 둘러앉아 "요즘 뭐 하니?"' },
    { at: 133, kind: 'message', text: '11:00 친척 도착 러시. 인사만 40번째' },
    { at: 138, kind: 'burst', enemy: 'cousin', count: 15, text: '🧒 사촌동생들 집합! 폰을 사수하라' },
    { at: 148, kind: 'elite', enemy: 'gift', hpMul: ELITE_HP.e2, text: '🎁 햄 세트… 아니, 참치 세트다!' },
    { at: 157, kind: 'message', text: '11:15 대문 밖에서 헛기침 소리가…' },
    { at: 167, kind: 'boss', enemy: 'uncle', hpMul: MID_BOSS_HP, text: '11:30 삼촌: "허허, 이게 누구야~"' },
    { at: 202, kind: 'message', text: '12:00 점심상. 먹는 동안은 아무도 안 묻는다' },
    { at: 229, kind: 'burst', enemy: 'nag_marry', count: 20, text: '12:30 "그래서, 만나는 사람은?"' },
    { at: 258, kind: 'elite', enemy: 'grill', hpMul: ELITE_HP.e3, text: '♨️ 전 부치는 불판이 과열됐다!' },
    { at: 267, kind: 'message', text: '13:00 거실에서 윷놀이 판이 벌어졌다' },
    { at: 290, kind: 'swarm', enemy: 'songpyeon', count: 40, text: '🥟 "남으면 아까워~ 싸 가라~"' },
    // 시그니처: 원거리 잔소리 포위 대신 묵직한 근접 협공(탄막 지옥 방지)
    { at: 308, kind: 'ring', enemy: 'nag_weight', count: 12, radius: 190, text: '💬 사방에서 "살쪘네?" 협공!' },
    { at: 328, kind: 'elite', enemy: 'gift', hpMul: ELITE_HP.e4, text: '🎁 한우 세트다! (우리 집 거 아님)' },
    { at: 333, kind: 'message', text: '14:00 사촌동생이 내 폰으로 과금 중' },
    { at: 366, kind: 'burst', enemy: 'dishes', count: 12, text: '🍽️ 설거지 산이 무너졌다!' },
    { at: 394, kind: 'elite', enemy: 'gift', hpMul: ELITE_HP.e5, text: '🎁 과일 바구니 3단 합체!' },
    { at: 400, kind: 'message', text: '15:00 식혜 한 잔. 잠깐 숨 돌리자' },
    { at: 430, kind: 'ring', enemy: 'nag_marry', count: 26, radius: 200, text: '💬 친척 총출동! "결혼은? 결혼은?"' },
    { at: 448, kind: 'swarm', enemy: 'songpyeon', count: 60, text: '🥟 송편 대이동! 방앗간이 터졌다!' },
    { at: 461, kind: 'elite', enemy: 'grill', hpMul: ELITE_HP.e6, text: '♨️ 산적 굽는 불판 추가 투입!' },
    { at: 467, kind: 'message', text: '16:00 "슬슬 가야지?" (아무도 안 감)' },
    { at: 494, kind: 'burst', enemy: 'cousin', count: 30, text: '🧒 사촌동생 군단이 세뱃돈을 노린다!' },
    { at: 510, kind: 'elite', enemy: 'gift', hpMul: ELITE_HP.e7, text: '🎁 마지막 선물세트! 진화를 끝내라' },
    { at: 522, kind: 'message', text: '16:50 안방 문이 열린다… 큰이모다' },
    { at: 533, kind: 'boss', enemy: 'big_aunt', hpMul: FINAL_BOSS_HP, text: '17:00 큰이모: "어디 얼굴 좀 보자~"' },
    { at: 567, kind: 'message', text: '17:30 고속도로 정체 시작. 지금 가야 한다' },
    { at: 578, kind: 'swarm', enemy: 'songpyeon', count: 50, text: '🥟 "이것도 싸 가!" 송편 대방출!' },
    { at: 589, kind: 'message', text: '17:50 귀경 10분 전! 신발 신는 척 시작' },
  ],
  finalBoss: 'big_aunt',
  // 야근 모드 = 설거지 당번 확정
  overtimePool: pool({ nag_job: 3, nag_marry: 4, nag_salary: 4, nag_weight: 3, nag_kids: 3, cousin: 5, jeon: 4, dishes: 4, remote: 4, songpyeon: 3, gift: 0.1 }),
  unlockedBy: 'u_stage_holiday',
  coinMul: 1.5,
  hpMul: 1.75,
};

export const STAGES: StageDef[] = [OFFICE, CRUNCH, DINNER, HOLIDAY];
