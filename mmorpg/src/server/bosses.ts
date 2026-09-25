// Field bosses + world boss attack patterns. Every dangerous attack is telegraphed (hazard) first.
import { DT, PLAYER_R } from '../shared/constants.ts';
import { MON_IDX, WORLD_BOSS } from '../shared/data/monsters.ts';
import type { World } from './world.ts';
import type { Monster, Player } from './entities.ts';
import { moveMon } from './ai.ts';

const PATTERNS: Record<string, string[]> = {
  chief: ['slam', 'coins', 'slam', 'summon', 'coins'],
  imugi: ['beam', 'sweep', 'spit', 'summon', 'beam', 'spit'],
  reaper: ['blink', 'souls', 'cross', 'summon', 'blink', 'souls'],
  gumiho: ['tails', 'fires', 'dash', 'summon', 'tails', 'fires'],
  bulgasari: ['slam', 'rain', 'charge', 'shards', 'summon', 'rain', 'slam', 'charge'],
};
const SUMMON: Record<string, number[]> = {
  chief: [MON_IDX.imp, MON_IDX.wisp], imugi: [MON_IDX.drowned, MON_IDX.toad], reaper: [MON_IDX.egg, MON_IDX.crow],
  gumiho: [MON_IDX.foxfire, MON_IDX.foxmage], bulgasari: [MON_IDX.imp, MON_IDX.drowned, MON_IDX.egg, MON_IDX.foxfire],
};

export function updateBoss(w: World, m: Monster): void {
  const b = m.boss!; const kind = m.def.boss!; const isWB = m.t === WORLD_BOSS;
  if (b.hideT > 0) { b.hideT -= DT; return; }
  const leash = isWB ? 1400 : 500;
  // target: nearest player close to the boss while the boss stays near its lair
  let tgt = m.tgt ? w.players.get(m.tgt) : undefined;
  if (tgt && (tgt.down || (tgt.x - m.hx) ** 2 + (tgt.y - m.hy) ** 2 > leash * leash)) { tgt = undefined; m.tgt = 0; }
  m.retT -= DT;
  if (m.retT <= 0) { m.retT = 0.6; const np = w.nearestPlayer(m.x, m.y, isWB ? 1000 : 420, p => (p.x - m.hx) ** 2 + (p.y - m.hy) ** 2 < leash * leash); if (np) { m.tgt = np.id; tgt = np; } }
  if (!tgt) {
    b.engagedT = 0; b.castT = 0;
    const dh = Math.hypot(m.hx - m.x, m.hy - m.y);
    if (dh > 20) { const a = Math.atan2(m.hy - m.y, m.hx - m.x); moveMon(w, m, Math.cos(a) * m.def.speed * 1.5, Math.sin(a) * m.def.speed * 1.5); }
    if (!isWB && m.hp < m.maxHp) { m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.05 * DT); if (m.hp >= m.maxHp) { m.contrib.clear(); b.enraged = false; } }
    return;
  }
  if (b.engagedT === 0) w.emit({ k: 'mon', id: m.id, a: 'roar' }, m.x, m.y);
  b.engagedT += DT;
  // dynamic scaling with the number of fighters nearby (field bosses)
  if (!isWB && w.tick % 10 === 0) {
    const n = w.playersNear(m.x, m.y, 900).length; const want = 1 + 0.5 * Math.max(0, n - 1);
    if (want > b.scale + 0.01) { const f = want / b.scale; m.maxHp = Math.round(m.maxHp * f); m.hp *= f; b.scale = want; }
  }
  if (!b.enraged && m.hp < m.maxHp * 0.35) { b.enraged = true; w.emit({ k: 'mon', id: m.id, a: 'roar' }, m.x, m.y); if (isWB) w.announce('불가사리가 분노했습니다! 쇠를 삼키며 날뛴다!', 'boss'); }
  // casting (standing still / dashing)
  if (b.castT > 0) {
    b.castT -= DT;
    if (b.dashT > 0) { b.dashT -= DT; moveMon(w, m, b.dvx, b.dvy); }
    return;
  }
  const dx = tgt.x - m.x, dy = tgt.y - m.y; const d = Math.hypot(dx, dy) || 1;
  const spd = m.def.speed * Math.max(0.6, m.slowMul) * (b.enraged ? 1.2 : 1);
  if (d > m.r + PLAYER_R + 10) moveMon(w, m, (dx / d) * spd, (dy / d) * spd);
  if (d < m.r + PLAYER_R + 12 && m.atkT <= 0) { m.atkT = m.def.atkCd * 1.5; if (isWB) w.hurtPlayer(tgt, 0, 0.06, m.def.key); else w.hurtPlayer(tgt, m.dmg * 0.6, 0, m.def.key); }
  b.patT -= DT;
  if (b.patT <= 0) {
    const seq = PATTERNS[kind]; const pat = seq[b.seq % seq.length]; b.seq++;
    b.patT = (b.enraged ? 2.3 : 3.3) + (isWB ? -0.3 : 0);
    doPattern(w, m, kind, pat, tgt);
  }
}

