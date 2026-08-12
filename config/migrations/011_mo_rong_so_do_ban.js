/**
 * Migration 011 - Mo rong so do ban: 40 ban chia 4 khu vuc.
 *
 * MUC TIEU
 * --------
 * Nha hang truoc day chi co 9 ban thuoc 2 khu ("Sảnh", "Vip") voi cach dat ten
 * khong dong nhat ('01'..'05' lan lon voi 'Vip1'..'Vip5'). Quy mo do qua nho de
 * minh hoa cac bai toan van hanh cua khoa luan (ty le lap day theo khu, dieu
 * phoi ban, hieu suat phuc vu).
 *
 * Sau migration: 40 ban / 4 khu, ma ban dong nhat <chu cai khu><2 chu so>:
 *
 *   Sảnh chính  S01..S14   14 ban   tang tret, khu phuc vu chinh
 *   Sân vườn    V01..V10   10 ban   ngoai troi co mai che
 *   Tầng 2      T01..T10   10 ban   khu gia dinh / nhom dong
 *   Phòng VIP   P01..P06    6 ban   phong rieng, cach am
 *
 * 9 ban cu duoc DOI TEN chu khong xoa, nen toan bo lich su trong `hopdong`
 * (~80.000 dong, tham chieu qua `hopdong.id_ban`) van nguyen ven:
 *
 *   '01'..'05'  ->  S01..S05        'Vip1','Vip2','Vip3','Vip5'  ->  P01..P04
 *
 * THAY DOI SCHEMA
 * ---------------
 * - `vitri.Name_vitri` VARCHAR(5) -> VARCHAR(40): ten cu bi cat cut, khong du
 *   cho cho "Sảnh chính" hay "Phòng VIP".
 * - Them `vitri.thu_tu` de sap xep khu tren so do theo luong phuc vu thuc te
 *   (sanh -> san vuon -> tang 2 -> VIP) thay vi theo `id_vitri`.
 *
 * TOA DO
 * ------
 * `ban.toa_do_x/y` luu theo TUNG KHU (goc toa do la goc trai-tren cua khu do),
 * khong phai toa do tuyet doi tren ca so do. View `staff/so-do-ban.ejs` tu cong
 * them do lech Y cua khu khi hien thi tab "Tất cả". Nho vay 4 khu khong de chong
 * len nhau, va khi keo tha sap xep trong mot khu thi khu khac khong bi anh huong.
 *
 * MA QR
 * -----
 * `qr_tables` khong co khoa ngoai sang `ban` - `orderService.timIdBanTheoTen()`
 * do theo TEN. Doi ten ban ma khong dong bo QR se lam don quet ma mat lien ket
 * voi ban (mon van vao bep nhung khong biet cua ban nao). Vi vay migration nay
 * cung sua `table_name`/`url` cua 10 ma QR cu va tao them ma cho cac ban moi,
 * bao dam moi ban deu co dung mot ma QR trung ten.
 *
 * AN TOAN / CHAY LAI NHIEU LAN
 * ----------------------------
 * Chay lai khong nhan doi du lieu: ban da ton tai thi chi cap nhat khu va so cho.
 * KHONG dung den `trangthai` va `sesis_hien_tai`, nen ban dang phuc vu luc chay
 * migration van giu nguyen phien dang mo.
 *
 * Toa do cua ban DA TON TAI cung duoc giu nguyen, vi quan ly co the da keo tha
 * so do cho khop mat bang that. Dung co `--xep-lai` khi muon vut bo cach sap xep
 * do va tra ca 40 ban ve luoi mac dinh.
 */
const db = require('../db');

// Kich thuoc luoi xep ban trong mot khu - khop voi .ban { width:138px } cua view.
// 7 cot phu vua chieu ngang khung so do (~1450px) o man hinh 1500px.
const SO_COT = 7;
const BUOC_X = 165;
const BUOC_Y = 128;
const LE_X = 20;
const LE_Y = 20;

// `ban.image` hien khong duoc man hinh nao doc, nhung cot NOT NULL-ish nay van
// nen co gia tri hop le -> dung anh khong gian nha hang co san trong `images/`.
const ANH = ['bg_1.jpg', 'bg_2.jpg', 'bg_3.jpg', 'bg_4.jpg', 'bg_5.jpg'];

