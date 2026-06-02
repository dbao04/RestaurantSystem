/**
 * VALIDATION UTILITIES
 */

/**
 * Validate phone number (Vietnamese format)
 */
const validatePhone = (phone) => {
  return /^(0[1-9][0-9]{8,9}|84[1-9][0-9]{7,8})$/.test(phone.replace(/\s+/g, ''));
};

/**
 * Validate email
 */
const validateEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Validate password strength
 */
const validatePassword = (password) => {
  if (password.length < 6) return { valid: false, message: 'Mật khẩu phải có ít nhất 6 ký tự' };
  if (!/[a-zA-Z]/.test(password)) return { valid: false, message: 'Mật khẩu phải chứa chữ cái' };
  if (!/[0-9]/.test(password)) return { valid: false, message: 'Mật khẩu phải chứa số' };
  return { valid: true };
};

/**
 * Validate required fields
 */
const validateRequired = (data, fields) => {
  const missing = fields.filter(f => !data[f] || (typeof data[f] === 'string' && !data[f].trim()));
  if (missing.length > 0) {
    return { valid: false, message: `Các trường bắt buộc: ${missing.join(', ')}` };
  }
  return { valid: true };
};

/**
 * Validate date format (YYYY-MM-DD)
 */
const validateDate = (date) => {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(new Date(date).getTime());
};

/**
 * Validate date range
 */
const validateDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, message: 'Định dạng ngày không hợp lệ' };
  }
  
  if (end < start) {
    return { valid: false, message: 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu' };
  }
  
  return { valid: true };
};

/**
 * Validate positive number
 */
const validatePositiveNumber = (num) => {
  return !isNaN(num) && Number(num) > 0;
};

/**
 * Validate booking details
 */
const validateBooking = (data) => {
  const errors = [];
  
  if (!data.timebook) errors.push('Thời gian đặt bàn không được để trống');
  if (!data.datebook) errors.push('Ngày đặt bàn không được để trống');
  if (!data.khach || !validatePositiveNumber(data.khach)) errors.push('Số khách phải lớn hơn 0');
  
  return {
    valid: errors.length === 0,
    message: errors.join('; '),
    errors
  };
};

/**
 * Sanitize string input (prevent XSS)
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Validate and sanitize form data
 */
const validateAndSanitize = (data, schema) => {
  const errors = {};
  const sanitized = {};
  
  Object.keys(schema).forEach(field => {
    const rules = schema[field];
    const value = data[field];
    
    // Check required
    if (rules.required && (!value || (typeof value === 'string' && !value.trim()))) {
      errors[field] = `${rules.label || field} không được để trống`;
      return;
    }
    
    // Check type
    if (value && rules.type) {
      if (rules.type === 'email' && !validateEmail(value)) {
        errors[field] = 'Email không hợp lệ';
      }
      if (rules.type === 'phone' && !validatePhone(value)) {
        errors[field] = 'Số điện thoại không hợp lệ';
      }
      if (rules.type === 'number' && isNaN(value)) {
        errors[field] = `${rules.label || field} phải là số`;
      }
    }
    
    // Check length
    if (value && rules.minLength && value.length < rules.minLength) {
      errors[field] = `${rules.label || field} phải có ít nhất ${rules.minLength} ký tự`;
    }
    if (value && rules.maxLength && value.length > rules.maxLength) {
      errors[field] = `${rules.label || field} không được vượt quá ${rules.maxLength} ký tự`;
    }
    
    // Sanitize
    sanitized[field] = typeof value === 'string' ? sanitizeString(value) : value;
  });
  
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: sanitized
  };
};

module.exports = {
  validatePhone,
  validateEmail,
  validatePassword,
  validateRequired,
  validateDate,
  validateDateRange,
  validatePositiveNumber,
  validateBooking,
  sanitizeString,
  validateAndSanitize
};
