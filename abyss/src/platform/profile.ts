// Account-wide progress shared by every character on this browser: which bosses fell on which difficulty and the
// highest hero level reached. Class unlocks are derived from it (see ClassDef.unlock).
import { CLASSES, CLASS_ORDER, type Unlock } from '../data/classes';
import type { SaveData } from '../sim/game';
import type { ClassId } from '../sim/types';
import { loadHero, readKey, writeKey } from './storage';

export interface Profile {
  v: 1;
  /** Boss template → highest difficulty it was defeated on. */
  bosses: Record<string, number>;
  maxLevel: number;
  /** Classes the player has already been told about (for the "new" badge). */
  seen: ClassId[];
  lastClass: ClassId;
}

const KEY = 'profile';
const fresh = (): Profile => ({ v: 1, bosses: {}, maxLevel: 1, seen: ['warrior', 'rogue', 'sorcerer'], lastClass: 'warrior' });

export function loadProfile(): Profile {
  let p: Profile | null = null;
  try { const raw = readKey(KEY); if (raw) { const o = JSON.parse(raw) as Profile; if (o && o.v === 1 && o.bosses) p = { ...fresh(), ...o }; } } catch { /* corrupt → rebuild */ }
  if (!p) { p = fresh(); seedFromSaves(p); saveProfile(p); }
  return p;
}
export function saveProfile(p: Profile): void { writeKey(KEY, JSON.stringify(p)); }

/** Older saves (before the profile existed) still count toward unlocks. */
function seedFromSaves(p: Profile): void {
  for (const cls of CLASS_ORDER) {
    const s = loadHero(cls);
    if (s) absorbSave(p, s);
  }
}
export function absorbSave(p: Profile, s: SaveData): void {
  p.maxLevel = Math.max(p.maxLevel, s.level);
  // saves only know boss kill counts, not the difficulty; the difficulty unlocked implies earlier clears
  for (const [tpl, n] of Object.entries(s.bosses ?? {})) if (n > 0) p.bosses[tpl] = Math.max(p.bosses[tpl] ?? -1, 0);
  if ((s.unlockedDiff ?? 0) >= 1) p.bosses.malegath = Math.max(p.bosses.malegath ?? -1, (s.unlockedDiff ?? 1) - 1);
}

export function unlockMet(p: Profile, u: Unlock | null): boolean {
  if (!u) return true;
  if (u.level !== undefined && p.maxLevel < u.level) return false;
  if (u.boss !== undefined && (p.bosses[u.boss] ?? -1) < (u.diff ?? 0)) return false;
  if (u.boss === undefined && u.diff !== undefined && !Object.values(p.bosses).some((d) => d >= u.diff!)) return false;
  return true;
}
export const isUnlocked = (p: Profile, cls: ClassId): boolean => unlockMet(p, CLASSES[cls].unlock);

/** Progress text for a locked class, e.g. "현재 최고 레벨 7 / 10". */
export function unlockProgress(p: Profile, cls: ClassId): string {
  const u = CLASSES[cls].unlock;
  if (!u) return '';
  if (u.level !== undefined) return `지금까지 최고 레벨 ${p.maxLevel} / ${u.level}`;
  if (u.boss === undefined && u.diff !== undefined) return '';
  return '';
}

/** Records progress; returns classes that just became available. */
export function record(p: Profile, ev: { boss?: string; diff?: number; level?: number }): ClassId[] {
  const before = CLASS_ORDER.filter((c) => isUnlocked(p, c));
  if (ev.boss) p.bosses[ev.boss] = Math.max(p.bosses[ev.boss] ?? -1, ev.diff ?? 0);
  if (ev.level) p.maxLevel = Math.max(p.maxLevel, ev.level);
  const after = CLASS_ORDER.filter((c) => isUnlocked(p, c));
  const gained = after.filter((c) => !before.includes(c));
  saveProfile(p);
  return gained;
}