/**
 * 4 khu vuc.
 * - `ten_cu`: cac ten `vitri` cu cua chinh khu nay, dung de nhan dien va doi ten
 *   thay vi tao ban ghi moi (giu nguyen `id_vitri` ma bang `ban` dang tham chieu).
 * - `so_cho`: so cho tung ban theo thu tu ma ban, do dai mang = so ban cua khu.
 */
const KHU_VUC = [
  {
    ma: 'S',
    ten: 'Sảnh chính',
    thu_tu: 1,
    ghi_chu: 'Tầng trệt - khu phục vụ chính',
    ten_cu: ['Sảnh', 'Sanh', 'Sảnh '],
    so_cho: [2, 2, 4, 4, 4, 4, 4, 4, 6, 6, 4, 4, 6, 6],
  },
  {
    ma: 'V',
    ten: 'Sân vườn',
    thu_tu: 2,
    ghi_chu: 'Ngoài trời, có mái che',
    ten_cu: [],
    so_cho: [4, 4, 4, 6, 6, 6, 8, 8, 4, 4],
  },
  {
    ma: 'T',
    ten: 'Tầng 2',
    thu_tu: 3,
    ghi_chu: 'Khu gia đình / nhóm đông',
    ten_cu: [],
    so_cho: [4, 4, 6, 6, 6, 8, 8, 10, 10, 6],
  },
  {
    ma: 'P',
    ten: 'Phòng VIP',
    thu_tu: 4,
    ghi_chu: 'Phòng riêng, có cách âm',
    ten_cu: ['Vip', 'VIP'],
    so_cho: [8, 8, 10, 10, 12, 12],
  },
];

// Ten ban cu -> ten ban moi. Chi ap dung mot lan; chay lai thi khong con ban nao
// mang ten cu nen buoc nay tu dong bo qua.
const DOI_TEN_BAN = {
  '01': 'S01', '02': 'S02', '03': 'S03', '04': 'S04', '05': 'S05',
  Vip1: 'P01', Vip2: 'P02', Vip3: 'P03', Vip5: 'P04',
};

// Ma QR cu dat ten '1'..'10' - do theo gia tri so sang ban '01'..'05'. Sau khi
// doi ten ban thi phep do so nay het tac dung, phai tro thang sang ma ban moi.
const DOI_TEN_QR = {
  1: 'S01', 2: 'S02', 3: 'S03', 4: 'S04', 5: 'S05',
  6: 'P01', 7: 'P02', 8: 'P03', 9: 'P04', 10: 'S06',
};

const URL_GOC = process.env.APP_URL || 'http://localhost:3000';
const XEP_LAI = process.argv.includes('--xep-lai');

/** Sinh danh sach 40 ban tu KHU_VUC (chua biet id_vitri, dien o buoc sau). */
function danhSachBanMongMuon() {
  const ds = [];
  for (const khu of KHU_VUC) {
    khu.so_cho.forEach((soCho, i) => {
      ds.push({
        ma_khu: khu.ma,
        number_ban: khu.ma + String(i + 1).padStart(2, '0'),
        so_cho: soCho,
        toa_do_x: LE_X + (i % SO_COT) * BUOC_X,
        toa_do_y: LE_Y + Math.floor(i / SO_COT) * BUOC_Y,
        image: ANH[ds.length % ANH.length],
        ghichu: khu.ghi_chu,
      });
    });
  }
  return ds;
}

/** Noi rong cot ten khu va them cot thu tu hien thi. */
async function capNhatSchema() {
  const [cot] = await db.query(
    `SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH AS dai
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vitri'`
  );
  const ten = cot.find((c) => c.COLUMN_NAME.toLowerCase() === 'name_vitri');
  if (ten && Number(ten.dai) < 40) {
    await db.query('ALTER TABLE vitri MODIFY Name_vitri VARCHAR(40) NOT NULL');
    console.log('  + vitri.Name_vitri: VARCHAR(' + ten.dai + ') -> VARCHAR(40)');
  }
  if (!cot.some((c) => c.COLUMN_NAME.toLowerCase() === 'thu_tu')) {
    await db.query('ALTER TABLE vitri ADD COLUMN thu_tu INT NOT NULL DEFAULT 0 AFTER Name_vitri');
    console.log('  + vitri.thu_tu: da them');
  }
}

