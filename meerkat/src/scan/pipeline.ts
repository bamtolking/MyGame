import { analyzeFront, analyzeSide, classifyView, type ViewKind } from '../analysis/analyze';
import { buildReport } from '../analysis/report';
import { idb } from '../lib/idb';
import { canvasToBlob } from '../pose/camera';
import type { PoseFrame } from '../pose/landmarks';
import { age, profile, saveScan, uid, type ScanRecord } from '../state/store';

export interface Shot {
  canvas: HTMLCanvasElement;
  frame: PoseFrame;
}

/** 캔버스(사진)에서 정밀 모델로 포즈 검출 */
export async function detectOnCanvas(canvas: HTMLCanvasElement): Promise<PoseFrame | null> {
  const { detectImage } = await import('../pose/engine');
  return detectImage(canvas, { model: 'full', mask: true });
}

export function viewOf(frame: PoseFrame | null): ViewKind {
  return frame ? classifyView(frame).view : 'none';
}

/** 촬영/업로드된 사진으로 리포트를 만들고 저장 */
export async function finalizeScan(shots: { front?: Shot; side?: Shot }): Promise<ScanRecord> {
  const heightCm = profile.value.heightCm ?? undefined;
  const front = shots.front ? analyzeFront(shots.front.frame, { heightCm }) : null;
  const side = shots.side ? analyzeSide(shots.side.frame, { heightCm }) : null;
  const report = buildReport(front, side, { age: age.value });
  const id = uid();
  const hasPhoto = { front: false, side: false };
  for (const view of ['front', 'side'] as const) {
    const s = shots[view];
    if (!s) continue;
    try {
      await idb.put(`${id}:${view}`, await canvasToBlob(s.canvas));
      hasPhoto[view] = true;
    } catch (e) {
      console.warn('[scan] photo save failed', e);
    }
  }
  const rec: ScanRecord = {
    id,
    at: Date.now(),
    heightCm: profile.value.heightCm,
    age: age.value,
    front,
    side,
    report,
    size: {
      front: shots.front ? [shots.front.canvas.width, shots.front.canvas.height] : undefined,
      side: shots.side ? [shots.side.canvas.width, shots.side.canvas.height] : undefined,
    },
    hasPhoto,
  };
  saveScan(rec);
  return rec;
}

/** 저장된 사진 불러오기 */
export async function loadPhoto(scanId: string, view: 'front' | 'side'): Promise<string | null> {
  try {
    const blob = await idb.get<Blob>(`${scanId}:${view}`);
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

export async function deletePhotos(scanId: string) {
  await Promise.all([idb.del(`${scanId}:front`), idb.del(`${scanId}:side`)]).catch(() => undefined);
}
