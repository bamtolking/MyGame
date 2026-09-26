// Content hash: changes whenever anything that shapes a run changes (chunks, physics, tuning, stages, characters,
// companions, and the rules version of the sim code). Daily seeds and ghosts are keyed by it, so a ghost recorded
// on another build is never replayed against a different course or different rules.
import { CHUNKS } from '../data/chunks';
import * as physics from '../data/physics';
import * as tuning from '../data/tuning';
import { STAGES } from '../data/stages';
import { CHARACTERS } from '../data/characters';
import { COMPANIONS } from '../data/companions';
import { RUN_VERSION } from './run';

function fnv1a(str: string, h = 2166136261): number {
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const CONTENT_HASH: number = fnv1a(JSON.stringify([CHUNKS, physics, tuning, STAGES, CHARACTERS, COMPANIONS, RUN_VERSION]));
export function hashString(s: string): number { return fnv1a(s); }
