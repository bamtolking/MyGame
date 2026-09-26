// Dev contact sheet: every sprite, monster frame/state, prop, FX texture and UI icon on one page (npm run dev → /dev/art.html).
import { Art } from '../src/client/render/art/index.ts';
import { FRAME_NAMES } from '../src/client/render/art/rig.ts';
import { CLASS_IDS } from '../src/shared/data/classes.ts';
import { MON_ART } from '../src/client/render/art/mons.ts';
import { PROP_ART } from '../src/client/render/art/props.ts';
import { FX_ART } from '../src/client/render/art/fxtex.ts';
import { classIcon, monIcon, npcIcon, talIcon, itemIcon } from '../src/client/render/art/icons.ts';
import { TAL_KINDS } from '../src/shared/data/talismans.ts';
import type { Tex } from '../src/client/render/art/core.ts';

const Z = Number(new URLSearchParams(location.search).get('z') ?? 2);
const art = new Art(); art.setScale(Z); art.budgetMs = 1e9;
const cv = document.getElementById('cv') as HTMLCanvasElement; const W = 1600; cv.width = W * 1; cv.height = 3400; const c = cv.getContext('2d')!;
c.fillStyle = '#26304a'; c.fillRect(0, 0, cv.width, cv.height);
let x = 10, y = 30, rowH = 0;
const label = (s: string) => { c.fillStyle = '#9ab'; c.font = '11px system-ui'; c.fillText(s, x, y - 4); };
const nl = () => { x = 10; y += rowH + 26; rowH = 0; };
const put = (t: Tex, name: string, scale = 1) => {
  const w = t.w * scale, h = t.h * scale; if (x + w > W - 10) nl();
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y, w, h);
  c.drawImage(t.cv, x, y, w, h); c.fillStyle = '#f55'; c.fillRect(x + t.ax * w - 2, y + t.ay * h - 1, 4, 2); label(name); x += w + 12; rowH = Math.max(rowH, h);
};
const only = new URLSearchParams(location.search).get('cls');
for (const cls of CLASS_IDS.filter(c => !only || c === only)) { for (const f of FRAME_NAMES) put(art.player(cls, f), `${cls} ${f}`, only ? 3 : 1.5); nl(); }
for (const k of ['smith', 'talshop', 'priest', 'board']) for (let f = 0; f < 3; f++) put(art.npc(k, f), `${k}${f}`, 1.5);
nl();
for (const k of Object.keys(MON_ART)) { const a = MON_ART[k]; for (let f = 0; f < a.frames; f++) put(art.mon(k, f, 'm'), `${k} ${f}`); put(art.mon(k, 0, 'w'), `${k} w`); put(art.mon(k, 0, 'd'), `${k} d`); }
nl();
for (const k of Object.keys(PROP_ART)) for (let v = 0; v < 3; v++) put(art.prop(k, v), `${k}${v}`);
nl(); put(art.house(4, 3, 0), 'house 4x3'); put(art.house(3, 2, 1), 'house 3x2'); put(art.house(4, 2, 2), 'house 4x2');
nl(); c.fillStyle = '#000'; c.fillRect(0, y - 20, W, 700);
for (const k of Object.keys(FX_ART)) put(art.fx(k), k, Math.min(1.5, 128 / Math.max(FX_ART[k].w, FX_ART[k].h)));
nl();
const icons = [...CLASS_IDS.map(c => classIcon(c)), ...['smith', 'talshop', 'priest', 'board'].map(npcIcon), ...Object.keys(MON_ART).map(monIcon), ...TAL_KINDS.map(talIcon),
  ...(['weapon', 'armor', 'charm'] as const).flatMap(s => [0, 2, 4].map(r => itemIcon(s, 'sword', r, r))), ...CLASS_IDS.map(c => itemIcon('weapon', c, 3, 3))];
let loaded = 0; const imgs = icons.map(u => { const im = new Image(); im.onload = () => { if (++loaded === icons.length) done(); }; im.src = u; return im; });
function done() { for (const im of imgs) { if (x + 64 > W) nl(); c.drawImage(im, x, y, 64, 64); x += 70; rowH = 64; } nl(); (window as any).__done = true; }
