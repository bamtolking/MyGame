import { it, expect } from 'vitest';
import { playRun } from './bot';
it('bot smoke', () => {
  for (const jitter of [0, 6]) {
    const t0 = Date.now();
    const { r } = playRun({ mode: 'endless', seed: 42, charId: 'hotteok' }, { jitter, pad: 3, seed: 1, maxT: 400 });
    console.log('jitter', jitter, JSON.stringify(r), (Date.now() - t0) + 'ms');
    expect(r.dist).toBeGreaterThan(50);
  }
});
