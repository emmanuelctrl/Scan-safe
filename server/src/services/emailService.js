// Email notification service.
//
// Sends the store owner an email whenever a worker scans/checks out an item.
// If SMTP credentials are not configured, the email is logged to the console
// instead — so local development works out of the box without an SMTP account.
import nodemailer from 'nodemailer';
import config from '../config/env.js';

// Optional app-wide transporter from SMTP_* env vars. Used only when an
// account hasn't supplied its own Gmail credentials.
let globalTransporter = null;

if (config.smtp.host && config.smtp.user) {
  globalTransporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure, // true for 465, false for 587/STARTTLS
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
}

// Cache per-account Gmail transporters keyed by the sender address so we don't
// rebuild a connection pool on every scan.
const gmailTransporters = new Map();

function getGmailTransporter({ user, pass }) {
  const cached = gmailTransporters.get(user);
  if (cached) return cached;
  const t = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    // Fail fast on a bad/unreachable config so a checkout can't hang on it.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
  gmailTransporters.set(user, t);
  return t;
}

/** Forget a cached transporter when its credentials change or are removed. */
export function invalidateGmailTransporter(user) {
  const t = gmailTransporters.get(user);
  if (t) {
    try { t.close(); } catch { /* ignore */ }
    gmailTransporters.delete(user);
  }
}

/**
 * True when the server itself can send email without any per-account setup —
 * i.e. Resend or a global SMTP transporter is configured. The client uses this
 * to know notifications will work even if the owner hasn't added a Gmail App
 * Password.
 */
export function serverEmailReady() {
  return Boolean(config.resend.apiKey || globalTransporter);
}

/** Send one email via Resend's HTTPS API (works on hosts that block SMTP). */
async function sendViaResend({ to, subject, text, html }) {
  let res;
  try {
    res = await fetch(config.resend.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resend.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: config.resend.from, to, subject, text, html }),
    });
  } catch (netErr) {
    const err = new Error(`Could not reach the Resend API: ${netErr.message}`);
    err.code = 'ERESEND';
    err.status = 0;
    err.detail = netErr.message;
    throw err;
  }
  if (!res.ok) {
    let detail = '';
    try { detail = JSON.stringify(await res.json()); }
    catch { detail = await res.text().catch(() => ''); }
    const err = new Error(`Resend ${res.status}: ${detail}`);
    err.code = 'ERESEND';
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
}

/**
 * Deliver an email through the best available transport, in priority order:
 *   1. Resend HTTP API   — works even where outbound SMTP is blocked
 *   2. the account's own Gmail (App Password)
 *   3. a global SMTP transporter (SMTP_* env vars)
 *   4. console log        — dev fallback when nothing is configured
 */
async function deliver({ to, subject, text, html, smtp }) {
  if (config.resend.apiKey) {
    await sendViaResend({ to, subject, text, html });
    return { delivered: true, via: 'resend' };
  }

  const transporter = smtp ? getGmailTransporter(smtp) : globalTransporter;
  const from = smtp ? `Inventory Tracker <${smtp.user}>` : config.smtp.from;

  if (!transporter) {
    console.log('\n[email:dev] No email sender configured — notification not sent.');
    console.log(`[email:dev] To: ${to}`);
    console.log(`[email:dev] Subject: ${subject}`);
    console.log(`[email:dev]\n${text}`);
    return { delivered: false, simulated: true };
  }

  await transporter.sendMail({ from, to, subject, text, html });
  return { delivered: true, via: smtp ? 'gmail' : 'smtp' };
}

/**
 * Turn a raw nodemailer/SMTP error into a short, actionable message an owner
 * can act on, instead of a cryptic stack trace.
 */
