/**
 * DICH VU THONG BAO TRUNG TAM - moi nghiep vu goi `gui(loai, ...)`.
 *
 * TRUOC DAY: bang thong_bao gan nhu khong ai ghi; vai cho chi day realtime (mat
 * khi nguoi nhan khong mo trang); thong bao "cho tat ca" dung CHUNG mot co da_doc
 * nen mot nguoi doc la ca nha hang thanh "da doc".
 *
 * BAY GIO:
 *   - MOI nguoi nhan mot dong rieng (doc / chua doc rieng).
 *   - Ba loai nguoi nhan: nhan vien (id_nv), quan tri (doi_tuong = 'quan_tri'),
 *     khach hang (doi_tuong = 'khach', id_kh).
 *   - Nguoi nhan xac dinh theo CHUC DANH / BO PHAN cua co cau to chuc (ma_cd,
 *     ma_bp) - doi nguoi giu chuc danh khong phai sua code.
 *   - Kem `link` toi dung trang xu ly va `muc_do` (tin / quan_trong / khan).
 *   - Day realtime 'thong-bao:moi' -> chuong tren moi giao dien tang so ngay.
 *   - Loi thong bao KHONG bao gio lam hong nghiep vu goi no (nuot loi, ghi log).
 *
 * LUONG (danh muc ben duoi) la ban thiet ke: su kien nao -> ai nhan. Trang
 * /staff/thong-bao/luong hien bang nay.
 */
const db = require('../config/db');

// ------------------------------------------------------------- nhom nguoi nhan
/** Nhom nguoi nhan theo co cau to chuc (ma chuc danh / ma bo phan). */
const NHOM = {
  QUAN_LY:      { cd: ['QLNH', 'TLQL'] },
  GIAM_SAT_PV:  { cd: ['GSPV'] },
  GIAM_SAT_TN:  { cd: ['GSTN'] },
  TO_TRUONG_PV: { cd: ['TOTRUONGPV'] },
  PHUC_VU:      { bp: ['PV'] },
  THU_NGAN:     { bp: ['TN'] },
  LE_TAN:       { bp: ['LT'] },
  TRUONG_LE_TAN: { cd: ['TRUONGLT'] },
  BEP_QUAN_LY:  { cd: ['QLBEP', 'BEPTRUONG', 'BEPPHO'] },
  BEP:          { bp: ['BEP'] },
  BAR:          { bp: ['BAR'] },
  KHO:          { cd: ['THUKHO', 'NVKHO'] },
  THU_KHO:      { cd: ['THUKHO'] },
  KE_TOAN:      { cd: ['KTTRUONG', 'NVKT'] },
  KE_TOAN_TRUONG: { cd: ['KTTRUONG'] },
  DIEU_PHOI:    { cd: ['DPGH'] },
  SHIPPER:      { cd: ['SHIPPER'] },
};
const TEN_NHOM = {
  QUAN_LY: 'Quản lý nhà hàng, Trợ lý quản lý', GIAM_SAT_PV: 'Giám sát phục vụ', GIAM_SAT_TN: 'Giám sát thu ngân',
  TO_TRUONG_PV: 'Tổ trưởng phục vụ', PHUC_VU: 'Bộ phận Phục vụ', THU_NGAN: 'Bộ phận Thu ngân', LE_TAN: 'Bộ phận Lễ tân',
  TRUONG_LE_TAN: 'Trưởng lễ tân', BEP_QUAN_LY: 'Quản lý bếp, Bếp trưởng, Bếp phó', BEP: 'Bộ phận Bếp', BAR: 'Bộ phận Bar',
  KHO: 'Thủ kho, Nhân viên kho', THU_KHO: 'Thủ kho', KE_TOAN: 'Kế toán trưởng, Kế toán viên', KE_TOAN_TRUONG: 'Kế toán trưởng',
  DIEU_PHOI: 'Điều phối giao hàng', SHIPPER: 'Nhân viên giao hàng',
};

/**
 * DANH MUC LUONG THONG BAO. moi loai: nhom chuc nang, ten, nguoi nhan mac dinh
 * (ten nhom trong NHOM; 'NGUOI_LIEN_QUAN' = nguoi cu the do nghiep vu truyen vao:
 * nguoi lap, nguoi gui, nhan vien duoc phan...), quan_tri: co gui quan tri vien
 * khong, muc_do mac dinh.
 */
