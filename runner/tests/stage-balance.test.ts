// 골목 지도 balance sweep (GDD §8.2 · §13.4). The casual bot — tests/bot.ts playRun with jitter 9 / pad 2, the same
// setting as the endless sweep — plays every stage once per seed (30 seeds = 30 "first tries"):
//  - ★1: its first-try clear rate sits on the world ramp (W1 95→85 %, W2 85→70 %, W3 75→55 %, remix ≥ 40 %);
//  - ★2: `stars.jellyPct` is the recommendation = p55 of the star-candy % over its clears, rounded DOWN to a multiple
//        of 5 and clamped to 60–90 (a failing assertion prints the value to paste into src/data/stages.ts);
//  - ★3: every golden pouch the stage places is off the lazy line — the casual bot, which never detours for pickups,
//        misses each one at least sometimes (one it never brushes past is fine: stages.test.ts proves it reachable).
//        A set piece's own 'B' glyph belongs to the chunk; if the lazy line crosses it, that is reported, not failed.
// Results → docs/stages.md (the stage table).
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { STAGES, type StageDef } from '../src/data/stages';
import { PARSED_BY_ID, resolveCourse } from '../src/sim/level';
import { SPEED_TIERS, TILE, PX_PER_M } from '../src/data/physics';
import { newRun, stepRun, type RunConfig } from '../src/sim/run';
import { Autopilot } from '../src/sim/autopilot';
import { playRun } from './bot';

const CASUAL = { jitter: 9, pad: 2 };
const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);
const cfgOf = (st: StageDef): RunConfig => ({ mode: 'stage', seed: st.seed, charId: 'hotteok', stageId: st.id, noCountdown: true });

/** First-try ★1 target (%) from the GDD ramp: linear over stages 1..6 of each world; remix only has a floor. */
const RAMP: Record<number, [number, number]> = { 1: [95, 85], 2: [85, 70], 3: [75, 55] };
export function clearTarget(st: StageDef): number {
  if (st.remix) return 40;
  const [a, b] = RAMP[st.world]; return a + (b - a) * (st.index - 1) / 5;
}
/** How far a measured rate may sit from its ramp point (30 seeds ≈ 3.3 % per run; the course is chaotic under the
 *  bot's timing noise, so a ramp point is hit as a band, not exactly). */
const CLEAR_TOL = 10;

/** p-th percentile with linear interpolation (p in 0..1). */
function percentile(xs: number[], p: number): number {
  const a = xs.slice().sort((x, y) => x - y); if (!a.length) return 0;
  const i = (a.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i);
  return a[lo] + (a[hi] - a[lo]) * (i - lo);
}
/** ★2 recommendation: casual p55 of jelly % on clears → multiple of 5 below → 60..90. */
export function recommendStar2(pcts: number[]): number {
  return Math.max(60, Math.min(90, Math.floor(percentile(pcts, 0.55) / 5) * 5));
}

interface Pouch { label: string; x: number; y: number; glyph: boolean }   // chunk-local cell of course slot `slot`
/** The stage's three pouches in order: setpiece 'B' glyphs and `pouches` defs, each with its course slot. */
function pouchesOf(st: StageDef): (Pouch & { slot: number })[] {
  const course = resolveCourse(st)!; const out: (Pouch & { slot: number })[] = [];
  course.forEach((id, slot) => {
    const p = PARSED_BY_ID.get(id)!;
    for (const k of p.pickups.filter(k => k.kind === 'slotB')) out.push({ label: `${id} B`, slot, x: k.x, y: k.y, glyph: true });
  });
  (st.pouches ?? []).forEach(q => out.push({ label: `${course[q.slot]} ${q.col},${q.row}`, slot: q.slot, x: q.col * TILE + TILE / 2, y: q.row * TILE + TILE / 2, glyph: false }));
  return out.sort((a, b) => a.slot - b.slot || a.x - b.x);
}

