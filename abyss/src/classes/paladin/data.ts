// 성기사 — holy warrior with mace and shield. Unlocked by defeating Ordes (floor 3 boss).
import type { ClassPack } from '../../data/classes';

const pct = (v: number) => `무기 피해의 ${Math.round(v)}%`;

export const PALADIN: ClassPack = {
  def: {
    id: 'paladin', name: '성기사', title: '빛의 서약자',
    desc: '방패와 둔기를 든 신성한 전사. 연속 공격과 빛의 망치로 적을 두들기고, 오라로 스스로를 지킵니다.',
    attrs: { str: 25, dex: 15, vit: 25, ene: 15 }, main: 'str',
    hpBase: 46, hpLvl: 4, hpVit: 2.4, mpBase: 14, mpLvl: 1.3, mpEne: 1.4,
    color: '#8a6a1e', accent: '#ffe29a',
    autoAttr: { str: 2, dex: 0, vit: 2, ene: 1 },
    startGear: ['club', 'buckler', 'quilted'],
    skills: ['pl_zeal', 'pl_hammer', 'pl_aura', 'pl_charge', 'pl_judgment'],
    basic: 'pl_strike',
    unlock: { boss: 'ordes', text: '망자의 주교 오르데스(3층 보스) 처치' },
    ranged: false, spell: false, critPerDex: 0, reach: 0, reach2h: 0.3, offhandHint: 'kite',
  },
  skills: [
    {
      id: 'pl_strike', cls: 'paladin', name: '심판의 일격', icon: 'pl_strike', req: 1, kind: 'melee', range: 1.2, elem: 'phys',
      mana: () => 0, cd: () => 0, pct: () => 100,
      desc: '둔기로 적을 내리칩니다.', detail: () => [pct(100)],
    },
    {
      id: 'pl_zeal', cls: 'paladin', name: '열성', icon: 'pl_zeal', req: 1, kind: 'melee', range: 1.2, elem: 'phys',
      mana: (r) => 2 + Math.floor(r * 0.25), cd: () => 0, pct: (r) => 55 + 6 * r,
      timing: { dur: 1.5, rel: true, hitAt: 0.99 },
      desc: '빠르게 세 번 연달아 내리칩니다. 주변 적에게 번갈아 휘두릅니다.',
      detail: (r) => [`3회 × ${pct(55 + 6 * r)}`],
      ai: { maxDist: 1.8 },
    },
    {
      id: 'pl_hammer', cls: 'paladin', name: '축복의 망치', icon: 'pl_hammer', req: 3, kind: 'proj', range: 5, elem: 'light', anim: 'cast',
      mana: (r) => 5 + Math.floor(r * 0.4), cd: () => 0, pct: (r) => 90 + 11 * r,
      desc: '빛나는 망치가 성기사 주위를 나선형으로 돌며 퍼져 나가, 닿는 적을 여러 번 때립니다.',
      detail: (r) => [`${pct(90 + 11 * r)} (번개) · 적마다 여러 번 적중`, '나선 반경 약 4칸'],
      ai: { crowd: 2, maxDist: 4 },
    },
    {
      id: 'pl_aura', cls: 'paladin', name: '신성한 오라', icon: 'pl_aura', req: 6, kind: 'self', range: 2.6, elem: 'fire', anim: 'cast',
      mana: () => 10, cd: () => 20, pct: (r) => 25 + 3 * r,
      timing: { dur: 0.5, hitAt: 0.5 },
      desc: '15초간 빛의 오라를 두릅니다. 방어력과 저항, 생명력 재생이 오르고 가까운 적을 태웁니다.',
      detail: (r) => [`방어력 +${30 + 3 * r}% · 모든 저항 +10% · 생명력 재생 +${(1 + 0.3 * r).toFixed(1)}/초`, `반경 2.6칸 안의 적에게 0.6초마다 ${pct(25 + 3 * r)} (화염)`, '재사용 20초'],
      ai: { buff: true, crowd: 1 },
    },
    {
      id: 'pl_charge', cls: 'paladin', name: '돌진', icon: 'pl_charge', req: 10, kind: 'move', range: 7, elem: 'phys', move: 'dash',
      mana: () => 8, cd: (r) => Math.max(2, 4 - 0.15 * r), pct: (r) => 180 + 20 * r,
      // 'skill' (not 'dash'): sim.ts moves the hero itself, so the knight stays solid instead of the ghostly dash look
      timing: { kind: 'skill', dur: 0.32, hitAt: 0.99, invuln: 0.3 },
      desc: '방패를 앞세워 돌진하며 부딪히는 적을 밀쳐내고 기절시킵니다.',
      detail: (r) => [pct(180 + 20 * r), '기절 0.8초 · 최대 7칸', `재사용 ${Math.max(2, 4 - 0.15 * r).toFixed(1)}초`],
      ai: { minDist: 3, maxDist: 7 },
    },
    {
      id: 'pl_judgment', cls: 'paladin', name: '천상의 심판', icon: 'pl_judgment', req: 15, kind: 'target', range: 10, elem: 'light', anim: 'cast',
      mana: () => 20, cd: () => 6, pct: (r) => 160 + 18 * r,
      timing: { dur: 0.6, hitAt: 0.5 },
      desc: '하늘에서 빛의 기둥 일곱 개가 차례로 내려와 목표 지역의 적을 심판합니다.',
      detail: (r) => [`7회 × ${pct(160 + 18 * r)} (번개)`, '반경 3칸 · 1.4초간', '재사용 6초'],
      ai: { crowd: 3, boss: true },
    },
  ],
};
