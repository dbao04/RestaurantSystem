/**
 * THANH TOAN SERVICE
 *
 * Mot don an (`hopdong.sesis`) co the duoc tra lam NHIEU LAN - chia bill, dat
 * coc truoc roi tra not, hoac tra hut phai bu them. Vi vay khong co cot
 * "da thanh toan" tren `hopdong`; trang thai tien bac duoc suy ra bang cach
 * cong don cac dong `payments` co status = 'success' cua sesis do.
 *
 * Quy uoc trang thai `hopdong.tinhtrang` trong he thong nay:
 *   0 cho duyet | 1 da xac nhan | 3 DA THANH TOAN | 4 da huy
 *   5 khach da den | 6 dang dung mon
 * `tinhtrang = 3` chi duoc dat khi da thu du tien.
 *
 * LUONG VIETQR
 *   taoPhien()  -> tao dong payments status 'pending', sinh ma doi soat duy
 *                  nhat, dung ma do lam noi dung chuyen khoan trong QR
 *   khach quet  -> ngan hang bao co -> webhook day sang /api/webhook/ngan-hang
 *   ghiNhanGiaoDichNganHang() -> tim phien pending co ma doi soat trung voi
 *                  noi dung CK va so tien khop -> xacNhan()
 *   xacNhan()   -> cong diem tich luy, tra ban, phat su kien socket
 *
 * Neu webhook khong ve (chua dau ngan hang, hoac demo offline), thu ngan bam
 * "Xac nhan thu cong" - cung goi xacNhan() nhung ghi nguon la 'quay' va luu
 * lai ai la nguoi bam, de con truy trach nhiem.
 */

const db = require('../config/db');
const vietQR = require('./vietQR');
const loyaltyService = require('./loyaltyService');
const { discountService } = require('./discountService');

/* ========================================================================== */
/* CAU HINH                                                                    */
/* ========================================================================== */

// Cache cau hinh trong bo nho 30 giay: moi man hinh POS goi layHoaDon() lien
// tuc, doc bang cau hinh moi lan la thua.
let _cacheCauHinh = null;
let _cacheLuc = 0;
const CACHE_MS = 30000;

const MAC_DINH = {
  thue_vat: 0,
  phi_phuc_vu: 0,
  lam_tron: 0,
  ty_le_tich_diem: 10000,
  gia_tri_1_diem: 1000,
  toi_da_diem_moi_don: 50,
  han_qr_giay: 900,
  dat_coc_phan_tram: 20,
  webhook_api_key: '',
  tu_dong_doi_soat: 1,
};

async function layCauHinh(buocLamMoi = false) {
  if (!buocLamMoi && _cacheCauHinh && Date.now() - _cacheLuc < CACHE_MS) return _cacheCauHinh;
  const ch = { ...MAC_DINH };
  try {
    const [rows] = await db.query('SELECT khoa, gia_tri FROM cau_hinh_thanh_toan');
    for (const r of rows) {
      const so = Number(r.gia_tri);
      ch[r.khoa] = (r.gia_tri !== null && r.gia_tri !== '' && !Number.isNaN(so)) ? so : r.gia_tri;
    }
  } catch (e) {
    // Chua chay migration 012 -> dung mac dinh, khong lam sap trang.
    console.warn('[thanhToan] chua co bang cau_hinh_thanh_toan, dung gia tri mac dinh');
  }
  _cacheCauHinh = ch;
  _cacheLuc = Date.now();
  return ch;
}

async function luuCauHinh(capNhat) {
  for (const [khoa, giaTri] of Object.entries(capNhat)) {
    await db.query(
      `INSERT INTO cau_hinh_thanh_toan (khoa, gia_tri, updated_at) VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE gia_tri = VALUES(gia_tri), updated_at = NOW()`,
      [khoa, String(giaTri)]
    );
  }
  _cacheCauHinh = null; // buoc doc lai lan sau
}

/** Cau hinh tai khoan nhan tien, lay tu payment_methods.settings cua 'vietqr'. */
async function layTaiKhoanNhan() {
  const [rows] = await db.query("SELECT settings FROM payment_methods WHERE code = 'vietqr' LIMIT 1");
  if (!rows.length) return null;
  try {
    const s = JSON.parse(rows[0].settings || '{}');
    if (!s.so_tai_khoan) return null;
    return {
      maNganHang: s.ma_ngan_hang || 'VCB',
      soTaiKhoan: s.so_tai_khoan,
      tenTaiKhoan: s.ten_tai_khoan || 'NHA HANG BAO DOAN',
    };
  } catch { return null; }
}

async function luuTaiKhoanNhan({ ma_ngan_hang, so_tai_khoan, ten_tai_khoan }) {
  const [rows] = await db.query("SELECT settings FROM payment_methods WHERE code = 'vietqr' LIMIT 1");
  let s = {};
  try { s = JSON.parse((rows[0] || {}).settings || '{}'); } catch { s = {}; }
  Object.assign(s, {
    ma_ngan_hang,
    so_tai_khoan: String(so_tai_khoan || '').replace(/\s/g, ''),
    ten_tai_khoan: vietQR.boDau(ten_tai_khoan).toUpperCase(),
  });
  await db.query(
    "UPDATE payment_methods SET settings = ?, updated_at = NOW() WHERE code = 'vietqr'",
    [JSON.stringify(s)]
  );
}

/* ========================================================================== */
/* TINH HOA DON                                                                */
/* ========================================================================== */

/**
 * Sinh ma doi soat duy nhat, dung lam noi dung chuyen khoan.
 *
 * Yeu cau: ngan (sao ke ngan hang cat noi dung dai), CHI CHU HOA VA SO (nhieu
 * ngan hang tu viet hoa noi dung, chu thuong se khong khop khi so sanh), va
 * de doc bang mat de thu ngan doi chieu nhanh.
 *
 * Dang: BD + 6 ky tu base36 tu thoi diem + 3 ky tu ngau nhien. Vi du BD2F1A9KX7Q.
 * Khong dung ID tu tang cua bang payments vi ID de doan - khach khac co the
 * chuyen khoan kem ma cua ban ben canh.
 */
function sinhMaDoiSoat() {
  const thoiGian = Date.now().toString(36).toUpperCase().slice(-6);
  const nhieu = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'X');
  return 'BD' + thoiGian + nhieu;
}

