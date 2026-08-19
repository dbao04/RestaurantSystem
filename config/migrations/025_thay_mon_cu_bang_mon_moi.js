/**
 * Migration 025 - Xoa dau vet 31 mon cu, chuyen lich su sang mon Nhat tuong duong.
 *
 * VI SAO CAN
 * Khi nap thuc don Haru, script `_tmp_nap_menu_haru.js` chay `DELETE FROM monan`
 * roi nap 258 mon Nhat. 31 mon Viet cu (Cha gio, Heo nuong, Com chien Loc Phat...)
 * biet mat khoi bang mon, nhung dau vet cua chung con nam o ba cho:
 *
 *   - `hopdong`   123 dong don hang tro toi id_mon khong con ton tai
 *   - `xuat_kho`  157 dong phieu xuat kho tuong tu
 *   - anh mon cu con nam lai trong `images/food/` va `food/`
 *
 * Trang /analytics, du bao va goi y mon deu doc `hopdong`. Neu xoa thang 123 dong
 * do thi doanh thu lich su hut di. Nen thay vi xoa, migration nay ANH XA tung mon
 * cu sang mot mon Nhat tuong duong: lich su ban hang giu nguyen so lieu, chi doi
 * ten mon ma no tro toi.
 *
 * NGUYEN TAC GHEP CAP
 * Haru la nha hang Nhat, khong co mon Viet tuong ung 1-1. Nen ghep theo VAI TRO
 * trong bua an - do la thu ma phan tich gio hang va doanh thu theo nhom quan tam:
 * nuoc ngot ra nuoc ngot, mon nuong ra mon nuong, com ra com, trang mieng ra
 * trang mieng. Vai cap trung khop gan nhu y het (Coca-Cola -> 21-COCA COLA,
 * Bia Tiger -> TIGER, Bo nuong da -> B24-BO WAGYU NUONG DA), so con lai la mon
 * gan nhat trong cung nhom.
 *
 * GIU NGUYEN `gia` VA `thanhtien`
 * Chi doi `id_mon`, `name_mon`, `images`. So tien la tien khach da tra that luc
 * do, khong duoc sua theo gia mon moi - sua la sai so lieu doanh thu.
 *
 * CHO CHAP NHAN DUOC MOT CACH CO Y THUC
 * Sau khi anh xa, dong `xuat_kho` van tro toi nguyen lieu cu (`id_nl`) trong khi
 * `cong_thuc` cua mon moi khai nguyen lieu khac. Khong dong bo lai vi day la
 * phieu xuat da phat sinh trong qua khu - sua nguyen lieu la bia lai lich su kho.
 *
 * KHONG DUNG TOI
 *   - 10 dong `hopdong` co id_mon = 0, ten "Dat qua QR": khong phai mon cu ma la
 *     dong danh dau phien goi mon qua QR (soluong = 0, gia = 0).
 *   - 23 mon dang tinhtrang = 0: la mon Haru hien hanh dang tam het (nguon danh
 *     dau isOff), khong phai mon cu.
 *
 * Chay:  node config/migrations/025_thay_mon_cu_bang_mon_moi.js
 * Sao luu truoc o: backup/gs_restaurant_truoc_thay_mon_cu_20260819.sql
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');

const GOC = path.join(__dirname, '..', '..');

// id mon cu -> id mon Nhat thay the. Ghi kem ten de nguoi doc kiem duoc bang mat.
const ANH_XA = [
  // --- Nuoc uong: gan nhu khop 1-1 ---
  [76, 'Coca-Cola',            100, '21-COCA COLA'],
  [77, 'Pepsi',                101, '22-COCA ZERO'],
  [78, 'Bia Tiger',            333, 'TIGER'],
  [79, 'Nuoc suoi',            104, '25-NUOC SUOI'],
  [80, 'Nuoc cam ep',           83, '03-NUOC EP CAM'],
  [81, 'Tra da',                85, '05-TRA XANH NHAT'],

  // --- Khai vi / do chien ---
  [72, 'Khai vi ba mon',       316, 'T02-TEMPURA THAP CAM'],
  [73, 'Cha gio',              315, 'T01-TEMPURA TOM'],
  [69, 'Dau hu chien gion',    273, 'D04-DAU HU SOT TERIYAKI'],
  [70, 'Dau hu tu xuyen',      273, 'D04-DAU HU SOT TERIYAKI'],

  // --- Ga ---
  [59, 'Ga ham',               287, 'RA04-RAMEN THIT GA'],
  [60, 'Ga nuong',             268, 'E06-GA VA PHO MAI DUT LO'],
  [67, 'Ga ngo sen',           122, 'SA03-SALAD SUA TRON'],
  [68, 'Ga goi',               122, 'SA03-SALAD SUA TRON'],
  [71, 'Ga goi',               122, 'SA03-SALAD SUA TRON'],

  // --- Bo ---
  [54, 'Bo lagu',              276, 'L02-SUP GAN BO'],
  [55, 'Bo nuong Y',           261, 'B23-WAGYU TEPPANYAKI'],
  [56, 'Bo nuong da',          262, 'B24-BO WAGYU NUONG DA'],
  [57, 'Bo ham',               276, 'L02-SUP GAN BO'],

  // --- Heo ---
  [48, 'Heo nuong',            284, 'RA01-RAMEN THIT HEO CHASIU'],
  [58, 'Heo len met',          311, 'K10-COM THIT HEO CHIEN XU VA TRUNG'],
  [74, 'Suon heo ngon',        286, 'RA03-RAMEN THIT HEO BAM'],
  [75, 'Heo quay',             284, 'RA01-RAMEN THIT HEO CHASIU'],

  // --- Com / mi ---
  [49, 'Hu tieu ap chao',      291, 'U04-UDON XAO BO MY'],
  [50, 'Com chien Loc Phat',   307, 'K06-COM CHIEN HAI SAN'],
  [51, 'Mien xao cua',         282, 'PA01-MI CUA'],
  [52, 'Com xa xiu',           311, 'K10-COM THIT HEO CHIEN XU VA TRUNG'],

  // --- Trang mieng ---
  [61, 'Trai cay 1',           326, 'DE05-PANNA COTTA DAU'],
  [62, 'Trai cay 2',           327, 'DE06-PANNA COTTA CHANH DAY'],
  [63, 'Rau cau 1',            328, 'DE07-PANNA COTTA VIET QUAT'],
  [64, 'Rau cau 2',            326, 'DE05-PANNA COTTA DAU'],
];

async function anhXaLichSu(conn) {
  // Doc ten + anh that cua mon moi tu CSDL, khong go cung vao script.
  const idMoi = [...new Set(ANH_XA.map((d) => d[2]))];
  const [ds] = await conn.query(
    `SELECT id_mon, name_mon, images FROM monan WHERE id_mon IN (${idMoi.map(() => '?').join(',')})`,
    idMoi
  );
  const monMoi = new Map(ds.map((m) => [m.id_mon, m]));

  const thieu = idMoi.filter((id) => !monMoi.has(id));
  if (thieu.length) {
    throw new Error(`Mon thay the khong ton tai trong bang monan: ${thieu.join(', ')}`);
  }

  let donHang = 0;
  let xuatKho = 0;
  console.log('\n  Mon cu                          ->  Mon thay the                          don | kho');
  console.log('  ' + '-'.repeat(88));

  for (const [idCu, tenCu, idMoiCua] of ANH_XA) {
    const m = monMoi.get(idMoiCua);

    // Doi ca ten va anh: dong don hang luu san ban sao cua chung, khong doi thi
    // bao cao van hien ten mon cu du id da tro sang mon moi.
    const [kqDon] = await conn.query(
      'UPDATE hopdong SET id_mon = ?, name_mon = ?, images = ? WHERE id_mon = ?',
      [idMoiCua, m.name_mon, m.images, idCu]
    );
    const [kqKho] = await conn.query('UPDATE xuat_kho SET id_mon = ? WHERE id_mon = ?', [idMoiCua, idCu]);

    donHang += kqDon.affectedRows;
    xuatKho += kqKho.affectedRows;
    console.log(
      `  ${tenCu.padEnd(30)} ->  ${String(m.name_mon).trim().padEnd(36)} ${String(kqDon.affectedRows).padStart(3)} | ${String(kqKho.affectedRows).padStart(3)}`
    );
  }

  console.log(`\n  Tong: ${donHang} dong don hang, ${xuatKho} dong xuat kho da chuyen sang mon moi.`);
  return { donHang, xuatKho };
}

/**
 * Xoa anh khong con bang nao nhac toi. Quet TAT CA cot co the chua ten tep chu
 * khong rieng `monan.images`: `hopdong.images` cung luu ten anh, va truoc khi
 * anh xa no con giu anh cua mon cu - quet thieu la xoa nham anh cua lich su.
 */
