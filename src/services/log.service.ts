// All log-related database operations live here.
// Controllers stay thin — they validate HTTP input and hand off to these functions.

import mongoose from 'mongoose';
import Log from '../models/Log';
import { AppError } from '../utils/AppError';
import { buildLogQuery } from '../utils/queryBuilder';
import logger from '../utils/logger';
import type {
  ILog,
  LogQueryParams,
  PaginatedLogsResponse,
  BulkUploadResult,
} from '../types/log.types';
import { BULK_BATCH_SIZE, MAX_BULK_RECORDS } from '../config/constants';

// Inserts log records in batches using insertMany with ordered:false.
// ordered:false means MongoDB keeps inserting valid documents even when some fail —
// a handful of bad records won't block thousands of good ones.
export async function bulkInsertLogs(records: ILog[]): Promise<BulkUploadResult> {
  if (records.length === 0) {
    throw AppError.badRequest('No records provided');
  }
  if (records.length > MAX_BULK_RECORDS) {
    throw AppError.badRequest(
      `Exceeded maximum of ${MAX_BULK_RECORDS.toLocaleString()} records per request`
    );
  }

  const result: BulkUploadResult = { inserted: 0, failed: 0, errors: [] };
  const startTime = Date.now();

  for (let i = 0; i < records.length; i += BULK_BATCH_SIZE) {
    const batch = records.slice(i, i + BULK_BATCH_SIZE);
    const batchNum = Math.floor(i / BULK_BATCH_SIZE) + 1;

    try {
      const res = await Log.insertMany(batch, {
        ordered: false,
        rawResult: false,
        lean: true,
      } as any);
      result.inserted += Array.isArray(res) ? res.length : batch.length;
    } catch (err: unknown) {
      if (
        err instanceof mongoose.mongo.MongoBulkWriteError &&
        err.result?.insertedCount !== undefined
      ) {
        // Partial failure — some documents made it through, some didn't
        result.inserted += err.result.insertedCount;
        const writeErrors = (err.writeErrors ?? []) as any;
        for (const we of writeErrors) {
          result.failed += 1;
          // Cap the error list at 100 entries so the response doesn't balloon
          if (result.errors.length < 100) {
            result.errors.push({
              index: i + we.index,
              error: we.err?.message ?? 'Write error',
            });
          }
        }
        logger.warn('Partial batch failure', {
          batchNum,
          batchStart: i,
          inserted: err.result.insertedCount,
          failed: writeErrors.length,
        });
      } else {
        // The whole batch failed
        result.failed += batch.length;
        if (result.errors.length < 100) {
          result.errors.push({
            index: i,
            error: err instanceof Error ? err.message : 'Batch failed',
          });
        }
        logger.error('Full batch failure', { batchNum, batchStart: i, error: err });
      }
    }

    // Yield to the event loop every 5 batches so we don't starve
    // concurrent requests during a large upload
    if (batchNum % 5 === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  logger.info('Bulk insert complete', {
    inserted: result.inserted,
    failed: result.failed,
    total: records.length,
    durationMs: Date.now() - startTime,
    errorsSampled: result.errors.length,
  });

  return result;
}

// Fetches a page of logs matching the given filter parameters.
// We run countDocuments and the data fetch in parallel to cut response time in half.
export async function queryLogs(params: LogQueryParams): Promise<PaginatedLogsResponse> {
  const { filter, sort, skip, limit, page } = buildLogQuery(params);

  // Only fetch the fields the client actually needs — keeps payload sizes small
  const projection = {
    actor: 1, role: 1, action: 1, resource: 1, resourceType: 1,
    ipAddress: 1, region: 1, severity: 1, status: 1, timestamp: 1,
  };

  const [total, data] = await Promise.all([
    Log.countDocuments(filter).lean(),
    Log.find(filter, projection)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    data: data as unknown as ILog[],
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    meta: {
      sortBy: params.sortBy ?? 'timestamp',
      sortOrder: params.sortOrder ?? 'desc',
      filters: buildActiveFilters(params),
    },
  };
}

// Gets the numbers for the dashboard stat cards.
// estimatedDocumentCount uses collection metadata (O(1)) rather than counting
// every document, which makes it much faster for the total.
export async function getLogStats() {
  const [severityBreakdown, statusBreakdown, total] = await Promise.all([
    Log.aggregate([
      { $group: { _id: '$severity', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).exec(),
    Log.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).exec(),
    Log.estimatedDocumentCount(),
  ]);

  return { total, severityBreakdown, statusBreakdown };
}

// Returns the distinct values for each filter dropdown.
// Capped at 500 per field to avoid sending massive payloads on large datasets.
export async function getFilterOptions() {
  const limit = 500;
  const [actors, roles, actions, resourceTypes, regions] = await Promise.all([
    Log.distinct('actor').then((r: string[]) => r.slice(0, limit).sort()),
    Log.distinct('role').then((r: string[]) => r.slice(0, limit).sort()),
    Log.distinct('action').then((r: string[]) => r.slice(0, limit).sort()),
    Log.distinct('resourceType').then((r: string[]) => r.sort()),
    Log.distinct('region').then((r: string[]) => r.sort()),
  ]);

  return { actors, roles, actions, resourceTypes, regions };
}

// Wipes the entire logs collection
export async function clearAllLogs(): Promise<{ deleted: number }> {
  const result = await Log.deleteMany({});
  logger.info('All logs cleared', { deleted: result.deletedCount });
  return { deleted: result.deletedCount };
}

// Builds a map of which filters are currently active for the response meta field
function buildActiveFilters(params: LogQueryParams): Record<string, unknown> {
  const FILTER_KEYS: readonly (keyof LogQueryParams)[] = [
    'actor', 'role', 'action', 'resourceType', 'ipAddress',
    'region', 'severity', 'status', 'search', 'startDate', 'endDate',
  ];
  return FILTER_KEYS.reduce<Record<string, unknown>>((acc, key) => {
    if (params[key]) acc[key] = params[key];
    return acc;
  }, {});
}
