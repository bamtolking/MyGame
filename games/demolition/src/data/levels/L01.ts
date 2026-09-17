import type { LevelDef } from '../../sim/types';
import { G, LAUNCHER, target } from './util';

// 1. 첫 철거 — 기둥 하나를 넘어뜨린다. 당기기와 발사를 배운다.
export const L01: LevelDef = {
  id: 1, key: 'L01', version: 1,
  title: '첫 철거', subtitle: '표시된 기둥을 넘어뜨리세요',
  launcher: LAUNCHER, shots: 2,
  bodies: [
    target('t1', 420, G, 36, 140, 'wood', { label: '철거' }),
  ],
  goals: [{ body: 't1', judge: 'topple' }],
  stars: { three: 1, two: 2 },
  hints: [
    { text: '발사대를 누른 채 왼쪽 아래로 당겼다가 놓으면, 당긴 반대 방향으로 커터볼이 날아갑니다.', highlight: ['t1'] },
    { text: '기둥의 위쪽을 맞히면 쉽게 넘어갑니다.', shot: { angleDeg: 20, power: 0.6 } },
  ],
  tutorial: 'basic',
  solutionRef: 'L01',
};
