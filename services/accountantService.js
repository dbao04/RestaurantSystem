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
      SELECT l.*, n.ten, n.chucvu, n.sodienthoai, cd.ten_cd, cd.cap_bac,
      COALESCE(l.so_ngay_cong, (
        SELECT COUNT(DISTINCT ngay) FROM cham_cong 
        WHERE id_nv = l.id_nv AND MONTH(ngay) = l.thang AND YEAR(ngay) = l.nam
      )) as songaycong
      FROM luong l 
      JOIN nhan_vien n ON l.id_nv = n.id_nv
      LEFT JOIN chuc_danh cd ON n.id_cd = cd.id_cd
    `;
    const params = [];
    if (month && year) {
      query += " WHERE l.thang = ? AND l.nam = ?";
      params.push(month, year);
    }
    query += " ORDER BY cd.cap_bac ASC, n.ten ASC";
    const [rows] = await db.query(query, params);
    return rows;
  },

  // Mức lương cơ sở chuẩn ngành F&B theo cấp bậc
  LUONG_CHUAN_THEO_CAP: {
    1: 15000000, // Cấp 1: Quản lý nhà hàng
    2: 12000000, // Cấp 2: Bếp trưởng, Quản lý bếp, Trợ lý quản lý
    3: 9500000,  // Cấp 3: Bếp phó, Trưởng lễ tân, Giám sát phục vụ, Kế toán trưởng
    4: 8000000,  // Cấp 4: Tổ trưởng bếp, Tổ trưởng phục vụ, Tổ trưởng bar
    5: 6500000,  // Cấp 5: Nhân viên phục vụ, Đầu bếp, Thu ngân, Lễ tân, Shipper
    6: 5000000,  // Cấp 6: Phụ bàn, Phụ bếp
  },

  // Tự động tính lương toàn bộ nhân viên theo ngày công thực tế
  autoCalculateSalary: async (month, year) => {
    // 1. Lấy danh sách toàn bộ nhân viên đang hoạt động
    const [staffList] = await db.query(`
      SELECT n.id_nv, n.ten, n.chucvu, n.luong_co_ban, n.id_cd, cd.cap_bac, cd.ten_cd,
      (SELECT COUNT(DISTINCT ngay) FROM cham_cong WHERE id_nv = n.id_nv AND MONTH(ngay) = ? AND YEAR(ngay) = ?) as so_cong_thuc_te
      FROM nhan_vien n
      LEFT JOIN chuc_danh cd ON n.id_cd = cd.id_cd
      WHERE n.trangthai = 1
      ORDER BY cd.cap_bac ASC, n.ten ASC
    `, [month, year]);

    let count = 0;
    const CHUAN_NGAY_CONG = 26;

    for (const nv of staffList) {
      const capBac = nv.cap_bac || 5;
      const luongCoBanChuan = Number(nv.luong_co_ban) > 0 
        ? Number(nv.luong_co_ban) 
        : (accountantService.LUONG_CHUAN_THEO_CAP[capBac] || 6500000);
      
      const soCong = Number(nv.so_cong_thuc_te) || 0;
      // Lương theo ngày công thực tế (nếu không có công nào vẫn tính công thức nhưng số công = 0)
      const luongCung = Math.round((luongCoBanChuan / CHUAN_NGAY_CONG) * soCong);
      const phuCap = soCong > 0 ? 500000 : 0; // Phụ cấp ăn trưa / đi lại 500k nếu có đi làm
      const thuong = 0;
      const phat = 0;
      const tongLuong = luongCung + phuCap + thuong - phat;

      // Kiểm tra xem đã có bản ghi lương tháng này chưa
      const [existing] = await db.query(
        'SELECT id_luong, trang_thai FROM luong WHERE id_nv = ? AND thang = ? AND nam = ?',
        [nv.id_nv, month, year]
      );

      if (existing.length > 0) {
        // Chỉ cập nhật nếu đang ở trạng thái Dự thảo (0) hoặc chưa thanh toán
        if (existing[0].trang_thai == 0 || existing[0].trang_thai === 'tam_tinh') {
          await db.query(`
            UPDATE luong 
            SET luong_cung = ?, so_ngay_cong = ?, phu_cap = ?, thuong = ?, phat = ?, tong_luong = ?, trang_thai = 0
            WHERE id_luong = ?
          `, [luongCung, soCong, phuCap, thuong, phat, tongLuong, existing[0].id_luong]);
          count++;
        }
      } else {
        await db.query(`
          INSERT INTO luong (id_nv, thang, nam, luong_cung, so_ngay_cong, phu_cap, thuong, phat, tong_luong, trang_thai)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `, [nv.id_nv, month, year, luongCung, soCong, phuCap, thuong, phat, tongLuong]);
        count++;
      }
    }

    return { totalStaff: staffList.length, calculated: count };
  },

  // Thống kê nhanh KPI lương theo tháng
  getMonthlySalarySummary: async (month, year) => {
    const [rows] = await db.query(`
      SELECT 
        COUNT(*) as total_staff,
        COALESCE(SUM(tong_luong), 0) as total_amount,
        COALESCE(SUM(so_ngay_cong), 0) as total_work_days,
        COUNT(CASE WHEN trang_thai = 0 OR trang_thai = 'tam_tinh' THEN 1 END) as draft_count,
        COUNT(CASE WHEN trang_thai = 1 OR trang_thai = 'gui_duyet' THEN 1 END) as pending_count,
        COUNT(CASE WHEN trang_thai = 2 OR trang_thai = 'da_duyet' THEN 1 END) as approved_count,
        COUNT(CASE WHEN trang_thai = 3 OR trang_thai = 'da_thanh_toan' THEN 1 END) as paid_count,
        COALESCE(SUM(CASE WHEN trang_thai = 3 OR trang_thai = 'da_thanh_toan' THEN tong_luong ELSE 0 END), 0) as paid_amount
      FROM luong
      WHERE thang = ? AND nam = ?
    `, [month, year]);
    return rows[0] || {};
  },

  // Cập nhật nhanh một bản ghi lương
  upsertSalary: async (data) => {
    const { id_nv, thang, nam, luong_cung, so_ngay_cong, thuong, phu_cap, phat } = data;
    const cLuongCung = parseFloat(luong_cung || 0);
    const cCong = parseFloat(so_ngay_cong || 0);
    const cThuong = parseFloat(thuong || 0);
    const cPhuCap = parseFloat(phu_cap || 0);
    const cPhat = parseFloat(phat || 0);
    const tong_luong = cLuongCung + cThuong + cPhuCap - cPhat;

    const [existing] = await db.query(
      "SELECT id_luong FROM luong WHERE id_nv = ? AND thang = ? AND nam = ?",
      [id_nv, thang, nam]
    );
    if (existing.length > 0) {
      await db.query(
        "UPDATE luong SET luong_cung = ?, so_ngay_cong = ?, thuong = ?, phu_cap = ?, phat = ?, tong_luong = ?, trang_thai = 0 WHERE id_luong = ?",
        [cLuongCung, cCong, cThuong, cPhuCap, cPhat, tong_luong, existing[0].id_luong]
      );
    } else {
      await db.query(
        "INSERT INTO luong (id_nv, thang, nam, luong_cung, so_ngay_cong, thuong, phu_cap, phat, tong_luong, trang_thai) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
        [id_nv, thang, nam, cLuongCung, cCong, cThuong, cPhuCap, cPhat, tong_luong]
      );
    }
  },

  // Gửi duyệt tất cả bảng lương dự thảo trong tháng
  submitAllSalaries: async (month, year) => {
    const [res] = await db.query(
      "UPDATE luong SET trang_thai = 1 WHERE thang = ? AND nam = ? AND (trang_thai = 0 OR trang_thai = 'tam_tinh')",
      [month, year]
    );
    return res.affectedRows;
  },

  // Phê duyệt tất cả bảng lương chờ duyệt trong tháng (Admin / Manager)
  approveAllSalaries: async (month, year) => {
    const [res] = await db.query(
      "UPDATE luong SET trang_thai = 2, ngay_duyet = NOW() WHERE thang = ? AND nam = ? AND (trang_thai = 1 OR trang_thai = 'gui_duyet')",
      [month, year]
    );
    return res.affectedRows;
  },

  // Trả về dự thảo tất cả bảng lương trong tháng
  rejectAllSalaries: async (month, year) => {
    const [res] = await db.query(
      "UPDATE luong SET trang_thai = 0 WHERE thang = ? AND nam = ? AND (trang_thai = 1 OR trang_thai = 'gui_duyet')",
      [month, year]
    );
    return res.affectedRows;
  },

  // Chi lương hàng loạt cho tất cả nhân viên đã được duyệt trong tháng
  payAllSalaries: async (month, year) => {
    const [res] = await db.query(
      "UPDATE luong SET trang_thai = 3 WHERE thang = ? AND nam = ? AND (trang_thai = 2 OR trang_thai = 'da_duyet')",
      [month, year]
    );
    return res.affectedRows;
  },

  submitSalaryForApproval: async (id) => {
    await db.query("UPDATE luong SET trang_thai = 1 WHERE id_luong = ? AND (trang_thai = 0 OR trang_thai = 'tam_tinh')", [id]);
  },

  paySalary: async (id) => {
    await db.query("UPDATE luong SET trang_thai = 3 WHERE id_luong = ? AND (trang_thai = 2 OR trang_thai = 'da_duyet')", [id]);
  },

  getPendingSalaries: async (month, year) => {
    let query = `
      SELECT l.*, n.ten, n.chucvu, cd.ten_cd, cd.cap_bac,
      (SELECT COUNT(DISTINCT ngay) FROM cham_cong WHERE id_nv = l.id_nv AND MONTH(ngay) = l.thang AND YEAR(ngay) = l.nam) as songaycong
      FROM luong l 
      JOIN nhan_vien n ON l.id_nv = n.id_nv 
      LEFT JOIN chuc_danh cd ON n.id_cd = cd.id_cd
      WHERE l.trang_thai = 1 OR l.trang_thai = 'gui_duyet'
    `;
    const params = [];
    if (month && year) {
      query += " AND l.thang = ? AND l.nam = ?";
      params.push(month, year);
    }
    query += " ORDER BY l.nam DESC, l.thang DESC, cd.cap_bac ASC, n.ten ASC";
    const [rows] = await db.query(query, params);
    return rows;
  },

  updateSalaryStatus: async (id, status) => {
    await db.query('UPDATE luong SET trang_thai = ?, ngay_duyet = IF(? = 2, NOW(), ngay_duyet) WHERE id_luong = ?', [status, status, id]);
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
