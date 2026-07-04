// ============================================================
// src/middleware/requestId.ts
// Attaches a unique request ID to every request for tracing
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.requestId = (req.headers['x-request-id'] as string) || randomUUID();
  req.startTime = Date.now();
  res.setHeader('X-Request-ID', req.requestId);
  next();
}
