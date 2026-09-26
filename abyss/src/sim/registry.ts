// Extension points for class modules (src/classes/<id>/sim.ts). Each module registers its skills'
// behaviour here at import time; the core simulation looks them up by id. No logic lives in this file.
import type { SkillDef } from '../data/classes';
import type { Game } from './game';
import type { Area, Hero, HeroAct, Monster, Proj } from './types';

export interface SkillCtx {
  g: Game; h: Hero; a: HeroAct; def: SkillDef;
  /** Effective skill rank (1 for basic attacks). */
  rank: number;
  /** Aim angle from the hero toward the act's target point (radians). */
  ang: number;
}

export interface SkillImpl {
  /** Extra validation before mana is spent (e.g. a corpse is required). Return false to refuse the cast. */
  canCast?(g: Game, x: number, y: number, targetId: number, rank: number): boolean;
  /** Runs once at the act's impact frame (act.hitAt). */
  apply(c: SkillCtx): void;
  /** Runs every simulation tick while the act lasts (after built-in leap/dash movement), before apply. */
  tick?(c: SkillCtx, dt: number): void;
}

/** Skill behaviour by skill id. */
export const SKILL_IMPL: Record<string, SkillImpl> = {};
/** Custom projectile motion by Proj.motion key: adjust p.vx/p.vy (or p.x/p.y) each tick before it moves. */
export const PROJ_MOTION: Record<string, (g: Game, p: Proj, dt: number) => void> = {};
/** Extra on-hit effect by Proj.onHit key, called after the hit damage was applied. */
export const PROJ_HIT: Record<string, (g: Game, p: Proj, m: Monster) => void> = {};
/** Custom area logic by Area.kind, called on every area tick (see Area docs for the generic behaviour). */
export const AREA_TICK: Record<string, (g: Game, a: Area) => void> = {};
/** Called after the hero arrives in a new world (stairs, waypoint, portal, town, respawn): re-create hero-bound
 *  areas that the old world took with it, e.g. an aura ring whose buff is still running. */
export const ON_ENTER_WORLD: ((g: Game) => void)[] = [];
