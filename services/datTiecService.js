/**
 * DAT TIEC - tiec cuoi, sinh nhat, party cong ty, hop mat gia dinh.
 *
 * Khac dat ban le o cho: khach KHONG chon ban. Khach chon sanh (khu vuc co
 * `tiec_toi_da > 0`), buoi (trua/toi), so khach va mot thuc don tinh theo BAN
 * 10 KHACH. Don vao trang thai MOI; nhan vien goi tu van, chot hop dong, thu coc
 * roi chuyen trang thai tren /staff/dat-tiec.
 *
 * Chong trung lich: moi sanh chi to chuc MOT tiec moi buoi. Chi don da
 * DA_XAC_NHAN / DA_COC moi giu cho - mot yeu cau MOI chua ai goi lai thi khong
 * duoc phep khoa ca sanh Gala cua mot ngay cuoi tuan.
 */
const db = require('../config/db');
const { ngayCucBo } = require('../utils/thoiGian');
const qt = require('./reservationRules');

const KHACH_MOI_BAN = 10;
const DAT_TRUOC_TOI_THIEU_NGAY = 3;
const DAT_TRUOC_TOI_DA_NGAY = 365;

const LOAI_TIEC = {
  CUOI: {
    ten: 'Tiệc cưới & Đính hôn', icon: 'fa-ring', anh: '/images/khong-gian/tiec-cuoi-3.jpg',
    mo_ta: 'Lễ thành hôn, tiệc báo hỷ, lễ đính hôn – trọn gói trang trí, MC và sân khấu.',
    nhan_vat: 'Tên cô dâu & chú rể',
  },
  SINH_NHAT: {
    ten: 'Sinh nhật & Thôi nôi', icon: 'fa-birthday-cake', anh: '/images/khong-gian/sinh-nhat-1.jpg',
    mo_ta: 'Sinh nhật bé, sinh nhật người lớn, thôi nôi – đầy tháng với bánh kem tặng kèm.',
    nhan_vat: 'Tên người được chúc mừng',
  },
  PARTY: {
    ten: 'Party & Tiệc công ty', icon: 'fa-glass-cheers', anh: '/images/khong-gian/party-2.jpg',
    mo_ta: 'Year End Party, tiệc khai trương, hội nghị khách hàng, liên hoan teambuilding.',
    nhan_vat: 'Tên công ty / tổ chức',
  },
  GIA_DINH: {
    ten: 'Họp mặt & Kỷ niệm', icon: 'fa-users', anh: '/images/khong-gian/vip-2.jpg',
    mo_ta: 'Họp mặt gia đình, mừng thọ, kỷ niệm ngày cưới, họp lớp, tất niên.',
    nhan_vat: 'Tên gia đình / nhóm',
  },
};

const BUOI = {
  TRUA: { ten: 'Buổi trưa', khung: '10:30 – 14:00', gio: ['10:30', '11:00', '11:30', '12:00'] },
  TOI: { ten: 'Buổi tối', khung: '17:30 – 22:00', gio: ['17:30', '18:00', '18:30', '19:00'] },
};

const TRANG_THAI = {
  MOI: 'Yêu cầu mới',
  DA_LIEN_HE: 'Đã liên hệ tư vấn',
  DA_XAC_NHAN: 'Đã xác nhận',
  DA_COC: 'Đã đặt cọc',
  HOAN_THANH: 'Hoàn thành',
  HUY: 'Đã hủy',
};
/** Trang thai giu cho sanh. */
const GIU_CHO = ['DA_XAC_NHAN', 'DA_COC'];

/** Trang thai da dong ho so - khong sua/doi trang thai duoc nua. */
const TRANG_THAI_KET_THUC = ['HOAN_THANH', 'HUY'];

/**
 * May trang thai. Khac ban dau (doi tuy y): mot don MOI khong the nhay thang
 * len HOAN_THANH, va don da HOAN_THANH/HUY thi dong ho so vinh vien - muon "mo
 * lai" phai tao don moi, giu dau vet that cho lich su va bao cao.
 */
const CHUYEN_TRANG_THAI = {
  MOI: ['DA_LIEN_HE', 'HUY'],
  DA_LIEN_HE: ['DA_XAC_NHAN', 'HUY'],
  DA_XAC_NHAN: ['DA_COC', 'HUY'],
  DA_COC: ['HOAN_THANH', 'HUY'],
  HOAN_THANH: [],
  HUY: [],
};

const PHUONG_THUC_THANH_TOAN = ['TIEN_MAT', 'CHUYEN_KHOAN', 'QUET_QR', 'THE'];
const TEN_PHUONG_THUC = { TIEN_MAT: 'Tiền mặt', CHUYEN_KHOAN: 'Chuyển khoản', QUET_QR: 'Quét QR', THE: 'Quẹt thẻ' };

