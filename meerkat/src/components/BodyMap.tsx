import type { PainArea } from '../state/store';
import { tr } from '../i18n';

interface Spot {
  id: PainArea;
  x: number;
  y: number;
  r: number;
}

/** 앞모습(사람의 오른쪽이 화면 왼쪽) */
const FRONT: Spot[] = [
  { id: 'head', x: 100, y: 30, r: 17 },
  { id: 'neck', x: 100, y: 62, r: 10 },
  { id: 'shoulderR', x: 66, y: 82, r: 13 },
  { id: 'shoulderL', x: 134, y: 82, r: 13 },
  { id: 'elbowR', x: 52, y: 142, r: 10 },
  { id: 'elbowL', x: 148, y: 142, r: 10 },
  { id: 'wristR', x: 44, y: 192, r: 10 },
  { id: 'wristL', x: 156, y: 192, r: 10 },
  { id: 'hipR', x: 84, y: 186, r: 13 },
  { id: 'hipL', x: 116, y: 186, r: 13 },
  { id: 'kneeR', x: 84, y: 262, r: 12 },
  { id: 'kneeL', x: 116, y: 262, r: 12 },
  { id: 'ankleR', x: 84, y: 336, r: 10 },
  { id: 'ankleL', x: 116, y: 336, r: 10 },
];

/** 뒷모습(사람의 왼쪽이 화면 왼쪽) */
const BACK: Spot[] = [
  { id: 'neck', x: 100, y: 62, r: 11 },
  { id: 'shoulderL', x: 66, y: 84, r: 13 },
  { id: 'shoulderR', x: 134, y: 84, r: 13 },
  { id: 'upperBack', x: 100, y: 108, r: 17 },
  { id: 'lowBack', x: 100, y: 160, r: 17 },
  { id: 'hipL', x: 82, y: 196, r: 13 },
  { id: 'hipR', x: 118, y: 196, r: 13 },
  { id: 'kneeL', x: 84, y: 262, r: 12 },
  { id: 'kneeR', x: 116, y: 262, r: 12 },
  { id: 'ankleL', x: 84, y: 336, r: 10 },
  { id: 'ankleR', x: 116, y: 336, r: 10 },
];

function painColor(v: number) {
  if (v >= 7) return '#ef4444';
  if (v >= 4) return '#f06e2a';
  return '#f5a524';
}

export function BodyMap({ side, values, onPick }: { side: 'front' | 'back'; values: Partial<Record<PainArea, number>>; onPick: (a: PainArea) => void }) {
  const spots = side === 'front' ? FRONT : BACK;
  const leftLabel = side === 'front' ? tr('오른쪽', 'Right') : tr('왼쪽', 'Left');
  const rightLabel = side === 'front' ? tr('왼쪽', 'Left') : tr('오른쪽', 'Right');
  return (
    <svg viewBox="0 0 200 370" style={{ width: '100%', maxWidth: 260, display: 'block', margin: '0 auto' }} role="group" aria-label={tr('통증 부위 선택', 'Choose painful area')}>
      <g fill="var(--surface-3)" stroke="var(--line)" stroke-width="1.5">
        <circle cx="100" cy="30" r="20" />
        <rect x="92" y="48" width="16" height="16" rx="6" />
        <path d="M60 72 Q100 60 140 72 L146 170 Q100 184 54 170 Z" />
        <rect x="40" y="76" width="18" height="118" rx="9" transform="rotate(6 49 76)" />
        <rect x="142" y="76" width="18" height="118" rx="9" transform="rotate(-6 151 76)" />
        <rect x="72" y="168" width="24" height="176" rx="11" />
        <rect x="104" y="168" width="24" height="176" rx="11" />
        <ellipse cx="82" cy="350" rx="14" ry="7" />
        <ellipse cx="118" cy="350" rx="14" ry="7" />
      </g>
      {side === 'back' && <path d="M100 70 L100 176" stroke="var(--line)" stroke-width="2" stroke-dasharray="4 4" />}
      <text x="10" y="366" font-size="11" fill="var(--text-3)">
        {leftLabel}
      </text>
      <text x="190" y="366" font-size="11" fill="var(--text-3)" text-anchor="end">
        {rightLabel}
      </text>
      {spots.map((s) => {
        const v = values[s.id];
        const on = v !== undefined;
        return (
          <g key={s.id} role="button" tabIndex={0} aria-label={s.id} onClick={() => onPick(s.id)} onKeyDown={(e) => e.key === 'Enter' && onPick(s.id)} style={{ cursor: 'pointer' }}>
            <circle cx={s.x} cy={s.y} r={s.r + 6} fill="transparent" />
            <circle cx={s.x} cy={s.y} r={s.r} fill={on ? painColor(v!) : 'var(--surface)'} fill-opacity={on ? 0.9 : 0.9} stroke={on ? painColor(v!) : 'var(--text-3)'} stroke-width="1.5" stroke-dasharray={on ? '' : '3 3'} />
            {on && (
              <text x={s.x} y={s.y + 4} text-anchor="middle" font-size="11.5" font-weight="800" fill="#fff">
                {v}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export const PAIN_NAMES: Record<PainArea, { ko: string; en: string }> = {
  head: { ko: '머리(두통)', en: 'Head (headache)' },
  neck: { ko: '목', en: 'Neck' },
  shoulderL: { ko: '왼쪽 어깨', en: 'Left shoulder' },
  shoulderR: { ko: '오른쪽 어깨', en: 'Right shoulder' },
  upperBack: { ko: '등(날개뼈 사이)', en: 'Upper back' },
  lowBack: { ko: '허리', en: 'Low back' },
  hipL: { ko: '왼쪽 골반·엉덩이', en: 'Left hip' },
  hipR: { ko: '오른쪽 골반·엉덩이', en: 'Right hip' },
  kneeL: { ko: '왼쪽 무릎', en: 'Left knee' },
  kneeR: { ko: '오른쪽 무릎', en: 'Right knee' },
  wristL: { ko: '왼쪽 손목', en: 'Left wrist' },
  wristR: { ko: '오른쪽 손목', en: 'Right wrist' },
  ankleL: { ko: '왼쪽 발목', en: 'Left ankle' },
  ankleR: { ko: '오른쪽 발목', en: 'Right ankle' },
  elbowL: { ko: '왼쪽 팔꿈치', en: 'Left elbow' },
  elbowR: { ko: '오른쪽 팔꿈치', en: 'Right elbow' },
};
