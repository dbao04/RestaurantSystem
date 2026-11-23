/**
 * RA SOAT PHAN QUYEN THEO VAI TRO - moi chuc danh chi thay va lam viec cua minh.
 *
 * VAN DE: cac route cu kiem `requireRole(['... ', 'Quan ly'])` va menu kiem
 * `dongVaiDuoc(['Quan ly'])`. Bon chuc danh KHONG phai quan ly nha hang lai khai
 * vai tro tuong duong 'Quan ly' nen vao duoc MOI trang quan ly (khuyen mai, so do
 * to chuc, xep ca, ke toan, le tan, bep...):
 *   GSPV Giam sat phuc vu, GSTN Giam sat thu ngan, QLBEP Quan ly bep, KTTRUONG Ke toan truong.
 * Tai khoan quanlybep con mang han chucvu cu 'Quan ly'.
 *
 * SUA: 'Quan ly' chi con Ban dieu hanh (QLNH, TLQL - chucvu cu 'Quan ly'). Viec
 * giam sat that su can (duyet chot ca, hoan tien, duyet bao cao phuc vu, xoa mon
 * da nau) cap rieng qua `laGiamSat(hoSo, boPhan)` - xem cac route lien quan.
 *
 * Chay MOT LAN (moc cau_hinh) - sau do quan tri sua o trang To chuc khong bi ghi de.
 */
const db = require('../config/db');

const MOC = 'phan_quyen.vai_tro_v1';

const VAI_TRO_MOI = {
  GSPV: { vt: 'Phuc vu,Nhan vien chung' },
  GSTN: { vt: 'Thu ngan,Nhan vien chung' },
  QLBEP: { vt: 'Bep,Nhan vien chung', legacy: 'Bep' },
  KTTRUONG: { vt: 'Ke toan,Nhan vien chung' },
};
// Quyen giao hang khong lien quan toi phuc vu ban.
const BO_QUYEN = { GSPV: ['giao_hang.xem', 'giao_hang.theo_doi'] };

async function damBao({ batBuoc = false } = {}) {
  const [[moc]] = await db.query('SELECT gia_tri FROM cau_hinh WHERE khoa = ?', [MOC]);
  if (moc && !batBuoc) return false;
  for (const [ma, v] of Object.entries(VAI_TRO_MOI)) {
    await db.query(
      `UPDATE chuc_danh SET vai_tro_tuong_duong = ?${v.legacy ? ', chucvu_legacy = ?' : ''} WHERE ma_cd = ?`,
      v.legacy ? [v.vt, v.legacy, ma] : [v.vt, ma]);
    if (v.legacy) {
      await db.query(
        `UPDATE nhan_vien n JOIN chuc_danh cd ON cd.id_cd = n.id_cd SET n.chucvu = ?
          WHERE cd.ma_cd = ? AND n.chucvu = 'Quan ly'`, [v.legacy, ma]);
    }
  }
  for (const [ma, ds] of Object.entries(BO_QUYEN)) {
    await db.query(
      `DELETE x FROM chuc_danh_quyen x JOIN chuc_danh cd ON cd.id_cd = x.id_cd JOIN quyen q ON q.id_q = x.id_q
        WHERE cd.ma_cd = ? AND q.ma_q IN (?)`, [ma, ds]);
  }
  await db.query(
    `INSERT INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES (?, '1', 'Đã rà soát vai trò: chỉ Ban điều hành đóng vai Quản lý')
     ON DUPLICATE KEY UPDATE gia_tri = '1'`, [MOC]);
  return true;
}

/** Ban dieu hanh: Quan ly nha hang, Tro ly quan ly (chucvu cu 'Quan ly' / bo phan DH) hoac admin. */
function laDieuHanh(phien = {}, hoSo = null) {
  return !!(phien.adminlogin || phien.staffRole === 'Quan ly' || (hoSo && hoSo.ma_bp === 'DH'));
}

/** Giam sat (cap <= 3) cua bo phan `maBp` ('PV' | 'TN' ...). */
function laGiamSat(hoSo, maBp) {
  return !!(hoSo && hoSo.ma_bp === maBp && Number(hoSo.cap_bac) <= 3);
}

/** Truong bo phan bep / bar (QL bep, bep truong/pho, to truong bep, truong bar: cap <= 4). */
function laTruongBep(hoSo) {
  return !!(hoSo && ['BEP', 'BAR'].includes(hoSo.ma_bp) && Number(hoSo.cap_bac) <= 4);
}

/** Middleware: Ban dieu hanh hoac dieu kien `dk(req)`; khong thi trang 403 kem `thongDiep`. */
function canHoac(dk, thongDiep) {
  return (req, res, next) => {
    const phien = req.session || {};
    if (!phien.stafflogin && !phien.adminlogin) return res.redirect('/staff/login');
    if (laDieuHanh(phien, req.hoSo) || dk(req)) return next();
    const json = req.xhr || (req.headers.accept || '').includes('json') || req.path.includes('/api/');
    if (json) return res.status(403).json({ ok: false, loi: thongDiep, thong_bao: thongDiep });
    return res.status(403).render('error', { title: 'Không có quyền truy cập', statusCode: 403, hoSo: res.locals.hoSo || null, message: thongDiep });
  };
}

/**
 * Lan 2 (moc rieng): tap vu bep khong can xem kho; quyen bang dieu hanh giu cho
 * truong bo phan (viec can xu ly cua bo phan minh).
 */
const MOC2 = 'phan_quyen.vai_tro_v2';
async function damBaoLan2({ batBuoc = false } = {}) {
  const [[moc]] = await db.query('SELECT gia_tri FROM cau_hinh WHERE khoa = ?', [MOC2]);
  if (moc && !batBuoc) return false;
  await db.query(
    `DELETE x FROM chuc_danh_quyen x JOIN chuc_danh cd ON cd.id_cd = x.id_cd JOIN quyen q ON q.id_q = x.id_q
      WHERE cd.ma_cd = 'TAPVUBEP' AND q.ma_q LIKE 'kho.%'`);
  await db.query(
    `INSERT INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES (?, '1', 'Rà soát vai trò lần 2: tạp vụ bếp bỏ quyền kho')
     ON DUPLICATE KEY UPDATE gia_tri = '1'`, [MOC2]);
  return true;
}

module.exports = { damBao, damBaoLan2, laDieuHanh, laGiamSat, laTruongBep, canHoac, VAI_TRO_MOI };
