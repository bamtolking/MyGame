// Fixed-step simulation entry point and player actions.
import type { GameState } from './types';
import { Rng } from './rng';
import { HOUR_SECONDS } from '../data/regime';
import type { Activity } from '../data/regime';
import type { StructType } from '../data/structures';
import type { ObjType } from '../data/objects';
import type { StaffType } from '../data/staff';
import type { SecurityLevel } from '../data/economy';
import { BANKRUPT_LIMIT } from '../data/economy';
import { STAFF_BY_ID } from '../data/staff';
import { refresh, planStruct, planObject, planDemolish, setZone, hireStaff, fireStaff, log, jobAt, cancelJob } from './build';
import { updatePrisoner, hourOf, dayOf } from './prisoner';
import { updateStaff } from './staff';
import { updateFights, checkRiot } from './incidents';
import { hourly, daily, doIntake, callRiotSquad } from './economy';
import { checkObjectives } from './objectives';

export const DT = 0.05;

export type Action =
  | { type: 'build'; struct: StructType; x0: number; y0: number; x1: number; y1: number; hollow?: boolean }
  | { type: 'object'; obj: ObjType; x0: number; y0: number; x1: number; y1: number }
  | { type: 'zone'; zone: number; x0: number; y0: number; x1: number; y1: number }
  | { type: 'demolish'; x0: number; y0: number; x1: number; y1: number }
  | { type: 'cancel'; x: number; y: number }
  | { type: 'hire'; staff: StaffType } | { type: 'fire'; id: number }
  | { type: 'intake'; n: number } | { type: 'autoIntake'; on: boolean } | { type: 'mix'; sec: SecurityLevel; on: boolean }
  | { type: 'regime'; hour: number; act: Activity } | { type: 'regimeAll'; regime: Activity[] }
  | { type: 'lockdown'; on: boolean } | { type: 'riotSquad' };

export function getRng(s: GameState): Rng { const r = new Rng(1); r.setState(s.rngState); return r; }
function norm(a: { x0: number; y0: number; x1: number; y1: number }): [number, number, number, number] { return [Math.min(a.x0, a.x1), Math.min(a.y0, a.y1), Math.max(a.x0, a.x1), Math.max(a.y0, a.y1)]; }

