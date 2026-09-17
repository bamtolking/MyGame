/**
 * Balance lab: equal-cost skirmishes (single dispatch, fixed rosters) and
 * matchup checks required by the design (swarm vs single heavy, swarm vs AoE,
 * armor vs anti-armor, air vs anti-air, artillery vs flank, dense vs spread).
 * Usage: node --experimental-strip-types tools/balance.ts [repeats=6]
 */
import { Match } from '../src/core/sim/match.ts';
import { unitDef } from '../src/core/data/units.ts';
import { chooseCell } from '../src/core/ai/ai.ts';
import { ROSTER, MAP } from '../src/core/data/balance.ts';
import type { FactionId } from '../src/core/types.ts';

export type Army = { faction: FactionId; units: [string, number][]; layout?: 'dense' | 'spread' | 'top' | 'bottom' | 'cells'; cells?: number[] };

export interface SkirmishResult {
  valueA: number; valueB: number; survA: number; survB: number; survValA: number; survValB: number; t: number; winner: 'A' | 'B' | 'draw';
}

export function armyValue(a: Army): number {
  return a.units.reduce((s, [id, n]) => s + unitDef(id).cost * n, 0);
}

function place(m: Match, pIndex: number, army: Army) {
  const p = m.s.players[pIndex];
  p.credits = 100000;
  p.tech = 3;
  const rng = () => m.rng.next();
  let k = 0;
  for (const [id, n] of army.units) {
    const d = unitDef(id);
    for (let i = 0; i < n; i++) {
      let cell: number;
      if (army.layout === 'cells' && army.cells) cell = army.cells[k++];
      else if (army.layout === 'top') { cell = -1; for (const r of [0, 1, 2]) for (let c = ROSTER.cols - 1; c >= 0 && cell < 0; c--) if (!p.roster[r * ROSTER.cols + c]) cell = r * ROSTER.cols + c; }
      else if (army.layout === 'bottom') { cell = -1; for (const r of [5, 4, 3]) for (let c = ROSTER.cols - 1; c >= 0 && cell < 0; c--) if (!p.roster[r * ROSTER.cols + c]) cell = r * ROSTER.cols + c; }
      else if (army.layout === 'dense') { cell = -1; for (const r of [2, 3]) for (let c = ROSTER.cols - 1; c >= 0 && cell < 0; c--) if (!p.roster[r * ROSTER.cols + c]) cell = r * ROSTER.cols + c; if (cell < 0) cell = chooseCell(p, d, false, rng); }
      else if (army.layout === 'spread') { cell = -1; for (const c of [7, 6, 5, 4, 3]) for (const r of [0, 5, 1, 4, 2, 3]) if (cell < 0 && !p.roster[r * ROSTER.cols + c]) cell = r * ROSTER.cols + c; }
      else cell = chooseCell(p, d, false, rng);
      const r = m.command({ type: 'buy', player: pIndex, unitId: id, cell });
      if (!r.ok) throw new Error(`place failed ${id}: ${r.reason}`);
    }
  }
  p.credits = 0;
}

