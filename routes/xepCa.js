/**
 * Router xep ca tu dong (khu vuc nhan su / quan ly).
 *
 * Cac man hinh:
 *   /staff/xep-ca            Luoi tuan: ngay x ca, xep tu dong, sua tay, chot
 *   /staff/xep-ca/dinh-muc   Khai bao moi (thu, ca, chuc vu) can bao nhieu nguoi
 */
const express = require('express');
const svc = require('../services/lichLamViecService');
const { thuHaiCuaTuan, ngayISO } = require('../services/xepCa');
const realtime = require('../services/realtime');

const router = express.Router();
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Chan nguoi chua dang nhap quan ly hoac nhan su co tham quyen.
 */
const canQuanLy = (req, res, next) => {
  if (req.session && req.session.adminlogin) return next();
  if (req.session && req.session.stafflogin) {
    const vaiTro = (req.session.staffRole || '').toLowerCase();
    if (/quan ly|quanly|manager/.test(vaiTro) || (req.hoSo && req.hoSo.cap_bac <= 2)) return next();
  }
  return res.redirect('/staff/login');
};

/**
 * Tuan lay tu query hoac tu form, khong hop le thi lay tuan chua hom nay.
 */
function tuanTuQuery(req) {
  const t = String(req.query.tuan || (req.body || {}).tuan || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return thuHaiCuaTuan(t);
  return thuHaiCuaTuan(ngayISO(new Date()));
}

/** Ve lai trang tuan kem mot thong bao. */
function veTuan(req, res, tuan, msg, loai = 'success') {
  const goc = (req.baseUrl || '') + '/staff/xep-ca';
  const q = msg ? `&msg=${encodeURIComponent(msg)}&msgType=${loai}` : '';
  res.redirect(`${goc}?tuan=${tuan}${q}`);
}

// Redirect old admin route if any
router.use((req, res, next) => {
  if (req.originalUrl && req.originalUrl.startsWith('/admin/xep-ca')) {
    return res.redirect(req.originalUrl.replace('/admin/xep-ca', '/staff/xep-ca'));
  }
  next();
});

// ===========================================================================
// MAN HINH LUOI TUAN
// ===========================================================================

router.get('/staff/xep-ca', canQuanLy, bat(async (req, res) => {
  const tuan = tuanTuQuery(req);
  const dl = await svc.duLieuTuan(tuan);

  // Tuan truoc / tuan sau cho hai nut dieu huong.
  const lui = new Date(tuan + 'T00:00:00'); lui.setDate(lui.getDate() - 7);
  const toi = new Date(tuan + 'T00:00:00'); toi.setDate(toi.getDate() + 7);

  res.render('staff/xep-ca', {
    title: 'Xếp ca tự động',
    isStaff: true,
    ...dl,
    tuan,
    tuanTruoc: ngayISO(lui),
    tuanSau: ngayISO(toi),
    TT: svc.TT,
    msg: req.query.msg || null,
    msgType: req.query.msgType || 'success',
  });
}));

router.post('/staff/xep-ca/tu-dong', canQuanLy, bat(async (req, res) => {
  const tuan = tuanTuQuery(req);
  const kq = await svc.xepTuDong(tuan);
  realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: '/staff/xep-ca' });

  const msg = kq.thieu.length
    ? `Đã xếp ${kq.thongKe.da_xep}/${kq.thongKe.tong_can} lượt. Còn thiếu ${kq.thongKe.thieu} lượt — xem cảnh báo bên dưới.`
    : `Đã xếp đủ ${kq.thongKe.da_xep} lượt cho cả tuần.`;
  veTuan(req, res, tuan, msg, kq.thieu.length ? 'warning' : 'success');
}));

router.post('/staff/xep-ca/them', canQuanLy, bat(async (req, res) => {
  const tuan = tuanTuQuery(req);
  const { id_nv, ngay, ma_ca } = req.body;
  try {
    await svc.themVaoCa(Number(id_nv), ngay, ma_ca);
    realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: '/staff/xep-ca' });
    veTuan(req, res, tuan, 'Đã thêm nhân viên vào ca.');
  } catch (e) {
    veTuan(req, res, tuan, e.message, 'danger');
  }
}));

router.post('/staff/xep-ca/bo/:id', canQuanLy, bat(async (req, res) => {
  const tuan = tuanTuQuery(req);
  try {
    await svc.boKhoiCa(Number(req.params.id));
    realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: '/staff/xep-ca' });
    veTuan(req, res, tuan, 'Đã bỏ khỏi ca.');
  } catch (e) {
    veTuan(req, res, tuan, e.message, 'danger');
  }
}));

router.post('/staff/xep-ca/chot', canQuanLy, bat(async (req, res) => {
  const tuan = tuanTuQuery(req);
  const n = await svc.chotTuan(tuan);
  realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: '/staff/xep-ca' });
  veTuan(req, res, tuan,
    n > 0 ? `Đã chốt ${n} ca. Nhân viên đã nhìn thấy lịch này.` : 'Không có bản nháp nào để chốt.',
    n > 0 ? 'success' : 'warning');
}));

