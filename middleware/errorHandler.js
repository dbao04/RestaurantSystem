/**
 * MIDDLEWARE: Error Handler & Utilities
 */

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('ERROR:', err);
  
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Đã xảy ra lỗi hệ thống';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Log error details
  if (isDevelopment) {
    console.error('Stack:', err.stack);
  }
  
  // Send error response
  // Lưu ý: req.headers.accept có thể không tồn tại (curl, một số client),
  // nên phải bọc || '' trước khi gọi indexOf.
  if (req.xhr || (req.headers.accept || '').indexOf('json') > -1 || req.path.includes('/api/')) {
    return res.status(status).json({
      error: true,
      message: message,
      ...(isDevelopment && { stack: err.stack })
    });
  }
  
  res.status(status).render('error', {
    title: `Lỗi ${status}`,
    message: message,
    statusCode: status,
    isDevelopment
  });
};

/**
 * 404 handler - must be last
 */
const notFoundHandler = (req, res) => {
  res.status(404).render('error', {
    title: 'Lỗi 404: Không tìm thấy',
    message: 'Trang bạn đang tìm kiếm không tồn tại.',
    statusCode: 404
  });
};

/**
 * Async route handler wrapper
 * Catches errors from async functions and passes to error handler
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Validation error middleware
 */
const handleValidationErrors = (err, req, res, next) => {
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: true,
      message: 'Dữ liệu nhập vào không hợp lệ',
      details: err.details
    });
  }
  next(err);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  handleValidationErrors
};
