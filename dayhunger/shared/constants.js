// 데이헝거 — 게임 수치/정의. 밸런스·전장·난이도·캐릭터·적·건물은 이 파일만 수정하면 됩니다.
// 서버(Node)와 클라이언트(브라우저)가 같은 파일을 사용합니다.

export const TICK_RATE = 20;              // 초당 시뮬레이션 틱
export const NET_RATE = 10;               // 초당 서버→클라이언트 상태 전송 횟수
export const MAX_PLAYERS = 4;
const TR = TICK_RATE;

// ---------- 타일 ----------
export const T = {
  GROUND: 0,        // 바닥(전장마다 풀/눈/모래/진흙/재로 그려짐)
  TREE: 1, ROCK: 2, BUSH: 3, WATER: 4,
  WOOD_WALL: 5, STONE_WALL: 6, DOOR: 7, TURRET: 8, CAMPFIRE: 9, FARM: 10, FARM_RIPE: 11,
  STUMP: 12, BUSH_EMPTY: 13,
  IRON_ORE: 14,     // 철광석: 캐면 철을 주고 바위로 남음
  MUD: 16,          // 진흙: 걸을 수 있지만 느림
  LAVA: 17,         // 용암: 지나갈 수 없음, 밤에 빛남
  PINE: 18, DEAD_TREE: 19, CACTUS: 20,
  MUSHROOM: 21, MUSHROOM_EMPTY: 22,
  HERB: 23, HERB_EMPTY: 24,
  WATER_EMPTY: 25,  // 물고기를 다 잡은 물 (다시 참)
  IRON_WALL: 26, HEAVY_TURRET: 27, SPIKES: 28, TORCH: 29,
};

export const TILE_NAMES = {
  [T.GROUND]: '바닥', [T.TREE]: '나무', [T.ROCK]: '바위', [T.BUSH]: '열매 덤불', [T.WATER]: '물',
  [T.WOOD_WALL]: '나무 벽', [T.STONE_WALL]: '돌 벽', [T.DOOR]: '문', [T.TURRET]: '포탑', [T.CAMPFIRE]: '모닥불',
  [T.FARM]: '밭', [T.FARM_RIPE]: '밭(수확 가능)', [T.STUMP]: '그루터기', [T.BUSH_EMPTY]: '빈 덤불',
  [T.IRON_ORE]: '철광석', [T.MUD]: '진흙', [T.LAVA]: '용암', [T.PINE]: '소나무', [T.DEAD_TREE]: '고목', [T.CACTUS]: '선인장',
  [T.MUSHROOM]: '버섯', [T.MUSHROOM_EMPTY]: '버섯 자리', [T.HERB]: '약초', [T.HERB_EMPTY]: '약초 자리', [T.WATER_EMPTY]: '물(고기 없음)',
  [T.IRON_WALL]: '철 벽', [T.HEAVY_TURRET]: '중포탑', [T.SPIKES]: '가시 함정', [T.TORCH]: '횃불',
};

// ---------- 자원 ----------
export const RES_KEYS = ['wood', 'stone', 'iron', 'food'];
export const RES_ICON = { wood: '🪵', stone: '🪨', iron: '⛓️', food: '🍎' };
export const RES_NAME = { wood: '나무', stone: '돌', iron: '철', food: '식량' };

