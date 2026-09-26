/**
 * 맞춤 루틴 처방기
 *
 * 스캔 결과 · 통증 · 목표 · 생활 습관 → 이슈 가중치 → 운동 점수 → 교정 순서대로 시간에 맞춰 구성
 * (호흡 → 풀기 → 늘리기 → 움직이기 → 깨우기 → 통합)
 */
import type { IssueId, PostureReport } from '../analysis/report';
import { EXERCISES, estimateSeconds, PHASE_ORDER, type AvoidFlag, type Dose, type Exercise, type Phase, type Position, type Region } from '../content/exercises';
import type { Text } from '../i18n';
import type { Equipment, Goal, PainArea, Profile } from '../state/store';
import { familyOf } from './families';

export type Issues = Partial<Record<IssueId, number>>;

export interface RoutineItem {
  exercise: Exercise;
  dose: Dose;
  note?: Text;
}

export interface Routine {
  key: string;
  kind: 'daily' | 'desk' | 'focus';
  title: Text;
  subtitle: Text;
  items: RoutineItem[];
  seconds: number;
  focus: IssueId[];
}

// ─────────────────────────────────────────────
// 이슈 가중치 합치기
// ─────────────────────────────────────────────

const PAIN_TO_ISSUE: Record<PainArea, IssueId> = {
  head: 'headache',
  neck: 'neckPain',
  shoulderL: 'shoulderPain',
  shoulderR: 'shoulderPain',
  upperBack: 'upperBackPain',
  lowBack: 'lowBackPain',
  hipL: 'hipPain',
  hipR: 'hipPain',
  kneeL: 'kneePain',
  kneeR: 'kneePain',
  wristL: 'wristPain',
  wristR: 'wristPain',
  elbowL: 'wristPain',
  elbowR: 'wristPain',
  ankleL: 'kneeValgus',
  ankleR: 'kneeValgus',
};

const GOAL_ISSUES: Record<Goal, Issues> = {
  neck: { fhp: 0.6, neckPain: 0.3, headache: 0.2 },
  shoulder: { roundShoulder: 0.6, kyphosis: 0.3, shoulderTilt: 0.2 },
  back: { kyphosis: 0.4, lowBackPain: 0.4, upperBackPain: 0.3 },
  pelvis: { lordosis: 0.5, pelvicTilt: 0.4, lateralShift: 0.3 },
  pain: {},
  overall: { fhp: 0.25, roundShoulder: 0.25, lordosis: 0.2, lateralShift: 0.15, stiffness: 0.2 },
  desk: { stiffness: 0.5, fhp: 0.3, roundShoulder: 0.2, stress: 0.2 },
};

export function combineIssues(report: PostureReport | null, profile: Profile): Issues {
  const out: Issues = { stiffness: 0.2, stress: 0.15 };
  const add = (id: IssueId, v: number) => {
    out[id] = Math.max(out[id] ?? 0, v);
  };
  if (report) for (const [k, v] of Object.entries(report.issues)) add(k as IssueId, v ?? 0);
  for (const [area, nrs] of Object.entries(profile.pain)) {
    if (!nrs) continue;
    add(PAIN_TO_ISSUE[area as PainArea], Math.min(1.2, 0.35 + (nrs / 10) * 0.9));
  }
  for (const g of profile.goals) for (const [k, v] of Object.entries(GOAL_ISSUES[g])) add(k as IssueId, v ?? 0);
  if ((profile.sitHours ?? 0) >= 8) {
    add('stiffness', 0.45);
    add('lordosis', 0.25);
    add('fhp', 0.25);
  }
  if ((profile.phoneHours ?? 0) >= 4) add('fhp', 0.35);
  return out;
}

// ─────────────────────────────────────────────
// 안전 필터
// ─────────────────────────────────────────────

