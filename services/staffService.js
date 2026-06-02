const db = require('../config/db');
const md5 = require('md5');

const staffService = {
  staffLogin: async (username, password) => {
    const hashedPassword = md5(password);
    const [rows] = await db.query(
      'SELECT * FROM nhan_vien WHERE username = ? AND passwords = ? AND trangthai = 1 LIMIT 1',
      [username, hashedPassword]
    );
    return rows[0] || null;
  },

  getStaffById: async (id) => {
    const [rows] = await db.query(
      'SELECT id_nv, ten, sodienthoai, email, diachi, chucvu, username, ngayvaolam, trangthai FROM nhan_vien WHERE id_nv = ?',
      [id]
    );
    return rows[0] || null;
  },

  getAllStaff: async () => {
    const [rows] = await db.query('SELECT * FROM nhan_vien ORDER BY id_nv DESC');
    return rows;
  },

  addStaff: async (data) => {
    const { ten, sodienthoai, email, diachi, chucvu, username, passwords } = data;
    const hashedPass = md5(passwords);
    await db.query(
      'INSERT INTO nhan_vien (ten, sodienthoai, email, diachi, chucvu, username, passwords, ngayvaolam) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [ten, sodienthoai, email, diachi, chucvu, username, hashedPass]
    );
  },

  updateStaff: async (id, data) => {
    const { ten, sodienthoai, email, diachi, chucvu, username, passwords, trangthai } = data;
    if (passwords) {
      const hashedPass = md5(passwords);
      await db.query(
        'UPDATE nhan_vien SET ten = ?, sodienthoai = ?, email = ?, diachi = ?, chucvu = ?, username = ?, passwords = ?, trangthai = ? WHERE id_nv = ?',
        [ten, sodienthoai, email, diachi, chucvu, username, hashedPass, trangthai, id]
      );
    } else {
      await db.query(
        'UPDATE nhan_vien SET ten = ?, sodienthoai = ?, email = ?, diachi = ?, chucvu = ?, username = ?, trangthai = ? WHERE id_nv = ?',
        [ten, sodienthoai, email, diachi, chucvu, username, trangthai, id]
      );
    }
  },

  deleteStaff: async (id) => {
    // Soft delete to avoid foreign key constraints and preserve history
    await db.query('UPDATE nhan_vien SET trangthai = 0 WHERE id_nv = ?', [id]);
  },

  updateStaffProfile: async (id, data) => {
    const { ten, sodienthoai, email, diachi } = data;
    await db.query(
      'UPDATE nhan_vien SET ten = ?, sodienthoai = ?, email = ?, diachi = ? WHERE id_nv = ?',
      [ten, sodienthoai, email, diachi, id]
    );
  },

  changeStaffPassword: async (id, oldPass, newPass) => {
    const hashedOld = md5(oldPass);
    const [rows] = await db.query(
      'SELECT * FROM nhan_vien WHERE id_nv = ? AND passwords = ?',
      [id, hashedOld]
    );
    if (!rows[0]) throw new Error('Mật khẩu cũ không đúng!');
    const hashedNew = md5(newPass);
    await db.query('UPDATE nhan_vien SET passwords = ? WHERE id_nv = ?', [hashedNew, id]);
  },

  getSchedule: async (id, year, month) => {
    let query, params;
    if (id === null || id === undefined) {
      query = `SELECT l.*, n.ten as ten_nhanvien, n.chucvu 
               FROM lich_lam_viec l 
               JOIN nhan_vien n ON l.id_nv = n.id_nv`;
      params = [];
      if (year && month) {
        query += ` WHERE YEAR(l.ngay) = ? AND MONTH(l.ngay) = ?`;
        params.push(year, month);
      }
      query += ` ORDER BY l.ngay ASC`;
    } else {
      query = `SELECT * FROM lich_lam_viec WHERE id_nv = ?`;
      params = [id];
      if (year && month) {
        query += ` AND YEAR(ngay) = ? AND MONTH(ngay) = ?`;
        params.push(year, month);
      }
      query += ` ORDER BY ngay ASC`;
    }
    const [rows] = await db.query(query, params);
    return rows;
  },

  registerSchedule: async (id, ngay, ca, ghiChu) => {
    const [existing] = await db.query(
      'SELECT * FROM lich_lam_viec WHERE id_nv = ? AND ngay = ? AND ca = ?',
      [id, ngay, ca]
    );
    if (existing.length > 0) throw new Error('Bạn đã đăng ký ca này rồi!');

    const caMap = { sang: { bat: '07:00:00', ket: '12:00:00' }, chieu: { bat: '12:00:00', ket: '17:00:00' }, toi: { bat: '17:00:00', ket: '21:00:00' } };
    const gioBD = caMap[ca] ? caMap[ca].bat : null;
    const gioKT = caMap[ca] ? caMap[ca].ket : null;

    await db.query(
      'INSERT INTO lich_lam_viec (id_nv, ngay, ca, gio_bat_dau, gio_ket_thuc, ghi_chu) VALUES (?, ?, ?, ?, ?, ?)',
      [id, ngay, ca, gioBD, gioKT, ghiChu || null]
    );
  },

  cancelSchedule: async (idLich, idNv) => {
    await db.query(
      'DELETE FROM lich_lam_viec WHERE id_lich = ? AND id_nv = ? AND trangthai = 0',
      [idLich, idNv]
    );
  },

  getAllSchedules: async () => {
    const [rows] = await db.query(`
      SELECT l.*, n.ten as ten_nhanvien, n.chucvu 
      FROM lich_lam_viec l 
      JOIN nhan_vien n ON l.id_nv = n.id_nv 
      ORDER BY l.ngay DESC, l.ca ASC
    `);
    return rows;
  },

  updateScheduleStatus: async (id, status) => {
    await db.query('UPDATE lich_lam_viec SET trangthai = ? WHERE id_lich = ?', [status, id]);
  },

  getNotifications: async (id) => {
    const [rows] = await db.query(
      `SELECT * FROM thong_bao WHERE id_nv = ? OR id_nv IS NULL ORDER BY created_at DESC`,
      [id]
    );
    return rows;
  },

  markNotificationRead: async (idTb) => {
    await db.query('UPDATE thong_bao SET da_doc = 1 WHERE id_tb = ?', [idTb]);
  },

  countUnread: async (id) => {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS cnt FROM thong_bao WHERE (id_nv = ? OR id_nv IS NULL) AND da_doc = 0`,
      [id]
    );
    return rows[0].cnt;
  }
};

module.exports = staffService;
