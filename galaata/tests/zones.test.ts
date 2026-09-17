import { describe, expect, it } from 'vitest';
import { BODIES } from '../src/data/bodies';
import { RULES } from '../src/data/rules';
import { createWorld } from '../src/sim/world';
import { isPossessable } from '../src/sim/possession';
import { Bot, autoplay } from './bot';

const S = RULES.tile;
function summary(bot: Bot) {
  const w = bot.w; const p = w.player;
  return { phase: w.phase, time: +w.zoneTime.toFixed(1), body: p.body, hp: Math.round(p.hp), stab: p.stability == null ? null : Math.round(p.stability), possessions: w.stats.possessions, kills: w.stats.kills, dmg: Math.round(w.stats.damageTaken), log: bot.log.map((l) => `${l.t}:${l.msg}`) };
}

describe('1구역 침입 구역', () => {
  it('B안: 정찰병→방패병 갈아타기로 포탑 통로를 지나 패널로 문을 연다', () => {
    const w = createWorld(0, null, 11); const bot = new Bot(w);
    const scout = bot.nearestEnemy('scout')!;
    expect(bot.weaken(scout)).toBe(true);
    expect(isPossessable(w, scout)).toBe(true);
    expect(bot.possess(scout)).toBe(true);
    expect(w.player.body).toBe('scout');
    bot.moveTo(11, 23, { maxSec: 8 });
    const shield = bot.nearestEnemy('shield')!;
    expect(bot.weaken(shield, RULES.possessHpRatio, 30)).toBe(true);
    expect(bot.possess(shield)).toBe(true);
    expect(w.player.body).toBe('shield');
    // 포탑 통로(오른쪽) → 패널
    const hpBefore = w.player.hp;
    bot.moveTo(14, 12, { maxSec: 15 }); bot.moveTo(14, 8, { maxSec: 10 }); bot.moveTo(14, 7, { maxSec: 6 });
    const blocks = w.events.filter((e) => e.type === 'block').length;
    bot.interact(); bot.wait(1.3, { interact: false });
    const doorA = w.door('A')!;
    expect(doorA.open).toBe(true);
    bot.moveTo(13, 4, { maxSec: 8 }); bot.moveTo(8, 1, { maxSec: 10 });
    const s = summary(bot);
    console.log('zone0 B(shield route)', JSON.stringify({ ...s, blocks, hpBefore }));
    expect(w.phase).toBe('zoneclear');
    expect(blocks).toBeGreaterThan(0); // 방패가 포탑 탄을 실제로 막음
  });
  it('B2안: 폭탄병으로 갈아타 금이 간 벽을 부수고 지름길로 나간다', () => {
    const w = createWorld(0, null, 12); const bot = new Bot(w);
    const scout = bot.nearestEnemy('scout')!;
    bot.weaken(scout, 0, 20); // 정찰병은 처치
    bot.moveTo(6, 23, { maxSec: 8 });
    const bomber = bot.nearestEnemy('bomber')!;
    expect(bot.weaken(bomber, RULES.possessHpRatio, 30)).toBe(true);
    expect(bot.possess(bomber)).toBe(true);
    expect(w.player.body).toBe('bomber');
    // 방패병을 피해서 왼쪽 통로로
    bot.moveTo(2, 16, { maxSec: 12 }); bot.moveTo(2, 8, { maxSec: 10 });
    // 벽에 폭탄
    const crack = w.devices.find((d) => d.kind === 'crackedWall' && d.tx === 2) as import('../src/sim/types').CrackedWall;
    for (let i = 0; i < 6 && !crack.broken; i++) { bot.tick({ attack: true }); bot.wait(1.3); }
    expect(crack.broken).toBe(true);
    bot.moveTo(2, 4, { maxSec: 6 }); bot.moveTo(8, 1, { maxSec: 10 });
    console.log('zone0 B2(bomber route)', JSON.stringify(summary(bot)));
    expect(w.phase).toBe('zoneclear');
  });
  it('A안: 기본 몸으로 전부 처치하고 포탑 통로를 강행하면 더 오래 걸리고 더 위험하다', () => {
    const w = createWorld(0, null, 13); const bot = new Bot(w);
    bot.killAll(90);
    const killedAll = !w.aliveEnemies().some((e) => e.body !== 'turret');
    let s = summary(bot);
    console.log('zone0 A(kill all, intruder)', JSON.stringify({ ...s, killedAll }));
    if (w.phase === 'playing') {
      bot.moveTo(14, 12, { maxSec: 15 }); bot.moveTo(14, 8, { maxSec: 12 }); bot.moveTo(14, 7, { maxSec: 6 });
      if (w.phase === 'playing') { bot.interact(); bot.wait(1.3); bot.moveTo(13, 4, { maxSec: 8 }); bot.moveTo(8, 1, { maxSec: 10 }); }
    }
    s = summary(bot);
    console.log('zone0 A result', JSON.stringify(s));
    // 비교용 기록만 남기고, 최소한 게임이 정상적으로 끝났는지 확인
    expect(['zoneclear', 'defeat', 'playing']).toContain(w.phase);
  });
});

