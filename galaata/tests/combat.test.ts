import { describe, expect, it } from 'vitest';
import { BODIES } from '../src/data/bodies';
import { RULES } from '../src/data/rules';
import { applyDamage, explode, fireWeapon } from '../src/sim/combat';
import { EMPTY_INPUT, step } from '../src/sim/engine';
import { possess } from '../src/sim/possession';
import { T } from '../src/sim/tilemap';
import type { Projectile } from '../src/sim/types';
import { createWorld, makeEntity } from '../src/sim/world';
import { Bot } from './bot';

const S = RULES.tile;
function sandbox(zone = 0) {
  const w = createWorld(zone, null, 3);
  w.entities = w.entities.filter((e) => e.controlled);
  const p = w.player; if (zone === 0) { p.x = 8 * S + 16; p.y = 29 * S + 16; }
  return { w, p };
}
function bullet(w: ReturnType<typeof sandbox>['w'], team: 'player' | 'enemy', x: number, y: number, vx: number, vy: number, dmg: number, extra: Partial<Projectile> = {}): Projectile {
  const p: Projectile = { id: w.nextId++, kind: 'bullet', team, ownerId: 0, ownerBody: 'scout', x, y, vx, vy, damage: dmg, ttl: 2, radius: 4, pierce: false, hitIds: [], splash: 0, overWalls: false, knockback: 0, shock: 0, volley: w.volleyCounter++, sx: 0, sy: 0, tx: 0, ty: 0, flight: 0, t: 0, fuse: 0, selfDamage: false, breaksWalls: false, color: '#fff', ...extra };
  w.projectiles.push(p); return p;
}

describe('피해 규칙', () => {
  it('죽은 적에게는 추가 피해가 들어가지 않는다', () => {
    const { w, p } = sandbox();
    const s = makeEntity(w, 'scout', 'enemy', p.x + 50, p.y);
    applyDamage(w, s, 1000, { x: p.x, y: p.y, ownerId: p.id, volley: 1 });
    expect(s.alive).toBe(false); expect(w.stats.kills).toBe(1);
    const ok = applyDamage(w, s, 10, { x: p.x, y: p.y, ownerId: p.id, volley: 2 });
    expect(ok).toBe(false); expect(w.stats.kills).toBe(1);
    expect(w.events.filter((e) => e.type === 'die').length).toBe(1);
  });
  it('플레이어는 피격 무적 동안 다른 사격을 맞지 않지만 같은 볼리(산탄)는 전부 맞고, 한 스텝 피해는 최대체력 40%로 제한된다', () => {
    const { w, p } = sandbox();
    p.invulnUntil = 0;
    const v = 50;
    for (let i = 0; i < 6; i++) bullet(w, 'enemy', p.x + 6, p.y, -50, 0, 5, { volley: v });
    step(w, EMPTY_INPUT);
    // 6발×5=30 이지만 같은 볼리 상한 25% (12.5) 적용
    expect(p.hp).toBeCloseTo(p.hpMax - p.hpMax * RULES.volleyCapRatio, 5);
    const hp = p.hp;
    bullet(w, 'enemy', p.x + 6, p.y, -50, 0, 5); step(w, EMPTY_INPUT);
    expect(p.hp).toBe(hp); // 무적
    for (let i = 0; i < 25; i++) step(w, EMPTY_INPUT);
    bullet(w, 'enemy', p.x + 6, p.y, -50, 0, 5); step(w, EMPTY_INPUT);
    expect(p.hp).toBe(hp - 5);
  });
});

