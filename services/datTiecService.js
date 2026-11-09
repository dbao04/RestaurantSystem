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

class LoiDatTiec extends Error {
  constructor(message, ma = 'INVALID') { super(message); this.name = 'LoiDatTiec'; this.ma = ma; }
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
    `SELECT khu_vuc_id, DATE_FORMAT(ngay_to_chuc, '%Y-%m-%d') AS ngay, buoi
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

async function taoDonTiec(body, { customerId = null } = {}) {
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
  if (ngay < cong(homNay, DAT_TRUOC_TOI_THIEU_NGAY)) {
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
  if (kin.some((k) => Number(k.khu_vuc_id) === khuVucId && k.buoi === buoi)) {
    throw new LoiDatTiec(`${sanh.ten} đã có tiệc vào ${BUOI[buoi].ten.toLowerCase()} ngày này. Vui lòng chọn buổi hoặc ngày khác.`, 'CONFLICT');
  }

  const dt = tinhDuToan({ thucDon, dsDichVu: await docDichVu(), soKhach, chonDichVu });
  const ma = taoMa();
  const [kq] = await db.query(
    `INSERT INTO dat_tiec (ma_tiec, customer_id, ho_ten, so_dien_thoai, email, loai_tiec, ten_nhan_vat,
                           ngay_to_chuc, buoi, gio_bat_dau, so_khach, so_ban, khu_vuc_id, thuc_don_id,
                           dich_vu, tien_thuc_don, tien_dich_vu, tong_du_toan, ghi_chu)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [ma, customerId, hoTen, soDienThoai, email, loai, String(body.ten_nhan_vat || '').trim().slice(0, 150) || null,
      ngay, buoi, gio, soKhach, dt.soBan, khuVucId, thucDonId, JSON.stringify(dt.dichVu),
      dt.tienThucDon, dt.tienDichVu, dt.tong, String(body.ghi_chu || '').trim().slice(0, 2000) || null]);

  return {
    id: kq.insertId, ma, so_ban: dt.soBan, tong_du_toan: dt.tong,
    sanh: sanh.ten, thuc_don: thucDon.ten, ngay, buoi: BUOI[buoi].ten, gio,
  };
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
            v.Name_vitri AS ten_sanh, d.ten AS ten_thuc_don, d.gia_ban
       FROM dat_tiec t
       LEFT JOIN vitri v ON v.id_vitri = t.khu_vuc_id
       LEFT JOIN thuc_don_tiec d ON d.id = t.thuc_don_id
      ${dk.length ? 'WHERE ' + dk.join(' AND ') : ''}
      ORDER BY FIELD(t.trang_thai, 'MOI', 'DA_LIEN_HE', 'DA_XAC_NHAN', 'DA_COC', 'HOAN_THANH', 'HUY'),
               t.ngay_to_chuc, t.id DESC
      LIMIT 500`, ts);
  return rows.map((r) => ({
    ...r,
    dich_vu: docJson(r.dich_vu, []),
    tong_du_toan: Number(r.tong_du_toan), tien_thuc_don: Number(r.tien_thuc_don), tien_dich_vu: Number(r.tien_dich_vu),
    ten_loai: (LOAI_TIEC[r.loai_tiec] || {}).ten || r.loai_tiec,
    ten_buoi: (BUOI[r.buoi] || {}).ten || r.buoi,
    ten_trang_thai: TRANG_THAI[r.trang_thai] || r.trang_thai,
  }));
}

async function thongKe() {
  const [rows] = await db.query('SELECT trang_thai, COUNT(*) AS so FROM dat_tiec GROUP BY trang_thai');
  const kq = Object.fromEntries(Object.keys(TRANG_THAI).map((k) => [k, 0]));
  for (const r of rows) kq[r.trang_thai] = Number(r.so);
  return kq;
}

/*
 * VONG DOI DON TIEC
 *
 *   MOI -> DA_LIEN_HE -> DA_XAC_NHAN -> DA_COC -> HOAN_THANH
 *     \________\______________\___________\-----> HUY
 *   (DA_XAC_NHAN -> HOAN_THANH duoc: tiec tra du mot lan cuoi buoi)
 *
 * Truoc day trang thai nhay tu do (HUY -> HOAN_THANH...) va "Da dat coc" chi
 * la nhan: khong ghi tien. Nay cac buoc co tien sinh khoan thu THAT trong
 * `payments` (sesis = ma tiec, processed_by = nguoi thu) nen tu vao bien ban
 * chot ca thu ngan va lich su thanh toan:
 *   - DA_COC     : thu coc >= TY_LE_COC du toan          (loai 'dat_coc')
 *   - HOAN_THANH : nhap tong thuc te, thu phan con lai    (loai 'thanh_toan')
 *   - HUY        : bat buoc ly do; da coc thi mac dinh GIU coc, Quan ly co
 *                  the chon hoan coc (thanhToanService.hoanTien).
 */
const TY_LE_COC = 0.3;
const CHUYEN_TIEC = {
  MOI: ['DA_LIEN_HE', 'DA_XAC_NHAN', 'HUY'],
  DA_LIEN_HE: ['DA_XAC_NHAN', 'HUY'],
  DA_XAC_NHAN: ['DA_COC', 'HOAN_THANH', 'HUY'],
  DA_COC: ['HOAN_THANH', 'HUY'],
  HOAN_THANH: [],
  HUY: [],
};
const PHUONG_THUC_TIEC = { tien_mat: 'Tiền mặt', vietqr: 'Chuyển khoản', the: 'Thẻ' };

let daCoCotTien = false;
async function damBaoCotTien() {
  if (daCoCotTien) return;
  const cot = [
    ['tien_coc', "DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT 'Tien coc da thu'"],
    ['da_thu', "DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT 'Tong da thu (coc + thanh toan), tru phan da hoan'"],
    ['tong_thuc_te', "DECIMAL(14,2) NULL COMMENT 'Tong hoa don thuc te khi hoan thanh'"],
    ['ly_do_huy', 'VARCHAR(255) NULL'],
  ];
  for (const [ten, kieu] of cot) {
    const [r] = await db.query(
      'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      ['dat_tiec', ten]);
    if (!r.length) await db.query(`ALTER TABLE dat_tiec ADD COLUMN ${ten} ${kieu}`);
  }
  daCoCotTien = true;
}

async function ghiKhoanThu(conn, { maTiec, soTien, phuongThuc, loai, nhanVienId, ghiChu }) {
  const [[pt]] = await conn.query('SELECT id FROM payment_methods WHERE code = ? LIMIT 1', [phuongThuc]);
  if (!pt) throw new LoiDatTiec('Phương thức thanh toán không hợp lệ.');
  const [kq] = await conn.query(
    `INSERT INTO payments (sesis, amount, payment_method_id, status, loai, nguon, processed_by, thanh_cong_luc, notes)
     VALUES (?, ?, ?, 'success', ?, 'quay', ?, NOW(), ?)`,
    [maTiec, soTien, pt.id, loai, nhanVienId || null, ghiChu]);
  return kq.insertId;
}

/**
 * @param {number} id
 * @param {object} o
 * @param {string} o.trangThai
 * @param {string} [o.ghiChuNoiBo]
 * @param {number} [o.soTien]        tien coc (DA_COC)
 * @param {number} [o.tongThucTe]    tong hoa don thuc te (HOAN_THANH)
 * @param {string} [o.phuongThuc]    tien_mat | vietqr | the
 * @param {string} [o.lyDoHuy]
 * @param {boolean} [o.hoanCoc]      HUY: hoan lai tien coc (chi Quan ly)
 * @param {{id, coQuyenThuTien, laQuanLy}} nhanVien
 */
async function capNhatTrangThai(id, o, nhanVien = {}) {
  await damBaoCotTien();
  const { trangThai } = o;
  if (!TRANG_THAI[trangThai]) throw new LoiDatTiec('Trạng thái không hợp lệ.');
  const ghiChuNoiBo = o.ghiChuNoiBo == null ? null : String(o.ghiChuNoiBo).slice(0, 2000);
  const nvId = nhanVien.id || null;

  const conn = await db.getConnection();
  let canHoanCoc = null;
  try {
    await conn.beginTransaction();
    const [[don]] = await conn.query('SELECT * FROM dat_tiec WHERE id = ? FOR UPDATE', [id]);
    if (!don) throw new LoiDatTiec('Không tìm thấy đơn tiệc.', 'NOT_FOUND');

    // Chi luu ghi chu, khong doi trang thai.
    if (trangThai === don.trang_thai) {
      await conn.query(
        'UPDATE dat_tiec SET ghi_chu_noi_bo = COALESCE(?, ghi_chu_noi_bo), nhan_vien_xu_ly = COALESCE(?, nhan_vien_xu_ly) WHERE id = ?',
        [ghiChuNoiBo, nvId, id]);
      await conn.commit();
      return { ok: true, da_hoan: 0 };
    }
    if (!(CHUYEN_TIEC[don.trang_thai] || []).includes(trangThai)) {
      throw new LoiDatTiec(`Không chuyển được từ "${TRANG_THAI[don.trang_thai]}" sang "${TRANG_THAI[trangThai]}".`);
    }

    if (GIU_CHO.includes(trangThai) && !GIU_CHO.includes(don.trang_thai)) {
      const [[trung]] = await conn.query(
        `SELECT ma_tiec FROM dat_tiec
          WHERE id <> ? AND khu_vuc_id = ? AND ngay_to_chuc = ? AND buoi = ? AND trang_thai IN (?) LIMIT 1`,
        [id, don.khu_vuc_id, don.ngay_to_chuc, don.buoi, GIU_CHO]);
      if (trung) throw new LoiDatTiec(`Sảnh đã được giữ cho tiệc ${trung.ma_tiec} cùng buổi. Không thể xác nhận trùng lịch.`, 'CONFLICT');
    }

    const duToan = Number(don.tong_du_toan) || 0;
    const daThu = Number(don.da_thu) || 0;
    const dat = ['trang_thai = ?'];
    const bien = [trangThai];
    const canThuTien = () => {
      if (!nhanVien.coQuyenThuTien) throw new LoiDatTiec('Chỉ Lễ tân, Thu ngân hoặc Quản lý được thu tiền tiệc.', 'FORBIDDEN');
      if (!PHUONG_THUC_TIEC[o.phuongThuc]) throw new LoiDatTiec('Chọn phương thức thanh toán.');
    };

    if (trangThai === 'DA_COC') {
      canThuTien();
      const soTien = Math.round(Number(o.soTien));
      const toiThieu = Math.ceil(duToan * TY_LE_COC);
      if (!Number.isFinite(soTien) || soTien < toiThieu || soTien > duToan) {
        throw new LoiDatTiec(`Tiền cọc phải từ ${toiThieu.toLocaleString('vi-VN')}đ (${TY_LE_COC * 100}% dự toán) đến ${duToan.toLocaleString('vi-VN')}đ.`);
      }
      await ghiKhoanThu(conn, {
        maTiec: don.ma_tiec, soTien, phuongThuc: o.phuongThuc, loai: 'dat_coc', nhanVienId: nvId,
        ghiChu: `Cọc tiệc ${don.ma_tiec} - ${don.ho_ten}`,
      });
      dat.push('tien_coc = tien_coc + ?', 'da_thu = da_thu + ?');
      bien.push(soTien, soTien);
    }

    if (trangThai === 'HOAN_THANH') {
      const tong = o.tongThucTe == null || o.tongThucTe === '' ? duToan : Math.round(Number(o.tongThucTe));
      if (!Number.isFinite(tong) || tong <= 0) throw new LoiDatTiec('Tổng hóa đơn thực tế không hợp lệ.');
      const conLai = tong - daThu;
      if (conLai < 0) {
        throw new LoiDatTiec(`Tổng thực tế (${tong.toLocaleString('vi-VN')}đ) nhỏ hơn số đã thu (${daThu.toLocaleString('vi-VN')}đ). Hãy hoàn phần chênh cho khách trước.`);
      }
      if (conLai > 0) {
        canThuTien();
        await ghiKhoanThu(conn, {
          maTiec: don.ma_tiec, soTien: conLai, phuongThuc: o.phuongThuc, loai: 'thanh_toan', nhanVienId: nvId,
          ghiChu: `Thanh toán tiệc ${don.ma_tiec} - ${don.ho_ten}`,
        });
      }
      dat.push('tong_thuc_te = ?', 'da_thu = da_thu + ?');
      bien.push(tong, conLai);
    }

    if (trangThai === 'HUY') {
      const lyDo = String(o.lyDoHuy || '').trim().slice(0, 255);
      if (lyDo.length < 3) throw new LoiDatTiec('Phải ghi lý do hủy tiệc.');
      dat.push('ly_do_huy = ?');
      bien.push(lyDo);
      if (o.hoanCoc && daThu > 0) {
        if (!nhanVien.laQuanLy) throw new LoiDatTiec('Hoàn cọc tiệc cần Quản lý thực hiện.', 'FORBIDDEN');
        canHoanCoc = { maTiec: don.ma_tiec, lyDo };
      }
    }

    dat.push('ghi_chu_noi_bo = COALESCE(?, ghi_chu_noi_bo)', 'nhan_vien_xu_ly = COALESCE(?, nhan_vien_xu_ly)');
    bien.push(ghiChuNoiBo, nvId, id);
    await conn.query(`UPDATE dat_tiec SET ${dat.join(', ')} WHERE id = ?`, bien);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // Hoan coc sau khi da chot trang thai HUY: dung chung quy tac hoan tien
  // (khoa chong hoan hai lan, tra luot ma, nhat ky). Coc tiec thu truoc ca
  // thang nen bo qua han 72 gio cua hoan tien tai quay.
  let daHoan = 0;
  if (canHoanCoc) {
    const tt = require('./thanhToanService');
    const [ps] = await db.query(
      "SELECT id, amount FROM payments WHERE sesis = ? AND status = 'success' ORDER BY id", [canHoanCoc.maTiec]);
    for (const p of ps) {
      await tt.hoanTien(p.id, { lyDo: 'Hoàn cọc tiệc hủy: ' + canHoanCoc.lyDo, nhanVienId: nvId, boQuaHan: true });
      daHoan += Number(p.amount) || 0;
    }
    await db.query('UPDATE dat_tiec SET da_thu = GREATEST(da_thu - ?, 0) WHERE id = ?', [daHoan, id]);
  }
  return { ok: true, da_hoan: daHoan };
}

module.exports = {
  KHACH_MOI_BAN, DAT_TRUOC_TOI_THIEU_NGAY, DAT_TRUOC_TOI_DA_NGAY, LOAI_TIEC, BUOI, TRANG_THAI, GIU_CHO,
  CHUYEN_TIEC, PHUONG_THUC_TIEC, TY_LE_COC, damBaoCotTien,
  LoiDatTiec, docKhongGian, docSanhTiec, docThucDon, docDichVu, lichDaKin, tinhDuToan, cong,
  taoDonTiec, danhSach, thongKe, capNhatTrangThai,
};