/** Lam tron LEN boi so (vd lam tron 1000 -> 284.300 thanh 285.000). */
function lamTronLen(soTien, boiSo) {
  if (!boiSo || boiSo <= 0) return Math.round(soTien);
  return Math.ceil(soTien / boiSo) * boiSo;
}

/**
 * Dung hoa don day du cho mot phien an.
 *
 * @param {string} sesis
 * @param {object} [tuyChon]
 * @param {string} [tuyChon.maGiamGia] ma khach dua, se duoc kiem tra hieu luc
 * @param {number} [tuyChon.diemDung]  so diem tich luy khach muon tru
 * @param {string} [tuyChon.kenh]      'quay' | 'khach_qr' - de loc ma theo kenh
 * @param {boolean} [tuyChon.goiY]     co tim cac ma khac dang dung duoc khong
 * @returns hoa don gom: danh sach mon, cac muc tien, da tra, con lai
 */
async function layHoaDon(sesis, { maGiamGia = null, diemDung = 0, kenh = null, goiY = true } = {}) {
  const ch = await layCauHinh();

  // Chi lay dong la MON THAT (id_mon > 0). Dong id_mon = 0 la dong "khung" cua
  // don dat ban / don QR, khong phai mon an, cong vao la sai tien.
  const [mon] = await db.query(
    `SELECT id, id_mon, name_mon, soluong, gia, thanhtien, images, trangthai_bep
     FROM hopdong WHERE sesis = ? AND id_mon > 0 AND soluong > 0
     ORDER BY id ASC`,
    [sesis]
  );

  const [[thongTin]] = await db.query(
    `SELECT h.sesis, h.id_user, h.dates, h.tg, h.so_user, h.noidung, h.tinhtrang,
            h.id_ban, k.ten AS ten_khach, k.sodienthoai,
            (SELECT table_name FROM qr_tables WHERE active_sesis = h.sesis LIMIT 1) AS ten_ban_qr,
            (SELECT number_ban FROM ban WHERE Id_ban = h.id_ban LIMIT 1) AS so_ban
     FROM hopdong h JOIN khach_hang k ON h.id_user = k.id
     WHERE h.sesis = ? LIMIT 1`,
    [sesis]
  );
  if (!thongTin) throw new Error('Không tìm thấy đơn hàng ' + sesis);

  const tamTinh = mon.reduce((t, m) => t + Number(m.thanhtien || 0), 0);

  // --- Ho so khach: diem tich luy + hang thanh vien ---
  // Khach vang lai tu QR (sodienthoai dang 'QR_xxx') khong co tai khoan that
  // nen khong cho dung diem - neu khong moi ban se chung mot vi diem.
  const laKhachVangLai = String(thongTin.sodienthoai || '').startsWith('QR_');
  let diemDangCo = 0;
  let hangKhach = null;
  if (!laKhachVangLai) {
    const [dr] = await db.query(
      'SELECT points, tier FROM loyalty_points WHERE id_kh = ? LIMIT 1', [thongTin.id_user]
    );
    if (dr.length) {
      diemDangCo = Number(dr[0].points || 0);
      hangKhach = dr[0].tier || 'bronze';
    }
  }

  /*
   * Ngu canh de cham dieu kien cua chuong trinh khuyen mai.
   *
   * Phai co `mon` thi cac ma gioi han theo loai mon / mon cu the moi tinh dung
   * duoc phan tien duoc giam; va phai co `idKhach` thi gioi han "moi khach N
   * luot" moi chan duoc. Khach vang lai khong co tai khoan that nen de null -
   * neu khong ca nghin luot QR se dinh chung mot id.
   */
  const boiCanh = {
    idKhach: laKhachVangLai ? null : thongTin.id_user,
    hangKhach,
    kenh,
    mon,
  };

  // --- Giam gia theo ma ---
  let giamGia = 0;
  let maApDung = null;
  let loiMaGiamGia = null;
  if (maGiamGia) {
    const kq = await discountService.applyCode(maGiamGia, tamTinh, boiCanh);
    if (kq.success) {
      giamGia = Number(kq.discount_amount) || 0;
      maApDung = kq.code;
    } else {
      loiMaGiamGia = kq.message;
    }
  }

  // Cac ma khac dang dung duoc cho chinh don nay - thu ngan khong phai nho ma.
  // Moi ma phai cham qua vai truy van dieu kien nen bo qua o cac luong chi can
  // con so tien (taoPhien, in bien lai).
  const khuyenMaiGoiY = (goiY && tamTinh > 0)
    ? await discountService.goiYApDung(tamTinh, boiCanh)
    : [];

  const sauGiamGia = Math.max(0, tamTinh - giamGia);
  // Tran diem: khong cho tra 100% bang diem (cau hinh toi_da_diem_moi_don).
  const tranTienDiem = Math.floor(sauGiamGia * (Number(ch.toi_da_diem_moi_don) / 100));
  const diemToiDaDung = Math.min(diemDangCo, Math.floor(tranTienDiem / Number(ch.gia_tri_1_diem)));
  const diemThucDung = Math.max(0, Math.min(Number(diemDung) || 0, diemToiDaDung));
  const tienTuDiem = diemThucDung * Number(ch.gia_tri_1_diem);

  // --- Phi va thue tinh tren TAM TINH (khong tru giam gia) ---
  // Phi phuc vu la phi cua nha hang, khong phu thuoc khach co ma giam gia hay
  // khong. Tinh tren phan da tru giam gia se khien tong hoa don thay doi moi
  // khi ap ma, rat kho doi chieu voi bao cao doanh thu.
  const phiPhucVu = Math.round(tamTinh * Number(ch.phi_phuc_vu) / 100);
  const thueVat = Math.round((tamTinh + phiPhucVu) * Number(ch.thue_vat) / 100);

  const tongTruocLamTron = tamTinh + phiPhucVu + thueVat;
  const tongCong = lamTronLen(tongTruocLamTron, Number(ch.lam_tron));
  const tienLamTron = tongCong - tongTruocLamTron;

  // --- Da tra bao nhieu roi (chia bill / dat coc) ---
  //
  // `con_phai_tra` KHONG the tinh don gian la tongCong - SUM(amount).
  // Khi khach da tra mot phan bang ma giam gia hoac bang diem tich luy, phan
  // do khong nam trong `amount` (amount la tien mat/chuyen khoan THAT SU thu
  // duoc) nhung van la phan da duoc thanh toan cua hoa don. Neu bo qua, don
  // co giam gia se khong bao gio du tien va khong bao gio chuyen sang
  // "da thanh toan".
  const [[daTra]] = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS tong_tien,
            COALESCE(SUM(discount_amount), 0) AS tong_giam,
            COALESCE(SUM(loyalty_points_used), 0) AS tong_diem,
            COUNT(*) AS so_lan
     FROM payments WHERE sesis = ? AND status = 'success' AND loai = 'thanh_toan'`,
    [sesis]
  );
  // Dat coc tinh rieng: da thu tien nhung don van con dang phuc vu.
  const [[daCoc]] = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS tong FROM payments
     WHERE sesis = ? AND status = 'success' AND loai = 'dat_coc'`,
    [sesis]
  );

  const daThuTien = Number(daTra.tong_tien || 0) + Number(daCoc.tong || 0);
  const daGiamTruocDo = Number(daTra.tong_giam || 0)
    + Number(daTra.tong_diem || 0) * Number(ch.gia_tri_1_diem);

  // Giam gia / diem cua phien DANG DUNG (chua ghi vao payments) tru them.
  const conPhaiTra = Math.max(0, tongCong - daThuTien - daGiamTruocDo - giamGia - tienTuDiem);
  const daThanhToan = daThuTien;

  // --- Phien dang cho (QR chua quet) ---
  const [dangCho] = await db.query(
    `SELECT p.*, pm.name AS ten_phuong_thuc, pm.code AS ma_phuong_thuc
     FROM payments p LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
     WHERE p.sesis = ? AND p.status = 'pending'
     ORDER BY p.id DESC`,
    [sesis]
  );

  const [lichSu] = await db.query(
    `SELECT p.*, pm.name AS ten_phuong_thuc, pm.code AS ma_phuong_thuc,
            n.ten AS ten_nhan_vien
     FROM payments p
     LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
     LEFT JOIN nhan_vien n ON p.processed_by = n.id_nv
     WHERE p.sesis = ? AND p.status IN ('success','refunded')
     ORDER BY p.id ASC`,
    [sesis]
  );

  return {
    sesis,
    thongTin: {
      ...thongTin,
      ten_ban: thongTin.ten_ban_qr || (thongTin.so_ban ? 'Bàn ' + thongTin.so_ban : null),
      la_khach_vang_lai: laKhachVangLai,
    },
    mon,
    soMon: mon.reduce((t, m) => t + Number(m.soluong || 0), 0),
    tien: {
      tam_tinh: tamTinh,
      giam_gia: giamGia,
      ma_giam_gia: maApDung,
      loi_ma_giam_gia: loiMaGiamGia,
      diem_dang_co: diemDangCo,
      diem_toi_da_dung: diemToiDaDung,
      diem_dung: diemThucDung,
      tien_tu_diem: tienTuDiem,
      phi_phuc_vu: phiPhucVu,
      thue_vat: thueVat,
      tien_lam_tron: tienLamTron,
      tong_cong: tongCong,
      da_thanh_toan: daThanhToan,
      da_dat_coc: Number(daCoc.tong || 0),
      da_giam_truoc_do: daGiamTruocDo,
      so_lan_da_tra: Number(daTra.so_lan || 0),
      con_phai_tra: conPhaiTra,
      da_tra_du: conPhaiTra <= 0 && tongCong > 0,
    },
    khuyenMai: khuyenMaiGoiY,
    tyLe: {
      phi_phuc_vu: Number(ch.phi_phuc_vu),
      thue_vat: Number(ch.thue_vat),
      gia_tri_1_diem: Number(ch.gia_tri_1_diem),
      ty_le_tich_diem: Number(ch.ty_le_tich_diem),
    },
    phienDangCho: dangCho,
    lichSuThanhToan: lichSu,
  };
}

