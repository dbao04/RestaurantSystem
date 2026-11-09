/**
 * GAN SO DIEN THOAI KHACH VAO DON TAI BAN (tich diem).
 *
 * Don an tai ban (QR / so do ban) gan vao tai khoan "vang lai" cua ban
 * (sodienthoai 'QR_...'): khong tich diem, khong biet ai la khach quen. Trong
 * 16.800 don lich su gan nhu khong don nao gan voi khach that - khong the lam
 * cham soc khach hang hay phan tich khach (RFM).
 *
 * Nay thu ngan (hoac chinh khach tren trang thanh toan QR) nhap so dien
 * thoai truoc khi tra tien:
 *   - So da co tai khoan -> don chuyen sang tai khoan do.
 *   - Chua co -> tao ho so khach (chua co mat khau). Khach dang ky sau bang
 *     dung so do se "nhan" ho so cung diem da tich (orderService.userRegister).
 *   - Diem duoc cong luc thanh toan nhu khach co tai khoan.
 *
 * Gioi han:
 *   - Chi don AN TAI CHO, chua thanh toan xong / chua huy.
 *   - Don da gan khach that khac (vd. luot dat ban) thi khong doi.
 *   - Trang QR (khach tu nhap): chi TICH diem, khong DUNG diem (khong xac minh
 *     duoc chu so dien thoai); ten khach tra ve da che bot.
 */
const db = require('../config/db');

/**
 * Mat khau danh dau ho so khach do thu ngan / trang QR tao, CHUA dang ky.
 * Khong phai dang md5/bcrypt nen khong dang nhap duoc (utils/matKhau.khop).
 * orderService.userRegister nhan ra chuoi nay de cho khach nhan lai ho so.
 */
const CHUA_DANG_KY = '!CHUA_DANG_KY';

class LoiGanKhach extends Error {
  constructor(msg, ma = 'INVALID') { super(msg); this.name = 'LoiGanKhach'; this.ma = ma; }
}

/** '090 123 4567', '+84901234567' -> '0901234567'; null neu khong hop le. */
function chuanHoaSdt(s) {
  let x = String(s || '').replace(/[\s.\-()]/g, '');
  if (x.startsWith('+84')) x = '0' + x.slice(3);
  else if (/^84\d{9}$/.test(x)) x = '0' + x.slice(2);
  return /^0[35789]\d{8}$/.test(x) ? x : null;
}

const laVangLai = (sdt) => !sdt || String(sdt).startsWith('QR_');
const anTen = (ten) => String(ten || '').trim().split(/\s+/).filter(Boolean).map((w) => w[0] + '***').join(' ') || 'Khách';
const anSdt = (sdt) => String(sdt).slice(0, 3) + '****' + String(sdt).slice(-3);

/**
 * @param {string} sesis
 * @param {{sdt:string, ten?:string}} khach
 * @returns {{ id_kh, ten, ten_an, sdt_an, la_moi, da_gan_truoc, diem }}
 */
async function ganKhach(sesis, { sdt, ten = '' }) {
  const so = chuanHoaSdt(sdt);
  if (!so) throw new LoiGanKhach('Số điện thoại không hợp lệ (cần 10 số, ví dụ 0901234567).');
  const tenSach = String(ten || '').trim().slice(0, 100);

  const conn = await db.getConnection();
  let kq;
  try {
    await conn.beginTransaction();
    const [[don]] = await conn.query(
      `SELECT h.id_user, h.tinhtrang, h.loai_don, k.sodienthoai AS sdt_hien_tai
         FROM hopdong h LEFT JOIN khach_hang k ON k.id = h.id_user
        WHERE h.sesis = ? LIMIT 1 FOR UPDATE`, [sesis]);
    if (!don) throw new LoiGanKhach('Không tìm thấy đơn.', 'NOT_FOUND');
    if (don.loai_don === 'giao_hang') throw new LoiGanKhach('Đơn giao hàng đã gắn với tài khoản người đặt.');
    if (Number(don.tinhtrang) === 3) throw new LoiGanKhach('Đơn đã thanh toán xong - không gắn khách được nữa.');
    if (Number(don.tinhtrang) === 4) throw new LoiGanKhach('Đơn đã bị hủy.');

    if (!laVangLai(don.sdt_hien_tai)) {
      if (don.sdt_hien_tai === so) {
        kq = { id_kh: don.id_user, la_moi: false, da_gan_truoc: true };
      } else {
        throw new LoiGanKhach('Đơn này đã gắn với một khách hàng khác.', 'CONFLICT');
      }
    } else {
      const [[co]] = await conn.query('SELECT id FROM khach_hang WHERE sodienthoai = ? LIMIT 1', [so]);
      let idKh = co ? co.id : null;
      if (!idKh) {
        const [ins] = await conn.query(
          'INSERT INTO khach_hang (ten, sodienthoai, passwords) VALUES (?, ?, ?)',
          [tenSach || 'Khách ' + so.slice(-4), so, CHUA_DANG_KY]);
        idKh = ins.insertId;
      }
      await conn.query('UPDATE hopdong SET id_user = ? WHERE sesis = ?', [idKh, sesis]);
      kq = { id_kh: idKh, la_moi: !co, da_gan_truoc: false };
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const [[kh]] = await db.query('SELECT ten FROM khach_hang WHERE id = ?', [kq.id_kh]);
  const [[lp]] = await db.query('SELECT points FROM loyalty_points WHERE id_kh = ? LIMIT 1', [kq.id_kh]);
  return {
    ...kq,
    ten: kh ? kh.ten : '',
    ten_an: anTen(kh && kh.ten),
    sdt_an: anSdt(so),
    diem: lp ? Number(lp.points) || 0 : 0,
  };
}

module.exports = { ganKhach, chuanHoaSdt, LoiGanKhach, CHUA_DANG_KY };
