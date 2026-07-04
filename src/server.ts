// Entry point — connects to the database and starts the HTTP server.
// Handles graceful shutdown on SIGTERM/SIGINT so in-flight requests
// aren't dropped when the process is killed by a deployment platform.

import 'dotenv/config';
import app from './app';
import { connectDB } from './config/db';
import logger from './utils/logger';

const PORT = Number(process.env.PORT) || 5000;

async function bootstrap(): Promise<void> {
  try {
    await connectDB();

    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Auditra API ready`, {
        port: PORT,
        env: process.env.NODE_ENV ?? 'development',
        pid: process.pid,
      });
    });

    const shutdown = (signal: string): void => {
      logger.info(`${signal} received — graceful shutdown`);
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
      // If connections don't drain within 10s, force exit
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason: unknown) => {
      logger.error('Unhandled promise rejection', { reason });
      shutdown('unhandledRejection');
    });
  } catch (err) {
    logger.error('Bootstrap failed', { error: err instanceof Error ? err.message : err });
    process.exit(1);
  }
}

bootstrap();
