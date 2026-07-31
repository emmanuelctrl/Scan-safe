// Telegram sale-notification delivery.
//
// Sends a store's owner a Telegram message when a sale is completed. Everything
// here is best-effort and non-throwing: a Telegram outage must never delay or
// fail a sale. The bot token is read from config (process.env) only and is
// never logged or returned to any client.
import config from '../config/env.js';
import { UserModel } from '../models/userModel.js';

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
 * Send a single HTML message to a Telegram chat. Never throws. On HTTP 403
 * (user blocked the bot / chat gone) the account is unlinked so we stop trying.
 */
export async function sendTelegram(chatId, text) {
  const token = config.telegramBotToken;
  if (!token || !chatId) return;

  try {
    // NOTE: the URL contains the bot token — never log it.
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      if (res.status === 403) {
        await UserModel.unlinkTelegramByChatId(chatId);
        return;
      }
      const body = await res.text().catch(() => '');
      console.error(`[telegram] sendMessage failed (HTTP ${res.status}): ${body}`);
    }
  } catch (err) {
    console.error('[telegram] sendMessage error:', err.message);
  }
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