/* ========================================================================== */
/* TAO / XAC NHAN PHIEN THANH TOAN                                            */
/* ========================================================================== */

async function layPhuongThuc(ma) {
  const [rows] = await db.query('SELECT * FROM payment_methods WHERE code = ? AND is_active = 1 LIMIT 1', [ma]);
  if (!rows.length) throw new Error('Phương thức thanh toán "' + ma + '" không tồn tại hoặc đã tắt');
  return rows[0];
}

async function danhSachPhuongThuc() {
  const [rows] = await db.query('SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY id');
  return rows.map((r) => {
    let s = {};
    try { s = JSON.parse(r.settings || '{}'); } catch { s = {}; }
    return { ...r, cauHinh: s };
  });
}

/**
 * Tao mot phien thanh toan.
 *
 * Voi tien mat: tao xong la 'success' luon (tien da nam trong ket).
 * Voi VietQR:   tao o trang thai 'pending' kem ma doi soat + han hieu luc,
 *               cho webhook hoac thu ngan xac nhan.
 * Voi the POS:  'pending', cho thu ngan nhap ma chuan chi tu may POS.
 *
 * @returns {{payment: object, qr?: object}}
 */
async function taoPhien({
  sesis,
  soTien,
  maPhuongThuc,
  loai = 'thanh_toan',
  nguon = 'quay',
  maGiamGia = null,
  diemDung = 0,
  tienKhachDua = null,
  tienTip = 0,
  ghiChuPhanChia = null,
  ghiChu = null,
  nhanVienId = null,
}) {
  const ch = await layCauHinh();
  const pt = await layPhuongThuc(maPhuongThuc);

  const tien = Math.round(Number(soTien) || 0);
  if (tien <= 0) throw new Error('Số tiền thanh toán phải lớn hơn 0');

  // Chan tra vuot: cho phep sai lech nho do lam tron nhung khong cho tra gap doi.
  // Phai truyen ma giam gia / diem vao day, neu khong `con_phai_tra` se la so
  // CHUA giam va phien tra dung so tien da giam se bi coi la "tra thieu" ...
  // rieng dat coc thi khong chan vi ban chat la tra truoc mot phan.
  // `kenh` cho lop khuyen mai biet ma nay co duoc phep dung o day khong. Lay
  // tu `nguon` chu khong tu client: `nguon` do server dat cung trong tung route.
  const hoaDon = await layHoaDon(sesis, {
    maGiamGia, diemDung,
    kenh: nguon === 'khach_qr' ? 'khach_qr' : 'quay',
    goiY: false,
  });
  if (loai === 'thanh_toan' && tien > hoaDon.tien.con_phai_tra + Number(ch.lam_tron || 0) + 1) {
    throw new Error(
      `Số tiền ${tien.toLocaleString('vi-VN')}đ vượt quá phần còn phải trả ` +
      `${hoaDon.tien.con_phai_tra.toLocaleString('vi-VN')}đ`
    );
  }

  // Huy cac phien pending cu cua CUNG sesis va CUNG phuong thuc truoc khi tao
  // moi. Neu khong, ban se co hai ma QR con hieu luc cho cung mot don, khach
  // quet nham ma cu thi so tien lai khong khop.
  await db.query(
    `UPDATE payments SET status = 'failed', notes = CONCAT(COALESCE(notes,''), ' | thay bằng phiên mới')
     WHERE sesis = ? AND status = 'pending' AND payment_method_id = ?`,
    [sesis, pt.id]
  );

  const laTienMat = pt.type === 'cash';
  const maDoiSoat = laTienMat ? null : sinhMaDoiSoat();
  const hanGiay = Number(ch.han_qr_giay) || 900;

  const thoiLai = (laTienMat && tienKhachDua != null)
    ? Math.max(0, Math.round(Number(tienKhachDua) - tien))
    : null;

  const [kq] = await db.query(
    `INSERT INTO payments
       (sesis, amount, payment_method_id, status, ma_doi_soat, loai, nguon,
        discount_code_used, discount_amount, loyalty_points_used,
        tien_khach_dua, tien_thoi_lai, tien_tip,
        het_han_luc, thanh_cong_luc, ghi_chu_phan_chia, notes, processed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
             ${laTienMat ? 'NULL' : `DATE_ADD(NOW(), INTERVAL ${hanGiay} SECOND)`},
             ${laTienMat ? 'NOW()' : 'NULL'}, ?, ?, ?)`,
    [
      sesis, tien, pt.id, laTienMat ? 'success' : 'pending', maDoiSoat, loai, nguon,
      // Ghi lai gia tri DA KIEM TRA cua hoa don chu khong phai so client gui
      // len: khach co the sua diemDung trong DevTools de tru nhieu hon so diem
      // dang co, hoac gui ma giam gia da het han.
      hoaDon.tien.ma_giam_gia, hoaDon.tien.giam_gia || 0, hoaDon.tien.diem_dung || 0,
      tienKhachDua != null ? Math.round(Number(tienKhachDua)) : null, thoiLai,
      Math.round(Number(tienTip) || 0),
      ghiChuPhanChia, ghiChu, nhanVienId,
    ]
  );

  const paymentId = kq.insertId;

  // Tien mat: coi nhu xong ngay, chay luon phan hau ky (diem, tra ban...).
  if (laTienMat) {
    await hauKyThanhToan(paymentId, {
      maGiamGia: hoaDon.tien.ma_giam_gia,
      diemDung: hoaDon.tien.diem_dung || 0,
    });
  }

  let qr = null;
  if (pt.code === 'vietqr') {
    const tk = await layTaiKhoanNhan();
    if (!tk) {
      // Xoa phien vua tao de khong de lai rac 'pending' khong bao gio tra duoc.
      await db.query("UPDATE payments SET status = 'failed', notes = 'Chưa cấu hình tài khoản nhận' WHERE id = ?", [paymentId]);
      throw new Error('Chưa cấu hình tài khoản ngân hàng nhận tiền. Vào /admin/thanh-toan để thiết lập.');
    }
    qr = await vietQR.taoQRChuyenKhoan({
      maNganHang: tk.maNganHang,
      soTaiKhoan: tk.soTaiKhoan,
      soTien: tien,
      noiDung: maDoiSoat,
    });
    qr.tenTaiKhoan = tk.tenTaiKhoan;
    await db.query('UPDATE payments SET payload_qr = ? WHERE id = ?', [qr.payload, paymentId]);
  }

  const [[payment]] = await db.query(
    `SELECT p.*, pm.name AS ten_phuong_thuc, pm.code AS ma_phuong_thuc, pm.type AS loai_phuong_thuc
     FROM payments p JOIN payment_methods pm ON p.payment_method_id = pm.id WHERE p.id = ?`,
    [paymentId]
  );

  return { payment, qr, hanGiay };
}

