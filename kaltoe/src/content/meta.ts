// ─────────────────────────────────────────────────────────────────────────────
// 복지 제도(영구 강화) + 출석 체크 + 일일 보상.
//
// 가격 = baseCost + costStep × 현재단계. 1단계 가격은 100~300 → 첫 판(+업적·출석) 직후 바로 2~3개 구매 가능.
// 만렙 합계 ≈ 40,500 코인(20종, 총 82단계) — 칼퇴 1판 ≈ 400 기준 약 100판짜리 장기 목표.
//   싸고 체감 큰 것(성과급·공용 카트·기가 인터넷·반차 쿠폰)이 먼저 눈에 들어오고,
//   비싼 '한 방'(실손 보험·인턴 채용)은 업적으로 잠겨 있다가 풀리는 순간 새 목표가 된다.
// 잠긴 복지(unlockedBy)는 achievements.ts의 같은 id 업적이 reward {kind:'meta', id}로 해금한다.
//   u_meta_insurance (5판 플레이) · u_meta_stamp (진화 3회) · u_meta_factbomb (60초 무피격)
//   u_meta_resign (궁극기 20회) · u_meta_intern (복지 30단계 구매)
// ※ 총 단계 수(82)는 achievements.ts의 '신의 직장'(metaRanks 82) 목표와 맞춰 둘 것.
// ─────────────────────────────────────────────────────────────────────────────
import type { MetaUpgradeDef } from './types';

