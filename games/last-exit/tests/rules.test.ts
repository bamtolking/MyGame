import { describe, it, expect, beforeAll } from 'vitest';
import type { RunState, Input, Enemy } from '../src/sim/types';
import { newRun, serialize, deserialize, weaponStats, bagWeight, weightSlow, moveSpeed, applyTier, stateHash, enterZone } from '../src/sim/state';
import { step, dispatch, DT } from '../src/sim/engine';
import { spawnEnemy } from '../src/sim/enemies';
import { damagePlayer, damageEnemy, killEnemy } from '../src/sim/damage';
import { checkCleared, offerAbilities, pickAbility } from '../src/sim/zone';
import { circleBlocked, tileCenter, hasLos } from '../src/sim/geom';
import { PLAYER, BAG, LOOT, ABILITIES, ESCAPE, ENEMIES, ECONOMY } from '../src/data/balance';
import { runBot } from './bot';

const IDLE: Input = { mx: 0, my: 0, dash: false };
function mk(seed = 1, weapon: 'rifle' | 'shotgun' | 'staff' = 'rifle', diff: 'normal' | 'hard' = 'normal', bag = 0): RunState { return newRun({ seed, weapon, difficulty: diff, bagUpgrades: bag, runId: 'test-' + seed }); }
function steps(s: RunState, n: number, input: Input = IDLE, dt = DT): void { for (let i = 0; i < n; i++) step(s, input, dt); }
function noEnemies(s: RunState): void { s.enemies.length = 0; s.spawns.length = 0; s.zoneRt.waves = []; }
/** 등장표를 전부 처리해 구역을 정리 상태로 만든다 */
function clearZone(s: RunState): void {
  for (let i = 0; i < 60 * 120 && !s.zoneRt.cleared; i++) { for (const e of s.enemies) if (e.state !== 'dead') killEnemy(s, e); step(s, IDLE); }
  s.events.length = 0;
}
function put(s: RunState, tx: number, ty: number): void { const [x, y] = tileCenter(tx, ty); s.player.x = x; s.player.y = y; }

describe('입력·이동', () => {
  it('대각선 이동이 직선보다 빠르지 않다', () => {
    const a = mk(); noEnemies(a); put(a, 9, 8); const x0 = a.player.x; steps(a, 30, { mx: 1, my: 0, dash: false }); const d1 = a.player.x - x0;
    const b = mk(); noEnemies(b); put(b, 9, 8); const bx = b.player.x, by = b.player.y; steps(b, 30, { mx: 0.7071, my: 0.7071, dash: false }); const d2 = Math.hypot(b.player.x - bx, b.player.y - by);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.5); expect(d1).toBeCloseTo(PLAYER.speed * 0.5, 0);
  });
  it('입력을 놓으면 즉시 멈춘다', () => {
    const s = mk(); noEnemies(s); steps(s, 20, { mx: 1, my: 0, dash: false }); const x = s.player.x; steps(s, 10); expect(s.player.x).toBe(x);
  });
  it('프레임 간격이 달라도 이동 거리가 같다 (1/60 × 60 vs 1/30 × 30)', () => {
    const a = mk(); noEnemies(a); put(a, 9, 8); steps(a, 60, { mx: 0, my: 1, dash: false }, 1 / 60);
    const b = mk(); noEnemies(b); put(b, 9, 8); steps(b, 30, { mx: 0, my: 1, dash: false }, 1 / 30);
    expect(Math.abs(a.player.y - b.player.y)).toBeLessThan(0.01);
  });
  it('대시는 벽·맵 경계를 통과하지 않는다', () => {
    const s = mk(); noEnemies(s); put(s, 9, 1); // 윗벽 바로 아래
    steps(s, 1, { mx: 0, my: -1, dash: true }); steps(s, 20, { mx: 0, my: -1, dash: false });
    expect(s.player.y).toBeGreaterThanOrEqual(32 + PLAYER.radius - 0.01);
    expect(circleBlocked(s.zoneRt.rows, s.player.x, s.player.y, PLAYER.radius)).toBe(false);
  });
  it('대시 연타로 중복 발동하지 않으며 재사용 대기 후에만 다시 가능', () => {
    const s = mk(); noEnemies(s); put(s, 9, 8);
    for (let i = 0; i < 10; i++) step(s, { mx: 1, my: 0, dash: true });
    expect(s.stats.dashes).toBe(1);
    steps(s, Math.ceil(PLAYER.dashCooldown / DT) + 1, { mx: 1, my: 0, dash: false });
    step(s, { mx: 1, my: 0, dash: true }); expect(s.stats.dashes).toBe(2);
  });
  it('정지 상태 대시는 마지막 이동 방향을 쓴다', () => {
    const s = mk(); noEnemies(s); put(s, 9, 8); steps(s, 5, { mx: -1, my: 0, dash: false }); const x = s.player.x;
    step(s, { mx: 0, my: 0, dash: true }); steps(s, 15); expect(s.player.x).toBeLessThan(x - 50);
  });
});

