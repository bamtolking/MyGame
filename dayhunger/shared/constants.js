// 데이헝거 — 게임 수치/정의. 밸런스는 이 파일만 수정하면 됩니다.
// 서버(Node)와 클라이언트(브라우저)가 같은 파일을 사용합니다.

export const TICK_RATE = 20;              // 초당 시뮬레이션 틱
export const NET_RATE = 10;               // 초당 서버→클라이언트 상태 전송 횟수
export const MAP_W = 48;
export const MAP_H = 48;
export const MAX_PLAYERS = 4;
export const WIN_DAY = 10;                // 이 날의 아침이 오면 승리

export const DAY_TICKS = 90 * TICK_RATE;   // 낮 90초: 채집·건설
export const NIGHT_TICKS = 60 * TICK_RATE; // 밤 60초: 습격

// 타일 종류
export const T = {
  GRASS: 0,
  TREE: 1,
  ROCK: 2,
  BUSH: 3,
  WATER: 4,
  WOOD_WALL: 5,
  STONE_WALL: 6,
  DOOR: 7,
  TURRET: 8,
  CAMPFIRE: 9,
  FARM: 10,
  FARM_RIPE: 11,
  STUMP: 12,   // 베어낸 나무 자리(다시 자람)
  BUSH_EMPTY: 13, // 딴 덤불(다시 열림)
};

export const TILE_NAMES = {
  [T.GRASS]: '풀밭', [T.TREE]: '나무', [T.ROCK]: '바위', [T.BUSH]: '열매 덤불', [T.WATER]: '물',
  [T.WOOD_WALL]: '나무 벽', [T.STONE_WALL]: '돌 벽', [T.DOOR]: '문', [T.TURRET]: '포탑',
  [T.CAMPFIRE]: '모닥불', [T.FARM]: '밭', [T.FARM_RIPE]: '밭(수확 가능)', [T.STUMP]: '그루터기', [T.BUSH_EMPTY]: '빈 덤불',
};

// 자연 자원: 몇 번 때리면 무엇을 얼마나 주는지, 다시 자라는 시간
export const RESOURCES = {
  [T.TREE]:      { hits: 3, gives: { wood: 4 },  regrowTo: T.STUMP,      leaves: T.STUMP,      regrowTicks: 120 * TICK_RATE },
  [T.ROCK]:      { hits: 4, gives: { stone: 3 }, regrowTo: null,         leaves: T.GRASS,      regrowTicks: 0 },
  [T.BUSH]:      { hits: 1, gives: { food: 2 },  regrowTo: null,         leaves: T.BUSH_EMPTY, regrowTicks: 45 * TICK_RATE },
  [T.FARM_RIPE]: { hits: 1, gives: { food: 3 },  regrowTo: null,         leaves: T.FARM,       regrowTicks: 0 },
};
// 그루터기 → 나무, 빈 덤불 → 덤불 로 되돌아가는 규칙
export const REGROW = {
  [T.STUMP]: { to: T.TREE, ticks: 120 * TICK_RATE },
  [T.BUSH_EMPTY]: { to: T.BUSH, ticks: 45 * TICK_RATE },
};
export const FARM_GROW_TICKS = 40 * TICK_RATE;

