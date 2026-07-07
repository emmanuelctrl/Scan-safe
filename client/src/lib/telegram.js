// Telegram Mini App integration.
//
// Everything here is defensive: when the site is opened in a normal browser
// (not inside Telegram) `window.Telegram` is undefined and every helper
// becomes a no-op, so the app works exactly as before outside Telegram.
import { useEffect } from 'react';

export function getTelegramWebApp() {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
}

/** Call once on app start. Expands the app to full height and reports readiness. */
export function initTelegramWebApp() {
  const tg = getTelegramWebApp();
  if (!tg) return null;

  tg.ready();
  tg.expand();
  // Avoid the whole Mini App being swiped closed while scrolling long lists.
  try {
    tg.disableVerticalSwipes?.();
  } catch {
    /* not supported on this Telegram client version */
  }

  applyViewportHeight(tg);
  tg.onEvent('viewportChanged', () => applyViewportHeight(tg));

  return tg;
}

function applyViewportHeight(tg) {
  const height = tg.viewportStableHeight || tg.viewportHeight;
  if (height) {
    document.documentElement.style.setProperty('--tg-viewport-height', `${height}px`);
  }
}

/** Push the app's current light/dark theme into Telegram's chrome (header/background). */
export function syncTelegramThemeColors(theme) {
  const tg = getTelegramWebApp();
  if (!tg) return;
  const bg = theme === 'dark' ? '#0b0d14' : '#f3f5f9';
  const header = theme === 'dark' ? '#151823' : '#ffffff';
  try {
    tg.setBackgroundColor?.(bg);
    tg.setHeaderColor?.(header);
  } catch {
    /* not supported on this Telegram client version */
  }
}

/**
 * Show Telegram's native BackButton while `show` is true and wire it to
 * `onClick`. Cleans up automatically when the component unmounts or `show`
 * changes. No-op outside Telegram.
 */
export function useTelegramBackButton(show, onClick) {
  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!tg?.BackButton) return;

    if (show) {
      tg.BackButton.show();
      tg.BackButton.onClick(onClick);
    } else {
      tg.BackButton.hide();
    }

    return () => {
      tg.BackButton.offClick(onClick);
      tg.BackButton.hide();
    };
  }, [show, onClick]);
}

/** The Telegram user profile, if launched from within Telegram. */
export function getTelegramUser() {
  return getTelegramWebApp()?.initDataUnsafe?.user ?? null;
}
