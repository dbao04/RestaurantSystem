/**
 * Migration 009 - Xoa toan bo tai khoan cu va tao lai bo tai khoan chuan.
 *
 * MUC TIEU
 * --------
 * Tao MOT tai khoan cho MOI chuc danh trong co cau to chuc (23 chuc danh do
 * migration 008 dinh nghia), cong mot tai khoan quan tri. Tat ca dung mat khau
 * `123456`. Nho vay co the dang nhap thu tung vai tro ma khong phai tu tao.
 *
 * PHU THUOC: phai chay migration 008 truoc (can bang chuc_danh, bo_phan, quyen).
 *
 * CANH BAO - DAY LA THAO TAC XOA DU LIEU
 * --------------------------------------
 * Script XOA het `nhan_vien` va `tb_admin` cu roi tao lai. Cac ban ghi van hanh
 * gan voi nhan vien cu (cham cong, lich lam viec, luong, chot ca, thanh vien to,
 * hien dien, uy quyen) cung bi xoa vi khong con y nghia khi nhan vien do bien mat.
 *
 * Lich su DON HANG duoc GIU LAI: cot `hopdong.id_nv` (nhan vien phu trach don)
 * duoc dat NULL thay vi xoa don - doanh thu va bao cao van con nguyen.
 *
 * Chay lai duoc nhieu lan: moi lan deu dua ve dung bo tai khoan chuan nay.
 */
const db = require('../db');
const md5 = require('md5');

const MAT_KHAU = '123456';
const HASH = md5(MAT_KHAU);

// ---------------------------------------------------------------------------
// TAI KHOAN QUAN TRI
// ---------------------------------------------------------------------------
const QUAN_TRI = [
  // [ten_hien_thi, ten_dang_nhap, level]
  ['Quản trị hệ thống', 'admin', 0],
];

// ---------------------------------------------------------------------------
// TAI KHOAN NHAN VIEN - mot tai khoan moi chuc danh
// ---------------------------------------------------------------------------
// [ma_cd, username, ho_ten, so_dien_thoai, email]
// username dat theo vai tro, de nho khi dang nhap thu.
const NHAN_VIEN = [
  // Điều hành
  ['QLNH',        'quanly',       'Quản lý nhà hàng',        '0900000001', 'quanly@nhahang.com'],
  ['TLQL',        'trolyquanly',  'Trợ lý quản lý',          '0900000002', 'trolyquanly@nhahang.com'],
  // Lễ tân
  ['TRUONGLT',    'truongletan',  'Trưởng lễ tân',           '0900000003', 'truongletan@nhahang.com'],
  ['NVLT',        'letan',        'Nhân viên lễ tân',        '0900000004', 'letan@nhahang.com'],
  // Phục vụ
  ['GSPV',        'giamsatpv',    'Giám sát phục vụ',        '0900000005', 'giamsatpv@nhahang.com'],
  ['TOTRUONGPV',  'totruongpv',   'Tổ trưởng phục vụ',       '0900000006', 'totruongpv@nhahang.com'],
  ['NVPV',        'phucvu',       'Nhân viên phục vụ',       '0900000007', 'phucvu@nhahang.com'],
  ['PHUBAN',      'phuban',       'Phụ bàn',                 '0900000008', 'phuban@nhahang.com'],
  // Bếp
  ['QLBEP',       'quanlybep',    'Quản lý bếp',             '0900000009', 'quanlybep@nhahang.com'],
  ['BEPTRUONG',   'beptruong',    'Bếp trưởng',              '0900000010', 'beptruong@nhahang.com'],
  ['BEPPHO',      'beppho',       'Bếp phó',                 '0900000011', 'beppho@nhahang.com'],
  ['TOTRUONGBEP', 'totruongbep',  'Tổ trưởng bếp',           '0900000012', 'totruongbep@nhahang.com'],
  ['DAUBEP',      'daubep',       'Đầu bếp',                 '0900000013', 'daubep@nhahang.com'],
  ['PHUBEP',      'phubep',       'Phụ bếp',                 '0900000014', 'phubep@nhahang.com'],
  ['TAPVUBEP',    'tapvubep',     'Tạp vụ bếp',              '0900000015', 'tapvubep@nhahang.com'],
  // Bar
  ['TRUONGBAR',   'truongbar',    'Trưởng bar',              '0900000016', 'truongbar@nhahang.com'],
  ['NVBAR',       'phache',       'Nhân viên pha chế',       '0900000017', 'phache@nhahang.com'],
  // Thu ngân
  ['GSTN',        'giamsattn',    'Giám sát thu ngân',       '0900000018', 'giamsattn@nhahang.com'],
  ['NVTN',        'thungan',      'Thu ngân',                '0900000019', 'thungan@nhahang.com'],
  // Kế toán
  ['KTTRUONG',    'ketoantruong', 'Kế toán trưởng',          '0900000020', 'ketoantruong@nhahang.com'],
  ['NVKT',        'ketoan',       'Kế toán viên',            '0900000021', 'ketoan@nhahang.com'],
  // Kho
  ['THUKHO',      'thukho',       'Thủ kho',                 '0900000022', 'thukho@nhahang.com'],
  ['NVKHO',       'nhanvienkho',  'Nhân viên kho',           '0900000023', 'nhanvienkho@nhahang.com'],
];

