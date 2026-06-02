const db = require('../config/db');

const equipmentService = {
  getAllEquipment: async () => {
    const [rows] = await db.query('SELECT * FROM trang_thiet_bi ORDER BY id_ttb DESC');
    return rows;
  },

  addEquipment: async (data) => {
    const { ten_ttb, so_luong, tinh_trang, ghi_chu } = data;
    await db.query('INSERT INTO trang_thiet_bi (ten_ttb, so_luong, tinh_trang, ghi_chu) VALUES (?, ?, ?, ?)', [ten_ttb, so_luong, tinh_trang, ghi_chu]);
  },

  updateEquipment: async (id, data) => {
    const { ten_ttb, so_luong, tinh_trang, ghi_chu } = data;
    await db.query('UPDATE trang_thiet_bi SET ten_ttb = ?, so_luong = ?, tinh_trang = ?, ghi_chu = ? WHERE id_ttb = ?', [ten_ttb, so_luong, tinh_trang, ghi_chu, id]);
  },

  deleteEquipment: async (id) => {
    await db.query('DELETE FROM trang_thiet_bi WHERE id_ttb = ?', [id]);
  }
};

module.exports = equipmentService;
