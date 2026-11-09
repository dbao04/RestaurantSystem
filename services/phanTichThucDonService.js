/**
 * PHAN TICH THUC DON (menu engineering) - phuong phap Kasavana & Smith.
 *
 * Moi mon duoc xep theo HAI truc:
 *   - Muc pho bien: ty le phan ban cua mon trong tong so phan ban cua pham vi
 *     (menu mix). Nguong = 70% x (1 / so mon) - mot mon "binh thuong" chiem
 *     1/N, ban duoi 70% muc do thi coi la ban cham.
 *   - Lai gop moi phan (contribution margin) = gia ban - gia von theo cong thuc.
 *     Nguong = lai gop binh quan CO TRONG SO theo so phan ban.
 *
 *              lai >= nguong        lai < nguong
 *   ban chay   NGOI_SAO             NGUA_KEO
 *   ban cham   CAU_DO               CHO
 *
 * Gia von moi phan = SUM(cong_thuc.so_luong_tieu_hao * nguyen_lieu.gia_von)
 * (gia von binh quan hien tai). Mon chua co cong thuc / gia von = 0 khong xep
 * loai duoc - liet ke rieng de bep bo sung.
 *
 * Nen so sanh trong CUNG danh muc (do uong voi mon chinh co gia von rat khac
 * nhau): truyen idLoai de nguong tinh rieng cho danh muc do.
 */
const db = require('../config/db');

const NHOM = {
  ngoi_sao: { ten: 'Ngôi sao', mo_ta: 'Bán chạy, lãi cao' },
  ngua_keo: { ten: 'Ngựa kéo', mo_ta: 'Bán chạy, lãi thấp' },
  cau_do: { ten: 'Câu đố', mo_ta: 'Bán chậm, lãi cao' },
  cho: { ten: 'Chó', mo_ta: 'Bán chậm, lãi thấp' },
};
const TY_LE_NGUONG_PHO_BIEN = 0.7;
/** Ty le gia von muc tieu khi goi y gia ban (nganh nha hang thuong 28-35%). */
const FOOD_COST_MUC_TIEU = 0.35;
const FOOD_COST_CANH_BAO = 0.45;
/** Duoi so phan nay thi ket qua it y nghia - trang hien canh bao. */
const SO_PHAN_TOI_THIEU = 200;

const lamTron = (x, buoc = 1000) => Math.ceil(x / buoc) * buoc;

function goiY(m) {
  const fc = m.food_cost;
  const ds = [];
  if (m.nhom === 'ngoi_sao') {
    ds.push('Giữ chất lượng và vị trí nổi bật trên thực đơn; không cần giảm giá.');
  } else if (m.nhom === 'ngua_keo') {
    const giaMucTieu = lamTron(m.gia_von / FOOD_COST_MUC_TIEU);
    if (fc > 0.4) {
      ds.push(`Giá vốn cao (${Math.round(fc * 100)}%): xem lại định lượng hoặc nhà cung cấp.`);
    }
    if (giaMucTieu > m.gia_ban) {
      ds.push(`Thử tăng giá nhẹ; giá để giá vốn còn ${FOOD_COST_MUC_TIEU * 100}% là ${giaMucTieu.toLocaleString('vi-VN')}đ.`);
    } else {
      ds.push('Ghép combo với món lãi cao để kéo lãi gộp của đơn.');
    }
  } else if (m.nhom === 'cau_do') {
    ds.push('Lãi tốt nhưng bán chậm: đưa lên vị trí nổi bật, cho nhân viên gợi ý, thử đổi tên / ảnh món.');
  } else if (m.nhom === 'cho') {
    ds.push(m.so_luong === 0
      ? 'Không bán được phần nào trong kỳ: cân nhắc bỏ khỏi thực đơn.'
      : 'Cân nhắc bỏ, hoặc làm lại công thức để giảm giá vốn / tăng sức hút.');
  }
  if (fc >= FOOD_COST_CANH_BAO && m.nhom !== 'ngua_keo') {
    ds.push(`Giá vốn ${Math.round(fc * 100)}% giá bán là cao.`);
  }
  return ds;
}

/**
 * Xep loai (ham thuan - khong doc CSDL, de kiem thu).
 * @param {{id_mon, gia_ban:number, gia_von:number, so_luong:number, doanh_thu?:number}[]} ds
 *        chi gom mon CO gia von > 0.
 */
