// Monster behaviours (non-boss). Bosses live in bosses.ts.
import { DT, PLAYER_R } from '../shared/constants.ts';
import { moveCircle, circleHits } from '../shared/movement.ts';
import { zoneAt } from '../shared/map.ts';
import type { World } from './world.ts';
import type { Monster } from './entities.ts';
import { updateBoss } from './bosses.ts';

export function moveMon(w: World, m: Monster, vx: number, vy: number): void {
  const r = Math.min(m.r, 15);
  const [nx, ny] = moveCircle(w.map, m.x, m.y, vx * DT, vy * DT, r);
  if (zoneAt(w.map, nx, ny) === 0) return; // monsters never enter the town
  if (nx < m.x) m.left = true; else if (nx > m.x) m.left = false;
  m.x = nx; m.y = ny;
}

export function updateMonster(w: World, m: Monster): void {
  m.hitT = Math.max(0, m.hitT - DT); m.atkT -= DT; m.lifeT += DT;
  if (m.slowT > 0) { m.slowT -= DT; if (m.slowT <= 0) m.slowMul = 1; }
  if (m.boss) { updateBoss(w, m); return; }
  if (m.def.beh === 'runner') { runner(w, m); return; }
  // --- targeting ---
  let tgt = m.tgt ? w.players.get(m.tgt) : undefined;
  if (tgt && (tgt.down || tgt.zone === 0)) { tgt = undefined; m.tgt = 0; }
  m.retT -= DT;
  if (m.retT <= 0 && (m.st === 'chase' || m.st === 'idle')) {
    m.retT = 0.5 + (m.id % 5) * 0.05;
    const np = w.nearestPlayer(m.x, m.y, m.summon ? 900 : 460, p => p.zone !== 0);
    if (np) { m.tgt = np.id; tgt = np; if (m.st === 'idle') m.st = 'chase'; }
    else if (!tgt) { m.tgt = 0; m.st = 'idle'; }
    // far from everyone → despawn silently
    if (!np && m.lairIdx < 0) {
      let near = false; for (const p of w.players.values()) if ((p.x - m.x) ** 2 + (p.y - m.y) ** 2 < 1100 * 1100) { near = true; break; }
      if (!near) { m.farT += 0.5; if (m.farT > 6) m.dead = true; } else m.farT = 0;
      if (m.summon && !np) { m.farT += 0.5; if (m.farT > 10) m.dead = true; }
    }
  }
  const spd = m.def.speed * m.slowMul;
  switch (m.st) {
    case 'idle': {
      if (m.lifeT % 3 < DT) { m.dvx = w.rng.range(-1, 1); m.dvy = w.rng.range(-1, 1); }
      const back = (m.hx - m.x) ** 2 + (m.hy - m.y) ** 2 > 200 * 200;
      if (back) { const a = Math.atan2(m.hy - m.y, m.hx - m.x); moveMon(w, m, Math.cos(a) * spd * 0.4, Math.sin(a) * spd * 0.4); }
      else moveMon(w, m, m.dvx * spd * 0.25, m.dvy * spd * 0.25);
      return;
    }
    case 'wind': {
      m.stT -= DT;
      if (m.stT <= 0) {
        if (m.def.beh === 'charger') { m.st = 'dash'; m.stT = 0.28; }
        else { m.st = 'recover'; m.stT = 0.2; }
      }
      return;
    }
    case 'dash': {
      m.stT -= DT; const k = (m.def.range + 40) / 0.28;
      moveMon(w, m, m.dvx * k, m.dvy * k);
      if (m.stT <= 0) { m.st = 'recover'; m.stT = 0.55; m.atkT = 2.6 + w.rng.range(0, 1); }
      return;
    }
    case 'recover': { m.stT -= DT; if (m.stT <= 0) m.st = 'chase'; return; }
  }
  if (!tgt) { m.st = 'idle'; return; }
  // --- chase / engage ---
  const dx = tgt.x - m.x, dy = tgt.y - m.y; const d = Math.sqrt(dx * dx + dy * dy) || 1; const ux = dx / d, uy = dy / d;
  const beh = m.def.beh;
  if (beh === 'ranged') {
    const R = m.def.range;
    if (d < R * 0.55) moveMon(w, m, -ux * spd, -uy * spd);
    else if (d > R * 0.85) moveMon(w, m, ux * spd, uy * spd);
    else { const s = m.id % 2 ? 1 : -1; moveMon(w, m, -uy * spd * 0.45 * s, ux * spd * 0.45 * s); }
    if (m.atkT <= 0 && d < R + 40) {
      m.atkT = m.def.atkCd * (0.85 + w.rng.next() * 0.3); const a = Math.atan2(dy, dx);
      const style = m.def.key === 'crow' ? 1 : 2;
      if (m.def.key === 'foxmage') { const vid = w.nextVolley++; for (const o of [-0.28, 0, 0.28]) w.fireProj(m.x, m.y, a + o, m.def.projSpeed, m.dmg, style, 0, 9, R + 160, m.def.key, vid); }
      else w.fireProj(m.x, m.y, a, m.def.projSpeed, m.dmg, style, 0, 9, R + 160, m.def.key);
    }
    return;
  }
  if (beh === 'charger' && m.atkT <= 0 && d < m.def.range && d > 60) {
    m.st = 'wind'; m.stT = 0.75; m.dvx = ux; m.dvy = uy; m.left = ux < 0;
    const L = m.def.range + 40;
    w.hazard({ sh: 1, x: m.x, y: m.y, x2: m.x + ux * L, y2: m.y + uy * L, w: m.r * 2 + 14, r: 0, dmg: m.dmg * 1.6, pct: 0, src: m.id, delay: 0.75, style: 1 });
    w.emit({ k: 'mon', id: m.id, a: 'wind' }, m.x, m.y);
    return;
  }
  if (beh === 'exploder' && d < 58) {
    m.st = 'wind'; m.stT = 0.8;
    w.hazard({ sh: 0, x: m.x, y: m.y, r: m.def.range, x2: 0, y2: 0, w: 0, dmg: m.dmg, pct: 0, src: m.id, delay: 0.7, style: 2 });
    w.emit({ k: 'mon', id: m.id, a: 'wind' }, m.x, m.y);
    w.after(0.75, () => { if (!m.dead) { m.dead = true; w.emit({ k: 'die', id: m.id, t: m.t, x: Math.round(m.x), y: Math.round(m.y) }, m.x, m.y); } });
    return;
  }
  const reach = m.r + PLAYER_R + 4;
  if (d > reach - 2) moveMon(w, m, ux * spd, uy * spd);
  if (d < reach && m.atkT <= 0) { m.atkT = m.def.atkCd; w.hurtPlayer(tgt, m.dmg, 0, m.def.key); }
}

