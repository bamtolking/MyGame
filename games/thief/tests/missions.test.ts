// Every mission has at least one verified solution: scripted current-player inputs (same rules as touch input),
// recorded into ghosts attempt by attempt, ending in an escape. Fixtures are written to tests/solutions/*.json.
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { MISSIONS } from '../src/data/missions';
import { compileMap } from '../src/sim/maps';
import type { BotScript } from '../src/sim/bot';
import type { Recording } from '../src/sim/types';
import { findEv, runScript } from './helpers';
import { makeBot } from '../src/sim/bot';
import { createAttempt, stepAttempt } from '../src/sim/engine';
import { validateRecording } from '../src/sim/recording';

interface Solution { mission: string; note: string; attempts: { name: string; script: BotScript; expect: 'escape' | 'finish' | 'timeout' | 'death' | 'any' }[]; alsoSolo?: { script: BotScript; expect: 'timeout' | 'death' | 'escape' } }

const SOLUTIONS: Solution[] = [
  { mission: 'm1', note: '1번 분신이 왼쪽 발전기를 부수는 동안 나는 오른쪽 레이저 앞에서 기다렸다가 코어를 가져온다.',
    attempts: [
      { name: 'ghost1: 왼쪽 발전기 파괴 후 시간 종료', script: { weapon: 'rifle', steps: [{ to: [1, 3], dash: true }, { interact: true, until: { generatorDead: 'g1', max: 12 } }, { to: [10, 1], dash: true }, { to: [6, 24], dash: true }] }, expect: 'timeout' },
      { name: 'final: 오른쪽 길, 레이저 꺼지면 코어', script: { weapon: 'rifle', steps: [{ to: [10, 13], dash: true }, { until: { laserOff: 'l1', max: 30 } }, { to: [10, 1], dash: true }, { until: { hasCore: true, max: 3 } }, { to: [6, 24], dash: true }] }, expect: 'escape' },
    ],
    alsoSolo: { script: { weapon: 'rifle', steps: [{ to: [1, 3], dash: true }, { interact: true, until: { generatorDead: 'g1', max: 12 } }, { to: [10, 1], dash: true }, { until: { hasCore: true, max: 3 } }, { to: [6, 24], dash: true }] }, expect: 'timeout' } },
  { mission: 'm2', note: '두 분신이 발판 A·B를 각각 밟고 기록을 마치면(위치 유지) 금고가 열린다. 발판 B는 금고에 가까워 분신 1명 + 2.5초 여유로도 가능.',
    attempts: [
      { name: 'ghost1: 발판 A에서 기록 마치기', script: { weapon: 'rifle', steps: [{ to: [1, 12], dash: true }, { finish: true }] }, expect: 'finish' },
      { name: 'ghost2: 발판 B에서 기록 마치기', script: { weapon: 'rifle', steps: [{ to: [11, 8], dash: true }, { finish: true }] }, expect: 'finish' },
      { name: 'final: 금고 열리면 코어', script: { weapon: 'rifle', steps: [{ to: [6, 5], dash: true }, { until: { vaultOpen: true, max: 15 } }, { to: [6, 2], dash: true }, { until: { hasCore: true, max: 3 } }, { to: [6, 18], dash: true }] }, expect: 'escape' },
    ],
    alsoSolo: { script: { weapon: 'rifle', steps: [{ to: [1, 12], dash: true }, { to: [11, 8], dash: true }, { to: [6, 2], dash: true }, { until: { hasCore: true, max: 3 } }, { to: [6, 18], dash: true }] }, expect: 'timeout' } },
  { mission: 'm3', note: '소총 분신 둘이 방 양쪽 구석에서 포탑을 맡고(중장갑 경비의 팔이 닿지 않는 거리), 산탄 분신이 복도 입구 경비를 맡는다. 나는 정리된 뒤 들어가 아래쪽에서 코어를 회수한다.',
    attempts: [
      { name: 'ghost1: 소총, 왼쪽 구석에서 포탑', script: { weapon: 'rifle', steps: [{ to: [6, 9], dash: true }, { until: { enemyDead: 4, max: 6 } }, { to: [2, 4], dash: true }, { until: { enemyDead: 0, max: 8 } }, { until: { enemyDead: 2, max: 8 } }, { finish: true }] }, expect: 'any' },
      { name: 'ghost2: 산탄, 복도 입구 경비', script: { weapon: 'shotgun', steps: [{ to: [6, 9], dash: true }, { until: { enemyDead: 3, max: 6 } }, { until: { enemyDead: 4, max: 6 } }, { finish: true }] }, expect: 'finish' },
      { name: 'ghost3: 소총, 오른쪽 구석에서 포탑', script: { weapon: 'rifle', steps: [{ wait: 3 }, { to: [10, 4], dash: true }, { until: { enemyDead: 1, max: 9 } }, { finish: true }] }, expect: 'any' },
      { name: 'final: 정리 후 진입, 아래쪽에서 회수', script: { weapon: 'rifle', steps: [{ to: [6, 11], dash: true }, { wait: 10 }, { to: [6, 4], dash: true }, { until: { hasCore: true, max: 4 } }, { to: [6, 14], dash: true }] }, expect: 'escape' },
    ] },
  { mission: 'm4', note: '분신 하나가 발전기를 부순 뒤 발판 A까지 걸어가 기록을 마친다(두 가지 일). 나는 오른쪽 레이저 앞에서 기다렸다가 코어.',
    attempts: [
      { name: 'ghost1: 발전기 → 발판 A → 기록 마치기', script: { weapon: 'rifle', steps: [{ to: [2, 3], dash: true }, { interact: true, until: { generatorDead: 'g1', max: 12 } }, { to: [6, 9], dash: true }, { finish: true }] }, expect: 'finish' },
      { name: 'final: 오른쪽, 금고 열리면 코어', script: { weapon: 'rifle', steps: [{ to: [10, 8], dash: true }, { until: { vaultOpen: true, max: 20 } }, { to: [10, 2], dash: true }, { until: { hasCore: true, max: 3 } }, { to: [6, 13], dash: true }] }, expect: 'escape' },
    ],
    alsoSolo: { script: { weapon: 'rifle', steps: [{ to: [2, 3], dash: true }, { interact: true, until: { generatorDead: 'g1', max: 12 } }, { to: [10, 2], dash: true }, { to: [6, 13], dash: true }] }, expect: 'timeout' } },
  { mission: 'm5', note: '오른쪽 경비실: 소총 분신이 경비 둘과 문을 막은 중장갑 경비를 거리 두고 정리하면, 나는 산탄총으로 빠르게 통과. (왼쪽 레이저 타이밍 우회로는 분신 없이도 가능하지만 봇은 타이밍을 못 맞춰 검증에서 제외.)',
    attempts: [
      { name: 'ghost1: 소총, 경비실 정리', script: { weapon: 'rifle', steps: [{ to: [10, 10], dash: true }, { until: { enemyDead: 1, max: 6 } }, { to: [10, 6] }, { until: { enemyDead: 2, max: 6 } }, { until: { enemyDead: 0, max: 9 } }, { finish: true }] }, expect: 'finish' },
      { name: 'final: 산탄총, 오른쪽 통과', script: { weapon: 'shotgun', steps: [{ to: [6, 10], dash: true }, { wait: 8 }, { to: [10, 1], dash: true }, { to: [6, 1], dash: true }, { until: { hasCore: true, max: 3 } }, { to: [6, 12], dash: true }] }, expect: 'escape' },
    ],
    alsoSolo: { script: { weapon: 'rifle', steps: [{ to: [10, 9], dash: true }, { to: [10, 6] }, { until: { enemyDead: 0, max: 9 } }, { to: [10, 1], dash: true }, { to: [6, 1], dash: true }, { until: { hasCore: true, max: 3 } }, { to: [6, 12], dash: true }] }, expect: 'escape' } },
  { mission: 'm6', note: '1번: 왼쪽 경비 처치 → 발전기 파괴 → 발판 A 유지. 2번: 오른쪽 경비 처치 → 발판 B 유지. 나: 가운데 경비실을 지나 문 앞에서 대기, 열리면 코어.',
    attempts: [
      { name: 'ghost1: 발전기 + 발판 A', script: { weapon: 'rifle', steps: [{ to: [2, 3], dash: true }, { interact: true, until: { generatorDead: 'g1', max: 12 } }, { to: [1, 8], dash: true }, { finish: true }] }, expect: 'finish' },
      { name: 'ghost2: 발판 B', script: { weapon: 'rifle', steps: [{ to: [10, 3], dash: true }, { to: [10, 2] }, { finish: true }] }, expect: 'finish' },
      { name: 'final: 가운데 통과, 문 앞 대기', script: { weapon: 'rifle', steps: [{ to: [6, 10], dash: true }, { wait: 4 }, { to: [6, 5], dash: true }, { until: { vaultOpen: true, max: 15 } }, { to: [6, 2], dash: true }, { until: { hasCore: true, max: 3 } }, { to: [6, 12], dash: true }] }, expect: 'escape' },
    ] },
];

