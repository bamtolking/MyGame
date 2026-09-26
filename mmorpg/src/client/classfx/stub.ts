// Placeholder effects until a class has its own: a coloured bolt to the target and a burst on ult sub-hits.
import type { ClassFx } from './types.ts';

export function stubFx(): ClassFx {
  return {
    atkDur: 0.3,
    atk: (c, e) => { c.fx.bolt(c.x, c.y - 24, e.tx, e.ty - 10, c.col, 5, 0.18, 10); c.snd.play('cast', c.vol * 0.7, c.x, c.y); },
    ult: (c, e) => { c.fx.ring(e.x, e.y, 20, 260, 0.6, c.col, true, 0); },
    uhit: (c, e) => { c.fx.glow(e.x, e.y, 60, c.col, 0.3); c.fx.sparks(e.x, e.y, 8, c.col, 360); if (e.x2 != null && e.y2 != null) c.fx.bolt(e.x, e.y, e.x2, e.y2, c.col, 8, 0.25, 6); },
  };
}