const LUONG = {
  // ---- Ban hang & bep
  huy_mon:            { nhom: 'Bán hàng & bếp', ten: 'Xóa món đã order (kèm giải trình)', nhan: ['QUAN_LY', 'GIAM_SAT_PV', 'GIAM_SAT_TN'], quan_tri: true, muc_do: 'khan' },
  mon_tam_ngung:      { nhom: 'Bán hàng & bếp', ten: 'Món tạm ngưng / bán lại', nhan: ['PHUC_VU', 'THU_NGAN', 'LE_TAN'], muc_do: 'quan_trong' },
  // ---- Van hanh tai ban (phuc vu): ai can biet ngay de lam viec
  mon_xong:           { nhom: 'Vận hành tại bàn', ten: 'Bếp làm xong món - mang ra bàn', nhan: ['PHUC_VU_BAN'], muc_do: 'khan' },
  goi_mon_qr:         { nhom: 'Vận hành tại bàn', ten: 'Khách tự gọi món qua QR tại bàn', nhan: ['PHUC_VU_BAN'], muc_do: 'quan_trong' },
  mon_tre:            { nhom: 'Vận hành tại bàn', ten: 'Món chờ quá lâu chưa ra (quá thời gian chuẩn)', nhan: ['BEP_QUAN_LY', 'GIAM_SAT_PV'], muc_do: 'quan_trong' },
  khach_tu_thanh_toan:{ nhom: 'Vận hành tại bàn', ten: 'Khách tự chuyển khoản trả đủ hóa đơn', nhan: ['THU_NGAN', 'PHUC_VU_BAN'], muc_do: 'tin' },
  ban_can_don:        { nhom: 'Vận hành tại bàn', ten: 'Bàn đã thanh toán xong - cần dọn bàn', nhan: ['PHUC_VU_BAN'], muc_do: 'tin' },
  dat_ban_sap_den:    { nhom: 'Vận hành tại bàn', ten: 'Khách đặt bàn sắp đến (trước 15 phút)', nhan: ['LE_TAN', 'PHUC_VU_CA'], muc_do: 'quan_trong' },
  // ---- Dat ban & tiec
  dat_ban_moi:        { nhom: 'Đặt bàn & tiệc', ten: 'Khách đặt bàn online mới', nhan: ['LE_TAN'], muc_do: 'quan_trong' },
  dat_ban_huy:        { nhom: 'Đặt bàn & tiệc', ten: 'Khách hủy đặt bàn', nhan: ['LE_TAN'], muc_do: 'tin' },
  dat_ban_khach:      { nhom: 'Đặt bàn & tiệc', ten: 'Đặt bàn của khách được xác nhận / đổi trạng thái', nhan: ['KHACH'], muc_do: 'tin' },
  dat_tiec_moi:       { nhom: 'Đặt bàn & tiệc', ten: 'Yêu cầu đặt tiệc mới', nhan: ['TRUONG_LE_TAN', 'LE_TAN', 'QUAN_LY'], muc_do: 'quan_trong' },
  dat_tiec_chot:      { nhom: 'Đặt bàn & tiệc', ten: 'Tiệc đã xác nhận / đặt cọc (chuẩn bị nguyên liệu)', nhan: ['BEP_QUAN_LY', 'QUAN_LY'], muc_do: 'quan_trong' },
  dat_tiec_khach:     { nhom: 'Đặt bàn & tiệc', ten: 'Tiệc của khách đổi trạng thái', nhan: ['KHACH'], muc_do: 'tin' },
  // ---- Giao hang
  don_giao_moi:       { nhom: 'Giao hàng', ten: 'Đơn giao hàng chờ phân shipper', nhan: ['DIEU_PHOI'], muc_do: 'quan_trong' },
  don_giao_phan:      { nhom: 'Giao hàng', ten: 'Shipper được phân đơn', nhan: ['NGUOI_LIEN_QUAN'], muc_do: 'khan' },
  don_giao_nhan:      { nhom: 'Giao hàng', ten: 'Shipper nhận đơn / đang đến lấy hàng', nhan: ['DIEU_PHOI'], muc_do: 'tin' },
  don_giao_bep_xong:  { nhom: 'Giao hàng', ten: 'Bếp làm xong đơn giao - shipper đến lấy', nhan: ['SHIPPER_DON', 'DIEU_PHOI'], muc_do: 'khan' },
  don_giao_hoan_thanh:{ nhom: 'Giao hàng', ten: 'Giao hàng thành công (kèm tiền thu hộ phải nộp)', nhan: ['DIEU_PHOI', 'THU_NGAN_THU_HO'], muc_do: 'tin' },
  don_giao_huy:       { nhom: 'Giao hàng', ten: 'Đơn giao bị hủy', nhan: ['SHIPPER_DON', 'DIEU_PHOI', 'BEP_QUAN_LY'], muc_do: 'khan' },
  don_giao_su_co:     { nhom: 'Giao hàng', ten: 'Giao thất bại / shipper từ chối đơn', nhan: ['DIEU_PHOI'], muc_do: 'khan' },
  don_giao_khach:     { nhom: 'Giao hàng', ten: 'Đơn giao của khách: đang giao / đã giao', nhan: ['KHACH'], muc_do: 'tin' },
  thu_ho_da_nop:      { nhom: 'Giao hàng', ten: 'Shipper đã nộp tiền thu hộ', nhan: ['NGUOI_LIEN_QUAN', 'KE_TOAN'], muc_do: 'tin' },
  // ---- Thanh toan & quy
  hoan_tien:          { nhom: 'Thanh toán & quỹ', ten: 'Hoàn tiền cho khách', nhan: ['KE_TOAN', 'QUAN_LY'], quan_tri: true, muc_do: 'quan_trong' },
  ngan_hang_lech:     { nhom: 'Thanh toán & quỹ', ten: 'Chuyển khoản vào không khớp hóa đơn', nhan: ['GIAM_SAT_TN', 'THU_NGAN', 'KE_TOAN'], muc_do: 'quan_trong' },
  chot_ca_moi:        { nhom: 'Thanh toán & quỹ', ten: 'Biên bản chốt ca chờ duyệt (kèm chênh lệch nếu có)', nhan: ['GIAM_SAT_TN', 'KE_TOAN'], muc_do: 'tin' },
  chot_ca_duyet:      { nhom: 'Thanh toán & quỹ', ten: 'Biên bản chốt ca của bạn đã được duyệt', nhan: ['NGUOI_LIEN_QUAN'], muc_do: 'tin' },
  phieu_chi_cho_duyet:{ nhom: 'Thanh toán & quỹ', ten: 'Phiếu chi vượt hạn mức chờ duyệt', nhan: ['QUAN_LY'], quan_tri: true, muc_do: 'quan_trong' },
  phieu_chi_ket_qua:  { nhom: 'Thanh toán & quỹ', ten: 'Phiếu chi của bạn được duyệt / bị hủy', nhan: ['NGUOI_LIEN_QUAN'], muc_do: 'tin' },
  khoa_so:            { nhom: 'Thanh toán & quỹ', ten: 'Mở khóa sổ đã chốt', nhan: ['KE_TOAN', 'QUAN_LY'], quan_tri: true, muc_do: 'khan' },
  // ---- Luong & nhan su
  luong_cho_duyet:    { nhom: 'Lương & nhân sự', ten: 'Bảng lương chờ duyệt', nhan: ['QUAN_LY'], quan_tri: true, muc_do: 'quan_trong' },
  luong_ket_qua:      { nhom: 'Lương & nhân sự', ten: 'Bảng lương được duyệt / bị trả về', nhan: ['NGUOI_LIEN_QUAN', 'KE_TOAN'], muc_do: 'quan_trong' },
  luong_da_chi:       { nhom: 'Lương & nhân sự', ten: 'Lương tháng của bạn đã được chi', nhan: ['NGUOI_LIEN_QUAN'], muc_do: 'tin' },
  nghi_phep_moi:      { nhom: 'Lương & nhân sự', ten: 'Đơn xin nghỉ phép chờ duyệt', nhan: ['NGUOI_LIEN_QUAN'], muc_do: 'quan_trong' },
  nghi_phep_ket_qua:  { nhom: 'Lương & nhân sự', ten: 'Đơn nghỉ phép được duyệt / từ chối', nhan: ['NGUOI_LIEN_QUAN'], muc_do: 'tin' },
  // ---- Kho & mua hang
  don_mua_cho_duyet:  { nhom: 'Kho & mua hàng', ten: 'Đơn mua hàng chờ duyệt', nhan: ['QUAN_LY', 'BEP_QUAN_LY'], muc_do: 'quan_trong' },
  don_mua_ket_qua:    { nhom: 'Kho & mua hàng', ten: 'Đơn mua hàng được duyệt / hủy', nhan: ['NGUOI_LIEN_QUAN', 'THU_KHO'], muc_do: 'tin' },
  ton_kho_thap:       { nhom: 'Kho & mua hàng', ten: 'Nguyên liệu xuống dưới định mức', nhan: ['BEP_QUAN_LY', 'THU_KHO'], muc_do: 'quan_trong' },
  kiem_ke_cho_chot:   { nhom: 'Kho & mua hàng', ten: 'Phiếu kiểm kê chờ chốt', nhan: ['BEP_QUAN_LY'], muc_do: 'tin' },
  cong_no_qua_han:    { nhom: 'Kho & mua hàng', ten: 'Công nợ nhà cung cấp đến hạn / quá hạn', nhan: ['KE_TOAN'], muc_do: 'quan_trong' },
  // ---- Chung
  thong_bao_chung:    { nhom: 'Chung', ten: 'Thông báo do quản lý gửi', nhan: ['NGUOI_LIEN_QUAN'], muc_do: 'tin' },
};

