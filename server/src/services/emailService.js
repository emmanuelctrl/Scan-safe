// Email notification service.
//
// Sends the store owner an email whenever a worker scans/checks out an item.
// Delivery uses Brevo's HTTPS email API (works on hosts that block SMTP), or a
// global SMTP server; if neither is configured the email is logged to the
// console instead, so local development works out of the box.
import nodemailer from 'nodemailer';
import config from '../config/env.js';

// Optional app-wide SMTP transporter from SMTP_* env vars.
let globalTransporter = null;

if (config.smtp.host && config.smtp.user) {
  globalTransporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure, // true for 465, false for 587/STARTTLS
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
}

// Brevo needs a verified sender email; it's only usable with MAIL_FROM set.
const hasBrevo = Boolean(config.brevo.apiKey && config.mailFrom);

/**
 * True when the server can send email — i.e. Brevo or a global SMTP transporter
 * is configured. The client uses this to know notifications will work.
 */
export function serverEmailReady() {
  return Boolean(hasBrevo || globalTransporter);
}

/** Parse a "Name <email>" (or bare "email") string into { name, email }. */
function parseFrom(str) {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(str || '');
  if (m) {
    return { name: m[1].replace(/^"|"$/g, '').trim() || 'Inventory Tracker', email: m[2].trim() };
  }
  return { name: 'Inventory Tracker', email: (str || '').trim() };
}

/** Send one email via Brevo's HTTPS API (single verified sender → any recipient). */
async function sendViaBrevo({ to, subject, text, html }) {
  let res;
  try {
    res = await fetch(config.brevo.apiUrl, {
      method: 'POST',
      headers: {
        'api-key': config.brevo.apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: parseFrom(config.mailFrom),
        to: [{ email: to }],
        subject,
        htmlContent: html || `<pre>${text}</pre>`,
        textContent: text,
      }),
    });
  } catch (netErr) {
    const err = new Error(`Could not reach the Brevo API: ${netErr.message}`);
    err.code = 'EBREVO';
    err.status = 0;
    err.detail = netErr.message;
    throw err;
  }
  if (!res.ok) {
    let detail = '';
    try { detail = JSON.stringify(await res.json()); }
    catch { detail = await res.text().catch(() => ''); }
    const err = new Error(`Brevo ${res.status}: ${detail}`);
    err.code = 'EBREVO';
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
}

/**
 * Deliver an email: Brevo's HTTP API when configured (works where SMTP is
 * blocked), else a global SMTP transporter, else a console-log dev fallback.
 */
async function deliver({ to, subject, text, html }) {
  if (hasBrevo) {
    await sendViaBrevo({ to, subject, text, html });
    return { delivered: true, via: 'brevo' };
  }

  if (!globalTransporter) {
    console.log('\n[email:dev] No email sender configured — notification not sent.');
    console.log(`[email:dev] To: ${to}`);
    console.log(`[email:dev] Subject: ${subject}`);
    console.log(`[email:dev]\n${text}`);
    return { delivered: false, simulated: true };
  }

  await globalTransporter.sendMail({ from: config.smtp.from, to, subject, text, html });
  return { delivered: true, via: 'smtp' };
}

/**
 * Turn a raw nodemailer/SMTP error into a short, actionable message an owner
 * can act on, instead of a cryptic stack trace.
 */
export function describeSmtpError(err) {
  const code = err?.code;
  const resp = err?.response || err?.message || '';
  // Brevo (HTTP API) errors.
  if (code === 'EBREVO') {
    if (err.status === 0) {
      return "Couldn't reach the Brevo email API. Check the server's network access to api.brevo.com.";
    }
    if (err.status === 401) {
      return 'Your Brevo API key was rejected. Use a Brevo v3 API key (SMTP & API → API Keys — not the SMTP password) as BREVO_API_KEY.';
    }
    if (/sender|not valid|not been validated|activate/i.test(err.detail || '')) {
      return 'Brevo rejected the sender. In Brevo, add and verify your MAIL_FROM address under Senders, Domains & Dedicated IPs → Senders, then try again.';
    }
    return `Email API error: ${err.detail || err.message}`;
  }
  if (code === 'EAUTH' || /Username and Password not accepted|BadCredentials/i.test(resp)) {
    return 'The SMTP server rejected the username or password. Check your SMTP_USER / SMTP_PASS.';
  }
  if (['ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'ECONNREFUSED', 'EDNS'].includes(code)) {
    return "Couldn't reach the SMTP server. The host may block outbound SMTP (common on free hosting) — set BREVO_API_KEY to send over HTTPS instead.";
  }
  return err?.message || 'Unknown email error.';
}

/**
 * Send a one-off test email to confirm the server's email setup works.
 * Throws the raw error on failure so the caller can describe it.
 */
export async function sendTestEmail({ to }) {
  return deliver({
    to,
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
 */
export async function sendScanNotification({
  to, item, action, quantity, unitPrice, listPrice, worker,
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

  return deliver({ to, subject, text, html });
}

function row(label, value) {
  return `<tr>
    <td style="padding:6px 10px;border:1px solid #e5e7eb;color:#374151;font-weight:bold;">${label}</td>
    <td style="padding:6px 10px;border:1px solid #e5e7eb;color:#111827;">${value}</td>
  </tr>`;
}
