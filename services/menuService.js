/**
 * MENU SERVICE
 * Handles menu, categories, and dish management
 * Combines dishService and categoryService functionality
 */

const db = require('../config/db');

const menuService = {
  // ============ CATEGORY OPERATIONS ============
  getAllCategories: async () => {
    const [rows] = await db.query('SELECT * FROM loai_mon ORDER BY id_loai DESC');
    return rows;
  },

  getCategoryById: async (id) => {
    const [rows] = await db.query('SELECT * FROM loai_mon WHERE id_loai = ?', [id]);
    return rows[0] || null;
  },

  addCategory: async (name, note) => {
    await db.query('INSERT INTO loai_mon (name_loai, ghichu) VALUES (?, ?)', [name, note]);
  },

  updateCategory: async (id, name, note) => {
    await db.query('UPDATE loai_mon SET name_loai = ?, ghichu = ? WHERE id_loai = ?', [name, note, id]);
  },

  deleteCategory: async (id) => {
    await db.query('DELETE FROM loai_mon WHERE id_loai = ?', [id]);
  },

  // ============ DISH OPERATIONS ============
  getAllDishes: async () => {
    const [rows] = await db.query(`
      SELECT m.*, l.name_loai 
      FROM monan m 
      LEFT JOIN loai_mon l ON m.id_loai = l.id_loai 
      ORDER BY m.id_mon DESC
    `);
    return rows;
  },

  getDishById: async (id) => {
    const [rows] = await db.query(`
      SELECT m.*, l.name_loai 
      FROM monan m 
      LEFT JOIN loai_mon l ON m.id_loai = l.id_loai 
      WHERE m.id_mon = ?
    `, [id]);
    return rows[0] || null;
  },

  getDishesByCategory: async (categoryId) => {
    const [rows] = await db.query(
      `SELECT m.*, l.name_loai 
       FROM monan m 
       LEFT JOIN loai_mon l ON m.id_loai = l.id_loai 
       WHERE m.id_loai = ? AND m.tinhtrang = 1`,
      [categoryId]
    );
    return rows;
  },

  searchDishes: async (key) => {
    const searchTerm = `%${(key || '').trim()}%`;
    const [rows] = await db.query(
      `SELECT m.*, l.name_loai 
       FROM monan m 
       LEFT JOIN loai_mon l ON m.id_loai = l.id_loai 
       WHERE (m.name_mon LIKE ? OR m.ghichu_mon LIKE ?) AND m.tinhtrang = 1`,
      [searchTerm, searchTerm]
    );
    return rows;
  },

  addDish: async (data) => {
    const { name_mon, id_loai, ghichu_mon, gia_mon, images } = data;
    await db.query(
      'INSERT INTO monan (name_mon, id_loai, ghichu_mon, gia_mon, images) VALUES (?, ?, ?, ?, ?)',
      [name_mon, id_loai, ghichu_mon, gia_mon, images]
    );
  },

  updateDish: async (id, data) => {
    const { name_mon, id_loai, ghichu_mon, gia_mon, images, tinhtrang } = data;
    const status = tinhtrang !== undefined ? tinhtrang : 1;
    if (images) {
      await db.query(
        'UPDATE monan SET name_mon = ?, id_loai = ?, ghichu_mon = ?, gia_mon = ?, images = ?, tinhtrang = ? WHERE id_mon = ?',
        [name_mon, id_loai, ghichu_mon, gia_mon, images, status, id]
      );
    } else {
      await db.query(
        'UPDATE monan SET name_mon = ?, id_loai = ?, ghichu_mon = ?, gia_mon = ?, tinhtrang = ? WHERE id_mon = ?',
        [name_mon, id_loai, ghichu_mon, gia_mon, status, id]
      );
    }
  },

  deleteDish: async (id) => {
    await db.query('DELETE FROM monan WHERE id_mon = ?', [id]);
  },

  getDishStats: async () => {
    const [rows] = await db.query(`
      SELECT 
        COUNT(*) as total_dishes,
        COUNT(CASE WHEN tinhtrang = 1 THEN 1 END) as active_dishes,
        AVG(CAST(gia_mon AS DECIMAL(10,2))) as avg_price,
        MAX(CAST(gia_mon AS DECIMAL(10,2))) as max_price,
        MIN(CAST(gia_mon AS DECIMAL(10,2))) as min_price
      FROM monan
    `);
    return rows[0] || null;
  },

  getTopDishes: async (limit = 10) => {
    const [rows] = await db.query(`
      SELECT m.id_mon, m.name_mon, m.gia_mon, m.images, COUNT(h.id_mon) as order_count
      FROM monan m
      LEFT JOIN hopdong h ON m.id_mon = h.id_mon
      WHERE m.tinhtrang = 1
      GROUP BY m.id_mon, m.name_mon, m.gia_mon, m.images
      ORDER BY order_count DESC
      LIMIT ?
    `, [limit]);
    return rows;
  },

  getMenuSummary: async () => {
    const [categories] = await db.query('SELECT COUNT(*) as count FROM loai_mon');
    const [dishes] = await db.query('SELECT COUNT(*) as count FROM monan WHERE tinhtrang = 1');
    const [avgPrice] = await db.query('SELECT AVG(CAST(gia_mon AS DECIMAL(10,2))) as avg FROM monan WHERE tinhtrang = 1');
    
    return {
      total_categories: categories[0].count || 0,
      total_dishes: dishes[0].count || 0,
      avg_price: avgPrice[0].avg || 0
    };
  },

  // ============ INVENTORY/INGREDIENTS (Kitchen) ============
  getAllIngredients: async () => {
    const [rows] = await db.query(`
      SELECT nl.*, dvt.ten_dvt 
      FROM nguyen_lieu nl 
      LEFT JOIN don_vi_tinh dvt ON nl.id_dvt = dvt.id_dvt 
      ORDER BY nl.ten_nl ASC
    `);
    return rows;
  },

  addIngredient: async (data) => {
    const { ten_nl, id_dvt, dinh_muc_min } = data;
    await db.query(
      'INSERT INTO nguyen_lieu (ten_nl, id_dvt, dinh_muc_min, so_luong) VALUES (?, ?, ?, 0)',
      [ten_nl, id_dvt, dinh_muc_min]
    );
  },

  updateIngredient: async (id, data) => {
    const { ten_nl, id_dvt, dinh_muc_min } = data;
    await db.query(
      'UPDATE nguyen_lieu SET ten_nl = ?, id_dvt = ?, dinh_muc_min = ? WHERE id_nl = ?',
      [ten_nl, id_dvt, dinh_muc_min, id]
    );
  },

  deleteIngredient: async (id) => {
    await db.query('DELETE FROM nguyen_lieu WHERE id_nl = ?', [id]);
  },

  getAllUnits: async () => {
    const [rows] = await db.query('SELECT * FROM don_vi_tinh ORDER BY id_dvt ASC');
    return rows;
  },

  addUnit: async (ten_dvt) => {
    await db.query('INSERT INTO don_vi_tinh (ten_dvt) VALUES (?)', [ten_dvt]);
  },

  deleteUnit: async (id) => {
    await db.query('DELETE FROM don_vi_tinh WHERE id_dvt = ?', [id]);
  },

  addStockIn: async (data) => {
    const { id_nl, so_luong, gia_nhap } = data;
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        'INSERT INTO nhap_kho (id_nl, so_luong, gia_nhap) VALUES (?, ?, ?)',
        [id_nl, so_luong, gia_nhap]
      );
      await connection.query('UPDATE nguyen_lieu SET so_luong = so_luong + ? WHERE id_nl = ?', [so_luong, id_nl]);
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  getStockHistory: async () => {
    const [rows] = await db.query(`
      SELECT nk.*, nl.ten_nl, dvt.ten_dvt 
      FROM nhap_kho nk 
      JOIN nguyen_lieu nl ON nk.id_nl = nl.id_nl 
      LEFT JOIN don_vi_tinh dvt ON nl.id_dvt = dvt.id_dvt 
      ORDER BY nk.ngay_nhap DESC
    `);
    return rows;
  },

  addRecipeItem: async (id_mon, id_nl, so_luong_tieu_hao) => {
    await db.query(
      'INSERT INTO cong_thuc (id_mon, id_nl, so_luong_tieu_hao) VALUES (?, ?, ?)',
      [id_mon, id_nl, so_luong_tieu_hao]
    );
  },

  deleteRecipeItem: async (id) => {
    await db.query('DELETE FROM cong_thuc WHERE id_ct = ?', [id]);
  },

  getRecipeByDish: async (dishId) => {
    const [rows] = await db.query(`
      SELECT ct.*, nl.ten_nl, dvt.ten_dvt 
      FROM cong_thuc ct 
      JOIN nguyen_lieu nl ON ct.id_nl = nl.id_nl 
      LEFT JOIN don_vi_tinh dvt ON nl.id_dvt = dvt.id_dvt 
      WHERE ct.id_mon = ? 
      ORDER BY ct.id_ct ASC
    `, [dishId]);
    return rows;
  },
  updateUnit: async (id, ten_dvt) => {
    await db.query('UPDATE don_vi_tinh SET ten_dvt = ? WHERE id_dvt = ?', [ten_dvt, id]);
  },

  updateRecipeItem: async (id, id_mon, id_nl, so_luong_tieu_hao) => {
    await db.query(
      'UPDATE cong_thuc SET id_mon = ?, id_nl = ?, so_luong_tieu_hao = ? WHERE id_ct = ?',
      [id_mon, id_nl, so_luong_tieu_hao, id]
    );
  },

  // ============ COMBO OPERATIONS ============
  getAllCombos: async () => {
    const [rows] = await db.query('SELECT * FROM combos ORDER BY id_combo DESC');
    return rows;
  },

  addCombo: async (data) => {
    const { ten_combo, gia_combo, mo_ta, hinh_anh } = data;
    await db.query(
      'INSERT INTO combos (ten_combo, gia_combo, mo_ta, hinh_anh) VALUES (?, ?, ?, ?)',
      [ten_combo, gia_combo, mo_ta, hinh_anh]
    );
  },

  updateCombo: async (id, data) => {
    const { ten_combo, gia_combo, mo_ta, hinh_anh, trang_thai } = data;
    if (hinh_anh) {
      await db.query(
        'UPDATE combos SET ten_combo = ?, gia_combo = ?, mo_ta = ?, hinh_anh = ?, trang_thai = ? WHERE id_combo = ?',
        [ten_combo, gia_combo, mo_ta, hinh_anh, trang_thai || 1, id]
      );
    } else {
      await db.query(
        'UPDATE combos SET ten_combo = ?, gia_combo = ?, mo_ta = ?, trang_thai = ? WHERE id_combo = ?',
        [ten_combo, gia_combo, mo_ta, trang_thai || 1, id]
      );
    }
  },

  deleteCombo: async (id) => {
    await db.query('DELETE FROM combos WHERE id_combo = ?', [id]);
  },
};

module.exports = menuService;
