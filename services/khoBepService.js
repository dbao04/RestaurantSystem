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
             WHERE c.id_nl = nl.id_nl AND pn.id_ncc IS NOT NULL ORDER BY pn.ngay_nhap DESC, c.id_ct DESC LIMIT 1) AS ncc_gan_nhat,
           (SELECT c.gia_nhap FROM chi_tiet_phieu_nhap c JOIN phieu_nhap pn ON pn.id_pn = c.id_pn
             WHERE c.id_nl = nl.id_nl AND pn.id_ncc IS NOT NULL ORDER BY pn.ngay_nhap DESC, c.id_ct DESC LIMIT 1) AS gia_nhap_gan_nhat
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
 * Ghi MOT dong phieu nhap vao kho: so luong dat -> lo hang, cong ton, gia von
 * binh quan gia quyen, cong "da nhan" cua don mua. Dung chung cho nhap truc
 * tiep (noi bo / tat QC) va buoc kiem tra chat luong (duyetNhapKhoService).
 */
async function nhapDongVaoKho(conn, { idCt, idNl, soLuong, donGia, idDmh }) {
  const [[nl]] = await conn.query('SELECT so_luong, gia_von FROM nguyen_lieu WHERE id_nl = ? FOR UPDATE', [idNl]);
  if (!nl) throw new LoiKho('Nguyên liệu không tồn tại.');
  await conn.query('UPDATE chi_tiet_phieu_nhap SET so_luong = ?, so_luong_con_lai = ? WHERE id_ct = ?', [soLuong, soLuong, idCt]);
  const ton = Math.max(0, Number(nl.so_luong));
  const giaMoi = ton + soLuong > 0 && donGia > 0
    ? (ton * Number(nl.gia_von) + soLuong * donGia) / (ton + soLuong)
    : Number(nl.gia_von);
  await conn.query('UPDATE nguyen_lieu SET so_luong = so_luong + ?, gia_von = ? WHERE id_nl = ?', [soLuong, Math.round(giaMoi * 100) / 100, idNl]);
  if (idDmh) {
    await conn.query('UPDATE chi_tiet_don_mua SET so_luong_da_nhan = so_luong_da_nhan + ? WHERE id_dmh = ? AND id_nl = ?', [soLuong, idDmh, idNl]);
  }
}

/** Don mua sau mot lan nhan hang: con thieu -> 'nhan_mot_phan', du -> 'da_nhan'. */
async function capNhatTrangThaiDonSauNhan(conn, idDmh) {
  const [[con]] = await conn.query(
    'SELECT SUM(so_luong_da_nhan < so_luong) AS thieu FROM chi_tiet_don_mua WHERE id_dmh = ?', [idDmh]);
  await conn.query('UPDATE don_mua_hang SET trang_thai = ? WHERE id_dmh = ?', [Number(con.thieu) > 0 ? 'nhan_mot_phan' : 'da_nhan', idDmh]);
}

/**
 * Lap phieu nhap.
 *
 * Phieu NHAN HANG thuong (thu kho lap) di qua quy trinh duyet
 * (services/duyetNhapKhoService.js): bat buoc so hoa don / phieu giao hang
 * (hoac ly do khong co), roi CHO bep truong kiem chat luong - hang CHUA vao kho.
 * Tat buoc QC trong cau hinh -> vao kho ngay va sang buoc ke toan.
 *
 * `noiBo: true` (dieu chinh kiem ke thua...): vao kho ngay, 'da_duyet' - khong
 * phai mua hang, khong phat sinh cong no.
 *
 * @param {{id_ncc, ghi_chu, id_dmh, so_chung_tu, ly_do_khong_chung_tu, anh_chung_tu,
 *          dong: {id_nl, so_luong, don_gia, so_lo, han_su_dung}[]}} body
 */
