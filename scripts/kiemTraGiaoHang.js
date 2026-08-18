/**
 * Chan doan phan he giao hang - tra loi cau hoi "vi sao toi khong vao duoc".
 *
 * VI SAO CAN SCRIPT NAY
 * ---------------------
 * "Khong vao duoc" co it nhat nam nguyen nhan khac han nhau, va moi nguyen
 * nhan cho ra mot man hinh khac: 404 (may chu chua nap route moi), chuyen ve
 * trang dang nhap (chua dang nhap dung khu), 403 (dang nhap dung nhung chua co
 * quyen), trang "chua co ho so shipper", hay trang mo ra nhung rong khong.
 *
 * Doan mo bang cach thu tung cai la mat thoi gian. Script nay doc thang CSDL va
 * chi ra dung buoc con thieu, kem lenh phai chay.
 *
 * Chay:  node scripts/kiemTraGiaoHang.js
 */
const db = require('../config/db');

const BANG = [
  'don_vi_van_chuyen', 'shipper', 'don_giao_hang',
  'nhat_ky_giao_hang', 'vi_tri_shipper', 'vi_tri_shipper_moi_nhat',
];

const QUYEN = [
  'giao_hang.xem', 'giao_hang.phan_cong', 'giao_hang.cap_nhat',
  'giao_hang.theo_doi', 'giao_hang.shipper', 'giao_hang.don_vi',
];

/** Nhung viec con phai lam, gom lai in mot the o cuoi. */
const viecConLai = [];

const D = '─'.repeat(64);
function muc(ten) { console.log(`\n${ten}\n${D}`); }
function dat(chu)   { console.log('  [ĐẠT]     ' + chu); }
function thieu(chu) { console.log('  [THIẾU]   ' + chu); }
function luuY(chu)  { console.log('  [LƯU Ý]   ' + chu); }

async function coBang(ten) {
  const [r] = await db.query(
    `SELECT COUNT(*) AS n FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`, [ten]
  );
  return r[0].n > 0;
}

// ---------------------------------------------------------------------------

async function kiemTraBang() {
  muc('1. Sáu bảng dữ liệu (migration 019)');
  const con = [];
  for (const b of BANG) {
    if (await coBang(b)) { dat(b); } else { thieu(b); con.push(b); }
  }
  if (con.length) {
    viecConLai.push('Chạy migration:  node config/migrations/019_van_chuyen.js');
    console.log('\n  → Chưa chạy migration 019. Đây gần như chắc chắn là nguyên nhân:');
    console.log('    trang mở ra sẽ báo lỗi 500 vì truy vấn vào bảng không tồn tại.');
    return false;
  }
  return true;
}

async function kiemTraQuyen() {
  muc('2. Sáu quyền chi tiết');
  if (!(await coBang('quyen'))) {
    thieu('bảng `quyen` — chưa chạy migration 008_co_cau_to_chuc');
    viecConLai.push('Chạy trước:  node config/migrations/008_co_cau_to_chuc.js');
    return;
  }
  const [q] = await db.query(
    `SELECT ma_q FROM quyen WHERE ma_q IN (${QUYEN.map(() => '?').join(',')})`, QUYEN
  );
  const co = q.map((r) => r.ma_q);
  QUYEN.forEach((m) => (co.includes(m) ? dat(m) : thieu(m)));
  if (co.length < QUYEN.length) {
    viecConLai.push('Chạy lại migration:  node config/migrations/019_van_chuyen.js');
  }
}

async function kiemTraChucDanh() {
  muc('3. Ai đang có quyền vào trang điều phối');
  if (!(await coBang('chuc_danh_quyen'))) return;

  const [ds] = await db.query(
    `SELECT cd.ma_cd, cd.ten_cd, cd.cap_bac,
            GROUP_CONCAT(q.ma_q ORDER BY q.ma_q SEPARATOR ', ') AS quyen,
            (SELECT COUNT(*) FROM nhan_vien n WHERE n.id_cd = cd.id_cd
               AND n.trangthai = 1) AS so_nguoi
     FROM chuc_danh cd
     JOIN chuc_danh_quyen cq ON cq.id_cd = cd.id_cd AND cq.duoc_cap = 1
     JOIN quyen q ON q.id_q = cq.id_q AND q.ma_q LIKE 'giao_hang.%'
     GROUP BY cd.id_cd, cd.ma_cd, cd.ten_cd, cd.cap_bac
     ORDER BY cd.cap_bac`
  );

  if (!ds.length) {
    thieu('KHÔNG chức danh nào có quyền giao_hang.* — mọi nhân viên đều nhận 403');
    viecConLai.push('Chạy lại migration:  node config/migrations/019_van_chuyen.js');
    return;
  }

  let coNguoi = 0;
  for (const c of ds) {
    const n = Number(c.so_nguoi);
    coNguoi += n;
    console.log(`  ${c.ma_cd.padEnd(11)} ${String(c.ten_cd).padEnd(24)} ${n} người`);
    console.log(`              ${c.quyen}`);
  }
  if (coNguoi === 0) {
    console.log('');
    luuY('Có chức danh được cấp quyền, nhưng CHƯA AI được bổ nhiệm vào các chức danh đó.');
    luuY('Tài khoản nhân viên bạn đang dùng sẽ nhận 403. Tài khoản QUẢN TRỊ thì vào được.');
    viecConLai.push('Bổ nhiệm chức danh tại /to-chuc/quan-ly, hoặc đăng nhập bằng tài khoản quản trị (/admin/login)');
  }
}

