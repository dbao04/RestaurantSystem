/**
 * Router co cau to chuc.
 *
 * Ba man hinh:
 *   /to-chuc      So do to chuc song - ai giu chuc gi, ai dang online
 *   /dieu-hanh    Bang dieu hanh thoi gian thuc - nhan su theo bo phan, viec can xu ly
 *   /to-chuc/quan-ly  Quan tri chuc danh, phan quyen, to, uy quyen  (can quyen)
 *
 * MOI thao tac ghi deu phat su kien qua services/realtime.js truoc khi tra loi,
 * nen man hinh cua nguoi khac cap nhat gan nhu tuc thi ma khong can F5.
 */
const express = require('express');
const toChuc = require('../services/toChucService');
const phanQuyenSv = require('../services/phanQuyenService');
const realtime = require('../services/realtime');
const {
  canDangNhap, canQuyen, canCapBac,
} = require('../middleware/phanQuyen');

const router = express.Router();
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Thong tin nguoi thuc hien de ghi nhat ky. */
function boi(req) {
  return {
    nguoiThucHien: req.hoSo ? `${req.hoSo.ten} (${req.hoSo.ten_cd || '—'})`
      : (req.session.adminname || 'Quản trị'),
    idNguoiThucHien: req.hoSo ? req.hoSo.id_nv : null,
    ip: req.ip,
  };
}

// ===========================================================================
// TRANG
// ===========================================================================

/** So do to chuc - moi nhan vien deu xem duoc de biet minh bao cao cho ai. */
router.get('/to-chuc', canDangNhap, bat(async (req, res) => {
  const [cay, boPhan, tongQuan] = await Promise.all([
    toChuc.soDoToChuc(),
    toChuc.danhSachBoPhan(),
    toChuc.tongQuanVanHanh(),
  ]);
  res.render('staff/to-chuc', {
    title: 'Sơ đồ tổ chức',
    activePage: 'to-chuc',
    cay, boPhan, tongQuan,
  });
}));

/** Bang dieu hanh - danh cho cap quan ly. */
router.get('/dieu-hanh', canDangNhap, canQuyen('dieu_hanh.bang_dieu_khien'), bat(async (req, res) => {
  const [tongQuan, nhanSu, viec, to] = await Promise.all([
    toChuc.tongQuanVanHanh(),
    toChuc.danhSachNhanSu({}),
    toChuc.vieccanXuLy({
      capBac: req.hoSo ? req.hoSo.cap_bac : 1,
      idBp: req.hoSo ? req.hoSo.id_bp : null,
    }),
    toChuc.danhSachTo(),
  ]);
  res.render('staff/dieu-hanh', {
    title: 'Bảng điều hành',
    activePage: 'dieu-hanh',
    tongQuan, nhanSu, viec, to,
  });
}));

/** Quan tri to chuc: chuc danh, phan quyen, bo nhiem, to, uy quyen. */
router.get('/to-chuc/quan-ly', canDangNhap, canQuyen(['to_chuc.chuc_danh', 'to_chuc.bo_nhiem', 'to_chuc.phan_quyen']),
  bat(async (req, res) => {
    const [boPhan, chucDanh, nhanSu, to, uyQuyen, nhatKy] = await Promise.all([
      toChuc.danhSachBoPhan(),
      toChuc.danhSachChucDanh(),
      toChuc.danhSachNhanSu({}),
      toChuc.danhSachTo(),
      toChuc.danhSachUyQuyen(),
      toChuc.nhatKy(60),
    ]);
    res.render('staff/to-chuc-quan-ly', {
      title: 'Quản lý cơ cấu tổ chức',
      activePage: 'to-chuc-quan-ly',
      boPhan, chucDanh, nhanSu, to, uyQuyen, nhatKy,
    });
  }));

// ===========================================================================
// API DOC
// ===========================================================================

router.get('/api/to-chuc/so-do', canDangNhap, bat(async (req, res) => {
  res.json({ cay: await toChuc.soDoToChuc() });
}));

router.get('/api/to-chuc/tong-quan', canDangNhap, bat(async (req, res) => {
  res.json(await toChuc.tongQuanVanHanh());
}));

router.get('/api/to-chuc/nhan-su', canDangNhap, bat(async (req, res) => {
  res.json({
    nhan_su: await toChuc.danhSachNhanSu({
      idBp: req.query.bo_phan ? Number(req.query.bo_phan) : null,
      chuaCoChucDanh: req.query.chua_gan === '1',
    }),
  });
}));

