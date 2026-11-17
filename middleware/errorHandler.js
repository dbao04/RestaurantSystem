/**
 * MIDDLEWARE: Error Handler & Utilities
 */
const fs = require('fs');
const path = require('path');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('ERROR:', err);
  
  const status = err.status || err.statusCode || 500;
  const message = (err && err.message) || (typeof err === 'string' ? err : 'Đã xảy ra lỗi hệ thống');
  const isDevelopment = process.env.NODE_ENV === 'development';
  const stack = err && err.stack ? err.stack : String(err);
  
  // Log error details
  if (isDevelopment) {
    console.error('Stack:', stack);
  }

  try {
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logLine = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl || req.url}\nStatus: ${status} - Message: ${message}\nStack: ${stack}\n\n`;
    fs.appendFileSync(path.join(logDir, 'error.log'), logLine, 'utf8');
  } catch (logErr) {}
  
  // Send error response
  // Lưu ý: req.headers.accept có thể không tồn tại (curl, một số client),
  // nên phải bọc || '' trước khi gọi indexOf.
  if (req.xhr || (req.headers.accept || '').indexOf('json') > -1 || req.path.includes('/api/')) {
    return res.status(status).json({
      error: true,
      message: message,
      ...(isDevelopment && { stack: stack })
    });
  }
  
  res.status(status).render('error', {
    title: `Lỗi ${status}`,
    message: message,
    statusCode: status,
    isDevelopment,
    stack: isDevelopment ? stack : null,
    hoSo: res.locals.hoSo || req.hoSo || null
  });
};

/**
 * 404 handler - must be last
 */
const notFoundHandler = (req, res) => {
  res.status(404).render('error', {
    title: 'Lỗi 404: Không tìm thấy',
    message: 'Trang bạn đang tìm kiếm không tồn tại.',
    statusCode: 404,
    hoSo: res.locals.hoSo || req.hoSo || null
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
