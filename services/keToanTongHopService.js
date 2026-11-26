/**
 * TONG HOP CHO KE TOAN: bao cao dong tien, ngan sach + canh bao, dashboard.
 *
 * Khong tinh lai tu dau: dung so quy (thuChiService.baoCao - dong tien THUC
 * thu / chi), lai lo (laiLoService - doanh thu, gia von, food cost), cong no NCC,
 * luong va khoa so. Moi con so tren dashboard truy nguoc duoc ve mot trang goc.
 */
const db = require('../config/db');
const thuChi = require('./thuChiService');

const NHOM_CHI_DS = ['nguyen_lieu', 'nhan_su', 'mat_bang', 'marketing', 'van_hanh'];

const ngayChuoi = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const dauThang = (t, n) => `${n}-${String(t).padStart(2, '0')}-01`;
const cuoiThang = (t, n) => ngayChuoi(new Date(n, t, 0));

/** Gom cac dong so quy hop le thanh dong tien vao / ra theo nhom. */
function gomDongTien(dong) {
  const vao = { ban_hang: 0, dat_coc: 0, thu_khac: 0 };
  const ra = Object.fromEntries(NHOM_CHI_DS.map((k) => [k, 0]));
  ra.hoan_tien = 0;
  let chuyenQuy = 0;
  for (const d of dong) {
    if (d.loai === 'thu') {
      if (d.danh_muc === 'ban_hang') vao.ban_hang += d.so_tien;
      else if (d.danh_muc === 'dat_coc') vao.dat_coc += d.so_tien;
      else if (d.danh_muc === 'nop_quy') chuyenQuy += d.so_tien;
      else vao.thu_khac += d.so_tien;
    } else if (d.danh_muc === 'hoan_tien') ra.hoan_tien += d.so_tien;
    else if (d.danh_muc === 'nop_tien') chuyenQuy -= d.so_tien;
    else ra[thuChi.NHOM_CHI[d.danh_muc] || 'van_hanh'] += d.so_tien;
  }
  const tongVao = vao.ban_hang + vao.dat_coc + vao.thu_khac;
  const tongRa = Object.values(ra).reduce((t, v) => t + v, 0);
  return { vao, ra, tong_vao: tongVao, tong_ra: tongRa, thuan: tongVao - tongRa, chuyen_quy: chuyenQuy };
}

/**
 * Bao cao dong tien (truc tiep): tien vao / ra theo nhom, theo ky (ngay | thang).
 * nop_quy / nop_tien la chuyen tien giua quy - khong tinh vao dong tien.
 */
async function dongTien({ tuNgay, denNgay, nhom = 'ngay' }) {
  const bc = await thuChi.baoCao({ tuNgay, denNgay });
  const hopLe = bc.so_quy.filter((d) => !d.huy && !d.cho_duyet);
  const khoaKy = (d) => (nhom === 'thang' ? ngayChuoi(d.thoi_diem).slice(0, 7) : ngayChuoi(d.thoi_diem));
  const theoKy = new Map();
  for (const d of hopLe) {
    const k = khoaKy(d);
    if (!theoKy.has(k)) theoKy.set(k, []);
    theoKy.get(k).push(d);
  }
  const ky = [...theoKy.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, ds]) => ({ ky: k, ...gomDongTien(ds) }));
  return {
    tuNgay, denNgay, nhom,
    tong: gomDongTien(hopLe),
    theo_ky: ky,
    quy: bc.quy,
    TEN_NHOM_CHI: thuChi.TEN_NHOM_CHI,
  };
}

