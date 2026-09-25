// Player offense: auto attacks, auto-cast talismans, ultimates, damage + kill credit.
import { DT } from '../shared/constants.ts';
import { CLASSES, SHAMAN_AOE } from '../shared/data/classes.ts';
import { TALS, TAL_IDX } from '../shared/data/talismans.ts';
import { WORLD_BOSS } from '../shared/data/monsters.ts';
import { segDist2 } from '../shared/math.ts';
import type { World } from './world.ts';
import type { Player, Monster } from './entities.ts';
import { onMonsterKilled } from './progress.ts';

const ULT_PER_KILL = 1.0, ULT_PER_SEC = 1.0;

export function hitMonster(w: World, p: Player, m: Monster, mult: number): number {
  if (m.dead || m.hp <= 0) return 0;
  if (m.boss && m.boss.hideT > 0) return 0;
  let dmg = p.stats.atk * mult * (0.92 + w.rng.next() * 0.16); let crit = false;
  if (w.rng.next() < p.stats.crit) { dmg *= p.stats.critDmg; crit = true; }
  dmg = Math.max(1, Math.round(dmg));
  m.hp -= dmg; m.hitT = 0.12; p.lastAtkT = w.time;
  m.contrib.set(p.id, (m.contrib.get(p.id) ?? 0) + dmg);
  if (m.t === WORLD_BOSS) p.wbDmg += dmg;
  if (!m.tgt && !m.boss) { m.tgt = p.id; if (m.st === 'idle') m.st = 'chase'; }
  if (!p.bot) { const a = p.dmgAcc.get(m.id); if (a) { a[0] += dmg; a[1] = a[1] || (crit ? 1 : 0); } else p.dmgAcc.set(m.id, [dmg, crit ? 1 : 0]); }
  if (p.stats.leech > 0) w.healPlayer(p, dmg * p.stats.leech, false);
  if (m.boss) p.ult = Math.min(100, p.ult + (dmg / m.maxHp) * 60);
  if (m.hp <= 0) { m.hp = 0; m.dead = true; onMonsterKilled(w, m, p); }
  return dmg;
}

function inArc(p: Player, m: Monster, ang: number, range: number, half: number): boolean {
  const dx = m.x - p.x, dy = m.y - p.y; const d = Math.hypot(dx, dy); if (d > range + m.r) return false;
  if (d < m.r + 10) return true;
  let da = Math.atan2(dy, dx) - ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
  return Math.abs(da) <= half;
}

