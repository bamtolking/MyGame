import type { LevelDef, BallDef, RopeDef } from '../../sim/types';
import { G, LAUNCHER, ledge, standing } from './util';

// 13. 한 번에 세 곳 — 철거추의 흔들림 하나가 세 개의 목표를 연달아 쓰러뜨린다.
const right = { x: 400, y: 250 };
const left = { x: 150, y: 250 };
const R1 = 490;
const ballPos = { x: 280, y: right.y + Math.sqrt(R1 * R1 - 120 * 120) };
const wb: BallDef = { kind: 'ball', id: 'wb', x: ballPos.x, y: ballPos.y, r: 26, material: 'iron', role: 'weight' };
function ropeTo(id: string, a: { x: number; y: number }): RopeDef {
  const len = Math.hypot(a.x - ballPos.x, a.y - ballPos.y);
  const d = { x: (ballPos.x - a.x) / len, y: (ballPos.y - a.y) / len };
  return { kind: 'rope', id, a, b: { body: 'wb', x: ballPos.x - d.x * 26, y: ballPos.y - d.y * 26 } };
}
export const L13: LevelDef = {
  id: 13, key: 'L13', version: 1,
  title: '한 번에 세 곳', subtitle: '한 번의 흔들림으로 목표 세 개를 쓰러뜨리세요',
  launcher: LAUNCHER, shots: 2,
  bodies: [
    ledge('crane', 280, 220, 320, 30, 'metal'),
    ledge('cranePost', 520, 250, 22, 200, 'metal'),
    ledge('pedestal', 470, G - 60, 140, 60, 'stone'),
    standing('t1', 420, G - 60, 22, 120, 'wood', { role: 'target', label: '철거' }),
    standing('t2', 468, G - 60, 22, 120, 'wood', { role: 'target', label: '철거' }),
    standing('t3', 516, G - 60, 22, 120, 'wood', { role: 'target', label: '철거' }),
    wb,
  ],
  ropes: [ropeTo('r1', right), ropeTo('r2', left)],
  goals: [{ body: 't1', judge: 'topple' }, { body: 't2', judge: 'topple' }, { body: 't3', judge: 'topple' }],
  stars: { three: 1, two: 2 },
  hints: [
    { text: '기둥 세 개가 나란히 서 있습니다. 철거추가 지나가는 길목이에요.', highlight: ['r2'] },
    { text: '왼쪽 줄의 위쪽을 끊으면 추가 오른쪽으로 크게 흔들려 기둥들을 차례로 쓰러뜨립니다.', shot: { angleDeg: 60, power: 0.65 } },
  ],
  solutionRef: 'L13',
};
