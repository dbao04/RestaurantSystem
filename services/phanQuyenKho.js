/**
 * PHAN QUYEN KHO NGUYEN LIEU - tach nguoi DUNG hang khoi nguoi GIU hang.
 *
 * Truoc day moi trang kho mo cho vai tro cu 'Bep': dau bep, phu bep, tap vu bep
 * deu tu lap phieu nhap / xuat va kiem ke, con chuc danh Thu kho / Nhan vien kho
 * lai khong vao duoc (thukho vao duoc chi vi tai khoan tinh co mang chucvu
 * 'Bep'). Bep vua lay nguyen lieu vua tu ghi so thi that thoat khong ai thay.
 *
 * Phan cong (ma tran chuc_danh_quyen):
 *   kho.xem              Bep, Bar, Kho, Ke toan, Quan ly        xem ton, so kho, phieu
 *   kho.nhap / kho.xuat  THU KHO, NV KHO, Quan ly nha hang      lap phieu nhap / xuat
 *   kho.kiem_ke          THU KHO, NV KHO, Quan ly nha hang      tao phieu, dem
 *   kho.kiem_ke.chot     Quan ly nha hang, Tro ly quan ly       chot chenh lech -> dieu chinh ton
 *   kho.mua.de_xuat      QL bep, Bep truong/pho, Truong bar, Thu kho, Quan ly
 *   kho.mua.duyet        Quan ly nha hang, Tro ly quan ly       (khong tu duyet don minh lap)
 *
 * Chay MOT LAN (moc cau_hinh 'phan_quyen.kho_v2'): sau do quan tri sua ma tran o
 * trang To chuc thi khoi dong lai server khong ghi de.
 */
const db = require('../config/db');

const MOC = 'phan_quyen.kho_v2';

const QUYEN_MOI = [
  ['kho.kiem_ke.chot', 'Chốt kiểm kê (điều chỉnh tồn theo số đếm)', 1, 30],
  ['kho.mua.de_xuat', 'Đề xuất / lập đơn mua nguyên liệu', 0, 31],
  ['kho.mua.duyet', 'Duyệt đơn mua nguyên liệu', 1, 32],
];

// Ma quyen -> DUNG danh sach chuc danh duoc cap (ghi de cho cac quyen nay).
const MA_TRAN = {
  'kho.nhap': ['THUKHO', 'NVKHO', 'QLNH'],
  'kho.xuat': ['THUKHO', 'NVKHO', 'QLNH'],
  'kho.kiem_ke': ['THUKHO', 'NVKHO', 'QLNH'],
  'kho.kiem_ke.chot': ['QLNH', 'TLQL'],
  'kho.mua.de_xuat': ['QLBEP', 'BEPTRUONG', 'BEPPHO', 'TRUONGBAR', 'THUKHO', 'QLNH'],
  'kho.mua.duyet': ['QLNH', 'TLQL'],
};
// Them (khong bot) quyen xem cho bo phan kho / bep.
const THEM_XEM = ['THUKHO', 'NVKHO', 'QLNH', 'TLQL', 'QLBEP', 'BEPTRUONG', 'BEPPHO', 'TOTRUONGBEP',
  'DAUBEP', 'PHUBEP', 'TAPVUBEP', 'TRUONGBAR', 'NVBAR', 'KTTRUONG', 'NVKT'];

async function damBao({ batBuoc = false } = {}) {
  const [[moc]] = await db.query('SELECT gia_tri FROM cau_hinh WHERE khoa = ?', [MOC]);
  if (moc && !batBuoc) return false;

  for (const [ma, ten, nhayCam, thuTu] of QUYEN_MOI) {
    await db.query(
      `INSERT INTO quyen (ma_q, ten_q, nhom_q, la_nhay_cam, thu_tu) VALUES (?, ?, 'Kho', ?, ?)
       ON DUPLICATE KEY UPDATE ten_q = VALUES(ten_q)`, [ma, ten, nhayCam, thuTu]);
  }
  const [cd] = await db.query('SELECT id_cd, ma_cd FROM chuc_danh');
  const idCd = new Map(cd.map((c) => [c.ma_cd, c.id_cd]));
  const idQ = async (ma) => { const [[q]] = await db.query('SELECT id_q FROM quyen WHERE ma_q = ?', [ma]); return q && q.id_q; };

  for (const [ma, dsCd] of Object.entries(MA_TRAN)) {
    const q = await idQ(ma);
    if (!q) continue;
    const ids = dsCd.map((m) => idCd.get(m)).filter(Boolean);
    await db.query(
      `DELETE FROM chuc_danh_quyen WHERE id_q = ?${ids.length ? ' AND id_cd NOT IN (?)' : ''}`,
      ids.length ? [q, ids] : [q]);
    for (const id of ids) {
      await db.query(
        `INSERT INTO chuc_danh_quyen (id_cd, id_q, duoc_cap) VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE duoc_cap = 1`, [id, q]);
    }
  }
  const qXem = await idQ('kho.xem');
  if (qXem) {
    for (const m of THEM_XEM) {
      const id = idCd.get(m);
      if (id) await db.query('INSERT IGNORE INTO chuc_danh_quyen (id_cd, id_q, duoc_cap) VALUES (?, ?, 1)', [id, qXem]);
    }
  }
  await db.query(
    `INSERT INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES (?, '1', 'Đã áp dụng phân quyền kho: thủ kho nhập/xuất/kiểm kê, quản lý chốt & duyệt')
     ON DUPLICATE KEY UPDATE gia_tri = '1'`, [MOC]);
  return true;
}

