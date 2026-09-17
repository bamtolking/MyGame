import { describe, it, expect } from 'vitest';
import { newGame, createUnit, aliveMonsters, atkMul } from '../src/sim/state.ts';
import { step, dispatch, startRound, spawnMonster, stateHash, DT, applySlow, applyStun, finish } from '../src/sim/engine.ts';
import { rollGrade, currentOdds, canMerge, recipeStatus, autoMerge, mergeUnit, bestFreeSlot } from '../src/sim/roster.ts';
import { snapshot, summary, snapMonsters, snapUnits } from '../src/sim/snapshot.ts';
import { SUMMON_ODDS, SUMMON_COST, START_GOLD, SUMMON_LV_COST, MAX_SUMMON_LV, atkUpgradeCost, ATK_PER_LV, TOTAL_ROUNDS, ROUND_TIME, BOSS_TIME, killGold, roundIncome, MIN_SEND_GOLD } from '../src/data/economy.ts';
import { MONSTER_CAP, PATH_LEN, pathPos, slotPos, slotAt, SLOT_COUNT, SLOT_ORDER, FIELD_W, FIELD_H, CELL } from '../src/data/board.ts';
import { ELEMENTS, MYTHIC_IDS, MYTHICS, ELEMENT_DEFS, unitStats, GRADE_MUL, SELL_VALUE, unitName } from '../src/data/units.ts';
import { roundPlan, baseHp, isBossRound, MONSTER_DEFS } from '../src/data/monsters.ts';
import type { GameState, Grade } from '../src/sim/types.ts';

const playing = (seed = 1, gold = 1e6) => { const s = newGame(seed, 'solo', gold); startRound(s, 1); s.spawnQueue = []; return s; };
const fill = (s: GameState, kind: 'fire' | 'ice' | 'bolt' | 'wind' | 'earth', grade: Grade, n: number) => { const ids: number[] = []; for (let i = 0; i < n; i++) ids.push(createUnit(s, kind, grade, bestFreeSlot(s)).id); return ids; };

describe('보드 기하', () => {
  it('길은 닫힌 고리이고 길 위 좌표는 항상 바깥 한 칸 안에 있다', () => {
    expect(pathPos(0)).toEqual(pathPos(PATH_LEN));
    for (let d = 0; d < PATH_LEN; d += 7) { const p = pathPos(d); const onRing = p.x <= CELL || p.x >= FIELD_W - CELL || p.y <= CELL || p.y >= FIELD_H - CELL; expect(onRing).toBe(true); }
  });
  it('자리 24개는 모두 안뜰에 있고 slotAt은 slotPos의 역함수', () => {
    for (let i = 0; i < SLOT_COUNT; i++) { const p = slotPos(i); expect(p.x).toBeGreaterThan(CELL); expect(p.x).toBeLessThan(FIELD_W - CELL); expect(slotAt(p.x, p.y)).toBe(i); }
    expect(slotAt(10, 10)).toBe(-1); expect(SLOT_ORDER.length).toBe(SLOT_COUNT); expect(new Set(SLOT_ORDER).size).toBe(SLOT_COUNT);
  });
  it('모든 유닛은 어느 자리에서든 길의 일부에 닿는다 (최소 사거리 100 ≥ 최대 거리)', () => {
    for (let i = 0; i < SLOT_COUNT; i++) { const p = slotPos(i); let best = Infinity; for (let d = 0; d < PATH_LEN; d += 2) { const q = pathPos(d); best = Math.min(best, Math.hypot(q.x - p.x, q.y - p.y)); } expect(best).toBeLessThanOrEqual(100); }
  });
});

