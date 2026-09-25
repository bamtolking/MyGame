// 메뉴 화면들: 타이틀 / 캐릭터 / 스테이지 / 복지 / 업적 / 도감 / 설정 / 결과
import {
  ACHIEVEMENTS, ACHIEVEMENT, BALANCE, CHARACTERS, ENEMIES, LUNCHES, META_UPGRADES, PASSIVES, STAGES, ULTIMATE, WEAPON, WEAPONS,
} from '../content';
import { TITLE_TAGLINES, CLEAR_QUOTES, GAMEOVER_QUOTES, SHARE_TEMPLATES, TIPS } from '../content/strings';
import type { AchievementDef, CharacterDef } from '../content/types';
import type { Profile } from '../platform/save';
import { exportProfile, importProfile, newProfile, todayKey, yesterdayKey } from '../platform/save';
import {
  achievementProgress, characterOwned, characterUnlocked, dailyInfo, featureUnlocked, hireCharacter, maxHeatFor, metaCost,
  metaUnlocked, stageUnlocked, buyMeta, refundMeta, weaponUnlocked, passiveUnlocked, lunchUnlocked, type Settlement,
} from '../meta/progress';
import type { World } from '../sim/types';
import { clockText } from '../sim/director';
import { h, btn, clear, confirmBox, promptBox, statLabel, fmtTime, watchDisplayFont } from './dom';
import { worker } from '../render/sprites';
import { audio } from '../platform/audio';
import { shareCard, shareCardDataUrl } from './sharecard';

export interface ScreenHost {
  root: HTMLElement;
  profile: Profile;
  save(): void;
  checkAchievements(): void;
  startRun(opts: { char: string; stage: string; heat: number; daily: boolean }): void;
  applySettings(): void;
  show(name: string): void;
  replaceProfile(p: Profile): void;
}

const pickStr = (arr: readonly string[], f: string) => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : f);

function unlockHint(id: string | undefined, p?: Profile): string {
  if (!id) return '';
  const a = ACHIEVEMENT.get(id);
  if (!a) return '업적으로 해금';
  if (a.hidden) return '??? (숨겨진 조건)';
  if (!p) return `🔒 ${a.desc}`;
  const v = Math.min(achievementProgress(p, a).value, a.target);
  return `🔒 ${a.desc} (${fmtNum(v)}/${fmtNum(a.target)})`;
}

/** 달성률이 높은 순으로 아직 못 한(숨김 아닌) 업적 n개 */
function nextGoals(p: Profile, n: number): { a: AchievementDef; k: number; v: number }[] {
  return ACHIEVEMENTS.filter(a => !p.achievements[a.id] && !a.hidden)
    .map(a => { const v = achievementProgress(p, a).value; return { a, v, k: Math.min(0.999, v / a.target) }; })
    .sort((x, y) => y.k - x.k || (x.a.reward.kind === 'coins' ? 1 : 0) - (y.a.reward.kind === 'coins' ? 1 : 0))
    .slice(0, n);
}

function portrait(c: CharacterDef, w = 72, hgt = 80): HTMLCanvasElement {
  const cv = h('canvas', { width: String(w * 2), height: String(hgt * 2) }) as HTMLCanvasElement;
  const g = cv.getContext('2d')!;
  const s = worker(c.look, 0, 34);
  const k = Math.min((w * 2) / s.c.width, (hgt * 2) / s.c.height) * 0.95;
  g.drawImage(s.c, (w * 2 - s.c.width * k) / 2, (hgt * 2 - s.c.height * k) / 2 + 6, s.c.width * k, s.c.height * k);
  return cv;
}

function head(title: string, onBack: () => void, p?: Profile): HTMLElement {
  return h('div', { class: 'screen-head' },
    btn('←', onBack, 'btn icon ghost'),
    h('h2', null, title),
    p ? h('span', { class: 'coins' }, p.coins.toLocaleString('ko-KR')) : null,
  );
}

export class Screens {
  cur: HTMLElement | null = null;
  selChar = 'kim';
  selStage = 'office';
  selHeat = 0;
  curName = '';
  constructor(private host: ScreenHost) { this.syncSel(); watchDisplayFont(); }

  /** 저장된 마지막 선택(캐릭터·근무지·강도)으로 맞춘다 */
  syncSel() {
    const p = this.host.profile;
    this.selChar = characterOwned(p, p.sel.char) ? p.sel.char : 'kim';
    this.selStage = stageUnlocked(p, p.sel.stage) ? p.sel.stage : 'office';
    this.selHeat = featureUnlocked(p, 'heat') ? Math.min(p.sel.heat, maxHeatFor(p, this.selStage)) : 0;
  }

  private mount(el: HTMLElement, name = '') {
    this.cur?.remove();
    this.cur = el;
    this.curName = name;
    this.host.root.appendChild(el);
  }
  close() { this.cur?.remove(); this.cur = null; this.curName = ''; }

