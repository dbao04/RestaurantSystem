/**
 * Migration 026 - Tuyen du nhan su theo dinh bien cua tung chuc danh.
 *
 * VI SAO CAN
 * Migration 009 tao dung MOT tai khoan cho MOI chuc danh - du de dang nhap thu
 * tung vai tro, nhung khong phai mot nha hang that. Bang `chuc_danh` da khai san
 * cot `dinh_bien` (so nguoi can co o moi chuc danh): tong 75 nguoi, trong khi
 * bang `nhan_vien` moi co 27. Thieu 48 nguoi.
 *
 * Thieu nguoi thi nhung phan phu thuoc vao quan so deu chay khong that:
 *   - Xep ca tu dong khong du nguoi rai cho 3 ca x 7 ngay
 *   - To lam viec chi co to truong, khong co thanh vien
 *   - Mot nguoi dang phai lam to truong cua ca 3 to bep cung luc
 *
 * MUC TIEU LA `dinh_bien`, KHONG PHAI CON SO TU NGHI RA
 * Script khong tu quyet dinh nha hang can bao nhieu nguoi. No doc `dinh_bien`
 * trong CSDL va tuyen cho du. Muon nhieu/it hon thi sua `chuc_danh.dinh_bien`
 * roi chay lai - khong sua script.
 *
 * CHAY LAI DUOC NHIEU LAN
 * Moi lan chi tuyen dung phan con thieu. Chay lan hai khi da du: tao 0 nguoi.
 *
 * QUY UOC DAT THEO NGUOI CU DA CO
 *   - ma_nv     : NV + 4 chu so, chay tiep tu ma lon nhat dang co
 *   - username  : lay goc tu username cua nguoi cung chuc danh, danh so tiep
 *                 (phucvu -> phucvu2, phucvu3... / shipper3 -> shipper4)
 *   - mat khau  : 123456 nhu toan bo tai khoan khac trong he thong
 *   - ten       : ten Viet that, khong phai "Nhan vien phuc vu 2". Ba shipper
 *                 co san da dat ten that (Le Van Hung, Tran Minh Tu...) nen day
 *                 la quy uoc san co; hon nua man hinh KDS, cham cong va xep ca
 *                 se khong phan biet noi 12 nguoi neu ai cung ten "Nhan vien
 *                 phuc vu".
 *   - quyen     : KHONG cap rieng. Quyen di theo chuc danh qua `chuc_danh_quyen`
 *                 (462 dong), nguoi moi huong ngay khi co `id_cd`.
 *
 * Chay:  node config/migrations/026_tuyen_du_nhan_su.js
 */
const db = require('../db');
const md5 = require('md5');

const MAT_KHAU = '123456';
const HASH = md5(MAT_KHAU);

const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Huỳnh', 'Hoàng', 'Phan', 'Vũ',
            'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const DEM_TEN = ['Văn Khoa', 'Thị Mai', 'Minh Quân', 'Thu Hà', 'Quốc Bảo', 'Ngọc Ánh',
                 'Hữu Phát', 'Kim Ngân', 'Thanh Tùng', 'Bảo Trâm', 'Gia Huy', 'Mỹ Duyên',
                 'Tiến Đạt', 'Hải Yến', 'Trung Kiên', 'Phương Linh', 'Anh Tuấn', 'Thùy Dung',
                 'Đức Thắng', 'Cẩm Tú', 'Nhật Nam', 'Hồng Nhung', 'Xuân Trường', 'Diễm My'];

// 16 va 24 co boi chung nho nhat 48, buoc 7 nguyen to cung voi 24: 48 nguoi dau
// tien chac chan khong trung ten nhau. Qua 48 thi them hau to so cho chac.
function tenThu(i) {
  const ten = `${HO[i % HO.length]} ${DEM_TEN[(i * 7) % DEM_TEN.length]}`;
  return i < HO.length * DEM_TEN.length ? ten : `${ten} ${i}`;
}

const XE = ['xe_may', 'xe_may', 'xe_dien', 'xe_may', 'xe_dap'];

// ---------------------------------------------------------------------------

