/**
 * ESSENTIAL SERVER.JS UPDATES
 * Add these lines to your existing server.js file
 * 
 * Place these imports near the top with other requires (around line 7-45)
 */

// ========== ADD THESE IMPORTS (After existing require statements) ==========

const authMiddleware = require('./middleware/auth');
const errorMiddleware = require('./middleware/errorHandler');
const { validateAndSanitize, validatePassword } = require('./utils/validation');
const auditService = require('./services/auditService');
const loyaltyService = require('./services/loyaltyService');
const generalStaffService = require('./services/generalStaffService');

// New route modules
const generalStaffRoutes = require('./routes/generalStaff');
const loyaltyRoutes = require('./routes/loyalty');
const adminLoyaltyRoutes = require('./routes/adminLoyalty');

// ========== REPLACE OLD AUTH MIDDLEWARE (Around line 115-150) ==========

// OLD CODE - REMOVE:
// const requireLogin = (req, res, next) => { ... }
// const requireAdmin = (req, res, next) => { ... }
// const requireStaff = (req, res, next) => { ... }
// const requireRole = (roles) => { ... }

// NEW CODE - REPLACE WITH:
const requireLogin = authMiddleware.requireCustomerLogin;
const requireAdmin = authMiddleware.requireAdminLogin;
const requireStaff = authMiddleware.requireStaffLogin;
const requireRole = authMiddleware.requireStaffRole;

// ========== ADD ERROR HANDLERS AFTER app.use(session(...)) - Around line 105 ==========

app.use(errorMiddleware.handleValidationErrors);

// ========== ADD NEW ROUTES (Before final error handlers, around line 2100+) ==========

// --- General Staff Routes ---
app.use('/staff/general', generalStaffRoutes);

// --- Customer Loyalty & Discount Routes ---
app.use('/customer', loyaltyRoutes);

// --- Admin Loyalty & Discount Routes ---
app.use('/admin', adminLoyaltyRoutes);

// ========== ADD GLOBAL ERROR HANDLERS (MUST BE LAST, before server.listen) ==========

// 404 Handler
app.use(errorMiddleware.notFoundHandler);

// Global Error Handler
app.use(errorMiddleware.errorHandler);

// ========== REPLACE STAFF PASSWORD CHANGE ENDPOINT ==========

// OLD: POST /staff/profile (check password change logic)
// UPDATE: Add validation using new middleware

// Find this section in your server.js:
// app.post('/staff/profile', requireStaff, async (req, res) => {

// Replace the password change section with:
app.post('/staff/profile-update', requireStaff, async (req, res) => {
  const { action, ten, sodienthoai, email, diachi, old_pass, new_pass, re_pass } = req.body;
  
  try {
    if (action === 'update') {
      const result = validateAndSanitize({ ten, email, diachi }, {
        ten: { required: true, minLength: 2 },
        email: { required: true, type: 'email' },
        diachi: { required: false }
      });
      
      if (!result.valid) {
        return res.render('staff/profile', {
          title: 'Thông tin cá nhân',
          staff: await personnelService.getStaffById(req.session.staffId),
          msg: Object.values(result.errors)[0],
          msgType: 'danger'
        });
      }
      
      await personnelService.updateStaffProfile(req.session.staffId, result.data);
      req.session.staffName = ten;
    } else if (action === 'password') {
      if (new_pass !== re_pass) {
        const staff = await personnelService.getStaffById(req.session.staffId);
        return res.render('staff/profile', {
          title: 'Thông tin cá nhân',
          staff,
          msg: 'Mật khẩu xác nhận không khớp!',
          msgType: 'danger'
        });
      }
      
      const passValidation = validatePassword(new_pass);
      if (!passValidation.valid) {
        return res.render('staff/profile', {
          title: 'Thông tin cá nhân',
          staff: await personnelService.getStaffById(req.session.staffId),
          msg: passValidation.message,
          msgType: 'danger'
        });
      }
      
      await personnelService.changeStaffPassword(req.session.staffId, old_pass, new_pass);
      
      // Log password change
      await auditService.log({
        action: 'change_password',
        actor_type: 'staff',
        actor_id: req.session.staffId,
        actor_name: req.session.staffName,
        status: 'success',
        ip_address: req.ip
      });
    }
    
    res.redirect('/staff/profile?msg=Cập+nhật+thành+công!&msgType=success');
  } catch (err) {
    res.redirect('/staff/profile?msg=' + encodeURIComponent(err.message) + '&msgType=danger');
  }
});

// ========== UPDATE ORDER CANCELLATION ROUTE ==========

