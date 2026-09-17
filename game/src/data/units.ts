// 유닛 8종의 모든 밸런스 수치. 등급(1~3) 변화, 상태 효과 수치, 비용도 여기에서만 관리합니다.
export type UnitKind = 'flame' | 'oil' | 'vortex' | 'frost' | 'laser' | 'tesla' | 'bomber' | 'engineer';
export type Grade = 1 | 2 | 3;
export const UNIT_KINDS: readonly UnitKind[] = ['flame', 'oil', 'vortex', 'frost', 'laser', 'tesla', 'bomber', 'engineer'];

/** 등급 공통 배율. 2등급은 1등급 2기 합보다 조금 더 강하고(슬롯 1개 절약), 3등급은 공격 방식이 바뀝니다. */
export const GRADE_MUL: Record<Grade, { dmg: number; range: number; cd: number }> = {
  1: { dmg: 1.0, range: 0, cd: 1.0 },
  2: { dmg: 2.15, range: 8, cd: 0.95 },
  3: { dmg: 4.6, range: 16, cd: 0.9 },
};
export const GRADE_NAME: Record<Grade, string> = { 1: '1등급', 2: '2등급', 3: '3등급' };

export interface UnitDef {
  name: string;          // 표시 이름
  family: 'bot' | 'spirit';
  role: string;          // 한 줄 역할
  desc: string;          // 기본 설명
  g3: string;            // 3등급 변화 설명
  color: string;         // 대표색
  color2: string;        // 보조색
  dmg: number;           // 1등급 기본 피해
  cd: number;            // 공격 간격(초)
  range: number;         // 사거리(논리 px)
  attack: 'projectile' | 'lob' | 'beam' | 'chain' | 'pulse' | 'aura';
  sfx: string;
}

export const UNITS: Record<UnitKind, UnitDef> = {
  flame: { name: '화염봇', family: 'bot', role: '지속 피해 · 기름 점화', desc: '화염탄을 쏘아 화상을 남깁니다. 기름이 묻은 적을 맞히면 점화 폭발.', g3: '부채꼴 화염 방사: 전방 범위의 모든 적을 태웁니다.', color: '#ff7043', color2: '#ffab40', dmg: 7, cd: 0.85, range: 92, attack: 'projectile', sfx: 'shoot_flame' },
  oil: { name: '기름분사기', family: 'bot', role: '연계 조건 생성', desc: '기름을 뿌려 적을 미끄럽게 적십니다. 자체 피해는 낮지만 화염과 만나면 폭발.', g3: '광역 분사: 훨씬 넓은 범위에 기름을 퍼뜨리고 더 오래 남습니다.', color: '#8d6e63', color2: '#d7ccc8', dmg: 2, cd: 1.5, range: 96, attack: 'lob', sfx: 'shoot_oil' },
  vortex: { name: '회오리 정령', family: 'spirit', role: '적 집결', desc: '주기적으로 회오리를 일으켜 근처 적을 한곳으로 끌어모읍니다. 보스는 감속·표식만.', g3: '거대 회오리: 더 넓고 강하게 모으며 표식이 오래 남습니다.', color: '#b39ddb', color2: '#e1bee7', dmg: 3, cd: 2.6, range: 74, attack: 'pulse', sfx: 'vortex' },
  frost: { name: '빙결술사', family: 'spirit', role: '감속 · 연계 조건', desc: '냉기탄으로 적을 느리게 만듭니다. 레이저·번개와 연계됩니다.', g3: '범위 냉각: 착탄 지점 주변을 얼리고 잠깐 빙결시킵니다.', color: '#4fc3f7', color2: '#e1f5fe', dmg: 6, cd: 0.95, range: 100, attack: 'projectile', sfx: 'shoot_frost' },
  laser: { name: '레이저병', family: 'bot', role: '직선 관통', desc: '직선 광선으로 줄지어 오는 적을 한꺼번에 뚫습니다.', g3: '중광선: 더 굵고 긴 광선으로 더 많은 적을 관통합니다.', color: '#ef5350', color2: '#ff8a80', dmg: 8, cd: 1.2, range: 105, attack: 'beam', sfx: 'shoot_laser' },
  tesla: { name: '번개코일', family: 'bot', role: '밀집 처리', desc: '번개가 가까운 적들 사이를 튀어 다닙니다. 같은 적은 한 번만 맞습니다.', g3: '폭풍 코일: 연결 대상이 늘고 감쇠 없이 튑니다.', color: '#ffee58', color2: '#fff9c4', dmg: 8, cd: 1.15, range: 88, attack: 'chain', sfx: 'shoot_tesla' },
  bomber: { name: '폭탄병', family: 'bot', role: '범위 폭발', desc: '포물선으로 폭탄을 던져 착탄 지점 주변을 폭파합니다.', g3: '파편 폭탄: 폭발 뒤 파편이 흩어져 2차 폭발을 일으킵니다.', color: '#90a4ae', color2: '#ff5252', dmg: 14, cd: 2.5, range: 120, attack: 'lob', sfx: 'shoot_bomb' },
  engineer: { name: '동력공병', family: 'spirit', role: '지원 · 공격 속도', desc: '인접한 유닛의 공격 속도를 높입니다. 레이저병과 함께 두면 과충전 광선.', g3: '과충전 발전기: 주기적으로 범위 안 유닛의 다음 공격을 강화합니다.', color: '#66bb6a', color2: '#c8e6c9', dmg: 0, cd: 1, range: 96, attack: 'aura', sfx: 'engineer' },
};

