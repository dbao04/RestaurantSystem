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
 * Phan quyen kho theo QUYEN cua chuc danh (services/phanQuyenKho.js):
 * thu kho / nv kho nhap - xuat - kiem ke; bep chi xem + de xuat mua; quan ly
 * chot kiem ke va duyet don mua. Nguoi tao don / phieu KHONG tu duyet - tach
 * nguoi de xuat va nguoi chi tien la nguyen tac kiem soat co ban.
 */
function co(req, ma) {
  if (req.session.adminlogin) return true;
  return phanQuyen.coQuyen(req.hoSo, ma);
}
const duocDuyet = (req) => co(req, 'kho.mua.duyet');
const duocChotKiemKe = (req) => co(req, 'kho.kiem_ke.chot');
/** Middleware: can quyen `ma`, tra JSON 403 dung dinh dang cua trang kho. */
const can = (ma, viec) => (req, res, next) => (co(req, ma) ? next()
  : res.status(403).json({ ok: false, thong_bao: `Chức danh của bạn không được ${viec}. Việc này do ${NGUOI_LAM[ma] || 'người có thẩm quyền'} phụ trách.` }));
const NGUOI_LAM = {
  'kho.nhap': 'Thủ kho / Nhân viên kho',
  'kho.xuat': 'Thủ kho / Nhân viên kho',
  'kho.kiem_ke': 'Thủ kho / Nhân viên kho',
  'kho.kiem_ke.chot': 'Quản lý nhà hàng',
  'kho.mua.de_xuat': 'Quản lý bếp, Bếp trưởng, Thủ kho',
  'kho.mua.duyet': 'Quản lý nhà hàng',
  'kho.nhap.qc': 'Quản lý bếp, Bếp trưởng, Trưởng bar',
  'kho.nhap.doi_chieu': 'Kế toán',
  'kho.nhap.duyet': 'Quản lý nhà hàng',
};

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
  return {
    unread: await personnelService.countUnread(req.session.staffId).catch(() => 0), homNay: ngayCucBo(),
    // View an/hien nut theo quyen (nut bam van bi API chan neu khong du quyen).
    quyenKho: {
      nhap: co(req, 'kho.nhap'), xuat: co(req, 'kho.xuat'), kiemKe: co(req, 'kho.kiem_ke'),
      chotKiemKe: co(req, 'kho.kiem_ke.chot'), deXuatMua: co(req, 'kho.mua.de_xuat'), duyetMua: co(req, 'kho.mua.duyet'),
      qcNhap: co(req, 'kho.nhap.qc'), doiChieuNhap: co(req, 'kho.nhap.doi_chieu'), duyetNhap: co(req, 'kho.nhap.duyet'),
    },
  };
}

// Ke toan duoc XEM chi tiet phieu (doi soat cong no nha cung cap - routes/congNoNcc.js),
// khong duoc lap phieu / xuat kho / mua hang.
// Kho / mua hang: ai co quyen kho.xem (bep, bar, kho, ke toan, quan ly) moi vao;
// tung thao tac ghi kiem quyen rieng ben duoi. Thong ke bep van theo vai tro Bep.
const vaiTroPq = require('../services/phanQuyenVaiTro');
router.use('/staff/kitchen/thong-ke', vaiTroPq.canHoac((req) => vaiTroPq.laTruongBep(req.hoSo), 'Thống kê bếp dành cho Ban điều hành và trưởng bộ phận Bếp / Bar.'));
router.use(['/staff/kitchen/kho', '/staff/kitchen/mua-hang', '/api/kitchen'], phanQuyenMw.canQuyen('kho.xem'));

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

// ------------------------------------------------------------------ duyet phieu nhap
// Quy trinh: thu kho lap -> bep truong QC -> ke toan doi chieu -> quan ly duyet.
// Xem services/duyetNhapKhoService.js.
const duyetNhap = require('../services/duyetNhapKhoService');
const nguoiThaoTac = (req) => ({ id: req.session.staffId || null, laAdmin: !!req.session.adminlogin });