async function taoPhieuNhap(body, idNv, { noiBo = false } = {}) {
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
  const soChungTu = String(body.so_chung_tu || '').trim().slice(0, 60);
  const lyDoKhongCt = String(body.ly_do_khong_chung_tu || '').trim().slice(0, 255);
  if (!noiBo && !soChungTu && lyDoKhongCt.length < 5) {
    throw new LoiKho('Nhập số hóa đơn / phiếu giao hàng của nhà cung cấp, hoặc ghi lý do không có chứng từ (vd: mua chợ).');
  }
  // Them cot TRUOC transaction: ALTER TABLE trong MySQL tu commit ngam.
  const congNo = require('./congNoNccService');
  const quyTrinh = require('./duyetNhapKhoService');
  await congNo.damBaoCot();
  await quyTrinh.damBaoCauTruc();
  const ch = await quyTrinh.cauHinh();
  const choQc = !noiBo && ch.bat_qc;

  const conn = await db.getConnection();
  let ma, idPn, tong = 0, trangThai;
  try {
    await conn.beginTransaction();
    ma = await sinhMa(conn, 'phieu_nhap', 'ma_phieu', 'PN');
    const tongGiao = dong.reduce((s, d) => s + d.so_luong * d.don_gia, 0);
    const anh = noiBo ? null : quyTrinh.luuAnhChungTu(body.anh_chung_tu, ma);
    const [kq] = await conn.query(
      `INSERT INTO phieu_nhap (ma_phieu, id_ncc, id_nv, ngay_nhap, thoi_diem, tong_tien, ghi_chu, trangthai, id_dmh,
                               trang_thai_duyet, so_chung_tu, ly_do_khong_chung_tu, anh_chung_tu, mua_le, tong_giao)
       VALUES (?, ?, ?, CURDATE(), NOW(), 0, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
      [ma, idNcc, idNv || null, String(body.ghi_chu || '').slice(0, 500) || null, idDmh,
        noiBo ? 'da_duyet' : 'cho_qc', soChungTu || null, soChungTu ? null : (lyDoKhongCt || null), anh,
        !noiBo && !idNcc ? 1 : 0, Math.round(tongGiao)]);
    idPn = kq.insertId;

    for (const d of dong) {
      const [[nl]] = await conn.query('SELECT han_su_dung_ngay FROM nguyen_lieu WHERE id_nl = ?', [d.id_nl]);
      if (!nl) throw new LoiKho('Nguyên liệu không tồn tại.');
      const [ct] = await conn.query(
        `INSERT INTO chi_tiet_phieu_nhap (id_pn, id_nl, so_luong, gia_nhap, so_lo, han_su_dung, so_luong_con_lai, so_luong_giao, ket_qua_qc)
         VALUES (?, ?, 0, ?, ?, COALESCE(?, CURDATE() + INTERVAL ? DAY), 0, ?, ?)`,
        [idPn, d.id_nl, d.don_gia, d.so_lo || ma, d.han_su_dung || null, Number(nl.han_su_dung_ngay) || 30, d.so_luong, choQc ? null : 'dat']);
      if (!choQc) {
        await nhapDongVaoKho(conn, { idCt: ct.insertId, idNl: d.id_nl, soLuong: d.so_luong, donGia: d.don_gia, idDmh });
        tong += d.so_luong * d.don_gia;
      }
    }
    trangThai = noiBo ? 'da_duyet' : choQc ? 'cho_qc' : quyTrinh.sauNhapKho(ch, tong);
    await conn.query('UPDATE phieu_nhap SET tong_tien = ?, trang_thai_duyet = ? WHERE id_pn = ?', [Math.round(tong), trangThai, idPn]);
    // Phieu co nha cung cap -> phat sinh cong no (chi tra duoc sau khi duyet).
    if (!choQc) await congNo.datHanTra(conn, idPn, idNcc);
    if (idDmh && !choQc) await capNhatTrangThaiDonSauNhan(conn, idDmh);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  if (!noiBo) quyTrinh.nen(() => quyTrinh.baoBuoc(idPn));
  return { id: idPn, ma_phieu: ma, tong_tien: Math.round(tong), trang_thai_duyet: trangThai };
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
    await require('./duyetNhapKhoService').damBaoCauTruc();
    const [pn] = await db.query(`
      SELECT pn.id_pn AS id, pn.ma_phieu, COALESCE(pn.thoi_diem, pn.ngay_nhap) AS thoi_diem, pn.tong_tien AS gia_tri, pn.trang_thai_duyet, pn.tong_giao,
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
    await require('./duyetNhapKhoService').damBaoCauTruc();
    const [[p]] = await db.query(`
      SELECT pn.*, COALESCE(pn.thoi_diem, pn.ngay_nhap) AS thoi_diem, ncc.ten_ncc, ncc.sodienthoai, nv.ten AS nguoi, dmh.ma_don,
             qc.ten AS nguoi_qc, kt.ten AS nguoi_doi_chieu, du.ten AS nguoi_duyet
        FROM phieu_nhap pn LEFT JOIN nha_cung_cap ncc ON ncc.id_ncc = pn.id_ncc
        LEFT JOIN nhan_vien nv ON nv.id_nv = pn.id_nv LEFT JOIN don_mua_hang dmh ON dmh.id_dmh = pn.id_dmh
        LEFT JOIN nhan_vien qc ON qc.id_nv = pn.id_nv_qc LEFT JOIN nhan_vien kt ON kt.id_nv = pn.id_nv_doi_chieu
        LEFT JOIN nhan_vien du ON du.id_nv = pn.id_nv_duyet
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

/*
 * GOI Y MUA HANG THEO DU BAO (thay cho "trung binh 28 ngay").
 *
 *   nhu cau(ngay d) = trung binh xuat kho ban hang cung THU cua d trong
 *                     SO_TUAN_LICH_SU tuan gan nhat co du lieu x he so mua vu
 *                     (duBaoNhanSuService.heSoThang - cung mo hinh voi du bao
 *                     nhan su)
 *   kha dung        = ton - phan dang giu cho mon da goi chua nau
 *                     (tonMonService.tonKhaDung) + hang dang ve (don mua mo)
 *   Hang dat hom nay ve sau L = so_ngay_giao ngay. Can dat neu luc do ton con
 *   duoi muc an toan (dinh muc toi thieu):
 *       kha dung - nhu cau(L ngay) < an toan
 *   So luong = nhu cau(L + C ngay) + an toan - kha dung   (C = so_ngay_du_tru)
 * Tham so trong cau_hinh: mua_hang.so_ngay_giao, mua_hang.so_ngay_du_tru.
 */
const SO_TUAN_LICH_SU_MUA = 8;
const THAM_SO_MUA_MAC_DINH = { so_ngay_giao: 2, so_ngay_du_tru: 7 };

async function thamSoMua() {
  const ts = { ...THAM_SO_MUA_MAC_DINH };
  try {
    const [rows] = await db.query("SELECT khoa, gia_tri FROM cau_hinh WHERE khoa LIKE 'mua_hang.%'");
    for (const r of rows) {
      const k = r.khoa.slice('mua_hang.'.length);
      const v = Math.round(Number(r.gia_tri));
      if (k in ts && Number.isFinite(v) && v >= 0 && v <= 60) ts[k] = v;
    }
  } catch (e) { /* mac dinh */ }
  return ts;
}

const ngayCong = (s, n) => {
  const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Du bao tieu hao tung ngay cho soNgay ngay ke tu tuNgay.
 * @returns {Promise<{theoNgay: Map<number, number[]>, neo: string|null, heSo: number}>}
 */
async function duBaoTieuHao(tuNgay, soNgay) {
  const [[m]] = await db.query(
    "SELECT MAX(ngay_xuat) AS cuoi FROM xuat_kho WHERE ly_do IN ('ban_hang','ban_hang_mo_phong') AND ngay_xuat < ?", [tuNgay]);
  const theoNgay = new Map();
  // Chua co lich su ban: van cong nhu cau tiec (neu co).
  if (!m || !m.cuoi) return congTiec(theoNgay, tuNgay, soNgay, { neo: null, heSo: 1 });
  const d = new Date(m.cuoi);
  const neo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const tu = ngayCong(neo, -7 * SO_TUAN_LICH_SU_MUA + 1);

  const [ngayCo] = await db.query(
    `SELECT DAYOFWEEK(ngay_xuat) - 1 AS thu, COUNT(DISTINCT ngay_xuat) AS so FROM xuat_kho
      WHERE ly_do IN ('ban_hang','ban_hang_mo_phong') AND ngay_xuat BETWEEN ? AND ? GROUP BY thu`, [tu, neo]);
  const soNgayThu = Array(7).fill(0);
  for (const r of ngayCo) soNgayThu[Number(r.thu)] = Number(r.so);

  const [rows] = await db.query(
    `SELECT id_nl, DAYOFWEEK(ngay_xuat) - 1 AS thu, SUM(so_luong) AS sl FROM xuat_kho
      WHERE ly_do IN ('ban_hang','ban_hang_mo_phong') AND ngay_xuat BETWEEN ? AND ? GROUP BY id_nl, thu`, [tu, neo]);
  const tb = new Map(); // id_nl -> [7]
  for (const r of rows) {
    const id = Number(r.id_nl);
    if (!tb.has(id)) tb.set(id, Array(7).fill(0));
    const n = soNgayThu[Number(r.thu)];
    if (n) tb.get(id)[Number(r.thu)] = Number(r.sl) / n;
  }

  const f = await require('./duBaoNhanSuService').heSoThang();
  const thangDich = new Date(`${ngayCong(tuNgay, Math.floor(soNgay / 2))}T00:00:00`).getMonth() + 1;
  const thangGoc = new Date(`${ngayCong(neo, -7 * SO_TUAN_LICH_SU_MUA / 2)}T00:00:00`).getMonth() + 1;
  const heSo = f[thangDich] && f[thangGoc] ? f[thangDich] / f[thangGoc] : 1;

  const thuNgay = [];
  for (let i = 0; i < soNgay; i++) thuNgay.push(new Date(`${ngayCong(tuNgay, i)}T00:00:00`).getDay());
  for (const [id, mang] of tb) theoNgay.set(id, thuNgay.map((t) => mang[t] * heSo));
  return congTiec(theoNgay, tuNgay, soNgay, { neo, heSo });
}

// Cong nhu cau cua cac tiec da giu cho vao DUNG ngay to chuc (tiecVanHanhService).
async function congTiec(theoNgay, tuNgay, soNgay, them) {
  const tiec = await require('./tiecVanHanhService').nhuCauTiecTheoNgay(tuNgay, soNgay).catch(() => new Map());
  for (const [id, mang] of tiec) {
    const goc = theoNgay.get(id) || Array(soNgay).fill(0);
    theoNgay.set(id, goc.map((x, i) => x + (mang[i] || 0)));
  }
  return { theoNgay, ...them, tiec };
}

async function goiYMuaHang({ homNay = null } = {}) {
  const ngay0 = homNay || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const ts = await thamSoMua();
  const L = ts.so_ngay_giao, C = ts.so_ngay_du_tru;
  const [nvl, du, khaDung] = await Promise.all([
    danhSachNVL(), duBaoTieuHao(ngay0, L + C + 30), require('./tonMonService').tonKhaDung(),
  ]);
  const [dangVe] = await db.query(`
    SELECT c.id_nl, SUM(GREATEST(c.so_luong - c.so_luong_da_nhan, 0)) AS sl
      FROM chi_tiet_don_mua c JOIN don_mua_hang d ON d.id_dmh = c.id_dmh
     WHERE d.trang_thai IN ('cho_duyet','da_duyet','da_dat','nhan_mot_phan') GROUP BY c.id_nl`);
  const mapVe = new Map(dangVe.map((r) => [Number(r.id_nl), Number(r.sl)]));
  const cong = (mang, a, b) => mang.slice(a, b).reduce((s, x) => s + x, 0);
  // Bang gia theo nha cung cap (nhaCungCapService): moi mat hang chon noi re nhat dat MOQ.
  const nccSvc = require('./nhaCungCapService');
  const bangGia = await nccSvc.giaTheoNl().catch(() => new Map());

  const ra = [];
  for (const n of nvl) {
    const ngayDb = du.theoNgay.get(n.id_nl) || Array(L + C + 30).fill(0);
    const kd = Math.max(0, khaDung.has(n.id_nl) ? khaDung.get(n.id_nl).kha_dung : n.so_luong);
    const ve = mapVe.get(n.id_nl) || 0;
    const canL = cong(ngayDb, 0, L);
    const canLC = cong(ngayDb, 0, L + C);
    const choTiec = du.tiec && du.tiec.has(n.id_nl) ? cong(du.tiec.get(n.id_nl), 0, L + C) : 0;
    // Tiec da giu cho la nhu cau CHAC CHAN: phan roi sau khi hang ve van phai
    // giu cho tu bay gio, khong cho toi luc vao tam L moi dat (se khong kip).
    const tiecSauL = du.tiec && du.tiec.has(n.id_nl) ? cong(du.tiec.get(n.id_nl), L, L + C) : 0;
    const anToan = n.dinh_muc_min;
    if (kd + ve - canL - tiecSauL >= anToan) continue;
    const deXuat = Math.max(0, canLC + anToan - kd - ve);
    if (deXuat <= 0) continue;
    // Ngay du kien het: cong don nhu cau tung ngay toi khi vuot kha dung + dang ve.
    let conLai = kd + ve, ngayHet = null;
    for (let i = 0; i < ngayDb.length; i++) {
      conLai -= ngayDb[i];
      if (conLai < 0) { ngayHet = ngayCong(ngay0, i); break; }
    }
    const tieuHaoNgay = cong(ngayDb, 0, 7) / 7;
    const dsGia = bangGia.get(Number(n.id_nl)) || [];
    const chon = nccSvc.chonNcc(dsGia, deXuat);
    // Khong noi nao ban duoi MOQ -> lam tron len muc dat toi thieu cua noi re nhat.
    const mua = chon && chon.duoi_moq ? Math.max(deXuat, chon.moq) : deXuat;
    ra.push({
      ncc_de_xuat: chon, bao_gia: dsGia.slice(0, 4),
      so_luong_mua: Math.ceil(mua * 10) / 10,
      ...n, kha_dung: lamTron(kd, 2), tieu_hao_ngay: lamTron(tieuHaoNgay, 2), dang_ve: lamTron(ve),
      can_truoc_khi_ve: lamTron(canL, 2), can_ky_toi: lamTron(canLC, 2), can_cho_tiec: lamTron(choTiec, 2), diem_dat: lamTron(canL + anToan, 2),
      de_xuat: Math.ceil(deXuat * 10) / 10,
      con_du_ngay: tieuHaoNgay > 0 ? lamTron(kd / tieuHaoNgay, 1) : null,
      ngay_het_du_kien: ngayHet,
      muc_do: kd <= 0 ? 'het' : kd < canL ? 'het_truoc_khi_ve'
        : tiecSauL > 0 && kd + ve < canL + tiecSauL ? 'thieu_cho_tiec'
          : kd < anToan ? 'duoi_dinh_muc' : 'sap_het',
    });
  }
  const thuTu = { het: 0, het_truoc_khi_ve: 1, thieu_cho_tiec: 2, duoi_dinh_muc: 3, sap_het: 4 };
  ra.thamSo = { ...ts, neo: du.neo, he_so: du.heSo };
  return ra.sort((a, b) => thuTu[a.muc_do] - thuTu[b.muc_do] || (a.con_du_ngay ?? 1e9) - (b.con_du_ngay ?? 1e9));
}

/**
 * Tao DON MUA NHAP tu goi y: gom theo nha cung cap gan nhat (khong co NCC ->
 * mot don chua chon NCC), don gia = gia nhap gan nhat (khong co -> gia von).
 * Don o trang thai cho_duyet, ghi chu "tu dong", ngay giao = hom nay + L.
 * Chay lai khong dat trung: hang trong don mo da tinh vao "dang ve".
 */
async function taoDonTuDong(idNv, { homNay = null } = {}) {
  const goiY = await goiYMuaHang({ homNay });
  if (!goiY.length) return { don: [], thong_bao: 'Tồn kho đang đủ theo dự báo - không cần đặt thêm.' };
  const theoNcc = new Map();
  for (const g of goiY) {
    // Noi re nhat trong bang gia NCC; mat hang chua co bang gia -> NCC nhap gan nhat.
    const k = (g.ncc_de_xuat && g.ncc_de_xuat.id_ncc) || g.ncc_gan_nhat || 0;
    if (!theoNcc.has(k)) theoNcc.set(k, []);
    theoNcc.get(k).push({
      id_nl: g.id_nl, so_luong: g.so_luong_mua || g.de_xuat,
      don_gia: (g.ncc_de_xuat && g.ncc_de_xuat.don_gia) || Number(g.gia_nhap_gan_nhat) || Number(g.gia_von) || 0,
    });
  }
  const ngayGiao = ngayCong(homNay || new Date().toISOString().slice(0, 10), goiY.thamSo.so_ngay_giao);
  const don = [];
  for (const [idNcc, dong] of theoNcc) {
    const kq = await taoDonMua({
      id_ncc: idNcc || null, dong, ngay_giao_du_kien: ngayGiao,
      ghi_chu: `Tạo tự động theo dự báo tiêu hao (đủ dùng ${goiY.thamSo.so_ngay_giao + goiY.thamSo.so_ngay_du_tru} ngày)`
        + (idNcc ? '' : ' - CHƯA CHỌN NCC'),
    }, idNv);
    don.push({ ...kq, id_ncc: idNcc || null, so_dong: dong.length });
  }
  return { don };
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

/**
 * Sua don mua khi CHUA dat voi NCC (nhap / cho_duyet / da_duyet): nha cung cap,
 * ngay giao du kien, ghi chu, va (neu gui `dong`) danh sach nguyen lieu.
 *
 * Don DA DUYET ma doi so luong / don gia / nguyen lieu -> quay ve "Cho duyet":
 * nguoi duyet da dong y mot so tien khac, sua xong ma giu "Da duyet" la lach
 * qua buoc duyet. Doi NCC / ngay giao / ghi chu thi giu nguyen trang thai.
 */
const SUA_DUOC = ['nhap', 'cho_duyet', 'da_duyet'];
async function capNhatDonMua(id, body = {}) {
  const don = await chiTietDon(id);
  if (!don) throw new LoiKho('Không tìm thấy đơn mua.', 'NOT_FOUND');
  if (!SUA_DUOC.includes(don.trang_thai)) {
    throw new LoiKho(`Đơn đang ở trạng thái "${TRANG_THAI_DON[don.trang_thai]}" – không sửa được nữa. Cần thay đổi thì hủy đơn và lập đơn mới.`);
  }
  let idNcc = don.id_ncc;
  if (body.id_ncc !== undefined) {
    idNcc = Number(body.id_ncc) || null;
    if (idNcc) {
      const [[n]] = await db.query('SELECT id_ncc FROM nha_cung_cap WHERE id_ncc = ? AND trangthai = 1', [idNcc]);
      if (!n) throw new LoiKho('Nhà cung cấp không tồn tại hoặc đã ngừng hợp tác.');
    }
  }
  let ngayGiao = don.ngay_giao_du_kien;
  if (body.ngay_giao_du_kien !== undefined) {
    const v = String(body.ngay_giao_du_kien || '');
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new LoiKho('Ngày giao dự kiến không hợp lệ.');
    ngayGiao = v || null;
  }
  const ghiChu = body.ghi_chu !== undefined ? (String(body.ghi_chu || '').trim().slice(0, 500) || null) : don.ghi_chu;

  let dongMoi = null;
  if (Array.isArray(body.dong)) {
    dongMoi = body.dong
      .map((d) => ({ id_nl: Number(d.id_nl), so_luong: so(d.so_luong), don_gia: so(d.don_gia) || 0 }))
      .filter((d) => d.id_nl);
    if (!dongMoi.length) throw new LoiKho('Đơn mua cần ít nhất một nguyên liệu.');
    if (dongMoi.some((d) => !(d.so_luong > 0))) throw new LoiKho('Số lượng đặt phải lớn hơn 0.');
    if (dongMoi.some((d) => d.don_gia < 0)) throw new LoiKho('Đơn giá không được âm.');
    if (new Set(dongMoi.map((d) => d.id_nl)).size !== dongMoi.length) throw new LoiKho('Một nguyên liệu bị lặp trong đơn – gộp lại thành một dòng.');
    if (don.dong.some((d) => d.so_luong_da_nhan > 0)) throw new LoiKho('Đơn đã nhận một phần hàng – không sửa danh sách nguyên liệu được.');
  }
  const khoa = (ds) => ds.map((d) => `${d.id_nl}|${Number(d.so_luong)}|${Number(d.don_gia)}`).sort().join(';');
  const doiDong = !!dongMoi && khoa(dongMoi) !== khoa(don.dong);
  const veChoDuyet = doiDong && don.trang_thai === 'da_duyet';

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    if (doiDong) {
      await conn.query('DELETE FROM chi_tiet_don_mua WHERE id_dmh = ?', [id]);
      for (const d of dongMoi) {
        await conn.query('INSERT INTO chi_tiet_don_mua (id_dmh, id_nl, so_luong, don_gia) VALUES (?, ?, ?, ?)', [id, d.id_nl, d.so_luong, d.don_gia]);
      }
    }
    const tong = (doiDong ? dongMoi : don.dong).reduce((s, d) => s + Number(d.so_luong) * Number(d.don_gia), 0);
    await conn.query(
      `UPDATE don_mua_hang SET id_ncc = ?, ngay_giao_du_kien = ?, ghi_chu = ?, tong_tien = ?
         ${veChoDuyet ? ", trang_thai = 'cho_duyet', id_nv_duyet = NULL, duyet_luc = NULL" : ''}
       WHERE id_dmh = ?`,
      [idNcc, ngayGiao, ghiChu, Math.round(tong), id]);
    await conn.commit();
    return { ok: true, doi_dong: doiDong, ve_cho_duyet: veChoDuyet };
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
  if (buoc === 'dat_hang') {
    const [[n]] = await db.query('SELECT id_ncc FROM don_mua_hang WHERE id_dmh = ?', [id]);
    if (!n.id_ncc) throw new LoiKho('Đơn chưa có nhà cung cấp – bấm "Sửa đơn" chọn nhà cung cấp trước khi đánh dấu đã đặt hàng.');
  }
  await db.query(
    `UPDATE don_mua_hang SET trang_thai = ?,
       id_nv_duyet = IF(? = 'da_duyet', ?, id_nv_duyet), duyet_luc = IF(? = 'da_duyet', NOW(), duyet_luc),
       ly_do_huy = IF(? = 'huy', ?, ly_do_huy)
     WHERE id_dmh = ?`, [b.den, b.den, idNv || null, b.den, b.den, String(lyDo || '').slice(0, 300), id]);
  return { ok: true };
}

module.exports = {
  LY_DO_XUAT, LY_DO_BAN_HANG, TRANG_THAI_DON, LoiKho,
  danhSachNVL, danhSachNCC, loHang, truLoFIFO, taoPhieuNhap, nhapDongVaoKho, capNhatTrangThaiDonSauNhan, taoPhieuXuat, soKho, chiTietPhieu,
  tieuHaoBinhQuan, goiYMuaHang, thamSoMua, duBaoTieuHao, taoDonTuDong, danhSachDon, chiTietDon, taoDonMua, capNhatDonMua, doiTrangThaiDon,
};
