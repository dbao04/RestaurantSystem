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
  },

  /* ====================================================================== */
  /* QUAN TRI THANH VIEN                                                    */
  /* ====================================================================== */

  /** Nguong chi tieu de len hang - phai khop updateTier() o tren. */
  NGUONG_HANG: { bronze: 0, silver: 2000000, gold: 5000000, platinum: 10000000 },
  TEN_HANG: { bronze: 'Đồng', silver: 'Bạc', gold: 'Vàng', platinum: 'Bạch kim' },

  /**
   * Danh sach thanh vien cho trang quan tri.
   *
   * LEFT JOIN chu khong INNER: khach chi co ban ghi trong `loyalty_points` sau
   * lan thanh toan dau tien, nen JOIN thuong se lam bien mat phan lon khach
   * moi tao. Khach chua co vi diem duoc coi la hang Dong / 0 diem.
   *
   * @param {object} loc
   *   - tuKhoa   tim theo ten / dien thoai / email
   *   - hang     loc theo hang thanh vien
   *   - keCaVangLai  co tinh ca khach QR khong (mac dinh: khong)
   */
  danhSachThanhVien: async (loc = {}) => {
    const dieuKien = [];
    const thamSo = [];

    // Khach vang lai quet QR duoc sinh tu dong voi sodienthoai 'QR_xxx' - do
    // khong phai thanh vien that, de lan vao se lam nhieu moi con so.
    if (!loc.keCaVangLai) dieuKien.push("(k.sodienthoai IS NULL OR k.sodienthoai NOT LIKE 'QR_%')");

    if (loc.tuKhoa) {
      dieuKien.push('(k.ten LIKE ? OR k.sodienthoai LIKE ? OR k.email LIKE ?)');
      const t = '%' + loc.tuKhoa + '%';
      thamSo.push(t, t, t);
    }
    if (loc.hang) {
      dieuKien.push(loc.hang === 'bronze'
        ? "COALESCE(lp.tier, 'bronze') = 'bronze'"
        : 'lp.tier = ?');
      if (loc.hang !== 'bronze') thamSo.push(loc.hang);
    }

    const [rows] = await db.query(
      `SELECT k.id, k.ten, k.sodienthoai, k.email, k.solandat,
              COALESCE(lp.points, 0)        AS points,
              COALESCE(lp.tier, 'bronze')   AS tier,
              COALESCE(lp.total_spent, 0)   AS total_spent,
              COALESCE(lp.redeemed_points, 0) AS redeemed_points,
              lp.updated_at                 AS lan_cuoi,
              (SELECT COUNT(*) FROM discount_usages u WHERE u.id_kh = k.id) AS so_ma_da_dung
       FROM khach_hang k
       LEFT JOIN loyalty_points lp ON lp.id_kh = k.id
       ${dieuKien.length ? 'WHERE ' + dieuKien.join(' AND ') : ''}
       ORDER BY COALESCE(lp.total_spent, 0) DESC, k.id DESC`,
      thamSo
    );
    return rows;
  },

  /** So luong + chi tieu theo tung hang, da bo khach vang lai. */
  thongKeHang: async () => {
    const [rows] = await db.query(
      `SELECT COALESCE(lp.tier, 'bronze') AS tier,
              COUNT(*)                          AS so_khach,
              COALESCE(SUM(lp.total_spent), 0)  AS tong_chi,
              COALESCE(SUM(lp.points), 0)       AS tong_diem
       FROM khach_hang k
       LEFT JOIN loyalty_points lp ON lp.id_kh = k.id
       WHERE k.sodienthoai IS NULL OR k.sodienthoai NOT LIKE 'QR_%'
       GROUP BY COALESCE(lp.tier, 'bronze')`
    );

    // Tra ve du 4 hang ke ca hang chua co ai, de o giao dien khong bi nhay cot.
    const theoHang = {};
    ['bronze', 'silver', 'gold', 'platinum'].forEach((h) => {
      const r = rows.find((x) => x.tier === h);
      theoHang[h] = {
        so_khach: r ? Number(r.so_khach) : 0,
        tong_chi: r ? Number(r.tong_chi) : 0,
        tong_diem: r ? Number(r.tong_diem) : 0,
      };
    });

    const [[vangLai]] = await db.query(
      "SELECT COUNT(*) AS n FROM khach_hang WHERE sodienthoai LIKE 'QR_%'"
    );
    return { theoHang, vangLai: Number(vangLai.n || 0) };
  },

  /** Ho so mot thanh vien: diem, lich su diem, lich su dung ma. */
  chiTietThanhVien: async (id) => {
    const [[kh]] = await db.query(
      `SELECT k.id, k.ten, k.sodienthoai, k.email, k.diachi, k.solandat,
              COALESCE(lp.points, 0)          AS points,
              COALESCE(lp.tier, 'bronze')     AS tier,
              COALESCE(lp.total_spent, 0)     AS total_spent,
              COALESCE(lp.redeemed_points, 0) AS redeemed_points
       FROM khach_hang k
       LEFT JOIN loyalty_points lp ON lp.id_kh = k.id
       WHERE k.id = ? LIMIT 1`,
      [id]
    );
    if (!kh) return null;

    const [giaoDichDiem] = await db.query(
      'SELECT * FROM loyalty_transactions WHERE id_kh = ? ORDER BY id DESC LIMIT 30',
      [id]
    );
    const [maDaDung] = await db.query(
      `SELECT u.*, d.ten AS ten_chuong_trinh
       FROM discount_usages u
       LEFT JOIN discount_codes d ON d.id = u.discount_id
       WHERE u.id_kh = ? ORDER BY u.id DESC LIMIT 30`,
      [id]
    );
    return { kh, giaoDichDiem, maDaDung };
  }
};

module.exports = loyaltyService;
