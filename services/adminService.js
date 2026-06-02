const db = require('../config/db');
const md5 = require('md5');

const adminService = {
  adminLogin: async (adminuser, adminpass) => {
    const hashedPass = md5(adminpass);
    const [rows] = await db.query(
      'SELECT * FROM tb_admin WHERE adminuser = ? AND adminpass = ? LIMIT 1',
      [adminuser, hashedPass]
    );
    return rows[0] || null;
  },

  getAdminById: async (id) => {
    const [rows] = await db.query('SELECT * FROM tb_admin WHERE id_admin = ?', [id]);
    return rows[0] || null;
  },

  updateAdminProfile: async (id, data) => {
    const { name, adminuser } = data;
    await db.query(
      'UPDATE tb_admin SET Name_admin = ?, adminuser = ? WHERE id_admin = ?',
      [name, adminuser, id]
    );
  },

  changeAdminPassword: async (id, oldPass, newPass) => {
    const hashedOld = md5(oldPass);
    const [rows] = await db.query(
      'SELECT * FROM tb_admin WHERE id_admin = ? AND adminpass = ?',
      [id, hashedOld]
    );
    if (!rows[0]) throw new Error('Mật khẩu cũ không đúng!');
    const hashedNew = md5(newPass);
    await db.query('UPDATE tb_admin SET adminpass = ? WHERE id_admin = ?', [hashedNew, id]);
  },

  getDashboardStats: async () => {
    const [revenue] = await db.query('SELECT SUM(thanhtien) as total FROM hopdong WHERE tinhtrang = 3');
    const [orders] = await db.query('SELECT COUNT(DISTINCT sesis) as total FROM hopdong');
    const [customers] = await db.query('SELECT COUNT(*) as total FROM khach_hang');
    const [staff] = await db.query('SELECT COUNT(*) as total FROM nhan_vien');
    
    return {
      revenue: (revenue[0] && revenue[0].total) ? revenue[0].total : 0,
      orders: (orders[0] && orders[0].total) ? orders[0].total : 0,
      customers: customers[0].total || 0,
      staff: staff[0].total || 0
    };
  },

  getRevenueByMonth: async () => {
    const [rows] = await db.query(`
      SELECT MONTH(COALESCE(
        STR_TO_DATE(dates, '%Y-%m-%d'),
        STR_TO_DATE(dates, '%m/%d/%Y'),
        STR_TO_DATE(dates, '%c/%e/%Y')
      )) as month, SUM(thanhtien) as revenue 
      FROM hopdong 
      WHERE tinhtrang = 3 AND YEAR(COALESCE(
        STR_TO_DATE(dates, '%Y-%m-%d'),
        STR_TO_DATE(dates, '%m/%d/%Y'),
        STR_TO_DATE(dates, '%c/%e/%Y')
      )) = YEAR(CURDATE())
      GROUP BY MONTH(COALESCE(
        STR_TO_DATE(dates, '%Y-%m-%d'),
        STR_TO_DATE(dates, '%m/%d/%Y'),
        STR_TO_DATE(dates, '%c/%e/%Y')
      ))
      ORDER BY month ASC
    `);
    return rows;
  },

  getAllPosts: async () => {
    const [rows] = await db.query('SELECT * FROM bai_viet ORDER BY id_bv DESC');
    return rows;
  },

  getPostById: async (id) => {
    const [rows] = await db.query('SELECT * FROM bai_viet WHERE id_bv = ?', [id]);
    return rows[0] || null;
  },

  addPost: async (data) => {
    const { tieu_de, noi_dung, hinh_anh } = data;
    await db.query(
      'INSERT INTO bai_viet (tieu_de, noi_dung, hinh_anh) VALUES (?, ?, ?)',
      [tieu_de, noi_dung, hinh_anh]
    );
  },

  updatePost: async (id, data) => {
    const { tieu_de, noi_dung, hinh_anh } = data;
    if (hinh_anh) {
      await db.query(
        'UPDATE bai_viet SET tieu_de = ?, noi_dung = ?, hinh_anh = ? WHERE id_bv = ?',
        [tieu_de, noi_dung, hinh_anh, id]
      );
    } else {
      await db.query(
        'UPDATE bai_viet SET tieu_de = ?, noi_dung = ? WHERE id_bv = ?',
        [tieu_de, noi_dung, id]
      );
    }
  },

  deletePost: async (id) => {
    await db.query('DELETE FROM bai_viet WHERE id_bv = ?', [id]);
  }
};

module.exports = adminService;
