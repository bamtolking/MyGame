import type { LevelDef } from '../../sim/types';
import { L01 } from './L01';
import { L02 } from './L02';
import { L03 } from './L03';
import { L04 } from './L04';
import { L05 } from './L05';

export const LEVELS: LevelDef[] = [L01, L02, L03, L04, L05];

export function levelByKey(key: string): LevelDef | undefined { return LEVELS.find((l) => l.key === key); }
export function levelById(id: number): LevelDef | undefined { return LEVELS.find((l) => l.id === id); }
