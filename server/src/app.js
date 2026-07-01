// Express application setup: security middleware, routes, error handling.
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import config from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import scanRoutes from './routes/scanRoutes.js';
import ownerRoutes from './routes/ownerRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

// Trust the first proxy (needed for correct client IPs / rate limiting behind
// a load balancer such as Render, Railway, Fly.io, or Nginx).
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────────────
app.use(helmet());

// ── CORS: only allow the configured front-end origin(s) ───────────────────
app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin / curl / mobile apps (no origin header).
      if (!origin || config.clientOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// ── Body parsing with a sane size limit ───────────────────────────────────
app.use(express.json({ limit: '100kb' }));

// ── Request logging (concise in prod, verbose in dev) ─────────────────────
app.use(morgan(config.isProduction ? 'combined' : 'dev'));

// ── Rate limiting ─────────────────────────────────────────────────────────
// A general limiter for the whole API, plus a stricter one for auth endpoints
// to slow down brute-force attempts.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: { message: 'Too many attempts. Please try again later.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', generalLimiter);

// ── Health check (useful for uptime monitors / load balancers) ────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/admin', authLimiter, adminRoutes);

// ── 404 + central error handler (must be last) ────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
