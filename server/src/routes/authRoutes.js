// Authentication routes: register (with email verification), verify, login.
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { randomInt } from 'node:crypto';
import config from '../config/env.js';
import { UserModel } from '../models/userModel.js';
import { sendVerificationEmail } from '../services/emailService.js';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from '../validators/schemas.js';
import { validate } from '../utils/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';

const router = Router();

const VERIFICATION_TTL_MS = 15 * 60 * 1000; // Codes expire after 15 minutes.

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

/** Generate a fresh 6-digit code, persist its hash, and email it. */
async function issueVerificationCode(user) {
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();
  await UserModel.setVerificationCode(user.id, code, expiresAt);
  await sendVerificationEmail({ to: user.email, code });
}

// POST /api/auth/register — create a new account (unverified) and email a
// 6-digit verification code. No session token until the code is confirmed.
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = validate(registerSchema, req.body);

    if (await UserModel.findByEmail(data.email)) {
      throw ApiError.conflict('An account with this email already exists.');
    }

    const user = await UserModel.create(data);
    await issueVerificationCode(user);

    res.status(201).json({
      requiresVerification: true,
      email: user.email,
      message: 'Account created. Check your email for a 6-digit verification code.',
    });
  })
);

// POST /api/auth/verify — confirm the emailed code, activate the account,
// and sign the user in.
router.post(
  '/verify',
  asyncHandler(async (req, res) => {
    const { email, code } = validate(verifyEmailSchema, req.body);
    const user = await UserModel.findByEmail(email);

    // One generic message for a wrong email, wrong code, or expired code.
    if (!user || user.email_verified || !UserModel.checkVerificationCode(user, code)) {
      throw ApiError.unauthorized('Invalid or expired verification code.');
    }

    await UserModel.markEmailVerified(user.id);
    const fresh = await UserModel.findById(user.id);
    const token = signToken(fresh);
    res.json({ token, user: UserModel.toPublic(fresh) });
  })
);

// POST /api/auth/resend-verification — issue a new code for an unverified
// account. Responds identically whether or not the account exists, so it
// can't be used to probe registered emails.
router.post(
  '/resend-verification',
  asyncHandler(async (req, res) => {
    const { email } = validate(resendVerificationSchema, req.body);
    const user = await UserModel.findByEmail(email);
    if (user && !user.email_verified) {
      await issueVerificationCode(user);
    }
    res.json({ message: 'If that account needs verification, a new code has been sent.' });
  })
);

// POST /api/auth/login — sign in with email + password.
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = validate(loginSchema, req.body);
    const user = await UserModel.findByEmail(data.email);

    // Use a single generic message to avoid leaking which part was wrong.
    if (!user || !UserModel.verifyPassword(user, data.password)) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    if (!user.email_verified) {
      throw new ApiError(403, 'Please verify your email to sign in.', {
        requiresVerification: true,
      });
    }

    const token = signToken(user);
    res.json({ token, user: UserModel.toPublic(user) });
  })
);

export default router;