export const RED_FLAGS: { id: string; emergency: boolean; text: Text }[] = [
  { id: 'caudaEquina', emergency: true, text: { ko: '대소변 조절이 어렵거나 사타구니·엉덩이 안쪽 감각이 둔해졌어요', en: 'Trouble controlling bladder/bowel or numbness in the groin/saddle area' } },
  { id: 'chest', emergency: true, text: { ko: '가슴 통증·압박감, 숨이 차는 증상이 있어요', en: 'Chest pain or pressure, or shortness of breath' } },
  { id: 'neuroNeck', emergency: true, text: { ko: '목을 움직일 때 어지럼·복시·말 어눌함·삼킴 곤란이 생겨요', en: 'Dizziness, double vision, slurred speech or trouble swallowing with neck movement' } },
  { id: 'weakness', emergency: false, text: { ko: '팔이나 다리에 점점 심해지는 힘 빠짐·마비감이 있어요', en: 'Progressive weakness or numbness in the arms or legs' } },
  { id: 'trauma', emergency: false, text: { ko: '최근 넘어지거나 사고 후 생긴 통증이에요', en: 'Pain that started after a recent fall or accident' } },
  { id: 'systemic', emergency: false, text: { ko: '이유 없는 체중 감소·발열이 있거나, 암 치료 이력이 있어요', en: 'Unexplained weight loss or fever, or a history of cancer' } },
  { id: 'nightPain', emergency: false, text: { ko: '자세를 바꿔도 줄지 않는 밤중 통증이 있어요', en: 'Night pain that doesn’t ease with any position' } },
];

export const CAUTIONS: { id: AvoidFlag; text: Text }[] = [
  { id: 'radiating', text: { ko: '통증이나 저림이 팔·다리로 뻗쳐요', en: 'Pain or tingling spreads down an arm or leg' } },
  { id: 'pregnant', text: { ko: '임신 중이에요', en: 'I’m pregnant' } },
  { id: 'dizzy', text: { ko: '고개를 젖히면 어지러운 편이에요', en: 'I get dizzy tilting my head back' } },
  { id: 'balance', text: { ko: '균형 잡기가 어렵거나 최근 자주 넘어져요', en: 'My balance is poor or I’ve fallen recently' } },
];

export function hasEmergency(profile: Profile): boolean {
  return profile.redFlags.some((f) => RED_FLAGS.find((r) => r.id === f)?.emergency);
}

export function hasRedFlag(profile: Profile): boolean {
  return profile.redFlags.some((f) => RED_FLAGS.some((r) => r.id === f));
}

export function avoidFlags(profile: Profile): Set<AvoidFlag> {
  const s = new Set<AvoidFlag>();
  const p = profile.pain;
  const max = (...a: (number | undefined)[]) => Math.max(0, ...a.map((x) => x ?? 0));
  if (max(p.neck) >= 7) s.add('neckSevere');
  if (max(p.shoulderL, p.shoulderR) >= 7) s.add('shoulderSevere');
  if (max(p.lowBack) >= 7) s.add('lowBackSevere');
  if (max(p.kneeL, p.kneeR) >= 7) s.add('kneeSevere');
  if (max(p.kneeL, p.kneeR) >= 4) s.add('kneePain');
  if (max(p.wristL, p.wristR, p.elbowL, p.elbowR) >= 4) s.add('wristPain');
  for (const f of profile.redFlags) if (CAUTIONS.some((c) => c.id === f)) s.add(f as AvoidFlag);
  return s;
}

// ─────────────────────────────────────────────
// 난수 (날짜 시드)
// ─────────────────────────────────────────────

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────────────────────────────────
// 처방
// ─────────────────────────────────────────────

export interface RoutineInput {
  issues: Issues;
  minutes: number;
  level: 1 | 2 | 3;
  equipment: Equipment[];
  avoid: Set<AvoidFlag>;
  mode: 'daily' | 'desk' | 'focus';
  focusRegions?: Region[];
  seed: string;
  lastDone?: Record<string, number>;
  hidden?: string[];
  favorites?: string[];
  emphasis?: PostureReport['emphasis'];
  now?: number;
  /** 프로그램 주차(1~4): 초반엔 늘리기, 후반엔 깨우기·통합 비중 증가 */
  week?: number;
  /** 위험 신호가 있을 때: 호흡·가벼운 스트레칭·가동성만 */
  gentle?: boolean;
}

