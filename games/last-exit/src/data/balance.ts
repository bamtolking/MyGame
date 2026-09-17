// ─────────────────────────────────────────────────────────────
// 밸런스 수치 단일 출처. 게임 규칙의 숫자는 가능한 한 여기서만 바꾼다.
// 단위: 거리 px(타일 32px), 시간 초, 속도 px/초
// ─────────────────────────────────────────────────────────────
export const TILE = 32;
export const DT = 1 / 60;

export const PLAYER = {
  maxHp: 100,
  radius: 11,            // 피격 반경 (그림은 ~28px)
  speed: 175,
  accel: 1800,           // 조이스틱 반응 가속 (정지 시 즉시 멈춤)
  dashTime: 0.18,
  dashSpeed: 640,        // 약 115px 이동
  dashInvuln: 0.16,
  dashCooldown: 4.0,
  hurtInvuln: 0.55,      // 피격 후 피해 중복 방지
  pickupRadius: 40,
  pickupSpeed: 520,
  baseClearHeal: 10,     // 모든 플레이어가 구역 완료 시 회복하는 기본량
};

export const BAG = {
  baseMax: 30,
  upgradeStep: 2,
  upgradeMax: 2,
  /** 적재율 60% 이하 감속 없음, 100%에서 최대 감속 */
  slowStart: 0.6,
  maxSlow: 0.12,
  dropNoPick: 1.2,       // 버린 물건 재획득 지연
};

export const LOOT = {
  scrap: { name: '고철', weight: 3, value: 12, color: '#b08a5a', desc: '무겁지만 흔한 재료' },
  parts: { name: '전자부품', weight: 2, value: 16, color: '#5ad0e0', desc: '가볍고 값이 괜찮다' },
  relic: { name: '희귀 유물', weight: 2, value: 40, color: '#e9c46a', desc: '가볍고 매우 비싸다' },
} as const;

export const WEAPONS = {
  rifle: {
    name: '돌격소총', range: 270, interval: 0.17, dmg: 9, speed: 720, pellets: 1, spread: 0, chains: 0, knock: 40, projR: 4,
    desc: '중거리 단일 대상 연사. 빠른 적과 보스에 안정적.',
    tierDesc: ['기본', '고속 탄환 · 피해 +20%', '이중 총열 · 피해 +45% · 연사 +15%'],
  },
  shotgun: {
    name: '산탄총', range: 150, interval: 0.72, dmg: 6, speed: 560, pellets: 6, spread: 0.42, chains: 0, knock: 140, projR: 4,
    desc: '가까운 부채꼴 6발. 몰린 적에게 강하지만 다가가야 한다. 한 적에게 여러 발이 모두 맞을 수 있다.',
    tierDesc: ['기본', '탄환 +1 · 피해 +20%', '탄환 +2 · 피해 +45% · 밀쳐내기 강화'],
  },
  staff: {
    name: '전기 지팡이', range: 200, interval: 0.5, dmg: 11, speed: 0, pellets: 1, spread: 0, chains: 2, knock: 0, knock2: 0, projR: 0,
    desc: '즉시 타격 후 가까운 적 2명에게 전기가 연결(같은 적 재타격 없음). 군집에 강하고 고립된 강적에게는 약하다.',
    tierDesc: ['기본', '연결 +1 · 피해 +20%', '연결 +2 · 피해 +45% · 연결 감쇠 완화'],
    chainRange: 120, chainFalloff: 0.75,
  },
} as const;
export const TIER_DMG = [1, 1.2, 1.45];
export const TIER_MILESTONES = { z3clear: 1, z5enter: 2 } as const;

export const ABILITIES = {
  rapid: { name: '연사 모듈', maxStack: 2, perStack: [0.18, 0.36], desc: (w: string, s: number) => `공격 속도 +${Math.round([0.18, 0.36][s - 1] * 100)}%` },
  pierce: { name: '관통 코어', maxStack: 2, perStack: [1, 2], desc: (w: string, s: number) => w === 'staff' ? `전기 연결 대상 +${s}` : `탄환 관통 +${s} (적 ${s + 1}명까지 통과)` },
  shock: { name: '충격탄', maxStack: 2, every: [5, 3], dmg: [14, 20], radius: 58, desc: (w: string, s: number) => `${[5, 3][s - 1]}번째 원본 공격마다 반경 58 폭발 (피해 ${[14, 20][s - 1]}). ${w === 'shotgun' ? '산탄 한 번 발사 = 원본 공격 1회.' : ''} 폭발은 다시 폭발을 만들지 않음` },
  frost: { name: '서리 탄두', maxStack: 2, slow: [0.7, 0.6], dur: [1.2, 1.5], bossSlow: 0.88, bossDur: 0.8, desc: (w: string, s: number) => `적중 시 ${[1.2, 1.5][s - 1]}초 동안 이동 속도 ${Math.round((1 - [0.7, 0.6][s - 1]) * 100)}% 감소 (보스 12%). 중첩 없이 갱신만 됨` },
  magnet: { name: '자기장 반지', maxStack: 2, radius: [40, 80], desc: (w: string, s: number) => `전리품 획득 반경 +${[40, 80][s - 1]} (벽 너머는 획득 안 함)` },
  light: { name: '경량 프레임', maxStack: 2, slowReduce: [0.5, 0.9], dashCd: [0.5, 1.0], desc: (w: string, s: number) => `무게 감속 ${Math.round([0.5, 0.9][s - 1] * 100)}% 감소, 대시 대기 -${[0.5, 1.0][s - 1]}초. 무게 수치는 그대로` },
  shield: { name: '응급 보호막', maxStack: 2, amount: [15, 28], desc: (w: string, s: number) => `새 구역 진입 시 보호막 ${[15, 28][s - 1]} (구역당 1회)` },
  mend: { name: '회복 장치', maxStack: 2, pct: [0.12, 0.2], desc: (w: string, s: number) => `구역 완료 시 최대 체력의 ${Math.round([0.12, 0.2][s - 1] * 100)}% 회복 (구역당 1회)` },
} as const;
export const ABILITY_ZONES = [1, 3, 5];
export const ESCAPE_ZONES = [2, 4];

