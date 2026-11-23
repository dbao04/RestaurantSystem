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
const { dich } = require('../services/dichThongBao');

const router = express.Router();
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function traLoi(res, e) {
  // Chi dich cho API khu khach (/api/dat-tiec*); khu nhan vien giu tieng Viet.
  const req = res.req || {};
  const nn = String(req.originalUrl || '').startsWith('/api/dat-tiec') ? req.ngonNgu : 'vi';
  if (e && e.name === 'LoiDatTiec') {
    return res.status(e.ma === 'NOT_FOUND' ? 404 : e.ma === 'CONFLICT' ? 409 : e.ma === 'FORBIDDEN' ? 403 : 400)
      .json({ ok: false, ma: e.ma, thong_bao: dich(e.message, nn) });
  }
  console.error('[dat-tiec] lỗi:', e);
  return res.status(500).json({ ok: false, thong_bao: dich('Hệ thống đang bận, vui lòng thử lại.', nn) });
}

// ------------------------------------------------------------------ khach

router.get('/khong-gian', bat(async (req, res) => {
  res.render('khong-gian', {
    title: 'Không gian nhà hàng',
    activeNav: 'khonggian',
    khongGian: await dv.docKhongGian(),
  });
}));

// Quy trinh dat tiec online: services/datTiecQuyTrinh.js
const qt = require('../services/datTiecQuyTrinh');

router.get('/dat-tiec', bat(async (req, res) => {
  const homNay = ngayCucBo();
  const ch = await qt.cauHinh();
  const [thucDonGoc, dichVu, monLe] = await Promise.all([dv.docThucDon(), dv.docDichVu(), qt.docMonLe()]);
  const thucDon = await qt.ganAnhThucDon(thucDonGoc);
  res.render('dat-tiec', {
    title: 'Đặt tiệc',
    activeNav: 'dattiec',
    loaiTiec: dv.LOAI_TIEC,
    buoi: dv.BUOI,
    sanh: ch.sanh,
    thucDon,
    dichVu,
    monLe,
    ch,
    chinhSach: qt.chinhSach(ch),
    khachMoiBan: dv.KHACH_MOI_BAN,
    ngayMin: dv.cong(homNay, ch.dat_truoc_toi_thieu_ngay),
    ngayMax: dv.cong(homNay, ch.dat_truoc_toi_da_ngay),
    chon: { loai: dv.LOAI_TIEC[req.query.loai] ? req.query.loai : '' },
    khach: req.session && req.session.userId ? {
      ten: req.session.username || '',
      sdt: req.session.usersdt || '',
    } : null,
  });
}));

/** Lich thang cua Sanh Gala: ngay trong / con mot buoi / kin / khong nhan. */
router.get('/api/dat-tiec/lich-thang', bat(async (req, res) => {
  res.json({ ok: true, ...(await qt.lichThang(String(req.query.thang || ''))) });
}));

