// 인게임 모달: 레벨업 / 상자 / 점심 / 일시정지 / 칼퇴 성공
import { PASSIVE, WEAPON } from '../content';
import type { World, LevelChoice } from '../sim/types';
import { maxLevelOf } from '../sim/stats';
import { clockText } from '../sim/director';
import { LEVELUP_SHOUTS, LUNCH_TITLES, PAUSE_TITLES, TIPS, ONBOARDING_HINTS } from '../content/strings';
import { h, btn, statLabel, fmtTime } from './dom';
import { audio } from '../platform/audio';

const pickStr = (arr: readonly string[], fallback: string) => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : fallback);

/** 카드 등급: 무기(청록) · 패시브(보라) · 진화 가능(금색) · 기타(민트) */
type Rarity = 'weapon' | 'passive' | 'evo' | 'misc';
interface ChoiceInfo { icon: string; name: string; tag: string; tagCls: string; desc: string; hint: string; rar: Rarity; lv: number; max: number }

function choiceInfo(w: World, c: LevelChoice): ChoiceInfo {
  if (c.kind === 'heal') return { icon: '☕', name: '커피 한 잔', tag: '', tagCls: '', desc: c.desc, hint: '', rar: 'misc', lv: 0, max: 0 };
  if (c.kind === 'coins') return { icon: '💰', name: '용돈', tag: '', tagCls: '', desc: c.desc, hint: '', rar: 'misc', lv: 0, max: 0 };
  if (c.kind === 'newWeapon' || c.kind === 'weapon') {
    const d = WEAPON.get(c.id)!;
    const pair = d.evolveWith ? PASSIVE.get(d.evolveWith) : undefined;
    const evo = d.evolvesTo ? WEAPON.get(d.evolvesTo) : undefined;
    const has = pair && w.passives.some(p => p.def.id === pair.id);
    const mx = maxLevelOf(d);
    const max = c.level >= mx;
    const ready = !!(pair && evo && has && max);   // 이걸 고르면 진화 조건이 완성된다
    const hint = ready ? `⭐ 진화 준비 완료 → ${evo!.icon} ${evo!.name}` : pair && evo ? `진화: 최대 레벨 + ${pair.icon} ${pair.name}${has ? ' ✔' : ''}` : '';
    return {
      icon: d.icon, name: d.name,
      tag: c.kind === 'newWeapon' ? 'NEW 무기' : max ? `MAX` : `Lv ${c.level}`,
      tagCls: c.kind === 'newWeapon' ? 'new' : max ? 'max' : 'lv',
      desc: c.kind === 'newWeapon' ? d.desc : c.desc, hint,
      rar: ready ? 'evo' : 'weapon', lv: c.level, max: mx,
    };
  }
  const d = PASSIVE.get(c.id)!;
  const evoFor = [...WEAPON.values()].filter(x => x.evolveWith === d.id && !x.evolved && w.weapons.some(o => o.def.id === x.id));
  const readyFor = c.kind === 'newPassive' ? evoFor.filter(x => w.weapons.some(o => o.def.id === x.id && o.level >= maxLevelOf(x))) : [];
  const stats = Object.entries(d.perLevel).map(([k, v]) => statLabel(k, v as number)).join(' · ');
  return {
    icon: d.icon, name: d.name,
    tag: c.kind === 'newPassive' ? 'NEW 패시브' : c.level >= d.maxLevel ? 'MAX' : `Lv ${c.level}`,
    tagCls: c.kind === 'newPassive' ? 'new' : c.level >= d.maxLevel ? 'max' : 'lv',
    desc: c.kind === 'newPassive' ? d.desc : `${stats} (Lv ${c.level - 1} → ${c.level})`,
    hint: readyFor.length ? `⭐ ${readyFor.map(x => `${x.icon} ${x.name}`).join(', ')} 진화 준비 완료` : evoFor.length ? `진화 재료: ${evoFor.map(x => `${x.icon} ${x.name}`).join(', ')}` : '',
    rar: readyFor.length ? 'evo' : 'passive', lv: c.level, max: d.maxLevel,
  };
}

