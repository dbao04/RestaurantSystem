/**
 * PERSONNEL SERVICE
 * Consolidates admin, staff, and menu management operations
 * This service aggregates functions from admin and staff management
 */

const db = require('../config/db');
const md5 = require('md5');

const personnelService = {
  // ============ ADMIN LOGIN & PROFILE ============
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

  // ============ STAFF LOGIN & MANAGEMENT ============
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
    // Soft delete: set status to 0 (Đã nghỉ) instead of hard deleting to preserve historical data
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

  // ============ DASHBOARD & STATS ============
  getDashboardStats: async () => {
    const [rev1] = await db.query('SELECT SUM(thanhtien) as total FROM hopdong WHERE tinhtrang = 3');
    const [rev2] = await db.query('SELECT SUM(tong_tien) as total FROM chot_ca');
    const [orders] = await db.query('SELECT COUNT(DISTINCT sesis) as total FROM hopdong');
    const [customers] = await db.query('SELECT COUNT(*) as total FROM khach_hang');
    const [staff] = await db.query('SELECT COUNT(*) as total FROM nhan_vien');
    
    return {
      revenue: Number(rev1[0].total || 0) + Number(rev2[0].total || 0),
      orders: orders[0].total || 0,
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

  // ============ CATEGORIES MANAGEMENT ============
  getAllCategories: async () => {
    const [rows] = await db.query('SELECT * FROM loai_mon ORDER BY id_loai DESC');
    return rows;
  },

  getCategoryById: async (id) => {
    const [rows] = await db.query('SELECT * FROM loai_mon WHERE id_loai = ?', [id]);
    return rows[0] || null;
  },

  addCategory: async (name_loai, ghichu) => {
    await db.query(
      'INSERT INTO loai_mon (name_loai, ghichu) VALUES (?, ?)',
      [name_loai, ghichu]
    );
  },

  updateCategory: async (id, name_loai, ghichu) => {
    await db.query(
      'UPDATE loai_mon SET name_loai = ?, ghichu = ? WHERE id_loai = ?',
      [name_loai, ghichu, id]
    );
  },

  deleteCategory: async (id) => {
    await db.query('DELETE FROM loai_mon WHERE id_loai = ?', [id]);
  },

  // ============ PRODUCTS/DISHES MANAGEMENT ============
  getAllProducts: async () => {
    const [rows] = await db.query('SELECT * FROM monan');
    return rows;
  },

  getProductById: async (id) => {
    const [rows] = await db.query('SELECT * FROM monan WHERE id_mon = ?', [id]);
    return rows[0] || null;
  },

  addProduct: async (data) => {
    const { name, categoryId, note, price, image } = data;
    await db.query(
      'INSERT INTO monan (name_mon, id_loai, ghichu_mon, gia_mon, images) VALUES (?, ?, ?, ?, ?)',
      [name, categoryId, note, price, image]
    );
  },

  updateProduct: async (id, data) => {
    const { name, categoryId, note, price, image, tinhtrang } = data;
    if (image) {
      await db.query(
        'UPDATE monan SET name_mon = ?, id_loai = ?, ghichu_mon = ?, gia_mon = ?, images = ?, tinhtrang = ? WHERE id_mon = ?',
        [name, categoryId, note, price, image, tinhtrang || 1, id]
      );
    } else {
      await db.query(
        'UPDATE monan SET name_mon = ?, id_loai = ?, ghichu_mon = ?, gia_mon = ?, tinhtrang = ? WHERE id_mon = ?',
        [name, categoryId, note, price, tinhtrang || 1, id]
      );
    }
  },

  deleteProduct: async (id) => {
    await db.query('DELETE FROM monan WHERE id_mon = ?', [id]);
  },

  // ============ CONTRACTS/ORDERS MANAGEMENT ============
  getAllContracts: async () => {
    const [rows] = await db.query(`
      SELECT h.sesis, h.dates, COALESCE(k.ten, 'Khách vãng lai') AS ten, k.sodienthoai, h.so_user, h.noidung, h.tg, h.tinhtrang, SUM(h.thanhtien) as tong_tien
      FROM hopdong h
      LEFT JOIN khach_hang k ON h.id_user = k.id
      GROUP BY h.sesis, h.dates, k.ten, k.sodienthoai, h.so_user, h.noidung, h.tg, h.tinhtrang
      ORDER BY h.dates DESC, h.tg DESC
    `);
    return rows;
  },

  /**
   * Danh sach hop dong co phan trang phia may chu.
   * Bang `hopdong` co hang chuc nghin dong (moi mon an mot dong), doi hoi
   * LIMIT/OFFSET tren truy van da GROUP BY - khong duoc tai het roi cat o view.
   * @param {object} opts
   * @param {number} opts.page    trang hien tai, bat dau tu 1
   * @param {number} opts.limit   so hop dong moi trang
   * @param {string} opts.keyword loc theo ten khach hoac noi dung (tuy chon)
   * @param {string} opts.status  '0' | '1' de loc trang thai (tuy chon)
   * @returns {Promise<{rows: object[], total: number}>}
   */
  getContractsPaged: async ({ page = 1, limit = 25, keyword = '', status = '' } = {}) => {
    const soTrang = Math.max(1, parseInt(page, 10) || 1);
    const moiTrang = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));
    const offset = (soTrang - 1) * moiTrang;

    const dieuKien = [];
    const thamSo = [];
    if (keyword) {
      dieuKien.push('(k.ten LIKE ? OR h.noidung LIKE ?)');
      thamSo.push('%' + keyword + '%', '%' + keyword + '%');
    }
    if (status !== '' && status !== null && status !== undefined && !isNaN(Number(status))) {
      dieuKien.push('h.tinhtrang = ?');
      thamSo.push(Number(status));
    }
    const menhDeWhere = dieuKien.length ? 'WHERE ' + dieuKien.join(' AND ') : '';
    // Chi noi bang khach_hang khi that su can loc theo ten khach - phep JOIN
    // tren 80k dong la phan dat nhat cua truy van.
    const menhDeJoin = keyword ? 'LEFT JOIN khach_hang k ON h.id_user = k.id' : '';

    const [dem] = await db.query(`
      SELECT COUNT(DISTINCT h.sesis) AS total
      FROM hopdong h
      ${menhDeJoin}
      ${menhDeWhere}
    `, thamSo);

    // Buoc 1: chi lay ma hop dong (`sesis`) cua dung trang dang xem. Gom theo
    // mot cot duy nhat va khong JOIN nen MySQL dung duoc idx_hopdong_sesis;
    // gom theo cac cot TEXT (`dates`, `tg`) se buoc no tao bang tam rat cham.
    // Cot `dates` co dang 'YYYY-MM-DD' nen sap xep chuoi van dung thu tu ngay.
    const [ma] = await db.query(`
      SELECT h.sesis
      FROM hopdong h
      ${menhDeJoin}
      ${menhDeWhere}
      GROUP BY h.sesis
      ORDER BY MAX(h.dates) DESC, MAX(h.tg) DESC
      LIMIT ? OFFSET ?
    `, [...thamSo, moiTrang, offset]);

    if (ma.length === 0) {
      return { rows: [], total: dem[0].total, page: soTrang, limit: moiTrang };
    }

    // Buoc 2: tong hop chi tiet cho dung so hop dong cua trang nay.
    const danhSachMa = ma.map(r => r.sesis);
    const [rows] = await db.query(`
      SELECT h.sesis,
             MAX(h.dates) AS dates,
             COALESCE(MAX(k.ten), 'Khách vãng lai') AS ten,
             MAX(k.sodienthoai) AS sodienthoai,
             MAX(h.so_user) AS so_user,
             MAX(h.noidung) AS noidung,
             MAX(h.tg) AS tg,
             MAX(h.tinhtrang) AS tinhtrang,
             SUM(h.thanhtien) AS tong_tien
      FROM hopdong h
      LEFT JOIN khach_hang k ON h.id_user = k.id
      WHERE h.sesis IN (?)
      GROUP BY h.sesis
      ORDER BY dates DESC, tg DESC
    `, [danhSachMa]);

    return { rows, total: dem[0].total, page: soTrang, limit: moiTrang };
  },

  /** Chi lay hop dong chua xac nhan - dung cho trang "Hop dong moi". */
  getPendingContracts: async () => {
    const [rows] = await db.query(`
      SELECT h.sesis,
             MAX(h.dates) AS dates,
             COALESCE(MAX(k.ten), 'Khách vãng lai') AS ten,
             MAX(k.sodienthoai) AS sodienthoai,
             MAX(h.so_user) AS so_user,
             MAX(h.noidung) AS noidung,
             MAX(h.tg) AS tg,
             MAX(h.tinhtrang) AS tinhtrang,
             SUM(h.thanhtien) AS tong_tien
      FROM hopdong h
      LEFT JOIN khach_hang k ON h.id_user = k.id
      WHERE h.tinhtrang = 0
      GROUP BY h.sesis
      ORDER BY dates DESC, tg DESC
    `);
    return rows;
  },

  updateContractStatus: async (sesis, status) => {
    await db.query('UPDATE hopdong SET tinhtrang = ? WHERE sesis = ?', [status, sesis]);
  },

  deleteContract: async (id) => {
    await db.query('DELETE FROM hopdong WHERE sesis = ?', [id]);
  },

  // ============ SCHEDULE MANAGEMENT ============
  //
  // TRANG THAI 3 = BAN NHAP cua man hinh xep ca tu dong (/admin/xep-ca), la ket
  // qua may vua xep ma quan ly con dang sua. Moi truy van o day deu loai no ra:
  //   - Nhan vien khong duoc thay ca chua chot roi sap xep cuoc song ca nhan
  //     theo, den luc quan ly doi lai thi thanh that hua.
  //   - Trang /admin/schedule la noi duyet DON DANG KY cua nhan vien; do ban
  //     nhap vao do thi mot tuan may xep se do hang chuc dong khong phai don,
  //     lam chim mat vai don that dang cho duyet.
  // Bam "Chot" tren man hinh xep ca thi 3 doi thanh 1 va cac dong do hien ra o
  // day binh thuong.
  getAllSchedules: async () => {
    const [rows] = await db.query(`
      SELECT l.*, n.ten AS ten_nhanvien, n.chucvu
      FROM lich_lam_viec l
      JOIN nhan_vien n ON l.id_nv = n.id_nv
      WHERE l.trangthai <> 3
      ORDER BY l.ngay DESC
    `);
    return rows;
  },

  getSchedule: async (staffId, year, month) => {
    let query, params = [];
    
    // `l.trangthai <> 3`: bo ban nhap cua man hinh xep ca - xem ghi chu o
    // `getAllSchedules` ngay phia tren.
    if (staffId) {
      query = `
        SELECT l.*, n.ten AS ten_nhanvien, n.chucvu
        FROM lich_lam_viec l
        JOIN nhan_vien n ON l.id_nv = n.id_nv
        WHERE l.id_nv = ? AND YEAR(l.ngay) = ? AND MONTH(l.ngay) = ?
          AND l.trangthai <> 3
        ORDER BY l.ngay ASC`;
      params = [staffId, year, month];
    } else {
      query = `
        SELECT l.*, n.ten AS ten_nhanvien, n.chucvu
        FROM lich_lam_viec l
        JOIN nhan_vien n ON l.id_nv = n.id_nv
        WHERE YEAR(l.ngay) = ? AND MONTH(l.ngay) = ?
          AND l.trangthai <> 3
        ORDER BY l.ngay ASC`;
      params = [year, month];
    }
    
    const [rows] = await db.query(query, params);
    return rows;
  },

  registerSchedule: async (staffId, ngay, ca, ghi_chu) => {
    let gio_bat_dau = null, gio_ket_thuc = null;
    if (ca === 'sang') { gio_bat_dau = '07:00:00'; gio_ket_thuc = '12:00:00'; }
    else if (ca === 'chieu') { gio_bat_dau = '12:00:00'; gio_ket_thuc = '17:00:00'; }
    else if (ca === 'toi') { gio_bat_dau = '17:00:00'; gio_ket_thuc = '21:00:00'; }

    await db.query(
      'INSERT INTO lich_lam_viec (id_nv, ngay, ca, gio_bat_dau, gio_ket_thuc, ghi_chu, trangthai) VALUES (?, ?, ?, ?, ?, ?, 0)',
      [staffId, ngay, ca, gio_bat_dau, gio_ket_thuc, ghi_chu]
    );
  },

  /**
   * Nhan vien huy dang ky ca cua chinh minh.
   *
   * Chi huy duoc dong do CHINH HO dang ky (`nguon = 'dang_ky'`) va con dang
   * cho duyet. Truoc day cau lenh chi loc theo `id_nv`, nghia la nhan vien vao
   * /staff/schedule bam Huy la xoa duoc ca QUAN LY DA PHAN cho minh - lich cua
   * ca nha hang thung mot lo ma khong ai hay, vi khong co gi ghi lai viec xoa.
   * Muon nghi ca da duoc phan thi phai qua duong don nghi phep.
   */
  cancelSchedule: async (scheduleId, staffId) => {
    const [rows] = await db.query(
      'SELECT * FROM lich_lam_viec WHERE id_lich = ? AND id_nv = ?',
      [scheduleId, staffId]
    );
    if (!rows[0]) throw new Error('Không tìm thấy lịch làm việc');
    if (rows[0].nguon && rows[0].nguon !== 'dang_ky') {
      throw new Error('Ca này do quản lý phân, không tự huỷ được. Hãy nộp đơn nghỉ phép.');
    }
    if (Number(rows[0].trangthai) === 1) {
      throw new Error('Ca này đã được duyệt, không tự huỷ được. Hãy nộp đơn nghỉ phép.');
    }
    await db.query('DELETE FROM lich_lam_viec WHERE id_lich = ?', [scheduleId]);
  },

  updateScheduleStatus: async (id, status) => {
    await db.query('UPDATE lich_lam_viec SET trangthai = ? WHERE id_lich = ?', [status, id]);
  },

  // ============ SALARY MANAGEMENT ============
  getDetailedAttendanceReport: async (month, year) => {
    const [rows] = await db.query(`
      SELECT c.ngay, c.gio_vao, c.gio_ra, c.tong_gio, n.ten, n.chucvu
      FROM cham_cong c
      JOIN nhan_vien n ON c.id_nv = n.id_nv
      WHERE MONTH(c.ngay) = ? AND YEAR(c.ngay) = ?
      ORDER BY c.ngay DESC, n.ten ASC
    `, [month, year]);
    return rows;
  },

  // [BẢO VỆ]: Truy xuất bảng lương nhân viên
  getSalaryList: async (month, year) => {
    const [rows] = await db.query(`
      SELECT l.*, n.ten, n.chucvu, 
      (SELECT COUNT(DISTINCT ngay) FROM cham_cong WHERE id_nv = l.id_nv AND MONTH(ngay) = ? AND YEAR(ngay) = ?) as songaycong
      FROM luong l 
      JOIN nhan_vien n ON l.id_nv = n.id_nv 
      WHERE l.thang = ? AND l.nam = ? 
      ORDER BY l.id_luong DESC
    `, [month, year, month, year]);
    return rows;
  },

  // [BẢO VỆ]: Tính toán và lưu bảng lương (Cộng lương cứng, thưởng, phụ cấp)
  upsertSalary: async (data) => {
    const { id_nv, luong_cung, thuong, phu_cap, thang, nam } = data;
    const thanhtien = Number(luong_cung) + Number(thuong) + Number(phu_cap);
    
    const [existing] = await db.query(
      'SELECT * FROM luong WHERE id_nv = ? AND thang = ? AND nam = ?',
      [id_nv, thang, nam]
    );
    
    if (existing.length > 0) {
      await db.query(
        'UPDATE luong SET luong_cung = ?, thuong = ?, phu_cap = ?, tong_luong = ? WHERE id_nv = ? AND thang = ? AND nam = ?',
        [luong_cung, thuong, phu_cap, thanhtien, id_nv, thang, nam]
      );
    } else {
      await db.query(
        'INSERT INTO luong (id_nv, luong_cung, thuong, phu_cap, tong_luong, thang, nam, trang_thai) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
        [id_nv, luong_cung, thuong, phu_cap, thanhtien, thang, nam]
      );
    }
  },

  getPendingSalaries: async () => {
    const [rows] = await db.query(`
      SELECT l.*, n.ten, n.chucvu 
      FROM luong l 
      JOIN nhan_vien n ON l.id_nv = n.id_nv 
      WHERE l.trang_thai = 1 
      ORDER BY l.nam DESC, l.thang DESC
    `);
    return rows;
  },

  updateSalaryStatus: async (id, status) => {
    await db.query('UPDATE luong SET trang_thai = ? WHERE id_luong = ?', [status, id]);
  },

  submitSalaryForApproval: async (id) => {
    await db.query('UPDATE luong SET trang_thai = 1 WHERE id_luong = ?', [id]);
  },

  // [BẢO VỆ]: Duyệt chi trả lương
  paySalary: async (id) => {
    await db.query('UPDATE luong SET trang_thai = 3 WHERE id_luong = ?', [id]);
  },

  // ============ FINANCIAL REPORTS ============
  getFinancialReport: async (month, year) => {
    try {
      // 1. Revenue from hopdong (Paid) + chot_ca (Shift Closing)
      const [revResult] = await db.query(`
        SELECT SUM(amount) as total FROM (
          SELECT thanhtien as amount FROM hopdong 
          WHERE tinhtrang = 3 
          AND MONTH(COALESCE(
            STR_TO_DATE(dates, '%Y-%m-%d'), 
            STR_TO_DATE(dates, '%m/%d/%Y'),
            STR_TO_DATE(dates, '%c/%e/%Y')
          )) = ?
          AND YEAR(COALESCE(
            STR_TO_DATE(dates, '%Y-%m-%d'), 
            STR_TO_DATE(dates, '%m/%d/%Y'),
            STR_TO_DATE(dates, '%c/%e/%Y')
          )) = ?
          UNION ALL
          SELECT tong_tien as amount FROM chot_ca
          WHERE MONTH(ngay) = ? AND YEAR(ngay) = ?
        ) as combined_revenue`,
        [month, year, month, year]
      );
      
      // 2. Inventory Costs from nhap_kho
      const [invResult] = await db.query(
        'SELECT SUM(so_luong * gia_nhap) as total FROM nhap_kho WHERE MONTH(ngay_nhap) = ? AND YEAR(ngay_nhap) = ?',
        [month, year]
      );
      
      // 3. Salary Costs from luong (Processed)
      const [salResult] = await db.query(
        'SELECT SUM(tong_luong) as total FROM luong WHERE trang_thai >= 2 AND thang = ? AND nam = ?',
        [month, year]
      );
      
      // 4. Other Expenses from chi_phi_khac
      const [othResult] = await db.query(
        'SELECT SUM(so_tien) as total FROM chi_phi_khac WHERE MONTH(ngay) = ? AND YEAR(ngay) = ?',
        [month, year]
      );
      
      const revenue = Number(revResult[0]?.total || 0);
      const inventoryCosts = Number(invResult[0]?.total || 0);
      const salaryCosts = Number(salResult[0]?.total || 0);
      const otherExpenses = Number(othResult[0]?.total || 0);
      
      return {
        revenue,
        inventoryCosts,
        salaryCosts,
        otherExpenses,
        netProfit: revenue - (inventoryCosts + salaryCosts + otherExpenses)
      };
    } catch (err) {
      console.error('Error calculating financial report:', err);
      throw err;
    }
  },

  getAllExpenses: async () => {
    const [rows] = await db.query('SELECT * FROM chi_phi_khac ORDER BY ngay DESC');
    return rows;
  },

  addExpense: async (data) => {
    const { ly_do, so_tien, ngay, ghi_chu } = data;
    const combinedNotes = `${ly_do}${ghi_chu ? ' - ' + ghi_chu : ''}`;
    await db.query(
      'INSERT INTO chi_phi_khac (ghi_chu, so_tien, ngay) VALUES (?, ?, ?)',
      [combinedNotes, so_tien, ngay || new Date()]
    );
  },

  deleteExpense: async (id) => {
    await db.query('DELETE FROM chi_phi_khac WHERE id_chi = ?', [id]);
  },

  // ============ ATTENDANCE MANAGEMENT ============
  getAttendance: async (staffId, year, month) => {
    const [rows] = await db.query(
      'SELECT * FROM cham_cong WHERE id_nv = ? AND YEAR(ngay) = ? AND MONTH(ngay) = ? ORDER BY ngay DESC',
      [staffId, year, month]
    );
    return rows;
  },

  getDailyAttendance: async (date) => {
    const [rows] = await db.query(
      'SELECT c.*, n.ten FROM cham_cong c JOIN nhan_vien n ON c.id_nv = n.id_nv WHERE DATE(c.ngay) = ? ORDER BY c.gio_vao ASC',
      [date]
    );
    return rows;
  },

  getMonthlyAttendanceSummary: async (month, year) => {
    const [rows] = await db.query(`
      SELECT 
        n.id_nv,
        n.ten,
        COUNT(DISTINCT c.ngay) as days_worked,
        SUM(CASE WHEN c.gio_vao IS NOT NULL AND c.gio_ra IS NOT NULL THEN TIMESTAMPDIFF(HOUR, c.gio_vao, c.gio_ra) ELSE 0 END) as total_hours
      FROM nhan_vien n
      LEFT JOIN cham_cong c ON n.id_nv = c.id_nv AND MONTH(c.ngay) = ? AND YEAR(c.ngay) = ?
      GROUP BY n.id_nv, n.ten
      ORDER BY n.ten ASC
    `, [month, year]);
    return rows;
  },

  // clockIn / clockOut DA GO BO cung voi hai route /staff/clock-in va
  // /staff/clock-out. Chung ghi thang vao bang cham_cong chi dua tren phien dang
  // nhap, khong co bat ky bang chung nao la nguoi do co mat that - dung duong
  // nay thi cham cong khuon mat khong con y nghia.
  //
  // Ghi cham cong gio nam gon trong services/faceService.js: ghiChamCong() chi
  // duoc goi sau khi da qua kiem tra anh song, so khop khuon mat va doi chieu
  // GPS. Moi lan deu de lai dau vet trong nhat_ky_nhan_dien + cham_cong_gps.

  // ============ LEAVE REQUEST MANAGEMENT ============
  getAllLeaveRequests: async () => {
    const [rows] = await db.query(`
      SELECT np.*, n.ten AS ten_nhanvien, n.chucvu 
      FROM nghi_phep np 
      JOIN nhan_vien n ON np.id_nv = n.id_nv 
      ORDER BY np.ngay_bat_dau DESC
    `);
    return rows;
  },

  addLeaveRequest: async (staffId, lyDo, ngayBatDau, ngayKetThuc) => {
    await db.query(
      'INSERT INTO nghi_phep (id_nv, ly_do, ngay_bat_dau, ngay_ket_thuc, trang_thai) VALUES (?, ?, ?, ?, 0)',
      [staffId, lyDo, ngayBatDau, ngayKetThuc]
    );
  },

  updateLeaveStatus: async (id, status) => {
    await db.query('UPDATE nghi_phep SET trang_thai = ? WHERE id_np = ?', [status, id]);
  },

  getMyLeaveRequests: async (staffId) => {
    const [rows] = await db.query(
      'SELECT * FROM nghi_phep WHERE id_nv = ? ORDER BY ngay_bat_dau DESC',
      [staffId]
    );
    return rows;
  },

  // ============ BLOG/POSTS MANAGEMENT ============
  getAllPosts: async () => {
    const [rows] = await db.query('SELECT * FROM bai_viet ORDER BY created_at DESC');
    return rows;
  },

  getPostById: async (id) => {
    const [rows] = await db.query('SELECT * FROM bai_viet WHERE id_bv = ?', [id]);
    return rows[0] || null;
  },

  addPost: async (data) => {
    const { tieu_de, noi_dung, hinh_anh } = data;
    await db.query(
      'INSERT INTO bai_viet (tieu_de, noi_dung, hinh_anh, created_at) VALUES (?, ?, ?, NOW())',
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
  },

  // ============ NOTIFICATIONS ============
  getNotifications: async (staffId) => {
    const [rows] = await db.query(
      'SELECT * FROM thong_bao WHERE (id_nv = ? OR id_nv IS NULL) ORDER BY created_at DESC',
      [staffId]
    );
    return rows;
  },

  countUnread: async (staffId) => {
    const [rows] = await db.query(
      'SELECT COUNT(*) as count FROM thong_bao WHERE (id_nv = ? OR id_nv IS NULL) AND da_doc = 0',
      [staffId]
    );
    return rows[0].count || 0;
  },

  markNotificationRead: async (notificationId) => {
    await db.query('UPDATE thong_bao SET da_doc = 1 WHERE id = ?', [notificationId]);
  }
};

module.exports = personnelService;