router.get('/api/to-chuc/hien-dien', canDangNhap, bat(async (req, res) => {
  res.json({ online: await realtime.dangOnline() });
}));

router.get('/api/to-chuc/chuc-danh', canDangNhap, bat(async (req, res) => {
  res.json({ chuc_danh: await toChuc.danhSachChucDanh() });
}));

router.get('/api/to-chuc/chuc-danh/:id/quyen', canDangNhap, canQuyen('to_chuc.phan_quyen'),
  bat(async (req, res) => {
    res.json({ nhom: await toChuc.quyenCuaChucDanh(Number(req.params.id)) });
  }));

router.get('/api/to-chuc/to', canDangNhap, bat(async (req, res) => {
  res.json({ to: await toChuc.danhSachTo() });
}));

router.get('/api/to-chuc/to/:id/thanh-vien', canDangNhap, bat(async (req, res) => {
  res.json({ thanh_vien: await toChuc.thanhVienTo(Number(req.params.id)) });
}));

/** Ho so quyen cua chinh minh - giao dien dung de an/hien nut. */
router.get('/api/to-chuc/ho-so', canDangNhap, bat(async (req, res) => {
  if (req.session.adminlogin && !req.hoSo) {
    return res.json({ la_quan_tri: true, quyen: ['*'], ten: req.session.adminname || 'Quản trị' });
  }
  res.json(req.hoSo || {});
}));

router.get('/api/to-chuc/viec', canDangNhap, bat(async (req, res) => {
  res.json({
    viec: await toChuc.vieccanXuLy({
      capBac: req.hoSo ? req.hoSo.cap_bac : 1,
      idBp: req.hoSo ? req.hoSo.id_bp : null,
      gomDaXong: req.query.tat_ca === '1',
    }),
  });
}));

router.get('/api/to-chuc/nhat-ky', canDangNhap, canCapBac(3), bat(async (req, res) => {
  res.json({ nhat_ky: await toChuc.nhatKy(Number(req.query.gioi_han) || 100) });
}));

// ===========================================================================
// API GHI
// ===========================================================================

/** Bo nhiem chuc danh cho nhan vien. */
router.post('/api/to-chuc/bo-nhiem', canDangNhap, canQuyen('to_chuc.bo_nhiem'), bat(async (req, res) => {
  const { id_nv, id_cd } = req.body;
  if (!id_nv || !id_cd) return res.status(400).json({ loi: 'Thiếu nhân viên hoặc chức danh.' });
  try {
    const kq = await toChuc.boNhiem(Number(id_nv), Number(id_cd), boi(req));
    res.json({ ok: true, ...kq });
  } catch (e) {
    res.status(400).json({ loi: e.message });
  }
}));

/** Them / sua chuc danh. */
router.post('/api/to-chuc/chuc-danh', canDangNhap, canQuyen('to_chuc.chuc_danh'), bat(async (req, res) => {
  try {
    await toChuc.luuChucDanh(req.body, boi(req));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ loi: e.message });
  }
}));

router.post('/api/to-chuc/chuc-danh/:id/ngung', canDangNhap, canQuyen('to_chuc.chuc_danh'), bat(async (req, res) => {
  try {
    await toChuc.ngungChucDanh(Number(req.params.id), boi(req));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ loi: e.message });
  }
}));

/** Dat lai toan bo quyen cua mot chuc danh. */
router.post('/api/to-chuc/chuc-danh/:id/quyen', canDangNhap, canQuyen('to_chuc.phan_quyen'), bat(async (req, res) => {
  const ds = Array.isArray(req.body.quyen) ? req.body.quyen : [];
  try {
    const n = await toChuc.datQuyenChucDanh(Number(req.params.id), ds, boi(req));
    res.json({ ok: true, so_quyen: n });
  } catch (e) {
    res.status(400).json({ loi: e.message });
  }
}));

/** Them / sua to lam viec. */
router.post('/api/to-chuc/to', canDangNhap, canQuyen('to_chuc.to.quan_ly'), bat(async (req, res) => {
  try {
    await toChuc.luuTo(req.body, boi(req));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ loi: e.message });
  }
}));

router.post('/api/to-chuc/to/:id/thanh-vien', canDangNhap, canQuyen('to_chuc.to.quan_ly'), bat(async (req, res) => {
  const { id_nv, vai_tro } = req.body;
  const hopLe = ['to_truong', 'to_pho', 'thanh_vien', 'bo'];
  if (!id_nv || !hopLe.includes(vai_tro)) {
    return res.status(400).json({ loi: 'Thiếu nhân viên hoặc vai trò không hợp lệ.' });
  }
  try {
    await toChuc.datThanhVienTo(Number(req.params.id), Number(id_nv), vai_tro, boi(req));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ loi: e.message });
  }
}));

