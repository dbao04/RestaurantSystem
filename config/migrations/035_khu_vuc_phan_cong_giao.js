/**
 * Migration 035 - KHU VUC GIAO HANG theo quan + TU DONG PHAN DON cho shipper.
 *
 * Chay: node config/migrations/035_khu_vuc_phan_cong_giao.js   (npm run giaohang:tudong)
 * Idempotent: khong ghi de ranh gioi / tham so quan tri da chinh.
 *
 * - khu_vuc_giao: da giac ranh gioi Go Vap, Binh Thanh, Quan 12 (GAN DUNG).
 * - phan_cong_giao: MOI lan phan don (tu dong / tay), ket qua (nhan, tu choi,
 *   het han, bi go) va DIEM luc chon - tra loi duoc "vi sao don nay vao tay A".
 * - don_giao_hang + ma_khu_vuc, phan_tu_dong, xac_nhan_luc.
 * - cau_hinh: bat/tat tu dong, tieu chi chia, so phut cho shipper xac nhan...
 */
const db = require('../db');

async function coBang(t) {
  const [r] = await db.query('SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [t]);
  return r.length > 0;
}
async function coCot(t, c) {
  const [r] = await db.query('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [t, c]);
  return r.length > 0;
}

// Ranh gioi gan dung [vi_do, kinh_do]. Canh chung giua cac quan dung CHUNG dinh
// de khong co khe ho hay vung chong lan o ranh gioi.
const GV = [
  [10.8270, 106.6400], [10.8420, 106.6350], [10.8530, 106.6460], [10.8560, 106.6620],
  [10.8560, 106.6800], [10.8590, 106.6920], [10.8480, 106.7020], [10.8360, 106.7040],
  [10.8270, 106.6960], [10.8170, 106.6920], [10.8140, 106.6870], [10.8110, 106.6790],
  [10.8150, 106.6650], [10.8210, 106.6510],
];
const BT = [
  [10.8140, 106.6870], [10.8170, 106.6920], [10.8270, 106.6960], [10.8360, 106.7040],
  [10.8330, 106.7150], [10.8300, 106.7260], [10.8180, 106.7330], [10.8050, 106.7290],
  [10.7980, 106.7230], [10.7900, 106.7140], [10.7870, 106.7040], [10.7920, 106.6950],
  [10.8000, 106.6880], [10.8080, 106.6860],
];
const Q12 = [
  [10.8420, 106.6350], [10.8350, 106.6230], [10.8440, 106.6100], [10.8600, 106.6050],
  [10.8800, 106.6100], [10.8950, 106.6300], [10.8980, 106.6600], [10.8900, 106.6900],
  [10.8820, 106.7150], [10.8680, 106.7180], [10.8590, 106.6920], [10.8560, 106.6800],
  [10.8560, 106.6620], [10.8530, 106.6460],
];

const KHU = [
  { ma: 'GV', ten: 'Gò Vấp', mau: '#c8a24b', thu_tu: 1, da_giac: GV },
  { ma: 'BT', ten: 'Bình Thạnh', mau: '#2b5f8a', thu_tu: 2, da_giac: BT },
  { ma: 'Q12', ten: 'Quận 12', mau: '#1f7a4a', thu_tu: 3, da_giac: Q12 },
];

const THAM_SO = [
  ['giao_hang.chi_trong_khu_vuc', '1', 'Chỉ nhận đơn có địa chỉ nằm trong các khu vực giao hàng đang bật'],
  ['giao_hang.tu_dong_phan', '1', 'Tự động phân đơn giao cho shipper'],
  ['giao_hang.tieu_chi_chia', 'so_don', 'Chia đều theo: so_don (số đơn trong ngày) | thu_nhap (tổng phí ship trong ngày)'],
  ['giao_hang.phut_cho_xac_nhan', '3', 'Số phút shipper phải bấm Nhận đơn, quá hạn tự chuyển người khác'],
  ['giao_hang.phut_mat_tin_hieu', '10', 'GPS cũ hơn số phút này coi như shipper đang offline (bị xếp sau)'],
];

async function main() {
  console.log('Migration 035 - khu vực giao hàng & tự động phân đơn');

  if (!(await coBang('khu_vuc_giao'))) {
    await db.query(`
      CREATE TABLE khu_vuc_giao (
        id_kv INT AUTO_INCREMENT PRIMARY KEY,
        ma VARCHAR(10) NOT NULL UNIQUE,
        ten VARCHAR(80) NOT NULL,
        da_giac LONGTEXT NOT NULL COMMENT 'JSON [[vi_do, kinh_do], ...]',
        bat TINYINT(1) NOT NULL DEFAULT 1,
        mau VARCHAR(20) NOT NULL DEFAULT '#c8a24b',
        thu_tu INT NOT NULL DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }
  for (const k of KHU) {
    // INSERT IGNORE: chay lai khong ghi de da giac quan tri da chinh tay.
    await db.query('INSERT IGNORE INTO khu_vuc_giao (ma, ten, da_giac, mau, thu_tu) VALUES (?, ?, ?, ?, ?)',
      [k.ma, k.ten, JSON.stringify(k.da_giac), k.mau, k.thu_tu]);
  }

  if (!(await coBang('phan_cong_giao'))) {
    await db.query(`
      CREATE TABLE phan_cong_giao (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_giao INT NOT NULL,
        id_shipper INT NOT NULL,
        kieu ENUM('tu_dong','thu_cong') NOT NULL,
        ket_qua ENUM('cho_xac_nhan','da_nhan','tu_choi','het_han','bi_go') NOT NULL DEFAULT 'cho_xac_nhan',
        ly_do_chon VARCHAR(300) NULL,
        ly_do_ket_thuc VARCHAR(300) NULL,
        tao_luc DATETIME NOT NULL,
        phan_hoi_luc DATETIME NULL,
        KEY idx_giao (id_giao),
        KEY idx_shipper_ngay (id_shipper, tao_luc)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  if (!(await coCot('don_giao_hang', 'ma_khu_vuc'))) await db.query('ALTER TABLE don_giao_hang ADD COLUMN ma_khu_vuc VARCHAR(10) NULL');
  if (!(await coCot('don_giao_hang', 'phan_tu_dong'))) await db.query('ALTER TABLE don_giao_hang ADD COLUMN phan_tu_dong TINYINT(1) NOT NULL DEFAULT 0');
  if (!(await coCot('don_giao_hang', 'xac_nhan_luc'))) await db.query('ALTER TABLE don_giao_hang ADD COLUMN xac_nhan_luc DATETIME NULL');

  for (const [k, v, m] of THAM_SO) {
    await db.query('INSERT IGNORE INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES (?, ?, ?)', [k, v, m]);
  }
  console.log('Migration 035 hoàn tất.');
  await db.end();
}

if (require.main === module) {
  main().catch((e) => { console.error('Migration 035 lỗi:', e.message); process.exitCode = 1; });
}
module.exports = { main, KHU };
