// 밸런스 실험. 결과를 docs/packblast-balance.md 에 실제 수치로 기록한다 (미리 정한 결론에 맞추지 않음).
import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { runBattle } from '../../src/packblast/combat/sim';
import { computeLoadout } from '../../src/packblast/core/loadout';
import type { Item } from '../../src/packblast/core/bag';
import type { Rot } from '../../src/packblast/core/shapes';
import { playRun } from './bot';

const mk = (uid: string, id: Item['id'], x: number, y: number, rot: Rot = 0, grade: Item['grade'] = 1): Item => ({ uid, id, grade, rot, x, y, loc: 'bag' });
const SEEDS = [101, 202, 303];
const lines: string[] = ['# 팩 앤 블래스트 밸런스 실험 결과 (자동 생성)', '', `생성 시각: ${new Date().toISOString()}`, '', '모든 수치는 헤드리스 시뮬레이션에서 실제로 측정한 값이다. 봇은 사람보다 단순하게 플레이하므로 사람 기준 난이도는 다를 수 있다.', ''];

describe('A/B/C: 기관총 단독 · +배터리 · +배터리+냉각기 (같은 시드·같은 적)', () => {
  const builds = {
    A: [mk('mg', 'mg', 1, 0), mk('d', 'dagger', 3, 0)],
    B: [mk('mg', 'mg', 1, 0), mk('b', 'battery', 2, 0), mk('d', 'dagger', 3, 0)],
    C: [mk('mg', 'mg', 1, 0), mk('b', 'battery', 2, 0), mk('c', 'cooler', 2, 1), mk('d', 'dagger', 3, 0)],
  };
  for (const stage of [3, 6]) {
    it(`구간 ${stage}`, () => {
      lines.push(`## A/B/C 비교 — 구간 ${stage} (보통)`, '', '| 구성 | 시드 | 승리 | 시간(s) | 남은 HP | 기관총 발사 | 과열 정지(s) | 기관총 피해 | 단검 피해 |', '|---|---|---|---|---|---|---|---|---|');
      const avg: Record<string, { shots: number; oh: number; dmg: number; wins: number }> = {};
      for (const [name, items] of Object.entries(builds)) {
        avg[name] = { shots: 0, oh: 0, dmg: 0, wins: 0 };
        for (const seed of SEEDS) {
          const r = runBattle({ loadout: computeLoadout(items), stage, difficulty: 'normal', seed, hp: 100 });
          const mg = r.result.stats.weapons.mg, d = r.result.stats.weapons.d;
          lines.push(`| ${name} | ${seed} | ${r.result.won ? '○' : '×'} | ${r.result.stats.duration.toFixed(1)} | ${r.result.hpAfter.toFixed(0)} | ${mg.shots} | ${mg.overheatTime.toFixed(1)} | ${mg.damage.toFixed(0)} | ${d.damage.toFixed(0)} |`);
          avg[name].shots += mg.shots / 3; avg[name].oh += mg.overheatTime / 3; avg[name].dmg += mg.damage / 3; avg[name].wins += r.result.won ? 1 : 0;
        }
      }
      lines.push('', `평균: A 발사 ${avg.A.shots.toFixed(0)}·과열 ${avg.A.oh.toFixed(1)}s·피해 ${avg.A.dmg.toFixed(0)} / B 발사 ${avg.B.shots.toFixed(0)}·과열 ${avg.B.oh.toFixed(1)}s·피해 ${avg.B.dmg.toFixed(0)} / C 발사 ${avg.C.shots.toFixed(0)}·과열 ${avg.C.oh.toFixed(1)}s·피해 ${avg.C.dmg.toFixed(0)}`, '');
      expect(avg.C.dmg).toBeGreaterThan(avg.A.dmg);
      expect(avg.C.oh).toBeLessThan(avg.B.oh);
    });
  }
});

describe('적 구성별 무기 효율', () => {
  it('범위 공격이 필요한 구성(군집) vs 단일 대상이 유리한 구성(장갑)', () => {
    const single = [mk('mg', 'mg', 1, 0, 0, 2), mk('b', 'battery', 2, 0), mk('c', 'cooler', 2, 1)];
    const area = [mk('bo', 'bomb', 1, 0, 0, 1), mk('sg', 'shotgun', 0, 3, 0, 1), mk('a', 'ammo', 3, 0)];
    lines.push('## 적 구성별 비교 (보통)', '', '| 구간 | 구성 | 승리 수/3 | 평균 시간(s) | 평균 남은 HP |', '|---|---|---|---|---|');
    const res: Record<string, { wins: number; t: number; hp: number }> = {};
    for (const [label, stage] of [['군집(9)', 9], ['장갑+빠름(10)', 10], ['장갑 정예(4)', 4]] as const) {
      for (const [name, items] of [['단일(기관총+배터리+냉각)', single], ['범위(폭탄+산탄+탄약)', area]] as const) {
        let wins = 0, t = 0, hp = 0;
        for (const seed of SEEDS) { const r = runBattle({ loadout: computeLoadout(items), stage, difficulty: 'normal', seed, hp: 100 }); wins += r.result.won ? 1 : 0; t += r.result.stats.duration / 3; hp += r.result.hpAfter / 3; }
        res[label + name] = { wins, t, hp };
        lines.push(`| ${label} | ${name} | ${wins} | ${t.toFixed(1)} | ${hp.toFixed(0)} |`);
      }
    }
    lines.push('');
    expect(Object.keys(res).length).toBe(6);
  });
});

describe('고정 시드 전체 진행 (봇)', () => {
  it('보통·어려움 각 3판', () => {
    for (const diff of ['normal', 'hard'] as const) {
      lines.push(`## 전체 진행 — ${diff === 'normal' ? '보통' : '어려움'}`, '');
      for (const seed of SEEDS) {
        const r = playRun(seed, diff);
        lines.push(`### 시드 ${seed}: ${r.won ? '승리' : `패배 (구간 ${r.reachedStage})`} · 전투 시간 합계 ${r.totalBattleTime}s · 최종 가방: ${r.finalBag.join(', ')}`, '', '| 구간 | 종류 | 결과 | 시간(s) | HP 전→후 | 무기(+적용 지원) | 과열(s) | 추가탄 | 연쇄 | 충격파 | 강화 |', '|---|---|---|---|---|---|---|---|---|---|---|');
        for (const st of r.stages) lines.push(`| ${st.stage} | ${st.kind} | ${st.won ? '○' : '×'} | ${st.duration} | ${st.hpBefore}→${st.hpAfter} | ${st.weapons} | ${st.overheat} | ${st.extra} | ${st.chains} | ${st.shockwave ? '사용' : ''} | ${st.enraged ? '발동' : ''} |`);
        lines.push('');
        expect(r.stages.length).toBeGreaterThan(0);
      }
    }
    writeFileSync('docs/packblast-balance.md', lines.join('\n'));
  });
});
