// Determinism: replays, identical courses regardless of input, and no implementation-approximated math in the sim.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { newRun, stepRun, stateHash, type RunConfig } from '../src/sim/run';
import { Autopilot } from '../src/sim/autopilot';
import type { RunInput, RunState } from '../src/sim/types';

function replay(cfg: RunConfig, log: number[], steps: number, every: number): string[] {
  const s = newRun(cfg); const out: string[] = []; let li = 0; let bits = 0;
  for (let i = 0; i < steps; i++) {
    let jump = false;
    while (li < log.length && log[li] === i) { bits = log[li + 1]; jump = (bits & 1) === 1; li += 2; }
    stepRun(s, { jump, slide: (bits & 2) === 2, jumpHeld: (bits & 4) === 4 }); s.events.length = 0;
    if ((i + 1) % every === 0) out.push(stateHash(s));
  }
  return out;
}
function record(cfg: RunConfig, steps: number, every: number, jitter: number): { log: number[]; hashes: string[] } {
  const s = newRun(cfg); const ap = new Autopilot({ jitter, seed: 5 }); const hashes: string[] = [];
  for (let i = 0; i < steps; i++) { stepRun(s, ap.next(s)); s.events.length = 0; if ((i + 1) % every === 0) hashes.push(stateHash(s)); }
  return { log: s.log.slice(), hashes };
}
/** main-course chunk ids by index, observed while running */
function courseOf(cfg: RunConfig, steps: number, input: (s: RunState, i: number) => RunInput): Map<number, string> {
  const s = newRun(cfg); const seen = new Map<number, string>();
  for (let i = 0; i < steps && s.phase !== 'over' && s.phase !== 'clear'; i++) {
    stepRun(s, input(s, i)); s.events.length = 0;
    for (const c of s.level.chunks) if (c.main && c.x < s.body.x + 200 && !seen.has(c.index)) seen.set(c.index, c.id);  // only chunks actually reached
  }
  return seen;
}

describe('determinism', () => {
  for (const cfg of [
    { mode: 'endless', seed: 777, charId: 'hotteok', partnerId: 'goguma', companionId: 'magpie' },
    { mode: 'daily', seed: 424242, charId: 'bungeo', companionId: 'firefly' },
    { mode: 'endless', seed: 9, charId: 'kkochi', assist: { autoSlide: true } },
  ] as RunConfig[]) {
    it(`replaying the input log reproduces the run exactly (${cfg.mode}, ${cfg.charId})`, () => {
      const rec = record(cfg, 60 * 90, 600, 6);
      expect(replay(cfg, rec.log, 60 * 90, 600)).toEqual(rec.hashes);
    });
  }

  it('the course (main chunk sequence) is identical however the player plays — bonus teleports included', () => {
    const cfg: RunConfig = { mode: 'daily', seed: 20260926, charId: 'hotteok' };
    const apA = new Autopilot({ jitter: 0, seed: 1 }); const apB = new Autopilot({ jitter: 12, seed: 2 });
    const a = courseOf(cfg, 60 * 150, s => apA.next(s));
    const b = courseOf(cfg, 60 * 150, s => apB.next(s));
    const lazy = courseOf(cfg, 60 * 60, (_s, i) => ({ jump: i % 45 === 0, slide: false }));
    let compared = 0;
    for (const [i, id] of a) { if (b.has(i)) { expect(b.get(i), `main #${i}`).toBe(id); compared++; } if (lazy.has(i)) expect(lazy.get(i), `main #${i}`).toBe(id); }
    expect(compared).toBeGreaterThan(20);
  });

  // ghosts and daily seeds are keyed by CONTENT_HASH: a balance patch to a character or companion, or a rules change
  // in the sim code (RUN_VERSION), must invalidate them — else an old input log replays against different rules
  it('CONTENT_HASH covers characters, companions and the sim rules version', async () => {
    const hashWith = async (mocks: [string, (m: Record<string, unknown>) => Record<string, unknown>][]): Promise<number> => {
      vi.resetModules();
      for (const [path, f] of mocks) vi.doMock(path, async (orig: () => Promise<Record<string, unknown>>) => f(await orig()));
      const h = (await import('../src/sim/content')).CONTENT_HASH;
      for (const [path] of mocks) vi.doUnmock(path);
      vi.resetModules();
      return h;
    };
    type Rec = Record<string, unknown>;
    const base = await hashWith([]);
    expect(await hashWith([])).toBe(base);
    const hp = await hashWith([['../src/data/characters', m => ({ ...m, CHARACTERS: (m.CHARACTERS as Rec[]).map((c, i) => (i === 3 ? { ...c, maxHp: (c.maxHp as number) - 5 } : c)) })]]);
    const comp = await hashWith([['../src/data/companions', m => ({ ...m, COMPANIONS: (m.COMPANIONS as Rec[]).map((c, i) => (i === 1 ? { ...c, effect: { kind: 'honeyDrop', every: 20 } } : c)) })]]);
    const rules = await hashWith([['../src/sim/run', m => ({ ...m, RUN_VERSION: (m.RUN_VERSION as number) + 1 })]]);
    expect(new Set([base, hp, comp, rules]).size).toBe(4);
  });

  it('src/sim and src/data use only exactly-specified math (no sin/cos/pow/exp/log/hypot, **, random, Date)', () => {
    const bad: string[] = [];
    const re = /Math\.(sin|cos|tan|pow|exp|log|atan2|hypot|cbrt|random)\b|\*\*|Date\.|new Date|performance\./;
    for (const dir of ['src/sim', 'src/data']) {
      for (const f of readdirSync(dir)) {
        if (!f.endsWith('.ts')) continue;
        const src = readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')); // blank out block comments
        const lines = src.split('\n');
        lines.forEach((l, i) => { const code = l.replace(/\/\/.*$/, ''); if (re.test(code)) bad.push(`${dir}/${f}:${i + 1}: ${l.trim()}`); });
      }
    }
    expect(bad).toEqual([]);
  });
});
