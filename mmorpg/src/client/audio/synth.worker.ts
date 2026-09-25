// Renders audio samples off the main thread so the game never stalls while sounds are being built.
import { renderKey } from './render.ts';
const ctx = self as unknown as { onmessage: ((e: MessageEvent) => void) | null; postMessage(m: unknown, t?: Transferable[]): void };
ctx.onmessage = (e: MessageEvent) => {
  const key = e.data?.key as string;
  try { const s = renderKey(key); ctx.postMessage({ key, l: s.l, r: s.r }, [s.l.buffer, s.r.buffer]); }
  catch (err) { ctx.postMessage({ key, error: String(err) }); }
};
