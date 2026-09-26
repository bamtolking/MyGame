// Placeholder look used until a class has its own art: plain robe in the class colour, headband, staff.
import { INK, vol, rrect, fillC, inkLine, shade } from '../core.ts';
import { type ClassLook, pose, WALK } from '../rig.ts';

export function stubLook(color: string): ClassLook {
  return {
    pal: { robe: shade(color, -0.35), lining: '#efe8da', sash: color, pants: '#2a2436', shoe: '#1a1420', skin: '#ffe0c4', hair: '#1a1524', iris: '#6a5a8a', cuff: shade(color, -0.55) },
    frames: {
      idle0: pose({}), idle1: pose({ bob: 1 }), blink: pose({ eyes: 'blink' }),
      walk0: pose(WALK(-1.6, 0.5, 1)), walk1: pose(WALK(0, 0.05, 0)), walk2: pose(WALK(-1.6, -0.5, -1)), walk3: pose(WALK(0, -0.05, 0)),
      atk0: pose({ lean: -0.12, armF: -2.2, eyes: 'fierce' }), atk1: pose({ lean: 0.2, armF: 1.4, eyes: 'fierce', legF: 0.5, legB: -0.4 }), atk2: pose({ lean: 0.1, armF: 1.9, eyes: 'fierce' }),
      hurt: pose({ lean: -0.28, bob: 1.5, armF: -0.9, armB: -1.1, eyes: 'hurt' }),
    },
    hat: (c, _P, _p, hx, hy) => { rrect(c, hx - 15, hy - 11, 31, 5, 2); fillC(c, color, INK, 1.4); },
    hand: (c, _P, _p, back) => { if (!back) inkLine(c, [0, 4, 0, -30], '#7a5a3a', 3); },
    weaponIcon: (c, tc) => { rrect(c, 21, 6, 6, 36, 3); vol(c, tc, 21, 6, 27, 42, 1.6); },
  };
}
