/**
 * Router xep ca tu dong (khu quan tri).
 *
 * Hai man hinh:
 *   /admin/xep-ca            Luoi tuan: ngay x ca, xep tu dong, sua tay, chot
 *   /admin/xep-ca/dinh-muc   Khai bao moi (thu, ca, chuc vu) can bao nhieu nguoi
 *
 * PHAN BIET VOI /admin/schedule DA CO
 *   `/admin/schedule` la mot danh sach phang: nhan vien dang ky ca nao thi quan
 *   tri duyet hoac tu choi tung dong. No di tu NGUOI len. Man hinh o day di
 *   nguoc lai - tu NHU CAU cua nha hang xuong: khai truoc moi ca can may nguoi,
 *   roi de may tim nguoi lap vao. Hai man hinh cung ghi vao `lich_lam_viec` va
 *   bo sung cho nhau, khong thay the nhau.
 *
 * TAT CA THAO TAC GHI DEU LA POST + REDIRECT
 *   Chu khong tra HTML thang. Xep ca la thao tac nang (ghi vai chuc dong); de
 *   nguoi dung bam F5 tren mot trang POST roi xep lai lan nua la chuyen se xay
 *   ra. Redirect xong thi F5 chi tai lai trang xem.
 */
const express = require('express');
const svc = require('../services/lichLamViecService');
const { thuHaiCuaTuan, ngayISO } = require('../services/xepCa');
const realtime = require('../services/realtime');

const router = express.Router();
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Chan nguoi chua dang nhap quan tri.
 *
 * Dinh nghia lai o day thay vi dung `requireAdmin` cua server.js vi ham do la
 * bien cuc bo trong tep ay, khong export. Hai ban giong het nhau; neu sau nay
 * doi cach xac thuc quan tri thi phai sua ca hai cho.
 */
const canQuanTri = (req, res, next) => {
  if (req.session && req.session.adminlogin) return next();
  if (req.session && req.session.stafflogin) {
    const vaiTro = (req.session.staffRole || '').toLowerCase();
    if (/quan ly|quanly|manager/.test(vaiTro) || (req.hoSo && req.hoSo.cap_bac <= 2)) return next();
  }
  return res.redirect('/admin/login');
};

/**
 * Tuan lay tu query hoac tu form, khong hop le thi lay tuan chua hom nay.
 *
 * `req.body || {}` la bat buoc: tu Express 5, request GET khong co than nen
 * `req.body` la `undefined` chu khong con la object rong nhu Express 4. Doc
 * thang `req.body.tuan` se nem "Cannot read properties of undefined".
 */
function tuanTuQuery(req) {
  const t = String(req.query.tuan || (req.body || {}).tuan || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return thuHaiCuaTuan(t);
  return thuHaiCuaTuan(ngayISO(new Date()));
}

const isStaffRoute = (req) => {
  const p = req.originalUrl || req.path || '';
  return p.startsWith('/staff');
};

/** Ve lai trang tuan kem mot thong bao. */
function veTuan(req, res, tuan, msg, loai = 'success') {
  const goc = (req.baseUrl || '') + (isStaffRoute(req) ? '/staff/xep-ca' : '/admin/xep-ca');
  const q = msg ? `&msg=${encodeURIComponent(msg)}&msgType=${loai}` : '';
  res.redirect(`${goc}?tuan=${tuan}${q}`);
}

// ===========================================================================
// MAN HINH LUOI TUAN
// ===========================================================================

router.get(['/admin/xep-ca', '/staff/xep-ca'], canQuanTri, bat(async (req, res) => {
  const tuan = tuanTuQuery(req);
  const dl = await svc.duLieuTuan(tuan);

  // Tuan truoc / tuan sau cho hai nut dieu huong.
  const lui = new Date(tuan + 'T00:00:00'); lui.setDate(lui.getDate() - 7);
  const toi = new Date(tuan + 'T00:00:00'); toi.setDate(toi.getDate() + 7);

  res.render('admin/xep-ca', {
    title: 'Xếp ca tự động',
    isStaff: isStaffRoute(req),
    ...dl,
    tuan,
    tuanTruoc: ngayISO(lui),
    tuanSau: ngayISO(toi),
    TT: svc.TT,
    msg: req.query.msg || null,
    msgType: req.query.msgType || 'success',
  });
}));

router.post(['/admin/xep-ca/tu-dong', '/staff/xep-ca/tu-dong'], canQuanTri, bat(async (req, res) => {
  const tuan = tuanTuQuery(req);
  const kq = await svc.xepTuDong(tuan);
  realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: isStaffRoute(req) ? '/staff/xep-ca' : '/admin/xep-ca' });

  const msg = kq.thieu.length
    ? `Đã xếp ${kq.thongKe.da_xep}/${kq.thongKe.tong_can} lượt. Còn thiếu ${kq.thongKe.thieu} lượt — xem cảnh báo bên dưới.`
    : `Đã xếp đủ ${kq.thongKe.da_xep} lượt cho cả tuần.`;
  veTuan(req, res, tuan, msg, kq.thieu.length ? 'warning' : 'success');
}));

