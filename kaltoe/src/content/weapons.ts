// 무기 14종 + 진화 14종.
// - 기본 무기: base = 레벨 1, levels = 레벨 2..8 (7단계, delta는 이전 레벨 대비 더하는 값).
// - 진화 무기: evolved: true, levels: [] (레벨 1 고정). 기본 무기 최대 레벨 + evolveWith 패시브 보유 → 상자에서 진화.
// - 레벨업 중 선택 필드(slow 등)를 올리는 무기는 base에 0으로 미리 넣어 둔다(undefined + n 방지).
//
// 단일 대상 DPS 목표(스탯 보정 전): Lv1 ≈ 18~25, Lv8 ≈ 110~160, 진화 ≈ Lv8의 2.5~3.5배 + 특수 효과.
// 광역 무기(aura/orbit/nova/lob/mine/strike)는 '적 1마리당' DPS가 낮은 대신 여러 마리를 동시에 때린다
// (70마리가 달라붙은 상황에서 Lv8 ≥ 1.5k, 다음 순위의 1.6배를 넘는 Lv8은 없게).
//
// 수치 근거 — 엔진(src/sim/weapons.ts) 실제 동작 기준(2차 개정: 1차 공식 5개가 엔진과 달라 카드·서류철 등이 목표를 빗나갔다):
//   shot/homing/drone/bounce : damage × amount / cooldown                         (drone은 amount대 각각 cooldown마다 1발)
//   boomerang                : 단일 대상은 damage / hitCooldown 이 상한 — 한 무기의 모든 부메랑이 적 1마리의 재타격 칸을
//                              공유하므로 amount·왕복 횟수와 무관. 큰 적(보스)만 min(상한, damage × amount × 2 / cooldown)
//   aura                     : damage / tick, tick = max(0.08, hitCooldown × 쿨타임 배율) — 쿨타임 스탯도 오라를 빠르게 한다
//   orbit                    : 켜짐 duration → 꺼짐 cooldown 순환이라 가동률 = duration / (duration + cooldown)
//                              (duration ≥ cooldown이면 상시). 적 1마리당 ≈ damage / hitCooldown × 가동률
//   beam                     : damage × (duration / hitCooldown) × amount(같은 방향일 때) / cooldown
//   chain                    : 한 번의 발사(volley)에서 이미 맞은 적은 제외된다 → 혼자 있는 적은 발사당 1번개만 맞는다.
//                              단일 = damage / cooldown, 무리 = damage × amount × (1 + Σ falloff^k) / cooldown
//   strike/lob               : 발사당 서로 다른 적을 노린다 → 단일 = damage / cooldown (+장판 damage × puddle / hitCooldown)
//   nova                     : 고리 1개가 range 안 모든 적을 1번씩 → 적 1마리당 damage × amount / cooldown (재타격 간격 없음)
//   mine                     : 발동 반경 안에 들어온 적 근처에서 폭발 → 사실상 근접 광역, 단일 ≈ damage × amount / cooldown × 적중률
// (엔진에 '단일 대상이면 같은 적을 다시 노린다' 규칙이 들어오면 chain/strike/lob 단일 DPS가 amount배로 오른다 — 결과 보고 참고)
import type { WeaponDef } from './types';

