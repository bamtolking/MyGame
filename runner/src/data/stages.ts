// Adventure stages: a fixed seed + biome + tier ramp + length → the same course every time. Three stars each.
export interface StageDef {
  id: string;
  world: number;         // 1-based world index
  index: number;         // 1-based stage index within the world
  name: string;
  biome: string;
  seed: number;
  tiers: [number, number];
  length: number;        // m to the finish line
  stars: { jellyPct: number; hpPct: number }; // ★1 reach the finish · ★2 collect ≥ jellyPct of jellies · ★3 finish with ≥ hpPct HP
}

export const STAGES: StageDef[] = [
  { id: '1-1', world: 1, index: 1, name: '첫걸음', biome: 'market', seed: 1101, tiers: [0, 0], length: 300, stars: { jellyPct: 70, hpPct: 50 } },
];
