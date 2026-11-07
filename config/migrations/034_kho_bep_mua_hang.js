/**
 * Migration 034 - KHO BEP: phieu xuat (hu hong, hao hut...), don mua hang NVL.
 *
 * Chay: node config/migrations/034_kho_bep_mua_hang.js   (npm run khobep:setup)
 * Idempotent.
 *
 * - phieu_xuat: chung tu xuat kho NGOAI ban hang. Truoc day `xuat_kho` chi co
 *   ly_do 'ban_hang' -> khong ai biet bep vut bo bao nhieu ca hoi hong.
 * - xuat_kho + id_px, gia_tri: noi dong xuat voi phieu va luu gia tri luc xuat
 *   (gia von doi theo thoi gian - phai chup lai luc xuat moi tinh dung).
 * - phieu_nhap + id_dmh, thoi_diem: phieu nhap sinh tu don mua hang.
 * - don_mua_hang / chi_tiet_don_mua: quy trinh de xuat -> duyet -> dat -> nhan.
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
async function coChiMuc(t, ten) {
  const [r] = await db.query('SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?', [t, ten]);
  return r.length > 0;
}

async function main() {
  console.log('Migration 034 - kho bếp & mua hàng NVL');

  if (!(await coBang('phieu_xuat'))) {
    await db.query(`
      CREATE TABLE phieu_xuat (
        id_px INT AUTO_INCREMENT PRIMARY KEY,
        ma_phieu VARCHAR(20) NOT NULL UNIQUE,
        ly_do VARCHAR(30) NOT NULL,
        id_nv INT NULL,
        thoi_diem DATETIME NOT NULL,
        tong_gia_tri DECIMAL(14,2) NOT NULL DEFAULT 0,
        ghi_chu VARCHAR(500) NULL,
        KEY idx_ly_do (ly_do, thoi_diem)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }
  if (!(await coCot('xuat_kho', 'id_px'))) await db.query('ALTER TABLE xuat_kho ADD COLUMN id_px INT NULL');
  if (!(await coCot('xuat_kho', 'gia_tri'))) await db.query('ALTER TABLE xuat_kho ADD COLUMN gia_tri DECIMAL(14,2) NULL');
  if (!(await coCot('xuat_kho', 'ghi_chu'))) await db.query('ALTER TABLE xuat_kho ADD COLUMN ghi_chu VARCHAR(255) NULL');
  if (!(await coChiMuc('xuat_kho', 'idx_xk_ly_do_ngay'))) await db.query('CREATE INDEX idx_xk_ly_do_ngay ON xuat_kho (ly_do, ngay_xuat)');
  if (!(await coChiMuc('xuat_kho', 'idx_xk_px'))) await db.query('CREATE INDEX idx_xk_px ON xuat_kho (id_px)');

  // Thong ke thoi gian che bien loc theo bep_ket_thuc - khong co chi muc la quet 110k dong.
  if (!(await coChiMuc('hopdong', 'idx_hopdong_bep_kt'))) await db.query('CREATE INDEX idx_hopdong_bep_kt ON hopdong (bep_ket_thuc)');
  if (!(await coCot('phieu_nhap', 'id_dmh'))) await db.query('ALTER TABLE phieu_nhap ADD COLUMN id_dmh INT NULL');
  if (!(await coCot('phieu_nhap', 'thoi_diem'))) await db.query('ALTER TABLE phieu_nhap ADD COLUMN thoi_diem DATETIME NULL');
  if (!(await coChiMuc('chi_tiet_phieu_nhap', 'idx_ctpn_lo'))) {
    await db.query('CREATE INDEX idx_ctpn_lo ON chi_tiet_phieu_nhap (id_nl, so_luong_con_lai, han_su_dung)');
  }

  if (!(await coBang('don_mua_hang'))) {
    await db.query(`
      CREATE TABLE don_mua_hang (
        id_dmh INT AUTO_INCREMENT PRIMARY KEY,
        ma_don VARCHAR(20) NOT NULL UNIQUE,
        id_ncc INT NULL,
        trang_thai ENUM('nhap','cho_duyet','da_duyet','da_dat','nhan_mot_phan','da_nhan','huy') NOT NULL DEFAULT 'cho_duyet',
        ngay_giao_du_kien DATE NULL,
        tong_tien DECIMAL(14,2) NOT NULL DEFAULT 0,
        ghi_chu VARCHAR(500) NULL,
        id_nv_tao INT NULL,
        id_nv_duyet INT NULL,
        duyet_luc DATETIME NULL,
        ly_do_huy VARCHAR(300) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_tt (trang_thai, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }
  if (!(await coBang('chi_tiet_don_mua'))) {
    await db.query(`
      CREATE TABLE chi_tiet_don_mua (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_dmh INT NOT NULL,
        id_nl INT NOT NULL,
        so_luong DECIMAL(12,3) NOT NULL,
        don_gia DECIMAL(12,2) NOT NULL DEFAULT 0,
        so_luong_da_nhan DECIMAL(12,3) NOT NULL DEFAULT 0,
        KEY idx_dmh (id_dmh)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }
  console.log('Migration 034 hoàn tất.');
  await db.end();
}

if (require.main === module) {
  main().catch((e) => { console.error('Migration 034 lỗi:', e.message); process.exitCode = 1; });
}
module.exports = { main };