/**
 * Bo phan Kho KHONG mang vai tro cu 'Bep'. Chuc danh THUKHO tung khai
 * chucvu_legacy = 'Bep' -> ai duoc bo nhiem thu kho cung vao KDS, cong thuc,
 * chot ca bep... (canVaiTroCu so khop nhan_vien.chucvu). Quyen kho da di theo
 * kho.* nen kho chi can 'Nhan vien chung'. Chay MOT LAN (moc rieng).
 */
const MOC_VAI_TRO = 'phan_quyen.kho_v3_vai_tro';
async function damBaoVaiTroKho({ batBuoc = false } = {}) {
  const [[moc]] = await db.query('SELECT gia_tri FROM cau_hinh WHERE khoa = ?', [MOC_VAI_TRO]);
  if (moc && !batBuoc) return 0;
  await db.query(
    "UPDATE chuc_danh SET chucvu_legacy = 'Nhan vien chung' WHERE ma_cd IN ('THUKHO', 'NVKHO') AND chucvu_legacy = 'Bep'");
  const [kq] = await db.query(
    `UPDATE nhan_vien n JOIN chuc_danh cd ON cd.id_cd = n.id_cd
        SET n.chucvu = 'Nhan vien chung'
      WHERE cd.ma_cd IN ('THUKHO', 'NVKHO') AND n.chucvu = 'Bep'`);
  await db.query(
    `INSERT INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES (?, '1', 'Bộ phận Kho bỏ vai trò cũ Bếp (không vào KDS / công thức / chốt ca bếp)')
     ON DUPLICATE KEY UPDATE gia_tri = '1'`, [MOC_VAI_TRO]);
  return kq.affectedRows;
}

/**
 * QUY TRINH DUYET PHIEU NHAP (duyetNhapKhoService): ba quyen cho ba buoc.
 *   kho.nhap.qc          kiem chat luong luc nhan: QL bep, Bep truong/pho, Truong bar, QL nha hang
 *   kho.nhap.doi_chieu   doi chieu hoa don, sua don gia: Ke toan truong, Ke toan vien, QL nha hang
 *   kho.nhap.duyet       duyet cuoi: QL nha hang, Tro ly quan ly (truoc day ca thu kho / QL bep)
 * Chay MOT LAN (moc rieng).
 */
const MOC_NHAP = 'phan_quyen.kho_v4_duyet_nhap';
const QUYEN_NHAP = [
  ['kho.nhap.qc', 'Kiểm tra chất lượng hàng nhập (Đạt / Trả)', 0, 33],
  ['kho.nhap.doi_chieu', 'Đối chiếu phiếu nhập với hóa đơn, sửa đơn giá', 1, 34],
];
const MA_TRAN_NHAP = {
  'kho.nhap.qc': ['QLBEP', 'BEPTRUONG', 'BEPPHO', 'TRUONGBAR', 'QLNH'],
  'kho.nhap.doi_chieu': ['KTTRUONG', 'NVKT', 'QLNH'],
  'kho.nhap.duyet': ['QLNH', 'TLQL'],
};
async function damBaoQuyenNhap({ batBuoc = false } = {}) {
  const [[moc]] = await db.query('SELECT gia_tri FROM cau_hinh WHERE khoa = ?', [MOC_NHAP]);
  if (moc && !batBuoc) return false;
  for (const [ma, ten, nhayCam, thuTu] of QUYEN_NHAP) {
    await db.query(
      `INSERT INTO quyen (ma_q, ten_q, nhom_q, la_nhay_cam, thu_tu) VALUES (?, ?, 'Kho', ?, ?)
       ON DUPLICATE KEY UPDATE ten_q = VALUES(ten_q)`, [ma, ten, nhayCam, thuTu]);
  }
  await db.query("UPDATE quyen SET ten_q = 'Duyệt cuối phiếu nhập kho' WHERE ma_q = 'kho.nhap.duyet'");
  const [cd] = await db.query('SELECT id_cd, ma_cd FROM chuc_danh');
  const idCd = new Map(cd.map((c) => [c.ma_cd, c.id_cd]));
  for (const [ma, dsCd] of Object.entries(MA_TRAN_NHAP)) {
    const [[q]] = await db.query('SELECT id_q FROM quyen WHERE ma_q = ?', [ma]);
    if (!q) continue;
    const ids = dsCd.map((m) => idCd.get(m)).filter(Boolean);
    await db.query(`DELETE FROM chuc_danh_quyen WHERE id_q = ?${ids.length ? ' AND id_cd NOT IN (?)' : ''}`, ids.length ? [q.id_q, ids] : [q.id_q]);
    for (const id of ids) {
      await db.query(
        `INSERT INTO chuc_danh_quyen (id_cd, id_q, duoc_cap) VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE duoc_cap = 1`, [id, q.id_q]);
    }
  }
  await db.query(
    `INSERT INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES (?, '1', 'Đã áp dụng quyền 3 bước duyệt phiếu nhập: QC, đối chiếu, duyệt cuối')
     ON DUPLICATE KEY UPDATE gia_tri = '1'`, [MOC_NHAP]);
  return true;
}

module.exports = { damBao, damBaoVaiTroKho, damBaoQuyenNhap, MA_TRAN, QUYEN_MOI, MA_TRAN_NHAP };