interface CasualRun { clear: boolean; jellyPct: number; got: Set<string> }
/** playRun, step for step (same Autopilot, same loop), additionally recording which pouches were taken — keyed by
 *  course slot and chunk-local cell, so bonus-time teleports (which re-place the course further on) do not matter. */
function casualRun(st: StageDef, seed: number): CasualRun {
  const s = newRun(cfgOf(st));
  const ap = new Autopilot({ jitter: CASUAL.jitter, pad: CASUAL.pad, seed, lookTiles: 12 });
  const got = new Set<string>();
  while (s.phase !== 'over' && s.phase !== 'clear' && s.t < 900) {
    stepRun(s, ap.next(s));
    for (const e of s.events) {
      if (e.t !== 'pickup' || e.type !== 'pouch') continue;
      const c = s.level.chunks.find(c => c.main && e.x >= c.x && e.x < c.x + c.width);
      if (c) got.add(pouchKey(c.index, e.x - c.x, e.y));
    }
    s.events.length = 0;
  }
  const st2 = s.stats;
  return { clear: s.phase === 'clear', jellyPct: st2.jelliesSeen ? Math.round(100 * st2.jellies / st2.jelliesSeen) : 0, got };
}
const pouchKey = (slot: number, x: number, y: number) => `${slot}:${Math.round(x)},${Math.round(y)}`;

interface StageReport { st: StageDef; m: number; secs: number; clear: number; p55: number; star2: number; pouchPct: number[]; pouchLabels: string[]; pouchGlyph: boolean[] }
function measure(st: StageDef): StageReport {
  const course = resolveCourse(st)!;
  const total = course.reduce((a, id) => a + PARSED_BY_ID.get(id)!.width, 0) / PX_PER_M;
  let m = 0, secs = 0;
  for (const id of course) {
    const p = PARSED_BY_ID.get(id)!; const f = Math.min(1, m / total);
    const tier = Math.round(st.tiers[0] + (st.tiers[1] - st.tiers[0]) * f); const t = Math.max(p.def.tiers[0], Math.min(p.def.tiers[1], tier));
    secs += p.width / SPEED_TIERS[t]; m += p.width / PX_PER_M;
  }
  const pouches = pouchesOf(st);
  const runs = SEEDS.map(seed => casualRun(st, seed));
  const clears = runs.filter(r => r.clear);
  const p55 = percentile(clears.map(r => r.jellyPct), 0.55);
  const pouchPct = pouches.map(q => {
    const key = pouchKey(q.slot, q.x, q.y);
    return Math.round(100 * runs.filter(r => r.got.has(key)).length / runs.length);
  });
  return { st, m: Math.round(total), secs, clear: Math.round(100 * clears.length / runs.length), p55, star2: recommendStar2(clears.map(r => r.jellyPct)), pouchPct, pouchLabels: pouches.map(q => q.label), pouchGlyph: pouches.map(q => q.glyph) };
}

const reports: StageReport[] = [];

