const db = require('../config/db');

const bookingService = {
  createOrderFromCart: async (sessionId, userId, time, date, numPeople, partyType) => {
    const [cartItems] = await db.query('SELECT * FROM cart WHERE sesid = ?', [sessionId]);
    if (cartItems.length === 0) throw new Error('Your cart is empty.');
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      for (const item of cartItems) {
        const thanhtien = item.gia_mon * item.soluong;
        await connection.query(
          `INSERT INTO hopdong (sesis, id_mon, name_mon, id_user, dates, tg, soluong, noidung, so_user, gia, thanhtien, images, tinhtrang) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [sessionId, item.id_mon, item.name_mon, userId, date, time, item.soluong, partyType, numPeople, item.gia_mon, thanhtien, item.images || '']
        );
      }
      await connection.query('DELETE FROM cart WHERE sesid = ?', [sessionId]);
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  getUserOrders: async (userId) => {
    const [rows] = await db.query(
      `SELECT sesis, dates, so_user, noidung, tg, tinhtrang, SUM(thanhtien) AS tong_tien 
       FROM hopdong WHERE id_user = ? 
       GROUP BY sesis, dates, so_user, noidung, tg, tinhtrang`,
      [userId]
    );
    return rows;
  },

  requestCancelOrder: async (sesis, userId) => {
    const [rows] = await db.query('SELECT * FROM hopdong WHERE sesis = ? AND id_user = ? AND tinhtrang = 1 LIMIT 1', [sesis, userId]);
    if (!rows[0]) throw new Error('Không tìm thấy đơn hoặc đơn không thể hủy!');
    await db.query('UPDATE hopdong SET tinhtrang = 2 WHERE sesis = ? AND id_user = ?', [sesis, userId]);
  },

  getOrderDetails: async (sessionId) => {
    const [rows] = await db.query(
      `SELECT h.*, k.ten as ten_khach, k.sodienthoai 
       FROM hopdong h INNER JOIN khach_hang k ON h.id_user = k.id WHERE h.sesis = ?`,
      [sessionId]
    );
    return rows;
  },

  hasCompletedOrder: async (userId) => {
    const [rows] = await db.query('SELECT COUNT(*) as count FROM hopdong WHERE id_user = ? AND tinhtrang = 3', [userId]);
    return rows[0].count > 0;
  },

  getAllBookings: async () => {
    const [rows] = await db.query(`
      SELECT h.sesis, h.dates, k.ten as ten, k.sodienthoai, h.so_user, h.noidung, h.tg, h.tinhtrang, SUM(h.thanhtien) as tong_tien
      FROM hopdong h
      INNER JOIN khach_hang k ON h.id_user = k.id
      GROUP BY h.sesis, h.dates, k.ten, k.sodienthoai, h.so_user, h.noidung, h.tg, h.tinhtrang
      ORDER BY h.dates DESC, h.tg DESC
    `);
    return rows;
  },

  getNewBookings: async () => {
    const [rows] = await db.query(`
      SELECT h.sesis, h.dates, k.ten as ten, k.sodienthoai, h.so_user, h.noidung, h.tg, h.tinhtrang, SUM(h.thanhtien) as tong_tien
      FROM hopdong h
      INNER JOIN khach_hang k ON h.id_user = k.id
      WHERE h.tinhtrang = 0
      GROUP BY h.sesis, h.dates, k.ten, k.sodienthoai, h.so_user, h.noidung, h.tg, h.tinhtrang
      ORDER BY h.dates DESC, h.tg DESC
    `);
    return rows;
  },

  createStaffBooking: async (data) => {
    const { ten, sodienthoai, dates, tg, so_user, noidung } = data;
    const md5 = require('md5');
    let [users] = await db.query('SELECT id FROM khach_hang WHERE sodienthoai = ?', [sodienthoai]);
    let userId;
    if (users.length > 0) {
      userId = users[0].id;
    } else {
      const [res] = await db.query('INSERT INTO khach_hang (ten, sodienthoai, passwords) VALUES (?, ?, ?)', [ten, sodienthoai, md5('123456')]);
      userId = res.insertId;
    }
    const sesis = Math.random().toString(36).substring(2, 15);
    await db.query(
      `INSERT INTO hopdong (sesis, id_mon, name_mon, id_user, dates, tg, soluong, noidung, so_user, gia, thanhtien, images, tinhtrang) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sesis, 0, 'Chưa chọn món', userId, dates, tg, 0, noidung, so_user, 0, 0, '', 0]
    );
  },

  updateBooking: async (sesis, data) => {
    const { dates, tg, so_user, noidung } = data;
    await db.query('UPDATE hopdong SET dates = ?, tg = ?, so_user = ?, noidung = ? WHERE sesis = ?', [dates, tg, so_user, noidung, sesis]);
  },

  payBill: async (sesis) => {
    await db.query('UPDATE hopdong SET tinhtrang = 3 WHERE sesis = ?', [sesis]);
  },

  updateContractStatus: async (sessionId, status) => {
    await db.query('UPDATE hopdong SET tinhtrang = ? WHERE sesis = ?', [status, sessionId]);
  },

  deleteContract: async (sessionId) => {
    await db.query('DELETE FROM hopdong WHERE sesis = ?', [sessionId]);
  },

  closeShift: async (staffId, data) => {
    const { ngay, ca, tong_tien, ghi_chu } = data;
    await db.query('INSERT INTO chot_ca (staff_id, ngay, ca, tong_tien, ghi_chu) VALUES (?, ?, ?, ?, ?)', [staffId, ngay, ca, tong_tien, ghi_chu]);
  },

  getShiftHistory: async () => {
    const [rows] = await db.query(`
      SELECT c.*, n.ten as ten_nhanvien 
      FROM chot_ca c 
      JOIN nhan_vien n ON c.staff_id = n.id_nv 
      ORDER BY c.created_at DESC
    `);
    return rows;
  },

  saveEmailLog: async (staffId, data) => {
    const { recipient, subject, content } = data;
    await db.query('INSERT INTO email_history (recipient, subject, content, staff_id) VALUES (?, ?, ?, ?)', [recipient, subject, content, staffId]);
  },

  getEmailLogs: async () => {
    const [rows] = await db.query('SELECT * FROM email_history ORDER BY sent_at DESC');
    return rows;
  }
};

module.exports = bookingService;
