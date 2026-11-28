/**
 * NHA CUNG CAP + BANG GIA THEO NHA CUNG CAP.
 *
 * Thuc te moi nha cung cap chi ban MOT SO mat hang, moi noi mot gia: cho dau
 * moi co hai san va rau, nha phan phoi nuoc ngot chi co do uong, cong ty sua
 * chi co sua / kem / pho mai. Bang `ncc_bang_gia` ghi dung dieu do:
 *
 *   (id_ncc, id_nl) duy nhat · don_gia · so_luong_toi_thieu (MOQ) ·
 *   so_ngay_giao (null = dung mac dinh cua mua hang) · ghi_chu · cap_nhat_luc
 *
 * Dung o dau:
 *   - Goi y mua / tro ly du bao: moi nguyen lieu chon nha cung cap RE NHAT
 *     dang hop tac co ban mat hang do, uu tien noi ma so luong de xuat dat MOQ.
 *   - Sua don mua: doi nha cung cap thi don gia tu dien theo bang gia, mat
 *     hang nha cung cap do khong ban duoc danh dau.
 *
 * DU LIEU BAN DAU
 *   Lan dau tao bang (bang trong) se dien san tu LICH SU NHAP KHO: gia = trung
 *   binh gia nhap 90 ngay gan nhat cua dung cap (NCC, nguyen lieu); mat hang nao
 *   duoc ban o dau theo nhom (do uong -> nha phan phoi nuoc giai khat, sua ->
 *   cong ty sua, rau cu trai cay -> HTX rau + cho dau moi, thit / trung -> cong
 *   ty thuc pham + cho dau moi, hai san va do kho -> cho dau moi). Quan ly sua
 *   lai tren trang Nha cung cap.
 */
const db = require('../config/db');

class LoiNcc extends Error {
  // Cung ten / truong `ma` voi LoiKho de traLoi() cua routes/khoBep.js tra dung ma HTTP.
  constructor(msg, ma = 'BAD_REQUEST') { super(msg); this.name = 'LoiKho'; this.ma = ma; }
}

const so = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/,/g, '.'));
  return Number.isFinite(n) ? n : null;
};

