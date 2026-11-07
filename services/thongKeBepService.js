/**
 * THONG KE BEP - so mon ban, thoi gian che bien, tieu hao & hao hut NVL, kho.
 *
 * Nguon:
 *   hopdong (tinhtrang = 3)  mon da ban, so luong, doanh thu, gio goi mon,
 *                            bep_bat_dau / bep_ket_thuc (moc KDS)
 *   xuat_kho                 tieu hao theo ban hang + xuat ngoai ban hang
 *                            (hu hong, het han, hao hut...) tu phieu_xuat
 *   nguyen_lieu, lo hang     ton kho, gia tri, canh bao
 *
 * Moi so tien NVL tinh bang gia tri chup luc xuat (`xuat_kho.gia_tri`); dong cu
 * chua co thi lui ve so_luong * gia von hien tai.
 */
const db = require('../config/db');
const kho = require('./khoBepService');

const BAN = "h.tinhtrang = 3 AND h.id_mon > 0 AND h.ngay_dat BETWEEN ? AND ?";
const GIA_TRI_XK = 'COALESCE(x.gia_tri, x.so_luong * nl.gia_von)';
/** Nhom do uong / ruou bia - thuoc quay bar, tach rieng khoi bang xep hang mon cua bep. */
const LA_DO_UONG = "l.name_loai REGEXP 'DRINK|SAKE|BEER|UỐNG'";

function luiKy(tu, den) {
  const a = new Date(`${tu}T00:00:00`), b = new Date(`${den}T00:00:00`);
  const soNgay = Math.round((b - a) / 86400000) + 1;
  const truocDen = new Date(a); truocDen.setDate(truocDen.getDate() - 1);
  const truocTu = new Date(truocDen); truocTu.setDate(truocTu.getDate() - soNgay + 1);
  const f = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { tu: f(truocTu), den: f(truocDen), soNgay };
}

async function tongBan(tu, den) {
  const [[r]] = await db.query(
    `SELECT COALESCE(SUM(h.soluong),0) AS so_mon, COALESCE(SUM(h.thanhtien),0) AS doanh_thu,
            COUNT(DISTINCT h.sesis) AS so_don, COUNT(DISTINCT h.id_mon) AS so_loai_mon
       FROM hopdong h FORCE INDEX (idx_hopdong_stats) WHERE ${BAN}`, [tu, den]);
  return { so_mon: Number(r.so_mon), doanh_thu: Number(r.doanh_thu), so_don: Number(r.so_don), so_loai_mon: Number(r.so_loai_mon) };
}

