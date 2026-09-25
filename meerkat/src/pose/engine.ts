import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { PoseFrame, Pt, SegMask } from './landmarks';

export type ModelKind = 'lite' | 'full';
type Mode = 'IMAGE' | 'VIDEO';

type Fileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
let filesetPromise: Promise<Fileset> | null = null;

/** 모델 파일 확장자. 웹 미리보기(아티팩트) 빌드는 .task 를 서빙하지 않아 바꿔 올립니다 (scripts/artifact.mjs) */
const MODEL_EXT: string = import.meta.env.VITE_MODEL_EXT || 'task';

function assetUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}${path}`, document.baseURI).href;
}

function getFileset(): Promise<Fileset> {
  if (!filesetPromise) {
    filesetPromise = FilesetResolver.forVisionTasks(assetUrl('mediapipe/wasm')).catch((e) => {
      filesetPromise = null;
      throw e;
    });
  }
  return filesetPromise;
}

interface Slot {
  lm: PoseLandmarker;
  mode: Mode;
  mask: boolean;
  delegate: 'GPU' | 'CPU';
}
const slots = new Map<ModelKind, Promise<Slot>>();
let preferred: 'GPU' | 'CPU' = 'GPU';
/** 테스트·호환성용: 우선 사용할 연산 장치 지정 */
export function setPreferredDelegate(d: 'GPU' | 'CPU') {
  preferred = d;
}

async function create(kind: ModelKind, mode: Mode, mask: boolean): Promise<Slot> {
  const fileset = await getFileset();
  const base = {
    modelAssetPath: assetUrl(`models/pose_landmarker_${kind}.${MODEL_EXT}`),
  };
  const opts = {
    runningMode: mode,
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: mask && preferred === 'GPU',
  } as const;
  try {
    if (preferred === 'CPU') throw new Error('CPU preferred');
    const lm = await PoseLandmarker.createFromOptions(fileset, { baseOptions: { ...base, delegate: 'GPU' }, ...opts });
    return { lm, mode, mask, delegate: 'GPU' };
  } catch (e) {
    console.warn('[pose] GPU delegate failed, using CPU', e);
    const lm = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { ...base, delegate: 'CPU' },
      ...opts,
      outputSegmentationMasks: false,
    });
    return { lm, mode, mask: false, delegate: 'CPU' };
  }
}

async function acquire(kind: ModelKind, mode: Mode, mask: boolean): Promise<Slot> {
  let p = slots.get(kind);
  if (!p) {
    p = create(kind, mode, mask);
    slots.set(kind, p);
    p.catch(() => slots.delete(kind));
  }
  const slot = await p;
  // CPU 연산에서는 분할 마스크가 불안정(WASM abort)하므로 끕니다.
  const wantMask = mask && slot.delegate === 'GPU';
  if (slot.mode !== mode || slot.mask !== wantMask) {
    await slot.lm.setOptions({ runningMode: mode, outputSegmentationMasks: wantMask });
    slot.mode = mode;
    slot.mask = wantMask;
  }
  return slot;
}

/** 모델을 미리 내려받아 초기화해 둡니다 (첫 스캔 대기 시간 단축). */
export function warmup(kind: ModelKind = 'full'): Promise<void> {
  return acquire(kind, 'IMAGE', false).then(() => undefined);
}

export function isPoseSupported(): boolean {
  return typeof WebAssembly === 'object' && typeof document !== 'undefined';
}

type Source = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap | OffscreenCanvas;

function sizeOf(src: Source): { w: number; h: number } {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight };
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight };
  return { w: src.width, h: src.height };
}

function toFrame(
  res: { landmarks: { x: number; y: number; z: number; visibility?: number }[][]; segmentationMasks?: { width: number; height: number; getAsFloat32Array(): Float32Array }[] },
  w: number,
  h: number,
  withMask: boolean,
): PoseFrame | null {
  const lms = res.landmarks?.[0];
  if (!lms || lms.length < 33) return null;
  const pts: Pt[] = lms.map((p) => ({ x: p.x * w, y: p.y * h, z: p.z * w, v: p.visibility ?? 1 }));
  let mask: SegMask | undefined;
  if (withMask && res.segmentationMasks?.[0]) {
    const m = res.segmentationMasks[0];
    mask = { w: m.width, h: m.height, data: new Float32Array(m.getAsFloat32Array()) };
  }
  return { w, h, pts, mask };
}

/** 정지 이미지 한 장 분석 (업로드 사진 / 촬영된 사진) */
export async function detectImage(src: Source, opts: { model?: ModelKind; mask?: boolean } = {}): Promise<PoseFrame | null> {
  const model = opts.model ?? 'full';
  const slot = await acquire(model, 'IMAGE', opts.mask ?? true);
  const { w, h } = sizeOf(src);
  // 동기 detect()는 마스크를 복사해 돌려주므로 GPU 텍스처 수명 문제를 피할 수 있습니다.
  const res = slot.lm.detect(src as any);
  try {
    return toFrame(res as any, w, h, slot.mask);
  } finally {
    res.close();
  }
}

export interface VideoTracker {
  detect(video: HTMLVideoElement, now: number): PoseFrame | null;
  readonly delegate: 'GPU' | 'CPU';
}

/** 카메라 영상용 실시간 추적기 */
export async function videoTracker(opts: { model?: ModelKind; mask?: boolean } = {}): Promise<VideoTracker> {
  const model = opts.model ?? 'lite';
  const withMask = opts.mask ?? false;
  const slot = await acquire(model, 'VIDEO', withMask);
  let last = -1;
  return {
    delegate: slot.delegate,
    detect(video, now) {
      if (video.readyState < 2 || !video.videoWidth) return null;
      const ts = Math.max(now, last + 1);
      last = ts;
      let out: PoseFrame | null = null;
      slot.lm.detectForVideo(video, ts, (res) => {
        out = toFrame(res as any, video.videoWidth, video.videoHeight, withMask);
      });
      return out;
    },
  };
}