// 건물 정의 (건설 메뉴 순서대로)
export const BUILDINGS = {
  WOOD_WALL: { tile: T.WOOD_WALL, name: '나무 벽', icon: '🪵', cost: { wood: 2 }, hp: 50, desc: '값싼 벽. 좀비를 잠시 막습니다.' },
  STONE_WALL: { tile: T.STONE_WALL, name: '돌 벽', icon: '🧱', cost: { stone: 3 }, hp: 140, desc: '튼튼한 벽. 브루트도 시간이 걸립니다.' },
  DOOR: { tile: T.DOOR, name: '문', icon: '🚪', cost: { wood: 3 }, hp: 40, desc: '우리만 지나갈 수 있는 문.' },
  TURRET: { tile: T.TURRET, name: '포탑', icon: '🗼', cost: { wood: 5, stone: 4 }, hp: 80, desc: '5칸 안의 적을 자동으로 쏩니다.', range: 5, damage: 10, cooldown: 12 },
  CAMPFIRE: { tile: T.CAMPFIRE, name: '모닥불', icon: '🔥', cost: { wood: 4, stone: 2 }, hp: 40, desc: '근처 아군 회복, 근처에서 먹으면 배가 더 찹니다.', radius: 2.5 },
  FARM: { tile: T.FARM, name: '밭', icon: '🌱', cost: { wood: 4, food: 1 }, hp: 30, desc: '40초마다 식량 3을 수확할 수 있습니다.' },
};
export const BUILDING_BY_TILE = {};
for (const [key, b] of Object.entries(BUILDINGS)) BUILDING_BY_TILE[b.tile] = { key, ...b };
BUILDING_BY_TILE[T.FARM_RIPE] = BUILDING_BY_TILE[T.FARM];

export const BUILD_RANGE = 3;          // 플레이어 기준 체비쇼프 거리
export const REPAIR_COST = { wood: 1 };
export const REPAIR_AMOUNT = 25;
export const DISMANTLE_REFUND = 0.5;

// 플레이어
export const PLAYER = {
  hp: 100,
  hunger: 100,
  speed: 4.5,          // 타일/초
  radius: 0.35,
  damage: 12,
  attackRange: 1.3,
  actionCooldown: 8,   // 틱 (0.4초)
  hungerDrainTicks: 40,       // 이 틱마다 배고픔 -1 (2초)
  nightHungerMul: 1.5,
  starveDamagePerSec: 2,
  foodValue: 30,
  campfireFoodValue: 45,
  campfireRegenPerSec: 1.5,
  startInv: { wood: 10, stone: 5, food: 3 },
  maxInv: 99,
  respawnHp: 60,
};
export const DAWN_BONUS = (day) => ({ wood: 4 + day, stone: 2 + day, food: 2 });
export const PLAYER_COLORS = ['#4fc3f7', '#ff8a65', '#aed581', '#ce93d8'];

// 적
export const ENEMIES = {
  ZOMBIE: { name: '좀비', hp: 40, speed: 1.8, damage: 8, cooldown: 20, radius: 0.38, minDay: 1, weight: 10, color: '#66bb6a', score: 10 },
  RUNNER: { name: '러너', hp: 22, speed: 3.4, damage: 5, cooldown: 14, radius: 0.3, minDay: 3, weight: 6, color: '#d4e157', score: 15 },
  BRUTE: { name: '브루트', hp: 160, speed: 1.2, damage: 24, cooldown: 30, radius: 0.5, minDay: 5, weight: 2, color: '#8d6e63', score: 40 },
  BOSS: { name: '괴수', hp: 900, speed: 1.0, damage: 40, cooldown: 30, radius: 0.7, minDay: 99, weight: 0, color: '#b71c1c', score: 300 },
};
export const ENEMY_HP_SCALE = (day) => 1 + 0.12 * (day - 1);
export const WAVE_COUNT = (day, players) => Math.round((4 + day * 2.5 + (day >= 5 ? (day - 4) * 3 : 0)) * (0.7 + 0.3 * players));
export const BOSS_NIGHTS = new Set([5, 9]);
export const BURN_SECONDS = 15;   // 낮이 되면 남은 적이 이 시간 안에 사라짐

// 빠른 채팅 (모바일에서 타이핑 없이)
export const QUICK_CHAT = ['도와줘!', '여기 벽 짓자', '식량 필요해', '좋아!', '이쪽으로 와', '포탑 세울게'];
export const CHAT_TICKS = 4 * TICK_RATE;

export const ACTION_KEYS = ['wood', 'stone', 'food'];
export const RES_ICON = { wood: '🪵', stone: '🪨', food: '🍎' };
export const RES_NAME = { wood: '나무', stone: '돌', food: '식량' };
