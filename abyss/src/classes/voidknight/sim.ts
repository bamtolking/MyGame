// voidknight: skill behaviour (registered into sim/registry via sim/kit).
// Void slash (heavy greatsword chop), drain strike (a rising cut that returns a quarter of the damage dealt as life),
// dark wave (a crescent that flies through walls and every enemy, chilling them), abyssal grasp (hands rise from a
// pool at the target point, seize and stun everything around it and drag them to the centre), void shroud (10 s
// damage / life-steal / damage-reduction buff) and eclipse (a black sphere swelling from the knight: its rim hits
// every enemy within 5 tiles and sends them fleeing in terror).
import {
  AREA_TICK, PROJ_HIT, PROJ_MOTION, addArea, addBuff, breakPropsNear, circleFree, emptyDmg, fx, heal, hitProp, hurtMonster,
  meleeTargets, monstersNear, nearestWalkable, registerSkills, roll, sfx, shake, shoot, swingFx,
  type Game, type Monster, type Proj,
} from '../../sim/kit';
import { DRAIN, ECLIPSE, GRASP, SHROUD, WAVE } from './shared';

const dist = (m: { x: number; y: number }, x: number, y: number): number => Math.hypot(m.x - x, m.y - y);

/** The violet blade trail (render: a vertical crescent following the greatsword). n: 0 chop, 1 rising cut, 2 wave chop, 3 eclipse slam. */
function bladeArc(g: Game, ang: number, n: number): void {
  const h = g.hero;
  fx(g, 'vk_arc', h.x, h.y, { x2: h.x + Math.cos(ang), y2: h.y + Math.sin(ang), n });
}

// ------------------------------------------------------------------ dark wave
// A wide crescent: besides the engine's own (small-radius) hit test, every enemy inside the crest's band — up to the
// crescent's half-width to either side — is cut once. The crescent widens as it flies. Barrels and crates in its
// path are smashed first so they never stop it (the engine ends projectiles on props).
function waveHit(g: Game, p: Proj, m: Monster): void {
  fx(g, 'vk_waveHit', m.x, m.y, { x2: m.x + p.vx, y2: m.y + p.vy });
}

PROJ_MOTION.vk_wave = (g, p, _dt) => {
  const d = p.data;
  if (!d) return;
  const sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp, uy = p.vy / sp;
  const k = Math.min(1, p.age / Math.max(0.05, d.life0));
  const w = WAVE.w0 + (WAVE.w1 - WAVE.w0) * k;
  d.w = w;
  for (const m of g.world.monsters) {
    if (m.dead || p.hit.includes(m.id)) continue;
    const rx = m.x - p.x, ry = m.y - p.y;
    const along = rx * ux + ry * uy;
    if (along < -WAVE.band - m.r || along > WAVE.band + m.r) continue;
    const lat = Math.abs(rx * uy - ry * ux);
    if (lat > w + m.r) continue;
    p.hit.push(m.id);
    hurtMonster(g, m, { ...p.dmg, srcX: p.x - ux * 0.4, srcY: p.y - uy * 0.4 });
    waveHit(g, p, m);
  }
  breakPropsNear(g, p.x + ux * 0.2, p.y + uy * 0.2, Math.max(0.3, w - 0.4));
};
PROJ_HIT.vk_wave = (g, p, m) => waveHit(g, p, m);

