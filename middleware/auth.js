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

/**
 * Bat khach dang nhap TRUOC khi bat dau dat ban / dat tiec / giao hang.
 * Trang (GET) -> /login, luu duong dan de dang nhap xong quay lai dung trang.
 * API -> 401 JSON (form tren trang tu chuyen sang dang nhap).
 */
const LY_DO_DANG_NHAP = [
  [/^\/dat-tiec/, 'Vui lòng đăng nhập để đặt tiệc.'],
  [/^\/dat-ban/, 'Vui lòng đăng nhập để đặt bàn.'],
  [/^\/(cart|giao-hang)/, 'Vui lòng đăng nhập để đặt món giao tận nơi.'],
];
const duongTiepHopLe = (u) => (typeof u === 'string' && /^\/(?![\/\\])/.test(u) && !/^\/(login|register|logout)\b/.test(u) ? u.slice(0, 300) : '');
const lyDoDangNhap = (u) => ((LY_DO_DANG_NHAP.find(([re]) => re.test(u || '')) || [])[1] || 'Vui lòng đăng nhập để tiếp tục.');
const canKhachDangNhap = (req, res, next) => {
  if (req.session && req.session.userlogin) return next();
  const laApi = req.method !== 'GET' || req.originalUrl.startsWith('/api/');
  // API: quay lai trang dang dung (Referer cung may chu), khong phai duong API.
  let tiep = req.originalUrl;
  if (laApi) {
    try { const r = new URL(req.get('referer') || '', `${req.protocol}://${req.get('host')}`); tiep = r.host === req.get('host') ? r.pathname + r.search : ''; } catch (_) { tiep = ''; }
  }
  tiep = duongTiepHopLe(tiep);
  if (req.session) req.session.tiepSauDangNhap = tiep || null;
  const dangNhap = '/login' + (tiep ? '?tiep=' + encodeURIComponent(tiep) : '');
  if (laApi) return res.status(401).json({ ok: false, can_dang_nhap: true, thong_bao: lyDoDangNhap(tiep), dang_nhap: dangNhap });
  return res.redirect(dangNhap);
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
  canKhachDangNhap,
  duongTiepHopLe,
  lyDoDangNhap,
  
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
