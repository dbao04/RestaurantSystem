/**
 * Router module DAT BAN.
 *
 * Bon nhom nguoi dung, bon khu duong dan:
 *
 *   /dat-ban, /api/dat-ban/*          KHACH      khong can dang nhap
 *   /staff/dat-ban, /api/reservations/*  NHAN VIEN  phuc vu, quay, thu ngan, quan ly
 *   /admin/dat-ban/*                  QUAN LY    cau hinh, chinh sach, phan tich
 *
 * ---------------------------------------------------------------------------
 * VI SAO HAI TIEN TO API (/api/dat-ban VA /api/reservations)
 * ---------------------------------------------------------------------------
 * Khong phai vi lich su de lai. Day la RANH GIOI PHAN QUYEN duoc viet thang vao
 * duong dan:
 *
 *   /api/dat-ban/*      CONG KHAI. Khong bao gio tra ve ten khach khac, so dien
 *                       thoai khac, ghi chu noi bo hay so lieu kinh doanh. Moi
 *                       route o day deu phai doc duoc boi mot nguoi la.
 *   /api/reservations/* NOI BO. Bat buoc dang nhap nhan vien.
 *
 * Mot API duy nhat roi "an bot truong theo quyen" nghe gon hon, nhung no bien
 * moi lan them truong tra ve thanh mot cau hoi bao mat de quen. Tach doi thi
 * nham lan tro nen kho: viet mot truong nhay cam vao nhanh /api/dat-ban la mot
 * viec phai co y, khong phai mot viec lam duoc do so y.
 *
 * ---------------------------------------------------------------------------
 * MOI THAO TAC GHI DEU LA POST/PUT
 * ---------------------------------------------------------------------------
 * Ke ca huy va no-show. Mot reservation bi huy thi khong lui lai duoc; de no
 * sau mot duong link GET la de mot con bot quet link huy ban cua khach that.
 */
const express = require('express');
const dv = require('../services/reservationService');
const xb = require('../services/reservationTables');
const qt = require('../services/reservationRules');
const ch = require('../services/reservationConfig');
const jobs = require('../services/reservationJobs');
const realtime = require('../services/realtime');
const phanQuyen = require('../middleware/phanQuyen');
const { ngayCucBo } = require('../utils/thoiGian');

const menuService = require('../services/menuService');

const router = express.Router();

/** Bao mot handler async - loi khong bi nuot thanh request treo. */
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ... (helpers)

/**
 * Chan `:id` khong phai so.
 *
 * Express 5 da bo cu phap `:id(\\d+)`. Can that o day: `/api/reservations/timeline`
 * va `/api/reservations/:id` cung khop mot mau, va neu khong chan thi `:id` se
 * nuot mat `timeline` - loi im lang, chi lo ra khi giao dien trong tron.
 */
const laSo = (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) return next('route');
  next();
};

/**
 * Tu dien nhan giao dien cho hai trang cua khach.
 *
 * Gom moi khoa `dat_ban_moi.*` roi dich theo ngon ngu cua phien hien tai, de
 * View nhung mot lan duoi dang JSON thay vi rai <%= t('...') %> khap trong
 * JavaScript. Xem chu thich `var T` trong views/reservation.ejs de biet vi sao.
 *
 * Lay danh sach khoa tu ban TIENG VIET vi do la ban goc - moi khoa deu phai co
 * o day, cac ngon ngu khac lui ve no khi thieu (xem services/ngonNgu.js).
 */
const KHOA_GIAO_DIEN = Object.keys(require('../locales/vi'))
  .filter((k) => k.startsWith('dat_ban_moi.'));

function nhanGiaoDien(t) {
  const doc = {};
  for (const k of KHOA_GIAO_DIEN) doc[k] = t(k);
  return doc;
}

/** Vai tro duoc phep van hanh dat ban hang ngay. */
const VAI_TRO_NV = ['Phuc vu', 'Quay', 'Thu ngan', 'Ke toan', 'Quan ly'];
/** Vai tro duoc phep doi cau hinh, chinh sach va xem phan tich. */
const VAI_TRO_QL = ['Quan ly'];

const canNhanVien = phanQuyen.canVaiTroCu(VAI_TRO_NV);
const canQuanLy = phanQuyen.canVaiTroCu(VAI_TRO_QL);

/** Phien quan tri (bang tb_admin) - dung cho khu /admin. */
const canQuanTri = (req, res, next) => {
  if (req.session && req.session.adminlogin) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ ok: false, thong_bao: 'Chưa đăng nhập' });
  return res.redirect('/admin/login');
};

/** Ai dang thao tac - de ghi vao nhat ky. */
function nguoiDung(req) {
  if (req.session && req.session.staffId) {
    return { nhanVienId: req.session.staffId, laNhanVien: true };
  }
  if (req.session && req.session.adminlogin) {
    return { nhanVienId: null, laNhanVien: true };
  }
  return { nhanVienId: null, laNhanVien: false };
}

