import type { WeaponDef, ArmorTag, Layer } from '../types.ts';
import { DAMAGE_MIN_FRAC } from '../data/balance.ts';

/** Raw weapon damage after tag bonuses and layer specialisation (before armor). */
export function rawDamage(w: WeaponDef, atkMult: number, tags: readonly ArmorTag[], layer: Layer): number {
  let raw = w.dmg * atkMult;
  if (w.bonus) {
    for (const t of tags) {
      const m = w.bonus[t];
      if (m !== undefined) raw *= m;
    }
  }
  if (layer === 'air' && w.vsAir !== undefined) raw *= w.vsAir;
  if (layer === 'ground' && w.vsGround !== undefined) raw *= w.vsGround;
  return raw;
}

/** Flat armor with a floor so many weak hits still scratch heavy armor. */
export function afterArmor(raw: number, armor: number): number {
  return Math.max(raw * DAMAGE_MIN_FRAC, raw - armor);
}

export function canHitLayer(w: WeaponDef, layer: Layer): boolean {
  return w.targets === 'both' || w.targets === layer;
}
