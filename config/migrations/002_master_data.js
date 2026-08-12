/**
 * Migration 002 - Nap master data.
 *
 * Gom: don vi tinh, danh muc nguyen lieu, nhom do uong (menu hien tai khong co
 * do uong nen phan goi y mon di kem se rat ngheo nan), cong thuc che bien cho
 * tung mon, nha cung cap va combo.
 *
 * Script chay duoc nhieu lan (idempotent): moi buoc deu kiem tra ton tai truoc.
 */
const db = require('../db');

// --------------------------------------------------------------------------
// 1. Don vi tinh
// --------------------------------------------------------------------------
const DON_VI = ['kg', 'gram', 'lit', 'ml', 'chai', 'lon', 'bo', 'cai', 'hop', 'goi'];

async function napDonViTinh() {
  console.log('\n[1/6] Don vi tinh');
  const map = {};
  for (const ten of DON_VI) {
    const [ton] = await db.query('SELECT id_dvt FROM don_vi_tinh WHERE ten_dvt = ?', [ten]);
    if (ton.length) {
      map[ten] = ton[0].id_dvt;
    } else {
      const [r] = await db.query('INSERT INTO don_vi_tinh (ten_dvt) VALUES (?)', [ten]);
      map[ten] = r.insertId;
      console.log(`  + ${ten}`);
    }
  }
  return map;
}

// --------------------------------------------------------------------------
// 2. Nguyen lieu
// [ten chuan, don vi, gia von / don vi (VND), han su dung (ngay), ton dau ky]
// --------------------------------------------------------------------------
const NGUYEN_LIEU = [
  ['Thịt bò', 'kg', 320000, 5, 40],
  ['Thịt heo', 'kg', 150000, 5, 50],
  ['Thịt gà', 'kg', 130000, 4, 45],
  ['Sườn heo', 'kg', 180000, 4, 25],
  ['Tôm sú', 'kg', 280000, 3, 15],
  ['Thịt cua', 'kg', 450000, 2, 8],
  ['Đậu hủ', 'kg', 25000, 3, 20],
  ['Gạo tẻ', 'kg', 22000, 180, 200],
  ['Bún tươi', 'kg', 18000, 2, 20],
  ['Miến dong', 'kg', 45000, 180, 15],
  ['Hủ tiếu', 'kg', 35000, 90, 18],
  ['Bánh tráng', 'bo', 15000, 90, 30],
  ['Xà lách', 'kg', 30000, 4, 15],
  ['Ngó sen', 'kg', 55000, 5, 10],
  ['Cà rốt', 'kg', 20000, 14, 20],
  ['Hành tây', 'kg', 25000, 21, 18],
  ['Hành lá', 'kg', 35000, 5, 8],
  ['Cà chua', 'kg', 28000, 7, 15],
  ['Dưa leo', 'kg', 18000, 7, 12],
  ['Rau thơm', 'kg', 40000, 3, 6],
  ['Nấm rơm', 'kg', 70000, 4, 8],
  ['Trứng gà', 'cai', 3500, 21, 300],
  ['Dầu ăn', 'lit', 45000, 365, 40],
  ['Nước mắm', 'lit', 60000, 365, 25],
  ['Tương ớt', 'chai', 22000, 365, 30],
  ['Xì dầu', 'chai', 25000, 365, 25],
  ['Muối', 'kg', 8000, 730, 30],
  ['Tỏi', 'kg', 60000, 60, 10],
  ['Gừng', 'kg', 45000, 30, 8],
  ['Sả', 'kg', 30000, 14, 10],
  ['Ớt tươi', 'kg', 50000, 10, 6],
  ['Trái cây theo mùa', 'kg', 45000, 5, 25],
  ['Bột rau câu', 'kg', 120000, 365, 5],
  ['Sữa đặc', 'hop', 25000, 365, 24],
  ['Đá viên', 'kg', 3000, 7, 100],
  ['Coca-Cola', 'lon', 8000, 270, 240],
  ['Pepsi', 'lon', 7500, 270, 180],
  ['Bia Tiger', 'lon', 16000, 270, 300],
  ['Nước suối', 'chai', 4000, 365, 360],
  ['Cam tươi', 'kg', 40000, 10, 20],
  ['Trà khô', 'kg', 90000, 365, 5],
];

/** Vai nguyen lieu da co san trong DB duoi ten viet tat/sai chinh ta. */
const DOI_TEN = { tieu: 'Tiêu', duong: 'Đường', 'bột ngọt1': 'Bột ngọt', 'hạt nêm': 'Hạt nêm' };
const NGUYEN_LIEU_CO_SAN = [
  ['Tiêu', 'kg', 250000, 365],
  ['Đường', 'kg', 20000, 365],
  ['Bột ngọt', 'kg', 45000, 365],
  ['Hạt nêm', 'kg', 55000, 365],
];

