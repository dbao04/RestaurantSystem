/**
 * CHOT CA THU NGAN
 *
 * Tra loi dung mot cau hoi: KET TIEN MAT CO KHOP KHONG?
 *
 *   tien mat he thong = quy dau ca
 *                     + cac phien tien mat thanh cong cua thu ngan nay trong ca
 *                     - cac phien tien mat da hoan tra khach trong ca
 *
 * Thu ngan dem ket that roi nhap so vao. Chenh lech AM la thieu tien, phai ghi
 * ly do; DUONG thuong la quen tra lai tien thua cho khach.
 *
 *
 * KHOANG THOI GIAN CUA CA - cho nay quyet dinh tinh dung hay sai
 *
 * Khong the lay "hom nay tu 00:00" lam moc: thu ngan ca chieu se nhan ca doanh
 * thu cua ca sang. Cung khong the lay theo bang lich lam viec: thuc te nguoi ta
 * vao ca tre, doi ca cho nhau, lam bu.
 *
 * Moc dung la: TU LAN CHOT CA GAN NHAT CUA CHINH NGUOI DO den bay gio. Nho vay
 * moi dong tien nam trong dung mot bien ban - khong dong nao bi dem hai lan,
 * khong dong nao lot ra ngoai. Neu chua tung chot lan nao thi lay tu dau ngay.
 *
 *
 * AI CHIU TRACH NHIEM KHOAN NAO
 *
 * Chi doi soat nhung gi DI QUA TAY nguoi do: `payments.processed_by = id_nv`.
 * Tien khach tu quet QR chuyen thang vao tai khoan ngan hang (`nguon` =
 * 'khach_qr', khong co nguoi xu ly) van duoc hien trong bien ban de thay tong
 * doanh thu ca, nhung KHONG tinh vao trach nhiem cua ai - no khong nam trong
 * ket cua ai ca. Doi soat khoan do la viec cua trang /staff/thanh-toan/doi-soat.
 */

const db = require('../config/db');

/** Menh gia tien Viet Nam dang luu hanh, tu lon toi nho - dung cho bang dem ket. */
const MENH_GIA = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];

/**
 * Moc bat dau ca hien tai cua mot thu ngan.
 *
 * @returns {Promise<{tu: Date, tiepNoiCaTruoc: boolean}>}
 *   `tiepNoiCaTruoc` cho biet moc nay la thoi diem CHOT CA TRUOC (phai loai tru
 *   dau mut) hay la dau ngay (phai bao gom dau mut). Xem `dieuKienThoiGian`.
 */
async function mocBatDauCa(idNv) {
  const [[lanTruoc]] = await db.query(
    `SELECT shift_end FROM shift_closings
     WHERE id_nv = ? AND shift_end IS NOT NULL
     ORDER BY shift_end DESC LIMIT 1`,
    [idNv]
  );

  const dauNgay = new Date();
  dauNgay.setHours(0, 0, 0, 0);

  if (!lanTruoc || !lanTruoc.shift_end) return { tu: dauNgay, tiepNoiCaTruoc: false };

  const ketThucTruoc = new Date(lanTruoc.shift_end);
  /*
   * Neu lan chot gan nhat da tu hom truoc thi lay dau ngay hom nay, khong lay
   * moc do. Nguoc lai mot thu ngan nghi mot tuan roi quay lai se keo ca doanh
   * thu bay ngay cua dong nghiep vao bien ban cua minh.
   */
  return ketThucTruoc > dauNgay
    ? { tu: ketThucTruoc, tiepNoiCaTruoc: true }
    : { tu: dauNgay, tiepNoiCaTruoc: false };
}