// 자연 자원: 몇 번 때리면 무엇을 얼마나 주는지, 무엇이 남는지. heal은 인벤토리 대신 즉시 체력 회복.
// kind: 캐릭터 보너스/도구 모션 분류 (tree | rock | plant | fish)
export const RESOURCES = {
  [T.TREE]:      { kind: 'tree',  hits: 3, gives: { wood: 4 },          leaves: T.STUMP },
  [T.PINE]:      { kind: 'tree',  hits: 4, gives: { wood: 5 },          leaves: T.STUMP },
  [T.DEAD_TREE]: { kind: 'tree',  hits: 2, gives: { wood: 3 },          leaves: T.STUMP },
  [T.CACTUS]:    { kind: 'plant', hits: 2, gives: { wood: 2, food: 1 }, leaves: T.GROUND },
  [T.ROCK]:      { kind: 'rock',  hits: 4, gives: { stone: 3 },         leaves: T.GROUND },
  [T.IRON_ORE]:  { kind: 'rock',  hits: 5, gives: { iron: 2 },          leaves: T.ROCK },
  [T.BUSH]:      { kind: 'plant', hits: 1, gives: { food: 2 },          leaves: T.BUSH_EMPTY },
  [T.MUSHROOM]:  { kind: 'plant', hits: 1, gives: { food: 2 },          leaves: T.MUSHROOM_EMPTY },
  [T.HERB]:      { kind: 'plant', hits: 1, gives: {}, heal: 25,         leaves: T.HERB_EMPTY },
  [T.WATER]:     { kind: 'fish',  hits: 2, gives: { food: 2 },          leaves: T.WATER_EMPTY },
  [T.FARM_RIPE]: { kind: 'plant', hits: 1, gives: { food: 3 },          leaves: T.FARM },
};
// 빈 자리 → 다시 자라는 규칙
export const REGROW = {
  [T.STUMP]: { to: T.TREE, ticks: 120 * TR },
  [T.BUSH_EMPTY]: { to: T.BUSH, ticks: 45 * TR },
  [T.MUSHROOM_EMPTY]: { to: T.MUSHROOM, ticks: 60 * TR },
  [T.HERB_EMPTY]: { to: T.HERB, ticks: 90 * TR },
  [T.WATER_EMPTY]: { to: T.WATER, ticks: 60 * TR },
};
export const FARM_GROW_TICKS = 40 * TR;
export const MUD_SPEED = 0.6;

// ---------- 건물 (건설 메뉴 순서) ----------
export const BUILDINGS = {
  WOOD_WALL:    { tile: T.WOOD_WALL, name: '나무 벽', icon: '🪵', cost: { wood: 2 }, hp: 50, desc: '값싼 벽. 좀비를 잠시 막습니다.' },
  STONE_WALL:   { tile: T.STONE_WALL, name: '돌 벽', icon: '🧱', cost: { stone: 3 }, hp: 140, desc: '튼튼한 벽.' },
  IRON_WALL:    { tile: T.IRON_WALL, name: '철 벽', icon: '⛓️', cost: { iron: 3, stone: 2 }, hp: 320, desc: '가장 튼튼한 벽. 브루트도 오래 걸립니다.' },
  DOOR:         { tile: T.DOOR, name: '문', icon: '🚪', cost: { wood: 3 }, hp: 40, desc: '우리만 지나갈 수 있는 문.' },
  TURRET:       { tile: T.TURRET, name: '포탑', icon: '🗼', cost: { wood: 5, stone: 4 }, hp: 80, desc: '5칸 안의 적을 자동으로 쏩니다.', range: 5, damage: 10, cooldown: 12 },
  HEAVY_TURRET: { tile: T.HEAVY_TURRET, name: '중포탑', icon: '🏰', cost: { iron: 4, stone: 6 }, hp: 150, desc: '6.5칸, 한 방 28. 박쥐도 잘 잡습니다.', range: 6.5, damage: 28, cooldown: 24 },
  SPIKES:       { tile: T.SPIKES, name: '가시 함정', icon: '🪤', cost: { wood: 3, iron: 1 }, hp: 30, desc: '밟은 적에게 피해. 우리는 밟아도 괜찮아요.', damage: 8, every: 10 },
  TORCH:        { tile: T.TORCH, name: '횃불', icon: '🕯️', cost: { wood: 2 }, hp: 20, desc: '밤에 주변을 밝힙니다.', light: 3.5 },
  CAMPFIRE:     { tile: T.CAMPFIRE, name: '모닥불', icon: '🔥', cost: { wood: 4, stone: 2 }, hp: 40, desc: '근처 아군 회복·추위 방지, 근처에서 먹으면 배가 더 찹니다.', radius: 2.5, light: 5.5 },
  FARM:         { tile: T.FARM, name: '밭', icon: '🌱', cost: { wood: 4, food: 1 }, hp: 30, desc: '40초마다 식량 3을 수확할 수 있습니다.' },
};
export const BUILDING_BY_TILE = {};
for (const [key, b] of Object.entries(BUILDINGS)) BUILDING_BY_TILE[b.tile] = { key, ...b };
BUILDING_BY_TILE[T.FARM_RIPE] = BUILDING_BY_TILE[T.FARM];

export const BUILD_RANGE = 3;
export const REPAIR_COST = { wood: 1 };
export const REPAIR_AMOUNT = 25;
export const DISMANTLE_REFUND = 0.5;