class LoiThongBao extends Error {}

let daDamBao = false;
async function damBaoCot() {
  if (daDamBao) return;
  const [cot] = await db.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thong_bao'");
  const co = new Set(cot.map((c) => c.COLUMN_NAME));
  const them = [
    ['doi_tuong', "ENUM('nv','quan_tri','khach') NOT NULL DEFAULT 'nv'"],
    ['id_kh', 'INT NULL'],
    ['loai', 'VARCHAR(40) NULL'],
    ['link', 'VARCHAR(300) NULL'],
    ['muc_do', "VARCHAR(12) NOT NULL DEFAULT 'tin'"],
    ['nguoi_gui', 'VARCHAR(150) NULL'],
  ];
  for (const [ten, kieu] of them) if (!co.has(ten)) await db.query(`ALTER TABLE thong_bao ADD COLUMN ${ten} ${kieu}`);
  const [idx] = await db.query("SHOW INDEX FROM thong_bao WHERE Key_name IN ('idx_tb_nhan','idx_tb_khach')");
  const coIdx = new Set(idx.map((i) => i.Key_name));
  if (!coIdx.has('idx_tb_nhan')) await db.query('ALTER TABLE thong_bao ADD INDEX idx_tb_nhan (doi_tuong, id_nv, da_doc)');
  if (!coIdx.has('idx_tb_khach')) await db.query('ALTER TABLE thong_bao ADD INDEX idx_tb_khach (doi_tuong, id_kh, da_doc)');
  daDamBao = true;
}

