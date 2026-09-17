import { describe, expect, it } from 'vitest';
import { FixedLoop } from '../src/game/loop';
import { MissionSession, emptyMissionSave } from '../src/game/session';
import { SaveStore, parseSave, SAVE_KEY, type StorageLike } from '../src/game/storage';
import { MISSIONS } from '../src/data/missions';
import { SCRIPT_A, mapOf, runScript } from './helpers';
import { createAttempt, stepAttempt } from '../src/sim/engine';
import { NO_INPUT } from '../src/sim/types';
import { validateRecording } from '../src/sim/recording';

const m1 = mapOf('m1');

describe('fixed-step loop', () => {
  const simulate = (fps: number, seconds: number, pauseAt?: [number, number]): { ticks: number; burst: number } => {
    let ticks = 0; let burst = 0; let lastTicks = 0;
    const loop = new FixedLoop({ onTick: () => { ticks++; }, onRender: () => {} });
    const frameMs = 1000 / fps; let t = 0; let paused = false;
    while (t < seconds * 1000) {
      t += frameMs;
      if (pauseAt && !paused && t >= pauseAt[0] * 1000 && t < pauseAt[1] * 1000) { loop.pause(); paused = true; }
      if (pauseAt && paused && t >= pauseAt[1] * 1000) { loop.resume(t); paused = false; lastTicks = ticks; loop.frame(t); burst = Math.max(burst, ticks - lastTicks); continue; }
      loop.frame(t);
    }
    return { ticks, burst };
  };
  it('produces the same number of ticks at 30, 60 and 120 fps', () => {
    const a = simulate(30, 10).ticks, b = simulate(60, 10).ticks, c = simulate(120, 10).ticks;
    expect(Math.abs(a - 600)).toBeLessThanOrEqual(2); expect(Math.abs(b - 600)).toBeLessThanOrEqual(2); expect(Math.abs(c - 600)).toBeLessThanOrEqual(2);
  });
  it('a pause freezes time and resuming does not replay the paused seconds', () => {
    const r = simulate(60, 10, [3, 7]);
    expect(Math.abs(r.ticks - 360)).toBeLessThanOrEqual(2); // 6 s of real ticks
    expect(r.burst).toBeLessThanOrEqual(1);
  });
  it('a long stall (background tab) advances at most a few ticks', () => {
    let ticks = 0; const loop = new FixedLoop({ onTick: () => { ticks++; }, onRender: () => {} });
    loop.frame(0); loop.frame(16); loop.frame(16 + 30000);
    expect(ticks).toBeLessThanOrEqual(5);
  });
  it('ghost tick and attempt tick stay in lockstep through pause/resume', () => {
    const A = runScript(m1, SCRIPT_A);
    const st = createAttempt(m1, { weapon: 'rifle', ghosts: [A.rec] });
    const loop = new FixedLoop({ onTick: () => stepAttempt(st, NO_INPUT), onRender: () => {} });
    let t = 0; for (let i = 0; i < 120; i++) { t += 16.67; loop.frame(t); }
    loop.pause(); for (let i = 0; i < 100; i++) { t += 16.67; loop.frame(t); }
    const tickAtPause = st.tick; const gx = st.ghosts[0].x, gy = st.ghosts[0].y;
    expect(tickAtPause).toBe(loop.ticks);
    expect(st.ghosts[0].x).toBe(gx); expect(st.ghosts[0].y).toBe(gy);
    loop.resume(t); for (let i = 0; i < 60; i++) { t += 16.67; loop.frame(t); }
    expect(st.tick).toBe(loop.ticks);
    // ghost position equals the recording at exactly this tick
    expect(st.ghosts[0].x).toBeCloseTo(A.rec.pos[(st.tick - 1) * 2] / 10, 5);
  });
});

