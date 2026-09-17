// 적 5종 + 보스 1종 정의.
export type EnemyType = 'basic' | 'rusher' | 'swarm' | 'armored' | 'bomber' | 'boss';

export interface EnemyDef {
  type: EnemyType;
  name: string;
  hp: number;
  speed: number;        // px/s
  damage: number;       // 근접 공격 1회 피해 (자폭형은 폭발 피해)
  attackInterval: number;
  radius: number;
  armor: number;        // 피격당 고정 감소량 (최소 피해 비율은 ARMOR_MIN_RATIO)
  knockbackResist: number; // 0=그대로 밀림, 1=안 밀림
  color: string; accent: string;
  fuse?: number;        // 자폭형: 예고 시간
  blastRadius?: number; // 자폭형: 폭발 반경
  hint: string;
}

export const ARMOR_MIN_RATIO = 0.3;

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  basic:   { type: 'basic', name: '고철 깡통', hp: 30, speed: 46, damage: 6, attackInterval: 1.0, radius: 13, armor: 0, knockbackResist: 0, color: '#8d8d8d', accent: '#ffcc80', hint: '기준이 되는 적' },
  rusher:  { type: 'rusher', name: '질주 바퀴', hp: 14, speed: 112, damage: 5, attackInterval: 0.8, radius: 11, armor: 0, knockbackResist: 0, color: '#ef6c00', accent: '#ffe0b2', hint: '체력이 낮지만 매우 빠름' },
  swarm:   { type: 'swarm', name: '나사벌레', hp: 6, speed: 72, damage: 2, attackInterval: 0.7, radius: 7, armor: 0, knockbackResist: 0, color: '#9ccc65', accent: '#33691e', hint: '작은 적이 다수 등장' },
  armored: { type: 'armored', name: '장갑 궤도', hp: 95, speed: 27, damage: 12, attackInterval: 1.4, radius: 17, armor: 4, knockbackResist: 0.6, color: '#546e7a', accent: '#b0bec5', hint: '느리지만 튼튼 · 피격당 피해 4 감소' },
  bomber:  { type: 'bomber', name: '폭주 연료통', hp: 20, speed: 82, damage: 22, attackInterval: 99, radius: 12, armor: 0, knockbackResist: 0, color: '#d32f2f', accent: '#ffeb3b', fuse: 0.9, blastRadius: 52, hint: '접근 후 짧게 예고하고 폭발' },
  boss:    { type: 'boss', name: '거대 고철 수거기', hp: 4200, speed: 22, damage: 16, attackInterval: 2.0, radius: 36, armor: 2, knockbackResist: 1, color: '#5d4037', accent: '#ff8f00', hint: '부하 소환 · 예고 있는 압축 공격 · 체력 구간마다 변화' },
};

export const BOSS = {
  summonInterval: [9, 7.5, 6] as const,     // 단계별(체력 100~66 / 66~33 / 33~0)
  crushInterval: 12,
  crushTelegraph: 1.5,
  crushDamage: 30,
  phaseThresholds: [0.66, 0.33] as const,
  phaseDamageTaken: [1, 1.15, 1.3] as const, // 장갑판이 떨어져 피해를 더 받음
  phaseSpeed: [1, 1.25, 1.5] as const,
  phaseStun: 1.0,
};

// 구간별 적 체력·피해 배율 (보통 난이도). 어려움은 waves.ts에서 별도 조정.
export const STAGE_HP_MUL = [1.0, 1.15, 1.3, 1.5, 1.6, 1.8, 2.0, 2.3, 2.5, 2.8, 3.1, 1.0];
export const STAGE_DMG_MUL = [1.0, 1.05, 1.1, 1.2, 1.25, 1.3, 1.35, 1.45, 1.5, 1.55, 1.6, 1.0];
