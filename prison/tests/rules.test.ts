import { describe, it, expect } from 'vitest';
import { newGame, serialize, deserialize } from '../src/sim/state';
import { dispatch, run, step } from '../src/sim/engine';
import { HOUR_SECONDS, DEFAULT_REGIME } from '../src/data/regime';
import { computeSecurity, detectRooms, isInsecure, findPath, findEscapePath, validRooms, roomOf, passable } from '../src/sim/grid';
import { buildStructNow, placeObjectNow, rectStruct, rectZone, zoneIndex, planStruct } from '../src/sim/build';
import { capacity } from '../src/sim/economy';
import { makePrisoner, buildQuickStart } from '../src/sim/state';
import { Rng } from '../src/sim/rng';
import { tryEscape, computeMood } from '../src/sim/prisoner';
import { STRUCTS } from '../src/data/structures';
import { OBJECTS } from '../src/data/objects';
import { ROOMS } from '../src/data/rooms';
import { NEED_KEYS } from '../src/sim/types';

describe('security flood fill', () => {
  it('open map is insecure everywhere; walled box is secure; regular door leaks; jail door holds', () => {
    const s = newGame(1, 'empty');
    expect(isInsecure(s, 20, 20)).toBe(true);
    rectStruct(s, 10, 10, 20, 20, 'wall', true, true); computeSecurity(s);
    expect(isInsecure(s, 15, 15)).toBe(false); expect(isInsecure(s, 5, 5)).toBe(true);
    buildStructNow(s, 10, 15, 'door'); computeSecurity(s); expect(isInsecure(s, 15, 15)).toBe(true);
    buildStructNow(s, 10, 15, 'jaildoor'); computeSecurity(s); expect(isInsecure(s, 15, 15)).toBe(false);
    // fence also secures
    rectStruct(s, 25, 25, 30, 30, 'fence', true, true); computeSecurity(s); expect(isInsecure(s, 27, 27)).toBe(false);
  });
  it('diagonal gaps do not leak (4-neighbour flood)', () => {
    const s = newGame(1, 'empty');
    rectStruct(s, 10, 10, 14, 14, 'wall', true, true); computeSecurity(s);
    expect(isInsecure(s, 12, 12)).toBe(false);
  });
});

describe('rooms', () => {
  it('detects a room, validates requirements and size, and splits by walls', () => {
    const s = newGame(2, 'empty');
    rectStruct(s, 10, 10, 20, 16, 'wall', true, true); buildStructNow(s, 10, 13, 'jaildoor');
    rectZone(s, 11, 11, 19, 15, zoneIndex('holding')); computeSecurity(s); detectRooms(s);
    expect(s.cache.rooms.length).toBe(1); const r = s.cache.rooms[0];
    expect(r.tiles.length).toBe(45); expect(r.secure).toBe(true); expect(r.valid).toBe(false);
    expect(r.issues.join()).toContain('변기'); expect(r.issues.join()).toContain('벤치');
    placeObjectNow(s, 19, 11, 'toilet'); placeObjectNow(s, 11, 15, 'bench'); placeObjectNow(s, 13, 15, 'bench'); detectRooms(s);
    expect(s.cache.rooms[0].valid).toBe(true);
    // divide with a wall → two rooms
    for (let y = 11; y <= 15; y++) buildStructNow(s, 15, y, 'wall'); detectRooms(s);
    expect(s.cache.rooms.length).toBe(2);
    // cell size rule
    const c = newGame(3, 'empty'); rectStruct(c, 5, 5, 8, 8, 'wall', true, true); buildStructNow(c, 5, 6, 'jaildoor'); rectZone(c, 6, 6, 7, 7, zoneIndex('cell')); placeObjectNow(c, 6, 6, 'bed'); placeObjectNow(c, 7, 7, 'toilet'); computeSecurity(c); detectRooms(c);
    expect(validRooms(c, 'cell').length).toBe(1);
    const d = newGame(3, 'empty'); rectStruct(d, 5, 5, 8, 7, 'wall', true, true); buildStructNow(d, 5, 6, 'jaildoor'); rectZone(d, 6, 6, 7, 6, zoneIndex('cell')); placeObjectNow(d, 6, 6, 'bed'); placeObjectNow(d, 7, 6, 'toilet'); computeSecurity(d); detectRooms(d);
    expect(validRooms(d, 'cell').length).toBe(0); expect(d.cache.rooms[0].issues.join()).toContain('작음');
  });
  it('zones cannot be painted on walls, roads or the border', () => {
    const s = newGame(2, 'empty');
    buildStructNow(s, 10, 10, 'wall');
    expect(dispatch(s, { type: 'zone', zone: 1, x0: 10, y0: 10, x1: 10, y1: 10 }).ok).toBe(false);
    expect(dispatch(s, { type: 'zone', zone: 1, x0: 0, y0: 5, x1: 1, y1: 5 }).ok).toBe(false);
    expect(dispatch(s, { type: 'zone', zone: 1, x0: 0, y0: 0, x1: 43, y1: 0 }).ok).toBe(false);
    expect(dispatch(s, { type: 'zone', zone: 1, x0: 5, y0: 5, x1: 6, y1: 6 }).n).toBe(4);
  });
});

