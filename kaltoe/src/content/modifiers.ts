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
// 2차 개정:
//  - 오늘의 업무는 재도전이 가능하고 판마다 coinMul이 붙으므로 배율 상한을 ×1.5로 낮췄다(최악 조합 ≈ ×2.3, 강도 1 포함).
//    1차의 월급날 ×2 + 감사 시즌 ×1.8 조합(×4.1)은 '같은 일일 도전 반복'이 최고의 파밍이 되는 문제가 있었다.
//  - 숫자만 바꾸는 규칙(워크숍·계단·커피 머신)을 빌드를 바꾸는 규칙(조직 개편·대청소·복주머니·스프린트)으로 교체.
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
    desc: '통장을 스쳐 지나가기 전에 챙기자. 월급 +40% · 대신 적 체력 +25%',
    enemyHpMul: 1.25, coinMul: 1.4,
  },
  {
    id: 'd_resign', name: '사직서 품은 날', icon: '🔥',
    desc: '"어차피 내일 관둔다." 무서울 게 없다. 피해 ×2 · 최대 체력 ×0.5 · 월급 +30%',
    flags: ['glassCannon'], coinMul: 1.3,
  },
  {
    id: 'd_audit', name: '감사 시즌', icon: '🔍',
    desc: '실수 한 번이면 끝이다. 최대 체력 1 · 부활 +1 · 경험치 +20% · 월급 +50%',
    flags: ['oneHp'], stats: { revival: 1 }, xpMul: 1.2, coinMul: 1.5,
  },
  {
    id: 'd_zoom', name: '화상 회의', icon: '📹',
    desc: '다들 카메라에 얼굴을 너무 들이민다. 적이 큼직해짐 · 적 소환 +15% · 경험치 +10% · 월급 +20%',
    flags: ['bigHead'], spawnMul: 1.15, xpMul: 1.1, coinMul: 1.2,
  },
  {
    id: 'd_pantry', name: '탕비실 공사 중', icon: '🚧',
    desc: '커피도 치킨도 없다. 회복 불가(회복 아이템은 코인으로) · 받는 피해 -1 · 월급 +25%',
    flags: ['noHeal'], stats: { armor: 1 }, coinMul: 1.25,
  },
  {
    id: 'd_deadline', name: '마감 D-Day', icon: '⏱️',
    desc: '일이 끝도 없이 쏟아진다. 적 소환 +40% · 대신 적 체력 -15% · 경험치 +20% · 월급 +30%',
    spawnMul: 1.4, enemyHpMul: 0.85, xpMul: 1.2, coinMul: 1.3,
  },
  {
    id: 'd_reorg', name: '조직 개편', icon: '🔀',
    desc: '원하는 팀만 꾸려라! 레벨업 새로고침 +5 · 레벨업 제외 +3 · 월급 +10%',
    stats: { reroll: 5, banish: 3 }, coinMul: 1.1,
  },
  {
    id: 'd_cleanup', name: '대청소의 날', icon: '🧹',
    desc: '떨어진 건 전부 내 것. 획득 반경 +300% · 대신 적 체력 +15% · 월급 +20%',
    stats: { magnet: 3 }, enemyHpMul: 1.15, coinMul: 1.2,
  },
  {
    id: 'd_intern', name: '인턴 첫 출근', icon: '🐥',
    desc: '의욕은 넘치는데 손이 맵지 않다. 투사체 +1 · 피해 -30% · 월급 +20%',
    stats: { amount: 1, might: -0.3 }, coinMul: 1.2,
  },
  {
    id: 'd_newyear', name: '시무식 복주머니', icon: '🧧',
    desc: '새해 복 많이 받으세요! 행운 +100%(4번째 선택지·상자 대박 확률↑) · 대신 적 체력 +30% · 월급 +20%',
    stats: { luck: 1.0 }, enemyHpMul: 1.3, coinMul: 1.2,
  },
  {
    id: 'd_sprint', name: '스프린트 주간', icon: '🏃',
    desc: '2주 치 일을 1주에! 경험치 +60%(레벨업 폭주) · 대신 적 공격력 +30% · 월급 +20%',
    xpMul: 1.6, enemyDamageMul: 1.3, coinMul: 1.2,
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
