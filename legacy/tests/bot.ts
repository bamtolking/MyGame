// Headless bot policies for smoke/balance testing (not the player's UI)
import { newGame } from '../src/sim/state';
import { step, dispatch, DT } from '../src/sim/engine';
import type { GameState, Grade, UnitKind, MythicId } from '../src/sim/types';
import { SLOTS, coverage, PATH_LEN } from '../src/data/map';
import { autoPick, recipeStatus, currentSummonCost, mergePreview } from '../src/sim/roster';
import { MYTHIC_IDS, UNITS } from '../src/data/units';
import { fieldUnits } from '../src/sim/state';

export type Policy = 'attack' | 'control' | 'economy' | 'fastmerge' | 'confirmwait' | 'idle';

export const SLOT_ORDER = SLOTS.map(sl => ({ id: sl.id, cov: coverage(sl.x, sl.y, 110) })).sort((a, b) => b.cov - a.cov).map(x => x.id);

function bestEmptySlot(s: GameState, kind: UnitKind | null): number {
  if (kind === 'mechanic') {
    // slot with most attackers within 75
    let best = -1, bestN = -1;
    for (let i = 0; i < s.slots.length; i++) {
      if (s.slots[i] != null) continue;
      let n = 0; for (const u of fieldUnits(s)) { const a = SLOTS[i], b = SLOTS[u.loc.t === 'f' ? u.loc.slot : 0]; if (Math.hypot(a.x - b.x, a.y - b.y) <= 75 && u.kind !== 'mechanic' && u.kind !== 'toad') n++; }
      if (n > bestN) { bestN = n; best = i; }
    }
    return best;
  }
  if (kind === 'toad') { for (let i = SLOT_ORDER.length - 1; i >= 0; i--) if (s.slots[SLOT_ORDER[i]] == null) return SLOT_ORDER[i]; return -1; }
  for (const i of SLOT_ORDER) if (s.slots[i] == null) return i;
  return -1;
}

export interface BotResult { seed: number; policy: Policy; wave: number; won: boolean; life: number; time: number; summons: number; merges: number; mythics: string[]; peakGrade: number; legends: number; gold: number; units: number; firstMythicWave: number; firstMergeTime: number; firstHeroWave: number; lifeLostBy: Record<string, number> }

export function runBot(seed: number, policy: Policy, opts: { maxWave?: number; maxTime?: number } = {}): BotResult {
  const s = newGame(seed, 1000);
  const maxTime = opts.maxTime ?? 60 * 60;
  let firstMythicWave = 0, firstMergeTime = 0, firstHeroWave = 0;
  let steps = 0; let lastThink = -1;
  while (s.phase !== 'won' && s.phase !== 'lost' && s.time < maxTime) {
    if (opts.maxWave && s.wave > opts.maxWave && s.phase === 'prep') break;
    if (s.phase === 'relic' && s.relicOffer) dispatch(s, { type: 'relic', id: s.relicOffer[0] });
    if (s.phase === 'prep' && s.extraOffer && !s.extraOffer.decided) dispatch(s, { type: 'extra', accept: policy === 'attack' || policy === 'economy' });
    if (s.phase === 'prep' && s.prepT < 6) dispatch(s, { type: 'early' });
    // think every 0.5s of sim time
    if (Math.floor(s.time * 2) !== lastThink && policy !== 'idle') {
      lastThink = Math.floor(s.time * 2);
      think(s, policy);
      if (!firstMergeTime && s.stats.merges > 0) firstMergeTime = s.time;
      if (!firstHeroWave && s.units.some(u => u.grade >= 2)) firstHeroWave = s.wave;
      if (!firstMythicWave && s.stats.mythicsMade.length) firstMythicWave = s.wave;
    }
    step(s, DT); steps++;
    s.events.length = 0;
  }
  return { seed, policy, wave: s.phase === 'won' ? 41 : s.wave, won: s.phase === 'won', life: s.life, time: s.time, summons: s.stats.summons, merges: s.stats.merges, mythics: s.stats.mythicsMade.slice(), peakGrade: s.stats.peakGrade, legends: s.stats.legendMade, gold: s.gold, units: s.units.length, firstMythicWave, firstMergeTime, firstHeroWave, lifeLostBy: s.stats.lifeLostBy };
}

