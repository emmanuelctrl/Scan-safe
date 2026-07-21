// Owner Portal routes — scoped to the logged-in account and gated by its
// 6-digit PIN.
//
// Flow:
//   1. A logged-in user POSTs their PIN to /unlock.
//   2. On success they receive a short-lived owner token bound to their account.
//   3. That token (x-owner-token header) unlocks the rest of these routes.
//
// Every handler operates strictly on req.user.id's own data, so each account
// has a fully separate inventory, dashboard and settings.
import { Router } from 'express';
import { ItemModel } from '../models/itemModel.js';
import { ScanModel } from '../models/scanModel.js';
import { StockModel } from '../models/stockModel.js';
import { SettingsModel } from '../models/settingsModel.js';
import { parseInventoryFile } from '../services/importService.js';
import { invalidateGmailTransporter } from '../services/emailService.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwner, issueOwnerToken } from '../middleware/ownerPin.js';
import { uploadSpreadsheet } from '../middleware/upload.js';
import {
  itemSchema,
  itemUpdateSchema,
  unlockSchema,
  changePinSchema,
  notificationEmailSchema,
  themeSchema,
  stockAdjustSchema,
  smtpCredentialsSchema,
} from '../validators/schemas.js';
import { validate } from '../utils/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';

const router = Router();

// Every owner route first requires a logged-in user.
router.use(requireAuth);

// POST /api/owner/unlock — verify the 6-digit PIN, return an owner token.
router.post(
  '/unlock',
  asyncHandler(async (req, res) => {
    const { pin } = validate(unlockSchema, req.body);
    if (!(await SettingsModel.verifyPin(req.user.id, pin))) {
      throw ApiError.unauthorized('Incorrect PIN.');
    }
    res.json({ ownerToken: issueOwnerToken(req.user.id) });
  })
);

// ── Everything below additionally requires a valid owner token ──────────────
router.use(requireOwner);

// GET /api/owner/dashboard — inventory health + today's sales + recent activity.
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const [stats, sales, recent, stockIn] = await Promise.all([
      ItemModel.stats(userId),
      ScanModel.salesToday(userId),
      ScanModel.recent(userId, 15),
      StockModel.stockInToday(userId),
    ]);
    res.json({
      inventory: {
        totalItems: stats.totalItems,
        totalUnits: stats.totalUnits,
        inventoryValue: stats.inventoryValue,
        outOfStock: stats.outOfStock,
        lowStock: stats.lowStock,
      },
      salesToday: {
        count: sales.count,
        units: sales.units,
        revenue: sales.revenue,
        items: sales.rows,
      },
      stockToday: {
        count: stockIn.count,
        units: stockIn.units,
        items: stockIn.rows,
      },
      recentActivity: recent,
    });
  })
);

// ── Item management ─────────────────────────────────────────────────────────

// GET /api/owner/items — full inventory list for this account.
router.get(
  '/items',
  asyncHandler(async (req, res) => {
    res.json({ items: await ItemModel.findAll(req.user.id) });
  })
);

// POST /api/owner/items — add a new item.
router.post(
  '/items',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const data = validate(itemSchema, req.body);
    if (await ItemModel.findByBarcode(userId, data.barcode)) {
      throw ApiError.conflict(`An item with barcode "${data.barcode}" already exists.`);
    }
    const item = await ItemModel.create(userId, data);
    res.status(201).json({ item });
  })
);

// POST /api/owner/items/:id/stock — adjust quantity by +/- N units (restock
// or correction). Logs the change so it shows up in "today's stock added".
router.post(
  '/items/:id/stock',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const id = Number(req.params.id);
    const { change } = validate(stockAdjustSchema, req.body);

    const item = await StockModel.adjustStock(userId, id, change);
    if (!item) throw ApiError.notFound('Item not found.');
    res.json({ item });
  })
);

