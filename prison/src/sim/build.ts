// Construction actions: planning jobs (charged up front, built by workmen), zones (instant), objects, demolition, staff hiring.
import type { GameState, Job, GameObject, Staff } from './types';
import { STRUCT_BY_INDEX, STRUCT_INDEX, DEMOLISH_TIME, DEMOLISH_REFUND, type StructType } from '../data/structures';
import { OBJ_BY_ID, type ObjType } from '../data/objects';
import { STAFF_BY_ID, type StaffType } from '../data/staff';
import { ROOMS } from '../data/rooms';
import { S_NONE, inBounds, isBorder, T_ROAD, computeSecurity, detectRooms } from './grid';
import { SURNAMES, GIVEN } from '../data/names';
import { Rng } from './rng';

export function markDirty(s: GameState): void { s.cache.dirtySecurity = true; s.cache.dirtyRooms = true; }
export function refresh(s: GameState): void { if (s.cache.dirtySecurity) computeSecurity(s); if (s.cache.dirtyRooms) detectRooms(s); }
export function log(s: GameState, text: string, kind: 'info' | 'warn' | 'bad' | 'good' = 'info', x?: number, y?: number): void {
  s.log.push({ t: s.time, text, kind }); if (s.log.length > 80) s.log.splice(0, s.log.length - 80);
  s.events.push({ type: 'log', text, kind, x, y });
}

export const jobAt = (s: GameState, x: number, y: number): Job | null => { const id = s.cache.jobAt[y * s.w + x]; return id >= 0 ? s.jobs.find(j => j.id === id) || null : null; };
export function rebuildJobIndex(s: GameState): void { s.cache.jobAt.fill(-1); for (const j of s.jobs) s.cache.jobAt[j.y * s.w + j.x] = j.id; }

/** Whether a tile can accept a new build (structure or object). */
export function canBuildAt(s: GameState, x: number, y: number, what: 'struct' | 'obj'): string | null {
  if (!inBounds(s, x, y)) return '범위 밖';
  if (isBorder(s, x, y)) return '가장자리에는 지을 수 없음';
  if (s.terrain[y * s.w + x] === T_ROAD) return '도로에는 지을 수 없음';
  if (jobAt(s, x, y)) return '이미 작업 예정';
  if (s.struct[y * s.w + x] !== S_NONE) return '이미 구조물이 있음';
  if (s.objAt[y * s.w + x] >= 0) return what === 'struct' ? '물건이 있음 (먼저 철거)' : '이미 물건이 있음';
  for (const p of s.prisoners) if (what === 'struct' && Math.floor(p.x) === x && Math.floor(p.y) === y) return null; // allowed; entity will be pushed out when built
  return null;
}