async function xoaAnhMoCoi(conn) {
  const [cot] = await conn.query(
    `SELECT TABLE_NAME t, COLUMN_NAME c FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND (COLUMN_NAME LIKE '%image%' OR COLUMN_NAME LIKE '%anh%' OR COLUMN_NAME LIKE '%hinh%')`
  );

  const dangDung = new Set();
  for (const { t, c } of cot) {
    const [r] = await conn.query(`SELECT DISTINCT \`${c}\` v FROM \`${t}\` WHERE \`${c}\` IS NOT NULL AND \`${c}\` <> ''`);
    for (const x of r) {
      const ten = String(x.v).trim().split('/').pop();
      if (ten) dangDung.add(ten);
    }
  }

  let soXoa = 0;
  let byte = 0;
  for (const thuMuc of ['images/food', 'food']) {
    const p = path.join(GOC, thuMuc);
    if (!fs.existsSync(p)) continue;
    let cuaThuMuc = 0;
    for (const ten of fs.readdirSync(p)) {
      const tep = path.join(p, ten);
      if (!fs.statSync(tep).isFile() || dangDung.has(ten)) continue;
      byte += fs.statSync(tep).size;
      fs.unlinkSync(tep);
      cuaThuMuc++;
    }
    soXoa += cuaThuMuc;
    console.log(`  ${thuMuc}/: da xoa ${cuaThuMuc} tep mo coi`);
  }
  console.log(`  Giai phong ${(byte / 1048576).toFixed(1)} MB.`);
  return soXoa;
}

