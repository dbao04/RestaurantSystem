/**
 * BAO CAO LAI LO QUAN TRI - xem services/laiLoService.js.
 *
 *   GET /staff/bao-cao-lai-lo?tu=YYYY-MM-DD&den=YYYY-MM-DD&nhom=ngay|tuan|thang
 *
 * Ke toan, Quan ly va cap 1-2.
 */
const express = require('express');
const dv = require('../services/laiLoService');
const phanQuyenMw = require('../middleware/phanQuyen');
const { ngayCucBo } = require('../utils/thoiGian');

const router = express.Router();
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const canTheoVaiTro = phanQuyenMw.canVaiTroCu(['Ke toan', 'Quan ly']);
function canXem(req, res, next) {
  if (req.hoSo && Number(req.hoSo.cap_bac) <= 2) return next();
  return canTheoVaiTro(req, res, next);
}

const p2 = (n) => String(n).padStart(2, '0');
const chuoi = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const cong = (s, n) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + n); return chuoi(d); };

router.get('/staff/bao-cao-lai-lo', canXem, bat(async (req, res) => {
  const personnelService = require('../services/personnelService');
  const homNay = ngayCucBo();
  const hopLe = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  let den = hopLe(req.query.den) ? req.query.den : homNay;
  let tu = hopLe(req.query.tu) ? req.query.tu : cong(den, -364);
  if (tu > den) [tu, den] = [den, tu];
  const nhom = ['ngay', 'tuan', 'thang'].includes(req.query.nhom) ? req.query.nhom : dv.nhomMacDinh(tu, den);
  const kq = await dv.phanTich({ tuNgay: tu, denNgay: den, nhom });
  const d0 = new Date(`${homNay}T00:00:00`);
  res.render('staff/bao-cao-lai-lo', {
    title: 'Báo cáo lãi lỗ',
    activePage: 'bao-cao-lai-lo',
    unread: await personnelService.countUnread(req.session.staffId).catch(() => 0),
    kq, loc: { tu, den, nhom }, homNay,
    moc: [
      { ten: '30 ngày', tu: cong(homNay, -29), den: homNay },
      { ten: '90 ngày', tu: cong(homNay, -89), den: homNay },
      { ten: '12 tháng', tu: cong(homNay, -364), den: homNay },
      { ten: 'Năm nay', tu: `${d0.getFullYear()}-01-01`, den: homNay },
      { ten: 'Năm trước', tu: `${d0.getFullYear() - 1}-01-01`, den: `${d0.getFullYear() - 1}-12-31` },
    ],
  });
}));

module.exports = router;