/**
 * Danh dau mot phien la da thu duoc tien.
 *
 * Ham nay la diem hop luu cua CA BA duong: webhook ngan hang, thu ngan bam
 * xac nhan thu cong, va thanh toan tien mat. Moi hieu ung phu (cong diem, doi
 * trang thai don, tra ban) deu nam trong hauKyThanhToan() de ba duong cho ra
 * cung mot ket qua.
 */
async function xacNhan(paymentId, { maGiaoDich = null, nhanVienId = null, ghiChu = null } = {}) {
  const [[p]] = await db.query('SELECT * FROM payments WHERE id = ? LIMIT 1', [paymentId]);
  if (!p) throw new Error('Không tìm thấy phiên thanh toán #' + paymentId);
  if (p.status === 'success') return { daXacNhanTruocDo: true, payment: p };
  if (p.status === 'refunded') throw new Error('Phiên này đã hoàn tiền, không thể xác nhận lại');

  /*
   * `WHERE ... AND status = 'pending'` la CHOT CHONG CONG DIEM HAI LAN.
   *
   * Ba duong deu goi vao day va hai trong so do co the den gan nhu cung luc:
   * webhook ngan hang bao co dung khoanh khac thu ngan sot ruot bam "Xac nhan
   * thu cong". Doc-roi-ghi khong khoa thi ca hai deu thay 'pending' o cau
   * SELECT tren, ca hai deu UPDATE, va hauKyThanhToan() chay hai lan: khach
   * duoc cong diem gap doi, ma giam gia bi tru hai luot.
   *
   * Dat dieu kien ngay trong cau UPDATE thi MySQL tu khoa dong do; chi mot
   * trong hai cau doi duoc trang thai, cau con lai nhan affectedRows = 0 va
   * thoat ra o duoi. Khong can transaction, khong can bang khoa rieng.
   */
  const [kqCapNhat] = await db.query(
    `UPDATE payments
     SET status = 'success', thanh_cong_luc = NOW(), updated_at = NOW(),
         transaction_id = COALESCE(?, transaction_id),
         processed_by = COALESCE(?, processed_by),
         notes = TRIM(CONCAT(COALESCE(notes, ''), ?))
     WHERE id = ? AND status = 'pending'`,
    [maGiaoDich, nhanVienId, ghiChu ? ' | ' + ghiChu : '', paymentId]
  );

  if (kqCapNhat.affectedRows === 0) {
    // Mot luong khac vua xac nhan xong ngay truoc mui. Khong chay hau ky nua.
    const [[daXong]] = await db.query('SELECT * FROM payments WHERE id = ?', [paymentId]);
    if (daXong && daXong.status === 'success') return { daXacNhanTruocDo: true, payment: daXong };
    throw new Error('Phiên thanh toán #' + paymentId + ' không còn ở trạng thái chờ');
  }

  const ketQua = await hauKyThanhToan(paymentId, {
    maGiamGia: p.discount_code_used,
    diemDung: p.loyalty_points_used,
  });

  const [[moi]] = await db.query('SELECT * FROM payments WHERE id = ?', [paymentId]);
  return { daXacNhanTruocDo: false, payment: moi, ...ketQua };
}