class LoiDatTiec extends Error {
  constructor(message, ma = 'INVALID') { super(message); this.name = 'LoiDatTiec'; this.ma = ma; }
}

// ------------------------------------------------------------- cau hinh

const CAU_HINH_MAC_DINH = {
  ty_le_coc: 30,
  hoan_tien_som_ngay: 7,
  hoan_tien_giua_ngay: 3,
  hoan_tien_giua_phan_tram: 50,
};

/** Doc cau hinh tien coc / chinh sach hoan tien tu dat_tiec_cau_hinh. */
async function docCauHinh() {
  const [rows] = await db.query('SELECT setting_key, setting_value FROM dat_tiec_cau_hinh');
  const doc = { ...CAU_HINH_MAC_DINH };
  for (const row of rows) doc[row.setting_key] = row.setting_value;
  for (const [khoa, gt] of Object.entries(CAU_HINH_MAC_DINH)) {
    const so = Number(doc[khoa]);
    doc[khoa] = Number.isFinite(so) ? so : gt;
  }
  return doc;
}

/** Tien coc yeu cau = ty_le_coc% cua du toan, lam tron den nghin dong. */
function tinhTienCoc(tongDuToan, ch) {
  const tyLe = Number(ch.ty_le_coc) || 30;
  return Math.round(((Number(tongDuToan) || 0) * tyLe) / 100 / 1000) * 1000;
}

/**
 * So tien coc duoc hoan khi huy, theo so ngay con lai truoc ngay to chuc.
 *
 * Nha hang chu dong huy (loi lich, su co...) thi luon hoan 100% - khach khong
 * phai chiu thiet vi mot quyet dinh khong phai cua ho.
 */
function tinhHoanTien({ tienDaCoc, ngayToChuc, ngayHuy, nguoiHuy }, ch) {
  const daCoc = Number(tienDaCoc) || 0;
  if (daCoc <= 0) return { soTien: 0, tyLe: 0, lyDo: 'Chưa thu tiền cọc, không có gì để hoàn.' };
  if (nguoiHuy === 'NHA_HANG') {
    return { soTien: daCoc, tyLe: 100, lyDo: 'Nhà hàng chủ động hủy — hoàn toàn bộ tiền đã cọc.' };
  }

  const ngayToChucD = new Date(String(ngayToChuc).slice(0, 10) + 'T00:00:00');
  const ngayHuyD = new Date(String(ngayHuy).slice(0, 10) + 'T00:00:00');
  const soNgayConLai = Math.round((ngayToChucD - ngayHuyD) / 86400000);

  const nguongSom = Number(ch.hoan_tien_som_ngay) || 7;
  const nguongGiua = Number(ch.hoan_tien_giua_ngay) || 3;
  const tyLeGiua = Number(ch.hoan_tien_giua_phan_tram) || 50;

  if (soNgayConLai >= nguongSom) {
    return { soTien: daCoc, tyLe: 100, lyDo: `Hủy trước ≥ ${nguongSom} ngày so với ngày tiệc — hoàn 100% tiền cọc.` };
  }
  if (soNgayConLai >= nguongGiua) {
    const soTien = Math.round((daCoc * tyLeGiua) / 100 / 1000) * 1000;
    return { soTien, tyLe: tyLeGiua, lyDo: `Hủy trước ${nguongGiua}–${nguongSom - 1} ngày — hoàn ${tyLeGiua}% tiền cọc.` };
  }
  return { soTien: 0, tyLe: 0, lyDo: `Hủy trước dưới ${nguongGiua} ngày so với ngày tiệc — không hoàn tiền cọc theo chính sách.` };
}

/** Ghi mot dong lich su. `executor` co the la pool `db` hoac mot connection dang trong transaction. */
async function ghiNhatKy(executor, id, tuTrangThai, denTrangThai, ghiChu, nguoiDoi) {
  await executor.query(
    `INSERT INTO dat_tiec_lich_su (dat_tiec_id, tu_trang_thai, den_trang_thai, ghi_chu, nguoi_doi)
     VALUES (?, ?, ?, ?, ?)`,
    [id, tuTrangThai || null, denTrangThai, ghiChu || null, nguoiDoi || null]);
}

function docJson(s, macDinh) {
  if (s == null || s === '') return macDinh;
  if (typeof s !== 'string') return s;
  try { return JSON.parse(s); } catch (_) { return macDinh; }
}

// --------------------------------------------------------------- doc

