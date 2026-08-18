/**
 * Migration 024 - Chi muc cho truy van "mon ban chay" cua trang chu.
 *
 * VAN DE
 * ------
 * Trang chu xep mon theo tong so luong da ban, tinh bang cach gop toan bo bang
 * `hopdong` - 114.733 dong, trong do 110.113 dong co `tinhtrang = 3`. Ban dau
 * bang nay chi vai chuc dong nen khong ai de y; sau khi sinh du lieu lich su
 * (migration 003) thi truy van do ngon 12 GIAY moi lan tai trang chu.
 *
 * Chi muc san co `idx_hopdong_mon (id_mon)` khong giup duoc nhieu: MySQL van
 * phai doc tung dong de loc `tinhtrang = 3` va lay `soluong`.
 *
 * CHI MUC NAY GIAI QUYET GI
 * -------------------------
 * `(tinhtrang, id_mon, soluong)` phu ca ba cot ma truy van can, theo dung thu
 * tu no dung: loc `tinhtrang`, nhom theo `id_mon`, cong `soluong`. MySQL doc
 * thang tu chi muc, khong phai cham vao bang.
 *
 * Chi muc nay cung giup cau `COUNT(DISTINCT sesis) WHERE tinhtrang = 3` o khoi
 * thong ke va cac bao cao doanh thu loc theo tinh trang.
 *
 * DANH DOI: them mot chi muc lam moi lenh INSERT/UPDATE vao `hopdong` cham hon
 * mot chut. Doi lai trang chu tu 12 giay xuong duoi mot phan muoi giay - va
 * bang nay duoc DOC nhieu hon GHI hang tram lan.
 *
 * Chay lai duoc nhieu lan (idempotent):
 *    node config/migrations/024_chi_muc_trang_chu.js
 */
const db = require('../db');

const TEN = 'idx_hopdong_tt_mon';
const TEN_SESIS = 'idx_hopdong_tt_sesis';

async function coKhoa(bang, ten) {
  const [r] = await db.query(
    `SELECT COUNT(*) AS n FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [bang, ten]
  );
  return r[0].n > 0;
}

async function main() {
  console.log('=== Migration 024: chi muc cho truy van mon ban chay ===\n');

  if (await coKhoa('hopdong', TEN)) {
    console.log(`[1/2] Chi muc ${TEN}: da co`);
  } else {
    console.log(`[1/2] Them chi muc ${TEN} (tinhtrang, id_mon, soluong)`);
    const t = Date.now();
    await db.query(`ALTER TABLE hopdong ADD INDEX ${TEN} (tinhtrang, id_mon, soluong)`);
    console.log(`      xong sau ${Date.now() - t} ms`);
  }

  /*
    CHI MUC THU HAI - SUA MOT HOI QUY DO CHINH CHI MUC THU NHAT GAY RA.

    Sau khi them `idx_hopdong_tt_mon (tinhtrang, id_mon, soluong)`, cau dem don
    o khoi thong ke:

        SELECT COUNT(DISTINCT sesis) FROM hopdong WHERE tinhtrang = 3

    tu 441 ms VOT LEN 13.981 ms - cham gap 32 lan. Ly do: MySQL thay co chi muc
    bat dau bang `tinhtrang` nen chuyen tu quet bang tuan tu sang dung chi muc
    do; nhung `sesis` KHONG nam trong chi muc, nen no phai nhay ve bang tra tung
    dong mot cho 110.113 ban ghi. Tra ngau nhien 110 nghin lan cham hon quet
    tuan tu ca bang.

    Bai hoc: them mot chi muc co the lam CHAM mot truy van khac, neu chi muc do
    du hap dan de MySQL chon nhung lai khong chua du cot no can. Phai do lai ca
    nhung truy van khong lien quan sau khi them chi muc.

    Chi muc nay chua ca `sesis` nen cau tren doc thang tu chi muc, khong cham
    vao bang lan nao.

    PHAI LA COT DAY DU, KHONG DUOC DUNG TIEN TO
    -------------------------------------------
    Lan dau thu `sesis(64)` cho gon - va cau dem VAN cham 11.328 ms. Ly do:
    tien to khong bao dam duy nhat (hai `sesis` khac nhau co the trung 64 ky tu
    dau), nen MySQL khong the ket luan DISTINCT tu chi muc, buoc phai doc lai
    tung dong y nhu cu.

    Cot day du 765 byte, con `row_format` cua bang la Dynamic - gioi han khoa
    3072 byte, du cho. Tren thuc te `sesis` dai nhat chi 32 ky tu nen chi muc
    khong to nhu con so 765 goi y.
  */
  if (await coKhoa('hopdong', TEN_SESIS)) {
    console.log(`\n[2/3] Chi muc ${TEN_SESIS}: da co`);
  } else {
    console.log(`\n[2/3] Them chi muc ${TEN_SESIS} (tinhtrang, sesis)`);
    const t2 = Date.now();
    try {
      await db.query(`ALTER TABLE hopdong ADD INDEX ${TEN_SESIS} (tinhtrang, sesis)`);
      console.log(`      xong sau ${Date.now() - t2} ms`);
    } catch (e) {
      console.log(`      [BO QUA] khong them duoc: ${e.message}`);
    }
  }

  console.log('\n[3/3] Do lai hai truy van cua trang chu');
  const t = Date.now();
  const [r] = await db.query(`
    SELECT m.id_mon, COALESCE(SUM(h.soluong), 0) AS da_ban
    FROM monan m
    LEFT JOIN hopdong h ON h.id_mon = m.id_mon AND h.tinhtrang = 3
    WHERE m.tinhtrang = 1 AND m.images IS NOT NULL AND m.images <> ''
    GROUP BY m.id_mon
    ORDER BY da_ban DESC
    LIMIT 60`);
  const ms = Date.now() - t;
  console.log(`      mon ban chay : ${r.length} mon · ${ms} ms`);

  const t2 = Date.now();
  await db.query('SELECT COUNT(DISTINCT sesis) AS n FROM hopdong WHERE tinhtrang = 3');
  const ms2 = Date.now() - t2;
  console.log(`      dem don      : ${ms2} ms`);

  const dat = ms < 1000 && ms2 < 1000;
  console.log(dat
    ? '      => ca hai deu nhanh, dat yeu cau'
    : '      => VAN CHAM. Chay `EXPLAIN` tren cau con cham de xem MySQL chon chi muc nao.');

  console.log('\n=== Hoan tat migration 024 ===');
  await db.end();
}

main().catch((err) => {
  console.error('Migration that bai:', err);
  process.exit(1);
});
