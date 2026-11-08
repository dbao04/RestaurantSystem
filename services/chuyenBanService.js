/**
 * CHUYEN BAN va GOP BAN cho khach an tai cho.
 *
 * Mot "phien" ban = mot `sesis` trong `hopdong`. Ban lien ket voi phien qua BA
 * cho, phai doi dong thoi trong mot transaction, lech mot cho la sai:
 *   - hopdong.id_ban          : QR tai ban tim phien dang mo theo cot nay
 *                               (orderService.phienDangMoCuaBan), bep hien so ban
 *   - ban.sesis_hien_tai/trangthai : so do ban
 *   - qr_tables.active_sesis  : ma QR dan tren ban
 *
 * CHUYEN BAN (A -> B trong): ca phien sang B; A chuyen "dang don" (3).
 * GOP BAN    (A vao B)     : moi dong cua phien A doi sang phien B (hoa don B
 *                            gom het mon), cong so khach; A chuyen "dang don".
 *
 * Khong cho:
 *   - Chuyen vao ban dang co khach (dung Gop) hoac ban da dat truoc.
 *   - Gop khi A da co tien (thanh toan / dat coc): payments gan theo sesis A.
 *   - Gop khi A la LUOT DAT BAN (sesis = reservation_code): luot dat se mat
 *     lien ket voi hoa don. Gop theo chieu nguoc lai (B vao A) thi duoc.
 * Phien thanh toan dang cho (QR da sinh) cua cac don lien quan bi huy vi so
 * tien / ban da doi.
 */
const db = require('../config/db');

class LoiChuyenBan extends Error {}

