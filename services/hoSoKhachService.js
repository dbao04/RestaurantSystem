/**
 * HO SO KHACH HANG (CRM) cho nhan vien - /staff/customers va /staff/customers/:id.
 *
 * Gom tu cac bang co san, KHONG tao bang moi:
 *   khach_hang            thong tin co ban + ghichu (ghi chu noi bo)
 *   loyalty_points        diem, hang, tong chi tieu (cap nhat khi thanh toan)
 *   loyalty_transactions  lich su cong / doi diem
 *   hopdong               lich su dung bua (moi `sesis` la mot lan / mot hoa don)
 *   reservations          lich su dat ban (customer_id), reservation_customers: no-show, so thich
 *   dat_tiec              tiec da dat (customer_id)
 *   don_giao_hang         don giao (noi qua sesis cua hopdong)
 *   danh_gia              danh gia cua khach
 *
 * "Lan dung bua" = mot sesis co it nhat mot mon (soluong > 0) va da thanh toan
 * (tinhtrang = 3). Don dang dung do / bi huy hien rieng trang thai, khong tinh
 * vao chi tieu.
 */
const db = require('../config/db');
const loyalty = require('./loyaltyService');

const HANG = ['bronze', 'silver', 'gold', 'platinum'];
const TEN_TT = { 0: 'Chờ xác nhận', 1: 'Đang phục vụ', 2: 'Đã xác nhận', 3: 'Đã thanh toán', 4: 'Đã hủy', 5: 'Đang phục vụ', 6: 'Chờ thanh toán' };
const TEN_LOAI = { tai_cho: 'Tại bàn', qr: 'Gọi món QR', giao_hang: 'Giao hàng', dat_ban: 'Đặt bàn', mang_ve: 'Mang về' };
const TEN_GIAO = {
  cho_xac_nhan: 'Chờ xác nhận', cho_phan: 'Chờ shipper', da_phan: 'Đã phân shipper', dang_lay: 'Đang lấy hàng',
  dang_giao: 'Đang giao', da_giao: 'Đã giao', that_bai: 'Giao thất bại', huy: 'Đã hủy', cho_thanh_toan: 'Chờ thanh toán',
};
const TEN_DIP = { BIRTHDAY: 'Sinh nhật', ANNIVERSARY: 'Kỷ niệm', CORPORATE: 'Tiếp khách / công ty', BUSINESS: 'Tiếp khách / công ty',
  DATE: 'Hẹn hò', FAMILY: 'Gia đình', PROPOSAL: 'Cầu hôn', GRADUATION: 'Tốt nghiệp', OTHER: 'Khác', NONE: '' };
const TEN_RSV = {
  PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', ARRIVED: 'Đã đến', SEATED: 'Đã nhận bàn',
  COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', NO_SHOW: 'Không đến', REJECTED: 'Từ chối', EXPIRED: 'Hết hạn',
};

// hopdong khong co chi muc theo khach -> dem lich su mot khach phai quet ca bang
// (8 giay voi khach co ~500 hoa don). Chi muc PHU (du cot can dem) + FORCE INDEX o
// danh sach: tong hop 112k dong tu 8.9s xuong ~50ms. Them mot lan, bo qua neu da co.
let daCoChiMuc = false;
async function damBaoChiMuc() {
  if (daCoChiMuc) return;
  const [r] = await db.query("SHOW INDEX FROM hopdong WHERE Key_name = 'idx_hd_user'");
  if (!r.length) await db.query('ALTER TABLE hopdong ADD INDEX idx_hd_user (id_user, tinhtrang, sesis, ngay_dat, soluong, id_mon, thanhtien)').catch((e) => console.error('[ho-so-khach] chi muc:', e.message));
  daCoChiMuc = true;
}

/** Hang ke tiep + con thieu bao nhieu chi tieu. */
function tienDoHang(tier, tongChi) {
  const i = HANG.indexOf(tier);
  const ke = HANG[i + 1];
  if (!ke) return { ke: null, con_thieu: 0, phan_tram: 100 };
  const tu = loyalty.NGUONG_HANG[tier] || 0, den = loyalty.NGUONG_HANG[ke];
  return {
    ke, ten_ke: loyalty.TEN_HANG[ke], nguong_ke: den,
    con_thieu: Math.max(0, den - tongChi),
    phan_tram: Math.max(0, Math.min(100, Math.round(((tongChi - tu) / (den - tu)) * 100))),
  };
}

