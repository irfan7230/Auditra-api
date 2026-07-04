// HTTP handlers for log routes.
// These stay intentionally thin — input validation and business logic
// are handled in the validator schemas and service layer respectively.

import { Request, Response } from 'express';
import { bulkUploadSchema, logQuerySchema } from '../validators/log.validator';
import {
  bulkInsertLogs,
  queryLogs,
  getLogStats,
  getFilterOptions,
  clearAllLogs,
} from '../services/log.service';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';
import { LogQueryParams } from '../types/log.types';

export async function bulkUpload(req: Request, res: Response): Promise<void> {
  const { error, value } = bulkUploadSchema.validate(req.body, {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((d) => d.message);
    throw new AppError('Validation failed', 422, details);
  }

  logger.info('Bulk upload initiated', { count: value.length, ip: req.ip });

  const result = await bulkInsertLogs(value);

  // 207 Multi-Status when some records succeeded and some failed
  const statusCode = result.failed > 0 && result.inserted === 0 ? 422 : 207;

  res.status(statusCode).json({
    success: result.inserted > 0,
    message: `Inserted ${result.inserted} records. ${result.failed} failed.`,
    data: result,
  });
}

export async function getLogs(req: Request, res: Response): Promise<void> {
  const { error, value } = logQuerySchema.validate(req.query, { stripUnknown: true });

  if (error) {
    throw new AppError('Invalid query parameters', 400, error.details.map((d) => d.message));
  }

  const result = await queryLogs(value as LogQueryParams);

  res.status(200).json({
    success: true,
    ...result,
  });
}

export async function getStats(_req: Request, res: Response): Promise<void> {
  const stats = await getLogStats();
  res.status(200).json({ success: true, data: stats });
}

export async function filterOptions(_req: Request, res: Response): Promise<void> {
  const options = await getFilterOptions();
  res.status(200).json({ success: true, data: options });
}

export async function healthCheck(_req: Request, res: Response): Promise<void> {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

export async function clearLogs(req: Request, res: Response): Promise<void> {
  // Log this at warn level since it's a destructive operation
  logger.warn('All logs deletion initiated', { ip: req.ip, requestId: req.requestId });
  const result = await clearAllLogs();
  res.status(200).json({
    success: true,
    message: `Successfully deleted ${result.deleted.toLocaleString()} log records.`,
    data: result,
  });
}
