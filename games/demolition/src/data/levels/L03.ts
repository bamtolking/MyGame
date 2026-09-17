import type { LevelDef, BallDef, RopeDef } from '../../sim/types';
import { G, LAUNCHER, ramp, target, ledge } from './util';

// 3. 줄 하나의 역할 — 크레인에 매달린 철거추(쇠공)의 밧줄을 끊으면 추가 떨어져 경사면을 굴러 목표를 때린다.
const anchor = { x: 250, y: 250 };
const ropeLen = 260;
const wb: BallDef = { kind: 'ball', id: 'wb', x: anchor.x, y: anchor.y + ropeLen + 26, r: 26, material: 'iron', role: 'weight' };
const wbRope: RopeDef = { kind: 'rope', id: 'r1', a: anchor, b: { body: 'wb', x: anchor.x, y: anchor.y + ropeLen } };
export const L03: LevelDef = {
  id: 3, key: 'L03', version: 1,
  title: '줄 하나의 역할', subtitle: '밧줄을 끊어 철거추를 떨어뜨리세요',
  launcher: LAUNCHER, shots: 2,
  bodies: [
    ledge('crane', 340, 220, 260, 30, 'metal'),
    ledge('cranePost', 500, 250, 40, 250, 'metal'),
    ledge('rampBack', 150, 700, 40, 200, 'stone'),
    ramp('ramp', 170, 700, 160, 100, 'right'),
    ledge('foot', 355, 800, 50, 100, 'stone'),
    target('t1', 405, G, 30, 130, 'wood', { label: '철거' }),
    wb,
  ],
  ropes: [wbRope],
  goals: [{ body: 't1', judge: 'topple' }],
  stars: { three: 1, two: 2 },
  hints: [
    { text: '크레인에 매달린 철거추는 커터볼보다 훨씬 무겁습니다. 추를 잡고 있는 밧줄을 보세요.', highlight: ['r1', 'wb'] },
    { text: '커터볼이 밧줄에 닿으면 줄이 끊어집니다. 밧줄을 향해 높게 쏘세요.', shot: { angleDeg: 70, power: 0.8 } },
  ],
  tutorial: 'rope',
  solutionRef: 'L03',
};