const POSITION_RANK: Record<Position, number> = {
  standing: 0,
  wall: 1,
  seated: 2,
  kneeling: 3,
  quadruped: 4,
  prone: 5,
  sideLying: 6,
  supine: 7,
};

/** 고르는 순서 (진행 순서는 PHASE_ORDER) — 시간이 빠듯하면 뒤쪽 단계부터 빠져요 */
const PICK_ORDER: Phase[] = ['stretch', 'activate', 'mobility', 'integrate', 'breath', 'release'];

/** 시간별 단계 구성 (슬롯 수) */
function quotas(minutes: number, week: number): Record<Phase, number> {
  const late = week >= 3;
  if (minutes <= 5) return { breath: 0, release: 0, stretch: late ? 1 : 2, mobility: 0, activate: 1, integrate: late ? 1 : 0 };
  if (minutes <= 10) return { breath: 1, release: 0, stretch: late ? 1 : 2, mobility: 1, activate: late ? 2 : 1, integrate: 1 };
  return { breath: 1, release: 1, stretch: late ? 2 : 3, mobility: 1, activate: late ? 3 : 2, integrate: late ? 2 : 1 };
}

export function relevance(e: Exercise, issues: Issues): number {
  let s = 0;
  for (const [k, w] of Object.entries(e.targets)) s += (issues[k as IssueId] ?? 0) * (w ?? 0);
  return s;
}

export function eligible(e: Exercise, input: Pick<RoutineInput, 'level' | 'equipment' | 'avoid' | 'mode' | 'hidden' | 'focusRegions' | 'gentle'>): boolean {
  if (e.level > input.level) return false;
  if (input.hidden?.includes(e.id)) return false;
  if (e.avoid?.some((a) => input.avoid.has(a))) return false;
  const have = new Set<Equipment>(input.equipment);
  if (e.equipment.some((q) => !have.has(q))) return false;
  if (input.mode === 'desk' && !e.desk) return false;
  if (input.focusRegions?.length && !e.regions.some((r) => input.focusRegions!.includes(r))) return false;
  if (input.gentle && (e.phase === 'activate' || e.phase === 'integrate' || e.level > 1)) return false;
  return true;
}

function adjustDose(e: Exercise, minutes: number, isTop: boolean): Dose {
  const d = { ...e.dose };
  if (minutes <= 5 && d.kind !== 'time' && !isTop) d.sets = 1;
  if (d.kind === 'time' && minutes <= 10) d.value = Math.min(d.value, 45);
  return d;
}

function emphasisNote(e: Exercise, emphasis?: PostureReport['emphasis']): Text | undefined {
  if (!emphasis) return undefined;
  const sideKo = (s: 'left' | 'right') => (s === 'left' ? '왼쪽' : '오른쪽');
  const sideEn = (s: 'left' | 'right') => (s === 'left' ? 'left' : 'right');
  if ((e.id === 'upper-trap-stretch' || e.id === 'levator-stretch') && emphasis.upperTrap) {
    const s = emphasis.upperTrap;
    return { ko: `스캔 결과 ${sideKo(s)} 어깨가 더 높아요. ${sideKo(s)}을 늘리는 쪽을 한 세트 더 해요.`, en: `Your ${sideEn(s)} shoulder sits higher — add one extra set stretching the ${sideEn(s)} side.` };
  }
  if ((e.id === 'standing-side-bend' || e.id === 'side-plank-knee') && emphasis.sideBend) {
    const s = emphasis.sideBend;
    return { ko: `${sideKo(s)} 골반이 더 높아요. ${sideKo(s)} 옆구리가 늘어나는 쪽을 한 세트 더 해요.`, en: `Your ${sideEn(s)} hip sits higher — add one extra set lengthening the ${sideEn(s)} side.` };
  }
  return undefined;
}

