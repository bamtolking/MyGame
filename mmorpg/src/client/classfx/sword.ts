// 검객: alternating ink-and-light crescent slashes; ult = spinning whirlwind around the swordsman.
import { CLASSES } from '../../shared/data/classes.ts';
import { EMIT } from '../render/paint.ts';
import type { ClassFx } from './types.ts';

export const sword: ClassFx = {
  atkDur: 0.26,
  atk: (c, _e, ang) => {
    const dir = c.n % 2 ? 1 : -1;
    c.fx.slash(c.x, c.y - 18, ang, CLASSES.sword.range, 0x9fd0ff, c.ult, dir); c.snd.play(dir > 0 ? 'slash' : 'slash2', c.vol, c.x, c.y);
    if (c.mine) c.fx.zoomPunch(0.004);
  },
  ult: (c, e) => { c.fx.burst(e.x, e.y - 20, 30, [0x9fd0ff, 0xffffff], 520, 9, 0.5, 'spark', 0, 0.004); },
  aura: (p, art, t, x, y) => {
    const w = art.fx('whirl'); p.draw(EMIT, w, x, y - 14, 300 / 128, 300 / 128 * 0.8, t * 16, 0x9fd0ff, 0.85, 1);
    p.draw(EMIT, w, x, y - 14, 200 / 128, 200 / 128 * 0.8, -t * 11 + 1, 0xffffff, 0.6, 1);
  },
};
