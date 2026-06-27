// A small typed error class so route/controller code can throw HTTP-aware
// errors that the central error handler turns into clean JSON responses.
export default class ApiError extends Error {
  /**
   * @param {number} statusCode  HTTP status code (e.g. 400, 401, 404).
   * @param {string} message     Human-readable message safe to send to clients.
   * @param {object} [details]   Optional extra info (e.g. validation issues).
   */
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // Distinguishes expected errors from bugs.
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg = 'Bad request', details) {
    return new ApiError(400, msg, details);
  }
  static unauthorized(msg = 'Unauthorized') {
    return new ApiError(401, msg);
  }
  static forbidden(msg = 'Forbidden') {
    return new ApiError(403, msg);
  }
  static notFound(msg = 'Not found') {
    return new ApiError(404, msg);
  }
  static conflict(msg = 'Conflict') {
    return new ApiError(409, msg);
  }
}
