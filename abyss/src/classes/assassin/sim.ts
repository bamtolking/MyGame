// assassin: skill behaviour (registered into sim/registry via sim/kit).
// Twin-claw basic, venom stab (hit + 3 s poison), a fan of piercing knives, a smoke bomb (slowing cloud +
// dodge buff), a shadow step behind the target with a guaranteed crit, and blade sentries (max 3).
import {
  AREA_TICK, PROJ_HIT, addArea, addBuff, capAreas, circleFree, emptyDmg, fx, heroRoll, hitProp, hurtMonster, los,
  meleeTargets, nearestWalkable, registerSkills, roll, sfx, shake, shoot, spawnProj, swingFx,
  type Dmg, type Game, type Monster,
} from '../../sim/kit';
import type { HeroAct } from '../../sim/types';

/** Poison part of the venom strike, % of weapon damage over 3 s (matches data.ts detail). */
export const venomPoisonPct = (r: number): number => 150 + 18 * r;
/** Blade sentry: seconds between shots, lifetime, max count, range. */
export const SENTRY = { every: 0.3, dur: 8, max: 3, range: 7, speed: 15 };
const SMOKE_DUR = 6;

const TAU = Math.PI * 2;

function liveTarget(g: Game, a: HeroAct): Monster | null {
  return g.world.monsters.find((m) => m.id === a.targetId && !m.dead) ?? null;
}

/** Forces a rolled hit to be critical (for the shadow step). */
function forceCrit(g: Game, d: Dmg): Dmg {
  if (d.crit) return d;
  const k = g.hero.st.critMult;
  d.phys *= k; d.fire *= k; d.cold *= k; d.light *= k; d.poison *= k;
  d.crit = true;
  return d;
}

/** Nearest free spot on the line hero → (x,y) that the hero can see (sentries are tossed, not teleported). */
function tossSpot(g: Game, x: number, y: number): { x: number; y: number } {
  const h = g.hero, w = g.world;
  const dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy);
  if (!Number.isFinite(d)) return { x: h.x, y: h.y };
  if (d < 0.05) return { x: h.x + Math.cos(h.facing) * 0.8, y: h.y + Math.sin(h.facing) * 0.8 };
  let best = { x: h.x, y: h.y };
  for (let s = 0.25; s <= d + 1e-6; s += 0.25) {
    const px = h.x + (dx / d) * s, py = h.y + (dy / d) * s;
    if (!circleFree(w, px, py, 0.3) || !los(w, h.x, h.y, px, py)) break;
    best = { x: px, y: py };
  }
  if (best.x === h.x && best.y === h.y) {
    const nw = nearestWalkable(w, h.x + Math.cos(h.facing) * 0.6, h.y + Math.sin(h.facing) * 0.6, 1.5);
    if (nw) best = nw;
  }
  return best;
}

