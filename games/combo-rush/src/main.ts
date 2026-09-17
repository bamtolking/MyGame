import { App } from './ui/app';
const app = new App(document.getElementById('app')!);
(window as unknown as { __game: App }).__game = app;
