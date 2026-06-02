/**
 * DISCOUNT & PAYMENT SERVICE
 * Manages discounts, payment methods, and payment processing
 */

const db = require('../config/db');

// ============ DISCOUNT SERVICE ============
const discountService = {
  /**
   * Validate discount code
   */
  validateCode: async (code, orderValue = 0) => {
    try {
      const [rows] = await db.query(
        `SELECT * FROM discount_codes 
        WHERE code = ? AND is_active = 1 
        AND valid_from <= NOW() AND valid_until >= NOW() 
        LIMIT 1`,
        [code.toUpperCase()]
      );
      
      if (rows.length === 0) {
        return { valid: false, message: 'Mã giảm giá không tồn tại hoặc hết hạn' };
      }
      
      const discount = rows[0];
      
      // Check usage
      if (discount.max_usage && discount.current_usage >= discount.max_usage) {
        return { valid: false, message: 'Mã giảm giá đã hết lượt sử dụng' };
      }
      
      // Check min order value
      if (discount.min_order_value && orderValue < discount.min_order_value) {
        return {
          valid: false,
          message: `Đơn hàng tối thiểu ${discount.min_order_value?.toLocaleString('vi-VN')} ₫`
        };
      }
      
      return { valid: true, discount };
    } catch (err) {
      console.error('Error validating discount code:', err);
      return { valid: false, message: 'Lỗi kiểm tra mã giảm giá' };
    }
  },
  
  /**
   * Calculate discount amount
   */
  calculateDiscount: (discount, orderValue) => {
    let discountAmount = 0;
    
    if (discount.discount_type === 'percentage') {
      discountAmount = (orderValue * discount.discount_value) / 100;
    } else {
      discountAmount = discount.discount_value;
    }
    
    // Apply max discount cap if exists
    if (discount.max_discount_amount && discountAmount > discount.max_discount_amount) {
      discountAmount = discount.max_discount_amount;
    }
    
    return Math.min(discountAmount, orderValue); // Don't discount more than order value
  },
  
  /**
   * Apply discount code
   */
  applyCode: async (code, orderValue) => {
    const validation = await discountService.validateCode(code, orderValue);
    
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }
    
    const discount = validation.discount;
    const discountAmount = discountService.calculateDiscount(discount, orderValue);
    
    return {
      success: true,
      code: discount.code,
      discount_type: discount.discount_type,
      discount_value: discount.discount_value,
      discount_amount: discountAmount,
      final_value: orderValue - discountAmount
    };
  },
  
  /**
   * Use discount code (increment usage count)
   */
  useCode: async (code) => {
    try {
      await db.query(
        'UPDATE discount_codes SET current_usage = current_usage + 1 WHERE code = ?',
        [code.toUpperCase()]
      );
      return true;
    } catch (err) {
      console.error('Error using discount code:', err);
      return false;
    }
  },
  
  /**
   * Create discount code (Admin)
   */
  createCode: async (data) => {
    const {
      code,
      description,
      discount_type,
      discount_value,
      max_usage,
      valid_from,
      valid_until,
      min_order_value,
      max_discount_amount,
      created_by
    } = data;
    
    try {
      // Check if code already exists
      const [existing] = await db.query(
        'SELECT id FROM discount_codes WHERE code = ?',
        [code.toUpperCase()]
      );
      
      if (existing.length > 0) {
        throw new Error('Mã giảm giá này đã tồn tại');
      }
      
      await db.query(
        `INSERT INTO discount_codes (
          code, description, discount_type, discount_value,
          max_usage, valid_from, valid_until, min_order_value,
          max_discount_amount, created_by, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          code.toUpperCase(),
          description,
          discount_type,
          discount_value,
          max_usage || null,
          valid_from,
          valid_until,
          min_order_value || null,
          max_discount_amount || null,
          created_by
        ]
      );
      
      return { success: true };
    } catch (err) {
      console.error('Error creating discount code:', err);
      throw err;
    }
  },
  
  /**
   * Get all active discount codes
   */
  getActiveDiscounts: async () => {
    try {
      const [rows] = await db.query(
        `SELECT * FROM discount_codes 
        WHERE is_active = 1 
        AND valid_from <= NOW() 
        AND valid_until >= NOW() 
        ORDER BY created_at DESC`
      );
      return rows;
    } catch (err) {
      console.error('Error getting active discounts:', err);
      return [];
    }
  }
};

// ============ PAYMENT SERVICE ============
const paymentService = {
  /**
   * Get all payment methods
   */
  getPaymentMethods: async () => {
    try {
      const [rows] = await db.query(
        'SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY id'
      );
      return rows;
    } catch (err) {
      console.error('Error getting payment methods:', err);
      return [];
    }
  },
  
  /**
   * Create payment record
   */
  createPayment: async (data) => {
    const {
      sesis,
      amount,
      payment_method_id,
      discount_code_used,
      discount_amount,
      loyalty_points_used,
      notes,
      processed_by
    } = data;
    
    try {
      const [result] = await db.query(
        `INSERT INTO payments (
          sesis, amount, payment_method_id, status,
          discount_code_used, discount_amount, loyalty_points_used,
          notes, processed_by
        ) VALUES (?, ?, ?, 'success', ?, ?, ?, ?, ?)`,
        [
          sesis,
          amount,
          payment_method_id,
          discount_code_used,
          discount_amount,
          loyalty_points_used,
          notes,
          processed_by
        ]
      );
      
      return result;
    } catch (err) {
      console.error('Error creating payment:', err);
      throw err;
    }
  },
  
  /**
   * Get payment by ID
   */
  getPayment: async (paymentId) => {
    try {
      const [rows] = await db.query(
        'SELECT * FROM payments WHERE id = ?',
        [paymentId]
      );
      return rows[0] || null;
    } catch (err) {
      console.error('Error getting payment:', err);
      return null;
    }
  },
  
  /**
   * Get payments by booking
   */
  getPaymentsByBooking: async (sesis) => {
    try {
      const [rows] = await db.query(
        'SELECT * FROM payments WHERE sesis = ? ORDER BY created_at DESC',
        [sesis]
      );
      return rows;
    } catch (err) {
      console.error('Error getting payments:', err);
      return [];
    }
  },
  
  /**
   * Refund payment
   */
  refundPayment: async (paymentId, reason = '') => {
    try {
      await db.query(
        `UPDATE payments 
        SET status = 'refunded', notes = CONCAT(COALESCE(notes, ''), '\nRefund reason: ', ?) 
        WHERE id = ?`,
        [reason, paymentId]
      );
      return true;
    } catch (err) {
      console.error('Error refunding payment:', err);
      throw err;
    }
  }
};

module.exports = {
  discountService,
  paymentService
};
