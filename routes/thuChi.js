/**
 * BAO CAO THU CHI / SO QUY - khu thu ngan.
 *
 *   GET  /staff/thu-chi                     bao cao + so quy (Thu ngan, Ke toan, Quan ly)
 *   GET  /staff/thu-chi/excel               xuat Excel cung bo loc
 *   GET  /staff/thu-chi/phieu/:id/in        in phieu thu / phieu chi (co cho ky)
 *   POST /api/staff/thu-chi/phieu           lap phieu (Thu ngan, Quan ly)
 *   POST /api/staff/thu-chi/phieu/:id/huy   huy phieu (nguoi lap / Ke toan / Quan ly)
 */
const express = require('express');
const dv = require('../services/thuChiService');
const phanQuyenMw = require('../middleware/phanQuyen');
const phanQuyen = require('../services/phanQuyenService');
const realtime = require('../services/realtime');
const { ngayCucBo } = require('../utils/thoiGian');

const router = express.Router();
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const canXem = phanQuyenMw.canVaiTroCu(['Thu ngan', 'Ke toan', 'Quan ly']);
const canLap = phanQuyenMw.canVaiTroCu(['Thu ngan', 'Quan ly']);

function laQuanLy(req) {
  if (req.session.adminlogin) return true;
  const ds = ['Ke toan', 'Quan ly'];
  return ds.includes(req.session.staffRole) || phanQuyen.dongVaiDuoc(req.hoSo, ds);
}

function traLoi(res, e) {
  if (e && e.name === 'LoiThuChi') {
    return res.status(e.ma === 'NOT_FOUND' ? 404 : e.ma === 'FORBIDDEN' ? 403 : 400).json({ ok: false, thong_bao: e.message });
  }
  console.error('[thu-chi]', e);
  return res.status(500).json({ ok: false, thong_bao: 'Hệ thống đang bận, vui lòng thử lại.' });
}

/** Doc bo loc tu query: khoang ngay (mac dinh hom nay) + pham vi. */
function boLoc(req) {
  const homNay = ngayCucBo();
  const hopLe = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const tu = hopLe(req.query.tu) ? req.query.tu : homNay;
  const den = hopLe(req.query.den) ? req.query.den : homNay;
  // Thu ngan mac dinh xem SO QUY CUA MINH; ke toan / quan ly mac dinh ca nha hang.
  const macDinh = laQuanLy(req) ? 'tat_ca' : 'toi';
  const phamVi = ['toi', 'tat_ca'].includes(req.query.pham_vi) ? req.query.pham_vi : macDinh;
  return { tu, den, phamVi, idNv: phamVi === 'toi' ? (req.session.staffId || null) : null };
}

router.get('/staff/thu-chi', canXem, bat(async (req, res) => {
  const loc = boLoc(req);
  let bc = null;
  let loi = null;
  try {
    bc = await dv.baoCao({ tuNgay: loc.tu, denNgay: loc.den, idNv: loc.idNv });
  } catch (e) {
    if (e.name !== 'LoiThuChi') throw e;
    loi = e.message;
  }
  const personnelService = require('../services/personnelService');
  res.render('staff/thu-chi', {
    title: 'Sổ quỹ thu chi',
    activePage: 'thu-chi',
    unread: await personnelService.countUnread(req.session.staffId).catch(() => 0),
    loc, bc, loi,
    homNay: ngayCucBo(),
    danhMuc: dv.DANH_MUC,
    danhMucLap: dv.DANH_MUC_LAP,
    duocLap: laQuanLy(req) || ['Thu ngan'].includes(req.session.staffRole) || phanQuyen.dongVaiDuoc(req.hoSo, ['Thu ngan']),
    laQuanLy: laQuanLy(req),
    idNv: req.session.staffId || null,
  });
}));

router.get('/staff/thu-chi/excel', canXem, bat(async (req, res) => {
  const loc = boLoc(req);
  try {
    const bc = await dv.baoCao({ tuNgay: loc.tu, denNgay: loc.den, idNv: loc.idNv });
    const buf = await dv.xuatExcel(bc, {
      tenNguoiXem: req.session.staffName || 'Quản trị',
      phamVi: loc.phamVi === 'toi' ? 'Phạm vi: sổ quỹ của tôi' : 'Phạm vi: toàn nhà hàng',
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="bao-cao-thu-chi_${loc.tu}_${loc.den}.xlsx"`);
    res.send(Buffer.from(buf));
  } catch (e) {
    if (e.name === 'LoiThuChi') return res.status(400).send(e.message);
    throw e;
  }
}));

router.get('/staff/thu-chi/phieu/:id/in', canXem, bat(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).send('Không tìm thấy phiếu');
  const db = require('../config/db');
  const [[p]] = await db.query(
    `SELECT t.*, nv.ten AS nguoi_lap FROM phieu_thu_chi t LEFT JOIN nhan_vien nv ON nv.id_nv = t.id_nv WHERE t.id = ?`,
    [req.params.id]);
  if (!p) return res.status(404).send('Không tìm thấy phiếu');
  res.render('staff/thu-chi-phieu', { p, danhMuc: dv.DANH_MUC, phuongThuc: dv.PHUONG_THUC });
}));

router.post('/api/staff/thu-chi/phieu', canLap, bat(async (req, res) => {
  try {
    const kq = await dv.lapPhieu(req.body, req.session.staffId || null);
    realtime.doi(realtime.MIEN.CHOT_CA, { su_kien: 'PHIEU_THU_CHI', ma: kq.ma_phieu });
    res.status(201).json({ ok: true, ...kq });
  } catch (e) { traLoi(res, e); }
}));

router.post('/api/staff/thu-chi/phieu/:id/huy', canXem, bat(async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ ok: false, thong_bao: 'Không tìm thấy phiếu' });
    await dv.huyPhieu(Number(req.params.id), {
      lyDo: req.body.ly_do, idNv: req.session.staffId || null, laQuanLy: laQuanLy(req),
    });
    realtime.doi(realtime.MIEN.CHOT_CA, { su_kien: 'PHIEU_THU_CHI_HUY' });
    res.json({ ok: true });
  } catch (e) { traLoi(res, e); }
}));

module.exports = router;