/** Plan a structure tile. Returns error string or null. */
export function planStruct(s: GameState, x: number, y: number, type: StructType): string | null {
  const err = canBuildAt(s, x, y, 'struct'); if (err) return err;
  const def = STRUCT_BY_INDEX[STRUCT_INDEX[type]]!;
  if (s.money < def.cost) return '자금 부족';
  s.money -= def.cost; s.finance.today.build += def.cost;
  const job: Job = { id: s.nextId++, kind: 'build', x, y, struct: STRUCT_INDEX[type], obj: null, objId: -1, progress: 0, total: def.buildTime, cost: def.cost, workerId: -1, unreachable: false, retryT: 0 };
  s.jobs.push(job); s.cache.jobAt[y * s.w + x] = job.id; return null;
}
/** Plan an object. Returns error or null. */
export function planObject(s: GameState, x: number, y: number, type: ObjType): string | null {
  const err = canBuildAt(s, x, y, 'obj'); if (err) return err;
  const def = OBJ_BY_ID[type]; if (s.money < def.cost) return '자금 부족';
  s.money -= def.cost; s.finance.today.build += def.cost;
  const ob: GameObject = { id: s.nextId++, type, x, y, users: 0, owner: -1, built: false };
  s.objects.push(ob); s.cache.objIndex.set(ob.id, ob); s.objAt[y * s.w + x] = ob.id;
  const job: Job = { id: s.nextId++, kind: 'build', x, y, struct: 0, obj: type, objId: ob.id, progress: 0, total: def.buildTime, cost: def.cost, workerId: -1, unreachable: false, retryT: 0 };
  s.jobs.push(job); s.cache.jobAt[y * s.w + x] = job.id; return null;
}
/** Cancel a pending job (full refund). */
export function cancelJob(s: GameState, job: Job): void {
  const i = s.jobs.indexOf(job); if (i < 0) return; s.jobs.splice(i, 1); s.cache.jobAt[job.y * s.w + job.x] = -1;
  if (job.kind === 'build') { s.money += job.cost; s.finance.today.build -= job.cost; if (job.objId >= 0) removeObjectNow(s, job.objId); }
  for (const st of s.staff) if (st.jobId === job.id) { st.jobId = -1; st.state = 'idle'; st.path = null; }
}
/** Queue demolition of a structure or object at a tile. */
export function planDemolish(s: GameState, x: number, y: number): string | null {
  if (!inBounds(s, x, y)) return '범위 밖';
  const existing = jobAt(s, x, y); if (existing) { cancelJob(s, existing); return null; }
  const i = y * s.w + x;
  if (s.struct[i] === S_NONE && s.objAt[i] < 0) return null;
  const job: Job = { id: s.nextId++, kind: 'demolish', x, y, struct: s.struct[i], obj: null, objId: s.objAt[i], progress: 0, total: DEMOLISH_TIME, cost: 0, workerId: -1, unreachable: false, retryT: 0 };
  s.jobs.push(job); s.cache.jobAt[i] = job.id; return null;
}
/** Complete a job: apply the change to the grid. */
export function completeJob(s: GameState, job: Job): void {
  const i = job.y * s.w + job.x;
  if (job.kind === 'build') {
    if (job.struct) { s.struct[i] = job.struct; if (s.zone[i]) s.zone[i] = 0; pushEntitiesOut(s, job.x, job.y); markDirty(s); }
    else if (job.objId >= 0) { const ob = s.cache.objIndex.get(job.objId); if (ob) ob.built = true; s.cache.dirtyRooms = true; }
  } else {
    let refund = 0;
    if (job.struct) { const def = STRUCT_BY_INDEX[job.struct]; refund += def ? def.cost * DEMOLISH_REFUND : 0; s.struct[i] = S_NONE; markDirty(s); }
    if (job.objId >= 0) { const ob = s.cache.objIndex.get(job.objId); if (ob) { refund += OBJ_BY_ID[ob.type].cost * (ob.built ? DEMOLISH_REFUND : 1); removeObjectNow(s, ob.id); } s.cache.dirtyRooms = true; }
    s.money += Math.round(refund);
  }
  const k = s.jobs.indexOf(job); if (k >= 0) s.jobs.splice(k, 1); s.cache.jobAt[i] = -1;
}
function pushEntitiesOut(s: GameState, x: number, y: number): void {
  const all: { x: number; y: number; path: any; target: any }[] = [...s.prisoners, ...s.staff];
  for (const e of all) {
    if (Math.floor(e.x) !== x || Math.floor(e.y) !== y) continue;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    for (const [dx, dy] of nb) { const nx = x + dx, ny = y + dy; if (inBounds(s, nx, ny) && s.struct[ny * s.w + nx] === S_NONE) { e.x = nx + 0.5; e.y = ny + 0.5; e.path = null; e.target = null; break; } }
  }
}
export function removeObjectNow(s: GameState, id: number): void {
  const ob = s.cache.objIndex.get(id); if (!ob) return;
  const k = s.objects.indexOf(ob); if (k >= 0) s.objects.splice(k, 1); s.cache.objIndex.delete(id);
  if (s.objAt[ob.y * s.w + ob.x] === id) s.objAt[ob.y * s.w + ob.x] = -1;
  for (const p of s.prisoners) { if (p.bedId === id) p.bedId = -1; if (p.useObj === id) p.useObj = -1; }
  for (const st of s.staff) if (st.useObj === id) st.useObj = -1;
  s.cache.dirtyRooms = true;
}

