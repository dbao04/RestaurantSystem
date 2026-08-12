/**
 * Migration 018 - Xep ca tu dong cho quan ly.
 *
 * TRUOC MIGRATION NAY he thong chi co mot chieu: nhan vien tu vao
 * /staff/schedule dang ky ca minh muon lam, quan tri vao /admin/schedule bam
 * duyet hoac tu choi tung dong. Khong o dau noi duoc "toi CAN bao nhieu nguoi
 * moi ca", nen cung khong the biet toi thu Bay thieu mot phuc vu cho den luc
 * thu Bay den that. Xep ca la viec lam nguoc lai: di tu NHU CAU cua nha hang
 * xuong con nguoi.
 *
 * BA THU DUOC THEM
 *
 * 1. `ca_lam_viec` - dinh nghia ca.
 *    Gio cua ba ca dang nam CUNG trong `personnelService.registerSchedule`
 *    duoi dang if/else. Doi gio ca toi tu 21h sang 22h la phai sua ma nguon.
 *    Chuyen thanh bang de quan ly tu sua duoc, va de trang xep ca doc ra ve
 *    cot. Ma ca giu nguyen 'sang'/'chieu'/'toi' de khong pha du lieu cu.
 *
 * 2. `dinh_muc_ca` - moi (thu trong tuan, ca, chuc vu) can bao nhieu nguoi.
 *    Theo THU chu khong theo ngay cu the, vi nhu cau nha hang lap theo tuan:
 *    cuoi tuan dong khach hon thi them nguoi, va khai mot lan dung mai thay vi
 *    khai lai cho tung ngay trong nam.
 *
 * 3. `lich_lam_viec.nguon` - dong lich nay tu dau ra.
 *    'dang_ky'  nhan vien tu dang ky (luong cu, giu nguyen lam mac dinh)
 *    'tu_dong'  may xep
 *    'thu_cong' quan ly tu them tay tren trang xep ca
 *    Can phan biet vi khi xoa mot ban nhap de xep lai, chi duoc xoa nhung dong
 *    MAY sinh ra - xoa nham don dang ky cua nhan vien la mat du lieu cua ho.
 *
 * TRANG THAI 3 = BAN NHAP
 *    `trangthai` dang dung 0 cho duyet / 1 da duyet / 2 tu choi. Them 3 cho ban
 *    nhap: ket qua may vua xep, quan ly con dang sua, CHUA phai lich that.
 *    Nhan vien khong duoc thay trang thai 3 - loc o tang truy van, xem
 *    `personnelService.getSchedule`. Bam "Chot" thi 3 doi thanh 1.
 *
 * KHOA CHONG TRUNG
 *    Them UNIQUE(id_nv, ngay, ca). Khong co no thi bam "Xep tu dong" hai lan
 *    la moi nguoi co hai dong y het nhau. Bang dang rong nen them duoc ngay;
 *    neu ban chay migration nay tren mot ban sao da co du lieu trung, buoc kiem
 *    tra ben duoi se bao va bo qua viec them khoa thay vi xoa du lieu cua ban.
 *
 * Chay lai duoc nhieu lan (idempotent):
 *    node config/migrations/018_xep_ca.js
 */
const db = require('../db');

/** Ba ca mac dinh - dung dung gio ma registerSchedule dang gan cung. */
const CA_MAC_DINH = [
  { ma_ca: 'sang',  ten_ca: 'Ca sáng',  gio_bat_dau: '07:00:00', gio_ket_thuc: '12:00:00', thu_tu: 1 },
  { ma_ca: 'chieu', ten_ca: 'Ca chiều', gio_bat_dau: '12:00:00', gio_ket_thuc: '17:00:00', thu_tu: 2 },
  { ma_ca: 'toi',   ten_ca: 'Ca tối',   gio_bat_dau: '17:00:00', gio_ket_thuc: '21:00:00', thu_tu: 3 },
];

