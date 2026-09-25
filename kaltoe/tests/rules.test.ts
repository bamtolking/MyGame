// 게임 규칙 테스트: 결정성, 레벨업/진화/상자/점심, 칼퇴·야근 확정, 정산·업적·해금, 저장 왕복, 일일 도전
import { describe, it, expect } from 'vitest';
import { BALANCE, ENEMY, PASSIVE, STAGE, WEAPON, WEAPONS, CHARACTERS, META_UPGRADES } from '../src/content';
import { createWorld } from '../src/sim/state';
import { stepWorld, continueOvertime, endRun } from '../src/sim/step';
import { applyChoice, applyLunch, buildChoices, closeChest, evolvable, openChest, addPassive } from '../src/sim/levelup';
import { spawnEnemy, hpScale } from '../src/sim/enemies';
import { damageEnemy, killEnemy } from '../src/sim/damage';
import { activateUlt } from '../src/sim/ultimate';
import { maxLevelOf, weaponStatsAt } from '../src/sim/stats';
import { clockText } from '../src/sim/director';
import type { World } from '../src/sim/types';
import { makeConfig, runBot } from './bot';
import { newProfile, normalize, exportProfile, importProfile } from '../src/platform/save';
import {
  buildRunConfig, buyMeta, checkAttendance, dailyInfo, evaluateAchievements, metaCost, settleRun, weaponUnlocked, characterUnlocked,
} from '../src/meta/progress';
import { autoChoose, autoMove } from '../src/sim/autopilot';

function hashWorld(w: World): string {
  let h = 0;
  const mix = (v: number) => { h = (Math.imul(h ^ Math.round(v * 1000), 0x01000193) + 7) | 0; };
  mix(w.player.x); mix(w.player.y); mix(w.player.hp); mix(w.player.level); mix(w.player.xp);
  mix(w.stats_.kills); mix(w.enemies.length); mix(w.pickups.length);
  for (const e of w.enemies) { mix(e.x); mix(e.y); mix(e.hp); }
  return (h >>> 0).toString(16);
}

function drive(w: World, seconds: number) {
  const end = w.t + seconds;
  while (w.t < end) {
    if (w.phase === 'play') {
      if (w.step % 3 === 0) { const [mx, my] = autoMove(w); w.player.mx = mx; w.player.my = my; }
      stepWorld(w);
      w.events.length = 0;
    } else if (w.phase === 'levelup') applyChoice(w, autoChoose(w));
    else if (w.phase === 'chest') closeChest(w);
    else if (w.phase === 'lunch') applyLunch(w, w.lunchChoices[0].id);
    else break;
  }
}

describe('결정성', () => {
  it('같은 시드 + 같은 입력 → 같은 결과', () => {
    const a = createWorld(makeConfig({ seed: 42 }));
    const b = createWorld(makeConfig({ seed: 42 }));
    drive(a, 120); drive(b, 120);
    expect(hashWorld(a)).toBe(hashWorld(b));
    expect(a.stats_.kills).toBeGreaterThan(50);
  });
  it('다른 시드 → 다른 결과', () => {
    const a = createWorld(makeConfig({ seed: 1 }));
    const b = createWorld(makeConfig({ seed: 2 }));
    drive(a, 60); drive(b, 60);
    expect(hashWorld(a)).not.toBe(hashWorld(b));
  });
});

describe('시작 상태', () => {
  it('캐릭터 시작 무기를 들고 시작, 체력 가득', () => {
    for (const c of CHARACTERS) {
      const w = createWorld(makeConfig({ char: c.id }));
      expect(w.weapons.map(x => x.def.id)).toEqual([c.startWeapon]);
      expect(w.player.hp).toBe(w.d.maxHp);
      expect(w.player.ultMax).toBeGreaterThan(0);
    }
  });
  it('09:00에서 시작하고 시계가 흐른다', () => {
    const w = createWorld(makeConfig({}));
    expect(clockText(w)).toBe('09:00');
    drive(w, 67);
    expect(clockText(w)).toBe('10:00');
  });
});

