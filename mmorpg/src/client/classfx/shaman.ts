// 무녀: spinning paper talismans that burst pink; ult = great ritual blast with petals and a seal stamp.
import type { ClassFx } from './types.ts';

export const shaman: ClassFx = {
  atkDur: 0.3, ultR: 300,
  atk: (c, e) => {
    const to = e.tid ? { kind: 'm' as const, id: e.tid } : { x: e.tx, y: e.ty };
    c.fx.homing({ x: c.x + 10, y: c.y - 32 }, to, 660, 'paper', q => {
      c.fx.ring(q.x, q.y, 8, 62, 0.32, 0xff7ab8, true); c.fx.glow(q.x, q.y, 56, 0xff7ab8, 0.24); c.fx.burst(q.x, q.y, 9, [0xff7ab8, 0xffe07a, 0xffffff], 180, 7, 0.4);
      c.fx.light(q.x, q.y, 120, 0xff7ab8, 0.8, 0.25); if (c.mine) { c.fx.wave(q.x, q.y, 70, 6, 0.35); c.snd.play('hit_magic', 0.6, q.x, q.y); }
    });
    c.snd.play('cast', c.vol, c.x, c.y);
  },
  ult: (c, e) => {
    c.fx.later(0.35, () => {
      c.fx.ring(e.x, e.y, 30, 340, 0.55, 0xffe07a, false, 0); c.fx.glow(e.x, e.y - 30, 240, 0xffe07a, 0.5, c.mine ? 0.32 : 0.16); c.fx.burst(e.x, e.y - 20, c.mine ? 44 : 20, [0xffe07a, 0xff7ab8, 0xffffff], 460, 8, 0.8);
      c.fx.debris(e.x, e.y - 20, 24, 'petal', [0xff9ac8, 0xffe07a, 0xffffff], 320, 8, 1.4); c.fx.stamp(e.x, e.y - 50, 110, 0.9);
      if (c.mine) { c.fx.shake(0.6); c.fx.wave(e.x, e.y, 360, 26, 0.9); c.fx.flash(0xfff0c0, 0.3); } c.snd.play('boom', 0.8, e.x, e.y);
    });
  },
};