async function tuyenNguoi(conn) {
  const [cd] = await conn.query(`
    SELECT c.id_cd, c.ma_cd, c.ten_cd, c.id_bp, c.cap_bac, c.chucvu_legacy,
           c.vai_tro_tuong_duong, COALESCE(c.dinh_bien, 0) dinh_bien
      FROM chuc_danh c ORDER BY c.cap_bac, c.thu_tu`);

  const [nv] = await conn.query(
    'SELECT id_nv, id_cd, ma_nv, username FROM nhan_vien WHERE trangthai = 1');

  // Goc username + so lon nhat da dung, tinh rieng cho tung chuc danh.
  const theoCd = new Map();
  for (const n of nv) {
    const goc = String(n.username || '').replace(/\d+$/, '');
    const so = parseInt(String(n.username || '').match(/(\d+)$/)?.[1] || '1', 10);
    const cur = theoCd.get(n.id_cd) || { goc, soMax: 0, dangCo: 0 };
    if (goc) cur.goc = goc;
    cur.soMax = Math.max(cur.soMax, so);
    cur.dangCo += 1;
    theoCd.set(n.id_cd, cur);
  }

  const dungRoi = new Set(nv.map((n) => n.username));
  const [[m]] = await conn.query("SELECT MAX(CAST(SUBSTRING(ma_nv, 3) AS UNSIGNED)) m FROM nhan_vien");
  let soMa = Number(m.m || 0);
  let i = nv.length; // chi so sinh ten, chay tiep de khong dung lai ten cu

  const themVao = [];
  for (const c of cd) {
    const cur = theoCd.get(c.id_cd) || { goc: c.ma_cd.toLowerCase(), soMax: 0, dangCo: 0 };
    const thieu = c.dinh_bien - cur.dangCo;
    if (thieu <= 0) continue;

    // Gia tri ENUM cu, giong het cach migration 009 suy ra.
    const chucvu = (c.chucvu_legacy || '').trim() ||
      (c.vai_tro_tuong_duong || '').split(',')[0].trim() || 'Nhan vien chung';

    for (let k = 0; k < thieu; k++) {
      soMa += 1;
      let user = `${cur.goc}${cur.soMax + 1 + k}`;
      while (dungRoi.has(user)) user += 'x'; // chan trung o moi truong da sua tay
      dungRoi.add(user);

      const maNv = 'NV' + String(soMa).padStart(4, '0');
      const ten = tenThu(i);
      const sdt = '0906' + String(i + 1).padStart(6, '0');
      // Rai ngay vao lam ra ~2 nam de tham nien va bao cao nhan su co do day.
      const soNgay = 30 + i * 14;
      i += 1;

      const [kq] = await conn.query(
        `INSERT INTO nhan_vien
           (ma_nv, ten, sodienthoai, email, chucvu, id_cd, id_bp, username, passwords,
            ngayvaolam, ngay_bo_nhiem, trangthai, trang_thai_lam_viec)
         VALUES (?,?,?,?,?,?,?,?,?,
                 DATE_SUB(CURDATE(), INTERVAL ? DAY), DATE_SUB(CURDATE(), INTERVAL ? DAY), 1, 'dang_lam')`,
        [maNv, ten, sdt, `${user}@nhahang.com`, chucvu, c.id_cd, c.id_bp, user, HASH, soNgay, soNgay]
      );
      themVao.push({ id_nv: kq.insertId, maNv, ten, user, ma_cd: c.ma_cd, ten_cd: c.ten_cd, id_bp: c.id_bp, cap_bac: c.cap_bac });
    }
    console.log(`  + ${String(thieu).padStart(2)} ${c.ten_cd}`);
  }
  return themVao;
}

/**
 * Nguoi giu chuc danh con bao cao cho nguoi giu chuc danh cha. Mot chuc danh gio
 * co nhieu nguoi, nen chon nguoi co id_nv nho nhat lam cap tren - deu va lap lai
 * duoc, khac voi ban 009 vong 1-1 (khi do moi chuc danh chi co dung mot nguoi).
 */
