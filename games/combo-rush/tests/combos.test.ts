import { describe, it, expect } from 'vitest';
import { game, put, run, spawnAt, forceWave, drain, pin } from './helpers';
import { pathGeo, mapSlots } from '../src/data/maps';
import { COMBO_NUM } from '../src/data/combos';
import { UNIT_PARAMS } from '../src/data/units';
import { applyOil, applyChill, applyBurn, applyMark, hitEnemy, computeCtx, beamHits } from '../src/sim/combat';
import { step } from '../src/sim/engine';

/** 특정 슬롯 앞 경로 거리(anchor) 근처에 적을 배치 */
function nearSlot(s: ReturnType<typeof game>, slot: number, offset = 0) { return mapSlots(s.mapId)[slot].anchorDist + offset; }

describe('연계 ① 점화 폭발 (기름 + 화염)', () => {
  it('기름 묻은 적이 화염 직격을 받으면 폭발하고 기름이 소모되며, 폭발은 다시 폭발을 일으키지 않는다', () => {
    const s = game(1); forceWave(s); const u = put(s, 'flame', 1, 1); const a = spawnAt(s, 'scrapturtle', nearSlot(s, 1)); const b = spawnAt(s, 'scrapturtle', nearSlot(s, 1) + 12);
    pin(a); pin(b);
    applyOil(s, a, 6); applyOil(s, b, 6);
    const hpB = b.hp; run(s, 1.2);
    const ev = drain(s); const combos = ev.filter(e => e.t === 'combo' && e.id === 'ignite');
    expect(combos.length).toBeGreaterThanOrEqual(1); expect(combos[0]).toMatchObject({ first: true });
    expect(s.combosSeen).toContain('ignite');
    // 기름 소모: a 또는 b 중 점화된 쪽은 oil=0, 폭발로 b도 피해
    expect(a.st.oil === 0 || b.st.oil === 0).toBe(true); expect(b.hp).toBeLessThan(hpB);
    expect(s.stats.combos.ignite).toBeLessThanOrEqual(2); // 재발동 대기(1.5초) 안에 무한 반복 없음
  });
  it('기름이 없으면 폭발하지 않는다', () => {
    const s = game(1); forceWave(s); put(s, 'flame', 1, 1); const a = spawnAt(s, 'scrapturtle', nearSlot(s, 1)); pin(a);
    run(s, 2); expect(drain(s).filter(e => e.t === 'combo').length).toBe(0);
  });
  it('기름분사기 + 화염봇을 실제로 배치하면 자연스럽게 연계가 발생한다', () => {
    const s = game(1); forceWave(s); put(s, 'oil', 1, 1); put(s, 'flame', 1, 2);
    for (let i = 0; i < 6; i++) spawnAt(s, 'scrapturtle', -20 * i);
    run(s, 25); expect(s.combosSeen).toContain('ignite');
  });
});

describe('연계 ② 집속 폭격 (회오리 + 폭탄)', () => {
  it('표식 적 근처 폭발은 피해·범위가 강화된다', () => {
    const s = game(1); forceWave(s); put(s, 'bomber', 1, 1);
    const a = spawnAt(s, 'scrapturtle', nearSlot(s, 1)); pin(a); applyMark(s, a, 5);
    const hp0 = a.hp; run(s, 3.5);
    const ev = drain(s); expect(ev.some(e => e.t === 'combo' && e.id === 'focus')).toBe(true);
    const ex = ev.find(e => e.t === 'explode' && e.kind === 'focus') as { r: number }; expect(ex.r).toBeCloseTo(UNIT_PARAMS.bomber.radius[1] * COMBO_NUM.focusRadiusMul);
    expect(hp0 - a.hp).toBeGreaterThanOrEqual(14 * COMBO_NUM.focusDmgMul - 2 - 0.01);
  });
  it('회오리는 적을 경로 위에서 표식 지점으로 모은다(길 이탈 없음)', () => {
    const s = game(1); forceWave(s); const v = put(s, 'vortex', 2, 1); const anchor = nearSlot(s, 1);
    const a = spawnAt(s, 'gearbug', anchor + 40), b = spawnAt(s, 'gearbug', anchor - 40);
    const g = pathGeo('A'); run(s, 1.0);
    expect(Math.abs(a.dist - anchor)).toBeLessThan(40); expect(Math.abs(b.dist - anchor)).toBeLessThan(40);
    expect(a.st.mark).toBeGreaterThan(0);
    for (const e of s.enemies) { const p = g; expect(e.dist).toBeGreaterThanOrEqual(0); expect(e.dist).toBeLessThanOrEqual(p.len); }
    expect(drain(s).some(e => e.t === 'vortex')).toBe(true);
  });
  it('보스는 끌리지 않고 감속·표식만 받는다', () => {
    const s = game(1); forceWave(s); put(s, 'vortex', 3, 1); const anchor = nearSlot(s, 1);
    const boss = spawnAt(s, 'boss_golem', anchor + 30); const d0 = boss.dist; run(s, 0.5);
    expect(boss.dist).toBeGreaterThan(d0); expect(boss.st.bossSlow).toBeGreaterThan(0); expect(boss.st.mark).toBeGreaterThan(0);
  });
});