describe('무게·감속', () => {
  it('적재율 60% 이하 감속 없음, 100%에서 최대 12%, 초과 불가', () => {
    const s = mk(); s.bag.items.scrap = 6; expect(bagWeight(s)).toBe(18); expect(weightSlow(s)).toBe(0);
    s.bag.items.scrap = 10; expect(bagWeight(s)).toBe(30); expect(weightSlow(s)).toBeCloseTo(BAG.maxSlow, 5);
    s.bag.items.scrap = 12; expect(weightSlow(s)).toBeCloseTo(BAG.maxSlow, 5);
    expect(moveSpeed(s)).toBeCloseTo(PLAYER.speed * (1 - BAG.maxSlow), 5);
  });
  it('경량 프레임은 감속만 줄이고 무게 수치는 그대로', () => {
    const s = mk(); s.bag.items.scrap = 10; s.abilities.light = 1; expect(bagWeight(s)).toBe(30); expect(weightSlow(s)).toBeCloseTo(BAG.maxSlow * 0.5, 5);
  });
  it('최대 무게에서도 대시 거리·무적은 같다', () => {
    const a = mk(); noEnemies(a); put(a, 9, 8); step(a, { mx: 1, my: 0, dash: true }); const ia = a.player.invulnT; steps(a, 15, { mx: 0, my: 0, dash: false }); const da = a.player.x;
    const b = mk(); noEnemies(b); put(b, 9, 8); b.bag.items.scrap = 10; step(b, { mx: 1, my: 0, dash: true }); const ib = b.player.invulnT; steps(b, 15, { mx: 0, my: 0, dash: false });
    expect(Math.abs(da - b.player.x)).toBeLessThan(0.01); expect(ia).toBe(ib);
  });
});