let daDamBao = false;
async function damBaoBang() {
  if (daDamBao) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS ncc_bang_gia (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_ncc INT NOT NULL,
      id_nl INT NOT NULL,
      don_gia DECIMAL(14,2) NOT NULL DEFAULT 0,
      so_luong_toi_thieu DECIMAL(12,3) NOT NULL DEFAULT 0,
      so_ngay_giao TINYINT UNSIGNED NULL,
      ghi_chu VARCHAR(255) NULL,
      cap_nhat_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_ncc_nl (id_ncc, id_nl),
      KEY idx_nl (id_nl)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM ncc_bang_gia');
  if (Number(n) === 0) await dienBanDau();
  daDamBao = true;
}

// ------------------------------------------------------------------ du lieu ban dau

const boDau = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const NHOM = [
  ['do_uong', /\b(bia|coca|pepsi|sprite|sting|nuoc suoi|nuoc ep|da vien|sake chai)\b/],
  ['sua', /\b(kem tuoi|pho mai|sua dac)\b/],
  ['hai_san', /\b(bach tuoc|bao ngu|cua|hau sua|luon|muc|ngheu|nhum|rong nho|so |so$|sua bien|tom|trung ca)\b/],
  ['thit', /\b(bo my|bo wagyu|gan bo|suon heo|thit bo|thit ga|thit heo|trung ga|surimi)\b/],
  ['rau', /\b(ca chua|ca rot|cai thao|cu cai|dua leo|gung$|hanh|khoai tay|la bac ha|la tia to|mang tay|nam |ngo sen|nha dam|rau thom|sa$|toi$|ot tuoi|xa lach|dau nanh long|bo trai|cam tuoi|chanh|dau tay|dua hau|oi hong|thom|trai cay|viet quat|xoai)\b/],
];
function nhomCua(ten) {
  const t = boDau(ten);
  if (/^ca (hoi|mu|ngu|cam|saba|sanma|trich)/.test(t)) return 'hai_san';
  for (const [nhom, re] of NHOM) if (re.test(t)) return nhom;
  return 'kho';
}

/** Nhom mat hang -> tu khoa nhan dien nha cung cap ban nhom do (theo ten NCC). */
const AI_BAN = {
  do_uong: [/pepsi|suntory|nuoc giai khat|do uong|bia/],
  sua: [/sua/],
  rau: [/rau|da lat|nong san/, /cho|dau moi/],
  thit: [/thuc pham|vissan|thit/, /cho|dau moi/],
  hai_san: [/cho|dau moi|hai san/],
  kho: [/cho|dau moi|tap hoa/],
};

async function dienBanDau() {
  const [ncc] = await db.query('SELECT id_ncc, ten_ncc FROM nha_cung_cap');
  if (!ncc.length) return;
  const [nl] = await db.query('SELECT id_nl, ten_nl, gia_von FROM nguyen_lieu');
  const [gia] = await db.query(`
    SELECT pn.id_ncc, c.id_nl, AVG(c.gia_nhap) AS gia
      FROM chi_tiet_phieu_nhap c JOIN phieu_nhap pn ON pn.id_pn = c.id_pn
     WHERE pn.id_ncc IS NOT NULL AND pn.ngay_nhap >= (SELECT MAX(ngay_nhap) FROM phieu_nhap) - INTERVAL 90 DAY
     GROUP BY pn.id_ncc, c.id_nl`);
  const giaCua = new Map(gia.map((g) => [`${g.id_ncc}|${g.id_nl}`, Number(g.gia)]));
  const rows = [];
  for (const m of nl) {
    const nhom = nhomCua(m.ten_nl);
    const chon = new Set();
    for (const re of AI_BAN[nhom]) {
      const ai = ncc.find((n) => re.test(boDau(n.ten_ncc)) && !chon.has(n.id_ncc));
      if (ai) chon.add(ai.id_ncc);
    }
    if (!chon.size) chon.add(ncc[0].id_ncc);
    for (const id of chon) {
      const g = giaCua.get(`${id}|${m.id_nl}`) || Number(m.gia_von) || 0;
      // Lich su nhap mau ghi cung mot gia cho moi NCC -> tao chenh lech MAU de so
      // sanh co y nghia: cho dau moi re hon noi chuyen ve rau (~8%), dat hon ve
      // thit (~6%). Quan ly sua lai theo bao gia that tren trang Nha cung cap.
      const tenNcc = boDau((ncc.find((n) => n.id_ncc === id) || {}).ten_ncc);
      const laCho = /cho|dau moi/.test(tenNcc);
      const heSo = laCho && chon.size > 1 ? (nhom === 'rau' ? 0.92 : nhom === 'thit' ? 1.06 : 1) : 1;
      const ngay = laCho ? 1 : /rau|da lat/.test(tenNcc) ? 2 : null;
      rows.push([id, m.id_nl, Math.round((g * heSo) / 500) * 500 || Math.round(g), ngay]);
    }
  }
  for (let i = 0; i < rows.length; i += 200) {
    await db.query('INSERT IGNORE INTO ncc_bang_gia (id_ncc, id_nl, don_gia, so_ngay_giao) VALUES ?', [rows.slice(i, i + 200)]);
  }
}

// ------------------------------------------------------------------ doc

async function dsNcc() {
  await damBaoBang();
  const [rows] = await db.query(`
    SELECT n.*, COUNT(b.id) AS so_mat_hang
      FROM nha_cung_cap n LEFT JOIN ncc_bang_gia b ON b.id_ncc = n.id_ncc
     GROUP BY n.id_ncc ORDER BY n.trangthai DESC, n.ten_ncc`);
  return rows.map((r) => ({ ...r, so_mat_hang: Number(r.so_mat_hang) }));
}

async function chiTietNcc(id) {
  await damBaoBang();
  const [[n]] = await db.query('SELECT * FROM nha_cung_cap WHERE id_ncc = ?', [id]);
  if (!n) return null;
  // Kem gia re nhat cua NCC khac cho tung mat hang de so sanh ngay tren trang.
  const [hang] = await db.query(`
    SELECT b.*, nl.ten_nl, dvt.ten_dvt,
           (SELECT MIN(b2.don_gia) FROM ncc_bang_gia b2 JOIN nha_cung_cap n2 ON n2.id_ncc = b2.id_ncc AND n2.trangthai = 1
             WHERE b2.id_nl = b.id_nl AND b2.id_ncc <> b.id_ncc) AS gia_noi_khac
      FROM ncc_bang_gia b JOIN nguyen_lieu nl ON nl.id_nl = b.id_nl LEFT JOIN don_vi_tinh dvt ON dvt.id_dvt = nl.id_dvt
     WHERE b.id_ncc = ? ORDER BY nl.ten_nl`, [id]);
  return {
    ...n,
    hang: hang.map((h) => ({
      ...h, don_gia: Number(h.don_gia), so_luong_toi_thieu: Number(h.so_luong_toi_thieu),
      gia_noi_khac: h.gia_noi_khac === null ? null : Number(h.gia_noi_khac),
    })),
  };
}

/**
 * Bang gia theo nguyen lieu: Map id_nl -> [{id_ncc, ten_ncc, don_gia, moq, so_ngay_giao}]
 * re nhat truoc, chi nha cung cap dang hop tac.
 */
async function giaTheoNl() {
  await damBaoBang();
  const [rows] = await db.query(`
    SELECT b.id_nl, b.id_ncc, n.ten_ncc, b.don_gia, b.so_luong_toi_thieu, b.so_ngay_giao
      FROM ncc_bang_gia b JOIN nha_cung_cap n ON n.id_ncc = b.id_ncc AND n.trangthai = 1
     ORDER BY b.id_nl, b.don_gia, b.id_ncc`);
  const m = new Map();
  for (const r of rows) {
    const id = Number(r.id_nl);
    if (!m.has(id)) m.set(id, []);
    m.get(id).push({
      id_ncc: Number(r.id_ncc), ten_ncc: r.ten_ncc, don_gia: Number(r.don_gia),
      moq: Number(r.so_luong_toi_thieu) || 0, so_ngay_giao: r.so_ngay_giao === null ? null : Number(r.so_ngay_giao),
    });
  }
  return m;
}

/**
 * Chon nha cung cap cho mot luong mua: re nhat trong so noi ma `soLuong` dat
 * MOQ; khong noi nao dat MOQ thi lay noi re nhat va bao `duoi_moq` (mua it hon
 * muc toi thieu - nha cung cap co the tu choi hoac tinh gia khac).
 */
function chonNcc(dsGia, soLuong) {
  if (!dsGia || !dsGia.length) return null;
  const dat = dsGia.filter((g) => !g.moq || soLuong >= g.moq);
  const g = (dat.length ? dat : dsGia)[0];
  return { ...g, duoi_moq: !dat.length, so_lua_chon: dsGia.length };
}

// ------------------------------------------------------------------ ghi

async function luuNcc(body = {}, id = null) {
  const ten = String(body.ten_ncc || '').trim().slice(0, 255);
  if (ten.length < 2) throw new LoiNcc('Nhập tên nhà cung cấp.');
  const sdt = String(body.sodienthoai || '').replace(/[^\d+]/g, '').slice(0, 20) || null;
  const email = String(body.email || '').trim().slice(0, 255) || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new LoiNcc('Email không hợp lệ.');
  const diaChi = String(body.diachi || '').trim().slice(0, 500) || null;
  const tt = body.trangthai === undefined ? 1 : (Number(body.trangthai) ? 1 : 0);
  if (id) {
    const [kq] = await db.query('UPDATE nha_cung_cap SET ten_ncc = ?, sodienthoai = ?, email = ?, diachi = ?, trangthai = ? WHERE id_ncc = ?',
      [ten, sdt, email, diaChi, tt, id]);
    if (!kq.affectedRows) throw new LoiNcc('Không tìm thấy nhà cung cấp.', 'NOT_FOUND');
    return { id_ncc: id };
  }
  const [kq] = await db.query('INSERT INTO nha_cung_cap (ten_ncc, sodienthoai, email, diachi, trangthai) VALUES (?, ?, ?, ?, ?)',
    [ten, sdt, email, diaChi, tt]);
  return { id_ncc: kq.insertId };
}

async function luuGia(idNcc, body = {}) {
  await damBaoBang();
  const idNl = Number(body.id_nl);
  const gia = so(body.don_gia);
  const moq = so(body.so_luong_toi_thieu) || 0;
  const ngay = so(body.so_ngay_giao);
  if (!idNl) throw new LoiNcc('Chọn nguyên liệu.');
  if (gia === null || gia < 0) throw new LoiNcc('Đơn giá phải là số không âm.');
  if (moq < 0) throw new LoiNcc('Số lượng tối thiểu không được âm.');
  if (ngay !== null && (ngay < 0 || ngay > 60)) throw new LoiNcc('Số ngày giao từ 0 đến 60.');
  const [[n]] = await db.query('SELECT id_ncc FROM nha_cung_cap WHERE id_ncc = ?', [idNcc]);
  if (!n) throw new LoiNcc('Không tìm thấy nhà cung cấp.', 'NOT_FOUND');
  const [[m]] = await db.query('SELECT id_nl FROM nguyen_lieu WHERE id_nl = ?', [idNl]);
  if (!m) throw new LoiNcc('Không tìm thấy nguyên liệu.');
  await db.query(`
    INSERT INTO ncc_bang_gia (id_ncc, id_nl, don_gia, so_luong_toi_thieu, so_ngay_giao, ghi_chu)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE don_gia = VALUES(don_gia), so_luong_toi_thieu = VALUES(so_luong_toi_thieu),
      so_ngay_giao = VALUES(so_ngay_giao), ghi_chu = VALUES(ghi_chu)`,
  [idNcc, idNl, Math.round(gia * 100) / 100, moq, ngay === null ? null : Math.round(ngay), String(body.ghi_chu || '').trim().slice(0, 255) || null]);
  return { ok: true };
}

async function boMatHang(idNcc, idNl) {
  await damBaoBang();
  const [kq] = await db.query('DELETE FROM ncc_bang_gia WHERE id_ncc = ? AND id_nl = ?', [idNcc, idNl]);
  return { ok: kq.affectedRows > 0 };
}

module.exports = { LoiNcc, damBaoBang, nhomCua, dsNcc, chiTietNcc, giaTheoNl, chonNcc, luuNcc, luuGia, boMatHang };
