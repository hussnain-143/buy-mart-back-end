// src/middleware/error.middleware.js
export const errorHandler = (err, req, res, next) => {
  // If the error is an instance of apiError, use its status code
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: err.success ?? false,
    message,
    errors: err.errors || [],
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
