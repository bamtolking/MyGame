import { describe, expect, it } from 'vitest';
import { BODIES } from '../src/data/bodies';
import { RULES } from '../src/data/rules';
import { ZONES } from '../src/data/zones';
import { applyDamage, killEntity } from '../src/sim/combat';
import { EMPTY_INPUT, step } from '../src/sim/engine';
import { isPossessable } from '../src/sim/possession';
import type { CrackedWall } from '../src/sim/types';
import { createWorld } from '../src/sim/world';
import { Bot, autoplay } from './bot';

const S = RULES.tile;
function summary(bot: Bot) {
  const w = bot.w; const p = w.player;
  return { phase: w.phase, time: +w.zoneTime.toFixed(1), body: p.body, hp: Math.round(p.hp), stab: p.stability == null ? null : Math.round(p.stability), possessions: w.stats.possessions, kills: w.stats.kills, dmg: Math.round(w.stats.damageTaken), chain: w.stats.bodiesUsed.join('>'), log: bot.log.map((l) => `${l.t}:${l.msg}`) };
}
/** 통로 안 방패병을 방으로 끌어낸다(정면 돌파가 안 되는 좁은 통로 대신 넓은 곳에서 측면 공격) */
function lureShield(bot: Bot) {
  const w = bot.w; const shield = bot.nearestEnemy('shield')!;
  bot.moveTo(14, 17, { maxSec: 10, stopDist: 20 });
  bot.wait(0.3);
  bot.moveTo(10, 21, { maxSec: 8 });
  for (let i = 0; i < 600 && shield.alive && shield.y < 18 * S; i++) { const dx = shield.x - bot.p.x, dy = shield.y - bot.p.y; const l = Math.hypot(dx, dy); bot.tick(l < 170 ? { mx: -dx / l, my: -dy / l } : {}); }
  return shield;
}

describe('1구역 침입 구역 (핵심 장면)', () => {
  it('B안: 정찰병→방패병 갈아타기로 포탑 통로를 지나 패널로 문을 연다', () => {
    const w = createWorld(0, null, 11); const bot = new Bot(w);
    const scout = bot.nearestEnemy('scout')!;
    expect(bot.weaken(scout)).toBe(true);
    expect(isPossessable(w, scout)).toBe(true);
    expect(bot.possess(scout)).toBe(true);
    expect(w.player.body).toBe('scout');
    const shield = lureShield(bot);
    expect(bot.weaken(shield, RULES.possessHpRatio, 30)).toBe(true);
    expect(bot.possess(shield)).toBe(true);
    expect(w.player.body).toBe('shield');
    bot.moveTo(14, 12, { maxSec: 15 }); bot.moveTo(14, 8, { maxSec: 10 }); bot.moveTo(14, 7, { maxSec: 6 });
    const blocks = w.events.filter((e) => e.type === 'block').length;
    bot.interact(); bot.wait(1.3);
    expect(w.door('A')!.open).toBe(true);
    bot.moveTo(13, 4, { maxSec: 8 }); bot.moveTo(8, 1, { maxSec: 10 });
    console.log('zone0 B(scout→shield, turret+panel route)', JSON.stringify({ ...summary(bot), blocks }));
    expect(w.phase).toBe('zoneclear');
    expect(blocks).toBeGreaterThan(0); // 방패가 포탑 탄을 실제로 막음
  });
  it('B2안: 폭탄병으로 갈아타 금이 간 벽을 부수고 지름길로 나간다(방패병은 남겨둠)', () => {
    const w = createWorld(0, null, 12); const bot = new Bot(w);
    const scout = bot.nearestEnemy('scout')!;
    bot.weaken(scout, 0, 20); // 정찰병은 처치
    bot.moveTo(6, 23, { maxSec: 8 });
    const bomber = bot.nearestEnemy('bomber')!;
    expect(bot.weaken(bomber, RULES.possessHpRatio, 30)).toBe(true);
    expect(bot.possess(bomber)).toBe(true);
    expect(w.player.body).toBe('bomber');
    bot.moveTo(2, 16, { maxSec: 12 }); bot.moveTo(2, 8, { maxSec: 10 });
    const crack = w.devices.find((d) => d.kind === 'crackedWall' && d.tx === 2) as CrackedWall;
    for (let i = 0; i < 6 && !crack.broken; i++) { bot.tick({ attack: true }); bot.wait(1.3); }
    expect(crack.broken).toBe(true);
    bot.moveTo(2, 4, { maxSec: 6 }); bot.moveTo(8, 1, { maxSec: 10 });
    const s = summary(bot);
    console.log('zone0 B2(bomber wall route)', JSON.stringify(s));
    expect(w.phase).toBe('zoneclear');
    expect(w.entities.some((e) => e.alive && e.body === 'shield')).toBe(true); // 방패병은 건드리지 않고 통과
  });
  it('A안 비교: 기본 몸으로 만나는 적을 전부 처치하는 플레이는 갈아타기보다 느리거나 실패한다', () => {
    const w = createWorld(0, null, 13); const bot = new Bot(w);
    bot.killAll(60);
    if (w.phase === 'playing') { const sh = bot.nearestEnemy('shield'); if (sh) { lureShield(bot); bot.weaken(sh, 0, 30); } }
    const killedAll = !w.aliveEnemies().some((e) => e.body !== 'turret');
    if (w.phase === 'playing') {
      bot.moveTo(14, 12, { maxSec: 15 }); bot.moveTo(14, 8, { maxSec: 12 }); bot.moveTo(14, 7, { maxSec: 6 });
      if (w.phase === 'playing') { bot.interact(); bot.wait(1.3); bot.moveTo(13, 4, { maxSec: 8 }); bot.moveTo(8, 1, { maxSec: 10 }); }
    }
    const s = summary(bot);
    console.log('zone0 A(kill all as intruder)', JSON.stringify({ ...s, killedAll }));
    // 비교 기준: B안(위 테스트)은 통과. A안은 실패하거나, 통과하더라도 더 오래 걸리고 더 많은 피해를 받는다.
    expect(w.phase !== 'zoneclear' || s.time > 20 || s.dmg > 40).toBe(true);
  });
});