/** Buoi da kin trong mot ngay - form dung de khoa lua chon. */
router.get('/api/dat-tiec/lich', bat(async (req, res) => {
  const ngay = String(req.query.ngay || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return res.json({ ok: true, kin: [], nhan: false, ly_do: 'Ngày không hợp lệ.' });
  // `kin` giu cho trang cu; `buoi` (gio trong / da co tiec) cho buoc chon gio moi.
  res.json({ ok: true, kin: await dv.lichDaKin(ngay, ngay), ...(await qt.lichNgay(ngay)) });
}));

// ------------------------------------------------------------------ thanh toan tiec (khach)

/** Don tiec cua khach: khop tai khoan dang nhap hoac so dien thoai (?dt=) da dung khi dat. */
async function donCuaKhach(req, ma) {
  await qt.damBaoCauTruc();
  const [[don]] = await require('../config/db').query(
    `SELECT t.*, DATE_FORMAT(t.ngay_to_chuc, '%Y-%m-%d') AS ngay, TIME_FORMAT(t.gio_bat_dau, '%H:%i') AS gio,
            v.Name_vitri AS ten_sanh, d.ten AS ten_thuc_don
       FROM dat_tiec t LEFT JOIN vitri v ON v.id_vitri = t.khu_vuc_id LEFT JOIN thuc_don_tiec d ON d.id = t.thuc_don_id
      WHERE t.ma_tiec = ?`, [String(ma || '')]);
  if (!don) return null;
  const so = (x) => String(x || '').replace(/\D/g, '').replace(/^84/, '0');
  const dungTk = req.session && req.session.userId && Number(don.customer_id) === Number(req.session.userId);
  const dungSo = (req.query.dt && so(req.query.dt) === so(don.so_dien_thoai))
    || (req.session && req.session.usersdt && so(req.session.usersdt) === so(don.so_dien_thoai));
  return dungTk || dungSo ? don : null;
}

function giaLapKhachTiec() {
  return process.env.NODE_ENV !== 'production' && process.env.PAYMENT_SIMULATION === '1' && process.env.PAYMENT_SIMULATION_KHACH === '1';
}

router.get('/dat-tiec/thanh-toan/:ma', bat(async (req, res) => {
  await qt.hetHanGiuCho();
  const don = await donCuaKhach(req, req.params.ma);
  if (!don) {
    return res.status(404).render('error', { title: 'Không tìm thấy', statusCode: 404,
      message: 'Không tìm thấy đơn tiệc. Đăng nhập đúng tài khoản đã đặt hoặc mở lại đường dẫn trong thông báo.' });
  }
  const ch = await qt.cauHinh();
  const khoan = qt.khoanCanTra(don, ch);
  let qr = null, taiKhoan = null;
  if (khoan && khoan.so_tien > 0) {
    const tt = require('../services/thanhToanService');
    taiKhoan = await tt.layTaiKhoanNhan().catch(() => null);
    if (taiKhoan) {
      qr = await require('../services/vietQR').taoQRChuyenKhoan({
        maNganHang: taiKhoan.maNganHang, soTaiKhoan: taiKhoan.soTaiKhoan, tenTaiKhoan: taiKhoan.tenTaiKhoan,
        soTien: khoan.so_tien, noiDung: `TIEC ${don.ma_tiec}`,
      }, { kichThuoc: 280 }).catch(() => null);
    }
  }
  res.render('thanh-toan-tiec', {
    title: 'Thanh toán tiệc ' + don.ma_tiec,
    activeNav: 'dattiec',
    don: {
      ...don, dich_vu: (() => { try { return JSON.parse(don.dich_vu || '[]'); } catch (_) { return []; } })(),
      thuc_don_tuy_chinh: (() => { try { return typeof don.thuc_don_tuy_chinh === 'string' ? JSON.parse(don.thuc_don_tuy_chinh) : don.thuc_don_tuy_chinh; } catch (_) { return null; } })(),
      ten_loai: (dv.LOAI_TIEC[don.loai_tiec] || {}).ten || don.loai_tiec,
      ten_buoi: (dv.BUOI[don.buoi] || {}).ten || don.buoi,
      ten_trang_thai: dv.TRANG_THAI[don.trang_thai] || don.trang_thai,
    },
    ch, khoan, qr, taiKhoan,
    chinhSach: qt.chinhSach(ch),
    hoan: qt.phanTramHoan(don.ngay, ch),
    giaLap: giaLapKhachTiec(),
    dt: req.query.dt || '',
  });
}));

/** Trang thai don (trang thanh toan hoi moi vai giay de tu chuyen khi da nhan tien). */
router.get('/api/dat-tiec/:ma/trang-thai', bat(async (req, res) => {
  await qt.hetHanGiuCho();
  const don = await donCuaKhach(req, req.params.ma);
  if (!don) return res.status(404).json({ ok: false });
  const ch = await qt.cauHinh();
  const k = qt.khoanCanTra(don, ch);
  res.json({ ok: true, trang_thai: don.trang_thai, ten: dv.TRANG_THAI[don.trang_thai], da_thu: Number(don.da_thu) || 0, can_tra: k ? k.so_tien : 0 });
}));

/** Demo: gia lap khach da chuyen khoan dung so tien (PAYMENT_SIMULATION_KHACH=1). */
router.post('/dat-tiec/thanh-toan/:ma/gia-lap', bat(async (req, res) => {
  if (!giaLapKhachTiec()) return res.status(404).json({ ok: false, thong_bao: 'Thanh toán giả lập đang tắt.' });
  const don = await donCuaKhach(req, req.params.ma);
  if (!don) return res.status(404).json({ ok: false, thong_bao: 'Không tìm thấy đơn tiệc.' });
  const k = qt.khoanCanTra(don, await qt.cauHinh());
  if (!k || k.so_tien <= 0) return res.status(400).json({ ok: false, thong_bao: 'Đơn tiệc không có khoản nào chờ thanh toán.' });
  try {
    const kq = await qt.ghiNhanChuyenKhoan(don.ma_tiec, k.so_tien, { maGiaoDich: 'SIM-TIEC-' + Date.now(), nguon: 'web' });
    realtime.doi(realtime.MIEN.DAT_BAN, { su_kien: 'DAT_TIEC_THANH_TOAN', ma: don.ma_tiec });
    res.json({ ok: true, ...kq });
  } catch (e) {
    res.status(400).json({ ok: false, thong_bao: e.message });
  }
}));

router.post('/api/dat-tiec', bat(async (req, res) => {
  try {
    const kq = await dv.taoDonTiec(req.body, { customerId: (req.session && req.session.userId) || null });
    realtime.doi(realtime.MIEN.DAT_BAN, { su_kien: 'DAT_TIEC_MOI', ma: kq.ma });
    res.status(201).json({ ok: true, ...kq });
  } catch (e) { traLoi(res, e); }
}));

/** Khach tu huy don tiec cua minh khi con "Yeu cau moi" (trang /my-orders). */
router.post('/api/dat-tiec/:ma/huy', bat(async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ ok: false, thong_bao: dich('Vui lòng đăng nhập để hủy tiệc.', req.ngonNgu) });
  }
  try {
    const kq = await dv.huyBoiKhach(req.params.ma, {
      userId: req.session.userId, phone: req.session.usersdt, lyDo: req.body && req.body.ly_do,
    });
    realtime.doi(realtime.MIEN.DAT_BAN, { su_kien: 'DAT_TIEC_HUY', ma: kq.ma });
    if (kq.da_thu > 0) {
      require('../services/thongBaoService').gui('dat_tiec_moi', {
        nhom: ['QUAN_LY'], mucDo: 'khan', link: '/staff/dat-tiec',
        tieuDe: `Khách hủy tiệc ${kq.ma} - cần hoàn ${kq.tien_hoan.toLocaleString('vi-VN')}đ`,
        noiDung: `Đã thu ${kq.da_thu.toLocaleString('vi-VN')}đ, hoàn ${kq.phan_tram_hoan}% theo chính sách.`,
      }).catch(() => {});
    }
    res.json(kq);
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
  await qt.hetHanGiuCho();
  const ch = await qt.cauHinh();
  const [dsGoc, tk] = await Promise.all([dv.danhSach(loc), dv.thongKe()]);
  const ds = dsGoc.map((d) => ({
    ...d,
    thuc_don_tuy_chinh: (() => { try { return typeof d.thuc_don_tuy_chinh === 'string' ? JSON.parse(d.thuc_don_tuy_chinh) : d.thuc_don_tuy_chinh; } catch (_) { return null; } })(),
    hoan: qt.phanTramHoan(d.ngay, ch),
  }));
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
    tyLeCoc: ch.ty_le_coc / 100,
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
      tongBaoGia: b.tong_bao_gia,
      soKhachThucTe: b.so_khach_thuc_te,
      phuongThuc: b.phuong_thuc,
      lyDoHuy: b.ly_do_huy,
      hoanCoc: b.hoan_coc === true || b.hoan_coc === '1',
    }, quyenTiec(req));
    realtime.doi(realtime.MIEN.DAT_BAN, { su_kien: 'DAT_TIEC_CAP_NHAT' });
    res.json({ ok: true, da_hoan: kq.da_hoan || 0 });
  } catch (e) { traLoi(res, e); }
}));

module.exports = router;
