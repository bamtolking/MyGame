import type { LevelDef } from '../../sim/types';
import { L01 } from './L01';
import { L02 } from './L02';
import { L03 } from './L03';
import { L04 } from './L04';
import { L05 } from './L05';
import { L06 } from './L06';
import { L07 } from './L07';
import { L08 } from './L08';
import { L09 } from './L09';
import { L10 } from './L10';
import { L11 } from './L11';
import { L12 } from './L12';
import { L13 } from './L13';
import { L14 } from './L14';
import { L15 } from './L15';
import { L16 } from './L16';
import { L17 } from './L17';
import { L18 } from './L18';
import { L19 } from './L19';
import { L20 } from './L20';

export const LEVELS: LevelDef[] = [L01, L02, L03, L04, L05, L06, L07, L08, L09, L10, L11, L12, L13, L14, L15, L16, L17, L18, L19, L20];

export function levelByKey(key: string): LevelDef | undefined { return LEVELS.find((l) => l.key === key); }
export function levelById(id: number): LevelDef | undefined { return LEVELS.find((l) => l.id === id); }
