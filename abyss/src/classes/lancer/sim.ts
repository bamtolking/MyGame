// lancer: skill behaviour (registered into sim/registry via sim/kit).
// Long-reach thrust (basic), piercing thrust along a line, a whirling sweep that knocks enemies back, a lightning
// javelin that pierces everything and arcs to two neighbours per hit, the dragon's descent (leap + thunder landing)
// and storm thrusts (eight cone thrusts synced with the channel animation, then a rolling lightning wave).
import {
  PROJ_HIT, PROJ_MOTION, breakPropsNear, fx, hitProp, hurtMonster, los, meleeTargets, monstersInCone, monstersNear,
  monstersOnLine, registerSkills, roll, sfx, shake, shoot, swingElem,
  type Game, type Monster, type SkillCtx,
} from '../../sim/kit';
import { BASE_BY_ID } from '../../data/items';
import { opaque } from '../../sim/path';
import { DRAGON, JAVELIN, PIERCE, STORM, SWEEP, THRUST, stormAt } from './shared';

const dist = (m: { x: number; y: number }, x: number, y: number): number => Math.hypot(m.x - x, m.y - y);
/** Clear sight from (x0,y0) to (x1,y1) including the end tile itself (sim/path los() skips the end tile). */
const clear = (g: Game, x0: number, y0: number, x1: number, y1: number): boolean =>
  !opaque(g.world, Math.floor(x1), Math.floor(y1)) && los(g.world, x0, y0, x1, y1);

/** Aim angle of the act (falls back to the hero's facing when the target point sits on the hero). */
function aimOf(c: SkillCtx): number {
  const { h, a } = c;
  return Math.hypot(a.tx - h.x, a.ty - h.y) > 0.05 ? c.ang : h.facing;
}

/** Farthest point (and its distance) along a ray from (x0,y0) that is still in sight: thrust streaks stop at walls. */
function lineEnd(g: Game, x0: number, y0: number, ang: number, len: number): { x: number; y: number; d: number } {
  const ux = Math.cos(ang), uy = Math.sin(ang);
  let d = 0;
  for (let s = 0.25; s <= len + 1e-6; s += 0.25) {
    if (!clear(g, x0, y0, x0 + ux * s, y0 + uy * s)) break;
    d = s;
  }
  if (d > len - 0.25 && clear(g, x0, y0, x0 + ux * len, y0 + uy * len)) d = len;
  return { x: x0 + ux * d, y: y0 + uy * d, d };
}

/** Tier of the equipped lance (the thrown javelin looks like it). */
function weaponTier(g: Game): number {
  const w = g.hero.equip.weapon;
  return w ? BASE_BY_ID[w.base]?.tier ?? 0 : 0;
}

// ------------------------------------------------------------------ lightning javelin
// Detects the end of the flight so the renderer can burst the spear into sparks there: its range, a wall, or a
// barrel / crate (the core projectile update smashes those and stops the spear). Walks the same 0.2-tile sub-steps.
const smashable = (g: Game, x: number, y: number): boolean => {
  const tx = Math.floor(x), ty = Math.floor(y);
  return g.world.props.some((q) => !q.used && q.blocks && (q.kind === 'barrel' || q.kind === 'crate') && Math.floor(q.x) === tx && Math.floor(q.y) === ty);
};
PROJ_MOTION.ln_javelin = (g, p, dt) => {
  const d = (p.data ??= {});
  if (d.end) return;
  const end = (x: number, y: number, hard: number): void => { d.end = 1; fx(g, 'ln_javelinEnd', x, y, { x2: x + p.vx, y2: y + p.vy, n: hard }); };
  if (p.life <= 0) { end(p.x, p.y, 0); return; } // out of range: it does not move this tick
  const n = Math.max(1, Math.ceil((Math.hypot(p.vx, p.vy) * dt) / 0.2));
  let x = p.x, y = p.y;
  for (let s = 1; s <= n; s++) {
    const nx = p.x + (p.vx * dt * s) / n, ny = p.y + (p.vy * dt * s) / n;
    if (!clear(g, x, y, nx, ny)) { end(x, y, 1); return; }
    if (smashable(g, nx, ny)) { end(nx, ny, 1); return; }
    x = nx; y = ny;
  }
};
// Every enemy the spear passes through sends lightning to the two nearest other enemies around it.
PROJ_HIT.ln_javelin = (g, p, m) => {
  const pct = p.data?.pct ?? 0;
  const near = g.world.monsters.filter((o) => !o.dead && o !== m && dist(o, m.x, m.y) <= JAVELIN.arcR + o.r && los(g.world, m.x, m.y, o.x, o.y));
  near.sort((q, r) => dist(q, m.x, m.y) - dist(r, m.x, m.y) || q.id - r.id);
  let n = 0;
  for (const t of near.slice(0, JAVELIN.arcN)) {
    hurtMonster(g, t, roll(g, pct, 'light', 'spell'));
    fx(g, 'ln_arc', m.x, m.y, { x2: t.x, y2: t.y, n: n++ });
  }
  fx(g, 'ln_javelinHit', m.x, m.y, { x2: m.x - p.vx, y2: m.y - p.vy, n });
  sfx(g, n ? 'ln_arc' : 'ln_javelinHit', m.x, m.y);
};

