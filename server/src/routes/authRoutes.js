// Authentication routes: register and login.
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { UserModel } from '../models/userModel.js';
import { registerSchema, loginSchema } from '../validators/schemas.js';
import { validate } from '../utils/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';

const router = Router();

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

// POST /api/auth/register — create a new account and sign the user in immediately.
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = validate(registerSchema, req.body);

    if (await UserModel.findByEmail(data.email)) {
      throw ApiError.conflict('An account with this email already exists.');
    }

    const user = await UserModel.create(data);
    const token = signToken(user);
    res.status(201).json({ token, user: UserModel.toPublic(user) });
  })
);

// POST /api/auth/login — sign in with email + password.
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = validate(loginSchema, req.body);
    const user = await UserModel.findByEmail(data.email);

    // Generic message so we don't leak which part was wrong.
    if (!user || !UserModel.verifyPassword(user, data.password)) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    const token = signToken(user);
    res.json({ token, user: UserModel.toPublic(user) });
  })
);

export default router;
