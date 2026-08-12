/**
 * Migration 007 - Ha tang du lieu cho cham cong bang khuon mat.
 *
 * Ba nhom thay doi:
 *   1. Bang `khuon_mat_nv` luu vector dac trung 128 chieu cua tung anh mau da
 *      dang ky. Luu VECTOR chu khong luu anh goc trong CSDL vi hai ly do:
 *      anh goc la du lieu sinh trac hoc nhay cam, va tu vector 128 chieu khong
 *      dung lai duoc khuon mat. Anh da cat chi giu tren dia de huan luyen lai.
 *   2. Bang `nhat_ky_nhan_dien` ghi MOI lan nhan dien ke ca that bai. Day vua la
 *      dau vet kiem toan (ai cham cong luc nao, do tin cay bao nhieu) vua la
 *      nguon so lieu that de bao cao trong khoa luan.
 *   3. Bo sung cot vao `cham_cong` de biet moi lan cham la thu cong hay khuon
 *      mat, kem do tin cay - khong ghi de len du lieu cham cong thu cong cu.
 *
 * Chay lai duoc nhieu lan (idempotent).
 */
const db = require('../db');

// --------------------------------------------------------------------------
const BANG_MOI = {
  // Vector dac trung cua tung anh mau. Mot nhan vien co nhieu dong.
  khuon_mat_nv: `
    id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
    id_nv INT(11) NOT NULL,
    vector_dac_trung MEDIUMTEXT NOT NULL,
    so_chieu INT(11) NOT NULL DEFAULT 128,
    duong_dan_anh VARCHAR(300) NULL,
    do_net FLOAT NULL,
    diem_phat_hien FLOAT NULL,
    goc_nghieng VARCHAR(20) NULL,
    nguoi_dang_ky VARCHAR(100) NULL,
    dang_dung TINYINT(1) NOT NULL DEFAULT 1,
    tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_kmnv_nv (id_nv),
    INDEX idx_kmnv_dung (dang_dung)`,

  // Nhat ky nhan dien - ghi ca truong hop that bai de tinh ty le chinh xac.
  nhat_ky_nhan_dien: `
    id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
    che_do VARCHAR(20) NOT NULL,
    id_nv_du_doan INT(11) NULL,
    id_nv_ky_vong INT(11) NULL,
    ket_qua VARCHAR(30) NOT NULL,
    do_tuong_dong FLOAT NULL,
    do_tuong_dong_nhi FLOAT NULL,
    nguong_ap_dung FLOAT NULL,
    diem_song FLOAT NULL,
    dat_kiem_tra_song TINYINT(1) NULL,
    so_mat_phat_hien INT(11) NULL,
    thoi_gian_xu_ly_ms INT(11) NULL,
    hanh_dong VARCHAR(20) NULL,
    khoang_cach_m FLOAT NULL,
    dia_chi_ip VARCHAR(45) NULL,
    duong_dan_anh VARCHAR(300) NULL,
    ghi_chu VARCHAR(255) NULL,
    thoi_diem TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_nknd_nv (id_nv_du_doan),
    INDEX idx_nknd_luc (thoi_diem),
    INDEX idx_nknd_kq (ket_qua)`,
};

// Cot bo sung cho bang cu: [ten_bang, ten_cot, dinh_nghia]
const COT_BO_SUNG = [
  ['cham_cong', 'phuong_thuc_vao', "VARCHAR(20) NULL DEFAULT 'thu_cong'"],
  ['cham_cong', 'phuong_thuc_ra', 'VARCHAR(20) NULL'],
  ['cham_cong', 'do_tin_cay_vao', 'FLOAT NULL'],
  ['cham_cong', 'do_tin_cay_ra', 'FLOAT NULL'],
  ['cham_cong', 'anh_vao', 'VARCHAR(300) NULL'],
  ['cham_cong', 'anh_ra', 'VARCHAR(300) NULL'],
  // cham_cong_gps da co san tu migration 001, chi thieu moc noi sang nhat ky.
  ['cham_cong_gps', 'id_nhat_ky', 'INT(11) NULL'],

  // `danh_gia_mo_hinh` sinh ra cho bai toan HOI QUY (du bao) nen chi co
  // MAE/RMSE/MAPE/R2. Nhan dien khuon mat la bai toan PHAN LOAI, can bo chi so
  // khac. Them cot NULL vao chinh bang cu de ca khoa luan van doc mot bang
  // danh gia duy nhat, thay vi de moi bai toan mot bang rieng.
  ['danh_gia_mo_hinh', 'do_chinh_xac', 'FLOAT NULL'],
  ['danh_gia_mo_hinh', 'do_chuan_xac', 'FLOAT NULL'],
  ['danh_gia_mo_hinh', 'do_bao_phu', 'FLOAT NULL'],
  ['danh_gia_mo_hinh', 'diem_f1', 'FLOAT NULL'],
  ['danh_gia_mo_hinh', 'nguong_toi_uu', 'FLOAT NULL'],
  ['danh_gia_mo_hinh', 'ghi_chu', 'VARCHAR(255) NULL'],
];

