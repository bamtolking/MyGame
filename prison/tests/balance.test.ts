import { describe, it, expect } from 'vitest';
import { runBot } from './bot';
import { newGame } from '../src/sim/state';
import { run, dispatch } from '../src/sim/engine';
import { HOUR_SECONDS } from '../src/data/regime';

describe('bot builds a prison from the empty plot', () => {
  it('reaches chapter 3+ within 8 days on 3 seeds without bankruptcy or mass escapes', () => {
    const results = [];
    for (const seed of [1, 2, 3]) { const { r, trace } = runBot(seed, 8, { welfare: true }); console.log(`seed ${seed}\n` + trace.join('\n')); results.push(r); }
    console.log(JSON.stringify(results));
    for (const r of results) { expect(r.phase).not.toBe('bankrupt'); expect(r.phase).not.toBe('fired'); expect(r.chapter).toBeGreaterThanOrEqual(3); expect(r.escapes).toBeLessThanOrEqual(2); expect(r.prisoners).toBeGreaterThanOrEqual(8); }
  });
});
describe('quick start long run', () => {
  it('10 days: population grows, economy positive on average, no riot', () => {
    const s = newGame(21, 'quick'); const trace: string[] = [];
    for (let d = 0; d < 10; d++) {
      run(s, HOUR_SECONDS * 24);
      const guards = s.staff.filter(x => x.type === 'guard').length; if (guards < Math.ceil(s.prisoners.length / 5)) dispatch(s, { type: 'hire', staff: 'guard' });
      const mood = s.prisoners.length ? s.prisoners.reduce((a, p) => a + p.mood, 0) / s.prisoners.length : 0;
      trace.push(`d${d + 2} n=${s.prisoners.length} $${Math.round(s.money)} mood=${mood.toFixed(0)} esc=${s.stats.escapes} dead=${s.stats.deaths} fights=${s.stats.fights} riots=${s.stats.riots} ch=${s.chapter} rep=${s.reputation} released=${s.stats.released}`);
    }
    console.log(trace.join('\n'));
    expect(s.prisoners.length).toBeGreaterThanOrEqual(10);
    expect(s.stats.riots).toBe(0);
    expect(s.money).toBeGreaterThan(20000);
  });
});