describe('연계 ③ 빙결 관통 (빙결 + 레이저)', () => {
  it('냉각 적을 레이저가 맞히면 피해가 증가하고 파편이 주변 적을 때린다', () => {
    const s = game(1); forceWave(s); put(s, 'laser', 1, 1);
    const a = spawnAt(s, 'scrapturtle', nearSlot(s, 1)); const b = spawnAt(s, 'scrapturtle', nearSlot(s, 1) + 24); pin(a); pin(b);
    applyChill(s, b, 0.4, 10); const hpA = a.hp;
    step(s); // 첫 스텝에서 발사: 광선은 더 앞선 b를 향함(a는 광선 폭 밖)
    const ev = drain(s); expect(ev.some(e => e.t === 'combo' && e.id === 'shards')).toBe(true);
    const hitB = ev.filter(e => e.t === 'hit' && e.enemy === b.id) as { dmg: number }[]; expect(hitB[0].dmg).toBeCloseTo(8 * COMBO_NUM.shardsDmgMul - 2, 1);
    expect(a.hp).toBeLessThan(hpA); // 파편 피해
    expect(ev.filter(e => e.t === 'combo').length).toBe(1);
  });
  it('냉각되지 않은 적에는 파편이 없다', () => {
    const s = game(1); forceWave(s); put(s, 'laser', 1, 1); const a = spawnAt(s, 'scrapturtle', nearSlot(s, 1)); pin(a);
    step(s); expect(drain(s).some(e => e.t === 'combo')).toBe(false);
  });
  it('레이저는 가장 많은 적을 관통하는 방향을 고르고 표시 폭과 판정 폭이 같다', () => {
    const s = game(1); forceWave(s); put(s, 'laser', 1, 0); // 슬롯0(60,135): 윗줄(y=70)을 비스듬히 볼 수 있는 위치
    const base = nearSlot(s, 0); const es = [40, 65, 90, 115].map(o => pin(spawnAt(s, 'gearbug', base + o)));
    step(s); const ev = drain(s); const hits = ev.filter(e => e.t === 'hit') as { enemy: number }[]; const beam = ev.find(e => e.t === 'beam') as { x: number; y: number; x2: number; y2: number; width: number };
    expect(new Set(hits.map(h => h.enemy)).size).toBeGreaterThanOrEqual(3);
    // 이벤트의 광선 선분·폭으로 다시 판정하면 같은 적들이 나온다
    const ang = Math.atan2(beam.y2 - beam.y, beam.x2 - beam.x); const len = Math.hypot(beam.x2 - beam.x, beam.y2 - beam.y);
    const recheck = beamHits(s, beam.x, beam.y, ang, len, beam.width).map(e => e.id).sort();
    expect(recheck).toEqual([...new Set(hits.map(h => h.enemy))].sort());
  });
});

describe('연계 ④ 냉각 연쇄 (빙결 + 번개)', () => {
  it('냉각 적에게 번개가 닿으면 연결 대상이 늘고 같은 적은 한 번만 맞는다', () => {
    const s = game(1); forceWave(s); put(s, 'tesla', 1, 1); const base = nearSlot(s, 1);
    const es = [0, 15, 30, 45, 60, 75, 90].map(o => pin(spawnAt(s, 'scrapturtle', base + o)));
    step(s); const noFrost = drain(s).filter(e => e.t === 'hit').length; expect(noFrost).toBe(UNIT_PARAMS.tesla.targets[1]);
    const s2 = game(1); forceWave(s2); put(s2, 'tesla', 1, 1);
    const es2 = [0, 15, 30, 45, 60, 75, 90].map(o => pin(spawnAt(s2, 'scrapturtle', base + o))); for (const e of es2) applyChill(s2, e, 0.4, 10);
    step(s2); const ev = drain(s2); const hits = ev.filter(e => e.t === 'hit') as { enemy: number }[];
    expect(hits.length).toBe(UNIT_PARAMS.tesla.targets[1] + COMBO_NUM.chainExtra);
    expect(new Set(hits.map(h => h.enemy)).size).toBe(hits.length); // 동일 적 반복 타격 없음
    expect(ev.some(e => e.t === 'combo' && e.id === 'chainfrost')).toBe(true);
  });
});

describe('연계 ⑤ 화염 회오리 (회오리 + 화염)', () => {
  it('범위 안에 불타는 적이 있으면 회오리가 2초간 범위 화상 피해를 주고 5초 대기한다', () => {
    const s = game(1); forceWave(s); const v = put(s, 'vortex', 1, 1);
    const a = spawnAt(s, 'scrapturtle', nearSlot(s, 1)); const b = spawnAt(s, 'scrapturtle', nearSlot(s, 1) + 10); pin(a); pin(b); a.hp = a.maxHp = 9999; b.hp = b.maxHp = 9999;
    applyBurn(s, a, 3, 3); const hpB = b.hp;
    run(s, 0.1); expect(s.combosSeen).toContain('firevortex'); expect(v.fireVortexT).toBeGreaterThan(0);
    run(s, 2.2); expect(v.fireVortexT).toBe(0); expect(b.hp).toBeLessThan(hpB - 3);
    expect(s.stats.combos.firevortex).toBe(1); // 대기 중 재발동 없음
    applyBurn(s, a, 3, 3); run(s, 2); expect(s.stats.combos.firevortex).toBe(1); // 5초 대기 중에는 불타도 재발동 없음
    applyBurn(s, a, 3, 3); run(s, 4); expect(s.stats.combos.firevortex).toBe(2); // 대기 후 재발동
  });
});

