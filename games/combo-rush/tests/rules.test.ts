import { describe, it, expect } from 'vitest';
import { game, put, run, spawnAt, forceWave, place, drain } from './helpers';
import { dispatch, serialize, deserialize, stateHash, step } from '../src/sim/engine';
import { START_GOLD, SUMMON_COST, REFRESH_FREE, REFRESH_COST, sellRefund, MAX_UNITS } from '../src/data/economy';
import { mapSlots, pathGeo, nearestDist, MAPS, PATH_HALF, SLOT_R } from '../src/data/maps';
import { UNIT_KINDS, unitStats, GRADE_INVEST } from '../src/data/units';
import { WAVES_NORMAL, HARD_EXTRA, waveDef } from '../src/data/waves';
import { unitById } from '../src/sim/state';
import { hitEnemy, applyChill, applyFreeze, enemySpeed } from '../src/sim/combat';

describe('맵 데이터', () => {
  it('배치 칸이 12개이고 길과 겹치지 않는다', () => {
    for (const id of ['A', 'B'] as const) {
      const slots = mapSlots(id); expect(slots.length).toBe(MAX_UNITS);
      const g = pathGeo(id);
      for (const sl of slots) { const d = nearestDist(g, sl.x, sl.y).dist; expect(d, `${id} slot ${sl.id}`).toBeGreaterThanOrEqual(PATH_HALF + SLOT_R); expect(sl.x).toBeGreaterThan(SLOT_R); expect(sl.x).toBeLessThan(400 - SLOT_R); }
      for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) expect(Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y)).toBeGreaterThan(SLOT_R * 2);
    }
  });
  it('두 맵은 경로가 다르다', () => { expect(MAPS.A.points).not.toEqual(MAPS.B.points); expect(pathGeo('A').len).not.toBeCloseTo(pathGeo('B').len); });
});

describe('소환 후보와 배치', () => {
  it('후보 3개는 서로 다른 종류', () => {
    for (let seed = 1; seed <= 40; seed++) { const s = game(seed); expect(new Set(s.offer).size).toBe(3); for (const k of s.offer) expect(UNIT_KINDS).toContain(k); }
  });
  it('첫 후보에 공격 유닛이 2개 이상', () => {
    const atk = ['flame', 'frost', 'laser', 'tesla', 'bomber'];
    for (let seed = 1; seed <= 60; seed++) { const s = game(seed); expect(s.offer.filter(k => atk.includes(k)).length).toBeGreaterThanOrEqual(2); }
  });
  it('배치하면 비용을 내고 후보가 갱신된다; 선택만으로는 비용이 나가지 않는다', () => {
    const s = game(3); const kind = s.offer[1]; const before = s.offer.slice();
    // "선택"은 UI 상태이므로 시뮬레이션 상태는 변하지 않음
    expect(s.gold).toBe(START_GOLD); expect(s.offer).toEqual(before);
    const r = place(s, 1, 0); expect(r.ok).toBe(true);
    expect(s.gold).toBe(START_GOLD - SUMMON_COST); expect(s.units.length).toBe(1); expect(s.units[0].kind).toBe(kind); expect(s.slots[0]).toBe(s.units[0].id);
    expect(s.offer).not.toEqual(before);
  });
  it('골드 부족·칸 중복·최대 수 초과 시 실패하며 상태가 변하지 않는다', () => {
    const s = game(4); s.gold = 10; const h = stateHash(s);
    expect(place(s, 0, 0).ok).toBe(false); expect(stateHash(s)).toBe(h);
    s.gold = 1000; expect(place(s, 0, 0).ok).toBe(true); expect(place(s, 0, 0).ok).toBe(false);
    for (let i = 1; i < MAX_UNITS; i++) expect(place(s, 0, i).ok).toBe(true);
    expect(s.units.length).toBe(MAX_UNITS);
    const r = place(s, 0, 0); expect(r.ok).toBe(false);
  });
  it('새로고침: 무료 2회 뒤 골드 차감, 골드 부족 시 실패', () => {
    const s = game(5); const o0 = s.offer.slice();
    expect(dispatch(s, { type: 'refresh' }).ok).toBe(true); expect(s.gold).toBe(START_GOLD); expect(s.refreshFree).toBe(REFRESH_FREE - 1);
    expect(dispatch(s, { type: 'refresh' }).ok).toBe(true); expect(s.gold).toBe(START_GOLD); expect(s.refreshFree).toBe(0);
    expect(dispatch(s, { type: 'refresh' }).ok).toBe(true); expect(s.gold).toBe(START_GOLD - REFRESH_COST);
    s.gold = REFRESH_COST - 1; expect(dispatch(s, { type: 'refresh' }).ok).toBe(false);
    expect(s.offer).not.toEqual(o0);
  });
  it('후보 새로고침은 시드로 재현된다', () => {
    const a = game(9), b = game(9); dispatch(a, { type: 'refresh' }); dispatch(b, { type: 'refresh' }); expect(a.offer).toEqual(b.offer);
  });
});