export function playerCombat(w: World, p: Player): void {
  const cls = CLASSES[p.prof.cls]; const S = p.stats;
  const inTown = p.zone === 0;
  if (p.lastAtkT > w.time - 2) p.ult = Math.min(100, p.ult + ULT_PER_SEC * DT);
  if (inTown) return;
  // ---- ultimate (active part) ----
  if (p.ultT > 0 && p.prof.cls === 'sword') {
    p.ultTick -= DT;
    if (p.ultTick <= 0) { p.ultTick = 0.25; w.spatial.each(p.x, p.y, 175, m => { hitMonster(w, p, m, 1.25); }); }
  }
  // ---- basic attack ----
  p.atkT -= DT;
  if (p.atkT <= 0) {
    const tgt = w.spatial.nearest(p.x, p.y, cls.range);
    if (tgt) {
      p.atkT = 1 / S.aspd; const ang = Math.atan2(tgt.y - p.y, tgt.x - p.x); p.face = ang; p.lastAtkT = w.time;
      w.emit({ k: 'atk', p: p.id, tx: Math.round(tgt.x), ty: Math.round(tgt.y), tid: tgt.id }, p.x, p.y);
      if (p.prof.cls === 'sword') {
        const hits: Monster[] = []; w.spatial.each(p.x, p.y, cls.range, m => { if (inArc(p, m, ang, cls.range, 1.2)) hits.push(m); });
        for (const m of hits) hitMonster(w, p, m, 1);
      } else if (p.prof.cls === 'archer') {
        const d = Math.hypot(tgt.x - p.x, tgt.y - p.y); const id = tgt.id;
        w.after(d / 950, () => { const m = w.mons.get(id); if (m && !m.dead) hitMonster(w, p, m, 1); });
      } else {
        const d = Math.hypot(tgt.x - p.x, tgt.y - p.y); const id = tgt.id; let tx = tgt.x, ty = tgt.y;
        w.after(d / 620, () => {
          const m = w.mons.get(id); if (m && !m.dead) { tx = m.x; ty = m.y; }
          const hits = w.spatial.list(tx, ty, SHAMAN_AOE); for (const h of hits) hitMonster(w, p, h, h.id === id ? 1 : 0.7);
        });
      }
    } else p.atkT = 0.1;
  }
  // ---- talismans ----
  const slots = w.talSlotsOf(p);
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]; if (!s) continue;
    const def = TALS[s.kind]; const L = s.lv - 1; p.cds[i] -= DT;
    switch (s.kind) {
      case 'blades': {
        const n = def.count[L], R = def.radius[L]; const cd = def.extra[L];
        const base = w.time * 3.4;
        w.spatial.each(p.x, p.y, R + 20, m => {
          const until = p.bladeHits.get(m.id) ?? 0; if (until > w.time) return;
          for (let k = 0; k < n; k++) {
            const a = base + (k / n) * Math.PI * 2; const bx = p.x + Math.cos(a) * R, by = p.y + Math.sin(a) * R;
            const rr = m.r + 16; if ((m.x - bx) ** 2 + (m.y - by) ** 2 < rr * rr) { p.bladeHits.set(m.id, w.time + cd); hitMonster(w, p, m, def.dmg[L]); break; }
          }
        });
        if (w.tick % 100 === 0) for (const [id, t] of p.bladeHits) if (t < w.time) p.bladeHits.delete(id);
        break;
      }
      case 'aura': {
        if (p.cds[i] > 0) break; p.cds[i] = def.cd[L];
        const R = def.radius[L]; w.spatial.each(p.x, p.y, R, m => { hitMonster(w, p, m, def.dmg[L]); }); // drawn continuously client-side
        break;
      }
      case 'wisp': {
        if (p.cds[i] > 0) break;
        const cand = w.spatial.list(p.x, p.y, def.extra[L]); if (!cand.length) { p.cds[i] = 0.2; break; }
        p.cds[i] = def.cd[L] * (1 - S.cdr);
        cand.sort((a, b) => ((a.x - p.x) ** 2 + (a.y - p.y) ** 2) - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2));
        const pool = cand.slice(0, 8); const ids: number[] = [];
        for (let k = 0; k < def.count[L]; k++) {
          const t = pool[Math.floor(w.rng.next() * pool.length)]; ids.push(t.id); const id = t.id; let tx = t.x, ty = t.y;
          const d = Math.hypot(t.x - p.x, t.y - p.y);
          w.after(0.12 + d / 430, () => {
            const m = w.mons.get(id); if (m && !m.dead) { tx = m.x; ty = m.y; }
            w.spatial.each(tx, ty, def.radius[L], h => { hitMonster(w, p, h, def.dmg[L]); });
          });
        }
        w.emit({ k: 'tal', p: p.id, tk: TAL_IDX.wisp, x: Math.round(p.x), y: Math.round(p.y), pts: ids, r: def.radius[L] }, p.x, p.y);
        break;
      }
      case 'thunder': {
        if (p.cds[i] > 0) break;
        const cand = w.spatial.list(p.x, p.y, def.radius[L]); if (!cand.length) { p.cds[i] = 0.2; break; }
        p.cds[i] = def.cd[L] * (1 - S.cdr);
        const pts: number[] = [];
        for (let k = 0; k < def.count[L] && cand.length; k++) {
          const t = cand.splice(Math.floor(w.rng.next() * cand.length), 1)[0];
          pts.push(Math.round(t.x), Math.round(t.y)); const tx = t.x, ty = t.y;
          hitMonster(w, p, t, def.dmg[L]);
          let chain: Monster | null = null, cd2 = def.extra[L] ** 2;
          w.spatial.each(tx, ty, def.extra[L], m => { if (m === t || m.dead) return; const dd = (m.x - tx) ** 2 + (m.y - ty) ** 2; if (dd < cd2) { cd2 = dd; chain = m; } });
          if (chain) { const c = chain as Monster; pts.push(Math.round(c.x), Math.round(c.y)); hitMonster(w, p, c, def.dmg[L] * 0.5); } else pts.push(-1, -1);
        }
        w.emit({ k: 'tal', p: p.id, tk: TAL_IDX.thunder, x: Math.round(p.x), y: Math.round(p.y), pts }, p.x, p.y);
        break;
      }
      case 'frost': {
        if (p.cds[i] > 0) break; const R = def.radius[L];
        if (!w.spatial.nearest(p.x, p.y, R)) { p.cds[i] = 0.2; break; }
        p.cds[i] = def.cd[L] * (1 - S.cdr);
        w.spatial.each(p.x, p.y, R, m => { m.slowT = def.extra[L]; m.slowMul = m.boss ? 0.75 : 0.5; hitMonster(w, p, m, def.dmg[L]); });
        w.emit({ k: 'tal', p: p.id, tk: TAL_IDX.frost, x: Math.round(p.x), y: Math.round(p.y), r: R }, p.x, p.y);
        break;
      }
      case 'pierce': {
        if (p.cds[i] > 0) break; const range = def.extra[L];
        const t = w.spatial.nearest(p.x, p.y, range); if (!t) { p.cds[i] = 0.2; break; }
        p.cds[i] = def.cd[L] * (1 - S.cdr);
        const a0 = Math.atan2(t.y - p.y, t.x - p.x); const n = def.count[L]; const W = def.radius[L];
        for (let k = 0; k < n; k++) {
          const a = a0 + (k - (n - 1) / 2) * 0.16; const x2 = p.x + Math.cos(a) * range, y2 = p.y + Math.sin(a) * range; const sx = p.x, sy = p.y;
          const hits: [Monster, number][] = [];
          w.spatial.each((sx + x2) / 2, (sy + y2) / 2, range / 2 + 30, m => { const d2 = segDist2(m.x, m.y, sx, sy, x2, y2); if (d2 < (W + m.r) ** 2) hits.push([m, Math.hypot(m.x - sx, m.y - sy)]); });
          for (const [m, d] of hits) { const id = m.id; w.after(d / 1100, () => { const mm = w.mons.get(id); if (mm && !mm.dead) hitMonster(w, p, mm, def.dmg[L]); }); }
          w.emit({ k: 'tal', p: p.id, tk: TAL_IDX.pierce, x: Math.round(sx), y: Math.round(sy), tx: Math.round(x2), ty: Math.round(y2) }, p.x, p.y);
        }
        break;
      }
      case 'bell': {
        if (p.cds[i] > 0) break; const R = def.radius[L];
        const allies = w.playersNear(p.x, p.y, R).filter(q => q.hp < q.stats.maxHp * 0.97);
        if (!allies.length) { p.cds[i] = 0.3; break; }
        p.cds[i] = def.cd[L] * (1 - S.cdr);
        for (const q of allies) w.healPlayer(q, q.stats.maxHp * def.dmg[L] * cls.heal);
        w.emit({ k: 'tal', p: p.id, tk: TAL_IDX.bell, x: Math.round(p.x), y: Math.round(p.y), r: R }, p.x, p.y);
        break;
      }
      case 'guard': {
        if (p.cds[i] > 0) break; const R = def.radius[L];
        if (!w.spatial.nearest(p.x, p.y, 320) && w.time - p.lastHurtT > 2) { p.cds[i] = 0.3; break; }
        p.cds[i] = def.cd[L] * (1 - S.cdr);
        for (const q of w.playersNear(p.x, p.y, R)) { const v = q.stats.maxHp * def.dmg[L] * cls.heal; if (v > q.shield) q.shield = v; q.shieldT = def.extra[L]; w.emit({ k: 'shield', p: q.id }, q.x, q.y); }
        w.emit({ k: 'tal', p: p.id, tk: TAL_IDX.guard, x: Math.round(p.x), y: Math.round(p.y), r: R }, p.x, p.y);
        break;
      }
    }
  }
}