describe('레벨업 선택지', () => {
  it('잠긴 무기/패시브는 나오지 않고 중복이 없다', () => {
    const cfg = makeConfig({ allUnlocked: false });
    const w = createWorld(cfg);
    for (let i = 0; i < 200; i++) {
      const cs = buildChoices(w);
      const keys = cs.map(c => `${c.kind}:${c.id}`);
      expect(new Set(keys).size).toBe(keys.length);
      for (const c of cs) {
        if (c.kind === 'newWeapon') {
          expect(WEAPON.get(c.id)!.evolved).toBeFalsy();
          expect(cfg.unlockedWeapons.has(c.id) || c.id === cfg.character.startWeapon).toBe(true);
        }
        if (c.kind === 'newPassive') expect(cfg.unlockedPassives.has(c.id)).toBe(true);
      }
      w.rng.a = (w.rng.a + 12345) | 0;
    }
  });
  it('무기 6개 · 패시브 6개를 넘지 않는다', () => {
    const w = createWorld(makeConfig({}));
    w.levelQueue = 120;
    w.phase = 'levelup';
    w.choices = buildChoices(w);
    for (let i = 0; i < 120 && w.phase === 'levelup'; i++) applyChoice(w, 0);
    expect(w.weapons.length).toBeLessThanOrEqual(BALANCE.maxWeapons);
    expect(w.passives.length).toBeLessThanOrEqual(BALANCE.maxPassives);
    for (const wi of w.weapons) expect(wi.level).toBeLessThanOrEqual(maxLevelOf(wi.def));
    for (const p of w.passives) expect(p.level).toBeLessThanOrEqual(p.def.maxLevel);
  });
});

describe('진화', () => {
  it('최대 레벨 + 짝 패시브 → 상자에서 진화', () => {
    for (const base of WEAPONS.filter(x => x.evolvesTo)) {
      const w = createWorld(makeConfig({}));
      w.weapons.length = 0;
      const wi = { def: base, slot: 0, level: maxLevelOf(base), st: weaponStatsAt(base, maxLevelOf(base)), cd: 0, burst: 0, burstT: 0, on: 0, angle: 0, drones: [], dmg: 0, kills: 0 };
      w.weapons.push(wi);
      expect(evolvable(w)).toHaveLength(0);
      addPassive(w, PASSIVE.get(base.evolveWith!)!);
      expect(evolvable(w)).toHaveLength(1);
      openChest(w, false);
      expect(w.weapons[0].def.id).toBe(base.evolvesTo);
      expect(w.chest!.items[0].kind).toBe('evolve');
      closeChest(w);
      expect(w.phase).toBe('play');
    }
  });
  it('최대 레벨이 아니면 진화하지 않는다', () => {
    const base = WEAPONS.find(x => x.evolvesTo)!;
    const w = createWorld(makeConfig({ char: CHARACTERS.find(c => c.startWeapon === base.id)?.id ?? 'kim' }));
    w.weapons.length = 0;
    w.weapons.push({ def: base, slot: 0, level: 3, st: weaponStatsAt(base, 3), cd: 0, burst: 0, burstT: 0, on: 0, angle: 0, drones: [], dmg: 0, kills: 0 });
    addPassive(w, PASSIVE.get(base.evolveWith!)!);
    openChest(w, false);
    expect(w.weapons[0].def.id).toBe(base.id);
  });
});

describe('점심', () => {
  it('12:00에 점심 메뉴 3개, 선택하면 스탯 적용', () => {
    const w = createWorld(makeConfig({ seed: 5 }));
    w.player.invulnT = 1e9;
    while (w.phase !== 'lunch' && w.t < BALANCE.lunchAt + 5) {
      if (w.phase === 'play') stepWorld(w);
      else if (w.phase === 'levelup') applyChoice(w, 0);
      else if (w.phase === 'chest') closeChest(w);
      w.events.length = 0;
    }
    expect(w.phase).toBe('lunch');
    expect(w.t).toBeGreaterThanOrEqual(BALANCE.lunchAt);
    expect(w.lunchChoices.length).toBe(3);
    const l = w.lunchChoices[0];
    const before = { ...w.stats };
    applyLunch(w, l.id);
    expect(w.phase).toBe('play');
    for (const [k, v] of Object.entries(l.stats)) expect(w.stats[k as keyof typeof w.stats]).toBeCloseTo(before[k as keyof typeof before] + (v as number), 5);
  });
});

