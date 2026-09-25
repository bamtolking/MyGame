import { Capacitor } from '@capacitor/core';

export const isNative = (): boolean => Capacitor.isNativePlatform();
export const platformName = (): 'web' | 'android' | 'ios' => Capacitor.getPlatform() as 'web' | 'android' | 'ios';