/**
 * Cac viec phai lam SAU khi tien da vao.
 *
 * Tach rieng vi ca ba duong xac nhan deu phai chay - va vi thu tu quan trong:
 * phai tru diem TRUOC khi cong diem moi, neu khong khach dung diem xong lai
 * duoc cong diem tren so tien da tru bang diem.
 */
async function hauKyThanhToan(paymentId, { maGiamGia = null, diemDung = 0 } = {}) {
  const [[p]] = await db.query('SELECT * FROM payments WHERE id = ? LIMIT 1', [paymentId]);
  if (!p || p.status !== 'success') return {};

  const ch = await layCauHinh();
  const [[don]] = await db.query(
    `SELECT h.id_user, h.tinhtrang, h.id_ban, k.sodienthoai
     FROM hopdong h JOIN khach_hang k ON h.id_user = k.id
     WHERE h.sesis = ? LIMIT 1`,
    [p.sesis]
  );
  if (!don) return {};

  const laKhachVangLai = String(don.sodienthoai || '').startsWith('QR_');
  const ketQua = { diemCong: 0, diemTru: 0, donDaTraDu: false };

  // --- 1. Ma giam gia: ghi nhat ky mot luot dung ---
  // Ghi ca id khach + id phien de bang `discount_usages` vua chan duoc gioi
  // han "moi khach N luot", vua bao cao duoc chuong trinh nao thuc su chay.
  // Khoa duy nhat tren payment_id lo phan chong dem trung khi webhook ngan
  // hang va thu ngan cung xac nhan mot phien.
  if (maGiamGia) {
    await discountService.ghiNhanSuDung({
      code: maGiamGia,
      idKhach: laKhachVangLai ? null : don.id_user,
      sesis: p.sesis,
      paymentId: p.id,
      soTienGiam: Number(p.discount_amount) || 0,
      // Phan hoa don ma phien nay chi tra: tien thuc thu cong phan da giam.
      // Chia bill thi moi phien ghi phan cua no, cong lai van ra ca don.
      giaTriDon: (Number(p.amount) || 0) + (Number(p.discount_amount) || 0),
    }).catch(() => {});
  }

  // --- 2. Tru diem khach dung ---
  const diem = Number(diemDung) || 0;
  if (diem > 0 && !laKhachVangLai) {
    try {
      await loyaltyService.redeemPoints(don.id_user, diem, `Trừ điểm cho hóa đơn ${p.sesis}`, p.sesis);
      ketQua.diemTru = diem;
    } catch (e) {
      console.error('[thanhToan] tru diem that bai:', e.message);
    }
  }

  // --- 3. Cong diem tren so tien THUC TRA ---
  // Chi tinh tren `amount` cua phien nay, khong tinh phan da tru bang diem -
  // amount da la so tien mat/chuyen khoan that su thu duoc.
  if (!laKhachVangLai && p.loai === 'thanh_toan') {
    const diemCong = Math.floor(Number(p.amount) / Number(ch.ty_le_tich_diem || 10000));
    if (diemCong > 0) {
      try {
        await loyaltyService.addPoints(don.id_user, diemCong, `Tích điểm hóa đơn ${p.sesis}`, p.sesis);
        ketQua.diemCong = diemCong;
      } catch (e) {
        console.error('[thanhToan] cong diem that bai:', e.message);
      }
    }
    // Cong doanh so tich luy de len hang the.
    await db.query(
      'UPDATE loyalty_points SET total_spent = total_spent + ?, updated_at = NOW() WHERE id_kh = ?',
      [p.amount, don.id_user]
    ).catch(() => {});
  }

  // --- 4. Da thu du tien chua ---
  // Dat coc KHONG dong don: khach moi tra truoc mot phan, van con phai den an.
  if (p.loai === 'thanh_toan') {
    const hoaDon = await layHoaDon(p.sesis);
    if (hoaDon.tien.con_phai_tra <= 0) {
      await db.query("UPDATE hopdong SET tinhtrang = 3 WHERE sesis = ?", [p.sesis]);
      await db.query('UPDATE qr_tables SET active_sesis = NULL WHERE active_sesis = ?', [p.sesis]);
      // Tra ban ve trang thai "can don" de tap vu biet ban vua trong.
      if (don.id_ban) {
        await db.query('UPDATE ban SET trangthai = 3, sesis_hien_tai = NULL WHERE Id_ban = ?', [don.id_ban]);
      }
      ketQua.donDaTraDu = true;
    }
  }

  return ketQua;
}

/** Huy mot phien dang cho (khach doi y, hoac thu ngan bam nham). */
async function huyPhien(paymentId, lyDo = 'Hủy bởi nhân viên') {
  const [[p]] = await db.query('SELECT * FROM payments WHERE id = ? LIMIT 1', [paymentId]);
  if (!p) throw new Error('Không tìm thấy phiên thanh toán');
  if (p.status === 'success') throw new Error('Phiên đã thanh toán thành công, dùng chức năng hoàn tiền');
  await db.query(
    "UPDATE payments SET status = 'failed', updated_at = NOW(), notes = TRIM(CONCAT(COALESCE(notes,''), ' | ', ?)) WHERE id = ?",
    [lyDo, paymentId]
  );
  return true;
}

/**
 * Don cac phien QR da qua han.
 *
 * Goi truoc moi lan doc trang thai thay vi chay cron: he thong nay khong co
 * scheduler, ma so phien pending luon rat it nen chi phi khong dang ke.
 */
async function donPhienHetHan() {
  const [kq] = await db.query(
    `UPDATE payments SET status = 'failed', updated_at = NOW(),
            notes = TRIM(CONCAT(COALESCE(notes,''), ' | hết hạn'))
     WHERE status = 'pending' AND het_han_luc IS NOT NULL AND het_han_luc < NOW()`
  );
  return kq.affectedRows;
}