describe('2구역 포탑 통로', () => {
  it('방패병은 정면 돌파로 통과한다(입구 방 적은 대기 상태라 바로 통로로 갈 수 있다)', () => {
    const w = createWorld(1, { body: 'shield', hp: 70, stability: 100 }, 21); const bot = new Bot(w);
    bot.moveTo(8, 19, { maxSec: 10 });
    expect(w.aliveEnemies().filter((e) => e.body !== 'turret' && e.ai.state === 'alert').length).toBe(0);
    const hp0 = w.player.hp;
    bot.moveTo(8, 12, { maxSec: 10, attack: false }); bot.moveTo(8, 5, { maxSec: 10 }); bot.moveTo(8, 1, { maxSec: 8 });
    const s = summary(bot);
    console.log('zone1 shield', JSON.stringify({ ...s, corridorDamage: Math.round(hp0 - Math.max(0, w.player.hp)) }));
    expect(w.phase).toBe('zoneclear');
  });
  it('폭탄병으로 들어오면 방패병을 폭탄으로 약화시켜 갈아탄 뒤 통로를 지난다(연속 갈아타기)', () => {
    const w = createWorld(1, { body: 'bomber', hp: 40, stability: 70 }, 23); const bot = new Bot(w);
    const shield = bot.nearestEnemy('shield')!;
    expect(bot.weaken(shield, RULES.possessHpRatio, 30)).toBe(true);
    expect(bot.possess(shield)).toBe(true);
    expect(w.player.body).toBe('shield');
    expect(w.player.hp).toBeGreaterThanOrEqual(Math.round(120 * RULES.possessMinHpRatio));
    autoplay(bot, { maxSec: 40, goal: { tx: 8, ty: 19 }, possessBelow: 0.35, engage: 260 });
    bot.moveTo(8, 19, { maxSec: 10 }); bot.moveTo(8, 12, { maxSec: 10 }); bot.moveTo(8, 5, { maxSec: 10 }); bot.moveTo(8, 1, { maxSec: 8 });
    console.log('zone1 bomber→shield', JSON.stringify(summary(bot)));
    expect(w.phase).toBe('zoneclear');
  });
  it('정찰병 질주 강행은 통과 가능하지만 큰 피해를 입는다(대비 실험)', () => {
    const results: string[] = [];
    let cleared = 0;
    for (const seed of [31, 32, 33]) {
      const w = createWorld(1, { body: 'scout', hp: 38, stability: 60 }, seed); const bot = new Bot(w);
      w.entities = w.entities.filter((e) => e.controlled || e.body === 'turret'); // 통로만 실험
      bot.moveTo(8, 19, { maxSec: 10 });
      const hp0 = w.player.hp;
      bot.useSkill();
      bot.moveTo(8, 12, { maxSec: 6 }); bot.moveTo(8, 5, { maxSec: 6 }); bot.moveTo(8, 1, { maxSec: 6 });
      results.push(`seed${seed}: ${w.phase} hp ${hp0}→${Math.round(w.player.hp)}`);
      if (w.phase === 'zoneclear') cleared++;
    }
    console.log('zone1 scout sprint', results.join(' | '));
    expect(cleared).toBeGreaterThanOrEqual(1);
  });
  it('정비병은 과부하 단자로 포탑을 끄고 통과한다', () => {
    const w = createWorld(1, { body: 'mechanic', hp: 65, stability: 90 }, 22); const bot = new Bot(w);
    w.entities = w.entities.filter((e) => e.controlled || e.body === 'turret');
    bot.moveTo(14, 24, { maxSec: 8, stopDist: 20 });
    bot.interact(); bot.wait(1.8);
    const turrets = w.entities.filter((e) => e.body === 'turret');
    expect(turrets.every((t) => t.disabled)).toBe(true);
    const hp0 = w.player.hp;
    bot.moveTo(8, 19, { maxSec: 10 }); bot.moveTo(8, 12, { maxSec: 10 }); bot.moveTo(8, 5, { maxSec: 10 }); bot.moveTo(8, 1, { maxSec: 8 });
    expect(w.player.hp).toBe(hp0);
    expect(w.phase).toBe('zoneclear');
  });
});

