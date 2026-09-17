import type { SolutionRecord } from '../sim/types';

// 실제 물리 재생으로 확인한 해결 입력. 스테이지 좌표·수치를 바꾸면 반드시 다시 검증한다(npm run validate).
// 각 항목은 격자 탐색(scripts/solve.ts)에서 고른 지점이며, 검증 결과(이웃 흔들림 성공률 등)는 docs/LEVEL_VALIDATION.md에 기록된다.
export const SOLUTIONS: Record<string, SolutionRecord> = {
  L01: { levelKey: 'L01', levelVersion: 1, shots: [{ angleDeg: 22.5, power: 0.7 }], note: '기둥 윗부분을 직접 타격' },
  L02: { levelKey: 'L02', levelVersion: 1, shots: [{ angleDeg: 5, power: 0.9 }], note: '아래 나무 받침을 낮게 강타 → 위 구조물이 통째로 떨어짐' },
  L03: { levelKey: 'L03', levelVersion: 1, shots: [{ angleDeg: 80, power: 0.9 }], note: '높은 궤적으로 밧줄 절단 → 철거추 낙하 → 경사면을 굴러 목표 윗부분 타격' },
  L04: { levelKey: 'L04', levelVersion: 2, shots: [{ angleDeg: 60, power: 0.85 }], note: '밧줄 절단 → 쇠공이 경사면을 굴러 상자를 구덩이로 밀어냄' },
  L05: { levelKey: 'L05', levelVersion: 1, shots: [{ angleDeg: 25, power: 0.9 }], note: '첫 기둥 윗부분 타격 → 도미노 5연쇄' },
  L06: { levelKey: 'L06', levelVersion: 4, shots: [{ angleDeg: 75, power: 0.6 }], note: '시소의 올라간 왼쪽 끝 위로 낙하 → 오른쪽 끝이 튀어 올라 목표 전도' },
  L07: { levelKey: 'L07', levelVersion: 3, shots: [{ angleDeg: 25, power: 0.85 }], note: '받침목 타격 → 구덩이로 쓰러짐 → 다리 붕괴 → 금속 상자 두 개 낙하' },
  L08: { levelKey: 'L08', levelVersion: 1, shots: [{ angleDeg: 22.5, power: 0.9 }], note: '보호상자 위를 스치는 빠른 궤적으로 목표 윗부분 타격' },
  L09: { levelKey: 'L09', levelVersion: 4, shots: [{ angleDeg: 60, power: 0.65 }], note: '왼쪽 밧줄 절단 → 철거추가 오른쪽으로 흔들려 목표 타격' },
  L10: { levelKey: 'L10', levelVersion: 2, shots: [{ angleDeg: 40, power: 0.7 }], note: '적당한 힘으로 상자를 밀어 바로 앞 구덩이에 낙하(세면 보호상자를 덮침)' },
  L11: { levelKey: 'L11', levelVersion: 2, shots: [{ angleDeg: 72.5, power: 0.65 }], note: '밧줄 절단 → 추가 시소 왼쪽 끝에 낙하 → 오른쪽 목표 전도' },
  L12: { levelKey: 'L12', levelVersion: 4, shots: [{ angleDeg: 70, power: 0.9 }], note: '벽 너머로 넘겨 밧줄 절단 → 철거추가 경사면을 굴러 상자를 구덩이로' },
  L13: { levelKey: 'L13', levelVersion: 1, shots: [{ angleDeg: 80, power: 0.9 }], note: '왼쪽 밧줄 위쪽 절단 → 철거추 흔들림 → 기둥 3개 연속 전도' },
  L14: { levelKey: 'L14', levelVersion: 2, shots: [{ angleDeg: 50, power: 0.95 }], note: '밧줄 절단 → 기울어진 기둥이 보호상자 반대쪽(왼쪽)으로 스스로 넘어짐' },
  L15: { levelKey: 'L15', levelVersion: 30, shots: [{ angleDeg: 72.5, power: 0.65 }], note: '밧줄 절단 → 균형추가 시소 올라간 끝에 낙하 → 반대쪽 목표 전도(발사대 옆 보호상자 회피)' },
  L16: { levelKey: 'L16', levelVersion: 10, shots: [{ angleDeg: 60, power: 0.6 }, { angleDeg: 57.5, power: 0.85 }], note: '1발: 길목 기둥 전도, 2발: 밧줄 절단 → 쇠공이 굴러 상자를 구덩이로' },
  L17: { levelKey: 'L17', levelVersion: 6, shots: [{ angleDeg: 35, power: 0.65 }, { angleDeg: 50, power: 0.8 }], note: '1발: 받침 제거 → 가림판 내려앉음, 2발: 드러난 목표 타격' },
  L18: { levelKey: 'L18', levelVersion: 3, shots: [{ angleDeg: 77.5, power: 0.9 }], note: '밧줄 절단 → 철거추가 시소 끝에 낙하 → 시소 회전 → 쇠공이 굴러 떨어져 목표 타격' },
  L19: { levelKey: 'L19', levelVersion: 2, shots: [{ angleDeg: 25, power: 0.6 }], note: '두 보호상자 사이 창으로 받침목 타격 → 상자가 구덩이로 낙하' },
  L20: { levelKey: 'L20', levelVersion: 7, shots: [{ angleDeg: 56, power: 0.925 }], note: '철거추 타격(또는 밧줄 절단) → 시소 끝 낙하 → 시소 회전 → 쇠공 낙하 → 도미노 4연쇄' },
};
