const db = require('../config/db');

const dishService = {
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
    const [rows] = await db.query('SELECT * FROM monan WHERE id_loai = ? AND tinhtrang = 1', [categoryId]);
    return rows;
  },

  searchDishes: async (key) => {
    const searchTerm = `%${(key || '').trim()}%`;
    const [rows] = await db.query('SELECT * FROM monan WHERE name_mon LIKE ? AND tinhtrang = 1', [searchTerm]);
    return rows;
  },

  addDish: async (data) => {
    const { name, categoryId, note, price, image } = data;
    await db.query(
      'INSERT INTO monan (name_mon, id_loai, ghichu_mon, gia_mon, images) VALUES (?, ?, ?, ?, ?)',
      [name, categoryId, note, price, image]
    );
  },

  updateDish: async (id, data) => {
    const { name, categoryId, note, price, image, tinhtrang } = data;
    const status = tinhtrang !== undefined ? tinhtrang : 1;
    if (image) {
      await db.query(
        'UPDATE monan SET name_mon = ?, id_loai = ?, ghichu_mon = ?, gia_mon = ?, images = ?, tinhtrang = ? WHERE id_mon = ?',
        [name, categoryId, note, price, image, status, id]
      );
    } else {
      await db.query(
        'UPDATE monan SET name_mon = ?, id_loai = ?, ghichu_mon = ?, gia_mon = ?, tinhtrang = ? WHERE id_mon = ?',
        [name, categoryId, note, price, status, id]
      );
    }
  },

  deleteDish: async (id) => {
    await db.query('DELETE FROM monan WHERE id_mon = ?', [id]);
  },

  getAllCombos: async () => {
    const [rows] = await db.query('SELECT * FROM combos ORDER BY id_combo DESC');
    return rows;
  },

  addCombo: async (data) => {
    const { ten_combo, gia_combo, mo_ta, hinh_anh } = data;
    await db.query('INSERT INTO combos (ten_combo, gia_combo, mo_ta, hinh_anh) VALUES (?, ?, ?, ?)', [ten_combo, gia_combo, mo_ta, hinh_anh]);
  },

  updateCombo: async (id, data) => {
    const { ten_combo, gia_combo, mo_ta, hinh_anh, trang_thai } = data;
    if (hinh_anh) {
      await db.query(
        'UPDATE combos SET ten_combo = ?, gia_combo = ?, mo_ta = ?, hinh_anh = ?, trang_thai = ? WHERE id_combo = ?',
        [ten_combo, gia_combo, mo_ta, hinh_anh, trang_thai, id]
      );
    } else {
      await db.query(
        'UPDATE combos SET ten_combo = ?, gia_combo = ?, mo_ta = ?, trang_thai = ? WHERE id_combo = ?',
        [ten_combo, gia_combo, mo_ta, trang_thai, id]
      );
    }
  },

  deleteCombo: async (id) => {
    await db.query('DELETE FROM combos WHERE id_combo = ?', [id]);
  },

  getRecipeByDish: async (dishId) => {
    const [rows] = await db.query(`
      SELECT ct.*, nl.ten_nl, dvt.ten_dvt 
      FROM cong_thuc ct 
      JOIN nguyen_lieu nl ON ct.id_nl = nl.id_nl 
      LEFT JOIN don_vi_tinh dvt ON nl.id_dvt = dvt.id_dvt 
      WHERE ct.id_mon = ?
    `, [dishId]);
    return rows;
  },

  addRecipeItem: async (dishId, ingredientId, quantity) => {
    await db.query('INSERT INTO cong_thuc (id_mon, id_nl, so_luong_tieu_hao) VALUES (?, ?, ?)', [dishId, ingredientId, quantity]);
  },

  deleteRecipeItem: async (id) => {
    await db.query('DELETE FROM cong_thuc WHERE id_ct = ?', [id]);
  }
};

module.exports = dishService;
