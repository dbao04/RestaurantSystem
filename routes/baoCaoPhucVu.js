/**
 * ROUTES: Báo cáo cuối ngày của Nhân viên phục vụ (Staff Daily Closing Report)
 */

const express = require('express');
const router = express.Router();
const baoCaoPhucVuService = require('../services/baoCaoPhucVuService');
const auditService = require('../services/auditService');
const personnelService = require('../services/personnelService');

// Middleware kiểm tra nhân sự đăng nhập
const vaiTro = require('../services/phanQuyenVaiTro');
const phanQuyen = require('../services/phanQuyenService');
// Bao cao ca phuc vu: bo phan Phuc vu (va Ban dieu hanh). Truoc day moi nhan vien
// dang nhap (ke toan, kho, bep...) deu mo duoc.
const canNhanSu = (req, res, next) => {
  if (!req.session || !req.session.stafflogin) return res.redirect('/staff/login');
  if (vaiTro.laDieuHanh(req.session, req.hoSo) || req.session.staffRole === 'Phuc vu'
    || phanQuyen.dongVaiDuoc(req.hoSo, ['Phuc vu'])) return next();
  return res.status(403).render('error', {
    title: 'Không có quyền truy cập', statusCode: 403, hoSo: res.locals.hoSo || null,
    message: 'Báo cáo ca phục vụ dành cho bộ phận Phục vụ.',
  });
};

// Middleware kiểm tra vai trò Quản lý / Admin
// Duyet bao cao: Ban dieu hanh hoac Giam sat phuc vu. Truoc day moi chuc danh
// cap <= 3 (ca Truong le tan, Giam sat thu ngan) deu duyet duoc bao cao phuc vu.
const laQuanLy = (req) => vaiTro.laDieuHanh(req.session || {}, req.hoSo) || vaiTro.laGiamSat(req.hoSo, 'PV');

/**
 * 1. Màn hình Tạo báo cáo cuối ngày / Giao ca của Phục vụ
 * GET /staff/phuc-vu/bao-cao
 */
router.get('/staff/phuc-vu/bao-cao', canNhanSu, async (req, res) => {
  try {
    const idNv = req.session.staffId;
    const ngay = req.query.ngay || new Date().toISOString().slice(0, 10);
    
    // Lấy số liệu tự động gợi ý
    const autoStats = await baoCaoPhucVuService.laySoLieuTuDong(idNv, ngay);
    
    // Lấy danh sách báo cáo gần nhất của nhân viên này
    const lichSu = await baoCaoPhucVuService.layDanhSachBaoCao({
      idNv: laQuanLy(req) ? null : idNv,
      limit: 10
    });

    const unread = await personnelService.countUnread(idNv).catch(() => 0);

    res.render('staff/bao-cao-phuc-vu', {
      title: 'Báo cáo Cuối ngày Phục vụ',
      activePage: 'bao-cao-phuc-vu',
      staffName: req.session.staffName || 'Nhân viên phục vụ',
      autoStats,
      lichSu,
      ngay,
      laQuanLy: laQuanLy(req),
      msg: req.query.msg || null,
      msgType: req.query.msgType || 'success',
      unread
    });
  } catch (err) {
    console.error('Lỗi tải trang báo cáo phục vụ:', err);
    res.status(500).send('Lỗi máy chủ: ' + err.message);
  }
});

/**
 * API Lấy số liệu tự động theo ngày khi đổi Date Picker
 * GET /staff/phuc-vu/api/so-lieu-ngay?ngay=YYYY-MM-DD
 */