async function kiemTra(conn) {
  const [[don]] = await conn.query(
    'SELECT COUNT(*) n FROM hopdong WHERE id_mon <> 0 AND id_mon NOT IN (SELECT id_mon FROM monan)'
  );
  const [[kho]] = await conn.query(
    'SELECT COUNT(*) n FROM xuat_kho WHERE id_mon IS NOT NULL AND id_mon NOT IN (SELECT id_mon FROM monan)'
  );
  const [[qr]] = await conn.query("SELECT COUNT(*) n FROM hopdong WHERE id_mon = 0");
  const [[tong]] = await conn.query('SELECT COUNT(*) n, SUM(thanhtien) tien FROM hopdong');

  console.log(`  hopdong con dong treo : ${don.n}  (phai la 0)`);
  console.log(`  xuat_kho con dong treo: ${kho.n}  (phai la 0)`);
  console.log(`  dong danh dau QR giu lai: ${qr.n}  (phai la 10)`);
  console.log(`  hopdong: ${tong.n} dong, tong tien ${Number(tong.tien).toLocaleString('vi-VN')}`);

  if (don.n || kho.n) throw new Error('Van con dong tro toi mon khong ton tai.');
}

async function main() {
  console.log('=== Migration 025: thay mon cu bang mon moi ===');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const kq = await anhXaLichSu(conn);
    await conn.commit();

    console.log('\n--- Xoa anh mon cu khong con ai dung ---');
    await xoaAnhMoCoi(conn);

    console.log('\n--- Kiem tra lai ---');
    await kiemTra(conn);

    console.log('\n=== Hoan tat migration 025 ===');
    console.log(`  ${kq.donHang} dong don hang + ${kq.xuatKho} dong xuat kho gio tro toi mon Nhat.`);
  } catch (err) {
    await conn.rollback();
    console.error('Migration that bai - da hoan tac phan CSDL:', err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await db.end();
  }
}

main();
