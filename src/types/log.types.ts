// ============================================================
// src/types/log.types.ts
// Central type definitions for the audit log domain
// ============================================================

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type LogStatus = 'Resolved' | 'Unresolved' | 'In Progress';

export interface ILog {
  _id?: string;
  actor: string;
  role: string;
  action: string;
  resource: string;
  resourceType: string;
  ipAddress: string;
  region: string;
  severity: Severity;
  status: LogStatus;
  timestamp: Date | string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LogQueryParams {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  actor?: string;
  role?: string;
  action?: string;
  resourceType?: string;
  ipAddress?: string;
  region?: string;
  severity?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface PaginatedLogsResponse {
  data: ILog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta: {
    sortBy: string;
    sortOrder: string;
    filters: Record<string, unknown>;
  };
}

export interface BulkUploadResult {
  inserted: number;
  failed: number;
  errors: Array<{ index: number; error: string }>;
}