/**
 * Tham so dieu khien thuat toan - de trong CSDL de chinh duoc luc demo ma
 * khong phai sua code hay khoi dong lai service.
 *
 * Nguong 0.363 la nguong cosine khuyen nghi cua chinh tac gia SFace: tren
 * bo LFW nguong nay cho ty le nhan dung ~99.6%. Se do lai tren du lieu that
 * cua he thong bang endpoint /khuon-mat/danh-gia va chinh neu can.
 */
const THAM_SO = [
  ['khuon_mat_nguong_cosine', '0.363', 'Nguong cosine de coi la cung mot nguoi (SFace)'],
  ['khuon_mat_bien_an_toan', '0.05', 'Khoang cach toi thieu giua nguoi hang 1 va hang 2'],
  ['khuon_mat_so_anh_toi_thieu', '5', 'So anh mau toi thieu khi dang ky mot nhan vien'],
  ['khuon_mat_bat_kiem_tra_song', '1', 'Bat kiem tra anh song (chong gio anh in / man hinh)'],
  ['khuon_mat_nguong_do_net', '45', 'Phuong sai Laplacian toi thieu - loai anh mo'],
  ['khuon_mat_nguong_diem_song', '0.55', 'Diem liveness toi thieu de chap nhan'],
  ['khuon_mat_bat_gps', '1', 'Bat rang buoc vi tri khi cham cong bang khuon mat'],
  ['khuon_mat_cach_nhau_giay', '90', 'Khoang cach toi thieu giua hai lan cham cua cung nguoi'],
  ['khuon_mat_luu_anh_nhat_ky', '1', 'Luu anh moi lan cham cong lam bang chung'],
];

// --------------------------------------------------------------------------
async function coCot(bang, cot) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [bang, cot]
  );
  return rows[0].n > 0;
}

async function taoBang() {
  console.log('\n[1/4] Tao bang moi');
  for (const [ten, ddl] of Object.entries(BANG_MOI)) {
    await db.query(
      `CREATE TABLE IF NOT EXISTS \`${ten}\` (${ddl}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );
    console.log(`  + bang ${ten}`);
  }
}

async function themCot() {
  console.log('\n[2/4] Bo sung cot cho bang cu');
  for (const [bang, cot, dinhNghia] of COT_BO_SUNG) {
    if (await coCot(bang, cot)) {
      console.log(`  = ${bang}.${cot} da co`);
      continue;
    }
    await db.query(`ALTER TABLE \`${bang}\` ADD COLUMN \`${cot}\` ${dinhNghia}`);
    console.log(`  + ${bang}.${cot}`);
  }

  // Du lieu cham cong cu deu la thu cong - danh dau ro de bao cao khong bi lech.
  const [kq] = await db.query(
    "UPDATE cham_cong SET phuong_thuc_vao = 'thu_cong' WHERE phuong_thuc_vao IS NULL"
  );
  if (kq.affectedRows) console.log(`  ~ danh dau ${kq.affectedRows} ban ghi cu la thu_cong`);
}

async function themThamSo() {
  console.log('\n[3/4] Tham so cau hinh');
  for (const [khoa, giaTri, moTa] of THAM_SO) {
    await db.query(
      'INSERT IGNORE INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES (?, ?, ?)',
      [khoa, giaTri, moTa]
    );
  }
  console.log(`  + ${THAM_SO.length} tham so cham cong khuon mat`);
}

async function kiemTra() {
  console.log('\n[4/4] Kiem tra');
  const [nv] = await db.query('SELECT COUNT(*) AS n FROM nhan_vien WHERE trangthai = 1');
  const [km] = await db.query(
    'SELECT COUNT(DISTINCT id_nv) AS nguoi, COUNT(*) AS mau FROM khuon_mat_nv WHERE dang_dung = 1'
  );
  console.table([
    { chi_tieu: 'Nhan vien dang lam viec', so_luong: nv[0].n },
    { chi_tieu: 'Nhan vien da dang ky khuon mat', so_luong: km[0].nguoi },
    { chi_tieu: 'Tong so anh mau', so_luong: km[0].mau },
  ]);
  if (km[0].nguoi === 0) {
    console.log('  ! Chua ai dang ky khuon mat.');
    console.log('    Vao /admin/cham-cong-khuon-mat de dang ky cho tung nhan vien.');
  }
}

async function main() {
  console.log('=== Migration 007: cham cong bang khuon mat ===');
  await taoBang();
  await themCot();
  await themThamSo();
  await kiemTra();
  console.log('\n=== Hoan tat migration 007 ===');
  await db.end();
}

main().catch((err) => {
  console.error('Migration that bai:', err);
  process.exit(1);
});
