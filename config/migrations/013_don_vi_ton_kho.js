/**
 * Migration 013 - Lam sach so luong ton kho theo dung ban chat don vi tinh.
 *
 * VAN DE
 * Bang ton kho dang hien nhung con so vo nghia voi nguoi dung kho:
 *     Bia Tiger    156.84 lon
 *     Nuoc suoi    174.81 chai
 *     Trung ga     169.48 cai
 *     Banh trang    58.13 bo
 * Khong ai dem duoc 0,84 lon bia. Thu kho cam phieu di dem thi khong bao gio
 * khop, va bao cao "chenh lech kiem ke" se luon bao sai.
 *
 * HAI NGUYEN NHAN KHAC NHAU, PHAI SUA KHAC NHAU
 *
 * 1. Bo sinh du lieu mo phong (migration 005) lay mot TY LE ngau nhien cua so
 *    luong nhap roi lam tron 2 chu so thap phan, khong quan tam don vi la gi:
 *        conLai = so_luong * (0.30 + rand * 0.60)   ->  184 lon * 0.852 = 156.84
 *    Voi kg/lit thi 2 chu so thap phan la hop ly, voi lon/chai/cai thi khong.
 *    => Sua o migration 005 (da sua kem theo lan nay) + lam tron du lieu cu.
 *
 * 2. Cong thuc mon an tieu hao MOT PHAN cua don vi dem duoc:
 *        Heo len met   -> 0.5  bo banh trang
 *        Suon heo ngon -> 0.05 chai xi dau
 *        Dau hu tu xuyen -> 0.03 chai tuong ot
 *        Rau cau       -> 0.1  hop sua dac
 *    Day moi la nguyen nhan GOC va no se tai dien sau moi lan ban hang, du co
 *    lam tron bao nhieu lan. Ban chat: bep khong dung "0,05 chai xi dau", bep
 *    dung "25 ml xi dau". Don vi bi chon sai ngay tu dau.
 *    => Doi don vi cua 4 nguyen lieu do sang don vi do luong duoc, quy doi
 *       toan bo so lieu lich su theo he so.
 *
 * Sau migration nay, moi nguyen lieu dung don vi dem duoc (lon/chai/cai/bo/
 * hop/goi) deu co ton kho NGUYEN va cong thuc tieu hao NGUYEN, nen khong con
 * duong nao sinh ra so le nua.
 *
 * Chay lai duoc nhieu lan: buoc doi don vi kiem tra don vi hien tai truoc khi
 * quy doi, nen chay lan hai se khong nhan he so hai lan.
 *
 * LUU Y khi chay lai: buoc lam tron van bao "31 dong", "11594 dong"... du du
 * lieu da sach. Do la vi cac cot deu la FLOAT: ROUND() tra ve DOUBLE, so sanh
 * DOUBLE voi FLOAT gan nhu luon lech o chu so cuoi nen dieu kien WHERE van
 * dung, va MySQL ghi lai DUNG gia tri cu. Da kiem chung: tong xuat_kho giu
 * nguyen 448650.48000195436 qua ba lan chay, khong he troi. Con so do la nhieu
 * cua kieu du lieu, khong phai dau hieu hong.
 */
const db = require('../db');

/* ------------------------------------------------------------------ */
/* Phan loai don vi tinh                                               */
/* ------------------------------------------------------------------ */

const PHAN_LOAI = {
  // Don vi DEM DUOC: chi nhan so nguyen.
  lon:   { loai: 'dem_duoc', so_le: 0 },
  chai:  { loai: 'dem_duoc', so_le: 0 },
  cai:   { loai: 'dem_duoc', so_le: 0 },
  bo:    { loai: 'dem_duoc', so_le: 0 },
  hop:   { loai: 'dem_duoc', so_le: 0 },
  goi:   { loai: 'dem_duoc', so_le: 0 },
  // Don vi DO LUONG: cho phep so le.
  kg:    { loai: 'do_luong', so_le: 2 },
  lit:   { loai: 'do_luong', so_le: 2 },
  // gram/ml da la don vi nho nhat, le nua khong con y nghia thuc te.
  gram:  { loai: 'do_luong', so_le: 0 },
  ml:    { loai: 'do_luong', so_le: 0 },
};

