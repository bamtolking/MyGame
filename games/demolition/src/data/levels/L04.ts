import type { LevelDef } from '../../sim/types';
import { G, LAUNCHER, ramp, ballOnRamp, rope, ledge, standing, rect } from './util';

// 4. 굴러가는 정답 — 경사면 위 쇠공을 붙잡은 밧줄을 끊으면 공이 굴러 내려가 금속 상자를 구덩이로 떨어뜨린다.
const rp = ramp('ramp', 310, 620, 200, 140, 'left');
const bl = ballOnRamp('ball', rp, 462, 26);
export const L04: LevelDef = {
  id: 4, key: 'L04', version: 2,
  title: '굴러가는 정답', subtitle: '쇠공을 굴려 금속 상자를 구덩이에 떨어뜨리세요',
  launcher: LAUNCHER, shots: 2,
  ground: [{ from: -600, to: 100 }, { from: 200, to: 1140 }],
  bodies: [
    ledge('crane', 430, 300, 220, 30, 'metal'),
    ledge('cranePost', 525, 330, 30, 290, 'metal'),
    ledge('back', 525, 620, 30, 280, 'stone'),
    rp,
    ledge('foot', 285, 760, 50, 140, 'stone'),
    ledge('pedestal', 230, 780, 60, 120, 'stone'),
    standing('t1', 230, 780, 44, 44, 'metal', { role: 'target', label: '철거' }),
    bl,
  ],
  ropes: [rope('r1', { x: 500, y: 400 }, { body: 'ball', x: bl.x + 14, y: bl.y - 20 })],
  goals: [{ body: 't1', judge: 'drop', zone: rect(100, 880, 100, 300) }],
  stars: { three: 1, two: 2 },
  hints: [
    { text: '금속 상자는 무거워서 커터볼로는 잘 밀리지 않습니다. 경사면 위 쇠공을 붙잡은 밧줄을 보세요.', highlight: ['r1', 'ball'] },
    { text: '밧줄을 끊으면 쇠공이 굴러 내려가 상자를 구덩이(표시 구역)로 밀어 떨어뜨립니다.', shot: { angleDeg: 55, power: 0.9 } },
  ],
  tutorial: 'ball',
  solutionRef: 'L04',
};
