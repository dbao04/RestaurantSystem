/**
 * ROUTES: Quan tri THANH VIEN (/admin/thanh-vien)
 *
 * Hang thanh vien la mot dieu kien cua khuyen mai ("chi khach Vang tro len")
 * nhung truoc day khong co man hinh nao xem duoc ai dang o hang nao - dat
 * dieu kien xong thi khong biet no loc ra bao nhieu nguoi.
 *
 * Trang nay chi DOC: hang va diem do luong thanh toan tu tinh, sua tay se
 * lam lech voi lich su giao dich.
 */

const express = require('express');
const router = express.Router();
const { requireAdminLogin } = require('../middleware/auth');
const loyaltyService = require('../services/loyaltyService');

const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/admin/thanh-vien', requireAdminLogin, bat(async (req, res) => {
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
    danhSach,
    thongKe,
    loc,
    TEN_HANG: loyaltyService.TEN_HANG,
    NGUONG_HANG: loyaltyService.NGUONG_HANG,
  });
}));

router.get('/admin/thanh-vien/:id', requireAdminLogin, bat(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.redirect('/admin/thanh-vien');

  const ho_so = await loyaltyService.chiTietThanhVien(req.params.id);
  if (!ho_so) return res.redirect('/admin/thanh-vien');

  res.render('admin/thanh-vien-chi-tiet', {
    title: 'Thành viên · ' + (ho_so.kh.ten || '#' + ho_so.kh.id),
    ...ho_so,
    TEN_HANG: loyaltyService.TEN_HANG,
    NGUONG_HANG: loyaltyService.NGUONG_HANG,
  });
}));

module.exports = router;
