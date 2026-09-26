// monk: skill behaviour (registered into sim/registry via sim/kit).
// 장타 (palm strike), 연환권 (jab → cross → heavy palm; the last one knocks back and stuns), 기공파 (a wide chi wave
// that passes through every enemy), 진언 (12 s attack speed / move speed / dodge buff), 비연각 (a flying kick dash that
// strikes everything on its path) and 칠성권 (the monk flashes between the enemies around the target, seven strikes).
import {
  PROJ_HIT, addBuff, breakPropsNear, circleFree, fx, hitProp, hurtMonster, los, meleeTargets, monstersNear,
  registerSkills, roll, sfx, shake, shoot,
  type Game, type Monster, type SkillCtx,
} from '../../sim/kit';
import { COMBO, KICK, MANTRA, SEVEN, WAVE, kickEase, sevenAt } from './shared';

const dist = (m: { x: number; y: number }, x: number, y: number): number => Math.hypot(m.x - x, m.y - y);

/** Distance from (px,py) to the segment (x0,y0)-(x1,y1). */
function segDist(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
  const t = l2 > 1e-9 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2)) : 0;
  return Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t));
}

// ------------------------------------------------------------------ punches
/** One punch of a melee act: hits the act's target while it stands in reach, else whatever stands in front. */
function punch(c: SkillCtx, pct: number, kind: string, n: number, heavy = false): Monster | undefined {
  const { g, h, a } = c;
  const reach = h.st.reach + h.r;
  const m = meleeTargets(g, a, reach, false)[0];
  if (m) h.facing = Math.atan2(m.y - h.y, m.x - h.x);
  const ang = h.facing;
  const tx = m ? m.x : h.x + Math.cos(ang) * (reach + 0.2), ty = m ? m.y : h.y + Math.sin(ang) * (reach + 0.2);
  fx(g, kind, h.x, h.y, { x2: tx, y2: ty, n, r: m ? 1 : 0 });
  sfx(g, heavy ? 'mk_whiffHeavy' : 'mk_whiff', h.x, h.y);
  if (m) {
    const d = roll(g, pct, null, 'melee');
    if (heavy) { d.kb = COMBO.kb; d.stun = COMBO.stun; }
    hurtMonster(g, m, d);
    if (heavy) { sfx(g, 'mk_thump', m.x, m.y); shake(g, 0.22); }
  } else if (n === 0) hitProp(g, a);
  return m;
}

function comboCatchUp(c: SkillCtx, upTo: number): void {
  const d = (c.a.data ??= {});
  let n = d.n ?? 0;
  while (n < upTo) { punch(c, c.def.pct(c.rank), 'mk_combo', n, n === COMBO.at.length - 1); n++; }
  d.n = n;
}

// ------------------------------------------------------------------ chi wave
PROJ_HIT.mk_wave = (g, p, m) => {
  fx(g, 'mk_waveHit', m.x, m.y, { x2: p.x - p.vx * 0.05, y2: p.y - p.vy * 0.05 });
};

// ------------------------------------------------------------------ flying kick
/** Kicks every enemy near the stretch of path flown this tick (each enemy once per kick). */
function kickSweep(c: SkillCtx, x0: number, y0: number, x1: number, y1: number): void {
  const { g, h, a, def, rank } = c;
  const ux = a.tx - a.fx, uy = a.ty - a.fy, ul = Math.hypot(ux, uy) || 1;
  const fx0 = ux / ul, fy0 = uy / ul;
  for (const m of g.world.monsters) {
    if (m.dead || a.ids?.includes(m.id)) continue;
    if (segDist(m.x, m.y, x0, y0, x1, y1) > h.r + KICK.contact + m.r) continue;
    if (!los(g.world, x1, y1, m.x, m.y) && !los(g.world, x0, y0, m.x, m.y)) continue;
    (a.ids ??= []).push(m.id);
    // bowled aside off the flight line, and a little forward
    const rx = m.x - x1, ry = m.y - y1;
    const along = rx * fx0 + ry * fy0;
    let sx = rx - along * fx0, sy = ry - along * fy0;
    const sl = Math.hypot(sx, sy);
    if (sl < 0.05) { const s = m.id % 2 ? 1 : -1; sx = -fy0 * s; sy = fx0 * s; } else { sx /= sl; sy /= sl; }
    let kx = sx + fx0 * 0.9, ky = sy + fy0 * 0.9;
    const kl = Math.hypot(kx, ky) || 1; kx /= kl; ky /= kl;
    const d = roll(g, def.pct(rank), null, 'melee');
    d.kb = KICK.kb; d.srcX = m.x - kx; d.srcY = m.y - ky;
    hurtMonster(g, m, d);
    fx(g, 'mk_kickHit', m.x, m.y, { x2: m.x + kx, y2: m.y + ky });
    sfx(g, 'mk_kickHit', m.x, m.y);
  }
}

