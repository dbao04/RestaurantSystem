/**
 * Router cho Dashboard phan tich (Tang 2).
 *
 * Cho phep ca admin lan nhan vien quan ly truy cap. Trang HTML o `/analytics`,
 * so lieu lay qua cac endpoint JSON `/analytics/api/*` de bieu do co the tu
 * refresh ma khong phai tai lai ca trang.
 */
const express = require('express');
const analytics = require('../services/analyticsService');

const router = express.Router();

/** Admin hoac nhan vien co chuc vu quan ly deu xem duoc dashboard. */
function requireQuanLy(req, res, next) {
  if (req.session.adminlogin) return next();
  if (req.session.stafflogin) {
    const vaiTro = (req.session.staffRole || '').toLowerCase();
    if (/quan ly|quanly|ke toan|ketoan|manager/.test(vaiTro)) return next();
  }
  return res.redirect('/admin/login');
}

/** Bot lap code try/catch cho tung route. */
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireQuanLy);

// --- Trang dashboard ---
router.get('/', bat(async (req, res) => {
  const { tu, den } = req.query;
  const khoang = await analytics.khoangNgay(tu, den);
  res.render('admin/dashboard', {
    khoang,
    tenNguoiDung: req.session.adminname || req.session.staffname || 'Quản lý',
  });
}));

// --- API so lieu ---

router.get('/api/tong-quan', bat(async (req, res) => {
  res.json(await analytics.tongQuan(req.query.tu, req.query.den));
}));

router.get('/api/doanh-thu-ngay', bat(async (req, res) => {
  res.json(await analytics.doanhThuTheoNgay(req.query.tu, req.query.den));
}));

router.get('/api/doanh-thu-gio', bat(async (req, res) => {
  res.json(await analytics.doanhThuTheoGio(req.query.tu, req.query.den));
}));

router.get('/api/doanh-thu-thang', bat(async (req, res) => {
  res.json(await analytics.doanhThuTheoThang());
}));

router.get('/api/doanh-thu-thu', bat(async (req, res) => {
  res.json(await analytics.doanhThuTheoThu(req.query.tu, req.query.den));
}));

router.get('/api/top-mon', bat(async (req, res) => {
  const gioiHan = Math.min(Number(req.query.limit) || 20, 50);
  res.json(await analytics.topMon(req.query.tu, req.query.den, gioiHan));
}));

router.get('/api/pareto', bat(async (req, res) => {
  res.json(await analytics.pareto(req.query.tu, req.query.den));
}));

router.get('/api/hieu-suat-nhan-vien', bat(async (req, res) => {
  res.json(await analytics.hieuSuatNhanVien(req.query.tu, req.query.den));
}));

router.get('/api/hieu-suat-bep', bat(async (req, res) => {
  res.json(await analytics.hieuSuatBep(req.query.tu, req.query.den));
}));

router.get('/api/ton-kho', bat(async (req, res) => {
  res.json(await analytics.tonKho());
}));

router.get('/api/lo-het-han', bat(async (req, res) => {
  res.json(await analytics.loSapHetHan(Number(req.query.ngay) || 14));
}));

router.get('/api/loai-don', bat(async (req, res) => {
  res.json(await analytics.theoLoaiDon(req.query.tu, req.query.den));
}));

router.get('/api/danh-muc', bat(async (req, res) => {
  res.json(await analytics.theoDanhMuc(req.query.tu, req.query.den));
}));

module.exports = router;
