// 골목 지도 stages: a frozen course (explicit chunk ids and/or {pool, tier} slots drawn once from the stage seed),
// or, without a course, a seeded stream of `length` m. ★1 finish · ★2 star-candy % · ★3 all 3 golden pouches.
export type CourseSlot = string | { pool?: string; tier: number };
export interface StageDef {
  id: string;
  world: number;         // 1-based world index
  index: number;         // 1-based stage index within the world (7 = remix)
  name: string;
  intro: string;         // what this stage teaches / tests
  biome: string;
  seed: number;
  tiers: [number, number];
  length: number;        // m (used when there is no course; otherwise informational)
  course?: CourseSlot[];
  remix?: boolean;
  stars: { jellyPct: number };
}

export const STAGES: StageDef[] = [
  { id: '1-1', world: 1, index: 1, name: '첫걸음', intro: '가시 = 점프', biome: 'market', seed: 1101, tiers: [0, 0], length: 300, stars: { jellyPct: 70 } },
];
export const STAGE_BY_ID: Record<string, StageDef> = Object.fromEntries(STAGES.map(s => [s.id, s]));
