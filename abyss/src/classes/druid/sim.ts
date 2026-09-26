// druid: skill behaviour (registered into sim/registry via sim/kit).
// Thorn seed (basic bolt), tornado (a wandering funnel that re-strikes whatever it passes through), thorny
// vines (a field that roots, slows and poisons), spirit wolves (homing spirits that run down and bite enemies),
// rain of renewal (heal over time + regeneration buff) and thunderstorm (a cloud that strikes enemies inside).
import {
  AREA_TICK, PROJ_HIT, PROJ_MOTION, addArea, addBuff, capAreas, emptyDmg, fx, hurtMonster, los, monstersNear,
  moveCircle, registerSkills, roll, sfx, shake, shoot,
  type Game, type Monster, type Proj,
} from '../../sim/kit';
import { MONSTERS } from '../../data/monsters';
import { opaque } from '../../sim/path';
import { RENEWAL, SEED, STORM, TORNADO, VINES, VINE_STEMS, WOLVES, renewalRegen, vineSpot, wolfCount } from './shared';

const TAU = Math.PI * 2;
const angDiff = (a: number, b: number): number => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
const dist = (m: { x: number; y: number }, x: number, y: number): number => Math.hypot(m.x - x, m.y - y);

/** True when a small step from (x,y) by (dx,dy) would enter a wall or void tile. */
const blocked = (g: Game, x: number, y: number): boolean => opaque(g.world, Math.floor(x), Math.floor(y));

// ------------------------------------------------------------------ thorn seed
PROJ_HIT.dr_seed = (g, p, m) => {
  fx(g, 'dr_seedHit', m.x, m.y, { x2: p.vx, y2: p.vy });
  sfx(g, 'dr_seedHit', m.x, m.y);
};

// ------------------------------------------------------------------ tornado
// p.data: a = current heading, a0 = aim heading, turn = heading drift speed, ph = sway phase.
PROJ_MOTION.dr_tornado = (g, p, dt) => {
  const d = p.data;
  if (!d || dt <= 0) return;
  // the funnel wanders: its heading drifts randomly (deterministic rng) but stays near the aim line
  d.turn = (d.turn ?? 0) * Math.exp(-1.5 * dt) + g.rng.range(-1, 1) * 10 * dt;
  d.turn = Math.max(-1.8, Math.min(1.8, d.turn));
  d.a += d.turn * dt;
  const dev = angDiff(d.a, d.a0);
  if (Math.abs(dev) > TORNADO.drift) { d.a = d.a0 + Math.sign(dev) * TORNADO.drift; d.turn *= -0.6; }
  // plus a lazy side-to-side sway
  const sway = Math.cos(p.age * TORNADO.swayRate + d.ph) * TORNADO.sway;
  // it lingers while it churns through enemies, so a pack is struck again and again
  let crowd = false;
  for (const m of g.world.monsters) if (!m.dead && Math.abs(m.x - p.x) < p.r + m.r && Math.abs(m.y - p.y) < p.r + m.r && dist(m, p.x, p.y) < p.r + m.r) { crowd = true; break; }
  d.slow = (d.slow ?? 1) + ((crowd ? TORNADO.crowd : 1) - (d.slow ?? 1)) * Math.min(1, dt * 8);
  const sp = TORNADO.speed * d.slow * (p.age < 0.12 ? 0.55 + (p.age / 0.12) * 0.45 : 1);
  let vx = Math.cos(d.a) * sp - Math.sin(d.a) * sway, vy = Math.sin(d.a) * sp + Math.cos(d.a) * sway;
  // walls: bounce off instead of dying (it is a ghost projectile so the engine never stops it)
  const look = Math.max(0.25, dt * 2);
  if (blocked(g, p.x + vx * look, p.y)) { vx = -vx; d.a = Math.PI - d.a; d.a0 = Math.PI - d.a0; d.turn = -d.turn; }
  if (blocked(g, p.x, p.y + vy * look)) { vy = -vy; d.a = -d.a; d.a0 = -d.a0; d.turn = -d.turn; }
  if (blocked(g, p.x + vx * dt, p.y + vy * dt)) { vx = 0; vy = 0; }
  p.vx = vx; p.vy = vy;
  if (p.life <= dt && !d.end) { d.end = 1; fx(g, 'dr_tornadoEnd', p.x, p.y); sfx(g, 'dr_tornadoEnd', p.x, p.y); }
};
PROJ_HIT.dr_tornado = (g, p, m) => {
  fx(g, 'dr_tornadoHit', m.x, m.y, { x2: p.x, y2: p.y });
  // every strike is rolled on its own (varied numbers and crits instead of one roll repeated)
  if (p.data?.pct) { const dm = roll(g, p.data.pct, null, 'spell'); dm.kb = TORNADO.kb; p.dmg = dm; }
};

