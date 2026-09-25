export type Facing = 'user' | 'environment';

export class CameraError extends Error {
  constructor(public kind: 'denied' | 'notFound' | 'insecure' | 'unknown', msg?: string) {
    super(msg ?? kind);
  }
}

export async function startCamera(video: HTMLVideoElement, facing: Facing): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError(window.isSecureContext ? 'notFound' : 'insecure');
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1280 }, frameRate: { ideal: 30 } },
    });
  } catch (e) {
    const name = (e as DOMException).name;
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new CameraError('denied');
    if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new CameraError('notFound');
    throw new CameraError('unknown', String(e));
  }
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  await video.play().catch(() => undefined);
  if (!video.videoWidth) {
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      video.addEventListener('loadedmetadata', done, { once: true });
      setTimeout(done, 3000);
    });
  }
  return stream;
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** 현재 영상 프레임을 캔버스로 (긴 변 maxSide 이하) */
export function snapshot(src: HTMLVideoElement | HTMLImageElement | ImageBitmap, maxSide = 1280): HTMLCanvasElement {
  const w = src instanceof HTMLVideoElement ? src.videoWidth : src instanceof HTMLImageElement ? src.naturalWidth : src.width;
  const h = src instanceof HTMLVideoElement ? src.videoHeight : src instanceof HTMLImageElement ? src.naturalHeight : src.height;
  const k = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement, type = 'image/jpeg', q = 0.86): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, q));
}

export async function fileToCanvas(file: File, maxSide = 1280): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file).catch(async () => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    return img;
  });
  return snapshot(bmp as ImageBitmap | HTMLImageElement, maxSide);
}
