/**
 * Migration 032 - KDS: ghi nhan AI xac nhan len mon va LUC NAO.
 *
 * Chay: node config/migrations/032_kds_xac_nhan_len_mon.js  (npm run kds:setup)
 * Idempotent.
 *
 * Khong dung lai cot `id_nv_phuc_vu` co san: cot do la nhan vien PHU TRACH don
 * (bao cao phuc vu, doanh so theo nhan vien dung no). Nguoi BUNG MON ra ban co
 * the la nguoi khac - ghi de len se lam sai bao cao doanh so.
 */
const db = require('../db');

async function coCot(bang, cot) {
  const [rows] = await db.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [bang, cot]);
  return rows.length > 0;
}

async function main() {
  console.log('Migration 032 - KDS xác nhận lên món');
  if (!(await coCot('hopdong', 'nv_len_mon'))) {
    await db.query("ALTER TABLE hopdong ADD COLUMN nv_len_mon INT NULL COMMENT 'Nhan vien xac nhan da mang mon ra ban'");
  }
  if (!(await coCot('hopdong', 'len_mon_luc'))) {
    await db.query("ALTER TABLE hopdong ADD COLUMN len_mon_luc DATETIME NULL COMMENT 'Thoi diem xac nhan len mon'");
  }
  console.log('Migration 032 hoàn tất.');
  await db.end();
}

if (require.main === module) {
  main().catch((e) => { console.error('Migration 032 lỗi:', e.message); process.exitCode = 1; });
}
module.exports = { main };