registerSkills({
  // ---- basic: twin-claw rake (two crossing arcs, one hit)
  as_slash: {
    apply({ g, h, a, ang }) {
      const ts = meleeTargets(g, a, h.st.reach + h.r, false);
      swingFx(g, 'as_slash', ang, h.st.reach + 0.6);
      swingFx(g, 'as_slash', ang, h.st.reach + 0.45);
      for (const m of ts) {
        hurtMonster(g, m, roll(g, 100, null, 'melee'));
        fx(g, 'as_rake', m.x, m.y, { x2: h.x, y2: h.y });
      }
      if (!ts.length) hitProp(g, a);
      sfx(g, 'as_claw', h.x, h.y);
    },
  },

  // ---- venom strike: fast stab, weapon hit + strong 3 s poison
  as_venom: {
    apply({ g, h, a, def, rank, ang }) {
      const ts = meleeTargets(g, a, h.st.reach + h.r, false);
      const tgt = ts[0];
      const sx = tgt ? tgt.x : h.x + Math.cos(ang) * 1.3, sy = tgt ? tgt.y : h.y + Math.sin(ang) * 1.3;
      fx(g, 'as_stab', h.x, h.y, { x2: sx, y2: sy });
      for (const m of ts) {
        const d = roll(g, def.pct(rank), null, 'melee');
        d.poison += heroRoll(g, venomPoisonPct(rank), 'poison').poison;
        hurtMonster(g, m, d);
        fx(g, 'as_venom', m.x, m.y, { x2: h.x, y2: h.y });
      }
      if (!ts.length) hitProp(g, a);
      sfx(g, 'as_stab', h.x, h.y);
    },
  },

  // ---- throwing knives: a fan of 5 (7 from rank 7) knives, each pierces one enemy
  as_knives: {
    apply({ g, h, def, rank, ang }) {
      const n = rank >= 7 ? 7 : 5;
      const spread = n === 7 ? 0.95 : 0.72;
      const sp = 17;
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * (spread / (n - 1));
        const p = shoot(g, 'as_knife', ang + off, roll(g, def.pct(rank), null, 'proj'), { speed: sp, life: def.range / sp, pierce: 1, r: 0.2, onHit: 'as_knife' });
        p.data = { spin: g.rng.range(0, TAU), rate: g.rng.range(22, 30) * (i % 2 ? 1 : -1) };
      }
      fx(g, 'as_throw', h.x, h.y, { x2: h.x + Math.cos(ang), y2: h.y + Math.sin(ang), n });
    },
  },

  // ---- smoke bomb: 6 s slowing cloud around the hero + dodge buff
  as_smoke: {
    apply({ g, h, def, rank }) {
      const dodge = Math.min(70, def.pct(rank));
      addBuff(g, 'as_smoke', '연막', SMOKE_DUR, { dodge }, '#b39ad8');
      addArea(g, 'as_smoke', 'hero', h.x, h.y, def.range, SMOKE_DUR, emptyDmg(), { tick: 0.2, data: { chill: 0.45, noDmg: 1 } });
      capAreas(g, 'as_smoke', 2);
      fx(g, 'as_smokeBomb', h.x, h.y, { r: def.range });
      shake(g, 0.15);
      sfx(g, 'as_smokePop', h.x, h.y);
    },
  },

  // ---- shadow step: blink behind the target, then a guaranteed critical strike
  as_shadow: {
    tick({ g, h, a }) {
      const st = (a.data ??= {});
      if (st.moved) return;
      st.moved = 1;
      const x0 = h.x, y0 = h.y;
      let tx = a.tx, ty = a.ty;
      if (!Number.isFinite(tx) || !Number.isFinite(ty) || !circleFree(g.world, tx, ty, h.r)) { tx = h.x; ty = h.y; }
      a.fx = x0; a.fy = y0;
      h.x = tx; h.y = ty;
      h.path = null;
      const m = liveTarget(g, a);
      if (m) { h.facing = Math.atan2(m.y - h.y, m.x - h.x); a.tx = m.x; a.ty = m.y; }
      else { a.tx = h.x + Math.cos(h.facing); a.ty = h.y + Math.sin(h.facing); }
      fx(g, 'as_shadowStep', x0, y0, { x2: tx, y2: ty });
    },
    apply({ g, h, a, def, rank }) {
      const m0 = liveTarget(g, a);
      if (m0) h.facing = Math.atan2(m0.y - h.y, m0.x - h.x);
      const ang = m0 ? h.facing : Math.atan2(a.ty - h.y, a.tx - h.x);
      const ts = meleeTargets(g, a, h.st.reach + h.r + 0.3, false);
      swingFx(g, 'as_shadow', ang, h.st.reach + 0.8);
      for (const m of ts) {
        hurtMonster(g, m, forceCrit(g, roll(g, def.pct(rank), null, 'melee')));
        fx(g, 'as_shadowSlash', m.x, m.y, { x2: h.x, y2: h.y });
      }
      if (!ts.length) hitProp(g, a);
      shake(g, ts.length ? 0.35 : 0.1);
      sfx(g, 'as_shadowHit', h.x, h.y);
    },
  },

  // ---- blade sentry: tossed trap that fires knives at the nearest enemy every 0.3 s for 8 s (max 3)
  as_sentry: {
    apply({ g, h, a, def, rank }) {
      const p = tossSpot(g, a.tx, a.ty);
      const face = Math.atan2(p.y - h.y, p.x - h.x);
      // the oldest sentry beyond the cap folds up (visual only; capAreas removes it)
      const mine = g.world.areas.filter((q) => q.kind === 'as_sentry' && q.side === 'hero');
      for (const old of mine.slice(0, Math.max(0, mine.length + 1 - SENTRY.max))) fx(g, 'as_sentryBreak', old.x, old.y);
      addArea(g, 'as_sentry', 'hero', p.x, p.y, 0.45, SENTRY.dur, emptyDmg(), {
        tick: SENTRY.every, tickT: 0.4,
        // hx/hy: where it was tossed from (the art flies it in); ang/shot/n drive the turret animation
        data: { noDmg: 1, range: SENTRY.range, pct: def.pct(rank), ang: Number.isFinite(face) ? face : h.facing, shot: -9, n: 0, hx: h.x, hy: h.y },
      });
      capAreas(g, 'as_sentry', SENTRY.max);
      fx(g, 'as_sentryDrop', p.x, p.y, { x2: h.x, y2: h.y });
      sfx(g, 'as_sentryDeploy', p.x, p.y);
    },
  },
});

