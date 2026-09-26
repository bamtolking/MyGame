// Hero attacks and skills: validation, starting the action, and applying the effect at the impact frame.
import { CLASSES, SKILLS, type SkillDef } from '../data/classes';
import { addArea, breakPropsNear, heroRoll, hurtMonster, scaleDmg, spawnProj, useProp } from './combat';
import { circleFree, los, nearestWalkable } from './path';
import { SKILL_IMPL, type SkillCtx } from './registry';
import { skillRank } from './stats';
import type { Game } from './game';
import type { Elem, HeroAct, Monster, Prop } from './types';

export function skillIdForSlot(g: Game, slot: number): string {
  const c = CLASSES[g.hero.cls];
  return slot < 0 ? c.basic : c.skills[slot];
}

export function rankOf(g: Game, slot: number): number {
  if (slot < 0) return 1;
  return skillRank(g.hero, skillIdForSlot(g, slot));
}

export function nearestMonster(g: Game, x: number, y: number, maxD: number, needLos = true): Monster | null {
  let best: Monster | null = null, bd = maxD;
  for (const m of g.world.monsters) {
    if (m.dead) continue;
    const d = Math.hypot(m.x - x, m.y - y) - m.r;
    if (d < bd && (!needLos || los(g.world, g.hero.x, g.hero.y, m.x, m.y))) { bd = d; best = m; }
  }
  return best;
}

export type CastResult = 'ok' | 'approach' | 'nomana' | 'cooldown' | 'unlearned' | 'busy' | 'invalid';

/** Tries to start a skill (slot -1 = basic attack) aimed at (x,y) / target id. */
export function tryCast(g: Game, slot: number, x: number, y: number, targetId: number): CastResult {
  const h = g.hero;
  if (h.dead) return 'invalid';
  if (h.act) return 'busy';
  if (g.world.floor === 0) return 'invalid';
  const id = skillIdForSlot(g, slot);
  const def = SKILLS[id];
  const rank = rankOf(g, slot);
  if (rank <= 0) return 'unlearned';
  if (slot >= 0 && h.cds[slot] > 0) return 'cooldown';
  const mana = def.mana(rank);
  if (h.mp < mana) return 'nomana';
  let target: Monster | undefined;
  if (targetId) target = g.world.monsters.find((m) => m.id === targetId && !m.dead);
  if (def.move === 'behind' && !target) target = nearestMonster(g, x, y, 2.2, true) ?? undefined;
  if (def.kind === 'melee') {
    if (!target) target = nearestMonster(g, x, y, 1.6) ?? undefined;
    const reach = h.st.reach + h.r + (target?.r ?? 0.3);
    if (target) {
      if (Math.hypot(target.x - h.x, target.y - h.y) > reach + 0.1) return 'approach';
      x = target.x; y = target.y;
    }
  }
  if (def.move) {
    const dest = def.move === 'behind' ? behindDest(g, def, target) : moveDest(g, def, x, y);
    if (!dest) return 'invalid';
    x = dest.x; y = dest.y;
  }
  if (def.kind === 'target') {
    const d = Math.hypot(x - h.x, y - h.y);
    if (d > def.range) { x = h.x + ((x - h.x) / d) * def.range; y = h.y + ((y - h.y) / d) * def.range; }
  }
  const impl = SKILL_IMPL[id];
  if (impl?.canCast && !impl.canCast(g, x, y, target?.id ?? targetId, rank)) return 'invalid';
  h.mp -= mana;
  if (slot >= 0) { const cd = def.cd(rank); if (cd > 0) h.cds[slot] = cd; }
  if (Math.hypot(x - h.x, y - h.y) > 0.01) h.facing = Math.atan2(y - h.y, x - h.x);
  const swing = 1 / h.st.aps;
  const act: HeroAct = { kind: slot < 0 ? 'attack' : 'skill', skill: id, t: 0, dur: swing, hitAt: swing * 0.5, fired: false, tx: x, ty: y, targetId: target?.id ?? targetId, fx: h.x, fy: h.y };
  if (id === 'warcry' || id === 'berserk') { act.dur = 0.5; act.hitAt = 0.25; }
  if (id === 'leap') { act.kind = 'leap'; act.dur = 0.55; act.hitAt = 0.55; }
  if (id === 'dash') { act.kind = 'dash'; act.dur = 0.22; act.hitAt = 0.22; h.invulnT = 0.3; }
  if (id === 'teleport') { act.dur = 0.3; act.hitAt = 0.12; }
  if (id === 'strafe') { act.kind = 'channel'; act.dur = 1.5; act.hitAt = 0; act.n = 0; }
  if (id === 'meteor' || id === 'frostnova' || id === 'rain') { act.dur = Math.max(0.4, swing * 0.9); act.hitAt = act.dur * 0.55; }
  const tm = def.timing;
  if (tm) {
    if (tm.kind) act.kind = tm.kind;
    if (tm.dur !== undefined) act.dur = tm.rel ? swing * tm.dur : tm.dur;
    act.hitAt = act.dur * (tm.hitAt ?? 0.5);
    if (tm.invuln) h.invulnT = Math.max(h.invulnT, tm.invuln);
  } else if (def.move === 'dash' && !act.kind.startsWith('dash')) { act.kind = 'dash'; act.dur = 0.25; act.hitAt = act.dur; }
  else if (def.move === 'leap' && act.kind !== 'leap') { act.kind = 'leap'; act.dur = 0.55; act.hitAt = act.dur; }
  if (act.kind === 'channel') act.n = 0;
  h.act = act;
  h.path = null;
  g.emit({ t: 'sfx', id: 'cast_' + id });
  return 'ok';
}

