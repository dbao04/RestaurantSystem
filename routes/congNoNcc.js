/**
 * CONG NO NHA CUNG CAP - ke toan / quan ly xem no va tra tien nha cung cap.
 *
 *   GET  /staff/cong-no-ncc                         trang tong hop + danh sach phieu con no
 *   GET  /api/staff/cong-no-ncc/phieu/:id/lich-su   cac lan da tra cua mot phieu nhap
 *   POST /api/staff/cong-no-ncc/phieu/:id/tra       tra tien -> sinh phieu chi 'tra_ncc'
 *
 * Bep lap phieu nhap (nhan hang); tra tien la viec cua ke toan / quan ly.
 * Xem services/congNoNccService.js.
 */
const express = require('express');
const dv = require('../services/congNoNccService');
const phanQuyenMw = require('../middleware/phanQuyen');
const realtime = require('../services/realtime');

const router = express.Router();
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const canKeToan = phanQuyenMw.canVaiTroCu(['Ke toan', 'Quan ly']);

function traLoi(res, e) {
  if (e && e.name === 'LoiCongNo') {
    return res.status(e.ma === 'NOT_FOUND' ? 404 : 400).json({ ok: false, thong_bao: e.message });
  }
  console.error('[cong-no-ncc]', e);
  return res.status(500).json({ ok: false, thong_bao: 'Hệ thống đang bận, vui lòng thử lại.' });
}

router.get('/staff/cong-no-ncc', canKeToan, bat(async (req, res) => {
  const personnelService = require('../services/personnelService');
  const idNcc = Number(req.query.ncc) || null;
  const [tongHop, phieu] = await Promise.all([dv.tongHop(), dv.phieuConNo(idNcc)]);
  res.render('staff/cong-no-ncc', {
    title: 'Công nợ nhà cung cấp',
    activePage: 'cong-no-ncc',
    unread: await personnelService.countUnread(req.session.staffId).catch(() => 0),
    tongHop,
    phieu,
    idNcc,
    hanNo: dv.HAN_NO_NGAY,
  });
}));

router.get('/api/staff/cong-no-ncc/phieu/:id/lich-su', canKeToan, bat(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ ok: false, thong_bao: 'Không tìm thấy' });
  res.json({ ok: true, lich_su: await dv.lichSuTra(Number(req.params.id)) });
}));

router.post('/api/staff/cong-no-ncc/phieu/:id/tra', canKeToan, bat(async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ ok: false, thong_bao: 'Không tìm thấy' });
    const b = req.body || {};
    const kq = await dv.traTien({
      idPn: Number(req.params.id), soTien: b.so_tien, phuongThuc: b.phuong_thuc, ghiChu: b.ghi_chu,
    }, req.session.staffId);
    // So quy (chot ca, thu chi) va man hinh kho tu lam moi.
    realtime.doi(realtime.MIEN.CHOT_CA, { su_kien: 'PHIEU_THU_CHI', ma: kq.ma_phieu_chi });
    realtime.doi(realtime.MIEN.KHO, { su_kien: 'TRA_NCC' });
    res.json({ ok: true, ...kq });
  } catch (e) { traLoi(res, e); }
}));

module.exports = router;