/**
 * Tra loi loi thong nhat cho moi route API.
 *
 * Loi nghiep vu (`LoiDatBan`) mang thong diep viet cho NGUOI DOC - tra nguyen
 * van kem ma may doc duoc. Loi khac la loi cua chung ta: ghi log day du nhung
 * chi tra ra mot cau chung, vi thong diep cua MySQL co the lo ten bang, ten cot
 * hoac ca mot phan cau truy van.
 */
function traLoi(res, e, macDinh = 400) {
  if (e && e.name === 'LoiDatBan') {
    return res.status(e.ma === 'NOT_FOUND' ? 404 : macDinh).json({
      ok: false, ma: e.ma, thong_bao: e.message, chi_tiet: e.chiTiet || null,
    });
  }
  console.error('[dat-ban] lỗi:', e);
  return res.status(500).json({ ok: false, ma: 'SERVER', thong_bao: 'Hệ thống đang bận, vui lòng thử lại.' });
}

/** Bao cho moi man hinh nhan vien dang mo biet co thay doi. */
function bao(suKien, duLieu) {
  realtime.doi(realtime.MIEN.DAT_BAN, { su_kien: suKien, ...duLieu });
}

// ===========================================================================
// KHU KHACH HANG - khong can dang nhap
// ===========================================================================

/**
 * Trang dat ban.
 *
 * Nap san danh muc + khu vuc + cau hinh vao HTML thay vi de trinh duyet goi
 * them ba request nua: buoc dau tien cua khach la chon ngay gio, va man hinh
 * phai san sang ngay - khong phai sau ba vong quay.
 */
router.get('/dat-ban', bat(async (req, res) => {
  const [khuVuc, danhMuc, cauHinh, danhMucMon, dsMonAn] = await Promise.all([
    xb.docKhuVuc(),
    ch.docDanhMuc(),
    qt.docCauHinh(),
    menuService.getAllCategories().catch(() => []),
    menuService.getAllDishes().catch(() => []),
  ]);
  const dsMon = (dsMonAn || []).filter((m) => Number(m.tinhtrang) === 1);
  res.render('reservation', {
    title: 'Đặt bàn',
    activeNav: 'datban',
    nhan: nhanGiaoDien(res.locals.t),
    homNay: ngayCucBo(),
    khuVuc,
    theYeuCau: danhMuc.the_yeu_cau,
    danhMucMon: danhMucMon || [],
    dsMonAn: dsMon || [],
    cauHinh: {
      buoc_gio: Number(cauHinh.slot_step_minutes) || 15,
      toi_da_khach: Number(cauHinh.max_guests_online) || 30,
      toi_da_ngay: Number(cauHinh.max_advance_days) || 90,
      cho_chon_ban: Number(cauHinh.allow_customer_pick_table) === 1,
      cho_ghep_ban: Number(cauHinh.allow_table_combination) === 1,
      giu_ban_phut: Number(cauHinh.grace_period_minutes) || 15,
      dat_truoc_phut: Number(cauHinh.minimum_lead_minutes) || 30,
    },
  });
}));

/** Trang xac nhan sau khi dat xong. */
router.get('/dat-ban/xong', bat(async (req, res) => {
  const r = await dv.traCuuChoKhach(req.query.ma, req.query.dt);
  if (!r) return res.redirect('/dat-ban');
  res.render('reservation-xong', {
    title: 'Đặt bàn thành công',
    activeNav: 'datban',
    r,
    dienThoai: qt.chuanHoaDienThoai(req.query.dt),
  });
}));

/**
 * Trang huong dan dat ban.
 *
 * Toan bo con so tren trang nay - giu ban bao nhieu phut, dat truoc toi thieu bao
 * lau, coc bao nhieu, huy truoc may gio thi hoan bao nhieu - deu DOC TU CAU HINH
 * DANG CHAY, khong viet cung trong HTML.
 *
 * Day la diem quan trong nhat cua trang: mot trang huong dan viet tay se lech
 * khoi thuc te ngay lan dau quan ly doi mot tham so o /admin/dat-ban, va khong ai
 * nho quay lai sua. Luc do no te hon la khong co trang huong dan nao - vi khach
 * doc no, tin no, roi bi tu choi boi mot quy tac khac.
 */
