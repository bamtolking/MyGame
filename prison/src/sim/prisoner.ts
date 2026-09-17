// Prisoner behaviour: needs, regime-driven activities, misbehaviour (fights, escapes), punishment, release.
import type { GameState, Prisoner, Room, Vec, GameObject, Intent } from './types';
import { NEED_KEYS, NEED_INFO } from './types';
import type { Activity } from '../data/regime';
import { HOUR_SECONDS } from '../data/regime';
import { WORK_INCOME_PER_HOUR, FINE_ESCAPE, FINE_DEATH, RELEASE_BONUS, REP_ESCAPE, REP_DEATH, REP_RELEASE } from '../data/economy';
import { ROOMS, ZONE_INDEX } from '../data/rooms';
import { findPath, findEscapePath, findPathToEntry, isInsecure, nearestRoom, randomTileIn, roomOf, validRooms, isBorder, passable, inBounds } from './grid';
import { moveAlong, setPath, tileX, tileY, ARRIVED, BLOCKED } from './movement';
import { log } from './build';
import { startFight, leaveFight } from './incidents';
import type { Rng } from './rng';

export const OBJ_CAP: Record<string, number> = { bed: 1, toilet: 1, bench: 1, table: 2, shower: 1, medbed: 1, workbench: 2, weights: 1, cooker: 1 };
export const SPEED_PRISONER = 2.8, SPEED_ESCAPE = 3.3;

export const hourOf = (s: GameState): number => Math.floor(s.time / HOUR_SECONDS) % 24;
export const dayOf = (s: GameState): number => Math.floor(s.time / (HOUR_SECONDS * 24)) + 1;

export function reserveObj(s: GameState, p: Prisoner, ob: GameObject): void { releaseObj(s, p); ob.users++; p.useObj = ob.id; }
export function releaseObj(s: GameState, p: Prisoner): void { if (p.useObj >= 0) { const ob = s.cache.objIndex.get(p.useObj); if (ob) ob.users = Math.max(0, ob.users - 1); p.useObj = -1; } }
export function setPState(s: GameState, p: Prisoner, st: Prisoner['state'], intent?: Intent): void { p.state = st; p.stateT = 0; if (intent !== undefined) p.intent = intent; }

export function computeMood(p: Prisoner): void {
  let sum = 0, wsum = 0; for (const k of NEED_KEYS) { sum += p.needs[k] * NEED_INFO[k].weight; wsum += NEED_INFO[k].weight; }
  p.mood = Math.max(0, Math.min(100, 100 - sum / wsum));
  p.anger = Math.max(0, Math.min(100, (100 - p.mood) * p.volatility + (p.rioter ? 25 : 0) - (p.calmT > 0 ? 35 : 0)));
}

/** The activity a prisoner should follow right now. */
export function currentActivity(s: GameState, p: Prisoner): Activity {
  if (p.punishedUntil > s.time) return 'lockup';
  if (s.lockdown) return 'lockup';
  return s.regime[hourOf(s)];
}

function freeObjIn(s: GameState, r: Room, type: string): GameObject | null {
  for (const id of r.objs) { const ob = s.cache.objIndex.get(id)!; if (ob.type === type && ob.users < (OBJ_CAP[type] || 1)) return ob; }
  return null;
}
function roomHasFree(s: GameState, r: Room, type: string): boolean { return !!freeObjIn(s, r, type); }
function bedOf(s: GameState, p: Prisoner): GameObject | null { if (p.bedId < 0) return null; const b = s.cache.objIndex.get(p.bedId); if (!b || !b.built) { p.bedId = -1; return null; } return b; }
function cellRoom(s: GameState, p: Prisoner): Room | null { const b = bedOf(s, p); if (!b) return null; const r = roomOf(s, b.x, b.y); return r && r.zone === ZONE_INDEX.cell && r.valid ? r : null; }