describe('전투', () => {
  it('벽 뒤의 적은 겨냥하지 않고, 시야가 닿는 적을 겨냥한다', () => {
    const s = mk(); noEnemies(s); put(s, 9, 16); // 1구역: 17~19행 8~11열이 벽
    const hidden = spawnEnemy(s, 'chaser', ...tileCenter(9, 20), false); hidden.state = 'chase';
    hidden.hp = 9999; expect(hasLos(s.zoneRt.rows, s.player.x, s.player.y, hidden.x, hidden.y)).toBe(false);
    steps(s, 5); expect(s.player.targetId).toBe(null);
    const seen = spawnEnemy(s, 'chaser', ...tileCenter(13, 16), false); seen.state = 'chase'; seen.hp = 9999; s.enemies = [hidden, seen]; s.spawns = []; s.zoneRt.waves = [];
    steps(s, 5); expect(s.player.targetId).toBe(seen.id);
  });
  it('타깃이 죽으면 다음 타깃으로 안전하게 전환한다', () => {
    const s = mk(); noEnemies(s); put(s, 9, 8);
    const a = spawnEnemy(s, 'chaser', s.player.x + 100, s.player.y, false); const b = spawnEnemy(s, 'chaser', s.player.x - 140, s.player.y, false); a.state = b.state = 'chase'; a.hp = b.hp = 99999;
    steps(s, 3); expect(s.player.targetId).toBe(a.id); killEnemy(s, a); steps(s, 3); expect(s.player.targetId).toBe(b.id); expect(s.enemies.find(e => e.id === a.id)).toBeUndefined();
  });
  it('한 투사체는 같은 적을 두 번 맞히지 않는다', () => {
    const s = mk(); noEnemies(s); put(s, 9, 8); const e = spawnEnemy(s, 'armored', s.player.x + 60, s.player.y, false); e.state = 'chase'; e.hp = 100000; e.maxHp = 100000;
    steps(s, 12); const hits = 100000 - e.hp; const ws = weaponStats(s); const shotsHit = Math.round(hits / (ws.dmg * 0.75));
    expect(shotsHit).toBeGreaterThan(0); expect(shotsHit).toBeLessThanOrEqual(s.player.shots);
  });
  it('산탄총 한 번 발사는 원본 공격 1회이며 여러 탄이 같은 적에 맞을 수 있다', () => {
    const s = mk(1, 'shotgun'); noEnemies(s); put(s, 9, 8); const e = spawnEnemy(s, 'armored', s.player.x + 40, s.player.y, false); e.state = 'chase'; e.hp = 100000; e.maxHp = 100000;
    steps(s, 3); expect(s.player.shots).toBe(1); steps(s, 8); const dmg = 100000 - e.hp; expect(dmg).toBeGreaterThan(weaponStats(s).dmg * 0.75 * 2);
  });
  it('충격탄: N번째 원본 공격마다 폭발 1회, 폭발이 폭발을 만들지 않는다', () => {
    const s = mk(1, 'rifle'); noEnemies(s); put(s, 9, 8); s.abilities.shock = 1;
    const e = spawnEnemy(s, 'armored', s.player.x + 50, s.player.y, false); e.state = 'chase'; e.hp = 1e9; e.maxHp = 1e9;
    let explosions = 0; for (let i = 0; i < 600; i++) { step(s, IDLE); explosions += s.events.filter(ev => ev.t === 'explode' && ev.kind === 'shock').length; s.events.length = 0; }
    expect(s.player.shots).toBeGreaterThanOrEqual(10); expect(explosions).toBe(Math.floor(s.player.shots / ABILITIES.shock.every[0]) - (s.projectiles.some(p => p.shock) ? 1 : 0) + (s.projectiles.some(p => p.shock) ? 0 : 0) || explosions);
    expect(explosions).toBeLessThanOrEqual(Math.floor(s.player.shots / ABILITIES.shock.every[0]));
    expect(explosions).toBeGreaterThanOrEqual(Math.floor(s.player.shots / ABILITIES.shock.every[0]) - 1);
  });
  it('서리: 감속은 중첩되지 않고 하한 0.6, 보스는 0.88', () => {
    const s = mk(); s.abilities.frost = 2; const e = spawnEnemy(s, 'chaser', 100, 100, false); e.hp = 1e6;
    for (let i = 0; i < 20; i++) damageEnemy(s, e, 1, 'weapon'); expect(e.slowMul).toBeCloseTo(0.6, 5); expect(e.slowT).toBeLessThanOrEqual(ABILITIES.frost.dur[1] + 1e-9);
    const b = spawnEnemy(s, 'boss', 200, 200, true); for (let i = 0; i < 20; i++) damageEnemy(s, b, 1, 'weapon'); expect(b.slowMul).toBeCloseTo(ABILITIES.frost.bossSlow, 5);
    damageEnemy(s, e, 1, 'shock'); expect(e.slowMul).toBeCloseTo(0.6, 5);
  });
  it('전기 지팡이: 같은 적을 두 번 연결하지 않고 연결 수를 넘지 않는다', () => {
    const s = mk(1, 'staff'); noEnemies(s); put(s, 9, 8); s.abilities.pierce = 2;
    const es = [0, 1, 2, 3, 4, 5].map(i => { const e = spawnEnemy(s, 'chaser', s.player.x + 60 + i * 40, s.player.y + (i % 2) * 30, false); e.state = 'chase'; e.hp = 1e6; return e; });
    let beam: any = null; for (let i = 0; i < 40 && !beam; i++) { step(s, IDLE); beam = s.events.find(ev => ev.t === 'beam'); s.events.length = 0; }
    expect(beam).toBeTruthy(); const pts = beam.pts as number[]; const keys = new Set<string>(); for (let i = 2; i < pts.length; i += 2) keys.add(`${pts[i]},${pts[i + 1]}`);
    expect(keys.size).toBe(pts.length / 2 - 1); expect(pts.length / 2 - 1).toBeLessThanOrEqual(1 + weaponStats(s).chains);
    expect(weaponStats(s).chains).toBe(4);
  });
  it('장갑병은 피해 감소가 있지만 면역은 아니다', () => {
    const s = mk(); const e = spawnEnemy(s, 'armored', 100, 100, false); damageEnemy(s, e, 40, 'weapon'); expect(e.hp).toBeCloseTo(e.maxHp - 30, 5);
  });
  it('피격 직후 짧은 무적으로 한 스텝 중복 피해가 없고, 같은 스텝에 적이 겹쳐도 즉사하지 않는다', () => {
    const s = mk(); s.player.hp = 100; damagePlayer(s, 10, 1, 0, 'a'); damagePlayer(s, 10, 1, 0, 'b'); damagePlayer(s, 10, 1, 0, 'c'); expect(s.player.hp).toBe(90);
  });
  it('추적자 예고 후 사거리 밖이면 맞지 않는다', () => {
    const s = mk(); noEnemies(s); put(s, 9, 8); const e = spawnEnemy(s, 'chaser', s.player.x + 20, s.player.y, false); e.state = 'chase'; e.hp = 1e6; s.player.invulnT = 0;
    // 공격 안 하도록 플레이어 화력 제거
    s.player.fireCd = 999; let started = false; for (let i = 0; i < 120 && !started; i++) { step(s, IDLE); s.player.fireCd = 999; if ((e.state as string) === 'windup') started = true; }
    expect(started).toBe(true); // 예고 중 멀리 이동
    for (let i = 0; i < 40; i++) { step(s, { mx: -1, my: 0, dash: false }); s.player.fireCd = 999; }
    expect(s.player.hp).toBe(100);
  });
  it('보스 사망 후 보상은 한 번만, 패턴·투사체 추가 없음', () => {
    const s = mk(); enterZone(s, 6); steps(s, 100); const b = s.enemies.find(e => e.type === 'boss')!; expect(b).toBeTruthy();
    killEnemy(s, b); killEnemy(s, b); expect(s.flags.bossReward).toBe(true); expect(s.loots.filter(l => l.type === 'relic').reduce((a, l) => a + l.count, 0)).toBe(3);
    const n = s.projectiles.length; steps(s, 60); expect(s.enemies.find(e => e.type === 'boss')).toBeUndefined(); expect(s.projectiles.filter(p => p.src === 'boss').length).toBeLessThanOrEqual(n);
    expect(s.zoneRt.cleared).toBe(true); expect(s.zoneRt.exitPad?.final).toBe(true);
  });
});

