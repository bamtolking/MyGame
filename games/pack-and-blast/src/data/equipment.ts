// 장비 12종 정의. 모양·태그·등급별 수치를 모두 여기에 둔다 (밸런스 수정은 이 파일만).
// 좌표는 회전 전 장비 내부 상대 좌표. x는 오른쪽, y는 아래쪽으로 증가.

export type EquipId =
  | 'dagger' | 'mg' | 'shotgun' | 'laser' | 'bomb' | 'drone'
  | 'battery' | 'cooler' | 'ammo' | 'lens'
  | 'shield' | 'medkit';
export type Tag = 'machine' | 'ballistic' | 'energy' | 'overheat';
export type Grade = 1 | 2 | 3;
export type Kind = 'weapon' | 'support' | 'survival';
export type WeaponType = 'melee' | 'mg' | 'shotgun' | 'laser' | 'bomb' | 'drone';
export type SupportType = 'battery' | 'cooler' | 'ammo' | 'lens';
export type Cell = readonly [number, number];

export interface HeatSpec { max: number; perShot: number; coolRate: number; resumeAt: number }

export interface WeaponSpec {
  type: WeaponType;
  damage: readonly [number, number, number];
  interval: readonly [number, number, number]; // 초
  range: number;
  // 종류별 부가 수치 (등급별)
  arc?: readonly [number, number, number];        // melee: 부채꼴 각도(도)
  slashes?: readonly [number, number, number];    // melee: 연속 베기 횟수
  pellets?: readonly [number, number, number];    // shotgun: 탄환 수
  spread?: readonly [number, number, number];     // shotgun: 산개 각도(도)
  width?: readonly [number, number, number];      // laser: 빔 반폭(px)
  pierce?: readonly [number, number, number];     // laser: 최대 관통 수
  radius?: readonly [number, number, number];     // bomb: 폭발 반경
  fragments?: readonly [number, number, number];  // bomb: 파편 수(3등급)
  drones?: readonly [number, number, number];     // drone: 드론 수
  projectileSpeed?: number;
  flightTime?: number;                            // bomb: 착탄까지 시간
  heat?: readonly [HeatSpec, HeatSpec, HeatSpec]; // 과열 무기만
  maxProjectiles: number;                         // 무기당 동시 투사체 상한
}

export interface SupportSpec {
  type: SupportType;
  appliesTo: Tag;           // 인접한 이 태그의 무기에만 적용
  value: readonly [number, number, number]; // 등급별 핵심 수치
}

export interface EquipDef {
  id: EquipId;
  name: string;
  kind: Kind;
  shape: readonly Cell[];
  tags: readonly Tag[];
  color: string;      // 장비 바탕색
  accent: string;     // 강조색
  short: string;      // 한 줄 설명
  desc: string;       // 상세 설명
  gradeNotes: readonly [string, string, string];
  weapon?: WeaponSpec;
  support?: SupportSpec;
  shield?: readonly [number, number, number];
  heal?: readonly [number, number, number];
  sfx: string;
}

export const GRADE_NAMES: Record<Grade, string> = { 1: '1등급', 2: '2등급', 3: '3등급' };
export const TAG_NAMES: Record<Tag, string> = { machine: '기계', ballistic: '탄도', energy: '에너지', overheat: '과열' };
export const KIND_NAMES: Record<Kind, string> = { weapon: '공격', support: '지원', survival: '생존' };