// ------------------------------------------------------------------ storm thrusts
function stormThrust(c: SkillCtx, i: number): void {
  const { g, h, def, rank } = c;
  const ang = aimOf(c);
  const ms = monstersInCone(g, ang, def.range, STORM.half).filter((m) => los(g.world, h.x, h.y, m.x, m.y));
  for (const m of ms) hurtMonster(g, m, roll(g, def.pct(rank), null, 'melee'));
  if (i === 0 || i === STORM.n - 1) breakPropsNear(g, h.x + Math.cos(ang) * def.range * 0.5, h.y + Math.sin(ang) * def.range * 0.5, def.range * 0.5);
  const end = lineEnd(g, h.x, h.y, ang, def.range);
  fx(g, 'ln_stormThrust', h.x, h.y, { x2: end.x, y2: end.y, n: i, c: swingElem(g) });
}

function stormCatchUp(c: SkillCtx, upTo: number): void {
  const d = (c.a.data ??= {});
  let n = d.n ?? 0;
  while (n < upTo) { stormThrust(c, n); n++; }
  d.n = n;
}

// ------------------------------------------------------------------ whirling spear
function sweepWhirl(c: SkillCtx): void {
  const { g, h, a, def } = c;
  (a.data ??= {}).whirl = 1;
  const ms = Math.round(Math.max(0.1, a.dur * (SWEEP.k1 - SWEEP.k0)) * 1000);
  // x2/y2: the hero's facing (the renderer mirrors the rig by it, and the effect turns the same way as the lance)
  fx(g, 'ln_sweep', h.x, h.y, { r: def.range, x2: h.x + Math.cos(h.facing), y2: h.y + Math.sin(h.facing), n: ms, c: swingElem(g) });
  sfx(g, 'ln_sweep', h.x, h.y);
}

