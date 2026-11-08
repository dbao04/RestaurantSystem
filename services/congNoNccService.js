/**
 * CONG NO NHA CUNG CAP.
 *
 * Truoc day phieu nhap kho (khoBepService.taoPhieuNhap) ghi tong tien hang
 * nhung khong ai theo doi da tra nha cung cap chua: ke toan phai lap tay mot
 * phieu chi "mua nguyen lieu" trong so quy, khong gan voi phieu nhap nao, de
 * trung hoac sot.
 *
 * Nay:
 *   - Phieu nhap CO nha cung cap phat sinh cong no = tong_tien - da_tra, han
 *     tra mac dinh HAN_NO_NGAY ngay. Phieu khong co NCC (nhap nhanh, ton dau
 *     ky) khong phat sinh no.
 *   - Tra tien (het hoac mot phan) -> sinh PHIEU CHI danh muc 'tra_ncc' trong
 *     phieu_thu_chi, gan id_pn / id_ncc, va cong vao phieu_nhap.da_tra - trong
 *     cung mot transaction, khoa dong phieu nhap de hai nguoi tra cung luc
 *     khong vuot so no.
 *   - Huy phieu chi do (thuChiService.huyPhieu) thi tru lai da_tra.
 *   - Tach nhiem vu: bep NHAN hang (lap phieu nhap), ke toan / quan ly TRA tien.
 *
 * Phieu nhap co truoc khi bat tinh nang (migration 041) duoc coi la da tra du:
 * khong co du lieu thanh toan that, tinh la no thi bao no ao hang ty dong.
 */
const db = require('../config/db');

const HAN_NO_NGAY = 30;

class LoiCongNo extends Error {
  constructor(msg, ma = 'INVALID') { super(msg); this.name = 'LoiCongNo'; this.ma = ma; }
}

let daCoCot = false;
async function coCot(bang, cot) {
  const [r] = await db.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [bang, cot]);
  return r.length > 0;
}

/**
 * Them cot can thiet. Lan dau them `phieu_nhap.da_tra` thi coi moi phieu nhap
 * dang co la da tra du (xem ghi chu dau tep). Tra ve so phieu cu da danh dau.
 */
async function damBaoCot() {
  if (daCoCot) return 0;
  let danhDauCu = 0;
  if (!(await coCot('phieu_nhap', 'da_tra'))) {
    await db.query("ALTER TABLE phieu_nhap ADD COLUMN da_tra DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT 'Da tra nha cung cap'");
    const [kq] = await db.query('UPDATE phieu_nhap SET da_tra = tong_tien');
    danhDauCu = kq.affectedRows;
  }
  if (!(await coCot('phieu_nhap', 'han_thanh_toan'))) {
    await db.query("ALTER TABLE phieu_nhap ADD COLUMN han_thanh_toan DATE NULL COMMENT 'Han tra nha cung cap'");
  }
  if (!(await coCot('phieu_thu_chi', 'id_pn'))) {
    await db.query('ALTER TABLE phieu_thu_chi ADD COLUMN id_pn INT NULL, ADD COLUMN id_ncc INT NULL, ADD KEY idx_ptc_pn (id_pn)');
  }
  daCoCot = true;
  return danhDauCu;
}

/** Goi khi vua tao phieu nhap: dat han tra cho phieu co NCC. */
async function datHanTra(conn, idPn, idNcc) {
  await damBaoCot();
  if (!idNcc) return;
  await conn.query(
    `UPDATE phieu_nhap SET han_thanh_toan = DATE_ADD(ngay_nhap, INTERVAL ${HAN_NO_NGAY} DAY) WHERE id_pn = ?`, [idPn]);
}

const CON_NO = '(pn.tong_tien - pn.da_tra)';

/** Tong cong no theo nha cung cap (chi NCC con no). */
async function tongHop() {
  await damBaoCot();
  const [rows] = await db.query(
    `SELECT ncc.id_ncc, ncc.ten_ncc, ncc.sodienthoai,
            COUNT(*) AS so_phieu,
            SUM(${CON_NO}) AS con_no,
            SUM(CASE WHEN pn.han_thanh_toan < CURDATE() THEN ${CON_NO} ELSE 0 END) AS qua_han,
            MIN(pn.han_thanh_toan) AS han_som_nhat
       FROM phieu_nhap pn JOIN nha_cung_cap ncc ON ncc.id_ncc = pn.id_ncc
      WHERE pn.trangthai = 1 AND ${CON_NO} > 0.5
      GROUP BY ncc.id_ncc, ncc.ten_ncc, ncc.sodienthoai
      ORDER BY qua_han DESC, con_no DESC`);
  return rows.map((r) => ({ ...r, con_no: Number(r.con_no), qua_han: Number(r.qua_han), so_phieu: Number(r.so_phieu) }));
}

