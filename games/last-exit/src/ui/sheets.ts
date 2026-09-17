// 거점 화면과 시트(패널) 구성
import type { App } from './app';
import type { WeaponId, Difficulty, LootId, AbilityId } from '../sim/types';
import { h, fmtTime } from './dom';
import { LOOT, WEAPONS, ABILITIES, ENEMIES, BAG, ECONOMY, DIFFICULTY, ESCAPE, PLAYER } from '../data/balance';
import { SHOP } from '../data/economy';
import { LOOT_IDS } from '../data/loot';
import { zoneDef, ZONES, TOTAL_ZONES } from '../data/zones';
import { bagWeight, bagValue, weightSlow } from '../sim/state';
import { unopenedChests, floorLootCount, droneOffer } from '../sim/zone';
import { iconCanvas } from '../render/sprites';
import * as store from '../platform/storage';

const WEAPON_IDS: WeaponId[] = ['rifle', 'shotgun', 'staff'];
const ENEMY_IDS = ['chaser', 'runner', 'shooter', 'armored', 'bomber', 'boss'] as const;

export function titleScreen(app: App): HTMLElement {
  const m = app.blob.meta; const hasRun = !!app.blob.run;
  return h('div', { id: 'title' },
    h('div', { class: 'logo' }, '🎒'),
    h('h1', {}, h('small', {}, '한 손 조작 탈출 액션 · 웹 베타'), '털고 튀어!', h('br'), '라스트 엑시트'),
    h('div', { class: 'sub' }, '무기를 고르고 위험 구역에 들어가 전리품을 챙기세요. 살아서 탈출해야 보관됩니다. 더 깊이 갈수록 좋은 보물, 그러나 죽으면 이번 출정 전리품은 사라집니다.'),
    h('div', { class: 'vault' }, h('span', {}, '보관 재화', h('br'), h('small', {}, '탈출로 확정된 재화 · 사망해도 유지')), h('b', {}, `◆ ${m.vault}`)),
    h('div', { class: 'menu' },
      hasRun ? h('button', { class: 'primary', onclick: () => app.resumeRun() }, `이어하기 (${app.blob.run!.zone}구역 · ${app.blob.run!.label})`) : null,
      h('button', { class: hasRun ? '' : 'primary', onclick: () => { app.audio.unlock(); app.openSheet('start'); } }, hasRun ? '새 출정 (진행 중 출정 포기)' : '출정'),
      h('div', { class: 'row' }, h('button', { onclick: () => app.openSheet('shop') }, '무기 해금·수납 보강'), h('button', { onclick: () => app.openSheet('records') }, '기록·도감')),
      h('div', { class: 'row' }, h('button', { onclick: () => app.openSheet('help') }, '도움말'), h('button', { onclick: () => app.openSheet('settings') }, '설정')),
    ),
    h('div', { class: 'foot' },
      `기록: 출정 ${m.records.runs} · 탈출 ${m.records.escapes} · 최고 가치 ◆${m.records.bestValue} · 최고 도달 ${m.codex.bestZone}구역`, h('br'),
      store.storageInfo.available ? '저장: 브라우저 로컬 저장 사용 중' : `⚠ 브라우저 저장 불가(${store.storageInfo.reason}) — 진행이 보관되지 않습니다`, h('br'),
      '이어하기: 전투 중 종료하면 구역 진입 시점부터 다시 시작합니다.'),
  );
}

function head(app: App, title: string, onClose?: () => void): HTMLElement { return h('h2', {}, title, h('button', { class: 'close', onclick: onClose || (() => app.closeSheet()) }, '닫기')); }
function icon(kind: Parameters<typeof iconCanvas>[0], size = 48, extra?: any): HTMLElement { const cv = iconCanvas(kind, size, extra); cv.className = 'spr'; return cv; }

