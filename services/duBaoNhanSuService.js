/**
 * DU BAO NHU CAU NHAN SU THEO CA -> DE XUAT DINH MUC XEP CA.
 *
 * Dinh muc (dinh_muc_ca) truoc day la con so quan ly tu dien, gan nhu giong
 * nhau moi ngay, trong khi du lieu cho thay ca toi dong gap nhieu lan ca sang.
 * Service nay doan tai cua tung (thu x ca) cho TUAN SAP XEP roi doi ra so
 * nguoi can theo nang suat.
 *
 * MO HINH (giai thich duoc, khong hop den)
 *   1. Nen: trung binh so don (khach den) va so phan mon theo THU x GIO, lay
 *      SO_TUAN tuan gan nhat CO DU LIEU.
 *   2. Mua vu: nhan he so thang = (don/ngay cua thang muc tieu) /
 *      (don/ngay cua cac thang trong cua so lich su), tinh tu toan bo lich su.
 *   3. Tai dong thoi: mot ban ngoi ~ thoi_gian_ngoi phut, nen so ban dang phuc
 *      vu luc h = den trong h + ((ngoi - 60) / 60) x den trong h-1.
 *   4. Nhan su = tran(dinh cua ca / nang suat), toi thieu 1 neu ca co khach:
 *        Phuc vu : ban dong thoi / ban_moi_phuc_vu
 *        Bep     : phan mon/gio (ca don giao) / phan_moi_dau_bep
 *        Thu ngan: don/gio / don_moi_thu_ngan
 *        Quay    : don/gio / don_moi_le_tan
 *   Chua tinh ngay le / su kien dac biet: quan ly tu cong them khi can.
 */
const db = require('../config/db');

const THAM_SO_MAC_DINH = {
  ban_moi_phuc_vu: 6,
  phan_moi_dau_bep: 40,
  don_moi_thu_ngan: 20,
  don_moi_le_tan: 25,
  thoi_gian_ngoi_phut: 90,
  so_tuan_lich_su: 8,
};
const NHAN_THAM_SO = {
  ban_moi_phuc_vu: 'Bàn đồng thời / 1 phục vụ',
  phan_moi_dau_bep: 'Phần món / giờ / 1 đầu bếp',
  don_moi_thu_ngan: 'Đơn / giờ / 1 thu ngân',
  don_moi_le_tan: 'Lượt khách / giờ / 1 lễ tân',
  thoi_gian_ngoi_phut: 'Thời gian ngồi bình quân (phút)',
  so_tuan_lich_su: 'Số tuần lịch sử',
};
const CHUC_VU_DU_BAO = ['Bep', 'Phuc vu', 'Quay', 'Thu ngan'];
const TEN_CHUC_VU = { Bep: 'Bếp', 'Phuc vu': 'Phục vụ', Quay: 'Lễ tân', 'Thu ngan': 'Thu ngân' };
const TEN_THU = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
/** Ngay co it hon so don nay khong tinh la "co du lieu" (vd. ngay chi co don kiem thu). */
const DON_TOI_THIEU_MOI_NGAY = 10;

const p2 = (n) => String(n).padStart(2, '0');
const ngayChuoi = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const congNgay = (s, n) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + n); return ngayChuoi(d); };
const gioCua = (t) => Number(String(t || '0').split(':')[0]) || 0;

async function docThamSo() {
  const ts = { ...THAM_SO_MAC_DINH };
  try {
    const [rows] = await db.query("SELECT khoa, gia_tri FROM cau_hinh WHERE khoa LIKE 'du_bao_ns.%'");
    for (const r of rows) {
      const k = r.khoa.slice('du_bao_ns.'.length);
      const v = Number(r.gia_tri);
      if (k in ts && Number.isFinite(v) && v > 0) ts[k] = v;
    }
  } catch (e) { /* bang cau_hinh chua co -> mac dinh */ }
  return ts;
}

async function luuThamSo(capNhat) {
  const ts = {};
  for (const k of Object.keys(THAM_SO_MAC_DINH)) {
    const v = Number(capNhat[k]);
    if (!Number.isFinite(v) || v <= 0) continue;
    const gt = k === 'so_tuan_lich_su' ? Math.min(26, Math.max(2, Math.round(v))) : Math.min(1000, v);
    ts[k] = gt;
    await db.query(
      `INSERT INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE gia_tri = VALUES(gia_tri)`,
      ['du_bao_ns.' + k, String(gt), NHAN_THAM_SO[k]]);
  }
  return ts;
}