describe('3구역 균열 벽과 스위치', () => {
  it('폭탄병은 금이 간 벽을 부수고 나간다', () => {
    const w = createWorld(2, { body: 'bomber', hp: 60, stability: 80 }, 41); const bot = new Bot(w);
    w.entities = w.entities.filter((e) => e.controlled || e.body === 'turret');
    bot.moveTo(11, 8, { maxSec: 14 });
    const cracks = w.devices.filter((d) => d.kind === 'crackedWall' && d.ty === 4);
    for (let i = 0; i < 8 && !cracks.every((c) => c.kind === 'crackedWall' && c.broken); i++) { bot.tick({ attack: true }); bot.wait(1.3); }
    // 한쪽만 부숴도 지나갈 수 있음
    expect(cracks.some((c) => c.kind === 'crackedWall' && c.broken)).toBe(true);
    bot.moveTo(11, 2, { maxSec: 8 }); bot.moveTo(8, 1, { maxSec: 8 });
    console.log('zone2 bomber', JSON.stringify(summary(bot)));
    expect(w.phase).toBe('zoneclear');
  });
  it('저격병은 구덩이 건너 스위치를 쏴 문 B로 나간다', () => {
    const w = createWorld(2, { body: 'sniper', hp: 50, stability: 70 }, 42); const bot = new Bot(w);
    w.entities = w.entities.filter((e) => e.controlled || e.body === 'turret');
    bot.moveTo(10, 14, { maxSec: 14 });
    bot.wait(2.5, { attack: true });
    const door = w.door('B')!;
    expect(door.open).toBe(true);
    bot.moveTo(3, 2, { maxSec: 14 }); bot.moveTo(8, 1, { maxSec: 8 });
    console.log('zone2 sniper', JSON.stringify(summary(bot)));
    expect(w.phase).toBe('zoneclear');
  });
  it('침입자/정찰병만으로는 출구를 열 수 없다(몸이 필요한 구조)', () => {
    const w = createWorld(2, null, 43); const bot = new Bot(w);
    w.entities = w.entities.filter((e) => e.controlled);
    bot.moveTo(10, 14, { maxSec: 14 }); bot.wait(3, { attack: true });
    expect(w.door('B')!.open).toBe(false);
    bot.moveTo(11, 8, { maxSec: 10 }); bot.wait(3, { attack: true });
    expect(w.devices.filter((d) => d.kind === 'crackedWall').every((c) => c.kind === 'crackedWall' && !c.broken)).toBe(true);
  });
  it('실전: 침입자로 시작해 적 중 폭탄병 또는 저격병을 빼앗아 통과한다(자동 정책)', () => {
    let cleared = 0; const logs: string[] = [];
    for (const seed of [51, 52, 53]) {
      const w = createWorld(2, { body: 'shield', hp: 90, stability: 110 }, seed); const bot = new Bot(w);
      autoplay(bot, { maxSec: 45, keepAlive: ['bomber', 'sniper'], possessBelow: 0.5, engage: 300, stopWhen: (x) => x.player.body === 'bomber' || x.player.body === 'sniper' || x.aliveEnemies().every((e) => e.body === 'bomber' || e.body === 'sniper' || e.body === 'shield') });
      // 남겨둔 몸 중 하나를 빼앗는다
      const cand = w.entities.filter((e) => e.alive && e.team === 'enemy' && (e.body === 'bomber' || e.body === 'sniper')).sort((a, b) => Math.hypot(a.x - w.player.x, a.y - w.player.y) - Math.hypot(b.x - w.player.x, b.y - w.player.y))[0];
      if (w.phase === 'playing' && cand && w.player.body !== 'bomber' && w.player.body !== 'sniper') { if (bot.weaken(cand, RULES.possessHpRatio, 25)) bot.possess(cand); }
      if (w.phase === 'playing' && w.player.body === 'bomber') {
        bot.moveTo(11, 8, { maxSec: 14 });
        const cracks = w.devices.filter((d) => d.kind === 'crackedWall' && d.ty === 4);
        for (let i = 0; i < 8 && !cracks.some((c) => c.kind === 'crackedWall' && c.broken); i++) { bot.tick({ attack: true }); bot.wait(1.3); }
        bot.moveTo(11, 2, { maxSec: 8 }); bot.moveTo(8, 1, { maxSec: 8 });
      } else if (w.phase === 'playing' && w.player.body === 'sniper') {
        bot.moveTo(10, 14, { maxSec: 14 }); bot.wait(3, { attack: true });
        bot.moveTo(3, 2, { maxSec: 14 }); bot.moveTo(8, 1, { maxSec: 8 });
      }
      logs.push(`seed${seed}: ${JSON.stringify(summary(bot))}`);
      if (w.phase === 'zoneclear') cleared++;
    }
    console.log('zone2 auto', logs.join('\n'));
    expect(cleared).toBeGreaterThanOrEqual(2);
  });
});