router.get('/huong-dan-dat-ban', bat(async (req, res) => {
  const [cauHinh, gioMoCua, chinhSach, quyTacCoc, khuVuc, danhMuc] = await Promise.all([
    qt.docCauHinh(),
    ch.docGioMoCua(),
    ch.docChinhSachHuy(),
    ch.docQuyTacCoc(),
    xb.docKhuVuc(),
    ch.docDanhMuc(),
  ]);

  res.render('huong-dan-dat-ban', {
    title: res.locals.t('huong_dan_dat_ban.tieu_de'),
    activeNav: 'huongdandatban',
    cauHinh,
    gioMoCua,
    // Chi hien chinh sach va quy tac DANG BAT. Khach khong can biet nhung quy tac
    // quan ly da tat - chung con trong CSDL de tra lai cac lan huy cu.
    chinhSach: chinhSach.filter((c) => c.is_active),
    quyTacCoc: quyTacCoc.filter((q) => q.is_active),
    khuVuc,
    theYeuCau: danhMuc.the_yeu_cau,
    // `nhom` la MA nhom, khong phai chuoi hien thi: view tra qua
    // `huong_dan_dat_ban.tl_<ma>` de bang nay doi theo ngon ngu cua khach.
    thoiLuong: [
      { nhom: '1_2', phut: Number(cauHinh.default_duration_1_2) },
      { nhom: '3_6', phut: Number(cauHinh.default_duration_3_6) },
      { nhom: '7_10', phut: Number(cauHinh.default_duration_7_10) },
      { nhom: 'tren_10', phut: Number(cauHinh.default_duration_over_10) },
    ],
  });
}));

/** Trang tra cuu / quan ly luot dat: chuyen huong truc tiep ve lich su / don cua toi */
router.get('/dat-ban/tra-cuu', (req, res) => {
  res.redirect('/my-orders');
});

// ------------------------------------------------------- API cong khai

/** Khu vuc + so ban, de ve tab tren so do. */
router.get('/api/dat-ban/khu-vuc', bat(async (req, res) => {
  res.json({ ok: true, khu_vuc: await xb.docKhuVuc() });
}));

/** Danh muc the yeu cau dac biet. */
router.get('/api/dat-ban/danh-muc', bat(async (req, res) => {
  const dm = await ch.docDanhMuc();
  res.json({ ok: true, the_yeu_cau: dm.the_yeu_cau, trang_thai_ban: dm.trang_thai_ban });
}));

/**
 * Cac khung gio con nhan dat trong mot ngay.
 *
 * Tra ve ca khung KHONG con ban (kem `con_ban: false`) chu khong loc bo. Man
 * hinh phai ve duoc "19:00 hết bàn" bang mot o mo - im lang bo di se khien
 * khach tuong nha hang khong mo cua gio do va bo cuoc.
 */
router.get('/api/dat-ban/khung-gio', bat(async (req, res) => {
  try {
    const ngay = qt.ngayChuoi(req.query.ngay || ngayCucBo());
    const soKhach = Math.max(1, Number(req.query.so_khach) || 2);
    const areaId = req.query.khu_vuc ? Number(req.query.khu_vuc) : null;
    const cf = await qt.docCauHinh();

    const lich = await qt.lichMoCua(ngay);
    if (lich.dong) return res.json({ ok: true, ngay, dong_cua: true, ly_do: lich.lyDo, khung: [] });

    const buoc = Number(cf.slot_step_minutes) || 15;
    const thoiLuong = qt.thoiLuongMacDinh(soKhach, cf);
    const mo = qt.phutTuChuoi(lich.mo);
    let dong = qt.phutTuChuoi(lich.dong_cua);
    if (dong <= mo) dong += 1440;
    const chot = dong - (Number(cf.last_seating_minutes) || 0);
    const somNhat = Date.now() + Number(cf.minimum_lead_minutes) * 60000;

    const khung = [];
    for (let p = mo; p <= chot; p += buoc) {
      if (p + thoiLuong > dong) break;
      const gio = qt.chuoiTuPhut(p);
      const mocBatDau = qt.ghepMoc(ngay, gio);
      if (mocBatDau.getTime() < somNhat) continue;

      const k = { ngay, batDau: gio, ketThuc: qt.chuoiTuPhut(p + thoiLuong), thoiLuong, demDon: Number(cf.turnaround_minutes) || 0, mocBatDau };
      const goi = await xb.goiYXepBan(k, { soKhach, areaId, loaiKhach: 'REGULAR' });
      khung.push({
        gio: qt.gioNgan(gio),
        den: qt.gioNgan(qt.chuoiTuPhut(p + thoiLuong)),
        con_ban: !!goi.chon,
        so_ban_trong: goi.banTrong.length,
        cao_diem: qt.laGioCaoDiem(gio, cf),
      });
    }
    res.json({ ok: true, ngay, dong_cua: false, thoi_luong: thoiLuong, khung });
  } catch (e) { traLoi(res, e); }
}));

/**
 * Kiem tra bàn trong + goi y - khong ghi gi.
 *
 * Duoc goi lai moi lan khach doi ngay/gio/so khach, nen phai re. Chi phi that
 * nam o mot cau doc `reservation_slot_locks` va mot vong duyet to hop trong bo
 * nho - khong co ghi, khong co khoa.
 */
