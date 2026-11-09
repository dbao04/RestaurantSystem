/**
 * Chan do mat khau o cac trang dang nhap (khach, nhan vien, admin).
 *
 * Truoc day dang nhap khong gioi han: thu mat khau lien tuc bao nhieu lan cung
 * duoc - nhat la khi mat khau mac dinh cua khach tao tu dong la '123456'.
 *
 * Quy tac (chi dem lan dang nhap SAI, dang nhap dung thi xoa dem):
 *   - Cung IP + cung tai khoan: sai 5 lan trong 15 phut -> khoa 15 phut.
 *   - Cung IP, moi tai khoan cong lai: sai 30 lan trong 15 phut -> khoa IP do,
 *     de khong do lan luot tung so dien thoai duoc.
 *
 * Luu trong bo nho tien trinh: he thong chay mot tien trinh Node (giong gioi
 * han dat mon QR trong server.js). Khoi dong lai server thi dem lai tu dau.
 */
const CUA_SO_MS = 15 * 60 * 1000;
const TOI_DA_MOI_TAI_KHOAN = 5;
const TOI_DA_MOI_IP = 30;

const nhatKy = new Map(); // khoa -> [moc thoi gian that bai]

function conHan(khoa, bayGio) {
  const ds = (nhatKy.get(khoa) || []).filter((t) => bayGio - t < CUA_SO_MS);
  if (ds.length) nhatKy.set(khoa, ds); else nhatKy.delete(khoa);
  return ds;
}

function khoaCua(req, kenh, taiKhoan) {
  const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'khong-ro';
  const tk = String(taiKhoan || '').trim().toLowerCase().slice(0, 100);
  return { theoTk: `${kenh}|${ip}|${tk}`, theoIp: `${kenh}|${ip}|*` };
}

/**
 * So giay con bi khoa (0 = duoc thu dang nhap).
 * @param {string} kenh  'khach' | 'nhan_vien' | 'admin'
 */
function soGiayBiKhoa(req, kenh, taiKhoan) {
  const bayGio = Date.now();
  const { theoTk, theoIp } = khoaCua(req, kenh, taiKhoan);
  const a = conHan(theoTk, bayGio);
  const b = conHan(theoIp, bayGio);
  let het = 0;
  if (a.length >= TOI_DA_MOI_TAI_KHOAN) het = Math.max(het, a[a.length - TOI_DA_MOI_TAI_KHOAN] + CUA_SO_MS);
  if (b.length >= TOI_DA_MOI_IP) het = Math.max(het, b[b.length - TOI_DA_MOI_IP] + CUA_SO_MS);
  return het > bayGio ? Math.ceil((het - bayGio) / 1000) : 0;
}

function ghiThatBai(req, kenh, taiKhoan) {
  const bayGio = Date.now();
  const { theoTk, theoIp } = khoaCua(req, kenh, taiKhoan);
  for (const k of [theoTk, theoIp]) nhatKy.set(k, [...conHan(k, bayGio), bayGio]);
}

/** Dang nhap dung: xoa dem cua tai khoan (dem theo IP giu nguyen). */
function xoaDem(req, kenh, taiKhoan) {
  nhatKy.delete(khoaCua(req, kenh, taiKhoan).theoTk);
}

/** Cau thong bao than thien cho trang dang nhap. */
function thongBaoKhoa(giay) {
  const phut = Math.max(1, Math.ceil(giay / 60));
  return `Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ${phut} phút.`;
}

// Don rac dinh ky de Map khong phinh theo thoi gian chay.
setInterval(() => {
  const bayGio = Date.now();
  for (const k of nhatKy.keys()) conHan(k, bayGio);
}, 10 * 60 * 1000).unref();

module.exports = { soGiayBiKhoa, ghiThatBai, xoaDem, thongBaoKhoa };
