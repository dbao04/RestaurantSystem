/**
 * Router cham cong bang khuon mat.
 *
 * Ba nhom trang:
 *   /cham-cong-khuon-mat        Kiosk 1:N - dat o cua, ai dung truoc thi nhan dien
 *   /staff/attendance          Ca nhan: dang ky khuon mat + tu cham cong 1:1 +
 *                              lich su. (/staff/khuon-mat chuyen huong toi day)
 *   /to-chuc/khuon-mat         Quan ly: dang ky ho, xem nhat ky, danh gia mo hinh
 *
 * Anh (base64) co the lon, nen router nay tu nang gioi han body rieng thay vi
 * dung gioi han mac dinh cua toan app.
 */
const express = require('express');
const face = require('../services/faceService');
const { canDangNhap, canQuyen, canCapBac } = require('../middleware/phanQuyen');

const router = express.Router();
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Anh webcam base64 nang -> cho phep body toi 25 MB cho rieng cac route nay.
const nhanAnh = express.json({ limit: '25mb' });

// Quyen quan ly khuon mat dung chung voi quyen sua cham cong.
const QUYEN_QL = 'nhansu.cham_cong.sua';
const QUYEN_XEM = 'nhansu.cham_cong.xem';

/**
 * Chon toa do nha hang la viec cua CAP 1 (Quan ly nha hang).
 *
 * Doi mot toa do la doi noi ma toan bo nhan vien duoc phep cham cong. Ai sua
 * duoc toa do la sua duoc cham cong cua ca nha hang: keo diem ve nha rieng roi
 * cham cong tu xa, hoac noi rong ban kinh cho ca ca lam. Vi vay viec nay tach
 * khoi quyen `nhansu.cham_cong.sua` (Ke toan truong - cap 2 - cung dang co
 * quyen do de sua gio cong) va rang buoc thang vao cap bac.
 *
 * Bep truong / Ke toan truong van XEM duoc toa do de biet pham vi, chi khong
 * doi duoc.
 */
const CAP_DAT_VI_TRI = 1;

// ===========================================================================
// TRANG
// ===========================================================================

/** Kiosk 1:N - can dang nhap de mo (quan ly bat may dau ca), sau do tu phuc vu. */
router.get('/cham-cong-khuon-mat', canDangNhap, bat(async (req, res) => {
  const tt = await face.trangThaiDichVu();
  res.render('staff/khuon-mat-kiosk', {
    title: 'Chấm công khuôn mặt',
    layout: false,
    trangThai: tt,
  });
}));

/**
 * Trang tu dang ky lan dau.
 *
 * Sau khi dang nhap, nhan vien chua co mau khuon mat duoc dua thang toi day.
 * Trang tu chup vai khung o ba tu the roi dang ky - khong phai bam chup, khong
 * tai anh. Luon co lien ket "bo qua" de khong chan viec vao he thong.
 */
router.get('/staff/khuon-mat/lan-dau', canDangNhap, bat(async (req, res) => {
  const tt = await face.trangThaiDichVu();
  res.render('staff/khuon-mat-lan-dau', {
    title: 'Đăng ký khuôn mặt',
    layout: false,
    trangThai: tt,
  });
}));

/**
 * Trang ca nhan cu - nay da GOP vao /staff/attendance.
 *
 * Truoc day day la mot trang rieng: dang ky khuon mat + MOT may tu cham cong
 * 1:1 nua, trong khi /staff/attendance cung da co may tu cham cong 1:1. Cung
 * mot viec viet hai lan, hai giao dien, hai doan ma phai sua song song. Nhan
 * vien thi khong biet nen vao dau, ma cau tra loi dung la "dau cung duoc".
 *
 * Giu lai duong dan va chuyen huong thay vi xoa han: menu cu, dau trang cua
 * nhan vien va cac lien ket trong huong dan van con tro toi day.
 */
router.get('/staff/khuon-mat', canDangNhap, (req, res) => {
  res.redirect('/staff/attendance');
});

