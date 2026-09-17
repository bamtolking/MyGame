// Staff behaviour: guards (patrol, respond, chase), cooks, doctors, workmen.
import type { GameState, Staff, Job, Room } from './types';
import { STAFF_BY_ID } from '../data/staff';
import { HOUR_SECONDS } from '../data/regime';
import { MEALS_PER_COOK_HOUR, MEAL_INGREDIENT_COST } from '../data/economy';
import { S_WALL, S_FENCE, findPath, findPathAdjacent, findPathToEntry, nearestRoom, randomTileIn, roomOf, validRooms, passable, inBounds } from './grid';
import { moveAlong, setPath, tileX, tileY, ARRIVED, BLOCKED } from './movement';
import { completeJob, removeStaffNow, releaseStaffObj, log } from './build';
import { subdue } from './prisoner';
import { leaveFightStaff } from './incidents';
import type { Rng } from './rng';

const speedOf = (st: Staff): number => STAFF_BY_ID[st.type].speed * (st.temp ? 1.1 : 1);

function goStaff(s: GameState, st: Staff, tx: number, ty: number, adjacentOnly = false): boolean {
  const path = adjacentOnly ? findPathAdjacent(s, tileX(st), tileY(st), tx, ty, 'staff', false) : findPath(s, tileX(st), tileY(st), tx, ty, 'staff');
  if (!path) return false;
  setPath(st, path, { x: tx, y: ty }); st.state = 'move'; st.stateT = 0;
  if (path.length === 0) staffArrive(s, st);
  return true;
}
function wanderStaff(s: GameState, st: Staff, rng: Rng): void {
  for (let k = 0; k < 5; k++) { const tx = tileX(st) + rng.int(7) - 3, ty = tileY(st) + rng.int(7) - 3; if (inBounds(s, tx, ty) && passable(s, tx, ty, 'staff') && tx > 1 && goStaff(s, st, tx, ty)) return; }
  st.state = 'work'; st.stateT = 0; st.patrolT = 3;
}
export function staffArrive(s: GameState, st: Staff): void {
  st.state = 'work'; st.stateT = 0;
  if (st.type === 'guard') st.patrolT = 3 + (st.id % 5);
  if (st.type === 'workman') { const j = s.jobs.find(j => j.id === st.jobId); if (!j || Math.max(Math.abs(j.x + 0.5 - st.x), Math.abs(j.y + 0.5 - st.y)) > 1.6) { if (j) j.workerId = -1; st.jobId = -1; st.state = 'idle'; st.thinkT = 0.3; } }
}