  // ───────────── 타이틀 ─────────────
  title() {
    const p = this.host.profile;
    const today = todayKey();
    const dToday = p.daily.date === today;
    const played = dToday && p.daily.played, cleared = dToday && p.daily.cleared;
    const streak = p.daily.lastClear === today || p.daily.lastClear === yesterdayKey() ? p.daily.streak : 0;
    const unclaimedDaily = featureUnlocked(p, 'daily') && !played;
    const di = featureUnlocked(p, 'daily') ? dailyInfo(p) : null;
    if (di) this.host.save();
    const tag = h('div', { class: 'tagline' }, pickStr(TITLE_TAGLINES, '오늘은 반드시 칼퇴한다.'));
    const achDone = Object.keys(p.achievements).length;
    const el = h('div', { class: 'screen title-screen' },
      h('div', { class: 'title-top' },
        h('span', { class: 'pill' }, `🏆 ${achDone}/${ACHIEVEMENTS.length}`),
        h('span', { class: 'coins' }, p.coins.toLocaleString('ko-KR')),
      ),
      h('div', { class: 'logo' },
        h('div', { class: 'alarm' }, h('span', null, '⏰')),
        h('h1', null, h('span', { class: 'kt' }, '칼퇴'), h('small', null, 'SURVIVOR')),
        h('div', { class: 'strike' }, '오늘 목표: ', h('s', null, '야근'), ' → ', h('b', null, '18:00'), ' 퇴근'),
        tag,
      ),
      h('div', { class: 'title-main' },
        di ? h('div', { class: `daily-card${unclaimedDaily ? ' badge-dot' : ''}`, onclick: () => { audio.play('click'); this.host.startRun({ char: di.char, stage: di.stage, heat: di.heat, daily: true }); } },
          h('div', null, '📅 ', h('b', null, '오늘의 업무'), cleared ? ' ✅ 완료' : played ? ' (재도전 가능)' : ' — 보너스 월급!'),
          h('div', { class: 'sub' }, `${CHARACTERS.find(c => c.id === di.char)?.name}${characterUnlocked(p, di.char) ? '' : '(체험 근무)'} · ${STAGES.find(s => s.id === di.stage)?.name} · ${di.modifiers.map(m => `${m.icon}${m.name}`).join(' · ')}`),
          streak > 1 ? h('div', { class: 'sub' }, `🔥 연속 ${streak}일 달성 중`) : null,
        ) : null,
        btn(h('span', null, '🏢 출근하기'), () => this.charSelect(), 'btn primary big'),
        h('div', { class: 'title-grid' },
          btn([h('span', { class: 'ic' }, '💝'), h('span', { class: 'lb' }, '복지')], () => this.shop(), 'btn ghost'),
          btn([h('span', { class: 'ic' }, '🏆'), h('span', { class: 'lb' }, '업적')], () => this.achievements(), 'btn ghost'),
          btn([h('span', { class: 'ic' }, '📖'), h('span', { class: 'lb' }, '도감')], () => this.codex(), 'btn ghost'),
        ),
        h('div', { class: 'row gap' },
          btn('⚙ 설정', () => this.settings(() => this.title()), 'btn ghost small grow'),
          btn('❓ 도움말', () => this.help(), 'btn ghost small grow'),
        ),
        h('div', { class: 'title-foot' },
          p.last ? `지난 출근: ${STAGES.find(s => s.id === p.last!.stage)?.name ?? ''} · ${p.last.cleared ? '칼퇴 성공' : fmtTime(p.last.time) + ' 생존'} · Lv ${p.last.level}` : '처음 오셨군요! 출근 버튼을 눌러 시작하세요.',
        ),
      ),
    );
    this.mount(el, 'title');
    // 태그라인 순환
    const iv = window.setInterval(() => { if (!el.isConnected) { clearInterval(iv); return; } tag.textContent = pickStr(TITLE_TAGLINES, tag.textContent ?? ''); }, 5000);
  }

