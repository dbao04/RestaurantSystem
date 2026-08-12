/**
 * Migration 001 - Chuan hoa schema cho phan AI/ML.
 *
 * Nguyen tac: KHONG xoa cot cu. Cot `dates`/`tg` cua bang hopdong van duoc giu
 * nguyen vi 2600+ dong trong server.js dang doc chung. Ta them cot chuan
 * `ngay_dat` (DATE) + `gio_dat` (TIME) roi backfill, code moi chi dung cot moi.
 */
const db = require('../db');

/** Doc cac cot hien co cua mot bang. */
async function getColumns(table) {
  const [rows] = await db.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows.map((r) => r.COLUMN_NAME);
}

async function addColumn(table, column, definition) {
  const cols = await getColumns(table);
  if (cols.includes(column)) {
    console.log(`  - ${table}.${column} da ton tai, bo qua`);
    return;
  }
  await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`  + them ${table}.${column}`);
}

/**
 * `dates` duoc luu lan lon 3 dang: 'M/D/YYYY', 'YYYY-MM-DD' va chuoi rong.
 * Tra ve 'YYYY-MM-DD' hoac null.
 */
function parseNgay(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Dang M/D/YYYY (thang truoc, dung voi du lieu dang co trong DB).
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, mo, d, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

/** `tg` dang 'HH:MM'. Tra ve 'HH:MM:SS' hoac null. */
function parseGio(raw) {
  if (!raw) return null;
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [, h, mi, se] = m;
  return `${h.padStart(2, '0')}:${mi}:${se || '00'}`;
}

async function chuanHoaHopDong() {
  console.log('\n[1/5] Chuan hoa bang hopdong');
  await addColumn('hopdong', 'ngay_dat', 'DATE NULL');
  await addColumn('hopdong', 'gio_dat', 'TIME NULL');
  await addColumn('hopdong', 'loai_don', "VARCHAR(20) NOT NULL DEFAULT 'tai_cho'");
  await addColumn('hopdong', 'la_du_lieu_mo_phong', 'TINYINT(1) NOT NULL DEFAULT 0');

  const [rows] = await db.query(
    'SELECT id, dates, tg FROM hopdong WHERE ngay_dat IS NULL'
  );
  let ok = 0;
  let fail = 0;
  for (const r of rows) {
    const ngay = parseNgay(r.dates);
    const gio = parseGio(r.tg);
    if (!ngay) {
      fail++;
      continue;
    }
    await db.query('UPDATE hopdong SET ngay_dat = ?, gio_dat = ? WHERE id = ?', [
      ngay,
      gio,
      r.id,
    ]);
    ok++;
  }
  console.log(`  backfill: ${ok} dong thanh cong, ${fail} dong khong parse duoc ngay`);

  // Index phuc vu truy van thong ke theo ngay va gom gio hang theo phien.
  await taoIndex('hopdong', 'idx_hopdong_ngay', '(ngay_dat)');
  await taoIndex('hopdong', 'idx_hopdong_sesis', '(sesis)');
  await taoIndex('hopdong', 'idx_hopdong_mon', '(id_mon)');
}

async function taoIndex(table, name, cols) {
  const [rows] = await db.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, name]
  );
  if (rows.length) {
    console.log(`  - index ${name} da ton tai`);
    return;
  }
  await db.query(`CREATE INDEX \`${name}\` ON \`${table}\` ${cols}`);
  console.log(`  + tao index ${name}`);
}

