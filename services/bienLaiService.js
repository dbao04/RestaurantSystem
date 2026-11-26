/**
 * BIEN LAI THANH TOAN (kieu bien lai chuyen khoan cua ngan hang).
 *
 * Dung chung cho moi cho khach thanh toan: coc / thanh toan tiec (TCyyMMdd...),
 * coc dat ban (RSV-...), don giao hang, hoa don tai ban (QR), coc goi mon.
 * Tat ca deu ghi vao bang payments voi sesis = ma don -> tra theo ma.
 *
 * Khong tra ten / SDT khach (API chi can biet ma don): chi so tien, thoi gian,
 * ma giao dich, noi dung, phuong thuc va tai khoan NHAN cua nha hang.
 */
const db = require('../config/db');

const CHU_SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

/** Doc 3 chu so (0-999). daySo: nhom nay khong phai nhom dau -> doc du "không trăm". */
function doc3(n, dayDu) {
  const tram = Math.floor(n / 100), chuc = Math.floor((n % 100) / 10), dv = n % 10;
  const ra = [];
  if (tram || dayDu) ra.push(CHU_SO[tram] + ' trăm');
  if (chuc > 1) {
    ra.push(CHU_SO[chuc] + ' mươi');
    if (dv === 1) ra.push('mốt'); else if (dv === 5) ra.push('lăm'); else if (dv) ra.push(CHU_SO[dv]);
  } else if (chuc === 1) {
    ra.push('mười');
    if (dv === 5) ra.push('lăm'); else if (dv) ra.push(CHU_SO[dv]);
  } else if (dv) {
    if (tram || dayDu) ra.push('lẻ');
    ra.push(CHU_SO[dv]);
  }
  return ra.join(' ');
}

/** 17154000 -> "Mười bảy triệu một trăm năm mươi bốn nghìn đồng". */
function docSoTien(soTien) {
  let n = Math.round(Math.abs(Number(soTien) || 0));
  if (!n) return 'Không đồng';
  const DON_VI = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ'];
  const nhom = [];
  while (n > 0) { nhom.push(n % 1000); n = Math.floor(n / 1000); }
  const ra = [];
  for (let i = nhom.length - 1; i >= 0; i--) {
    if (!nhom[i]) continue;
    ra.push(doc3(nhom[i], i < nhom.length - 1) + DON_VI[i]);
  }
  const s = ra.join(' ').replace(/\s+/g, ' ').trim() + ' đồng';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Loai giao dich theo ma don. */
async function loaiTheoMa(ma) {
  if (/^TC\d{6}[A-Z0-9]{4}$/.test(ma)) return { nhom: 'tiec', ten: 'tiệc' };
  if (/^RSV-/.test(ma)) return { nhom: 'dat_ban', ten: 'đặt bàn' };
  const [[g]] = await db.query('SELECT ma_giao FROM don_giao_hang WHERE sesis = ? LIMIT 1', [ma]).catch(() => [[null]]);
  if (g) return { nhom: 'giao_hang', ten: 'đơn giao hàng', ma_hien: g.ma_giao };
  return { nhom: 'tai_ban', ten: 'hóa đơn tại bàn' };
}

function maGiaoDich(p, gd) {
  if (p.transaction_id) return String(p.transaction_id);
  if (gd && gd.ma_tham_chieu) return String(gd.ma_tham_chieu);
  const m = /GD\s+(\S+)/.exec(p.notes || '');
  if (m) return m[1];
  return 'BD' + String(p.id).padStart(8, '0');
}

/**
 * Bien lai cac giao dich THANH CONG cua mot ma don (moi nhat truoc).
 * @param {string} ma   sesis / ma tiec / ma dat ban
 * @param {number} [id] chi lay mot payment
 */
async function theoMa(ma, id = null) {
  ma = String(ma || '').trim();
  if (ma.length < 8 || ma.length > 64) return [];
  const [ds] = await db.query(
    `SELECT p.*, pm.name AS ten_phuong_thuc, pm.code AS ma_phuong_thuc
       FROM payments p LEFT JOIN payment_methods pm ON pm.id = p.payment_method_id
      WHERE p.sesis = ? AND p.status = 'success' ${id ? 'AND p.id = ?' : ''}
      ORDER BY COALESCE(p.thanh_cong_luc, p.created_at) DESC, p.id DESC LIMIT 20`,
    id ? [ma, Number(id)] : [ma]);
  if (!ds.length) return [];
  const loai = await loaiTheoMa(ma);
  const tk = await require('./thanhToanService').layTaiKhoanNhan().catch(() => null);
  let tenNganHang = tk ? tk.maNganHang : '';
  try {
    const nh = require('./vietQR').danhSachNganHang().find((b) => b.ma === tk.maNganHang || b.code === tk.maNganHang || b.shortName === tk.maNganHang);
    if (nh) tenNganHang = nh.ten || nh.shortName || nh.name || tenNganHang;
  } catch (_) { /* giu ma */ }
  const [gds] = await db.query('SELECT payment_id, ma_tham_chieu FROM giao_dich_ngan_hang WHERE payment_id IN (?)', [ds.map((p) => p.id)]).catch(() => [[]]);
  return ds.map((p) => {
    const soTien = Number(p.amount) + Number(p.tien_tip || 0);
    const chuyenKhoan = p.ma_phuong_thuc === 'vietqr' || Number(p.payment_method_id) === 2;
    const mucDich = p.loai === 'dat_coc' ? 'Đặt cọc' : 'Thanh toán';
    return {
      id: p.id,
      so_tien: soTien,
      bang_chu: docSoTien(soTien),
      luc: p.thanh_cong_luc || p.created_at,
      loai: `${mucDich} ${loai.ten}`,
      nhom: loai.nhom,
      ma_don: loai.ma_hien || ma,
      noi_dung: (p.notes || '').replace(/\s*·\s*GD\s+\S+/, '').trim() || `${mucDich} ${loai.ten} ${loai.ma_hien || ma}`,
      ma_giao_dich: maGiaoDich(p, gds.find((g) => Number(g.payment_id) === Number(p.id))),
      phuong_thuc: p.ten_phuong_thuc || (chuyenKhoan ? 'Chuyển khoản' : 'Khác'),
      giam_gia: Number(p.discount_amount || 0),
      tien_tip: Number(p.tien_tip || 0),
      nguoi_nhan: {
        ten: tk ? tk.tenTaiKhoan : 'NHA HANG BAO DOAN',
        so_tai_khoan: chuyenKhoan && tk ? tk.soTaiKhoan : null,
        ngan_hang: chuyenKhoan ? tenNganHang : null,
      },
    };
  });
}

module.exports = { theoMa, docSoTien };
