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
  /** golden pouches: placed at (col,row) of course slot `slot` (proven reachable hit-free by tests/stages.test.ts) */
  pouches?: { slot: number; col: number; row: number }[];
  remix?: boolean;
  stars: { jellyPct: number };
}

export const STAGES: StageDef[] = [
  // ---- W1 야시장 골목 (market) ----
  { id: '1-1', world: 1, index: 1, name: '첫걸음', intro: '가시 = 점프', biome: 'market', seed: 1101, tiers: [0, 0], length: 300,
    course: ['spike_single', 'jelly_heart_spike', 'spike_coin_hill', 'rest_wave', 'spike_two', 'spike_wide', 'bench_row', 'spike_cluster', 'spike_trio_far', 'twin_shelves', 'spike_double_arch'],
    pouches: [], stars: { jellyPct: 70 } },
  { id: '1-2', world: 1, index: 2, name: '찜통 탑', intro: '높은 탑 = 2단 점프', biome: 'market', seed: 1102, tiers: [0, 0], length: 350,
    course: ['spike_wide', 'fork_single', 'rest_meadow', 'fork_low_arch', 'fork_bench', 'spike_two', 'bench_boost', 'high_shelf', 'fork_spike_easy', 'rest_coins', 'spike_fork_easy', 'jelly_heart_spike', 'spike_double_arch'],
    pouches: [], stars: { jellyPct: 70 } },
  { id: '1-3', world: 1, index: 3, name: '초롱 아래로', intro: '걸림 = 슬라이드', biome: 'market', seed: 1103, tiers: [0, 1], length: 400,
    course: ['slide_blip', 'slide_short', 'spike_single', 'slide_pair', 'slide_hill', 'rest_lanterns', 'slide_long', 'lantern_taps', 'bench_to_slide', 'fork_spike_easy', 'lantern_hop', 'ceiling_stroll', 'fork_single', 'spike_fork_easy', 'slide_fork_easy'],
    pouches: [], stars: { jellyPct: 70 } },
  { id: '1-4', world: 1, index: 4, name: '꼬치 골목', intro: '점프와 슬라이드 섞기', biome: 'market', seed: 1104, tiers: [0, 1], length: 450,
    course: ['lantern_hop', 'spike_cluster', 'slide_fork_easy', 'bench_to_slide', 'fork_spike_easy', 'rest_bench', 'set_market_roofs', 'slide_jump', 'bench_boost', 'jump_slide', 'fork_single', 'shelf_spike', 'fork_low_arch', 'spike_fork_easy', 'fork_bench'],
    pouches: [], stars: { jellyPct: 70 } },
  { id: '1-5', world: 1, index: 5, name: '하수구 틈', intro: '구덩이는 점프로', biome: 'market', seed: 1105, tiers: [1, 1], length: 500,
    course: ['pit_small', 'spike_single', 'pit_wide', 'double_pit', 'rest_wave', 'pit_pair', 'pit_stone', 'fork_single', 'pit_plat', 'slide_pit_easy', 'pit_spike_easy', 'set_market_roofs', 'pit_hop_row', 'pit_tower', 'fork_low_arch', 'bench_boost', 'spike_pit_rhythm'],
    pouches: [], stars: { jellyPct: 70 } },
  { id: '1-6', world: 1, index: 6, name: '야시장 한 바퀴', intro: '야시장 총정리', biome: 'market', seed: 1106, tiers: [1, 1], length: 550,
    course: ['spike_wide', 'tut_6_recap', 'fork_single', 'slide_fork_easy', 'pit_pair', 'bench_boost', 'rest_coins', 'jump_slide', 'pit_long_jump', 'high_shelf', 'set_market_roofs', 'spike_rhythm', 'fork_low_arch', 'pit_tower', 'slide_jump', 'fork_twice', 'bridge_spike', 'fork_spike_easy'],
    pouches: [], stars: { jellyPct: 70 } },
  { id: '1-R', world: 1, index: 7, name: '한밤 골목', intro: '더 빠른 한밤 야시장', biome: 'market', seed: 1107, tiers: [2, 2], length: 550, remix: true,
    course: ['spike_wide', 'tut_6_recap', 'tall_slide', 'stone_steps', 'pit_to_ledge', 'bench_boost', 'set_market_roofs', 'twin_spike_beats', 'fork_then_pit', 'read_alternate', 'fork_single', 'pit_hops', 'two_lanes', 'stairs_spikes', 'fork_twice', 'fork_bench'],
    pouches: [], stars: { jellyPct: 70 } },

  // ---- W2 포장마차 강변 (riverside) ----
  { id: '2-1', world: 2, index: 1, name: '평상 위로', intro: '발판 위로 점프!', biome: 'riverside', seed: 2101, tiers: [1, 1], length: 500,
    course: ['tut_5_platform', 'plat_low', 'rest_float', 'twin_shelves', 'bench_row', 'shelf_spike', 'pit_plat', 'high_shelf', 'slide_bench', 'set_river_benches', 'pit_stone', 'plat_over_spikes', 'bench_boost', 'pit_bridge', 'fork_bench', 'pit_bench', 'bench_pyramid'],
    pouches: [], stars: { jellyPct: 70 } },
  { id: '2-2', world: 2, index: 2, name: '천막 사다리', intro: '계단 발판 오르기', biome: 'riverside', seed: 2102, tiers: [1, 2], length: 550,
    course: ['bench_pyramid', 'stairs_gentle', 'rest_meadow', 'stairs_up', 'pit_bench', 'stairs_pit', 'fork_bench', 'set_river_benches', 'stone_steps', 'stairs_spikes', 'bonus_float', 'bench_boost', 'two_lanes', 'pit_tower', 'plat_over_spikes', 'bridge_spike'],
    pouches: [], stars: { jellyPct: 70 } },
  { id: '2-3', world: 2, index: 3, name: '쏙 내려오기', intro: '공중 슬라이드로 쏙!', biome: 'riverside', seed: 2103, tiers: [2, 2], length: 600,
    course: ['breather_spike', 'jump_slide', 'slide_jump_slide', 'tunnel_exit_spike', 'hang_pit', 'set_river_benches', 'tall_slide', 'bridge_hang', 'ceiling_run', 'read_alternate', 'fork_then_pit', 'slide_fork_slide', 'pit_to_ledge', 'twin_spike_beats', 'breather_slide', 'wide_pit_double', 'stairs_spikes'],
    pouches: [], stars: { jellyPct: 70 } },
  { id: '2-4', world: 2, index: 4, name: '두 갈래 길', intro: '위로 갈까, 아래로 갈까', biome: 'riverside', seed: 2104, tiers: [2, 2], length: 650,
    course: ['shelf_spike', 'high_shelf', 'twin_shelves', 'plat_over_spikes', 'two_lanes', 'breather_fork', 'bench_row', 'pit_bench', 'set_river_benches', 'bridge_hang', 'pit_to_ledge', 'bonus_float', 'stairs_spikes', 'split_route', 'read_alternate', 'fork_then_pit', 'tall_slide', 'stairs_choice', 'coin_arcade'],
    pouches: [], stars: { jellyPct: 70 } },
  { id: '2-5', world: 2, index: 5, name: '강바람', intro: '박자에 맞춰 달려요', biome: 'riverside', seed: 2105, tiers: [2, 3], length: 700,
    course: ['spike_rhythm', 'slide_trio', 'pit_hop_row', 'breather_spike', 'twin_spike_beats', 'slide_jump_slide', 'spike_pit_rhythm', 'fork_twice', 'set_river_benches', 'pit_hops', 'stone_steps', 'breather_slide', 'beat_jjs', 'beat_sjs', 'pit_chain', 'twin_forks', 'zigzag_read', 'breather_pit', 'bridge_twin_spikes', 'fork_slide_fork'],
    pouches: [], stars: { jellyPct: 70 } },
  { id: '2-6', world: 2, index: 6, name: '포장마차 종점', intro: '강변 총정리', biome: 'riverside', seed: 2106, tiers: [3, 3], length: 800,
    course: ['breather_spike', 'stairs_spikes', 'two_lanes', 'slide_jump_slide', 'pit_to_ledge', 'twin_spike_beats', 'breather_slide', 'stone_steps', 'set_river_benches', 'tall_slide', 'split_route', 'beat_jjs', 'hang_pit', 'pit_hops', 'breather_fork', 'stairs_choice', 'bridge_slide_spike', 'twin_forks', 'zigzag_read', 'plat_gauntlet', 'fork_slide_fork', 'beat_sjs'],
    pouches: [], stars: { jellyPct: 70 } },
  { id: '2-R', world: 2, index: 7, name: '비 오는 강변', intro: '빗길 강변 리믹스', biome: 'riverside', seed: 2107, tiers: [4, 4], length: 800, remix: true,
    course: ['breather_spike', 'bench_hurdles', 'plat_rhythm', 'dense_a', 'breather_slide', 'stairs_descent', 'set_river_benches', 'fork_spike_fork', 'three_lanes', 'slide_bench_pit', 'step_dance', 'breather_fork', 'dense_b', 'sky_bridge', 'fork_pit', 'hang_maze', 'ledge_leap', 'final_mix', 'beat_sjs', 'twin_pits_slide'],
    pouches: [], stars: { jellyPct: 70 } },

  // ---- W3 불꽃놀이 다리 (bridge) ----
  { id: '3-1', world: 3, index: 1, name: '다리 입구', intro: '구덩이 건너 발판으로', biome: 'bridge', seed: 3101, tiers: [3, 3], length: 700,
    course: ['breather_pit', 'pit_plat', 'pit_bridge', 'stairs_pit', 'pit_bench', 'bridge_spike', 'pit_to_ledge', 'breather_spike', 'bridge_hang', 'set_bridge_cables', 'wide_pit_double', 'stone_steps', 'step_spikes', 'bridge_slide_spike', 'plat_gauntlet', 'bridge_twin_spikes', 'planned_route', 'pit_long_jump'],
    pouches: [], stars: { jellyPct: 70 } },
  { id: '3-2', world: 3, index: 2, name: '불꽃 터널', intro: '천장 아래 몸을 낮춰요', biome: 'bridge', seed: 3102, tiers: [3, 4], length: 750,
    course: ['tunnel_short', 'ceiling_run', 'breather_slide', 'tunnel_exit_spike', 'hang_pit', 'ceiling_pit', 'tunnel_long', 'set_bridge_cables', 'pit_ceiling', 'breather_spike', 'bridge_hang', 'beat_sjs', 'hang_maze', 'tunnel_pit', 'ceiling_spike_mix', 'dense_b', 'slide_bench_pit', 'danger_line', 'pit_then_slide'],
    pouches: [], stars: { jellyPct: 70 } },
  { id: '3-3', world: 3, index: 3, name: '끊어진 난간', intro: '구덩이가 줄줄이 와요', biome: 'bridge', seed: 3103, tiers: [3, 4], length: 800,
    course: ['breather_pit', 'pit_hops', 'wide_pit_double', 'pit_then_slide', 'pit_chain', 'breather_spike', 'plat_gauntlet', 'set_bridge_cables', 'fork_then_pit', 'step_spikes', 'hang_pit', 'sky_bridge', 'twin_pits_slide', 'breather_fork', 'step_dance', 'fork_pit', 'ledge_leap', 'slide_pit_spike', 'tunnel_pit', 'plat_rhythm'],
    pouches: [], stars: { jellyPct: 70 } },
  { id: '3-4', world: 3, index: 4, name: '박자 맞추기', intro: '슬라이드, 점프, 슬라이드!', biome: 'bridge', seed: 3104, tiers: [4, 4], length: 850,
    course: ['breather_slide', 'slide_jump_slide', 'beat_sjs', 'beat_jjs', 'breather_spike', 'read_alternate', 'zigzag_read', 'set_bridge_cables', 'dense_b', 'danger_line', 'slide_pit_spike', 'breather_fork', 'ceiling_spike_mix', 'hang_maze', 'dense_a', 'slide_fork_spike', 'tunnel_exit_spike', 'gauntlet', 'slide_bench_pit', 'twin_pits_slide', 'final_mix'],
    pouches: [], stars: { jellyPct: 70 } },
  { id: '3-5', world: 3, index: 5, name: '세 갈래 불빛', intro: '세 갈래 길을 골라요', biome: 'bridge', seed: 3105, tiers: [4, 5], length: 900,
    course: ['breather_spike', 'two_lanes', 'split_route', 'stairs_choice', 'breather_fork', 'coin_arcade', 'three_lanes', 'set_bridge_cables', 'sky_bridge', 'stairs_descent', 'bench_hurdles', 'planned_route', 'breather_slide', 'final_mix', 'plat_rhythm', 'fork_spike_fork', 'danger_line', 'dense_a', 'ledge_leap', 'fork_pit', 'step_dance', 'gauntlet', 'spike_stream'],
    pouches: [], stars: { jellyPct: 70 } },
  { id: '3-6', world: 3, index: 6, name: '보름달 언덕', intro: '마지막 시험이에요', biome: 'bridge', seed: 3106, tiers: [5, 5], length: 1000,
    course: ['breather_spike', 'beat_jjs', 'pit_chain', 'fork_slide_fork', 'breather_slide', 'plat_gauntlet', 'zigzag_read', 'twin_forks', 'set_bridge_cables', 'bridge_twin_spikes', 'dense_a', 'breather_pit', 'three_lanes', 'fork_pit', 'hang_maze', 'plat_rhythm', 'breather_fork', 'gauntlet', 'step_dance', 'fork_row', 'slide_pit_spike', 'final_mix', 'fork_pit_row', 'danger_line', 'spike_stream', 'planned_route'],
    pouches: [], stars: { jellyPct: 70 } },
  { id: '3-R', world: 3, index: 7, name: '불꽃 대폭발', intro: '불꽃놀이 리믹스', biome: 'bridge', seed: 3107, tiers: [5, 5], length: 1000, remix: true,
    course: ['breather_pit', 'dense_b', 'fork_row', 'pit_ceiling', 'breather_spike', 'sky_bridge', 'beat_sjs', 'fork_spike_fork', 'set_bridge_cables', 'twin_pits_slide', 'stairs_choice', 'dense_a', 'breather_slide', 'ledge_leap', 'gauntlet', 'bench_hurdles', 'ceiling_spike_mix', 'fork_pit_row', 'step_spikes', 'breather_fork', 'final_mix', 'spike_stream', 'split_route', 'tunnel_pit', 'pit_chain', 'stairs_descent'],
    pouches: [], stars: { jellyPct: 70 } },
];
export const STAGE_BY_ID: Record<string, StageDef> = Object.fromEntries(STAGES.map(s => [s.id, s]));
