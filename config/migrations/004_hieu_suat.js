/**
 * Migration 004 - Bo sung du lieu do hieu suat.
 *
 * Dashboard can tra loi 2 cau hoi ma schema hien tai chua du du lieu:
 *   - "Nhan vien nao phuc vu nhieu ban nhat?"  -> can gan don cho nhan vien
 *   - "Bep lam mon nao lau nhat?"              -> can moc thoi gian che bien
 *
 * Voi don mo phong ta sinh luon cac gia tri nay; voi don that thi de NULL va
 * ung dung se ghi nhan tu thoi diem migration tro di.
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
const rand = taoRng(773311);

/** Thoi gian che bien trung binh (phut) theo nhom mon. */
function phutCheBien(tenMon) {
  const t = tenMon.toLowerCase();
  if (/coca|pepsi|bia|nước suối|trà đá/.test(t)) return [1, 3];
  if (/nước cam/.test(t)) return [3, 6];
  if (/trái cây|rau câu/.test(t)) return [2, 5];
  if (/hầm/.test(t)) return [25, 45];
  if (/nướng/.test(t)) return [15, 28];
  if (/chiên|xào|áp chảo/.test(t)) return [8, 16];
  if (/gỏi|khai vị|ngó sen/.test(t)) return [5, 11];
  if (/cơm|miến|hủ tiếu/.test(t)) return [7, 14];
  return [10, 18];
}

