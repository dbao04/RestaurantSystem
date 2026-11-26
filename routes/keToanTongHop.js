/**
 * Cac trang KE TOAN mo rong:
 *   GET  /staff/ke-toan                       dashboard ke toan
 *   GET  /staff/ke-toan/chot-so?ngay=          doi soat doanh thu ngay + chot so
 *   POST /staff/ke-toan/chot-so/ngay           ke toan chot so ngay
 *   POST /staff/ke-toan/chot-so/thang          ke toan chot so thang
 *   POST /staff/ke-toan/chot-so/:id/mo-khoa    QUAN LY mo khoa (bat buoc ly do)
 *   GET  /staff/ke-toan/dong-tien             bao cao dong tien (+ /excel)
 *   GET  /staff/ke-toan/ngan-sach             ngan sach thang + canh bao; POST luu
 */
const express = require('express');
const phanQuyenMw = require('../middleware/phanQuyen');
const phanQuyen = require('../services/phanQuyenService');
const ks = require('../services/khoaSoService');
const kt = require('../services/keToanTongHopService');
const { ngayCucBo } = require('../utils/thoiGian');

const router = express.Router();
const bat = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const canKeToan = phanQuyenMw.canVaiTroCu(['Ke toan', 'Quan ly']);

/** Quan ly that (mo khoa so). Ke toan - ke ca Ke toan truong - khong tu mo khoa. */
function laQuanLyMoKhoa(req) {
  if (req.session.adminlogin || req.session.staffRole === 'Quan ly') return true;
  return phanQuyen.dongVaiDuoc(req.hoSo, ['Quan ly']) && req.session.staffRole !== 'Ke toan';
}
const hopNgay = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : null);
const homQua = () => ks.ngayChuoi(new Date(Date.now() - 86400000));
function ve(res, duong, msg, loai = 'success') {
  res.redirect(duong + (duong.includes('?') ? '&' : '?') + 'msg=' + encodeURIComponent(msg) + '&msgType=' + loai);
}

router.get('/staff/ke-toan', canKeToan, bat(async (req, res) => {
  const d = new Date();
  const thang = Number(req.query.thang) || d.getMonth() + 1;
  const nam = Number(req.query.nam) || d.getFullYear();
  const db = await kt.dashboard(thang, nam);
  res.render('staff/ke-toan/tong-quan', { title: 'Tổng quan kế toán', activePage: 'ke-toan', db });
}));

router.get('/staff/ke-toan/chot-so', canKeToan, bat(async (req, res) => {
  const ngay = hopNgay(req.query.ngay) || homQua();
  const [ds, ky] = await Promise.all([ks.doiSoatNgay(ngay), ks.dsKy(30)]);
  res.render('staff/ke-toan/chot-so', {
    title: 'Đối soát & chốt sổ', activePage: 'ke-toan-chot-so',
    ds, ky, ngay, homNay: ngayCucBo(), laQuanLyMoKhoa: laQuanLyMoKhoa(req),
    msg: req.query.msg || null, msgType: req.query.msgType || 'success',
  });
}));

router.post('/staff/ke-toan/chot-so/ngay', canKeToan, bat(async (req, res) => {
  const ngay = hopNgay(req.body.ngay) || '';
  try {
    await ks.chotNgay(ngay, { idNv: req.session.staffId, lyDoChenhLech: req.body.ly_do_chenh_lech, ghiChu: req.body.ghi_chu });
    ve(res, '/staff/ke-toan/chot-so?ngay=' + ngay, `Đã chốt sổ ngày ${ngay}. Phiếu thu chi của ngày này không còn sửa / hủy được.`);
  } catch (e) {
    if (e.name !== 'LoiKhoaSo') throw e;
    ve(res, '/staff/ke-toan/chot-so?ngay=' + ngay, e.message, 'danger');
  }
}));

router.post('/staff/ke-toan/chot-so/thang', canKeToan, bat(async (req, res) => {
  try {
    const kq = await ks.chotThang(req.body.thang, req.body.nam, { idNv: req.session.staffId, ghiChu: req.body.ghi_chu });
    ve(res, '/staff/ke-toan/chot-so', `Đã chốt sổ tháng ${req.body.thang}/${req.body.nam} (${kq.tu} → ${kq.den}).`);
  } catch (e) {
    if (e.name !== 'LoiKhoaSo') throw e;
    ve(res, '/staff/ke-toan/chot-so', e.message, 'danger');
  }
}));

