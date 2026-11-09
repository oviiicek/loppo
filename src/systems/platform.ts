// Where the game runs: in a browser (also installed as a web app) or inside the Android or iOS app (Capacitor puts
// its bridge on window before the game's scripts run, so nothing of Capacitor has to be in the game's bundle).

interface CapBridge {
  isNativePlatform?(): boolean;
  getPlatform?(): string;
}

const cap = () => (window as unknown as { Capacitor?: CapBridge }).Capacitor;

/** the game runs inside the app from Google Play or the App Store */
export function isNativeApp(): boolean {
  try {
    return !!cap()?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/** 'android', 'ios' or 'web' */
export function nativePlatform(): string {
  try {
    return cap()?.getPlatform?.() ?? 'web';
  } catch {
    return 'web';
  }
}

/** in the app: resolves once the Cordova plugins (the purchases) are ready, or after `ms` at the latest */
export function pluginsReady(ms = 4000): Promise<void> {
  return new Promise((resolve) => {
    if (!isNativeApp()) return resolve();
    const done = () => resolve();
    document.addEventListener('deviceready', done, { once: true });
    setTimeout(done, ms);
  });
}
