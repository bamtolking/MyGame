// 인게임 모달: 레벨업 / 상자 / 점심 / 일시정지 / 칼퇴 성공
import { PASSIVE, WEAPON } from '../content';
import type { World, LevelChoice } from '../sim/types';
import { maxLevelOf } from '../sim/stats';
import { clockText } from '../sim/director';
import { LEVELUP_SHOUTS, LUNCH_TITLES, PAUSE_TITLES, TIPS } from '../content/strings';
import { h, btn, statLabel, fmtTime } from './dom';
import { audio } from '../platform/audio';

const pickStr = (arr: readonly string[], fallback: string) => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : fallback);

function choiceInfo(w: World, c: LevelChoice): { icon: string; name: string; tag: string; tagCls: string; desc: string; hint: string } {
  if (c.kind === 'heal') return { icon: '☕', name: '커피 한 잔', tag: '', tagCls: '', desc: c.desc, hint: '' };
  if (c.kind === 'coins') return { icon: '💰', name: '용돈', tag: '', tagCls: '', desc: c.desc, hint: '' };
  if (c.kind === 'newWeapon' || c.kind === 'weapon') {
    const d = WEAPON.get(c.id)!;
    const pair = d.evolveWith ? PASSIVE.get(d.evolveWith) : undefined;
    const evo = d.evolvesTo ? WEAPON.get(d.evolvesTo) : undefined;
    const has = pair && w.passives.some(p => p.def.id === pair.id);
    const hint = pair && evo ? `진화: 최대 레벨 + ${pair.icon} ${pair.name}${has ? ' ✔' : ''}` : '';
    const max = c.level >= maxLevelOf(d);
    return {
      icon: d.icon, name: d.name,
      tag: c.kind === 'newWeapon' ? 'NEW 무기' : max ? `MAX` : `Lv ${c.level}`,
      tagCls: c.kind === 'newWeapon' ? '' : 'lv',
      desc: c.kind === 'newWeapon' ? d.desc : c.desc, hint,
    };
  }
  const d = PASSIVE.get(c.id)!;
  const evoFor = [...WEAPON.values()].filter(x => x.evolveWith === d.id && !x.evolved && w.weapons.some(o => o.def.id === x.id));
  const stats = Object.entries(d.perLevel).map(([k, v]) => statLabel(k, v as number)).join(' · ');
  return {
    icon: d.icon, name: d.name,
    tag: c.kind === 'newPassive' ? 'NEW 패시브' : c.level >= d.maxLevel ? 'MAX' : `Lv ${c.level}`,
    tagCls: c.kind === 'newPassive' ? '' : 'lv',
    desc: c.kind === 'newPassive' ? d.desc : `${stats} (Lv ${c.level - 1} → ${c.level})`,
    hint: evoFor.length ? `진화 재료: ${evoFor.map(x => `${x.icon} ${x.name}`).join(', ')}` : '',
  };
}

export interface ModalHost {
  root: HTMLElement;
  pick(idx: number): void;
  reroll(): void;
  skip(): void;
  banish(idx: number): void;
  closeChest(): void;
  lunch(id: string): void;
  resume(): void;
  quit(): void;
  settings(): void;
  overtime(): void;
  goHome(): void;
}

export class Modals {
  cur: HTMLElement | null = null;
  kind = '';
  private banishMode = false;
  constructor(private host: ModalHost) {}

  close() { this.cur?.remove(); this.cur = null; this.kind = ''; this.banishMode = false; }

  private open(kind: string, ...children: (Node | null)[]) {
    const keepBanish = kind === 'levelup' && this.kind === 'levelup' ? this.banishMode : false;
    this.close();
    this.banishMode = keepBanish;
    this.kind = kind;
    const m = h('div', { class: 'modal' }, ...children);
    this.cur = h('div', { class: 'modal-wrap no-joy' }, m);
    this.host.root.appendChild(this.cur);
    return m;
  }