function phanLoai(ds) {
  const n = ds.length;
  const tongSl = ds.reduce((s, m) => s + (Number(m.so_luong) || 0), 0);
  const nguongPhoBien = n ? TY_LE_NGUONG_PHO_BIEN / n : 0;
  const tongLaiDuKien = ds.reduce((s, m) => s + (m.gia_ban - m.gia_von) * (Number(m.so_luong) || 0), 0);
  const nguongLai = tongSl > 0
    ? tongLaiDuKien / tongSl
    : (n ? ds.reduce((s, m) => s + (m.gia_ban - m.gia_von), 0) / n : 0);

  const mon = ds.map((m) => {
    const sl = Number(m.so_luong) || 0;
    const lai = m.gia_ban - m.gia_von;
    const tyLe = tongSl > 0 ? sl / tongSl : 0;
    const chay = tongSl > 0 && tyLe >= nguongPhoBien;
    const laiCao = lai >= nguongLai;
    const nhom = chay ? (laiCao ? 'ngoi_sao' : 'ngua_keo') : (laiCao ? 'cau_do' : 'cho');
    const doanhThu = m.doanh_thu != null ? Number(m.doanh_thu) : m.gia_ban * sl;
    const kq = {
      ...m,
      so_luong: sl,
      ty_le_ban: tyLe,
      lai_moi_phan: lai,
      food_cost: m.gia_ban > 0 ? m.gia_von / m.gia_ban : 0,
      doanh_thu: doanhThu,
      lai_gop: doanhThu - m.gia_von * sl,
      nhom,
    };
    kq.goi_y = goiY(kq);
    return kq;
  });
  return { mon, nguong_pho_bien: nguongPhoBien, nguong_lai: nguongLai, tong_so_luong: tongSl };
}

const laNgay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

/**
 * @param {{tuNgay:string, denNgay:string, idLoai?:number|null}} o
 */
async function phanTich({ tuNgay, denNgay, idLoai = null }) {
  if (!laNgay(tuNgay) || !laNgay(denNgay) || denNgay < tuNgay) throw new Error('Khoảng ngày không hợp lệ.');
  const [rows] = await db.query(
    `SELECT m.id_mon, m.name_mon, m.gia_mon, m.id_loai, l.name_loai,
            gv.gia_von, COALESCE(b.sl, 0) AS sl, COALESCE(b.doanh_thu, 0) AS doanh_thu
       FROM monan m
       LEFT JOIN loai_mon l ON l.id_loai = m.id_loai
       LEFT JOIN (
         SELECT ct.id_mon, SUM(ct.so_luong_tieu_hao * nl.gia_von) AS gia_von
           FROM cong_thuc ct JOIN nguyen_lieu nl ON nl.id_nl = ct.id_nl
          GROUP BY ct.id_mon
       ) gv ON gv.id_mon = m.id_mon
       LEFT JOIN (
         SELECT id_mon, SUM(soluong) AS sl, SUM(thanhtien) AS doanh_thu
           FROM hopdong
          WHERE tinhtrang = 3 AND id_mon > 0 AND soluong > 0 AND ngay_dat BETWEEN ? AND ?
          GROUP BY id_mon
       ) b ON b.id_mon = m.id_mon
      WHERE m.tinhtrang = 1 ${idLoai ? 'AND m.id_loai = ?' : ''}
      ORDER BY m.name_mon`,
    [tuNgay, denNgay, ...(idLoai ? [idLoai] : [])]);

  const coGiaVon = [];
  const thieuGiaVon = [];
  for (const r of rows) {
    const m = {
      id_mon: r.id_mon, ten: r.name_mon, id_loai: r.id_loai, ten_loai: r.name_loai || '—',
      gia_ban: Number(r.gia_mon) || 0, gia_von: Math.round(Number(r.gia_von) || 0),
      so_luong: Number(r.sl) || 0, doanh_thu: Number(r.doanh_thu) || 0,
    };
    if (m.gia_von > 0 && m.gia_ban > 0) coGiaVon.push(m); else thieuGiaVon.push(m);
  }
  const kq = phanLoai(coGiaVon);
  const tong = kq.mon.reduce((s, m) => {
    s.doanh_thu += m.doanh_thu; s.lai_gop += m.lai_gop; s.gia_von += m.gia_von * m.so_luong;
    s.dem[m.nhom] += 1;
    return s;
  }, { doanh_thu: 0, lai_gop: 0, gia_von: 0, dem: { ngoi_sao: 0, ngua_keo: 0, cau_do: 0, cho: 0 } });
  tong.food_cost = tong.doanh_thu > 0 ? tong.gia_von / tong.doanh_thu : 0;

  return {
    ...kq,
    thieu_gia_von: thieuGiaVon,
    tong,
    it_du_lieu: kq.tong_so_luong < SO_PHAN_TOI_THIEU,
  };
}

async function danhMuc() {
  const [rows] = await db.query(
    `SELECT l.id_loai, l.name_loai, COUNT(m.id_mon) AS so_mon
       FROM loai_mon l JOIN monan m ON m.id_loai = l.id_loai AND m.tinhtrang = 1
      GROUP BY l.id_loai, l.name_loai ORDER BY l.name_loai`);
  return rows;
}

module.exports = {
  NHOM, TY_LE_NGUONG_PHO_BIEN, FOOD_COST_MUC_TIEU, FOOD_COST_CANH_BAO, SO_PHAN_TOI_THIEU,
  phanLoai, phanTich, danhMuc,
};