// ------------------------------------------------------------------ abyssal grasp
// The pool's state lives in a.data: pct / stun (from the cast), seized flag, and for rendering the live positions of
// the seized enemies (n, x<i>, y<i>, a<i> = 1 while that enemy still stands) so the tendrils can follow them.
AREA_TICK.vk_grasp = (g, a) => {
  const d = a.data;
  if (!d.seized && a.t >= GRASP.seizeAt) {
    d.seized = 1;
    const ms = monstersNear(g, a.x, a.y, a.r, true);
    ms.sort((p, q) => dist(p, a.x, a.y) - dist(q, a.x, a.y) || p.id - q.id);
    for (const m of ms) {
      const dm = roll(g, d.pct, null, 'spell');
      dm.stun = d.stun;
      dm.srcX = a.x; dm.srcY = a.y;
      hurtMonster(g, m, dm);
      a.hitIds.push(m.id);
      if (m.dead || m.rank === 'boss') continue;
      // drag to the rim of the pool: knockback velocity decays by e^(-7t), so it travels kb/7 tiles in total
      const dx = a.x - m.x, dy = a.y - m.y, l = Math.hypot(dx, dy);
      const want = l - (GRASP.stopR + m.r);
      if (want <= 0.05 || l < 1e-3) continue;
      const k = m.rank === 'unique' || m.rank === 'champion' ? 0.75 : 1;
      m.kbx = (dx / l) * want * 7 * k; m.kby = (dy / l) * want * 7 * k;
    }
    breakPropsNear(g, a.x, a.y, a.r * 0.5);
    fx(g, 'vk_graspSeize', a.x, a.y, { r: a.r, n: ms.length });
    sfx(g, 'vk_grasp', a.x, a.y);
    shake(g, ms.length ? 0.35 : 0.2);
  }
  // live positions of the seized enemies for the tendrils
  const n = Math.min(GRASP.maxDrawn, a.hitIds.length);
  d.n = n;
  for (let i = 0; i < n; i++) {
    const m = g.world.monsters.find((q) => q.id === a.hitIds[i]);
    if (m && !m.dead) { d['x' + i] = m.x; d['y' + i] = m.y; d['a' + i] = 1; d['r' + i] = m.r; } else d['a' + i] = 0;
  }
};

// ------------------------------------------------------------------ eclipse
// The sphere swells to full size over ECLIPSE.grow seconds; each enemy is struck (and terrified) as the rim passes it.
AREA_TICK.vk_eclipse = (g, a) => {
  const d = a.data;
  const k = Math.min(1, a.t / ECLIPSE.grow);
  const cur = a.r * (1 - (1 - k) * (1 - k));
  for (const m of g.world.monsters) {
    if (m.dead || a.hitIds.includes(m.id)) continue;
    if (dist(m, a.x, a.y) > cur + m.r) continue;
    a.hitIds.push(m.id);
    const dm = roll(g, d.pct, 'cold', 'spell');
    dm.kb = 0.5; dm.srcX = a.x; dm.srcY = a.y;
    hurtMonster(g, m, dm);
    if (!m.dead && m.rank !== 'boss') { m.fleeT = Math.max(m.fleeT, ECLIPSE.fear); m.act = null; }
    fx(g, 'vk_eclipseHit', m.x, m.y, { x2: a.x, y2: a.y });
  }
  if (k >= 1 && !d.done) { d.done = 1; breakPropsNear(g, a.x, a.y, a.r); }
};