router.get('/api/dat-ban/kha-dung', bat(async (req, res) => {
  try {
    res.json({ ok: true, ...await dv.kiemTraKhaDung(req.query, { laOnline: !nguoiDung(req).laNhanVien }) });
  } catch (e) { traLoi(res, e); }
}));

/**
 * So do ban cho khach - phien ban DA LAM MO THONG TIN NGUOI KHAC.
 *
 * `choKhach: true` la khong the bo qua o day: mac dinh cua ham `soDoBan` la ban
 * noi bo, co ten khach va so dien thoai cua tung ban. Xem chu thich trong
 * services/reservationTables.js.
 */
router.get('/api/dat-ban/so-do', bat(async (req, res) => {
  try {
    const soDo = await xb.soDoBan({
      ngay: req.query.ngay || ngayCucBo(),
      gio: req.query.gio || '19:00',
      soKhach: Math.max(1, Number(req.query.so_khach) || 2),
      areaId: req.query.khu_vuc ? Number(req.query.khu_vuc) : null,
      choKhach: true,
    });
    const cf = await qt.docCauHinh();
    res.json({ ok: true, ...soDo, cho_chon_ban: Number(cf.allow_customer_pick_table) === 1 });
  } catch (e) { traLoi(res, e); }
}));

/** Khach gui yeu cau dat ban. */
router.post('/api/dat-ban', bat(async (req, res) => {
  try {
    const kq = await dv.taoLuotDat(
      { ...req.body, source: 'ONLINE', customer_id: (req.session && req.session.userId) || null },
      { laNhanVien: false, choWaitlist: req.body.cho_danh_sach_cho === '1' || req.body.cho_danh_sach_cho === true });
    bao('RESERVATION_CREATED', { reservation_id: kq.id, ma: kq.ma, ngay: kq.khung.ngay });
    res.status(201).json({ ok: true, ...kq });
  } catch (e) { traLoi(res, e, 409); }
}));

// --------------------------------------------------- khach tu quan ly don

/**
 * Tra cuu bang ma + so dien thoai.
 *
 * Dung POST du day la thao tac doc: so dien thoai khong nen nam trong duong dan
 * URL - no se di vao lich su trinh duyet, nhat ky may chu va Referer gui sang
 * ben thu ba.
 */
router.post('/api/dat-ban/tra-cuu', bat(async (req, res) => {
  try {
    const r = await dv.traCuuChoKhach(req.body.ma, req.body.dien_thoai);
    if (!r) {
      return res.status(404).json({
        ok: false, ma: 'NOT_FOUND',
        thong_bao: 'Không tìm thấy lượt đặt nào khớp mã và số điện thoại này.',
      });
    }
    const xemTruoc = qt.TRANG_THAI_GIU_CHO.includes(r.status)
      ? await dv.xemTruocHuy(r.id).catch(() => null)
      : null;
    // Chi tra ve nhung gi thuoc ve chinh khach - khong kem ghi chu noi bo.
    res.json({
      ok: true,
      r: {
        id: r.id, ma: r.reservation_code, ten: r.customer_name, so_khach: r.guest_count,
        ngay: r.reservation_date, gio: r.gio, den: r.gio_ket_thuc, thoi_luong: r.duration_minutes,
        trang_thai: r.status, nhan_trang_thai: r.nhan_trang_thai, khu_vuc: r.area_name,
        ban: r.ban, dip: r.occasion, yeu_cau: r.special_requests, the: r.tags,
        coc: Number(r.deposit_amount) || 0, trang_thai_coc: r.deposit_status,
        doi_duoc: qt.TRANG_THAI_GIU_CHO.includes(r.status),
      },
      huy: xemTruoc,
    });
  } catch (e) { traLoi(res, e); }
}));

/** Khach tu huy. Ma + so dien thoai la giay to tuy than o day. */
router.post('/api/dat-ban/tra-cuu/huy', bat(async (req, res) => {
  try {
    const r = await dv.traCuuChoKhach(req.body.ma, req.body.dien_thoai);
    if (!r) return res.status(404).json({ ok: false, thong_bao: 'Không tìm thấy lượt đặt' });
    const kq = await dv.doiTrangThai(r.id, 'CANCELLED', {
      lyDo: String(req.body.ly_do || '').trim() || 'Khách tự hủy trực tuyến',
      boiAi: 'CUSTOMER',
    });
    bao('RESERVATION_CANCELLED', { reservation_id: r.id, ma: r.reservation_code });
    res.json({ ok: true, hoan_tien: kq.hoan_tien });
  } catch (e) { traLoi(res, e, 409); }
}));