describe('2구역 포탑 통로', () => {
  it('방패병은 정면 돌파로 통과한다(입구 방 적은 대기 상태라 바로 통로로 갈 수 있다)', () => {
    const w = createWorld(1, { body: 'shield', hp: 70, stability: 100 }, 21); const bot = new Bot(w);
    bot.moveTo(8, 19, { maxSec: 10 });
    expect(w.aliveEnemies().filter((e) => e.body !== 'turret' && e.ai.state === 'alert').length).toBe(0);
    const hp0 = w.player.hp;
    bot.moveTo(8, 12, { maxSec: 10 }); bot.moveTo(8, 5, { maxSec: 10 }); bot.moveTo(8, 1, { maxSec: 8 });
    const s = summary(bot);
    console.log('zone1 shield walk', JSON.stringify({ ...s, corridorDamage: Math.round(hp0 - Math.max(0, w.player.hp)), blocks: w.events.filter((e) => e.type === 'block').length }));
    expect(w.phase).toBe('zoneclear');
  });
  it('폭탄병으로 들어오면 달려드는 적을 정리하고 방패병을 폭탄으로 약화시켜 갈아탄 뒤 통로를 지난다(연속 갈아타기)', () => {
    const w = createWorld(1, { body: 'bomber', hp: 40, stability: 70 }, 23); const bot = new Bot(w);
    const shield = bot.nearestEnemy('shield')!;
    autoplay(bot, { maxSec: 40, keepAlive: ['shield'], engage: 300, stopWhen: (x) => !x.aliveEnemies().some((e) => e.body !== 'shield' && e.body !== 'turret' && e.ai.state === 'alert') });
    expect(bot.weaken(shield, RULES.possessHpRatio, 30)).toBe(true);
    expect(bot.possess(shield)).toBe(true);
    expect(w.player.body).toBe('shield');
    expect(w.player.hp).toBeGreaterThanOrEqual(Math.round(120 * RULES.possessMinHpRatio));
    autoplay(bot, { maxSec: 40, goal: { tx: 8, ty: 19 }, possessBelow: 0.15, engage: 260 });
    bot.moveTo(8, 19, { maxSec: 10 }); bot.useSkill(); bot.moveTo(8, 12, { maxSec: 10 }); bot.useSkill(); bot.moveTo(8, 5, { maxSec: 10 }); bot.moveTo(8, 1, { maxSec: 8 });
    console.log('zone1 bomber→shield', JSON.stringify(summary(bot)));
    expect(w.phase).toBe('zoneclear');
  });
  it('정찰병 질주 강행은 통과 가능하지만 큰 피해를 입는다(대비 실험)', () => {
    const results: string[] = []; let cleared = 0;
    for (const seed of [31, 32, 33]) {
      const w = createWorld(1, { body: 'scout', hp: 42, stability: 60 }, seed); const bot = new Bot(w);
      w.entities = w.entities.filter((e) => e.controlled || e.body === 'turret');
      bot.moveTo(8, 19, { maxSec: 10 });
      const hp0 = w.player.hp; bot.useSkill();
      bot.moveTo(8, 12, { maxSec: 6 }); bot.moveTo(8, 5, { maxSec: 6 }); bot.moveTo(8, 1, { maxSec: 6 });
      results.push(`seed${seed}: ${w.phase} hp ${hp0}→${Math.round(w.player.hp)}`);
      if (w.phase === 'zoneclear') cleared++;
    }
    console.log('zone1 scout sprint', results.join(' | '));
    expect(cleared).toBeGreaterThanOrEqual(1);
  });
  it('정비병은 과부하 단자로 포탑을 끄고 무피해로 통과한다', () => {
    const w = createWorld(1, { body: 'mechanic', hp: 65, stability: 90 }, 22); const bot = new Bot(w);
    w.entities = w.entities.filter((e) => e.controlled || e.body === 'turret');
    bot.moveTo(14, 24, { maxSec: 8, stopDist: 20 });
    bot.interact(); bot.wait(1.8);
    expect(w.entities.filter((e) => e.body === 'turret').every((t) => t.disabled)).toBe(true);
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
    const cracks = w.devices.filter((d) => d.kind === 'crackedWall' && d.ty === 4) as CrackedWall[];
    for (let i = 0; i < 8 && !cracks.some((c) => c.broken); i++) { bot.tick({ attack: true }); bot.wait(1.3); }
    expect(cracks.some((c) => c.broken)).toBe(true);
    bot.moveTo(11, 2, { maxSec: 8 }); bot.moveTo(8, 1, { maxSec: 8 });
    console.log('zone2 bomber', JSON.stringify(summary(bot)));
    expect(w.phase).toBe('zoneclear');
  });
  it('저격병은 구덩이 건너 스위치를 쏴 문 B로 나간다', () => {
    const w = createWorld(2, { body: 'sniper', hp: 50, stability: 70 }, 42); const bot = new Bot(w);
    w.entities = w.entities.filter((e) => e.controlled || e.body === 'turret');
    bot.moveTo(10, 14, { maxSec: 14 });
    bot.wait(2.5, { attack: true });
    expect(w.door('B')!.open).toBe(true);
    bot.moveTo(14, 5, { maxSec: 14 }); bot.moveTo(8, 1, { maxSec: 8 });
    console.log('zone2 sniper', JSON.stringify(summary(bot)));
    expect(w.phase).toBe('zoneclear');
  });
  it('침입자만으로는 출구를 열 수 없다(몸이 필요한 구조) — 벽도 스위치도 반응 없음', () => {
    const w = createWorld(2, null, 43); const bot = new Bot(w);
    w.entities = w.entities.filter((e) => e.controlled);
    bot.moveTo(10, 14, { maxSec: 14 }); bot.wait(3, { attack: true });
    expect(w.door('B')!.open).toBe(false);
    bot.moveTo(11, 8, { maxSec: 10 }); bot.wait(3, { attack: true });
    expect((w.devices.filter((d) => d.kind === 'crackedWall') as CrackedWall[]).every((c) => !c.broken)).toBe(true);
  });
  it('실전(자동 정책): 방패병으로 들어와 폭탄병·저격병을 남겨두고 싸우다 그중 하나를 빼앗는 판단이 성립한다', () => {
    let took = 0; const logs: string[] = [];
    for (const seed of [51, 52, 53]) {
      const w = createWorld(2, { body: 'shield', hp: 90, stability: 110 }, seed); const bot = new Bot(w);
      autoplay(bot, { maxSec: 45, keepAlive: ['bomber', 'sniper'], possessBelow: 0.5, engage: 300, stopWhen: (x) => x.player.body === 'bomber' || x.player.body === 'sniper' || x.aliveEnemies().every((e) => e.body === 'bomber' || e.body === 'sniper' || e.body === 'shield') });
      const cand = w.entities.filter((e) => e.alive && e.team === 'enemy' && (e.body === 'bomber' || e.body === 'sniper')).sort((a, b) => Math.hypot(a.x - w.player.x, a.y - w.player.y) - Math.hypot(b.x - w.player.x, b.y - w.player.y))[0];
      if (w.phase === 'playing' && cand && w.player.body !== 'bomber' && w.player.body !== 'sniper') { if (bot.weaken(cand, RULES.possessHpRatio, 25)) bot.possess(cand); }
      const ok = w.player.body === 'bomber' || w.player.body === 'sniper';
      if (ok) took++;
      logs.push(`seed${seed}: took=${ok} ${JSON.stringify(summary(bot))}`);
    }
    console.log('zone2 auto(keep bomber/sniper, then take one)', logs.join('\n'));
    expect(took).toBeGreaterThanOrEqual(2);
  });
});

