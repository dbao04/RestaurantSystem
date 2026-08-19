/**
 * Migration 027 - Soan lai 4 combo theo thuc don Nhat.
 *
 * VAN DE
 * Migration 025 da anh xa `hopdong` va `xuat_kho` sang mon Nhat, nhung BO SOT
 * bang `combos`. Bon combo van mo ta bang mon cua thuc don Viet cu:
 *
 *   Combo Gia Dinh 4 nguoi  "Bo nuong da, Ga nuong, Com chien Loc Phat, Cha gio..."
 *   Combo Cap Doi           "Bo nuong Y, Dau hu tu xuyen, 2 Tra da, 1 Rau cau"
 *   Combo Trua Van Phong    "Com xa xiu, Tra da, Trai cay trang mieng"
 *   Combo Nhau Ban Be       "Heo len met, Cha gio, Khai vi ba mon, 6 Bia Tiger"
 *
 * Khong mon nao trong so do con ton tai. Day khong phai loi trong noi bo: cot
 * `mo_ta` duoc TRA THANG CHO KHACH o hai cho:
 *   - Tro ly ao, y dinh `hoi_combo` (`truy_van._q_combo`) tra ve bang gom ten,
 *     gia va mo ta - khach hoi "quan co combo gi" la doc duoc ten mon da bi xoa.
 *   - Man hinh /staff/kitchen/combos cua bep.
 *
 * CACH SOAN LAI
 * Giu nguyen 4 VAI TRO va 4 MUC GIA cu. Vai tro thi bo sinh du lieu lich su
 * (migration 003) dung lam kich ban nhom khach, doi ten combo la lech voi phan
 * phan tich gio hang; muc gia thi da nam trong don hang lich su.
 *
 * Moi combo ghep tu mon CO THAT trong thuc don hien tai, tong gia le luon cao
 * hon gia combo tu 7% den 15% - dung y nghia mot combo: khach mua theo set thi
 * re hon goi le. Tong gia le duoc ghi ngay canh moi dong duoi day de nguoi sau
 * kiem lai bang mat ma khong phai tra bang.
 *
 * CHAY LAI DUOC NHIEU LAN
 * Chi ghi de combo nao con dau vet thuc don cu (`mo_ta` chua mot trong cac tu
 * khoa o TU_KHOA_CU). Combo da soan lai, hoac combo do quan ly tu sua sau nay,
 * deu duoc giu nguyen - chay lai lan hai se bao "bo qua" chu khong dap len cong
 * suc cua nguoi khac.
 *
 * Chay:  node config/migrations/027_combo_theo_thuc_don_moi.js
 */
const db = require('../db');

// Dau vet cua thuc don cu. Chi can dinh MOT tu khoa la combo do can soan lai.
const TU_KHOA_CU = [
  'Bò nướng', 'Gà nướng', 'Cơm chiên Lộc Phát', 'Chả giò', 'Đậu hủ tứ xuyên',
  'Trà đá', 'Rau câu', 'Cơm xá xíu', 'Heo lên mẹt', 'Khai vị ba món',
  'Bia Tiger', 'Trái cây tráng miệng', 'nước ngọt',
];

const COMBO_MOI = [
  {
    ten: 'Combo Gia Đình 4 người',
    gia: 890000,
    // 249 + 249 + 119 + 99 + 4x25 + 4x25 = 1.016.000 -> loi 126.000 (12,4%)
    mo_ta: 'Sashimi Set B, Lẩu Nabe hải sản, Cơm chiên hải sản, '
         + 'Tempura thập cẩm, 4 súp miso, 4 panna cotta',
  },
  {
    ten: 'Combo Cặp Đôi',
    gia: 450000,
    // 139 + 89 + 2x39 + 2x45 + 2x55 = 506.000 -> loi 56.000 (11,1%)
    mo_ta: 'Combo Sushi Set 1, Tôm nướng sốt mentaiko, 2 súp trứng, '
         + '2 kem matcha, 2 trà đào cam sả',
  },
  {
    ten: 'Combo Trưa Văn Phòng',
    gia: 150000,
    // 109 + 25 + 18 + 25 = 177.000 -> loi 27.000 (15,3%)
    mo_ta: 'Cơm gyudon, súp miso, trà xanh Nhật, panna cotta chanh dây',
  },
  {
    ten: 'Combo Nhậu Bạn Bè',
    gia: 650000,
    // 65 + 39 + 95 + 129 + 85 + 6x45 = 683.000 -> loi 33.000 (4,8%)
    mo_ta: 'Bạch tuộc trộn mù tạt, đậu nành lông, gà chiên karaage, '
         + 'sò điệp nướng sốt mentaiko, tôm nướng sốt miso, 6 Sapporo',
  },
];

function conDauVetCu(moTa) {
  const s = String(moTa || '');
  return TU_KHOA_CU.some((t) => s.includes(t));
}

async function soanLai(conn) {
  const [rows] = await conn.query('SELECT id_combo, ten_combo, mo_ta FROM combos ORDER BY id_combo');
  let doi = 0, boQua = 0, khongKhop = 0;

  for (const r of rows) {
    if (!conDauVetCu(r.mo_ta)) {
      console.log(`  [bo qua] #${r.id_combo} ${r.ten_combo} - khong con dau vet thuc don cu`);
      boQua++;
      continue;
    }
    // Ghep theo TEN combo chu khong theo id: id_combo co the khac nhau giua cac
    // ban CSDL (may cua tung thanh vien), con ten thi do migration 002 dat ra.
    const moi = COMBO_MOI.find((c) => c.ten === r.ten_combo);
    if (!moi) {
      console.log(`  [!] #${r.id_combo} "${r.ten_combo}" con mon cu nhung khong co ban soan lai - de nguyen, sua tay o /staff/kitchen/combos`);
      khongKhop++;
      continue;
    }
    await conn.query(
      'UPDATE combos SET gia_combo = ?, mo_ta = ? WHERE id_combo = ?',
      [moi.gia, moi.mo_ta, r.id_combo]
    );
    console.log(`  [doi]    #${r.id_combo} ${r.ten_combo}`);
    console.log(`             cu : ${r.mo_ta}`);
    console.log(`             moi: ${moi.mo_ta}`);
    doi++;
  }
  return { doi, boQua, khongKhop };
}

async function kiemTra(conn) {
  const [rows] = await conn.query('SELECT id_combo, ten_combo, mo_ta FROM combos');
  const con = rows.filter((r) => conDauVetCu(r.mo_ta));
  if (con.length) {
    console.log(`  Con ${con.length} combo dinh mon cu:`);
    con.forEach((r) => console.log(`    #${r.id_combo} ${r.ten_combo}: ${r.mo_ta}`));
  } else {
    console.log('  Khong combo nao con dinh mon cua thuc don cu.');
  }
}

async function main() {
  console.log('=== Migration 027: soan lai combo theo thuc don Nhat ===\n');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const kq = await soanLai(conn);
    await conn.commit();

    console.log('\n--- Kiem tra lai ---');
    await kiemTra(conn);

    console.log('\n=== Hoan tat migration 027 ===');
    console.log(`  Da soan lai ${kq.doi} combo, bo qua ${kq.boQua}, khong khop ${kq.khongKhop}.`);
  } catch (err) {
    await conn.rollback();
    console.error('Migration that bai - da hoan tac:', err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await db.end();
  }
}

main();
