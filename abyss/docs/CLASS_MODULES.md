# 직업 모듈 규약 (Class modules)

10개 직업 중 기본 3개(전사·레인저·소서러)는 코어 파일에 있고, 해금 직업 7개는 각자 폴더에 있습니다.

```
src/classes/<id>/
  data.ts   ClassDef + SkillDef 목록 (순수 데이터; data/classes.ts가 모음)
  sim.ts    기술 동작 등록 (sim/kit 사용)          ← src/classes/sim.ts 가 import
  art.ts    외형·무기·투사체·장판·이펙트·아이콘 등록 ← src/classes/art.ts 가 import
  sfx.ts    효과음 등록                            ← src/classes/sfx.ts 가 import
```

id 접두어: paladin `pl_`, assassin `as_`, lancer `ln_`, necromancer `nc_`, druid `dr_`, monk `mk_`, voidknight `vk_`.
투사체 kind, 장판 kind, fx 이벤트 kind, 이펙트 kind, 버프 id, 효과음 이름도 같은 접두어를 씁니다 (예: `pl_hammer`, `nc_mageTurret`, `dr_stormCloud`).

## 1. 데이터 (data.ts)

`SkillDef` 주요 필드 (`src/data/classes.ts`):
- `kind`: `melee`(대상에게 다가가서 사용) · `proj`(방향) · `target`(지점, `range`까지) · `self` · `move`
- `pct(r)`: 무기 피해 대비 % — 모든 피해는 `roll(g, pct, elem, via)`로 굴립니다.
- `anim`: 영웅 자세 `'attack'`(무기 휘두르기/찌르기) 또는 `'cast'`(손을 드는 시전)
- `move`: `'teleport' | 'leap' | 'dash' | 'behind'` — 시전 전에 도착 지점을 계산해 `act.tx/ty`에 넣어 줍니다. `leap`/`dash` 행동은 매 틱 영웅 위치를 출발점→도착점으로 보간합니다.
- `timing`: `{ kind?, dur?, rel?, hitAt?, invuln? }` — 행동 길이(초, `rel`이면 공격 시간 배수), 적중 시점 비율, 무적 시간. 기본값은 공격 1회 시간, 50% 지점 적중.
- `ai`: 테스트 봇이 기술을 쓰는 조건(`crowd`, `boss`, `minDist`, `maxDist`, `lowHp`, `buff`).

## 2. 시뮬레이션 (sim.ts)

```ts
import { registerSkills, roll, shoot, addArea, addBuff, monstersNear, ... } from '../../sim/kit';
registerSkills({
  pl_zeal: {
    tick(c, dt) { /* 행동 중 매 틱 (apply 전) */ },
    apply(c) { /* 적중 시점 1회 */ },
    canCast(g, x, y, targetId, rank) { return true; }, // 거짓이면 마나를 쓰지 않고 실패
  },
});
```
`c = { g, h, a, def, rank, ang }` — `a`는 영웅 행동(`a.t`, `a.dur`, `a.tx/ty`, `a.targetId`, `a.ids`, `a.data` 자유 사용).

kit 도우미: `roll`, `heroRoll`, `hurtMonster`, `shoot(g, kind, ang, dmg, opts)`, `spawnProj`, `addArea`, `addBuff(g, id, 이름, 초, mods, 색)`,
`monstersNear`, `monstersOnLine`, `monstersInCone`, `corpsesNear`, `meleeTargets`, `nearestMonster`, `heal`, `capAreas`,
`fx(g, kind, x, y, o)`, `sfx(g, id, x, y)`, `shake(g, v)`, `swingFx(g, skill, ang, r)`(근접 궤적), `los`, `circleFree`, `breakPropsNear`.

- 투사체(`Proj`): `pierce`, `homing`+`targetId`, `aoe`(폭발), `rehit`(같은 적을 N초마다 다시 때림), `ghost`(벽 통과),
  `motion`(PROJ_MOTION 키: 매 틱 속도/위치 조정), `onHit`(PROJ_HIT 키), `data`(자유).
- 장판(`Area`): 기본 동작 — `tick>0`이면 매 틱 안의 적 전원 피해(0이면 1회), `follow`(영웅을 따라다님),
  `proj`(파수꾼: 틱마다 가장 가까운 적에게 그 투사체 발사, `data.range/speed/life/pierce/homing`), `data.heal`, `data.pull`, `data.chill`, `data.fear`, `data.noDmg`.
  추가 로직은 `AREA_TICK[kind] = (g, a) => {...}`.
