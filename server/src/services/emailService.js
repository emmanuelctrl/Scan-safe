// Email notification service.
//
// Sends the store owner an email whenever a worker scans/checks out an item.
// If SMTP credentials are not configured, the email is logged to the console
// instead — so local development works out of the box without an SMTP account.
import nodemailer from 'nodemailer';
import config from '../config/env.js';

let transporter = null;

if (config.smtp.host && config.smtp.user) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure, // true for 465, false for 587/STARTTLS
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
}

/**
 * Notify the owner that an item was scanned/checked out.
 * @param {object} params
 * @param {string} params.to          Destination email (owner's notification address).
 * @param {object} params.item        The scanned item record.
 * @param {string} params.action      'scan' | 'checkout'
 * @param {number} params.quantity    Units affected.
 * @param {string} [params.worker]    Email of the worker who scanned.
 */
export async function sendScanNotification({ to, item, action, quantity, worker }) {
  const verb = action === 'checkout' ? 'checked out' : 'scanned';
  const when = new Date().toLocaleString();
  const subject = `🛍️ Inventory Tracker: "${item.name}" ${verb}`;

  const text =
    `An item was just ${verb} in your store.\n\n` +
    `Item:      ${item.name}\n` +
    `Barcode:   ${item.barcode}\n` +
    `Quantity:  ${quantity}\n` +
    `Price:     $${Number(item.price).toFixed(2)}\n` +
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
          ${row('Barcode', item.barcode)}
          ${row('Quantity', quantity)}
          ${row('Price', '$' + Number(item.price).toFixed(2))}
          ${row('Remaining stock', item.quantity)}
          ${row('Worker', worker || 'Unknown')}
          ${row('Time', when)}
        </tbody>
      </table>
      <p style="color:#6b7280;font-size:12px;margin-top:16px;">
        You are receiving this because you are the registered owner notification address.
      </p>
    </div>`;

  // Fall back to console logging when SMTP isn't configured.
  if (!transporter) {
    console.log('\n[email:dev] SMTP not configured — notification not sent.');
    console.log(`[email:dev] To: ${to}`);
    console.log(`[email:dev] Subject: ${subject}`);
    console.log(`[email:dev]\n${text}`);
    return { delivered: false, simulated: true };
  }

  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject,
    text,
    html,
  });
  return { delivered: true, simulated: false };
}

function row(label, value) {
  return `<tr>
    <td style="padding:6px 10px;border:1px solid #e5e7eb;color:#374151;font-weight:bold;">${label}</td>
    <td style="padding:6px 10px;border:1px solid #e5e7eb;color:#111827;">${value}</td>
  </tr>`;
}