export function buildSheet(app: App, kind: string, data: any): HTMLElement {
  switch (kind) {
    case 'start': return startSheet(app);
    case 'shop': return shopSheet(app);
    case 'records': return recordsSheet(app);
    case 'settings': return settingsSheet(app);
    case 'help': return helpSheet(app);
    case 'pause': return pauseSheet(app, data);
    case 'bag': return bagSheet(app);
    case 'ability': return abilitySheet(app);
    case 'door': return doorSheet(app);
    case 'safe': return safeSheet(app, data.id);
    case 'drone': return droneSheet(app);
    case 'result': return resultSheet(app, data);
  }
  return h('div', { class: 'panel' }, head(app, kind));
}

// ───────── 출정 시작 ─────────
function startSheet(app: App): HTMLElement {
  const m = app.blob.meta; let weapon: WeaponId = m.unlocks[m.lastWeapon as 'shotgun' | 'staff'] || m.lastWeapon === 'rifle' ? m.lastWeapon : 'rifle'; let diff: Difficulty = m.hardUnlocked ? m.lastDifficulty : 'normal';
  const seedIn = h('input', { type: 'number', placeholder: '시드 (비우면 무작위 · 테스트용)', inputmode: 'numeric' }) as HTMLInputElement;
  const cards = h('div', { class: 'cards' }); const segs = h('div', { class: 'seg' });
  const render = () => {
    cards.innerHTML = '';
    for (const id of WEAPON_IDS) {
      const w = WEAPONS[id]; const locked = id !== 'rifle' && !m.unlocks[id];
      cards.append(h('div', { class: 'card pick' + (weapon === id ? ' sel' : '') + (locked ? ' locked' : ''), onclick: () => { if (locked) { app.warn('해금 메뉴에서 먼저 해금하세요', 'warn'); return; } weapon = id; render(); } },
        h('div', { class: 'sprrow' }, icon(id, 48), h('div', { style: { flex: 1 } }, h('div', { class: 'name' }, w.name, locked ? h('small', {}, `잠김 · ◆${id === 'shotgun' ? ECONOMY.unlockShotgun : ECONOMY.unlockStaff}`) : weapon === id ? h('small', { style: { color: 'var(--accent)' } }, '선택됨') : null), h('div', { class: 'desc' }, w.desc))),
        h('div', { class: 'tag' }, `사거리 ${w.range} · 피해 ${w.dmg}${'pellets' in w && w.pellets > 1 ? `×${w.pellets}` : ''} · 간격 ${w.interval}초${id === 'staff' ? ` · 연결 ${w.chains}` : ''}`)));
    }
    segs.innerHTML = '';
    for (const d of ['normal', 'hard'] as Difficulty[]) segs.append(h('button', { class: diff === d ? 'on' : '', disabled: d === 'hard' && !m.hardUnlocked, onclick: () => { diff = d; render(); } }, DIFFICULTY[d].name + (d === 'hard' && !m.hardUnlocked ? ' (잠김)' : '')));
  };
  render();
  return h('div', { class: 'panel' }, head(app, '출정 준비'),
    h('h3', {}, '기본 무기 (출정 중 변경 불가)'), cards,
    h('h3', {}, '난이도'), segs, h('div', { class: 'muted' }, `${DIFFICULTY.normal.desc}. 어려움: ${DIFFICULTY.hard.desc}.`),
    h('div', { class: 'muted' }, `가방 최대 무게 ${BAG.baseMax + BAG.upgradeStep * m.bagUpgrades} · 체력 ${PLAYER.maxHp} · 입장료 없음`),
    seedIn,
    h('button', { class: 'primary', onclick: () => { const v = seedIn.value.trim(); app.closeSheet(); if (app.blob.run) { app.blob.run = null; } app.startRun(weapon, diff, v ? (parseInt(v, 10) >>> 0) : undefined); } }, '출정 시작'));
}

