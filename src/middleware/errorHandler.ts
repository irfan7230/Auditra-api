// Global error handler for Express.
// Distinguishes between operational errors (AppError) that we explicitly threw
// and unexpected runtime errors that need to be treated as 500s.
// This is the last middleware in the chain, so it catches everything that
// falls through from route handlers.

import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';

interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  requestId?: string;
  details?: unknown;
  stack?: string;  // only included in development
}

export function errorHandler(
  err: Error & { type?: string; code?: string | number; status?: number },
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId;
  const elapsed = req.startTime ? Date.now() - req.startTime : 0;
  const isDev = process.env.NODE_ENV === 'development';

  const respond = (status: number, body: ErrorResponse) => {
    res.status(status).json(body);
  };

  // Operational errors — we threw these intentionally, safe to show the message to clients
  if (err instanceof AppError) {
    logger.warn('AppError', {
      requestId,
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      elapsed,
    });
    return respond(err.statusCode, {
      success: false,
      error: err.message,
      code: err.code,
      requestId,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // Mongoose document validation failed
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => e.message);
    return respond(422, {
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      requestId,
      details,
    });
  }

  // Invalid ID or type coercion failure
  if (err instanceof mongoose.Error.CastError) {
    return respond(400, {
      success: false,
      error: `Invalid value for field: ${err.path}`,
      code: 'CAST_ERROR',
      requestId,
    });
  }

  // Duplicate key (shouldn't happen in our schema but good to handle)
  if (err.code === 11000 || err.code === '11000') {
    return respond(409, {
      success: false,
      error: 'Duplicate key conflict',
      code: 'DUPLICATE_KEY',
      requestId,
    });
  }

  // Request body too large
  if (err.type === 'entity.too.large' || err.status === 413) {
    return respond(413, {
      success: false,
      error: 'Request payload too large. Maximum allowed is 50MB.',
      code: 'PAYLOAD_TOO_LARGE',
      requestId,
    });
  }

  // Malformed JSON body
  if (err instanceof SyntaxError && 'body' in err) {
    return respond(400, {
      success: false,
      error: 'Malformed JSON in request body',
      code: 'INVALID_JSON',
      requestId,
    });
  }

  // Anything else is an unexpected error — log it fully and return a generic message
  logger.error('Unhandled error', {
    requestId,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    elapsed,
  });

  return respond(500, {
    success: false,
    error: 'An unexpected error occurred. Please try again later.',
    code: 'INTERNAL_ERROR',
    requestId,
    ...(isDev ? { stack: err.stack } : {}),
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    code: 'NOT_FOUND',
  });
}