describe('연계 ⑥ 과충전 광선 (공병 + 레이저)', () => {
  it('공병 범위 안의 레이저병은 주기적으로 과충전 광선을 쏘고, 범위 밖이면 충전되지 않는다', () => {
    const s = game(1); forceWave(s); const l = put(s, 'laser', 1, 1); put(s, 'engineer', 1, 2);
    const sl = mapSlots('A'); expect(Math.hypot(sl[1].x - sl[2].x, sl[1].y - sl[2].y)).toBeLessThanOrEqual(96);
    const a = spawnAt(s, 'scrapturtle', nearSlot(s, 1)); pin(a); a.hp = 99999; a.maxHp = 99999;
    run(s, 7); const ev = drain(s);
    expect(ev.some(e => e.t === 'overcharge')).toBe(true);
    const beams = ev.filter(e => e.t === 'beam') as { over: boolean; width: number }[];
    expect(beams.some(b => b.over)).toBe(true); expect(beams.some(b => !b.over)).toBe(true);
    const wOver = beams.find(b => b.over)!.width, wNorm = beams.find(b => !b.over)!.width; expect(wOver).toBeCloseTo(wNorm * COMBO_NUM.overchargeWidthMul);
    expect(s.combosSeen).toContain('overcharge');
    const s2 = game(1); forceWave(s2); const l2 = put(s2, 'laser', 1, 0); put(s2, 'engineer', 1, 7);
    const b2 = spawnAt(s2, 'scrapturtle', nearSlot(s2, 0)); pin(b2); b2.hp = 99999; run(s2, 7); expect(l2.overcharged).toBe(false); expect(drain(s2).some(e => e.t === 'overcharge')).toBe(false);
  });
  it('공병 지원은 상한이 있고 공격 속도에 실제 반영된다', () => {
    const s = game(1); forceWave(s); const l = put(s, 'laser', 1, 1); put(s, 'engineer', 3, 2); put(s, 'engineer', 3, 0); put(s, 'engineer', 3, 5);
    const c = computeCtx(s).get(l.id)!; expect(c.haste).toBeLessThanOrEqual(UNIT_PARAMS.engineer.hasteCap);
    const a = spawnAt(s, 'scrapturtle', nearSlot(s, 1)); pin(a); a.hp = 99999;
    run(s, 6); const shotsBoosted = drain(s).filter(e => e.t === 'beam').length;
    const s2 = game(1); forceWave(s2); put(s2, 'laser', 1, 1); const b = spawnAt(s2, 'scrapturtle', nearSlot(s2, 1)); pin(b); b.hp = 99999;
    run(s2, 6); const shotsPlain = drain(s2).filter(e => e.t === 'beam').length;
    expect(shotsBoosted).toBeGreaterThan(shotsPlain);
  });
});

describe('보스 패턴', () => {
  it('골렘은 체력 50% 아래에서 장갑·가속', () => {
    const s = game(1); forceWave(s); const b = spawnAt(s, 'boss_golem', 100); const arm = b.armor; const sp0 = b.speed;
    hitEnemy(s, b, b.maxHp * 0.6, { unit: null, kind: 'laser', combo: false, dtype: 'dot' }); run(s, 0.1);
    expect(b.boss!.enraged).toBe(true); expect(b.armor).toBe(arm + 4); expect(drain(s).some(e => e.t === 'bosspattern' && e.kind === 'enrage')).toBe(true);
  });
  it('코어 마스터는 예고 후 보호막·부하 소환·가속을 사용한다', () => {
    const s = game(1); forceWave(s); const b = spawnAt(s, 'boss_core', 100); b.speed = 0.01;
    run(s, 14.5); let ev = drain(s);
    expect(ev.some(e => e.t === 'bosspattern' && e.kind === 'shield' && e.phase === 'warn')).toBe(true);
    run(s, 2.1); ev = drain(s); expect(ev.some(e => e.t === 'bosspattern' && e.kind === 'shield' && e.phase === 'go')).toBe(true); expect(b.st.shield).toBeGreaterThan(0);
    hitEnemy(s, b, b.maxHp * 0.4, { unit: null, kind: 'laser', combo: false, dtype: 'dot', pierce: true }); run(s, 0.1); ev = drain(s);
    expect(ev.some(e => e.t === 'bosspattern' && e.kind === 'minion' && e.phase === 'warn')).toBe(true);
    run(s, 2.1); expect(s.enemies.filter(e => e.kind === 'boltant').length).toBe(6);
    run(s, 8); ev = drain(s); expect(ev.some(e => e.t === 'bosspattern' && e.kind === 'haste')).toBe(true);
  });
});