// ───────── 해금 ─────────
function shopSheet(app: App): HTMLElement {
  const m = app.blob.meta; const box = h('div', { class: 'cards' });
  const render = () => {
    box.innerHTML = '';
    for (const it of SHOP) {
      const owned = it.id === 'shotgun' ? m.unlocks.shotgun : it.id === 'staff' ? m.unlocks.staff : it.id === 'bag1' ? m.bagUpgrades >= 1 : m.bagUpgrades >= 2;
      const prereq = it.id === 'bag2' && m.bagUpgrades < 1;
      const can = !owned && !prereq && m.vault >= it.price;
      box.append(h('div', { class: 'card' + (owned ? ' locked' : '') },
        h('div', { class: 'sprrow' }, it.id === 'shotgun' || it.id === 'staff' ? icon(it.id, 44) : null, h('div', { style: { flex: 1 } }, h('div', { class: 'name' }, it.name, h('small', {}, owned ? '보유' : `◆${it.price}`)), h('div', { class: 'desc' }, it.desc))),
        owned ? null : h('button', { class: can ? 'primary' : '', disabled: !can, onclick: () => {
          const pr = store.purchase(m, it.id, it.price); if (!pr.ok) { app.warn(pr.msg || '구매 불가', 'warn'); return; }
          const r = app.saveAll(); app.audio.play('ability'); if (!r.ok) app.warn('구매는 적용됐지만 저장에 실패했습니다: ' + r.error, 'bad', 4); vault.textContent = `◆ ${m.vault}`; render();
        } }, prereq ? '1단계 먼저' : m.vault >= it.price ? '해금' : `◆${it.price - m.vault} 부족`)));
    }
  };
  const vault = h('b', {}, `◆ ${m.vault}`); render();
  return h('div', { class: 'panel' }, head(app, '해금 · 수납 보강', () => { app.closeSheet(); if (!app.state) app.showTitle(); }), h('div', { class: 'vault', style: { background: 'var(--panel2)', borderRadius: '12px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between' } }, '보관 재화', vault), h('div', { class: 'muted' }, '무기 해금은 선택지 확장입니다. 기본 소총으로도 보통 난이도 최종 탈출이 가능하도록 조정했습니다.'), box);
}

// ───────── 기록·도감 ─────────
function recordsSheet(app: App): HTMLElement {
  const m = app.blob.meta; const r = m.records;
  const hist = m.history.slice(0, 10).map(x => h('div', { class: 'kv' }, h('span', {}, `${x.kind === 'escaped' ? '탈출' : x.kind === 'dead' ? '사망' : '포기'} · ${x.zone}구역 · ${WEAPONS[x.weapon].name} · ${DIFFICULTY[x.difficulty].name} · ${fmtTime(x.time)}${x.boss ? ' · 보스' : ''}`), h('b', {}, x.kind === 'escaped' ? `+◆${x.value}` : '—')));
  return h('div', { class: 'panel' }, head(app, '기록 · 도감', () => { app.closeSheet(); if (!app.state) app.showTitle(); }),
    h('div', { class: 'two' },
      h('div', { class: 'box' }, h('h4', {}, '출정'), `총 ${r.runs}회 · 탈출 ${r.escapes} · 사망 ${r.deaths}`, h('br'), `조기 탈출 ${r.earlyEscapes}회`),
      h('div', { class: 'box' }, h('h4', {}, '최고'), `가치 ◆${r.bestValue} · 누적 ◆${r.totalValue}`, h('br'), `도달 ${m.codex.bestZone}구역${r.fastestFull ? ` · 최단 완주 ${fmtTime(r.fastestFull)}` : ''}`)),
    h('h3', {}, '최근 출정'), hist.length ? h('div', {}, ...hist) : h('div', { class: 'muted' }, '아직 기록이 없습니다.'),
    h('h3', {}, '적 도감'), h('div', { class: 'cards' }, ...ENEMY_IDS.map(id => m.codex.enemies.includes(id) || (id === 'boss' && m.codex.bossSeen) ? h('div', { class: 'card' }, h('div', { class: 'sprrow' }, icon(id, 48), h('div', {}, h('div', { class: 'name' }, ENEMIES[id].name), h('div', { class: 'desc' }, ENEMIES[id].hint), h('div', { class: 'tag' }, `체력 ${ENEMIES[id].hp} · 피해 ${ENEMIES[id].dmg || '패턴별'}`)))) : h('div', { class: 'card locked' }, h('div', { class: 'name' }, '???'), h('div', { class: 'tag' }, '아직 만나지 못한 적')))),
    h('h3', {}, '전리품 도감'), h('div', { class: 'cards' }, ...LOOT_IDS.map(id => h('div', { class: 'card' + (m.codex.loot.includes(id) ? '' : ' locked') }, h('div', { class: 'sprrow' }, icon(id, 40), h('div', {}, h('div', { class: 'name' }, m.codex.loot.includes(id) ? LOOT[id].name : '???'), h('div', { class: 'tag' }, `무게 ${LOOT[id].weight} · 가치 ${LOOT[id].value} · ${LOOT[id].desc}`)))))),
    h('h3', {}, '구역'), h('div', { class: 'muted' }, ZONES.map(z => `${z.index}. ${z.name}${z.escape ? ' (탈출 지점)' : ''}${z.boss ? ' (보스)' : ''}${z.ability ? ' (능력 선택)' : ''}`).join(' · ')));
}

