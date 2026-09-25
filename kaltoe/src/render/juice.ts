// 손맛(시각 연출): 시뮬레이션 이벤트 → 효과(fx). 소리는 platform/sfx.ts, 토스트·배너 같은 UI는 ui/app.ts가 맡는다.
// fx의 월드 효과(불꽃·폭발·색종이…)와 카메라·화면 연출(흔들림·킥·줌·번쩍임)을 여기서 조합한다.
// demo: 타이틀 뒤 자동 플레이 — 적중·처치·폭발·번개의 월드 효과만(카메라·화면·진동 없음).
import { ENEMY } from '../content';
import type { Enemy, SimEvent, World } from '../sim/types';
import type { Fx } from './fx';
import { vibrate } from '../platform/audio';

export interface JuiceOpts { vibrate: boolean; demo?: boolean }

const ULT_COLOR: Record<string, string> = { blast: '#ffffff', freeze: '#8fe3ff', rain: '#ffd84d', shield: '#7dd3ff', vacuum: '#c77dff', clone: '#ff7de9' };
const ITEM_LABEL: Record<string, string> = { coffee: '☕ 커피 수혈! +30', chicken: '🍗 치킨! 체력 완전 회복', magnet: '🧲 결재 도장 싹쓸이!', bomb: '💣 부서 대청소!', clock: '⏰ 시간 정지!', chest: '📦 택배 수령!' };

// 적중 이벤트에는 무기·방향 정보가 없다 → uid로 적을 찾아 마지막으로 때린 무기 색과 맞은 방향을 쓴다(프레임마다 한 번만 다시 채움)
const byUid = new Map<number, Enemy>();
let mapW: World | null = null, mapStep = -1;
function enemyOf(w: World, uid: number): Enemy | undefined {
  if (mapW !== w || mapStep !== w.step) {
    byUid.clear();
    for (const e of w.enemies) byUid.set(e.uid, e);
    mapW = w; mapStep = w.step;
  }
  return byUid.get(uid);
}
function hitColor(w: World, e: Enemy): string {
  const s = e.lastHitSlot;
  if (s === 6) return '#ff9ef0';        // 궁극기
  if (s < 0 || s > 5) return '#ffae00'; // 폭탄·장판 등
  for (const wi of w.weapons) if (wi.slot === s) return wi.def.color;
  return '#ffffff';
}

export function juiceEvent(fx: Fx, ev: SimEvent, w: World, o: JuiceOpts) {
  const demo = !!o.demo;
  const p = w.player;
  switch (ev.t) {
    case 'hit': {
      const e = enemyOf(w, ev.uid);
      if (e) {
        // 불꽃은 적 몸의 플레이어 쪽 가장자리에서 맞은 방향(플레이어→적)으로 튄다
        const dx = e.x - p.x, dy = e.y - p.y, L = Math.hypot(dx, dy) || 1;
        fx.hit(e.x - (dx / L) * e.r * 0.6, e.y - (dy / L) * e.r * 0.6, dx, dy, hitColor(w, e), ev.crit);
      } else fx.hit(ev.x, ev.y, ev.x - p.x, ev.y - p.y, '#ffffff', ev.crit);
      if (ev.crit && !demo) fx.addShake(0.05, 0.15);
      fx.dmg(ev.x, ev.y, ev.dmg, ev.crit, ev.uid);
      break;
    }
    case 'kill': {
      const d = ENEMY.get(ev.id), col = d?.tint ?? '#ffffff', r = d?.radius ?? 12;
      if (ev.boss) {
        fx.bossKill(ev.x, ev.y, col, r);
        if (demo) break;
        fx.title(ev.x, ev.y - r - 20, '격파!', '#ffd84d', 32, 1.7);
        fx.addFlash(0.6); fx.addShake(0.95); fx.punch(0.07, 0.75); fx.kickRand(14);
        vibrate(o.vibrate, [60, 40, 120]);
      } else if (ev.elite) {
        fx.eliteKill(ev.x, ev.y, col, r);
        if (demo) break;
        fx.addShake(0.35); fx.punch(0.025, 0.35); fx.impact(ev.x, ev.y, 60, true);
      } else fx.kill(ev.x, ev.y, col, r);
      break;
    }
    case 'explode':
      fx.explode(ev.x, ev.y, ev.r, ev.color, ev.big);
      if (!demo) fx.impact(ev.x, ev.y, ev.r, ev.big);
      break;
    case 'chain': fx.bolt(ev.pts, ev.color); break;
    default: if (!demo) juiceOther(fx, ev, w, o); break;
  }
}