describe('소환', () => {
  it('확률 표는 합이 1이고 레벨이 오를수록 전설 확률이 오른다', () => {
    for (const o of SUMMON_ODDS) expect(o.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    for (let i = 1; i < SUMMON_ODDS.length; i++) { expect(SUMMON_ODDS[i][3]).toBeGreaterThan(SUMMON_ODDS[i - 1][3]); expect(SUMMON_ODDS[i][0]).toBeLessThan(SUMMON_ODDS[i - 1][0]); }
  });
  it('20만 회 추첨 분포가 표와 일치 (±0.3%p)', () => {
    const s = newGame(42); const N = 200000; const cnt = [0, 0, 0, 0];
    for (let i = 0; i < N; i++) cnt[rollGrade(s, SUMMON_ODDS[0])]++;
    for (let g = 0; g < 4; g++) expect(Math.abs(cnt[g] / N - SUMMON_ODDS[0][g])).toBeLessThan(0.003);
  });
  it('골드 차감, 자리 배치(길 가까운 순), 속성 균등', () => {
    const s = playing(3); const cnt: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) { const r = dispatch(s, { type: 'summon' }); expect(r.ok).toBe(true); if (r.ok && r.kind) cnt[r.kind] = (cnt[r.kind] || 0) + 1; s.units.length = 0; s.slots.fill(null); }
    expect(s.gold).toBe(1e6 - 2000 * SUMMON_COST);
    for (const e of ELEMENTS) expect(cnt[e] / 2000).toBeGreaterThan(0.15);
    const r = dispatch(s, { type: 'summon' }); expect(r.ok && s.units[0].slot).toBe(SLOT_ORDER[0]);
  });
  it('골드 부족 / 자리 가득 → 실패, 차감 없음', () => {
    const s = playing(1, 10); expect(dispatch(s, { type: 'summon' }).ok).toBe(false); expect(s.gold).toBe(10);
    const t = playing(2); fill(t, 'fire', 0, SLOT_COUNT); const g = t.gold; expect(dispatch(t, { type: 'summon' }).ok).toBe(false); expect(t.gold).toBe(g);
  });
  it('소환 레벨 업: 비용·최대치·확률 반영', () => {
    const s = playing(1); for (let i = 0; i < MAX_SUMMON_LV - 1; i++) { expect(currentOdds(s)).toBe(SUMMON_ODDS[i]); const c = SUMMON_LV_COST[i]; const g = s.gold; expect(dispatch(s, { type: 'upgradeSummon' }).ok).toBe(true); expect(g - s.gold).toBe(c); }
    expect(s.summonLv).toBe(MAX_SUMMON_LV); expect(dispatch(s, { type: 'upgradeSummon' }).ok).toBe(false);
  });
});

describe('합성·조합', () => {
  it('같은 속성 3개 → 같은 속성 다음 등급 (확정), 정확히 3개 소모, 기준 유닛 자리', () => {
    const s = playing(5); const ids = fill(s, 'ice', 0, 4); const anchor = s.units.find(u => u.id === ids[2])!; const slot = anchor.slot;
    const r = dispatch(s, { type: 'merge', id: ids[2] }); expect(r.ok).toBe(true);
    expect(s.units.length).toBe(2); const nu = s.units.find(u => u.grade === 1)!; expect(nu.kind).toBe('ice'); expect(nu.slot).toBe(slot);
    expect(s.slots.filter(x => x != null).length).toBe(2);
  });
  it('속성이 다르면 확정 합성 실패, random=true면 무작위 속성으로 성공', () => {
    const s = playing(6); const a = fill(s, 'fire', 1, 1)[0]; fill(s, 'ice', 1, 1); fill(s, 'wind', 1, 1);
    expect(dispatch(s, { type: 'merge', id: a }).ok).toBe(false); expect(s.units.length).toBe(3);
    const cm = canMerge(s, s.units[0]); expect(cm.confirmed).toBe(false); expect(cm.random).toBe(true);
    expect(dispatch(s, { type: 'merge', id: a, random: true }).ok).toBe(true); expect(s.units.length).toBe(1); expect(s.units[0].grade).toBe(2);
  });
  it('전설·신화는 합성 불가, 등급이 다르면 재료가 되지 않음', () => {
    const s = playing(7); const l = fill(s, 'fire', 3, 3)[0]; expect(dispatch(s, { type: 'merge', id: l }).ok).toBe(false);
    const m = createUnit(s, 'dragon', 4, bestFreeSlot(s)); expect(dispatch(s, { type: 'merge', id: m.id }).ok).toBe(false);
    const t = playing(8); const a = fill(t, 'bolt', 0, 2)[0]; fill(t, 'bolt', 1, 1); expect(dispatch(t, { type: 'merge', id: a }).ok).toBe(false);
  });
  it('자동 합성은 가능한 확정 합성을 모두 수행하고 연쇄 승급한다 (9개 일반 → 1개 영웅)', () => {
    const s = playing(9); fill(s, 'earth', 0, 9); const r = dispatch(s, { type: 'automerge' }); expect(r.ok).toBe(true);
    expect(s.units.length).toBe(1); expect(s.units[0].grade).toBe(2); expect(s.units[0].kind).toBe('earth'); expect(s.stats.merges).toBe(4);
    expect(dispatch(s, { type: 'automerge' }).ok).toBe(false);
  });
  it('같은 id로 재실행해도 복제되지 않는다', () => {
    const s = playing(10); const ids = fill(s, 'wind', 0, 3); expect(dispatch(s, { type: 'merge', id: ids[0] }).ok).toBe(true); expect(dispatch(s, { type: 'merge', id: ids[0] }).ok).toBe(false); expect(s.units.length).toBe(1);
  });
  it('신화 조합: 전설 3종 정확히 소모, 재료 부족 시 거부, 레시피는 모두 서로 다른 속성', () => {
    for (const id of MYTHIC_IDS) expect(new Set(MYTHICS[id].recipe).size).toBe(3);
    const s = playing(11); expect(dispatch(s, { type: 'craft', id: 'dragon' }).ok).toBe(false);
    fill(s, 'bolt', 3, 1); fill(s, 'ice', 3, 1); expect(recipeStatus(s, 'dragon').missing).toBe(1); fill(s, 'wind', 3, 1); fill(s, 'fire', 3, 1);
    expect(dispatch(s, { type: 'craft', id: 'dragon' }).ok).toBe(true);
    expect(s.units.length).toBe(2); expect(s.units.some(u => u.kind === 'dragon' && u.grade === 4)).toBe(true); expect(s.units.some(u => u.kind === 'fire')).toBe(true); expect(s.stats.mythics).toEqual(['dragon']);
  });
});

