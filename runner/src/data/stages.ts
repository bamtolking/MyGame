// 골목 지도 stages: a frozen course (explicit chunk ids and/or {pool, tier} slots drawn once from the stage seed),
// or, without a course, a seeded stream of `length` m. ★1 finish · ★2 star-candy % · ★3 all 3 golden pouches.
import { CHUNKS } from './chunks';
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
  /** golden pouches: placed at (col,row) of course slot `slot` (proven reachable hit-free by tests/stages.test.ts) */
  pouches?: { slot: number; col: number; row: number }[];
  remix?: boolean;
  stars: { jellyPct: number };
}

// The 21 stages of GDD §8.2. Every course is frozen (explicit chunk ids, never repeated within a stage), opens
// gently and closes with a small exam; a chunk runs at the stage's tier, or one tier faster only in the last 35 %.
// Pits start at 1-5, the fast-fall is taught in 2-3 (stage_fastfall's sign), and each world's set piece appears once
// from 1-4 on (its 'B' glyph is one of the three pouches). Pouches: ① high route (shelf / air-jump apex),
// ② risky low line between hazards, ③ planning (seen early, needs a route choice) — see the per-stage notes.
// ★1 first-try rates, ★2 (casual p55 → multiple of 5) and pouch pick-up rates are checked by
// tests/stage-balance.test.ts, which also writes docs/stages.md.
export const STAGES: StageDef[] = [
  // ---- W1 야시장 골목 (market) ----
  // 1-1: spikes only (single jump), shelves/benches as optional high ground. ① shelf-top arc ② ground between two spikes ③ bench route
  { id: '1-1', world: 1, index: 1, name: '첫걸음', intro: '가시는 점프로 넘어요', biome: 'market', seed: 1101, tiers: [0, 0], length: 300,
    course: ['spike_single', 'jelly_heart_spike', 'spike_coin_hill', 'rest_wave', 'spike_two', 'spike_wide', 'bench_row', 'spike_cluster', 'spike_trio_far', 'twin_shelves', 'spike_double_arch'],
    pouches: [{ slot: 9, col: 13, row: 5 }, { slot: 4, col: 14, row: 10 }, { slot: 6, col: 19, row: 8 }], stars: { jellyPct: 70 } },
  // 1-2: tall towers = air jump, spikes as rest beats; exam: tower+spike combos. ① tower apex ② ground between spikes ③ the way up onto the long shelf
  { id: '1-2', world: 1, index: 2, name: '찜통 탑', intro: '높은 탑은 2단 점프로 넘어요', biome: 'market', seed: 1102, tiers: [0, 0], length: 350,
    course: ['spike_wide', 'fork_single', 'rest_meadow', 'fork_low_arch', 'fork_bench', 'spike_two', 'bench_boost', 'high_shelf', 'fork_spike_easy', 'rest_coins', 'spike_fork_easy', 'jelly_heart_spike', 'spike_double_arch'],
    pouches: [{ slot: 8, col: 8, row: 3 }, { slot: 5, col: 14, row: 10 }, { slot: 7, col: 6, row: 7 }], stars: { jellyPct: 75 } },
  // 1-3: lanterns = slide (first half pure slide), then slide mixed with the earlier jumps. ① tower apex ② between lantern and tower ③ bench before the lanterns
  { id: '1-3', world: 1, index: 3, name: '초롱 아래로', intro: '초롱 아래는 슬라이드로 지나가요', biome: 'market', seed: 1103, tiers: [0, 1], length: 400,
    course: ['slide_blip', 'slide_short', 'slide_pair', 'slide_hill', 'slide_long', 'lantern_taps', 'bench_to_slide', 'ceiling_stroll', 'lantern_hop', 'fork_spike_easy', 'slide_jump', 'fork_single', 'spike_fork_easy', 'slide_fork_easy'],
    pouches: [{ slot: 9, col: 8, row: 3 }, { slot: 13, col: 13, row: 9 }, { slot: 6, col: 6, row: 8 }], stars: { jellyPct: 85 } },
  // 1-4: jump↔slide mixes; market set piece past the middle. ① set-piece rooftop B ② between lantern and tower ③ far side of a tower arc
  { id: '1-4', world: 1, index: 4, name: '꼬치 골목', intro: '점프와 슬라이드를 섞어 써요', biome: 'market', seed: 1104, tiers: [0, 1], length: 450,
    course: ['spike_two', 'slide_short', 'bench_to_slide', 'lantern_hop', 'slide_blip', 'slide_fork_easy', 'shelf_spike', 'spike_cluster', 'rest_bench', 'slide_jump', 'spike_fork_easy', 'jump_slide', 'spike_rhythm', 'set_market_roofs', 'fork_spike_easy', 'fork_twice'],
    pouches: [{ slot: 5, col: 13, row: 9 }, { slot: 10, col: 22, row: 4 }], stars: { jellyPct: 70 } },
  // 1-5: drain pits (rescue bounce), bridges and stones; closing exam one tier faster. ① set-piece rooftop B ② low hop between pits ③ bridge over the drain
  { id: '1-5', world: 1, index: 5, name: '하수구 틈', intro: '구덩이는 점프로 건너요', biome: 'market', seed: 1105, tiers: [1, 1], length: 500,
    course: ['pit_small', 'pit_wide', 'double_pit', 'pit_pair', 'pit_stone', 'pit_plat', 'set_market_roofs', 'pit_spike_easy', 'slide_pit_easy', 'pit_bridge', 'pit_tower', 'pit_hops', 'wide_pit_double', 'hang_pit', 'fork_twice'],
    pouches: [{ slot: 11, col: 12, row: 9 }, { slot: 9, col: 13, row: 8 }], stars: { jellyPct: 65 } },
  // 1-6: W1 recap: tut_6_recap early, every element, a tower-heavy finale. ① set-piece rooftop B ② island between two pits ③ the way onto the long shelf
  { id: '1-6', world: 1, index: 6, name: '야시장 한 바퀴', intro: '야시장을 한 바퀴 돌며 복습해요', biome: 'market', seed: 1106, tiers: [1, 1], length: 550,
    course: ['spike_wide', 'tut_6_recap', 'fork_single', 'slide_fork_easy', 'pit_pair', 'bench_boost', 'rest_coins', 'jump_slide', 'pit_long_jump', 'high_shelf', 'set_market_roofs', 'spike_rhythm', 'fork_low_arch', 'pit_tower', 'slide_jump', 'bridge_spike', 'fork_bench', 'fork_spike_easy', 'fork_twice'],
    pouches: [{ slot: 4, col: 15, row: 10 }, { slot: 9, col: 6, row: 7 }], stars: { jellyPct: 70 } },
  // 1-R: 1-6 family one tier faster (tier 2 chunks). ① set-piece rooftop B ② between lantern and spike ③ upper lane of two_lanes
  { id: '1-R', world: 1, index: 7, name: '한밤 골목', intro: '더 빨라진 한밤 야시장이에요', biome: 'market', seed: 1107, tiers: [2, 2], length: 550, remix: true,
    course: ['spike_wide', 'tut_6_recap', 'bench_boost', 'spike_rhythm', 'ceiling_run', 'hang_pit', 'fork_twice', 'breather_fork', 'two_lanes', 'twin_spike_beats', 'set_market_roofs', 'pit_to_ledge', 'tall_slide', 'read_alternate', 'fork_then_pit', 'stone_steps'],
    pouches: [{ slot: 13, col: 16, row: 10 }, { slot: 8, col: 10, row: 5 }], stars: { jellyPct: 65 } },

  // ---- W2 포장마차 강변 (riverside) ----
  // 2-1: one-way platforms (tut_5_platform sign), air-jump review at the end. ① shelf-top arc ② set-piece bench B ③ bench route
  { id: '2-1', world: 2, index: 1, name: '평상 위로', intro: '평상 위로 뛰어올라요', biome: 'riverside', seed: 2101, tiers: [1, 1], length: 500,
    course: ['tut_5_platform', 'plat_low', 'bench_to_slide', 'twin_shelves', 'bench_row', 'rest_float', 'high_shelf', 'pit_plat', 'plat_over_spikes', 'bonus_float', 'set_river_benches', 'fork_spike_easy', 'pit_bridge', 'spike_fork_easy', 'pit_tower', 'fork_twice'],
    pouches: [{ slot: 3, col: 13, row: 5 }, { slot: 4, col: 19, row: 8 }], stars: { jellyPct: 65 } },
  // 2-2: stairs (benches, tent steps, stone steps over pits). ① top step ② set-piece bench B ③ stair route over the pit
  { id: '2-2', world: 2, index: 2, name: '천막 사다리', intro: '천막 계단을 밟고 올라가요', biome: 'riverside', seed: 2102, tiers: [1, 2], length: 550,
    course: ['bench_pyramid', 'stairs_gentle', 'fork_single', 'plat_over_spikes', 'twin_shelves', 'pit_hop_row', 'bridge_spike', 'stairs_pit', 'bench_boost', 'pit_tower', 'fork_bench', 'set_river_benches', 'stairs_up', 'bonus_float', 'stairs_spikes', 'two_lanes', 'stone_steps', 'tall_slide'],
    pouches: [{ slot: 1, col: 17, row: 4 }, { slot: 7, col: 12, row: 6 }], stars: { jellyPct: 60 } },
  // 2-3: fast-fall lesson: stage_fastfall (sign) first, then jump→slide chunks where it pays. ① tower apex ② set-piece bench B ③ stone-step route
  { id: '2-3', world: 2, index: 3, name: '쏙 내려오기', intro: '공중에서 슬라이드로 쏙 내려와요', biome: 'riverside', seed: 2103, tiers: [2, 2], length: 600,
    course: ['breather_spike', 'stage_fastfall', 'bench_boost', 'jump_slide', 'tunnel_exit_spike', 'slide_jump_slide', 'ceiling_run', 'bridge_hang', 'spike_rhythm', 'slide_fork_slide', 'read_alternate', 'set_river_benches', 'two_lanes', 'fork_then_pit', 'pit_hops', 'tut_6_recap', 'tall_slide', 'stone_steps'],
    pouches: [{ slot: 9, col: 14, row: 3 }, { slot: 17, col: 24, row: 8 }], stars: { jellyPct: 70 } },
  // 2-4: up/down forks (two_lanes, split_route, stairs_choice). ① upper lane ② set-piece bench B ③ upper route of split_route
  { id: '2-4', world: 2, index: 4, name: '두 갈래 길', intro: '위아래 두 갈래 중 골라요', biome: 'riverside', seed: 2104, tiers: [2, 2], length: 650,
    course: ['shelf_spike', 'high_shelf', 'twin_shelves', 'bench_row', 'bonus_float', 'plat_over_spikes', 'hang_pit', 'stairs_spikes', 'set_river_benches', 'read_alternate', 'slide_fork_slide', 'two_lanes', 'wide_pit_double', 'breather_fork', 'pit_hops', 'split_route', 'stairs_choice', 'tall_slide', 'twin_spike_beats', 'stone_steps'],
    pouches: [{ slot: 11, col: 22, row: 5 }, { slot: 15, col: 12, row: 4 }], stars: { jellyPct: 65 } },
  // 2-5: rhythm patterns (spike/pit/slide beats) ramping tier 2→3. ① tower apex ② set-piece bench B ③ bridge route
  { id: '2-5', world: 2, index: 5, name: '강바람', intro: '강바람 박자에 맞춰 뛰어요', biome: 'riverside', seed: 2105, tiers: [2, 3], length: 700,
    course: ['spike_rhythm', 'pit_hop_row', 'breather_pit', 'spike_pit_rhythm', 'slide_jump_slide', 'hang_pit', 'twin_spike_beats', 'breather_spike', 'breather_slide', 'fork_twice', 'set_river_benches', 'ceiling_run', 'beat_jjs', 'pit_chain', 'beat_sjs', 'read_alternate', 'fork_slide_fork', 'pit_hops', 'stone_steps', 'bridge_twin_spikes', 'zigzag_read'],
    pouches: [{ slot: 9, col: 10, row: 3 }, { slot: 19, col: 4, row: 7 }], stars: { jellyPct: 65 } },
  // 2-6: W2 recap at tier 3 (platforms, stairs, fast-fall reprise, forks, beats). ① air-jump apex ② set-piece bench B ③ planned_route upper path
  { id: '2-6', world: 2, index: 6, name: '포장마차 종점', intro: '강변에서 배운 걸 모두 써요', biome: 'riverside', seed: 2106, tiers: [3, 3], length: 800,
    course: ['breather_spike', 'stairs_spikes', 'slide_jump_slide', 'hang_pit', 'wide_pit_double', 'fork_then_pit', 'breather_fork', 'breather_slide', 'read_alternate', 'pit_to_ledge', 'stage_fastfall', 'bridge_slide_spike', 'planned_route', 'pit_hops', 'two_lanes', 'set_river_benches', 'tall_slide', 'twin_forks', 'coin_arcade', 'plat_gauntlet', 'split_route', 'step_spikes', 'beat_jjs', 'stone_steps'],
    pouches: [{ slot: 6, col: 13, row: 2 }, { slot: 12, col: 8, row: 5 }], stars: { jellyPct: 60 } },
  // 2-R: riverside remix at tier 4. ① tower apex ② set-piece bench B ③ bench route over the hurdles
  { id: '2-R', world: 2, index: 7, name: '비 오는 강변', intro: '비 오는 강변은 더 빨라요', biome: 'riverside', seed: 2107, tiers: [4, 4], length: 800, remix: true,
    course: ['breather_spike', 'bench_hurdles', 'stairs_spikes', 'breather_slide', 'stairs_descent', 'beat_jjs', 'split_route', 'twin_pits_slide', 'dense_b', 'three_lanes', 'twin_forks', 'bridge_twin_spikes', 'hang_maze', 'set_river_benches', 'sky_bridge', 'slide_bench_pit', 'step_dance', 'ceiling_spike_mix', 'plat_rhythm', 'fork_pit', 'fork_spike_fork'],
    pouches: [{ slot: 20, col: 7, row: 3 }, { slot: 1, col: 16, row: 8 }], stars: { jellyPct: 70 } },

  // ---- W3 불꽃놀이 다리 (bridge) ----
  // 3-1: pits + platforms (bridges, ledges, stone steps). ① set-piece cable apex B ② low arc between pits ③ planned_route upper path
  { id: '3-1', world: 3, index: 1, name: '다리 입구', intro: '구덩이를 건너 발판에 올라요', biome: 'bridge', seed: 3101, tiers: [3, 3], length: 700,
    course: ['breather_pit', 'pit_plat', 'stairs_pit', 'pit_bench', 'bridge_hang', 'pit_bridge', 'bridge_spike', 'breather_fork', 'wide_pit_double', 'pit_ceiling', 'pit_to_ledge', 'bridge_slide_spike', 'pit_chain', 'set_bridge_cables', 'bridge_twin_spikes', 'pit_then_slide', 'planned_route', 'stone_steps', 'step_spikes', 'pit_hops', 'plat_gauntlet'],
    pouches: [{ slot: 10, col: 12, row: 9 }, { slot: 16, col: 23, row: 4 }], stars: { jellyPct: 65 } },
  // 3-2: tunnels: ceilings and lantern rows, tier 3→4. ① set-piece cable apex B ② between lantern and tower ③ long arc over the pit before the ceiling
  { id: '3-2', world: 3, index: 2, name: '불꽃 터널', intro: '불꽃 터널에선 몸을 낮춰요', biome: 'bridge', seed: 3102, tiers: [3, 4], length: 750,
    course: ['tunnel_short', 'ceiling_run', 'bridge_hang', 'tunnel_exit_spike', 'bridge_slide_spike', 'beat_sjs', 'beat_jjs', 'pit_ceiling', 'danger_line', 'slide_fork_spike', 'tunnel_long', 'dense_a', 'set_bridge_cables', 'hang_maze', 'twin_forks', 'ceiling_spike_mix', 'zigzag_read', 'tunnel_pit', 'dense_b', 'gauntlet'],
    pouches: [{ slot: 9, col: 13, row: 9 }, { slot: 7, col: 8, row: 6 }], stars: { jellyPct: 80 } },
  // 3-3: broken railings: pits in a row, tier 3→4. ① set-piece cable apex B ② low hop between pits ③ planned_route upper path
  { id: '3-3', world: 3, index: 3, name: '끊어진 난간', intro: '끊어진 난간을 줄줄이 건너요', biome: 'bridge', seed: 3103, tiers: [3, 4], length: 800,
    course: ['breather_pit', 'pit_hops', 'pit_then_slide', 'wide_pit_double', 'breather_spike', 'spike_pit_rhythm', 'planned_route', 'fork_then_pit', 'hang_pit', 'plat_gauntlet', 'bridge_twin_spikes', 'pit_to_ledge', 'pit_ceiling', 'set_bridge_cables', 'step_dance', 'twin_pits_slide', 'slide_pit_spike', 'step_spikes', 'ledge_leap', 'pit_chain', 'stone_steps', 'sky_bridge', 'fork_pit', 'plat_rhythm'],
    pouches: [{ slot: 1, col: 12, row: 9 }, { slot: 6, col: 23, row: 4 }], stars: { jellyPct: 75 } },
  // 3-4: fast slide↔jump switches at tier 4. ① set-piece cable apex B ② slide line between spike and lanterns ③ bridge route
  { id: '3-4', world: 3, index: 4, name: '박자 맞추기', intro: '슬라이드와 점프를 빠르게 바꿔요', biome: 'bridge', seed: 3104, tiers: [4, 4], length: 850,
    course: ['breather_slide', 'slide_jump_slide', 'tunnel_exit_spike', 'tall_slide', 'breather_spike', 'ceiling_run', 'twin_pits_slide', 'danger_line', 'bridge_slide_spike', 'beat_sjs', 'slide_fork_slide', 'read_alternate', 'dense_a', 'beat_jjs', 'set_bridge_cables', 'slide_fork_spike', 'fork_slide_fork', 'dense_b', 'tunnel_pit', 'zigzag_read', 'slide_pit_spike', 'final_mix', 'gauntlet'],
    pouches: [{ slot: 9, col: 18, row: 10 }, { slot: 8, col: 27, row: 7 }], stars: { jellyPct: 80 } },
  // 3-5: two- and three-lane route choices, tier 4→5. ① set-piece cable apex B ② slide line between spike and lanterns ③ upper lane
  { id: '3-5', world: 3, index: 5, name: '세 갈래 불빛', intro: '세 갈래 불빛 중 하나를 골라요', biome: 'bridge', seed: 3105, tiers: [4, 5], length: 900,
    course: ['breather_spike', 'two_lanes', 'breather_fork', 'breather_slide', 'split_route', 'stairs_choice', 'danger_line', 'plat_gauntlet', 'planned_route', 'three_lanes', 'bench_hurdles', 'coin_arcade', 'twin_forks', 'step_dance', 'hang_maze', 'set_bridge_cables', 'final_mix', 'sky_bridge', 'zigzag_read', 'stairs_descent', 'fork_pit', 'gauntlet', 'plat_rhythm', 'dense_a', 'spike_stream'],
    pouches: [{ slot: 14, col: 29, row: 10 }, { slot: 1, col: 15, row: 5 }], stars: { jellyPct: 70 } },
  // 3-6: final exam at tier 5, hardest chunks last. ① set-piece cable apex B ② danger_line low line ③ upper route of split_route
  { id: '3-6', world: 3, index: 6, name: '보름달 언덕', intro: '보름달까지 마지막 시험이에요', biome: 'bridge', seed: 3106, tiers: [5, 5], length: 1000,
    course: ['breather_spike', 'beat_jjs', 'breather_slide', 'split_route', 'ceiling_pit', 'coin_arcade', 'bridge_slide_spike', 'twin_forks', 'beat_sjs', 'fork_slide_fork', 'planned_route', 'step_spikes', 'pit_then_slide', 'danger_line', 'slide_pit_spike', 'step_dance', 'set_bridge_cables', 'tunnel_pit', 'ceiling_spike_mix', 'three_lanes', 'bench_hurdles', 'final_mix', 'pit_chain', 'dense_a', 'spike_stream', 'fork_spike_fork', 'fork_pit_row'],
    pouches: [{ slot: 13, col: 26, row: 10 }, { slot: 3, col: 18, row: 5 }], stars: { jellyPct: 70 } },
  // 3-R: bridge remix at tier 5. ① set-piece cable apex B ② ground between tower and pit ③ planned_route upper path
  { id: '3-R', world: 3, index: 7, name: '불꽃 대폭발', intro: '불꽃이 터지는 마지막 골목이에요', biome: 'bridge', seed: 3107, tiers: [5, 5], length: 1000, remix: true,
    course: ['breather_pit', 'dense_b', 'breather_fork', 'danger_line', 'breather_spike', 'planned_route', 'stairs_choice', 'twin_forks', 'beat_sjs', 'bridge_twin_spikes', 'ceiling_pit', 'tunnel_long', 'pit_then_slide', 'fork_pit', 'three_lanes', 'step_dance', 'set_bridge_cables', 'bench_hurdles', 'hang_maze', 'twin_pits_slide', 'plat_gauntlet', 'gauntlet', 'spike_stream', 'dense_a', 'fork_row', 'fork_pit_row'],
    pouches: [{ slot: 13, col: 12, row: 10 }, { slot: 5, col: 8, row: 5 }], stars: { jellyPct: 75 } },
];
export const STAGE_BY_ID: Record<string, StageDef> = Object.fromEntries(STAGES.map(s => [s.id, s]));

/** Golden pouches a stage places: its own `pouches` plus the 'B' glyphs of the explicit course chunks (set pieces). */
export function stagePouchTotal(st: StageDef): number {
  let n = st.pouches?.length ?? 0;
  for (const slot of st.course ?? []) {
    if (typeof slot !== 'string') continue;
    const ch = CHUNKS.find(c => c.id === slot);
    if (ch) for (const row of ch.rows) for (const g of row) if (g === 'B') n++;
  }
  return n;
}
