// Deterministic level stream: picks validated chunks by tier/biome with a no-repeat window, fills item slots
// (potions / power-ups / letters) on a distance schedule, and inserts bonus-time sky segments on demand.
import { TILE, GROUND_Y, PX_PER_M, VIEW_W, SPEED_TIERS, MAX_TIER } from '../data/physics';
import {
  POTION_GAP_M, BIG_POTION_EVERY, POWER_GAP_M, LETTER_GAP_M, NO_REPEAT, TIER_EVERY_M, BIOME_EVERY_M, BONUS_WORD,
} from '../data/tuning';
import { CHUNKS } from '../data/chunks';
import { BIOME_ORDER } from '../data/biomes';
import { STAGES } from '../data/stages';
import { parseChunk, type ParsedChunk } from './chunk';
import { rngNext, rngInt } from './rng';

export const BREATHER_AFTER = 4;
import type { RunState, Level, PlacedChunk, PowerKind, Pickup } from './types';

export const PARSED: ParsedChunk[] = CHUNKS.map(parseChunk);
export const PARSED_BY_ID = new Map(PARSED.map(p => [p.def.id, p]));

export function newLevel(stageLen: number): Level {
  return {
    chunks: [], solids: [], hazards: [], pickups: [], genX: 0, recent: [], nextId: 1,
    potionDebt: POTION_GAP_M * 0.6, powerDebt: POWER_GAP_M * 0.5, letterDebt: LETTER_GAP_M * 0.5,
    chunksPlaced: 0, potionsPlaced: 0, pouchesPlaced: 0, retiredGroundM: 0, stageLen, finishX: Infinity, hazardRun: 0,
  };
}

/** Difficulty tier & biome for the next chunk (by metres of ground placed so far). */
export function paceAt(s: RunState, groundM: number): { tier: number; biome: string } {
  if (s.mode === 'stage' && s.stageId) {
    const st = STAGES.find(x => x.id === s.stageId)!;
    const f = s.level.stageLen > 0 ? Math.min(1, groundM / s.level.stageLen) : 0;
    const tier = Math.round(st.tiers[0] + (st.tiers[1] - st.tiers[0]) * f);
    return { tier, biome: st.biome };
  }
  if (s.mode === 'tutorial') return { tier: 0, biome: BIOME_ORDER[0] };
  const tier = Math.min(MAX_TIER, Math.floor(groundM / TIER_EVERY_M));
  const biome = BIOME_ORDER[Math.floor(groundM / BIOME_EVERY_M) % BIOME_ORDER.length];
  return { tier, biome };
}

/** metres of non-sky chunks placed so far (drives tier/biome pacing) */
export function placedGroundM(lv: Level): number {
  let m = 0; for (const c of lv.chunks) if (!c.sky) m += c.width / PX_PER_M; return m + lv.retiredGroundM;
}

function pickChunk(s: RunState, tier: number, biome: string): ParsedChunk {
  const lv = s.level;
  const pool = PARSED.filter(p => p.def.tiers[0] <= tier && p.def.tiers[1] >= tier && !p.def.tags?.includes('sky') && !p.def.tags?.includes('tutorial') && !p.def.tags?.includes('special')
    && (!p.def.biomes || p.def.biomes.includes(biome)) && !lv.recent.includes(p.def.id));
  let cands = pool.length ? pool : PARSED.filter(p => p.def.tiers[0] <= tier && p.def.tiers[1] >= tier && !p.def.tags?.includes('sky') && !p.def.tags?.includes('tutorial') && !p.def.tags?.includes('special'));
  // director: after BREATHER_AFTER hazard chunks in a row, force a breather if one is available
  if (lv.hazardRun >= BREATHER_AFTER) { const rest = cands.filter(p => p.def.tags?.includes('rest')); if (rest.length) cands = rest; }
  // favour chunks whose range is centred on this tier, so each tier has its own flavour
  let total = 0; const w = cands.map(p => { const c = (p.def.tiers[0] + p.def.tiers[1]) / 2; const x = (p.def.weight ?? 1) / (1 + Math.abs(c - tier)); total += x; return x; });
  let r = rngNext(s.rng) * total;
  for (let i = 0; i < cands.length; i++) { r -= w[i]; if (r <= 0) return cands[i]; }
  return cands[cands.length - 1];
}

function nextLetterIndex(s: RunState): number {
  const i = s.letters.findIndex(x => !x);
  return i < 0 ? 0 : i;
}