// ------------------------------------------------------------------ seven-sided strike
/** Living enemies within reach of the centre that the monk can see from where he stands. */
function sevenPool(g: Game, cx: number, cy: number, fromX: number, fromY: number): Monster[] {
  return monstersNear(g, cx, cy, SEVEN.r).filter((m) => los(g.world, fromX, fromY, m.x, m.y));
}

/** One flash-step and strike: the least-struck enemy (nearest on ties); repeated strikes come from new sides. */
function sevenStrike(c: SkillCtx, i: number): boolean {
  const { g, h, a, def, rank } = c;
  const d = a.data!;
  const pool = sevenPool(g, d.cx, d.cy, h.x, h.y);
  if (!pool.length) return false;
  const hits = (m: Monster): number => d['s' + m.id] ?? 0;
  pool.sort((p, q) => hits(p) - hits(q) || dist(p, h.x, h.y) - dist(q, h.x, h.y) || p.id - q.id);
  const m = pool[0];
  const n = hits(m);
  d['s' + m.id] = n + 1;
  const base = Math.atan2(h.y - m.y, h.x - m.x) + n * 2.4;
  const R = m.r + h.r + 0.1;
  let px = h.x, py = h.y;
  for (const off of [0, 0.7, -0.7, 1.4, -1.4, 2.2, -2.2, Math.PI]) {
    const qx = m.x + Math.cos(base + off) * R, qy = m.y + Math.sin(base + off) * R;
    if (circleFree(g.world, qx, qy, h.r) && los(g.world, m.x, m.y, qx, qy)) { px = qx; py = qy; break; }
  }
  const ox = h.x, oy = h.y;
  h.x = px; h.y = py;
  h.facing = Math.atan2(m.y - py, m.x - px);
  fx(g, 'mk_sevenDash', ox, oy, { x2: px, y2: py, n: i });
  const dm = roll(g, def.pct(rank), null, 'melee');
  dm.srcX = px; dm.srcY = py;
  hurtMonster(g, m, dm);
  fx(g, 'mk_sevenHit', m.x, m.y, { x2: px, y2: py, n: i });
  sfx(g, 'mk_sevenHit', m.x, m.y);
  return true;
}

function sevenCatchUp(c: SkillCtx, t: number): void {
  const { g, h, a } = c;
  const d = (a.data ??= {});
  if (d.cx === undefined) {
    // the enemies around the target point, or (if none can be seen there) the ones around the monk
    const near = sevenPool(g, a.tx, a.ty, h.x, h.y).length > 0;
    d.cx = near ? a.tx : h.x; d.cy = near ? a.ty : h.y; d.n = 0;
    fx(g, 'mk_sevenStart', h.x, h.y, { x2: d.cx, y2: d.cy });
  }
  while ((d.n ?? 0) < SEVEN.n && !d.done && t >= sevenAt(d.n ?? 0)) {
    if (!sevenStrike(c, d.n ?? 0)) d.done = 1;
    d.n = (d.n ?? 0) + 1;
  }
}

