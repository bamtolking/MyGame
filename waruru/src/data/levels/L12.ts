import type { LevelDef, BallDef, RopeDef } from '../../sim/types';
import { G, LAUNCHER, standing, ramp, rect, ledge } from './util';

// 12. 위로 돌아가는 길 — 낮은 길은 보호상자와 벽이 막는다. 벽 너머로 넘어가는 높은 궤적으로 밧줄을 끊어 철거추를 굴려 상자를 구덩이에 떨어뜨려라.
const anchor = { x: 370, y: 250 };
const ropeLen = 240;
const wb: BallDef = { kind: 'ball', id: 'wb', x: anchor.x, y: anchor.y + ropeLen + 26, r: 26, material: 'iron', role: 'weight' };
const wbRope: RopeDef = { kind: 'rope', id: 'r1', a: anchor, b: { body: 'wb', x: anchor.x, y: anchor.y + ropeLen } };
export const L12: LevelDef = {
  id: 12, key: 'L12', version: 4,
  title: '위로 돌아가는 길', subtitle: '벽 위로 넘어가는 궤적을 찾으세요',
  launcher: LAUNCHER, shots: 2,
  ground: [{ from: -600, to: 490 }],
  bodies: [
    standing('box', 236, G, 52, 52, 'crate', { role: 'protect', label: '보호' }),
    ledge('wall', 300, G - 300, 24, 300, 'metal'),
    ledge('crane', 420, 220, 240, 30, 'metal'),
    ledge('cranePost', 528, 250, 24, 200, 'metal'),
    ledge('rampBack', 321, 700, 22, 200, 'stone'),
    ramp('ramp', 332, 700, 120, 100, 'right'),
    ledge('pedestal', 470, 800, 40, 100, 'stone'),
    standing('t1', 472, 800, 44, 44, 'metal', { role: 'target', label: '철거' }),
    wb,
  ],
  ropes: [wbRope],
  protects: [{ body: 'box', safeZone: rect(180, G - 120, 112, 120) }],
  goals: [{ body: 't1', judge: 'drop', zone: rect(490, 860, 110, 300) }],
  stars: { three: 1, two: 2 },
  hints: [
    { text: '낮게 쏘면 보호상자나 벽에 막힙니다. 벽에 맞고 튀어 상자를 덮칠 수도 있어요. 벽 너머 크레인의 밧줄을 보세요.', highlight: ['r1'] },
    { text: '높게 쏘아 벽을 넘겨 밧줄을 끊으면 철거추가 경사면을 굴러 상자를 구덩이로 밀어냅니다.', shot: { angleDeg: 72, power: 0.85 } },
  ],
  solutionRef: 'L12',
};
