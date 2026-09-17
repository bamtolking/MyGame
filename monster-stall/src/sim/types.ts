// 게임 상태 타입. 렌더링 객체를 포함하지 않는 순수 데이터만 둔다 (저장 가능).
import type { Family } from '../data/foods';
import type { CustomerType } from '../data/customers';
import type { FurnitureKind, Cell } from '../data/store';
import type { RngState } from './rng';

export interface FoodItem {
  id: number;
  family: Family;
  tier: number;
}

/** 5×5 보드. 인덱스 = y*5+x. */
export type Board = Array<FoodItem | null>;

export interface OrderItem { family: Family; tier: number }

export interface Order {
  items: OrderItem[];
  /** 기본 원료 요구량 합 (n단계 = 2^(n-1)) */
  rawCost: number;
  /** 판매액 합 */
  price: number;
}

export type CustomerState =
  | 'queued'     // 대기줄
  | 'walking'    // 출입구 → 좌석으로 이동 중
  | 'ordering'   // 착석, 주문 대기 (인내 감소)
  | 'accepted'   // 서빙 접수됨 (인내 정지, 직원 대기)
  | 'eating'     // 식사 중
  | 'leaving'    // 퇴장 이동 중
  | 'gone';      // 떠남

export type LeaveReason =
  | 'served'          // 정상 서빙 후 퇴장
  | 'full'            // 만석+대기줄 가득으로 입장 못 함
  | 'queue_timeout'   // 대기줄에서 포기
  | 'order_timeout'   // 주문 대기 중 이탈
  | 'closed';         // 마감으로 처리 못 함

export interface Mover {
  pos: Cell;          // 실수 좌표 (칸 단위)
  path: Cell[];       // 앞으로 지나갈 칸들
  pathIdx: number;    // 다음 목표 칸 인덱스
}

export interface Customer extends Mover {
  id: number;
  type: CustomerType;
  arriveAt: number;
  order: Order;
  state: CustomerState;
  leaveReason: LeaveReason | null;
  seatId: number | null;
  /** 좌석 옆 접근 칸 (착석 시 서 있던 칸) */
  accessCell: Cell | null;
  queuePatienceMax: number;
  queuePatience: number;
  orderPatienceMax: number;
  orderPatience: number;
  seatedAt: number | null;
  acceptedAt: number | null;
  deliveredAt: number | null;
  /** 서빙 접수 시점에 확정된 팁 배율 (1, 0.5, 0) */
  tipMult: number;
  /** 접수 시 보드에서 제거·예약된 음식 ID */
  reservedFoodIds: number[];
  eatTimer: number;
  /** 배달 완료 시 확정된 금액 */
  sale: { price: number; tip: number } | null;
  /** 함께 온 손님 ID (연출용) */
  pairWith: number | null;
}

export interface Furniture {
  id: number;
  kind: FurnitureKind;
  x: number;
  y: number;
}

export interface Seat {
  id: number;           // furniture id
  x: number;
  y: number;
  customerId: number | null;
  /** 장식 인접 보너스(초) */
  decorBonus: number;
}

export type StaffPhase = 'idle' | 'pickup' | 'toSeat' | 'handoff' | 'returning';

export interface Staff extends Mover {
  phase: StaffPhase;
  /** 현재 나르는 주문의 손님 ID */
  carrying: number | null;
  timer: number;
}

export interface ScheduledArrival {
  at: number;
  type: CustomerType;
  order: Order;
  pairWith: number | null; // 같이 오는 손님의 schedule index
}

export interface Delivery {
  customerId: number;
  type: CustomerType;
  price: number;
  tip: number;
  /** 접수 → 전달까지 걸린 시간(초) */
  serviceWait: number;
  /** 착석 → 접수까지 걸린 시간(초) */
  orderWait: number;
  items: OrderItem[];
  at: number;
}

export interface Ledger {
  sales: number;
  tips: number;
  deliveries: Delivery[];
  /** 음식 키(family:tier) → 판매 개수 */
  soldByKey: Record<string, number>;
}

export interface RunStats {
  arrived: number;
  served: number;
  happyServed: number;    // 팁 100% 조건으로 접수된 서빙
  turnedAway: number;     // 만석으로 입장 못 함
  leftQueue: number;      // 대기줄 이탈
  leftOrder: number;      // 주문 대기 이탈
  closedUnserved: number; // 마감으로 처리 못 한 주문
  boardFullEvents: number;
  ops: { spawn: number; merge: number; move: number; discard: number; accept: number };
  /** 주문 카드에 나온 원료량 합 */
  rawDemand: number;
}

export type RunPhase = 'open' | 'closing' | 'ended';

export interface RunEvent {
  kind: 'arrive' | 'seated' | 'accepted' | 'delivered' | 'left' | 'spawn' | 'merge' | 'closed' | 'ended' | 'queue';
  customerId?: number;
  tier?: number;
  family?: Family;
  reason?: LeaveReason;
}

export interface RunState {
  runId: string;
  dayId: number;
  seed: number;
  practice: boolean;
  phase: RunPhase;
  t: number;
  minTier: number;
  maxTier: number;
  board: Board;
  nextFoodId: number;
  nextCustomerId: number;
  schedule: ScheduledArrival[];
  scheduleIndex: number;
  customers: Customer[];
  queue: number[];
  seats: Seat[];
  furniture: Furniture[];
  servingQueue: number[];
  staff: Staff;
  staffSpeedLevel: number;
  ledger: Ledger;
  stats: RunStats;
  startFoodsGiven: boolean;
  settled: boolean;
  aborted: boolean;
  rng: RngState;
  /** 렌더/음향용 이벤트 큐 (저장하지 않음) */
  events: RunEvent[];
}

export interface BestRecord { stars: number; income: number; served: number }

export interface Settings { volume: number; muted: boolean }

export interface MetaState {
  coins: number;
  seatsBought: number;   // 0..2
  decorBought: number;   // 0..2
  staffSpeedLevel: number; // 0..2
  layout: Furniture[];
  nextFurnitureId: number;
  unlockedDay: number;   // 1..5
  best: Record<string, BestRecord>;
  tutorialDone: boolean;
  prepHintShown: boolean;
  settings: Settings;
  settledRunIds: string[];
  runsPlayed: number;
  /** 마지막으로 준비 화면에서 본 영업일 */
  lastDay: number;
}

export type Screen = 'title' | 'days' | 'prep' | 'run' | 'result';

export interface GameState {
  meta: MetaState;
  run: RunState | null;
  screen: Screen;
}

export interface ActionResult { ok: boolean; reason?: string }

export function cellIndex(x: number, y: number, cols = 5): number { return y * cols + x; }
