// 캐릭터 8명 + 궁극기 8종.
// 궁극기 게이지: 처치 1 = 1, 엘리트 20, 피격 피해 1당 0.5.
// 처치 속도 목표(BRIEF): 0~100초 ≈ 3/s, 200~400초 ≈ 6.75/s, 400~600초 ≈ 8/s → 중반 충전 속도 ≈ 7~7.5/s(엘리트·피격 포함).
// 따라서 charge 360~650 → 중반 기준 약 50~90초마다 1회, 첫 발동은 대략 110~170초 무렵.
// 궁극기 피해는 엔진이 '구간 체력 배율 × 스테이지 배율'을 곱해 시간과 함께 강해진다(540초 office ≈ ×9.5).
// 보스 상대 기준: 한 번 발동으로 최종 보스 체력의 약 15~25%(사직서 ≈ 17%, rm -rf ≈ 24%, 커피 셔틀 ≈ 16~20%).
//
// 캐릭터 설계: 숫자 차이만이 아니라 '규칙을 살짝 비트는' 특징 하나씩.
//   김신입 성장형 · 박대리 커피 수혈(회복) · 이개발 단축키 · 최디자 새로고침 · 정인턴 기동·성장 · 한과장 돈복
//   윤팀장 결재 반려(레벨업 제외) · 낙하산 뒷배.
//   복제 궁극기(법카/아빠 찬스)와 빙결 궁극기(최종_최종/긴급 회의)는 '짧고 잦은' 쪽과 '길고 드문' 쪽으로 나눴다.
import type { CharacterDef, UltimateDef } from './types';

