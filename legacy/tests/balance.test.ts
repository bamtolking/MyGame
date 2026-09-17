import { describe, it } from 'vitest';
import { runBot, type Policy } from './bot';
import { writeFileSync, mkdirSync } from 'node:fs';

const POLICIES: Policy[] = ['attack', 'control', 'economy', 'fastmerge', 'confirmwait'];
const SEEDS = [11, 22, 33, 44, 55, 66];

describe('balance sweep', () => {
  it('runs all policies over seeds and writes docs/balance-results.md', () => {
    const rows: string[] = [];
    const summary: Record<string, { waves: number[]; wins: number; times: number[]; mythicW: number[] }> = {};
    for (const p of POLICIES) {
      summary[p] = { waves: [], wins: 0, times: [], mythicW: [] };
      for (const seed of SEEDS) {
        const r = runBot(seed, p, { maxTime: 50 * 60 });
        summary[p].waves.push(r.wave); if (r.won) summary[p].wins++; summary[p].times.push(r.time); if (r.firstMythicWave) summary[p].mythicW.push(r.firstMythicWave);
        rows.push(`| ${p} | ${seed} | ${r.won ? '승리' : r.wave} | ${r.life} | ${(r.time / 60).toFixed(1)}분 | ${r.summons} | ${r.merges} | ${r.legends} | ${r.mythics.join(',') || '-'} | ${r.firstMythicWave || '-'} | ${r.firstHeroWave || '-'} |`);
        console.log(p, seed, r.won ? 'WIN' : `W${r.wave}`, `life=${r.life}`, `${(r.time / 60).toFixed(1)}m`, `summons=${r.summons}`, `legends=${r.legends}`, `mythic@${r.firstMythicWave}`, r.mythics.join(','), JSON.stringify(r.lifeLostBy));
      }
    }
    const md = ['# 밸런스 시뮬레이션 결과 (헤드리스 봇, 보통 난이도)', '', `생성 시각: ${new Date().toISOString()}`, '', '| 전략 | 시드 | 도달 | 남은 생명 | 시간 | 소환 | 합성 | 전설 | 신화 | 첫 신화 웨이브 | 첫 영웅 웨이브 |', '|---|---|---|---|---|---|---|---|---|---|---|', ...rows, '', '## 요약', '', '| 전략 | 평균 도달 | 승리 | 평균 시간 | 첫 신화(평균) |', '|---|---|---|---|---|'];
    for (const p of POLICIES) { const s = summary[p]; md.push(`| ${p} | ${(s.waves.reduce((a, b) => a + b, 0) / s.waves.length).toFixed(1)} | ${s.wins}/${SEEDS.length} | ${(s.times.reduce((a, b) => a + b, 0) / s.times.length / 60).toFixed(1)}분 | ${s.mythicW.length ? (s.mythicW.reduce((a, b) => a + b, 0) / s.mythicW.length).toFixed(1) : '-'} (${s.mythicW.length}/${SEEDS.length}회) |`); }
    mkdirSync('docs', { recursive: true });
    writeFileSync('docs/balance-results.md', md.join('\n'));
  });
});
