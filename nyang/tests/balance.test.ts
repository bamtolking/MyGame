// 봇으로 여러 판을 돌려 점수·판 길이·최고 단계 분포를 본다. 결과는 docs/balance-results.md에 쓴다.
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { Game } from '../src/sim/game';
import { CATS } from '../src/data/cats';
import { MODIFIERS } from '../src/data/rules';
import { makeRng } from '../src/sim/rng';
import { chooseX, chooseXSim, maybeUsePower } from '../src/sim/bot';

const DT = 1 / 60;

interface Result { score: number; drops: number; time: number; maxTier: number; maxCombo: number; ascends: number; peakBodies: number; msPerStep: number }

export function playGame(seed: number, mods: string[] = [], opts: { powers?: boolean; revive?: boolean; think?: number; skill?: number; maxTime?: number; sim?: boolean } = {}): Result {
  const g = new Game({ mode: 'classic', seed, mods });
  const rng = makeRng(seed * 31 + 7);
  const think = opts.think ?? 0.35;
  let wait = 0.5;
  let peak = 0;
  let steps = 0;
  const t0 = performance.now();
  const maxTime = opts.maxTime ?? 60 * 60;
  while (g.time < maxTime) {
    g.update(DT); steps++;
    if (g.over) {
      if (opts.revive && !g.revived) { g.revive(); continue; }
      break;
    }
    if (opts.powers) maybeUsePower(g);
    wait -= DT;
    if (wait <= 0 && g.ready) {
      g.aim(opts.sim ? chooseXSim(g, rng) : chooseX(g, rng, opts.skill ?? 1));
      g.drop();
      wait = think;
    }
    peak = Math.max(peak, g.world.bodies.length);
  }
  const ms = (performance.now() - t0) / steps;
  return { score: g.score, drops: g.stats.drops, time: g.time, maxTier: g.stats.maxTier, maxCombo: g.stats.maxCombo, ascends: g.stats.ascends, peakBodies: peak, msPerStep: ms };
}

const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

function summarize(name: string, rs: Result[]): string {
  const sc = rs.map(r => r.score), tm = rs.map(r => r.time / 60), dr = rs.map(r => r.drops);
  const tiers = new Array(CATS.length).fill(0);
  for (const r of rs) tiers[r.maxTier]++;
  const dist = tiers.map((c, i) => c ? `${CATS[i].name} ${c}` : '').filter(Boolean).join(', ');
  return `| ${name} | ${rs.length} | ${Math.round(avg(sc))} | ${pct(sc, 0.1)}–${pct(sc, 0.9)} | ${avg(tm).toFixed(1)}분 | ${Math.round(avg(dr))} | ${avg(rs.map(r => r.maxCombo)).toFixed(1)} | ${dist} | ${Math.max(...rs.map(r => r.peakBodies))} | ${avg(rs.map(r => r.msPerStep)).toFixed(3)} |`;
}

describe('balance sweep', () => {
  it('bot games finish with sane numbers', () => {
    const N = Number(process.env.BALANCE_N || 12);
    const lines: string[] = [];
    lines.push('| 조건 | 판 | 평균 점수 | 10~90% | 평균 시간 | 평균 떨어뜨림 | 평균 최대 콤보 | 최고 단계 분포 | 최대 동시 고양이 | 스텝당 ms |');
    lines.push('|---|---|---|---|---|---|---|---|---|---|');
    const base = Array.from({ length: N }, (_, i) => playGame(1000 + i));
    lines.push(summarize('기본 봇 (능력 없음)', base));
    const full = Array.from({ length: N }, (_, i) => playGame(2000 + i, [], { powers: true, revive: true }));
    lines.push(summarize('능력+집사 찬스 사용', full));
    const strong = Array.from({ length: Math.max(3, N >> 1) }, (_, i) => playGame(5000 + i, [], { sim: true }));
    lines.push(summarize('강한 봇 (1초 앞을 시뮬레이션)', strong));
    const weak = Array.from({ length: N }, (_, i) => playGame(3000 + i, [], { skill: 0.25 }));
    lines.push(summarize('서툰 봇 (무작위에 가까움)', weak));
    for (const m of MODIFIERS) {
      const rs = Array.from({ length: Math.max(4, N >> 1) }, (_, i) => playGame(4000 + i, [m.id]));
      lines.push(summarize(`오늘의 상자: ${m.name}`, rs));
    }
    const out = `# 밸런스 스윕 결과\n\n자동 생성: \`npm run balance\` (봇 ${N}판 기준, 1배속 시간). 봇은 떨어뜨릴 때 0.35초 고민한다.\n\n${lines.join('\n')}\n`;
    mkdirSync('docs', { recursive: true });
    writeFileSync('docs/balance-results.md', out);
    console.log(out);
    // 기본 봇이 너무 빨리 지거나 끝없이 버티면 규칙이 잘못된 것
    expect(avg(base.map(r => r.time))).toBeGreaterThan(60);
    expect(avg(base.map(r => r.time))).toBeLessThan(60 * 40);
    expect(Math.max(...base.map(r => r.msPerStep))).toBeLessThan(4);
  });
});
