// 인게임 HUD: 경험치바·시계(하루 진행선)·레벨·처치/월급·무기 슬롯·보스 체력·궁극기 버튼
import { BALANCE } from '../content';
import type { World } from '../sim/types';
import { clockText } from '../sim/director';
import { evolvable } from '../sim/levelup';
import { maxLevelOf } from '../sim/stats';
import { h, clear } from './dom';

export class Hud {
  root: HTMLElement;
  private xp: HTMLElement;
  private clock: HTMLElement;
  private dayFill: HTMLElement;
  private lvl: HTMLElement;
  private kills: HTMLElement;
  private coins: HTMLElement;
  private wslots: HTMLElement;
  private pslots: HTMLElement;
  private boss: HTMLElement;
  private bossName: HTMLElement;
  private bossFill: HTMLElement;
  ultBtn: HTMLButtonElement;
  private ultRing: SVGCircleElement;
  private ultLbl: HTMLElement;
  pauseBtn: HTMLButtonElement;
  private comboEl: HTMLElement;
  private cache = new Map<string, string>();
  private slotKey = '';

  constructor(parent: HTMLElement, onUlt: () => void, onPause: () => void) {
    this.xp = h('i');
    this.clock = h('div', { class: 't' }, '09:00');
    this.dayFill = h('i');
    const marks = [
      h('b', { style: `left:${(BALANCE.lunchAt / BALANCE.runSeconds) * 100}%;background:#3ddc97` }),
      h('b', { style: `left:${(BALANCE.finalBossAt / BALANCE.runSeconds) * 100}%;background:#ff5a5f` }),
    ];
    this.lvl = h('div', { class: 'lvl' }, 'Lv 1');
    this.kills = h('div', { class: 'chip' }, '💀 0');
    this.coins = h('div', { class: 'chip coin' }, '₩ 0');
    this.wslots = h('div', { class: 'srow' });
    this.pslots = h('div', { class: 'srow' });
    this.bossName = h('div', { class: 'name' });
    this.bossFill = h('i');
    this.boss = h('div', { class: 'bossbar hidden' }, this.bossName, h('div', { class: 'b' }, this.bossFill));
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 84 84');
    const bg = document.createElementNS(NS, 'circle');
    bg.setAttribute('cx', '42'); bg.setAttribute('cy', '42'); bg.setAttribute('r', '38');
    bg.setAttribute('fill', 'none'); bg.setAttribute('stroke', 'rgba(255,255,255,.15)'); bg.setAttribute('stroke-width', '6');
    this.ultRing = document.createElementNS(NS, 'circle');
    this.ultRing.setAttribute('cx', '42'); this.ultRing.setAttribute('cy', '42'); this.ultRing.setAttribute('r', '38');
    this.ultRing.setAttribute('fill', 'none'); this.ultRing.setAttribute('stroke', '#ff7ae0'); this.ultRing.setAttribute('stroke-width', '6');
    this.ultRing.setAttribute('stroke-linecap', 'round');
    this.ultRing.setAttribute('stroke-dasharray', String(2 * Math.PI * 38));
    svg.appendChild(bg); svg.appendChild(this.ultRing);
    this.ultLbl = h('span', { class: 'lbl' });
    this.ultBtn = h('button', { class: 'ult', type: 'button', 'aria-label': '궁극기' }) as HTMLButtonElement;
    this.ultBtn.appendChild(svg);
    this.ultBtn.appendChild(h('span', { class: 'ic' }, '📄'));
    this.ultBtn.appendChild(this.ultLbl);
    this.ultBtn.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); onUlt(); });
    this.pauseBtn = h('button', { class: 'btn icon ghost pausebtn', type: 'button', 'aria-label': '일시정지' }, '⏸') as HTMLButtonElement;
    this.pauseBtn.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); onPause(); });

    this.comboEl = h('div', { class: 'combo hidden' });
    this.root = h('div', { class: 'hud' },
      this.comboEl,
      h('div', { class: 'xpbar' }, this.xp),
      h('div', { class: 'hud-top' },
        h('div', { class: 'clock' }, this.clock, h('div', { class: 'dayline' }, this.dayFill, ...marks)),
        this.lvl,
        h('div', { class: 'hud-right' }, h('div', { class: 'hud-stats' }, this.kills, this.coins)),
      ),
      h('div', { class: 'slots' }, this.wslots, this.pslots),
      this.boss,
      this.pauseBtn,
      this.ultBtn,
    );
    parent.appendChild(this.root);
  }

  private set(el: HTMLElement, key: string, text: string) {
    if (this.cache.get(key) === text) return;
    this.cache.set(key, text);
    el.textContent = text;
  }

  setCombo(n: number) {
    if (n < 15) { if (!this.comboEl.classList.contains('hidden')) this.comboEl.classList.add('hidden'); return; }
    this.comboEl.classList.remove('hidden');
    this.set(this.comboEl, 'combo', `🔥 ${n} 연속`);
    const lvl = n >= 700 ? 3 : n >= 300 ? 2 : n >= 100 ? 1 : 0;
    this.comboEl.dataset.lv = String(lvl);
  }

  setUltIcon(icon: string, name: string) {
    const ic = this.ultBtn.querySelector('.ic');
    if (ic) ic.textContent = icon;
    this.ultLbl.textContent = name;
  }

  update(w: World) {
    const p = w.player;
    this.xp.style.width = `${Math.min(100, (p.xp / p.xpNext) * 100)}%`;
    this.set(this.clock, 'clock', clockText(w));
    const yg = w.yageun && !w.cleared;
    this.clock.classList.toggle('yageun', yg);
    this.dayFill.style.width = `${Math.min(100, (w.t / BALANCE.runSeconds) * 100)}%`;
    this.set(this.lvl, 'lvl', `Lv ${p.level}`);
    this.set(this.kills, 'kills', `💀 ${w.stats_.kills.toLocaleString('ko-KR')}`);
    this.set(this.coins, 'coins', `₩ ${Math.floor(w.stats_.coins).toLocaleString('ko-KR')}`);
    // 슬롯
    const evo = new Set(evolvable(w).map(x => x.def.id));
    const key = w.weapons.map(x => `${x.def.id}:${x.level}:${evo.has(x.def.id) ? 1 : 0}`).join(',') + '|' + w.passives.map(x => `${x.def.id}:${x.level}`).join(',');
    if (key !== this.slotKey) {
      this.slotKey = key;
      clear(this.wslots); clear(this.pslots);
      for (const wi of w.weapons) {
        const max = wi.level >= maxLevelOf(wi.def);
        const cls = `slot${wi.def.evolved ? ' evo' : max ? ' max' : ''}${evo.has(wi.def.id) ? ' ready' : ''}`;
        this.wslots.appendChild(h('div', { class: cls }, wi.def.icon, h('b', null, wi.def.evolved ? '★' : max ? 'M' : String(wi.level))));
      }
      for (const pi of w.passives) {
        const max = pi.level >= pi.def.maxLevel;
        this.pslots.appendChild(h('div', { class: `slot${max ? ' max' : ''}` }, pi.def.icon, h('b', null, max ? 'M' : String(pi.level))));
      }
    }
    // 보스
    const b = w.bossAlive;
    if (b && !b.dead) {
      this.boss.classList.remove('hidden');
      this.set(this.bossName, 'bossn', `${b.def.name}${b.enraged ? ' 💢격노' : ''}`);
      this.bossFill.style.width = `${Math.max(0, (b.hp / b.maxHp) * 100)}%`;
    } else this.boss.classList.add('hidden');
    // 궁극기
    const k = Math.min(1, p.ult / p.ultMax);
    const C = 2 * Math.PI * 38;
    this.ultRing.setAttribute('stroke-dashoffset', String(C * (1 - (p.ultActiveT > 0 ? 1 : k))));
    this.ultBtn.classList.toggle('ready', k >= 1 && p.ultActiveT <= 0);
  }
}
