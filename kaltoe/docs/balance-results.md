# 밸런스 스윕 결과 (헤드리스 봇)

스테이지 × 복지 투자액 × 봇 2종 × 시드 8개. 고수형 = 3프레임마다 넓은 시야로 회피(탄도 피함). 사람형 = 0.2초 반응, 좁은 시야, 탄 회피 없음, 판단 흔들림. 선택은 둘 다 무난한 휴리스틱(시작 무기 우선, 진화 짝 패시브 선호). `npm run balance`로 재생성.

| 스테이지 | 복지 투자 | 봇 | 칼퇴율 | 평균 생존 | Lv@12시 | Lv@15시 | Lv@18시 | 평균 처치 | 평균 월급 | 첫 진화(초) | 최대 동시 적 | 사망 원인 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| office | ₩0 | 사람형 | 4/8 | 392s | 16.6 | 35.5 | 51.5 | 4703 | 238 | 404 (4/8) | 105 | 탄막@317, 팀장님@175, 결재 서류@101, 탄막@140 |
| office | ₩0 | 고수형 | 7/8 | 565s | 15.4 | 33.4 | 48.6 | 7662 | 364 | 364 (7/8) | 152 | KPI 그래프@323 |
| office | ₩1,500 | 사람형 | 7/8 | 544s | 16.7 | 34.9 | 50.9 | 7777 | 416 | 346 (7/8) | 121 | 탄막@149 |
| office | ₩1,500 | 고수형 | 7/8 | 593s | 15.5 | 32.3 | 51.0 | 7945 | 467 | 349 (7/8) | 175 | 부장님@542 |
| crunch | ₩3,000 | 사람형 | 4/8 | 368s | 18.8 | 35.5 | 50.5 | 5029 | 335 | 395 (4/8) | 108 | 탄막@112, 탄막@265, 탄막@79, 탄막@89 |
| crunch | ₩3,000 | 고수형 | 5/8 | 582s | 16.6 | 34.5 | 50.8 | 8585 | 473 | 408 (7/8) | 191 | 서버 다운@463, 좀비 동료@594, 좀비 동료@607 |
| crunch | ₩6,000 | 사람형 | 3/8 | 356s | 18.0 | 35.8 | 50.0 | 4832 | 268 | 342 (4/8) | 98 | 탄막@147, 올빼미 야근러@96, 탄막@555, 올빼미 야근러@146, 탄막@104 |
| crunch | ₩6,000 | 고수형 | 5/8 | 557s | 15.1 | 35.1 | 54.0 | 7778 | 465 | 314 (6/8) | 206 | 좀비 동료@374, 긴급 이슈@480 |
| dinner | ₩10,000 | 사람형 | 4/8 | 361s | 19.8 | 37.3 | 52.0 | 5198 | 350 | 313 (4/8) | 107 | 고기 조각@95, 탄막@103, 건배 잔@116, 숙취@178 |
| dinner | ₩10,000 | 고수형 | 4/8 | 491s | 17.4 | 34.7 | 58.3 | 6886 | 495 | 301 (4/8) | 206 | 건배 잔@198, 불판@457, 숙취@509, 숙취@365 |
| dinner | ₩18,000 | 사람형 | 3/8 | 359s | 20.4 | 37.7 | 54.3 | 4725 | 380 | 307 (3/8) | 98 | 숙취@188, 건배사 과장@176, 탄막@271, 탄막@167, 탄막@271 |
| dinner | ₩18,000 | 고수형 | 6/8 | 574s | 19.3 | 34.8 | 55.0 | 8739 | 572 | 272 (7/8) | 192 | 폭탄주 부장님@563, 숙취@427 |
| holiday | ₩20,000 | 사람형 | 3/8 | 375s | 18.8 | 37.3 | 53.0 | 5150 | 464 | 346 (4/8) | 111 | 위험 지대@556, 탄막@145, 탄막@111, 탄막@108, 탄막@279 |
| holiday | ₩20,000 | 고수형 | 2/8 | 561s | 17.0 | 34.4 | 52.5 | 7628 | 537 | 382 (3/8) | 247 | 큰이모@604, 모둠전@570, 탄막@621, 모둠전@539, 접시@375 |
| holiday | ₩30,000 | 사람형 | 2/8 | 308s | 19.3 | 39.7 | 57.5 | 4189 | 377 | 268 (3/8) | 92 | 탄막@129, 사촌동생@153, 큰이모@553, 접시@122, 설거지 더미@122, 탄막@186 |
| holiday | ₩30,000 | 고수형 | 5/8 | 507s | 16.9 | 36.3 | 55.6 | 7151 | 558 | 403 (5/8) | 209 | 몸무게 잔소리@357, 모둠전@287, 모둠전@411 |

