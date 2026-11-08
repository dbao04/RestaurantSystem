/**
 * KHU BEP: thong ke, xuat nhap kho, mua hang NVL.
 *
 *   GET  /staff/kitchen/thong-ke                 thong ke bep
 *   GET  /staff/kitchen/kho                      so xuat nhap + lo hang & han dung
 *   GET  /staff/kitchen/kho/nhap/moi[?don=ID]    lap phieu nhap (tu don mua: nhan hang)
 *   GET  /staff/kitchen/kho/xuat/moi[?nl=&ly_do=] lap phieu xuat
 *   GET  /staff/kitchen/kho/phieu/:loai/:id      xem / in phieu
 *   GET  /staff/kitchen/mua-hang                 don mua + goi y mua
 *   GET  /staff/kitchen/mua-hang/:id             chi tiet / in don mua
 *   POST /api/kitchen/kho/nhap | /xuat
 *   POST /api/kitchen/mua-hang                   tao don
 *   POST /api/kitchen/mua-hang/:id/:buoc         duyet | dat_hang | huy
 */
const express = require('express');
const kho = require('../services/khoBepService');
const tk = require('../services/thongKeBepService');
const phanQuyenMw = require('../middleware/phanQuyen');
const phanQuyen = require('../services/phanQuyenService');
const { ngayCucBo } = require('../utils/thoiGian');

const router = express.Router();
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const canBep = phanQuyenMw.canVaiTroCu(['Bep', 'Quan ly']);

/**
 * Duyet don mua: bep truong / quan ly bep (cap 1-2 thuoc bep), quan ly nha hang,
 * admin. Nguoi tao don KHONG tu duyet don cua minh - tach nguoi de xuat va nguoi
 * chi tien la nguyen tac kiem soat co ban.
 */
function duocDuyet(req) {
  if (req.session.adminlogin) return true;
  if (req.session.staffRole === 'Quan ly') return true;
  const h = req.hoSo;
  return !!(h && h.cap_bac <= 2 && phanQuyen.dongVaiDuoc(h, ['Bep', 'Quan ly']));
}

function traLoi(res, e) {
  if (e && e.name === 'LoiKho') {
    return res.status(e.ma === 'NOT_FOUND' ? 404 : e.ma === 'FORBIDDEN' ? 403 : 400).json({ ok: false, thong_bao: e.message });
  }
  console.error('[kho-bep]', e);
  return res.status(500).json({ ok: false, thong_bao: 'Hệ thống đang bận, vui lòng thử lại.' });
}

const hopLeNgay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
function khoangNgay(req, macDinhNgay = 30) {
  const den = hopLeNgay(req.query.den) ? req.query.den : ngayCucBo();
  let tu = req.query.tu;
  if (!hopLeNgay(tu)) {
    const d = new Date(`${den}T00:00:00`); d.setDate(d.getDate() - macDinhNgay + 1);
    tu = ngayCucBo(d);
  }
  if (tu > den) [tu] = [den];
  return { tu, den };
}

async function chung(req) {
  const personnelService = require('../services/personnelService');
  return { unread: await personnelService.countUnread(req.session.staffId).catch(() => 0), homNay: ngayCucBo() };
}

// Ke toan duoc XEM chi tiet phieu (doi soat cong no nha cung cap - routes/congNoNcc.js),
// khong duoc lap phieu / xuat kho / mua hang.
const canXemPhieu = phanQuyenMw.canVaiTroCu(['Bep', 'Quan ly', 'Ke toan']);
router.use(['/staff/kitchen/thong-ke', '/staff/kitchen/kho', '/staff/kitchen/mua-hang', '/api/kitchen'], (req, res, next) => {
  const laXemPhieu = req.method === 'GET' && req.originalUrl.split('?')[0].startsWith('/staff/kitchen/kho/phieu/');
  return (laXemPhieu ? canXemPhieu : canBep)(req, res, next);
});

// ------------------------------------------------------------------ thong ke
router.get('/staff/kitchen/thong-ke', bat(async (req, res) => {
  const { tu, den } = khoangNgay(req, 30);
  const soNgay = (new Date(`${den}T00:00:00`) - new Date(`${tu}T00:00:00`)) / 86400000;
  let bc = null; let loi = null;
  if (soNgay > 370) loi = 'Chỉ xem tối đa 12 tháng mỗi lần.';
  else bc = await tk.thongKe({ tuNgay: tu, denNgay: den });
  // Khoang dang xem gan nhu khong co ban hang -> goi y 30 ngay co du lieu gan nhat.
  let goiYKhoang = null;
  if (bc && bc.tong.so_mon < 50) {
    const cuoi = await tk.ngayCoDuLieuGanNhat();
    if (cuoi && cuoi < tu) {
      const d = new Date(`${cuoi}T00:00:00`); d.setDate(d.getDate() - 29);
      goiYKhoang = { tu: ngayCucBo(d), den: cuoi };
    }
  }
  res.render('staff/kitchen/thong-ke', { title: 'Thống kê bếp', activePage: 'thong-ke-bep', ...(await chung(req)), tu, den, bc, loi, goiYKhoang });
}));

// ------------------------------------------------------------------ kho
router.get('/staff/kitchen/kho', bat(async (req, res) => {
  const { tu, den } = khoangNgay(req, 30);
  const loai = ['nhap', 'xuat'].includes(req.query.loai) ? req.query.loai : '';
  const lyDo = kho.LY_DO_XUAT[req.query.ly_do] ? req.query.ly_do : '';
  const [soKho, lo, nvl] = await Promise.all([
    kho.soKho({ tuNgay: tu, denNgay: den, loai, lyDo }),
    kho.loHang({}),
    kho.danhSachNVL(),
  ]);
  res.render('staff/kitchen/kho', {
    title: 'Xuất nhập kho', activePage: 'kho-bep', ...(await chung(req)),
    tu, den, loai, lyDo, soKho, lo, nvl, lyDoXuat: kho.LY_DO_XUAT, tab: req.query.tab === 'lo' ? 'lo' : 'so',
  });
}));

