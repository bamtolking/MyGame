import { App } from './ui/app';
import { placeItem, mergeItems, mergePartners, dismantleItem, benchItems, bagItems, loadoutOf, stageDef } from './core/run';
import { checkPlacement } from './core/bag';
import { computeLoadout } from './core/loadout';
const app = new App(document.getElementById('pb')!);
// 자동 테스트(e2e)와 디버깅용 노출. 게임 규칙은 바꾸지 않는다.
(window as unknown as { __pb: App; __pbCore: unknown }).__pb = app;
(window as unknown as { __pbCore: unknown }).__pbCore = { placeItem, mergeItems, mergePartners, dismantleItem, benchItems, bagItems, loadoutOf, stageDef, checkPlacement, computeLoadout };