// ---------- 플레이어 공통 ----------
export const PLAYER = {
  radius: 0.35,
  attackRange: 1.3,
  actionCooldown: 8,           // 틱 (0.4초)
  hungerDrainTicks: 40,        // 이 틱마다 배고픔 -1
  nightHungerMul: 1.5,
  starveDamagePerSec: 2,
  foodValue: 30,
  campfireFoodValue: 45,
  campfireRegenPerSec: 1.5,
  startInv: { wood: 10, stone: 5, iron: 0, food: 3 },
  maxInv: 99,
  respawnHp: 60,
  maxHunger: 100,
};
export const PLAYER_COLORS = ['#4fc3f7', '#ff8a65', '#aed581', '#ce93d8'];

// ---------- 캐릭터 ----------
// tool: 채집/공격 모션에 쓰는 도구. ranged가 있으면 적을 원거리로 공격.
export const CLASSES = {
  SURVIVOR:   { name: '생존자', icon: '🧑', hp: 100, speed: 4.5, damage: 12, tool: 'axe', desc: '균형 잡힌 만능형. 처음이라면 이걸로.' },
  LUMBERJACK: { name: '벌목꾼', icon: '🪓', hp: 110, speed: 4.4, damage: 13, tool: 'axe', gather: { tree: 2 }, bonus: { wood: 1 }, desc: '나무를 두 배 빨리 베고 나무 +1.' },
  MINER:      { name: '광부', icon: '⛏️', hp: 100, speed: 4.2, damage: 12, tool: 'pickaxe', gather: { rock: 2 }, bonus: { stone: 1, iron: 1 }, desc: '돌·철을 두 배 빨리 캐고 +1.' },
  HUNTER:     { name: '사냥꾼', icon: '🏹', hp: 80, speed: 5.2, damage: 9, tool: 'bow', ranged: { range: 4.5, speed: 12 }, desc: '활로 4.5칸 밖에서 공격. 빠르지만 약함.' },
  COOK:       { name: '요리사', icon: '🍳', hp: 90, speed: 4.5, damage: 10, tool: 'knife', foodMul: 1.5, bonus: { food: 1 }, hungerMul: 0.75, desc: '식량 +1, 먹으면 1.5배, 배가 천천히 고픔.' },
  KNIGHT:     { name: '기사', icon: '🛡️', hp: 150, speed: 4.0, damage: 16, tool: 'sword', armor: 0.2, desc: '체력 150, 받는 피해 -20%. 느림.' },
  BUILDER:    { name: '건축가', icon: '🔨', hp: 90, speed: 4.5, damage: 10, tool: 'hammer', costMul: 0.75, repairBonus: 15, buildRange: 4, desc: '건물 25% 할인, 4칸 거리에서 건설, 수리 +40.' },
};
export const DEFAULT_CLASS = 'SURVIVOR';
// 캐릭터·특전별 건설 비용
export function costFor(cls, cost, perks) {
  let mul = (CLASSES[cls] && CLASSES[cls].costMul) || 1;
  if (perks && perks.build_discount) mul *= 1 - 0.15 * perks.build_discount;
  const out = {};
  for (const [k, v] of Object.entries(cost)) out[k] = Math.max(1, Math.round(v * mul));
  return out;
}

