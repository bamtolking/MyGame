import type { Food } from '../types';
import { CORE_FOODS } from './core';
import { F1_FOODS } from './f1-vegetables-fruits';
import { F2_FOODS } from './f2-fruits-grains-legumes';
import { F3_FOODS } from './f3-oils-meat-fish';
import { F4_FOODS } from './f4-seafood-dairy-drinks-processed';

export const FOODS: Food[] = [...CORE_FOODS, ...F1_FOODS, ...F2_FOODS, ...F3_FOODS, ...F4_FOODS];
export const FOOD_BY_ID = new Map<string, Food>(FOODS.map((f) => [f.id, f]));
