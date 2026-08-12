/**
 * Migration 012 - Phan he THANH TOAN (VietQR / tien mat / the).
 *
 * Bang `payments` va `payment_methods` da co san trong schema nhung RONG va
 * khong du cot de chay mot luong thanh toan that:
 *   - khong co ma noi dung chuyen khoan  -> khong doi soat duoc voi sao ke
 *   - khong co han hieu luc cua ma QR    -> QR cu van quet duoc, de tra nham don
 *   - khong tach duoc dat coc / tra phan -> khong lam duoc chia bill
 *
 * Migration nay bo sung cac cot do, tao bang `giao_dich_ngan_hang` (hop thu
 * bien dong so du do webhook ngan hang day sang) va nap 3 phuong thuc mac dinh.
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

async function themChiMuc(bang, ten, cot) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [bang, ten]
  );
  if (Number(rows[0].n) > 0) return false;
  await db.query(`ALTER TABLE \`${bang}\` ADD INDEX \`${ten}\` (${cot})`);
  console.log(`  + chi muc ${bang}.${ten}`);
  return true;
}

const PHUONG_THUC_MAC_DINH = [
  {
    name: 'Tiền mặt',
    code: 'tien_mat',
    type: 'cash',
    settings: JSON.stringify({ icon: 'fa-money-bill-wave', mau: '#2e7d4f', tra_lai: true }),
  },
  {
    name: 'Chuyển khoản VietQR',
    code: 'vietqr',
    type: 'online',
    // Tai khoan nhan tien. Sua lai trong /admin/thanh-toan hoac qua .env.
    settings: JSON.stringify({
      icon: 'fa-qrcode',
      mau: '#2b5f8a',
      ma_ngan_hang: process.env.VIETQR_BANK || 'VCB',
      so_tai_khoan: process.env.VIETQR_ACCOUNT || '0011001234567',
      ten_tai_khoan: process.env.VIETQR_NAME || 'NHA HANG BAO DOAN',
      han_giay: 900,
    }),
  },
  {
    name: 'Thẻ ngân hàng (POS)',
    code: 'the',
    type: 'card',
    settings: JSON.stringify({ icon: 'fa-credit-card', mau: '#6b4bb5', can_ma_chuan_chi: true }),
  },
];

async function main() {
  console.log('=== Migration 012: phan he thanh toan ===');

  // --- 1. Mo rong bang payments -------------------------------------------
  console.log('\n[1/4] Mo rong bang `payments`');

  // Ma noi dung chuyen khoan. Day la KHOA DOI SOAT: sinh duy nhat cho tung
  // phien, in vao truong "Noi dung" cua ma VietQR, va la thu duy nhat con lai
  // trong sao ke ngan hang de biet tien nay cua don nao.
  await themCot('payments', 'ma_doi_soat', "VARCHAR(32) DEFAULT NULL COMMENT 'Noi dung CK duy nhat, dung doi soat sao ke'");

  // 'thanh_toan' = tra tien an; 'dat_coc' = tra truoc khi dat ban (chong no-show).
  await themCot('payments', 'loai', "ENUM('thanh_toan','dat_coc') NOT NULL DEFAULT 'thanh_toan'");

  // Nguoi khoi tao: khach tu bam tren dien thoai hay thu ngan bam tai quay.
  await themCot('payments', 'nguon', "ENUM('quay','khach_qr','web','webhook') NOT NULL DEFAULT 'quay'");

  // Tien mat: khach dua bao nhieu, thoi lai bao nhieu (in ra bill).
  await themCot('payments', 'tien_khach_dua', 'DECIMAL(12,2) DEFAULT NULL');
  await themCot('payments', 'tien_thoi_lai', 'DECIMAL(12,2) DEFAULT NULL');
  await themCot('payments', 'tien_tip', 'DECIMAL(12,2) NOT NULL DEFAULT 0');

  // Han hieu luc cua ma QR. Het han thi phien tu chuyen 'failed' - tranh
  // truong hop khach quet lai ma QR cu cua ban truoc va tien vao nham don.
  await themCot('payments', 'het_han_luc', 'DATETIME DEFAULT NULL');
  await themCot('payments', 'thanh_cong_luc', 'DATETIME DEFAULT NULL');

  // Chia bill: ghi lai phien nay tra cho phan nao (mo ta tu do, vd "Khach A").
  await themCot('payments', 'ghi_chu_phan_chia', 'VARCHAR(255) DEFAULT NULL');

  // Luu nguyen payload VietQR de in lai / doi chieu khi can.
  await themCot('payments', 'payload_qr', 'TEXT DEFAULT NULL');

  await themChiMuc('payments', 'idx_ma_doi_soat', '`ma_doi_soat`');
  await themChiMuc('payments', 'idx_loai', '`loai`');

  /*
   * Dong bo collation cua `payments.sesis` voi `hopdong.sesis`.
   *
   * Hai bang nay duoc tao o hai thoi diem khac nhau nen mang hai collation
   * khac nhau CUNG bo ky tu utf8:
   *     hopdong.sesis   utf8_general_ci
   *     payments.sesis  utf8_unicode_ci
   * MySQL chi tu chuyen doi giua hai BO KY TU khac nhau (utf8 <-> utf8mb4),
   * chu KHONG tu chon duoc giua hai collation cua cung mot bo ky tu. Moi cau
   * JOIN payments voi hopdong deu chet ngay:
   *     ER_CANT_AGGREGATE_2COLLATIONS (1267)
   *     Illegal mix of collations for operation '='
   *
   * Vi vay phai sua o tang lieu do thay vi rai COLLATE vao tung cau truy van -
   * cach do se de sot dung mot cho nao do va chi vo ra luc chay that.
   *
   * Nhan tien noi rong 50 -> 255 cho khop `hopdong.sesis`: ma don QR dang
   * 'QR_<ma ban>_<thoi diem>' co the vuot 50 ky tu neu ten ban dai.
   */
  const [colSesis] = await db.query(
    `SELECT COLLATION_NAME, CHARACTER_MAXIMUM_LENGTH AS do_dai
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'sesis'`
  );
  if (colSesis.length && (colSesis[0].COLLATION_NAME !== 'utf8_general_ci' || Number(colSesis[0].do_dai) < 255)) {
    await db.query(
      'ALTER TABLE `payments` MODIFY COLUMN `sesis` VARCHAR(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL'
    );
    console.log(`  ~ payments.sesis: ${colSesis[0].COLLATION_NAME}(${colSesis[0].do_dai}) -> utf8_general_ci(255)`);
  } else {
    console.log('  = payments.sesis da dung collation');
  }

  // --- 2. Hop thu bien dong so du -----------------------------------------
  console.log('\n[2/4] Bang `giao_dich_ngan_hang`');
  await db.query(`
    CREATE TABLE IF NOT EXISTS giao_dich_ngan_hang (
      id INT PRIMARY KEY AUTO_INCREMENT,
      ma_tham_chieu VARCHAR(100) NOT NULL COMMENT 'Ma giao dich ben ngan hang, dung chong trung',
      cong_thanh_toan VARCHAR(50) DEFAULT NULL COMMENT 'Ten ngan hang / gateway gui webhook',
      so_tai_khoan VARCHAR(50) DEFAULT NULL,
      so_tien DECIMAL(12,2) NOT NULL,
      loai ENUM('in','out') NOT NULL DEFAULT 'in',
      noi_dung TEXT DEFAULT NULL COMMENT 'Noi dung chuyen khoan tho tu sao ke',
      thoi_diem DATETIME DEFAULT NULL,
      payment_id INT DEFAULT NULL COMMENT 'Phien thanh toan khop duoc, NULL = chua doi soat',
      trang_thai ENUM('cho_doi_soat','da_khop','khong_khop','bo_qua') NOT NULL DEFAULT 'cho_doi_soat',
      ghi_chu VARCHAR(255) DEFAULT NULL,
      du_lieu_tho LONGTEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_tham_chieu (ma_tham_chieu),
      INDEX idx_trang_thai (trang_thai),
      INDEX idx_payment (payment_id),
      INDEX idx_thoi_diem (thoi_diem)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('  + giao_dich_ngan_hang');

  // --- 2b. Bang cau hinh -----------------------------------------------
  // Dang khoa - gia tri de sua duoc tu giao dien admin ma khong phai sua code
  // va khong phai khoi dong lai server (khac voi de trong .env).
  await db.query(`
    CREATE TABLE IF NOT EXISTS cau_hinh_thanh_toan (
      khoa VARCHAR(64) PRIMARY KEY,
      gia_tri TEXT DEFAULT NULL,
      mo_ta VARCHAR(255) DEFAULT NULL,
      updated_at DATETIME DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const CAU_HINH = [
    ['thue_vat', '0', 'Thuế VAT (%) cộng thêm vào hóa đơn. Để 0 nếu giá món đã gồm VAT'],
    ['phi_phuc_vu', '0', 'Phí phục vụ (%) cộng thêm vào hóa đơn'],
    ['lam_tron', '0', 'Làm tròn tổng tiền lên bội số này (đ). 0 = không làm tròn'],
    ['ty_le_tich_diem', '10000', 'Chi bao nhiêu đồng thì được 1 điểm tích lũy'],
    ['gia_tri_1_diem', '1000', '1 điểm tích lũy đổi được bao nhiêu đồng'],
    ['toi_da_diem_moi_don', '50', 'Số % tối đa của hóa đơn được thanh toán bằng điểm'],
    ['han_qr_giay', '900', 'Mã QR hết hiệu lực sau bao nhiêu giây'],
    ['dat_coc_phan_tram', '20', 'Tỷ lệ đặt cọc (%) khi khách đặt bàn trước'],
    ['webhook_api_key', 'BAODOAN_' + Math.random().toString(36).slice(2, 14).toUpperCase(),
      'Khóa xác thực webhook ngân hàng. Đặt vào header Authorization: Apikey <khóa>'],
    ['tu_dong_doi_soat', '1', 'Tự động ghi nhận thanh toán khi webhook khớp mã đối soát (1/0)'],
  ];
  for (const [khoa, giaTri, moTa] of CAU_HINH) {
    await db.query(
      `INSERT INTO cau_hinh_thanh_toan (khoa, gia_tri, mo_ta, updated_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE mo_ta = VALUES(mo_ta)`,
      [khoa, giaTri, moTa]
    );
  }
  console.log(`  + cau_hinh_thanh_toan (${CAU_HINH.length} khoa)`);

  // --- 3. Nap phuong thuc thanh toan --------------------------------------
  console.log('\n[3/4] Nap phuong thuc thanh toan');
  for (const pt of PHUONG_THUC_MAC_DINH) {
    const [co] = await db.query('SELECT id FROM payment_methods WHERE code = ? LIMIT 1', [pt.code]);
    if (co.length > 0) {
      console.log(`  = ${pt.code} da co (id ${co[0].id})`);
      continue;
    }
    await db.query(
      'INSERT INTO payment_methods (name, code, type, is_active, settings) VALUES (?, ?, ?, 1, ?)',
      [pt.name, pt.code, pt.type, pt.settings]
    );
    console.log(`  + ${pt.code} - ${pt.name}`);
  }

  // --- 4. Ma giam gia mau de demo -----------------------------------------
  console.log('\n[4/4] Ma giam gia mau');
  const MA_MAU = [
    ['BAODOAN10', 'Giảm 10% cho mọi hóa đơn', 'percentage', 10, 200000, 100000],
    ['CHAOBAN50K', 'Giảm 50.000đ cho hóa đơn từ 300.000đ', 'fixed_amount', 50000, 300000, null],
  ];
  for (const [code, mota, loai, giatri, toithieu, tranGiam] of MA_MAU) {
    const [co] = await db.query('SELECT id FROM discount_codes WHERE code = ? LIMIT 1', [code]);
    if (co.length > 0) { console.log(`  = ${code} da co`); continue; }
    await db.query(
      `INSERT INTO discount_codes
        (code, description, discount_type, discount_value, max_usage,
         valid_from, valid_until, min_order_value, max_discount_amount, is_active)
       VALUES (?, ?, ?, ?, NULL, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), ?, ?, 1)`,
      [code, mota, loai, giatri, toithieu, tranGiam]
    );
    console.log(`  + ${code}`);
  }

  console.log('\n=== Xong migration 012 ===');
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('LOI migration 012:', e); process.exit(1); });