/** One dispatch each, fight until one side is wiped or maxT. Buildings are pushed away (no turret help). */
export function skirmish(a: Army, b: Army, seed: number, maxT = 80, swap = false): SkirmishResult {
  const A = swap ? b : a;
  const B = swap ? a : b;
  const m = Match.create({
    mode: '1v1', seed, setupSeconds: 0,
    players: [{ faction: A.faction, isHuman: false, ai: 'script' }, { faction: B.faction, isHuman: false, ai: 'script' }],
  });
  // disable building turrets so only unit-vs-unit matters
  for (const bd of m.s.buildings) bd.turret.dmg = 0;
  place(m, 0, A);
  place(m, 1, B);
  m.s.phase = 'countdown';
  m.s.phaseT = 0.01;
  // prevent second dispatch
  for (const p of m.s.players) p.interval = 9999;
  while (!m.s.result && m.s.t < maxT) {
    m.step();
    const c = [0, 0];
    for (const u of m.s.units) c[u.team]++;
    if (m.s.t > 2 && (c[0] === 0 || c[1] === 0)) break;
  }
  const surv = [0, 0], val = [0, 0];
  for (const u of m.s.units) { surv[u.team]++; val[u.team] += unitDef(u.type).cost * (u.hp / u.maxHp); }
  const res: SkirmishResult = {
    valueA: armyValue(A), valueB: armyValue(B), survA: surv[0], survB: surv[1], survValA: val[0], survValB: val[1], t: m.s.t,
    winner: surv[0] > 0 && surv[1] === 0 ? 'A' : surv[1] > 0 && surv[0] === 0 ? 'B' : val[0] > val[1] * 1.15 ? 'A' : val[1] > val[0] * 1.15 ? 'B' : 'draw',
  };
  if (swap) {
    return { valueA: res.valueB, valueB: res.valueA, survA: res.survB, survB: res.survA, survValA: res.survValB, survValB: res.survValA, t: res.t, winner: res.winner === 'A' ? 'B' : res.winner === 'B' ? 'A' : 'draw' };
  }
  return res;
}

export function series(name: string, a: Army, b: Army, repeats = 6, expect?: 'A' | 'B') {
  const rs: SkirmishResult[] = [];
  for (let i = 0; i < repeats; i++) rs.push(skirmish(a, b, 500 + i, 80, i % 2 === 1));
  const wa = rs.filter((r) => r.winner === 'A').length, wb = rs.filter((r) => r.winner === 'B').length;
  const sv = (k: 'survValA' | 'survValB') => Math.round(rs.reduce((s, r) => s + r[k], 0) / rs.length);
  const ok = expect ? (expect === 'A' ? wa > wb : wb > wa) : true;
  console.log(`${ok ? '✔' : '✘'} ${name.padEnd(46)} cost ${armyValue(a)} vs ${armyValue(b)}  A wins ${wa}  B wins ${wb}  draws ${repeats - wa - wb}  survValue A=${sv('survValA')} B=${sv('survValB')}  avgT=${(rs.reduce((s, r) => s + r.t, 0) / rs.length).toFixed(0)}s`);
  return { ok, wa, wb };
}

