/**
 * Dat lai mat khau khach hang bang LINK CO HAN DUNG.
 *
 * Truoc day trang "Quen mat khau" sinh mat khau moi va GHI DE ngay khi ai do
 * nhap email - nghia la ai biet email cua nguoi khac cung doi duoc mat khau
 * cua ho (chu tai khoan bi day ra, phai vao mail lay mat khau moi). Trang con
 * bao "Email khong ton tai" nen do duoc email nao co tai khoan.
 *
 * Nay:
 *   1. Nhap email -> LUON bao cung mot cau, co hay khong co tai khoan.
 *   2. Neu co: gui link chua token ngau nhien 32 byte. CSDL chi luu SHA-256
 *      cua token (lo CSDL cung khong dung duoc link).
 *   3. Link song 30 phut, dung mot lan; dat mat khau xong thi moi link khac
 *      cua tai khoan do cung het hieu luc. Mat khau cu GIU NGUYEN cho toi khi
 *      chinh chu bam link va dat mat khau moi.
 */
const crypto = require('crypto');
const db = require('../config/db');
const matKhau = require('../utils/matKhau');

const HAN_PHUT = 30;

let daTaoBang = false;
async function damBaoBang() {
  if (daTaoBang) return;
  // Migration 037 tao bang nay; tao o day nua de he thong chua chay migration
  // van khong vo trang quen mat khau.
  await db.query(`CREATE TABLE IF NOT EXISTS dat_lai_mat_khau (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_kh INT NOT NULL,
    token_hash CHAR(64) NOT NULL,
    het_han DATETIME NOT NULL,
    da_dung_luc DATETIME NULL,
    ip VARCHAR(64) NULL,
    tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dlmk_token (token_hash),
    KEY idx_dlmk_kh (id_kh)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  daTaoBang = true;
}

const bamToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/**
 * Tao link dat lai cho email. Tra ve { khach, token } hoac null neu email
 * khong thuoc tai khoan nao (noi goi KHONG duoc tiet lo dieu nay cho nguoi dung).
 */
async function taoYeuCau(email, ip = null) {
  await damBaoBang();
  const e = String(email || '').trim();
  if (!e) return null;
  const [[kh]] = await db.query(
    "SELECT id, ten, email FROM khach_hang WHERE email = ? AND sodienthoai NOT LIKE 'QR\\_%' LIMIT 1", [e]
  );
  if (!kh) return null;

  const token = crypto.randomBytes(32).toString('base64url');
  // Moi lan xin link moi thi link cu het hieu luc - chi link gan nhat dung duoc.
  await db.query('UPDATE dat_lai_mat_khau SET da_dung_luc = NOW() WHERE id_kh = ? AND da_dung_luc IS NULL', [kh.id]);
  await db.query(
    `INSERT INTO dat_lai_mat_khau (id_kh, token_hash, het_han, ip)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ${HAN_PHUT} MINUTE), ?)`,
    [kh.id, bamToken(token), ip ? String(ip).slice(0, 64) : null]
  );
  return { khach: kh, token, hanPhut: HAN_PHUT };
}

/** Dong yeu cau con hieu luc cua token, hoac null. */
async function timYeuCau(token) {
  await damBaoBang();
  if (!token || String(token).length < 20) return null;
  const [[yc]] = await db.query(
    `SELECT d.id, d.id_kh, k.ten, k.email FROM dat_lai_mat_khau d JOIN khach_hang k ON k.id = d.id_kh
     WHERE d.token_hash = ? AND d.da_dung_luc IS NULL AND d.het_han > NOW() LIMIT 1`,
    [bamToken(token)]
  );
  return yc || null;
}

/**
 * Dat mat khau moi bang token. Tra ve { ok: true } hoac { ok: false, loi }.
 */
async function datMatKhauMoi(token, matKhauMoi) {
  const loi = matKhau.loiMatKhauMoi(matKhauMoi);
  if (loi) return { ok: false, loi };

  await damBaoBang();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[yc]] = await conn.query(
      `SELECT id, id_kh FROM dat_lai_mat_khau
       WHERE token_hash = ? AND da_dung_luc IS NULL AND het_han > NOW() LIMIT 1 FOR UPDATE`,
      [bamToken(token)]
    );
    if (!yc) {
      await conn.rollback();
      return { ok: false, loi: 'Liên kết đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu liên kết mới.' };
    }
    await conn.query('UPDATE khach_hang SET passwords = ? WHERE id = ?', [await matKhau.bam(matKhauMoi), yc.id_kh]);
    await conn.query('UPDATE dat_lai_mat_khau SET da_dung_luc = NOW() WHERE id_kh = ? AND da_dung_luc IS NULL', [yc.id_kh]);
    await conn.commit();
    return { ok: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { taoYeuCau, timYeuCau, datMatKhauMoi, HAN_PHUT, damBaoBang };