/** Moi khu vuc kem anh, tien ich - cho trang /khong-gian. */
async function docKhongGian() {
  const [rows] = await db.query(
    `SELECT v.id_vitri AS id, v.Name_vitri AS ten, v.Ghichu AS mo_ta, v.mo_ta_dai, v.thu_vien_anh, v.tien_ich,
            v.la_vip, v.ngoai_troi, v.cho_dat_truoc, v.la_sanh_tiec, v.tiec_toi_thieu, v.tiec_toi_da,
            COUNT(b.Id_ban) AS so_ban, COALESCE(SUM(b.so_cho), 0) AS tong_cho,
            COALESCE(MIN(b.so_cho), 0) AS cho_min, COALESCE(MAX(b.so_cho), 0) AS cho_max
       FROM vitri v LEFT JOIN ban b ON b.id_vitri = v.id_vitri
      GROUP BY v.id_vitri
      ORDER BY v.la_sanh_tiec DESC, v.thu_tu, v.Name_vitri`);
  return rows.map((r) => ({
    ...r,
    thu_vien_anh: docJson(r.thu_vien_anh, []),
    tien_ich: docJson(r.tien_ich, []),
    la_vip: !!r.la_vip, ngoai_troi: !!r.ngoai_troi, cho_dat_truoc: !!r.cho_dat_truoc, la_sanh_tiec: !!r.la_sanh_tiec,
    so_ban: Number(r.so_ban), tong_cho: Number(r.tong_cho), cho_min: Number(r.cho_min), cho_max: Number(r.cho_max),
    tiec_toi_thieu: Number(r.tiec_toi_thieu), tiec_toi_da: Number(r.tiec_toi_da),
  }));
}

/** Cac sanh nhan to chuc tiec. */
async function docSanhTiec() {
  return (await docKhongGian())
    .filter((k) => k.tiec_toi_da > 0)
    .sort((a, b) => b.tiec_toi_da - a.tiec_toi_da);
}

async function docThucDon({ chiDangBan = true } = {}) {
  const [rows] = await db.query(
    `SELECT * FROM thuc_don_tiec ${chiDangBan ? 'WHERE trang_thai = 1' : ''} ORDER BY thu_tu, id`);
  return rows.map((r) => ({
    ...r,
    gia_ban: Number(r.gia_ban),
    gia_khach: Math.round(Number(r.gia_ban) / KHACH_MOI_BAN),
    mon: docJson(r.mon, []),
    bao_gom: docJson(r.bao_gom, []),
    noi_bat: !!r.noi_bat,
  }));
}

async function docDichVu() {
  const [rows] = await db.query('SELECT * FROM dich_vu_tiec WHERE trang_thai = 1 ORDER BY thu_tu, id');
  return rows.map((r) => ({ ...r, gia: Number(r.gia) }));
}

/** Buoi da co tiec giu cho trong khoang ngay - de form to xam. */
async function lichDaKin(tuNgay, denNgay) {
  const [rows] = await db.query(
    `SELECT id, khu_vuc_id, DATE_FORMAT(ngay_to_chuc, '%Y-%m-%d') AS ngay, buoi
       FROM dat_tiec
      WHERE ngay_to_chuc BETWEEN ? AND ? AND trang_thai IN (?)`,
    [tuNgay, denNgay, GIU_CHO]);
  return rows;
}

// --------------------------------------------------------------- tinh tien

/**
 * Tinh du toan. Dung chung cho xem truoc tren trinh duyet (qua API) va khi
 * luu don - gia LUON lay tu CSDL, khong tin con so trinh duyet gui len.
 */
function tinhDuToan({ thucDon, dsDichVu, soKhach, chonDichVu }) {
  const soBan = Math.ceil(soKhach / KHACH_MOI_BAN);
  const tienThucDon = thucDon ? thucDon.gia_ban * soBan : 0;
  const dichVu = [];
  for (const id of chonDichVu || []) {
    const dv = dsDichVu.find((d) => Number(d.id) === Number(id));
    if (!dv) continue;
    const soLuong = dv.don_vi === 'BAN' ? soBan : dv.don_vi === 'KHACH' ? soKhach : 1;
    dichVu.push({ id: dv.id, ten: dv.ten, don_gia: dv.gia, don_vi: dv.don_vi, so_luong: soLuong, thanh_tien: dv.gia * soLuong });
  }
  const tienDichVu = dichVu.reduce((s, d) => s + d.thanh_tien, 0);
  return { soBan, tienThucDon, dichVu, tienDichVu, tong: tienThucDon + tienDichVu };
}

// --------------------------------------------------------------- tao don

function cong(ngay, soNgay) {
  const d = new Date(ngay + 'T00:00:00');
  d.setDate(d.getDate() + soNgay);
  return ngayCucBo(d);
}

