import type { LevelDef, BallDef, RopeDef } from '../../sim/types';
import { G, LAUNCHER, block, hinge, ledge, ball, dominoRow, standing, rect } from './util';

// 20. 마지막 대연쇄 — 밧줄 → 철거추 낙하 → 시소 회전 → 쇠공 굴러 떨어짐 → 경사 발판을 타고 도미노 5연쇄. 보호상자는 발사대 옆.
const PIVOT = { x: 250, y: 560 };
const HALF = 130;
const anchor = { x: 396, y: 180 }; // 시소 오른쪽 끝(x=380) 바로 바깥. 발판이 커터볼의 길을 막지 않도록 끝 너머에 둔다
const ropeLen = 270;
const wb: BallDef = { kind: 'ball', id: 'wb', x: anchor.x, y: anchor.y + ropeLen + 26, r: 26, material: 'iron', role: 'weight' };
const wbRope: RopeDef = { kind: 'rope', id: 'r1', a: anchor, b: { body: 'wb', x: anchor.x, y: anchor.y + ropeLen } };
export const L20: LevelDef = {
  id: 20, key: 'L20', version: 7,
  title: '마지막 대연쇄', subtitle: '한 발로 모든 장치를 잇고 네 기둥을 무너뜨리세요',
  launcher: LAUNCHER, shots: 2,
  bodies: [
    ledge('crane', 390, 150, 300, 30, 'metal'),
    ledge('cranePost', 528, 180, 24, 340, 'metal'),
    block('plank', PIVOT.x, PIVOT.y, HALF * 2, 22, 'wood', { role: 'plank' }),
    ledge('stopL', PIVOT.x - HALF + 25, PIVOT.y + 11, 30, 60, 'stone'),
    ledge('stopR', PIVOT.x + HALF - 20, PIVOT.y + 11 + 70, 30, 60, 'stone'),
    ball('ball', PIVOT.x - 12, PIVOT.y - 11, 24), // 축 바로 왼쪽: 커터볼의 높은 궤적을 막지 않도록
    ledge('slab', 470, 730, 140, 24, 'stone'),
    ledge('slabPost', 520, 754, 30, 146, 'metal'),
    ...dominoRow('d', 412, 40, 4, 730, 22, 120, 'wood'),
    standing('box', 445, G, 44, 44, 'crate', { role: 'protect', label: '보호' }),
    wb,
  ],
  ropes: [wbRope],
  hinges: [hinge('h1', 'plank', PIVOT)],
  protects: [{ body: 'box', safeZone: rect(405, G - 100, 80, 100) }],
  goals: [1, 2, 3, 4].map((i) => ({ body: `d${i}`, judge: 'topple' as const })),
  stars: { three: 1, two: 2 },
  hints: [
    { text: '추 → 시소 → 공 → 도미노. 장치가 모두 이어져 있습니다. 시작점은 밧줄이에요.', highlight: ['r1'] },
    { text: '밧줄을 끊어 철거추를 시소 오른쪽 끝에 떨어뜨리면 연쇄가 시작됩니다.', shot: { angleDeg: 72, power: 0.9 } },
  ],
  solutionRef: 'L20',
};
