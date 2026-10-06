/**
 * ROUTES: Quan tri THANH VIEN (/admin/thanh-vien va /staff/thanh-vien)
 */

const express = require('express');
const router = express.Router();
const loyaltyService = require('../services/loyaltyService');

const canQuanLyOrAdmin = (req, res, next) => {
  if (req.session && req.session.adminlogin) return next();
  if (req.session && req.session.stafflogin) {
    const vaiTro = (req.session.staffRole || '').toLowerCase();
    if (/quan ly|quanly|manager|ke toan|ketoan/.test(vaiTro) || (req.hoSo && req.hoSo.cap_bac <= 2)) return next();
  }
  return res.redirect(req.originalUrl.startsWith('/staff') ? '/staff/login' : '/admin/login');
};

const isStaffRoute = (req) => {
  const p = req.originalUrl || req.path || '';
  if (p.startsWith('/staff')) return true;
  if (req.session && req.session.stafflogin && !req.session.adminlogin) return true;
  return false;
};

const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get(['/admin/thanh-vien', '/staff/thanh-vien'], canQuanLyOrAdmin, bat(async (req, res) => {
  const loc = {
    tuKhoa: (req.query.q || '').trim(),
    hang: ['bronze', 'silver', 'gold', 'platinum'].includes(req.query.hang) ? req.query.hang : '',
    keCaVangLai: req.query.vang_lai === '1',
  };

  const [danhSach, thongKe] = await Promise.all([
    loyaltyService.danhSachThanhVien(loc),
    loyaltyService.thongKeHang(),
  ]);

  res.render('admin/thanh-vien', {
    title: 'Thành viên & Hạng',
    isStaff: isStaffRoute(req),
    danhSach,
    thongKe,
    loc,
    TEN_HANG: loyaltyService.TEN_HANG,
    NGUONG_HANG: loyaltyService.NGUONG_HANG,
  });
}));

router.get(['/admin/thanh-vien/:id', '/staff/thanh-vien/:id'], canQuanLyOrAdmin, bat(async (req, res) => {
  const goc = isStaffRoute(req) ? '/staff/thanh-vien' : '/admin/thanh-vien';
  if (!/^\d+$/.test(req.params.id)) return res.redirect(goc);

  const ho_so = await loyaltyService.chiTietThanhVien(req.params.id);
  if (!ho_so) return res.redirect(goc);

  res.render('admin/thanh-vien-chi-tiet', {
    title: 'Thành viên · ' + (ho_so.kh.ten || '#' + ho_so.kh.id),
    isStaff: isStaffRoute(req),
    ...ho_so,
    TEN_HANG: loyaltyService.TEN_HANG,
    NGUONG_HANG: loyaltyService.NGUONG_HANG,
  });
}));

module.exports = router;