/** Danh sach khach kem so lieu tong hop (diem, hang, so lan, lan cuoi). */
async function danhSach() {
  await damBaoChiMuc();
  const [rows] = await db.query(
    `SELECT k.id, k.ten, k.sodienthoai, k.email, k.diachi, k.ghichu,
            COALESCE(lp.points, 0) AS diem, COALESCE(lp.tier, 'bronze') AS hang,
            COALESCE(lp.total_spent, 0) AS tong_chi,
            COALESCE(h.so_lan, 0) AS so_lan, h.lan_cuoi,
            COALESCE(r.so_dat, 0) AS so_dat_ban,
            COALESCE(rc.no_show_count, 0) AS no_show, COALESCE(rc.is_blocked, 0) AS bi_chan
       FROM khach_hang k
       LEFT JOIN loyalty_points lp ON lp.id_kh = k.id
       LEFT JOIN (SELECT id_user, COUNT(DISTINCT sesis) AS so_lan, MAX(ngay_dat) AS lan_cuoi
                    FROM hopdong FORCE INDEX (idx_hd_user) WHERE id_user > 0 AND id_mon > 0 AND soluong > 0 AND tinhtrang = 3
                   GROUP BY id_user) h ON h.id_user = k.id
       LEFT JOIN (SELECT customer_id, COUNT(*) AS so_dat FROM reservations WHERE customer_id IS NOT NULL GROUP BY customer_id) r
              ON r.customer_id = k.id
       LEFT JOIN reservation_customers rc ON rc.customer_id = k.id
      ORDER BY k.id DESC`);
  return rows.map((r) => ({
    ...r,
    diem: Number(r.diem), tong_chi: Number(r.tong_chi), so_lan: Number(r.so_lan),
    vang_lai: /^QR_/.test(r.sodienthoai || ''),
    ten_hang: loyalty.TEN_HANG[r.hang] || r.hang,
  }));
}

/** Tom tat cho dau trang danh sach. */
function tomTat(ds) {
  const that = ds.filter((x) => !x.vang_lai);
  const theoHang = Object.fromEntries(HANG.map((h) => [h, that.filter((x) => x.hang === h).length]));
  const moc30 = Date.now() - 30 * 864e5;
  return {
    tong: that.length,
    vang_lai: ds.length - that.length,
    theo_hang: theoHang,
    quay_lai_30n: that.filter((x) => x.lan_cuoi && new Date(x.lan_cuoi).getTime() >= moc30).length,
    tong_diem: that.reduce((s, x) => s + x.diem, 0),
  };
}