/** Khach tu doi gio / doi so khach. Van di qua dung duong kiem tra nhu nhan vien. */
router.post('/api/dat-ban/tra-cuu/doi-lich', bat(async (req, res) => {
  try {
    const r = await dv.traCuuChoKhach(req.body.ma, req.body.dien_thoai);
    if (!r) return res.status(404).json({ ok: false, thong_bao: 'Không tìm thấy lượt đặt' });
    const moi = await dv.capNhat(r.id, {
      reservation_date: req.body.ngay,
      start_time: req.body.gio,
      guest_count: req.body.so_khach,
      area_id: req.body.khu_vuc || undefined,
      special_requests: req.body.yeu_cau,
    }, { laNhanVien: false });
    bao('RESERVATION_RESCHEDULED', { reservation_id: r.id, ma: r.reservation_code });
    res.json({
      ok: true,
      r: { ma: moi.reservation_code, ngay: moi.reservation_date, gio: moi.gio, so_khach: moi.guest_count, ban: moi.ban },
    });
  } catch (e) { traLoi(res, e, 409); }
}));

// ===========================================================================
// KHU NHAN VIEN
// ===========================================================================

/**
 * Phien het han tren mot duong API phai tra 401 JSON, khong phai chuyen huong.
 *
 * `canVaiTroCu` chuyen huong sang /staff/login khi chua dang nhap - dung cho mot
 * TRANG, sai cho mot API: `fetch()` di theo chuyen huong, nhan ve trang dang nhap
 * dang HTML, roi `r.json()` nem loi cu phap. Giao dien bat duoc loi do va hien
 * "Mất kết nối tới nhà hàng" - trong khi su that la ca lam viec da het gio va
 * nhan vien chi can dang nhap lai.
 */
const apiCanDangNhap = (req, res, next) => {
  if (req.session && (req.session.stafflogin || req.session.adminlogin)) return next();
  return res.status(401).json({
    ok: false, ma: 'HET_PHIEN',
    thong_bao: 'Phiên đăng nhập đã hết. Vui lòng đăng nhập lại rồi thử lại thao tác.',
  });
};

router.use('/staff/dat-ban', canNhanVien);
router.use('/api/reservations', apiCanDangNhap, canNhanVien);
router.use('/api/tables', apiCanDangNhap, canNhanVien);

/** Trung tam dat ban - man hinh chinh cua nhan vien phuc vu / quay. */
router.get('/staff/dat-ban', bat(async (req, res) => {
  const ngay = qt.ngayChuoi(req.query.ngay || ngayCucBo());
  const [bang, khuVuc, danhMuc, cauHinh] = await Promise.all([
    dv.bangDieuKhien(ngay),
    xb.docKhuVuc({ chiChoDat: false }),
    ch.docDanhMuc(),
    qt.docCauHinh(),
  ]);

  const personnelService = require('../services/personnelService');
  res.render('staff/reservations', {
    title: 'Trung tâm đặt bàn',
    activePage: 'reservations',
    unread: await personnelService.countUnread(req.session.staffId).catch(() => 0),
    ngay,
    bang,
    khuVuc,
    danhMuc,
    cauHinh: {
      giu_ban_phut: Number(cauHinh.grace_period_minutes),
      buoc_gio: Number(cauHinh.slot_step_minutes) || 15,
      cho_ghep_ban: Number(cauHinh.allow_table_combination) === 1,
    },
    laQuanLy: !!(res.locals.dongVaiDuoc && res.locals.dongVaiDuoc(VAI_TRO_QL)),
  });
}));

// ---------------------------------------------------------------- doc

/**
 * Danh sach reservation theo bo loc.
 *
 * Cac route co duong dan co dinh (`timeline`, `analytics`, `waitlist`) phai
 * dat TRUOC `/:id`, neu khong `:id` se nhan chung lam id va tra ve 404.
 */
router.get('/api/reservations', bat(async (req, res) => {
  try { res.json({ ok: true, ds: await dv.danhSach(req.query) }); }
  catch (e) { traLoi(res, e); }
}));

router.get('/api/reservations/timeline', bat(async (req, res) => {
  try {
    res.json({
      ok: true,
      ...await dv.duongThoiGian(req.query.ngay, { areaId: req.query.khu_vuc || null }),
    });
  } catch (e) { traLoi(res, e); }
}));

router.get('/api/reservations/dashboard', bat(async (req, res) => {
  try { res.json({ ok: true, ...await dv.bangDieuKhien(req.query.ngay) }); }
  catch (e) { traLoi(res, e); }
}));

router.get('/api/reservations/analytics', canQuanLy, bat(async (req, res) => {
  try {
    const den = req.query.den || ngayCucBo();
    const mac = new Date();
    mac.setDate(mac.getDate() - 29);
    res.json({ ok: true, ...await dv.phanTich(req.query.tu || ngayCucBo(mac), den) });
  } catch (e) { traLoi(res, e); }
}));

