// 인게임 HUD: 경험치바·시계(하루 진행선)·레벨·처치/월급·무기 슬롯·보스 체력·궁극기 버튼
// 매 프레임 갱신은 값이 바뀔 때만, 그리고 transform/CSS 변수만 건드린다(레이아웃 흔들림 없음).
import { BALANCE } from '../content';
import type { World } from '../sim/types';
import { clockText } from '../sim/director';
import { evolvable } from '../sim/levelup';
import { maxLevelOf } from '../sim/stats';
import { h, clear } from './dom';

/** 처치·월급 칩 숫자: 1만부터는 '1.2만'처럼 줄여 360px 폭 휴대폰에서도 윗줄이 한 줄에 들어가게 한다(내림 — 반올림으로 부풀리지 않게) */
export function compactNum(n: number): string {
  const v = Math.max(0, Math.floor(n));
  if (v < 1e4) return v.toLocaleString('ko-KR');
  if (v < 1e8) { const m = v / 1e4; return `${m < 100 ? String(Math.floor(m * 10) / 10) : Math.floor(m).toLocaleString('ko-KR')}만`; }
  return `${Math.floor(v / 1e7) / 10}억`;
}

/** 슬롯 아래 레벨 눈금(최대 레벨만큼, 현재 레벨까지 켜짐) */
function pips(level: number, max: number): HTMLElement {
  const el = h('span', { class: 'sp' });
  for (let i = 0; i < max; i++) el.appendChild(h('i', i < level ? { class: 'on' } : null));
  return el;
}

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
  private bossPct: HTMLElement;
  private bossFill: HTMLElement;
  private bossLag: HTMLElement;
  ultBtn: HTMLButtonElement;
  private ultLbl: HTMLElement;
  pauseBtn: HTMLButtonElement;
  private comboEl: HTMLElement;
  private cache = new Map<string, string>();
  private slotKey = '';
  private slotTick = 0;
  private stage = '';
  private lastXp = -1; private lastDay = -1; private lastBoss = -1; private lastUlt = -1;
  // 보스 흰 잔상 바: 체력이 깎이기 시작하면 잠깐 버티다가 따라 내려간다(JS로 매 프레임 — CSS 지연 전환은 연속 피해 때마다 다시 시작돼 멈춰 있었다)
  private lagK = 1; private lagHold = 0; private lastLag = -1; private lastT = 0;

  constructor(parent: HTMLElement, onUlt: () => void, onPause: () => void) {
    this.xp = h('i');
    this.clock = h('div', { class: 't' }, '09:00');
    this.dayFill = h('i');
    const marks = [
      h('b', { class: 'm-lunch', style: `left:${(BALANCE.lunchAt / BALANCE.runSeconds) * 100}%` }),
      h('b', { class: 'm-boss', style: `left:${(BALANCE.finalBossAt / BALANCE.runSeconds) * 100}%` }),
    ];
    this.lvl = h('b', null, '1');
    this.kills = h('b', null, '0');
    this.coins = h('b', null, '0');
    this.wslots = h('div', { class: 'srow w' });
    this.pslots = h('div', { class: 'srow p' });
    this.bossName = h('span', { class: 'nm' });
    this.bossPct = h('span', { class: 'pct' }, '100%');
    this.bossFill = h('i', { class: 'fill' });
    this.bossLag = h('i', { class: 'lag' });
    this.boss = h('div', { class: 'bossbar hidden' },
      h('div', { class: 'skull' }, '💀'),
      h('div', { class: 'bb' },
        h('div', { class: 'name' }, this.bossName, h('em', null, '격노'), this.bossPct),
        h('div', { class: 'b' }, this.bossLag, this.bossFill),
      ),
    );
    this.ultLbl = h('span', { class: 'lbl' });
    this.ultBtn = h('button', { class: 'ult', type: 'button', 'aria-label': '궁극기' },
      h('span', { class: 'ring' }),
      h('span', { class: 'face' }, h('span', { class: 'ic' }, '📄')),
      h('span', { class: 'rdy' }, 'READY'),
      this.ultLbl,
    ) as HTMLButtonElement;
    this.ultBtn.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); onUlt(); });
    this.pauseBtn = h('button', { class: 'btn icon ghost pausebtn', type: 'button', 'aria-label': '일시정지' }, h('i'), h('i')) as HTMLButtonElement;
    this.pauseBtn.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); onPause(); });

    this.comboEl = h('div', { class: 'combo hidden' });
    this.root = h('div', { class: 'hud' },
      this.comboEl,
      h('div', { class: 'xpbar' }, this.xp),
      h('div', { class: 'hud-top' },
        h('div', { class: 'clock' }, this.clock, h('div', { class: 'dayline' }, this.dayFill, ...marks)),
        h('div', { class: 'lvl' }, h('small', null, 'LV'), this.lvl),
        h('div', { class: 'hud-right' }, h('div', { class: 'hud-stats' },
          h('div', { class: 'chip kill' }, h('span', { class: 'ci' }, '💀'), this.kills),
          h('div', { class: 'chip coin' }, h('span', { class: 'ci' }, '₩'), this.coins),
        )),
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

  private rebuildSlots(w: World, evo: Set<string>) {
    clear(this.wslots); clear(this.pslots);
    for (const wi of w.weapons) {
      const mx = maxLevelOf(wi.def);
      const max = wi.level >= mx;
      const cls = `slot${wi.def.evolved ? ' evo' : max ? ' max' : ''}${evo.has(wi.def.id) ? ' ready' : ''}`;
      this.wslots.appendChild(h('div', { class: cls },
        h('span', { class: 'si' }, wi.def.icon),
        wi.def.evolved ? h('b', null, '★') : pips(wi.level, mx),
      ));
    }
    for (const pi of w.passives) {
      const max = pi.level >= pi.def.maxLevel;
      this.pslots.appendChild(h('div', { class: `slot${max ? ' max' : ''}` }, h('span', { class: 'si' }, pi.def.icon), pips(pi.level, pi.def.maxLevel)));
    }
  }

  update(w: World) {
    const p = w.player;
    if (this.stage !== w.cfg.stage.id) { this.stage = w.cfg.stage.id; this.root.dataset.stage = this.stage; }
    const xk = Math.round(Math.min(1, p.xp / p.xpNext) * 200) / 200;
    if (xk !== this.lastXp) { this.lastXp = xk; this.xp.style.transform = `scaleX(${xk})`; }
    this.set(this.clock, 'clock', clockText(w));
    const yg = w.yageun && !w.cleared;
    this.clock.classList.toggle('yageun', yg);
    const dk = Math.round(Math.min(1, w.t / BALANCE.runSeconds) * 200) / 200;
    if (dk !== this.lastDay) { this.lastDay = dk; this.dayFill.style.transform = `scaleX(${dk})`; }
    this.set(this.lvl, 'lvl', String(p.level));
    this.set(this.kills, 'kills', compactNum(w.stats_.kills));
    this.set(this.coins, 'coins', compactNum(w.stats_.coins));
    // 슬롯: 무기·패시브 구성이 바뀌는 건 드문 일이라 몇 프레임에 한 번만 확인한다
    if (this.slotTick++ % 6 === 0 || !this.slotKey) {
      const evo = new Set(evolvable(w).map(x => x.def.id));
      const key = w.weapons.map(x => `${x.def.id}:${x.level}:${evo.has(x.def.id) ? 1 : 0}`).join(',') + '|' + w.passives.map(x => `${x.def.id}:${x.level}`).join(',');
      if (key !== this.slotKey) { this.slotKey = key; this.rebuildSlots(w, evo); }
    }
    // 보스: 빨간 체력은 바로, 흰 잔상 바는 0.35초 버틴 뒤 따라 내려온다
    const now = performance.now();
    const dt = Math.min(0.1, Math.max(0, (now - this.lastT) / 1000));
    this.lastT = now;
    const b = w.bossAlive;
    if (b && !b.dead) {
      if (this.boss.classList.contains('hidden')) { this.boss.classList.remove('hidden'); this.root.classList.add('boss-on'); }
      this.set(this.bossName, 'bossn', b.def.name);
      this.boss.classList.toggle('enraged', !!b.enraged);
      const bk = Math.round(Math.max(0, b.hp / b.maxHp) * 300) / 300;
      if (bk !== this.lastBoss) {
        this.lastBoss = bk;
        this.bossFill.style.transform = `scaleX(${bk})`;
        this.set(this.bossPct, 'bossp', `${Math.ceil(bk * 100)}%`);
      }
      // 잔상: 틈이 새로 벌어질 때만 버티기 시작(연속 피해가 버티기 시간을 계속 늘리지 않게), 그다음엔 틈에 비례해(최소 초당 20%) 따라간다
      if (bk >= this.lagK) { this.lagK = bk; this.lagHold = 0.35; }
      else if (this.lagHold > 0) this.lagHold -= dt;
      else {
        this.lagK = Math.max(bk, this.lagK - Math.max(0.2 * dt, (this.lagK - bk) * 2.2 * dt));
        if (this.lagK - bk < 0.002) this.lagK = bk;
      }
      const lq = Math.round(this.lagK * 300) / 300;
      if (lq !== this.lastLag) { this.lastLag = lq; this.bossLag.style.transform = `scaleX(${lq})`; }
    } else if (!this.boss.classList.contains('hidden')) {
      this.boss.classList.add('hidden'); this.root.classList.remove('boss-on'); this.lastBoss = -1;
      this.lagK = 1; this.lagHold = 0; this.lastLag = -1;
    }
    // 궁극기: 원뿔 게이지(--k)
    const active = p.ultActiveT > 0;
    const k = active ? 1 : Math.round(Math.min(1, p.ult / p.ultMax) * 100) / 100;
    if (k !== this.lastUlt) { this.lastUlt = k; this.ultBtn.style.setProperty('--k', String(k)); }
    this.ultBtn.classList.toggle('ready', k >= 1 && !active);
    this.ultBtn.classList.toggle('active', active);
  }
}
