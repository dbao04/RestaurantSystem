/**
 * DIEU HANH TIEC - Dot 1: viec chuan bi theo moc, phan cong nhan su, bang tiec
 * hom nay / can xu ly / sap toi, thong bao mo moc - nhac tre - leo thang.
 *
 * VONG DOI (tinh tu gio bat dau tiec):
 *   Tiec da coc (DA_COC / DA_XAC_NHAN) -> tu sinh VIEC theo MAU_VIEC (moc T-7, T-3,
 *   T-1, ngay tiec). Moi viec: nhom phu trach (role), luc mo (gui thong bao) va han.
 *   Qua han chua xong -> nhac nhom; qua han + LEO_THANG_GIO -> bao Quan ly
 *   (viec trong ngay tiec: bao ngay muc khan cho Quan ly + Giam sat).
 *   Het gio tiec ma chua chot hoa don -> bao Quan ly + Thu ngan.
 *
 * Sinh viec "luoi" (damBaoViec) moi lan quet / mo trang -> khong phu thuoc duong
 * nao dua tiec sang DA_COC (nhan vien, webhook ngan hang, nut gia lap...).
 * Tiec dat sat ngay: han viec da qua luc sinh -> doi thanh (bay gio + 12h), khong vuot gio tiec.
 */
const db = require('../config/db');

const GIO = 3600 * 1000;
const NGAY = 24 * GIO;
const LEO_THANG_GIO = 12;
const DANG_CHAY = ['DA_XAC_NHAN', 'DA_COC', 'CHO_THANH_TOAN'];

/** Nhom phu trach -> ten hien + nhom nguoi nhan thong bao (thongBaoService.NHOM). */
const NHOM_VIEC = {
  QUAN_LY:     { ten: 'Quản lý', nhan: ['QUAN_LY'] },
  GIAM_SAT_PV: { ten: 'Giám sát phục vụ', nhan: ['GIAM_SAT_PV'] },
  PHUC_VU:     { ten: 'Phục vụ', nhan: ['TO_TRUONG_PV'], phanCong: ['truong_tiec', 'phuc_vu'] },
  BEP_QUAN_LY: { ten: 'Bếp trưởng', nhan: ['BEP_QUAN_LY'] },
  BAR:         { ten: 'Bar', nhan: ['BAR'] },
  KHO:         { ten: 'Kho', nhan: ['KHO'] },
  LE_TAN:      { ten: 'Lễ tân', nhan: ['LE_TAN'] },
  THU_NGAN:    { ten: 'Thu ngân', nhan: ['THU_NGAN'] },
};

const CHECKLIST_THU_DON = ['Thu dọn bàn ghế, khăn trải', 'Trả bát đĩa, ly tách về bếp / kho', 'Kiểm đếm hư hỏng (báo phát sinh nếu có)', 'Tắt điện, âm thanh, máy chiếu', 'Vệ sinh sảnh, kiểm tra đồ khách bỏ quên'];
const CHECKLIST_SETUP = ['Bàn ghế đủ & đúng sơ đồ', 'Khăn, bát đĩa, ly tách', 'Trang trí sảnh / sân khấu', 'Âm thanh, ánh sáng, máy chiếu đã thử', 'Biển chào & lối đón khách'];

/**
 * Mau viec. moTruoc / hanTruoc: so GIO truoc gio bat dau tiec.
 * kieu: 'tick' | 'so_khach' | 'checklist' | 'dich_vu' | 'phan_cong' | 'duyet_sanh'.
 */
function mauViec(ch) {
  const t3 = Math.max(1, Number(ch.chot_so_khach_truoc_ngay) || 3);
  return [
    { ma: 'nguyen_lieu', moc: 'T-7', nhom: 'BEP_QUAN_LY', ten: 'Xem kế hoạch nguyên liệu, lập đề xuất mua phần thiếu', moTruoc: 7 * 24, hanTruoc: 5 * 24, link: '/staff/kitchen/mua-hang' },
    { ma: 'kiem_ton', moc: 'T-7', nhom: 'KHO', ten: 'Kiểm tồn kho cho tiệc, báo thiếu cho bếp trưởng', moTruoc: 7 * 24, hanTruoc: 5 * 24, link: '/staff/kitchen/kho' },
    { ma: 'dich_vu_ngoai', moc: 'T-7', nhom: 'QUAN_LY', ten: 'Liên hệ, chuẩn bị các dịch vụ khách đã chọn', moTruoc: 7 * 24, hanTruoc: 4 * 24, kieu: 'dich_vu', canDichVu: true },
    { ma: 'chot_so_khach', moc: `T-${t3}`, nhom: 'LE_TAN', ten: 'Gọi khách chốt số khách / số bàn', moTruoc: (t3 + 1) * 24, hanTruoc: t3 * 24, kieu: 'so_khach' },
    { ma: 'chot_nguyen_lieu', moc: `T-${t3}`, nhom: 'BEP_QUAN_LY', ten: 'Chốt nguyên liệu theo số khách đã chốt', moTruoc: t3 * 24, hanTruoc: (t3 - 1) * 24 + 12 },
    { ma: 'phan_cong_pv', moc: 'T-1', nhom: 'GIAM_SAT_PV', ten: 'Phân công trưởng tiệc & nhân viên phục vụ', moTruoc: 2 * 24, hanTruoc: 24, kieu: 'phan_cong', vaiTro: ['truong_tiec', 'phuc_vu'] },
    { ma: 'phan_cong_bep', moc: 'T-1', nhom: 'BEP_QUAN_LY', ten: 'Phân công bếp & bar cho tiệc', moTruoc: 2 * 24, hanTruoc: 24, kieu: 'phan_cong', vaiTro: ['bep', 'bar'] },
    { ma: 'so_do_ban', moc: 'T-1', nhom: 'GIAM_SAT_PV', ten: 'Lên sơ đồ bố trí bàn trong sảnh', moTruoc: 2 * 24, hanTruoc: 24 },
    { ma: 'so_che', moc: 'T-1', nhom: 'BEP_QUAN_LY', ten: 'Sơ chế nguyên liệu cho tiệc', moTruoc: 24, hanTruoc: 4 },
    { ma: 'do_uong', moc: 'T-1', nhom: 'BAR', ten: 'Chuẩn bị đồ uống, đá, ly cho tiệc', moTruoc: 24, hanTruoc: 2 },
    { ma: 'setup_sanh', moc: 'Ngày tiệc', nhom: 'PHUC_VU', ten: 'Setup sảnh theo checklist', moTruoc: 5, hanTruoc: 1, kieu: 'checklist', checklist: CHECKLIST_SETUP },
    { ma: 'bep_san_sang', moc: 'Ngày tiệc', nhom: 'BEP_QUAN_LY', ten: 'Bếp sẵn sàng ra món', moTruoc: 3, hanTruoc: 0.5 },
    { ma: 'sanh_san_sang', moc: 'Ngày tiệc', nhom: 'GIAM_SAT_PV', ten: 'Duyệt "Sảnh sẵn sàng" (kiểm tra lại setup)', moTruoc: 1.5, hanTruoc: 0.25, kieu: 'duyet_sanh', sauViec: 'setup_sanh' },
    // Sau tiec: tinh tu gio KET THUC (moSau / hanSau gio).
    { ma: 'thu_don', moc: 'Sau tiệc', nhom: 'PHUC_VU', ten: 'Thu dọn sảnh theo checklist', sau: true, moSau: 0, hanSau: 2, kieu: 'checklist', checklist: CHECKLIST_THU_DON },
    { ma: 'kiem_dem_bar', moc: 'Sau tiệc', nhom: 'BAR', ten: 'Kiểm đếm đồ uống còn lại, trả kho bar', sau: true, moSau: 0, hanSau: 2 },
    { ma: 'nguyen_lieu_du', moc: 'Sau tiệc', nhom: 'BEP_QUAN_LY', ten: 'Báo nguyên liệu dư / hao hụt sau tiệc', sau: true, moSau: 0, hanSau: 14, link: '/staff/kitchen/kho/kiem-ke' },
  ];
}

