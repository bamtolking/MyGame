import type { LevelDef } from '../../sim/types';
import { G, LAUNCHER, block, hinge, ledge, hangingWeight } from './util';

// 11. 무게를 옮겨라 — 밧줄을 끊으면 추가 시소의 올라간 끝에 떨어지고, 반대쪽 끝이 튀어 올라 목표가 넘어진다.
const PIVOT = { x: 370, y: 800 };
const TILT = 10, HALF = 130;
const t = (TILT * Math.PI) / 180;
const surf = { x: PIVOT.x + Math.cos(t) * 100, y: PIVOT.y + Math.sin(t) * 100 };
const n = { x: -Math.sin(t), y: -Math.cos(t) };
const HT = 11; // 발판 반두께
const wt = hangingWeight('w1', 'r1', 262, 250, 230, 48, 48);
export const L11: LevelDef = {
  id: 11, key: 'L11', version: 2,
  title: '무게를 옮겨라', subtitle: '추를 떨어뜨려 시소를 움직이세요',
  launcher: LAUNCHER, shots: 2,
  bodies: [
    ledge('crane', 330, 220, 260, 30, 'metal'),
    ledge('cranePost', 450, 250, 30, 200, 'metal'),
    block('plank', PIVOT.x, PIVOT.y, HALF * 2, 22, 'wood', { angle: TILT, role: 'plank' }),
    ledge('stop', PIVOT.x + Math.cos(t) * (HALF - 10), PIVOT.y + Math.sin(t) * (HALF - 10) + 11 / Math.cos(t) + 1, 30, 40, 'stone'),
    block('t1', surf.x + n.x * (HT + 50), surf.y + n.y * (HT + 50), 34, 100, 'wood', { angle: TILT, role: 'target', label: '철거' }),
    wt.body,
  ],
  ropes: [wt.rope],
  hinges: [hinge('h1', 'plank', PIVOT)],
  goals: [{ body: 't1', judge: 'topple' }],
  stars: { three: 1, two: 2 },
  hints: [
    { text: '시소의 올라간 왼쪽 끝 위에 추가 매달려 있습니다. 추가 떨어지면 반대쪽이 튀어 오릅니다.', highlight: ['r1', 'plank'] },
    { text: '밧줄을 끊어 추를 시소 끝에 떨어뜨리세요.', shot: { angleDeg: 70, power: 0.7 } },
  ],
  solutionRef: 'L11',
};
