import type { EnemyType } from '../sim/types';

export interface EnemyDef {
  type: EnemyType; name: string; trait: string; hint: string;
  hp: number; speed: number; armor: number; shield?: number; reward: number; exitDmg: number;
  regen?: number;    // fraction of maxHp per second when unhit for 1.5s
  split?: EnemyType; // spawns 2 of this on death
  caster?: boolean;
  boss?: boolean;
  r: number;         // draw radius
  color: string;
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  wisp: { type: 'wisp', name: '도깨비불', trait: '기본형', hint: '표준 적. 어떤 공격에도 잘 죽습니다.', hp: 40, speed: 40, armor: 0, reward: 2, exitDmg: 1, r: 9, color: '#80deea' },
  fox: { type: 'fox', name: '그림자 여우', trait: '빠른 돌진형', hint: '빠릅니다. 얼음 펭귄으로 늦추거나 긴 직선 구간에서 잡으세요.', hp: 30, speed: 78, armor: 0, reward: 2, exitDmg: 1, r: 8, color: '#7e57c2' },
  tortoise: { type: 'tortoise', name: '갑옷 거북', trait: '장갑형', hint: '방어력 50%. 산성 버섯의 부식으로 방어력을 깎으세요.', hp: 95, speed: 30, armor: 0.5, reward: 4, exitDmg: 1, r: 11, color: '#8d6e63' },
  troll: { type: 'troll', name: '이끼 트롤', trait: '재생형', hint: '맞지 않으면 체력을 회복합니다. 지속 피해나 집중 공격으로 끊으세요.', hp: 85, speed: 35, armor: 0, reward: 4, exitDmg: 1, regen: 0.04, r: 11, color: '#66bb6a' },
  slime: { type: 'slime', name: '물방울 슬라임', trait: '분열형', hint: '죽으면 둘로 나뉩니다(보상 없음). 범위 공격으로 한 번에 정리하세요.', hp: 60, speed: 40, armor: 0, reward: 4, exitDmg: 1, split: 'slimelet', r: 10, color: '#29b6f6' },
  slimelet: { type: 'slimelet', name: '작은 슬라임', trait: '분열체', hint: '', hp: 22, speed: 52, armor: 0, reward: 0, exitDmg: 1, r: 6, color: '#4fc3f7' },
  ghost: { type: 'ghost', name: '부적 요괴', trait: '보호막형', hint: '보호막이 먼저 깎입니다. 보호막이 있는 동안 감속이 절반만 걸립니다.', hp: 50, speed: 38, armor: 0, shield: 45, reward: 4, exitDmg: 1, r: 10, color: '#f8bbd0' },
  caster: { type: 'caster', name: '무당 모기', trait: '지원 시전자', hint: '주변 적을 치료하고 가속합니다. 먼저 처치하세요.', hp: 55, speed: 34, armor: 0, reward: 5, exitDmg: 1, caster: true, r: 9, color: '#ce93d8' },
  ogre: { type: 'ogre', name: '뿔 도깨비', trait: '정예형', hint: '체력과 방어력이 높고 통과 시 생명 2. 부식+집중 공격.', hp: 210, speed: 32, armor: 0.25, reward: 12, exitDmg: 2, r: 13, color: '#ef5350' },
  courier: { type: 'courier', name: '보물 운반꾼', trait: '돌발: 보물', hint: '빠르게 지나갑니다. 잡으면 큰 보상. 놓쳐도 생명은 줄지 않습니다.', hp: 120, speed: 95, armor: 0.1, reward: 45, exitDmg: 0, r: 9, color: '#ffd54f' },
  boss_flag: { type: 'boss_flag', name: '깃발왕', trait: '10웨이브 보스', hint: '호위가 살아있는 동안 피해 40% 감소. 호위를 모두 처치하면 8초간 약화(+35% 피해).', hp: 1500, speed: 22, armor: 0.1, reward: 90, exitDmg: 5, boss: true, r: 18, color: '#ff5252' },
  boss_cart: { type: 'boss_cart', name: '장갑수레', trait: '20웨이브 보스', hint: '방어 자세(방어 80%) 4초 ↔ 취약 자세(방어 0%, +25% 피해) 3초. 부식은 자세와 무관하게 방어력을 깎습니다.', hp: 3400, speed: 20, armor: 0.3, reward: 150, exitDmg: 6, boss: true, r: 20, color: '#8d6e63' },
  boss_thief: { type: 'boss_thief', name: '시간도둑', trait: '30웨이브 보스', hint: '9초마다 배치 지점 3곳에 봉인 예고(2초) 후 4초간 공격 봉인. 예고된 자리의 유닛을 옮기세요.', hp: 5600, speed: 25, armor: 0.2, reward: 220, exitDmg: 8, boss: true, r: 18, color: '#7c4dff' },
  boss_king: { type: 'boss_king', name: '탐욕의 수집왕', trait: '40웨이브 최종 보스', hint: '체력 구간마다 패턴 변화: 호위 소환 → 자세 전환 → 봉인+돌진. 통과하면 즉시 패배. 반드시 처치하세요.', hp: 9500, speed: 20, armor: 0.3, reward: 400, exitDmg: 20, boss: true, r: 22, color: '#ffab00' },
};
export const ENEMY_INTRO_ORDER: EnemyType[] = ['wisp', 'fox', 'tortoise', 'troll', 'slime', 'ghost', 'caster', 'ogre'];
