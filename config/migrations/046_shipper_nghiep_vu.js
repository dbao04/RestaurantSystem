/**
 * Migration 046 - NGHIEP VU SHIPPER NHA HANG.
 *
 * Chay: node config/migrations/046_shipper_nghiep_vu.js   (npm run shipper:nghiepvu)
 * Idempotent. Server cung tu goi khi can (services/shipperNghiepVu.damBaoCauTruc),
 * file nay de chay truoc cho chac.
 *
 * Them vao don_giao_hang: kiem_hang_luc, den_noi_luc, so_lan_goi, goi_cuoi_luc,
 * ma_nhan_hang (OTP 4 so), xac_nhan_giao, ma_ly_do_that_bai, hoan_hang,
 * hoan_hang_luc, nhan_lai_boi, su_co, su_co_luc.
 * Them shipper.ca_bat_dau va bang ca_shipper (bien ban chot ca).
 * Them cau_hinh giao_hang.phut_cho_khach (5) va giao_hang.so_lan_goi_toi_thieu (2).
 */
require('dotenv').config({ quiet: true });
const db = require('../db');

(async () => {
  try {
    await require('../../services/shipperNghiepVu').damBaoCauTruc();
    console.log('[046] cot don_giao_hang, shipper.ca_bat_dau, bang ca_shipper');
    await db.query(
      `INSERT IGNORE INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES
        ('giao_hang.phut_cho_khach', '5', 'Số phút shipper phải chờ tại điểm giao trước khi được báo "khách không nghe máy"'),
        ('giao_hang.so_lan_goi_toi_thieu', '2', 'Số lần gọi khách tối thiểu trước khi được báo "khách không nghe máy"')`);
    console.log('[046] cau_hinh giao_hang.phut_cho_khach, giao_hang.so_lan_goi_toi_thieu');
    console.log('[046] Xong.');
    process.exit(0);
  } catch (e) {
    console.error('[046] Loi:', e.message);
    process.exit(1);
  }
})();
