// 영업일 밸런스 스윕: 봇이 각 영업일을 여러 시드로 플레이하고 실제 수치를 docs/balance-results.md에 기록한다.
// 봇의 결과는 사람의 플레이가 아니며, "통과 가능성"과 부담의 상대 비교 용도다.
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { DAYS } from '../src/data/days';
import { STORE } from '../src/data/store';
import { makeRun, makeBot, runUntilEnded, metaWith } from './helpers';
import { computeResult } from '../src/sim/result';
import type { Furniture, RunState } from '../src/sim/types';

const seat = (id: number, x: number, y: number): Furniture => ({ id, kind: 'seat', x, y });
const decor = (id: number, x: number, y: number): Furniture => ({ id, kind: 'decor', x, y });

interface Row { day: number; seed: number; label: string; arrived: number; rawDemand: number; served: number; leftOrder: number; leftQueue: number; turnedAway: number; closed: number; sales: number; tips: number; income: number; avgWait: number; boardFull: number; ops: string; stars: number }

function play(day: number, seed: number, label: string, opts: { layout?: Furniture[]; speed?: number; bot?: Parameters<typeof makeBot>[0] } = {}): { row: Row; run: RunState } {
  const run = makeRun(day, seed, metaWith({ layout: opts.layout, speed: opts.speed }));
  runUntilEnded(run, makeBot(opts.bot));
  const r = computeResult(run);
  const o = run.stats.ops;
  return { run, row: { day, seed, label, arrived: r.arrived, rawDemand: run.stats.rawDemand, served: r.served, leftOrder: r.leftOrder, leftQueue: r.leftQueue, turnedAway: r.turnedAway, closed: r.closedUnserved, sales: r.sales, tips: r.tips, income: r.income, avgWait: r.avgServiceWait, boardFull: run.stats.boardFullEvents, ops: `${o.spawn}/${o.merge}/${o.accept}`, stars: r.stars } };
}

const fmt = (r: Row) => `| ${r.day} | ${r.seed} | ${r.label} | ${r.arrived} | ${r.rawDemand} | ${r.served} | ${r.leftOrder} | ${r.leftQueue} | ${r.turnedAway} | ${r.closed} | ${r.sales} | ${r.tips} | ${r.income} | ${r.avgWait} | ${r.boardFull} | ${r.ops} | ${r.stars} |`;
const HEAD = '| 일차 | 시드 | 조건 | 도착 | 원료량 | 서빙 | 주문이탈 | 줄이탈 | 만석 | 마감미처리 | 판매 | 팁 | 수입 | 평균서빙대기 | 보드꽉참 | 생성/합성/접수 | 별 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|';