/** Trang quan ly. */
router.get('/to-chuc/khuon-mat', canDangNhap, canQuyen([QUYEN_QL, QUYEN_XEM]), bat(async (req, res) => {
  const [tt, dsDangKy, nhatKy, tongQuan, viTri, nhanDien] = await Promise.all([
    face.trangThaiDichVu(),
    face.danhSachDangKy(),
    face.nhatKyGanDay(80),
    face.tongQuan(),
    face.cauHinhViTri(),
    face.cauHinhNhanDien(),
  ]);
  const phanQuyen = require('../services/phanQuyenService');
  res.render('staff/khuon-mat-quan-ly', {
    title: 'Quản lý chấm công khuôn mặt',
    activePage: 'khuon-mat-quan-ly',
    trangThai: tt, dsDangKy, nhatKy, tongQuan, viTri, nhanDien,
    // Dang ky / xoa mau khuon mat: theo quyen nghiep vu nhu cu.
    coTheSua: !!(req.hoSo && phanQuyen.coQuyen(req.hoSo, QUYEN_QL)) || !!req.session.adminlogin,
    // Chon toa do nha hang: rieng cap 1. Tach hai co ra vi hai viec nay khac
    // muc do anh huong han nhau - xem chu thich o CAP_DAT_VI_TRI phia tren.
    coTheSuaViTri: !!(req.hoSo && phanQuyen.tuCapBac(req.hoSo, CAP_DAT_VI_TRI)) || !!req.session.adminlogin,
  });
}));

// ===========================================================================
// API
// ===========================================================================

/** Tinh trang dich vu - cho banner. */
router.get('/api/khuon-mat/trang-thai', canDangNhap, bat(async (req, res) => {
  res.json(await face.trangThaiDichVu());
}));

/**
 * Cham cong bang khuon mat.
 * Kiosk (1:N): khong gui id_nv. Ca nhan (1:1): gui id_nv = chinh minh.
 */
router.post('/api/khuon-mat/cham-cong', canDangNhap, nhanAnh, bat(async (req, res) => {
  const { khung, thu_thach, che_do, vi_tri } = req.body;
  if (!Array.isArray(khung) || !khung.length) {
    return res.status(400).json({ ok: false, thong_bao: 'Chưa có khung hình nào.' });
  }
  // Che do "ca_nhan" chi cho cham cho CHINH MINH - khong nhan id_nv tu client
  // de tranh nguoi khac gui id nguoi khac len. Lay tu phien dang nhap.
  const idNv = che_do === 'ca_nhan' && req.hoSo ? req.hoSo.id_nv : null;
  const kq = await face.chamCong(khung, {
    thuThach: thu_thach || 'gat_dau',
    idNv,
    // Toa do do trinh duyet gui len. Khong tin tuyet doi duoc (nguoi dung sua
    // duoc JavaScript), nen moi lan deu ghi vao cham_cong_gps de doi chieu ve
    // sau; day la rang buoc van hanh chu khong phai bien phap chong gian lan
    // tuyet doi.
    viTri: vi_tri || null,
    diaChiIp: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null,
  });
  res.json(kq);
}));

/** Cau hinh vi tri nha hang - doc de hien man hinh quan ly. */
router.get('/api/khuon-mat/vi-tri', canDangNhap, canQuyen([QUYEN_QL, QUYEN_XEM]), bat(async (req, res) => {
  res.json({ ok: true, cau_hinh: await face.cauHinhViTri() });
}));

/** Luu toa do nha hang / ban kinh / bat-tat rang buoc GPS. Chi cap 1. */
router.post('/api/khuon-mat/vi-tri', canDangNhap, canCapBac(CAP_DAT_VI_TRI), bat(async (req, res) => {
  const { vi_do, kinh_do, ban_kinh_m, bat_gps } = req.body;
  try {
    const cauHinh = await face.luuCauHinhViTri({
      viDo: vi_do, kinhDo: kinh_do, banKinhM: ban_kinh_m, batGps: bat_gps,
    });
    res.json({ ok: true, cau_hinh: cauHinh });
  } catch (e) {
    res.status(400).json({ ok: false, loi: e.message, thong_bao: e.message });
  }
}));

/** Cau hinh nhan dien (nguong khop, do kho dong tac...) - doc. */
router.get('/api/khuon-mat/cau-hinh', canDangNhap, canQuyen([QUYEN_QL, QUYEN_XEM]), bat(async (req, res) => {
  res.json({ ok: true, cau_hinh: await face.cauHinhNhanDien() });
}));

