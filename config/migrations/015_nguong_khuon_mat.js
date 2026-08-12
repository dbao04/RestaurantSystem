/**
 * Migration 015 - Nguong nhan dien khuon mat tinh bang PHAN TRAM.
 *
 * VI SAO CAN MIGRATION NAY
 *   Ban dau dieu kien cham cong duoc viet bang cosine (`khuon_mat_nguong_cosine
 *   = 0.363`) cong voi mot loat hang so nam trong ma nguon Python: bien do gat
 *   dau >= 0.10, bien do quay >= 0.12, ty le lai gan >= 1.25, va rang buoc
 *   "nghi cham ho" bat cung.
 *
 *   Thuc te van hanh cho thay hai van de:
 *
 *   1. RANG BUOC "NGHI CHAM HO" TU CHOI CA NGUOI THAT. O che do 1:1, he thong
 *      doi chieu nguoi dang dang nhap voi CA thu vien va tu choi neu co ho so
 *      khac giong hon du chi 0.02. Khi thu vien co hai ho so cung mot nguoi
 *      (dang ky demo, hoac dang ky lai ma khong go ho so cu), thu hang dao qua
 *      dao lai theo tung khung hinh -> nguoi that bi tu choi mai, trong khi man
 *      hinh van bao khop 60-70%.
 *
 *   2. BIEN DO DONG TAC CO DINH KHONG HOP VOI MOI WEBCAM. Cung mot cai gat dau,
 *      webcam goc rong dat cach mot sai tay chi cho bien do 0.02-0.06 - khong
 *      bao gio dat nguong 0.10 trong ma nguon.
 *
 * MIGRATION NAY LAM GI
 *   Dua toan bo cac so do ra bang `cau_hinh` va doi don vi nguong sang phan tram
 *   (50 = "khop tu 50% tro len thi cho vao") - dung con so ma nguoi dung nhin
 *   thay tren man hinh, de nguoi quan ly chinh duoc tu giao dien.
 *
 *   Khoa cu `khuon_mat_nguong_cosine` KHONG bi xoa: ml_service van doc no lam
 *   gia tri du phong neu khoa phan tram vi ly do nao do bien mat.
 *
 * Chay lai duoc nhieu lan (idempotent): gia tri da co thi giu nguyen, chi them
 * khoa con thieu.
 */
const db = require('../db');

// [khoa, gia_tri, mo_ta]
const THAM_SO = [
  ['khuon_mat_nguong_phan_tram', '50',
   'Do khop toi thieu (%) de duoc cham cong. Cang thap cang de vao nhung cang de nhan nham.'],
  ['khuon_mat_chan_cham_ho', '0',
   'Bat (1) thi che do 1:1 tu choi khi co nguoi khac giong hon. Chi bat khi moi nhan vien co dung MOT ho so khuon mat.'],
  ['khuon_mat_bien_cham_ho', '0.10',
   'Nguoi khac phai giong hon chinh chu bao nhieu (cosine) thi moi coi la nghi cham ho.'],
  ['khuon_mat_bien_do_quay', '0.06',
   'Bien do quay dau toi thieu cua thu thach chong gia mao.'],
  ['khuon_mat_bien_do_gat', '0.05',
   'Bien do gat dau toi thieu cua thu thach chong gia mao.'],
  ['khuon_mat_ty_le_lai_gan', '1.12',
   'Ty le phong to khuon mat toi thieu cua thu thach "lai gan camera".'],
  ['khuon_mat_nhat_quan_toi_thieu', '0.30',
   'Do giong nhau toi thieu giua cac khung hinh trong mot luot cham cong.'],
];

async function themThamSo() {
  console.log('\n[1/2] Tham so nguong nhan dien');
  let them = 0;
  for (const [khoa, giaTri, moTa] of THAM_SO) {
    const [kq] = await db.query(
      'INSERT IGNORE INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES (?, ?, ?)',
      [khoa, giaTri, moTa]
    );
    if (kq.affectedRows) { them++; console.log(`  + ${khoa} = ${giaTri}`); }
    else console.log(`  = ${khoa} (da co, giu nguyen)`);
  }
  console.log(`  -> them ${them}/${THAM_SO.length} tham so`);
}

async function kiemTra() {
  console.log('\n[2/2] Kiem tra');

  const [ts] = await db.query(
    "SELECT khoa, gia_tri FROM cau_hinh WHERE khoa LIKE 'khuon_mat_%' ORDER BY khoa"
  );
  console.table(ts.map((r) => ({ tham_so: r.khoa, gia_tri: r.gia_tri })));

  // Canh bao ho so trung: day chinh la thu lam rang buoc "nghi cham ho" tu choi
  // nguoi that. Chi dem, khong tu dong xoa - xoa du lieu sinh trac hoc cua ai la
  // viec phai co nguoi quyet dinh.
  const [nguoi] = await db.query(
    `SELECT COUNT(DISTINCT id_nv) AS nguoi, COUNT(*) AS mau
     FROM khuon_mat_nv WHERE dang_dung = 1`
  );
  console.log(`\n  ${nguoi[0].nguoi} nhan vien / ${nguoi[0].mau} anh mau dang dung.`);
  if (nguoi[0].nguoi > 1) {
    console.log('  ! Neu nhieu ho so trong so nay la CUNG MOT NGUOI (vi du dang ky thu),');
    console.log('    hay vao /to-chuc/khuon-mat go bot truoc khi bat "chan nghi cham ho".');
  }
}

async function main() {
  console.log('=== Migration 015: nguong nhan dien khuon mat theo phan tram ===');
  await themThamSo();
  await kiemTra();
  console.log('\n=== Hoan tat migration 015 ===');
  await db.end();
}

main().catch((err) => {
  console.error('Migration that bai:', err);
  process.exit(1);
});