/** Paint a zone on a tile (instant, free). zone 0 clears. */
export function setZone(s: GameState, x: number, y: number, zone: number): boolean {
  if (!inBounds(s, x, y) || isBorder(s, x, y)) return false;
  const i = y * s.w + x; if (s.terrain[i] === T_ROAD) return false;
  if (s.struct[i] !== S_NONE) return false;
  if (s.zone[i] === zone) return false;
  s.zone[i] = zone; s.cache.dirtyRooms = true; return true;
}

// ---------- Instant variants (templates / tests) ----------
export function buildStructNow(s: GameState, x: number, y: number, type: StructType): void { if (!inBounds(s, x, y) || isBorder(s, x, y)) return; const i = y * s.w + x; if (s.objAt[i] >= 0) return; s.struct[i] = STRUCT_INDEX[type]; s.zone[i] = 0; markDirty(s); }
export function placeObjectNow(s: GameState, x: number, y: number, type: ObjType): GameObject | null {
  if (!inBounds(s, x, y)) return null; const i = y * s.w + x; if (s.struct[i] !== S_NONE || s.objAt[i] >= 0) return null;
  const ob: GameObject = { id: s.nextId++, type, x, y, users: 0, owner: -1, built: true }; s.objects.push(ob); s.cache.objIndex.set(ob.id, ob); s.objAt[i] = ob.id; s.cache.dirtyRooms = true; return ob;
}
export function rectStruct(s: GameState, x0: number, y0: number, x1: number, y1: number, type: StructType, hollow: boolean, now: boolean): number {
  let n = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (hollow && x !== x0 && x !== x1 && y !== y0 && y !== y1) continue;
    if (now) { buildStructNow(s, x, y, type); n++; } else if (!planStruct(s, x, y, type)) n++;
  }
  return n;
}
export function rectZone(s: GameState, x0: number, y0: number, x1: number, y1: number, zone: number): number { let n = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (setZone(s, x, y, zone)) n++; return n; }
export const zoneIndex = (id: string): number => Math.max(0, ROOMS.findIndex(r => r.id === id));

// ---------- Staff ----------
export function staffName(rng: Rng): string { return rng.pick(SURNAMES) + rng.pick(GIVEN); }
export function hireStaff(s: GameState, type: StaffType, rng: Rng, free = false, temp = false): Staff | null {
  const def = STAFF_BY_ID[type];
  if (!free) { if (s.money < def.hireCost) return null; s.money -= def.hireCost; s.finance.today.build += def.hireCost; }
  const st: Staff = { id: s.nextId++, type, name: staffName(rng), x: s.entry.x + 0.5, y: s.entry.y + 0.5 + rng.range(-1, 1), hp: def.hp, maxHp: def.hp, state: 'idle', stateT: 0, path: null, pathI: 0, target: null, jobId: -1, fightId: -1, chaseId: -1, useObj: -1, thinkT: rng.range(0, 1), temp, leaveAt: 0, patrolT: 0 };
  if (temp) { st.hp = st.maxHp = 220; }
  s.staff.push(st); s.cache.staffIndex.set(st.id, st); return st;
}
export function fireStaff(s: GameState, id: number): boolean {
  const st = s.cache.staffIndex.get(id); if (!st) return false;
  if (st.jobId >= 0) { const j = s.jobs.find(j => j.id === st.jobId); if (j) j.workerId = -1; }
  releaseStaffObj(s, st);
  st.state = 'leave'; st.jobId = -1; st.fightId = -1; st.chaseId = -1; st.path = null; st.target = null; return true;
}
export function releaseStaffObj(s: GameState, st: Staff): void { if (st.useObj >= 0) { const ob = s.cache.objIndex.get(st.useObj); if (ob) ob.users = Math.max(0, ob.users - 1); st.useObj = -1; } }
export function removeStaffNow(s: GameState, st: Staff): void { const k = s.staff.indexOf(st); if (k >= 0) s.staff.splice(k, 1); s.cache.staffIndex.delete(st.id); for (const f of s.fights) { const i = f.guards.indexOf(st.id); if (i >= 0) f.guards.splice(i, 1); } }
