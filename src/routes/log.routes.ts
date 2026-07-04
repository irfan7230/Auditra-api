import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import {
  bulkUpload,
  getLogs,
  getStats,
  filterOptions,
  healthCheck,
  clearLogs,
} from '../controllers/log.controller';
import { uploadLimiter, queryLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/health', asyncHandler(healthCheck));

router.post('/logs/bulk-upload', uploadLimiter, asyncHandler(bulkUpload));
router.get('/logs', queryLimiter, asyncHandler(getLogs));
router.get('/logs/stats', queryLimiter, asyncHandler(getStats));
router.get('/logs/filter-options', queryLimiter, asyncHandler(filterOptions));

// Destructive operation — rate limited to 5 per minute to prevent accidents
router.delete('/logs', uploadLimiter, asyncHandler(clearLogs));

export default router;
