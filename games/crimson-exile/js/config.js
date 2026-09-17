'use strict';
// ===================== 기본 설정 =====================
const CFG = {
  TILE: 32,
  MAP_W: 72, MAP_H: 72,
  DAY_LENGTH: 300,            // 낮밤 한 주기 (초)
  PLAYER_SPEED: 175,
  PLAYER_RADIUS: 12,
  DODGE_DIST: 150, DODGE_TIME: 0.26, DODGE_CD: 1.1,
  POTION_CHARGES: 4, POTION_HEAL_PCT: 0.35, POTION_REFILL_CHANCE: 0.15,
  INV_SLOTS: 40,
  SKILL_SLOTS: 6, SUPPORT_SLOTS: 2,
  MAX_RES: 75,
  ACTIVATION_RANGE: 950,
  MAX_GEM_LEVEL: 20,
  MAX_LEVEL: 100,
  SAVE_KEY: 'crimson_exile_save_v1',
  XP_LEVEL_DIFF_PENALTY: 5,
  LOOT_LABEL_KEY: 'z',
};

// ===================== 종족 (다크에덴) =====================
const CLASSES = {
  slayer: {
    id: 'slayer', name: '슬레이어', title: '인류의 사냥꾼', color: '#f0d78c', accent: '#ffe9a8',
    desc: '성수와 총탄으로 어둠을 심판하는 인간 사냥꾼. 낮에 강해지고 밤에 약해진다.',
    lore: '에덴의 밤이 길어질수록 사냥꾼의 총구는 더 뜨거워진다. 태양이 떠 있는 동안 그들은 무적에 가깝다.',
    base: { str: 14, dex: 20, int: 14 },
    resource: { name: '집중', color: '#e9c46a', max: 100, regen: 9, onHit: 0, onKill: 0 },
    time: { day: 0.25, night: -0.10, twilight: 0.0 },
    startGems: ['rapid_fire', 'holy_grenade'], startSupports: ['faster'],
    weapon: 'gun',
    ult: { id: 'judgment', name: '성스러운 심판', desc: '8초간 모든 피해 80% 증폭, 투사체 +1, 받는 피해 30% 감소.', cd: 35, dur: 8 },
    rival: 'vampire',
  },
  vampire: {
    id: 'vampire', name: '뱀파이어', title: '밤의 혈족', color: '#e63946', accent: '#ff8fa3',
    desc: '피를 마셔 생명을 되찾는 밤의 지배자. 밤에 강해지고 낮에 약해진다. 박쥐로 변신할 수 있다.',
    lore: '천 년의 갈증. 붉은 달이 뜨면 혈족은 인간의 도시를 사냥터로 삼는다.',
    base: { str: 20, dex: 14, int: 14 },
    resource: { name: '혈액', color: '#c1121f', max: 100, regen: -3, onHit: 5, onKill: 12 },
    time: { day: -0.15, night: 0.30, twilight: 0.05 },
    startGems: ['blood_claw', 'blood_nova'], startSupports: ['life_leech'],
    weapon: 'scythe',
    ult: { id: 'bat_form', name: '박쥐 변신', desc: '6초간 박쥐로 변신: 이동 속도 +80%, 무적, 스쳐간 적에게 출혈. 공격 시 해제.', cd: 30, dur: 6 },
    rival: 'slayer',
  },
  ouster: {
    id: 'ouster', name: '아우스터', title: '자연의 정령술사', color: '#52b788', accent: '#b7e4c7',
    desc: '바람과 가시, 정령을 부리는 고대 종족. 새벽과 황혼에 가장 강하다.',
    lore: '인간도 혈족도 아닌 세 번째 길. 그들은 낮과 밤 사이의 틈에서 힘을 끌어올린다.',
    base: { str: 14, dex: 14, int: 20 },
    resource: { name: '정령력', color: '#52b788', max: 110, regen: 7, onHit: 0, onKill: 0 },
    time: { day: 0.0, night: 0.0, twilight: 0.25 },
    startGems: ['wind_blade', 'thorn_vines'], startSupports: ['inc_aoe'],
    weapon: 'staff',
    ult: { id: 'spirit_storm', name: '정령의 폭풍', desc: '7초간 주위에 폭풍이 회전: 초당 강력한 냉기/번개 피해, 이동 속도 +30%.', cd: 32, dur: 7 },
    rival: 'vampire',
  },
};

const RARITY = {
  normal: { id: 'normal', name: '일반', color: '#d8d8d8', order: 0 },
  magic: { id: 'magic', name: '마법', color: '#7b9bff', order: 1 },
  rare: { id: 'rare', name: '희귀', color: '#ffd23f', order: 2 },
  unique: { id: 'unique', name: '유니크', color: '#c9772f', order: 3 },
};
const LEGENDARY_COLOR = '#ff8c1a';

const DMG = {
  phys: { name: '물리', color: '#e6e6e6' },
  fire: { name: '화염', color: '#ff6b35' },
  cold: { name: '냉기', color: '#7fd8ff' },
  light: { name: '번개', color: '#ffe94d' },
  chaos: { name: '카오스', color: '#b34dff' },
};
const DMG_TYPES = ['phys', 'fire', 'cold', 'light', 'chaos'];
const ELE_TYPES = ['fire', 'cold', 'light'];

const SLOT_NAMES = {
  weapon: '무기', helm: '투구', body: '갑옷', gloves: '장갑', boots: '신발', belt: '벨트',
  ring1: '반지 1', ring2: '반지 2', amulet: '목걸이',
};
const EQUIP_SLOTS = ['weapon', 'helm', 'body', 'gloves', 'boots', 'belt', 'ring1', 'ring2', 'amulet'];