/** Place one parsed chunk at lv.genX. */
export function placeChunk(s: RunState, p: ParsedChunk, tier: number, biome: string, sky = false, finish = false): PlacedChunk {
  const lv = s.level; const x = lv.genX;
  const speed = SPEED_TIERS[Math.max(0, Math.min(MAX_TIER, tier))];
  const pc: PlacedChunk = { id: p.def.id, x, width: p.width, tier, speed, biome, sky, finish };
  lv.chunks.push(pc);
  for (const so of p.solids) lv.solids.push({ x0: so.x0 + x, x1: so.x1 + x, top: so.top, ground: so.ground });
  for (const h of p.hazards) lv.hazards.push({ id: lv.nextId++, kind: h.kind, x0: h.x0 + x, x1: h.x1 + x, y0: h.y0, y1: h.y1, biome, broken: false, passed: false });
  const m = p.width / PX_PER_M;
  if (!sky) { lv.potionDebt += m; lv.powerDebt += m; lv.letterDebt += m; }
  for (const pk of p.pickups) {
    const base: Omit<Pickup, 'type'> = { id: lv.nextId++, x: pk.x + x, y: pk.y, taken: false, pulled: false };
    switch (pk.kind) {
      case 'jelly': lv.pickups.push({ ...base, type: sky ? 'bonusJelly' : 'jelly' }); break;
      case 'big': lv.pickups.push({ ...base, type: 'big' }); break;
      case 'coin': lv.pickups.push({ ...base, type: 'coin' }); break;
      case 'slotP':
        if (!sky && lv.potionDebt >= POTION_GAP_M) {
          lv.potionDebt = 0; lv.potionsPlaced++;
          lv.pickups.push({ ...base, type: lv.potionsPlaced % BIG_POTION_EVERY === 0 ? 'bigPotion' : 'potion' });
        } else lv.pickups.push({ ...base, type: 'jelly' });
        break;
      case 'slotQ':
        if (!sky && lv.powerDebt >= POWER_GAP_M) {
          lv.powerDebt = 0;
          const kinds: PowerKind[] = ['giant', 'dash', 'magnet'];
          lv.pickups.push({ ...base, type: 'power', power: kinds[rngInt(s.rng, kinds.length)] });
        } else lv.pickups.push({ ...base, type: 'big' });
        break;
      case 'slotB':
        if (s.mode === 'stage' && !sky) lv.pickups.push({ ...base, type: 'pouch', pouch: lv.pouchesPlaced++ });
        else lv.pickups.push({ ...base, type: 'coin' });
        break;
      case 'slotL':
        if (!sky && lv.letterDebt >= LETTER_GAP_M && s.mode !== 'tutorial' && s.bonusStage === 'none' && s.letters.some(v => !v)) {
          lv.letterDebt = 0;
          lv.pickups.push({ ...base, type: 'letter', letter: nextLetterIndex(s) });
        } else lv.pickups.push({ ...base, type: 'jelly' });
        break;
    }
  }
  lv.genX += p.width;
  lv.chunksPlaced++;
  if (!sky) {
    lv.recent.push(p.def.id); if (lv.recent.length > NO_REPEAT) lv.recent.shift();
    lv.hazardRun = p.hazards.length > 0 ? lv.hazardRun + 1 : 0;
  }
  return pc;
}

/** Keep the stream generated ~2 screens ahead of the player and drop what is far behind. */
export function ensureLevel(s: RunState): void {
  const lv = s.level; const px = s.body.x;
  while (lv.genX < px + VIEW_W * 2) {
    if (s.bonusStage === 'sky') {
      placeChunk(s, pickSky(s), s.tier, s.biome, true);
      continue;
    }
    if (lv.finishX !== Infinity && lv.genX >= lv.finishX) { placeChunk(s, PARSED_BY_ID.get('finish_runout')!, s.tier, s.biome); continue; }
    const gm = placedGroundM(lv);
    if (s.mode === 'tutorial') {
      const seq = PARSED.filter(p => p.def.tags?.includes('tutorial'));
      const i = lv.chunksPlaced;
      if (i < seq.length) { placeChunk(s, seq[i], 0, BIOME_ORDER[0]); continue; }
      if (lv.finishX === Infinity) { lv.finishX = lv.genX; placeChunk(s, PARSED_BY_ID.get('finish_runout')!, 0, BIOME_ORDER[0], false, true); continue; }
    }
    if (lv.stageLen > 0 && gm >= lv.stageLen && lv.finishX === Infinity) {
      const { biome } = paceAt(s, gm);
      lv.finishX = lv.genX; placeChunk(s, PARSED_BY_ID.get('finish_runout')!, s.tier, biome, false, true); continue;
    }
    const { tier, biome } = paceAt(s, gm);
    placeChunk(s, pickChunk(s, tier, biome), tier, biome);
  }
  // prune behind the camera
  const cut = px - 600;
  if (lv.chunks.length > 12 && lv.chunks[0].x + lv.chunks[0].width < cut) {
    while (lv.chunks.length > 8 && lv.chunks[0].x + lv.chunks[0].width < cut) {
      const c = lv.chunks.shift()!; if (!c.sky) lv.retiredGroundM += c.width / PX_PER_M;
    }
    lv.solids = lv.solids.filter(o => o.x1 >= cut);
    lv.hazards = lv.hazards.filter(o => o.x1 >= cut);
    lv.pickups = lv.pickups.filter(o => o.x >= cut && !o.taken);
  }
}

function pickSky(s: RunState): ParsedChunk {
  const sky = PARSED.filter(p => p.def.tags?.includes('sky'));
  return sky[rngInt(s.rng, sky.length)];
}

/** Drop everything ahead of the player and restart the stream at `x` (bonus-time teleports). */
export function restartStreamAt(s: RunState, x: number): void {
  const lv = s.level;
  const cut = Math.min(x, s.body.x + 200);
  const keep = (x0: number) => x0 < s.body.x - 50;   // abandoned chunks ahead never count as ground placed
  lv.chunks = lv.chunks.filter(c => keep(c.x));
  lv.solids = lv.solids.filter(o => keep(o.x0)).map(o => (o.x1 > cut ? { ...o, x1: cut } : o));
  lv.hazards = lv.hazards.filter(o => keep(o.x0));
  lv.pickups = lv.pickups.filter(o => keep(o.x));
  lv.genX = x;
}

export function chunkAt(lv: Level, x: number): PlacedChunk | null {
  for (let i = lv.chunks.length - 1; i >= 0; i--) { const c = lv.chunks[i]; if (x >= c.x - TILE) return c; }
  return lv.chunks[0] ?? null;
}

export const LETTER_COUNT = BONUS_WORD.length;
export { GROUND_Y };