  levelUp(w: World) {
    const p = w.player;
    const lockUntil = performance.now() + 380; // 조이스틱에서 손 떼며 잘못 누르는 것 방지
    let toolLock = performance.now() + 250;   // 새로고침/제외 연타로 두 번 쓰이는 것 방지
    const list = h('div', { class: 'choices-grid' });
    w.choices.forEach((c, i) => {
      const inf = choiceInfo(w, c);
      const card = h('button', { class: `choice${this.banishMode ? ' banish-mode' : ''}`, type: 'button', style: `animation-delay:${i * 60}ms` },
        h('div', { class: 'ic' }, inf.icon),
        h('div', { class: 'grow' },
          h('div', { class: 'nm' }, inf.name),
          h('div', { class: 'ds' }, inf.desc),
          inf.hint ? h('div', { class: 'hint' }, inf.hint) : null,
        ),
        inf.tag ? h('span', { class: `tag ${inf.tagCls}` }, inf.tag) : null,
      );
      card.addEventListener('click', () => {
        if (performance.now() < lockUntil || performance.now() < toolLock) return;
        toolLock = performance.now() + 350;
        if (this.banishMode) { this.banishMode = false; this.host.banish(i); return; }
        this.host.pick(i);
      });
      list.appendChild(card);
    });
    const tools = h('div', { class: 'lvl-tools' });
    const guard = (fn: () => void) => () => { if (performance.now() < toolLock) return; toolLock = performance.now() + 350; fn(); };
    if (p.rerolls > 0) tools.appendChild(btn(`🔄 새로고침 ${p.rerolls}`, guard(() => this.host.reroll()), 'btn small sky'));
    if (p.skips > 0) tools.appendChild(btn(`⏭ 건너뛰기 ${p.skips}`, guard(() => this.host.skip()), 'btn small ghost'));
    if (p.banishes > 0) tools.appendChild(btn(this.banishMode ? '취소' : `🚫 제외 ${p.banishes}`, guard(() => { this.banishMode = !this.banishMode; this.levelUp(w); }), 'btn small danger'));
    this.open('levelup',
      h('div', { class: 'modal-title' }, `🎉 레벨 ${p.level - w.levelQueue + 1}!`),
      h('div', { class: 'modal-sub' }, this.banishMode ? '제외할 항목을 고르세요 (이번 판에서 다시 안 나옴)' : pickStr(LEVELUP_SHOUTS, '승진각!')),
      list,
      tools.children.length ? tools : null,
    );
  }

  chest(w: World) {
    const res = w.chest!;
    const stage = h('div', { class: 'chest-stage' });
    const box = h('div', { class: 'box' }, res.boss ? '🎁' : '📦');
    stage.appendChild(box);
    const reels = h('div', { class: 'reels' });
    const list = h('div', { class: 'chest-list' });
    const done = btn('받기!', () => this.host.closeChest(), 'btn primary big', { style: 'width:100%;margin-top:12px' });
    done.classList.add('hidden');
    const m = this.open('chest',
      h('div', { class: 'modal-title' }, res.boss ? '🎁 보스 보상 상자!' : '📦 택배 도착!'),
      h('div', { class: 'modal-sub' }, '상자를 눌러 열어보세요'),
      stage, reels, list, done,
    );
    let opened = false;
    const icons = [...WEAPON.values()].map(x => x.icon).concat([...PASSIVE.values()].map(x => x.icon));
    const openIt = () => {
      if (opened) return;
      opened = true;
      box.classList.add('open');
      box.textContent = '✨';
      audio.play('tick');
      const n = res.items.length;
      const cells = res.items.map(() => { const r = h('div', { class: 'reel' }, '❔'); reels.appendChild(r); return r; });
      let tick = 0;
      const spin = window.setInterval(() => {
        tick++;
        cells.forEach((c, i) => { if (!c.classList.contains('done')) c.textContent = icons[(tick * 7 + i * 13) % icons.length]; });
        audio.play('tick', tick % 8);
      }, 70);
      res.items.forEach((it, i) => {
        window.setTimeout(() => {
          const c = cells[i];
          c.classList.add('done');
          const d = it.kind === 'passive' ? PASSIVE.get(it.id) : it.kind === 'coins' ? null : WEAPON.get(it.id);
          c.textContent = d ? d.icon : '💰';
          if (it.kind === 'evolve') { c.classList.add('evo'); audio.play('evolve'); } else audio.play('coin');
          const name = d ? d.name : `월급 ${it.level}`;
          const from = it.from ? WEAPON.get(it.from) : null;
          list.appendChild(h('div', { class: `it${it.kind === 'evolve' ? ' evo' : ''}` },
            h('span', { class: 'e' }, d ? d.icon : '💰'),
            h('span', { class: 'grow' }, it.kind === 'evolve' ? `진화! ${from?.name ?? ''} → ${name}` : it.kind === 'coins' ? name : `${name} Lv ${it.level}`),
          ));
          if (i === n - 1) {
            window.clearInterval(spin);
            list.appendChild(h('div', { class: 'it' }, h('span', { class: 'e' }, '💰'), h('span', { class: 'grow' }, `월급 +${res.coins}`)));
            if (n >= 3) audio.play('jackpot');
            done.classList.remove('hidden');
          }
        }, 650 + i * (n >= 5 ? 360 : 480));
      });
    };
    box.addEventListener('click', openIt);
    window.setTimeout(openIt, 1400);
    void m;
  }