/** Ultimate activation (validated by caller: p.ult >= 100). */
export function useUlt(w: World, p: Player): boolean {
  if (p.down || p.ult < 100 || p.zone === 0) return false;
  p.ult = 0; p.lastAtkT = w.time;
  if (p.prof.cls === 'sword') {
    p.ultT = 4; p.ultTick = 0;
    w.emit({ k: 'ult', p: p.id, x: Math.round(p.x), y: Math.round(p.y) }, p.x, p.y);
  } else if (p.prof.cls === 'archer') {
    const cand = w.spatial.list(p.x, p.y, 470);
    let bx = p.x + Math.cos(p.face) * 150, by = p.y + Math.sin(p.face) * 150, best = -1;
    for (let i = 0; i < Math.min(30, cand.length); i++) { const c = cand[i]; const n = w.spatial.count(c.x, c.y, 150); if (n > best) { best = n; bx = c.x; by = c.y; } }
    w.emit({ k: 'ult', p: p.id, x: Math.round(p.x), y: Math.round(p.y), tx: Math.round(bx), ty: Math.round(by) }, p.x, p.y);
    for (let v = 0; v < 8; v++) w.after(0.3 + v * 0.25, () => { w.spatial.each(bx, by, 160, m => { hitMonster(w, p, m, 1.15); }); });
  } else {
    w.emit({ k: 'ult', p: p.id, x: Math.round(p.x), y: Math.round(p.y) }, p.x, p.y);
    w.after(0.35, () => {
      w.spatial.each(p.x, p.y, 330, m => { hitMonster(w, p, m, 5); });
      for (const q of w.playersNear(p.x, p.y, 330, true)) {
        if (q.down) w.revivePlayer(q, p, 0.5); else w.healPlayer(q, q.stats.maxHp * 0.4 * CLASSES.shaman.heal);
      }
    });
  }
  return true;
}
export { ULT_PER_KILL };
