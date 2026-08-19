/**
 * Migration 021 - Bo sung nguyen lieu cho thuc don Nhat.
 *
 * VI SAO CAN
 * Thuc don da doi han sang mon Nhat (sashimi, sushi, tempura, teppanyaki,
 * lau, mi Nhat, sake...) nhung bang `nguyen_lieu` van la bo cu cua thuc don
 * Viet: hu tieu, banh trang, Bia Tiger, Coca-Cola. Khong co ca hoi, ca ngu,
 * rong bien, wasabi, com sushi - tuc la khong the viet noi mot cong thuc nao
 * cho 258 mon moi, va bep se khong bao gio tru duoc kho.
 *
 * LAM GI
 * Them nguyen lieu Nhat. KHONG xoa nguyen lieu cu: mot phan van dung duoc cho
 * thuc don moi (trung ga, hanh la, ca rot, dua leo, toi, gung, dau an, duong,
 * muoi, gao te, dau hu, tom su, thit bo), va nhung nguyen lieu khong con dung
 * thi van con lich su nhap/xuat kho tro toi - xoa la hong bao cao ton kho.
 *
 * Gia von lay theo mat bang gia si TP.HCM 2026, don vi tinh chon theo cach BEP
 * that su dem: ca thi kg, rong bien thi la, wasabi thi gram.
 *
 * Chay lai duoc nhieu lan: doi chieu theo `ten_nl`, da co thi cap nhat gia von
 * va dinh muc chu khong them ban ghi trung.
 */
const db = require('../db');

/* [ten, id_dvt, gia_von, ton_dau_ky, dinh_muc_min]
   id_dvt: 1 kg, 2 gram, 3 lit, 4 ml, 5 chai, 6 lon, 7 bo, 8 cai, 9 hop, 10 goi */
const NGUYEN_LIEU = [
  // --- Hai san tuoi (sashimi / sushi / nuong) ---
  ['Cá hồi phi lê',        1, 620000, 18,  5],
  ['Cá ngừ đại dương',     1, 780000, 12,  4],
  ['Cá cam Hamachi',       1, 850000,  8,  3],
  ['Cá saba',              1, 210000, 14,  4],
  ['Cá sanma',             1, 240000,  9,  3],
  ['Lươn Nhật (unagi)',    1, 890000,  7,  2],
  ['Sò điệp',              1, 720000, 10,  3],
  ['Sò lông',              1, 260000,  8,  3],
  ['Hàu sữa',              8,  18000, 90, 30],
  ['Tôm thẻ',              1, 320000, 16,  5],
  ['Bạch tuộc',            1, 380000,  7,  3],
  ['Mực lá',               1, 340000,  9,  3],
  ['Cua tuyết',            1, 950000,  5,  2],
  ['Trứng cá tobiko',      2,    900, 2400, 800],
  ['Trứng cá hồi ikura',   2,   1600, 1200, 400],
  ['Thanh cua surimi',     1, 145000, 12,  4],

  // --- Tinh bot / com / mi ---
  ['Gạo sushi Nhật',       1,  62000, 45, 15],
  ['Mì udon tươi',         1,  48000, 18,  6],
  ['Mì soba',              1,  72000, 12,  4],
  ['Mì ramen tươi',        1,  55000, 14,  5],
  ['Bột tempura',          1,  68000, 16,  5],
  ['Bột chiên xù panko',   1,  52000, 14,  5],

  // --- Rong bien / rau Nhat ---
  ['Rong biển nori',       8,   4200, 900, 300],
  ['Rong biển wakame',     1, 185000,  4,  2],
  ['Củ cải trắng daikon',  1,  26000, 22,  8],
  ['Cải thảo',             1,  22000, 20,  8],
  ['Nấm kim châm',         1,  58000, 12,  4],
  ['Nấm shiitake',         1, 165000,  8,  3],
  ['Măng tây',             1, 195000,  7,  3],
  ['Bơ trái',              8,  22000, 70, 25],
  ['Xoài chín',            1,  55000,  9,  3],
  ['Gừng ngâm gari',       1, 140000,  6,  2],

  // --- Gia vi / nuoc sot Nhat ---
  ['Nước tương Nhật',      4,     95, 9000, 3000],
  ['Mirin',                4,    120, 5000, 1500],
  ['Rượu sake nấu ăn',     4,    110, 5000, 1500],
  ['Giấm gạo',             4,     70, 6000, 2000],
  ['Tương miso',           1, 130000,  7,  3],
  ['Wasabi',               2,   1250, 1500, 500],
  ['Sốt teriyaki',         4,    150, 4500, 1500],
  ['Sốt mentaiko',         4,    320, 2200,  800],
  ['Sốt mayonnaise Nhật',  4,    130, 4000, 1200],
  ['Dầu mè',               4,    180, 2500,  800],
  ['Bột dashi',            2,    420, 2600,  800],
  ['Phô mai lát',          8,   6500, 380, 120],

  // --- Do uong ---
  ['Rượu sake chai',       5, 320000, 26,  8],
  ['Bia Nhật lon',         6,  32000, 220, 60],
  ['Trà xanh matcha',      2,   2600, 1400, 400],
  ['Trà gạo rang',         1, 240000,  4,  2],
  ['Dưa hấu',              1,  16000, 26, 10],
  ['Thơm (dứa)',           8,  18000, 45, 15],
  ['Chanh yuzu',           1, 480000,  3,  1],

  // --- Trang mieng ---
  ['Kem tươi',             3, 145000,  9,  3],
  ['Đậu đỏ nấu sẵn',       1,  88000,  6,  2],
  ['Bột panna cotta',      1, 165000,  4,  2],
  ['Dâu tây',              1, 185000,  5,  2],
  ['Việt quất',            1, 420000,  3,  1],
  ['Bột socola',           1, 195000,  4,  2],
  ['Bánh quy tiramisu',    1, 210000,  3,  1],

  // --- Bo sung dot 2: nhung nguyen lieu con thieu sau khi doi chieu tung mon
  //     trong thuc don. Khong gop vao cac nhom tren de nguoi doc thay ro day
  //     la phan them theo nhu cau cong thuc that, khong phai doan truoc. ---
  ['Cá mú',                1, 520000,  9,  3],
  ['Cá trích ép trứng',    1, 380000,  6,  2],
  ['Nhum biển',            2,   2800, 900, 300],
  ['Bào ngư',              8,  95000, 24,  8],
  ['Sò dương',             1, 290000,  7,  3],
  ['Sò đỏ',                1, 340000,  6,  2],
  ['Nghêu',                1,  85000, 14,  5],
  ['Cua lột',              8,  62000, 40, 12],
  ['Sứa biển',             1, 120000,  5,  2],
  ['Kim chi',              1,  95000, 10,  4],
  ['Rong nho',             1, 260000,  4,  2],
  ['Lá tía tô Nhật',       7,  15000, 30, 10],
  ['Đậu nành lông',        1,  78000, 12,  4],
  ['Khoai tây',            1,  32000, 25,  8],
  ['Gân bò',               1, 210000,  6,  2],
  ['Bò Wagyu',             1,1850000,  4,  2],
  ['Bò Mỹ',                1, 480000, 12,  4],
  ['Chanh dây',            1,  48000,  8,  3],
  ['Đào ngâm',             9,  62000, 18,  6],
  ['Vải ngâm',             9,  58000, 16,  6],
  ['Nhãn ngâm',            9,  55000, 14,  5],
  ['Ổi hồng',              1,  42000, 10,  4],
  ['Hoa cúc khô',          2,    800, 900, 300],
  ['Trà oolong',           1, 320000,  3,  1],
  ['Hạt chia',             1, 185000,  3,  1],
  ['Nha đam',              1,  38000,  8,  3],
  ['Lá bạc hà',            7,  12000, 26, 10],
  ['Sprite',               6,  11000, 130, 40],
  ['Sting',                6,  12000, 120, 40],
  ['Coca Zero',            6,  11500, 110, 40],
  ['Hạt sen',              1, 165000,  4,  2],
  ['Nước ép táo',          3,  62000,  6,  2],
];