// ------------------------------------------------------------------ spirit wolves
/** Nearest living monster the wolf at (x,y) can see, skipping `skip` when there is another choice. */
function wolfPrey(g: Game, x: number, y: number, range: number, skip: number): Monster | null {
  let best: Monster | null = null, bd = range, alt: Monster | null = null;
  for (const m of g.world.monsters) {
    if (m.dead) continue;
    const dd = dist(m, x, y);
    if (dd >= bd || !los(g.world, x, y, m.x, m.y)) continue;
    if (m.id === skip) { alt = m; continue; }
    bd = dd; best = m;
  }
  return best ?? alt;
}

// p.data: a = heading, t0 = age of the last retarget.
PROJ_MOTION.dr_wolf = (g, p, dt) => {
  const d = p.data;
  if (!d || dt <= 0) return;
  let t = p.targetId ? g.world.monsters.find((m) => m.id === p.targetId && !m.dead) : undefined;
  if (!t && p.age > 0.08) {
    const n = wolfPrey(g, p.x, p.y, WOLVES.seek, 0);
    if (n) { p.targetId = n.id; t = n; } else p.targetId = 0;
  }
  // bound out of the fan for a moment, then lock on and close in (turning harder the longer it runs)
  if (t && p.age > 0.12) {
    const want = Math.atan2(t.y - p.y, t.x - p.x);
    const turn = WOLVES.turn * Math.min(1.8, 0.35 + p.age * 2.2) * dt;
    const da = angDiff(want, d.a);
    d.a += Math.max(-turn, Math.min(turn, da));
  }
  // a loping gait: speed pulses with each bound
  // the pack strings out: each wolf runs a little slower than the one before it
  const sp = WOLVES.speed * (1 - 0.07 * (d.i ?? 0)) * (p.age < 0.15 ? 0.5 + (p.age / 0.15) * 0.5 : 1) * (1 + 0.18 * Math.sin(p.age * 17 + (d.i ?? 0)));
  p.vx = Math.cos(d.a) * sp; p.vy = Math.sin(d.a) * sp;
  if (p.life <= dt && !d.end) { d.end = 1; fx(g, 'dr_wolfFade', p.x, p.y, { x2: p.vx, y2: p.vy }); }
};
PROJ_HIT.dr_wolf = (g, p, m) => {
  fx(g, 'dr_wolfBite', m.x, m.y, { x2: p.vx, y2: p.vy });
  sfx(g, 'dr_wolfBite', m.x, m.y);
};

// ------------------------------------------------------------------ thorny vines
// Runs every VINES.step: roots whatever steps in (once per enemy), drags everyone inside to half speed, and every
// VINES.tick poisons them. data: pct, next = time of the next damage tick, n = step counter,
// s<id>/x<id>/y<id> = step and position an enemy was last seen inside, g<id> = when it was grabbed.
AREA_TICK.dr_vines = (g, a) => {
  const d = a.data;
  const n = (d.n = (d.n ?? 0) + 1);
  const dmgTick = a.t >= (d.next ?? VINES.first) - 0.02;
  if (dmgTick) d.next = (d.next ?? VINES.first) + VINES.tick;
  for (const m of monstersNear(g, a.x, a.y, a.r)) {
    const id = m.id;
    // the first touch entangles (a short root)
    if (!a.hitIds.includes(id)) {
      a.hitIds.push(id);
      const root = m.rank === 'boss' ? VINES.root * 0.2 : VINES.root;
      if (m.stunT < root) { m.stunT = root; if (m.rank !== 'boss') m.act = null; }
      d['g' + id] = a.t;
      fx(g, 'dr_vineGrab', m.x, m.y, { r: m.r });
      sfx(g, 'dr_vineGrab', m.x, m.y);
    } else if (d['s' + id] === n - 1 && m.stunT <= 0 && m.freezeT <= 0) {
      // entangled: only part of whatever ground it covered since the last step is kept
      const bx = (d['x' + id] - m.x) * (1 - VINES.slow), by = (d['y' + id] - m.y) * (1 - VINES.slow);
      if (Math.abs(bx) + Math.abs(by) > 1e-4) moveCircle(g.world, m, Math.min(m.r, 0.42), bx, by, !!MONSTERS[m.tpl]?.flying);
    }
    d['s' + id] = n; d['x' + id] = m.x; d['y' + id] = m.y;
    if (!dmgTick) continue;
    if (a.t - (d['g' + id] ?? -1) > 0.4) fx(g, 'dr_vineWrap', m.x, m.y, { r: m.r });
    // every tick adds its poison on top of what is still working (the engine's poison would only refresh),
    // so the field really deals its listed damage every 0.5 s
    const before = m.poison ? m.poison.dps * m.poison.t : 0;
    const dm = roll(g, d.pct, 'poison', 'spell');
    dm.srcX = a.x; dm.srcY = a.y;
    dm.crit = false;   // the crit multiplier stays in the poison; the flag would only pop an empty '0' crit number
    hurtMonster(g, m, dm);
    const pv = dm.poison * (1 - m.res.poison / 100);
    if (pv > 0 && m.hp > 0 && !m.dead) m.poison = { dps: (before + pv) / 3, t: 3 };
  }
};