function taoMa() {
  const d = new Date();
  const yymmdd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const ngauNhien = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TC${yymmdd}${ngauNhien}`;
}

/**
 * Kiem tra + tinh gia dung chung cho tao moi va sua don.
 *
 * `boQuaId`: khi sua mot don co san, loai chinh no ra khoi (1) rang buoc "dat
 * truoc toi thieu N ngay" (don cu co the da nam trong khoang do roi, khong le
 * chan sua chi vi ngay to chuc gan) va (2) kiem tra trung lich sanh.
 */
async function chuanBiDuLieu(body, { boQuaId = null } = {}) {
  const hoTen = String(body.ho_ten || '').trim();
  const soDienThoai = String(body.so_dien_thoai || '').replace(/[\s.-]/g, '');
  const email = String(body.email || '').trim() || null;
  const loai = String(body.loai_tiec || '');
  const ngay = String(body.ngay_to_chuc || '');
  const buoi = String(body.buoi || '');
  const gio = String(body.gio_bat_dau || '');
  const soKhach = Math.floor(Number(body.so_khach));
  const khuVucId = Number(body.khu_vuc_id);
  const thucDonId = Number(body.thuc_don_id);
  const chonDichVu = Array.isArray(body.dich_vu) ? body.dich_vu.map(Number) : [];

  if (hoTen.length < 2 || hoTen.length > 150) throw new LoiDatTiec('Vui lòng nhập họ tên người đặt tiệc.');
  if (!/^(\+?84|0)\d{9,10}$/.test(soDienThoai)) throw new LoiDatTiec('Số điện thoại không hợp lệ.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new LoiDatTiec('Email không hợp lệ.');
  if (!LOAI_TIEC[loai]) throw new LoiDatTiec('Vui lòng chọn loại tiệc.');
  if (!BUOI[buoi]) throw new LoiDatTiec('Vui lòng chọn buổi tổ chức.');
  if (!BUOI[buoi].gio.includes(gio)) throw new LoiDatTiec('Giờ bắt đầu không hợp lệ.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) throw new LoiDatTiec('Vui lòng chọn ngày tổ chức.');

  const homNay = ngayCucBo();
  if (!boQuaId && ngay < cong(homNay, DAT_TRUOC_TOI_THIEU_NGAY)) {
    throw new LoiDatTiec(`Tiệc cần được đặt trước ít nhất ${DAT_TRUOC_TOI_THIEU_NGAY} ngày để nhà hàng chuẩn bị. Với tiệc gấp, vui lòng gọi Hotline.`);
  }
  if (ngay > cong(homNay, DAT_TRUOC_TOI_DA_NGAY)) throw new LoiDatTiec('Chỉ nhận đặt tiệc trong vòng 12 tháng tới.');

  const sanh = (await docSanhTiec()).find((s) => Number(s.id) === khuVucId);
  if (!sanh) throw new LoiDatTiec('Vui lòng chọn sảnh tổ chức.');
  if (!Number.isFinite(soKhach) || soKhach < sanh.tiec_toi_thieu || soKhach > sanh.tiec_toi_da) {
    throw new LoiDatTiec(`${sanh.ten} nhận tiệc từ ${sanh.tiec_toi_thieu} đến ${sanh.tiec_toi_da} khách.`);
  }

  const thucDon = (await docThucDon()).find((t) => Number(t.id) === thucDonId);
  if (!thucDon) throw new LoiDatTiec('Vui lòng chọn thực đơn.');

  const kin = await lichDaKin(ngay, ngay);
  if (kin.some((k) => Number(k.khu_vuc_id) === khuVucId && k.buoi === buoi && Number(k.id) !== Number(boQuaId || 0))) {
    throw new LoiDatTiec(`${sanh.ten} đã có tiệc vào ${BUOI[buoi].ten.toLowerCase()} ngày này. Vui lòng chọn buổi hoặc ngày khác.`, 'CONFLICT');
  }

  const dt = tinhDuToan({ thucDon, dsDichVu: await docDichVu(), soKhach, chonDichVu });
  const ch = await docCauHinh();
  const tienCoc = tinhTienCoc(dt.tong, ch);

  return {
    hoTen, soDienThoai, email, loai, ngay, buoi, gio, soKhach, khuVucId, thucDonId,
    sanh, thucDon, dt, tienCoc,
    tenNhanVat: String(body.ten_nhan_vat || '').trim().slice(0, 150) || null,
    ghiChu: String(body.ghi_chu || '').trim().slice(0, 2000) || null,
  };
}

async function taoDonTiec(body, { customerId = null } = {}) {
  const d = await chuanBiDuLieu(body);
  const ma = taoMa();
  const [kq] = await db.query(
    `INSERT INTO dat_tiec (ma_tiec, customer_id, ho_ten, so_dien_thoai, email, loai_tiec, ten_nhan_vat,
                           ngay_to_chuc, buoi, gio_bat_dau, so_khach, so_ban, khu_vuc_id, thuc_don_id,
                           dich_vu, tien_thuc_don, tien_dich_vu, tong_du_toan, tien_coc, ghi_chu)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [ma, customerId, d.hoTen, d.soDienThoai, d.email, d.loai, d.tenNhanVat,
      d.ngay, d.buoi, d.gio, d.soKhach, d.dt.soBan, d.khuVucId, d.thucDonId, JSON.stringify(d.dt.dichVu),
      d.dt.tienThucDon, d.dt.tienDichVu, d.dt.tong, d.tienCoc, d.ghiChu]);

  await ghiNhatKy(db, kq.insertId, null, 'MOI', 'Khách gửi yêu cầu đặt tiệc qua website', null);

  return {
    id: kq.insertId, ma, so_ban: d.dt.soBan, tong_du_toan: d.dt.tong, tien_coc: d.tienCoc,
    sanh: d.sanh.ten, thuc_don: d.thucDon.ten, ngay: d.ngay, buoi: BUOI[d.buoi].ten, gio: d.gio,
  };
}

