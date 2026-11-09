/**
 * Migration 045 - BAT NHAN VIEN DOI MAT KHAU MAC DINH.
 *
 * Chay: node config/migrations/045_doi_mk_nhan_vien.js   (npm run taikhoan:doimk)
 * Idempotent. Them khoa cau_hinh bao_mat.bat_doi_mk_nhan_vien = 1 (bat).
 * Dat = 0 de tat (VD may demo dung chung mat khau 123456).
 */
require('dotenv').config({ quiet: true });
const db = require('../db');

(async () => {
  try {
    await db.query(
      `INSERT IGNORE INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES ('bao_mat.bat_doi_mk_nhan_vien', '1',
        'Nhân viên đăng nhập bằng mật khẩu mặc định 123456 phải đổi mật khẩu trước khi dùng hệ thống (1 = bật, 0 = tắt)')`);
    console.log('[045] cau_hinh bao_mat.bat_doi_mk_nhan_vien');
    console.log('[045] Xong.');
    process.exit(0);
  } catch (e) {
    console.error('[045] Loi:', e.message);
    process.exit(1);
  }
})();
