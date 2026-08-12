/**
 * Migration 005 - Mo phong ton kho theo lo (FIFO).
 *
 * Migration 003 tao phieu nhap nhung de `so_luong_con_lai = 0` cho tat ca cac
 * lo, khien panel "lo sap het han" hien thi ca nhung lo tu mot nam truoc.
 * Thuc te kho van hanh FIFO: chi cac lo nhap gan day moi con hang.
 *
 * Quy uoc mo phong: lo cua ky nhap gan nhat con 30-90% so luong, ky truoc do
 * con 0-25%, cac ky cu hon da dung het.
 */
const db = require('../db');

function taoRng(seed) {
  let a = seed >>> 0;
  return function () {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = taoRng(9182736);

async function main() {
  console.log('=== Migration 005: ton kho theo lo ===');

  const [ky] = await db.query(
    `SELECT id_pn, ngay_nhap FROM phieu_nhap ORDER BY ngay_nhap DESC LIMIT 3`
  );
  if (!ky.length) {
    console.log('Chua co phieu nhap nao, bo qua.');
    await db.end();
    return;
  }

  // Mac dinh: moi lo da dung het.
  const [r0] = await db.query('UPDATE chi_tiet_phieu_nhap SET so_luong_con_lai = 0');
  console.log(`  dat lai ${r0.affectedRows} lo ve 0`);

  const tyLe = [[0.30, 0.90], [0.0, 0.25], [0.0, 0.05]];
  for (let i = 0; i < ky.length; i++) {
    const [lo, hi] = tyLe[i];
    // Lay kem so chu so thap phan cua don vi tinh. Truoc day cau nay chi lay
    // so_luong roi lam tron cung mot kieu "2 chu so thap phan" cho MOI nguyen
    // lieu - sinh ra nhung con so vo nghia nhu "156,84 lon bia" hay "169,48
    // qua trung". Don vi dem duoc (lon/chai/cai/bo/hop/goi) co so_le = 0 nen
    // gio se duoc lam tron ve so nguyen. Xem migration 013.
    const [cts] = await db.query(
      `SELECT ct.id_ct, ct.so_luong, COALESCE(d.so_le, 2) AS so_le
       FROM chi_tiet_phieu_nhap ct
       LEFT JOIN nguyen_lieu n ON n.id_nl = ct.id_nl
       LEFT JOIN don_vi_tinh d ON d.id_dvt = n.id_dvt
       WHERE ct.id_pn = ?`,
      [ky[i].id_pn]
    );
    for (const ct of cts) {
      const heSo = Math.pow(10, Number(ct.so_le) || 0);
      const conLai = Math.round(ct.so_luong * (lo + rand() * (hi - lo)) * heSo) / heSo;
      await db.query('UPDATE chi_tiet_phieu_nhap SET so_luong_con_lai = ? WHERE id_ct = ?', [
        conLai,
        ct.id_ct,
      ]);
    }
    const ngay = new Date(ky[i].ngay_nhap).toISOString().slice(0, 10);
    console.log(`  + ky ${ngay}: ${cts.length} lo con ${(lo * 100).toFixed(0)}-${(hi * 100).toFixed(0)}%`);
  }

  // Dong bo ton tong cua nguyen_lieu = tong ton cac lo (voi nhung nguyen lieu
  // co xuat hien trong phieu nhap). Nho vay so lieu kho khop giua 2 bang.
  // ROUND theo so_le cua chinh don vi nguyen lieu do, khong con ap cung 2 chu
  // so thap phan cho tat ca.
  const [sync] = await db.query(`
    UPDATE nguyen_lieu nl
    JOIN don_vi_tinh d ON d.id_dvt = nl.id_dvt
    JOIN (
      SELECT id_nl, SUM(so_luong_con_lai) AS ton
      FROM chi_tiet_phieu_nhap GROUP BY id_nl
    ) t ON t.id_nl = nl.id_nl
    SET nl.so_luong = ROUND(t.ton, COALESCE(d.so_le, 2))`);
  console.log(`  ~ dong bo ton cho ${sync.affectedRows} nguyen lieu`);

  const [kt] = await db.query(`
    SELECT COUNT(*) AS lo_con_hang,
           SUM(CASE WHEN han_su_dung < CURDATE() THEN 1 ELSE 0 END) AS lo_qua_han,
           SUM(CASE WHEN han_su_dung BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 14 DAY) THEN 1 ELSE 0 END) AS lo_sap_han
    FROM chi_tiet_phieu_nhap WHERE so_luong_con_lai > 0`);
  console.table(kt);

  console.log('\n=== Hoan tat migration 005 ===');
  await db.end();
}

main().catch((err) => {
  console.error('Migration that bai:', err);
  process.exit(1);
});
