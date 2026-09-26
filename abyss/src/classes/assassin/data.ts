// 암살자 — fast claw fighter with poison, throwing knives and blade sentries. Unlocked at hero level 10.
import type { ClassPack } from '../../data/classes';

const pct = (v: number) => `무기 피해의 ${Math.round(v)}%`;

export const ASSASSIN: ClassPack = {
  def: {
    id: 'assassin', name: '암살자', title: '그림자 칼날',
    desc: '발톱 무기로 눈에 띄지 않게 파고들어 독과 치명타로 적을 쓰러뜨립니다. 표창과 칼날 파수꾼으로 무리도 상대합니다.',
    attrs: { str: 20, dex: 30, vit: 20, ene: 10 }, main: 'dex',
    hpBase: 40, hpLvl: 3.2, hpVit: 2.2, mpBase: 12, mpLvl: 1.3, mpEne: 1.3,
    color: '#3a2a4e', accent: '#c890ff',
    autoAttr: { str: 0, dex: 3, vit: 2, ene: 0 },
    startGear: ['katar', 'knifePouch', 'leatherCap'],
    skills: ['as_venom', 'as_knives', 'as_smoke', 'as_shadow', 'as_sentry'],
    basic: 'as_slash',
    unlock: { level: 10, text: '영웅 레벨 10 달성' },
    ranged: false, spell: false, critPerDex: 0.04, reach: 0, reach2h: 0, offhandHint: 'venomPouch',
  },
  skills: [
    {
      id: 'as_slash', cls: 'assassin', name: '쌍날 베기', icon: 'as_slash', req: 1, kind: 'melee', range: 1.1, elem: 'phys',
      mana: () => 0, cd: () => 0, pct: () => 100,
      desc: '발톱으로 빠르게 할퀴어 벱니다.', detail: () => [pct(100)],
    },
    {
      id: 'as_venom', cls: 'assassin', name: '맹독 일격', icon: 'as_venom', req: 1, kind: 'melee', range: 1.1, elem: 'poison',
      mana: (r) => 3 + Math.floor(r * 0.3), cd: () => 0, pct: (r) => 80 + 8 * r,
      desc: '독을 바른 발톱으로 찔러 3초 동안 강한 독 피해를 입힙니다.',
      detail: (r) => [pct(80 + 8 * r), `독: ${pct(150 + 18 * r)} (3초간)`],
      ai: { maxDist: 1.8 },
    },
    {
      id: 'as_knives', cls: 'assassin', name: '표창 난사', icon: 'as_knives', req: 3, kind: 'proj', range: 10, elem: 'phys',
      mana: (r) => 5 + Math.floor(r * 0.35), cd: () => 0, pct: (r) => 55 + 6 * r,
      desc: '부채꼴로 표창을 던집니다. 표창은 적 하나를 꿰뚫고 날아갑니다.',
      detail: (r) => [`표창 ${r >= 7 ? 7 : 5}개 × ${pct(55 + 6 * r)}`, '관통 1'],
      ai: { crowd: 2 },
    },
    {
      id: 'as_smoke', cls: 'assassin', name: '연막탄', icon: 'as_smoke', req: 6, kind: 'self', range: 3.5, elem: 'phys', anim: 'cast',
      mana: () => 9, cd: () => 14, pct: (r) => 40 + 2 * r,
      timing: { dur: 0.4, hitAt: 0.5 },
      desc: '연막을 터뜨려 6초간 안의 적을 둔화시키고, 그동안 공격을 회피할 확률이 생깁니다.',
      detail: (r) => [`회피 ${Math.min(70, 40 + 2 * r)}% (6초)`, '반경 3.5칸 · 적 둔화', '재사용 14초'],
      ai: { crowd: 3, lowHp: 0.6 },
    },
    {
      id: 'as_shadow', cls: 'assassin', name: '그림자 걸음', icon: 'as_shadow', req: 10, kind: 'move', range: 8, elem: 'phys', move: 'behind',
      mana: () => 7, cd: (r) => Math.max(1.5, 4 - 0.2 * r), pct: (r) => 220 + 25 * r,
      timing: { dur: 0.3, hitAt: 0.45, invuln: 0.3 },
      desc: '대상의 등 뒤로 순간이동해 반드시 치명타가 되는 일격을 꽂습니다.',
      detail: (r) => [`${pct(220 + 25 * r)} · 항상 치명타`, '최대 8칸', `재사용 ${Math.max(1.5, 4 - 0.2 * r).toFixed(1)}초`],
      ai: { minDist: 2.5, maxDist: 8 },
    },
    {
      id: 'as_sentry', cls: 'assassin', name: '칼날 파수꾼', icon: 'as_sentry', req: 15, kind: 'target', range: 7, elem: 'phys', anim: 'cast',
      mana: () => 18, cd: () => 3, pct: (r) => 60 + 6 * r,
      timing: { dur: 0.45, hitAt: 0.5 },
      desc: '칼날 파수꾼을 설치합니다. 8초 동안 가장 가까운 적에게 칼날을 연사합니다. 최대 3개.',
      detail: (r) => [`0.3초마다 ${pct(60 + 6 * r)}`, '지속 8초 · 사거리 7칸 · 최대 3개', '재사용 3초'],
      ai: { crowd: 3, boss: true },
    },
  ],
};