/** Trang thai mot phien - dung cho polling tu trinh duyet. */
async function trangThaiPhien(paymentId) {
  await donPhienHetHan();
  const [[p]] = await db.query(
    `SELECT p.id, p.sesis, p.amount, p.status, p.ma_doi_soat, p.transaction_id,
            p.het_han_luc, p.thanh_cong_luc, pm.code AS ma_phuong_thuc, pm.name AS ten_phuong_thuc,
            TIMESTAMPDIFF(SECOND, NOW(), p.het_han_luc) AS con_lai_giay
     FROM payments p LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
     WHERE p.id = ? LIMIT 1`,
    [paymentId]
  );
  if (!p) return null;
  const hoaDon = await layHoaDon(p.sesis);
  return { ...p, con_phai_tra: hoaDon.tien.con_phai_tra, da_tra_du: hoaDon.tien.da_tra_du };
}

/* ========================================================================== */
/* HOAN TIEN                                                                   */
/* ========================================================================== */

async function hoanTien(paymentId, { lyDo = '', nhanVienId = null } = {}) {
  const [[p]] = await db.query('SELECT * FROM payments WHERE id = ? LIMIT 1', [paymentId]);
  if (!p) throw new Error('Không tìm thấy phiên thanh toán');
  if (p.status !== 'success') throw new Error('Chỉ hoàn tiền được phiên đã thanh toán thành công');

  await db.query(
    `UPDATE payments SET status = 'refunded', updated_at = NOW(),
            notes = TRIM(CONCAT(COALESCE(notes,''), ' | HOÀN TIỀN: ', ?))
     WHERE id = ?`,
    [lyDo || 'không ghi lý do', paymentId]
  );

  /*
   * Tra vi diem cua khach ve dung nhu truoc khi co phien nay.
   *
   * Phai LAY LAI DUNG NHUNG GI hauKyThanhToan() da lam, khong nhieu khong it:
   *
   *  - Diem DA CONG chi phat sinh khi `loai = 'thanh_toan'`. Truoc day doan
   *    nay tru diem cho MOI phien, ke ca dat coc - ma dat coc thi chua bao gio
   *    duoc cong diem. Hoan mot khoan coc 500.000d se cuop khong cua khach 50
   *    diem ho kiem duoc tu nhung don khac.
   *  - Diem KHACH DA DUNG de tru vao hoa don thi phai TRA LAI: tien da hoan ve
   *    tai khoan khach roi, giu luon diem cua ho nua la thu hai lan.
   *  - `total_spent` quyet dinh hang the, cung phai lui lai theo.
   */
  const ch = await layCauHinh();
  const [[don]] = await db.query(
    `SELECT h.id_user, k.sodienthoai FROM hopdong h JOIN khach_hang k ON h.id_user = k.id
     WHERE h.sesis = ? LIMIT 1`, [p.sesis]
  );
  if (don && !String(don.sodienthoai || '').startsWith('QR_')) {
    if (p.loai === 'thanh_toan') {
      const diemDaCong = Math.floor(Number(p.amount) / Number(ch.ty_le_tich_diem || 10000));
      if (diemDaCong > 0) {
        await loyaltyService.redeemPoints(don.id_user, diemDaCong, `Thu hồi điểm do hoàn tiền ${p.sesis}`, p.sesis)
          .catch((e) => console.error('[thanhToan] thu hoi diem that bai:', e.message));
      }
      await db.query(
        'UPDATE loyalty_points SET total_spent = GREATEST(0, total_spent - ?), updated_at = NOW() WHERE id_kh = ?',
        [p.amount, don.id_user]
      ).catch(() => {});
    }

    const diemDaDung = Number(p.loyalty_points_used) || 0;
    if (diemDaDung > 0) {
      await loyaltyService.addPoints(don.id_user, diemDaDung, `Hoàn lại điểm đã dùng cho ${p.sesis}`, p.sesis)
        .catch((e) => console.error('[thanhToan] hoan diem da dung that bai:', e.message));
    }
  }

  // Don chua chac con "da thanh toan" nua -> tinh lai.
  const hoaDon = await layHoaDon(p.sesis);
  if (hoaDon.tien.con_phai_tra > 0) {
    await db.query("UPDATE hopdong SET tinhtrang = 6 WHERE sesis = ? AND tinhtrang = 3", [p.sesis]);
  }

  await db.query(
    `INSERT INTO audit_logs (action, actor_type, actor_id, resource_type, resource_id, status, details)
     VALUES ('hoan_tien', 'staff', ?, 'payment', ?, 'success', ?)`,
    [nhanVienId, paymentId, JSON.stringify({ sesis: p.sesis, so_tien: p.amount, ly_do: lyDo })]
  ).catch(() => {});

  return true;
}

/* ========================================================================== */
/* DOI SOAT VOI SAO KE NGAN HANG                                              */
/* ========================================================================== */

/**
 * Rut ma doi soat ra khoi noi dung chuyen khoan tho.
 *
 * Sao ke ngan hang khong tra ve dung chuoi ta dat vao. Vi du thuc te:
 *   "NGUYEN VAN A chuyen tien BD2F1A9KX7Q GD 123456-052026"
 *   "MBVCB.123456.BD2F1A9KX7Q.CT tu 0011... toi 0011..."
 * Nen phai do bang bieu thuc chinh quy chu khong so sanh bang.
 */
function rutMaDoiSoat(noiDung) {
  const s = vietQR.boDau(noiDung).toUpperCase();
  const khop = s.match(/BD[A-Z0-9]{9}/);
  return khop ? khop[0] : null;
}

/**
 * Ghi nhan mot bien dong so du do ngan hang bao ve, roi tu doi soat.
 *
 * Chong ghi trung bang UNIQUE(ma_tham_chieu): webhook cua ngan hang co the
 * ban lai nhieu lan cho cung mot giao dich khi khong nhan duoc HTTP 200.
 *
 * @returns {{trungLap:boolean, khop:boolean, payment?:object}}
 */