/*
 * Menh de loc thoi gian cua ca - dung CHUNG cho moi cau truy van ben duoi.
 *
 * Dau mut TRAI phai LOAI TRU khi moc la thoi diem chot ca truoc, va PHAI BAO
 * GOM khi moc la dau ngay:
 *
 *   `BETWEEN tu AND den` bao gom ca hai dau. Cot DATETIME cua MySQL khong luu
 *   phan giay le, nen mot phien tra tien roi vao DUNG giay thu ngan bam chot
 *   ca se mang `thanh_cong_luc` bang y het `shift_end` - va bi dem vao CA HAI
 *   bien ban. Ca truoc da tinh no roi thi ca sau phai bo qua: dung `>`.
 *
 *   Nguoc lai khi chua tung chot ca lan nao, moc la 00:00:00 - dung `>` se
 *   danh roi phien nao ghi nhan dung nua dem. Khi do phai dung `>=`.
 *
 * Sai mot dau mut o day la sai toan bo con so doi soat, nen no duoc dat vao
 * mot cho duy nhat thay vi lap lai o nam cau truy van.
 */
function dieuKienThoiGian(cot, tiepNoiCaTruoc) {
  return `${cot} ${tiepNoiCaTruoc ? '>' : '>='} ? AND ${cot} <= ?`;
}

/** Ten ca goi y theo gio hien tai - thu ngan van sua duoc. */
function doanTenCa(luc = new Date()) {
  const gio = luc.getHours();
  if (gio < 12) return 'Sáng';
  if (gio < 17) return 'Chiều';
  return 'Tối';
}

/**
 * Tong hop moi con so cua ca dang mo, chua ghi gi vao CSDL.
 *
 * Dung cho ca man hinh chot ca (xem truoc) lan luc bam chot that - de con so
 * hien tren man hinh va con so duoc luu chac chan la mot.
 */
