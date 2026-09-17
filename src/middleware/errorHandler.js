/**
 * Global Express Error Handling Middleware
 * Ensures every error follows the envelope format: { "data": null, "error": ... }
 */

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[Error Handler] [${req.method} ${req.originalUrl}] [${status}]:`, message);
  if (err.details) {
    console.error('[Error Details]:', JSON.stringify(err.details, null, 2));
  }
  if (status === 500 && err.stack) {
    console.error(err.stack);
  }

  res.status(status).json({
    data: null,
    error: {
      message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
}

/**
 * 404 Not Found Middleware
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    data: null,
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
