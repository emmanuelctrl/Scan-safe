// Zod validation schemas shared across routes.
import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('A valid email is required.');
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password is too long.');
const pin = z
  .string()
  .regex(/^\d{6}$/, 'PIN must be exactly 6 digits.');

// A Gmail App Password: 16 characters, usually displayed in four space-separated
// groups ("abcd efgh ijkl mnop"). We accept it with or without the spaces.
const gmailAppPassword = z
  .string()
  .transform((v) => v.replace(/\s+/g, ''))
  .refine((v) => /^[A-Za-z]{16}$/.test(v), 'A Gmail App Password is 16 letters.');

export const registerSchema = z
  .object({
    email,
    password,
    name: z.string().trim().max(80).optional(),
    // Allow registering an owner account, but workers by default.
    role: z.enum(['worker', 'owner']).optional(),
    // Optional Gmail notification sender. Both fields go together.
    smtpUser: email.optional(),
    smtpPass: gmailAppPassword.optional(),
  })
  .refine((d) => Boolean(d.smtpUser) === Boolean(d.smtpPass), {
    message: 'Provide both a Gmail address and its App Password, or neither.',
    path: ['smtpPass'],
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required.'),
});

export const itemSchema = z.object({
  barcode: z.string().trim().min(1, 'Barcode is required.').max(64),
  name: z.string().trim().min(1, 'Name is required.').max(120),
  price: z.coerce.number().min(0, 'Price cannot be negative.'),
  quantity: z.coerce.number().int().min(0, 'Quantity cannot be negative.'),
  low_stock_at: z.coerce.number().int().min(0).default(5),
  sku: z.string().trim().max(64).optional(),
  category: z.string().trim().max(64).optional(),
});

// For edits every field is optional, but at least the shape is validated.
export const itemUpdateSchema = itemSchema.partial();

export const scanSchema = z.object({
  barcode: z.string().trim().min(1, 'Barcode is required.').max(64),
  action: z.enum(['scan', 'checkout']).default('checkout'),
  quantity: z.coerce.number().int().min(1).max(1000).default(1),
  // Optional per-sale price override (e.g. a negotiated discount). When
  // omitted, the item's stored price is used.
  price: z.coerce.number().min(0, 'Price cannot be negative.').optional(),
});

export const unlockSchema = z.object({ pin });

export const changePinSchema = z.object({
  currentPin: pin,
  newPin: pin,
});

export const notificationEmailSchema = z.object({ email });

export const themeSchema = z.object({ theme: z.enum(['light', 'dark']) });

export const smtpCredentialsSchema = z.object({
  smtpUser: email,
  smtpPass: gmailAppPassword,
});

export const adminLoginSchema = z.object({
  password: z.string().min(1, 'Password is required.'),
});

export const stockAdjustSchema = z.object({
  change: z.coerce
    .number()
    .int('Change must be a whole number.')
    .refine((v) => v !== 0, 'Change cannot be zero.'),
});