export const ENEMIES = {
  chaser: { name: '추적자', hp: 30, speed: 112, r: 12, dmg: 10, windup: 0.38, reach: 34, cd: 0.9, dr: 0, hint: '기본 근접. 예고 후 휘두른다', dropChance: 0.35 },
  runner: { name: '질주자', hp: 14, speed: 220, r: 10, dmg: 8, windup: 0.22, reach: 30, cd: 0.8, dr: 0, hint: '빠르고 약함. 갑자기 붙는다', dropChance: 0.25 },
  shooter: { name: '사수', hp: 24, speed: 84, r: 12, dmg: 12, windup: 0.6, reach: 0, cd: 1.6, dr: 0, hint: '거리를 두고 예고 후 발사. 벽 뒤에선 못 쏜다', dropChance: 0.35, projSpeed: 250, projR: 6, minDist: 130, maxDist: 220 },
  armored: { name: '장갑병', hp: 110, speed: 52, r: 16, dmg: 18, windup: 0.7, reach: 0, cd: 2.2, dr: 0.25, hint: '튼튼하고 느림. 예고 후 돌진', dropChance: 0.5, chargeSpeed: 380, chargeTime: 0.55, chargeRange: 200 },
  bomber: { name: '자폭체', hp: 18, speed: 118, r: 11, dmg: 25, windup: 0.85, reach: 70, cd: 0, dr: 0, hint: '다가와서 예고 후 폭발. 먼저 잡으면 조용히 죽는다', dropChance: 0.2, fuseDist: 62 },
  boss: { name: '금고 파수꾼', hp: 2000, speed: 58, r: 30, dmg: 0, windup: 0, reach: 0, cd: 0, dr: 0.1, hint: '부채꼴 강타·방사형 투사체·부하 소환. 체력 절반 이하에서 격화', dropChance: 0 },
} as const;

export const BOSS = {
  hp: { normal: 2000, hard: 2400 },
  restTime: { normal: 1.6, hard: 1.2 },
  cone: { telegraph: 0.9, radius: 165, arc: Math.PI / 2, dmg: 24 },
  ring: { telegraph: 0.7, count: 10, count2: 14, speed: 190, dmg: 10, r: 7 },
  summon: { count: 3, max: 3, type: 'chaser' as const, maxAlive: 5 },
  phase2At: 0.5,
  phase2RestMul: 0.7,
  reward: [{ type: 'relic' as const, count: 3 }, { type: 'parts' as const, count: 2 }],
};

export const ESCAPE = {
  need: 8,
  finalNeed: 3,
  padRadius: 82,
  pursuers: {
    2: { normal: [{ at: 0.6, type: 'chaser' as const, n: 2 }, { at: 3.8, type: 'runner' as const, n: 2 }], hard: [{ at: 0.6, type: 'chaser' as const, n: 3 }, { at: 3.5, type: 'runner' as const, n: 2 }, { at: 6, type: 'bomber' as const, n: 1 }] },
    4: { normal: [{ at: 0.6, type: 'chaser' as const, n: 2 }, { at: 2.5, type: 'runner' as const, n: 2 }, { at: 5, type: 'shooter' as const, n: 1 }], hard: [{ at: 0.6, type: 'chaser' as const, n: 3 }, { at: 2.5, type: 'runner' as const, n: 2 }, { at: 4.5, type: 'bomber' as const, n: 1 }, { at: 5.5, type: 'shooter' as const, n: 1 }] },
  } as Record<number, Record<'normal' | 'hard', { at: number; type: 'chaser' | 'runner' | 'shooter' | 'bomber'; n: number }[]>>,
};

export const SPAWN_WARN = 0.8;      // 적 생성 예고 시간
export const WAVE_MIN_GAP = { normal: 6, hard: 4.5 }; // 처치 조건 등장표의 최소 간격(초)
export const SPAWN_MIN_DIST = 170;  // 플레이어와의 최소 생성 거리

export const EVENTS = {
  safeAlarm: { normal: { chaser: 2, runner: 2 }, hard: { chaser: 2, runner: 2, bomber: 1 } } as Record<'normal' | 'hard', Partial<Record<'chaser' | 'runner' | 'shooter' | 'bomber', number>>>,
  safeLoot: { relic: 2, parts: 1 },
  collapseWarn: 3.0,
  drone: { heal: 30, pay: [{ type: 'parts' as const, count: 2 }, { type: 'scrap' as const, count: 3 }] },
  droneChance: 0.7,
  safeChanceZone4: 0.5,
};

export const ECONOMY = {
  unlockShotgun: 320,
  unlockStaff: 520,
  bagUpgrade: [160, 260],
};

export const DIFFICULTY = {
  normal: { name: '보통', desc: '기본 적 조합. 최종 탈출 시 어려움 해금', enemyHpMul: 1, spawnGapMul: 1, lootRelicBonus: 0 },
  hard: { name: '어려움', desc: '위험한 적 비중·등장 간격·보스 속도 강화. 상자에 희귀 유물이 더 자주', enemyHpMul: 1.1, spawnGapMul: 0.8, lootRelicBonus: 0.15 },
} as const;
