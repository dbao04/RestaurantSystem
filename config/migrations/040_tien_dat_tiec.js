/**
 * Migration 040 - TIEN DAT TIEC (coc, thanh toan, hoan coc).
 *
 * Chay: node config/migrations/040_tien_dat_tiec.js   (npm run tiec:tien)
 * Idempotent.
 *
 * dat_tiec them: tien_coc, da_thu, tong_thuc_te, ly_do_huy. Tien that ghi o
 * bang payments (sesis = ma_tiec) - xem services/datTiecService.capNhatTrangThai.
 * Service cung tu them cot neu chua chay migration nay.
 */
const { damBaoCotTien } = require('../../services/datTiecService');

(async () => {
  try {
    await damBaoCotTien();
    console.log('[040] cot tien_coc, da_thu, tong_thuc_te, ly_do_huy');
    console.log('[040] Xong.');
    process.exit(0);
  } catch (e) {
    console.error('[040] Loi:', e.message);
    process.exit(1);
  }
})();
