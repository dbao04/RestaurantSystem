/**
 * Router giao hang - bon nhom nguoi dung, bon khu duong dan.
 *
 *   /admin/van-chuyen/...   QUAN TRI   khai don vi van chuyen, bang gia, shipper
 *   /staff/giao-hang/...    DIEU PHOI  nhan don, phan shipper, ban do, xu ly su co
 *   /shipper/...            SHIPPER    ung dung dien thoai: don cua toi + dinh vi
 *   /theo-doi/...           KHACH      xem don minh dang o dau, khong can dang nhap
 *
 * VI SAO TACH LAM BON KHU CHU KHONG MOT MAN HINH CHUNG
 * ----------------------------------------------------
 * Bon nguoi nay lam bon viec khac han nhau, tren bon thiet bi khac nhau. Nhet
 * chung vao mot man hinh roi an bot theo quyen thi shipper phai cuon qua bang
 * gia va danh sach don cua ca doi - tren mot man hinh 5 inch, giua duong, mot
 * tay cam mu bao hiem. Trang /shipper co dung mot cot, chu to, va ba nut.
 *
 * PHAN QUYEN O TANG NAO
 * ---------------------
 * Khu quan tri chan bang phien `adminlogin` - giong het cac router quan tri khac.
 * Khu dieu phoi chan bang QUYEN chi tiet (`giao_hang.xem`, `giao_hang.phan_cong`),
 * khong chan bang chuc danh: nha hang co the muon Truong le tan kiem dieu phoi
 * gio thap diem ma khong phai doi chuc danh cua ho.
 * Khu shipper chan bang mot dieu kien khac han: nguoi dang nhap phai co MOT DONG
 * trong bang `shipper`. Bo nhiem chuc danh SHIPPER thoi thi chua du - phai co ho
 * so shipper that (xe gi, bien so nao, thuoc don vi nao) moi giao don duoc.
 *
 * MOI THAO TAC GHI DEU LA POST
 * ----------------------------
 * Ke ca "go shipper" hay "huy don" - nhung viec ma phan con lai cua he thong
 * dang lam bang GET (/admin/catdel/5). Don giao hang doi trang thai thi khong
 * lui lai duoc; mot con bot quet link hay mot lan bam nham F5 tren trang GET la
 * mot don bi huy that.
 */
const express = require('express');
const vc = require('../services/vanChuyenService');
const realtime = require('../services/realtime');
const phanQuyen = require('../middleware/phanQuyen');
const diaChiQR = require('../utils/diaChiQR');

const router = express.Router();
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Chan cac `:id` khong phai so.
 *
 * Express 5 (path-to-regexp v8) da bo cu phap `:id(\\d+)` - viet the se nem loi
 * ngay luc nap router, khong phai luc co request. Nen rang buoc "phai la so"
 * chuyen thanh mot middleware. Can that: `/staff/giao-hang/ban-do` va
 * `/staff/giao-hang/:id` cung khop mot mau, va route `ban-do` dung sau thi
 * `:id` se nuot mat no.
 */
const laSo = (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) return next('route');
  next();
};

// ===========================================================================
// CHAN CUA
// ===========================================================================

/** Phien quan tri (tb_admin). Giong `requireAdmin` trong server.js. */
const canQuanTri = (req, res, next) => {
  if (req.session && req.session.adminlogin) return next();
  return res.redirect('/admin/login');
};

/**
 * Nguoi dang dang nhap la ai, dung de ghi nhat ky.
 *
 * Quan tri khong co `id_nv` (ho khong nam trong bang `nhan_vien`) nen chi ghi
 * duoc ten. Nhat ky chap nhan `id_nv` NULL dung vi truong hop nay.
 */
function nguoiDung(req) {
  if (req.hoSo) return { id_nv: req.hoSo.id_nv, ten: String(req.hoSo.ten || '').trim() };
  if (req.session && req.session.adminlogin) {
    return { id_nv: null, ten: req.session.adminname || 'Quản trị viên' };
  }
  return { id_nv: null, ten: 'Hệ thống' };
}

/**
 * Chan khu ung dung shipper.
 *
 * Nap luon ho so shipper vao `req.shipper` de moi route ben duoi khong phai
 * truy van lai. Nguoi da dang nhap nhung chua co ho so shipper nhan mot trang
 * giai thich - khong phai 403 trong tron - vi day gan nhu chac chan la nguoi
 * that vua duoc bo nhiem ma quan ly quen tao ho so.
 */
