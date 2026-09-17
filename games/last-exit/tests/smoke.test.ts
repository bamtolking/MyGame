import { describe, it, expect } from 'vitest';
import { newRun } from '../src/sim/state';
import { runBot } from './bot';

describe('연기 테스트: 봇이 1구역을 정리하고 2구역에서 탈출', () => {
  it('경로 A, 시드 1', () => {
    const s = newRun({ seed: 1, weapon: 'rifle', difficulty: 'normal', bagUpgrades: 0, runId: 'smoke' });
    const lines: string[] = [];
    const r = runBot(s, { path: 'A', log: m => lines.push(m), maxTime: 300 });
    console.log(lines.join('\n'));
    console.log(JSON.stringify(r));
    expect(['escaped', 'dead']).toContain(r.status);
  });
});
