import type { Material } from '../sim/types';

export interface MaterialProps {
  density: number;
  friction: number;
  frictionStatic: number;
  restitution: number;
  frictionAir: number;
  rollingResistance?: number; // px/s², 원형 물체가 접촉 중일 때 일정하게 감속(구름 저항)
  label: string;
}

// 역할별 물리 수치. 레벨마다 임시 보정값을 붙이지 말고 여기서만 조정한다.
export const MATERIALS: Record<Material, MaterialProps> = {
  wood:   { density: 0.0018, friction: 0.45, frictionStatic: 0.6, restitution: 0.05, frictionAir: 0.002, label: '나무' },
  metal:  { density: 0.005,  friction: 0.4,  frictionStatic: 0.5, restitution: 0.08, frictionAir: 0.006, label: '금속' },
  stone:  { density: 0.004,  friction: 0.6,  frictionStatic: 0.7, restitution: 0.02, frictionAir: 0.002, label: '콘크리트' },
  iron:   { density: 0.006,  friction: 0.25, frictionStatic: 0.3, restitution: 0.12, frictionAir: 0.002, rollingResistance: 60, label: '쇠공' },
  crate:  { density: 0.0025, friction: 0.6,  frictionStatic: 0.8, restitution: 0.02, frictionAir: 0.002, label: '보호상자' },
  ground: { density: 1,      friction: 0.8,  frictionStatic: 1.0, restitution: 0.0,  frictionAir: 0,     label: '바닥' },
  cutter: { density: 0.006,  friction: 0.35, frictionStatic: 0.5, restitution: 0.2,  frictionAir: 0,     rollingResistance: 80, label: '커터볼' },
};
