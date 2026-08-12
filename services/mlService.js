/**
 * Cau noi giua ung dung Node va ML service (Python/FastAPI).
 *
 * Nguyen tac quan trong: ML service KHONG duoc phep lam sap web. Neu no chua
 * bat, timeout hay loi, moi ham o day tra ve du lieu du phong lay tu CSDL
 * (ket qua du bao da luu lan truoc, hoac mon ban chay) thay vi nem loi.
 * Nho vay demo van chay duoc ke ca khi quen bat service Python.
 */
const db = require('../config/db');

const MAC_DINH_URL = 'http://127.0.0.1:8000';
const TIMEOUT_MS = 120000; // huan luyen lai co the mat vai chuc giay

let urlCache = null;
let urlCacheLuc = 0;

/** Doc dia chi ML service tu bang cau_hinh (cache 60 giay). */
async function layUrl() {
  const bayGio = Date.now();
  if (urlCache && bayGio - urlCacheLuc < 60000) return urlCache;
  try {
    const [rows] = await db.query("SELECT gia_tri FROM cau_hinh WHERE khoa = 'ml_service_url'");
    urlCache = (rows[0] && rows[0].gia_tri) || MAC_DINH_URL;
  } catch {
    urlCache = MAC_DINH_URL;
  }
  urlCacheLuc = bayGio;
  return urlCache;
}

/** Goi ML service; nem loi neu that bai (nguoi goi tu quyet dinh du phong). */
async function goi(duongDan, { method = 'GET', body = null, timeout = TIMEOUT_MS } = {}) {
  const url = (await layUrl()) + duongDan;
  const huy = AbortSignal.timeout(timeout);
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: huy,
  });
  if (!res.ok) {
    const chiTiet = await res.text().catch(() => '');
    throw new Error(`ML service tra ve ${res.status}: ${chiTiet.slice(0, 200)}`);
  }
  return res.json();
}

