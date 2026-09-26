// 수도승 — lightning-fast martial artist with fist weapons. Unlocked by defeating Malegath (normal clear).
import type { ClassPack } from '../../data/classes';

const pct = (v: number) => `무기 피해의 ${Math.round(v)}%`;

export const MONK: ClassPack = {
  def: {
    id: 'monk', name: '수도승', title: '천 개의 주먹',
    desc: '맨주먹과 권갑으로 눈에 보이지 않을 만큼 빠르게 연타합니다. 기공파로 멀리 있는 적도 치고, 칠성권으로 순식간에 무리를 쓸어냅니다.',
    attrs: { str: 20, dex: 30, vit: 20, ene: 10 }, main: 'dex',
    hpBase: 42, hpLvl: 3.4, hpVit: 2.3, mpBase: 14, mpLvl: 1.4, mpEne: 1.4,
    color: '#7a3a12', accent: '#ffc070',
    autoAttr: { str: 0, dex: 3, vit: 2, ene: 0 },
    startGear: ['wraps', 'quilted'],
    skills: ['mk_combo', 'mk_wave', 'mk_mantra', 'mk_kick', 'mk_seven'],
    basic: 'mk_palm',
    unlock: { boss: 'malegath', text: '심연의 군주 말레가스 처치 (보통 난이도 클리어)' },
    ranged: false, spell: false, critPerDex: 0.02, reach: 0, reach2h: 0, offhandHint: '',
  },
  skills: [
    {
      id: 'mk_palm', cls: 'monk', name: '장타', icon: 'mk_palm', req: 1, kind: 'melee', range: 1.1, elem: 'phys',
      mana: () => 0, cd: () => 0, pct: () => 100,
      desc: '손바닥으로 강하게 칩니다.', detail: () => [pct(100)],
    },
    {
      id: 'mk_combo', cls: 'monk', name: '연환권', icon: 'mk_combo', req: 1, kind: 'melee', range: 1.1, elem: 'phys',
      mana: (r) => 2 + Math.floor(r * 0.25), cd: () => 0, pct: (r) => 50 + 5 * r,
      timing: { dur: 1.4, rel: true, hitAt: 0.99 },
      desc: '세 번 이어 치는 연속 권법. 마지막 일격은 적을 밀쳐내고 잠시 기절시킵니다.',
      detail: (r) => [`3회 × ${pct(50 + 5 * r)}`, '마지막 타격: 밀쳐내기 · 기절 0.4초'],
      ai: { maxDist: 1.8 },
    },
    {
      id: 'mk_wave', cls: 'monk', name: '기공파', icon: 'mk_wave', req: 3, kind: 'proj', range: 9, elem: 'phys', anim: 'attack',
      mana: (r) => 5 + Math.floor(r * 0.35), cd: () => 0, pct: (r) => 120 + 14 * r,
      desc: '기를 모아 넓은 파동을 내뿜습니다. 파동은 모든 적을 뚫고 나아갑니다.',
      detail: (r) => [`${pct(120 + 14 * r)} · 모두 관통`],
      ai: { crowd: 2 },
    },
    {
      id: 'mk_mantra', cls: 'monk', name: '진언', icon: 'mk_mantra', req: 6, kind: 'self', range: 0, elem: 'phys', anim: 'cast',
      mana: () => 10, cd: () => 20, pct: (r) => 25 + 2 * r,
      timing: { dur: 0.5, hitAt: 0.5 },
      desc: '진언을 외워 12초간 몸을 가볍게 합니다. 공격 속도와 이동 속도가 오르고 공격을 흘려냅니다.',
      detail: (r) => [`공격 속도 +${25 + 2 * r}% · 이동 속도 +20%`, '회피 15% (12초)', '재사용 20초'],
      ai: { buff: true, crowd: 1 },
    },
    {
      id: 'mk_kick', cls: 'monk', name: '비연각', icon: 'mk_kick', req: 10, kind: 'move', range: 6, elem: 'phys', move: 'dash',
      mana: () => 7, cd: (r) => Math.max(1.5, 3.5 - 0.2 * r), pct: (r) => 160 + 18 * r,
      timing: { kind: 'dash', dur: 0.3, hitAt: 0.99, invuln: 0.3 },
      desc: '제비처럼 날아 차며 지나가는 길의 모든 적을 걷어찹니다.',
      detail: (r) => [`${pct(160 + 18 * r)} · 경로 위 모든 적`, '최대 6칸 · 밀쳐내기', `재사용 ${Math.max(1.5, 3.5 - 0.2 * r).toFixed(1)}초`],
      ai: { minDist: 2, maxDist: 6 },
    },
    {
      id: 'mk_seven', cls: 'monk', name: '칠성권', icon: 'mk_seven', req: 15, kind: 'target', range: 8, elem: 'phys',
      mana: () => 18, cd: () => 7, pct: (r) => 200 + 22 * r,
      timing: { kind: 'channel', dur: 0.95, hitAt: 0.99, invuln: 1 },
      desc: '모습을 감추고 목표 주변의 적 최대 일곱 명 사이를 번개처럼 오가며 한 방씩 꽂습니다. 그동안 공격받지 않습니다.',
      detail: (r) => [`최대 7회 × ${pct(200 + 22 * r)}`, '목표 반경 5칸', '재사용 7초'],
      ai: { crowd: 3, boss: true },
    },
  ],
};
