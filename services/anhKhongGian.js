/**
 * Moi khu tren trang /khong-gian du 4 anh nho (hang anh nho chia 4 cot -
 * css/su-kien.css .kg-gallery__thumbs). Khu chi co 3 anh -> them anh thu 4
 * phu hop tu thu vien anh co san.
 *
 * Chay tu dong khi server khoi dong (server.js) - may nao pull code ve cung co,
 * khong can chay tay. Idempotent: chi them khi khu dang co DUNG 3 anh.
 */
const db = require('../config/db');

const ANH_THEM = {
  'Phòng VIP': '/images/khong-gian/mon-1.jpg',
  'Sảnh chính': '/images/khong-gian/gia-dinh-1.jpg',
  'Sân vườn': '/images/khong-gian/party-1.jpg',
  'Tầng 2': '/images/khong-gian/party-3.jpg',
};

async function damBao() {
  let n = 0;
  for (const [ten, anh] of Object.entries(ANH_THEM)) {
    const [[k]] = await db.query('SELECT id_vitri, thu_vien_anh FROM vitri WHERE Name_vitri = ?', [ten]);
    if (!k) continue;
    let ds = [];
    try { ds = JSON.parse(k.thu_vien_anh || '[]'); } catch (_) { ds = []; }
    if (!Array.isArray(ds) || ds.length !== 3 || ds.includes(anh)) continue;
    ds.push(anh);
    await db.query('UPDATE vitri SET thu_vien_anh = ? WHERE id_vitri = ?', [JSON.stringify(ds), k.id_vitri]);
    n++;
  }
  return n;
}

module.exports = { damBao, ANH_THEM };