  lunch(w: World) {
    const list = h('div', { class: 'choices-grid' });
    w.lunchChoices.forEach((l, i) => {
      const stats = Object.entries(l.stats).map(([k, v]) => statLabel(k, v as number)).join(' · ');
      const card = h('button', { class: 'choice lunch-card', type: 'button', style: `animation-delay:${i * 80}ms` },
        h('div', { class: 'ic' }, l.icon),
        h('div', { class: 'grow' },
          h('div', { class: 'nm' }, l.name),
          h('div', { class: 'ds' }, l.desc),
          h('div', { class: 'ds' }, h('b', null, stats), l.heal ? ` · 체력 ${Math.round(l.heal * 100)}% 회복` : ''),
        ),
      );
      const lock = performance.now() + 400;
      card.addEventListener('click', () => { if (performance.now() >= lock) this.host.lunch(l.id); });
      list.appendChild(card);
    });
    this.open('lunch',
      h('div', { class: 'modal-title' }, `🍱 ${pickStr(LUNCH_TITLES, '점심시간!')}`),
      h('div', { class: 'modal-sub' }, '12:00 — 고른 메뉴의 효과가 퇴근까지 유지됩니다'),
      list,
    );
  }

  pause(w: World) {
    const total = w.weapons.reduce((a, x) => a + x.dmg, 0) || 1;
    const build = h('div', { class: 'build' });
    for (const wi of [...w.weapons].sort((a, b) => b.dmg - a.dmg)) {
      build.appendChild(h('div', null,
        h('div', { class: 'w' }, h('span', { class: 'e' }, wi.def.icon), h('span', { class: 'n' }, `${wi.def.name} ${wi.def.evolved ? '★' : `Lv${wi.level}`}`), h('span', { class: 'dmg' }, Math.round(wi.dmg).toLocaleString('ko-KR'))),
        h('div', { class: 'dmgbar' }, h('i', { style: `width:${(wi.dmg / total) * 100}%` })),
      ));
    }
    const pas = h('div', { class: 'row gap', style: 'flex-wrap:wrap;margin-bottom:6px' },
      ...w.passives.map(p => h('span', { class: 'pill' }, `${p.def.icon} ${p.def.name} ${p.level}`)));
    const d = w.d;
    const stats = h('div', { class: 'statlist' },
      h('div', null, '피해', h('b', null, `${Math.round((d.mightMul - 1) * 100)}%`)),
      h('div', null, '범위', h('b', null, `${Math.round((d.areaMul - 1) * 100)}%`)),
      h('div', null, '쿨타임', h('b', null, `-${Math.round((1 - d.cdMul) * 100)}%`)),
      h('div', null, '투사체', h('b', null, `+${d.amountAdd}`)),
      h('div', null, '최대 체력', h('b', null, `${d.maxHp}`)),
      h('div', null, '방어', h('b', null, `${d.armor}`)),
      h('div', null, '이동속도', h('b', null, `${Math.round(d.moveSpeed)}`)),
      h('div', null, '행운', h('b', null, `${Math.round((d.luck - 1) * 100)}%`)),
    );
    this.open('pause',
      h('div', { class: 'modal-title' }, `⏸ ${pickStr(PAUSE_TITLES, '잠깐 쉬는 중')}`),
      h('div', { class: 'modal-sub' }, `${clockText(w)} · ${fmtTime(w.t)} 경과 · ${w.cfg.stage.name}${w.cfg.heat ? ` · 야근 강도 ${w.cfg.heat}` : ''}`),
      build, pas, stats,
      w.lunch ? h('div', { class: 'small', style: 'margin-bottom:8px' }, `점심: ${w.lunch.icon} ${w.lunch.name}`) : null,
      h('div', { class: 'small', style: 'margin-bottom:10px;color:#cfd3ff' }, `💡 ${pickStr(TIPS, '')}`),
      h('div', { class: 'col gap' },
        btn('▶ 계속 일하기', () => this.host.resume(), 'btn primary big'),
        h('div', { class: 'row gap' },
          btn('⚙ 설정', () => this.host.settings(), 'btn ghost grow'),
          btn('🏳 조퇴하기', () => this.host.quit(), 'btn danger grow'),
        ),
      ),
    );
  }

  victory(w: World) {
    this.open('victory',
      h('div', { class: 'result-head' },
        h('div', { class: 'big' }, '🎉'),
        h('h2', { class: 'win' }, '18:00 칼퇴 성공!'),
        h('div', { class: 'quote' }, w.yageun ? '조금 늦었지만… 어쨌든 퇴근!' : '정시 퇴근의 기쁨을 누리세요'),
      ),
      h('div', { class: 'col gap' },
        btn('🏠 퇴근하기', () => this.host.goHome(), 'btn primary big'),
        w.cfg.overtimeAllowed
          ? btn('🌙 야근하기 (무한 모드 · 분당 보너스)', () => this.host.overtime(), 'btn ghost')
          : h('div', { class: 'small center muted' }, '🔒 야근 모드는 업적으로 해금됩니다'),
      ),
    );
  }
}
