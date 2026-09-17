import { App } from './ui/app';
import { actSpawn, actMerge, actAccept, actMove, actDiscard, orderReady, tick } from './sim/run';
import { countByKey } from './sim/board';

const root = document.getElementById('app')!;
const app = new App(root);
app.boot();
// 브라우저 테스트·디버그용 노출 (게임 규칙에는 영향 없음)
(window as unknown as { __app: App; __dbg: unknown }).__app = app;
(window as unknown as { __dbg: unknown }).__dbg = { actSpawn, actMerge, actAccept, actMove, actDiscard, orderReady, tick, countByKey };
