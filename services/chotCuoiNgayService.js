/**
 * CHOT CUOI NGAY - don dep don an tai cho cua nhung ngay da qua.
 *
 * Man hinh bep / bar chi hien mon TRONG NGAY (kdsService.layDonBep), nen mon
 * khach goi hom qua ma bep chua lam tu an luc 0h - nhung van nam o trang thai
 * "cho che bien" mai, lam lech thong ke bep va hoa don con treo.
 *
 * Moi ngay da qua (tu moc `chot_ngay.tu_ngay`, xem duoi) chay MOT lan:
 *   1. Mon CHUA che bien (trangthai_bep = 0) cua don tai cho chua thanh toan
 *      -> huy theo dung co che huyMonService: so luong ve 0 (giu dong), ghi
 *      `huy_mon` ly do 'het_ngay', nguoi huy "He thong (chot cuoi ngay)".
 *      Bo qua don da co khoan THANH TOAN (phai di duong hoan tien) va don
 *      giao hang (co chinh sach huy rieng).
 *   2. KHONG tu dong vao: mon da nau chua len ban (1, 2) va hoa don con no -
 *      lien quan tien / hao hut. Gui tom tat cho Quan ly + Thu ngan xu ly.
 *   3. Ghi `chot_ngay_log` (moi ngay mot dong) de khong chay lai.
 *
 * MOC BAT DAU: lan dau chay, `chot_ngay.tu_ngay` dat = hom nay -> chi chot tu
 * nay ve sau; ton dong cu (du lieu thu) KHONG bi dong hang loat. Muon chot ca
 * cac ngay cu: doi khoa nay trong cau_hinh (hoac goi chotTuNgay).
 */
const db = require('../config/db');

const LY_DO = 'het_ngay';
const TEN_LY_DO = 'Hết ngày – chưa chế biến';
const NGUOI = 'Hệ thống (chốt cuối ngày)';

const ngayStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const vnd = (n) => Math.round(Number(n) || 0).toLocaleString('vi-VN') + 'đ';