/** Per-workman list of jobs that could not be reached recently (jobId → sim time until which to skip). Not serialized: it is only an optimisation. */
const skipJobs = new Map<number, Map<number, number>>();
/** Staff sealed inside walls with no way to the entrance are lifted out (mobile-friendly alternative to a stuck game). */
function rescueIfTrapped(s: GameState, st: Staff): boolean {
  if (findPathToEntry(s, tileX(st), tileY(st), 'staff')) return false;
  st.x = s.entry.x + 0.5; st.y = s.entry.y + 0.5; st.path = null; st.target = null; releaseStaffObj(s, st);
  if (st.jobId >= 0) { const j = s.jobs.find(j => j.id === st.jobId); if (j) j.workerId = -1; st.jobId = -1; }
  log(s, `⚠ ${STAFF_BY_ID[st.type].name} ${st.name}이(가) 벽에 갇혀 입구로 나왔습니다. 문을 잊지 마세요.`, 'warn', st.x, st.y);
  return true;
}
function thinkStaff(s: GameState, st: Staff, rng: Rng): void {
  if (st.temp && s.time >= st.leaveAt) { st.state = 'leave'; st.path = null; log(s, `진압대원 ${st.name} 철수`, 'info'); return; }
  st.patrolT = 0;
  if (st.type !== 'workman' && (st.id + Math.floor(s.time)) % 12 === 0 && rescueIfTrapped(s, st)) return;
  switch (st.type) {
    case 'guard': thinkGuard(s, st, rng); return;
    case 'cook': thinkCook(s, st, rng); return;
    case 'doctor': thinkDoctor(s, st, rng); return;
    case 'workman': thinkWorkman(s, st, rng); return;
  }
}
function thinkGuard(s: GameState, st: Staff, rng: Rng): void {
  // 1) fights that need more guards
  let bestF = null as null | typeof s.fights[0], bd = Infinity;
  for (const f of s.fights) { if (f.guards.length >= Math.min(3, f.prisoners.length + 1)) continue; const d = (f.x - st.x) ** 2 + (f.y - st.y) ** 2; if (d < bd) { bd = d; bestF = f; } }
  if (bestF) { if (goStaff(s, st, Math.floor(bestF.x), Math.floor(bestF.y))) { bestF.guards.push(st.id); st.fightId = bestF.id; st.state = 'fight'; return; } }
  // 2) escapers with fewer than 2 chasers
  let bestP = null as null | typeof s.prisoners[0]; bd = Infinity;
  for (const p of s.prisoners) { if (p.state !== 'escape') continue; const chasers = s.staff.filter(g => g.chaseId === p.id).length; if (chasers >= 2) continue; const d = (p.x - st.x) ** 2 + (p.y - st.y) ** 2; if (d < bd) { bd = d; bestP = p; } }
  if (bestP) { const path = findPath(s, tileX(st), tileY(st), tileX(bestP), tileY(bestP), 'staff', 9000); if (path) { setPath(st, path, { x: tileX(bestP), y: tileY(bestP) }); st.chaseId = bestP.id; st.state = 'chase'; st.stateT = 0; return; } }
  // 3) patrol: rooms weighted by prisoners present minus guards present
  const counts = new Map<number, number>();
  for (const p of s.prisoners) { const r = roomOf(s, tileX(p), tileY(p)); if (r) counts.set(r.id, (counts.get(r.id) || 0) + 1); }
  for (const g of s.staff) if (g.type === 'guard' && g !== st) { const r = roomOf(s, tileX(g), tileY(g)); if (r) counts.set(r.id, (counts.get(r.id) || 0) - 3); }
  const cands: { r: Room; w: number }[] = [];
  for (const [id, c] of counts) if (c > 0) cands.push({ r: s.cache.rooms[id], w: c });
  if (cands.length && rng.chance(0.85)) {
    let tot = 0; for (const c of cands) tot += c.w; let r = rng.next() * tot; let pick = cands[0];
    for (const c of cands) { r -= c.w; if (r <= 0) { pick = c; break; } }
    const t = randomTileIn(s, pick.r, () => rng.next()); if (goStaff(s, st, t.x, t.y)) return;
  }
  if (s.prisoners.length && rng.chance(0.6)) { const p = rng.pick(s.prisoners); if (goStaff(s, st, tileX(p), tileY(p))) return; }
  wanderStaff(s, st, rng);
}
function thinkCook(s: GameState, st: Staff, rng: Rng): void {
  releaseStaffObj(s, st);
  for (const r of validRooms(s, 'kitchen')) {
    for (const id of r.objs) { const ob = s.cache.objIndex.get(id)!; if (ob.type !== 'cooker' || ob.users > 0) continue; if (goStaff(s, st, ob.x, ob.y)) { ob.users++; st.useObj = ob.id; return; } }
  }
  const k = nearestRoom(s, 'kitchen', st.x, st.y); if (k) { const t = randomTileIn(s, k, () => rng.next()); if (goStaff(s, st, t.x, t.y)) return; }
  wanderStaff(s, st, rng); st.patrolT = 6;
}
function thinkDoctor(s: GameState, st: Staff, rng: Rng): void {
  const inf = nearestRoom(s, 'infirmary', st.x, st.y);
  if (inf) { const here = roomOf(s, tileX(st), tileY(st)); if (here === inf) { st.state = 'work'; st.stateT = 0; st.patrolT = 10; return; } const t = randomTileIn(s, inf, () => rng.next()); if (goStaff(s, st, t.x, t.y)) return; }
  wanderStaff(s, st, rng); st.patrolT = 6;
}
function thinkWorkman(s: GameState, st: Staff, rng: Rng): void {
  let my = skipJobs.get(st.id); if (!my) { my = new Map(); skipJobs.set(st.id, my); }
  const cands = s.jobs.filter(j => j.workerId < 0 && !((my!.get(j.id) || 0) > s.time)).sort((a, b) => (Math.abs(a.x - st.x) + Math.abs(a.y - st.y)) - (Math.abs(b.x - st.x) + Math.abs(b.y - st.y)));
  let tries = 0, failed = 0, trapped: boolean | null = null;
  for (const j of cands) {
    if (tries++ > 6) break;
    const solidBuild = j.kind === 'build' && (j.struct === S_WALL || j.struct === S_FENCE);
    const path = solidBuild ? findPathAdjacent(s, tileX(st), tileY(st), j.x, j.y, 'staff', false) : findPathAdjacent(s, tileX(st), tileY(st), j.x, j.y, 'staff', true);
    if (!path) {
      failed++; my.set(j.id, s.time + 8);
      if (trapped === null) trapped = !findPathToEntry(s, tileX(st), tileY(st), 'staff');
      if (trapped) { rescueIfTrapped(s, st); return; }
      j.unreachable = true; j.retryT = 6; continue;
    }
    j.unreachable = false; j.workerId = st.id; st.jobId = j.id; setPath(st, path, { x: j.x, y: j.y }); st.state = 'move'; st.stateT = 0;
    if (path.length === 0) staffArrive(s, st);
    return;
  }
  void failed; void rng;
  // nothing to do: wait where we are
  st.state = 'work'; st.stateT = 0; st.patrolT = 4;
}

