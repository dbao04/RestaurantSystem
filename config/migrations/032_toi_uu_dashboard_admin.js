/**
 * Migration 032 - Tối ưu hiệu năng Dashboard Trang Quản trị (/admin)
 *
 * VẤN ĐỀ:
 * Bảng `hopdong` chứa hơn 111.000 dòng. Các truy vấn tính tổng doanh thu
 * `SELECT SUM(thanhtien) FROM hopdong WHERE tinhtrang = 3` và
 * `SELECT MONTH(ngay_dat) ... GROUP BY MONTH(ngay_dat)` bị quét bảng tuần tự
 * (table scan) mất từ 8 đến 10 giây mỗi lần tải trang quản trị.
 *
 * GIẢI PHÁP:
 * 1. `idx_hopdong_tt_thanhtien (tinhtrang, thanhtien)`: Covering index cho tổng doanh thu.
 * 2. `idx_hopdong_perf (tinhtrang, ngay_dat, id_mon, thanhtien)`: Covering index cho thống kê tháng.
 */
const db = require('../db');

async function coKhoa(bang, ten) {
  const [r] = await db.query(
    `SELECT COUNT(*) AS n FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [bang, ten]
  );
  return r[0].n > 0;
}

async function main() {
  console.log('=== Migration 032: Tối ưu Dashboard Admin & Doanh thu ===\n');

  if (await coKhoa('hopdong', 'idx_hopdong_tt_thanhtien')) {
    console.log('✓ idx_hopdong_tt_thanhtien: đã có');
  } else {
    console.log('+ Thêm index idx_hopdong_tt_thanhtien (tinhtrang, thanhtien)...');
    await db.query('ALTER TABLE hopdong ADD INDEX idx_hopdong_tt_thanhtien (tinhtrang, thanhtien)');
    console.log('✓ Đã tạo idx_hopdong_tt_thanhtien');
  }

  if (await coKhoa('hopdong', 'idx_hopdong_perf')) {
    console.log('✓ idx_hopdong_perf: đã có');
  } else {
    console.log('+ Thêm index idx_hopdong_perf (tinhtrang, ngay_dat, id_mon, thanhtien)...');
    await db.query('ALTER TABLE hopdong ADD INDEX idx_hopdong_perf (tinhtrang, ngay_dat, id_mon, thanhtien)');
    console.log('✓ Đã tạo idx_hopdong_perf');
  }

  console.log('\n=== Hoàn thành Migration 032! ===');
  process.exit(0);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Lỗi migration 032:', err);
    process.exit(1);
  });
}

module.exports = main;
