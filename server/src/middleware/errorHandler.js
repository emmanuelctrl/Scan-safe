// Central error handler + 404 handler.
import config from '../config/env.js';
import ApiError from '../utils/ApiError.js';

/** Catch-all for unmatched routes. */
export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Converts any error into a consistent JSON response.
 * Operational (expected) errors expose their message; unexpected errors are
 * logged server-side and return a generic message so internals never leak.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  const isApiError = err instanceof ApiError;
  const statusCode = isApiError ? err.statusCode : 500;

  if (!isApiError || statusCode >= 500) {
    // Log unexpected errors with full detail for debugging/monitoring.
    console.error('[error]', err);
  }

  const body = {
    error: {
      message: isApiError ? err.message : 'Something went wrong. Please try again.',
    },
  };

  if (isApiError && err.details) {
    body.error.details = err.details;
  }
  // Only expose stack traces outside production.
  if (!config.isProduction && !isApiError) {
    body.error.stack = err.stack;
  }

  res.status(statusCode).json(body);
}