router.get('/staff/phuc-vu/api/so-lieu-ngay', canNhanSu, async (req, res) => {
  try {
    const idNv = req.session.staffId;
    const ngay = req.query.ngay || new Date().toISOString().slice(0, 10);
    const data = await baoCaoPhucVuService.laySoLieuTuDong(idNv, ngay);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * 2. Gửi báo cáo cuối ngày
 * POST /staff/phuc-vu/bao-cao
 */
router.post('/staff/phuc-vu/bao-cao', canNhanSu, async (req, res) => {
  try {
    const idNv = req.session.staffId;
    const insertId = await baoCaoPhucVuService.taoBaoCao(idNv, req.body);

    await auditService.log({
      action: 'tao_bao_cao_phuc_vu',
      actor_type: 'staff',
      actor_id: idNv,
      actor_name: req.session.staffName,
      details: { bao_cao_id: insertId, ngay: req.body.ngay, ca: req.body.ca },
      status: 'success',
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    }).catch(() => {});

    res.redirect('/staff/phuc-vu/bao-cao?msg=' + encodeURIComponent('Đã gửi báo cáo cuối ngày thành công cho Quản lý!') + '&msgType=success');
  } catch (err) {
    console.error('Lỗi gửi báo cáo phục vụ:', err);
    res.redirect('/staff/phuc-vu/bao-cao?msg=' + encodeURIComponent('Có lỗi khi gửi báo cáo: ' + err.message) + '&msgType=danger');
  }
});

/**
 * 3. Trang Lịch sử & Danh sách tất cả báo cáo (cho cả Phục vụ & Quản lý duyệt)
 * GET /staff/phuc-vu/bao-cao/lich-su
 */
router.get('/staff/phuc-vu/bao-cao/lich-su', canNhanSu, async (req, res) => {
  try {
    const idNv = req.session.staffId;
    const isQL = laQuanLy(req);
    const { tu_ngay, den_ngay, trang_thai } = req.query;

    const danhSach = await baoCaoPhucVuService.layDanhSachBaoCao({
      idNv: isQL ? null : idNv,
      tuNgay: tu_ngay || null,
      denNgay: den_ngay || null,
      trangThai: trang_thai || null,
      limit: 100
    });

    const unread = await personnelService.countUnread(idNv).catch(() => 0);

    res.render('staff/bao-cao-phuc-vu-lich-su', {
      title: 'Danh sách Báo cáo Phục vụ',
      activePage: 'bao-cao-phuc-vu',
      staffName: req.session.staffName || 'Nhân viên',
      danhSach,
      loc: { tu_ngay, den_ngay, trang_thai },
      laQuanLy: isQL,
      unread
    });
  } catch (err) {
    console.error('Lỗi xem lịch sử báo cáo phục vụ:', err);
    res.status(500).send('Lỗi máy chủ: ' + err.message);
  }
});

/**
 * 4. Xem chi tiết 1 báo cáo
 * GET /staff/phuc-vu/bao-cao/:id
 */
router.get('/staff/phuc-vu/bao-cao/:id', canNhanSu, async (req, res) => {
  try {
    const report = await baoCaoPhucVuService.layChiTietBaoCao(req.params.id);
    if (!report) {
      return res.status(404).send('Không tìm thấy báo cáo');
    }

    const unread = await personnelService.countUnread(req.session.staffId).catch(() => 0);

    res.render('staff/bao-cao-phuc-vu-chi-tiet', {
      title: 'Chi tiết Báo cáo Phục vụ #' + report.id,
      activePage: 'bao-cao-phuc-vu',
      report,
      laQuanLy: laQuanLy(req),
      unread
    });
  } catch (err) {
    console.error('Lỗi chi tiết báo cáo phục vụ:', err);
    res.status(500).send('Lỗi máy chủ: ' + err.message);
  }
});

/**
 * 5. Quản lý duyệt / phản hồi báo cáo
 * POST /staff/phuc-vu/bao-cao/:id/duyet
 */
router.post('/staff/phuc-vu/bao-cao/:id/duyet', canNhanSu, async (req, res) => {
  try {
    if (!laQuanLy(req)) {
      return res.status(403).send('Chỉ Quản lý mới có quyền duyệt báo cáo này');
    }

    const idQuanLy = req.session.staffId;
    const { trang_thai, ghi_chu_duyet } = req.body;

    await baoCaoPhucVuService.duyetBaoCao(req.params.id, idQuanLy, {
      trangThai: trang_thai || 'DA_DUYET',
      ghiChu: ghi_chu_duyet || ''
    });

    await auditService.log({
      action: 'duyet_bao_cao_phuc_vu',
      actor_type: 'manager',
      actor_id: idQuanLy,
      actor_name: req.session.staffName,
      details: { bao_cao_id: req.params.id, trang_thai },
      status: 'success',
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    }).catch(() => {});

    res.redirect('/staff/phuc-vu/bao-cao/' + req.params.id);
  } catch (err) {
    console.error('Lỗi duyệt báo cáo phục vụ:', err);
    res.status(500).send('Lỗi máy chủ: ' + err.message);
  }
});

module.exports = router;
