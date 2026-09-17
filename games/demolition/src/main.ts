import { App } from './ui/app';

const root = document.getElementById('app')!;
const app = new App(root);
// 개발·e2e 확인용 전역 핸들(일반 플레이에는 영향 없음)
(window as any).__waruru = app;