/** Assign free beds in valid cells to prisoners without one. */
export function assignBeds(s: GameState): void {
  const cells = validRooms(s, 'cell');
  for (const p of s.prisoners) {
    if (p.bedId >= 0) { const b = s.cache.objIndex.get(p.bedId); if (b && b.built && roomOf(s, b.x, b.y)?.zone === ZONE_INDEX.cell) continue; if (b) b.owner = -1; p.bedId = -1; }
    let best: GameObject | null = null, bd = Infinity;
    for (const r of cells) for (const id of r.objs) { const ob = s.cache.objIndex.get(id)!; if (ob.type !== 'bed' || ob.owner >= 0) continue; const d = (ob.x - p.x) ** 2 + (ob.y - p.y) ** 2; if (d < bd) { bd = d; best = ob; } }
    if (best) { best.owner = p.id; p.bedId = best.id; }
  }
}

function goTo(s: GameState, p: Prisoner, tx: number, ty: number, intent: Intent, room: Room | null): boolean {
  const path = findPath(s, tileX(p), tileY(p), tx, ty, 'prisoner');
  if (!path) return false;
  setPath(p, path, { x: tx, y: ty }); p.toRoom = room ? room.id : -1; setPState(s, p, 'move', intent);
  if (path.length === 0) arrive(s, p, null as any);
  return true;
}
function goToRoom(s: GameState, p: Prisoner, r: Room, intent: Intent, rng: Rng, objType?: string): boolean {
  if (objType) { const ob = freeObjIn(s, r, objType); if (ob) { reserveObj(s, p, ob); if (goTo(s, p, ob.x, ob.y, intent, r)) return true; releaseObj(s, p); return false; } return false; }
  const t = randomTileIn(s, r, () => rng.next());
  return goTo(s, p, t.x, t.y, intent, r);
}
function wander(s: GameState, p: Prisoner, rng: Rng): void {
  const r = roomOf(s, tileX(p), tileY(p));
  for (let k = 0; k < 6; k++) {
    let tx: number, ty: number;
    if (r && rng.chance(0.7)) { const t = randomTileIn(s, r, () => rng.next()); tx = t.x; ty = t.y; }
    else { tx = tileX(p) + rng.int(9) - 4; ty = tileY(p) + rng.int(9) - 4; }
    if (!inBounds(s, tx, ty) || !passable(s, tx, ty, 'prisoner') || isBorder(s, tx, ty)) continue;
    if (goTo(s, p, tx, ty, 'wander', roomOf(s, tx, ty))) return;
  }
  setPState(s, p, 'wait', 'wander'); p.waitT = 2 + rng.next() * 3;
}

