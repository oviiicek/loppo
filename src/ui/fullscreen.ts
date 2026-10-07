// Fullscreen ("celá obrazovka").
// Browsers only switch to fullscreen from a real click/tap or key press (on phones a
// pointerdown is not enough), an iframe needs allow="fullscreen", and iPhone Safari has no
// page fullscreen at all – there the game only fills the screen when it is added to the home
// screen. Every caller therefore has to cope with a refusal.

type FsDoc = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};
type FsRoot = HTMLElement & { webkitRequestFullscreen?: () => void };

const doc = document as FsDoc;

export const FS_HELP =
  'Tento prohlížeč celou obrazovku nedovolí. Funguje na počítači a v Chrome na Androidu – na iPhonu jen u hry přidané na plochu (Sdílet → Přidat na plochu).';

/** running as an installed app (home-screen icon), which already fills the screen */
export function isStandalone() {
  try {
    return matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as any).standalone === true;
  } catch {
    return false;
  }
}

export function fsSupported() {
  return !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
}

export function fsActive() {
  return !!(doc.fullscreenElement || doc.webkitFullscreenElement);
}

// the player left fullscreen with our button – starting a run must not force it back on
let declined = false;

function lockLandscape() {
  try {
    (screen.orientation as any)?.lock?.('landscape')?.catch?.(() => {});
  } catch {
    /* not available (desktop, iOS) */
  }
}

/** Ask for fullscreen; resolves false when the browser refuses. Call it straight from a click or key handler. */
export function enterFullscreen(): Promise<boolean> {
  if (fsActive()) return Promise.resolve(true);
  const root = document.documentElement as FsRoot;
  try {
    if (root.requestFullscreen) {
      return root.requestFullscreen({ navigationUI: 'hide' }).then(
        () => {
          lockLandscape();
          return true;
        },
        () => false,
      );
    }
    if (root.webkitRequestFullscreen) {
      // older Safari: no promise, the switch happens a moment later
      root.webkitRequestFullscreen();
      return new Promise((res) => setTimeout(() => res(fsActive()), 500));
    }
  } catch {
    /* refused synchronously */
  }
  return Promise.resolve(false);
}

export function exitFullscreen() {
  try {
    if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
    else doc.webkitExitFullscreen?.();
  } catch {
    /* ignore */
  }
}

/** The fullscreen button. Resolves false when the browser refused. */
export function toggleFullscreen(): Promise<boolean> {
  if (fsActive()) {
    declined = true;
    exitFullscreen();
    return Promise.resolve(true);
  }
  declined = false;
  if (!fsSupported()) return Promise.resolve(false);
  return enterFullscreen();
}

/** Phones and tablets start a run in fullscreen, unless the player switched it off. */
export function autoFullscreen() {
  if (declined || fsActive() || isStandalone() || !fsSupported()) return;
  if (!matchMedia('(pointer: coarse)').matches) return;
  void enterFullscreen();
}

export function onFullscreenChange(fn: () => void) {
  document.addEventListener('fullscreenchange', fn);
  document.addEventListener('webkitfullscreenchange', fn);
}

/** four corners pointing out (enter) or in (leave) */
export function fsIcon(active = fsActive()) {
  const d = active ? 'M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6' : 'M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6';
  return `<svg class="fsico" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
}

export function fsLabel(active = fsActive()) {
  return active ? 'Ukončit celou obrazovku' : 'Celá obrazovka';
}

/** contents of a fullscreen button: data-fs="icon" shows just the icon, "label" adds the text */
export function fsButtonHTML(kind: 'icon' | 'label') {
  return kind === 'icon' ? fsIcon() : `${fsIcon()} ${fsLabel()}`;
}

/** refresh every fullscreen button on screen after the mode changed */
export function syncFsButtons() {
  document.querySelectorAll<HTMLElement>('[data-fs]').forEach((b) => {
    b.innerHTML = fsButtonHTML(b.dataset.fs === 'icon' ? 'icon' : 'label');
    b.title = fsLabel() + (b.dataset.fs === 'icon' ? ' (F)' : '');
  });
}
