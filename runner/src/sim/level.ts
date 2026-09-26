// Deterministic level stream.
// - MAIN chunks (the course) are chosen by a per-index RNG keyed on (seed, main index), and pacing (tier, biome)
//   follows metres of MAIN chunks placed — so the course is identical however the player plays (daily, ghosts).
// - INSERTED chunks (landing, bonus sky) never consume main indices. When a bonus teleport abandons main chunks
//   that were generated ahead, the generator state is rewound to the first abandoned one and they are re-placed.
// - Item slots (potions / power-ups / letters / pouches) are filled on a metres schedule; power-up kinds use
//   their own per-index RNG stream.
import { TILE, GROUND_Y, GROUND_ROW, PX_PER_M, VIEW_W, SPEED_TIERS, MAX_TIER } from '../data/physics';
import {
  POTION_GAP_M, BIG_POTION_EVERY, POWER_GAP_M, LETTER_GAP_M, NO_REPEAT, TIER_EVERY_M, BIOME_EVERY_M, BONUS_WORD,
  POWER_WEIGHTS, LINE_MIN_JELLIES, COOLDOWN_CHUNKS, BREATHER_AFTER, BREATHER_T, SETPIECE_T, OPEN_COIN_EVERY,
} from '../data/tuning';
import { CHUNKS } from '../data/chunks';
import { BIOME_ORDER } from '../data/biomes';
import { STAGES, STAGE_BY_ID, type StageDef } from '../data/stages';
import { parseChunk, type ParsedChunk } from './chunk';
import { rngNext, seedRng } from './rng';
import type { RunState, Level, PlacedChunk, PowerKind, Pickup, GenState } from './types';

export const PARSED: ParsedChunk[] = CHUNKS.map(parseChunk);
export const PARSED_BY_ID = new Map(PARSED.map(p => [p.def.id, p]));
const EXCLUDE = ['sky', 'tutorial', 'tutorial-extra', 'special', 'setpiece', 'stageonly'];   // never drawn by the random picker
const isGameplay = (p: ParsedChunk) => !p.def.tags?.some(t => EXCLUDE.includes(t));
const FAMILIES = ['jump', 'double', 'slide', 'pit', 'platform', 'combo', 'rhythm', 'choice', 'tunnel', 'stairs'];

