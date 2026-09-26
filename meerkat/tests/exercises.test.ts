/**
 * 운동 콘텐츠 품질 검사 (부위별 파일 단위)
 * 한 파일만 검사: REGION=neck npx vitest run tests/exercises.test.ts
 */
import { describe, expect, it } from 'vitest';
import type { Exercise } from '../src/content/exercise-types';
import { PHASE_ORDER } from '../src/content/exercise-types';
import { cycleLength, holdKeyOf, keyTime, mirrorSpec, place, poseAt, type AnimSpec } from '../src/figure/render';
import { solve } from '../src/figure/rig';

const ALL = [...['neck', 'shoulder', 'thoracic', 'core', 'lowback', 'hip', 'legs', 'ankle'].flatMap((r) => [r, `${r}-plus`]), 'release-plus'];
const only = process.env.REGION?.split(',').filter(Boolean);
const files = only?.length ? only : ALL;

const ISSUE_IDS = new Set([
  'fhp', 'roundShoulder', 'kyphosis', 'lordosis', 'flatBack', 'swayback', 'kneeHyperext', 'kneeFlexed', 'headTilt', 'shoulderTilt',
  'pelvicTilt', 'lateralShift', 'kneeValgus', 'kneeVarus', 'neckPain', 'shoulderPain', 'upperBackPain', 'lowBackPain', 'hipPain',
  'kneePain', 'wristPain', 'headache', 'stiffness', 'stress',
]);
const JOINTS = new Set(Object.keys(solve({}).p));
const nonEmpty = (s: string) => typeof s === 'string' && s.trim().length > 0;
const text = (t: { ko: string; en: string } | undefined) => !!t && nonEmpty(t.ko) && nonEmpty(t.en);
const list = (l: { ko: string[]; en: string[] } | undefined, min: number) =>
  !!l && l.ko.length >= min && l.ko.length === l.en.length && l.ko.every(nonEmpty) && l.en.every(nonEmpty);

async function load(file: string): Promise<Exercise[]> {
  const mod = await import(`../src/content/ex/${file}.ts`);
  const arr = Object.values(mod).find(Array.isArray) as Exercise[] | undefined;
  if (!arr) throw new Error(`${file}: no exercise array exported`);
  return arr;
}

function grounded(spec: AnimSpec, mirror: boolean, id: string) {
  const s = mirror ? mirrorSpec(spec) : spec;
  const len = cycleLength(spec);
  for (let i = 0; i < 12; i++) {
    const placed = place(poseAt(spec, (i / 12) * len, mirror), s);
    const ys = Object.values(placed.sk.p).map((v) => v[1]);
    for (const v of Object.values(placed.sk.p)) for (const c of v) expect(Number.isFinite(c), id).toBe(true);
    expect(Math.min(...ys), `${id}${mirror ? ' (mirror)' : ''} below floor`).toBeGreaterThanOrEqual(-0.5);
    expect(Math.max(...ys), id).toBeLessThan(170);
  }
}

describe.each(files)('%s', (file) => {
  it('loads and has exercises', async () => {
    const ex = await load(file);
    expect(ex.length).toBeGreaterThan(0);
  });

  it('every exercise is complete, detailed and bilingual', async () => {
    for (const e of await load(file)) {
      const id = e.id;
      expect(id, id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(text(e.name), `${id} name`).toBe(true);
      expect(PHASE_ORDER, id).toContain(e.phase);
      expect(e.regions.length, id).toBeGreaterThan(0);
      expect(list(e.setup, 2), `${id} setup (≥2 lines, ko/en same length)`).toBe(true);
      expect(list(e.steps, 3), `${id} steps (≥3)`).toBe(true);
      expect(list(e.cues, 2), `${id} cues (≥2)`).toBe(true);
      expect(list(e.mistakes, 2), `${id} mistakes (≥2)`).toBe(true);
      for (const m of e.mistakes.ko) expect(m.includes('→'), `${id} mistake needs "→ fix": ${m}`).toBe(true);
      for (const m of e.mistakes.en) expect(m.includes('→'), `${id} mistake (en) needs "→ fix": ${m}`).toBe(true);
      for (const k of ['why', 'muscles', 'breathing', 'feel', 'easier', 'harder'] as const) expect(text(e[k]), `${id} ${k}`).toBe(true);
      if (e.caution) expect(text(e.caution), `${id} caution`).toBe(true);
    }
  });

  it('targets, doses and equipment are sane', async () => {
    for (const e of await load(file)) {
      const keys = Object.keys(e.targets);
      expect(keys.length, e.id).toBeGreaterThan(0);
      for (const k of keys) {
        expect(ISSUE_IDS.has(k), `${e.id}: unknown target ${k}`).toBe(true);
        const v = e.targets[k as keyof typeof e.targets]!;
        expect(v > 0 && v <= 1, `${e.id}: target ${k}=${v}`).toBe(true);
      }
      const d = e.dose;
      expect(d.sets >= 1 && d.sets <= 4, e.id).toBe(true);
      expect(d.value, e.id).toBeGreaterThan(0);
      if (d.kind === 'reps') expect(d.value <= 20, `${e.id} reps`).toBe(true);
      if (d.kind === 'hold') expect(d.value >= 5 && d.value <= 90, `${e.id} hold`).toBe(true);
      expect([1, 2, 3]).toContain(e.level);
    }
  });

  it('animations: labeled keys, valid overlays, grounded both sides', async () => {
    for (const e of await load(file)) {
      const a = e.anim;
      const id = e.id;
      expect(a.keys.length, `${id} keys`).toBeGreaterThanOrEqual(2);
      expect(a.labels?.length, `${id} labels = keys`).toBe(a.keys.length);
      for (const l of a.labels ?? []) expect(text(l), `${id} label`).toBe(true);
      if (a.durations) expect(a.durations.length, `${id} durations`).toBe(a.keys.length);
      if (a.pauses) expect(a.pauses.length, `${id} pauses`).toBe(a.keys.length);
      expect(a.focus?.length ?? 0, `${id} focus`).toBeGreaterThan(0);
      for (const f of a.focus ?? []) {
        expect(JOINTS.has(f.a) && JOINTS.has(f.b), `${id} focus joints ${f.a}-${f.b}`).toBe(true);
        expect(['stretch', 'work']).toContain(f.kind);
      }
      for (const j of a.trace ?? []) expect(JOINTS.has(j), `${id} trace ${j}`).toBe(true);
      for (const p of a.props ?? []) if (p.kind === 'step' || p.kind === 'table') expect(p.at, `${id} ${p.kind} needs at`).toBeTruthy();
      if (a.holdKey !== undefined) expect(a.holdKey >= 0 && a.holdKey < a.keys.length, `${id} holdKey`).toBe(true);
      expect(keyTime(a, holdKeyOf(a)), id).toBeGreaterThanOrEqual(0);
      expect(cycleLength(a), id).toBeGreaterThan(1);
      grounded(a, false, id);
      if (e.dose.perSide) grounded(a, true, id);
    }
  });
});

if (!only?.length) {
  describe('whole library', () => {
    it('has globally unique ids and good coverage', async () => {
      const all = (await Promise.all(ALL.map(load))).flat();
      const seen = new Set<string>();
      for (const e of all) {
        expect(seen.has(e.id), `duplicate id ${e.id}`).toBe(false);
        seen.add(e.id);
      }
      expect(all.length).toBeGreaterThanOrEqual(90);
      for (const ph of PHASE_ORDER) expect(all.filter((e) => e.phase === ph).length, ph).toBeGreaterThanOrEqual(3);
    });
  });
}
