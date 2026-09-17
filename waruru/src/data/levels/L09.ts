import type { LevelDef, BallDef, RopeDef } from '../../sim/types';
import { G, LAUNCHER, ledge, standing } from './util';

// 9. 두 줄 중 하나 — 철거추를 두 밧줄이 V자로 잡고 있다. 왼쪽 줄(r2)을 끊으면 추가 오른쪽으로 흔들려 목표를 때리고,
//    오른쪽 줄(r1)을 끊으면 왼쪽으로 흔들려 아무것도 맞히지 못한다.
const right = { x: 420, y: 250 };
const left = { x: 170, y: 250 };
const R1 = 490;
const ballPos = { x: 300, y: right.y + Math.sqrt(R1 * R1 - (right.x - 300) * (right.x - 300)) };
const wb: BallDef = { kind: 'ball', id: 'wb', x: ballPos.x, y: ballPos.y, r: 26, material: 'iron', role: 'weight' };
function ropeTo(id: string, a: { x: number; y: number }): RopeDef {
  const len = Math.hypot(a.x - ballPos.x, a.y - ballPos.y);
  const d = { x: (ballPos.x - a.x) / len, y: (ballPos.y - a.y) / len };
  return { kind: 'rope', id, a, b: { body: 'wb', x: ballPos.x - d.x * 26, y: ballPos.y - d.y * 26 } };
}
export const L09: LevelDef = {
  id: 9, key: 'L09', version: 4,
  title: '두 줄 중 하나', subtitle: '어느 밧줄을 끊을지 고르세요',
  launcher: LAUNCHER, shots: 2,
  bodies: [
    ledge('crane', 300, 220, 320, 30, 'metal'),
    ledge('cranePost', 530, 250, 22, 200, 'metal'),
    ledge('pedestal', 470, G - 60, 80, 60, 'stone'),
    standing('t1', 470, G - 60, 30, 130, 'wood', { role: 'target', label: '철거' }),
    wb,
  ],
  ropes: [ropeTo('r1', right), ropeTo('r2', left)],
  goals: [{ body: 't1', judge: 'topple' }],
  stars: { three: 1, two: 2 },
  hints: [
    { text: '철거추를 두 밧줄이 잡고 있습니다. 한 줄을 끊으면 남은 줄을 축으로 추가 흔들려요. 어느 쪽으로 흔들릴지 생각해 보세요.', highlight: ['r2'] },
    { text: '왼쪽 줄의 위쪽을 끊으면 추가 오른쪽 목표 쪽으로 흔들립니다. 추 가까이에서는 두 줄이 붙어 있어 함께 끊길 수 있어요.', shot: { angleDeg: 60, power: 0.65 } },
  ],
  solutionRef: 'L09',
};
