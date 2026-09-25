import type { IssueId } from '../analysis/report';
import type { AnimSpec } from '../figure/render';
import type { Text } from '../i18n';
import type { Equipment } from '../state/store';

/** 교정 운동 순서(NASM CES 연속체 응용): 호흡 → 풀기 → 늘리기 → 움직이기 → 깨우기 → 통합 */
export type Phase = 'breath' | 'release' | 'stretch' | 'mobility' | 'activate' | 'integrate';

export type Position = 'standing' | 'seated' | 'wall' | 'supine' | 'prone' | 'quadruped' | 'sideLying' | 'kneeling';

export type Region = 'neck' | 'shoulder' | 'upperBack' | 'chest' | 'lowBack' | 'core' | 'hip' | 'glute' | 'knee' | 'ankle' | 'wrist' | 'fullBody';

/** 안전 필터: 해당 상태면 처방에서 제외 */
export type AvoidFlag =
  | 'neckSevere'
  | 'shoulderSevere'
  | 'lowBackSevere'
  | 'kneeSevere'
  | 'kneePain'
  | 'wristPain'
  | 'radiating'
  | 'pregnant'
  | 'dizzy'
  | 'balance';

export interface Dose {
  kind: 'hold' | 'reps' | 'time';
  sets: number;
  /** hold: 버티는 초, reps: 횟수, time: 총 초 */
  value: number;
  /** reps: 1회 동작 시간(초) */
  tempo?: number;
  /** reps: 매 회 끝자세에서 버티는 초 */
  holdSec?: number;
  perSide?: boolean;
  /** 세트 사이 휴식(초) */
  rest?: number;
}

export type CoachMetric =
  | 'kneeAngle'
  | 'hipAngle'
  | 'armRaise'
  | 'headTilt'
  | 'trunkSide'
  | 'footLift'
  | 'chinTuck'
  | 'hipAbduction'
  | 'heelRaise';

export interface CoachSpec {
  view: 'front' | 'side';
  metric: CoachMetric;
  mode: 'reps' | 'hold';
  /** reps: 휴식 구간 경계와 최고점 경계 */
  rest?: number;
  peak?: number;
  /** hold: 목표 이상(dir 1) 또는 이하(dir -1) 유지 */
  target?: number;
  /** 최고점이 휴식값보다 크면 1, 작으면 -1 */
  dir: 1 | -1;
  hint: Text;
  more: Text;
  good: Text;
}

export interface Exercise {
  id: string;
  name: Text;
  phase: Phase;
  position: Position;
  regions: Region[];
  /** 이 운동이 겨냥하는 문제와 관련도(0~1) */
  targets: Partial<Record<IssueId, number>>;
  /** 반드시 필요한 도구 */
  equipment: Equipment[];
  level: 1 | 2 | 3;
  dose: Dose;
  /** 사무실(의자·서서)에서 가능 */
  desk?: boolean;
  steps: { ko: string[]; en: string[] };
  /** 운동 중 음성 코칭 */
  cues: { ko: string[]; en: string[] };
  mistakes: { ko: string[]; en: string[] };
  why: Text;
  muscles: Text;
  caution?: Text;
  avoid?: AvoidFlag[];
  anim: AnimSpec;
  coach?: CoachSpec;
}

export const PHASE_ORDER: Phase[] = ['breath', 'release', 'stretch', 'mobility', 'activate', 'integrate'];

export const PHASE_LABEL: Record<Phase, Text> = {
  breath: { ko: '호흡', en: 'Breathe' },
  release: { ko: '풀기', en: 'Release' },
  stretch: { ko: '늘리기', en: 'Stretch' },
  mobility: { ko: '움직이기', en: 'Mobilize' },
  activate: { ko: '깨우기', en: 'Activate' },
  integrate: { ko: '통합', en: 'Integrate' },
};

export const REGION_LABEL: Record<Region, Text> = {
  neck: { ko: '목', en: 'Neck' },
  shoulder: { ko: '어깨', en: 'Shoulders' },
  upperBack: { ko: '등', en: 'Upper back' },
  chest: { ko: '가슴', en: 'Chest' },
  lowBack: { ko: '허리', en: 'Low back' },
  core: { ko: '코어', en: 'Core' },
  hip: { ko: '고관절', en: 'Hips' },
  glute: { ko: '엉덩이', en: 'Glutes' },
  knee: { ko: '무릎', en: 'Knees' },
  ankle: { ko: '발목', en: 'Ankles' },
  wrist: { ko: '손목', en: 'Wrists' },
  fullBody: { ko: '전신', en: 'Full body' },
};

export const EQUIPMENT_LABEL: Record<Equipment, Text> = {
  wall: { ko: '벽', en: 'Wall' },
  chair: { ko: '의자', en: 'Chair' },
  towel: { ko: '수건', en: 'Towel' },
  foamRoller: { ko: '폼롤러', en: 'Foam roller' },
  band: { ko: '밴드', en: 'Band' },
  ball: { ko: '마사지볼', en: 'Massage ball' },
  mat: { ko: '매트', en: 'Mat' },
};