let daTao = false;
async function damBaoBang() {
  if (daTao) return;
  await require('./huyMonService').damBaoBang();
  await db.query(`CREATE TABLE IF NOT EXISTS chot_ngay_log (
    ngay DATE PRIMARY KEY,
    so_mon_huy INT NOT NULL DEFAULT 0,
    gia_tri_huy DECIMAL(14,2) NOT NULL DEFAULT 0,
    so_mon_da_nau INT NOT NULL DEFAULT 0,
    so_ban_con_no INT NOT NULL DEFAULT 0,
    tien_con_no DECIMAL(14,2) NOT NULL DEFAULT 0,
    chi_tiet TEXT NULL,
    luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  daTao = true;
}

async function docMoc() {
  const [[r]] = await db.query("SELECT gia_tri FROM cau_hinh WHERE khoa = 'chot_ngay.tu_ngay'");
  if (r && /^\d{4}-\d{2}-\d{2}$/.test(String(r.gia_tri))) return String(r.gia_tri);
  const hn = ngayStr(new Date());
  await db.query("INSERT INTO cau_hinh (khoa, gia_tri) VALUES ('chot_ngay.tu_ngay', ?) ON DUPLICATE KEY UPDATE gia_tri = VALUES(gia_tri)", [hn]);
  return hn;
}

/** Chot mot ngay (YYYY-MM-DD, phai la ngay da qua). Tra ve tom tat. */
async function chotMotNgay(ngay, { khongBao = false } = {}) {
  await damBaoBang();
  const [[da]] = await db.query('SELECT ngay FROM chot_ngay_log WHERE ngay = ?', [ngay]);
  if (da) return null;

  // 1. Mon chua che bien cua don tai cho chua thanh toan, chua co khoan thanh toan
  const [mon] = await db.query(
    `SELECT h.id, h.sesis, h.id_mon, h.name_mon, h.soluong, h.gia
       FROM hopdong h
      WHERE h.ngay_dat = ? AND h.id_mon > 0 AND h.soluong > 0 AND h.trangthai_bep = 0
        AND COALESCE(h.loai_don, '') <> 'giao_hang' AND h.tinhtrang IN (0, 1, 5, 6)
        AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.sesis = h.sesis AND p.status = 'success' AND p.loai = 'thanh_toan')`,
    [ngay]);
  let giaTri = 0;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const m of mon) {
      const sl = Number(m.soluong), dg = Number(m.gia) || 0;
      await conn.query('UPDATE hopdong SET soluong = 0, thanhtien = 0 WHERE id = ? AND soluong = ? AND trangthai_bep = 0', [m.id, sl]);
      await conn.query(
        `INSERT INTO huy_mon (id_dong, sesis, id_mon, name_mon, so_luong, don_gia, gia_tri, trangthai_bep, ma_ly_do, ly_do, id_nv, ten_nv)
         VALUES (?,?,?,?,?,?,?,0,?,?,NULL,?)`,
        [m.id, m.sesis, m.id_mon, m.name_mon, sl, dg, dg * sl, LY_DO, `${TEN_LY_DO} (ngày ${ngay.split('-').reverse().join('/')})`, NGUOI]);
      giaTri += dg * sl;
    }
    // QR thanh toan da sinh cho so tien cu -> vo hieu
    const dsSesis = [...new Set(mon.map((m) => m.sesis))];
    if (dsSesis.length) {
      await conn.query("UPDATE payments SET status = 'cancelled' WHERE sesis IN (?) AND status = 'pending'", [dsSesis]).catch(() => {});
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  // 2. Viec can nguoi xu ly
  const [[nau]] = await db.query(
    `SELECT COUNT(*) AS n FROM hopdong
      WHERE ngay_dat = ? AND id_mon > 0 AND soluong > 0 AND trangthai_bep IN (1, 2)
        AND COALESCE(loai_don, '') <> 'giao_hang' AND tinhtrang IN (0, 1, 5, 6)`, [ngay]);
  const [no] = await db.query(
    `SELECT h.sesis, MAX(b.number_ban) AS ban, SUM(h.thanhtien) AS tien
       FROM hopdong h LEFT JOIN ban b ON b.Id_ban = h.id_ban
      WHERE h.ngay_dat = ? AND h.id_mon > 0 AND h.soluong > 0
        AND COALESCE(h.loai_don, '') <> 'giao_hang' AND h.tinhtrang IN (1, 5, 6)
      GROUP BY h.sesis HAVING tien > 0`, [ngay]);
  const tienNo = no.reduce((s, x) => s + Number(x.tien || 0), 0);
  const kq = {
    ngay, so_mon_huy: mon.length, gia_tri_huy: giaTri, so_mon_da_nau: Number(nau.n) || 0,
    so_ban_con_no: no.length, tien_con_no: tienNo,
    ban_con_no: no.slice(0, 20).map((x) => ({ sesis: x.sesis, ban: x.ban, tien: Number(x.tien) })),
  };
  await db.query(
    `INSERT INTO chot_ngay_log (ngay, so_mon_huy, gia_tri_huy, so_mon_da_nau, so_ban_con_no, tien_con_no, chi_tiet)
     VALUES (?,?,?,?,?,?,?)`,
    [ngay, kq.so_mon_huy, kq.gia_tri_huy, kq.so_mon_da_nau, kq.so_ban_con_no, kq.tien_con_no, JSON.stringify(kq.ban_con_no)]);

  if (!khongBao && (kq.so_mon_huy || kq.so_mon_da_nau || kq.so_ban_con_no)) {
    const dong = [];
    if (kq.so_mon_huy) dong.push(`Đã tự hủy ${kq.so_mon_huy} món chưa chế biến (${vnd(kq.gia_tri_huy)}) - xem Nhật ký hủy món.`);
    if (kq.so_mon_da_nau) dong.push(`${kq.so_mon_da_nau} món bếp đã làm nhưng chưa lên bàn - kiểm tra hao hụt.`);
    if (kq.so_ban_con_no) {
      dong.push(`${kq.so_ban_con_no} hóa đơn chưa thanh toán, tổng ${vnd(kq.tien_con_no)}: `
        + kq.ban_con_no.slice(0, 6).map((x) => (x.ban ? 'bàn ' + x.ban : x.sesis) + ' ' + vnd(x.tien)).join(', ')
        + (kq.so_ban_con_no > 6 ? '…' : '') + '.');
    }
    await require('./thongBaoService').gui('chot_cuoi_ngay', {
      tieuDe: `Chốt cuối ngày ${ngay.split('-').reverse().join('/')}`,
      noiDung: dong.join(' '),
      link: kq.so_ban_con_no ? '/staff/thanh-toan' : '/staff/kitchen/thong-ke',
      mucDo: kq.so_ban_con_no ? 'quan_trong' : 'tin',
    }).catch(() => {});
  }
  return kq;
}

/** Chot moi ngay da qua chua chot, tu moc `chot_ngay.tu_ngay` den hom qua. */
async function chotCacNgayDaQua() {
  await damBaoBang();
  const tu = await docMoc();
  const homQua = new Date(); homQua.setDate(homQua.getDate() - 1);
  const den = ngayStr(homQua);
  if (tu > den) return [];
  const [da] = await db.query('SELECT DATE_FORMAT(ngay, "%Y-%m-%d") AS n FROM chot_ngay_log WHERE ngay BETWEEN ? AND ?', [tu, den]);
  const daChot = new Set(da.map((x) => x.n));
  const ra = [];
  for (let d = new Date(`${tu}T00:00:00`); ngayStr(d) <= den; d.setDate(d.getDate() + 1)) {
    const n = ngayStr(d);
    if (daChot.has(n)) continue;
    const kq = await chotMotNgay(n);
    if (kq) ra.push(kq);
  }
  return ra;
}

let _vong = null;
function batVong() {
  if (_vong) return;
  const chay = () => chotCacNgayDaQua()
    .then((ds) => { if (ds.length) console.log(`[chot-ngay] Đã chốt ${ds.length} ngày: ${ds.map((x) => `${x.ngay} (hủy ${x.so_mon_huy} món, ${x.so_ban_con_no} bàn còn nợ)`).join('; ')}`); })
    .catch((e) => console.error('[chot-ngay]', e.message || e));
  setTimeout(chay, 15000);
  _vong = setInterval(chay, 30 * 60000);
  if (_vong.unref) _vong.unref();
}

/**
 * Chot ton dong cu (cac ngay TRUOC moc chot_ngay.tu_ngay) - chay mot lan theo
 * quyet dinh cua quan ly. Gui MOT thong bao tong hop thay vi moi ngay mot cai.
 */
async function chotTonDong() {
  await damBaoBang();
  const tu = await docMoc();
  const [ds] = await db.query(
    `SELECT DISTINCT DATE_FORMAT(ngay_dat, '%Y-%m-%d') AS n FROM hopdong
      WHERE ngay_dat < ? AND id_mon > 0 AND soluong > 0 AND COALESCE(loai_don, '') <> 'giao_hang'
        AND tinhtrang IN (0, 1, 5, 6) ORDER BY n`, [tu]);
  const ra = [];
  for (const x of ds) { const kq = await chotMotNgay(x.n, { khongBao: true }); if (kq) ra.push(kq); }
  const tong = ra.reduce((a, k) => ({ mon: a.mon + k.so_mon_huy, tien: a.tien + k.gia_tri_huy, nau: a.nau + k.so_mon_da_nau, no: a.no + k.so_ban_con_no, tienNo: a.tienNo + k.tien_con_no }), { mon: 0, tien: 0, nau: 0, no: 0, tienNo: 0 });
  if (ra.length) {
    await require('./thongBaoService').gui('chot_cuoi_ngay', {
      tieuDe: `Chốt tồn đọng ${ra.length} ngày cũ (trước ${tu.split('-').reverse().join('/')})`,
      noiDung: `Đã tự hủy ${tong.mon} món chưa chế biến (${vnd(tong.tien)}). Còn ${tong.nau} món đã nấu chưa lên bàn và ${tong.no} hóa đơn chưa thanh toán (${vnd(tong.tienNo)}) cần quản lý / thu ngân xử lý.`,
      link: '/staff/thanh-toan', mucDo: 'quan_trong',
    }).catch(() => {});
  }
  return { so_ngay: ra.length, ...tong, cac_ngay: ra };
}

module.exports = { chotTonDong, chotMotNgay, chotCacNgayDaQua, batVong, LY_DO, TEN_LY_DO, docMoc };
