// Helper toolkit for class skill modules (src/classes/<id>/sim.ts). Import everything a skill needs from here.
import { CLASSES, SKILLS } from '../data/classes';
import { addArea, breakPropsNear, emptyDmg, heroRoll, hurtHero, hurtMonster, scaleDmg, spawnProj } from './combat';
import { circleFree, los, moveCircle, nearestWalkable } from './path';
import { AREA_TICK, ON_ENTER_WORLD, PROJ_HIT, PROJ_MOTION, SKILL_IMPL, type SkillCtx, type SkillImpl } from './registry';
import { fireArrow, hitProp, meleeTargets, nearestMonster, rankOf, swingElem } from './skills';
import type { Game } from './game';
import type { Area, BuffMods, Dmg, Elem, Monster, Proj } from './types';

export {
  CLASSES, SKILLS, SKILL_IMPL, PROJ_MOTION, PROJ_HIT, AREA_TICK, ON_ENTER_WORLD,
  addArea, breakPropsNear, emptyDmg, heroRoll, hurtHero, hurtMonster, scaleDmg, spawnProj,
  circleFree, los, moveCircle, nearestWalkable,
  fireArrow, hitProp, meleeTargets, nearestMonster, rankOf, swingElem,
};
export type { SkillCtx, SkillImpl, Game, Area, Dmg, Elem, Monster, Proj, BuffMods };

/** Registers several skill implementations at once. */
export function registerSkills(map: Record<string, SkillImpl>): void { Object.assign(SKILL_IMPL, map); }

/**
 * A rolled hero hit worth pct% of a weapon swing. `conv` converts the weapon portion to an element.
 * `via` tags how it lands (drives impact visuals/sounds): 'melee' | 'proj' | 'spell'.
 */
export function roll(g: Game, pct: number, conv: Elem | null = null, via: 'melee' | 'proj' | 'spell' = 'spell', wild = false): Dmg {
  const d = heroRoll(g, pct, conv === 'phys' ? null : (conv as never), wild);
  d.via = via;
  return d;
}

/** Fires a hero projectile at angle `ang` from the hero. Returns it for further tweaks. */
export function shoot(g: Game, kind: string, ang: number, d: Dmg, o: Partial<Proj> & { speed?: number; from?: { x: number; y: number } } = {}): Proj {
  const h = g.hero;
  const sp = o.speed ?? 13;
  const fx = o.from?.x ?? h.x + Math.cos(ang) * 0.4, fy = o.from?.y ?? h.y + Math.sin(ang) * 0.4;
  const { speed: _s, from: _f, ...rest } = o;
  void _s; void _f;
  if (!d.via) d.via = 'proj';
  return spawnProj(g, kind, 'hero', fx, fy, Math.cos(ang) * sp, Math.sin(ang) * sp, d, { life: 0.9, r: 0.2, ...rest });
}

/** Adds (or refreshes) a timed hero buff with stat mods; the HUD shows `name`. */
export function addBuff(g: Game, id: string, name: string, dur: number, mods: BuffMods, color?: string): void {
  const h = g.hero;
  h.buffs = h.buffs.filter((b) => b.id !== id);
  h.buffs.push({ id, name, t: dur, dur, v: 1, mods, color });
  h.dirty = true;
}

/** Living monsters within r of (x,y) (distance to their edge). */
export function monstersNear(g: Game, x: number, y: number, r: number, needLos = false): Monster[] {
  const out: Monster[] = [];
  for (const m of g.world.monsters) if (!m.dead && Math.hypot(m.x - x, m.y - y) <= r + m.r && (!needLos || los(g.world, x, y, m.x, m.y))) out.push(m);
  return out;
}

/** Corpses near (x,y) that can still be used (not blown apart, shattered, a boss, or long gone). Nearest first. */
export function corpsesNear(g: Game, x: number, y: number, r: number): Monster[] {
  const out = g.world.monsters.filter((m) => m.dead && m.rank !== 'boss' && m.deadT < 60 && m.deathStyle !== 'gib' && m.deathStyle !== 'shatter' && m.deathStyle !== 'burn' && Math.hypot(m.x - x, m.y - y) <= r);
  return out.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
}

/** Monsters whose centre lies within a segment of width `w` starting at the hero (for line attacks). */
export function monstersOnLine(g: Game, x0: number, y0: number, ang: number, len: number, w: number): Monster[] {
  const ux = Math.cos(ang), uy = Math.sin(ang);
  const out: Monster[] = [];
  for (const m of g.world.monsters) {
    if (m.dead) continue;
    const dx = m.x - x0, dy = m.y - y0;
    const t = dx * ux + dy * uy;
    if (t < -m.r || t > len + m.r) continue;
    const off = Math.abs(dx * uy - dy * ux);
    if (off <= w + m.r && los(g.world, x0, y0, m.x, m.y)) out.push(m);
  }
  return out.sort((a, b) => Math.hypot(a.x - x0, a.y - y0) - Math.hypot(b.x - x0, b.y - y0));
}

/** Monsters within a cone (half-angle `half`) in front of the hero. */
export function monstersInCone(g: Game, ang: number, r: number, half: number): Monster[] {
  const h = g.hero;
  return g.world.monsters.filter((m) => {
    if (m.dead) return false;
    const d = Math.hypot(m.x - h.x, m.y - h.y);
    if (d > r + m.r) return false;
    let da = Math.atan2(m.y - h.y, m.x - h.x) - ang;
    while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    return Math.abs(da) <= half || d < m.r + h.r + 0.2;
  });
}

/** Heals the hero (clamped) and shows a green number. */
export function heal(g: Game, v: number): void {
  const h = g.hero;
  const add = Math.min(h.st.maxHp - h.hp, v);
  if (add <= 0) return;
  h.hp += add;
  if (add >= 1) g.emit({ t: 'dmg', x: h.x, y: h.y, v: Math.round(add), kind: 'heal' });
}

/** Counts this hero's active areas of a kind (e.g. to cap sentries). Removes the oldest beyond `max`. */
export function capAreas(g: Game, kind: string, max: number): void {
  const mine = g.world.areas.filter((a) => a.kind === kind && a.side === 'hero');
  const extra = mine.length - max;
  if (extra > 0) { const drop = new Set(mine.slice(0, extra).map((a) => a.id)); g.world.areas = g.world.areas.filter((a) => !drop.has(a.id)); }
}

export const fx = (g: Game, kind: string, x: number, y: number, o: { x2?: number; y2?: number; r?: number; c?: string; n?: number; pts?: number[] } = {}): void => { g.emit({ t: 'fx', kind, x, y, ...o }); };
export const sfx = (g: Game, id: string, x?: number, y?: number): void => { g.emit({ t: 'sfx', id, x, y }); };
export const shake = (g: Game, v: number): void => { g.emit({ t: 'shake', v }); };
export const swingFx = (g: Game, skill: string, ang: number, r: number): void => { const h = g.hero; g.emit({ t: 'swing', x: h.x, y: h.y, ang, skill, r, elem: swingElem(g) }); };
