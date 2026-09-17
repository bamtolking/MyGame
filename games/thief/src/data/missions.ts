import type { MissionDef } from '../sim/types';

// Legend: '#' wall, '.' floor. 13 columns × N rows, 40px tiles. Objects are placed by [col,row] (tile centers).
// Bump `version` whenever the grid or object layout changes: old recordings are then retired safely.

const m1: MissionDef = {
  id: 'm1', index: 1, title: '아까의 내가 도와준다', subtitle: '발전기를 부수면 레이저가 꺼진다', version: 1, seed: 101, seconds: 25,
  grid: [
    '#############', // 0
    '#...#####...#', // 1  left room (generator) / right room (vault)
    '#...#####...#', // 2
    '#...#####...#', // 3
    '#..#######..#', // 4
    '#..#######..#', // 5
    '#..#######..#', // 6
    '#..#######..#', // 7
    '#..#######..#', // 8
    '#..#######..#', // 9
    '#..#######..#', // 10
    '#..#######..#', // 11
    '#..#######..#', // 12  laser across the right corridor
    '#..#######..#', // 13
    '#..#######..#', // 14
    '#..#######..#', // 15
    '#..#######..#', // 16
    '#..#######..#', // 17
    '#..#######..#', // 18
    '#..#######..#', // 19
    '#..#######..#', // 20
    '#..#######..#', // 21
    '#...........#', // 22 hub
    '#...........#', // 23
    '#####...#####', // 24 start / exit
    '#############', // 25
  ],

  spawn: [6, 24], exit: [6, 24],
  generators: [{ id: 'g1', at: [1, 1], lasers: ['l1'] }],
  lasers: [{ id: 'l1', from: [10, 12], to: [11, 12], source: { kind: 'generator', id: 'g1' } }],
  plates: [],
  vault: { at: [10, 1], plates: [], generators: [] },
  enemies: [{ kind: 'chaser', at: [2, 3] }],
  hints: ['왼쪽 발전기를 부수면 오른쪽 레이저가 꺼집니다.', '한 번에 못 끝내도 괜찮아요. 이번 행동을 기록하면 다음 시도에서 분신이 대신 해줍니다.'],
};

const m2: MissionDef = {
  id: 'm2', index: 2, title: '양쪽에서 동시에', subtitle: '두 발판을 동시에 밟아야 금고가 열린다', version: 1, seed: 202, seconds: 25,
  grid: [
    '#############', // 0
    '####.....####', // 1
    '####..V..####', // 2  vault
    '####.....####', // 3
    '#####...#####', // 4
    '#...........#', // 5  junction
    '#..##...##..#', // 6
    '#..##...##..#', // 7
    '#..##...##..#', // 8  plate R (11,8)
    '#..##...#####', // 9
    '#..##...#####', // 10
    '#..##...#####', // 11
    '#..##...#####', // 12 plate L (1,12)
    '#####...#####', // 13
    '#####...#####', // 14
    '#####...#####', // 15
    '#####...#####', // 16
    '#####...#####', // 17
    '#####...#####', // 18 start
    '#############', // 19
  ],
  spawn: [6, 18], exit: [6, 18],
  generators: [], lasers: [],
  plates: [{ id: 'pL', at: [1, 12], label: 'A' }, { id: 'pR', at: [11, 8], label: 'B' }],
  vault: { at: [6, 2], plates: ['pL', 'pR'], generators: [] },
  enemies: [{ kind: 'chaser', at: [6, 7], facing: Math.PI / 2 }],
  hints: ['발판 A와 B를 동시에 밟아야 금고가 열립니다. 발판 위에서 [기록 마치기]를 누르면 분신이 그 자리를 끝까지 지킵니다.', '금고는 잠금이 다시 걸려도 2.5초 동안 열려 있습니다.'],
};

