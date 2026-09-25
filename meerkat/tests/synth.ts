/**
 * 테스트용 합성 포즈 생성기. 표준 신체 비율(키 대비 높이)로 33개 랜드마크를 만듭니다.
 */
import { LM, type PoseFrame, type Pt } from '../src/pose/landmarks';

const W = 1000;
const IMG_H = 1600;
const GROUND = 1500;
const H = 1400; // 키(px)

const y = (ratio: number) => GROUND - ratio * H;
const rad = (d: number) => (d * Math.PI) / 180;

function blank(): Pt[] {
  return Array.from({ length: 33 }, () => ({ x: W / 2, y: IMG_H / 2, z: 0, v: 0.95 }));
}

export interface FrontParams {
  /** + = 왼쪽 어깨가 낮음 (°) */
  shoulderTilt?: number;
  pelvicTilt?: number;
  headTilt?: number;
  /** + = 무릎이 안쪽(X다리) (°) */
  kneeValgus?: number;
  /** 몸통 좌우 이동(px, + = 사람 왼쪽) */
  trunkShiftPx?: number;
  cx?: number;
}

/** 정면(카메라를 바라봄, 비반전): 사람의 왼쪽이 이미지 +x */
export function frontPose(p: FrontParams = {}): PoseFrame {
  const cx = p.cx ?? W / 2;
  const pts = blank();
  const set = (i: number, x: number, yy: number, v = 0.97) => (pts[i] = { x, y: yy, z: 0, v });
  const tilt = (half: number, deg: number) => Math.tan(rad(deg)) * half; // 왼쪽이 내려가는 양

  // 머리
  const headY = y(0.925);
  const earHalf = 0.04 * H;
  const ht = tilt(earHalf, p.headTilt ?? 0);
  set(LM.leftEar, cx + earHalf, headY + ht);
  set(LM.rightEar, cx - earHalf, headY - ht);
  const eyeHalf = 0.018 * H;
  const et = tilt(eyeHalf, p.headTilt ?? 0);
  set(LM.leftEye, cx + eyeHalf, y(0.936) + et);
  set(LM.rightEye, cx - eyeHalf, y(0.936) - et);
  set(LM.leftEyeInner, cx + eyeHalf * 0.6, y(0.936) + et * 0.6);
  set(LM.rightEyeInner, cx - eyeHalf * 0.6, y(0.936) - et * 0.6);
  set(LM.leftEyeOuter, cx + eyeHalf * 1.4, y(0.936) + et * 1.4);
  set(LM.rightEyeOuter, cx - eyeHalf * 1.4, y(0.936) - et * 1.4);
  set(LM.nose, cx, y(0.91));
  set(LM.mouthLeft, cx + 0.012 * H, y(0.89));
  set(LM.mouthRight, cx - 0.012 * H, y(0.89));

  // 어깨
  const tx = p.trunkShiftPx ?? 0;
  const shHalf = 0.11 * H;
  const st = tilt(shHalf, p.shoulderTilt ?? 0);
  set(LM.leftShoulder, cx + tx + shHalf, y(0.8) + st);
  set(LM.rightShoulder, cx + tx - shHalf, y(0.8) - st);
  set(LM.leftElbow, cx + tx + shHalf + 10, y(0.63) + st);
  set(LM.rightElbow, cx + tx - shHalf - 10, y(0.63) - st);
  set(LM.leftWrist, cx + tx + shHalf + 5, y(0.48) + st);
  set(LM.rightWrist, cx + tx - shHalf - 5, y(0.48) - st);
  for (const [i, j] of [[LM.leftPinky, LM.leftWrist], [LM.leftIndex, LM.leftWrist], [LM.leftThumb, LM.leftWrist], [LM.rightPinky, LM.rightWrist], [LM.rightIndex, LM.rightWrist], [LM.rightThumb, LM.rightWrist]]) {
    set(i, pts[j].x, pts[j].y + 40);
  }

  // 골반·다리
  const hipHalf = 0.05 * H;
  const pt = tilt(hipHalf, p.pelvicTilt ?? 0);
  set(LM.leftHip, cx + hipHalf, y(0.51) + pt);
  set(LM.rightHip, cx - hipHalf, y(0.51) - pt);
  // 무릎 안쪽 이동: 허벅지/정강이 길이 ~0.235H, 편차각 θ → 중앙 이동량 ≈ L·tan(θ/2)
  const kv = Math.tan(rad((p.kneeValgus ?? 0) / 2)) * 0.235 * H;
  set(LM.leftKnee, cx + hipHalf - kv, y(0.285));
  set(LM.rightKnee, cx - hipHalf + kv, y(0.285));
  set(LM.leftAnkle, cx + hipHalf, y(0.039));
  set(LM.rightAnkle, cx - hipHalf, y(0.039));
  set(LM.leftHeel, cx + hipHalf, GROUND - 5);
  set(LM.rightHeel, cx - hipHalf, GROUND - 5);
  set(LM.leftFootIndex, cx + hipHalf + 20, GROUND);
  set(LM.rightFootIndex, cx - hipHalf - 20, GROUND);
  return { w: W, h: IMG_H, pts };
}

export interface SideParams {
  /** 바라보는 방향: 1 = 이미지 오른쪽 */
  facing?: 1 | -1;
  /** 머리 전방 각도(°) */
  headForward?: number;
  /** 어깨가 고관절보다 앞으로 나온 거리(px) */
  shoulderForwardPx?: number;
  /** 고관절이 기준선보다 앞으로 나온 거리(px) */
  pelvisForwardPx?: number;
  /** + = 무릎 과신전 (°) */
  kneeHyper?: number;
  cx?: number;
}

