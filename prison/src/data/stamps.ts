// Prefab layouts placed with one tap. Legend: # wall, F fence, D door, J jail door, . empty;
// lower-case letters = zone floor (c cell, h holding, k kitchen, n canteen, y yard, s shower, i infirmary, m common, w workshop, o solitary, f office),
// upper-case object codes inside a zone are written as zoneLetter+objectCode in `objs`.
import type { StructType } from './structures';
import type { ObjType } from './objects';
import { STRUCT_BY_INDEX, STRUCT_INDEX } from './structures';
import { OBJ_BY_ID } from './objects';
import { ZONE_INDEX, type ZoneId } from './rooms';

export interface StampCell { x: number; y: number; struct?: StructType; zone?: number; obj?: ObjType }
export interface Stamp { id: string; name: string; icon: string; desc: string; w: number; h: number; cells: StampCell[]; cost: number }

const ZONE_CHAR: Record<string, ZoneId> = { c: 'cell', h: 'holding', k: 'kitchen', n: 'canteen', y: 'yard', s: 'shower', i: 'infirmary', m: 'common', w: 'workshop', o: 'solitary', f: 'office' };
const STRUCT_CHAR: Record<string, StructType> = { '#': 'wall', F: 'fence', D: 'door', J: 'jaildoor' };

function build(id: string, name: string, icon: string, desc: string, rows: string[], objs: Record<string, { zone: string; obj: ObjType }>): Stamp {
  const cells: StampCell[] = []; let cost = 0;
  const h = rows.length, w = rows[0].length;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x]; if (ch === '.') continue;
    if (STRUCT_CHAR[ch]) { cells.push({ x, y, struct: STRUCT_CHAR[ch] }); cost += STRUCT_BY_INDEX[STRUCT_INDEX[STRUCT_CHAR[ch]]]!.cost; continue; }
    if (ZONE_CHAR[ch]) { cells.push({ x, y, zone: ZONE_INDEX[ZONE_CHAR[ch]] }); continue; }
    const o = objs[ch]; if (o) { cells.push({ x, y, zone: ZONE_INDEX[ZONE_CHAR[o.zone]], obj: o.obj }); cost += OBJ_BY_ID[o.obj].cost; continue; }
    throw new Error(`stamp ${id}: unknown char ${ch}`);
  }
  return { id, name, icon, desc, w, h, cells, cost };
}

export const STAMPS: Stamp[] = [
  build('cellblock', '감방 블록 6실', '🏢', '2×2 감방 6개 + 가운데 복도. 위쪽 문으로 드나듭니다. 감방마다 침대·변기 포함.', [
    '####D####',
    '#Bc#.#cB#',
    '#cT#.#Tc#',
    '####.####',
    '#Bc#.#cB#',
    '#cT#.#Tc#',
    '####.####',
    '#Bc#.#cB#',
    '#cT#.#Tc#',
    '#########',
  ], { B: { zone: 'c', obj: 'bed' }, T: { zone: 'c', obj: 'toilet' } }),
  build('holding', '대기실', '🏚', '벽 안에 변기 1, 벤치 3, 침대 2. 문은 왼쪽.', [
    '#########',
    '#Bh.Bh.T#',
    '#hhhhhhh#',
    'Dhhhhhhh#',
    '#hhhhhhh#',
    '#hEhEhEh#',
    '#########',
  ], { B: { zone: 'h', obj: 'bed' }, T: { zone: 'h', obj: 'toilet' }, E: { zone: 'h', obj: 'bench' } }),
  build('kitchen', '주방+식당', '🍽', '위쪽 주방(조리대 2, 냉장고), 아래쪽 식당(배식대 2, 식탁 8). 식당 문은 왼쪽.', [
    '########.....',
    '#RCkCkk#.....',
    '#kkkkkk#.....',
    '#kkkkkk#.....',
    '###D#########',
    '#SSnnnnnnnnn#',
    '#nnnnnnnnnnn#',
    '#nAnAnAnAnnn#',
    '#nnnnnnnnnnn#',
    'DnAnAnAnAnnn#',
    '#nnnnnnnnnnn#',
    '#############',
  ], { R: { zone: 'k', obj: 'fridge' }, C: { zone: 'k', obj: 'cooker' }, S: { zone: 'n', obj: 'serving' }, A: { zone: 'n', obj: 'table' } }),
  build('shower', '샤워실', '🚿', '샤워기 4개. 문은 왼쪽.', [
    '########',
    '#WsWsWs#',
    'Dssssss#',
    '#ssssWs#',
    '########',
  ], { W: { zone: 's', obj: 'shower' } }),
  build('yard', '운동장', '🌳', '울타리 운동장, 벤치 2·역기 1. 문은 위쪽 가운데.', [
    'FFFFFFFDFFFFFFFF',
    'FyyyyyyyyyyyyyyF',
    'FyEyyyyyyyyyyGyF',
    'FyyyyyyyyyyyyyyF',
    'FyyyyyyyyyEyyyyF',
    'FyyyyyyyyyyyyyyF',
    'FFFFFFFFFFFFFFFF',
  ], { E: { zone: 'y', obj: 'bench' }, G: { zone: 'y', obj: 'weights' } }),
  build('infirmary', '의무실', '🏥', '의료침대 2. 문은 왼쪽.', [
    '#######',
    '#MiiMi#',
    'Diiiii#',
    '#iiiii#',
    '#######',
  ], { M: { zone: 'i', obj: 'medbed' } }),
  build('common', '휴게실', '📺', 'TV·책장·벤치 2. 문은 왼쪽.', [
    '#######',
    '#VmmmL#',
    'Dmmmmm#',
    '#mEmEm#',
    '#######',
  ], { V: { zone: 'm', obj: 'tv' }, L: { zone: 'm', obj: 'bookshelf' }, E: { zone: 'm', obj: 'bench' } }),
  build('workshop', '작업장', '🔧', '작업대 3 (6명 노동). 문은 왼쪽.', [
    '#########',
    '#KwwKwwK#',
    'Dwwwwwww#',
    '#wwwwwww#',
    '#########',
  ], { K: { zone: 'w', obj: 'workbench' } }),
  build('solitary', '독방 3실', '⛓', '1칸 독방 3개. 문은 아래쪽.', [
    '#######',
    '#o#o#o#',
    '#D#D#D#',
  ], {}),
  build('office', '사무실', '🗂', '책상·책장. 유효하면 보조금 +10%. 문은 왼쪽.', [
    '######',
    '#Pfff#',
    'Dffff#',
    '#fLff#',
    '######',
  ], { P: { zone: 'f', obj: 'desk' }, L: { zone: 'f', obj: 'bookshelf' } }),
];
// cell doors open onto the corridor column (x=4) from the first row of each cell
for (const y of [1, 4, 7]) for (const x of [3, 5]) { const c = STAMPS[0].cells.find(c => c.x === x && c.y === y)!; c.struct = 'door'; }
STAMPS[0].cost = STAMPS[0].cells.reduce((a, c) => a + (c.struct ? STRUCT_BY_INDEX[STRUCT_INDEX[c.struct]]!.cost : 0) + (c.obj ? OBJ_BY_ID[c.obj].cost : 0), 0);
export const STAMP_BY_ID: Record<string, Stamp> = Object.fromEntries(STAMPS.map(s => [s.id, s]));