describe('합성·판매·이동', () => {
  it('같은 종류·등급만 합성되고 투입 골드가 합산된다', () => {
    const s = game(1); const a = put(s, 'flame', 1, 0), b = put(s, 'flame', 1, 1), c = put(s, 'frost', 1, 2), d = put(s, 'flame', 2, 3);
    expect(dispatch(s, { type: 'merge', a: a.id, b: c.id }).ok).toBe(false);
    expect(dispatch(s, { type: 'merge', a: a.id, b: d.id }).ok).toBe(false);
    expect(dispatch(s, { type: 'merge', a: a.id, b: a.id }).ok).toBe(false);
    a.cd = 0.4; b.cd = 0.7;
    const r = dispatch(s, { type: 'merge', a: a.id, b: b.id }); expect(r.ok).toBe(true);
    expect(a.grade).toBe(2); expect(a.invested).toBe(GRADE_INVEST[2]); expect(a.cd).toBe(0.7);
    expect(unitById(s, b.id)).toBeUndefined(); expect(s.slots[1]).toBeNull(); expect(s.slots[0]).toBe(a.id); expect(s.units.length).toBe(3);
  });
  it('최고 등급(3)은 합성할 수 없다', () => {
    const s = game(1); const a = put(s, 'laser', 3, 0), b = put(s, 'laser', 3, 1);
    expect(dispatch(s, { type: 'merge', a: a.id, b: b.id }).ok).toBe(false); expect(s.units.length).toBe(2);
  });
  it('합성·판매를 반복해도 골드가 늘지 않는다', () => {
    const s = game(2); s.gold = 1000; const g0 = s.gold;
    // 25×4 = 100 투입 → 3등급 → 판매 60
    for (let i = 0; i < 4; i++) { s.offer[0] = 'tesla'; expect(place(s, 0, i).ok).toBe(true); }
    const ids = s.units.map(u => u.id);
    dispatch(s, { type: 'merge', a: ids[0], b: ids[1] }); dispatch(s, { type: 'merge', a: ids[2], b: ids[3] }); dispatch(s, { type: 'merge', a: ids[0], b: ids[2] });
    expect(s.units.length).toBe(1); expect(s.units[0].grade).toBe(3); expect(s.units[0].invested).toBe(100);
    dispatch(s, { type: 'sell', id: ids[0] });
    expect(s.gold).toBe(g0 - 100 + sellRefund(100)); expect(s.gold).toBeLessThan(g0);
    expect(s.units.length).toBe(0); expect(s.slots.every(x => x === null)).toBe(true);
  });
  it('이동은 대기시간을 초기화하지 않고 연속 이동에 대기가 있다', () => {
    const s = game(1); const a = put(s, 'bomber', 1, 0); a.cd = 1.5;
    expect(dispatch(s, { type: 'move', id: a.id, slot: 5 }).ok).toBe(true); expect(a.cd).toBe(1.5); expect(a.slot).toBe(5); expect(s.slots[0]).toBeNull(); expect(s.slots[5]).toBe(a.id);
    expect(dispatch(s, { type: 'move', id: a.id, slot: 6 }).ok).toBe(false);
    run(s, 1.1); expect(dispatch(s, { type: 'move', id: a.id, slot: 6 }).ok).toBe(true);
  });
  it('유닛이 있는 칸으로 이동하면 자리를 바꾼다', () => {
    const s = game(1); const a = put(s, 'bomber', 1, 0), b = put(s, 'frost', 1, 1);
    expect(dispatch(s, { type: 'move', id: a.id, slot: 1 }).ok).toBe(true); expect(a.slot).toBe(1); expect(b.slot).toBe(0);
  });
  it('2등급은 1등급 2기보다 슬롯당 가치가 높다', () => {
    for (const k of UNIT_KINDS) { if (k === 'engineer' || k === 'oil' || k === 'vortex') continue; const a = unitStats(k, 1), b = unitStats(k, 2), c = unitStats(k, 3); expect(b.dmg / b.cd).toBeGreaterThan(2 * a.dmg / a.cd); expect(c.dmg / c.cd).toBeGreaterThan(2 * b.dmg / b.cd); }
  });
});

