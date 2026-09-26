// paladin: skill behaviour (registered into sim/registry via sim/kit).
// Mace strike, zeal (three quick strikes that alternate between adjacent enemies), blessed hammer (a spectral
// hammer spiralling outward from the cast point, striking enemies again on every pass), holy aura (15 s defence
// buff whose ring burns adjacent enemies), charge (shield-first dash that bowls enemies aside and stuns them)
// and heavenly judgment (seven pillars of light falling one after another on enemies inside a seal).
import {
  AREA_TICK, PROJ_HIT, PROJ_MOTION, SKILLS, addArea, addBuff, breakPropsNear, emptyDmg, fx, hitProp, hurtMonster,
  meleeTargets, monstersNear, registerSkills, roll, sfx, shake, spawnProj, swingFx,
  type Game, type Monster, type SkillCtx,
} from '../../sim/kit';
import { AURA, CHARGE, HAMMER, JUDGMENT, ZEAL_AT, chargeEase } from './shared';

const TAU = Math.PI * 2;
const dist = (m: { x: number; y: number }, x: number, y: number): number => Math.hypot(m.x - x, m.y - y);

// ------------------------------------------------------------------ zeal
/** One zeal strike: picks the i-th adjacent enemy (primary target first), turns to it and hits. */
function zealStrike(c: SkillCtx, i: number): void {
  const { g, h, a, def, rank } = c;
  const reach = h.st.reach + h.r + 0.35;
  const near = g.world.monsters.filter((m) => !m.dead && dist(m, h.x, h.y) <= reach + m.r);
  near.sort((p, q) => (p.id === a.targetId ? -1 : 0) - (q.id === a.targetId ? -1 : 0) || dist(p, h.x, h.y) - dist(q, h.x, h.y) || p.id - q.id);
  const t: Monster | undefined = near.length ? near[i % near.length] : undefined;
  const ang = t ? Math.atan2(t.y - h.y, t.x - h.x) : h.facing;
  if (t) h.facing = ang;
  swingFx(g, 'pl_zeal', ang, h.st.reach + 0.6);
  fx(g, 'pl_zealArc', h.x, h.y, { x2: h.x + Math.cos(ang), y2: h.y + Math.sin(ang), r: h.st.reach + 0.75, n: i });
  sfx(g, 'swing', h.x, h.y);
  if (t) {
    hurtMonster(g, t, roll(g, def.pct(rank), null, 'melee'));
    fx(g, 'pl_zeal', t.x, t.y, { x2: h.x, y2: h.y, n: i });
    sfx(g, 'pl_zealHit', t.x, t.y);
  } else if (i === 0) hitProp(g, a);
}

function zealCatchUp(c: SkillCtx, upTo: number): void {
  const d = (c.a.data ??= {});
  let n = d.n ?? 0;
  while (n < upTo) { zealStrike(c, n); n++; }
  d.n = n;
}

// ------------------------------------------------------------------ blessed hammer
// The hammer's spiral state lives in p.data: centre (cx, cy), start angle (a0), swept angle (th), spin (+1/-1).
PROJ_MOTION.pl_hammer = (g, p, dt) => {
  const d = p.data;
  if (!d || dt <= 0) return;
  const total = HAMMER.turns * TAU;
  // radius grows slowly at first (the first turn sweeps the enemies pressed against the paladin), faster later
  const radius = (th: number) => HAMMER.r0 + (HAMMER.r1 - HAMMER.r0) * Math.pow(Math.min(1, th / total), HAMMER.curve);
  // constant speed along the spiral: dθ = v·dt / r
  d.th = Math.min(total, (d.th ?? 0) + (HAMMER.speed * dt) / Math.max(0.9, radius(d.th ?? 0)));
  const r = radius(d.th), ang = d.a0 + d.spin * d.th;
  const tx = d.cx + Math.cos(ang) * r, ty = d.cy + Math.sin(ang) * r;
  // the engine ends any hero projectile that enters a barrel/crate tile; the spectral hammer smashes them
  // along its path instead and keeps spinning (0.35 + 0.4 covers the whole tile the prop stands on)
  const step = Math.hypot(tx - p.x, ty - p.y), n = Math.max(1, Math.ceil(step / 0.25));
  for (let i = 1; i <= n; i++) breakPropsNear(g, p.x + ((tx - p.x) * i) / n, p.y + ((ty - p.y) * i) / n, 0.35);
  p.vx = (tx - p.x) / dt; p.vy = (ty - p.y) / dt;
  if (d.th >= total && !d.end) { d.end = 1; p.life = Math.min(p.life, dt * 0.5); fx(g, 'pl_hammerEnd', tx, ty); }
};
PROJ_HIT.pl_hammer = (g, p, m) => {
  fx(g, 'pl_hammerHit', m.x, m.y, { x2: p.x, y2: p.y });
  sfx(g, 'pl_hammerHit', m.x, m.y);
};