// ------------------------------------------------------------------ skills
registerSkills({
  // ---- basic: a long straight stab at the target (the reach is the lancer's strength)
  ln_thrust: {
    apply(c) {
      const { g, h, a } = c;
      const ts: Monster[] = meleeTargets(g, a, h.st.reach + h.r, false);
      const ang = ts[0] ? Math.atan2(ts[0].y - h.y, ts[0].x - h.x) : aimOf(c);
      if (ts[0]) h.facing = ang;
      const len = ts[0] ? Math.max(1, dist(ts[0], h.x, h.y) + THRUST.extra) : h.st.reach + h.r + THRUST.extra;
      const end = lineEnd(g, h.x, h.y, ang, len);
      fx(g, 'ln_thrust', h.x, h.y, { x2: end.x, y2: end.y, c: swingElem(g) });
      for (const m of ts) hurtMonster(g, m, roll(g, 100, null, 'melee'));
      if (!ts.length) hitProp(g, a);
      sfx(g, 'ln_stab', h.x, h.y);
    },
  },

  // ---- piercing thrust: every enemy on a straight line in front
  ln_pierce: {
    apply(c) {
      const { g, h, a, def, rank } = c;
      const ang = aimOf(c);
      const end = lineEnd(g, h.x, h.y, ang, def.range);
      const ms = monstersOnLine(g, h.x, h.y, ang, def.range, PIERCE.width);
      for (const m of ms) {
        const d = roll(g, def.pct(rank), null, 'melee');
        d.kb = PIERCE.kb; d.srcX = h.x; d.srcY = h.y;
        hurtMonster(g, m, d);
      }
      for (let s = 0.8; s <= end.d + 0.01; s += 0.9) breakPropsNear(g, h.x + Math.cos(ang) * s, h.y + Math.sin(ang) * s, 0.2);
      if (!ms.length) hitProp(g, a);
      fx(g, 'ln_pierce', h.x, h.y, { x2: end.x, y2: end.y, n: ms.length, c: swingElem(g) });
      sfx(g, 'ln_pierce', h.x, h.y);
      if (ms.length) shake(g, 0.14);
    },
  },

  // ---- whirling spear: a full circle around the lancer, knocking everything back
  ln_sweep: {
    // the whirl starts (visual + gust sound) at k0; n carries its duration (ms) so the effect turns with the lance
    tick(c) {
      const { a } = c;
      if (!a.data?.whirl && a.t >= a.dur * SWEEP.k0) sweepWhirl(c);
    },
    apply(c) {
      const { g, h, a, def, rank } = c;
      if (!a.data?.whirl) sweepWhirl(c);
      const r = def.range;
      const ms = monstersNear(g, h.x, h.y, r, true);
      for (const m of ms) {
        const d = roll(g, def.pct(rank), null, 'melee');
        d.kb = SWEEP.kb; d.srcX = h.x; d.srcY = h.y;
        hurtMonster(g, m, d);
      }
      breakPropsNear(g, h.x, h.y, r);
      if (ms.length) shake(g, 0.2);
    },
  },

  // ---- lightning javelin: pierces everything along its flight; each hit arcs to two nearby enemies
  ln_javelin: {
    apply(c) {
      const { g, h, def, rank } = c;
      const ang = aimOf(c);
      const d = roll(g, def.pct(rank), 'light', 'proj');
      shoot(g, 'ln_javelin', ang, d, {
        speed: JAVELIN.speed, life: def.range / JAVELIN.speed, r: JAVELIN.r, pierce: 1e6,
        motion: 'ln_javelin', onHit: 'ln_javelin', data: { pct: def.pct(rank) * JAVELIN.arcPct, tier: weaponTier(g) },
      });
      fx(g, 'ln_javelinThrow', h.x, h.y, { x2: h.x + Math.cos(ang), y2: h.y + Math.sin(ang) });
    },
  },

  // ---- dragon's descent: leap (built-in movement, invulnerable) and a thunderous landing
  ln_dragon: {
    tick(c) {
      const { g, h, a } = c;
      const d = (a.data ??= {});
      if (!d.start) {
        d.start = 1;
        fx(g, 'ln_dragonMark', a.tx, a.ty, { r: DRAGON.r, x2: a.fx, y2: a.fy });
        fx(g, 'ln_dragonJump', a.fx, a.fy, { x2: a.tx, y2: a.ty });
      }
      d.f = (d.f ?? 0) + 1;
      if (d.f % 2 === 0) fx(g, 'ln_dragonTrail', h.x, h.y, { r: Math.min(1, a.t / a.dur), x2: a.tx, y2: a.ty });
    },
    apply(c) {
      const { g, h, a, def, rank } = c;
      const ms = monstersNear(g, h.x, h.y, DRAGON.r, true);
      for (const m of ms) {
        const d = roll(g, def.pct(rank), null, 'melee');
        const half = d.phys * 0.5;
        d.phys -= half; d.light += half;
        d.stun = DRAGON.stun; d.kb = DRAGON.kb; d.srcX = h.x; d.srcY = h.y;
        hurtMonster(g, m, d);
      }
      breakPropsNear(g, h.x, h.y, DRAGON.r);
      fx(g, 'ln_dragonLand', h.x, h.y, { r: DRAGON.r, n: ms.length, x2: a.fx, y2: a.fy });
      sfx(g, 'ln_dragonLand', h.x, h.y);
      shake(g, 0.65);
    },
  },

  // ---- storm thrusts: eight cone thrusts during the channel (tick), the wave on the ninth (apply)
  ln_storm: {
    tick(c) {
      let due = 0;
      while (due < STORM.n && c.a.t >= stormAt(due)) due++;
      stormCatchUp(c, due);
    },
    apply(c) {
      const { g, h, rank } = c;
      stormCatchUp(c, STORM.n);
      const ang = aimOf(c);
      const d = roll(g, 150 + 15 * rank, 'light', 'proj');
      d.kb = 0.5;
      shoot(g, 'ln_stormWave', ang, d, { speed: STORM.waveSpeed, life: STORM.waveLife, r: STORM.waveR, pierce: 1e6 });
      fx(g, 'ln_stormWave', h.x, h.y, { x2: h.x + Math.cos(ang), y2: h.y + Math.sin(ang), r: STORM.waveSpeed * STORM.waveLife });
      sfx(g, 'ln_stormWave', h.x, h.y);
      shake(g, 0.4);
    },
  },
});
