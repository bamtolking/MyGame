// 가게 공간(6×4 격자)과 고정 요소, 기본 배치.

export interface Cell { x: number; y: number }

export const STORE = {
  cols: 6,
  rows: 4,
  /** 주방 배식구 (직원이 음식을 받는 칸) */
  kitchen: { x: 0, y: 0 } as Cell,
  /** 손님 출입구 */
  entrance: { x: 5, y: 3 } as Cell,
};

export type FurnitureKind = 'seat' | 'decor';

export interface FurnitureDef {
  kind: FurnitureKind;
  name: string;
  desc: string;
}

export const FURNITURE_DEFS: Record<FurnitureKind, FurnitureDef> = {
  seat: { kind: 'seat', name: '테이블 좌석', desc: '손님 1명이 앉습니다. 직원은 옆 칸에서 서빙합니다.' },
  decor: { kind: 'decor', name: '등불 장식', desc: '상하좌우로 붙은 좌석의 주문 인내 시간을 +5초 늘립니다 (좌석당 최대 +10초).' },
};

/** 새 게임의 기본 배치: 좌석 2개 */
export const DEFAULT_LAYOUT: Array<{ kind: FurnitureKind; x: number; y: number }> = [
  { kind: 'seat', x: 1, y: 2 },
  { kind: 'seat', x: 3, y: 1 },
];