describe('칼퇴 / 야근 확정', () => {
  function fastForwardTo(w: World, t: number) {
    w.player.invulnT = 1e9;
    w.lunchOffered = true;
    while (w.t < t && (w.phase === 'play' || w.phase === 'levelup' || w.phase === 'chest')) {
      if (w.phase === 'play') stepWorld(w);
      else if (w.phase === 'levelup') applyChoice(w, 0);
      else closeChest(w);
      w.events.length = 0;
    }
  }
  it('18:00에 최종 보스가 살아있으면 야근 확정(시계 17:59), 잡으면 칼퇴', () => {
    const w = createWorld(makeConfig({ seed: 7 }));
    fastForwardTo(w, BALANCE.runSeconds + 1);
    expect(w.finalBossSpawned).toBe(true);
    if (!w.finalBossDead) {
      expect(w.yageun).toBe(true);
      expect(clockText(w)).toBe('17:59');
      const boss = w.enemies.find(e => e.def.id === w.cfg.stage.finalBoss && !e.dead)!;
      expect(boss).toBeTruthy();
      killEnemy(w, boss, 0);
      stepWorld(w);
    }
    expect(w.phase).toBe('victory');
    expect(w.cleared).toBe(true);
  });
  it('칼퇴 후 야근 모드로 계속 가능', () => {
    const w = createWorld(makeConfig({ seed: 8, overtime: true }));
    fastForwardTo(w, BALANCE.runSeconds + 1);
    const boss = w.enemies.find(e => e.def.id === w.cfg.stage.finalBoss && !e.dead);
    if (boss) { killEnemy(w, boss, 0); stepWorld(w); }
    expect(w.phase).toBe('victory');
    continueOvertime(w);
    expect(w.phase).toBe('play');
    w.player.invulnT = 1e9;
    for (let i = 0; i < 60 * 70; i++) { if (w.phase === 'play') stepWorld(w); else if (w.phase === 'levelup') applyChoice(w, 0); else if (w.phase === 'chest') closeChest(w); w.events.length = 0; }
    expect(w.stats_.overtimeSec).toBeGreaterThan(60);
    expect(clockText(w) >= '18:00').toBe(true);
  });
});

describe('전투 규칙', () => {
  it('처치 시 경험치 보석이 떨어지고 한 번만 처치된다', () => {
    const w = createWorld(makeConfig({}));
    const def = ENEMY.get(STAGE.get('office')!.timeline[0].pool[0].enemy)!;
    const e = spawnEnemy(w, def, 50, 0, hpScale(w, false));
    killEnemy(w, e, 0);
    killEnemy(w, e, 0);
    expect(w.stats_.kills).toBe(1);
    expect(w.pickups.some(p => p.kind === 'xp')).toBe(true);
  });
  it('보스는 상자(보스 상자)를 떨어뜨린다', () => {
    const w = createWorld(makeConfig({}));
    const boss = ENEMY.get(STAGE.get('office')!.finalBoss)!;
    const e = spawnEnemy(w, boss, 100, 0, hpScale(w, true));
    expect(w.bossAlive).toBe(e);
    damageEnemy(w, e, e.hp * 10, 0, { flat: true });
    expect(e.dead).toBe(true);
    expect(w.pickups.some(p => p.kind === 'chest' && p.bossChest)).toBe(true);
    expect(w.finalBossDead).toBe(true);
    expect(w.bossAlive).toBe(null);
  });
  it('분열 적은 사망 시 자식을 낳는다', () => {
    const w = createWorld(makeConfig({}));
    const sp = [...ENEMY.values()].find(e => e.split)!;
    const e = spawnEnemy(w, sp, 80, 0, 1);
    const n0 = w.enemies.length;
    killEnemy(w, e, 0);
    expect(w.enemies.length - n0).toBe(sp.split!.count);
  });
  it('궁극기는 게이지가 가득할 때만 발동하고 게이지를 비운다', () => {
    const w = createWorld(makeConfig({}));
    expect(activateUlt(w)).toBe(false);
    w.player.ult = w.player.ultMax;
    expect(activateUlt(w)).toBe(true);
    expect(w.player.ult).toBe(0);
    expect(w.stats_.ultUses).toBe(1);
  });
  it('장시간 진행해도 좌표/체력에 NaN이 없다', () => {
    const w = createWorld(makeConfig({ seed: 11 }));
    w.player.invulnT = 1e9;
    drive(w, 300);
    expect(Number.isFinite(w.player.x) && Number.isFinite(w.player.y)).toBe(true);
    for (const e of w.enemies) { expect(Number.isFinite(e.x)).toBe(true); expect(Number.isFinite(e.hp)).toBe(true); }
    expect(w.enemies.length).toBeLessThanOrEqual(460);
  });
});

