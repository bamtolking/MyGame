import { LOOT } from './balance';
import type { LootId } from '../sim/types';

export const LOOT_IDS: LootId[] = ['scrap', 'parts', 'relic'];
export const LOOT_DEF = LOOT;
export function lootWeight(items: Record<LootId, number>): number {
  return LOOT_IDS.reduce((a, id) => a + (items[id] || 0) * LOOT[id].weight, 0);
}
export function lootValue(items: Record<LootId, number>): number {
  return LOOT_IDS.reduce((a, id) => a + (items[id] || 0) * LOOT[id].value, 0);
}
export function emptyBag(): Record<LootId, number> { return { scrap: 0, parts: 0, relic: 0 }; }
