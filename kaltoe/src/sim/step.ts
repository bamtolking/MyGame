// 고정 시간 스텝(1/60초) 시뮬레이션 진입점
import { BALANCE } from '../content';
import type { World } from './types';
import { updatePlayer, updatePickups } from './player';
import { separateEnemies, updateEnemies, updateEnemyBullets } from './enemies';
import { updateDirector } from './director';
import { compact, updateBeams, updateBlasts, updateBullets, updateRings, updateWeapons, updateZones } from './weapons';
import { updateUlt } from './ultimate';
import { openChest, openLevelUp, openLunch } from './levelup';

export const DT = 1 / 60;

export function stepWorld(w: World) {
  if (w.phase !== 'play') return;
  w.step++;
  w.t += DT;
  const rs = w.stats_;

  // 격자 재구성
  w.grid.clear();
  for (const e of w.enemies) if (!e.dead) w.grid.insert(e);

  updatePlayer(w);
  if (!w.wrapUp) updateDirector(w);   // 퇴근 정리 중에는 새 적이 오지 않는다
  updateEnemies(w);
  if (w.phase !== 'play') { compact(w); return; }   // 쓰러지면 그 스텝의 나머지 전투는 없음
  separateEnemies(w);
  updateEnemyBullets(w);
  if (w.phase !== 'play') { compact(w); return; }
  updateWeapons(w);
  updateBullets(w);
  updateBlasts(w);
  updateZones(w);
  if (w.phase !== 'play') { compact(w); return; }
  updateBeams(w);
  updateRings(w);
  updateUlt(w);
  updatePickups(w);
  compact(w);

  // 정각 기록/알림
  if (w.t < BALANCE.runSeconds) {
    const hour = 9 + Math.floor(w.t / (BALANCE.runSeconds / 9));
    if (hour > w.lastHour) {
      w.lastHour = hour;
      rs.levelAt[hour] = w.player.level;
      rs.killsAt[hour] = rs.kills;
      w.events.push({ t: 'hour', hour });
    }
  }
  if (w.overtime) rs.overtimeSec = w.t - w.overtimeStart;

  if (w.phase !== 'play') return; // 사망

  // 18:00 도달
  if (w.t >= BALANCE.runSeconds && !w.cleared) {
    if (w.finalBossDead) {
      if (!w.wrapUp) {
        // 퇴근 정리: 새 적은 멈추고, 바닥의 보석·코인·상자를 모두 끌어오고, 잠깐 무적
        w.wrapUp = true;
        w.clearT = 1.6;
        w.clearHp = w.player.hp / w.d.maxHp;
        w.player.invulnT = Math.max(w.player.invulnT, 4);
        w.events.push({ t: 'toast', text: '18:00 — 퇴근 준비! 책상 정리 중…', kind: 'good' });
      }
      w.clearT = Math.max(0, w.clearT - DT);
      for (const k of w.pickups) if (!k.dead) k.pull = true;
      // 상자·레벨업이 남아 있으면 그것부터 처리한 뒤 퇴근
      if (w.clearT <= 0 && w.chestQueue.length === 0 && w.levelQueue === 0 && !w.pickups.some(k => !k.dead && k.kind === 'chest')) {
        w.cleared = true;
        rs.cleared = true;
        rs.levelAt[18] = w.player.level;
        rs.killsAt[18] = rs.kills;
        w.phase = 'victory';
        w.events.push({ t: 'clear' });
        return;
      }
    } else if (!w.yageun) {
      w.yageun = true;
      w.events.push({ t: 'yageun' });
    }
  }

  // 모달 우선순위: 상자 > 레벨업 > 점심
  if (w.chestQueue.length) {
    const c = w.chestQueue.shift()!;
    openChest(w, c.boss);
  } else if (w.levelQueue > 0) {
    openLevelUp(w);
  } else if (!w.lunchOffered && w.t >= BALANCE.lunchAt) {
    w.lunchOffered = true;
    openLunch(w);
  }
}

/** 칼퇴 후 야근 모드로 계속 */
export function continueOvertime(w: World) {
  if (w.phase !== 'victory') return;
  w.overtime = true;
  w.overtimeStart = w.t;
  w.wrapUp = false;
  w.phase = 'play';
  w.events.push({ t: 'toast', text: '야근 모드 시작… 오늘 집에 갈 수 있을까?', kind: 'warn' });
}

/** 결과 확정(퇴근/사망/포기) */
export function endRun(w: World) {
  w.stats_.maxNoHit = Math.max(w.stats_.maxNoHit, w.player.noHitT);
  for (const wi of w.weapons) w.stats_.weaponDmg[wi.def.id] = Math.round(wi.dmg);
  w.phase = 'over';
}
