/**
 * kdsService - Kitchen Display System va so do ban thoi gian thuc.
 *
 * Quy uoc trang thai bep (cot `hopdong.trangthai_bep`):
 *   0 = Moi order, cho bep nhan
 *   1 = Dang che bien
 *   2 = Hoan thanh, cho phuc vu mang ra
 *   3 = Da phuc vu
 *
 * He thong cu chi dung 0/1. Khi chuyen sang 4 trang thai, viec TRU KHO tu dong
 * duoc dat o buoc chuyen sang 2 (hoan thanh che bien) - dung thoi diem nguyen
 * lieu thuc su bi tieu hao.
 *
 * Quy uoc trang thai ban (cot `ban.trangthai`):
 *   0 = Trong, 1 = Dang phuc vu, 2 = Da dat truoc, 3 = Dang don
 */
const db = require('../config/db');

const TEN_TRANG_THAI_BEP = {
  0: 'Chờ chế biến',
  1: 'Đang chế biến',
  2: 'Hoàn thành',
  3: 'Đã phục vụ',
};

const TEN_TRANG_THAI_BAN = {
  0: 'Trống',
  1: 'Đang phục vụ',
  2: 'Đã đặt trước',
  3: 'Đang dọn',
};

/**
 * Màn hình bếp hiển thị các đơn đang hoạt động (ăn tại chỗ hoặc giao hàng / mang về).
 * - tinhtrang IN (0, 1, 5, 6): 0 = Đơn mới tạo (online/giao hàng), 1 = Đã xác nhận/đang phục vụ, 5 = Đang chế biến, 6 = Đã lên món
 * - Ngày đặt khớp ngày hiện tại (hoặc đơn giao hàng đang chờ chế biến chưa xong).
 */
const DON_DANG_HOAT_DONG = '(h.tinhtrang IN (0, 1, 5, 6) OR h.loai_don = "giao_hang") AND (h.ngay_dat = CURDATE() OR (h.loai_don = "giao_hang" AND h.trangthai_bep < 3))';