function think(s: GameState, policy: Policy): void {
  // 1. place bench units
  for (const u of s.units) {
    if (u.loc.t !== 'b') continue;
    const slot = bestEmptySlot(s, u.mythic ? null : u.kind);
    if (slot >= 0) dispatch(s, { type: 'move', id: u.id, to: { t: 'f', slot } });
  }
  // 2. craft mythic when possible
  for (const id of MYTHIC_IDS) { if (recipeStatus(s, id).canCraft) { dispatch(s, { type: 'craft', id }); break; } }
  // 3. merge
  const grades: Grade[] = [0, 1, 2];
  for (const g of grades) {
    for (let k = 0; k < 3; k++) {
      let ids: number[] | null = null;
      // same-kind first
      for (const kind of Object.keys(UNITS) as UnitKind[]) {
        if (policy === 'control' && (kind === 'penguin' || kind === 'bear') && g === 0) continue; // keep controllers spread
        if (policy === 'economy' && kind === 'toad' && g <= 1) continue;
        const p = autoPick(s, g, kind); if (p) { ids = p; break; }
      }
      if (!ids && policy !== 'confirmwait') {
        const count = s.units.filter(u => !u.mythic && u.grade === g && !u.locked).length;
        const fieldFull = s.slots.every(x => x != null) && s.bench.every(x => x != null);
        const wantMixed = policy === 'fastmerge' || fieldFull || count >= (policy === 'attack' ? 5 : 7);
        if (wantMixed) {
          const pool = s.units.filter(u => !u.mythic && u.grade === g && !u.locked).sort((a, b) => a.id - b.id);
          const pick = pool.filter(u => policy !== 'control' || (u.kind !== 'penguin' && u.kind !== 'bear' && u.kind !== 'mushroom')).slice(0, 3);
          if (pick.length === 3) ids = pick.map(u => u.id);
        }
      }
      if (ids) { const r = dispatch(s, { type: 'merge', ids }); if (!r.ok) break; } else break;
    }
  }
  // reserve mythic ingredients so merges don't eat them
  if (policy !== 'fastmerge') for (const id of MYTHIC_IDS) { const st = recipeStatus(s, id); if (st.missing <= 1) dispatch(s, { type: 'reserve', id }); }
  // 4. summon / upgrade
  const cost = currentSummonCost(s);
  const reserve = policy === 'economy' && s.wave < 12 ? 0 : 0;
  if (policy === 'economy' && s.wave < 8 && s.upgrades.atk < 2 && s.gold >= 70) dispatch(s, { type: 'upgrade', id: 'atk' });
  if (policy === 'attack' && s.wave >= 10 && s.gold > 300) dispatch(s, { type: 'upgrade', id: 'atk' });
  if (policy === 'control' && s.wave >= 8 && s.gold > 250) dispatch(s, { type: 'upgrade', id: 'spd' });
  let guard = 0;
  while (s.gold >= cost + reserve && guard++ < 6) {
    const r = dispatch(s, { type: 'summon' }); if (!r.ok) break;
    // place immediately
    const u = s.units[s.units.length - 1];
    if (u.loc.t === 'b') { const slot = bestEmptySlot(s, u.kind); if (slot >= 0) dispatch(s, { type: 'move', id: u.id, to: { t: 'f', slot } }); }
    if (s.designatedKind == null && s.shards >= 5) {
      // designate the kind we are closest to a mythic with
      for (const id of MYTHIC_IDS) { const st = recipeStatus(s, id); const miss = st.have.find(h => h.unitId == null); if (st.missing === 1 && miss) { dispatch(s, { type: 'designate', kind: miss.kind }); break; } }
    }
  }
  // 5. skills when enemies near exit
  const danger = s.enemies.filter(e => e.alive && e.progress > PATH_LEN * 0.75);
  if (danger.length >= 3 || danger.some(e => e.isBoss)) {
    const e = danger[0];
    if (s.skills.bomb <= 0) dispatch(s, { type: 'skill', kind: 'bomb', x: e.x, y: e.y });
    else if (s.skills.freeze <= 0) dispatch(s, { type: 'skill', kind: 'freeze', x: e.x, y: e.y });
  }
  // 6. sell weakest normals if full field & bench (to keep summoning)
  if (s.slots.every(x => x != null) && s.bench.every(x => x != null)) {
    const weak = s.units.filter(u => !u.mythic && u.grade === 0 && !u.locked).sort((a, b) => a.id - b.id)[0];
    if (weak && s.units.filter(u => u.grade === 0).length >= 2) dispatch(s, { type: 'sell', id: weak.id });
  }
}
