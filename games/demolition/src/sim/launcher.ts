// 발사 입력(각도·세기) ↔ 초기 속도, 조준 미리보기. 화면 크기와 무관한 월드 좌표.
import Matter from 'matter-js';
import type { ShotInput, Vec2 } from './types';
import { LAUNCH, GRAVITY_Y, SUB_DELTA_MS } from '../data/physics';

/** 당김 벡터(포인터 − 발사대, 월드 px) → 발사 입력. 너무 짧으면 null(취소). */
export function dragToShot(drag: Vec2): ShotInput | null {
  const len = Math.hypot(drag.x, drag.y);
  if (len < LAUNCH.minDrag) return null;
  const power = Math.min(1, len / LAUNCH.maxDrag);
  // 반대 방향으로 발사. 화면 y는 아래가 양수이므로 수학 각도로 바꿀 때 y를 뒤집는다.
  const dirX = -drag.x / len, dirY = -drag.y / len;
  const angleDeg = (Math.atan2(-dirY, dirX) * 180) / Math.PI;
  return { angleDeg: round3(angleDeg), power: round3(power) };
}

/** 당김을 최대 거리로 제한한 표시용 벡터 */
export function clampDrag(drag: Vec2): Vec2 {
  const len = Math.hypot(drag.x, drag.y);
  if (len <= LAUNCH.maxDrag) return { x: drag.x, y: drag.y };
  return { x: (drag.x / len) * LAUNCH.maxDrag, y: (drag.y / len) * LAUNCH.maxDrag };
}

export function shotToVelocity(shot: ShotInput): Vec2 {
  const speed = LAUNCH.maxSpeed * Math.max(0, Math.min(1, shot.power));
  const a = (shot.angleDeg * Math.PI) / 180;
  return { x: Math.cos(a) * speed, y: -Math.sin(a) * speed }; // px/s
}

/**
 * 초기 비행 궤적 미리보기. 엔진과 같은 Verlet 적분(서브스텝 간격)으로 계산하므로 실제 첫 비행과 일치한다.
 * hitTest가 true를 돌려주는 첫 지점 이전까지만 반환한다(첫 충돌 이후는 예측하지 않음).
 */
export function previewTrajectory(origin: Vec2, shot: ShotInput, hitTest?: (p: Vec2) => boolean): Vec2[] {
  const v = shotToVelocity(shot);
  const dt = SUB_DELTA_MS;
  const g = GRAVITY_Y * 0.001 * dt * dt;
  let pos = { x: origin.x, y: origin.y };
  let prev = { x: origin.x - (v.x / 1000) * dt, y: origin.y - (v.y / 1000) * dt };
  const pts: Vec2[] = [];
  const totalSub = Math.round(LAUNCH.previewSeconds * 1000 / dt);
  const every = Math.max(1, Math.round(totalSub / LAUNCH.previewPoints));
  for (let i = 1; i <= totalSub; i++) {
    const vx = pos.x - prev.x, vy = pos.y - prev.y + g;
    prev = pos;
    pos = { x: pos.x + vx, y: pos.y + vy };
    if (hitTest && hitTest(pos)) break;
    if (i % every === 0) pts.push({ x: pos.x, y: pos.y });
  }
  return pts;
}

export function makeHitTest(bodies: Matter.Body[]): (p: Vec2) => boolean {
  return (p) => Matter.Query.point(bodies, p).length > 0;
}

function round3(n: number) { return Math.round(n * 1000) / 1000; }
