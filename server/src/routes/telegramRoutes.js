// Telegram linking route.
//
// Called automatically by the frontend when the app runs inside Telegram, so
// the logged-in owner's account is bound to their Telegram chat with no manual
// setup. The client's Telegram user is only trusted after verifyInitData passes.
import { Router } from 'express';
import config from '../config/env.js';
import { UserModel } from '../models/userModel.js';
import { verifyInitData } from '../services/telegramAuth.js';
import { requireAuth } from '../middleware/auth.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';

const router = Router();

// Linking requires a logged-in user (the JWT identifies which account to bind).
router.use(requireAuth);

// POST /api/telegram/link — verify the Telegram initData and bind this account.
router.post(
  '/link',
  asyncHandler(async (req, res) => {
    const { initData } = req.body || {};
    const tgUser = verifyInitData(initData, config.telegramBotToken);
    if (!tgUser || tgUser.id == null) {
      throw ApiError.unauthorized('Invalid Telegram init data.');
    }

    // Locked to the first chat that links (the account creator/owner). If the
    // account is already bound to a different Telegram user, we do NOT take it
    // over — sale alerts stay with the original owner.
    const linked = await UserModel.linkTelegram(req.user.id, String(tgUser.id));

    const linkedAs =
      [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') ||
      tgUser.username ||
      String(tgUser.id);

    // `success` reflects whether THIS chat is the linked recipient. When the
    // account is already locked to someone else, report success:false without
    // an error (the caller links silently and simply leaves the owner in place).
    res.json({ success: linked, locked: !linked, linkedAs: linked ? linkedAs : null });
  })
);

export default router;