router.post(['/admin/xep-ca/them', '/staff/xep-ca/them'], canQuanTri, bat(async (req, res) => {
  const tuan = tuanTuQuery(req);
  const { id_nv, ngay, ma_ca } = req.body;
  try {
    await svc.themVaoCa(Number(id_nv), ngay, ma_ca);
    realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: isStaffRoute(req) ? '/staff/xep-ca' : '/admin/xep-ca' });
    veTuan(req, res, tuan, 'Đã thêm nhân viên vào ca.');
  } catch (e) {
    veTuan(req, res, tuan, e.message, 'danger');
  }
}));

router.post(['/admin/xep-ca/bo/:id', '/staff/xep-ca/bo/:id'], canQuanTri, bat(async (req, res) => {
  const tuan = tuanTuQuery(req);
  try {
    await svc.boKhoiCa(Number(req.params.id));
    realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: isStaffRoute(req) ? '/staff/xep-ca' : '/admin/xep-ca' });
    veTuan(req, res, tuan, 'Đã bỏ khỏi ca.');
  } catch (e) {
    veTuan(req, res, tuan, e.message, 'danger');
  }
}));

router.post(['/admin/xep-ca/chot', '/staff/xep-ca/chot'], canQuanTri, bat(async (req, res) => {
  const tuan = tuanTuQuery(req);
  const n = await svc.chotTuan(tuan);
  realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: isStaffRoute(req) ? '/staff/xep-ca' : '/admin/xep-ca' });
  veTuan(req, res, tuan,
    n > 0 ? `Đã chốt ${n} ca. Nhân viên đã nhìn thấy lịch này.` : 'Không có bản nháp nào để chốt.',
    n > 0 ? 'success' : 'warning');
}));

router.post(['/admin/xep-ca/xoa-nhap', '/staff/xep-ca/xoa-nhap'], canQuanTri, bat(async (req, res) => {
  const tuan = tuanTuQuery(req);
  const n = await svc.xoaNhap(tuan);
  realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: isStaffRoute(req) ? '/staff/xep-ca' : '/admin/xep-ca' });
  veTuan(req, res, tuan, `Đã xoá ${n} dòng nháp. Lịch đã chốt không bị ảnh hưởng.`, 'info');
}));

// ===========================================================================
// DINH MUC NHAN SU
// ===========================================================================

router.get(['/admin/xep-ca/dinh-muc', '/staff/xep-ca/dinh-muc'], canQuanTri, bat(async (req, res) => {
  const [caList, dinhMuc, nhanVien] = await Promise.all([
    svc.dsCa(), svc.dsDinhMuc(), svc.dsNhanVien(),
  ]);

  const soNguoi = {};
  for (const nv of nhanVien) soNguoi[nv.chucvu] = (soNguoi[nv.chucvu] || 0) + 1;

  res.render('admin/xep-ca-dinh-muc', {
    title: 'Định mức nhân sự theo ca',
    isStaff: isStaffRoute(req),
    caList,
    dinhMuc,
    chucVuList: svc.CHUC_VU,
    soNguoi,
    msg: req.query.msg || null,
    msgType: req.query.msgType || 'success',
  });
}));

router.post(['/admin/xep-ca/dinh-muc', '/staff/xep-ca/dinh-muc'], canQuanTri, bat(async (req, res) => {
  const ds = [];
  for (const [khoa, gt] of Object.entries((req.body || {}).so_luong || {})) {
    const [thu, ma_ca, chucvu] = khoa.split('|');
    ds.push({ thu, ma_ca, chucvu, so_luong: gt });
  }
  await svc.luuDinhMuc(ds);
  const goc = isStaffRoute(req) ? '/staff/xep-ca/dinh-muc' : '/admin/xep-ca/dinh-muc';
  realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: goc });
  res.redirect(`${goc}?msg=` + encodeURIComponent('Đã lưu định mức.'));
}));

// ===========================================================================
// LỊCH CỐ ĐỊNH HÀNG THÁNG (CẤU HÌNH THEO TUẦN -> ÁP DỤNG CẢ THÁNG)
// ===========================================================================

