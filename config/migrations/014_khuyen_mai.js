/**
 * Migration 014 - KHUYEN MAI dieu chinh duoc.
 *
 * Bang `discount_codes` cu chi cho chinh 6 thu: loai giam, gia tri, tran giam,
 * don toi thieu, so luot, khoang ngay. Thuc te nha hang can dieu chinh nhieu
 * hon the:
 *   - "giam 20% mon nuong, chi thu 2 den thu 5"      -> khong gioi han duoc mon
 *   - "khung gio vang 14h-17h"                       -> khong co khung gio
 *   - "moi khach chi dung 1 lan"                     -> chi dem duoc tong luot
 *   - "chi khach hang Vang tro len"                  -> khong loc duoc hang
 *   - "chi ap khi khach tu quet QR tai ban"          -> khong tach duoc kenh
 * va khong co cach nao biet ma nao dang chay tot vi current_usage chi la mot
 * con so dem, khong luu ai dung - luc nao - giam bao nhieu.
 *
 * Migration nay bo sung cac cot dieu kien do va tao bang `discount_usages`
 * (nhat ky tung luot dung) de vua chan duoc gioi han theo khach, vua co so
 * lieu bao cao hieu qua tung chuong trinh.
 *
 * Chay lai duoc nhieu lan: moi lenh deu kiem tra ton tai truoc khi tac dong.
 */
const db = require('../db');

/** Them cot neu chua co - INFORMATION_SCHEMA de tranh loi 1060 khi chay lai. */
async function themCot(bang, cot, dinhNghia) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [bang, cot]
  );
  if (Number(rows[0].n) > 0) {
    console.log(`  = ${bang}.${cot} da co`);
    return false;
  }
  await db.query(`ALTER TABLE \`${bang}\` ADD COLUMN \`${cot}\` ${dinhNghia}`);
  console.log(`  + ${bang}.${cot}`);
  return true;
}

async function main() {
  console.log('=== Migration 014: khuyen mai dieu chinh duoc ===\n');

  // --- 0. Bang goc phai ton tai (neu chua chay migrate.js) -----------------
  await db.query(`
    CREATE TABLE IF NOT EXISTS discount_codes (
      id INT PRIMARY KEY AUTO_INCREMENT,
      code VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      discount_type ENUM('percentage', 'fixed_amount') DEFAULT 'percentage',
      discount_value DECIMAL(10, 2) NOT NULL,
      max_usage INT,
      current_usage INT DEFAULT 0,
      valid_from DATETIME NOT NULL,
      valid_until DATETIME NOT NULL,
      min_order_value DECIMAL(10, 2),
      max_discount_amount DECIMAL(10, 2),
      is_active BOOLEAN DEFAULT TRUE,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      INDEX idx_code (code),
      INDEX idx_active (is_active),
      INDEX idx_valid (valid_from, valid_until)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci
  `);

  // --- 1. Cac cot dieu kien moi --------------------------------------------
  console.log('[1/3] Bo sung cot dieu kien cho discount_codes');

  await themCot('discount_codes', 'ten', "VARCHAR(150) NULL COMMENT 'Ten chuong trinh hien cho khach'");

  // Pham vi: giam tren ca don, hay chi tren mot so loai mon / mon cu the.
  // `pham_vi_ids` la CSV id de khong phai them bang phu cho mot tinh nang
  // ma so luong phan tu luon rat nho (vai chuc id la cung).
  await themCot('discount_codes', 'pham_vi', "ENUM('tat_ca','loai_mon','mon') NOT NULL DEFAULT 'tat_ca'");
  await themCot('discount_codes', 'pham_vi_ids', "VARCHAR(500) NULL COMMENT 'CSV id_loai hoac id_mon'");

  // Khung thoi gian trong tuan / trong ngay.
  // `ap_dung_thu` dung dung quy uoc DAYOFWEEK cua MySQL: 1=CN ... 7=T7, de
  // khong phai quy doi qua lai giua JS getDay() va SQL.
  await themCot('discount_codes', 'ap_dung_thu', "VARCHAR(20) NULL COMMENT 'CSV 1..7 theo DAYOFWEEK, rong = moi ngay'");
  await themCot('discount_codes', 'gio_bat_dau', 'TIME NULL');
  await themCot('discount_codes', 'gio_ket_thuc', 'TIME NULL');

  // Gioi han theo tung khach + hang thanh vien toi thieu.
  await themCot('discount_codes', 'gioi_han_moi_khach', "INT NULL COMMENT 'So luot toi da moi khach hang'");
  await themCot('discount_codes', 'hang_toi_thieu', "VARCHAR(20) NULL COMMENT 'bronze|silver|gold|platinum'");

  // Kenh ap dung + do uu tien khi co nhieu ma cung thoa.
  await themCot('discount_codes', 'kenh', "ENUM('tat_ca','quay','khach_qr') NOT NULL DEFAULT 'tat_ca'");
  await themCot('discount_codes', 'do_uu_tien', "INT NOT NULL DEFAULT 0 COMMENT 'Cao hon duoc goi y truoc'");
  await themCot('discount_codes', 'hien_thi_khach', "TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Co goi y cho thu ngan/khach khong'");

  // --- 2. Nhat ky tung luot dung -------------------------------------------
  console.log('\n[2/3] Tao bang discount_usages');
  await db.query(`
    CREATE TABLE IF NOT EXISTS discount_usages (
      id INT PRIMARY KEY AUTO_INCREMENT,
      discount_id INT NOT NULL,
      code VARCHAR(50) NOT NULL,
      id_kh INT NULL,
      sesis VARCHAR(50) NULL,
      payment_id INT NULL,
      so_tien_giam DECIMAL(12, 2) NOT NULL DEFAULT 0,
      gia_tri_don DECIMAL(12, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      /* Mot phien thanh toan chi duoc ghi mot luot. Webhook ngan hang va thu
         ngan bam xac nhan thu cong co the cung goi vao hau ky; khoa duy nhat
         nay la chot cuoi de khong dem trung luot dung. */
      UNIQUE KEY uq_payment (payment_id),
      INDEX idx_ma_khach (discount_id, id_kh),
      INDEX idx_code (code),
      INDEX idx_sesis (sesis)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci
  `);
  console.log('  + discount_usages');

  // --- 3. Dat ten cho cac ma cu --------------------------------------------
  console.log('\n[3/3] Dat ten mac dinh cho ma chua co ten');
  const [kq] = await db.query(
    `UPDATE discount_codes
     SET ten = LEFT(COALESCE(NULLIF(TRIM(description), ''), code), 150)
     WHERE ten IS NULL OR ten = ''`
  );
  console.log(`  ~ ${kq.affectedRows} ma duoc dat ten`);

  console.log('\n=== Xong migration 014 ===');
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('LOI migration 014:', e); process.exit(1); });