/** Lich su cua mot so dien thoai + ho so khach (rui ro no-show, so thich). */
router.get('/api/reservations/khach/:phone', bat(async (req, res) => {
  try {
    res.json({
      ok: true,
      ho_so: await dv.hoSoKhach(req.params.phone),
      lich_su: await dv.lichSuKhach(req.params.phone),
    });
  } catch (e) { traLoi(res, e); }
}));

router.put('/api/reservations/khach/:phone', canQuanLy, bat(async (req, res) => {
  try { res.json({ ok: true, ho_so: await dv.luuHoSoKhach(req.params.phone, req.body) }); }
  catch (e) { traLoi(res, e); }
}));

router.get('/api/reservations/:id', laSo, bat(async (req, res) => {
  try {
    const r = await dv.chiTiet(req.params.id);
    if (!r) return res.status(404).json({ ok: false, thong_bao: 'Không tìm thấy lượt đặt bàn' });
    res.json({ ok: true, r });
  } catch (e) { traLoi(res, e); }
}));

/** Xem truoc ket qua huy - man hinh xac nhan goi truoc khi hoi "co chac khong". */
router.get('/api/reservations/:id/xem-truoc-huy', laSo, bat(async (req, res) => {
  try { res.json({ ok: true, ...await dv.xemTruocHuy(req.params.id) }); }
  catch (e) { traLoi(res, e); }
}));

// ------------------------------------------------------------ ban / so do

router.get('/api/tables/availability', bat(async (req, res) => {
  try { res.json({ ok: true, ...await dv.kiemTraKhaDung(req.query, { laOnline: false, boQuaId: req.query.bo_qua || null }) }); }
  catch (e) { traLoi(res, e); }
}));

router.get('/api/tables/floor-plan', bat(async (req, res) => {
  try {
    res.json({
      ok: true,
      ...await xb.soDoBan({
        ngay: req.query.ngay || ngayCucBo(),
        gio: req.query.gio || qt.gioNgan(qt.chuoiTuPhut(new Date().getHours() * 60 + new Date().getMinutes())),
        soKhach: Math.max(1, Number(req.query.so_khach) || 2),
        areaId: req.query.khu_vuc ? Number(req.query.khu_vuc) : null,
        boQuaId: req.query.bo_qua || null,
        choKhach: false,
      }),
    });
  } catch (e) { traLoi(res, e); }
}));

// ----------------------------------------------------------------- ghi

router.post('/api/reservations', bat(async (req, res) => {
  try {
    const kq = await dv.taoLuotDat(
      { source: 'STAFF', ...req.body },
      { ...nguoiDung(req), choWaitlist: req.body.cho_danh_sach_cho === '1' || req.body.cho_danh_sach_cho === true });
    bao('RESERVATION_CREATED', { reservation_id: kq.id, ma: kq.ma, ngay: kq.khung.ngay });
    res.status(201).json({ ok: true, ...kq });
  } catch (e) { traLoi(res, e, 409); }
}));

/** Khach den truc tiep (muc 6) - tao va xep ban trong mot buoc. */
router.post('/api/reservations/walk-in', bat(async (req, res) => {
  try {
    const kq = await dv.taoWalkIn(req.body, nguoiDung(req));
    bao('WALK_IN_SEATED', { reservation_id: kq.id, ma: kq.ma });
    res.status(201).json({ ok: true, ...kq });
  } catch (e) { traLoi(res, e, 409); }
}));

/** Dat dinh ky (case 23). */
router.post('/api/reservations/recurring', bat(async (req, res) => {
  try {
    const kq = await dv.taoLichLap(req.body, nguoiDung(req));
    bao('RESERVATION_CREATED', { so_luong: kq.thanh_cong.length });
    res.status(201).json({ ok: true, ...kq });
  } catch (e) { traLoi(res, e, 409); }
}));

router.put('/api/reservations/:id', laSo, bat(async (req, res) => {
  try {
    const r = await dv.capNhat(req.params.id, req.body, nguoiDung(req));
    bao('RESERVATION_UPDATED', { reservation_id: Number(req.params.id), ma: r.reservation_code });
    res.json({ ok: true, r });
  } catch (e) { traLoi(res, e, 409); }
}));

router.post('/api/reservations/:id/assign-table', laSo, bat(async (req, res) => {
  try {
    const kq = await dv.ganBan(req.params.id, req.body.table_ids ?? req.body.ban, nguoiDung(req));
    bao('TABLE_ASSIGNED', { reservation_id: Number(req.params.id) });
    res.json({ ok: true, ...kq });
  } catch (e) { traLoi(res, e, 409); }
}));

