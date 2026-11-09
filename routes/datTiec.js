/**
 * Router KHONG GIAN + DAT TIEC.
 *
 *   /khong-gian                      KHACH  xem anh cac khu, phong
 *   /dat-tiec, /api/dat-tiec/*       KHACH  dat tiec cuoi, sinh nhat, party...
 *   /staff/dat-tiec, /api/staff/dat-tiec/*  NHAN VIEN  xu ly yeu cau tiec
 */
const express = require('express');
const dv = require('../services/datTiecService');
const realtime = require('../services/realtime');
const phanQuyen = require('../middleware/phanQuyen');
const { ngayCucBo } = require('../utils/thoiGian');

const router = express.Router();
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function traLoi(res, e) {
  if (e && e.name === 'LoiDatTiec') {
    return res.status(e.ma === 'NOT_FOUND' ? 404 : e.ma === 'CONFLICT' ? 409 : e.ma === 'FORBIDDEN' ? 403 : 400)
      .json({ ok: false, ma: e.ma, thong_bao: e.message });
  }
  console.error('[dat-tiec] lỗi:', e);
  return res.status(500).json({ ok: false, thong_bao: 'Hệ thống đang bận, vui lòng thử lại.' });
}

// ------------------------------------------------------------------ khach

router.get('/khong-gian', bat(async (req, res) => {
  res.render('khong-gian', {
    title: 'Không gian nhà hàng',
    activeNav: 'khonggian',
    khongGian: await dv.docKhongGian(),
  });
}));

router.get('/dat-tiec', bat(async (req, res) => {
  const homNay = ngayCucBo();
  const [sanh, thucDon, dichVu] = await Promise.all([dv.docSanhTiec(), dv.docThucDon(), dv.docDichVu()]);
  res.render('dat-tiec', {
    title: 'Đặt tiệc',
    activeNav: 'dattiec',
    loaiTiec: dv.LOAI_TIEC,
    buoi: dv.BUOI,
    sanh,
    thucDon,
    dichVu,
    khachMoiBan: dv.KHACH_MOI_BAN,
    ngayMin: dv.cong(homNay, dv.DAT_TRUOC_TOI_THIEU_NGAY),
    ngayMax: dv.cong(homNay, dv.DAT_TRUOC_TOI_DA_NGAY),
    chon: {
      loai: dv.LOAI_TIEC[req.query.loai] ? req.query.loai : '',
      sanh: Number(req.query.sanh) || '',
    },
    khach: req.session && req.session.userId ? {
      ten: req.session.username || '',
      sdt: req.session.usersdt || '',
    } : null,
  });
}));

/** Buoi da kin trong mot ngay - form dung de khoa lua chon. */
router.get('/api/dat-tiec/lich', bat(async (req, res) => {
  const ngay = String(req.query.ngay || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return res.json({ ok: true, kin: [] });
  res.json({ ok: true, kin: await dv.lichDaKin(ngay, ngay) });
}));

router.post('/api/dat-tiec', bat(async (req, res) => {
  try {
    const kq = await dv.taoDonTiec(req.body, { customerId: (req.session && req.session.userId) || null });
    realtime.doi(realtime.MIEN.DAT_BAN, { su_kien: 'DAT_TIEC_MOI', ma: kq.ma });
    res.status(201).json({ ok: true, ...kq });
  } catch (e) { traLoi(res, e); }
}));

// ------------------------------------------------------------------ nhan vien

const canNhanVien = phanQuyen.canVaiTroCu(['Phuc vu', 'Quay', 'letan', 'Thu ngan', 'Ke toan', 'Quan ly']);
const apiCanDangNhap = (req, res, next) => {
  if (req.session && (req.session.stafflogin || req.session.adminlogin)) return next();
  return res.status(401).json({ ok: false, thong_bao: 'Chưa đăng nhập' });
};

router.use('/staff/dat-tiec', canNhanVien);
router.use('/api/staff/dat-tiec', apiCanDangNhap, canNhanVien);

/** Quyen trong luong tien tiec: ai duoc thu tien, ai duoc hoan coc. */
function quyenTiec(req) {
  const ps = require('../services/phanQuyenService');
  const phien = req.session || {};
  const co = (ds) => !!(phien.adminlogin || ds.includes(phien.staffRole) || ps.dongVaiDuoc(req.hoSo, ds));
  return {
    id: phien.staffId || null,
    coQuyenThuTien: co(['Quay', 'letan', 'Thu ngan', 'Quan ly']),
    laQuanLy: co(['Quan ly']),
  };
}

router.get('/staff/dat-tiec', bat(async (req, res) => {
  const personnelService = require('../services/personnelService');
  const loc = {
    trangThai: String(req.query.trang_thai || ''),
    tuNgay: String(req.query.tu_ngay || ''),
    tim: String(req.query.tim || '').trim().slice(0, 60),
  };
  await dv.damBaoCotTien();
  const [ds, tk] = await Promise.all([dv.danhSach(loc), dv.thongKe()]);
  res.render('staff/dat-tiec', {
    title: 'Quản lý Đặt tiệc',
    activePage: 'dattiec',
    unread: await personnelService.countUnread(req.session.staffId).catch(() => 0),
    ds,
    tk,
    loc,
    trangThai: dv.TRANG_THAI,
    chuyenTiec: dv.CHUYEN_TIEC,
    phuongThuc: dv.PHUONG_THUC_TIEC,
    tyLeCoc: dv.TY_LE_COC,
    quyen: quyenTiec(req),
  });
}));

// Ke hoach nguyen lieu cua tiec (services/tiecVanHanhService.js).
router.get('/api/staff/dat-tiec/:id/nguyen-lieu', bat(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ ok: false, thong_bao: 'Không tìm thấy' });
  const kq = await require('../services/tiecVanHanhService').keHoachNguyenLieu(Number(req.params.id));
  if (!kq) return res.status(404).json({ ok: false, thong_bao: 'Không tìm thấy tiệc' });
  res.json({ ok: true, ...kq });
}));

router.post('/api/staff/dat-tiec/:id/trang-thai', bat(async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ ok: false, thong_bao: 'Không tìm thấy' });
    const b = req.body || {};
    const kq = await dv.capNhatTrangThai(Number(req.params.id), {
      trangThai: b.trang_thai,
      ghiChuNoiBo: b.ghi_chu_noi_bo,
      soTien: b.so_tien,
      tongThucTe: b.tong_thuc_te,
      phuongThuc: b.phuong_thuc,
      lyDoHuy: b.ly_do_huy,
      hoanCoc: b.hoan_coc === true || b.hoan_coc === '1',
    }, quyenTiec(req));
    realtime.doi(realtime.MIEN.DAT_BAN, { su_kien: 'DAT_TIEC_CAP_NHAT' });
    res.json({ ok: true, da_hoan: kq.da_hoan || 0 });
  } catch (e) { traLoi(res, e); }
}));

module.exports = router;
