// 밸런스 수치 모음. 게임 규칙에 쓰이는 숫자는 가능한 한 이 폴더(src/data)에만 둔다.

/** 영업 시간 규칙 (게임 시간, 초) */
export const TIME = {
  /** 하루 영업 길이 */
  dayLength: 180,
  /** 이 시각 이후 신규 손님 생성 중단 */
  lastArrival: 150,
  /** 마감 정리 "빠르게 보기" 배속 */
  closingFastSpeed: 5,
  /** 시뮬레이션 고정 스텝 */
  step: 1 / 30,
  /** 한 프레임에 처리할 최대 게임 시간(초). 탭 전환 등으로 밀린 시간을 한꺼번에 처리하지 않기 위한 상한 */
  maxFrameDelta: 0.25,
};

/** 합성 보드 */
export const BOARD = {
  cols: 5,
  rows: 5,
  maxTier: 4,
  /** 영업 시작 시 계열별 지급되는 1단계 음식 수 */
  startFoodsPerFamily: 2,
  /** 길게 누르기: 첫 반복까지 지연(ms), 반복 간격(ms) */
  holdDelayMs: 380,
  holdIntervalMs: 170,
};

/** 대기줄 */
export const QUEUE_MAX = 3;

/** 직원 */
export const STAFF = {
  /** 기본 이동 속도 (칸/초) */
  baseSpeed: 2.0,
  /** 강화 단계별 속도 배율 (0=기본) */
  speedMult: [1.0, 1.15, 1.3] as const,
  /** 배식구에서 음식을 받는 시간(초) */
  pickupTime: 0.5,
  /** 손님에게 건네는 시간(초) */
  handoffTime: 0.6,
};

/** 손님 걷는 속도 (칸/초) */
export const CUSTOMER_WALK_SPEED = 2.6;

/** 장식 효과: 좌석과 상하좌우 인접한 장식 1개당 주문 인내 +초, 좌석당 상한 */
export const DECOR = {
  perDecorSec: 5,
  capSec: 10,
};

/** 팁 규칙: 서빙 접수 시점의 남은 인내 비율로 확정 */
export const TIP = {
  /** 이 비율 이상 남았으면 팁 100% */
  fullRatio: 0.6,
  /** 이 비율 이상 남았으면 팁 50%, 미만이면 팁 없음 */
  halfRatio: 0.3,
};

/** 상점 가격 (코인) */
export const PRICES = {
  seat: [60, 120] as const, // 세 번째 좌석, 네 번째 좌석
  decor: 40,
  decorMax: 2,
  staffSpeed: [80, 160] as const, // 1단계, 2단계
};

/** 좌석 */
export const SEATS = { base: 2, max: 4 };

/** 저장 */
export const SAVE = {
  version: 1,
  key: 'monster-stall.save.v1',
  /** 영업 중 주기 저장 간격(초, 실제 시간) */
  autosaveIntervalSec: 3,
  /** 정산 완료 실행 ID를 기억하는 개수 */
  settledHistory: 30,
};

/** 주문 인내 시간 계산: base + perRaw * (원료량 - 1), 이후 영업일 배율과 장식 보너스 적용 */
export function rawCostOfTier(tier: number): number {
  return Math.pow(2, tier - 1);
}
