// Fights, subduing, riots.
import type { GameState, Prisoner, Staff, Fight } from './types';
import { SECURITY_INFO, REP_RIOT } from '../data/economy';
import { STAFF_BY_ID } from '../data/staff';
import { passable } from './grid';
import { killPrisoner, subdue, releaseObj, setPState } from './prisoner';
import { log, releaseStaffObj } from './build';
import type { Rng } from './rng';

const HIT_INTERVAL = 0.5;

function fightNear(s: GameState, x: number, y: number): Fight | null { for (const f of s.fights) if ((f.x - x) ** 2 + (f.y - y) ** 2 < 9) return f; return null; }
function joinP(s: GameState, f: Fight, p: Prisoner): void {
  if (p.fightId === f.id) return;
  leaveFight(s, p); releaseObj(s, p);
  f.prisoners.push(p.id); p.fightId = f.id; setPState(s, p, 'fight', 'none'); p.path = null; p.target = null;
}
function joinG(s: GameState, f: Fight, st: Staff): void {
  if (st.fightId === f.id) return;
  leaveFightStaff(s, st); releaseStaffObj(s, st);
  if (st.jobId >= 0) { const j = s.jobs.find(j => j.id === st.jobId); if (j) j.workerId = -1; st.jobId = -1; }
  f.guards.push(st.id); st.fightId = f.id; st.chaseId = -1; st.state = 'fight'; st.stateT = 0; st.path = null;
}
/** Prisoner `a` attacks prisoner `b` or staff `st`. */
export function startFight(s: GameState, a: Prisoner, b: Prisoner | null, st: Staff | null): void {
  if (st && st.type !== 'guard') { st.hp -= 25; log(s, `👊 ${a.name}이(가) ${STAFF_BY_ID[st.type].name} ${st.name}을(를) 폭행`, 'warn', a.x, a.y); if (st.hp <= 0) injureStaff(s, st); a.anger = Math.max(0, a.anger - 20); return; }
  let f = fightNear(s, a.x, a.y);
  if (!f) { f = { id: s.nextId++, x: a.x, y: a.y, prisoners: [], guards: [], t: 0, riot: s.riot, lastHit: 0 }; s.fights.push(f); s.stats.fights++; log(s, `👊 ${a.name}이(가) ${b ? b.name : '교도관 ' + st!.name}에게 싸움을 걺`, 'warn', a.x, a.y); s.events.push({ type: 'fight', x: a.x, y: a.y }); }
  joinP(s, f, a); if (b) joinP(s, f, b); if (st) joinG(s, f, st);
}
export function leaveFight(s: GameState, p: Prisoner): void {
  if (p.fightId < 0) return;
  const f = s.fights.find(f => f.id === p.fightId); p.fightId = -1;
  if (!f) return; const i = f.prisoners.indexOf(p.id); if (i >= 0) f.prisoners.splice(i, 1);
}
export function leaveFightStaff(s: GameState, st: Staff): void {
  if (st.fightId < 0) return;
  const f = s.fights.find(f => f.id === st.fightId); st.fightId = -1;
  if (!f) return; const i = f.guards.indexOf(st.id); if (i >= 0) f.guards.splice(i, 1);
}
export function injureStaff(s: GameState, st: Staff): void {
  leaveFightStaff(s, st); releaseStaffObj(s, st);
  if (st.jobId >= 0) { const j = s.jobs.find(j => j.id === st.jobId); if (j) j.workerId = -1; st.jobId = -1; }
  st.state = 'injured'; st.stateT = 0; st.path = null; st.chaseId = -1; st.hp = Math.max(1, st.hp);
  log(s, `🤕 ${STAFF_BY_ID[st.type].name} ${st.name} 부상으로 쓰러짐`, 'bad', st.x, st.y);
}
function stepToward(s: GameState, e: { x: number; y: number }, tx: number, ty: number, d: number, mover: 'prisoner' | 'staff'): void {
  const dx = tx - e.x, dy = ty - e.y; const len = Math.hypot(dx, dy) || 1;
  const nx = e.x + dx / len * d, ny = e.y + dy / len * d;
  if (passable(s, Math.floor(nx), Math.floor(ny), mover)) { e.x = nx; e.y = ny; return; }
  if (passable(s, Math.floor(nx), Math.floor(e.y), mover)) { e.x = nx; return; }
  if (passable(s, Math.floor(e.x), Math.floor(ny), mover)) { e.y = ny; }
}

