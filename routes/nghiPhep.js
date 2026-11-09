/**
 * DUYET NGHI PHEP theo cap tren - xem services/nghiPhepService.js.
 *
 *   GET  /staff/duyet-nghi-phep            danh sach don cua cap duoi (quan ly: tat ca)
 *   POST /api/staff/nghi-phep/:id/xu-ly    { dong_y: true|false, ly_do }
 *
 * Nhan vien xin nghi o /staff/leave (server.js); ke toan xem tong hop o
 * /staff/accountant/leave (chi xem, de tinh luong).
 */
const express = require('express');
const dv = require('../services/nghiPhepService');
const phanQuyenMw = require('../middleware/phanQuyen');
const realtime = require('../services/realtime');

const router = express.Router();
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function nguoi(req) {
  return { hoSo: req.hoSo || null, laAdmin: !!(req.session && req.session.adminlogin), id: (req.session && req.session.staffId) || null };
}

router.get('/staff/duyet-nghi-phep', phanQuyenMw.canDangNhap, bat(async (req, res) => {
  const personnelService = require('../services/personnelService');
  const ds = await dv.dsChoNguoiDuyet(req.hoSo, !!req.session.adminlogin);
  res.render('staff/duyet-nghi-phep', {
    title: 'Duyệt nghỉ phép',
    activePage: 'duyet-nghi-phep',
    unread: await personnelService.countUnread(req.session.staffId).catch(() => 0),
    ds,
  });
}));

router.post('/api/staff/nghi-phep/:id/xu-ly', phanQuyenMw.canDangNhap, bat(async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ ok: false, thong_bao: 'Không tìm thấy' });
    const b = req.body || {};
    const kq = await dv.xuLy(Number(req.params.id), nguoi(req), {
      dongY: b.dong_y === true || b.dong_y === '1' || b.dong_y === 'true',
      lyDo: b.ly_do,
    });
    realtime.doi(realtime.MIEN.NGHI_PHEP, { su_kien: 'XU_LY', id_nv: kq.id_nv });
    res.json(kq);
  } catch (e) {
    if (e && e.name === 'LoiNghiPhep') {
      return res.status(e.ma === 'NOT_FOUND' ? 404 : e.ma === 'FORBIDDEN' ? 403 : 400).json({ ok: false, thong_bao: e.message });
    }
    console.error('[nghi-phep]', e);
    res.status(500).json({ ok: false, thong_bao: 'Hệ thống đang bận, vui lòng thử lại.' });
  }
}));

module.exports = router;
