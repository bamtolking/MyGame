// Chunk library. 12 rows each (row 11 = ground). See src/sim/chunk.ts for the glyph legend.
// Every chunk here is proven crossable hit-free at every speed of its tier range by tests/chunks.test.ts.
import type { ChunkDef } from '../sim/chunk';

const E = (n: number) => '.'.repeat(n);
const G = (n: number) => '='.repeat(n);

export const CHUNKS: ChunkDef[] = [
  // ---- special ----
  { id: 'finish_runout', tiers: [0, 5], tags: ['special'], rows: [E(24), E(24), E(24), E(24), E(24), E(24), E(24), E(24), E(24), E(24), '...oooooooooooooooooo...', G(24)] },
  { id: 'landing', tiers: [0, 5], tags: ['special'], rows: [E(16), E(16), E(16), E(16), E(16), E(16), E(16), E(16), E(16), E(16), '....oooooooooo..', G(16)] },
  { id: 'sky_wave', tiers: [0, 5], tags: ['sky'], rows: [
    E(24),
    E(24),
    '....ooo.........ooo.....',
    '...o...o.......o...o....',
    '..o.....o.....o.....o...',
    '.o.......o...o.......o..',
    'o.........ooo.........o.',
    E(24),
    '..OO....cc....OO....cc..',
    E(24),
    'oooooooooooooooooooooooo',
    G(24)] },
  // ---- starter normal chunks ----
  { id: 'flat_jelly', tiers: [0, 2], rows: [E(16), E(16), E(16), E(16), E(16), E(16), E(16), E(16), E(16), E(16), 'oooooooooooooooo', G(16)] },
  { id: 'spike_one', tiers: [0, 5], rows: [E(16), E(16), E(16), E(16), E(16), E(16), E(16), '.......ooo......', '......o...o.....', '.....o.....o....', 'oooo....^....ooo', G(16)] },
];