/** Nhan vien dang lam thuoc cac nhom / chuc danh / bo phan. */
async function idNhanVien({ nhom = [], cd = [], bp = [] } = {}) {
  const dsCd = new Set(cd);
  const dsBp = new Set(bp);
  for (const n of nhom) {
    const g = NHOM[n];
    if (!g) continue;
    (g.cd || []).forEach((x) => dsCd.add(x));
    (g.bp || []).forEach((x) => dsBp.add(x));
  }
  if (!dsCd.size && !dsBp.size) return [];
  const dk = [];
  const ts = [];
  if (dsCd.size) { dk.push('cd.ma_cd IN (?)'); ts.push([...dsCd]); }
  if (dsBp.size) { dk.push('bp.ma_bp IN (?)'); ts.push([...dsBp]); }
  const [rows] = await db.query(
    `SELECT DISTINCT n.id_nv FROM nhan_vien n
       JOIN chuc_danh cd ON cd.id_cd = n.id_cd
       LEFT JOIN bo_phan bp ON bp.id_bp = cd.id_bp
      WHERE n.trangthai = 1 AND (${dk.join(' OR ')})`, ts);
  return rows.map((r) => r.id_nv);
}

function phatRealtime(dich, goi) {
  try { require('./realtime').phat('thong-bao:moi', goi, dich); } catch (e) { /* chua khoi tao realtime */ }
}
function phatKhach(idKh, goi) {
  try {
    const io = require('./realtime').io;
    if (io) io.to(`room_${idKh}`).emit('thong-bao:moi', goi);
  } catch (e) { /* bo qua */ }
}