## 판별 상세
### office ₩0 사람형
- 칼퇴 600s Lv50 처치 8640 받은피해 127 궁 11 상자 8 진화 [fountain_storm, ctrl_alt_del, presentation_beam, clip_gatling] 보스 [team_lead, bujang] 무기 [fountain_storm:1 ctrl_alt_del:1 drone:8 presentation_beam:1 clip_gatling:1 toner:1] 패시브 [multitask:2 busybody:5 vitamin:4 shortcut:5 energy:4 clover:3] 0.067ms/step
- 사망 317s Lv25 처치 2340 받은피해 358 궁 4 상자 4 진화 [] 보스 [team_lead] 무기 [pen:8 coffee:5 clip:4 alarm:5 plane:3] 패시브 [vitamin:1 energy:3 selfhelp:2 mental:1 lunchbox:1] 0.037ms/step
- 칼퇴 600s Lv56 처치 8538 받은피해 257 궁 11 상자 9 진화 [fountain_storm, crane_squadron, approval_storm, clockout_bell] 보스 [team_lead, bujang] 무기 [fountain_storm:1 approval_storm:1 clockout_bell:1 card:8 crane_squadron:1 laser:7] 패시브 [multitask:2 selfhelp:5 energy:5 speedread:5 gym:3 shortcut:2] 0.042ms/step
- 사망 175s Lv15 처치 806 받은피해 153 궁 1 상자 2 진화 [] 보스 [] 무기 [pen:6 clip:4 alarm:3 cards:4] 패시브 [selfhelp:1 grit:1] 0.019ms/step
- 칼퇴 600s Lv54 처치 8476 받은피해 216 궁 11 상자 7 진화 [fountain_storm] 보스 [team_lead, bujang] 무기 [fountain_storm:1 alarm:8 postit:7 keyboard:8 plane:7 card:7] 패시브 [multitask:2 gym:5 selfhelp:5 speedread:1 mental:5 energy:5] 0.037ms/step
- 사망 101s Lv8 처치 313 받은피해 103 궁 0 상자 0 진화 [] 보스 [] 무기 [pen:1 laser:1 toner:2 clip:1] 패시브 [busybody:2 shortcut:1] 0.013ms/step
- 사망 140s Lv11 처치 556 받은피해 101 궁 1 상자 1 진화 [] 보스 [] 무기 [pen:2 drone:1 clip:2 ctrlz:2 cards:1] 패시브 [gym:1 clover:1 nunchi:1 multitask:1] 0.015ms/step
- 칼퇴 600s Lv46 처치 7955 받은피해 504 궁 10 상자 9 진화 [fountain_storm, clip_gatling] 보스 [team_lead, bujang] 무기 [fountain_storm:1 coffee:7 keyboard:7 clip_gatling:1 cards:7 laser:8] 패시브 [multitask:2 gym:5 lunchbox:5 grit:5 shortcut:4 mental:1] 0.046ms/step
### office ₩0 고수형
- 칼퇴 617s Lv48 처치 8559 받은피해 246 궁 11 상자 7 진화 [fountain_storm] 보스 [team_lead, bujang] 무기 [fountain_storm:1 drone:6 folder:5 plane:6 ctrlz:6 toner:5] 패시브 [multitask:2 energy:5 shortcut:2 clover:5 speedread:5 nunchi:5] 0.051ms/step
- 칼퇴 600s Lv52 처치 8750 받은피해 6 궁 11 상자 9 진화 [fountain_storm, postit_field, clockout_bell, black_card] 보스 [team_lead, bujang] 무기 [fountain_storm:1 postit_field:1 black_card:1 clockout_bell:1 ctrlz:7 drone:4] 패시브 [multitask:2 mental:5 selfhelp:5 stocks:5 busybody:5 shortcut:2] 0.033ms/step
- 사망 323s Lv18 처치 1302 받은피해 155 궁 2 상자 3 진화 [] 보스 [team_lead] 무기 [pen:5 postit:2 plane:5 cards:1 clip:2] 패시브 [mental:3 grit:5 energy:4] 0.070ms/step
- 칼퇴 621s Lv53 처치 8700 받은피해 118 궁 11 상자 8 진화 [fountain_storm, clockout_bell] 보스 [team_lead, bujang] 무기 [fountain_storm:1 plane:7 folder:7 clockout_bell:1 clip:7 coffee:6] 패시브 [speedread:4 multitask:2 selfhelp:5 energy:5 nunchi:3 lunchbox:5] 0.038ms/step
- 칼퇴 600s Lv47 처치 8391 받은피해 70 궁 10 상자 8 진화 [fountain_storm, crane_squadron] 보스 [team_lead, bujang] 무기 [fountain_storm:1 postit:8 crane_squadron:1 laser:8 alarm:5 keyboard:4] 패시브 [gym:5 multitask:2 shortcut:3 energy:4 nunchi:1 mental:1] 0.044ms/step
- 칼퇴 613s Lv47 처치 8599 받은피해 98 궁 11 상자 8 진화 [drone_squad, fountain_storm] 보스 [team_lead, bujang] 무기 [fountain_storm:1 laser:5 drone_squad:1 clip:6 ctrlz:5 plane:4] 패시브 [busybody:5 multitask:2 clover:5 nunchi:3 vitamin:1 shortcut:5] 0.052ms/step
- 칼퇴 600s Lv47 처치 8562 받은피해 30 궁 11 상자 9 진화 [fountain_storm, vip_cards] 보스 [team_lead, bujang] 무기 [fountain_storm:1 vip_cards:1 card:7 laser:5 ctrlz:6 clip:6] 패시브 [gym:4 multitask:2 grit:5 stocks:5 shortcut:5 clover:3] 0.040ms/step
- 칼퇴 614s Lv46 처치 8435 받은피해 128 궁 10 상자 6 진화 [fountain_storm, presentation_beam] 보스 [team_lead, bujang] 무기 [fountain_storm:1 presentation_beam:1 postit:5 coffee:4 card:5 folder:5] 패시브 [grit:2 lunchbox:5 gym:4 multitask:2 busybody:5 stocks:3] 0.041ms/step
### office ₩1,500 사람형
- 칼퇴 600s Lv48 처치 8324 받은피해 466 궁 11 상자 9 진화 [fountain_storm, caffeine_overdrive, drone_squad] 보스 [team_lead, bujang] 무기 [fountain_storm:1 laser:8 postit:8 caffeine_overdrive:1 drone_squad:1 alarm:1] 패시브 [multitask:2 lunchbox:5 clover:5 vitamin:3 nunchi:5 grit:3] 0.040ms/step
- 칼퇴 600s Lv48 처치 8688 받은피해 247 궁 11 상자 8 진화 [fountain_storm] 보스 [team_lead, bujang] 무기 [fountain_storm:1 ctrlz:8 plane:7 laser:7 postit:8 alarm:6] 패시브 [multitask:2 shortcut:4 busybody:5 clover:5 energy:2 mental:1] 0.044ms/step
- 칼퇴 600s Lv50 처치 8529 받은피해 200 궁 11 상자 8 진화 [fountain_storm, presentation_beam] 보스 [team_lead, bujang] 무기 [fountain_storm:1 card:6 presentation_beam:1 folder:7 alarm:7] 패시브 [stocks:5 multitask:2 speedread:5 gym:5 busybody:5 vitamin:4] 0.035ms/step
- 칼퇴 600s Lv48 처치 8525 받은피해 373 궁 11 상자 9 진화 [fountain_storm, presentation_beam, vip_cards] 보스 [team_lead, bujang] 무기 [fountain_storm:1 alarm:8 vip_cards:1 presentation_beam:1 clip:6 keyboard:3] 패시브 [mental:4 grit:5 multitask:2 gym:5 busybody:3 energy:2] 0.040ms/step
- 칼퇴 600s Lv63 처치 10169 받은피해 335 궁 12 상자 9 진화 [mech_keyboard, fountain_storm, ink_flood, clockout_bell, caffeine_overdrive] 보스 [team_lead, bujang] 무기 [fountain_storm:1 ink_flood:1 mech_keyboard:1 clockout_bell:1 drone:8 caffeine_overdrive:1] 패시브 [gym:5 selfhelp:5 multitask:2 passion:5 nunchi:5 lunchbox:5] 0.035ms/step
- 칼퇴 600s Lv50 처치 8858 받은피해 318 궁 11 상자 9 진화 [fountain_storm, caffeine_overdrive, postit_field, ctrl_alt_del, drone_squad] 보스 [team_lead, bujang] 무기 [fountain_storm:1 postit_field:1 caffeine_overdrive:1 ctrl_alt_del:1 drone_squad:1 clip:8] 패시브 [lunchbox:5 mental:5 multitask:2 clover:5 passion:2 nunchi:5] 0.035ms/step
- 사망 149s Lv11 처치 762 받은피해 123 궁 1 상자 1 진화 [] 보스 [] 무기 [pen:5 ctrlz:2 alarm:3 toner:1 folder:1] 패시브 [clover:1 multitask:1] 0.014ms/step
- 칼퇴 600s Lv49 처치 8360 받은피해 316 궁 10 상자 8 진화 [fountain_storm, ctrl_alt_del, caffeine_overdrive] 보스 [team_lead, bujang] 무기 [fountain_storm:1 laser:8 ctrl_alt_del:1 caffeine_overdrive:1 folder:7 drone:4] 패시브 [clover:5 multitask:2 lunchbox:4 speedread:5 shortcut:2 energy:1] 0.031ms/step
### office ₩1,500 고수형
- 칼퇴 600s Lv51 처치 8373 받은피해 0 궁 10 상자 9 진화 [fountain_storm, drone_squad] 보스 [team_lead, bujang] 무기 [fountain_storm:1 clip:6 alarm:6 ctrlz:6 drone_squad:1 laser:6] 패시브 [nunchi:5 shortcut:5 gym:4 selfhelp:5 multitask:2 clover:5] 0.037ms/step
- 칼퇴 600s Lv55 처치 8421 받은피해 12 궁 10 상자 9 진화 [fountain_storm, clockout_bell] 보스 [team_lead, bujang] 무기 [fountain_storm:1 folder:7 postit:8 clockout_bell:1 clip:7 keyboard:7] 패시브 [gym:5 multitask:1 vitamin:3 speedread:5 selfhelp:5 shortcut:4] 0.038ms/step
- 칼퇴 600s Lv50 처치 8361 받은피해 10 궁 10 상자 9 진화 [fountain_storm, mech_keyboard, black_card] 보스 [team_lead, bujang] 무기 [fountain_storm:1 laser:8 toner:8 mech_keyboard:1 black_card:1 clip:8] 패시브 [stocks:5 multitask:2 gym:3 mental:3 grit:1 clover:2] 0.035ms/step
- 칼퇴 600s Lv54 처치 8638 받은피해 6 궁 11 상자 8 진화 [clip_gatling, approval_storm, fountain_storm, black_card] 보스 [team_lead, bujang] 무기 [fountain_storm:1 alarm:7 approval_storm:1 black_card:1 clip_gatling:1 plane:8] 패시브 [speedread:4 gym:5 selfhelp:5 shortcut:2 multitask:2 stocks:5] 0.038ms/step
- 칼퇴 628s Lv48 처치 8778 받은피해 108 궁 11 상자 8 진화 [fountain_storm, crane_squadron] 보스 [team_lead, bujang] 무기 [fountain_storm:1 postit:7 crane_squadron:1 toner:6 coffee:5 cards:7] 패시브 [multitask:2 mental:5 energy:4 vitamin:1 shortcut:2 lunchbox:5] 0.049ms/step
- 사망 542s Lv31 처치 4012 받은피해 460 궁 6 상자 3 진화 [] 보스 [team_lead] 무기 [pen:5 cards:4 postit:3 clip:2 plane:3 coffee:2] 패시브 [mental:4 grit:5 stocks:1 lunchbox:3 shortcut:4 multitask:2] 0.121ms/step
- 칼퇴 600s Lv51 처치 8700 받은피해 18 궁 11 상자 9 진화 [fountain_storm, black_card, drone_squad] 보스 [team_lead, bujang] 무기 [fountain_storm:1 plane:8 black_card:1 drone_squad:1 cards:6 ctrlz:6] 패시브 [stocks:5 multitask:2 lunchbox:5 nunchi:5 grit:5 shortcut:5] 0.046ms/step
- 칼퇴 600s Lv48 처치 8279 받은피해 22 궁 10 상자 9 진화 [fountain_storm, ctrl_alt_del] 보스 [team_lead, bujang] 무기 [fountain_storm:1 clip:7 keyboard:8 drone:7 cards:7 ctrl_alt_del:1] 패시브 [busybody:1 gym:5 multitask:2 nunchi:5 clover:5 mental:2] 0.039ms/step
### crunch ₩3,000 사람형
- 사망 112s Lv10 처치 471 받은피해 120 궁 1 상자 1 진화 [] 보스 [] 무기 [pen:2 drone:1 toner:1 keyboard:2 clip:1] 패시브 [nunchi:1 multitask:1 selfhelp:1 lunchbox:1] 0.021ms/step
- 사망 265s Lv22 처치 1779 받은피해 245 궁 3 상자 4 진화 [] 보스 [pm] 무기 [pen:7 card:5 folder:6 coffee:8 alarm:2] 패시브 [multitask:1 stocks:1 energy:1 selfhelp:1] 0.027ms/step
- 칼퇴 600s Lv52 처치 9363 받은피해 517 궁 12 상자 9 진화 [fountain_storm, presentation_beam, ctrl_alt_del] 보스 [pm, director] 무기 [fountain_storm:1 presentation_beam:1 folder:8 clip:7 ctrl_alt_del:1 drone:8] 패시브 [multitask:2 shortcut:5 speedread:5 clover:5 busybody:3 mental:1] 0.047ms/step
- 사망 79s Lv7 처치 228 받은피해 134 궁 0 상자 0 진화 [] 보스 [] 무기 [pen:3 laser:2 clip:1] 패시브 [lunchbox:1] 0.011ms/step
- 칼퇴 600s Lv52 처치 9462 받은피해 466 궁 12 상자 9 진화 [fountain_storm, black_card] 보스 [pm, director] 무기 [fountain_storm:1 postit:8 black_card:1 folder:8 plane:8] 패시브 [stocks:5 multitask:2 mental:5 speedread:5 energy:4 shortcut:4] 0.046ms/step
- 칼퇴 600s Lv50 처치 9321 받은피해 521 궁 12 상자 9 진화 [fountain_storm, drone_squad] 보스 [pm, director] 무기 [fountain_storm:1 card:7 drone_squad:1 keyboard:7 laser:7 postit:8] 패시브 [stocks:5 multitask:2 speedread:2 gym:5 nunchi:5 busybody:5] 0.041ms/step
- 칼퇴 600s Lv48 처치 9344 받은피해 489 궁 12 상자 9 진화 [fountain_storm, mech_keyboard, caffeine_overdrive, vip_cards] 보스 [pm, director] 무기 [fountain_storm:1 mech_keyboard:1 laser:8 caffeine_overdrive:1 vip_cards:1 toner:8] 패시브 [multitask:2 lunchbox:4 busybody:5 gym:5 grit:5] 0.041ms/step
- 사망 89s Lv8 처치 266 받은피해 119 궁 0 상자 0 진화 [] 보스 [] 무기 [pen:2 clip:2 coffee:3 laser:1] 패시브 [] 0.012ms/step
### crunch ₩3,000 고수형
- 칼퇴 600s Lv50 처치 9175 받은피해 77 궁 12 상자 8 진화 [fountain_storm, approval_storm, crane_squadron, ctrl_alt_del] 보스 [pm, director] 무기 [fountain_storm:1 laser:8 ctrl_alt_del:1 approval_storm:1 crane_squadron:1 card:1] 패시브 [multitask:2 energy:5 shortcut:3 clover:5 speedread:5 gym:5] 0.049ms/step
- 칼퇴 600s Lv50 처치 9145 받은피해 59 궁 12 상자 7 진화 [fountain_storm] 보스 [pm, director] 무기 [fountain_storm:1 keyboard:6 postit:6 laser:6 folder:7 plane:6] 패시브 [multitask:2 gym:5 mental:5 busybody:5 speedread:5 energy:3] 0.050ms/step
- 칼퇴 600s Lv50 처치 9512 받은피해 8 궁 12 상자 8 진화 [fountain_storm, crane_squadron, caffeine_overdrive] 보스 [pm, director] 무기 [fountain_storm:1 alarm:8 crane_squadron:1 caffeine_overdrive:1 drone:7 clip:6] 패시브 [multitask:2 lunchbox:5 nunchi:5 energy:2 shortcut:5 selfhelp:3] 0.044ms/step
- 사망 463s Lv35 처치 4934 받은피해 152 궁 7 상자 4 진화 [] 보스 [pm] 무기 [pen:6 folder:6 ctrlz:7 cards:4 plane:3 clip:3] 패시브 [multitask:2 speedread:5 grit:5 shortcut:2] 0.053ms/step
- 칼퇴 600s Lv52 처치 9225 받은피해 25 궁 12 상자 7 진화 [fountain_storm, clockout_bell, postit_field] 보스 [pm, director] 무기 [fountain_storm:1 postit_field:1 keyboard:7 clip:8 clockout_bell:1 folder:4] 패시브 [shortcut:5 multitask:2 mental:5 gym:4 busybody:2 selfhelp:1] 0.042ms/step
- 칼퇴 600s Lv52 처치 9019 받은피해 84 궁 12 상자 8 진화 [fountain_storm, black_card] 보스 [pm, director] 무기 [fountain_storm:1 folder:8 coffee:8 alarm:8 drone:8 black_card:1] 패시브 [speedread:4 shortcut:4 multitask:2 lunchbox:5 gym:2 stocks:3] 0.046ms/step
- 사망 594s Lv48 처치 8307 받은피해 492 궁 11 상자 7 진화 [fountain_storm] 보스 [pm] 무기 [fountain_storm:1 plane:6 toner:5 cards:7 alarm:6 folder:8] 패시브 [gym:5 multitask:2 stocks:4 grit:5 energy:5 speedread:5] 0.058ms/step
- 사망 607s Lv48 처치 9366 받은피해 247 궁 12 상자 8 진화 [fountain_storm] 보스 [pm] 무기 [fountain_storm:1 card:5 laser:7 coffee:7 alarm:6 ctrlz:7] 패시브 [vitamin:2 stocks:5 multitask:2 shortcut:2 busybody:5 energy:3] 0.045ms/step
### crunch ₩6,000 사람형
- 칼퇴 600s Lv51 처치 9470 받은피해 350 궁 12 상자 8 진화 [fountain_storm] 보스 [pm, director] 무기 [fountain_storm:1 keyboard:7 alarm:7 cards:7 postit:7 laser:7] 패시브 [gym:5 multitask:2 busybody:5 selfhelp:2 mental:5 shortcut:2] 0.037ms/step
- 사망 147s Lv12 처치 701 받은피해 168 궁 1 상자 0 진화 [] 보스 [] 무기 [pen:2 postit:3 coffee:1 plane:1] 패시브 [multitask:2 gym:1 energy:1 mental:1] 0.017ms/step
- 사망 96s Lv8 처치 316 받은피해 144 궁 0 상자 0 진화 [] 보스 [] 무기 [pen:3 laser:2 drone:1] 패시브 [busybody:2] 0.013ms/step
- 사망 555s Lv51 처치 8366 받은피해 572 궁 11 상자 8 진화 [fountain_storm] 보스 [pm] 무기 [fountain_storm:1 drone:8 folder:7 ctrlz:6 plane:7 alarm:7] 패시브 [multitask:2 speedread:5 lunchbox:1 energy:5 clover:5 selfhelp:5] 0.040ms/step
- 칼퇴 600s Lv50 처치 9309 받은피해 443 궁 12 상자 8 진화 [fountain_storm] 보스 [pm, director] 무기 [fountain_storm:1 toner:8 plane:7 alarm:8 postit:7 card:7] 패시브 [multitask:2 shortcut:5 gym:2 energy:5 mental:5 stocks:3] 0.042ms/step
- 사망 146s Lv13 처치 647 받은피해 210 궁 1 상자 1 진화 [] 보스 [] 무기 [pen:3 folder:4 coffee:2 keyboard:1 postit:1] 패시브 [lunchbox:2 speedread:1] 0.017ms/step
- 사망 104s Lv9 처치 427 받은피해 132 궁 1 상자 1 진화 [] 보스 [] 무기 [pen:3 plane:2 ctrlz:1 drone:1] 패시브 [clover:2 shortcut:1] 0.019ms/step
- 칼퇴 600s Lv49 처치 9422 받은피해 355 궁 12 상자 9 진화 [fountain_storm, postit_field, caffeine_overdrive] 보스 [pm, director] 무기 [fountain_storm:1 folder:8 caffeine_overdrive:1 card:8 postit_field:1 ctrlz:8] 패시브 [multitask:2 energy:2 mental:5 shortcut:5 lunchbox:5 vitamin:4] 0.041ms/step
### crunch ₩6,000 고수형
- 칼퇴 601s Lv51 처치 8998 받은피해 130 궁 12 상자 6 진화 [fountain_storm] 보스 [pm, director] 무기 [fountain_storm:1 laser:7 plane:8 folder:6 ctrlz:7 clip:5] 패시브 [multitask:2 speedread:5 busybody:5 energy:3 selfhelp:1 shortcut:5] 0.054ms/step
- 칼퇴 600s Lv58 처치 9453 받은피해 17 궁 12 상자 9 진화 [fountain_storm, black_card, clockout_bell, mech_keyboard] 보스 [pm, director] 무기 [fountain_storm:1 postit:7 black_card:1 clockout_bell:1 mech_keyboard:1 toner:8] 패시브 [gym:5 multitask:2 mental:5 stocks:5 selfhelp:5 lunchbox:2] 0.036ms/step
- 칼퇴 600s Lv54 처치 9116 받은피해 89 궁 12 상자 8 진화 [fountain_storm, clip_gatling, clockout_bell] 보스 [pm, director] 무기 [fountain_storm:1 toner:8 clip_gatling:1 coffee:7 clockout_bell:1 card:7] 패시브 [gym:2 shortcut:5 selfhelp:5 grit:2 lunchbox:5 multitask:2] 0.039ms/step
- 칼퇴 600s Lv58 처치 9561 받은피해 88 궁 12 상자 9 진화 [fountain_storm, clockout_bell, drone_squad, approval_storm] 보스 [pm, director] 무기 [fountain_storm:1 drone_squad:1 approval_storm:1 postit:8 clockout_bell:1 plane:8] 패시브 [nunchi:5 multitask:2 selfhelp:5 speedread:5 shortcut:5 vitamin:3] 0.040ms/step
- 사망 640s Lv50 처치 9789 받은피해 103 궁 12 상자 8 진화 [fountain_storm, crane_squadron] 보스 [pm] 무기 [fountain_storm:1 postit:7 crane_squadron:1 clip:7 ctrlz:8 keyboard:6] 패시브 [energy:5 multitask:2 shortcut:4 busybody:2 nunchi:2 mental:5] 0.050ms/step
- 칼퇴 600s Lv49 처치 9228 받은피해 63 궁 12 상자 9 진화 [fountain_storm, black_card, postit_field, drone_squad] 보스 [pm, director] 무기 [fountain_storm:1 postit_field:1 black_card:1 drone_squad:1 cards:7 folder:2] 패시브 [mental:5 busybody:2 multitask:2 nunchi:5 stocks:5 clover:4] 0.041ms/step
- 사망 374s Lv20 처치 2453 받은피해 241 궁 4 상자 2 진화 [] 보스 [pm] 무기 [pen:6 drone:3 cards:4 toner:4 laser:3] 패시브 [nunchi:3 grit:1 selfhelp:1 speedread:1] 0.050ms/step
- 사망 480s Lv26 처치 3627 받은피해 264 궁 6 상자 3 진화 [] 보스 [pm] 무기 [pen:7 postit:3 plane:7 cards:6 drone:1] 패시브 [vitamin:1 nunchi:4 multitask:2 mental:2] 0.100ms/step
### dinner ₩10,000 사람형
- 칼퇴 600s Lv52 처치 9992 받은피해 597 궁 13 상자 9 진화 [fountain_storm, vip_cards, drone_squad] 보스 [toast_master, bomb_bujang] 무기 [fountain_storm:1 vip_cards:1 drone_squad:1 plane:8 card:8 coffee:7] 패시브 [gym:1 shortcut:5 multitask:2 mental:3 nunchi:5 grit:5] 0.058ms/step
- 칼퇴 600s Lv51 처치 9586 받은피해 547 궁 12 상자 8 진화 [fountain_storm, mech_keyboard, caffeine_overdrive, presentation_beam] 보스 [toast_master, bomb_bujang] 무기 [fountain_storm:1 mech_keyboard:1 toner:8 caffeine_overdrive:1 presentation_beam:1 folder:1] 패시브 [gym:5 mental:4 multitask:2 speedread:3 busybody:5 lunchbox:5] 0.043ms/step
- 칼퇴 600s Lv52 처치 9773 받은피해 831 궁 13 상자 8 진화 [fountain_storm] 보스 [toast_master, bomb_bujang] 무기 [fountain_storm:1 keyboard:7 plane:7 drone:6 ctrlz:7 card:7] 패시브 [multitask:2 gym:5 energy:5 nunchi:5 clover:5 busybody:3] 0.047ms/step
- 사망 95s Lv8 처치 373 받은피해 148 궁 0 상자 0 진화 [] 보스 [] 무기 [pen:3 postit:2 ctrlz:1 toner:1] 패시브 [gym:1] 0.014ms/step
- 칼퇴 600s Lv53 처치 9882 받은피해 545 궁 13 상자 9 진화 [fountain_storm, drone_squad, black_card] 보스 [toast_master, bomb_bujang] 무기 [fountain_storm:1 keyboard:8 postit:8 drone_squad:1 black_card:1 toner:8] 패시브 [busybody:5 multitask:2 gym:5 nunchi:5 stocks:4 speedread:2] 0.047ms/step
- 사망 103s Lv10 처치 412 받은피해 154 궁 1 상자 1 진화 [] 보스 [] 무기 [pen:4 plane:1 alarm:3 toner:1] 패시브 [selfhelp:2 energy:2] 0.014ms/step
- 사망 116s Lv11 처치 492 받은피해 157 궁 1 상자 1 진화 [] 보스 [] 무기 [pen:2 coffee:4 folder:3 toner:1] 패시브 [lunchbox:1 gym:1] 0.015ms/step
- 사망 178s Lv17 처치 1075 받은피해 153 궁 2 상자 2 진화 [] 보스 [] 무기 [pen:6 keyboard:2 coffee:3 ctrlz:2 folder:2] 패시브 [gym:2 multitask:1 clover:2 grit:1] 0.019ms/step
### dinner ₩10,000 고수형
- 칼퇴 600s Lv63 처치 11174 받은피해 132 궁 13 상자 8 진화 [mech_keyboard, fountain_storm, approval_storm, ink_flood, clockout_bell, vip_cards] 보스 [toast_master, bomb_bujang] 무기 [fountain_storm:1 mech_keyboard:1 ink_flood:1 approval_storm:1 clockout_bell:1 vip_cards:1] 패시브 [gym:5 multitask:2 grit:5 selfhelp:5 passion:5 speedread:5] 0.043ms/step
- 칼퇴 600s Lv55 처치 10134 받은피해 65 궁 13 상자 8 진화 [fountain_storm, mech_keyboard, black_card, approval_storm] 보스 [toast_master, bomb_bujang] 무기 [fountain_storm:1 mech_keyboard:1 approval_storm:1 black_card:1 alarm:8 ctrlz:8] 패시브 [multitask:2 gym:5 shortcut:1 stocks:5 speedread:5 passion:1] 0.039ms/step
- 사망 198s Lv18 처치 1404 받은피해 205 궁 2 상자 1 진화 [] 보스 [] 무기 [pen:4 toner:4 ctrlz:3 card:3] 패시브 [passion:2 stocks:2 clover:1] 0.019ms/step
- 사망 457s Lv27 처치 4592 받은피해 327 궁 7 상자 4 진화 [] 보스 [toast_master] 무기 [pen:6 postit:7 folder:4 cards:8 coffee:2] 패시브 [mental:4 multitask:2 grit:4] 0.060ms/step
- 사망 509s Lv39 처치 5233 받은피해 532 궁 8 상자 5 진화 [] 보스 [toast_master] 무기 [pen:8 cards:4 ctrlz:5 clip:4 drone:5 postit:4] 패시브 [vitamin:3 shortcut:5 lunchbox:2 clover:5 multitask:2 mental:3] 0.085ms/step
- 칼퇴 600s Lv58 처치 9527 받은피해 351 궁 12 상자 9 진화 [fountain_storm, clockout_bell, black_card, caffeine_overdrive] 보스 [toast_master, bomb_bujang] 무기 [fountain_storm:1 black_card:1 caffeine_overdrive:1 clockout_bell:1 toner:8 cards:8] 패시브 [lunchbox:5 selfhelp:5 stocks:5 multitask:2 mental:5 clover:5] 0.041ms/step
- 사망 365s Lv30 처치 2964 받은피해 492 궁 5 상자 3 진화 [] 보스 [toast_master] 무기 [pen:8 drone:4 toner:5 plane:3 keyboard:2] 패시브 [nunchi:2 energy:3 gym:3 vitamin:3 busybody:1 shortcut:1] 0.040ms/step
- 칼퇴 600s Lv57 처치 10057 받은피해 286 궁 13 상자 8 진화 [fountain_storm, caffeine_overdrive, approval_storm] 보스 [toast_master, bomb_bujang] 무기 [fountain_storm:1 card:8 caffeine_overdrive:1 approval_storm:1 clip:8 cards:8] 패시브 [speedread:5 gym:5 lunchbox:5 multitask:2 passion:3 vitamin:2] 0.056ms/step
### dinner ₩18,000 사람형
- 칼퇴 600s Lv55 처치 9741 받은피해 686 궁 13 상자 8 진화 [clip_gatling, fountain_storm] 보스 [toast_master, bomb_bujang] 무기 [fountain_storm:1 cards:7 keyboard:7 clip_gatling:1 toner:7 postit:7] 패시브 [multitask:2 shortcut:5 grit:5 busybody:2 gym:5 selfhelp:4] 0.045ms/step
- 사망 188s Lv19 처치 1178 받은피해 273 궁 2 상자 3 진화 [] 보스 [toast_master] 무기 [pen:4 toner:3 folder:2 laser:4 cards:2] 패시브 [busybody:5 grit:4 shortcut:1 speedread:1] 0.018ms/step
- 칼퇴 600s Lv53 처치 10332 받은피해 195 궁 13 상자 9 진화 [black_card, fountain_storm, crane_squadron, clip_gatling] 보스 [toast_master, bomb_bujang] 무기 [fountain_storm:1 black_card:1 crane_squadron:1 clip_gatling:1 coffee:8 toner:8] 패시브 [multitask:2 shortcut:5 energy:5 stocks:5 busybody:5 gym:5] 0.045ms/step
- 사망 176s Lv19 처치 1122 받은피해 220 궁 2 상자 2 진화 [] 보스 [] 무기 [pen:4 clip:2 folder:2 cards:3 alarm:1] 패시브 [busybody:3 grit:4 selfhelp:1 multitask:1] 0.017ms/step
- 칼퇴 600s Lv55 처치 10251 받은피해 648 궁 14 상자 7 진화 [fountain_storm] 보스 [toast_master, bomb_bujang] 무기 [fountain_storm:1 clip:7 folder:8 laser:8 plane:7 alarm:8] 패시브 [multitask:2 shortcut:5 busybody:5 gym:5 energy:5 speedread:5] 0.049ms/step
- 사망 271s Lv26 처치 2126 받은피해 503 궁 4 상자 4 진화 [] 보스 [toast_master] 무기 [pen:5 keyboard:2 coffee:7 ctrlz:3 folder:5] 패시브 [lunchbox:5 gym:4 speedread:4 multitask:1 passion:1 grit:1] 0.021ms/step
- 사망 167s Lv17 처치 926 받은피해 227 궁 2 상자 1 진화 [] 보스 [] 무기 [pen:3 coffee:4 plane:2 keyboard:3] 패시브 [gym:1 lunchbox:2 energy:2 multitask:1] 0.019ms/step
- 사망 271s Lv25 처치 2126 받은피해 373 궁 4 상자 2 진화 [] 보스 [toast_master] 무기 [pen:4 coffee:2 ctrlz:4 drone:3 laser:3] 패시브 [lunchbox:4 multitask:2 clover:3 busybody:2 vitamin:1 passion:1] 0.025ms/step
### dinner ₩18,000 고수형
- 사망 563s Lv44 처치 7053 받은피해 675 궁 11 상자 5 진화 [fountain_storm] 보스 [toast_master] 무기 [fountain_storm:1 folder:8 ctrlz:6 cards:5 plane:6 coffee:5] 패시브 [multitask:2 clover:5 grit:5 mental:1 gym:2 lunchbox:5] 0.078ms/step
- 사망 427s Lv19 처치 3706 받은피해 412 궁 6 상자 2 진화 [] 보스 [toast_master] 무기 [pen:7 keyboard:1 postit:4 cards:2 plane:2] 패시브 [mental:3 grit:1 gym:4 multitask:1] 0.060ms/step
- 칼퇴 600s Lv53 처치 9959 받은피해 126 궁 13 상자 8 진화 [fountain_storm, mech_keyboard, postit_field] 보스 [toast_master, bomb_bujang] 무기 [fountain_storm:1 alarm:8 mech_keyboard:1 postit_field:1 cards:8 coffee:7] 패시브 [vitamin:5 multitask:2 gym:5 grit:5 stocks:3 mental:5] 0.044ms/step
- 칼퇴 600s Lv58 처치 9982 받은피해 146 궁 13 상자 7 진화 [fountain_storm] 보스 [toast_master, bomb_bujang] 무기 [fountain_storm:1 alarm:8 toner:8 keyboard:8 cards:7 clip:8] 패시브 [grit:5 multitask:2 selfhelp:5 gym:5 mental:1 shortcut:5] 0.045ms/step
- 칼퇴 600s Lv55 처치 10095 받은피해 123 궁 13 상자 8 진화 [fountain_storm, approval_storm, ctrl_alt_del] 보스 [toast_master, bomb_bujang] 무기 [fountain_storm:1 approval_storm:1 cards:8 ctrl_alt_del:1 postit:8 clip:8] 패시브 [multitask:2 gym:5 busybody:5 speedread:5 vitamin:4 clover:5] 0.042ms/step
- 칼퇴 600s Lv54 처치 9658 받은피해 135 궁 13 상자 8 진화 [fountain_storm, black_card, vip_cards] 보스 [toast_master, bomb_bujang] 무기 [fountain_storm:1 black_card:1 keyboard:7 laser:8 vip_cards:1 drone:8] 패시브 [gym:5 multitask:2 stocks:2 selfhelp:4 vitamin:2 grit:5] 0.042ms/step
- 칼퇴 600s Lv56 처치 9539 받은피해 216 궁 13 상자 8 진화 [fountain_storm, drone_squad, black_card] 보스 [toast_master, bomb_bujang] 무기 [fountain_storm:1 black_card:1 drone_squad:1 keyboard:8 laser:8 coffee:8] 패시브 [vitamin:5 nunchi:5 clover:5 stocks:5 multitask:2 selfhelp:5] 0.054ms/step
- 칼퇴 600s Lv54 처치 9923 받은피해 193 궁 13 상자 9 진화 [fountain_storm, mech_keyboard, clip_gatling, caffeine_overdrive] 보스 [toast_master, bomb_bujang] 무기 [fountain_storm:1 caffeine_overdrive:1 mech_keyboard:1 clip_gatling:1 cards:8 drone:8] 패시브 [shortcut:5 multitask:2 lunchbox:5 gym:5 selfhelp:1 grit:5] 0.055ms/step
### holiday ₩20,000 사람형
- 칼퇴 600s Lv55 처치 9768 받은피해 506 궁 13 상자 9 진화 [fountain_storm, postit_field, black_card] 보스 [uncle, big_aunt] 무기 [fountain_storm:1 postit_field:1 black_card:1 keyboard:8 laser:8 ctrlz:8] 패시브 [multitask:2 stocks:5 lunchbox:5 mental:5 grit:3 busybody:5] 0.046ms/step
- 사망 556s Lv52 처치 8717 받은피해 678 궁 12 상자 8 진화 [fountain_storm, postit_field] 보스 [uncle] 무기 [fountain_storm:1 postit_field:1 alarm:8 toner:8 folder:8 card:8] 패시브 [multitask:2 mental:5 selfhelp:3 stocks:5 speedread:5] 0.041ms/step
- 칼퇴 600s Lv52 처치 9447 받은피해 615 궁 13 상자 9 진화 [fountain_storm, presentation_beam, postit_field, mech_keyboard] 보스 [uncle, big_aunt] 무기 [fountain_storm:1 folder:6 mech_keyboard:1 presentation_beam:1 postit_field:1 plane:5] 패시브 [vitamin:4 multitask:2 gym:5 clover:5 busybody:5 mental:5] 0.051ms/step
- 사망 145s Lv15 처치 696 받은피해 254 궁 1 상자 1 진화 [] 보스 [] 무기 [pen:7 cards:3 toner:2 clip:2] 패시브 [shortcut:2] 0.015ms/step
- 칼퇴 600s Lv52 처치 9740 받은피해 853 궁 13 상자 9 진화 [fountain_storm, crane_squadron, mech_keyboard] 보스 [uncle, big_aunt] 무기 [fountain_storm:1 postit:8 card:8 crane_squadron:1 mech_keyboard:1 laser:8] 패시브 [multitask:2 energy:5 grit:4 gym:5 shortcut:5 clover:5] 0.058ms/step
- 사망 111s Lv10 처치 441 받은피해 171 궁 1 상자 0 진화 [] 보스 [] 무기 [pen:4 drone:2 clip:2 coffee:1] 패시브 [multitask:1] 0.015ms/step
- 사망 108s Lv10 처치 410 받은피해 157 궁 1 상자 1 진화 [] 보스 [] 무기 [pen:2 coffee:2 folder:4 clip:1] 패시브 [gym:3 speedread:1] 0.014ms/step
- 사망 279s Lv24 처치 1982 받은피해 482 궁 4 상자 4 진화 [] 보스 [uncle] 무기 [pen:4 clip:4 toner:7 cards:4 laser:4] 패시브 [multitask:2 grit:5 shortcut:1 gym:1] 0.025ms/step
### holiday ₩20,000 고수형
- 사망 604s Lv42 처치 7728 받은피해 1125 궁 12 상자 6 진화 [] 보스 [uncle] 무기 [pen:8 postit:5 alarm:5 folder:6 coffee:7] 패시브 [gym:3 lunchbox:5 multitask:2 speedread:4 mental:5 energy:2] 0.072ms/step
- 사망 570s Lv44 처치 6681 받은피해 529 궁 10 상자 4 진화 [] 보스 [uncle] 무기 [pen:8 coffee:5 card:5 folder:5 ctrlz:5 cards:6] 패시브 [multitask:2 lunchbox:5 shortcut:1 clover:5 stocks:5 speedread:2] 0.085ms/step
- 칼퇴 603s Lv51 처치 9367 받은피해 154 궁 13 상자 7 진화 [fountain_storm, presentation_beam, clip_gatling] 보스 [uncle, big_aunt] 무기 [fountain_storm:1 clip_gatling:1 cards:7 presentation_beam:1 toner:7 drone:7] 패시브 [busybody:5 grit:5 shortcut:5 multitask:2 gym:1] 0.053ms/step
- 사망 640s Lv55 처치 10069 받은피해 164 궁 13 상자 7 진화 [fountain_storm] 보스 [uncle] 무기 [fountain_storm:1 laser:8 plane:8 folder:8 cards:8 drone:8] 패시브 [vitamin:1 multitask:2 mental:1 energy:5 speedread:5 nunchi:5] 0.068ms/step
- 사망 621s Lv54 처치 9824 받은피해 444 궁 13 상자 5 진화 [] 보스 [uncle] 무기 [pen:8 toner:7 alarm:7 keyboard:7 drone:7 coffee:6] 패시브 [gym:5 selfhelp:4 multitask:2 nunchi:5 lunchbox:5] 0.054ms/step
- 칼퇴 600s Lv54 처치 9652 받은피해 98 궁 13 상자 8 진화 [fountain_storm, black_card] 보스 [uncle, big_aunt] 무기 [fountain_storm:1 postit:7 laser:8 toner:7 black_card:1 folder:8] 패시브 [multitask:2 busybody:5 mental:5 speedread:5 stocks:5] 0.052ms/step
- 사망 539s Lv33 처치 4887 받은피해 316 궁 8 상자 3 진화 [] 보스 [uncle] 무기 [pen:7 cards:3 plane:6 clip:7 drone:5] 패시브 [multitask:2 shortcut:5 selfhelp:4 grit:2 energy:1] 0.108ms/step
- 사망 375s Lv23 처치 2814 받은피해 256 궁 5 상자 3 진화 [] 보스 [uncle] 무기 [pen:8 folder:8 cards:4] 패시브 [grit:3 lunchbox:3 gym:2 speedread:2] 0.047ms/step
### holiday ₩30,000 사람형
- 사망 129s Lv11 처치 561 받은피해 182 궁 1 상자 1 진화 [] 보스 [] 무기 [pen:4 keyboard:3 plane:3] 패시브 [busybody:1 gym:1 multitask:2] 0.016ms/step
- 사망 153s Lv14 처치 729 받은피해 183 궁 1 상자 1 진화 [] 보스 [] 무기 [pen:4 toner:2 drone:2 plane:2 keyboard:2] 패시브 [gym:3] 0.017ms/step
- 사망 553s Lv57 처치 8669 받은피해 645 궁 13 상자 8 진화 [fountain_storm, clockout_bell, postit_field] 보스 [uncle] 무기 [fountain_storm:1 postit_field:1 coffee:8 laser:8 keyboard:8 clockout_bell:1] 패시브 [gym:5 multitask:2 mental:5 nunchi:4 clover:3 selfhelp:5] 0.043ms/step
- 칼퇴 600s Lv62 처치 11563 받은피해 513 궁 15 상자 9 진화 [mech_keyboard, fountain_storm, approval_storm, ink_flood, vip_cards] 보스 [uncle, big_aunt] 무기 [fountain_storm:1 approval_storm:1 mech_keyboard:1 ink_flood:1 alarm:8 vip_cards:1] 패시브 [multitask:2 gym:5 grit:5 passion:5 lunchbox:5 speedread:5] 0.039ms/step
- 칼퇴 600s Lv53 처치 9947 받은피해 509 궁 14 상자 9 진화 [fountain_storm, presentation_beam, postit_field, clip_gatling] 보스 [uncle, big_aunt] 무기 [fountain_storm:1 postit_field:1 clip_gatling:1 presentation_beam:1 keyboard:8 folder:8] 패시브 [busybody:5 multitask:2 mental:5 clover:5 stocks:4 shortcut:5] 0.050ms/step
- 사망 122s Lv10 처치 492 받은피해 184 궁 1 상자 0 진화 [] 보스 [] 무기 [pen:1 drone:3 clip:3 ctrlz:1] 패시브 [gym:1 shortcut:1] 0.014ms/step
- 사망 122s Lv11 처치 523 받은피해 250 궁 1 상자 1 진화 [] 보스 [] 무기 [pen:2 toner:3 laser:3 plane:2] 패시브 [energy:2] 0.014ms/step
- 사망 186s Lv19 처치 1031 받은피해 282 궁 2 상자 3 진화 [] 보스 [uncle] 무기 [pen:6 coffee:3 card:3 cards:1 postit:2] 패시브 [mental:5 lunchbox:1 nunchi:3 multitask:2] 0.018ms/step
### holiday ₩30,000 고수형
- 칼퇴 604s Lv52 처치 9824 받은피해 143 궁 14 상자 7 진화 [fountain_storm, presentation_beam] 보스 [uncle, big_aunt] 무기 [fountain_storm:1 drone:7 toner:7 presentation_beam:1 plane:6 keyboard:7] 패시브 [multitask:2 nunchi:5 grit:4 busybody:5 gym:2 lunchbox:2] 0.053ms/step
- 사망 357s Lv31 처치 3113 받은피해 301 궁 6 상자 3 진화 [] 보스 [uncle] 무기 [pen:6 cards:5 drone:3 toner:4 clip:5 postit:4] 패시브 [grit:2 gym:1 shortcut:3 vitamin:1 multitask:2] 0.033ms/step
- 칼퇴 602s Lv52 처치 9824 받은피해 100 궁 14 상자 6 진화 [fountain_storm, mech_keyboard] 보스 [uncle, big_aunt] 무기 [fountain_storm:1 toner:8 plane:8 mech_keyboard:1 card:6] 패시브 [multitask:2 gym:3 energy:5 stocks:2 busybody:4 shortcut:4] 0.044ms/step
- 칼퇴 600s Lv48 처치 8598 받은피해 329 궁 13 상자 5 진화 [fountain_storm, vip_cards, mech_keyboard] 보스 [uncle, big_aunt] 무기 [fountain_storm:1 vip_cards:1 mech_keyboard:1 ctrlz:7 drone:4] 패시브 [gym:5 vitamin:4 multitask:2 grit:5 nunchi:5 clover:2] 0.067ms/step
- 칼퇴 600s Lv69 처치 11438 받은피해 188 궁 15 상자 7 진화 [fountain_storm, clockout_bell, ink_flood] 보스 [uncle, big_aunt] 무기 [fountain_storm:1 clockout_bell:1 ink_flood:1 card:8 coffee:8 folder:8] 패시브 [multitask:2 selfhelp:5 passion:5 shortcut:5 stocks:5 lunchbox:5] 0.042ms/step
- 사망 287s Lv21 처치 1665 받은피해 265 궁 3 상자 2 진화 [] 보스 [uncle] 무기 [pen:6 drone:5 cards:2 ctrlz:3 laser:1] 패시브 [nunchi:4 grit:2 multitask:1 busybody:1] 0.043ms/step
- 칼퇴 607s Lv57 처치 9703 받은피해 106 궁 13 상자 8 진화 [fountain_storm, clockout_bell, vip_cards, clip_gatling] 보스 [uncle, big_aunt] 무기 [fountain_storm:1 clip_gatling:1 clockout_bell:1 vip_cards:1 folder:8 plane:8] 패시브 [selfhelp:5 grit:5 shortcut:5 multitask:2 nunchi:1 mental:5] 0.041ms/step
- 사망 411s Lv30 처치 3046 받은피해 436 궁 6 상자 1 진화 [] 보스 [uncle] 무기 [pen:7 cards:2 coffee:2 folder:3 postit:3] 패시브 [lunchbox:5 speedread:4 vitamin:1 grit:3 mental:2 multitask:1] 0.083ms/step