/**
 * Dinh muc mac dinh, dat theo nhan su that dang co trong CSDL (Bep 7, Phuc vu
 * 3, Quay 2, Thu ngan 2) chu khong phai con so dep tren giay. Dat cao hon so
 * nguoi hien co thi ngay lan xep dau tien man hinh da day canh bao thieu nguoi,
 * nguoi dung tuong he thong hong.
 *
 * Ap cho ca bay thu; cuoi tuan them mot phuc vu o ca chieu va ca toi.
 */
const DINH_MUC_MAC_DINH = [
  { ma_ca: 'sang',  chucvu: 'Bep',       so_luong: 1 },
  { ma_ca: 'sang',  chucvu: 'Phuc vu',   so_luong: 1 },
  { ma_ca: 'chieu', chucvu: 'Bep',       so_luong: 2 },
  { ma_ca: 'chieu', chucvu: 'Phuc vu',   so_luong: 1 },
  { ma_ca: 'chieu', chucvu: 'Quay',      so_luong: 1 },
  { ma_ca: 'toi',   chucvu: 'Bep',       so_luong: 2 },
  { ma_ca: 'toi',   chucvu: 'Phuc vu',   so_luong: 1 },
  { ma_ca: 'toi',   chucvu: 'Thu ngan',  so_luong: 1 },
];

// getDay() cua JavaScript: 0 = Chu nhat ... 6 = Thu bay.
const CUOI_TUAN = [0, 6];

async function coCot(bang, cot) {
  const [r] = await db.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [bang, cot]
  );
  return r[0].n > 0;
}

