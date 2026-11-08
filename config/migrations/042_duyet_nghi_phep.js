/**
 * Migration 042 - DUYET NGHI PHEP THEO CAP TREN.
 *
 * Chay: node config/migrations/042_duyet_nghi_phep.js   (npm run nghiphep:setup)
 * Idempotent.
 *
 * nghi_phep them: nguoi_duyet, duyet_luc, ly_do_tu_choi.
 * Xem services/nghiPhepService.js (service cung tu them cot neu thieu).
 */
const { damBaoCot } = require('../../services/nghiPhepService');

(async () => {
  try {
    await damBaoCot();
    console.log('[042] cot nguoi_duyet, duyet_luc, ly_do_tu_choi');
    console.log('[042] Xong.');
    process.exit(0);
  } catch (e) {
    console.error('[042] Loi:', e.message);
    process.exit(1);
  }
})();
