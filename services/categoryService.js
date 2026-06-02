const db = require('../config/db');

const categoryService = {
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
  }
};

module.exports = categoryService;