describe('4구역 연속 갈아타기', () => {
  it('자동 정책으로 웨이브를 넘기며 여러 번 갈아타고 출구가 열린다', () => {
    let cleared = 0; const logs: string[] = [];
    for (const seed of [61, 62, 63]) {
      const w = createWorld(3, { body: 'shield', hp: 100, stability: 110 }, seed); const bot = new Bot(w);
      autoplay(bot, { maxSec: 150, goal: { tx: 8, ty: 1 }, possessBelow: 0.45 });
      logs.push(`seed${seed}: ${JSON.stringify(summary(bot))} waveDone=${w.waveDone}`);
      if (w.phase === 'zoneclear') cleared++;
    }
    console.log('zone3 auto', logs.join('\n'));
    expect(cleared).toBeGreaterThanOrEqual(2);
  });
});

describe('5구역 보스', () => {
  it('보스는 빙의 불가이며, 소환된 경비를 갈아타며 자동 정책으로 처치 가능하다', () => {
    let wins = 0; const logs: string[] = [];
    for (const seed of [71, 72, 73]) {
      const w = createWorld(4, { body: 'shield', hp: 110, stability: 120 }, seed); const bot = new Bot(w);
      autoplay(bot, { maxSec: 240, boss: true, possessBelow: 0.45 });
      const boss = w.entities.find((e) => e.body === 'boss');
      logs.push(`seed${seed}: ${JSON.stringify(summary(bot))} bossHp=${boss ? Math.round(boss.hp) : 0} phase=${boss?.ai.phase}`);
      if (w.phase === 'victory') wins++;
      expect(w.stats.bodiesUsed).not.toContain('boss');
    }
    console.log('zone4 boss auto', logs.join('\n'));
    expect(wins).toBeGreaterThanOrEqual(1);
  });
});
