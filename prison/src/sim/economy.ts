// Hourly/daily bookkeeping, intake, release, riot squad.
import type { GameState, Prisoner } from './types';
import { HOUR_SECONDS } from '../data/regime';
import { SECURITY_INFO, OFFICE_GRANT_BONUS, INTAKE_HOUR, MAX_INTAKE_PER_DAY, RIOT_SQUAD_COST, RIOT_SQUAD_SIZE, RIOT_SQUAD_HOURS, type SecurityLevel } from '../data/economy';
import { STAFF_BY_ID } from '../data/staff';
import { validRooms } from './grid';
import { makePrisoner, emptyFinance } from './state';
import { assignBeds, startRelease, dayOf, hourOf, computeMood } from './prisoner';
import { hireStaff, log } from './build';
import type { Rng } from './rng';

export function capacity(s: GameState): { freeBeds: number; holding: number; total: number } {
  let freeBeds = 0; for (const r of validRooms(s, 'cell')) for (const id of r.objs) { const ob = s.cache.objIndex.get(id)!; if (ob.type === 'bed' && ob.owner < 0) freeBeds++; }
  let holdingCap = 0; for (const r of validRooms(s, 'holding')) holdingCap += Math.floor(r.tiles.length / 2);
  const bedless = s.prisoners.filter(p => p.bedId < 0).length;
  const holding = Math.max(0, holdingCap - bedless);
  return { freeBeds, holding, total: freeBeds + holding };
}
export function totalCapacity(s: GameState): number {
  let beds = 0; for (const r of validRooms(s, 'cell')) for (const id of r.objs) if (s.cache.objIndex.get(id)!.type === 'bed') beds++;
  let holdingCap = 0; for (const r of validRooms(s, 'holding')) holdingCap += Math.floor(r.tiles.length / 2);
  return beds + holdingCap;
}
function pickSec(s: GameState, rng: Rng): SecurityLevel {
  const pool = (['min', 'med', 'max'] as SecurityLevel[]).filter(k => s.intakeMix[k] && s.unlocked.includes(k));
  return pool.length ? rng.pick(pool) : 'min';
}
/** Bring `n` prisoners (limited by capacity). Returns number admitted. */
export function doIntake(s: GameState, rng: Rng, n: number, manual: boolean): number {
  assignBeds(s);
  const cap = capacity(s); const k = Math.max(0, Math.min(n, cap.total));
  if (k === 0) { log(s, manual ? '⚠ 수용 공간이 없습니다 (유효한 감방 침대 또는 대기실 필요)' : '⚠ 수용 공간이 없어 오늘 수감 접수를 보류했습니다', 'warn'); return 0; }
  const made: Prisoner[] = [];
  for (let i = 0; i < k; i++) { const p = makePrisoner(s, rng, pickSec(s, rng)); s.prisoners.push(p); s.cache.prisonerIndex.set(p.id, p); made.push(p); }
  assignBeds(s); s.stats.intake += k;
  log(s, `🚌 수감자 ${k}명 도착 (${made.map(p => SECURITY_INFO[p.sec].name.slice(0, 2)).join(', ')})`, 'info', s.entry.x, s.entry.y);
  s.events.push({ type: 'intake', x: s.entry.x, y: s.entry.y, data: k });
  return k;
}
export function callRiotSquad(s: GameState, rng: Rng): string | null {
  if (s.money < RIOT_SQUAD_COST) return '자금 부족';
  s.money -= RIOT_SQUAD_COST; s.finance.today.build += RIOT_SQUAD_COST;
  for (let i = 0; i < RIOT_SQUAD_SIZE; i++) { const st = hireStaff(s, 'guard', rng, true, true); if (st) st.leaveAt = s.time + RIOT_SQUAD_HOURS * HOUR_SECONDS; }
  s.riotSquadUntil = s.time + RIOT_SQUAD_HOURS * HOUR_SECONDS;
  log(s, `🚨 진압대 ${RIOT_SQUAD_SIZE}명 도착 (24시간 주둔, $${RIOT_SQUAD_COST})`, 'info', s.entry.x, s.entry.y);
  return null;
}

export function hourly(s: GameState, rng: Rng): void {
  const hour = hourOf(s), day = dayOf(s);
  s.mealCap = Math.max(20, s.prisoners.length * 3);
  assignBeds(s);
  // mood sample
  if (s.prisoners.length) { let sum = 0; for (const p of s.prisoners) { computeMood(p); sum += p.mood; } s.stats.moodSamples.push(sum / s.prisoners.length); }
  // releases
  if (hour >= 8 && hour <= 18) for (const p of [...s.prisoners]) {
    if (day >= p.arrivedDay + p.sentence && p.intent !== 'release' && p.state !== 'fight' && p.state !== 'subdued' && p.state !== 'escape' && p.state !== 'heal') startRelease(s, p);
  }
  // intake
  if (hour === INTAKE_HOUR && s.autoIntake && s.lastIntakeDay < day) { s.lastIntakeDay = day; doIntake(s, rng, Math.min(MAX_INTAKE_PER_DAY, 2 + Math.floor(day / 2)), false); }
  // warnings
  if (s.prisoners.length && s.meals < 1 && (hour === 7 || hour === 12 || hour === 18)) log(s, '⚠ 식사 재고가 없습니다. 주방(조리대+냉장고)과 요리사를 확인하세요.', 'warn');
}
export function daily(s: GameState, rng: Rng): void {
  const day = dayOf(s);
  const office = validRooms(s, 'office').length > 0;
  let grant = 0; for (const p of s.prisoners) grant += SECURITY_INFO[p.sec].grant;
  if (office) grant = Math.round(grant * (1 + OFFICE_GRANT_BONUS));
  let wages = 0; for (const st of s.staff) if (!st.temp && st.state !== 'leave') wages += STAFF_BY_ID[st.type].wage;
  s.money += grant - wages;
  const f = s.finance.today; f.grant = grant; f.wages = wages;
  s.finance.history.push({ ...f }); if (s.finance.history.length > 14) s.finance.history.shift();
  s.finance.today = emptyFinance(day);
  if (s.stats.todayIncidents === 0) s.stats.daysNoIncident++; else s.stats.daysNoIncident = 0;
  s.stats.todayIncidents = 0;
  const ms = s.stats.moodSamples; const avg = ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : 0;
  if (ms.length && avg >= 55) s.stats.moodDays++; else s.stats.moodDays = 0;
  s.stats.moodSamples = [];
  const net = grant - wages - f.food - f.build - f.fines + f.work + f.bonus;
  log(s, `📅 ${day}일차 시작. 어제: 보조금 +$${grant}${office ? '(사무실 +10%)' : ''}, 급여 -$${wages}, 식재료 -$${Math.round(f.food)}, 건설 -$${f.build}, 노동 +$${Math.round(f.work)}, 순 ${net >= 0 ? '+' : ''}$${Math.round(net)}`, net >= 0 ? 'good' : 'warn');
  s.events.push({ type: 'day', data: day });
  void rng;
}
