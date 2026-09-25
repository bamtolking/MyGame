import type { Dose } from './exercise-types';
import { tr } from '../i18n';

/** 처방 용량을 짧은 문장으로 */
export function doseText(d: Dose): string {
  const side = d.perSide ? tr(' · 양쪽', ' · each side') : '';
  if (d.kind === 'time') {
    return d.value >= 60 ? tr(`${Math.round(d.value / 60)}분`, `${Math.round(d.value / 60)} min`) : tr(`${d.value}초`, `${d.value} s`);
  }
  if (d.kind === 'hold') {
    return tr(`${d.value}초 × ${d.sets}세트${side}`, `${d.value} s × ${d.sets}${side}`);
  }
  const hold = d.holdSec ? tr(` (${d.holdSec}초 버티기)`, ` (${d.holdSec} s hold)`) : '';
  return tr(`${d.value}회 × ${d.sets}세트${hold}${side}`, `${d.value} reps × ${d.sets}${hold}${side}`);
}
