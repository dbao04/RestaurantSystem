/**
 * TIEN THU HO (COD) CUA SHIPPER + LICH SU DON.
 *
 * Van de truoc day: don giao xong -> hopdong.tinhtrang = 3 ("da thanh toan")
 * nhung KHONG co dong nao trong `payments`. Tien mat shipper cam ve khong nam
 * trong so quy, khong vao chot ca, va khong ai biet shipper dang giu bao nhieu.
 *
 * Luong moi:
 *   1. Giao xong don co thu ho -> don_giao_hang.da_thu_ho = 1 (da co). Tien dang
 *      nam O SHIPPER: ung dung shipper hien "Tien thu ho dang giu".
 *   2. Shipper ve quay nop. Thu ngan / dieu phoi bam "Nhan tien" -> moi don tao
 *      MOT dong payments tien mat, `processed_by` = NGUOI NHAN TIEN, nguon
 *      'shipper'. Nho vay tien vao dung so quy luc no thuc su vao ket, va chot
 *      ca cua thu ngan tu dem duoc khoan nay (chotCaService dem theo
 *      processed_by) - khong cong trung, khong sot.
 *   3. Don danh dau nop_tien_luc / nop_cho_nv / id_payment_nop - khong nop lai
 *      lan hai duoc (khoa bang dieu kien trong cau UPDATE).
 */
const db = require('../config/db');

class LoiThuHo extends Error {
  constructor(msg) { super(msg); this.name = 'LoiThuHo'; }
}