/**
 * Ten don vi hien tai (khong dau) -> ten hien thi dung chinh ta tieng Viet.
 *
 * Bang kho dang in ra "cai", "bo", "lit" ngay giua mot giao dien tieng Viet co
 * dau day du. Da kiem tra: khong doan ma nao trong du an so sanh theo ten don
 * vi (chi co menuService cho phep sua ten), nen doi ten la an toan.
 *
 * Cac ham phan loai ben duoi deu bo dau truoc khi tra cuu, nen chay lai
 * migration sau khi doi ten van nhan dien dung.
 */
const TEN_CO_DAU = {
  cai: 'cái',
  bo: 'bó',
  hop: 'hộp',
  goi: 'gói',
  lit: 'lít',
};

/** Bo dau tieng Viet de tra cuu PHAN_LOAI bat ke ten da doi hay chua. */
function boDau(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .trim()
    .toLowerCase();
}

/**
 * Doi don vi cho nguyen lieu bi chon sai don vi tu dau.
 *
 * `he_so` = so don vi MOI trong mot don vi CU.
 * Vi du xi dau: 1 chai = 500 ml -> he_so 500. Ton 1,46 chai thanh 730 ml.
 *
 * Gia von tinh tren MOT don vi nen phai CHIA cho he so, neu khong 1 ml xi dau
 * se duoc dinh gia bang ca chai va gia von mon an vot len 500 lan.
 */
const DOI_DON_VI = [
  { ten: 'Bánh tráng', tu: 'bo',   sang: 'cai',  he_so: 20,  ghi_chu: '1 bó = 20 cái' },
  { ten: 'Xì dầu',     tu: 'chai', sang: 'ml',   he_so: 500, ghi_chu: '1 chai = 500 ml' },
  { ten: 'Tương ớt',   tu: 'chai', sang: 'ml',   he_so: 250, ghi_chu: '1 chai = 250 ml' },
  { ten: 'Sữa đặc',    tu: 'hop',  sang: 'gram', he_so: 380, ghi_chu: '1 hộp = 380 g' },
];

/** Cac bang co cot so luong tinh theo don vi cua nguyen lieu. */
const BANG_SO_LUONG = [
  { bang: 'nguyen_lieu',         cot: ['so_luong', 'dinh_muc_min'], khoa: 'id_nl' },
  { bang: 'cong_thuc',           cot: ['so_luong_tieu_hao'],        khoa: 'id_nl' },
  { bang: 'chi_tiet_phieu_nhap', cot: ['so_luong', 'so_luong_con_lai'], khoa: 'id_nl' },
  { bang: 'nhap_kho',            cot: ['so_luong'],                 khoa: 'id_nl' },
  { bang: 'xuat_kho',            cot: ['so_luong'],                 khoa: 'id_nl' },
  { bang: 'du_bao_nguyen_lieu',  cot: ['so_luong_can', 'ton_hien_tai', 'can_nhap_them'], khoa: 'id_nl' },
];

async function coBang(ten) {
  const [r] = await db.query(
    `SELECT COUNT(*) n FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [ten]);
  return Number(r[0].n) > 0;
}

async function themCot(bang, cot, dinhNghia) {
  const [r] = await db.query(
    `SELECT COUNT(*) n FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [bang, cot]);
  if (Number(r[0].n) > 0) return false;
  await db.query(`ALTER TABLE \`${bang}\` ADD COLUMN \`${cot}\` ${dinhNghia}`);
  return true;
}