// Replace existing POST /cancel-order with enhanced version:
app.post('/cancel-order', requireLogin, async (req, res) => {
  const { sesis } = req.body;
  try {
    // Verify ownership
    const [order] = await db.query(
      'SELECT id FROM hopdong WHERE sesis = ? AND user_id = ?',
      [sesis, req.session.userId]
    );
    
    if (order.length === 0) {
      throw new Error('Không tìm thấy đơn đặt bàn');
    }
    
    // Check if order can be cancelled
    const [details] = await db.query(
      'SELECT trangthai FROM hopdong WHERE sesis = ? LIMIT 1',
      [sesis]
    );
    
    if (details[0].trangthai === 2) {
      throw new Error('Đơn hàng này đã được hoàn thành');
    }
    
    // Create cancellation request
    await db.query(
      `INSERT INTO order_cancellations (sesis, id_kh, reason, status) 
      VALUES (?, ?, ?, 'pending')`,
      [sesis, req.session.userId, req.body.reason || 'Từ ứng dụng']
    );
    
    // Log cancellation request
    await auditService.log({
      action: 'request_cancel_order',
      actor_type: 'customer',
      actor_id: req.session.userId,
      actor_name: req.session.username,
      resource_id: sesis,
      status: 'success',
      ip_address: req.ip
    });
    
    res.redirect('/my-orders?msg=Yêu+cầu+hủy+đơn+đã+gửi+thành+công');
  } catch (err) {
    console.error(err);
    res.redirect('/my-orders?msg=' + encodeURIComponent(err.message));
  }
});

// ========== ADD LOYALTY TO ORDER CREATION ==========

// Find: await orderService.createOrderFromCart(...)
// After that line, add:
app.post('/datban', requireLogin, async (req, res) => {
  // ... existing code ...
  
  try {
    await orderService.createOrderFromCart(req.session.sessionID, req.session.userId, timebook, datebook, khach, noidung);
    
    // Add loyalty points (1 point per 1000 VND)
    const cartTotal = await orderService.getCartTotal(req.sessionID);
    const points = Math.floor(cartTotal / 1000);
    if (points > 0) {
      await loyaltyService.addPoints(req.session.userId, points, 'Từ đơn hàng');
    }
    
    res.redirect('/contract');
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message || 'Server Error');
  }
});

// ========== ADD REGISTRATION VALIDATION ==========

// Find POST /register endpoint and update:
app.post('/register', async (req, res) => {
  const { ten, sodienthoai, email, diachi, passwords, repass } = req.body;
  
  // Add validation
  const validation = validateAndSanitize({ 
    ten, 
    sodienthoai, 
    email, 
    passwords, 
    repass 
  }, {
    ten: { required: true, minLength: 2, label: 'Họ tên' },
    sodienthoai: { required: true, type: 'phone', label: 'Số điện thoại' },
    email: { required: true, type: 'email' },
    passwords: { required: true, minLength: 6 },
    repass: { required: true }
  });
  
  if (!validation.valid) {
    return res.render('register', {
      title: 'Đăng ký',
      message: Object.values(validation.errors)[0]
    });
  }
  
  if (validation.data.passwords !== repass) {
    return res.render('register', {
      title: 'Đăng ký',
      message: 'Mật khẩu xác nhận không khớp!'
    });
  }
  
  try {
    const userId = await orderService.userRegister({
      ten: validation.data.ten,
      sodienthoai: validation.data.sodienthoai,
      email: validation.data.email,
      diachi,
      passwords: validation.data.passwords
    });
    
    // Initialize loyalty account
    await loyaltyService.createLoyaltyAccount(userId);
    
    // Log registration
    await auditService.log({
      action: 'customer_register',
      actor_type: 'customer',
      actor_name: validation.data.ten,
      status: 'success',
      ip_address: req.ip
    });
    
    res.render('login', {
      title: 'Đăng nhập',
      message: 'Đăng ký thành công! Vui lòng đăng nhập.'
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.render('register', {
      title: 'Đăng ký',
      message: err.message
    });
  }
});

// ========== END OF UPDATES ==========

/**
 * SUMMARY OF CHANGES:
 * 1. Added new middleware imports
 * 2. Replaced old auth middleware with new auth.js module
 * 3. Added error handling middleware
 * 4. Added new routes for general staff, loyalty, admin loyalty
 * 5. Enhanced password change validation
 * 6. Enhanced order cancellation
 * 7. Added loyalty points to order creation
 * 8. Enhanced registration validation
 * 
 * AFTER UPDATING:
 * - Run: node config/migrate.js
 * - Test all routes
 * - Check console for any errors
 */
