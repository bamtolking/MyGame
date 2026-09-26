// Player offense: auto attacks, auto-cast talismans, ultimates, damage + kill credit.
import { DT } from '../shared/constants.ts';
import { CLASSES, SHAMAN_AOE, ATK } from '../shared/data/classes.ts';
import { TALS, TAL_IDX } from '../shared/data/talismans.ts';
import { WORLD_BOSS } from '../shared/data/monsters.ts';
import { segDist2 } from '../shared/math.ts';
import { moveCircle } from '../shared/movement.ts';
import { zoneAt } from '../shared/map.ts';
import type { World } from './world.ts';
import type { Player, Monster } from './entities.ts';
import type { Ev } from '../shared/protocol.ts';
import type { ClassId } from '../shared/types.ts';
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

/** Every monster within `w` (+ its radius) of the segment (x,y)→(x2,y2), with its distance from the start. */
function onLine(w: World, x: number, y: number, x2: number, y2: number, hw: number): [Monster, number][] {
  const out: [Monster, number][] = []; const L = Math.hypot(x2 - x, y2 - y);
  w.spatial.each((x + x2) / 2, (y + y2) / 2, L / 2 + hw, m => { if (segDist2(m.x, m.y, x, y, x2, y2) < (hw + m.r) ** 2) out.push([m, Math.hypot(m.x - x, m.y - y)]); });
  return out;
}
/** Pushes a monster `dist` units away from (fx,fy) in small steps (walls stop it; bosses don't budge; never into town). */
export function shove(w: World, m: Monster, fx: number, fy: number, dist: number): void {
  if (m.boss || m.dead) return;
  const a = Math.atan2(m.y - fy, m.x - fx); const r = Math.min(m.r, 15); const n = Math.ceil(dist / 12); const sx = Math.cos(a) * dist / n, sy = Math.sin(a) * dist / n;
  for (let i = 0; i < n; i++) {
    const [nx, ny] = moveCircle(w.map, m.x, m.y, sx, sy, r); if ((nx === m.x && ny === m.y) || zoneAt(w.map, nx, ny) === 0) break;
    m.x = nx; m.y = ny;
  }
}
/** Stuns a monster for `t` seconds: it stops moving and attacking, and a charge being wound up is cancelled (bosses are only slowed). */
export function stun(w: World, m: Monster, t: number): void {
  if (m.boss) { slow(m, t, 0.75); return; }
  m.stunT = Math.max(m.stunT, t); m.slowT = Math.max(m.slowT, t); // slowT only flags the tint; stunT does the freezing
  if (m.def.beh === 'charger' && (m.st === 'wind' || m.st === 'dash')) { m.st = 'recover'; m.stT = m.stunT; w.hazards = w.hazards.filter(h => h.src !== m.id); }
}
/** Slows a monster; a stronger slow wins, and a slow that outlasts the current one replaces it. */
function slow(m: Monster, t: number, mul: number): void {
  const k = m.boss ? Math.max(0.75, mul) : mul; if (k <= m.slowMul || t >= m.slowT) m.slowMul = k; m.slowT = Math.max(m.slowT, t);
}
/** A delayed hit still belongs to this fight: the player is still in the world, outside town, and still the class that started it. */
const still = (w: World, p: Player, c: ClassId) => w.players.get(p.id) === p && p.zone !== 0 && p.prof.cls === c;
/** Assassin bonus against weakened monsters. */
const execMul = (m: Monster) => (m.hp < m.maxHp * 0.3 ? 1.5 : 1);
const R = Math.round;