/** Decide what to do next. */
export function think(s: GameState, p: Prisoner, rng: Rng): void {
  releaseObj(s, p);
  computeMood(p);
  if (p.hp <= 0) return;
  const act = currentActivity(s, p);
  const cell = cellRoom(s, p);
  // urgent: injured → infirmary
  if (p.injured) {
    const inf = nearestRoom(s, 'infirmary', p.x, p.y, r => roomHasFree(s, r, 'medbed'));
    if (inf && goToRoom(s, p, inf, 'infirmary', rng, 'medbed')) return;
    if (p.hp >= 60) p.injured = false; // recovered enough without an infirmary
  }
  if (p.rioter && !s.riot) p.rioter = false;
  if (p.rioter) { riotThink(s, p, rng); return; }
  // punishment: solitary or cell
  if (p.punishedUntil > s.time) {
    const sol = nearestRoom(s, 'solitary', p.x, p.y, r => !s.prisoners.some(q => q !== p && q.toRoom === r.id && q.punishedUntil > s.time));
    if (sol && goToRoom(s, p, sol, 'solitary', rng)) return;
    if (cell && goToRoom(s, p, cell, 'cell', rng)) return;
  }
  switch (act) {
    case 'sleep': {
      const bed = bedOf(s, p);
      if (bed && cell) { reserveObj(s, p, bed); if (goTo(s, p, bed.x, bed.y, 'sleep', cell)) return; releaseObj(s, p); }
      const hold = nearestRoom(s, 'holding', p.x, p.y);
      if (hold && (goToRoom(s, p, hold, 'sleep', rng, 'bed') || goToRoom(s, p, hold, 'sleep', rng, 'bench') || goToRoom(s, p, hold, 'sleep', rng))) return;
      break;
    }
    case 'eat': if (tryEat(s, p, rng)) return; break;
    case 'shower': if (tryShower(s, p, rng)) return; break;
    case 'yard': if (tryYard(s, p, rng)) return; break;
    case 'work': {
      const ws = nearestRoom(s, 'workshop', p.x, p.y, r => roomHasFree(s, r, 'workbench'));
      if (ws && goToRoom(s, p, ws, 'work', rng, 'workbench')) return;
      if (freeTime(s, p, rng)) return; break;
    }
    case 'free': if (freeTime(s, p, rng)) return; break;
    case 'lockup': {
      if (cell && goToRoom(s, p, cell, 'cell', rng)) return;
      const hold = nearestRoom(s, 'holding', p.x, p.y); if (hold && goToRoom(s, p, hold, 'holding', rng)) return;
      break;
    }
  }
  // fallback: stay in holding cell / cell / wander
  const here = roomOf(s, tileX(p), tileY(p));
  const restable = here && here.zone !== ZONE_INDEX.kitchen && here.zone !== ZONE_INDEX.infirmary && here.zone !== ZONE_INDEX.office && (here.zone !== ZONE_INDEX.solitary || p.punishedUntil > s.time);
  if (restable) { if (rng.chance(0.4)) { wander(s, p, rng); return; } setPState(s, p, 'rest', 'wander'); p.waitT = 4 + rng.next() * 6; return; }
  const hold = nearestRoom(s, 'holding', p.x, p.y);
  if (hold && goToRoom(s, p, hold, 'holding', rng)) return;
  if (cell && goToRoom(s, p, cell, 'cell', rng)) return;
  wander(s, p, rng);
}
function tryEat(s: GameState, p: Prisoner, rng: Rng): boolean {
  if (s.time - p.lastMeal < 2 * HOUR_SECONDS && p.needs.hunger < 70) return false;
  const c = nearestRoom(s, 'canteen', p.x, p.y);
  if (!c) return false;
  return goToRoom(s, p, c, 'eat', rng, 'table') || goToRoom(s, p, c, 'eat', rng);
}
function tryShower(s: GameState, p: Prisoner, rng: Rng): boolean {
  if (p.needs.hygiene < 25) return false;
  const r = nearestRoom(s, 'shower', p.x, p.y, r => roomHasFree(s, r, 'shower')) || nearestRoom(s, 'shower', p.x, p.y);
  if (!r) return false;
  return goToRoom(s, p, r, 'shower', rng, 'shower') || goToRoom(s, p, r, 'shower', rng);
}
function tryYard(s: GameState, p: Prisoner, rng: Rng): boolean {
  const r = nearestRoom(s, 'yard', p.x, p.y); if (!r) return false;
  if (p.needs.exercise > 40 && rng.chance(0.5) && goToRoom(s, p, r, 'yard', rng, 'weights')) return true;
  if (rng.chance(0.4) && goToRoom(s, p, r, 'yard', rng, 'bench')) return true;
  return goToRoom(s, p, r, 'yard', rng);
}
function tryCommon(s: GameState, p: Prisoner, rng: Rng): boolean { const r = nearestRoom(s, 'common', p.x, p.y); if (!r) return false; return (rng.chance(0.4) && goToRoom(s, p, r, 'common', rng, 'bench')) || goToRoom(s, p, r, 'common', rng); }
/** Free time: address the most pressing need that has a facility. */
function freeTime(s: GameState, p: Prisoner, rng: Rng): boolean {
  const n = p.needs;
  const options: { v: number; f: () => boolean }[] = [
    { v: n.hunger * (s.meals > 0 ? 1.3 : 0.2), f: () => tryEat(s, p, rng) },
    { v: n.hygiene, f: () => tryShower(s, p, rng) },
    { v: n.exercise + n.freedom * 0.5, f: () => tryYard(s, p, rng) },
    { v: n.recreation + n.freedom * 0.3, f: () => tryCommon(s, p, rng) },
    { v: n.sleep > 75 ? n.sleep : 0, f: () => { const b = bedOf(s, p); const c = cellRoom(s, p); if (!b || !c) return false; reserveObj(s, p, b); if (goTo(s, p, b.x, b.y, 'sleep', c)) return true; releaseObj(s, p); return false; } },
  ].sort((a, b) => b.v - a.v);
  for (const o of options) { if (o.v < 15) break; if (o.f()) return true; }
  // nothing pressing: yard or common or wander
  return (rng.chance(0.5) && tryYard(s, p, rng)) || tryCommon(s, p, rng) || tryYard(s, p, rng);
}
function riotThink(s: GameState, p: Prisoner, rng: Rng): void {
  // attack the nearest person within 8 tiles, else roam
  let best: { x: number; y: number; kind: 'p' | 's'; id: number } | null = null, bd = 64;
  for (const q of s.prisoners) { if (q === p || q.state === 'fight' || q.state === 'subdued' || q.hp <= 0 || q.injured) continue; const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < bd) { bd = d; best = { x: q.x, y: q.y, kind: 'p', id: q.id }; } }
  for (const st of s.staff) { if (st.state === 'injured' || st.state === 'leave' || st.type !== 'guard') continue; const d = (st.x - p.x) ** 2 + (st.y - p.y) ** 2; if (d < bd * 0.8) { bd = d; best = { x: st.x, y: st.y, kind: 's', id: st.id }; } }
  if (best && bd <= 2.6) { startFight(s, p, best.kind === 'p' ? s.cache.prisonerIndex.get(best.id)! : null, best.kind === 's' ? s.cache.staffIndex.get(best.id)! : null); return; }
  if (best && goTo(s, p, Math.floor(best.x), Math.floor(best.y), 'riot', null)) return;
  wander(s, p, rng);
}