/** 카드의 레벨 눈금: 이미 가진 레벨은 켜고, 이번에 오르는 칸은 깜빡인다 */
function levelPips(lv: number, max: number): HTMLElement | null {
  if (!max || max > 12) return null;
  const el = h('div', { class: 'cpips' });
  for (let i = 1; i <= max; i++) el.appendChild(h('i', i < lv ? { class: 'on' } : i === lv ? { class: 'new' } : null));
  return el;
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
  private hintText = '';
  constructor(private host: ModalHost) {}

  close() { this.cur?.remove(); this.cur = null; this.kind = ''; this.banishMode = false; this.hintText = ''; }

  /** 첫 레벨업·첫 점심 온보딩 힌트는 app이 창을 열기 직전에 토스트로 띄운다. 토스트 층은 모달 배경 아래라 가려지고
   *  (작은 화면에선 완전히), 창을 닫은 뒤에야 엉뚱하게 보인다 → 그 토스트를 거둬 창 안(부제 아래)에 보여 준다. */
  private takeHint(kind: string): string {
    const text = kind === 'levelup' || kind === 'lunch' ? ONBOARDING_HINTS[kind] : '';
    if (!text) return '';
    const want = `💡 ${text}`;
    for (const t of this.host.root.querySelectorAll<HTMLElement>(':scope > .toasts > .toast')) {
      if (t.textContent === want) { t.remove(); return want; }
    }
    return '';
  }

  private open(kind: string, w: World, ...children: (Node | null)[]) {
    const same = kind === this.kind;
    const keepBanish = kind === 'levelup' && same ? this.banishMode : false;
    const keepHint = same ? this.hintText : '';   // 새로고침·제외로 같은 창을 다시 그려도 힌트 유지
    this.close();
    this.banishMode = keepBanish;
    this.kind = kind;
    this.hintText = this.takeHint(kind) || keepHint;
    const m = h('div', { class: `modal m-${kind}` }, ...children);
    if (this.hintText) {
      const hint = h('div', { class: 'modal-hint' }, this.hintText);
      const sub = m.querySelector(':scope > .modal-sub');
      if (sub) sub.after(hint); else m.prepend(hint);
    }
    this.cur = h('div', { class: `modal-wrap no-joy mw-${kind}`, 'data-stage': w.cfg.stage.id }, m);
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
      const canBan = c.kind === 'newWeapon' || c.kind === 'newPassive';
      const card = h('button', { class: `choice r-${inf.rar}${this.banishMode ? (canBan ? ' banish-mode' : ' ban-off') : ''}`, type: 'button', style: `animation-delay:${60 + i * 70}ms` },
        h('div', { class: 'ic' }, inf.icon),
        h('div', { class: 'grow' },
          h('div', { class: 'nmrow' }, h('span', { class: 'nm' }, inf.name), inf.tag ? h('span', { class: `tag ${inf.tagCls}` }, inf.tag) : null),
          levelPips(inf.lv, inf.max),
          h('div', { class: 'ds' }, inf.desc),
          inf.hint ? h('div', { class: 'hint' }, inf.hint) : null,
        ),
      );
      card.addEventListener('click', () => {
        if (performance.now() < lockUntil || performance.now() < toolLock) return;
        toolLock = performance.now() + 350;
        if (this.banishMode) {
          if (c.kind !== 'newWeapon' && c.kind !== 'newPassive') { toolLock = 0; return; }   // 새 항목만 제외할 수 있다
          this.banishMode = false; this.host.banish(i); return;
        }
        this.host.pick(i);
      });
      list.appendChild(card);
    });
    const tools = h('div', { class: 'lvl-tools' });
    const guard = (fn: () => void) => () => { if (performance.now() < toolLock) return; toolLock = performance.now() + 350; fn(); };
    if (p.rerolls > 0) tools.appendChild(btn(`🔄 새로고침 ${p.rerolls}`, guard(() => this.host.reroll()), 'btn small sky'));
    if (p.skips > 0) tools.appendChild(btn(`⏭ 건너뛰기 ${p.skips}`, guard(() => this.host.skip()), 'btn small ghost'));
    if (p.banishes > 0) tools.appendChild(btn(this.banishMode ? '취소' : `🚫 제외 ${p.banishes}`, guard(() => { this.banishMode = !this.banishMode; this.levelUp(w); }), 'btn small danger'));
    this.open('levelup', w,
      h('div', { class: 'modal-kicker' }, 'LEVEL UP'),
      h('div', { class: 'modal-title' }, `🎉 레벨 ${p.level - w.levelQueue + 1}!`),
      h('div', { class: 'modal-sub' }, this.banishMode ? '제외할 새 항목을 고르세요 (이번 판에서 다시 안 나옴)' : pickStr(LEVELUP_SHOUTS, '승진각!')),
      list,
      tools.children.length ? tools : null,
    );
  }

  chest(w: World) {
    const res = w.chest!;
    const stage = h('div', { class: `chest-stage${res.boss ? ' boss' : ''}` });
    const box = h('div', { class: 'box' }, res.boss ? '🎁' : '📦');
    stage.appendChild(h('div', { class: 'rays' }));
    stage.appendChild(box);
    const reels = h('div', { class: 'reels' });
    const list = h('div', { class: 'chest-list' });
    const done = btn('받기!', () => this.host.closeChest(), 'btn primary big', { style: 'width:100%;margin-top:12px' });
    done.classList.add('hidden');
    const sub = h('div', { class: 'modal-sub' }, '상자를 눌러 열어보세요');
    this.open('chest', w,
      h('div', { class: 'modal-kicker' }, res.boss ? 'BOSS REWARD' : 'DELIVERY'),
      h('div', { class: 'modal-title' }, res.boss ? '🎁 보스 보상 상자!' : '📦 택배 도착!'),
      sub,
      h('div', { class: 'chest-cols' }, stage, h('div', { class: 'chest-side' }, reels, list, done)),
    );
    let opened = false;
    const icons = [...WEAPON.values()].map(x => x.icon).concat([...PASSIVE.values()].map(x => x.icon));
    const openIt = () => {
      if (opened) return;
      opened = true;
      stage.classList.add('opened');
      box.classList.add('open');
      box.textContent = '✨';
      sub.textContent = '두근두근…';
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
          if (it.kind === 'evolve') { c.classList.add('evo'); stage.classList.add('evo'); audio.play('evolve'); } else audio.play('coin');
          const name = d ? d.name : `월급 ${it.level}`;
          const from = it.from ? WEAPON.get(it.from) : null;
          list.appendChild(h('div', { class: `it${it.kind === 'evolve' ? ' evo' : ''}` },
            h('span', { class: 'e' }, d ? d.icon : '💰'),
            h('span', { class: 'grow' }, it.kind === 'evolve' ? `진화! ${from?.name ?? ''} → ${name}` : it.kind === 'coins' ? name : `${name} Lv ${it.level}`),
          ));
          if (i === n - 1) {
            window.clearInterval(spin);
            list.appendChild(h('div', { class: 'it pay' }, h('span', { class: 'e' }, '💰'), h('span', { class: 'grow' }, `월급 +${res.coins}`)));
            if (n >= 3) audio.play('jackpot');
            sub.textContent = n >= 5 ? '대박! 전부 챙기세요' : '수령 완료';
            done.classList.remove('hidden');
          }
        }, 650 + i * (n >= 5 ? 360 : 480));
      });
    };
    box.addEventListener('click', openIt);
    window.setTimeout(openIt, 1400);
  }

  lunch(w: World) {
    const list = h('div', { class: 'choices-grid' });
    w.lunchChoices.forEach((l, i) => {
      const stats = Object.entries(l.stats).map(([k, v]) => statLabel(k, v as number)).join(' · ');
      const card = h('button', { class: 'choice lunch-card', type: 'button', style: `animation-delay:${60 + i * 80}ms` },
        h('div', { class: 'ic' }, l.icon),
        h('div', { class: 'grow' },
          h('div', { class: 'nmrow' }, h('span', { class: 'nm' }, l.name)),
          h('div', { class: 'ds' }, l.desc),
          h('div', { class: 'ds fx' }, h('b', null, stats), l.heal ? ` · 체력 ${Math.round(l.heal * 100)}% 회복` : ''),
        ),
      );
      const lock = performance.now() + 400;
      card.addEventListener('click', () => { if (performance.now() >= lock) this.host.lunch(l.id); });
      list.appendChild(card);
    });
    this.open('lunch', w,
      h('div', { class: 'modal-kicker' }, 'LUNCH BREAK · 12:00'),
      h('div', { class: 'modal-title' }, `🍱 ${pickStr(LUNCH_TITLES, '점심시간!')}`),
      h('div', { class: 'modal-sub' }, '고른 메뉴의 효과가 퇴근까지 유지됩니다'),
      list,
    );
  }

  pause(w: World) {
    const total = w.weapons.reduce((a, x) => a + x.dmg, 0) || 1;
    const build = h('div', { class: 'build' });
    for (const wi of [...w.weapons].sort((a, b) => b.dmg - a.dmg)) {
      build.appendChild(h('div', wi.def.evolved ? { class: 'evo' } : null,
        h('div', { class: 'w' }, h('span', { class: 'e' }, wi.def.icon), h('span', { class: 'n' }, `${wi.def.name} ${wi.def.evolved ? '★' : `Lv${wi.level}`}`), h('span', { class: 'dmg' }, Math.round(wi.dmg).toLocaleString('ko-KR'))),
        h('div', { class: 'dmgbar' }, h('i', { style: `width:${(wi.dmg / total) * 100}%` })),
      ));
    }
    const pas = w.passives.length ? h('div', { class: 'pill-row' },
      ...w.passives.map(p => h('span', { class: 'pill' }, `${p.def.icon} ${p.def.name} ${p.level}`))) : null;
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
    this.open('pause', w,
      h('div', { class: 'modal-kicker' }, 'PAUSED'),
      h('div', { class: 'modal-title' }, `⏸ ${pickStr(PAUSE_TITLES, '잠깐 쉬는 중')}`),
      h('div', { class: 'modal-sub' }, `${clockText(w)} · ${fmtTime(w.t)} 경과 · ${w.cfg.stage.name}${w.cfg.heat ? ` · 야근 강도 ${w.cfg.heat}` : ''}`),
      h('div', { class: 'pause-cols' },
        h('div', { class: 'pause-main' }, h('div', { class: 'sec-title' }, '🗡 무기별 피해'), build),
        h('div', { class: 'pause-side' },
          pas, stats,
          w.lunch ? h('div', { class: 'small', style: 'margin-bottom:8px' }, `점심: ${w.lunch.icon} ${w.lunch.name}`) : null,
          h('div', { class: 'tip' }, `💡 ${pickStr(TIPS, '')}`),
          h('div', { class: 'col gap pause-actions' },
            btn('▶ 계속 일하기', () => this.host.resume(), 'btn primary big'),
            h('div', { class: 'row gap' },
              btn('⚙ 설정', () => this.host.settings(), 'btn ghost grow'),
              btn('🏳 조퇴하기', () => this.host.quit(), 'btn danger grow'),
            ),
          ),
        ),
      ),
    );
  }

  victory(w: World) {
    this.open('victory', w,
      h('div', { class: 'result-head win' },
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