describe('pathfinding', () => {
  it('finds paths around walls, respects jail doors for escapers, none through solid boxes', () => {
    const s = newGame(4, 'empty');
    rectStruct(s, 10, 10, 20, 20, 'wall', true, true); computeSecurity(s);
    expect(findPath(s, 5, 15, 15, 15, 'staff')).toBeNull();
    buildStructNow(s, 10, 15, 'jaildoor');
    expect(findPath(s, 5, 15, 15, 15, 'staff')).not.toBeNull();
    expect(findPath(s, 5, 15, 15, 15, 'prisoner')).not.toBeNull();
    expect(findPath(s, 5, 15, 15, 15, 'escaper')).toBeNull();
    expect(findEscapePath(s, 15, 15)).toBeNull();
    buildStructNow(s, 10, 15, 'door');
    expect(findEscapePath(s, 15, 15)).not.toBeNull();
    // no corner cutting
    const c = newGame(4, 'empty'); buildStructNow(c, 10, 10, 'wall'); buildStructNow(c, 11, 11, 'wall');
    const p = findPath(c, 10, 11, 11, 10, 'staff')!; expect(p.length).toBeGreaterThan(1);
    expect(passable(c, 10, 10, 'staff')).toBe(false);
  });
});

describe('construction', () => {
  it('charges up front, refunds on cancel, rejects when broke or blocked', () => {
    const s = newGame(5, 'empty'); const m0 = s.money;
    expect(planStruct(s, 10, 10, 'wall')).toBeNull(); expect(s.money).toBe(m0 - STRUCTS[0].cost);
    expect(planStruct(s, 10, 10, 'wall')).toBe('이미 작업 예정');
    expect(dispatch(s, { type: 'cancel', x: 10, y: 10 }).ok).toBe(true); expect(s.money).toBe(m0);
    expect(planStruct(s, 1, 10, 'wall')).toContain('도로'); expect(planStruct(s, 43, 10, 'wall')).toContain('가장자리');
    s.money = 5; expect(planStruct(s, 10, 10, 'wall')).toBe('자금 부족');
  });
  it('hollow rectangles for walls, filled for zones; objects need a free tile', () => {
    const s = newGame(5, 'empty');
    expect(dispatch(s, { type: 'build', struct: 'wall', x0: 5, y0: 5, x1: 9, y1: 9 }).n).toBe(16);
    expect(dispatch(s, { type: 'build', struct: 'wall', x0: 12, y0: 5, x1: 12, y1: 9 }).n).toBe(5);
    expect(dispatch(s, { type: 'object', obj: 'bed', x0: 6, y0: 6, x1: 6, y1: 6 }).ok).toBe(true);
    expect(dispatch(s, { type: 'object', obj: 'bed', x0: 6, y0: 6, x1: 6, y1: 6 }).ok).toBe(false);
    expect(dispatch(s, { type: 'object', obj: 'bed', x0: 5, y0: 5, x1: 5, y1: 5 }).ok).toBe(false); // planned wall
  });
  it('workmen finish jobs; demolish refunds half; unreachable jobs are flagged', () => {
    const s = newGame(6, 'empty');
    dispatch(s, { type: 'build', struct: 'wall', x0: 10, y0: 10, x1: 14, y1: 14 });
    run(s, 90); expect(s.jobs.length).toBe(0);
    // object inside the closed box: unreachable
    const m = s.money; dispatch(s, { type: 'object', obj: 'bed', x0: 12, y0: 12, x1: 12, y1: 12 }); run(s, 15);
    expect(s.jobs.length).toBe(1); expect(s.jobs[0].unreachable).toBe(true);
    dispatch(s, { type: 'cancel', x: 12, y: 12 }); expect(s.money).toBe(m);
    // demolish a wall tile: refund 50%
    const m2 = s.money; dispatch(s, { type: 'demolish', x0: 10, y0: 12, x1: 10, y1: 12 }); run(s, 30);
    expect(s.struct[12 * s.w + 10]).toBe(0); expect(s.money).toBe(m2 + STRUCTS[0].cost * 0.5);
  });
});