async function tongHopCa(idNv, { tienDauCa = 0 } = {}) {
  const { tu, tiepNoiCaTruoc } = await mocBatDauCa(idNv);
  const den = new Date();
  const trongCa = (cot) => dieuKienThoiGian(cot, tiepNoiCaTruoc);

  /*
   * Moc thoi gian lay theo `thanh_cong_luc` (luc tien vao that) chu khong phai
   * `created_at` (luc tao ma QR). Mot ma QR tao cuoi ca truoc nhung khach quet
   * dau ca sau thi tien thuoc ve ca sau - ai cam tien nguoi do chiu.
   */
  const [[tienMat]] = await db.query(
    `SELECT COALESCE(SUM(p.amount), 0) AS tong,
            COALESCE(SUM(p.tien_tip), 0) AS tip,
            COUNT(*) AS so_phien
     FROM payments p JOIN payment_methods pm ON p.payment_method_id = pm.id
     WHERE pm.type = 'cash' AND p.status = 'success'
       AND p.processed_by = ? AND ${trongCa('p.thanh_cong_luc')}`,
    [idNv, tu, den]
  );

  const [[hoan]] = await db.query(
    `SELECT COALESCE(SUM(p.amount), 0) AS tong, COUNT(*) AS so_phien
     FROM payments p JOIN payment_methods pm ON p.payment_method_id = pm.id
     WHERE pm.type = 'cash' AND p.status = 'refunded'
       AND p.processed_by = ? AND ${trongCa('p.updated_at')}`,
    [idNv, tu, den]
  );

  const [khongTienMat] = await db.query(
    `SELECT pm.code, pm.name, pm.type,
            COALESCE(SUM(p.amount), 0) AS tong,
            COALESCE(SUM(p.tien_tip), 0) AS tip,
            COUNT(*) AS so_phien
     FROM payments p JOIN payment_methods pm ON p.payment_method_id = pm.id
     WHERE pm.type <> 'cash' AND p.status = 'success'
       AND p.processed_by = ? AND ${trongCa('p.thanh_cong_luc')}
     GROUP BY pm.id, pm.code, pm.name, pm.type`,
    [idNv, tu, den]
  );

  // Khach tu quet QR tra thang - khong quy trach nhiem cho ai.
  const [[khachTuTra]] = await db.query(
    `SELECT COALESCE(SUM(p.amount), 0) AS tong, COUNT(*) AS so_phien
     FROM payments p
     WHERE p.nguon = 'khach_qr' AND p.status = 'success'
       AND p.processed_by IS NULL AND ${trongCa('p.thanh_cong_luc')}`,
    [tu, den]
  );

  const [[datCoc]] = await db.query(
    `SELECT COALESCE(SUM(p.amount), 0) AS tong FROM payments p
     WHERE p.loai = 'dat_coc' AND p.status = 'success'
       AND p.processed_by = ? AND ${trongCa('p.thanh_cong_luc')}`,
    [idNv, tu, den]
  );

  // Phien QR con treo luc chot: tien co the vao SAU khi ky bien ban. Dem ra de
  // thu ngan biet ma khong ky voi cho con lung lung.
  const [[phienCho]] = await db.query(
    "SELECT COUNT(*) AS n FROM payments WHERE status = 'pending' AND processed_by = ?",
    [idNv]
  );

  const [[soHoaDon]] = await db.query(
    `SELECT COUNT(DISTINCT p.sesis) AS n FROM payments p
     WHERE p.status = 'success' AND p.processed_by = ?
       AND ${trongCa('p.thanh_cong_luc')}`,
    [idNv, tu, den]
  );

  const tienMatThu = Number(tienMat.tong) || 0;
  const tienMatHoan = Number(hoan.tong) || 0;
  const quy = Math.round(Number(tienDauCa) || 0);

  const chuyenKhoan = khongTienMat
    .filter((r) => r.type === 'online' || r.type === 'wallet')
    .reduce((t, r) => t + Number(r.tong), 0);
  const the = khongTienMat
    .filter((r) => r.type === 'card')
    .reduce((t, r) => t + Number(r.tong), 0);
  const tipKhongTienMat = khongTienMat.reduce((t, r) => t + Number(r.tip), 0);

  const tienMatHeThong = quy + tienMatThu - tienMatHoan;

  return {
    tu,
    den,
    tenCaGoiY: doanTenCa(den),
    tien_dau_ca: quy,
    tien_mat_thu: tienMatThu,
    tien_mat_hoan: tienMatHoan,
    tien_mat_he_thong: tienMatHeThong,
    tien_chuyen_khoan: chuyenKhoan,
    tien_the: the,
    tien_tip: Number(tienMat.tip || 0) + tipKhongTienMat,
    tien_dat_coc: Number(datCoc.tong) || 0,
    tien_khach_tu_tra: Number(khachTuTra.tong) || 0,
    tong_doanh_thu: tienMatThu + chuyenKhoan + the - tienMatHoan,
    so_hoa_don: Number(soHoaDon.n) || 0,
    so_phien_tien_mat: Number(tienMat.so_phien) || 0,
    so_phien_hoan: Number(hoan.so_phien) || 0,
    so_phien_cho: Number(phienCho.n) || 0,
    chi_tiet_phuong_thuc: khongTienMat,
    menh_gia: MENH_GIA,
  };
}

/**
 * Ghi bien ban chot ca.
 *
 * @param {number} idNv
 * @param {object} duLieu
 * @param {number} duLieu.tienDauCa      quy le dau ca
 * @param {number} duLieu.tienMatDemDuoc so thu ngan dem duoc trong ket
 * @param {object} [duLieu.bangMenhGia]  { '500000': 3, '200000': 5, ... }
 * @param {string} [duLieu.tenCa]
 * @param {string} [duLieu.lyDoChenhLech]
 * @param {string} [duLieu.ghiChu]
 */
