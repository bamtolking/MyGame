# 골목 지도 스테이지 표 (자동 생성: `npx vitest run tests/stage-balance.test.ts`)

캐주얼 봇(`tests/bot.ts` playRun, 흔들림 9프레임 / 판정 여유 2px)이 스테이지마다 시드 30개로 한 번씩 달린 결과입니다.

- **첫 시도 ★1**: 결승까지 간 비율. 괄호는 GDD 목표(W1 95→85 %, W2 85→70 %, W3 75→55 %, 리믹스 40 % 이상).
- **★2**: 별사탕 비율 기준. 완주한 판들의 p55를 5 단위로 내리고 60–90으로 묶은 값.
- **복주머니**: 코스 순서대로 `청크 열,행`(세트피스 안의 것은 `B`). 스테이지마다 높은 길(발판·2단 점프 정점), 위험한 줄(위험물 사이의 낮은 줄), 계획형(일찍 보이고 길을 골라야 하는 것)이 하나씩 있습니다.
  캐주얼 봇은 일부러 먹으러 가지 않으므로 이 값은 "게으른 길에서 저절로 먹히는 비율"입니다(목표 약 70 / 50 / 40 %). 판이 일찍 끝나면 뒤쪽 복주머니는 못 먹은 것으로 셉니다.
- 코스는 고정입니다(`src/data/stages.ts`). 모든 스테이지는 `landing`으로 시작해 `finish_runout`으로 끝납니다.

| id | 이름 | 소개 | 풍경 | 길이(m) | 티어 | 시간(s) | 첫 시도 ★1 | ★2 | 복주머니 (캐주얼 봇 획득률 · 위치) |
|---|---|---|---|---:|---|---:|---:|---:|---|
| 1-1 | 첫걸음 | 가시는 점프로 넘어요 | market | 294 | 0–0 | 28 | 100% (95) | 70% | 37% spike_two 14,10 · 37% bench_row 19,8 · 60% twin_shelves 13,5 |
| 1-2 | 찜통 탑 | 높은 탑은 2단 점프로 넘어요 | market | 336 | 0–0 | 32 | 93% (93) | 75% | 47% spike_two 14,10 · 33% high_shelf 6,7 · 67% fork_spike_easy 8,3 |
| 1-3 | 초롱 아래로 | 초롱 아래는 슬라이드로 지나가요 | market | 390 | 0–1 | 36 | 100% (91) | 85% | 0% bench_to_slide 6,8 · 57% fork_spike_easy 8,3 · 47% slide_fork_easy 13,9 |
| 1-4 | 꼬치 골목 | 점프와 슬라이드를 섞어 써요 | market | 480 | 0–1 | 44 | 93% (89) | 70% | 47% slide_fork_easy 13,9 · 40% spike_fork_easy 22,4 · 77% set_market_roofs B |
| 1-5 | 하수구 틈 | 구덩이는 점프로 건너요 | market | 456 | 1–1 | 39 | 93% (87) | 65% | 83% set_market_roofs B · 40% pit_bridge 13,8 · 57% pit_hops 12,9 |
| 1-6 | 야시장 한 바퀴 | 야시장을 한 바퀴 돌며 복습해요 | market | 574 | 1–1 | 50 | 83% (85) | 70% | 43% pit_pair 15,10 · 40% high_shelf 6,7 · 0% set_market_roofs B |
| 1-R | 한밤 골목 | 더 빨라진 한밤 야시장이에요 | market | 538 | 2–2 | 43 | 70% (≥40) | 65% | 40% two_lanes 10,5 · 27% set_market_roofs B · 53% read_alternate 16,10 |
| 2-1 | 평상 위로 | 평상 위로 뛰어올라요 | riverside | 498 | 1–1 | 43 | 93% (85) | 65% | 70% twin_shelves 13,5 · 40% bench_row 19,8 · 97% set_river_benches B |
| 2-2 | 천막 사다리 | 천막 계단을 밟고 올라가요 | riverside | 570 | 1–2 | 48 | 90% (82) | 60% | 77% stairs_gentle 17,4 · 37% stairs_pit 12,6 · 0% set_river_benches B |
| 2-3 | 쏙 내려오기 | 공중에서 슬라이드로 쏙 내려와요 | riverside | 622 | 2–2 | 50 | 77% (79) | 70% | 70% slide_fork_slide 14,3 · 100% set_river_benches B · 50% stone_steps 24,8 |
| 2-4 | 두 갈래 길 | 위아래 두 갈래 중 골라요 | riverside | 678 | 2–2 | 54 | 73% (76) | 65% | 100% set_river_benches B · 67% two_lanes 22,5 · 40% split_route 12,4 |
| 2-5 | 강바람 | 강바람 박자에 맞춰 뛰어요 | riverside | 728 | 2–3 | 56 | 73% (73) | 65% | 70% fork_twice 10,3 · 100% set_river_benches B · 40% bridge_twin_spikes 4,7 |
| 2-6 | 포장마차 종점 | 강변에서 배운 걸 모두 써요 | riverside | 832 | 3–3 | 61 | 70% (70) | 60% | 70% breather_fork 13,2 · 43% planned_route 8,5 · 93% set_river_benches B |
| 2-R | 비 오는 강변 | 비 오는 강변은 더 빨라요 | riverside | 784 | 4–4 | 53 | 57% (≥40) | 70% | 40% bench_hurdles 16,8 · 100% set_river_benches B · 70% fork_spike_fork 7,3 |
| 3-1 | 다리 입구 | 구덩이를 건너 발판에 올라요 | bridge | 716 | 3–3 | 53 | 80% (75) | 65% | 50% pit_to_ledge 12,9 · 93% set_bridge_cables B · 40% planned_route 23,4 |
| 3-2 | 불꽃 터널 | 불꽃 터널에선 몸을 낮춰요 | bridge | 756 | 3–4 | 53 | 73% (71) | 80% | 43% pit_ceiling 8,6 · 53% slide_fork_spike 13,9 · 90% set_bridge_cables B |
| 3-3 | 끊어진 난간 | 끊어진 난간을 줄줄이 건너요 | bridge | 852 | 3–4 | 60 | 70% (67) | 75% | 50% pit_hops 12,9 · 40% planned_route 23,4 · 80% set_bridge_cables B |
| 3-4 | 박자 맞추기 | 슬라이드와 점프를 빠르게 바꿔요 | bridge | 852 | 4–4 | 58 | 60% (63) | 80% | 43% bridge_slide_spike 27,7 · 53% beat_sjs 18,10 · 90% set_bridge_cables B |
| 3-5 | 세 갈래 불빛 | 세 갈래 불빛 중 하나를 골라요 | bridge | 938 | 4–5 | 61 | 67% (59) | 70% | 40% two_lanes 15,5 · 53% hang_maze 29,10 · 90% set_bridge_cables B |
| 3-6 | 보름달 언덕 | 보름달까지 마지막 시험이에요 | bridge | 1008 | 5–5 | 63 | 53% (55) | 70% | 40% split_route 18,5 · 53% danger_line 26,10 · 3% set_bridge_cables B |
| 3-R | 불꽃 대폭발 | 불꽃이 터지는 마지막 골목이에요 | bridge | 970 | 5–5 | 61 | 47% (≥40) | 75% | 40% planned_route 8,5 · 50% fork_pit 12,10 · 83% set_bridge_cables B |
