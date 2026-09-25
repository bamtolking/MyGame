// Monster behaviour: waking, chasing along the flow field, melee/ranged/caster patterns and specials.
import { MONSTERS, type MonsterTpl } from '../data/monsters';
import { emptyDmg, hurtHero, killMonster, spawnProj, wake } from './combat';
import { updateBoss } from './bosses';
import { circleFree, flowDir, los, moveCircle, nearestWalkable, walkLine } from './path';
import type { Game } from './game';
import type { Dmg, Monster, ProjKind } from './types';

export const wallR = (m: Monster) => Math.min(m.r, 0.42);

export function monDmg(g: Game, m: Monster, mult = 1, elemOverride?: string): Dmg {
  const t = MONSTERS[m.tpl];
  const v = g.rng.range(m.dmg[0], m.dmg[1] + 0.999) * mult;
  const d = emptyDmg();
  const e = (elemOverride ?? t.elem) as keyof Dmg;
  if (e === 'phys') d.phys = v;
  else if (e === 'fire' || e === 'cold' || e === 'light' || e === 'poison') { d[e] = v * 0.85; d.phys = v * 0.15; }
  if (m.mods.includes('fireEnch')) d.fire += v * 0.5;
  if (m.mods.includes('coldEnch')) { d.cold += v * 0.4; d.chill = 1.5; }
  if (m.mods.includes('lightEnch')) d.light += v * 0.4;
  d.src = m.id; d.srcX = m.x; d.srcY = m.y;
  return d;
}

export function reachOf(g: Game, m: Monster): number {
  return m.r + g.hero.r + MONSTERS[m.tpl].range * 0.5;
}

export function moveToward(g: Game, m: Monster, tx: number, ty: number, sp: number, dt: number, useFlow = true): boolean {
  const w = g.world;
  const fly = !!MONSTERS[m.tpl].flying;
  const d = Math.hypot(tx - m.x, ty - m.y);
  if (d < 0.05) { m.moving = false; return false; }
  let dx = (tx - m.x) / d, dy = (ty - m.y) / d;
  if (useFlow && !(d < 14 && walkLine(w, m.x, m.y, tx, ty, wallR(m) * 0.9, fly))) {
    const f = flowDir(w, m.x, m.y, fly);
    if (f) { dx = f.x; dy = f.y; }
  }
  m.facing = Math.atan2(dy, dx);
  const step = Math.min(sp * dt, d);
  const moved = moveCircle(w, m, wallR(m), dx * step, dy * step, fly);
  m.moving = moved;
  return moved;
}

function moveAway(g: Game, m: Monster, sp: number, dt: number): void {
  const h = g.hero;
  const dx = m.x - h.x, dy = m.y - h.y, l = Math.hypot(dx, dy) || 1;
  m.facing = Math.atan2(dy, dx);
  const fly = !!MONSTERS[m.tpl].flying;
  let moved = moveCircle(g.world, m, wallR(m), (dx / l) * sp * dt, (dy / l) * sp * dt, fly);
  if (!moved) { // slide sideways when cornered
    const s = (m.id % 2 ? 1 : -1);
    moved = moveCircle(g.world, m, wallR(m), (-dy / l) * s * sp * dt, (dx / l) * s * sp * dt, fly);
  }
  m.moving = moved;
}

function idleWander(g: Game, m: Monster, dt: number): void {
  m.timers.wander = (m.timers.wander ?? 0) - dt;
  if (m.timers.wander <= 0) {
    m.timers.wander = g.rng.range(2, 6);
    m.timers.wx = m.homeX + g.rng.range(-2, 2);
    m.timers.wy = m.homeY + g.rng.range(-2, 2);
    m.timers.wgo = g.rng.chance(0.5) ? 1 : 0;
  }
  if (m.timers.wgo && Math.hypot(m.timers.wx - m.x, m.timers.wy - m.y) > 0.2) {
    const moved = moveToward(g, m, m.timers.wx, m.timers.wy, m.speed * 0.35, dt, false);
    if (!moved) m.timers.wgo = 0;
  } else m.moving = false;
}

