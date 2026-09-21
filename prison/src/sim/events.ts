// Random daily events: rolling, eligibility and applying the chosen option.
import type { GameState } from './types';
import { EVENTS, EVENT_BY_ID } from '../data/events';
import { HOUR_SECONDS } from '../data/regime';
import { makePrisoner } from './state';
import { assignBeds, startRelease, computeMood, dayOf } from './prisoner';
import { doSearch } from './economy';
import { log, removeStaffNow } from './build';
import type { Rng } from './rng';

function eligible(s: GameState, id: string): boolean {
  const n = s.prisoners.length; const guards = s.staff.filter(x => x.type === 'guard' && !x.temp && x.state !== 'leave').length;
  if (s.recentEvents.includes(id)) return false;
  switch (id) {
    case 'inspection': return n >= 3;
    case 'celebrity': return n >= 4;
    case 'donation': return s.reputation >= 60;
    case 'strike': return guards >= 3;
    case 'storm': return n >= 2;
    case 'foodpoison': return s.policy.meal === 0 && n >= 3;
    case 'contraband': return n >= 3;
    case 'parole': return n >= 5;
    case 'journalist': return s.reputation >= 50 && n >= 3;
    case 'blackout': return n >= 4;
  }
  return false;
}
/** Called hourly: maybe start today's event. */
export function rollEvent(s: GameState, rng: Rng): void {
  const day = dayOf(s);
  if (s.pendingEvent || day < 2 || s.lastEventDay >= day) return;
  const pool = EVENTS.filter(e => eligible(s, e.id));
  s.lastEventDay = day; s.eventHour = 9 + rng.int(9);
  if (!pool.length || rng.chance(0.25)) return; // quiet day
  const ev = rng.pick(pool);
  s.pendingEvent = { id: ev.id, day }; s.recentEvents.push(ev.id); if (s.recentEvents.length > 3) s.recentEvents.shift();
  log(s, `${ev.icon} 사건: ${ev.title}`, 'warn'); s.events.push({ type: 'event', data: ev.id });
}
/** Apply the player's choice. Returns a result message. */
export function applyChoice(s: GameState, rng: Rng, idx: number): string {
  const pe = s.pendingEvent; if (!pe) return '진행 중인 사건이 없습니다';
  const ev = EVENT_BY_ID[pe.id]; s.pendingEvent = null; if (!ev) return '';
  const ps = s.prisoners; const day = dayOf(s);
  const avgNeed = (k: 'hygiene' | 'freedom') => ps.length ? ps.reduce((a, p) => a + p.needs[k], 0) / ps.length : 0;
  const avgMood = () => { if (!ps.length) return 0; let sum = 0; for (const p of ps) { computeMood(p); sum += p.mood; } return sum / ps.length; };
  let msg = '';
  switch (ev.id) {
    case 'inspection':
      if (idx === 0) { if (avgNeed('hygiene') <= 50) { s.money += 500; s.finance.today.bonus += 500; s.reputation = Math.min(100, s.reputation + 3); msg = '검열 통과! 보조금 +$500, 평판 +3'; } else { s.money -= 600; s.finance.today.fines += 600; s.reputation = Math.max(0, s.reputation - 3); msg = '위생 불량 지적. 벌금 $600, 평판 -3'; } }
      else { s.money -= 400; s.finance.today.build += 400; if (rng.chance(0.3)) { s.money -= 1500; s.finance.today.fines += 1500; s.reputation = Math.max(0, s.reputation - 8); msg = '접대가 적발되었습니다! 벌금 $1,500, 평판 -8'; } else msg = '검열이 형식적으로 끝났습니다 (-$400)'; }
      break;
    case 'celebrity':
      if (idx === 0) { s.money += 2500; s.finance.today.bonus += 2500; const p = makePrisoner(s, rng, 'max', ['leader', 'violent', 'escapist']); p.sentence = 30; s.prisoners.push(p); s.cache.prisonerIndex.set(p.id, p); assignBeds(s); s.stats.intake++; msg = `+$2,500. 조직 두목 ${p.name} 도착 — 교도관을 붙이세요.`; s.events.push({ type: 'intake', x: s.entry.x, y: s.entry.y, data: 1 }); }
      else msg = '이송을 거절했습니다';
      break;
    case 'donation': s.money += 1500; s.finance.today.bonus += 1500; msg = '후원금 +$1,500'; break;
    case 'strike':
      if (idx === 0) { s.wageMul = Math.round((s.wageMul + 0.15) * 100) / 100; msg = `급여 인상 수락. 이제 급여 ×${s.wageMul.toFixed(2)}`; }
      else { const gs = s.staff.filter(x => x.type === 'guard' && !x.temp && x.state !== 'leave').slice(0, 2); for (const g of gs) removeStaffNow(s, g); for (const p of ps) p.needs.safety = Math.min(100, p.needs.safety + 10); msg = `교도관 ${gs.length}명이 사직했습니다. 수감자 불안 +10`; }
      break;
    case 'storm':
      if (idx === 0) { s.yardClosedDay = day; msg = '오늘 운동장을 폐쇄했습니다 (운동 시간은 자유 시간으로)'; }
      else { for (const p of ps) { p.needs.hygiene = Math.max(0, p.needs.hygiene - 15); p.needs.recreation = Math.max(0, p.needs.recreation - 10); if (rng.chance(0.05)) p.hp = Math.max(10, p.hp - 20); } msg = '빗속 운동장 운영: 위생 +15, 여가 +10'; }
      break;
    case 'foodpoison':
      if (idx === 0) { let n = 0; for (const p of ps) if (rng.chance(0.2)) { p.hp = Math.min(p.hp, 18); p.injured = true; n++; } s.meals = 0; msg = `수감자 ${n}명 경미한 부상 → 의무실 필요. 식사 재고 폐기`; }
      else { for (const p of ps) { p.needs.hunger = Math.min(100, p.needs.hunger + 30); p.needs.safety = Math.min(100, p.needs.safety + 15); } s.reputation = Math.max(0, s.reputation - 2); msg = '방치: 수감자 기분 저하, 평판 -2'; }
      break;
    case 'contraband':
      if (idx === 0) { const found = doSearch(s, rng, true, true); msg = found > 0 ? `수색 결과 터널 ${found}개 발견!` : '수색 결과 이상 없음'; }
      else { for (let i = 0; i < 2 && ps.length; i++) { const p = rng.pick(ps); p.needs.freedom = Math.min(100, p.needs.freedom + 30); } msg = '제보를 무시했습니다. 일부 수감자가 대담해집니다'; }
      break;
    case 'parole':
      if (idx === 0) { const best = [...ps].filter(p => p.intent !== 'release' && p.state !== 'fight' && p.state !== 'escape' && p.state !== 'subdued').sort((a, b) => b.mood - a.mood).slice(0, 2); for (const p of best) startRelease(s, p); s.reputation = Math.min(100, s.reputation + 2); msg = `${best.map(p => p.name).join(', ')} 가석방. 평판 +2`; }
      else msg = '가석방을 거절했습니다';
      break;
    case 'journalist':
      if (idx === 0) { const m = avgMood(); if (m >= 60) { s.reputation = Math.min(100, s.reputation + 5); msg = `호의적인 기사! 평판 +5 (평균 기분 ${Math.round(m)})`; } else { s.reputation = Math.max(0, s.reputation - 4); msg = `비판 기사. 평판 -4 (평균 기분 ${Math.round(m)})`; } }
      else msg = '취재를 거절했습니다';
      break;
    case 'blackout':
      if (idx === 0) { s.money -= 800; s.finance.today.build += 800; msg = '비상 발전기 가동 (-$800)'; }
      else { s.blackoutDay = day; for (const p of ps) p.needs.safety = Math.min(100, p.needs.safety + 10); msg = '어둠 속의 밤… 땅 파는 소리가 커집니다'; }
      break;
  }
  log(s, `${ev.icon} ${ev.title}: ${msg}`, 'info');
  void HOUR_SECONDS;
  return msg;
}
