// necromancer: skill behaviour (registered into sim/registry via sim/kit).
// Bone bolt (basic), a bone spear that skewers every enemy on its line, corpse explosion (up to three corpses
// near the target burst one after another), skeletal mages (sentries that climb out of the ground and fire cold
// bone bolts), bone armor (damage reduction + thorns, with shards thrown at melee attackers) and a plague cloud
// (continuous poison and slow while enemies stand inside).
import {
  AREA_TICK, PROJ_HIT, PROJ_MOTION, addArea, addBuff, breakPropsNear, capAreas, circleFree, corpsesNear, emptyDmg, fx,
  hurtMonster, los, monstersNear, nearestWalkable, registerSkills, roll, sfx, shake, shoot, spawnProj,
  type Area, type Game, type Monster, type SkillCtx,
} from '../../sim/kit';
import { ARMOR, BOLT, CORPSE, MAGE, PLAGUE, PLAGUE_POISON_MULT, SPEAR } from './shared';

const dist = (m: { x: number; y: number }, x: number, y: number): number => Math.hypot(m.x - x, m.y - y);

/** Aim at the act's target monster where it stands now (it may have moved during the cast), else at the point. */
function aimAngle(c: SkillCtx): number {
  const { g, h, a } = c;
  const t = a.targetId ? g.world.monsters.find((m) => m.id === a.targetId && !m.dead) : undefined;
  if (t && dist(t, h.x, h.y) > 0.05) return Math.atan2(t.y - h.y, t.x - h.x);
  return c.ang;
}

/** A spot for something that stands on the floor: the point itself when free, else the nearest walkable tile. */
function floorSpot(g: Game, x: number, y: number): { x: number; y: number } {
  if (circleFree(g.world, x, y, 0.3)) return { x, y };
  return nearestWalkable(g.world, x, y, 3) ?? { x: g.hero.x, y: g.hero.y };
}

// ------------------------------------------------------------------ bone armor ring (thorn shards)
/** The buff survives floor changes but areas don't: restore the watcher ring when it is missing. */
function ensureArmorRing(g: Game): void {
  const h = g.hero;
  const b = h.buffs.find((q) => q.id === 'nc_armor');
  if (!b || h.dead || g.world.floor === 0 || g.world.areas.some((a) => a.kind === 'nc_armorRing' && a.side === 'hero')) return;
  addArea(g, 'nc_armorRing', 'hero', h.x, h.y, 1.2, b.t, emptyDmg(), { follow: true, tick: ARMOR.watch, tickT: ARMOR.watch, data: { noDmg: 1, hit: h.hitT } });
}

AREA_TICK.nc_armorRing = (g, a) => {
  const h = g.hero;
  if (h.dead || !h.buffs.some((b) => b.id === 'nc_armor')) { a.t = a.dur + 1; return; }
  // a fresh hit on the hero (hitT jumps back up): bone shards lash out at the enemies swinging at him
  // (the thorns damage itself is the engine's; this only shows where it goes)
  if (h.hitT > (a.data.hit ?? 0) + 1e-3) {
    let n = 0;
    for (const m of g.world.monsters) {
      if (m.dead || m.act?.kind !== 'melee' || dist(m, h.x, h.y) > h.r + m.r + 1.2) continue;
      fx(g, 'nc_thorns', h.x, h.y, { x2: m.x, y2: m.y, n: n++ });
      if (n >= 4) break;
    }
    if (n) sfx(g, 'nc_thorns', h.x, h.y);
  }
  a.data.hit = h.hitT;
};

// ------------------------------------------------------------------ bone bolt / spear impacts
PROJ_HIT.nc_bolt = (g, p, m) => {
  const l = Math.hypot(p.vx, p.vy) || 1;
  fx(g, 'nc_boltHit', m.x, m.y, { x2: m.x + p.vx / l, y2: m.y + p.vy / l });
};
PROJ_HIT.nc_spear = (g, p, m) => {
  const l = Math.hypot(p.vx, p.vy) || 1;
  fx(g, 'nc_spearHit', m.x, m.y, { x2: m.x + p.vx / l, y2: m.y + p.vy / l, n: p.hit.length });
  sfx(g, 'nc_spearHit', m.x, m.y);
};
PROJ_HIT.nc_mageBolt = (g, p, m) => {
  const l = Math.hypot(p.vx, p.vy) || 1;
  fx(g, 'nc_mageHit', m.x, m.y, { x2: m.x + p.vx / l, y2: m.y + p.vy / l });
};