describe('4구역 연속 갈아타기', () => {
  it('웨이브가 순서대로 소환되고, 3차까지 온 뒤 경비가 1명 이하로 줄면 봉쇄가 풀려 출구로 나갈 수 있다(구조 검증)', () => {
    const w = createWorld(3, { body: 'shield', hp: 100, stability: 110 }, 60);
    const p = w.player; p.disabled = true;
    const seen: string[] = [];
    for (let i = 0; i < 60 * 200 && !w.waveDone; i++) {
      step(w, EMPTY_INPUT);
      p.hp = p.hpMax; if (p.stability != null) p.stability = 100; // 구조만 검증: 플레이어는 무적 취급
      const spawned = w.events.filter((e) => e.type === 'wave' && e.text && e.text !== 'spawn' && e.text !== 'done').map((e) => e.text!); w.events.length = 0;
      for (const s of spawned) if (!seen.includes(s)) seen.push(s);
      // 소환된 적은 즉시 처치(플레이어가 이겼다고 가정)
      for (const e of w.aliveEnemies()) if (w.time - e.ai.alertedAt > 2) killEntity(w, e);
    }
    expect(seen).toEqual(ZONES[3].waves!.map((x) => x.label));
    expect(w.waveDone).toBe(true); expect(w.door('C')!.open).toBe(true);
    const bot = new Bot(w); p.disabled = false;
    bot.moveTo(8, 1, { maxSec: 12 });
    expect(w.phase).toBe('zoneclear');
  });
  it('자동 정책 봇의 생존·갈아타기 기록(참고용: 사람 플레이 대체 아님)', () => {
    let cleared = 0; const logs: string[] = [];
    for (const seed of [61, 62, 63, 64, 65]) {
      const w = createWorld(3, { body: 'shield', hp: 100, stability: 110 }, seed); const bot = new Bot(w);
      autoplay(bot, { maxSec: 150, goal: { tx: 8, ty: 1 }, possessBelow: 0.45 });
      logs.push(`seed${seed}: ${JSON.stringify(summary(bot))} waveIdx=${w.waveIndex} waveDone=${w.waveDone}`);
      if (w.phase === 'zoneclear') cleared++;
      expect(w.stats.possessions + w.stats.kills).toBeGreaterThan(0);
    }
    console.log(`zone3 auto: cleared ${cleared}/5\n` + logs.join('\n'));
  });
});