/** Landing spot behind a monster (seen from the hero), for 'behind' movement skills. */
function behindDest(g: Game, def: SkillDef, m: Monster | undefined): { x: number; y: number } | null {
  const h = g.hero, w = g.world;
  if (!m || Math.hypot(m.x - h.x, m.y - h.y) > def.range + m.r) return null;
  const a = Math.atan2(m.y - h.y, m.x - h.x);
  for (const off of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, Math.PI]) {
    const d = m.r + h.r + 0.15;
    const px = m.x + Math.cos(a + off) * d, py = m.y + Math.sin(a + off) * d;
    if (circleFree(w, px, py, h.r)) return { x: px, y: py };
  }
  return null;
}

function moveDest(g: Game, def: SkillDef, x: number, y: number): { x: number; y: number } | null {
  const h = g.hero, w = g.world;
  let dx = x - h.x, dy = y - h.y;
  let d = Math.hypot(dx, dy);
  if (d < 0.3) {
    // a leap aimed at the hero's own feet (enemy hugging the hero) slams in place
    if (def.move === 'leap') return { x: h.x, y: h.y };
    dx = Math.cos(h.facing); dy = Math.sin(h.facing); d = 1;
    if (def.move === 'dash') { x = h.x + dx * def.range; y = h.y + dy * def.range; } else return null;
  }
  const maxR = def.range;
  if (d > maxR) { x = h.x + (dx / d) * maxR; y = h.y + (dy / d) * maxR; d = maxR; }
  if (def.move === 'dash') {
    // dash stops at the first obstacle
    const ux = (x - h.x) / d, uy = (y - h.y) / d;
    let lastOk = { x: h.x, y: h.y };
    for (let s = 0.25; s <= d; s += 0.25) {
      const px = h.x + ux * s, py = h.y + uy * s;
      if (!circleFree(w, px, py, h.r)) break;
      lastOk = { x: px, y: py };
    }
    return Math.hypot(lastOk.x - h.x, lastOk.y - h.y) > 0.5 ? lastOk : null;
  }
  // leap / teleport: land at the nearest free spot along the line (leap needs sight, teleport passes walls)
  for (let k = 0; k < 12; k++) {
    const t = 1 - k * 0.08;
    const px = h.x + (x - h.x) * t, py = h.y + (y - h.y) * t;
    if (circleFree(w, px, py, h.r) && (def.move === 'teleport' || los(w, h.x, h.y, px, py))) return { x: px, y: py };
  }
  const nw = nearestWalkable(w, x, y, 2);
  if (nw && (def.move === 'teleport' || los(w, h.x, h.y, nw.x, nw.y))) return nw;
  return null;
}

