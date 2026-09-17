// 스테이지 데이터 타입. 물리 엔진 객체는 여기 포함하지 않는다(순수 데이터).

export type Material = 'wood' | 'metal' | 'stone' | 'iron' | 'crate' | 'ground' | 'cutter';

export type BodyRole = 'normal' | 'target' | 'protect' | 'support' | 'weight' | 'plank' | 'ball';

export interface Vec2 { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number } // x,y = 왼쪽 위

export interface BlockDef {
  kind: 'block';
  id: string;
  x: number; y: number;      // 중심 좌표(월드)
  w: number; h: number;
  angle?: number;            // 도(deg), 시계방향 양수(화면 좌표계)
  material: Material;
  static?: boolean;
  role?: BodyRole;
  label?: string;            // 화면 표시용 짧은 이름
}

export interface BallDef {
  kind: 'ball';
  id: string;
  x: number; y: number; r: number;
  material: Material;        // 보통 'iron'
  role?: BodyRole;
  static?: boolean;
}

export interface RampDef {
  kind: 'ramp';
  id: string;
  x: number; y: number;      // 바운딩 박스 왼쪽 위
  w: number; h: number;
  dir: 'left' | 'right';     // 'right' = 왼쪽이 높고 오른쪽으로 내려감
  material?: Material;       // 기본 'stone'
}

export interface PolyDef {
  kind: 'poly';
  id: string;
  points: Vec2[];            // 월드 좌표, 볼록 다각형
  material?: Material;
  static?: boolean;
}

export type BodyDef = BlockDef | BallDef | RampDef | PolyDef;

export interface RopeAnchor { body?: string; x: number; y: number } // 월드 좌표(설계 시점)

export interface RopeDef {
  kind: 'rope';
  id: string;
  a: RopeAnchor;             // 고정점 또는 물체
  b: RopeAnchor;             // 보통 추(물체)
}

export interface HingeDef {
  kind: 'hinge';
  id: string;
  body: string;              // 회전하는 발판 id
  pivot: Vec2;               // 월드 좌표 회전축
  post?: boolean;            // 장식용 받침 기둥 표시
}

export type GoalJudge = 'topple' | 'drop';

export interface GoalDef {
  body: string;              // 목표 블록 id
  judge: GoalJudge;
  zone?: Rect;               // judge === 'drop'일 때 낙하 구역
}

export interface ProtectDef {
  body: string;              // 보호상자 id
  safeZone: Rect;            // 중심이 이 밖으로 나가면 실패
}

export interface HintDef {
  text: string;
  highlight?: string[];      // 1단계: 강조할 물체/밧줄/힌지 id
  shot?: { angleDeg: number; power: number }; // 2단계: 검증 해법 기반 방향
}

export type TutorialKey = 'basic' | 'rope' | 'ball' | 'seesaw' | 'protect' | 'twoShots';

export interface LevelDef {
  id: number;                // 1..20
  key: string;               // 'L01'
  version: number;           // 좌표/수치 바꾸면 올린다 → 해법 재검증 필요
  title: string;
  subtitle: string;
  launcher: Vec2;
  shots: number;             // 사용 가능한 탄 수(1~3)
  bodies: BodyDef[];
  ropes?: RopeDef[];
  hinges?: HingeDef[];
  goals: GoalDef[];
  protects?: ProtectDef[];
  stars: { three: number; two: number }; // 사용 탄 수가 이 값 이하이면 해당 별
  hints: HintDef[];
  ground?: { from: number; to: number }[]; // 바닥 구간(없으면 전체). 구간 사이는 구덩이
  tutorial?: TutorialKey;
  solutionRef: string;       // src/data/solutions.ts의 키
}

// 발사 입력: 화면 크기와 무관한 정규화 값.
export interface ShotInput {
  angleDeg: number;          // 0 = 오른쪽, 90 = 위쪽(수학 좌표계, 화면은 y가 아래로 증가하므로 변환)
  power: number;             // 0..1 (당김 비율)
}

export type FailReason = 'goalsRemaining' | 'outOfShots' | 'protectHit' | 'protectOut';

export type SessionState = 'init' | 'aiming' | 'flying' | 'success' | 'failed';

export type SessionEvent =
  | { t: 'state'; from: SessionState; to: SessionState }
  | { t: 'launch'; shot: ShotInput; x: number; y: number }
  | { t: 'hit'; material: Material; other: Material; speed: number; x: number; y: number }
  | { t: 'ropeCut'; ropeId: string; a: Vec2; b: Vec2; at: Vec2 }
  | { t: 'goal'; body: string; combo: number; remaining: number }
  | { t: 'protectFail'; body: string; reason: FailReason }
  | { t: 'success'; shotsUsed: number; stars: number; maxCombo: number }
  | { t: 'fail'; reason: FailReason }
  | { t: 'removed'; body: string };

export interface SolutionRecord {
  levelKey: string;
  levelVersion: number;
  shots: ShotInput[];
  note?: string;             // 어떤 원리로 푸는지(문서·힌트용)
}