// ───────── 설정 ─────────
function settingsSheet(app: App): HTMLElement {
  const st = app.blob.meta.settings;
  const slider = (label: string, key: 'sfx' | 'bgm') => { const inp = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: st[key] }) as HTMLInputElement; inp.oninput = () => { st[key] = parseFloat(inp.value); app.audio.setVolumes(st.sfx, st.bgm); }; inp.onchange = () => { app.saveAll(); app.audio.play('ui'); }; return h('label', { class: 'opt' }, label, inp); };
  const toggle = (label: string, key: 'shake' | 'lowFx') => { const inp = h('input', { type: 'checkbox' }) as HTMLInputElement; inp.checked = st[key]; inp.onchange = () => { st[key] = inp.checked; app.saveAll(); if (app.renderer) { app.renderer.fx.shakeOn = st.shake; app.renderer.fx.quality = st.lowFx ? 0.4 : 1; } }; return h('label', { class: 'opt' }, label, inp); };
  return h('div', { class: 'panel' }, head(app, '설정', () => { app.closeSheet(); if (!app.state) app.showTitle(); }),
    slider('효과음 음량', 'sfx'), slider('배경음 음량', 'bgm'), toggle('화면 흔들림', 'shake'), toggle('저사양 모드 (파티클 감소)', 'lowFx'),
    h('div', { class: 'muted' }, `저장소: ${store.storageInfo.available ? '브라우저 로컬 저장 사용 가능' : '사용 불가 (' + store.storageInfo.reason + ')'} · 마지막 저장: ${app.saveStatus || '—'}`),
    h('div', { class: 'muted' }, '이어하기 정책: 전투 중 종료·새로고침 → 현재 구역 진입 시점부터 재도전 (그 구역에서 얻은 전리품·진행은 되돌아감). 구역 완료·능력 선택 후에는 그 상태가 저장됨. 탈출·사망 확정 후에는 종료된 출정을 복구하지 않음.'),
    h('button', { class: 'danger', onclick: () => app.confirm('저장 초기화', '보관 재화·해금·기록·진행 중 출정이 모두 삭제됩니다. 되돌릴 수 없습니다.', '초기화', () => { store.wipe(); const l = store.load(); app.blob = l.blob; app.showTitle(); app.modalMsg('완료', '저장 데이터를 초기화했습니다.'); }, true) }, '저장 데이터 초기화'));
}