export function startAct(m: Monster, kind: 'melee' | 'shoot' | 'cast' | 'special', dur: number, hitAt: number, tx: number, ty: number, spec = ''): void {
  m.act = { kind, t: 0, dur, hitAt, done: false, tx, ty, spec };
  m.moving = false;
  m.facing = Math.atan2(ty - m.y, tx - m.x);
}

export function shoot(g: Game, m: Monster, kind: ProjKind, tx: number, ty: number, speed: number, mult = 1, spread = 0, n = 1, extra: Record<string, number> = {}): void {
  const a0 = Math.atan2(ty - m.y, tx - m.x);
  for (let i = 0; i < n; i++) {
    const a = a0 + (n > 1 ? (i - (n - 1) / 2) * spread : 0);
    const d = monDmg(g, m, mult, kind === 'coldbolt' || kind === 'frost' ? 'cold' : kind === 'firebolt' || kind === 'fireball' || kind === 'spit' ? 'fire' : kind === 'lightning' || kind === 'spark' ? 'light' : undefined);
    if (kind === 'coldbolt') d.chill = 2;
    spawnProj(g, kind, 'mon', m.x + Math.cos(a) * m.r, m.y + Math.sin(a) * m.r, Math.cos(a) * speed, Math.sin(a) * speed, d, {
      life: 2.2, r: kind === 'fireball' ? 0.3 : 0.2, aoe: extra.aoe ?? (kind === 'spit' ? 0.9 : kind === 'fireball' ? 1.3 : 0), aoeMult: 0.7,
      homing: extra.homing ?? (kind === 'blood' ? 1.4 : 0), targetId: g.hero.id,
    });
  }
  g.emit({ t: 'sfx', id: 'mshoot_' + kind, x: m.x, y: m.y });
}

function blinkNear(g: Game, m: Monster, near: boolean): void {
  const h = g.hero;
  for (let k = 0; k < 16; k++) {
    const a = g.rng.range(0, Math.PI * 2);
    const r = near ? g.rng.range(1.4, 2.6) : g.rng.range(5, 8);
    const x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r;
    if (!circleFree(g.world, x, y, wallR(m))) continue;
    if (!los(g.world, h.x, h.y, x, y)) continue;
    g.emit({ t: 'fx', kind: 'blink', x: m.x, y: m.y });
    m.x = x; m.y = y;
    g.emit({ t: 'fx', kind: 'blink', x, y });
    g.emit({ t: 'sfx', id: 'blink', x, y });
    return;
  }
}

/** Advances an in-progress monster action. Returns true while the action is running. */
function runAct(g: Game, m: Monster, dt: number): boolean {
  const a = m.act!;
  const h = g.hero;
  const t = MONSTERS[m.tpl];
  a.t += dt;
  if (a.spec === 'charge') {
    if (a.t < 0.35) { m.facing = Math.atan2(h.y - m.y, h.x - m.x); a.tx = h.x; a.ty = h.y; return true; }
    const dx = Math.cos(m.facing), dy = Math.sin(m.facing);
    const sp = m.speed * 3.4;
    const moved = moveCircle(g.world, m, wallR(m), dx * sp * dt, dy * sp * dt, !!t.flying);
    m.moving = true;
    if (!a.done && Math.hypot(h.x - m.x, h.y - m.y) < m.r + h.r + 0.25) {
      a.done = true;
      hurtHero(g, monDmg(g, m, 1.6), m, 'melee');
      g.emit({ t: 'shake', v: 0.5 });
      g.emit({ t: 'sfx', id: 'stomp', x: m.x, y: m.y });
      m.act = null; m.atkCd = 1 / m.atkRate;
      return false;
    }
    if (!moved || a.t >= a.dur) { m.act = null; m.moving = false; return false; }
    return true;
  }
  if (!a.done && a.t >= a.hitAt) {
    a.done = true;
    if (a.kind === 'melee') {
      g.emit({ t: 'mattack', id: m.id, x: m.x, y: m.y, ang: Math.atan2(h.y - m.y, h.x - m.x), r: reachOf(g, m), heavy: t.scale >= 1.3 });
      if (Math.hypot(h.x - m.x, h.y - m.y) <= reachOf(g, m) + 0.45) hurtHero(g, monDmg(g, m), m, 'melee');
      g.emit({ t: 'sfx', id: t.scale >= 1.3 ? 'mswingHeavy' : 'mswing', x: m.x, y: m.y });
    } else if (a.kind === 'shoot') {
      const multi = m.mods.includes('multishot') ? 3 : 1;
      shoot(g, m, t.proj ?? 'arrow', a.tx, a.ty, t.projSpeed ?? 9, 1, 0.22, multi);
    } else if (a.kind === 'cast') {
      castSpecial(g, m, a.spec);
    }
  }
  if (a.t >= a.dur) { m.act = null; return false; }
  return true;
}

