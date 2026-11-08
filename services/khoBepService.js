/**
 * KHO BEP: phieu nhap (theo lo, han dung), phieu xuat (hu hong, hao hut...),
 * tru lo FIFO, don mua hang NVL, goi y mua.
 *
 * NGUON SU THAT TON KHO: `nguyen_lieu.so_luong`. Lo hang (`chi_tiet_phieu_nhap.
 * so_luong_con_lai`) chi de biet HANG NAO SAP HET HAN; tong lo co the nho hon
 * ton that vi hang ton tu truoc khi co quan ly lo khong co lo nao - phan do
 * hien la "ton khong theo lo".
 *
 * GIA VON: binh quan gia quyen, cap nhat moi lan nhap:
 *     gia_moi = (ton * gia_cu + sl_nhap * gia_nhap) / (ton + sl_nhap)
 * Phieu xuat chup lai gia von LUC XUAT vao `xuat_kho.gia_tri` - gia von doi theo
 * thoi gian, tinh lai sau nay se sai.
 */
const db = require('../config/db');

const LY_DO_XUAT = {
  hu_hong: { ten: 'Hư hỏng', icon: 'fa-heart-crack', mau: '#b3352c', la_hao_hut: true },
  het_han: { ten: 'Hết hạn sử dụng', icon: 'fa-calendar-xmark', mau: '#c2410c', la_hao_hut: true },
  hao_hut: { ten: 'Hao hụt / đổ vỡ', icon: 'fa-wine-glass', mau: '#a16207', la_hao_hut: true },
  che_bien_loi: { ten: 'Chế biến lỗi / khách trả', icon: 'fa-rotate-left', mau: '#9333ea', la_hao_hut: true },
  dung_noi_bo: { ten: 'Dùng nội bộ (cơm NV, thử món)', icon: 'fa-users', mau: '#2b5f8a', la_hao_hut: false },
  tra_ncc: { ten: 'Trả nhà cung cấp', icon: 'fa-truck-ramp-box', mau: '#475569', la_hao_hut: false },
  kiem_ke: { ten: 'Điều chỉnh kiểm kê (thiếu)', icon: 'fa-clipboard-list', mau: '#0f766e', la_hao_hut: true },
};
const LY_DO_BAN_HANG = ['ban_hang', 'ban_hang_mo_phong'];

const TRANG_THAI_DON = {
  nhap: 'Nháp', cho_duyet: 'Chờ duyệt', da_duyet: 'Đã duyệt', da_dat: 'Đã đặt NCC',
  nhan_mot_phan: 'Nhận một phần', da_nhan: 'Đã nhận đủ', huy: 'Đã hủy',
};

class LoiKho extends Error {
  constructor(msg, ma = 'INVALID') { super(msg); this.name = 'LoiKho'; this.ma = ma; }
}