export function dispatch(s: GameState, a: Action): { ok: boolean; msg?: string; n?: number } {
  const rng = getRng(s);
  try {
    switch (a.type) {
      case 'build': {
        const [x0, y0, x1, y1] = norm(a); const w = x1 - x0 + 1, h = y1 - y0 + 1;
        const hollow = a.hollow ?? ((a.struct === 'wall' || a.struct === 'fence') && w >= 3 && h >= 3);
        let n = 0, lastErr: string | null = null;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          if (hollow && x !== x0 && x !== x1 && y !== y0 && y !== y1) continue;
          const err = planStruct(s, x, y, a.struct); if (err) { lastErr = err; if (err === '자금 부족') { y = y1 + 1; break; } } else n++;
        }
        return n ? { ok: true, n, msg: lastErr === '자금 부족' ? `${n}칸 계획 (자금 부족으로 중단)` : undefined } : { ok: false, msg: lastErr || '지을 곳이 없음' };
      }
      case 'object': {
        const [x0, y0, x1, y1] = norm(a); let n = 0, lastErr: string | null = null;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const err = planObject(s, x, y, a.obj); if (err) { lastErr = err; if (err === '자금 부족') { y = y1 + 1; break; } } else n++; }
        return n ? { ok: true, n, msg: lastErr === '자금 부족' ? `${n}개 계획 (자금 부족으로 중단)` : undefined } : { ok: false, msg: lastErr || '놓을 곳이 없음' };
      }
      case 'zone': { const [x0, y0, x1, y1] = norm(a); let n = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (setZone(s, x, y, a.zone)) n++; refresh(s); return { ok: n > 0, n, msg: n ? undefined : '구역을 지정할 칸이 없음 (벽·도로·가장자리 제외)' }; }
      case 'demolish': { const [x0, y0, x1, y1] = norm(a); let n = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const before = s.jobs.length; const err = planDemolish(s, x, y); if (!err && s.jobs.length !== before) n++; } return { ok: n > 0, n, msg: n ? undefined : '철거할 것이 없음' }; }
      case 'cancel': { const j = jobAt(s, a.x, a.y); if (!j) return { ok: false, msg: '작업 없음' }; cancelJob(s, j); return { ok: true }; }
      case 'hire': { const st = hireStaff(s, a.staff, rng); if (!st) return { ok: false, msg: `자금 부족 ($${STAFF_BY_ID[a.staff].hireCost} 필요)` }; log(s, `${STAFF_BY_ID[a.staff].name} ${st.name} 고용`, 'info', st.x, st.y); return { ok: true }; }
      case 'fire': { const st = s.cache.staffIndex.get(a.id); if (!st) return { ok: false, msg: '직원 없음' }; fireStaff(s, a.id); log(s, `${STAFF_BY_ID[st.type].name} ${st.name} 해고`, 'info'); return { ok: true }; }
      case 'intake': { const n = doIntake(s, rng, a.n, true); return { ok: n > 0, n, msg: n ? undefined : '수용 공간 없음' }; }
      case 'autoIntake': s.autoIntake = a.on; return { ok: true };
      case 'mix': { if (!s.unlocked.includes(a.sec)) return { ok: false, msg: '아직 해금되지 않음' }; s.intakeMix[a.sec] = a.on; return { ok: true }; }
      case 'regime': s.regime[a.hour] = a.act; return { ok: true };
      case 'regimeAll': s.regime = [...a.regime]; return { ok: true };
      case 'lockdown': s.lockdown = a.on; log(s, a.on ? '🚨 비상 봉쇄 발령: 모든 수감자 감방 복귀, 문 잠금' : '봉쇄 해제', a.on ? 'warn' : 'info'); return { ok: true };
      case 'riotSquad': { const err = callRiotSquad(s, rng); return err ? { ok: false, msg: err } : { ok: true }; }
    }
  } finally { s.rngState = rng.getState(); }
  return { ok: false, msg: '알 수 없는 행동' };
}

export function step(s: GameState, dt = DT): void {
  if (s.phase === 'bankrupt' || s.phase === 'fired') return;
  const rng = getRng(s);
  s.time += dt;
  refresh(s);
  const day = dayOf(s), hour = hourOf(s);
  if (day !== s.lastDay) { s.lastDay = day; daily(s, rng); }
  if (hour !== s.lastHour) { s.lastHour = hour; hourly(s, rng); }
  for (const j of s.jobs) if (j.unreachable && j.retryT > 0) j.retryT -= dt;
  for (const p of [...s.prisoners]) if (s.cache.prisonerIndex.has(p.id)) updatePrisoner(s, p, rng, dt);
  for (const st of [...s.staff]) if (s.cache.staffIndex.has(st.id)) updateStaff(s, st, rng, dt);
  updateFights(s, rng, dt);
  s.cache.riotCheckT += dt; if (s.cache.riotCheckT >= 5) { s.cache.riotCheckT = 0; checkRiot(s, rng); }
  s.cache.objectiveT += dt; if (s.cache.objectiveT >= 2) { s.cache.objectiveT = 0; checkObjectives(s); }
  if (s.money < BANKRUPT_LIMIT) { s.phase = 'bankrupt'; log(s, `💸 파산: 부채가 $${-BANKRUPT_LIMIT}를 넘었습니다.`, 'bad'); s.events.push({ type: 'gameover', data: 'bankrupt' }); }
  else if (s.reputation <= 0) { s.phase = 'fired'; log(s, '📉 평판 0: 교도소장에서 해임되었습니다.', 'bad'); s.events.push({ type: 'gameover', data: 'fired' }); }
  refresh(s);
  s.rngState = rng.getState();
}
/** Run many steps (tests / fast forward). */
export function run(s: GameState, seconds: number): void { const n = Math.round(seconds / DT); for (let i = 0; i < n; i++) step(s); }
export const HOUR = HOUR_SECONDS;