function castSpecial(g: Game, m: Monster, spec: string): void {
  const t = MONSTERS[m.tpl], h = g.hero, w = g.world;
  switch (spec) {
    case 'bolt': shoot(g, m, t.proj ?? 'firebolt', h.x, h.y, t.projSpeed ?? 8, 1, 0, m.mods.includes('multishot') ? 3 : 1); break;
    case 'triple': shoot(g, m, t.proj ?? 'coldbolt', h.x, h.y, t.projSpeed ?? 8, 0.8, 0.28, 3); break;
    case 'revive': {
      let n = 0;
      for (const o of w.monsters) {
        // blown-apart or shattered corpses cannot be raised
        if (!o.dead || o.tpl !== 'fallen' || o.deadT > 40 || n >= 3 || o.deathStyle === 'gib' || o.deathStyle === 'shatter') continue;
        if (Math.hypot(o.x - m.x, o.y - m.y) > 8) continue;
        o.dead = false; o.hp = o.maxHp; o.deadT = 0; o.awake = true; o.summoned = true; o.fleeT = 0; o.deathStyle = 'normal';
        g.emit({ t: 'fx', kind: 'resurrect', x: o.x, y: o.y });
        n++;
      }
      if (n) g.emit({ t: 'sfx', id: 'resurrect', x: m.x, y: m.y });
      break;
    }
  }
}