/** 플레이어 중심의 연출(데모에서는 쓰지 않음) */
function juiceOther(fx: Fx, ev: SimEvent, w: World, o: JuiceOpts) {
  const p = w.player;
  switch (ev.t) {
    case 'hurt': fx.hurt(p.x, p.y); fx.hurtScreen(); vibrate(o.vibrate, 25); break;
    case 'item': {
      const label = ITEM_LABEL[ev.kind];
      if (label) fx.text(p.x, p.y - 32, label, '#ffffff', 13, 1.3);
      switch (ev.kind) {
        case 'coffee': fx.heal(p.x, p.y, false); break;
        case 'chicken': fx.heal(p.x, p.y, true); fx.pulse('gold', 0.6); break;
        case 'magnet': fx.magnet(p.x, p.y); break;
        case 'bomb': fx.addFlash(0.5, '#ffae00'); fx.addShake(0.5); fx.shockScreen(p.x, p.y, '#ffae00'); fx.punch(0.04, 0.45); break;
        case 'clock': fx.clock(p.x, p.y); fx.addFlash(0.3, '#9fe8ff'); fx.shockScreen(p.x, p.y, '#7fe8ff', 0.7); fx.pulse('cyan', 1); break;
        case 'chest': fx.sparkle(p.x, p.y, '#ffd84d', 16, 60); break;
      }
      break;
    }
    case 'gem': fx.glint(p.x, p.y, '#7df9ff'); break;
    case 'coin': fx.glint(p.x, p.y, '#ffd84d'); break;
    case 'levelup':
      fx.levelUp(p.x, p.y);
      fx.title(p.x, p.y - 38, 'LEVEL UP!', '#7dffb3', 22, 1.1);
      fx.punch(0.02, 0.3);
      break;
    case 'bossSpawn': fx.bossIntro(); vibrate(o.vibrate, [100, 60, 100]); break;
    case 'elite': fx.pulse('gold', 0.8); break;
    case 'ult': {
      const col = ULT_COLOR[w.ultimate.kind] ?? '#ffffff';
      fx.ult(p.x, p.y, col); fx.ultScreen(p.x, p.y, col);
      vibrate(o.vibrate, [50, 30, 90]);
      break;
    }
    case 'evolve': fx.evolve(p.x, p.y); fx.addFlash(0.5, '#e4b8ff'); fx.punch(0.04, 0.5); fx.title(p.x, p.y - 40, '진화!', '#e4b8ff', 26, 1.4); break;
    case 'revive': fx.revive(p.x, p.y); fx.addFlash(0.8); fx.punch(0.05, 0.6); fx.title(p.x, p.y - 40, '부활!', '#ffe9a0', 26, 1.4); break;
    case 'maxed': fx.sparkle(p.x, p.y, '#ffd84d', 10, 40); break;
    case 'clear': fx.celebrate(p.x, p.y); fx.addFlash(0.35, '#fff2c0'); fx.pulse('gold', 1.4); break;
    case 'yageun': fx.pulse('red', 1.4); fx.addShake(0.2); break;
    default: break;
  }
}

/** 판 끝(사망) 연출 */
export function juiceDeath(fx: Fx) { fx.death(); }
