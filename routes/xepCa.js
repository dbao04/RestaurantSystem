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
  if (!req.session.adminlogin) return res.redirect('/admin/login');
  next();
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

/** Ve lai trang tuan kem mot thong bao. */
function veTuan(res, tuan, msg, loai = 'success') {
  const q = msg ? `&msg=${encodeURIComponent(msg)}&msgType=${loai}` : '';
  res.redirect(`/admin/xep-ca?tuan=${tuan}${q}`);
}

// ===========================================================================
// MAN HINH LUOI TUAN
// ===========================================================================

router.get('/admin/xep-ca', canQuanTri, bat(async (req, res) => {
  const tuan = tuanTuQuery(req);
  const dl = await svc.duLieuTuan(tuan);

  // Tuan truoc / tuan sau cho hai nut dieu huong.
  const lui = new Date(tuan + 'T00:00:00'); lui.setDate(lui.getDate() - 7);
  const toi = new Date(tuan + 'T00:00:00'); toi.setDate(toi.getDate() + 7);

  res.render('admin/xep-ca', {
    title: 'Xếp ca tự động',
    ...dl,
    tuan,
    tuanTruoc: ngayISO(lui),
    tuanSau: ngayISO(toi),
    TT: svc.TT,
    msg: req.query.msg || null,
    msgType: req.query.msgType || 'success',
  });
}));

router.post('/admin/xep-ca/tu-dong', canQuanTri, bat(async (req, res) => {
  const tuan = tuanTuQuery(req);
  const kq = await svc.xepTuDong(tuan);
  realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: '/admin/xep-ca' });

  const msg = kq.thieu.length
    ? `Đã xếp ${kq.thongKe.da_xep}/${kq.thongKe.tong_can} lượt. Còn thiếu ${kq.thongKe.thieu} lượt — xem cảnh báo bên dưới.`
    : `Đã xếp đủ ${kq.thongKe.da_xep} lượt cho cả tuần.`;
  veTuan(res, tuan, msg, kq.thieu.length ? 'warning' : 'success');
}));

router.post('/admin/xep-ca/them', canQuanTri, bat(async (req, res) => {
  const tuan = tuanTuQuery(req);
  const { id_nv, ngay, ma_ca } = req.body;
  try {
    await svc.themVaoCa(Number(id_nv), ngay, ma_ca);
    realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: '/admin/xep-ca' });
    veTuan(res, tuan, 'Đã thêm nhân viên vào ca.');
  } catch (e) {
    veTuan(res, tuan, e.message, 'danger');
  }
}));

router.post('/admin/xep-ca/bo/:id', canQuanTri, bat(async (req, res) => {
  const tuan = tuanTuQuery(req);
  try {
    await svc.boKhoiCa(Number(req.params.id));
    realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: '/admin/xep-ca' });
    veTuan(res, tuan, 'Đã bỏ khỏi ca.');
  } catch (e) {
    veTuan(res, tuan, e.message, 'danger');
  }
}));

router.post('/admin/xep-ca/chot', canQuanTri, bat(async (req, res) => {
  const tuan = tuanTuQuery(req);
  const n = await svc.chotTuan(tuan);
  realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: '/admin/xep-ca' });
  veTuan(res, tuan,
    n > 0 ? `Đã chốt ${n} ca. Nhân viên đã nhìn thấy lịch này.` : 'Không có bản nháp nào để chốt.',
    n > 0 ? 'success' : 'warning');
}));

router.post('/admin/xep-ca/xoa-nhap', canQuanTri, bat(async (req, res) => {
  const tuan = tuanTuQuery(req);
  const n = await svc.xoaNhap(tuan);
  realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: '/admin/xep-ca' });
  veTuan(res, tuan, `Đã xoá ${n} dòng nháp. Lịch đã chốt không bị ảnh hưởng.`, 'info');
}));

// ===========================================================================
// DINH MUC NHAN SU
// ===========================================================================

router.get('/admin/xep-ca/dinh-muc', canQuanTri, bat(async (req, res) => {
  const [caList, dinhMuc, nhanVien] = await Promise.all([
    svc.dsCa(), svc.dsDinhMuc(), svc.dsNhanVien(),
  ]);

  // So nguoi hien co tung chuc vu - de nguoi khai dinh muc biet ngay minh dang
  // doi hoi nhieu hon so nguoi thuc su co.
  const soNguoi = {};
  for (const nv of nhanVien) soNguoi[nv.chucvu] = (soNguoi[nv.chucvu] || 0) + 1;

  res.render('admin/xep-ca-dinh-muc', {
    title: 'Định mức nhân sự theo ca',
    caList,
    dinhMuc,
    chucVuList: svc.CHUC_VU,
    soNguoi,
    msg: req.query.msg || null,
    msgType: req.query.msgType || 'success',
  });
}));

router.post('/admin/xep-ca/dinh-muc', canQuanTri, bat(async (req, res) => {
  // Form gui len dang so_luong[thu|ma_ca|chucvu] = n. Gom lai thanh mang.
  const ds = [];
  for (const [khoa, gt] of Object.entries((req.body || {}).so_luong || {})) {
    const [thu, ma_ca, chucvu] = khoa.split('|');
    ds.push({ thu, ma_ca, chucvu, so_luong: gt });
  }
  await svc.luuDinhMuc(ds);
  realtime.doi(realtime.MIEN.LICH_LAM, { duong_dan: '/admin/xep-ca/dinh-muc' });
  res.redirect('/admin/xep-ca/dinh-muc?msg=' + encodeURIComponent('Đã lưu định mức.'));
}));

module.exports = router;
