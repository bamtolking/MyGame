// Game state creation, starter templates, serialization.
import type { GameState, SimCache, DayFinance, Prisoner, Needs } from './types';
import { NEED_KEYS } from './types';
import { DEFAULT_REGIME, HOUR_SECONDS } from '../data/regime';
import { START_MONEY, SECURITY_INFO, type SecurityLevel } from '../data/economy';
import { T_GRASS, T_DIRT, T_ROAD, computeSecurity, detectRooms } from './grid';
import { Rng } from './rng';
import { rectStruct, rectZone, placeObjectNow, buildStructNow, hireStaff, zoneIndex, rebuildJobIndex } from './build';
import { SURNAMES, GIVEN, NICKS } from '../data/names';

export const SAVE_VERSION = 1;
export const MAP_W = 44, MAP_H = 44;

export function emptyFinance(day: number): DayFinance { return { day, grant: 0, wages: 0, food: 0, build: 0, work: 0, fines: 0, bonus: 0 }; }
export function makeCache(w: number, h: number): SimCache {
  return { insecure: new Uint8Array(w * h), rooms: [], roomAt: new Int32Array(w * h).fill(-1), dirtyRooms: true, dirtySecurity: true, objIndex: new Map(), prisonerIndex: new Map(), staffIndex: new Map(), jobAt: new Int32Array(w * h).fill(-1), riotCheckT: 0, objectiveT: 0, hourlyT: 0 };
}

export function newGame(seed: number, mode: 'empty' | 'quick' = 'empty'): GameState {
  const rng = new Rng(seed); const w = MAP_W, h = MAP_H;
  const s: GameState = {
    version: SAVE_VERSION, seed, rngState: [], time: 6 * HOUR_SECONDS, phase: 'play', mode,
    w, h, entry: { x: 1, y: Math.floor(h / 2) },
    terrain: new Uint8Array(w * h), struct: new Uint8Array(w * h), zone: new Uint8Array(w * h), objAt: new Int32Array(w * h).fill(-1),
    objects: [], jobs: [], prisoners: [], staff: [], fights: [], nextId: 1,
    money: START_MONEY, reputation: 50, meals: 0, mealCap: 20,
    regime: [...DEFAULT_REGIME], autoIntake: false, intakeMix: { min: true, med: true, max: false }, unlocked: ['min', 'med'],
    chapter: 0, chapterDoneAt: -1, lockdown: false, riot: false, riotSquadUntil: 0,
    finance: { today: emptyFinance(1), history: [] },
    stats: { escapes: 0, deaths: 0, released: 0, riots: 0, fights: 0, workIncome: 0, daysNoIncident: 0, moodDays: 0, todayIncidents: 0, moodSamples: [], intake: 0, subdued: 0 },
    log: [], lastHour: 6, lastIntakeDay: 0, lastDay: 1,
    cache: makeCache(w, h), events: [],
  };
  // terrain: road on the left two columns, grass with dirt patches
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (x <= 1) s.terrain[i] = T_ROAD; else s.terrain[i] = T_GRASS;
  }
  for (let k = 0; k < 14; k++) { const cx = 3 + rng.int(w - 4), cy = rng.int(h), r = 1 + rng.int(3); for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (x >= 2 && x < w && y >= 0 && y < h && rng.chance(0.6)) s.terrain[y * w + x] = T_DIRT; }
  // starting staff: 2 workmen
  hireStaff(s, 'workman', rng, true); hireStaff(s, 'workman', rng, true);
  if (mode === 'quick') buildQuickStart(s, rng);
  s.rngState = rng.getState();
  computeSecurity(s); detectRooms(s); rebuildJobIndex(s);
  return s;
}

