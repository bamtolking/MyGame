import type { SolutionRecord } from '../sim/types';

// 실제 물리 재생으로 확인한 해결 입력. 스테이지 좌표·버전을 바꾸면 반드시 다시 검증한다(npm run validate).
// 각 항목은 격자 탐색(scripts/solve.ts)에서 이웃 8칸이 모두 성공한 "견고한" 지점을 고른 것이다.
export const SOLUTIONS: Record<string, SolutionRecord> = {
  L01: { levelKey: 'L01', levelVersion: 1, shots: [{ angleDeg: 22.5, power: 0.7 }], note: '기둥 윗부분을 직접 타격' },
  L02: { levelKey: 'L02', levelVersion: 1, shots: [{ angleDeg: 5, power: 0.9 }], note: '아래 나무 받침을 낮게 강타 → 위 구조물이 통째로 떨어짐' },
  L03: { levelKey: 'L03', levelVersion: 1, shots: [{ angleDeg: 80, power: 0.9 }], note: '높은 궤적으로 밧줄 절단 → 철거추 낙하 → 경사면 굴러 목표 윗부분 타격' },
  L04: { levelKey: 'L04', levelVersion: 2, shots: [{ angleDeg: 60, power: 0.85 }], note: '밧줄 절단 → 쇠공이 경사면을 굴러 상자를 구덩이로 밀어냄' },
  L05: { levelKey: 'L05', levelVersion: 1, shots: [{ angleDeg: 25, power: 0.9 }], note: '첫 기둥 윗부분 타격 → 도미노 5연쇄' },
};
