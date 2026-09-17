import type { LevelDef } from '../../sim/types';
import { G, LAUNCHER, ledge, standing, target } from './util';

// 17. 두 발의 설계 — 나무 받침 위에 선 금속 가림판이 높은 선반 위 목표를 가린다. 첫 발로 받침을 빼면 가림판이 내려앉고, 두 번째 발로 목표를 넘어뜨린다.
export const L17: LevelDef = {
  id: 17, key: 'L17', version: 6,
  title: '두 발의 설계', subtitle: '첫 발로 길을 만들고 두 번째 발로 마무리하세요',
  launcher: LAUNCHER, shots: 2,
  bodies: [
    ledge('shelf', 480, G - 200, 120, 200, 'stone'),
    target('t1', 505, G - 200, 30, 120, 'wood', { label: '철거' }),
    ledge('roof', 470, 500, 140, 24, 'metal'), // 크레인에 매달린 덮개(정적). 선반 위로 넘어오는 궤적을 막는다
    ledge('crane', 470, 300, 140, 30, 'metal'),
    standing('prop', 380, G, 30, 100, 'wood', { role: 'support', label: '받침' }),
    standing('shield', 380, G - 100, 30, 260, 'metal', { role: 'support', label: '가림판' }),
  ],
  goals: [{ body: 't1', judge: 'topple' }],
  stars: { three: 2, two: 2 },
  hints: [
    { text: '금속 가림판이 목표를 완전히 가리고 있습니다. 가림판은 무겁지만, 아래 나무 받침 하나 위에 서 있어요.', highlight: ['prop'] },
    { text: '첫 발로 받침을 쳐서 빼내면 가림판이 내려앉아 목표 윗부분이 드러납니다. 두 번째 발로 목표를 맞히세요.', shot: { angleDeg: 5, power: 0.9 } },
  ],
  solutionRef: 'L17',
};
