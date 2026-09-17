import type { LevelDef } from '../../sim/types';
import { G, LAUNCHER, ledge, standing, rect } from './util';

// 10. 세게 쏘면 손해 — 금속 상자를 구덩이에 떨어뜨려야 한다. 너무 세게 치면 구덩이를 넘어 보호상자를 덮친다.
export const L10: LevelDef = {
  id: 10, key: 'L10', version: 2,
  title: '세게 쏘면 손해', subtitle: '적당한 힘으로 상자를 구덩이에 떨어뜨리세요',
  launcher: LAUNCHER, shots: 2,
  ground: [{ from: -600, to: 340 }, { from: 470, to: 1140 }],
  bodies: [
    ledge('shelf', 300, G - 130, 80, 130, 'stone'),
    standing('t1', 315, G - 130, 44, 44, 'metal', { role: 'target', label: '철거' }),
    standing('box', 508, G, 52, 52, 'crate', { role: 'protect', label: '보호' }),
  ],
  protects: [{ body: 'box', safeZone: rect(474, G - 110, 100, 110) }],
  goals: [{ body: 't1', judge: 'drop', zone: rect(340, G - 20, 130, 320) }],
  stars: { three: 1, two: 2 },
  hints: [
    { text: '상자를 살짝만 밀어 바로 앞 구덩이에 떨어뜨리면 됩니다. 세게 치면 구덩이를 넘어 보호상자를 덮쳐요.', highlight: ['t1'] },
    { text: '약한 힘으로 상자의 옆면을 맞히세요.', shot: { angleDeg: 30, power: 0.45 } },
  ],
  solutionRef: 'L10',
};