export function updateMonster(g: Game, m: Monster, dt: number): void {
  const h = g.hero;
  const t: MonsterTpl = MONSTERS[m.tpl];
  if (m.dead) { m.deadT += dt; return; }
  const dx = h.x - m.x, dy = h.y - m.y, dist = Math.hypot(dx, dy);
  if (!m.awake && dist > 26) return;
  m.anim += dt;
  if (m.hitT > 0) m.hitT -= dt;
  // damage over time
  if (m.poison) {
    const d = Math.min(m.poison.t, dt) * m.poison.dps;
    m.hp -= d; m.poison.t -= dt;
    m.timers.dot = (m.timers.dot ?? 0) + d;
    if (m.poison.t <= 0) m.poison = null;
  }
  if (m.burn) {
    const d = Math.min(m.burn.t, dt) * m.burn.dps;
    m.hp -= d; m.burn.t -= dt;
    m.timers.dot = (m.timers.dot ?? 0) + d;
    if (m.burn.t <= 0) m.burn = null;
  }
  if ((m.timers.dot ?? 0) >= 1 && (m.timers.dotT = (m.timers.dotT ?? 0) - dt) <= 0) {
    g.emit({ t: 'dmg', x: m.x, y: m.y, v: Math.round(m.timers.dot), kind: 'normal', elem: 'poison' });
    m.timers.dot = 0; m.timers.dotT = 0.6;
  }
  if (m.hp <= 0) { killMonster(g, m); return; }
  // knockback
  if (Math.abs(m.kbx) + Math.abs(m.kby) > 0.05) {
    moveCircle(g.world, m, wallR(m), m.kbx * dt, m.kby * dt, !!t.flying);
    const k = Math.exp(-7 * dt); m.kbx *= k; m.kby *= k;
  } else { m.kbx = 0; m.kby = 0; }
  if (m.stunT > 0) m.stunT -= dt;
  if (m.freezeT > 0) m.freezeT -= dt;
  if (m.chillT > 0) m.chillT -= dt;
  if (m.fleeT > 0) m.fleeT -= dt;
  m.atkCd -= dt;
  m.aiT -= dt;
  if (m.timers.special !== undefined) m.timers.special -= dt;
  if (m.freezeT > 0 || m.stunT > 0) { m.moving = false; return; }

  if (!m.awake) {
    const aggro = t.ai === 'ranged' || t.ai === 'caster' || t.ai === 'summoner' ? 10 : t.ai === 'boss' ? 9 : 8.5;
    if (!h.dead && dist < aggro && m.aiT <= 0) {
      m.aiT = 0.25;
      if (los(g.world, m.x, m.y, h.x, h.y)) wake(g, m);
    }
    if (!m.awake) { idleWander(g, m, dt); return; }
  }
  if (t.ai === 'boss') { updateBoss(g, m, dt, dist); return; }
  if (h.dead) { idleWander(g, m, dt); return; }
  if (m.act) { runAct(g, m, dt); return; }
  const sp = m.speed * (m.chillT > 0 ? 0.5 : 1);
  if (m.fleeT > 0) { moveAway(g, m, sp * 1.1, dt); return; }

  if (m.mods.includes('teleport')) {
    m.timers.tp = (m.timers.tp ?? 3) - dt;
    if (m.timers.tp <= 0 && dist > 3 && dist < 12) { m.timers.tp = g.rng.range(4, 7); blinkNear(g, m, true); return; }
  }

  const reach = reachOf(g, m);
  const canSee = () => los(g.world, m.x, m.y, h.x, h.y);
  const melee = () => {
    if (dist <= reach) {
      m.moving = false;
      m.facing = Math.atan2(dy, dx);
      if (m.atkCd <= 0) { m.atkCd = 1 / m.atkRate; startAct(m, 'melee', Math.min(0.7, 0.55 / Math.max(0.6, m.atkRate)), 0.5 * Math.min(0.7, 0.55 / Math.max(0.6, m.atkRate)), h.x, h.y); }
    } else moveToward(g, m, h.x, h.y, sp, dt);
  };
  const ranged = (keep: number) => {
    if (dist < keep && m.timers.kite === undefined) m.timers.kite = 0;
    if (dist < keep && (m.timers.kite ?? 0) < 1.2) { m.timers.kite = (m.timers.kite ?? 0) + dt; moveAway(g, m, sp, dt); return; }
    if (dist >= keep) m.timers.kite = 0;
    if (dist <= t.range && canSee()) {
      m.moving = false; m.facing = Math.atan2(dy, dx);
      if (m.atkCd <= 0) { m.atkCd = 1 / m.atkRate; startAct(m, 'shoot', 0.6, 0.5, h.x + (g.hero.moving ? Math.cos(h.facing) * 0.6 : 0), h.y + (g.hero.moving ? Math.sin(h.facing) * 0.6 : 0)); }
      else if (dist < keep + 1 && m.timers.kite! >= 1.2 && dist <= reach) melee();
    } else moveToward(g, m, h.x, h.y, sp, dt);
  };

  switch (t.ai) {
    case 'melee': case 'swarm': melee(); break;
    case 'charger':
      if (m.timers.special <= 0 && dist > 2.5 && dist < 8 && walkLine(g.world, m.x, m.y, h.x, h.y, wallR(m))) {
        m.timers.special = t.special ?? 6;
        startAct(m, 'special', 1.2, 0, h.x, h.y, 'charge');
        g.emit({ t: 'sfx', id: 'roar', x: m.x, y: m.y });
      } else melee();
      break;
    case 'ghost':
      m.alpha = 0.55 + 0.35 * Math.sin(m.anim * 2.3);
      if (m.timers.special <= 0 && dist > 3 && dist < 10) { m.timers.special = t.special ?? 4; blinkNear(g, m, true); }
      else melee();
      break;
    case 'erratic': {
      if (dist <= reach) { melee(); break; }
      const jitter = Math.sin(m.anim * 3 + m.id) * 1.4;
      const px = -dy / (dist || 1), py = dx / (dist || 1);
      moveToward(g, m, h.x + px * jitter * Math.min(3, dist), h.y + py * jitter * Math.min(3, dist), sp, dt);
      break;
    }
    case 'ranged': ranged(3.2); break;
    case 'caster': {
      if (m.timers.special <= 0 && dist < t.range + 1 && canSee()) {
        m.timers.special = t.special ?? 5;
        if (m.tpl === 'witch' && dist < 4) { blinkNear(g, m, false); break; }
        if (m.tpl === 'skelMage') { startAct(m, 'cast', 0.8, 0.6, h.x, h.y, 'triple'); break; }
      }
      if (m.tpl === 'fireSpirit' && dist > 2.5) {
        if (dist <= t.range && canSee() && m.atkCd <= 0) { m.atkCd = 1 / m.atkRate; startAct(m, 'cast', 0.5, 0.4, h.x, h.y, 'bolt'); break; }
        const j = Math.sin(m.anim * 2.5 + m.id) * 2;
        moveToward(g, m, h.x - (dy / (dist || 1)) * j, h.y + (dx / (dist || 1)) * j, sp, dt);
        break;
      }
      if (dist <= t.range && canSee() && dist > 2.5) {
        m.moving = false; m.facing = Math.atan2(dy, dx);
        if (m.atkCd <= 0) { m.atkCd = 1 / m.atkRate; startAct(m, 'cast', 0.7, 0.55, h.x, h.y, 'bolt'); }
      } else ranged(3.5);
      break;
    }
    case 'summoner': {
      if (m.timers.special <= 0) {
        m.timers.special = t.special ?? 6;
        if (g.world.monsters.some((o) => o.dead && o.tpl === 'fallen' && o.deadT < 40 && o.deathStyle !== 'gib' && o.deathStyle !== 'shatter' && Math.hypot(o.x - m.x, o.y - m.y) < 8)) { startAct(m, 'cast', 0.9, 0.7, m.x, m.y, 'revive'); break; }
      }
      if (dist <= t.range && canSee() && dist > 3) {
        m.moving = false; m.facing = Math.atan2(dy, dx);
        if (m.atkCd <= 0) { m.atkCd = 1 / m.atkRate; startAct(m, 'cast', 0.7, 0.55, h.x, h.y, 'bolt'); }
      } else ranged(4);
      break;
    }
  }
}