  // ───────────── 캐릭터 선택 ─────────────
  charSelect() {
    const p = this.host.profile;
    if (!characterOwned(p, this.selChar)) this.selChar = p.sel.char && characterOwned(p, p.sel.char) ? p.sel.char : 'kim';
    const list = h('div', { class: 'list' });
    const render = () => {
      clear(list);
      for (const c of CHARACTERS) {
        const unlocked = characterUnlocked(p, c.id);
        const owned = characterOwned(p, c.id);
        const hidden = !unlocked && c.unlockedBy && ACHIEVEMENT.get(c.unlockedBy)?.hidden;
        const sw = WEAPON.get(c.startWeapon);
        const ult = ULTIMATE.get(c.ultimate);
        const card = h('div', { class: `card char-card${this.selChar === c.id ? ' sel' : ''}${owned ? '' : ' locked'}` },
          hidden ? h('div', { class: 'big-emoji', style: 'width:72px;text-align:center' }, '❓') : portrait(c),
          h('div', { class: 'grow' },
            h('h3', null, hidden ? '???' : c.name),
            h('div', { class: 'title' }, hidden ? '숨겨진 인물' : c.title),
            hidden ? null : h('div', { class: 'desc' }, c.desc),
            hidden ? null : h('div', { class: 'kit' },
              sw ? h('span', { class: 'pill y' }, `${sw.icon} ${sw.name}`) : null,
              ult ? h('span', { class: 'pill c' }, `${ult.icon} ${ult.name}`) : null,
              ...Object.entries(c.stats).map(([k, v]) => h('span', { class: 'pill m' }, statLabel(k, v as number))),
            ),
            !unlocked ? h('div', { class: 'small', style: 'margin-top:6px' }, unlockHint(c.unlockedBy, p)) : null,
            unlocked && !owned && c.price ? btn(`고용하기 ₩${c.price.toLocaleString('ko-KR')}`, () => {
              if (hireCharacter(p, c.id)) { audio.play('buy'); this.host.save(); this.selChar = c.id; render(); } else audio.play('hurt');
            }, 'btn small primary', { style: 'margin-top:8px' }) : null,
          ),
        );
        card.addEventListener('click', () => { if (owned) { audio.play('click'); this.selChar = c.id; render(); } });
        list.appendChild(card);
      }
    };
    render();
    const el = h('div', { class: 'screen' },
      head('누구로 출근할까요?', () => this.title(), p),
      h('div', { class: 'scroll' }, list),
      btn('다음 → 근무지 선택', () => { p.sel.char = this.selChar; this.host.save(); this.stageSelect(); }, 'btn primary big', { style: 'margin-top:10px' }),
    );
    this.mount(el);
  }

  // ───────────── 스테이지 선택 ─────────────
  stageSelect() {
    const p = this.host.profile;
    if (!stageUnlocked(p, this.selStage)) this.selStage = 'office';
    const list = h('div', { class: 'list' });
    const heatBox = h('div');
    const renderHeat = () => {
      clear(heatBox);
      if (!featureUnlocked(p, 'heat')) { this.selHeat = 0; return; }
      const max = maxHeatFor(p, this.selStage);
      this.selHeat = Math.min(this.selHeat, max);
      const lv = this.selHeat;
      const cur = lv > 0 ? BALANCE.heatLevels[lv - 1] : null;
      heatBox.appendChild(h('div', { class: 'heat-box', style: 'margin-top:10px' },
        btn('−', () => { this.selHeat = Math.max(0, lv - 1); renderHeat(); }, 'btn icon ghost'),
        h('div', { class: 'lv' }, `🔥${lv}`),
        h('div', { class: 'grow' },
          h('b', null, cur ? `${cur.icon} ${cur.name}` : '야근 강도 0 — 평범한 하루'),
          h('div', { class: 'small' }, cur ? cur.desc : '강도를 올리면 적이 강해지고 월급이 늘어납니다.'),
          h('div', { class: 'small muted' }, `최대 ${max}단계까지 선택 가능 (클리어하면 다음 단계 해금)`),
        ),
        btn('+', () => { this.selHeat = Math.min(max, lv + 1); renderHeat(); }, 'btn icon ghost'),
      ));
    };
    const render = () => {
      clear(list);
      for (const s of STAGES) {
        const un = stageUnlocked(p, s.id);
        const b = p.bests[s.id];
        const card = h('div', { class: `card stage-card${this.selStage === s.id ? ' sel' : ''}${un ? '' : ' locked'}`, 'data-stage': s.id },
          h('div', { class: 'bgemoji' }, s.icon),
          h('h3', null, `${s.icon} ${s.name}`),
          h('div', { class: 'sub' }, s.subtitle),
          un ? h('div', { class: 'desc' }, s.desc) : h('div', { class: 'desc lock' }, unlockHint(s.unlockedBy, p)),
          b ? h('div', { class: 'row gap', style: 'margin-top:8px;flex-wrap:wrap' },
            b.clears ? h('span', { class: 'pill y' }, `칼퇴 ${b.clears}회`) : h('span', { class: 'pill' }, `최고 ${fmtTime(b.bestTime)} 생존`),
            h('span', { class: 'pill' }, `최다 처치 ${b.bestKills.toLocaleString('ko-KR')}`),
            (p.heatCleared[s.id] ?? -1) > 0 ? h('span', { class: 'pill c' }, `🔥${p.heatCleared[s.id]} 클리어`) : null,
          ) : null,
        );
        card.addEventListener('click', () => { if (un) { audio.play('click'); this.selStage = s.id; render(); renderHeat(); } });
        list.appendChild(card);
      }
    };
    render(); renderHeat();
    const el = h('div', { class: 'screen' },
      head('오늘의 근무지', () => this.charSelect(), p),
      h('div', { class: 'scroll' }, list, heatBox),
      btn('🏃 출근!', () => {
        p.sel.stage = this.selStage; p.sel.heat = this.selHeat; this.host.save();
        this.host.startRun({ char: this.selChar, stage: this.selStage, heat: this.selHeat, daily: false });
      }, 'btn primary big', { style: 'margin-top:10px' }),
    );
    this.mount(el);
  }