const VAI_TRO_NS = {
  truong_tiec: { ten: 'Trưởng tiệc', bp: ['PV'], capToiDa: 4, motNguoi: true, nhomQuyen: 'GIAM_SAT_PV', icon: 'fa-user-tie', mo_ta: 'Giám sát / tổ trưởng phục vụ, chịu trách nhiệm cả buổi tiệc' },
  phuc_vu:     { ten: 'Phục vụ', bp: ['PV'], nhomQuyen: 'GIAM_SAT_PV', icon: 'fa-bell-concierge', mo_ta: '1 người cho 2 bàn' },
  le_tan:      { ten: 'Lễ tân đón khách', bp: ['LT'], nhomQuyen: 'GIAM_SAT_PV', icon: 'fa-hand-holding-heart', mo_ta: 'Đón khách, hướng dẫn chỗ ngồi' },
  bep:         { ten: 'Bếp', bp: ['BEP'], nhomQuyen: 'BEP_QUAN_LY', icon: 'fa-fire-burner', mo_ta: '1 người cho 40 khách, tối thiểu 2' },
  bar:         { ten: 'Bar', bp: ['BAR'], nhomQuyen: 'BEP_QUAN_LY', icon: 'fa-martini-glass', mo_ta: '1 người cho 100 khách' },
};

/** So nguoi can cho tung vi tri theo quy mo tiec (uu tien so da chot). */
function dinhMuc(soKhach, soBan) {
  const k = Number(soKhach) || 0, b = Number(soBan) || Math.ceil(k / 10);
  return { truong_tiec: 1, phuc_vu: Math.max(2, Math.ceil(b / 2)), le_tan: k >= 150 ? 2 : 1, bep: Math.max(2, Math.ceil(k / 40)), bar: Math.max(1, Math.ceil(k / 100)) };
}

/**
 * Tinh trang tung nhan vien cho mot tiec: co ca trung gio tiec, nghi phep, dang o tiec khac cung buoi.
 * Tra Map id_nv -> { co_ca, ca, nghi, xin_nghi, tiec_khac }.
 */
async function tinhTrangNhanVien(t, ids) {
  const m = new Map(ids.map((id) => [Number(id), { co_ca: false, ca: null, nghi: false, xin_nghi: false, tiec_khac: null }]));
  if (!ids.length) return m;
  const { bd, kt } = khungGio(t);
  const hh = (d) => `${p2(d.getHours())}:${p2(d.getMinutes())}:00`;
  const [ca] = await db.query(
    `SELECT id_nv, ca, TIME_FORMAT(gio_bat_dau,'%H:%i') bd, TIME_FORMAT(gio_ket_thuc,'%H:%i') kt FROM lich_lam_viec
      WHERE ngay = ? AND trangthai = 1 AND id_nv IN (?) AND gio_bat_dau < ? AND gio_ket_thuc > ?`, [t.ngay, ids, hh(kt), hh(bd)]).catch(() => [[]]);
  for (const c of ca) { const x = m.get(Number(c.id_nv)); if (x) { x.co_ca = true; x.ca = `${c.bd}–${c.kt}`; } }
  const [np] = await db.query(
    'SELECT id_nv, trang_thai FROM nghi_phep WHERE id_nv IN (?) AND trang_thai IN (0, 1) AND ngay_bat_dau <= ? AND ngay_ket_thuc >= ?', [ids, t.ngay, t.ngay]).catch(() => [[]]);
  for (const n of np) { const x = m.get(Number(n.id_nv)); if (x) { if (Number(n.trang_thai) === 1) x.nghi = true; else x.xin_nghi = true; } }
  const [khac] = await db.query(
    `SELECT s.id_nv, t.ma_tiec FROM tiec_nhan_su s JOIN dat_tiec t ON t.id = s.dat_tiec_id
      WHERE s.id_nv IN (?) AND t.id <> ? AND t.ngay_to_chuc = ? AND t.buoi = ? AND t.trang_thai IN (?)`, [ids, t.id, t.ngay, t.buoi, DANG_CHAY]);
  for (const k of khac) { const x = m.get(Number(k.id_nv)); if (x) x.tiec_khac = k.ma_tiec; }
  return m;
}

