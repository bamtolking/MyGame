import type { GameState } from './types';
import { CHAPTERS, type Cond } from '../data/objectives';
import { validRooms } from './grid';
import { REP_CHAPTER, type SecurityLevel } from '../data/economy';
import { log } from './build';

export interface CondProgress { cond: Cond; cur: number; done: boolean }
export function condValue(s: GameState, c: Cond): number {
  switch (c.id) {
    case 'room_valid': return validRooms(s, c.arg!).length;
    case 'cells_valid': return validRooms(s, 'cell').length;
    case 'staff_count': return s.staff.filter(st => st.type === c.arg && !st.temp && st.state !== 'leave').length;
    case 'prisoners': return s.prisoners.length;
    case 'days_no_escape': return s.stats.daysNoIncident;
    case 'mood_avg_days': return s.stats.moodDays;
    case 'released': return s.stats.released;
    case 'work_income': return Math.floor(s.stats.workIncome);
    case 'objects_built': return s.objects.filter(o => o.built && o.type === c.arg).length;
  }
  return 0;
}
export function chapterProgress(s: GameState): CondProgress[] {
  const ch = CHAPTERS[s.chapter]; if (!ch) return [];
  return ch.conds.map(cond => { const cur = condValue(s, cond); return { cond, cur, done: cur >= cond.n }; });
}
export function checkObjectives(s: GameState): void {
  if (s.chapter >= CHAPTERS.length) return;
  const prog = chapterProgress(s);
  if (!prog.every(p => p.done)) return;
  const ch = CHAPTERS[s.chapter];
  s.money += ch.reward; s.finance.today.bonus += ch.reward; s.reputation = Math.min(100, s.reputation + REP_CHAPTER);
  if (ch.unlock) for (const u of ch.unlock) if (!s.unlocked.includes(u as SecurityLevel)) s.unlocked.push(u as SecurityLevel);
  s.chapter++; s.chapterDoneAt = s.time;
  log(s, `🏆 ${ch.title} 달성! 보상 $${ch.reward}, 평판 +${REP_CHAPTER}${ch.unlock ? ' · 최고 보안 수감자 해금' : ''}`, 'good');
  s.events.push({ type: 'chapter', data: s.chapter - 1 });
  if (s.chapter >= CHAPTERS.length && s.phase === 'play') { s.phase = 'won'; log(s, '🎖 모든 목표 달성 — 명예 교도소장! 계속 운영할 수 있습니다.', 'good'); s.events.push({ type: 'won' }); }
}
