/**
 * Migration 010 - Gan anh cho cac mon do uong.
 *
 * MUC TIEU
 * --------
 * Migration 002 (napDoUong) them 6 mon thuoc danh muc "Đồ uống" nhung khong dat
 * cot `monan.images`, nen ngoai trang menu/trang chu cac mon nay roi ve anh du
 * phong `bg_1..5.jpg` (anh khong gian nha hang) - nhin khong ra do uong.
 *
 * Script gan ten file anh tuong ung cho tung mon. File anh nam trong
 * `images/food/` (cung cho voi anh cac mon an hien co; server.js phuc vu thu muc
 * `images` o root nen duong dan `/food/<ten-file>` trong view van dung).
 *
 * AN TOAN / CHAY LAI NHIEU LAN
 * ----------------------------
 * Chi ghi de khi cot `images` dang trong (NULL hoac chuoi rong). Neu quan tri
 * vien da tu upload anh khac cho mon do thi script BO QUA, khong dap len.
 * Dung co `--ep` de buoc gan lai theo bang duoi day.
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');

// Thu muc chua file anh thuc te
const THU_MUC_ANH = path.join(__dirname, '..', '..', 'images', 'food');

// [ten_mon trong bang monan, ten file anh]
const ANH_DO_UONG = [
  ['Coca-Cola', 'coca-cola.jpg'],
  ['Pepsi', 'pepsi.jpg'],
  ['Bia Tiger', 'bia-tiger.jpg'],
  ['Nước suối', 'nuoc-suoi.jpg'],
  ['Nước cam ép', 'nuoc-cam-ep.jpg'],
  ['Trà đá', 'tra-da.jpg'],
];

const EP = process.argv.includes('--ep');

function kiemTraFileAnh() {
  const thieu = ANH_DO_UONG.filter(([, f]) => !fs.existsSync(path.join(THU_MUC_ANH, f)));
  if (thieu.length) {
    throw new Error(
      `Thieu file anh trong ${THU_MUC_ANH}: ` + thieu.map(([, f]) => f).join(', ')
    );
  }
}

async function ganAnh() {
  let gan = 0;
  let boQua = 0;
  const khongThayMon = [];

  for (const [tenMon, file] of ANH_DO_UONG) {
    const [rows] = await db.query(
      'SELECT id_mon, images FROM monan WHERE TRIM(name_mon) = ?',
      [tenMon]
    );
    if (!rows.length) {
      khongThayMon.push(tenMon);
      continue;
    }

    for (const mon of rows) {
      const dangTrong = !mon.images || !String(mon.images).trim();
      if (!dangTrong && !EP) {
        console.log(`  - ${tenMon}: da co anh (${mon.images}), bo qua`);
        boQua++;
        continue;
      }
      await db.query('UPDATE monan SET images = ? WHERE id_mon = ?', [file, mon.id_mon]);
      console.log(`  + ${tenMon} -> ${file}`);
      gan++;
    }
  }

  if (khongThayMon.length) {
    console.log(`\n  ! Khong tim thay mon: ${khongThayMon.join(', ')}`);
    console.log('    (chay migration 002_master_data.js truoc de tao nhom do uong)');
  }
  return { gan, boQua };
}

async function main() {
  console.log('=== Migration 010: gán ảnh cho món đồ uống ===');
  if (EP) console.log('Che do --ep: ghi de ca nhung mon da co anh.\n');

  kiemTraFileAnh();
  const { gan, boQua } = await ganAnh();

  const [conThieu] = await db.query(`
    SELECT m.name_mon
      FROM monan m
      JOIN loai_mon l ON l.id_loai = m.id_loai
     WHERE l.name_loai = 'Đồ uống'
       AND (m.images IS NULL OR m.images = '')`);

  console.log('\n=== Xong ===');
  console.log(`Đã gán: ${gan} · Bỏ qua (đã có ảnh): ${boQua}`);
  if (conThieu.length) {
    console.log(`Đồ uống vẫn chưa có ảnh: ${conThieu.map((r) => r.name_mon).join(', ')}`);
  } else {
    console.log('Tất cả món trong danh mục "Đồ uống" đều đã có ảnh.');
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => { console.error('\nMigration 010 lỗi:', e.message); process.exit(1); });
}

module.exports = { main, ANH_DO_UONG };