/** Sentry brain: aim at the nearest visible enemy and fire a knife. */
AREA_TICK.as_sentry = (g, a) => {
  if (a.side !== 'hero') return;
  // last tick of its life: announce the fold-up (r = seconds left, so the visual lands on time)
  if (a.t + a.tick > a.dur && !a.data.ending) { a.data.ending = 1; fx(g, 'as_sentryBreak', a.x, a.y, { r: Math.max(0, a.dur - a.t) }); sfx(g, 'as_sentryBreak', a.x, a.y); }
  const w = g.world, range = a.data.range ?? SENTRY.range;
  let best: Monster | null = null, bd = range;
  for (const m of w.monsters) {
    if (m.dead) continue;
    const d = Math.hypot(m.x - a.x, m.y - a.y) - m.r;
    if (d < bd && los(w, a.x, a.y, m.x, m.y)) { bd = d; best = m; }
  }
  if (!best) return;
  const ang = Math.atan2(best.y - a.y, best.x - a.x);
  if (!Number.isFinite(ang)) return;
  a.data.ang = ang; a.data.shot = a.t; a.data.n = (a.data.n ?? 0) + 1;
  const d = roll(g, a.data.pct ?? 60, null, 'proj');
  d.srcX = a.x; d.srcY = a.y;
  const sp = SENTRY.speed;
  spawnProj(g, 'as_sentryKnife', 'hero', a.x + Math.cos(ang) * 0.35, a.y + Math.sin(ang) * 0.35, Math.cos(ang) * sp, Math.sin(ang) * sp, d,
    { life: (range + 1) / sp, r: 0.18, targetId: best.id, homing: 2.5, onHit: 'as_knife', data: { spin: 0, rate: 30 } });
  fx(g, 'as_sentryShot', a.x, a.y, { x2: best.x, y2: best.y });
  sfx(g, 'as_sentryShot', a.x, a.y);
};

/** Knife impact: steel glint + ring (visual/sound only). */
PROJ_HIT.as_knife = (g, p, m) => {
  fx(g, 'as_knifeHit', m.x, m.y, { x2: p.x - p.vx * 0.05, y2: p.y - p.vy * 0.05 });
  sfx(g, 'as_knifeHit', m.x, m.y);
};