/**
 * Nhan vien sua mot don da ton tai (ngay/buoi/so khach/sanh/thuc don/dich vu...).
 * Khong cho sua khi don da dong ho so (HOAN_THANH/HUY) - luc do moi thay doi
 * phai la mot don moi de giu dau vet lich su that.
 */
async function capNhatDon(id, body, ctx = {}) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[don]] = await conn.query('SELECT * FROM dat_tiec WHERE id = ? FOR UPDATE', [id]);
    if (!don) throw new LoiDatTiec('Không tìm thấy đơn tiệc.', 'NOT_FOUND');
    if (TRANG_THAI_KET_THUC.includes(don.trang_thai)) {
      throw new LoiDatTiec(`Đơn đang ở trạng thái "${TRANG_THAI[don.trang_thai]}", không thể sửa.`, 'CLOSED');
    }

    const d = await chuanBiDuLieu(body, { boQuaId: id });

    await conn.query(
      `UPDATE dat_tiec SET
         ho_ten = ?, so_dien_thoai = ?, email = ?, loai_tiec = ?, ten_nhan_vat = ?,
         ngay_to_chuc = ?, buoi = ?, gio_bat_dau = ?, so_khach = ?, so_ban = ?, khu_vuc_id = ?, thuc_don_id = ?,
         dich_vu = ?, tien_thuc_don = ?, tien_dich_vu = ?, tong_du_toan = ?, tien_coc = ?, ghi_chu = ?, updated_at = NOW()
       WHERE id = ?`,
      [d.hoTen, d.soDienThoai, d.email, d.loai, d.tenNhanVat,
        d.ngay, d.buoi, d.gio, d.soKhach, d.dt.soBan, d.khuVucId, d.thucDonId, JSON.stringify(d.dt.dichVu),
        d.dt.tienThucDon, d.dt.tienDichVu, d.dt.tong, d.tienCoc, d.ghiChu, id]);

    await ghiNhatKy(conn, id, don.trang_thai, don.trang_thai,
      'Cập nhật thông tin đơn tiệc (ngày/giờ/số khách/sảnh/thực đơn/dịch vụ)', ctx.nhanVienId);

    await conn.commit();
    return chiTiet(id);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// --------------------------------------------------------------- nhan vien

