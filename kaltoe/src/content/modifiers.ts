// ─────────────────────────────────────────────────────────────────────────────
// 오늘의 업무(일일 도전) 규칙 변경. 날짜 시드로 1개(또는 2개)를 골라 스테이지·캐릭터와 함께 고정한다.
// 사용 가능한 flag(엔진이 아는 것만):
//   noHeal      : 회복 불가(자연 회복·흡혈·점심 회복 0, 커피/치킨 드롭은 코인으로)
//   bigHead     : 적 판정 반경 ×1.35(맞히기 쉽지만 길이 막힌다)
//   oneHp       : 최대 체력 1, 회복 0 (부활만이 희망)
//   glassCannon : 피해 ×2, 최대 체력 ×0.5
//   fastClock   : 시계가 빨리 흐름(엔진 구현 예정 — 게임 시간 가속)
//   eliteRush   : 엘리트 이벤트마다 2마리(상자도 2개)
// 설계: 어려운 규칙일수록 월급 배율↑, '보상 있는 고통' 1개 + '버프' 1개 조합이 기본.
// 칼퇴 성공 시 DAILY_CLEAR_REWARD(meta.ts)가 별도로 지급된다.
// ─────────────────────────────────────────────────────────────────────────────
import type { ModifierDef } from './types';

export const DAILY_MODIFIERS: ModifierDef[] = [
  {
    id: 'd_chairman', name: '회장님 방문의 날', icon: '🎩',
    desc: '높으신 분 행차! 다들 괜히 바쁜 척한다. 엘리트가 둘씩 등장(상자도 둘) · 적 체력 +10% · 월급 +30%',
    flags: ['eliteRush'], enemyHpMul: 1.1, coinMul: 1.3,
  },
  {
    id: 'd_monday', name: '월요병', icon: '😩',
    desc: '몸이 천근만근. 이동속도 -15% · 쿨타임 +10% · 대신 경험치 +25% · 월급 +20%',
    stats: { moveSpeed: -0.15, cooldown: -0.1 }, xpMul: 1.25, coinMul: 1.2,
  },
  {
    id: 'd_tgif', name: '불금', icon: '🍻',
    desc: '퇴근 생각에 시계가 빨리 돈다! 신나서 피해 +20% · 이동속도 +10%',
    flags: ['fastClock'], stats: { might: 0.2, moveSpeed: 0.1 }, coinMul: 1.1,
  },
  {
    id: 'd_payday', name: '월급날', icon: '💵',
    desc: '통장을 스쳐 지나가기 전에 챙기자. 월급 ×2 · 대신 적 체력 +25%',
    enemyHpMul: 1.25, coinMul: 2,
  },
  {
    id: 'd_resign', name: '사직서 품은 날', icon: '🔥',
    desc: '"어차피 내일 관둔다." 무서울 게 없다. 피해 ×2 · 최대 체력 ×0.5 · 월급 +30%',
    flags: ['glassCannon'], coinMul: 1.3,
  },
  {
    id: 'd_audit', name: '감사 시즌', icon: '🔍',
    desc: '실수 한 번이면 끝이다. 최대 체력 1 · 부활 +1 · 경험치 +20% · 월급 ×1.8',
    flags: ['oneHp'], stats: { revival: 1 }, xpMul: 1.2, coinMul: 1.8,
  },
  {
    id: 'd_zoom', name: '화상 회의', icon: '📹',
    desc: '다들 카메라에 얼굴을 너무 들이민다. 적이 큼직해짐 · 적 소환 +15% · 경험치 +10% · 월급 +20%',
    flags: ['bigHead'], spawnMul: 1.15, xpMul: 1.1, coinMul: 1.2,
  },
  {
    id: 'd_pantry', name: '탕비실 공사 중', icon: '🚧',
    desc: '커피도 치킨도 없다. 회복 불가(회복 아이템은 코인으로) · 받는 피해 -1 · 월급 +40%',
    flags: ['noHeal'], stats: { armor: 1 }, coinMul: 1.4,
  },
  {
    id: 'd_deadline', name: '마감 D-Day', icon: '⏱️',
    desc: '일이 끝도 없이 쏟아진다. 적 소환 +40% · 대신 적 체력 -15% · 경험치 +20% · 월급 +30%',
    spawnMul: 1.4, enemyHpMul: 0.85, xpMul: 1.2, coinMul: 1.3,
  },
  {
    id: 'd_stairs', name: '엘리베이터 점검일', icon: '🏃',
    desc: '20층까지 계단 출근. 다리가 풀려서 오히려 빨라졌다. 이동속도 +25% · 적 속도 +20% · 월급 +20%',
    stats: { moveSpeed: 0.25 }, enemySpeedMul: 1.2, coinMul: 1.2,
  },
  {
    id: 'd_caffeine', name: '커피 머신 입고', icon: '☕',
    desc: '탕비실에 새 커피 머신! 모두가 각성했다. 쿨타임 -15% · 궁극기 충전 +30% · 적 속도 +15% · 적 공격력 +10%',
    stats: { cooldown: 0.15, ultCharge: 0.3 }, enemySpeedMul: 1.15, enemyDamageMul: 1.1, coinMul: 1.2,
  },
  {
    id: 'd_intern', name: '인턴 첫 출근', icon: '🐥',
    desc: '의욕은 넘치는데 손이 맵지 않다. 투사체 +1 · 피해 -30% · 월급 +20%',
    stats: { amount: 1, might: -0.3 }, coinMul: 1.2,
  },
  {
    id: 'd_workshop', name: '1박 2일 워크숍', icon: '⛺',
    desc: '단체 레크리에이션 강제 참가. 적 소환 +30% · 적 공격력 -20% · 경험치 +15% · 월급 +20%',
    spawnMul: 1.3, enemyDamageMul: 0.8, xpMul: 1.15, coinMul: 1.2,
  },
  {
    id: 'd_bonus', name: '성과급 시즌', icon: '🎰',
    desc: '오늘따라 뭘 해도 잘 풀린다! 행운 +50% · 월급 획득 +30% · 대신 적 체력 +30%',
    stats: { luck: 0.5, greed: 0.3 }, enemyHpMul: 1.3, coinMul: 1.2,
  },
  {
    id: 'd_lupin', name: '월급 루팡의 날', icon: '🦥',
    desc: '오늘은 다들 적당히 일한다. 적 속도 -15% · 적 소환 -15% · 대신 경험치 -10%',
    enemySpeedMul: 0.85, spawnMul: 0.85, xpMul: 0.9,
  },
];