/** Called when a movement path completes. */
export function arrive(s: GameState, p: Prisoner, _rng: Rng): void {
  const ob = p.useObj >= 0 ? s.cache.objIndex.get(p.useObj) : null;
  switch (p.intent) {
    case 'sleep': setPState(s, p, 'sleep'); return;
    case 'eat':
      if (s.meals >= 1) { s.meals -= 1; setPState(s, p, 'eat'); return; }
      setPState(s, p, 'wait'); p.waitT = 6; return;
    case 'shower': if (ob && ob.type === 'shower') { setPState(s, p, 'shower'); return; } setPState(s, p, 'wait'); p.waitT = 4; return;
    case 'yard': case 'common': case 'holding': case 'cell': case 'wander': case 'solitary': setPState(s, p, 'rest'); p.waitT = 12 + (p.id % 7) * 2; return;
    case 'work': if (ob && ob.type === 'workbench') { setPState(s, p, 'work'); return; } setPState(s, p, 'wait'); p.waitT = 5; return;
    case 'infirmary': if (ob && ob.type === 'medbed') { setPState(s, p, 'heal'); return; } setPState(s, p, 'wait'); p.waitT = 5; return;
    case 'escape': escapeSucceeded(s, p); return;
    case 'release': releaseDone(s, p); return;
    case 'riot': setPState(s, p, 'idle'); p.thinkT = 0; return;
    default: setPState(s, p, 'idle'); p.thinkT = 0.2;
  }
}