// ---------- 적 ----------
// flags: ranged{range,speed,damage} 원거리 / flying 벽 무시 / thief 자원 훔쳐 도망 / buildingMul 건물 추가 피해 /
//        bomb{radius,building,player} 자폭 / summon{every,kind,n} 소환
export const ENEMIES = {
  ZOMBIE:  { name: '좀비', hp: 40, speed: 1.8, damage: 8, cooldown: 20, radius: 0.38, minDay: 1, weight: 10, color: '#66bb6a', score: 10 },
  RUNNER:  { name: '러너', hp: 22, speed: 3.4, damage: 5, cooldown: 14, radius: 0.3, minDay: 2, weight: 6, color: '#d4e157', score: 15 },
  SPITTER: { name: '스피터', hp: 30, speed: 1.6, damage: 4, cooldown: 40, radius: 0.36, minDay: 3, weight: 4, color: '#26a69a', score: 20, ranged: { range: 5, speed: 7 } },
  THIEF:   { name: '도둑', hp: 26, speed: 3.8, damage: 2, cooldown: 20, radius: 0.3, minDay: 3, weight: 3, color: '#8d6e63', score: 25, thief: { amount: 3, flee: 120 } },
  BAT:     { name: '박쥐', hp: 14, speed: 3.0, damage: 4, cooldown: 16, radius: 0.25, minDay: 4, weight: 4, color: '#5c6bc0', score: 15, flying: true },
  BREAKER: { name: '파괴자', hp: 90, speed: 1.5, damage: 6, cooldown: 25, radius: 0.45, minDay: 4, weight: 3, color: '#ef6c00', score: 35, buildingMul: 4 },
  BRUTE:   { name: '브루트', hp: 160, speed: 1.2, damage: 24, cooldown: 30, radius: 0.5, minDay: 5, weight: 2, color: '#6d4c41', score: 40 },
  BOMBER:  { name: '폭탄병', hp: 30, speed: 2.6, damage: 0, cooldown: 20, radius: 0.34, minDay: 6, weight: 2, color: '#e53935', score: 30, bomb: { radius: 1.7, building: 60, player: 20 } },
  BOSS:    { name: '괴수', hp: 900, speed: 1.0, damage: 40, cooldown: 30, radius: 0.7, minDay: 99, weight: 0, color: '#b71c1c', score: 300, summon: { every: 200, kind: 'ZOMBIE', n: 2 } },
};
export const ELITE_CHANCE = 0.06;   // 정예(체력 2배, 점수 3배)
export const ENEMY_HP_SCALE = (day) => 1 + 0.12 * (day - 1);
export const WAVE_COUNT = (day, players) => (4 + day * 2.5 + (day >= 5 ? (day - 4) * 3 : 0)) * (0.7 + 0.3 * players);
export const BURN_SECONDS = 15;

// ---------- 난이도 ----------
export const DIFFICULTIES = {
  EASY:      { name: '쉬움', icon: '🙂', waveMul: 0.7, hpMul: 0.8, dmgMul: 0.8, bonusMul: 1.5, winDay: 7,  desc: '적이 적고 약함. 7일 생존.' },
  NORMAL:    { name: '보통', icon: '😐', waveMul: 1.0, hpMul: 1.0, dmgMul: 1.0, bonusMul: 1.0, winDay: 10, desc: '기본. 10일 생존.' },
  HARD:      { name: '어려움', icon: '😈', waveMul: 1.4, hpMul: 1.25, dmgMul: 1.2, bonusMul: 0.8, winDay: 12, desc: '적 40% 증가, 더 튼튼. 12일 생존.' },
  NIGHTMARE: { name: '악몽', icon: '💀', waveMul: 1.9, hpMul: 1.6, dmgMul: 1.5, bonusMul: 0.6, winDay: 15, desc: '적 두 배 가까이, 보급 부족. 15일 생존.' },
};
export const DEFAULT_DIFFICULTY = 'NORMAL';
export const bossNights = (winDay) => new Set([Math.floor(winDay / 2), winDay - 1]);
export const DAWN_BONUS = (day, bonusMul = 1) => ({
  wood: Math.round((4 + day) * bonusMul), stone: Math.round((2 + day) * bonusMul), iron: Math.round(Math.floor(day / 2) * bonusMul), food: Math.round(2 * bonusMul),
});