// POST /api/owner/items/import — upload an Excel/CSV file to build inventory.
// Send as multipart/form-data with a "file" field. Optional "replace=true"
// field wipes the current inventory first so the spreadsheet becomes the
// single source of truth.
router.post(
  '/items/import',
  uploadSpreadsheet,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const replace = String(req.body?.replace).toLowerCase() === 'true';

    const { rows, errors } = await parseInventoryFile(
      req.file.buffer,
      req.file.originalname
    );

    const result = await ItemModel.bulkUpsert(userId, rows, { replace });

    res.status(201).json({
      message: `Imported ${result.total} item(s): ${result.inserted} added, ${result.updated} updated.`,
      summary: result,
      skipped: errors,
      items: await ItemModel.findAll(userId),
    });
  })
);

// PATCH /api/owner/items/:id — edit item details / price / stock.
router.patch(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const id = Number(req.params.id);
    const existing = await ItemModel.findById(userId, id);
    if (!existing) throw ApiError.notFound('Item not found.');

    const data = validate(itemUpdateSchema, req.body);

    // Prevent collisions if the barcode is being changed.
    if (data.barcode && data.barcode !== existing.barcode) {
      const clash = await ItemModel.findByBarcode(userId, data.barcode);
      if (clash) throw ApiError.conflict(`Barcode "${data.barcode}" is already in use.`);
    }

    const item = await ItemModel.update(userId, id, data);
    res.json({ item });
  })
);

// DELETE /api/owner/items/:id — remove an item.
router.delete(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const id = Number(req.params.id);
    if (!(await ItemModel.findById(userId, id))) throw ApiError.notFound('Item not found.');
    await ItemModel.remove(userId, id);
    res.json({ message: 'Item deleted.' });
  })
);

// ── Settings ────────────────────────────────────────────────────────────────

// GET /api/owner/settings — current settings (no PIN hash).
router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    res.json({ settings: SettingsModel.toPublic(await SettingsModel.get(req.user.id)) });
  })
);

// PUT /api/owner/settings/pin — change the 6-digit PIN.
router.put(
  '/settings/pin',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { currentPin, newPin } = validate(changePinSchema, req.body);
    if (!(await SettingsModel.verifyPin(userId, currentPin))) {
      throw ApiError.unauthorized('Current PIN is incorrect.');
    }
    await SettingsModel.setPin(userId, newPin);
    res.json({ message: 'PIN updated successfully.' });
  })
);

// PUT /api/owner/settings/notification-email — change notification address.
router.put(
  '/settings/notification-email',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { email } = validate(notificationEmailSchema, req.body);
    await SettingsModel.setNotificationEmail(userId, email);
    res.json({ settings: SettingsModel.toPublic(await SettingsModel.get(userId)) });
  })
);

// PUT /api/owner/settings/theme — persist the owner's theme preference.
router.put(
  '/settings/theme',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { theme } = validate(themeSchema, req.body);
    await SettingsModel.setTheme(userId, theme);
    res.json({ settings: SettingsModel.toPublic(await SettingsModel.get(userId)) });
  })
);

// PUT /api/owner/settings/smtp — set/replace the Gmail sender + App Password
// used to email checkout notifications. The password is encrypted at rest and
// never returned to the client.
router.put(
  '/settings/smtp',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { smtpUser, smtpPass } = validate(smtpCredentialsSchema, req.body);
    // Drop any cached transporter for the previous address so the new
    // credentials take effect immediately.
    const previous = await SettingsModel.get(userId);
    if (previous?.smtp_user) invalidateGmailTransporter(previous.smtp_user);
    await SettingsModel.setSmtpCredentials(userId, smtpUser, smtpPass);
    res.json({ settings: SettingsModel.toPublic(await SettingsModel.get(userId)) });
  })
);

// DELETE /api/owner/settings/smtp — remove stored Gmail credentials.
router.delete(
  '/settings/smtp',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const previous = await SettingsModel.get(userId);
    if (previous?.smtp_user) invalidateGmailTransporter(previous.smtp_user);
    await SettingsModel.clearSmtpCredentials(userId);
    res.json({ settings: SettingsModel.toPublic(await SettingsModel.get(userId)) });
  })
);

export default router;
