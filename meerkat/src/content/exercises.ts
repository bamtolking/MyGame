import { ANKLE } from './ex/ankle';
import { CORE } from './ex/core';
import { HIP } from './ex/hip';
import { LEGS } from './ex/legs';
import { LOWBACK } from './ex/lowback';
import { NECK } from './ex/neck';
import { SHOULDER } from './ex/shoulder';
import { THORACIC } from './ex/thoracic';
import { NECK_PLUS } from './ex/neck-plus';
import { SHOULDER_PLUS } from './ex/shoulder-plus';
import { THORACIC_PLUS } from './ex/thoracic-plus';
import { CORE_PLUS } from './ex/core-plus';
import { LOWBACK_PLUS } from './ex/lowback-plus';
import { HIP_PLUS } from './ex/hip-plus';
import { LEGS_PLUS } from './ex/legs-plus';
import { ANKLE_PLUS } from './ex/ankle-plus';
import { RELEASE_PLUS } from './ex/release-plus';
import type { Exercise } from './exercise-types';

/** 부위별 운동 파일 (파일 이름 → 목록). 순서가 라이브러리 표시 순서 */
export const REGION_FILES: Record<string, Exercise[]> = {
  neck: NECK,
  'neck-plus': NECK_PLUS,
  shoulder: SHOULDER,
  'shoulder-plus': SHOULDER_PLUS,
  thoracic: THORACIC,
  'thoracic-plus': THORACIC_PLUS,
  core: CORE,
  'core-plus': CORE_PLUS,
  lowback: LOWBACK,
  'lowback-plus': LOWBACK_PLUS,
  hip: HIP,
  'hip-plus': HIP_PLUS,
  legs: LEGS,
  'legs-plus': LEGS_PLUS,
  ankle: ANKLE,
  'ankle-plus': ANKLE_PLUS,
  'release-plus': RELEASE_PLUS,
};

export const EXERCISES: Exercise[] = Object.values(REGION_FILES).flat();

/** 새로 추가된 동작 (라이브러리에 NEW 표시) */
export const NEW_IDS = new Set(
  Object.entries(REGION_FILES)
    .filter(([k]) => k.endsWith('-plus'))
    .flatMap(([, list]) => list.map((e) => e.id)),
);

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
