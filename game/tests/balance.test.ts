import { describe, it, expect } from 'vitest';
import { runBot, type BotResult, type Strategy } from './bot';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');

const SEEDS = [11, 23, 37];
const lines: string[] = [];
function log(r: BotResult) {
  const l = `| ${r.mapId}/${r.difficulty} | ${r.strategy} | ${r.seed} | ${r.won ? '승리' : '패배'} | ${r.wave} | ${r.life} | ${(r.time / 60).toFixed(1)}분 | ${r.peakGrade} | ${r.units.join(' ')} | ${Object.entries(r.combos).map(([k, v]) => `${k}:${v}`).join(' ')} | w5 ${r.goldAt[5] ?? '-'} · w10 ${r.goldAt[10] ?? '-'} · w15 ${r.goldAt[15] ?? '-'} |`;
  lines.push(l); console.log(l);
}
describe('밸런스 시뮬레이션(봇)', () => {
  it('혼합 조합 봇은 보통 난이도 두 맵에서 승리한다(3 시드)', () => {
    const rs: BotResult[] = [];
    for (const map of ['A', 'B'] as const) for (const seed of SEEDS) { const r = runBot('mixed', seed, map, 'normal'); log(r); rs.push(r); }
    const wins = rs.filter(r => r.won).length;
    expect(wins).toBeGreaterThanOrEqual(5);
    for (const r of rs) if (r.won) { expect(r.time / 60).toBeLessThan(11); }
  });
  it('어려움은 보통보다 더 어렵다(혼합 봇 기준)', () => {
    const rs: BotResult[] = [];
    for (const seed of SEEDS) { const r = runBot('mixed', seed, 'A', 'hard'); log(r); rs.push(r); }
    const n = SEEDS.map(seed => runBot('mixed', seed, 'A', 'normal'));
    const score = (r: BotResult) => (r.won ? 20 + r.life : r.wave);
    const hard = rs.reduce((a, r) => a + score(r), 0), normal = n.reduce((a, r) => a + score(r), 0);
    expect(hard).toBeLessThan(normal);
  });
  it('한 종류만 반복 배치하는 전략이 혼합보다 압도적으로 좋지 않다', () => {
    const monos: Strategy[] = ['mono_laser', 'mono_tesla', 'mono_bomber', 'mono_flame', 'mono_frost', 'engineer_spam', 'random'];
    const mixedLife = SEEDS.map(seed => runBot('mixed', seed, 'A', 'normal')).reduce((a, r) => a + (r.won ? 20 + r.life : r.wave), 0);
    for (const st of monos) { const rs = SEEDS.map(seed => runBot(st, seed, 'A', 'normal')); rs.forEach(log); const sc = rs.reduce((a, r) => a + (r.won ? 20 + r.life : r.wave), 0); expect(sc, st).toBeLessThanOrEqual(mixedLife + 6); }
  });
  it('결과 기록', () => {
    mkdirSync(DOCS, { recursive: true });
    writeFileSync(join(DOCS, 'balance-results.md'), `# 봇 밸런스 시뮬레이션 결과\n\n생성: ${new Date().toISOString()}\n\n| 맵/난이도 | 전략 | 시드 | 결과 | 도달 웨이브 | 남은 체력 | 시간 | 최고 등급 | 최종 유닛 | 연계 | 골드(웨이브 시작) |\n|---|---|---|---|---|---|---|---|---|---|---|\n${lines.join('\n')}\n`);
    expect(lines.length).toBeGreaterThan(0);
  });
});
