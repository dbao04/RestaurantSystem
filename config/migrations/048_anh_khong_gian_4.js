/**
 * Migration 048 - MOI KHU CO DU 4 ANH (trang /khong-gian).
 *
 * KHONG CAN chay tay: server tu goi services/anhKhongGian.damBao() moi lan khoi
 * dong. File nay giu de chay rieng khi can (vd. sau khi nhap lai CSDL):
 *   node config/migrations/048_anh_khong_gian_4.js
 */
require('dotenv').config({ quiet: true });

(async () => {
  try {
    const n = await require('../../services/anhKhongGian').damBao();
    console.log(`[048] Đã thêm ảnh thứ 4 cho ${n} khu.`);
    process.exit(0);
  } catch (e) {
    console.error('[048] Lỗi:', e.message);
    process.exit(1);
  }
})();
