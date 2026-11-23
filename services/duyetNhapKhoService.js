/**
 * QUY TRINH DUYET PHIEU NHAP KHO (nha hang vua).
 *
 *   THU KHO lap phieu nhan hang (+ so hoa don / phieu giao hang, anh tuy chon)
 *      |  -> 'cho_qc'
 *   BEP TRUONG / TRUONG BAR kiem chat luong tung dong: Dat / Tra mot phan / Tra lai
 *      |  Phan DAT cong ton ngay (tao lo, gia von binh quan); phan tra khong vao kho
 *      |  -> 'cho_doi_chieu'   (het hang dat -> 'tra_hang', ket thuc)
 *   KE TOAN doi chieu so luong + don gia voi don mua va hoa don; sua gia theo hoa don
 *      |  -> 'cho_duyet' neu tong > nguong; <= nguong -> 'da_duyet' luon
 *   QUAN LY duyet cuoi (tung phieu / ca loat) -> 'da_duyet' (khoa)
 *      Tra ve -> lai 'cho_doi_chieu' kem ly do.
 *
 * VI SAO CONG TON NGAY SAU QC (khong doi duyet cuoi): bep dung hang ngay khi hang
 * ve; hang da nam trong tu ma he thong bao "het" se chan khach goi mon
 * (tonMonService). Kiem soat HANG HOA (QC) chan nhap kho; kiem soat TAI CHINH
 * (doi chieu + duyet) chan THANH TOAN: phieu chua 'da_duyet' khong tra cong no,
 * khong lap phieu chi duoc (congNoNccService.traTien).
 *
 * TACH NHIEM VU: nguoi lap khong tu QC, khong tu doi chieu, khong tu duyet;
 * nguoi QC va nguoi lap don mua khong duyet cuoi phieu do.
 *
 * Cau hinh (bang cau_hinh): kho.nhap.bat_qc, kho.nhap.bat_doi_chieu (1/0) - nha
 * hang nho khong co nguoi rieng thi tat; kho.nhap.nguong_duyet (1.000.000d);
 * kho.nhap.lech_gia_pt (5%).
 */
const db = require('../config/db');

const TRANG_THAI = {
  cho_qc: { ten: 'Chờ kiểm tra chất lượng', mau: '#b45309' },
  cho_doi_chieu: { ten: 'Chờ kế toán đối chiếu', mau: '#2563eb' },
  cho_duyet: { ten: 'Chờ quản lý duyệt', mau: '#7c3aed' },
  da_duyet: { ten: 'Đã duyệt', mau: '#15803d' },
  tra_hang: { ten: 'Trả hàng toàn bộ', mau: '#b91c1c' },
};
const KET_QUA_QC = { dat: 'Đạt', tra_mot_phan: 'Trả một phần', tra_lai: 'Trả lại' };

class LoiDuyetNhap extends Error {
  constructor(msg, ma = 'INVALID') { super(msg); this.name = 'LoiKho'; this.ma = ma; }
}

// ------------------------------------------------------------------ cau truc

let daCoCauTruc = false;
async function coCot(bang, cot) {
  const [r] = await db.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [bang, cot]);
  return r.length > 0;
}

/**
 * Them cot (ALTER tu commit ngam - goi NGOAI transaction). Lan dau them
 * `trang_thai_duyet`: moi phieu co san = 'da_duyet', danh dau truoc_quy_trinh.
 */