export const SCENARIOS: { name: string; a: Army; b: Army; expect?: 'A' | 'B' }[] = [
  // swarm vs slow single high damage (same cost 360)
  { name: '물량(돌격6+사수)  vs  단일고화력(관통2)', a: { faction: 'gale', units: [['raiders', 6], ['glider', 1]] }, b: { faction: 'iron', units: [['piercer', 2]] }, expect: 'A' },
  { name: '물량(소총6)  vs  단일고화력(레일1)', a: { faction: 'iron', units: [['rifles', 6], ['shieldwalker', 0]] }, b: { faction: 'gale', units: [['railgun', 1]] }, expect: 'A' },
  // swarm vs AoE
  { name: '물량(돌격7)  vs  광역(분사차3)', a: { faction: 'gale', units: [['raiders', 7]] }, b: { faction: 'iron', units: [['sprayer', 3]] }, expect: 'B' },
  { name: '물량(소총6)  vs  광역(투척3)', a: { faction: 'iron', units: [['rifles', 6]] }, b: { faction: 'gale', units: [['thrower', 3], ['raiders', 1]] }, expect: 'B' },
  // armor vs anti-armor
  { name: '중장갑(방패4)  vs  대장갑(관통2)', a: { faction: 'iron', units: [['shieldwalker', 4]] }, b: { faction: 'iron', units: [['piercer', 2]] }, expect: 'B' },
  { name: '중장갑(방패4+소총)  vs  대장갑(레일1+돌격)', a: { faction: 'iron', units: [['shieldwalker', 4], ['rifles', 1]] }, b: { faction: 'gale', units: [['railgun', 1], ['raiders', 1]] }, expect: 'B' },
  { name: '중장갑(비행정1)  vs  소형화력(소총6)', a: { faction: 'iron', units: [['gunship', 1]] }, b: { faction: 'iron', units: [['rifles', 6]] }, expect: 'A' },
  // air vs anti-air
  { name: '공중(폭격2)  vs  대공없음(방패3+분사2)', a: { faction: 'gale', units: [['bomber', 2]] }, b: { faction: 'iron', units: [['shieldwalker', 3], ['sprayer', 2]] }, expect: 'A' },
  { name: '공중(폭격2)  vs  대공(요격포대2+방패3)', a: { faction: 'gale', units: [['bomber', 2]] }, b: { faction: 'iron', units: [['flak', 2], ['shieldwalker', 3]] }, expect: 'B' },
  { name: '공중(비행정1)  vs  대공(요격날개3)', a: { faction: 'iron', units: [['gunship', 1]] }, b: { faction: 'gale', units: [['interceptor', 3]] }, expect: 'B' },
  { name: '공중(비행정1)  vs  대공없음(돌격6+투척1)', a: { faction: 'iron', units: [['gunship', 1]] }, b: { faction: 'gale', units: [['raiders', 6], ['thrower', 1]] }, expect: 'A' },
  // rear artillery vs flank
  { name: '후방포병(곡사2+방패2)  vs  측면(침투2+돌격5)', a: { faction: 'iron', units: [['howitzer', 2], ['shieldwalker', 2]] }, b: { faction: 'gale', units: [['infiltrator', 2], ['raiders', 6]] }, expect: 'B' },
  { name: '후방포병+측면경계(곡사2+방패2+분사)  vs  측면(침투2+돌격5)', a: { faction: 'iron', units: [['howitzer', 2], ['shieldwalker', 2], ['sprayer', 1]], layout: 'cells', cells: [1, 41, 23, 31, 8] }, b: { faction: 'gale', units: [['infiltrator', 2], ['raiders', 5]] }, expect: 'A' },
  // dense vs spread against AoE
  { name: '밀집(소총8)  vs  광역(투척2+돌격3)', a: { faction: 'iron', units: [['rifles', 8]], layout: 'dense' }, b: { faction: 'gale', units: [['thrower', 2], ['raiders', 5]] }, expect: 'B' },
  { name: '분산(소총8)  vs  광역(투척2+돌격3)', a: { faction: 'iron', units: [['rifles', 8]], layout: 'spread' }, b: { faction: 'gale', units: [['thrower', 2], ['raiders', 5]] } },
  // faction mirror sanity: equal comps
  { name: '거울전(소총4+방패2) 좌우 동일', a: { faction: 'iron', units: [['rifles', 4], ['shieldwalker', 2]] }, b: { faction: 'iron', units: [['rifles', 4], ['shieldwalker', 2]] } },
  { name: '기본 조합 진영전 (철갑 480)  vs  (질풍 480)', a: { faction: 'iron', units: [['rifles', 3], ['shieldwalker', 2], ['sprayer', 1]] }, b: { faction: 'gale', units: [['glider', 3], ['raiders', 3], ['thrower', 1]] } },
  { name: '중급 조합 진영전 (철갑 900)  vs  (질풍 900)', a: { faction: 'iron', units: [['rifles', 4], ['shieldwalker', 2], ['piercer', 1], ['flak', 1], ['howitzer', 1]] }, b: { faction: 'gale', units: [['glider', 4], ['raiders', 4], ['thrower', 1], ['interceptor', 1], ['bomber', 1]] } },
];

const isMain = process.argv[1] && process.argv[1].endsWith('balance.ts');
if (isMain) {
  const repeats = +(process.argv[2] ?? 6);
  let pass = 0, total = 0;
  for (const sc of SCENARIOS) {
    const r = series(sc.name, sc.a, sc.b, repeats, sc.expect);
    if (sc.expect) { total++; if (r.ok) pass++; }
  }
  console.log(`expected matchups: ${pass}/${total} as intended`);
}
