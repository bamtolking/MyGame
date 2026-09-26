// 공허기사 — greatsword knight of the abyss: life drain, dark waves, pull and eclipse. Unlocked on nightmare.
import type { ClassPack } from '../../data/classes';

const pct = (v: number) => `무기 피해의 ${Math.round(v)}%`;

export const VOIDKNIGHT: ClassPack = {
  def: {
    id: 'voidknight', name: '공허기사', title: '심연을 삼킨 자',
    desc: '심연의 힘을 받아들인 기사. 대검으로 생명력을 빨아들이고, 적을 한곳에 끌어모아 일식으로 삼켜 버립니다.',
    attrs: { str: 30, dex: 15, vit: 25, ene: 10 }, main: 'str',
    hpBase: 50, hpLvl: 4.2, hpVit: 2.5, mpBase: 10, mpLvl: 1, mpEne: 1.2,
    color: '#2a1034', accent: '#c07aff',
    autoAttr: { str: 2, dex: 1, vit: 2, ene: 0 },
    startGear: ['rustblade', 'quilted'],
    skills: ['vk_drain', 'vk_wave', 'vk_grasp', 'vk_shroud', 'vk_eclipse'],
    basic: 'vk_slash',
    unlock: { diff: 1, text: '악몽 난이도에서 보스 처치' },
    ranged: false, spell: false, critPerDex: 0, reach: 0, reach2h: 0.35, offhandHint: '',
  },
  skills: [
    {
      id: 'vk_slash', cls: 'voidknight', name: '공허 베기', icon: 'vk_slash', req: 1, kind: 'melee', range: 1.3, elem: 'phys',
      mana: () => 0, cd: () => 0, pct: () => 100,
      desc: '대검을 크게 휘둘러 벱니다.', detail: () => [pct(100)],
    },
    {
      id: 'vk_drain', cls: 'voidknight', name: '흡혈 일격', icon: 'vk_drain', req: 1, kind: 'melee', range: 1.3, elem: 'phys',
      mana: (r) => 3 + Math.floor(r * 0.3), cd: () => 0, pct: (r) => 150 + 17 * r,
      desc: '적의 생명력을 찢어 삼키는 일격. 입힌 피해의 일부만큼 생명력을 회복합니다.',
      detail: (r) => [pct(150 + 17 * r), '입힌 피해의 25% 회복'],
      ai: { maxDist: 1.9 },
    },
    {
      id: 'vk_wave', cls: 'voidknight', name: '암흑 파동', icon: 'vk_wave', req: 3, kind: 'proj', range: 9, elem: 'cold', anim: 'attack',
      mana: (r) => 6 + Math.floor(r * 0.4), cd: () => 0, pct: (r) => 120 + 14 * r,
      desc: '대검을 휘둘러 초승달 모양의 암흑 파동을 날립니다. 벽과 적을 모두 뚫고 적을 얼어붙게 둔화시킵니다.',
      detail: (r) => [`${pct(120 + 14 * r)} (냉기) · 모두 관통`, '둔화 1.5초'],
      ai: { crowd: 2 },
    },
    {
      id: 'vk_grasp', cls: 'voidknight', name: '심연의 손아귀', icon: 'vk_grasp', req: 6, kind: 'target', range: 9, elem: 'phys', anim: 'cast',
      mana: () => 9, cd: () => 4, pct: (r) => 80 + 9 * r,
      timing: { dur: 0.5, hitAt: 0.55 },
      desc: '목표 지점에 심연의 손을 뻗어 주변 적을 한가운데로 끌어당기고 기절시킵니다.',
      detail: (r) => [pct(80 + 9 * r), `반경 4칸 끌어당기기 · 기절 ${(1 + 0.1 * r).toFixed(1)}초`, '재사용 4초'],
      ai: { crowd: 3 },
    },
    {
      id: 'vk_shroud', cls: 'voidknight', name: '공허의 장막', icon: 'vk_shroud', req: 10, kind: 'self', range: 0, elem: 'phys', anim: 'cast',
      mana: () => 12, cd: () => 22, pct: (r) => 35 + 4 * r,
      timing: { dur: 0.5, hitAt: 0.5 },
      desc: '10초간 공허를 두릅니다. 피해가 크게 오르고, 생명력을 흡수하며, 받는 피해가 줄어듭니다.',
      detail: (r) => [`피해 +${35 + 4 * r}% · 생명력 흡수 +6%`, '받는 피해 -15% (10초)', '재사용 22초'],
      ai: { buff: true, crowd: 2 },
    },
    {
      id: 'vk_eclipse', cls: 'voidknight', name: '일식', icon: 'vk_eclipse', req: 15, kind: 'self', range: 5, elem: 'cold', anim: 'cast',
      mana: () => 24, cd: () => 9, pct: (r) => 300 + 32 * r,
      timing: { dur: 0.7, hitAt: 0.6 },
      desc: '주위를 어둠으로 뒤덮어 반경 5칸의 모든 적에게 큰 피해를 주고, 겁에 질려 달아나게 합니다.',
      detail: (r) => [`${pct(300 + 32 * r)} (냉기)`, '반경 5칸 · 공포 2초', '재사용 9초'],
      ai: { crowd: 3, boss: true },
    },
  ],
};
