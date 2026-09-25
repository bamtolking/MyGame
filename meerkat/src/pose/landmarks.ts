/** BlazePose 33 랜드마크 인덱스 */
export const LM = {
  nose: 0,
  leftEyeInner: 1, leftEye: 2, leftEyeOuter: 3,
  rightEyeInner: 4, rightEye: 5, rightEyeOuter: 6,
  leftEar: 7, rightEar: 8,
  mouthLeft: 9, mouthRight: 10,
  leftShoulder: 11, rightShoulder: 12,
  leftElbow: 13, rightElbow: 14,
  leftWrist: 15, rightWrist: 16,
  leftPinky: 17, rightPinky: 18,
  leftIndex: 19, rightIndex: 20,
  leftThumb: 21, rightThumb: 22,
  leftHip: 23, rightHip: 24,
  leftKnee: 25, rightKnee: 26,
  leftAnkle: 27, rightAnkle: 28,
  leftHeel: 29, rightHeel: 30,
  leftFootIndex: 31, rightFootIndex: 32,
} as const;

/** 픽셀 좌표계의 한 점 (y는 아래로 증가). v = visibility(0~1) */
export interface Pt {
  x: number;
  y: number;
  z: number;
  v: number;
}

/** 한 장의 이미지(또는 프레임)에 대한 포즈 결과. 좌표는 픽셀 단위. */
export interface PoseFrame {
  w: number;
  h: number;
  pts: Pt[];
  mask?: SegMask;
}

export interface SegMask {
  w: number;
  h: number;
  /** 0~1 신뢰도, 행 우선 */
  data: Float32Array;
}

/** 화면에 뼈대를 그릴 때 쓰는 연결선 (얼굴 세부·손가락 제외) */
export const BODY_CONNECTIONS: [number, number][] = [
  [LM.leftShoulder, LM.rightShoulder],
  [LM.leftShoulder, LM.leftElbow], [LM.leftElbow, LM.leftWrist],
  [LM.rightShoulder, LM.rightElbow], [LM.rightElbow, LM.rightWrist],
  [LM.leftShoulder, LM.leftHip], [LM.rightShoulder, LM.rightHip],
  [LM.leftHip, LM.rightHip],
  [LM.leftHip, LM.leftKnee], [LM.leftKnee, LM.leftAnkle],
  [LM.rightHip, LM.rightKnee], [LM.rightKnee, LM.rightAnkle],
  [LM.leftAnkle, LM.leftHeel], [LM.leftHeel, LM.leftFootIndex], [LM.leftAnkle, LM.leftFootIndex],
  [LM.rightAnkle, LM.rightHeel], [LM.rightHeel, LM.rightFootIndex], [LM.rightAnkle, LM.rightFootIndex],
];

/** 몸 전체가 보이는지 판단할 때 쓰는 핵심 관절 */
export const CORE_POINTS: number[] = [
  LM.nose, LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip,
  LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle,
];