const m3: MissionDef = {
  id: 'm3', index: 3, title: '엄호하고 가져와', subtitle: '포탑과 경비를 분신이 처리하는 동안 코어를 빼낸다', version: 1, seed: 303, seconds: 25,
  grid: [
    '#############', // 0
    '#...........#', // 1  turret (6,1) behind the vault
    '#...........#', // 2  heavy (6,2)
    '#...........#', // 3  turrets (2,3) (10,3) flank the vault (6,3)
    '#...........#', // 4
    '#.#########.#', // 5
    '#.###...###.#', // 6  chasers (5,6) (7,6) at the corridor mouth
    '#.###...###.#', // 7
    '#.###...###.#', // 8
    '#.###...###.#', // 9
    '#.###...###.#', // 10
    '#.###...###.#', // 11
    '#...........#', // 12 junction
    '#####...#####', // 13
    '#####...#####', // 14 start
    '#############', // 15
  ],
  spawn: [6, 14], exit: [6, 14],
  generators: [], lasers: [], plates: [],
  vault: { at: [6, 3], plates: [], generators: [] },
  enemies: [{ kind: 'turret', at: [2, 3], facing: 0 }, { kind: 'turret', at: [10, 3], facing: Math.PI }, { kind: 'turret', at: [6, 1], facing: Math.PI / 2 }, { kind: 'chaser', at: [5, 6], facing: Math.PI / 2 }, { kind: 'chaser', at: [7, 6], facing: Math.PI / 2 }, { kind: 'heavy', at: [6, 2], facing: Math.PI / 2 }],
  hints: ['금고는 잠겨 있지 않지만 포탑 3기, 복도 입구의 경비 2명, 금고 뒤 중장갑 경비가 지킵니다. 코어는 금고 옆에서 0.7초 머물러야 회수됩니다.', '소총 분신이 방 입구에서 포탑을 맡고, 산탄 분신이 복도의 경비를 맡으면 내가 코어를 가져올 수 있습니다. 옆 복도로 돌아 들어갈 수도 있습니다.'],
};

const m4: MissionDef = {
  id: 'm4', index: 4, title: '한 명에게 두 가지 일', subtitle: '발전기를 부수고 발판까지 — 한 기록으로', version: 1, seed: 404, seconds: 25,
  grid: [
    '#############', // 0
    '#...#####...#', // 1
    '#.G.#####.V.#', // 2  generator (2,2), vault (10,2)
    '#...#####...#', // 3
    '##.#######.##', // 4
    '#..#######..#', // 5
    '#..#######..#', // 6
    '#..#######..#', // 7  laser across right corridor (10..11, 7)
    '#..###.###..#', // 8
    '#..###P###..#', // 9  plate (6,9)
    '#..###.###..#', // 10
    '#...........#', // 11 junction
    '#####...#####', // 12
    '#####...#####', // 13 start
    '#############', // 14
  ],
  spawn: [6, 13], exit: [6, 13],
  generators: [{ id: 'g1', at: [2, 2], lasers: ['l1'] }],
  lasers: [{ id: 'l1', from: [10, 7], to: [11, 7], source: { kind: 'generator', id: 'g1' } }],
  plates: [{ id: 'p1', at: [6, 9], label: 'A' }],
  vault: { at: [10, 2], plates: ['p1'], generators: [] },
  enemies: [{ kind: 'chaser', at: [2, 6] }],
  hints: ['금고를 열려면 발판 A를 밟은 채여야 하고, 레이저는 발전기를 부숴야 꺼집니다.', '한 기록으로 발전기를 부순 뒤 발판까지 걸어가 [기록 마치기]를 누르면 분신 하나가 두 가지 일을 합니다.'],
};