async function themNguyenLieu() {
  let them = 0;
  let capNhat = 0;

  for (const [ten, dvt, gia, ton, dinhMuc] of NGUYEN_LIEU) {
    const [co] = await db.query('SELECT id_nl FROM nguyen_lieu WHERE ten_nl = ?', [ten]);
    if (co.length) {
      await db.query(
        'UPDATE nguyen_lieu SET id_dvt = ?, gia_von = ?, dinh_muc_min = ? WHERE id_nl = ?',
        [dvt, gia, dinhMuc, co[0].id_nl]
      );
      capNhat++;
    } else {
      await db.query(
        `INSERT INTO nguyen_lieu (ten_nl, id_dvt, so_luong, dinh_muc_min, gia_von, han_su_dung_ngay)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [ten, dvt, ton, dinhMuc, gia, dvt === 1 || dvt === 8 ? 7 : 90]
      );
      them++;
    }
  }
  console.log(`  Nguyen lieu Nhat         : them ${them}, cap nhat ${capNhat}`);
}

async function kiemTra() {
  console.log('\n  Kiem tra:');
  const [[t]] = await db.query('SELECT COUNT(*) AS n FROM nguyen_lieu');
  const [[k]] = await db.query(
    'SELECT COUNT(*) AS n FROM nguyen_lieu WHERE id_dvt IS NULL OR gia_von <= 0'
  );
  console.log(`      tong nguyen lieu         : ${t.n}`);
  console.log(`      thieu don vi / gia von   : ${k.n}`);
  if (Number(k.n) > 0) throw new Error('Con nguyen lieu thieu don vi tinh hoac gia von.');
}

async function main() {
  console.log('=== Migration 021: nguyen lieu cho thuc don Nhat ===');
  await themNguyenLieu();
  await kiemTra();
  console.log('\n=== Hoan tat migration 021 ===');
  console.log('Buoc tiep theo: chay 022 de sinh cong thuc cho thuc don moi.');
  await db.end();
}

main().catch((err) => {
  console.error('Migration that bai:', err);
  process.exit(1);
});
