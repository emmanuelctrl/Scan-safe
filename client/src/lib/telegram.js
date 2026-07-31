// Telegram Mini App integration.
//
// Everything here is defensive: when the site is opened in a normal browser
// (not inside Telegram) `window.Telegram` is undefined and every helper
// becomes a no-op, so the app works exactly as before outside Telegram.
import { useEffect } from 'react';
import { api } from '../api/client.js';

export function getTelegramWebApp() {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
}

// Only attempt the (silent) Telegram link once per page load.
let telegramLinkAttempted = false;

/**
 * If the app is running inside Telegram, silently bind the logged-in account to
 * the Telegram chat so the owner gets sale notifications. No UI, no retry,
 * failures ignored — call once after login. No-op in a normal browser.
 */
export async function linkTelegramAccount() {
  if (telegramLinkAttempted) return;
  const initData = getTelegramWebApp()?.initData;
  if (!initData) return;
  telegramLinkAttempted = true;
  try {
    await api('/api/telegram/link', { method: 'POST', body: { initData } });
  } catch {
    /* silent: linking is best-effort */
  }
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
  const bg = theme === 'dark' ? '#08110f' : '#eef0eb';
  const header = theme === 'dark' ? '#101b18' : '#ffffff';
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
