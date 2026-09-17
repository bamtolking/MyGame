import { TILE } from './constants';
import type { MapData, MissionDef, TileCoord } from './types';
import type { Rect } from './geom';

export const tileCenter = (t: TileCoord): { x: number; y: number } => ({ x: (t[0] + 0.5) * TILE, y: (t[1] + 0.5) * TILE });

/** Compile the authored ASCII grid into solid rects (horizontal runs merged per row). */
export function compileMap(def: MissionDef): MapData {
  const rows = def.grid.length; const cols = def.grid[0].length;
  for (const r of def.grid) if (r.length !== cols) throw new Error(`map ${def.id}: ragged grid`);
  const solids: Rect[] = []; const solidGrid: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    const row = def.grid[r]; solidGrid.push([]);
    let run = -1;
    for (let c = 0; c <= cols; c++) {
      const solid = c < cols && row[c] === '#'; solidGrid[r][c] = solid;
      if (solid && run < 0) run = c;
      if (!solid && run >= 0) { solids.push({ x: run * TILE, y: r * TILE, w: (c - run) * TILE, h: TILE }); run = -1; }
    }
  }
  const width = cols * TILE, height = rows * TILE;
  validate(def, solidGrid);
  return { def, width, height, bounds: { x: 0, y: 0, w: width, h: height }, solids, solidGrid, cols, rows };
}

function validate(def: MissionDef, solidGrid: boolean[][]): void {
  const isSolid = (t: TileCoord): boolean => !!solidGrid[Math.floor(t[1])]?.[Math.floor(t[0])];
  const check = (name: string, t: TileCoord): void => { if (isSolid(t)) throw new Error(`map ${def.id}: ${name} at ${t} is inside a wall`); };
  check('spawn', def.spawn); check('exit', def.exit); check('vault', def.vault.at);
  for (const g of def.generators) check(`generator ${g.id}`, g.at);
  for (const p of def.plates) check(`plate ${p.id}`, p.at);
  for (const e of def.enemies) check(`enemy ${e.kind}`, e.at);
  const laserIds = new Set(def.lasers.map((l) => l.id));
  for (const g of def.generators) for (const l of g.lasers) if (!laserIds.has(l)) throw new Error(`map ${def.id}: generator ${g.id} links unknown laser ${l}`);
  for (const l of def.lasers) {
    if (l.from[0] !== l.to[0] && l.from[1] !== l.to[1]) throw new Error(`map ${def.id}: laser ${l.id} must be axis-aligned`);
    if (l.source.kind === 'generator' && !def.generators.some((g) => g.id === l.source.kind && g.id === (l.source as { id: string }).id) && !def.generators.some((g) => g.lasers.includes(l.id))) throw new Error(`map ${def.id}: laser ${l.id} has no generator`);
  }
  const plateIds = new Set(def.plates.map((p) => p.id)); const genIds = new Set(def.generators.map((g) => g.id));
  for (const p of def.vault.plates) if (!plateIds.has(p)) throw new Error(`map ${def.id}: vault links unknown plate ${p}`);
  for (const g of def.vault.generators) if (!genIds.has(g)) throw new Error(`map ${def.id}: vault links unknown generator ${g}`);
}

/** Axis-aligned laser beam rect between two tile centers with the given thickness. */
export function laserRect(from: TileCoord, to: TileCoord, thickness = 14): { rect: Rect; horizontal: boolean } {
  const a = tileCenter(from), b = tileCenter(to);
  const horizontal = a.y === b.y;
  if (horizontal) {
    const x0 = Math.min(a.x, b.x) - TILE / 2, x1 = Math.max(a.x, b.x) + TILE / 2;
    return { rect: { x: x0, y: a.y - thickness / 2, w: x1 - x0, h: thickness }, horizontal };
  }
  const y0 = Math.min(a.y, b.y) - TILE / 2, y1 = Math.max(a.y, b.y) + TILE / 2;
  return { rect: { x: a.x - thickness / 2, y: y0, w: thickness, h: y1 - y0 }, horizontal };
}
