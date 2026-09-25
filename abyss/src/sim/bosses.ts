// Scripted boss behaviour. Each boss has timers per ability and hp-threshold phases.
import { BOSS_LINES, MONSTERS } from '../data/monsters';
import { addArea, hurtHero } from './combat';
import { monDmg, moveToward, reachOf, shoot, startAct, wallR } from './ai';
import { circleFree, los, moveCircle } from './path';
import { makeMonster } from './spawn';
import type { Game } from './game';
import type { Monster } from './types';

function ready(m: Monster, key: string, cd: number, dt: number): boolean {
  if (m.timers[key] === undefined) m.timers[key] = cd * 0.5;
  m.timers[key] -= dt;
  if (m.timers[key] <= 0) { m.timers[key] = cd; return true; }
  return false;
}

function summonAround(g: Game, m: Monster, tpl: string, n: number, maxAlive: number): number {
  const alive = g.world.monsters.filter((o) => !o.dead && o.summoned && o.tpl === tpl).length;
  let made = 0;
  for (let i = 0; i < n && alive + made < maxAlive; i++) {
    for (let k = 0; k < 10; k++) {
      const a = g.rng.range(0, Math.PI * 2), r = g.rng.range(1.5, 3);
      const x = m.x + Math.cos(a) * r, y = m.y + Math.sin(a) * r;
      if (!circleFree(g.world, x, y, 0.35)) continue;
      const s = makeMonster(g.world, tpl, Math.max(1, m.lvl - 2), 'normal', [], x, y, g.rng);
      s.summoned = true; s.awake = true;
      g.emit({ t: 'fx', kind: 'resurrect', x, y });
      made++;
      break;
    }
  }
  if (made) g.emit({ t: 'sfx', id: 'resurrect', x: m.x, y: m.y });
  return made;
}

function meteorRain(g: Game, m: Monster, n: number, spread: number, mult: number): void {
  const h = g.hero;
  for (let i = 0; i < n; i++) {
    const x = h.x + (i === 0 ? 0 : g.rng.range(-spread, spread)), y = h.y + (i === 0 ? 0 : g.rng.range(-spread, spread));
    const d = monDmg(g, m, mult, 'fire');
    addArea(g, 'meteor', 'mon', x, y, 1.7, 0.01, d, { delay: 1.1 + i * 0.15, data: { burn: 0 } });
    addArea(g, 'telegraph', 'mon', x, y, 1.7, 1.1 + i * 0.15, d, { data: { fire: 1 } });
  }
  g.emit({ t: 'sfx', id: 'bossCast', x: m.x, y: m.y });
}

function keepRange(g: Game, m: Monster, dist: number, lo: number, hi: number, sp: number, dt: number): void {
  const h = g.hero;
  if (dist > hi || !los(g.world, m.x, m.y, h.x, h.y)) moveToward(g, m, h.x, h.y, sp, dt);
  else if (dist < lo) {
    const dx = m.x - h.x, dy = m.y - h.y, l = Math.hypot(dx, dy) || 1;
    m.moving = moveCircle(g.world, m, wallR(m), (dx / l) * sp * dt, (dy / l) * sp * dt);
    m.facing = Math.atan2(-dy, -dx);
  } else { m.moving = false; m.facing = Math.atan2(h.y - m.y, h.x - m.x); }
}

