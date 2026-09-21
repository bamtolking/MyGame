import { describe, it, expect } from 'vitest';
import { newGame, serialize, deserialize } from '../src/sim/state';
import { dispatch, run, stampConflicts, getRng } from '../src/sim/engine';
import { HOUR_SECONDS } from '../src/data/regime';
import { DIFFICULTY } from '../src/data/economy';
import { STAMPS, STAMP_BY_ID } from '../src/data/stamps';
import { EVENTS } from '../src/data/events';
import { validRooms } from '../src/sim/grid';
import { doSearch, computeGrade } from '../src/sim/economy';
import { rollEvent, applyChoice } from '../src/sim/events';
import { subdue } from '../src/sim/prisoner';

describe('difficulty & policy', () => {
  it('difficulty sets money and scales volatility', () => {
    expect(newGame(1, 'empty', 'easy').money).toBe(DIFFICULTY.easy.money);
    expect(newGame(1, 'empty', 'hard').money).toBe(DIFFICULTY.hard.money);
    const a = newGame(5, 'quick', 'easy'), b = newGame(5, 'quick', 'hard');
    dispatch(a, { type: 'intake', n: 6 }); dispatch(b, { type: 'intake', n: 6 });
    const va = a.prisoners.reduce((x, p) => x + p.volatility, 0), vb = b.prisoners.reduce((x, p) => x + p.volatility, 0);
    expect(vb).toBeGreaterThan(va);
  });
  it('meal policy changes hunger relief and food cost; punish policy changes sentence', () => {
    const s = newGame(2, 'quick'); dispatch(s, { type: 'policy', key: 'meal', value: 2 }); expect(s.policy.meal).toBe(2);
    dispatch(s, { type: 'policy', key: 'punish', value: 2 }); expect(s.policy.punish).toBe(2);
    dispatch(s, { type: 'intake', n: 2 }); const p = s.prisoners[0]; p.x = 4.5; p.y = 22.5;
    subdue(s, p); expect(p.punishedUntil - s.time).toBeCloseTo(12 * HOUR_SECONDS, 3);
  });
  it('wage multiplier and grade are applied at midnight', () => {
    const s = newGame(3, 'quick'); s.wageMul = 1.15; dispatch(s, { type: 'intake', n: 4 });
    run(s, HOUR_SECONDS * 19); // 06:00 → 01:00 next day
    const y = s.finance.history[0]; expect(y).toBeDefined(); expect(y.grade).toMatch(/[SABCD]/); expect(y.wages).toBeGreaterThan(0);
    expect(computeGrade(s, 90, 0, 0)).toBe('S'); expect(computeGrade(s, 30, 2, 3)).toBe('D');
  });
});

describe('tunnels & searches', () => {
  it('escapist in a cell digs at night; a search finds it and punishes; no guards → no search', () => {
    const s = newGame(4, 'quick'); dispatch(s, { type: 'intake', n: 6 });
    for (const p of s.prisoners) { p.traits = ['escapist']; p.escapist = true; }
    run(s, HOUR_SECONDS * 24 * 2);
    const dug = s.prisoners.filter(p => p.tunnel > 0).length; expect(dug).toBeGreaterThan(0);
    const before = s.stats.tunnelsFound; const rng = getRng(s);
    for (const p of s.prisoners) p.tunnel = Math.max(p.tunnel, 0.5);
    const found = doSearch(s, rng, true, true); expect(found).toBeGreaterThan(0); expect(s.stats.tunnelsFound).toBeGreaterThan(before);
    const punished = s.prisoners.filter(p => p.punishedUntil > s.time && p.tunnel === 0).length; expect(punished).toBe(found);
    expect(dispatch(s, { type: 'search' }).ok).toBe(false); // cooldown
    const e = newGame(4, 'empty'); expect(doSearch(e, getRng(e), true)).toBe(-1);
  });
  it('a finished tunnel is an escape with fine', () => {
    const s = newGame(6, 'quick'); dispatch(s, { type: 'intake', n: 1 }); const p = s.prisoners[0]; p.traits = ['escapist']; p.escapist = true; p.tunnel = 0.999;
    const id = p.id; run(s, HOUR_SECONDS * 24);
    const fines = s.finance.today.fines + s.finance.history.reduce((a, f) => a + f.fines, 0);
    expect(s.stats.escapes).toBe(1); expect(fines).toBeGreaterThanOrEqual(1500); expect(s.prisoners.some(q => q.id === id)).toBe(false);
  });
});

