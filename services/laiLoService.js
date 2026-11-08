/**
 * BAO CAO LAI LO QUAN TRI (goc gia von hang da ban).
 *
 *   Doanh thu        = don an da thanh toan (hopdong.thanhtien, theo ngay_dat)
 *                    + doanh thu tiec (payments cua dat_tiec)
 *   Gia von          = so phan da ban x gia von moi phan theo cong thuc
 *                      (gia von binh quan hien tai cua nguyen lieu)
 *   Lai gop          = Doanh thu - Gia von
 *   Luong            = bang luong cac thang giao voi ky, phan bo theo so ngay
 *   Chi phi khac     = chi_phi_khac + phieu chi so quy (tru tra NCC, mua
 *                      nguyen lieu, hoan tien - nhung khoan nay la tien hang /
 *                      tien tra lai, khong phai chi phi van hanh)
 *   Hao hut          = mon da nau roi bi huy (huy_mon, trang thai bep >= 1) theo
 *                      gia von + xuat kho hao hut (ly do khac ban hang)
 *   Loi nhuan        = Lai gop - Luong - Chi phi khac - Hao hut
 *
 * Khac bao cao thang cua ke toan (personnelService.getFinancialReport) - do la
 * goc DONG TIEN (tinh tien MUA nguyen lieu trong thang). Bao cao nay tinh gia
 * von cua mon THUC SU BAN trong ky - hai so khac nhau la binh thuong.
 *
 * Hieu nang: quet hopdong MOT lan (gom ky x mon); gia von mon va danh muc doc
 * rieng (bang nho) roi ghep trong JS - JOIN gia von vao ~140.000 dong don ba
 * lan mat ~9 giay.
 */
const db = require('../config/db');

const laNgay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const p2 = (n) => String(n).padStart(2, '0');
const ds = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** Bieu thuc SQL gom ky: ngay / tuan (thu Hai) / thang. */
function bieuThucKy(cot, nhom) {
  if (nhom === 'thang') return `DATE_FORMAT(${cot}, '%Y-%m')`;
  if (nhom === 'tuan') return `DATE_FORMAT(DATE_SUB(${cot}, INTERVAL WEEKDAY(${cot}) DAY), '%Y-%m-%d')`;
  return `DATE_FORMAT(${cot}, '%Y-%m-%d')`;
}

async function bang(sql, thamSo) {
  try { const [r] = await db.query(sql, thamSo); return r; } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE' || e.code === 'ER_BAD_FIELD_ERROR') return [];
    throw e;
  }
}

/**
 * @param {{tuNgay, denNgay, nhom?: 'ngay'|'tuan'|'thang'}} o
 */
