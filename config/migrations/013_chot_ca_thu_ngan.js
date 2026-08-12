/**
 * Migration 013 - CHOT CA THU NGAN (doi soat ket tien mat cuoi ca).
 *
 * Truoc migration nay he thong co hai bang chot ca, ca hai deu khong doi soat
 * duoc gi:
 *
 *   `chot_ca`        - man hinh /staff/shift, thu ngan TU GO tong doanh thu vao
 *                      mot o input. Con so do khong doi chieu voi bat cu dau,
 *                      nen no khong chung minh duoc dieu gi: go bao nhieu cung
 *                      duoc luu. Bang nay giu lai cho ben BEP dung
 *                      (/staff/kitchen/shift), noi khong co tien bac.
 *   `shift_closings` - do migrate.js tao san nhung CHUA HE duoc dung: khong co
 *                      route, khong co giao dien, 0 dong du lieu.
 *
 * Gio da co bang `payments` ghi tung dong tien that, chot ca moi lam dung viec
 * cua no: he thong tu tinh ket PHAI co bao nhieu tien mat, thu ngan dem ket
 * that roi nhap vao, chenh lech hien ra va phai giai trinh.
 *
 * Migration nay mo rong `shift_closings` cho du cot de luu mot bien ban doi
 * soat hoan chinh. Chay lai duoc nhieu lan.
 */
const db = require('../db');

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

async function main() {
  console.log('=== Migration 013: chot ca thu ngan ===\n');

  console.log('[1/2] Mo rong bang `shift_closings`');

  // Ten ca de doc trong bao cao. Khong rang buoc ENUM vi moi nha hang chia ca
  // mot kieu, va ca gay (12h-20h) rat pho bien vao cuoi tuan.
  await themCot('shift_closings', 'ten_ca', "VARCHAR(50) DEFAULT NULL COMMENT 'Sang / Chieu / Toi / Ca gay...'");

  /*
   * Quy dau ca: tien le de tra lai khach, co san trong ket TRUOC khi ban dau
   * thu dong nao. Khong tru khoan nay ra thi ket luc nao cung "thua tien" dung
   * bang so quy, va con so chenh lech mat het y nghia.
   */
  await themCot('shift_closings', 'tien_dau_ca', "DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Quy le co san dau ca'");

  // He thong tinh: quy dau ca + tien mat da thu - tien mat da hoan.
  await themCot('shift_closings', 'tien_mat_he_thong', "DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Ket PHAI co bao nhieu'");

  // Thu ngan dem ket that roi nhap vao.
  await themCot('shift_closings', 'tien_mat_dem_duoc', "DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Dem ket thuc te duoc bao nhieu'");

  /*
   * Chenh lech = dem duoc - he thong. AM la THIEU (nghiem trong, phai giai
   * trinh), DUONG la THUA (thuong do quen tra lai tien thua cho khach).
   * Luu thanh cot rieng chu khong tinh lai luc doc: tham so tinh tien co the
   * doi ve sau, con bien ban chot ca thi phai giu nguyen nhu luc ky.
   */
  await themCot('shift_closings', 'chenh_lech', "DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'dem_duoc - he_thong; am la thieu'");
  await themCot('shift_closings', 'ly_do_chenh_lech', 'VARCHAR(500) DEFAULT NULL');

  // Bang dem theo menh gia (JSON: {"500000":3,"200000":5,...}). Giu lai de khi
  // co tranh chap con lan lai duoc thu ngan da dem nhung to nao.
  await themCot('shift_closings', 'bang_menh_gia', 'TEXT DEFAULT NULL');

  // Cac hinh thuc khong nam trong ket - doi soat voi ngan hang chu khong voi
  // ket tien, nhung van phai co trong bien ban de xem tong doanh thu ca.
  await themCot('shift_closings', 'tien_chuyen_khoan', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await themCot('shift_closings', 'tien_the', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await themCot('shift_closings', 'tien_tip', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await themCot('shift_closings', 'tien_hoan', "DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Tong da hoan tra khach trong ca'");
  await themCot('shift_closings', 'tien_dat_coc', 'DECIMAL(12,2) NOT NULL DEFAULT 0');

  // Khach tu quet QR tra thang vao tai khoan nha hang - khong qua tay thu ngan
  // nao nen khong tinh vao trach nhiem cua ai, nhung van la doanh thu trong ca.
  await themCot('shift_closings', 'tien_khach_tu_tra', 'DECIMAL(12,2) NOT NULL DEFAULT 0');

  await themCot('shift_closings', 'so_phien_cho', "INT NOT NULL DEFAULT 0 COMMENT 'Phien QR con treo luc chot'");
  await themCot('shift_closings', 'duyet_luc', 'DATETIME DEFAULT NULL');
  await themCot('shift_closings', 'ghi_chu_duyet', 'VARCHAR(500) DEFAULT NULL');

  await themChiMuc('shift_closings', 'idx_nv_ngay', '`id_nv`, `shift_date`');
  await themChiMuc('shift_closings', 'idx_ket_thuc', '`shift_end`');

  /*
   * `status` mac dinh cua bang la 'open', nhung o luong nay mot bien ban chi
   * sinh ra DUNG LUC bam chot - khong co giai doan "dang mo". Doi mac dinh
   * sang 'closed' de khong ai lo tao ra ban ghi treo lung lung.
   */
  await db.query(
    "ALTER TABLE shift_closings MODIFY COLUMN status ENUM('open','closed','verified') NOT NULL DEFAULT 'closed'"
  );
  console.log('  ~ shift_closings.status mac dinh -> closed');

  console.log('\n[2/2] Kiem tra cot can cho viec doi soat');
  const [ktr] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments'
       AND COLUMN_NAME IN ('processed_by', 'thanh_cong_luc', 'tien_tip', 'loai')`
  );
  const co = ktr.map((r) => r.COLUMN_NAME);
  for (const c of ['processed_by', 'thanh_cong_luc', 'tien_tip', 'loai']) {
    console.log(`  ${co.includes(c) ? '=' : 'X'} payments.${c}`);
  }
  if (co.length < 4) {
    console.log('\n  CANH BAO: thieu cot tren bang payments - hay chay migration 011 truoc.');
  }

  console.log('\n=== Xong migration 013 ===');
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('LOI migration 013:', e); process.exit(1); });
