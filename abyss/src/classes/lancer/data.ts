// 창기사 — long-reach spear fighter with lightning. Unlocked by defeating Gromak (floor 6 boss).
import type { ClassPack } from '../../data/classes';

const pct = (v: number) => `무기 피해의 ${Math.round(v)}%`;

export const LANCER: ClassPack = {
  def: {
    id: 'lancer', name: '창기사', title: '폭풍의 용기병',
    desc: '긴 창으로 적이 닿기 전에 꿰뚫습니다. 한 줄로 늘어선 적을 관통하고, 번개를 두른 창을 던지며, 하늘에서 내리꽂힙니다.',
    attrs: { str: 25, dex: 25, vit: 20, ene: 10 }, main: 'str',
    hpBase: 44, hpLvl: 3.6, hpVit: 2.3, mpBase: 12, mpLvl: 1.2, mpEne: 1.3,
    color: '#1e3a5a', accent: '#8ad8ff',
    autoAttr: { str: 2, dex: 1, vit: 2, ene: 0 },
    startGear: ['pike', 'quilted'],
    skills: ['ln_pierce', 'ln_sweep', 'ln_javelin', 'ln_dragon', 'ln_storm'],
    basic: 'ln_thrust',
    unlock: { boss: 'gromak', text: '갈고리 도살꾼 그로막(6층 보스) 처치' },
    ranged: false, spell: false, critPerDex: 0.01, reach: 0.75, reach2h: 0, offhandHint: '',
  },
  skills: [
    {
      id: 'ln_thrust', cls: 'lancer', name: '찌르기', icon: 'ln_thrust', req: 1, kind: 'melee', range: 1.9, elem: 'phys',
      mana: () => 0, cd: () => 0, pct: () => 100,
      desc: '긴 창으로 멀리서 찌릅니다.', detail: () => [pct(100)],
    },
    {
      id: 'ln_pierce', cls: 'lancer', name: '관통 찌르기', icon: 'ln_pierce', req: 1, kind: 'proj', range: 3.8, elem: 'phys', anim: 'attack',
      mana: (r) => 3 + Math.floor(r * 0.3), cd: () => 0, pct: (r) => 140 + 16 * r,
      desc: '창을 깊숙이 내질러 앞쪽 일직선 위의 모든 적을 꿰뚫습니다.',
      detail: (r) => [pct(140 + 16 * r), '길이 3.8칸 직선'],
      ai: { maxDist: 3.5 },
    },
    {
      id: 'ln_sweep', cls: 'lancer', name: '회오리 창', icon: 'ln_sweep', req: 3, kind: 'self', range: 2.9, elem: 'phys', anim: 'attack',
      mana: (r) => 5 + Math.floor(r * 0.35), cd: () => 0, pct: (r) => 115 + 13 * r,
      desc: '창을 크게 휘둘러 주변의 모든 적을 베고 밀쳐냅니다.',
      detail: (r) => [pct(115 + 13 * r), '반경 2.9칸 · 밀쳐내기'],
      ai: { crowd: 2, maxDist: 2.6 },
    },
    {
      id: 'ln_javelin', cls: 'lancer', name: '번개 투창', icon: 'ln_javelin', req: 6, kind: 'proj', range: 12, elem: 'light', anim: 'attack',
      mana: (r) => 8 + Math.floor(r * 0.4), cd: () => 0, pct: (r) => 150 + 17 * r,
      desc: '번개를 두른 창을 던집니다. 창은 적을 모두 꿰뚫고, 맞은 적마다 주변 적 2명에게 번개가 튑니다.',
      detail: (r) => [`${pct(150 + 17 * r)} (번개) · 관통 · 사거리 12칸`, `튀는 번개 ${pct(Math.round((150 + 17 * r) * 0.45))} × 2명 (반경 4칸)`],
      ai: {},
    },
    {
      id: 'ln_dragon', cls: 'lancer', name: '용의 강하', icon: 'ln_dragon', req: 10, kind: 'move', range: 8, elem: 'light', move: 'leap',
      mana: () => 10, cd: (r) => Math.max(2.5, 5 - 0.2 * r), pct: (r) => 240 + 26 * r,
      timing: { kind: 'leap', dur: 0.7, hitAt: 0.99, invuln: 0.7 },
      desc: '하늘 높이 뛰어올라 목표 지점에 창을 내리꽂습니다. 공중에서는 공격받지 않으며 착지할 때 번개가 터집니다.',
      detail: (r) => [`${pct(240 + 26 * r)} (절반은 번개)`, '반경 2.8칸 · 기절 0.6초 · 최대 8칸', `재사용 ${Math.max(2.5, 5 - 0.2 * r).toFixed(1)}초`],
      ai: { minDist: 3, maxDist: 8 },
    },
    {
      id: 'ln_storm', cls: 'lancer', name: '폭풍 창격', icon: 'ln_storm', req: 15, kind: 'proj', range: 3.4, elem: 'phys', anim: 'attack',
      mana: () => 16, cd: () => 6, pct: (r) => 75 + 8 * r,
      // 9 thrust cycles of the channel animation (7 per second); the wave leaves with the ninth thrust
      timing: { kind: 'channel', dur: 9 / 7, hitAt: 8.5 / 9 },
      desc: '눈에 보이지 않는 속도로 여덟 번 찌른 뒤, 마지막에 앞으로 번개 파동을 내보냅니다.',
      detail: (r) => [`8회 × ${pct(75 + 8 * r)} (전방 부채꼴 3.4칸)`, `마지막 파동 ${pct(150 + 15 * r)} (번개) · 앞으로 6칸 관통`, '재사용 6초'],
      ai: { crowd: 2, boss: true, maxDist: 3 },
    },
  ],
};
