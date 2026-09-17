import type { UnitDef, FactionId, FactionDef } from '../types.ts';

const U = (d: UnitDef) => d;

export const UNIT_DEFS: Record<string, UnitDef> = {
  // ───────────────────────── 철갑연맹 IRON LEAGUE ─────────────────────────
  shieldwalker: U({
    id: 'shieldwalker', faction: 'iron', name: '방패보행기', short: '방패', cost: 90, pop: 2, tier: 1,
    hp: 400, armor: 3, speed: 62, radius: 13, layer: 'ground',
    armorTags: ['armored', 'mechanical'], roles: ['tank'], behavior: 'assault',
    weapon: { kind: 'hitscan', targets: 'ground', dmg: 9, cycle: 1.2, windup: 0.2, recover: 0.2, range: 22 },
    strengths: '집중 화력을 받아내는 전방 방패. 소총·소형 공격에 강함',
    weaknesses: '공격력 낮음, 대장갑 병종에 취약, 공중 공격 불가',
    desc: '전열을 유지하는 중장갑 보행 병기.',
  }),
  rifles: U({
    id: 'rifles', faction: 'iron', name: '자동소총대', short: '소총', cost: 60, pop: 1, tier: 1,
    hp: 105, armor: 0, speed: 82, radius: 9, layer: 'ground',
    armorTags: ['light', 'biological'], roles: ['ranged'], behavior: 'ranged',
    weapon: { kind: 'hitscan', targets: 'both', dmg: 6, cycle: 1.0, windup: 0.1, recover: 0.1, range: 150, burst: 3, burstGap: 0.08 },
    strengths: '저렴한 대공 겸용 화력. 보호받으면 효율적',
    weaknesses: '광역 공격과 중장갑에 약함',
    desc: '3인 1조 자동소총 분대.',
  }),
  sprayer: U({
    id: 'sprayer', faction: 'iron', name: '충격분사차', short: '분사', cost: 120, pop: 2, tier: 1,
    hp: 270, armor: 2, speed: 70, radius: 12, layer: 'ground',
    armorTags: ['medium', 'mechanical'], roles: ['aoe'], behavior: 'assault',
    weapon: { kind: 'cone', targets: 'ground', dmg: 14, cycle: 1.0, windup: 0.25, recover: 0.15, range: 75, coneHalf: 0.6, bonus: { light: 1.3, armored: 0.6 } },
    strengths: '밀집한 소형 지상 병력에 부채꼴 광역 피해',
    weaknesses: '짧은 사거리, 장거리 공격과 공중에 무력',
    desc: '전방 부채꼴 충격파 분사 차량.',
  }),
  piercer: U({
    id: 'piercer', faction: 'iron', name: '관통포차', short: '관통', cost: 180, pop: 2, tier: 2,
    hp: 300, armor: 3, speed: 55, radius: 13, layer: 'ground',
    armorTags: ['armored', 'mechanical'], roles: ['antiarmor'], behavior: 'ranged',
    weapon: { kind: 'projectile', targets: 'ground', dmg: 75, cycle: 2.6, windup: 0.5, recover: 0.3, range: 190, projSpeed: 520, bonus: { armored: 2.0, structure: 1.4, light: 0.65 } },
    strengths: '중장갑·건물 상대 단일 고화력',
    weaknesses: '느린 공격 주기, 다수 저가 병력에 포위되면 비효율, 공중 불가',
    desc: '관통탄을 쏘는 저속 자주포.',
  }),
  flak: U({
    id: 'flak', faction: 'iron', name: '요격포대', short: '요격', cost: 110, pop: 2, tier: 1,
    hp: 240, armor: 2, speed: 60, radius: 12, layer: 'ground',
    armorTags: ['medium', 'mechanical'], roles: ['antiair'], behavior: 'ranged',
    weapon: { kind: 'projectile', targets: 'both', dmg: 20, cycle: 0.9, windup: 0.1, recover: 0.1, range: 225, projSpeed: 700, burst: 2, burstGap: 0.1, vsAir: 1.0, vsGround: 0.25, preferAir: true },
    strengths: '공중 병력 전문 요격',
    weaknesses: '지상 공격 효율 매우 낮음',
    desc: '쌍열 대공 요격 포대.',
  }),
  repair: U({
    id: 'repair', faction: 'iron', name: '야전수리기', short: '수리', cost: 150, pop: 1, tier: 2,
    hp: 140, armor: 1, speed: 78, radius: 9, layer: 'ground',
    armorTags: ['light', 'mechanical'], roles: ['support'], behavior: 'support',
    ability: { kind: 'repair', amount: 10, range: 95, pool: 600, stackCap: 2 },
    strengths: '주변 기계 병력 수리 (생명당 총 600), 최대 2대 중첩',
    weaknesses: '공격 불가, 체력 낮음, 수리 잔량 소진 시 무력',
    desc: '호버 수리 드론.',
  }),
  howitzer: U({
    id: 'howitzer', faction: 'iron', name: '장거리곡사포', short: '곡사', cost: 220, pop: 3, tier: 2,
    hp: 210, armor: 1, speed: 46, radius: 14, layer: 'ground',
    armorTags: ['light', 'mechanical'], roles: ['artillery', 'aoe'], behavior: 'artillery',
    weapon: { kind: 'arc', targets: 'ground', dmg: 58, cycle: 3.6, windup: 1.0, recover: 0.4, range: 330, minRange: 110, aoe: 48, projSpeed: 300, bonus: { light: 1.15, structure: 1.2 } },
    strengths: '후방에서 지상 광역 포격',
    weaknesses: '최소 사거리, 긴 준비 시간, 근접·측면 공격에 취약',
    desc: '장거리 곡사 포격 차량.',
  }),
  gunship: U({
    id: 'gunship', faction: 'iron', name: '중장갑비행정', short: '비행정', cost: 380, pop: 4, tier: 3,
    hp: 680, armor: 3, speed: 88, radius: 16, layer: 'air',
    armorTags: ['armored', 'mechanical'], roles: ['air', 'ranged'], behavior: 'ranged',
    weapon: { kind: 'projectile', targets: 'both', dmg: 28, cycle: 0.8, windup: 0.1, recover: 0.1, range: 145, projSpeed: 600 },
    strengths: '고체력 공중 압박, 지상·공중 모두 공격',
    weaknesses: '전문 대공에 명확히 취약, 비쌈',
    desc: '중장갑 강습 비행정.',
  }),

  // ───────────────────────── 질풍길드 GALE GUILD ─────────────────────────
  raiders: U({
    id: 'raiders', faction: 'gale', name: '경량돌격대', short: '돌격', cost: 50, pop: 1, tier: 1,
    hp: 130, armor: 0, speed: 132, radius: 9, layer: 'ground',
    armorTags: ['light', 'biological'], roles: ['tank'], behavior: 'assault',
    weapon: { kind: 'hitscan', targets: 'ground', dmg: 13, cycle: 0.7, windup: 0.1, recover: 0.1, range: 18 },
    strengths: '저렴하고 빠름. 느린 단일 고화력 공격을 낭비시킴',
    weaknesses: '광역 공격에 취약, 공중 공격 불가',
    desc: '경량 돌격 3인조.',
  }),
  glider: U({
    id: 'glider', faction: 'gale', name: '활공사수', short: '사수', cost: 65, pop: 1, tier: 1,
    hp: 105, armor: 0, speed: 112, radius: 9, layer: 'ground',
    armorTags: ['light', 'biological'], roles: ['ranged'], behavior: 'ranged', kite: true,
    weapon: { kind: 'hitscan', targets: 'both', dmg: 17, cycle: 0.9, windup: 0.1, recover: 0.1, range: 165 },
    strengths: '기동성 높은 원거리 화력, 대공 가능. 근접 병력에게서 거리를 벌리며 사격(치고 빠지기)',
    weaknesses: '전열이 무너지면 생존력 낮음',
    desc: '활공 날개를 단 사수.',
  }),
  thrower: U({
    id: 'thrower', faction: 'gale', name: '충격투척병', short: '투척', cost: 110, pop: 2, tier: 1,
    hp: 200, armor: 1, speed: 96, radius: 10, layer: 'ground',
    armorTags: ['light', 'biological'], roles: ['aoe'], behavior: 'ranged', kite: true,
    weapon: { kind: 'arc', targets: 'ground', dmg: 28, cycle: 1.6, windup: 0.3, recover: 0.2, range: 165, aoe: 42, projSpeed: 280, bonus: { light: 1.5, armored: 0.65 } },
    strengths: '소형 밀집 지상 병력에 광역 피해',
    weaknesses: '중장갑 단일 목표 효율 낮음, 공중 불가',
    desc: '충격 수류탄 투척병.',
  }),
  infiltrator: U({
    id: 'infiltrator', faction: 'gale', name: '측면침투기', short: '침투', cost: 160, pop: 2, tier: 2,
    hp: 210, armor: 1, speed: 150, radius: 10, layer: 'ground',
    armorTags: ['light', 'mechanical'], roles: ['flanker', 'antiarmor'], behavior: 'flank',
    weapon: { kind: 'hitscan', targets: 'ground', dmg: 32, cycle: 0.9, windup: 0.15, recover: 0.15, range: 20, bonus: { armored: 1.5 } },
    strengths: '측면 경로로 우회해 적 후방 포병·지원 병력을 노림. 중장갑에 추가 피해',
    weaknesses: '측면 경계 병력과 광역 공격에 취약',
    desc: '경량 고속 침투 차량.',
  }),
  interceptor: U({
    id: 'interceptor', faction: 'gale', name: '요격날개', short: '요격', cost: 120, pop: 2, tier: 1,
    hp: 175, armor: 1, speed: 145, radius: 11, layer: 'air',
    armorTags: ['light', 'mechanical'], roles: ['antiair', 'air'], behavior: 'interceptor',
    weapon: { kind: 'projectile', targets: 'both', dmg: 18, cycle: 0.8, windup: 0.1, recover: 0.1, range: 180, projSpeed: 750, burst: 2, burstGap: 0.1, vsAir: 1.0, vsGround: 0.25, preferAir: true },
    strengths: '적 항공 병력 전문 공중 요격',
    weaknesses: '지상·건물 공격 약함',
    desc: '고속 요격 비행체.',
  }),
  shieldskiff: U({
    id: 'shieldskiff', faction: 'gale', name: '보호막지원정', short: '보호막', cost: 170, pop: 2, tier: 2,
    hp: 200, armor: 1, speed: 98, radius: 11, layer: 'ground',
    armorTags: ['light', 'mechanical'], roles: ['support'], behavior: 'support',
    ability: { kind: 'shield', amount: 70, range: 110, pool: 700, interval: 5, maxTargets: 4, duration: 7 },
    strengths: '주변 아군에 임시 보호막 (생명당 총 700, 중첩 불가)',
    weaknesses: '공격 불가, 체력 낮음',
    desc: '보호막 발생기를 실은 호버 지원정.',
  }),
  bomber: U({
    id: 'bomber', faction: 'gale', name: '폭격활공기', short: '폭격', cost: 240, pop: 3, tier: 2,
    hp: 270, armor: 1, speed: 118, radius: 14, layer: 'air',
    armorTags: ['light', 'mechanical'], roles: ['air', 'aoe'], behavior: 'bomber',
    weapon: { kind: 'bomb', targets: 'ground', dmg: 44, cycle: 2.8, windup: 0.2, recover: 0.3, range: 60, aoe: 52, bonus: { light: 1.3 } },
    strengths: '지상 밀집 병력에 공중 광역 폭격',
    weaknesses: '대공 병력과 분산 배치에 약함, 공중 공격 불가',
    desc: '폭탄을 투하하는 활공 폭격기.',
  }),
  railgun: U({
    id: 'railgun', faction: 'gale', name: '이동레일포', short: '레일', cost: 400, pop: 4, tier: 3,
    hp: 290, armor: 1, speed: 72, radius: 14, layer: 'ground',
    armorTags: ['light', 'mechanical'], roles: ['antiarmor', 'artillery'], behavior: 'artillery',
    weapon: { kind: 'beam', targets: 'ground', dmg: 165, cycle: 3.2, windup: 0.8, recover: 0.4, range: 270, minRange: 60, pierce: 2, pierceFrac: 0.5, bonus: { armored: 2.0, structure: 1.5, light: 0.6 } },
    strengths: '중장갑·건물 상대 관통 고화력',
    weaknesses: '낮은 생존력, 느린 공격 주기, 공중 불가',
    desc: '전자기 레일포를 실은 이동 포대.',
  }),
};

export const FACTIONS: Record<FactionId, FactionDef> = {
  iron: {
    id: 'iron', name: '철갑연맹', tagline: '중장갑 · 정면 화력 · 수리',
    desc: '안정적인 전열과 정면 화력, 수리와 공성에 강하다. 느린 이동과 측면 대응이 약점.',
    units: ['shieldwalker', 'rifles', 'sprayer', 'flak', 'piercer', 'repair', 'howitzer', 'gunship'],
  },
  gale: {
    id: 'gale', name: '질풍길드', tagline: '기동 · 측면 압박 · 분산',
    desc: '빠른 이동, 측면 압박, 분산 전개, 기동 화력에 강하다. 정면 유지력과 장기 소모전이 약점.',
    units: ['raiders', 'glider', 'thrower', 'interceptor', 'infiltrator', 'shieldskiff', 'bomber', 'railgun'],
  },
};

export const UNIT_LIST: UnitDef[] = Object.values(UNIT_DEFS);
export function unitDef(id: string): UnitDef {
  const d = UNIT_DEFS[id];
  if (!d) throw new Error('unknown unit ' + id);
  return d;
}