  // ───────────── 복지(영구 강화) ─────────────
  shop() {
    const p = this.host.profile;
    const list = h('div', { class: 'list' });
    const coins = h('span', { class: 'coins' });
    const render = () => {
      coins.textContent = p.coins.toLocaleString('ko-KR');
      clear(list);
      for (const m of META_UPGRADES) {
        const un = metaUnlocked(p, m.id);
        const r = p.metaRanks[m.id] ?? 0;
        const max = r >= m.maxRank;
        const cost = metaCost(m.id, r);
        const pips = h('div', { class: 'pips' }, ...Array.from({ length: m.maxRank }, (_, i) => h('i', { class: i < r ? 'on' : '' })));
        list.appendChild(h('div', { class: `card shop-item${un ? '' : ' locked'}` },
          h('div', { class: 'ic' }, m.icon),
          h('div', { class: 'grow' },
            h('div', { class: 'nm' }, m.name, ' ', h('span', { class: 'small' }, `${r}/${m.maxRank}`)),
            h('div', { class: 'small' }, un ? m.desc : unlockHint(m.unlockedBy, p)),
            m.maxRank <= 12 ? pips : h('div', { class: 'bar', style: 'margin-top:6px' }, h('i', { style: `width:${(r / m.maxRank) * 100}%` })),
          ),
          un ? (max ? h('span', { class: 'pill y' }, 'MAX') : btn(`₩${cost.toLocaleString('ko-KR')}`, () => {
            if (buyMeta(p, m.id)) { audio.play('buy'); this.host.save(); this.host.checkAchievements(); render(); } else audio.play('hurt');
          }, p.coins >= cost ? 'btn small primary' : 'btn small ghost')) : null,
        ));
      }
    };
    render();
    const el = h('div', { class: 'screen' },
      h('div', { class: 'screen-head' }, btn('←', () => this.title(), 'btn icon ghost'), h('h2', null, '💝 사내 복지'), coins),
      h('div', { class: 'small', style: 'margin-bottom:8px' }, '월급으로 복지 제도를 도입하면 모든 캐릭터가 영구히 강해집니다.'),
      h('div', { class: 'scroll' }, list,
        h('div', { class: 'center', style: 'margin-top:14px' }, btn('↩ 복지 전액 환불', async () => {
          if (await confirmBox(this.host.root, '복지 환불', '구매한 복지를 모두 되돌리고 월급을 돌려받습니다.', '환불', '취소')) { refundMeta(p); this.host.save(); render(); }
        }, 'btn small ghost')),
      ),
    );
    this.mount(el);
  }

  // ───────────── 업적 ─────────────
  achievements() {
    const p = this.host.profile;
    const list = h('div', { class: 'list' });
    const sorted = [...ACHIEVEMENTS].sort((a, b) => Number(!!p.achievements[a.id]) - Number(!!p.achievements[b.id]));
    for (const a of sorted) {
      const pr = achievementProgress(p, a);
      const hide = a.hidden && !pr.done;
      const k = Math.min(1, pr.value / a.target);
      list.appendChild(h('div', { class: `card shop-item ach${pr.done ? ' done' : ''}` },
        h('div', { class: 'ic' }, pr.done ? a.icon : hide ? '❓' : a.icon),
        h('div', { class: 'grow' },
          h('div', { class: 'nm' }, hide ? '???' : a.name, pr.done ? ' ✅' : ''),
          h('div', { class: 'small' }, hide ? '숨겨진 업적' : a.desc),
          h('div', { class: 'small reward' }, `보상: ${rewardLabel(a)}`),
          !pr.done && !hide ? h('div', { class: 'bar', style: 'margin-top:6px' }, h('i', { style: `width:${k * 100}%` })) : null,
          !pr.done && !hide ? h('div', { class: 'small muted', style: 'margin-top:2px' }, `${fmtNum(Math.min(pr.value, a.target))} / ${fmtNum(a.target)}`) : null,
        ),
      ));
    }
    const done = Object.keys(p.achievements).length;
    this.mount(h('div', { class: 'screen' },
      head(`🏆 업적 ${done}/${ACHIEVEMENTS.length}`, () => this.title()),
      h('div', { class: 'scroll' }, list),
    ));
  }