mkdirSync('tests/solutions', { recursive: true });

describe('all six missions have a verified solution', () => {
  for (const sol of SOLUTIONS) {
    const def = MISSIONS.find((m) => m.id === sol.mission)!; const map = compileMap(def);
    it(`${def.id} ${def.title}: ${sol.attempts.length - 1} ghost recording(s) then escape`, () => {
      const ghosts: Recording[] = []; const out: Record<string, unknown>[] = [];
      let finalTicks = 0; let finalDamage = 0; let contributions: Record<string, unknown> = {};
      for (let i = 0; i < sol.attempts.length; i++) {
        const a = sol.attempts[i]; const r = runScript(map, a.script, ghosts.slice());
        const last = i === sol.attempts.length - 1;
        if (a.expect !== 'any') expect(r.st.outcome?.kind, `${def.id} ${a.name}`).toBe(a.expect);
        expect(validateRecording(r.rec, def.id, def.version)).not.toBeNull();
        out.push({ name: a.name, weapon: a.script.weapon, outcome: r.st.outcome, damageTaken: r.st.damageTaken, shots: r.rec.shots.length, events: r.events.filter((e) => ['generatorDestroyed', 'enemyDied', 'plateChanged', 'vaultChanged', 'corePicked', 'escape'].includes(e.ev.kind)).map((e) => ({ t: +(e.tick / 60).toFixed(2), ...e.ev })), script: a.script, recording: last ? undefined : r.rec });
        if (last) { expect(r.st.player.hasCore).toBe(true); finalTicks = r.st.outcome!.tick; finalDamage = r.st.damageTaken; contributions = r.st.stats; expect(r.st.outcome!.tick).toBeLessThanOrEqual(def.seconds * 60); }
        else ghosts.push(r.rec);
      }
      writeFileSync(`tests/solutions/${def.id}.json`, JSON.stringify({ mission: def.id, title: def.title, mapVersion: def.version, seed: def.seed, note: sol.note, finalEscapeSeconds: +(finalTicks / 60).toFixed(2), finalDamageTaken: finalDamage, ghostsUsed: ghosts.length, contributions, attempts: out }, null, 1));
    });
    if (sol.alsoSolo) it(`${def.id}: solo reference run ends in ${sol.alsoSolo.expect}`, () => {
      const r = runScript(map, sol.alsoSolo!.script);
      expect(r.st.outcome?.kind).toBe(sol.alsoSolo!.expect);
    });
  }
  it('no map contains a hidden success zone: escaping requires the core', () => {
    for (const def of MISSIONS) { const map = compileMap(def); const r = runScript(map, { weapon: 'rifle', steps: [{ wait: 26 }] }); expect(r.st.outcome?.kind).toBe('timeout'); expect(r.st.player.hasCore).toBe(false); }
  });
});