async function danhSach({ trangThai = '', tuNgay = '', tim = '' } = {}) {
  const dk = [];
  const ts = [];
  if (trangThai && TRANG_THAI[trangThai]) { dk.push('t.trang_thai = ?'); ts.push(trangThai); }
  if (tuNgay && /^\d{4}-\d{2}-\d{2}$/.test(tuNgay)) { dk.push('t.ngay_to_chuc >= ?'); ts.push(tuNgay); }
  if (tim) {
    dk.push('(t.ma_tiec LIKE ? OR t.ho_ten LIKE ? OR t.so_dien_thoai LIKE ?)');
    ts.push(`%${tim}%`, `%${tim}%`, `%${tim}%`);
  }
  const [rows] = await db.query(
    `SELECT t.*, DATE_FORMAT(t.ngay_to_chuc, '%Y-%m-%d') AS ngay, TIME_FORMAT(t.gio_bat_dau, '%H:%i') AS gio,
            v.Name_vitri AS ten_sanh, d.ten AS ten_thuc_don, d.gia_ban, nv.ten AS ten_nhan_vien_xu_ly
       FROM dat_tiec t
       LEFT JOIN vitri v ON v.id_vitri = t.khu_vuc_id
       LEFT JOIN thuc_don_tiec d ON d.id = t.thuc_don_id
       LEFT JOIN nhan_vien nv ON nv.id_nv = t.nhan_vien_xu_ly
      ${dk.length ? 'WHERE ' + dk.join(' AND ') : ''}
      ORDER BY FIELD(t.trang_thai, 'MOI', 'DA_LIEN_HE', 'DA_XAC_NHAN', 'DA_COC', 'HOAN_THANH', 'HUY'),
               t.ngay_to_chuc, t.id DESC
      LIMIT 500`, ts);
  return rows.map((r) => ({
    ...r,
    dich_vu: docJson(r.dich_vu, []),
    tong_du_toan: Number(r.tong_du_toan), tien_thuc_don: Number(r.tien_thuc_don), tien_dich_vu: Number(r.tien_dich_vu),
    tien_coc: Number(r.tien_coc), da_coc: Number(r.da_coc),
    ten_loai: (LOAI_TIEC[r.loai_tiec] || {}).ten || r.loai_tiec,
    ten_buoi: (BUOI[r.buoi] || {}).ten || r.buoi,
    ten_trang_thai: TRANG_THAI[r.trang_thai] || r.trang_thai,
    chuyen_duoc: CHUYEN_TRANG_THAI[r.trang_thai] || [],
  }));
}

async function thongKe() {
  const [rows] = await db.query('SELECT trang_thai, COUNT(*) AS so FROM dat_tiec GROUP BY trang_thai');
  const kq = Object.fromEntries(Object.keys(TRANG_THAI).map((k) => [k, 0]));
  for (const r of rows) kq[r.trang_thai] = Number(r.so);
  return kq;
}

/** Chi tiet day du mot don: thong tin + lich su trang thai + cac lan thanh toan. */
async function chiTiet(id) {
  const [[d]] = await db.query(
    `SELECT t.*, DATE_FORMAT(t.ngay_to_chuc, '%Y-%m-%d') AS ngay, TIME_FORMAT(t.gio_bat_dau, '%H:%i') AS gio,
            v.Name_vitri AS ten_sanh, m.ten AS ten_thuc_don, m.gia_ban, nv.ten AS ten_nhan_vien_xu_ly
       FROM dat_tiec t
       LEFT JOIN vitri v ON v.id_vitri = t.khu_vuc_id
       LEFT JOIN thuc_don_tiec m ON m.id = t.thuc_don_id
       LEFT JOIN nhan_vien nv ON nv.id_nv = t.nhan_vien_xu_ly
      WHERE t.id = ?`, [id]);
  if (!d) return null;

  const [[lichSu], [thanhToan]] = await Promise.all([
    db.query(
      `SELECT h.*, nv.ten AS ten_nguoi_doi
         FROM dat_tiec_lich_su h LEFT JOIN nhan_vien nv ON nv.id_nv = h.nguoi_doi
        WHERE h.dat_tiec_id = ? ORDER BY h.id ASC`, [id]),
    db.query(
      `SELECT p.*, nv.ten AS ten_nguoi_ghi
         FROM dat_tiec_thanh_toan p LEFT JOIN nhan_vien nv ON nv.id_nv = p.nguoi_ghi_nhan
        WHERE p.dat_tiec_id = ? ORDER BY p.id ASC`, [id]),
  ]);

  return {
    ...d,
    dich_vu: docJson(d.dich_vu, []),
    tong_du_toan: Number(d.tong_du_toan), tien_thuc_don: Number(d.tien_thuc_don), tien_dich_vu: Number(d.tien_dich_vu),
    tien_coc: Number(d.tien_coc), da_coc: Number(d.da_coc), so_tien_hoan: d.so_tien_hoan == null ? null : Number(d.so_tien_hoan),
    ten_loai: (LOAI_TIEC[d.loai_tiec] || {}).ten || d.loai_tiec,
    ten_buoi: (BUOI[d.buoi] || {}).ten || d.buoi,
    ten_trang_thai: TRANG_THAI[d.trang_thai] || d.trang_thai,
    chuyen_duoc: CHUYEN_TRANG_THAI[d.trang_thai] || [],
    lich_su: lichSu.map((h) => ({
      ...h,
      ten_tu_trang_thai: h.tu_trang_thai ? (TRANG_THAI[h.tu_trang_thai] || h.tu_trang_thai) : null,
      ten_den_trang_thai: TRANG_THAI[h.den_trang_thai] || h.den_trang_thai,
    })),
    thanh_toan: thanhToan.map((p) => ({ ...p, so_tien: Number(p.so_tien), ten_phuong_thuc: TEN_PHUONG_THUC[p.phuong_thuc] || p.phuong_thuc })),
  };
}