// ---------- 전장 ----------
// gen: 생성 밀도(맵 1000칸당 개수). treeKinds: 나무 종류 가중치. oases: 연못 둘레에 덤불·나무.
// hungerMul: 배고픔 속도(설원은 모닥불·횃불 근처면 1). spawnRing: 기지 중심에서 적 출현 거리(체비쇼프).
export const MAPS = {
  MEADOW: {
    name: '초원', icon: '🌿', size: 96, desc: '균형 잡힌 숲·연못·바위. 처음 하기 좋습니다.',
    ground: ['#4f7a3a', '#53803d', '#4b7537'], water: '#2f6fb0', mud: '#6b5a3e',
    gen: { ponds: 1.5, pondR: [1.5, 3.5], trees: 28, treeKinds: { TREE: 1 }, rocks: 9, iron: 3, bushes: 20, mushrooms: 2, herbs: 4, cacti: 0, mud: 0, lava: 0, oases: false },
    dayTicks: 100 * TR, nightTicks: 60 * TR, hungerMul: 1, enemyMul: {}, spawnRing: [28, 38],
  },
  SNOW: {
    name: '설원', icon: '❄️', size: 104, desc: '추워서 배가 빨리 고픕니다(모닥불·횃불 근처는 괜찮음). 소나무·철이 많고 식량이 귀함. 브루트가 자주 옵니다.',
    ground: ['#dfe8ee', '#d5e0e8', '#e6edf2'], water: '#7fb3d5', mud: '#9aa8b3',
    gen: { ponds: 1.2, pondR: [1.5, 3], trees: 24, treeKinds: { PINE: 1 }, rocks: 12, iron: 7, bushes: 7, mushrooms: 0, herbs: 3, cacti: 0, mud: 0, lava: 0, oases: false },
    dayTicks: 100 * TR, nightTicks: 65 * TR, hungerMul: 1.5, enemyMul: { BRUTE: 2.5, BREAKER: 1.5, RUNNER: 0.5 }, spawnRing: [30, 40],
  },
  DESERT: {
    name: '사막', icon: '🏜️', size: 112, desc: '나무가 귀하고 선인장뿐. 오아시스 둘레에 열매가 있고 돌·철이 풍부. 낮이 길고 러너·도둑이 많습니다.',
    ground: ['#d9b26a', '#d3ab62', '#dfb872'], water: '#3a8fd6', mud: '#b08a4a',
    gen: { ponds: 0.6, pondR: [1.5, 2.5], trees: 3, treeKinds: { TREE: 1 }, rocks: 16, iron: 8, bushes: 3, mushrooms: 0, herbs: 3, cacti: 18, mud: 0, lava: 0, oases: true },
    dayTicks: 120 * TR, nightTicks: 50 * TR, hungerMul: 1.2, enemyMul: { RUNNER: 2, THIEF: 2.5, BAT: 1.5 }, spawnRing: [32, 44],
  },
  SWAMP: {
    name: '늪지', icon: '🐸', size: 96, desc: '물이 많아 낚시가 잘 되고 버섯·약초가 흔함. 진흙은 느리고 고목은 약함. 스피터·박쥐가 많습니다.',
    ground: ['#4e5f3a', '#536540', '#485a36'], water: '#2c5f5a', mud: '#5a4a32',
    gen: { ponds: 3.5, pondR: [1.5, 4], trees: 18, treeKinds: { DEAD_TREE: 2, TREE: 1 }, rocks: 6, iron: 2, bushes: 8, mushrooms: 18, herbs: 7, cacti: 0, mud: 5, lava: 0, oases: false },
    dayTicks: 100 * TR, nightTicks: 60 * TR, hungerMul: 1, enemyMul: { SPITTER: 2.5, BAT: 2, ZOMBIE: 0.8 }, spawnRing: [26, 36],
  },
  VOLCANO: {
    name: '화산', icon: '🌋', size: 88, desc: '용암이 길을 막고 식량이 매우 귀함. 철은 넘칩니다. 폭탄병·파괴자가 벽을 노립니다. 상급자용.',
    ground: ['#3b3a3f', '#403f44', '#36353a'], water: '#4a7c8c', mud: '#4a4038',
    gen: { ponds: 0.4, pondR: [1.5, 2.5], trees: 10, treeKinds: { DEAD_TREE: 1 }, rocks: 18, iron: 12, bushes: 4, mushrooms: 4, herbs: 3, cacti: 0, mud: 0, lava: 2.2, oases: false },
    dayTicks: 90 * TR, nightTicks: 70 * TR, hungerMul: 1.1, enemyMul: { BOMBER: 3, BREAKER: 2.5, BRUTE: 1.5 }, spawnRing: [24, 34], hpMul: 1.15,
  },
};
export const DEFAULT_MAP = 'MEADOW';

// ---------- 빠른 채팅 ----------
export const QUICK_CHAT = ['도와줘!', '여기 벽 짓자', '식량 필요해', '좋아!', '이쪽으로 와', '포탑 세울게', '도둑이다!', '기지로 돌아가'];
export const CHAT_TICKS = 4 * TR;

