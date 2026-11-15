/**
 * Kho luu PHIEN DANG NHAP trong MySQL (thay cho MemoryStore mac dinh).
 *
 * MemoryStore cua express-session giu phien trong RAM: khoi dong lai server la
 * moi nhan vien bi dang xuat giua ca, gio hang cua khach mat sach, va bo nho
 * tang dan vi phien het han khong bao gio duoc don (chinh express-session canh
 * bao "not designed for a production environment").
 *
 * Khong dung goi express-mysql-session vi no ghim mysql2 3.10.2 - ban co lo
 * hong ro ri mat khau. Kho nay dung lai pool cua config/db.js.
 */
const session = require('express-session');

const BANG = 'phien_dang_nhap';
const MAC_DINH_GIO = 24; // phien khong co cookie.expires song toi da 24 gio

class PhienMySql extends session.Store {
  constructor(db, { gioSong = MAC_DINH_GIO, donDepPhut = 15 } = {}) {
    super();
    this.db = db;
    this.msSong = gioSong * 3600 * 1000;
    this.sanSang = null;
    const t = setInterval(() => this.donDep().catch(() => {}), donDepPhut * 60 * 1000);
    if (t.unref) t.unref();
  }

  /** Tao bang lan dau dung - khong can chay migration rieng. */
  chuanBi() {
    if (!this.sanSang) {
      this.sanSang = this.db.query(
        `CREATE TABLE IF NOT EXISTS ${BANG} (
           sid VARCHAR(128) NOT NULL PRIMARY KEY,
           het_han BIGINT UNSIGNED NOT NULL,
           du_lieu MEDIUMTEXT NOT NULL,
           KEY idx_het_han (het_han)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      ).catch((e) => { this.sanSang = null; throw e; });
    }
    return this.sanSang;
  }

  hetHan(sess) {
    const e = sess && sess.cookie && sess.cookie.expires;
    return e ? new Date(e).getTime() : Date.now() + this.msSong;
  }

  get(sid, cb) {
    this.chuanBi()
      .then(() => this.db.query(`SELECT du_lieu FROM ${BANG} WHERE sid = ? AND het_han > ?`, [sid, Date.now()]))
      .then(([r]) => cb(null, r.length ? JSON.parse(r[0].du_lieu) : null))
      .catch((e) => cb(e));
  }

  set(sid, sess, cb = () => {}) {
    let duLieu;
    try { duLieu = JSON.stringify(sess); } catch (e) { cb(e); return; }
    this.chuanBi()
      .then(() => this.db.query(
        `INSERT INTO ${BANG} (sid, het_han, du_lieu) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE het_han = VALUES(het_han), du_lieu = VALUES(du_lieu)`,
        [sid, this.hetHan(sess), duLieu]
      ))
      .then(() => cb(null))
      .catch((e) => cb(e));
  }

  touch(sid, sess, cb = () => {}) {
    this.chuanBi()
      .then(() => this.db.query(`UPDATE ${BANG} SET het_han = ? WHERE sid = ?`, [this.hetHan(sess), sid]))
      .then(() => cb(null))
      .catch((e) => cb(e));
  }

  destroy(sid, cb = () => {}) {
    this.chuanBi()
      .then(() => this.db.query(`DELETE FROM ${BANG} WHERE sid = ?`, [sid]))
      .then(() => cb(null))
      .catch((e) => cb(e));
  }

  async donDep() {
    await this.chuanBi();
    await this.db.query(`DELETE FROM ${BANG} WHERE het_han <= ?`, [Date.now()]);
  }
}

module.exports = PhienMySql;
