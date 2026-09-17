import type { LevelDef } from '../../sim/types';
import { G, LAUNCHER, ramp, ballOnRamp, rope, ledge, standing, target, rect } from './util';

// 16. 길을 열고 굴려라 — 밧줄을 끊으면 쇠공이 경사면을 굴러 내려온다. 길목의 기둥을 쓰러뜨리며 지나가 금속 상자를 구덩이에 떨어뜨려야 한다.
//     공이 기둥에 막히면 두 번째 발로 마무리한다.
const rp = ramp('ramp', 340, 620, 160, 140, 'left');
const bl = ballOnRamp('ball', rp, 455, 26);
export const L16: LevelDef = {
  id: 16, key: 'L16', version: 10,
  title: '길을 열고 굴려라', subtitle: '길목의 기둥을 넘어뜨리고 상자를 구덩이에 떨어뜨리세요',
  launcher: LAUNCHER, shots: 2,
  ground: [{ from: -600, to: 104 }, { from: 160, to: 1140 }],
  bodies: [
    ledge('crane', 430, 300, 220, 30, 'metal'),
    ledge('cranePost', 525, 330, 30, 290, 'metal'),
    ledge('back', 515, 620, 30, 280, 'stone'),
    rp,
    ledge('foot', 280, 760, 120, 140, 'stone'),
    target('t2', 262, 760, 22, 130, 'wood', { label: '철거' }),
    ledge('pedestal', 190, 800, 60, 100, 'stone'),
    standing('t1', 190, 800, 44, 44, 'metal', { role: 'target', label: '철거' }),
    bl,
  ],
  ropes: [rope('r1', { x: 495, y: 400 }, { body: 'ball', x: bl.x + 14, y: bl.y - 20 })],
  goals: [{ body: 't2', judge: 'topple' }, { body: 't1', judge: 'drop', zone: rect(104, 880, 56, 300) }],
  stars: { three: 2, two: 2 },
  hints: [
    { text: '쇠공이 굴러갈 길목에 나무 기둥이 서 있고, 그 너머 받침대 위에 금속 상자가 있습니다. 공 → 기둥 → 상자 순서로 힘이 전달돼요.', highlight: ['r1', 't2'] },
    { text: '밧줄을 끊어 공을 굴리세요. 기둥이 상자를 밀어 구덩이로 떨어뜨립니다. 막히면 두 번째 발로 마무리하세요.', shot: { angleDeg: 60, power: 0.85 } },
  ],
  tutorial: 'twoShots',
  solutionRef: 'L16',
};
