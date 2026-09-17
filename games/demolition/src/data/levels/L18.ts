import type { LevelDef, BallDef, RopeDef } from '../../sim/types';
import { G, LAUNCHER, block, hinge, ledge, ball, target } from './util';

// 18. 세 장치의 약속 — 밧줄 절단 → 철거추(공)가 시소 오른쪽 끝에 떨어짐 → 시소 회전 → 시소 위 쇠공이 굴러 끝에서 떨어져 목표를 때린다.
const PIVOT = { x: 300, y: 640 };
const HALF = 130;
const anchor = { x: 420, y: 230 };
const ropeLen = 300;
const wb: BallDef = { kind: 'ball', id: 'wb', x: anchor.x, y: anchor.y + ropeLen + 26, r: 26, material: 'iron', role: 'weight' };
const wbRope: RopeDef = { kind: 'rope', id: 'r1', a: anchor, b: { body: 'wb', x: anchor.x, y: anchor.y + ropeLen } };
export const L18: LevelDef = {
  id: 18, key: 'L18', version: 3,
  title: '세 장치의 약속', subtitle: '밧줄·시소·공을 이어 목표를 무너뜨리세요',
  launcher: LAUNCHER, shots: 2,
  bodies: [
    ledge('crane', 390, 200, 300, 30, 'metal'),
    ledge('cranePost', 528, 230, 24, 300, 'metal'),
    block('plank', PIVOT.x, PIVOT.y, HALF * 2, 22, 'wood', { role: 'plank' }),
    ledge('stopL', PIVOT.x - HALF + 25, PIVOT.y + 11, 30, 60, 'stone'),        // 왼쪽 끝 아래 받침(수평 유지)
    ledge('stopR', PIVOT.x + HALF - 20, PIVOT.y + 11 + 70, 30, 60, 'stone'),   // 오른쪽 끝 회전 한계(약 30°)
    ball('ball', PIVOT.x - 40, PIVOT.y - 11, 24),
    ledge('pedestal', 480, 840, 60, 60, 'stone'),
    target('t1', 480, 840, 30, 130, 'wood', { label: '철거' }),
    wb,
  ],
  ropes: [wbRope],
  hinges: [hinge('h1', 'plank', PIVOT)],
  goals: [{ body: 't1', judge: 'topple' }],
  stars: { three: 1, two: 2 },
  hints: [
    { text: '추 → 시소 → 공 → 목표. 철거추가 시소 오른쪽 끝에 떨어지면 시소가 기울고, 그 위의 쇠공이 굴러 내려가 끝에서 떨어집니다.', highlight: ['r1', 'plank', 'ball'] },
    { text: '밧줄을 끊어 철거추를 시소 오른쪽 끝에 떨어뜨리세요.', shot: { angleDeg: 70, power: 0.85 } },
  ],
  solutionRef: 'L18',
};