function escapeSucceeded(s: GameState, p: Prisoner): void {
  s.stats.escapes++; s.stats.todayIncidents++; s.money -= FINE_ESCAPE; s.finance.today.fines += FINE_ESCAPE; s.reputation = Math.max(0, s.reputation + REP_ESCAPE);
  log(s, `🏃 ${p.name} 탈주 성공! 벌금 $${FINE_ESCAPE}, 평판 ${REP_ESCAPE}`, 'bad', p.x, p.y);
  s.events.push({ type: 'escaped', x: p.x, y: p.y });
  removePrisoner(s, p);
}
function releaseDone(s: GameState, p: Prisoner): void {
  s.stats.released++; s.money += RELEASE_BONUS; s.finance.today.bonus += RELEASE_BONUS; s.reputation = Math.min(100, s.reputation + REP_RELEASE);
  log(s, `🎉 ${p.name} 형기 만료 출소 (+$${RELEASE_BONUS}, 평판 +${REP_RELEASE})`, 'good', p.x, p.y);
  removePrisoner(s, p);
}
export function killPrisoner(s: GameState, p: Prisoner, cause: string): void {
  s.stats.deaths++; s.stats.todayIncidents++; s.money -= FINE_DEATH; s.finance.today.fines += FINE_DEATH; s.reputation = Math.max(0, s.reputation + REP_DEATH);
  log(s, `💀 ${p.name} 사망 (${cause}). 벌금 $${FINE_DEATH}, 평판 ${REP_DEATH}`, 'bad', p.x, p.y);
  s.events.push({ type: 'death', x: p.x, y: p.y });
  removePrisoner(s, p);
}
export function removePrisoner(s: GameState, p: Prisoner): void {
  releaseObj(s, p); leaveFight(s, p);
  if (p.bedId >= 0) { const b = s.cache.objIndex.get(p.bedId); if (b) b.owner = -1; }
  for (const st of s.staff) if (st.chaseId === p.id) { st.chaseId = -1; st.state = 'idle'; st.path = null; }
  const k = s.prisoners.indexOf(p); if (k >= 0) s.prisoners.splice(k, 1); s.cache.prisonerIndex.delete(p.id);
}

/** Try to begin an escape. Returns true if an escape path exists. */
export function tryEscape(s: GameState, p: Prisoner): boolean {
  const path = findEscapePath(s, tileX(p), tileY(p)); if (!path) return false;
  releaseObj(s, p); leaveFight(s, p);
  setPath(p, path, path[path.length - 1] || { x: tileX(p), y: tileY(p) }); setPState(s, p, 'escape', 'escape'); p.toRoom = -1;
  log(s, `🚨 ${p.name} 탈주 시도!`, 'warn', p.x, p.y); s.events.push({ type: 'escape', x: p.x, y: p.y, data: p.id });
  if (path.length === 0) escapeSucceeded(s, p);
  return true;
}
export function startRelease(s: GameState, p: Prisoner): void {
  releaseObj(s, p);
  const path = findPathToEntry(s, tileX(p), tileY(p), 'prisoner');
  if (!path) { log(s, `⚠ ${p.name} 출소 예정이지만 출구까지 길이 없음`, 'warn', p.x, p.y); p.arrivedDay += 1; return; }
  if (p.bedId >= 0) { const b = s.cache.objIndex.get(p.bedId); if (b) b.owner = -1; p.bedId = -1; }
  setPath(p, path, s.entry); setPState(s, p, 'move', 'release'); p.toRoom = -1;
  if (path.length === 0) releaseDone(s, p);
}
export function subdue(s: GameState, p: Prisoner): void {
  releaseObj(s, p); leaveFight(s, p);
  setPState(s, p, 'subdued', 'none'); p.path = null; p.target = null; p.rioter = false; p.calmT = 6 * HOUR_SECONDS;
  p.punishedUntil = s.time + 6 * HOUR_SECONDS; s.stats.subdued++;
  for (const st of s.staff) if (st.chaseId === p.id) { st.chaseId = -1; st.state = 'idle'; st.path = null; }
  log(s, `🔒 ${p.name} 제압됨 → 6시간 징벌`, 'info', p.x, p.y);
}

