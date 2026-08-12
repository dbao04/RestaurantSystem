/**
 * analyticsService - Tang 2: phan tich du lieu ho tro ra quyet dinh.
 *
 * Tat ca truy van deu chi tinh tren `tinhtrang = 3` (da thanh toan) va
 * `id_mon > 0` (bo qua dong header cua phien dat ban), tru cac chi so co tinh
 * ve huy don thi tinh rieng.
 *
 * Gia von mon an duoc suy ra tu cong_thuc x nguyen_lieu.gia_von -> tu do tinh
 * duoc loi nhuan gop, thu ma he thong quan ly thong thuong khong co.
 */
const db = require('../config/db');

/** Dieu kien loc chuan cho cac truy van doanh thu. */
const DON_HOAN_TAT = 'h.tinhtrang = 3 AND h.id_mon > 0';

/** Dinh dang YYYY-MM-DD theo gio dia phuong (toISOString se lui 1 ngay o mui gio +7). */
function dinhDangNgay(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Chuan hoa khoang ngay; mac dinh 30 ngay gan nhat tinh tu ngay co du lieu. */
async function khoangNgay(tu, den) {
  if (tu && den) return { tu, den };
  const [r] = await db.query('SELECT MAX(ngay_dat) AS max_ngay FROM hopdong');
  const maxNgay = r[0].max_ngay ? new Date(r[0].max_ngay) : new Date();
  const denD = dinhDangNgay(maxNgay);
  const tuTruoc = new Date(maxNgay);
  tuTruoc.setDate(tuTruoc.getDate() - 29);
  const tuD = dinhDangNgay(tuTruoc);
  return { tu: tu || tuD, den: den || denD };
}

const analyticsService = {
  khoangNgay,

  /** Cac chi so tong quan hien thi o hang the dau trang. */
  tongQuan: async (tu, den) => {
    const k = await khoangNgay(tu, den);
    const [rows] = await db.query(
      `SELECT
         COUNT(DISTINCT h.sesis)                       AS so_don,
         COALESCE(SUM(h.thanhtien), 0)                 AS doanh_thu,
         COALESCE(SUM(h.soluong), 0)                   AS so_mon_ban,
         COALESCE(AVG(t.gia_tri_don), 0)               AS gia_tri_don_tb
       FROM hopdong h
       JOIN (
         SELECT sesis, SUM(thanhtien) AS gia_tri_don
         FROM hopdong WHERE tinhtrang = 3 AND id_mon > 0 AND ngay_dat BETWEEN ? AND ?
         GROUP BY sesis
       ) t ON t.sesis = h.sesis
       WHERE ${DON_HOAN_TAT} AND h.ngay_dat BETWEEN ? AND ?`,
      [k.tu, k.den, k.tu, k.den]
    );

    // Ty le huy tinh tren tong so phien (ke ca phien bi huy).
    const [huy] = await db.query(
      `SELECT
         COUNT(DISTINCT CASE WHEN tinhtrang = 2 THEN sesis END) AS don_huy,
         COUNT(DISTINCT sesis)                                  AS tong_don
       FROM hopdong WHERE id_mon > 0 AND ngay_dat BETWEEN ? AND ?`,
      [k.tu, k.den]
    );

    const [chiPhi] = await db.query(
      `SELECT COALESCE(SUM(h.soluong * ct.chi_phi), 0) AS chi_phi_nl
       FROM hopdong h
       JOIN (
         SELECT c.id_mon, SUM(c.so_luong_tieu_hao * n.gia_von) AS chi_phi
         FROM cong_thuc c JOIN nguyen_lieu n ON n.id_nl = c.id_nl
         GROUP BY c.id_mon
       ) ct ON ct.id_mon = h.id_mon
       WHERE ${DON_HOAN_TAT} AND h.ngay_dat BETWEEN ? AND ?`,
      [k.tu, k.den]
    );

    const doanhThu = Number(rows[0].doanh_thu) || 0;
    const chiPhiNL = Number(chiPhi[0].chi_phi_nl) || 0;
    const tongDon = Number(huy[0].tong_don) || 0;

    return {
      khoang: k,
      so_don: Number(rows[0].so_don) || 0,
      doanh_thu: doanhThu,
      so_mon_ban: Number(rows[0].so_mon_ban) || 0,
      gia_tri_don_tb: Number(rows[0].gia_tri_don_tb) || 0,
      chi_phi_nguyen_lieu: chiPhiNL,
      loi_nhuan_gop: doanhThu - chiPhiNL,
      bien_loi_nhuan: doanhThu > 0 ? ((doanhThu - chiPhiNL) / doanhThu) * 100 : 0,
      don_huy: Number(huy[0].don_huy) || 0,
      ty_le_huy: tongDon > 0 ? (Number(huy[0].don_huy) / tongDon) * 100 : 0,
    };
  },

  /** Doanh thu theo ngay - duong xu huong chinh cua dashboard. */
  doanhThuTheoNgay: async (tu, den) => {
    const k = await khoangNgay(tu, den);
    const [rows] = await db.query(
      `SELECT DATE_FORMAT(h.ngay_dat, '%Y-%m-%d') AS ngay,
              SUM(h.thanhtien)                    AS doanh_thu,
              COUNT(DISTINCT h.sesis)             AS so_don
       FROM hopdong h
       WHERE ${DON_HOAN_TAT} AND h.ngay_dat BETWEEN ? AND ?
       GROUP BY h.ngay_dat ORDER BY h.ngay_dat`,
      [k.tu, k.den]
    );
    return rows;
  },

  /**
   * Luot khach thuc te theo ngay.
   *
   * Phai dung DUNG cong thuc ma ML service dung lam muc tieu huan luyen
   * (tong so_user cua tung phien), neu khong duong "thuc te" va duong "du bao"
   * tren bieu do se la hai dai luong khac nhau va so sanh vo nghia.
   */
  luotKhachTheoNgay: async (tu, den) => {
    const k = await khoangNgay(tu, den);
    const [rows] = await db.query(
      `SELECT DATE_FORMAT(t.ngay, '%Y-%m-%d') AS ngay,
              SUM(t.so_khach) AS so_khach,
              COUNT(*)        AS so_don
       FROM (
         SELECT ngay_dat AS ngay, sesis,
                MAX(CAST(NULLIF(TRIM(so_user), '') AS UNSIGNED)) AS so_khach
         FROM hopdong
         WHERE tinhtrang = 3 AND id_mon > 0 AND ngay_dat BETWEEN ? AND ?
         GROUP BY ngay_dat, sesis
       ) t
       GROUP BY t.ngay ORDER BY t.ngay`,
      [k.tu, k.den]
    );
    return rows;
  },

  /** Doanh thu theo khung gio - chi ra gio cao diem de xep ca. */
  doanhThuTheoGio: async (tu, den) => {
    const k = await khoangNgay(tu, den);
    const [rows] = await db.query(
      `SELECT HOUR(h.gio_dat)        AS gio,
              SUM(h.thanhtien)       AS doanh_thu,
              COUNT(DISTINCT h.sesis) AS so_don
       FROM hopdong h
       WHERE ${DON_HOAN_TAT} AND h.gio_dat IS NOT NULL AND h.ngay_dat BETWEEN ? AND ?
       GROUP BY HOUR(h.gio_dat) ORDER BY gio`,
      [k.tu, k.den]
    );
    return rows;
  },

  /** Doanh thu 12 thang gan nhat. */
  doanhThuTheoThang: async () => {
    const [rows] = await db.query(
      `SELECT DATE_FORMAT(h.ngay_dat, '%Y-%m') AS thang,
              SUM(h.thanhtien)                 AS doanh_thu,
              COUNT(DISTINCT h.sesis)          AS so_don
       FROM hopdong h
       WHERE ${DON_HOAN_TAT} AND h.ngay_dat IS NOT NULL
       GROUP BY DATE_FORMAT(h.ngay_dat, '%Y-%m')
       ORDER BY thang DESC LIMIT 12`
    );
    return rows.reverse();
  },

  /** Doanh thu theo thu trong tuan - co so cho ket luan "cuoi tuan gap doi". */
  doanhThuTheoThu: async (tu, den) => {
    const k = await khoangNgay(tu, den);
    const [rows] = await db.query(
      `SELECT DAYOFWEEK(h.ngay_dat)  AS thu_so,
              COUNT(DISTINCT h.sesis) AS so_don,
              SUM(h.thanhtien)        AS doanh_thu
       FROM hopdong h
       WHERE ${DON_HOAN_TAT} AND h.ngay_dat BETWEEN ? AND ?
       GROUP BY DAYOFWEEK(h.ngay_dat) ORDER BY thu_so`,
      [k.tu, k.den]
    );
    const ten = ['', 'Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return rows.map((r) => ({ ...r, ten_thu: ten[r.thu_so] }));
  },

  /** Top mon ban chay kem loi nhuan gop tung mon. */
  topMon: async (tu, den, gioiHan = 20) => {
    const k = await khoangNgay(tu, den);
    const [rows] = await db.query(
      `SELECT h.id_mon, h.name_mon,
              SUM(h.soluong)                              AS so_luong,
              SUM(h.thanhtien)                            AS doanh_thu,
              COALESCE(SUM(h.soluong * ct.chi_phi), 0)    AS chi_phi,
              SUM(h.thanhtien) - COALESCE(SUM(h.soluong * ct.chi_phi), 0) AS loi_nhuan
       FROM hopdong h
       LEFT JOIN (
         SELECT c.id_mon, SUM(c.so_luong_tieu_hao * n.gia_von) AS chi_phi
         FROM cong_thuc c JOIN nguyen_lieu n ON n.id_nl = c.id_nl
         GROUP BY c.id_mon
       ) ct ON ct.id_mon = h.id_mon
       WHERE ${DON_HOAN_TAT} AND h.ngay_dat BETWEEN ? AND ?
       GROUP BY h.id_mon, h.name_mon
       ORDER BY so_luong DESC LIMIT ?`,
      [k.tu, k.den, gioiHan]
    );
    return rows;
  },

  /**
   * Phan tich Pareto: bao nhieu % so mon tao ra 80% doanh thu.
   * Day la ket luan quan tri manh de dua vao bao cao.
   */
  pareto: async (tu, den) => {
    const k = await khoangNgay(tu, den);
    const [rows] = await db.query(
      `SELECT h.id_mon, h.name_mon, SUM(h.thanhtien) AS doanh_thu
       FROM hopdong h
       WHERE ${DON_HOAN_TAT} AND h.ngay_dat BETWEEN ? AND ?
       GROUP BY h.id_mon, h.name_mon ORDER BY doanh_thu DESC`,
      [k.tu, k.den]
    );
    const tong = rows.reduce((s, r) => s + Number(r.doanh_thu), 0);
    let luyKe = 0;
    let soMonDat80 = 0;
    const duLieu = rows.map((r, i) => {
      luyKe += Number(r.doanh_thu);
      const pct = tong > 0 ? (luyKe / tong) * 100 : 0;
      if (soMonDat80 === 0 && pct >= 80) soMonDat80 = i + 1;
      return {
        name_mon: r.name_mon,
        doanh_thu: Number(r.doanh_thu),
        luy_ke_pct: pct,
      };
    });
    return {
      duLieu,
      tong_so_mon: rows.length,
      so_mon_dat_80: soMonDat80,
      ty_le_mon_dat_80: rows.length > 0 ? (soMonDat80 / rows.length) * 100 : 0,
    };
  },

  /** Hieu suat phuc vu: so ban / so don / doanh thu theo nhan vien. */
  hieuSuatNhanVien: async (tu, den) => {
    const k = await khoangNgay(tu, den);
    const [rows] = await db.query(
      `SELECT nv.id_nv, nv.ten, nv.chucvu,
              COUNT(DISTINCT h.sesis)  AS so_don,
              COUNT(DISTINCT h.id_ban) AS so_ban,
              SUM(h.thanhtien)         AS doanh_thu
       FROM hopdong h
       JOIN nhan_vien nv ON nv.id_nv = h.id_nv_phuc_vu
       WHERE ${DON_HOAN_TAT} AND h.ngay_dat BETWEEN ? AND ?
       GROUP BY nv.id_nv, nv.ten, nv.chucvu
       ORDER BY so_don DESC`,
      [k.tu, k.den]
    );
    return rows;
  },

  /** Hieu suat bep: thoi gian che bien trung binh, mon nhanh nhat / cham nhat. */
  hieuSuatBep: async (tu, den) => {
    const k = await khoangNgay(tu, den);
    const [rows] = await db.query(
      `SELECT h.name_mon,
              COUNT(*)                                                    AS so_lan,
              ROUND(AVG(TIMESTAMPDIFF(SECOND, h.bep_bat_dau, h.bep_ket_thuc)) / 60, 1) AS phut_tb,
              ROUND(MAX(TIMESTAMPDIFF(SECOND, h.bep_bat_dau, h.bep_ket_thuc)) / 60, 1) AS phut_max
       FROM hopdong h
       WHERE h.bep_ket_thuc IS NOT NULL AND h.ngay_dat BETWEEN ? AND ?
       GROUP BY h.id_mon, h.name_mon
       HAVING so_lan >= 5
       ORDER BY phut_tb DESC`,
      [k.tu, k.den]
    );
    const [tong] = await db.query(
      `SELECT ROUND(AVG(TIMESTAMPDIFF(SECOND, bep_bat_dau, bep_ket_thuc)) / 60, 1) AS phut_tb
       FROM hopdong WHERE bep_ket_thuc IS NOT NULL AND ngay_dat BETWEEN ? AND ?`,
      [k.tu, k.den]
    );
    return {
      chi_tiet: rows,
      phut_tb_toan_bep: Number(tong[0].phut_tb) || 0,
      cham_nhat: rows.slice(0, 5),
      nhanh_nhat: rows.slice(-5).reverse(),
    };
  },

  /**
   * Tinh trang ton kho + so ngay dung con lai.
   * "Con du may ngay" = ton hien tai / tieu hao trung binh 30 ngay gan nhat.
   */
  tonKho: async () => {
    const [rows] = await db.query(
      `SELECT nl.id_nl, nl.ten_nl, nl.so_luong AS ton, nl.dinh_muc_min,
              dv.ten_dvt, nl.gia_von,
              COALESCE(tb.tieu_hao_ngay, 0) AS tieu_hao_ngay
       FROM nguyen_lieu nl
       LEFT JOIN don_vi_tinh dv ON dv.id_dvt = nl.id_dvt
       LEFT JOIN (
         SELECT id_nl, SUM(so_luong) / 30 AS tieu_hao_ngay
         FROM xuat_kho
         WHERE ngay_xuat >= (SELECT DATE_SUB(MAX(ngay_xuat), INTERVAL 30 DAY) FROM xuat_kho)
         GROUP BY id_nl
       ) tb ON tb.id_nl = nl.id_nl
       ORDER BY nl.ten_nl`
    );
    return rows.map((r) => {
      const th = Number(r.tieu_hao_ngay) || 0;
      const ton = Number(r.ton) || 0;
      const soNgayCon = th > 0 ? ton / th : null;
      let muc = 'du';
      if (ton <= Number(r.dinh_muc_min)) muc = 'sap_het';
      else if (soNgayCon !== null && soNgayCon < 2) muc = 'canh_bao';
      else if (soNgayCon !== null && soNgayCon < 4) muc = 'theo_doi';
      return { ...r, ton, tieu_hao_ngay: th, so_ngay_con: soNgayCon, muc };
    });
  },

  /** Lo hang sap het han - phuc vu chi so "lang phi" trong bao cao. */
  loSapHetHan: async (soNgay = 14) => {
    const [rows] = await db.query(
      // Chi canh bao lo VAN CON HANG - lo da dung het thi han su dung khong
      // con y nghia quan tri.
      `SELECT ct.id_ct, nl.ten_nl, ct.so_lo, ct.han_su_dung,
              ct.so_luong_con_lai AS so_luong,
              DATEDIFF(ct.han_su_dung, CURDATE()) AS con_lai
       FROM chi_tiet_phieu_nhap ct
       JOIN nguyen_lieu nl ON nl.id_nl = ct.id_nl
       WHERE ct.han_su_dung IS NOT NULL
         AND ct.so_luong_con_lai > 0
         AND ct.han_su_dung <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY ct.han_su_dung LIMIT 50`,
      [soNgay]
    );
    return rows;
  },

  /** Co cau doanh thu theo loai don (tai cho / mang ve / giao hang). */
  theoLoaiDon: async (tu, den) => {
    const k = await khoangNgay(tu, den);
    const [rows] = await db.query(
      `SELECT h.loai_don, COUNT(DISTINCT h.sesis) AS so_don, SUM(h.thanhtien) AS doanh_thu
       FROM hopdong h
       WHERE ${DON_HOAN_TAT} AND h.ngay_dat BETWEEN ? AND ?
       GROUP BY h.loai_don ORDER BY doanh_thu DESC`,
      [k.tu, k.den]
    );
    const nhan = { tai_cho: 'Ăn tại chỗ', mang_ve: 'Mang về', giao_hang: 'Giao hàng' };
    return rows.map((r) => ({ ...r, ten_loai: nhan[r.loai_don] || r.loai_don }));
  },

  /** Doanh thu theo danh muc mon. */
  theoDanhMuc: async (tu, den) => {
    const k = await khoangNgay(tu, den);
    const [rows] = await db.query(
      `SELECT lm.name_loai, SUM(h.thanhtien) AS doanh_thu, SUM(h.soluong) AS so_luong
       FROM hopdong h
       JOIN monan m  ON m.id_mon = h.id_mon
       JOIN loai_mon lm ON lm.id_loai = m.id_loai
       WHERE ${DON_HOAN_TAT} AND h.ngay_dat BETWEEN ? AND ?
       GROUP BY lm.id_loai, lm.name_loai ORDER BY doanh_thu DESC`,
      [k.tu, k.den]
    );
    return rows;
  },
};

module.exports = analyticsService;