// ------------------------------------------------------------------ rain of renewal
// data: total = hp to restore over RENEWAL.heal seconds, done = restored so far, shown = not yet displayed.
AREA_TICK.dr_renewal = (g, a) => {
  const h = g.hero, d = a.data;
  if (h.dead) { a.t = a.dur + 1; return; }
  const want = d.total * Math.min(1, a.t / RENEWAL.heal);
  const v = want - d.done;
  if (v <= 0) return;
  d.done = want;
  const add = Math.min(h.st.maxHp - h.hp, v);
  if (add > 0) { h.hp += add; d.shown = (d.shown ?? 0) + add; }
  // one green number per second instead of one per tick
  if ((d.shown ?? 0) >= 1 && (a.t - (d.shownT ?? 0) >= RENEWAL.show || want >= d.total)) {
    g.emit({ t: 'dmg', x: h.x, y: h.y, v: Math.round(d.shown ?? 0), kind: 'heal' });
    d.shown = 0; d.shownT = a.t;
  }
};

// ------------------------------------------------------------------ thunderstorm
// data: pct = damage per bolt, n = bolts so far, s<id> = times each monster was struck.
AREA_TICK.dr_storm = (g, a) => {
  const d = a.data;
  d.n = (d.n ?? 0) + 1;
  const ms = monstersNear(g, a.x, a.y, a.r);
  if (ms.length) {
    // spread the bolts: the least-struck enemy first, nearest the eye of the storm on ties
    ms.sort((p, q) => (d['s' + p.id] ?? 0) - (d['s' + q.id] ?? 0) || dist(p, a.x, a.y) - dist(q, a.x, a.y) || p.id - q.id);
    const t = ms[0];
    d['s' + t.id] = (d['s' + t.id] ?? 0) + 1;
    const dm = roll(g, d.pct, 'light', 'spell');
    dm.srcX = t.x - 0.4; dm.srcY = t.y - 0.4;
    hurtMonster(g, t, dm);
    fx(g, 'dr_bolt', t.x, t.y, { n: d.n, r: 1 });
    sfx(g, 'dr_thunder', t.x, t.y);
    shake(g, 0.1);
  } else if (d.n % 3 === 1) {
    // an empty storm still flickers now and then (visual only)
    const ang = g.rng.range(0, TAU), rr = Math.sqrt(g.rng.next()) * a.r * 0.85;
    const x = a.x + Math.cos(ang) * rr, y = a.y + Math.sin(ang) * rr;
    fx(g, 'dr_bolt', x, y, { n: d.n, r: 0 });
    sfx(g, 'dr_thunder', x, y);
  }
};

