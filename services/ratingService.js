const db = require('../config/db');

const ratingService = {
  addRating: async (id_kh, sao, noi_dung) => {
    const [result] = await db.query('INSERT INTO danh_gia (id_kh, sao, noi_dung) VALUES (?, ?, ?)', [id_kh, sao, noi_dung || null]);
    return result.insertId;
  },

  getUserRatings: async (id_kh) => {
    const [rows] = await db.query(`SELECT dg.*, k.ten FROM danh_gia dg JOIN khach_hang k ON dg.id_kh = k.id WHERE dg.id_kh = ? ORDER BY dg.thoigian DESC`, [id_kh]);
    return rows;
  },

  getAllRatings: async () => {
    const [rows] = await db.query(`SELECT dg.*, k.ten FROM danh_gia dg JOIN khach_hang k ON dg.id_kh = k.id ORDER BY dg.thoigian DESC`);
    return rows;
  },

  getAverageRating: async () => {
    const [rows] = await db.query('SELECT AVG(sao) AS avg_sao, COUNT(*) AS total FROM danh_gia');
    return rows[0];
  }
};

module.exports = ratingService;
