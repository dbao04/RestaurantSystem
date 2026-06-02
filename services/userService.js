const db = require('../config/db');
const md5 = require('md5');

const userService = {
  login: async (sdt, password) => {
    const hashedPassword = md5(password);
    const [rows] = await db.query(
      'SELECT * FROM khach_hang WHERE sodienthoai = ? AND passwords = ? LIMIT 1',
      [sdt, hashedPassword]
    );
    return rows[0] || null;
  },

  register: async (data) => {
    const { ten, sodienthoai, email, diachi, passwords } = data;
    const hashedPassword = passwords ? md5(passwords) : null;
    const [existing] = await db.query('SELECT * FROM khach_hang WHERE sodienthoai = ?', [sodienthoai]);
    if (existing.length > 0) throw new Error('Số điện thoại này đã được đăng ký!');
    const [result] = await db.query(
      'INSERT INTO khach_hang (ten, sodienthoai, email, diachi, passwords) VALUES (?, ?, ?, ?, ?)',
      [ten, sodienthoai, email, diachi, hashedPassword]
    );
    return result.insertId;
  },

  getUserById: async (id) => {
    const [rows] = await db.query('SELECT * FROM khach_hang WHERE id = ?', [id]);
    return rows[0] || null;
  },

  updateUserProfile: async (id, data) => {
    const { ten, email, diachi } = data;
    await db.query('UPDATE khach_hang SET ten = ?, email = ?, diachi = ? WHERE id = ?', [ten, email, diachi, id]);
  },

  changeUserPassword: async (id, oldPass, newPass) => {
    const hashedOld = md5(oldPass);
    const [rows] = await db.query('SELECT * FROM khach_hang WHERE id = ? AND passwords = ?', [id, hashedOld]);
    if (!rows[0]) throw new Error('Mật khẩu cũ không đúng!');
    const hashedNew = md5(newPass);
    await db.query('UPDATE khach_hang SET passwords = ? WHERE id = ?', [hashedNew, id]);
  },

  getAllCustomers: async () => {
    const [rows] = await db.query('SELECT * FROM khach_hang ORDER BY id DESC');
    return rows;
  },

  addCustomer: async (data) => {
    const { ten, sodienthoai, email, diachi } = data;
    await db.query(
      'INSERT INTO khach_hang (ten, sodienthoai, email, diachi, passwords) VALUES (?, ?, ?, ?, ?)',
      [ten, sodienthoai, email, diachi, md5('123456')]
    );
  },

  updateCustomer: async (id, data) => {
    const { ten, sodienthoai, email, diachi } = data;
    await db.query('UPDATE khach_hang SET ten = ?, sodienthoai = ?, email = ?, diachi = ? WHERE id = ?', [ten, sodienthoai, email, diachi, id]);
  },

  deleteCustomer: async (id) => {
    await db.query('DELETE FROM khach_hang WHERE id = ?', [id]);
  }
};

module.exports = userService;
