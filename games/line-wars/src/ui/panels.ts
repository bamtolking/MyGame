/** In-match panels: roster (편성), research (연구), enemy intel (상대), team (팀). */
import type { App } from './app.ts';
import { el, fmtTime } from './app.ts';
import { unitDef, FACTIONS } from '../core/data/units.ts';
import { ROSTER, ECON, UPGRADE } from '../core/data/balance.ts';
import { buyBlockReason, econCost, techCost, upgradeCost, rosterPop } from '../core/sim/commands.ts';
import { enemyThreat } from '../core/ai/ai.ts';
import type { UnitDef } from '../core/types.ts';
import type { Player } from '../core/sim/state.ts';

type PanelName = 'roster' | 'research' | 'enemy' | 'team';

const ROLE_KO: Record<string, string> = { tank: '전열', ranged: '원거리', aoe: '광역', antiarmor: '대장갑', antiair: '대공', support: '지원', artillery: '포병', flanker: '측면', air: '공중' };

export class Panels {
  app: App;
  current: PanelName | null = null;
  private host: HTMLElement | null = null;
  private root: HTMLElement | null = null;
  // roster state
  shopSel: string | null = null;
  cellSel = -1;
  moveMode = false;
  multiBuy = true;
  private cells: HTMLElement[] = [];
  private shopCards = new Map<string, HTMLElement>();
  private info: HTMLElement | null = null;
  private acts: HTMLElement | null = null;
  private mini: HTMLCanvasElement | null = null;
  private popEl: HTMLElement | null = null;
  private lastRosterSig = '';
  private dyn: (() => void) | null = null;

  constructor(app: App) { this.app = app; }

  toggle(n: PanelName) { if (this.current === n) this.close(); else this.open(n); }
  close() {
    this.current = null; this.root?.remove(); this.root = null; this.dyn = null; this.moveMode = false;
  }
  open(n: PanelName) {
    this.close();
    this.host = this.app.panelHost;
    this.current = n;
    const p = el('div', 'panel');
    const head = el('div', 'head');
    const title = n === 'roster' ? '편성' : n === 'research' ? '연구 · 기술 · 업그레이드' : n === 'enemy' ? '상대 정보 (실제 출격 기준)' : '팀';
    head.appendChild(el('h3', '', title));
    const close = el('button', 'close', '✕'); close.onclick = () => { this.app.audio.ui('tap'); this.close(); };
    p.appendChild(head); p.appendChild(close);
    const body = el('div', 'body');
    p.appendChild(body);
    // panels must not let taps fall through to the field
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    if (n === 'roster') this.buildRoster(head, body);
    else if (n === 'research') this.buildResearch(body);
    else if (n === 'enemy') this.buildEnemy(body);
    else this.buildTeam(body);
    this.root = p;
    this.host.appendChild(p);
    this.refresh();
  }
  refresh() {
    if (!this.root || !this.app.match) return;
    if (this.app.match.s.result) { this.close(); return; }
    this.dyn?.();
  }

