/**
 * Tang QUY TAC NGHIEP VU cua module dat ban.
 *
 * File nay khong dung ban va khong ghi reservation. No chi tra loi cac cau hoi
 * "duoc hay khong duoc, bao nhieu, den bao gio":
 *
 *   - Cau hinh dang hieu luc la gi?               docCauHinh()
 *   - Mot luot an keo dai bao lau?                thoiLuongMacDinh()
 *   - Khung gio khach chon co hop le khong?       phanTichKhungGio() + kiemTra*()
 *   - Reservation nay phai coc bao nhieu?         tinhTienCoc()
 *   - Huy luc nay thi hoan lai bao nhieu?         tinhHoanTien()
 *   - Trang thai duoc phep chuyen di dau?         CHUYEN_TRANG_THAI
 *
 * Tach rieng vi ba ly do: (1) toan bo phan nay thuan tuy - test duoc khong can
 * CSDL; (2) trang cau hinh cua quan ly va tang tao reservation phai dung CHUNG
 * mot cach tinh, neu khong so tien coc bao truoc cho khach se khac so tien thu
 * that; (3) doc mot cho de biet he thong dang chay theo luat nao.
 *
 * ---------------------------------------------------------------------------
 * MUI GIO
 * ---------------------------------------------------------------------------
 * Toan bo he thong lam viec theo GIO DIA PHUONG cua may chu (Asia/Ho_Chi_Minh).
 * Khong dung Date.prototype.toISOString() de lay ngay: ham do doi sang UTC nen
 * tu 00:00 den 07:00 no tra ve ngay HOM QUA. Dung `ngayCucBo` cua utils/thoiGian.
 */
const db = require('../config/db');
const { ngayCucBo } = require('../utils/thoiGian');

/**
 * Kich thuoc o luoi chong dat trung. PHAI khop SLOT_MINUTES trong
 * config/migrations/030_dat_ban_chuyen_nghiep.js - doi mot ben ma quen ben kia
 * thi cac o cu va o moi khong con xep chong len nhau, va hang rao chong dat
 * trung thung mot lo dung bang do lech.
 */
const SLOT_MINUTES = 15;

/** Cac trang thai con "giu cho" - bàn van bi chiem. */
const TRANG_THAI_GIU_CHO = ['PENDING', 'WAITLIST', 'CONFIRMED', 'ARRIVED', 'SEATED'];

/** Cac trang thai da dong ho so. */
const TRANG_THAI_KET_THUC = ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'REJECTED'];

/**
 * May trang thai (muc 5 cua de bai).
 *
 * WAITLIST khong nam trong luong chinh: no la nhanh re khi nha hang het ban
 * (case 13). Khach vao danh sach cho, va khi co ban trong thi nhan vien day
 * sang CONFIRMED - hoac khach tu huy.
 *
 * SEATED -> COMPLETED la mot chieu: da an xong thi khong quay lai duoc. Muon
 * "mo lai" thi tao reservation moi, vi lich su phai giu duoc dau vet that.
 */
const CHUYEN_TRANG_THAI = {
  PENDING: ['CONFIRMED', 'WAITLIST', 'CANCELLED', 'REJECTED'],
  WAITLIST: ['CONFIRMED', 'CANCELLED', 'REJECTED'],
  CONFIRMED: ['ARRIVED', 'SEATED', 'CANCELLED', 'NO_SHOW'],
  ARRIVED: ['SEATED', 'CANCELLED', 'NO_SHOW'],
  SEATED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  REJECTED: [],
};

/** Nhan tieng Viet dung khi bao loi cho nguoi dung. */
const NHAN_TRANG_THAI = {
  PENDING: 'Chờ xác nhận',
  WAITLIST: 'Danh sách chờ',
  CONFIRMED: 'Đã xác nhận',
  ARRIVED: 'Khách đã đến',
  SEATED: 'Đã xếp bàn',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  NO_SHOW: 'Không đến',
  REJECTED: 'Từ chối',
};

