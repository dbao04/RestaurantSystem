/**
 * Migration 020 - Tao bang `trang_thiet_bi` cho man hinh "Quan ly Thiet bi".
 *
 * VAN DE
 * Man hinh /staff/kitchen/equipment chua bao gio chay duoc. Ba manh cua tinh
 * nang nay da co san tu lau nhung khong noi voi nhau:
 *
 *   1. Giao dien  views/staff/kitchen/equipment.ejs  - da viet xong, dung 5 cot
 *      id_ttb / ten_ttb / so_luong / tinh_trang / ghi_chu.
 *   2. Dich vu    services/equipmentService.js       - da viet xong 4 ham CRUD.
 *   3. Bang       trang_thiet_bi                     - KHONG TON TAI.
 *
 * Ngoai ra 4 route trong server.js goi nham `menuService.*Equipment` (cac ham
 * nam o equipmentService, khong phai menuService) nen bao "is not a function"
 * truoc khi kip cham toi CSDL. Loi goi nham do da duoc sua kem theo lan nay.
 *
 * Sau migration nay ca 4 route (xem / them / sua / xoa) deu chay.
 *
 * Chay lai duoc nhieu lan: dung CREATE TABLE IF NOT EXISTS, khong dung toi
 * du lieu da co.
 */
const db = require('../db');

async function bangThietBi() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS trang_thiet_bi (
      id_ttb     INT(11)      NOT NULL AUTO_INCREMENT,
      ten_ttb    VARCHAR(255) NOT NULL,
      so_luong   INT(11)      NOT NULL DEFAULT 0,
      tinh_trang VARCHAR(50)  NOT NULL DEFAULT 'Tốt',
      ghi_chu    TEXT         DEFAULT NULL,
      PRIMARY KEY (id_ttb)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci
  `);
  const [[n]] = await db.query('SELECT COUNT(*) AS n FROM trang_thiet_bi');
  console.log(`  Bang trang_thiet_bi      : san sang (${n.n} thiet bi)`);
}

async function kiemTra() {
  console.log('\n  Kiem tra:');
  const [cot] = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'trang_thiet_bi'`
  );
  const co = cot.map((c) => c.column_name || c.COLUMN_NAME);
  const can = ['id_ttb', 'ten_ttb', 'so_luong', 'tinh_trang', 'ghi_chu'];
  const thieu = can.filter((c) => !co.includes(c));
  console.log(`      cot                      : ${co.length}/${can.length}`);
  if (thieu.length) throw new Error('Thieu cot: ' + thieu.join(', '));
}

async function main() {
  console.log('=== Migration 020: bang trang thiet bi ===');
  await bangThietBi();
  await kiemTra();
  console.log('\n=== Hoan tat migration 020 ===');
  console.log('Buoc tiep theo:');
  console.log('  Dang nhap bang tai khoan thuoc bo phan Bep, vao');
  console.log('  /staff/kitchen/equipment de them thiet bi dau tien.');
  await db.end();
}

main().catch((err) => {
  console.error('Migration that bai:', err);
  process.exit(1);
});