export const WEAPONS: WeaponDef[] = [
  // ───────────────────────────── 기본 해금 6종 ─────────────────────────────

  // 볼펜 투척 — 가장 가까운 적을 노리는 단일 대상 저격. Lv1 DPS 24 → Lv8 153.
  {
    id: 'pen',
    name: '볼펜 투척',
    desc: '회사 비품이니까 막 던져도 된다.',
    icon: '🖊️',
    projectile: '🖊️',
    color: '#2f6fed',
    archetype: 'shot',
    targeting: 'nearest',
    base: {
      damage: 12, cooldown: 1.0, amount: 2, area: 7, range: 420, speed: 420, duration: 1.1,
      pierce: 0, knockback: 4, hitCooldown: 0.5, interval: 0.1,
    },
    levels: [
      { desc: '볼펜 +1', delta: { amount: 1 } },
      { desc: '피해 +4', delta: { damage: 4 } },
      { desc: '관통 +1 · 쿨타임 -0.1초', delta: { pierce: 1, cooldown: -0.1 } },
      { desc: '볼펜 +1', delta: { amount: 1 } },
      { desc: '피해 +4', delta: { damage: 4 } },
      { desc: '쿨타임 -0.15초 · 탄속 +20%', delta: { cooldown: -0.15, speed: 84 } },
      { desc: '볼펜 +1 · 피해 +3', delta: { amount: 1, damage: 3 } },
    ],
    evolveWith: 'multitask',
    evolvesTo: 'fountain_storm',
  },

  // 뜨거운 아메리카노 — 몸 주변 상시 화상 오라. 적 1마리당 Lv1 17.5 → Lv8 67 DPS, 감속까지.
  {
    id: 'coffee',
    name: '뜨거운 아메리카노',
    desc: '뜨거우니 가까이 오지 마세요. 진짜로.',
    icon: '☕',
    projectile: '☕',
    color: '#8b5a2b',
    archetype: 'aura',
    targeting: 'nearest',
    base: {
      damage: 7, cooldown: 1, amount: 1, area: 50, range: 0, speed: 0, duration: 0,
      pierce: 999, knockback: 5, hitCooldown: 0.4, interval: 0.1,
      slow: 0, slowDur: 0,
    },
    levels: [
      { desc: '범위 +20%', delta: { area: 10 } },
      { desc: '피해 +3', delta: { damage: 3 } },
      { desc: '재타격 간격 -0.05초 · 감속 15%', delta: { hitCooldown: -0.05, slow: 0.15, slowDur: 0.5 } },
      { desc: '피해 +3', delta: { damage: 3 } },
      { desc: '범위 +20%', delta: { area: 10 } },
      { desc: '피해 +3 · 재타격 간격 -0.05초', delta: { damage: 3, hitCooldown: -0.05 } },
      { desc: '범위 +20% · 피해 +4 · 감속 +10%', delta: { area: 10, damage: 4, slow: 0.1 } },
    ],
    evolveWith: 'lunchbox',
    evolvesTo: 'caffeine_overdrive',
  },

  // 명함 회오리 — 몸 둘레를 도는 방어형 궤도. Lv4부터 상시(지속 4 ≥ 쿨 3). 단일 Lv1 ≈ 22 → Lv8 ≈ 113.
  {
    id: 'cards',
    name: '명함 회오리',
    desc: '인맥은 돌고 돈다. 명함도 돌고 돈다.',
    icon: '📇',
    projectile: '📇',
    color: '#dfe7ff',
    archetype: 'orbit',
    targeting: 'nearest',
    base: {
      damage: 18, cooldown: 3.0, amount: 2, area: 11, range: 62, speed: 220, duration: 3,
      pierce: 999, knockback: 10, hitCooldown: 0.5, interval: 0,
    },
    levels: [
      { desc: '명함 +1', delta: { amount: 1 } },
      { desc: '피해 +5', delta: { damage: 5 } },
      { desc: '지속 +1초 · 회전 +20%', delta: { duration: 1, speed: 44 } },
      { desc: '명함 +1', delta: { amount: 1 } },
      { desc: '피해 +6 · 궤도 +15%', delta: { damage: 6, range: 10 } },
      { desc: '쿨타임 -0.3초 · 재타격 간격 -0.2초', delta: { cooldown: -0.3, hitCooldown: -0.2 } },
      { desc: '명함 +1 · 피해 +6', delta: { amount: 1, damage: 6 } },
    ],
    evolveWith: 'grit',
    evolvesTo: 'vip_cards',
  },

  // 서류철 부메랑 — 무한 관통 왕복 라인 청소기. 가장 튼튼한 적(보스·엘리트) 쪽으로 던진다.
  // 단일 상한 = damage / hitCooldown: 보스 상대 Lv1 ≈ 60 → Lv8 ≈ 150, 작은 적은 Lv8 ≈ 72.
  {
    id: 'folder',
    name: '서류철 부메랑',
    desc: '결재 반려! 서류는 반드시 돌아온다.',
    icon: '📁',
    projectile: '📁',
    color: '#f2b544',
    archetype: 'boomerang',
    targeting: 'strongest',
    base: {
      damage: 16, cooldown: 1.6, amount: 1, area: 14, range: 170, speed: 320, duration: 3,
      pierce: 999, knockback: 10, hitCooldown: 0.2, interval: 0.15,
    },
    levels: [
      { desc: '서류철 +1', delta: { amount: 1 } },
      { desc: '피해 +6', delta: { damage: 6 } },
      { desc: '사거리 +20% · 크기 +20%', delta: { range: 34, area: 3 } },
      { desc: '쿨타임 -0.2초', delta: { cooldown: -0.2 } },
      { desc: '피해 +6', delta: { damage: 6 } },
      { desc: '서류철 +1 · 속도 +20%', delta: { amount: 1, speed: 64 } },
      { desc: '피해 +6 · 넉백 +50%', delta: { damage: 6, knockback: 5 } },
    ],
    evolveWith: 'speedread',
    evolvesTo: 'approval_storm',
  },

  // 클립 샷건 — 근거리 부채꼴 산탄 + 강한 넉백. 가까울수록 아프다. Lv8 전탄 적중 162.
  {
    id: 'clip',
    name: '클립 샷건',
    desc: '가까이 오면 클립이 한 움큼씩 날아간다.',
    icon: '📎',
    projectile: '📎',
    color: '#b8c4cc',
    archetype: 'spread',
    targeting: 'nearest',
    base: {
      damage: 8, cooldown: 1.3, amount: 4, area: 6, range: 230, speed: 460, duration: 0.5,
      pierce: 0, knockback: 14, hitCooldown: 0.5, interval: 0,
      spreadDeg: 40,
    },
    levels: [
      { desc: '클립 +1', delta: { amount: 1 } },
      { desc: '피해 +3', delta: { damage: 3 } },
      { desc: '클립 +2 · 각도 +10°', delta: { amount: 2, spreadDeg: 10 } },
      { desc: '쿨타임 -0.15초', delta: { cooldown: -0.15 } },
      { desc: '피해 +3 · 관통 +1', delta: { damage: 3, pierce: 1 } },
      { desc: '클립 +2 · 사거리 +20%', delta: { amount: 2, duration: 0.1 } },
      { desc: '피해 +4 · 쿨타임 -0.15초', delta: { damage: 4, cooldown: -0.15 } },
    ],
    evolveWith: 'shortcut',
    evolvesTo: 'clip_gatling',
  },

  // 단축키 번개 — 무작위 적에게 번개, 주변으로 연쇄. 무리 정리 특화(혼자 있는 보스에겐 발사당 1번개: Lv8 단일 ≈ 25).
  {
    id: 'ctrlz',
    name: '단축키 번개',
    desc: '실수는 Ctrl+Z로 되돌리고, 업무는 감전시킨다.',
    icon: '⚡',
    projectile: '⚡',
    color: '#ffd83b',
    archetype: 'chain',
    targeting: 'random',
    base: {
      damage: 12, cooldown: 1.3, amount: 2, area: 10, range: 280, speed: 0, duration: 0.2,
      pierce: 0, knockback: 0, hitCooldown: 0.5, interval: 0.08,
      chains: 2, chainRange: 90, chainFalloff: 0.7,
    },
    levels: [
      { desc: '번개 +1', delta: { amount: 1 } },
      { desc: '피해 +5 · 연쇄 +1', delta: { damage: 5, chains: 1 } },
      { desc: '쿨타임 -0.15초', delta: { cooldown: -0.15 } },
      { desc: '번개 +1', delta: { amount: 1 } },
      { desc: '피해 +5 · 연쇄 +1', delta: { damage: 5, chains: 1 } },
      { desc: '연쇄 거리 +30% · 연쇄 피해 감소 완화', delta: { chainRange: 27, chainFalloff: 0.15 } },
      { desc: '번개 +1 · 피해 +6', delta: { amount: 1, damage: 6 } },
    ],
    evolveWith: 'clover',
    evolvesTo: 'ctrl_alt_del',
  },

  // ───────────────────────────── 업적 해금 8종 ─────────────────────────────

  // 레이저 포인터 — 관통 광선. 가장 튼튼한 적을 조준하고, 그 사이에 줄 선 적도 함께 지진다. Lv1 19 → Lv8 117.
  {
    id: 'laser',
    name: '레이저 포인터',
    desc: '여기 보시면요~ 요점만 정확히 지져드립니다.',
    icon: '🔴',
    projectile: '🔴',
    color: '#ff3344',
    archetype: 'beam',
    targeting: 'strongest',
    base: {
      damage: 8, cooldown: 2.2, amount: 1, area: 8, range: 280, speed: 0, duration: 0.8,
      pierce: 999, knockback: 0, hitCooldown: 0.15, interval: 0,
      spinDeg: 0,
    },
    levels: [
      { desc: '피해 +3', delta: { damage: 3 } },
      { desc: '지속 +0.3초', delta: { duration: 0.3 } },
      { desc: '광선 +1', delta: { amount: 1 } },
      { desc: '굵기 +25% · 길이 +20%', delta: { area: 2, range: 56 } },
      { desc: '피해 +4 · 쿨타임 -0.3초', delta: { damage: 4, cooldown: -0.3 } },
      { desc: '지속 +0.3초 · 틱 간격 -0.03초', delta: { duration: 0.3, hitCooldown: -0.03 } },
      { desc: '광선 +1 · 피해 +4', delta: { amount: 1, damage: 4 } },
    ],
    evolveWith: 'busybody',
    evolvesTo: 'presentation_beam',
    unlockedBy: 'u_weapon_laser',
  },

  // 토너 폭탄 — 포물선 투척 + 잉크 장판. 구역 장악형.
  {
    id: 'toner',
    name: '토너 폭탄',
    desc: '토너 갈다 터졌다. 바닥이 새까매졌다.',
    icon: '🖨️',
    projectile: '🖨️',
    color: '#3b2f63',
    archetype: 'lob',
    targeting: 'random',
    base: {
      damage: 18, cooldown: 2.4, amount: 1, area: 40, range: 240, speed: 0, duration: 2.5,
      pierce: 999, knockback: 6, hitCooldown: 0.5, interval: 0.2,
      delay: 0.7, puddle: 0.5,
    },
    levels: [
      { desc: '피해 +6', delta: { damage: 6 } },
      { desc: '토너 +1', delta: { amount: 1 } },
      { desc: '폭발 범위 +20% · 장판 +0.5초', delta: { area: 8, duration: 0.5 } },
      { desc: '장판 피해 +50%', delta: { puddle: 0.25 } },
      { desc: '토너 +1 · 쿨타임 -0.3초', delta: { amount: 1, cooldown: -0.3 } },
      { desc: '피해 +8 · 폭발 범위 +20%', delta: { damage: 8, area: 8 } },
      { desc: '토너 +1 · 장판 피해 +33%', delta: { amount: 1, puddle: 0.25 } },
    ],
    evolveWith: 'passion',
    evolvesTo: 'ink_flood',
    unlockedBy: 'u_weapon_toner',
  },

  // 종이비행기 — 유도 투사체, 절대 빗나가지 않는 안정적인 단일 딜. Lv1 20 → Lv8 127.
  {
    id: 'plane',
    name: '종이비행기',
    desc: '기획서로 접었다. 알아서 날아가 꽂힌다.',
    icon: '✈️',
    projectile: '✈️',
    color: '#8fd3ff',
    archetype: 'homing',
    targeting: 'nearest',
    base: {
      damage: 13, cooldown: 1.3, amount: 2, area: 8, range: 400, speed: 260, duration: 3,
      pierce: 0, knockback: 5, hitCooldown: 0.5, interval: 0.12,
      turnRate: 4,
    },
    levels: [
      { desc: '비행기 +1', delta: { amount: 1 } },
      { desc: '피해 +5', delta: { damage: 5 } },
      { desc: '속도 +20% · 선회력 +40%', delta: { speed: 52, turnRate: 1.6 } },
      { desc: '비행기 +1', delta: { amount: 1 } },
      { desc: '피해 +5 · 관통 +1', delta: { damage: 5, pierce: 1 } },
      { desc: '쿨타임 -0.2초', delta: { cooldown: -0.2 } },
      { desc: '비행기 +1 · 피해 +5', delta: { amount: 1, damage: 5 } },
    ],
    evolveWith: 'energy',
    evolvesTo: 'crane_squadron',
    unlockedBy: 'u_weapon_plane',
  },

  // 엔터키 연타 — 몸에서 퍼지는 충격파 고리 + 강한 넉백. 포위당했을 때의 탈출기.
  // 고리는 범위 안 모든 적을 재타격 간격 없이 때리므로 1발당 피해를 낮게 잡았다: 70마리 포위 Lv1 ≈ 290 → Lv8 ≈ 2.5k(2위의 1.6배 이내), 단일 ≈ 36.
  {
    id: 'keyboard',
    name: '엔터키 연타',
    desc: '엔터 연타의 충격파. 옆자리 사람이 날아간다.',
    icon: '⌨️',
    projectile: '⌨️',
    color: '#66ccff',
    archetype: 'nova',
    targeting: 'nearest',
    base: {
      damage: 10, cooldown: 1.6, amount: 1, area: 16, range: 130, speed: 260, duration: 0.6,
      pierce: 999, knockback: 22, hitCooldown: 0.5, interval: 0.25,
    },
    levels: [
      { desc: '피해 +4', delta: { damage: 4 } },
      { desc: '연타 +1', delta: { amount: 1 } },
      { desc: '충격파 범위 +20%', delta: { range: 26 } },
      { desc: '피해 +4 · 넉백 +30%', delta: { damage: 4, knockback: 7 } },
      { desc: '쿨타임 -0.25초', delta: { cooldown: -0.25 } },
      { desc: '충격파 범위 +15%', delta: { range: 20 } },
      { desc: '피해 +5', delta: { damage: 5 } },
    ],
    evolveWith: 'gym',
    evolvesTo: 'mech_keyboard',
    unlockedBy: 'u_weapon_keyboard',
  },

  // 사내 드론 — 따라다니며 자동 사격하는 포탑. 대수가 늘수록 든든. Lv1 20 → Lv8 147.
  {
    id: 'drone',
    name: '사내 드론',
    desc: '사내 보안용이라더니 자꾸 뭘 쏜다.',
    icon: '🛸',
    projectile: '🛸',
    color: '#5ee0a0',
    archetype: 'drone',
    targeting: 'nearest',
    base: {
      damage: 12, cooldown: 0.6, amount: 1, area: 6, range: 320, speed: 420, duration: 1.0,
      pierce: 0, knockback: 2, hitCooldown: 0.5, interval: 0.1,
    },
    levels: [
      { desc: '드론 +1', delta: { amount: 1 } },
      { desc: '피해 +3', delta: { damage: 3 } },
      { desc: '발사 간격 -0.08초', delta: { cooldown: -0.08 } },
      { desc: '피해 +3 · 관통 +1', delta: { damage: 3, pierce: 1 } },
      { desc: '드론 +1', delta: { amount: 1 } },
      { desc: '발사 간격 -0.07초 · 사거리 +20%', delta: { cooldown: -0.07, range: 64 } },
      { desc: '피해 +4', delta: { damage: 4 } },
    ],
    evolveWith: 'nunchi',
    evolvesTo: 'drone_squad',
    unlockedBy: 'u_weapon_drone',
  },

  // 법인카드 — 맞으면 옆 적에게 튕기는 연쇄 투척. 무리 속에서 빛난다. Lv8 단일 107 + 튕김 7회.
  {
    id: 'card',
    name: '법인카드',
    desc: '긁고, 튕기고, 또 긁는다. 한도는 회사 몫.',
    icon: '💳',
    projectile: '💳',
    color: '#3d8bfd',
    archetype: 'bounce',
    targeting: 'nearest',
    base: {
      damage: 16, cooldown: 1.5, amount: 2, area: 9, range: 150, speed: 380, duration: 2.5,
      pierce: 3, knockback: 4, hitCooldown: 0.5, interval: 0.15,
    },
    levels: [
      { desc: '튕김 +2', delta: { pierce: 2 } },
      { desc: '피해 +6', delta: { damage: 6 } },
      { desc: '카드 +1', delta: { amount: 1 } },
      { desc: '쿨타임 -0.15초', delta: { cooldown: -0.15 } },
      { desc: '피해 +6 · 튕김 +2', delta: { damage: 6, pierce: 2 } },
      { desc: '카드 +1 · 탄속 +20%', delta: { amount: 1, speed: 76 } },
      { desc: '피해 +8', delta: { damage: 8 } },
    ],
    evolveWith: 'stocks',
    evolvesTo: 'black_card',
    unlockedBy: 'u_weapon_card',
  },

  // 포스트잇 지뢰 — 주변에 깔아두는 근접 방어 지뢰. Lv7부터 끈적여서 감속.
  {
    id: 'postit',
    name: '포스트잇 지뢰',
    desc: '할 일 목록인 줄 알았지? 밟으면 터진다.',
    icon: '🗒️',
    projectile: '🗒️',
    color: '#ffe14d',
    archetype: 'mine',
    targeting: 'nearest',
    base: {
      damage: 22, cooldown: 2.0, amount: 2, area: 40, range: 70, speed: 0, duration: 8,
      pierce: 999, knockback: 12, hitCooldown: 0.5, interval: 0.15,
      trigger: 24, slow: 0, slowDur: 0,
    },
    levels: [
      { desc: '포스트잇 +1', delta: { amount: 1 } },
      { desc: '피해 +8', delta: { damage: 8 } },
      { desc: '폭발 범위 +20%', delta: { area: 8 } },
      { desc: '쿨타임 -0.3초', delta: { cooldown: -0.3 } },
      { desc: '포스트잇 +1 · 피해 +8', delta: { amount: 1, damage: 8 } },
      { desc: '끈적임: 감속 30% · 폭발 범위 +20%', delta: { slow: 0.3, slowDur: 1.5, area: 8 } },
      { desc: '포스트잇 +2 · 피해 +10', delta: { amount: 2, damage: 10 } },
    ],
    evolveWith: 'mental',
    evolvesTo: 'postit_field',
    unlockedBy: 'u_weapon_postit',
  },

  // 퇴근 알람 — 화면 곳곳 무작위 예고 폭격. 한 방이 크다.
  {
    id: 'alarm',
    name: '퇴근 알람',
    desc: '퇴근 알람이 울리면 아무도 날 막을 수 없다.',
    icon: '⏰',
    projectile: '⏰',
    color: '#ff8c33',
    archetype: 'strike',
    targeting: 'random',
    base: {
      damage: 30, cooldown: 2.6, amount: 2, area: 45, range: 400, speed: 0, duration: 0.3,
      pierce: 999, knockback: 16, hitCooldown: 0.5, interval: 0.15,
      delay: 0.8,
    },
    levels: [
      { desc: '알람 +1', delta: { amount: 1 } },
      { desc: '피해 +10', delta: { damage: 10 } },
      { desc: '폭발 범위 +20%', delta: { area: 9 } },
      { desc: '쿨타임 -0.3초', delta: { cooldown: -0.3 } },
      { desc: '알람 +1 · 피해 +10', delta: { amount: 1, damage: 10 } },
      { desc: '예고 -0.2초 · 폭발 범위 +20%', delta: { delay: -0.2, area: 9 } },
      { desc: '알람 +2 · 피해 +12', delta: { amount: 2, damage: 12 } },
    ],
    evolveWith: 'selfhelp',
    evolvesTo: 'clockout_bell',
    unlockedBy: 'u_weapon_alarm',
  },

  // ───────────────────────────── 진화 14종 ─────────────────────────────

  // 볼펜 + 멀티태스킹 → 무한 관통 + 치명타. 단일 436(+치명 15%) ≈ Lv8의 3.3배.
  {
    id: 'fountain_storm',
    name: '만년필 폭풍',
    desc: '서명 한 번에 줄 선 적이 전부 뚫린다. 잉크는 법카로 샀다.',
    icon: '✒️',
    projectile: '✒️',
    color: '#1a3fbf',
    archetype: 'shot',
    targeting: 'nearest',
    evolved: true,
    base: {
      damage: 30, cooldown: 0.55, amount: 8, area: 10, range: 460, speed: 640, duration: 1.1,
      pierce: 999, knockback: 6, hitCooldown: 0.5, interval: 0.04,
      critBonus: 0.15,
    },
    levels: [],
  },

  // 아메리카노 + 엄마 도시락 → 거대 화상 오라 + 강감속 + 미량 흡혈(포위 70마리 기준 초당 ≈ 6 회복). 적 1마리당 180 + 화상 20 ≈ 3배.
  {
    id: 'caffeine_overdrive',
    name: '카페인 오버드라이브',
    desc: '심장이 쿵쾅쿵쾅. 반경 안의 모든 업무가 끓어오른다.',
    icon: '🌋',
    projectile: '☕',
    color: '#e0482f',
    archetype: 'aura',
    targeting: 'nearest',
    evolved: true,
    base: {
      damage: 36, cooldown: 1, amount: 1, area: 120, range: 0, speed: 0, duration: 0,
      pierce: 999, knockback: 10, hitCooldown: 0.2, interval: 0.1,
      slow: 0.35, slowDur: 0.6, burnDps: 20, burnDur: 2, lifesteal: 0.0002,
    },
    levels: [],
  },

  // 명함 + 존버 정신 → 상시 6장 황금 궤도, 빙결·치명타. 적 1마리당 ≈ 300(+치명) ≈ Lv8의 2.7배.
  {
    id: 'vip_cards',
    name: 'VIP 골드 명함',
    desc: '황금 명함 앞에선 누구나 얼어붙는다. "아, 네… 대표님이세요?"',
    icon: '🎴',
    projectile: '🎴',
    color: '#ffd700',
    archetype: 'orbit',
    targeting: 'nearest',
    evolved: true,
    base: {
      damage: 60, cooldown: 1, amount: 6, area: 15, range: 85, speed: 300, duration: 99,
      pierce: 999, knockback: 20, hitCooldown: 0.2, interval: 0,
      freezeChance: 0.1, critBonus: 0.1,
    },
    levels: [],
  },

  // 서류철 + 속독 스킬 → 5개 대형 부메랑 + 감속. 단일 상한 52 / 0.12 ≈ 430(실측 ≈ 390) ≈ Lv8의 2.7배.
  {
    id: 'approval_storm',
    name: '무한 결재',
    desc: '반려, 수정, 재상신, 반려… 서류가 끝없이 돌아와 발목을 잡는다.',
    icon: '🗂️',
    projectile: '🗂️',
    color: '#ff9f1a',
    archetype: 'boomerang',
    targeting: 'strongest',
    evolved: true,
    base: {
      damage: 52, cooldown: 1.1, amount: 5, area: 22, range: 240, speed: 420, duration: 3,
      pierce: 999, knockback: 20, hitCooldown: 0.12, interval: 0.1,
      slow: 0.35, slowDur: 1.2,
    },
    levels: [],
  },

  // 클립 샷건 + 단축키 마스터 → 초고속 연사 + 관통 2. 단일(4발 적중) ≈ 343 ≈ 2.9배.
  {
    id: 'clip_gatling',
    name: '클립 개틀링',
    desc: '드르르르륵! 탄약 걱정은 총무팀이 한다.',
    icon: '🖇️',
    projectile: '🖇️',
    color: '#9aa8b2',
    archetype: 'spread',
    targeting: 'nearest',
    evolved: true,
    base: {
      damage: 24, cooldown: 0.28, amount: 5, area: 7, range: 270, speed: 640, duration: 0.5,
      pierce: 2, knockback: 10, hitCooldown: 0.5, interval: 0,
      spreadDeg: 22, critBonus: 0.1,
    },
    levels: [],
  },

  // 단축키 번개 + 사내 인맥 → 번개 5갈래, 감쇠 없는 7연쇄, 확률 빙결(먹통).
  // 1발 피해를 키워 혼자 있는 적에게도 아프게(단일 70 / 0.85 ≈ 82, 엔진 재타깃 규칙이 들어오면 ≈ 410). 무리 출력은 1차와 같다.
  {
    id: 'ctrl_alt_del',
    name: 'Ctrl+Alt+Del 폭풍',
    desc: '응답 없는 업무를 전부 강제 종료합니다. 화면이 멈춥니다.',
    icon: '🌩️',
    projectile: '🌩️',
    color: '#b388ff',
    archetype: 'chain',
    targeting: 'random',
    evolved: true,
    base: {
      damage: 70, cooldown: 0.85, amount: 5, area: 14, range: 340, speed: 0, duration: 0.25,
      pierce: 0, knockback: 4, hitCooldown: 0.5, interval: 0.05,
      chains: 7, chainRange: 150, chainFalloff: 1, freezeChance: 0.15,
    },
    levels: [],
  },

  // 레이저 + 넓은 오지랖 → 굵고 긴 3방향 빔 + 감속 + 화상. 가장 튼튼한 적을 조준. 단일 ≈ 326 ≈ 2.8배.
  {
    id: 'presentation_beam',
    name: '프레젠테이션 빔',
    desc: '"다음 장 넘기겠습니다." 눈부신 빔이 회의실을 통째로 태운다.',
    icon: '📽️',
    projectile: '📽️',
    color: '#fff27a',
    archetype: 'beam',
    targeting: 'strongest',
    evolved: true,
    base: {
      damage: 34, cooldown: 2.4, amount: 3, area: 30, range: 460, speed: 0, duration: 2.2,
      pierce: 999, knockback: 4, hitCooldown: 0.1, interval: 0,
      spinDeg: 0, slow: 0.35, slowDur: 0.8, burnDps: 14, burnDur: 2,
    },
    levels: [],
  },

  // 토너 폭탄 + 열정 페이 → 5개의 거대 잉크 장판, 강감속. 저주로 늘어난 적을 늪에 가둔다.
  // 장판끼리 재타격 간격을 공유하지 않아 겹칠수록 세지므로 개수·장판 비율을 억제(포위 ≈ 6.4k, 단일 ≈ 190 ≈ 토너 Lv8의 2.2배).
  {
    id: 'ink_flood',
    name: '잉크 대홍수',
    desc: '토너 다섯 통이 동시에 터졌다. 사무실이 잉크 바다가 됐다.',
    icon: '🌊',
    projectile: '🖨️',
    color: '#2d1b69',
    archetype: 'lob',
    targeting: 'random',
    evolved: true,
    base: {
      damage: 44, cooldown: 2.2, amount: 5, area: 72, range: 300, speed: 0, duration: 5,
      pierce: 999, knockback: 8, hitCooldown: 0.4, interval: 0.12,
      delay: 0.6, puddle: 1.0, slow: 0.45, slowDur: 0.8,
    },
    levels: [],
  },

  // 종이비행기 + 에너지 드링크 → 종이학 10마리 유도 + 관통 2 + 흡혈(소원, 초당 ≈ 3~6 회복). 단일 400 ≈ 3.1배.
  {
    id: 'crane_squadron',
    name: '종이학 편대',
    desc: '천 마리를 접으면 소원이 이뤄진다. 소원은 체력 회복과 칼퇴.',
    icon: '🕊️',
    projectile: '🕊️',
    color: '#ff9ecb',
    archetype: 'homing',
    targeting: 'nearest',
    evolved: true,
    base: {
      damage: 40, cooldown: 1.0, amount: 10, area: 10, range: 460, speed: 380, duration: 3.5,
      pierce: 2, knockback: 6, hitCooldown: 0.5, interval: 0.06,
      turnRate: 7, lifesteal: 0.002,
    },
    levels: [],
  },

  // 엔터키 + 헬스장 회원권 → 3연타 대형 충격파 + 초강력 넉백 + 확률 빙결. 단일 ≈ 120(Lv8의 3.3배), 포위 ≈ 8.4k.
  {
    id: 'mech_keyboard',
    name: '청축 기계식 키보드',
    desc: '딸깍딸깍딸깍! 소음 민원에 적들이 얼어붙는다.',
    icon: '🎹',
    projectile: '🎹',
    color: '#00e5ff',
    archetype: 'nova',
    targeting: 'nearest',
    evolved: true,
    base: {
      damage: 64, cooldown: 1.6, amount: 3, area: 22, range: 200, speed: 340, duration: 0.7,
      pierce: 999, knockback: 38, hitCooldown: 0.5, interval: 0.16,
      freezeChance: 0.12,
    },
    levels: [],
  },

  // 사내 드론 + 눈치 백단 → 드론 5대, 관통 2, 약점 포착(치명타 +20%). 단일 371(+치명) ≈ 3배.
  {
    id: 'drone_squad',
    name: '감시 드론 편대',
    desc: '누가 딴짓하는지 다 보인다. 약점도 다 보인다.',
    icon: '📡',
    projectile: '🛸',
    color: '#2ecc71',
    archetype: 'drone',
    targeting: 'nearest',
    evolved: true,
    base: {
      damage: 26, cooldown: 0.35, amount: 5, area: 7, range: 440, speed: 560, duration: 1.0,
      pierce: 2, knockback: 3, hitCooldown: 0.5, interval: 0.05,
      critBonus: 0.2,
    },
    levels: [],
  },

  // 법인카드 + 주식 앱 → 5장, 10회 튕김, 치명타 +20%. 단일 ≈ 315(+치명) ≈ 2.9배, 포위 ≈ 3.5k.
  {
    id: 'black_card',
    name: '블랙카드',
    desc: '한도가 없다. 긁을 때마다 치명타가 터진다.',
    icon: '🖤',
    projectile: '🖤',
    color: '#9b7bff',
    archetype: 'bounce',
    targeting: 'nearest',
    evolved: true,
    base: {
      damage: 64, cooldown: 1.2, amount: 5, area: 11, range: 200, speed: 520, duration: 3,
      pierce: 10, knockback: 8, hitCooldown: 0.5, interval: 0.1,
      critBonus: 0.2,
    },
    levels: [],
  },

  // 포스트잇 지뢰 + 철벽 멘탈 → 7장 대형 끈끈이 지뢰밭, 강감속. 버티는 자의 무기(포위 ≈ 5.4k, 단일 ≈ 200).
  {
    id: 'postit_field',
    name: '포스트잇 지뢰밭',
    desc: '바닥이 온통 노랗다. 붙으면 못 떨어지고, 떨어지면 터진다.',
    icon: '🟨',
    projectile: '🟨',
    color: '#ffd000',
    archetype: 'mine',
    targeting: 'nearest',
    evolved: true,
    base: {
      damage: 80, cooldown: 1.5, amount: 7, area: 66, range: 110, speed: 0, duration: 10,
      pierce: 999, knockback: 16, hitCooldown: 0.5, interval: 0.08,
      trigger: 34, slow: 0.55, slowDur: 2.5,
    },
    levels: [],
  },

  // 퇴근 알람 + 자기계발서 → 10곳 대폭격 + 처형(체력 20% 이하 일반 적 즉사).
  {
    id: 'clockout_bell',
    name: '6시 정각 종소리',
    desc: '땡! 18시 정각. 이미 지친 업무는 그 자리에서 퇴근한다.',
    icon: '🔔',
    projectile: '🔔',
    color: '#ffcc00',
    archetype: 'strike',
    targeting: 'random',
    evolved: true,
    base: {
      damage: 100, cooldown: 2.1, amount: 10, area: 92, range: 440, speed: 0, duration: 0.35,
      pierce: 999, knockback: 30, hitCooldown: 0.5, interval: 0.08,
      delay: 0.45, execute: 0.2,
    },
    levels: [],
  },
];
