// ─────────────────────────────────────────────────────────────────────────────
// 스테이지 4종 — 칼퇴 서바이버
//
// 게임 시계: 600초 = 09:00→18:00 (1시간 ≈ 66.7초)
//   10:00=67s  11:00=133s  11:30=167s(중간 보스)  12:00=200s(점심)  13:00=267s
//   14:00=333s  15:00=400s  16:00=467s  17:00=533s(최종 보스)  17:30=567s  18:00=600s
//
// 모든 스테이지가 같은 '하루 일과표(DAY)'를 쓴다: 구간 경계·소환 속도·최소 생존 수·체력 배율 곡선.
// 스테이지마다 다른 것 = 소환 풀(적 구성), 이벤트, rateMul(소환량 배율), 스테이지 hpMul/coinMul.
//
// BRIEF 목표 대비(office, rateMul 1 기준 소환량 적분 + 이벤트):
//   처치 100초 ≈ 300 / 200초 ≈ 850 / 400초 ≈ 2200 / 600초 ≈ 3800
//   동시 적(minAlive 하한) 초반 10~55 / 중반 80~150 / 후반 190~250 (+ 처치 속도에 따라 200~350)
//   구간 hpMul 0초 1.0 → 200초 2.2 → 400초 5.0 → 600초 10
// 엘리트 7회(85·145·250·320·390·460·505초) + 중간 보스 + 최종 보스 = 상자 9개 → 진화 2~4회가 현실적.
// ─────────────────────────────────────────────────────────────────────────────
import type { SpawnEntry, SpawnSegment, StageDef } from './types';

interface DaySlot {
  from: number; to: number;
  rate: number; rateEnd: number;
  minAlive: number;
  hpMul: number; hpMulEnd: number;
}

/** 하루 일과표. 13구간, 0~600초를 빈틈없이 덮는다. */
const DAY: readonly DaySlot[] = [
  { from: 0,   to: 30,  rate: 1.4, rateEnd: 2.2, minAlive: 10,  hpMul: 1.0, hpMulEnd: 1.15 }, // 09:00 출근
  { from: 30,  to: 70,  rate: 2.2, rateEnd: 3.2, minAlive: 20,  hpMul: 1.15, hpMulEnd: 1.4 }, // 09:27 메일 확인
  { from: 70,  to: 110, rate: 3.2, rateEnd: 4.2, minAlive: 32,  hpMul: 1.4, hpMulEnd: 1.7 },  // 10:03 주간 회의
  { from: 110, to: 165, rate: 4.2, rateEnd: 5.2, minAlive: 50,  hpMul: 1.7, hpMulEnd: 2.0 },  // 10:39 오전 러시
  { from: 165, to: 200, rate: 4.2, rateEnd: 4.8, minAlive: 55,  hpMul: 2.0, hpMulEnd: 2.2 },  // 11:28 중간 보스전(소환 살짝 완화)
  { from: 200, to: 230, rate: 1.5, rateEnd: 2.5, minAlive: 15,  hpMul: 2.2, hpMulEnd: 2.4 },  // 12:00 점심 직후 식곤증 휴식
  { from: 230, to: 280, rate: 5.2, rateEnd: 6.2, minAlive: 80,  hpMul: 2.4, hpMulEnd: 3.0 },  // 12:27 오후 업무 폭탄
  { from: 280, to: 340, rate: 6.2, rateEnd: 7.2, minAlive: 110, hpMul: 3.0, hpMulEnd: 3.9 },  // 13:12
  { from: 340, to: 400, rate: 7.2, rateEnd: 7.8, minAlive: 150, hpMul: 3.9, hpMulEnd: 5.0 },  // 14:06
  { from: 400, to: 460, rate: 7.5, rateEnd: 8.5, minAlive: 190, hpMul: 5.0, hpMulEnd: 6.3 },  // 15:00
  { from: 460, to: 530, rate: 8.5, rateEnd: 9.0, minAlive: 230, hpMul: 6.3, hpMulEnd: 7.8 },  // 15:54 퇴근 전 몰아치기
  { from: 530, to: 565, rate: 5.5, rateEnd: 6.5, minAlive: 160, hpMul: 7.8, hpMulEnd: 8.6 },  // 16:57 최종 보스전(보스에 집중)
  { from: 565, to: 600, rate: 8.0, rateEnd: 9.5, minAlive: 250, hpMul: 8.6, hpMulEnd: 10 },   // 17:28 퇴근 직전 총력전
];

/** 풀 축약 표기: { memo: 6, spam: 3 } → SpawnEntry[] */
type Pool = Readonly<Record<string, number>>;