// ───────── 도움말 ─────────
function helpSheet(app: App): HTMLElement {
  return h('div', { class: 'panel' }, head(app, '도움말', () => { app.closeSheet(); if (!app.state) app.showTitle(); }),
    h('h3', {}, '조작'), h('ul', { class: 'tut' }, h('li', {}, '이동: 화면 아래쪽 빈 곳을 누른 채 끌기 (누른 곳에 조이스틱이 생김)'), h('li', {}, '공격: 자동. 사거리 안에서 시야가 닿는 가장 가까운 적을 노림'), h('li', {}, `대시: 오른쪽 아래 버튼. 이동 방향(정지 시 마지막 방향)으로 짧게 이동, ${PLAYER.dashInvuln}초 무적, 재사용 ${PLAYER.dashCooldown}초`), h('li', {}, '가방: 버튼을 누르면 전투가 멈추고 물건을 버릴 수 있음'), h('li', {}, 'PC: WASD/방향키 이동, 스페이스 대시, E 상호작용, B 가방, Esc 일시정지')),
    h('h3', {}, '한 판의 흐름'), h('ul', { class: 'tut' }, h('li', {}, '6개 구역을 순서대로 진행. 구역의 적을 모두 처치하면 출구가 열림. 떠나면 되돌아올 수 없음'), h('li', {}, '1·3·5구역 완료 후 능력 3개 중 1개 선택 (최대 2단계)'), h('li', {}, `2·4구역 완료 후 탈출 지점에서 "탈출 요청" → ${ESCAPE.need}초 버티면 전리품 확정. 다음 구역으로 가면 그 탈출 기회는 사라짐`), h('li', {}, '3구역 완료·5구역 진입 시 무기 강화'), h('li', {}, '6구역 보스를 처치하면 최종 출구가 열림')),
    h('h3', {}, '전리품과 무게'), h('ul', { class: 'tut' }, ...LOOT_IDS.map(id => h('li', {}, `${LOOT[id].name}: 무게 ${LOOT[id].weight}, 가치 ${LOOT[id].value}`)), h('li', {}, `가방 ${BAG.baseMax}까지. 적재율 60%부터 느려지며 최대 ${Math.round(BAG.maxSlow * 100)}% 감속. 대시는 무게와 무관`), h('li', {}, '출정 중 전리품은 "미확정". 살아서 탈출해야 보관 재화가 됨. 사망하면 이번 전리품만 잃고 보관 재화·해금은 유지')),
    h('h3', {}, '적'), h('ul', { class: 'tut' }, ...ENEMY_IDS.map(id => h('li', {}, `${ENEMIES[id].name}: ${ENEMIES[id].hint}`))),
    h('h3', {}, '이어하기'), h('p', {}, '전투 중 종료·새로고침하면 현재 구역 진입 시점부터 다시 시작합니다. 구역 완료·능력 선택 상태는 저장됩니다.'),
    app.state ? h('button', { onclick: () => { app.closeSheet(); app.tutorial.step = 0; app.tutorial.startX = app.state!.player.x; app.tutorial.startY = app.state!.player.y; app.showTutorial(); } }, '튜토리얼 다시 보기') : null);
}

// ───────── 일시정지 ─────────
function pauseSheet(app: App, data: { returned?: boolean }): HTMLElement {
  const s = app.state!;
  return h('div', { class: 'panel' }, head(app, data.returned ? '돌아오셨습니다' : '일시정지'),
    data.returned ? h('p', {}, '화면을 벗어나 자동으로 멈췄습니다. 준비되면 계속하세요.') : null,
    h('div', { class: 'muted' }, `${s.zone}구역 ${zoneDef(s.zone).name} · 체력 ${Math.ceil(s.player.hp)}/${s.player.maxHp} · 가방 ${bagWeight(s)}/${s.bag.maxWeight} · 미확정 ◆${bagValue(s)} · 경과 ${fmtTime(s.time)}`),
    h('button', { class: 'primary', onclick: () => app.closeSheet() }, '계속하기'),
    h('div', { class: 'btnrow' }, h('button', { onclick: () => app.openSheet('settings') }, '설정'), h('button', { onclick: () => app.openSheet('help') }, '도움말')),
    h('div', { class: 'muted' }, '지금 나가면: 이 구역 진입 시점부터 이어할 수 있습니다 (이 구역에서 얻은 전리품·진행은 되돌아감).'),
    h('button', { class: 'danger', onclick: () => app.confirm('출정 포기', '이번 출정의 미확정 전리품을 모두 잃습니다. 보관 재화·해금은 유지됩니다.', '포기하고 거점으로', () => app.abandonRun(), true) }, '출정 포기 (거점으로)'),
    h('button', { class: 'ghost', onclick: () => { app.snapshot('구역 ' + s.zone + ' 진입'); app.showTitle(); } }, '거점으로 (구역 진입 시점부터 이어하기)'),
  );
}

