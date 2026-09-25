import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from './platform';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** 이미지 공유: 네이티브 공유 시트 → 웹 공유 → 다운로드 순으로 시도 */
export async function shareImage(blob: Blob, filename: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (isNative()) {
    const data = await blobToBase64(blob);
    const res = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
    try {
      await Share.share({ title: text, text, files: [res.uri] });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  download(blob, filename);
  return 'downloaded';
}

export async function shareText(text: string, url?: string): Promise<boolean> {
  try {
    if (isNative()) {
      await Share.share({ text, url });
      return true;
    }
    if (navigator.share) {
      await navigator.share({ text, url });
      return true;
    }
    await navigator.clipboard?.writeText(url ? `${text} ${url}` : text);
    return true;
  } catch {
    return false;
  }
}
