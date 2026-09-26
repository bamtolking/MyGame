import type { ClassId, TalKind } from '../types.ts';

/** How a class's basic attack works (the server combat code switches on this). */
export type AtkKind = 'cone' | 'shot' | 'blast' | 'thrust' | 'chain' | 'bash' | 'stab' | 'musket' | 'wave' | 'ink';
/** Unlock condition: any listed requirement unlocks the class (no requirements = starter class). */
export interface Unlock { lv?: number; bosses?: number; wb?: number; text: string }

export interface ClassDef {
  id: ClassId; name: string; eng: string; desc: string; role: string;
  hp: number; hpLv: number; atk: number; aspd: number; range: number; move: number; crit: number; dr: number;
  heal: number; leech: number; startTal: TalKind; ultName: string; ultDesc: string; color: string;
  /** One hanja shown on the ultimate button and class cards. */
  glyph: string;
  atkKind: AtkKind; melee: boolean; unlock: Unlock;
  /** Bonus critical damage (added to the base ×1.5). */
  critDmg?: number;
  /** While the ultimate is active (ultT > 0): movement multiplier and damage-taken multiplier. */
  ultMove?: number; ultDr?: number;
  /** Seconds the ultimate stays active (0 = instant). */
  ultDur: number;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  sword: {
    id: 'sword', name: '검객', eng: 'Swordsman', role: '근접 · 단단함',
    desc: '갓을 눌러쓴 떠돌이 검객. 가까이 붙은 요괴들을 부채꼴로 한꺼번에 베고, 벤 만큼 체력을 회복합니다.',
    hp: 175, hpLv: 21, atk: 15, aspd: 1.25, range: 96, move: 150, crit: 0.05, dr: 0.14, heal: 1, leech: 0.025,
    startTal: 'blades', ultName: '회오리 베기', ultDesc: '4초간 회전하며 주변의 모든 적을 연속으로 벱니다. 이동 속도 +30%, 받는 피해 -50%.', color: '#5c8dff', glyph: '斬',
    atkKind: 'cone', melee: true, unlock: { text: '처음부터' }, ultMove: 1.3, ultDr: 0.5, ultDur: 4,
  },
  archer: {
    id: 'archer', name: '궁사', eng: 'Archer', role: '원거리 · 치명타',
    desc: '각궁을 든 사냥꾼. 멀리서 가장 가까운 요괴를 빠르게 쏘아 맞힙니다. 치명타가 높습니다.',
    hp: 125, hpLv: 14, atk: 13, aspd: 1.9, range: 400, move: 158, crit: 0.14, dr: 0.04, heal: 1, leech: 0,
    startTal: 'pierce', ultName: '화살비', ultDesc: '요괴가 가장 많이 몰린 곳에 2초 동안 화살비를 퍼붓습니다.', color: '#4cd07d', glyph: '矢',
    atkKind: 'shot', melee: false, unlock: { text: '처음부터' }, ultDur: 0,
  },
  shaman: {
    id: 'shaman', name: '무녀', eng: 'Shaman', role: '범위 · 치유',
    desc: '방울과 부채를 든 무녀. 터지는 부적으로 무리를 태우고, 동료를 치유합니다(치유량 +30%).',
    hp: 135, hpLv: 16, atk: 17, aspd: 1.0, range: 330, move: 150, crit: 0.05, dr: 0.07, heal: 1.3, leech: 0,
    startTal: 'wisp', ultName: '대굿', ultDesc: '주변 적에게 큰 피해를 주고, 주변 동료를 크게 치유하며 쓰러진 동료를 즉시 일으킵니다.', color: '#ff6fa5', glyph: '巫',
    atkKind: 'blast', melee: false, unlock: { lv: 4, text: '레벨 4 달성' }, ultDur: 0,
  },
  spear: {
    id: 'spear', name: '창술사', eng: 'Spearman', role: '중거리 · 관통',
    desc: '청룡 술이 달린 긴 창을 든 무사. 앞으로 길게 찔러 일직선의 요괴를 한 번에 꿰뚫습니다.',
    hp: 160, hpLv: 19, atk: 16, aspd: 1.1, range: 150, move: 150, crit: 0.07, dr: 0.1, heal: 1, leech: 0.012,
    startTal: 'aura', ultName: '백룡창', ultDesc: '3초 동안 가까운 요괴를 향해 창을 쉴 새 없이 내질러 길게 꿰뚫습니다.', color: '#b8e04a', glyph: '槍',
    atkKind: 'thrust', melee: true, unlock: { lv: 8, text: '레벨 8 달성' }, ultDur: 3,
  },
  taoist: {
    id: 'taoist', name: '도사', eng: 'Taoist', role: '원거리 · 연쇄 번개',
    desc: '복숭아나무 법검과 뇌전 부적을 쓰는 도사. 번개가 맞은 요괴에서 옆의 요괴로 두 번 더 튑니다.',
    hp: 120, hpLv: 14, atk: 16, aspd: 1.15, range: 360, move: 152, crit: 0.06, dr: 0.05, heal: 1.1, leech: 0,
    startTal: 'thunder', ultName: '천뢰진', ultDesc: '하늘에서 번개 12줄기를 요괴들에게 내리꽂아 큰 피해를 주고 잠시 묶어 둡니다.', color: '#a47bff', glyph: '雷',
    atkKind: 'chain', melee: false, unlock: { bosses: 1, lv: 10, text: '지역 보스 첫 토벌 (또는 레벨 10)' }, ultDur: 0,
  },
  guardian: {
    id: 'guardian', name: '수문장', eng: 'Gatekeeper', role: '근접 · 방어',
    desc: '투구와 큰 방패를 든 성문지기. 방패로 요괴를 밀쳐 내고, 곁에 선 동료가 받는 피해를 10% 줄여 줍니다.',
    hp: 230, hpLv: 27, atk: 16, aspd: 0.95, range: 90, move: 142, crit: 0.04, dr: 0.22, heal: 1, leech: 0.02,
    startTal: 'guard', ultName: '철벽진', ultDesc: '주변 동료에게 큰 보호막을 씌우고, 주변 요괴를 밀쳐 내며 잠시 기절시킵니다. 5초간 받는 피해 -50%.', color: '#ffd23f', glyph: '盾',
    atkKind: 'bash', melee: true, unlock: { lv: 11, text: '레벨 11 달성' }, ultDr: 0.5, ultDur: 5,
  },
  assassin: {
    id: 'assassin', name: '자객', eng: 'Assassin', role: '근접 · 폭발 딜',
    desc: '복면을 쓰고 비수 두 자루를 든 자객. 아주 빠르게 찌르고, 체력이 30% 아래인 요괴에게는 1.5배 피해를 줍니다.',
    hp: 140, hpLv: 16, atk: 12, aspd: 2.4, range: 80, move: 162, crit: 0.18, dr: 0.08, heal: 1, leech: 0.025,
    startTal: 'blades', ultName: '그림자 난무', ultDesc: '3초간 그림자 분신이 공격마다 주변 요괴 3마리를 함께 베고, 공격 속도 +50%, 이동 속도 +20%.', color: '#2fd4c4', glyph: '影',
    atkKind: 'stab', melee: true, unlock: { lv: 14, text: '레벨 14 달성' }, critDmg: 0.3, ultMove: 1.2, ultDur: 3,
  },
  gunner: {
    id: 'gunner', name: '포수', eng: 'Gunner', role: '원거리 · 관통 포격',
    desc: '조총을 멘 포수. 느리지만 강한 탄환이 일직선의 요괴를 모두 꿰뚫고 끝에서 터집니다.',
    hp: 125, hpLv: 14, atk: 26, aspd: 0.7, range: 430, move: 146, crit: 0.1, dr: 0.04, heal: 1, leech: 0,
    startTal: 'pierce', ultName: '신기전', ultDesc: '신기전 화살 로켓 16발을 요괴 무리에 쏟아부어 곳곳을 폭발시킵니다.', color: '#ff5a36', glyph: '砲',
    atkKind: 'musket', melee: false, unlock: { lv: 17, text: '레벨 17 달성' }, ultDur: 0,
  },
  musician: {
    id: 'musician', name: '악사', eng: 'Musician', role: '범위 · 지원',
    desc: '가야금을 타는 악사. 가락이 부채꼴로 퍼져 요괴를 치고, 곁의 동료 공격 속도를 12% 올려 줍니다(치유량 +25%).',
    hp: 130, hpLv: 15, atk: 14, aspd: 1.3, range: 240, move: 150, crit: 0.05, dr: 0.06, heal: 1.25, leech: 0,
    startTal: 'bell', ultName: '신명풀이', ultDesc: '주변 동료를 25% 치유하고 6초간 공격 속도 +35%, 가락이 네 번 크게 퍼져 요괴를 칩니다.', color: '#ffa640', glyph: '樂',
    atkKind: 'wave', melee: false, unlock: { wb: 1, lv: 20, text: '핏빛 달 월드 보스 참가 (또는 레벨 20)' }, ultDur: 6,
  },
  painter: {
    id: 'painter', name: '화공', eng: 'Ink Painter', role: '범위 · 장판',
    desc: '큰 붓을 든 화공. 먹물을 던져 웅덩이를 만들고, 웅덩이는 잠시 요괴를 태우며 느리게 합니다.',
    hp: 125, hpLv: 14, atk: 15, aspd: 0.9, range: 340, move: 150, crit: 0.06, dr: 0.05, heal: 1.1, leech: 0,
    startTal: 'frost', ultName: '묵호도', ultDesc: '그림 속 먹 호랑이가 뛰쳐나와 요괴 무리를 세 번 가로지르며 크게 할퀴어 찢습니다.', color: '#efe4cf', glyph: '墨',
    atkKind: 'ink', melee: false, unlock: { lv: 24, text: '레벨 24 달성' }, ultDur: 0,
  },
};
/** Display order (also the unlock order). */
export const CLASS_IDS: ClassId[] = ['sword', 'archer', 'shaman', 'taoist', 'spear', 'guardian', 'assassin', 'gunner', 'musician', 'painter'];
export const STARTER_CLASSES: ClassId[] = ['sword', 'archer'];
export const isClassId = (x: unknown): x is ClassId => typeof x === 'string' && (CLASS_IDS as string[]).includes(x);

