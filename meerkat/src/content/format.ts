import type { Dose } from './exercise-types';
import { tr } from '../i18n';

/** 초 → '45초', '2분', '1분 50초' (분 단위로 떨어지지 않으면 초까지) */
export function timeText(sec: number): string {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  if (m === 0) return tr(`${s}초`, `${s} s`);
  if (s === 0) return tr(`${m}분`, `${m} min`);
  return tr(`${m}분 ${s}초`, `${m} min ${s} s`);
}

/** 처방 용량을 짧은 문장으로 */
export function doseText(d: Dose): string {
  const side = d.perSide ? tr(' · 양쪽', ' · each side') : '';
  if (d.kind === 'time') return timeText(d.value);
  if (d.kind === 'hold') {
    return tr(`${d.value}초 × ${d.sets}세트${side}`, `${d.value} s × ${d.sets}${side}`);
  }
  const hold = d.holdSec ? tr(` (${d.holdSec}초 버티기)`, ` (${d.holdSec} s hold)`) : '';
  return tr(`${d.value}회 × ${d.sets}세트${hold}${side}`, `${d.value} reps × ${d.sets}${hold}${side}`);
}