/**
 * Tinh de xuat (HAM THUAN - khong doc CSDL, de kiem thu).
 *
 * @param {object} o
 * @param {number[][]} o.don   [thu][gio] so don AN TAI CHO den trong gio (trung binh / ngay)
 * @param {number[][]} o.phan  [thu][gio] so phan mon (ca don giao) trong gio
 * @param {{ma_ca, gio_bat_dau, gio_ket_thuc}[]} o.caList
 * @param {number} o.heSo  he so mua vu
 * @param {object} o.ts    tham so
 */
function tinhDeXuat({ don, phan, caList, heSo = 1, ts = THAM_SO_MAC_DINH }) {
  const keo = Math.max(0, (Number(ts.thoi_gian_ngoi_phut) - 60) / 60);
  const ketQua = {};
  for (let thu = 0; thu < 7; thu++) {
    ketQua[thu] = {};
    for (const ca of caList) {
      const tu = gioCua(ca.gio_bat_dau);
      const den = gioCua(ca.gio_ket_thuc);
      let dinhDon = 0, dinhBan = 0, dinhPhan = 0, tongDon = 0;
      for (let h = tu; h < den; h++) {
        const d = (don[thu][h] || 0) * heSo;
        const truoc = h > 0 ? (don[thu][h - 1] || 0) * heSo : 0;
        const ban = d + keo * truoc;
        const ph = (phan[thu][h] || 0) * heSo;
        dinhDon = Math.max(dinhDon, d);
        dinhBan = Math.max(dinhBan, ban);
        dinhPhan = Math.max(dinhPhan, ph);
        tongDon += d;
      }
      const coKhach = tongDon >= 0.5;
      const can = (gtri, nangSuat) => (coKhach ? Math.max(1, Math.ceil(gtri / nangSuat - 1e-9)) : 0);
      ketQua[thu][ca.ma_ca] = {
        tong_don: tongDon,
        dinh_don_gio: dinhDon,
        dinh_ban: dinhBan,
        dinh_phan_gio: dinhPhan,
        de_xuat: {
          'Phuc vu': can(dinhBan, ts.ban_moi_phuc_vu),
          Bep: coKhach || dinhPhan > 0 ? Math.max(1, Math.ceil(dinhPhan / ts.phan_moi_dau_bep - 1e-9)) : 0,
          'Thu ngan': can(dinhDon, ts.don_moi_thu_ngan),
          Quay: can(dinhDon, ts.don_moi_le_tan),
        },
      };
    }
  }
  return ketQua;
}

/** Ngay gan nhat (<= denNgay) co du don; cua so lich su ket thuc o day. */
async function ngayNeo(denNgay) {
  const [[r]] = await db.query(
    `SELECT MAX(ngay) AS ngay FROM (
       SELECT ngay_dat AS ngay FROM hopdong
        WHERE tinhtrang = 3 AND id_mon > 0 AND ngay_dat <= ?
        GROUP BY ngay_dat HAVING COUNT(DISTINCT sesis) >= ?) x`,
    [denNgay, DON_TOI_THIEU_MOI_NGAY]);
  return r && r.ngay ? ngayChuoi(new Date(r.ngay)) : null;
}

/** He so mua vu theo thang (1-12): don/ngay cua thang / don/ngay binh quan. */
async function heSoThang() {
  const [rows] = await db.query(
    `SELECT MONTH(ngay) AS th, COUNT(*) AS so_ngay, SUM(n) AS don FROM (
       SELECT ngay_dat AS ngay, COUNT(DISTINCT sesis) AS n FROM hopdong
        WHERE tinhtrang = 3 AND id_mon > 0
        GROUP BY ngay_dat HAVING n >= ?) x
     GROUP BY MONTH(ngay)`, [DON_TOI_THIEU_MOI_NGAY]);
  const moiNgay = {};
  let tong = 0, soNgay = 0;
  for (const r of rows) {
    moiNgay[r.th] = Number(r.don) / Number(r.so_ngay);
    tong += Number(r.don); soNgay += Number(r.so_ngay);
  }
  const tb = soNgay ? tong / soNgay : 0;
  const f = {};
  for (let m = 1; m <= 12; m++) f[m] = moiNgay[m] && tb ? moiNgay[m] / tb : null;
  return f;
}

/**
 * Du bao cho tuan bat dau `tuanBatDau` (thu Hai, YYYY-MM-DD).
 */
