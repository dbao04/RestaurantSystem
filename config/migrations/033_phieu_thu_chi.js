/**
 * Migration 033 - PHIEU THU / PHIEU CHI cua thu ngan.
 *
 * Chay: node config/migrations/033_phieu_thu_chi.js   (npm run thuchi:setup)
 * Idempotent.
 *
 * Tien ban hang, dat coc, hoan tien da co trong `payments`. Bang nay ghi phan
 * con lai: tien RA khoi ket (mua da, gas, nguyen lieu gap, tam ung...) va tien
 * VAO ngoai ban hang (thanh ly vo chai, khach boi thuong...). Khong co phieu
 * nay thi bien ban chot ca luon lech dung bang so tien da chi.
 *
 * KHONG XOA phieu - chi HUY kem ly do, nguoi huy, thoi diem. So quy phai truy
 * duoc: mot phieu chi 2.000.000d "bien mat" la dieu ke toan can nhin thay.
 */
const db = require('../db');

async function coBang(ten) {
  const [rows] = await db.query(
    'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [ten]);
  return rows.length > 0;
}

async function main() {
  console.log('Migration 033 - phiếu thu / phiếu chi');
  if (!(await coBang('phieu_thu_chi'))) {
    await db.query(`
      CREATE TABLE phieu_thu_chi (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ma_phieu VARCHAR(20) NOT NULL UNIQUE,
        loai ENUM('thu','chi') NOT NULL,
        danh_muc VARCHAR(30) NOT NULL,
        so_tien DECIMAL(14,2) NOT NULL,
        phuong_thuc ENUM('tien_mat','chuyen_khoan') NOT NULL DEFAULT 'tien_mat',
        doi_tuong VARCHAR(150) NULL COMMENT 'Nguoi nop / nguoi nhan / nha cung cap',
        noi_dung VARCHAR(500) NOT NULL,
        so_chung_tu VARCHAR(60) NULL COMMENT 'So hoa don, bien nhan kem theo',
        thoi_diem DATETIME NOT NULL,
        id_nv INT NULL COMMENT 'Nguoi lap phieu (NULL = quan tri)',
        trang_thai ENUM('hop_le','da_huy') NOT NULL DEFAULT 'hop_le',
        ly_do_huy VARCHAR(300) NULL,
        huy_boi INT NULL,
        huy_luc DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_thoi_diem (thoi_diem, trang_thai),
        KEY idx_nv (id_nv, thoi_diem)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }
  console.log('Migration 033 hoàn tất.');
  await db.end();
}

if (require.main === module) {
  main().catch((e) => { console.error('Migration 033 lỗi:', e.message); process.exitCode = 1; });
}
module.exports = { main };
