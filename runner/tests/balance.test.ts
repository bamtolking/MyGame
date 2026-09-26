// Balance sweep: planner bots with human-like reaction jitter play the real endless stream; results → docs/balance-results.md.
// Targets (median run time): novice 60–100 s · casual 100–170 s · good 150–260 s · expert ≥ 240 s but always ends (≤ cap).
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { playRun, type BotResult } from './bot';
import { CHARACTERS } from '../src/data/characters';
import { RUN_CAP_T } from '../src/data/tuning';

const PROFILES = [
  { key: 'expert', jitter: 0, pad: 4 },
  { key: 'good', jitter: 5, pad: 3 },
  { key: 'casual', jitter: 9, pad: 2 },
  { key: 'novice', jitter: 14, pad: 1 },
];
const SEEDS = [11, 22, 33, 44, 55, 66, 77, 88];
const med = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b.length ? (b[(b.length - 1) >> 1] + b[b.length >> 1]) / 2 : 0; };
const lines: string[] = [];

describe('balance sweep', () => {
  it('skill profiles → run length, causes, pickups', () => {
    lines.push('## 숙련도별 무한 질주 (기본 캐릭터, 시드 8개)', '', '| 봇 | 반응 흔들림 | 중앙 시간(s) | 범위(s) | 중앙 거리(m) | 중앙 점수 | 피격/분 | 낙하/분 | 물약/분 | 보너스/판 | 사망 원인 |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
    const medT: Record<string, number> = {};
    for (const pr of PROFILES) {
      const rs: BotResult[] = SEEDS.map(seed => playRun({ mode: 'endless', seed, charId: CHARACTERS[0].id }, { jitter: pr.jitter, pad: pr.pad, seed }).r);
      const T = rs.map(r => r.t); medT[pr.key] = med(T);
      const perMin = (k: keyof BotResult) => (rs.reduce((a, r) => a + (r[k] as number), 0) / rs.reduce((a, r) => a + r.t, 0) * 60).toFixed(1);
      const causes: Record<string, number> = {}; for (const r of rs) causes[r.cause ?? '?'] = (causes[r.cause ?? '?'] || 0) + 1;
      lines.push(`| ${pr.key} | ${pr.jitter}f | ${med(T).toFixed(0)} | ${Math.min(...T).toFixed(0)}–${Math.max(...T).toFixed(0)} | ${med(rs.map(r => r.dist)).toFixed(0)} | ${med(rs.map(r => r.score)).toFixed(0)} | ${perMin('hits')} | ${perMin('falls')} | ${perMin('potions')} | ${(rs.reduce((a, r) => a + r.bonus, 0) / rs.length).toFixed(1)} | ${Object.entries(causes).map(([k, v]) => `${k}×${v}`).join(' ')} |`);
      for (const r of rs) expect(r.t).toBeLessThanOrEqual(RUN_CAP_T + 1);
    }
    lines.push('');
    // ordering sanity: more skill → longer runs
    expect(medT.expert).toBeGreaterThanOrEqual(medT.good);
    expect(medT.good).toBeGreaterThanOrEqual(medT.casual * 0.9);
    expect(medT.casual).toBeGreaterThanOrEqual(medT.novice * 0.9);
  });

  it('characters are sidegrades: median score per character (good bot)', () => {
    lines.push('## 캐릭터별 (good 봇, 시드 8개)', '', '| 캐릭터 | 중앙 시간(s) | 중앙 거리(m) | 중앙 점수 | 기준 대비 |', '|---|---:|---:|---:|---:|');
    let base = 0;
    for (const c of CHARACTERS) {
      const rs = SEEDS.map(seed => playRun({ mode: 'endless', seed, charId: c.id }, { jitter: 5, pad: 3, seed }).r);
      const sc = med(rs.map(r => r.score)); if (!base) base = sc;
      lines.push(`| ${c.name} | ${med(rs.map(r => r.t)).toFixed(0)} | ${med(rs.map(r => r.dist)).toFixed(0)} | ${sc.toFixed(0)} | ${((sc / base - 1) * 100).toFixed(0)}% |`);
    }
    lines.push('');
    mkdirSync('docs', { recursive: true });
    writeFileSync('docs/balance-results.md', '# 밸런스 스윕 결과 (자동 생성: `npm run balance`)\n\n봇은 공정성 검증기와 같은 탐색기로 길을 찾고, 점프 입력을 0~N프레임 늦게 눌러 사람의 반응 오차를 흉내 냅니다. 봇은 물약은 노리지만 젤리는 일부러 쫓지 않으므로 점수는 사람보다 낮게 나옵니다.\n\n' + lines.join('\n'));
  });
});