/** Giu ban them N phut khi khach goi bao den tre (muc 7). */
router.post('/api/reservations/:id/giu-them', laSo, bat(async (req, res) => {
  try {
    const kq = await dv.giuThem(req.params.id, req.body.phut, nguoiDung(req));
    bao('HOLD_EXTENDED', { reservation_id: Number(req.params.id) });
    res.json({ ok: true, ...kq });
  } catch (e) { traLoi(res, e, 409); }
}));

router.post('/api/reservations/:id/deposit', laSo, phanQuyen.canVaiTroCu(['Thu ngan', 'Ke toan', 'Quan ly']),
  bat(async (req, res) => {
    try {
      const r = await dv.luuCoc(req.params.id, req.body, nguoiDung(req));
      bao('DEPOSIT_UPDATED', { reservation_id: Number(req.params.id) });
      res.json({ ok: true, r });
    } catch (e) { traLoi(res, e, 409); }
  }));

/**
 * Cac buoc chuyen trang thai, moi buoc mot duong dan rieng.
 *
 * Khong lam mot route `PUT /:id/status` nhan trang thai trong than request:
 * duong dan rieng cho phep dat quyen khac nhau cho tung buoc (chi quan ly duoc
 * `reject`), va doc nhat ky may chu la biet ngay ai da lam gi.
 */
const HANH_DONG = {
  confirm: 'CONFIRMED',
  'check-in': 'ARRIVED',
  seat: 'SEATED',
  complete: 'COMPLETED',
  cancel: 'CANCELLED',
  'no-show': 'NO_SHOW',
  waitlist: 'WAITLIST',
};

for (const [duong, trangThai] of Object.entries(HANH_DONG)) {
  router.post(`/api/reservations/:id/${duong}`, laSo, bat(async (req, res) => {
    try {
      const kq = await dv.doiTrangThai(req.params.id, trangThai, {
        ...nguoiDung(req),
        ghiChu: req.body.ghi_chu,
        lyDo: req.body.ly_do,
        boiAi: 'STAFF',
      });
      bao(`RESERVATION_${trangThai}`, { reservation_id: Number(req.params.id), ma: kq.ma });
      res.json({ ok: true, ...kq });
    } catch (e) { traLoi(res, e, 409); }
  }));
}

/** Tu choi: chi quan ly. Day la loi tu choi phuc vu mot khach hang. */
router.post('/api/reservations/:id/reject', laSo, canQuanLy, bat(async (req, res) => {
  try {
    const kq = await dv.doiTrangThai(req.params.id, 'REJECTED', {
      ...nguoiDung(req), ghiChu: req.body.ghi_chu, lyDo: req.body.ly_do,
    });
    bao('RESERVATION_REJECTED', { reservation_id: Number(req.params.id), ma: kq.ma });
    res.json({ ok: true, ...kq });
  } catch (e) { traLoi(res, e, 409); }
}));

/**
 * DELETE /api/reservations/:id - huy, KHONG xoa.
 *
 * Muc 24 cua de bai liet ke DELETE. Nhung mot luot dat da tung ton tai la mot
 * su that lich su: no anh huong bo dem no-show cua khach, bao cao thang, va
 * doi khi ca mot khoan tien coc. Xoa dong do di la lam mat kha nang tra loi
 * "chuyen gi da xay ra". Nen DELETE o day duoc anh xa sang CANCELLED.
 */
router.delete('/api/reservations/:id', laSo, bat(async (req, res) => {
  try {
    const kq = await dv.doiTrangThai(req.params.id, 'CANCELLED', {
      ...nguoiDung(req), lyDo: req.body.ly_do || 'Hủy bởi nhân viên', boiAi: 'STAFF',
    });
    bao('RESERVATION_CANCELLED', { reservation_id: Number(req.params.id), ma: kq.ma });
    res.json({ ok: true, ...kq, ghi_chu: 'Lượt đặt được chuyển sang trạng thái Đã hủy, không xóa khỏi lịch sử.' });
  } catch (e) { traLoi(res, e, 409); }
}));

// ===========================================================================
// KHU QUAN LY / QUAN TRI - cau hinh va phan tich
// ===========================================================================

/** Trang phan tich cho quan ly (dung phien nhan vien). */
router.get('/staff/dat-ban/phan-tich', canQuanLy, bat(async (req, res) => {
  const den = qt.ngayChuoi(req.query.den || ngayCucBo());
  const macTu = new Date();
  macTu.setDate(macTu.getDate() - 29);
  const tu = qt.ngayChuoi(req.query.tu || ngayCucBo(macTu));

  const personnelService = require('../services/personnelService');
  res.render('staff/dat-ban-phan-tich', {
    title: 'Phân tích đặt bàn',
    activePage: 'reservations',
    unread: await personnelService.countUnread(req.session.staffId).catch(() => 0),
    tu, den,
    pt: await dv.phanTich(tu, den),
  });
}));

