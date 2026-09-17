// Headless "player" that builds a prison on the empty plot through dispatch, then runs for N days. Used for balance sweeps.
import { newGame } from '../src/sim/state';
import { dispatch, run } from '../src/sim/engine';
import { HOUR_SECONDS } from '../src/data/regime';
import { zoneIndex } from '../src/sim/build';
import type { GameState } from '../src/sim/types';

export function buildPlan(s: GameState): void {
  const Z = zoneIndex;
  // outer wall + jail door
  dispatch(s, { type: 'build', struct: 'wall', x0: 6, y0: 8, x1: 31, y1: 35 });
  dispatch(s, { type: 'cancel', x: 6, y: 21 }); dispatch(s, { type: 'build', struct: 'jaildoor', x0: 6, y0: 21, x1: 6, y1: 21 });
  // holding
  dispatch(s, { type: 'build', struct: 'wall', x0: 9, y0: 9, x1: 17, y1: 15 }); dispatch(s, { type: 'cancel', x: 9, y: 12 }); dispatch(s, { type: 'build', struct: 'door', x0: 9, y0: 12, x1: 9, y1: 12 });
  dispatch(s, { type: 'zone', zone: Z('holding'), x0: 10, y0: 10, x1: 16, y1: 14 });
  dispatch(s, { type: 'object', obj: 'toilet', x0: 16, y0: 10, x1: 16, y1: 10 }); dispatch(s, { type: 'object', obj: 'bench', x0: 11, y0: 14, x1: 15, y1: 14 }); dispatch(s, { type: 'object', obj: 'bed', x0: 11, y0: 10, x1: 14, y1: 10 });
  // kitchen + canteen
  dispatch(s, { type: 'build', struct: 'wall', x0: 19, y0: 8, x1: 26, y1: 14 }); dispatch(s, { type: 'zone', zone: Z('kitchen'), x0: 20, y0: 9, x1: 25, y1: 13 });
  dispatch(s, { type: 'object', obj: 'fridge', x0: 20, y0: 9, x1: 20, y1: 9 }); dispatch(s, { type: 'object', obj: 'cooker', x0: 21, y0: 9, x1: 21, y1: 9 }); dispatch(s, { type: 'object', obj: 'cooker', x0: 23, y0: 9, x1: 23, y1: 9 });
  dispatch(s, { type: 'build', struct: 'wall', x0: 19, y0: 14, x1: 31, y1: 22 }); dispatch(s, { type: 'cancel', x: 22, y: 14 }); dispatch(s, { type: 'build', struct: 'door', x0: 22, y0: 14, x1: 22, y1: 14 }); dispatch(s, { type: 'cancel', x: 19, y: 18 }); dispatch(s, { type: 'build', struct: 'door', x0: 19, y0: 18, x1: 19, y1: 18 });
  dispatch(s, { type: 'zone', zone: Z('canteen'), x0: 20, y0: 15, x1: 30, y1: 21 });
  dispatch(s, { type: 'object', obj: 'serving', x0: 20, y0: 15, x1: 21, y1: 15 }); for (const y of [17, 19]) for (const x of [22, 24, 26, 28]) dispatch(s, { type: 'object', obj: 'table', x0: x, y0: y, x1: x, y1: y });
  // staff
  dispatch(s, { type: 'hire', staff: 'guard' }); dispatch(s, { type: 'hire', staff: 'guard' }); dispatch(s, { type: 'hire', staff: 'cook' }); dispatch(s, { type: 'hire', staff: 'workman' }); dispatch(s, { type: 'hire', staff: 'workman' });
}
export function buildCells(s: GameState): void {
  const Z = zoneIndex;
  dispatch(s, { type: 'build', struct: 'wall', x0: 9, y0: 17, x1: 17, y1: 27 }); dispatch(s, { type: 'cancel', x: 13, y: 17 }); dispatch(s, { type: 'build', struct: 'door', x0: 13, y0: 17, x1: 13, y1: 17 });
  dispatch(s, { type: 'build', struct: 'wall', x0: 12, y0: 18, x1: 12, y1: 26 }); dispatch(s, { type: 'build', struct: 'wall', x0: 14, y0: 18, x1: 14, y1: 26 });
  for (const y of [20, 23, 26]) { dispatch(s, { type: 'build', struct: 'wall', x0: 10, y0: y, x1: 11, y1: y }); dispatch(s, { type: 'build', struct: 'wall', x0: 15, y0: y, x1: 16, y1: y }); }
  for (const y of [18, 21, 24]) {
    dispatch(s, { type: 'cancel', x: 12, y }); dispatch(s, { type: 'build', struct: 'door', x0: 12, y0: y, x1: 12, y1: y }); dispatch(s, { type: 'cancel', x: 14, y }); dispatch(s, { type: 'build', struct: 'door', x0: 14, y0: y, x1: 14, y1: y });
    dispatch(s, { type: 'zone', zone: Z('cell'), x0: 10, y0: y, x1: 11, y1: y + 1 }); dispatch(s, { type: 'object', obj: 'bed', x0: 10, y0: y, x1: 10, y1: y }); dispatch(s, { type: 'object', obj: 'toilet', x0: 11, y0: y + 1, x1: 11, y1: y + 1 });
    dispatch(s, { type: 'zone', zone: Z('cell'), x0: 15, y0: y, x1: 16, y1: y + 1 }); dispatch(s, { type: 'object', obj: 'bed', x0: 16, y0: y, x1: 16, y1: y }); dispatch(s, { type: 'object', obj: 'toilet', x0: 15, y0: y + 1, x1: 15, y1: y + 1 });
  }
  // shower + yard
  dispatch(s, { type: 'build', struct: 'wall', x0: 19, y0: 23, x1: 26, y1: 28 }); dispatch(s, { type: 'cancel', x: 19, y: 25 }); dispatch(s, { type: 'build', struct: 'door', x0: 19, y0: 25, x1: 19, y1: 25 });
  dispatch(s, { type: 'zone', zone: Z('shower'), x0: 20, y0: 24, x1: 25, y1: 27 }); dispatch(s, { type: 'object', obj: 'shower', x0: 20, y0: 24, x1: 24, y1: 24 });
  dispatch(s, { type: 'build', struct: 'fence', x0: 8, y0: 29, x1: 30, y1: 34 }); dispatch(s, { type: 'cancel', x: 12, y: 29 }); dispatch(s, { type: 'build', struct: 'door', x0: 12, y0: 29, x1: 12, y1: 29 });
  dispatch(s, { type: 'zone', zone: Z('yard'), x0: 9, y0: 30, x1: 29, y1: 33 }); dispatch(s, { type: 'object', obj: 'bench', x0: 10, y0: 31, x1: 10, y1: 31 }); dispatch(s, { type: 'object', obj: 'weights', x0: 27, y0: 31, x1: 27, y1: 31 });
}
/** Second cell block east of the main compound (x 31..39), sharing the outer wall; entrance door at (31,22) must be opened separately. */
export function buildCells2(s: GameState): void {
  const Z = zoneIndex;
  dispatch(s, { type: 'build', struct: 'wall', x0: 31, y0: 17, x1: 39, y1: 27 });
  dispatch(s, { type: 'build', struct: 'wall', x0: 34, y0: 18, x1: 34, y1: 26 }); dispatch(s, { type: 'build', struct: 'wall', x0: 36, y0: 18, x1: 36, y1: 26 });
  for (const y of [20, 23, 26]) { dispatch(s, { type: 'build', struct: 'wall', x0: 32, y0: y, x1: 33, y1: y }); dispatch(s, { type: 'build', struct: 'wall', x0: 37, y0: y, x1: 38, y1: y }); }
  for (const y of [18, 21, 24]) {
    dispatch(s, { type: 'cancel', x: 34, y }); dispatch(s, { type: 'build', struct: 'door', x0: 34, y0: y, x1: 34, y1: y }); dispatch(s, { type: 'cancel', x: 36, y }); dispatch(s, { type: 'build', struct: 'door', x0: 36, y0: y, x1: 36, y1: y });
    dispatch(s, { type: 'zone', zone: Z('cell'), x0: 32, y0: y, x1: 33, y1: y + 1 }); dispatch(s, { type: 'object', obj: 'bed', x0: 32, y0: y, x1: 32, y1: y }); dispatch(s, { type: 'object', obj: 'toilet', x0: 33, y0: y + 1, x1: 33, y1: y + 1 });
    dispatch(s, { type: 'zone', zone: Z('cell'), x0: 37, y0: y, x1: 38, y1: y + 1 }); dispatch(s, { type: 'object', obj: 'bed', x0: 38, y0: y, x1: 38, y1: y }); dispatch(s, { type: 'object', obj: 'toilet', x0: 37, y0: y + 1, x1: 37, y1: y + 1 });
  }
}
/** Doors that must replace already-built wall tiles: demolish first, then build the door (handled hourly by the bot loop). */
export const pendingDoors: { x: number; y: number }[] = [];
export function processDoors(s: GameState): void {
  for (const d of [...pendingDoors]) {
    const i = d.y * s.w + d.x; const job = s.jobs.some(j => j.x === d.x && j.y === d.y);
    if (job) continue;
    if (s.struct[i] !== 0) dispatch(s, { type: 'demolish', x0: d.x, y0: d.y, x1: d.x, y1: d.y });
    else { dispatch(s, { type: 'build', struct: 'door', x0: d.x, y0: d.y, x1: d.x, y1: d.y }); pendingDoors.splice(pendingDoors.indexOf(d), 1); }
  }
}
export function buildWelfare(s: GameState): void {
  const Z = zoneIndex;
  // common room + infirmary + workshop on the east side x 27..30 is small; use area right of the cell block: x 27..30? Use south-east: 32..? outside outer wall. Build inside: x 27..30,y 23..28 (common), and extend the outer wall? Keep simple: common 27..30 x 23..28
  // the pocket south of the canteen (27..30 x 23..28) is sealed by the shower, canteen, outer wall and yard fence: open the fence at (28,29) and enter the common room from the south (28,28)
  pendingDoors.push({ x: 28, y: 29 });
  dispatch(s, { type: 'build', struct: 'wall', x0: 27, y0: 23, x1: 31, y1: 28 }); dispatch(s, { type: 'cancel', x: 28, y: 28 }); dispatch(s, { type: 'build', struct: 'door', x0: 28, y0: 28, x1: 28, y1: 28 });
  dispatch(s, { type: 'zone', zone: Z('common'), x0: 28, y0: 24, x1: 30, y1: 27 }); dispatch(s, { type: 'object', obj: 'tv', x0: 28, y0: 24, x1: 28, y1: 24 }); dispatch(s, { type: 'object', obj: 'bench', x0: 29, y0: 26, x1: 30, y1: 26 });
  // infirmary + workshop in the north-west corner x 7..8? too narrow. Use x 7..8,y 9..15 no. Extend: build a new block north of the outer wall? Instead use interior x 7..8 corridor... Keep: infirmary at x 27..30,y 9..13 (east of kitchen: kitchen wall x=26, outer wall x=31 → interior 27..30)
  // the pocket east of the kitchen (27..30 x 9..13) is already walled in; open a door from the canteen (28,14) and use it as the infirmary
  pendingDoors.push({ x: 28, y: 14 });
  dispatch(s, { type: 'zone', zone: Z('infirmary'), x0: 27, y0: 9, x1: 30, y1: 13 }); dispatch(s, { type: 'object', obj: 'medbed', x0: 27, y0: 9, x1: 27, y1: 10 });
  // workshop: south-east inside the compound x 27..30? too small → build a new wing east of the canteen: walls 31..39 x 8..16, door at (31,12) (replaces outer wall)
  dispatch(s, { type: 'build', struct: 'wall', x0: 31, y0: 8, x1: 39, y1: 16 }); pendingDoors.push({ x: 31, y: 12 });
  dispatch(s, { type: 'zone', zone: Z('workshop'), x0: 32, y0: 9, x1: 38, y1: 15 }); dispatch(s, { type: 'object', obj: 'workbench', x0: 33, y0: 10, x1: 33, y1: 10 }); dispatch(s, { type: 'object', obj: 'workbench', x0: 36, y0: 10, x1: 36, y1: 10 }); dispatch(s, { type: 'object', obj: 'workbench', x0: 33, y0: 13, x1: 33, y1: 13 });
  dispatch(s, { type: 'hire', staff: 'doctor' });
}
export interface BotResult { day: number; prisoners: number; money: number; escapes: number; deaths: number; fights: number; riots: number; chapter: number; mood: number; rep: number; phase: string }
export function runBot(seed: number, days: number, opts: { cells?: boolean; welfare?: boolean; guards?: number } = {}): { s: GameState; r: BotResult; trace: string[] } {
  const s = newGame(seed, 'empty'); buildPlan(s); const trace: string[] = [];
  let cellsDone = false, welfareDone = false; pendingDoors.length = 0;
  for (let hr = 0; hr < days * 24; hr++) {
    run(s, HOUR_SECONDS);
    if (hr === 6) { if (opts.cells !== false) { buildCells(s); cellsDone = true; } }
    if (hr === 30 && opts.cells !== false) { buildCells2(s); pendingDoors.push({ x: 31, y: 22 }); }
    if (hr >= 40) processDoors(s);
    if (s.jobs.length === 0 && s.chapter >= 1 && !s.autoIntake) dispatch(s, { type: 'autoIntake', on: true });
    if (opts.welfare && !welfareDone && s.chapter >= 3) { buildWelfare(s); welfareDone = true; }
    // keep staffing proportional
    const guards = s.staff.filter(x => x.type === 'guard' && x.state !== 'leave').length; const want = Math.max(2, Math.ceil(s.prisoners.length / (opts.guards || 5)));
    if (guards < want && s.money > 1000 && hr % 6 === 0) dispatch(s, { type: 'hire', staff: 'guard' });
    const cooks = s.staff.filter(x => x.type === 'cook').length; if (cooks < Math.ceil(s.prisoners.length / 8) && s.money > 1000 && hr % 6 === 0 && cooks < 2) dispatch(s, { type: 'hire', staff: 'cook' });
    if (hr % 24 === 23) { const mood = s.prisoners.length ? s.prisoners.reduce((a, p) => a + p.mood, 0) / s.prisoners.length : 0; trace.push(`d${Math.floor(hr / 24) + 1} n=${s.prisoners.length} $${Math.round(s.money)} mood=${mood.toFixed(0)} esc=${s.stats.escapes} dead=${s.stats.deaths} fights=${s.stats.fights} riots=${s.stats.riots} ch=${s.chapter} rep=${s.reputation} jobs=${s.jobs.length} meals=${s.meals.toFixed(0)} guards=${guards}`); }
    if (s.phase === 'bankrupt' || s.phase === 'fired') break;
  }
  void cellsDone;
  const mood = s.prisoners.length ? s.prisoners.reduce((a, p) => a + p.mood, 0) / s.prisoners.length : 0;
  return { s, r: { day: Math.floor(s.time / HOUR_SECONDS / 24) + 1, prisoners: s.prisoners.length, money: Math.round(s.money), escapes: s.stats.escapes, deaths: s.stats.deaths, fights: s.stats.fights, riots: s.stats.riots, chapter: s.chapter, mood: Math.round(mood), rep: s.reputation, phase: s.phase }, trace };
}
