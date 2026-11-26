/**
 * DIEU HANH TIEC (Dot 1) - /staff/tiec
 *   GET  /staff/tiec                       bang: hom nay, can xu ly, sap toi, viec cua toi
 *   GET  /staff/tiec/:id                   chi tiet: viec theo moc + nhan su tiec
 *   POST /api/staff/tiec/viec/:id          cap nhat viec (xong / co van de / mo lai)
 *   POST /api/staff/tiec/:id/nhan-su       phan cong { id_nv, vai_tro }
 *   POST /api/staff/tiec/:id/nhan-su/:ns/go
 * Quyen: Ban dieu hanh + bo phan PV, BEP, BAR, KHO, LT, TN (services/dieuHanhTiecService.nhomCua).
 */
const express = require('express');
const dv = require('../services/dieuHanhTiecService');

const router = express.Router();
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const ngu = (req) => ({ phien: req.session || {}, hoSo: req.hoSo || null, idNv: (req.session && req.session.staffId) || null });

function canVao(req, res, next) {
  const phien = req.session || {};
  const api = req.originalUrl.startsWith('/api/');
  if (!phien.stafflogin && !phien.adminlogin) return api ? res.status(401).json({ ok: false, thong_bao: 'Vui lòng đăng nhập.' }) : res.redirect('/staff/login');
  const q = dv.nhomCua(phien, req.hoSo);
  if (q.dieuHanh || q.duocVao) return next();
  const msg = 'Điều hành tiệc dành cho Quản lý và các bộ phận Phục vụ, Bếp, Bar, Kho, Lễ tân, Thu ngân.';
  if (api) return res.status(403).json({ ok: false, thong_bao: msg });
  return res.status(403).render('error', { title: 'Không có quyền truy cập', statusCode: 403, hoSo: req.hoSo || null, message: msg });
}
function traLoi(res, e) {
  if (e instanceof dv.LoiDieuHanh) return res.status(e.code || 400).json({ ok: false, thong_bao: e.message });
  console.error('[dieu-hanh-tiec]', e);
  return res.status(500).json({ ok: false, thong_bao: 'Hệ thống đang bận, vui lòng thử lại.' });
}

router.get('/staff/tiec', canVao, bat(async (req, res) => {
  const bang = await dv.bangTongHop(ngu(req));
  res.render('staff/tiec', { title: 'Điều hành tiệc', activePage: 'dieu-hanh-tiec', ...bang, NHOM_VIEC: dv.NHOM_VIEC });
}));

router.get('/staff/tiec/:id', canVao, bat(async (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) return next();
  const ct = await dv.chiTiet(Number(req.params.id), ngu(req));
  if (!ct) return res.status(404).render('error', { title: 'Không tìm thấy tiệc', statusCode: 404, hoSo: req.hoSo || null, message: 'Không tìm thấy tiệc.' });
  if (ct.khongDuocXem) return res.status(403).render('error', { title: 'Không có quyền', statusCode: 403, hoSo: req.hoSo || null, message: 'Bạn chưa được phân công vào tiệc này.' });
  const tt = await require('../services/tiecTrongTiecService').trongTiec(Number(req.params.id), ngu(req));
  const chot = await require('../services/tiecChotService').tongHop(Number(req.params.id), ngu(req));
  res.render('staff/tiec-chi-tiet', { title: `Tiệc ${ct.tiec.ma_tiec}`, activePage: 'dieu-hanh-tiec', ...ct, tt, chot });
}));

router.post('/api/staff/tiec/viec/:id', canVao, bat(async (req, res) => {
  try { res.json(await dv.capNhatViec(Number(req.params.id), req.body || {}, ngu(req))); } catch (e) { traLoi(res, e); }
}));
router.post('/api/staff/tiec/:id/nhan-su', canVao, bat(async (req, res) => {
  try { res.json(await dv.themNhanSu(Number(req.params.id), req.body || {}, ngu(req))); } catch (e) { traLoi(res, e); }
}));
router.post('/api/staff/tiec/:id/nhan-su/:ns/go', canVao, bat(async (req, res) => {
  try { res.json(await dv.goNhanSu(Number(req.params.id), Number(req.params.ns), ngu(req))); } catch (e) { traLoi(res, e); }
}));

// ---- Dot 2: trong tiec
const tt = require('../services/tiecTrongTiecService');
router.get('/api/staff/tiec/:id/phien-ban', canVao, bat(async (req, res) => {
  try { const x = await tt.trongTiec(Number(req.params.id), ngu(req)); res.json({ ok: true, v: x ? x.phienBan : 0 }); } catch (e) { traLoi(res, e); }
}));
router.post('/api/staff/tiec/dot/:id', canVao, bat(async (req, res) => {
  try { res.json(await tt.capNhatDot(Number(req.params.id), (req.body || {}).buoc, ngu(req))); } catch (e) { traLoi(res, e); }
}));
router.post('/api/staff/tiec/:id/khai', canVao, bat(async (req, res) => {
  try { res.json(await tt.khaiTiec(Number(req.params.id), (req.body || {}).hanh_dong, ngu(req))); } catch (e) { traLoi(res, e); }
}));
router.post('/api/staff/tiec/:id/phat-sinh', canVao, bat(async (req, res) => {
  try { res.json(await tt.baoPhatSinh(Number(req.params.id), req.body || {}, ngu(req))); } catch (e) { traLoi(res, e); }
}));
router.post('/api/staff/tiec/phat-sinh/:id', canVao, bat(async (req, res) => {
  try { res.json(await tt.capNhatPhatSinh(Number(req.params.id), req.body || {}, ngu(req))); } catch (e) { traLoi(res, e); }
}));

// ---- Dot 3: chot hoa don + danh gia
const tc = require('../services/tiecChotService');
router.post('/api/staff/tiec/:id/chot', canVao, bat(async (req, res) => {
  try { res.json(await tc.chot(Number(req.params.id), req.body || {}, ngu(req))); } catch (e) { traLoi(res, e); }
}));
router.post('/api/staff/tiec/:id/tinh-hoa-don', canVao, bat(async (req, res) => {
  try {
    const [[t]] = await require('../config/db').query("SELECT t.*, DATE_FORMAT(t.ngay_to_chuc, '%Y-%m-%d') ngay, TIME_FORMAT(t.gio_bat_dau,'%H:%i') gio, d.gia_ban, d.ten ten_thuc_don FROM dat_tiec t LEFT JOIN thuc_don_tiec d ON d.id = t.thuc_don_id WHERE t.id = ?", [Number(req.params.id)]);
    if (!t) return res.status(404).json({ ok: false, thong_bao: 'Không tìm thấy tiệc.' });
    res.json({ ok: true, ...(await tc.tinhHoaDon(t, (req.body || {}).giam_tru)) });
  } catch (e) { traLoi(res, e); }
}));
router.post('/api/staff/tiec/:id/danh-gia', canVao, bat(async (req, res) => {
  try { res.json(await tc.danhGia(Number(req.params.id), req.body || {}, ngu(req))); } catch (e) { traLoi(res, e); }
}));

module.exports = router;
