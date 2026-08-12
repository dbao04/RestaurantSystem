/**
 * ORDER SERVICE
 * Comprehensive service for managing orders, carts, bookings, and customer accounts
 */

const db = require('../config/db');
const md5 = require('md5');
// Moi don ghi vao `hopdong` phai dien `ngay_dat`/`gio_dat`, xem utils/thoiGian.js.
const {
  chuanHoaNgay, chuanHoaGio, ngayCucBo, gioCucBo, ngayChoMonThem,
} = require('../utils/thoiGian');

/**
 * Mat khau danh dau tai khoan khach vang lai QR la KHONG DANG NHAP DUOC.
 *
 * Tai khoan QR (`sodienthoai` = 'QR_' + tableId) chi ton tai de gan don cua
 * ban vao mot `id_user`, khong bao gio co nguoi that dang nhap bang no. Truoc
 * day mat khau la md5('qr' + tableId) - ma tableId thi in ngay tren ma QR dan
 * o ban, nen ai quet ma cung suy ra duoc.
 *
 * Chuoi nay khong phai 32 ky tu hex nen md5() khong the sinh ra => phep so
 * sanh trong `userLogin` khong bao gio khop.
 *
 * Phai trung voi hang so cung ten trong config/migrations/017_qr_dat_mon.js.
 */
const MAT_KHAU_VO_HIEU = '!QR_KHONG_DANG_NHAP';

