# 청크 공정성 리포트 (자동 생성)

슬랙 = 판정 상자를 몇 px 키워도 여전히 무피격 통과가 가능한지 (최대 23). 클수록 여유로운 청크. 모든 청크는 단계별 최소 행동 창(250/200/150ms) 검사도 통과합니다.

| chunk | tiers | cols | slack@min | slack@max | jellies reachable | tags |
|---|---|---:|---:|---:|---:|---|
| tut_1_jump | 0–0 | 28 | 23 | 23 | 100% | tutorial |
| tut_2_double | 0–0 | 30 | 23 | 23 | 100% | tutorial |
| tut_3_slide | 0–0 | 28 | 14 | 14 | 100% | tutorial |
| tut_4_pit | 0–0 | 28 | 23 | 23 | 100% | tutorial |
| tut_5_platform | 0–2 | 30 | 23 | 23 | 100% | tutorial-extra platform |
| tut_6_recap | 1–2 | 44 | 14 | 14 | 100% | tutorial-extra combo |
| rest_meadow | 0–5 | 20 | 23 | 23 | 100% | rest |
| rest_wave | 0–5 | 24 | 23 | 23 | 100% | rest |
| rest_coins | 0–5 | 22 | 23 | 23 | 100% | rest bonus |
| rest_float | 0–5 | 24 | 23 | 23 | 100% | rest platform |
| jelly_hops | 0–5 | 28 | 23 | 23 | 100% | rest jump bonus |
| spike_single | 0–2 | 20 | 23 | 23 | 100% | jump |
| spike_two | 0–2 | 30 | 23 | 23 | 100% | jump |
| spike_wide | 0–3 | 22 | 23 | 23 | 100% | jump |
| spike_trio_far | 0–1 | 38 | 23 | 23 | 100% | jump rhythm |
| slide_short | 0–2 | 20 | 14 | 14 | 100% | slide |
| slide_pair | 0–2 | 28 | 14 | 14 | 100% | slide |
| slide_long | 0–2 | 24 | 14 | 14 | 100% | slide |
| pit_small | 1–3 | 20 | 23 | 23 | 100% | pit |
| pit_pair | 1–3 | 30 | 23 | 23 | 100% | pit |
| pit_wide | 1–3 | 22 | 23 | 23 | 100% | pit |
| plat_low | 0–2 | 26 | 23 | 23 | 100% | platform |
| fork_single | 0–2 | 22 | 23 | 23 | 100% | double |
| slide_trio | 0–1 | 34 | 14 | 14 | 100% | slide rhythm |
| fork_low_arch | 0–3 | 26 | 23 | 23 | 100% | double bonus |
| jump_slide | 1–3 | 28 | 14 | 14 | 100% | combo jump slide |
| slide_jump | 1–3 | 28 | 14 | 14 | 100% | combo slide jump |
| pit_plat | 1–3 | 30 | 23 | 23 | 100% | pit platform |
| stairs_up | 1–3 | 32 | 23 | 23 | 100% | platform stairs bonus |
| pit_bridge | 1–3 | 30 | 23 | 23 | 100% | pit platform |
| tunnel_short | 1–3 | 28 | 14 | 14 | 100% | slide tunnel |
| spike_rhythm | 1–3 | 34 | 23 | 23 | 100% | rhythm jump |
| fork_twice | 1–3 | 36 | 23 | 23 | 100% | double rhythm |
| plat_over_spikes | 1–3 | 30 | 23 | 23 | 100% | platform choice |
| pit_long_jump | 1–3 | 30 | 23 | 23 | 100% | pit double |
| bridge_spike | 1–3 | 30 | 23 | 23 | 100% | platform pit jump |
| tall_slide | 2–4 | 32 | 14 | 14 | 100% | combo double slide |
| two_lanes | 2–4 | 34 | 23 | 23 | 100% | choice platform jump |
| pit_to_ledge | 2–4 | 32 | 23 | 23 | 100% | pit platform jump |
| slide_jump_slide | 2–4 | 34 | 14 | 14 | 100% | rhythm slide jump |
| read_alternate | 2–4 | 38 | 14 | 14 | 100% | read jump slide |
| ceiling_run | 2–4 | 30 | 23 | 23 | 100% | read slide |
| stairs_spikes | 2–4 | 34 | 23 | 23 | 100% | platform stairs jump |
| wide_pit_double | 2–4 | 30 | 23 | 23 | 100% | pit double |
| tunnel_exit_spike | 2–4 | 32 | 14 | 14 | 100% | slide jump combo tunnel |
| bridge_hang | 2–4 | 32 | 14 | 14 | 100% | platform slide pit |
| twin_spike_beats | 2–4 | 34 | 23 | 23 | 100% | rhythm jump |
| fork_then_pit | 2–4 | 34 | 23 | 23 | 100% | double pit combo |
| pit_hops | 2–4 | 36 | 23 | 23 | 100% | pit rhythm |
| hang_pit | 2–4 | 32 | 14 | 14 | 100% | slide pit combo |
| beat_jjs | 3–5 | 38 | 14 | 14 | 100% | rhythm jump slide |
| beat_sjs | 3–5 | 38 | 14 | 14 | 100% | rhythm slide jump |
| tunnel_long | 3–5 | 38 | 14 | 14 | 100% | slide tunnel bonus |
| split_route | 3–5 | 38 | 23 | 23 | 100% | choice platform |
| pit_chain | 3–5 | 38 | 23 | 23 | 100% | pit rhythm |
| fork_slide_fork | 3–5 | 40 | 14 | 14 | 100% | combo double slide |
| plat_gauntlet | 3–5 | 38 | 23 | 23 | 100% | platform pit |
| stairs_choice | 3–5 | 38 | 23 | 23 | 100% | choice stairs platform |
| zigzag_read | 3–5 | 40 | 14 | 14 | 100% | read jump slide |
| twin_forks | 3–5 | 38 | 23 | 23 | 100% | double rhythm |
| pit_then_slide | 3–5 | 34 | 14 | 14 | 100% | pit slide combo |
| step_spikes | 3–5 | 32 | 23 | 23 | 100% | platform jump pit |
| ceiling_pit | 3–5 | 32 | 23 | 23 | 100% | read pit |
| bridge_slide_spike | 3–5 | 36 | 14 | 14 | 100% | platform slide jump pit |
| slide_fork_spike | 3–5 | 44 | 14 | 14 | 100% | combo slide double jump |
| coin_arcade | 3–5 | 34 | 23 | 23 | 100% | bonus choice platform |
| dense_a | 4–5 | 38 | 14 | 14 | 100% | rhythm jump slide |
| dense_b | 4–5 | 40 | 14 | 14 | 100% | rhythm read |
| sky_bridge | 4–5 | 40 | 23 | 23 | 100% | pit platform choice |
| fork_pit | 4–5 | 34 | 23 | 23 | 100% | double pit combo |
| hang_maze | 4–5 | 38 | 14 | 14 | 100% | read slide jump |
| plat_rhythm | 4–5 | 40 | 14 | 14 | 100% | platform rhythm pit |
| three_lanes | 4–5 | 40 | 15 | 14 | 100% | choice platform |
| tunnel_pit | 4–5 | 36 | 14 | 14 | 100% | slide pit tunnel combo |
| gauntlet | 4–5 | 44 | 14 | 14 | 100% | combo |
| step_dance | 4–5 | 38 | 23 | 23 | 100% | platform rhythm pit |
| fork_row | 4–5 | 40 | 23 | 23 | 100% | double rhythm |
| final_mix | 4–5 | 44 | 14 | 14 | 100% | combo choice |
| breather_spike | 2–5 | 24 | 23 | 23 | 100% | jump rest bonus |
| breather_slide | 2–5 | 26 | 14 | 14 | 100% | slide rest |
| breather_pit | 2–5 | 24 | 23 | 23 | 100% | pit rest |
| breather_fork | 2–5 | 28 | 23 | 23 | 100% | double rest bonus |
| bonus_float | 1–5 | 30 | 23 | 23 | 100% | bonus platform rest |
| spike_coin_hill | 0–2 | 22 | 23 | 23 | 100% | jump |
| bench_row | 0–2 | 34 | 23 | 23 | 100% | platform jump |
| slide_hill | 0–1 | 28 | 14 | 14 | 100% | slide |
| ceiling_stroll | 0–2 | 30 | 23 | 23 | 100% | tunnel jump |
| fork_bench | 0–2 | 28 | 23 | 23 | 100% | double platform |
| bench_boost | 0–2 | 28 | 23 | 23 | 100% | platform double |
| fork_spike_easy | 0–1 | 30 | 23 | 23 | 100% | combo double jump |
| slide_fork_easy | 0–1 | 30 | 14 | 14 | 100% | combo slide double |
| stairs_gentle | 0–2 | 32 | 23 | 23 | 100% | stairs platform jump |
| high_shelf | 0–2 | 30 | 23 | 23 | 100% | platform double choice |
| spike_cluster | 0–1 | 24 | 23 | 23 | 100% | jump |
| shelf_spike | 0–2 | 30 | 23 | 23 | 100% | platform choice jump |
| slide_bench | 0–2 | 30 | 14 | 14 | 100% | combo slide platform |
| lantern_taps | 0–1 | 30 | 14 | 14 | 100% | slide rhythm |
| spike_fork_easy | 0–1 | 30 | 23 | 23 | 100% | combo jump double |
| twin_shelves | 0–2 | 32 | 23 | 23 | 100% | platform jump |
| jelly_heart_spike | 0–2 | 24 | 23 | 23 | 100% | jump |
| slide_blip | 0–1 | 28 | 14 | 14 | 100% | slide |
| bench_pyramid | 0–2 | 30 | 23 | 23 | 100% | stairs platform jump |
| lantern_hop | 0–1 | 32 | 14 | 14 | 100% | combo slide jump |
| spike_double_arch | 0–2 | 24 | 23 | 23 | 100% | jump double |
| bench_to_slide | 0–2 | 30 | 14 | 14 | 100% | combo platform slide |
| rest_lanterns | 0–5 | 24 | 23 | 23 | 100% | rest |
| rest_bench | 0–5 | 26 | 23 | 23 | 100% | rest platform |
| pit_hop_row | 1–2 | 34 | 23 | 23 | 100% | pit rhythm |
| pit_bench | 1–3 | 34 | 23 | 23 | 100% | pit platform |
| pit_spike_easy | 1–2 | 30 | 23 | 23 | 100% | combo pit jump |
| slide_pit_easy | 1–2 | 30 | 14 | 14 | 100% | combo slide pit |
| pit_stone | 1–2 | 28 | 23 | 23 | 100% | pit platform |
| tunnel_gentle | 1–2 | 28 | 14 | 14 | 100% | tunnel slide |
| pit_tower | 1–3 | 32 | 23 | 23 | 100% | combo pit double |
| spike_pit_rhythm | 1–3 | 34 | 23 | 23 | 100% | rhythm jump pit |
| stairs_pit | 1–3 | 30 | 23 | 23 | 100% | stairs pit platform |
| double_pit | 1–2 | 26 | 23 | 23 | 100% | pit |
| stone_steps | 2–4 | 36 | 23 | 23 | 100% | pit platform rhythm |
| slide_fork_slide | 2–4 | 38 | 14 | 14 | 100% | combo slide double |
| ledge_leap | 4–5 | 36 | 23 | 23 | 100% | pit platform double |
| bridge_twin_spikes | 3–5 | 38 | 23 | 23 | 100% | platform pit rhythm |
| pit_ceiling | 3–5 | 40 | 23 | 23 | 100% | pit tunnel |
| stairs_descent | 4–5 | 36 | 23 | 23 | 100% | stairs platform choice |
| slide_bench_pit | 4–5 | 38 | 14 | 14 | 100% | combo slide platform pit |
| fork_spike_fork | 4–5 | 42 | 23 | 23 | 100% | double jump rhythm |
| danger_line | 3–5 | 38 | 14 | 14 | 100% | combo slide jump |
| planned_route | 3–5 | 40 | 23 | 23 | 100% | choice platform pit |
| spike_stream | 5–5 | 44 | 23 | 23 | 100% | rhythm jump double |
| fork_pit_row | 5–5 | 40 | 23 | 23 | 100% | double pit combo |
| ceiling_spike_mix | 4–5 | 40 | 23 | 23 | 100% | tunnel jump rhythm |
| slide_pit_spike | 4–5 | 34 | 14 | 14 | 100% | combo slide pit jump |
| bench_hurdles | 4–5 | 38 | 23 | 23 | 100% | platform jump rhythm |
| twin_pits_slide | 4–5 | 40 | 14 | 14 | 100% | pit slide combo |
| set_market_roofs | 1–5 | 44 | 23 | 23 | 100% | setpiece stairs platform |
| set_river_benches | 1–5 | 44 | 14 | 14 | 100% | setpiece platform pit slide |
| set_bridge_cables | 1–5 | 48 | 14 | 14 | 100% | setpiece tunnel double pit |
| set_dawn_rooftops | 1–5 | 48 | 23 | 23 | 100% | setpiece pit platform double |