const LOAI_KHACH = ['REGULAR', 'MEMBER', 'VIP', 'CORPORATE', 'NEW'];
const NGUON = ['ONLINE', 'STAFF', 'WALK_IN', 'PHONE', 'PARTNER'];

/**
 * Loi nghiep vu - phan biet voi loi ky thuat.
 *
 * Route bat LoiDatBan thi tra 4xx kem thong diep doc duoc cho khach; loi khac
 * thi tra 500 va giau chi tiet. Neu khong phan biet, mot loi cu phap SQL se bi
 * hien nguyen van len man hinh khach hang.
 */
class LoiDatBan extends Error {
  constructor(thongDiep, ma = 'INVALID', chiTiet = null) {
    super(thongDiep);
    this.name = 'LoiDatBan';
    this.ma = ma;
    this.chiTiet = chiTiet;
  }
}

// ------------------------------------------------------------- cau hinh

/*
  Cau hinh doc rat nhieu (moi lan kiem tra ban trong deu can) va sua rat it.
  Dem 30 giay la du de khong ban CSDL, va van du ngan de quan ly bam Luu roi
  thu lai ngay tren mot tab khac thay duoc thay doi.
*/
let demCauHinh = null;
let demHetHan = 0;
const DEM_MS = 30000;

const MAC_DINH = {
  default_duration_1_2: 90,
  default_duration_3_6: 120,
  default_duration_7_10: 150,
  default_duration_over_10: 180,
  turnaround_minutes: 15,
  // Ban dang co khach / dang don thi khong hua duoc cho luot bat dau trong
  // vong bao nhieu phut toi. Xem chu thich dau services/reservationTables.js.
  occupied_hold_minutes: 90,
  grace_period_minutes: 15,
  auto_no_show_minutes: 30,
  allow_table_combination: 1,
  combine_same_area_only: 1,
  max_tables_per_reservation: 4,
  minimum_lead_minutes: 30,
  max_advance_days: 90,
  slot_step_minutes: 15,
  auto_confirm_online: 0,
  auto_confirm_member: 1,
  deposit_due_minutes: 120,
  peak_hours: '18:00-21:00',
  large_group_threshold: 10,
  max_guests_online: 30,
  no_show_block_threshold: 3,
  allow_customer_pick_table: 1,
  last_seating_minutes: 60,
  reminder_lead_minutes: 120,
  opening_hours: '08:00-22:00',
  holidays: '[]',
};

/** Xoa dem - goi sau khi ghi cau hinh de lan doc ke tiep thay ngay gia tri moi. */
function xoaDemCauHinh() {
  demCauHinh = null;
  demHetHan = 0;
}

async function docCauHinh() {
  if (demCauHinh && Date.now() < demHetHan) return demCauHinh;
  const [rows] = await db.query('SELECT setting_key, setting_value FROM reservation_settings');
  const doc = { ...MAC_DINH };
  for (const row of rows) doc[row.setting_key] = row.setting_value;

  // Ep kieu mot lan o day thay vi Number(...) rai rac khap noi. Khoa nao co
  // mac dinh la so thi ket qua cung phai la so.
  for (const [khoa, gt] of Object.entries(MAC_DINH)) {
    if (typeof gt === 'number') {
      const so = Number(doc[khoa]);
      doc[khoa] = Number.isFinite(so) ? so : gt;
    }
  }
  demCauHinh = doc;
  demHetHan = Date.now() + DEM_MS;
  return doc;
}

// ------------------------------------------------------------ tien ich gio

const dem2 = (n) => String(n).padStart(2, '0');

