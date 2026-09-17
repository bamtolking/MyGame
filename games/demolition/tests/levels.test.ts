import { describe, it, expect } from 'vitest';
import { LEVELS } from '../src/data/levels/index';
import { SOLUTIONS } from '../src/data/solutions';
import { lintLevel } from '../src/sim/lint';
import { runShots, LevelSession } from '../src/sim/session';

describe('스테이지 데이터', () => {
  it('20개 스테이지가 순서대로 있고 규칙을 지킨다', () => {
    expect(LEVELS.length).toBe(20);
    LEVELS.forEach((lv, i) => { expect(lv.id).toBe(i + 1); expect(lintLevel(lv), `${lv.key}: ${lintLevel(lv).join('; ')}`).toEqual([]); });
  });
  it('해법 기록의 스테이지 버전이 일치한다', () => {
    for (const lv of LEVELS) { const s = SOLUTIONS[lv.solutionRef]; expect(s, lv.key).toBeDefined(); expect(s.levelVersion, `${lv.key} 버전`).toBe(lv.version); }
  });
});

describe('스테이지 해법 재생(실제 물리)', () => {
  for (const lv of LEVELS) {
    it(`${lv.key} ${lv.title}: 기록된 해법으로 성공하고 보호물이 안전하며 3별 기준을 만족한다`, () => {
      const sol = SOLUTIONS[lv.solutionRef];
      const s = runShots(lv, sol.shots);
      expect(s.state, `${lv.key} state=${s.state} reason=${s.failReason} goals=${s.goalsDone}/${s.goals.length}`).toBe('success');
      expect(s.protects.every((p) => !p.failed)).toBe(true);
      expect(s.shotsUsed).toBeLessThanOrEqual(lv.stars.three);
      expect(s.stars).toBe(3);
      s.dispose();
    });
  }
  it('입력 없이 기다리면 어떤 스테이지도 저절로 성공·실패하지 않는다', () => {
    for (const lv of LEVELS) {
      const s = new LevelSession(lv);
      for (let i = 0; i < 60 * 6; i++) s.step();
      expect(s.goalsDone, lv.key).toBe(0);
      expect(s.failReason, lv.key).toBeNull();
      expect(s.state, lv.key).toBe('aiming');
      s.dispose();
    }
  });
  it('빗나간 약한 발사로는 성공하지 않는다', () => {
    for (const lv of LEVELS) {
      const s = runShots(lv, Array.from({ length: lv.shots }, () => ({ angleDeg: 10, power: 0.3 })));
      expect(s.state, lv.key).not.toBe('success');
      s.dispose();
    }
  });
  it('해법 재생은 결정적이다(같은 입력 → 같은 결과와 위치)', () => {
    for (const lv of [LEVELS[0], LEVELS[4], LEVELS[12], LEVELS[19]]) {
      const sol = SOLUTIONS[lv.solutionRef];
      const runs = [0, 1].map(() => { const s = runShots(lv, sol.shots); const pos = [...s.world.entries.values()].filter((e) => !e.removed).map((e) => `${e.body.position.x},${e.body.position.y},${e.body.angle}`).join('|'); const st = s.summary(); s.dispose(); return pos + JSON.stringify(st); });
      expect(runs[0]).toBe(runs[1]);
    }
  });
});