async function chotCa(idNv, duLieu = {}) {
  const {
    tienDauCa = 0, tienMatDemDuoc, bangMenhGia = null,
    tenCa = null, lyDoChenhLech = null, ghiChu = null,
  } = duLieu;

  if (tienMatDemDuoc === undefined || tienMatDemDuoc === null || tienMatDemDuoc === '') {
    throw new Error('Chưa nhập số tiền mặt đếm được trong két');
  }
  const demDuoc = Math.round(Number(tienMatDemDuoc));
  if (!Number.isFinite(demDuoc) || demDuoc < 0) {
    throw new Error('Số tiền đếm được không hợp lệ');
  }

  // Tinh LAI o day thay vi tin so client gui len: trinh duyet co the da mo tab
  // tu nua tieng truoc, trong lucdo con vai ban nua da tra tien.
  const th = await tongHopCa(idNv, { tienDauCa });
  const chenhLech = demDuoc - th.tien_mat_he_thong;

  /*
   * Lech thi BAT BUOC giai trinh. Day la ca ly do ton tai cua man hinh nay:
   * mot bien ban ghi "thieu 350.000d" ma khong ai phai viet lay mot chu thi
   * khong khac gi khong doi soat.
   */
  if (chenhLech !== 0 && !String(lyDoChenhLech || '').trim()) {
    throw new Error(
      `Két lệch ${chenhLech > 0 ? 'thừa' : 'thiếu'} ` +
      `${Math.abs(chenhLech).toLocaleString('vi-VN')}đ — bắt buộc ghi rõ lý do trước khi chốt ca`
    );
  }

  const ngayCa = new Date(th.den);
  ngayCa.setHours(0, 0, 0, 0);

  const [kq] = await db.query(
    `INSERT INTO shift_closings
       (id_nv, shift_date, shift_start, shift_end, ten_ca,
        total_orders, total_revenue,
        tien_dau_ca, tien_mat_he_thong, tien_mat_dem_duoc, chenh_lech,
        ly_do_chenh_lech, bang_menh_gia,
        tien_chuyen_khoan, tien_the, tien_tip, tien_hoan, tien_dat_coc,
        tien_khach_tu_tra, so_phien_cho,
        cash_in, cash_out, notes, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'closed', NOW())`,
    [
      idNv, ngayCa, th.tu, th.den, tenCa || th.tenCaGoiY,
      th.so_hoa_don, th.tong_doanh_thu,
      th.tien_dau_ca, th.tien_mat_he_thong, demDuoc, chenhLech,
      lyDoChenhLech || null, bangMenhGia ? JSON.stringify(bangMenhGia) : null,
      th.tien_chuyen_khoan, th.tien_the, th.tien_tip, th.tien_mat_hoan, th.tien_dat_coc,
      th.tien_khach_tu_tra, th.so_phien_cho,
      th.tien_mat_thu, th.tien_mat_hoan, ghiChu || null,
    ]
  );

  return { id: kq.insertId, ...th, tien_mat_dem_duoc: demDuoc, chenh_lech: chenhLech };
}

/** Mot bien ban chot ca kem ten nguoi lap va nguoi duyet. */
async function layBienBan(id) {
  const [[r]] = await db.query(
    `SELECT s.*, n.ten AS ten_nhan_vien, nd.ten AS ten_nguoi_duyet
     FROM shift_closings s
     LEFT JOIN nhan_vien n ON s.id_nv = n.id_nv
     LEFT JOIN nhan_vien nd ON s.verified_by = nd.id_nv
     WHERE s.id = ? LIMIT 1`,
    [id]
  );
  if (!r) return null;
  let bang = null;
  try { bang = r.bang_menh_gia ? JSON.parse(r.bang_menh_gia) : null; } catch { bang = null; }
  return { ...r, bang_menh_gia_doc: bang, menh_gia: MENH_GIA };
}

/**
 * Cac phien thanh toan thuoc mot bien ban - de soi lai khi ket lech.
 *
 * Danh sach nay phai cong lai ra DUNG cac con so trong bien ban, nen no buoc
 * phai dung y het quy tac dau mut cua `tongHopCa`. Bien ban khong luu co
 * `tiepNoiCaTruoc`, nhung suy lai duoc chinh xac: neu chinh thu ngan do co mot
 * bien ban khac ket thuc DUNG vao thoi diem nay mo ca, thi moc nay den tu lan
 * chot truoc va phai loai tru dau mut.
 */