  // ───────────────────────────── roster ─────────────────────────────
  private buildRoster(head: HTMLElement, body: HTMLElement) {
    const app = this.app, m = app.match!, hp = app.human;
    this.popEl = el('span', '', ''); this.popEl.style.fontSize = '13px'; this.popEl.style.color = 'var(--muted)';
    head.appendChild(this.popEl);
    const tog = el('label', 'toggle', `<input type="checkbox"> 연속 구매`);
    const cb = tog.querySelector('input')!; cb.checked = this.multiBuy; cb.onchange = () => { this.multiBuy = cb.checked; };
    tog.style.marginRight = '52px';
    head.appendChild(tog);
    // shop
    const shop = el('div', 'shop scroll');
    this.shopCards.clear();
    for (const id of FACTIONS[hp.faction].units) {
      const d = unitDef(id);
      const card = el('button', 'ucard');
      card.appendChild(app.unitIcon(id));
      const mid = el('div', '', `<div class="n">${d.name}</div><div class="m">인구${d.pop} · T${d.tier} · ${d.roles.map((r) => ROLE_KO[r]).join("/")}</div><div class="why"></div>`);
      card.appendChild(mid);
      card.appendChild(el('div', 'c', `${d.cost}<small>크레딧</small>`));
      card.onclick = () => { app.audio.ui('tap'); this.shopSel = this.shopSel === id ? null : id; this.cellSel = -1; this.moveMode = false; this.refreshRoster(true); };
      this.shopCards.set(id, card);
      shop.appendChild(card);
    }
    body.appendChild(shop);
    // grid
    const gw = el('div', 'gridwrap');
    gw.appendChild(el('div', 'gridhead', `<span>← 후방 (포병·지원)</span><span>위</span><span>전방 (전열) →</span>`));
    const grid = el('div', 'grid');
    this.cells = [];
    for (let i = 0; i < ROSTER.cols * ROSTER.rows; i++) {
      const c = el('button', 'cell' + (i % ROSTER.cols >= 6 ? ' front' : ''));
      c.onclick = () => this.tapCell(i);
      grid.appendChild(c); this.cells.push(c);
    }
    gw.appendChild(grid);
    gw.appendChild(el('div', 'gridhead', `<span>행 = 전장의 위/아래 출격 위치</span><span>아래</span><span>열 = 전방/후방</span>`));
    body.appendChild(gw);
    // info column
    const ri = el('div', 'rinfo col');
    this.info = el('div', 'card scroll'); this.info.style.flex = '1';
    this.acts = el('div', 'acts');
    this.mini = el('canvas', 'mini');
    ri.appendChild(this.info); ri.appendChild(this.acts); ri.appendChild(this.mini);
    body.appendChild(ri);
    this.lastRosterSig = '';
    this.dyn = () => this.refreshRoster(false);
    this.refreshRoster(true);
  }

  private tapCell(i: number) {
    const app = this.app, m = app.match!, hp = app.human;
    const e = hp.roster[i];
    if (this.moveMode && this.cellSel >= 0) {
      const r = m.command({ type: 'move', player: hp.index, from: this.cellSel, to: i });
      if (r.ok) { app.audio.ui('buy'); this.cellSel = i; } else { app.toast(r.reason ?? '이동 불가', true); app.audio.ui('err'); }
      this.moveMode = false; this.refreshRoster(true); return;
    }
    if (this.shopSel && !e) {
      const r = m.command({ type: 'buy', player: hp.index, unitId: this.shopSel, cell: i });
      if (r.ok) { app.audio.ui('buy'); app.tutorial?.onBuy(this.shopSel); if (!this.multiBuy) { this.cellSel = i; this.shopSel = null; } }
      else { app.toast(r.reason ?? '구매 불가', true); app.audio.ui('err'); }
      this.refreshRoster(true); return;
    }
    if (e) { this.cellSel = this.cellSel === i ? -1 : i; this.shopSel = null; app.audio.ui('tap'); }
    else if (!this.shopSel) { app.toast('왼쪽에서 병종을 먼저 선택하세요'); }
    this.refreshRoster(true);
  }

  private refreshRoster(force: boolean) {
    const app = this.app, m = app.match!, hp = app.human;
    if (!this.root || this.current !== 'roster') return;
    const pop = rosterPop(hp);
    this.popEl!.textContent = `인구 ${pop}/${ROSTER.popCap} · 크레딧 ${Math.floor(hp.credits)}`;
    // shop cards
    for (const [id, card] of this.shopCards) {
      const why = buyBlockReason(hp, id);
      card.classList.toggle('locked', !!why);
      card.classList.toggle('on', this.shopSel === id);
      (card.querySelector('.why') as HTMLElement).textContent = why ?? '';
    }
    // grid cells
    const sig = hp.roster.map((e) => (e ? e.unitId + (e.dispatched ? '' : '*') : '.')).join('') + `|${this.cellSel}|${this.moveMode}|${this.shopSel}`;
    if (force || sig !== this.lastRosterSig) {
      this.lastRosterSig = sig;
      hp.roster.forEach((e, i) => {
        const c = this.cells[i];
        c.innerHTML = '';
        if (e) { c.appendChild(app.unitIcon(e.unitId)); }
        c.classList.toggle('sel', this.cellSel === i);
        c.classList.toggle('new', !!e && !e.dispatched);
        c.classList.toggle('target', (this.moveMode && this.cellSel !== i) || (!!this.shopSel && !e));
      });
      this.renderInfo();
    }
    if (this.mini && app.renderer) app.renderer.drawMini(m, this.mini);
  }

