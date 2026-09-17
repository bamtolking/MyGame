// 목표 블록·보호상자 판정. 순수 함수. 기준값은 data/physics.ts의 JUDGE에서만 바꾼다.
import type { BodyEntry } from './world';
import type { Rect } from './types';
import { JUDGE } from '../data/physics';
import { wrapAngle, pointInRect } from './geometry';

/** 넘어뜨리기: 초기 자세 대비 50도 이상 기울고 중심이 실제로 이동했거나, 높이의 1.5배 이상 아래로 떨어짐. */
export function toppleCondition(e: BodyEntry): boolean {
  if (e.removed) return true; // 화면 밖으로 사라짐 = 무너짐
  const dAng = Math.abs(wrapAngle(e.body.angle - e.init.angle));
  const moved = Math.hypot(e.body.position.x - e.init.x, e.body.position.y - e.init.y);
  const size = Math.max(e.w, e.h);
  const tilted = dAng >= (JUDGE.toppleAngleDeg * Math.PI) / 180 && moved >= JUDGE.toppleMinMoveRatio * size;
  const fell = e.body.position.y - e.init.y >= JUDGE.toppleFallRatio * size;
  return tilted || fell;
}

/** 떨어뜨리기: 중심이 표시된 낙하 구역 안에 있음. */
export function dropCondition(e: BodyEntry, zone: Rect): boolean {
  if (e.removed) return false;
  return pointInRect(e.body.position, zone);
}

/** 보호상자 이탈: 중심이 안전 구역 밖. */
export function protectOutCondition(e: BodyEntry, zone: Rect): boolean {
  if (e.removed) return true;
  return !pointInRect(e.body.position, zone);
}

export function toppleAngleDeg(e: BodyEntry): number {
  return Math.abs(wrapAngle(e.body.angle - e.init.angle)) * 180 / Math.PI;
}