// ---------------------------------------------------------------------------
// TIEN ICH
// ---------------------------------------------------------------------------
async function bangTonTai(ten) {
  const [r] = await db.query(
    'SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    [ten]
  );
  return r[0].n > 0;
}

async function cotTonTai(bang, cot) {
  const [r] = await db.query(
    'SELECT COUNT(*) n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
    [bang, cot]
  );
  return r[0].n > 0;
}

async function xoaBang(ten) {
  if (await bangTonTai(ten)) {
    await db.query(`DELETE FROM \`${ten}\``);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// KIEM TRA TIEN QUYET
// ---------------------------------------------------------------------------
async function kiemTraTienQuyet() {
  if (!(await bangTonTai('chuc_danh'))) {
    throw new Error(
      'Chưa có bảng chuc_danh. Hãy chạy migration 008 trước:\n' +
      '  node config/migrations/008_co_cau_to_chuc.js'
    );
  }
  const [[c]] = await db.query('SELECT COUNT(*) n FROM chuc_danh WHERE trang_thai = 1');
  if (c.n === 0) throw new Error('Bảng chuc_danh rỗng. Hãy chạy lại migration 008.');
}

// ---------------------------------------------------------------------------
// XOA DU LIEU CU
// ---------------------------------------------------------------------------
async function xoaTaiKhoanCu() {
  console.log('\n[1/4] Xóa tài khoản và dữ liệu vận hành cũ');

  // Tat kiem tra khoa ngoai trong luc don, tranh loi thu tu xoa.
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    // Giu lich su don hang: chi go lien ket nhan vien phu trach.
    if (await cotTonTai('hopdong', 'id_nv')) {
      const [r] = await db.query('UPDATE hopdong SET id_nv = NULL WHERE id_nv IS NOT NULL');
      console.log(`   · hopdong: gỡ liên kết nhân viên ở ${r.affectedRows} dòng (giữ đơn)`);
    }

    // Xoa cac ban ghi van hanh gan voi nhan vien cu.
    const bangVanHanh = [
      'cham_cong', 'lich_lam_viec', 'nghi_phep', 'luong',
      'chot_ca', 'shift_closings',
      'thanh_vien_to', 'hien_dien_nv', 'uy_quyen', 'quyen_nhan_vien',
      'nhat_ky_to_chuc',
      'khuon_mat_nv', 'nhat_ky_nhan_dien', 'cham_cong_gps',
    ];
    for (const b of bangVanHanh) {
      if (await xoaBang(b)) console.log(`   · đã xóa ${b}`);
    }

    // Go tham chieu nhan vien o cac bang giu lai du lieu.
    if (await cotTonTai('chat', 'id_nv')) {
      await db.query('UPDATE chat SET id_nv = NULL WHERE id_nv IS NOT NULL');
      console.log('   · chat: gỡ liên kết nhân viên (giữ tin nhắn)');
    }
    if (await cotTonTai('thong_bao', 'id_nv')) {
      await db.query('DELETE FROM thong_bao WHERE id_nv IS NOT NULL');
      console.log('   · thong_bao: xóa thông báo của nhân viên cũ');
    }

    // To lam viec tro thanh khong co to truong sau khi xoa nhan vien.
    if (await cotTonTai('to_lam_viec', 'id_to_truong')) {
      await db.query('UPDATE to_lam_viec SET id_to_truong = NULL');
    }

    // Xoa nhan vien va quan tri.
    await db.query('DELETE FROM nhan_vien');
    await db.query('ALTER TABLE nhan_vien AUTO_INCREMENT = 1');
    console.log('   · đã xóa toàn bộ nhan_vien');

    if (await bangTonTai('tb_admin')) {
      await db.query('DELETE FROM tb_admin');
      await db.query('ALTER TABLE tb_admin AUTO_INCREMENT = 1');
      console.log('   · đã xóa toàn bộ tb_admin');
    }
  } finally {
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

// ---------------------------------------------------------------------------
// TAO TAI KHOAN MOI
// ---------------------------------------------------------------------------
async function taoQuanTri() {
  console.log('\n[2/4] Tạo tài khoản quản trị');
  for (const [ten, user, level] of QUAN_TRI) {
    await db.query(
      'INSERT INTO tb_admin (Name_admin, adminuser, adminpass, level) VALUES (?,?,?,?)',
      [ten, user, HASH, level]
    );
    console.log(`   + ${user} / ${MAT_KHAU}`);
  }
}

async function taoNhanVien() {
  console.log('\n[3/4] Tạo tài khoản nhân viên (một tài khoản mỗi chức danh)');

  const [cd] = await db.query(
    'SELECT id_cd, ma_cd, id_bp, chucvu_legacy, vai_tro_tuong_duong FROM chuc_danh'
  );
  const theoMa = new Map(cd.map((c) => [c.ma_cd, c]));

  let stt = 0;
  for (const [maCd, user, hoTen, sdt, email] of NHAN_VIEN) {
    const c = theoMa.get(maCd);
    if (!c) {
      console.log(`   ⚠ bỏ qua ${user}: không tìm thấy chức danh ${maCd}`);
      continue;
    }
    // Gia tri ENUM cu hop le de cac man hinh cu doc dung.
    const chucvu = (c.chucvu_legacy || '').trim() ||
      (c.vai_tro_tuong_duong || '').split(',')[0].trim() || 'Nhan vien chung';

    stt += 1;
    const maNv = 'NV' + String(stt).padStart(4, '0');
    await db.query(
      `INSERT INTO nhan_vien
         (ma_nv, ten, sodienthoai, email, chucvu, id_cd, id_bp, username, passwords,
          ngayvaolam, ngay_bo_nhiem, trangthai, trang_thai_lam_viec)
       VALUES (?,?,?,?,?,?,?,?,?, CURDATE(), CURDATE(), 1, 'dang_lam')`,
      [maNv, hoTen, sdt, email, chucvu, c.id_cd, c.id_bp, user, HASH]
    );
  }
  console.log(`   + ${stt} tài khoản, tất cả mật khẩu ${MAT_KHAU}`);
}

// ---------------------------------------------------------------------------
// NOI DUONG BAO CAO
// ---------------------------------------------------------------------------
async function noiDuongBaoCao() {
  console.log('\n[4/4] Nối đường báo cáo theo cây chức danh');
  // Moi nguoi bao cao cho nguoi giu chuc danh cha. Vi moi chuc danh chi co
  // dung mot nguoi nen anh xa la 1-1, khong nhap nhang.
  const [r] = await db.query(`
    UPDATE nhan_vien n
    JOIN chuc_danh cd  ON cd.id_cd = n.id_cd
    JOIN nhan_vien sep ON sep.id_cd = cd.id_cd_cha
    SET n.id_quan_ly = sep.id_nv
    WHERE cd.id_cd_cha IS NOT NULL AND n.id_nv <> sep.id_nv`);
  console.log(`   ✓ đã nối ${r.affectedRows} đường báo cáo`);

  // Gan to truong cho cac to theo bo phan tuong ung (neu co to truong phu hop).
  const [tos] = await db.query('SELECT id_to, id_bp FROM to_lam_viec WHERE trang_thai = 1');
  let ganTo = 0;
  for (const t of tos) {
    // Uu tien nguoi cap 4 (to truong) cung bo phan; neu khong co lay cap thap nhat.
    const [ng] = await db.query(
      `SELECT n.id_nv FROM nhan_vien n JOIN chuc_danh cd ON cd.id_cd = n.id_cd
       WHERE cd.id_bp = ? AND n.trangthai = 1
       ORDER BY (cd.cap_bac = 4) DESC, cd.cap_bac DESC LIMIT 1`,
      [t.id_bp]
    );
    if (!ng.length) continue;
    await db.query('UPDATE to_lam_viec SET id_to_truong = ? WHERE id_to = ?', [ng[0].id_nv, t.id_to]);
    await db.query(
      `INSERT INTO thanh_vien_to (id_to, id_nv, vai_tro_trong_to, tu_ngay, trang_thai)
       VALUES (?,?,'to_truong',CURDATE(),1)
       ON DUPLICATE KEY UPDATE vai_tro_trong_to = 'to_truong', trang_thai = 1`,
      [t.id_to, ng[0].id_nv]
    );
    ganTo += 1;
  }
  console.log(`   ✓ đã gán tổ trưởng cho ${ganTo} tổ`);
}

// ---------------------------------------------------------------------------
async function main() {
  console.log('=== Migration 009: tạo lại toàn bộ tài khoản ===');
  await kiemTraTienQuyet();
  await xoaTaiKhoanCu();
  await taoQuanTri();
  await taoNhanVien();
  await noiDuongBaoCao();

  const [[tk]] = await db.query(`
    SELECT (SELECT COUNT(*) FROM tb_admin)   AS admin,
           (SELECT COUNT(*) FROM nhan_vien)  AS nv,
           (SELECT COUNT(*) FROM nhan_vien WHERE id_cd IS NOT NULL) AS co_chuc_danh`);
  console.log('\n=== Xong ===');
  console.log(`Quản trị: ${tk.admin} · Nhân viên: ${tk.nv} (đều có chức danh: ${tk.co_chuc_danh})`);
  console.log(`Tất cả mật khẩu: ${MAT_KHAU}`);
  console.log('Xem danh sách đầy đủ trong DANH_SACH_TAI_KHOAN.md');
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => { console.error('\nMigration 009 lỗi:', e.message); process.exit(1); });
}

module.exports = { main, QUAN_TRI, NHAN_VIEN, MAT_KHAU };
