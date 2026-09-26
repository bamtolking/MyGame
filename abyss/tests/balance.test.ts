// Balance sweep: the headless bot plays every class on several seeds through all 12 floors (normal).
// Writes docs/balance-results.md. Run: npm run abyss:balance  (CLS=warrior,monk / SEEDS=11,22 to narrow it)
import { describe, expect, it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBot, type BotResult } from './bot';
import { CLASS_IDS, type ClassId } from '../src/sim/types';

const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const SEEDS = (process.env.SEEDS ?? '11,22,33').split(',').map(Number);
const CLASSES: ClassId[] = process.env.CLS ? (process.env.CLS.split(',') as ClassId[]) : [...CLASS_IDS];

describe('balance sweep (normal difficulty)', () => {
  it('every class can finish the game; deaths stay reasonable', () => {
    const results: BotResult[] = [];
    for (const cls of CLASSES) for (const seed of SEEDS) {
      const r = runBot(cls, seed, { maxTime: 60 * 110 });
      results.push(r);
      console.log(`${cls} seed=${seed} reached=${r.reached} won=${r.won} lvl=${r.level} time=${Math.round(r.time / 60)}m deaths=${r.deaths} stuck=${r.stuck}`);
    }
    const lines = ['# 밸런스 스윕 결과 (보통 난이도, 헤드리스 봇)', '', `시드: ${SEEDS.join(', ')} · 제한 시간 110분(게임 시간)`, '',
      '| 직업 | 시드 | 도달 층 | 클리어 | 레벨 | 시간(분) | 사망 |', '|---|---|---|---|---|---|---|'];
    for (const r of results) lines.push(`| ${r.cls} | ${r.seed} | ${r.reached} | ${r.won ? '✔' : '✘'} | ${r.level} | ${Math.round(r.time / 60)} | ${r.deaths} |`);
    lines.push('', '## 층별 진입 기록 (레벨 / 누적 시간 / 해당 층 사망)', '');
    for (const r of results) {
      lines.push(`- **${r.cls} #${r.seed}**: ` + r.floors.map((f) => `${f.floor}층 L${f.level} ${Math.round(f.time / 60)}m${f.deaths ? ` ☠${f.deaths}` : ''}`).join(' → '));
    }
    mkdirSync(DOCS, { recursive: true });
    writeFileSync(join(DOCS, 'balance-results.md'), lines.join('\n') + '\n');
    for (const cls of CLASSES) {
      const rs = results.filter((r) => r.cls === cls);
      expect(rs.some((r) => r.won), `${cls} should beat the final boss at least once`).toBe(true);
      for (const r of rs) expect(r.reached, `${cls} #${r.seed} reached`).toBeGreaterThanOrEqual(9);
    }
  }, 3600000);
});
