export interface RelicDef { id: string; name: string; desc: string; icon: string; tags: string[] }
export const RELICS: RelicDef[] = [
  { id: 'cold_conductor', name: '저온 전도체', desc: '감속된 적을 번개로 때리면 전도 연결이 +1 대신 +3.', icon: '❄️', tags: ['rabbit', 'penguin'] },
  { id: 'chain_igniter', name: '연쇄 점화기', desc: '부식된 적에게 폭발을 맞히면 2차 폭발(반경 35, 피해 50%)이 한 번 더 일어난다(재발동 없음).', icon: '🧨', tags: ['raccoon', 'mushroom'] },
  { id: 'lone_scope', name: '외톨이 조준경', desc: '태엽 사수 주변 90 안의 다른 공격 유닛이 적을수록 사거리 증가(+40에서 이웃당 -10).', icon: '🔭', tags: ['archer'] },
  { id: 'overcharger', name: '공방 과급기', desc: '정비사 버프 범위 95→135(대각선 자리까지), 대신 버프량 -5%p.', icon: '⚙️', tags: ['mechanic'] },
  { id: 'magnetic_storm', name: '자성 폭풍', desc: '자석 곰의 끌기 재적용 제한 2초→1.2초, 끌기 반경 +20, 끌린 적에게 +25% 피해.', icon: '🧲', tags: ['bear'] },
  { id: 'guild_seal', name: '상인 길드 인장', desc: '웨이브 보상 +15%, 황금 두꺼비 상한 60→90.', icon: '📜', tags: ['toad'] },
  { id: 'sorting_box', name: '만능 재료함', desc: '합성 시 3개 중 2개가 같은 종류면 그 종류로 확정 승급.', icon: '🧰', tags: [] },
  { id: 'frost_breaker', name: '서리 갑옷 파괴기', desc: '감속된 적은 받는 피해 +12%, 방어력 -0.1.', icon: '🔨', tags: ['penguin'] },
  { id: 'fate_dice', name: '운명의 주사위', desc: '운명 조각 획득 2배, 종류 지정 비용 5→4, 불운 보정 12→10회.', icon: '🎲', tags: [] },
  { id: 'field_manual', name: '긴급 대응 매뉴얼', desc: '수동 스킬 재사용 대기 -30%, 긴급 포격 피해 +40%.', icon: '📕', tags: [] },
];
export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELICS.map(r => [r.id, r]));
