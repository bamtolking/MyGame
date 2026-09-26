import { describe, expect, it } from 'vitest';
import { EXERCISES, estimateSeconds, PHASE_ORDER } from '../src/content/exercises';
import { ANIMALS } from '../src/content/types';
import { METRIC_INFO } from '../src/content/metrics';
import { NORMS } from '../src/analysis/norms';
import { place, poseAt, cycleLength } from '../src/figure/render';
import { buildRoutine, combineIssues, avoidFlags, DESK_PRESETS, deskRoutine, eligible, programWeek, type RoutineInput } from '../src/routine/generator';
import { FAMILY_GROUPS, familyOf } from '../src/routine/families';
import type { Profile } from '../src/state/store';

const ISSUE_IDS = new Set([
  'fhp', 'roundShoulder', 'kyphosis', 'lordosis', 'flatBack', 'swayback', 'kneeHyperext', 'kneeFlexed', 'headTilt', 'shoulderTilt',
  'pelvicTilt', 'lateralShift', 'kneeValgus', 'kneeVarus', 'neckPain', 'shoulderPain', 'upperBackPain', 'lowBackPain', 'hipPain',
  'kneePain', 'wristPain', 'headache', 'stiffness', 'stress',
]);

const text = (t: { ko: string; en: string }) => t.ko.trim().length > 0 && t.en.trim().length > 0;

describe('exercise library', () => {
  it('has unique ids and complete bilingual content', () => {
    const ids = new Set<string>();
    for (const e of EXERCISES) {
      expect(ids.has(e.id), e.id).toBe(false);
      ids.add(e.id);
      expect(text(e.name), e.id).toBe(true);
      expect(text(e.why), e.id).toBe(true);
      expect(text(e.muscles), e.id).toBe(true);
      if (e.caution) expect(text(e.caution), e.id).toBe(true);
      for (const arr of [e.steps, e.cues, e.mistakes]) {
        expect(arr.ko.length, e.id).toBeGreaterThan(0);
        expect(arr.en.length, e.id).toBeGreaterThan(0);
        expect(arr.ko.every((s) => s.trim().length > 0)).toBe(true);
      }
      expect(PHASE_ORDER).toContain(e.phase);
    }
    expect(EXERCISES.length).toBeGreaterThanOrEqual(40);
  });

  it('targets only known issues and has sane doses', () => {
    for (const e of EXERCISES) {
      const keys = Object.keys(e.targets);
      expect(keys.length, e.id).toBeGreaterThan(0);
      for (const k of keys) expect(ISSUE_IDS.has(k), `${e.id}:${k}`).toBe(true);
      expect(e.dose.sets).toBeGreaterThanOrEqual(1);
      expect(e.dose.value).toBeGreaterThan(0);
      const s = estimateSeconds(e);
      expect(s, e.id).toBeGreaterThan(15);
      expect(s, e.id).toBeLessThan(420);
    }
  });

  it('every animation produces a grounded, finite figure', () => {
    for (const e of EXERCISES) {
      const len = cycleLength(e.anim);
      expect(len, e.id).toBeGreaterThan(0.5);
      for (let i = 0; i < 6; i++) {
        const placed = place(poseAt(e.anim, (i / 6) * len), e.anim);
        const ys = Object.values(placed.sk.p).map((v) => v[1]);
        for (const v of Object.values(placed.sk.p)) for (const c of v) expect(Number.isFinite(c), e.id).toBe(true);
        expect(Math.min(...ys), e.id).toBeGreaterThanOrEqual(-0.5);
        // 사람 크기(키 100) 범위 안
        expect(Math.max(...ys), e.id).toBeLessThan(160);
      }
    }
  });

  it('coaching specs are consistent', () => {
    for (const e of EXERCISES.filter((x) => x.coach)) {
      const c = e.coach!;
      if (c.mode === 'reps') {
        expect(c.rest, e.id).toBeDefined();
        expect(c.peak, e.id).toBeDefined();
        expect(Math.sign(c.peak! - c.rest!), e.id).toBe(c.dir);
      } else expect(c.target, e.id).toBeDefined();
      expect(text(c.hint)).toBe(true);
    }
    expect(EXERCISES.filter((x) => x.coach).length).toBeGreaterThanOrEqual(6);
  });

  it('type and metric content is complete', () => {
    for (const a of Object.values(ANIMALS)) {
      expect(text(a.name)).toBe(true);
      expect(text(a.looks)).toBe(true);
      expect(text(a.proTip)).toBe(true);
    }
    for (const id of Object.keys(NORMS)) expect(METRIC_INFO[id as keyof typeof METRIC_INFO], id).toBeDefined();
  });
});

const baseProfile: Profile = {
  nickname: '',
  birthYear: 1994,
  sex: null,
  heightCm: 170,
  job: 'desk',
  sitHours: 9,
  phoneHours: 5,
  exercise: 'none',
  goals: ['neck'],
  pain: {},
  redFlags: [],
  safetyCheckedAt: null,
  onboarded: true,
  createdAt: 0,
};

function input(over: Partial<RoutineInput> = {}): RoutineInput {
  return {
    issues: { fhp: 1, roundShoulder: 0.6, stiffness: 0.3 },
    minutes: 10,
    level: 1,
    equipment: ['wall', 'chair', 'towel', 'mat'],
    avoid: new Set(),
    mode: 'daily',
    seed: '2026-09-25',
    ...over,
  };
}