describe('device rules across missions', () => {
  it('m2: with only plate A held by a ghost, the vault stays closed; both plates open it; it closes 2.5 s after a plate is released', () => {
    const map = compileMap(MISSIONS[1]);
    const gA = runScript(map, { weapon: 'rifle', steps: [{ to: [1, 12], dash: true }, { finish: true }] });
    const idle = runScript(map, { weapon: 'rifle', steps: [{ wait: 26 }] }, [gA.rec]);
    expect(findEv(idle, 'vaultChanged').length).toBe(0); expect(idle.st.vault.open).toBe(false);
    const onB = runScript(map, { weapon: 'rifle', steps: [{ to: [11, 8], dash: true }, { wait: 1 }, { to: [11, 5] }, { wait: 5 }] }, [gA.rec]);
    const ev = findEv(onB, 'vaultChanged'); expect(ev[0].ev.open).toBe(true); expect(ev[1].ev.open).toBe(false);
    const released = findEv(onB, 'plateChanged').find((e) => e.ev.id === 'pR' && !e.ev.pressed)!;
    expect(ev[1].tick - released.tick).toBeGreaterThanOrEqual(148); expect(ev[1].tick - released.tick).toBeLessThanOrEqual(150);
  });
  it('m5: timed lasers cycle off → warn → on, and a warning beam neither blocks nor hurts', () => {
    const map = compileMap(MISSIONS[4]);
    const r = runScript(map, { weapon: 'rifle', steps: [{ wait: 6 }] });
    const seq = findEv(r, 'laserChanged').filter((e) => e.ev.id === 't1').map((e) => e.ev.phase);
    expect(seq.slice(0, 4)).toEqual(['warn', 'on', 'off', 'warn']);
    // Walk into t2 (row 7) from below whenever it is off and stand there: hits may only happen while it is actually on.
    const inside = runScript(map, { weapon: 'rifle', steps: [{ to: [1, 8], dash: true }, { until: { laserOff: 't2', max: 5 } }, { to: [1, 7] }, { wait: 6 }] });
    const phase: Record<string, string> = { t1: 'off', t2: 'off' }; let hits = 0; let bad = 0;
    for (const e of inside.events) { if (e.ev.kind === 'laserChanged') phase[e.ev.id] = e.ev.phase; if (e.ev.kind === 'playerHit') { hits++; if (phase.t1 !== 'on' && phase.t2 !== 'on') bad++; } }
    expect(hits).toBeGreaterThan(0); expect(bad).toBe(0);
  });
  it('m5: the heavy guard is solid — the player cannot pass the door while it stands, and can once it is down', () => {
    const map = compileMap(MISSIONS[4]);
    const bot = makeBot(map, { weapon: 'shotgun', steps: [{ to: [10, 5], dash: true }, { to: [10, 1], dash: true }, { wait: 3 }] });
    const st = createAttempt(map, { weapon: 'shotgun', ghosts: [] });
    let deathTick = -1;
    while (!st.outcome && st.tick < 900) {
      stepAttempt(st, bot.input(st)); const h = st.enemies[0];
      if (h.alive) expect(st.player.y).toBeGreaterThan(h.y + 20); // never above the guard
      else if (deathTick < 0) deathTick = st.tick;
    }
    expect(deathTick).toBeGreaterThan(0); expect(st.player.y).toBeLessThan(2 * 40); // through the door after killing it
  });
  it('a run that ends in death produces a death recording whose ghost vanishes at that tick', () => {
    const map = compileMap(MISSIONS[4]);
    const dead = runScript(map, { weapon: 'rifle', steps: [{ to: [1, 5], dash: true }, { to: [1, 1] }, { wait: 20 }] }); // walks into the timed lasers repeatedly
    expect(dead.st.outcome?.kind).toBe('death'); expect(dead.rec.endKind).toBe('death');
    const replay = runScript(map, { weapon: 'rifle', steps: [{ wait: 26 }] }, [dead.rec]);
    const gone = findEv(replay, 'ghostGone'); expect(gone.length).toBe(1); expect(gone[0].tick).toBe(dead.rec.endTick + 1);
  });
  it('turrets telegraph before every shot', () => {
    const map = compileMap(MISSIONS[2]);
    const r = runScript(map, { weapon: 'rifle', steps: [{ to: [6, 4], dash: true }, { wait: 4 }] });
    const warns = findEv(r, 'turretWarn'); const shots = findEv(r, 'shot').filter((e) => e.ev.owner === 'enemy');
    expect(shots.length).toBeGreaterThan(0);
    for (const s of shots) { const w = warns.filter((x) => x.tick < s.tick && s.tick - x.tick <= 40); expect(w.length).toBeGreaterThan(0); }
  });
});
