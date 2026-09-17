import type { LevelDef } from '../../sim/types';
import { G, LAUNCHER, standing, block, target } from './util';

// 2. 위가 아니라 아래 — 무거운 목표는 직접 치기 어렵다. 받치고 있는 기둥을 쳐라.
export const L02: LevelDef = {
  id: 2, key: 'L02', version: 1,
  title: '위가 아니라 아래', subtitle: '높은 곳의 금속 기둥을 무너뜨리세요',
  launcher: LAUNCHER, shots: 2,
  bodies: [
    standing('s1', 420, G, 26, 150, 'wood', { role: 'support', label: '받침' }),
    block('slab', 420, G - 150 - 11, 130, 22, 'stone'),
    target('t1', 420, G - 172, 58, 64, 'metal', { label: '철거' }),
  ],
  goals: [{ body: 't1', judge: 'topple' }],
  stars: { three: 1, two: 2 },
  hints: [
    { text: '금속 기둥은 무거워서 커터볼로 직접 넘어뜨리기 어렵습니다. 무엇이 받치고 있는지 보세요.', highlight: ['s1'] },
    { text: '아래 나무 받침을 세게 쳐서 빼내면 위 구조물이 통째로 떨어집니다.', shot: { angleDeg: 8, power: 0.75 } },
  ],
  solutionRef: 'L02',
};
