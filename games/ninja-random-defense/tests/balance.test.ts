import { describe, it, expect } from 'vitest';
import { runBot } from './bot.ts';

describe('밸런스 스모크 (봇)', () => {
  it('아무것도 안 하는 판(유닛 5개)은 15라운드 안에 탈락한다', () => {
    const r = runBot(2, 'idle', { maxTime: 900 }); expect(r.round).toBeLessThan(15); expect(r.won).toBe(false);
  });
  it('탐욕 봇은 시드 3개에서 모두 30라운드 이상 도달하고 신화를 만든다', () => {
    for (const seed of [1, 2, 3]) { const r = runBot(seed, 'greedy'); expect(r.round).toBeGreaterThanOrEqual(30); expect(r.crafts).toBeGreaterThan(0); expect(r.summons).toBeGreaterThan(100); }
  });
  it('강화 봇은 6시드 중 절반 이상 40라운드 방어에 성공한다', () => {
    let wins = 0; for (let seed = 1; seed <= 6; seed++) if (runBot(seed, 'upgrade').won) wins++;
    expect(wins).toBeGreaterThanOrEqual(3);
  });
});
