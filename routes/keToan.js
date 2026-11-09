/**
 * Khu KE TOAN (/staff/accountant/*): bang luong, chi phi, bao cao, cham cong,
 * nghi phep, lich lam viec.
 *
 * Tach nguyen van tu server.js (truoc day mot tep ~3.900 dong). Cac phu thuoc
 * dung chung (middleware phan quyen, upload, service...) do server.js truyen vao
 * de khong tao ban sao thu hai. Mount o DUNG vi tri cu trong server.js nen thu
 * tu middleware khong doi.
 */
const express = require('express');

module.exports = function ({ db, personnelService, requireRole }) {
  const router = express.Router();

  // --- ACCOUNTANT MANAGEMENT (Role: 'Ke toan') ---

  router.get('/staff/accountant/attendance/export', requireRole(['Ke toan']), async (req, res) => {
    try {
      const month = parseInt(req.query.month) || new Date().getMonth() + 1;
      const year = parseInt(req.query.year) || new Date().getFullYear();
      const rows = await personnelService.getDetailedAttendanceReport(month, year);

      // Format headers for Excel CSV download
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      // Bắt buộc phải có dấu ngoặc kép bọc quanh filename để tránh lỗi trình duyệt cắt chuỗi
      res.setHeader('Content-Disposition', `attachment; filename="Bao_cao_cham_cong_T${month}_${year}.csv"`);

      // Write UTF-8 BOM để Excel đọc được tiếng Việt có dấu
      res.write('\uFEFF');

      // Headers
      res.write('Ngày,Nhân viên,Chức vụ,Giờ vào,Giờ ra,Tổng giờ làm (H)\n');

      rows.forEach(r => {
        let dateStr = '';
        if (r.ngay) {
          const d = new Date(r.ngay);
          dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
        }
        
        let vaoStr = '';
        if (r.gio_vao) {
          const d = new Date(r.gio_vao);
          vaoStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
        }
        
        let raStr = '';
        if (r.gio_ra) {
          const d = new Date(r.gio_ra);
          raStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
        }
        
        const tongStr = r.tong_gio != null ? r.tong_gio : '0';
        
        // Escape commas and double quotes in strings to prevent CSV format breakage
        const name = r.ten ? `"${r.ten.replace(/"/g, '""')}"` : '';
        const role = r.chucvu ? `"${r.chucvu.replace(/"/g, '""')}"` : '';

        res.write(`${dateStr},${name},${role},${vaoStr},${raStr},${tongStr}\n`);
      });

      res.end();
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error: ' + err.message);
    }
  });

  router.get('/staff/accountant/salary', requireRole(['Ke toan', 'Quan ly']), async (req, res) => {
    try {
      const month = parseInt(req.query.month) || new Date().getMonth() + 1;
      const year = parseInt(req.query.year) || new Date().getFullYear();
      const [salaryList, staffList, summary, attendanceList] = await Promise.all([
        personnelService.getSalaryList(month, year),
        personnelService.getAllStaff(),
        personnelService.getMonthlySalarySummary(month, year),
        personnelService.getDetailedAttendanceReport(month, year),
      ]);
      
      res.render('staff/accountant/salary', {
        title: 'Quản lý Lương',
        salaryList,
        staffList,
        summary,
        attendanceList,
        month, year,
        msg: req.query.msg || null,
        msgType: req.query.msgType || 'success',
        unread: await personnelService.countUnread(req.session.staffId),
        activePage: 'salary'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  // Tự động tính lương toàn bộ nhân viên theo ngày công thực tế
  router.post('/staff/accountant/salary/auto-calculate', requireRole(['Ke toan', 'Quan ly']), async (req, res) => {
    try {
      const { month, year } = req.body;
      const m = parseInt(month) || new Date().getMonth() + 1;
      const y = parseInt(year) || new Date().getFullYear();
      const result = await personnelService.autoCalculateSalary(m, y);
      res.redirect(`/staff/accountant/salary?month=${m}&year=${y}&msg=${encodeURIComponent(`Đã tự động tính lương thành công cho ${result.calculated} nhân viên dựa trên ngày công thực tế!`)}&msgType=success`);
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error: ' + err.message);
    }
  });

  router.get('/staff/accountant/salary/auto-calculate', (req, res) => res.redirect('/staff/accountant/salary'));

  // Gửi duyệt tất cả bảng lương trong tháng
  router.post('/staff/accountant/salary/submit-all', requireRole(['Ke toan', 'Quan ly']), async (req, res) => {
    try {
      const { month, year } = req.body;
      const m = parseInt(month) || new Date().getMonth() + 1;
      const y = parseInt(year) || new Date().getFullYear();
      const count = await personnelService.submitAllSalaries(m, y);
      res.redirect(`/staff/accountant/salary?month=${m}&year=${y}&msg=${encodeURIComponent(`Đã gửi ${count} bảng lương sang Quản trị viên phê duyệt!`)}&msgType=success`);
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error: ' + err.message);
    }
  });

  router.get('/staff/accountant/salary/submit-all', (req, res) => res.redirect('/staff/accountant/salary'));

  // Chi lương hàng loạt cho tất cả nhân viên đã được duyệt trong tháng
  router.post('/staff/accountant/salary/pay-all', requireRole(['Ke toan', 'Quan ly']), async (req, res) => {
    try {
      const { month, year } = req.body;
      const m = parseInt(month) || new Date().getMonth() + 1;
      const y = parseInt(year) || new Date().getFullYear();
      const count = await personnelService.payAllSalaries(m, y);
      res.redirect(`/staff/accountant/salary?month=${m}&year=${y}&msg=${encodeURIComponent(`Đã xác nhận chi trả lương cho ${count} nhân viên!`)}&msgType=success`);
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error: ' + err.message);
    }
  });

  router.get('/staff/accountant/salary/pay-all', (req, res) => res.redirect('/staff/accountant/salary'));

  router.post('/staff/accountant/salary/upsert', requireRole(['Ke toan', 'Quan ly']), async (req, res) => {
    try {
      const { luong_cung, thuong, phu_cap, phat, thang, nam } = req.body;
      if (Number(luong_cung) < 0 || Number(thuong) < 0 || Number(phu_cap) < 0 || Number(phat || 0) < 0) {
        return res.send('<script>alert("Các khoản lương, thưởng, phụ cấp không được nhỏ hơn 0!"); history.back();</script>');
      }
      await personnelService.upsertSalary(req.body);
      res.redirect(`/staff/accountant/salary?month=${thang}&year=${nam}&msg=${encodeURIComponent('Đã lưu thông tin bảng lương!')}&msgType=success`);
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/staff/accountant/reports', requireRole(['Ke toan']), async (req, res) => {
    try {
      const month = parseInt(req.query.month) || new Date().getMonth() + 1;
      const year = parseInt(req.query.year) || new Date().getFullYear();
      const report = await personnelService.getFinancialReport(month, year);
      
      res.render('staff/accountant/reports', {
        title: 'Báo cáo Thu chi',
        report,
        month, year,
        unread: await personnelService.countUnread(req.session.staffId),
        activePage: 'reports'
      });
    } catch (err) {
      console.error('CRITICAL ERROR in /staff/accountant/reports:', err);
      res.status(500).send(`<h1>Lỗi máy chủ</h1><p>Không thể tải báo cáo cho tháng ${req.query.month || (new Date().getMonth()+1)}/${req.query.year || new Date().getFullYear()}.</p><p>Chi tiết: ${err.message}</p><a href="/staff">Quay lại Trang chủ</a>`);
    }
  });

  router.get('/staff/accountant/expenses', requireRole(['Ke toan']), async (req, res) => {
    try {
      const expenses = await personnelService.getAllExpenses();
      res.render('staff/accountant/expenses', {
        title: 'Quản lý Chi phí',
        expenses,
        unread: await personnelService.countUnread(req.session.staffId),
        activePage: 'reports'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/accountant/expenses/add', requireRole(['Ke toan']), async (req, res) => {
    try {
      await personnelService.addExpense(req.body);
      res.redirect('/staff/accountant/expenses');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/accountant/expenses/delete/:id', requireRole(['Ke toan']), async (req, res) => {
    try {
      await personnelService.deleteExpense(req.params.id);
      res.redirect('/staff/accountant/expenses');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/staff/accountant/attendance', requireRole(['Ke toan']), async (req, res) => {
    try {
      const date = req.query.date || new Date().toISOString().slice(0, 10);
      const logs = await personnelService.getDailyAttendance(date);
      res.render('staff/accountant/attendance', {
        title: 'Theo dõi Chấm công',
        logs, date,
        unread: await personnelService.countUnread(req.session.staffId),
        activePage: 'attendance'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  // --- ACCOUNTANT: ATTENDANCE SUMMARY ---
  router.get('/staff/accountant/attendance/summary', requireRole(['Ke toan']), async (req, res) => {
    try {
      const month = req.query.month || new Date().getMonth() + 1;
      const year = req.query.year || new Date().getFullYear();
      const summary = await personnelService.getMonthlyAttendanceSummary(month, year);
      res.render('staff/accountant/attendance_summary', {
        title: 'Tổng hợp Chấm công',
        summary, month, year,
        unread: await personnelService.countUnread(req.session.staffId),
        activePage: 'attendance'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/staff/accountant/staff', requireRole(['Ke toan']), async (req, res) => {
    try {
      const staff = await personnelService.getAllStaff();
      res.render('staff/accountant/staff_list', {
        title: 'Quản lý Nhân sự',
        staff,
        unread: await personnelService.countUnread(req.session.staffId),
        activePage: 'staff-manage'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/accountant/staff/delete/:id', requireRole(['Ke toan']), async (req, res) => {
    try {
      await personnelService.deleteStaff(req.params.id);
      res.redirect('/staff/accountant/staff');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/staff/accountant/reports/print', requireRole(['Ke toan']), async (req, res) => {
    try {
      const month = req.query.month || new Date().getMonth() + 1;
      const year = req.query.year || new Date().getFullYear();
      const report = await personnelService.getFinancialReport(month, year);
      const expenses = await personnelService.getAllExpenses();
      res.render('staff/accountant/report-print', { report, month, year, expenses });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.get('/staff/accountant/leave', requireRole(['Ke toan']), async (req, res) => {
    try {
      const leaves = await personnelService.getAllLeaveRequests();
      res.render('staff/accountant/leave', {
        title: 'Quản lý Nghỉ phép',
        leaves,
        msg: req.query.msg || null,
        msgType: req.query.msgType || 'info',
        unread: await personnelService.countUnread(req.session.staffId),
        activePage: 'leave-manage'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  router.post('/staff/accountant/leave/add', requireRole(['Ke toan']), async (req, res) => {
    try {
      const nghiPhep = require('../services/nghiPhepService');
      try {
        await nghiPhep.taoDon(req.session.staffId, req.body);
      } catch (e) {
        if (e instanceof nghiPhep.LoiNghiPhep) {
          return res.redirect('/staff/accountant/leave?msg=' + encodeURIComponent(e.message) + '&msgType=danger');
        }
        throw e;
      }
      res.redirect('/staff/accountant/leave?msg=' + encodeURIComponent('Đã gửi đơn. Đơn sẽ do cấp trên của bạn duyệt.') + '&msgType=success');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  // Ke toan KHONG con duyet nghi phep: cap tren duyet o /staff/duyet-nghi-phep
  // (routes/nghiPhep.js). Giu duong dan cu de form / bookmark cu nhan thong bao
  // ro rang thay vi loi 404.
  router.post(['/staff/accountant/leave/approve/:id', '/staff/accountant/leave/reject/:id'], requireRole(['Ke toan']), (req, res) => {
    res.redirect('/staff/accountant/leave?msg=' + encodeURIComponent(
      'Đơn nghỉ phép do cấp trên trực tiếp duyệt tại mục "Duyệt nghỉ phép". Kế toán chỉ xem để tính lương.'
    ) + '&msgType=warning');
  });


  router.get('/staff/accountant/schedule', requireRole(['Ke toan']), async (req, res) => {
    try {
      const year = req.query.year || new Date().getFullYear();
      const month = req.query.month || new Date().getMonth() + 1;
      const schedules = await personnelService.getSchedule(null, year, month); // All staff schedule
      res.render('staff/accountant/schedule', {
        title: 'Quản lý Lịch làm việc',
        schedules, month, year,
        unread: await personnelService.countUnread(req.session.staffId),
        activePage: 'schedule'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  // Gửi duyệt lương
  router.post('/staff/accountant/salary/submit/:id', requireRole(['Ke toan', 'Quan ly']), async (req, res) => {
    try {
      await personnelService.submitSalaryForApproval(req.params.id);
      res.redirect('/staff/accountant/salary');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  // Chi lương (Thanh toán)
  router.post('/staff/accountant/salary/pay/:id', requireRole(['Ke toan', 'Quan ly']), async (req, res) => {
    try {
      await personnelService.paySalary(req.params.id);
      res.redirect('/staff/accountant/salary');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  // In Phiếu Lương
  router.get('/staff/accountant/salary/print/:id', requireRole(['Ke toan']), async (req, res) => {
    try {
      const [salaryRows] = await db.query(`
        SELECT l.*, n.ten, n.chucvu 
        FROM luong l 
        JOIN nhan_vien n ON l.id_nv = n.id_nv 
        WHERE l.id_luong = ?
      `, [req.params.id]);

      if (salaryRows.length === 0) return res.status(404).send('Không tìm thấy bảng lương');
      res.render('staff/accountant/salary-print', { s: salaryRows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  return router;
};