  // ───────────── 도감 ─────────────
  codex(tab: 'weapon' | 'enemy' | 'lunch' = 'weapon') {
    const p = this.host.profile;
    const body = h('div');
    const tabs = h('div', { class: 'tabs' },
      btn('무기·진화', () => this.codex('weapon'), `btn small${tab === 'weapon' ? ' on' : ' ghost'}`),
      btn('적', () => this.codex('enemy'), `btn small${tab === 'enemy' ? ' on' : ' ghost'}`),
      btn('점심', () => this.codex('lunch'), `btn small${tab === 'lunch' ? ' on' : ' ghost'}`),
    );
    const seen = (id: string) => p.discovered.weapons.includes(id);
    if (tab === 'weapon') {
      body.appendChild(h('div', { class: 'small', style: 'margin-bottom:8px' }, '무기를 최대 레벨로 올리고 짝 패시브를 가진 채 엘리트 상자를 열면 진화합니다.'));
      for (const w of WEAPONS.filter(x => !x.evolved)) {
        const evo = w.evolvesTo ? WEAPON.get(w.evolvesTo) : undefined;
        const pas = w.evolveWith ? PASSIVES.find(x => x.id === w.evolveWith) : undefined;
        const known = seen(w.id);
        const evoKnown = evo ? seen(evo.id) : false;
        const un = weaponUnlocked(p, w.id);
        body.appendChild(h('div', { class: 'recipe' },
          h('span', null, un ? w.icon : '🔒'),
          h('span', { class: 'plus' }, '+'),
          h('span', null, known && pas ? pas.icon : '❔'),
          h('span', { class: 'plus' }, '→'),
          h('span', null, evoKnown && evo ? evo.icon : '❔'),
          h('span', { class: 'nm grow' },
            un ? w.name : unlockHint(w.unlockedBy),
            h('div', { class: 'small' }, evoKnown && evo ? `${evo.name} — ${evo.desc}` : known && pas ? `${pas.name}와(과) 함께 최대 레벨로 → ???` : un ? w.desc : ''),
          ),
        ));
      }
      body.appendChild(h('div', { class: 'sec-title' }, '패시브'));
      const grid = h('div', { class: 'codex-grid' });
      for (const ps of PASSIVES) {
        const un = passiveUnlocked(p, ps.id);
        grid.appendChild(h('div', { class: `codex-cell${un ? '' : ' unk'}` }, h('span', { class: 'e' }, un ? ps.icon : '🔒'), un ? ps.name : '???',
          h('div', { class: 'small' }, un ? Object.entries(ps.perLevel).map(([k, v]) => statLabel(k, v as number)).join(', ') : '')));
      }
      body.appendChild(grid);
    } else if (tab === 'enemy') {
      const grid = h('div', { class: 'codex-grid' });
      for (const e of ENEMIES) {
        const k = p.discovered.enemies.includes(e.id);
        grid.appendChild(h('div', { class: `codex-cell${k ? '' : ' unk'}` },
          h('span', { class: 'e' }, k ? (e.label ? '💬' : e.sprite) : '❔'),
          k ? (e.label ? `"${e.label}"` : e.name) : '???',
          k && (e.boss || e.elite) ? h('div', { class: `small rank ${e.boss ? 'boss' : 'elite'}` }, e.boss ? '보스' : '엘리트') : null,
        ));
      }
      body.appendChild(h('div', { class: 'small', style: 'margin-bottom:8px' }, `발견 ${p.discovered.enemies.length}/${ENEMIES.length}`));
      body.appendChild(grid);
    } else {
      const grid = h('div', { class: 'codex-grid' });
      for (const l of LUNCHES) {
        const un = lunchUnlocked(p, l.id);
        const k = p.discovered.lunches.includes(l.id);
        grid.appendChild(h('div', { class: `codex-cell${un ? '' : ' unk'}` },
          h('span', { class: 'e' }, un ? l.icon : '🔒'), un ? l.name : '???',
          h('div', { class: 'small' }, un ? Object.entries(l.stats).map(([kk, v]) => statLabel(kk, v as number)).join(', ') : unlockHint(l.unlockedBy)),
          k ? h('div', { class: 'small ate' }, '먹어봄') : null,
        ));
      }
      body.appendChild(grid);
    }
    this.mount(h('div', { class: 'screen' }, head('📖 사내 도감', () => this.title()), tabs, h('div', { class: 'scroll' }, body)));
  }