async function kiemTraToaDo() {
  muc('4. Tọa độ nhà hàng (bắt buộc để tính cước)');
  const [r] = await db.query(
    "SELECT khoa, gia_tri FROM cau_hinh WHERE khoa IN ('nha_hang_vi_do','nha_hang_kinh_do')"
  );
  const c = {};
  r.forEach((x) => { c[x.khoa] = x.gia_tri; });
  const vd = Number(c.nha_hang_vi_do);
  const kd = Number(c.nha_hang_kinh_do);

  if (!Number.isFinite(vd) || !Number.isFinite(kd) || (vd === 0 && kd === 0)) {
    thieu('chưa khai tọa độ — mọi đơn sẽ có phí giao bằng 0 và không chặn được đơn ngoài vùng');
    viecConLai.push('Khai tọa độ tại /to-chuc/cham-cong → Cấu hình vị trí');
  } else {
    dat(`${vd}, ${kd}`);
  }
}

async function kiemTraDuLieu() {
  muc('5. Đơn vị vận chuyển và shipper');
  const [dv] = await db.query(
    'SELECT ma_dv, ten_dv, trang_thai FROM don_vi_van_chuyen ORDER BY thu_tu'
  );
  if (!dv.length) {
    thieu('chưa có đơn vị vận chuyển nào');
    viecConLai.push('Thêm đơn vị tại /admin/van-chuyen');
  } else {
    dv.forEach((d) => console.log(
      `  ${d.ma_dv.padEnd(10)} ${String(d.ten_dv).padEnd(30)} ${Number(d.trang_thai) === 1 ? 'hoạt động' : 'NGỪNG'}`
    ));
    if (!dv.some((d) => Number(d.trang_thai) === 1)) {
      thieu('mọi đơn vị đều đang NGỪNG — không đơn nào tính được cước');
      viecConLai.push('Bật lại ít nhất một đơn vị tại /admin/van-chuyen');
    }
  }

  console.log('');
  const [sp] = await db.query(
    `SELECT s.ten, s.trang_thai, s.id_nv, n.ten AS ten_nv, n.username
     FROM shipper s LEFT JOIN nhan_vien n ON n.id_nv = s.id_nv ORDER BY s.id_shipper`
  );
  if (!sp.length) {
    thieu('chưa có shipper nào — /shipper sẽ hiện trang "chưa có hồ sơ shipper"');
    viecConLai.push('Thêm shipper tại /admin/van-chuyen/shipper');
  } else {
    sp.forEach((s) => console.log(
      `  ${String(s.ten_nv || s.ten).trim().padEnd(24)} ${String(s.trang_thai).padEnd(10)}` +
      (s.username ? `đăng nhập: ${s.username}` : 'shipper đối tác (không đăng nhập)')
    ));
  }
}

async function kiemTraDon() {
  muc('6. Đơn giao hàng đang có');
  const [r] = await db.query(
    `SELECT trang_thai, COUNT(*) AS n FROM don_giao_hang GROUP BY trang_thai`
  );
  if (!r.length) {
    luuY('Chưa có đơn giao nào — trang điều phối MỞ ĐƯỢC nhưng rỗng.');
    luuY('Nếu bạn tưởng "vào không được" vì thấy trang trắng: đó là trang rỗng, không phải lỗi.');
    luuY('Tạo thử: đặt một đơn trên website và chọn "Giao tận nơi".');
  } else {
    r.forEach((x) => console.log(`  ${String(x.trang_thai).padEnd(12)} ${x.n} đơn`));
  }
}

async function main() {
  console.log('\n╔' + '═'.repeat(62) + '╗');
  console.log('║  CHẨN ĐOÁN PHÂN HỆ GIAO HÀNG' + ' '.repeat(34) + '║');
  console.log('╚' + '═'.repeat(62) + '╝');

  const coBangDayDu = await kiemTraBang();
  if (coBangDayDu) {
    await kiemTraQuyen();
    await kiemTraChucDanh();
    await kiemTraToaDo();
    await kiemTraDuLieu();
    await kiemTraDon();
  }

  muc('VIỆC CẦN LÀM');
  if (!viecConLai.length) {
    console.log('  Không còn gì thiếu ở phía cơ sở dữ liệu.');
    console.log('');
    console.log('  Nếu vẫn không vào được, nguyên nhân nằm ở phía máy chủ hoặc phiên đăng nhập:');
    console.log('');
    console.log('  a) Máy chủ chưa khởi động lại sau khi thêm mã nguồn mới → trang báo 404.');
    console.log('     Tắt cửa sổ đang chạy `node server.js` rồi chạy lại `npm start`.');
    console.log('  b) Đang đăng nhập nhầm khu. /admin/van-chuyen cần tài khoản QUẢN TRỊ');
    console.log('     (/admin/login); /staff/giao-hang cần tài khoản NHÂN VIÊN (/staff/login).');
    console.log('     Vào nhầm khu thì bị chuyển về trang đăng nhập, trông như "không vào được".');
    console.log('  c) /shipper chỉ mở cho nhân viên ĐÃ CÓ hồ sơ shipper (mục 5 ở trên).');
  } else {
    viecConLai.forEach((v, i) => console.log(`  ${i + 1}. ${v}`));
  }
  console.log('');

  await db.end();
}

main().catch((e) => {
  if (e.code === 'ECONNREFUSED') {
    console.error('\nKhông kết nối được MySQL. Hãy bật MySQL (XAMPP → Start MySQL) rồi chạy lại.');
  } else {
    console.error('\nLỗi:', e.message);
  }
  process.exit(1);
});
