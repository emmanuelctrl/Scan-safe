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
 * Turn a raw nodemailer/SMTP error into a short, actionable message an owner
 * can act on, instead of a cryptic stack trace.
 */
export function describeSmtpError(err) {
  const code = err?.code;
  const resp = err?.response || err?.message || '';
  if (code === 'EAUTH' || /5\.7\.8|Username and Password not accepted|BadCredentials/i.test(resp)) {
    return 'Gmail did not accept the address or App Password. Turn on 2-Step Verification on that Google account and use a 16-character App Password (not your normal password).';
  }
  if (['ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'ECONNREFUSED', 'EDNS'].includes(code)) {
    return "Couldn't reach Gmail's mail server on port 465. The host running this app may block outbound SMTP (common on free hosting) — try a host that allows it, or run locally.";
  }
  return err?.message || 'Unknown email error.';
}

/**
 * Send a one-off test email to confirm an account's Gmail credentials work.
 * Throws the raw error on failure so the caller can describe it.
 */
export async function sendTestEmail({ to, smtp }) {
  const transporter = smtp ? getGmailTransporter(smtp) : globalTransporter;
  const from = smtp ? `Inventory Tracker <${smtp.user}>` : config.smtp.from;
  if (!transporter) {
    return { delivered: false, simulated: true };
  }
  await transporter.sendMail({
    from,
    to,
    subject: '✅ Inventory Tracker — test email',
    text:
      'This is a test from Inventory Tracker.\n\n' +
      'If you can read this, your checkout notifications are set up correctly — ' +
      'every checkout will now email this address.',
  });
  return { delivered: true };
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

  // Prefer the account's own Gmail sender; otherwise the app-wide transporter.
  const transporter = smtp ? getGmailTransporter(smtp) : globalTransporter;
  const from = smtp ? `Inventory Tracker <${smtp.user}>` : config.smtp.from;

  // Fall back to console logging when no transporter is available at all.
  if (!transporter) {
    console.log('\n[email:dev] No email sender configured — notification not sent.');
    console.log(`[email:dev] To: ${to}`);
    console.log(`[email:dev] Subject: ${subject}`);
    console.log(`[email:dev]\n${text}`);
    return { delivered: false, simulated: true };
  }

  await transporter.sendMail({ from, to, subject, text, html });
  return { delivered: true, simulated: false };
}

function row(label, value) {
  return `<tr>
    <td style="padding:6px 10px;border:1px solid #e5e7eb;color:#374151;font-weight:bold;">${label}</td>
    <td style="padding:6px 10px;border:1px solid #e5e7eb;color:#111827;">${value}</td>
  </tr>`;
}
