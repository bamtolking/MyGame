// 경제·진행·체력·충격파 등 게임 규칙 수치. 밸런스 조정은 여기서.
export const BALANCE = {
  maxHp: 100,
  startParts: 4,
  rewardParts: { normal: 4, elite: 8 },
  refreshCost: 3,
  healCost: 6,
  healRatio: 0.2,              // 최대 체력의 20%
  dismantleRefund: [1, 2, 4] as const, // 1·2·3등급
  bagSize: 5,
  stages: 12,
  eliteStages: [4, 8],
  bossStage: 12,
  unlockAfterStage: { 4: 2, 8: 2 } as Record<number, number>,
  shockwave: { radius: 130, push: 95, protect: 1.6, damage: 3 },
  stall: { warnAfter: 45, enrageAfter: 55, enrageEvery: 15 }, // 마지막 등장 이후 초 (게임 내부 시간)
  fixedStep: 1 / 60,
  world: { w: 360, h: 460 },
  playerRadius: 14,
  // 보상 후보 등급 확률(2등급 확률, 나머지는 1등급)
  grade2Chance: (stage: number) => (stage >= 9 ? 0.35 : stage >= 5 ? 0.2 : stage >= 3 ? 0.1 : 0),
  // 후보 가중치(종류별)
  rewardWeights: {
    dagger: 7, mg: 9, shotgun: 9, laser: 8, bomb: 7, drone: 8,
    battery: 8, cooler: 7, ammo: 7, lens: 6,
    shield: 6, medkit: 6,
  } as Record<string, number>,
};
export type Difficulty = 'normal' | 'hard';
export const DIFFICULTY_NAMES: Record<Difficulty, string> = { normal: '보통', hard: '어려움' };