export function updateStaff(s: GameState, st: Staff, rng: Rng, dt: number): void {
  st.stateT += dt; st.thinkT -= dt;
  const hrs = dt / HOUR_SECONDS;
  switch (st.state) {
    case 'leave': {
      if (!st.path) { const path = findPathToEntry(s, tileX(st), tileY(st), 'staff'); if (!path || path.length === 0) { removeStaffNow(s, st); return; } setPath(st, path, s.entry); }
      if (moveAlong(st, speedOf(st), dt) !== 0) { removeStaffNow(s, st); return; }
      break;
    }
    case 'injured': if (st.stateT >= 30) { st.hp = Math.round(st.maxHp * 0.6); st.state = 'idle'; st.thinkT = 0; } break;
    case 'move': {
      const r = moveAlong(st, speedOf(st), dt, (x, y) => passable(s, x, y, 'staff'));
      if (r === ARRIVED) staffArrive(s, st); else if (r === BLOCKED || st.stateT > 45) { if (st.jobId >= 0) { const j = s.jobs.find(j => j.id === st.jobId); if (j) j.workerId = -1; st.jobId = -1; } releaseStaffObj(s, st); st.state = 'idle'; st.thinkT = 0.2; }
      break;
    }
    case 'fight': {
      const f = s.fights.find(f => f.id === st.fightId);
      if (!f) { st.fightId = -1; st.state = 'idle'; st.thinkT = 0; break; }
      const d = Math.hypot(f.x - st.x, f.y - st.y);
      if (d > 2.2) {
        if (!st.path || st.stateT % 1 < dt) { const p = findPathAdjacent(s, tileX(st), tileY(st), Math.floor(f.x), Math.floor(f.y), 'staff', true); if (p) setPath(st, p, { x: Math.floor(f.x), y: Math.floor(f.y) }); }
        moveAlong(st, speedOf(st) * 1.15, dt, (x, y) => passable(s, x, y, 'staff'));
      }
      break;
    }
    case 'chase': {
      const p = s.cache.prisonerIndex.get(st.chaseId);
      if (!p || p.state !== 'escape') { st.chaseId = -1; st.state = 'idle'; st.thinkT = 0; st.path = null; break; }
      const d = Math.hypot(p.x - st.x, p.y - st.y);
      if (d <= 1.1) { subdue(s, p); st.chaseId = -1; st.state = 'idle'; st.thinkT = 0.5; st.path = null; break; }
      if (!st.path || st.stateT % 0.7 < dt) { const path = findPath(s, tileX(st), tileY(st), tileX(p), tileY(p), 'staff', 9000); if (path) setPath(st, path, { x: tileX(p), y: tileY(p) }); }
      moveAlong(st, speedOf(st) * 1.25, dt, (x, y) => passable(s, x, y, 'staff'));
      break;
    }
    case 'work': {
      if (st.type === 'workman') {
        const j = s.jobs.find(j => j.id === st.jobId);
        if (!j) { st.jobId = -1; st.state = 'idle'; st.thinkT = 0.2; break; }
        j.progress += dt; if (j.progress >= j.total) { completeJob(s, j); st.jobId = -1; st.state = 'idle'; st.thinkT = 0.1; s.events.push({ type: 'built', x: j.x + 0.5, y: j.y + 0.5, data: j.kind }); }
      } else if (st.type === 'cook') {
        const ob = st.useObj >= 0 ? s.cache.objIndex.get(st.useObj) : null; const r = ob ? roomOf(s, ob.x, ob.y) : null;
        if (!ob || !r || !r.valid) { releaseStaffObj(s, st); st.state = 'idle'; st.thinkT = 1; break; }
        if (s.meals < s.mealCap) { const made = MEALS_PER_COOK_HOUR * hrs; s.meals = Math.min(s.mealCap, s.meals + made); const cost = made * MEAL_INGREDIENT_COST; s.money -= cost; s.finance.today.food += cost; }
        if (st.stateT > 30 * HOUR_SECONDS) { st.state = 'idle'; st.thinkT = 0; }
      } else if (st.type === 'doctor') {
        if (st.stateT > st.patrolT) { st.state = 'idle'; st.thinkT = 0; }
      } else { if (st.stateT > st.patrolT) { st.state = 'idle'; st.thinkT = 0; } }
      break;
    }
    case 'idle': if (st.thinkT <= 0) { st.thinkT = 1; thinkStaff(s, st, rng); } break;
  }
  if (st.state !== 'injured' && st.hp < st.maxHp) st.hp = Math.min(st.maxHp, st.hp + 4 * hrs);
}
export function releaseAllStaffFromFight(s: GameState, st: Staff): void { leaveFightStaff(s, st); }