/** A small working prison so the player can start with prisoners immediately. Also used by tests. */
export function buildQuickStart(s: GameState, rng: Rng): void {
  const Z = zoneIndex;
  // Outer wall x 6..31, y 8..35; jail door on the west wall facing the road.
  rectStruct(s, 6, 8, 31, 35, 'wall', true, true);
  buildStructNow(s, 6, 21, 'jaildoor');
  // Holding cell: walls 9..17 x 9..15, door west at (9,12). Zone 10..16 x 10..14 (35 tiles).
  rectStruct(s, 9, 9, 17, 15, 'wall', true, true); buildStructNow(s, 9, 12, 'door');
  rectZone(s, 10, 10, 16, 14, Z('holding'));
  placeObjectNow(s, 16, 10, 'toilet'); placeObjectNow(s, 11, 14, 'bench'); placeObjectNow(s, 13, 14, 'bench'); placeObjectNow(s, 15, 14, 'bench'); placeObjectNow(s, 11, 10, 'bed'); placeObjectNow(s, 13, 10, 'bed');
  // Kitchen: walls 19..26 x 8..14, zone 20..25 x 9..13. Door south into the canteen at (22,14).
  rectStruct(s, 19, 8, 26, 14, 'wall', true, true); rectZone(s, 20, 9, 25, 13, Z('kitchen'));
  placeObjectNow(s, 20, 9, 'fridge'); placeObjectNow(s, 21, 9, 'cooker'); placeObjectNow(s, 23, 9, 'cooker');
  // Canteen: walls 19..31 x 14..22, zone 20..30 x 15..21. Door west at (19,18) to the corridor column x=18.
  rectStruct(s, 19, 14, 31, 22, 'wall', true, true); buildStructNow(s, 22, 14, 'door'); buildStructNow(s, 19, 18, 'door');
  rectZone(s, 20, 15, 30, 21, Z('canteen'));
  placeObjectNow(s, 20, 15, 'serving'); placeObjectNow(s, 21, 15, 'serving');
  for (const [x, y] of [[22, 17], [24, 17], [26, 17], [28, 17], [22, 19], [24, 19], [26, 19], [28, 19]]) placeObjectNow(s, x, y, 'table');
  // Cell block: walls 9..17 x 17..27. Corridor column x=13 (y 18..26), entrance door north at (13,17).
  rectStruct(s, 9, 17, 17, 27, 'wall', true, true); buildStructNow(s, 13, 17, 'door');
  for (let y = 18; y <= 26; y++) { buildStructNow(s, 12, y, 'wall'); buildStructNow(s, 14, y, 'wall'); }
  for (const y of [20, 23, 26]) for (const x of [10, 11, 15, 16]) buildStructNow(s, x, y, 'wall');
  for (const y of [18, 21, 24]) {
    buildStructNow(s, 12, y, 'door'); buildStructNow(s, 14, y, 'door');
    rectZone(s, 10, y, 11, y + 1, Z('cell')); placeObjectNow(s, 10, y, 'bed'); placeObjectNow(s, 11, y + 1, 'toilet');
    rectZone(s, 15, y, 16, y + 1, Z('cell')); placeObjectNow(s, 16, y, 'bed'); placeObjectNow(s, 15, y + 1, 'toilet');
  }
  // Shower: walls 19..26 x 23..28, door west at (19,25), zone 20..25 x 24..27.
  rectStruct(s, 19, 23, 26, 28, 'wall', true, true); buildStructNow(s, 19, 25, 'door'); rectZone(s, 20, 24, 25, 27, Z('shower'));
  for (const x of [20, 22, 24]) placeObjectNow(s, x, 24, 'shower');
  // Yard: fence 8..30 x 29..34 with doors at (12,29) and (25,29); zone 9..29 x 30..33.
  rectStruct(s, 8, 29, 30, 34, 'fence', true, true); buildStructNow(s, 12, 29, 'door'); buildStructNow(s, 25, 29, 'door');
  rectZone(s, 9, 30, 29, 33, Z('yard')); placeObjectNow(s, 10, 31, 'bench'); placeObjectNow(s, 20, 33, 'bench'); placeObjectNow(s, 27, 31, 'weights');
  // staff
  hireStaff(s, 'guard', rng, true); hireStaff(s, 'guard', rng, true); hireStaff(s, 'cook', rng, true);
  s.autoIntake = true; s.meals = 12;
}

// ---------- Prisoners ----------
export function prisonerName(rng: Rng): string { const nick = rng.pick(NICKS); return (nick ? `'${nick}' ` : '') + rng.pick(SURNAMES) + rng.pick(GIVEN); }
export function makePrisoner(s: GameState, rng: Rng, sec: SecurityLevel): Prisoner {
  const info = SECURITY_INFO[sec];
  const needs = {} as Needs; for (const k of NEED_KEYS) needs[k] = rng.range(10, 40); needs.safety = 20; needs.freedom = 10;
  const day = Math.floor(s.time / (HOUR_SECONDS * 24)) + 1;
  const p: Prisoner = {
    id: s.nextId++, name: prisonerName(rng), sec, volatility: info.volatility * rng.range(0.8, 1.25), escapist: rng.chance(sec === 'max' ? 0.4 : sec === 'med' ? 0.2 : 0.08),
    x: s.entry.x + 0.5, y: s.entry.y + 0.5 + rng.range(-1.5, 1.5), hp: info.hp, maxHp: info.hp,
    needs, mood: 70, anger: 0, state: 'idle', intent: 'none', stateT: 0, path: null, pathI: 0, target: null, useObj: -1, bedId: -1,
    sentence: 4 + rng.int(sec === 'max' ? 20 : sec === 'med' ? 14 : 9), arrivedDay: day, punishedUntil: 0, injured: false, rioter: false, fightId: -1, thinkT: rng.range(0, 1), lastRoom: -1, calmT: 0, waitT: 0, lastMeal: -1e9, toRoom: -1,
  };
  return p;
}

// ---------- Serialization ----------
const ARRAY_FIELDS = ['terrain', 'struct', 'zone', 'objAt'] as const;
export function serialize(s: GameState): string {
  const o: any = {};
  for (const [k, v] of Object.entries(s)) { if (k === 'cache' || k === 'events') continue; o[k] = v; }
  for (const k of ARRAY_FIELDS) o[k] = Array.from(s[k] as any);
  return JSON.stringify(o);
}
export function deserialize(json: string): GameState {
  const o = JSON.parse(json);
  if (!o || o.version !== SAVE_VERSION) throw new Error(`저장 버전 불일치 (${o?.version} ≠ ${SAVE_VERSION})`);
  if (!Array.isArray(o.terrain) || !Array.isArray(o.prisoners) || typeof o.w !== 'number') throw new Error('저장 데이터 형식 오류');
  const s = o as GameState;
  s.terrain = Uint8Array.from(o.terrain); s.struct = Uint8Array.from(o.struct); s.zone = Uint8Array.from(o.zone); s.objAt = Int32Array.from(o.objAt);
  s.cache = makeCache(s.w, s.h); s.events = [];
  for (const ob of s.objects) s.cache.objIndex.set(ob.id, ob);
  for (const p of s.prisoners) s.cache.prisonerIndex.set(p.id, p);
  for (const st of s.staff) s.cache.staffIndex.set(st.id, st);
  rebuildJobIndex(s); computeSecurity(s); detectRooms(s);
  return s;
}
