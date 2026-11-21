/**
 * TU HOI SEPAY (polling) - xac nhan chuyen khoan that khi chay LOCALHOST.
 *
 * Webhook can SePay goi VAO may nay, nen may phai co dia chi cong khai
 * (tunnel / host). Chay localhost thi SePay khong tim thay may -> khong bao gio
 * tu xac nhan. O day lam nguoc lai: may nay chu dong goi RA API cua SePay hoi
 * "co tien vao chua?" - chi can co Internet, khong can dia chi cong khai.
 *
 * Moi giao dich tien vao lay ve duoc dua qua DUNG ham cua webhook
 * (thanhToanService.ghiNhanGiaoDichNganHang): cung kiem tra tai khoan nhan,
 * rut ma doi soat, khop phien, chong trung theo ma tham chieu. Vi vay bat song
 * song ca webhook lan tu hoi cung khong ghi nhan hai lan.
 *
 * Cau hinh: API Token tao o my.sepay.vn (Cau hinh cong ty -> API Access),
 * dan vao /admin/thanh-toan -> luu khoa `sepay_api_token` trong
 * cau_hinh_thanh_toan. Chua co token thi vong lap chi ngu, khong goi gi ca.
 *
 * Nhip: 10 giay khi dang co phien VietQR cho tien, 60 giay khi khong co.
 */
const db = require('../config/db');
const tt = require('./thanhToanService');

const API = 'https://my.sepay.vn/userapi/transactions/list';
const NHIP_NHANH = 10 * 1000;
const NHIP_CHAM = 60 * 1000;
// Lan dau chay chi lay giao dich trong 3 gio gan day, khong do ca lich su cu
// vao hop doi soat.
const LAN_DAU_GIO = 3;

const trangThai = {
  dangChay: false,
  coToken: false,
  lanHoiCuoi: null,
  loiCuoi: null,
  soGiaoDichMoi: 0,
  soDaKhop: 0,
};

let idLonNhat = 0; // id giao dich SePay lon nhat da xu ly (chi dung trong bo nho)
let henGio = null;

function dinhDangNgay(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Goi API danh sach giao dich cua SePay. Nem loi kem thong bao de doc. */
async function goiApi(token, thamSo = {}) {
  const url = new URL(API);
  for (const [k, v] of Object.entries(thamSo)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  const ctl = new AbortController();
  const hen = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, {
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      signal: ctl.signal,
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status === 403) throw new Error('API Token SePay không hợp lệ hoặc đã bị xóa.');
    if (r.status === 429) throw new Error('SePay báo gọi quá nhanh (429) - sẽ thử lại sau.');
    if (!r.ok) throw new Error(`SePay trả lỗi HTTP ${r.status}` + (d && d.error ? `: ${d.error}` : ''));
    return Array.isArray(d.transactions) ? d.transactions : [];
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Không kết nối được SePay (quá 15 giây) - kiểm tra Internet.');
    if (e.cause && /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET/.test(String(e.cause.code))) {
      throw new Error('Không kết nối được SePay - máy đang mất Internet?');
    }
    throw e;
  } finally {
    clearTimeout(hen);
  }
}

/** Chuyen mot giao dich API SePay sang dang ghiNhanGiaoDichNganHang nhan. */
function sangGiaoDich(g) {
  return {
    // Cung khoa voi webhook (referenceCode) -> webhook va tu hoi khong ghi trung.
    ma_tham_chieu: String(g.reference_number || g.id || ''),
    cong_thanh_toan: g.bank_brand_name || 'SePay',
    so_tai_khoan: g.account_number || null,
    tai_khoan_phu: g.sub_account || null,
    so_tien: Number(g.amount_in) || 0,
    loai: 'in',
    noi_dung: g.transaction_content || '',
    thoi_diem: g.transaction_date || null,
    du_lieu_tho: { ...g, nguon: 'sepay_tu_hoi' },
  };
}

async function coPhienDangCho() {
  try {
    const [[r]] = await db.query(
      `SELECT COUNT(*) AS n FROM payments
        WHERE status = 'pending' AND ma_doi_soat IS NOT NULL
          AND created_at > NOW() - INTERVAL 1 DAY`);
    return Number(r.n) > 0;
  } catch { return true; }
}

/**
 * Mot luot hoi. Tra ve so giao dich moi da dua vao doi soat.
 * @param {(kq:object)=>void} sauGhiNhan - phat realtime khi khop (giong webhook)
 */
async function hoiMotLan(sauGhiNhan) {
  const ch = await tt.layCauHinh(true);
  const token = String(ch.sepay_api_token || '').trim();
  trangThai.coToken = !!token;
  if (!token) return 0;

  const tk = await tt.layTaiKhoanNhan();
  const thamSo = { limit: 50, account_number: tk && tk.soTaiKhoan };
  if (idLonNhat) thamSo.since_id = idLonNhat;
  else thamSo.transaction_date_min = dinhDangNgay(new Date(Date.now() - LAN_DAU_GIO * 3600e3));

  const ds = await goiApi(token, thamSo);
  trangThai.lanHoiCuoi = new Date();
  trangThai.loiCuoi = null;

  let moi = 0;
  // Cu truoc moi sau de thu tu ghi nhan dung thu tu tien ve.
  for (const g of ds.sort((a, b) => Number(a.id) - Number(b.id))) {
    const id = Number(g.id) || 0;
    if (id > idLonNhat) idLonNhat = id;
    if (!(Number(g.amount_in) > 0)) continue;
    const kq = await tt.ghiNhanGiaoDichNganHang(sangGiaoDich(g));
    if (kq.trungLap) continue;
    moi++;
    trangThai.soGiaoDichMoi++;
    if (kq.khop) trangThai.soDaKhop++;
    try { sauGhiNhan && sauGhiNhan(kq); } catch (e) { console.error('[sepay-tu-hoi] phat realtime loi:', e.message); }
  }
  if (moi) console.log(`[sepay-tu-hoi] ghi nhan ${moi} giao dich tien vao moi`);
  return moi;
}

/** Bat vong lap nen. Goi mot lan khi khoi dong server. */
function batDau(sauGhiNhan) {
  if (trangThai.dangChay) return;
  trangThai.dangChay = true;
  const vong = async () => {
    let nhip = NHIP_CHAM;
    try {
      await hoiMotLan(sauGhiNhan);
      if (trangThai.coToken && await coPhienDangCho()) nhip = NHIP_NHANH;
    } catch (e) {
      if (trangThai.loiCuoi !== e.message) console.warn('[sepay-tu-hoi]', e.message);
      trangThai.loiCuoi = e.message;
      trangThai.lanHoiCuoi = new Date();
    }
    henGio = setTimeout(vong, nhip);
    if (henGio.unref) henGio.unref();
  };
  henGio = setTimeout(vong, 5000);
  if (henGio.unref) henGio.unref();
  console.log('[sepay-tu-hoi] vong hoi SePay da bat (chi goi khi co API Token)');
}

/** Thu token ngay (trang quan tri bam "Kiem tra"). */
async function kiemTraToken(token) {
  const ds = await goiApi(String(token || '').trim(), { limit: 1 });
  return { ok: true, soGiaoDich: ds.length };
}

/** Doi tai khoan / token thi bat dau lai tu "3 gio gan day". */
function datLai() { idLonNhat = 0; }

module.exports = { batDau, hoiMotLan, kiemTraToken, datLai, trangThai };