async function coKhoa(bang, ten) {
  const [r] = await db.query(
    `SELECT COUNT(*) AS n FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [bang, ten]
  );
  return r[0].n > 0;
}

async function bangCa() {
  console.log('\n[1/5] Bang ca_lam_viec');
  await db.query(`
    CREATE TABLE IF NOT EXISTS ca_lam_viec (
      ma_ca        VARCHAR(20)  NOT NULL,
      ten_ca       VARCHAR(50)  NOT NULL,
      gio_bat_dau  TIME         NOT NULL,
      gio_ket_thuc TIME         NOT NULL,
      thu_tu       INT          NOT NULL DEFAULT 0,
      trang_thai   TINYINT(1)   NOT NULL DEFAULT 1,
      PRIMARY KEY (ma_ca)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci
  `);

  for (const c of CA_MAC_DINH) {
    // Chi them ca con thieu. Quan ly da sua gio ca thi giu nguyen gio cua ho.
    await db.query(
      `INSERT IGNORE INTO ca_lam_viec (ma_ca, ten_ca, gio_bat_dau, gio_ket_thuc, thu_tu)
       VALUES (?, ?, ?, ?, ?)`,
      [c.ma_ca, c.ten_ca, c.gio_bat_dau, c.gio_ket_thuc, c.thu_tu]
    );
  }
  const [dem] = await db.query('SELECT COUNT(*) AS n FROM ca_lam_viec');
  console.log(`      co ${dem[0].n} ca`);
}

async function bangDinhMuc() {
  console.log('\n[2/5] Bang dinh_muc_ca');
  await db.query(`
    CREATE TABLE IF NOT EXISTS dinh_muc_ca (
      id_dm     INT          NOT NULL AUTO_INCREMENT,
      thu       TINYINT(1)   NOT NULL COMMENT '0=Chu nhat ... 6=Thu bay, theo getDay()',
      ma_ca     VARCHAR(20)  NOT NULL,
      chucvu    VARCHAR(30)  NOT NULL,
      so_luong  INT          NOT NULL DEFAULT 0,
      PRIMARY KEY (id_dm),
      UNIQUE KEY uq_dm (thu, ma_ca, chucvu),
      KEY idx_dm_ca (ma_ca)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci
  `);

  const [dem] = await db.query('SELECT COUNT(*) AS n FROM dinh_muc_ca');
  if (dem[0].n > 0) {
    console.log(`      da co ${dem[0].n} dong dinh muc - giu nguyen, khong ghi de`);
    return;
  }

  for (let thu = 0; thu <= 6; thu++) {
    for (const d of DINH_MUC_MAC_DINH) {
      let sl = d.so_luong;
      if (CUOI_TUAN.includes(thu) && d.chucvu === 'Phuc vu' && d.ma_ca !== 'sang') sl += 1;
      await db.query(
        `INSERT IGNORE INTO dinh_muc_ca (thu, ma_ca, chucvu, so_luong) VALUES (?, ?, ?, ?)`,
        [thu, d.ma_ca, d.chucvu, sl]
      );
    }
  }
  const [sau] = await db.query('SELECT SUM(so_luong) AS tong FROM dinh_muc_ca');
  console.log(`      da nap dinh muc mac dinh - tong ${sau[0].tong} luot nguoi/tuan`);
}

async function cotNguon() {
  console.log('\n[3/5] Cot lich_lam_viec.nguon');
  if (await coCot('lich_lam_viec', 'nguon')) {
    console.log('      da co');
    return;
  }
  await db.query(
    `ALTER TABLE lich_lam_viec
     ADD COLUMN nguon ENUM('dang_ky','tu_dong','thu_cong') NOT NULL DEFAULT 'dang_ky'
     AFTER ghi_chu`
  );
  console.log('      da them');
}

async function khoaChongTrung() {
  console.log('\n[4/5] Khoa chong trung uq_lich_nv_ngay_ca');
  if (await coKhoa('lich_lam_viec', 'uq_lich_nv_ngay_ca')) {
    console.log('      da co');
    return;
  }

  const [trung] = await db.query(
    `SELECT COUNT(*) AS n FROM (
       SELECT id_nv FROM lich_lam_viec GROUP BY id_nv, ngay, ca HAVING COUNT(*) > 1
     ) t`
  );
  if (trung[0].n > 0) {
    // Khong tu y xoa du lieu cua nguoi dung. Bao ro roi di tiep - phan con lai
    // cua he thong van chay duoc, chi la mat mot lop chan trung o tang CSDL.
    console.log(`      [BO QUA] dang co ${trung[0].n} nhom ban ghi trung.`);
    console.log('      Xoa bot cho moi (id_nv, ngay, ca) chi con mot dong roi chay lai migration');
    console.log('      neu muon co khoa nay.');
    return;
  }

  await db.query('ALTER TABLE lich_lam_viec ADD UNIQUE KEY uq_lich_nv_ngay_ca (id_nv, ngay, ca)');
  console.log('      da them');
}

async function kiemTra() {
  console.log('\n[5/5] Kiem tra sau migration');
  const [ca] = await db.query('SELECT COUNT(*) AS n FROM ca_lam_viec');
  const [dm] = await db.query('SELECT COUNT(*) AS n FROM dinh_muc_ca');
  const coNguon = await coCot('lich_lam_viec', 'nguon');

  console.log(`      ca_lam_viec        : ${ca[0].n} ca`);
  console.log(`      dinh_muc_ca        : ${dm[0].n} dong`);
  console.log(`      lich_lam_viec.nguon: ${coNguon ? 'co' : 'THIEU'}`);

  if (ca[0].n < 3 || dm[0].n === 0 || !coNguon) {
    throw new Error('Kiem tra sau migration that bai.');
  }
}

async function main() {
  console.log('=== Migration 018: xep ca tu dong ===');
  await bangCa();
  await bangDinhMuc();
  await cotNguon();
  await khoaChongTrung();
  await kiemTra();
  console.log('\n=== Hoan tat migration 018 ===');
  await db.end();
}

main().catch((err) => {
  console.error('Migration that bai:', err);
  process.exit(1);
});
