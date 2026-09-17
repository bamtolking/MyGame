import { describe, it, expect } from 'vitest';
import { createRun, placeItem, startBattle, applyBattleResult, pickReward, refreshReward, heal, chooseUnlock, checkStart, addItem, restoreCheckpoint, dismantleItem } from '../src/core/run';
import { generateCandidates, candidateFlags } from '../src/core/rewards';
import { seedRng } from '../src/core/rng';
import { validateRun } from '../src/core/save';
import type { BattleResult } from '../src/combat/types';
import { BALANCE } from '../src/data/balance';
import { EQUIPMENT } from '../src/data/equipment';

const winResult = (hp: number): BattleResult => ({ won: true, hpAfter: hp, stats: { duration: 20, damageTaken: 0, shieldStart: 0, shieldAbsorbed: 0, shieldLeft: 0, protectedDamage: 0, kills: 5, spawned: 5, weapons: {}, shockwaveUsed: false, shockwavePushed: 0, enraged: false, bossPhase: 0 } });

function setup(seed = 7) {
  const s = createRun(seed, 'normal', false);
  const mg = s.items.find(i => i.id === 'mg')!; placeItem(s, mg.uid, 1, 0, 0);
  const med = s.items.find(i => i.id === 'medkit')!; placeItem(s, med.uid, 2, 3, 0);
  const dag = s.items.find(i => i.id === 'dagger')!; placeItem(s, dag.uid, 3, 0, 0);
  return s;
}

describe('출발 검사와 전투 시작', () => {
  it('공격 장비가 없으면 출발을 막는다', () => {
    const s = createRun(1, 'normal', false);
    expect(checkStart(s).ok).toBe(false);
    expect(startBattle(s, true).ok).toBe(false);
    expect(s.phase).toBe('prep');
  });
  it('작업대에 장비가 남으면 확인 없이는 출발하지 않고, 확인 시 분해 환급 후 출발한다', () => {
    const s = setup();
    addItem(s, 'lens', 1);
    const chk = checkStart(s);
    expect(chk.ok).toBe(true); expect(chk.bench.length).toBe(1); expect(chk.benchRefund).toBe(1);
    expect(startBattle(s, false).ok).toBe(false);
    expect(s.items.length).toBe(4);
    const p = s.parts;
    expect(startBattle(s, true).ok).toBe(true);
    expect(s.parts).toBe(p + 1); expect(s.items.length).toBe(3); expect(s.phase).toBe('battle'); expect(s.checkpoint).not.toBeNull();
  });
  it('출발 연타로 전투가 중복 시작되지 않는다', () => {
    const s = setup();
    expect(startBattle(s, true).ok).toBe(true);
    expect(startBattle(s, true).ok).toBe(false);
  });
  it('전투 시작 체크포인트로 복원하면 정리 상태와 장비·재화가 일치한다', () => {
    const s = setup();
    startBattle(s, true);
    const c = restoreCheckpoint(s)!;
    expect(c.phase).toBe('prep'); expect(c.parts).toBe(s.parts); expect(c.items.length).toBe(s.items.length); expect(c.hp).toBe(s.hp);
    expect(validateRun(c)).toBeNull();
  });
});

