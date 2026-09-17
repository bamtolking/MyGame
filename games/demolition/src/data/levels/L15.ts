import type { LevelDef } from '../../sim/types';
import { G, LAUNCHER, block, hinge, ledge, hangingWeight, standing, rect } from './util';

// 15. 균형을 무너뜨려라 — 밧줄을 끊어 균형추를 시소의 올라간 끝에 떨어뜨리면 반대쪽 목표가 넘어진다.
//     단, 목표 옆 보호상자를 건드리지 않는 깨끗한 해법이 필요하다.
const PIVOT = { x: 360, y: 800 };
const TILT = 10, HALF = 130;
const t = (TILT * Math.PI) / 180;
const surf = { x: PIVOT.x + Math.cos(t) * 100, y: PIVOT.y + Math.sin(t) * 100 };
const n = { x: -Math.sin(t), y: -Math.cos(t) };
const HT = 11;
const wt = hangingWeight('w1', 'r1', 252, 250, 240, 48, 48);
export const L15: LevelDef = {
  id: 15, key: 'L15', version: 30,
  title: '균형을 무너뜨려라', subtitle: '균형추를 떨어뜨려 목표를 넘어뜨리세요',
  launcher: LAUNCHER, shots: 2,
  bodies: [
    ledge('crane', 320, 210, 260, 30, 'metal'),
    ledge('cranePost', 440, 240, 30, 200, 'metal'),
    block('plank', PIVOT.x, PIVOT.y, HALF * 2, 22, 'wood', { angle: TILT, role: 'plank' }),
    ledge('stop', PIVOT.x + Math.cos(t) * (HALF - 10), PIVOT.y + Math.sin(t) * (HALF - 10) + 11 / Math.cos(t) + 1, 30, 40, 'stone'),
    block('t1', surf.x + n.x * (HT + 50), surf.y + n.y * (HT + 50), 34, 100, 'wood', { angle: TILT, role: 'target', label: '철거' }),
    standing('box', 150, G, 48, 48, 'crate', { role: 'protect', label: '보호' }),
    wt.body,
  ],
  ropes: [wt.rope],
  hinges: [hinge('h1', 'plank', PIVOT)],
  protects: [{ body: 'box', safeZone: rect(110, G - 100, 80, 100) }],
  goals: [{ body: 't1', judge: 'topple' }],
  stars: { three: 1, two: 2 },
  hints: [
    { text: '왼쪽에 매달린 균형추를 시소의 올라간 끝에 떨어뜨리면 반대쪽 목표가 넘어집니다. 발사대 옆 보호상자는 건드리지 마세요.', highlight: ['r1', 'plank'] },
    { text: '밧줄을 향해 높게 쏘아 균형추를 시소 끝에 떨어뜨리세요.', shot: { angleDeg: 72, power: 0.72 } },
  ],
  solutionRef: 'L15',
};