/** Keeps monsters from overlapping each other and the hero. */
export function separate(g: Game): void {
  const ms = g.world.monsters;
  const h = g.hero;
  const act: Monster[] = [];
  for (const m of ms) if (!m.dead && (m.awake || m.moving) && Math.abs(m.x - h.x) < 24 && Math.abs(m.y - h.y) < 24) act.push(m);
  for (let i = 0; i < act.length; i++) {
    const a = act[i];
    for (let j = i + 1; j < act.length; j++) {
      const b = act[j];
      const rr = (a.r + b.r) * 0.85;
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
      const d = Math.hypot(dx, dy);
      if (d >= rr) continue;
      const push = (rr - d) * 0.5;
      const nx = d > 1e-4 ? dx / d : 1, ny = d > 1e-4 ? dy / d : 0;
      const bossA = a.rank === 'boss', bossB = b.rank === 'boss';
      moveCircle(g.world, a, wallR(a), -nx * push * (bossA ? 0.1 : bossB ? 1.9 : 1), -ny * push * (bossA ? 0.1 : bossB ? 1.9 : 1), !!MONSTERS[a.tpl].flying);
      moveCircle(g.world, b, wallR(b), nx * push * (bossB ? 0.1 : bossA ? 1.9 : 1), ny * push * (bossB ? 0.1 : bossA ? 1.9 : 1), !!MONSTERS[b.tpl].flying);
    }
    if (!h.dead) {
      const dx = a.x - h.x, dy = a.y - h.y, d = Math.hypot(dx, dy), rr = a.r + h.r;
      if (d < rr) {
        const nx = d > 1e-4 ? dx / d : 1, ny = d > 1e-4 ? dy / d : 0;
        if (!moveCircle(g.world, a, wallR(a), nx * (rr - d), ny * (rr - d), !!MONSTERS[a.tpl].flying)) {
          moveCircle(g.world, h, h.r, -nx * (rr - d), -ny * (rr - d));
        }
      }
    }
  }
}

export { nearestWalkable };