/** 유닛별 세부 수치(등급별). 상태 효과의 지속시간·수치도 여기서 관리. */
export const UNIT_PARAMS = {
  flame: {
    projSpeed: 260,
    burnDps: { 1: 3, 2: 6, 3: 10 } as Record<Grade, number>,
    burnDur: 3.0,
    coneAngle: Math.PI / 3.2,   // 3등급 부채꼴 각도(전체)
  },
  oil: {
    projSpeed: 170,
    splash: { 1: 24, 2: 30, 3: 46 } as Record<Grade, number>,
    oilDur: { 1: 6, 2: 7, 3: 9 } as Record<Grade, number>,
  },
  vortex: {
    pullSpeed: { 1: 55, 2: 70, 3: 95 } as Record<Grade, number>,  // 경로를 따라 되돌리는 속도(px/s)
    pullDur: 0.9,                                                 // 한 번의 회오리가 끄는 시간
    markDur: { 1: 2.5, 2: 3.0, 3: 4.0 } as Record<Grade, number>,
    bossSlow: 0.15,                                               // 보스: 강제 이동 대신 감속
    bossSlowDur: 1.5,
  },
  frost: {
    projSpeed: 250,
    chillPct: { 1: 0.35, 2: 0.42, 3: 0.5 } as Record<Grade, number>,
    chillDur: 2.5,
    chillCap: 0.6,           // 감속 상한(중첩 방지)
    splash3: 42,             // 3등급 범위 냉각 반경
    freeze3: 0.6,            // 3등급 빙결 시간
    freezeImmune: 3.0,       // 빙결 후 면역 시간(무한 빙결 방지)
  },
  laser: {
    length: { 1: 150, 2: 165, 3: 210 } as Record<Grade, number>,
    width: { 1: 10, 2: 12, 3: 18 } as Record<Grade, number>,
  },
  tesla: {
    targets: { 1: 3, 2: 4, 3: 6 } as Record<Grade, number>,
    jump: { 1: 58, 2: 64, 3: 74 } as Record<Grade, number>,
    falloff: { 1: 0.8, 2: 0.85, 3: 1.0 } as Record<Grade, number>,
  },
  bomber: {
    radius: { 1: 38, 2: 42, 3: 48 } as Record<Grade, number>,
    flight: 0.7,
    frags3: 4, fragRadius3: 26, fragDmgMul3: 0.3, fragSpread3: 40,
  },
  engineer: {
    haste: { 1: 0.18, 2: 0.26, 3: 0.34 } as Record<Grade, number>,   // 공격 속도 증가
    hasteCap: 0.45,                                                   // 지원 중첩 상한
    stackSecond: 0.5,                                                 // 두 번째 공병 효과 반영 비율
    overchargeInterval: { 1: 6.0, 2: 5.0, 3: 4.0 } as Record<Grade, number>, // 레이저 과충전 주기(연계 ⑥)
    pulseInterval3: 8.0,                                              // 3등급 과충전 발전기 주기
    pulseMul3: 1.6,                                                   // 발전기 강화 배율
  },
} as const;

/** 상태 효과 공통 규칙 */
export const STATUS = {
  igniteCd: 1.5,    // 같은 적에게 점화 폭발 재발동 대기
  shardCd: 1.0,     // 같은 적에게 얼음 파편 재발동 대기
  fireVortexDur: 2.0,
  fireVortexCd: 5.0,
  fireVortexDps: { 1: 6, 2: 11, 3: 20 } as Record<Grade, number>,
};

export const GRADE_INVEST: Record<Grade, number> = { 1: 25, 2: 50, 3: 100 }; // 등급별 실제 투입 골드(합성 시 합산과 동일)
export const MAX_GRADE: Grade = 3;

export function unitStats(kind: UnitKind, grade: Grade): { dmg: number; cd: number; range: number } {
  const d = UNITS[kind]; const g = GRADE_MUL[grade];
  return { dmg: d.dmg * g.dmg, cd: d.cd * g.cd, range: d.range + g.range };
}