// ------------------------------------------------------------------ corpse explosion
/** Usable corpses near the target (nearest first) that no earlier cast has already claimed. */
function pickCorpses(g: Game, x: number, y: number): Monster[] {
  return corpsesNear(g, x, y, CORPSE.search).filter((m) => !m.timers.ncBlast).slice(0, CORPSE.max);
}

AREA_TICK.nc_corpseBlast = (g, a) => {
  const m = g.world.monsters.find((q) => q.id === a.data.id);
  // a shaman may have raised the corpse in the meantime: nothing left to burst
  if (!m || !m.dead) return;
  m.deathStyle = 'gib'; // consumed: no longer drawn, no longer a corpse
  const st = g.hero.st;
  const d = roll(g, a.data.pct, null, 'spell');
  // weapon part half fire / half physical, plus a share of the corpse's life split the same way
  const flesh = a.data.hp * CORPSE.hpPct * st.spellMult * (d.crit ? st.critMult : 1);
  const half = d.phys * 0.5;
  d.phys = half + flesh * 0.5; d.fire += half + flesh * 0.5;
  d.kb = 0.7; d.srcX = a.x; d.srcY = a.y;
  let n = 0;
  for (const t of monstersNear(g, a.x, a.y, a.r)) { hurtMonster(g, t, { ...d }); n++; }
  breakPropsNear(g, a.x, a.y, a.r);
  fx(g, 'nc_corpseBoom', a.x, a.y, { r: a.r, n: a.data.n, x2: m.x + Math.cos(m.facing), y2: m.y + Math.sin(m.facing) });
  sfx(g, 'nc_corpseBoom', a.x, a.y);
  shake(g, n ? 0.34 : 0.22);
};

// ------------------------------------------------------------------ skeletal mage
/** The mage's body (see PROJ_MOTION.nc_mageBody below): spawned with the mage, restored if the world's
 *  projectiles were cleared under it (a floor left through a town portal keeps its areas but not its projectiles). */
function ensureMageBody(g: Game, a: Area): void {
  if (a.data.body && g.world.projs.some((p) => p.id === a.data.body)) return;
  const p = spawnProj(g, 'nc_mageBody', 'hero', a.x, a.y, 0, 0, emptyDmg(), {
    life: a.dur - a.t + 0.1, r: -10, pierce: 1e9, ghost: true, motion: 'nc_mageBody',
    data: { area: a.id, t: a.t, dur: a.dur, shot: a.data.shot ?? -9, ang: a.data.ang ?? 0 },
  });
  a.data.body = p.id;
}

AREA_TICK.nc_mage = (g, a) => {
  ensureMageBody(g, a);
  // the first tick comes when the mage has climbed out (tickT = rise); it stops shooting while crumbling
  if (a.t > a.dur - MAGE.crumble) return;
  const w = g.world;
  let best: Monster | null = null, bd = MAGE.range;
  for (const m of w.monsters) {
    if (m.dead) continue;
    const d = dist(m, a.x, a.y) - m.r;
    if (d < bd && los(w, a.x, a.y, m.x, m.y)) { bd = d; best = m; }
  }
  if (!best) return;
  const ang = Math.atan2(best.y - a.y, best.x - a.x);
  a.data.ang = ang; a.data.shot = a.t;
  const d = roll(g, a.data.pct, 'cold', 'proj');
  d.chill = Math.max(d.chill ?? 0, MAGE.chill);
  d.srcX = a.x; d.srcY = a.y;
  const ox = a.x + Math.cos(ang) * 0.35, oy = a.y + Math.sin(ang) * 0.35;
  spawnProj(g, 'nc_mageBolt', 'hero', ox, oy, Math.cos(ang) * MAGE.speed, Math.sin(ang) * MAGE.speed, d, {
    life: (MAGE.range + 0.6) / MAGE.speed, r: 0.2, homing: 3.5, targetId: best.id, onHit: 'nc_mageBolt',
  });
  fx(g, 'nc_mageShot', a.x, a.y, { x2: best.x, y2: best.y });
  sfx(g, 'nc_mageShot', a.x, a.y);
};

