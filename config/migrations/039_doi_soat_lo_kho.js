/**
 * Migration 039 - DOI SOAT TON KHO voi LO HANG.
 *
 * Chay thu (chi in, khong ghi):  node config/migrations/039_doi_soat_lo_kho.js --thu
 * Chay that:                      node config/migrations/039_doi_soat_lo_kho.js   (npm run kho:doisoat)
 * Idempotent: chay lai khi da khop thi khong lam gi.
 *
 * Van de: truoc day co HAI duong nhap kho. Nut "Nhap kho" cu chi cong vao
 * nguyen_lieu.so_luong, khong tao lo (chi_tiet_phieu_nhap) -> tong ton va tong
 * cac lo con lai lech nhau. Lo la nguon cho canh bao het han va tru kho FIFO,
 * nen lech la hai tinh nang do sai.
 *
 * Doi soat cho tung nguyen lieu (lay nguyen_lieu.so_luong lam chuan - day la
 * con so bep van dung hang ngay):
 *   - ton > tong lo: tao MOT phieu nhap "ton dau ky" (PNDK-...) chua mot lo
 *     cho phan chenh, gia = gia von hien tai, han dung de trong (khong biet
 *     that). KHONG cong them vao so_luong.
 *   - tong lo > ton: tru bot lo theo FIFO (han som nhat truoc).
 */
const db = require('../db');
const { truLoFIFO } = require('../../services/khoBepService');

const CHAY_THU = process.argv.includes('--thu');
const SAI_SO = 0.01; // cot FLOAT: sai so lam tron

(async () => {
  const conn = await db.getConnection();
  try {
    const [ds] = await conn.query(
      `SELECT nl.id_nl, nl.ten_nl, GREATEST(nl.so_luong, 0) AS ton, nl.gia_von,
              COALESCE(SUM(ct.so_luong_con_lai), 0) AS tong_lo
       FROM nguyen_lieu nl LEFT JOIN chi_tiet_phieu_nhap ct ON ct.id_nl = nl.id_nl
       GROUP BY nl.id_nl, nl.ten_nl, nl.so_luong, nl.gia_von`);
    const thieuLo = ds.filter((r) => Number(r.ton) - Number(r.tong_lo) > SAI_SO);
    const thuaLo = ds.filter((r) => Number(r.tong_lo) - Number(r.ton) > SAI_SO);
    console.log(`[039] ${ds.length} nguyên liệu | thiếu lô: ${thieuLo.length} | lô dư: ${thuaLo.length}`);
    for (const r of [...thieuLo, ...thuaLo].slice(0, 8)) {
      console.log(`      ${r.ten_nl}: tồn ${Number(r.ton)} / tổng lô ${Number(r.tong_lo)}`);
    }
    if (CHAY_THU) { console.log('[039] Chạy thử - không ghi gì.'); process.exit(0); }
    if (!thieuLo.length && !thuaLo.length) { console.log('[039] Đã khớp, không cần đối soát.'); process.exit(0); }

    await conn.beginTransaction();
    if (thieuLo.length) {
      const ngay = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      let ma = `PNDK-${ngay}`;
      for (let i = 2; ; i++) {
        const [[co]] = await conn.query('SELECT 1 AS c FROM phieu_nhap WHERE ma_phieu = ?', [ma]);
        if (!co) break;
        ma = `PNDK-${ngay}-${i}`;
      }
      const tong = thieuLo.reduce((s, r) => s + (Number(r.ton) - Number(r.tong_lo)) * Number(r.gia_von || 0), 0);
      const [kq] = await conn.query(
        `INSERT INTO phieu_nhap (ma_phieu, id_ncc, id_nv, ngay_nhap, thoi_diem, tong_tien, ghi_chu, trangthai)
         VALUES (?, NULL, NULL, CURDATE(), NOW(), ?, ?, 1)`,
        [ma, Math.round(tong), 'Tồn đầu kỳ - đối soát tồn kho với lô (migration 039). Không phát sinh nhập hàng thật.']);
      for (const r of thieuLo) {
        const chenh = Math.round((Number(r.ton) - Number(r.tong_lo)) * 1000) / 1000;
        await conn.query(
          `INSERT INTO chi_tiet_phieu_nhap (id_pn, id_nl, so_luong, gia_nhap, so_lo, han_su_dung, so_luong_con_lai)
           VALUES (?, ?, ?, ?, 'TON-DAU-KY', NULL, ?)`,
          [kq.insertId, r.id_nl, chenh, Number(r.gia_von || 0), chenh]);
      }
      console.log(`[039] Tạo phiếu ${ma} với ${thieuLo.length} lô tồn đầu kỳ.`);
    }
    for (const r of thuaLo) {
      await truLoFIFO(conn, r.id_nl, Number(r.tong_lo) - Number(r.ton));
    }
    if (thuaLo.length) console.log(`[039] Trừ lô dư FIFO cho ${thuaLo.length} nguyên liệu.`);
    await conn.commit();
    console.log('[039] Xong.');
    process.exit(0);
  } catch (e) {
    await conn.rollback().catch(() => {});
    console.error('[039] Loi:', e.message);
    process.exit(1);
  } finally {
    conn.release();
  }
})();
