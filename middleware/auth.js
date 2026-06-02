/**
 * MIDDLEWARE: Authentication & Authorization (IMPROVED)
 * Provides comprehensive auth checks for customer, admin, and staff
 */

// ============ CUSTOMER MIDDLEWARE ============
const requireCustomerLogin = (req, res, next) => {
  if (!req.session.userlogin) {
    return res.redirect('/login');
  }
  next();
};

const requireCustomerNotLogin = (req, res, next) => {
  if (req.session.userlogin) {
    return res.redirect('/');
  }
  next();
};

// ============ ADMIN MIDDLEWARE ============
const requireAdminLogin = (req, res, next) => {
  if (!req.session.adminlogin) {
    return res.redirect('/admin/login');
  }
  next();
};

const requireAdminNotLogin = (req, res, next) => {
  if (req.session.adminlogin) {
    return res.redirect('/admin');
  }
  next();
};

// ============ STAFF MIDDLEWARE ============
const requireStaffLogin = (req, res, next) => {
  if (!req.session.stafflogin) {
    return res.redirect('/staff/login');
  }
  next();
};

const requireStaffNotLogin = (req, res, next) => {
  if (req.session.stafflogin) {
    return res.redirect('/staff');
  }
  next();
};

/**
 * Role-based access control for staff
 * @param {string|string[]} allowedRoles - Single role or array of roles
 */
const requireStaffRole = (allowedRoles) => {
  // Normalize to array
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req, res, next) => {
    if (!req.session.stafflogin) {
      return res.redirect('/staff/login');
    }
    
    if (!roles.includes(req.session.staffRole)) {
      return res.status(403).render('error', {
        title: 'Lỗi 403: Truy cập bị từ chối',
        message: 'Bạn không có quyền truy cập chức năng này. Vai trò của bạn là: ' + req.session.staffRole,
        statusCode: 403
      });
    }
    
    next();
  };
};

/**
 * Multiple roles allowed + additional permission check
 */
const requireStaffRoles = (roles) => {
  return requireStaffRole(roles);
};

/**
 * Permission-based middleware
 * Can combine role + specific resource checks
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.session.stafflogin) {
      return res.redirect('/staff/login');
    }
    
    const PERMISSIONS = {
      'view_bookings': ['Phuc vu', 'Ke toan', 'Quay'],
      'manage_kitchen': ['Bep', 'Quay'],
      'manage_inventory': ['Bep'],
      'manage_finances': ['Ke toan'],
      'manage_staff': ['Ke toan'],
      'manage_menu': ['Bep'],
      'view_reports': ['Ke toan'],
      'manage_all': ['admin'] // For future admin staff role
    };
    
    const allowedRoles = PERMISSIONS[permission] || [];
    
    if (!allowedRoles.includes(req.session.staffRole)) {
      return res.status(403).render('error', {
        title: 'Lỗi 403: Truy cập bị từ chối',
        message: `Bạn không có quyền: ${permission}`,
        statusCode: 403
      });
    }
    
    next();
  };
};

/**
 * Audit middleware - logs sensitive operations
 */
const auditLog = (action) => {
  return async (req, res, next) => {
    // Store action in response locals for later logging
    res.locals.auditAction = action;
    res.locals.auditActor = {
      type: req.session.userlogin ? 'customer' : (req.session.stafflogin ? 'staff' : (req.session.adminlogin ? 'admin' : 'guest')),
      id: req.session.userId || req.session.staffId || req.session.idadmin || null,
      name: req.session.username || req.session.staffName || req.session.adminname || 'Anonymous'
    };
    res.locals.auditTimestamp = new Date();
    next();
  };
};

/**
 * Rate limiting middleware for sensitive operations
 */
const rateLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();
  
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    
    if (!attempts.has(key)) {
      attempts.set(key, []);
    }
    
    const userAttempts = attempts.get(key).filter(t => now - t < windowMs);
    
    if (userAttempts.length >= maxAttempts) {
      return res.status(429).json({
        error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.',
        retryAfter: Math.ceil((userAttempts[0] + windowMs - now) / 1000)
      });
    }
    
    userAttempts.push(now);
    attempts.set(key, userAttempts);
    next();
  };
};

module.exports = {
  // Customer
  requireCustomerLogin,
  requireCustomerNotLogin,
  
  // Admin
  requireAdminLogin,
  requireAdminNotLogin,
  
  // Staff
  requireStaffLogin,
  requireStaffNotLogin,
  requireStaffRole,
  requireStaffRoles,
  requirePermission,
  
  // Audit & Security
  auditLog,
  rateLimit
};