// ------------------------------------------------------------------ skills
registerSkills({
  // ---- basic: a snapping palm strike (the hands alternate in the pose)
  mk_palm: {
    apply(c) { punch(c, 100, 'mk_palm', 0); },
  },

  // ---- combo: jab, cross, heavy palm at COMBO.at of the act
  mk_combo: {
    tick(c) {
      const k = c.a.t / c.a.dur;
      let due = 0;
      while (due < COMBO.at.length && k >= COMBO.at[due]) due++;
      comboCatchUp(c, due);
    },
    apply(c) { comboCatchUp(c, COMBO.at.length); },
  },

  // ---- chi wave: a wide wave that passes through every enemy in its path (stops at walls)
  mk_wave: {
    apply({ g, h, def, rank, ang }) {
      const d = roll(g, def.pct(rank), null, 'spell');
      shoot(g, 'mk_wave', ang, d, { speed: WAVE.speed, life: def.range / WAVE.speed, r: WAVE.r, pierce: 1e6, onHit: 'mk_wave' });
      fx(g, 'mk_waveCast', h.x, h.y, { x2: h.x + Math.cos(ang), y2: h.y + Math.sin(ang) });
    },
  },

  // ---- mantra: attack speed, move speed and dodge for 12 s
  mk_mantra: {
    apply({ g, h, def, rank }) {
      addBuff(g, 'mk_mantra', '진언', MANTRA.dur, { ias: def.pct(rank), ms: MANTRA.ms, dodge: MANTRA.dodge }, '#ffc860');
      fx(g, 'mk_mantra', h.x, h.y, { r: 2.2 });
    },
  },

  // ---- flying kick: the monk flies himself to the dash point (a fast launch easing into the landing; the dash
  //      point is already clear of walls all the way); everything on the way is kicked aside
  mk_kick: {
    tick(c) {
      const { g, h, a } = c;
      const d = (a.data ??= {});
      const kk = kickEase(a.t / Math.max(1e-3, a.dur));
      h.x = a.fx + (a.tx - a.fx) * kk; h.y = a.fy + (a.ty - a.fy) * kk;
      if (Math.hypot(a.tx - a.fx, a.ty - a.fy) > 0.01) h.facing = Math.atan2(a.ty - a.fy, a.tx - a.fx);
      if (!d.f) { d.px = a.fx; d.py = a.fy; fx(g, 'mk_kickStart', a.fx, a.fy, { x2: a.tx, y2: a.ty }); }
      kickSweep(c, d.px, d.py, h.x, h.y);
      breakPropsNear(g, h.x, h.y, 0.5);
      d.px = h.x; d.py = h.y;
      d.f = (d.f ?? 0) + 1;
      fx(g, 'mk_kickTrail', h.x, h.y, { x2: a.fx, y2: a.fy, n: d.f });
    },
    apply(c) {
      const { g, h, a } = c;
      const d = a.data ?? {};
      h.x = a.tx; h.y = a.ty;
      kickSweep(c, d.px ?? a.fx, d.py ?? a.fy, h.x, h.y);
      breakPropsNear(g, h.x, h.y, 0.6);
      const n = a.ids?.length ?? 0;
      fx(g, 'mk_kickEnd', h.x, h.y, { x2: a.fx, y2: a.fy, n });
      if (n) shake(g, 0.25);
    },
  },

  // ---- seven-sided strike: flash between the enemies around the target, seven strikes, then a gong
  mk_seven: {
    canCast(g, x, y) {
      const h = g.hero;
      return sevenPool(g, x, y, h.x, h.y).length > 0 || sevenPool(g, h.x, h.y, h.x, h.y).length > 0;
    },
    tick(c) { sevenCatchUp(c, c.a.t); },
    apply(c) {
      const { g, h, a } = c;
      sevenCatchUp(c, a.dur);
      fx(g, 'mk_sevenEnd', h.x, h.y, { r: 2.4, n: a.data?.n ?? 0 });
      sfx(g, 'mk_gong', h.x, h.y);
      shake(g, 0.4);
    },
  },
});
