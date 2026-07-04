// ============================================================
// src/middleware/rateLimiter.ts
// Rate limiting configs for different route groups
// ============================================================

import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/AppError';

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;

// ── Upload endpoint — strict (5 uploads/min) ─────────────────
export const uploadLimiter = rateLimit({
  windowMs,
  max: Number(process.env.RATE_LIMIT_UPLOAD_MAX) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError('Too many upload requests — please wait before trying again', 429));
  },
});

// ── Query endpoints — generous ────────────────────────────────
export const queryLimiter = rateLimit({
  windowMs,
  max: Number(process.env.RATE_LIMIT_QUERY_MAX) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError('Too many requests — slow down', 429));
  },
});
