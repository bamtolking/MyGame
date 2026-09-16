import type { Grade } from '../sim/types';
// Base grade odds (must sum to 1)
export const BASE_ODDS: Record<Grade, number> = { 0: 0.70, 1: 0.25, 2: 0.045, 3: 0.005 };
export const PITY_ODDS: Record<Grade, number> = { 0: 0, 1: 0, 2: 0.95, 3: 0.05 };
export const ODDS_ORDER: Grade[] = [3, 2, 1, 0];
