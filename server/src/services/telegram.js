// Telegram sale-notification delivery.
//
// Sends a store's owner a Telegram message when a sale is completed. Everything
// here is best-effort and non-throwing: a Telegram outage must never delay or
// fail a sale. The bot token is read from config (process.env) only and is
// never logged or returned to any client.
import config from '../config/env.js';
import { UserModel } from '../models/userModel.js';
import { ScanModel } from '../models/scanModel.js';

const TELEGRAM_API = 'https://api.telegram.org';

/** Escape text for Telegram's HTML parse mode. */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const money = (n) => `${Number(n || 0).toFixed(2)} ETB`;

/**
 * Send a single HTML message to a Telegram chat. Never throws; returns a
 * result object describing the outcome so callers (e.g. the "send test"
 * button) can explain failures.
 *
 * On HTTP 403 we inspect the reason: a genuinely blocked/deactivated user is
 * unlinked so we stop trying, but "bot can't initiate conversation" (the owner
 * simply hasn't pressed Start on the bot yet) keeps the link intact — once they
 * press Start, the next sale reaches them with no re-linking.
 *
 * @returns {Promise<{ ok: boolean, reason?: string, status?: number, description?: string }>}
 */
export async function sendTelegram(chatId, text) {
  const token = config.telegramBotToken;
  if (!token) return { ok: false, reason: 'no_token' };
  if (!chatId) return { ok: false, reason: 'not_linked' };

  let res;
  try {
    // NOTE: the URL contains the bot token — never log it.
    res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.error('[telegram] sendMessage error:', err.message);
    return { ok: false, reason: 'network', description: err.message };
  }

  if (res.ok) return { ok: true };

  let description = '';
  try {
    const data = await res.json();
    description = data?.description || '';
  } catch {
    description = await res.text().catch(() => '');
  }

  if (res.status === 403) {
    if (/can'?t initiate conversation|bot was not started/i.test(description)) {
      // Recoverable: owner just needs to press Start on the bot. Keep the link.
      return { ok: false, reason: 'not_started', status: 403, description };
    }
    // blocked / deactivated / kicked → stop messaging this chat.
    await UserModel.unlinkTelegramByChatId(chatId);
    return { ok: false, reason: 'blocked', status: 403, description };
  }

  console.error(`[telegram] sendMessage failed (HTTP ${res.status}): ${description}`);
  return { ok: false, reason: 'error', status: res.status, description };
}

/**
 * Format a completed sale as an HTML Telegram message: one bullet per item,
 * then total, worker, and time (Africa/Addis_Ababa, currency ETB).
 */
export function formatSale(sale, worker) {
  const items = Array.isArray(sale?.items) ? sale.items : [];
  const bullets = items.map(
    (it) => `• ${escapeHtml(it.name)} ×${it.qty} — ${money(it.subtotal)}`
  );

  const when = sale?.createdAt ? new Date(sale.createdAt) : new Date();
  const time = when.toLocaleString('en-GB', {
    timeZone: 'Africa/Addis_Ababa',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return [
    '🧾 <b>New sale</b>',
    ...bullets,
    `<b>Total:</b> ${money(sale?.total)}`,
    `<b>Worker:</b> ${escapeHtml(worker || 'Unknown')}`,
    `<b>Time:</b> ${escapeHtml(time)}`,
  ].join('\n');
}

/**
 * Notify the owner(s) of a sale's store on Telegram, honouring each owner's
 * notification preference. Best-effort: never throws.
 * @param {object} sale  { userId (store), items[], total, worker, createdAt }
 */
export async function notifySale(sale) {
  if (!config.telegramBotToken) return; // Feature disabled without a token.
  if (!sale || sale.userId == null) return;

  const owners = await UserModel.findTelegramOwnersForStore(sale.userId);
  if (owners.length === 0) return;

  const total = Number(sale.total || 0);
  const recipients = owners.filter((o) => {
    switch (o.sale_notifications) {
      case 'daily':
        return false; // Rolled up separately; skip the instant message.
      case 'threshold':
        return total >= Number(o.sale_notification_threshold || 0);
      case 'instant':
      default:
        return true;
    }
  });
  if (recipients.length === 0) return;

  const text = formatSale(sale, sale.worker);
  await Promise.allSettled(
    recipients.map((o) => sendTelegram(o.telegram_chat_id, text))
  );
}

/**
 * Send each 'daily'-mode owner a summary of their store's sales for the current
 * Addis Ababa day. Best-effort; skips stores with no sales. Never throws.
 */
export async function sendDailyDigests() {
  if (!config.telegramBotToken) return;

  const owners = await UserModel.findDailyDigestOwners();
  for (const owner of owners) {
    const totals = await ScanModel.digestForToday(owner.id);
    if (!totals || totals.count === 0) continue;

    const text = [
      '📊 <b>Daily sales summary</b>',
      `<b>Sales:</b> ${totals.count} · ${totals.units} unit(s)`,
      `<b>Revenue:</b> ${money(totals.revenue)}`,
      `<b>Profit:</b> ${money(totals.profit)}`,
    ].join('\n');
    // eslint-disable-next-line no-await-in-loop
    await sendTelegram(owner.telegram_chat_id, text);
  }
}

/**
 * Schedule sendDailyDigests() to run once a day at ~21:00 Africa/Addis_Ababa
 * (18:00 UTC — Ethiopia has no DST). In-process and best-effort: on a host that
 * sleeps when idle (e.g. Render free) it only fires while the service is awake.
 */
export function startDailyDigestScheduler() {
  if (!config.telegramBotToken) return;

  const msUntilNextRun = () => {
    const now = new Date();
    const next = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 18, 0, 0
    ));
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - now.getTime();
  };

  const schedule = () => {
    setTimeout(async () => {
      try {
        await sendDailyDigests();
      } catch (err) {
        console.error('[telegram] daily digest failed:', err.message);
      }
      schedule();
    }, msUntilNextRun()).unref?.();
  };

  schedule();
}
