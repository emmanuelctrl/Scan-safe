// Super Admin routes — an app-wide panel (independent of any one store's
// login/PIN) that lets the operator see every registered store at a glance.
//
// Flow:
//   1. POST /login with the shared admin password.
//   2. On success, receive a short-lived admin token.
//   3. That token (x-admin-token header) unlocks the rest of these routes.
import { Router } from 'express';
import config from '../config/env.js';
import { AdminModel } from '../models/adminModel.js';
import { requireAdmin, issueAdminToken } from '../middleware/adminAuth.js';
import { adminLoginSchema } from '../validators/schemas.js';
import { validate } from '../utils/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';

const router = Router();

// POST /api/admin/login — verify the admin password, return an admin token.
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { password } = validate(adminLoginSchema, req.body);
    if (password !== config.adminPassword) {
      throw ApiError.unauthorized('Incorrect admin password.');
    }
    res.json({ adminToken: issueAdminToken() });
  })
);

// ── Everything below requires a valid admin token ──────────────────────────
router.use(requireAdmin);

// GET /api/admin/overview — app-wide totals.
router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    res.json({ overview: await AdminModel.overview() });
  })
);

// GET /api/admin/stores — every registered store with a quick snapshot.
router.get(
  '/stores',
  asyncHandler(async (req, res) => {
    res.json({ stores: await AdminModel.listStores() });
  })
);

export default router;