describe('투사체와 벽', () => {
  it('직선 탄은 벽에 막히고, 폭탄은 벽을 넘어가 금이 간 벽을 부순다', () => {
    const { w, p } = sandbox();
    // 1구역 금 간 벽: (2,5),(3,5). 벽 아래 통로 (2,7)에서 위로 쏨
    p.x = 2 * S + 16; p.y = 8 * S + 16;
    const b = bullet(w, 'player', p.x, p.y - 20, 0, -400, 10);
    for (let i = 0; i < 30; i++) step(w, EMPTY_INPUT);
    expect(w.projectiles.includes(b)).toBe(false);
    expect(w.map.get(2, 5)).toBe(T.CRACK); // 총알로는 안 깨짐
    // 폭탄병으로 갈아타 폭탄을 벽에 던짐
    const bm = makeEntity(w, 'bomber', 'enemy', p.x + 20, p.y); bm.hp = 1; possess(w, p, bm);
    const pl = w.player; pl.attackCd = 0;
    const crack = w.devices.find((d) => d.kind === 'crackedWall' && d.tx === 2 && d.ty === 5) as import('../src/sim/types').CrackedWall;
    fireWeapon(w, pl, { x: 2 * S + 16, y: 5 * S + 16 });
    expect(w.projectiles.some((pr) => pr.kind === 'bomb' && pr.overWalls)).toBe(true);
    for (let i = 0; i < 60; i++) step(w, EMPTY_INPUT);
    expect(crack.hp).toBeLessThan(crack.hpMax);
    pl.attackCd = 0; fireWeapon(w, pl, { x: 2 * S + 16, y: 5 * S + 16 });
    for (let i = 0; i < 60; i++) step(w, EMPTY_INPUT);
    expect(crack.broken).toBe(true); expect(w.map.get(2, 5)).toBe(T.FLOOR);
    expect(w.events.some((e) => e.type === 'wallBreak')).toBe(true);
  });
  it('과부하 폭탄은 금이 간 벽을 한 번에 부수고 범위 안의 자신에게도 피해를 준다', () => {
    const { w, p } = sandbox();
    p.x = 2 * S + 16; p.y = 6 * S + 16;
    const bm = makeEntity(w, 'bomber', 'enemy', p.x + 20, p.y); bm.hp = 60; possess(w, p, bm);
    const pl = w.player; pl.skillCd = 0;
    step(w, { ...EMPTY_INPUT, skill: true });
    expect(w.projectiles.some((pr) => pr.fuse > 0)).toBe(true);
    for (let i = 0; i < 120; i++) step(w, EMPTY_INPUT);
    expect(w.map.get(2, 5)).toBe(T.FLOOR);
    expect(pl.hp).toBeLessThan(60);
    expect(pl.hp).toBeGreaterThan(0);
  });
  it('저격병 관통탄은 여러 적을 관통하고 원거리 스위치를 작동시켜 문을 연다', () => {
    const { w, p } = sandbox(2);
    // 3구역 스위치 2 at (1,14). 구덩이 건너편 (11,14)에서 사격
    p.x = 11 * S + 16; p.y = 14 * S + 16;
    const sn = makeEntity(w, 'sniper', 'enemy', p.x + 20, p.y); sn.hp = 1; possess(w, p, sn);
    const pl = w.player;
    const a = makeEntity(w, 'scout', 'enemy', p.x - 80, p.y); const b = makeEntity(w, 'scout', 'enemy', p.x - 160, p.y); a.ai.state = 'idle'; b.ai.state = 'idle';
    a.stunUntil = 1e9; b.stunUntil = 1e9; // 움직이지 않게
    const sw = w.devices.find((d) => d.kind === 'switch')!; const door = w.door('B')!;
    expect(door.open).toBe(false);
    pl.attackCd = 0; fireWeapon(w, pl, { x: sw.x, y: sw.y });
    for (let i = 0; i < 90; i++) step(w, EMPTY_INPUT);
    expect(a.hp).toBeLessThan(a.hpMax); expect(b.hp).toBeLessThan(b.hpMax);
    expect(sw.kind === 'switch' && sw.on).toBe(true); expect(door.open).toBe(true);
    expect(w.map.get(door.tiles[0].tx, door.tiles[0].ty)).toBe(T.FLOOR);
  });
  it('침입자 사거리로는 스위치에 닿지 않는다(몸 차이)', () => {
    const { w, p } = sandbox(2);
    p.x = 11 * S + 16; p.y = 14 * S + 16;
    const sw = w.devices.find((d) => d.kind === 'switch')!;
    p.attackCd = 0; fireWeapon(w, p, { x: sw.x, y: sw.y });
    for (let i = 0; i < 120; i++) step(w, EMPTY_INPUT);
    expect(sw.kind === 'switch' && sw.on).toBe(false);
  });
});

describe('방패병 전방 방어', () => {
  it('정면에서 오는 포탑 탄은 막고, 뒤에서 오는 탄은 맞는다. 방어 자세는 옆까지 막는다', () => {
    const { w, p } = sandbox();
    const sh = makeEntity(w, 'shield', 'enemy', p.x + 20, p.y); sh.hp = 100; possess(w, p, sh);
    const pl = w.player; pl.facing = -Math.PI / 2; pl.invulnUntil = 0;
    const hp0 = pl.hp;
    bullet(w, 'enemy', pl.x, pl.y - 40, 0, 300, 10, { kind: 'turret' });
    for (let i = 0; i < 20; i++) step(w, EMPTY_INPUT);
    expect(pl.hp).toBe(hp0); expect(w.events.some((e) => e.type === 'block')).toBe(true);
    // 옆(왼쪽)에서: 기본 반각 0.9rad(51°) 밖 → 맞음
    pl.invulnUntil = 0;
    bullet(w, 'enemy', pl.x - 40, pl.y, 300, 0, 10);
    for (let i = 0; i < 20; i++) step(w, EMPTY_INPUT);
    expect(pl.hp).toBeLessThan(hp0);
    // 방어 자세 → 옆도 막음
    const hp1 = pl.hp; pl.skillCd = 0; pl.invulnUntil = 0; step(w, { ...EMPTY_INPUT, skill: true });
    pl.facing = -Math.PI / 2;
    bullet(w, 'enemy', pl.x - 40, pl.y, 300, 0, 10);
    for (let i = 0; i < 20; i++) step(w, EMPTY_INPUT);
    expect(pl.hp).toBe(hp1);
    // 뒤에서 → 맞음
    pl.invulnUntil = 0; pl.facing = -Math.PI / 2;
    bullet(w, 'enemy', pl.x, pl.y + 40, 0, -300, 10);
    for (let i = 0; i < 20; i++) step(w, EMPTY_INPUT);
    expect(pl.hp).toBeLessThan(hp1);
  });
  it('적 방패병은 정면 사격을 막으므로 뒤에서 쏴야 약화된다', () => {
    const { w, p } = sandbox();
    const sh = makeEntity(w, 'shield', 'enemy', p.x, p.y - 80); sh.facing = Math.PI / 2; sh.stunUntil = 0;
    // 정면(아래)에서 10발
    for (let i = 0; i < 10; i++) { p.attackCd = 0; fireWeapon(w, p, { x: sh.x, y: sh.y }); for (let k = 0; k < 8; k++) { sh.facing = Math.PI / 2; sh.ai.state = 'idle'; step(w, EMPTY_INPUT); } }
    expect(sh.hp).toBe(sh.hpMax);
    // 뒤(위)에서
    p.x = sh.x; p.y = sh.y - 80;
    for (let i = 0; i < 10; i++) { p.attackCd = 0; fireWeapon(w, p, { x: sh.x, y: sh.y }); for (let k = 0; k < 8; k++) { sh.facing = Math.PI / 2; sh.ai.state = 'idle'; step(w, EMPTY_INPUT); } }
    expect(sh.hp).toBeLessThan(sh.hpMax);
  });
  it('폭탄 폭발은 방패로 막히지 않는다', () => {
    const { w, p } = sandbox();
    const sh = makeEntity(w, 'shield', 'enemy', p.x, p.y - 60); sh.facing = Math.PI / 2;
    explode(w, sh.x, sh.y + 10, 60, 30, 'player', p.id, false, false, 1);
    expect(sh.hp).toBeLessThan(sh.hpMax);
  });
});

