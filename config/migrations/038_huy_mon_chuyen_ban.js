/**
 * Migration 038 - HUY MON, CHUYEN / GOP BAN, BAO HET MON THEO KHO.
 *
 * Chay: node config/migrations/038_huy_mon_chuyen_ban.js   (npm run vanhanh:setup)
 * Idempotent: chay lai khong hong gi, khong ghi de tham so quan tri da chinh.
 *
 * - huy_mon     : nhat ky moi lan huy / tra mon (services/huyMonService.js).
 * - chuyen_ban  : nhat ky chuyen ban / gop ban (services/chuyenBanService.js).
 * - cau_hinh 'kho.chan_khi_het_mon' = '1': chan goi mon khi kho khong du
 *   nguyen lieu (services/tonMonService.js). Dat '0' de tat.
 *
 * Hai service tren cung tu tao bang neu chua co.
 */
const db = require('../db');
const huyMon = require('../../services/huyMonService');
const chuyenBan = require('../../services/chuyenBanService');

(async () => {
  try {
    await huyMon.damBaoBang();
    console.log('[038] bang huy_mon');
    await chuyenBan.damBaoBang();
    console.log('[038] bang chuyen_ban');
    await db.query(
      "INSERT IGNORE INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES ('kho.chan_khi_het_mon', '1', ?)",
      ['1 = chặn gọi món khi kho không đủ nguyên liệu; 0 = tắt']);
    console.log('[038] tham so kho.chan_khi_het_mon');
    console.log('[038] Xong.');
    process.exit(0);
  } catch (e) {
    console.error('[038] Loi:', e.message);
    process.exit(1);
  }
})();