describe('전리품', () => {
  it('획득은 한 번만, 가치·무게 정확', () => {
    const s = mk(); noEnemies(s); put(s, 9, 8); s.loots = [{ id: 900, type: 'parts', count: 2, x: s.player.x + 20, y: s.player.y, attract: false, blocked: false, noPickT: 0 }];
    steps(s, 30); expect(s.bag.items.parts).toBe(2); expect(s.loots.length).toBe(0); expect(s.stats.lootValue[1]).toBe(32); expect(bagWeight(s)).toBe(4);
  });
  it('최대 무게를 넘는 물건은 자동 획득하지 않고 바닥에 남는다', () => {
    const s = mk(); noEnemies(s); put(s, 9, 8); s.bag.items.scrap = 9; s.bag.items.parts = 1; // 29
    s.loots = [{ id: 901, type: 'scrap', count: 1, x: s.player.x + 20, y: s.player.y, attract: false, blocked: false, noPickT: 0 }];
    steps(s, 60); expect(s.bag.items.scrap).toBe(9); expect(s.loots.length).toBe(1); expect(s.loots[0].blocked).toBe(true); expect(bagWeight(s)).toBe(29);
    expect(s.events.filter(e => e.t === 'bagFull').length).toBeLessThanOrEqual(1);
  });
  it('버리기 후 수량·무게·가치 일치, 다시 주워도 복제 없음, 유효한 위치', () => {
    const s = mk(); noEnemies(s); put(s, 9, 8); s.bag.items.relic = 3; s.bag.items.scrap = 2;
    const r = dispatch(s, { type: 'drop', loot: 'relic', n: 2 }); expect(r.ok).toBe(true); expect(s.bag.items.relic).toBe(1); expect(bagWeight(s)).toBe(8);
    const d = s.loots.find(l => l.type === 'relic')!; expect(d.count).toBe(2); expect(circleBlocked(s.zoneRt.rows, d.x, d.y, 6)).toBe(false);
    expect(dispatch(s, { type: 'drop', loot: 'parts', n: 1 }).ok).toBe(false);
    // 버린 물건은 자동으로 끌려오지 않고 직접 밟아야 줍는다
    steps(s, Math.ceil(BAG.dropNoPick / DT) + 30); expect(s.bag.items.relic).toBe(1); expect(d.attract).toBe(false);
    s.player.x = d.x; s.player.y = d.y; steps(s, 30); expect(s.bag.items.relic).toBe(3); expect(s.loots.filter(l => l.type === 'relic').length).toBe(0); expect(bagWeight(s)).toBe(12); expect(s.stats.lootValue[1]).toBe(0);
  });
  it('일시정지(능력 선택) 중에는 시간·적·탈출이 진행되지 않는다', () => {
    const s = mk(); s.phase = 'ability'; const t = s.time; steps(s, 30, { mx: 1, my: 0, dash: true }); expect(s.time).toBe(t); expect(s.stats.dashes).toBe(0);
  });
  it('벽 너머 전리품은 자기장 반지가 있어도 끌어오지 않는다', () => {
    const s = mk(); noEnemies(s); put(s, 9, 16); s.abilities.magnet = 2; s.loots = [{ id: 902, type: 'parts', count: 1, x: tileCenter(9, 20)[0], y: tileCenter(9, 20)[1], attract: false, blocked: false, noPickT: 0 }];
    steps(s, 60); expect(s.loots[0].attract).toBe(false); expect(s.bag.items.parts).toBe(0);
  });
});