export function describeSmtpError(err) {
  const code = err?.code;
  const resp = err?.response || err?.message || '';
  // Resend (HTTP API) errors.
  if (code === 'ERESEND') {
    if (err.status === 0) {
      return "Couldn't reach the Resend email API. Check the server's network access to api.resend.com.";
    }
    if (err.status === 401 || err.status === 403) {
      return 'Your Resend API key was rejected. Check RESEND_API_KEY on the server.';
    }
    if (err.status === 422 || /domain|not verified|only send testing|testing emails/i.test(err.detail || '')) {
      return 'Resend accepted the request but not this recipient. While your domain is unverified, Resend only delivers to your own Resend account email — verify a domain in Resend to send to any address.';
    }
    return `Email API error: ${err.detail || err.message}`;
  }
  if (code === 'EAUTH' || /5\.7\.8|Username and Password not accepted|BadCredentials/i.test(resp)) {
    return 'Gmail did not accept the address or App Password. Turn on 2-Step Verification on that Google account and use a 16-character App Password (not your normal password).';
  }
  if (['ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'ECONNREFUSED', 'EDNS'].includes(code)) {
    return "Couldn't reach Gmail's mail server on port 465. The host running this app may block outbound SMTP (common on free hosting) — set RESEND_API_KEY to send over HTTPS instead, or use a host that allows SMTP.";
  }
  return err?.message || 'Unknown email error.';
}

/**
 * Send a one-off test email to confirm an account's Gmail credentials work.
 * Throws the raw error on failure so the caller can describe it.
 */
export async function sendTestEmail({ to, smtp }) {
  return deliver({
    to,
    smtp,
    subject: '✅ Inventory Tracker — test email',
    text:
      'This is a test from Inventory Tracker.\n\n' +
      'If you can read this, your checkout notifications are set up correctly — ' +
      'every checkout will now email this address.',
  });
}

/**
 * Notify the owner that an item was scanned/checked out.
 * @param {object} params
 * @param {string} params.to          Destination email (owner's notification address).
 * @param {object} params.item        The scanned item record.
 * @param {string} params.action      'scan' | 'checkout'
 * @param {number} params.quantity    Units affected.
 * @param {number} [params.unitPrice] Price the sale was made at (worker may adjust it).
 * @param {number} [params.listPrice] The item's stored price, to flag adjustments.
 * @param {string} [params.worker]    Email of the worker who scanned.
 * @param {{user:string, pass:string}} [params.smtp]  Per-account Gmail sender.
 */
export async function sendScanNotification({
  to, item, action, quantity, unitPrice, listPrice, worker, smtp,
}) {
  const verb = action === 'checkout' ? 'checked out' : 'scanned';
  const when = new Date().toLocaleString();
  const subject = `🛍️ Inventory Tracker: "${item.name}" ${verb}`;

  const money = (v) => `$${Number(v).toFixed(2)}`;
  const soldAt = unitPrice ?? item.price;
  const adjusted = listPrice != null && Number(soldAt) !== Number(listPrice);
  const priceLine = adjusted
    ? `${money(soldAt)} (adjusted from ${money(listPrice)})`
    : money(soldAt);
  const total = money(soldAt * quantity);

  const text =
    `An item was just ${verb} in your store.\n\n` +
    `Item:      ${item.name}\n` +
    (item.category ? `Category:  ${item.category}\n` : '') +
    `Barcode:   ${item.barcode}\n` +
    `Quantity:  ${quantity}\n` +
    `Price:     ${priceLine}\n` +
    `Total:     ${total}\n` +
    `Remaining: ${item.quantity}\n` +
    `Worker:    ${worker || 'Unknown'}\n` +
    `Time:      ${when}\n`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto;">
      <h2 style="color:#4f46e5;">🛍️ Inventory Tracker</h2>
      <p>An item was just <strong>${verb}</strong> in your store.</p>
      <table style="border-collapse:collapse;width:100%;">
        <tbody>
          ${row('Item', item.name)}
          ${item.category ? row('Category', item.category) : ''}
          ${row('Barcode', item.barcode)}
          ${row('Quantity', quantity)}
          ${row('Price', priceLine)}
          ${row('Total', total)}
          ${row('Remaining stock', item.quantity)}
          ${row('Worker', worker || 'Unknown')}
          ${row('Time', when)}
        </tbody>
      </table>
      <p style="color:#6b7280;font-size:12px;margin-top:16px;">
        You are receiving this because you are the registered owner notification address.
      </p>
    </div>`;

  return deliver({ to, subject, text, html, smtp });
}

function row(label, value) {
  return `<tr>
    <td style="padding:6px 10px;border:1px solid #e5e7eb;color:#374151;font-weight:bold;">${label}</td>
    <td style="padding:6px 10px;border:1px solid #e5e7eb;color:#111827;">${value}</td>
  </tr>`;
}