/** Ho so day du mot khach. */
async function chiTiet(id) {
  await damBaoChiMuc();
  const [[kh]] = await db.query('SELECT id, ten, sodienthoai, email, diachi, ghichu, solandat FROM khach_hang WHERE id = ?', [id]);
  if (!kh) return null;

  const [[lp]] = await db.query('SELECT points, tier, total_spent, redeemed_points, updated_at FROM loyalty_points WHERE id_kh = ?', [id]);
  const tier = (lp && lp.tier) || 'bronze';
  const tongChi = Number((lp && lp.total_spent) || 0);
  const uuDai = loyalty.getTierBenefits(tier);

  // Lich su dung bua: moi sesis mot dong
  const [bua] = await db.query(
    `SELECT h.sesis, MIN(h.ngay_dat) AS ngay, MIN(h.gio_dat) AS gio, MAX(h.tinhtrang) AS tt,
            MAX(h.loai_don) AS loai_don, MAX(b.number_ban) AS ban, MAX(h.so_user) AS so_khach,
            (SELECT dg.trang_thai FROM don_giao_hang dg WHERE dg.sesis = h.sesis LIMIT 1) AS tt_giao,
            SUM(h.soluong) AS so_mon, SUM(h.thanhtien) AS tien,
            GROUP_CONCAT(CONCAT(h.soluong, '× ', h.name_mon) ORDER BY h.id SEPARATOR ' · ') AS mon
       FROM hopdong h LEFT JOIN ban b ON b.Id_ban = h.id_ban
      WHERE h.id_user = ? AND h.id_mon > 0 AND h.soluong > 0
      GROUP BY h.sesis
      ORDER BY ngay DESC, gio DESC
      LIMIT 60`, [id]);
  const lichSuBua = bua.map((x) => ({
    ...x, tien: Number(x.tien), so_mon: Number(x.so_mon),
    // Don giao: trang thai thuc te nam o don_giao_hang, khong phai tinhtrang cua mon.
    ten_tt: (x.loai_don === 'giao_hang' && TEN_GIAO[x.tt_giao]) || TEN_TT[x.tt] || '—',
    ten_loai: TEN_LOAI[x.loai_don] || 'Tại bàn',
  }));

  const [[tk]] = await db.query(
    `SELECT COUNT(DISTINCT sesis) AS so_lan, COALESCE(SUM(thanhtien), 0) AS tong,
            MIN(ngay_dat) AS lan_dau, MAX(ngay_dat) AS lan_cuoi
       FROM hopdong WHERE id_user = ? AND id_mon > 0 AND soluong > 0 AND tinhtrang = 3`, [id]);
  const soLan = Number(tk.so_lan) || 0;

  const [monYeuThich] = await db.query(
    `SELECT name_mon, SUM(soluong) AS so_luong, COUNT(DISTINCT sesis) AS so_lan
       FROM hopdong WHERE id_user = ? AND id_mon > 0 AND soluong > 0 AND tinhtrang = 3
      GROUP BY id_mon, name_mon ORDER BY so_luong DESC LIMIT 6`, [id]);

  const [datBan] = await db.query(
    `SELECT reservation_code, reservation_date, start_time, guest_count, status, occasion,
            deposit_amount, deposit_status, special_requests
       FROM reservations WHERE customer_id = ? ORDER BY reservation_date DESC, start_time DESC LIMIT 30`, [id]);
  const [[rc]] = await db.query(
    `SELECT total_reservations, completed_count, no_show_count, cancelled_count, preferences, internal_note, is_blocked, last_visit_date
       FROM reservation_customers WHERE customer_id = ? ORDER BY updated_at DESC LIMIT 1`, [id]);

  const [tiec] = await db.query(
    `SELECT id, ma_tiec, loai_tiec, ngay_to_chuc, so_khach, so_ban, trang_thai, COALESCE(tong_thuc_te, tong_du_toan) AS tong
       FROM dat_tiec WHERE customer_id = ? ORDER BY ngay_to_chuc DESC LIMIT 20`, [id]);

  const [giao] = await db.query(
    `SELECT dg.id_giao, dg.ma_giao, dg.trang_thai, dg.dia_chi_giao, dg.tao_luc, dg.phi_giao,
            (SELECT SUM(h.thanhtien) FROM hopdong h WHERE h.sesis = dg.sesis AND h.soluong > 0) AS tien_mon
       FROM don_giao_hang dg
      WHERE dg.sesis IN (SELECT DISTINCT sesis FROM hopdong WHERE id_user = ? AND loai_don = 'giao_hang')
      ORDER BY dg.tao_luc DESC LIMIT 20`, [id]);

  const [diem] = await db.query(
    'SELECT type, points, description, sesis, created_at FROM loyalty_transactions WHERE id_kh = ? ORDER BY id DESC LIMIT 40', [id]);

  const [danhGia] = await db.query('SELECT sao, noi_dung, thoigian FROM danh_gia WHERE id_kh = ? ORDER BY id_dg DESC LIMIT 10', [id]);

  return {
    kh: { ...kh, vang_lai: /^QR_/.test(kh.sodienthoai || '') },
    thanh_vien: {
      diem: Number((lp && lp.points) || 0),
      da_doi: Number((lp && lp.redeemed_points) || 0),
      hang: tier, ten_hang: loyalty.TEN_HANG[tier], tong_chi: tongChi,
      uu_dai: uuDai, tien_do: tienDoHang(tier, tongChi),
      cac_hang: HANG.map((h) => ({ ma: h, ten: loyalty.TEN_HANG[h], nguong: loyalty.NGUONG_HANG[h], ...loyalty.getTierBenefits(h) })),
    },
    thong_ke: {
      so_lan: soLan, tong: Number(tk.tong) || 0, tb_moi_lan: soLan ? Math.round(Number(tk.tong) / soLan) : 0,
      lan_dau: tk.lan_dau, lan_cuoi: tk.lan_cuoi,
      so_dat_ban: datBan.length, so_tiec: tiec.length, so_giao: giao.length,
      no_show: Number((rc && rc.no_show_count) || 0), huy: Number((rc && rc.cancelled_count) || 0),
    },
    dat_ban_kh: rc || null,
    lich_su_bua: lichSuBua,
    mon_yeu_thich: monYeuThich.map((m) => ({ ...m, so_luong: Number(m.so_luong) })),
    dat_ban: datBan.map((r) => ({ ...r, ten_tt: TEN_RSV[r.status] || r.status,
      occasion: r.occasion ? (TEN_DIP[String(r.occasion).toUpperCase()] ?? r.occasion) : '' })),
    tiec, giao, diem, danh_gia: danhGia,
  };
}

async function luuGhiChu(id, ghiChu) {
  await db.query('UPDATE khach_hang SET ghichu = ? WHERE id = ?', [String(ghiChu || '').slice(0, 1000) || null, id]);
}

module.exports = { danhSach, tomTat, chiTiet, luuGhiChu, tienDoHang };