describe('mission session: slots, re-record, results', () => {
  const A = runScript(m1, SCRIPT_A);
  it('adds recordings to free slots and excludes a slot while re-recording', () => {
    const s = new MissionSession(MISSIONS[0], emptyMissionSave(MISSIONS[0].version));
    expect(s.commitRecording(A.rec)).toBe(0);
    expect(s.commitRecording(A.rec)).toBe(1);
    s.beginRerecord(0);
    expect(s.ghostsForAttempt()[0]).toBeNull(); expect(s.ghostsForAttempt()[1]).toBe(A.rec);
    expect(s.slots[0]).toBe(A.rec); // still stored until replaced
  });
  it('cancelling a re-record keeps the previous recording; committing replaces it', () => {
    const s = new MissionSession(MISSIONS[0], emptyMissionSave(MISSIONS[0].version));
    const other = { ...A.rec, createdAt: 123 };
    s.commitRecording(A.rec); s.beginRerecord(0); s.cancelRerecord();
    expect(s.slots[0]).toBe(A.rec); expect(s.rerecording).toBeNull();
    s.beginRerecord(0); expect(s.commitRecording(other)).toBe(0); expect(s.slots[0]).toBe(other);
  });
  it('full slots require an explicit target', () => {
    const s = new MissionSession(MISSIONS[0], emptyMissionSave(MISSIONS[0].version));
    s.commitRecording(A.rec); s.commitRecording(A.rec); s.commitRecording(A.rec);
    expect(s.commitRecording(A.rec)).toBe(-1); expect(s.commitRecording(A.rec, 2)).toBe(2);
  });
  it('results and best records are applied once per attempt', () => {
    const s = new MissionSession(MISSIONS[0], emptyMissionSave(MISSIONS[0].version));
    const r = { attemptId: 1, outcome: 'escape' as const, ticks: 1100, ghostsUsed: 1, damageTaken: 0, composition: '소총' };
    const f1 = s.applyResult(r); const f2 = s.applyResult(r);
    expect(f1.firstClear).toBe(true); expect(f1.newBestTime).toBe(true); expect(f2.firstClear).toBe(false); expect(f2.newBestTime).toBe(false);
    expect(s.save.record.clears).toBe(1); expect(s.save.record.attempts).toBe(1);
    const f3 = s.applyResult({ ...r, attemptId: 2, ticks: 1300, ghostsUsed: 0 });
    expect(f3.newBestTime).toBe(false); expect(f3.newMinGhosts).toBe(true); expect(s.save.record.bestTicks).toBe(1100); expect(s.save.record.minGhosts).toBe(0);
    const f4 = s.applyResult({ ...r, attemptId: 3, outcome: 'timeout' });
    expect(f4.firstClear).toBe(false); expect(s.save.record.clears).toBe(2); expect(s.save.record.attempts).toBe(3);
  });
  it('recordings from an older map version are retired, not replayed', () => {
    const old = emptyMissionSave(MISSIONS[0].version - 1); old.slots[0] = { ...A.rec, mapVersion: MISSIONS[0].version - 1 };
    const s = new MissionSession(MISSIONS[0], old);
    expect(s.retired).toBe(true); expect(s.slots.every((x) => x === null)).toBe(true);
    const st = createAttempt(m1, { weapon: 'rifle', ghosts: [{ ...A.rec, mapVersion: 99 }] });
    expect(st.ghosts.length).toBe(0);
  });
});

describe('storage validation', () => {
  const mem = (): StorageLike => { let m: Record<string, string> = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: (k) => { delete m[k]; } }; };
  const A = runScript(m1, SCRIPT_A);
  it('round-trips a save with recordings', () => {
    const store = new SaveStore(mem()); const { data } = store.load(MISSIONS);
    data.missions.m1 = emptyMissionSave(1); data.missions.m1.slots[0] = A.rec; data.unlocked = 1; data.settings.volume = 0.3;
    expect(store.save(data)).toBe(true);
    const back = store.load(MISSIONS);
    expect(back.problems).toEqual([]); expect(back.data.unlocked).toBe(1); expect(back.data.settings.volume).toBe(0.3);
    expect(back.data.missions.m1.slots[0]?.pos.length).toBe(A.rec.pos.length);
  });
  it('survives garbage, wrong types, out-of-range values and corrupted recordings', () => {
    expect(parseSave('{not json', MISSIONS).problems.length).toBe(1);
    expect(parseSave('42', MISSIONS).data.unlocked).toBe(1);
    const bad = { v: 1, settings: { volume: 99, muted: 'yes' }, unlocked: -5, missions: { m1: { version: 1, slots: [{ v: 1, mapId: 'm1', mapVersion: 1, weapon: 'laser', endKind: 'finish', endTick: 3, pos: [1, 2, 3, 4, 5, 6], face: [0, 0, 0], shots: [], dashes: [] }, { ...A.rec, pos: A.rec.pos.slice(0, 10) }, A.rec], record: { clears: 'x', bestTicks: 999999 } } } };
    const r = parseSave(JSON.stringify(bad), MISSIONS);
    expect(r.data.settings.volume).toBe(1); expect(r.data.settings.muted).toBe(false); expect(r.data.unlocked).toBe(1);
    expect(r.data.missions.m1.slots[0]).toBeNull(); expect(r.data.missions.m1.slots[1]).toBeNull(); expect(r.data.missions.m1.slots[2]).not.toBeNull();
    expect(r.data.missions.m1.record.clears).toBe(0); expect(r.data.missions.m1.record.bestTicks).toBeNull();
    expect(r.problems.some((p) => p.includes('손상된 분신 기록 2개'))).toBe(true);
  });
  it('rejects recordings whose shot ticks or dash ticks fall outside the frames', () => {
    expect(validateRecording({ ...A.rec, shots: [{ t: A.rec.endTick + 5, x: 0, y: 0, w: 'rifle', a: [0] }] })).toBeNull();
    expect(validateRecording({ ...A.rec, dashes: [0] })).toBeNull();
    expect(validateRecording({ ...A.rec, endTick: A.rec.endTick - 1 })).toBeNull();
    expect(validateRecording(A.rec)).not.toBeNull();
  });
  it('key is stable', () => { expect(SAVE_KEY).toBe('solo_heist_25s_v1'); });
});