router.post('/staff/xep-ca/xoa-nhap', canQuanLy, bat(async (req, res) => {
  const tuan = tuanTuQuery(req);
  const n = await svc.xoaNhap(tuan);
  realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: '/staff/xep-ca' });
  veTuan(req, res, tuan, `Đã xoá ${n} dòng nháp. Lịch đã chốt không bị ảnh hưởng.`, 'info');
}));

// ===========================================================================
// DINH MUC NHAN SU
// ===========================================================================

router.get('/staff/xep-ca/dinh-muc', canQuanLy, bat(async (req, res) => {
  const [caList, dinhMuc, nhanVien] = await Promise.all([
    svc.dsCa(), svc.dsDinhMuc(), svc.dsNhanVien(),
  ]);

  const soNguoi = {};
  for (const nv of nhanVien) soNguoi[nv.chucvu] = (soNguoi[nv.chucvu] || 0) + 1;

  res.render('staff/xep-ca-dinh-muc', {
    title: 'Định mức nhân sự theo ca',
    isStaff: true,
    caList,
    dinhMuc,
    chucVuList: svc.CHUC_VU,
    soNguoi,
    msg: req.query.msg || null,
    msgType: req.query.msgType || 'success',
  });
}));

router.post('/staff/xep-ca/dinh-muc', canQuanLy, bat(async (req, res) => {
  const ds = [];
  for (const [khoa, gt] of Object.entries((req.body || {}).so_luong || {})) {
    const [thu, ma_ca, chucvu] = khoa.split('|');
    ds.push({ thu, ma_ca, chucvu, so_luong: gt });
  }
  await svc.luuDinhMuc(ds);
  const goc = '/staff/xep-ca/dinh-muc';
  realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: goc });
  res.redirect(`${goc}?msg=` + encodeURIComponent('Đã lưu định mức.'));
}));

// ===========================================================================
// DU BAO NHU CAU NHAN SU -> DE XUAT DINH MUC (services/duBaoNhanSuService.js)
// ===========================================================================

router.get('/staff/xep-ca/du-bao', canQuanLy, bat(async (req, res) => {
  const dbns = require('../services/duBaoNhanSuService');
  // Mac dinh du bao cho TUAN SAU (tuan can xep lich), co the chon tuan khac.
  let tuan = String(req.query.tuan || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(tuan)) tuan = thuHaiCuaTuan(tuan);
  else { const d = new Date(thuHaiCuaTuan(ngayISO(new Date())) + 'T00:00:00'); d.setDate(d.getDate() + 7); tuan = ngayISO(d); }
  const [kq, dinhMuc] = await Promise.all([dbns.duBao({ tuanBatDau: tuan }), svc.dsDinhMuc()]);
  const hienTai = {};
  for (const d of dinhMuc) hienTai[`${d.thu}|${d.ma_ca}|${d.chucvu}`] = Number(d.so_luong) || 0;
  const lui = new Date(tuan + 'T00:00:00'); lui.setDate(lui.getDate() - 7);
  const toi = new Date(tuan + 'T00:00:00'); toi.setDate(toi.getDate() + 7);
  res.render('staff/xep-ca-du-bao', {
    title: 'Dự báo nhu cầu nhân sự',
    isStaff: true,
    kq, hienTai, tuan, tuanTruoc: ngayISO(lui), tuanSau: ngayISO(toi),
    TEN_THU: dbns.TEN_THU, TEN_CHUC_VU: dbns.TEN_CHUC_VU, CHUC_VU: dbns.CHUC_VU_DU_BAO, NHAN_THAM_SO: dbns.NHAN_THAM_SO,
    msg: req.query.msg || null,
    msgType: req.query.msgType || 'success',
  });
}));

router.post('/staff/xep-ca/du-bao/tham-so', canQuanLy, bat(async (req, res) => {
  await require('../services/duBaoNhanSuService').luuThamSo(req.body || {});
  res.redirect('/staff/xep-ca/du-bao?tuan=' + encodeURIComponent(String((req.body || {}).tuan || '')) +
    '&msg=' + encodeURIComponent('Đã lưu giả định năng suất.'));
}));

router.post('/staff/xep-ca/du-bao/ap-dung', canQuanLy, bat(async (req, res) => {
  const dbns = require('../services/duBaoNhanSuService');
  const tuan = tuanTuQuery(req);
  let chon = (req.body || {}).chuc_vu || [];
  if (!Array.isArray(chon)) chon = [chon];
  try {
    // Tinh lai tren may chu - khong nhan so lieu de xuat tu trinh duyet.
    const kq = await dbns.duBao({ tuanBatDau: tuan });
    await dbns.apDung(kq.de_xuat, chon);
    realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: '/staff/xep-ca/dinh-muc' });
    res.redirect('/staff/xep-ca/dinh-muc?msg=' + encodeURIComponent(
      'Đã áp dụng đề xuất dự báo cho: ' + chon.map((c) => dbns.TEN_CHUC_VU[c] || c).join(', ') + '.'));
  } catch (e) {
    res.redirect('/staff/xep-ca/du-bao?tuan=' + tuan + '&msgType=danger&msg=' + encodeURIComponent(e.message));
  }
}));

module.exports = router;
