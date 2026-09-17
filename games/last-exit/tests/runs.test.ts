// 봇 주행 밸런스 측정: 3 시드 × 경로 A/B/C, 무기 3종, 회피 봇/무회피 봇. 결과는 docs/balance-results.md 에 기록.
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { newRun } from '../src/sim/state';
import { runBot, type Path } from './bot';
import type { WeaponId } from '../src/sim/types';

const SEEDS = [11, 22, 33];
const rows: string[] = [];
const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
function run(seed: number, path: Path, weapon: WeaponId, dodge: boolean, diff: 'normal' | 'hard' = 'normal') {
  const s = newRun({ seed, weapon, difficulty: diff, bagUpgrades: 0, runId: `bal-${seed}-${path}-${weapon}-${dodge}` });
  const log: string[] = []; const r = runBot(s, { path, dodge, log: m => log.push(m), maxTime: 900 });
  const dmg = r.dmg.slice(1, r.zone + 1).map(fmt).join('/'); const loot = r.lootByZone.slice(1, r.zone + 1).join('/'); const tz = r.timeByZone.slice(1, r.zone + 1).map(x => Math.round(x)).join('/');
  rows.push(`| ${seed} | ${path} | ${weapon} | ${dodge ? '회피' : '무회피'} | ${diff} | ${r.status === 'escaped' ? '탈출' : r.status === 'dead' ? `사망(${r.cause})` : r.status} | ${r.zone} | ${r.value} | ${Math.round(r.time)}s | ${tz} | ${dmg} | ${loot} | ${r.maxWeight} | ${r.drops} | ${Object.entries(r.abilities).map(([k, v]) => `${k}${v}`).join(' ')} |`);
  return { r, log };
}

describe('밸런스 주행 (봇)', () => {
  it('경로 A/B/C × 3시드 × 소총 (회피 봇)', () => {
    for (const seed of SEEDS) for (const path of ['A', 'B', 'C'] as Path[]) { const { r } = run(seed, path, 'rifle', true); expect(['escaped', 'dead']).toContain(r.status); }
  });
  it('경로 A/B × 3시드 × 소총 (무회피 봇 = 초보자 근사)', () => {
    for (const seed of SEEDS) for (const path of ['A', 'B'] as Path[]) { const { r } = run(seed, path, 'rifle', false); expect(['escaped', 'dead']).toContain(r.status); }
  });
  it('경로 C × 산탄총·전기 지팡이 (회피 봇)', () => {
    for (const seed of SEEDS) for (const w of ['shotgun', 'staff'] as WeaponId[]) { const { r } = run(seed, 'C', w, true); expect(['escaped', 'dead']).toContain(r.status); }
  });
  it('어려움: 경로 C × 소총 (회피 봇)', () => {
    for (const seed of SEEDS) { const { r } = run(seed, 'C', 'rifle', true, 'hard'); expect(['escaped', 'dead']).toContain(r.status); }
  });
  it('결과 표 기록', () => {
    mkdirSync('docs', { recursive: true });
    const md = ['# 봇 주행 밸런스 결과 (자동 생성)', '', `생성: ${new Date().toISOString()} · 봇은 흐름장으로 이동하고(회피 봇은 예고에 대시) 상자→전리품→금고→탈출/문 순으로 행동합니다. 사람의 재미·조작감 검증이 아니라 수치 범위 확인용입니다.`, '',
      '| 시드 | 경로 | 무기 | 봇 | 난이도 | 결과 | 도달 구역 | 확정 가치 | 총 시간 | 구역별 시간 | 구역별 피해 | 구역별 전리품 가치 | 최대 무게 | 버림 | 능력 |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|', ...rows, ''].join('\n');
    writeFileSync('docs/balance-results.md', md); console.log(md); expect(rows.length).toBeGreaterThan(0);
  });
});