async function chiTietPhienCua(bienBan) {
  const [[caTruoc]] = await db.query(
    'SELECT COUNT(*) AS n FROM shift_closings WHERE id_nv = ? AND shift_end = ? AND id <> ?',
    [bienBan.id_nv, bienBan.shift_start, bienBan.id]
  );
  const tiepNoiCaTruoc = Number(caTruoc.n) > 0;

  const [rows] = await db.query(
    `SELECT p.id, p.sesis, p.amount, p.status, p.loai, p.nguon, p.tien_tip,
            p.thanh_cong_luc, p.ma_doi_soat,
            pm.name AS ten_phuong_thuc, pm.type AS loai_phuong_thuc
     FROM payments p JOIN payment_methods pm ON p.payment_method_id = pm.id
     WHERE p.processed_by = ? AND p.status IN ('success','refunded')
       AND ${dieuKienThoiGian('p.thanh_cong_luc', tiepNoiCaTruoc)}
     ORDER BY p.thanh_cong_luc ASC`,
    [bienBan.id_nv, bienBan.shift_start, bienBan.shift_end]
  );
  return rows;
}

/**
 * Lich su chot ca.
 *
 * `chiCuaToi` de thu ngan thuong chi thay ca cua minh; giam sat / ke toan xem
 * duoc het de con duyet.
 */
async function lichSuChotCa({ idNv = null, tuNgay = null, denNgay = null, chuaDuyet = false, gioiHan = 100 } = {}) {
  const dk = [];
  const ts = [];
  if (idNv) { dk.push('s.id_nv = ?'); ts.push(idNv); }
  if (tuNgay) { dk.push('s.shift_date >= ?'); ts.push(tuNgay); }
  if (denNgay) { dk.push('s.shift_date <= ?'); ts.push(denNgay); }
  if (chuaDuyet) dk.push("s.status <> 'verified'");
  ts.push(Number(gioiHan));

  const [rows] = await db.query(
    `SELECT s.*, n.ten AS ten_nhan_vien, nd.ten AS ten_nguoi_duyet
     FROM shift_closings s
     LEFT JOIN nhan_vien n ON s.id_nv = n.id_nv
     LEFT JOIN nhan_vien nd ON s.verified_by = nd.id_nv
     ${dk.length ? 'WHERE ' + dk.join(' AND ') : ''}
     ORDER BY s.id DESC LIMIT ?`,
    ts
  );
  return rows;
}

/**
 * Giam sat / ke toan duyet mot bien ban.
 *
 * Nguoi lap KHONG duoc tu duyet bien ban cua chinh minh - do la nguyen tac
 * phan tach nhiem vu co ban, va cung la thu dau tien hoi dong se hoi khi nhin
 * vao mot chuc nang kiem soat noi bo.
 */
async function duyetBienBan(id, nguoiDuyetId, ghiChu = null) {
  const [[bb]] = await db.query('SELECT id_nv, status FROM shift_closings WHERE id = ? LIMIT 1', [id]);
  if (!bb) throw new Error('Không tìm thấy biên bản chốt ca #' + id);
  if (bb.status === 'verified') throw new Error('Biên bản này đã được duyệt');
  if (Number(bb.id_nv) === Number(nguoiDuyetId)) {
    throw new Error('Không thể tự duyệt biên bản chốt ca của chính mình');
  }

  await db.query(
    `UPDATE shift_closings
     SET status = 'verified', verified_by = ?, duyet_luc = NOW(),
         ghi_chu_duyet = ?, updated_at = NOW()
     WHERE id = ? AND status <> 'verified'`,
    [nguoiDuyetId, ghiChu || null, id]
  );
  return true;
}

/** So bien ban con cho duyet - dung cho chi so tren man hinh giam sat. */
async function soBienBanChoDuyet() {
  const [[r]] = await db.query("SELECT COUNT(*) AS n FROM shift_closings WHERE status = 'closed'");
  return Number(r.n) || 0;
}

module.exports = {
  MENH_GIA,
  mocBatDauCa, dieuKienThoiGian, doanTenCa, tongHopCa,
  chotCa, layBienBan, chiTietPhienCua,
  lichSuChotCa, duyetBienBan, soBienBanChoDuyet,
};
