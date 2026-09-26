// Installable web app ("앱처럼 설치"): registers the offline service worker when served over http(s).
// The single-file build opened from disk (file://) skips this silently.
export function registerPwa(): void {
  try {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
    if ((import.meta as any).env?.DEV) return;
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* offline install is optional */ }); });
  } catch { /* ignore */ }
}

/** Draws the app icon (used by scripts/icons.mjs to generate the PNG icons). */
export async function iconDataUrl(size: number, maskable: boolean): Promise<string> {
  const { drawCharacter } = await import('../render/characters');
  const { CHARACTERS } = await import('../data/characters');
  const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
  const g = cv.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, size); grd.addColorStop(0, '#3b2b86'); grd.addColorStop(0.65, '#c2457a'); grd.addColorStop(1, '#ff9f6b');
  g.fillStyle = grd;
  if (maskable) g.fillRect(0, 0, size, size);
  else { const r = size * 0.22; g.beginPath(); g.moveTo(r, 0); g.arcTo(size, 0, size, size, r); g.arcTo(size, size, 0, size, r); g.arcTo(0, size, 0, 0, r); g.arcTo(0, 0, size, 0, r); g.closePath(); g.fill(); }
  const k = (maskable ? 0.62 : 0.78) * size / 100;
  g.translate(size / 2, size * (maskable ? 0.74 : 0.84)); g.scale(k, k);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(0, 2, 26, 6, 0, 0, Math.PI * 2); g.fill();
  const c = CHARACTERS[0];
  drawCharacter(g, 'disc', c.palette, { state: 'jump', t: 0.4, runPhase: 0.2, spin: 0, squash: 1, hurt: false, alpha: 1 });
  return cv.toDataURL('image/png');
}