let daTao = false;
async function damBaoCauTruc() {
  if (daTao) return;
  await db.query(`CREATE TABLE IF NOT EXISTS tiec_viec (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dat_tiec_id INT NOT NULL,
    ma_viec VARCHAR(40) NOT NULL,
    moc VARCHAR(20) NOT NULL,
    nhom VARCHAR(20) NOT NULL COMMENT 'Nhom phu trach (NHOM_VIEC)',
    ten VARCHAR(200) NOT NULL,
    mo_luc DATETIME NOT NULL COMMENT 'Luc mo viec + gui thong bao',
    han DATETIME NOT NULL,
    trang_thai ENUM('cho','xong','van_de') NOT NULL DEFAULT 'cho',
    ghi_chu VARCHAR(500) NULL,
    du_lieu JSON NULL COMMENT 'So khach chot, checklist, dich vu...',
    id_nv_xong INT NULL, xong_luc DATETIME NULL,
    da_bao_mo TINYINT(1) NOT NULL DEFAULT 0, da_nhac TINYINT(1) NOT NULL DEFAULT 0, da_leo_thang TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tiec_viec (dat_tiec_id, ma_viec), KEY (han), KEY (nhom)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS tiec_nhan_su (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dat_tiec_id INT NOT NULL,
    id_nv INT NOT NULL,
    vai_tro VARCHAR(20) NOT NULL,
    nguoi_phan INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tiec_ns (dat_tiec_id, id_nv), KEY (id_nv)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  // Gio khai tiec / ket thuc thuc te (Dot 2 - tiecTrongTiecService).
  for (const [ten, kieu] of [['bat_dau_thuc_te', 'DATETIME NULL'], ['ket_thuc_thuc_te', 'DATETIME NULL']]) {
    const [r] = await db.query('SHOW COLUMNS FROM dat_tiec LIKE ?', [ten]);
    if (!r.length) await db.query(`ALTER TABLE dat_tiec ADD COLUMN ${ten} ${kieu}`);
  }
  daTao = true;
}

// ------------------------------------------------------------------ thoi gian
const p2 = (n) => String(n).padStart(2, '0');
const sqlDt = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
const ngayStr = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** Gio bat dau / ket thuc cua tiec (ket thuc = cuoi khung buoi, VD 17:30 – 22:00). */
function khungGio(t) {
  const { BUOI } = require('./datTiecService');
  const bd = new Date(`${t.ngay}T${(t.gio || '18:00')}:00`);
  const m = /(\d{1,2}):(\d{2})\s*$/.exec((BUOI[t.buoi] || {}).khung || '');
  let kt = m ? new Date(`${t.ngay}T${p2(m[1])}:${m[2]}:00`) : new Date(bd.getTime() + 4 * GIO);
  if (kt <= bd) kt = new Date(bd.getTime() + 4 * GIO);
  return { bd, kt };
}

/** Pha cua tiec so voi bay gio. */
function pha(t, now = new Date()) {
  const { bd, kt } = khungGio(t);
  // Gio thuc te (khai tiec / ket thuc) uu tien hon khung du kien.
  if (t.ket_thuc_thuc_te) return { ma: 'da_ket_thuc', bd, kt, thuc_te: true };
  if (t.bat_dau_thuc_te) return { ma: 'dang_dien_ra', da_phut: Math.round((now - new Date(t.bat_dau_thuc_te)) / 60000), bd: new Date(t.bat_dau_thuc_te), kt: new Date(Math.max(kt.getTime(), now.getTime() + 60000)), thuc_te: true };
  if (now < bd) {
    const phut = Math.round((bd - now) / 60000);
    return { ma: ngayStr(now) === t.ngay ? 'sap_bat_dau' : 'sap_toi', con_phut: phut, bd, kt };
  }
  if (now <= kt) return { ma: 'dang_dien_ra', da_phut: Math.round((now - bd) / 60000), bd, kt };
  return { ma: 'da_ket_thuc', bd, kt };
}

// -------------------------------------------------------------------- doc tiec
const COT_TIEC = `t.id, t.ma_tiec, t.ho_ten, t.so_dien_thoai, t.loai_tiec, t.ten_nhan_vat, t.buoi,
  DATE_FORMAT(t.ngay_to_chuc, '%Y-%m-%d') AS ngay, TIME_FORMAT(t.gio_bat_dau, '%H:%i') AS gio,
  t.so_khach, t.so_ban, t.trang_thai, t.tong_du_toan, t.tong_thuc_te, t.da_thu, t.dich_vu, t.thuc_don_tuy_chinh,
  t.bat_dau_thuc_te, t.ket_thuc_thuc_te,
  v.Name_vitri AS ten_sanh, COALESCE(d.ten, 'Thực đơn tự chọn') AS ten_thuc_don`;
const JOIN_TIEC = 'FROM dat_tiec t LEFT JOIN vitri v ON v.id_vitri = t.khu_vuc_id LEFT JOIN thuc_don_tiec d ON d.id = t.thuc_don_id';

const docJson = (v, md) => { if (v == null) return md; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch (_) { return md; } };

function chuanTiec(r) {
  const { LOAI_TIEC, BUOI, TRANG_THAI } = require('./datTiecService');
  const tong = r.tong_thuc_te != null ? Number(r.tong_thuc_te) : Number(r.tong_du_toan);
  return {
    ...r,
    ten_loai: (LOAI_TIEC[r.loai_tiec] || {}).ten || r.loai_tiec,
    icon: (LOAI_TIEC[r.loai_tiec] || {}).icon || 'fa-glass-cheers',
    ten_buoi: (BUOI[r.buoi] || {}).ten || r.buoi,
    ten_trang_thai: TRANG_THAI[r.trang_thai] || r.trang_thai,
    dich_vu: docJson(r.dich_vu, []),
    tong: tong, da_thu: Number(r.da_thu) || 0, con_lai: Math.max(0, Math.round(tong - (Number(r.da_thu) || 0))),
  };
}

// ------------------------------------------------------------------ sinh viec
async function damBaoViec(t, now = new Date()) {
  await damBaoCauTruc();
  const ch = await require('./datTiecQuyTrinh').cauHinh();
  const { bd, kt } = khungGio(t);
  const dv = docJson(t.dich_vu, []);
  for (const m of mauViec(ch)) {
    if (m.canDichVu && !dv.length) continue;
    if (m.sau) {
      // Viec sau tiec: mo luc het gio (ket thuc som -> khaiTiec doi mo_luc ve luc ket thuc).
      const moS = new Date(kt.getTime() + m.moSau * GIO), hanS = new Date(kt.getTime() + m.hanSau * GIO);
      const duL = m.kieu === 'checklist' ? { muc: m.checklist.map((x) => ({ ten: x, xong: false })) } : null;
      await db.query(`INSERT IGNORE INTO tiec_viec (dat_tiec_id, ma_viec, moc, nhom, ten, mo_luc, han, du_lieu) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.id, m.ma, m.moc, m.nhom, m.ten, sqlDt(moS), sqlDt(hanS), duL ? JSON.stringify(duL) : null]);
      continue;
    }
    const mo = new Date(bd.getTime() - m.moTruoc * GIO);
    let han = new Date(bd.getTime() - m.hanTruoc * GIO);
    // Tiec dat sat ngay: han da qua luc sinh -> cho them toi da 12h, khong vuot 15 phut truoc gio tiec.
    if (han < now) {
      han = new Date(Math.min(now.getTime() + LEO_THANG_GIO * GIO, bd.getTime() - 15 * 60000));
      if (han < now) han = new Date(now.getTime() + 30 * 60000);
    }
    const duLieu = m.kieu === 'checklist' ? { muc: m.checklist.map((x) => ({ ten: x, xong: false })) }
      : m.kieu === 'dich_vu' ? { muc: dv.map((x) => ({ ten: x.ten, xong: false })) } : null;
    await db.query(
      `INSERT IGNORE INTO tiec_viec (dat_tiec_id, ma_viec, moc, nhom, ten, mo_luc, han, du_lieu)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.id, m.ma, m.moc, m.nhom, m.ten, sqlDt(mo), sqlDt(han), duLieu ? JSON.stringify(duLieu) : null]);
  }
}

/** Sinh viec cho moi tiec dang chay tu hom qua toi 30 ngay toi. */
async function damBaoTatCa() {
  await damBaoCauTruc();
  const [ds] = await db.query(
    `SELECT ${COT_TIEC} ${JOIN_TIEC}
      WHERE t.trang_thai IN ('DA_XAC_NHAN','DA_COC') AND t.ngay_to_chuc BETWEEN CURDATE() - INTERVAL 1 DAY AND CURDATE() + INTERVAL 30 DAY`);
  for (const t of ds) await damBaoViec(t);
  return ds.length;
}

// ------------------------------------------------------------ quyen nguoi dung
/** Cac nhom viec ma nguoi dang nhap duoc lam. */
function nhomCua(phien = {}, hoSo = null) {
  const { laDieuHanh } = require('./phanQuyenVaiTro');
  if (laDieuHanh(phien, hoSo)) return { dieuHanh: true, nhom: Object.keys(NHOM_VIEC), truongBp: true };
  const hs = hoSo || {};
  const bp = hs.ma_bp, cap = Number(hs.cap_bac) || 9, cd = hs.ma_cd;
  const nhom = [];
  if (bp === 'PV') { nhom.push('PHUC_VU'); if (cap <= 3) nhom.push('GIAM_SAT_PV'); }
  if (bp === 'BEP' && cap <= 3) nhom.push('BEP_QUAN_LY');
  if (bp === 'BAR') nhom.push('BAR');
  if (bp === 'KHO') nhom.push('KHO');
  if (bp === 'LT') nhom.push('LE_TAN');
  if (bp === 'TN') nhom.push('THU_NGAN');
  if (cd === 'TRUONGBAR') nhom.push('BEP_QUAN_LY');
  // Truong bo phan (giam sat, to truong, bep truong...) thay moi tiec; nhan vien thuong chi tiec duoc phan.
  const truongBp = cap <= 4 || ['LT', 'TN', 'KHO'].includes(bp);
  return { dieuHanh: false, nhom: [...new Set(nhom)], truongBp, duocVao: ['PV', 'BEP', 'BAR', 'KHO', 'LT', 'TN'].includes(bp) };
}

// --------------------------------------------------------------- bang tong hop
async function bangTongHop({ phien, hoSo, idNv }) {
  await damBaoTatCa();
  const q = nhomCua(phien, hoSo);
  const now = new Date();
  const [ds] = await db.query(
    `SELECT ${COT_TIEC} ${JOIN_TIEC}
      WHERE t.trang_thai IN ('DA_XAC_NHAN','DA_COC','CHO_THANH_TOAN')
        AND (t.ngay_to_chuc BETWEEN CURDATE() - INTERVAL 30 DAY AND CURDATE() + INTERVAL 7 DAY)
      ORDER BY t.ngay_to_chuc, t.gio_bat_dau`);
  let tiec = ds.map(chuanTiec);
  const tatCa = tiec.slice();
  const ids = tiec.map((t) => t.id);
  const [viec] = ids.length ? await db.query('SELECT * FROM tiec_viec WHERE dat_tiec_id IN (?)', [ids]) : [[]];
  const [ns] = ids.length ? await db.query(
    `SELECT s.dat_tiec_id, s.id_nv, s.vai_tro, n.ten FROM tiec_nhan_su s JOIN nhan_vien n ON n.id_nv = s.id_nv WHERE s.dat_tiec_id IN (?)`, [ids]) : [[]];
  if (!q.dieuHanh && !q.truongBp) {
    const cuaToi = new Set(ns.filter((x) => Number(x.id_nv) === Number(idNv)).map((x) => x.dat_tiec_id));
    tiec = tiec.filter((t) => cuaToi.has(t.id));
  }
  for (const t of tiec) {
    const vs = viec.filter((v) => v.dat_tiec_id === t.id);
    t.viec_tong = vs.length; t.viec_xong = vs.filter((v) => v.trang_thai === 'xong').length;
    t.viec_tre = vs.filter((v) => v.trang_thai !== 'xong' && new Date(v.han) < now).length;
    t.viec_van_de = vs.filter((v) => v.trang_thai === 'van_de').length;
    t.pha = pha(t, now);
    t.truong_tiec = ns.filter((x) => x.dat_tiec_id === t.id && x.vai_tro === 'truong_tiec').map((x) => x.ten);
    t.so_nhan_su = ns.filter((x) => x.dat_tiec_id === t.id).length;
    const chot = vs.find((v) => v.ma_viec === 'chot_so_khach' && v.trang_thai === 'xong');
    t.khach_chot = chot ? docJson(chot.du_lieu, {}).so_khach || null : null;
  }
  const tt = require('./tiecTrongTiecService');
  const psMo = await tt.demPhatSinhMo(tiec.map((t) => t.id));
  for (const t of tiec) t.phat_sinh = psMo.get(t.id) || { n: 0, khan: 0, cho_duyet: 0 };
  const homNay = ngayStr(now);
  const coBep = q.dieuHanh || q.nhom.includes('BEP_QUAN_LY') || ['BEP', 'BAR'].includes((hoSo || {}).ma_bp);
  // Bep / bar thay moi dot dang goi cua cac tiec trong ngay (ca nhan vien chua duoc phan cong).
  const bep = coBep ? await tt.viecBep(tatCa.filter((t) => t.ngay <= homNay && t.trang_thai !== 'CHO_THANH_TOAN').map((t) => t.id)) : null;
  const hom = tiec.filter((t) => t.ngay === homNay && t.trang_thai !== 'CHO_THANH_TOAN');
  const canChot = tiec.filter((t) => ['DA_COC', 'DA_XAC_NHAN'].includes(t.trang_thai) && t.pha.ma === 'da_ket_thuc');
  const choTra = tiec.filter((t) => t.trang_thai === 'CHO_THANH_TOAN');
  const sapToi = tiec.filter((t) => t.ngay > homNay && ['DA_COC', 'DA_XAC_NHAN'].includes(t.trang_thai));
  const idTiec = new Set(tiec.map((t) => t.id));
  const viecMo = viec.filter((v) => idTiec.has(v.dat_tiec_id) && v.trang_thai !== 'xong' && new Date(v.mo_luc) <= now)
    .map((v) => ({ ...v, du_lieu: docJson(v.du_lieu, null), tre: new Date(v.han) < now, tiec: tiec.find((t) => t.id === v.dat_tiec_id) }))
    .sort((a, b) => new Date(a.han) - new Date(b.han));
  const viecTre = viecMo.filter((v) => v.tre);
  const viecCuaToi = viecMo.filter((v) => q.nhom.includes(v.nhom) && (q.dieuHanh ? v.nhom === 'QUAN_LY' : true));
  return { quyen: q, hom, canChot, choTra, sapToi, viecTre, viecCuaToi, bep, now };
}

// ------------------------------------------------------------------ chi tiet
async function chiTiet(id, { phien, hoSo, idNv }) {
  await damBaoCauTruc();
  const [[r]] = await db.query(`SELECT ${COT_TIEC}, t.ghi_chu, t.ghi_chu_noi_bo, t.thuc_don_id ${JOIN_TIEC} WHERE t.id = ?`, [id]).catch(async () => db.query(`SELECT ${COT_TIEC}, t.ghi_chu, t.thuc_don_id ${JOIN_TIEC} WHERE t.id = ?`, [id]));
  if (!r) return null;
  const t = chuanTiec(r);
  if (DANG_CHAY.includes(t.trang_thai) || t.trang_thai === 'HOAN_THANH') {
    if (['DA_XAC_NHAN', 'DA_COC'].includes(t.trang_thai)) await damBaoViec(t);
  }
  const q = nhomCua(phien, hoSo);
  const [ns] = await db.query(
    `SELECT s.id, s.id_nv, s.vai_tro, n.ten, n.sodienthoai, cd.ten_cd FROM tiec_nhan_su s
       JOIN nhan_vien n ON n.id_nv = s.id_nv LEFT JOIN chuc_danh cd ON cd.id_cd = n.id_cd
      WHERE s.dat_tiec_id = ? ORDER BY FIELD(s.vai_tro,'truong_tiec','phuc_vu','le_tan','bep','bar'), n.ten`, [id]);
  if (!q.dieuHanh && !q.truongBp && !ns.some((x) => Number(x.id_nv) === Number(idNv))) return { khongDuocXem: true };
  const now = new Date();
  const [vs] = await db.query(
    `SELECT v.*, n.ten AS ten_nguoi_xong FROM tiec_viec v LEFT JOIN nhan_vien n ON n.id_nv = v.id_nv_xong
      WHERE v.dat_tiec_id = ? ORDER BY v.han, v.id`, [id]);
  const viec = vs.map((v) => ({
    ...v, du_lieu: docJson(v.du_lieu, null),
    mo: new Date(v.mo_luc) <= now, tre: v.trang_thai !== 'xong' && new Date(v.han) < now,
    lam_duoc: q.nhom.includes(v.nhom), ten_nhom: (NHOM_VIEC[v.nhom] || {}).ten || v.nhom,
  }));
  const moc = [];
  for (const v of viec) { let g = moc.find((x) => x.ten === v.moc); if (!g) moc.push(g = { ten: v.moc, viec: [] }); g.viec.push(v); }
  // Nhan vien co the phan cong (theo bo phan cua tung vai tro).
  const [dsNv] = await db.query(
    `SELECT n.id_nv, n.ten, bp.ma_bp, cd.ten_cd, cd.cap_bac FROM nhan_vien n
       JOIN chuc_danh cd ON cd.id_cd = n.id_cd LEFT JOIN bo_phan bp ON bp.id_bp = cd.id_bp
      WHERE n.trangthai = 1 AND bp.ma_bp IN ('PV','LT','BEP','BAR') ORDER BY cd.cap_bac, n.ten`);
  const chot = viec.find((v) => v.ma_viec === 'chot_so_khach' && v.trang_thai === 'xong');
  const khachChot = chot ? (chot.du_lieu || {}).so_khach : null, banChot = chot ? (chot.du_lieu || {}).so_ban : null;
  const tinhTrang = await tinhTrangNhanVien(t, dsNv.map((n) => n.id_nv));
  const ungVien = dsNv.map((n) => ({ ...n, ...tinhTrang.get(Number(n.id_nv)) }));
  return {
    tiec: { ...t, pha: pha(t, now), khach_chot: khachChot, ban_chot: banChot },
    moc, viec, nhanSu: ns, dsNv: ungVien, quyen: q, VAI_TRO_NS, NHOM_VIEC,
    dinhMuc: dinhMuc(khachChot || t.so_khach, banChot || t.so_ban),
    phanCongDuoc: Object.keys(VAI_TRO_NS).filter((k) => q.dieuHanh || q.nhom.includes(VAI_TRO_NS[k].nhomQuyen)),
  };
}

class LoiDieuHanh extends Error { constructor(m, code = 400) { super(m); this.code = code; } }

// ------------------------------------------------------------------ cap nhat viec
async function capNhatViec(idViec, body, { phien, hoSo, idNv }) {
  await damBaoCauTruc();
  const [[v]] = await db.query('SELECT * FROM tiec_viec WHERE id = ?', [idViec]);
  if (!v) throw new LoiDieuHanh('Không tìm thấy việc.', 404);
  const q = nhomCua(phien, hoSo);
  if (!q.nhom.includes(v.nhom)) throw new LoiDieuHanh(`Việc này do ${(NHOM_VIEC[v.nhom] || {}).ten || v.nhom} phụ trách.`, 403);
  const [[t]] = await db.query(`SELECT ${COT_TIEC} ${JOIN_TIEC} WHERE t.id = ?`, [v.dat_tiec_id]);
  if (!t || !DANG_CHAY.includes(t.trang_thai)) throw new LoiDieuHanh('Tiệc không còn ở giai đoạn chuẩn bị.');
  // Chi luu tick checklist (tien do), khong doi trang thai / ghi chu.
  if (body.chi_luu_muc) {
    const cu = docJson(v.du_lieu, null);
    if (!cu || !Array.isArray(cu.muc) || v.trang_thai === 'xong') return { ok: true };
    const da = Array.isArray(body.muc_xong) ? body.muc_xong.map(Number) : [];
    await db.query('UPDATE tiec_viec SET du_lieu = ? WHERE id = ?', [JSON.stringify({ muc: cu.muc.map((m, i) => ({ ...m, xong: da.includes(i) })) }), v.id]);
    return { ok: true };
  }
  const trangThai = ['xong', 'van_de', 'cho'].includes(body.trang_thai) ? body.trang_thai : 'xong';
  const ghiChu = String(body.ghi_chu || '').trim().slice(0, 500) || null;
  let duLieu = docJson(v.du_lieu, null);
  const mau = mauViec(await require('./datTiecQuyTrinh').cauHinh()).find((m) => m.ma === v.ma_viec) || {};

  if (trangThai === 'van_de' && !ghiChu) throw new LoiDieuHanh('Ghi rõ vấn đề gặp phải để quản lý nắm và hỗ trợ.');
  if (mau.kieu === 'checklist' || mau.kieu === 'dich_vu') {
    const da = Array.isArray(body.muc_xong) ? body.muc_xong.map(Number) : [];
    duLieu = { muc: ((duLieu && duLieu.muc) || []).map((m, i) => ({ ...m, xong: da.includes(i) })) };
    if (trangThai === 'xong' && duLieu.muc.some((m) => !m.xong)) throw new LoiDieuHanh('Còn mục chưa tick. Tick đủ mới hoàn thành, hoặc báo "Có vấn đề".');
  }
  if (mau.kieu === 'so_khach' && trangThai === 'xong') {
    const ch = await require('./datTiecQuyTrinh').cauHinh();
    const k = Math.floor(Number(body.so_khach));
    if (!Number.isFinite(k) || k < 1 || k > ch.khach_toi_da) throw new LoiDieuHanh(`Số khách chốt không hợp lệ (1–${ch.khach_toi_da}).`);
    const kb = require('./datTiecQuyTrinh').khoangBan(k, ch);
    const b = body.so_ban ? Math.floor(Number(body.so_ban)) : kb.goiY;
    if (!(b >= kb.min && b <= kb.max)) throw new LoiDieuHanh(`Với ${k} khách, số bàn phải từ ${kb.min} đến ${kb.max}.`);
    duLieu = { so_khach: k, so_ban: b, ban_dat: t.so_ban, khach_dat: t.so_khach };
  }
  if (mau.kieu === 'phan_cong' && trangThai === 'xong') {
    const [[c]] = await db.query('SELECT COUNT(*) n FROM tiec_nhan_su WHERE dat_tiec_id = ? AND vai_tro IN (?)', [v.dat_tiec_id, mau.vaiTro]);
    if (!Number(c.n)) throw new LoiDieuHanh('Chưa phân công ai. Thêm nhân sự ở mục "Nhân sự tiệc" trước.');
    if (v.ma_viec === 'phan_cong_pv') {
      const [[tt]] = await db.query("SELECT COUNT(*) n FROM tiec_nhan_su WHERE dat_tiec_id = ? AND vai_tro = 'truong_tiec'", [v.dat_tiec_id]);
      if (!Number(tt.n)) throw new LoiDieuHanh('Cần chọn một Trưởng tiệc.');
    }
  }
  if (mau.kieu === 'duyet_sanh' && trangThai === 'xong') {
    const [[s]] = await db.query("SELECT trang_thai FROM tiec_viec WHERE dat_tiec_id = ? AND ma_viec = ?", [v.dat_tiec_id, mau.sauViec]);
    if (s && s.trang_thai !== 'xong') throw new LoiDieuHanh('Phục vụ chưa hoàn thành checklist setup sảnh.');
  }
  await db.query(
    `UPDATE tiec_viec SET trang_thai = ?, ghi_chu = ?, du_lieu = ?, id_nv_xong = ?, xong_luc = ? WHERE id = ?`,
    [trangThai, ghiChu, duLieu ? JSON.stringify(duLieu) : null, trangThai === 'cho' ? null : (idNv || null), trangThai === 'cho' ? null : sqlDt(new Date()), v.id]);
  const tb = require('./thongBaoService');
  const link = `/staff/tiec/${v.dat_tiec_id}`;
  if (trangThai === 'van_de') {
    await tb.gui('tiec_van_de', { tieuDe: `Tiệc ${t.ma_tiec}: có vấn đề ở "${v.ten}"`, noiDung: ghiChu, link, mucDo: 'khan', truNv: idNv });
  } else if (v.ma_viec === 'sanh_san_sang' && trangThai === 'xong') {
    await tb.gui('tiec_san_sang', { tieuDe: `Tiệc ${t.ma_tiec} – sảnh đã sẵn sàng`, noiDung: `${t.gio} · ${t.so_khach} khách · ${t.ho_ten}`, link, truNv: idNv });
  } else if (v.ma_viec === 'chot_so_khach' && trangThai === 'xong') {
    await tb.gui('tiec_chot_khach', { tieuDe: `Tiệc ${t.ma_tiec} đã chốt ${duLieu.so_khach} khách · ${duLieu.so_ban} bàn`, noiDung: `Đặt ban đầu ${t.so_khach} khách · ${t.so_ban} bàn. Bếp chốt nguyên liệu theo số mới.`, link, truNv: idNv });
  }
  return { ok: true, trang_thai: trangThai };
}

// ------------------------------------------------------------------ nhan su
async function themNhanSu(idTiec, body, { phien, hoSo, idNv }) {
  await damBaoCauTruc();
  const vaiTro = body.vai_tro;
  const vt = VAI_TRO_NS[vaiTro];
  if (!vt) throw new LoiDieuHanh('Vị trí không hợp lệ.');
  const q = nhomCua(phien, hoSo);
  if (!q.dieuHanh && !q.nhom.includes(vt.nhomQuyen)) throw new LoiDieuHanh(`Chỉ ${(NHOM_VIEC[vt.nhomQuyen] || {}).ten} hoặc Quản lý phân công vị trí này.`, 403);
  const [[t]] = await db.query(`SELECT ${COT_TIEC} ${JOIN_TIEC} WHERE t.id = ?`, [idTiec]);
  if (!t || !DANG_CHAY.includes(t.trang_thai)) throw new LoiDieuHanh('Tiệc không còn ở giai đoạn chuẩn bị.');
  const ids = [...new Set((Array.isArray(body.ds_nv) ? body.ds_nv : [body.id_nv]).map(Number).filter(Boolean))].slice(0, 40);
  if (!ids.length) throw new LoiDieuHanh('Chọn ít nhất một nhân viên.');
  if (vt.motNguoi && ids.length > 1) throw new LoiDieuHanh(`${vt.ten} chỉ chọn một người.`);
  const [dsNv] = await db.query(
    `SELECT n.id_nv, n.ten, bp.ma_bp, cd.cap_bac FROM nhan_vien n JOIN chuc_danh cd ON cd.id_cd = n.id_cd LEFT JOIN bo_phan bp ON bp.id_bp = cd.id_bp
      WHERE n.id_nv IN (?) AND n.trangthai = 1`, [ids]);
  if (dsNv.length !== ids.length) throw new LoiDieuHanh('Có nhân viên không tồn tại hoặc đã nghỉ việc.');
  const tt = await tinhTrangNhanVien(t, ids);
  const [daCo] = await db.query('SELECT id_nv, vai_tro FROM tiec_nhan_su WHERE dat_tiec_id = ? AND id_nv IN (?)', [idTiec, ids]);
  for (const nv of dsNv) {
    if (!vt.bp.includes(nv.ma_bp)) throw new LoiDieuHanh(`${nv.ten} không thuộc bộ phận phù hợp với vị trí ${vt.ten}.`);
    if (vt.capToiDa && Number(nv.cap_bac) > vt.capToiDa) throw new LoiDieuHanh(`${vt.ten} cần giám sát hoặc tổ trưởng phục vụ – ${nv.ten} chưa đủ cấp.`);
    const x = tt.get(Number(nv.id_nv)) || {};
    if (x.nghi) throw new LoiDieuHanh(`${nv.ten} nghỉ phép ngày này.`);
    if (x.tiec_khac) throw new LoiDieuHanh(`${nv.ten} đã được phân công tiệc ${x.tiec_khac} cùng buổi.`);
    const d = daCo.find((c) => Number(c.id_nv) === Number(nv.id_nv));
    if (d && d.vai_tro !== vaiTro) throw new LoiDieuHanh(`${nv.ten} đang ở vị trí ${(VAI_TRO_NS[d.vai_tro] || {}).ten} của tiệc này.`);
  }
  if (vt.motNguoi) {
    const [[c]] = await db.query('SELECT COUNT(*) n FROM tiec_nhan_su WHERE dat_tiec_id = ? AND vai_tro = ? AND id_nv NOT IN (?)', [idTiec, vaiTro, ids]);
    if (Number(c.n)) throw new LoiDieuHanh(`Tiệc đã có ${vt.ten}. Gỡ người cũ trước khi đổi.`);
  }
  const moi = dsNv.filter((nv) => !daCo.some((c) => Number(c.id_nv) === Number(nv.id_nv)));
  for (const nv of moi) {
    await db.query('INSERT INTO tiec_nhan_su (dat_tiec_id, id_nv, vai_tro, nguoi_phan) VALUES (?, ?, ?, ?)', [idTiec, nv.id_nv, vaiTro, idNv || null]);
  }
  if (moi.length) {
    const tc = chuanTiec(t);
    await require('./thongBaoService').gui('tiec_phan_cong', {
      nv: moi.map((x) => x.id_nv), tieuDe: `Bạn được phân công ${vt.ten.toLowerCase()} – tiệc ${t.ma_tiec}`,
      noiDung: `${tc.ten_loai} · ${t.ngay.split('-').reverse().join('/')} ${t.gio} · ${t.ten_sanh || 'Sảnh Gala'} · ${t.so_khach} khách`,
      link: `/staff/tiec/${idTiec}`, mucDo: 'quan_trong',
    });
  }
  return { ok: true, them: moi.length };
}

async function goNhanSu(idTiec, idNs, { phien, hoSo }) {
  await damBaoCauTruc();
  const [[s]] = await db.query('SELECT * FROM tiec_nhan_su WHERE id = ? AND dat_tiec_id = ?', [idNs, idTiec]);
  if (!s) throw new LoiDieuHanh('Không tìm thấy.', 404);
  const q = nhomCua(phien, hoSo);
  const vt = VAI_TRO_NS[s.vai_tro] || {};
  if (!q.dieuHanh && !q.nhom.includes(vt.nhomQuyen)) throw new LoiDieuHanh('Bạn không có quyền gỡ phân công này.', 403);
  await db.query('DELETE FROM tiec_nhan_su WHERE id = ?', [idNs]);
  return { ok: true };
}

// ------------------------------------------------------------- quet thong bao
async function quet(now = new Date()) {
  await damBaoTatCa();
  const tb = require('./thongBaoService');
  const [vs] = await db.query(
    `SELECT v.*, t.ma_tiec, t.so_khach, DATE_FORMAT(t.ngay_to_chuc, '%d/%m') AS ngay_hien, TIME_FORMAT(t.gio_bat_dau, '%H:%i') AS gio
       FROM tiec_viec v JOIN dat_tiec t ON t.id = v.dat_tiec_id
      WHERE v.trang_thai <> 'xong' AND t.trang_thai IN ('DA_XAC_NHAN','DA_COC','CHO_THANH_TOAN')
        AND v.mo_luc <= ? AND (v.da_bao_mo = 0 OR v.da_nhac = 0 OR v.da_leo_thang = 0)`, [sqlDt(now)]);
  // 1. Viec moi mo: gom theo tiec + nhom -> mot thong bao.
  const moi = {};
  for (const v of vs.filter((x) => !x.da_bao_mo)) (moi[`${v.dat_tiec_id}|${v.nhom}`] = moi[`${v.dat_tiec_id}|${v.nhom}`] || []).push(v);
  for (const ds of Object.values(moi)) {
    const v0 = ds[0];
    const nvPhan = await nhanSuTheoNhom(v0.dat_tiec_id, v0.nhom);
    await tb.gui('tiec_viec_moi', {
      nhom: NHOM_VIEC[v0.nhom].nhan, nv: nvPhan,
      tieuDe: `Tiệc ${v0.ma_tiec} (${v0.ngay_hien} ${v0.gio}) – ${ds.length} việc chuẩn bị ${v0.moc}`,
      noiDung: ds.map((x) => `• ${x.ten} (hạn ${fmt(x.han)})`).join('\n'), link: `/staff/tiec/${v0.dat_tiec_id}`,
    });
    await db.query('UPDATE tiec_viec SET da_bao_mo = 1 WHERE id IN (?)', [ds.map((x) => x.id)]);
  }
  // 2. Qua han: nhac nhom; viec trong ngay tiec -> bao luon Quan ly + Giam sat.
  for (const v of vs.filter((x) => !x.da_nhac && new Date(x.han) < now)) {
    const gap = v.moc === 'Ngày tiệc';
    await tb.gui('tiec_viec_tre', {
      nhom: gap ? [...new Set([...NHOM_VIEC[v.nhom].nhan, 'QUAN_LY', 'GIAM_SAT_PV'])] : NHOM_VIEC[v.nhom].nhan,
      nv: await nhanSuTheoNhom(v.dat_tiec_id, v.nhom),
      tieuDe: `Quá hạn: "${v.ten}" – tiệc ${v.ma_tiec} (${v.ngay_hien} ${v.gio})`,
      noiDung: `Hạn ${fmt(v.han)}. Phụ trách: ${NHOM_VIEC[v.nhom].ten}.`, link: `/staff/tiec/${v.dat_tiec_id}`, mucDo: gap ? 'khan' : 'quan_trong',
    });
    await db.query('UPDATE tiec_viec SET da_nhac = 1, da_leo_thang = ? WHERE id = ?', [gap ? 1 : 0, v.id]);
  }
  // 3. Leo thang: qua han + 12h van chua xong -> Quan ly.
  for (const v of vs.filter((x) => x.da_nhac && !x.da_leo_thang && now - new Date(x.han) > LEO_THANG_GIO * GIO)) {
    await tb.gui('tiec_viec_tre', {
      nhom: ['QUAN_LY'], tieuDe: `Leo thang: "${v.ten}" trễ hơn ${LEO_THANG_GIO} giờ – tiệc ${v.ma_tiec}`,
      noiDung: `Phụ trách ${NHOM_VIEC[v.nhom].ten}, hạn ${fmt(v.han)}. Tiệc ${v.ngay_hien} ${v.gio}, ${v.so_khach} khách.`, link: `/staff/tiec/${v.dat_tiec_id}`, mucDo: 'khan',
    });
    await db.query('UPDATE tiec_viec SET da_leo_thang = 1 WHERE id = ?', [v.id]);
  }
  // 4. Tiec da het gio ma chua chot hoa don.
  const { daBao } = require('./thongBaoNghiepVu');
  const [het] = await db.query(
    `SELECT ${COT_TIEC} ${JOIN_TIEC} WHERE t.trang_thai IN ('DA_XAC_NHAN','DA_COC') AND t.ngay_to_chuc BETWEEN CURDATE() - INTERVAL 7 DAY AND CURDATE()`);
  for (const t of het) {
    if (pha(t, now).ma !== 'da_ket_thuc') continue;
    if (await daBao(`tiec_het_gio:${t.id}`)) continue;
    await tb.gui('tiec_can_chot', {
      tieuDe: `Tiệc ${t.ma_tiec} đã kết thúc – cần chốt hóa đơn`,
      noiDung: `${t.ho_ten} · ${t.so_khach} khách. Chốt tổng thực tế để khách thanh toán phần còn lại.`, link: `/staff/tiec/${t.id}#chot`,
    });
  }
}

async function nhanSuTheoNhom(idTiec, nhom) {
  const vt = (NHOM_VIEC[nhom] || {}).phanCong;
  if (!vt) return [];
  const [r] = await db.query('SELECT id_nv FROM tiec_nhan_su WHERE dat_tiec_id = ? AND vai_tro IN (?)', [idTiec, vt]);
  return r.map((x) => x.id_nv);
}
const fmt = (d) => { const x = new Date(d); return `${p2(x.getHours())}:${p2(x.getMinutes())} ${p2(x.getDate())}/${p2(x.getMonth() + 1)}`; };

module.exports = {
  damBaoCauTruc, damBaoViec, damBaoTatCa, bangTongHop, chiTiet, capNhatViec, themNhanSu, goNhanSu, quet,
  nhomCua, pha, khungGio, mauViec, dinhMuc, NHOM_VIEC, VAI_TRO_NS, LoiDieuHanh, DANG_CHAY_TIEC: DANG_CHAY,
};
