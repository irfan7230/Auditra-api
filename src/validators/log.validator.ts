// Joi validation schemas for all log-related API inputs.
// Validation happens at the HTTP boundary before anything touches the database.

import Joi from 'joi';
import { SEVERITY_LEVELS, LOG_STATUSES, MAX_BULK_RECORDS, SORTABLE_FIELDS } from '../config/constants';

// Schema for a single log record — used as the item schema for bulk upload
export const logRecordSchema = Joi.object({
  actor: Joi.string().trim().max(255).required(),
  role: Joi.string().trim().max(100).required(),
  action: Joi.string().trim().max(100).required(),
  resource: Joi.string().trim().max(500).required(),
  resourceType: Joi.string().trim().max(100).required(),
  ipAddress: Joi.string().ip({ version: ['ipv4', 'ipv6'], cidr: 'forbidden' }).required(),
  region: Joi.string().trim().max(50).required(),
  severity: Joi.string()
    .valid(...SEVERITY_LEVELS)
    .uppercase()
    .required(),
  status: Joi.string()
    .valid(...LOG_STATUSES)
    .default('Unresolved'),
  timestamp: Joi.date().iso().required(),
});

// The bulk upload body must be an array of log records
export const bulkUploadSchema = Joi.array()
  .items(logRecordSchema)
  .min(1)
  .max(MAX_BULK_RECORDS)
  .required();

// Query parameters for GET /api/logs
// severity and status both accept comma-separated values (e.g. severity=HIGH,CRITICAL)
export const logQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(25),
  sortBy: Joi.string().valid(...SORTABLE_FIELDS).default('timestamp'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  search: Joi.string().trim().max(200).optional(),
  actor: Joi.string().trim().max(255).optional(),
  role: Joi.string().trim().max(100).optional(),
  action: Joi.string().trim().max(100).optional(),
  resourceType: Joi.string().trim().max(100).optional(),
  ipAddress: Joi.string().trim().max(45).optional(),
  region: Joi.string().trim().max(50).optional(),
  severity: Joi.string().trim().max(100).optional(),
  status: Joi.string().trim().max(100).optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
}).options({ allowUnknown: false, stripUnknown: true });