describe('routine generator', () => {
  it('targets the main problem and fits the time budget', () => {
    const r = buildRoutine(input());
    expect(r.items.length).toBeGreaterThanOrEqual(4);
    expect(r.items.some((it) => (it.exercise.targets.fhp ?? 0) >= 0.7)).toBe(true);
    expect(r.seconds).toBeLessThan(10 * 60 * 1.25);
    expect(r.seconds).toBeGreaterThan(10 * 60 * 0.5);
    expect(r.title.ko).toContain('거북목');
  });

  it('orders by corrective phase', () => {
    const r = buildRoutine(input({ minutes: 15 }));
    const idx = r.items.map((it) => PHASE_ORDER.indexOf(it.exercise.phase));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });

  it('is deterministic for the same seed', () => {
    const a = buildRoutine(input()).items.map((i) => i.exercise.id);
    const b = buildRoutine(input()).items.map((i) => i.exercise.id);
    expect(a).toEqual(b);
  });

  it('desk mode only uses desk-friendly moves', () => {
    const r = buildRoutine(input({ mode: 'desk', minutes: 5 }));
    expect(r.items.length).toBeGreaterThan(0);
    for (const it of r.items) expect(it.exercise.desk, it.exercise.id).toBe(true);
  });

  it('respects level, equipment and safety filters', () => {
    const r = buildRoutine(input({ issues: { lowBackPain: 1, lordosis: 0.8 }, avoid: new Set(['wristPain', 'kneePain']), equipment: ['chair'] }));
    for (const it of r.items) {
      expect(it.exercise.level).toBe(1);
      expect(it.exercise.avoid?.includes('wristPain') ?? false).toBe(false);
      expect(it.exercise.equipment.every((q) => q === 'chair')).toBe(true);
    }
  });

  it('adds side emphasis notes for asymmetry', () => {
    const r = buildRoutine(input({ issues: { shoulderTilt: 1, neckPain: 0.8 }, emphasis: { upperTrap: 'right' } }));
    const trap = r.items.find((it) => it.exercise.id === 'upper-trap-stretch' || it.exercise.id === 'levator-stretch');
    expect(trap?.note?.ko).toContain('오른쪽');
  });

  it('combines scan, pain, goals and lifestyle into issue weights', () => {
    const issues = combineIssues(null, { ...baseProfile, pain: { lowBack: 6 } });
    expect(issues.lowBackPain).toBeGreaterThan(0.6);
    expect(issues.fhp).toBeGreaterThan(0.3);
    expect(issues.stiffness).toBeGreaterThan(0.3);
  });

  it('derives avoid flags from pain and cautions', () => {
    const f = avoidFlags({ ...baseProfile, pain: { kneeL: 5, wristR: 4, lowBack: 8 }, redFlags: ['pregnant'] });
    expect(f.has('kneePain')).toBe(true);
    expect(f.has('wristPain')).toBe(true);
    expect(f.has('lowBackSevere')).toBe(true);
    expect(f.has('pregnant')).toBe(true);
    expect(f.has('kneeSevere')).toBe(false);
  });

  it('builds every desk preset', () => {
    for (const p of DESK_PRESETS) {
      const r = deskRoutine(p);
      expect(r.items.length, p.id).toBeGreaterThan(0);
      expect(r.seconds, p.id).toBeLessThan(240);
    }
  });

  it('every exercise is reachable by some profile', () => {
    const all = input({ level: 3, equipment: ['wall', 'chair', 'towel', 'mat', 'band', 'ball', 'foamRoller'] });
    for (const e of EXERCISES) expect(eligible(e, all), e.id).toBe(true);
  });

  it('movement families only name real exercises', () => {
    const ids = new Set(EXERCISES.map((e) => e.id));
    for (const [family, list] of Object.entries(FAMILY_GROUPS)) {
      for (const id of list) expect(ids.has(id), `${family}: ${id}`).toBe(true);
    }
  });

  it('rotates moves day to day without near-duplicates or losing strength work', () => {
    const profiles: Partial<RoutineInput>[] = [
      {},
      { issues: { hipPain: 0.7, kneeValgus: 0.7, pelvicTilt: 0.4 }, minutes: 15, level: 2 },
      { issues: { lowBackPain: 0.9, lordosis: 0.6, stiffness: 0.3 } },
      { issues: { kyphosis: 0.8, roundShoulder: 0.6, upperBackPain: 0.5 }, minutes: 15, level: 3 },
    ];
    for (const over of profiles) {
      const lastDone: Record<string, number> = {};
      const seen = new Set<string>();
      const day0 = Date.UTC(2026, 8, 1, 9);
      for (let d = 0; d < 7; d++) {
        const now = day0 + d * 864e5;
        const r = buildRoutine(input({ ...over, seed: `d${d}`, lastDone, now }));
        const fams = r.items.map((it) => familyOf(it.exercise.id));
        expect(new Set(fams).size, fams.join()).toBe(fams.length);
        expect(r.items.some((it) => it.exercise.phase === 'activate' || it.exercise.phase === 'integrate'), JSON.stringify(over)).toBe(true);
        for (const it of r.items) {
          seen.add(it.exercise.id);
          lastDone[it.exercise.id] = now;
        }
      }
      expect(seen.size, JSON.stringify(over)).toBeGreaterThanOrEqual(12);
    }
  });

  it('computes program week', () => {
    const t0 = Date.UTC(2026, 0, 1);
    expect(programWeek(t0, t0).week).toBe(1);
    expect(programWeek(t0, t0 + 8 * 864e5).week).toBe(2);
    expect(programWeek(t0, t0 + 60 * 864e5).week).toBe(4);
    expect(programWeek(null).week).toBe(1);
  });
});
