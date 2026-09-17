import type { LevelDef } from '../../sim/types';
import { G, LAUNCHER, standing, target, rect, ledge } from './util';

// 8. 건드리면 안 되는 상자 — 첫 보호상자. 낮게 쏘면 상자를 맞힌다. 높은 궤적으로 목표 윗부분을 노려라.
export const L08: LevelDef = {
  id: 8, key: 'L08', version: 1,
  title: '건드리면 안 되는 상자', subtitle: '보호상자를 피해 목표를 넘어뜨리세요',
  launcher: LAUNCHER, shots: 2,
  bodies: [
    standing('box', 250, G, 52, 52, 'crate', { role: 'protect', label: '보호' }),
    target('t1', 440, G, 32, 150, 'wood', { label: '철거' }),
    ledge('fence', 529, G - 44, 22, 44, 'metal'),
  ],
  protects: [{ body: 'box', safeZone: rect(190, G - 120, 120, 120) }],
  goals: [{ body: 't1', judge: 'topple' }],
  stars: { three: 1, two: 2 },
  hints: [
    { text: '보호상자를 커터볼로 직접 맞히거나 파란 안전 구역 밖으로 밀어내면 실패입니다.', highlight: ['box'] },
    { text: '상자 위를 스치듯 넘어가는 빠른 궤적으로 목표의 윗부분을 맞히세요.', shot: { angleDeg: 22, power: 0.9 } },
  ],
  tutorial: 'protect',
  solutionRef: 'L08',
};