async function coCot(table, column) {
  const [rows] = await db.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function themCot(table, column, def) {
  if (await coCot(table, column)) {
    console.log(`  - ${table}.${column} da ton tai`);
    return;
  }
  await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${def}`);
  console.log(`  + them ${table}.${column}`);
}

async function main() {
  console.log('=== Migration 004: du lieu hieu suat ===');

  console.log('\n[1/3] Them cot');
  await themCot('hopdong', 'id_nv_phuc_vu', 'INT(11) NULL');
  await themCot('hopdong', 'bep_bat_dau', 'DATETIME NULL');
  await themCot('hopdong', 'bep_ket_thuc', 'DATETIME NULL');
  await themCot('hopdong', 'id_ban', 'INT(11) NULL');

  // --- Gan nhan vien phuc vu ---
  console.log('\n[2/3] Gan nhan vien phuc vu cho don mo phong');
  const [nvs] = await db.query(
    "SELECT id_nv FROM nhan_vien WHERE trangthai = 1 AND (chucvu LIKE '%Phuc vu%' OR chucvu LIKE '%Thu ngan%' OR chucvu = '')"
  );
  let dsNv = nvs.map((n) => n.id_nv);
  if (!dsNv.length) {
    const [all] = await db.query('SELECT id_nv FROM nhan_vien LIMIT 6');
    dsNv = all.map((n) => n.id_nv);
  }
  console.log(`  dung ${dsNv.length} nhan vien: ${dsNv.join(', ')}`);

  const [bans] = await db.query('SELECT Id_ban FROM ban');
  const dsBan = bans.map((b) => b.Id_ban);

  // Gan theo PHIEN (sesis) chu khong theo tung dong: mot ban chi do mot nguoi
  // phuc vu. Neu gan ngau nhien tung dong thi so lieu hieu suat se vo nghia.
  const [phien] = await db.query(
    'SELECT DISTINCT sesis FROM hopdong WHERE la_du_lieu_mo_phong = 1 AND id_nv_phuc_vu IS NULL'
  );
  console.log(`  ${phien.length} phien can gan`);

  const LO = 400;
  for (let i = 0; i < phien.length; i += LO) {
    const lo = phien.slice(i, i + LO);
    await Promise.all(
      lo.map((p) => {
        const nv = dsNv[Math.floor(rand() * dsNv.length)];
        const ban = dsBan.length ? dsBan[Math.floor(rand() * dsBan.length)] : null;
        return db.query(
          'UPDATE hopdong SET id_nv_phuc_vu = ?, id_ban = ? WHERE sesis = ?',
          [nv, ban, p.sesis]
        );
      })
    );
    if ((i / LO) % 10 === 0) process.stdout.write(`\r  da gan ${Math.min(i + LO, phien.length)}/${phien.length}`);
  }
  console.log(`\r  da gan ${phien.length}/${phien.length} phien   `);

  // --- Sinh moc thoi gian che bien ---
  console.log('\n[3/3] Sinh moc thoi gian che bien');
  const [mons] = await db.query('SELECT DISTINCT id_mon, name_mon FROM monan');
  const tenTheoId = new Map(mons.map((m) => [m.id_mon, m.name_mon]));

  let daXu = 0;
  let offset = 0;
  const BATCH = 5000;
  for (;;) {
    const [rows] = await db.query(
      `SELECT id, id_mon, name_mon, ngay_dat, gio_dat FROM hopdong
       WHERE la_du_lieu_mo_phong = 1 AND id_mon > 0 AND bep_bat_dau IS NULL
       LIMIT ${BATCH}`
    );
    if (!rows.length) break;

    const capNhat = [];
    for (const r of rows) {
      if (!r.ngay_dat || !r.gio_dat) continue;
      const ten = tenTheoId.get(r.id_mon) || r.name_mon || '';
      const [lo, hi] = phutCheBien(ten);

      const ngay = new Date(r.ngay_dat).toISOString().slice(0, 10);
      const goc = new Date(`${ngay}T${String(r.gio_dat).slice(0, 8)}Z`);
      if (isNaN(goc.getTime())) continue;

      // Bep nhan mon sau 1-5 phut ke tu luc order.
      const cho = 1 + Math.floor(rand() * 5);
      const batDau = new Date(goc.getTime() + cho * 60000);
      // Gio cao diem bep cham hon ~35%.
      const gio = batDau.getUTCHours();
      const heSo = gio >= 11 && gio <= 13 ? 1.35 : gio >= 18 && gio <= 20 ? 1.35 : 1.0;
      const phut = (lo + rand() * (hi - lo)) * heSo;
      const ketThuc = new Date(batDau.getTime() + phut * 60000);

      const fmt = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
      capNhat.push([fmt(batDau), fmt(ketThuc), r.id]);
    }

    // Gop thanh mot cau UPDATE ... CASE de tranh 5000 round-trip.
    const LO2 = 500;
    for (let i = 0; i < capNhat.length; i += LO2) {
      const phan = capNhat.slice(i, i + LO2);
      const ids = phan.map((p) => p[2]);
      const caseBd = phan.map(() => 'WHEN ? THEN ?').join(' ');
      const caseKt = phan.map(() => 'WHEN ? THEN ?').join(' ');
      const params = [
        ...phan.flatMap((p) => [p[2], p[0]]),
        ...phan.flatMap((p) => [p[2], p[1]]),
        ...ids,
      ];
      await db.query(
        `UPDATE hopdong
         SET bep_bat_dau = CASE id ${caseBd} END,
             bep_ket_thuc = CASE id ${caseKt} END
         WHERE id IN (${ids.map(() => '?').join(',')})`,
        params
      );
    }

    daXu += rows.length;
    process.stdout.write(`\r  da xu ly ${daXu} dong`);
    offset += BATCH;
    if (offset > 200000) break; // chan vong lap vo han
  }
  console.log(`\r  da xu ly ${daXu} dong mon   `);

  // Danh dau mon da phuc vu xong cho don da thanh toan.
  await db.query(
    'UPDATE hopdong SET trangthai_bep = 3 WHERE la_du_lieu_mo_phong = 1 AND tinhtrang = 3 AND id_mon > 0'
  );

  const [kt] = await db.query(`
    SELECT COUNT(*) AS co_moc_bep,
           ROUND(AVG(TIMESTAMPDIFF(MINUTE, bep_bat_dau, bep_ket_thuc)), 1) AS phut_tb
    FROM hopdong WHERE bep_ket_thuc IS NOT NULL`);
  console.table(kt);

  console.log('\n=== Hoan tat migration 004 ===');
  await db.end();
}

main().catch((err) => {
  console.error('Migration that bai:', err);
  process.exit(1);
});