// ------------------------------------------------------------------ holy aura
/** Adds the aura ring when the buff is up but this floor has no ring yet (the buff survives floor changes, areas don't). */
function ensureAura(g: Game): void {
  const h = g.hero;
  const b = h.buffs.find((q) => q.id === 'pl_aura');
  if (!b || h.dead || g.world.floor === 0 || g.world.areas.some((a) => a.kind === 'pl_auraRing' && a.side === 'hero')) return;
  const r = SKILLS.pl_aura.range;
  addArea(g, 'pl_auraRing', 'hero', h.x, h.y, r, b.t, emptyDmg(), { follow: true, tick: AURA.tick, tickT: AURA.tick, data: { noDmg: 1, pct: b.v } });
}

/**
 * The buff outlives the floor but its ring does not, and the engine has no per-tick hero hook (see engineRequests).
 * Every world change (stairs, waypoint, portal, town) goes through Game.placeHero, so the first aura cast wraps it
 * on the live game's prototype to re-light the ring as soon as the paladin arrives. Idempotent; a no-op when the
 * engine renames the method (the ring then comes back on the next attack, as before).
 */
const PLACE_HOOK = Symbol.for('abyss.pl_aura.placeHero');
function hookWorldChange(g: Game): void {
  const proto = Object.getPrototypeOf(g) as Record<string | symbol, unknown>;
  const orig = proto.placeHero;
  if (proto[PLACE_HOOK] || typeof orig !== 'function') return;
  proto[PLACE_HOOK] = true;
  proto.placeHero = function (this: Game, ...args: unknown[]): unknown {
    const r = (orig as (...a: unknown[]) => unknown).apply(this, args);
    ensureAura(this);
    return r;
  };
}

AREA_TICK.pl_auraRing = (g, a) => {
  const h = g.hero;
  // the ring lives exactly as long as the buff (death or expiry end it; a recast, even while this ring sat
  // frozen on a floor the paladin had left, renews its time and burn strength)
  const b = h.buffs.find((q) => q.id === 'pl_aura');
  if (h.dead || !b) { a.t = a.dur + 1; return; }
  a.dur = a.t + b.t;
  if (b.v > 1) a.data.pct = b.v;
  for (const m of monstersNear(g, a.x, a.y, a.r)) {
    hurtMonster(g, m, roll(g, a.data.pct, 'fire', 'spell'));
    fx(g, 'pl_auraBurn', m.x, m.y);
  }
};

// ------------------------------------------------------------------ charge
function chargeHit(c: SkillCtx, m: Monster): void {
  const { g, h, a, def, rank } = c;
  (a.ids ??= []).push(m.id);
  // bowl the enemy aside: sideways off the charge line, plus a little forward
  const ux = a.tx - a.fx, uy = a.ty - a.fy, ul = Math.hypot(ux, uy) || 1;
  const fx0 = ux / ul, fy0 = uy / ul;
  const rx = m.x - h.x, ry = m.y - h.y;
  const along = rx * fx0 + ry * fy0;
  let sx = rx - along * fx0, sy = ry - along * fy0;
  const sl = Math.hypot(sx, sy);
  if (sl < 0.05) { const s = m.id % 2 ? 1 : -1; sx = -fy0 * s; sy = fx0 * s; } else { sx /= sl; sy /= sl; }
  let kx = sx + fx0 * 0.8, ky = sy + fy0 * 0.8;
  const kl = Math.hypot(kx, ky) || 1; kx /= kl; ky /= kl;
  const d = roll(g, def.pct(rank), null, 'melee');
  d.stun = CHARGE.stun; d.kb = CHARGE.kb;
  d.srcX = m.x - kx; d.srcY = m.y - ky;
  hurtMonster(g, m, d);
  fx(g, 'pl_chargeHit', m.x, m.y, { x2: m.x + kx, y2: m.y + ky });
  sfx(g, 'pl_shieldBash', m.x, m.y);
}