// ------------------------------------------------------------------ skills
registerSkills({
  // ---- basic: a heavy two-handed chop (the pose's overhead swing), violet trail
  vk_slash: {
    apply({ g, h, a, ang }) {
      const ts = meleeTargets(g, a, h.st.reach + h.r, false);
      swingFx(g, 'vk_slash', ang, h.st.reach + 0.7);
      bladeArc(g, ang, 0);
      for (const m of ts) {
        hurtMonster(g, m, roll(g, 100, null, 'melee'));
        fx(g, 'vk_cut', m.x, m.y, { x2: h.x, y2: h.y });
      }
      if (!ts.length) hitProp(g, a);
      sfx(g, 'vk_swing', h.x, h.y);
    },
  },

  // ---- drain strike: a rising cut that rips the life out of the target; heals 25% of the damage actually dealt
  vk_drain: {
    apply({ g, h, a, def, rank, ang }) {
      const ts = meleeTargets(g, a, h.st.reach + h.r, false);
      swingFx(g, 'vk_drain', ang, h.st.reach + 0.7);
      bladeArc(g, ang, 1);
      for (const m of ts) {
        const before = Math.max(0, m.hp);
        const dealt = hurtMonster(g, m, roll(g, def.pct(rank), null, 'melee'));
        const gain = Math.min(dealt, before) * DRAIN.heal;
        heal(g, gain);
        fx(g, 'vk_drain', m.x, m.y, { x2: h.x, y2: h.y, n: gain > 0 ? Math.min(3, 1 + Math.floor((gain / Math.max(1, h.st.maxHp)) * 12)) : 0 });
        sfx(g, 'vk_drain', m.x, m.y);
      }
      if (!ts.length) hitProp(g, a);
      sfx(g, 'vk_swing', h.x, h.y);
    },
  },

  // ---- dark wave: a crescent of black-violet cold that passes through walls and every enemy, chilling them
  vk_wave: {
    apply({ g, h, a, def, rank, ang: aim }) {
      // aimed at the knight himself (cursor on his feet): cut the way he faces instead of due east
      const ang = Math.hypot(a.tx - h.x, a.ty - h.y) > 0.05 ? aim : h.facing;
      const d = roll(g, def.pct(rank), 'cold', 'proj');
      d.chill = Math.max(d.chill ?? 0, WAVE.chill);
      const life = Math.max(0.1, (def.range - WAVE.from) / WAVE.speed);
      shoot(g, 'vk_wave', ang, d, {
        speed: WAVE.speed, life, r: 0.42, pierce: 1e6, ghost: true, motion: 'vk_wave', onHit: 'vk_wave',
        from: { x: h.x + Math.cos(ang) * WAVE.from, y: h.y + Math.sin(ang) * WAVE.from },
        data: { life0: life, w: WAVE.w0 },
      });
      swingFx(g, 'vk_wave', ang, h.st.reach + 0.8);
      bladeArc(g, ang, 2);
      fx(g, 'vk_waveCast', h.x, h.y, { x2: h.x + Math.cos(ang), y2: h.y + Math.sin(ang) });
      sfx(g, 'vk_wave', h.x, h.y);
    },
  },

  // ---- abyssal grasp: a pool of void opens at the target point; hands rise, seize, stun and drag (AREA_TICK above)
  vk_grasp: {
    canCast(g, x, y) { return circleFree(g.world, x, y, 0.3) || !!nearestWalkable(g.world, x, y, 2.5); },
    apply({ g, h, a, def, rank }) {
      let x = a.tx, y = a.ty;
      if (!circleFree(g.world, x, y, 0.3)) { const w = nearestWalkable(g.world, x, y, 2.5); if (w) { x = w.x; y = w.y; } }
      addArea(g, 'vk_grasp', 'hero', x, y, GRASP.r, GRASP.dur, emptyDmg(), {
        tick: 1 / 60, tickT: 0, data: { noDmg: 1, pct: def.pct(rank), stun: GRASP.stun(rank), n: 0 },
      });
      fx(g, 'vk_graspCast', h.x, h.y, { x2: x, y2: y, r: GRASP.r });
    },
  },

  // ---- void shroud: 10 s of void — more damage, life steal and less damage taken
  vk_shroud: {
    apply({ g, h, def, rank }) {
      addBuff(g, 'vk_shroud', '공허의 장막', SHROUD.dur, { dmgPct: def.pct(rank), lifeSteal: SHROUD.lifeSteal, dmgTaken: SHROUD.dmgTaken }, SHROUD.color);
      fx(g, 'vk_shroud', h.x, h.y, { r: 2.2 });
      shake(g, 0.15);
    },
  },

  // ---- eclipse: a black sphere swells from the knight (AREA_TICK above strikes and terrifies as the rim passes)
  vk_eclipse: {
    apply({ g, h, def, rank }) {
      addArea(g, 'vk_eclipse', 'hero', h.x, h.y, ECLIPSE.r, ECLIPSE.grow + 0.06, emptyDmg(), {
        tick: 1 / 60, tickT: 0, data: { noDmg: 1, pct: def.pct(rank) },
      });
      bladeArc(g, h.facing, 3);
      fx(g, 'vk_eclipse', h.x, h.y, { r: ECLIPSE.r });
      shake(g, 0.75);
    },
  },
});