async function ghiNhanGiaoDichNganHang(gd) {
  const {
    ma_tham_chieu, cong_thanh_toan, so_tai_khoan, so_tien,
    loai = 'in', noi_dung, thoi_diem, du_lieu_tho,
  } = gd;

  if (!ma_tham_chieu) throw new Error('Thiếu mã tham chiếu giao dịch');
  const tien = Math.round(Number(so_tien) || 0);

  const [daCo] = await db.query('SELECT id, payment_id, trang_thai FROM giao_dich_ngan_hang WHERE ma_tham_chieu = ? LIMIT 1', [ma_tham_chieu]);
  if (daCo.length) return { trungLap: true, khop: daCo[0].trang_thai === 'da_khop', giaoDichId: daCo[0].id };

  const [ins] = await db.query(
    `INSERT INTO giao_dich_ngan_hang
       (ma_tham_chieu, cong_thanh_toan, so_tai_khoan, so_tien, loai, noi_dung, thoi_diem, du_lieu_tho)
     VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, NOW()), ?)`,
    [ma_tham_chieu, cong_thanh_toan || null, so_tai_khoan || null, tien, loai,
     noi_dung || null, thoi_diem || null, du_lieu_tho ? JSON.stringify(du_lieu_tho) : null]
  );
  const giaoDichId = ins.insertId;

  // Tien ra khoi tai khoan thi khong lien quan den thu tien khach.
  if (loai !== 'in') {
    await db.query("UPDATE giao_dich_ngan_hang SET trang_thai = 'bo_qua', ghi_chu = 'Giao dịch chuyển ra' WHERE id = ?", [giaoDichId]);
    return { trungLap: false, khop: false, giaoDichId };
  }

  const ch = await layCauHinh();
  const ma = rutMaDoiSoat(noi_dung);
  if (!ma) {
    await db.query("UPDATE giao_dich_ngan_hang SET trang_thai = 'khong_khop', ghi_chu = 'Nội dung CK không chứa mã đối soát' WHERE id = ?", [giaoDichId]);
    return { trungLap: false, khop: false, giaoDichId, lyDo: 'khong_co_ma' };
  }

  const [phien] = await db.query(
    "SELECT * FROM payments WHERE ma_doi_soat = ? AND status = 'pending' ORDER BY id DESC LIMIT 1",
    [ma]
  );
  if (!phien.length) {
    await db.query(
      "UPDATE giao_dich_ngan_hang SET trang_thai = 'khong_khop', ghi_chu = ? WHERE id = ?",
      [`Không có phiên chờ nào mang mã ${ma}`, giaoDichId]
    );
    return { trungLap: false, khop: false, giaoDichId, ma, lyDo: 'khong_co_phien' };
  }

  const p = phien[0];

  // Tien chuyen thieu -> khong tu dong xac nhan, de thu ngan xu ly tay.
  if (tien < Number(p.amount)) {
    await db.query(
      "UPDATE giao_dich_ngan_hang SET payment_id = ?, trang_thai = 'khong_khop', ghi_chu = ? WHERE id = ?",
      [p.id, `Chuyển thiếu: nhận ${tien}đ / cần ${Number(p.amount)}đ`, giaoDichId]
    );
    return { trungLap: false, khop: false, giaoDichId, payment: p, lyDo: 'thieu_tien' };
  }

  if (!Number(ch.tu_dong_doi_soat)) {
    await db.query(
      "UPDATE giao_dich_ngan_hang SET payment_id = ?, trang_thai = 'cho_doi_soat', ghi_chu = 'Đã tắt tự động đối soát' WHERE id = ?",
      [p.id, giaoDichId]
    );
    return { trungLap: false, khop: false, giaoDichId, payment: p, lyDo: 'tat_tu_dong' };
  }

  const kq = await xacNhan(p.id, {
    maGiaoDich: ma_tham_chieu,
    ghiChu: `Đối soát tự động từ ${cong_thanh_toan || 'ngân hàng'}` +
            (tien > Number(p.amount) ? ` (khách chuyển dư ${tien - Number(p.amount)}đ)` : ''),
  });

  await db.query(
    "UPDATE giao_dich_ngan_hang SET payment_id = ?, trang_thai = 'da_khop' WHERE id = ?",
    [p.id, giaoDichId]
  );

  return { trungLap: false, khop: true, giaoDichId, payment: kq.payment, ma, ketQua: kq };
}

/** Danh sach bien dong so du de xem trong trang doi soat. */
async function danhSachGiaoDichNganHang({ trangThai = null, gioiHan = 50 } = {}) {
  const dieuKien = trangThai ? 'WHERE g.trang_thai = ?' : '';
  const thamSo = trangThai ? [trangThai, Number(gioiHan)] : [Number(gioiHan)];
  const [rows] = await db.query(
    `SELECT g.*, p.sesis, p.amount AS so_tien_phien
     FROM giao_dich_ngan_hang g LEFT JOIN payments p ON g.payment_id = p.id
     ${dieuKien} ORDER BY g.id DESC LIMIT ?`,
    thamSo
  );
  return rows;
}

/** Ghep tay mot bien dong so du vao mot phien - dung khi noi dung CK bi sai. */
async function doiSoatThuCong(giaoDichId, paymentId, nhanVienId = null) {
  const [[gd]] = await db.query('SELECT * FROM giao_dich_ngan_hang WHERE id = ? LIMIT 1', [giaoDichId]);
  if (!gd) throw new Error('Không tìm thấy giao dịch ngân hàng');
  if (gd.trang_thai === 'da_khop') throw new Error('Giao dịch này đã được đối soát');

  const kq = await xacNhan(paymentId, {
    maGiaoDich: gd.ma_tham_chieu,
    nhanVienId,
    ghiChu: 'Đối soát thủ công',
  });
  await db.query("UPDATE giao_dich_ngan_hang SET payment_id = ?, trang_thai = 'da_khop' WHERE id = ?", [paymentId, giaoDichId]);
  return kq;
}

/* ========================================================================== */
/* DANH SACH / BAO CAO                                                        */
/* ========================================================================== */

/**
 * Cac don dang mo, sap xep don CAN THU TIEN len truoc.
 *
 * Man hinh POS mo ra la thu ngan phai thay ngay ban nao doi tinh tien, chu
 * khong phai danh sach dat ban theo ngay.
 */
