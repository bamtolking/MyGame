'use strict';
// ===================== 속성 텍스트 =====================
const MOD_TEXT = {
  life: v => `최대 생명력 +${v}`,
  res: v => `최대 자원 +${v}`,
  str: v => `힘 +${v}`, dex: v => `민첩 +${v}`, int: v => `지능 +${v}`,
  all_attr: v => `모든 속성 +${v}`,
  armor: v => `방어도 +${v}`, evasion: v => `회피 +${v}`,
  inc_armor: v => `방어도 ${pct(v)} 증가`, inc_eva: v => `회피 ${pct(v)} 증가`,
  inc_life: v => `최대 생명력 ${pct(v)} 증가`, inc_res: v => `최대 자원 ${pct(v)} 증가`,
  inc_phys: v => `물리 피해 ${pct(v)} 증가`, inc_fire: v => `화염 피해 ${pct(v)} 증가`,
  inc_cold: v => `냉기 피해 ${pct(v)} 증가`, inc_light: v => `번개 피해 ${pct(v)} 증가`,
  inc_chaos: v => `카오스 피해 ${pct(v)} 증가`, inc_ele: v => `원소 피해 ${pct(v)} 증가`,
  inc_spell: v => `주문 피해 ${pct(v)} 증가`, inc_attack: v => `공격 피해 ${pct(v)} 증가`,
  inc_dmg: v => `모든 피해 ${pct(v)} 증가`, inc_proj: v => `투사체 피해 ${pct(v)} 증가`,
  inc_melee: v => `근접 피해 ${pct(v)} 증가`, inc_aoe_dmg: v => `광역 피해 ${pct(v)} 증가`,
  inc_dot: v => `지속 피해 ${pct(v)} 증가`, inc_minion: v => `소환수 피해 ${pct(v)} 증가`,
  inc_aspd: v => `공격 속도 ${pct(v)} 증가`, inc_cspd: v => `시전 속도 ${pct(v)} 증가`,
  inc_move: v => `이동 속도 ${pct(v)} 증가`, inc_aoe: v => `광역 효과 범위 ${pct(v)} 증가`,
  inc_proj_speed: v => `투사체 속도 ${pct(v)} 증가`, inc_crit: v => `치명타 확률 ${pct(v)} 증가`,
  crit_multi: v => `치명타 배율 +${pct(v)}`,
  fire_res: v => `화염 저항 +${v}%`, cold_res: v => `냉기 저항 +${v}%`,
  light_res: v => `번개 저항 +${v}%`, chaos_res: v => `카오스 저항 +${v}%`,
  all_res: v => `모든 원소 저항 +${v}%`, max_res_all: v => `최대 저항 +${v}%`,
  life_regen: v => `초당 생명력 재생 +${v}`, inc_regen: v => `생명력 재생 ${pct(v)} 증가`,
  res_regen: v => `초당 자원 재생 +${v}`, inc_res_regen: v => `자원 재생 ${pct(v)} 증가`,
  leech: v => `피해의 ${pct(v, 1)}를 생명력으로 흡수`,
  life_on_kill: v => `처치 시 생명력 +${v}`, res_on_kill: v => `처치 시 자원 +${v}`,
  proj: v => `투사체 +${v}`, chain: v => `연쇄 +${v}`, pierce: v => `관통 +${v}`,
  potion_charges: v => `포션 충전 +${v}`,
  inc_day: v => `낮 보너스 +${pct(v)}`, inc_night: v => `밤 보너스 +${pct(v)}`, inc_twilight: v => `황혼 보너스 +${pct(v)}`,
  phys_red: v => `물리 피해 ${pct(v)} 추가 감소`,
  reduced_cost: v => `스킬 비용 ${pct(v)} 감소`,
  thorns: v => `피격 시 반사 피해 ${v}`,
  dodge_cd: v => `회피 재사용 대기시간 ${pct(v)} 감소`,
  more_dmg: v => `모든 피해 ${pct(Math.abs(v))} ${v >= 0 ? '증폭' : '감폭'}`,
  more_life: v => `최대 생명력 ${pct(Math.abs(v))} ${v >= 0 ? '증폭' : '감폭'}`,
  more_phys: v => `물리 피해 ${pct(v)} 증폭`, more_ele: v => `원소 피해 ${pct(v)} 증폭`,
  add_phys: m => `물리 피해 +${m.min}~${m.max} 추가`,
  add_fire: m => `화염 피해 +${m.min}~${m.max} 추가`,
  add_cold: m => `냉기 피해 +${m.min}~${m.max} 추가`,
  add_light: m => `번개 피해 +${m.min}~${m.max} 추가`,
  add_chaos: m => `카오스 피해 +${m.min}~${m.max} 추가`,
};
function modText(m) {
  const f = MOD_TEXT[m.k];
  if (!f) return m.k;
  if (m.k.startsWith('add_')) return f(m);
  return f(m.v);
}