// ------------------------------------------------------------------ judgment
function pillar(g: Game, x: number, y: number, pct: number, i: number): void {
  for (const m of monstersNear(g, x, y, JUDGMENT.pillarR)) hurtMonster(g, m, roll(g, pct, 'light', 'spell'));
  breakPropsNear(g, x, y, JUDGMENT.pillarR);
  fx(g, 'pl_pillar', x, y, { r: JUDGMENT.pillarR, n: i });
  sfx(g, 'pl_pillar', x, y);
  shake(g, 0.16);
}

AREA_TICK.pl_judgment = (g, a) => {
  const d = a.data;
  if ((d.n ?? 0) >= JUDGMENT.n) return;
  d.n = (d.n ?? 0) + 1;
  // strike the least-judged enemy inside the seal (nearest the centre on ties); an empty seal gets random pillars
  const ms = monstersNear(g, a.x, a.y, a.r);
  let px: number, py: number;
  if (ms.length) {
    ms.sort((p, q) => (d['s' + p.id] ?? 0) - (d['s' + q.id] ?? 0) || dist(p, a.x, a.y) - dist(q, a.x, a.y) || p.id - q.id);
    px = ms[0].x; py = ms[0].y;
  } else {
    const ang = g.rng.range(0, TAU), rr = Math.sqrt(g.rng.next()) * a.r * 0.8;
    px = a.x + Math.cos(ang) * rr; py = a.y + Math.sin(ang) * rr;
  }
  for (const m of monstersNear(g, px, py, JUDGMENT.pillarR)) d['s' + m.id] = (d['s' + m.id] ?? 0) + 1;
  pillar(g, px, py, d.pct, d.n);
  if (d.n >= JUDGMENT.n) {
    fx(g, 'pl_judgmentEnd', a.x, a.y, { r: a.r });
    sfx(g, 'pl_judgmentEnd', a.x, a.y);
    shake(g, 0.4);
  }
};