async function noiDuongBaoCao(conn) {
  const [r] = await conn.query(`
    UPDATE nhan_vien n
      JOIN chuc_danh cd ON cd.id_cd = n.id_cd
      JOIN (SELECT id_cd, MIN(id_nv) id_nv FROM nhan_vien WHERE trangthai = 1 GROUP BY id_cd) sep
        ON sep.id_cd = cd.id_cd_cha
       SET n.id_quan_ly = sep.id_nv
     WHERE cd.id_cd_cha IS NOT NULL AND n.id_nv <> sep.id_nv AND n.trangthai = 1`);
  console.log(`  ${r.affectedRows} duong bao cao`);
}

/**
 * Chia nguoi vao to. Truoc migration nay moi to chi co to truong, va mot nguoi
 * phai lam to truong cua ca 3 to bep cung luc vi chi co dung mot to truong bep.
 * Gio du nguoi thi moi to nhan mot to truong rieng.
 *
 * Dung lai tu dau bang `thanh_vien_to` cho cac bo phan co to: cach nay lap lai
 * duoc, va tranh phai do xem dong cu con dung hay khong.
 */
async function chiaTo(conn) {
  const [tos] = await conn.query(
    'SELECT id_to, ten_to, id_bp FROM to_lam_viec WHERE trang_thai = 1 ORDER BY id_to');
  const boPhanCoTo = [...new Set(tos.map((t) => t.id_bp))];
  if (!boPhanCoTo.length) return;

  await conn.query(
    `DELETE tv FROM thanh_vien_to tv JOIN to_lam_viec t ON t.id_to = tv.id_to
      WHERE t.id_bp IN (${boPhanCoTo.map(() => '?').join(',')})`, boPhanCoTo);

  let soTruong = 0;
  let soThanhVien = 0;
  for (const idBp of boPhanCoTo) {
    const toCuaBp = tos.filter((t) => t.id_bp === idBp);
    const [ng] = await conn.query(`
      SELECT n.id_nv, cd.cap_bac FROM nhan_vien n JOIN chuc_danh cd ON cd.id_cd = n.id_cd
       WHERE cd.id_bp = ? AND n.trangthai = 1 ORDER BY cd.cap_bac, n.id_nv`, [idBp]);

    // To truong dung nghia la chuc danh cap 4. Nhung Le tan va Thu ngan khong co
    // chuc danh cap 4 nao - nguoi phu trach cao nhat cua ho la cap 3 (Truong le
    // tan, Giam sat thu ngan). Khong du phong thi hai to nay mat to truong, va
    // `to_lam_viec.id_to_truong` se noi mot dang con `thanh_vien_to` noi mot neo.
    const capCao = ng.length ? Math.min(...ng.map((x) => x.cap_bac)) : null;
    const truong = ng.filter((x) => x.cap_bac === 4);
    const nguoiDan = truong.length ? truong : ng.filter((x) => x.cap_bac === capCao);
    const dungLamTruong = new Set(nguoiDan.map((x) => x.id_nv));
    const thanhVien = ng.filter((x) => x.cap_bac >= 5 && !dungLamTruong.has(x.id_nv));

    for (let k = 0; k < toCuaBp.length; k++) {
      const to = toCuaBp[k];
      // Het to truong rieng thi quay vong - van hon la de to khong co ai phu trach.
      const t = nguoiDan.length ? nguoiDan[k % nguoiDan.length] : null;
      if (t) {
        await conn.query('UPDATE to_lam_viec SET id_to_truong = ? WHERE id_to = ?', [t.id_nv, to.id_to]);
        await conn.query(
          "INSERT INTO thanh_vien_to (id_to, id_nv, vai_tro_trong_to, tu_ngay, trang_thai) VALUES (?,?,'to_truong',CURDATE(),1)",
          [to.id_to, t.id_nv]);
        soTruong++;
      }
    }
    // Rai thanh vien deu cho cac to trong cung bo phan.
    for (let k = 0; k < thanhVien.length; k++) {
      const to = toCuaBp[k % toCuaBp.length];
      await conn.query(
        "INSERT INTO thanh_vien_to (id_to, id_nv, vai_tro_trong_to, tu_ngay, trang_thai) VALUES (?,?,'thanh_vien',CURDATE(),1)",
        [to.id_to, thanhVien[k].id_nv]);
      soThanhVien++;
    }
  }
  console.log(`  ${soTruong} to truong, ${soThanhVien} thanh vien vao ${tos.length} to`);
}