describe('전투 기본', () => {
  it('적은 길을 따라 움직이고 기지에 닿으면 체력이 깎인다', () => {
    const s = game(1); forceWave(s); const g = pathGeo('A'); const e = spawnAt(s, 'sparkrat', g.len - 30);
    run(s, 1); expect(s.life).toBe(19); expect(s.enemies.length).toBe(0);
  });
  it('유닛이 적을 자동 공격해 죽이고 골드를 받는다', () => {
    const s = game(1); forceWave(s); put(s, 'laser', 2, 1); const g0 = s.gold; const e = spawnAt(s, 'gearbug', 20);
    run(s, 6); expect(e.alive).toBe(false); expect(s.gold).toBeGreaterThan(g0); expect(s.stats.kills).toBe(1);
  });
  it('죽은 적은 이후 공격 대상이 되지 않는다', () => {
    const s = game(1); forceWave(s); put(s, 'laser', 3, 1); spawnAt(s, 'gearbug', 20);
    run(s, 3); const hits = drain(s).filter(e => e.t === 'hit'); const alive = new Set(s.enemies.map(e => e.id));
    // 스텝 종료 시 죽은 적은 배열에서 제거되므로 이후 hit 이벤트의 대상은 존재하지 않아야 함
    expect(s.enemies.length).toBe(0); expect(hits.length).toBeGreaterThan(0);
    run(s, 2); expect(drain(s).filter(e => e.t === 'hit').length).toBe(0);
  });
  it('중장갑은 직격 피해를 줄이지만 지속 피해는 줄이지 않는다', () => {
    const s = game(1); forceWave(s); const e = spawnAt(s, 'scrapturtle', 100); const hp0 = e.hp;
    hitEnemy(s, e, 5, { unit: null, kind: 'laser', combo: false, dtype: 'direct' }); expect(hp0 - e.hp).toBe(3);
    const hp1 = e.hp; hitEnemy(s, e, 5, { unit: null, kind: 'flame', combo: false, dtype: 'dot' }); expect(hp1 - e.hp).toBe(5);
  });
  it('감속은 상한을 넘지 않고 빙결은 면역 시간 동안 반복되지 않는다', () => {
    const s = game(1); forceWave(s); const e = spawnAt(s, 'gearbug', 100);
    applyChill(s, e, 0.5, 3); applyChill(s, e, 0.5, 3); applyChill(s, e, 0.9, 3); expect(e.st.chillPct).toBeLessThanOrEqual(0.6);
    expect(applyFreeze(s, e, 0.6)).toBe(true); expect(applyFreeze(s, e, 0.6)).toBe(false); expect(enemySpeed(e)).toBe(0);
    run(s, 0.7); expect(e.st.frozen).toBe(0); expect(applyFreeze(s, e, 0.6)).toBe(false);
    run(s, 3.1); expect(applyFreeze(s, e, 0.6)).toBe(true);
  });
  it('지원형 드론이 주변 적에게 보호막을 준다', () => {
    const s = game(1); forceWave(s); spawnAt(s, 'repairdrone', 100); const a = spawnAt(s, 'gearbug', 90);
    run(s, 1.6); expect(a.st.shield).toBeGreaterThan(0);
  });
});

describe('웨이브·승패', () => {
  it('18웨이브 데이터, 9·18 보스', () => {
    expect(WAVES_NORMAL.length).toBe(18); expect(WAVES_NORMAL[8].boss).toBe('boss_golem'); expect(WAVES_NORMAL[17].boss).toBe('boss_core');
    expect(waveDef(5, 'hard').groups.length).toBeGreaterThan(waveDef(5, 'normal').groups.length); expect(Object.keys(HARD_EXTRA).length).toBeGreaterThan(5);
  });
  it('유닛 없이 두면 패배한다', () => {
    const s = game(1); run(s, 200); expect(s.phase).toBe('lost'); expect(s.life).toBe(0);
  });
  it('강한 유닛으로 18웨이브를 모두 이기면 승리한다', () => {
    const s = game(2); for (let i = 0; i < 12; i++) put(s, (['laser', 'tesla', 'bomber', 'flame'] as const)[i % 4], 3, i);
    for (let i = 0; i < 60 * 60 * 15 && s.phase !== 'won' && s.phase !== 'lost'; i++) { if (s.phase === 'prep') dispatch(s, { type: 'early' }); step(s); }
    expect(s.phase).toBe('won'); expect(s.stats.bossKills).toEqual(['boss_golem', 'boss_core']);
  });
  it('직렬화·복원 후 같은 입력이면 같은 결과', () => {
    const s = game(7); put(s, 'flame', 1, 1); put(s, 'oil', 1, 2); put(s, 'tesla', 1, 0);
    run(s, 12); const json = serialize(s); const t = deserialize(json);
    run(s, 20); run(t, 20); expect(stateHash(t)).toBe(stateHash(s));
  });
  it('손상된 저장 데이터는 예외를 던진다', () => {
    expect(() => deserialize('{"version":1}')).toThrow(); expect(() => deserialize('not json')).toThrow(); expect(() => deserialize('{"version":99,"units":[],"slots":[],"rng":{},"offer":[1,2,3],"wave":1,"mapId":"A","gold":1,"life":1}')).toThrow(/버전/);
  });
});
