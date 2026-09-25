import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { effect } from '@preact/signals';
import { back, nav, route } from './router';
import { isNative, platformName } from './platform';
import { onNotificationTap } from './notify';

/** 네이티브 앱 초기화: 뒤로가기 버튼, 상태바, 스플래시, 알림 딥링크 */
export function initNative() {
  if (!isNative()) return;
  SplashScreen.hide().catch(() => undefined);
  CapApp.addListener('backButton', () => {
    const p = route.value.path;
    if (p === '/' || p === '/onboarding') CapApp.exitApp();
    else back('/');
  });
  if (platformName() === 'android') StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
  effect(() => {
    const dark = document.documentElement.dataset.theme === 'dark';
    StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined);
    if (platformName() === 'android') StatusBar.setBackgroundColor({ color: dark ? '#0e0f12' : '#f3f4f6' }).catch(() => undefined);
    void route.value;
  });
  onNotificationTap((path) => nav(path));
}
