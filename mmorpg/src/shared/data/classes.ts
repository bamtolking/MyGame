import type { ClassId, TalKind } from '../types.ts';

export interface ClassDef {
  id: ClassId; name: string; eng: string; desc: string; role: string;
  hp: number; hpLv: number; atk: number; aspd: number; range: number; move: number; crit: number; dr: number;
  heal: number; leech: number; startTal: TalKind; ultName: string; ultDesc: string; color: string;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  sword: {
    id: 'sword', name: '검객', eng: 'Swordsman', role: '근접 · 단단함',
    desc: '갓을 눌러쓴 떠돌이 검객. 가까이 붙은 요괴들을 부채꼴로 한꺼번에 베고, 벤 만큼 체력을 회복합니다.',
    hp: 175, hpLv: 21, atk: 15, aspd: 1.25, range: 96, move: 150, crit: 0.05, dr: 0.14, heal: 1, leech: 0.025,
    startTal: 'blades', ultName: '회오리 베기', ultDesc: '4초간 회전하며 주변의 모든 적을 연속으로 벱니다. 이동 속도 +30%, 받는 피해 -50%.', color: '#5c8dff',
  },
  archer: {
    id: 'archer', name: '궁사', eng: 'Archer', role: '원거리 · 치명타',
    desc: '각궁을 든 사냥꾼. 멀리서 가장 가까운 요괴를 빠르게 쏘아 맞힙니다. 치명타가 높습니다.',
    hp: 125, hpLv: 14, atk: 13, aspd: 1.9, range: 400, move: 158, crit: 0.14, dr: 0.04, heal: 1, leech: 0,
    startTal: 'pierce', ultName: '화살비', ultDesc: '요괴가 가장 많이 몰린 곳에 2초 동안 화살비를 퍼붓습니다.', color: '#4cd07d',
  },
  shaman: {
    id: 'shaman', name: '무녀', eng: 'Shaman', role: '범위 · 치유',
    desc: '방울과 부채를 든 무녀. 터지는 부적으로 무리를 태우고, 동료를 치유합니다(치유량 +30%).',
    hp: 135, hpLv: 16, atk: 17, aspd: 1.0, range: 330, move: 150, crit: 0.05, dr: 0.07, heal: 1.3, leech: 0,
    startTal: 'wisp', ultName: '대굿', ultDesc: '주변 적에게 큰 피해를 주고, 주변 동료를 크게 치유하며 쓰러진 동료를 즉시 일으킵니다.', color: '#ff6fa5',
  },
};
export const CLASS_IDS: ClassId[] = ['sword', 'archer', 'shaman'];
export const SHAMAN_AOE = 58;