  // ───────────── 설정 ─────────────
  settings(back: () => void, inGame = false) {
    const p = this.host.profile;
    const s = p.settings;
    const slider = (label: string, get: () => number, set: (v: number) => void) => {
      const inp = h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(get() * 100)) }) as HTMLInputElement;
      inp.addEventListener('input', () => { set(Number(inp.value) / 100); this.host.applySettings(); });
      inp.addEventListener('change', () => this.host.save());
      return h('div', { class: 'set-row' }, label, inp);
    };
    const toggle = (label: string, get: () => boolean, set: (v: boolean) => void, sub = '') => {
      const t = h('button', { class: `toggle${get() ? ' on' : ''}`, type: 'button', 'aria-label': label });
      t.addEventListener('click', () => { set(!get()); t.classList.toggle('on', get()); audio.play('click'); this.host.applySettings(); this.host.save(); });
      return h('div', { class: 'set-row' }, h('div', null, label, sub ? h('div', { class: 'small' }, sub) : null), t);
    };
    const body = h('div', null,
      slider('🔊 효과음', () => s.sfx, v => (s.sfx = v)),
      slider('🎵 배경음', () => s.bgm, v => (s.bgm = v)),
      toggle('📳 화면 흔들림', () => s.shake, v => (s.shake = v)),
      toggle('📳 진동', () => s.vibrate, v => (s.vibrate = v), '지원하는 기기에서만'),
      toggle('💯 피해 숫자 표시', () => s.dmgNums, v => (s.dmgNums = v)),
      (() => {
        const opts: [Profile['settings']['quality'], string][] = [['auto', '자동'], ['high', '높음'], ['medium', '보통'], ['low', '낮음']];
        const row = h('div', { class: 'seg' });
        const render = () => {
          clear(row);
          for (const [v, label] of opts) row.appendChild(btn(label, () => { s.quality = v; s.low = v === 'low'; render(); this.host.applySettings(); this.host.save(); }, `btn small${s.quality === v ? ' on' : ' ghost'}`));
        };
        render();
        return h('div', { class: 'set-row' }, h('div', null, '🎨 그래픽 품질', h('div', { class: 'small' }, '자동: 기기 성능에 맞춰 효과·해상도를 조절')), row);
      })(),
      toggle('🕹 고정 조이스틱', () => s.joystick === 'fixed', v => (s.joystick = v ? 'fixed' : 'float'), '끄면 누른 자리에 조이스틱이 생깁니다'),
      inGame ? null : h('div', { class: 'col gap', style: 'margin-top:16px' },
        btn('📤 저장 데이터 내보내기', () => { promptBox(this.host.root, '저장 코드 (복사해서 보관)', exportProfile(p), true); }, 'btn ghost'),
        btn('📥 저장 데이터 불러오기', async () => {
          const code = await promptBox(this.host.root, '저장 코드 붙여넣기', '', false, '불러오기');
          if (!code) return;
          const np = importProfile(code);
          if (!np) { await confirmBox(this.host.root, '불러오기 실패', '코드가 올바르지 않습니다.', '확인', '닫기'); return; }
          if (await confirmBox(this.host.root, '불러오기', '현재 진행 상황을 덮어씁니다. 계속할까요?', '덮어쓰기', '취소', true)) { this.host.replaceProfile(np); back(); }
        }, 'btn ghost'),
        btn('🗑 모든 기록 초기화', async () => {
          if (await confirmBox(this.host.root, '정말 퇴사하시겠습니까?', '모든 월급·복지·업적·해금이 사라집니다.\n되돌릴 수 없습니다.', '초기화', '취소', true)) {
            this.host.replaceProfile(newProfile()); back();
          }
        }, 'btn danger'),
        h('div', { class: 'small muted center', style: 'margin-top:10px' }, '칼퇴 서바이버 v1.0 · 서버·광고·결제 없음 · 저장은 이 브라우저에만'),
      ),
    );
    const el = h('div', { class: 'screen', style: inGame ? 'z-index:20' : '' }, head('⚙ 설정', back), h('div', { class: 'scroll' }, body));
    if (inGame) { this.host.root.appendChild(el); return el; }
    this.mount(el);
    return el;
  }

  help() {
    const rows: [string, string][] = [
      ['🕹', '화면 아무 곳이나 누르고 끌면 이동합니다. 공격은 자동!'],
      ['💎', '적이 떨어뜨린 보석을 모아 레벨업 → 3개 중 하나를 고르세요.'],
      ['⭐', '무기를 최대 레벨(8)로 올리고 짝 패시브를 가진 채 엘리트 상자(📦)를 열면 진화!'],
      ['📄', '적을 쓰러뜨리면 궁극기 게이지가 찹니다. 오른쪽 아래 버튼으로 발동.'],
      ['🍱', '12:00 점심시간에 메뉴를 고르면 퇴근까지 효과가 유지됩니다.'],
      ['😤', '17:00 무렵 최종 보스 등장. 18:00까지 못 잡으면 "야근 확정" — 잡아야 퇴근!'],
      ['💝', '벌어온 월급으로 복지를 도입하면 영구히 강해집니다.'],
      ['🏆', '업적을 달성하면 새 무기·캐릭터·근무지가 해금됩니다.'],
      ['⌨', 'PC: WASD/방향키 이동, 스페이스 궁극기, Esc 일시정지.'],
    ];
    this.mount(h('div', { class: 'screen' },
      head('❓ 신입사원 안내서', () => this.title()),
      h('div', { class: 'scroll' }, h('div', { class: 'list' }, ...rows.map(([e, t]) => h('div', { class: 'card shop-item' }, h('div', { class: 'ic' }, e), h('div', { class: 'grow' }, t))))),
    ));
  }

  // ───────────── 결과 ─────────────
  results(w: World, st: Settlement, onRetry: () => void) {
    const p = this.host.profile;
    const rs = w.stats_;
    const win = rs.cleared;
    const total = w.weapons.reduce((a, x) => a + x.dmg, 0) || 1;
    const build = h('div', { class: 'build' });
    for (const wi of [...w.weapons].sort((a, b) => b.dmg - a.dmg)) {
      build.appendChild(h('div', null,
        h('div', { class: 'w' }, h('span', { class: 'e' }, wi.def.icon), h('span', { class: 'n' }, `${wi.def.name} ${wi.def.evolved ? '★' : `Lv${wi.level}`}`), h('span', { class: 'dmg' }, `${Math.round(wi.dmg).toLocaleString('ko-KR')} · ${wi.kills.toLocaleString('ko-KR')}처치`)),
        h('div', { class: 'dmgbar' }, h('i', { style: `width:${(wi.dmg / total) * 100}%` })),
      ));
    }
    const grants = h('div', null, ...st.grants.map((g, i) => h('div', { class: 'grant', style: `animation-delay:${300 + i * 150}ms` },
      h('span', { class: 'e' }, g.a.icon), h('div', null, h('b', null, `🏆 ${g.a.name}`), h('span', null, g.text)))));
    if (st.heatUnlocked) grants.appendChild(h('div', { class: 'grant' }, h('span', { class: 'e' }, '🔥'), h('div', null, h('b', null, `야근 강도 ${st.heatUnlocked} 해금`), h('span', null, '더 높은 강도에 도전해 보세요'))));
    const shareText = () => {
      const tpl = pickStr(SHARE_TEMPLATES, '[칼퇴 서바이버] {char}로 {stage}에서 {time} 버팀! Lv{level}, {kills}처치');
      return tpl.replace('{stage}', w.cfg.stage.name).replace('{time}', clockText(w))
        .replace('{level}', String(w.player.level)).replace('{kills}', rs.kills.toLocaleString('ko-KR')).replace('{char}', w.cfg.character.name);
    };
    const share = btn('📣 자랑하기', async () => {
      const text = shareText();
      const r = await shareCard(w, st.total, text);
      if (r === 'shared') return;
      // 공유 시트가 없으면 카드 이미지를 보여 준다(길게 눌러 저장) + 문구 복사
      const url = shareCardDataUrl(w, st.total);
      const wrap = h('div', { class: 'modal-wrap confirm-wrap' });
      const ta = h('textarea', { class: 'prompt-text', style: 'height:64px', readonly: 'true' }) as HTMLTextAreaElement;
      ta.value = text;
      const copy = btn('문구 복사', () => {
        ta.select();
        const done = () => { copy.textContent = '복사됨!'; };
        try { navigator.clipboard.writeText(text).then(done, () => { try { document.execCommand('copy'); done(); } catch { /* 선택된 상태로 둔다 */ } }); }
        catch { try { document.execCommand('copy'); done(); } catch { /* 선택된 상태로 둔다 */ } }
      }, 'btn primary');
      wrap.appendChild(h('div', { class: 'modal' },
        h('div', { class: 'modal-kicker' }, 'SHARE'),
        h('div', { class: 'modal-title' }, '📣 결과 카드'),
        h('div', { class: 'modal-sub' }, '이미지를 길게 눌러 저장하거나 공유하세요'),
        url ? h('img', { class: 'share-img', src: url, alt: '칼퇴 서바이버 결과 카드' }) : null,
        ta,
        h('div', { class: 'row gap' }, btn('닫기', () => wrap.remove(), 'btn ghost grow'), copy),
      ));
      this.host.root.appendChild(wrap);
    }, 'btn ghost');
    const killed = rs.killedBy;
    const goals = nextGoals(p, 3);
    this.mount(h('div', { class: 'screen' },
      h('div', { class: 'scroll' },
        h('div', { class: `result-head ${win ? 'win' : 'lose'}` },
          h('div', { class: 'big' }, win ? '🎉' : '😵'),
          h('h2', { class: win ? 'win' : 'lose' }, win ? (rs.overtimeSec > 0 ? `야근 ${fmtTime(rs.overtimeSec)} 후 퇴근` : '칼퇴 성공!') : killed ? '과로로 쓰러짐…' : '조퇴 처리…'),
          h('div', { class: 'quote' }, win ? pickStr(CLEAR_QUOTES, '오늘도 무사히 퇴근!') : pickStr(GAMEOVER_QUOTES, '내일은 칼퇴할 수 있을 거야…')),
          !win && killed ? h('div', { class: 'small muted', style: 'margin-top:4px' }, `결정타: ${killed}`) : null,
          st.newBest ? h('div', { style: 'margin-top:8px' }, h('span', { class: 'newbest' }, '🏅 신기록!')) : null,
        ),
        h('div', { class: 'kpis' },
          h('div', { class: 'kpi' }, h('div', { class: 'k' }, '⏱ 생존 시간'), h('div', { class: 'v' }, fmtTime(Math.min(w.t, BALANCE.runSeconds)))),
          h('div', { class: 'kpi' }, h('div', { class: 'k' }, '⭐ 레벨'), h('div', { class: 'v' }, `Lv ${w.player.level}`)),
          h('div', { class: 'kpi' }, h('div', { class: 'k' }, '💀 처치'), h('div', { class: 'v' }, rs.kills.toLocaleString('ko-KR'))),
          h('div', { class: 'kpi pay' }, h('div', { class: 'k' }, '💰 받은 월급'), h('div', { class: 'v y' }, `₩${st.total.toLocaleString('ko-KR')}`)),
        ),
        h('div', { class: 'small paybreak' },
          `기본 ₩${st.runCoins}` + (st.clearBonus ? ` + 칼퇴 보너스 ₩${st.clearBonus}` : '') + (st.overtimeBonus ? ` + 야근수당 ₩${st.overtimeBonus}` : '') + (st.dailyBonus ? ` + 오늘의 업무 ₩${st.dailyBonus}` : '') + ` · 보유 ₩${p.coins.toLocaleString('ko-KR')}`),
        grants,
        goals.length ? h('div', { class: 'sec-title' }, '🎯 다음 목표') : null,
        ...goals.map(g => h('div', { class: 'card goal' },
          h('div', { class: 'row gap' }, h('span', { class: 'gi' }, g.a.icon), h('div', { class: 'grow' },
            h('b', null, g.a.name), h('div', { class: 'small' }, `${g.a.desc} · 보상: ${rewardLabel(g.a)}`),
            h('div', { class: 'bar', style: 'margin-top:5px' }, h('i', { style: `width:${g.k * 100}%` })),
          )),
        )),
        h('div', { class: 'tip' }, `💡 ${pickStr(TIPS, '')}`),
        h('div', { class: 'sec-title' }, '🗡 무기별 피해'),
        build,
        h('div', { class: 'row gap', style: 'flex-wrap:wrap;margin-bottom:8px' },
          ...w.passives.map(x => h('span', { class: 'pill' }, `${x.def.icon} ${x.def.name} ${x.level}`)),
          w.lunch ? h('span', { class: 'pill m' }, `${w.lunch.icon} ${w.lunch.name}`) : null,
        ),
      ),
      h('div', { class: 'col gap result-actions' },
        btn('🔁 다시 출근', onRetry, 'btn primary big'),
        h('div', { class: 'row gap' },
          btn('🏠 메인', () => this.title(), 'btn ghost grow'),
          st.total > 0 ? btn('💝 복지', () => this.shop(), 'btn ghost grow') : null,
          share,
        ),
      ),
    ));
  }
}