// ───────── 가방 ─────────
function bagSheet(app: App): HTMLElement {
  const s = app.state!; const list = h('div', { class: 'cards' }); const sum = h('div', {});
  const render = () => {
    list.innerHTML = ''; const w = bagWeight(s), v = bagValue(s), slow = weightSlow(s);
    sum.innerHTML = `<div class="kv"><span>무게</span><b>${w} / ${s.bag.maxWeight}${slow > 0 ? ` (감속 ${Math.round(slow * 100)}%)` : ''}</b></div><div class="kv"><span>미확정 가치</span><b>◆${v}</b></div>`;
    for (const id of LOOT_IDS) {
      const n = s.bag.items[id]; const d = LOOT[id];
      const row = h('div', { class: 'bagrow' }, h('div', { class: 'nm' }, `${d.name} ×${n}`, h('small', {}, `무게 ${d.weight}씩 · 가치 ${d.value}씩 · 소계 ${n * d.weight} / ◆${n * d.value}`)),
        h('button', { disabled: n <= 0, onclick: () => { app.act({ type: 'drop', loot: id, n: 1 }); render(); } }, '1개'),
        h('button', { disabled: n <= 0, onclick: () => { app.act({ type: 'drop', loot: id, n: Math.min(3, n) }); render(); } }, '3개'),
        h('button', { class: 'danger', disabled: n <= 0, onclick: () => app.confirm('전부 버리기', `${d.name} ${n}개(무게 ${n * d.weight}, 가치 ◆${n * d.value})를 모두 버립니다.`, '버리기', () => { app.act({ type: 'drop', loot: id, n }); render(); }, true) }, '전부'));
      list.append(row, n > 0 ? h('div', { class: 'preview' }, `1개 버리면 → 무게 ${w - d.weight}, 가치 ◆${v - d.value}`) : h('div', { class: 'preview' }, '없음'));
    }
  };
  render();
  return h('div', { class: 'panel' }, head(app, '가방 (전투 정지 중)'), sum, list, h('div', { class: 'muted' }, '버린 물건은 바로 옆 바닥에 떨어지며 잠시 후 다시 주울 수 있습니다. 가치는 그대로입니다.'), h('button', { class: 'primary', onclick: () => app.closeSheet() }, '닫고 계속'));
}

// ───────── 능력 선택 ─────────
function abilitySheet(app: App): HTMLElement {
  const s = app.state!; const offer = s.abilityOffer || []; let sel: AbilityId | null = null;
  const cards = h('div', { class: 'cards' }); const btn = h('button', { class: 'primary', disabled: true, onclick: () => { if (!sel) return; if (app.act({ type: 'pickAbility', id: sel })) { app.audio.play('ability'); app.snapshot('능력 선택 완료'); app.closeSheet(); } } }, '이 능력 선택');
  const render = () => {
    cards.innerHTML = '';
    for (const id of offer) {
      const a = ABILITIES[id]; const cur = s.abilities[id] || 0;
      cards.append(h('div', { class: 'card pick' + (sel === id ? ' sel' : ''), onclick: () => { sel = id; (btn as HTMLButtonElement).disabled = false; app.audio.play('ui'); render(); } }, h('div', { class: 'name' }, a.name, h('small', {}, `${cur}/${a.maxStack} → ${cur + 1}단계`)), h('div', { class: 'desc' }, (a.desc as any)(s.weapon, cur + 1)), cur > 0 ? h('div', { class: 'tag' }, `현재: ${(a.desc as any)(s.weapon, cur)}`) : null));
    }
  };
  render();
  return h('div', { class: 'panel' }, h('h2', {}, `능력 선택 (${s.zone}구역 완료)`), h('div', { class: 'muted' }, `현재 무기: ${WEAPONS[s.weapon].name}. 3개 중 1개, 한 번만 선택할 수 있고 되돌릴 수 없습니다.`), cards, btn);
}