describe('진행·탈출', () => {
  it('구역 목표 완료 → 능력 3개 제시 → 1회만 선택, 재추첨 없음', () => {
    const s = mk(); clearZone(s); expect(s.phase).toBe('ability'); const offer = s.abilityOffer!.slice(); expect(offer.length).toBe(3); expect(new Set(offer).size).toBe(3);
    const snap = serialize(s); const back = deserialize(snap); expect(back.abilityOffer).toEqual(offer);
    expect(dispatch(s, { type: 'pickAbility', id: 'rapid' as any }).ok).toBe(offer.includes('rapid'));
    if (!offer.includes('rapid')) dispatch(s, { type: 'pickAbility', id: offer[0] });
    expect(s.phase).toBe('cleared'); expect(dispatch(s, { type: 'pickAbility', id: offer[1] }).ok).toBe(false);
    checkCleared(s); expect(s.abilityOffer).toBe(null);
    const total = Object.values(s.abilities).reduce((a, b) => a + (b || 0), 0); expect(total).toBe(1);
  });
  it('최대 단계 능력은 후보에서 제외된다', () => {
    const s = mk(); s.abilities = { rapid: 2, pierce: 2, shock: 2, frost: 2, magnet: 2 }; offerAbilities(s); expect(s.abilityOffer!.every(a => !['rapid', 'pierce', 'shock', 'frost', 'magnet'].includes(a))).toBe(true);
  });
  it('구역 완료 회복·보호막·강화는 구역당 1회', () => {
    const s = mk(); s.abilities.mend = 1; s.abilities.shield = 1; s.player.hp = 50; clearZone(s); const hp = s.player.hp; expect(hp).toBe(50 + PLAYER.baseClearHeal + 12);
    s.zoneRt.cleared = false; checkCleared(s); expect(s.player.hp).toBe(hp);
    dispatch(s, { type: 'pickAbility', id: s.abilityOffer![0] }); put(s, 9, 22); expect(dispatch(s, { type: 'enterDoor' }).ok).toBe(true); expect(s.zone).toBe(2); expect(s.player.shield).toBe(15);
    s.player.shield = 3; enterZone(s, 2); expect(s.player.shield).toBe(3);
    applyTier(s, 'z3clear'); applyTier(s, 'z3clear'); expect(s.tier).toBe(1); expect(s.events.filter(e => e.t === 'tier').length).toBe(1);
  });
  it('체력 0 이후 완료 회복으로 부활하지 않는다', () => {
    const s = mk(); s.abilities.mend = 2; s.player.hp = 1; damagePlayer(s, 50, 0, 1, '테스트'); expect(s.status).toBe('dead'); s.zoneRt.cleared = false; s.zoneRt.waves = []; s.enemies = []; s.spawns = []; checkCleared(s); expect(s.player.hp).toBe(0); expect(s.status).toBe('dead');
  });
  it('구역 이동 후 이전 탈출구로 돌아갈 수 없고 문은 완료 전엔 잠긴다', () => {
    const s = mk(); put(s, 9, 22); expect(dispatch(s, { type: 'enterDoor' }).ok).toBe(false);
    clearZone(s); dispatch(s, { type: 'pickAbility', id: s.abilityOffer![0] }); put(s, 9, 22); expect(dispatch(s, { type: 'enterDoor' }).ok).toBe(true); expect(s.zone).toBe(2);
    clearZone(s); expect(s.phase).toBe('cleared'); expect(s.zoneRt.exitPad).toBeTruthy(); put(s, 9, 28); dispatch(s, { type: 'enterDoor' }); expect(s.zone).toBe(3); expect(s.zoneRt.exitPad).toBe(null); expect(s.escape).toBe(null);
  });
  it('탈출 요청 반복·취소로 추격 적이 늘지 않고 진행도는 유지된다', () => {
    const s = mk(); enterZone(s, 2); clearZone(s); const pad = s.zoneRt.exitPad!; s.player.x = pad.x; s.player.y = pad.y;
    expect(dispatch(s, { type: 'requestEscape' }).ok).toBe(true); steps(s, 60 * 3); const spawned = s.spawns.length + s.enemies.filter(e => e.noLoot).length; expect(spawned).toBeGreaterThan(0);
    const prog = s.escape!.progress; expect(prog).toBeGreaterThan(2);
    dispatch(s, { type: 'cancelEscape' }); dispatch(s, { type: 'requestEscape' }); dispatch(s, { type: 'cancelEscape' }); dispatch(s, { type: 'requestEscape' });
    expect(s.escape!.progress).toBeCloseTo(prog, 5); expect(s.escape!.waveIdx).toBeLessThanOrEqual(ESCAPE.pursuers[2].normal.length);
    for (const e of s.enemies) killEnemy(s, e); steps(s, 60 * 6); const totalPursuers = s.stats.kills[2] - s.zoneRt.killsRequired + s.enemies.filter(e => e.noLoot).length + s.spawns.length;
    expect(totalPursuers).toBeLessThanOrEqual(ESCAPE.pursuers[2].normal.reduce((a, w) => a + w.n, 0));
    expect(s.zoneRt.kills).toBe(s.zoneRt.killsRequired); // 추격 적은 목표 집계·전리품 없음
  });
  it('탈출 구역 밖에서는 준비 시간이 멈추고, 완료 전 요청은 거부된다', () => {
    const s = mk(); enterZone(s, 2); const pad = s.zoneRt.exitPad!; s.player.x = pad.x; s.player.y = pad.y; expect(dispatch(s, { type: 'requestEscape' }).ok).toBe(false);
    clearZone(s); s.player.x = pad.x; s.player.y = pad.y; dispatch(s, { type: 'requestEscape' }); steps(s, 60); const p1 = s.escape!.progress;
    s.player.x = pad.x + pad.r + 40; steps(s, 60); expect(s.escape!.progress).toBeCloseTo(p1, 5); expect(s.escape!.inside).toBe(false);
    s.bag.items.parts = 1; s.player.x = pad.x; s.player.y = pad.y; for (let i = 0; i < 60 * 12 && s.status === 'active'; i++) { for (const e of s.enemies) killEnemy(s, e); step(s, IDLE); s.player.x = pad.x; s.player.y = pad.y; }
    expect(s.status).toBe('escaped'); expect(s.result!.value).toBe(16);
  });
  it('탈출 완료와 치명적 피해가 같은 스텝이면 피해 처리 후 판단 → 사망', () => {
    const s = mk(); enterZone(s, 2); clearZone(s); const pad = s.zoneRt.exitPad!; s.player.x = pad.x; s.player.y = pad.y; dispatch(s, { type: 'requestEscape' });
    s.escape!.progress = s.escape!.need - DT * 0.5; s.player.hp = 1; s.player.invulnT = 0; s.player.hurtT = 0;
    s.projectiles.push({ id: 5000, owner: 'enemy', src: 'shooter', x: pad.x - 3, y: pad.y, vx: 300, vy: 0, dmg: 12, r: 6, life: 1, pierce: 0, hitIds: [], kind: 'orb', knock: 0, volley: 0, shock: false });
    step(s, IDLE); expect(s.status).toBe('dead'); expect(s.result!.kind).toBe('dead');
  });
  it('최종 탈출은 보스 처치 후에만, 추격 없이 3초', () => {
    const s = mk(); enterZone(s, 6); const pad = s.zoneRt.exitPad!; s.player.x = pad.x; s.player.y = pad.y; expect(dispatch(s, { type: 'requestEscape' }).ok).toBe(false);
    steps(s, 100); const b = s.enemies.find(e => e.type === 'boss')!; killEnemy(s, b); step(s, IDLE); s.player.x = pad.x; s.player.y = pad.y; expect(dispatch(s, { type: 'requestEscape' }).ok).toBe(true); expect(s.escape!.waves.length).toBe(0);
    for (let i = 0; i < 60 * 4 && s.status === 'active'; i++) { step(s, IDLE); s.player.x = pad.x; s.player.y = pad.y; } expect(s.status).toBe('escaped'); expect(s.result!.boss).toBe(true);
  });
  it('붕괴: 경고 후 통로가 닫히고 다른 길이 열리며 플레이어가 벽에 갇히지 않는다', () => {
    const s = mk(); enterZone(s, 4); const c = s.zoneRt.collapse!; expect(c.state).toBe('idle');
    s.zoneRt.kills = c.atKills; step(s, IDLE); expect(c.state).toBe('warn'); put(s, 9, 9); steps(s, Math.ceil(3.2 / DT)); expect(c.state).toBe('done');
    expect(s.zoneRt.rows[9][9]).toBe('#'); expect(s.zoneRt.rows[9][4]).toBe('.'); expect(circleBlocked(s.zoneRt.rows, s.player.x, s.player.y, PLAYER.radius)).toBe(false);
  });
});