export const META_UPGRADES: MetaUpgradeDef[] = [
  // ── 기본 전투 복지 ──
  {
    id: 'fitness', name: '사내 헬스장', icon: '🏋️',
    desc: '피해 +5% / 단계. 점심시간에 쇠질 좀 했습니다',
    stat: 'might', perRank: 0.05, maxRank: 5, baseCost: 200, costStep: 120,          // 총 2,200
  },
  {
    id: 'checkup', name: '건강검진', icon: '🩺',
    desc: '최대 체력 +10 / 단계. 내시경은 수면으로 해 드립니다',
    stat: 'maxHp', perRank: 10, maxRank: 5, baseCost: 120, costStep: 80,            // 총 1,400
  },
  {
    id: 'massage', name: '안마의자', icon: '💆',
    desc: '초당 체력 회복 +0.1 / 단계. 휴게실 안마의자 예약 성공',
    stat: 'recovery', perRank: 0.1, maxRank: 5, baseCost: 150, costStep: 100,       // 총 1,750
  },
  {
    id: 'counsel', name: '심리 상담', icon: '🧠',
    desc: '받는 피해 -1 / 단계. "그 말은 흘려들으셔도 돼요"',
    stat: 'armor', perRank: 1, maxRank: 3, baseCost: 300, costStep: 250,            // 총 1,650
  },
  {
    id: 'automation', name: '업무 자동화', icon: '🤖',
    desc: '무기 쿨타임 -2.5% / 단계. 엑셀 매크로가 대신 일합니다',
    stat: 'cooldown', perRank: 0.025, maxRank: 4, baseCost: 300, costStep: 250,     // 총 2,700
  },
  {
    id: 'partition', name: '파티션 철거', icon: '🧱',
    desc: '공격 범위 +4% / 단계. 칸막이가 사라지자 시야가 넓어졌다',
    stat: 'area', perRank: 0.04, maxRank: 5, baseCost: 200, costStep: 150,          // 총 2,500
  },
  {
    id: 'flex', name: '유연 근무제', icon: '🕰️',
    desc: '효과 지속시간 +5% / 단계. 내 시간은 내가 정한다',
    stat: 'duration', perRank: 0.05, maxRank: 4, baseCost: 150, costStep: 120,      // 총 1,320
  },
  {
    id: 'wifi', name: '기가 인터넷', icon: '📶',
    desc: '투사체 속도 +5% / 단계. 첨부파일이 날아가는 속도로',
    stat: 'projSpeed', perRank: 0.05, maxRank: 4, baseCost: 100, costStep: 80,      // 총 880
  },
  {
    id: 'kickboard', name: '출퇴근 킥보드', icon: '🛴',
    desc: '이동속도 +3% / 단계. 지각은 없다, 퇴근은 빠르다',
    stat: 'moveSpeed', perRank: 0.03, maxRank: 5, baseCost: 150, costStep: 100,     // 총 1,750
  },
  {
    id: 'cart', name: '공용 카트', icon: '🛒',
    desc: '경험치·코인 획득 반경 +10% / 단계. 한 번에 쓸어 담기',
    stat: 'magnet', perRank: 0.1, maxRank: 5, baseCost: 100, costStep: 80,          // 총 1,300
  },

  // ── 성장·보상 복지 ──
  {
    id: 'bonus', name: '성과급', icon: '💰',
    desc: '월급(코인) 획득 +8% / 단계. 제일 먼저 사 두면 이득',
    stat: 'greed', perRank: 0.08, maxRank: 5, baseCost: 100, costStep: 100,         // 총 1,500
  },
  {
    id: 'training', name: '교육 지원', icon: '🎓',
    desc: '경험치 획득 +3% / 단계. 회사 돈으로 듣는 온라인 강의',
    stat: 'growth', perRank: 0.03, maxRank: 5, baseCost: 150, costStep: 120,        // 총 1,950
  },
  {
    id: 'amulet', name: '합격 부적', icon: '🧿',
    desc: '행운 +5% / 단계. 상자 대박·드롭·4번째 선택지 확률 증가',
    stat: 'luck', perRank: 0.05, maxRank: 5, baseCost: 150, costStep: 100,          // 총 1,750
  },

  // ── 선택 조작 복지 ──
  {
    id: 'reroll', name: '재추첨 쿠폰', icon: '🎟️',
    desc: '레벨업 선택지 새로고침 +1회 / 단계. "다시 뽑을게요"',
    stat: 'reroll', perRank: 1, maxRank: 3, baseCost: 200, costStep: 200,           // 총 1,200
  },
  {
    id: 'halfday', name: '반차 쿠폰', icon: '⏭️',
    desc: '레벨업 건너뛰기 +1회 / 단계. 오늘은 이쯤에서 쉬겠습니다(경험치 일부 환급)',
    stat: 'skip', perRank: 1, maxRank: 3, baseCost: 100, costStep: 100,             // 총 600
  },
  {
    id: 'stamp', name: '반려 도장', icon: '⛔',
    desc: '레벨업 선택지 영구 제외 +1회 / 단계. 이 안건은 반려합니다 쾅!',
    stat: 'banish', perRank: 1, maxRank: 3, baseCost: 300, costStep: 300,           // 총 1,800
    unlockedBy: 'u_meta_stamp',
  },

  // ── 해금형 고급 복지 ──
  {
    id: 'factbomb', name: '팩트 폭격 교육', icon: '🎯',
    desc: '치명타 확률 +2% / 단계. 정곡을 찌르는 화법 과정 수료',
    stat: 'crit', perRank: 0.02, maxRank: 5, baseCost: 250, costStep: 150,          // 총 2,750
    unlockedBy: 'u_meta_factbomb',
  },
  {
    id: 'resign', name: '사직서 상비', icon: '✉️',
    desc: '궁극기 충전 속도 +8% / 단계. 언제든 낼 수 있게 가방에 넣어 둔다',
    stat: 'ultCharge', perRank: 0.08, maxRank: 5, baseCost: 200, costStep: 150,     // 총 2,500
    unlockedBy: 'u_meta_resign',
  },
  {
    id: 'insurance', name: '실손 보험', icon: '☂️',
    desc: '부활 +1회 / 단계. 쓰러져도 보험 처리 후 다시 출근',
    stat: 'revival', perRank: 1, maxRank: 2, baseCost: 1200, costStep: 1600,        // 총 4,000
    unlockedBy: 'u_meta_insurance',
  },
  {
    id: 'intern', name: '인턴 채용', icon: '🐣',
    desc: '모든 무기 투사체 +1. 비싸지만 손이 하나 더 생긴다(1단계 한정)',
    stat: 'amount', perRank: 1, maxRank: 1, baseCost: 5000, costStep: 0,            // 총 5,000
    unlockedBy: 'u_meta_intern',
  },
];

/**
 * 출석 체크 7일 주기 보상(코인). 7일째 받은 뒤 1일째로 돌아간다.
 * 1주 합계 1,450 — 매일 한 번만 들어와도 복지 1~2단계씩. 7일째 '주급'이 칼퇴 한 판보다 크다.
 */
export const ATTENDANCE_REWARDS: number[] = [100, 100, 150, 150, 200, 250, 500];

/** 오늘의 업무(일일 도전) 칼퇴 성공 보상 — 하루 1회 */
export const DAILY_CLEAR_REWARD = 300;

/** 오늘의 업무 참여 보상(사망해도 지급) — 하루 1회 */
export const DAILY_PLAY_REWARD = 50;
