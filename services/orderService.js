/**
 * ORDER SERVICE
 * Comprehensive service for managing orders, carts, bookings, and customer accounts
 */

const db = require('../config/db');
const md5 = require('md5');

const orderService = {
  // ============ CART OPERATIONS ============
  getCart: async (sessionId) => {
    const [rows] = await db.query('SELECT * FROM cart WHERE sesid = ?', [sessionId]);
    return rows;
  },

  addToCart: async (sessionId, dishId, quantity) => {
    const [dishes] = await db.query('SELECT * FROM monan WHERE id_mon = ?', [dishId]);
    if (dishes.length === 0) throw new Error('Không tìm thấy món ăn');
    const dish = dishes[0];
    const [existing] = await db.query('SELECT * FROM cart WHERE sesid = ? AND id_mon = ?', [sessionId, dishId]);
    if (existing.length > 0) {
      const newQuantity = parseInt(existing[0].soluong) + parseInt(quantity);
      await db.query('UPDATE cart SET soluong = ? WHERE cart_id = ?', [newQuantity, existing[0].cart_id]);
    } else {
      await db.query(
        'INSERT INTO cart (id_mon, sesid, name_mon, gia_mon, soluong, images) VALUES (?, ?, ?, ?, ?, ?)',
        [dishId, sessionId, dish.name_mon, dish.gia_mon, quantity, dish.images]
      );
    }
  },

  updateCartQuantity: async (cartId, quantity) => {
    await db.query('UPDATE cart SET soluong = ? WHERE cart_id = ?', [quantity, cartId]);
  },

  removeFromCart: async (cartId) => {
    await db.query('DELETE FROM cart WHERE cart_id = ?', [cartId]);
  },

  clearCart: async (sessionId) => {
    await db.query('DELETE FROM cart WHERE sesid = ?', [sessionId]);
  },

  getCartTotal: async (sessionId) => {
    const [rows] = await db.query('SELECT SUM(gia_mon * soluong) as total FROM cart WHERE sesid = ?', [sessionId]);
    return rows[0].total || 0;
  },

  // ============ ORDER/BOOKING OPERATIONS ============
  createOrderFromCart: async (sessionId, userId, time, date, numPeople, partyType) => {
    const [cartItems] = await db.query('SELECT * FROM cart WHERE sesid = ?', [sessionId]);
    if (cartItems.length === 0) throw new Error('Giỏ hàng của bạn trống');
    // Tạo một sesis duy nhất cho mỗi đơn hàng (không dùng sessionID vì cố định)
    const uniqueSesis = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 8);
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      for (const item of cartItems) {
        const thanhtien = item.gia_mon * item.soluong;
        await connection.query(
          `INSERT INTO hopdong (sesis, id_mon, name_mon, id_user, dates, tg, soluong, noidung, so_user, gia, thanhtien, images, tinhtrang) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [uniqueSesis, item.id_mon, item.name_mon, userId, date, time, item.soluong, partyType, numPeople, item.gia_mon, thanhtien, item.images]
        );
      }
      await connection.query('DELETE FROM cart WHERE sesid = ?', [sessionId]);
      await connection.commit();
      return uniqueSesis; // Trả về sesis duy nhất để redirect đúng trang contract
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
      SELECT h.sesis, h.dates, k.ten as ten_khach, k.sodienthoai, h.so_user, h.noidung, h.tg, h.tinhtrang, SUM(h.thanhtien) as tong_tien, q.table_name
      FROM hopdong h
      INNER JOIN khach_hang k ON h.id_user = k.id
      LEFT JOIN qr_tables q ON h.sesis = q.active_sesis
      GROUP BY h.sesis, h.dates, k.ten, k.sodienthoai, h.so_user, h.noidung, h.tg, h.tinhtrang, q.table_name
      ORDER BY h.dates DESC, h.tg DESC
    `);
    return rows;
  },

  getNewBookings: async () => {
    const [rows] = await db.query(`
      SELECT h.sesis, h.dates, k.ten as ten_khach, k.sodienthoai, h.so_user, h.noidung, h.tg, h.tinhtrang, SUM(h.thanhtien) as tong_tien
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
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      let [users] = await connection.query('SELECT id FROM khach_hang WHERE sodienthoai = ?', [sodienthoai]);
      let userId;
      if (users.length > 0) {
        userId = users[0].id;
      } else {
        const [res] = await connection.query('INSERT INTO khach_hang (ten, sodienthoai, passwords) VALUES (?, ?, ?)', [ten, sodienthoai, md5('123456')]);
        userId = res.insertId;
      }
      const sesis = Math.random().toString(36).substring(2, 15);
      await connection.query(
        `INSERT INTO hopdong (sesis, id_mon, name_mon, id_user, dates, tg, soluong, noidung, so_user, gia, thanhtien, images, tinhtrang) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [sesis, 0, 'Chưa chọn món', userId, dates, tg, 0, noidung, so_user, 0, 0, '', 0]
      );
      await connection.commit();
      return sesis; // Return to enable socket notify
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  updateBooking: async (sesis, data) => {
    const { dates, tg, so_user, noidung } = data;
    await db.query(
      'UPDATE hopdong SET dates = ?, tg = ?, so_user = ?, noidung = ? WHERE sesis = ?',
      [dates, tg, so_user, noidung, sesis]
    );
  },

  payBill: async (sesis) => {
    // 3 = Paid (Đã thanh toán)
    await db.query('UPDATE hopdong SET tinhtrang = 3 WHERE sesis = ?', [sesis]);
    await db.query('UPDATE qr_tables SET active_sesis = NULL WHERE active_sesis = ?', [sesis]);
  },

  getBookingDetails: async (sesis) => {
    const [rows] = await db.query(
      `SELECT h.*, k.ten as ten_khach, k.sodienthoai 
       FROM hopdong h 
       JOIN khach_hang k ON h.id_user = k.id 
       WHERE h.sesis = ?`,
      [sesis]
    );
    return rows;
  },

  updateBookingStatus: async (sesis, status) => {
    await db.query('UPDATE hopdong SET tinhtrang = ? WHERE sesis = ?', [status, sesis]);
  },

  // ============ KITCHEN OPERATIONS ============
  getKitchenOrders: async () => {
    const [rows] = await db.query(`
      SELECT h.id, h.sesis, h.name_mon, h.soluong, h.tg, h.dates, h.tinhtrang, h.trangthai_bep, k.ten as ten_khach, q.table_name
      FROM hopdong h
      JOIN khach_hang k ON h.id_user = k.id
      LEFT JOIN qr_tables q ON (q.active_sesis = h.sesis) OR (h.sesis LIKE 'QR_%' AND q.table_id = SUBSTRING_INDEX(SUBSTRING_INDEX(h.sesis, '_', 2), '_', -1))
      WHERE h.tinhtrang IN (1, 5, 6) AND h.id_mon > 0 AND h.soluong > 0
      ORDER BY h.dates ASC, h.tg ASC
    `);
    return rows;
  },

  markKitchenDone: async (id) => {
    // Cập nhật trạng thái món ăn trong bếp sang "Đã xong" (1)
    await db.query('UPDATE hopdong SET trangthai_bep = 1 WHERE id = ?', [id]);

    // Lấy sesis của món ăn
    const [rows] = await db.query('SELECT sesis, tinhtrang FROM hopdong WHERE id = ? LIMIT 1', [id]);
    if (rows.length > 0) {
      const { sesis, tinhtrang } = rows[0];
      // Kiểm tra xem tất cả các món trong sesis này đã xong chưa
      const [pending] = await db.query('SELECT COUNT(*) as count FROM hopdong WHERE sesis = ? AND trangthai_bep = 0', [sesis]);
      if (pending[0].count === 0 && tinhtrang === 5) {
        // Cập nhật tình trạng đơn thành "Đang dùng món" (6)
        await db.query('UPDATE hopdong SET tinhtrang = 6 WHERE sesis = ?', [sesis]);
      }
    }
  },

  // ============ USER/CUSTOMER MANAGEMENT ============
  userLogin: async (sdt, password) => {
    const hashedPassword = md5(password);
    const [rows] = await db.query(
      'SELECT * FROM khach_hang WHERE sodienthoai = ? AND passwords = ? LIMIT 1',
      [sdt, hashedPassword]
    );
    return rows[0] || null;
  },

  userRegister: async (data) => {
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

  updateProfile: async (id, data) => {
    const { ten, email, diachi } = data;
    await db.query('UPDATE khach_hang SET ten = ?, email = ?, diachi = ? WHERE id = ?', [ten, email, diachi, id]);
  },

  changePassword: async (id, oldPass, newPass) => {
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
      'INSERT INTO khach_hang (ten, sodienthoai, email, diachi) VALUES (?, ?, ?, ?)',
      [ten, sodienthoai, email, diachi]
    );
  },

  updateCustomer: async (id, data) => {
    const { ten, sodienthoai, email, diachi } = data;
    await db.query(
      'UPDATE khach_hang SET ten = ?, sodienthoai = ?, email = ?, diachi = ? WHERE id = ?',
      [ten, sodienthoai, email, diachi, id]
    );
  },

  deleteCustomer: async (id) => {
    await db.query('DELETE FROM khach_hang WHERE id = ?', [id]);
  },

  // ============ SHIFT & EMAIL OPERATIONS ============
  getShiftHistory: async () => {
    const [rows] = await db.query(`
      SELECT c.*, n.ten as ten_nv 
      FROM chot_ca c 
      JOIN nhan_vien n ON c.staff_id = n.id_nv 
      ORDER BY c.created_at DESC
    `);
    return rows;
  },

  closeShift: async (staffId, data) => {
    const { ngay, ca, tong_tien, ghi_chu } = data;
    await db.query(
      'INSERT INTO chot_ca (staff_id, ngay, ca, tong_tien, ghi_chu) VALUES (?, ?, ?, ?, ?)',
      [staffId, ngay, ca, tong_tien, ghi_chu]
    );
  },

  getEmailLogs: async () => {
    const [rows] = await db.query(`
      SELECT e.*, n.ten as ten_nv 
      FROM email_history e 
      JOIN nhan_vien n ON e.staff_id = n.id_nv 
      ORDER BY e.sent_at DESC
    `);
    return rows;
  },

  saveEmailLog: async (staffId, data) => {
    const { recipient, subject, content } = data;
    await db.query(
      'INSERT INTO email_history (staff_id, recipient, subject, content) VALUES (?, ?, ?, ?)',
      [staffId, recipient, subject, content]
    );
  },

  // ============ MENU & STATS ============
  getTopDishes: async (limit = 10) => {
    const [rows] = await db.query(`
      SELECT m.id_mon, m.name_mon, m.gia_mon, m.images, COALESCE(SUM(h.soluong), 0) as total
      FROM monan m
      LEFT JOIN hopdong h ON m.id_mon = h.id_mon
      WHERE m.tinhtrang = 1
      GROUP BY m.id_mon, m.name_mon, m.gia_mon, m.images
      ORDER BY total DESC
      LIMIT ?
    `, [limit]);
    return rows;
  },

  requestCancelOrder: async (sesis, userId) => {
    // Check if order belongs to user and is in pending state (0)
    const [rows] = await db.query('SELECT * FROM hopdong WHERE sesis = ? AND id_user = ? AND tinhtrang = 0', [sesis, userId]);
    if (rows.length === 0) throw new Error('Không thể hủy đơn hàng này');
    await db.query('UPDATE hopdong SET tinhtrang = 4 WHERE sesis = ?', [sesis]); // 4 for cancellation request or cancelled
  },

  // ============ QR ORDER OPERATIONS ============
  /**
   * Thêm món vào đơn đặt bàn đang có (dùng cho QR order và nhân viên thêm món)
   * // [BẢO VỆ]: Thêm món vào đơn (Cho cả QR và Nhân viên order)
   * @param {string} sesis - Mã đơn hàng
   * @param {number} dishId - ID món ăn
   * @param {number} qty - Số lượng
   */
  addDishToOrder: async (sesis, dishId, qty) => {
    // Lấy thông tin đơn để lấy id_user, dates, tg, noidung, so_user
    const [orderRows] = await db.query(
      'SELECT id_user, dates, tg, noidung, so_user, tinhtrang FROM hopdong WHERE sesis = ? LIMIT 1',
      [sesis]
    );
    if (orderRows.length === 0) throw new Error('Không tìm thấy đơn hàng với mã này');
    const order = orderRows[0];
    if (order.tinhtrang === 3 || order.tinhtrang === 4) {
      throw new Error('Đơn hàng này đã hoàn thành hoặc đã hủy, không thể thêm món');
    }

    // Lấy thông tin món ăn
    const [dishes] = await db.query('SELECT * FROM monan WHERE id_mon = ? AND tinhtrang = 1', [dishId]);
    if (dishes.length === 0) throw new Error('Không tìm thấy món ăn hoặc món đã ngừng phục vụ');
    const dish = dishes[0];

    const thanhtien = dish.gia_mon * qty;
    await db.query(
      `INSERT INTO hopdong (sesis, id_mon, name_mon, id_user, dates, tg, soluong, noidung, so_user, gia, thanhtien, images, tinhtrang, trangthai_bep)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [sesis, dish.id_mon, dish.name_mon, order.id_user, order.dates, order.tg,
       qty, order.noidung || '', order.so_user || '', dish.gia_mon, thanhtien, dish.images || '', order.tinhtrang]
    );
  },

  /**
   * Thêm nhiều món cùng lúc vào một đơn (dùng cho QR order)
   */
  addMultipleDishesToOrder: async (sesis, items) => {
    const [orderRows] = await db.query(
      'SELECT id_user, dates, tg, noidung, so_user, tinhtrang FROM hopdong WHERE sesis = ? LIMIT 1',
      [sesis]
    );
    if (orderRows.length === 0) throw new Error('Không tìm thấy đơn hàng với mã này');
    const order = orderRows[0];
    if (order.tinhtrang === 3 || order.tinhtrang === 4) {
      throw new Error('Đơn hàng này đã hoàn thành hoặc đã hủy');
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      for (const item of items) {
        const [dishes] = await connection.query('SELECT * FROM monan WHERE id_mon = ? AND tinhtrang = 1', [item.id]);
        if (dishes.length === 0) continue;
        const dish = dishes[0];
        const thanhtien = dish.gia_mon * item.qty;
        await connection.query(
          `INSERT INTO hopdong (sesis, id_mon, name_mon, id_user, dates, tg, soluong, noidung, so_user, gia, thanhtien, images, tinhtrang, trangthai_bep)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [sesis, dish.id_mon, dish.name_mon, order.id_user, order.dates, order.tg,
           item.qty, order.noidung || '', order.so_user || '', dish.gia_mon, thanhtien, dish.images || '', order.tinhtrang]
        );
      }
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  /**
   * Tạo đơn mới cho QR khi chưa có đơn nào (tạo khách vãng lai)
   * // [BẢO VỆ]: Khởi tạo đơn hàng khi quét mã QR (Khách vãng lai)
   */
  createQROrder: async (tableId, tableName) => {
    // Tìm hoặc tạo khách vãng lai cho bàn này
    const guestSdt = 'QR_' + tableId;
    const [existing] = await db.query('SELECT id FROM khach_hang WHERE sodienthoai = ?', [guestSdt]);
    let userId;
    
    // Đảm bảo tên hiển thị đẹp dạng "Bàn X"
    let displayName = tableName;
    if (displayName && !displayName.startsWith('Bàn')) {
      displayName = 'Bàn ' + displayName;
    }

    if (existing.length > 0) {
      userId = existing[0].id;
      // Cập nhật tên của khách vãng lai để luôn đúng với tên bàn
      await db.query('UPDATE khach_hang SET ten = ? WHERE id = ?', [displayName, userId]);
    } else {
      const [res] = await db.query(
        'INSERT INTO khach_hang (ten, sodienthoai, passwords) VALUES (?, ?, ?)',
        [displayName, guestSdt, md5('qr' + tableId)]
      );
      userId = res.insertId;
    }

    const sesis = 'QR_' + tableId + '_' + Date.now().toString(36);
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().slice(0, 5);
    await db.query(
      `INSERT INTO hopdong (sesis, id_mon, name_mon, id_user, dates, tg, soluong, noidung, so_user, gia, thanhtien, images, tinhtrang)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [sesis, 0, 'Đặt qua QR', userId, today, now, 0, 'QR Order - ' + displayName, '', 0, 0, '']
    );
    return sesis;
  },

  // ============ QR TABLE MANAGEMENT ============
  // [BẢO VỆ]: Quản lý mã QR cho bàn (Lấy danh sách, tạo, xóa)
  getAllQRCodes: async () => {
    try {
      const [rows] = await db.query('SELECT * FROM qr_tables ORDER BY created_at DESC');
      return rows;
    } catch (e) {
      // Table may not exist yet
      return [];
    }
  },

  createQRCode: async (tableName, note, baseUrl) => {
    const tableId = 'T' + Date.now().toString(36).toUpperCase();
    const url = baseUrl + '/qr/table/' + tableId + '?name=' + encodeURIComponent(tableName);

    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS qr_tables (
        id INT AUTO_INCREMENT PRIMARY KEY,
        table_id VARCHAR(50) NOT NULL,
        table_name VARCHAR(100) NOT NULL,
        note VARCHAR(255),
        url TEXT,
        active_sesis VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});

    const [result] = await db.query(
      'INSERT INTO qr_tables (table_id, table_name, note, url) VALUES (?, ?, ?, ?)',
      [tableId, tableName, note || '', url]
    );
    return { id: result.insertId, tableId, url };
  },

  deleteQRCode: async (id) => {
    await db.query('DELETE FROM qr_tables WHERE id = ?', [id]);
  }
};

module.exports = orderService;
