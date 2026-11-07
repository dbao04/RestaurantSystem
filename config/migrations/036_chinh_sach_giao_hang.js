/**
 * Migration 036 - CHINH SACH GIAO HANG: thanh toan truoc 100%, phi ship bac
 * thang theo km, va chinh sach huy don / hoan diem.
 *
 * Chay: node config/migrations/036_chinh_sach_giao_hang.js   (npm run giaohang:chinhsach)
 * Idempotent: chay lai khong hong gi, khong ghi de tham so quan tri da chinh.
 *
 * - don_giao_hang.trang_thai them 'cho_thanh_toan' (don moi dat, chua tra tien:
 *   bep KHONG nau, shipper KHONG duoc phan).
 * - don_giao_hang + ben_loi, ma_ly_do (ai co loi khi huy), da_thanh_toan,
 *   diem_hoan, han_thanh_toan.
 * - hoan_diem_giao_hang: moi lan hoan diem cho khach (toan phan / mot phan).
 * - cau_hinh: bac giam phi theo km, so phut giu don cho thanh toan, ty le hoan diem.
 */
const db = require('../db');

async function coCot(t, c) {
  const [r] = await db.query('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [t, c]);
  return r.length > 0;
}

(async () => {
  try {
    await db.query(`ALTER TABLE don_giao_hang MODIFY trang_thai
      ENUM('cho_thanh_toan','cho_phan','da_phan','dang_lay','dang_giao','da_giao','that_bai','huy')
      NOT NULL DEFAULT 'cho_phan'`);
    console.log('[036] trang_thai: them cho_thanh_toan');

    const cot = [
      ['ben_loi', "ENUM('khach','nha_hang') NULL COMMENT 'Ai co loi khi don bi huy'"],
      ['ma_ly_do', "VARCHAR(40) NULL COMMENT 'Ma ly do huy trong chinhSachGiaoService.LY_DO_HUY'"],
      ['da_thanh_toan', "DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'So tien khach da tra truoc'"],
      ['diem_hoan', "INT NOT NULL DEFAULT 0 COMMENT 'Tong diem da hoan cho don nay'"],
      ['han_thanh_toan', "DATETIME NULL COMMENT 'Qua han ma chua tra thi tu huy'"],
    ];
    for (const [ten, kieu] of cot) {
      if (!(await coCot('don_giao_hang', ten))) {
        await db.query(`ALTER TABLE don_giao_hang ADD COLUMN ${ten} ${kieu}`);
        console.log('[036] them cot don_giao_hang.' + ten);
      }
    }

    await db.query(`CREATE TABLE IF NOT EXISTS hoan_diem_giao_hang (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_giao INT NOT NULL,
      sesis VARCHAR(191) NOT NULL,
      id_kh INT NOT NULL,
      loai ENUM('toan_phan','mot_phan') NOT NULL,
      so_tien DECIMAL(12,2) NOT NULL COMMENT 'Gia tri quy doi ra tien',
      so_diem INT NOT NULL,
      ma_ly_do VARCHAR(40) NULL,
      ly_do VARCHAR(300) NULL,
      id_nv INT NULL,
      ten_nguoi VARCHAR(120) NULL,
      tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_hdg_giao (id_giao),
      KEY idx_hdg_kh (id_kh)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    console.log('[036] bang hoan_diem_giao_hang');

    const thamSo = [
      // Tu km thu `tu_km` tro di, moi km chi tinh `he_so` x gia/km cua don vi.
      ['giao_hang.bac_giam_km', JSON.stringify([{ tu_km: 5, he_so: 0.8 }, { tu_km: 8, he_so: 0.6 }])],
      ['giao_hang.phut_giu_thanh_toan', '15'],
      ['giao_hang.ty_le_hoan_diem', '100'],
    ];
    for (const [khoa, gt] of thamSo) {
      await db.query('INSERT IGNORE INTO cau_hinh (khoa, gia_tri) VALUES (?, ?)', [khoa, gt]);
    }
    console.log('[036] tham so cau_hinh');

    // Don cu dang cho thu ho (COD) giu nguyen - chinh sach moi chi ap cho don moi.
    console.log('[036] Xong.');
    process.exit(0);
  } catch (e) {
    console.error('[036] Loi:', e.message);
    process.exit(1);
  }
})();