function runner(w: World, m: Monster): void {
  if (m.lifeT > 32) {
    m.dead = true; w.emit({ k: 'mon', id: m.id, a: 'blink', x: Math.round(m.x), y: Math.round(m.y) }, m.x, m.y);
    w.announce('황금 도깨비가 금화 자루를 들고 도망쳤습니다…', 'event'); return;
  }
  const np = w.nearestPlayer(m.x, m.y, 520);
  const spd = m.def.speed * m.slowMul;
  if (np) {
    let a = Math.atan2(m.y - np.y, m.x - np.x);
    for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
      const nx = m.x + Math.cos(a + off) * 30, ny = m.y + Math.sin(a + off) * 30;
      if (!circleHits(w.map, nx, ny, 14) && zoneAt(w.map, nx, ny) !== 0) { a = a + off; break; }
    }
    moveMon(w, m, Math.cos(a) * spd, Math.sin(a) * spd);
  } else {
    if (m.lifeT % 2 < DT) { m.dvx = w.rng.range(-1, 1); m.dvy = w.rng.range(-1, 1); }
    moveMon(w, m, m.dvx * spd * 0.4, m.dvy * spd * 0.4);
  }
}

/** Soft separation so hordes spread out instead of stacking on one pixel. */
export function separate(w: World): void {
  const sp = w.spatial;
  for (const m of sp.items) {
    if (m.dead || m.boss || m.st === 'dash') continue;
    let px = 0, py = 0;
    sp.each(m.x, m.y, m.r + 26, (o) => {
      if (o === m) return; const dx = m.x - o.x, dy = m.y - o.y; const min = m.r + o.r;
      const d2 = dx * dx + dy * dy; if (d2 >= min * min) return;
      const d = Math.sqrt(d2) || 0.01; const push = (min - d) * (o.boss ? 0.8 : 0.35);
      px += (dx / d) * push; py += (dy / d) * push;
    }, false);
    if (px === 0 && py === 0) continue;
    const l = Math.sqrt(px * px + py * py); if (l > 6) { px *= 6 / l; py *= 6 / l; }
    const nx = m.x + px, ny = m.y + py;
    if (!circleHits(w.map, nx, ny, Math.min(m.r, 15)) && zoneAt(w.map, nx, ny) !== 0) { m.x = nx; m.y = ny; }
  }
}
