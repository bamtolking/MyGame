import type { LevelDef } from '../../sim/types';
import { G, LAUNCHER, block, standing, rope, rect, ledge } from './util';

// 14. 넘어뜨리되 지켜라 — 목표는 왼쪽으로 기울어 있고 밧줄이 잡아 준다. 오른쪽엔 보호상자. 직접 치면 상자 쪽으로 넘어간다.
const LEAN = -14; // 도(왼쪽으로 기움). 30×150 블록은 11.3° 이상 기울면 스스로 넘어진다
const TH = 150, TW = 30;
const base = { x: 350, y: G };
const l = (LEAN * Math.PI) / 180;
const center = { x: base.x - Math.sin(l) * (TH / 2), y: base.y - Math.cos(l) * (TH / 2) };
const topPt = { x: base.x - Math.sin(l) * (TH - 8), y: base.y - Math.cos(l) * (TH - 8) };
export const L14: LevelDef = {
  id: 14, key: 'L14', version: 2,
  title: '넘어뜨리되 지켜라', subtitle: '보호상자 반대쪽으로 넘어뜨리세요',
  launcher: LAUNCHER, shots: 2,
  bodies: [
    ledge('crane', 470, 300, 140, 30, 'metal'),
    ledge('cranePost', 530, 330, 22, 570, 'metal'),
    block('t1', center.x, center.y, TW, TH, 'wood', { angle: LEAN, role: 'target', label: '철거' }),
    standing('box', 440, G, 52, 52, 'crate', { role: 'protect', label: '보호' }),
  ],
  ropes: [rope('r1', { x: 500, y: 330 }, { body: 't1', x: topPt.x, y: topPt.y })],
  protects: [{ body: 'box', safeZone: rect(396, G - 110, 88, 110) }],
  goals: [{ body: 't1', judge: 'topple' }],
  stars: { three: 1, two: 2 },
  hints: [
    { text: '기둥은 왼쪽으로 살짝 기울어 있고, 밧줄이 잡아 주고 있습니다. 오른쪽으로 밀면 보호상자를 덮쳐요.', highlight: ['r1'] },
    { text: '밧줄을 끊으면 기둥이 기울어진 왼쪽으로 스스로 넘어집니다.', shot: { angleDeg: 50, power: 0.8 } },
  ],
  solutionRef: 'L14',
};
