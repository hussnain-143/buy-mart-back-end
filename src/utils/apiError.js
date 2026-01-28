export class apiError extends Error {
  constructor(statusCode, message, errors = [], stack = "") {
    (super(message),
      (this.statusCode = statusCode),
      (this.errors = errors),
      (this.success = false),
      (this.isApiError = true));

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
