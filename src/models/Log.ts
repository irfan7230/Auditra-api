// Mongoose schema for audit log documents.
// Indexes are defined here so they're co-located with the schema
// rather than scattered across migration files.

import mongoose, { Schema, Document, Model } from 'mongoose';
import { ILog, Severity, LogStatus } from '../types/log.types';
import { SEVERITY_LEVELS, LOG_STATUSES } from '../config/constants';

export interface ILogDocument extends Omit<ILog, '_id'>, Document {}

const LogSchema = new Schema<ILogDocument>(
  {
    actor: {
      type: String,
      required: [true, 'actor is required'],
      trim: true,
      maxlength: 255,
      index: true,
    },
    role: {
      type: String,
      required: [true, 'role is required'],
      trim: true,
      maxlength: 100,
      index: true,
    },
    action: {
      type: String,
      required: [true, 'action is required'],
      trim: true,
      maxlength: 100,
      index: true,
    },
    resource: {
      type: String,
      required: [true, 'resource is required'],
      trim: true,
      maxlength: 500,
    },
    resourceType: {
      type: String,
      required: [true, 'resourceType is required'],
      trim: true,
      maxlength: 100,
      index: true,
    },
    ipAddress: {
      type: String,
      required: [true, 'ipAddress is required'],
      trim: true,
      maxlength: 45, // IPv6 max length
    },
    region: {
      type: String,
      required: [true, 'region is required'],
      trim: true,
      maxlength: 50,
      index: true,
    },
    severity: {
      type: String,
      required: [true, 'severity is required'],
      enum: {
        values: SEVERITY_LEVELS as unknown as string[],
        message: `severity must be one of: ${SEVERITY_LEVELS.join(', ')}`,
      },
      index: true,
    },
    status: {
      type: String,
      required: [true, 'status is required'],
      enum: {
        values: LOG_STATUSES as unknown as string[],
        message: `status must be one of: ${LOG_STATUSES.join(', ')}`,
      },
      default: 'Unresolved',
      index: true,
    },
    timestamp: {
      type: Date,
      required: [true, 'timestamp is required'],
      index: true,
    },
  },
  {
    timestamps: true,  // adds createdAt and updatedAt automatically
    versionKey: false,
    collection: 'logs',
    toJSON: {
      transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  }
);

// Compound indexes for the most common query patterns.
// Most dashboard queries combine severity or status with a timestamp sort,
// so these indexes let MongoDB satisfy those queries without scanning the full collection.
LogSchema.index({ timestamp: -1 });
LogSchema.index({ severity: 1, timestamp: -1 });
LogSchema.index({ status: 1, timestamp: -1 });
LogSchema.index({ actor: 1, timestamp: -1 });
LogSchema.index({ region: 1, severity: 1 });
LogSchema.index({ action: 1, resourceType: 1 });

// Text index for the global search bar.
// Weights give actor and action higher relevance than resource in search scoring.
LogSchema.index(
  { actor: 'text', action: 'text', resource: 'text', role: 'text' },
  { name: 'log_text_search', weights: { actor: 3, action: 2, resource: 1, role: 1 } }
);

const Log: Model<ILogDocument> = mongoose.model<ILogDocument>('Log', LogSchema);

export default Log;
