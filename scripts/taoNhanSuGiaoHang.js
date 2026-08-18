/**
 * Tao nhan su cho bo phan Giao hang: mot dieu phoi + ba shipper.
 *
 * VI SAO LA MOT SCRIPT RIENG, KHONG NHET VAO MIGRATION 019
 * -------------------------------------------------------
 * Migration dung schema va quyen - thu ma MOI ban cai dat deu phai co. Nhan su
 * thi khong: nha hang that se tu them nguoi cua ho qua man hinh quan tri, va mot
 * migration tu sinh ra bon nhan vien khong co that la du lieu rac trong CSDL
 * that. Tach ra thanh script de nguoi dung CHU DONG goi khi can du lieu de thu.
 *
 * TAO HAI THU CHO MOI NGUOI, KHONG PHAI MOT
 * -----------------------------------------
 *   1. ban ghi `nhan_vien` + tai khoan dang nhap + chuc danh  → ho co QUYEN
 *   2. ban ghi `shipper`                                       → ho co HO SO
 * Thieu (1) thi ho khong dang nhap duoc. Thieu (2) thi ho dang nhap duoc nhung
 * mo /shipper chi thay trang "chua co ho so shipper" - vi he thong khong biet
 * ho chay xe gi, bien so nao, thuoc don vi nao. Day la cho hay bi sot nhat khi
 * lam tay qua giao dien.
 *
 * Chay lai duoc nhieu lan: nguoi da co (theo `username`) thi bo qua, khong tao
 * trung va khong ghi de ho so ban da sua tay.
 *
 * Chay:  node scripts/taoNhanSuGiaoHang.js
 */
const db = require('../config/db');
const md5 = require('md5');

const MAT_KHAU = '123456';           // dung mat khau chung voi migration 009
const HASH = md5(MAT_KHAU);

/**
 * Bon nguoi, dat theo mot doi giao hang that co the co.
 *
 * Ba shipper co `so_don_toi_da` khac nhau co y: mot nguoi chay xe may quen
 * duong cam duoc 3 don mot luot, nguoi moi vao chi cam 2. Man hinh dieu phoi
 * lay dung con so nay lam tran khi phan don, nen de khac nhau thi thay ngay
 * tac dung cua no.
 */
const NHAN_SU = [
  {
    ma_cd: 'DPGH', username: 'dieuphoi', ten: 'Ngô Thị Hạnh',
    sdt: '0905110001', email: 'dieuphoi@nhahangbaodoan.vn',
    shipper: null,                       // dieu phoi khong tu di giao
  },
  {
    ma_cd: 'SHIPPER', username: 'shipper1', ten: 'Lê Văn Hùng',
    sdt: '0905110002', email: 'shipper1@nhahangbaodoan.vn',
    shipper: { loai_xe: 'xe_may', bien_so: '59X1-234.56', so_don_toi_da: 3 },
  },
  {
    ma_cd: 'SHIPPER', username: 'shipper2', ten: 'Trần Minh Tú',
    sdt: '0905110003', email: 'shipper2@nhahangbaodoan.vn',
    shipper: { loai_xe: 'xe_may', bien_so: '59H2-887.10', so_don_toi_da: 3 },
  },
  {
    ma_cd: 'SHIPPER', username: 'shipper3', ten: 'Phạm Quốc Đạt',
    sdt: '0905110004', email: 'shipper3@nhahangbaodoan.vn',
    shipper: { loai_xe: 'xe_dien', bien_so: '59K1-045.72', so_don_toi_da: 2 },
  },
];

/** Ma nhan vien ke tiep, khong dam vao ma da co. */
async function maNvKeTiep() {
  const [[r]] = await db.query(
    "SELECT MAX(CAST(SUBSTRING(ma_nv, 3) AS UNSIGNED)) AS n FROM nhan_vien WHERE ma_nv REGEXP '^NV[0-9]+$'"
  );
  return Number(r.n || 0) + 1;
}