export const ULTIMATES: UltimateDef[] = [
  {
    id: 'resign',
    name: '사직서 투척',
    desc: '품속의 사직서를 던져 주변 업무를 싹 날려버린다. (제출은 안 함)',
    icon: '✉️',
    kind: 'blast',
    charge: 500, // 중반 ≈ 68초
    params: { radius: 280, damage: 700, knockback: 80 },
    shout: '저 오늘부로 그만둡니다!',
  },
  {
    id: 'coffee_break',
    name: '커피 타임',
    desc: '화면의 경험치·코인을 전부 빨아들이고 10초간 피해 +50%.',
    icon: '☕',
    kind: 'vacuum',
    charge: 450, // 중반 ≈ 61초
    params: { dur: 10, buff: 0.5 },
    shout: '잠깐 커피 한 잔만 하고 올게요~',
  },
  {
    id: 'rmrf',
    name: 'rm -rf /',
    desc: '5초 동안 화면 곳곳이 삭제(폭발)된다. 복구는 불가능.',
    icon: '🗑️',
    kind: 'rain',
    charge: 560, // 중반 ≈ 76초
    params: { dur: 5, rate: 12, radius: 60, damage: 150 },
    shout: '다 지우고 퇴근합니다. sudo rm -rf /',
  },
  {
    id: 'final_final',
    name: '최종_최종_진짜최종',
    desc: '모든 적을 7초간 얼린다. 길고 드물다. 그 사이 진짜 최종본을 저장한다.',
    icon: '💾',
    kind: 'freeze',
    charge: 580, // 중반 ≈ 78초
    params: { dur: 7 },
    shout: '최종_최종_진짜최종.psd 저장!',
  },
  {
    id: 'coffee_run',
    name: '커피 셔틀',
    desc: '7초간 무적 + 이동속도 +50%. 앞을 막는 적은 커피 캐리어로 밀어버린다.',
    icon: '🏃',
    kind: 'shield',
    charge: 450, // 중반 ≈ 61초
    params: { dur: 7, speed: 0.5, damage: 35 },
    shout: '아아 열두 잔 나갑니다!! 비켜주세요!!',
  },
  {
    id: 'corp_card',
    name: '법카 긁기',
    desc: '8초간 모든 무기 발사 속도 2배. 영수증은 내일의 내가 처리한다.',
    icon: '💸',
    kind: 'clone',
    charge: 540, // 중반 ≈ 73초
    params: { dur: 8, mul: 2 },
    shout: '오늘은 법카로 쏜다!',
  },
  {
    id: 'emergency_meeting',
    name: '긴급 회의 소집',
    desc: '전원 회의실로! 모든 적이 3.5초간 얼어붙는다. 짧지만 자주 부른다.',
    icon: '📣',
    kind: 'freeze',
    charge: 360, // 중반 ≈ 49초
    params: { dur: 3.5 },
    shout: '다들 하던 거 멈추고 회의실로!',
  },
  {
    id: 'dad_call',
    name: '아빠 찬스',
    desc: '12초간 모든 무기 발사 속도 2.5배. 전화 한 통이면 다 해결된다.',
    icon: '📱',
    kind: 'clone',
    charge: 650, // 중반 ≈ 88초
    params: { dur: 12, mul: 2.5 },
    shout: '아빠, 나야… 응, 그거 좀 처리해줘.',
  },
];

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'kim',
    name: '김신입',
    title: '입사 3일차 신입사원',
    desc: '아직 회사가 뭔지 모르지만 일단 열심히 한다. 흡수력 하나는 최고. (경험치 +10%, 10레벨마다 피해 +5%)',
    look: { skin: '#f6d3b3', hair: '#1e1e1e', hairStyle: 'short', suit: '#2c3e66', tie: '#e04848', accessory: '🔰' },
    startWeapon: 'pen',
    stats: { growth: 0.1, luck: 0.05 },
    growth: { every: 10, stats: { might: 0.05 } },
    ultimate: 'resign',
  },
  {
    id: 'park',
    name: '박대리',
    title: '커피 없인 못 사는 대리',
    desc: '카페인이 곧 혈액. 손이 빠르고 커피로 버틴다. (쿨타임 -8%, 이동 +10%, 초당 회복 +0.2, 10레벨마다 쿨타임 -1%)',
    look: { skin: '#efc9a4', hair: '#6b4226', hairStyle: 'bob', suit: '#8a8f99', tie: '#b5793b', accessory: '☕' },
    startWeapon: 'coffee',
    stats: { cooldown: 0.08, moveSpeed: 0.1, recovery: 0.2 },
    growth: { every: 10, stats: { cooldown: 0.01 } },
    ultimate: 'coffee_break',
  },
  {
    id: 'lee',
    name: '이개발',
    title: '야근이 일상인 백엔드 개발자',
    desc: '자리에서 안 일어나서 느리지만, 단축키로 모든 걸 해결한다. (피해 +10%, 쿨타임 -10%, 치명타 +5%, 이동 -10%, 30레벨마다 투사체 +1)',
    look: { skin: '#f1cfae', hair: '#111111', hairStyle: 'spiky', suit: '#33363d', tie: '#35d07f', accessory: '💻', glasses: true },
    startWeapon: 'ctrlz',
    stats: { might: 0.1, cooldown: 0.1, crit: 0.05, moveSpeed: -0.1 },
    growth: { every: 30, stats: { amount: 1 } },
    ultimate: 'rmrf',
    unlockedBy: 'u_character_lee',
  },
  {
    id: 'choi',
    name: '최디자',
    title: '최종_진짜최종.psd의 디자이너',
    desc: '"로고 좀 더 크게요" 소리에 단련되어 모든 게 크다. "수정 요청: 한 번만 더요" (범위 +15%, 지속 +10%, 새로고침 +2, 최대 체력 -10)',
    look: { skin: '#f8dcc4', hair: '#8e5cf7', hairStyle: 'long', suit: '#1f1f24', tie: '#ff6fae', accessory: '🎨', glasses: true },
    startWeapon: 'laser',
    stats: { area: 0.15, duration: 0.1, reroll: 2, maxHp: -10 },
    growth: { every: 10, stats: { area: 0.04 } },
    ultimate: 'final_final',
    unlockedBy: 'u_character_choi',
  },
  {
    id: 'jung',
    name: '정인턴',
    title: '열정 가득 인턴',
    desc: '뭐든 시키면 뛰어간다. 처음엔 서툴지만 크는 속도가 무섭다. (이동 +15%, 경험치 +10%, 획득 반경 +20%, 피해 -10%, 5레벨마다 피해 +3%)',
    look: { skin: '#fbe0c8', hair: '#4a3222', hairStyle: 'bun', suit: '#a5d88a', tie: '#ffcc3d', accessory: '📋' },
    startWeapon: 'postit',
    stats: { moveSpeed: 0.15, growth: 0.1, magnet: 0.2, might: -0.1 },
    growth: { every: 5, stats: { might: 0.03 } },
    ultimate: 'coffee_run',
    unlockedBy: 'u_character_jung',
  },
  {
    id: 'han',
    name: '한과장',
    title: '법카의 달인',
    desc: '회식 자리 결제 경험만 20년. 돈 냄새는 기가 막히게 맡는다. (월급 +25%, 행운 +15%, 피해 +5%, 이동 -5%)',
    look: { skin: '#e9c19c', hair: '#2a2a2a', hairStyle: 'short', suit: '#1d2b4f', tie: '#d4af37', accessory: '🧾' },
    startWeapon: 'card',
    stats: { greed: 0.25, luck: 0.15, might: 0.05, moveSpeed: -0.05 },
    growth: { every: 10, stats: { luck: 0.03 } },
    ultimate: 'corp_card',
    unlockedBy: 'u_character_han',
  },
  {
    id: 'yoon',
    name: '윤팀장',
    title: '회의를 사랑하는 팀장',
    desc: '회의로 다져진 맷집에 결재 반려 권한까지. 느리지만 쉽게 쓰러지지 않는다. (최대 체력 +30, 방어 +2, 범위 +10%, 레벨업 제외 +2, 이동 -10%, 10레벨마다 최대 체력 +10)',
    look: { skin: '#e6bf9a', hair: '#555555', hairStyle: 'bald', suit: '#2b2b2b', tie: '#8b1e2d', accessory: '📢', glasses: true },
    startWeapon: 'folder',
    stats: { maxHp: 30, armor: 2, area: 0.1, banish: 2, moveSpeed: -0.1 },
    growth: { every: 10, stats: { maxHp: 10 } },
    ultimate: 'emergency_meeting',
    unlockedBy: 'u_character_yoon',
  },
  {
    id: 'nakha',
    name: '낙하산',
    title: '사장님 아들(비밀)',
    desc: '면접은 안 봤다. 실력은 잘 안 늘지만 뒷배가 든든하다. (피해 +15%, 행운 +20%, 월급 +30%, 부활 +1, 경험치 -20%)',
    look: { skin: '#fde3cc', hair: '#e0b84a', hairStyle: 'spiky', suit: '#f5f5f5', tie: '#ff3fa4', accessory: '🪂' },
    startWeapon: 'drone',
    stats: { might: 0.15, luck: 0.2, greed: 0.3, revival: 1, growth: -0.2 },
    ultimate: 'dad_call',
    unlockedBy: 'u_character_nakha',
  },
];
