// Texture cache for all procedural art. Sprites are baked at the current render scale (device pixels per world unit)
// and rebuilt when it changes; effect textures have a fixed resolution. New sprites are baked within a per-frame budget.
import type { ClassId } from '../../../shared/types.ts';
import { type Tex, type PostOpts, makeTex } from './core.ts';
import { LOOKS, drawChar, drawNpc, CHAR_W, CHAR_H, CHAR_FOOT } from './chars.ts';
import { MON_ART } from './mons.ts';
import { FRAME_NAMES, type Pose } from './rig.ts';
import { PROP_ART, drawHouse } from './props.ts';
import { FX_ART } from './fxtex.ts';

export type { Tex } from './core.ts';
/** World units per art unit. */
export const CHAR_WS = 0.66, MON_WS = 0.88, PROP_WS = 0.88;
const CHAR_POST: PostOpts = { rim: '#c8deff', rimA: 0.55, shade: 0.3, ao: 0.2, d: 2 };
const MON_POST: PostOpts = { rim: '#d8ccff', rimA: 0.45, shade: 0.34, ao: 0.18, d: 2 };
const PROP_POST: PostOpts = { rim: '#b8d0ff', rimA: 0.34, shade: 0.4, ao: 0.28, d: 2.4 };
/** Which animation states a monster's art distinguishes (others fall back to 'm'). */
const MON_STATES: Record<string, string> = { bogwisp: 'mw', imp: 'mw', clubber: 'mwd', skeleton: 'mw', foxmage: 'mw', jangseung: 'mwd', boss_chief: 'mw', boss_imugi: 'mw', boss_reaper: 'mw', boss_gumiho: 'mw', boss_bulgasari: 'mw' };

export class Art {
  px = 1; ver = 1; budgetMs = 6;
  private spr = new Map<string, Tex>(); private fxs = new Map<string, Tex>(); private spent = 0; private queue: (() => void)[] = [];
  /** Sets the bake density; returns true if cached sprites were dropped. */
  setScale(s: number): boolean {
    const px = Math.max(0.75, Math.min(2.5, Math.round(s * 4) / 4)); if (px === this.px) return false;
    this.px = px; this.spr.clear(); this.ver++; return true;
  }
  /** Call once per frame: resets the bake budget and works through the prewarm queue. */
  frame(): void { this.spent = 0; const t0 = performance.now(); while (this.queue.length && performance.now() - t0 < 3) this.queue.shift()!(); }
  private bake(key: string, make: () => Tex, fallback?: () => Tex | undefined): Tex {
    let t = this.spr.get(key); if (t) return t;
    if (fallback && this.spent > this.budgetMs) { const f = fallback(); if (f) return f; }
    const t0 = performance.now(); t = make(); this.spent += performance.now() - t0; this.spr.set(key, t); return t;
  }
  private scaled(t: Tex, ws: number): Tex { t.w *= ws; t.h *= ws; return t; }

  player(cls: ClassId, frame: string): Tex {
    const frames = (LOOKS[cls] ?? LOOKS.sword).frames as Record<string, Pose>; const f = frames[frame] ? frame : 'idle0'; const key = `pl:${cls}:${f}`;
    return this.bake(key, () => this.scaled(makeTex(key, CHAR_W, CHAR_H, 0.5, CHAR_FOOT / CHAR_H, this.px * CHAR_WS, c => drawChar(c, cls, frames[f]), CHAR_POST), CHAR_WS), () => this.spr.get(`pl:${cls}:idle0`));
  }
  npc(kind: string, f: number): Tex {
    const key = `npc:${kind}:${f}`;
    return this.bake(key, () => this.scaled(makeTex(key, CHAR_W, CHAR_H, 0.5, CHAR_FOOT / CHAR_H, this.px * CHAR_WS, c => drawNpc(c, kind, f), CHAR_POST), CHAR_WS), () => this.spr.get(`npc:${kind}:0`));
  }
  mon(key: string, f: number, st: string): Tex {
    const a = MON_ART[key] ?? MON_ART.imp; const s = (MON_STATES[key] ?? 'm').includes(st) ? st : 'm'; const fr = f % a.frames; const k = `mon:${key}:${fr}:${s}`;
    return this.bake(k, () => this.scaled(makeTex(k, a.w, a.h, 0.5, a.foot / a.h, this.px * MON_WS, c => a.draw(c, fr, s), a.flame ? undefined : MON_POST), MON_WS), () => this.spr.get(`mon:${key}:0:m`));
  }
  monFrames(key: string): number { return (MON_ART[key] ?? MON_ART.imp).frames; }
  isFlame(key: string): boolean { return !!MON_ART[key]?.flame; }
  prop(kind: string, v: number): Tex {
    const a = PROP_ART[kind] ?? PROP_ART.rock; const key = `prop:${kind}:${v}`;
    return this.bake(key, () => this.scaled(makeTex(key, a.w, a.h, 0.5, a.foot / a.h, this.px * PROP_WS, c => a.draw(c, v), PROP_POST), PROP_WS));
  }
  /** Hanok covering w×h tiles; anchor is the top-left corner of its tile rect. */
  house(w: number, h: number, v: number): Tex {
    const key = `house:${w}:${h}:${v % 3}`; const W = w * 32, H = h * 32;
    return this.bake(key, () => makeTex(key, W + 16, H + 46, 8 / (W + 16), 38 / (H + 46), this.px, c => drawHouse(c, W, H, v % 3), PROP_POST));
  }
  fx(name: string): Tex {
    let t = this.fxs.get(name); if (t) return t;
    const a = FX_ART[name] ?? FX_ART.soft; t = makeTex('fx:' + name, a.w, a.h, a.ax ?? 0.5, a.ay ?? 0.5, a.px, a.draw); t.solo = false; this.fxs.set(name, t); return t;
  }
  /** Queue sprites to bake in idle time (a few ms per frame). */
  prewarm(classes: ClassId[], mons: string[]): void {
    for (const cls of classes) for (const f of FRAME_NAMES) this.queue.push(() => { this.player(cls, f); });
    for (const k of mons) { const a = MON_ART[k]; if (!a) continue; for (let f = 0; f < a.frames; f++) for (const s of MON_STATES[k] ?? 'm') this.queue.push(() => { this.mon(k, f, s); }); }
  }
  /** Run `fn` in idle time (shares the prewarm queue). */
  idle(fn: () => void): void { this.queue.push(fn); }
  pending(): number { return this.queue.length; }
}
