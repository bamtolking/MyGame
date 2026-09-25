import { describe, it, expect } from 'vitest';
import { World, makeBody, type PhysParams } from '../src/sim/physics';
import { makeRng, range } from '../src/sim/rng';

const P: PhysParams = { gravity: 1900, friction: 0.3, restitution: 0.12, boxW: 360, boxH: 470, substeps: 8, iterations: 2 };
const DT = 1 / 60;

function run(w: World, sec: number) { for (let i = 0; i < Math.round(sec / DT); i++) w.step(DT); }

function maxOverlapRatio(w: World): number {
  let worst = 0;
  const b = w.bodies;
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
    const d = Math.hypot(b[j].x - b[i].x, b[j].y - b[i].y);
    const pen = b[i].r + b[j].r - d;
    if (pen > 0) worst = Math.max(worst, pen / Math.min(b[i].r, b[j].r));
  }
  return worst;
}

function pile(seed: number, n: number, params = P): World {
  const w = new World({ ...params });
  const rng = makeRng(seed);
  const radii = [13, 17, 22, 27, 33, 40, 48];
  for (let i = 0; i < n; i++) {
    const r = radii[Math.floor(range(rng, 0, radii.length))];
    w.add(makeBody(i + 1, 0, range(rng, r, params.boxW - r), -40 - i * 60, r, 0));
    run(w, 0.25);
  }
  run(w, 5);
  return w;
}

describe('physics', () => {
  it('a single cat falls and rests on the floor', () => {
    const w = new World({ ...P });
    const b = makeBody(1, 0, 180, -60, 20, 0);
    w.add(b);
    run(w, 3);
    expect(b.y).toBeGreaterThan(P.boxH - 20 - 0.5);
    expect(b.y).toBeLessThanOrEqual(P.boxH - 20 + 1e-6);
    expect(Math.abs(b.vy)).toBeLessThan(5);
  });

  it('a random pile settles: inside the box, small overlaps, low motion', () => {
    const w = pile(7, 45);
    let ke = 0;
    for (const b of w.bodies) {
      expect(b.x - b.r).toBeGreaterThanOrEqual(-0.01);
      expect(b.x + b.r).toBeLessThanOrEqual(P.boxW + 0.01);
      expect(b.y + b.r).toBeLessThanOrEqual(P.boxH + 0.01);
      ke += (b.vx * b.vx + b.vy * b.vy);
    }
    const rms = Math.sqrt(ke / w.bodies.length);
    const ov = maxOverlapRatio(w);
    console.log(`pile: n=${w.bodies.length} rms speed=${rms.toFixed(2)} max overlap=${(ov * 100).toFixed(1)}%`);
    expect(rms).toBeLessThan(15);
    expect(ov).toBeLessThan(0.12);
  });

  it('heavy cat on top of small cats does not crush through', () => {
    const w = new World({ ...P });
    for (let i = 0; i < 12; i++) w.add(makeBody(i + 1, 0, 15 + i * 30, 470 - 13, 13, 0));
    run(w, 1);
    const big = makeBody(100, 10, 180, -100, 84, 0);
    w.add(big);
    run(w, 4);
    const ov = maxOverlapRatio(w);
    console.log(`crush: big.y=${big.y.toFixed(1)} max overlap=${(ov * 100).toFixed(1)}%`);
    expect(ov).toBeLessThan(0.25);
    for (const b of w.bodies) expect(b.y + b.r).toBeLessThanOrEqual(P.boxH + 0.01);
  });

  it('fast cats do not tunnel through each other', () => {
    const w = new World({ ...P, gravity: 0 });
    const a = makeBody(1, 0, 60, 200, 13, 0);
    const b = makeBody(2, 0, 300, 200, 13, 0);
    a.vx = 2500; b.vx = -2500;
    w.add(a); w.add(b);
    run(w, 0.3);
    expect(a.x).toBeLessThan(b.x);
  });

  it('friction makes cats roll', () => {
    const w = new World({ ...P });
    const b = makeBody(1, 0, 60, 470 - 20, 20, 0);
    b.vx = 300;
    w.add(b);
    run(w, 0.3);
    expect(b.w).toBeGreaterThan(0);
    expect(Math.abs(b.vx - b.w * b.r)).toBeLessThan(10);
  });

  it('is deterministic', () => {
    const a = pile(3, 20), b = pile(3, 20);
    expect(a.bodies.map(x => [x.x, x.y, x.a])).toEqual(b.bodies.map(x => [x.x, x.y, x.a]));
  });

  it('records touching pairs for merge checks', () => {
    const w = new World({ ...P });
    w.add(makeBody(1, 2, 100, 470 - 22, 22, 0));
    w.add(makeBody(2, 2, 100, 470 - 22 - 60, 22, 0));
    let found = false;
    for (let i = 0; i < 60 && !found; i++) { w.step(DT); found = w.touching.some(([x, y]) => x.id === 1 && y.id === 2); }
    expect(found).toBe(true);
  });
});
