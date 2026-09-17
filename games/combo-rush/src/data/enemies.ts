// 적 5종 + 보스 2종. 체력·속도·보상·특성.
export type EnemyKind = 'gearbug' | 'sparkrat' | 'boltant' | 'scrapturtle' | 'repairdrone' | 'boss_golem' | 'boss_core';

export interface EnemyDef {
  name: string; trait: string; hint: string;
  hp: number; speed: number; reward: number; armor: number; // armor: 직격 피해 감소(지속 피해에는 미적용)
  lifeDmg: number;     // 기지 도달 시 기지 체력 감소
  radius: number;      // 피격 판정 반경
  boss: boolean;
  color: string; color2: string;
  ctrlResist: boolean; // 회오리 강제 이동 무시, 감속 절반, 빙결 불가
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  gearbug:     { name: '톱니벌레', trait: '기본형', hint: '기준이 되는 적입니다.', hp: 42, speed: 40, reward: 3, armor: 0, lifeDmg: 1, radius: 10, boss: false, color: '#a1887f', color2: '#5d4037', ctrlResist: false },
  sparkrat:    { name: '스파크쥐', trait: '질주형', hint: '체력이 낮지만 빠릅니다. 감속·빙결이 효과적.', hp: 24, speed: 82, reward: 2, armor: 0, lifeDmg: 1, radius: 8, boss: false, color: '#ffd54f', color2: '#f57f17', ctrlResist: false },
  boltant:     { name: '나사개미', trait: '군집형', hint: '작은 적이 무리로 몰려옵니다. 범위·연쇄 공격에 약함.', hp: 13, speed: 52, reward: 1, armor: 0, lifeDmg: 1, radius: 6, boss: false, color: '#8d6e63', color2: '#3e2723', ctrlResist: false },
  scrapturtle: { name: '고철거북', trait: '중장갑형', hint: '느리지만 튼튼하고 직격 피해를 2 줄입니다. 화상·폭발이 효과적.', hp: 170, speed: 24, reward: 7, armor: 2, lifeDmg: 2, radius: 13, boss: false, color: '#78909c', color2: '#37474f', ctrlResist: false },
  repairdrone: { name: '수리드론', trait: '지원형', hint: '주변 적에게 보호막을 씌웁니다. 먼저 처리하세요.', hp: 55, speed: 38, reward: 6, armor: 0, lifeDmg: 1, radius: 10, boss: false, color: '#4dd0e1', color2: '#006064', ctrlResist: false },
  boss_golem:  { name: '고철 골렘', trait: '중간 보스', hint: '체력 50% 아래에서 장갑을 두르고 빨라집니다.', hp: 2200, speed: 22, reward: 60, armor: 1, lifeDmg: 10, radius: 20, boss: true, color: '#9e9e9e', color2: '#ff7043', ctrlResist: true },
  boss_core:   { name: '코어 마스터', trait: '최종 보스', hint: '보호막·부하 소환·가속 패턴을 예고 후 사용합니다.', hp: 4600, speed: 19, reward: 0, armor: 1, lifeDmg: 99, radius: 22, boss: true, color: '#7e57c2', color2: '#ff4081', ctrlResist: true },
};

/** 지원형 적(수리드론) */
export const DRONE = { interval: 4.0, shieldHp: 14, shieldDur: 5.0, radius: 62, maxTargets: 3 };

/** 보스 패턴 수치 */
export const BOSS = {
  golem: { enrageAt: 0.5, enrageArmor: 4, enrageSpeedMul: 1.35 },
  core: {
    telegraph: 2.0,                // 예고 시간
    shieldInterval: { normal: 14, hard: 10 }, shieldHp: 320, shieldDur: 5,
    hasteInterval: { normal: 20, hard: 15 }, hasteMul: 1.8, hasteDur: 3,
    minionAt: { normal: [0.7, 0.35], hard: [0.75, 0.5, 0.25] }, minionCount: 6, minionKind: 'boltant' as EnemyKind,
  },
};
