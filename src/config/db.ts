// MongoDB connection with automatic reconnect handling.
// We use the standard mongodb:// connection string rather than mongodb+srv://
// to bypass SRV DNS lookups, which can fail silently on some network configurations.

import mongoose from 'mongoose';
import logger from '../utils/logger';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/auditra';

const CONNECTION_OPTIONS = {
  maxPoolSize: 50,        // support up to 50 concurrent connections (important for bulk ops)
  minPoolSize: 10,
  serverSelectionTimeoutMS: 5_000,
  socketTimeoutMS: 45_000,
  connectTimeoutMS: 10_000,
  maxIdleTimeMS: 10_000,  // close idle connections to avoid Atlas's connection limits
  // Don't auto-build indexes on startup in production — handle that separately
  autoIndex: process.env.NODE_ENV !== 'production',
  // Force IPv4 DNS resolution — Node 18+ prefers IPv6 by default,
  // which causes ECONNREFUSED on some Windows/ISP configurations
  family: 4,
};

export async function connectDB(): Promise<void> {
  try {
    mongoose.set('strictQuery', true);

    mongoose.connection.on('connected', () =>
      logger.info('MongoDB connected', { uri: MONGO_URI.replace(/\/\/.*@/, '//***@') })
    );
    mongoose.connection.on('disconnected', () =>
      logger.warn('MongoDB disconnected — attempting reconnect')
    );
    mongoose.connection.on('error', (err) =>
      logger.error('MongoDB connection error', { error: err.message })
    );

    await mongoose.connect(MONGO_URI, CONNECTION_OPTIONS);
  } catch (err) {
    logger.error('Failed to connect to MongoDB', {
      error: err instanceof Error ? err.message : err,
    });
    throw err;
  }
}

export function getConnectionState(): string {
  const states: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] ?? 'unknown';
}