export function updateBoss(g: Game, m: Monster, dt: number, dist: number): void {
  const h = g.hero;
  const w = g.world;
  if (!w.bossTriggered) {
    w.bossTriggered = true;
    g.emit({ t: 'boss', id: m.id, name: m.name });
    g.emit({ t: 'msg', text: `${m.name}: ${BOSS_LINES[m.tpl]?.intro ?? ''}`, color: '#ff7050', big: true });
    g.emit({ t: 'sfx', id: 'bossRoar' });
  }
  if (h.dead) { m.moving = false; return; }
  const frac = m.hp / m.maxHp;
  const sp = m.speed * (m.chillT > 0 ? 0.6 : 1) * (m.phase > 0 && m.tpl === 'gromak' ? 1.35 : 1) * (m.phase > 1 && m.tpl === 'malegath' ? 1.2 : 1);
  const t = MONSTERS[m.tpl];

  // in-progress action
  if (m.act) {
    const a = m.act;
    a.t += dt;
    if (a.spec === 'charge') {
      if (a.t < 0.5) { m.facing = Math.atan2(h.y - m.y, h.x - m.x); return; }
      const sp2 = 10.5;
      const moved = moveCircle(w, m, wallR(m), Math.cos(m.facing) * sp2 * dt, Math.sin(m.facing) * sp2 * dt);
      m.moving = true;
      if (!a.done && Math.hypot(h.x - m.x, h.y - m.y) < m.r + h.r + 0.3) {
        a.done = true;
        hurtHero(g, monDmg(g, m, 1.8), m, 'melee');
        const l = Math.hypot(h.x - m.x, h.y - m.y) || 1;
        moveCircle(w, h, h.r, ((h.x - m.x) / l) * 1.6, ((h.y - m.y) / l) * 1.6);
        g.emit({ t: 'shake', v: 0.8 }); g.emit({ t: 'sfx', id: 'stomp' });
      }
      if (!moved || a.t >= a.dur) { m.act = null; m.moving = false; }
      return;
    }
    if (a.spec === 'breath') {
      m.facing = Math.atan2(h.y - m.y, h.x - m.x);
      m.timers.breathT = (m.timers.breathT ?? 0) - dt;
      if (a.t > 0.35 && m.timers.breathT <= 0) {
        m.timers.breathT = 0.08;
        const ang = m.facing + g.rng.range(-0.35, 0.35);
        shoot(g, m, 'firebolt', m.x + Math.cos(ang) * 5, m.y + Math.sin(ang) * 5, 8.5, 0.35);
      }
      if (a.t >= a.dur) m.act = null;
      return;
    }
    if (!a.done && a.t >= a.hitAt) {
      a.done = true;
      switch (a.spec) {
        case 'melee':
          if (Math.hypot(h.x - m.x, h.y - m.y) <= reachOf(g, m) + 0.6) hurtHero(g, monDmg(g, m), m, 'melee');
          g.emit({ t: 'sfx', id: 'bossSwing', x: m.x, y: m.y });
          break;
        case 'bone3': shoot(g, m, 'bone', h.x, h.y, 9, 1, 0.3, 3); break;
        case 'boneNova': {
          for (let i = 0; i < 14; i++) { const ang = (i / 14) * Math.PI * 2; shoot(g, m, 'bone', m.x + Math.cos(ang), m.y + Math.sin(ang), 7, 0.8); }
          break;
        }
        case 'summonSkel': summonAround(g, m, 'skeleton', 3, 8); break;
        case 'summonSpirit': summonAround(g, m, 'fireSpirit', 2, 6); break;
        case 'summonHound': summonAround(g, m, 'hound', 3, 6); break;
        case 'fireball': shoot(g, m, 'fireball', h.x, h.y, 9, 1, 0.25, m.phase > 0 ? 3 : 1); break;
        case 'firewave': addArea(g, 'firewave', 'mon', m.x, m.y, 10, 1.8, monDmg(g, m, 1.1, 'fire')); g.emit({ t: 'sfx', id: 'bossCast' }); break;
        case 'slam': addArea(g, 'stomp', 'mon', m.x, m.y, 3.4, 0.01, monDmg(g, m, 1.4), { delay: 0.01 }); break;
        case 'lightRing': addArea(g, 'lightningRing', 'mon', m.x, m.y, 10, 2.2, monDmg(g, m, 1.0, 'light')); g.emit({ t: 'sfx', id: 'thunder' }); break;
        case 'meteors': meteorRain(g, m, m.tpl === 'malegath' ? 7 : 5, 4, m.tpl === 'malegath' ? 1.2 : 1.4); break;
      }
    }
    if (a.t >= a.dur) m.act = null;
    return;
  }
  const reach = reachOf(g, m);
  const meleeSwing = () => {
    if (dist <= reach) {
      m.moving = false; m.facing = Math.atan2(h.y - m.y, h.x - m.x);
      if (m.atkCd <= 0) { m.atkCd = 1 / (m.atkRate * (m.phase > 0 && m.tpl === 'gromak' ? 1.3 : 1)); startAct(m, 'special', 0.75, 0.45, h.x, h.y, 'melee'); }
    } else moveToward(g, m, h.x, h.y, sp, dt);
  };

  switch (m.tpl) {
    case 'ordes': {
      if (frac < 0.5 && m.phase === 0) { m.phase = 1; g.emit({ t: 'msg', text: '오르데스가 망자의 힘을 끌어모읍니다!', color: '#c080ff' }); }
      if (dist < 2.2 && ready(m, 'blink', 5, dt)) {
        for (let k = 0; k < 20; k++) {
          const a = g.rng.range(0, Math.PI * 2), r = g.rng.range(5, 7);
          const x = m.x + Math.cos(a) * r, y = m.y + Math.sin(a) * r;
          if (circleFree(w, x, y, wallR(m)) && los(w, x, y, h.x, h.y)) { g.emit({ t: 'fx', kind: 'blink', x: m.x, y: m.y }); m.x = x; m.y = y; g.emit({ t: 'fx', kind: 'blink', x, y }); g.emit({ t: 'sfx', id: 'blink' }); break; }
        }
        return;
      }
      if (ready(m, 'summon', 9, dt)) { startAct(m, 'cast', 1.0, 0.7, m.x, m.y, 'summonSkel'); return; }
      if (m.phase > 0 && ready(m, 'nova', 7, dt)) { startAct(m, 'cast', 0.9, 0.6, h.x, h.y, 'boneNova'); return; }
      if (dist < 9 && los(w, m.x, m.y, h.x, h.y) && ready(m, 'bolt', m.phase ? 1.2 : 1.6, dt)) { startAct(m, 'cast', 0.6, 0.45, h.x, h.y, 'bone3'); return; }
      keepRange(g, m, dist, 4, 7, sp, dt);
      break;
    }
    case 'gromak': {
      if (frac < 0.5 && m.phase === 0) { m.phase = 1; g.emit({ t: 'msg', text: '그로막이 격노합니다!', color: '#ff5040', big: true }); g.emit({ t: 'sfx', id: 'bossRoar' }); }
      if (dist > 3 && dist < 10 && los(w, m.x, m.y, h.x, h.y) && ready(m, 'charge', m.phase ? 4.5 : 6.5, dt)) {
        startAct(m, 'special', 1.3, 0, h.x, h.y, 'charge');
        g.emit({ t: 'fx', kind: 'telegraphLine', x: m.x, y: m.y, x2: h.x, y2: h.y });
        g.emit({ t: 'sfx', id: 'bossRoar' });
        return;
      }
      if (m.phase > 0 && dist < 4 && ready(m, 'slam', 8, dt)) {
        startAct(m, 'special', 1.0, 0.7, h.x, h.y, 'slam');
        addArea(g, 'telegraph', 'mon', m.x, m.y, 3.4, 0.7, monDmg(g, m, 0), {});
        return;
      }
      meleeSwing();
      break;
    }
    case 'ignira': {
      if (frac < 0.5 && m.phase === 0) { m.phase = 1; g.emit({ t: 'msg', text: '이그니라의 불길이 거세집니다!', color: '#ff9040', big: true }); }
      if (ready(m, 'wave', m.phase ? 6 : 8, dt)) { startAct(m, 'cast', 0.9, 0.7, m.x, m.y, 'firewave'); return; }
      if (ready(m, 'spirits', 12, dt)) { startAct(m, 'cast', 0.9, 0.6, m.x, m.y, 'summonSpirit'); return; }
      if (m.phase > 0 && ready(m, 'meteor', 8, dt)) { startAct(m, 'cast', 0.8, 0.5, h.x, h.y, 'meteors'); return; }
      if (dist < 10 && los(w, m.x, m.y, h.x, h.y) && ready(m, 'fb', 1.5, dt)) { startAct(m, 'cast', 0.6, 0.45, h.x, h.y, 'fireball'); return; }
      if (dist <= reach) { meleeSwing(); break; }
      keepRange(g, m, dist, 3.5, 7.5, sp, dt);
      break;
    }
    case 'malegath': {
      if (frac < 0.66 && m.phase === 0) { m.phase = 1; g.emit({ t: 'msg', text: '말레가스: "무릎 꿇어라!"', color: '#ff4020', big: true }); g.emit({ t: 'sfx', id: 'bossRoar' }); }
      if (frac < 0.33 && m.phase === 1) { m.phase = 2; g.emit({ t: 'msg', text: '심연이 요동칩니다!', color: '#ff2010', big: true }); g.emit({ t: 'shake', v: 1 }); }
      if (dist < 7 && ready(m, 'breath', 6, dt)) { startAct(m, 'special', 1.4, 99, h.x, h.y, 'breath'); g.emit({ t: 'sfx', id: 'breath' }); return; }
      if (dist < 4 && ready(m, 'stomp', 9, dt)) { startAct(m, 'special', 0.9, 0.65, h.x, h.y, 'slam'); addArea(g, 'telegraph', 'mon', m.x, m.y, 3.4, 0.65, monDmg(g, m, 0), {}); return; }
      if (m.phase >= 1 && ready(m, 'ring', 8, dt)) { startAct(m, 'cast', 0.9, 0.6, m.x, m.y, 'lightRing'); return; }
      if (m.phase >= 1 && ready(m, 'hounds', 14, dt)) { startAct(m, 'cast', 0.9, 0.6, m.x, m.y, 'summonHound'); return; }
      if (m.phase >= 2 && ready(m, 'meteor', 7, dt)) { startAct(m, 'cast', 0.8, 0.5, h.x, h.y, 'meteors'); return; }
      meleeSwing();
      break;
    }
    default:
      meleeSwing();
  }
  void t;
}
