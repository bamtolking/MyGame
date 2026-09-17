import { describe, it, expect } from 'vitest';
import Matter from 'matter-js';
import { LevelSession, runShots } from '../src/sim/session';
import { World } from '../src/sim/world';
import { previewTrajectory, shotToVelocity, dragToShot, clampDrag } from '../src/sim/launcher';
import type { LevelDef } from '../src/sim/types';
import { GROUND_Y, LAUNCH, JUDGE } from '../src/data/physics';
import { LAUNCHER, standing, target, hangingWeight, block, hinge, ledge, ramp, ballOnRamp, rampStop } from '../src/data/levels/util';

const base = (over: Partial<LevelDef>): LevelDef => ({ id: 99, key: 'T', version: 1, title: 't', subtitle: '', launcher: LAUNCHER, shots: 2, bodies: [], goals: [], stars: { three: 1, two: 2 }, hints: [], solutionRef: 'x', ...over });

describe('물리 안정성', () => {
  it('아무 입력 없이 10초 기다려도 세워 둔 기둥이 유지된다', () => {
    const lv = base({ bodies: [target('t1', 400, GROUND_Y, 30, 140)], goals: [{ body: 't1', judge: 'topple' }] });
    const s = new LevelSession(lv);
    const e = s.world.mustEntry('t1');
    const y0 = e.body.position.y;
    for (let i = 0; i < 600; i++) s.step();
    expect(Math.abs(e.body.position.y - y0)).toBeLessThan(0.5);
    expect(Math.abs(e.body.angle)).toBeLessThan(0.01);
    expect(s.goalsDone).toBe(0);
    expect(s.state).toBe('aiming');
    s.dispose();
  });

  it('최대 속도 발사체가 두께 22px 블록을 통과하지 않는다', () => {
    for (const a of [0, 10, 20, 30, 40]) {
      const lv = base({ bodies: [block('wall', 300, GROUND_Y - 250, 22, 500, 'wood', { static: true })] });
      const s = new LevelSession(lv);
      s.launch({ angleDeg: a, power: 1 });
      let maxX = 0;
      for (let i = 0; i < 180; i++) { s.step(); for (const p of s.world.projectiles) if (!p.removed) maxX = Math.max(maxX, p.body.position.x); }
      expect(maxX).toBeLessThan(300);
      s.dispose();
    }
  });

  it('밧줄 절단은 실제 제약 해제로 이어지고 같은 밧줄은 한 번만 잘린다', () => {
    const wt = hangingWeight('w1', 'r1', 300, 200, 200);
    const lv = base({ bodies: [wt.body], ropes: [wt.rope] });
    const s = new LevelSession(lv);
    const c0 = s.world.counts().constraints;
    expect(c0).toBe(1);
    const rope = s.world.ropes.get('r1')!;
    const ends = s.world.cutRope(rope);
    expect(ends).not.toBeNull();
    expect(s.world.cutRope(rope)).toBeNull();
    expect(s.world.counts().constraints).toBe(0);
    const y0 = s.world.mustEntry('w1').body.position.y;
    for (let i = 0; i < 60; i++) s.step();
    expect(s.world.mustEntry('w1').body.position.y).toBeGreaterThan(y0 + 100);
    s.dispose();
  });

  it('빠른 발사체가 밧줄을 지나가면 스윕 판정으로 잘린다', () => {
    const wt = hangingWeight('w1', 'r1', 300, 150, 250);
    const lv = base({ bodies: [wt.body], ropes: [wt.rope] });
    const s = new LevelSession(lv);
    s.launch({ angleDeg: 70, power: 1 });
    let cutAt = -1;
    for (let i = 0; i < 120 && cutAt < 0; i++) { s.step(); if (s.drainEvents().some((e) => e.t === 'ropeCut')) cutAt = i; }
    expect(cutAt).toBeGreaterThan(0);
    s.dispose();
  });

  it('멀리 지나가는 발사체는 밧줄을 자르지 않는다', () => {
    const wt = hangingWeight('w1', 'r1', 450, 150, 200);
    const lv = base({ bodies: [wt.body], ropes: [wt.rope] });
    const s = new LevelSession(lv);
    s.launch({ angleDeg: 5, power: 0.5 });
    for (let i = 0; i < 240; i++) s.step();
    expect(s.world.ropes.get('r1')!.cut).toBe(false);
    s.dispose();
  });

  it('회전하는 물체에 붙은 밧줄 연결점이 물체를 따라 움직인다', () => {
    const lv = base({
      bodies: [block('plank', 300, 700, 260, 22, 'wood', { role: 'plank' }), block('w1', 180, 800, 40, 40, 'metal', { role: 'weight' })],
      hinges: [hinge('h1', 'plank', { x: 300, y: 700 })],
      ropes: [{ kind: 'rope', id: 'r1', a: { body: 'plank', x: 180, y: 711 }, b: { body: 'w1', x: 180, y: 780 } }],
    });
    const s = new LevelSession(lv);
    for (let i = 0; i < 120; i++) s.step();
    const plank = s.world.mustEntry('plank').body;
    const { a } = s.world.ropeEndpoints(s.world.ropes.get('r1')!);
    // 연결점은 발판 중심에서 -120,+11 을 발판 각도만큼 회전한 위치여야 한다
    const expected = Matter.Vector.add(plank.position, Matter.Vector.rotate({ x: -120, y: 11 }, plank.angle));
    expect(Math.abs(a.x - expected.x)).toBeLessThan(0.01);
    expect(Math.abs(a.y - expected.y)).toBeLessThan(0.01);
    expect(Math.abs(plank.angle)).toBeGreaterThan(0.05); // 추 때문에 실제로 기울었음
    s.dispose();
  });

  it('시소 축은 추가 떨어져도 이동하지 않는다', () => {
    const wt = hangingWeight('w1', 'r1', 420, 150, 300);
    const lv = base({
      bodies: [block('plank', 300, 780, 260, 22, 'wood', { role: 'plank' }), ledge('stopL', 190, 791, 30, 40, 'stone'), wt.body],
      hinges: [hinge('h1', 'plank', { x: 300, y: 780 })], ropes: [wt.rope],
    });
    const s = new LevelSession(lv);
    s.world.cutRope(s.world.ropes.get('r1')!);
    let maxDrift = 0;
    for (let i = 0; i < 240; i++) {
      s.step();
      const h = s.world.hinges.get('h1')!; const b = h.entry.body;
      const p = { x: b.position.x + h.constraint.pointB.x, y: b.position.y + h.constraint.pointB.y };
      maxDrift = Math.max(maxDrift, Math.hypot(p.x - 300, p.y - 780));
    }
    expect(maxDrift).toBeLessThan(2);
    s.dispose();
  });

  it('공이 경사면 이음새에서 비정상적으로 튀지 않는다', () => {
    const rp = ramp('ramp', 100, GROUND_Y - 150, 220, 150, 'right');
    const lv = base({ bodies: [rp, ledge('back', 90, GROUND_Y - 150, 20, 150), ballOnRamp('ball', rp, 130, 24), rampStop('stop', rp, 165, 12, 30, 'stone')] });
    const s = new LevelSession(lv);
    s.world.removeEntry(s.world.mustEntry('stop')); Matter.Sleeping.set(s.world.mustEntry('ball').body, false);
    let maxUp = 0;
    for (let i = 0; i < 240; i++) { s.step(); const b = s.world.mustEntry('ball').body; if (b.position.x > 330) maxUp = Math.max(maxUp, -Matter.Body.getVelocity(b).y); }
    expect(maxUp).toBeLessThan(1.5); // 90 px/s 미만의 작은 튐만 허용
    expect(s.world.mustEntry('ball').body.position.x).toBeGreaterThan(400); // 실제로 굴러 내려감
    s.dispose();
  });

  it('잠든 블록은 굴러온 공에 밀려 다시 움직인다(충돌 시 깨어남)', () => {
    const lv = base({ bodies: [standing('b', 300, GROUND_Y, 40, 40, 'wood'), { kind: 'ball', id: 'ball', x: 240, y: GROUND_Y - 24, r: 24, material: 'iron' }] });
    const s = new LevelSession(lv);
    const b = s.world.mustEntry('b').body, ball = s.world.mustEntry('ball').body;
    expect(b.isSleeping).toBe(true);
    Matter.Sleeping.set(ball, false);
    Matter.Body.setVelocity(ball, { x: 5, y: 0 }); Matter.Body.setAngularVelocity(ball, 5 / 24); // 구르는 쇠공
    for (let i = 0; i < 90; i++) s.step();
    expect(b.isSleeping).toBe(false);
    expect(b.position.x).toBeGreaterThan(310);
    s.dispose();
  });
});

