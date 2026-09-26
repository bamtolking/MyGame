import { describe, it, expect } from 'vitest';
import { simulate } from './sim.ts';
import { CLASS_IDS } from '../src/shared/data/classes.ts';

describe('smoke: 6-minute headless play-through per class', () => {
  for (const cls of CLASS_IDS) it(`${cls} levels up, earns gold and progresses the story`, () => {
    const r = simulate(cls, 3, 6);
    expect(r.finalLevel).toBeGreaterThanOrEqual(4);
    expect(r.kills).toBeGreaterThan(300);
    expect(r.gold).toBeGreaterThan(0);
    expect(r.questAt[5]).toBeGreaterThanOrEqual(2);
    expect(r.deaths).toBeLessThan(6);
    expect(r.bytesPerSec).toBeLessThan(25000);
  });
});