router.get('/staff/kitchen/kho/phieu-nhap', bat(async (req, res) => {
  const trangThai = duyetNhap.TRANG_THAI[req.query.trang_thai] ? req.query.trang_thai : '';
  const [ds, dem, ch] = await Promise.all([duyetNhap.danhSach({ trangThai }), duyetNhap.demTheoTrangThai(), duyetNhap.cauHinh()]);
  res.render('staff/kitchen/phieu-nhap-ds', {
    title: 'Duyệt phiếu nhập', activePage: 'phieu-nhap', ...(await chung(req)),
    ds, dem, ch, trangThai, TRANG_THAI: duyetNhap.TRANG_THAI, idNv: req.session.staffId || null,
  });
}));

router.get('/staff/kitchen/kho/phieu-nhap/:id', bat(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).send('Không tìm thấy phiếu');
  const ct = await duyetNhap.chiTiet(Number(req.params.id));
  if (!ct) return res.status(404).send('Không tìm thấy phiếu');
  res.render('staff/kitchen/phieu-nhap-ct', {
    title: 'Phiếu nhập ' + ct.p.ma_phieu, activePage: 'phieu-nhap', ...(await chung(req)),
    ct, KET_QUA_QC: duyetNhap.KET_QUA_QC, TRANG_THAI: duyetNhap.TRANG_THAI, idNv: req.session.staffId || null,
  });
}));

router.post('/api/kitchen/kho/nhap/:id/qc', can('kho.nhap.qc', 'kiểm tra chất lượng hàng nhập'), bat(async (req, res) => {
  try { res.json({ ok: true, ...(await duyetNhap.kiemTraChatLuong(Number(req.params.id), (req.body || {}).dong, nguoiThaoTac(req))) }); } catch (e) { traLoi(res, e); }
}));

router.post('/api/kitchen/kho/nhap/:id/doi-chieu', can('kho.nhap.doi_chieu', 'đối chiếu phiếu nhập'), bat(async (req, res) => {
  try { res.json({ ok: true, ...(await duyetNhap.doiChieu(Number(req.params.id), req.body || {}, nguoiThaoTac(req))) }); } catch (e) { traLoi(res, e); }
}));

router.post('/api/kitchen/kho/nhap/duyet-loat', can('kho.nhap.duyet', 'duyệt phiếu nhập'), bat(async (req, res) => {
  try { res.json({ ok: true, ...(await duyetNhap.duyetLoat((req.body || {}).ids, nguoiThaoTac(req))) }); } catch (e) { traLoi(res, e); }
}));

router.post('/api/kitchen/kho/nhap/:id/duyet', can('kho.nhap.duyet', 'duyệt phiếu nhập'), bat(async (req, res) => {
  try {
    const b = req.body || {};
    res.json({ ok: true, ...(await duyetNhap.duyet(Number(req.params.id), { dongY: b.dong_y !== false, ghiChu: b.ghi_chu }, nguoiThaoTac(req))) });
  } catch (e) { traLoi(res, e); }
}));

