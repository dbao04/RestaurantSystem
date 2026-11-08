/**
 * Migration 038 - DAT TIEC CHI TIET: tien coc that, chinh sach huy/hoan tien,
 * may trang thai + lich su, ghi nhan thanh toan nhieu lan.
 *
 * Chay: node config/migrations/038_dat_tiec_chi_tiet.js   (npm run dattiec:chitiet)
 * Idempotent: ALTER/CREATE deu co kiem tra ton tai truoc, INSERT IGNORE cho cau hinh.
 *
 * Truoc migration nay, `dat_tiec` chi la mot form "lead" - khong luu tien coc
 * that, khong co chinh sach hoan tien, trang thai doi tuy y (HOAN_THANH -> MOI
 * van duoc), khong co lich su thay doi. Migration nay bo sung:
 *
 * 1. `dat_tiec` them cot: tien_coc, da_coc, ly_do_huy, nguoi_huy, so_tien_hoan.
 * 2. `dat_tiec_lich_su`  - nhat ky doi trang thai (giong reservation_history).
 * 3. `dat_tiec_thanh_toan` - moi lan thu coc/thanh toan (cho phep thu nhieu lan).
 * 4. `dat_tiec_cau_hinh` - ty le coc, han coc, moc ngay + % hoan tien khi huy.
 */
const db = require('../db');

async function coCot(bang, cot) {
  const [rows] = await db.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [bang, cot]);
  return rows.length > 0;
}

async function themCot(bang, cot, dinhNghia) {
  if (!(await coCot(bang, cot))) {
    await db.query(`ALTER TABLE \`${bang}\` ADD COLUMN \`${cot}\` ${dinhNghia}`);
    console.log(`[038] them cot ${bang}.${cot}`);
  }
}

(async () => {
  try {
    await themCot('dat_tiec', 'tien_coc', "DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'So tien coc yeu cau, tinh theo ty_le_coc luc tao/sua don'");
    await themCot('dat_tiec', 'da_coc', "DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Tong da thu, cong don tu dat_tiec_thanh_toan'");
    await themCot('dat_tiec', 'ly_do_huy', "VARCHAR(255) NULL");
    await themCot('dat_tiec', 'nguoi_huy', "ENUM('KHACH','NHA_HANG') NULL COMMENT 'Ai la nguoi chu dong huy - anh huong ty le hoan coc'");
    await themCot('dat_tiec', 'so_tien_hoan', "DECIMAL(12,2) NULL COMMENT 'So tien coc duoc hoan khi huy, tinh theo chinh sach'");

    // Backfill don cu: gia dinh ty le coc mac dinh 30% cho don chua co tien_coc.
    await db.query(
      `UPDATE dat_tiec SET tien_coc = ROUND(tong_du_toan * 0.3 / 1000) * 1000
        WHERE tien_coc = 0 AND tong_du_toan > 0`);
    console.log('[038] backfill tien_coc = 30% tong_du_toan cho don cu');

    await db.query(`CREATE TABLE IF NOT EXISTS dat_tiec_lich_su (
      id INT AUTO_INCREMENT PRIMARY KEY,
      dat_tiec_id INT NOT NULL,
      tu_trang_thai VARCHAR(20) NULL,
      den_trang_thai VARCHAR(20) NOT NULL,
      ghi_chu VARCHAR(500) NULL,
      nguoi_doi INT NULL COMMENT 'nhan_vien.id_nv - NULL nghia la he thong/khach tu lam',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_dtls_don (dat_tiec_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    console.log('[038] bang dat_tiec_lich_su');

    await db.query(`CREATE TABLE IF NOT EXISTS dat_tiec_thanh_toan (
      id INT AUTO_INCREMENT PRIMARY KEY,
      dat_tiec_id INT NOT NULL,
      so_tien DECIMAL(12,2) NOT NULL,
      phuong_thuc ENUM('TIEN_MAT','CHUYEN_KHOAN','QUET_QR','THE') NOT NULL DEFAULT 'TIEN_MAT',
      ma_giao_dich VARCHAR(100) NULL,
      ghi_chu VARCHAR(300) NULL,
      nguoi_ghi_nhan INT NULL COMMENT 'nhan_vien.id_nv',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_dttt_don (dat_tiec_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    console.log('[038] bang dat_tiec_thanh_toan');

    await db.query(`CREATE TABLE IF NOT EXISTS dat_tiec_cau_hinh (
      setting_key VARCHAR(60) NOT NULL PRIMARY KEY,
      setting_value VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    const thamSo = [
      // % du toan phai coc truoc de giu sanh.
      ['ty_le_coc', '30'],
      // Huy truoc >= so ngay nay thi hoan 100% tien coc.
      ['hoan_tien_som_ngay', '7'],
      // Huy truoc >= so ngay nay (nhung < hoan_tien_som_ngay) thi hoan theo % giua.
      ['hoan_tien_giua_ngay', '3'],
      ['hoan_tien_giua_phan_tram', '50'],
      // Duoi hoan_tien_giua_ngay: khong hoan coc.
    ];
    for (const [khoa, gt] of thamSo) {
      await db.query('INSERT IGNORE INTO dat_tiec_cau_hinh (setting_key, setting_value) VALUES (?, ?)', [khoa, gt]);
    }
    console.log('[038] cau hinh dat_tiec_cau_hinh (ty_le_coc, chinh sach hoan tien)');

    // Moi don da DA_COC truoc migration: coi nhu da coc du 100% tien_coc hien tai,
    // de khong bi UI bao "con thieu coc" cho don thuc ra da thu roi.
    await db.query(`UPDATE dat_tiec SET da_coc = tien_coc WHERE trang_thai IN ('DA_COC','HOAN_THANH') AND da_coc = 0`);
    console.log('[038] backfill da_coc cho don da DA_COC/HOAN_THANH truoc migration');

    // Ghi lai moc khoi diem lich su cho cac don da ton tai, de trang chi tiet
    // khong bi "tro trui" lich su doi voi don tao truoc migration nay.
    await db.query(
      `INSERT INTO dat_tiec_lich_su (dat_tiec_id, tu_trang_thai, den_trang_thai, ghi_chu, nguoi_doi, created_at)
       SELECT t.id, NULL, t.trang_thai, 'Khoi tao lich su (du lieu truoc khi co tinh nang theo doi chi tiet)', t.nhan_vien_xu_ly, t.created_at
         FROM dat_tiec t
        WHERE NOT EXISTS (SELECT 1 FROM dat_tiec_lich_su h WHERE h.dat_tiec_id = t.id)`);
    console.log('[038] khoi tao lich su cho don tao truoc migration');

    console.log('[038] Xong.');
    process.exit(0);
  } catch (e) {
    console.error('[038] Loi:', e.message);
    process.exit(1);
  }
})();