async function damBaoCauTruc() {
  if (daCoCauTruc) return;
  if (!(await coCot('phieu_nhap', 'trang_thai_duyet'))) {
    await db.query(`ALTER TABLE phieu_nhap
      ADD COLUMN trang_thai_duyet VARCHAR(20) NOT NULL DEFAULT 'da_duyet',
      ADD COLUMN truoc_quy_trinh TINYINT(1) NOT NULL DEFAULT 0`);
    await db.query('UPDATE phieu_nhap SET trang_thai_duyet = \'da_duyet\', truoc_quy_trinh = 1');
    await db.query('ALTER TABLE phieu_nhap ADD KEY idx_pn_duyet (trang_thai_duyet)');
  }
  const cotPn = [
    ['so_chung_tu', 'VARCHAR(60) NULL COMMENT \'So hoa don / phieu giao hang NCC\''],
    ['ly_do_khong_chung_tu', 'VARCHAR(255) NULL'],
    ['anh_chung_tu', 'VARCHAR(255) NULL'],
    ['mua_le', 'TINYINT(1) NOT NULL DEFAULT 0 COMMENT \'Mua le tra tien mat (khong NCC)\''],
    ['tong_giao', 'DECIMAL(14,2) NULL COMMENT \'Gia tri hang NCC giao (truoc QC)\''],
    ['id_nv_qc', 'INT NULL'], ['qc_luc', 'DATETIME NULL'],
    ['id_nv_doi_chieu', 'INT NULL'], ['doi_chieu_luc', 'DATETIME NULL'], ['ghi_chu_doi_chieu', 'VARCHAR(500) NULL'],
    ['id_nv_duyet', 'INT NULL'], ['duyet_luc', 'DATETIME NULL'], ['ghi_chu_duyet', 'VARCHAR(500) NULL'],
  ];
  for (const [cot, kieu] of cotPn) {
    if (!(await coCot('phieu_nhap', cot))) await db.query(`ALTER TABLE phieu_nhap ADD COLUMN ${cot} ${kieu}`);
  }
  const cotCt = [
    ['so_luong_giao', 'DECIMAL(12,3) NULL COMMENT \'NCC giao; so_luong = phan dat QC\''],
    ['ket_qua_qc', 'VARCHAR(15) NULL'],
    ['ly_do_qc', 'VARCHAR(255) NULL'],
    ['gia_nhap_ban_dau', 'DECIMAL(14,2) NULL COMMENT \'Gia luc lap phieu, truoc khi ke toan sua\''],
  ];
  for (const [cot, kieu] of cotCt) {
    if (!(await coCot('chi_tiet_phieu_nhap', cot))) await db.query(`ALTER TABLE chi_tiet_phieu_nhap ADD COLUMN ${cot} ${kieu}`);
  }
  await db.query(
    `INSERT IGNORE INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES
      ('kho.nhap.bat_qc', '1', 'Phiếu nhập phải qua bếp trưởng / trưởng bar kiểm tra chất lượng'),
      ('kho.nhap.bat_doi_chieu', '1', 'Phiếu nhập phải qua kế toán đối chiếu hóa đơn'),
      ('kho.nhap.nguong_duyet', '1000000', 'Phiếu nhập trên mức này (đồng) phải quản lý duyệt cuối'),
      ('kho.nhap.lech_gia_pt', '5', 'Đơn giá lệch quá % này so với đơn mua thì tô đỏ')`);
  daCoCauTruc = true;
}

async function cauHinh() {
  await damBaoCauTruc();
  const [rows] = await db.query("SELECT khoa, gia_tri FROM cau_hinh WHERE khoa LIKE 'kho.nhap.%'");
  const c = Object.fromEntries(rows.map((r) => [r.khoa, r.gia_tri]));
  return {
    bat_qc: c['kho.nhap.bat_qc'] !== '0',
    bat_doi_chieu: c['kho.nhap.bat_doi_chieu'] !== '0',
    nguong_duyet: Math.max(0, Number(c['kho.nhap.nguong_duyet']) || 0),
    lech_gia_pt: Math.max(0, Number(c['kho.nhap.lech_gia_pt']) || 5),
  };
}

/** Trang thai ke tiep sau khi hang da vao kho (sau QC hoac khi tat QC). */
function sauNhapKho(ch, tong) {
  if (ch.bat_doi_chieu) return 'cho_doi_chieu';
  return Number(tong) > ch.nguong_duyet ? 'cho_duyet' : 'da_duyet';
}