// The mage's body is painted by a marker projectile that never hits anything (r < 0, ghost), because projectiles
// are depth-sorted with actors and walls while area art is not. It mirrors its area's state for the art.
PROJ_MOTION.nc_mageBody = (g, p) => {
  const d = p.data ?? (p.data = {});
  const a = g.world.areas.find((q) => q.id === d.area);
  if (!a) { p.life = 0; return; }
  p.x = a.x; p.y = a.y; p.vx = 0; p.vy = 0;
  d.t = a.t; d.dur = a.dur; d.shot = a.data.shot ?? -9; d.ang = a.data.ang ?? 0;
};

// ------------------------------------------------------------------ plague
AREA_TICK.nc_plague = (g, a) => {
  for (const m of monstersNear(g, a.x, a.y, a.r)) {
    const d = roll(g, a.data.pct, 'poison', 'spell');
    // the engine spreads poison over 3 s; scaled so the cloud drains `pct` every tick while it keeps refreshing it
    d.poison *= PLAGUE_POISON_MULT;
    d.crit = false; // no "0" crit popups for a pure damage-over-time tick
    d.srcX = a.x; d.srcY = a.y;
    if (!a.hitIds.includes(m.id)) {
      // first touch: a real hit (wakes the pack, hit reaction)
      a.hitIds.push(m.id);
      const before = m.poison;
      hurtMonster(g, m, d);
      // ours (freshly set, full 3 s): only linger briefly once the enemy leaves the cloud
      if (m.poison && m.poison !== before && m.poison.t > 2.99) m.poison.t = PLAGUE.linger;
    } else {
      // later ticks only refresh the poison: no white hit flash / flinch every half second while it chokes
      const pv = d.poison * (1 - m.res.poison / 100), dps = pv / 3;
      if (pv > 0 && (!m.poison || m.poison.dps <= dps || m.poison.t <= PLAGUE.linger - PLAGUE.tick + 0.05)) m.poison = { dps, t: PLAGUE.linger };
      m.lastHitBy = 0;
    }
    if (!m.dead) fx(g, 'nc_plagueTick', m.x, m.y, { n: m.id });
  }
};

