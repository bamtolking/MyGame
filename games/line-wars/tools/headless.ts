/**
 * Headless match runner: AI vs AI over many seeds. Reports win rates, average
 * duration, reasons. Usage:
 *   node --experimental-strip-types tools/headless.ts [games=20] [mode=1v1] [levelA=hard] [levelB=hard] [facA=iron] [facB=gale]
 */
import { Match } from '../src/core/sim/match.ts';
import type { AiLevel, MatchMode } from '../src/core/sim/state.ts';
import type { FactionId } from '../src/core/types.ts';

export interface GameSummary {
  seed: number;
  winner: number;
  reason: string;
  t: number;
  waves: number[];
  econ: number[];
  tech: number[];
  unitsPeak: number;
  msPerTick: number;
  rosters: string[];
}

export function runGame(opts: {
  seed: number; mode: MatchMode; levels: AiLevel[]; factions: FactionId[]; swap?: boolean; maxT?: number; trace?: (m: Match) => void;
}): GameSummary {
  const perTeam = opts.mode === '3v3' ? 3 : 1;
  const players = [];
  for (let i = 0; i < perTeam * 2; i++) {
    const team = i < perTeam ? 0 : 1;
    const src = opts.swap ? 1 - team : team;
    players.push({ faction: opts.factions[src], isHuman: false, ai: opts.levels[src] });
  }
  const m = Match.create({ mode: opts.mode, seed: opts.seed, players, setupSeconds: 2 });
  let peak = 0;
  let ticks = 0;
  const t0 = performance.now();
  const maxT = opts.maxT ?? 16 * 60;
  while (!m.s.result && m.s.t < maxT) {
    m.step();
    ticks++;
    if (m.s.units.length > peak) peak = m.s.units.length;
    if (opts.trace && m.s.phase === 'battle' && m.s.tick % 200 === 0) opts.trace(m);
  }
  const ms = performance.now() - t0;
  const r = m.s.result ?? { winner: -1, reason: 'unfinished', t: m.s.t };
  let winner = r.winner;
  if (opts.swap && winner >= 0) winner = 1 - winner; // report in terms of levels/factions index
  return {
    seed: opts.seed, winner, reason: r.reason, t: r.t,
    waves: m.s.players.map((p) => p.waveCount), econ: m.s.players.map((p) => p.econLevel), tech: m.s.players.map((p) => p.tech),
    unitsPeak: peak, msPerTick: ms / Math.max(1, ticks),
    rosters: m.s.players.map((p) => { const c: Record<string, number> = {}; for (const e of p.roster) if (e) c[e.unitId] = (c[e.unitId] ?? 0) + 1; return Object.entries(c).map(([k, v]) => `${k}:${v}`).join(' '); }),
  };
}

export function summarize(list: GameSummary[], labelA: string, labelB: string) {
  const n = list.length;
  const wA = list.filter((g) => g.winner === 0).length;
  const wB = list.filter((g) => g.winner === 1).length;
  const draws = n - wA - wB;
  const avgT = list.reduce((a, g) => a + g.t, 0) / n;
  const minT = Math.min(...list.map((g) => g.t));
  const maxT = Math.max(...list.map((g) => g.t));
  const reasons: Record<string, number> = {};
  for (const g of list) reasons[g.reason] = (reasons[g.reason] ?? 0) + 1;
  const peak = Math.max(...list.map((g) => g.unitsPeak));
  const ms = list.reduce((a, g) => a + g.msPerTick, 0) / n;
  return {
    games: n, [labelA]: wA, [labelB]: wB, draws, avgMin: +(avgT / 60).toFixed(2), minMin: +(minT / 60).toFixed(2), maxMin: +(maxT / 60).toFixed(2),
    reasons, peakUnits: peak, msPerTick: +ms.toFixed(3),
  };
}

const isMain = process.argv[1] && process.argv[1].endsWith('headless.ts');
if (isMain) {
  const [games = '20', mode = '1v1', la = 'hard', lb = 'hard', fa = 'iron', fb = 'gale'] = process.argv.slice(2);
  const list: GameSummary[] = [];
  for (let i = 0; i < +games; i++) {
    const g = runGame({ seed: 1000 + i, mode: mode as MatchMode, levels: [la as AiLevel, lb as AiLevel], factions: [fa as FactionId, fb as FactionId], swap: i % 2 === 1 });
    list.push(g);
    console.log(`seed ${g.seed} roster=${JSON.stringify(g.rosters)} ${i % 2 ? '(swapped)' : ''} winner=${g.winner} ${g.reason} t=${(g.t / 60).toFixed(1)}m waves=${g.waves} econ=${g.econ} tech=${g.tech} peak=${g.unitsPeak}`);
  }
  console.log(summarize(list, `${la}-${fa}`, `${lb}-${fb}`));
}
