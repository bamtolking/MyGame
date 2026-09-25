import { computed, signal } from '@preact/signals';
import { buildRoutine, combineIssues, avoidFlags, hasRedFlag, programWeek, type Routine } from '../routine/generator';
import { dayKey, latestScan, profile, progression, scans, settings } from './store';
import type { Region } from '../content/exercises';

/** 현재 이슈 가중치 (스캔 + 통증 + 목표 + 생활) */
export const issues = computed(() => combineIssues(latestScan.value?.report ?? null, profile.value));

export const avoid = computed(() => avoidFlags(profile.value));

export const firstScanAt = computed(() => (scans.value.length ? scans.value[0].at : null));

export const program = computed(() => programWeek(firstScanAt.value));

/** 오늘 날짜 (자정이 지나면 루틴이 바뀌도록 1분마다 갱신) */
export const today = signal(dayKey());
if (typeof window !== 'undefined') {
  setInterval(() => {
    const k = dayKey();
    if (k !== today.value) today.value = k;
  }, 60_000);
}

/** 루틴 다시 섞기 횟수 (같은 날 다른 조합) */
export const shuffle = signal(0);

export const todayRoutine = computed<Routine>(() =>
  buildRoutine({
    issues: issues.value,
    minutes: settings.value.sessionMinutes,
    level: progression.value.level,
    equipment: settings.value.equipment,
    avoid: avoid.value,
    mode: 'daily',
    seed: `${today.value}#${shuffle.value}`,
    lastDone: progression.value.lastDone,
    hidden: progression.value.hidden,
    favorites: progression.value.favorites,
    emphasis: latestScan.value?.report.emphasis,
    week: program.value.week,
    gentle: hasRedFlag(profile.value),
  }),
);

export function focusRoutine(regions: Region[], minutes = 7): Routine {
  return buildRoutine({
    issues: issues.value,
    minutes,
    level: progression.value.level,
    equipment: settings.value.equipment,
    avoid: avoid.value,
    mode: 'focus',
    focusRegions: regions,
    seed: `${today.value}:${regions.join(',')}`,
    lastDone: progression.value.lastDone,
    hidden: progression.value.hidden,
    favorites: progression.value.favorites,
    emphasis: latestScan.value?.report.emphasis,
    week: program.value.week,
    gentle: hasRedFlag(profile.value),
  });
}

export function deskAuto(minutes = 5): Routine {
  return buildRoutine({
    issues: issues.value,
    minutes,
    level: progression.value.level,
    equipment: settings.value.equipment.filter((e) => e !== 'mat'),
    avoid: avoid.value,
    mode: 'desk',
    seed: `${today.value}:desk`,
    lastDone: progression.value.lastDone,
    hidden: progression.value.hidden,
    emphasis: latestScan.value?.report.emphasis,
  });
}

/** 플레이어에 넘길 루틴 */
export const activeRoutine = signal<Routine | null>(null);

/** 다음 스캔 권장까지 남은 일수 (7일 주기) */
export const rescanIn = computed(() => {
  const last = latestScan.value;
  if (!last) return 0;
  const days = Math.floor((Date.now() - last.at) / 864e5);
  return Math.max(0, 7 - days);
});