describe('전투 결과 반영', () => {
  it('보상·구급팩 회복은 한 번만 적용된다 (중복 호출 무시)', () => {
    const s = setup(); s.hp = 60;
    startBattle(s, true);
    expect(s.battle!.heal).toBe(12);
    const p = s.parts;
    expect(applyBattleResult(s, winResult(50)).ok).toBe(true);
    expect(s.hp).toBe(62); expect(s.parts).toBe(p + BALANCE.rewardParts.normal);
    expect(applyBattleResult(s, winResult(50)).ok).toBe(false);
    expect(s.hp).toBe(62); expect(s.parts).toBe(p + BALANCE.rewardParts.normal);
    expect(s.phase).toBe('reward'); expect(s.stage).toBe(2); expect(s.checkpoint).toBeNull();
  });
  it('전투 후 구급팩을 넣어도 이미 끝난 전투의 회복을 받을 수 없다', () => {
    const s = createRun(9, 'normal', false);
    const mg = s.items.find(i => i.id === 'mg')!; placeItem(s, mg.uid, 1, 0, 0);
    // 구급팩은 작업대에 둔 채 출발(분해) → 회복 0
    const med = s.items.find(i => i.id === 'medkit')!; dismantleItem(s, med.uid);
    const dag = s.items.find(i => i.id === 'dagger')!; dismantleItem(s, dag.uid);
    startBattle(s, true);
    expect(s.battle!.heal).toBe(0);
    s.hp = 40;
    applyBattleResult(s, winResult(40));
    expect(s.hp).toBe(40);
  });
  it('패배하면 결과 단계로 가고 결과가 유지된다', () => {
    const s = setup(); startBattle(s, true);
    applyBattleResult(s, { ...winResult(0), won: false });
    expect(s.phase).toBe('result'); expect(s.result?.won).toBe(false); expect(s.hp).toBe(0);
  });
  it('4구간 정예 후 잠긴 칸 2개 선택, 8구간 후 나머지 자동 해금', () => {
    const s = setup(); s.stage = 4; startBattle(s, true); applyBattleResult(s, winResult(80));
    expect(s.phase).toBe('unlock'); expect(s.pendingUnlock).toBe(2);
    expect(chooseUnlock(s, [0]).ok).toBe(false);
    expect(chooseUnlock(s, [1, 2]).ok).toBe(false); // 잠긴 칸 아님
    expect(chooseUnlock(s, [0, 4]).ok).toBe(true);
    expect(s.grid.locked.filter(Boolean).length).toBe(2); expect(s.phase).toBe('reward'); expect(s.stage).toBe(5);
    pickReward(s, 0);
    s.stage = 8; startBattle(s, true); applyBattleResult(s, winResult(80));
    expect(s.grid.locked.filter(Boolean).length).toBe(0); expect(s.phase).toBe('reward'); expect(s.stage).toBe(9);
  });
  it('12구간 보스 승리 시 결과(승리)', () => {
    const s = setup(); s.stage = 12; startBattle(s, true); applyBattleResult(s, winResult(30));
    expect(s.phase).toBe('result'); expect(s.result?.won).toBe(true);
  });
});

describe('보상·경제', () => {
  it('후보는 3개, 같은 종류 3개 금지, 최소 1개는 쓸모 있음', () => {
    for (let seed = 1; seed < 60; seed++) {
      const rng = seedRng(seed);
      const s = createRun(seed, 'normal', false);
      const c = generateCandidates(rng, 3, s.items);
      expect(c.length).toBe(3);
      expect(new Set(c.map(x => x.id)).size).toBeGreaterThan(1);
      expect(c.filter(x => EQUIPMENT[x.id].kind === 'survival').length).toBeLessThanOrEqual(1);
      const useful = c.some(x => EQUIPMENT[x.id].kind !== 'support' || candidateFlags(x, s.items).hasTarget || candidateFlags(x, s.items).mergeable);
      expect(useful).toBe(true);
    }
  });
  it('후보는 저장된 난수 상태에서 나오므로 같은 시드는 같은 후보를 만든다', () => {
    const a = generateCandidates(seedRng(42), 5, []), b = generateCandidates(seedRng(42), 5, []);
    expect(a).toEqual(b);
  });
  it('보상 선택 후 장비가 작업대에 추가되고 새로고침은 1회·비용 있음', () => {
    const s = setup(); startBattle(s, true); applyBattleResult(s, winResult(80));
    const first = JSON.stringify(s.reward!.candidates);
    s.parts = 2;
    expect(refreshReward(s).ok).toBe(false); // 부품 부족
    expect(JSON.stringify(s.reward!.candidates)).toBe(first);
    s.parts = 3;
    expect(refreshReward(s).ok).toBe(true); expect(s.parts).toBe(0);
    expect(refreshReward(s).ok).toBe(false);
    const n = s.items.length;
    expect(pickReward(s, 1).ok).toBe(true);
    expect(s.items.length).toBe(n + 1); expect(s.items[n].loc).toBe('bench'); expect(s.phase).toBe('prep');
    expect(pickReward(s, 0).ok).toBe(false); // 다시 못 고름
  });
  it('회복은 정비마다 1회, 부품 6, 최대 체력 20%', () => {
    const s = setup(); s.hp = 50; s.parts = 6;
    expect(heal(s).ok).toBe(true); expect(s.hp).toBe(70); expect(s.parts).toBe(0);
    s.parts = 12;
    expect(heal(s).ok).toBe(false);
    s.healUsed = false; s.parts = 5; expect(heal(s).ok).toBe(false);
  });
});
