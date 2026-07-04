// Translates HTTP query parameters into a MongoDB filter + sort + pagination object.
// Centralizing this logic makes it easy to test in isolation and keeps
// the service layer focused on database operations rather than parameter parsing.

import { FilterQuery } from 'mongoose';
import { LogQueryParams } from '../types/log.types';
import { SORTABLE_FIELDS, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '../config/constants';
import { ILogDocument } from '../models/Log';

interface ParsedQuery {
  filter: FilterQuery<ILogDocument>;
  sort: Record<string, 1 | -1>;
  skip: number;
  limit: number;
  page: number;
}

export function buildLogQuery(params: LogQueryParams): ParsedQuery {
  const filter: FilterQuery<ILogDocument> = {};

  // Global search via MongoDB text index on actor, action, resource, role
  if (params.search?.trim()) {
    filter.$text = { $search: params.search.trim() };
  }

  // These fields support comma-separated multi-value (e.g. region=us-east-1,eu-west-1)
  const exactFields = ['role', 'action', 'resourceType', 'region', 'ipAddress'] as const;
  for (const field of exactFields) {
    if (params[field]) {
      const values = (params[field] as string).split(',').map((v) => v.trim());
      filter[field] = values.length > 1 ? { $in: values } : values[0];
    }
  }

  // Actor uses a case-insensitive regex so you can search for partial email addresses
  if (params.actor) {
    filter['actor'] = { $regex: params.actor.trim(), $options: 'i' };
  }

  if (params.severity) {
    const values = params.severity.split(',').map((v) => v.trim().toUpperCase());
    filter['severity'] = values.length > 1 ? { $in: values } : values[0];
  }

  if (params.status) {
    const values = params.status.split(',').map((v) => v.trim());
    filter['status'] = values.length > 1 ? { $in: values } : values[0];
  }

  // Date range — both bounds are optional, so you can do "from X" or "until Y" alone
  if (params.startDate || params.endDate) {
    filter['timestamp'] = {};
    if (params.startDate) {
      (filter['timestamp'] as Record<string, Date>)['$gte'] = new Date(params.startDate);
    }
    if (params.endDate) {
      (filter['timestamp'] as Record<string, Date>)['$lte'] = new Date(params.endDate);
    }
  }

  // Only allow sorting by fields we have indexes on — fall back to timestamp for anything else
  const rawSortBy = params.sortBy ?? 'timestamp';
  const sortBy = (SORTABLE_FIELDS as readonly string[]).includes(rawSortBy)
    ? rawSortBy
    : 'timestamp';
  const sortOrder = params.sortOrder === 'asc' ? 1 : -1;
  const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder };

  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(params.limit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;

  return { filter, sort, skip, limit, page };
}
