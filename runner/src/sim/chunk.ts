// Chunk format: hand-authored ASCII rows (12 rows, row 11 = ground). Parsed into chunk-local geometry
// that both the run sim and the fairness validator use, so what is validated is exactly what is played.
import {
  TILE, ROWS, GROUND_ROW, GROUND_Y, SPIKE_W, SPIKE_H, TALL_W, TALL_H, HANG_W, HANG_BOTTOM_INSET,
} from '../data/physics';

/**
 * Glyphs
 *   '='  solid ground (row 11 only)          '.' or ' '  empty (a '.' in row 11 is a pit)
 *   '-'  one-way platform, top = row*40      '^' spike (single jump)   'A' tall fork (needs air jump)
 *   'v'  hanging hazard, slide under it      'o' jelly   'O' big jelly   'c' coin
 *   'P'  potion slot   '?' power-up slot   'L' letter slot   (the run generator decides what fills slots)
 */
export interface ChunkDef {
  id: string;
  /** inclusive difficulty tier range this chunk may appear in (0..MAX_TIER) */
  tiers: [number, number];
  tags?: string[];
  weight?: number;
  /** biome ids this chunk suits; omitted = all biomes */
  biomes?: string[];
  /** tutorial / stage signs drawn in the world at a column */
  signs?: { col: number; text: string }[];
  rows: string[];
}

export type HazardKind = 'spike' | 'tall' | 'hang';
export type PickupKind = 'jelly' | 'big' | 'coin' | 'slotP' | 'slotQ' | 'slotL';

export interface Solid { x0: number; x1: number; top: number; ground: boolean }
export interface HazardGeom { kind: HazardKind; x0: number; x1: number; y0: number; y1: number }
export interface PickupGeom { kind: PickupKind; x: number; y: number }

export interface ParsedChunk {
  def: ChunkDef;
  width: number;          // px
  cols: number;
  solids: Solid[];        // chunk-local x, merged runs
  hazards: HazardGeom[];
  pickups: PickupGeom[];
}

const VALID = new Set(['=', '.', ' ', '-', '^', 'A', 'v', 'o', 'O', 'c', 'P', '?', 'L']);

export function parseChunk(def: ChunkDef): ParsedChunk {
  if (def.rows.length !== ROWS) throw new Error(`chunk ${def.id}: needs ${ROWS} rows, has ${def.rows.length}`);
  const cols = def.rows[0].length;
  for (const [r, row] of def.rows.entries()) {
    if (row.length !== cols) throw new Error(`chunk ${def.id}: row ${r} length ${row.length} ≠ ${cols}`);
    for (const ch of row) if (!VALID.has(ch)) throw new Error(`chunk ${def.id}: bad glyph '${ch}' in row ${r}`);
    if (r === GROUND_ROW) { for (const ch of row) if (ch !== '=' && ch !== '.' && ch !== ' ') throw new Error(`chunk ${def.id}: ground row may only hold '=' or '.'`); }
    else if (row.includes('=')) throw new Error(`chunk ${def.id}: '=' outside the ground row (row ${r})`);
  }
  const solids: Solid[] = [];
  const hazards: HazardGeom[] = [];
  const pickups: PickupGeom[] = [];
  // merged horizontal runs of ground / platforms
  for (let r = 0; r < ROWS; r++) {
    const row = def.rows[r]; const want = r === GROUND_ROW ? '=' : '-';
    let start = -1;
    for (let c = 0; c <= cols; c++) {
      const on = c < cols && row[c] === want;
      if (on && start < 0) start = c;
      if (!on && start >= 0) { solids.push({ x0: start * TILE, x1: c * TILE, top: r === GROUND_ROW ? GROUND_Y : r * TILE, ground: r === GROUND_ROW }); start = -1; }
    }
  }
  for (let r = 0; r < GROUND_ROW; r++) {
    const row = def.rows[r];
    for (let c = 0; c < cols; c++) {
      const ch = row[c]; const cx = c * TILE + TILE / 2; const bottom = (r + 1) * TILE;
      switch (ch) {
        case '^': hazards.push({ kind: 'spike', x0: cx - SPIKE_W / 2, x1: cx + SPIKE_W / 2, y0: bottom - SPIKE_H, y1: bottom }); break;
        case 'A': hazards.push({ kind: 'tall', x0: cx - TALL_W / 2, x1: cx + TALL_W / 2, y0: bottom - TALL_H, y1: bottom }); break;
        case 'v': hazards.push({ kind: 'hang', x0: cx - HANG_W / 2, x1: cx + HANG_W / 2, y0: -400, y1: bottom - HANG_BOTTOM_INSET }); break;
        case 'o': pickups.push({ kind: 'jelly', x: cx, y: r * TILE + TILE / 2 }); break;
        case 'O': pickups.push({ kind: 'big', x: cx, y: r * TILE + TILE / 2 }); break;
        case 'c': pickups.push({ kind: 'coin', x: cx, y: r * TILE + TILE / 2 }); break;
        case 'P': pickups.push({ kind: 'slotP', x: cx, y: r * TILE + TILE / 2 }); break;
        case '?': pickups.push({ kind: 'slotQ', x: cx, y: r * TILE + TILE / 2 }); break;
        case 'L': pickups.push({ kind: 'slotL', x: cx, y: r * TILE + TILE / 2 }); break;
      }
    }
  }
  // x order lets the sim stop scanning early
  hazards.sort((a, b) => a.x0 - b.x0 || a.y0 - b.y0);
  pickups.sort((a, b) => a.x - b.x || a.y - b.y);
  solids.sort((a, b) => a.x0 - b.x0 || a.top - b.top);
  return { def, width: cols * TILE, cols, solids, hazards, pickups };
}

/** Structural rules every chunk must satisfy so any two chunks join safely. */
export function lintChunk(p: ParsedChunk): string[] {
  const errs: string[] = [];
  const g = p.def.rows[GROUND_ROW];
  if (p.cols < 12) errs.push('narrower than 12 columns');
  if (!g.startsWith('===') || !g.endsWith('===')) errs.push('must start and end with ≥3 ground tiles');
  const lead = 4, tail = 3; // hazard-free columns at both edges → ≥ 7 tiles between chunks' hazards
  for (const hz of p.hazards) {
    if (hz.x0 < lead * TILE) errs.push(`hazard in the first ${lead} columns (x=${hz.x0})`);
    if (hz.x1 > p.width - tail * TILE) errs.push(`hazard in the last ${tail} columns (x=${hz.x1})`);
  }
  const [a, b] = p.def.tiers; if (!(a >= 0 && b >= a)) errs.push('bad tier range');
  return errs;
}