describe('발사와 미리보기', () => {
  it('짧은 당김은 취소되고 최대 당김은 제한된다', () => {
    expect(dragToShot({ x: -5, y: 5 })).toBeNull();
    const c = clampDrag({ x: -400, y: 300 });
    expect(Math.hypot(c.x, c.y)).toBeCloseTo(LAUNCH.maxDrag, 5);
    const shot = dragToShot({ x: -400, y: 300 })!;
    expect(shot.power).toBe(1);
    expect(shot.angleDeg).toBeCloseTo(Math.atan2(300, 400) * 180 / Math.PI, 1); // 당김의 반대(오른쪽 위)
  });

  it('조준 미리보기가 실제 초기 비행 궤적과 일치한다', () => {
    const lv = base({ bodies: [] });
    const s = new LevelSession(lv);
    const shot = { angleDeg: 40, power: 0.8 };
    const preview = previewTrajectory(lv.launcher, shot);
    s.launch(shot);
    const proj = s.world.projectiles[0].body;
    // 미리보기 점은 previewSeconds 동안 previewPoints개, 균등 간격
    const totalSub = Math.round(LAUNCH.previewSeconds * 60);
    const every = Math.max(1, Math.round(totalSub / LAUNCH.previewPoints));
    let maxErr = 0;
    for (let i = 1, k = 0; i <= totalSub && k < preview.length; i++) {
      s.step();
      if (i % every === 0) { const p = preview[k++]; maxErr = Math.max(maxErr, Math.hypot(p.x - proj.position.x, p.y - proj.position.y)); }
    }
    expect(maxErr).toBeLessThan(1.5);
    s.dispose();
  });

  it('발사 속도가 각도·세기에서 일관되게 계산된다', () => {
    const v = shotToVelocity({ angleDeg: 30, power: 0.5 });
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(LAUNCH.maxSpeed * 0.5, 5);
    expect(v.y).toBeLessThan(0);
  });
});

