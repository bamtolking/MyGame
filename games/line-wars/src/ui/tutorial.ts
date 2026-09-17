/** Contextual tutorial for the practice mode: one hint at a time, tied to the current action. */
import type { App } from './app.ts';
import { unitDef } from '../core/data/units.ts';

interface Step { text: (app: App) => string; done: (app: App) => boolean; }

export class Tutorial {
  app: App;
  step = 0;
  private boughtAoe = false;
  private boughtAA = false;
  private enemyOpened = false;
  private steps: Step[] = [
    { text: () => '왼쪽 목록에서 병종을 선택하고 격자의 빈 칸을 탭해 배치하세요. 오른쪽 열이 전방입니다. (3기 이상)', done: (a) => a.human.roster.filter(Boolean).length >= 3 },
    { text: () => '좋습니다. 편성이 끝나면 아래 "출격 준비 완료"를 누르세요. 카운트다운 후 첫 부대가 자동으로 출격합니다.', done: (a) => a.match!.s.phase === 'battle' },
    { text: () => '첫 부대가 출격했습니다. 화면을 드래그/확대해 전선을 살펴보세요. 25초마다 편성표대로 부대가 다시 출격하고, 살아남은 병력과 합류합니다.', done: (a) => a.match!.s.t > 22 },
    { text: () => '적이 무엇을 보냈는지 확인할 차례입니다. 아래 "상대" 버튼을 눌러 적의 실제 출격 조합을 보세요.', done: (a) => a.panels.current === 'enemy' || (a.match!.s.t > 60) },
    { text: (a) => `적은 소형 돌격대를 많이 보냅니다. 편성 화면에서 광역 병종(${a.human.faction === 'iron' ? '충격분사차' : '충격투척병'})을 추가해 다음 출격에 합류시키세요.`, done: (a) => a.human.roster.some((e) => e && unitDef(e.unitId).roles.includes('aoe')) },
    { text: () => '다음 출격에서 광역 병력이 합류하면 전선이 어떻게 바뀌는지 지켜보세요. 상대는 곧 새로운 병종으로 대응할 것입니다.', done: (a) => a.match!.s.players.some((p) => p.team !== a.human.team && p.waves.some((w) => Object.keys(w.counts).some((id) => unitDef(id).layer === 'air'))) },
    { text: (a) => `적 폭격활공기(공중)가 출격했습니다! 지상 전용 병력은 공중을 공격할 수 없습니다. 대공 병종(${a.human.faction === 'iron' ? '요격포대' : '요격날개'})을 보강하세요.`, done: (a) => a.human.roster.some((e) => e && unitDef(e.unitId).roles.includes('antiair')) },
    { text: () => '"연구" 버튼에서 경제 연구는 미래 수입을, 기술 단계는 상위 병종을 엽니다. 전방 거점을 파괴해야 적 본진을 공격할 수 있습니다. 튜토리얼 끝 — 승리를 노려보세요!', done: (a) => a.match!.s.t > 300 },
  ];
  constructor(app: App) { this.app = app; }
  onBuy(id: string) { const d = unitDef(id); if (d.roles.includes('aoe')) this.boughtAoe = true; if (d.roles.includes('antiair')) this.boughtAA = true; }
  update() {
    const a = this.app;
    if (!a.match || a.match.s.result) { a.showHint('', null); return; }
    while (this.step < this.steps.length && this.steps[this.step].done(a)) this.step++;
    if (this.step >= this.steps.length) { a.showHint('', null); return; }
    a.showHint(`안내 ${this.step + 1}/${this.steps.length}`, this.steps[this.step].text(a));
  }
}
