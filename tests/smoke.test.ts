import { describe, it, expect } from 'vitest';
import { runBot } from './bot';

describe('smoke: 10-wave loop', () => {
  it('attack bot survives to boss 1 and beyond on seed 1', () => {
    const r = runBot(1, 'attack', { maxWave: 11 });
    console.log(r);
    expect(r.wave).toBeGreaterThanOrEqual(10);
  });
  it('idle bot (only starting units) loses eventually', () => {
    const r = runBot(2, 'idle', { maxTime: 600 });
    console.log('idle', r.wave, r.life);
    expect(r.wave).toBeLessThan(15);
  });
});
