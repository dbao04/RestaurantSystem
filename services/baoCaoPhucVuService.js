const db = require('../config/db');

/**
 * Service Quản lý Báo cáo Cuối Ngày / Chốt Ca của Nhân viên Phục vụ
 */

// Tự động khởi tạo bảng nếu chưa có
async function khoiTaoBang() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS bao_cao_phuc_vu (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_nv INT NOT NULL,
      ngay DATE NOT NULL,
      ca VARCHAR(50) NOT NULL DEFAULT 'Ca tối',
      gio_bat_dau DATETIME NULL,
      gio_ket_thuc DATETIME NULL,
      so_ban_phuc_vu INT DEFAULT 0,
      so_mon_da_goi INT DEFAULT 0,
      so_khach_phuc_vu INT DEFAULT 0,
      tong_doanh_thu DECIMAL(15,2) DEFAULT 0,
      danh_gia_ca VARCHAR(50) DEFAULT 'Tot',
      su_co_phat_sinh TEXT NULL,
      phan_hoi_khach TEXT NULL,
      ban_giao_ca_sau TEXT NULL,
      de_xuat_quan_ly TEXT NULL,
      trang_thai VARCHAR(30) DEFAULT 'CHO_DUYET',
      nguoi_duyet INT NULL,
      ngay_duyet DATETIME NULL,
      ghi_chu_duyet TEXT NULL,
      tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      cap_nhat_luc DATETIME ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_nv_ngay (id_nv, ngay),
      KEY idx_trang_thai (trang_thai)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

khoiTaoBang().catch(err => console.error('Loi khoi tao bang bao_cao_phuc_vu:', err));

/**
 * Lấy số liệu thống kê tự động trong ca/ngày của nhân viên phục vụ
 */
async function laySoLieuTuDong(idNv, ngayStr) {
  const ngay = ngayStr || new Date().toISOString().slice(0, 10);
  
  // 1. Thống kê từ bảng hopdong (các món được phục vụ bởi nhân viên này hoặc các bàn active)
  const [hdStats] = await db.query(`
    SELECT 
      COUNT(DISTINCT id_ban) AS so_ban,
      COUNT(id) AS so_mon,
      COALESCE(SUM(thanhtien), 0) AS tong_tien
    FROM hopdong
    WHERE DATE(dates) = ? AND (id_nv_phuc_vu = ? OR id_nv_phuc_vu IS NULL)
  `, [ngay, idNv]);

  // 2. Thống kê từ đơn đặt bàn (reservations)
  const [resStats] = await db.query(`
    SELECT 
      COUNT(id) AS so_don_dat,
      COALESCE(SUM(guest_count), 0) AS so_khach
    FROM reservations
    WHERE DATE(reservation_date) = ? AND status IN ('SEATED', 'COMPLETED', 'ARRIVED')
  `, [ngay]);

  // 3. Số khách ước tính từ hopdong nếu reservations không có
  const [khachHd] = await db.query(`
    SELECT COALESCE(SUM(so_user), 0) AS tong_khach
    FROM (
      SELECT id_ban, MAX(so_user) AS so_user 
      FROM hopdong 
      WHERE DATE(dates) = ? AND (id_nv_phuc_vu = ? OR id_nv_phuc_vu IS NULL)
      GROUP BY id_ban
    ) t
  `, [ngay, idNv]);

  const soBan = Number(hdStats[0]?.so_ban || 0);
  const soMon = Number(hdStats[0]?.so_mon || 0);
  const tongDoanhThu = Number(hdStats[0]?.tong_tien || 0);
  const soKhach = Math.max(Number(resStats[0]?.so_khach || 0), Number(khachHd[0]?.tong_khach || 0), soBan * 2);

  return {
    ngay,
    soBan,
    soMon,
    soKhach,
    tongDoanhThu
  };
}

/**
 * Tạo báo cáo cuối ngày của phục vụ
 */
async function taoBaoCao(idNv, data) {
  const {
    ngay,
    ca,
    gio_bat_dau,
    gio_ket_thuc,
    so_ban_phuc_vu,
    so_mon_da_goi,
    so_khach_phuc_vu,
    tong_doanh_thu,
    danh_gia_ca,
    su_co_phat_sinh,
    phan_hoi_khach,
    ban_giao_ca_sau,
    de_xuat_quan_ly
  } = data;

  const [res] = await db.query(`
    INSERT INTO bao_cao_phuc_vu (
      id_nv, ngay, ca, gio_bat_dau, gio_ket_thuc,
      so_ban_phuc_vu, so_mon_da_goi, so_khach_phuc_vu, tong_doanh_thu,
      danh_gia_ca, su_co_phat_sinh, phan_hoi_khach, ban_giao_ca_sau, de_xuat_quan_ly,
      trang_thai
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CHO_DUYET')
  `, [
    idNv,
    ngay || new Date().toISOString().slice(0, 10),
    ca || 'Ca tối',
    gio_bat_dau ? new Date(gio_bat_dau) : new Date(),
    gio_ket_thuc ? new Date(gio_ket_thuc) : new Date(),
    Number(so_ban_phuc_vu || 0),
    Number(so_mon_da_goi || 0),
    Number(so_khach_phuc_vu || 0),
    Number(tong_doanh_thu || 0),
    danh_gia_ca || 'Tot',
    su_co_phat_sinh || '',
    phan_hoi_khach || '',
    ban_giao_ca_sau || '',
    de_xuat_quan_ly || ''
  ]);

  return res.insertId;
}

/**
 * Lấy danh sách lịch sử báo cáo của nhân viên hoặc của toàn bộ nhà hàng (cho Quản lý)
 */
async function layDanhSachBaoCao({ idNv = null, tuNgay = null, denNgay = null, trangThai = null, limit = 50 } = {}) {
  let where = 'WHERE 1=1';
  const params = [];

  if (idNv) {
    where += ' AND b.id_nv = ?';
    params.push(idNv);
  }
  if (tuNgay) {
    where += ' AND b.ngay >= ?';
    params.push(tuNgay);
  }
  if (denNgay) {
    where += ' AND b.ngay <= ?';
    params.push(denNgay);
  }
  if (trangThai) {
    where += ' AND b.trang_thai = ?';
    params.push(trangThai);
  }

  const [rows] = await db.query(`
    SELECT 
      b.*,
      nv.ten AS ten_nv,
      nv.ma_nv,
      cd.ten_cd,
      ql.ten AS ten_quan_ly
    FROM bao_cao_phuc_vu b
    JOIN nhan_vien nv ON b.id_nv = nv.id_nv
    LEFT JOIN chuc_danh cd ON nv.id_cd = cd.id_cd
    LEFT JOIN nhan_vien ql ON b.nguoi_duyet = ql.id_nv
    ${where}
    ORDER BY b.ngay DESC, b.id DESC
    LIMIT ?
  `, [...params, Number(limit)]);

  return rows;
}

/**
 * Lấy chi tiết 1 báo cáo
 */
async function layChiTietBaoCao(id) {
  const [rows] = await db.query(`
    SELECT 
      b.*,
      nv.ten AS ten_nv,
      nv.ma_nv,
      nv.sodienthoai,
      cd.ten_cd,
      bp.ten_bp,
      ql.ten AS ten_quan_ly
    FROM bao_cao_phuc_vu b
    JOIN nhan_vien nv ON b.id_nv = nv.id_nv
    LEFT JOIN chuc_danh cd ON nv.id_cd = cd.id_cd
    LEFT JOIN bo_phan bp ON nv.id_bp = bp.id_bp
    LEFT JOIN nhan_vien ql ON b.nguoi_duyet = ql.id_nv
    WHERE b.id = ?
  `, [id]);

  return rows[0] || null;
}

/**
 * Quản lý duyệt / phản hồi báo cáo
 */
async function duyetBaoCao(id, idQuanLy, { trangThai = 'DA_DUYET', ghiChu = '' } = {}) {
  await db.query(`
    UPDATE bao_cao_phuc_vu
    SET 
      trang_thai = ?,
      nguoi_duyet = ?,
      ngay_duyet = NOW(),
      ghi_chu_duyet = ?
    WHERE id = ?
  `, [trangThai, idQuanLy, ghiChu, id]);
}

module.exports = {
  khoiTaoBang,
  laySoLieuTuDong,
  taoBaoCao,
  layDanhSachBaoCao,
  layChiTietBaoCao,
  duyetBaoCao
};
