/**
 * ROUTES: Admin - Discount & Loyalty Management
 */

const express = require('express');
const router = express.Router();
const { requireAdminLogin, auditLog } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { discountService } = require('../services/discountService');
const loyaltyService = require('../services/loyaltyService');
const auditService = require('../services/auditService');

/**
 * DISCOUNT CODES MANAGEMENT
 */

router.get('/discounts', requireAdminLogin, asyncHandler(async (req, res) => {
  const [discounts] = await require('../config/db').query(
    'SELECT * FROM discount_codes ORDER BY created_at DESC'
  );
  
  res.render('admin/discounts-list', {
    title: 'Quản lý Mã Giảm Giá',
    discounts
  });
}));

router.get('/discounts/add', requireAdminLogin, (req, res) => {
  res.render('admin/discount-add', {
    title: 'Thêm Mã Giảm Giá'
  });
});

router.post('/discounts/add', requireAdminLogin, auditLog('create_discount'), asyncHandler(async (req, res) => {
  try {
    await discountService.createCode({
      ...req.body,
      created_by: req.session.idadmin
    });
    
    await auditService.log({
      action: 'create_discount',
      actor_type: 'admin',
      actor_id: req.session.idadmin,
      actor_name: req.session.adminname,
      details: req.body,
      status: 'success',
      ip_address: req.ip
    });
    
    res.redirect('/admin/discounts?msg=Thêm+mã+giảm+giá+thành+công');
  } catch (err) {
    res.render('admin/discount-add', {
      title: 'Thêm Mã Giảm Giá',
      error: err.message
    });
  }
}));

router.get('/discounts/:id', requireAdminLogin, asyncHandler(async (req, res) => {
  const [rows] = await require('../config/db').query(
    'SELECT * FROM discount_codes WHERE id = ?',
    [req.params.id]
  );
  
  if (rows.length === 0) {
    return res.redirect('/admin/discounts');
  }
  
  res.render('admin/discount-edit', {
    title: 'Sửa Mã Giảm Giá',
    discount: rows[0]
  });
}));

router.post('/discounts/:id', requireAdminLogin, asyncHandler(async (req, res) => {
  const db = require('../config/db');
  
  await db.query(
    `UPDATE discount_codes 
    SET description = ?, discount_value = ?, max_usage = ?, 
    valid_until = ?, min_order_value = ?, max_discount_amount = ?,
    is_active = ? 
    WHERE id = ?`,
    [
      req.body.description,
      req.body.discount_value,
      req.body.max_usage || null,
      req.body.valid_until,
      req.body.min_order_value || null,
      req.body.max_discount_amount || null,
      req.body.is_active ? 1 : 0,
      req.params.id
    ]
  );
  
  await auditService.log({
    action: 'update_discount',
    actor_type: 'admin',
    actor_id: req.session.idadmin,
    actor_name: req.session.adminname,
    resource_id: req.params.id,
    status: 'success',
    ip_address: req.ip
  });
  
  res.redirect('/admin/discounts?msg=Cập+nhật+mã+giảm+giá+thành+công');
}));

router.get('/discounts/:id/delete', requireAdminLogin, asyncHandler(async (req, res) => {
  const db = require('../config/db');
  
  await db.query('DELETE FROM discount_codes WHERE id = ?', [req.params.id]);
  
  await auditService.log({
    action: 'delete_discount',
    actor_type: 'admin',
    actor_id: req.session.idadmin,
    actor_name: req.session.adminname,
    resource_id: req.params.id,
    status: 'success',
    ip_address: req.ip
  });
  
  res.redirect('/admin/discounts');
}));

/**
 * LOYALTY MANAGEMENT
 */

router.get('/loyalty/stats', requireAdminLogin, asyncHandler(async (req, res) => {
  const db = require('../config/db');
  
  const [stats] = await db.query(`
    SELECT 
      tier,
      COUNT(*) as count,
      AVG(points) as avg_points,
      AVG(total_spent) as avg_spent
    FROM loyalty_points
    GROUP BY tier
    ORDER BY tier
  `);
  
  const [topCustomers] = await db.query(`
    SELECT kh.id, kh.ten, lp.points, lp.tier, lp.total_spent
    FROM loyalty_points lp
    JOIN khach_hang kh ON lp.id_kh = kh.id
    ORDER BY lp.total_spent DESC
    LIMIT 20
  `);
  
  res.render('admin/loyalty-stats', {
    title: 'Thống kê Tích Lũy Điểm',
    stats,
    topCustomers
  });
}));

/**
 * PAYMENT METHODS
 */

router.get('/payment-methods', requireAdminLogin, asyncHandler(async (req, res) => {
  const db = require('../config/db');
  const [methods] = await db.query('SELECT * FROM payment_methods ORDER BY id');
  
  res.render('admin/payment-methods', {
    title: 'Quản lý Phương Thức Thanh Toán',
    methods
  });
}));

router.post('/payment-methods/add', requireAdminLogin, asyncHandler(async (req, res) => {
  const db = require('../config/db');
  
  const { name, code, type } = req.body;
  
  await db.query(
    'INSERT INTO payment_methods (name, code, type, is_active) VALUES (?, ?, ?, 1)',
    [name, code.toUpperCase(), type]
  );
  
  await auditService.log({
    action: 'add_payment_method',
    actor_type: 'admin',
    actor_id: req.session.idadmin,
    actor_name: req.session.adminname,
    details: { name, code, type },
    status: 'success',
    ip_address: req.ip
  });
  
  res.redirect('/admin/payment-methods');
}));

module.exports = router;