// ───────── 문 확인 ─────────
function doorSheet(app: App): HTMLElement {
  const s = app.state!; const z = zoneDef(s.zone); const next = zoneDef(s.zone + 1);
  const ch = unopenedChests(s), fl = floorLootCount(s);
  return h('div', { class: 'panel' }, head(app, `다음 구역으로: ${next.index}. ${next.name}`),
    h('p', {}, `${next.desc}`),
    h('div', { class: 'card' }, h('div', { class: 'desc' }, `이 구역(${z.name})으로는 돌아올 수 없습니다.${ch ? ` 남은 상자 ${ch}개.` : ''}${fl ? ` 바닥 전리품 ${fl}개.` : ''}${!ch && !fl ? ' 남은 것은 없습니다.' : ''}`)),
    z.escape ? h('div', { class: 'card', style: { borderColor: 'var(--accent)' } }, h('div', { class: 'name' }, '⚠ 탈출 기회 포기'), h('div', { class: 'desc' }, `지금 탈출하면 ◆${bagValue(s)}를 확정할 수 있습니다. 다음 구역으로 가면 이 탈출 지점은 사라지고, ${s.zone === 2 ? '다음 탈출 기회는 4구역입니다' : '다음 탈출 기회는 보스 처치 후 6구역입니다'}. 체력 ${Math.ceil(s.player.hp)}/${s.player.maxHp}.`)) : null,
    s.escape && !s.escape.active && s.escape.progress > 0 ? h('div', { class: 'muted' }, '진행 중이던 탈출 준비는 사라집니다.') : null,
    h('div', { class: 'btnrow' }, h('button', { onclick: () => app.closeSheet() }, '머무르기'), h('button', { class: z.escape ? 'danger' : 'primary', onclick: () => { app.closeSheet(); app.act({ type: 'enterDoor' }); } }, z.escape ? '탈출 포기하고 이동' : '이동')));
}

// ───────── 경보 금고 ─────────
function safeSheet(app: App, id: number): HTMLElement {
  const s = app.state!; const c = s.chests.find(x => x.id === id)!;
  return h('div', { class: 'panel' }, head(app, '경보 금고'),
    h('div', { class: 'sprrow' }, icon('safe', 56), h('div', {}, h('p', {}, '열면 경보가 울리고 추가 적이 옵니다. 보상은 일반 상자보다 좋습니다.'))),
    h('div', { class: 'card' }, h('div', { class: 'name' }, '보상'), h('div', { class: 'desc' }, c.loot.map(l => `${LOOT[l.type].name} ×${l.count} (◆${LOOT[l.type].value * l.count})`).join(', ')), h('div', { class: 'tag' }, `총 무게 ${c.loot.reduce((a, l) => a + LOOT[l.type].weight * l.count, 0)} · 현재 가방 ${bagWeight(s)}/${s.bag.maxWeight}`)),
    h('div', { class: 'card', style: { borderColor: 'var(--danger)' } }, h('div', { class: 'name' }, '위험'), h('div', { class: 'desc' }, `추가 적 ${c.alarmCount} (전리품 없음). 현재 체력 ${Math.ceil(s.player.hp)}/${s.player.maxHp}.`)),
    h('div', { class: 'btnrow' }, h('button', { onclick: () => app.closeSheet() }, '그냥 두기'), h('button', { class: 'danger', onclick: () => { app.closeSheet(); app.act({ type: 'openSafe', id }); } }, '열기')));
}

// ───────── 드론 ─────────
function droneSheet(app: App): HTMLElement {
  const s = app.state!; const o = droneOffer(s); const d = s.zoneRt.drone!;
  return h('div', { class: 'panel' }, head(app, '떠돌이 정비 드론'),
    h('div', { class: 'sprrow' }, icon('drone', 56), h('div', {}, h('p', {}, '전리품을 받고 체력을 고쳐 줍니다. 이번 출정 전리품만 받으며, 보관 재화는 쓰지 않습니다. 한 번만 거래할 수 있습니다.'))),
    h('div', { class: 'card' }, h('div', { class: 'name' }, '지불'), h('div', { class: 'desc' }, o.pay ? `${LOOT[o.pay.type].name} ×${o.pay.count} (가치 ◆${LOOT[o.pay.type].value * o.pay.count})` : `부족 — 필요: ${d.pay.map(p => `${LOOT[p.type].name} ×${p.count}`).join(' 또는 ')}`)),
    h('div', { class: 'card' }, h('div', { class: 'name' }, '회복'), h('div', { class: 'desc' }, `체력 +${o.heal} (${Math.ceil(s.player.hp)} → ${Math.ceil(s.player.hp) + o.heal})`)),
    h('div', { class: 'btnrow' }, h('button', { onclick: () => app.closeSheet() }, '거절'), h('button', { class: 'primary', disabled: !o.pay || o.heal <= 0, onclick: () => { app.closeSheet(); app.act({ type: 'droneTrade' }); } }, '거래')));
}