describe('판매·이동·강화·골드 전달', () => {
  it('판매는 등급별 가격을 주고 자리를 비운다', () => { const s = playing(12); const id = fill(s, 'fire', 2, 1)[0]; const g = s.gold; expect(dispatch(s, { type: 'sell', id }).ok).toBe(true); expect(s.gold - g).toBe(SELL_VALUE[2]); expect(s.units.length).toBe(0); expect(s.slots.every(x => x == null)).toBe(true); });
  it('이동: 빈 자리로 이동, 유닛 있는 자리는 교환, 잘못된 자리 거부', () => {
    const s = playing(13); const [a, b] = fill(s, 'fire', 0, 2); const ua = s.units[0], ub = s.units[1]; const sa = ua.slot, sb = ub.slot;
    expect(dispatch(s, { type: 'move', id: a, slot: 23 }).ok).toBe(true); expect(ua.slot).toBe(23); expect(s.slots[sa]).toBeNull(); expect(s.slots[23]).toBe(a);
    expect(dispatch(s, { type: 'move', id: a, slot: sb }).ok).toBe(true); expect(ua.slot).toBe(sb); expect(ub.slot).toBe(23); expect(s.slots[sb]).toBe(a); expect(s.slots[23]).toBe(b);
    expect(dispatch(s, { type: 'move', id: a, slot: 99 }).ok).toBe(false);
  });
  it('공격력 강화는 비용이 오르고 능력치에 반영된다', () => {
    const s = playing(14); const g = s.gold; expect(dispatch(s, { type: 'upgradeAtk' }).ok).toBe(true); expect(g - s.gold).toBe(atkUpgradeCost(0)); expect(atkMul(s)).toBeCloseTo(1 + ATK_PER_LV, 9);
    expect(unitStats('fire', 1, atkMul(s)).dmg).toBeCloseTo(ELEMENT_DEFS.fire.dmg * GRADE_MUL[1] * (1 + ATK_PER_LV), 6);
  });
  it('골드 보내기: 최소액·잔액 검증, 받기는 통계에 기록', () => {
    const s = playing(15, 100); expect(dispatch(s, { type: 'sendGold', amount: MIN_SEND_GOLD - 1 }).ok).toBe(false); expect(dispatch(s, { type: 'sendGold', amount: 500 }).ok).toBe(false);
    expect(dispatch(s, { type: 'sendGold', amount: 60 }).ok).toBe(true); expect(s.gold).toBe(40); expect(s.stats.goldSent).toBe(60);
    expect(dispatch(s, { type: 'receiveGold', amount: 25 }).ok).toBe(true); expect(s.gold).toBe(65); expect(s.stats.goldReceived).toBe(25);
  });
});