/** 측면: 카메라 쪽(가까운 쪽)은 왼쪽 몸 */
export function sidePose(p: SideParams = {}): PoseFrame {
  const f = p.facing ?? 1;
  const cx = p.cx ?? W / 2;
  const pts = blank();
  const set = (i: number, x: number, yy: number, v = 0.95) => (pts[i] = { x, y: yy, z: 0, v });
  const plumb = cx + f * 0.012 * H;
  const ankleX = cx;
  const hipX = plumb + f * (p.pelvisForwardPx ?? 0);
  const shX = hipX + f * (p.shoulderForwardPx ?? 0);
  const shY = y(0.8);
  const earY = y(0.925);
  const earX = shX + f * Math.tan(rad(p.headForward ?? 0)) * (shY - earY);

  // 무릎: 고관절-발목 직선에서 뒤로(과신전) 이동
  const hipY = y(0.51), kneeY = y(0.285), ankleY = y(0.039);
  const lineX = hipX + ((ankleX - hipX) * (kneeY - hipY)) / (ankleY - hipY);
  const kneeX = lineX - f * Math.tan(rad((p.kneeHyper ?? 0) / 2)) * 0.235 * H;

  for (const [l, r, x, yy] of [
    [LM.leftEar, LM.rightEar, earX, earY],
    [LM.leftShoulder, LM.rightShoulder, shX, shY],
    [LM.leftHip, LM.rightHip, hipX, hipY],
    [LM.leftKnee, LM.rightKnee, kneeX, kneeY],
    [LM.leftAnkle, LM.rightAnkle, ankleX, ankleY],
  ] as const) {
    set(l, x, yy, 0.97);
    set(r, x - f * 4, yy, l === LM.leftEar || l === LM.leftShoulder || l === LM.leftHip ? 0.9 : 0.25);
  }
  set(LM.nose, earX + f * 0.06 * H, y(0.915));
  for (const i of [LM.leftEye, LM.leftEyeInner, LM.leftEyeOuter, LM.rightEye, LM.rightEyeInner, LM.rightEyeOuter]) set(i, earX + f * 0.045 * H, y(0.936));
  set(LM.mouthLeft, earX + f * 0.05 * H, y(0.89));
  set(LM.mouthRight, earX + f * 0.05 * H, y(0.89), 0.5);
  set(LM.leftElbow, shX, y(0.63));
  set(LM.leftWrist, shX + f * 10, y(0.48));
  set(LM.rightElbow, shX, y(0.63), 0.2);
  set(LM.rightWrist, shX + f * 10, y(0.48), 0.2);
  for (const i of [LM.leftPinky, LM.leftIndex, LM.leftThumb]) set(i, shX + f * 12, y(0.45));
  for (const i of [LM.rightPinky, LM.rightIndex, LM.rightThumb]) set(i, shX + f * 12, y(0.45), 0.2);
  set(LM.leftHeel, ankleX - f * 0.03 * H, GROUND - 5);
  set(LM.rightHeel, ankleX - f * 0.03 * H, GROUND - 5, 0.3);
  set(LM.leftFootIndex, ankleX + f * 0.11 * H, GROUND);
  set(LM.rightFootIndex, ankleX + f * 0.11 * H, GROUND, 0.3);
  return { w: W, h: IMG_H, pts };
}

/**
 * 측면 실루엣 마스크 합성: 등 윤곽 = 기준선 + 흉추 볼록(kyph px) − 요추 오목(lord px)
 */
export function sideMask(frame: PoseFrame, opts: { kyph: number; lord: number; facing?: 1 | -1 }): PoseFrame {
  const f = opts.facing ?? 1;
  const w = frame.w, h = frame.h;
  const data = new Float32Array(w * h);
  const sh = frame.pts[LM.leftShoulder], hip = frame.pts[LM.leftHip];
  const top = sh.y - 0.1 * H, bottom = hip.y + 0.25 * H;
  const c7y = sh.y - 0.03 * H, s2y = hip.y - 0.03 * H;
  const l1y = c7y + (s2y - c7y) * 0.6;
  const depth = 0.12 * H; // 몸통 두께
  for (let yy = Math.floor(top); yy < bottom; yy++) {
    // 기준 등선: 어깨~골반을 잇는 선에서 뒤로 depth/2
    const t = (yy - sh.y) / (hip.y - sh.y);
    const center = sh.x + (hip.x - sh.x) * t;
    let backOff = depth / 2;
    if (yy >= c7y && yy <= l1y) backOff += opts.kyph * Math.sin((Math.PI * (yy - c7y)) / (l1y - c7y));
    if (yy >= l1y && yy <= s2y) backOff -= opts.lord * Math.sin((Math.PI * (yy - l1y)) / (s2y - l1y));
    const backX = center - f * backOff;
    const frontX = center + f * depth / 2;
    const [x0, x1] = [Math.min(backX, frontX), Math.max(backX, frontX)];
    for (let xx = Math.max(0, Math.floor(x0)); xx <= Math.min(w - 1, Math.ceil(x1)); xx++) data[yy * w + xx] = 1;
  }
  return { ...frame, mask: { w, h, data } };
}

/** 모든 점에 무작위 흔들림 추가 (결정적) */
export function jitter(frame: PoseFrame, amp: number, seed = 1): PoseFrame {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
  return { ...frame, pts: frame.pts.map((p) => ({ ...p, x: p.x + rnd() * amp, y: p.y + rnd() * amp })) };
}

export const SYNTH = { W, IMG_H, H, GROUND };