// ---------- 새벽 특전: 한 판 안에서 쌓이는 강화 (아침마다 3장 중 1장) ----------
export const PERKS = {
  gather_plus:    { name: '풍성한 손', icon: '🧺', max: 3, desc: '채집할 때마다 +1' },
  gather_fast:    { name: '숙련된 손놀림', icon: '⚡', max: 2, desc: '한 번 찍으면 두 번 친 것으로' },
  max_hp:         { name: '강인한 체력', icon: '❤️', max: 3, desc: '최대 체력 +25, 즉시 회복' },
  speed:          { name: '날쌘 발', icon: '👟', max: 3, desc: '이동 속도 +12%' },
  damage:         { name: '날카로운 일격', icon: '⚔️', max: 3, desc: '공격력 +30%' },
  range:          { name: '긴 팔', icon: '🦾', max: 2, desc: '공격 사거리 +0.5칸 (활은 +1칸)' },
  hunger:         { name: '소식가', icon: '🍃', max: 3, desc: '배고픔 25% 느리게' },
  food_value:     { name: '미식가', icon: '🍲', max: 2, desc: '먹을 때 회복 +50%' },
  build_discount: { name: '알뜰 건축', icon: '🧱', max: 2, desc: '건물 비용 -15%' },
  repair:         { name: '수리 달인', icon: '🔧', max: 2, desc: '수리량 +25' },
  kill_food:      { name: '사냥의 결실', icon: '🍖', max: 2, desc: '적 처치 시 25% 확률로 식량 +1' },
  night_eyes:     { name: '밤눈', icon: '👁️', max: 2, desc: '밤에 시야 +2칸' },
  thick_skin:     { name: '두꺼운 살갗', icon: '🛡️', max: 3, desc: '받는 피해 -10%' },
  campfire:       { name: '따뜻한 불', icon: '🔥', max: 1, desc: '모닥불 근처 회복 2배' },
  mud_walk:       { name: '늪지 발', icon: '🥾', max: 1, desc: '진흙에서 느려지지 않음' },
  full_respawn:   { name: '불사조', icon: '🐦‍🔥', max: 1, desc: '아침 부활 시 체력 100%' },
};
export const PERK_OFFER_TICKS = 25 * TICK_RATE;   // 협동에서 선택 대기 시간 (지나면 첫 장 자동 선택)
export const BOSS_LOOT = { iron: 8, food: 4, stone: 6 };  // 괴수 처치 시 살아있는 모두에게

// ---------- 영구 강화: 판을 거듭하며 생존 포인트로 구매 ----------
export const UPGRADES = {
  hp:            { name: '튼튼한 몸', icon: '❤️', max: 5, cost: [3, 4, 5, 6, 8], desc: '최대 체력 +10', per: 10 },
  speed:         { name: '빠른 발', icon: '👟', max: 5, cost: [3, 4, 5, 6, 8], desc: '이동 속도 +3%', per: 0.03 },
  hunger:        { name: '넉넉한 배', icon: '🍃', max: 5, cost: [3, 4, 5, 6, 8], desc: '배고픔 6% 느리게', per: 0.06 },
  supply:        { name: '보급 확대', icon: '📦', max: 5, cost: [3, 4, 5, 6, 8], desc: '새벽 보급 +10%', per: 0.10 },
  start:         { name: '준비된 출발', icon: '🎒', max: 5, cost: [2, 3, 4, 5, 6], desc: '시작 자원 나무 +3, 돌 +2, 식량 +1', per: 1 },
  damage:        { name: '날카로운 도구', icon: '⚔️', max: 5, cost: [3, 4, 5, 6, 8], desc: '공격력 +6%', per: 0.06 },
  luck:          { name: '채집 행운', icon: '🍀', max: 5, cost: [4, 5, 6, 7, 9], desc: '채집 시 10% 확률로 +1', per: 0.10 },
  iron_start:    { name: '철 상자', icon: '⛓️', max: 3, cost: [5, 7, 9], desc: '시작 철 +2', per: 2 },
  second_chance: { name: '두 번째 기회', icon: '💫', max: 1, cost: [15], desc: '한 판에 한 번, 쓰러지면 5초 뒤 모닥불에서 부활(체력 50%)', per: 1 },
};
// 강화 단계 → 게임에 전달할 효과 묶음(meta). 서버는 clampMeta로 범위를 제한합니다.
export function metaFromUpgrades(levels = {}) {
  const L = (k) => Math.min(UPGRADES[k].max, Math.max(0, levels[k] | 0));
  return {
    hp: L('hp') * UPGRADES.hp.per, speed: L('speed') * UPGRADES.speed.per, hunger: L('hunger') * UPGRADES.hunger.per,
    supply: L('supply') * UPGRADES.supply.per, start: L('start'), damage: L('damage') * UPGRADES.damage.per,
    luck: L('luck') * UPGRADES.luck.per, iron: L('iron_start') * UPGRADES.iron_start.per, secondChance: L('second_chance'),
  };
}
export function clampMeta(m) {
  const full = metaFromUpgrades(Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 99])));
  const out = {};
  for (const k of Object.keys(full)) out[k] = Math.min(full[k], Math.max(0, +((m || {})[k]) || 0));
  return out;
}
export const SECOND_CHANCE_TICKS = 5 * TICK_RATE;
