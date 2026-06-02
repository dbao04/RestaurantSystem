/**
 * LOYALTY POINTS SERVICE
 * Manages customer loyalty points and rewards
 */

const db = require('../config/db');

const loyaltyService = {
  /**
   * Initialize loyalty account for customer
   */
  createLoyaltyAccount: async (id_kh) => {
    try {
      const [existing] = await db.query(
        'SELECT id FROM loyalty_points WHERE id_kh = ?',
        [id_kh]
      );
      
      if (existing.length > 0) return existing[0];
      
      const [result] = await db.query(
        'INSERT INTO loyalty_points (id_kh, points, tier, total_spent) VALUES (?, 0, "bronze", 0)',
        [id_kh]
      );
      
      return result;
    } catch (err) {
      console.error('Error creating loyalty account:', err);
      throw err;
    }
  },
  
  /**
   * Add points to customer
   */
  addPoints: async (id_kh, points, description = '', sesis = null) => {
    try {
      // Check if loyalty account exists
      const [existing] = await db.query(
        'SELECT id, points FROM loyalty_points WHERE id_kh = ?',
        [id_kh]
      );
      
      if (existing.length === 0) {
        await loyaltyService.createLoyaltyAccount(id_kh);
      }
      
      // Add points
      await db.query(
        'UPDATE loyalty_points SET points = points + ? WHERE id_kh = ?',
        [points, id_kh]
      );
      
      // Log transaction
      await db.query(
        `INSERT INTO loyalty_transactions 
        (id_kh, type, points, description, sesis) 
        VALUES (?, 'earn', ?, ?, ?)`,
        [id_kh, points, description, sesis]
      );
      
      // Update tier
      await loyaltyService.updateTier(id_kh);
      
      return true;
    } catch (err) {
      console.error('Error adding points:', err);
      throw err;
    }
  },
  
  /**
   * Redeem points
   */
  redeemPoints: async (id_kh, points, description = '', sesis = null) => {
    try {
      const [loyalty] = await db.query(
        'SELECT points FROM loyalty_points WHERE id_kh = ?',
        [id_kh]
      );
      
      if (loyalty.length === 0 || loyalty[0].points < points) {
        throw new Error('Không đủ điểm tích lũy để sử dụng');
      }
      
      // Redeem points
      await db.query(
        `UPDATE loyalty_points 
        SET points = points - ?, redeemed_points = redeemed_points + ? 
        WHERE id_kh = ?`,
        [points, points, id_kh]
      );
      
      // Log transaction
      await db.query(
        `INSERT INTO loyalty_transactions 
        (id_kh, type, points, description, sesis) 
        VALUES (?, 'redeem', ?, ?, ?)`,
        [id_kh, -points, description, sesis]
      );
      
      return true;
    } catch (err) {
      console.error('Error redeeming points:', err);
      throw err;
    }
  },
  
  /**
   * Update customer tier based on spending
   */
  updateTier: async (id_kh) => {
    try {
      const [loyalty] = await db.query(
        'SELECT total_spent FROM loyalty_points WHERE id_kh = ?',
        [id_kh]
      );
      
      if (loyalty.length === 0) return;
      
      const spent = loyalty[0].total_spent;
      let newTier = 'bronze';
      
      if (spent >= 10000000) newTier = 'platinum'; // 10 triệu
      else if (spent >= 5000000) newTier = 'gold';  // 5 triệu
      else if (spent >= 2000000) newTier = 'silver'; // 2 triệu
      
      await db.query(
        'UPDATE loyalty_points SET tier = ? WHERE id_kh = ?',
        [newTier, id_kh]
      );
      
      return newTier;
    } catch (err) {
      console.error('Error updating tier:', err);
    }
  },
  
  /**
   * Get loyalty info
   */
  getLoyaltyInfo: async (id_kh) => {
    try {
      const [loyalty] = await db.query(
        `SELECT * FROM loyalty_points WHERE id_kh = ?`,
        [id_kh]
      );
      
      if (loyalty.length === 0) {
        await loyaltyService.createLoyaltyAccount(id_kh);
        return await loyaltyService.getLoyaltyInfo(id_kh);
      }
      
      return loyalty[0];
    } catch (err) {
      console.error('Error getting loyalty info:', err);
      throw err;
    }
  },
  
  /**
   * Get loyalty transactions
   */
  getTransactions: async (id_kh, limit = 20) => {
    try {
      const [rows] = await db.query(
        `SELECT * FROM loyalty_transactions 
        WHERE id_kh = ? 
        ORDER BY created_at DESC 
        LIMIT ?`,
        [id_kh, limit]
      );
      
      return rows;
    } catch (err) {
      console.error('Error getting transactions:', err);
      return [];
    }
  },
  
  /**
   * Get tier benefits
   */
  getTierBenefits: (tier) => {
    const benefits = {
      bronze: { name: 'Đồng', pointsPerSpent: 1, discount: 0 },
      silver: { name: 'Bạc', pointsPerSpent: 1.5, discount: 2 },
      gold: { name: 'Vàng', pointsPerSpent: 2, discount: 5 },
      platinum: { name: 'Bạch kim', pointsPerSpent: 3, discount: 10 }
    };
    return benefits[tier] || benefits.bronze;
  }
};

module.exports = loyaltyService;