// ───────── 결과 ─────────
function resultSheet(app: App, d: { before: number; awarded: number; already: boolean; saveOk: boolean; saveError?: string }): HTMLElement {
  const s = app.state!; const r = s.result!; const m = app.blob.meta; const ok = r.kind === 'escaped';
  const items = LOOT_IDS.filter(id => r.items[id] > 0).map(id => `${LOOT[id].name} ×${r.items[id]}`).join(', ') || '없음';
  const zoneStats = h('div', { class: 'muted' }, ZONES.filter(z => z.index <= s.zone).map(z => `${z.index}구역: 피해 ${Math.round(s.stats.damageTaken[z.index])} · 전리품 ◆${s.stats.lootValue[z.index]} · ${fmtTime(s.stats.time[z.index] || (z.index === s.zone ? s.zoneTime : 0))}`).join(' / '));
  return h('div', { class: 'panel' },
    h('div', { class: 'result-big ' + (ok ? 'ok' : 'bad') }, ok ? (r.boss ? '최종 탈출 성공!' : '탈출 성공!') : '출정 실패'),
    ok ? h('div', { class: 'kv' }, h('span', {}, '확정된 전리품 가치'), h('b', {}, `+◆${r.value}`)) : h('div', { class: 'kv' }, h('span', {}, '사망 원인'), h('b', { style: { color: 'var(--danger)' } }, r.cause)),
    h('div', { class: 'two' },
      ok ? h('div', { class: 'box keep' }, h('h4', {}, '보관 재화'), `◆${d.before} → ◆${m.vault}`, h('br'), `가져온 것: ${items}`) : h('div', { class: 'box lose' }, h('h4', {}, '잃은 것 (이번 출정)'), `미확정 전리품 ◆${bagValue(s)}`, h('br'), items),
      h('div', { class: 'box keep' }, h('h4', {}, '유지된 것'), `보관 재화 ◆${m.vault}`, h('br'), `해금: 소총${m.unlocks.shotgun ? '·산탄총' : ''}${m.unlocks.staff ? '·전기 지팡이' : ''}`, h('br'), `수납 보강 ${m.bagUpgrades}단계 · 최고 도달 ${m.codex.bestZone}구역`)),
    h('div', { class: 'muted' }, `${WEAPONS[s.weapon].name} 강화 ${s.tier}단계 · 능력: ${Object.entries(s.abilities).map(([k, v]) => `${ABILITIES[k as AbilityId].name} ${v}`).join(', ') || '없음'} · 도달 ${s.zone}구역 · ${fmtTime(s.time)} · 최대 무게 ${s.stats.maxWeight} · 버림 ${s.stats.drops}개 · 대시 ${s.stats.dashes}회`),
    zoneStats,
    ok && r.boss && s.difficulty === 'normal' ? h('div', { class: 'card', style: { borderColor: 'var(--gold)' } }, h('div', { class: 'name' }, '어려움 난이도 해금!')) : null,
    d.already ? h('div', { class: 'muted' }, '이 출정은 이미 정산되었습니다 (중복 지급 없음).') : null,
    h('div', { class: 'savestatus' + (d.saveOk ? '' : ' bad') }, d.saveOk ? '결과가 저장되었습니다.' : `⚠ 저장 실패: ${d.saveError || ''} — 이 화면을 닫기 전에 저장이 되지 않으면 결과가 유지되지 않을 수 있습니다.`),
    !d.saveOk ? h('button', { onclick: () => { const r2 = app.saveAll(); if (r2.ok) app.openSheet('result', { ...d, saveOk: true }); } }, '저장 다시 시도') : null,
    h('div', { class: 'btnrow' }, h('button', { onclick: () => app.showTitle() }, '거점으로'), h('button', { class: 'primary', onclick: () => { app.closeSheet(); app.retry(); } }, '같은 설정으로 다시 출정')));
}