const m5: MissionDef = {
  id: 'm5', index: 5, title: '다른 길, 다른 작전', subtitle: '레이저 타이밍 우회로 vs 경비실 돌파', version: 1, seed: 505, seconds: 25,
  grid: [
    '#############', // 0
    '#.....V.....#', // 1  vault room (row 1)
    '#.########.##', // 2  heavy (10,2) holds the 2-deep door corridor (10,2)-(10,3)
    '#.########.##', // 3  left corridor col 1 rows 2-9 with timed lasers at rows 4 and 7
    '#.######....#', // 4  right room cols 8-11 rows 4-8
    '#.######....#', // 5  chaser (10,5)
    '#.######....#', // 6
    '#.######....#', // 7
    '#.######C...#', // 8  chaser (8,8)
    '#.########.##', // 9  bottom door (10,9)
    '#...........#', // 10 junction
    '#####...#####', // 11
    '#####...#####', // 12 start
    '#############', // 13
  ],
  spawn: [6, 12], exit: [6, 12],
  generators: [],
  lasers: [
    { id: 't1', from: [1, 4], to: [1, 4], source: { kind: 'timer', onSec: 1.6, offSec: 2.0, offsetSec: 0 } },
    { id: 't2', from: [1, 7], to: [1, 7], source: { kind: 'timer', onSec: 1.6, offSec: 2.0, offsetSec: 1.5 } },
  ],
  plates: [],
  vault: { at: [6, 1], plates: [], generators: [] },
  enemies: [{ kind: 'heavy', at: [10, 2], facing: Math.PI / 2 }, { kind: 'chaser', at: [10, 5], facing: Math.PI / 2 }, { kind: 'chaser', at: [8, 8], facing: Math.PI / 2 }],
  hints: ['왼쪽 복도는 일정한 박자로 켜지는 레이저 2개를 타이밍 맞춰 지나는 길입니다. 오른쪽 경비실의 위쪽 문은 중장갑 경비가 몸으로 막고 있어 쓰러뜨려야 지나갑니다.', '분신 없이 왼쪽으로 갈 수도 있고, 소총 분신이 경비실을 정리해 두면 오른쪽이 더 빠릅니다. 중장갑 경비는 예고된 방향으로만 강타하므로 거리를 두고 쏘세요.'],
};

const m6: MissionDef = {
  id: 'm6', index: 6, title: '마지막 금고', subtitle: '발전기·발판 2개·포탑·중장갑 경비 — 모두 함께', version: 1, seed: 606, seconds: 25,
  grid: [
    '#############', // 0
    '#...#.T.#...#', // 1  turret (6,1)
    '#.G.#.V.#.B.#', // 2  generator (2,2), vault (6,2), plate B (10,2)
    '#...#...#...#', // 3
    '##.###.###.##', // 4  laser at (6,4) blocks the vault door
    '#..#.....#..#', // 5
    '#..#..H..#..#', // 6  heavy (6,6); chasers (1,6) (11,6)
    '#..#.....#..#', // 7
    '#A.#.....#..#', // 8  plate A (1,8)
    '#..###.###..#', // 9
    '#...........#', // 10 junction
    '#####...#####', // 11
    '#####...#####', // 12 start
    '#############', // 13
  ],
  spawn: [6, 12], exit: [6, 12],
  generators: [{ id: 'g1', at: [2, 2], lasers: ['l1'] }],
  lasers: [{ id: 'l1', from: [6, 4], to: [6, 4], source: { kind: 'generator', id: 'g1' } }],
  plates: [{ id: 'pA', at: [1, 8], label: 'A' }, { id: 'pB', at: [10, 2], label: 'B' }],
  vault: { at: [6, 2], plates: ['pA', 'pB'], generators: [] },
  enemies: [{ kind: 'turret', at: [6, 1], facing: Math.PI / 2 }, { kind: 'heavy', at: [6, 6] }, { kind: 'chaser', at: [1, 6] }, { kind: 'chaser', at: [11, 6] }],
  hints: ['금고: 발판 A·B를 동시에 밟고, 발전기를 부숴 문 앞 레이저를 꺼야 열립니다. 포탑은 금고 바로 뒤에서 문 쪽을 겨눕니다.', '예: 1번 분신은 왼쪽 발전기를 부수고 발판 A로, 2번은 오른쪽 발판 B로. 나는 가운데 경비실을 지나 코어를 가져옵니다. 대기하는 동안 포탑을 쏠 수도 있습니다.'],
};

export const MISSIONS: MissionDef[] = [m1, m2, m3, m4, m5, m6];
export const missionById = (id: string): MissionDef | undefined => MISSIONS.find((m) => m.id === id);