/** A fresh RNG for (seed, salt): independent streams without sharing state. */
export function streamRng(seed: number, salt: number) {
  let h = (seed ^ Math.imul(salt + 0x632be5ab, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0; h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return seedRng((h ^ (h >>> 16)) >>> 0);
}

function newGen(): GenState {
  return {
    mainIndex: 0, mainM: 0, potionDebt: POTION_GAP_M * 0.6, powerDebt: POWER_GAP_M * 0.5, letterDebt: LETTER_GAP_M * 0.5,
    potionsPlaced: 0, powersPlaced: 0, lastPower: null, pouchesPlaced: 0, recent: [], lastUsed: {}, hazardRun: 0,
    calmM: 0, setpieceM: 0, lastTier: -1, courseIdx: 0, recentFam: [],
  };
}
function cloneGen(g: GenState): GenState { return { ...g, recent: g.recent.slice(), lastUsed: { ...g.lastUsed }, recentFam: g.recentFam.slice() }; }

export function newLevel(stage: StageDef | null, mode: string): Level {
  const lv: Level = {
    chunks: [], solids: [], hazards: [], pickups: [], genX: 0, nextId: 1, serial: 0,
    gen: newGen(), stageLen: 0, finishX: Infinity, course: null, skyPlaced: 0, warnedSerial: -1,
  };
  if (stage) {
    lv.course = resolveCourse(stage);
    lv.stageLen = lv.course ? Math.round(lv.course.reduce((a, id) => a + (PARSED_BY_ID.get(id)?.width ?? 0), 0) / PX_PER_M) : stage.length;
  }
  if (mode === 'tutorial') lv.course = PARSED.filter(p => p.def.tags?.length === 1 && p.def.tags[0] === 'tutorial').map(p => p.def.id);
  return lv;
}

/** A stage's frozen course: explicit ids stay; {pool, tier} slots are drawn once from the stage seed. */
export function resolveCourse(st: StageDef): string[] | null {
  if (!st.course) return null;
  const used = new Set<string>(); const out: string[] = [];
  st.course.forEach((slot, i) => {
    if (typeof slot === 'string') { out.push(slot); used.add(slot); return; }
    const rng = streamRng(st.seed, 0x5000 + i);
    let pool = PARSED.filter(p => isGameplay(p) && p.def.tiers[0] <= slot.tier && p.def.tiers[1] >= slot.tier && (!slot.pool || p.def.tags?.includes(slot.pool)) && !used.has(p.def.id));
    if (!pool.length) pool = PARSED.filter(p => isGameplay(p) && p.def.tiers[0] <= slot.tier && p.def.tiers[1] >= slot.tier);
    const pick = pool[Math.floor(rngNext(rng) * pool.length)];
    out.push(pick.def.id); used.add(pick.def.id);
  });
  return out;
}

/** Difficulty tier & biome for the next MAIN chunk. */
export function paceAt(s: RunState): { tier: number; biome: string } {
  const g = s.level.gen;
  if (s.mode === 'stage' && s.stageId) {
    const st = STAGES.find(x => x.id === s.stageId)!;
    const f = s.level.stageLen > 0 ? Math.min(1, g.mainM / s.level.stageLen) : 0;
    return { tier: Math.round(st.tiers[0] + (st.tiers[1] - st.tiers[0]) * f), biome: st.biome };
  }
  if (s.mode === 'tutorial') return { tier: 0, biome: BIOME_ORDER[0] };
  return { tier: Math.min(MAX_TIER, Math.floor(g.mainM / TIER_EVERY_M)), biome: BIOME_ORDER[Math.floor(g.mainM / BIOME_EVERY_M) % BIOME_ORDER.length] };
}

function primaryFamily(p: ParsedChunk): string { return p.def.tags?.find(t => FAMILIES.includes(t)) ?? 'other'; }

/** The director's difficulty count: hazards plus pits (a pit is a hazard too, GDD §5.3) — a pit counts once per
 *  4 columns of gap, so a long pit gauntlet is never an "easy" acclimation chunk. 0 = a true breather. */
const DANGER = new WeakMap<ParsedChunk, number>();
export function dangerOf(p: ParsedChunk): number {
  let d = DANGER.get(p);
  if (d === undefined) {
    d = p.hazards.length;
    for (const gap of p.def.rows[GROUND_ROW].match(/[^=]+/g) ?? []) d += Math.ceil(gap.length / 4);
    DANGER.set(p, d);
  }
  return d;
}

function pickMain(s: RunState, tier: number, biome: string): ParsedChunk {
  const g = s.level.gen;
  const fits = (p: ParsedChunk) => p.def.tiers[0] <= tier && p.def.tiers[1] >= tier && (!p.def.biomes || p.def.biomes.includes(biome));
  const rng = streamRng(s.seed, 0x1000 + g.mainIndex);
  const speed = SPEED_TIERS[tier];
  // set piece every ~SETPIECE_T seconds of course (measured in metres, so it is input-independent)
  if (g.setpieceM >= SETPIECE_T * speed / PX_PER_M) {
    const sp = PARSED.filter(p => p.def.tags?.includes('setpiece') && fits(p) && !g.recent.includes(p.def.id));
    if (sp.length) { g.setpieceM = 0; return sp[Math.floor(rngNext(rng) * sp.length)]; }
  }
  let cands = PARSED.filter(p => isGameplay(p) && fits(p) && !g.recent.slice(-NO_REPEAT).includes(p.def.id));
  if (!cands.length) cands = PARSED.filter(p => isGameplay(p) && fits(p));
  // director: a breather after BREATHER_AFTER hazard chunks in a row or ~BREATHER_T seconds without rest
  if (g.hazardRun >= BREATHER_AFTER || g.calmM >= BREATHER_T * speed / PX_PER_M) {
    const rest = cands.filter(p => p.def.tags?.includes('rest') || dangerOf(p) === 0);
    if (rest.length) cands = rest;
  } else {
    const nonRest = cands.filter(p => !p.def.tags?.includes('rest')); if (nonRest.length) cands = nonRest;
  }
  // acclimation: right after a speed-up, an easier chunk from the tier below that still covers this tier
  if (g.lastTier >= 0 && tier > g.lastTier) {
    const easy = cands.filter(p => p.def.tiers[0] <= tier - 1 && dangerOf(p) <= 3);
    if (easy.length) cands = easy;
  }
  let total = 0;
  const lastFams = g.recentFam.slice(-3);
  const w = cands.map(p => {
    const c = (p.def.tiers[0] + p.def.tiers[1]) / 2;
    let x = (p.def.weight ?? 1) / (1 + Math.abs(c - tier));                           // centred on this tier
    const used = g.lastUsed[p.def.id];
    if (used !== undefined && g.mainIndex - used < COOLDOWN_CHUNKS) x *= 0.15;           // soft ~60 s cooldown
    if (lastFams.length === 3 && lastFams.every(f => f === primaryFamily(p))) x *= 0.25; // family variety
    total += x; return x;
  });
  let r = rngNext(rng) * total;
  for (let i = 0; i < cands.length; i++) { r -= w[i]; if (r <= 0) return cands[i]; }
  return cands[cands.length - 1];
}

function pickPower(s: RunState): PowerKind {
  const g = s.level.gen; const rng = streamRng(s.seed, 0x2000 + g.powersPlaced);
  const kinds = (Object.keys(POWER_WEIGHTS) as PowerKind[]).filter(k => k !== g.lastPower);   // never the same twice in a row
  const tot = kinds.reduce((a, k) => a + POWER_WEIGHTS[k], 0);
  let r = rngNext(rng) * tot;
  for (const k of kinds) { r -= POWER_WEIGHTS[k]; if (r <= 0) return k; }
  return kinds[kinds.length - 1];
}

function nextLetterIndex(s: RunState): number { const i = s.letters.findIndex(x => !x); return i < 0 ? 0 : i; }

/** Place one parsed chunk at lv.genX. `main` chunks advance the course; inserted ones (landing, sky) do not. */
export function placeChunk(s: RunState, p: ParsedChunk, tier: number, biome: string, opt: { sky?: boolean; finish?: boolean; main?: boolean } = {}): PlacedChunk {
  const lv = s.level; const g = lv.gen; const x = lv.genX; const sky = !!opt.sky; const main = !!opt.main;
  const speed = SPEED_TIERS[Math.max(0, Math.min(MAX_TIER, tier))];
  const pc: PlacedChunk = {
    id: p.def.id, x, width: p.width, tier, speed, biome, sky, finish: !!opt.finish, main, serial: lv.serial++,
    index: main ? g.mainIndex : -1, genBefore: main ? cloneGen(g) : null, jellyTotal: 0, jellyGot: 0, line: 0,
  };
  lv.chunks.push(pc);
  for (const so of p.solids) lv.solids.push({ x0: so.x0 + x, x1: so.x1 + x, top: so.top, ground: so.ground });
  for (const h of p.hazards) lv.hazards.push({ id: lv.nextId++, kind: h.kind, x0: h.x0 + x, x1: h.x1 + x, y0: h.y0, y1: h.y1, biome, broken: false, passed: false });
  const m = p.width / PX_PER_M;
  if (!sky) { g.potionDebt += m; g.powerDebt += m; g.letterDebt += m; }
  const thinCoins = s.mode === 'endless' || s.mode === 'daily';
  let coinK = main ? g.mainIndex : 0;               // per-chunk parity: independent of input (bonus teleports, pickups)
  for (const pk of p.pickups) {
    const base: Omit<Pickup, 'type'> = { id: lv.nextId++, x: pk.x + x, y: pk.y, taken: false, pulled: false, chunk: pc.serial };
    switch (pk.kind) {
      case 'jelly': lv.pickups.push({ ...base, type: sky ? 'bonusJelly' : 'jelly' }); break;
      case 'big': lv.pickups.push({ ...base, type: 'big' }); break;
      case 'coin':
        if (thinCoins && coinK++ % OPEN_COIN_EVERY !== 0) lv.pickups.push({ ...base, type: sky ? 'bonusJelly' : 'jelly' });
        else lv.pickups.push({ ...base, type: 'coin' });
        break;
      case 'slotP':
        if (!sky && g.potionDebt >= POTION_GAP_M && s.mode !== 'tutorial') {
          g.potionDebt = 0; g.potionsPlaced++;
          lv.pickups.push({ ...base, type: g.potionsPlaced % BIG_POTION_EVERY === 0 ? 'bigPotion' : 'potion' });
        } else lv.pickups.push({ ...base, type: 'jelly' });
        break;
      case 'slotQ':
        if (!sky && g.powerDebt >= POWER_GAP_M && s.mode !== 'tutorial') {
          g.powerDebt = 0; const k = pickPower(s); g.powersPlaced++; g.lastPower = k;
          lv.pickups.push({ ...base, type: 'power', power: k });
        } else lv.pickups.push({ ...base, type: 'big' });
        break;
      case 'slotB':
        if (s.mode === 'stage' && !sky) lv.pickups.push({ ...base, type: 'pouch', pouch: stagePouchCount(s) + g.pouchesPlaced++ });   // after the stage's own pouches (distinct ★3 bits)
        else lv.pickups.push({ ...base, type: 'coin' });
        break;
      case 'slotL':
        if (!sky && g.letterDebt >= LETTER_GAP_M && s.mode !== 'tutorial' && s.bonusStage === 'none' && s.letters.some(v => !v)
          && !lv.pickups.some(q => q.type === 'letter' && !q.taken && !q.seen)) {   // a letter run past (seen) is missed: offer it again
          g.letterDebt = 0;
          lv.pickups.push({ ...base, type: 'letter', letter: nextLetterIndex(s) });
        } else lv.pickups.push({ ...base, type: 'jelly' });
        break;
    }
  }
  for (const q of lv.pickups) if (q.chunk === pc.serial && (q.type === 'jelly' || q.type === 'big')) pc.jellyTotal++;
  pc.line = pc.jellyTotal >= LINE_MIN_JELLIES && !sky ? 1 : 0;
  lv.genX += p.width;
  if (main) {
    g.mainIndex++; g.mainM += m; g.setpieceM += m;
    g.recent.push(p.def.id); if (g.recent.length > NO_REPEAT) g.recent.shift();
    g.lastUsed[p.def.id] = g.mainIndex - 1;
    const hasHaz = dangerOf(p) > 0;
    g.hazardRun = hasHaz ? g.hazardRun + 1 : 0;
    g.calmM = hasHaz ? g.calmM + m : 0;
    g.recentFam.push(primaryFamily(p)); if (g.recentFam.length > 4) g.recentFam.shift();
    g.lastTier = tier;
  }
  return pc;
}

/** Keep the stream generated ~2 screens ahead of the player and drop what is far behind. */
export function ensureLevel(s: RunState): void {
  const lv = s.level; const px = s.body.x;
  while (lv.genX < px + VIEW_W * 2) {
    if (s.bonusStage === 'sky') { placeChunk(s, pickSky(s), s.tier, s.biome, { sky: true }); continue; }
    if (lv.finishX !== Infinity) { placeChunk(s, PARSED_BY_ID.get('finish_runout')!, s.tier, s.biome); continue; }
    const g = lv.gen;
    const { tier, biome } = paceAt(s);
    if (lv.course) {
      if (g.courseIdx < lv.course.length) {
        const p = PARSED_BY_ID.get(lv.course[g.courseIdx])!;
        const t = Math.max(p.def.tiers[0], Math.min(p.def.tiers[1], tier));   // a course chunk runs at a tier it is proven for
        const pc = placeChunk(s, p, t, biome, { main: true });
        if (s.mode === 'stage' && s.stageId) placeStagePouches(s, pc, g.courseIdx);
        g.courseIdx++; continue;
      }
      lv.finishX = lv.genX; placeChunk(s, PARSED_BY_ID.get('finish_runout')!, tier, biome, { finish: true }); continue;
    }
    if (lv.stageLen > 0 && g.mainM >= lv.stageLen) { lv.finishX = lv.genX; placeChunk(s, PARSED_BY_ID.get('finish_runout')!, tier, biome, { finish: true }); continue; }
    placeChunk(s, pickMain(s, tier, biome), tier, biome, { main: true });
  }
  // prune behind the camera
  const cut = px - 600;
  if (lv.chunks.length > 12 && lv.chunks[0].x + lv.chunks[0].width < cut) {
    while (lv.chunks.length > 8 && lv.chunks[0].x + lv.chunks[0].width < cut) lv.chunks.shift();
    lv.solids = lv.solids.filter(o => o.x1 >= cut);
    lv.hazards = lv.hazards.filter(o => o.x1 >= cut);
    lv.pickups = lv.pickups.filter(o => o.x >= cut && !o.taken);
  }
}

function stagePouchCount(s: RunState): number { return (s.stageId ? STAGE_BY_ID[s.stageId]?.pouches?.length : 0) ?? 0; }

/** Stage-defined golden pouches for course slot `slot` (a stage may also use 'B' glyphs inside chunks). */
function placeStagePouches(s: RunState, pc: PlacedChunk, slot: number): void {
  const st = STAGES.find(x => x.id === s.stageId); if (!st?.pouches) return;
  const lv = s.level; const chunkX = pc.x;
  st.pouches.forEach((pp, i) => {
    if (pp.slot !== slot) return;
    const p: Pickup = { id: lv.nextId++, type: 'pouch', pouch: i, x: chunkX + pp.col * TILE + TILE / 2, y: pp.row * TILE + TILE / 2, taken: false, pulled: false };
    // replace a pickup sitting in that very cell (e.g. a star candy), keep x order
    lv.pickups = lv.pickups.filter(q => !(Math.abs(q.x - p.x) < 1 && Math.abs(q.y - p.y) < 1));
    let k = lv.pickups.length; while (k > 0 && lv.pickups[k - 1].x > p.x) k--;
    lv.pickups.splice(k, 0, p);
  });
  pc.jellyTotal = lv.pickups.filter(q => q.chunk === pc.serial && (q.type === 'jelly' || q.type === 'big')).length;
  pc.line = pc.jellyTotal >= LINE_MIN_JELLIES ? 1 : 0;
}

export function pickSky(s: RunState): ParsedChunk {
  const sky = PARSED.filter(p => p.def.tags?.includes('sky'));
  const rng = streamRng(s.seed, 0x3000 + s.stats.bonusTimes * 64 + s.level.skyPlaced++);
  return sky[Math.floor(rngNext(rng) * sky.length)];
}

/** Drop everything ahead of the player and restart the stream at `x` (bonus-time teleports). Main chunks that
 *  were generated ahead but never reached are "un-placed": the generator rewinds so they come again, in order. */
export function restartStreamAt(s: RunState, x: number): void {
  const lv = s.level;
  const cut = Math.min(x, s.body.x + 200);
  const keep = (x0: number) => x0 < s.body.x - 50;
  const firstDropped = lv.chunks.find(c => !keep(c.x) && c.main && c.genBefore);
  if (firstDropped) lv.gen = cloneGen(firstDropped.genBefore!);
  // a finish generated before the teleport is un-placed too: the rest of the course and a fresh finish line
  // follow the landing (else the stale finishX would 'clear' the stage in mid-air and skip the course tail)
  if (lv.finishX !== Infinity) { lv.finishX = Infinity; for (const c of lv.chunks) c.finish = false; }
  lv.chunks = lv.chunks.filter(c => keep(c.x));
  lv.solids = lv.solids.filter(o => keep(o.x0)).map(o => (o.x1 > cut ? { ...o, x1: cut } : o));
  lv.hazards = lv.hazards.filter(o => keep(o.x0));
  lv.pickups = lv.pickups.filter(o => keep(o.x));
  lv.genX = x;
}

/** The chunk whose speed/tier applies at x (switches at chunk.x − TILE, matching the validator). */
export function chunkAt(lv: Level, x: number): PlacedChunk | null {
  for (let i = lv.chunks.length - 1; i >= 0; i--) { const c = lv.chunks[i]; if (x >= c.x - TILE) return c; }
  return lv.chunks[0] ?? null;
}

export const LETTER_COUNT = BONUS_WORD.length;
export { GROUND_Y };