  private renderInfo() {
    const app = this.app, hp = app.human, m = app.match!;
    const info = this.info!, acts = this.acts!;
    acts.innerHTML = '';
    let d: UnitDef | null = null;
    const e = this.cellSel >= 0 ? hp.roster[this.cellSel] : null;
    if (e) d = unitDef(e.unitId); else if (this.shopSel) d = unitDef(this.shopSel);
    if (!d) {
      info.innerHTML = `<h4>편성 안내</h4>병종 선택 → 빈 칸 탭 = 배치<br>배치된 병력 탭 → 이동/판매<br><br><span class="g">출격 전 취소는 100% 환급</span>, 출격 후 판매는 ${Math.round(ECON.sellRefund * 100)}% 환급.<br>이동은 무료. 변경 내용은 <b>다음 출격</b>부터 반영됩니다.<br><br>격자 오른쪽이 전방입니다. 위/아래 행은 전장의 위/아래로 출격합니다.`;
      return;
    }
    const w = d.weapon;
    const eff = w ? `공격 ${w.dmg}${w.burst ? `×${w.burst}` : ''} / ${w.cycle}초${w.aoe ? ` · 광역 ${w.aoe}` : ''}${w.pierce ? ` · 관통 ${w.pierce}` : ''}<br>사거리 ${w.range}${w.minRange ? ` (최소 ${w.minRange})` : ''} · 대상: ${w.targets === 'both' ? '지상+공중' : w.targets === 'air' ? '공중' : '지상'}${w.bonus ? `<br>추가 피해: ${Object.entries(w.bonus).map(([k, v]) => `${{ light: '소형', medium: '중형', armored: '중장갑', structure: '건물', mechanical: '기계', biological: '생체' }[k as string] ?? k} ×${v}`).join(', ')}` : ''}` : d.ability ? `${d.ability.kind === 'repair' ? `수리 ${d.ability.amount}/초` : `보호막 ${d.ability.amount} (${d.ability.interval}초마다 최대 ${d.ability.maxTargets}기, ${d.ability.duration}초)`} · 범위 ${d.ability.range} · 생명당 총량 ${d.ability.pool}` : '';
    info.innerHTML = `<h4>${d.name} <span style="color:var(--muted);font-weight:500;font-size:11px">${d.roles.map((r) => ROLE_KO[r]).join('·')} · ${d.layer === 'air' ? '공중' : '지상'}</span></h4>
      <div>${d.cost} 크레딧 · 인구 ${d.pop} · ${d.tier}단계</div>
      <div>체력 ${d.hp} · 방어 ${d.armor} · 속도 ${d.speed}</div>
      <div>${eff}</div>
      <div class="g">장점: ${d.strengths}</div><div class="b">약점: ${d.weaknesses}</div>
      ${e ? `<div style="margin-top:4px;color:var(--muted)">${e.dispatched ? '출격 이력 있음 → 판매 시 ' + Math.floor(d.cost * ECON.sellRefund) + ' 환급' : '아직 미출격 → 취소 시 ' + d.cost + ' 전액 환급'}</div>` : `<div style="margin-top:4px;color:var(--muted)">${buyBlockReason(hp, d.id) ?? '빈 칸을 탭해 배치'}</div>`}`;
    if (e) {
      const mv = el('button', 'btn small' + (this.moveMode ? ' primary' : ''), this.moveMode ? '이동할 칸 선택…' : '이동');
      mv.onclick = () => { this.moveMode = !this.moveMode; app.audio.ui('tap'); this.refreshRoster(true); };
      const sell = el('button', 'btn small danger', e.dispatched ? `판매 (+${Math.floor(d.cost * ECON.sellRefund)})` : `취소 (+${d.cost})`);
      sell.onclick = () => { const r = m.command({ type: e.dispatched ? 'sell' : 'cancel', player: hp.index, cell: this.cellSel }); if (r.ok) { app.audio.ui('buy'); this.cellSel = -1; this.moveMode = false; } else { app.toast(r.reason ?? '불가', true); } this.refreshRoster(true); };
      acts.appendChild(mv); acts.appendChild(sell);
    }
  }