async function main() {
  console.log('=== Migration 013: chuan hoa so luong ton kho ===');

  /* --- 1. Danh dau don vi nao dem duoc, don vi nao do luong --------- */
  console.log('\n[1/4] Phan loai don vi tinh');
  const themLoai = await themCot('don_vi_tinh', 'loai',
    "ENUM('dem_duoc','do_luong') NOT NULL DEFAULT 'do_luong' COMMENT 'dem_duoc = chi nhan so nguyen'");
  const themSoLe = await themCot('don_vi_tinh', 'so_le',
    "TINYINT NOT NULL DEFAULT 2 COMMENT 'So chu so thap phan cho phep'");
  if (themLoai) console.log('  + don_vi_tinh.loai');
  if (themSoLe) console.log('  + don_vi_tinh.so_le');

  const [dsDvt] = await db.query('SELECT id_dvt, ten_dvt FROM don_vi_tinh');
  for (const d of dsDvt) {
    const pl = PHAN_LOAI[boDau(d.ten_dvt)];
    if (!pl) {
      console.log(`  ? "${d.ten_dvt}" chua phan loai, mac dinh do luong 2 so le`);
      continue;
    }
    const tenMoi = TEN_CO_DAU[boDau(d.ten_dvt)] || d.ten_dvt;
    await db.query('UPDATE don_vi_tinh SET loai = ?, so_le = ?, ten_dvt = ? WHERE id_dvt = ?',
      [pl.loai, pl.so_le, tenMoi, d.id_dvt]);
    const doiTen = tenMoi !== d.ten_dvt ? `  (đổi tên: ${d.ten_dvt} -> ${tenMoi})` : '';
    console.log(`  = ${tenMoi.padEnd(6)} -> ${pl.loai} (${pl.so_le} số lẻ)${doiTen}`);
  }

  /* --- 2. Doi don vi cho nguyen lieu bi chon sai ------------------- */
  console.log('\n[2/4] Đổi đơn vị cho nguyên liệu dùng theo phần');
  for (const q of DOI_DON_VI) {
    const [nl] = await db.query(
      `SELECT n.id_nl, n.so_luong, d.ten_dvt FROM nguyen_lieu n
       JOIN don_vi_tinh d ON n.id_dvt = d.id_dvt WHERE n.ten_nl = ? LIMIT 1`, [q.ten]);
    if (!nl.length) { console.log(`  ? khong tim thay "${q.ten}"`); continue; }
    if (boDau(nl[0].ten_dvt) !== q.tu) {
      console.log(`  = "${q.ten}" da la "${nl[0].ten_dvt}", bo qua (migration da chay truoc do)`);
      continue;
    }
    const [dvtMoi] = await db.query(
      'SELECT id_dvt FROM don_vi_tinh WHERE ten_dvt = ? OR ten_dvt = ? LIMIT 1',
      [q.sang, TEN_CO_DAU[q.sang] || q.sang]);
    if (!dvtMoi.length) { console.log(`  ! chua co don vi "${q.sang}"`); continue; }

    const idNl = nl[0].id_nl;
    const tonCu = nl[0].so_luong;

    for (const b of BANG_SO_LUONG) {
      if (!(await coBang(b.bang))) continue;
      const dat = b.cot.map((c) => `\`${c}\` = \`${c}\` * ${q.he_so}`).join(', ');
      await db.query(`UPDATE \`${b.bang}\` SET ${dat} WHERE \`${b.khoa}\` = ?`, [idNl]);
    }
    // Gia von tren mot don vi -> chia cho he so.
    await db.query('UPDATE nguyen_lieu SET gia_von = gia_von / ? WHERE id_nl = ?', [q.he_so, idNl]);
    await db.query('UPDATE chi_tiet_phieu_nhap SET gia_nhap = gia_nhap / ? WHERE id_nl = ?', [q.he_so, idNl])
      .catch(() => {});
    await db.query('UPDATE nhap_kho SET gia_nhap = gia_nhap / ? WHERE id_nl = ?', [q.he_so, idNl])
      .catch(() => {});

    await db.query('UPDATE nguyen_lieu SET id_dvt = ? WHERE id_nl = ?', [dvtMoi[0].id_dvt, idNl]);
    console.log(`  ~ ${q.ten}: ${tonCu} ${q.tu} -> ${Math.round(tonCu * q.he_so)} ${q.sang}  (${q.ghi_chu})`);
  }

  /* --- 3a. Cong thuc: chi lam tron don vi khong chap nhan so le ----- */
  //
  // KHONG dung toi cong thuc tinh theo kg/lit (so_le = 2). Rat nhieu dinh luong
  // gia vi la 0,005 kg (5 g tieu) hay 0,012 kg (12 g hat nem); lam tron ve 2
  // chu so thap phan se thanh 0,01 kg - tuc GAP DOI luong tieu hao, keo theo
  // sai gia von mon an va sai luon du bao nguyen lieu. Nhung con so do khong
  // he "xau", chung dung ban chat cua don vi do luong.
  //
  // Chi cham vao don vi co so_le = 0: ca don vi DEM DUOC (lon, chai, cai...)
  // lan gram/ml - vi 7,5 ml tuong ot cung vo nghia y het 0,84 lon bia.
  //
  // GREATEST(1, ...) de mot cong thuc dung 0,4 cai trung khong bi lam tron ve
  // 0: dong cong thuc bang 0 nghia la mon do khong ton nguyen lieu nao, va bao
  // cao gia von se bao 0 dong.
  console.log('\n[3/4] Làm tròn số lượng');
  const [ctLamTron] = await db.query(
    `UPDATE cong_thuc c
     JOIN nguyen_lieu n ON n.id_nl = c.id_nl
     JOIN don_vi_tinh d ON d.id_dvt = n.id_dvt
     SET c.so_luong_tieu_hao = GREATEST(1, ROUND(c.so_luong_tieu_hao))
     WHERE d.so_le = 0
       AND c.so_luong_tieu_hao <> GREATEST(1, ROUND(c.so_luong_tieu_hao))`);
  console.log(`  ~ cong_thuc: ${ctLamTron.affectedRows} dòng (đơn vị không nhận số lẻ)`);

  /* --- 3b. Cac bang ton kho: lam tron theo so le cua don vi -------- */
  for (const b of BANG_SO_LUONG) {
    if (b.bang === 'cong_thuc') continue; // da xu ly rieng o tren
    if (!(await coBang(b.bang))) { console.log(`  - bỏ qua ${b.bang} (chưa có bảng)`); continue; }
    for (const c of b.cot) {
      const [r] = await db.query(
        `UPDATE \`${b.bang}\` t
         JOIN nguyen_lieu n ON n.id_nl = t.\`${b.khoa}\`
         JOIN don_vi_tinh d ON d.id_dvt = n.id_dvt
         SET t.\`${c}\` = ROUND(t.\`${c}\`, d.so_le)
         WHERE t.\`${c}\` IS NOT NULL AND t.\`${c}\` <> ROUND(t.\`${c}\`, d.so_le)`);
      if (r.affectedRows) console.log(`  ~ ${b.bang}.${c}: ${r.affectedRows} dòng`);
    }
  }

  /* --- 4. Doi chieu lai ------------------------------------------- */
  console.log('\n[4/4] Đối chiếu');
  const [con] = await db.query(
    `SELECT n.ten_nl, d.ten_dvt, n.so_luong FROM nguyen_lieu n
     JOIN don_vi_tinh d ON n.id_dvt = d.id_dvt
     WHERE d.loai = 'dem_duoc' AND n.so_luong <> ROUND(n.so_luong)`);
  console.log(con.length === 0
    ? '  OK  khong con nguyen lieu dem duoc nao co ton kho le'
    : `  ! con ${con.length} nguyen lieu le`);
  if (con.length) console.table(con);

  const [ctLe] = await db.query(
    `SELECT m.name_mon, n.ten_nl, d.ten_dvt, c.so_luong_tieu_hao
     FROM cong_thuc c JOIN nguyen_lieu n ON n.id_nl = c.id_nl
     JOIN don_vi_tinh d ON d.id_dvt = n.id_dvt
     LEFT JOIN monan m ON m.id_mon = c.id_mon
     WHERE d.so_le = 0 AND c.so_luong_tieu_hao <> ROUND(c.so_luong_tieu_hao)`);
  console.log(ctLe.length === 0
    ? '  OK  khong con cong thuc nao tieu hao mot phan don vi khong chia duoc'
    : `  ! con ${ctLe.length} cong thuc le`);
  if (ctLe.length) console.table(ctLe);

  const [bang] = await db.query(
    `SELECT n.ten_nl AS 'Nguyên liệu', d.ten_dvt AS 'ĐVT',
            n.so_luong AS 'Tồn kho', n.dinh_muc_min AS 'Định mức'
     FROM nguyen_lieu n JOIN don_vi_tinh d ON n.id_dvt = d.id_dvt
     ORDER BY d.loai, n.ten_nl`);
  console.log('\n--- Ton kho sau khi chuan hoa ---');
  console.table(bang);

  console.log('\n=== Xong migration 013 ===');
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('LOI migration 013:', e); process.exit(1); });
