import type { LevelDef } from '../../sim/types';
import { G, LAUNCHER, block, hinge, ledge } from './util';

// 6. 반대편을 눌러라 — 시소의 올라간 왼쪽 끝 위에 커터볼을 떨어뜨리면 오른쪽 끝이 튀어 올라 그 위의 목표가 넘어진다.
const PIVOT = { x: 330, y: 800 };
const TILT = 10;               // 도. 오른쪽 끝이 내려가 받침에 닿아 있음(matter 양수 = 시계방향)
const HALF = 130;
const t = (TILT * Math.PI) / 180;
const d = 100;                 // 축에서 목표까지 거리(오른쪽)
const surf = { x: PIVOT.x + Math.cos(t) * d, y: PIVOT.y + Math.sin(t) * d };
const n = { x: -Math.sin(t), y: -Math.cos(t) };
const HT = 11; // 발판 반두께 // 발판 윗면 법선
const TH = 100, TW = 34;
export const L06: LevelDef = {
  id: 6, key: 'L06', version: 4,
  title: '반대편을 눌러라', subtitle: '시소의 올라간 쪽을 눌러 반대쪽 목표를 넘어뜨리세요',
  launcher: LAUNCHER, shots: 2,
  bodies: [
    block('plank', PIVOT.x, PIVOT.y, HALF * 2, 22, 'wood', { angle: TILT, role: 'plank' }),
    ledge('stop', PIVOT.x + Math.cos(t) * (HALF - 10), PIVOT.y + Math.sin(t) * (HALF - 10) + 11 / Math.cos(t) + 1, 30, 40, 'stone'),
    block('t1', surf.x + n.x * (HT + TH / 2), surf.y + n.y * (HT + TH / 2), TW, TH, 'wood', { angle: TILT, role: 'target', label: '철거' }),
    ledge('fence', 529, G - 44, 22, 44, 'metal'),
  ],
  hinges: [hinge('h1', 'plank', PIVOT)],
  goals: [{ body: 't1', judge: 'topple' }],
  stars: { three: 1, two: 2 },
  hints: [
    { text: '시소는 가운데 볼트를 축으로 돕니다. 한쪽이 내려가면 반대쪽이 올라가요.', highlight: ['plank'] },
    { text: '올라가 있는 왼쪽 끝 위로 커터볼을 떨어뜨리세요. 목표가 튕겨 올라 넘어집니다.', shot: { angleDeg: 62, power: 0.6 } },
  ],
  tutorial: 'seesaw',
  solutionRef: 'L06',
};