describe('메타 진행', () => {
  it('판 정산: 월급 지급, 누적 기록, 업적 보상 해금', () => {
    const p = newProfile();
    const r = createWorld(buildRunConfig(p, { char: 'kim', stage: 'office', heat: 0, seed: 3 }));
    drive(r, 150);
    endRun(r);
    const coins0 = p.coins;
    const st = settleRun(p, r);
    expect(p.coins).toBe(coins0 + st.total + st.grants.filter(g => g.a.reward.kind === 'coins').reduce((a, g) => a + (g.a.reward.amount ?? 0), 0));
    expect(p.lifetime.runs).toBe(1);
    expect(p.lifetime.kills).toBe(r.stats_.kills);
    // 보상으로 해금된 것은 실제로 해금 판정됨
    for (const g of st.grants) {
      if (g.a.reward.kind === 'weapon') expect(weaponUnlocked(p, g.a.reward.id!)).toBe(true);
      if (g.a.reward.kind === 'character') expect(characterUnlocked(p, g.a.reward.id!)).toBe(true);
    }
  });
  it('업적은 한 번만 지급된다', () => {
    const p = newProfile();
    p.lifetime.kills = 1e9; p.lifetime.runs = 1e4;
    const g1 = evaluateAchievements(p);
    const g2 = evaluateAchievements(p);
    expect(g1.length).toBeGreaterThan(0);
    expect(g2.length).toBe(0);
  });
  it('복지 구매: 돈이 부족하면 실패, 충분하면 단계 상승·차감', () => {
    const p = newProfile();
    const m = META_UPGRADES.find(x => !x.unlockedBy)!;
    expect(m).toBeTruthy();
    p.coins = 0;
    expect(buyMeta(p, m.id)).toBe(false);
    p.coins = 1e6;
    const c = metaCost(m.id, 0);
    expect(buyMeta(p, m.id)).toBe(true);
    expect(p.coins).toBe(1e6 - c);
    expect(p.metaRanks[m.id]).toBe(1);
    expect(metaCost(m.id, 1)).toBeGreaterThanOrEqual(c);
    for (let i = 1; i < m.maxRank; i++) buyMeta(p, m.id);
    expect(buyMeta(p, m.id)).toBe(false);
    expect(p.metaRanks[m.id]).toBe(m.maxRank);
  });
  it('출석 체크는 하루 한 번', () => {
    const p = newProfile();
    const a = checkAttendance(p);
    const b = checkAttendance(p);
    expect(a).not.toBeNull();
    expect(b).toBeNull();
    expect(p.attendance.total).toBe(1);
  });
  it('오늘의 업무는 날짜로 결정된다', () => {
    const p = newProfile();
    const a = dailyInfo(p, '2026-09-25'), b = dailyInfo(p, '2026-09-25'), c = dailyInfo(p, '2026-09-26');
    expect(a).toEqual(b);
    expect(a.modifiers.length).toBe(2);
    expect(a.seed).not.toBe(c.seed);
  });
});

describe('저장', () => {
  it('내보내기/불러오기 왕복', () => {
    const p = newProfile();
    p.coins = 1234; p.unlocked.push('weapon:laser'); p.achievements['x'] = 1;
    const code = exportProfile(p);
    const q = importProfile(code)!;
    expect(q.coins).toBe(1234);
    expect(q.unlocked).toContain('weapon:laser');
  });
  it('손상된 코드는 거부', () => {
    const code = exportProfile(newProfile());
    expect(importProfile(code.slice(0, -4) + 'AAAA')).toBeNull();
    expect(importProfile('hello')).toBeNull();
  });
  it('누락 필드는 기본값으로 채움, 미래 버전은 거부', () => {
    const q = normalize({ v: 1, coins: 50 })!;
    expect(q.coins).toBe(50);
    expect(q.settings.sfx).toBeGreaterThan(0);
    expect(normalize({ v: 99 })).toBeNull();
    expect(normalize('x')).toBeNull();
  });
});

describe('봇 완주', () => {
  it('영구 강화 없이도 첫 스테이지를 어느 정도 버틴다 & 성능', () => {
    const r = runBot({ stage: 'office', seed: 21, maxSeconds: 620, allUnlocked: false });
    expect(r.t).toBeGreaterThan(120);
    expect(r.stepsMsAvg).toBeLessThan(2);
  });
});
