import { describe, expect, it } from 'vitest';
import { analyzeFront, analyzeSide, checkFrame, classifyView, grade, medianFrame, motionBetween } from '../src/analysis/analyze';
import { buildReport } from '../src/analysis/report';
import { LM } from '../src/pose/landmarks';
import { frontPose, jitter, sideMask, sidePose, SYNTH } from './synth';

const metric = (a: { metrics: { id: string }[] }, id: string) => a.metrics.find((m) => m.id === id) as any;

describe('grade()', () => {
  it('maps thresholds to levels and is monotonic', () => {
    expect(grade('headForward', 5).level).toBe(0);
    expect(grade('headForward', 13).level).toBe(1);
    expect(grade('headForward', 20).level).toBe(2);
    expect(grade('headForward', 30).level).toBe(3);
    let prev = -1;
    for (let v = 0; v < 40; v += 0.5) {
      const bad = grade('headForward', v).badness;
      expect(bad).toBeGreaterThanOrEqual(prev);
      prev = bad;
    }
  });
  it('ignores the negative direction when no negative norm exists', () => {
    const r = grade('headForward', -20);
    expect(r.level).toBe(0);
    expect(r.badness).toBe(0);
  });
  it('grades the negative side with its own thresholds', () => {
    const r = grade('shoulderForward', -7);
    expect(r.level).toBe(2);
    expect(r.dir).toBe(-1);
  });
});

describe('view classification & framing', () => {
  it('detects front vs side', () => {
    expect(classifyView(frontPose()).view).toBe('front');
    expect(classifyView(sidePose()).view).toBe('side');
  });
  it('accepts a well-framed person and flags feet cut off', () => {
    expect(checkFrame(frontPose(), 'front').ok).toBe(true);
    const f = frontPose();
    for (const i of [LM.leftHeel, LM.rightHeel, LM.leftFootIndex, LM.rightFootIndex, LM.leftAnkle, LM.rightAnkle]) {
      f.pts[i] = { ...f.pts[i], v: 0.05 };
    }
    expect(checkFrame(f, 'front').problems).toContain('feetCut');
  });
  it('asks to turn when view does not match', () => {
    expect(checkFrame(frontPose(), 'side').problems).toContain('turnSide');
    expect(checkFrame(sidePose(), 'front').problems).toContain('turnFront');
  });
  it('flags too far when the person is small in the frame', () => {
    const f = frontPose();
    const small = { ...f, h: f.h * 3 };
    expect(checkFrame(small, 'front').problems).toContain('tooFar');
  });
  it('median of jittered frames stays close and motion is small for identical frames', () => {
    const base = frontPose();
    const frames = [1, 2, 3, 4, 5, 6, 7].map((s) => jitter(base, 6, s));
    const m = medianFrame(frames)!;
    expect(Math.abs(m.pts[LM.leftShoulder].x - base.pts[LM.leftShoulder].x)).toBeLessThan(5);
    expect(motionBetween(base, base)).toBe(0);
  });
});

describe('front analysis', () => {
  it('ideal posture is all normal', () => {
    const a = analyzeFront(frontPose());
    for (const m of a.metrics) expect(m.level, m.id).toBe(0);
  });
  it('measures shoulder tilt with the correct side', () => {
    const a = analyzeFront(frontPose({ shoulderTilt: 4.5 }));
    const m = metric(a, 'shoulderTilt');
    expect(m.value).toBeCloseTo(4.5, 1);
    expect(m.level).toBe(2);
    expect(m.dir).toBe(1);
    expect(m.extra.cm).toBeGreaterThan(1);
    const b = analyzeFront(frontPose({ shoulderTilt: -4.5 }));
    expect(metric(b, 'shoulderTilt').dir).toBe(-1);
  });
  it('measures pelvic and head tilt', () => {
    const a = analyzeFront(frontPose({ pelvicTilt: 3, headTilt: -6 }));
    expect(metric(a, 'pelvicTilt').value).toBeCloseTo(3, 1);
    expect(metric(a, 'headTilt').value).toBeCloseTo(-6, 1);
    expect(metric(a, 'headTilt').level).toBe(2);
  });
  it('detects knee valgus (+) and varus (−)', () => {
    const v = metric(analyzeFront(frontPose({ kneeValgus: 8 })), 'kneeAlign');
    expect(v.value).toBeGreaterThan(6.5);
    expect(v.value).toBeLessThan(9.5);
    const r = metric(analyzeFront(frontPose({ kneeValgus: -8 })), 'kneeAlign');
    expect(r.value).toBeLessThan(-6.5);
  });
  it('detects lateral trunk shift', () => {
    const m = metric(analyzeFront(frontPose({ trunkShiftPx: 0.03 * SYNTH.H })), 'trunkShift');
    expect(m.value).toBeGreaterThan(9);
    expect(m.dir).toBe(1);
  });
  it('is invariant to horizontal position in the frame', () => {
    const a = analyzeFront(frontPose({ shoulderTilt: 3, cx: 300 }));
    const b = analyzeFront(frontPose({ shoulderTilt: 3, cx: 700 }));
    expect(metric(a, 'shoulderTilt').value).toBeCloseTo(metric(b, 'shoulderTilt').value, 5);
  });
  it('converts pixels to cm using the entered height', () => {
    const a = analyzeFront(frontPose(), { heightCm: 170 });
    expect(a.geo.cmPerPx * SYNTH.H).toBeGreaterThan(165);
    expect(a.geo.cmPerPx * SYNTH.H).toBeLessThan(175);
  });
});