- 버프 `mods`: `dmgPct, ias, armorPct, armor, lifeSteal, manaSteal, dodge, ms, hpRegen, mpRegen, crit, critDmg, resAll, block, thorns, dmgTaken`(받는 피해 % 감소).
- 원소: `phys | fire | cold | light | poison` (독은 3초 지속 피해). `via`: 'melee' | 'proj' | 'spell' (타격 연출·효과음 결정).
- 시전 시작 때 `cast_<skillid>` 효과음이 자동 재생되고, 적중 시 원소별 타격음·히트스톱은 자동입니다.

## 3. 그래픽 (art.ts) — `src/render/registry.ts`

- `CLASS_LOOK[cls] = (h, common, chestTier) => Look` — `common`에 무기·보조장비·투구·등급 정보가 이미 들어 있음.
- `ITEM_KIND[아이템분류] = 무기/보조 kind` — 새 분류: `spear→lance`(창기사), `claw→katar`(암살자), `knuckle→knuckle`(수도승), `scythe→scythe`(강령술사), `pouch→pouch`, `skull→skull`, `totem→totem`.
- `WEAPON_ART[kind] = { draw(c, tier, steel, edge, L, glow), style: 'slash'|'thrust'|'punch', heavy?, icon? }`
- `OFFHAND_ART[kind] = { draw(c, x, y, tier, pose, color), icon(c, tier, gem) }`
- `DECOR[key] = (c, L, pose, anchors, 'back'|'front')` — `Look.decor = key`로 연결 (가면, 두건, 망토 장식, 오라 등).
- `PROJ_ART[kind] = { draw(p, d), light?: [반경, 'r,g,b'], trail?: ['r,g,b', 폭] }` — `d = { c, cam, z, time, fx, sx, sy, ang }` (sy는 비행 높이 적용됨).
- `AREA_ART[kind] = { draw(a, d), air?(a, d), light?(a) }` — `d.rx` 반경(px, 타원 ry = rx/2).
- `FX_EVENT[kind] = (e, host)` — sim의 `fx(g, kind, …)` 이벤트에 반응해 입자/이펙트 생성 (`host.fx.burst/add/effect/stain`, `host.shake`, `host.delay`, `host.low`).
- `EFFECT_ART[kind] = { ground?(e, d), air?(e, d), light?(e, k) }` — `fx.effect(kind, x, y, 지속, {...})`로 띄운 시간제 이펙트 그리기.
- `SKILL_ICON[icon] = { tint: [안쪽, 바깥], draw(c, glow) }` — 64×64, 원점이 가운데.
- `BUFF_ART[buffId] = (c, sx, sy, z, time, buff, fx, hero)` — 버프 중 영웅 주위 연출.

좌표: 월드 → 화면 `cam.sxOf(x, y)`, `cam.syOf(x, y)`; 반경 r(타일) → 화면 `r * RX * z` (`RX` in `render/iso`).
입자는 `fx.add({...})` / `fx.burst(...)`; 가산 합성은 `add: true`. 저사양(`fx.low`)에서는 개수를 줄이세요.

## 4. 효과음 (sfx.ts) — `src/platform/sfx.ts`

```ts
import { registerSfx, aliasSfx, M, COMBAT, whoosh, thud, ... } from '../../platform/sfx';
import { lay, ... } from '../../platform/dsp';
registerSfx('cast_pl_zeal', (r) => lay(0.4, [whoosh(r, 0.3, 300, 2400), 0, 1]), M(0.5, { v: 3 }));
aliasSfx('cast_pl_strike', '');   // 기본 공격 시작음은 보통 비움 (휘두름 소리는 skill 쪽에서 'swing')
```
`M(음량, { v: 변형 수, pj: 음높이 흔들림, cd: 최소 간격 ms, verb: 잔향, max: 동시 재생 수 })`.

## 5. 확인 방법

```bash
npx tsc --noEmit -p abyss/tsconfig.json
npx vitest run --config abyss/vite.config.ts tests/rules.test.ts        # 모든 직업의 모든 기술을 실제로 시전
# 개인 빌드 + 스크린샷 (다른 작업과 겹치지 않게 개인 폴더 사용)
npx vite build --config abyss/vite.config.ts --outDir $T/dist-<id> --emptyOutDir
DIST=$T/dist-<id> OUT=$T/<id>.html node abyss/scripts/singlefile.mjs
node abyss/scripts/classshots.mjs <id> $T/shots-<id> $T/<id>.html
```
