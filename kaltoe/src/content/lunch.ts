// 점심 메뉴 10종. 12:00(200초)에 3개 중 1개 선택 → stats는 런 끝까지 적용, heal은 즉시 회복 비율.
// 설계 의도: '안전(회복·체력)' / '화력(대신 몸이 약해짐)' / '기동·손 빠르기' / '경제·운' 중
// 오후 빌드 방향을 고르는 선택. 대부분 장단점이 있고, 순수 이득형은 수치를 낮게 잡았다.
// 2차 개정: 국밥(전부 회복)·제육(단점 없음)이 늘 정답이던 문제 → 국밥 회복 60%, 제육 수치 하향, 샐러드·짜장 단점 완화.
import type { LunchDef } from './types';

export const LUNCHES: LunchDef[] = [
  {
    id: 'gukbap',
    name: '뜨끈한 국밥',
    icon: '🍲',
    desc: '국밥은 진리. 체력 60% 회복, 오후 내내 든든하다. (최대 체력 +30, 방어 +1, 초당 회복 +0.2)',
    stats: { maxHp: 30, armor: 1, recovery: 0.2 },
    heal: 0.6,
  },
  {
    id: 'jeyuk',
    name: '제육볶음',
    icon: '🥘',
    desc: '밥도둑 제육. 무난하게 조금씩 세진다. (피해 +8%, 범위 +5%, 체력 40% 회복)',
    stats: { might: 0.08, area: 0.05 },
    heal: 0.4,
  },
  {
    id: 'malatang',
    name: '마라탕',
    icon: '🌶️',
    desc: '얼얼한 마라 파워! 화력은 폭발하지만 속은 쓰리다. (피해 +25%, 치명타 +5%, 최대 체력 -20)',
    stats: { might: 0.25, crit: 0.05, maxHp: -20 },
    heal: 0.2,
  },
  {
    id: 'salad',
    name: '닭가슴살 샐러드',
    icon: '🥗',
    desc: '몸이 가볍다! 대신 든든하진 않아 회복은 조금뿐. (이동 +15%, 쿨타임 -10%, 획득 반경 +30%, 체력 20% 회복)',
    stats: { moveSpeed: 0.15, cooldown: 0.1, magnet: 0.3 },
    heal: 0.2,
  },
  {
    id: 'donkatsu',
    name: '왕돈까스',
    icon: '🍛',
    desc: '얼굴만 한 돈까스. 존재감(범위)은 커지고 몸은 무거워진다. (범위 +25%, 최대 체력 +20, 이동 -8%)',
    stats: { area: 0.25, maxHp: 20, moveSpeed: -0.08 },
    heal: 0.4,
  },
  {
    id: 'jjajang',
    name: '짜장면',
    icon: '🍜',
    desc: '불기 전에 5분 만에 흡입하고 바로 복귀. 손이 빨라진다. (쿨타임 -10%, 투사체 속도 +20%, 지속 -5%)',
    stats: { cooldown: 0.1, projSpeed: 0.2, duration: -0.05 },
    heal: 0.3,
  },
  {
    id: 'gimbap',
    name: '참치김밥',
    icon: '🍙',
    desc: '"한 줄 추가요!" 투사체도 하나 추가. 가볍게 먹어서 힘은 좀 빠진다. (투사체 +1, 피해 -8%)',
    stats: { amount: 1, might: -0.08 },
    heal: 0.15,
    unlockedBy: 'u_lunch_gimbap',
  },
  {
    id: 'dosirak',
    name: '편의점 도시락',
    icon: '🍱',
    desc: '가성비의 왕. 아낀 점심값만큼 월급이 오른다(기분이). (월급 +30%, 경험치 +15%, 행운 +10%)',
    stats: { greed: 0.3, growth: 0.15, luck: 0.1 },
    heal: 0.25,
    unlockedBy: 'u_lunch_dosirak',
  },
  {
    id: 'burger',
    name: '수제버거',
    icon: '🍔',
    desc: '두툼한 패티의 칼로리 폭탄. 세지고 튼튼해지지만 굼떠진다. (피해 +15%, 최대 체력 +40, 이동 -10%)',
    stats: { might: 0.15, maxHp: 40, moveSpeed: -0.1 },
    heal: 0.6,
    unlockedBy: 'u_lunch_burger',
  },
  {
    id: 'sushi',
    name: '회전초밥',
    icon: '🍣',
    desc: '돌고 도는 접시처럼 선택지도 돌려보자. (새로고침 +2, 행운 +25%, 치명타 +6%)',
    stats: { reroll: 2, luck: 0.25, crit: 0.06 },
    heal: 0.3,
    unlockedBy: 'u_lunch_sushi',
  },
];