/**
 * Luu cau hinh nhan dien.
 *
 * Ha nguong khop la noi long dieu kien vao ca cho TOAN BO nhan vien, dung muc do
 * anh huong voi viec doi toa do nha hang - nen dat cung mot rao: cap 1.
 */
router.post('/api/khuon-mat/cau-hinh', canDangNhap, canCapBac(CAP_DAT_VI_TRI), bat(async (req, res) => {
  const { nguong_phan_tram, chan_cham_ho, bat_kiem_tra_song, muc_dong_tac } = req.body;
  try {
    const cauHinh = await face.luuCauHinhNhanDien({
      nguongPhanTram: nguong_phan_tram,
      chanChamHo: chan_cham_ho,
      batKiemTraSong: bat_kiem_tra_song,
      mucDongTac: muc_dong_tac,
    });
    res.json({ ok: true, cau_hinh: cauHinh });
  } catch (e) {
    res.status(400).json({ ok: false, loi: e.message, thong_bao: e.message });
  }
}));

/**
 * Dang ky khuon mat.
 * Nhan vien tu dang ky cho minh; nguoi co quyen QL co the dang ky cho nguoi khac.
 */
router.post('/api/khuon-mat/dang-ky', canDangNhap, nhanAnh, bat(async (req, res) => {
  const { id_nv, anh, thay_the } = req.body;
  if (!Array.isArray(anh) || !anh.length) {
    return res.status(400).json({ ok: false, thong_bao: 'Chưa có ảnh nào.' });
  }

  const phanQuyen = require('../services/phanQuyenService');
  const coQuyenQL = (req.hoSo && phanQuyen.coQuyen(req.hoSo, QUYEN_QL)) || req.session.adminlogin;
  const idMinh = req.hoSo ? req.hoSo.id_nv : null;
  const idMucTieu = Number(id_nv) || idMinh;

  // Chi cho dang ky cho nguoi khac neu co quyen quan ly.
  if (idMucTieu !== idMinh && !coQuyenQL) {
    return res.status(403).json({ ok: false, thong_bao: 'Bạn chỉ được đăng ký khuôn mặt của chính mình.' });
  }
  if (!idMucTieu) {
    return res.status(400).json({ ok: false, thong_bao: 'Không xác định được nhân viên.' });
  }

  const nguoiDangKy = req.hoSo ? `${req.hoSo.ten} (${req.hoSo.ten_cd || '—'})`
    : (req.session.adminname || 'Quản trị');
  try {
    const kq = await face.dangKy(idMucTieu, anh, nguoiDangKy, !!thay_the);
    res.json({ ok: true, ...kq });
  } catch (e) {
    res.status(400).json({ ok: false, thong_bao: e.message });
  }
}));

/** Xoa mau khuon mat cua mot nhan vien. */
router.post('/api/khuon-mat/xoa', canDangNhap, canQuyen(QUYEN_QL), bat(async (req, res) => {
  const idNv = Number(req.body.id_nv);
  if (!idNv) return res.status(400).json({ ok: false, thong_bao: 'Thiếu nhân viên.' });
  try {
    await face.xoa(idNv);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, thong_bao: e.message });
  }
}));

/** Danh sach dang ky. */
router.get('/api/khuon-mat/danh-sach', canDangNhap, canQuyen([QUYEN_QL, QUYEN_XEM]), bat(async (req, res) => {
  res.json({ danh_sach: await face.danhSachDangKy(), tong_quan: await face.tongQuan() });
}));

/** Nhat ky nhan dien. */
router.get('/api/khuon-mat/nhat-ky', canDangNhap, canQuyen([QUYEN_QL, QUYEN_XEM]), bat(async (req, res) => {
  res.json({ nhat_ky: await face.nhatKyGanDay(Number(req.query.gioi_han) || 100) });
}));

/** Chay lai danh gia mo hinh (SFace vs LBPH). */
router.post('/api/khuon-mat/danh-gia', canDangNhap, canQuyen(QUYEN_QL), bat(async (req, res) => {
  try {
    res.json({ ok: true, ...(await face.danhGia()) });
  } catch (e) {
    res.status(400).json({ ok: false, thong_bao: e.message });
  }
}));

module.exports = router;