/** Tao / doi ten 4 khu, tra ve map ma_khu -> id_vitri. */
async function dongBoKhuVuc() {
  const idTheoMa = {};
  for (const khu of KHU_VUC) {
    const ungVien = [khu.ten, ...khu.ten_cu].map((s) => s.trim());
    const [co] = await db.query(
      `SELECT id_vitri, Name_vitri FROM vitri
        WHERE TRIM(Name_vitri) IN (${ungVien.map(() => '?').join(',')})
        ORDER BY id_vitri LIMIT 1`,
      ungVien
    );
    if (co.length) {
      idTheoMa[khu.ma] = co[0].id_vitri;
      await db.query('UPDATE vitri SET Name_vitri = ?, thu_tu = ?, Ghichu = ? WHERE id_vitri = ?', [
        khu.ten, khu.thu_tu, khu.ghi_chu, co[0].id_vitri,
      ]);
      const cu = co[0].Name_vitri.trim();
      console.log(`  ${cu === khu.ten ? '=' : '~'} khu "${cu}" -> "${khu.ten}" (id ${co[0].id_vitri})`);
    } else {
      const [kq] = await db.query(
        'INSERT INTO vitri (Name_vitri, thu_tu, Ghichu) VALUES (?, ?, ?)',
        [khu.ten, khu.thu_tu, khu.ghi_chu]
      );
      idTheoMa[khu.ma] = kq.insertId;
      console.log(`  + khu "${khu.ten}" (id ${kq.insertId})`);
    }
  }
  return idTheoMa;
}

/** Doi ten 9 ban cu sang ma moi, giu nguyen Id_ban de khong dut lich su. */
async function doiTenBanCu() {
  let n = 0;
  for (const [cu, moi] of Object.entries(DOI_TEN_BAN)) {
    const [daCoTenMoi] = await db.query('SELECT Id_ban FROM ban WHERE number_ban = ?', [moi]);
    if (daCoTenMoi.length) continue; // da doi o lan chay truoc
    const [kq] = await db.query('UPDATE ban SET number_ban = ? WHERE number_ban = ?', [moi, cu]);
    if (kq.affectedRows) {
      console.log(`  ~ bàn "${cu}" -> "${moi}"`);
      n += kq.affectedRows;
    }
  }
  return n;
}