describe('stage balance (casual bot, 30 first tries per stage)', () => {
  it('the mirrored casual loop is playRun exactly', () => {
    const st = STAGES[0];
    for (const seed of [1, 2]) {
      const a = playRun(cfgOf(st), { ...CASUAL, seed }).r; const b = casualRun(st, seed);
      expect(b.clear).toBe(a.phase === 'clear'); expect(b.jellyPct).toBe(a.jellyPct);
    }
  });

  for (const world of [1, 2, 3]) {
    it(`world ${world}: first-try ★1 rates on the ramp, ★2 = casual p55, pouches off the lazy line`, () => {
      const fails: string[] = []; const notes: string[] = [];
      for (const st of STAGES.filter(s => s.world === world)) {
        const r = measure(st); reports.push(r);
        const tgt = clearTarget(st);
        if (st.remix ? r.clear < tgt : Math.abs(r.clear - tgt) > CLEAR_TOL) fails.push(`${st.id}: first-try clear ${r.clear}% vs target ${st.remix ? '≥ ' : ''}${tgt}%`);
        if (st.stars.jellyPct !== r.star2) fails.push(`${st.id}: stars.jellyPct ${st.stars.jellyPct} — recommended ${r.star2} (casual p55 ${r.p55.toFixed(1)}%)`);
        r.pouchPct.forEach((pc, i) => {
          if (pc < 100) return;
          const msg = `${st.id}: pouch ${i + 1} (${r.pouchLabels[i]}) is on the lazy line (casual bot takes it every time)`;
          // a set piece's own 'B' glyph is placed by the chunk, not by the stage: reported, not failed
          if (r.pouchGlyph[i]) notes.push(msg); else fails.push(msg);
        });
        console.log(`${st.id.padEnd(4)} ${String(r.m).padStart(5)} m ${r.secs.toFixed(0).padStart(3)} s  ★1 ${String(r.clear).padStart(3)}% (target ${st.remix ? '≥' : ''}${Math.round(tgt)})  ★2 ${r.star2}% (p55 ${r.p55.toFixed(1)})  pouches ${r.pouchPct.map((p, i) => `${p}% ${r.pouchLabels[i]}`).join(' · ')}`);
      }
      if (notes.length) console.warn(notes.join('\n'));
      expect(fails).toEqual([]);
    }, 180_000);
  }

  it('writes docs/stages.md', () => {
    const rows = reports.sort((a, b) => STAGES.indexOf(a.st) - STAGES.indexOf(b.st)).map(r => {
      const st = r.st; const tgt = clearTarget(st);
      return `| ${st.id} | ${st.name} | ${st.intro} | ${st.biome} | ${r.m} | ${st.tiers[0]}–${st.tiers[1]} | ${r.secs.toFixed(0)} | ${r.clear}% (${st.remix ? '≥' : ''}${Math.round(tgt)}) | ${st.stars.jellyPct}% | ${r.pouchPct.map((p, i) => `${p}% ${r.pouchLabels[i]}`).join(' · ')} |`;
    });
    const md = [
      '# 골목 지도 스테이지 표 (자동 생성: `npx vitest run tests/stage-balance.test.ts`)',
      '',
      '캐주얼 봇(`tests/bot.ts` playRun, 흔들림 9프레임 / 판정 여유 2px)이 스테이지마다 시드 30개로 한 번씩 달린 결과입니다.',
      '',
      '- **첫 시도 ★1**: 결승까지 간 비율. 괄호는 GDD 목표(W1 95→85 %, W2 85→70 %, W3 75→55 %, 리믹스 40 % 이상).',
      '- **★2**: 별사탕 비율 기준. 완주한 판들의 p55를 5 단위로 내리고 60–90으로 묶은 값.',
      '- **복주머니**: 코스 순서대로 `청크 열,행`(세트피스 안의 것은 `B`). 스테이지마다 높은 길(발판·2단 점프 정점), 위험한 줄(위험물 사이의 낮은 줄), 계획형(일찍 보이고 길을 골라야 하는 것)이 하나씩 있습니다.',
      '  캐주얼 봇은 일부러 먹으러 가지 않으므로 이 값은 "게으른 길에서 저절로 먹히는 비율"입니다(목표 약 70 / 50 / 40 %). 판이 일찍 끝나면 뒤쪽 복주머니는 못 먹은 것으로 셉니다.',
      '- 코스는 고정입니다(`src/data/stages.ts`). 모든 스테이지는 `landing`으로 시작해 `finish_runout`으로 끝납니다.',
      '',
      '| id | 이름 | 소개 | 풍경 | 길이(m) | 티어 | 시간(s) | 첫 시도 ★1 | ★2 | 복주머니 (캐주얼 봇 획득률 · 위치) |',
      '|---|---|---|---|---:|---|---:|---:|---:|---|',
      ...rows, '',
    ].join('\n');
    try { mkdirSync('docs', { recursive: true }); writeFileSync('docs/stages.md', md); } catch { /* ignore */ }
    expect(reports.length).toBe(STAGES.length);
  });
});
