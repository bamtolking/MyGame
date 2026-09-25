// 공유: 가능하면 시스템 공유 시트, 안 되면 클립보드 복사. 스토어 출시 후 링크를 SHARE_URL에 넣는다.
export const SHARE_URL = '';

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

export async function shareText(text: string, image?: HTMLCanvasElement): Promise<ShareResult> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const full = SHARE_URL ? `${text}\n${SHARE_URL}` : text;
  if (typeof nav.share === 'function') {
    try {
      if (image && nav.canShare) {
        const blob = await new Promise<Blob | null>(res => image.toBlob(b => res(b), 'image/png'));
        if (blob) {
          const file = new File([blob], 'nyangche.png', { type: 'image/png' });
          if (nav.canShare({ files: [file] })) { await nav.share({ files: [file], text: full }); return 'shared'; }
        }
      }
      await nav.share({ text: full });
      return 'shared';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled';
      // 공유가 막힌 환경이면 복사로 넘어간다
    }
  }
  return (await copyText(full)) ? 'copied' : 'failed';
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }
}

export function vibrate(pattern: number | number[]): void {
  try { navigator.vibrate?.(pattern); } catch { /* 지원 안 함 */ }
}
