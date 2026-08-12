/**
 * Router quan ly bang cham cong.
 *
 *   GET  /to-chuc/cham-cong           Bang cong theo ngay + sua chua
 *   GET  /api/cham-cong/ngay          Du lieu bang (cho RT.dongBo tu tai lai)
 *   POST /api/cham-cong/sua           Sua gio vao / gio ra
 *   POST /api/cham-cong/them          Them ban ghi cho nguoi khong cham duoc
 *   POST /api/cham-cong/xoa           Xoa ban ghi
 *
 * QUYEN TRUY CAP - CHI CAP 1 (Quan ly nha hang)
 *
 * Bang cham cong la du lieu goc de tinh luong, nen quyen vao day duoc that
 * chat theo yeu cau van hanh: chi CAP BAC 1 moi duoc vao man hinh nay.
 * Trong co cau to chuc hien tai, cap 1 co dung mot chuc danh la "Quan ly nha
 * hang" - ke ca "Tro ly quan ly nha hang" hay "Ke toan truong" (deu cap 2)
 * cung khong vao duoc.
 *
 * Vi sao dung canCapBac(1) chu khong phai canQuyen('nhansu.cham_cong.*'):
 *   - Day la rang buoc theo CAP TRONG TO CHUC, khong phai theo nghiep vu. 13
 *     chuc danh dang duoc cap quyen `cham_cong.xem` (giam sat, to truong, ke
 *     toan vien...) - neu chi doi dieu kien quyen thi phai thu hoi quyen cua
 *     ca 12 chuc danh, va bat ky ai lo cap lai quyen do sau nay la thung.
 *   - canCapBac(1) la mot san cung: du co ai cap nham quyen thi nguoi duoi cap
 *     1 van khong vao duoc.
 *
 * Cac quyen `nhansu.cham_cong.xem/sua` VAN duoc giu nguyen trong CSDL va van
 * quyet dinh nguoi cap 1 duoc SUA hay chi duoc XEM. Chung khong con quyet dinh
 * viec CO VAO DUOC trang hay khong.
 */
const express = require('express');
const cc = require('../services/chamCongService');
const face = require('../services/faceService');
const { canDangNhap, canCapBac, canQuyen } = require('../middleware/phanQuyen');

const router = express.Router();
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const QUYEN_SUA = 'nhansu.cham_cong.sua';

/** Cap bac toi thieu duoc dung man hinh quan ly cham cong. 1 = quan ly nha hang. */
const CAP_QUAN_LY_CHAM_CONG = 1;

/** Hom nay theo gio may chu, dang YYYY-MM-DD. */
function homNay() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ===========================================================================
// TRANG
// ===========================================================================

router.get('/to-chuc/cham-cong', canDangNhap, canCapBac(CAP_QUAN_LY_CHAM_CONG), bat(async (req, res) => {
  const ngay = /^\d{4}-\d{2}-\d{2}$/.test(req.query.ngay || '') ? req.query.ngay : homNay();
  const phanQuyen = require('../services/phanQuyenService');
  const coTheSua = !!(req.hoSo && phanQuyen.coQuyen(req.hoSo, QUYEN_SUA)) || !!req.session.adminlogin;

  const [bang, tongQuan, nhanVien, nhatKy, trangThai] = await Promise.all([
    cc.bangNgay(ngay),
    cc.tongQuanNgay(ngay),
    cc.dsNhanVien(),
    coTheSua ? cc.nhatKySua(60) : Promise.resolve([]),
    face.trangThaiDichVu(),
  ]);

  res.render('staff/cham-cong-quan-ly', {
    title: 'Quản lý chấm công',
    activePage: 'cham-cong-quan-ly',
    ngay, bang, tongQuan, nhanVien, nhatKy, coTheSua, trangThai,
  });
}));

// ===========================================================================
// API
// ===========================================================================

router.get('/api/cham-cong/ngay', canDangNhap, canCapBac(CAP_QUAN_LY_CHAM_CONG), bat(async (req, res) => {
  const ngay = /^\d{4}-\d{2}-\d{2}$/.test(req.query.ngay || '') ? req.query.ngay : homNay();
  const [bang, tongQuan] = await Promise.all([cc.bangNgay(ngay), cc.tongQuanNgay(ngay)]);
  res.json({ ngay, bang, tong_quan: tongQuan });
}));

/**
 * Ba route ghi ben duoi deu tra loi loi bang 400 + `loi` (RT.gui doc truong nay)
 * thay vi de errorHandler bien thanh trang 500 - nguoi dung can doc duoc "giờ ra
 * phải sau giờ vào" ngay tren o nhap.
 */
function traLoi(res, e) {
  res.status(400).json({ ok: false, loi: e.message, thong_bao: e.message });
}

router.post('/api/cham-cong/sua', canDangNhap, canCapBac(CAP_QUAN_LY_CHAM_CONG), canQuyen(QUYEN_SUA), bat(async (req, res) => {
  const { id_cc, gio_vao, gio_ra, ly_do } = req.body;
  try {
    const banGhi = await cc.sua(req, id_cc, { gioVao: gio_vao, gioRa: gio_ra, lyDo: ly_do });
    res.json({ ok: true, ban_ghi: banGhi });
  } catch (e) { traLoi(res, e); }
}));

router.post('/api/cham-cong/them', canDangNhap, canCapBac(CAP_QUAN_LY_CHAM_CONG), canQuyen(QUYEN_SUA), bat(async (req, res) => {
  const { id_nv, ngay, gio_vao, gio_ra, ly_do } = req.body;
  try {
    res.json({ ok: true, ...(await cc.them(req, { idNv: id_nv, ngay, gioVao: gio_vao, gioRa: gio_ra, lyDo: ly_do })) });
  } catch (e) { traLoi(res, e); }
}));

router.post('/api/cham-cong/xoa', canDangNhap, canCapBac(CAP_QUAN_LY_CHAM_CONG), canQuyen(QUYEN_SUA), bat(async (req, res) => {
  try {
    res.json({ ok: true, ...(await cc.xoa(req, req.body.id_cc, req.body.ly_do)) });
  } catch (e) { traLoi(res, e); }
}));

module.exports = router;
