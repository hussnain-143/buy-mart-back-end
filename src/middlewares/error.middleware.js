export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  console.error("❌ ERROR OBJECT:", err);
  console.error("❌ ERROR STACK:", err.stack);

  res.status(statusCode).json({
    success: err.success ?? false,
    message,
    errors: err.errors || [],
    stack: err.stack, // Always show stack for now to debug "next is not a function"
    debug_info: {
        path: req.url,
        method: req.method,
        has_next: typeof next === 'function'
    }
  });
};
