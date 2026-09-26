import type { Compound } from '../types';
import type { CompoundId } from '../catalog';
import { CORE_COMPOUNDS } from './core';
import { C1_COMPOUNDS } from './c1-polyphenols-carotenoids';
import { C2_COMPOUNDS } from './c2-phyto-fiber-vitamins';
import { C3_COMPOUNDS } from './c3-micronutrients-omega3';
import { C4_COMPOUNDS } from './c4-fats-antinutrients';

export const COMPOUNDS: Compound[] = [...CORE_COMPOUNDS, ...C1_COMPOUNDS, ...C2_COMPOUNDS, ...C3_COMPOUNDS, ...C4_COMPOUNDS];
export const COMPOUND_BY_ID = new Map<CompoundId, Compound>(COMPOUNDS.map((c) => [c.id, c]));