describe('밸런스 스윕', () => {
  it('각 영업일을 봇이 플레이하고 결과를 기록한다', () => {
    const lines: string[] = ['# 밸런스 스윕 결과 (봇 자동 플레이)', '', `생성 시각: ${new Date().toISOString()}`, '', '봇: 0.4초마다 조작 1회. 급한 주문부터 필요한 음식을 만들고 준비되면 접수. 주문이 없으면 계열별 1단계 2개를 재고로 둔다.', '', '## 기본 가게(좌석 2, 장식 0, 속도 0)', '', HEAD];
    const seeds = [1, 2, 3, 4, 5, 6];
    const summary: Record<number, { pass: number; total: number; income: number[]; served: number[] }> = {};
    for (const d of DAYS) {
      summary[d.id] = { pass: 0, total: 0, income: [], served: [] };
      for (const seed of seeds) {
        const { row } = play(d.id, seed, '기본');
        lines.push(fmt(row));
        summary[d.id].total++;
        if (row.served >= d.targetServed) summary[d.id].pass++;
        summary[d.id].income.push(row.income);
        summary[d.id].served.push(row.served);
      }
    }
    lines.push('', '## 요약 (기본 가게)', '', '| 일차 | 목표 서빙 | 통과 | 평균 서빙 | 평균 수입 | 도전 수입 목표 |', '|---|---|---|---|---|---|');
    for (const d of DAYS) {
      const s = summary[d.id];
      const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
      lines.push(`| ${d.id} ${d.name} | ${d.targetServed} | ${s.pass}/${s.total} | ${avg(s.served)} | ${avg(s.income)} | ${d.incomeGoal} |`);
    }
    // 사람 속도 프로필: 초보(1.3초/조작, 주문 읽기 3초), 보통(0.9초, 2초), 빠름(0.6초, 1초) × 기본 가게 / 강화 가게
    const profiles = [
      { name: '초보 1.3s', bot: { actionInterval: 1.3, reactionDelay: 3 } },
      { name: '보통 0.9s', bot: { actionInterval: 0.9, reactionDelay: 2 } },
      { name: '빠름 0.6s', bot: { actionInterval: 0.6, reactionDelay: 1 } },
    ];
    const upgradedNear = [seat(1, 1, 0), seat(2, 0, 2), seat(3, 2, 1), seat(4, 3, 2), decor(5, 1, 1), decor(6, 2, 2)];
    lines.push('', '## 사람 속도 프로필 × 가게 조건 (시드 1~8 평균)', '', '| 가게 | 프로필 | 일차 | 평균 서빙 | 주문이탈 | 줄이탈 | 마감미처리 | 평균 수입 | 도전 목표 | 1별 | 2별 | 3별 |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const lay of [{ name: '기본(좌석2)', layout: undefined as Furniture[] | undefined, speed: 0 }, { name: '강화(좌석4·장식2·속도2·배식구 인접)', layout: upgradedNear, speed: 2 }]) {
      for (const p of profiles) for (const d of DAYS) {
        const N = 8; let served = 0, lo = 0, lq = 0, cl = 0, inc = 0, s1 = 0, s2 = 0, s3 = 0;
        for (let seed = 1; seed <= N; seed++) {
          const run = makeRun(d.id, seed, metaWith({ layout: lay.layout, speed: lay.speed })); runUntilEnded(run, makeBot(p.bot));
          const r = computeResult(run); served += r.served; lo += r.leftOrder; lq += r.leftQueue; cl += r.closedUnserved; inc += r.income; if (r.star1) s1++; if (r.star1 && r.star2) s2++; if (r.star1 && r.star3) s3++;
        }
        lines.push(`| ${lay.name} | ${p.name} | ${d.id} | ${(served / N).toFixed(1)}/${d.customerCount} | ${(lo / N).toFixed(1)} | ${(lq / N).toFixed(1)} | ${(cl / N).toFixed(1)} | ${(inc / N).toFixed(0)} | ${d.incomeGoal} | ${s1}/${N} | ${s2}/${N} | ${s3}/${N} |`);
      }
    }
    // 무조건 최고 단계로 합치는 봇 — 2일차 (낮은 단계를 남겨둘 이유 확인)
    lines.push('', '## 무조건 합치기 vs 낮은 단계 남기기 — 2일차', '', HEAD);
    for (const seed of seeds.slice(0, 4)) { lines.push(fmt(play(2, seed, '무조건합침', { bot: { greedyMerge: true } }).row)); lines.push(fmt(play(2, seed, '남김', {}).row)); }
    // 업그레이드 가게 — 4·5일차
    const upgraded = [seat(1, 1, 0), seat(2, 1, 2), seat(3, 3, 1), seat(4, 3, 3), decor(5, 2, 2), decor(6, 0, 2)];
    lines.push('', '## 업그레이드 가게(좌석 4, 장식 2, 속도 2) — 2·4·5일차', '', HEAD);
    for (const day of [2, 4, 5]) for (const seed of seeds.slice(0, 4)) lines.push(fmt(play(day, seed, '강화', { layout: upgraded, speed: 2 }).row));
    // 배치 비교: 가까운 좌석 vs 먼 좌석 (2일차)
    const near = [seat(1, 1, 0), seat(2, 0, 2)];
    const far = [seat(1, 5, 1), seat(2, 4, 3)];
    lines.push('', '## 배치 비교 — 2일차: 배식구 인접 좌석 vs 먼 좌석', '', HEAD);
    for (const seed of seeds.slice(0, 4)) { lines.push(fmt(play(2, seed, '가까움', { layout: near }).row)); lines.push(fmt(play(2, seed, '멂', { layout: far }).row)); }
    lines.push('', `기본 배치: 배식구 ${JSON.stringify(STORE.kitchen)}, 출입구 ${JSON.stringify(STORE.entrance)}.`);
    mkdirSync('docs', { recursive: true });
    writeFileSync('docs/balance-results.md', lines.join('\n') + '\n');
    // 최소 조건: 기본 가게로 1일차는 봇이 모든 시드에서 통과
    expect(summary[1].pass).toBe(summary[1].total);
  });
});
