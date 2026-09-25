import { computed } from '@preact/signals';
import type { FrontAnalysis, SideAnalysis } from '../analysis/analyze';
import type { PostureReport } from '../analysis/report';
import { persisted } from '../lib/persist';

// ─────────────────────────────────────────────
// 프로필
// ─────────────────────────────────────────────

export type Goal = 'neck' | 'shoulder' | 'back' | 'pelvis' | 'pain' | 'overall' | 'desk';
export type PainArea =
  | 'head'
  | 'neck'
  | 'shoulderL'
  | 'shoulderR'
  | 'upperBack'
  | 'lowBack'
  | 'hipL'
  | 'hipR'
  | 'kneeL'
  | 'kneeR'
  | 'wristL'
  | 'wristR'
  | 'ankleL'
  | 'ankleR'
  | 'elbowL'
  | 'elbowR';

export interface Profile {
  nickname: string;
  birthYear: number | null;
  sex: 'f' | 'm' | 'x' | null;
  heightCm: number | null;
  job: 'desk' | 'student' | 'standing' | 'active' | 'other' | null;
  sitHours: number | null;
  phoneHours: number | null;
  exercise: 'none' | 'some' | 'often' | null;
  goals: Goal[];
  /** 현재 통증 부위와 강도(0~10) */
  pain: Partial<Record<PainArea, number>>;
  /** 체크된 위험 신호 id */
  redFlags: string[];
  /** 위험 신호·통증 체크를 마친 시각 */
  safetyCheckedAt: number | null;
  onboarded: boolean;
  createdAt: number;
}

export const profile = persisted<Profile>('profile', {
  nickname: '',
  birthYear: null,
  sex: null,
  heightCm: null,
  job: null,
  sitHours: null,
  phoneHours: null,
  exercise: null,
  goals: [],
  pain: {},
  redFlags: [],
  safetyCheckedAt: null,
  onboarded: false,
  createdAt: Date.now(),
});

export const age = computed(() => {
  const y = profile.value.birthYear;
  return y ? new Date().getFullYear() - y : null;
});

// ─────────────────────────────────────────────
// 설정
// ─────────────────────────────────────────────

export type Equipment = 'wall' | 'chair' | 'towel' | 'foamRoller' | 'band' | 'ball' | 'mat';

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  voice: boolean;
  voiceRate: number;
  sound: boolean;
  haptics: boolean;
  sessionMinutes: 5 | 10 | 15;
  equipment: Equipment[];
  reminder: { enabled: boolean; time: string };
  deskBreak: { enabled: boolean; everyMin: number; from: string; to: string };
  expert: { enabled: boolean; center: string; name: string };
  coachCamera: boolean;
}

export const settings = persisted<Settings>('settings', {
  theme: 'system',
  voice: true,
  voiceRate: 1,
  sound: true,
  haptics: true,
  sessionMinutes: 10,
  equipment: ['wall', 'chair', 'towel', 'mat'],
  reminder: { enabled: false, time: '21:00' },
  deskBreak: { enabled: false, everyMin: 60, from: '09:00', to: '18:00' },
  expert: { enabled: false, center: '', name: '' },
  coachCamera: true,
});

// ─────────────────────────────────────────────
// 스캔 기록
// ─────────────────────────────────────────────

export interface ScanRecord {
  id: string;
  at: number;
  heightCm: number | null;
  age: number | null;
  /** 전문가 모드에서 회원 이름 등 메모 */
  label?: string;
  front: FrontAnalysis | null;
  side: SideAnalysis | null;
  report: PostureReport;
  /** 사진 크기 (오버레이 좌표계) */
  size: { front?: [number, number]; side?: [number, number] };
  /** 사진을 저장했는지 (IndexedDB: `${id}:front`, `${id}:side`) */
  hasPhoto: { front: boolean; side: boolean };
}

export const scans = persisted<ScanRecord[]>('scans', []);
export const latestScan = computed(() => scans.value.length ? scans.value[scans.value.length - 1] : null);

export function saveScan(rec: ScanRecord) {
  scans.value = [...scans.value.filter((s) => s.id !== rec.id), rec].sort((a, b) => a.at - b.at);
}

export function removeScan(id: string) {
  scans.value = scans.value.filter((s) => s.id !== id);
}

// ─────────────────────────────────────────────
// 운동 기록
// ─────────────────────────────────────────────

export interface SessionLog {
  id: string;
  at: number;
  kind: 'daily' | 'desk' | 'focus' | 'single';
  title: string;
  exercises: { id: string; done: boolean; reps?: number; seconds?: number }[];
  durationSec: number;
  painBefore?: number | null;
  painAfter?: number | null;
  feel?: 'easy' | 'ok' | 'hard' | null;
}

export const sessions = persisted<SessionLog[]>('sessions', []);

export function logSession(s: SessionLog) {
  sessions.value = [...sessions.value, s];
}

// ─────────────────────────────────────────────
// 통증 기록
// ─────────────────────────────────────────────

export interface PainLog {
  at: number;
  entries: Partial<Record<PainArea, number>>;
}

export const painLogs = persisted<PainLog[]>('painLogs', []);

// ─────────────────────────────────────────────
// 프로그램 진행(난이도 적응)
// ─────────────────────────────────────────────

export interface Progression {
  level: 1 | 2 | 3;
  /** 쉬움/힘듦 연속 응답 수 → 레벨 조정 */
  easyStreak: number;
  hardStreak: number;
  /** 최근 운동 id → 마지막 수행 시각 (다양성) */
  lastDone: Record<string, number>;
  /** 사용자가 제외한 운동 */
  hidden: string[];
  /** 즐겨찾기 */
  favorites: string[];
}

export const progression = persisted<Progression>('progression', {
  level: 1,
  easyStreak: 0,
  hardStreak: 0,
  lastDone: {},
  hidden: [],
  favorites: [],
});

// ─────────────────────────────────────────────
// 날짜 도우미 · 연속 기록
// ─────────────────────────────────────────────

export function dayKey(t: number | Date = Date.now()): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const activeDays = computed(() => new Set(sessions.value.map((s) => dayKey(s.at))));

/** 오늘(또는 어제)까지 이어진 연속 운동 일수 */
export const streak = computed(() => {
  const days = activeDays.value;
  let n = 0;
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d))) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
});

export const doneToday = computed(() => activeDays.value.has(dayKey()));

export const totalMinutes = computed(() => Math.round(sessions.value.reduce((s, x) => s + x.durationSec, 0) / 60));

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