async function main() {
  console.log('=== Tạo nhân sự bộ phận Giao hàng ===\n');

  // --- Tien quyet ---
  const [cd] = await db.query(
    "SELECT id_cd, ma_cd, id_bp, chucvu_legacy, vai_tro_tuong_duong FROM chuc_danh WHERE ma_cd IN ('DPGH','SHIPPER')"
  );
  const theoMa = new Map(cd.map((c) => [c.ma_cd, c]));
  if (!theoMa.has('DPGH') || !theoMa.has('SHIPPER')) {
    throw new Error('Chưa có chức danh DPGH / SHIPPER. Chạy trước: node config/migrations/019_van_chuyen.js');
  }

  const [[dvNoiBo]] = await db.query(
    "SELECT id_dv, ten_dv FROM don_vi_van_chuyen WHERE ma_dv = 'NOIBO'"
  );
  if (!dvNoiBo) throw new Error("Chưa có đơn vị vận chuyển 'NOIBO'. Chạy migration 019.");

  let stt = await maNvKeTiep();
  let themNv = 0, themSp = 0, boQua = 0;

  for (const n of NHAN_SU) {
    const c = theoMa.get(n.ma_cd);

    // --- Nhan vien ---
    let [[nv]] = await db.query(
      'SELECT id_nv, ten FROM nhan_vien WHERE username = ?', [n.username]
    );

    if (nv) {
      console.log(`  · ${n.username.padEnd(10)} đã có (id_nv=${nv.id_nv}) — giữ nguyên`);
      boQua += 1;
    } else {
      // ENUM `chucvu` cu van phai dien dung, vi 178 route cu con so sanh chuoi
      // voi no. Lay tu `chucvu_legacy` cua chuc danh - dung mot nguon su that.
      const chucvu = (c.chucvu_legacy || '').trim() ||
        (c.vai_tro_tuong_duong || '').split(',')[0].trim() || 'Nhan vien chung';
      const maNv = 'NV' + String(stt++).padStart(4, '0');

      const [kq] = await db.query(
        `INSERT INTO nhan_vien
           (ma_nv, ten, sodienthoai, email, chucvu, id_cd, id_bp, username, passwords,
            ngayvaolam, ngay_bo_nhiem, trangthai, trang_thai_lam_viec)
         VALUES (?,?,?,?,?,?,?,?,?, CURDATE(), CURDATE(), 1, 'dang_lam')`,
        [maNv, n.ten, n.sdt, n.email, chucvu, c.id_cd, c.id_bp, n.username, HASH]
      );
      nv = { id_nv: kq.insertId, ten: n.ten };
      themNv += 1;
      console.log(`  + ${n.username.padEnd(10)} ${n.ten.padEnd(18)} ${n.ma_cd.padEnd(8)} ma_nv=${maNv}`);
    }

    // --- Ho so shipper ---
    if (!n.shipper) continue;
    const [[daCo]] = await db.query('SELECT id_shipper FROM shipper WHERE id_nv = ?', [nv.id_nv]);
    if (daCo) {
      console.log(`      hồ sơ shipper đã có (id_shipper=${daCo.id_shipper})`);
      continue;
    }
    await db.query(
      `INSERT INTO shipper (id_dv, id_nv, ten, sdt, loai_xe, bien_so, so_don_toi_da, trang_thai)
       VALUES (?,?,?,?,?,?,?, 'nghi')`,
      [dvNoiBo.id_dv, nv.id_nv, n.ten, n.sdt,
       n.shipper.loai_xe, n.shipper.bien_so, n.shipper.so_don_toi_da]
    );
    themSp += 1;
    // Bat dau o 'nghi' chu khong phai 'san_sang': ca truc la thu shipper TU bat
    // trong ung dung. Tao san o trang thai dang lam viec thi man hinh dieu phoi
    // noi doi - hien mot nguoi san sang nhan don trong khi ho chua mo may.
    console.log(`      + hồ sơ shipper · ${n.shipper.bien_so} · tối đa ${n.shipper.so_don_toi_da} đơn · đang NGOÀI CA`);
  }

  // --- Tong ket ---
  console.log(`\nThêm mới: ${themNv} nhân viên, ${themSp} hồ sơ shipper. Bỏ qua (đã có): ${boQua}`);

  const [ds] = await db.query(
    `SELECT n.username, n.ten, cd.ma_cd, s.bien_so, s.trang_thai
     FROM nhan_vien n
     JOIN chuc_danh cd ON cd.id_cd = n.id_cd
     LEFT JOIN shipper s ON s.id_nv = n.id_nv
     WHERE cd.ma_cd IN ('DPGH','SHIPPER') ORDER BY cd.cap_bac, n.id_nv`
  );
  console.log('\nTài khoản đăng nhập tại /staff/login — mật khẩu đều là ' + MAT_KHAU + ':\n');
  console.log('  ' + 'Tài khoản'.padEnd(12) + 'Họ tên'.padEnd(20) + 'Chức danh'.padEnd(10) + 'Xe');
  console.log('  ' + '─'.repeat(58));
  ds.forEach((r) => console.log(
    '  ' + r.username.padEnd(12) + String(r.ten).trim().padEnd(20) +
    r.ma_cd.padEnd(10) + (r.bien_so || '—')
  ));

  console.log('\nBước tiếp theo — cho hệ thống chạy thật:');
  console.log('  node scripts/moPhongGiaoHang.js');
  console.log('  rồi mở /staff/giao-hang/ban-do để xem xe chạy theo thời gian thực.');

  await db.end();
}

main().catch((e) => {
  console.error('\nLỗi:', e.message);
  process.exit(1);
});
