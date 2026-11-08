/**
 * Migration 037 - KHACH DUOC DOI MON DA DAT TRUOC (gioi han theo so ngay).
 *
 * Chay: node config/migrations/037_doi_mon_dat_truoc.js   (npm run doimon:setup)
 * Idempotent: INSERT IGNORE, khong ghi de neu quan ly da tung chinh gia tri nay.
 *
 * Them 1 tham so vao reservation_settings (cung bang voi minimum_lead_minutes,
 * max_advance_days... - xem services/reservationRules.js MAC_DINH):
 *
 *   - dish_edit_cutoff_days: so ngay toi thieu truoc gio dat ma khach/nhan vien
 *     con duoc sua danh sach mon goi truoc (services/reservationService.js
 *     capNhatMonDatTruoc). Mac dinh 1 ngay - du de bep chuan bi nguyen lieu ma
 *     khong qua gat gao voi khach doi y sat ngay. Sua duoc tu trang quan tri
 *     cau hinh dat ban (services/reservationConfig.js KHOA_CHO_PHEP).
 */
const db = require('../db');

(async () => {
  try {
    await db.query(
      `INSERT IGNORE INTO reservation_settings (setting_key, setting_value) VALUES (?, ?)`,
      ['dish_edit_cutoff_days', '1']
    );
    console.log('[037] tham so reservation_settings.dish_edit_cutoff_days = 1 (mac dinh, neu chua co)');
    console.log('[037] Xong.');
    process.exit(0);
  } catch (e) {
    console.error('[037] Loi:', e.message);
    process.exit(1);
  }
})();