/** Per-tick update. */
export function updatePrisoner(s: GameState, p: Prisoner, rng: Rng, dt: number): void {
  p.stateT += dt; p.thinkT -= dt; if (p.calmT > 0) p.calmT -= dt;
  const hrs = dt / HOUR_SECONDS; const n = p.needs;
  // needs drift
  n.hunger += 6 * hrs; n.hygiene += 3 * hrs; n.exercise += 2 * hrs; n.recreation += 3 * hrs;
  if (p.state !== 'sleep') n.sleep += 4 * hrs;
  n.safety -= 4 * hrs;
  const act = currentActivity(s, p);
  if (act === 'lockup' || (p.state === 'rest' && (p.intent === 'cell' || p.intent === 'holding' || p.intent === 'solitary'))) n.freedom += 8 * hrs;
  // guard proximity
  for (const st of s.staff) if (st.type === 'guard' && st.state !== 'injured' && Math.abs(st.x - p.x) < 6 && Math.abs(st.y - p.y) < 6) { n.safety -= 10 * hrs; break; }
  const here = roomOf(s, tileX(p), tileY(p));
  switch (p.state) {
    case 'idle': if (p.thinkT <= 0) { p.thinkT = 1; think(s, p, rng); } break;
    case 'wait': case 'rest': {
      const z = here ? ROOMS[here.zone].id : '';
      if (z === 'yard') { n.exercise -= 35 * hrs; n.freedom -= 12 * hrs; n.recreation -= (p.useObj >= 0 ? 18 : 12) * hrs; if (p.useObj >= 0 && s.cache.objIndex.get(p.useObj)?.type === 'weights') n.exercise -= 25 * hrs; }
      else if (z === 'common') { n.recreation -= 30 * hrs; n.freedom -= 8 * hrs; }
      else if (z === 'canteen') { n.recreation -= 4 * hrs; }
      else if (z === 'holding' || z === 'cell') { n.recreation -= 2 * hrs; }
      p.waitT -= dt;
      if (p.waitT <= 0 || (!compatible(p.intent, act) && p.stateT > 3)) { setPState(s, p, 'idle'); p.thinkT = 0; }
      break;
    }
    case 'move': {
      const r = moveAlong(p, SPEED_PRISONER, dt, (x, y) => passable(s, x, y, 'prisoner'));
      if (r === ARRIVED) arrive(s, p, rng);
      else if (r === BLOCKED || p.stateT > 40) { releaseObj(s, p); setPState(s, p, 'idle'); p.thinkT = 0; }
      break;
    }
    case 'sleep': {
      const inBed = p.useObj >= 0 && s.cache.objIndex.get(p.useObj)?.type === 'bed';
      n.sleep -= (inBed ? 18 : 10) * hrs; n.freedom -= 2 * hrs;
      if (n.sleep <= 0) n.sleep = 0;
      if (act !== 'sleep' && (n.sleep < 25 || p.stateT > 2 * HOUR_SECONDS) || (act !== 'sleep' && act !== 'lockup' && p.stateT > 0.5 * HOUR_SECONDS && n.sleep < 60)) { setPState(s, p, 'idle'); p.thinkT = 0; }
      break;
    }
    case 'eat': if (p.stateT >= 4) { n.hunger = Math.max(0, n.hunger - 75); n.recreation = Math.max(0, n.recreation - 8); p.lastMeal = s.time; setPState(s, p, 'rest'); p.waitT = 3 + rng.next() * 4; } break;
    case 'shower': if (p.stateT >= 4) { n.hygiene = Math.max(0, n.hygiene - 65); setPState(s, p, 'idle'); p.thinkT = 0.5; } break;
    case 'work': {
      const inc = WORK_INCOME_PER_HOUR * hrs; s.money += inc; s.stats.workIncome += inc; s.finance.today.work += inc; n.recreation -= 4 * hrs; n.freedom -= 4 * hrs;
      if (act !== 'work') { setPState(s, p, 'idle'); p.thinkT = 0; }
      break;
    }
    case 'heal': {
      let doctor = false; if (here) for (const st of s.staff) if (st.type === 'doctor' && st.state === 'work' && roomOf(s, tileX(st), tileY(st)) === here) { doctor = true; break; }
      p.hp = Math.min(p.maxHp, p.hp + (doctor ? 30 : 8) * hrs);
      if (p.hp >= 85) { p.injured = false; setPState(s, p, 'idle'); p.thinkT = 0; }
      break;
    }
    case 'subdued': if (p.stateT >= 6) { setPState(s, p, 'idle'); p.thinkT = 0; } break;
    case 'escape': {
      const r = moveAlong(p, SPEED_ESCAPE, dt, (x, y) => passable(s, x, y, 'escaper'));
      if (r === ARRIVED) { escapeSucceeded(s, p); return; }
      if (r === BLOCKED && !tryEscape(s, p)) { setPState(s, p, 'idle'); p.thinkT = 0; log(s, `${p.name} 탈주로가 막혀 포기`, 'info'); }
      break;
    }
    case 'fight': break; // handled by incidents
  }
  // untreated injury slowly worsens without an infirmary
  if (p.injured && p.state !== 'heal' && p.state !== 'fight') {
    if (p.hp < 8) { p.hp -= 0.5 * hrs; if (p.hp <= 0) { killPrisoner(s, p, '치료받지 못한 중상'); return; } }
    else { p.hp += 4 * hrs; if (p.hp >= 60) p.injured = false; }
  }
  else if (!p.injured && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 3 * hrs);
  for (const k of NEED_KEYS) n[k] = Math.max(0, Math.min(100, n[k]));
  // misbehaviour roll (once per second)
  if (p.thinkT <= 0 && (p.state === 'idle' || p.state === 'rest' || p.state === 'wait' || p.state === 'move' || p.state === 'work') && p.intent !== 'release') {
    p.thinkT = 1; computeMood(p);
    misbehave(s, p, rng);
    if (p.state === 'idle') think(s, p, rng);
  }
}
function compatible(intent: Intent, act: Activity): boolean {
  switch (intent) {
    case 'yard': return act === 'yard' || act === 'free';
    case 'common': return act === 'free' || act === 'work';
    case 'eat': return act === 'eat' || act === 'free';
    case 'work': return act === 'work';
    case 'cell': case 'holding': case 'solitary': return act === 'lockup' || act === 'sleep';
    case 'wander': return true;
    default: return false;
  }
}
function misbehave(s: GameState, p: Prisoner, rng: Rng): void {
  const onInsecure = isInsecure(s, tileX(p), tileY(p));
  // opportunistic escape when standing on ground connected to the outside
  if (onInsecure && p.state !== 'escape' && rng.chance(0.004 + p.needs.freedom / 100 * 0.012 + (p.escapist ? 0.01 : 0))) { if (tryEscape(s, p)) return; }
  if (p.anger <= 50 || p.injured) return;
  const prob = (p.anger - 50) / 50 * 0.03;
  if (!rng.chance(prob)) return;
  if ((p.needs.freedom > 45 || p.escapist) && (onInsecure || p.escapist) && tryEscape(s, p)) return;
  // fight: nearest other prisoner within 4 tiles
  let best: Prisoner | null = null, bd = 16;
  for (const q of s.prisoners) { if (q === p || q.state === 'subdued' || q.state === 'escape' || q.state === 'fight' || q.hp <= 0 || q.injured || q.intent === 'release') continue; const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < bd) { bd = d; best = q; } }
  if (best) { startFight(s, p, best, null); return; }
  if (p.sec === 'max' || p.rioter) { for (const st of s.staff) if (st.type === 'guard' && st.state !== 'injured' && (st.x - p.x) ** 2 + (st.y - p.y) ** 2 < 6) { startFight(s, p, null, st); return; } }
  p.anger -= 5; // no outlet: fizzles
}