router.get('/staff/kitchen/kho/:loai/moi', bat(async (req, res, next) => {
  if (!['nhap', 'xuat'].includes(req.params.loai)) return next();
  const laNhap = req.params.loai === 'nhap';
  const [nvl, ncc] = await Promise.all([kho.danhSachNVL(), kho.danhSachNCC()]);
  let don = null;
  if (laNhap && /^\d+$/.test(String(req.query.don || ''))) {
    don = await kho.chiTietDon(Number(req.query.don));
    if (don && !['da_dat', 'da_duyet', 'nhan_mot_phan'].includes(don.trang_thai)) don = null;
  }
  res.render('staff/kitchen/kho-lap-phieu', {
    title: laNhap ? 'Lập phiếu nhập kho' : 'Lập phiếu xuất kho', activePage: 'kho-bep', ...(await chung(req)),
    laNhap, nvl, ncc, don, lyDoXuat: kho.LY_DO_XUAT,
    chon: { nl: Number(req.query.nl) || null, ly_do: kho.LY_DO_XUAT[req.query.ly_do] ? req.query.ly_do : '', sl: Number(req.query.sl) || '' },
  });
}));

router.get('/staff/kitchen/kho/phieu/:loai/:id', bat(async (req, res) => {
  if (!['nhap', 'xuat'].includes(req.params.loai) || !/^\d+$/.test(req.params.id)) return res.status(404).send('Không tìm thấy phiếu');
  const ct = await kho.chiTietPhieu(req.params.loai, Number(req.params.id));
  if (!ct) return res.status(404).send('Không tìm thấy phiếu');
  res.render('staff/kitchen/kho-phieu-in', { ct });
}));

router.post('/api/kitchen/kho/nhap', bat(async (req, res) => {
  try {
    if (req.body.id_dmh) {
      // Nhan hang tu don: don phai da duyet / da dat.
      const don = await kho.chiTietDon(Number(req.body.id_dmh));
      if (!don || !['da_duyet', 'da_dat', 'nhan_mot_phan'].includes(don.trang_thai)) {
        return res.status(400).json({ ok: false, thong_bao: 'Đơn mua chưa được duyệt hoặc đã nhận đủ.' });
      }
      if (!req.body.id_ncc) req.body.id_ncc = don.id_ncc;
    }
    res.status(201).json({ ok: true, ...(await kho.taoPhieuNhap(req.body, req.session.staffId || null)) });
  } catch (e) { traLoi(res, e); }
}));

router.post('/api/kitchen/kho/xuat', bat(async (req, res) => {
  try { res.status(201).json({ ok: true, ...(await kho.taoPhieuXuat(req.body, req.session.staffId || null)) }); } catch (e) { traLoi(res, e); }
}));

// ------------------------------------------------------------------ mua hang
router.get('/staff/kitchen/mua-hang', bat(async (req, res) => {
  const trangThai = kho.TRANG_THAI_DON[req.query.trang_thai] ? req.query.trang_thai : '';
  const [don, goiY, nvl, ncc] = await Promise.all([kho.danhSachDon({ trangThai }), kho.goiYMuaHang(), kho.danhSachNVL(), kho.danhSachNCC()]);
  res.render('staff/kitchen/mua-hang', {
    title: 'Mua hàng nguyên liệu', activePage: 'mua-hang', ...(await chung(req)),
    don, goiY, nvl, ncc, trangThai, tenTrangThai: kho.TRANG_THAI_DON, duocDuyet: duocDuyet(req),
  });
}));

router.get('/staff/kitchen/mua-hang/:id', bat(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).send('Không tìm thấy đơn');
  const don = await kho.chiTietDon(Number(req.params.id));
  if (!don) return res.status(404).send('Không tìm thấy đơn');
  res.render('staff/kitchen/mua-hang-chi-tiet', {
    title: `Đơn mua ${don.ma_don}`, activePage: 'mua-hang', ...(await chung(req)),
    don, duocDuyet: duocDuyet(req), idNv: req.session.staffId || null,
  });
}));

router.post('/api/kitchen/mua-hang', bat(async (req, res) => {
  try { res.status(201).json({ ok: true, ...(await kho.taoDonMua(req.body, req.session.staffId || null)) }); } catch (e) { traLoi(res, e); }
}));

router.post('/api/kitchen/mua-hang/:id/:buoc', bat(async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ ok: false, thong_bao: 'Không tìm thấy đơn' });
    const buoc = req.params.buoc;
    if (buoc === 'duyet') {
      if (!duocDuyet(req)) return res.status(403).json({ ok: false, thong_bao: 'Chỉ bếp trưởng, quản lý bếp hoặc quản lý nhà hàng được duyệt đơn mua.' });
      const don = await kho.chiTietDon(Number(req.params.id));
      if (don && req.session.staffId && Number(don.id_nv_tao) === Number(req.session.staffId) && req.session.staffRole !== 'Quan ly') {
        return res.status(403).json({ ok: false, thong_bao: 'Không tự duyệt đơn do chính mình lập – nhờ một người duyệt khác.' });
      }
    }
    await kho.doiTrangThaiDon(Number(req.params.id), buoc, { idNv: req.session.staffId || null, lyDo: req.body.ly_do });
    res.json({ ok: true });
  } catch (e) { traLoi(res, e); }
}));

module.exports = router;
