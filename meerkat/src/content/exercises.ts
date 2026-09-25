import { LOWER } from './exercises-lower';
import { UPPER } from './exercises-upper';
import type { Exercise } from './exercise-types';

export const EXERCISES: Exercise[] = [...UPPER, ...LOWER];

const byId = new Map(EXERCISES.map((e) => [e.id, e]));

export function exercise(id: string): Exercise | undefined {
  return byId.get(id);
}

/** 한 번 수행에 걸리는 예상 시간(초) — 준비·세트 휴식 포함 */
export function estimateSeconds(e: Exercise): number {
  const d = e.dose;
  const sides = d.perSide ? 2 : 1;
  let work = 0;
  if (d.kind === 'hold') work = d.value;
  else if (d.kind === 'time') work = d.value;
  else work = d.value * ((d.tempo ?? 3) + (d.holdSec ?? 0));
  const sets = d.kind === 'time' ? 1 : d.sets;
  const rest = (d.rest ?? 10) * Math.max(0, sets * sides - 1);
  return Math.round(8 + work * sets * sides + rest + (sides === 2 ? 4 : 0));
}

export * from './exercise-types';