router.get(['/admin/xep-ca/co-dinh', '/staff/xep-ca/co-dinh'], canQuanTri, bat(async (req, res) => {
  const [caList, nhanVien, mauList] = await Promise.all([
    svc.dsCa(),
    svc.dsNhanVien(),
    svc.dsMauCoDinh(),
  ]);

  const mauMap = {};
  for (const m of mauList) {
    mauMap[`${m.id_nv}|${m.thu}`] = m.ma_ca;
  }

  const d = new Date();
  const thangQuery = String(req.query.thang || '').trim();
  const thangMacDinh = /^\d{4}-\d{2}$/.test(thangQuery)
    ? thangQuery
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  let tuanChon = String(req.query.tuan || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tuanChon)) {
    const homNayISO = ngayISO(d);
    if (homNayISO.startsWith(thangMacDinh)) {
      tuanChon = thuHaiCuaTuan(homNayISO);
    } else {
      tuanChon = thuHaiCuaTuan(`${thangMacDinh}-01`);
    }
  } else {
    tuanChon = thuHaiCuaTuan(tuanChon);
  }

  const startD = new Date(tuanChon + 'T00:00:00');
  const dTruoc = new Date(startD);
  dTruoc.setDate(startD.getDate() - 7);
  const dSau = new Date(startD);
  dSau.setDate(startD.getDate() + 7);

  const tuanTruoc = ngayISO(dTruoc);
  const tuanSau = ngayISO(dSau);

  const thuNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const cacNgayTrongTuan = [];
  for (let i = 0; i < 7; i++) {
    const curD = new Date(startD);
    curD.setDate(startD.getDate() + i);
    const iso = ngayISO(curD);
    const dayOfWeek = curD.getDay(); // 0: CN, 1: T2, ..., 6: T7
    cacNgayTrongTuan.push({
      thu: dayOfWeek,
      tenThu: thuNames[dayOfWeek],
      ngayISO: iso,
      ngayVN: `${String(curD.getDate()).padStart(2, '0')}/${String(curD.getMonth() + 1).padStart(2, '0')}`,
      ngayVNDayDu: `${String(curD.getDate()).padStart(2, '0')}/${String(curD.getMonth() + 1).padStart(2, '0')}/${curD.getFullYear()}`,
      laTrongThang: iso.startsWith(thangMacDinh),
    });
  }

  res.render('admin/xep-ca-co-dinh', {
    title: 'Lịch làm việc cố định theo tháng',
    isStaff: isStaffRoute(req),
    caList,
    nhanVien,
    mauMap,
    thangMacDinh,
    tuanChon,
    tuanTruoc,
    tuanSau,
    cacNgayTrongTuan,
    msg: req.query.msg || null,
    msgType: req.query.msgType || 'success',
  });
}));

router.post(['/admin/xep-ca/co-dinh', '/staff/xep-ca/co-dinh'], canQuanTri, bat(async (req, res) => {
  const ds = [];
  const caData = (req.body || {}).ca || {};
  for (const [khoa, ma_ca] of Object.entries(caData)) {
    if (!ma_ca) continue;
    const [id_nv, thu] = khoa.split('|');
    ds.push({ id_nv, thu, ma_ca });
  }

  await svc.luuMauCoDinh(ds);
  const goc = isStaffRoute(req) ? '/staff/xep-ca/co-dinh' : '/admin/xep-ca/co-dinh';
  realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: goc });
  res.redirect(`${goc}?msg=` + encodeURIComponent('Đã lưu mẫu lịch làm việc cố định tuần thành công!'));
}));

router.post(['/admin/xep-ca/ap-dung-thang', '/staff/xep-ca/ap-dung-thang'], canQuanTri, bat(async (req, res) => {
  const thang = String((req.body || {}).thang || '').trim();
  const tuDongChot = (req.body || {}).tu_dong_chot === '1';
  const goc = isStaffRoute(req) ? '/staff/xep-ca/co-dinh' : '/admin/xep-ca/co-dinh';

  try {
    const kq = await svc.apDungMauTheoThang(thang, tuDongChot);
    realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: isStaffRoute(req) ? '/staff/xep-ca' : '/admin/xep-ca' });
    const msg = `Thành công: Đã tự động tạo ${kq.soLichMoi} lượt làm việc cho cả tháng ${thang} (${tuDongChot ? 'Đã duyệt & chốt' : 'Bản nháp'})! Nhân viên không cần phải đăng ký lẻ tẻ.`;
    res.redirect(`${goc}?msg=` + encodeURIComponent(msg) + '&msgType=success');
  } catch (e) {
    res.redirect(`${goc}?msg=` + encodeURIComponent(e.message) + '&msgType=danger');
  }
}));

module.exports = router;