/** 'HH:MM' hoac 'HH:MM:SS' -> so phut tu 00:00. Tra ve null neu khong doc duoc. */
function phutTuChuoi(gio) {
  const m = String(gio || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const p = Number(m[2]);
  if (h > 47 || p > 59) return null;
  return h * 60 + p;
}

/** So phut -> 'HH:MM:SS'. Tu dong cuon qua 24h (dung cho ca dem). */
function chuoiTuPhut(phut) {
  const p = ((phut % 1440) + 1440) % 1440;
  return `${dem2(Math.floor(p / 60))}:${dem2(p % 60)}:00`;
}

/** 'HH:MM:SS' -> 'HH:MM' de hien thi. */
function gioNgan(gio) {
  return String(gio || '').slice(0, 5);
}

/** Date -> 'YYYY-MM-DD HH:MM:SS' theo gio dia phuong (dinh dang MySQL DATETIME). */
function moc(d) {
  return `${d.getFullYear()}-${dem2(d.getMonth() + 1)}-${dem2(d.getDate())} `
    + `${dem2(d.getHours())}:${dem2(d.getMinutes())}:${dem2(d.getSeconds())}`;
}

/** Ghep ngay + gio thanh Date theo gio dia phuong. */
function ghepMoc(ngay, gio) {
  const n = String(ngay).slice(0, 10).split('-').map(Number);
  const g = String(gio).split(':').map(Number);
  return new Date(n[0], n[1] - 1, n[2], g[0] || 0, g[1] || 0, g[2] || 0);
}

/** Ngay o dang 'YYYY-MM-DD' du dau vao la Date (mysql2) hay chuoi. */
function ngayChuoi(gt) {
  if (gt instanceof Date) return ngayCucBo(gt);
  return String(gt || '').slice(0, 10);
}

/**
 * Lam tron mot moc thoi gian XUONG ve dau o luoi.
 *
 * Bat buoc phai lam tron thi hai reservation le nhau moi dam vao cung mot o.
 * Vi du o 15 phut: 19:07 va 19:14 deu thuoc o 19:00. Neu khong lam tron, mot
 * reservation 19:07-20:07 va mot 19:14-20:14 se sinh ra hai day o lech nhau
 * hoan toan va cung dat duoc cung mot ban.
 */
function troVeDauO(d) {
  const r = new Date(d.getTime());
  r.setSeconds(0, 0);
  r.setMinutes(Math.floor(r.getMinutes() / SLOT_MINUTES) * SLOT_MINUTES);
  return r;
}

/**
 * Day o luoi ma mot luot dat chiem, tinh ca thoi gian don ban.
 *
 * Vi sao cong them `demDon` (turnaround): ban 19:00-21:00 khong the giao ngay
 * cho khach 21:00 - con phai don, lau ban, set do. Khong cong dem thi he thong
 * hua duoc mot dieu nha hang khong lam duoc (case 22 cua de bai).
 */
function dayO(ngay, gioBatDau, gioKetThuc, demDon = 0) {
  const batDau = troVeDauO(ghepMoc(ngay, gioBatDau));
  let ketThuc = ghepMoc(ngay, gioKetThuc);
  // Gio ket thuc <= gio bat dau nghia la da qua nua dem.
  if (ketThuc <= ghepMoc(ngay, gioBatDau)) ketThuc.setDate(ketThuc.getDate() + 1);
  ketThuc = new Date(ketThuc.getTime() + Number(demDon || 0) * 60000);

  const ds = [];
  for (let t = batDau.getTime(); t < ketThuc.getTime(); t += SLOT_MINUTES * 60000) {
    ds.push(moc(new Date(t)));
    // Chan an toan: 480 phut toi da + dem, chia 15 = 34 o. Vong lap khong bao
    // gio duoc phep chay xa hon the du du lieu co hong the nao.
    if (ds.length > 64) break;
  }
  return ds;
}

// -------------------------------------------------------- kiem tra dau vao

/**
 * Chuan hoa so dien thoai ve dang chi chu so.
 *
 * Ho so khach (`reservation_customers`) lay so dien thoai lam khoa chinh, nen
 * '0918 484 042' va '0918484042' phai ra cung mot khoa - neu khong, bo dem
 * no-show cua mot nguoi se bi chia doi va canh bao khong bao gio bat.
 */
function chuanHoaDienThoai(raw) {
  const so = String(raw || '').replace(/[^\d+]/g, '');
  if (so.startsWith('+84')) return `0${so.slice(3)}`;
  if (so.startsWith('84') && so.length >= 10) return `0${so.slice(2)}`;
  return so;
}

function thoiLuongMacDinh(soKhach, ch = MAC_DINH) {
  const n = Number(soKhach) || 1;
  if (n <= 2) return Number(ch.default_duration_1_2);
  if (n <= 6) return Number(ch.default_duration_3_6);
  if (n <= 10) return Number(ch.default_duration_7_10);
  return Number(ch.default_duration_over_10);
}

/**
 * Doc ngay + gio + thoi luong khach gui len thanh mot khung gio chuan.
 *
 * Chua kiem tra gio mo cua va bàn trong - do la viec cua cac ham kiemTra* phia
 * duoi. O day chi lo dung dinh dang va tinh gio ket thuc.
 */
function phanTichKhungGio(input, ch = MAC_DINH) {
  const ngay = ngayChuoi(input.reservation_date);
  const gio = String(input.start_time || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) throw new LoiDatBan('Ngày đặt bàn không hợp lệ', 'BAD_DATE');
  const phutBatDau = phutTuChuoi(gio);
  if (phutBatDau === null || phutBatDau >= 1440) throw new LoiDatBan('Giờ đặt bàn không hợp lệ', 'BAD_TIME');

  const soKhach = Number(input.guest_count);
  const thoiLuong = input.duration_minutes
    ? Number(input.duration_minutes)
    : thoiLuongMacDinh(soKhach, ch);
  if (!Number.isInteger(thoiLuong) || thoiLuong < 30 || thoiLuong > 480) {
    throw new LoiDatBan('Thời lượng sử dụng bàn phải từ 30 đến 480 phút', 'BAD_DURATION');
  }

  return {
    ngay,
    batDau: chuoiTuPhut(phutBatDau),
    ketThuc: chuoiTuPhut(phutBatDau + thoiLuong),
    thoiLuong,
    demDon: Number(ch.turnaround_minutes) || 0,
    /** Moc bat dau dang Date - dung de so sanh voi hien tai. */
    mocBatDau: ghepMoc(ngay, chuoiTuPhut(phutBatDau)),
  };
}

/**
 * Kiem tra thong tin khach hang va so luong.
 *
 * `soKhachToiDa` la tran RIENG cho kenh online: nhom 60 nguoi khong phai viec
 * mot form web tu quyet duoc, phai co nguoi goi dien thoa thuan. Nhan vien tao
 * ho khach thi khong bi tran nay.
 */
function kiemTraThongTinKhach(input, ch = MAC_DINH, { laOnline = false } = {}) {
  const ten = String(input.customer_name || '').trim();
  if (ten.length < 2) throw new LoiDatBan('Vui lòng nhập họ tên khách hàng', 'BAD_NAME');
  if (ten.length > 150) throw new LoiDatBan('Họ tên quá dài', 'BAD_NAME');

  const dienThoai = chuanHoaDienThoai(input.phone);
  // 8-15 chu so: du cho so co dinh 8 so trong nuoc lan so quoc te.
  if (!/^\d{8,15}$/.test(dienThoai)) throw new LoiDatBan('Số điện thoại không hợp lệ', 'BAD_PHONE');

  const email = String(input.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new LoiDatBan('Email không hợp lệ', 'BAD_EMAIL');
  }

  const soKhach = Number(input.guest_count);
  if (!Number.isInteger(soKhach) || soKhach < 1) throw new LoiDatBan('Số khách phải lớn hơn 0', 'BAD_GUESTS');
  if (soKhach > 500) throw new LoiDatBan('Số khách vượt quá sức chứa nhà hàng', 'BAD_GUESTS');
  if (laOnline && soKhach > Number(ch.max_guests_online)) {
    throw new LoiDatBan(
      `Đặt bàn trực tuyến hỗ trợ tối đa ${ch.max_guests_online} khách. `
      + 'Với đoàn đông hơn, vui lòng gọi trực tiếp để nhà hàng sắp xếp.', 'TOO_MANY_ONLINE');
  }

  const loai = String(input.customer_type || 'REGULAR').toUpperCase();
  const nguon = String(input.source || 'ONLINE').toUpperCase();

  return {
    ten,
    dienThoai,
    email: email || null,
    soKhach,
    loaiKhach: LOAI_KHACH.includes(loai) ? loai : 'REGULAR',
    nguon: NGUON.includes(nguon) ? nguon : 'ONLINE',
  };
}

/**
 * Thoi gian toi thieu tinh tu bay gio den gio dat (case 4 - dat sat gio).
 *
 * `boQua` danh cho nhan vien: khach dang dung truoc quay luc 18:30 hoi ban
 * 18:45 thi nguoi that quyet duoc, he thong khong nen chan. Kenh online thi
 * KHONG duoc bo qua.
 */
function kiemTraDatSatGio(khung, ch, { boQua = false } = {}) {
  if (boQua) return;
  const toiThieu = Number(ch.minimum_lead_minutes) || 0;
  const somNhat = new Date(Date.now() + toiThieu * 60000);
  if (khung.mocBatDau < somNhat) {
    throw new LoiDatBan(
      `Vui lòng đặt trước ít nhất ${toiThieu} phút để nhà hàng kịp chuẩn bị bàn. `
      + 'Nếu bạn đang trên đường tới, hãy gọi trực tiếp cho nhà hàng.', 'TOO_SOON');
  }
}

/** Khong cho dat qua xa - giu lich co the quan ly duoc (mac dinh 90 ngay). */
function kiemTraDatQuaXa(khung, ch) {
  const toiDa = Number(ch.max_advance_days) || 90;
  const han = new Date();
  han.setHours(23, 59, 59, 999);
  han.setDate(han.getDate() + toiDa);
  if (khung.mocBatDau > han) {
    throw new LoiDatBan(`Chỉ nhận đặt bàn trước tối đa ${toiDa} ngày`, 'TOO_FAR');
  }
}

/**
 * Khong cho dat vao qua khu. Tach rieng khoi kiemTraDatSatGio de nhan vien cung bi chan.
 *
 * `luiToiDaPhut` la khoang qua khu VAN chap nhan duoc:
 *
 *   1 phut  (mac dinh)  chi de bu chenh lech dong ho giua trinh duyet va may chu.
 *   60 phut (walk-in)   khach vang lai la nguoi DANG DUNG TRUOC MAT. Gio bat dau
 *                       cua ho duoc lam tron xuong dau o luoi de xep dung luoi voi
 *                       cac luot dat truoc, nen 10:07 thanh 10:00 - da la qua khu
 *                       ngay khi vua tao. Va nhan vien thuong nhap sau khi da dan
 *                       khach vao ban xong, tuc luon tre vai phut den nua tieng.
 *                       Chan cai do la chan dung nghiep vu that.
 */
function kiemTraQuaKhu(khung, { luiToiDaPhut = 1 } = {}) {
  if (khung.mocBatDau.getTime() < Date.now() - luiToiDaPhut * 60000) {
    throw new LoiDatBan('Không thể đặt bàn cho thời điểm đã qua', 'IN_PAST');
  }
}

/**
 * Doc lich mo cua cua mot ngay cu the.
 *
 * Uu tien bang `reservation_opening_hours` (theo thu). Bang rong thi lui ve
 * khoa cu `opening_hours` de he thong da cai dat truoc do van chay.
 */
async function lichMoCua(ngay, chiNhanhId = null) {
  const ch = await docCauHinh();
  const thu = ghepMoc(ngay, '00:00:00').getDay();

  const [dong] = await db.query(
    `SELECT reason FROM reservation_closed_dates
      WHERE closed_date = ? AND (branch_id = ? OR branch_id IS NULL) LIMIT 1`, [ngay, chiNhanhId]);
  if (dong.length) {
    return { dong: true, lyDo: dong[0].reason || 'Nhà hàng nghỉ trong ngày này' };
  }

  // Khoa cu `holidays` la mang JSON cac ngay nghi - van ton trong.
  let ngayNghi = [];
  try { ngayNghi = JSON.parse(ch.holidays || '[]'); } catch (e) { ngayNghi = []; }
  if (Array.isArray(ngayNghi) && ngayNghi.includes(ngay)) {
    return { dong: true, lyDo: 'Nhà hàng nghỉ trong ngày này' };
  }

  const [rows] = await db.query(
    `SELECT open_time, close_time, is_closed FROM reservation_opening_hours
      WHERE weekday = ? AND (branch_id = ? OR branch_id IS NULL)
      ORDER BY branch_id IS NULL LIMIT 1`, [thu, chiNhanhId]);

  if (rows.length) {
    if (rows[0].is_closed) return { dong: true, lyDo: 'Nhà hàng nghỉ vào ngày này trong tuần' };
    return { dong: false, mo: String(rows[0].open_time), dong_cua: String(rows[0].close_time) };
  }

  const m = String(ch.opening_hours || '').match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
  if (!m) throw new LoiDatBan('Cấu hình giờ mở cửa không hợp lệ', 'BAD_CONFIG');
  return { dong: false, mo: `${m[1]}:00`, dong_cua: `${m[2]}:00` };
}

/**
 * Khung gio phai nam tron trong gio mo cua, va con phai chua het `last_seating`.
 *
 * `last_seating_minutes`: khong nhan luot dat moi trong N phut cuoi truoc khi
 * dong cua. Nha hang dong 22:00 ma van nhan ban 21:50 thi khach chi duoc ngoi
 * 10 phut - nhan don do la lam kho ca hai ben.
 */
async function kiemTraGioMoCua(khung, chiNhanhId = null) {
  const ch = await docCauHinh();
  const lich = await lichMoCua(khung.ngay, chiNhanhId);
  if (lich.dong) throw new LoiDatBan(lich.lyDo, 'CLOSED');

  const mo = phutTuChuoi(lich.mo);
  let dong = phutTuChuoi(lich.dong_cua);
  // Dong cua sau nua dem (vi du 02:00) -> cong 24h de so sanh duoc.
  if (dong <= mo) dong += 1440;

  const batDau = phutTuChuoi(khung.batDau);
  const ketThuc = batDau + khung.thoiLuong;
  const chotNhan = dong - (Number(ch.last_seating_minutes) || 0);

  if (batDau < mo || batDau > chotNhan) {
    throw new LoiDatBan(
      `Nhà hàng nhận đặt bàn từ ${gioNgan(lich.mo)} đến ${gioNgan(chuoiTuPhut(chotNhan))}. `
      + 'Vui lòng chọn khung giờ khác.', 'OUTSIDE_HOURS');
  }
  if (ketThuc > dong) {
    throw new LoiDatBan(
      `Với ${khung.thoiLuong} phút sử dụng bàn, lượt đặt sẽ kết thúc lúc `
      + `${gioNgan(chuoiTuPhut(ketThuc))} — sau giờ đóng cửa ${gioNgan(lich.dong_cua)}.`, 'OUTSIDE_HOURS');
  }
  return lich;
}

// -------------------------------------------------------------- tien coc

function laGioCaoDiem(gio, ch) {
  const m = String(ch.peak_hours || '').match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
  if (!m) return false;
  const p = phutTuChuoi(gio);
  return p >= phutTuChuoi(m[1]) && p < phutTuChuoi(m[2]);
}

/**
 * Tinh tien coc theo bo quy tac trong CSDL (muc 10).
 *
 * Chon MOT quy tac - quy tac hop le co `priority` nho nhat - chu khong cong don
 * nhieu quy tac. Khach doc duoc mot dong ly do ro rang ("Nhóm đông từ 10 khách:
 * 100.000đ/khách") thay vi mot con so tu tren troi roi xuong.
 *
 * Tra ve { soTien, quyTac, lyDo }. soTien = 0 nghia la khong yeu cau coc.
 */
async function tinhTienCoc({ soKhach, gioBatDau, loaiKhach }) {
  const ch = await docCauHinh();
  const [rows] = await db.query(
    'SELECT * FROM reservation_deposit_rules WHERE is_active = 1 ORDER BY priority ASC, id ASC');

  const nguong = Number(ch.large_group_threshold) || 10;
  const caoDiem = laGioCaoDiem(gioBatDau, ch);

  for (const qt of rows) {
    if (soKhach < Number(qt.min_guests)) continue;

    const hop = {
      ALL: true,
      VIP: loaiKhach === 'VIP',
      MEMBER: loaiKhach === 'MEMBER',
      CORPORATE: loaiKhach === 'CORPORATE',
      LARGE_GROUP: soKhach >= nguong,
      PEAK_HOUR: caoDiem,
    }[qt.applies_to];
    if (!hop) continue;

    // Quy tac co khung gio rieng thi phai roi dung khung do.
    if (qt.from_time && qt.to_time) {
      const p = phutTuChuoi(gioBatDau);
      if (p < phutTuChuoi(String(qt.from_time)) || p >= phutTuChuoi(String(qt.to_time))) continue;
    }

    if (qt.amount_type === 'NONE') return { soTien: 0, quyTac: qt.name, lyDo: 'Không yêu cầu đặt cọc' };
    const soTien = qt.amount_type === 'PER_GUEST'
      ? Number(qt.amount) * soKhach
      : Number(qt.amount);
    return {
      soTien: Math.round(soTien),
      quyTac: qt.name,
      lyDo: qt.amount_type === 'PER_GUEST'
        ? `${qt.name}: ${Number(qt.amount).toLocaleString('vi-VN')}đ × ${soKhach} khách`
        : `${qt.name}: ${Number(qt.amount).toLocaleString('vi-VN')}đ`,
    };
  }
  return { soTien: 0, quyTac: null, lyDo: 'Không yêu cầu đặt cọc' };
}

/**
 * Chinh sach hoan tien khi huy (muc 11).
 *
 * Quy tac: lay chinh sach co `hours_before` LON NHAT ma khach van con dap ung.
 * Huy truoc 30 gio thi thoa ca ba moc 24/6/2 -> lay moc 24 gio, hoan 100%.
 * Huy truoc 3 gio thi chi thoa moc 2 gio -> hoan 0%.
 *
 * `applies_to` cho phep uu dai rieng: chinh sach 'VIP' chi ap cho khach VIP,
 * va duoc uu tien hon chinh sach 'ALL' cung moc gio.
 */
async function tinhHoanTien({ mocBatDau, soTienCoc, loaiKhach, soKhach, laCaoDiem, luc = new Date() }) {
  const tien = Number(soTienCoc) || 0;
  if (tien <= 0) return { phanTram: 0, soTien: 0, chinhSach: null, moTa: 'Lượt đặt này không có tiền cọc' };

  const ch = await docCauHinh();
  const gioConLai = (new Date(mocBatDau).getTime() - new Date(luc).getTime()) / 3600000;
  const nguong = Number(ch.large_group_threshold) || 10;

  const [rows] = await db.query(
    'SELECT * FROM cancellation_policies WHERE is_active = 1 ORDER BY hours_before DESC');

  const apDuoc = (cs) => ({
    ALL: true,
    VIP: loaiKhach === 'VIP',
    LARGE_GROUP: Number(soKhach) >= nguong,
    PEAK_HOUR: !!laCaoDiem,
  }[cs.applies_to] ?? false);

  // Cung mot moc gio: chinh sach chuyen biet (VIP/LARGE_GROUP/PEAK_HOUR) thang
  // chinh sach ALL, vi no la uu dai duoc dat ra co chu dich cho nhom do.
  const ungVien = rows
    .filter((cs) => gioConLai >= Number(cs.hours_before) && apDuoc(cs))
    .sort((a, b) => Number(b.hours_before) - Number(a.hours_before)
      || (a.applies_to === 'ALL' ? 1 : 0) - (b.applies_to === 'ALL' ? 1 : 0));

  if (!ungVien.length) {
    return {
      phanTram: 0,
      soTien: 0,
      chinhSach: null,
      moTa: 'Hủy sát giờ — theo chính sách nhà hàng, tiền cọc không được hoàn lại',
    };
  }
  const cs = ungVien[0];
  const phanTram = Number(cs.refund_percent);
  return {
    phanTram,
    soTien: Math.round((tien * phanTram) / 100),
    chinhSach: cs.name,
    moTa: `${cs.name} — hoàn ${phanTram}% của ${tien.toLocaleString('vi-VN')}đ`,
  };
}

/** No-show thi khong hoan - quy tac cung, khong phu thuoc bang chinh sach (muc 11). */
function hoanTienKhiNoShow(soTienCoc) {
  return {
    phanTram: 0,
    soTien: 0,
    chinhSach: 'Không đến (no-show)',
    moTa: Number(soTienCoc) > 0
      ? 'Khách không đến — tiền cọc không được hoàn lại'
      : 'Lượt đặt này không có tiền cọc',
  };
}

// ----------------------------------------------------------------- khac

/**
 * Ma reservation cho khach doc/doc qua dien thoai.
 *
 * Dang: RSV-YYMMDD-XXXX. Co ngay ben trong de nhan vien nhin ma la biet ngay
 * nao, va bon ky tu ngau nhien lay tu bang chu KHONG co I, O, 0, 1 - bon ky tu
 * hay bi doc nham nhat khi khach doc ma qua dien thoai.
 */
const BANG_CHU = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function taoMa(ngay = ngayCucBo()) {
  const phan = ngay.slice(2).replace(/-/g, '');
  let duoi = '';
  for (let i = 0; i < 4; i += 1) duoi += BANG_CHU[Math.floor(Math.random() * BANG_CHU.length)];
  return `RSV-${phan}-${duoi}`;
}

/** Kiem tra mot buoc chuyen trang thai co hop le khong. */
function chuyenDuoc(tu, den) {
  return Array.isArray(CHUYEN_TRANG_THAI[tu]) && CHUYEN_TRANG_THAI[tu].includes(den);
}

/** Nem loi doc duoc thay vi tra ve false - dung o tang service. */
function batBuocChuyenDuoc(tu, den) {
  if (!CHUYEN_TRANG_THAI[den]) throw new LoiDatBan(`Trạng thái "${den}" không tồn tại`, 'BAD_STATUS');
  if (!chuyenDuoc(tu, den)) {
    throw new LoiDatBan(
      `Không thể chuyển từ "${NHAN_TRANG_THAI[tu] || tu}" sang "${NHAN_TRANG_THAI[den] || den}"`,
      'BAD_TRANSITION');
  }
}

/**
 * Chuan hoa mang the yeu cau dac biet.
 *
 * Chi giu ma nam trong danh muc: chuoi tu do di thang vao cot JSON roi duoc in
 * ra man hinh bep la mot duong XSS, va cung lam bao cao "mon dip nao ban chay"
 * khong gom nhom duoc.
 */
async function chuanHoaThe(dsThe) {
  const ds = Array.isArray(dsThe) ? dsThe : String(dsThe || '').split(',');
  const ma = ds.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean);
  if (!ma.length) return [];
  const [rows] = await db.query(
    'SELECT code FROM reservation_tag_catalog WHERE is_active = 1 AND code IN (?)', [ma]);
  return rows.map((r) => r.code);
}

module.exports = {
  SLOT_MINUTES,
  TRANG_THAI_GIU_CHO,
  TRANG_THAI_KET_THUC,
  CHUYEN_TRANG_THAI,
  NHAN_TRANG_THAI,
  LOAI_KHACH,
  NGUON,
  LoiDatBan,

  docCauHinh,
  xoaDemCauHinh,

  phutTuChuoi,
  chuoiTuPhut,
  gioNgan,
  moc,
  ghepMoc,
  ngayChuoi,
  troVeDauO,
  dayO,

  chuanHoaDienThoai,
  thoiLuongMacDinh,
  phanTichKhungGio,
  kiemTraThongTinKhach,
  kiemTraDatSatGio,
  kiemTraDatQuaXa,
  kiemTraQuaKhu,
  lichMoCua,
  kiemTraGioMoCua,

  laGioCaoDiem,
  tinhTienCoc,
  tinhHoanTien,
  hoanTienKhiNoShow,

  taoMa,
  chuyenDuoc,
  batBuocChuyenDuoc,
  chuanHoaThe,
};