const canShipper = bat(async (req, res, next) => {
  const laApi = req.path.startsWith('/api/');
  if (!req.session || !req.session.stafflogin || !req.session.staffId) {
    if (laApi) return res.status(401).json({ ok: false, thong_bao: 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.' });
    return res.redirect('/staff/login?tiep=' + encodeURIComponent(req.originalUrl));
  }
  const sp = await vc.shipperCuaNhanVien(req.session.staffId);
  if (!sp) {
    if (laApi) return res.status(403).json({ ok: false, thong_bao: 'Bạn chưa được lập hồ sơ shipper.' });
    return res.status(403).render('shipper-chua-co', {
      layout: false,
      title: 'Chưa có hồ sơ shipper',
      hoTen: req.session.staffName || 'Bạn',
    });
  }
  req.shipper = sp;
  next();
});

// ===========================================================================
// KHU QUAN TRI - DON VI VAN CHUYEN
// ===========================================================================

/** Ve lai trang quan tri kem thong bao, theo dung loi POST-roi-chuyen-huong. */
function veAdmin(res, duongDan, msg, loai = 'success') {
  const q = msg ? `?msg=${encodeURIComponent(msg)}&msgType=${loai}` : '';
  res.redirect(duongDan + q);
}

router.get('/admin/van-chuyen', canQuanTri, bat(async (req, res) => {
  const [dsDv, ts, goc, tk] = await Promise.all([
    vc.dsDonVi(), vc.thamSo(), vc.toaDoNhaHang(), vc.thongKe(),
  ]);
  res.render('admin/van-chuyen', {
    title: 'Đơn vị vận chuyển',
    dsDv, thamSo: ts, nhaHang: goc, thongKe: tk,
    suaId: Number(req.query.sua) || null,
    msg: req.query.msg || null,
    msgType: req.query.msgType || 'success',
  });
}));

router.post('/admin/van-chuyen/them', canQuanTri, bat(async (req, res) => {
  try {
    await vc.themDonVi(req.body || {});
    realtime.doi(realtime.MIEN.GIAO_HANG, { duong_dan: '/admin/van-chuyen' });
    veAdmin(res, '/admin/van-chuyen', 'Đã thêm đơn vị vận chuyển.');
  } catch (e) {
    veAdmin(res, '/admin/van-chuyen', e.message, 'danger');
  }
}));

router.post('/admin/van-chuyen/sua/:id', canQuanTri, bat(async (req, res) => {
  try {
    await vc.suaDonVi(Number(req.params.id), req.body || {});
    realtime.doi(realtime.MIEN.GIAO_HANG, { duong_dan: '/admin/van-chuyen' });
    veAdmin(res, '/admin/van-chuyen', 'Đã lưu bảng giá và thông tin đơn vị.');
  } catch (e) {
    veAdmin(res, '/admin/van-chuyen', e.message, 'danger');
  }
}));

router.post('/admin/van-chuyen/xoa/:id', canQuanTri, bat(async (req, res) => {
  try {
    await vc.xoaDonVi(Number(req.params.id));
    realtime.doi(realtime.MIEN.GIAO_HANG, { duong_dan: '/admin/van-chuyen' });
    veAdmin(res, '/admin/van-chuyen', 'Đã xóa đơn vị vận chuyển.');
  } catch (e) {
    veAdmin(res, '/admin/van-chuyen', e.message, 'danger');
  }
}));

/** Tham so van hanh chung (ban kinh, mien phi, nhip GPS) - luu vao `cau_hinh`. */
router.post('/admin/van-chuyen/tham-so', canQuanTri, bat(async (req, res) => {
  const db = require('../config/db');
  const b = req.body || {};
  const dat = [
    ['giao_hang.bat', b.bat ? '1' : '0'],
    ['giao_hang.tu_dong_tao_don', b.tu_dong_tao_don ? '1' : '0'],
    ['giao_hang.ban_kinh_km', String(Math.max(0.5, Math.min(100, Number(b.ban_kinh_km) || 5)))],
    ['giao_hang.mien_phi_tu', String(Math.max(0, Number(b.mien_phi_tu) || 0))],
    ['giao_hang.nhip_gps_giay', String(Math.max(5, Math.min(300, Number(b.nhip_gps_giay) || 15)))],
    ['giao_hang.giu_vet_ngay', String(Math.max(1, Math.min(365, Number(b.giu_vet_ngay) || 7)))],
  ];
  for (const [khoa, giaTri] of dat) {
    await db.query(
      'INSERT INTO cau_hinh (khoa, gia_tri) VALUES (?,?) ON DUPLICATE KEY UPDATE gia_tri = VALUES(gia_tri)',
      [khoa, giaTri]
    );
  }
  realtime.doi(realtime.MIEN.GIAO_HANG, { duong_dan: '/admin/van-chuyen' });
  veAdmin(res, '/admin/van-chuyen', 'Đã lưu tham số vận hành.');
}));

// ===========================================================================
// KHU QUAN TRI - SHIPPER
// ===========================================================================

router.get('/admin/van-chuyen/shipper', canQuanTri, bat(async (req, res) => {
  const [dsSp, dsDv, dsNv] = await Promise.all([
    vc.dsShipper(), vc.dsDonVi({ chiHoatDong: true }), vc.nhanVienChuaLaShipper(),
  ]);
  res.render('admin/van-chuyen-shipper', {
    title: 'Quản lý shipper',
    dsSp, dsDv, dsNv,
    suaId: Number(req.query.sua) || null,
    msg: req.query.msg || null,
    msgType: req.query.msgType || 'success',
  });
}));

router.post('/admin/van-chuyen/shipper/them', canQuanTri, bat(async (req, res) => {
  try {
    await vc.themShipper(req.body || {});
    realtime.doi(realtime.MIEN.GIAO_HANG, { duong_dan: '/admin/van-chuyen/shipper' });
    veAdmin(res, '/admin/van-chuyen/shipper', 'Đã thêm shipper.');
  } catch (e) {
    veAdmin(res, '/admin/van-chuyen/shipper', e.message, 'danger');
  }
}));

router.post('/admin/van-chuyen/shipper/sua/:id', canQuanTri, bat(async (req, res) => {
  try {
    await vc.suaShipper(Number(req.params.id), req.body || {});
    realtime.doi(realtime.MIEN.GIAO_HANG, { duong_dan: '/admin/van-chuyen/shipper' });
    veAdmin(res, '/admin/van-chuyen/shipper', 'Đã lưu hồ sơ shipper.');
  } catch (e) {
    veAdmin(res, '/admin/van-chuyen/shipper', e.message, 'danger');
  }
}));

router.post('/admin/van-chuyen/shipper/xoa/:id', canQuanTri, bat(async (req, res) => {
  try {
    await vc.xoaShipper(Number(req.params.id));
    realtime.doi(realtime.MIEN.GIAO_HANG, { duong_dan: '/admin/van-chuyen/shipper' });
    veAdmin(res, '/admin/van-chuyen/shipper', 'Đã xóa hồ sơ shipper.');
  } catch (e) {
    veAdmin(res, '/admin/van-chuyen/shipper', e.message, 'danger');
  }
}));

// ===========================================================================
// KHU DIEU PHOI
// ===========================================================================

const canXem = phanQuyen.canQuyen('giao_hang.xem');
const canPhan = phanQuyen.canQuyen('giao_hang.phan_cong');
const canTheoDoi = phanQuyen.canQuyen(['giao_hang.theo_doi', 'giao_hang.phan_cong']);

function veDieuPhoi(res, duongDan, msg, loai = 'success') {
  const q = msg ? `?msg=${encodeURIComponent(msg)}&msgType=${loai}` : '';
  res.redirect(duongDan + q);
}

/** Bang dieu phoi: don dang chay o tren, shipper ranh o ben canh. */
router.get('/staff/giao-hang', canXem, bat(async (req, res) => {
  const xemHet = req.query.tat_ca === '1';
  const [don, dsSp, tk, ts] = await Promise.all([
    vc.dsDonGiao({ dangChay: !xemHet, ngay: xemHet ? (req.query.ngay || null) : null }),
    vc.dsShipper(),
    vc.thongKe(),
    vc.thamSo(),
  ]);
  res.render('staff/giao-hang', {
    title: 'Điều phối giao hàng',
    activePage: 'giao-hang',
    don, dsSp, thongKe: tk, thamSo: ts, TT: vc.TT,
    xemHet, ngay: req.query.ngay || '',
    msg: req.query.msg || null,
    msgType: req.query.msgType || 'success',
  });
}));

/** Ban do thoi gian thuc. Trang rong; du lieu vao qua API + socket. */
router.get('/staff/giao-hang/ban-do', canTheoDoi, bat(async (req, res) => {
  const [dl, ts] = await Promise.all([vc.banDo(), vc.thamSo()]);
  res.render('staff/giao-hang-ban-do', {
    title: 'Bản đồ theo dõi shipper',
    activePage: 'giao-hang',
    banDau: dl, thamSo: ts, TT: vc.TT,
  });
}));

/**
 * Tao don giao cho mot don da co (dieu phoi lam tay).
 *
 * Dung khi khach goi dien dat mon, hoac khi khach an tai cho doi y muon mang ve
 * giao tan nha. Dat TRUOC route '/staff/giao-hang/:id' vi 'tao' cung khop mau
 * `:id`; Express lay route dang ky truoc.
 */
router.post('/staff/giao-hang/tao', canPhan, bat(async (req, res) => {
  const b = req.body || {};
  try {
    if (!String(b.sesis || '').trim()) throw new Error('Thiếu mã đơn hàng.');
    if (!String(b.dia_chi_giao || '').trim()) throw new Error('Phải nhập địa chỉ giao hàng.');
    const don = await vc.taoDonGiao(String(b.sesis).trim(), {
      ...b,
      id_nv: nguoiDung(req).id_nv,
      ten_nguoi: nguoiDung(req).ten,
    });
    realtime.doi(realtime.MIEN.GIAO_HANG, { duong_dan: '/staff/giao-hang' });
    veDieuPhoi(res, `/staff/giao-hang/${don.id_giao}`, `Đã tạo đơn giao ${don.ma_giao}.`);
  } catch (e) {
    veDieuPhoi(res, '/staff/giao-hang', e.message, 'danger');
  }
}));

router.get('/staff/giao-hang/:id', laSo, canXem, bat(async (req, res) => {
  const don = await vc.donGiao(Number(req.params.id));
  if (!don) return res.status(404).render('error', {
    title: 'Không tìm thấy', message: 'Đơn giao hàng này không tồn tại.', statusCode: 404,
  });
  const [mon, lichSu, dsSp, vet] = await Promise.all([
    vc.monCuaDon(don.sesis), vc.nhatKy(don.id_giao), vc.dsShipper(), vc.vetCuaDon(don.id_giao),
  ]);
  res.render('staff/giao-hang-chi-tiet', {
    title: `Đơn giao ${don.ma_giao}`,
    activePage: 'giao-hang',
    don, mon, lichSu, dsSp, vet, TT: vc.TT,
    nhaHang: await vc.toaDoNhaHang(),
    msg: req.query.msg || null,
    msgType: req.query.msgType || 'success',
  });
}));

router.post('/staff/giao-hang/:id/phan', laSo, canPhan, bat(async (req, res) => {
  const id = Number(req.params.id);
  try {
    const don = await vc.phanShipper(id, Number((req.body || {}).id_shipper), nguoiDung(req));
    realtime.doi(realtime.MIEN.GIAO_HANG, { duong_dan: '/staff/giao-hang' });
    realtime.donGiaoDoi({ ...don, nhan: don.tt.nhan });
    veDieuPhoi(res, req.get('referer') && req.get('referer').includes('/ban-do')
      ? '/staff/giao-hang/ban-do' : '/staff/giao-hang',
      `Đã giao đơn ${don.ma_giao} cho ${don.ten_shipper}.`);
  } catch (e) {
    veDieuPhoi(res, '/staff/giao-hang', e.message, 'danger');
  }
}));

router.post('/staff/giao-hang/:id/go', laSo, canPhan, bat(async (req, res) => {
  const id = Number(req.params.id);
  try {
    const don = await vc.goShipper(id, nguoiDung(req), (req.body || {}).ly_do);
    realtime.doi(realtime.MIEN.GIAO_HANG, { duong_dan: '/staff/giao-hang' });
    realtime.donGiaoDoi({ ...don, nhan: don.tt.nhan });
    veDieuPhoi(res, '/staff/giao-hang', `Đơn ${don.ma_giao} đã trở lại hàng chờ.`, 'info');
  } catch (e) {
    veDieuPhoi(res, '/staff/giao-hang', e.message, 'danger');
  }
}));

router.post('/staff/giao-hang/:id/trang-thai', laSo, canPhan, bat(async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  try {
    // `laDieuPhoi` cho phep dong vao don cua NGUOI KHAC. Dieu phoi phai xu ly
    // duoc don cua shipper da tat may hay het pin giua duong.
    const don = await vc.doiTrangThai(id, String(b.trang_thai), nguoiDung(req), {
      laDieuPhoi: true, ly_do: b.ly_do, ghi_chu: b.ghi_chu,
    });
    realtime.doi(realtime.MIEN.GIAO_HANG, { duong_dan: '/staff/giao-hang' });
    realtime.donGiaoDoi({ ...don, nhan: don.tt.nhan });
    veDieuPhoi(res, `/staff/giao-hang/${id}`, `Đơn ${don.ma_giao}: ${don.tt.nhan}.`);
  } catch (e) {
    veDieuPhoi(res, `/staff/giao-hang/${id}`, e.message, 'danger');
  }
}));

// ---------------------------------------------------------------------------
// API cua khu dieu phoi
// ---------------------------------------------------------------------------

/**
 * Du lieu ban do.
 *
 * Ban do van goi API nay moi 20 giay du da co socket day vi tri xuong: goi tin
 * socket co the roi khi mang chap chon, va khi do ban do dung im ma khong ai
 * biet. Mot lan doc lai day du moi 20 giay la luoi an toan re tien.
 */
router.get('/api/giao-hang/ban-do', canTheoDoi, bat(async (req, res) => {
  res.json({ ok: true, ...(await vc.banDo()) });
}));

router.get('/api/giao-hang/:id/lo-trinh', laSo, canTheoDoi, bat(async (req, res) => {
  res.json({ ok: true, vet: await vc.vetCuaDon(Number(req.params.id)) });
}));

/**
 * Bao gia phi giao cho mot toa do.
 *
 * Khong doi dang nhap: trang dat hang goi khi khach vua ghim ban do, truoc ca
 * khi ho bam dat. Chi tra ve gia va khoang cach - khong lo ra du lieu nao khac.
 */
router.get('/api/giao-hang/bao-gia', bat(async (req, res) => {
  // Truyen NGUYEN gia tri, khong boc qua Number() o day: `Number('')` la 0, nen
  // mot o toa do de trong se bien thanh diem (0, 0) va ham bao gia se tra loi
  // "cach nha hang 1.197 km" thay vi "chua co toa do". `tinhPhi` co bo loc
  // nghiem ngat cua rieng no - xem ham `so()` trong vanChuyenService.
  const bao = await vc.tinhPhi(
    req.query.vi_do, req.query.kinh_do, Number(req.query.tien_hang) || 0
  );
  res.json({ ok: true, ...bao });
}));

// ===========================================================================
// KHU SHIPPER - ung dung dien thoai
// ===========================================================================

/**
 * Mot dia chi duy nhat, co dau '/' o cuoi - rang buoc cua PWA.
 *
 * Giai thich day du o routes/chamCongDiDong.js; tom tat: pham vi service worker
 * /shipper/sw.js la /shipper/, Chrome chi cho cai khi start_url nam trong pham
 * vi do. Mot route lo ca hai duong dan chu khong phai hai route, neu khong
 * route dang ky truoc se nuot ca hai va tu chuyen huong ve chinh no.
 */
router.get('/shipper', (req, res, next) => {
  if (!req.originalUrl.split('?')[0].endsWith('/')) return res.redirect(302, '/shipper/');
  next();
}, canShipper, bat(async (req, res) => {
  const [don, ts] = await Promise.all([
    vc.dsDonGiao({ idShipper: req.shipper.id_shipper, dangChay: true }),
    vc.thamSo(),
  ]);
  const goc = await vc.toaDoNhaHang();

  res.render('shipper', {
    layout: false,
    title: 'Giao hàng',
    shipper: req.shipper,
    hoTen: req.session.staffName || req.shipper.ten,
    don, thamSo: ts, nhaHang: goc, TT: vc.TT,
    // GPS chi ton tai trong secure context. Trang tu phat hien va dua duong dan
    // https bam duoc thay vi de shipper bam nut roi nhan mot loi kho hieu.
    anToan: laAnToan(req),
    diaChiAnToan: diaChiQR.diaChiDienThoai(req),
  });
}));

/**
 * Trang co dang chay trong secure context khong.
 *
 * Phai doc ca `x-forwarded-proto`: qua tunnel thi ket noi toi Node la http
 * thuong trong khi dien thoai dang o https that va GPS chay binh thuong.
 * Giong het ham cung ten trong routes/chamCongDiDong.js.
 */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1']);
function laAnToan(req) {
  if (req.secure) return true;
  const giaoThuc = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0].trim().toLowerCase();
  if (giaoThuc === 'https') return true;
  const may = String(req.headers.host || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return LOOPBACK.has(may.toLowerCase());
}

/** Don dang cam cua chinh minh - ung dung goi lai sau moi thao tac. */
router.get('/api/shipper/don-cua-toi', canShipper, bat(async (req, res) => {
  const don = await vc.dsDonGiao({ idShipper: req.shipper.id_shipper, dangChay: true });
  const [[lai]] = await require('../config/db').query(
    `SELECT COUNT(*) AS n, COALESCE(SUM(phi_giao),0) AS phi FROM don_giao_hang
     WHERE id_shipper = ? AND trang_thai = 'da_giao' AND DATE(hoan_tat_luc) = CURDATE()`,
    [req.shipper.id_shipper]
  );
  res.json({
    ok: true,
    ca: req.shipper.trang_thai,
    don: don.map((g) => ({
      id_giao: g.id_giao, ma_giao: g.ma_giao, sesis: g.sesis,
      trang_thai: g.trang_thai, nhan: g.tt.nhan, mau: g.tt.mau, icon: g.tt.icon,
      chuyen_duoc: g.chuyen_duoc,
      ten_nguoi_nhan: g.ten_nguoi_nhan, sdt_nguoi_nhan: g.sdt_nguoi_nhan,
      dia_chi_giao: g.dia_chi_giao, vi_do: g.vi_do, kinh_do: g.kinh_do,
      khoang_cach_km: g.khoang_cach_km, phi_giao: g.phi_giao,
      tien_hang: g.tien_hang, tien_thu_ho: g.tien_thu_ho, tong_thu: g.tong_thu,
      so_mon: g.so_mon, ghi_chu: g.ghi_chu, bep_da_xong: g.bep_da_xong,
      du_kien_luc: g.du_kien_luc,
    })),
    hom_nay: { so_don: Number(lai.n || 0), tien_phi: Number(lai.phi || 0) },
  });
}));

/** Cac mon cua mot don - shipper mo ra doi chieu truoc khi roi bep. */
router.get('/api/shipper/don/:id/mon', laSo, canShipper, bat(async (req, res) => {
  const don = await vc.donGiao(Number(req.params.id));
  if (!don || Number(don.id_shipper) !== Number(req.shipper.id_shipper)) {
    return res.status(403).json({ ok: false, thong_bao: 'Đơn này không phải của bạn.' });
  }
  res.json({ ok: true, mon: await vc.monCuaDon(don.sesis) });
}));

/**
 * Nhan mot nhip vi tri.
 *
 * Duong dan NONG NHAT cua phan he: moi shipper goi 4 lan mot phut, ca ngay.
 * Nen o day khong lam gi ngoai ghi va phat - khong doc lai don, khong tinh
 * khoang cach, khong dung nhat ky. Moi thu do de man hinh dieu phoi tu tinh.
 *
 * Diem GPS xau bi bo o tang service (`ghiViTri`) va van tra ve HTTP 200: ung
 * dung khong nen hien thong bao loi cho mot nhip do sai so cao, no chi can biet
 * de con thu lai nhip sau.
 */
router.post('/api/shipper/vi-tri', canShipper, bat(async (req, res) => {
  const kq = await vc.ghiViTri(req.shipper.id_shipper, req.body || {});
  if (!kq.ghi) return res.json({ ok: true, ghi: false, ly_do: kq.ly_do });

  realtime.viTriShipper({
    id_shipper: req.shipper.id_shipper,
    id_nv: req.shipper.id_nv,
    ten: String(req.session.staffName || req.shipper.ten || '').trim(),
    id_giao: kq.id_giao,
    vi_do: kq.vi_do,
    kinh_do: kq.kinh_do,
    toc_do_kmh: (req.body || {}).toc_do_kmh ?? null,
    huong: (req.body || {}).huong ?? null,
    pin: (req.body || {}).pin ?? null,
  });
  res.json({ ok: true, ghi: true, id_giao: kq.id_giao });
}));

/** Shipper doi trang thai don CUA MINH. */
router.post('/api/shipper/don/:id/trang-thai', laSo, canShipper, bat(async (req, res) => {
  const b = req.body || {};
  try {
    const don = await vc.doiTrangThai(Number(req.params.id), String(b.trang_thai), {
      id_nv: req.shipper.id_nv,
      ten: String(req.session.staffName || req.shipper.ten || '').trim(),
      id_shipper: req.shipper.id_shipper,
    }, { ly_do: b.ly_do, vi_do: b.vi_do, kinh_do: b.kinh_do });

    realtime.doi(realtime.MIEN.GIAO_HANG, { duong_dan: '/staff/giao-hang' });
    realtime.donGiaoDoi({ ...don, nhan: don.tt.nhan });
    res.json({ ok: true, trang_thai: don.trang_thai, nhan: don.tt.nhan });
  } catch (e) {
    res.status(400).json({ ok: false, thong_bao: e.message });
  }
}));

/** Shipper tu bat / tat ca truc. */
router.post('/api/shipper/ca', canShipper, bat(async (req, res) => {
  try {
    const moi = (req.body || {}).trang_thai === 'san_sang' ? 'san_sang' : 'nghi';
    await vc.doiCaShipper(req.shipper.id_shipper, moi);
    realtime.doi(realtime.MIEN.GIAO_HANG, { duong_dan: '/staff/giao-hang' });
    res.json({ ok: true, ca: moi });
  } catch (e) {
    res.status(400).json({ ok: false, thong_bao: e.message });
  }
}));

// ---------------------------------------------------------------------------
// PWA cua ung dung shipper
// ---------------------------------------------------------------------------

const BIEU_TUONG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#2c1810"/>
  <circle cx="168" cy="344" r="46" fill="none" stroke="#c8a951" stroke-width="24"/>
  <circle cx="360" cy="344" r="46" fill="none" stroke="#c8a951" stroke-width="24"/>
  <path d="M168 344h74l52-104h74" fill="none" stroke="#c8a951" stroke-width="24"
        stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M294 240l-30-64h-52" fill="none" stroke="#c8a951" stroke-width="24"
        stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="300" y="128" width="112" height="80" rx="12" fill="#c8a951"/>
</svg>`;

/**
 * Cua vao nam NGOAI pham vi service worker cua /shipper/.
 *
 * Cung ly do voi '/cc' ben routes/chamCongDiDong.js: worker cua /shipper/ bat
 * moi lan chuyen trang trong pham vi do, nen neu chung chi tu ky chua duoc
 * chap nhan thi shipper khong bao gio thay duoc man hinh de bam chap nhan.
 */
router.get('/sp', (req, res) => res.redirect(302, '/shipper/'));

router.get('/shipper/bieu-tuong.svg', (req, res) => {
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(BIEU_TUONG);
});

router.get('/shipper/manifest.webmanifest', (req, res) => {
  res.type('application/manifest+json').json({
    name: 'Giao hàng - Nhà Hàng Bảo Đoàn',
    short_name: 'Giao hàng',
    description: 'Nhận đơn, dẫn đường và cập nhật trạng thái giao hàng',
    start_url: '/shipper/',
    scope: '/shipper/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#2c1810',
    theme_color: '#2c1810',
    lang: 'vi',
    icons: [
      { src: '/shipper/bieu-tuong.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: '/shipper/bieu-tuong.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
      { src: '/shipper/bieu-tuong.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  });
});

const OFFLINE = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Mất kết nối</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
text-align:center;padding:22px;font-family:system-ui,sans-serif;
background:linear-gradient(135deg,#2c1810,#4e342e);color:#fff}
.hop{max-width:430px}
h1{font-size:20px;margin:0 0 10px}
p{opacity:.85;font-size:14.5px;line-height:1.6;margin:0 0 16px}
a.nut,button.nut{display:block;width:100%;box-sizing:border-box;background:#c8a951;color:#2c1810;
text-decoration:none;font-weight:700;font-size:15px;padding:13px 18px;border:0;border-radius:12px;
margin:9px 0;cursor:pointer;font-family:inherit}
a.phu{background:transparent;color:#c8a951;border:1px solid rgba(200,169,81,.5)}
.khung{background:rgba(0,0,0,.22);border-radius:12px;padding:13px 15px;margin:16px 0;text-align:left}
.khung b{color:#c8a951;display:block;margin-bottom:5px;font-size:14px}
.khung p{font-size:13.5px;margin:0;opacity:.8}
small{display:block;opacity:.55;font-size:12.5px;margin-top:14px;line-height:1.55}</style></head><body>
<div class="hop">
<h1>Không mở được trang</h1>
<p>Điện thoại mất mạng, hoặc máy chủ nhà hàng chưa bật — nhưng cũng có thể là
<b>chứng chỉ bảo mật vừa đổi</b>.</p>

<div class="khung">
<b>Nếu máy chủ đang bật</b>
<p>Máy chủ cấp chứng chỉ mới mỗi khi địa chỉ mạng đổi. Điện thoại chưa chấp nhận
chứng chỉ mới thì trang này hiện lên thay vì hỏi bạn — vì vậy phải chấp nhận
chứng chỉ ở một trang khác trước.</p>
</div>

<a class="nut" href="/sua">Dọn lại và chấp nhận chứng chỉ</a>
<p style="font-size:13px;opacity:.7;margin:-2px 0 14px">
Bấm <b>Nâng cao</b> → <b>Tiếp tục truy cập</b>, rồi quay lại đây.</p>

<button class="nut phu" id="nut-dat-lai" type="button">Xoá bộ nhớ đệm và tải lại</button>
<a class="nut phu" href="/shipper/">Thử lại</a>

<small>Nếu vẫn không được: kiểm tra điện thoại đã <b>tắt 4G</b> và nối
<b>cùng Wi-Fi</b> với máy tính chạy máy chủ.</small>
</div>
<script>
/*
  Go service worker roi tai lai.

  Can nut nay vi chinh service worker la thu dang giam nguoi dung o day: no bat
  moi lan chuyen trang trong pham vi cua no, va khi fetch that bai - ke ca that
  bai vi CHUNG CHI chu khong phai vi mat mang - no tra ve trang nay. Nguoi dung
  khong bao gio thay duoc man hinh "Ket noi khong an toan" de bam chap nhan.

  Go dang ky xong thi lan chuyen trang sau di thang ra mang, va trinh duyet moi
  hien canh bao chung chi that.
*/
document.getElementById('nut-dat-lai').onclick = function () {
  var nut = this;
  nut.textContent = 'Đang xoá...';
  var xong = function () { location.replace('/shipper/' + '?tuoi=' + Date.now()); };
  if (!navigator.serviceWorker) return xong();
  navigator.serviceWorker.getRegistrations()
    .then(function (ds) { return Promise.all(ds.map(function (r) { return r.unregister(); })); })
    .then(function () { return caches && caches.keys ? caches.keys() : []; })
    .then(function (ks) { return Promise.all((ks || []).map(function (k) { return caches.delete(k); })); })
    .then(xong)
    .catch(xong);
};

/*
  TU THU LAI - de mot lan khoi dong lai may chu khong ket nguoi dung o day.

  Truoc day trang nay dung im: may chu bat lai roi ma dien thoai van hien "khong
  ket noi duoc", cho toi khi nguoi dung tu bam. Ma khoi dong lai may chu la viec
  binh thuong - chi mat khoang muoi lam giay - nen bat nhan vien ngoi doan xem
  luc nao thi bam la vo ly.

  Goi mot tep TINH trong pham vi (manifest), khong phai mot lan chuyen trang:
  service worker chi bat mode === 'navigate' nen yeu cau nay di thang ra mang.
  cache: 'no-store' de trinh duyet khong tra lai ban da luu.

  Cach nhau 3 giay, va CHI khi trang dang hien - tab an di thi ngung, khong goi
  vo ich trong tui nguoi ta.
*/
(function () {
  var dang = false;
  function thu() {
    if (dang || document.hidden) return;
    dang = true;
    fetch('/shipper/manifest.webmanifest?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (r && r.ok) location.replace('/shipper/'); })
      .catch(function () {})
      .then(function () { dang = false; });
  }
  setInterval(thu, 3000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) thu(); });
})();
</script>
</body></html>`;

/**
 * Service worker - KHONG LUU DEM GI CA, cung ly do voi trang cham cong.
 *
 * Ban do cu trong bo nho dem con nguy hiem hon bang cham cong cu: shipper se
 * chay theo mot dia chi da bi doi, hoac thay mot don da bi go khoi minh tu muoi
 * phut truoc. Worker nay ton tai DUY NHAT de Chrome cho cai ung dung ra man
 * hinh chinh.
 */
const SW = `/*
  Service worker - KHONG luu dem gi ca.

  No ton tai duy nhat de trinh duyet cho phep cai trang ra man hinh chinh.
  Moi yeu cau deu di thang ra mang.

  VI SAO KHONG CON BAT MOI LOI
  ----------------------------
  Ban truoc bat MOI loi cua fetch() va tra ve trang "mat ket noi". Nghe hop ly,
  nhung no nuot ca mot loai loi hoan toan khac: LOI CHUNG CHI.

  May chu dung chung chi tu ky. Moi khi dia chi mang doi, chung chi duoc cap
  lai, va ngoai le ma dien thoai da bam chap nhan truoc do het hieu luc. Luc
  do fetch() that bai - va worker nay bien no thanh "dien thoai dang mat mang,
  hoac may chu chua bat".

  Hau qua: nguoi dung KHONG BAO GIO thay duoc man hinh "Ket noi khong an toan"
  de bam "Nang cao -> Tiep tuc truy cap", vi worker da chan truoc khi trinh
  duyet kip hien no. Va vi thong bao noi sai nguyen nhan, ho di kiem tra Wi-Fi
  va may chu - hai thu deu dang chay tot.

  Nay chi hien trang cua minh khi CHAC CHAN la mat mang (navigator.onLine =
  false). Moi truong hop khac deu nem tiep loi ra ngoai, de trinh duyet hien
  dung man hinh that cua no - ke ca man hinh chung chi co nut di tiep.
*/
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  // Chi dong vao dieu huong trang. Anh va loi goi API phai di thang.
  if (e.request.mode !== 'navigate') return;
  e.respondWith(
    fetch(e.request).catch(function (loi) {
      var thatSuMatMang = self.navigator && self.navigator.onLine === false;
      if (!thatSuMatMang) throw loi;   // de trinh duyet tu bao - xem ghi chu tren
      return new Response(${JSON.stringify(OFFLINE)}, {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    })
  );
});
`;

router.get('/shipper/sw.js', (req, res) => {
  res.type('application/javascript').set('Cache-Control', 'no-cache').send(SW);
});

// ===========================================================================
// KHU KHACH - theo doi don
// ===========================================================================

/**
 * Trang tra cuu, khong doi dang nhap.
 *
 * Vi sao khong doi dang nhap: don giao hang co the do le tan dat ho qua dien
 * thoai, hoac dat bang tai khoan vang lai cua ma QR tai ban. Bat dang nhap thi
 * dung nhung nguoi do khong xem duoc don cua chinh minh.
 *
 * `ma_giao` la thu bi mat duy nhat, va no chi in tren don cua khach do. Ba lop
 * chan lam ma nay kho do nam trong `services/realtime.js` (xem
 * `socket.on('giao-hang:theo-doi')`).
 */
router.get('/theo-doi', (req, res) => {
  const ma = String(req.query.ma || '').trim().toUpperCase();
  if (ma) return res.redirect('/theo-doi/' + encodeURIComponent(ma));
  res.render('theo-doi-nhap-ma', { layout: false, title: 'Theo dõi đơn giao hàng', loi: req.query.loi || null });
});

router.get('/theo-doi/:ma', bat(async (req, res) => {
  const ma = String(req.params.ma || '').trim().toUpperCase();
  const don = await vc.donGiaoTheoMa(ma);
  if (!don) {
    return res.redirect('/theo-doi?loi=' + encodeURIComponent(`Không tìm thấy đơn "${ma}". Hãy kiểm tra lại mã trên hóa đơn.`));
  }

  const [mon, lichSu, goc] = await Promise.all([
    vc.monCuaDon(don.sesis), vc.nhatKy(don.id_giao), vc.toaDoNhaHang(),
  ]);

  res.render('theo-doi-giao-hang', {
    layout: false,
    title: `Đơn ${don.ma_giao}`,
    // KHONG truyen ca `don` sang view. Trang nay ai co ma cung mo duoc, nen chi
    // dua sang dung nhung gi khach cua don do can thay - khong co so dien thoai
    // shipper, khong co ghi chu noi bo, khong co id_nv cua ai.
    don: {
      ma_giao: don.ma_giao,
      trang_thai: don.trang_thai,
      nhan: don.tt.nhan, mau: don.tt.mau, icon: don.tt.icon,
      ten_nguoi_nhan: don.ten_nguoi_nhan,
      dia_chi_giao: don.dia_chi_giao,
      vi_do: don.vi_do, kinh_do: don.kinh_do,
      khoang_cach_km: don.khoang_cach_km,
      phi_giao: Number(don.phi_giao || 0),
      tien_hang: Number(don.tien_hang || 0),
      tong_thu: don.tong_thu,
      tien_thu_ho: Number(don.tien_thu_ho || 0),
      du_kien_luc: don.du_kien_luc,
      hoan_tat_luc: don.hoan_tat_luc,
      ten_dv: don.ten_dv,
      // Ten rieng cua shipper, khong kem so dien thoai: du de khach yen tam
      // "anh Hung dang cam don", khong du de goi lam phien ngoai gio.
      ten_shipper: don.ten_shipper,
      da_xong: don.da_xong,
      dang_chay: don.dang_chay,
      shipper_vi_do: don.dang_chay ? don.shipper_vi_do : null,
      shipper_kinh_do: don.dang_chay ? don.shipper_kinh_do : null,
    },
    mon,
    lichSu: lichSu.map((n) => ({ nhan: n.tt.nhan, mau: n.tt.mau, icon: n.tt.icon, luc: n.luc, ghi_chu: n.ghi_chu })),
    nhaHang: goc,
  });
}));

module.exports = router;