const r2 = (n: number) => Math.round(n * 100) / 100;

function pool(p: Pool): SpawnEntry[] {
  return Object.entries(p).map(([enemy, weight]) => ({ enemy, weight }));
}

/** DAY 13구간에 스테이지별 풀(13개)을 입힌다. rateMul은 소환 속도·최소 생존 수에 곱한다. */
function timeline(pools: readonly Pool[], rateMul = 1): SpawnSegment[] {
  return DAY.map((s, i) => ({
    from: s.from,
    to: s.to,
    pool: pool(pools[Math.min(i, pools.length - 1)]),
    rate: r2(s.rate * rateMul),
    rateEnd: r2(s.rateEnd * rateMul),
    minAlive: Math.round(s.minAlive * rateMul),
    hpMul: s.hpMul,
    hpMulEnd: s.hpMulEnd,
  }));
}

/** 엘리트 이벤트 체력 배율(그 시점 구간 배율의 약 1.1~1.5배 — 후반 엘리트도 몇 초는 버티도록) */
const ELITE_HP = { e1: 1.6, e2: 2.2, e3: 3.6, e4: 5.2, e5: 7, e6: 9, e7: 11 } as const;
/**
 * 보스 이벤트 체력 배율 = 1. 엔진은 보스에 구간/이벤트 배율을 곱하지 않고 enemies.ts의 hp를 절대 체력으로 쓴다
 * (최종 보스 hp에는 원래 설계 배율 8이 이미 곱해져 있다). 스키마 기본값(= 현재 구간 배율)이 끼어들지 않도록 1로 명시.
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
  palette: { floor: '#c9d3df', floorAlt: '#bdc9d7', line: '#a9b7c8', accent: '#3b82f6', fog: '#1e293b' },
  decor: ['🪴', '🪑', '🗑️', '💼', '🗄️', '📌'],
  timeline: timeline([
    { memo: 10, spam: 3 },                                                              // 0-30
    { memo: 8, spam: 4, phone: 2 },                                                     // 30-70
    { memo: 7, spam: 4, phone: 3, deadline: 2, chat: 1 },                               // 70-110
    { memo: 6, spam: 3, phone: 3, deadline: 3, chat: 2, kpi: 1, binder: 1 },            // 110-165
    { memo: 6, spam: 3, phone: 2, deadline: 3, chat: 2, kpi: 1 },                       // 165-200 팀장님
    { memo: 6, spam: 4, kpi: 1 },                                                       // 200-230 휴식
    { memo: 5, spam: 3, phone: 3, deadline: 3, chat: 2, kpi: 2, binder: 2 },            // 230-280
    { memo: 4, spam: 3, phone: 3, deadline: 4, chat: 3, kpi: 2, binder: 2, meeting: 1 },// 280-340
    { memo: 4, spam: 3, phone: 3, deadline: 4, chat: 3, kpi: 3, binder: 3, meeting: 2 },// 340-400
    { memo: 3, spam: 3, phone: 4, deadline: 4, chat: 3, kpi: 3, binder: 3, meeting: 2 },// 400-460
    { memo: 3, spam: 3, phone: 4, deadline: 5, chat: 4, kpi: 4, binder: 3, meeting: 2 },// 460-530
    { memo: 5, spam: 3, deadline: 3, chat: 2, kpi: 2 },                                 // 530-565 부장님
    { memo: 3, spam: 4, phone: 4, deadline: 6, chat: 4, kpi: 4, binder: 3, meeting: 3 },// 565-600
  ]),
  events: [
    { at: 0, kind: 'message', text: '09:00 출근 완료. 오늘의 목표: 칼퇴!' },
    { at: 40, kind: 'swarm', enemy: 'spam', count: 24, text: '📧 전체 회신 폭탄이 쏟아집니다!' },
    { at: 67, kind: 'message', text: '10:00 주간 회의가 시작되었습니다' },
    { at: 85, kind: 'elite', enemy: 'printer', hpMul: ELITE_HP.e1, text: '🖨️ 용지 걸림! 고장난 프린터가 폭주합니다' },
    { at: 110, kind: 'ring', enemy: 'meeting', count: 16, radius: 180, text: '📅 긴급 회의 소집! 포위망을 뚫어라!' },
    { at: 125, kind: 'burst', enemy: 'deadline', count: 18, text: '⌛ 오전 마감 건이 한꺼번에 몰려옵니다!' },
    { at: 133, kind: 'message', text: '11:00 "혹시 5분만 시간 되세요?" (1시간 걸림)' },
    { at: 145, kind: 'elite', enemy: 'printer', hpMul: ELITE_HP.e2, text: '🖨️ 프린터가 또 고장 났습니다. 왜 항상 나만...' },
    { at: 167, kind: 'boss', enemy: 'team_lead', hpMul: MID_BOSS_HP, text: '11:30 팀장님이 다가온다... "잠깐 얘기 좀 할까요?"' },
    { at: 185, kind: 'swarm', enemy: 'spam', count: 30, text: '📧 [광고] 점심 특가 메일이 도착했습니다' },
    { at: 202, kind: 'message', text: '12:00 점심 먹고 식곤증 타임... 잠시 평화가 찾아왔다' },
    { at: 229, kind: 'burst', enemy: 'memo', count: 30, text: '12:30 점심시간 끝! 오전에 미룬 결재가 몰려온다' },
    { at: 250, kind: 'elite', enemy: 'printer', hpMul: ELITE_HP.e3, text: '🖨️ 컬러 인쇄 요청 폭주! 프린터 과열!' },
    { at: 267, kind: 'message', text: '13:00 오후 회의 3연속 확정' },
    { at: 285, kind: 'swarm', enemy: 'spam', count: 40, text: '📧 "전체 회신" 누른 사람 누구야?!' },
    { at: 300, kind: 'ring', enemy: 'meeting', count: 22, radius: 190, text: '📅 긴급 회의 소집! (오늘만 세 번째)' },
    { at: 320, kind: 'elite', enemy: 'printer', hpMul: ELITE_HP.e4, text: '🖨️ 토너 부족 경고... 인데 왜 더 세졌지?' },
    { at: 333, kind: 'message', text: '14:00 "이거 급한 건데요~" (모든 일이 급함)' },
    { at: 360, kind: 'burst', enemy: 'kpi', count: 10, text: '📊 KPI 중간 점검! 그래프가 떼로 몰려온다' },
    { at: 390, kind: 'elite', enemy: 'printer', hpMul: ELITE_HP.e5, text: '🖨️ 1,000장 양면 인쇄가 시작되었습니다' },
    { at: 400, kind: 'message', text: '15:00 탕비실 과자가 전부 떨어졌습니다' },
    { at: 425, kind: 'ring', enemy: 'meeting', count: 26, radius: 200, text: '📅 긴급 회의 소집! 이번엔 전 부서 합동' },
    { at: 445, kind: 'swarm', enemy: 'spam', count: 55, text: '📧 수신자 1,200명 전체 회신 대란!' },
    { at: 460, kind: 'elite', enemy: 'printer', hpMul: ELITE_HP.e6, text: '🖨️ 프린터가 스스로 A3 모드로 진화했다' },
    { at: 467, kind: 'message', text: '16:00 "퇴근 전에 잠깐 볼까요?"' },
    { at: 490, kind: 'burst', enemy: 'deadline', count: 35, text: '⌛ 금일 마감 건이 한꺼번에 몰려옵니다!' },
    { at: 505, kind: 'elite', enemy: 'printer', hpMul: ELITE_HP.e7, text: '🖨️ 마지막 프린터! 상자로 진화 준비를 끝내라' },
    { at: 522, kind: 'message', text: '16:50 복도 끝에서 부장님 발소리가 들린다...' },
    { at: 533, kind: 'boss', enemy: 'bujang', hpMul: FINAL_BOSS_HP, text: '17:00 부장님 등장! "퇴근 전에 이것만 좀…"' },
    { at: 567, kind: 'message', text: '17:30 퇴근 30분 전. 가방을 슬쩍 챙긴다' },
    { at: 575, kind: 'swarm', enemy: 'spam', count: 50, text: '📧 퇴근 직전 메일 폭격!' },
    { at: 589, kind: 'message', text: '17:50 퇴근 10분 전! 부장님을 설득(물리)하라!' },
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
  desc: '분기 마감 D-1. 불 꺼진 사무실엔 모니터 불빛과 버그뿐. 본부장님은 오늘 밤 "숫자"를 원하신다.',
  icon: '🌃',
  palette: { floor: '#1b2238', floorAlt: '#20294a', line: '#2c3860', accent: '#38bdf8', fog: '#04060d' },
  decor: ['💻', '🍕', '🔌', '💡', '📦', '🪑'],
  timeline: timeline([
    { bug: 6, memo: 4, ghost_task: 2 },                                                                   // 0-30
    { bug: 6, memo: 3, ghost_task: 3, owl: 2 },                                                           // 30-70
    { bug: 5, memo: 2, ghost_task: 3, owl: 3, alert: 2, issue: 1 },                                       // 70-110
    { bug: 5, ghost_task: 3, owl: 3, alert: 2, issue: 2, zombie: 1, report: 1 },                          // 110-165
    { bug: 5, ghost_task: 3, owl: 2, alert: 2, issue: 2, zombie: 1 },                                     // 165-200 PM
    { bug: 6, ghost_task: 3, zombie: 1 },                                                                 // 200-230 휴식
    { bug: 4, ghost_task: 3, owl: 3, alert: 3, issue: 2, zombie: 2, report: 2, hotfix: 1 },               // 230-280
    { bug: 4, ghost_task: 3, owl: 3, alert: 3, issue: 3, zombie: 2, report: 2, hotfix: 1, deadline: 2 },   // 280-340
    { bug: 4, ghost_task: 3, owl: 3, alert: 3, issue: 3, zombie: 3, report: 3, hotfix: 2, deadline: 2 },   // 340-400
    { bug: 3, ghost_task: 3, owl: 4, alert: 3, issue: 3, zombie: 3, report: 3, hotfix: 2, deadline: 3 },   // 400-460
    { bug: 3, ghost_task: 3, owl: 4, alert: 4, issue: 4, zombie: 4, report: 3, hotfix: 2, deadline: 3 },   // 460-530
    { bug: 5, ghost_task: 3, zombie: 2, alert: 2, hotfix: 1 },                                            // 530-565 본부장
    { bug: 4, ghost_task: 3, owl: 4, alert: 4, issue: 4, zombie: 4, report: 3, hotfix: 3, deadline: 4 },   // 565-600
  ], 1.05),
  events: [
    { at: 0, kind: 'message', text: '09:00 어제 퇴근을 못 했는데 벌써 09:00' },
    { at: 40, kind: 'swarm', enemy: 'bug', count: 26, text: '🐛 QA에서 버그 리포트가 무더기로 도착!' },
    { at: 67, kind: 'message', text: '10:00 버그 리포트 38건 접수. 우선순위는 전부 "긴급"' },
    { at: 85, kind: 'elite', enemy: 'server', hpMul: ELITE_HP.e1, text: '🖥️ 서버 다운! 버그가 새어 나옵니다' },
    { at: 110, kind: 'ring', enemy: 'meeting', count: 18, radius: 180, text: '📅 긴급 회의 소집! 장애 대응 회의!' },
    { at: 125, kind: 'burst', enemy: 'issue', count: 12, text: '🧨 장애가 연쇄적으로 터집니다! 거리 유지!' },
    { at: 133, kind: 'message', text: '11:00 "간단한 수정이에요~" (간단하지 않음)' },
    { at: 145, kind: 'elite', enemy: 'server', hpMul: ELITE_HP.e2, text: '🖥️ 재부팅했는데 또 다운됐습니다' },
    { at: 167, kind: 'boss', enemy: 'pm', hpMul: MID_BOSS_HP, text: '11:30 PM의 메시지: "잠깐 통화 가능하세요?"' },
    { at: 185, kind: 'swarm', enemy: 'ghost_task', count: 24, text: '👻 완료 처리한 티켓이 전부 재오픈되었습니다' },
    { at: 202, kind: 'message', text: '12:00 컵라면 3분... 이 3분만은 평화롭다' },
    { at: 229, kind: 'burst', enemy: 'owl', count: 20, text: '12:30 새벽형 인간들이 깨어났다!' },
    { at: 250, kind: 'elite', enemy: 'printer', hpMul: ELITE_HP.e3, text: '🖨️ 밤에도 프린터는 고장 난다' },
    { at: 267, kind: 'message', text: '13:00 금요일 오후 배포 확정. 모두의 표정이 굳었다' },
    { at: 285, kind: 'swarm', enemy: 'bug', count: 40, text: '🐛 배포 직후 버그 대량 발생!' },
    { at: 300, kind: 'ring', enemy: 'zombie', count: 14, radius: 190, text: '🧟 좀비 동료들이 당신을 에워쌌다! "같이 야근해요..."' },
    { at: 320, kind: 'elite', enemy: 'server', hpMul: ELITE_HP.e4, text: '🖥️ 트래픽 폭주! 서버가 비명을 지릅니다' },
    { at: 333, kind: 'message', text: '14:00 롤백 회의가 소집되었습니다' },
    { at: 360, kind: 'burst', enemy: 'report', count: 14, text: '📑 주간 보고서 제출 마감 10분 전!' },
    { at: 390, kind: 'elite', enemy: 'server', hpMul: ELITE_HP.e5, text: '🖥️ DB 서버까지 다운되었습니다' },
    { at: 400, kind: 'message', text: '15:00 분기 마감까지 3시간' },
    { at: 425, kind: 'ring', enemy: 'meeting', count: 26, radius: 200, text: '📅 긴급 회의 소집! "다들 카메라 켜주세요"' },
    { at: 445, kind: 'swarm', enemy: 'bug', count: 60, text: '🐛 버그 대이동! 서버실에서 탈출했다!' },
    { at: 460, kind: 'elite', enemy: 'server', hpMul: ELITE_HP.e6, text: '🖥️ 백업 서버마저...!' },
    { at: 467, kind: 'message', text: '16:00 "이번 분기 숫자 나왔어?"' },
    { at: 490, kind: 'burst', enemy: 'issue', count: 24, text: '🧨 장애 알림이 폭주합니다! 전부 터지기 직전!' },
    { at: 505, kind: 'elite', enemy: 'server', hpMul: ELITE_HP.e7, text: '🖥️ 마지막 서버! 여기서 진화를 끝내라' },
    { at: 522, kind: 'message', text: '16:50 본부장실 불이 켜졌다...' },
    { at: 533, kind: 'boss', enemy: 'director', hpMul: FINAL_BOSS_HP, text: '17:00 본부장 등장! "숫자 가져와!"' },
    { at: 567, kind: 'message', text: '17:30 서버가 먼저 퇴근했다' },
    { at: 575, kind: 'swarm', enemy: 'ghost_task', count: 50, text: '👻 내일 할 일이 오늘로 당겨졌습니다' },
    { at: 589, kind: 'message', text: '17:50 커밋. 푸시. 그리고... 퇴근!' },
  ],
  finalBoss: 'director',
  overtimePool: pool({ bug: 3, ghost_task: 3, owl: 4, alert: 4, issue: 4, zombie: 4, report: 3, hotfix: 3, deadline: 3, server: 0.1 }),
  unlockedBy: 'u_stage_crunch',
  coinMul: 1.3,
  hpMul: 1.35,
};

// ───────────────────────────── 부서 회식 ─────────────────────────────
const DINNER: StageDef = {
  id: 'dinner',
  name: '부서 회식',
  subtitle: '1차에서 끝날 리 없다',
  desc: '"오늘 회식 필참!" 고깃집 불판 위로 소주병이 행군한다. 폭탄주 부장님이 3차를 외치기 전에 탈출하라.',
  icon: '🍻',
  palette: { floor: '#8a5a3b', floorAlt: '#7e5035', line: '#66412a', accent: '#f97316', fog: '#2a1308' },
  decor: ['🥢', '🍚', '🧂', '🥬', '🧄', '🪑'],
  timeline: timeline([
    { soju: 8, beer: 4 },                                                                               // 0-30
    { soju: 7, beer: 4, cheers: 2 },                                                                    // 30-70
    { soju: 6, beer: 4, cheers: 3, samgyup: 2, mic: 1 },                                                // 70-110
    { soju: 5, beer: 4, cheers: 3, samgyup: 2, mic: 2, bombshot: 1, tambourine: 1 },                    // 110-165
    { soju: 5, beer: 3, cheers: 2, samgyup: 2, mic: 2, bombshot: 2, hangover: 1 },                      // 165-200 건배사 과장
    { soju: 5, beer: 4, samgyup: 2 },                                                                   // 200-230 휴식
    { soju: 4, beer: 3, cheers: 3, samgyup: 3, mic: 3, bombshot: 2, tambourine: 2, hangover: 2 },       // 230-280
    { soju: 4, beer: 3, cheers: 3, samgyup: 3, mic: 3, bombshot: 3, tambourine: 2, hangover: 2 },       // 280-340
    { soju: 3, beer: 3, cheers: 4, samgyup: 3, mic: 3, bombshot: 3, tambourine: 2, hangover: 3 },       // 340-400
    { soju: 3, beer: 3, cheers: 4, samgyup: 3, mic: 4, bombshot: 3, tambourine: 3, hangover: 3 },       // 400-460
    { soju: 3, beer: 3, cheers: 4, samgyup: 4, mic: 4, bombshot: 4, tambourine: 3, hangover: 4 },       // 460-530
    { soju: 5, beer: 3, samgyup: 2, hangover: 2, tambourine: 1 },                                       // 530-565 폭탄주 부장님
    { soju: 3, beer: 4, cheers: 5, samgyup: 3, mic: 4, bombshot: 4, tambourine: 3, hangover: 4 },       // 565-600
  ], 1.1),
  events: [
    { at: 0, kind: 'message', text: '09:00 공지: "오늘 회식 전원 참석" (선택 아님)' },
    { at: 40, kind: 'swarm', enemy: 'beer', count: 26, text: '🍺 "여기 생맥 500 스무 잔이요~!"' },
    { at: 67, kind: 'message', text: '10:00 1차 개시! 불판 달구는 중' },
    { at: 85, kind: 'elite', enemy: 'grill', hpMul: ELITE_HP.e1, text: '♨️ 불판이 달아올랐다! 고기가 쏟아진다' },
    { at: 110, kind: 'ring', enemy: 'soju', count: 18, radius: 180, text: '🍶 "자, 한 바퀴 돌아가며 한 잔씩!"' },
    { at: 125, kind: 'burst', enemy: 'cheers', count: 16, text: '🥂 "짠!" 사방에서 잔이 날아든다!' },
    { at: 133, kind: 'message', text: '11:00 소주 3병째. 아직 초반이다' },
    { at: 145, kind: 'elite', enemy: 'grill', hpMul: ELITE_HP.e2, text: '♨️ "여기 불판 좀 갈아주세요~" (안 갈아줌)' },
    { at: 167, kind: 'boss', enemy: 'toast_master', hpMul: MID_BOSS_HP, text: '11:30 건배사 과장님이 일어서셨다... "한 말씀 드리자면~"' },
    { at: 185, kind: 'swarm', enemy: 'samgyup', count: 22, text: '🥓 "여기 삼겹살 5인분 추가요!"' },
    { at: 202, kind: 'message', text: '12:00 된장찌개와 공깃밥 타임... 잠시 평화' },
    { at: 229, kind: 'burst', enemy: 'bombshot', count: 14, text: '12:30 "자, 이제 제대로 마셔볼까?" 폭탄주 등장!' },
    { at: 250, kind: 'elite', enemy: 'grill', hpMul: ELITE_HP.e3, text: '♨️ 불판 2호기 가동!' },
    { at: 267, kind: 'message', text: '13:00 "고기 더 시켜! 법카 있어!"' },
    { at: 285, kind: 'swarm', enemy: 'beer', count: 40, text: '🍺 생맥주 무한 리필 이벤트 중!' },
    { at: 300, kind: 'ring', enemy: 'tambourine', count: 14, radius: 190, text: '🥁 탬버린 부대가 흥을 돋우며 에워싼다!' },
    { at: 320, kind: 'elite', enemy: 'grill', hpMul: ELITE_HP.e4, text: '♨️ 불판 위에 불판을 올렸다?!' },
    { at: 333, kind: 'message', text: '14:00 누군가 노래방 얘기를 꺼냈다' },
    { at: 360, kind: 'burst', enemy: 'hangover', count: 10, text: '🤢 숙취가 한꺼번에 몰려옵니다...' },
    { at: 390, kind: 'elite', enemy: 'grill', hpMul: ELITE_HP.e5, text: '♨️ 사장님 서비스 불판 등장!' },
    { at: 400, kind: 'message', text: '15:00 폭탄주 제조 라인 풀가동' },
    { at: 425, kind: 'ring', enemy: 'soju', count: 28, radius: 200, text: '🍶 "원샷! 원샷! 원샷!" 소주병에 포위되었다' },
    { at: 445, kind: 'swarm', enemy: 'beer', count: 60, text: '🍺 맥주 타워가 무너졌다!' },
    { at: 460, kind: 'elite', enemy: 'grill', hpMul: ELITE_HP.e6, text: '♨️ 초대형 불판! 숯불 추가요!' },
    { at: 467, kind: 'message', text: '16:00 택시 앱을 몰래 켰다' },
    { at: 490, kind: 'burst', enemy: 'cheers', count: 30, text: '🥂 "마지막 건배~!" (마지막 아님)' },
    { at: 505, kind: 'elite', enemy: 'grill', hpMul: ELITE_HP.e7, text: '♨️ 마지막 불판! 지금 진화하지 않으면 3차 확정' },
    { at: 522, kind: 'message', text: '16:50 부장님이 잔을 채우기 시작하셨다...' },
    { at: 533, kind: 'boss', enemy: 'bomb_bujang', hpMul: FINAL_BOSS_HP, text: '17:00 폭탄주 부장님 등장! "자, 다들 잔 들어!"' },
    { at: 567, kind: 'message', text: '17:30 "2차 가는 사람~?" (전원 강제)' },
    { at: 575, kind: 'swarm', enemy: 'cheers', count: 40, text: '🥂 2차 건배 러시!' },
    { at: 589, kind: 'message', text: '17:50 지금 나가면 막차 탈 수 있다!' },
  ],
  finalBoss: 'bomb_bujang',
  // 야근 모드 = 노래방 2차
  overtimePool: pool({ mic: 5, tambourine: 4, beer: 3, cheers: 4, bombshot: 4, hangover: 4, soju: 3, samgyup: 2, grill: 0.1 }),
  unlockedBy: 'u_stage_dinner',
  coinMul: 1.6,
  hpMul: 1.7,
};

// ───────────────────────────── 명절 친척집 ─────────────────────────────
const HOLIDAY: StageDef = {
  id: 'holiday',
  name: '명절 친척집',
  subtitle: '잔소리 무한 리필',
  desc: '따끈한 장판 위로 날아드는 "취업은?" "결혼은?". 큰이모의 덕담 폭격을 버티고 무사히 귀경하라.',
  icon: '🎑',
  palette: { floor: '#e8c77a', floorAlt: '#dfbb69', line: '#c9a457', accent: '#dc2626', fog: '#5b3a12' },
  decor: ['🍊', '🍐', '🍎', '🧧', '🌕', '🏮'],
  timeline: timeline([
    { nag_job: 6, songpyeon: 5 },                                                                                         // 0-30
    { nag_job: 5, songpyeon: 4, nag_marry: 3, cousin: 2 },                                                                // 30-70
    { nag_job: 4, songpyeon: 4, nag_marry: 3, cousin: 3, nag_salary: 2 },                                                 // 70-110
    { nag_job: 4, songpyeon: 4, nag_marry: 3, cousin: 3, nag_salary: 2, jeon: 1, dishes: 1, nag_weight: 1 },              // 110-165
    { nag_job: 4, songpyeon: 4, nag_marry: 3, cousin: 2, nag_salary: 2, jeon: 1, remote: 1 },                             // 165-200 삼촌
    { songpyeon: 6, nag_job: 3, jeon: 1 },                                                                                // 200-230 휴식
    { nag_job: 3, songpyeon: 4, nag_marry: 3, cousin: 3, nag_salary: 2, nag_weight: 2, jeon: 2, dishes: 2, remote: 2, nag_kids: 1 }, // 230-280
    { nag_job: 3, songpyeon: 3, nag_marry: 3, cousin: 3, nag_salary: 3, nag_weight: 2, jeon: 2, dishes: 2, remote: 2, nag_kids: 1 }, // 280-340
    { nag_job: 3, songpyeon: 3, nag_marry: 3, cousin: 4, nag_salary: 3, nag_weight: 2, jeon: 3, dishes: 3, remote: 3, nag_kids: 2 }, // 340-400
    { nag_job: 3, songpyeon: 3, nag_marry: 3, cousin: 4, nag_salary: 3, nag_weight: 3, jeon: 3, dishes: 3, remote: 3, nag_kids: 2 }, // 400-460
    { nag_job: 3, songpyeon: 3, nag_marry: 4, cousin: 4, nag_salary: 3, nag_weight: 3, jeon: 4, dishes: 3, remote: 4, nag_kids: 2 }, // 460-530
    { songpyeon: 5, nag_job: 3, nag_marry: 2, jeon: 2, nag_kids: 1 },                                                     // 530-565 큰이모
    { nag_job: 3, songpyeon: 4, nag_marry: 4, cousin: 5, nag_salary: 4, nag_weight: 3, jeon: 4, dishes: 3, remote: 4, nag_kids: 3 }, // 565-600
  ], 1.15),
  events: [
    { at: 0, kind: 'message', text: '09:00 친척집 도착. 현관에서부터 시선이 느껴진다' },
    { at: 40, kind: 'swarm', enemy: 'songpyeon', count: 26, text: '🥟 "송편 쪘다~ 먹고 가라~"' },
    { at: 67, kind: 'message', text: '10:00 차례상 준비 완료. 잔소리 준비도 완료' },
    { at: 85, kind: 'elite', enemy: 'gift', hpMul: ELITE_HP.e1, text: '🎁 선물세트 도착! 포장부터 뜯어라' },
    { at: 110, kind: 'ring', enemy: 'nag_job', count: 16, radius: 180, text: '💬 어르신들이 빙 둘러앉으셨다! "그래서 요즘 뭐 하니?"' },
    { at: 125, kind: 'burst', enemy: 'cousin', count: 15, text: '🧒 사촌동생들 집합! 폰을 사수하라!' },
    { at: 133, kind: 'message', text: '11:00 친척들 도착 러시. 인사만 40번째' },
    { at: 145, kind: 'elite', enemy: 'gift', hpMul: ELITE_HP.e2, text: '🎁 또 햄 세트... 아니, 참치 세트다!' },
    { at: 167, kind: 'boss', enemy: 'uncle', hpMul: MID_BOSS_HP, text: '11:30 삼촌 등장! "허허, 이게 누구야~"' },
    { at: 185, kind: 'swarm', enemy: 'songpyeon', count: 32, text: '🥟 송편 2차 배송!' },
    { at: 202, kind: 'message', text: '12:00 점심상 차림. 먹는 동안만은 아무도 안 묻는다' },
    { at: 229, kind: 'burst', enemy: 'nag_marry', count: 20, text: '12:30 식사 끝! "그래서, 만나는 사람은?"' },
    { at: 250, kind: 'elite', enemy: 'grill', hpMul: ELITE_HP.e3, text: '♨️ 전 부치는 불판이 과열됐다!' },
    { at: 267, kind: 'message', text: '13:00 거실에서 윷놀이 판이 벌어졌다' },
    { at: 285, kind: 'swarm', enemy: 'songpyeon', count: 40, text: '🥟 "남으면 아까워~ 싸 가라~"' },
    { at: 300, kind: 'ring', enemy: 'nag_salary', count: 12, radius: 200, text: '💬 사방에서 "연봉은?" 공격!' },
    { at: 320, kind: 'elite', enemy: 'gift', hpMul: ELITE_HP.e4, text: '🎁 한우 세트다! (우리 집 거 아님)' },
    { at: 333, kind: 'message', text: '14:00 사촌동생이 내 폰으로 게임 과금 중' },
    { at: 360, kind: 'burst', enemy: 'dishes', count: 12, text: '🍽️ 설거지 산이 무너졌다!' },
    { at: 390, kind: 'elite', enemy: 'gift', hpMul: ELITE_HP.e5, text: '🎁 과일 바구니 3단 합체!' },
    { at: 400, kind: 'message', text: '15:00 전 부치기 2라운드 돌입' },
    { at: 425, kind: 'ring', enemy: 'nag_marry', count: 26, radius: 200, text: '💬 친척 총출동! "결혼은? 결혼은? 결혼은?"' },
    { at: 445, kind: 'swarm', enemy: 'songpyeon', count: 60, text: '🥟 송편 대이동! 방앗간이 터졌다!' },
    { at: 460, kind: 'elite', enemy: 'grill', hpMul: ELITE_HP.e6, text: '♨️ 산적 굽는 불판 추가 투입!' },
    { at: 467, kind: 'message', text: '16:00 "이제 슬슬 가야지?" (아무도 안 감)' },
    { at: 490, kind: 'burst', enemy: 'cousin', count: 30, text: '🧒 사촌동생 군단이 세뱃돈을 노린다!' },
    { at: 505, kind: 'elite', enemy: 'gift', hpMul: ELITE_HP.e7, text: '🎁 마지막 선물세트! 귀경 전에 진화를 끝내라' },
    { at: 522, kind: 'message', text: '16:50 안방 문이 열린다... 큰이모다' },
    { at: 533, kind: 'boss', enemy: 'big_aunt', hpMul: FINAL_BOSS_HP, text: '17:00 큰이모 등판! "어디 얼굴 좀 보자~"' },
    { at: 567, kind: 'message', text: '17:30 고속도로 정체 시작. 지금 출발해야 한다' },
    { at: 575, kind: 'swarm', enemy: 'songpyeon', count: 50, text: '🥟 "이것도 싸 가!" 송편 대방출!' },
    { at: 589, kind: 'message', text: '17:50 귀경 10분 전! 신발 신는 척을 시작하라!' },
  ],
  finalBoss: 'big_aunt',
  // 야근 모드 = 설거지 당번 확정
  overtimePool: pool({ nag_job: 3, nag_marry: 4, nag_salary: 4, nag_weight: 3, nag_kids: 3, cousin: 5, jeon: 4, dishes: 4, remote: 4, songpyeon: 3, gift: 0.1 }),
  unlockedBy: 'u_stage_holiday',
  coinMul: 2.0,
  hpMul: 2.1,
};

export const STAGES: StageDef[] = [OFFICE, CRUNCH, DINNER, HOLIDAY];