// ===================== 기본 아이템 =====================
const BASES = {
  weapon: [
    { id: 'sword', name: '장검', dmg: 1.0, aps: 1.3, impl: [{ k: 'inc_melee', v: 0.10 }] },
    { id: 'axe', name: '전투 도끼', dmg: 1.3, aps: 1.05, impl: [{ k: 'inc_aoe', v: 0.10 }] },
    { id: 'dagger', name: '단검', dmg: 0.7, aps: 1.65, impl: [{ k: 'inc_crit', v: 0.30 }] },
    { id: 'scythe', name: '낫', dmg: 1.45, aps: 0.95, impl: [{ k: 'leech', v: 0.01 }] },
    { id: 'gun', name: '권총', dmg: 0.85, aps: 1.5, impl: [{ k: 'inc_proj', v: 0.15 }] },
    { id: 'rifle', name: '장총', dmg: 1.35, aps: 0.9, impl: [{ k: 'inc_proj_speed', v: 0.30 }, { k: 'pierce', v: 1 }] },
    { id: 'staff', name: '지팡이', dmg: 0.9, aps: 1.15, impl: [{ k: 'inc_spell', v: 0.20 }] },
    { id: 'wand', name: '마법봉', dmg: 0.55, aps: 1.45, impl: [{ k: 'inc_spell', v: 0.30 }, { k: 'inc_cspd', v: 0.08 }] },
  ],
  helm: [
    { id: 'hood', name: '두건', armor: 0.4, eva: 1.0 },
    { id: 'helm', name: '철투구', armor: 1.0, eva: 0.3 },
    { id: 'circlet', name: '서클릿', armor: 0.2, eva: 0.3, impl: [{ k: 'res', v: 15 }] },
  ],
  body: [
    { id: 'leather', name: '가죽 갑옷', armor: 0.6, eva: 1.2 },
    { id: 'plate', name: '판금 갑옷', armor: 1.5, eva: 0.2 },
    { id: 'robe', name: '로브', armor: 0.3, eva: 0.5, impl: [{ k: 'inc_spell', v: 0.10 }] },
  ],
  gloves: [
    { id: 'gloves', name: '장갑', armor: 0.4, eva: 0.6 },
    { id: 'gauntlets', name: '건틀릿', armor: 0.8, eva: 0.2, impl: [{ k: 'inc_aspd', v: 0.05 }] },
  ],
  boots: [
    { id: 'boots', name: '장화', armor: 0.4, eva: 0.6, impl: [{ k: 'inc_move', v: 0.10 }] },
    { id: 'greaves', name: '각반', armor: 0.8, eva: 0.2, impl: [{ k: 'inc_move', v: 0.05 }] },
  ],
  belt: [
    { id: 'belt', name: '가죽 벨트', impl: [{ k: 'life', v: 15 }] },
    { id: 'chain_belt', name: '사슬 벨트', impl: [{ k: 'armor', v: 30 }] },
  ],
  ring: [
    { id: 'iron_ring', name: '철 반지', impl: [{ k: 'add_phys', min: 1, max: 3 }] },
    { id: 'ruby_ring', name: '루비 반지', impl: [{ k: 'fire_res', v: 20 }] },
    { id: 'sapphire_ring', name: '사파이어 반지', impl: [{ k: 'cold_res', v: 20 }] },
    { id: 'topaz_ring', name: '토파즈 반지', impl: [{ k: 'light_res', v: 20 }] },
    { id: 'coral_ring', name: '산호 반지', impl: [{ k: 'life', v: 25 }] },
  ],
  amulet: [
    { id: 'amber', name: '호박 목걸이', impl: [{ k: 'str', v: 20 }] },
    { id: 'jade', name: '비취 목걸이', impl: [{ k: 'dex', v: 20 }] },
    { id: 'lapis', name: '청금석 목걸이', impl: [{ k: 'int', v: 20 }] },
    { id: 'onyx', name: '오닉스 목걸이', impl: [{ k: 'all_attr', v: 10 }] },
  ],
};
const BASE_BY_ID = {};
for (const slot in BASES) for (const b of BASES[slot]) { b.slot = slot; BASE_BY_ID[b.id] = b; }
const ITEM_SLOTS = Object.keys(BASES);
const ARMOR_SLOTS = ['helm', 'body', 'gloves', 'boots'];

