import { MISSIONS } from '../src/data/missions';
import { compileMap } from '../src/sim/maps';
import { createAttempt, runAttempt } from '../src/sim/engine';
import { makeBot, type BotScript } from '../src/sim/bot';
import type { AttemptState, GameEvent, MapData, MissionDef, Recording } from '../src/sim/types';
import type { WeaponId } from '../src/sim/constants';

export const mapOf = (id: string): MapData => { const d = MISSIONS.find((m) => m.id === id); if (!d) throw new Error('no mission ' + id); return compileMap(d); };

export interface RunResult { st: AttemptState; events: { tick: number; ev: GameEvent }[]; rec: Recording }
export function runScript(map: MapData, script: BotScript, ghosts: (Recording | null)[] = [], opts: { seed?: number; seconds?: number } = {}): RunResult {
  const bot = makeBot(map, script);
  const st = createAttempt(map, { weapon: script.weapon, ghosts, seed: opts.seed, seconds: opts.seconds });
  const events: { tick: number; ev: GameEvent }[] = [];
  runAttempt(st, (_, s) => bot.input(s), (evs, tick) => { for (const ev of evs) events.push({ tick, ev }); });
  return { st, events, rec: st.recording };
}
export const findEv = <K extends GameEvent['kind']>(r: RunResult, kind: K): { tick: number; ev: Extract<GameEvent, { kind: K }> }[] => r.events.filter((e) => e.ev.kind === kind) as { tick: number; ev: Extract<GameEvent, { kind: K }> }[];

/** A tiny synthetic map for focused engine tests. */
export function syntheticMap(over: Partial<MissionDef> = {}): MapData {
  const def: MissionDef = {
    id: 'syn', index: 0, title: 'synthetic', subtitle: '', version: 1, seed: 7, seconds: 10,
    grid: [
      '###########',
      '#.........#',
      '#.........#',
      '#.........#',
      '#....#....#',
      '#....#....#',
      '#....#....#',
      '#.........#',
      '#.........#',
      '#.........#',
      '###########',
    ],
    spawn: [2, 8], exit: [2, 8], generators: [], lasers: [], plates: [], vault: { at: [8, 1], plates: [], generators: [] }, enemies: [], hints: [],
    ...over,
  };
  return compileMap(def);
}

/** Hand-crafted recording: stand at (x,y) for `ticks`, fire `shots`. */
export function craftRecording(map: MapData, weapon: WeaponId, x: number, y: number, ticks: number, shots: Recording['shots'], endKind: Recording['endKind'] = 'finish', path?: { x: number; y: number }[]): Recording {
  const pos: number[] = []; const face: number[] = [];
  for (let i = 0; i < ticks; i++) {
    const p = path ? path[Math.min(i, path.length - 1)] : { x, y };
    pos.push(Math.round(p.x * 10), Math.round(p.y * 10)); face.push(0);
  }
  return { v: 1, mapId: map.def.id, mapVersion: map.def.version, weapon, endKind, endTick: ticks, pos, face, shots, dashes: [], createdAt: 0 };
}

// Reference scripts for mission 1 (also used by the e2e script).
export const SCRIPT_A: BotScript = { weapon: 'rifle', steps: [{ to: [1, 3], dash: true }, { interact: true, until: { generatorDead: 'g1', max: 12 } }, { to: [10, 1], dash: true }, { to: [6, 24], dash: true }] };
export const SCRIPT_B: BotScript = { weapon: 'rifle', steps: [{ to: [10, 13], dash: true }, { until: { laserOff: 'l1', max: 30 } }, { to: [10, 1], dash: true }, { until: { hasCore: true, max: 3 } }, { to: [6, 24], dash: true }] };