describe('5구역 보스', () => {
  it('보스는 빙의 불가, 66%에서 보호막·노드·포탑·소환, 노드 파괴로 보호막 해제, 33%에서 돌진·노출, 처치 시 승리(구조 검증)', () => {
    const w = createWorld(4, { body: 'sniper', hp: 55, stability: 70 }, 70);
    const boss = w.entities.find((e) => e.body === 'boss')!; const p = w.player; p.disabled = true;
    const godmode = () => { p.hp = p.hpMax; if (p.stability != null) p.stability = 70; };
    for (let i = 0; i < 120; i++) { step(w, EMPTY_INPUT); godmode(); }
    expect(boss.ai.phase).toBe(1);
    expect(w.entities.filter((e) => e.alive && e.body === 'scout').length).toBeGreaterThanOrEqual(1); // 1단계 소환
    boss.hp = 1; expect(isPossessable(w, boss)).toBe(false); boss.hp = boss.hpMax * 0.65;
    for (let i = 0; i < 90; i++) { step(w, EMPTY_INPUT); godmode(); }
    expect(boss.ai.phase).toBe(2); expect(boss.ai.shielded).toBe(true);
    expect(w.entities.filter((e) => e.alive && e.body === 'node').length).toBe(2);
    expect(w.entities.filter((e) => e.alive && e.tag === 'bossturret').length).toBe(2);
    // 보호막 중에는 피해 없음
    const hpBefore = boss.hp; applyDamage(w, boss, 50, { x: p.x, y: p.y, ownerId: p.id, volley: 1 }); expect(boss.hp).toBe(hpBefore);
    // 노드는 포탑을 돌아 걸어갈 수 있다(경로 존재)
    for (const n of w.entities.filter((e) => e.alive && e.body === 'node')) { const path = w.map.path(8, 12, Math.floor(n.x / S) + (n.x < w.map.w * S / 2 ? 1 : -1), Math.floor(n.y / S) - 1, w.staticBlocked()); expect(path).not.toBeNull(); }
    for (const n of w.entities.filter((e) => e.alive && e.body === 'node')) killEntity(w, n);
    step(w, EMPTY_INPUT); godmode();
    expect(boss.ai.shielded).toBe(false);
    applyDamage(w, boss, 50, { x: p.x, y: p.y, ownerId: p.id, volley: 2 }); expect(boss.hp).toBeLessThan(hpBefore);
    boss.hp = boss.hpMax * 0.3;
    for (let i = 0; i < 60 * 6; i++) { step(w, EMPTY_INPUT); godmode(); }
    expect(boss.ai.phase).toBe(3);
    expect(w.entities.filter((e) => e.tag === 'bossturret').every((t) => t.disabled)).toBe(true);
    expect(w.events.some((e) => e.type === 'bossPhase' && e.text === '코어 노출') || boss.ai.exposedUntil > 0 || boss.ai.chargeTele > 0 || boss.ai.chargeDash > 0).toBe(true);
    expect(w.entities.filter((e) => e.alive && e.body === 'mechanic').length).toBeGreaterThanOrEqual(1); // 3단계 소환
    killEntity(w, boss); step(w, EMPTY_INPUT);
    expect(w.phase).toBe('victory');
    expect(w.stats.bodiesUsed).not.toContain('boss');
  });
  it('자동 정책 봇의 보스전 기록(참고용: 사람 플레이 대체 아님)', () => {
    let wins = 0; const logs: string[] = [];
    for (const seed of [71, 72, 73, 74, 75]) {
      const w = createWorld(4, { body: 'shield', hp: 110, stability: 120 }, seed); const bot = new Bot(w);
      autoplay(bot, { maxSec: 240, boss: true, possessBelow: 0.45 });
      const boss = w.entities.find((e) => e.body === 'boss');
      logs.push(`seed${seed}: ${JSON.stringify(summary(bot))} bossHp=${boss ? Math.round(boss.hp) : 0} phase=${boss?.ai.phase}`);
      if (w.phase === 'victory') wins++;
      expect(w.stats.bodiesUsed).not.toContain('boss');
    }
    console.log(`zone4 boss auto: wins ${wins}/5\n` + logs.join('\n'));
  });
});
