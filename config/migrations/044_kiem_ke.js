/**
 * Migration 044 - KIEM KE KHO DINH KY.
 *
 * Chay: node config/migrations/044_kiem_ke.js   (npm run kho:kiemke)
 * Idempotent. Bang kiem_ke + kiem_ke_dong - xem services/kiemKeService.js
 * (service cung tu tao bang neu chua chay migration).
 */
const { damBaoBang } = require('../../services/kiemKeService');

(async () => {
  try {
    await damBaoBang();
    console.log('[044] bang kiem_ke, kiem_ke_dong');
    console.log('[044] Xong.');
    process.exit(0);
  } catch (e) {
    console.error('[044] Loi:', e.message);
    process.exit(1);
  }
})();