  // ───────────────────────────── research ─────────────────────────────
  private buildResearch(body: HTMLElement) {
    const app = this.app, m = app.match!, hp = app.human;
    const wrap = el('div', 'rcards scroll'); wrap.style.flex = '1';
    body.appendChild(wrap);
    const build = () => {
      wrap.innerHTML = '';
      const card = (title: string, lv: string, desc: string, btnLabel: string, why: string | null, fn: () => void) => {
        const c = el('div', 'rcard');
        c.appendChild(el('h4', '', `<span>${title}</span><span class="lv">${lv}</span>`));
        c.appendChild(el('p', '', desc));
        const b = el('button', 'btn' + (why ? '' : ' primary'), why ? `${btnLabel}<span class="sub">${why}</span>` : btnLabel);
        b.disabled = !!why; b.onclick = () => { fn(); build(); };
        c.appendChild(b); wrap.appendChild(c);
      };
      const cmd = (c: Parameters<typeof m.command>[0]) => { const r = m.command(c); if (r.ok) app.audio.ui('buy'); else { app.toast(r.reason ?? '불가', true); app.audio.ui('err'); } };
      // economy
      const ec = hp.econLevel < ECON.econMaxLevel ? econCost(hp.econLevel) : null;
      const payback = ec ? Math.round(ec / ECON.econIncomePerLevel) : 0;
      card('경제 연구', `${hp.econLevel}/${ECON.econMaxLevel}단계`, `초당 수입 +${ECON.econIncomePerLevel.toFixed(1)} (현재 ${m.income(hp).toFixed(1)}/초).${ec ? ` 투자금 회수까지 약 ${Math.floor(payback / 60)}분 ${payback % 60}초.` : ''} 지금의 병력 대신 미래 수입을 삽니다. 환불 불가.`, ec ? `연구 (${ec})` : '최대 단계', ec === null ? '최대 단계' : hp.credits < ec ? '자원 부족' : null, () => cmd({ type: 'econ', player: hp.index }));
      // tech
      const tc = techCost(hp.tech);
      const nextTier = hp.tech + 1;
      const unlocks = FACTIONS[hp.faction].units.map(unitDef).filter((d) => d.tier === nextTier).map((d) => d.name).join(', ');
      card('기술 단계', `${hp.tech}/3단계`, tc ? `${nextTier}단계 병종 해금: ${unlocks}. 환불 불가.` : '모든 병종이 해금되었습니다.', tc ? `${nextTier}단계 연구 (${tc})` : '최대 단계', tc === null ? '최대 단계' : hp.credits < tc ? '자원 부족' : null, () => cmd({ type: 'tech', player: hp.index }));
      // upgrades
      const ups: ['attack' | 'defense' | 'support', string, string][] = [
        ['attack', '공격 강화', `병력 공격력 +${Math.round(UPGRADE.attackPerLevel * 100)}%/단계`],
        ['defense', '방어 강화', `방어 +${UPGRADE.armorPerLevel}, 체력 +${Math.round(UPGRADE.hpPerLevel * 100)}%/단계`],
        ['support', '지원 강화', `수리·보호막 효과 및 총량 +${Math.round(UPGRADE.supportPerLevel * 100)}%/단계`],
      ];
      for (const [k, name, desc] of ups) {
        const lv = hp.upgrades[k]; const c = upgradeCost(lv);
        card(name, `${lv}/${ECON.upgradeMax}단계`, `${desc}. 다음 출격부터 적용 (이미 전장에 있는 병력은 그대로).`, c ? `강화 (${c})` : '최대 단계', c === null ? '최대 단계' : hp.credits < c ? '자원 부족' : null, () => cmd({ type: 'upgrade', player: hp.index, kind: k }));
      }
      const note = el('p', '', `<span style="color:var(--muted);font-size:12px">현재 크레딧 ${Math.floor(hp.credits)} · 연구/기술/업그레이드는 즉시 적용되지만 병력에는 다음 출격 스냅샷부터 반영됩니다. 연구 비용은 환불되지 않습니다.</span>`);
      wrap.appendChild(note);
    };
    build();
    let lastC = -1;
    this.dyn = () => { const c = Math.floor(hp.credits); if (c !== lastC) { lastC = c; build(); } };
  }

