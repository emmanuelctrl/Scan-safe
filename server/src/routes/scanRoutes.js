// Worker scan/checkout routes.
//
// When a worker scans a barcode, we look up the item *within their own store*,
// record the scan in the ledger, decrement stock on checkout, and email the
// store owner a notification.
import { Router } from 'express';
import { ItemModel } from '../models/itemModel.js';
import { ScanModel } from '../models/scanModel.js';
import { SettingsModel } from '../models/settingsModel.js';
import { sendScanNotification, describeSmtpError } from '../services/emailService.js';
import { scanSchema } from '../validators/schemas.js';
import { validate } from '../utils/validate.js';
import { requireAuth } from '../middleware/auth.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';

const router = Router();

// All scan endpoints require a logged-in user.
router.use(requireAuth);

// POST /api/scan — process a scanned barcode.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { barcode, action, quantity, price } = validate(scanSchema, req.body);

    const item = await ItemModel.findByBarcode(userId, barcode);
    if (!item) {
      throw ApiError.notFound(`No item found for barcode "${barcode}".`);
    }

    if (action === 'checkout' && item.quantity < quantity) {
      throw ApiError.badRequest(
        `Only ${item.quantity} unit(s) of "${item.name}" remain in stock.`
      );
    }

    // The price the sale is recorded at: the worker's adjustment if provided,
    // otherwise the item's stored price.
    const unitPrice = price ?? item.price;

    // Apply stock change for checkouts.
    const updatedItem =
      action === 'checkout' ? await ItemModel.decrementStock(userId, item.id, quantity) : item;

    // Record the immutable ledger entry.
    await ScanModel.create({
      userId,
      item: updatedItem,
      workerEmail: req.user.email,
      action,
      quantity,
      unitPrice,
    });

    // Notify the owner. Email failures must NOT fail the scan, so we catch them.
    const settings = await SettingsModel.get(userId);
    let notification = { delivered: false };
    try {
      notification = await sendScanNotification({
        to: settings.notification_email,
        item: updatedItem,
        action,
        quantity,
        unitPrice,
        listPrice: item.price,
        worker: req.user.email,
      });
    } catch (err) {
      console.error('[scan] Failed to send owner notification:', err.message);
      notification = { delivered: false, error: describeSmtpError(err) };
    }

    res.status(201).json({
      message: `"${updatedItem.name}" ${action === 'checkout' ? 'checked out' : 'scanned'} successfully.`,
      item: updatedItem,
      sale: { quantity, unitPrice, total: unitPrice * quantity },
      notification,
    });
  })
);

// GET /api/scan/categories — distinct item categories for this store, so the
// worker can browse items (e.g. types of shoes) without scanning.
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    res.json({ categories: await ItemModel.categories(req.user.id) });
  })
);

// GET /api/scan/items?category=… — items in one category (or all items), so a
// worker can tap an item to sell it instead of scanning its barcode.
router.get(
  '/items',
  asyncHandler(async (req, res) => {
    const category = String(req.query.category ?? '').trim();
    const search = String(req.query.search ?? '').trim();
    const items = await ItemModel.findAll(req.user.id, {
      category: category || undefined,
      search: search || undefined,
    });
    res.json({ items });
  })
);

// GET /api/scan/lookup/:barcode — preview an item before confirming a checkout.
router.get(
  '/lookup/:barcode',
  asyncHandler(async (req, res) => {
    const item = await ItemModel.findByBarcode(req.user.id, req.params.barcode);
    if (!item) {
      throw ApiError.notFound(`No item found for barcode "${req.params.barcode}".`);
    }
    res.json({ item });
  })
);

export default router;
