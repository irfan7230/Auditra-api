// AppError is a custom error class that carries an HTTP status code and optional details.
// Throwing an AppError signals that this is an expected, operational failure (bad input,
// not found, etc.) rather than an unexpected bug. The error handler responds to these
// differently from regular Error instances.

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;
  public readonly code?: string;

  constructor(message: string, statusCode = 500, details?: unknown, code?: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(message, 400, details, 'BAD_REQUEST');
  }

  static unprocessable(message: string, details?: unknown): AppError {
    return new AppError(message, 422, details, 'VALIDATION_ERROR');
  }

  static notFound(message: string): AppError {
    return new AppError(message, 404, undefined, 'NOT_FOUND');
  }

  static tooManyRequests(message: string): AppError {
    return new AppError(message, 429, undefined, 'RATE_LIMITED');
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError(message, 500, undefined, 'INTERNAL_ERROR');
  }
}