let daTaoBang = false;
async function damBaoBang() {
  if (daTaoBang) return;
  await db.query(`CREATE TABLE IF NOT EXISTS chuyen_ban (
    id INT AUTO_INCREMENT PRIMARY KEY,
    loai ENUM('chuyen','gop') NOT NULL,
    sesis_nguon VARCHAR(191) NOT NULL,
    sesis_dich VARCHAR(191) NOT NULL,
    ban_nguon INT NOT NULL,
    ban_dich INT NOT NULL,
    ly_do VARCHAR(255) NULL,
    id_nv INT NULL,
    ten_nv VARCHAR(120) NULL,
    tao_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_cb_nguon (sesis_nguon),
    KEY idx_cb_dich (sesis_dich)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  daTaoBang = true;
}

/** Phien dang mo cua ban (khoa dong ban). */
async function phienCuaBan(conn, idBan) {
  const [[ban]] = await conn.query(
    'SELECT Id_ban, number_ban, trangthai, sesis_hien_tai, so_cho FROM ban WHERE Id_ban = ? FOR UPDATE', [idBan]);
  if (!ban) throw new LoiChuyenBan('Không tìm thấy bàn.');
  let sesis = ban.sesis_hien_tai;
  if (!sesis) {
    const [[r]] = await conn.query(
      `SELECT sesis FROM hopdong WHERE id_ban = ? AND tinhtrang IN (1, 5, 6) AND ngay_dat = CURDATE()
       ORDER BY id DESC LIMIT 1`, [idBan]);
    sesis = r ? r.sesis : null;
  }
  let don = null;
  if (sesis) {
    const [[d]] = await conn.query(
      `SELECT sesis, MAX(tinhtrang) AS tinhtrang, MAX(loai_don) AS loai_don,
              MAX(CAST(so_user AS UNSIGNED)) AS so_khach, COUNT(*) AS so_dong
       FROM hopdong WHERE sesis = ?`, [sesis]);
    if (d && d.so_dong > 0) don = d;
  }
  return { ban, sesis: don ? sesis : null, don };
}

async function kiemTraDonMo(conn, ten, p) {
  if (!p.sesis) throw new LoiChuyenBan(`${ten} không có khách đang ngồi.`);
  if (p.don.loai_don === 'giao_hang') throw new LoiChuyenBan(`${ten} gắn với đơn giao hàng.`);
  if (Number(p.don.tinhtrang) === 3) throw new LoiChuyenBan(`${ten} đã thanh toán xong.`);
  if (Number(p.don.tinhtrang) === 4) throw new LoiChuyenBan(`${ten} có đơn đã hủy.`);
}

/** Gan ma QR cua ban dich vao phien; go phien khoi QR cu. */
async function dongBoQR(conn, sesis, banDich) {
  await conn.query('UPDATE qr_tables SET active_sesis = NULL WHERE active_sesis = ?', [sesis]);
  const ten = String(banDich.number_ban || '').trim();
  if (!ten) return;
  const [ds] = await conn.query('SELECT id, table_name FROM qr_tables');
  const chuan = (s) => String(s || '').replace(/^\s*bàn\s*/i, '').trim().toLowerCase();
  const so = (s) => (/^\d+$/.test(s) ? String(Number(s)) : s);
  const khop = ds.filter((q) => so(chuan(q.table_name)) === so(chuan(ten))).map((q) => q.id);
  if (khop.length) await conn.query('UPDATE qr_tables SET active_sesis = ? WHERE id IN (?)', [sesis, khop]);
}

async function huyPhienThanhToanCho(conn, dsSesis, lyDo) {
  await conn.query(
    `UPDATE payments SET status = 'failed', notes = CONCAT(COALESCE(notes,''), ?)
     WHERE sesis IN (?) AND status = 'pending'`, [' | ' + lyDo, dsSesis]);
}

async function ghiNhatKy(conn, loai, nguon, dich, nv, lyDo) {
  await conn.query(
    `INSERT INTO chuyen_ban (loai, sesis_nguon, sesis_dich, ban_nguon, ban_dich, ly_do, id_nv, ten_nv)
     VALUES (?,?,?,?,?,?,?,?)`,
    [loai, nguon.sesis, dich.sesis || nguon.sesis, nguon.ban.Id_ban, dich.ban.Id_ban,
      lyDo ? String(lyDo).slice(0, 255) : null, (nv && nv.id) || null,
      nv && nv.ten ? String(nv.ten).slice(0, 120) : null]);
}

async function chayGiaoDich(fn) {
  await damBaoBang();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const kq = await fn(conn);
    await conn.commit();
    return kq;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function kiemTraHaiBan(idNguon, idDich) {
  const a = Number(idNguon), b = Number(idDich);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0) throw new LoiChuyenBan('Bàn không hợp lệ.');
  if (a === b) throw new LoiChuyenBan('Bàn nguồn và bàn đích phải khác nhau.');
  // Khoa theo thu tu Id tang dan de hai thao tac nguoc chieu khong deadlock.
  return a < b ? [a, b, false] : [b, a, true];
}

/** Chuyen khach tu ban A sang ban B dang trong. */
async function chuyenBan(idNguon, idDich, { nhanVien, lyDo } = {}) {
  const [x, y, dao] = kiemTraHaiBan(idNguon, idDich);
  return chayGiaoDich(async (conn) => {
    const p1 = await phienCuaBan(conn, x);
    const p2 = await phienCuaBan(conn, y);
    const nguon = dao ? p2 : p1;
    const dich = dao ? p1 : p2;
    await kiemTraDonMo(conn, 'Bàn ' + nguon.ban.number_ban, nguon);
    if (dich.sesis) throw new LoiChuyenBan(`Bàn ${dich.ban.number_ban} đang có khách - hãy dùng "Gộp bàn".`);
    if (Number(dich.ban.trangthai) === 2) throw new LoiChuyenBan(`Bàn ${dich.ban.number_ban} đã được đặt trước.`);

    await conn.query('UPDATE hopdong SET id_ban = ? WHERE sesis = ?', [dich.ban.Id_ban, nguon.sesis]);
    await conn.query('UPDATE ban SET trangthai = 1, sesis_hien_tai = ? WHERE Id_ban = ?', [nguon.sesis, dich.ban.Id_ban]);
    await conn.query('UPDATE ban SET trangthai = 3, sesis_hien_tai = NULL WHERE Id_ban = ?', [nguon.ban.Id_ban]);
    await dongBoQR(conn, nguon.sesis, dich.ban);
    await huyPhienThanhToanCho(conn, [nguon.sesis], 'hủy vì khách chuyển bàn');
    await ghiNhatKy(conn, 'chuyen', nguon, { ban: dich.ban, sesis: nguon.sesis }, nhanVien, lyDo);

    const canhBao = nguon.don.so_khach && dich.ban.so_cho && Number(nguon.don.so_khach) > Number(dich.ban.so_cho)
      ? `Lưu ý: ${nguon.don.so_khach} khách nhưng bàn ${dich.ban.number_ban} chỉ có ${dich.ban.so_cho} chỗ.` : null;
    return { sesis: nguon.sesis, ban_nguon: nguon.ban.Id_ban, ban_dich: dich.ban.Id_ban, canh_bao: canhBao };
  });
}

/** Gop phien cua ban A vao phien cua ban B (B giu hoa don). */
async function gopBan(idNguon, idDich, { nhanVien, lyDo } = {}) {
  const [x, y, dao] = kiemTraHaiBan(idNguon, idDich);
  return chayGiaoDich(async (conn) => {
    const p1 = await phienCuaBan(conn, x);
    const p2 = await phienCuaBan(conn, y);
    const nguon = dao ? p2 : p1;
    const dich = dao ? p1 : p2;
    await kiemTraDonMo(conn, 'Bàn ' + nguon.ban.number_ban, nguon);
    await kiemTraDonMo(conn, 'Bàn ' + dich.ban.number_ban, dich);
    if (nguon.sesis === dich.sesis) throw new LoiChuyenBan('Hai bàn đang dùng chung một hóa đơn.');

    const [[daThu]] = await conn.query(
      "SELECT COUNT(*) AS so FROM payments WHERE sesis = ? AND status = 'success'", [nguon.sesis]);
    if (Number(daThu.so) > 0) {
      throw new LoiChuyenBan(`Bàn ${nguon.ban.number_ban} đã có thanh toán hoặc tiền cọc - không gộp được, hãy tính tiền riêng.`);
    }
    const [[laDatBan]] = await conn.query(
      'SELECT COUNT(*) AS so FROM reservations WHERE reservation_code = ?', [nguon.sesis]);
    if (Number(laDatBan.so) > 0) {
      throw new LoiChuyenBan(`Bàn ${nguon.ban.number_ban} là khách đặt trước - hãy gộp bàn ${dich.ban.number_ban} vào bàn ${nguon.ban.number_ban}.`);
    }

    const tongKhach = (Number(nguon.don.so_khach) || 0) + (Number(dich.don.so_khach) || 0);
    // Mon cua A mang trang thai don cua B (vd. B dang 5 thi mon A cung 5) de
    // bep va thu ngan thay chung mot don.
    await conn.query(
      'UPDATE hopdong SET sesis = ?, id_ban = ?, tinhtrang = ? WHERE sesis = ?',
      [dich.sesis, dich.ban.Id_ban, Number(dich.don.tinhtrang), nguon.sesis]);
    if (tongKhach > 0) await conn.query('UPDATE hopdong SET so_user = ? WHERE sesis = ?', [String(tongKhach), dich.sesis]);
    await conn.query('UPDATE ban SET trangthai = 3, sesis_hien_tai = NULL WHERE Id_ban = ?', [nguon.ban.Id_ban]);
    await conn.query('UPDATE ban SET trangthai = 1, sesis_hien_tai = ? WHERE Id_ban = ?', [dich.sesis, dich.ban.Id_ban]);
    await conn.query('UPDATE qr_tables SET active_sesis = NULL WHERE active_sesis = ?', [nguon.sesis]);
    await huyPhienThanhToanCho(conn, [nguon.sesis, dich.sesis], 'hủy vì gộp bàn');
    await ghiNhatKy(conn, 'gop', nguon, dich, nhanVien, lyDo);

    return { sesis: dich.sesis, sesis_cu: nguon.sesis, ban_nguon: nguon.ban.Id_ban, ban_dich: dich.ban.Id_ban, so_khach: tongKhach };
  });
}

module.exports = { chuyenBan, gopBan, LoiChuyenBan, damBaoBang };
