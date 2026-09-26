// 드루이드 — nature and storm caster (staff + totem). Unlocked at hero level 20.
import type { ClassPack } from '../../data/classes';

const pct = (v: number) => `무기 피해의 ${Math.round(v)}%`;

export const DRUID: ClassPack = {
  def: {
    id: 'druid', name: '드루이드', title: '숲과 폭풍의 목소리',
    desc: '자연의 힘을 부립니다. 회오리바람과 늑대 영혼으로 적을 몰아치고, 가시 덩굴로 묶으며, 생명의 비로 스스로를 치유합니다.',
    attrs: { str: 15, dex: 15, vit: 25, ene: 25 }, main: 'ene',
    hpBase: 40, hpLvl: 3, hpVit: 2.3, mpBase: 18, mpLvl: 1.8, mpEne: 1.8,
    color: '#24441e', accent: '#b2ec78',
    autoAttr: { str: 0, dex: 0, vit: 2, ene: 3 },
    startGear: ['oakStaff', 'woodTotem'],
    skills: ['dr_tornado', 'dr_vines', 'dr_wolves', 'dr_renewal', 'dr_storm'],
    basic: 'dr_thorn',
    unlock: { level: 20, text: '영웅 레벨 20 달성' },
    ranged: true, spell: true, critPerDex: 0, reach: 0, reach2h: 0, offhandHint: 'beastTotem',
  },
  skills: [
    {
      id: 'dr_thorn', cls: 'druid', name: '가시 씨앗', icon: 'dr_thorn', req: 1, kind: 'proj', range: 11, elem: 'phys', anim: 'cast',
      mana: () => 0, cd: () => 0, pct: () => 100,
      desc: '단단한 가시 씨앗을 쏘아 보냅니다.', detail: () => [pct(100)],
    },
    {
      id: 'dr_tornado', cls: 'druid', name: '회오리바람', icon: 'dr_tornado', req: 1, kind: 'proj', range: 10, elem: 'phys',
      mana: (r) => 5 + Math.floor(r * 0.4), cd: () => 0, pct: (r) => 60 + 7 * r,
      desc: '제멋대로 휘어 나아가는 회오리바람을 일으킵니다. 적을 뚫고 지나가며 여러 번 때립니다.',
      detail: (r) => [`${pct(60 + 7 * r)} · 0.4초마다 다시 적중`, '1.6초 동안 이동'],
      ai: { crowd: 1 },
    },
    {
      id: 'dr_vines', cls: 'druid', name: '가시 덩굴', icon: 'dr_vines', req: 3, kind: 'target', range: 10, elem: 'poison',
      mana: (r) => 8 + Math.floor(r * 0.4), cd: () => 1, pct: (r) => 35 + 4 * r,
      timing: { dur: 0.45, hitAt: 0.55 },
      desc: '목표 지역에 가시 덩굴을 피워 4초 동안 적을 묶어 둔화시키고 독 피해를 줍니다.',
      detail: (r) => [`0.5초마다 ${pct(35 + 4 * r)} (독)`, '반경 2.6칸 · 4초', '처음 닿으면 0.5초 속박 · 안에서는 이동 속도 절반'],
      ai: { crowd: 2 },
    },
    {
      id: 'dr_wolves', cls: 'druid', name: '늑대 영혼', icon: 'dr_wolves', req: 6, kind: 'proj', range: 11, elem: 'phys',
      mana: (r) => 10 + Math.floor(r * 0.4), cd: () => 0, pct: (r) => 85 + 9 * r,
      desc: '늑대의 영혼을 풀어놓습니다. 영혼들은 스스로 적을 쫓아가 물어뜯습니다.',
      detail: (r) => [`늑대 ${r >= 6 ? 4 : 3}마리 × ${pct(85 + 9 * r)}`, '적을 추적해 한 번씩 물어뜯음'],
      ai: {},
    },
    {
      id: 'dr_renewal', cls: 'druid', name: '생명의 비', icon: 'dr_renewal', req: 10, kind: 'self', range: 3, elem: 'phys',
      mana: () => 12, cd: () => 14, pct: (r) => 25 + 2 * r,
      timing: { dur: 0.5, hitAt: 0.5 },
      desc: '치유의 비를 내려 4초 동안 최대 생명력의 일부를 회복하고, 10초간 생명력 재생이 오릅니다.',
      detail: (r) => [`4초간 최대 생명력의 ${25 + 2 * r}% 회복`, `생명력 재생 +${(2 + 0.4 * r).toFixed(1)}/초 (10초)`, '재사용 14초'],
      ai: { lowHp: 0.55 },
    },
    {
      id: 'dr_storm', cls: 'druid', name: '천둥 폭풍', icon: 'dr_storm', req: 15, kind: 'target', range: 11, elem: 'light',
      mana: () => 22, cd: () => 8, pct: (r) => 120 + 12 * r,
      timing: { dur: 0.6, hitAt: 0.55 },
      desc: '목표 지역 위에 먹구름을 불러 6초 동안 안의 적에게 번개를 내리칩니다.',
      detail: (r) => [`0.35초마다 ${pct(120 + 12 * r)} (번개)`, '반경 4칸 · 6초', '재사용 8초'],
      ai: { crowd: 2, boss: true },
    },
  ],
};