// ===================== 접두/접미 =====================
// tiers: [ilvl, lo, hi]  /  add_*: [ilvl, minLo, minHi, maxLo, maxHi]
const ALL_ARMOR_JEWEL = ['helm', 'body', 'gloves', 'boots', 'belt', 'ring', 'amulet'];
const ALL_SLOTS = ['weapon', ...ALL_ARMOR_JEWEL];
const AFFIXES = [
  // ---- 접두 ----
  { id: 'add_phys', pre: true, name: '날카로운', k: 'add_phys', slots: ['weapon', 'ring', 'gloves'], w: 10, tiers: [[1, 1, 2, 3, 5], [10, 3, 5, 7, 11], [20, 5, 8, 12, 18], [35, 8, 13, 19, 28], [50, 13, 20, 28, 42], [65, 20, 30, 40, 60]] },
  { id: 'add_fire', pre: true, name: '불타는', k: 'add_fire', slots: ['weapon', 'ring', 'gloves'], w: 7, tiers: [[1, 2, 3, 4, 7], [10, 4, 7, 9, 14], [20, 7, 11, 15, 23], [35, 11, 17, 24, 36], [50, 17, 26, 36, 54], [65, 26, 38, 52, 78]] },
  { id: 'add_cold', pre: true, name: '서리 맺힌', k: 'add_cold', slots: ['weapon', 'ring', 'gloves'], w: 7, tiers: [[1, 2, 3, 4, 6], [10, 4, 6, 8, 12], [20, 6, 10, 13, 20], [35, 10, 15, 21, 32], [50, 15, 23, 32, 48], [65, 23, 34, 46, 70]] },
  { id: 'add_light', pre: true, name: '번쩍이는', k: 'add_light', slots: ['weapon', 'ring', 'gloves'], w: 7, tiers: [[1, 1, 1, 6, 10], [10, 1, 2, 14, 22], [20, 2, 4, 24, 38], [35, 3, 6, 38, 60], [50, 5, 9, 58, 90], [65, 8, 13, 88, 130]] },
  { id: 'add_chaos', pre: true, name: '부패한', k: 'add_chaos', slots: ['weapon', 'amulet'], w: 3, tiers: [[15, 3, 5, 7, 10], [30, 6, 9, 13, 19], [45, 10, 14, 20, 30], [60, 15, 22, 30, 45]] },
  { id: 'inc_phys', pre: true, name: '잔혹한', k: 'inc_phys', slots: ['weapon'], w: 9, tiers: [[1, 0.10, 0.19], [15, 0.20, 0.34], [30, 0.35, 0.54], [45, 0.55, 0.79], [60, 0.80, 1.10]] },
  { id: 'inc_spell', pre: true, name: '현자의', k: 'inc_spell', slots: ['weapon', 'amulet', 'helm'], w: 8, tiers: [[1, 0.10, 0.19], [15, 0.20, 0.34], [30, 0.35, 0.54], [45, 0.55, 0.79], [60, 0.80, 1.10]] },
  { id: 'inc_ele', pre: true, name: '원소의', k: 'inc_ele', slots: ['weapon', 'amulet', 'gloves'], w: 7, tiers: [[1, 0.08, 0.15], [15, 0.16, 0.25], [30, 0.26, 0.38], [45, 0.39, 0.55], [60, 0.56, 0.75]] },
  { id: 'inc_proj', pre: true, name: '명사수의', k: 'inc_proj', slots: ['weapon', 'gloves', 'helm'], w: 6, tiers: [[1, 0.08, 0.15], [15, 0.16, 0.25], [30, 0.26, 0.38], [45, 0.39, 0.55], [60, 0.56, 0.75]] },
  { id: 'inc_melee', pre: true, name: '야수의', k: 'inc_melee', slots: ['weapon', 'gloves', 'helm'], w: 6, tiers: [[1, 0.08, 0.15], [15, 0.16, 0.25], [30, 0.26, 0.38], [45, 0.39, 0.55], [60, 0.56, 0.75]] },
  { id: 'life', pre: true, name: '건강한', k: 'life', slots: ALL_ARMOR_JEWEL, w: 12, tiers: [[1, 10, 19], [10, 20, 34], [20, 35, 54], [35, 55, 79], [50, 80, 109], [65, 110, 150]] },
  { id: 'armor', pre: true, name: '단단한', k: 'armor', slots: ['helm', 'body', 'gloves', 'boots', 'belt'], w: 8, tiers: [[1, 10, 25], [12, 26, 60], [24, 61, 120], [36, 121, 200], [50, 201, 320], [64, 321, 500]] },
  { id: 'evasion', pre: true, name: '민첩한', k: 'evasion', slots: ['helm', 'body', 'gloves', 'boots'], w: 8, tiers: [[1, 10, 25], [12, 26, 60], [24, 61, 120], [36, 121, 200], [50, 201, 320], [64, 321, 500]] },
  { id: 'inc_armor', pre: true, name: '강철의', k: 'inc_armor', slots: ['body', 'helm', 'gloves'], w: 6, tiers: [[5, 0.15, 0.30], [20, 0.31, 0.50], [40, 0.51, 0.75], [60, 0.76, 1.0]] },
  { id: 'inc_eva', pre: true, name: '그림자의', k: 'inc_eva', slots: ['body', 'helm', 'boots'], w: 6, tiers: [[5, 0.15, 0.30], [20, 0.31, 0.50], [40, 0.51, 0.75], [60, 0.76, 1.0]] },
  { id: 'res_max', pre: true, name: '심연의', k: 'res', slots: ['helm', 'amulet', 'ring', 'belt'], w: 7, tiers: [[1, 8, 15], [12, 16, 25], [24, 26, 38], [40, 39, 55], [56, 56, 75]] },
  { id: 'proj', pre: true, name: '분열하는', k: 'proj', slots: ['weapon'], w: 0.6, tiers: [[40, 1, 1]] },
  { id: 'inc_aoe', pre: true, name: '광활한', k: 'inc_aoe', slots: ['helm', 'amulet'], w: 4, tiers: [[8, 0.08, 0.12], [25, 0.13, 0.18], [45, 0.19, 0.25]] },
  { id: 'inc_dot', pre: true, name: '고통의', k: 'inc_dot', slots: ['weapon', 'amulet'], w: 4, tiers: [[8, 0.15, 0.25], [25, 0.26, 0.40], [45, 0.41, 0.60]] },
  // ---- 접미 ----
  { id: 'fire_res', name: '불꽃의', k: 'fire_res', slots: ALL_SLOTS, w: 10, tiers: [[1, 6, 11], [12, 12, 17], [24, 18, 23], [36, 24, 29], [48, 30, 35], [60, 36, 45]] },
  { id: 'cold_res', name: '서리의', k: 'cold_res', slots: ALL_SLOTS, w: 10, tiers: [[1, 6, 11], [12, 12, 17], [24, 18, 23], [36, 24, 29], [48, 30, 35], [60, 36, 45]] },
  { id: 'light_res', name: '번개의', k: 'light_res', slots: ALL_SLOTS, w: 10, tiers: [[1, 6, 11], [12, 12, 17], [24, 18, 23], [36, 24, 29], [48, 30, 35], [60, 36, 45]] },
  { id: 'chaos_res', name: '정화의', k: 'chaos_res', slots: ALL_SLOTS, w: 5, tiers: [[10, 5, 10], [25, 11, 17], [40, 18, 25], [55, 26, 35]] },
  { id: 'all_res', name: '무지개의', k: 'all_res', slots: ALL_ARMOR_JEWEL, w: 2.5, tiers: [[10, 3, 6], [25, 7, 10], [40, 11, 14], [55, 15, 20]] },
  { id: 'str', name: '황소의', k: 'str', slots: ALL_SLOTS, w: 8, tiers: [[1, 5, 10], [12, 11, 17], [24, 18, 24], [36, 25, 32], [50, 33, 42], [64, 43, 55]] },
  { id: 'dex', name: '살쾡이의', k: 'dex', slots: ALL_SLOTS, w: 8, tiers: [[1, 5, 10], [12, 11, 17], [24, 18, 24], [36, 25, 32], [50, 33, 42], [64, 43, 55]] },
  { id: 'int', name: '올빼미의', k: 'int', slots: ALL_SLOTS, w: 8, tiers: [[1, 5, 10], [12, 11, 17], [24, 18, 24], [36, 25, 32], [50, 33, 42], [64, 43, 55]] },
  { id: 'all_attr', name: '현인의', k: 'all_attr', slots: ['amulet', 'ring', 'belt'], w: 2, tiers: [[15, 4, 7], [35, 8, 12], [55, 13, 18]] },
  { id: 'inc_aspd', name: '속사의', k: 'inc_aspd', slots: ['weapon', 'gloves'], w: 8, tiers: [[1, 0.04, 0.07], [15, 0.08, 0.11], [30, 0.12, 0.15], [45, 0.16, 0.20], [60, 0.21, 0.26]] },
  { id: 'inc_cspd', name: '주문가의', k: 'inc_cspd', slots: ['weapon', 'gloves', 'amulet'], w: 8, tiers: [[1, 0.04, 0.07], [15, 0.08, 0.11], [30, 0.12, 0.15], [45, 0.16, 0.20], [60, 0.21, 0.26]] },
  { id: 'inc_crit', name: '저격수의', k: 'inc_crit', slots: ['weapon', 'amulet', 'ring'], w: 7, tiers: [[1, 0.10, 0.19], [15, 0.20, 0.29], [30, 0.30, 0.39], [45, 0.40, 0.49], [60, 0.50, 0.65]] },
  { id: 'crit_multi', name: '처형자의', k: 'crit_multi', slots: ['weapon', 'amulet'], w: 5, tiers: [[8, 0.10, 0.17], [22, 0.18, 0.25], [38, 0.26, 0.34], [55, 0.35, 0.45]] },
  { id: 'inc_move', name: '질주의', k: 'inc_move', slots: ['boots'], w: 10, tiers: [[1, 0.08, 0.12], [15, 0.13, 0.17], [30, 0.18, 0.22], [50, 0.23, 0.30]] },
  { id: 'life_regen', name: '재생의', k: 'life_regen', slots: ['body', 'ring', 'belt', 'helm'], w: 7, tiers: [[1, 1, 2], [12, 3, 5], [24, 6, 9], [36, 10, 15], [50, 16, 24], [64, 25, 36]] },
  { id: 'leech', name: '흡혈귀의', k: 'leech', slots: ['weapon', 'amulet', 'gloves'], w: 4, tiers: [[8, 0.005, 0.010], [25, 0.011, 0.020], [45, 0.021, 0.030]] },
  { id: 'res_regen', name: '명상의', k: 'res_regen', slots: ['helm', 'amulet', 'ring'], w: 6, tiers: [[1, 1, 2], [15, 3, 4], [30, 5, 7], [50, 8, 11]] },
  { id: 'life_on_kill', name: '약탈자의', k: 'life_on_kill', slots: ['weapon', 'ring', 'boots'], w: 5, tiers: [[1, 3, 6], [15, 7, 12], [30, 13, 22], [50, 23, 40]] },
  { id: 'thorns', name: '가시의', k: 'thorns', slots: ['body', 'belt'], w: 4, tiers: [[5, 5, 10], [20, 11, 25], [40, 26, 60], [60, 61, 120]] },
  { id: 'dodge_cd', name: '유령의', k: 'dodge_cd', slots: ['boots'], w: 4, tiers: [[10, 0.10, 0.15], [30, 0.16, 0.25], [50, 0.26, 0.35]] },
  { id: 'potion_charges', name: '약제사의', k: 'potion_charges', slots: ['belt'], w: 3, tiers: [[10, 1, 1], [40, 2, 2]] },
  { id: 'reduced_cost', name: '절제의', k: 'reduced_cost', slots: ['helm', 'amulet'], w: 3, tiers: [[10, 0.05, 0.10], [30, 0.11, 0.18], [50, 0.19, 0.25]] },
];
const AFFIX_BY_ID = {}; for (const a of AFFIXES) AFFIX_BY_ID[a.id] = a;