export function playerCombat(w: World, p: Player): void {
  const cls = CLASSES[p.prof.cls]; const S = p.stats;
  const inTown = p.zone === 0;
  if (p.lastAtkT > w.time - 2) p.ult = Math.min(100, p.ult + ULT_PER_SEC * DT);
  if (inTown) return;
  // ---- ultimate (active part) ----
  if (p.ultT > 0) {
    p.ultTick -= DT;
    if (p.ultTick <= 0) {
      if (p.prof.cls === 'sword') { p.ultTick = 0.25; w.spatial.each(p.x, p.y, 175, m => { hitMonster(w, p, m, 1.25); }); }
      else if (p.prof.cls === 'spear') {
        p.ultTick = 0.199; const t = w.spatial.nearest(p.x, p.y, 300); const a = t ? Math.atan2(t.y - p.y, t.x - p.x) : p.face; p.face = a; p.lastAtkT = w.time;
        const x2 = p.x + Math.cos(a) * ATK.ultThrustLen, y2 = p.y + Math.sin(a) * ATK.ultThrustLen;
        for (const [m] of onLine(w, p.x - Math.cos(a) * 12, p.y - Math.sin(a) * 12, x2, y2, ATK.ultThrustW)) hitMonster(w, p, m, 0.9);
        w.emit({ k: 'uhit', p: p.id, x: R(p.x), y: R(p.y), x2: R(x2), y2: R(y2) }, p.x, p.y);
      } else p.ultTick = 1;
    }
  }
  // ---- basic attack ----
  p.atkT -= DT;
  if (p.atkT <= 0) {
    const tgt = w.spatial.nearest(p.x, p.y, cls.range);
    if (tgt) { p.atkT = 1 / (S.aspd * w.aspdMul(p)); basicAttack(w, p, tgt); }
    else p.atkT = 0.1;
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

/** One basic attack at `tgt` (already in range); behaviour depends on the class's attack kind. */
function basicAttack(w: World, p: Player, tgt: Monster): void {
  const cls = CLASSES[p.prof.cls];
  const ang = Math.atan2(tgt.y - p.y, tgt.x - p.x); p.face = ang; p.lastAtkT = w.time;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const ev: Ev & { k: 'atk' } = { k: 'atk', p: p.id, tx: R(tgt.x), ty: R(tgt.y), tid: tgt.id };
  switch (cls.atkKind) {
    case 'cone': {
      const hits: Monster[] = []; w.spatial.each(p.x, p.y, cls.range, m => { if (inArc(p, m, ang, cls.range, 1.2)) hits.push(m); });
      for (const m of hits) hitMonster(w, p, m, 1);
      break;
    }
    case 'shot': {
      const d = Math.hypot(tgt.x - p.x, tgt.y - p.y); const id = tgt.id;
      w.after(d / 950, () => { const m = w.mons.get(id); if (m && !m.dead) hitMonster(w, p, m, 1); });
      break;
    }
    case 'blast': {
      const d = Math.hypot(tgt.x - p.x, tgt.y - p.y); const id = tgt.id; let tx = tgt.x, ty = tgt.y;
      w.after(d / 620, () => {
        const m = w.mons.get(id); if (m && !m.dead) { tx = m.x; ty = m.y; }
        const hits = w.spatial.list(tx, ty, SHAMAN_AOE); for (const h of hits) hitMonster(w, p, h, h.id === id ? 1 : 0.7);
      });
      break;
    }
    case 'thrust': {
      for (const [m] of onLine(w, p.x - ca * 10, p.y - sa * 10, p.x + ca * cls.range, p.y + sa * cls.range, ATK.thrustW)) hitMonster(w, p, m, 1);
      break;
    }
    case 'chain': {
      const hit: Monster[] = [tgt]; const pts: number[] = [];
      for (let k = 1; k < ATK.chainMul.length; k++) {
        const last = hit[hit.length - 1]; let next: Monster | null = null, bd = Infinity;
        w.spatial.each(last.x, last.y, ATK.chainR, (m, d2) => { if (!hit.includes(m) && d2 < bd) { bd = d2; next = m; } });
        if (!next) break; const n = next as Monster; hit.push(n); pts.push(R(n.x), R(n.y));
      }
      hit.forEach((m, k) => hitMonster(w, p, m, ATK.chainMul[k]));
      if (pts.length) ev.pts = pts;
      break;
    }
    case 'bash': {
      const hits: Monster[] = []; w.spatial.each(p.x, p.y, cls.range, m => { if (inArc(p, m, ang, cls.range, ATK.bashHalf)) hits.push(m); });
      for (const m of hits) { hitMonster(w, p, m, 1); shove(w, m, p.x, p.y, ATK.bashPush); }
      break;
    }
    case 'stab': {
      hitMonster(w, p, tgt, execMul(tgt));
      if (p.ultT > 0) { // shadow clones strike up to three more monsters nearby
        const extra = w.spatial.list(p.x, p.y, 160).filter(m => m !== tgt && !m.dead).slice(0, 3); const pts: number[] = [];
        for (const m of extra) { pts.push(R(m.x), R(m.y)); hitMonster(w, p, m, execMul(m)); }
        if (pts.length) ev.pts = pts;
      }
      break;
    }
    case 'musket': {
      // the bullet pierces everything on the line (×0.85) and bursts at the target (×0.4 around it); nobody is hit twice
      const x2 = p.x + ca * cls.range, y2 = p.y + sa * cls.range; const id = tgt.id; const td = Math.hypot(tgt.x - p.x, tgt.y - p.y);
      const near: number[] = [], far: number[] = [];
      for (const [m, d] of onLine(w, p.x, p.y, x2, y2, ATK.musketW)) if (m !== tgt) (d <= td ? near : far).push(m.id);
      const pierce = (ids: number[]) => { for (const mid of ids) { const mm = w.mons.get(mid); if (mm && !mm.dead) hitMonster(w, p, mm, 0.85); } };
      let bx = tgt.x, by = tgt.y;
      w.after(td / ATK.bulletSpeed, () => {
        pierce(near); const m = w.mons.get(id); if (m && !m.dead) { bx = m.x; by = m.y; hitMonster(w, p, m, 1); }
        w.spatial.each(bx, by, ATK.musketBurst, h => { if (h.id !== id && !near.includes(h.id) && !far.includes(h.id)) hitMonster(w, p, h, 0.4); });
      });
      if (far.length) w.after(cls.range / ATK.bulletSpeed, () => pierce(far));
      break;
    }
    case 'wave': {
      const hits: Monster[] = []; w.spatial.each(p.x, p.y, cls.range, m => { if (inArc(p, m, ang, cls.range, ATK.waveHalf)) hits.push(m); });
      for (const m of hits) hitMonster(w, p, m, 0.9);
      break;
    }
    case 'ink': {
      const d = Math.hypot(tgt.x - p.x, tgt.y - p.y); const id = tgt.id; let tx = tgt.x, ty = tgt.y;
      w.after(d / 700, () => {
        const m = w.mons.get(id); if (m && !m.dead) { tx = m.x; ty = m.y; }
        w.spatial.each(tx, ty, ATK.inkR, h => { hitMonster(w, p, h, 0.8); slow(h, 1.2, 0.6); });
        for (let k = 1; k <= ATK.inkTicks; k++) w.after(k * 0.5, () => { if (still(w, p, 'painter')) w.spatial.each(tx, ty, ATK.inkR, h => { hitMonster(w, p, h, ATK.inkTickMul); slow(h, 0.7, 0.6); }); });
      });
      break;
    }
  }
  w.emit(ev, p.x, p.y);
}

/** Ultimate activation (validated by caller: p.ult >= 100). */
export function useUlt(w: World, p: Player): boolean {
  if (p.down || p.ult < 100 || p.zone === 0) return false;
  p.ult = 0; p.lastAtkT = w.time;
  const c = p.prof.cls; const def = CLASSES[c];
  p.ultT = def.ultDur; p.ultTick = 0;
  const cast = (tx?: number, ty?: number) => w.emit(tx == null ? { k: 'ult', p: p.id, x: R(p.x), y: R(p.y) } : { k: 'ult', p: p.id, x: R(p.x), y: R(p.y), tx: R(tx), ty: R(ty!) }, p.x, p.y);
  /** Runs `fn` later only while the caster is still standing in this fight (see `still`). */
  const later = (t: number, fn: () => void) => w.after(t, () => { if (still(w, p, c) && !p.down) fn(); });
  switch (c) {
    case 'sword': case 'spear': case 'assassin': cast(); break;
    case 'archer': {
      const [bx, by] = densest(w, p, 470, 150, 150);
      cast(bx, by);
      for (let v = 0; v < 8; v++) w.after(0.3 + v * 0.25, () => { if (still(w, p, c)) w.spatial.each(bx, by, 160, m => { hitMonster(w, p, m, 1.15); }); }); // the rain falls even if the archer goes down
      break;
    }
    case 'shaman': {
      cast();
      w.after(0.35, () => {
        if (!still(w, p, c)) return;
        w.spatial.each(p.x, p.y, 330, m => { hitMonster(w, p, m, 5); });
        for (const q of w.playersNear(p.x, p.y, 330, true)) {
          if (q.down) w.revivePlayer(q, p, 0.5); else w.healPlayer(q, q.stats.maxHp * 0.4 * CLASSES.shaman.heal);
        }
      });
      break;
    }
    case 'taoist': {
      cast();
      for (let k = 0; k < 12; k++) later(0.15 + k * 0.2, () => {
        const cand = w.spatial.list(p.x, p.y, 420); let x: number, y: number;
        if (cand.length) { const t = cand[Math.floor(w.rng.next() * cand.length)]; x = t.x; y = t.y; }
        else { const a = w.rng.range(0, Math.PI * 2), r = w.rng.range(60, 220); x = p.x + Math.cos(a) * r; y = p.y + Math.sin(a) * r; }
        w.spatial.each(x, y, 70, m => { hitMonster(w, p, m, 1.6); stun(w, m, 0.8); });
        w.emit({ k: 'uhit', p: p.id, x: R(x), y: R(y) }, x, y);
      });
      break;
    }
    case 'guardian': {
      cast();
      const v = p.stats.maxHp * 0.35 * def.heal;
      for (const q of w.playersNear(p.x, p.y, 300)) { if (v > q.shield) q.shield = v; q.shieldT = Math.max(q.shieldT, 5); w.emit({ k: 'shield', p: q.id }, q.x, q.y); }
      for (const m of w.spatial.list(p.x, p.y, 220)) { hitMonster(w, p, m, 2); shove(w, m, p.x, p.y, 60); stun(w, m, 1.5); }
      break;
    }
    case 'gunner': {
      cast();
      for (let k = 0; k < 16; k++) later(k * 0.1, () => {
        const cand = w.spatial.list(p.x, p.y, 480); let x: number, y: number;
        if (cand.length) { const t = cand[Math.floor(w.rng.next() * cand.length)]; x = t.x + w.rng.range(-20, 20); y = t.y + w.rng.range(-20, 20); }
        else { const a = p.face + w.rng.range(-0.6, 0.6), r = w.rng.range(160, 380); x = p.x + Math.cos(a) * r; y = p.y + Math.sin(a) * r; }
        w.emit({ k: 'uhit', p: p.id, x: R(p.x), y: R(p.y), x2: R(x), y2: R(y) }, p.x, p.y);
        w.after(Math.hypot(x - p.x, y - p.y) / 900, () => { if (still(w, p, c)) w.spatial.each(x, y, 70, m => { hitMonster(w, p, m, 1.4); }); }); // a rocket in flight lands even if the gunner goes down
      });
      break;
    }
    case 'musician': {
      cast();
      for (const q of w.playersNear(p.x, p.y, 320)) { w.healPlayer(q, q.stats.maxHp * 0.25 * def.heal); q.buffT = 6; q.buffAspd = 0.35; }
      for (const t of [0.2, 1.7, 3.2, 4.7]) later(t, () => {
        w.spatial.each(p.x, p.y, 240, m => { hitMonster(w, p, m, 1.2); });
        w.emit({ k: 'uhit', p: p.id, x: R(p.x), y: R(p.y) }, p.x, p.y);
      });
      break;
    }
    case 'painter': {
      cast();
      for (const t of [0.3, 0.9, 1.5]) later(t, () => {
        const [tx, ty] = densest(w, p, 420, 120, 200); const a = Math.atan2(ty - p.y, tx - p.x);
        const x = p.x - Math.cos(a) * 60, y = p.y - Math.sin(a) * 60, x2 = p.x + Math.cos(a) * 360, y2 = p.y + Math.sin(a) * 360;
        for (const [m] of onLine(w, x, y, x2, y2, 46)) hitMonster(w, p, m, 3);
        w.emit({ k: 'uhit', p: p.id, x: R(x), y: R(y), x2: R(x2), y2: R(y2) }, p.x, p.y);
      });
      break;
    }
  }
  return true;
}
/** The monster (within r) with the most neighbours within `nr`; falls back to a point `fb` ahead of the player. */
function densest(w: World, p: Player, r: number, nr: number, fb: number): [number, number] {
  const cand = w.spatial.list(p.x, p.y, r);
  let bx = p.x + Math.cos(p.face) * fb, by = p.y + Math.sin(p.face) * fb, best = -1;
  for (let i = 0; i < Math.min(30, cand.length); i++) { const c = cand[i]; const n = w.spatial.count(c.x, c.y, nr); if (n > best) { best = n; bx = c.x; by = c.y; } }
  return [bx, by];
}
export { ULT_PER_KILL };