  // ───────────────────────────── enemy intel ─────────────────────────────
  private buildEnemy(body: HTMLElement) {
    const app = this.app, m = app.match!, hp = app.human;
    const wrap = el('div', 'scroll'); wrap.style.flex = '1';
    body.appendChild(wrap);
    const chips = (counts: Record<string, number>) => { const c = el('div', 'chips'); const ents = Object.entries(counts).sort((a, b) => unitDef(b[0]).cost * b[1] - unitDef(a[0]).cost * a[1]); if (!ents.length) c.appendChild(el('span', '', '<span style="color:var(--muted)">없음</span>')); for (const [id, n] of ents) { const ch = el('span', 'chip'); ch.appendChild(app.unitIcon(id, 1)); ch.appendChild(el('span', '', `${unitDef(id).name} ×${n}`)); c.appendChild(ch); } return c; };
    let lastSig = '';
    const build = () => {
      const enemies = m.s.players.filter((p) => p.team !== hp.team);
      const sig = enemies.map((p) => p.waveCount).join(',') + '|' + Math.floor(m.s.t / 5);
      if (sig === lastSig) return; lastSig = sig;
      wrap.innerHTML = '';
      const th = enemyThreat(m, hp.team, 2);
      const tchips = el('div', 'chips');
      const tag = (label: string, v: number, warn: boolean) => { if (v <= 0) return; tchips.appendChild(el('span', 'chip' + (warn ? ' threat' : ''), `${label} ${Math.round(v)}`)); };
      tag('공중', th.air, th.air > 200); tag('중장갑', th.armored, th.armored > 250); tag('광역', th.aoe, th.aoe > 200); tag('포병', th.artillery, th.artillery > 200); tag('측면', th.flank, th.flank > 0); tag('대공', th.antiair, false); tag('대장갑', th.antiarmor, false);
      const head = el('div', 'wave'); head.appendChild(el('h4', '', `<span>최근 출격 기준 위협 (크레딧 가치)</span>`)); head.appendChild(tchips);
      head.appendChild(el('p', '', `<span style="color:var(--muted);font-size:12px">아직 출격하지 않은 상대의 편성 변경은 보이지 않습니다. AI도 같은 규칙으로 아군의 출격만 봅니다.</span>`));
      wrap.appendChild(head);
      for (const p of enemies) {
        const w = p.waves[p.waves.length - 1];
        const box = el('div', 'wave');
        box.appendChild(el('h4', '', `<span>${p.name} · ${FACTIONS[p.faction].name}</span><span style="color:var(--muted);font-weight:500">${w ? `${w.idx + 1}차 출격 ${fmtTime(w.t)} · ${w.value} 크레딧` : '아직 출격 없음'}</span>`));
        box.appendChild(chips(w ? w.counts : {}));
        const prev = p.waves[p.waves.length - 2];
        if (prev && w) {
          const diff: string[] = [];
          for (const id of new Set([...Object.keys(w.counts), ...Object.keys(prev.counts)])) { const d = (w.counts[id] ?? 0) - (prev.counts[id] ?? 0); if (d !== 0) diff.push(`${unitDef(id).name} ${d > 0 ? '+' : ''}${d}`); }
          if (diff.length) box.appendChild(el('p', '', `<span style="font-size:12px;color:var(--warn)">직전 출격 대비 변화: ${diff.join(', ')}</span>`));
        }
        const field = m.fieldCounts(p.index);
        const fc = el('div', ''); fc.style.marginTop = '6px'; fc.innerHTML = `<span style="font-size:12px;color:var(--muted)">현재 전장 생존 병력:</span>`; fc.appendChild(chips(field));
        box.appendChild(fc);
        wrap.appendChild(box);
      }
      const mine = hp.waves[hp.waves.length - 1];
      const mb = el('div', 'wave'); mb.appendChild(el('h4', '', `<span>내 최근 출격</span><span style="color:var(--muted);font-weight:500">${mine ? `${mine.idx + 1}차 ${fmtTime(mine.t)} · ${mine.value} 크레딧` : '아직 없음'}</span>`)); mb.appendChild(chips(mine ? mine.counts : {}));
      wrap.appendChild(mb);
    };
    build();
    this.dyn = build;
  }