// ------------------------------------------------------------------ chung tu

/** Luu anh chung tu (data URL jpeg/png/webp, <= 4MB) -> duong dan public. */
function luuAnhChungTu(dataUrl, maPhieu) {
  if (!dataUrl) return null;
  const m = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
  if (!m) throw new LoiDuyetNhap('Ảnh chứng từ phải là JPG, PNG hoặc WEBP.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 4 * 1024 * 1024) throw new LoiDuyetNhap('Ảnh chứng từ tối đa 4MB.');
  const fs = require('fs');
  const path = require('path');
  const thuMuc = path.join(__dirname, '..', 'public', 'uploads', 'chung-tu');
  fs.mkdirSync(thuMuc, { recursive: true });
  const ten = `${String(maPhieu).replace(/[^\w-]/g, '')}-${Date.now()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  fs.writeFileSync(path.join(thuMuc, ten), buf);
  return `/uploads/chung-tu/${ten}`;
}

// ------------------------------------------------------------------ thong bao

function nen(fn) {
  Promise.resolve().then(fn).catch((e) => console.error('[duyet-nhap] thong bao:', e.message));
}
async function baoBuoc(idPn) {
  const tb = require('./thongBaoService');
  const [[p]] = await db.query(
    `SELECT pn.id_pn, pn.ma_phieu, pn.trang_thai_duyet, pn.tong_tien, pn.tong_giao, pn.id_nv, pn.ghi_chu_duyet,
            COALESCE(ncc.ten_ncc, 'Mua lẻ') AS ten_ncc
       FROM phieu_nhap pn LEFT JOIN nha_cung_cap ncc ON ncc.id_ncc = pn.id_ncc WHERE pn.id_pn = ?`, [idPn]);
  if (!p) return;
  const tien = (n) => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')}đ`;
  const link = `/staff/kitchen/kho/phieu-nhap/${p.id_pn}`;
  const nguoiLap = p.id_nv ? [p.id_nv] : [];
  switch (p.trang_thai_duyet) {
    case 'cho_qc':
      return tb.gui('nhap_kho_cho_qc', {
        tieuDe: `Phiếu nhập ${p.ma_phieu} chờ kiểm tra chất lượng`,
        noiDung: `${p.ten_ncc} giao hàng trị giá ${tien(p.tong_giao)}. Kiểm tra độ tươi, hạn dùng, quy cách rồi bấm Đạt / Trả.`,
        link, mucDo: 'khan', truNv: nguoiLap,
      });
    case 'cho_doi_chieu':
      return tb.gui('nhap_kho_cho_doi_chieu', {
        tieuDe: `Phiếu nhập ${p.ma_phieu} chờ đối chiếu hóa đơn`,
        noiDung: `${p.ten_ncc} · ${tien(p.tong_tien)} đã nhập kho${p.ghi_chu_duyet ? ` · Quản lý trả về: ${p.ghi_chu_duyet}` : ''}. Đối chiếu số lượng, đơn giá với đơn mua và hóa đơn.`,
        link,
      });
    case 'cho_duyet':
      return tb.gui('nhap_kho_cho_duyet', {
        tieuDe: `Phiếu nhập ${p.ma_phieu} chờ duyệt`,
        noiDung: `${p.ten_ncc} · ${tien(p.tong_tien)} · kế toán đã đối chiếu.`, link,
      });
    case 'da_duyet':
      return tb.gui('nhap_kho_ket_qua', {
        nv: nguoiLap, tieuDe: `Phiếu nhập ${p.ma_phieu} đã được duyệt`,
        noiDung: `${p.ten_ncc} · ${tien(p.tong_tien)}. Phiếu đã khóa, kế toán được thanh toán.`, link,
      });
    case 'tra_hang':
      return tb.gui('nhap_kho_ket_qua', {
        nv: nguoiLap, tieuDe: `Phiếu nhập ${p.ma_phieu}: trả lại toàn bộ hàng`,
        noiDung: `${p.ten_ncc} – không dòng nào đạt kiểm tra chất lượng. Lập biên bản trả nhà cung cấp.`, link, mucDo: 'quan_trong',
      });
    default:
      return null;
  }
}

// ------------------------------------------------------------------ doc

async function nguoiDung(idNv) {
  if (!idNv) return null;
  const [[r]] = await db.query('SELECT ten FROM nhan_vien WHERE id_nv = ?', [idNv]);
  return r ? String(r.ten).trim() : null;
}

/** Chi tiet phieu cho man duyet: dong + so sanh don mua (so luong, gia, lech %). */
async function chiTiet(idPn) {
  await damBaoCauTruc();
  const ch = await cauHinh();
  const [[p]] = await db.query(
    `SELECT pn.*, COALESCE(pn.thoi_diem, pn.ngay_nhap) AS thoi_diem, ncc.ten_ncc, ncc.sodienthoai,
            dmh.ma_don, dmh.id_nv_tao AS id_nv_tao_don
       FROM phieu_nhap pn LEFT JOIN nha_cung_cap ncc ON ncc.id_ncc = pn.id_ncc
       LEFT JOIN don_mua_hang dmh ON dmh.id_dmh = pn.id_dmh WHERE pn.id_pn = ?`, [idPn]);
  if (!p) return null;
  const [dong] = await db.query(
    `SELECT c.*, nl.ten_nl, dvt.ten_dvt, dm.so_luong AS sl_don, dm.don_gia AS gia_don
       FROM chi_tiet_phieu_nhap c JOIN nguyen_lieu nl ON nl.id_nl = c.id_nl
       LEFT JOIN don_vi_tinh dvt ON dvt.id_dvt = nl.id_dvt
       LEFT JOIN chi_tiet_don_mua dm ON dm.id_dmh = ? AND dm.id_nl = c.id_nl
      WHERE c.id_pn = ? ORDER BY c.id_ct`, [p.id_dmh || 0, idPn]);
  const ds = dong.map((d) => {
    const giao = d.so_luong_giao == null ? Number(d.so_luong) : Number(d.so_luong_giao);
    const gia = Number(d.gia_nhap);
    const giaDon = d.gia_don == null ? null : Number(d.gia_don);
    const lechPt = giaDon && giaDon > 0 ? Math.round(((gia - giaDon) / giaDon) * 1000) / 10 : null;
    return {
      ...d, giao, dat: Number(d.so_luong), tra: Math.max(0, Math.round((giao - Number(d.so_luong)) * 1000) / 1000),
      gia, gia_don: giaDon, sl_don: d.sl_don == null ? null : Number(d.sl_don),
      lech_pt: lechPt, lech_gia: lechPt != null && Math.abs(lechPt) > ch.lech_gia_pt,
      thanh_tien: Number(d.so_luong) * gia,
    };
  });
  const [qc, dc, duyet, lap] = await Promise.all(
    [p.id_nv_qc, p.id_nv_doi_chieu, p.id_nv_duyet, p.id_nv].map(nguoiDung));
  return {
    p: { ...p, ten_trang_thai: (TRANG_THAI[p.trang_thai_duyet] || {}).ten || p.trang_thai_duyet },
    dong: ds, ch,
    nguoi: { lap, qc, doi_chieu: dc, duyet },
    so_dong_lech: ds.filter((d) => d.lech_gia).length,
    // Chi tinh hang tra SAU khi QC (truoc QC so_luong = 0 nhung chua tra gi ca).
    tong_tra: ds.reduce((s, d) => s + (d.ket_qua_qc ? d.tra * d.gia : 0), 0),
  };
}

/** Danh sach phieu theo trang thai (mac dinh: con dang xu ly). */
async function danhSach({ trangThai = '' } = {}) {
  await damBaoCauTruc();
  const dieuKien = trangThai && TRANG_THAI[trangThai]
    ? 'pn.trang_thai_duyet = ?' : "pn.trang_thai_duyet IN ('cho_qc','cho_doi_chieu','cho_duyet')";
  const [rows] = await db.query(
    `SELECT pn.id_pn, pn.ma_phieu, pn.trang_thai_duyet, pn.tong_tien, pn.tong_giao, pn.so_chung_tu, pn.mua_le,
            COALESCE(pn.thoi_diem, pn.ngay_nhap) AS thoi_diem, pn.id_nv, pn.id_nv_qc, pn.id_dmh,
            COALESCE(ncc.ten_ncc, 'Mua lẻ') AS ten_ncc, nv.ten AS nguoi_lap, dmh.id_nv_tao AS id_nv_tao_don,
            TIMESTAMPDIFF(MINUTE, COALESCE(pn.doi_chieu_luc, pn.qc_luc, pn.thoi_diem), NOW()) AS phut_cho,
            (SELECT COUNT(*) FROM chi_tiet_phieu_nhap c WHERE c.id_pn = pn.id_pn) AS so_dong
       FROM phieu_nhap pn LEFT JOIN nha_cung_cap ncc ON ncc.id_ncc = pn.id_ncc
       LEFT JOIN nhan_vien nv ON nv.id_nv = pn.id_nv LEFT JOIN don_mua_hang dmh ON dmh.id_dmh = pn.id_dmh
      WHERE ${dieuKien}
      ORDER BY FIELD(pn.trang_thai_duyet, 'cho_qc', 'cho_doi_chieu', 'cho_duyet', 'da_duyet', 'tra_hang'), pn.id_pn DESC
      LIMIT 200`, trangThai && TRANG_THAI[trangThai] ? [trangThai] : []);
  return rows.map((r) => ({ ...r, ten_trang_thai: TRANG_THAI[r.trang_thai_duyet].ten }));
}

async function demTheoTrangThai() {
  await damBaoCauTruc();
  const [rows] = await db.query(
    "SELECT trang_thai_duyet AS tt, COUNT(*) AS n FROM phieu_nhap WHERE trang_thai_duyet IN ('cho_qc','cho_doi_chieu','cho_duyet') GROUP BY trang_thai_duyet");
  const kq = { cho_qc: 0, cho_doi_chieu: 0, cho_duyet: 0 };
  rows.forEach((r) => { kq[r.tt] = Number(r.n); });
  return kq;
}

// ------------------------------------------------------------------ buoc 2: QC

/**
 * Bep truong / truong bar kiem tra tung dong.
 * @param {{id_ct, so_luong_dat, ly_do}[]} ketQua  thieu dong nao = dat toan bo
 */
async function kiemTraChatLuong(idPn, ketQua, nguoi = {}) {
  await damBaoCauTruc();
  const kho = require('./khoBepService');
  const ch = await cauHinh();
  const theoDong = new Map((Array.isArray(ketQua) ? ketQua : []).map((k) => [Number(k.id_ct), k]));
  const conn = await db.getConnection();
  let trangThaiMoi;
  try {
    await conn.beginTransaction();
    const [[p]] = await conn.query('SELECT * FROM phieu_nhap WHERE id_pn = ? FOR UPDATE', [idPn]);
    if (!p) throw new LoiDuyetNhap('Không tìm thấy phiếu nhập.', 'NOT_FOUND');
    if (p.trang_thai_duyet !== 'cho_qc') throw new LoiDuyetNhap('Phiếu này không còn chờ kiểm tra chất lượng.');
    if (!nguoi.laAdmin && nguoi.id && Number(p.id_nv) === Number(nguoi.id)) {
      throw new LoiDuyetNhap('Người lập phiếu không tự kiểm tra chất lượng – nhờ bếp trưởng / trưởng bar.', 'FORBIDDEN');
    }
    const [dong] = await conn.query('SELECT * FROM chi_tiet_phieu_nhap WHERE id_pn = ? ORDER BY id_ct', [idPn]);
    let tong = 0;
    for (const d of dong) {
      const giao = Number(d.so_luong_giao);
      const k = theoDong.get(Number(d.id_ct));
      let dat = k && k.so_luong_dat !== undefined && k.so_luong_dat !== '' ? Number(String(k.so_luong_dat).replace(',', '.')) : giao;
      if (!Number.isFinite(dat) || dat < 0) throw new LoiDuyetNhap('Số lượng đạt không hợp lệ.');
      if (dat > giao + 1e-9) throw new LoiDuyetNhap('Số lượng đạt không được lớn hơn số lượng nhà cung cấp giao.');
      dat = Math.round(dat * 1000) / 1000;
      const ketQuaQc = dat >= giao - 1e-9 ? 'dat' : dat <= 0 ? 'tra_lai' : 'tra_mot_phan';
      const lyDo = String((k && k.ly_do) || '').trim().slice(0, 255);
      if (ketQuaQc !== 'dat' && lyDo.length < 3) throw new LoiDuyetNhap('Dòng trả hàng phải ghi lý do (vd: cá không tươi, sai quy cách).');
      await conn.query('UPDATE chi_tiet_phieu_nhap SET ket_qua_qc = ?, ly_do_qc = ? WHERE id_ct = ?', [ketQuaQc, lyDo || null, d.id_ct]);
      if (dat > 0) {
        await kho.nhapDongVaoKho(conn, { idCt: d.id_ct, idNl: d.id_nl, soLuong: dat, donGia: Number(d.gia_nhap), idDmh: p.id_dmh });
        tong += dat * Number(d.gia_nhap);
      }
    }
    trangThaiMoi = tong > 0 ? sauNhapKho(ch, tong) : 'tra_hang';
    await conn.query(
      `UPDATE phieu_nhap SET tong_tien = ?, trang_thai_duyet = ?, id_nv_qc = ?, qc_luc = NOW()
         ${trangThaiMoi === 'da_duyet' ? ', duyet_luc = NOW(), ghi_chu_duyet = ?' : ''} WHERE id_pn = ?`,
      trangThaiMoi === 'da_duyet'
        ? [Math.round(tong), trangThaiMoi, nguoi.id || null, `Tự duyệt: dưới ngưỡng ${ch.nguong_duyet.toLocaleString('vi-VN')}đ`, idPn]
        : [Math.round(tong), trangThaiMoi, nguoi.id || null, idPn]);
    if (tong > 0) await require('./congNoNccService').datHanTra(conn, idPn, p.id_ncc);
    if (p.id_dmh) await kho.capNhatTrangThaiDonSauNhan(conn, p.id_dmh);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  nen(() => baoBuoc(idPn));
  return { trang_thai: trangThaiMoi };
}

// ------------------------------------------------------------------ buoc 3: ke toan

/**
 * Ke toan doi chieu: sua DON GIA theo hoa don (khong sua so luong - so luong
 * la viec cua QC tai cua kho). Gia doi -> tinh lai gia von nguyen lieu.
 * @param {{gia: {id_ct, don_gia}[], ghi_chu}} body
 */
async function doiChieu(idPn, body = {}, nguoi = {}) {
  await damBaoCauTruc();
  const ch = await cauHinh();
  const sua = new Map((Array.isArray(body.gia) ? body.gia : []).map((g) => [Number(g.id_ct), Number(String(g.don_gia).replace(/[^\d.]/g, ''))]));
  const ghiChu = String(body.ghi_chu || '').trim().slice(0, 500);
  const conn = await db.getConnection();
  let trangThaiMoi;
  try {
    await conn.beginTransaction();
    const [[p]] = await conn.query('SELECT * FROM phieu_nhap WHERE id_pn = ? FOR UPDATE', [idPn]);
    if (!p) throw new LoiDuyetNhap('Không tìm thấy phiếu nhập.', 'NOT_FOUND');
    if (p.trang_thai_duyet !== 'cho_doi_chieu') throw new LoiDuyetNhap('Phiếu này không còn chờ đối chiếu.');
    if (!nguoi.laAdmin && nguoi.id && Number(p.id_nv) === Number(nguoi.id)) {
      throw new LoiDuyetNhap('Người lập phiếu không tự đối chiếu.', 'FORBIDDEN');
    }
    const [dong] = await conn.query('SELECT * FROM chi_tiet_phieu_nhap WHERE id_pn = ? ORDER BY id_ct FOR UPDATE', [idPn]);
    let tong = 0, soDoi = 0;
    for (const d of dong) {
      const cu = Number(d.gia_nhap);
      let moi = sua.has(Number(d.id_ct)) ? sua.get(Number(d.id_ct)) : cu;
      if (!Number.isFinite(moi) || moi < 0) throw new LoiDuyetNhap('Đơn giá không hợp lệ.');
      moi = Math.round(moi * 100) / 100;
      if (Math.abs(moi - cu) > 0.005) {
        soDoi++;
        await conn.query('UPDATE chi_tiet_phieu_nhap SET gia_nhap = ?, gia_nhap_ban_dau = COALESCE(gia_nhap_ban_dau, ?) WHERE id_ct = ?', [moi, cu, d.id_ct]);
        // Gia von binh quan: phan hang cua dong nay (con trong kho) doi gia.
        const sl = Number(d.so_luong_con_lai) || 0;
        if (sl > 0) {
          const [[nl]] = await conn.query('SELECT so_luong, gia_von FROM nguyen_lieu WHERE id_nl = ? FOR UPDATE', [d.id_nl]);
          const ton = Number(nl.so_luong);
          if (ton > 0) {
            const gv = Math.max(0, Number(nl.gia_von) + (sl * (moi - cu)) / ton);
            await conn.query('UPDATE nguyen_lieu SET gia_von = ? WHERE id_nl = ?', [Math.round(gv * 100) / 100, d.id_nl]);
          }
        }
      }
      tong += Number(d.so_luong) * moi;
    }
    if (soDoi && ghiChu.length < 3) throw new LoiDuyetNhap('Sửa đơn giá phải ghi chú căn cứ (vd: theo hóa đơn số ...).');
    trangThaiMoi = Math.round(tong) > ch.nguong_duyet ? 'cho_duyet' : 'da_duyet';
    await conn.query(
      `UPDATE phieu_nhap SET tong_tien = ?, trang_thai_duyet = ?, id_nv_doi_chieu = ?, doi_chieu_luc = NOW(), ghi_chu_doi_chieu = ?
         ${trangThaiMoi === 'da_duyet' ? ', duyet_luc = NOW(), id_nv_duyet = NULL, ghi_chu_duyet = ?' : ''} WHERE id_pn = ?`,
      trangThaiMoi === 'da_duyet'
        ? [Math.round(tong), trangThaiMoi, nguoi.id || null, ghiChu || null, `Tự duyệt: dưới ngưỡng ${ch.nguong_duyet.toLocaleString('vi-VN')}đ`, idPn]
        : [Math.round(tong), trangThaiMoi, nguoi.id || null, ghiChu || null, idPn]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  nen(() => baoBuoc(idPn));
  return { trang_thai: trangThaiMoi };
}

// ------------------------------------------------------------------ buoc 4: duyet

/** Quan ly duyet (dongY) hoac tra ve ke toan kem ly do. */
async function duyet(idPn, { dongY = true, ghiChu = '' } = {}, nguoi = {}) {
  await damBaoCauTruc();
  const ly = String(ghiChu || '').trim().slice(0, 500);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[p]] = await conn.query(
      `SELECT pn.*, dmh.id_nv_tao AS id_nv_tao_don FROM phieu_nhap pn
         LEFT JOIN don_mua_hang dmh ON dmh.id_dmh = pn.id_dmh WHERE pn.id_pn = ? FOR UPDATE`, [idPn]);
    if (!p) throw new LoiDuyetNhap('Không tìm thấy phiếu nhập.', 'NOT_FOUND');
    if (p.trang_thai_duyet !== 'cho_duyet') throw new LoiDuyetNhap(`Phiếu ${p.ma_phieu} không còn chờ duyệt.`);
    if (!nguoi.laAdmin && nguoi.id) {
      const id = Number(nguoi.id);
      if (Number(p.id_nv) === id) throw new LoiDuyetNhap(`Không tự duyệt phiếu ${p.ma_phieu} do chính mình lập.`, 'FORBIDDEN');
      if (Number(p.id_nv_qc) === id) throw new LoiDuyetNhap(`Bạn đã kiểm tra chất lượng phiếu ${p.ma_phieu} – nhờ một quản lý khác duyệt.`, 'FORBIDDEN');
      if (Number(p.id_nv_tao_don) === id) throw new LoiDuyetNhap(`Bạn lập đơn mua của phiếu ${p.ma_phieu} – nhờ một quản lý khác duyệt.`, 'FORBIDDEN');
    }
    if (dongY) {
      await conn.query(
        "UPDATE phieu_nhap SET trang_thai_duyet = 'da_duyet', id_nv_duyet = ?, duyet_luc = NOW(), ghi_chu_duyet = ? WHERE id_pn = ?",
        [nguoi.id || null, ly || null, idPn]);
    } else {
      if (ly.length < 3) throw new LoiDuyetNhap('Trả về kế toán phải ghi lý do.');
      await conn.query(
        "UPDATE phieu_nhap SET trang_thai_duyet = 'cho_doi_chieu', ghi_chu_duyet = ? WHERE id_pn = ?", [ly, idPn]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  nen(() => baoBuoc(idPn));
  return { trang_thai: dongY ? 'da_duyet' : 'cho_doi_chieu' };
}

/** Duyet ca loat cuoi ngay. Phieu khong duyet duoc (tach nhiem vu...) bao lai rieng. */
async function duyetLoat(ids, nguoi = {}) {
  const kq = { da_duyet: [], bo_qua: [] };
  for (const id of [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter(Boolean))].slice(0, 100)) {
    try {
      await duyet(id, { dongY: true }, nguoi);
      kq.da_duyet.push(id);
    } catch (e) {
      kq.bo_qua.push({ id, ly_do: e.message });
    }
  }
  return kq;
}

// ------------------------------------------------------------------ nhac phieu ton dong

/** Phieu nam qua lau o mot buoc -> nhac lai MOT lan (chong trung qua thong_bao_da_bao). */
async function quetPhieuTon() {
  await damBaoCauTruc();
  const [rows] = await db.query(
    `SELECT id_pn, trang_thai_duyet FROM phieu_nhap
      WHERE (trang_thai_duyet = 'cho_qc' AND thoi_diem < NOW() - INTERVAL 60 MINUTE)
         OR (trang_thai_duyet = 'cho_doi_chieu' AND COALESCE(qc_luc, thoi_diem) < NOW() - INTERVAL 24 HOUR)
         OR (trang_thai_duyet = 'cho_duyet' AND doi_chieu_luc < NOW() - INTERVAL 24 HOUR)
      LIMIT 50`);
  const { daBao } = require('./thongBaoNghiepVu');
  let n = 0;
  for (const r of rows) {
    if (await daBao(`pn_ton:${r.id_pn}:${r.trang_thai_duyet}`)) continue;
    await baoBuoc(r.id_pn);
    n++;
  }
  return n;
}

module.exports = {
  TRANG_THAI, KET_QUA_QC, LoiDuyetNhap,
  damBaoCauTruc, cauHinh, sauNhapKho, luuAnhChungTu, baoBuoc, nen,
  chiTiet, danhSach, demTheoTrangThai, kiemTraChatLuong, doiChieu, duyet, duyetLoat, quetPhieuTon,
};