describe('라운드·몬스터·탈락·승리', () => {
  it('라운드 계획: 보스 라운드는 10의 배수, 체력은 단조 증가', () => {
    for (let r = 1; r <= TOTAL_ROUNDS; r++) { const plan = roundPlan(r); expect(plan.length).toBeGreaterThan(0); expect(plan.some(p => p.boss)).toBe(isBossRound(r)); if (r > 1) expect(baseHp(r)).toBeGreaterThan(baseHp(r - 1)); }
    expect(roundPlan(10)[0].hp).toBe(Math.round(baseHp(10) * MONSTER_DEFS.boss.hpMul));
  });
  it('솔로: 카운트다운 후 라운드 1, 25초마다 다음 라운드, 라운드 보상 지급', () => {
    const s = newGame(1, 'solo'); for (let i = 0; i < 4 * 30; i++) step(s, DT); expect(s.round).toBe(1); expect(s.phase).toBe('playing');
    const g = s.gold; for (let i = 0; i < ROUND_TIME * 30 + 2; i++) step(s, DT); expect(s.round).toBe(2); expect(s.gold - g).toBe(roundIncome(1));
  });
  it('멀티: 라운드는 외부 신호로만 진행, 중복·역행 신호 무시', () => {
    const s = newGame(1, 'multi'); for (let i = 0; i < 10 * 30; i++) step(s, DT); expect(s.round).toBe(0); expect(s.phase).toBe('countdown');
    startRound(s, 1); expect(s.round).toBe(1); const q = s.spawnQueue.length; startRound(s, 1); expect(s.spawnQueue.length).toBe(q); startRound(s, 0); expect(s.round).toBe(1);
    for (let i = 0; i < ROUND_TIME * 30 * 2; i++) step(s, DT); expect(s.round).toBe(1);
    startRound(s, 3); expect(s.round).toBe(3);
  });
  it('몬스터는 고리를 돌며 바퀴 수가 늘고, 감속·기절 규칙(보스 상한)이 적용된다', () => {
    const s = playing(2); const m = spawnMonster(s, { type: 'grunt', hp: 1e9, speed: 50, boss: false, round: 1 });
    for (let i = 0; i < 30 * 30; i++) step(s, DT); expect(m.laps).toBe(1); expect(m.dist).toBeGreaterThan(0); expect(m.dist).toBeLessThan(PATH_LEN);
    applySlow(m, 0.5, 2); expect(m.slowAmt).toBe(0.5); applySlow(m, 0.3, 2); expect(m.slowAmt).toBe(0.5);
    const b = spawnMonster(s, { type: 'boss', hp: 1e9, speed: 30, boss: true, round: 10 }); applySlow(b, 0.55, 2); expect(b.slowAmt).toBe(0.3);
    applyStun(b, 1, 0.25, 2.5); expect(b.stunT).toBeCloseTo(0.25, 9); applyStun(m, 1, 0.25, 2.5); expect(m.stunT).toBe(1); applyStun(m, 1, 0.25, 2.5); expect(m.stunT).toBe(1); // 면역 중 재적용 없음
  });
  it(`살아 있는 몬스터가 ${MONSTER_CAP}마리면 탈락, 판은 정리되고 이후 행동 불가`, () => {
    const s = playing(3); for (let i = 0; i < MONSTER_CAP; i++) spawnMonster(s, { type: 'grunt', hp: 1e9, speed: 50, boss: false, round: 1 });
    step(s, DT); expect(s.phase).toBe('eliminated'); expect(s.monsters.length).toBe(0); expect(dispatch(s, { type: 'summon' }).ok).toBe(false); expect(s.eliminatedReason).toContain(String(MONSTER_CAP));
  });
  it(`보스를 ${BOSS_TIME}초 안에 못 잡으면 탈락, 잡으면 보상`, () => {
    const s = playing(4); spawnMonster(s, { type: 'boss', hp: 1e9, speed: 30, boss: true, round: 10 });
    for (let i = 0; i < (BOSS_TIME + 1) * 30; i++) step(s, DT); expect(s.phase).toBe('eliminated'); expect(s.eliminatedReason).toContain('보스');
    const t = playing(5); const m = spawnMonster(t, { type: 'boss', hp: 1, speed: 30, boss: true, round: 10 }); const u = createUnit(t, 'wind', 3, 0); const g = t.gold; m.dist = 5; for (let i = 0; i < 12; i++) step(t, DT);
    expect(t.stats.bossKills).toBe(1); expect(t.gold - g).toBe(killGold(10, true)); expect(t.bossDeadline).toBeNull(); expect(u.kills).toBe(1);
  });
  it('유닛은 사거리 안의 가장 오래 돈 몬스터를 공격하고 피해가 누적된다', () => {
    const s = playing(6); const u = createUnit(s, 'wind', 0, 0); const p = slotPos(0);
    const far = spawnMonster(s, { type: 'grunt', hp: 1e6, speed: 0, boss: false, round: 1 }); far.dist = 600; const q = pathPos(600); far.x = q.x; far.y = q.y;
    const near = spawnMonster(s, { type: 'grunt', hp: 1e6, speed: 0, boss: false, round: 1 }); near.dist = 2; near.laps = 3; const n = pathPos(2); near.x = n.x; near.y = n.y;
    expect(Math.hypot(near.x - p.x, near.y - p.y)).toBeLessThanOrEqual(unitStats('wind', 0).range);
    for (let i = 0; i < 30; i++) step(s, DT);
    expect(near.hp).toBeLessThan(1e6); expect(far.hp).toBe(1e6); expect(u.dmg).toBeGreaterThan(0); expect(s.stats.damage).toBeCloseTo(u.dmg, 6);
  });
  it('마지막 라운드 보스를 잡으면 승리(솔로), finish()는 살아 있으면 승리 처리(멀티)', () => {
    const s = playing(7); s.round = TOTAL_ROUNDS; const m = spawnMonster(s, { type: 'boss', hp: 1, speed: 30, boss: true, round: TOTAL_ROUNDS }); createUnit(s, 'wind', 3, 0); m.dist = 5; for (let i = 0; i < 12; i++) step(s, DT);
    expect(s.phase).toBe('won');
    const t = newGame(8, 'multi'); startRound(t, 1); finish(t); expect(t.phase).toBe('won'); const e = newGame(9, 'multi'); startRound(e, 1); for (let i = 0; i < MONSTER_CAP; i++) spawnMonster(e, { type: 'grunt', hp: 1e9, speed: 50, boss: false, round: 1 }); step(e, DT); finish(e); expect(e.phase).toBe('eliminated');
  });
});

