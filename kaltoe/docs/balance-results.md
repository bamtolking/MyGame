# 밸런스 스윕 결과 (헤드리스 봇)

스테이지 × 복지 투자액 × 시드 6개. 봇 = 자동 회피 + 무난한 선택(시작 무기 우선, 진화 짝 패시브 선호). `npm run balance`로 재생성.

| 스테이지 | 복지 투자 | 칼퇴율 | 평균 생존 | Lv@12시 | Lv@15시 | Lv@18시 | 평균 처치 | 평균 월급 | 첫 진화(초) | 최대 동시 적 | 사망 원인 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| office | ₩0 | 0/6 | 361s | 10.3 | 19.5 | 0.0 | 3924 | 121 | - (0/6) | 188 | KPI 그래프@299, 결재 서류@312, 탄막@182, 전화벨@176 |
| office | ₩1,500 | 2/6 | 363s | 9.3 | 38.0 | 88.0 | 4290 | 182 | 403 (2/6) | 190 | 탄막@302, 탄막@151, KPI 그래프@193, 결재 서류@334 |
| crunch | ₩1,500 | 1/6 | 216s | 13.0 | 30.0 | 81.0 | 2343 | 101 | 527 (1/6) | 169 | 결재 서류@105, 유령 업무@120, 버그@134, 버그@176, 유령 업무@162 |
| crunch | ₩5,000 | 3/6 | 404s | 11.5 | 52.0 | 90.0 | 6201 | 377 | 481 (3/6) | 215 | 탄막@340, 긴급 이슈@145, 버그@141 |
| dinner | ₩5,000 | 0/6 | 137s | 0.0 | 0.0 | 0.0 | 481 | 3 | - (0/6) | 183 | 생맥주@113, 위험 지대@147, 소주병@109, 탄막@138, 생맥주@164, 소주병@150 |
| dinner | ₩12,000 | 2/6 | 376s | 13.5 | 73.0 | 93.5 | 6457 | 492 | 319 (2/6) | 211 | 탄막@185, 건배사 과장@307, 폭탄주@200, 탄막@366 |
| holiday | ₩12,000 | 0/6 | 234s | 14.0 | 50.0 | 0.0 | 2890 | 193 | 577 (1/6) | 266 | 송편@123, 송편@117, 내리찍기@325, 송편@129, 취업 잔소리@112 |
| holiday | ₩25,000 | 1/6 | 414s | 16.2 | 53.3 | 107.0 | 6834 | 645 | 269 (2/6) | 225 | 모둠전@347, 결혼 잔소리@165, 설거지 더미@471, 몸무게 잔소리@299 |