describe('prisoners & regime', () => {
  it('intake is limited by capacity; beds get assigned; mood reflects needs', () => {
    const s = newGame(7, 'quick');
    expect(capacity(s).total).toBeGreaterThan(6);
    const r = dispatch(s, { type: 'intake', n: 50 }); expect(r.n).toBe(capacity(newGame(7, 'quick')).total);
    expect(s.prisoners.filter(p => p.bedId >= 0).length).toBe(6);
    const p = s.prisoners[0]; for (const k of NEED_KEYS) p.needs[k] = 0; computeMood(p); expect(p.mood).toBe(100); expect(p.anger).toBe(0);
    for (const k of NEED_KEYS) p.needs[k] = 100; computeMood(p); expect(p.mood).toBe(0); expect(p.anger).toBeGreaterThan(50);
  });
  it('escape only possible from insecure tiles; jail door blocks escapers', () => {
    const s = newGame(8, 'quick'); dispatch(s, { type: 'intake', n: 1 }); const p = s.prisoners[0];
    p.x = 12.5; p.y = 12.5; expect(tryEscape(s, p)).toBe(false);
    p.x = 4.5; p.y = 22.5; expect(tryEscape(s, p)).toBe(true); expect(p.state).toBe('escape');
  });
  it('regime edits apply and lockdown sends everyone to cells', () => {
    const s = newGame(9, 'quick'); dispatch(s, { type: 'regime', hour: 10, act: 'yard' }); expect(s.regime[10]).toBe('yard');
    dispatch(s, { type: 'regimeAll', regime: DEFAULT_REGIME }); expect(s.regime[10]).toBe('work');
    dispatch(s, { type: 'intake', n: 4 }); run(s, HOUR_SECONDS * 3);
    dispatch(s, { type: 'lockdown', on: true }); run(s, HOUR_SECONDS * 3);
    const inCells = s.prisoners.filter(p => { const r = roomOf(s, Math.floor(p.x), Math.floor(p.y)); return (r && (ROOMS[r.zone].id === 'cell' || ROOMS[r.zone].id === 'holding')) || (p.state === 'move' && (p.intent === 'cell' || p.intent === 'holding')); }).length;
    expect(inCells).toBe(s.prisoners.length);
    expect(s.prisoners.filter(p => p.intent === 'yard' || p.intent === 'common').length).toBe(0);
  });
  it('hire/fire staff and riot squad', () => {
    const s = newGame(10, 'empty'); const n = s.staff.length;
    expect(dispatch(s, { type: 'hire', staff: 'guard' }).ok).toBe(true); expect(s.staff.length).toBe(n + 1);
    const g = s.staff.find(x => x.type === 'guard')!; dispatch(s, { type: 'fire', id: g.id }); run(s, 20); expect(s.staff.find(x => x.id === g.id)).toBeUndefined();
    dispatch(s, { type: 'riotSquad' }); expect(s.staff.filter(x => x.temp).length).toBe(4);
    run(s, HOUR_SECONDS * 26); expect(s.staff.filter(x => x.temp).length).toBe(0);
    s.money = 10; expect(dispatch(s, { type: 'hire', staff: 'doctor' }).ok).toBe(false);
  });
});

describe('data integrity', () => {
  it('every object required by a room exists; every object lists rooms', () => {
    const ids = new Set(OBJECTS.map(o => o.id));
    for (const r of ROOMS) for (const k of Object.keys(r.needs)) expect(ids.has(k as any)).toBe(true);
    for (const o of OBJECTS) expect(o.rooms.length).toBeGreaterThan(0);
  });
  it('serialize round trip preserves typed arrays and indexes', () => {
    const s = newGame(11, 'quick'); dispatch(s, { type: 'intake', n: 3 }); run(s, 30);
    const t = deserialize(serialize(s));
    expect(t.prisoners.length).toBe(s.prisoners.length); expect(t.cache.prisonerIndex.size).toBe(s.prisoners.length); expect(t.cache.rooms.length).toBe(s.cache.rooms.length);
    expect(t.struct instanceof Uint8Array).toBe(true); expect(t.objAt instanceof Int32Array).toBe(true);
    expect(() => deserialize('{"version":99}')).toThrow();
  });
});