/** Tai khoan sinh tu ma QR - khong cho dang nhap. */
function laTaiKhoanQR(sdt) {
  return String(sdt || '').startsWith('QR_');
}

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
        // Mon nuoc uong co the khong co anh (images = NULL) trong khi cot cart.images
        // la NOT NULL -> ep ve chuoi rong de INSERT khong that bai.
        [dishId, sessionId, dish.name_mon, dish.gia_mon, quantity, dish.images || '']
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
    const ngayDat = chuanHoaNgay(date) || ngayCucBo();
    const gioDat = chuanHoaGio(time) || chuanHoaGio(gioCucBo());
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      for (const item of cartItems) {
        const thanhtien = item.gia_mon * item.soluong;
        await connection.query(
          `INSERT INTO hopdong (sesis, id_mon, name_mon, id_user, dates, tg, soluong, noidung, so_user, gia, thanhtien, images, tinhtrang, ngay_dat, gio_dat)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          [uniqueSesis, item.id_mon, item.name_mon, userId, date, time, item.soluong, partyType, numPeople, item.gia_mon, thanhtien, item.images || '', ngayDat, gioDat]
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

  /**
   * Don dat ban cua mot khach, MOI NHAT TRUOC va chia trang.
   *
   * Truy van cu khong co ORDER BY nen MySQL tra ve theo thu tu tuy y - khach vua
   * dat xong vao xem thi don moi nam lan giua danh sach, tuong nhu chua dat
   * duoc. Cung khong co LIMIT: tai khoan lau nam trong CSDL demo co hon 600 don,
   * dung het vao mot trang thi cuon mai khong het ma trinh duyet cung nang.
   *
   * Sap xep theo ngay_dat/gio_dat (cot DATE/TIME that) chu khong theo `dates` -
   * cot do la TEXT luu nguyen chuoi khach gui len nen sap xep chuoi se sai.
   */
  getUserOrders: async (userId, { gioiHan = 20, trang = 1 } = {}) => {
    const soMoiTrang = Math.min(100, Math.max(1, Number(gioiHan) || 20));
    const trangHienTai = Math.max(1, Number(trang) || 1);
    const boQua = (trangHienTai - 1) * soMoiTrang;

    const [[dem]] = await db.query(
      'SELECT COUNT(DISTINCT sesis) AS tong FROM hopdong WHERE id_user = ?', [userId]
    );
    const [rows] = await db.query(
      `SELECT sesis, dates, so_user, noidung, tg, tinhtrang,
              SUM(thanhtien) AS tong_tien,
              MAX(ngay_dat) AS ngay_sap, MAX(gio_dat) AS gio_sap, MAX(id) AS id_cuoi
       FROM hopdong WHERE id_user = ?
       GROUP BY sesis, dates, so_user, noidung, tg, tinhtrang
       ORDER BY ngay_sap DESC, gio_sap DESC, id_cuoi DESC
       LIMIT ? OFFSET ?`,
      [userId, soMoiTrang, boQua]
    );

    const tong = Number(dem.tong || 0);
    return {
      danhSach: rows,
      tong,
      trang: trangHienTai,
      soMoiTrang,
      soTrang: Math.max(1, Math.ceil(tong / soMoiTrang)),
    };
  },

  /**
   * Khach da co it nhat mot don DA XAC NHAN chua - dieu kien de duoc danh gia.
   *
   * Hoi thang CSDL thay vi loc tren danh sach getUserOrders(): danh sach do gio
   * da chia trang, don da xac nhan nam o trang thu ba thi loc kieu cu se ket
   * luan sai la khach chua tung dat.
   */
  coDonDaXacNhan: async (userId) => {
    const [[r]] = await db.query(
      'SELECT COUNT(*) AS n FROM hopdong WHERE id_user = ? AND tinhtrang = 1 LIMIT 1', [userId]
    );
    return Number(r.n || 0) > 0;
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
        `INSERT INTO hopdong (sesis, id_mon, name_mon, id_user, dates, tg, soluong, noidung, so_user, gia, thanhtien, images, tinhtrang, ngay_dat, gio_dat)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [sesis, 0, 'Chưa chọn món', userId, dates, tg, 0, noidung, so_user, 0, 0, '', 0,
         chuanHoaNgay(dates) || ngayCucBo(), chuanHoaGio(tg) || chuanHoaGio(gioCucBo())]
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

  /**
   * @deprecated Dung services/thanhToanService.js thay cho ham nay.
   *
   * Ham nay chi doi trang thai don chu KHONG ghi lai da thu bao nhieu tien,
   * bang hinh thuc gi, ai thu - nen khong the in bien lai, khong doi soat
   * duoc voi sao ke ngan hang, va bao cao doanh thu se khong khop voi tien
   * thuc te. Giu lai de code cu khong vo, khong goi trong luong moi.
   *
   * Thay bang: thanhToanService.taoPhien() -> xacNhan(), hai ham do tu dat
   * tinhtrang = 3 khi (va chi khi) da thu du tien.
   */
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
    // Chan tai khoan sinh tu ma QR ngay tu dau. Day la lop thu hai, doc lap
    // voi viec mat khau da bi vo hieu trong CSDL - de neu sau nay co doan ma
    // nao lo ghi mat khau that vao mot tai khoan QR thi van khong dang nhap
    // duoc. Xem MAT_KHAU_VO_HIEU o dau tep.
    if (laTaiKhoanQR(sdt)) return null;

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
    // ngay_dat/gio_dat/id_ban lấy theo đơn gốc để món thêm sau nằm cùng ca với đơn.
    const [orderRows] = await db.query(
      'SELECT id_user, dates, tg, noidung, so_user, tinhtrang, ngay_dat, gio_dat, id_ban FROM hopdong WHERE sesis = ? LIMIT 1',
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
      `INSERT INTO hopdong (sesis, id_mon, name_mon, id_user, dates, tg, soluong, noidung, so_user, gia, thanhtien, images, tinhtrang, trangthai_bep, ngay_dat, gio_dat, id_ban)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [sesis, dish.id_mon, dish.name_mon, order.id_user, order.dates, order.tg,
       qty, order.noidung || '', order.so_user || '', dish.gia_mon, thanhtien, dish.images || '', order.tinhtrang,
       ngayChoMonThem(order.ngay_dat || order.dates),
       chuanHoaGio(order.gio_dat) || chuanHoaGio(order.tg) || chuanHoaGio(gioCucBo()),
       order.id_ban || null]
    );
  },

  /**
   * Thêm nhiều món cùng lúc vào một đơn (dùng cho QR order)
   */
  addMultipleDishesToOrder: async (sesis, items) => {
    const [orderRows] = await db.query(
      'SELECT id_user, dates, tg, noidung, so_user, tinhtrang, ngay_dat, gio_dat, id_ban FROM hopdong WHERE sesis = ? LIMIT 1',
      [sesis]
    );
    if (orderRows.length === 0) throw new Error('Không tìm thấy đơn hàng với mã này');
    const order = orderRows[0];
    if (order.tinhtrang === 3 || order.tinhtrang === 4) {
      throw new Error('Đơn hàng này đã hoàn thành hoặc đã hủy');
    }

    const ngayDat = ngayChoMonThem(order.ngay_dat || order.dates);
    const gioDat = chuanHoaGio(order.gio_dat) || chuanHoaGio(order.tg) || chuanHoaGio(gioCucBo());

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      for (const item of items) {
        const [dishes] = await connection.query('SELECT * FROM monan WHERE id_mon = ? AND tinhtrang = 1', [item.id]);
        if (dishes.length === 0) continue;
        const dish = dishes[0];
        const thanhtien = dish.gia_mon * item.qty;
        // Ghi chu cua khach cho rieng mon nay. Cat 255 ky tu cho khop do rong
        // cot; bo chuoi rong ve NULL de bep phan biet "khong ghi chu" voi
        // "ghi chu rong".
        const ghiChu = String(item.ghi_chu || '').trim().slice(0, 255) || null;
        await connection.query(
          `INSERT INTO hopdong (sesis, id_mon, name_mon, id_user, dates, tg, soluong, noidung, so_user, gia, thanhtien, images, tinhtrang, trangthai_bep, ngay_dat, gio_dat, id_ban, ghi_chu_mon)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
          [sesis, dish.id_mon, dish.name_mon, order.id_user, order.dates, order.tg,
           item.qty, order.noidung || '', order.so_user || '', dish.gia_mon, thanhtien, dish.images || '', order.tinhtrang,
           ngayDat, gioDat, order.id_ban || null, ghiChu]
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
  /**
   * Tra ve dong `qr_tables` cua mot ma QR, hoac null neu ma khong co that.
   *
   * Day la CUA DUY NHAT de doi ma QR sang thong tin ban. Moi thu khac (ten
   * ban, id ban) deu phai di qua day, khong duoc lay tu tham so nguoi dung
   * gui len - xem ghi chu o `createQROrder`.
   */
  layBanQR: async (tableId) => {
    if (!tableId) return null;
    const [rows] = await db.query(
      'SELECT id, table_id, table_name, active_sesis FROM qr_tables WHERE table_id = ? LIMIT 1',
      [String(tableId)]
    );
    return rows[0] || null;
  },

  /**
   * Phien dang mo cua mot ban QR, hoac null neu ban dang trong.
   *
   * Vi sao can: truoc day trang QR nhan `?sesis=` tu thanh dia chi va
   * `/qr/add-dish` chi kiem tra "sesis nay co ton tai trong hopdong khong".
   * Nghia la neu doan/biet duoc ma phien cua ban khac (dinh dang
   * `QR_<tableId>_<thoi diem base36>`, ma tableId thi in tren ma QR) thi goi
   * duoc mon vao hoa don ban do. Gio ma phien luon do may chu tu tra theo
   * ban, khong lay tu client nua.
   *
   * Dieu kien "dang mo" dung dung dinh nghia cua man hinh bep
   * (`kdsService.DON_DANG_HOAT_DONG`) de hai noi khong lech nhau.
   */
  phienDangMoCuaBan: async (tableId) => {
    const ban = await orderService.layBanQR(tableId);
    if (!ban) return null;
    const idBan = await orderService.timIdBanTheoTen(ban.table_name);
    if (!idBan) return null;
    const [rows] = await db.query(
      `SELECT sesis FROM hopdong
       WHERE id_ban = ? AND tinhtrang IN (1, 5, 6) AND ngay_dat = CURDATE()
       ORDER BY id DESC LIMIT 1`,
      [idBan]
    );
    return rows.length ? rows[0].sesis : null;
  },

  /**
   * Cac mon ma mot ban QR da goi trong phien dang mo, kem trang thai bep.
   *
   * Dung cho buoc "Bep che bien" o trang dat mon: khach thay mon minh goi dang
   * o dau (cho / dang nau / xong / da mang ra) thay vi phai hoi nhan vien.
   *
   * Nhan `tableId` chu khong nhan `sesis`: ma phien phai do may chu tra theo
   * ban, dung nguyen tac cua `phienDangMoCuaBan` - neu nhan sesis tu client
   * thi doan duoc ma phien ban khac la xem duoc don cua ho.
   */
  donCuaBanQR: async (tableId) => {
    const sesis = await orderService.phienDangMoCuaBan(tableId);
    if (!sesis) return { sesis: null, mon: [], tam_tinh: 0 };
    const [rows] = await db.query(
      `SELECT id, id_mon, name_mon, soluong, gia, thanhtien, images,
              trangthai_bep, ghi_chu_mon, gio_dat
       FROM hopdong
       WHERE sesis = ? AND id_mon > 0
       ORDER BY id ASC`,
      [sesis]
    );
    const tamTinh = rows.reduce((s, r) => s + Number(r.thanhtien || 0), 0);
    return { sesis, mon: rows, tam_tinh: tamTinh };
  },

  /**
   * Tao don moi cho mot ban quet QR.
   *
   * KHONG nhan ten ban tu ben ngoai. Truoc day ham nay nhan `tableName` do
   * `server.js` lay tu `req.query.name || req.body.tableName`, tuc la do CHINH
   * KHACH gui len. Khach chi can sua thanh dia chi thanh `?name=12` la don
   * duoc gan sang ban 12: mon ra nham ban va ban 12 bi danh dau dang phuc vu
   * bang phien cua nguoi khac. Gio ten ban luon tra tu `qr_tables`.
   */
  createQROrder: async (tableId) => {
    const ban = await orderService.layBanQR(tableId);
    if (!ban) throw new Error('Mã bàn không hợp lệ');
    const tableName = ban.table_name;

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
        [displayName, guestSdt, MAT_KHAU_VO_HIEU]
      );
      userId = res.insertId;
    }

    const sesis = 'QR_' + tableId + '_' + Date.now().toString(36);
    // Ngay gio theo mui gio may chu (khong dung toISOString - xem utils/thoiGian.js).
    const today = ngayCucBo();
    const now = gioCucBo();

    // Noi don QR voi ban that de man hinh bep biet mon nay cua ban nao.
    const idBan = await orderService.timIdBanTheoTen(tableName);

    await db.query(
      `INSERT INTO hopdong (sesis, id_mon, name_mon, id_user, dates, tg, soluong, noidung, so_user, gia, thanhtien, images, tinhtrang, ngay_dat, gio_dat, id_ban)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [sesis, 0, 'Đặt qua QR', userId, today, now, 0, 'QR Order - ' + displayName, '', 0, 0, '',
       today, chuanHoaGio(now), idBan]
    );

    // Ban co khach -> so do ban chuyen sang "dang phuc vu".
    if (idBan) {
      await db.query(
        'UPDATE ban SET trangthai = 1, sesis_hien_tai = ? WHERE Id_ban = ?',
        [sesis, idBan]
      );
    }
    return sesis;
  },

  /**
   * Bao dam mot phien QR duoc noi voi ban that.
   *
   * Phien tao truoc khi co cot `id_ban` se de trong o do, man hinh bep khong
   * biet mon cua ban nao. Ham nay va lai lien ket truoc khi them mon moi.
   */
  lienKetPhienVoiBan: async (sesis, tableId) => {
    const [daCo] = await db.query(
      'SELECT id_ban FROM hopdong WHERE sesis = ? AND id_ban IS NOT NULL LIMIT 1',
      [sesis]
    );
    // Nhan MA QR chu khong nhan ten ban, vi ten ban do client gui len thi sua
    // duoc - xem ghi chu o `createQROrder`.
    let idBan = daCo.length ? daCo[0].id_ban : null;
    if (!idBan) {
      const ban = await orderService.layBanQR(tableId);
      idBan = ban ? await orderService.timIdBanTheoTen(ban.table_name) : null;
    }
    if (!idBan) return null;

    await db.query('UPDATE hopdong SET id_ban = ? WHERE sesis = ? AND id_ban IS NULL', [idBan, sesis]);
    await db.query(
      'UPDATE ban SET trangthai = 1, sesis_hien_tai = ? WHERE Id_ban = ?',
      [sesis, idBan]
    );
    return idBan;
  },

  /**
   * Doi ten ban tren ma QR ('5', 'Bàn 5', 'Vip1') sang `ban.Id_ban`.
   *
   * `qr_tables` khong co khoa ngoai sang `ban` nen phai do theo ten. Ten ban
   * trong bang `ban` luu dang '01'..'05' con QR thuong ghi '1'..'5', vi vay
   * ngoai so sanh nguyen van con so sanh theo gia tri so. Khong khop thi tra
   * ve null - don van vao bep, chi la khong hien so ban.
   */
  timIdBanTheoTen: async (tenBan) => {
    const ten = String(tenBan || '').replace(/^\s*bàn\s*/i, '').trim();
    if (!ten) return null;
    const [rows] = await db.query(
      `SELECT Id_ban FROM ban
       WHERE number_ban = ?
          OR (? REGEXP '^[0-9]+$' AND number_ban REGEXP '^[0-9]+$'
              AND CAST(number_ban AS UNSIGNED) = CAST(? AS UNSIGNED))
       LIMIT 1`,
      [ten, ten, ten]
    );
    return rows.length ? rows[0].Id_ban : null;
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
    // Khong gan `?name=` nua: may chu tra ten ban tu `qr_tables` theo `table_id`,
    // tham so nay bi bo qua. Cac ma QR da in truoc day con mang `?name=` van
    // chay binh thuong, chi la phan thua. Xem ghi chu o server.js muc QR.
    const url = baseUrl + '/qr/table/' + tableId;

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
