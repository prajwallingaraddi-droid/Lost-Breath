export interface HostQuitEnvironment {
  desktopQuit?: (() => void | Promise<void>) | null;
  canAttemptBrowserClose?: boolean;
  browserClose?: () => void;
  isBrowserClosed?: () => boolean;
}

export interface QuitAttemptResult {
  closed: boolean;
  environment: 'desktop' | 'browser';
}

function resolveHostEnvironment(): HostQuitEnvironment {
  if (typeof window === 'undefined') {
    return { desktopQuit: null, canAttemptBrowserClose: false };
  }

  const win = window as unknown as Record<string, unknown>;
  const electronApi = win.electronAPI as { quit?: () => void; exit?: () => void; closeApp?: () => void } | undefined;
  const electron = win.electron as { quit?: () => void; close?: () => void } | undefined;
  const tauri = win.__TAURI__ as { process?: { exit?: (code?: number) => Promise<void> | void } } | undefined;
  const nw = win.nw as { App?: { quit?: () => void } } | undefined;

  const desktopFn =
    electronApi?.quit ??
    electronApi?.exit ??
    electronApi?.closeApp ??
    electron?.quit ??
    electron?.close ??
    (tauri?.process?.exit ? () => tauri.process!.exit!(0) : undefined) ??
    nw?.App?.quit ??
    null;

  let isStandalone = false;
  try {
    isStandalone = Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches);
  } catch {
    isStandalone = false;
  }

  // Browsers generally only allow scripts to close windows opened via script (window.opener != null)
  // or standalone PWA windows.
  const canAttemptBrowserClose =
    typeof window.close === 'function' && (Boolean(window.opener) || isStandalone);

  return {
    desktopQuit: desktopFn,
    canAttemptBrowserClose,
    browserClose: () => window.close(),
    isBrowserClosed: () => Boolean(window.closed),
  };
}

/**
 * Attempts to quit the game cleanly in supported desktop hosts or browser windows
 * when permitted. Never falsely reports closure if the host blocks closing.
 */
export function attemptQuitGame(customHost?: HostQuitEnvironment): QuitAttemptResult {
  const host = customHost ?? resolveHostEnvironment();

  if (typeof host.desktopQuit === 'function') {
    try {
      host.desktopQuit();
      return { closed: true, environment: 'desktop' };
    } catch {
      return { closed: false, environment: 'desktop' };
    }
  }

  if (host.canAttemptBrowserClose && typeof host.browserClose === 'function') {
    try {
      host.browserClose();
    } catch {
      // Blocked by browser policy
    }
    const closed = typeof host.isBrowserClosed === 'function' ? Boolean(host.isBrowserClosed()) : false;
    return { closed, environment: 'browser' };
  }

  return { closed: false, environment: 'browser' };
}