/** Uy quyen tam thoi. */
router.post('/api/to-chuc/uy-quyen', canDangNhap, canQuyen('to_chuc.uy_quyen'), bat(async (req, res) => {
  try {
    const id = await toChuc.taoUyQuyen(req.body, boi(req));
    res.json({ ok: true, id });
  } catch (e) {
    res.status(400).json({ loi: e.message });
  }
}));

router.post('/api/to-chuc/uy-quyen/:id/thu-hoi', canDangNhap, canQuyen('to_chuc.uy_quyen'), bat(async (req, res) => {
  try {
    await toChuc.thuHoiUyQuyen(Number(req.params.id), boi(req));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ loi: e.message });
  }
}));

/**
 * Bao viec len cap tren.
 *
 * Ai cung bao duoc (quyen dieu_hanh.viec.tao co o moi chuc danh) - day la thu
 * nhan vien tuyen dau can nhat: het mon, khach phan nan, thiet bi hong.
 */
router.post('/api/to-chuc/viec', canDangNhap, canQuyen('dieu_hanh.viec.tao'), bat(async (req, res) => {
  try {
    // Mac dinh gui ve chinh bo phan cua nguoi bao neu khong chi dinh.
    const duLieu = { ...req.body };
    if (!duLieu.id_bp_xu_ly && req.hoSo) duLieu.id_bp_xu_ly = req.hoSo.id_bp;
    const id = await toChuc.taoViec(duLieu, boi(req));
    res.json({ ok: true, id });
  } catch (e) {
    res.status(400).json({ loi: e.message });
  }
}));

router.post('/api/to-chuc/viec/:id', canDangNhap, canQuyen('dieu_hanh.viec.xu_ly'), bat(async (req, res) => {
  try {
    const viec = await toChuc.capNhatViec(
      Number(req.params.id), req.body.trang_thai,
      req.hoSo ? req.hoSo.id_nv : null, req.body.ket_qua || null
    );
    res.json({ ok: true, viec });
  } catch (e) {
    res.status(400).json({ loi: e.message });
  }
}));

/** Gui thong bao thoi gian thuc cho mot bo phan / chuc danh / ca nha hang. */
router.post('/api/to-chuc/thong-bao', canDangNhap, canQuyen('dieu_hanh.thong_bao.gui'), bat(async (req, res) => {
  const { noi_dung, ma_bp, ma_cd, toan_bo, muc_do } = req.body;
  if (!noi_dung || !String(noi_dung).trim()) {
    return res.status(400).json({ loi: 'Nội dung thông báo trống.' });
  }
  if (!ma_bp && !ma_cd && !toan_bo) {
    return res.status(400).json({ loi: 'Chưa chọn người nhận.' });
  }

  realtime.phat('thong-bao:moi', {
    noi_dung: String(noi_dung).slice(0, 500),
    muc_do: muc_do || 'binh_thuong',
    nguoi_gui: req.hoSo ? `${req.hoSo.ten} (${req.hoSo.ten_cd})` : (req.session.adminname || 'Quản trị'),
  }, {
    bp: ma_bp || undefined,
    cd: ma_cd || undefined,
    tatCa: Boolean(toan_bo),
  });

  res.json({ ok: true });
}));

/** Doi trang thai lam viec cua chinh minh (dang lam / ban / vang). */
router.post('/api/to-chuc/trang-thai', canDangNhap, bat(async (req, res) => {
  const hopLe = ['dang_lam', 'nghi_phep', 'tam_nghi'];
  if (!hopLe.includes(req.body.trang_thai)) {
    return res.status(400).json({ loi: 'Trạng thái không hợp lệ.' });
  }
  const db = require('../config/db');
  await db.query('UPDATE nhan_vien SET trang_thai_lam_viec = ? WHERE id_nv = ?',
    [req.body.trang_thai, req.hoSo.id_nv]);
  phanQuyenSv.xoaDem(req.hoSo.id_nv);
  realtime.phatToanBo('to-chuc:cap-nhat', {
    hanh_dong: 'doi_trang_thai', id_nv: req.hoSo.id_nv, trang_thai: req.body.trang_thai,
  });
  res.json({ ok: true });
}));

module.exports = router;
