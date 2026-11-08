/**
 * PHAN TICH THUC DON (menu engineering) - xem services/phanTichThucDonService.js.
 *
 *   GET /staff/phan-tich-thuc-don?tu=YYYY-MM-DD&den=YYYY-MM-DD&loai=<id_loai>
 *
 * Quan ly (quyet dinh gia, giu / bo mon) va Bep (xem gia von, dinh luong).
 */
const express = require('express');
const dv = require('../services/phanTichThucDonService');
const phanQuyenMw = require('../middleware/phanQuyen');
const { ngayCucBo } = require('../utils/thoiGian');

const router = express.Router();
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
// Cung dieu kien voi menu (views/staff/partials/header.ejs): cap 1-2 (nhom
// "Dieu hanh") hoac vai tro Quan ly / Bep (nhom "Khu vuc Bep").
const canTheoVaiTro = phanQuyenMw.canVaiTroCu(['Quan ly', 'Bep']);
function canXem(req, res, next) {
  if (req.hoSo && Number(req.hoSo.cap_bac) <= 2) return next();
  return canTheoVaiTro(req, res, next);
}

function congNgay(ngay, soNgay) {
  const d = new Date(`${ngay}T00:00:00`);
  d.setDate(d.getDate() + soNgay);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

router.get('/staff/phan-tich-thuc-don', canXem, bat(async (req, res) => {
  const personnelService = require('../services/personnelService');
  const homNay = ngayCucBo();
  const hopLe = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  // Mac dinh 12 thang gan nhat: menu engineering can du so phan ban moi on dinh.
  let den = hopLe(req.query.den) ? req.query.den : homNay;
  let tu = hopLe(req.query.tu) ? req.query.tu : congNgay(den, -364);
  if (tu > den) [tu, den] = [den, tu];
  const idLoai = Number(req.query.loai) || null;

  const [kq, danhMuc] = await Promise.all([dv.phanTich({ tuNgay: tu, denNgay: den, idLoai }), dv.danhMuc()]);
  res.render('staff/phan-tich-thuc-don', {
    title: 'Phân tích thực đơn',
    activePage: 'phan-tich-thuc-don',
    unread: await personnelService.countUnread(req.session.staffId).catch(() => 0),
    kq,
    danhMuc,
    loc: { tu, den, idLoai },
    homNay,
    moc: [30, 90, 180, 365].map((n) => ({ ten: n === 365 ? '12 tháng' : `${n} ngày`, tu: congNgay(homNay, -(n - 1)), den: homNay })),
    nhom: dv.NHOM,
    hang: {
      tyLeNguong: dv.TY_LE_NGUONG_PHO_BIEN,
      foodCostMucTieu: dv.FOOD_COST_MUC_TIEU,
      soPhanToiThieu: dv.SO_PHAN_TOI_THIEU,
    },
  });
}));

module.exports = router;