async function danhSachCanThanhToan() {
  await donPhienHetHan();
  const [rows] = await db.query(`
    SELECT h.sesis,
           MAX(k.ten) AS ten_khach, MAX(k.sodienthoai) AS sodienthoai,
           MAX(h.dates) AS dates, MAX(h.tg) AS tg, MAX(h.tinhtrang) AS tinhtrang,
           MAX(h.ngay_dat) AS ngay_dat, MAX(h.gio_dat) AS gio_dat,
           COALESCE(SUM(CASE WHEN h.id_mon > 0 THEN h.thanhtien ELSE 0 END), 0) AS tam_tinh,
           COALESCE(SUM(CASE WHEN h.id_mon > 0 THEN h.soluong ELSE 0 END), 0) AS so_mon,
           MAX(q.table_name) AS ten_ban_qr,
           MAX(b.number_ban) AS so_ban,
           (SELECT COALESCE(SUM(p.amount), 0) FROM payments p
             WHERE p.sesis = h.sesis AND p.status = 'success') AS da_thanh_toan,
           (SELECT COALESCE(SUM(p.discount_amount), 0) FROM payments p
             WHERE p.sesis = h.sesis AND p.status = 'success' AND p.loai = 'thanh_toan') AS da_giam,
           (SELECT COALESCE(SUM(p.loyalty_points_used), 0) FROM payments p
             WHERE p.sesis = h.sesis AND p.status = 'success' AND p.loai = 'thanh_toan') AS diem_da_dung,
           (SELECT COUNT(*) FROM payments p
             WHERE p.sesis = h.sesis AND p.status = 'pending') AS phien_dang_cho
    FROM hopdong h
    LEFT JOIN khach_hang k ON h.id_user = k.id
    LEFT JOIN qr_tables q ON q.active_sesis = h.sesis
    LEFT JOIN ban b ON b.Id_ban = h.id_ban
    WHERE h.tinhtrang IN (1, 5, 6)
    GROUP BY h.sesis
    HAVING tam_tinh > 0
    ORDER BY phien_dang_cho DESC, MAX(h.ngay_dat) DESC, MAX(h.gio_dat) DESC
    LIMIT 200
  `);
  /*
   * Phai ap DUNG cong thuc cua layHoaDon() o day, khong duoc rut gon thanh
   * `tam_tinh - da_thanh_toan`.
   *
   * Ngay khi quan ly dat VAT hay phi phuc vu khac 0 trong /admin/thanh-toan,
   * hai cho se lech nhau: the ban ngoai danh sach bao "con 425.000d" con man
   * hinh tinh tien bao "con 467.500d". Thu ngan doc con so ngoai danh sach roi
   * go dung so do vao o thu tien, he thong bao tra thieu - loi hien ra dung
   * luc khach dang dung cho.
   *
   * Cong doan chi la so hoc tren cac tong da lay san, khong them truy van nao.
   */
  const ch = await layCauHinh();
  return rows.map((r) => {
    const tamTinh = Number(r.tam_tinh) || 0;
    const phiPhucVu = Math.round(tamTinh * Number(ch.phi_phuc_vu) / 100);
    const thueVat = Math.round((tamTinh + phiPhucVu) * Number(ch.thue_vat) / 100);
    const tongCong = lamTronLen(tamTinh + phiPhucVu + thueVat, Number(ch.lam_tron));
    const daGiam = Number(r.da_giam || 0) + Number(r.diem_da_dung || 0) * Number(ch.gia_tri_1_diem);
    return {
      ...r,
      ten_ban: r.ten_ban_qr || (r.so_ban ? 'Bàn ' + r.so_ban : null),
      tong_cong: tongCong,
      con_phai_tra: Math.max(0, tongCong - Number(r.da_thanh_toan) - daGiam),
    };
  });
}

/** Lich su thanh toan co loc - dung cho trang doi soat va bao cao ke toan. */
async function lichSuThanhToan({ tuNgay = null, denNgay = null, maPhuongThuc = null, trangThai = 'success', gioiHan = 200 } = {}) {
  const dk = [];
  const ts = [];
  if (trangThai) { dk.push('p.status = ?'); ts.push(trangThai); }
  if (tuNgay) { dk.push('DATE(p.created_at) >= ?'); ts.push(tuNgay); }
  if (denNgay) { dk.push('DATE(p.created_at) <= ?'); ts.push(denNgay); }
  if (maPhuongThuc) { dk.push('pm.code = ?'); ts.push(maPhuongThuc); }
  ts.push(Number(gioiHan));

  const [rows] = await db.query(
    `SELECT p.*, pm.name AS ten_phuong_thuc, pm.code AS ma_phuong_thuc, pm.type AS loai_phuong_thuc,
            n.ten AS ten_nhan_vien,
            (SELECT k.ten FROM hopdong h JOIN khach_hang k ON h.id_user = k.id
              WHERE h.sesis = p.sesis LIMIT 1) AS ten_khach
     FROM payments p
     LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
     LEFT JOIN nhan_vien n ON p.processed_by = n.id_nv
     ${dk.length ? 'WHERE ' + dk.join(' AND ') : ''}
     ORDER BY p.id DESC LIMIT ?`,
    ts
  );
  return rows;
}

/** Tong hop doanh thu theo phuong thuc - dung cho chot ca va bao cao. */
async function tongHopTheoPhuongThuc({ tuNgay = null, denNgay = null } = {}) {
  const dk = ["p.status = 'success'"];
  const ts = [];
  if (tuNgay) { dk.push('DATE(p.created_at) >= ?'); ts.push(tuNgay); }
  if (denNgay) { dk.push('DATE(p.created_at) <= ?'); ts.push(denNgay); }
  const [rows] = await db.query(
    `SELECT pm.code, pm.name, pm.type,
            COUNT(*) AS so_giao_dich,
            COALESCE(SUM(p.amount), 0) AS tong_tien,
            COALESCE(SUM(p.tien_tip), 0) AS tong_tip
     FROM payments p JOIN payment_methods pm ON p.payment_method_id = pm.id
     WHERE ${dk.join(' AND ')}
     GROUP BY pm.id, pm.code, pm.name, pm.type
     ORDER BY tong_tien DESC`,
    ts
  );
  return rows;
}

module.exports = {
  // cau hinh
  layCauHinh, luuCauHinh, layTaiKhoanNhan, luuTaiKhoanNhan,
  // hoa don
  layHoaDon, danhSachPhuongThuc, danhSachCanThanhToan,
  // phien
  taoPhien, xacNhan, huyPhien, trangThaiPhien, donPhienHetHan, hoanTien,
  // doi soat
  ghiNhanGiaoDichNganHang, danhSachGiaoDichNganHang, doiSoatThuCong, rutMaDoiSoat,
  // bao cao
  lichSuThanhToan, tongHopTheoPhuongThuc,
  // tien ich
  sinhMaDoiSoat, lamTronLen,
};