describe('세션 상태 기계', () => {
  it('비행 중·성공·실패 상태에서는 발사가 무시되고 탄 수가 맞게 줄어든다', () => {
    const lv = base({ bodies: [target('t1', 420, GROUND_Y, 36, 140)], goals: [{ body: 't1', judge: 'topple' }], shots: 1 });
    const s = new LevelSession(lv);
    expect(s.launch({ angleDeg: 22.5, power: 0.7 })).toBe(true);
    expect(s.state).toBe('flying');
    expect(s.launch({ angleDeg: 22.5, power: 0.7 })).toBe(false);
    for (let i = 0; i < 60 * 20 && s.state === 'flying'; i++) s.step();
    expect(['success', 'failed']).toContain(s.state);
    expect(s.launch({ angleDeg: 22.5, power: 0.7 })).toBe(false);
    expect(s.shotsUsed).toBe(1);
    s.dispose();
  });

  it('첫 발의 결과가 다음 발사에서도 유지된다', () => {
    const lv = base({ bodies: [target('t1', 420, GROUND_Y, 36, 140)], goals: [{ body: 't1', judge: 'topple' }], shots: 3 });
    const s = new LevelSession(lv);
    s.launch({ angleDeg: 22.5, power: 0.7 });
    for (let i = 0; i < 60 * 20 && s.state === 'flying'; i++) s.step();
    // 목표가 넘어졌으므로 성공 처리됨. 넘어진 뒤 위치는 그대로
    const e = s.world.mustEntry('t1');
    const after = { x: e.body.position.x, angle: e.body.angle };
    expect(Math.abs(after.angle)).toBeGreaterThan(0.8);
    s.dispose();
    // 실패 케이스: 빗나간 첫 발 이후 조준 복귀, 물체 수 유지
    const s2 = new LevelSession(lv);
    const n0 = s2.world.counts();
    s2.launch({ angleDeg: 85, power: 0.3 });
    for (let i = 0; i < 60 * 20 && s2.state === 'flying'; i++) s2.step();
    expect(s2.state).toBe('aiming');
    expect(s2.shotsLeft).toBe(2);
    expect(s2.world.counts().bodies).toBe(n0.bodies + 1); // 발사체 하나만 추가
    s2.dispose();
  });

  it('작은 흔들림만으로는 목표를 달성 처리하지 않는다', () => {
    const lv = base({ bodies: [target('t1', 420, GROUND_Y, 40, 80)], goals: [{ body: 't1', judge: 'topple' }] });
    const s = new LevelSession(lv);
    const b = s.world.mustEntry('t1').body;
    Matter.Sleeping.set(b, false);
    Matter.Body.setAngularVelocity(b, 0.02); // 살짝 흔들기
    for (let i = 0; i < 180; i++) s.step();
    expect(s.goalsDone).toBe(0);
    s.dispose();
  });

  it('보호상자 직접 명중은 실패, 바닥 접촉은 실패가 아니다', () => {
    const lv = base({
      bodies: [standing('box', 250, GROUND_Y, 52, 52, 'crate', { role: 'protect' }), target('t1', 460, GROUND_Y, 30, 140)],
      protects: [{ body: 'box', safeZone: { x: 190, y: GROUND_Y - 120, w: 120, h: 120 } }], goals: [{ body: 't1', judge: 'topple' }],
    });
    const s = new LevelSession(lv);
    for (let i = 0; i < 120; i++) s.step();
    expect(s.failReason).toBeNull(); // 바닥에 놓여 있어도 실패 아님
    s.launch({ angleDeg: 5, power: 0.6 });
    for (let i = 0; i < 120 && s.state === 'flying'; i++) s.step();
    expect(s.state).toBe('failed');
    expect(s.failReason).toBe('protectHit');
    s.dispose();
  });

  it('보호상자가 안전 구역 밖으로 밀리면 실패한다', () => {
    const lv = base({
      bodies: [standing('box', 250, GROUND_Y, 44, 44, 'crate', { role: 'protect' })],
      protects: [{ body: 'box', safeZone: { x: 220, y: GROUND_Y - 60, w: 60, h: 60 } }], goals: [],
    });
    const s = new LevelSession(lv);
    const b = s.world.mustEntry('box').body;
    Matter.Sleeping.set(b, false); Matter.Body.setVelocity(b, { x: 8, y: 0 }); // 안전 구역을 확실히 벗어나는 강한 밀림
    for (let i = 0; i < 120 && !s.failReason; i++) s.step();
    expect(s.failReason).toBe('protectOut');
    s.dispose();
  });

  it('같은 목표는 한 번만 집계되고 콤보는 시간 창 안에서만 증가한다', () => {
    const lv = base({ bodies: [target('a', 300, GROUND_Y, 22, 130), target('b', 374, GROUND_Y, 22, 130)], goals: [{ body: 'a', judge: 'topple' }, { body: 'b', judge: 'topple' }] });
    const s = new LevelSession(lv);
    for (const id of ['a', 'b']) { const b = s.world.mustEntry(id).body; Matter.Sleeping.set(b, false); Matter.Body.setAngularVelocity(b, 0.08); }
    let goalEvents = 0;
    for (let i = 0; i < 300; i++) { s.step(); goalEvents += s.drainEvents().filter((e) => e.t === 'goal').length; }
    expect(goalEvents).toBe(2);
    expect(s.goalsDone).toBe(2);
    expect(s.maxCombo).toBe(2);
    s.dispose();
  });

  it('반복 재시작해도 물체·제약 수가 늘지 않는다', () => {
    const wt = hangingWeight('w1', 'r1', 300, 200, 200);
    const lv = base({ bodies: [target('t1', 420, GROUND_Y, 36, 140), wt.body], ropes: [wt.rope], goals: [{ body: 't1', judge: 'topple' }] });
    let first: { bodies: number; constraints: number } | null = null;
    for (let k = 0; k < 5; k++) {
      const s = runShots(lv, [{ angleDeg: 60, power: 0.9 }]);
      s.dispose();
      const s2 = new LevelSession(lv);
      const c = s2.world.counts();
      if (!first) first = c; else expect(c).toEqual(first);
      s2.dispose();
    }
  });
});
