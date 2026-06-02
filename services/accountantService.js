const db = require('../config/db');

const accountantService = {
  getAttendance: async (id, year, month) => {
    let query = `SELECT * FROM cham_cong WHERE id_nv = ?`;
    const params = [id];
    if (year && month) {
      query += ` AND YEAR(ngay) = ? AND MONTH(ngay) = ?`;
      params.push(year, month);
    }
    query += ` ORDER BY ngay DESC`;
    const [rows] = await db.query(query, params);
    return rows;
  },

  clockIn: async (id) => {
    const today = new Date().toISOString().slice(0, 10);
    const [existing] = await db.query(
      'SELECT * FROM cham_cong WHERE id_nv = ? AND ngay = ?',
      [id, today]
    );
    if (existing.length > 0) {
      if (existing[0].gio_vao) throw new Error('Bạn đã chấm công vào hôm nay rồi!');
      await db.query('UPDATE cham_cong SET gio_vao = NOW() WHERE id_nv = ? AND ngay = ?', [id, today]);
    } else {
      await db.query(
        'INSERT INTO cham_cong (id_nv, ngay, gio_vao) VALUES (?, ?, NOW())',
        [id, today]
      );
    }
  },

  clockOut: async (id) => {
    const today = new Date().toISOString().slice(0, 10);
    const [existing] = await db.query(
      'SELECT * FROM cham_cong WHERE id_nv = ? AND ngay = ?',
      [id, today]
    );
    if (!existing[0] || !existing[0].gio_vao) throw new Error('Bạn chưa chấm công vào!');
    if (existing[0].gio_ra) throw new Error('Bạn đã chấm công ra hôm nay rồi!');
    await db.query(
      `UPDATE cham_cong SET gio_ra = NOW(),
        tong_gio = ROUND(TIMESTAMPDIFF(MINUTE, gio_vao, NOW())/60, 2)
       WHERE id_nv = ? AND ngay = ?`,
      [id, today]
    );
  },

  getDailyAttendance: async (date) => {
    const [rows] = await db.query(`
      SELECT n.id_nv, n.ten, n.chucvu, c.gio_vao, c.gio_ra
      FROM nhan_vien n 
      LEFT JOIN cham_cong c ON n.id_nv = c.id_nv AND c.ngay = ?
      WHERE n.trangthai = 1
      ORDER BY n.ten ASC
    `, [date]);
    return rows;
  },

  getMonthlyAttendanceSummary: async (month, year) => {
    const [rows] = await db.query(`
      SELECT n.id_nv, n.ten, n.chucvu, COUNT(DISTINCT c.ngay) as total_days 
      FROM nhan_vien n 
      LEFT JOIN cham_cong c ON n.id_nv = c.id_nv 
        AND MONTH(c.ngay) = ? AND YEAR(c.ngay) = ?
      WHERE n.trangthai = 1
      GROUP BY n.id_nv, n.ten, n.chucvu
      ORDER BY n.ten ASC
    `, [month, year]);
    return rows;
  },

  getMyLeaveRequests: async (idNv) => {
    const [rows] = await db.query(
      'SELECT * FROM nghi_phep WHERE id_nv = ? ORDER BY created_at DESC',
      [idNv]
    );
    return rows;
  },

  getAllLeaveRequests: async () => {
    const [rows] = await db.query(`
      SELECT n.*, nv.ten as ten_nhanvien, nv.chucvu 
      FROM nghi_phep n 
      JOIN nhan_vien nv ON n.id_nv = nv.id_nv 
      ORDER BY n.created_at DESC
    `);
    return rows;
  },

  updateLeaveStatus: async (id, status) => {
    await db.query('UPDATE nghi_phep SET trang_thai = ? WHERE id_np = ?', [status, id]);
  },

  addLeaveRequest: async (id_nv, ly_do, ngay_bat_dau, ngay_ket_thuc) => {
    await db.query(
      'INSERT INTO nghi_phep (id_nv, ly_do, ngay_bat_dau, ngay_ket_thuc, trang_thai) VALUES (?, ?, ?, ?, 0)',
      [id_nv, ly_do, ngay_bat_dau, ngay_ket_thuc]
    );
  },

  getSalaryList: async (month, year) => {
    let query = `
      SELECT l.*, n.ten, n.chucvu, (
        SELECT COUNT(DISTINCT ngay) FROM cham_cong 
        WHERE id_nv = l.id_nv AND MONTH(ngay) = l.thang AND YEAR(ngay) = l.nam
      ) as songaycong
      FROM luong l 
      JOIN nhan_vien n ON l.id_nv = n.id_nv
    `;
    const params = [];
    if (month && year) {
      query += " WHERE l.thang = ? AND l.nam = ?";
      params.push(month, year);
    }
    query += " ORDER BY l.nam DESC, l.thang DESC, n.ten ASC";
    const [rows] = await db.query(query, params);
    return rows;
  },

  upsertSalary: async (data) => {
    const { id_nv, thang, nam, luong_cung, thuong, phu_cap } = data;
    const tong_luong = parseFloat(luong_cung) + parseFloat(thuong) + parseFloat(phu_cap);
    const [existing] = await db.query(
      "SELECT id_luong FROM luong WHERE id_nv = ? AND thang = ? AND nam = ?",
      [id_nv, thang, nam]
    );
    if (existing.length > 0) {
      await db.query(
        "UPDATE luong SET luong_cung = ?, thuong = ?, phu_cap = ?, tong_luong = ?, trang_thai = 0 WHERE id_luong = ?",
        [luong_cung, thuong, phu_cap, tong_luong, existing[0].id_luong]
      );
    } else {
      await db.query(
        "INSERT INTO luong (id_nv, thang, nam, luong_cung, thuong, phu_cap, tong_luong, trang_thai) VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
        [id_nv, thang, nam, luong_cung, thuong, phu_cap, tong_luong]
      );
    }
  },

  submitSalaryForApproval: async (id) => {
    await db.query("UPDATE luong SET trang_thai = 1 WHERE id_luong = ? AND trang_thai = 0", [id]);
  },

  paySalary: async (id) => {
    await db.query("UPDATE luong SET trang_thai = 3 WHERE id_luong = ? AND trang_thai = 2", [id]);
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

  // [BẢO VỆ]: Tính tổng doanh thu và trừ các chi phí (Lương, Nhập kho) để ra lợi nhuận ròng
  getFinancialReport: async (month, year) => {
    const [rev] = await db.query(
      `SELECT SUM(thanhtien) as total FROM hopdong 
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
       )) = ?`,
      [month, year]
    );
    const revenue = Number(rev[0].total) || 0;

    const [inv] = await db.query(
      "SELECT SUM(so_luong * gia_nhap) as total FROM nhap_kho WHERE MONTH(ngay_nhap) = ? AND YEAR(ngay_nhap) = ?",
      [month, year]
    );
    const inventoryCosts = Number(inv[0].total) || 0;

    const [sal] = await db.query(
      "SELECT SUM(tong_luong) as total FROM luong WHERE thang = ? AND nam = ? AND trang_thai = 3",
      [month, year]
    );
    const salaryCosts = Number(sal[0].total) || 0;

    const [other] = await db.query(
      "SELECT SUM(so_tien) as total FROM chi_phi_khac WHERE MONTH(ngay) = ? AND YEAR(ngay) = ?",
      [month, year]
    );
    const otherExpenses = Number(other[0].total) || 0;

    const netProfit = revenue - (inventoryCosts + salaryCosts + otherExpenses);

    return { month, year, revenue, inventoryCosts, salaryCosts, otherExpenses, netProfit };
  },

  addExpense: async (data) => {
    const { ly_do, so_tien, ngay, ghi_chu } = data;
    await db.query(
      "INSERT INTO chi_phi_khac (ly_do, so_tien, ngay, ghi_chu) VALUES (?, ?, ?, ?)",
      [ly_do, so_tien, ngay, ghi_chu]
    );
  },

  getAllExpenses: async () => {
    const [rows] = await db.query("SELECT * FROM chi_phi_khac ORDER BY ngay DESC");
    return rows;
  },

  deleteExpense: async (id) => {
    await db.query("DELETE FROM chi_phi_khac WHERE id_cp = ?", [id]);
  }
};

module.exports = accountantService;