async function chuanHoaBan() {
  console.log('\n[2/5] Them trang thai ban (so do ban thoi gian thuc)');
  // 0 = trong, 1 = dang phuc vu, 2 = da dat truoc, 3 = dang don
  await addColumn('ban', 'trangthai', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumn('ban', 'so_cho', 'INT(11) NOT NULL DEFAULT 4');
  await addColumn('ban', 'toa_do_x', 'INT(11) NOT NULL DEFAULT 0');
  await addColumn('ban', 'toa_do_y', 'INT(11) NOT NULL DEFAULT 0');
  await addColumn('ban', 'sesis_hien_tai', 'VARCHAR(255) NULL');
  await addColumn('ban', 'cap_nhat_luc', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

  // Rai vi tri mac dinh theo luoi 4 cot de so do khong bi chong len nhau.
  const [bans] = await db.query('SELECT Id_ban FROM ban ORDER BY Id_ban');
  for (let i = 0; i < bans.length; i++) {
    await db.query(
      'UPDATE ban SET toa_do_x = ?, toa_do_y = ? WHERE Id_ban = ? AND toa_do_x = 0 AND toa_do_y = 0',
      [(i % 4) * 160 + 20, Math.floor(i / 4) * 140 + 20, bans[i].Id_ban]
    );
  }
  console.log(`  + rai toa do mac dinh cho ${bans.length} ban`);
}

async function donNguyenLieu() {
  console.log('\n[3/5] Don master data nguyen lieu');

  await addColumn('nguyen_lieu', 'ten_chuan', 'VARCHAR(255) NULL');
  await addColumn('nguyen_lieu', 'gia_von', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await addColumn('nguyen_lieu', 'han_su_dung_ngay', 'INT(11) NOT NULL DEFAULT 30');

  // don_vi_tinh dang rong -> nap bo don vi co ban.
  const [dvt] = await db.query('SELECT COUNT(*) AS n FROM don_vi_tinh');
  if (dvt[0].n === 0) {
    const cols = await getColumns('don_vi_tinh');
    const tenCol = cols.find((c) => /ten/i.test(c)) || cols[1];
    const donVi = ['kg', 'gram', 'lit', 'ml', 'chai', 'lon', 'bo', 'cai', 'hop', 'goi'];
    for (const d of donVi) {
      await db.query(`INSERT INTO don_vi_tinh (\`${tenCol}\`) VALUES (?)`, [d]);
    }
    console.log(`  + nap ${donVi.length} don vi tinh`);
  } else {
    console.log(`  - don_vi_tinh da co ${dvt[0].n} dong`);
  }

  // Gop nguyen lieu trung ten (vd 'tieu' xuat hien 2 lan): giu id nho nhat,
  // cong don so luong, tro cong_thuc/nhap_kho sang id duoc giu.
  const [dups] = await db.query(
    `SELECT LOWER(TRIM(ten_nl)) AS ten, MIN(id_nl) AS giu, COUNT(*) AS n
     FROM nguyen_lieu GROUP BY LOWER(TRIM(ten_nl)) HAVING n > 1`
  );
  for (const d of dups) {
    const [others] = await db.query(
      'SELECT id_nl, so_luong FROM nguyen_lieu WHERE LOWER(TRIM(ten_nl)) = ? AND id_nl <> ?',
      [d.ten, d.giu]
    );
    for (const o of others) {
      await db.query('UPDATE nguyen_lieu SET so_luong = so_luong + ? WHERE id_nl = ?', [
        o.so_luong || 0,
        d.giu,
      ]);
      await db.query('UPDATE cong_thuc SET id_nl = ? WHERE id_nl = ?', [d.giu, o.id_nl]);
      await db.query('UPDATE nhap_kho SET id_nl = ? WHERE id_nl = ?', [d.giu, o.id_nl]);
      await db.query('DELETE FROM nguyen_lieu WHERE id_nl = ?', [o.id_nl]);
      console.log(`  ~ gop nguyen lieu '${d.ten}': id ${o.id_nl} -> ${d.giu}`);
    }
  }
  if (!dups.length) console.log('  - khong co nguyen lieu trung ten');
}

async function taoBangMoi() {
  console.log('\n[4/5] Tao cac bang moi');

  const bang = {
    // --- Quan ly nhap hang (phan he 5) ---
    nha_cung_cap: `
      id_ncc INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
      ten_ncc VARCHAR(255) NOT NULL,
      sodienthoai VARCHAR(20) NULL,
      email VARCHAR(255) NULL,
      diachi TEXT NULL,
      danh_gia TINYINT(1) NOT NULL DEFAULT 5,
      trangthai TINYINT(1) NOT NULL DEFAULT 1,
      ngay_tao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`,

    phieu_nhap: `
      id_pn INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
      ma_phieu VARCHAR(50) NOT NULL UNIQUE,
      id_ncc INT(11) NULL,
      id_nv INT(11) NULL,
      ngay_nhap DATE NOT NULL,
      tong_tien DECIMAL(14,2) NOT NULL DEFAULT 0,
      ghi_chu TEXT NULL,
      trangthai TINYINT(1) NOT NULL DEFAULT 1,
      INDEX idx_pn_ngay (ngay_nhap)`,

    // Moi dong la mot lo hang -> phuc vu canh bao han su dung.
    chi_tiet_phieu_nhap: `
      id_ct INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
      id_pn INT(11) NOT NULL,
      id_nl INT(11) NOT NULL,
      so_luong FLOAT NOT NULL,
      gia_nhap DECIMAL(12,2) NOT NULL DEFAULT 0,
      so_lo VARCHAR(50) NULL,
      han_su_dung DATE NULL,
      so_luong_con_lai FLOAT NOT NULL DEFAULT 0,
      INDEX idx_ctpn_nl (id_nl),
      INDEX idx_ctpn_hsd (han_su_dung)`,

    // --- Nhat ky tieu hao kho (tru kho tu dong khi ban mon) ---
    xuat_kho: `
      id_xk INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
      id_nl INT(11) NOT NULL,
      so_luong FLOAT NOT NULL,
      ly_do VARCHAR(50) NOT NULL DEFAULT 'ban_hang',
      sesis VARCHAR(255) NULL,
      id_mon INT(11) NULL,
      ngay_xuat DATE NOT NULL,
      tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_xk_ngay (ngay_xuat),
      INDEX idx_xk_nl (id_nl)`,

    // --- Ket qua Machine Learning (phan 3) ---
    du_bao_luot_khach: `
      id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
      ngay_du_bao DATE NOT NULL,
      so_khach_du_bao FLOAT NOT NULL,
      can_duoi FLOAT NULL,
      can_tren FLOAT NULL,
      mo_hinh VARCHAR(50) NOT NULL,
      tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_ngay_mohinh (ngay_du_bao, mo_hinh)`,

    du_bao_nguyen_lieu: `
      id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
      ngay_du_bao DATE NOT NULL,
      id_nl INT(11) NOT NULL,
      so_luong_can FLOAT NOT NULL,
      ton_hien_tai FLOAT NOT NULL DEFAULT 0,
      can_nhap_them FLOAT NOT NULL DEFAULT 0,
      mo_hinh VARCHAR(50) NOT NULL,
      tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_ngay_nl_mohinh (ngay_du_bao, id_nl, mo_hinh),
      INDEX idx_dbnl_ngay (ngay_du_bao)`,

    // Luu chi so danh gia mo hinh de dua vao bao cao khoa luan.
    danh_gia_mo_hinh: `
      id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
      bai_toan VARCHAR(100) NOT NULL,
      mo_hinh VARCHAR(50) NOT NULL,
      mae FLOAT NULL,
      rmse FLOAT NULL,
      mape FLOAT NULL,
      r2 FLOAT NULL,
      so_mau_train INT(11) NULL,
      so_mau_test INT(11) NULL,
      tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`,

    // --- Luat ket hop Apriori (phan 4) ---
    luat_ket_hop: `
      id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
      mon_ve_trai TEXT NOT NULL,
      mon_ve_phai INT(11) NOT NULL,
      do_ho_tro FLOAT NOT NULL,
      do_tin_cay FLOAT NOT NULL,
      do_nang FLOAT NOT NULL,
      so_giao_dich INT(11) NOT NULL DEFAULT 0,
      tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_lkh_phai (mon_ve_phai)`,

    // --- Cham cong GPS (phan mo rong) ---
    cham_cong_gps: `
      id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
      id_nv INT(11) NOT NULL,
      loai VARCHAR(10) NOT NULL,
      vi_do DOUBLE NULL,
      kinh_do DOUBLE NULL,
      khoang_cach_m FLOAT NULL,
      hop_le TINYINT(1) NOT NULL DEFAULT 0,
      phuong_thuc VARCHAR(20) NOT NULL DEFAULT 'gps',
      anh_selfie VARCHAR(300) NULL,
      thoi_diem TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ccgps_nv (id_nv)`,
  };

  for (const [ten, ddl] of Object.entries(bang)) {
    await db.query(
      `CREATE TABLE IF NOT EXISTS \`${ten}\` (${ddl}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );
    console.log(`  + bang ${ten}`);
  }
}

async function capNhatCauHinh() {
  console.log('\n[5/5] Bang cau hinh he thong');
  await db.query(`CREATE TABLE IF NOT EXISTS cau_hinh (
    khoa VARCHAR(100) NOT NULL PRIMARY KEY,
    gia_tri TEXT NULL,
    mo_ta VARCHAR(255) NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  const mac_dinh = [
    ['nha_hang_vi_do', '10.762622', 'Vi do nha hang - dung cho cham cong GPS'],
    ['nha_hang_kinh_do', '106.660172', 'Kinh do nha hang - dung cho cham cong GPS'],
    ['ban_kinh_cham_cong_m', '30', 'Ban kinh cho phep check-in (met)'],
    ['ml_service_url', 'http://127.0.0.1:8000', 'Dia chi service Machine Learning'],
    ['apriori_min_support', '0.02', 'Nguong do ho tro toi thieu cho Apriori'],
    ['apriori_min_confidence', '0.25', 'Nguong do tin cay toi thieu cho Apriori'],
  ];
  for (const [k, v, m] of mac_dinh) {
    await db.query(
      'INSERT IGNORE INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES (?, ?, ?)',
      [k, v, m]
    );
  }
  console.log(`  + ${mac_dinh.length} tham so cau hinh`);
}

async function main() {
  console.log('=== Migration 001: chuan hoa schema ===');
  await chuanHoaHopDong();
  await chuanHoaBan();
  await donNguyenLieu();
  await taoBangMoi();
  await capNhatCauHinh();
  console.log('\n=== Hoan tat migration 001 ===');
  await db.end();
}

main().catch((err) => {
  console.error('Migration that bai:', err);
  process.exit(1);
});
