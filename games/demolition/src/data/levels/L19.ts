import type { LevelDef } from '../../sim/types';
import { G, LAUNCHER, ledge, standing, rect } from './util';

// 19. 보호구역 사이로 — 앞의 보호상자(낮은 길)와 위 선반의 보호상자(높은 길) 사이 창으로 받침목을 쳐서 금속 상자를 구덩이로 떨어뜨린다.
export const L19: LevelDef = {
  id: 19, key: 'L19', version: 2,
  title: '보호구역 사이로', subtitle: '두 보호상자 사이의 길을 찾으세요',
  launcher: LAUNCHER, shots: 2,
  ground: [{ from: -600, to: 366 }, { from: 470, to: 1140 }],
  bodies: [
    standing('boxA', 210, G, 48, 48, 'crate', { role: 'protect', label: '보호' }),
    standing('prop', 350, G, 26, 110, 'wood', { role: 'support', label: '받침' }),
    standing('t1', 350, G - 110, 50, 50, 'metal', { role: 'target', label: '철거' }),
    ledge('shelf', 400, G - 330, 200, 26, 'stone'),
    ledge('shelfPost', 490, G - 304, 24, 304, 'metal'),
    standing('boxB', 360, G - 330, 48, 48, 'crate', { role: 'protect', label: '보호' }),
  ],
  protects: [
    { body: 'boxA', safeZone: rect(160, G - 110, 100, 110) },
    { body: 'boxB', safeZone: rect(310, G - 440, 100, 110) },
  ],
  goals: [{ body: 't1', judge: 'drop', zone: rect(366, G - 20, 104, 340) }],
  stars: { three: 1, two: 2 },
  hints: [
    { text: '금속 상자는 나무 받침목 위에 있고, 받침목 오른쪽은 구덩이입니다. 앞과 위에는 보호상자가 있어요.', highlight: ['prop'] },
    { text: '보호상자 사이의 창으로 받침목의 윗부분을 밀어 넘어뜨리면 상자가 구덩이로 떨어집니다.', shot: { angleDeg: 30, power: 0.75 } },
  ],
  solutionRef: 'L19',
};