/** Danh sach nhan vien co the duoc phan cong phu trach mot don tiec. */
async function danhSachNhanVienXuLy() {
  const [rows] = await db.query(
    `SELECT id_nv AS id, ten FROM nhan_vien WHERE trangthai = 1 AND trang_thai_lam_viec = 'dang_lam' ORDER BY ten`);
  return rows;
}

/** Phan cong / doi nhan vien phu trach mot don - tach rieng khoi doi trang thai. */
async function ganNhanVien(id, nhanVienId, ctx = {}) {
  const [[don]] = await db.query('SELECT trang_thai FROM dat_tiec WHERE id = ?', [id]);
  if (!don) throw new LoiDatTiec('Không tìm thấy đơn tiệc.', 'NOT_FOUND');

  const idMoi = nhanVienId ? Number(nhanVienId) : null;
  await db.query('UPDATE dat_tiec SET nhan_vien_xu_ly = ? WHERE id = ?', [idMoi, id]);
  await ghiNhatKy(db, id, don.trang_thai, don.trang_thai,
    idMoi ? `Phân công nhân viên phụ trách (mã NV #${idMoi})` : 'Bỏ phân công nhân viên phụ trách', ctx.nhanVienId);
  return chiTiet(id);
}

/**
 * Ghi nhan mot lan thu tien (coc hoac thanh toan them). Cho phep thu nhieu
 * lan - vi du khach coc truoc 50%, coc them phan con lai sau khi chot menu.
 * Tu dong chuyen DA_XAC_NHAN -> DA_COC khi da thu du tien_coc yeu cau.
 */