async function thongKe({ tuNgay, denNgay }) {
  const ky = luiKy(tuNgay, denNgay);
  const tham = [tuNgay, denNgay];

  const [
    hienTai, kyTruoc,
    [topMon], [banCham], [topDoUong], [theoLoai], [theoGio], [theoNgay], [theoThu],
    [[cheBien]], [monCham],
    [tieuHao], [[tongTieuHao]], [haoHutLyDo], [haoHutNVL], [phieuHaoHut],
    [[kho1]], canhBaoLo, goiY,
  ] = await Promise.all([
    tongBan(tuNgay, denNgay),
    tongBan(ky.tu, ky.den),
    db.query(`SELECT h.id_mon, m.name_mon, l.name_loai, SUM(h.soluong) AS sl, SUM(h.thanhtien) AS dt
                FROM hopdong h JOIN monan m ON m.id_mon = h.id_mon LEFT JOIN loai_mon l ON l.id_loai = m.id_loai
               WHERE ${BAN} AND NOT ${LA_DO_UONG} GROUP BY h.id_mon ORDER BY sl DESC LIMIT 15`, tham),
    db.query(`SELECT m.id_mon, m.name_mon, l.name_loai, COALESCE(b.sl,0) AS sl, COALESCE(b.dt,0) AS dt
                FROM monan m LEFT JOIN loai_mon l ON l.id_loai = m.id_loai
                LEFT JOIN (SELECT h.id_mon, SUM(h.soluong) sl, SUM(h.thanhtien) dt FROM hopdong h WHERE ${BAN} GROUP BY h.id_mon) b
                  ON b.id_mon = m.id_mon
               WHERE m.tinhtrang = 1 AND l.name_loai REGEXP '^[0-9]+\\\\.' AND NOT ${LA_DO_UONG}
               ORDER BY sl ASC, m.name_mon LIMIT 10`, tham),
    db.query(`SELECT h.id_mon, m.name_mon, SUM(h.soluong) AS sl, SUM(h.thanhtien) AS dt
                FROM hopdong h JOIN monan m ON m.id_mon = h.id_mon JOIN loai_mon l ON l.id_loai = m.id_loai
               WHERE ${BAN} AND ${LA_DO_UONG} GROUP BY h.id_mon ORDER BY sl DESC LIMIT 8`, tham),
    db.query(`SELECT l.name_loai, SUM(h.soluong) AS sl, SUM(h.thanhtien) AS dt
                FROM hopdong h JOIN monan m ON m.id_mon = h.id_mon JOIN loai_mon l ON l.id_loai = m.id_loai
               WHERE ${BAN} GROUP BY l.id_loai ORDER BY sl DESC`, tham),
    db.query(`SELECT HOUR(h.gio_dat) AS gio, SUM(h.soluong) AS sl FROM hopdong h
               WHERE ${BAN} AND h.gio_dat IS NOT NULL GROUP BY gio ORDER BY gio`, tham),
    db.query(`SELECT DATE_FORMAT(h.ngay_dat,'%Y-%m-%d') AS ngay, SUM(h.soluong) AS sl, SUM(h.thanhtien) AS dt
                FROM hopdong h FORCE INDEX (idx_hopdong_stats) WHERE ${BAN} GROUP BY h.ngay_dat ORDER BY h.ngay_dat`, tham),
    db.query(`SELECT DAYOFWEEK(h.ngay_dat) AS thu, SUM(h.soluong) AS sl, COUNT(DISTINCT h.ngay_dat) AS so_ngay
                FROM hopdong h FORCE INDEX (idx_hopdong_stats) WHERE ${BAN} GROUP BY thu ORDER BY thu`, tham),
    /*
     * Thoi gian che bien: loc theo KHOANG `bep_ket_thuc` (dung duoc chi muc
     * idx_hopdong_bep_kt) chu khong boc DATE(...) - boc ham vao cot la MySQL
     * quet ca 110 nghin dong. Ban dau JOIN monan truoc roi moi loc mat 6 giay.
     */
    db.query(`SELECT COUNT(*) AS so, AVG(TIMESTAMPDIFF(SECOND, h.bep_bat_dau, h.bep_ket_thuc))/60 AS tb,
                     MAX(TIMESTAMPDIFF(SECOND, h.bep_bat_dau, h.bep_ket_thuc))/60 AS lau_nhat,
                     SUM(TIMESTAMPDIFF(MINUTE, h.bep_bat_dau, h.bep_ket_thuc) > 20) AS tre
                FROM hopdong h WHERE h.bep_ket_thuc >= ? AND h.bep_ket_thuc < ? + INTERVAL 1 DAY
                 AND h.bep_bat_dau IS NOT NULL AND h.bep_ket_thuc > h.bep_bat_dau`, tham),
    db.query(`SELECT m.name_mon, x.so, x.tb FROM (
                SELECT h.id_mon, COUNT(*) AS so, AVG(TIMESTAMPDIFF(SECOND, h.bep_bat_dau, h.bep_ket_thuc))/60 AS tb
                  FROM hopdong h WHERE h.bep_ket_thuc >= ? AND h.bep_ket_thuc < ? + INTERVAL 1 DAY
                   AND h.bep_bat_dau IS NOT NULL AND h.bep_ket_thuc > h.bep_bat_dau
                 GROUP BY h.id_mon ORDER BY tb DESC LIMIT 10) x
              JOIN monan m ON m.id_mon = x.id_mon ORDER BY x.tb DESC`, tham),
    db.query(`SELECT nl.id_nl, nl.ten_nl, dvt.ten_dvt, SUM(x.so_luong) AS sl, SUM(${GIA_TRI_XK}) AS gt
                FROM xuat_kho x JOIN nguyen_lieu nl ON nl.id_nl = x.id_nl LEFT JOIN don_vi_tinh dvt ON dvt.id_dvt = nl.id_dvt
               WHERE x.ly_do IN ('ban_hang','ban_hang_mo_phong') AND x.ngay_xuat BETWEEN ? AND ?
               GROUP BY nl.id_nl ORDER BY gt DESC LIMIT 15`, tham),
    db.query(`SELECT COALESCE(SUM(${GIA_TRI_XK}),0) AS gt FROM xuat_kho x JOIN nguyen_lieu nl ON nl.id_nl = x.id_nl
               WHERE x.ly_do IN ('ban_hang','ban_hang_mo_phong') AND x.ngay_xuat BETWEEN ? AND ?`, tham),
    db.query(`SELECT x.ly_do, COUNT(DISTINCT x.id_px) AS so_phieu, SUM(${GIA_TRI_XK}) AS gt
                FROM xuat_kho x JOIN nguyen_lieu nl ON nl.id_nl = x.id_nl
               WHERE x.ly_do NOT IN ('ban_hang','ban_hang_mo_phong') AND x.ngay_xuat BETWEEN ? AND ?
               GROUP BY x.ly_do ORDER BY gt DESC`, tham),
    db.query(`SELECT nl.ten_nl, dvt.ten_dvt, SUM(x.so_luong) AS sl, SUM(${GIA_TRI_XK}) AS gt,
                     GROUP_CONCAT(DISTINCT x.ly_do) AS cac_ly_do
                FROM xuat_kho x JOIN nguyen_lieu nl ON nl.id_nl = x.id_nl LEFT JOIN don_vi_tinh dvt ON dvt.id_dvt = nl.id_dvt
               WHERE x.ly_do IN ('hu_hong','het_han','hao_hut','che_bien_loi','kiem_ke') AND x.ngay_xuat BETWEEN ? AND ?
               GROUP BY nl.id_nl ORDER BY gt DESC LIMIT 10`, tham),
    db.query(`SELECT px.id_px, px.ma_phieu, px.ly_do, px.thoi_diem, px.tong_gia_tri, px.ghi_chu, nv.ten AS nguoi
                FROM phieu_xuat px LEFT JOIN nhan_vien nv ON nv.id_nv = px.id_nv
               WHERE px.ly_do IN ('hu_hong','het_han','hao_hut','che_bien_loi','kiem_ke') AND DATE(px.thoi_diem) BETWEEN ? AND ?
               ORDER BY px.thoi_diem DESC LIMIT 8`, tham),
    db.query(`SELECT COUNT(*) AS so_nvl, COALESCE(SUM(GREATEST(so_luong,0) * gia_von),0) AS gia_tri,
                     SUM(so_luong < dinh_muc_min) AS duoi_dinh_muc, SUM(so_luong <= 0) AS het
                FROM nguyen_lieu`),
    kho.loHang({ trongNgay: 3, chiCanhBao: true }),
    kho.goiYMuaHang(),
  ]);

  const n = (v) => Number(v) || 0;
  const giaTriDung = n(tongTieuHao.gt);
  const haoHut = haoHutLyDo.reduce((s, r) => s + ((kho.LY_DO_XUAT[r.ly_do] || {}).la_hao_hut ? n(r.gt) : 0), 0);
  const tenThu = ['', 'CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const doi = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null);

  return {
    tu_ngay: tuNgay, den_ngay: denNgay, so_ngay: ky.soNgay,
    ky_truoc: { tu: ky.tu, den: ky.den },
    tong: {
      ...hienTai,
      so_mon_ngay: Math.round(hienTai.so_mon / ky.soNgay),
      doi_so_mon: doi(hienTai.so_mon, kyTruoc.so_mon),
      doi_doanh_thu: doi(hienTai.doanh_thu, kyTruoc.doanh_thu),
      gia_tri_nvl_dung: Math.round(giaTriDung),
      food_cost: hienTai.doanh_thu > 0 ? Math.round((giaTriDung / hienTai.doanh_thu) * 1000) / 10 : null,
      hao_hut: Math.round(haoHut),
      ty_le_hao_hut: giaTriDung + haoHut > 0 ? Math.round((haoHut / (giaTriDung + haoHut)) * 1000) / 10 : 0,
    },
    top_mon: topMon.map((r) => ({ ...r, sl: n(r.sl), dt: n(r.dt) })),
    ban_cham: banCham.map((r) => ({ ...r, sl: n(r.sl), dt: n(r.dt) })),
    top_do_uong: topDoUong.map((r) => ({ ...r, sl: n(r.sl), dt: n(r.dt) })),
    theo_loai: theoLoai.map((r) => ({ ten: String(r.name_loai).replace(/^\d+\.\s*/, ''), sl: n(r.sl), dt: n(r.dt) })),
    theo_gio: theoGio.map((r) => ({ gio: n(r.gio), sl: n(r.sl) })),
    theo_ngay: theoNgay.map((r) => ({ ngay: r.ngay, sl: n(r.sl), dt: n(r.dt) })),
    theo_thu: theoThu.map((r) => ({ thu: tenThu[n(r.thu)], tb: r.so_ngay ? Math.round(n(r.sl) / n(r.so_ngay)) : 0 })),
    che_bien: {
      so: n(cheBien.so), tb: cheBien.tb == null ? null : Math.round(n(cheBien.tb) * 10) / 10,
      lau_nhat: cheBien.lau_nhat == null ? null : Math.round(n(cheBien.lau_nhat)), tre: n(cheBien.tre),
      mon_cham: monCham.map((r) => ({ ten: r.name_mon, so: n(r.so), tb: Math.round(n(r.tb) * 10) / 10 })),
    },
    tieu_hao: tieuHao.map((r) => ({ ...r, sl: n(r.sl), gt: n(r.gt) })),
    hao_hut_ly_do: haoHutLyDo.map((r) => ({ ...r, ...(kho.LY_DO_XUAT[r.ly_do] || { ten: r.ly_do }), so_phieu: n(r.so_phieu), gt: n(r.gt) })),
    hao_hut_nvl: haoHutNVL.map((r) => ({
      ...r, sl: n(r.sl), gt: n(r.gt),
      ly_do: String(r.cac_ly_do || '').split(',').map((k) => (kho.LY_DO_XUAT[k] || {}).ten || k).join(', '),
    })),
    phieu_hao_hut: phieuHaoHut.map((r) => ({ ...r, ten_ly_do: (kho.LY_DO_XUAT[r.ly_do] || {}).ten || r.ly_do, tong_gia_tri: n(r.tong_gia_tri) })),
    kho: {
      so_nvl: n(kho1.so_nvl), gia_tri: Math.round(n(kho1.gia_tri)), duoi_dinh_muc: n(kho1.duoi_dinh_muc), het: n(kho1.het),
      lo_canh_bao: canhBaoLo, can_mua: goiY.length, goi_y: goiY.slice(0, 8),
    },
  };
}

/** Ngay gan nhat co ban hang dang ke (>= 20 phan) - de goi y khi khoang dang xem qua thua. */
async function ngayCoDuLieuGanNhat() {
  const [[r]] = await db.query(
    `SELECT DATE_FORMAT(ngay_dat, '%Y-%m-%d') AS ngay FROM hopdong FORCE INDEX (idx_hopdong_stats)
      WHERE tinhtrang = 3 AND id_mon > 0 AND ngay_dat <= CURDATE()
      GROUP BY ngay_dat HAVING SUM(soluong) >= 20 ORDER BY ngay_dat DESC LIMIT 1`);
  return r ? r.ngay : null;
}

module.exports = { thongKe, ngayCoDuLieuGanNhat };