// ===================== 희귀 아이템 이름 =====================
const RARE_PREFIX = ['피의', '죽음의', '심연의', '달빛', '폭풍', '재앙의', '망령의', '영원의', '추방자의', '성스러운', '비명의', '파멸의', '황혼의', '새벽의', '늑대의', '검은', '붉은', '저주받은', '잊혀진', '군주의'];
const RARE_SUFFIX = {
  weapon: ['송곳니', '이빨', '비명', '종말', '심판', '칼날', '분노', '약속', '갈증', '독니'],
  armor: ['껍질', '피부', '성벽', '수의', '장막', '갑주', '보호', '허물', '외피'],
  jewel: ['눈', '고리', '속삭임', '맹세', '인장', '심장', '기억', '눈물'],
};

// ===================== 형상 (디아블로 4 Aspect) =====================
const ASPECTS = {
  bleed_fang: { name: '혈족의 형상', desc: '타격 시 출혈을 부여하고, 처치 시 자원 +15', slots: ['weapon', 'gloves'] },
  dawn_verdict: { name: '새벽의 형상', desc: '낮 보너스 2배', slots: ['weapon', 'amulet'] },
  twilight_focus: { name: '황혼의 형상', desc: '새벽/황혼에 시전 속도와 공격 속도 +40%', slots: ['weapon', 'helm'] },
  reaper: { name: '사신의 형상', desc: '처치한 적이 폭발하여 주변에 최대 생명력의 30% 물리 피해', slots: ['weapon', 'gloves', 'amulet'] },
  tyrant: { name: '폭군의 형상', desc: '피격 시 주위에 화염 폭발 (받은 피해의 300%)', slots: ['body', 'belt', 'helm'] },
  night_crown: { name: '밤의 형상', desc: '밤에 이동 속도 +25%, 모든 투사체 연쇄 +1', slots: ['helm', 'amulet'] },
  fire_trail: { name: '불꽃 궤적의 형상', desc: '회피 구르기가 불꽃 궤적을 남긴다', slots: ['boots', 'belt'] },
  abyssal: { name: '심연의 형상', desc: '물리 피해의 25%를 추가 카오스 피해로 얻는다', slots: ['ring', 'amulet', 'weapon'] },
  crit_freeze: { name: '혹한의 형상', desc: '치명타 시 적을 1초간 동결', slots: ['amulet', 'ring', 'weapon'] },
  potion_nova: { name: '굶주림의 형상', desc: '포션 사용 시 주위에 폭발 (최대 생명력의 200% 피해), 포션 충전 +1', slots: ['belt', 'body'] },
  storm_hands: { name: '폭풍의 형상', desc: '타격 시 25% 확률로 낙뢰 (강력한 번개 피해)', slots: ['gloves', 'ring'] },
  martyr: { name: '순교자의 형상', desc: '자원이 가득 찰수록 피해 증폭 (최대 40%)', slots: ['body', 'helm', 'amulet'] },
};