function fmtNum(n: number) { return Math.floor(n).toLocaleString('ko-KR'); }

function rewardLabel(a: AchievementDef): string {
  const r = a.reward;
  switch (r.kind) {
    case 'coins': return `₩${r.amount}`;
    case 'weapon': return `무기 ${WEAPON.get(r.id!)?.icon ?? ''} ${WEAPON.get(r.id!)?.name ?? ''}`;
    case 'passive': { const x = PASSIVES.find(q => q.id === r.id); return `패시브 ${x?.icon ?? ''} ${x?.name ?? ''}`; }
    case 'character': return `캐릭터 ${CHARACTERS.find(c => c.id === r.id)?.name ?? ''}`;
    case 'stage': return `근무지 ${STAGES.find(s => s.id === r.id)?.name ?? ''}`;
    case 'lunch': { const x = LUNCHES.find(q => q.id === r.id); return `점심 ${x?.icon ?? ''} ${x?.name ?? ''}`; }
    case 'meta': { const x = META_UPGRADES.find(q => q.id === r.id); return `복지 ${x?.icon ?? ''} ${x?.name ?? ''}`; }
    case 'feature': return r.id === 'daily' ? '오늘의 업무' : r.id === 'heat' ? '야근 강도' : r.id === 'overtime' ? '야근 모드' : String(r.id);
  }
  return '';
}