const so = (v) => { const n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const lamTron = (n, k = 3) => Math.round(n * 10 ** k) / 10 ** k;

async function sinhMa(conn, bang, cot, tienTo) {
  const d = new Date();
  const goc = `${tienTo}${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const [[r]] = await conn.query(`SELECT COUNT(*) AS n FROM ${bang} WHERE ${cot} LIKE ?`, [`${goc}-%`]);
  return `${goc}-${String(Number(r.n) + 1).padStart(3, '0')}`;
}

// ------------------------------------------------------------------ doc

async function danhSachNVL() {
  const [rows] = await db.query(`
    SELECT nl.id_nl, nl.ten_nl, nl.so_luong, nl.dinh_muc_min, nl.gia_von, nl.han_su_dung_ngay, dvt.ten_dvt,
           COALESCE(lo.ton_lo, 0) AS ton_theo_lo, lo.hsd_gan_nhat,
           (SELECT pn.id_ncc FROM chi_tiet_phieu_nhap c JOIN phieu_nhap pn ON pn.id_pn = c.id_pn
             WHERE c.id_nl = nl.id_nl ORDER BY pn.ngay_nhap DESC, c.id_ct DESC LIMIT 1) AS ncc_gan_nhat
      FROM nguyen_lieu nl
      LEFT JOIN don_vi_tinh dvt ON dvt.id_dvt = nl.id_dvt
      LEFT JOIN (SELECT id_nl, SUM(so_luong_con_lai) AS ton_lo, MIN(han_su_dung) AS hsd_gan_nhat
                   FROM chi_tiet_phieu_nhap WHERE so_luong_con_lai > 0 GROUP BY id_nl) lo ON lo.id_nl = nl.id_nl
     ORDER BY nl.ten_nl`);
  return rows.map((r) => ({ ...r, so_luong: Number(r.so_luong), dinh_muc_min: Number(r.dinh_muc_min), gia_von: Number(r.gia_von), ton_theo_lo: Number(r.ton_theo_lo) }));
}

async function danhSachNCC() {
  const [rows] = await db.query('SELECT id_ncc, ten_ncc, sodienthoai FROM nha_cung_cap WHERE trangthai = 1 ORDER BY ten_ncc');
  return rows;
}

/** Lo con hang, sap / da het han. `trongNgay` = canh bao truoc bao nhieu ngay. */
async function loHang({ trongNgay = 3, chiCanhBao = false } = {}) {
  const [rows] = await db.query(`
    SELECT c.id_ct, c.id_nl, nl.ten_nl, dvt.ten_dvt, c.so_lo, c.han_su_dung, c.so_luong, c.so_luong_con_lai, c.gia_nhap,
           pn.ma_phieu, pn.ngay_nhap, ncc.ten_ncc,
           DATEDIFF(c.han_su_dung, CURDATE()) AS con_ngay
      FROM chi_tiet_phieu_nhap c
      JOIN nguyen_lieu nl ON nl.id_nl = c.id_nl
      LEFT JOIN don_vi_tinh dvt ON dvt.id_dvt = nl.id_dvt
      JOIN phieu_nhap pn ON pn.id_pn = c.id_pn
      LEFT JOIN nha_cung_cap ncc ON ncc.id_ncc = pn.id_ncc
     WHERE c.so_luong_con_lai > 0
       ${chiCanhBao ? 'AND c.han_su_dung IS NOT NULL AND c.han_su_dung <= CURDATE() + INTERVAL ? DAY' : ''}
     ORDER BY c.han_su_dung IS NULL, c.han_su_dung, nl.ten_nl
     LIMIT 500`, chiCanhBao ? [trongNgay] : []);
  return rows.map((r) => ({ ...r, so_luong_con_lai: Number(r.so_luong_con_lai), gia_nhap: Number(r.gia_nhap), con_ngay: r.con_ngay == null ? null : Number(r.con_ngay) }));
}

// ------------------------------------------------------------------ tru lo FIFO

/**
 * Tru `soLuong` khoi cac lo cua mot NVL: lo HET HAN SOM NHAT truoc (FEFO), lo
 * khong ghi han dung tru sau cung. Phan vuot qua tong lo la hang "khong theo
 * lo" - bo qua, khong bao loi (ton that do nguyen_lieu.so_luong quyet dinh).
 */
async function truLoFIFO(conn, idNl, soLuong) {
  let con = Number(soLuong);
  if (!(con > 0)) return;
  const [lo] = await conn.query(
    `SELECT id_ct, so_luong_con_lai FROM chi_tiet_phieu_nhap
      WHERE id_nl = ? AND so_luong_con_lai > 0
      ORDER BY han_su_dung IS NULL, han_su_dung, id_ct FOR UPDATE`, [idNl]);
  for (const l of lo) {
    if (con <= 0) break;
    const tru = Math.min(con, Number(l.so_luong_con_lai));
    await conn.query('UPDATE chi_tiet_phieu_nhap SET so_luong_con_lai = GREATEST(so_luong_con_lai - ?, 0) WHERE id_ct = ?', [tru, l.id_ct]);
    con -= tru;
  }
}

// ------------------------------------------------------------------ phieu nhap

/**
 * @param {{id_ncc, ghi_chu, id_dmh, dong: {id_nl, so_luong, don_gia, so_lo, han_su_dung}[]}} body
 */
async function taoPhieuNhap(body, idNv) {
  const dong = (Array.isArray(body.dong) ? body.dong : [])
    .map((d) => ({ id_nl: Number(d.id_nl), so_luong: so(d.so_luong), don_gia: so(d.don_gia), so_lo: String(d.so_lo || '').trim().slice(0, 50), han_su_dung: String(d.han_su_dung || '') }))
    .filter((d) => d.id_nl);
  if (!dong.length) throw new LoiKho('Phiếu nhập cần ít nhất một nguyên liệu.');
  for (const d of dong) {
    if (!(d.so_luong > 0)) throw new LoiKho('Số lượng nhập phải lớn hơn 0.');
    if (!(d.don_gia >= 0)) throw new LoiKho('Đơn giá không hợp lệ.');
    if (d.han_su_dung && !/^\d{4}-\d{2}-\d{2}$/.test(d.han_su_dung)) throw new LoiKho('Hạn sử dụng không hợp lệ.');
  }
  const idNcc = Number(body.id_ncc) || null;
  const idDmh = Number(body.id_dmh) || null;
  // Them cot cong no TRUOC transaction: ALTER TABLE trong MySQL tu commit ngam.
  const congNo = require('./congNoNccService');
  await congNo.damBaoCot();

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const ma = await sinhMa(conn, 'phieu_nhap', 'ma_phieu', 'PN');
    const tong = dong.reduce((s, d) => s + d.so_luong * d.don_gia, 0);
    const [kq] = await conn.query(
      `INSERT INTO phieu_nhap (ma_phieu, id_ncc, id_nv, ngay_nhap, thoi_diem, tong_tien, ghi_chu, trangthai, id_dmh)
       VALUES (?, ?, ?, CURDATE(), NOW(), ?, ?, 1, ?)`,
      [ma, idNcc, idNv || null, Math.round(tong), String(body.ghi_chu || '').slice(0, 500) || null, idDmh]);
    const idPn = kq.insertId;
    // Phieu co nha cung cap -> phat sinh cong no, han tra mac dinh.
    await congNo.datHanTra(conn, idPn, idNcc);

    for (const d of dong) {
      const [[nl]] = await conn.query('SELECT so_luong, gia_von, han_su_dung_ngay FROM nguyen_lieu WHERE id_nl = ? FOR UPDATE', [d.id_nl]);
      if (!nl) throw new LoiKho('Nguyên liệu không tồn tại.');
      const hsd = d.han_su_dung || null;
      await conn.query(
        `INSERT INTO chi_tiet_phieu_nhap (id_pn, id_nl, so_luong, gia_nhap, so_lo, han_su_dung, so_luong_con_lai)
         VALUES (?, ?, ?, ?, ?, COALESCE(?, CURDATE() + INTERVAL ? DAY), ?)`,
        [idPn, d.id_nl, d.so_luong, d.don_gia, d.so_lo || ma, hsd, Number(nl.han_su_dung_ngay) || 30, d.so_luong]);
      const ton = Math.max(0, Number(nl.so_luong));
      const giaMoi = ton + d.so_luong > 0 && d.don_gia > 0
        ? (ton * Number(nl.gia_von) + d.so_luong * d.don_gia) / (ton + d.so_luong)
        : Number(nl.gia_von);
      await conn.query('UPDATE nguyen_lieu SET so_luong = so_luong + ?, gia_von = ? WHERE id_nl = ?', [d.so_luong, Math.round(giaMoi * 100) / 100, d.id_nl]);
      if (idDmh) {
        await conn.query('UPDATE chi_tiet_don_mua SET so_luong_da_nhan = so_luong_da_nhan + ? WHERE id_dmh = ? AND id_nl = ?', [d.so_luong, idDmh, d.id_nl]);
      }
    }

    if (idDmh) {
      const [[con]] = await conn.query(
        'SELECT SUM(so_luong_da_nhan < so_luong) AS thieu FROM chi_tiet_don_mua WHERE id_dmh = ?', [idDmh]);
      await conn.query('UPDATE don_mua_hang SET trang_thai = ? WHERE id_dmh = ?', [Number(con.thieu) > 0 ? 'nhan_mot_phan' : 'da_nhan', idDmh]);
    }
    await conn.commit();
    return { id: idPn, ma_phieu: ma, tong_tien: Math.round(tong) };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// ------------------------------------------------------------------ phieu xuat

async function taoPhieuXuat(body, idNv) {
  const lyDo = String(body.ly_do || '');
  if (!LY_DO_XUAT[lyDo]) throw new LoiKho('Chọn lý do xuất kho.');
  const dong = (Array.isArray(body.dong) ? body.dong : [])
    .map((d) => ({ id_nl: Number(d.id_nl), so_luong: so(d.so_luong), ghi_chu: String(d.ghi_chu || '').trim().slice(0, 255) }))
    .filter((d) => d.id_nl);
  if (!dong.length) throw new LoiKho('Phiếu xuất cần ít nhất một nguyên liệu.');
  if (dong.some((d) => !(d.so_luong > 0))) throw new LoiKho('Số lượng xuất phải lớn hơn 0.');
  const ghiChu = String(body.ghi_chu || '').trim();
  if (LY_DO_XUAT[lyDo].la_hao_hut && ghiChu.length < 3) throw new LoiKho('Xuất hủy / hao hụt bắt buộc ghi rõ nguyên nhân.');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const ma = await sinhMa(conn, 'phieu_xuat', 'ma_phieu', 'PX');
    const [kq] = await conn.query(
      'INSERT INTO phieu_xuat (ma_phieu, ly_do, id_nv, thoi_diem, ghi_chu) VALUES (?, ?, ?, NOW(), ?)',
      [ma, lyDo, idNv || null, ghiChu.slice(0, 500) || null]);
    const idPx = kq.insertId;
    let tong = 0;
    for (const d of dong) {
      const [[nl]] = await conn.query('SELECT ten_nl, so_luong, gia_von FROM nguyen_lieu WHERE id_nl = ? FOR UPDATE', [d.id_nl]);
      if (!nl) throw new LoiKho('Nguyên liệu không tồn tại.');
      if (Number(nl.so_luong) + 1e-9 < d.so_luong) {
        throw new LoiKho(`${nl.ten_nl}: tồn kho chỉ còn ${lamTron(Number(nl.so_luong))}, không đủ để xuất ${d.so_luong}.`);
      }
      const giaTri = Math.round(d.so_luong * Number(nl.gia_von));
      tong += giaTri;
      await conn.query('UPDATE nguyen_lieu SET so_luong = GREATEST(so_luong - ?, 0) WHERE id_nl = ?', [d.so_luong, d.id_nl]);
      await truLoFIFO(conn, d.id_nl, d.so_luong);
      await conn.query(
        `INSERT INTO xuat_kho (id_nl, so_luong, ly_do, ngay_xuat, id_px, gia_tri, ghi_chu)
         VALUES (?, ?, ?, CURDATE(), ?, ?, ?)`, [d.id_nl, d.so_luong, lyDo, idPx, giaTri, d.ghi_chu || null]);
    }
    await conn.query('UPDATE phieu_xuat SET tong_gia_tri = ? WHERE id_px = ?', [tong, idPx]);
    await conn.commit();
    return { id: idPx, ma_phieu: ma, tong_gia_tri: tong };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// ------------------------------------------------------------------ so kho

async function soKho({ tuNgay, denNgay, loai = '', lyDo = '' }) {
  const ra = [];
  if (loai !== 'xuat') {
    const [pn] = await db.query(`
      SELECT pn.id_pn AS id, pn.ma_phieu, COALESCE(pn.thoi_diem, pn.ngay_nhap) AS thoi_diem, pn.tong_tien AS gia_tri,
             pn.ghi_chu, ncc.ten_ncc, nv.ten AS nguoi, dmh.ma_don,
             (SELECT COUNT(*) FROM chi_tiet_phieu_nhap c WHERE c.id_pn = pn.id_pn) AS so_dong
        FROM phieu_nhap pn
        LEFT JOIN nha_cung_cap ncc ON ncc.id_ncc = pn.id_ncc
        LEFT JOIN nhan_vien nv ON nv.id_nv = pn.id_nv
        LEFT JOIN don_mua_hang dmh ON dmh.id_dmh = pn.id_dmh
       WHERE pn.ngay_nhap BETWEEN ? AND ?
       ORDER BY thoi_diem DESC LIMIT 300`, [tuNgay, denNgay]);
    pn.forEach((r) => ra.push({ ...r, loai: 'nhap', gia_tri: Number(r.gia_tri), ten_loai: 'Nhập kho' }));
  }
  if (loai !== 'nhap') {
    const [px] = await db.query(`
      SELECT px.id_px AS id, px.ma_phieu, px.thoi_diem, px.tong_gia_tri AS gia_tri, px.ghi_chu, px.ly_do, nv.ten AS nguoi,
             (SELECT COUNT(*) FROM xuat_kho x WHERE x.id_px = px.id_px) AS so_dong
        FROM phieu_xuat px LEFT JOIN nhan_vien nv ON nv.id_nv = px.id_nv
       WHERE DATE(px.thoi_diem) BETWEEN ? AND ? ${lyDo ? 'AND px.ly_do = ?' : ''}
       ORDER BY px.thoi_diem DESC LIMIT 300`, lyDo ? [tuNgay, denNgay, lyDo] : [tuNgay, denNgay]);
    px.forEach((r) => ra.push({ ...r, loai: 'xuat', gia_tri: Number(r.gia_tri), ten_loai: (LY_DO_XUAT[r.ly_do] || {}).ten || r.ly_do }));
  }
  return ra.sort((a, b) => new Date(b.thoi_diem) - new Date(a.thoi_diem));
}

async function chiTietPhieu(loai, id) {
  if (loai === 'nhap') {
    const [[p]] = await db.query(`
      SELECT pn.*, COALESCE(pn.thoi_diem, pn.ngay_nhap) AS thoi_diem, ncc.ten_ncc, ncc.sodienthoai, nv.ten AS nguoi, dmh.ma_don
        FROM phieu_nhap pn LEFT JOIN nha_cung_cap ncc ON ncc.id_ncc = pn.id_ncc
        LEFT JOIN nhan_vien nv ON nv.id_nv = pn.id_nv LEFT JOIN don_mua_hang dmh ON dmh.id_dmh = pn.id_dmh
       WHERE pn.id_pn = ?`, [id]);
    if (!p) return null;
    const [dong] = await db.query(`
      SELECT c.*, nl.ten_nl, dvt.ten_dvt FROM chi_tiet_phieu_nhap c JOIN nguyen_lieu nl ON nl.id_nl = c.id_nl
        LEFT JOIN don_vi_tinh dvt ON dvt.id_dvt = nl.id_dvt WHERE c.id_pn = ? ORDER BY c.id_ct`, [id]);
    return { loai, p, dong: dong.map((d) => ({ ...d, thanh_tien: Number(d.so_luong) * Number(d.gia_nhap) })) };
  }
  const [[p]] = await db.query(`
    SELECT px.*, nv.ten AS nguoi FROM phieu_xuat px LEFT JOIN nhan_vien nv ON nv.id_nv = px.id_nv WHERE px.id_px = ?`, [id]);
  if (!p) return null;
  const [dong] = await db.query(`
    SELECT x.*, nl.ten_nl, dvt.ten_dvt FROM xuat_kho x JOIN nguyen_lieu nl ON nl.id_nl = x.id_nl
      LEFT JOIN don_vi_tinh dvt ON dvt.id_dvt = nl.id_dvt WHERE x.id_px = ? ORDER BY x.id_xk`, [id]);
  return { loai, p: { ...p, ten_ly_do: (LY_DO_XUAT[p.ly_do] || {}).ten || p.ly_do }, dong };
}

// ------------------------------------------------------------------ mua hang

/**
 * Tieu hao binh quan / ngay cua tung NVL trong 28 ngay CO DU LIEU gan nhat.
 * Neo vao ngay xuat kho cuoi cung chu khong phai hom nay: khi bep nghi vai
 * ngay (hoac du lieu mo phong dung lai), lay 28 ngay tinh tu hom nay se ra 0
 * va goi y mua bang 0 - sai ngay lan dau dung.
 */
async function tieuHaoBinhQuan() {
  const [[m]] = await db.query("SELECT MAX(ngay_xuat) AS cuoi FROM xuat_kho WHERE ly_do IN ('ban_hang','ban_hang_mo_phong')");
  if (!m || !m.cuoi) return new Map();
  const [rows] = await db.query(`
    SELECT id_nl, SUM(so_luong) / 28 AS ngay FROM xuat_kho
     WHERE ly_do IN ('ban_hang','ban_hang_mo_phong') AND ngay_xuat > ? - INTERVAL 28 DAY AND ngay_xuat <= ?
     GROUP BY id_nl`, [m.cuoi, m.cuoi]);
  return new Map(rows.map((r) => [Number(r.id_nl), Number(r.ngay)]));
}

/**
 * Goi y mua: NVL co ton duoi DIEM DAT HANG = max(dinh muc, 3 ngay tieu hao).
 * So luong de xuat du cho 7 ngay tieu hao (toi thieu gap doi dinh muc), tru
 * ton hien co va hang da dat chua nhan.
 */
async function goiYMuaHang() {
  const [nvl, th] = await Promise.all([danhSachNVL(), tieuHaoBinhQuan()]);
  const [dangVe] = await db.query(`
    SELECT c.id_nl, SUM(GREATEST(c.so_luong - c.so_luong_da_nhan, 0)) AS sl
      FROM chi_tiet_don_mua c JOIN don_mua_hang d ON d.id_dmh = c.id_dmh
     WHERE d.trang_thai IN ('cho_duyet','da_duyet','da_dat','nhan_mot_phan') GROUP BY c.id_nl`);
  const mapVe = new Map(dangVe.map((r) => [Number(r.id_nl), Number(r.sl)]));
  const ra = [];
  for (const n of nvl) {
    const ngay = th.get(n.id_nl) || 0;
    const diemDat = Math.max(n.dinh_muc_min, ngay * 3);
    const ve = mapVe.get(n.id_nl) || 0;
    if (n.so_luong + ve >= diemDat || diemDat <= 0) continue;
    const mucTieu = Math.max(n.dinh_muc_min * 2, ngay * 7);
    const deXuat = Math.max(0, mucTieu - n.so_luong - ve);
    if (deXuat <= 0) continue;
    ra.push({
      ...n, tieu_hao_ngay: lamTron(ngay, 2), dang_ve: lamTron(ve), diem_dat: lamTron(diemDat, 2),
      de_xuat: Math.ceil(deXuat * 10) / 10,
      con_du_ngay: ngay > 0 ? lamTron(n.so_luong / ngay, 1) : null,
      muc_do: n.so_luong <= 0 ? 'het' : n.so_luong < n.dinh_muc_min ? 'duoi_dinh_muc' : 'sap_het',
    });
  }
  const thuTu = { het: 0, duoi_dinh_muc: 1, sap_het: 2 };
  return ra.sort((a, b) => thuTu[a.muc_do] - thuTu[b.muc_do] || (a.con_du_ngay ?? 0) - (b.con_du_ngay ?? 0));
}

async function danhSachDon({ trangThai = '' } = {}) {
  const [rows] = await db.query(`
    SELECT d.*, ncc.ten_ncc, nt.ten AS nguoi_tao, nd.ten AS nguoi_duyet,
           (SELECT COUNT(*) FROM chi_tiet_don_mua c WHERE c.id_dmh = d.id_dmh) AS so_dong
      FROM don_mua_hang d LEFT JOIN nha_cung_cap ncc ON ncc.id_ncc = d.id_ncc
      LEFT JOIN nhan_vien nt ON nt.id_nv = d.id_nv_tao LEFT JOIN nhan_vien nd ON nd.id_nv = d.id_nv_duyet
     ${trangThai ? 'WHERE d.trang_thai = ?' : ''}
     ORDER BY FIELD(d.trang_thai,'cho_duyet','da_duyet','da_dat','nhan_mot_phan','nhap','da_nhan','huy'), d.created_at DESC
     LIMIT 200`, trangThai ? [trangThai] : []);
  return rows.map((r) => ({ ...r, tong_tien: Number(r.tong_tien), ten_trang_thai: TRANG_THAI_DON[r.trang_thai] }));
}

async function chiTietDon(id) {
  const [[d]] = await db.query(`
    SELECT d.*, ncc.ten_ncc, ncc.sodienthoai, ncc.diachi, nt.ten AS nguoi_tao, nd.ten AS nguoi_duyet
      FROM don_mua_hang d LEFT JOIN nha_cung_cap ncc ON ncc.id_ncc = d.id_ncc
      LEFT JOIN nhan_vien nt ON nt.id_nv = d.id_nv_tao LEFT JOIN nhan_vien nd ON nd.id_nv = d.id_nv_duyet
     WHERE d.id_dmh = ?`, [id]);
  if (!d) return null;
  const [dong] = await db.query(`
    SELECT c.*, nl.ten_nl, nl.han_su_dung_ngay, dvt.ten_dvt FROM chi_tiet_don_mua c
      JOIN nguyen_lieu nl ON nl.id_nl = c.id_nl LEFT JOIN don_vi_tinh dvt ON dvt.id_dvt = nl.id_dvt
     WHERE c.id_dmh = ? ORDER BY c.id`, [id]);
  return {
    ...d, tong_tien: Number(d.tong_tien), ten_trang_thai: TRANG_THAI_DON[d.trang_thai],
    dong: dong.map((x) => ({ ...x, so_luong: Number(x.so_luong), don_gia: Number(x.don_gia), so_luong_da_nhan: Number(x.so_luong_da_nhan) })),
  };
}

async function taoDonMua(body, idNv) {
  const dong = (Array.isArray(body.dong) ? body.dong : [])
    .map((d) => ({ id_nl: Number(d.id_nl), so_luong: so(d.so_luong), don_gia: so(d.don_gia) || 0 }))
    .filter((d) => d.id_nl);
  if (!dong.length) throw new LoiKho('Đơn mua cần ít nhất một nguyên liệu.');
  if (dong.some((d) => !(d.so_luong > 0))) throw new LoiKho('Số lượng đặt phải lớn hơn 0.');
  if (new Set(dong.map((d) => d.id_nl)).size !== dong.length) throw new LoiKho('Một nguyên liệu bị lặp trong đơn – gộp lại thành một dòng.');
  const ngayGiao = /^\d{4}-\d{2}-\d{2}$/.test(String(body.ngay_giao_du_kien || '')) ? body.ngay_giao_du_kien : null;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const ma = await sinhMa(conn, 'don_mua_hang', 'ma_don', 'DM');
    const tong = dong.reduce((s, d) => s + d.so_luong * d.don_gia, 0);
    const [kq] = await conn.query(
      `INSERT INTO don_mua_hang (ma_don, id_ncc, trang_thai, ngay_giao_du_kien, tong_tien, ghi_chu, id_nv_tao)
       VALUES (?, ?, 'cho_duyet', ?, ?, ?, ?)`,
      [ma, Number(body.id_ncc) || null, ngayGiao, Math.round(tong), String(body.ghi_chu || '').slice(0, 500) || null, idNv || null]);
    for (const d of dong) {
      await conn.query('INSERT INTO chi_tiet_don_mua (id_dmh, id_nl, so_luong, don_gia) VALUES (?, ?, ?, ?)', [kq.insertId, d.id_nl, d.so_luong, d.don_gia]);
    }
    await conn.commit();
    return { id: kq.insertId, ma_don: ma };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** Chuyen trang thai don. Ai duoc lam gi do route kiem tra. */
const BUOC_DON = {
  duyet: { tu: ['cho_duyet'], den: 'da_duyet' },
  dat_hang: { tu: ['da_duyet'], den: 'da_dat' },
  huy: { tu: ['nhap', 'cho_duyet', 'da_duyet', 'da_dat'], den: 'huy' },
};
async function doiTrangThaiDon(id, buoc, { idNv, lyDo } = {}) {
  const b = BUOC_DON[buoc];
  if (!b) throw new LoiKho('Thao tác không hợp lệ.');
  const [[d]] = await db.query('SELECT trang_thai FROM don_mua_hang WHERE id_dmh = ?', [id]);
  if (!d) throw new LoiKho('Không tìm thấy đơn mua.', 'NOT_FOUND');
  if (!b.tu.includes(d.trang_thai)) throw new LoiKho(`Đơn đang ở trạng thái "${TRANG_THAI_DON[d.trang_thai]}", không thể ${buoc === 'duyet' ? 'duyệt' : buoc === 'huy' ? 'hủy' : 'đánh dấu đã đặt'}.`);
  if (buoc === 'huy' && String(lyDo || '').trim().length < 3) throw new LoiKho('Ghi lý do hủy đơn.');
  await db.query(
    `UPDATE don_mua_hang SET trang_thai = ?,
       id_nv_duyet = IF(? = 'da_duyet', ?, id_nv_duyet), duyet_luc = IF(? = 'da_duyet', NOW(), duyet_luc),
       ly_do_huy = IF(? = 'huy', ?, ly_do_huy)
     WHERE id_dmh = ?`, [b.den, b.den, idNv || null, b.den, b.den, String(lyDo || '').slice(0, 300), id]);
  return { ok: true };
}

module.exports = {
  LY_DO_XUAT, LY_DO_BAN_HANG, TRANG_THAI_DON, LoiKho,
  danhSachNVL, danhSachNCC, loHang, truLoFIFO, taoPhieuNhap, taoPhieuXuat, soKho, chiTietPhieu,
  tieuHaoBinhQuan, goiYMuaHang, danhSachDon, chiTietDon, taoDonMua, doiTrangThaiDon,
};
