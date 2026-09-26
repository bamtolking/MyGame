// 강령술사 — bone, corpse and plague magic with skeletal mage turrets. Unlocked by defeating Ignira (floor 9 boss).
import type { ClassPack } from '../../data/classes';

const pct = (v: number) => `무기 피해의 ${Math.round(v)}%`;

export const NECROMANCER: ClassPack = {
  def: {
    id: 'necromancer', name: '강령술사', title: '무덤의 주인',
    desc: '뼈와 역병, 죽은 자를 부립니다. 쓰러진 적의 시체를 터뜨리고 해골 마법사를 일으켜 싸우게 합니다.',
    attrs: { str: 10, dex: 15, vit: 20, ene: 35 }, main: 'ene',
    hpBase: 36, hpLvl: 2.6, hpVit: 2, mpBase: 20, mpLvl: 2, mpEne: 2,
    color: '#1e2a24', accent: '#8affb8',
    autoAttr: { str: 0, dex: 0, vit: 2, ene: 3 },
    startGear: ['graveWand', 'shrunkenSkull', 'quilted'],
    skills: ['nc_spear', 'nc_corpse', 'nc_mage', 'nc_armor', 'nc_plague'],
    basic: 'nc_bolt',
    unlock: { boss: 'ignira', text: '용암 여왕 이그니라(9층 보스) 처치' },
    ranged: true, spell: true, critPerDex: 0, reach: 0, reach2h: 0, offhandHint: 'hexSkull',
  },
  skills: [
    {
      id: 'nc_bolt', cls: 'necromancer', name: '뼈 화살', icon: 'nc_bolt', req: 1, kind: 'proj', range: 11, elem: 'phys', anim: 'cast',
      mana: () => 0, cd: () => 0, pct: () => 100,
      desc: '날카로운 뼈 조각을 쏘아 보냅니다.', detail: () => [pct(100)],
    },
    {
      id: 'nc_spear', cls: 'necromancer', name: '뼈 창', icon: 'nc_spear', req: 1, kind: 'proj', range: 12, elem: 'phys',
      mana: (r) => 5 + Math.floor(r * 0.45), cd: () => 0, pct: (r) => 140 + 17 * r,
      desc: '길게 벼린 뼈 창을 쏘아 일직선 위의 모든 적을 꿰뚫습니다.',
      detail: (r) => [`${pct(140 + 17 * r)} · 모두 관통`],
      ai: {},
    },
    {
      id: 'nc_corpse', cls: 'necromancer', name: '시체 폭발', icon: 'nc_corpse', req: 3, kind: 'target', range: 10, elem: 'fire',
      mana: (r) => 8 + Math.floor(r * 0.4), cd: () => 0.5, pct: (r) => 60 + 8 * r,
      timing: { dur: 0.45, hitAt: 0.5 },
      desc: '목표 근처의 시체를 최대 3구까지 터뜨립니다. 시체의 최대 생명력에 비례한 화염·물리 피해를 줍니다. 시체가 없으면 쓸 수 없습니다.',
      detail: (r) => [`시체 최대 생명력의 40% + ${pct(60 + 8 * r)}`, '폭발 반경 2.6칸 · 시체 3구까지'],
      ai: { crowd: 4 },
    },
    {
      id: 'nc_mage', cls: 'necromancer', name: '해골 마법사', icon: 'nc_mage', req: 6, kind: 'target', range: 8, elem: 'cold',
      mana: () => 12, cd: () => 1, pct: (r) => 70 + 8 * r,
      timing: { dur: 0.5, hitAt: 0.6 },
      desc: '땅에서 해골 마법사를 일으킵니다. 14초 동안 제자리에서 가까운 적에게 냉기 뼈 화살을 쏘아 둔화시킵니다. 최대 3구.',
      detail: (r) => [`0.8초마다 ${pct(70 + 8 * r)} (냉기 · 둔화)`, '지속 14초 · 사거리 7칸 · 최대 3구'],
      ai: { crowd: 1 },
    },
    {
      id: 'nc_armor', cls: 'necromancer', name: '뼈 갑옷', icon: 'nc_armor', req: 10, kind: 'self', range: 0, elem: 'phys',
      mana: () => 12, cd: () => 18, pct: (r) => 20 + 1.5 * r,
      timing: { dur: 0.45, hitAt: 0.5 },
      desc: '12초간 뼈 갑옷을 두릅니다. 받는 피해가 줄고, 근접 공격한 적에게 뼈 조각이 박힙니다.',
      detail: (r) => [`받는 피해 -${Math.min(40, Math.round(20 + 1.5 * r))}%`, `피해 반사 +${10 + 3 * r}`, '재사용 18초'],
      ai: { buff: true, crowd: 1 },
    },
    {
      id: 'nc_plague', cls: 'necromancer', name: '역병 폭풍', icon: 'nc_plague', req: 15, kind: 'target', range: 10, elem: 'poison',
      mana: () => 20, cd: () => 5, pct: (r) => 45 + 5 * r,
      timing: { dur: 0.55, hitAt: 0.55 },
      desc: '목표 지역에 역병 구름을 퍼뜨립니다. 5초 동안 안의 적은 둔화되고 계속 독 피해를 입습니다.',
      detail: (r) => [`0.5초마다 ${pct(45 + 5 * r)} (독)`, '반경 3.4칸 · 5초 · 둔화', '재사용 5초'],
      ai: { crowd: 3, boss: true },
    },
  ],
};