async function duBao({ tuanBatDau }) {
  const ts = await docThamSo();
  const [caList] = await db.query(
    'SELECT ma_ca, ten_ca, gio_bat_dau, gio_ket_thuc, thu_tu FROM ca_lam_viec WHERE trang_thai = 1 ORDER BY thu_tu');

  const neo = await ngayNeo(congNgay(tuanBatDau, -1));
  const rong = { don: [...Array(7)].map(() => Array(24).fill(0)), phan: [...Array(7)].map(() => Array(24).fill(0)) };
  if (!neo) {
    return { ts, caList, khongCoDuLieu: true, neo: null, de_xuat: tinhDeXuat({ ...rong, caList, ts }), ...rong, heSo: 1 };
  }
  const tu = congNgay(neo, -(7 * ts.so_tuan_lich_su) + 1);

  // So ngay CO DU LIEU cua tung thu trong cua so (mau so cua trung binh).
  const [ngayCo] = await db.query(
    `SELECT DAYOFWEEK(ngay_dat) - 1 AS thu, COUNT(*) AS so FROM (
       SELECT ngay_dat FROM hopdong WHERE tinhtrang = 3 AND id_mon > 0 AND ngay_dat BETWEEN ? AND ?
        GROUP BY ngay_dat HAVING COUNT(DISTINCT sesis) >= ?) x
     GROUP BY thu`, [tu, neo, DON_TOI_THIEU_MOI_NGAY]);
  const soNgay = Array(7).fill(0);
  for (const r of ngayCo) soNgay[Number(r.thu)] = Number(r.so);

  // Don den theo gio (an tai cho) va phan mon theo gio (ca giao hang - bep van nau).
  const [dong] = await db.query(
    `SELECT DAYOFWEEK(ngay_dat) - 1 AS thu, HOUR(gio_dat) AS gio,
            COUNT(DISTINCT CASE WHEN loai_don <> 'giao_hang' THEN sesis END) AS don,
            SUM(soluong) AS phan
       FROM hopdong
      WHERE tinhtrang = 3 AND id_mon > 0 AND soluong > 0 AND gio_dat IS NOT NULL
        AND ngay_dat BETWEEN ? AND ?
      GROUP BY thu, gio`, [tu, neo]);
  const don = rong.don, phan = rong.phan;
  for (const r of dong) {
    const n = soNgay[Number(r.thu)];
    if (!n) continue;
    don[r.thu][r.gio] = Number(r.don) / n;
    phan[r.thu][r.gio] = Number(r.phan) / n;
  }

  // He so mua vu: thang cua tuan muc tieu so voi cac thang trong cua so.
  const f = await heSoThang();
  const thangMucTieu = new Date(`${congNgay(tuanBatDau, 3)}T00:00:00`).getMonth() + 1;
  const thangCuaSo = new Date(`${congNgay(neo, -(7 * ts.so_tuan_lich_su) / 2)}T00:00:00`).getMonth() + 1;
  const heSo = f[thangMucTieu] && f[thangCuaSo] ? f[thangMucTieu] / f[thangCuaSo] : 1;

  return {
    ts, caList, neo, tu, heSo, thangMucTieu, don, phan, soNgay,
    de_xuat: tinhDeXuat({ don, phan, caList, heSo, ts }),
  };
}

/**
 * Ghi de xuat vao dinh_muc_ca cho cac chuc vu duoc chon; giu nguyen dong cua
 * chuc vu khac. Dung luuDinhMuc (ghi de ca bang trong mot giao dich).
 */
async function apDung(deXuat, chucVuChon) {
  const lich = require('./lichLamViecService');
  const chon = (chucVuChon || []).filter((c) => CHUC_VU_DU_BAO.includes(c));
  if (!chon.length) throw new Error('Chọn ít nhất một chức vụ để áp dụng.');
  const hienTai = await lich.dsDinhMuc();
  const ds = hienTai.filter((d) => !chon.includes(d.chucvu))
    .map((d) => ({ thu: d.thu, ma_ca: d.ma_ca, chucvu: d.chucvu, so_luong: d.so_luong }));
  for (const [thu, theoCa] of Object.entries(deXuat)) {
    for (const [maCa, o] of Object.entries(theoCa)) {
      for (const cv of chon) ds.push({ thu: Number(thu), ma_ca: maCa, chucvu: cv, so_luong: o.de_xuat[cv] || 0 });
    }
  }
  await lich.luuDinhMuc(ds);
  return { so_dong: ds.filter((d) => Number(d.so_luong) > 0).length };
}

module.exports = {
  THAM_SO_MAC_DINH, NHAN_THAM_SO, CHUC_VU_DU_BAO, TEN_CHUC_VU, TEN_THU,
  docThamSo, luuThamSo, tinhDeXuat, duBao, apDung, heSoThang,
};