/** Progress fields an unlock depends on (works for a Profile and for the client's MeState). */
export interface UnlockProgress { level: number; bosses: number; worldBoss: number }
export function classUnlocked(id: ClassId, g: UnlockProgress): boolean {
  const u = CLASSES[id].unlock;
  if (u.lv == null && u.bosses == null && u.wb == null) return true;
  return (u.lv != null && g.level >= u.lv) || (u.bosses != null && g.bosses >= u.bosses) || (u.wb != null && g.worldBoss >= u.wb);
}
export const unlockedClasses = (g: UnlockProgress): ClassId[] => CLASS_IDS.filter(id => classUnlocked(id, g));

export const SHAMAN_AOE = 58;
/** Basic-attack geometry shared by the server simulation and the client visuals. */
export const ATK = {
  thrustW: 24, ultThrustLen: 270, ultThrustW: 32,
  chainR: 140, chainMul: [1, 0.85, 0.7],
  bashHalf: 1.3, bashPush: 28,
  musketW: 16, musketBurst: 44, bulletSpeed: 1700,
  waveHalf: 0.65,
  inkR: 62, inkTicks: 2, inkTickMul: 0.3,
  musicianAura: 260, musicianAspd: 0.12, guardianAura: 200, guardianDr: 0.1,
} as const;
