/**
 * Bam va kiem tra mat khau.
 *
 * Truoc day toan he thong dung md5(): nhanh, khong co muoi - lo CSDL la tra
 * nguoc duoc gan het mat khau pho bien bang bang tra san. Nay chuyen sang
 * bcrypt (thu vien bcryptjs, thuan JS - khong can bien dich native tren Windows).
 *
 * CHUYEN DOI MEM: CSDL dang co san hang nghin mat khau md5 (tai khoan mau, du
 * lieu migration). Khong the doi mot lan vi khong biet mat khau goc, nen:
 *   - khop()       chap nhan CA bcrypt lan md5 cu;
 *   - canBamLai()  cho biet hash con la md5 -> noi dang nhap thanh cong se bam
 *                  lai bang bcrypt va ghi de. Tai khoan nao dang nhap mot lan
 *                  la tu dong len bcrypt.
 *
 * Moi cho GHI mat khau moi (dang ky, doi mat khau, tao nhan vien, quen mat
 * khau...) deu phai dung bam().
 */
const bcrypt = require('bcryptjs');
const md5 = require('md5');

const VONG = 10;
const LA_BCRYPT = /^\$2[aby]\$\d{2}\$/;
const LA_MD5 = /^[a-f0-9]{32}$/i;

/** Bam mat khau moi bang bcrypt. */
async function bam(matKhau) {
  return bcrypt.hash(String(matKhau), VONG);
}

/**
 * Mat khau `matKhau` co khop voi `hash` luu trong CSDL khong.
 * Hash khong phai bcrypt cung khong phai md5 (vd. '!QR_KHONG_DANG_NHAP' cua tai
 * khoan QR) thi luon tra ve false.
 */
async function khop(matKhau, hash) {
  if (matKhau == null || matKhau === '' || !hash) return false;
  const h = String(hash);
  if (LA_BCRYPT.test(h)) return bcrypt.compare(String(matKhau), h);
  if (LA_MD5.test(h)) return md5(String(matKhau)) === h.toLowerCase();
  return false;
}

/** Hash con o dinh dang cu (md5) -> nen bam lai sau khi dang nhap dung. */
function canBamLai(hash) {
  return LA_MD5.test(String(hash || ''));
}

/**
 * Mat khau mac dinh cap cho tai khoan khach tao TU DONG (nhan vien dat ban ho,
 * dat ban online chua co tai khoan...). Ai biet so dien thoai cung doan duoc,
 * nen dang nhap bang mat khau nay la bi bat doi ngay - xem server.js.
 */
const MAT_KHAU_MAC_DINH = '123456';

function laMacDinh(matKhau) {
  return String(matKhau ?? '') === MAT_KHAU_MAC_DINH;
}

/**
 * Kiem tra mat khau moi khach tu dat. Tra ve chuoi loi hoac null neu dat.
 */
function loiMatKhauMoi(matKhau) {
  const s = String(matKhau ?? '');
  if (s.length < 6) return 'Mật khẩu mới phải có ít nhất 6 ký tự.';
  if (s.length > 72) return 'Mật khẩu mới tối đa 72 ký tự.';
  if (laMacDinh(s)) return 'Không được dùng lại mật khẩu mặc định 123456.';
  return null;
}

module.exports = { bam, khop, canBamLai, MAT_KHAU_MAC_DINH, laMacDinh, loiMatKhauMoi };