/** Called each tick while an act runs. */
export function updateAct(g: Game, dt: number): void {
  const h = g.hero;
  const a = h.act!;
  a.t += dt;
  if (a.kind === 'leap') {
    const k = Math.min(1, a.t / a.dur);
    h.x = a.fx + (a.tx - a.fx) * k; h.y = a.fy + (a.ty - a.fy) * k;
  } else if (a.kind === 'dash') {
    const k = Math.min(1, a.t / a.dur);
    h.x = a.fx + (a.tx - a.fx) * k; h.y = a.fy + (a.ty - a.fy) * k;
    if (a.skill === 'dash' && Math.random() < 0.8) g.emit({ t: 'fx', kind: 'shadow', x: h.x, y: h.y });
  } else if (a.kind === 'channel' && a.skill === 'strafe') {
    const rank = rankOf(g, 4);
    const total = 10 + rank;
    const interval = a.dur / total;
    while ((a.n ?? 0) < total && a.t >= (a.n ?? 0) * interval) {
      a.n = (a.n ?? 0) + 1;
      const targets = g.world.monsters.filter((m) => !m.dead && Math.hypot(m.x - h.x, m.y - h.y) < 10 && los(g.world, h.x, h.y, m.x, m.y));
      const t = targets.length ? targets[(a.n - 1) % targets.length] : null;
      const ang = t ? Math.atan2(t.y - h.y, t.x - h.x) : h.facing + Math.sin(a.n) * 0.6;
      h.facing = ang;
      fireArrow(g, ang, SKILLS.strafe.pct(rank), 'arrow', 0, 0);
    }
  }
  const impl = SKILL_IMPL[a.skill];
  if (impl?.tick && !a.fired) impl.tick(skillCtx(g, a), dt);
  if (h.act !== a) return;
  if (!a.fired && a.t >= a.hitAt) { a.fired = true; applyAct(g, a); }
  if (a.t >= a.dur && h.act === a) h.act = null;
}

/** Context handed to class skill implementations. */
export function skillCtx(g: Game, a: HeroAct): SkillCtx {
  const h = g.hero;
  const slot = CLASSES[h.cls].skills.indexOf(a.skill);
  return { g, h, a, def: SKILLS[a.skill], rank: slot < 0 ? 1 : rankOf(g, slot), ang: Math.atan2(a.ty - h.y, a.tx - h.x) };
}

export function fireArrow(g: Game, ang: number, pct: number, kind: 'arrow' | 'bolt' | 'explode' | 'fireball', aoe: number, pierce: number, conv: 'fire' | null = null): void {
  const h = g.hero;
  const sp = kind === 'arrow' || kind === 'explode' ? 15 : kind === 'bolt' ? 12 : 10;
  const d = heroRoll(g, pct, conv);
  spawnProj(g, kind, 'hero', h.x + Math.cos(ang) * 0.4, h.y + Math.sin(ang) * 0.4, Math.cos(ang) * sp, Math.sin(ang) * sp, d, { life: 0.9, r: kind === 'fireball' ? 0.28 : 0.2, aoe, pierce, aoeMult: 0.8 });
}

export function meleeTargets(g: Game, a: HeroAct, radius: number, arc: boolean): Monster[] {
  const h = g.hero;
  const out: Monster[] = [];
  const t = g.world.monsters.find((m) => m.id === a.targetId && !m.dead);
  if (t && Math.hypot(t.x - h.x, t.y - h.y) <= radius + t.r + 0.4) out.push(t);
  if (!arc) {
    if (!out.length) {
      // swing at whatever stands in front
      const f = g.world.monsters.filter((m) => !m.dead && Math.hypot(m.x - h.x, m.y - h.y) <= radius + m.r && Math.abs(angDiff(Math.atan2(m.y - h.y, m.x - h.x), h.facing)) < 0.9);
      f.sort((p, q) => Math.hypot(p.x - h.x, p.y - h.y) - Math.hypot(q.x - h.x, q.y - h.y));
      if (f[0]) out.push(f[0]);
    }
    return out;
  }
  for (const m of g.world.monsters) if (!m.dead && m !== t && Math.hypot(m.x - h.x, m.y - h.y) <= radius + m.r) out.push(m);
  return out;
}

/** Element tint for weapon trails (from the strongest elemental add on gear). */
export function swingElem(g: Game): Elem {
  const a = g.hero.st.adds;
  const best = (['fire', 'cold', 'light', 'poison'] as const).reduce((b, e) => (a[e][1] > a[b][1] ? e : b), 'fire' as 'fire' | 'cold' | 'light' | 'poison');
  return a[best][1] > 0 ? best : 'phys';
}

const angDiff = (a: number, b: number) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export function hitProp(g: Game, a: HeroAct): void {
  const p = g.world.props.find((q) => q.id === a.targetId);
  if (p && !p.used && (p.kind === 'barrel' || p.kind === 'crate')) useProp(g, p as Prop);
}