## 판별 상세
### office ₩0
- 사망 299s Lv9 처치 1720 받은피해 154 궁 3 상자 3 진화 [] 보스 [team_lead] 무기 [pen:3 ctrlz:2 folder:1 drone:1 card:3] 패시브 [shortcut:2 grit:4] 0.055ms/step
- 사망 640s Lv19 처치 8918 받은피해 204 궁 11 상자 3 진화 [] 보스 [team_lead] 무기 [pen:4 toner:5 clip:3 keyboard:5 cards:2 card:2] 패시브 [multitask:2 stocks:2 shortcut:1] 0.083ms/step
- 사망 640s Lv80 처치 9071 받은피해 95 궁 11 상자 2 진화 [] 보스 [team_lead] 무기 [pen:8 keyboard:8 laser:8 cards:8 ctrlz:8 folder:8] 패시브 [multitask:2 busybody:5 mental:5 vitamin:5 gym:5 grit:5] 0.080ms/step
- 사망 312s Lv13 처치 2325 받은피해 201 궁 4 상자 3 진화 [] 보스 [team_lead] 무기 [pen:7 toner:3 alarm:1 drone:2 card:1] 패시브 [gym:4] 0.031ms/step
- 사망 182s Lv8 처치 793 받은피해 101 궁 1 상자 0 진화 [] 보스 [] 무기 [pen:2 postit:2 ctrlz:2] 패시브 [gym:2] 0.032ms/step
- 사망 176s Lv8 처치 715 받은피해 126 궁 1 상자 0 진화 [] 보스 [] 무기 [pen:1 clip:2 folder:2 drone:2] 패시브 [multitask:1] 0.029ms/step
### office ₩1,500
- 칼퇴 600s Lv90 처치 11526 받은피해 158 궁 13 상자 8 진화 [fountain_storm, crane_squadron, clip_gatling] 보스 [team_lead, bujang] 무기 [fountain_storm:1 crane_squadron:1 card:8 alarm:8 clip_gatling:1 postit:8] 패시브 [busybody:5 multitask:2 grit:5 energy:5 shortcut:5 nunchi:5] 0.067ms/step
- 사망 302s Lv9 처치 1341 받은피해 247 궁 2 상자 0 진화 [] 보스 [] 무기 [pen:2 ctrlz:1 cards:1 postit:1 coffee:1] 패시브 [mental:1 lunchbox:1 grit:1] 0.064ms/step
- 칼퇴 600s Lv86 처치 9633 받은피해 72 궁 11 상자 7 진화 [vip_cards, mech_keyboard, presentation_beam, drone_squad, clip_gatling] 보스 [team_lead, bujang] 무기 [pen:8 mech_keyboard:1 presentation_beam:1 drone_squad:1 clip_gatling:1 vip_cards:1] 패시브 [gym:5 nunchi:5 busybody:5 lunchbox:5 grit:5 shortcut:5] 0.063ms/step
- 사망 151s Lv7 처치 622 받은피해 124 궁 1 상자 0 진화 [] 보스 [] 무기 [pen:1 postit:2 ctrlz:2] 패시브 [gym:1 clover:1] 0.019ms/step
- 사망 193s Lv9 처치 788 받은피해 119 궁 1 상자 0 진화 [] 보스 [] 무기 [pen:3 toner:2 folder:2 drone:1] 패시브 [speedread:1] 0.030ms/step
- 사망 334s Lv10 처치 1832 받은피해 190 궁 3 상자 0 진화 [] 보스 [] 무기 [pen:2 drone:1 postit:1 card:1 clip:2] 패시브 [lunchbox:1 nunchi:1 multitask:1] 0.044ms/step
### crunch ₩1,500
- 사망 105s Lv4 처치 280 받은피해 131 궁 0 상자 0 진화 [] 보스 [] 무기 [pen:1 laser:1 alarm:1] 패시브 [lunchbox:1] 0.033ms/step
- 사망 120s Lv7 처치 348 받은피해 136 궁 0 상자 0 진화 [] 보스 [] 무기 [pen:1 cards:1 folder:2 plane:1] 패시브 [lunchbox:1 energy:1] 0.028ms/step
- 사망 134s Lv5 처치 376 받은피해 117 궁 0 상자 0 진화 [] 보스 [] 무기 [pen:1 ctrlz:1 laser:1] 패시브 [shortcut:1 multitask:1] 0.040ms/step
- 사망 176s Lv8 처치 705 받은피해 170 궁 1 상자 0 진화 [] 보스 [] 무기 [pen:3 drone:1 folder:1] 패시브 [multitask:1 gym:2] 0.049ms/step
- 사망 162s Lv8 처치 673 받은피해 122 궁 1 상자 0 진화 [] 보스 [] 무기 [pen:1 drone:1 cards:2 laser:1] 패시브 [multitask:2 grit:1] 0.033ms/step
- 칼퇴 600s Lv81 처치 11676 받은피해 137 궁 13 상자 4 진화 [fountain_storm, clip_gatling, mech_keyboard] 보스 [pm, director] 무기 [fountain_storm:1 ctrlz:8 clip_gatling:1 mech_keyboard:1 folder:8 plane:8] 패시브 [multitask:2 gym:5 shortcut:5 mental:5 busybody:5 lunchbox:5] 0.073ms/step
### crunch ₩5,000
- 칼퇴 631s Lv93 처치 12298 받은피해 38 궁 14 상자 7 진화 [fountain_storm, ctrl_alt_del, crane_squadron] 보스 [pm, director] 무기 [fountain_storm:1 keyboard:8 ctrl_alt_del:1 laser:8 toner:8 crane_squadron:1] 패시브 [lunchbox:5 clover:5 energy:5 multitask:2 vitamin:5 mental:5] 0.063ms/step
- 사망 340s Lv14 처치 1990 받은피해 221 궁 3 상자 0 진화 [] 보스 [] 무기 [pen:2 clip:1 plane:1 card:1 cards:1 coffee:1] 패시브 [shortcut:2 multitask:2 vitamin:1 lunchbox:1 grit:1] 0.069ms/step
- 사망 145s Lv7 처치 615 받은피해 137 궁 1 상자 0 진화 [] 보스 [] 무기 [pen:2 postit:3 ctrlz:1 drone:1] 패시브 [] 0.022ms/step
- 칼퇴 600s Lv99 처치 12372 받은피해 189 궁 14 상자 6 진화 [fountain_storm, presentation_beam, clockout_bell, ctrl_alt_del] 보스 [pm, director] 무기 [fountain_storm:1 keyboard:8 presentation_beam:1 clockout_bell:1 ctrl_alt_del:1 folder:8] 패시브 [mental:5 multitask:2 selfhelp:5 clover:5 busybody:5 stocks:5] 0.048ms/step
- 칼퇴 630s Lv78 처치 9467 받은피해 373 궁 12 상자 1 진화 [fountain_storm, drone_squad, clip_gatling] 보스 [pm, director] 무기 [fountain_storm:1 drone_squad:1 coffee:8 clip_gatling:1 card:8 keyboard:8] 패시브 [nunchi:5 multitask:2 shortcut:5 stocks:5 vitamin:5 grit:5] 0.098ms/step
- 사망 141s Lv7 처치 464 받은피해 137 궁 1 상자 0 진화 [] 보스 [] 무기 [pen:1 drone:3 cards:1 plane:1] 패시브 [gym:1] 0.036ms/step
### dinner ₩5,000
- 사망 113s Lv5 처치 214 받은피해 134 궁 0 상자 0 진화 [] 보스 [] 무기 [pen:3] 패시브 [multitask:2] 0.047ms/step
- 사망 147s Lv7 처치 498 받은피해 145 궁 1 상자 0 진화 [] 보스 [] 무기 [pen:3 coffee:1 folder:1 laser:1] 패시브 [speedread:1] 0.057ms/step
- 사망 109s Lv5 처치 247 받은피해 143 궁 0 상자 0 진화 [] 보스 [] 무기 [pen:2 postit:1 folder:1] 패시브 [multitask:1] 0.040ms/step
- 사망 138s Lv5 처치 555 받은피해 162 궁 1 상자 0 진화 [] 보스 [] 무기 [pen:1 toner:1 folder:1] 패시브 [vitamin:1 multitask:1] 0.032ms/step
- 사망 164s Lv8 처치 795 받은피해 160 궁 1 상자 0 진화 [] 보스 [] 무기 [pen:2 plane:1 alarm:1 keyboard:1] 패시브 [selfhelp:2 energy:1] 0.031ms/step
- 사망 150s Lv7 처치 578 받은피해 142 궁 1 상자 0 진화 [] 보스 [] 무기 [pen:1 laser:1 postit:2 clip:1] 패시브 [mental:2] 0.041ms/step
### dinner ₩12,000
- 칼퇴 600s Lv107 처치 17342 받은피해 340 궁 19 상자 7 진화 [fountain_storm, ink_flood, mech_keyboard, vip_cards, black_card] 보스 [toast_master, bomb_bujang] 무기 [fountain_storm:1 ink_flood:1 mech_keyboard:1 vip_cards:1 coffee:8 black_card:1] 패시브 [multitask:2 shortcut:5 gym:5 grit:5 passion:5 stocks:5] 0.071ms/step
- 사망 185s Lv10 처치 961 받은피해 236 궁 2 상자 0 진화 [] 보스 [] 무기 [pen:1 card:1 clip:3 coffee:1] 패시브 [gym:1 lunchbox:2 stocks:1] 0.049ms/step
- 사망 307s Lv12 처치 2365 받은피해 388 궁 4 상자 0 진화 [] 보스 [] 무기 [pen:1 drone:3 coffee:2 keyboard:2 alarm:1] 패시브 [nunchi:2 lunchbox:1] 0.048ms/step
- 사망 200s Lv9 처치 1176 받은피해 182 궁 2 상자 0 진화 [] 보스 [] 무기 [pen:3 toner:1 card:1 coffee:2 keyboard:1] 패시브 [stocks:1] 0.040ms/step
- 칼퇴 600s Lv80 처치 14075 받은피해 203 궁 17 상자 9 진화 [fountain_storm, mech_keyboard, ctrl_alt_del, clockout_bell, clip_gatling] 보스 [toast_master, bomb_bujang] 무기 [fountain_storm:1 ctrl_alt_del:1 clockout_bell:1 clip_gatling:1 mech_keyboard:1 plane:8] 패시브 [gym:5 multitask:2 selfhelp:5 clover:5 busybody:5 shortcut:5] 0.048ms/step
- 사망 366s Lv13 처치 2822 받은피해 434 궁 5 상자 3 진화 [] 보스 [toast_master] 무기 [pen:3 card:2 clip:5 coffee:2] 패시브 [multitask:2 shortcut:2 stocks:4] 0.064ms/step
### holiday ₩12,000
- 사망 123s Lv4 처치 319 받은피해 149 궁 0 상자 0 진화 [] 보스 [] 무기 [pen:1 card:1 alarm:1] 패시브 [mental:1] 0.077ms/step
- 사망 640s Lv100 처치 13935 받은피해 143 궁 16 상자 5 진화 [fountain_storm, mech_keyboard, clip_gatling, crane_squadron, ctrl_alt_del] 보스 [uncle] 무기 [fountain_storm:1 mech_keyboard:1 clip_gatling:1 crane_squadron:1 ctrl_alt_del:1 coffee:8] 패시브 [multitask:2 busybody:5 gym:5 energy:5 clover:5 shortcut:5] 0.083ms/step
- 사망 117s Lv4 처치 89 받은피해 172 궁 0 상자 0 진화 [] 보스 [] 무기 [pen:1] 패시브 [shortcut:1 multitask:2] 0.103ms/step
- 사망 325s Lv19 처치 2446 받은피해 279 궁 4 상자 0 진화 [] 보스 [] 무기 [pen:2 keyboard:2 folder:2 postit:2 alarm:1 clip:1] 패시브 [multitask:2 selfhelp:3 shortcut:3 mental:1] 0.045ms/step
- 사망 129s Lv7 처치 428 받은피해 180 궁 1 상자 0 진화 [] 보스 [] 무기 [pen:2 cards:1 postit:2 laser:2] 패시브 [] 0.046ms/step
- 사망 112s Lv4 처치 121 받은피해 173 궁 0 상자 0 진화 [] 보스 [] 무기 [pen:2 drone:1] 패시브 [shortcut:1] 0.077ms/step
### holiday ₩25,000
- 사망 347s Lv14 처치 2897 받은피해 336 궁 6 상자 2 진화 [] 보스 [uncle] 무기 [pen:2 clip:1 card:3 coffee:3 toner:1] 패시브 [multitask:2 lunchbox:1 shortcut:1 vitamin:2] 0.045ms/step
- 사망 165s Lv8 처치 671 받은피해 203 궁 1 상자 0 진화 [] 보스 [] 무기 [pen:2 laser:2 clip:1 postit:1] 패시브 [gym:1 busybody:1] 0.062ms/step
- 사망 471s Lv21 처치 5241 받은피해 490 궁 9 상자 1 진화 [] 보스 [uncle] 무기 [pen:3 keyboard:4 drone:3 coffee:4 ctrlz:5] 패시브 [nunchi:1 mental:1 clover:1 gym:1 lunchbox:1] 0.076ms/step
- 사망 299s Lv26 처치 2376 받은피해 389 궁 5 상자 1 진화 [] 보스 [uncle] 무기 [pen:7 alarm:3 drone:5 coffee:2 toner:2] 패시브 [passion:2 selfhelp:3 shortcut:1 multitask:2] 0.047ms/step
- 사망 640s Lv108 처치 15855 받은피해 151 궁 19 상자 6 진화 [fountain_storm, mech_keyboard, approval_storm, drone_squad] 보스 [uncle] 무기 [fountain_storm:1 mech_keyboard:1 approval_storm:1 alarm:8 drone_squad:1 cards:8] 패시브 [lunchbox:5 gym:5 multitask:2 speedread:5 nunchi:5 clover:5] 0.061ms/step
- 칼퇴 600s Lv107 처치 13966 받은피해 110 궁 18 상자 9 진화 [fountain_storm, mech_keyboard, caffeine_overdrive, clip_gatling, presentation_beam] 보스 [uncle, big_aunt] 무기 [fountain_storm:1 card:8 mech_keyboard:1 caffeine_overdrive:1 clip_gatling:1 presentation_beam:1] 패시브 [multitask:2 busybody:5 shortcut:5 gym:5 lunchbox:5 grit:5] 0.064ms/step
