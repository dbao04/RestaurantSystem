/**
 * Migration 017 - Vá lỗ hổng luồng đặt món QR + thêm ghi chú theo món.
 *
 * LAM GI
 *   1. Them cot `hopdong.ghi_chu_mon` - ghi chu cua KHACH cho tung mon
 *      ("it cay", "khong hanh", "khong da").
 *
 *      Vi sao khong dung lai cot `noidung` co san: `noidung` la ghi chu chung
 *      cua ca DON (vd "QR Order - Ban 5"), duoc `addMultipleDishesToOrder`
 *      chep nguyen tu dong dau xuong moi dong mon. Nhet ghi chu rieng cua tung
 *      mon vao do se pha vo y nghia cua cot va lam hong cac truy van dang doc
 *      `noidung` de lay ten ban.
 *
 *   2. Vo hieu hoa mat khau cua cac tai khoan khach vang lai QR da tao truoc
 *      day.
 *
 *      LO HONG: `createQROrder` tao tai khoan `khach_hang` voi
 *          sodienthoai = 'QR_' + tableId
 *          passwords   = md5('qr' + tableId)
 *      ma `tableId` thi IN NGAY TREN MA QR dan o ban. Bat ky ai quet ma cung
 *      suy ra duoc mat khau va dang nhap vao tai khoan do, thay duoc lich su
 *      don cua moi khach tung ngoi ban ay.
 *
 *      Cot `passwords` la NOT NULL nen khong dat NULL duoc. Thay bang mot chuoi
 *      danh dau khong phai 32 ky tu hex - md5() khong bao gio sinh ra duoc gia
 *      tri nhu vay, nen phep so sanh trong `userLogin` khong the khop. Day la
 *      lop chan thu nhat; lop thu hai la kiem tra tien to 'QR_' ngay trong
 *      `userLogin` (xem services/orderService.js).
 *
 * Chay lai duoc nhieu lan (idempotent).
 */
const db = require('../db');

// Khong phai 32 ky tu hex => md5() khong the sinh ra => khong the dang nhap.
const MAT_KHAU_VO_HIEU = '!QR_KHONG_DANG_NHAP';

async function themCotGhiChu() {
  console.log('\n[1/3] Them cot hopdong.ghi_chu_mon');
  const [co] = await db.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'hopdong'
       AND column_name = 'ghi_chu_mon'`
  );
  if (co[0].n > 0) {
    console.log('  Da co san - bo qua.');
    return;
  }
  await db.query(
    `ALTER TABLE hopdong
     ADD COLUMN ghi_chu_mon VARCHAR(255) NULL
     COMMENT 'Ghi chu cua khach cho rieng mon nay (it cay, khong hanh...)'`
  );
  console.log('  Da them cot.');
}

async function voHieuMatKhauQR() {
  console.log('\n[2/3] Vo hieu hoa mat khau tai khoan khach vang lai QR');
  const [truoc] = await db.query(
    `SELECT COUNT(*) AS n FROM khach_hang
     WHERE sodienthoai LIKE 'QR\\_%' AND passwords <> ?`,
    [MAT_KHAU_VO_HIEU]
  );
  if (truoc[0].n === 0) {
    console.log('  Khong co tai khoan nao can sua.');
    return;
  }
  const [kq] = await db.query(
    `UPDATE khach_hang SET passwords = ?
     WHERE sodienthoai LIKE 'QR\\_%' AND passwords <> ?`,
    [MAT_KHAU_VO_HIEU, MAT_KHAU_VO_HIEU]
  );
  console.log(`  Da vo hieu ${kq.affectedRows} tai khoan.`);
  console.log('  (Cac tai khoan nay chi dung de gan don QR, khong ai dang nhap bang chung.)');
}

async function kiemTra() {
  console.log('\n[3/3] Kiem tra');
  const [cot] = await db.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'hopdong'
       AND column_name = 'ghi_chu_mon'`
  );
  const [conYeu] = await db.query(
    `SELECT COUNT(*) AS n FROM khach_hang
     WHERE sodienthoai LIKE 'QR\\_%' AND passwords <> ?`,
    [MAT_KHAU_VO_HIEU]
  );
  console.log(`  hopdong.ghi_chu_mon          : ${cot[0].n === 1 ? 'co' : 'THIEU'}`);
  console.log(`  Tai khoan QR con mat khau yeu: ${conYeu[0].n}`);
  if (cot[0].n !== 1 || conYeu[0].n !== 0) {
    throw new Error('Kiem tra sau migration that bai.');
  }
}

async function main() {
  console.log('=== Migration 017: dat mon QR ===');
  await themCotGhiChu();
  await voHieuMatKhauQR();
  await kiemTra();
  console.log('\n=== Hoan tat migration 017 ===');
  await db.end();
}

main().catch((err) => {
  console.error('Migration that bai:', err);
  process.exit(1);
});