export const EQUIPMENT: Record<EquipId, EquipDef> = {
  dagger: {
    id: 'dagger', name: '톱니 단검', kind: 'weapon',
    shape: [[0, 0], [0, 1]], tags: [],
    color: '#8d6e63', accent: '#e0e0e0',
    short: '가까운 적을 부채꼴로 벤다',
    desc: '공간 효율이 좋지만 사거리가 짧다. 적이 몰려들었을 때의 마지막 방어선.',
    gradeNotes: ['기본 베기', '베기 범위 확대', '연속 2회 베기'],
    weapon: {
      type: 'melee', damage: [11, 15, 19], interval: [0.55, 0.5, 0.5], range: 62,
      arc: [110, 150, 160], slashes: [1, 1, 2], maxProjectiles: 0,
    },
    sfx: 'slash',
  },
  mg: {
    id: 'mg', name: '기관총', kind: 'weapon',
    shape: [[0, 0], [0, 1], [0, 2], [1, 2]], tags: ['machine', 'ballistic', 'overheat'],
    color: '#546e7a', accent: '#ffca28',
    short: '단일 대상 고속 연사 · 열이 쌓인다',
    desc: '가장 가까운 적에게 빠르게 쏜다. 계속 쏘면 과열되어 잠시 멈춘다. 배터리는 연사를, 냉각기는 지속 시간을 바꾼다.',
    gradeNotes: ['기본 총열', '강화 총열 (피해 증가)', '이중 총열 (더 빠르고 강함)'],
    weapon: {
      type: 'mg', damage: [6, 8, 11], interval: [0.16, 0.15, 0.13], range: 240, projectileSpeed: 540,
      heat: [
        { max: 100, perShot: 7, coolRate: 26, resumeAt: 0.4 },
        { max: 100, perShot: 6.5, coolRate: 29, resumeAt: 0.4 },
        { max: 100, perShot: 6, coolRate: 32, resumeAt: 0.4 },
      ],
      maxProjectiles: 24,
    },
    sfx: 'mg',
  },
  shotgun: {
    id: 'shotgun', name: '산탄총', kind: 'weapon',
    shape: [[0, 0], [1, 0], [2, 0]], tags: ['ballistic'],
    color: '#795548', accent: '#ff8a65',
    short: '탄환 여러 발을 부채꼴로 발사',
    desc: '가까이 모인 적에게 강하다. 탄약상자와 연결하면 일정 발사마다 강화 산탄이 나간다.',
    gradeNotes: ['탄환 5발', '탄환 6발 · 피해 증가', '탄환 7발 · 넓은 산개'],
    weapon: {
      type: 'shotgun', damage: [5, 6, 7], interval: [0.9, 0.85, 0.8], range: 150, projectileSpeed: 480,
      pellets: [5, 6, 7], spread: [40, 42, 46], maxProjectiles: 27,
    },
    sfx: 'shotgun',
  },
  laser: {
    id: 'laser', name: '레이저 포', kind: 'weapon',
    shape: [[0, 0], [0, 1], [0, 2], [0, 3]], tags: ['machine', 'energy', 'overheat'],
    color: '#5c6bc0', accent: '#80deea',
    short: '직선 관통 광선 · 열이 쌓인다',
    desc: '적이 일렬로 겹치는 방향으로 쏜다. 길쭉해서 배치가 까다롭다. 공명 렌즈와 연결하면 연쇄가 발생한다.',
    gradeNotes: ['가는 광선 · 3체 관통', '굵은 광선 · 5체 관통', '광폭 광선 · 무제한 관통'],
    weapon: {
      type: 'laser', damage: [22, 30, 40], interval: [1.1, 1.0, 0.9], range: 260,
      width: [7, 11, 15], pierce: [3, 5, 99],
      heat: [
        { max: 100, perShot: 30, coolRate: 20, resumeAt: 0.4 },
        { max: 100, perShot: 28, coolRate: 22, resumeAt: 0.4 },
        { max: 100, perShot: 26, coolRate: 24, resumeAt: 0.4 },
      ],
      maxProjectiles: 0,
    },
    sfx: 'laser',
  },
  bomb: {
    id: 'bomb', name: '폭탄 발사기', kind: 'weapon',
    shape: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]], tags: ['ballistic'],
    color: '#6d4c41', accent: '#ff7043',
    short: '지연 후 착탄하는 범위 폭발',
    desc: '가장 많이 모인 지점을 노린다. 공간을 많이 차지하지만 군집한 적에게 매우 강하다.',
    gradeNotes: ['기본 폭발', '넓은 폭발 · 피해 증가', '착탄 후 파편 3개'],
    weapon: {
      type: 'bomb', damage: [30, 40, 52], interval: [1.6, 1.5, 1.4], range: 230, flightTime: 0.7,
      radius: [55, 62, 70], fragments: [0, 0, 3], maxProjectiles: 6,
    },
    sfx: 'bomb',
  },
  drone: {
    id: 'drone', name: '드론 허브', kind: 'weapon',
    shape: [[0, 0], [1, 0], [2, 0], [1, 1]], tags: ['machine', 'energy'],
    color: '#00838f', accent: '#b2ebf2',
    short: '주변을 도는 드론이 자동 공격',
    desc: '드론이 캐릭터 주변을 돌며 가까운 적을 쏜다. 공명 렌즈와 연결하면 이동하는 연쇄 공격이 된다.',
    gradeNotes: ['드론 1기', '드론 2기', '드론 3기'],
    weapon: {
      type: 'drone', damage: [7, 9, 12], interval: [0.7, 0.62, 0.55], range: 170, projectileSpeed: 420,
      drones: [1, 2, 3], maxProjectiles: 12,
    },
    sfx: 'drone',
  },
  battery: {
    id: 'battery', name: '배터리', kind: 'support',
    shape: [[0, 0], [0, 1]], tags: [],
    color: '#f9a825', accent: '#fff59d',
    short: '인접한 기계 장비의 공격 속도 증가',
    desc: '전력을 공급해 공격 간격을 줄인다. 과열 무기는 빨리 쏘는 만큼 열도 빨리 쌓인다.',
    gradeNotes: ['공격 간격 -18%', '공격 간격 -26%', '공격 간격 -34%'],
    support: { type: 'battery', appliesTo: 'machine', value: [0.82, 0.74, 0.66] },
    sfx: 'place',
  },
  cooler: {
    id: 'cooler', name: '냉각기', kind: 'support',
    shape: [[0, 0], [0, 1], [1, 1]], tags: [],
    color: '#0097a7', accent: '#e0f7fa',
    short: '인접한 과열 장비의 열 방출 개선',
    desc: '열이 빠르게 빠져 기관총·레이저 포가 더 오래 쏜다. 배터리와 함께 붙이면 연사와 지속을 모두 얻는다.',
    gradeNotes: ['열 방출 +60%', '열 방출 +95%', '열 방출 +135%'],
    support: { type: 'cooler', appliesTo: 'overheat', value: [1.6, 1.95, 2.35] },
    sfx: 'place',
  },
  ammo: {
    id: 'ammo', name: '탄약상자', kind: 'support',
    shape: [[0, 0], [1, 0], [0, 1], [1, 1]], tags: [],
    color: '#827717', accent: '#dce775',
    short: '인접한 탄도 장비에 일정 발사마다 추가 탄',
    desc: '기관총은 추가 탄환, 산탄총은 강화 산탄, 폭탄 발사기는 작은 추가 폭탄이 나간다. 추가 탄은 다시 추가 탄을 만들지 않는다.',
    gradeNotes: ['4발마다 추가', '3발마다 추가', '2발마다 추가'],
    support: { type: 'ammo', appliesTo: 'ballistic', value: [4, 3, 2] },
    sfx: 'place',
  },
  lens: {
    id: 'lens', name: '공명 렌즈', kind: 'support',
    shape: [[0, 0]], tags: [],
    color: '#7e57c2', accent: '#e1bee7',
    short: '인접한 에너지 장비의 공격이 다른 적 1명에게 연쇄',
    desc: '레이저·드론이 적중하면 근처 다른 적 하나에게 에너지가 튄다. 한 칸만 차지하지만 연결 대상이 없으면 쓸모없다.',
    gradeNotes: ['연쇄 피해 40%', '연쇄 피해 55%', '연쇄 피해 70%'],
    support: { type: 'lens', appliesTo: 'energy', value: [0.4, 0.55, 0.7] },
    sfx: 'place',
  },
  shield: {
    id: 'shield', name: '방패판', kind: 'survival',
    shape: [[0, 0], [1, 0], [0, 1], [1, 1]], tags: [],
    color: '#455a64', accent: '#90caf9',
    short: '전투 시작 시 보호막 제공',
    desc: '전투가 시작될 때 가방 안에 있는 방패판만큼 보호막을 얻는다. 전투 중 다시 채워지지 않는다.',
    gradeNotes: ['보호막 30', '보호막 50', '보호막 75'],
    shield: [30, 50, 75],
    sfx: 'place',
  },
  medkit: {
    id: 'medkit', name: '구급팩', kind: 'survival',
    shape: [[0, 0], [1, 0]], tags: [],
    color: '#c62828', accent: '#ffffff',
    short: '전투 클리어 시 체력 회복',
    desc: '전투를 시작할 때 가방 안에 있던 구급팩 기준으로, 클리어 후 체력을 회복한다.',
    gradeNotes: ['회복 12', '회복 20', '회복 30'],
    heal: [12, 20, 30],
    sfx: 'place',
  },
};

export const EQUIP_IDS = Object.keys(EQUIPMENT) as EquipId[];
export const WEAPON_IDS: EquipId[] = ['dagger', 'mg', 'shotgun', 'laser', 'bomb', 'drone'];
export const SUPPORT_IDS: EquipId[] = ['battery', 'cooler', 'ammo', 'lens'];
export const SURVIVAL_IDS: EquipId[] = ['shield', 'medkit'];

export const SUPPORT_TARGET_NAMES: Record<SupportType, string> = {
  battery: '기계', cooler: '과열', ammo: '탄도', lens: '에너지',
};

/** 지원 효과를 사람이 읽는 문장으로. */
export function supportEffectText(id: EquipId, grade: Grade): string {
  const d = EQUIPMENT[id];
  if (!d.support) return '';
  const v = d.support.value[grade - 1];
  switch (d.support.type) {
    case 'battery': return `공격 간격 ${Math.round((1 - v) * 100)}% 단축`;
    case 'cooler': return `열 방출 ${Math.round((v - 1) * 100)}% 증가`;
    case 'ammo': return `${v}발마다 추가 탄 1회`;
    case 'lens': return `연쇄 피해 ${Math.round(v * 100)}%`;
  }
}