describe('정비병', () => {
  it('전기 아크는 감전을 누적시켜 기절시키고, 수복 펄스는 체력과 안정도를 회복한다', () => {
    const { w, p } = sandbox();
    const m = makeEntity(w, 'mechanic', 'enemy', p.x + 20, p.y); m.hp = 60; possess(w, p, m);
    const pl = w.player;
    const t = makeEntity(w, 'shield', 'enemy', pl.x + 80, pl.y); t.disabled = true; t.facing = -Math.PI / 2; // 반격·이동 없이 서 있는 표적(옆을 보고 있어 차단 없음)
    let stunned = false;
    for (let i = 0; i < 240 && !stunned; i++) { step(w, { ...EMPTY_INPUT, attack: true }); stunned = t.stunUntil > w.time; }
    expect(stunned).toBe(true);
    expect(t.hp / t.hpMax).toBeGreaterThan(RULES.possessHpRatio); // 체력은 아직 높지만
    step(w, EMPTY_INPUT);
    expect(w.candidates.map((c) => c.id)).toContain(t.id); // 기절 → 체력과 무관하게 후보
    expect(w.possessTarget?.id).toBe(t.id);
    // 수복 펄스
    pl.hp = 10; pl.stability = 20; pl.skillCd = 0;
    step(w, { ...EMPTY_INPUT, skill: true });
    expect(pl.hp).toBe(32); expect(pl.stability).toBeCloseTo(32, 0);
  });
});

describe('몸별 무기 차이', () => {
  it('여섯 몸의 무기는 종류·투사체 수·사거리·속도가 실제로 다르다', () => {
    const kinds = new Set(Object.values(BODIES).filter((b) => b.possessable || b.id === 'intruder').map((b) => b.weapon.kind));
    expect(kinds.size).toBe(6);
    const speeds = new Set(Object.values(BODIES).filter((b) => b.possessable || b.id === 'intruder').map((b) => b.speed));
    expect(speeds.size).toBe(6);
    const skills = new Set(Object.values(BODIES).filter((b) => b.skill).map((b) => b.skill!.id));
    expect(skills.size).toBe(6);
  });
  it('봇이 각 몸으로 공격하면 서로 다른 종류의 투사체/이벤트가 발생한다', () => {
    const seen: Record<string, string> = {};
    for (const body of ['intruder', 'scout', 'shield', 'bomber', 'sniper', 'mechanic'] as const) {
      const { w, p } = sandbox();
      if (body !== 'intruder') { const e = makeEntity(w, body, 'enemy', p.x + 20, p.y); e.hp = 1; possess(w, p, e); }
      const pl = w.player; const dummy = makeEntity(w, 'scout', 'enemy', pl.x + 90, pl.y); dummy.stunUntil = 1e9; dummy.hp = 1000; dummy.hpMax = 1000;
      const bot = new Bot(w); bot.wait(1.5, { attack: true });
      const kinds = [...new Set(w.projectiles.concat().map((pr) => pr.kind))].join(',');
      const shots = w.events.filter((e) => e.type === 'shot' && e.body === body).length;
      seen[body] = `${BODIES[body].weapon.kind}:${kinds}:${shots}`;
      expect(shots).toBeGreaterThan(0);
      expect(dummy.hp).toBeLessThan(1000);
    }
    expect(new Set(Object.values(seen)).size).toBe(6);
  });
});
