// Sample keys → DSP recipes. Shared by the synth worker and the main-thread fallback.
import { SFX } from './sfx.ts';
import { DRUMS, gayageum, geomungo } from './kit.ts';
import { reverbIR, type Sample } from './synth.ts';

export function renderKey(key: string): Sample {
  const i = key.indexOf(':'); const kind = key.slice(0, i), arg = key.slice(i + 1);
  if (kind === 'sfx' && SFX[arg]) return SFX[arg]();
  if (kind === 'drum' && DRUMS[arg]) return DRUMS[arg]();
  if (kind === 'gay') return gayageum(Number(arg));
  if (kind === 'geo') return geomungo(Number(arg));
  if (kind === 'ir') return reverbIR(2.6, 2.2);
  throw new Error('unknown sample ' + key);
}
export const hasKey = (key: string): boolean => { const [k, a] = key.split(':'); return (k === 'sfx' && !!SFX[a]) || (k === 'drum' && !!DRUMS[a]) || k === 'gay' || k === 'geo' || k === 'ir'; };
