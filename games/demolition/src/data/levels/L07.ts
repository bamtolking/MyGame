import type { LevelDef } from '../../sim/types';
import { G, LAUNCHER, block, standing, ledge } from './util';

// 7. 받침목 하나 — 무거운 다리 위의 금속 목표는 직접 넘어뜨리기 어렵다. 다리를 받치는 나무 받침목 하나를 빼내라.
export const L07: LevelDef = {
  id: 7, key: 'L07', version: 3,
  title: '받침목 하나', subtitle: '핵심 받침을 빼내 다리를 무너뜨리세요',
  launcher: LAUNCHER, shots: 2,
  ground: [{ from: -600, to: 268 }, { from: 350, to: 1140 }],
  bodies: [
    standing('prop', 246, G, 26, 150, 'wood', { role: 'support', label: '받침' }),
    ledge('pier', 470, G - 150, 80, 150, 'stone'),
    block('deck', 360, G - 150 - 11, 260, 22, 'stone'),
    standing('t1', 300, G - 172, 44, 56, 'metal', { role: 'target', label: '철거' }),
    standing('t2', 410, G - 172, 44, 56, 'metal', { role: 'target', label: '철거' }),
  ],
  goals: [{ body: 't1', judge: 'topple' }, { body: 't2', judge: 'topple' }],
  stars: { three: 1, two: 2 },
  hints: [
    { text: '금속 상자 두 개는 무겁습니다. 다리의 왼쪽 끝은 나무 받침목 하나가 받치고 있고, 그 옆에는 구덩이가 있어요.', highlight: ['prop'] },
    { text: '받침목을 세게 쳐서 구덩이 쪽으로 쓰러뜨리면 다리가 기울며 상자들이 떨어집니다.', shot: { angleDeg: 25, power: 0.85 } },
  ],
  solutionRef: 'L07',
};
