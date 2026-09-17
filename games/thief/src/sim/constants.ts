// Fixed simulation rules. Changing these changes what recordings mean, so bump MAP versions if you do.
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const DEFAULT_ATTEMPT_SECONDS = 25;
export const MAX_GHOSTS = 3;
export const TILE = 40;

export const PLAYER = {
  radius: 13,
  speed: 160,            // px/s
  maxHp: 6,
  hitInvulnSec: 0.8,
  dashSpeed: 500,
  dashDurationSec: 0.15,
  dashCooldownSec: 3.0,
  interactRange: 90,     // generator focus range
  coreRange: 26,         // standing this close to an open vault starts the grab
  coreGrabSec: 0.7,      // hold time next to the open vault to take the core
} as const;

export type WeaponId = 'rifle' | 'shotgun';
export interface WeaponDef {
  id: WeaponId; name: string; range: number; intervalTicks: number; damage: number;
  pellets: number; spreadRad: number; speed: number; lifeTicks: number; radius: number; knockback: number;
}
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  rifle:   { id: 'rifle',   name: '연사 소총', range: 280, intervalTicks: 10, damage: 5, pellets: 1, spreadRad: 0.035, speed: 760, lifeTicks: 26, radius: 3, knockback: 40 },
  shotgun: { id: 'shotgun', name: '산탄총',   range: 140, intervalTicks: 40, damage: 5, pellets: 6, spreadRad: 0.42, speed: 620, lifeTicks: 15, radius: 3, knockback: 110 },
};

export const ENEMY = {
  chaser: { radius: 15, hp: 30, speed: 128, detectRange: 210, hearRange: 230, contactDamage: 1, contactCooldownSec: 0.9, investigateWaitSec: 1.2, loseSightSec: 1.5, name: '추적 경비' },
  turret: { radius: 19, hp: 60, range: 330, telegraphSec: 0.6, cooldownSec: 1.3, shotSpeed: 330, shotDamage: 1, shotRadius: 6, shotLifeSec: 1.6, name: '고정 포탑' },
  heavy:  { radius: 19, hp: 150, speed: 72, detectRange: 230, hearRange: 0, leash: 40, swingRange: 80, swingArcRad: 1.1, windupSec: 0.6, swingCooldownSec: 1.6, swingDamage: 2, investigateWaitSec: 1.2, loseSightSec: 2.0, name: '중장갑 경비' },
} as const;

export const DEVICE = {
  generatorHp: 150,
  generatorRadius: 20,
  laserDamage: 2,
  laserWarnSec: 0.8,     // blink before a timed laser turns on
  plateRadius: 30,
  vaultRadius: 32,
  vaultCloseDelaySec: 2.5, // after conditions break, vault stays open this long
  exitRadius: 34,
  spawnGraceTicks: 1,
} as const;
