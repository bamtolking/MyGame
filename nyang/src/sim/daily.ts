// 오늘의 상자: 날짜마다 같은 시드와 규칙. 모든 사람이 같은 순서의 고양이를 받는다.
import { MODIFIERS, type Modifier } from '../data/rules';
import { hashString, makeRng, int } from './rng';

export interface DailyInfo {
  key: string;
  /** 1번부터 세는 회차 */
  no: number;
  seed: number;
  mod: Modifier;
}

const EPOCH = Date.UTC(2026, 0, 1);

export function dateKey(d: Date): string {
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function dailyInfo(d: Date = new Date()): DailyInfo {
  const key = dateKey(d);
  const dayIndex = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 86400000);
  // 규칙은 8일 묶음마다 섞어서 한 번씩 돌아가게 한다
  const n = MODIFIERS.length;
  const block = Math.floor(dayIndex / n);
  const perm = MODIFIERS.map((_, i) => i);
  const rng = makeRng(hashString('mods-' + block));
  for (let i = n - 1; i > 0; i--) { const j = int(rng, i + 1); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const mod = MODIFIERS[perm[((dayIndex % n) + n) % n]];
  return { key, no: dayIndex + 1, seed: hashString('nyang-daily-' + key), mod };
}

/** 다음 오늘의 상자까지 남은 시간 (ms) */
export function msUntilTomorrow(d: Date = new Date()): number {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return t.getTime() - d.getTime();
}