let daDamBao = false;
async function damBaoCot() {
  if (daDamBao) return;
  const [cot] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'don_giao_hang'
        AND COLUMN_NAME IN ('nop_tien_luc','nop_cho_nv','id_payment_nop')`);
  const co = new Set(cot.map((c) => c.COLUMN_NAME));
  if (!co.has('nop_tien_luc')) await db.query('ALTER TABLE don_giao_hang ADD COLUMN nop_tien_luc DATETIME NULL');
  if (!co.has('nop_cho_nv')) await db.query('ALTER TABLE don_giao_hang ADD COLUMN nop_cho_nv INT NULL');
  if (!co.has('id_payment_nop')) await db.query('ALTER TABLE don_giao_hang ADD COLUMN id_payment_nop INT NULL');
  const [[ng]] = await db.query(
    `SELECT COLUMN_TYPE AS t FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'nguon'`);
  if (ng && !/'shipper'/.test(ng.t)) {
    await db.query(
      "ALTER TABLE payments MODIFY nguon ENUM('quay','khach_qr','web','webhook','shipper') NOT NULL DEFAULT 'quay'");
  }
  daDamBao = true;
}

/** Cac don shipper DA THU tien mat nhung CHUA nop ve quay. */
async function tienDangGiu(idShipper) {
  await damBaoCot();
  const [ds] = await db.query(
    `SELECT id_giao, ma_giao, sesis, ten_nguoi_nhan, dia_chi_giao, tien_thu_ho, hoan_tat_luc
       FROM don_giao_hang
      WHERE id_shipper = ? AND trang_thai = 'da_giao' AND da_thu_ho = 1
        AND tien_thu_ho > 0 AND nop_tien_luc IS NULL
      ORDER BY hoan_tat_luc`, [idShipper]);
  return { don: ds, tong: ds.reduce((s, d) => s + Number(d.tien_thu_ho), 0) };
}

/** Tat ca shipper dang giu tien thu ho - cho man hinh dieu phoi / thu ngan. */
async function tongHopDangGiu() {
  await damBaoCot();
  const [ds] = await db.query(
    `SELECT s.id_shipper, TRIM(COALESCE(n.ten, s.ten)) AS ten, s.sdt,
            COUNT(g.id_giao) AS so_don, COALESCE(SUM(g.tien_thu_ho), 0) AS tong,
            MIN(g.hoan_tat_luc) AS tu_luc
       FROM don_giao_hang g
       JOIN shipper s ON s.id_shipper = g.id_shipper
       LEFT JOIN nhan_vien n ON n.id_nv = s.id_nv
      WHERE g.trang_thai = 'da_giao' AND g.da_thu_ho = 1 AND g.tien_thu_ho > 0 AND g.nop_tien_luc IS NULL
      GROUP BY s.id_shipper, ten, s.sdt
      ORDER BY tong DESC`);
  return ds.map((r) => ({ ...r, so_don: Number(r.so_don), tong: Number(r.tong) }));
}

/**
 * Thu ngan / dieu phoi NHAN tien thu ho cua mot shipper.
 * @param {number[]|null} idsGiao  null = nhan het cac don dang giu.
 * @param {{id_nv:number, ten:string}} nguoiNhan
 */
async function nhanTien(idShipper, idsGiao, nguoiNhan, { soTienDem = null } = {}) {
  await damBaoCot();
  if (!nguoiNhan || !nguoiNhan.id_nv) throw new LoiThuHo('Phải là nhân viên đăng nhập mới nhận tiền được.');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const loc = Array.isArray(idsGiao) && idsGiao.length ? ' AND id_giao IN (?)' : '';
    const [ds] = await conn.query(
      `SELECT id_giao, ma_giao, sesis, tien_thu_ho FROM don_giao_hang
        WHERE id_shipper = ? AND trang_thai = 'da_giao' AND da_thu_ho = 1
          AND tien_thu_ho > 0 AND nop_tien_luc IS NULL${loc}
        FOR UPDATE`,
      loc ? [idShipper, idsGiao.map(Number)] : [idShipper]);
    if (!ds.length) throw new LoiThuHo('Shipper không có khoản thu hộ nào chờ nộp.');
    const tong = ds.reduce((s, d) => s + Math.round(Number(d.tien_thu_ho)), 0);
    if (soTienDem !== null && soTienDem !== '' && Math.round(Number(soTienDem)) !== tong) {
      throw new LoiThuHo(`Số tiền đếm được ${Math.round(Number(soTienDem)).toLocaleString('vi-VN')}đ không khớp tổng thu hộ ${tong.toLocaleString('vi-VN')}đ - kiểm tra lại từng đơn trước khi nhận.`);
    }
    const [[pt]] = await conn.query("SELECT id FROM payment_methods WHERE code = 'tien_mat' LIMIT 1");
    if (!pt) throw new LoiThuHo('Chưa có phương thức thanh toán tiền mặt.');
    const [[sp]] = await conn.query(
      'SELECT TRIM(COALESCE(n.ten, s.ten)) AS ten FROM shipper s LEFT JOIN nhan_vien n ON n.id_nv = s.id_nv WHERE s.id_shipper = ?',
      [idShipper]);

    for (const d of ds) {
      const [p] = await conn.query(
        `INSERT INTO payments (sesis, amount, payment_method_id, status, loai, nguon,
                               tien_khach_dua, tien_thoi_lai, thanh_cong_luc, processed_by, notes, created_at, updated_at)
         VALUES (?, ?, ?, 'success', 'thanh_toan', 'shipper', ?, 0, NOW(), ?, ?, NOW(), NOW())`,
        [d.sesis, Math.round(Number(d.tien_thu_ho)), pt.id, Math.round(Number(d.tien_thu_ho)), nguoiNhan.id_nv,
          `Tiền thu hộ đơn giao ${d.ma_giao} - shipper ${sp ? sp.ten : idShipper} nộp, ${nguoiNhan.ten || ''} nhận`.trim()]);
      const [kq] = await conn.query(
        `UPDATE don_giao_hang SET nop_tien_luc = NOW(), nop_cho_nv = ?, id_payment_nop = ?
          WHERE id_giao = ? AND nop_tien_luc IS NULL`, [nguoiNhan.id_nv, p.insertId, d.id_giao]);
      if (!kq.affectedRows) throw new LoiThuHo(`Đơn ${d.ma_giao} vừa được người khác nhận tiền.`);
    }
    await conn.query(
      `INSERT INTO audit_logs (action, actor_type, actor_id, resource_type, resource_id, status, details)
       VALUES ('nhan_tien_thu_ho', 'staff', ?, 'shipper', ?, 'success', ?)`,
      [nguoiNhan.id_nv, idShipper, JSON.stringify({ so_don: ds.length, tong, ma: ds.map((d) => d.ma_giao) })]).catch(() => {});
    await conn.commit();
    return { so_don: ds.length, tong, ma: ds.map((d) => d.ma_giao) };
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}

/** Lich su don da ket thuc cua shipper (giao xong / that bai / huy) trong N ngay. */
async function lichSu(idShipper, soNgay = 7) {
  await damBaoCot();
  const n = Math.max(1, Math.min(60, Number(soNgay) || 7));
  const [ds] = await db.query(
    `SELECT id_giao, ma_giao, ten_nguoi_nhan, dia_chi_giao, trang_thai, ly_do, phi_giao,
            tien_thu_ho, da_thu_ho, nop_tien_luc, giao_luc, hoan_tat_luc, khoang_cach_km
       FROM don_giao_hang
      WHERE id_shipper = ? AND trang_thai IN ('da_giao','that_bai','huy')
        AND hoan_tat_luc >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      ORDER BY hoan_tat_luc DESC LIMIT 200`, [idShipper, n - 1]);
  const giao = ds.filter((d) => d.trang_thai === 'da_giao');
  return {
    so_ngay: n,
    don: ds,
    tong_ket: {
      da_giao: giao.length,
      that_bai: ds.filter((d) => d.trang_thai === 'that_bai').length,
      phi_ship: giao.reduce((s, d) => s + Number(d.phi_giao || 0), 0),
      thu_ho: giao.filter((d) => Number(d.da_thu_ho)).reduce((s, d) => s + Number(d.tien_thu_ho || 0), 0),
    },
  };
}

module.exports = { damBaoCot, tienDangGiu, tongHopDangGiu, nhanTien, lichSu, LoiThuHo };