router.post('/staff/ke-toan/chot-so/:id/mo-khoa', canKeToan, bat(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).send('Không tìm thấy');
  if (!laQuanLyMoKhoa(req)) return ve(res, '/staff/ke-toan/chot-so', 'Chỉ Quản lý mới mở khóa sổ đã chốt. Kế toán không tự mở khóa.', 'danger');
  try {
    await ks.moKhoa(Number(req.params.id), { idNv: req.session.staffId, lyDo: req.body.ly_do });
    ve(res, '/staff/ke-toan/chot-so', 'Đã mở khóa sổ - mọi thao tác đã ghi nhật ký.', 'warning');
  } catch (e) {
    if (e.name !== 'LoiKhoaSo') throw e;
    ve(res, '/staff/ke-toan/chot-so', e.message, 'danger');
  }
}));

function locKy(req) {
  const hn = ngayCucBo();
  const tu = hopNgay(req.query.tu) || hn.slice(0, 8) + '01';
  const den = hopNgay(req.query.den) || hn;
  const nhom = req.query.nhom === 'thang' ? 'thang' : 'ngay';
  return { tu, den, nhom };
}

router.get('/staff/ke-toan/dong-tien', canKeToan, bat(async (req, res) => {
  const loc = locKy(req);
  let dt = null, loi = null;
  try { dt = await kt.dongTien({ tuNgay: loc.tu, denNgay: loc.den, nhom: loc.nhom }); } catch (e) { loi = e.message; }
  res.render('staff/ke-toan/dong-tien', { title: 'Báo cáo dòng tiền', activePage: 'ke-toan-dong-tien', dt, loc, loi });
}));

router.get('/staff/ke-toan/dong-tien/excel', canKeToan, bat(async (req, res) => {
  const loc = locKy(req);
  const dt = await kt.dongTien({ tuNgay: loc.tu, denNgay: loc.den, nhom: loc.nhom });
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Dòng tiền');
  const vnd = '#,##0" đ"';
  ws.addRow([`BÁO CÁO DÒNG TIỀN ${loc.tu} → ${loc.den}`]).font = { bold: true, size: 14 };
  ws.addRow([]);
  const dau = ws.addRow(['Kỳ', 'Bán hàng', 'Tiền cọc', 'Thu khác', 'Tổng vào',
    ...kt.NHOM_CHI_DS.map((k) => dt.TEN_NHOM_CHI[k]), 'Hoàn tiền', 'Tổng ra', 'Dòng tiền thuần']);
  dau.font = { bold: true };
  const dong = (ten, x) => {
    const r = ws.addRow([ten, x.vao.ban_hang, x.vao.dat_coc, x.vao.thu_khac, x.tong_vao,
      ...kt.NHOM_CHI_DS.map((k) => x.ra[k]), x.ra.hoan_tien, x.tong_ra, x.thuan]);
    for (let i = 2; i <= 13; i++) r.getCell(i).numFmt = vnd;
    return r;
  };
  dt.theo_ky.forEach((k) => dong(k.ky, k));
  dong('TỔNG', dt.tong).font = { bold: true };
  ws.columns.forEach((c, i) => { c.width = i === 0 ? 14 : 16; });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="dong-tien_${loc.tu}_${loc.den}.xlsx"`);
  res.send(Buffer.from(await wb.xlsx.writeBuffer()));
}));

router.get('/staff/ke-toan/ngan-sach', canKeToan, bat(async (req, res) => {
  const d = new Date();
  const thang = Number(req.query.thang) || d.getMonth() + 1;
  const nam = Number(req.query.nam) || d.getFullYear();
  const ns = await kt.nganSach(thang, nam);
  res.render('staff/ke-toan/ngan-sach', {
    title: 'Ngân sách & cảnh báo', activePage: 'ke-toan-ngan-sach', ns,
    msg: req.query.msg || null, msgType: req.query.msgType || 'success',
  });
}));

router.post('/staff/ke-toan/ngan-sach', canKeToan, bat(async (req, res) => {
  const { thang, nam } = req.body;
  await kt.luuNganSach(thang, nam, req.body.han_muc || {}, req.session.staffId);
  ve(res, `/staff/ke-toan/ngan-sach?thang=${thang}&nam=${nam}`, `Đã lưu ngân sách tháng ${thang}/${nam}.`);
}));

module.exports = router;
