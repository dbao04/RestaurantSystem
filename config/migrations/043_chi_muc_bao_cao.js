/**
 * Migration 043 - CHI MUC CHO BAO CAO LAI LO / PHAN TICH THUC DON.
 *
 * Chay: node config/migrations/043_chi_muc_bao_cao.js   (npm run baocao:chimuc)
 * Idempotent.
 *
 * Bao cao lai lo 12 thang quet ~140.000 dong hopdong. Voi chi muc cu MariaDB
 * di theo (tinhtrang, id_mon, soluong) roi doc tung dong o bang chinh: ~8.5
 * giay moi truy van. Hai chi muc BAO PHU duoi day chua du cot truy van can nen
 * khong phai doc bang chinh.
 */
const db = require('../db');

const CHI_MUC = [
  ['idx_hopdong_bc_mon', '(tinhtrang, ngay_dat, id_mon, soluong, thanhtien)'],
  ['idx_hopdong_bc_don', '(tinhtrang, ngay_dat, sesis)'],
];

(async () => {
  try {
    for (const [ten, cot] of CHI_MUC) {
      const [co] = await db.query('SHOW INDEX FROM hopdong WHERE Key_name = ?', [ten]);
      if (co.length) { console.log(`[043] ${ten} đã có`); continue; }
      await db.query(`CREATE INDEX ${ten} ON hopdong ${cot}`);
      console.log(`[043] tạo ${ten} ${cot}`);
    }
    console.log('[043] Xong.');
    process.exit(0);
  } catch (e) {
    console.error('[043] Loi:', e.message);
    process.exit(1);
  }
})();