async function ghiNhanThanhToan(id, { soTien, phuongThuc, maGiaoDich, ghiChu } = {}, ctx = {}) {
  const tien = Math.round(Number(soTien));
  if (!Number.isFinite(tien) || tien <= 0) throw new LoiDatTiec('Số tiền không hợp lệ.');
  const ptThanhToan = PHUONG_THUC_THANH_TOAN.includes(phuongThuc) ? phuongThuc : 'TIEN_MAT';

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[don]] = await conn.query('SELECT * FROM dat_tiec WHERE id = ? FOR UPDATE', [id]);
    if (!don) throw new LoiDatTiec('Không tìm thấy đơn tiệc.', 'NOT_FOUND');
    if (TRANG_THAI_KET_THUC.includes(don.trang_thai)) {
      throw new LoiDatTiec(`Đơn đang ở trạng thái "${TRANG_THAI[don.trang_thai]}", không thể ghi nhận thanh toán.`, 'CLOSED');
    }

    await conn.query(
      `INSERT INTO dat_tiec_thanh_toan (dat_tiec_id, so_tien, phuong_thuc, ma_giao_dich, ghi_chu, nguoi_ghi_nhan)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, tien, ptThanhToan, String(maGiaoDich || '').trim().slice(0, 100) || null,
        String(ghiChu || '').trim().slice(0, 300) || null, ctx.nhanVienId || null]);

    const daCocMoi = Number(don.da_coc) + tien;
    let trangThaiMoi = don.trang_thai;
    if (trangThaiMoi === 'DA_XAC_NHAN' && Number(don.tien_coc) > 0 && daCocMoi >= Number(don.tien_coc)) {
      trangThaiMoi = 'DA_COC';
    }
    await conn.query('UPDATE dat_tiec SET da_coc = ? , trang_thai = ? WHERE id = ?', [daCocMoi, trangThaiMoi, id]);

    let ghiChuLichSu = `Ghi nhận thanh toán ${tien.toLocaleString('vi-VN')}đ (${TEN_PHUONG_THUC[ptThanhToan]})`;
    if (trangThaiMoi !== don.trang_thai) {
      ghiChuLichSu += ` — đã đủ tiền cọc, tự động chuyển sang "${TRANG_THAI[trangThaiMoi]}"`;
    }
    await ghiNhatKy(conn, id, don.trang_thai, trangThaiMoi, ghiChuLichSu, ctx.nhanVienId);

    await conn.commit();
    return chiTiet(id);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Doi trang thai co kiem soat luong hop le (CHUYEN_TRANG_THAI). Huy bat buoc
 * phai co ly do, va tu dong tinh so tien hoan coc theo chinh sach thoi gian.
 */
async function capNhatTrangThai(id, { trangThai, ghiChuNoiBo, lyDoHuy, nguoiHuy }, ctx = {}) {
  if (!TRANG_THAI[trangThai]) throw new LoiDatTiec('Trạng thái không hợp lệ.');
  const ch = await docCauHinh();

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[don]] = await conn.query('SELECT * FROM dat_tiec WHERE id = ? FOR UPDATE', [id]);
    if (!don) throw new LoiDatTiec('Không tìm thấy đơn tiệc.', 'NOT_FOUND');

    const tuTrangThai = don.trang_thai;
    if (tuTrangThai !== trangThai) {
      const hopLe = CHUYEN_TRANG_THAI[tuTrangThai] || [];
      if (!hopLe.includes(trangThai)) {
        throw new LoiDatTiec(
          `Không thể chuyển từ "${TRANG_THAI[tuTrangThai]}" sang "${TRANG_THAI[trangThai]}".`, 'BAD_TRANSITION');
      }
    }

    if (GIU_CHO.includes(trangThai) && !GIU_CHO.includes(tuTrangThai)) {
      const [[trung]] = await conn.query(
        `SELECT ma_tiec FROM dat_tiec
          WHERE id <> ? AND khu_vuc_id = ? AND ngay_to_chuc = ? AND buoi = ? AND trang_thai IN (?) LIMIT 1`,
        [id, don.khu_vuc_id, don.ngay_to_chuc, don.buoi, GIU_CHO]);
      if (trung) throw new LoiDatTiec(`Sảnh đã được giữ cho tiệc ${trung.ma_tiec} cùng buổi. Không thể xác nhận trùng lịch.`, 'CONFLICT');
    }

    let lyDoHuyLuu = null;
    let nguoiHuyLuu = null;
    let soTienHoan = null;
    let ghiChuLichSu = ghiChuNoiBo ? String(ghiChuNoiBo).trim() : '';

    if (trangThai === 'HUY' && tuTrangThai !== 'HUY') {
      const lyDo = String(lyDoHuy || '').trim();
      if (!lyDo) throw new LoiDatTiec('Vui lòng nhập lý do hủy.', 'NEED_REASON');
      nguoiHuyLuu = ['KHACH', 'NHA_HANG'].includes(nguoiHuy) ? nguoiHuy : 'KHACH';
      lyDoHuyLuu = lyDo.slice(0, 255);

      const hoan = tinhHoanTien({
        tienDaCoc: don.da_coc,
        ngayToChuc: qt.ngayChuoi(don.ngay_to_chuc),
        ngayHuy: qt.ngayChuoi(new Date()),
        nguoiHuy: nguoiHuyLuu,
      }, ch);
      soTienHoan = hoan.soTien;

      ghiChuLichSu = `Hủy (${nguoiHuyLuu === 'NHA_HANG' ? 'nhà hàng chủ động' : 'theo yêu cầu khách'}): ${lyDo}. ${hoan.lyDo}`
        + (ghiChuNoiBo ? ` — ${String(ghiChuNoiBo).trim()}` : '');
    }

    await conn.query(
      `UPDATE dat_tiec SET
         trang_thai = ?,
         ghi_chu_noi_bo = COALESCE(?, ghi_chu_noi_bo),
         -- Giu nguyen nguoi da duoc phan cong (ganNhanVien); chi tu gan nguoi
         -- dang thao tac khi don chua co ai phu trach.
         nhan_vien_xu_ly = COALESCE(nhan_vien_xu_ly, ?),
         ly_do_huy = COALESCE(?, ly_do_huy),
         nguoi_huy = COALESCE(?, nguoi_huy),
         so_tien_hoan = COALESCE(?, so_tien_hoan)
       WHERE id = ?`,
      [trangThai,
        ghiChuNoiBo == null ? null : String(ghiChuNoiBo).trim().slice(0, 2000) || null,
        ctx.nhanVienId || null, lyDoHuyLuu, nguoiHuyLuu, soTienHoan,
        id]);

    await ghiNhatKy(conn, id, tuTrangThai, trangThai,
      ghiChuLichSu || `Chuyển trạng thái sang "${TRANG_THAI[trangThai]}"`, ctx.nhanVienId);

    await conn.commit();
    return chiTiet(id);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  KHACH_MOI_BAN, DAT_TRUOC_TOI_THIEU_NGAY, DAT_TRUOC_TOI_DA_NGAY, LOAI_TIEC, BUOI, TRANG_THAI, GIU_CHO,
  TRANG_THAI_KET_THUC, CHUYEN_TRANG_THAI, PHUONG_THUC_THANH_TOAN, TEN_PHUONG_THUC,
  LoiDatTiec, docKhongGian, docSanhTiec, docThucDon, docDichVu, lichDaKin, tinhDuToan, cong,
  docCauHinh, tinhTienCoc, tinhHoanTien,
  taoDonTiec, capNhatDon, danhSach, thongKe, chiTiet, capNhatTrangThai,
  ghiNhanThanhToan, ganNhanVien, danhSachNhanVienXuLy,
};
