/**
 * Central balance constants. Every tunable number of the economy, map and
 * match rules lives here so it can be adjusted in one place.
 */
export const TICK_RATE = 20; // simulation ticks per second
export const DT = 1 / TICK_RATE;

export const MAP = {
  W: 2400,
  H: 1000,
  /** y range flankers use as edge lanes */
  laneTop: 70,
  laneBottom: 930,
  /** left-team layout; right team is mirrored (x' = W - x) */
  spawnX0: 60,
  spawnColGap: 30, // 8 columns -> 60..270
  spawnY0: 190,
  spawnRowGap: 124, // 6 rows -> 190..810
  coreX: 380,
  coreY: 500,
  coreR: 50,
  outpostX: 720,
  outpostY: 500,
  outpostR: 40,
  relayX: 1200,
  relayY: 500,
  relayR: 130,
  /** emergency cannon usable zone: own side up to this x (left team) */
  cannonZoneX: 940,
};

export const ROSTER = { cols: 8, rows: 6, popCap: 60 };

export const ECON = {
  startCredits: 400,
  baseIncome: 4, // credits per second
  /** economy research: cost = base + step*level, each level adds incomePerLevel */
  econBaseCost: 140,
  econStepCost: 45,
  econIncomePerLevel: 1.0,
  econMaxLevel: 8,
  techCost: { 2: 250, 3: 450 } as Record<number, number>,
  upgradeCosts: [150, 250, 350],
  upgradeMax: 3,
  sellRefund: 0.7,
  relayBonusFrac: 0.08, // of base income per commander
  relayCaptureSeconds: 8,
  /** kill bounty: small, flat, to avoid snowballing (credits per pop of killed unit) */
  killBountyPerPop: 0,
};

export const MATCH = {
  setupSeconds: 20,
  countdownSeconds: 3,
  interval1v1: 25,
  teamStagger: 15,
  teamInterval: 45,
  overtimeStart: 12 * 60,
  overtimeStep: 30,
  overtimeDmgStep: 0.3,
  timeLimit: 15 * 60,
  coreHp: 4500,
  coreArmor: 12, // small arms scratch buildings; siege units (anti-armor/artillery) matter
  outpostHp: 3000,
  outpostArmor: 10,
  coreTurret: { dmg: 46, cycle: 0.9, range: 240 },
  outpostTurret: { dmg: 32, cycle: 0.8, range: 215 },
  cannon: { dmg: 130, radius: 120, warning: 1.5, slow: { factor: 0.5, duration: 3 } },
};

export const UPGRADE = {
  attackPerLevel: 0.08,
  armorPerLevel: 1,
  hpPerLevel: 0.06,
  supportPerLevel: 0.25,
};

/** damage formula: effective = max(raw*minFrac, raw - armor) */
export const DAMAGE_MIN_FRAC = 0.25;