describe('결정성·스냅샷', () => {
  it('같은 시드 + 같은 입력 = 같은 해시', () => {
    const run = () => { const s = newGame(777, 'solo'); for (let i = 0; i < 60 * 30; i++) { if (i % 45 === 0) dispatch(s, { type: 'summon' }); if (i % 300 === 0) dispatch(s, { type: 'automerge' }); step(s, DT); s.events.length = 0; } return stateHash(s); };
    expect(run()).toBe(run());
  });
  it('관전 스냅샷은 유닛·몬스터를 압축하고 복원 시 위치가 보간된다', () => {
    const s = playing(8); fill(s, 'fire', 2, 2); const m = spawnMonster(s, { type: 'runner', hp: 100, speed: 80, boss: false, round: 4 }); m.hp = 50; m.dist = 100;
    const b = snapshot(s); expect(b.u.length).toBe(2); expect(b.m.length).toBe(1); expect(b.m[0][2]).toBe(50); expect(JSON.stringify(b).length).toBeLessThan(400);
    const us = snapUnits(b); expect(us[0].kind).toBe('fire'); expect(us[0].grade).toBe(2);
    const ms0 = snapMonsters(b, 0, pathPos, PATH_LEN); const ms1 = snapMonsters(b, 1, pathPos, PATH_LEN); expect(ms0[0].dist).toBe(100); expect(ms1[0].dist).toBe(180); expect(ms0[0].type).toBe('runner');
    const sm = summary(s); expect(sm.units).toBe(2); expect(sm.monsters).toBe(1); expect(sm.phase).toBe('playing');
  });
  it('유닛 이름·능력치 표가 모든 종류에 대해 정의됨', () => {
    for (const e of ELEMENTS) for (const g of [0, 1, 2, 3] as Grade[]) { expect(unitName(e, g)).toContain(ELEMENT_DEFS[e].name); expect(unitStats(e, g).dps).toBeGreaterThan(0); }
    for (const id of MYTHIC_IDS) { expect(unitName(id, 4)).toBe(MYTHICS[id].name); expect(unitStats(id, 4).dps).toBeGreaterThan(unitStats('wind', 3).dps); }
  });
});