// ------------------------------------------------------------------ skills
registerSkills({
  // ---- basic: an overhead mace blow
  pl_strike: {
    apply({ g, h, a, ang }) {
      ensureAura(g);
      const ts = meleeTargets(g, a, h.st.reach + h.r, false);
      swingFx(g, 'pl_strike', ang, h.st.reach + 0.6);
      for (const m of ts) {
        hurtMonster(g, m, roll(g, 100, null, 'melee'));
        fx(g, 'pl_smite', m.x, m.y, { x2: h.x, y2: h.y });
      }
      if (!ts.length) hitProp(g, a);
      sfx(g, 'swing', h.x, h.y);
    },
  },

  // ---- zeal: three quick strikes at 1/6, 1/2, 5/6 of the act, alternating between adjacent enemies
  pl_zeal: {
    tick(c) {
      const k = c.a.t / c.a.dur;
      let due = 0;
      while (due < ZEAL_AT.length && k >= ZEAL_AT[due]) due++;
      zealCatchUp(c, due);
    },
    apply(c) { zealCatchUp(c, ZEAL_AT.length); ensureAura(c.g); },
  },

  // ---- blessed hammer: spirals outward around the cast point, re-striking enemies on each pass
  pl_hammer: {
    apply({ g, h, def, rank, ang }) {
      ensureAura(g);
      const d = roll(g, def.pct(rank), 'light', 'spell');
      const x = h.x + Math.cos(ang) * HAMMER.r0, y = h.y + Math.sin(ang) * HAMMER.r0;
      spawnProj(g, 'pl_hammer', 'hero', x, y, 0, 0, d, {
        life: 6, r: HAMMER.hitR, pierce: 1e6, rehit: HAMMER.rehit, ghost: true, motion: 'pl_hammer', onHit: 'pl_hammer',
        data: { cx: h.x, cy: h.y, a0: ang, th: 0, spin: 1 },
      });
      fx(g, 'pl_hammerCast', x, y, { x2: h.x, y2: h.y });
    },
  },

  // ---- holy aura: armour / resistances / regeneration for 15 s, and a burning ring around the hero
  pl_aura: {
    apply({ g, h, def, rank }) {
      hookWorldChange(g);
      addBuff(g, 'pl_aura', '신성한 오라', AURA.dur, { armorPct: 30 + 3 * rank, resAll: 10, hpRegen: 1 + 0.3 * rank }, '#ffd870');
      // the burn strength rides on the buff (v is unused for class buffs) so the ring can be restored on a new floor
      const b = h.buffs.find((q) => q.id === 'pl_aura');
      if (b) b.v = def.pct(rank);
      g.world.areas = g.world.areas.filter((q) => !(q.kind === 'pl_auraRing' && q.side === 'hero'));
      addArea(g, 'pl_auraRing', 'hero', h.x, h.y, def.range, AURA.dur, emptyDmg(), {
        follow: true, tick: AURA.tick, tickT: AURA.tick * 0.5, data: { noDmg: 1, pct: def.pct(rank) },
      });
      fx(g, 'pl_auraCast', h.x, h.y, { r: def.range });
    },
  },

  // ---- charge: a shield-first rush to the dash point (moved here, not by the engine's ghostly dash act) that
  //      bowls enemies aside, then a heavy landing burst
  pl_charge: {
    tick(c) {
      const { g, h, a } = c;
      const d = (a.data ??= {});
      const kk = chargeEase(a.t / Math.max(1e-3, a.dur));
      h.x = a.fx + (a.tx - a.fx) * kk; h.y = a.fy + (a.ty - a.fy) * kk;
      if (Math.hypot(a.tx - a.fx, a.ty - a.fy) > 0.01) h.facing = Math.atan2(a.ty - a.fy, a.tx - a.fx);
      if (!d.f) fx(g, 'pl_chargeStart', a.fx, a.fy, { x2: a.tx, y2: a.ty, r: a.dur });
      for (const m of g.world.monsters) {
        if (m.dead || a.ids?.includes(m.id)) continue;
        if (dist(m, h.x, h.y) <= h.r + CHARGE.contact + m.r) chargeHit(c, m);
      }
      breakPropsNear(g, h.x, h.y, 0.5);
      d.f = (d.f ?? 0) + 1;
      if (d.f % 2 === 1) fx(g, 'pl_chargeTrail', h.x, h.y, { x2: a.fx, y2: a.fy });
    },
    apply(c) {
      const { g, h, a } = c;
      h.x = a.tx; h.y = a.ty;
      ensureAura(g);
      let n = a.ids?.length ?? 0;
      for (const m of monstersNear(g, h.x, h.y, CHARGE.burst)) if (!a.ids?.includes(m.id)) { chargeHit(c, m); n++; }
      breakPropsNear(g, h.x, h.y, CHARGE.burst);
      fx(g, 'pl_chargeImpact', h.x, h.y, { r: CHARGE.burst, x2: a.fx, y2: a.fy, n });
      sfx(g, 'pl_chargeImpact', h.x, h.y);
      shake(g, n ? 0.5 : 0.3);
    },
  },

  // ---- heavenly judgment: a seal at the target; seven pillars fall one after another (AREA_TICK above)
  pl_judgment: {
    apply({ g, h, a, def, rank }) {
      ensureAura(g);
      addArea(g, 'pl_judgment', 'hero', a.tx, a.ty, JUDGMENT.r, JUDGMENT.dur, emptyDmg(), {
        tick: JUDGMENT.every, tickT: JUDGMENT.first, data: { noDmg: 1, pct: def.pct(rank), n: 0 },
      });
      fx(g, 'pl_judgmentCast', h.x, h.y, { x2: a.tx, y2: a.ty, r: JUDGMENT.r });
    },
  },
});
