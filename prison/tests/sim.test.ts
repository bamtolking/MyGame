import { describe, it, expect } from 'vitest';
import { newGame, serialize, deserialize } from '../src/sim/state';
import { step, run, dispatch, DT } from '../src/sim/engine';
import { HOUR_SECONDS } from '../src/data/regime';
import { validRooms, isInsecure } from '../src/sim/grid';
import { capacity } from '../src/sim/economy';

function summary(s: ReturnType<typeof newGame>) {
  const states: Record<string, number> = {}; for (const p of s.prisoners) states[p.state] = (states[p.state] || 0) + 1;
  const mood = s.prisoners.length ? s.prisoners.reduce((a, p) => a + p.mood, 0) / s.prisoners.length : 0;
  return { day: Math.floor(s.time / HOUR_SECONDS / 24) + 1, hour: Math.floor(s.time / HOUR_SECONDS) % 24, money: Math.round(s.money), prisoners: s.prisoners.length, states, mood: Math.round(mood), meals: Math.round(s.meals), escapes: s.stats.escapes, deaths: s.stats.deaths, fights: s.stats.fights, jobs: s.jobs.length, chapter: s.chapter, rep: s.reputation };
}

describe('quick start prison', () => {
  it('runs 3 days with intake, eating and sleeping, without escapes', () => {
    const s = newGame(7, 'quick');
    expect(validRooms(s, 'holding').length).toBe(1);
    expect(validRooms(s, 'cell').length).toBe(6);
    expect(validRooms(s, 'canteen').length).toBe(1);
    expect(validRooms(s, 'kitchen').length).toBe(1);
    expect(validRooms(s, 'shower').length).toBe(1);
    expect(validRooms(s, 'yard').length).toBe(1);
    // interior is secure
    expect(isInsecure(s, 10, 12)).toBe(false); expect(isInsecure(s, 3, 3)).toBe(true);
    const cap = capacity(s); expect(cap.freeBeds).toBe(6); expect(cap.holding).toBeGreaterThan(0);
    const log: any[] = [];
    for (let h = 0; h < 24 * 3; h++) { run(s, HOUR_SECONDS); if (h % 6 === 0) log.push(summary(s)); }
    console.log(JSON.stringify(log, null, 0));
    console.log(s.log.map(l => `${(l.t / HOUR_SECONDS).toFixed(1)}h ${l.text}`).join('\n'));
    expect(s.prisoners.length).toBeGreaterThanOrEqual(4);
    expect(s.stats.escapes).toBe(0);
    expect(s.stats.deaths).toBe(0);
    // prisoners have eaten: hunger not maxed
    const hungry = s.prisoners.filter(p => p.needs.hunger > 95).length; expect(hungry).toBe(0);
    expect(s.chapter).toBeGreaterThanOrEqual(2);
  });
  it('is deterministic and survives serialization', () => {
    const a = newGame(3, 'quick'); const b = newGame(3, 'quick');
    run(a, HOUR_SECONDS * 30); run(b, HOUR_SECONDS * 30);
    expect(serialize(a)).toBe(serialize(b));
    const c = deserialize(serialize(a)); run(a, HOUR_SECONDS * 6); run(c, HOUR_SECONDS * 6);
    expect(serialize(a)).toBe(serialize(c));
  });
});

describe('empty plot', () => {
  it('workmen build planned walls and a door; the box becomes secure', () => {
    const s = newGame(11, 'empty');
    const r = dispatch(s, { type: 'build', struct: 'wall', x0: 10, y0: 10, x1: 16, y1: 16 }); expect(r.ok).toBe(true); expect(r.n).toBe(24);
    expect(s.jobs.length).toBe(24);
    run(s, 120);
    expect(s.jobs.length).toBe(0);
    expect(isInsecure(s, 12, 12)).toBe(false);
    // door on the wall → insecure again; jail door → secure
    dispatch(s, { type: 'demolish', x0: 10, y0: 13, x1: 10, y1: 13 }); run(s, 30);
    expect(isInsecure(s, 12, 12)).toBe(true);
    dispatch(s, { type: 'build', struct: 'jaildoor', x0: 10, y0: 13, x1: 10, y1: 13 }); run(s, 30);
    expect(isInsecure(s, 12, 12)).toBe(false);
    // zone + objects → valid holding cell
    dispatch(s, { type: 'zone', zone: 2, x0: 11, y0: 11, x1: 15, y1: 15 });
    dispatch(s, { type: 'object', obj: 'toilet', x0: 15, y0: 11, x1: 15, y1: 11 });
    dispatch(s, { type: 'object', obj: 'bench', x0: 11, y0: 15, x1: 13, y1: 15 });
    run(s, 60);
    expect(validRooms(s, 'holding').length).toBe(1);
  });
  it('prisoners with no secure place escape', () => {
    const s = newGame(5, 'empty');
    dispatch(s, { type: 'zone', zone: 2, x0: 10, y0: 10, x1: 15, y1: 15 }); // unenclosed holding zone (invalid)
    dispatch(s, { type: 'hire', staff: 'guard' });
    const r = dispatch(s, { type: 'intake', n: 4 }); expect(r.ok).toBe(false); // no capacity: nothing valid
    // make a valid but insecure holding room? not possible: validity requires security. Force prisoners in via quick map with demolished wall.
    const q = newGame(5, 'quick'); dispatch(q, { type: 'intake', n: 6 }); expect(q.prisoners.length).toBe(6);
    dispatch(q, { type: 'demolish', x0: 6, y0: 10, x1: 6, y1: 12 }); run(q, 60); expect(isInsecure(q, 8, 12)).toBe(true);
    run(q, HOUR_SECONDS * 24 * 2);
    console.log('open prison after 2 days:', summary(q));
    expect(q.stats.escapes).toBeGreaterThan(0);
  });
});
