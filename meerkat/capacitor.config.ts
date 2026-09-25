import type { CapacitorConfig } from '@capacitor/cli';

/**
 * 스토어 출시 전 appId 를 본인 소유 도메인 기준으로 바꾸세요 (예: com.회사이름.meerkat).
 * 한 번 스토어에 올린 뒤에는 바꿀 수 없습니다.
 */
const config: CapacitorConfig = {
  appId: 'app.meerkat.posture',
  appName: '미어캣',
  webDir: 'dist',
  backgroundColor: '#f3f4f6',
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: true,
      backgroundColor: '#ff6b2c',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    LocalNotifications: {
      iconColor: '#ff6b2c',
    },
  },
};

export default config;