describe('side analysis', () => {
  it('ideal posture is normal', () => {
    const a = analyzeSide(sidePose());
    for (const m of a.metrics) expect(m.level, m.id).toBe(0);
    expect(a.geo.facing).toBe(1);
    expect(a.geo.side).toBe('left');
  });
  it('measures forward head angle', () => {
    const a = analyzeSide(sidePose({ headForward: 20 }));
    const m = metric(a, 'headForward');
    expect(m.value).toBeCloseTo(20, 0);
    expect(m.level).toBe(2);
    expect(m.extra.cm).toBeGreaterThan(4);
  });
  it('gives the same result when facing the other way', () => {
    const r = analyzeSide(sidePose({ headForward: 17, shoulderForwardPx: 40, facing: 1 }));
    const l = analyzeSide(sidePose({ headForward: 17, shoulderForwardPx: 40, facing: -1 }));
    expect(l.geo.facing).toBe(-1);
    for (const id of ['headForward', 'shoulderForward', 'pelvisForward', 'kneeExtension']) {
      expect(metric(l, id).value, id).toBeCloseTo(metric(r, id).value, 4);
    }
  });
  it('detects rounded (forward) shoulders and swayback', () => {
    const cmPerPx = 168 / SYNTH.H;
    const a = analyzeSide(sidePose({ shoulderForwardPx: 6 / cmPerPx }));
    expect(metric(a, 'shoulderForward').value).toBeCloseTo(6, 0);
    expect(metric(a, 'shoulderForward').level).toBe(2);
    const s = analyzeSide(sidePose({ pelvisForwardPx: 6 / cmPerPx, shoulderForwardPx: -7 / cmPerPx }));
    expect(metric(s, 'pelvisForward').level).toBe(2);
    expect(metric(s, 'shoulderForward').dir).toBe(-1);
  });
  it('detects knee hyperextension', () => {
    const a = analyzeSide(sidePose({ kneeHyper: 10 }));
    const m = metric(a, 'kneeExtension');
    expect(m.value).toBeGreaterThan(8);
    expect(m.dir).toBe(1);
  });
  it('reads back curvature from the silhouette (virtual flexicurve)', () => {
    const base = sidePose();
    const flat = analyzeSide(sideMask(base, { kyph: 0, lord: 0 }));
    const round = analyzeSide(sideMask(base, { kyph: 45, lord: 0 }));
    const deep = analyzeSide(sideMask(base, { kyph: 0, lord: 60 }));
    const k0 = metric(flat, 'kyphosis').value;
    const k1 = metric(round, 'kyphosis').value;
    const l0 = metric(flat, 'lordosis').value;
    const l1 = metric(deep, 'lordosis').value;
    expect(k0).toBeLessThan(3);
    expect(k1).toBeGreaterThan(k0 + 8);
    expect(l0).toBeLessThan(3);
    expect(l1).toBeGreaterThan(l0 + 8);
    expect(round.geo.back?.contour.length).toBeGreaterThan(20);
  });
  it('silhouette works when facing left too', () => {
    const base = sidePose({ facing: -1 });
    const round = analyzeSide(sideMask(base, { kyph: 45, lord: 0, facing: -1 }));
    expect(metric(round, 'kyphosis').value).toBeGreaterThan(8);
  });
});

describe('report', () => {
  it('ideal body → meerkat with a high score', () => {
    const r = buildReport(analyzeFront(frontPose()), analyzeSide(sidePose()), { age: 30 });
    expect(r.type.primary).toBe('meerkat');
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.postureAge).toBeLessThan(30);
  });
  it('forward head → turtle, with shrimp as secondary when shoulders round too', () => {
    const cmPerPx = 168 / SYNTH.H;
    const r = buildReport(analyzeFront(frontPose()), analyzeSide(sidePose({ headForward: 22, shoulderForwardPx: 7 / cmPerPx })), { age: 30 });
    expect(r.type.primary).toBe('turtle');
    expect(r.type.secondary).toBe('shrimp');
    expect(r.issues.fhp).toBeGreaterThan(0.5);
    expect(r.issues.roundShoulder).toBeGreaterThan(0.5);
    expect(r.score).toBeLessThan(80);
    expect(r.postureAge!).toBeGreaterThan(30);
  });
  it('asymmetry → flamingo with the right emphasis side', () => {
    const r = buildReport(analyzeFront(frontPose({ shoulderTilt: 5, pelvicTilt: -4 })), analyzeSide(sidePose()), {});
    expect(r.type.primary).toBe('flamingo');
    expect(r.emphasis.upperTrap).toBe('right');
    expect(r.emphasis.sideBend).toBe('left');
    expect(r.postureAge).toBeNull();
  });
  it('score decreases as posture worsens', () => {
    let prev = 101;
    for (const hf of [0, 10, 15, 20, 25, 30]) {
      const r = buildReport(null, analyzeSide(sidePose({ headForward: hf })), {});
      expect(r.score).toBeLessThanOrEqual(prev);
      prev = r.score;
    }
  });
  it('single-view reports still produce a sane score', () => {
    const r = buildReport(analyzeFront(frontPose({ shoulderTilt: 6 })), null, { age: 40 });
    expect(r.views).toEqual(['front']);
    expect(r.score).toBeGreaterThan(25);
    expect(r.score).toBeLessThan(90);
  });
});