export function updateFights(s: GameState, rng: Rng, dt: number): void {
  for (const f of [...s.fights]) {
    f.t += dt;
    // recompute centre
    let sx = 0, sy = 0, n = 0;
    for (const id of f.prisoners) { const p = s.cache.prisonerIndex.get(id); if (p) { sx += p.x; sy += p.y; n++; } }
    if (n) { f.x = sx / n; f.y = sy / n; }
    if (f.prisoners.length === 0 || (f.prisoners.length === 1 && f.guards.length === 0 && f.t > 2)) { endFight(s, f); continue; }
    if (f.t - f.lastHit < HIT_INTERVAL) continue;
    f.lastHit = f.t;
    const ps = f.prisoners.map(id => s.cache.prisonerIndex.get(id)!).filter(Boolean);
    const gs = f.guards.map(id => s.cache.staffIndex.get(id)!).filter(Boolean);
    // prisoners act
    for (const p of ps) {
      if (p.hp <= 0) continue;
      let target: Prisoner | Staff | null = null;
      const nearGuards = gs.filter(g => g.state === 'fight' && Math.hypot(g.x - p.x, g.y - p.y) < 2.5);
      if (nearGuards.length && (p.sec === 'max' || p.rioter || rng.chance(0.35))) target = rng.pick(nearGuards);
      else { const others = ps.filter(q => q !== p && q.hp > 0); if (others.length) target = others[rng.int(others.length)]; else if (nearGuards.length) target = nearGuards[0]; }
      if (!target) { // no one left to fight
        if (gs.length) continue; leaveFight(s, p); setPState(s, p, 'idle'); p.thinkT = 0; p.anger = Math.max(0, p.anger - 25); continue;
      }
      const d = Math.hypot(target.x - p.x, target.y - p.y);
      if (d > 1.4) { stepToward(s, p, target.x, target.y, Math.min(d - 0.9, 1.2), 'prisoner'); continue; }
      const dmg = SECURITY_INFO[p.sec].attack * rng.range(0.7, 1.3);
      if ('sec' in target) {
        const q = target as Prisoner; q.hp -= dmg;
        if (q.hp <= 0) { killPrisoner(s, q, `${p.name}과의 싸움`); p.anger = Math.max(0, p.anger - 30); }
        else if (q.hp < 20 && !q.injured) { q.injured = true; leaveFight(s, q); setPState(s, q, 'idle'); q.thinkT = 0; q.path = null; q.anger = 0; log(s, `🤕 ${q.name} 싸움에서 부상 (의무실 필요)`, 'warn', q.x, q.y); }
      } else {
        const g = target as Staff; g.hp -= dmg; if (g.hp <= 0) injureStaff(s, g);
      }
    }
    // guards act
    for (const g of gs) {
      if (g.state !== 'fight') continue;
      let near: Prisoner | null = null, bd = 99;
      for (const p of ps) { if (p.hp <= 0 || p.fightId !== f.id) continue; const d = Math.hypot(p.x - g.x, p.y - g.y); if (d < bd) { bd = d; near = p; } }
      if (!near) continue;
      if (bd > 1.4) { if (bd < 4) stepToward(s, g, near.x, near.y, Math.min(bd - 0.9, 1.5), 'staff'); continue; }
      const adjacentGuards = gs.filter(o => o.state === 'fight' && Math.hypot(o.x - near!.x, o.y - near!.y) < 1.6).length;
      const chance = 0.22 + 0.12 * adjacentGuards - (near.sec === 'max' ? 0.08 : 0) - (near.rioter ? 0.05 : 0);
      if (rng.chance(chance)) { subdue(s, near); }
      else { near.hp -= STAFF_BY_ID.guard.attack * 0.5 * rng.range(0.6, 1.2); if (near.hp <= 0) killPrisoner(s, near, '진압 중 사망'); }
    }
    // bystanders feel unsafe
    for (const q of s.prisoners) if (q.fightId < 0 && Math.abs(q.x - f.x) < 7 && Math.abs(q.y - f.y) < 7) q.needs.safety = Math.min(100, q.needs.safety + 5);
    if (f.prisoners.length === 0) endFight(s, f);
  }
}
function endFight(s: GameState, f: Fight): void {
  for (const id of f.prisoners) { const p = s.cache.prisonerIndex.get(id); if (p) { p.fightId = -1; if (p.state === 'fight') { setPState(s, p, 'idle'); p.thinkT = 0; } } }
  for (const id of f.guards) { const g = s.cache.staffIndex.get(id); if (g) { g.fightId = -1; if (g.state === 'fight') { g.state = 'idle'; g.thinkT = 0.5; } } }
  const k = s.fights.indexOf(f); if (k >= 0) s.fights.splice(k, 1);
}

/** Riot detection (called every few seconds). */
export function checkRiot(s: GameState, rng: Rng): void {
  const n = s.prisoners.length; if (n === 0) { if (s.riot) endRiot(s); return; }
  const angry = s.prisoners.filter(p => p.anger > 70 && p.state !== 'subdued' && p.state !== 'heal' && p.punishedUntil <= s.time);
  if (!s.riot) {
    if (angry.length >= Math.max(4, Math.ceil(0.25 * n))) {
      s.riot = true; s.stats.riots++; s.stats.todayIncidents++; s.reputation = Math.max(0, s.reputation + REP_RIOT);
      for (const p of angry) p.rioter = true;
      log(s, `🔥 폭동 발생! 분노한 수감자 ${angry.length}명. 평판 ${REP_RIOT}. 비상 봉쇄·진압대를 고려하세요.`, 'bad');
      s.events.push({ type: 'riot' });
    }
    return;
  }
  for (const p of angry) if (!p.rioter && rng.chance(0.5)) p.rioter = true;
  const rioters = s.prisoners.filter(p => p.rioter).length;
  if (rioters === 0 || angry.length < Math.max(1, 0.1 * n)) endRiot(s);
}
function endRiot(s: GameState): void { s.riot = false; for (const p of s.prisoners) p.rioter = false; log(s, '✅ 폭동이 진압되었습니다.', 'good'); s.events.push({ type: 'riotEnd' }); }