describe('events', () => {
  it('rolls an event around the event hour and applies choices deterministically', () => {
    const s = newGame(7, 'quick'); dispatch(s, { type: 'intake', n: 6 }); s.reputation = 70;
    let got = 0; for (let h = 0; h < 24 * 6; h++) { run(s, HOUR_SECONDS); if (s.pendingEvent) { got++; const r = dispatch(s, { type: 'eventChoice', idx: 0 }); expect(r.ok).toBe(true); expect(s.pendingEvent).toBeNull(); } }
    expect(got).toBeGreaterThanOrEqual(2);
    expect(dispatch(s, { type: 'eventChoice', idx: 0 }).ok).toBe(false);
  });
  it('every event can be applied with every choice without throwing', () => {
    for (const ev of EVENTS) for (let i = 0; i < ev.choices.length; i++) {
      const s = newGame(8, 'quick'); dispatch(s, { type: 'intake', n: 6 }); s.reputation = 70; s.policy.meal = 0; run(s, HOUR_SECONDS * 2);
      s.pendingEvent = { id: ev.id, day: 1 }; const msg = applyChoice(s, getRng(s), i); expect(typeof msg).toBe('string'); expect(s.pendingEvent).toBeNull();
      run(s, HOUR_SECONDS * 3); // sim survives the aftermath
    }
  });
  it('celebrity adds a max-security leader even before unlock; strike removes guards', () => {
    const s = newGame(9, 'quick'); dispatch(s, { type: 'intake', n: 4 }); const n = s.prisoners.length;
    s.pendingEvent = { id: 'celebrity', day: 1 }; applyChoice(s, getRng(s), 0); expect(s.prisoners.length).toBe(n + 1); expect(s.prisoners[n].sec).toBe('max'); expect(s.prisoners[n].traits).toContain('leader');
    for (let i = 0; i < 3; i++) dispatch(s, { type: 'hire', staff: 'guard' }); const g = s.staff.filter(x => x.type === 'guard').length;
    s.pendingEvent = { id: 'strike', day: 1 }; applyChoice(s, getRng(s), 1); expect(s.staff.filter(x => x.type === 'guard').length).toBe(g - 2);
    s.pendingEvent = { id: 'strike', day: 1 }; applyChoice(s, getRng(s), 0); expect(s.wageMul).toBeCloseTo(1.15, 5);
    void rollEvent;
  });
});

describe('stamps', () => {
  it('all stamps have positive cost and consistent dimensions', () => {
    for (const st of STAMPS) { expect(st.cost).toBeGreaterThan(0); for (const c of st.cells) { expect(c.x).toBeLessThan(st.w); expect(c.y).toBeLessThan(st.h); } }
  });
  it('placing a stamp plans walls/doors/objects and paints zones; conflicts are rejected; built result is a valid room', () => {
    const s = newGame(10, 'empty');
    expect(stampConflicts(s, 'holding', 10, 10).length).toBe(0);
    expect(stampConflicts(s, 'holding', 0, 10).length).toBeGreaterThan(0);
    const m = s.money; const r = dispatch(s, { type: 'stamp', id: 'holding', ax: 10, ay: 10 }); expect(r.ok).toBe(true);
    expect(s.money).toBe(m - STAMP_BY_ID.holding.cost);
    expect(dispatch(s, { type: 'stamp', id: 'holding', ax: 12, ay: 12 }).ok).toBe(false); // overlap
    dispatch(s, { type: 'cancel', x: 10, y: 13 }); dispatch(s, { type: 'build', struct: 'jaildoor', x0: 10, y0: 13, x1: 10, y1: 13 }); // secure the door
    run(s, 200);
    expect(s.jobs.length).toBe(0); expect(validRooms(s, 'holding').length).toBe(1);
    // cell block becomes 6 valid cells once the entrance is a jail door
    const c = newGame(11, 'empty'); expect(dispatch(c, { type: 'stamp', id: 'cellblock', ax: 20, ay: 20 }).ok).toBe(true);
    dispatch(c, { type: 'cancel', x: 24, y: 20 }); dispatch(c, { type: 'build', struct: 'jaildoor', x0: 24, y0: 20, x1: 24, y1: 20 });
    run(c, 300); expect(c.jobs.length).toBe(0); expect(validRooms(c, 'cell').length).toBe(6);
    s.money = 10; expect(dispatch(s, { type: 'stamp', id: 'yard', ax: 20, ay: 30 }).ok).toBe(false);
  });
  it('save v2 round trip keeps new fields; v1 saves migrate', () => {
    const s = newGame(12, 'quick', 'hard'); dispatch(s, { type: 'policy', key: 'search', value: 1 }); run(s, 30);
    const t = deserialize(serialize(s)); expect(t.difficulty).toBe('hard'); expect(t.policy.search).toBe(1);
    const o = JSON.parse(serialize(s)); o.version = 1; delete o.policy; delete o.difficulty; for (const p of o.prisoners) { delete p.traits; delete p.tunnel; }
    const u = deserialize(JSON.stringify(o)); expect(u.policy.meal).toBe(1); expect(u.difficulty).toBe('normal');
  });
});