export const ISSUE_THEME: Partial<Record<IssueId, Text>> = {
  fhp: { ko: '거북목 탈출', en: 'Tech-neck escape' },
  roundShoulder: { ko: '어깨 활짝', en: 'Open shoulders' },
  kyphosis: { ko: '등 쭉 펴기', en: 'Straight back' },
  lordosis: { ko: '골반 바로 세우기', en: 'Pelvis reset' },
  swayback: { ko: '골반 중심 찾기', en: 'Centre your pelvis' },
  shoulderTilt: { ko: '어깨 수평 맞추기', en: 'Level shoulders' },
  pelvicTilt: { ko: '골반 좌우 균형', en: 'Level pelvis' },
  lateralShift: { ko: '좌우 균형', en: 'Left–right balance' },
  kneeValgus: { ko: '무릎 정렬', en: 'Knee alignment' },
  kneeVarus: { ko: '무릎 정렬', en: 'Knee alignment' },
  kneeHyperext: { ko: '무릎 잠금 풀기', en: 'Unlock the knees' },
  neckPain: { ko: '목 편안하게', en: 'Neck relief' },
  shoulderPain: { ko: '어깨 편안하게', en: 'Shoulder relief' },
  upperBackPain: { ko: '등 뻐근함 풀기', en: 'Upper-back relief' },
  lowBackPain: { ko: '허리 편안하게', en: 'Low-back relief' },
  headache: { ko: '두통 완화', en: 'Headache relief' },
  hipPain: { ko: '골반·고관절 편안하게', en: 'Hip relief' },
  kneePain: { ko: '무릎 편안하게', en: 'Knee relief' },
  wristPain: { ko: '손목 풀기', en: 'Wrist relief' },
  stiffness: { ko: '전신 리프레시', en: 'Full-body refresh' },
  stress: { ko: '긴장 풀기', en: 'Unwind' },
};

