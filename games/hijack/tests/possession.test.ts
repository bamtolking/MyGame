import { describe, expect, it } from 'vitest';
import { BODIES } from '../src/data/bodies';
import { RULES } from '../src/data/rules';
import { EMPTY_INPUT, step } from '../src/sim/engine';
import { findPossessTarget, isPossessable, possess } from '../src/sim/possession';
import { createWorld, makeEntity } from '../src/sim/world';
import { Bot } from './bot';

function sandbox() {
  // 1구역 맵을 쓰되 적을 모두 제거하고 필요한 개체만 배치
  const w = createWorld(0, null, 7);
  w.entities = w.entities.filter((e) => e.controlled);
  const p = w.player; p.x = 8 * 32 + 16; p.y = 30 * 32 + 16;
  return { w, p };
}

describe('빙의 조건', () => {
  it('체력 35% 이하일 때만 빙의 가능 상태가 된다', () => {
    const { w, p } = sandbox();
    const s = makeEntity(w, 'scout', 'enemy', p.x + 40, p.y);
    expect(isPossessable(w, s)).toBe(false);
    s.hp = s.hpMax * 0.36; expect(isPossessable(w, s)).toBe(false);
    s.hp = s.hpMax * 0.35; expect(isPossessable(w, s)).toBe(true);
    s.hp = 1; expect(isPossessable(w, s)).toBe(true);
  });
  it('기절 상태면 체력과 무관하게 빙의 가능', () => {
    const { w, p } = sandbox();
    const s = makeEntity(w, 'shield', 'enemy', p.x + 40, p.y);
    expect(isPossessable(w, s)).toBe(false);
    s.stunUntil = w.time + 1; expect(isPossessable(w, s)).toBe(true);
  });
  it('보스·포탑·노드는 체력이 낮아도 빙의 불가', () => {
    const { w, p } = sandbox();
    for (const b of ['boss', 'turret', 'node'] as const) { const e = makeEntity(w, b, 'enemy', p.x + 40, p.y); e.hp = 1; expect(isPossessable(w, e)).toBe(false); }
  });
  it('빙의 불가 적에게 버튼을 눌러도 아무 일도 없고 이유가 안내된다', () => {
    const { w, p } = sandbox();
    const s = makeEntity(w, 'scout', 'enemy', p.x + 40, p.y);
    const id = p.id;
    step(w, { ...EMPTY_INPUT, possess: true }); step(w, EMPTY_INPUT);
    expect(w.player.id).toBe(id); expect(w.player.body).toBe('intruder'); expect(s.controlled).toBe(false);
    expect(w.events.some((e) => e.type === 'possessFail' && /약하지 않다/.test(e.text ?? ''))).toBe(true);
    const b = makeEntity(w, 'boss', 'enemy', p.x - 60, p.y); b.hp = 1; w.entities = w.entities.filter((e) => e !== s);
    step(w, EMPTY_INPUT); step(w, { ...EMPTY_INPUT, possess: true });
    expect(w.events.some((e) => e.type === 'possessFail' && /코어 잠금/.test(e.text ?? ''))).toBe(true);
    expect(w.player.body).toBe('intruder');
  });
  it('가까운 여러 후보 중 가장 가까운 대상을 일관되게 고른다', () => {
    const { w, p } = sandbox();
    const far = makeEntity(w, 'scout', 'enemy', p.x + 60, p.y); far.hp = 1;
    const near = makeEntity(w, 'bomber', 'enemy', p.x - 45, p.y); near.hp = 1;
    const tooFar = makeEntity(w, 'sniper', 'enemy', p.x, p.y - 200); tooFar.hp = 1;
    expect(findPossessTarget(w, p, RULES.possessRange)?.id).toBe(near.id);
    near.x = p.x - 61; // 이제 far와 반지름 기준 비슷 → 반지름 뺀 거리 비교
    const t = findPossessTarget(w, p, RULES.possessRange);
    expect([near.id, far.id]).toContain(t?.id);
    for (let i = 0; i < 5; i++) expect(findPossessTarget(w, p, RULES.possessRange)?.id).toBe(t?.id);
  });
});