/**
 * Gui mot thong bao.
 * @param {string} loai  khoa trong LUONG
 * @param {object} o
 *   tieuDe, noiDung, link, mucDo, nguoiGui
 *   nv: [id_nv] nguoi lien quan cu the (nguoi lap, nguoi duoc phan...)
 *   nhom / cd / bp: ghi de nhom mac dinh cua LUONG
 *   kh: [id_kh] khach hang nhan
 *   quanTri: true/false ghi de
 *   truNv: id_nv khong gui (nguoi vua thao tac)
 * @returns {Promise<number>} so nguoi nhan
 */
async function gui(loai, o = {}) {
  try {
    await damBaoCot();
    const luong = LUONG[loai] || { nhan: [], muc_do: 'tin' };
    const mucDo = o.mucDo || luong.muc_do || 'tin';
    const tieuDe = String(o.tieuDe || luong.ten || 'Thông báo').slice(0, 300);
    const noiDung = String(o.noiDung || '').slice(0, 2000);
    const link = o.link ? String(o.link).slice(0, 300) : null;
    const nguoiGui = o.nguoiGui ? String(o.nguoiGui).slice(0, 150) : null;

    const nhomMacDinh = (luong.nhan || []).filter((x) => NHOM[x]);
    const ids = new Set((o.nv || []).filter(Boolean).map(Number));
    const theoNhom = await idNhanVien({ nhom: o.nhom || nhomMacDinh, cd: o.cd || [], bp: o.bp || [] });
    theoNhom.forEach((id) => ids.add(Number(id)));
    if (o.truNv) ids.delete(Number(o.truNv));

    const goiChung = { tieu_de: tieuDe, noi_dung: noiDung || tieuDe, link, loai, muc_do: mucDo, nguoi_gui: nguoiGui || luong.ten };
    let dem = 0;
    for (const id of ids) {
      const [kq] = await db.query(
        `INSERT INTO thong_bao (id_nv, doi_tuong, tieu_de, noi_dung, da_doc, loai, link, muc_do, nguoi_gui)
         VALUES (?, 'nv', ?, ?, 0, ?, ?, ?, ?)`, [id, tieuDe, noiDung, loai, link, mucDo, nguoiGui]);
      phatRealtime({ nv: [id] }, { ...goiChung, id: kq.insertId });
      dem++;
    }
    const guiQuanTri = o.quanTri !== undefined ? o.quanTri : !!luong.quan_tri;
    if (guiQuanTri) {
      const [kq] = await db.query(
        `INSERT INTO thong_bao (id_nv, doi_tuong, tieu_de, noi_dung, da_doc, loai, link, muc_do, nguoi_gui)
         VALUES (NULL, 'quan_tri', ?, ?, 0, ?, ?, ?, ?)`, [tieuDe, noiDung, loai, link, mucDo, nguoiGui]);
      phatRealtime({ quanTri: true }, { ...goiChung, id: kq.insertId, quan_tri: true });
      dem++;
    }
    for (const idKh of new Set((o.kh || []).filter(Boolean).map(Number))) {
      const [kq] = await db.query(
        `INSERT INTO thong_bao (id_nv, id_kh, doi_tuong, tieu_de, noi_dung, da_doc, loai, link, muc_do, nguoi_gui)
         VALUES (NULL, ?, 'khach', ?, ?, 0, ?, ?, ?, ?)`, [idKh, tieuDe, noiDung, loai, link, mucDo, nguoiGui]);
      phatKhach(idKh, { ...goiChung, id: kq.insertId });
      dem++;
    }
    return dem;
  } catch (e) {
    console.error('[thong-bao] không gửi được', loai, e.message);
    return 0;
  }
}

