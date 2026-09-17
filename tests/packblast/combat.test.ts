import { describe, it, expect } from 'vitest';
import { BattleSim, runBattle } from '../../src/packblast/combat/sim';
import { computeLoadout } from '../../src/packblast/core/loadout';
import type { Item } from '../../src/packblast/core/bag';
import type { Rot } from '../../src/packblast/core/shapes';
import { ENEMIES } from '../../src/packblast/data/enemies';

const mk = (uid: string, id: Item['id'], x: number, y: number, rot: Rot = 0, grade: Item['grade'] = 1): Item => ({ uid, id, grade, rot, x, y, loc: 'bag' });
const L = (...items: Item[]) => computeLoadout(items);

/** 고정된 표적 환경: 적 등장 대신 지정한 적을 수동으로 배치하고 N초 동안 돌린다. */
function arena(items: Item[], seconds: number, place: (sim: BattleSim) => void, opts: Partial<{ stage: number; seed: number }> = {}) {
  const sim = new BattleSim({ loadout: L(...items), stage: opts.stage ?? 1, difficulty: 'normal', seed: opts.seed ?? 1, hp: 100 });
  // 예정된 등장을 비우고 직접 배치 (내부 큐 접근)
  (sim as unknown as { queue: unknown[] }).queue = [];
  place(sim);
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps && !sim.over; i++) { sim.step(); sim.drainEvents(); }
  return sim;
}
const tank = (sim: BattleSim, x: number, y: number, hp = 1e9) => { const e = sim.spawnEnemy('armored', x, y); e.hp = hp; e.maxHp = hp; e.armor = 0; e.speed = 0; e.damage = 0; e.attackInterval = 1e9; e.attackTimer = 1e9; e.kbResist = 1; return e; };

describe('전투: 지원 효과가 실제 전투를 바꾼다', () => {
  it('배터리가 실제 공격 간격을 줄이고, 그만큼 과열도 빨라진다 (기관총)', () => {
    // 과열 전 3초 동안의 발사 수 비교
    const a = arena([mk('mg', 'mg', 1, 0)], 3, s => tank(s, 180, 120));
    const b = arena([mk('mg', 'mg', 1, 0), mk('b', 'battery', 2, 0)], 3, s => tank(s, 180, 120));
    expect(b.stats.weapons.mg.shots).toBeGreaterThan(a.stats.weapons.mg.shots);
    expect(b.stats.weapons.mg.shots / a.stats.weapons.mg.shots).toBeGreaterThan(1.12);
    // 10초 연속 사격: 배터리는 과열 시간을 늘린다 (냉각까지 고려하게 만드는 선택)
    const a10 = arena([mk('mg', 'mg', 1, 0)], 10, s => tank(s, 180, 120));
    const b10 = arena([mk('mg', 'mg', 1, 0), mk('b', 'battery', 2, 0)], 10, s => tank(s, 180, 120));
    expect(b10.stats.weapons.mg.overheatTime).toBeGreaterThan(a10.stats.weapons.mg.overheatTime);
    // 배터리 + 냉각기: 발사 수와 피해 모두 기본보다 높다
    const c10 = arena([mk('mg', 'mg', 1, 0), mk('b', 'battery', 2, 0), mk('c', 'cooler', 2, 1)], 10, s => tank(s, 180, 120));
    expect(c10.stats.weapons.mg.shots).toBeGreaterThan(a10.stats.weapons.mg.shots);
    expect(c10.stats.weapons.mg.damage).toBeGreaterThan(b10.stats.weapons.mg.damage);
  });
  it('냉각기가 실제 과열 시간을 줄인다', () => {
    const a = arena([mk('mg', 'mg', 1, 0)], 12, s => tank(s, 180, 120));
    const c = arena([mk('mg', 'mg', 1, 0), mk('c', 'cooler', 2, 1)], 12, s => tank(s, 180, 120));
    expect(a.stats.weapons.mg.overheatTime).toBeGreaterThan(1);
    expect(c.stats.weapons.mg.overheatTime).toBeLessThan(a.stats.weapons.mg.overheatTime);
    expect(c.stats.weapons.mg.damage).toBeGreaterThan(a.stats.weapons.mg.damage);
  });
  it('탄약상자가 실제 추가 공격을 만들고, 추가 탄은 다시 추가 탄을 만들지 않는다', () => {
    const s = arena([mk('sg', 'shotgun', 1, 1), mk('a', 'ammo', 1, 2)], 12, sim => tank(sim, 180, 150));
    const st = s.stats.weapons.sg;
    expect(st.extraShots).toBeGreaterThan(0);
    expect(st.extraShots).toBe(Math.floor(st.shots / 4)); // 4발마다 1회 (추가 탄 자체는 카운트에 포함되지 않음)
    const n = arena([mk('sg', 'shotgun', 1, 1)], 12, sim => tank(sim, 180, 150));
    expect(n.stats.weapons.sg.extraShots).toBe(0);
    expect(st.damage).toBeGreaterThan(n.stats.weapons.sg.damage);
  });
  it('공명 렌즈가 실제로 다른 적을 공격하고 연쇄는 원본 공격당 최대 1회', () => {
    const s = arena([mk('laser', 'laser', 1, 0), mk('lens', 'lens', 2, 0)], 8, sim => { tank(sim, 180, 120); tank(sim, 240, 120); tank(sim, 120, 130); });
    const st = s.stats.weapons.laser;
    expect(st.chains).toBeGreaterThan(0);
    expect(st.chains).toBeLessThanOrEqual(st.shots);
    // 드론 + 렌즈: 이동하는 연쇄
    const d = arena([mk('dr', 'drone', 1, 0), mk('lens', 'lens', 2, 2)], 8, sim => { tank(sim, 180, 150); tank(sim, 230, 160); });
    expect(d.stats.weapons.dr.chains).toBeGreaterThan(0);
    expect(d.stats.weapons.dr.chains).toBeLessThanOrEqual(d.stats.weapons.dr.shots);
    // 렌즈 없으면 연쇄 없음
    const n = arena([mk('laser', 'laser', 1, 0)], 8, sim => { tank(sim, 180, 120); tank(sim, 240, 120); });
    expect(n.stats.weapons.laser.chains).toBe(0);
  });
  it('연쇄는 원래 적을 다시 때리지 않고 대상이 하나뿐이면 발생하지 않는다', () => {
    const s = arena([mk('laser', 'laser', 1, 0), mk('lens', 'lens', 2, 0)], 6, sim => tank(sim, 180, 120));
    expect(s.stats.weapons.laser.chains).toBe(0);
  });
  it('작업대 장비는 전투 효과를 주지 않는다', () => {
    const items = [mk('mg', 'mg', 1, 0), { ...mk('b', 'battery', 2, 0), loc: 'bench' as const }];
    const lo = L(...items);
    expect(lo.weapons[0].links.length).toBe(0);
    const s = arena(items, 6, sim => tank(sim, 180, 120));
    const n = arena([mk('mg', 'mg', 1, 0)], 6, sim => tank(sim, 180, 120));
    expect(s.stats.weapons.mg.shots).toBe(n.stats.weapons.mg.shots);
  });
});