async function napNguyenLieu(dvt) {
  console.log('\n[2/6] Nguyen lieu');

  // Chuan hoa ten cac dong da co truoc.
  for (const [cu, moi] of Object.entries(DOI_TEN)) {
    await db.query(
      'UPDATE nguyen_lieu SET ten_nl = ?, ten_chuan = ? WHERE LOWER(TRIM(ten_nl)) = ?',
      [moi, moi, cu]
    );
  }
  for (const [ten, dv, gia, hsd] of NGUYEN_LIEU_CO_SAN) {
    await db.query(
      'UPDATE nguyen_lieu SET id_dvt = ?, gia_von = ?, han_su_dung_ngay = ?, dinh_muc_min = ? WHERE ten_nl = ?',
      [dvt[dv], gia, hsd, 3, ten]
    );
  }

  const map = {};
  const [dangCo] = await db.query('SELECT id_nl, ten_nl FROM nguyen_lieu');
  for (const r of dangCo) map[r.ten_nl] = r.id_nl;

  let them = 0;
  for (const [ten, dv, gia, hsd, ton] of NGUYEN_LIEU) {
    if (map[ten]) continue;
    // Dinh muc ton toi thieu ~ 15% ton dau ky, lam tron len.
    const dinhMucMin = Math.max(1, Math.round(ton * 0.15));
    const [r] = await db.query(
      `INSERT INTO nguyen_lieu (ten_nl, ten_chuan, id_dvt, so_luong, dinh_muc_min, gia_von, han_su_dung_ngay)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ten, ten, dvt[dv], ton, dinhMucMin, gia, hsd]
    );
    map[ten] = r.insertId;
    them++;
  }
  console.log(`  + them ${them} nguyen lieu, tong ${Object.keys(map).length}`);
  return map;
}

// --------------------------------------------------------------------------
// 3. Nhom do uong + mon moi
// --------------------------------------------------------------------------
const DO_UONG = [
  ['Coca-Cola', 25000],
  ['Pepsi', 25000],
  ['Bia Tiger', 35000],
  ['Nước suối', 15000],
  ['Nước cam ép', 45000],
  ['Trà đá', 5000],
];

async function napDoUong() {
  console.log('\n[3/6] Nhom do uong');
  let [loai] = await db.query("SELECT id_loai FROM loai_mon WHERE name_loai = 'Đồ uống'");
  let idLoai;
  if (loai.length) {
    idLoai = loai[0].id_loai;
  } else {
    const [r] = await db.query(
      "INSERT INTO loai_mon (name_loai, ghichu) VALUES ('Đồ uống', 'Nước giải khát')"
    );
    idLoai = r.insertId;
    console.log('  + tao danh muc Đồ uống');
  }

  let them = 0;
  for (const [ten, gia] of DO_UONG) {
    const [ton] = await db.query('SELECT id_mon FROM monan WHERE name_mon = ?', [ten]);
    if (ton.length) continue;
    await db.query(
      'INSERT INTO monan (name_mon, id_loai, gia_mon, ghichu_mon, tinhtrang) VALUES (?, ?, ?, ?, 1)',
      [ten, idLoai, gia, 'Đồ uống giải khát']
    );
    them++;
  }
  console.log(`  + them ${them} do uong`);
  return idLoai;
}

// --------------------------------------------------------------------------
// 4. Cong thuc che bien
// Map theo TEN mon -> [[ten nguyen lieu, luong tieu hao cho 1 phan], ...]
// --------------------------------------------------------------------------
const CONG_THUC = {
  'Heo nướng': [['Thịt heo', 0.25], ['Sả', 0.02], ['Tỏi', 0.01], ['Dầu ăn', 0.02], ['Hạt nêm', 0.01]],
  'Heo lên mẹt': [['Thịt heo', 0.3], ['Bánh tráng', 0.5], ['Xà lách', 0.1], ['Rau thơm', 0.05], ['Dưa leo', 0.08]],
  'Sườn heo ngon': [['Sườn heo', 0.35], ['Tỏi', 0.015], ['Xì dầu', 0.05], ['Đường', 0.02]],
  'Heo quay': [['Thịt heo', 0.32], ['Muối', 0.01], ['Ngũ vị', 0], ['Dầu ăn', 0.03]],
  'Bò lagu': [['Thịt bò', 0.28], ['Cà rốt', 0.1], ['Hành tây', 0.08], ['Cà chua', 0.1]],
  'Bò nướng Y': [['Thịt bò', 0.3], ['Hành tây', 0.06], ['Dầu ăn', 0.02], ['Tiêu', 0.005]],
  'Bò nướng đá': [['Thịt bò', 0.35], ['Hành tây', 0.06], ['Tiêu', 0.006], ['Bơ', 0]],
  'Bò hầm': [['Thịt bò', 0.3], ['Cà rốt', 0.12], ['Gừng', 0.02], ['Hạt nêm', 0.012]],
  'Gà gỏi': [['Thịt gà', 0.25], ['Xà lách', 0.12], ['Cà rốt', 0.05], ['Rau thơm', 0.04]],
  'Gà gỏi ': [['Thịt gà', 0.25], ['Ngó sen', 0.1], ['Cà rốt', 0.05], ['Rau thơm', 0.04]],
  'Gà ngó sen': [['Thịt gà', 0.22], ['Ngó sen', 0.15], ['Cà rốt', 0.05], ['Rau thơm', 0.03]],
  'Gà hầm': [['Thịt gà', 0.35], ['Nấm rơm', 0.08], ['Gừng', 0.02], ['Hạt nêm', 0.012]],
  'Gà nướng': [['Thịt gà', 0.35], ['Sả', 0.025], ['Tỏi', 0.015], ['Dầu ăn', 0.02]],
  'Cơm chiên Lộc Phát': [['Gạo tẻ', 0.2], ['Trứng gà', 2], ['Cà rốt', 0.04], ['Hành lá', 0.02], ['Dầu ăn', 0.03]],
  'Cơm xá xíu': [['Gạo tẻ', 0.2], ['Thịt heo', 0.12], ['Dưa leo', 0.05], ['Hành lá', 0.02]],
  'Hủ tiếu áp chảo ': [['Hủ tiếu', 0.18], ['Thịt heo', 0.1], ['Xà lách', 0.05], ['Dầu ăn', 0.03]],
  'Miến xào cua': [['Miến dong', 0.15], ['Thịt cua', 0.08], ['Trứng gà', 1], ['Hành lá', 0.02]],
  'Chả giò': [['Bánh tráng', 0.3], ['Thịt heo', 0.1], ['Cà rốt', 0.04], ['Dầu ăn', 0.05]],
  'Khai vị ba món': [['Thịt heo', 0.08], ['Thịt gà', 0.08], ['Tôm sú', 0.06], ['Xà lách', 0.06]],
  'Đậu hủ chiên giòn ': [['Đậu hủ', 0.25], ['Dầu ăn', 0.05], ['Hành lá', 0.02]],
  'Đậu hủ tứ xuyên': [['Đậu hủ', 0.25], ['Thịt heo', 0.06], ['Ớt tươi', 0.02], ['Tương ớt', 0.03]],
  'Trái cây 1': [['Trái cây theo mùa', 0.25]],
  'Trái cây 2': [['Trái cây theo mùa', 0.25]],
  'Rau câu 1': [['Bột rau câu', 0.03], ['Đường', 0.04], ['Sữa đặc', 0.1]],
  'Rau câu 2': [['Bột rau câu', 0.03], ['Đường', 0.04], ['Sữa đặc', 0.1]],
  'Coca-Cola': [['Coca-Cola', 1], ['Đá viên', 0.15]],
  Pepsi: [['Pepsi', 1], ['Đá viên', 0.15]],
  'Bia Tiger': [['Bia Tiger', 1], ['Đá viên', 0.2]],
  'Nước suối': [['Nước suối', 1]],
  'Nước cam ép': [['Cam tươi', 0.3], ['Đường', 0.02], ['Đá viên', 0.15]],
  'Trà đá': [['Trà khô', 0.005], ['Đá viên', 0.2]],
};

async function napCongThuc(nl) {
  console.log('\n[4/6] Cong thuc che bien');
  const [mons] = await db.query('SELECT id_mon, name_mon FROM monan');
  const monTheoTen = {};
  for (const m of mons) monTheoTen[m.name_mon] = m.id_mon;

  let them = 0;
  const thieu = [];
  for (const [tenMon, ds] of Object.entries(CONG_THUC)) {
    const idMon = monTheoTen[tenMon];
    if (!idMon) {
      thieu.push(tenMon);
      continue;
    }
    for (const [tenNL, luong] of ds) {
      // Bo qua nguyen lieu khong co trong danh muc (vd 'Bơ', 'Ngũ vị').
      if (!nl[tenNL] || !luong) continue;
      const [ton] = await db.query(
        'SELECT id_ct FROM cong_thuc WHERE id_mon = ? AND id_nl = ?',
        [idMon, nl[tenNL]]
      );
      if (ton.length) {
        await db.query('UPDATE cong_thuc SET so_luong_tieu_hao = ? WHERE id_ct = ?', [
          luong,
          ton[0].id_ct,
        ]);
      } else {
        await db.query(
          'INSERT INTO cong_thuc (id_mon, id_nl, so_luong_tieu_hao) VALUES (?, ?, ?)',
          [idMon, nl[tenNL], luong]
        );
        them++;
      }
    }
  }
  if (thieu.length) console.log(`  ! khong tim thay mon: ${thieu.join(', ')}`);

  const [tong] = await db.query(
    'SELECT COUNT(DISTINCT id_mon) AS mon, COUNT(*) AS dong FROM cong_thuc'
  );
  console.log(`  + them ${them} dong; hien co cong thuc cho ${tong[0].mon} mon (${tong[0].dong} dong)`);
}

// --------------------------------------------------------------------------
// 5. Nha cung cap
// --------------------------------------------------------------------------
const NCC = [
  ['Công ty TNHH Thực phẩm Vissan', '02839553999', 'kinhdoanh@vissan.com.vn', '420 Nơ Trang Long, Bình Thạnh, TP.HCM', 5],
  ['Chợ đầu mối Bình Điền', '02837561234', 'binhdien@cdm.vn', 'Quản lộ Phú Định, Bình Chánh, TP.HCM', 4],
  ['Công ty CP Sữa Việt Nam', '02854155555', 'vinamilk@vnm.com.vn', '10 Tân Trào, Quận 7, TP.HCM', 5],
  ['Nhà phân phối Suntory PepsiCo', '02838219999', 'order@suntorypepsico.vn', '3-4-5 Đường Số 3, KCN Sóng Thần, Bình Dương', 5],
  ['HTX Rau sạch Đà Lạt', '02633822456', 'rausach@dalat.vn', '15 Nguyễn Công Trứ, Đà Lạt, Lâm Đồng', 4],
];

async function napNhaCungCap() {
  console.log('\n[5/6] Nha cung cap');
  let them = 0;
  for (const [ten, sdt, email, dc, dg] of NCC) {
    const [ton] = await db.query('SELECT id_ncc FROM nha_cung_cap WHERE ten_ncc = ?', [ten]);
    if (ton.length) continue;
    await db.query(
      'INSERT INTO nha_cung_cap (ten_ncc, sodienthoai, email, diachi, danh_gia) VALUES (?, ?, ?, ?, ?)',
      [ten, sdt, email, dc, dg]
    );
    them++;
  }
  console.log(`  + them ${them} nha cung cap`);
}

// --------------------------------------------------------------------------
// 6. Combo
// --------------------------------------------------------------------------
const COMBO = [
  ['Combo Gia Đình 4 người', 890000, 'Bò nướng đá, Gà nướng, Cơm chiên Lộc Phát, Chả giò, 4 nước ngọt'],
  ['Combo Cặp Đôi', 450000, 'Bò nướng Y, Đậu hủ tứ xuyên, 2 Trà đá, 1 Rau câu'],
  ['Combo Trưa Văn Phòng', 150000, 'Cơm xá xíu, Trà đá, Trái cây tráng miệng'],
  ['Combo Nhậu Bạn Bè', 650000, 'Heo lên mẹt, Chả giò, Khai vị ba món, 6 Bia Tiger'],
];

async function napCombo() {
  console.log('\n[6/6] Combo');
  let them = 0;
  for (const [ten, gia, mo] of COMBO) {
    const [ton] = await db.query('SELECT id_combo FROM combos WHERE ten_combo = ?', [ten]);
    if (ton.length) continue;
    await db.query(
      'INSERT INTO combos (ten_combo, gia_combo, mo_ta, trang_thai) VALUES (?, ?, ?, 1)',
      [ten, gia, mo]
    );
    them++;
  }
  console.log(`  + them ${them} combo`);
}

async function main() {
  console.log('=== Migration 002: master data ===');
  const dvt = await napDonViTinh();
  const nl = await napNguyenLieu(dvt);
  await napDoUong();
  await napCongThuc(nl);
  await napNhaCungCap();
  await napCombo();
  console.log('\n=== Hoan tat migration 002 ===');
  await db.end();
}

main().catch((err) => {
  console.error('Migration that bai:', err);
  process.exit(1);
});