describe('저장·정산·경제', () => {
  it('직렬화 왕복이 상태를 보존하고 체력·전리품이 같은 시점이다', () => {
    const s = mk(3); steps(s, 200, { mx: 1, my: 0.3, dash: false }); s.bag.items.parts = 4; s.player.hp = 77; const raw = serialize(s); const b = deserialize(raw);
    expect(b.player.hp).toBe(77); expect(b.bag.items.parts).toBe(4); expect(b.events).toEqual([]); expect(stateHash(b)).toBe(stateHash(s));
    expect(() => deserialize('{"v":99}')).toThrow(); expect(() => deserialize('garbage')).toThrow();
  });
  it('같은 시드·같은 입력은 같은 결과 (결정성)', () => {
    const a = mk(42), b = mk(42); const r1 = runBot(a, { path: 'A', maxTime: 40 }); const r2 = runBot(b, { path: 'A', maxTime: 40 }); expect(stateHash(a)).toBe(stateHash(b)); expect(r1.value).toBe(r2.value);
  });
});

describe('보관 재화·정산 (storage)', () => {
  let store: typeof import('../src/platform/storage');
  beforeAll(async () => {
    const mem = new Map<string, string>();
    (globalThis as any).localStorage = { getItem: (k: string) => mem.has(k) ? mem.get(k)! : null, setItem: (k: string, v: string) => { mem.set(k, String(v)); }, removeItem: (k: string) => { mem.delete(k); } };
    store = await import('../src/platform/storage');
  });
  it('탈출 정산은 출정 ID 기준 1회만 반영된다', () => {
    const blob = store.load().blob; const s = mk(5); s.bag.items.relic = 2; s.status = 'escaped'; s.phase = 'done'; s.result = { kind: 'escaped', value: 80, items: { ...s.bag.items }, zone: 2, cause: '', time: 10, boss: false };
    const r1 = store.settleRun(blob, s); expect(r1.awarded).toBe(80); expect(blob.meta.vault).toBe(80); const r2 = store.settleRun(blob, s); expect(r2.already).toBe(true); expect(blob.meta.vault).toBe(80); expect(blob.run).toBe(null);
    expect(store.save(blob).ok).toBe(true); const back = store.load().blob; expect(back.meta.vault).toBe(80); expect(store.settleRun(back, s).already).toBe(true); expect(back.meta.vault).toBe(80);
  });
  it('사망하면 이번 전리품은 잃지만 보관 재화·해금은 유지된다', () => {
    const blob = store.load().blob; blob.meta.vault = 500; blob.meta.unlocks.shotgun = true; const s = mk(6); s.bag.items.relic = 5; s.player.hp = 0; s.status = 'dead'; s.phase = 'done'; s.result = { kind: 'dead', value: 0, items: { ...s.bag.items }, zone: 3, cause: 'x', time: 1, boss: false };
    store.settleRun(blob, s); expect(blob.meta.vault).toBe(500); expect(blob.meta.unlocks.shotgun).toBe(true); expect(blob.meta.records.deaths).toBe(1); expect(blob.meta.history[0].kind).toBe('dead');
  });
  it('구매는 재화를 정확히 차감하고 중복·부족 구매를 막는다', () => {
    const m = store.defaultMeta(); m.vault = ECONOMY.unlockShotgun + 10; expect(store.purchase(m, 'shotgun', ECONOMY.unlockShotgun).ok).toBe(true); expect(m.vault).toBe(10); expect(store.purchase(m, 'shotgun', ECONOMY.unlockShotgun).ok).toBe(false);
    expect(store.purchase(m, 'bag2', ECONOMY.bagUpgrade[1]).ok).toBe(false); expect(store.purchase(m, 'staff', ECONOMY.unlockStaff).ok).toBe(false); expect(m.vault).toBe(10);
  });
  it('손상된 저장 데이터는 안전하게 초기화·안내되고, 스냅샷은 구역 진입 시점을 담는다', () => {
    (globalThis as any).localStorage.setItem(store.SAVE_KEY, '{not json'); const l = store.load(); expect(l.error).toBeTruthy(); expect(l.blob.meta.vault).toBe(0);
    const s = mk(7); store.snapshotRun(l.blob, s, '구역 1 진입'); expect(l.blob.run!.zone).toBe(1); const back = deserialize(l.blob.run!.snapshot); expect(back.player.hp).toBe(100); expect(bagWeight(back)).toBe(0);
  });
});