/** Gui khong cho (dung trong nghiep vu: khong lam cham phan hoi, khong nem loi). */
function guiNen(loai, o) {
  setImmediate(() => { gui(loai, o).catch(() => {}); });
}

// ------------------------------------------------------------- doc / danh dau
/** Dieu kien SQL "thong bao cua nguoi nay". Nhan vien con thay dong cu id_nv NULL (gui chung kieu cu). */
function dieuKien(ai) {
  if (ai.quanTri) return { sql: "doi_tuong = 'quan_tri'", ts: [] };
  if (ai.idKh) return { sql: "doi_tuong = 'khach' AND id_kh = ?", ts: [ai.idKh] };
  return { sql: "doi_tuong = 'nv' AND (id_nv = ? OR id_nv IS NULL)", ts: [ai.idNv] };
}

async function dsCuaToi(ai, { gioiHan = 15, chiChuaDoc = false, loai = null } = {}) {
  await damBaoCot();
  const dk = dieuKien(ai);
  const them = [];
  const ts = [...dk.ts];
  if (chiChuaDoc) them.push('da_doc = 0');
  if (loai) { them.push('loai = ?'); ts.push(loai); }
  const [ds] = await db.query(
    `SELECT id_tb AS id, tieu_de, noi_dung, da_doc, loai, link, muc_do, nguoi_gui, created_at
       FROM thong_bao WHERE ${dk.sql}${them.length ? ' AND ' + them.join(' AND ') : ''}
      ORDER BY id_tb DESC LIMIT ?`, [...ts, Number(gioiHan)]);
  return ds.map((r) => ({ ...r, nhom: (LUONG[r.loai] || {}).nhom || 'Chung' }));
}

async function demChuaDoc(ai) {
  await damBaoCot();
  const dk = dieuKien(ai);
  const [[r]] = await db.query(`SELECT COUNT(*) AS n FROM thong_bao WHERE ${dk.sql} AND da_doc = 0`, dk.ts);
  return Number(r.n);
}

async function danhDauDaDoc(ai, id) {
  await damBaoCot();
  const dk = dieuKien(ai);
  // id_nv IS NULL (gui chung kieu cu) khong danh dau ho nguoi khac.
  const [kq] = await db.query(
    `UPDATE thong_bao SET da_doc = 1 WHERE id_tb = ? AND ${dk.sql}${ai.idNv ? ' AND id_nv IS NOT NULL' : ''}`, [id, ...dk.ts]);
  return kq.affectedRows;
}

async function danhDauTatCa(ai) {
  await damBaoCot();
  const dk = dieuKien(ai);
  const [kq] = await db.query(
    `UPDATE thong_bao SET da_doc = 1 WHERE ${dk.sql} AND da_doc = 0${ai.idNv ? ' AND id_nv IS NOT NULL' : ''}`, dk.ts);
  return kq.affectedRows;
}

/** Bang thiet ke luong thong bao (cho trang tai lieu). */
/** Nguoi nhan do nghiep vu tinh luc gui (khong phai mot nhom co dinh). */
const NHAN_DAC_BIET = {
  NGUOI_LIEN_QUAN: 'Người liên quan trực tiếp',
  KHACH: 'Khách hàng của đơn',
  PHUC_VU_BAN: 'Phục vụ phụ trách bàn (chưa có thì phục vụ đang trong ca)',
  PHUC_VU_CA: 'Phục vụ đang trong ca',
  SHIPPER_DON: 'Shipper được phân đơn',
  THU_NGAN_THU_HO: 'Thu ngân (khi có tiền thu hộ)',
};

function bangLuong() {
  return Object.entries(LUONG).map(([khoa, l]) => ({
    khoa, nhom: l.nhom, ten: l.ten, muc_do: l.muc_do,
    nguoi_nhan: [
      ...(l.nhan || []).map((n) => NHAN_DAC_BIET[n] || TEN_NHOM[n] || n),
      ...(l.quan_tri ? ['Quản trị viên'] : []),
    ],
  }));
}

module.exports = {
  NHOM, LUONG, gui, guiNen, dsCuaToi, demChuaDoc, danhDauDaDoc, danhDauTatCa, bangLuong, idNhanVien, damBaoCot, LoiThongBao,
};
