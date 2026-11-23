/**
 * Migration 048 - MOI KHU CO DU 4 ANH (trang /khong-gian).
 *
 * Hang anh nho duoi anh lon chia 4 cot (css/su-kien.css .kg-gallery__thumbs);
 * cac khu chi co 3 anh nen hang bi trong mot o. Them anh thu 4 phu hop tung khu
 * tu thu vien anh co san. Idempotent: chi them khi khu dang co dung 3 anh.
 *
 * Chay: node config/migrations/048_anh_khong_gian_4.js
 */
require('dotenv').config({ quiet: true });
const db = require('../db');

const ANH_THEM = {
  'Phòng VIP': '/images/khong-gian/mon-1.jpg',
  'Sảnh chính': '/images/khong-gian/gia-dinh-1.jpg',
  'Sân vườn': '/images/khong-gian/party-1.jpg',
  'Tầng 2': '/images/khong-gian/party-3.jpg',
};

(async () => {
  try {
    let n = 0;
    for (const [ten, anh] of Object.entries(ANH_THEM)) {
      const [[k]] = await db.query('SELECT id_vitri, thu_vien_anh FROM vitri WHERE Name_vitri = ?', [ten]);
      if (!k) continue;
      let ds = [];
      try { ds = JSON.parse(k.thu_vien_anh || '[]'); } catch (_) { ds = []; }
      if (ds.length !== 3 || ds.includes(anh)) continue;
      ds.push(anh);
      await db.query('UPDATE vitri SET thu_vien_anh = ? WHERE id_vitri = ?', [JSON.stringify(ds), k.id_vitri]);
      n++;
    }
    console.log(`[048] Đã thêm ảnh thứ 4 cho ${n} khu.`);
    process.exit(0);
  } catch (e) {
    console.error('[048] Lỗi:', e.message);
    process.exit(1);
  }
})();