  // ───────────────────────────── team ─────────────────────────────
  private buildTeam(body: HTMLElement) {
    const app = this.app, m = app.match!, hp = app.human;
    const wrap = el('div', 'scroll'); wrap.style.flex = '1';
    body.appendChild(wrap);
    let lastSig = '';
    const build = () => {
      const allies = m.s.players.filter((p) => p.team === hp.team && !p.isHuman);
      const sig = allies.map((p) => `${p.waveCount}:${p.request}:${Math.floor(p.credits / 50)}:${p.econLevel}:${p.tech}`).join('|');
      if (sig === lastSig) return; lastSig = sig;
      wrap.innerHTML = '';
      wrap.appendChild(el('p', '', `<span style="color:var(--muted);font-size:12px">요청은 아군 AI의 다음 구매 우선순위를 바꿉니다. 자원이 없으면 병력이 생기지 않습니다. 비상 방어포는 사람이 결정합니다 (AI 아군은 사용하지 않음).</span>`));
      for (const p of allies) {
        const box = el('div', 'wave');
        const counts: Record<string, number> = {}; for (const e of p.roster) if (e) counts[e.unitId] = (counts[e.unitId] ?? 0) + 1;
        box.appendChild(el('h4', '', `<span>${p.name} · ${FACTIONS[p.faction].name}</span><span style="color:var(--muted);font-weight:500">크레딧 ${Math.floor(p.credits)} · 경제 ${p.econLevel} · 기술 ${p.tech}단계 · 다음 출격 ${Math.max(0, p.nextDispatchAt - m.s.t).toFixed(0)}초</span>`));
        const c = el('div', 'chips'); for (const [id, n] of Object.entries(counts)) { const ch = el('span', 'chip'); ch.appendChild(app.unitIcon(id, 0)); ch.appendChild(el('span', '', `${unitDef(id).name} ×${n}`)); c.appendChild(ch); }
        if (!Object.keys(counts).length) c.appendChild(el('span', '', '<span style="color:var(--muted)">편성 없음</span>'));
        box.appendChild(c);
        const row = el('div', 'chips'); row.style.marginTop = '6px';
        for (const [req, label] of [['antiair', '대공 지원'], ['frontline', '전열 보강'], ['economy', '경제 투자 주의']] as const) {
          const b = el('button', 'btn small' + (p.request === req ? ' primary' : ''), label);
          b.onclick = () => { const r = m.command({ type: 'request', player: hp.index, ally: p.index, request: p.request === req ? null : req }); if (r.ok) { app.audio.ui('buy'); app.toast(`${p.name}에게 요청: ${p.request ? label : '해제'}`); lastSig = ''; build(); } };
          row.appendChild(b);
        }
        box.appendChild(row);
        wrap.appendChild(box);
      }
    };
    build();
    this.dyn = build;
  }
}
