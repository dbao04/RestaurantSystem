/**
 * THONG BAO cho moi vai tro (services/thongBaoService.js).
 *
 *   GET  /api/thong-bao?la=nv|quan_tri|khach     chuong: so chua doc + danh sach moi nhat
 *   POST /api/thong-bao/:id/doc                   danh dau mot thong bao da doc
 *   POST /api/thong-bao/doc-tat-ca                danh dau tat ca da doc
 *   GET  /staff/thong-bao                          trang thong bao nhan vien (loc chua doc / theo loai)
 *   GET  /staff/thong-bao/luong                    bang thiet ke luong thong bao
 *   GET  /admin/thong-bao                          trang thong bao quan tri
 *   GET  /tai-khoan/thong-bao                      trang thong bao khach hang
 *
 * `la` cho biet chuong dang o giao dien nao (mot trinh duyet co the dang
 * nhap ca phien nhan vien lan quan tri). Server chi tra du lieu cua dung phien
 * dang co - khong tin `la` neu phien do khong ton tai.
 */
const express = require('express');
const tb = require('../services/thongBaoService');

const router = express.Router();
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Nguoi dang xem la ai, theo `la` + phien that. */
function ai(req) {
  const s = req.session || {};
  const la = String(req.query.la || req.body?.la || '');
  if (la === 'quan_tri' && s.adminlogin) return { quanTri: true };
  if (la === 'khach' && s.userlogin && s.userId) return { idKh: s.userId };
  if (la === 'nv' && s.stafflogin && s.staffId) return { idNv: s.staffId };
  if (s.stafflogin && s.staffId) return { idNv: s.staffId };
  if (s.adminlogin) return { quanTri: true };
  if (s.userlogin && s.userId) return { idKh: s.userId };
  return null;
}

router.get('/api/thong-bao', bat(async (req, res) => {
  const a = ai(req);
  if (!a) return res.status(401).json({ ok: false });
  const [chuaDoc, ds] = await Promise.all([
    tb.demChuaDoc(a),
    tb.dsCuaToi(a, { gioiHan: Math.min(50, Number(req.query.gioi_han) || 15) }),
  ]);
  res.json({ ok: true, chua_doc: chuaDoc, ds });
}));

router.post('/api/thong-bao/doc-tat-ca', bat(async (req, res) => {
  const a = ai(req);
  if (!a) return res.status(401).json({ ok: false });
  const n = await tb.danhDauTatCa(a);
  res.json({ ok: true, da_doc: n });
}));

router.post('/api/thong-bao/:id/doc', bat(async (req, res) => {
  const a = ai(req);
  if (!a) return res.status(401).json({ ok: false });
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ ok: false });
  await tb.danhDauDaDoc(a, Number(req.params.id));
  res.json({ ok: true, chua_doc: await tb.demChuaDoc(a) });
}));

async function trangDanhSach(req, a) {
  const chiChuaDoc = req.query.chua_doc === '1';
  const loai = tb.LUONG[req.query.loai] ? req.query.loai : null;
  const [ds, chuaDoc] = await Promise.all([
    tb.dsCuaToi(a, { gioiHan: 200, chiChuaDoc, loai }),
    tb.demChuaDoc(a),
  ]);
  return { ds, chuaDoc, chiChuaDoc, loai, LUONG: tb.LUONG };
}

// '/staff/notifications' la duong dan cu (bookmark, test cu) - hien thang trang moi.
router.get(['/staff/thong-bao', '/staff/notifications'], bat(async (req, res) => {
  if (!req.session.stafflogin || !req.session.staffId) return res.redirect('/staff/login');
  const d = await trangDanhSach(req, { idNv: req.session.staffId });
  res.render('staff/thong-bao', { title: 'Thông báo', activePage: 'thong-bao', ...d, goc: '/staff/thong-bao' });
}));

router.get('/staff/thong-bao/luong', bat(async (req, res) => {
  if (!req.session.stafflogin && !req.session.adminlogin) return res.redirect('/staff/login');
  res.render('staff/thong-bao-luong', { title: 'Luồng thông báo', activePage: 'thong-bao', bang: tb.bangLuong() });
}));

router.get('/admin/thong-bao', bat(async (req, res) => {
  if (!req.session.adminlogin) return res.redirect('/admin/login');
  const d = await trangDanhSach(req, { quanTri: true });
  res.render('admin/thong-bao', { title: 'Thông báo', crumb: 'Quản trị', ...d, goc: '/admin/thong-bao', bang: tb.bangLuong() });
}));

router.get('/tai-khoan/thong-bao', bat(async (req, res) => {
  if (!req.session.userlogin || !req.session.userId) return res.redirect('/login');
  const d = await trangDanhSach(req, { idKh: req.session.userId });
  res.render('thong-bao-khach', { title: 'Thông báo của tôi', ...d, goc: '/tai-khoan/thong-bao' });
}));

module.exports = router;