export function topIssues(issues: Issues, n = 3): IssueId[] {
  return (Object.entries(issues) as [IssueId, number][])
    .filter(([, v]) => v > 0.25)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

export function buildRoutine(input: RoutineInput): Routine {
  const now = input.now ?? Date.now();
  const rand = rng(input.seed);
  const budget = input.minutes * 60;
  const week = input.week ?? 1;
  const tops = topIssues(input.issues, 3);
  const top = tops[0] ?? 'stiffness';

  const hasHistory = !!input.lastDone && Object.keys(input.lastDone).length > 0;
  const pool = EXERCISES.filter((e) => eligible(e, input)).map((e) => {
    let score = relevance(e, input.issues);
    if (e.targets[top]) score += 0.15 * (e.targets[top] ?? 0);
    if (input.favorites?.includes(e.id)) score += 0.15;
    const last = input.lastDone?.[e.id];
    if (last) {
      // 최근에 한 동작은 잠시 쉬게 해서 날마다 조합이 바뀌도록
      const h = (now - last) / 3.6e6;
      if (h < 20) score -= 0.3;
      else if (h < 44) score -= 0.18;
      else if (h < 68) score -= 0.06;
    } else if (hasHistory) score += 0.04; // 아직 안 해 본 동작은 살짝 우대
    score += (rand() - 0.5) * 0.24;
    return { e, score };
  });

  const q = quotas(input.minutes, week);
  if (input.mode === 'desk') {
    q.breath = 0;
    q.release = Math.min(q.release, 1);
  }
  const isTop = (e: Exercise) => (e.targets[top] ?? 0) >= 0.7;
  // 실제로 처방될 양(짧은 루틴은 세트 줄임)으로 시간 계산
  const cost = (e: Exercise) => estimateSeconds({ ...e, dose: adjustDose(e, input.minutes, isTop(e)) });
  type Cand = (typeof pool)[number];
  const chosen: Cand[] = [];
  const families = new Set<string>();
  let used = 0;
  // 아직 안 골랐고, 비슷한 동작도 안 들어간 후보
  const open = (c: Cand) => !chosen.includes(c) && !families.has(familyOf(c.e.id));
  const take = (c: Cand) => {
    chosen.push(c);
    families.add(familyOf(c.e.id));
    used += cost(c.e);
  };
  // 단계마다 번갈아 하나씩 고르기 — 늘리기가 시간을 다 써서 근력 운동이 빠지는 일이 없도록
  const rounds = Math.max(...Object.values(q));
  for (let round = 0; round < rounds; round++) {
    for (const phase of PICK_ORDER) {
      if (round >= q[phase]) continue;
      const c = pool
        .filter((c) => c.e.phase === phase && open(c) && (c.score > 0.05 || phase === 'breath'))
        .sort((a, b) => b.score - a.score)
        .find((c) => used + cost(c.e) <= budget * 1.12);
      if (c) take(c);
    }
  }
  // 가장 중요한 문제를 직접 겨냥하는 운동이 없으면 추가
  if (!chosen.some((c) => isTop(c.e))) {
    const best = pool.filter((c) => open(c) && isTop(c.e)).sort((a, b) => b.score - a.score)[0];
    if (best) take(best);
  }
  // 남은 시간 채우기
  const rest = pool.filter((c) => !chosen.includes(c)).sort((a, b) => b.score - a.score);
  for (const c of rest) {
    if (used >= budget * 0.9) break;
    if (c.score <= 0.15) break;
    if (open(c) && used + cost(c.e) <= budget * 1.1) take(c);
  }
  // 너무 넘치면 점수 낮은 것부터 제거 (최소 2개 유지)
  while (used > budget * 1.2 && chosen.length > 2) {
    const worst = [...chosen].sort((a, b) => a.score - b.score)[0];
    chosen.splice(chosen.indexOf(worst), 1);
    used -= cost(worst.e);
  }

  chosen.sort((a, b) => {
    const pa = PHASE_ORDER.indexOf(a.e.phase), pb = PHASE_ORDER.indexOf(b.e.phase);
    if (pa !== pb) return pa - pb;
    return POSITION_RANK[a.e.position] - POSITION_RANK[b.e.position];
  });

  const items: RoutineItem[] = chosen.map((c) => ({
    exercise: c.e,
    dose: adjustDose(c.e, input.minutes, (c.e.targets[top] ?? 0) >= 0.7),
    note: emphasisNote(c.e, input.emphasis),
  }));
  const seconds = items.reduce((s, it) => s + estimateSeconds({ ...it.exercise, dose: it.dose }), 0);
  const theme = ISSUE_THEME[top] ?? ISSUE_THEME.stiffness!;
  const title: Text =
    input.mode === 'desk'
      ? { ko: `사무실 ${theme.ko}`, en: `Desk ${theme.en.toLowerCase()}` }
      : { ko: `${theme.ko} 루틴`, en: `${theme.en} routine` };
  const mins = Math.max(1, Math.round(seconds / 60));
  const subtitle: Text = {
    ko: `${mins}분 · ${items.length}가지 동작`,
    en: `${mins} min · ${items.length} moves`,
  };
  return { key: `${input.mode}:${input.seed}`, kind: input.mode, title, subtitle, items, seconds, focus: tops };
}

// ─────────────────────────────────────────────
// 1분 리셋 (사무실 프리셋)
// ─────────────────────────────────────────────

export interface DeskPreset {
  id: string;
  emoji: string;
  title: Text;
  desc: Text;
  items: [string, Partial<Dose>][];
}

export const DESK_PRESETS: DeskPreset[] = [
  {
    id: 'neck',
    emoji: '🐢',
    title: { ko: '목 리셋', en: 'Neck reset' },
    desc: { ko: '턱 당기기 + 목 옆 늘리기', en: 'Chin tucks + side-neck stretch' },
    items: [
      ['chin-tuck', { sets: 1, value: 6, holdSec: 3 }],
      ['upper-trap-stretch', { sets: 1, value: 15 }],
    ],
  },
  {
    id: 'shoulder',
    emoji: '🦐',
    title: { ko: '어깨 리셋', en: 'Shoulder reset' },
    desc: { ko: '어깨 돌리기 + 가슴 열기 + 날개뼈 모으기', en: 'Rolls + chest opener + blade squeeze' },
    items: [
      ['shoulder-rolls', { sets: 1, value: 8 }],
      ['chest-opener', { sets: 1, value: 20 }],
      ['scap-squeeze', { sets: 1, value: 8, holdSec: 2 }],
    ],
  },
  {
    id: 'back',
    emoji: '🦆',
    title: { ko: '허리 리셋', en: 'Low-back reset' },
    desc: { ko: '비틀기 + 고관절 앞 늘리기 + 옆구리', en: 'Twist + hip flexor + side bend' },
    items: [
      ['seated-twist', { sets: 1, value: 15 }],
      ['standing-hip-flexor', { sets: 1, value: 20 }],
      ['standing-side-bend', { sets: 1, value: 15 }],
    ],
  },
  {
    id: 'upperback',
    emoji: '📚',
    title: { ko: '등 펴기 리셋', en: 'Upper-back reset' },
    desc: { ko: '의자 등받이 등 펴기 + 벽 자세 리셋', en: 'Chair extension + wall reset' },
    items: [
      ['chair-tspine-extension', { sets: 1, value: 6, holdSec: 2 }],
      ['wall-posture-reset', { sets: 1, value: 30 }],
    ],
  },
  {
    id: 'wrist',
    emoji: '⌨️',
    title: { ko: '손목 리셋', en: 'Wrist reset' },
    desc: { ko: '손목 앞뒤 스트레칭', en: 'Wrist flexor & extensor stretch' },
    items: [['wrist-stretch', { sets: 1, value: 15 }]],
  },
  {
    id: 'breath',
    emoji: '🌬️',
    title: { ko: '긴장 풀기', en: 'Unwind' },
    desc: { ko: '360° 복식 호흡 1분', en: 'One minute of 360° breathing' },
    items: [['breath-360', { value: 60 }]],
  },
];

export function deskRoutine(preset: DeskPreset): Routine {
  const items: RoutineItem[] = preset.items
    .map(([id, dose]) => {
      const e = EXERCISES.find((x) => x.id === id);
      return e ? { exercise: e, dose: { ...e.dose, ...dose } as Dose } : null;
    })
    .filter((x): x is RoutineItem => !!x);
  const seconds = items.reduce((s, it) => s + estimateSeconds({ ...it.exercise, dose: it.dose }), 0);
  const mins = Math.max(1, Math.round(seconds / 60));
  return {
    key: `desk:${preset.id}`,
    kind: 'desk',
    title: preset.title,
    subtitle: { ko: `${mins}분 · ${preset.desc.ko}`, en: `${mins} min · ${preset.desc.en}` },
    items,
    seconds,
    focus: [],
  };
}

/** 운동 하나만 하는 루틴 */
export function singleRoutine(e: Exercise): Routine {
  const seconds = estimateSeconds(e);
  return {
    key: `single:${e.id}`,
    kind: 'focus',
    title: e.name,
    subtitle: { ko: `${Math.max(1, Math.round(seconds / 60))}분`, en: `${Math.max(1, Math.round(seconds / 60))} min` },
    items: [{ exercise: e, dose: e.dose }],
    seconds,
    focus: [],
  };
}

/** 스캔 첫날 기준 프로그램 주차 (1~4, 이후 유지) */
export function programWeek(firstScanAt: number | null, now = Date.now()): { week: number; day: number } {
  if (!firstScanAt) return { week: 1, day: 1 };
  const day = Math.floor((now - firstScanAt) / 864e5) + 1;
  return { week: Math.min(4, Math.floor((day - 1) / 7) + 1), day: Math.min(28, day) };
}