// ===================== 유니크 =====================
const UNIQUES = [
  { id: 'u_fang', name: '혈족의 송곳니', base: 'dagger', lvl: 3, mods: [{ k: 'inc_phys', v: 0.6 }, { k: 'leech', v: 0.03 }, { k: 'inc_aspd', v: 0.15 }], aspect: 'bleed_fang', flavor: '첫 번째 혈족이 남긴 이빨. 아직도 목마르다.' },
  { id: 'u_dawn', name: '새벽의 심판', base: 'gun', lvl: 6, mods: [{ k: 'inc_proj', v: 0.5 }, { k: 'proj', v: 1 }, { k: 'inc_day', v: 0.15 }], aspect: 'dawn_verdict', flavor: '태양이 뜨는 방향으로 겨눠라.' },
  { id: 'u_twilight', name: '황혼의 지팡이', base: 'staff', lvl: 6, mods: [{ k: 'inc_spell', v: 0.6 }, { k: 'inc_twilight', v: 0.25 }, { k: 'res', v: 40 }], aspect: 'twilight_focus', flavor: '낮과 밤 사이, 세 번째 길.' },
  { id: 'u_reaper', name: '사신의 낫', base: 'scythe', lvl: 18, mods: [{ k: 'inc_phys', v: 0.9 }, { k: 'life_on_kill', v: 30 }], aspect: 'reaper', flavor: '수확은 끝나지 않는다.' },
  { id: 'u_tyrant', name: '폭군의 흉갑', base: 'plate', lvl: 10, mods: [{ k: 'inc_armor', v: 0.8 }, { k: 'life', v: 60 }, { k: 'fire_res', v: 30 }], aspect: 'tyrant', flavor: '폭군은 죽어서도 불탄다.' },
  { id: 'u_nightcrown', name: '밤의 왕관', base: 'circlet', lvl: 14, mods: [{ k: 'chain', v: 1 }, { k: 'inc_night', v: 0.15 }, { k: 'res', v: 30 }], aspect: 'night_crown', flavor: '왕관을 쓴 자, 밤을 다스린다.' },
  { id: 'u_exilestep', name: '추방자의 발걸음', base: 'boots', lvl: 8, mods: [{ k: 'inc_move', v: 0.30 }, { k: 'dodge_cd', v: 0.30 }], aspect: 'fire_trail', flavor: '추방자는 뒤돌아보지 않는다.' },
  { id: 'u_abyss', name: '심연의 반지', base: 'iron_ring', lvl: 16, mods: [{ k: 'chaos_res', v: 40 }, { k: 'add_chaos', min: 8, max: 16 }], aspect: 'abyssal', flavor: '심연을 들여다본 자의 손가락.' },
  { id: 'u_huntereye', name: '사냥꾼의 눈', base: 'jade', lvl: 12, mods: [{ k: 'inc_crit', v: 0.6 }, { k: 'crit_multi', v: 0.3 }], aspect: 'crit_freeze', flavor: '사냥꾼의 눈은 얼음처럼 차갑다.' },
  { id: 'u_hunger', name: '굶주린 허리띠', base: 'belt', lvl: 5, mods: [{ k: 'potion_charges', v: 2 }, { k: 'life', v: 40 }], aspect: 'potion_nova', flavor: '배고픔은 최고의 무기.' },
  { id: 'u_storm', name: '폭풍 장갑', base: 'gloves', lvl: 15, mods: [{ k: 'add_light', min: 5, max: 40 }, { k: 'inc_cspd', v: 0.1 }, { k: 'inc_aspd', v: 0.1 }], aspect: 'storm_hands', flavor: '손끝에서 폭풍이 태어난다.' },
  { id: 'u_martyr', name: '순교자의 로브', base: 'robe', lvl: 22, mods: [{ k: 'inc_spell', v: 0.5 }, { k: 'life', v: -40 }, { k: 'inc_res', v: 0.5 }], aspect: 'martyr', flavor: '믿음이 가득할 때 불꽃은 가장 뜨겁다.' },
];
const UNIQUE_BY_ID = {}; for (const u of UNIQUES) UNIQUE_BY_ID[u.id] = u;