async function phanTich({ tuNgay, denNgay, nhom = 'ngay' }) {
  if (!laNgay(tuNgay) || !laNgay(denNgay) || denNgay < tuNgay) throw new Error('Khoảng ngày không hợp lệ.');
  if (!['ngay', 'tuan', 'thang'].includes(nhom)) nhom = 'ngay';
  const ky = bieuThucKy('h.ngay_dat', nhom);
  const khoang = [tuNgay, denNgay];

  const [dongKyMon, donKy, gvMon, monDm, tiec, luong, khac, phieuChi, huy, xuatHH] = await Promise.all([
    bang(`SELECT ${ky} AS ky, h.id_mon, SUM(h.soluong) AS sl, SUM(h.thanhtien) AS dt
            FROM hopdong h
           WHERE h.tinhtrang = 3 AND h.id_mon > 0 AND h.soluong > 0 AND h.ngay_dat BETWEEN ? AND ?
           GROUP BY ky, h.id_mon`, khoang),
    // So don: gom theo sesis TRUOC (chi muc tinhtrang+sesis da xep san) roi moi
    // dem theo ky. COUNT(DISTINCT sesis) theo nhom tren cot chuoi dai mat ~8
    // giay voi 12 thang; cach nay ~0.5 giay, cung ket qua.
    bang(`SELECT ${bieuThucKy('x.d', nhom)} AS ky, COUNT(*) AS so_don FROM (
            SELECT h.sesis, MIN(h.ngay_dat) AS d FROM hopdong h
             WHERE h.tinhtrang = 3 AND h.id_mon > 0 AND h.soluong > 0
             GROUP BY h.sesis HAVING d BETWEEN ? AND ?) x
           GROUP BY ky`, khoang),
    bang(`SELECT ct.id_mon, SUM(ct.so_luong_tieu_hao * nl.gia_von) AS gv
            FROM cong_thuc ct JOIN nguyen_lieu nl ON nl.id_nl = ct.id_nl GROUP BY ct.id_mon`, []),
    bang(`SELECT m.id_mon, m.name_mon AS ten, COALESCE(l.name_loai, 'Khác') AS loai FROM monan m LEFT JOIN loai_mon l ON l.id_loai = m.id_loai`, []),
    bang(`SELECT ${bieuThucKy('p.thanh_cong_luc', nhom)} AS ky, SUM(p.amount) AS dt
            FROM payments p JOIN dat_tiec t ON t.ma_tiec = p.sesis
           WHERE p.status = 'success' AND DATE(p.thanh_cong_luc) BETWEEN ? AND ?
           GROUP BY ky`, khoang),
    bang('SELECT nam, thang, SUM(tong_luong) AS tong FROM luong GROUP BY nam, thang', []),
    bang(`SELECT ${bieuThucKy('ngay', nhom)} AS ky, SUM(so_tien) AS tien FROM chi_phi_khac
           WHERE ngay BETWEEN ? AND ? GROUP BY ky`, khoang),
    bang(`SELECT ${bieuThucKy('thoi_diem', nhom)} AS ky, SUM(so_tien) AS tien FROM phieu_thu_chi
           WHERE loai = 'chi' AND trang_thai = 'hop_le' AND danh_muc NOT IN ('tra_ncc', 'nguyen_lieu', 'hoan_tien')
             AND DATE(thoi_diem) BETWEEN ? AND ? GROUP BY ky`, khoang),
    bang(`SELECT ${bieuThucKy('tao_luc', nhom)} AS ky, id_mon, SUM(so_luong) AS sl
            FROM huy_mon WHERE trangthai_bep >= 1 AND DATE(tao_luc) BETWEEN ? AND ? GROUP BY ky, id_mon`, khoang),
    bang(`SELECT ${bieuThucKy('ngay_xuat', nhom)} AS ky, SUM(COALESCE(gia_tri, 0)) AS tien FROM xuat_kho
           WHERE ly_do NOT IN ('ban_hang', 'ban_hang_mo_phong') AND ngay_xuat BETWEEN ? AND ? GROUP BY ky`, khoang),
  ]);

  const giaVon = new Map(gvMon.map((r) => [Number(r.id_mon), Number(r.gv) || 0]));
  const loaiMon = new Map(monDm.map((r) => [Number(r.id_mon), r.loai]));
  const tenMon = new Map(monDm.map((r) => [Number(r.id_mon), r.ten]));

  // ---- Ghep doanh thu / gia von theo ky, danh muc, mon ----
  const theoKyDt = new Map(); const theoDmMap = new Map(); const theoMonMap = new Map();
  for (const r of dongKyMon) {
    const id = Number(r.id_mon);
    const sl = Number(r.sl) || 0, dt = Number(r.dt) || 0, gv = sl * (giaVon.get(id) || 0);
    const a1 = theoKyDt.get(r.ky) || { dt: 0, gv: 0 }; a1.dt += dt; a1.gv += gv; theoKyDt.set(r.ky, a1);
    const tenDm = loaiMon.get(id) || 'Khác';
    const a2 = theoDmMap.get(tenDm) || { dt: 0, gv: 0 }; a2.dt += dt; a2.gv += gv; theoDmMap.set(tenDm, a2);
    const a3 = theoMonMap.get(id) || { id_mon: id, ten: tenMon.get(id) || ('#' + id), sl: 0, dt: 0, gv: 0 };
    a3.sl += sl; a3.dt += dt; a3.gv += gv; theoMonMap.set(id, a3);
  }
  const soDon = new Map(donKy.map((r) => [r.ky, Number(r.so_don) || 0]));

  // ---- Luong: phan bo theo so ngay cua thang nam trong ky ----
  const luongThang = new Map(luong.map((r) => [`${r.nam}-${p2(r.thang)}`, Number(r.tong) || 0]));
  const luongTheoNgay = new Map();
  for (let d = new Date(`${tuNgay}T00:00:00`); ds(d) <= denNgay; d.setDate(d.getDate() + 1)) {
    const tong = luongThang.get(ds(d).slice(0, 7)) || 0;
    if (!tong) continue;
    luongTheoNgay.set(ds(d), tong / new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
  }
  const kyCuaNgay = (ngay) => {
    if (nhom === 'thang') return ngay.slice(0, 7);
    if (nhom === 'tuan') { const d = new Date(`${ngay}T00:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ds(d); }
    return ngay;
  };

  // ---- Gop theo ky ----
  const k = new Map();
  const lay = (ten) => {
    if (!k.has(ten)) k.set(ten, { doanh_thu: 0, doanh_thu_tiec: 0, gia_von: 0, so_don: 0, luong: 0, chi_phi_khac: 0, hao_hut: 0 });
    return k.get(ten);
  };
  for (const [ten, o0] of theoKyDt) { const o = lay(ten); o.doanh_thu += o0.dt; o.gia_von += o0.gv; o.so_don = soDon.get(ten) || 0; }
  for (const r of tiec) lay(r.ky).doanh_thu_tiec += Number(r.dt) || 0;
  for (const r of [...khac, ...phieuChi]) lay(r.ky).chi_phi_khac += Number(r.tien) || 0;
  for (const r of huy) lay(r.ky).hao_hut += (Number(r.sl) || 0) * (giaVon.get(Number(r.id_mon)) || 0);
  for (const r of xuatHH) lay(r.ky).hao_hut += Number(r.tien) || 0;
  for (const [ngay, tien] of luongTheoNgay) lay(kyCuaNgay(ngay)).luong += tien;

  const theoKy = [...k.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([ten, o]) => {
    const dt = o.doanh_thu + o.doanh_thu_tiec;
    const laiGop = dt - o.gia_von;
    return { ky: ten, ...o, tong_doanh_thu: dt, lai_gop: laiGop, loi_nhuan: laiGop - o.luong - o.chi_phi_khac - o.hao_hut };
  });
  const CONG = ['doanh_thu', 'doanh_thu_tiec', 'gia_von', 'so_don', 'luong', 'chi_phi_khac', 'hao_hut', 'tong_doanh_thu', 'lai_gop', 'loi_nhuan'];
  const tong = Object.fromEntries(CONG.map((c) => [c, 0]));
  for (const o of theoKy) for (const c of CONG) tong[c] += o[c];
  tong.ty_le_gop = tong.tong_doanh_thu ? tong.lai_gop / tong.tong_doanh_thu : 0;
  tong.ty_le_loi_nhuan = tong.tong_doanh_thu ? tong.loi_nhuan / tong.tong_doanh_thu : 0;
  tong.food_cost = tong.doanh_thu ? tong.gia_von / tong.doanh_thu : 0;

  const mon = [...theoMonMap.values()].map((r) => ({
    id_mon: r.id_mon, ten: r.ten, so_luong: r.sl, doanh_thu: r.dt, gia_von: r.gv,
    lai_gop: r.dt - r.gv, ty_le: r.dt ? (r.dt - r.gv) / r.dt : 0,
  })).sort((a, b) => b.lai_gop - a.lai_gop);

  return {
    nhom, tuNgay, denNgay, tong,
    theo_ky: theoKy,
    theo_danh_muc: [...theoDmMap.entries()].map(([ten, o]) => ({
      ten, doanh_thu: o.dt, gia_von: o.gv, lai_gop: o.dt - o.gv, ty_le: o.dt ? (o.dt - o.gv) / o.dt : 0,
    })).sort((a, b) => b.doanh_thu - a.doanh_thu),
    mon_lai_nhat: mon.slice(0, 10),
    mon_lai_it_nhat: mon.slice(-10).reverse(),
    so_mon: mon.length,
  };
}

/** Gom ky mac dinh theo do dai khoang: <= 45 ngay theo ngay, <= 180 theo tuan, con lai theo thang. */
function nhomMacDinh(tuNgay, denNgay) {
  const ngay = (new Date(`${denNgay}T00:00:00`) - new Date(`${tuNgay}T00:00:00`)) / 86400000 + 1;
  return ngay <= 45 ? 'ngay' : ngay <= 180 ? 'tuan' : 'thang';
}

module.exports = { phanTich, nhomMacDinh, bieuThucKy };