function doPattern(w: World, m: Monster, kind: string, pat: string, tgt: Player): void {
  const b = m.boss!; const isWB = m.t === WORLD_BOSS; const D = m.dmg;
  const pct = (v: number) => (isWB ? v : 0); const dm = (v: number) => (isWB ? 0 : D * v);
  const ang = Math.atan2(tgt.y - m.y, tgt.x - m.x);
  const fighters = w.playersNear(m.x, m.y, isWB ? 1000 : 700);
  switch (pat) {
    case 'slam': {
      const r = isWB ? 210 : 150; const delay = isWB ? 1.5 : 1.1; b.castT = delay + 0.1;
      w.hazard({ sh: 0, x: m.x, y: m.y, r, x2: 0, y2: 0, w: 0, dmg: dm(1.9), pct: pct(0.25), src: m.id, delay, style: 0 });
      w.emit({ k: 'mon', id: m.id, a: 'wind' }, m.x, m.y); break;
    }
    case 'coins': case 'souls': case 'shards': {
      const n = pat === 'coins' ? 14 : pat === 'souls' ? 18 : 24; const style = pat === 'coins' ? 3 : pat === 'souls' ? 4 : 5;
      b.castT = 0.6; w.emit({ k: 'mon', id: m.id, a: 'wind' }, m.x, m.y);
      for (let wave = 0; wave < 2; wave++) w.after(0.5 + wave * 0.45, () => {
        if (m.dead) return; const off = wave * Math.PI / n; const vid = w.nextVolley++;
        for (let i = 0; i < n; i++) w.fireProj(m.x, m.y, off + (i / n) * Math.PI * 2, isWB ? 210 : 190, dm(0.9), style, pct(0.1), 10, 650, m.def.key, vid);
      });
      break;
    }
    case 'summon': {
      if (b.summons > 14) { doPattern(w, m, kind, kind === 'bulgasari' ? 'rain' : 'slam', tgt); return; }
      const types = SUMMON[kind]; const n = isWB ? 8 : 5;
      const lv = isWB ? Math.max(1, Math.round(avgLevel(fighters))) : m.lv;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2; const x = m.x + Math.cos(a) * (m.r + 50), y = m.y + Math.sin(a) * (m.r + 50);
        const s = w.spawnMonster(types[i % types.length], x, y, lv, { summon: true });
        if (s) { s.st = 'chase'; s.tgt = tgt.id; b.summons++; const bb = b; w.after(40, () => { bb.summons = Math.max(0, bb.summons - 1); }); }
      }
      w.emit({ k: 'mon', id: m.id, a: 'summon' }, m.x, m.y); break;
    }
    case 'beam': {
      const L = 580; b.castT = 1.3;
      w.hazard({ sh: 1, x: m.x, y: m.y, x2: m.x + Math.cos(ang) * L, y2: m.y + Math.sin(ang) * L, w: 74, r: 0, dmg: dm(2.2), pct: 0, src: m.id, delay: 1.2, style: 3 });
      w.emit({ k: 'mon', id: m.id, a: 'wind', tx: Math.round(tgt.x), ty: Math.round(tgt.y) }, m.x, m.y); break;
    }
    case 'sweep': {
      b.castT = 1.0; w.hazard({ sh: 0, x: m.x, y: m.y, r: 185, x2: 0, y2: 0, w: 0, dmg: dm(1.7), pct: 0, src: m.id, delay: 0.95, style: 3 }); break;
    }
    case 'spit': case 'tails': {
      const n = pat === 'spit' ? 5 : 9; const spread = pat === 'spit' ? 0.7 : 1.4; const style = pat === 'spit' ? 6 : 2; b.castT = 0.9;
      for (let v = 0; v < 3; v++) w.after(0.25 + v * 0.35, () => {
        if (m.dead) return; const t2 = w.players.get(tgt.id); const a0 = t2 ? Math.atan2(t2.y - m.y, t2.x - m.x) : ang; const vid = w.nextVolley++;
        for (let i = 0; i < n; i++) w.fireProj(m.x, m.y, a0 - spread / 2 + (spread * i) / (n - 1), 240, D * 0.8, style, 0, 10, 640, m.def.key, vid);
      });
      break;
    }
    case 'blink': {
      b.hideT = 0.55; w.emit({ k: 'mon', id: m.id, a: 'blink', x: Math.round(m.x), y: Math.round(m.y) }, m.x, m.y);
      const a = w.rng.range(0, Math.PI * 2); const nx = tgt.x + Math.cos(a) * 110, ny = tgt.y + Math.sin(a) * 110;
      w.after(0.5, () => {
        if (m.dead) return; const [sx, sy] = w.safeSpot(nx, ny); m.x = sx; m.y = sy; b.castT = 0.9;
        w.hazard({ sh: 0, x: m.x, y: m.y, r: 140, x2: 0, y2: 0, w: 0, dmg: D * 1.8, pct: 0, src: m.id, delay: 0.85, style: 4 });
      });
      break;
    }
    case 'cross': {
      b.castT = 1.3; const L = 330;
      for (const a of [Math.PI / 4, -Math.PI / 4]) w.hazard({ sh: 1, x: tgt.x - Math.cos(a) * L, y: tgt.y - Math.sin(a) * L, x2: tgt.x + Math.cos(a) * L, y2: tgt.y + Math.sin(a) * L, w: 62, r: 0, dmg: D * 2, pct: 0, src: m.id, delay: 1.25, style: 4 });
      break;
    }
    case 'fires': case 'rain': {
      b.castT = 0.8; const r = isWB ? 90 : 85; const reps = isWB ? 2 : 1;
      for (let rep = 0; rep < reps; rep++) w.after(rep * 1.3, () => {
        if (m.dead) return;
        for (const p of w.playersNear(m.x, m.y, isWB ? 1000 : 700)) {
          const k = isWB ? 1 : 2;
          for (let i = 0; i < k; i++) { const ox = i === 0 ? 0 : w.rng.range(-120, 120), oy = i === 0 ? 0 : w.rng.range(-120, 120); w.hazard({ sh: 0, x: p.x + ox, y: p.y + oy, r, x2: 0, y2: 0, w: 0, dmg: dm(1.6), pct: pct(0.18), src: m.id, delay: 1.2, style: isWB ? 5 : 2 }); }
        }
      });
      break;
    }
    case 'dash': case 'charge': {
      let t2 = tgt;
      if (pat === 'charge') { let far = -1; for (const p of fighters) { const dd = (p.x - m.x) ** 2 + (p.y - m.y) ** 2; if (dd > far) { far = dd; t2 = p; } } }
      const a = Math.atan2(t2.y - m.y, t2.x - m.x); const L = pat === 'charge' ? 700 : 440; const W = pat === 'charge' ? 120 : 84;
      const x2 = m.x + Math.cos(a) * L, y2 = m.y + Math.sin(a) * L;
      w.hazard({ sh: 1, x: m.x, y: m.y, x2, y2, w: W, r: 0, dmg: dm(2.1), pct: pct(0.35), src: m.id, delay: 1.2, style: isWB ? 5 : 2 });
      b.castT = 1.2 + 0.45; b.dashT = 0; w.emit({ k: 'mon', id: m.id, a: 'wind', tx: Math.round(x2), ty: Math.round(y2) }, m.x, m.y);
      w.after(1.2, () => { if (m.dead) return; b.dashT = 0.45; b.dvx = Math.cos(a) * (L * 0.9) / 0.45; b.dvy = Math.sin(a) * (L * 0.9) / 0.45; w.emit({ k: 'mon', id: m.id, a: 'dash' }, m.x, m.y); });
      break;
    }
  }
}
function avgLevel(ps: Player[]): number { if (!ps.length) return 1; let s = 0; for (const p of ps) s += p.prof.level; return s / ps.length; }
