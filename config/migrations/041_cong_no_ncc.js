/**
 * Migration 041 - CONG NO NHA CUNG CAP.
 *
 * Chay: node config/migrations/041_cong_no_ncc.js   (npm run congno:setup)
 * Idempotent.
 *
 * - phieu_nhap + da_tra, han_thanh_toan
 * - phieu_thu_chi + id_pn, id_ncc (phieu chi tra NCC gan voi phieu nhap)
 * - Lan chay dau: moi phieu nhap DANG CO duoc coi la da tra du (khong co du lieu
 *   thanh toan that cho chung). Cong no chi tinh tu phieu nhap moi.
 * Xem services/congNoNccService.js.
 */
const { damBaoCot } = require('../../services/congNoNccService');

(async () => {
  try {
    const cu = await damBaoCot();
    console.log('[041] cot da_tra, han_thanh_toan (phieu_nhap); id_pn, id_ncc (phieu_thu_chi)');
    if (cu) console.log(`[041] ${cu} phiếu nhập cũ được đánh dấu đã trả đủ.`);
    console.log('[041] Xong.');
    process.exit(0);
  } catch (e) {
    console.error('[041] Loi:', e.message);
    process.exit(1);
  }
})();