function applyAct(g: Game, a: HeroAct): void {
  const h = g.hero;
  const slot = CLASSES[h.cls].skills.indexOf(a.skill);
  const rank = slot < 0 ? 1 : rankOf(g, slot);
  const def = SKILLS[a.skill];
  const ang = Math.atan2(a.ty - h.y, a.tx - h.x);
  switch (a.skill) {
    case 'attack': {
      const ts = meleeTargets(g, a, h.st.reach + h.r, false);
      g.emit({ t: 'swing', x: h.x, y: h.y, ang: ang, skill: 'attack', r: h.st.reach + 0.6, elem: swingElem(g) });
      for (const m of ts) hurtMonster(g, m, { ...heroRoll(g, 100), via: 'melee' });
      if (!ts.length) hitProp(g, a);
      g.emit({ t: 'sfx', id: 'swing' });
      break;
    }
    case 'bash': {
      const ts = meleeTargets(g, a, h.st.reach + h.r, false);
      g.emit({ t: 'swing', x: h.x, y: h.y, ang: ang, skill: 'bash', r: h.st.reach + 0.7, elem: swingElem(g) });
      for (const m of ts) { const d = heroRoll(g, def.pct(rank)); d.stun = 0.5 + 0.05 * rank; d.kb = 1.3; d.via = 'melee'; hurtMonster(g, m, d); }
      if (!ts.length) hitProp(g, a);
      g.emit({ t: 'sfx', id: 'swingHeavy' });
      if (ts.length) g.emit({ t: 'fx', kind: 'bash', x: ts[0].x, y: ts[0].y });
      break;
    }
    case 'cleave': {
      const r = 2.3 + 0.05 * rank;
      g.emit({ t: 'swing', x: h.x, y: h.y, ang: ang, skill: 'cleave', r, elem: swingElem(g) });
      for (const m of meleeTargets(g, a, r, true)) { const d = heroRoll(g, def.pct(rank)); d.kb = 0.4; d.via = 'melee'; hurtMonster(g, m, d); }
      breakPropsNear(g, h.x, h.y, r);
      g.emit({ t: 'fx', kind: 'cleave', x: h.x, y: h.y, r });
      g.emit({ t: 'sfx', id: 'cleave' });
      break;
    }
    case 'warcry': {
      h.buffs = h.buffs.filter((b) => b.id !== 'warcry');
      h.buffs.push({ id: 'warcry', t: 10, dur: 10, v: def.pct(rank) });
      h.dirty = true;
      for (const m of g.world.monsters) if (!m.dead && Math.hypot(m.x - h.x, m.y - h.y) < 4.2) hurtMonster(g, m, { phys: 0, fire: 0, cold: 0, light: 0, poison: 0, stun: 1 + 0.1 * rank, src: 0, noLeech: true });
      g.emit({ t: 'fx', kind: 'warcry', x: h.x, y: h.y, r: 4.2 });
      g.emit({ t: 'sfx', id: 'warcry' });
      break;
    }
    case 'leap': {
      const r = 2.4;
      for (const m of g.world.monsters) if (!m.dead && Math.hypot(m.x - h.x, m.y - h.y) <= r + m.r) { const d = heroRoll(g, def.pct(rank)); d.kb = 1.6; d.stun = 0.4; d.via = 'melee'; hurtMonster(g, m, d); }
      breakPropsNear(g, h.x, h.y, r);
      g.emit({ t: 'fx', kind: 'stomp', x: h.x, y: h.y, r });
      g.emit({ t: 'shake', v: 0.5 });
      g.emit({ t: 'sfx', id: 'stomp' });
      break;
    }
    case 'berserk': {
      h.buffs = h.buffs.filter((b) => b.id !== 'berserk');
      h.buffs.push({ id: 'berserk', t: 10, dur: 10, v: def.pct(rank) });
      h.dirty = true;
      g.emit({ t: 'fx', kind: 'berserk', x: h.x, y: h.y });
      g.emit({ t: 'sfx', id: 'berserk' });
      break;
    }
    case 'shoot': fireArrow(g, ang, 100, 'arrow', 0, 0); break;
    case 'kick': hitProp(g, a); g.emit({ t: 'sfx', id: 'swing' }); break;
    case 'bolt': fireArrow(g, ang, 100, 'bolt', 0, 0); break;
    case 'multishot': {
      const n = 3 + Math.min(4, Math.floor(rank / 3));
      const spread = 0.62;
      for (let i = 0; i < n; i++) fireArrow(g, ang + (i - (n - 1) / 2) * (spread / (n - 1)), def.pct(rank), 'arrow', 0, 0);
      break;
    }
    case 'explode': fireArrow(g, ang, def.pct(rank), 'explode', 1.8, 0, 'fire'); break;
    case 'rain': {
      const d = heroRoll(g, def.pct(rank));
      d.chill = 1.2;
      addArea(g, 'rain', 'hero', a.tx, a.ty, 2.6, 1.6, d, { tick: 0.2, tickT: 0.05 });
      break;
    }
    case 'dash': {
      h.buffs = h.buffs.filter((b) => b.id !== 'evade');
      h.buffs.push({ id: 'evade', t: 3, dur: 3, v: Math.min(60, 30 + 3 * rank) });
      h.dirty = true;
      break;
    }
    case 'fireball': fireArrow(g, ang, def.pct(rank), 'fireball', 1.5, 0, 'fire'); break;
    case 'frostnova': {
      const d = heroRoll(g, def.pct(rank), 'cold');
      d.freeze = 1.4 + 0.1 * rank;
      addArea(g, 'nova', 'hero', h.x, h.y, 4.5, 0.35, d, { data: { cold: 1 } });
      g.emit({ t: 'fx', kind: 'frostnova', x: h.x, y: h.y, r: 4.5 });
      g.emit({ t: 'sfx', id: 'frost' });
      break;
    }
    case 'chain': {
      const jumps = 4 + Math.floor(rank / 3);
      let from = { x: h.x, y: h.y };
      let cur: Monster | null = g.world.monsters.find((m) => m.id === a.targetId && !m.dead) ?? null;
      if (!cur) {
        // first monster near the aim line
        let best: Monster | null = null, bd = 99;
        for (const m of g.world.monsters) {
          if (m.dead) continue;
          const dist = Math.hypot(m.x - h.x, m.y - h.y);
          if (dist > def.range) continue;
          const off = Math.abs(angDiff(Math.atan2(m.y - h.y, m.x - h.x), ang));
          const score = off * 4 + dist * 0.2;
          if (off < 0.6 && score < bd && los(g.world, h.x, h.y, m.x, m.y)) { bd = score; best = m; }
        }
        cur = best;
      }
      const pts: number[] = [h.x, h.y];
      const hit: number[] = [];
      if (!cur) { pts.push(h.x + Math.cos(ang) * 6, h.y + Math.sin(ang) * 6); }
      for (let j = 0; j < jumps && cur; j++) {
        hit.push(cur.id);
        pts.push(cur.x, cur.y);
        hurtMonster(g, cur, heroRoll(g, def.pct(rank), 'light', true));
        from = { x: cur.x, y: cur.y };
        let next: Monster | null = null, nd = 5.5;
        for (const m of g.world.monsters) {
          if (m.dead || hit.includes(m.id)) continue;
          const dd = Math.hypot(m.x - from.x, m.y - from.y);
          if (dd < nd && los(g.world, from.x, from.y, m.x, m.y)) { nd = dd; next = m; }
        }
        cur = next;
      }
      g.emit({ t: 'fx', kind: 'lightning', x: h.x, y: h.y, pts });
      g.emit({ t: 'sfx', id: 'lightning' });
      break;
    }
    case 'teleport': {
      g.emit({ t: 'fx', kind: 'teleport', x: h.x, y: h.y });
      h.x = a.tx; h.y = a.ty;
      g.emit({ t: 'fx', kind: 'teleport', x: h.x, y: h.y });
      g.emit({ t: 'sfx', id: 'teleport' });
      break;
    }
    case 'meteor': {
      const d = heroRoll(g, def.pct(rank), 'fire');
      addArea(g, 'meteor', 'hero', a.tx, a.ty, 2.8, 0.01, d, { delay: 0.9, data: { burn: 0.12 } });
      g.emit({ t: 'fx', kind: 'meteorFall', x: a.tx, y: a.ty, r: 2.8 });
      break;
    }
    default: {
      const impl = SKILL_IMPL[a.skill];
      if (impl) impl.apply({ g, h, a, def, rank, ang });
      break;
    }
  }
  void scaleDmg;
}