describe('빙의 실행', () => {
  it('몸이 교체되고 체력은 남은 값(최소 45%로 이식 회복), 안정도는 새 몸 최대치, 무기와 스킬이 바뀐다', () => {
    const { w, p } = sandbox();
    const s = makeEntity(w, 'shield', 'enemy', p.x + 40, p.y); s.hp = 30;
    const oldId = p.id;
    step(w, { ...EMPTY_INPUT, possess: true });
    const np = w.player;
    expect(np.id).toBe(s.id); expect(np.id).not.toBe(oldId);
    expect(np.body).toBe('shield'); expect(np.team).toBe('player'); expect(np.controlled).toBe(true);
    expect(np.hp).toBe(Math.round(120 * RULES.possessMinHpRatio)); expect(np.stability).toBeCloseTo(BODIES.shield.stability!, 0);
    expect(w.entities.find((e) => e.id === oldId)).toBeUndefined(); // 이전 몸 붕괴
    expect(w.events.some((e) => e.type === 'possess')).toBe(true);
    // 무기: 산탄 6발
    step(w, EMPTY_INPUT); w.player.attackCd = 0; w.player.invulnUntil = 0;
    const before = w.projectiles.length;
    step(w, { ...EMPTY_INPUT, attack: true });
    expect(w.projectiles.length - before).toBe(BODIES.shield.weapon.pellets);
    expect(w.projectiles.every((pr) => pr.team === 'player' && pr.kind === 'pellet')).toBe(true);
    // 스킬: 방어 자세
    w.player.skillCd = 0;
    step(w, { ...EMPTY_INPUT, skill: true });
    expect(w.player.skillUntil).toBeGreaterThan(w.time);
    expect(w.events.some((e) => e.type === 'skill' && e.text === 'guard')).toBe(true);
  });
  it('남은 체력이 45%보다 높으면(기절 빙의 등) 그 체력을 그대로 이어받는다', () => {
    const { w, p } = sandbox();
    const s = makeEntity(w, 'shield', 'enemy', p.x + 40, p.y); s.hp = 100; s.stunUntil = w.time + 2;
    step(w, { ...EMPTY_INPUT, possess: true });
    expect(w.player.id).toBe(s.id); expect(w.player.hp).toBe(100);
  });
  it('빙의 직후 쿨다운 동안 다시 빙의할 수 없고, 지나면 가능하다', () => {
    const { w, p } = sandbox();
    const a = makeEntity(w, 'scout', 'enemy', p.x + 40, p.y); a.hp = 1;
    const b = makeEntity(w, 'bomber', 'enemy', p.x + 80, p.y); b.hp = 1;
    step(w, { ...EMPTY_INPUT, possess: true });
    expect(w.player.id).toBe(a.id);
    expect(w.possessCd).toBeCloseTo(RULES.possessCooldown, 2);
    b.x = w.player.x + 30;
    step(w, EMPTY_INPUT); step(w, { ...EMPTY_INPUT, possess: true });
    expect(w.player.id).toBe(a.id);
    for (let i = 0; i < Math.ceil(RULES.possessCooldown / RULES.fixedDt) + 2; i++) { b.x = w.player.x + 30; b.y = w.player.y; step(w, EMPTY_INPUT); }
    b.hp = 1; b.x = w.player.x + 30; b.y = w.player.y;
    step(w, EMPTY_INPUT); step(w, { ...EMPTY_INPUT, possess: true });
    expect(w.player.id).toBe(b.id);
  });
  it('안정도는 시간에 따라 감소하고 피해로 더 크게 줄며, 0이면 붕괴가 시작되고 붕괴 중에도 빙의로 살아난다', () => {
    const { w, p } = sandbox();
    const s = makeEntity(w, 'scout', 'enemy', p.x + 40, p.y); s.hp = 20;
    possess(w, p, s); const np = w.player;
    const s0 = np.stability!;
    for (let i = 0; i < 60; i++) step(w, EMPTY_INPUT);
    expect(np.stability!).toBeLessThan(s0);
    expect(s0 - np.stability!).toBeCloseTo(BODIES.scout.stabilityDecay, 0);
    // 피해 → 안정도 추가 감소
    const before = np.stability!; np.invulnUntil = 0;
    const enemy = makeEntity(w, 'scout', 'enemy', np.x + 300, np.y);
    w.projectiles.push({ id: 999, kind: 'bullet', team: 'enemy', ownerId: enemy.id, ownerBody: 'scout', x: np.x + 8, y: np.y, vx: -100, vy: 0, damage: 10, ttl: 1, radius: 4, pierce: false, hitIds: [], splash: 0, overWalls: false, knockback: 0, shock: 0, volley: 77, sx: 0, sy: 0, tx: 0, ty: 0, flight: 0, t: 0, fuse: 0, selfDamage: false, breaksWalls: false, color: '#fff' });
    step(w, EMPTY_INPUT);
    expect(np.hp).toBe(10);
    expect(before - np.stability!).toBeGreaterThan(10 * BODIES.scout.stabilityDamageFactor - 0.1);
    // 안정도 0 → 붕괴 → 체력 감소
    np.stability = 0.01; step(w, EMPTY_INPUT); step(w, EMPTY_INPUT);
    expect(np.collapsing).toBe(true);
    expect(w.events.some((e) => e.type === 'collapseStart')).toBe(true);
    const hpBefore = np.hp; for (let i = 0; i < 60; i++) step(w, EMPTY_INPUT);
    expect(np.hp).toBeLessThan(hpBefore);
    // 붕괴 직전 빙의 가능
    const rescue = makeEntity(w, 'mechanic', 'enemy', np.x + 30, np.y); rescue.hp = 5;
    w.possessCd = 0; step(w, EMPTY_INPUT); step(w, { ...EMPTY_INPUT, possess: true });
    expect(w.player.id).toBe(rescue.id); expect(w.player.collapsing).toBe(false); expect(w.player.stability).toBeCloseTo(BODIES.mechanic.stability!, 0);
  });
  it('체력 0이 되어도 근처에 후보가 있으면 마지막 기회 동안 빙의로 생존, 없으면 패배', () => {
    const { w, p } = sandbox();
    const s = makeEntity(w, 'scout', 'enemy', p.x + 50, p.y); s.hp = 1; s.ai.state = 'idle';
    p.hp = 1; p.invulnUntil = 0;
    const enemy = makeEntity(w, 'sniper', 'enemy', p.x + 400, p.y); enemy.ai.state = 'idle';
    w.projectiles.push({ id: 998, kind: 'bullet', team: 'enemy', ownerId: enemy.id, ownerBody: 'sniper', x: p.x + 8, y: p.y, vx: -100, vy: 0, damage: 10, ttl: 1, radius: 4, pierce: false, hitIds: [], splash: 0, overWalls: false, knockback: 0, shock: 0, volley: 78, sx: 0, sy: 0, tx: 0, ty: 0, flight: 0, t: 0, fuse: 0, selfDamage: false, breaksWalls: false, color: '#fff' });
    step(w, EMPTY_INPUT);
    expect(w.player.hp).toBe(0); expect(w.lastChance).not.toBeNull(); expect(w.phase).toBe('playing');
    step(w, EMPTY_INPUT);
    // 시간이 느려짐
    expect(w.timeScale).toBeLessThan(1);
    step(w, { ...EMPTY_INPUT, possess: true });
    expect(w.player.id).toBe(s.id); expect(w.phase).toBe('playing'); expect(w.stats.lastChanceSaves).toBe(1);
    // 후보 없이 죽으면 패배
    const w2 = sandbox(); const p2 = w2.p; p2.hp = 0;
    step(w2.w, EMPTY_INPUT);
    expect(w2.w.phase).toBe('defeat');
    // 마지막 기회를 놓치면 패배
    const w3 = sandbox(); const c3 = makeEntity(w3.w, 'scout', 'enemy', w3.p.x + 50, w3.p.y); c3.hp = 1; c3.ai.state = 'idle'; w3.p.hp = 0;
    for (let i = 0; i < 80; i++) step(w3.w, EMPTY_INPUT);
    expect(w3.w.phase).toBe('defeat');
  });
  it('빙의한 몸이 날린 투사체는 플레이어 편이 되고, 적 AI는 새 몸을 표적으로 삼는다', () => {
    const { w, p } = sandbox();
    const b = makeEntity(w, 'bomber', 'enemy', p.x + 40, p.y); b.hp = 1;
    w.projectiles.push({ id: 997, kind: 'bomb', team: 'enemy', ownerId: b.id, ownerBody: 'bomber', x: b.x, y: b.y, vx: 0, vy: 0, damage: 30, ttl: 99, radius: 7, pierce: false, hitIds: [], splash: 60, overWalls: true, knockback: 0, shock: 0, volley: 5, sx: b.x, sy: b.y, tx: b.x + 200, ty: b.y, flight: 0.75, t: 0, fuse: 0, selfDamage: false, breaksWalls: true, color: '#fff' });
    const other = makeEntity(w, 'scout', 'enemy', p.x + 150, p.y); other.ai.state = 'alert';
    step(w, { ...EMPTY_INPUT, possess: true });
    expect(w.projectiles[0].team).toBe('player');
    // 정찰병은 새 몸(폭탄병)을 향해 사격한다
    const bot = new Bot(w); bot.wait(3);
    const enemyShots = w.events.filter((e) => e.type === 'shot' && e.body === 'scout');
    expect(enemyShots.length).toBeGreaterThan(0);
    expect(w.player.body).toBe('bomber');
  });
});