// ---------------------------------------------------------------- ngan sach
let daTaoNs = false;
async function damBaoNganSach() {
  if (daTaoNs) return;
  await db.query(`CREATE TABLE IF NOT EXISTS ngan_sach (
    nam SMALLINT NOT NULL,
    thang TINYINT NOT NULL,
    nhom VARCHAR(30) NOT NULL,
    han_muc DECIMAL(14,2) NOT NULL DEFAULT 0,
    id_nv INT NULL,
    cap_nhat_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (nam, thang, nhom)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  daTaoNs = true;
}

/** Ngan sach thang: han muc tung nhom + da chi thuc te + muc canh bao. */
async function nganSach(thang, nam) {
  await damBaoNganSach();
  const t = Number(thang), n = Number(nam);
  const [rows] = await db.query('SELECT nhom, han_muc FROM ngan_sach WHERE nam = ? AND thang = ?', [n, t]);
  const hm = Object.fromEntries(rows.map((r) => [r.nhom, Number(r.han_muc)]));
  const den = cuoiThang(t, n) < ngayChuoi(new Date()) ? cuoiThang(t, n) : ngayChuoi(new Date());
  const dt = dauThang(t, n) <= den ? await dongTien({ tuNgay: dauThang(t, n), denNgay: den }) : null;
  const ds = NHOM_CHI_DS.map((k) => {
    const daChi = dt ? dt.tong.ra[k] : 0;
    const hanMuc = hm[k] || 0;
    const tyLe = hanMuc ? daChi / hanMuc : null;
    return {
      nhom: k, ten: thuChi.TEN_NHOM_CHI[k], han_muc: hanMuc, da_chi: daChi, ty_le: tyLe,
      muc: !hanMuc ? 'chua_dat' : tyLe > 1 ? 'vuot' : tyLe >= 0.8 ? 'sap_vuot' : 'on',
    };
  });
  return { thang: t, nam: n, ds, tong_han_muc: ds.reduce((s, x) => s + x.han_muc, 0), tong_da_chi: ds.reduce((s, x) => s + x.da_chi, 0) };
}

async function luuNganSach(thang, nam, hanMuc, idNv) {
  await damBaoNganSach();
  const t = Number(thang), n = Number(nam);
  if (!(t >= 1 && t <= 12) || !(n >= 2000)) throw new Error('Tháng không hợp lệ.');
  for (const k of NHOM_CHI_DS) {
    const v = Math.round(Number(String((hanMuc || {})[k] ?? '').replace(/[^\d]/g, '')) || 0);
    await db.query(
      `INSERT INTO ngan_sach (nam, thang, nhom, han_muc, id_nv) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE han_muc = VALUES(han_muc), id_nv = VALUES(id_nv)`, [n, t, k, v, idNv || null]);
  }
}

// ---------------------------------------------------------------- dashboard
async function dashboard(thang, nam) {
  const t = Number(thang), n = Number(nam);
  const tu = dauThang(t, n);
  const homNay = ngayChuoi(new Date());
  const den = cuoiThang(t, n) < homNay ? cuoiThang(t, n) : homNay;

  const [laiLo, dt, ns, congNo, luong, khoa, thucDon] = await Promise.all([
    require('./laiLoService').phanTich({ tuNgay: tu, denNgay: den, nhom: 'ngay' }).catch(() => null),
    dongTien({ tuNgay: tu, denNgay: den }).catch(() => null),
    nganSach(t, n).catch(() => null),
    require('./congNoNccService').tongHop().catch(() => []),
    db.query(
      `SELECT COUNT(*) AS tong, SUM(trang_thai = 0) AS du_thao, SUM(trang_thai = 1) AS cho_duyet,
              SUM(trang_thai = 2) AS cho_chi, SUM(trang_thai = 3) AS da_chi, COALESCE(SUM(tong_luong), 0) AS quy_luong
         FROM luong WHERE thang = ? AND nam = ?`, [t, n]).then(([[r]]) => r).catch(() => null),
    require('./khoaSoService').dsKy(60).catch(() => []),
    require('./phanTichThucDonService').phanTich({ tuNgay: tu, denNgay: den }).catch(() => null),
  ]);

  // Ngay da qua trong 7 ngay gan nhat chua chot so.
  const chuaChot = [];
  for (let i = 1; i <= 7; i++) {
    const d = ngayChuoi(new Date(Date.now() - i * 86400000));
    const daChot = khoa.some((k) => k.trang_thai === 'da_khoa' && ngayChuoi(k.tu_ngay) <= d && ngayChuoi(k.den_ngay) >= d);
    if (!daChot) chuaChot.push(d);
  }
  const [[pc]] = await db.query("SELECT COUNT(*) AS n, COALESCE(SUM(so_tien), 0) AS tien FROM phieu_thu_chi WHERE trang_thai = 'cho_duyet'").catch(() => [[{ n: 0, tien: 0 }]]);

  const canhBao = [];
  const fc = laiLo ? laiLo.tong.food_cost : 0;
  const fcCanhBao = require('./phanTichThucDonService').FOOD_COST_CANH_BAO || 0.35;
  if (laiLo && laiLo.tong.doanh_thu > 0 && fc > fcCanhBao) {
    canhBao.push({ muc: 'cao', noi_dung: `Food cost tháng ${(fc * 100).toFixed(1)}% vượt ngưỡng ${(fcCanhBao * 100).toFixed(0)}% - xem Phân tích thực đơn.`, link: '/staff/phan-tich-thuc-don' });
  }
  for (const x of (ns ? ns.ds : [])) {
    if (x.muc === 'vuot') canhBao.push({ muc: 'cao', noi_dung: `Chi ${x.ten} vượt ngân sách: ${Math.round(x.da_chi).toLocaleString('vi-VN')}đ / ${Math.round(x.han_muc).toLocaleString('vi-VN')}đ.`, link: '/staff/ke-toan/ngan-sach' });
    else if (x.muc === 'sap_vuot') canhBao.push({ muc: 'vua', noi_dung: `Chi ${x.ten} đã dùng ${Math.round(x.ty_le * 100)}% ngân sách.`, link: '/staff/ke-toan/ngan-sach' });
  }
  const quaHan = congNo.reduce((s, x) => s + x.qua_han, 0);
  if (quaHan > 0) canhBao.push({ muc: 'cao', noi_dung: `Công nợ nhà cung cấp quá hạn ${Math.round(quaHan).toLocaleString('vi-VN')}đ.`, link: '/staff/cong-no-ncc' });
  if (Number(pc.n)) canhBao.push({ muc: 'vua', noi_dung: `${pc.n} phiếu chi vượt hạn mức chờ Quản lý duyệt (${Math.round(pc.tien).toLocaleString('vi-VN')}đ).`, link: '/staff/thu-chi' });
  if (chuaChot.length) canhBao.push({ muc: 'vua', noi_dung: `${chuaChot.length} ngày gần đây chưa chốt sổ (${chuaChot.slice(-1)[0]} → ${chuaChot[0]}).`, link: '/staff/ke-toan/chot-so?ngay=' + chuaChot[chuaChot.length - 1] });
  if (luong && Number(luong.cho_duyet)) canhBao.push({ muc: 'vua', noi_dung: `${luong.cho_duyet} bảng lương chờ Quản lý duyệt.`, link: `/staff/accountant/salary?month=${t}&year=${n}` });
  if (luong && Number(luong.cho_chi)) canhBao.push({ muc: 'vua', noi_dung: `${luong.cho_chi} bảng lương đã duyệt chờ chi.`, link: `/staff/accountant/salary?month=${t}&year=${n}` });

  return {
    thang: t, nam: n, tu, den,
    lai_lo: laiLo ? laiLo.tong : null,
    theo_ngay: laiLo ? laiLo.theo_ky : [],
    mon_lai_nhat: laiLo ? laiLo.mon_lai_nhat.slice(0, 5) : [],
    mon_lai_it_nhat: laiLo ? laiLo.mon_lai_it_nhat.slice(0, 5) : [],
    dong_tien: dt ? dt.tong : null,
    quy: dt ? dt.quy : null,
    ngan_sach: ns,
    cong_no: { tong: congNo.reduce((s, x) => s + x.con_no, 0), qua_han: quaHan, so_ncc: congNo.filter((x) => x.con_no > 0).length },
    luong,
    chua_chot: chuaChot,
    phieu_cho_duyet: { so: Number(pc.n), tien: Number(pc.tien) },
    thuc_don: thucDon && thucDon.tong ? thucDon.tong : null,
    canh_bao: canhBao,
    TEN_NHOM_CHI: thuChi.TEN_NHOM_CHI,
  };
}

module.exports = { dongTien, nganSach, luuNganSach, dashboard, NHOM_CHI_DS };