/** Cac phieu nhap con no (cua mot NCC, hoac tat ca). */
async function phieuConNo(idNcc = null) {
  await damBaoCot();
  const [rows] = await db.query(
    `SELECT pn.id_pn, pn.ma_phieu, pn.ngay_nhap, pn.han_thanh_toan, pn.tong_tien, pn.da_tra, ${CON_NO} AS con_no,
            pn.id_ncc, ncc.ten_ncc, (pn.han_thanh_toan < CURDATE()) AS qua_han
       FROM phieu_nhap pn JOIN nha_cung_cap ncc ON ncc.id_ncc = pn.id_ncc
      WHERE pn.trangthai = 1 AND ${CON_NO} > 0.5 ${idNcc ? 'AND pn.id_ncc = ?' : ''}
      ORDER BY pn.han_thanh_toan, pn.id_pn`, idNcc ? [idNcc] : []);
  return rows.map((r) => ({
    ...r, tong_tien: Number(r.tong_tien), da_tra: Number(r.da_tra), con_no: Number(r.con_no), qua_han: !!Number(r.qua_han),
  }));
}

/** Lich su tra tien cua mot phieu nhap. */
async function lichSuTra(idPn) {
  await damBaoCot();
  const [rows] = await db.query(
    `SELECT p.ma_phieu, p.so_tien, p.phuong_thuc, p.thoi_diem, p.trang_thai, nv.ten AS ten_nv
       FROM phieu_thu_chi p LEFT JOIN nhan_vien nv ON nv.id_nv = p.id_nv
      WHERE p.id_pn = ? ORDER BY p.id DESC`, [idPn]);
  return rows;
}

/**
 * Tra tien cho mot phieu nhap. Sinh phieu chi 'tra_ncc' + cong da_tra.
 * @returns {{ ma_phieu_chi, con_no }}
 */
async function traTien({ idPn, soTien, phuongThuc = 'chuyen_khoan', ghiChu = '' }, idNv) {
  await damBaoCot();
  const tien = Math.round(Number(String(soTien ?? '').replace(/[^\d.]/g, '')));
  if (!['tien_mat', 'chuyen_khoan'].includes(phuongThuc)) throw new LoiCongNo('Phương thức không hợp lệ.');
  if (!Number.isFinite(tien) || tien < 1000) throw new LoiCongNo('Số tiền tối thiểu 1.000đ.');

  const thuChi = require('./thuChiService');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[pn]] = await conn.query(
      `SELECT pn.*, ncc.ten_ncc FROM phieu_nhap pn LEFT JOIN nha_cung_cap ncc ON ncc.id_ncc = pn.id_ncc
        WHERE pn.id_pn = ? FOR UPDATE`, [idPn]);
    if (!pn) throw new LoiCongNo('Không tìm thấy phiếu nhập.', 'NOT_FOUND');
    if (!pn.id_ncc) throw new LoiCongNo('Phiếu nhập này không có nhà cung cấp - không phát sinh công nợ.');
    const conNo = Math.round(Number(pn.tong_tien) - Number(pn.da_tra));
    if (conNo <= 0) throw new LoiCongNo('Phiếu nhập này đã trả đủ.');
    if (tien > conNo) throw new LoiCongNo(`Số tiền vượt số còn nợ (${conNo.toLocaleString('vi-VN')}đ).`);

    let maPhieu = null;
    for (let lan = 0; lan < 5 && !maPhieu; lan++) {
      const ma = await thuChi.taoMaPhieu(conn, 'chi');
      try {
        await conn.query(
          `INSERT INTO phieu_thu_chi (ma_phieu, loai, danh_muc, so_tien, phuong_thuc, doi_tuong, noi_dung, so_chung_tu,
                                      thoi_diem, id_nv, id_pn, id_ncc)
           VALUES (?, 'chi', 'tra_ncc', ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
          [ma, tien, phuongThuc, String(pn.ten_ncc || '').slice(0, 150) || null,
            `Trả tiền phiếu nhập ${pn.ma_phieu}${ghiChu ? ' - ' + String(ghiChu).trim().slice(0, 300) : ''}`,
            pn.ma_phieu, idNv || null, pn.id_pn, pn.id_ncc]);
        maPhieu = ma;
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY') throw e;
      }
    }
    if (!maPhieu) throw new LoiCongNo('Hệ thống đang bận, vui lòng thử lại.');

    await conn.query('UPDATE phieu_nhap SET da_tra = da_tra + ? WHERE id_pn = ?', [tien, pn.id_pn]);
    await conn.commit();
    return { ma_phieu_chi: maPhieu, con_no: conNo - tien };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Huy phieu chi tra NCC -> tru lai da_tra (thuChiService.huyPhieu goi). */
async function hoanTacTra(conn, phieuChi) {
  if (!phieuChi || !phieuChi.id_pn || phieuChi.danh_muc !== 'tra_ncc') return;
  await conn.query('UPDATE phieu_nhap SET da_tra = GREATEST(da_tra - ?, 0) WHERE id_pn = ?',
    [Number(phieuChi.so_tien) || 0, phieuChi.id_pn]);
}

module.exports = { HAN_NO_NGAY, LoiCongNo, damBaoCot, datHanTra, tongHop, phieuConNo, lichSuTra, traTien, hoanTacTra };