/** Them ban con thieu, cap nhat khu / so cho / toa do cho ban da co. */
async function dongBoBan(idTheoMa) {
  let them = 0;
  let capNhat = 0;
  for (const b of danhSachBanMongMuon()) {
    const idVitri = idTheoMa[b.ma_khu];
    const [co] = await db.query('SELECT Id_ban FROM ban WHERE number_ban = ?', [b.number_ban]);
    if (co.length) {
      // KHONG dung toi trangthai / sesis_hien_tai: ban dang phuc vu phai giu phien.
      // Toa do chi ghi de khi duoc yeu cau - xem ghi chu --xep-lai o dau file.
      const dat = ['id_vitri = ?', 'so_cho = ?', 'ghichu = ?'];
      const giaTri = [idVitri, b.so_cho, b.ghichu];
      if (XEP_LAI) {
        dat.push('toa_do_x = ?', 'toa_do_y = ?');
        giaTri.push(b.toa_do_x, b.toa_do_y);
      }
      await db.query(`UPDATE ban SET ${dat.join(', ')} WHERE Id_ban = ?`, [...giaTri, co[0].Id_ban]);
      capNhat++;
    } else {
      await db.query(
        `INSERT INTO ban (id_vitri, number_ban, ghichu, image, trangthai, so_cho, toa_do_x, toa_do_y)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
        [idVitri, b.number_ban, b.ghichu, b.image, b.so_cho, b.toa_do_x, b.toa_do_y]
      );
      them++;
    }
  }
  return { them, capNhat };
}

/**
 * Moi ban co dung mot ma QR trung ten.
 *
 * `server.js` uu tien `?name=` tren URL hon `qr_tables.table_name`, nen phai sua
 * ca hai - chi sua ten trong DB thi ma QR da in van gui len ten cu.
 */
async function dongBoMaQR() {
  const [banRows] = await db.query('SELECT number_ban FROM ban ORDER BY number_ban');
  const tenBan = banRows.map((r) => r.number_ban);

  // 1) Doi ten 10 ma QR cu ('1'..'10') sang ma ban moi.
  let doiTen = 0;
  for (const [cu, moi] of Object.entries(DOI_TEN_QR)) {
    const [rows] = await db.query(
      'SELECT id, table_id FROM qr_tables WHERE TRIM(table_name) = ? LIMIT 1',
      [String(cu)]
    );
    if (!rows.length) continue;
    const url = `${URL_GOC}/qr/table/${rows[0].table_id}?name=${encodeURIComponent(moi)}`;
    await db.query('UPDATE qr_tables SET table_name = ?, url = ? WHERE id = ?', [moi, url, rows[0].id]);
    doiTen++;
  }
  if (doiTen) console.log(`  ~ đổi tên ${doiTen} mã QR cũ theo mã bàn mới`);

  // 2) Tao ma cho ban chua co. `table_id` sinh tu ma ban nen chay lai khong doi -
  //    tranh dung Date.now() vi 40 lan lap trong cung mili giay se trung nhau.
  let tao = 0;
  for (const ten of tenBan) {
    const [co] = await db.query('SELECT id FROM qr_tables WHERE TRIM(table_name) = ? LIMIT 1', [ten]);
    if (co.length) continue;
    const tableId = 'TBL' + ten.toUpperCase();
    const url = `${URL_GOC}/qr/table/${tableId}?name=${encodeURIComponent(ten)}`;
    await db.query(
      'INSERT INTO qr_tables (table_id, table_name, note, url) VALUES (?, ?, ?, ?)',
      [tableId, ten, '', url]
    );
    tao++;
  }
  return { doiTen, tao };
}

async function main() {
  console.log('=== Migration 011: mở rộng sơ đồ bàn (40 bàn / 4 khu) ===');
  console.log(XEP_LAI
    ? 'Chế độ --xep-lai: xếp lại toàn bộ bàn về lưới mặc định.\n'
    : '(Giữ nguyên toạ độ các bàn đã có. Dùng --xep-lai để xếp lại từ đầu.)\n');

  console.log('[1/5] Cập nhật schema');
  await capNhatSchema();

  console.log('\n[2/5] Đồng bộ khu vực');
  const idTheoMa = await dongBoKhuVuc();

  console.log('\n[3/5] Đổi tên bàn cũ sang mã thống nhất');
  const daDoiTen = await doiTenBanCu();
  if (!daDoiTen) console.log('  (không có bàn nào mang tên cũ - đã đổi từ lần chạy trước)');

  console.log('\n[4/5] Đồng bộ danh sách bàn');
  const { them, capNhat } = await dongBoBan(idTheoMa);
  console.log(`  + thêm mới: ${them} bàn · cập nhật: ${capNhat} bàn`);

  console.log('\n[5/5] Đồng bộ mã QR');
  const qr = await dongBoMaQR();
  console.log(`  + tạo mới: ${qr.tao} mã QR`);

  const [tongKet] = await db.query(
    `SELECT v.thu_tu, v.Name_vitri AS khu, COUNT(b.Id_ban) AS so_ban, SUM(b.so_cho) AS so_cho
       FROM vitri v LEFT JOIN ban b ON b.id_vitri = v.id_vitri
      GROUP BY v.id_vitri, v.thu_tu, v.Name_vitri
      ORDER BY v.thu_tu, v.id_vitri`
  );
  const [tong] = await db.query('SELECT COUNT(*) AS n, SUM(so_cho) AS cho FROM ban');
  const [moCoi] = await db.query(
    'SELECT number_ban FROM ban WHERE id_vitri NOT IN (SELECT id_vitri FROM vitri)'
  );

  console.log('\n=== Xong ===');
  for (const r of tongKet) {
    console.log(`  ${String(r.khu).padEnd(12)} ${String(r.so_ban).padStart(2)} bàn · ${r.so_cho || 0} chỗ`);
  }
  console.log(`  ${'TỔNG'.padEnd(12)} ${String(tong[0].n).padStart(2)} bàn · ${tong[0].cho} chỗ`);
  if (moCoi.length) {
    console.log(`  ! Bàn không thuộc khu nào: ${moCoi.map((r) => r.number_ban).join(', ')}`);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => { console.error('\nMigration 011 lỗi:', e.message); process.exit(1); });
}

module.exports = { main, KHU_VUC, danhSachBanMongMuon };