// ------------------------------------------------------------------ skills
registerSkills({
  // ---- basic: a hard thorn seed flicked from the staff
  dr_thorn: {
    apply({ g, h, def, ang }) {
      const p: Proj = shoot(g, 'dr_seed', ang, roll(g, 100, null, 'proj'), { speed: SEED.speed, life: def.range / SEED.speed, r: SEED.r, onHit: 'dr_seed' });
      p.data = { spin: g.rng.range(0, TAU) };
      fx(g, 'dr_seedCast', h.x, h.y, { x2: Math.cos(ang), y2: Math.sin(ang) });
      sfx(g, 'dr_seedShot', h.x, h.y);
    },
  },

  // ---- tornado: wanders forward for 1.6 s, passing through enemies and striking each one every 0.4 s
  dr_tornado: {
    apply({ g, h, def, rank, ang }) {
      const dm = roll(g, def.pct(rank), null, 'spell');
      dm.kb = TORNADO.kb;
      let x = h.x + Math.cos(ang) * 0.7, y = h.y + Math.sin(ang) * 0.7;
      if (blocked(g, x, y)) { x = h.x; y = h.y; }
      shoot(g, 'dr_tornado', ang, dm, {
        speed: TORNADO.speed * 0.55, life: TORNADO.life, r: TORNADO.r, pierce: 1e6, rehit: TORNADO.rehit, ghost: true,
        motion: 'dr_tornado', onHit: 'dr_tornado', from: { x, y },
        data: { a: ang, a0: ang, turn: 0, ph: g.rng.range(0, TAU), pct: def.pct(rank) },
      });
      fx(g, 'dr_tornadoCast', x, y, { x2: Math.cos(ang), y2: Math.sin(ang) });
    },
  },

  // ---- thorny vines: a 4 s field at the target that roots on first touch, then slows and poisons
  dr_vines: {
    apply({ g, a, def, rank }) {
      const f = addArea(g, 'dr_vines', 'hero', a.tx, a.ty, VINES.r, VINES.dur, emptyDmg(), {
        tick: VINES.step, tickT: VINES.step, data: { noDmg: 1, pct: def.pct(rank), next: VINES.first, n: 0, seed: Math.floor(g.rng.range(0, 1000)) },
      });
      // (visual only) mark the stems that would sprout out of a wall so the art skips them
      let wall = 0;
      for (let i = 0; i < VINE_STEMS; i++) { const v = vineSpot(f, i); if (blocked(g, f.x + v.dx, f.y + v.dy)) wall |= 1 << i; }
      f.data.wall = wall;
      capAreas(g, 'dr_vines', VINES.max);
      fx(g, 'dr_vinesCast', a.tx, a.ty, { r: VINES.r });
      sfx(g, 'dr_vinesGrow', a.tx, a.ty);
    },
  },

  // ---- spirit wolves: 3 (4 from rank 6) spirits fan out, pick their prey and run it down
  dr_wolves: {
    apply({ g, h, a, def, rank, ang }) {
      const n = wolfCount(rank);
      // prey: the clicked monster first, then the ones nearest the aim point that the druid can see
      const prey = g.world.monsters.filter((m) => !m.dead && dist(m, h.x, h.y) <= def.range + m.r && los(g.world, h.x, h.y, m.x, m.y));
      prey.sort((p, q) => (p.id === a.targetId ? -1 : 0) - (q.id === a.targetId ? -1 : 0) || dist(p, a.tx, a.ty) - dist(q, a.tx, a.ty) || p.id - q.id);
      for (let i = 0; i < n; i++) {
        const t = prey.length ? prey[i % prey.length] : null;
        const off = (i - (n - 1) / 2) * (WOLVES.fan / Math.max(1, (n - 1) / 2));
        const wa = ang + off;
        const dm = roll(g, def.pct(rank), null, 'melee');
        dm.kb = 0.25;
        shoot(g, 'dr_wolf', wa, dm, {
          speed: WOLVES.speed * 0.5, life: WOLVES.life + i * 0.05, r: WOLVES.r, ghost: true, motion: 'dr_wolf', onHit: 'dr_wolf',
          targetId: t?.id ?? 0, from: { x: h.x + Math.cos(wa) * 0.5, y: h.y + Math.sin(wa) * 0.5 },
          data: { a: wa, i },
        });
      }
      fx(g, 'dr_wolvesCast', h.x, h.y, { x2: Math.cos(ang), y2: Math.sin(ang), n });
      sfx(g, 'dr_wolfRelease', h.x, h.y);
    },
  },

  // ---- rain of renewal: heals a share of max life over 4 s, then regeneration for 10 s
  dr_renewal: {
    apply({ g, h, def, rank }) {
      g.world.areas = g.world.areas.filter((q) => !(q.kind === 'dr_renewal' && q.side === 'hero'));
      addArea(g, 'dr_renewal', 'hero', h.x, h.y, def.range, RENEWAL.dur, emptyDmg(), {
        follow: true, tick: RENEWAL.tick, tickT: RENEWAL.tick, data: { noDmg: 1, total: (h.st.maxHp * def.pct(rank)) / 100, done: 0, shown: 0, shownT: 0 },
      });
      addBuff(g, 'dr_renewal', '생명의 비', RENEWAL.regen, { hpRegen: renewalRegen(rank) }, '#9be870');
      fx(g, 'dr_renewalCast', h.x, h.y, { r: def.range });
      sfx(g, 'dr_rain', h.x, h.y);
    },
  },

  // ---- thunderstorm: a cloud over the target strikes an enemy inside every 0.35 s for 6 s
  dr_storm: {
    apply({ g, a, def, rank }) {
      addArea(g, 'dr_storm', 'hero', a.tx, a.ty, STORM.r, STORM.dur, emptyDmg(), {
        tick: STORM.tick, tickT: STORM.first, data: { noDmg: 1, pct: def.pct(rank), n: 0 },
      });
      capAreas(g, 'dr_storm', 2);
      fx(g, 'dr_stormCast', a.tx, a.ty, { r: STORM.r });
      sfx(g, 'dr_stormGather', a.tx, a.ty);
    },
  },
});
