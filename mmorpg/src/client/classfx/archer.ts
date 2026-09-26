// 궁사: glowing arrows with a light trail; ult = arrow rain on the densest crowd.
import type { ClassFx } from './types.ts';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const archer: ClassFx = {
  atkDur: 0.3,
  atk: (c, e, ang) => {
    const to = e.tid ? { kind: 'm' as const, id: e.tid } : { x: e.tx, y: e.ty };
    c.fx.homing({ x: c.x + Math.cos(ang) * 16, y: c.y - 26 }, to, 1100, 'arrow', q => { c.fx.sparks(q.x, q.y, 5, 0xfff2c0, 300, ang, 1.3, 8); c.fx.glow(q.x, q.y, 24, 0xfff0c0, 0.12); if (c.mine) c.snd.play('hit_arrow', 0.7, q.x, q.y); });
    c.snd.play('bow', c.vol, c.x, c.y);
  },
  ult: (c, e) => {
    if (e.tx == null || e.ty == null) return;
    const tx = e.tx, ty = e.ty; c.fx.sigil(tx, ty, 165, 0xa6ff9e, 2.7, 'runes', 1.5, 0.8);
    for (let v = 0; v < 8; v++) c.fx.later(0.3 + v * 0.25, () => {
      for (let k = 0; k < 7; k++) { const x = tx + rnd(-150, 150), y = ty + rnd(-150, 150); c.fx.homing({ x: x - 70, y: y - 420 }, { x, y }, 1500, 'rain', q => { c.fx.sparks(q.x, q.y, 3, 0xc8ffc0, 220, -Math.PI / 2, 1.2, 7); c.fx.decal(q.x, q.y, 'crack', 26, 0x1a2a10, 1.2, 0.35); }); }
      if (c.mine && v % 2 === 0) c.snd.play('bow', 0.6);
    });
  },
};