router.get('/staff/kitchen/kho/:loai/moi', bat(async (req, res, next) => {
  if (!['nhap', 'xuat'].includes(req.params.loai)) return next();
  const laNhap = req.params.loai === 'nhap';
  if (!co(req, laNhap ? 'kho.nhap' : 'kho.xuat')) {
    return res.status(403).render('error', {
      title: 'Không có quyền truy cập', statusCode: 403, hoSo: res.locals.hoSo || null,
      message: `Lập phiếu ${laNhap ? 'nhập' : 'xuất'} kho do Thủ kho / Nhân viên kho phụ trách. Bếp gửi yêu cầu cho thủ kho.`,
    });
  }
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

// ------------------------------------------------------------------ kiem ke
// Xem services/kiemKeService.js. Dat TRUOC route /kho/phieu/... va di qua
// cung bo loc quyen bep (/staff/kitchen/kho, /api/kitchen).
const kiemKe = require('../services/kiemKeService');

router.get('/staff/kitchen/kho/kiem-ke', bat(async (req, res) => {
  const { tu, den } = khoangNgay(req, 30);
  const [ds, haoHut] = await Promise.all([kiemKe.danhSach(), kiemKe.baoCaoHaoHut({ tuNgay: tu, denNgay: den })]);
  res.render('staff/kitchen/kiem-ke', {
    title: 'Kiểm kê & hao hụt', activePage: 'kiem-ke', ...(await chung(req)), ds, haoHut, tu, den,
  });
}));

router.get('/staff/kitchen/kho/kiem-ke/:id', bat(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).send('Không tìm thấy phiếu');
  const ct = await kiemKe.chiTiet(Number(req.params.id));
  if (!ct) return res.status(404).send('Không tìm thấy phiếu');
  res.render('staff/kitchen/kiem-ke-chi-tiet', {
    title: 'Phiếu kiểm kê ' + ct.ma_phieu, activePage: 'kiem-ke', ...(await chung(req)),
    ct, duocChot: duocChotKiemKe(req), duocDem: co(req, 'kho.kiem_ke'), idNv: req.session.staffId || null,
  });
}));

router.post('/api/kitchen/kiem-ke', can('kho.kiem_ke', 'lập phiếu kiểm kê'), bat(async (req, res) => {
  try { res.status(201).json({ ok: true, ...(await kiemKe.taoPhieu({ ghiChu: (req.body || {}).ghi_chu }, req.session.staffId || null)) }); } catch (e) { traLoi(res, e); }
}));

router.post('/api/kitchen/kiem-ke/:id/dem', can('kho.kiem_ke', 'nhập số đếm kiểm kê'), bat(async (req, res) => {
  try { res.json({ ok: true, ...(await kiemKe.luuSoDem(Number(req.params.id), (req.body || {}).dong)) }); } catch (e) { traLoi(res, e); }
}));

router.post('/api/kitchen/kiem-ke/:id/chot', can('kho.kiem_ke.chot', 'chốt kiểm kê'), bat(async (req, res) => {
  try {
    const laQuanLy = !!(req.session.adminlogin || req.session.staffRole === 'Quan ly');
    res.json({ ok: true, ...(await kiemKe.chot(Number(req.params.id), { id: req.session.staffId || null, laQuanLy })) });
  } catch (e) { traLoi(res, e); }
}));

router.post('/api/kitchen/kiem-ke/:id/huy', can('kho.kiem_ke', 'hủy phiếu kiểm kê'), bat(async (req, res) => {
  try { res.json(await kiemKe.huy(Number(req.params.id))); } catch (e) { traLoi(res, e); }
}));

router.get('/staff/kitchen/kho/phieu/:loai/:id', bat(async (req, res) => {
  if (!['nhap', 'xuat'].includes(req.params.loai) || !/^\d+$/.test(req.params.id)) return res.status(404).send('Không tìm thấy phiếu');
  const ct = await kho.chiTietPhieu(req.params.loai, Number(req.params.id));
  if (!ct) return res.status(404).send('Không tìm thấy phiếu');
  res.render('staff/kitchen/kho-phieu-in', { ct });
}));

router.post('/api/kitchen/kho/nhap', can('kho.nhap', 'lập phiếu nhập kho'), bat(async (req, res) => {
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

router.post('/api/kitchen/kho/xuat', can('kho.xuat', 'lập phiếu xuất kho'), bat(async (req, res) => {
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

// Tao don mua NHAP tu goi y theo du bao, gom theo nha cung cap (khoBepService.taoDonTuDong).
router.post('/api/kitchen/mua-hang/tu-dong', can('kho.mua.de_xuat', 'lập đơn mua'), bat(async (req, res) => {
  try { res.status(201).json({ ok: true, ...(await kho.taoDonTuDong(req.session.staffId || null)) }); } catch (e) { traLoi(res, e); }
}));

router.post('/api/kitchen/mua-hang', can('kho.mua.de_xuat', 'lập đơn mua'), bat(async (req, res) => {
  try { res.status(201).json({ ok: true, ...(await kho.taoDonMua(req.body, req.session.staffId || null)) }); } catch (e) { traLoi(res, e); }
}));

router.post('/api/kitchen/mua-hang/:id/:buoc', bat(async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ ok: false, thong_bao: 'Không tìm thấy đơn' });
    const buoc = req.params.buoc;
    if (buoc !== 'duyet' && !co(req, 'kho.mua.de_xuat')) {
      return res.status(403).json({ ok: false, thong_bao: 'Chức danh của bạn không được cập nhật đơn mua. Việc này do Quản lý bếp, Bếp trưởng, Thủ kho phụ trách.' });
    }
    if (buoc === 'duyet') {
      if (!duocDuyet(req)) return res.status(403).json({ ok: false, thong_bao: 'Chỉ quản lý nhà hàng được duyệt đơn mua nguyên liệu.' });
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
