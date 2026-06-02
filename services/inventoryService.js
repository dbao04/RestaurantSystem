const db = require('../config/db');

const inventoryService = {
  getAllUnits: async () => {
    const [rows] = await db.query('SELECT * FROM don_vi_tinh ORDER BY ten_dvt ASC');
    return rows;
  },

  addUnit: async (ten) => {
    await db.query('INSERT INTO don_vi_tinh (ten_dvt) VALUES (?)', [ten]);
  },

  deleteUnit: async (id) => {
    await db.query('DELETE FROM don_vi_tinh WHERE id_dvt = ?', [id]);
  },

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
    await db.query('INSERT INTO nguyen_lieu (ten_nl, id_dvt, dinh_muc_min, so_luong) VALUES (?, ?, ?, 0)', [ten_nl, id_dvt, dinh_muc_min]);
  },

  updateIngredient: async (id, data) => {
    const { ten_nl, id_dvt, dinh_muc_min } = data;
    await db.query('UPDATE nguyen_lieu SET ten_nl = ?, id_dvt = ?, dinh_muc_min = ? WHERE id_nl = ?', [ten_nl, id_dvt, dinh_muc_min, id]);
  },

  deleteIngredient: async (id) => {
    await db.query('DELETE FROM nguyen_lieu WHERE id_nl = ?', [id]);
  },

  addStockIn: async (data) => {
    const { id_nl, so_luong, gia_nhap } = data;
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('INSERT INTO nhap_kho (id_nl, so_luong, gia_nhap) VALUES (?, ?, ?)', [id_nl, so_luong, gia_nhap]);
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
  }
};

module.exports = inventoryService;