// ===================== 화폐 (오브) =====================
const CURRENCY = {
  transmute: { name: '변환의 오브', short: '변환', color: '#8fb3ff', w: 26, desc: '일반 아이템을 마법 아이템으로 변환', target: 'item' },
  alteration: { name: '변경의 오브', short: '변경', color: '#6d9cff', w: 22, desc: '마법 아이템의 속성을 다시 굴린다', target: 'item' },
  augment: { name: '증강의 오브', short: '증강', color: '#9ad0ff', w: 14, desc: '마법 아이템에 속성 하나 추가', target: 'item' },
  regal: { name: '군주의 오브', short: '군주', color: '#ffd86b', w: 7, desc: '마법 아이템을 희귀로 격상 (속성 하나 추가)', target: 'item' },
  alchemy: { name: '연금술의 오브', short: '연금', color: '#ffb347', w: 9, desc: '일반 아이템을 희귀 아이템으로 변환', target: 'item' },
  chaos: { name: '카오스 오브', short: '카오스', color: '#c77dff', w: 6, desc: '희귀 아이템의 속성을 전부 다시 굴린다', target: 'item' },
  exalt: { name: '엑잘티드 오브', short: '엑잘', color: '#fff3b0', w: 1.2, desc: '희귀 아이템에 속성 하나 추가', target: 'item' },
  annul: { name: '무효의 오브', short: '무효', color: '#aaaaaa', w: 2.5, desc: '속성 하나를 무작위로 제거', target: 'item' },
  scour: { name: '소멸의 오브', short: '소멸', color: '#dddddd', w: 8, desc: '모든 속성을 제거하여 일반 아이템으로', target: 'item' },
  divine: { name: '신성한 오브', short: '신성', color: '#ffffff', w: 1.8, desc: '속성 수치를 다시 굴린다', target: 'item' },
  regret: { name: '후회의 오브', short: '후회', color: '#ff7eb6', w: 3, desc: '패시브 트리에서 할당된 노드를 우클릭하여 포인트 환불', target: 'passive' },
  gemcutter: { name: '젬 연마사의 프리즘', short: '연마', color: '#7ef0d0', w: 3.5, desc: '젬 레벨 +1 (최대 20). 젬 패널에서 젬을 클릭', target: 'gem' },
  essence: { name: '정수', short: '정수', color: '#9fe1a5', w: 0, desc: '아이템 분해로 얻는 조각. 5개를 변환의 오브 1개로 정제할 수 있다', target: 'none' },
};
const CURRENCY_IDS = Object.keys(CURRENCY);