const mlService = {
  /** ML service co dang chay khong? Dung cho banner canh bao tren giao dien. */
  kiemTra: async () => {
    try {
      const kq = await goi('/health', { timeout: 4000 });
      return { san_sang: true, ...kq };
    } catch (err) {
      return { san_sang: false, loi: err.message };
    }
  },

  /** Huan luyen lai va du bao luot khach. */
  duBaoLuotKhach: (soNgay = 14, mucTieu = 'so_khach') =>
    goi(`/du-bao/luot-khach?so_ngay=${soNgay}&muc_tieu=${mucTieu}`, { method: 'POST' }),

  /** Huan luyen lai va du bao nhu cau nguyen lieu. */
  duBaoNguyenLieu: (soNgay = 7) =>
    goi(`/du-bao/nguyen-lieu?so_ngay=${soNgay}`, { method: 'POST' }),

  /** Chay lai Apriori tren toan bo lich su. */
  khaiPhaLuat: (thamSo = {}) => {
    const q = new URLSearchParams(thamSo).toString();
    return goi(`/goi-y/khai-pha${q ? '?' + q : ''}`, { method: 'POST' });
  },

  /**
   * Goi y mon di kem. Uu tien goi ML service; neu that bai thi doc thang bang
   * `luat_ket_hop` da luu san - van cho ket qua dung, chi la khong duoc cap
   * nhat theo thoi gian thuc.
   */
  goiYMon: async (idMon = [], soLuong = 5) => {
    try {
      const kq = await goi('/goi-y/mon', {
        method: 'POST',
        body: { id_mon: idMon, so_luong: soLuong },
        timeout: 8000,
      });
      return kq;
    } catch (err) {
      console.warn('[mlService] goi y qua Python that bai, dung du phong SQL:', err.message);
      return mlService.goiYTuDb(idMon, soLuong);
    }
  },

  /** Du phong thuan SQL: doc luat da khai pha tu truoc. */
  goiYTuDb: async (idMon = [], soLuong = 5) => {
    if (!idMon.length) {
      return { nguon: 'ban_chay', goi_y: await mlService.monBanChay(soLuong) };
    }
    const [rows] = await db.query(
      `SELECT l.mon_ve_trai, l.mon_ve_phai, l.do_ho_tro, l.do_tin_cay, l.do_nang,
              m.name_mon, m.gia_mon, m.images
       FROM luat_ket_hop l
       JOIN monan m ON m.id_mon = l.mon_ve_phai
       WHERE m.tinhtrang = 1
       ORDER BY l.do_nang DESC`
    );

    const dangChon = new Set(idMon.map(Number));
    const theoMon = new Map();
    for (const r of rows) {
      const veTrai = String(r.mon_ve_trai).split(',').filter(Boolean).map(Number);
      const vePhai = Number(r.mon_ve_phai);
      // Luat chi ap dung khi TOAN BO ve trai da co trong gio.
      if (!veTrai.every((x) => dangChon.has(x))) continue;
      if (dangChon.has(vePhai)) continue;
      const cu = theoMon.get(vePhai);
      if (!cu || r.do_nang > cu.lift) {
        theoMon.set(vePhai, {
          id_mon: vePhai,
          name_mon: String(r.name_mon).trim(),
          gia_mon: Number(r.gia_mon),
          images: r.images,
          ho_tro: Number(r.do_ho_tro),
          tin_cay: Number(r.do_tin_cay),
          lift: Number(r.do_nang),
        });
      }
    }

    const ds = [...theoMon.values()]
      .sort((a, b) => b.lift - a.lift || b.tin_cay - a.tin_cay)
      .slice(0, soLuong);

    if (!ds.length) {
      return { nguon: 'ban_chay', goi_y: await mlService.monBanChay(soLuong) };
    }
    return { nguon: 'luat_ket_hop', goi_y: ds };
  },

  /** Mon ban chay 60 ngay gan nhat - dung khi chua co luat nao khop. */
  monBanChay: async (soLuong = 5) => {
    const [rows] = await db.query(
      `SELECT h.id_mon, m.name_mon, m.gia_mon, m.images, SUM(h.soluong) AS sl
       FROM hopdong h JOIN monan m ON m.id_mon = h.id_mon
       WHERE h.tinhtrang = 3 AND h.id_mon > 0 AND m.tinhtrang = 1
         AND h.ngay_dat >= (SELECT DATE_SUB(MAX(ngay_dat), INTERVAL 60 DAY) FROM hopdong)
       GROUP BY h.id_mon, m.name_mon, m.gia_mon, m.images
       ORDER BY sl DESC LIMIT ?`,
      [soLuong]
    );
    return rows.map((r) => ({
      id_mon: r.id_mon,
      name_mon: String(r.name_mon).trim(),
      gia_mon: Number(r.gia_mon),
      images: r.images,
      ly_do: 'ban_chay',
    }));
  },

  // --- Doc ket qua da luu (khong can Python) ---

  duBaoKhachDaLuu: async (soNgay = 14) => {
    const [rows] = await db.query(
      `SELECT ngay_du_bao, so_khach_du_bao, can_duoi, can_tren, mo_hinh, tao_luc
       FROM du_bao_luot_khach
       WHERE ngay_du_bao >= CURDATE()
       ORDER BY ngay_du_bao LIMIT ?`,
      [soNgay]
    );
    return rows;
  },

  duBaoNguyenLieuDaLuu: async () => {
    const [rows] = await db.query(
      `SELECT d.id_nl, nl.ten_nl, dv.ten_dvt,
              SUM(d.so_luong_can)   AS tong_can,
              MAX(d.ton_hien_tai)   AS ton_hien_tai,
              MAX(d.can_nhap_them)  AS can_nhap_them,
              MAX(d.mo_hinh)        AS mo_hinh,
              COUNT(*)              AS so_ngay,
              MAX(d.tao_luc)        AS tao_luc
       FROM du_bao_nguyen_lieu d
       JOIN nguyen_lieu nl ON nl.id_nl = d.id_nl
       LEFT JOIN don_vi_tinh dv ON dv.id_dvt = nl.id_dvt
       WHERE d.ngay_du_bao >= CURDATE()
       GROUP BY d.id_nl, nl.ten_nl, dv.ten_dvt
       ORDER BY can_nhap_them DESC`
    );
    return rows;
  },

  danhGiaMoHinh: async () => {
    const [rows] = await db.query(
      `SELECT bai_toan, mo_hinh, mae, rmse, mape, r2, so_mau_train, so_mau_test, tao_luc
       FROM danh_gia_mo_hinh ORDER BY bai_toan, mae`
    );
    return rows;
  },

  thongKeLuat: async () => {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS so_luat, MAX(so_giao_dich) AS so_giao_dich,
              ROUND(AVG(do_tin_cay), 4) AS tin_cay_tb, ROUND(MAX(do_nang), 3) AS lift_max,
              MAX(tao_luc) AS tao_luc
       FROM luat_ket_hop`
    );
    return rows[0];
  },

  // --- Nhan dien khuon mat ---
  //
  // Khac voi du bao, nhan dien khuon mat KHONG co du phong SQL: khong the lam
  // thi giac may tinh bang truy van. Neu Python tat, cac ham nay nem loi ro rang
  // de giao dien bao "dich vu nhan dien chua bat" thay vi im lang.

  /** Tinh trang mo hinh + so nguoi da dang ky. Khong nem loi (dung cho banner). */
  khuonMatTrangThai: async () => {
    try {
      return { ket_noi: true, ...(await goi('/khuon-mat/trang-thai', { timeout: 5000 })) };
    } catch (err) {
      return { ket_noi: false, san_sang: false, loi: err.message };
    }
  },

  /** Dang ky mau khuon mat cho mot nhan vien. */
  khuonMatDangKy: (idNv, anh, nguoiDangKy = null, thayThe = false) =>
    goi('/khuon-mat/dang-ky', {
      method: 'POST',
      body: { id_nv: idNv, anh, nguoi_dang_ky: nguoiDangKy, thay_the: thayThe },
      timeout: 60000,
    }),

  /**
   * Cham cong bang khuon mat: gui day khung hinh + thu thach.
   * idNv = null -> nhan dien 1:N (kiosk); co idNv -> xac minh 1:1.
   */
  khuonMatChamCong: (khung, thuThach = 'gat_dau', idNv = null, boQuaSong = false) =>
    goi('/khuon-mat/cham-cong', {
      method: 'POST',
      body: { khung, thu_thach: thuThach, id_nv: idNv, bo_qua_song: boQuaSong },
      timeout: 30000,
    }),

  /** Xoa toan bo mau khuon mat cua mot nhan vien. */
  khuonMatXoa: (idNv) =>
    goi('/khuon-mat/xoa', { method: 'POST', body: { id_nv: idNv }, timeout: 10000 }),

  /** Chay lai danh gia do chinh xac (SFace vs LBPH). */
  khuonMatDanhGia: () => goi('/khuon-mat/danh-gia', { method: 'POST', timeout: 120000 }),

  topLuat: async (gioiHan = 25) => {
    const [rows] = await db.query(
      `SELECT l.mon_ve_trai, m.name_mon AS ten_ve_phai,
              l.do_ho_tro, l.do_tin_cay, l.do_nang
       FROM luat_ket_hop l JOIN monan m ON m.id_mon = l.mon_ve_phai
       ORDER BY l.do_nang DESC LIMIT ?`,
      [gioiHan]
    );
    if (!rows.length) return [];

    const [mons] = await db.query('SELECT id_mon, name_mon FROM monan');
    const ten = new Map(mons.map((m) => [Number(m.id_mon), String(m.name_mon).trim()]));
    return rows.map((r) => ({
      neu_goi: String(r.mon_ve_trai)
        .split(',')
        .filter(Boolean)
        .map((x) => ten.get(Number(x)) || x),
      goi_y_them: String(r.ten_ve_phai).trim(),
      ho_tro: Number(r.do_ho_tro),
      tin_cay: Number(r.do_tin_cay),
      lift: Number(r.do_nang),
    }));
  },
};

module.exports = mlService;