const kdsService = {
  TEN_TRANG_THAI_BEP,
  TEN_TRANG_THAI_BAN,

  /**
   * Danh sach mon dang cho bep xu ly, gom theo trang thai.
   * `cho_phut` dung de to mau canh bao mon bi cho qua lau.
   */
  layDonBep: async () => {
    const [rows] = await db.query(
      `SELECT h.id, h.sesis, h.id_mon, h.name_mon, h.soluong, h.trangthai_bep,
              h.tg, h.ngay_dat, h.gio_dat, h.bep_bat_dau, h.bep_ket_thuc,
              h.noidung, h.ghi_chu_mon, h.so_user, h.id_ban, h.loai_don,
              b.number_ban, dg.ma_giao, dg.trang_thai AS trang_thai_giao,
              COALESCE(k.ten, 'Khách lẻ') AS ten_khach,
              TIMESTAMPDIFF(MINUTE,
                COALESCE(h.bep_bat_dau, CONCAT(h.ngay_dat, ' ', COALESCE(h.gio_dat, '00:00:00'))),
                NOW()) AS cho_phut
       FROM hopdong h
       LEFT JOIN khach_hang k    ON k.id = h.id_user
       LEFT JOIN ban b           ON b.Id_ban = h.id_ban
       LEFT JOIN don_giao_hang dg ON dg.sesis = h.sesis
       WHERE h.id_mon > 0
         AND h.trangthai_bep < 3
         AND (
           (h.loai_don = 'giao_hang' AND (dg.trang_thai IS NULL OR dg.trang_thai NOT IN ('da_giao', 'huy')) AND h.tinhtrang NOT IN (2, 3, 4))
           OR
           (h.loai_don <> 'giao_hang' AND h.tinhtrang IN (0, 1, 5, 6) AND h.ngay_dat = CURDATE())
         )
       ORDER BY h.trangthai_bep ASC, h.id ASC`
    );

    const nhom = { cho: [], dang_lam: [], xong: [] };
    for (const r of rows) {
      const muc = { ...r, ten_trang_thai: TEN_TRANG_THAI_BEP[r.trangthai_bep] };
      if (r.trangthai_bep === 0) nhom.cho.push(muc);
      else if (r.trangthai_bep === 1) nhom.dang_lam.push(muc);
      else nhom.xong.push(muc);
    }
    return nhom;
  },

  /** Mon da phuc vu trong ca hom nay - cot cuoi cua KDS. */
  layDaPhucVu: async (gioiHan = 30) => {
    const [rows] = await db.query(
      `SELECT h.id, h.sesis, h.name_mon, h.soluong, h.bep_ket_thuc, b.number_ban
       FROM hopdong h
       LEFT JOIN ban b ON b.Id_ban = h.id_ban
       WHERE h.id_mon > 0 AND h.trangthai_bep = 3 AND h.ngay_dat = CURDATE()
       ORDER BY h.bep_ket_thuc DESC LIMIT ?`,
      [gioiHan]
    );
    return rows;
  },

  /** Bep nhan mon: 0 -> 1, ghi lai moc bat dau de tinh thoi gian che bien. */
  batDauCheBien: async (id) => {
    const [r] = await db.query(
      `UPDATE hopdong SET trangthai_bep = 1, bep_bat_dau = NOW()
       WHERE id = ? AND trangthai_bep = 0`,
      [id]
    );
    if (!r.affectedRows) throw new Error('Món không ở trạng thái chờ chế biến.');
    return kdsService.layMotMon(id);
  },

  /**
   * Hoan thanh che bien: 1 -> 2. Day la thoi diem TRU KHO tu dong theo cong
   * thuc, va ghi nhat ky xuat kho de phuc vu bai toan du bao nguyen lieu.
   */
  hoanThanhCheBien: async (id) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [r] = await conn.query(
        `UPDATE hopdong SET trangthai_bep = 2, bep_ket_thuc = NOW()
         WHERE id = ? AND trangthai_bep IN (0, 1)`,
        [id]
      );
      if (!r.affectedRows) throw new Error('Món không ở trạng thái đang chế biến.');

      const [don] = await conn.query(
        'SELECT id_mon, soluong, sesis FROM hopdong WHERE id = ?',
        [id]
      );
      if (don.length && don[0].id_mon > 0) {
        const { id_mon, soluong, sesis } = don[0];
        const [ct] = await conn.query(
          'SELECT id_nl, so_luong_tieu_hao FROM cong_thuc WHERE id_mon = ?',
          [id_mon]
        );
        for (const nl of ct) {
          const tieuHao = nl.so_luong_tieu_hao * soluong;
          await conn.query(
            'UPDATE nguyen_lieu SET so_luong = GREATEST(so_luong - ?, 0) WHERE id_nl = ?',
            [tieuHao, nl.id_nl]
          );
          // Ghi nhat ky de mo hinh du bao co du lieu tieu hao thuc te.
          await conn.query(
            `INSERT INTO xuat_kho (id_nl, so_luong, ly_do, sesis, id_mon, ngay_xuat)
             VALUES (?, ?, 'ban_hang', ?, ?, CURDATE())`,
            [nl.id_nl, tieuHao, sesis, id_mon]
          );
        }
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    return kdsService.layMotMon(id);
  },

  /** Phuc vu mang mon ra ban: 2 -> 3. */
  danhDauDaPhucVu: async (id) => {
    const [r] = await db.query(
      'UPDATE hopdong SET trangthai_bep = 3 WHERE id = ? AND trangthai_bep = 2',
      [id]
    );
    if (!r.affectedRows) throw new Error('Món chưa hoàn thành chế biến.');
    return kdsService.layMotMon(id);
  },

  layMotMon: async (id) => {
    const [rows] = await db.query(
      `SELECT h.id, h.sesis, h.name_mon, h.soluong, h.trangthai_bep, h.id_ban,
              b.number_ban
       FROM hopdong h LEFT JOIN ban b ON b.Id_ban = h.id_ban
       WHERE h.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  /** Chi so nhanh hien o dau man hinh bep. */
  thongKeBep: async () => {
    const [rows] = await db.query(
      `SELECT
         SUM(CASE WHEN h.trangthai_bep = 0 THEN 1 ELSE 0 END) AS cho,
         SUM(CASE WHEN h.trangthai_bep = 1 THEN 1 ELSE 0 END) AS dang_lam,
         SUM(CASE WHEN h.trangthai_bep = 2 THEN 1 ELSE 0 END) AS xong
       FROM hopdong h
       LEFT JOIN don_giao_hang dg ON dg.sesis = h.sesis
       WHERE h.id_mon > 0
         AND h.trangthai_bep < 3
         AND (
           (h.loai_don = 'giao_hang' AND (dg.trang_thai IS NULL OR dg.trang_thai NOT IN ('da_giao', 'huy')) AND h.tinhtrang NOT IN (2, 3, 4))
           OR
           (h.loai_don <> 'giao_hang' AND h.tinhtrang IN (0, 1, 5, 6) AND h.ngay_dat = CURDATE())
         )`
    );
    const [homNay] = await db.query(
      `SELECT COUNT(*) AS da_phuc_vu,
              ROUND(AVG(TIMESTAMPDIFF(SECOND, bep_bat_dau, bep_ket_thuc)) / 60, 1) AS phut_tb
       FROM hopdong
       WHERE trangthai_bep = 3 AND ngay_dat = CURDATE() AND bep_ket_thuc IS NOT NULL`
    );
    return {
      cho: Number(rows[0].cho) || 0,
      dang_lam: Number(rows[0].dang_lam) || 0,
      xong: Number(rows[0].xong) || 0,
      da_phuc_vu_hom_nay: Number(homNay[0].da_phuc_vu) || 0,
      phut_tb_hom_nay: Number(homNay[0].phut_tb) || 0,
    };
  },

  // ------------------------------------------------------------------
  // So do ban
  // ------------------------------------------------------------------

  /** Danh sach ban kem vi tri, trang thai va thong tin phien dang phuc vu theo ngay. */
  laySoDoBan: async (ngay = null) => {
    const ngayLoc = ngay ? String(ngay).trim() : null;
    const isHomNay = !ngayLoc || ngayLoc === new Date().toISOString().slice(0, 10);

    const [rows] = await db.query(
      `SELECT b.Id_ban, b.number_ban, b.trangthai, b.so_cho,
              b.toa_do_x, b.toa_do_y, b.sesis_hien_tai, b.ghichu,
              v.id_vitri, v.name_vitri, v.thu_tu,
              p.so_mon, p.tong_tien, p.so_khach, p.bat_dau,
              r.guest_name, r.guest_count AS r_guest_count, r.reservation_time, r.reservation_code
       FROM ban b
       LEFT JOIN vitri v ON v.id_vitri = b.id_vitri
       LEFT JOIN (
         SELECT sesis,
                id_ban,
                COUNT(*)                 AS so_mon,
                SUM(thanhtien)           AS tong_tien,
                MAX(so_user)             AS so_khach,
                MIN(CONCAT(ngay_dat, ' ', COALESCE(gio_dat, '00:00:00'))) AS bat_dau
         FROM hopdong 
         WHERE id_mon > 0 AND tinhtrang IN (1, 5, 6) ${ngayLoc ? 'AND ngay_dat = ?' : ''}
         GROUP BY sesis, id_ban
       ) p ON (p.sesis = b.sesis_hien_tai OR (p.id_ban = b.Id_ban AND NOT ?))
       LEFT JOIN (
         SELECT rt.table_id, res.customer_name AS guest_name, res.guest_count, res.start_time AS reservation_time, res.reservation_code
         FROM reservation_tables rt
         JOIN reservations res ON res.id = rt.reservation_id
         WHERE res.status IN ('CONFIRMED', 'PENDING', 'SEATED')
           AND res.reservation_date = ?
       ) r ON r.table_id = b.Id_ban
       ORDER BY v.thu_tu, v.id_vitri, b.number_ban`,
      ngayLoc ? [ngayLoc, isHomNay, ngayLoc] : [isHomNay, new Date().toISOString().slice(0, 10)]
    );

    return rows.map((r) => {
      let tt = r.trangthai;
      let tenTT = TEN_TRANG_THAI_BAN[tt] || 'Không rõ';

      // Nếu xem ngày khác, trạng thái hiển thị theo đặt trước của ngày đó
      if (!isHomNay) {
        if (r.guest_name) {
          tt = 2; // Đã đặt trước
          tenTT = 'Đã đặt trước';
        } else if (r.so_mon && Number(r.so_mon) > 0) {
          tt = 1; // Đang phục vụ / có đơn
          tenTT = 'Đang phục vụ';
        } else {
          tt = 0; // Trống
          tenTT = 'Trống';
        }
      } else if (r.guest_name && tt === 0) {
        tt = 2;
        tenTT = 'Đã đặt trước';
      }

      return {
        ...r,
        trangthai: tt,
        sesis_hien_tai: (r.so_mon && Number(r.so_mon) > 0) ? r.sesis_hien_tai : null,
        ten_trang_thai: tenTT,
        dat_truoc: r.guest_name ? {
          ten_khach: r.guest_name,
          so_khach: r.r_guest_count,
          gio: r.reservation_time,
          ma: r.reservation_code
        } : null
      };
    });
  },

  /** Khu vuc / tang - dung lam tab tren so do. */
  layViTri: async () => {
    const [rows] = await db.query(
      `SELECT v.id_vitri, v.name_vitri, v.thu_tu,
              COUNT(b.Id_ban)          AS so_ban,
              COALESCE(SUM(b.so_cho), 0) AS so_cho
         FROM vitri v
         LEFT JOIN ban b ON b.id_vitri = v.id_vitri
        GROUP BY v.id_vitri, v.name_vitri, v.thu_tu
        ORDER BY v.thu_tu, v.id_vitri`
    );
    return rows;
  },

  doiTrangThaiBan: async (idBan, trangThai, sesis = null) => {
    if (![0, 1, 2, 3].includes(Number(trangThai))) {
      throw new Error('Trạng thái bàn không hợp lệ.');
    }
    const sesisMoi = Number(trangThai) === 0 ? null : sesis;
    await db.query(
      'UPDATE ban SET trangthai = ?, sesis_hien_tai = ? WHERE Id_ban = ?',
      [trangThai, sesisMoi, idBan]
    );
    const [rows] = await db.query(
      'SELECT Id_ban, number_ban, trangthai, sesis_hien_tai FROM ban WHERE Id_ban = ?',
      [idBan]
    );
    return rows[0];
  },

  /** Luu vi tri sau khi keo tha ban tren so do. */
  luuViTriBan: async (danhSach) => {
    for (const b of danhSach) {
      await db.query('UPDATE ban SET toa_do_x = ?, toa_do_y = ? WHERE Id_ban = ?', [
        Math.round(Number(b.x) || 0),
        Math.round(Number(b.y) || 0),
        b.id,
      ]);
    }
    return danhSach.length;
  },

  thongKeBan: async (ngay = null) => {
    const ngayLoc = ngay ? String(ngay).trim() : null;
    const isHomNay = !ngayLoc || ngayLoc === new Date().toISOString().slice(0, 10);

    const [rows] = await db.query(
      `SELECT trangthai, COUNT(*) AS n, COALESCE(SUM(so_cho), 0) AS cho
         FROM ban GROUP BY trangthai`
    );
    const kq = { trong: 0, dang_phuc_vu: 0, da_dat: 0, dang_don: 0, tong: 0, so_cho: 0 };
    const map = { 0: 'trong', 1: 'dang_phuc_vu', 2: 'da_dat', 3: 'dang_don' };
    for (const r of rows) {
      const k = map[r.trangthai];
      if (k) kq[k] = Number(r.n);
      kq.tong += Number(r.n);
      kq.so_cho += Number(r.cho);
    }

    if (!isHomNay) {
      // Đếm số bàn đã đặt của ngày được chọn
      const [resvCount] = await db.query(
        `SELECT COUNT(DISTINCT rt.table_id) as da_dat
         FROM reservation_tables rt
         JOIN reservations res ON res.id = rt.reservation_id
         WHERE res.status IN ('CONFIRMED', 'PENDING', 'SEATED')
           AND res.reservation_date = ?`,
        [ngayLoc]
      );
      kq.da_dat = Number(resvCount[0].da_dat) || 0;
      kq.dang_phuc_vu = 0;
      kq.dang_don = 0;
      kq.trong = Math.max(0, kq.tong - kq.da_dat);
    }

    kq.ty_le_lap_day = kq.tong
      ? Math.round(((kq.dang_phuc_vu + kq.da_dat) / kq.tong) * 100)
      : 0;

    const [dt] = await db.query(
      `SELECT COALESCE(SUM(h.thanhtien), 0) AS dang_mo
       FROM ban b JOIN hopdong h ON h.sesis = b.sesis_hien_tai
       WHERE b.trangthai = 1 AND h.id_mon > 0 ${ngayLoc ? 'AND h.ngay_dat = ?' : ''}`,
      ngayLoc ? [ngayLoc] : []
    );
    const [hn] = await db.query(
      `SELECT COALESCE(SUM(thanhtien), 0) AS doanh_thu_ngay
       FROM hopdong WHERE tinhtrang = 3 AND id_mon > 0 AND ngay_dat = ?`,
      [ngayLoc || new Date().toISOString().slice(0, 10)]
    );
    kq.doanh_thu_dang_mo = isHomNay ? (Number(dt[0].dang_mo) || 0) : 0;
    kq.doanh_thu_hom_nay = Number(hn[0].doanh_thu_ngay) || 0;
    return kq;
  },
};

module.exports = kdsService;
