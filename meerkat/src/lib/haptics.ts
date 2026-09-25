import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { settings } from '../state/store';
import { isNative } from './platform';

export const haptic = {
  light() {
    if (!settings.value.haptics) return;
    if (isNative()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    else navigator.vibrate?.(10);
  },
  medium() {
    if (!settings.value.haptics) return;
    if (isNative()) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
    else navigator.vibrate?.(22);
  },
  success() {
    if (!settings.value.haptics) return;
    if (isNative()) Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
    else navigator.vibrate?.([18, 60, 28]);
  },
};