describe('전투: 판정과 안전장치', () => {
  it('죽은 적에게 피해를 기록하지 않는다', () => {
    const s = arena([mk('mg', 'mg', 1, 0)], 6, sim => { const e = sim.spawnEnemy('basic', 180, 140); e.speed = 0; e.hp = 6; e.maxHp = 6; });
    // 적 하나(체력 6, 방어 0)를 죽이면 기록된 피해는 6 이하 (초과 피해는 실제 적중 1회로 제한)
    expect(s.stats.weapons.mg.damage).toBeLessThanOrEqual(6.01);
    expect(s.stats.weapons.mg.kills).toBe(1);
  });
  it('근접 공격은 실제로 가까운 적만 맞힌다', () => {
    const s = arena([mk('d', 'dagger', 1, 0)], 3, sim => { tank(sim, 180, 240 + 50); tank(sim, 180, 240 - 150); });
    const hits = s.enemies.filter(e => e.hp < 1e9);
    expect(hits.length).toBe(1);
  });
  it('장갑형은 피해를 줄이지만 완전 면역이 아니다', () => {
    const s = arena([mk('mg', 'mg', 1, 0)], 4, sim => { const e = sim.spawnEnemy('armored', 180, 140); e.speed = 0; e.hp = 1e6; e.maxHp = 1e6; });
    const st = s.stats.weapons.mg;
    expect(st.damage).toBeGreaterThan(0);
    expect(st.damage / st.shots).toBeLessThan(6); // 피격당 6 미만
  });
  it('긴급 충격파는 한 전투에 한 번만, 적을 밀어내고 보호를 준다', () => {
    const sim = new BattleSim({ loadout: L(mk('d', 'dagger', 1, 0)), stage: 1, difficulty: 'normal', seed: 3, hp: 100 });
    (sim as unknown as { queue: unknown[] }).queue = [];
    const e = sim.spawnEnemy('basic', 180, 200); const before = Math.hypot(e.x - sim.player.x, e.y - sim.player.y);
    expect(sim.useShockwave()).toBe(true);
    expect(sim.useShockwave()).toBe(false);
    for (let i = 0; i < 30; i++) sim.step();
    const after = Math.hypot(e.x - sim.player.x, e.y - sim.player.y);
    expect(after).toBeGreaterThan(before + 40);
    expect(sim.protectTimer).toBeGreaterThan(0);
    sim.damagePlayer(50);
    expect(sim.hp).toBe(100); expect(sim.stats.protectedDamage).toBe(50);
  });
  it('보스는 충격파에 밀리지 않지만 보호는 적용된다', () => {
    const sim = new BattleSim({ loadout: L(mk('d', 'dagger', 1, 0)), stage: 12, difficulty: 'normal', seed: 3, hp: 100 });
    (sim as unknown as { queue: unknown[] }).queue = [];
    const b = sim.spawnEnemy('boss', 180, 200); const bx = b.x, by = b.y;
    sim.useShockwave();
    for (let i = 0; i < 10; i++) sim.step();
    expect(Math.hypot(b.x - bx, b.y - by)).toBeLessThan(15);
    expect(sim.protectTimer).toBeGreaterThan(0);
  });
  it('같은 시드·같은 구성은 같은 결과 (결정성) 이고 2배속은 스텝 수만 다르다', () => {
    const lo = L(mk('mg', 'mg', 1, 0), mk('b', 'battery', 2, 0), mk('d', 'dagger', 3, 0));
    const a = runBattle({ loadout: lo, stage: 2, difficulty: 'normal', seed: 77, hp: 100 });
    const b = runBattle({ loadout: lo, stage: 2, difficulty: 'normal', seed: 77, hp: 100 });
    expect(JSON.stringify(a.result)).toBe(JSON.stringify(b.result));
    // 2배속: 프레임당 2스텝 → 같은 스텝 수면 같은 결과
    const s1 = new BattleSim({ loadout: lo, stage: 2, difficulty: 'normal', seed: 77, hp: 100 });
    const s2 = new BattleSim({ loadout: lo, stage: 2, difficulty: 'normal', seed: 77, hp: 100 });
    for (let f = 0; f < 600; f++) { s1.step(); s1.drainEvents(); }
    for (let f = 0; f < 300; f++) { s2.step(); s2.step(); s2.drainEvents(); }
    expect(s1.time).toBeCloseTo(s2.time, 9); expect(JSON.stringify(s1.stats)).toBe(JSON.stringify(s2.stats));
  });
  it('교착 상태에서는 경고 후 적이 강화되어 무한히 이어지지 않는다', () => {
    const sim = new BattleSim({ loadout: L(mk('d', 'dagger', 1, 0)), stage: 1, difficulty: 'normal', seed: 5, hp: 100 });
    (sim as unknown as { queue: unknown[] }).queue = [];
    const e = sim.spawnEnemy('basic', 180, -100); e.hp = 1e9; e.maxHp = 1e9; e.speed = 0; // 사거리 밖에 영원히 머무는 적
    const seen = new Set<string>();
    for (let i = 0; i < 60 * 200 && !sim.over; i++) { sim.step(); for (const ev of sim.drainEvents()) seen.add(ev.type); }
    expect(seen.has('stall_warn')).toBe(true);
    expect(seen.has('enrage')).toBe(true);
    expect(sim.enraged).toBe(true);
    expect(e.speed).toBe(0); // 속도 0 배율은 0이지만 피해는 증가
    expect(e.damage).toBeGreaterThan(ENEMIES.basic.damage);
  });
  it('보스전: 체력 구간 변화·소환·압축 공격이 발생하고 전투가 끝난다', () => {
    const lo = L(mk('mg', 'mg', 1, 0, 0, 2), mk('b', 'battery', 2, 0, 0, 1), mk('c', 'cooler', 2, 1, 0, 1), mk('l', 'laser', 3, 0, 0, 2), mk('sh', 'shield', 1, 3, 0, 2), mk('d', 'dagger', 0, 1, 0, 2));
    const sim = new BattleSim({ loadout: lo, stage: 12, difficulty: 'normal', seed: 11, hp: 100 });
    const seen = new Set<string>(); let phase = 0;
    for (let i = 0; i < 60 * 240 && !sim.over; i++) { sim.step(); for (const ev of sim.drainEvents()) { seen.add(ev.type); if (ev.type === 'boss_phase') phase = Math.max(phase, ev.phase); } }
    expect(sim.over).toBe(true); expect(sim.won).toBe(true);
    expect(seen.has('summon')).toBe(true); expect(seen.has('crush_warn')).toBe(true);
    expect(phase).toBe(2);
    expect(sim.stats.duration).toBeLessThan(120);
  });
  it('일반 전투는 예정된 적을 모두 처치하면 끝난다', () => {
    const lo = L(mk('mg', 'mg', 1, 0, 0, 2), mk('b', 'battery', 2, 0), mk('d', 'dagger', 3, 0), mk('c', 'cooler', 2, 1));
    const r = runBattle({ loadout: lo, stage: 1, difficulty: 'normal', seed: 1, hp: 100 });
    expect(r.result.won).toBe(true); expect(r.sim.enemies.length).toBe(0); expect(r.result.stats.kills).toBe(r.result.stats.spawned);
  });
});
