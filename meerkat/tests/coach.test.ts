import { describe, expect, it } from 'vitest';
import { Coach, metricValue } from '../src/coach/tracker';
import type { CoachSpec } from '../src/content/exercise-types';
import { exercise } from '../src/content/exercises';
import { LM } from '../src/pose/landmarks';
import { frontPose, sidePose } from './synth';

const squat: CoachSpec = exercise('squat')!.coach!;
const balance: CoachSpec = exercise('single-leg-balance')!.coach!;

/** 무릎 각도 시계열: 180 → 90 → 180 을 n번 */
function squatSeries(n: number, depth = 90, fps = 30, period = 2.4): number[] {
  const out: number[] = [];
  const frames = Math.round(period * fps);
  for (let r = 0; r < n; r++) for (let i = 0; i < frames; i++) out.push(180 - (180 - depth) * Math.sin((Math.PI * i) / frames));
  for (let i = 0; i < fps; i++) out.push(180);
  return out;
}

describe('rep counter', () => {
  it('counts full-depth squats', () => {
    const c = new Coach(squat);
    let s;
    squatSeries(5).forEach((v, i) => (s = c.updateValue(v, i / 30)));
    expect(s!.reps).toBe(5);
  });
  it('does not count shallow reps and asks for more depth', () => {
    const c = new Coach(squat);
    let s;
    let cued = false;
    squatSeries(3, 135, 30, 4).forEach((v, i) => {
      s = c.updateValue(v, i / 30);
      if (s.cue === 'more') cued = true;
    });
    expect(s!.reps).toBe(0);
    expect(cued).toBe(true);
  });
  it('ignores jitter around the thresholds', () => {
    const c = new Coach(squat);
    let s;
    for (let i = 0; i < 120; i++) s = c.updateValue(160 + Math.sin(i) * 4, i / 30);
    expect(s!.reps).toBe(0);
  });
  it('reports lost tracking', () => {
    const c = new Coach(squat);
    let s;
    for (let i = 0; i < 40; i++) s = c.updateValue(null, i / 30);
    expect(s!.phase).toBe('lost');
  });
});

describe('hold timer', () => {
  it('accumulates only while the pose is held', () => {
    const c = new Coach(balance);
    let s;
    for (let i = 0; i <= 90; i++) s = c.updateValue(0.08, i / 30); // 3초 유지
    for (let i = 91; i <= 150; i++) s = c.updateValue(0.0, i / 30); // 내려놓음
    expect(s!.holdSec).toBeGreaterThan(2.7);
    expect(s!.holdSec).toBeLessThan(3.4);
    expect(s!.inPose).toBe(false);
  });
});

describe('pose metrics', () => {
  it('knee angle is ~180 standing and arm raise is negative with arms down', () => {
    expect(metricValue('kneeAngle', sidePose())).toBeGreaterThan(170);
    expect(metricValue('armRaise', frontPose())).toBeLessThan(0);
  });
  it('foot lift detects a raised foot', () => {
    const f = frontPose();
    expect(metricValue('footLift', f)).toBeLessThan(0.01);
    f.pts[LM.rightAnkle] = { ...f.pts[LM.rightAnkle], y: f.pts[LM.rightAnkle].y - 120 };
    expect(metricValue('footLift', f)).toBeGreaterThan(0.05);
  });
  it('head tilt reflects the synthetic tilt', () => {
    expect(metricValue('headTilt', frontPose({ headTilt: 15 }))).toBeGreaterThan(13);
  });
});
