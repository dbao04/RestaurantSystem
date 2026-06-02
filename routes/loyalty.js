/**
 * ROUTES: Loyalty & Discount Features
 * For customers to view loyalty points and apply discount codes
 */

const express = require('express');
const router = express.Router();
const { requireCustomerLogin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const loyaltyService = require('../services/loyaltyService');
const discountService = require('../services/discountService');
const auditService = require('../services/auditService');

/**
 * GET: Loyalty Points Dashboard
 */
router.get('/loyalty', requireCustomerLogin, asyncHandler(async (req, res) => {
  const loyalty = await loyaltyService.getLoyaltyInfo(req.session.userId);
  const transactions = await loyaltyService.getTransactions(req.session.userId, 20);
  const benefits = loyaltyService.getTierBenefits(loyalty.tier);
  
  res.render('loyalty-dashboard', {
    title: 'Điểm Tích Lũy',
    loyalty,
    transactions,
    benefits
  });
}));

/**
 * GET: Available Discounts
 */
router.get('/discounts', requireCustomerLogin, asyncHandler(async (req, res) => {
  const discounts = await discountService.getActiveDiscounts();
  
  res.render('available-discounts', {
    title: 'Mã Giảm Giá',
    discounts
  });
}));

/**
 * POST: Validate Discount Code
 */
router.post('/discount/validate', requireCustomerLogin, asyncHandler(async (req, res) => {
  const { code, orderValue } = req.body;
  const result = await discountService.applyCode(code, orderValue);
  
  res.json(result);
}));

/**
 * POST: Apply Discount to Cart
 */
router.post('/discount/apply', requireCustomerLogin, asyncHandler(async (req, res) => {
  const { code, orderValue } = req.body;
  
  try {
    const result = await discountService.applyCode(code, orderValue);
    
    if (result.success) {
      // Store in session for order processing
      req.session.appliedDiscount = {
        code: result.code,
        amount: result.discount_amount,
        final_value: result.final_value
      };
      
      // Log discount application
      await auditService.log({
        action: 'apply_discount',
        actor_type: 'customer',
        actor_id: req.session.userId,
        actor_name: req.session.username,
        details: { code, discount_amount: result.discount_amount },
        status: 'success',
        ip_address: req.ip
      });
      
      return res.json({
        success: true,
        discount_amount: result.discount_amount,
        final_value: result.final_value
      });
    }
    
    res.json(result);
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
}));

/**
 * POST: Redeem Loyalty Points
 */
router.post('/loyalty/redeem', requireCustomerLogin, asyncHandler(async (req, res) => {
  const { points } = req.body;
  
  try {
    if (!points || points <= 0) {
      return res.json({ success: false, message: 'Số điểm không hợp lệ' });
    }
    
    await loyaltyService.redeemPoints(req.session.userId, points, 'Sử dụng tại đơn hàng');
    
    // Store in session
    req.session.loyaltyPointsUsed = points;
    
    // Log redemption
    await auditService.log({
      action: 'redeem_points',
      actor_type: 'customer',
      actor_id: req.session.userId,
      actor_name: req.session.username,
      details: { points },
      status: 'success',
      ip_address: req.ip
    });
    
    res.json({
      success: true,
      message: 'Sử dụng điểm thành công',
      remaining_points: (await loyaltyService.getLoyaltyInfo(req.session.userId)).points
    });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
}));

/**
 * GET: Loyalty History
 */
router.get('/loyalty/history', requireCustomerLogin, asyncHandler(async (req, res) => {
  const transactions = await loyaltyService.getTransactions(req.session.userId, 100);
  const loyalty = await loyaltyService.getLoyaltyInfo(req.session.userId);
  
  res.render('loyalty-history', {
    title: 'Lịch Sử Điểm',
    transactions,
    loyalty
  });
}));

module.exports = router;
