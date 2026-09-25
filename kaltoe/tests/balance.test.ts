// 밸런스 스윕: 스테이지 × 복지 투자 단계 × 시드로 봇을 돌려 docs/balance-results.md를 만든다.
// 봇은 '반응은 빠르지만 길찾기는 단순한 플레이어'라서 사람보다 회피는 잘하고 전략은 평범하다.
import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { META_UPGRADES, BALANCE } from '../src/content';
import type { StatBlock, StatKey } from '../src/content/types';
import { runBot, type BotResult } from './bot';

/** 코인 예산으로 복지를 '가장 싼 다음 단계부터' 구매했을 때의 스탯 */
export function metaFor(budget: number): { stats: StatBlock; spent: number } {
  const ranks: Record<string, number> = {};
  let left = budget, spent = 0;
  for (;;) {
    let best: { id: string; cost: number } | null = null;
    for (const m of META_UPGRADES) {
      const r = ranks[m.id] ?? 0;
      if (r >= m.maxRank) continue;
      if (m.stat === 'curse') continue;
      const c = m.baseCost + m.costStep * r;
      if (c <= left && (!best || c < best.cost)) best = { id: m.id, cost: c };
    }
    if (!best) break;
    ranks[best.id] = (ranks[best.id] ?? 0) + 1;
    left -= best.cost; spent += best.cost;
  }
  const stats: Partial<Record<StatKey, number>> = {};
  for (const m of META_UPGRADES) {
    const r = ranks[m.id] ?? 0;
    if (r) stats[m.stat] = (stats[m.stat] ?? 0) + m.perRank * r;
  }
  return { stats, spent };
}

interface Row { stage: string; tier: string; budget: number; mode: string; runs: BotResult[] }

const PLAN: { stage: string; budgets: number[] }[] = [
  { stage: 'office', budgets: [0, 1500] },
  { stage: 'crunch', budgets: [3000, 6000] },
  { stage: 'dinner', budgets: [10000, 18000] },
  { stage: 'holiday', budgets: [20000, 30000] },
];
const SEEDS = [101, 202, 303, 404, 505, 606, 707, 808];

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmt = (n: number, d = 0) => n.toFixed(d);

describe('밸런스 스윕', () => {
  it('스테이지·투자 단계별 봇 결과', () => {
    const rows: Row[] = [];
    for (const p of PLAN) {
      for (const b of p.budgets) {
        const { stats } = metaFor(b);
        for (const mode of ['사람형', '고수형']) {
          const runs = SEEDS.map(seed => runBot({ stage: p.stage, seed, meta: stats, maxSeconds: BALANCE.runSeconds + 40, human: mode === '사람형' }));
          rows.push({ stage: p.stage, tier: `₩${b.toLocaleString('en-US')}`, budget: b, mode, runs });
        }
      }
    }
    const lines: string[] = [];
    lines.push('# 밸런스 스윕 결과 (헤드리스 봇)');
    lines.push('');
    lines.push(`스테이지 × 복지 투자액 × 봇 2종 × 시드 ${SEEDS.length}개. 고수형 = 3프레임마다 넓은 시야로 회피(탄도 피함). 사람형 = 0.2초 반응, 좁은 시야, 탄 회피 없음, 판단 흔들림. 선택은 둘 다 무난한 휴리스틱(시작 무기 우선, 진화 짝 패시브 선호). \`npm run balance\`로 재생성.`);
    lines.push('');
    lines.push('| 스테이지 | 복지 투자 | 봇 | 칼퇴율 | 평균 생존 | Lv@12시 | Lv@15시 | Lv@18시 | 평균 처치 | 평균 월급 | 첫 진화(초) | 최대 동시 적 | 사망 원인 |');
    lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const r of rows) {
      const cl = r.runs.filter(x => x.cleared).length;
      const lv = (h: number) => fmt(avg(r.runs.map(x => x.levelAt[h]).filter((x): x is number => x !== undefined)), 1);
      const evo = r.runs.map(x => x.firstEvolveAt).filter((x): x is number => x !== null);
      const causes = r.runs.filter(x => x.killedBy).map(x => `${x.killedBy}@${fmt(x.t)}`).join(', ');
      lines.push(`| ${r.stage} | ${r.tier} | ${r.mode} | ${cl}/${r.runs.length} | ${fmt(avg(r.runs.map(x => Math.min(x.t, BALANCE.runSeconds))))}s | ${lv(12)} | ${lv(15)} | ${lv(18)} | ${fmt(avg(r.runs.map(x => x.kills)))} | ${fmt(avg(r.runs.map(x => x.coins)))} | ${evo.length ? fmt(avg(evo)) : '-'} (${evo.length}/${r.runs.length}) | ${fmt(avg(r.runs.map(x => x.maxEnemies)))} | ${causes || '-'} |`);
    }
    lines.push('');
    lines.push('## 판별 상세');
    for (const r of rows) {
      lines.push(`### ${r.stage} ${r.tier} ${r.mode}`);
      for (const x of r.runs) {
        lines.push(`- ${x.cleared ? '칼퇴' : '사망'} ${fmt(x.t)}s Lv${x.level} 처치 ${x.kills} 받은피해 ${x.dmgTaken} 궁 ${x.ultUses} 상자 ${x.chests} 진화 [${x.evolves.join(', ')}] 보스 [${x.bossKills.join(', ')}] 무기 [${x.weapons.join(' ')}] 패시브 [${x.passives.join(' ')}] ${x.stepsMsAvg.toFixed(3)}ms/step`);
      }
    }
    writeFileSync(new URL('../docs/balance-results.md', import.meta.url), lines.join('\n') + '\n');
    // 느슨한 안전장치: 첫 스테이지 무투자에서 너무 빨리 죽지 않고, 판 진행이 가능해야 한다
    const office0 = rows[0];
    expect(avg(office0.runs.map(x => x.t))).toBeGreaterThan(150);
    for (const r of rows) for (const x of r.runs) expect(x.stepsMsAvg).toBeLessThan(3);
  });
});