/** Trang cau hinh - phien quan tri. */
router.get('/admin/dat-ban', canQuanTri, bat(async (req, res) => {
  const [cauHinh, gioMoCua, ngayNghi, chinhSach, quyTacCoc, dsBan, khuVuc] = await Promise.all([
    ch.docChoGiaoDien(),
    ch.docGioMoCua(),
    ch.docNgayNghi(),
    ch.docChinhSachHuy(),
    ch.docQuyTacCoc(),
    xb.docBan({ chiChoDat: false }),
    xb.docKhuVuc({ chiChoDat: false }),
  ]);
  res.render('admin/dat-ban', {
    title: 'Cấu hình đặt bàn',
    cauHinh, gioMoCua, ngayNghi, chinhSach, quyTacCoc, dsBan, khuVuc,
    homNay: ngayCucBo(),
  });
}));

/**
 * API cau hinh: chap nhan CA HAI cua - phien quan tri hoac chuc danh Quan ly.
 *
 * Quan ly nha hang phai sua duoc gio mo cua va chinh sach huy ma khong can tai
 * khoan quan tri he thong: do la quyet dinh kinh doanh hang ngay cua ho, khong
 * phai viec ky thuat.
 */
const canCauHinh = (req, res, next) => {
  if (req.session && req.session.adminlogin) return next();
  return canQuanLy(req, res, next);
};

router.use('/api/reservation-config', apiCanDangNhap, canCauHinh);

router.get('/api/reservation-config', bat(async (req, res) => {
  res.json({
    ok: true,
    cau_hinh: await ch.docChoGiaoDien(),
    gio_mo_cua: await ch.docGioMoCua(),
    ngay_nghi: await ch.docNgayNghi(),
    chinh_sach_huy: await ch.docChinhSachHuy(),
    quy_tac_coc: await ch.docQuyTacCoc(),
  });
}));

router.put('/api/reservation-config', bat(async (req, res) => {
  try {
    const kq = await ch.luuCauHinh({ ...req.body, __form: true }, nguoiDung(req));
    bao('CONFIG_UPDATED', { so_thay_doi: kq.da_doi.length });
    res.json({ ok: true, ...kq });
  } catch (e) { traLoi(res, e); }
}));

router.put('/api/reservation-config/gio-mo-cua', bat(async (req, res) => {
  try { res.json({ ok: true, gio_mo_cua: await ch.luuGioMoCua(req.body.ngay || req.body) }); }
  catch (e) { traLoi(res, e); }
}));

router.post('/api/reservation-config/ngay-nghi', bat(async (req, res) => {
  try { res.json({ ok: true, ...await ch.themNgayNghi(req.body.ngay, req.body.ly_do, nguoiDung(req)) }); }
  catch (e) { traLoi(res, e); }
}));

router.delete('/api/reservation-config/ngay-nghi/:id', laSo, bat(async (req, res) => {
  await ch.xoaNgayNghi(req.params.id);
  res.json({ ok: true });
}));

router.post('/api/reservation-config/chinh-sach-huy', bat(async (req, res) => {
  try { res.json({ ok: true, ...await ch.luuChinhSachHuy(req.body) }); }
  catch (e) { traLoi(res, e); }
}));

router.delete('/api/reservation-config/chinh-sach-huy/:id', laSo, bat(async (req, res) => {
  await ch.xoaChinhSachHuy(req.params.id);
  res.json({ ok: true });
}));

router.post('/api/reservation-config/quy-tac-coc', bat(async (req, res) => {
  try { res.json({ ok: true, ...await ch.luuQuyTacCoc(req.body) }); }
  catch (e) { traLoi(res, e); }
}));

router.delete('/api/reservation-config/quy-tac-coc/:id', laSo, bat(async (req, res) => {
  await ch.xoaQuyTacCoc(req.params.id);
  res.json({ ok: true });
}));

router.put('/api/reservation-config/ban/:id', laSo, bat(async (req, res) => {
  try {
    await ch.luuThuocTinhBan(req.params.id, req.body);
    bao('TABLE_CONFIG_UPDATED', { ban_id: Number(req.params.id) });
    res.json({ ok: true });
  } catch (e) { traLoi(res, e); }
}));

router.put('/api/reservation-config/khu-vuc/:id', laSo, bat(async (req, res) => {
  try {
    await ch.luuThuocTinhKhuVuc(req.params.id, req.body);
    res.json({ ok: true });
  } catch (e) { traLoi(res, e); }
}));

/**
 * Chay tay mot nhip quet nen.
 *
 * Co ich khi kiem thu va khi may chu vua khoi dong lai: khong phai cho den chu
 * ky ke tiep de biet vong quet co chay dung khong.
 */
router.post('/api/reservation-config/quet-ngay', bat(async (req, res) => {
  res.json({ ok: true, ket_qua: await jobs.chayMotNhip() });
}));

module.exports = router;