// ------------------------------------------------------------------ skills
registerSkills({
  // ---- bone bolt: a spinning shard of bone
  nc_bolt: {
    apply(c) {
      const { g, h, def } = c;
      ensureArmorRing(g);
      const ang = aimAngle(c);
      h.facing = ang;
      shoot(g, 'nc_bolt', ang, roll(g, 100, null, 'proj'), { speed: BOLT.speed, life: (def.range + 0.3) / BOLT.speed, r: BOLT.r, onHit: 'nc_bolt' });
      fx(g, 'nc_boltCast', h.x, h.y, { x2: h.x + Math.cos(ang), y2: h.y + Math.sin(ang) });
      sfx(g, 'nc_boltFire', h.x, h.y);
    },
  },

  // ---- bone spear: pierces everything on its line
  nc_spear: {
    apply(c) {
      const { g, h, def, rank } = c;
      ensureArmorRing(g);
      const ang = aimAngle(c);
      h.facing = ang;
      const d = roll(g, def.pct(rank), null, 'proj');
      d.kb = SPEAR.kb;
      shoot(g, 'nc_spear', ang, d, {
        speed: SPEAR.speed, life: (def.range + 0.3) / SPEAR.speed, r: SPEAR.r, pierce: 1e6, onHit: 'nc_spear',
        from: { x: h.x + Math.cos(ang) * 0.5, y: h.y + Math.sin(ang) * 0.5 },
      });
      fx(g, 'nc_spearCast', h.x, h.y, { x2: h.x + Math.cos(ang), y2: h.y + Math.sin(ang) });
      sfx(g, 'nc_spearFire', h.x, h.y);
      shake(g, 0.12);
    },
  },

  // ---- corpse explosion: up to three corpses near the target swell and burst one after another
  nc_corpse: {
    canCast(g, x, y) { return pickCorpses(g, x, y).length > 0; },
    apply({ g, h, a, def, rank }) {
      ensureArmorRing(g);
      const cs = pickCorpses(g, a.tx, a.ty);
      cs.forEach((m, i) => {
        m.timers.ncBlast = 1;
        const delay = CORPSE.swell + i * CORPSE.stagger;
        addArea(g, 'nc_corpseBlast', 'hero', m.x, m.y, CORPSE.radius, 0.01, emptyDmg(), {
          delay, tick: 0, data: { noDmg: 1, pct: def.pct(rank), id: m.id, hp: m.maxHp, n: i },
        });
        fx(g, 'nc_corpseMark', m.x, m.y, { r: delay, n: i });
      });
      if (cs.length) fx(g, 'nc_corpseCast', h.x, h.y, { x2: cs[0].x, y2: cs[0].y, n: cs.length });
    },
  },

  // ---- skeletal mage: a sentry climbing out of the ground (AREA_TICK above shoots)
  nc_mage: {
    apply({ g, h, a, def, rank }) {
      ensureArmorRing(g);
      const p = floorSpot(g, a.tx, a.ty);
      const mine = g.world.areas.filter((q) => q.kind === 'nc_mage' && q.side === 'hero');
      for (const old of mine.slice(0, Math.max(0, mine.length + 1 - MAGE.max))) fx(g, 'nc_mageGone', old.x, old.y);
      const face = Math.hypot(p.x - h.x, p.y - h.y) > 0.3 ? Math.atan2(p.y - h.y, p.x - h.x) : h.facing;
      const area = addArea(g, 'nc_mage', 'hero', p.x, p.y, 0.45, MAGE.dur, emptyDmg(), {
        tick: MAGE.every, tickT: MAGE.rise, data: { noDmg: 1, pct: def.pct(rank), ang: face, shot: -9 },
      });
      capAreas(g, 'nc_mage', MAGE.max);
      ensureMageBody(g, area);
      fx(g, 'nc_mageRise', p.x, p.y, { x2: h.x, y2: h.y });
      sfx(g, 'nc_mageRise', p.x, p.y);
    },
  },

  // ---- bone armor: damage reduction and thorns for 12 s
  nc_armor: {
    apply({ g, h, def, rank }) {
      addBuff(g, 'nc_armor', '뼈 갑옷', ARMOR.dur, { dmgTaken: Math.min(40, Math.round(def.pct(rank))), thorns: 10 + 3 * rank }, '#e6dcc2');
      g.world.areas = g.world.areas.filter((q) => !(q.kind === 'nc_armorRing' && q.side === 'hero'));
      ensureArmorRing(g);
      fx(g, 'nc_armorCast', h.x, h.y);
      sfx(g, 'nc_armorUp', h.x, h.y);
    },
  },

  // ---- plague: a slowing poison cloud (AREA_TICK above)
  nc_plague: {
    apply({ g, h, a, def, rank }) {
      ensureArmorRing(g);
      const p = floorSpot(g, a.tx, a.ty);
      addArea(g, 'nc_plague', 'hero', p.x, p.y, PLAGUE.r, PLAGUE.dur, emptyDmg(), {
        tick: PLAGUE.tick, tickT: 0.15, data: { noDmg: 1, chill: PLAGUE.chill, pct: def.pct(rank) },
      });
      fx(g, 'nc_plagueCast', h.x, h.y, { x2: p.x, y2: p.y, r: PLAGUE.r });
      sfx(g, 'nc_plagueBurst', p.x, p.y);
    },
  },
});
