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
    const { id_nl, gia_nhap } = data;
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Lam tron theo dung don vi TRUOC khi ghi.
      //
      // O nhap tren giao dien da chan bang thuoc tinh step, nhung form co the
      // bi gui thang bang cong cu khac, va tuyet doi khong the de mot dong
      // "nhap 2,5 lon bia" lot vao kho: chi can mot dong nhu vay la cot ton kho
      // lai le vinh vien va moi lan kiem ke deu bao chenh.
      const [dvt] = await connection.query(
        `SELECT d.ten_dvt FROM nguyen_lieu n
         LEFT JOIN don_vi_tinh d ON d.id_dvt = n.id_dvt WHERE n.id_nl = ? LIMIT 1`,
        [id_nl]
      );
      const so_luong = require('../utils/format').lamTronTheoDonVi(
        data.so_luong, dvt.length ? dvt[0].ten_dvt : null
      );
      if (!(so_luong > 0)) {
        throw new Error('Số lượng nhập không hợp lệ cho đơn vị "' +
          (dvt.length ? dvt[0].ten_dvt : '?') + '"');
      }

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
