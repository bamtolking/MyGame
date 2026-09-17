// 스테이지 작성 도우미. 좌표는 모두 월드 좌표(540×960, 바닥 윗면 y=900).
import type { BlockDef, BallDef, RampDef, RopeDef, HingeDef, Material, BodyRole, Vec2, Rect } from '../../sim/types';
import { GROUND_Y, WORLD_W } from '../physics';

export const G = GROUND_Y;
export const W = WORLD_W;
export const LAUNCHER: Vec2 = { x: 70, y: 856 };

type BlockExtra = Partial<Pick<BlockDef, 'angle' | 'static' | 'role' | 'label'>>;

/** 중심 좌표로 블록 생성 */
export function block(id: string, x: number, y: number, w: number, h: number, material: Material, extra: BlockExtra = {}): BlockDef {
  return { kind: 'block', id, x, y, w, h, material, ...extra };
}
/** 아랫면 y를 기준으로 세워진 블록(기둥·상자) */
export function standing(id: string, x: number, bottomY: number, w: number, h: number, material: Material, extra: BlockExtra = {}): BlockDef {
  return block(id, x, bottomY - h / 2, w, h, material, extra);
}
/** 목표 블록(넘어뜨리기 대상) */
export function target(id: string, x: number, bottomY: number, w: number, h: number, material: Material = 'wood', extra: BlockExtra = {}): BlockDef {
  return standing(id, x, bottomY, w, h, material, { role: 'target', ...extra });
}
/** 정적 발판·선반 */
export function ledge(id: string, x: number, topY: number, w: number, h: number, material: Material = 'stone'): BlockDef {
  return block(id, x, topY + h / 2, w, h, material, { static: true });
}
export function ball(id: string, x: number, bottomY: number, r: number, material: Material = 'iron', extra: Partial<Pick<BallDef, 'role' | 'static'>> = {}): BallDef {
  return { kind: 'ball', id, x, y: bottomY - r, r, material, ...extra };
}
export function ramp(id: string, x: number, y: number, w: number, h: number, dir: 'left' | 'right', material: Material = 'stone'): RampDef {
  return { kind: 'ramp', id, x, y, w, h, dir, material };
}
/** 경사면 위 특정 x에서의 표면 y */
export function rampSurfaceY(r: RampDef, x: number): number {
  const t = (x - r.x) / r.w;
  return r.dir === 'right' ? r.y + t * r.h : r.y + (1 - t) * r.h;
}
/** 경사면 위에 놓인 공(표면에 접하도록 법선 방향으로 띄움) */
export function ballOnRamp(id: string, r: RampDef, x: number, radius: number, material: Material = 'iron'): BallDef {
  const th = Math.atan2(r.h, r.w);
  const sy = rampSurfaceY(r, x);
  // 바깥쪽 법선: 오른쪽으로 내려가는 면은 (sinθ, -cosθ), 왼쪽으로 내려가는 면은 (-sinθ, -cosθ)
  const nx = (r.dir === 'right' ? 1 : -1) * Math.sin(th);
  return { kind: 'ball', id, x: x + nx * radius, y: sy - radius * Math.cos(th) - 0.5, r: radius, material };
}
/** 경사면과 평행하게 놓인 정적 멈춤턱(공 아래쪽) */
export function rampStop(id: string, r: RampDef, x: number, w = 12, h = 26, material: Material = 'wood', dynamic = false): BlockDef {
  const th = Math.atan2(r.h, r.w) * (r.dir === 'right' ? 1 : -1);
  const sy = rampSurfaceY(r, x);
  const nx = Math.sin(th), ny = -Math.cos(th); // 표면 법선(위쪽)
  return block(id, x + nx * (h / 2), sy + ny * (h / 2), w, h, material, { angle: (th * 180) / Math.PI, static: !dynamic, role: 'support' });
}
export function rope(id: string, a: { body?: string; x: number; y: number }, b: { body?: string; x: number; y: number }): RopeDef {
  return { kind: 'rope', id, a, b };
}
export function hinge(id: string, body: string, pivot: Vec2, post = true): HingeDef {
  return { kind: 'hinge', id, body, pivot, post };
}
export function rect(x: number, y: number, w: number, h: number): Rect { return { x, y, w, h }; }
/** 밧줄에 매달린 추: 고정점 (ax, ay)에서 길이 len 아래에 w×h 금속 추 */
export function hangingWeight(id: string, ropeId: string, ax: number, ay: number, len: number, w = 44, h = 44, material: Material = 'metal') {
  const weightTop = ay + len;
  const body = block(id, ax, weightTop + h / 2, w, h, material, { role: 'weight' });
  return { body, rope: rope(ropeId, { x: ax, y: ay }, { body: id, x: ax, y: weightTop }) };
}
/** 도미노 열: 왼쪽부터 n개 */
export function dominoRow(prefix: string, startX: number, gap: number, n: number, bottomY: number, w: number, h: number, material: Material = 'wood', role: BodyRole = 'target'): BlockDef[] {
  const out: BlockDef[] = [];
  for (let i = 0; i < n; i++) out.push(standing(`${prefix}${i + 1}`, startX + i * gap, bottomY, w, h, material, { role }));
  return out;
}
