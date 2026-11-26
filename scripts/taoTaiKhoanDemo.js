/**
 * Tao (hoac cap nhat) tai khoan DEMO de trinh bay do an.
 *
 *   node scripts/taoTaiKhoanDemo.js            tao / dat lai mat khau
 *   node scripts/taoTaiKhoanDemo.js --tat      tat che do demo (giu tai khoan, khoa dang nhap)
 *
 * Tai khoan: username `demo`, chuc danh Quan ly nha hang (thay du menu), va
 * duoc ghi vao cau_hinh 'demo.nhan_vien_ids' -> bo qua rang buoc GIO GIAC
 * (xem services/cheDoDemo.js). Chay lai nhieu lan khong tao trung.
 */
require('dotenv').config({ quiet: true });
const db = require('../config/db');
const matKhau = require('../utils/matKhau');

const USERNAME = 'demo';
const MAT_KHAU = 'Demo@2026';
const KHOA = 'demo.nhan_vien_ids';

(async () => {
  const tat = process.argv.includes('--tat');
  const [[nvCu]] = await db.query('SELECT id_nv FROM nhan_vien WHERE username = ?', [USERNAME]);

  if (tat) {
    await db.query('DELETE FROM cau_hinh WHERE khoa = ?', [KHOA]);
    if (nvCu) await db.query('UPDATE nhan_vien SET trangthai = 0 WHERE id_nv = ?', [nvCu.id_nv]);
    console.log('Da tat che do demo va khoa tai khoan demo.');
    process.exit(0);
  }

  const [[cd]] = await db.query("SELECT id_cd FROM chuc_danh WHERE ma_cd = 'QLNH' LIMIT 1");
  if (!cd) throw new Error('Khong tim thay chuc danh QLNH (Quan ly nha hang).');
  const hash = await matKhau.bam(MAT_KHAU);

  let id;
  if (nvCu) {
    id = nvCu.id_nv;
    await db.query(
      "UPDATE nhan_vien SET passwords = ?, chucvu = 'Quan ly', id_cd = ?, trangthai = 1 WHERE id_nv = ?",
      [hash, cd.id_cd, id]);
  } else {
    // Dien gia tri cho moi cot NOT NULL khong co mac dinh (cau truc bang co the khac giua cac may).
    const [cot] = await db.query('SHOW COLUMNS FROM nhan_vien');
    const gt = {
      ten: 'Tài khoản Demo', sodienthoai: '0900000000', email: 'demo@nhahang.local', diachi: 'Demo',
      chucvu: 'Quan ly', username: USERNAME, passwords: hash, id_cd: cd.id_cd, trangthai: 1,
    };
    for (const c of cot) {
      if (c.Field in gt || c.Extra.includes('auto_increment') || c.Null === 'YES' || c.Default !== null) continue;
      gt[c.Field] = /int|decimal|float|double/i.test(c.Type) ? 0 : /date|time/i.test(c.Type) ? new Date() : '';
    }
    if (cot.some((c) => c.Field === 'ngayvaolam')) gt.ngayvaolam = new Date();
    if (cot.some((c) => c.Field === 'ma_nv')) gt.ma_nv = 'DEMO';
    const khoa = Object.keys(gt).filter((k) => cot.some((c) => c.Field === k));
    const [kq] = await db.query(
      `INSERT INTO nhan_vien (${khoa.map((k) => '`' + k + '`').join(',')}) VALUES (${khoa.map(() => '?').join(',')})`,
      khoa.map((k) => gt[k]));
    id = kq.insertId;
  }

  // Them id vao danh sach demo (giu cac id demo khac neu co).
  const [[ch]] = await db.query('SELECT gia_tri FROM cau_hinh WHERE khoa = ?', [KHOA]);
  const ds = new Set(String((ch && ch.gia_tri) || '').split(',').map((x) => x.trim()).filter(Boolean));
  ds.add(String(id));
  await db.query(
    'INSERT INTO cau_hinh (khoa, gia_tri) VALUES (?, ?) ON DUPLICATE KEY UPDATE gia_tri = VALUES(gia_tri)',
    [KHOA, [...ds].join(',')]);

  console.log('=== TAI KHOAN DEMO ===');
  console.log('  Trang dang nhap : /staff/login');
  console.log('  Ten dang nhap   : ' + USERNAME);
  console.log('  Mat khau        : ' + MAT_KHAU);
  console.log('  Chuc danh       : Quan ly nha hang (id_nv = ' + id + ')');
  console.log('  Che do demo     : BAT (bo qua rang buoc gio giac)');
  process.exit(0);
})().catch((e) => { console.error('Loi:', e.message); process.exit(1); });
