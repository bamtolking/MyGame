// Hourly/daily bookkeeping, intake, release, riot squad.
import type { GameState, Prisoner } from './types';
import { HOUR_SECONDS } from '../data/regime';
import { SECURITY_INFO, OFFICE_GRANT_BONUS, INTAKE_HOUR, MAX_INTAKE_PER_DAY, RIOT_SQUAD_COST, RIOT_SQUAD_SIZE, RIOT_SQUAD_HOURS, DIFFICULTY, SEARCH_COOLDOWN_HOURS, type SecurityLevel } from '../data/economy';
import { SEARCH_OPTIONS, PUNISH_OPTIONS } from '../data/policy';
import { rollEvent } from './events';
import { roomOf } from './grid';
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
  if (!pool.length) return 'min';
  if (pool.includes('max') && pool.length > 1) { if (rng.chance((DIFFICULTY[s.difficulty] || DIFFICULTY.normal).maxSecChance)) return 'max'; return rng.pick(pool.filter(k => k !== 'max')); }
  return rng.pick(pool);
}

// ---------- Tunnels & searches ----------
/** Manhattan distance from a tile to the nearest insecure tile (how far a tunnel must go). */
function distToOutside(s: GameState, x: number, y: number): number {
  let best = 99; const ins = s.cache.insecure;
  for (let yy = 0; yy < s.h; yy++) for (let xx = 0; xx < s.w; xx++) { if (!ins[yy * s.w + xx]) continue; const d = Math.abs(xx - x) + Math.abs(yy - y); if (d < best) best = d; }
  return best;
}
/** Hourly tunnel digging by escapists sleeping in their own cell. */
export function updateTunnels(s: GameState, rng: Rng): void {
  const hour = hourOf(s), day = dayOf(s); const night = s.regime[hour] === 'sleep' || s.regime[hour] === 'lockup';
  for (const p of [...s.prisoners]) {
    if (p.bedId < 0) continue;
    const bed = s.cache.objIndex.get(p.bedId); if (!bed) continue;
    const room = roomOf(s, bed.x, bed.y); if (!room || !room.valid) continue;
    const here = roomOf(s, Math.floor(p.x), Math.floor(p.y)); if (here !== room) continue;
    if (!night || (p.state !== 'sleep' && p.state !== 'rest' && p.state !== 'wait')) continue;
    if (!(p.escapist || p.needs.freedom > 70)) continue;
    const dist = distToOutside(s, bed.x, bed.y); const nights = 2 + dist / 4;
    let rate = 1 / (8 * nights); if (s.blackoutDay === day || s.blackoutDay === day - 1 && hour < 6) rate *= 3;
    p.tunnel += rate;
    if (p.tunnel >= 1) {
      s.stats.escapes++; s.stats.todayIncidents++; s.money -= 1500; s.finance.today.fines += 1500; s.reputation = Math.max(0, s.reputation - 8);
      log(s, `🕳 ${p.name}이(가) 감방 바닥의 터널로 탈주했습니다! 벌금 $1,500, 평판 -8. (감방 수색 정책을 확인하세요)`, 'bad', p.x, p.y);
      s.events.push({ type: 'escaped', x: p.x, y: p.y });
      const k = s.prisoners.indexOf(p); if (k >= 0) s.prisoners.splice(k, 1); s.cache.prisonerIndex.delete(p.id); if (bed.owner === p.id) bed.owner = -1;
    }
  }
  // guards patrolling near a cell may notice digging
  for (const g of s.staff) { if (g.type !== 'guard' || g.state === 'injured' || g.state === 'leave') continue; for (const p of s.prisoners) { if (p.tunnel < 0.4) continue; const bed = s.cache.objIndex.get(p.bedId); if (!bed) continue; if (Math.abs(bed.x + 0.5 - g.x) < 3 && Math.abs(bed.y + 0.5 - g.y) < 3 && rng.chance(0.08)) foundTunnel(s, p, '순찰 중'); } }
  // night-time hint
  if (hour === 2 && s.prisoners.some(p => p.tunnel > 0.25) && rng.chance(0.4)) log(s, '🕳 밤에 어딘가에서 땅 파는 소리가 들렸습니다… (정책 → 감방 수색 권장)', 'warn');
}
function foundTunnel(s: GameState, p: { name: string; tunnel: number; punishedUntil: number; calmT: number; x: number; y: number }, how: string): void {
  p.tunnel = 0; const hours = (PUNISH_OPTIONS[s.policy.punish] || PUNISH_OPTIONS[1]).hours * 2;
  p.punishedUntil = s.time + hours * HOUR_SECONDS; p.calmT = hours * HOUR_SECONDS; s.stats.tunnelsFound++;
  log(s, `🕳 ${how} ${p.name}의 감방에서 터널을 발견했습니다! ${hours}시간 징벌`, 'good', p.x, p.y); s.events.push({ type: 'tunnel', x: p.x, y: p.y });
}
/** Search all cells. Returns tunnels found, or -1 if not possible. */
export function doSearch(s: GameState, rng: Rng, manual: boolean, ignoreCooldown = false): number {
  const guards = s.staff.filter(x => x.type === 'guard' && x.state !== 'injured' && x.state !== 'leave').length;
  if (guards === 0) { log(s, '🔦 수색할 교도관이 없습니다', 'warn'); return -1; }
  if (manual && !ignoreCooldown && s.time - s.lastSearch < SEARCH_COOLDOWN_HOURS * HOUR_SECONDS) { log(s, `🔦 수색은 ${SEARCH_COOLDOWN_HOURS}시간마다 가능합니다`, 'warn'); return -1; }
  s.lastSearch = s.time; s.stats.searches++;
  const prob = Math.min(0.9, 0.45 + 0.1 * guards); let found = 0;
  for (const p of s.prisoners) { if (p.tunnel > 0.05 && rng.chance(prob)) { foundTunnel(s, p, '수색 중'); found++; } p.needs.freedom = Math.min(100, p.needs.freedom + 5); }
  log(s, found ? `🔦 감방 수색 완료: 터널 ${found}개 발견` : '🔦 감방 수색 완료: 이상 없음 (수감자 자유 욕구 +5)', found ? 'good' : 'info');
  return found;
}
/** Daily report grade S/A/B/C/D from mood, incidents, staffing and food. */
export function computeGrade(s: GameState, mood: number, incidents: number, fights: number): string {
  if (!s.prisoners.length) return '-';
  const guards = s.staff.filter(x => x.type === 'guard' && x.state !== 'leave').length;
  let score = mood; score -= incidents * 20 + fights * 5; if (guards * 5 < s.prisoners.length) score -= 10; if (s.meals < 1) score -= 10;
  if (s.prisoners.filter(p => p.bedId < 0).length > s.prisoners.length / 2) score -= 8;
  return score >= 85 ? 'S' : score >= 70 ? 'A' : score >= 55 ? 'B' : score >= 40 ? 'C' : 'D';
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
  // tunnels, scheduled searches, events
  updateTunnels(s, rng);
  if ((SEARCH_OPTIONS[s.policy.search] || SEARCH_OPTIONS[0]).times.includes(hour) && s.prisoners.length) doSearch(s, rng, false);
  if (hour === s.eventHour) rollEvent(s, rng);
  // warnings
  if (s.prisoners.length && s.meals < 1 && (hour === 7 || hour === 12 || hour === 18)) log(s, '⚠ 식사 재고가 없습니다. 주방(조리대+냉장고)과 요리사를 확인하세요.', 'warn');
}
export function daily(s: GameState, rng: Rng): void {
  const day = dayOf(s);
  const office = validRooms(s, 'office').length > 0; const diff = DIFFICULTY[s.difficulty] || DIFFICULTY.normal;
  let grant = 0; for (const p of s.prisoners) grant += SECURITY_INFO[p.sec].grant;
  grant = Math.round(grant * diff.grantMul * (office ? 1 + OFFICE_GRANT_BONUS : 1));
  let wages = 0; for (const st of s.staff) if (!st.temp && st.state !== 'leave') wages += STAFF_BY_ID[st.type].wage;
  wages = Math.round(wages * diff.wageMul * s.wageMul);
  s.money += grant - wages;
  const f = s.finance.today; f.grant = grant; f.wages = wages;
  const msAll = s.stats.moodSamples; const moodAvg = msAll.length ? msAll.reduce((a, b) => a + b, 0) / msAll.length : 0;
  f.mood = Math.round(moodAvg); f.incidents = s.stats.todayIncidents; f.grade = computeGrade(s, moodAvg, s.stats.todayIncidents, s.stats.todayFights);
  if (f.grade === 'S' || f.grade === 'A') s.reputation = Math.min(100, s.reputation + (f.grade === 'S' ? 2 : 1)); else if (f.grade === 'D') s.reputation = Math.max(0, s.reputation - 1);
  if (f.grade !== '-' && (s.stats.bestGrade === '' || f.grade < s.stats.bestGrade)) s.stats.bestGrade = f.grade;
  s.stats.todayFights = 0;
  for (const p of s.prisoners) if (p.strikes > 0) p.strikes--;
  s.finance.history.push({ ...f }); if (s.finance.history.length > 14) s.finance.history.shift();
  s.finance.today = emptyFinance(day);
  if (s.stats.todayIncidents === 0) s.stats.daysNoIncident++; else s.stats.daysNoIncident = 0;
  s.stats.todayIncidents = 0;
  const ms = s.stats.moodSamples; const avg = ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : 0;
  if (ms.length && avg >= 55) s.stats.moodDays++; else s.stats.moodDays = 0;
  s.stats.moodSamples = [];
  const net = grant - wages - f.food - f.build - f.fines + f.work + f.bonus;
  log(s, `📅 ${day}일차 시작. 어제 성적 ${f.grade}: 보조금 +$${grant}${office ? '(사무실 +10%)' : ''}, 급여 -$${wages}, 식재료 -$${Math.round(f.food)}, 건설 -$${f.build}, 노동 +$${Math.round(f.work)}, 순 ${net >= 0 ? '+' : ''}$${Math.round(net)}`, net >= 0 ? 'good' : 'warn');
  s.events.push({ type: 'day', data: { day, grade: f.grade, net: Math.round(net), mood: f.mood, incidents: f.incidents } });
  void rng;
}
