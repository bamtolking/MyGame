// Landscape-only layout. In a portrait viewport (e.g. a phone with rotation lock) the whole #app is rotated 90° clockwise
// (html.rot, see style.css): content "up" = screen right, so the player holds the phone sideways with the notch on the left.
// Pointer coordinates are viewport (screen) coordinates; toLocal() maps them into #app's own, unrotated space.
let rot = false, vw = 0, vh = 0; const subs: (() => void)[] = [];
/** While a text field is focused the on-screen keyboard may shrink the viewport — never flip the layout under the user's thumbs. */
const typing = () => { const a = document.activeElement; return (a instanceof HTMLInputElement && a.type === 'text') || a instanceof HTMLTextAreaElement; };

export function applyOrient(force = false): void {
  if (!force && typing()) return;
  const w = window.innerWidth, h = window.innerHeight; if (!w || !h) return;
  const r = h > w; const changed = r !== rot || w !== vw || h !== vh; rot = r; vw = w; vh = h;
  const de = document.documentElement; de.classList.toggle('rot', r); de.style.setProperty('--vw', `${w}px`); de.style.setProperty('--vh', `${h}px`);
  if (changed) for (const f of subs) f();
}
export function initOrient(): void {
  applyOrient(true);
  window.addEventListener('resize', () => applyOrient());
  window.addEventListener('orientationchange', () => { applyOrient(); setTimeout(() => applyOrient(), 350); }); // iOS reports the new size late
  document.addEventListener('focusout', () => setTimeout(() => applyOrient(), 80));
}
/** Called after the layout (rotation or size) changed. */
export function onOrient(f: () => void): void { subs.push(f); }
export const rotated = (): boolean => rot;
/** Size of #app's content box (landscape: width ≥ height). */
export function appSize(): [number, number] { return rot ? [vh, vw] : [vw, vh]; }
/** Viewport (clientX/clientY) → #app-local coordinates. */
export function toLocal(x: number, y: number): [number, number] {
  const app = document.getElementById('app'); const r = app?.getBoundingClientRect();
  if (!r) return [x, y];
  return rot ? [y - r.top, r.right - x] : [x - r.left, y - r.top];
}

const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** On a touch phone/tablet (not iOS, which supports neither), go fullscreen and lock to landscape. Must run inside a user gesture. */
export function goLandscape(): void {
  try {
    if (isIOS() || !matchMedia('(pointer: coarse)').matches || document.fullscreenElement || !document.documentElement.requestFullscreen) return;
    document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape'))
      .catch(() => { /* not allowed: the rotated layout still works */ });
  } catch { /* ignore */ }
}
