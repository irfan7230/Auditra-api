// Sets up the Express application with all middleware, routes, and error handling.
// Middleware order matters here — security headers come first, then parsing, then logging.

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';

import logRoutes from './routes/log.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';
import logger from './utils/logger';

const app: Application = express();

// Needed so req.ip reflects the real client IP when running behind
// platforms like Railway or Vercel that proxy traffic through a load balancer
app.set('trust proxy', 1);

// Attach a unique request ID to every incoming request.
// This runs first so every subsequent log line has the ID attached.
app.use(requestIdMiddleware);

// Standard security headers. We disable CSP since this is a pure JSON API
// and turn on cross-origin resource policy for hosted assets.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

// Parse allowed origins from the environment variable.
// In development without any value set, we allow all origins to avoid friction.
const rawOrigins = process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = rawOrigins
  .split(',')
  .map((o) => o.trim().replace(/\/$/, '')) // Strip trailing slashes to prevent CORS mismatches
  .filter(Boolean);

const corsOrigin =
  allowedOrigins.length === 0 && process.env.NODE_ENV !== 'production'
    ? true
    : (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || allowedOrigins.includes(origin)) {
          cb(null, true);
        } else {
          logger.warn('CORS rejected', { origin });
          cb(new Error(`Origin not allowed by CORS policy`));
        }
      };

app.use(
  cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400,
    credentials: false,
  })
);

// 50MB limit to support bulk uploads of up to 50,000 log records
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Strip any MongoDB operators ($where, $gt, etc.) from request bodies
// to prevent NoSQL injection attacks
app.use(
  mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
      logger.warn('NoSQL injection attempt sanitized', {
        requestId: req.requestId,
        key,
        path: req.path,
        ip: req.ip,
      });
    },
  })
);

// Compress responses larger than 1KB — saves bandwidth on paginated log responses
app.use(
  compression({
    threshold: 1024,
    level: 6,
  })
);

// Log all HTTP requests through Winston. Skip the health check endpoint
// to avoid cluttering logs with automated health probe traffic.
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(
  morgan(morganFormat, {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: (req) => req.url === '/api/health',
  })
);

// Don't advertise that this is an Express app
app.disable('x-powered-by');

app.use('/api', logRoutes);

// 404 handler must come after all routes, error handler must come last
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
