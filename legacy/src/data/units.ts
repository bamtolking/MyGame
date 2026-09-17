import type { UnitKind, Grade, MythicId } from '../sim/types';

export interface UnitDef {
  kind: UnitKind;
  name: string;
  role: string;
  desc: string;
  atk: number;          // base damage per hit (normal grade)
  cd: number;           // seconds between attacks
  range: number;
  priority: 'first' | 'strong' | 'fast' | 'cluster' | 'armored';
  proj: 'arrow' | 'cracker' | 'shard' | 'glob' | 'coin' | 'bolt' | 'pulse' | 'puff';
  color: string;
  splash?: number;      // AoE radius (raccoon)
  chain?: number;       // chain count (rabbit)
  slow?: number;        // slow fraction (penguin)
  corroDps?: number;    // corrosion dps (mushroom)
  pull?: number;        // pull distance (bear)
  aura?: number;        // attack speed buff (mechanic)
  income?: number;      // gold per wave (toad)
  sell: number;         // sell value at normal
}

export const GRADE_MULT = [1, 2.6, 6.5, 15] as const;       // damage multiplier by grade
export const GRADE_RANGE_BONUS = [0, 8, 16, 24] as const;
export const SELL_VALUE = [10, 30, 80, 200] as const;

export const UNITS: Record<UnitKind, UnitDef> = {
  archer: { kind: 'archer', name: '태엽 사수', role: '단일 저격', desc: '빠르고 안정적인 단일 공격. 긴 직선과 보스 집중에 강함.', atk: 12, cd: 0.5, range: 120, priority: 'first', proj: 'arrow', color: '#e8b04a', sell: 10 },
  raccoon: { kind: 'raccoon', name: '폭죽 너구리', role: '범위 폭발', desc: '느리지만 넓게 터지는 폭죽. 뭉친 적에게 강함. 부식된 적에겐 추가 폭발.', atk: 30, cd: 1.6, range: 105, priority: 'cluster', proj: 'cracker', splash: 45, color: '#ff7043', sell: 10 },
  penguin: { kind: 'penguin', name: '얼음 펭귄', role: '감속 지원', desc: '피해는 낮지만 적을 늦춤(최대 60%). 번개와 만나면 전도.', atk: 6, cd: 0.8, range: 110, priority: 'fast', proj: 'shard', slow: 0.30, color: '#4fc3f7', sell: 10 },
  rabbit: { kind: 'rabbit', name: '번개 토끼', role: '연쇄 공격', desc: '여러 적을 이어서 공격. 감속된 적에겐 전도(추가 피해·연결 +1).', atk: 10, cd: 1.0, range: 110, priority: 'cluster', proj: 'bolt', chain: 3, color: '#ffee58', sell: 10 },
  mushroom: { kind: 'mushroom', name: '산성 버섯', role: '지속 피해', desc: '부식(지속 피해, 방어력 -10%/중첩, 최대 3중첩). 장갑 적에 강함.', atk: 4, cd: 1.2, range: 100, priority: 'armored', proj: 'glob', corroDps: 4, color: '#9ccc65', sell: 10 },
  bear: { kind: 'bear', name: '자석 곰', role: '군중 제어', desc: '작은 적을 끌어모아 범위 공격을 돕는다. 보스는 끌리지 않고 약화만.', atk: 8, cd: 1.4, range: 100, priority: 'cluster', proj: 'pulse', pull: 26, color: '#b39ddb', sell: 10 },
  mechanic: { kind: 'mechanic', name: '증기 정비사', role: '아군 보조', desc: '인접(95) 아군 공격 속도 증가. 같은 종류 버프는 가장 큰 것만 적용.', atk: 5, cd: 1.0, range: 90, priority: 'first', proj: 'puff', aura: 0.15, color: '#bcaaa4', sell: 10 },
  toad: { kind: 'toad', name: '황금 두꺼비', role: '경제', desc: '웨이브 종료 시 추가 골드(모든 두꺼비 합산 상한 60). 전투력은 낮음.', atk: 3, cd: 1.5, range: 90, priority: 'first', proj: 'coin', income: 4, color: '#ffd54f', sell: 10 },
};
export const UNIT_KINDS: UnitKind[] = ['archer', 'raccoon', 'penguin', 'rabbit', 'mushroom', 'bear', 'mechanic', 'toad'];

// Per-grade secondary effect scaling (data-driven, shown in UI)
export const EFFECT_BY_GRADE = {
  splash: [45, 53, 61, 69],
  chain: [3, 4, 5, 6],
  slow: [0.30, 0.36, 0.42, 0.48],
  corroDps: [4, 7, 12, 20],
  pull: [26, 32, 38, 44],
  aura: [0.15, 0.20, 0.25, 0.30],
  income: [4, 10, 22, 45],
} as const;

export const SLOW_CAP = 0.6;
export const CORRO_MAX_STACKS = 3;
export const CORRO_ARMOR_PER_STACK = 0.1;
export const ASPD_CAP = 0.6;       // total attack speed bonus cap from buffs
export const TOAD_CAP = 60;
export const MECH_AURA_RANGE = 95;   // covers orthogonally adjacent slots (80~90 apart), not diagonals
export const MOVE_COOLDOWN = 1.5;

export interface MythicDef {
  id: MythicId; name: string; role: string; desc: string; atk: number; cd: number; range: number; color: string;
  recipe: { kind: UnitKind; grade: Grade }[];
}
export const MYTHICS: Record<MythicId, MythicDef> = {
  storm: { id: 'storm', name: '폭풍룡', role: '연쇄 폭풍', desc: '전도된 적을 잇는 번개 폭풍(최대 8연결). 밀집 처리에 강하지만 고립된 장갑 보스엔 다른 지원이 필요.', atk: 55, cd: 1.1, range: 140, color: '#7c4dff',
    recipe: [{ kind: 'rabbit', grade: 2 }, { kind: 'penguin', grade: 2 }, { kind: 'archer', grade: 1 }] },
  sun: { id: 'sun', name: '태양포대', role: '대형 폭격', desc: '예고 후 떨어지는 대형 폭발(반경 75)과 짧은 연소 지대. 강력하지만 공격 사이 빈틈이 있음.', atk: 260, cd: 3.6, range: 150, color: '#ff9100',
    recipe: [{ kind: 'raccoon', grade: 2 }, { kind: 'mushroom', grade: 2 }, { kind: 'archer', grade: 1 }] },
  chrono: { id: 'chrono', name: '시간술사', role: '시간 영역', desc: '반경 100 시간 영역: 적 -35% 속도, 아군 +30% 공격 속도(상한 적용). 자체 피해는 낮음.', atk: 12, cd: 0.9, range: 100, color: '#00e5ff',
    recipe: [{ kind: 'penguin', grade: 2 }, { kind: 'mechanic', grade: 2 }, { kind: 'rabbit', grade: 1 }] },
  colossus: { id: 'colossus', name: '황금거신', role: '중력 충격', desc: '4초마다 중력 충격파(반경 110): 잡몹을 끌어모아 0.6초 기절(재적용 3초 제한), 보스는 제어 대신 2배 피해. 웨이브당 +10골드.', atk: 70, cd: 4.0, range: 110, color: '#ffd600',
    recipe: [{ kind: 'bear', grade: 2 }, { kind: 'toad', grade: 2 }, { kind: 'mechanic', grade: 1 }] },
};
export const MYTHIC_IDS: MythicId[] = ['storm', 'sun', 'chrono', 'colossus'];
export const MAX_MYTHICS_ON_FIELD = 2;
