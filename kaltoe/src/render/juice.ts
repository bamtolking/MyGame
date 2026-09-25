// 손맛(시각 연출): 시뮬레이션 이벤트 → 효과(fx). 소리는 platform/sfx.ts, 토스트·배너 같은 UI는 ui/app.ts가 맡는다.
import { ENEMY } from '../content';
import type { SimEvent, World } from '../sim/types';
import type { Fx } from './fx';
import { vibrate } from '../platform/audio';

export interface JuiceOpts { vibrate: boolean }

export function juiceEvent(fx: Fx, ev: SimEvent, w: World, o: JuiceOpts) {
  switch (ev.t) {
    case 'hit': fx.dmg(ev.x, ev.y, ev.dmg, ev.crit, ev.uid); break;
    case 'kill': {
      const col = ENEMY.get(ev.id)?.tint ?? '#ffffff';
      if (ev.boss) {
        fx.burst(ev.x, ev.y, '#ffd84d', 60, 420, 5, 2, 200); fx.burst(ev.x, ev.y, col, 40, 300, 4, 0);
        fx.addShake(0.9); fx.addFlash(0.6); vibrate(o.vibrate, [60, 40, 120]);
        fx.text(ev.x, ev.y - 30, '격파!', '#ffd84d', 26, 1.6);
      } else if (ev.elite) {
        fx.burst(ev.x, ev.y, '#ffd84d', 26, 300, 4, 2, 200); fx.addShake(0.35);
      } else {
        fx.burst(ev.x, ev.y, col, 5, 140, 3, 2, 260);
      }
      break;
    }
    case 'hurt': fx.addShake(0.22); fx.addFlash(0.22, '#ff2244'); vibrate(o.vibrate, 25); break;
    case 'explode': fx.boom(ev.x, ev.y, ev.r, ev.color, ev.big); if (ev.big) fx.addShake(0.3); break;
    case 'item': {
      const p = w.player;
      const label: Record<string, string> = { coffee: '☕ 커피 수혈! +30', chicken: '🍗 치킨! 체력 완전 회복', magnet: '🧲 결재 도장 싹쓸이!', bomb: '💣 부서 대청소!', clock: '⏰ 시간 정지!', chest: '📦 택배 수령!' };
      if (label[ev.kind]) fx.text(p.x, p.y - 30, label[ev.kind], '#fff', 13, 1.3);
      if (ev.kind === 'bomb') { fx.addFlash(0.5, '#ffae00'); fx.addShake(0.5); }
      break;
    }
    case 'levelup': fx.text(w.player.x, w.player.y - 34, 'LEVEL UP!', '#7dffb3', 16, 1); fx.burst(w.player.x, w.player.y, '#7dffb3', 18, 200, 3, 1); break;
    case 'bossSpawn': vibrate(o.vibrate, [100, 60, 100]); break;
    case 'ult': fx.addFlash(0.7, '#ffffff'); fx.addShake(0.8); vibrate(o.vibrate, [50, 30, 90]); break;
    case 'evolve': fx.addFlash(0.5, '#e4b8ff'); fx.burst(w.player.x, w.player.y, '#e4b8ff', 40, 300, 4, 1); break;
    case 'revive': fx.addFlash(0.8); break;
    case 'chain': fx.bolt(ev.pts, ev.color); break;
    default: break;
  }
}

/** 판 끝(사망) 연출 */
export function juiceDeath(fx: Fx) { fx.addFlash(0.6, '#000000'); }
