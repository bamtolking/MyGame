// Registry of per-class attack/ultimate effects.
import type { ClassId } from '../../shared/types.ts';
import type { ClassFx } from './types.ts';
import { sword } from './sword.ts';
import { archer } from './archer.ts';
import { shaman } from './shaman.ts';
import { spear } from './spear.ts';
import { taoist } from './taoist.ts';
import { guardian } from './guardian.ts';
import { assassin } from './assassin.ts';
import { gunner } from './gunner.ts';
import { musician } from './musician.ts';
import { painter } from './painter.ts';

export const CLASS_FX: Record<ClassId, ClassFx> = { sword, archer, shaman, spear, taoist, guardian, assassin, gunner, musician, painter };
export type { ClassFx, FxCtx } from './types.ts';
