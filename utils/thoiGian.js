/**
 * Chuan hoa ngay/gio khi ghi don vao bang `hopdong`.
 *
 * Bang `hopdong` co hai cap cot ngay gio:
 *   - `dates` (TEXT) + `tg` (TEXT): cot cu, lan lon 3 dinh dang ('M/D/YYYY',
 *     'YYYY-MM-DD', chuoi rong) nen KHONG loc duoc bang SQL.
 *   - `ngay_dat` (DATE) + `gio_dat` (TIME): cot chuan them o migration 001.
 *
 * Man hinh bep (KDS), so do ban va toan bo bao cao thong ke deu loc theo
 * `ngay_dat`. Vi vay MOI cho ghi don moi vao `hopdong` bat buoc phai dien ca
 * hai cot moi - neu de NULL thi don van nam trong DB nhung khong bao gio hien
 * len man hinh bep.
 */

const dem2 = (n) => String(n).padStart(2, '0');

/**
 * Ve dang 'YYYY-MM-DD', hoac null neu khong doc duoc.
 * Nhan ca 'YYYY-MM-DD' lan 'M/D/YYYY' (dinh dang datepicker cua trang dat ban).
 */
function chuanHoaNgay(raw) {
  if (!raw) return null;

  // Neu goi truc tiep bang doi tuong Date thi lay theo gio dia phuong.
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? null : ngayCucBo(raw);
  }

  const s = String(raw).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${dem2(m[2])}-${dem2(m[3])}`;

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // M/D/YYYY - thang truoc
  if (m) return `${m[3]}-${dem2(m[1])}-${dem2(m[2])}`;

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : ngayCucBo(d);
}

/** `tg` dang 'HH:MM'. Tra ve 'HH:MM:SS' hoac null. */
function chuanHoaGio(raw) {
  if (!raw) return null;
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return `${dem2(m[1])}:${m[2]}:${m[3] || '00'}`;
}

/**
 * Ngay hom nay theo gio DIA PHUONG.
 *
 * Khong dung toISOString() vi ham do doi sang UTC: may chay o UTC+7 se tra ve
 * ngay hom qua trong khoang 00:00-07:00, khien don dat luc sang som khong khop
 * `ngay_dat = CURDATE()` cua MySQL va bien mat khoi man hinh bep.
 */
function ngayCucBo(d = new Date()) {
  return `${d.getFullYear()}-${dem2(d.getMonth() + 1)}-${dem2(d.getDate())}`;
}

/** Gio hien tai theo gio dia phuong, dang 'HH:MM'. */
function gioCucBo(d = new Date()) {
  return `${dem2(d.getHours())}:${dem2(d.getMinutes())}`;
}

/**
 * Ngay ghi cho mot mon duoc THEM VAO don dang co (QR goi them, phuc vu them mon).
 *
 * Giu nguyen ngay cua don goc de mot hoa don van nam tron trong mot ngay khi
 * len bao cao doanh thu. Nhung neu don goc da o QUA KHU - vi du ban con dinh
 * mot phien cu chua thanh toan - thi mon goi them dang duoc nau HOM NAY, phai
 * ghi ngay hom nay, neu khong bep se khong bao gio nhin thay mon do.
 */
function ngayChoMonThem(ngayGoc) {
  const homNay = ngayCucBo();
  const goc = chuanHoaNgay(ngayGoc);
  return !goc || goc < homNay ? homNay : goc;
}

module.exports = { chuanHoaNgay, chuanHoaGio, ngayCucBo, gioCucBo, ngayChoMonThem };
