// ============================================================
// src/config/constants.ts
// Application-wide constants
// ============================================================

export const SEVERITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const LOG_STATUSES = ['Resolved', 'Unresolved', 'In Progress'] as const;
export const REGIONS = [
  'us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1',
  'ap-south-1', 'ap-southeast-1', 'ap-northeast-1', 'sa-east-1',
] as const;

export const RESOURCE_TYPES = [
  'USER', 'ROLE', 'API', 'DATABASE', 'FILE', 'CONFIG', 'NETWORK', 'SERVICE',
] as const;

export const SORTABLE_FIELDS = [
  'timestamp', 'actor', 'action', 'severity', 'status',
  'region', 'resourceType', 'role', 'createdAt',
] as const;

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 200;
export const MAX_BULK_RECORDS = Number(process.env.BULK_MAX_RECORDS) || 50_000;
export const BULK_BATCH_SIZE = Number(process.env.BULK_BATCH_SIZE) || 1_000;
