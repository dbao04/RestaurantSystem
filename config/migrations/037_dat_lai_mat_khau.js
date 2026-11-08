/**
 * Migration 037 - DAT LAI MAT KHAU bang link co han dung.
 *
 * Chay: node config/migrations/037_dat_lai_mat_khau.js   (npm run taikhoan:setup)
 * Idempotent: chay lai khong hong gi.
 *
 * - dat_lai_mat_khau: moi lan khach bam "Quen mat khau". Chi luu SHA-256 cua
 *   token (khong luu token goc), han 30 phut, dung mot lan.
 *
 * services/datLaiMatKhauService.js cung tu tao bang nay neu chua co, nen quen
 * chay migration cung khong vo trang quen mat khau.
 */
const { damBaoBang } = require('../../services/datLaiMatKhauService');

(async () => {
  try {
    await damBaoBang();
    console.log('[037] bang dat_lai_mat_khau');
    console.log('[037] Xong.');
    process.exit(0);
  } catch (e) {
    console.error('[037] Loi:', e.message);
    process.exit(1);
  }
})();
