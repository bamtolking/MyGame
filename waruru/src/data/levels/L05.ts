import type { LevelDef } from '../../sim/types';
import { G, LAUNCHER, dominoRow, ledge } from './util';

// 5. 도미노 작업장 — 첫 블록을 잘 밀면 여러 목표가 연속으로 쓰러진다.
export const L05: LevelDef = {
  id: 5, key: 'L05', version: 1,
  title: '도미노 작업장', subtitle: '기둥 5개를 모두 넘어뜨리세요',
  launcher: LAUNCHER, shots: 2,
  bodies: [
    ledge('floor', 400, G - 40, 300, 40, 'stone'),
    ...dominoRow('d', 236, 74, 5, G - 40, 22, 130, 'wood'),
  ],
  goals: [1, 2, 3, 4, 5].map((i) => ({ body: `d${i}`, judge: 'topple' as const })),
  stars: { three: 1, two: 2 },
  hints: [
    { text: '기둥들이 촘촘히 서 있습니다. 하나가 쓰러지면 옆 기둥을 밀어 연쇄가 일어납니다.', highlight: ['d1'] },
    { text: '맨 왼쪽 기둥의 위쪽을 오른쪽으로 밀어 보세요.', shot: { angleDeg: 22, power: 0.62 } },
  ],
  solutionRef: 'L05',
};