/**
 * Nhan vien giao hang phai co dong trong bang `shipper` thi dieu phoi moi thay -
 * `vanChuyen.js` phan don theo bang nay chu khong theo `nhan_vien`.
 */
async function taoShipper(conn) {
  const [thieu] = await conn.query(`
    SELECT n.id_nv, n.ten, n.sodienthoai FROM nhan_vien n
      JOIN chuc_danh cd ON cd.id_cd = n.id_cd
      LEFT JOIN shipper s ON s.id_nv = n.id_nv
     WHERE cd.ma_cd = 'SHIPPER' AND n.trangthai = 1 AND s.id_shipper IS NULL`);
  if (!thieu.length) { console.log('  khong thieu shipper nao'); return; }

  const [[dv]] = await conn.query('SELECT MIN(id_dv) id FROM don_vi_van_chuyen');
  const [[mx]] = await conn.query('SELECT COUNT(*) n FROM shipper');
  let i = Number(mx.n);
  for (const n of thieu) {
    const xe = XE[i % XE.length];
    const bienSo = `59${'XHKLP'[i % 5]}${(i % 9) + 1}-${String(100 + i * 37 % 900).padStart(3, '0')}.${String(i * 13 % 100).padStart(2, '0')}`;
    await conn.query(
      `INSERT INTO shipper (id_dv, id_nv, ten, sdt, loai_xe, bien_so, so_don_toi_da, trang_thai)
       VALUES (?,?,?,?,?,?,?, 'san_sang')`,
      [dv.id, n.id_nv, n.ten, n.sodienthoai, xe, bienSo, xe === 'xe_dap' ? 2 : 3]);
    i += 1;
    console.log(`  + shipper ${n.ten} (${xe} ${bienSo})`);
  }
}

async function kiemTra(conn) {
  const [r] = await conn.query(`
    SELECT c.ten_cd, c.dinh_bien, COUNT(n.id_nv) co
      FROM chuc_danh c LEFT JOIN nhan_vien n ON n.id_cd = c.id_cd AND n.trangthai = 1
     GROUP BY c.id_cd HAVING co < c.dinh_bien`);
  const [[t]] = await conn.query('SELECT COUNT(*) n FROM nhan_vien WHERE trangthai = 1');
  const [[db2]] = await conn.query('SELECT SUM(COALESCE(dinh_bien,0)) n FROM chuc_danh');
  const [[u]] = await conn.query('SELECT COUNT(DISTINCT username) n FROM nhan_vien');

  console.log(`  nhan vien dang lam : ${t.n} / dinh bien ${db2.n}`);
  console.log(`  username khong trung: ${u.n === t.n ? 'dat' : 'LOI - co username trung'}`);
  console.log(`  chuc danh con thieu : ${r.length}`);
  r.forEach((x) => console.log(`     ${x.ten_cd}: ${x.co}/${x.dinh_bien}`));
  if (u.n !== t.n) throw new Error('Co username bi trung.');
}

async function main() {
  console.log('=== Migration 026: tuyen du nhan su theo dinh bien ===');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    console.log('\n[1/4] Tuyen nguoi con thieu');
    const them = await tuyenNguoi(conn);
    console.log('\n[2/4] Noi duong bao cao');
    await noiDuongBaoCao(conn);
    console.log('\n[3/4] Chia to lam viec');
    await chiaTo(conn);
    console.log('\n[4/4] Tao ho so shipper');
    await taoShipper(conn);
    await conn.commit();

    console.log('\n--- Kiem tra lai ---');
    await kiemTra(conn);
    console.log(`\n=== Hoan tat: them ${them.length} nhan vien, mat khau ${MAT_KHAU} ===`);
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
