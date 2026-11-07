/**
 * TU DONG PHAN DON GIAO HANG - chia deu cho shipper.
 *
 * QUY TAC CHON NGUOI (theo thu tu uu tien, xem `xepHang`):
 *   0. Du dieu kien: trong ca (khong 'nghi'), con suc chua (dang cam < toi da),
 *      chua tung tu choi / bo lo don nay.
 *   1. TAI TRONG NGAY it nhat - so don (hoac tong phi ship, tuy cau hinh) da
 *      nhan hom nay. Day la tieu chi "chia deu".
 *   2. Dang cam it don hon (de don toi nhanh hon).
 *   3. Dang online (GPS moi) truoc nguoi mat tin hieu.
 *   4. Doi lau nhat ke tu lan duoc phan gan nhat - xoay vong khi bang tai.
 *   5. Gan nha hang hon (lay hang nhanh hon).
 *
 * XAC NHAN: don phan tu dong o trang thai cho shipper bam "Nhan don" trong N
 * phut. Tu choi / qua han -> go ra, ghi lai, phan cho nguoi KE TIEP (loai tru
 * nguoi vua tu choi). Don bi tu choi KHONG tinh vao tai cua nguoi do vi
 * `id_shipper` cua don da doi sang nguoi khac.
 *
 * HANG CHO: khong ai du dieu kien -> don nam o 'cho_phan'. Phan lai khi co
 * nguoi giao xong / vao ca (goi `phanHangCho`), va tac vu nen moi 30 giay.
 *
 * DONG THOI: moi lan chon + phan nam trong GET_LOCK cua MySQL - hai don toi
 * cung mot giay khong the cung nhet vao suat cuoi cung cua mot shipper.
 */
const db = require('../config/db');
const vc = require('./vanChuyenService');
const realtime = require('./realtime');

const KHOA = 'phan_cong_giao_hang';
const HE_THONG = { id_nv: null, ten: 'Hệ thống (tự động)' };

async function thamSo() {
  const [rows] = await db.query("SELECT khoa, gia_tri FROM cau_hinh WHERE khoa LIKE 'giao_hang.%'");
  const c = Object.fromEntries(rows.map((r) => [r.khoa, r.gia_tri]));
  return {
    tu_dong: c['giao_hang.tu_dong_phan'] !== '0',
    tieu_chi: c['giao_hang.tieu_chi_chia'] === 'thu_nhap' ? 'thu_nhap' : 'so_don',
    phut_xac_nhan: Math.min(30, Math.max(1, Number(c['giao_hang.phut_cho_xac_nhan']) || 3)),
    phut_mat_tin_hieu: Math.max(2, Number(c['giao_hang.phut_mat_tin_hieu']) || 10),
    chi_trong_khu_vuc: c['giao_hang.chi_trong_khu_vuc'] !== '0',
  };
}

async function luuThamSo(d) {
  const ghi = [];
  if (d.tu_dong !== undefined) ghi.push(['giao_hang.tu_dong_phan', d.tu_dong ? '1' : '0']);
  if (d.chi_trong_khu_vuc !== undefined) ghi.push(['giao_hang.chi_trong_khu_vuc', d.chi_trong_khu_vuc ? '1' : '0']);
  if (['so_don', 'thu_nhap'].includes(d.tieu_chi)) ghi.push(['giao_hang.tieu_chi_chia', d.tieu_chi]);
  if (Number(d.phut_xac_nhan) >= 1) ghi.push(['giao_hang.phut_cho_xac_nhan', String(Math.min(30, Math.round(d.phut_xac_nhan)))]);
  for (const [k, v] of ghi) {
    await db.query('INSERT INTO cau_hinh (khoa, gia_tri) VALUES (?, ?) ON DUPLICATE KEY UPDATE gia_tri = VALUES(gia_tri)', [k, v]);
  }
}

// ------------------------------------------------------------------ bang cong bang

/**
 * Tinh hinh moi shipper hom nay - dung cho ca thuat toan lan man hinh.
 * `tai` = so don hoac tong phi, tuy tieu chi.
 */
async function bangShipper(ts) {
  ts = ts || await thamSo();
  const [rows] = await db.query(`
    SELECT s.id_shipper, COALESCE(nv.ten, s.ten) AS ten, s.sdt, s.trang_thai, s.so_don_toi_da, s.loai_xe, s.bien_so,
           (SELECT COUNT(*) FROM don_giao_hang g WHERE g.id_shipper = s.id_shipper
              AND g.trang_thai IN ('da_phan','dang_lay','dang_giao')) AS dang_cam,
           (SELECT COUNT(*) FROM don_giao_hang g WHERE g.id_shipper = s.id_shipper
              AND g.trang_thai <> 'huy' AND DATE(g.phan_luc) = CURDATE()) AS don_hom_nay,
           (SELECT COUNT(*) FROM don_giao_hang g WHERE g.id_shipper = s.id_shipper
              AND g.trang_thai = 'da_giao' AND DATE(g.hoan_tat_luc) = CURDATE()) AS da_giao_hom_nay,
           (SELECT COALESCE(SUM(g.phi_giao),0) FROM don_giao_hang g WHERE g.id_shipper = s.id_shipper
              AND g.trang_thai <> 'huy' AND DATE(g.phan_luc) = CURDATE()) AS phi_hom_nay,
           (SELECT MAX(g.phan_luc) FROM don_giao_hang g WHERE g.id_shipper = s.id_shipper) AS phan_gan_nhat,
           (SELECT COUNT(*) FROM phan_cong_giao p WHERE p.id_shipper = s.id_shipper
              AND p.ket_qua = 'tu_choi' AND DATE(p.tao_luc) = CURDATE()) AS tu_choi_hom_nay,
           (SELECT COUNT(*) FROM phan_cong_giao p WHERE p.id_shipper = s.id_shipper
              AND p.ket_qua = 'het_han' AND DATE(p.tao_luc) = CURDATE()) AS het_han_hom_nay,
           v.vi_do, v.kinh_do, TIMESTAMPDIFF(MINUTE, v.luc, NOW()) AS phut_gps
      FROM shipper s
      JOIN don_vi_van_chuyen dv ON dv.id_dv = s.id_dv AND dv.loai = 'noi_bo' AND dv.trang_thai = 1
      LEFT JOIN nhan_vien nv ON nv.id_nv = s.id_nv
      LEFT JOIN vi_tri_shipper_moi_nhat v ON v.id_shipper = s.id_shipper
     ORDER BY s.id_shipper`);
  const goc = await vc.toaDoNhaHang();
  return rows.map((r) => {
    const n = (x) => Number(x) || 0;
    const online = r.phut_gps != null && n(r.phut_gps) <= ts.phut_mat_tin_hieu;
    const kmNH = goc && r.vi_do != null ? vc.khoangCachKm(goc.vi_do, goc.kinh_do, r.vi_do, r.kinh_do) : null;
    return {
      ...r,
      ten: String(r.ten || '').trim(),
      dang_cam: n(r.dang_cam), don_hom_nay: n(r.don_hom_nay), da_giao_hom_nay: n(r.da_giao_hom_nay),
      phi_hom_nay: n(r.phi_hom_nay), tu_choi_hom_nay: n(r.tu_choi_hom_nay), het_han_hom_nay: n(r.het_han_hom_nay),
      so_don_toi_da: n(r.so_don_toi_da),
      trong_ca: r.trang_thai !== 'nghi',
      con_suc_chua: n(r.dang_cam) < n(r.so_don_toi_da),
      online, km_toi_nha_hang: kmNH,
      tai: ts.tieu_chi === 'thu_nhap' ? n(r.phi_hom_nay) : n(r.don_hom_nay),
    };
  });
}

/** Sap xep ung vien theo quy tac o dau file. Tra ve [] neu khong ai du dieu kien. */
function xepHang(ds, loaiTru = new Set()) {
  return ds
    .filter((s) => s.trong_ca && s.con_suc_chua && !loaiTru.has(Number(s.id_shipper)))
    .sort((a, b) =>
      a.tai - b.tai ||
      a.dang_cam - b.dang_cam ||
      Number(b.online) - Number(a.online) ||
      (a.phan_gan_nhat ? new Date(a.phan_gan_nhat).getTime() : 0) - (b.phan_gan_nhat ? new Date(b.phan_gan_nhat).getTime() : 0) ||
      (a.km_toi_nha_hang ?? 99) - (b.km_toi_nha_hang ?? 99) ||
      a.id_shipper - b.id_shipper);
}

function lyDoChon(s, ts, soUngVien) {
  const p = [
    ts.tieu_chi === 'thu_nhap'
      ? `ít phí ship nhất hôm nay (${Math.round(s.phi_hom_nay).toLocaleString('vi-VN')}đ)`
      : `ít đơn nhất hôm nay (${s.don_hom_nay} đơn)`,
    s.dang_cam ? `đang cầm ${s.dang_cam}/${s.so_don_toi_da}` : 'đang rảnh',
    s.online ? 'đang online' : 'chưa có GPS gần đây',
  ];
  if (s.km_toi_nha_hang != null) p.push(`cách nhà hàng ${s.km_toi_nha_hang} km`);
  return `Chọn trong ${soUngVien} người: ${p.join(' · ')}`.slice(0, 300);
}

async function nguoiDaLoaiTru(idGiao) {
  const [r] = await db.query("SELECT DISTINCT id_shipper FROM phan_cong_giao WHERE id_giao = ? AND ket_qua IN ('tu_choi','het_han')", [idGiao]);
  return new Set(r.map((x) => Number(x.id_shipper)));
}

async function voiKhoa(fn) {
  const conn = await db.getConnection();
  try {
    const [[k]] = await conn.query('SELECT GET_LOCK(?, 10) AS ok', [KHOA]);
    if (!k || Number(k.ok) !== 1) return null;
    try { return await fn(); } finally { await conn.query('SELECT RELEASE_LOCK(?)', [KHOA]); }
  } finally {
    conn.release();
  }
}

function baoDoi(don) {
  try {
    realtime.doi(realtime.MIEN.GIAO_HANG, { duong_dan: '/staff/giao-hang' });
    if (don) realtime.donGiaoDoi({ ...don, nhan: don.tt ? don.tt.nhan : null });
  } catch (_) { /* realtime chua san sang (chay tu script) */ }
}

// ------------------------------------------------------------------ phan don

/**
 * Tu dong phan MOT don dang 'cho_phan'.
 * @returns {Promise<{phan: boolean, id_shipper?, ten?, ly_do}>}
 */
async function tuDongPhan(idGiao, { batBuoc = false } = {}) {
  const ts = await thamSo();
  if (!ts.tu_dong && !batBuoc) return { phan: false, ly_do: 'Đang tắt tự động phân đơn.' };
  return voiKhoa(async () => {
    const [[don]] = await db.query('SELECT id_giao, trang_thai, id_shipper FROM don_giao_hang WHERE id_giao = ?', [idGiao]);
    if (!don) return { phan: false, ly_do: 'Không tìm thấy đơn.' };
    if (don.trang_thai !== 'cho_phan' || don.id_shipper) return { phan: false, ly_do: 'Đơn đã có người nhận.' };

    const ds = await bangShipper(ts);
    const ung = xepHang(ds, await nguoiDaLoaiTru(idGiao));
    if (!ung.length) return { phan: false, ly_do: 'Không có shipper nào rảnh – đơn vào hàng chờ.' };

    const chon = ung[0];
    const lyDo = lyDoChon(chon, ts, ung.length);
    await vc.phanShipper(idGiao, chon.id_shipper, HE_THONG);
    await db.query('UPDATE don_giao_hang SET phan_tu_dong = 1, xac_nhan_luc = NULL WHERE id_giao = ?', [idGiao]);
    await db.query(
      "INSERT INTO phan_cong_giao (id_giao, id_shipper, kieu, ket_qua, ly_do_chon, tao_luc) VALUES (?, ?, 'tu_dong', 'cho_xac_nhan', ?, NOW())",
      [idGiao, chon.id_shipper, lyDo]);
    baoDoi(await vc.donGiao(idGiao));
    return { phan: true, id_shipper: chon.id_shipper, ten: chon.ten, ly_do: lyDo };
  }).then((kq) => kq || { phan: false, ly_do: 'Hệ thống đang bận phân đơn khác.' });
}

/** Phan lan luot moi don dang cho (cu nhat truoc). */
async function phanHangCho() {
  const ts = await thamSo();
  if (!ts.tu_dong) return { da_phan: 0 };
  const [cho] = await db.query("SELECT id_giao FROM don_giao_hang WHERE trang_thai = 'cho_phan' AND id_shipper IS NULL ORDER BY tao_luc LIMIT 50");
  let daPhan = 0;
  for (const d of cho) {
    const kq = await tuDongPhan(d.id_giao);
    if (kq.phan) daPhan++;
    else if (/Không có shipper/.test(kq.ly_do)) break; // het nguoi ranh, dung som
  }
  return { da_phan: daPhan, con_cho: cho.length - daPhan };
}

/** Ghi lai mot lan phan TAY cua dieu phoi (de bang cong bang va nhat ky day du). */
async function ghiPhanTay(idGiao, idShipper) {
  await db.query(
    "UPDATE phan_cong_giao SET ket_qua = 'bi_go', ly_do_ket_thuc = 'Điều phối phân lại bằng tay', phan_hoi_luc = NOW() WHERE id_giao = ? AND ket_qua = 'cho_xac_nhan'",
    [idGiao]);
  await db.query(
    "INSERT INTO phan_cong_giao (id_giao, id_shipper, kieu, ket_qua, ly_do_chon, tao_luc, phan_hoi_luc) VALUES (?, ?, 'thu_cong', 'da_nhan', 'Điều phối chọn trực tiếp', NOW(), NOW())",
    [idGiao, idShipper]);
  await db.query('UPDATE don_giao_hang SET phan_tu_dong = 0, xac_nhan_luc = NOW() WHERE id_giao = ?', [idGiao]);
}

// ------------------------------------------------------------------ phan hoi cua shipper

async function donCuaShipperChoXacNhan(idGiao, idShipper) {
  const [[d]] = await db.query('SELECT * FROM don_giao_hang WHERE id_giao = ?', [idGiao]);
  if (!d) throw new Error('Không tìm thấy đơn.');
  if (Number(d.id_shipper) !== Number(idShipper)) throw new Error('Đơn này không còn là của bạn (có thể đã quá thời gian xác nhận).');
  if (d.trang_thai !== 'da_phan') throw new Error('Đơn đã bắt đầu giao, không nhận / từ chối được nữa.');
  return d;
}

async function xacNhan(idGiao, idShipper) {
  const d = await donCuaShipperChoXacNhan(idGiao, idShipper);
  if (d.xac_nhan_luc) return { ok: true };
  await db.query('UPDATE don_giao_hang SET xac_nhan_luc = NOW() WHERE id_giao = ?', [idGiao]);
  await db.query(
    "UPDATE phan_cong_giao SET ket_qua = 'da_nhan', phan_hoi_luc = NOW() WHERE id_giao = ? AND id_shipper = ? AND ket_qua = 'cho_xac_nhan'",
    [idGiao, idShipper]);
  await db.query(
    "INSERT INTO nhat_ky_giao_hang (id_giao, tu_trang_thai, den_trang_thai, ten_nguoi, ghi_chu) VALUES (?, 'da_phan', 'da_phan', 'Shipper', 'Shipper đã xác nhận nhận đơn')",
    [idGiao]);
  baoDoi(await vc.donGiao(idGiao));
  return { ok: true };
}

async function tuChoi(idGiao, idShipper, lyDo, nguoi = {}) {
  const d = await donCuaShipperChoXacNhan(idGiao, idShipper);
  if (d.xac_nhan_luc) throw new Error('Bạn đã nhận đơn này – muốn trả đơn hãy gọi điều phối.');
  const ly = String(lyDo || '').trim() || 'Không ghi lý do';
  await db.query(
    "UPDATE phan_cong_giao SET ket_qua = 'tu_choi', ly_do_ket_thuc = ?, phan_hoi_luc = NOW() WHERE id_giao = ? AND id_shipper = ? AND ket_qua = 'cho_xac_nhan'",
    [ly.slice(0, 300), idGiao, idShipper]);
  await vc.goShipper(idGiao, nguoi, `Shipper từ chối: ${ly}`);
  const kq = await tuDongPhan(idGiao, { batBuoc: true });
  baoDoi(await vc.donGiao(idGiao));
  return kq;
}

/** Don phan tu dong qua han chua xac nhan -> chuyen nguoi khac. */
async function quetHetHan() {
  const ts = await thamSo();
  const [qua] = await db.query(`
    SELECT id_giao, id_shipper FROM don_giao_hang
     WHERE trang_thai = 'da_phan' AND phan_tu_dong = 1 AND xac_nhan_luc IS NULL
       AND phan_luc < NOW() - INTERVAL ? MINUTE`, [ts.phut_xac_nhan]);
  for (const d of qua) {
    await db.query(
      "UPDATE phan_cong_giao SET ket_qua = 'het_han', ly_do_ket_thuc = ?, phan_hoi_luc = NOW() WHERE id_giao = ? AND id_shipper = ? AND ket_qua = 'cho_xac_nhan'",
      [`Quá ${ts.phut_xac_nhan} phút không xác nhận`, d.id_giao, d.id_shipper]);
    await vc.goShipper(d.id_giao, HE_THONG, `Quá ${ts.phut_xac_nhan} phút không xác nhận`).catch(() => {});
    await tuDongPhan(d.id_giao, { batBuoc: true });
  }
  return qua.length;
}

// ------------------------------------------------------------------ man hinh dieu phoi

async function nhatKyHomNay(gioiHan = 60) {
  const [rows] = await db.query(`
    SELECT p.*, g.ma_giao, g.dia_chi_giao, g.ma_khu_vuc, COALESCE(nv.ten, s.ten) AS ten_shipper
      FROM phan_cong_giao p
      JOIN don_giao_hang g ON g.id_giao = p.id_giao
      JOIN shipper s ON s.id_shipper = p.id_shipper
      LEFT JOIN nhan_vien nv ON nv.id_nv = s.id_nv
     WHERE DATE(p.tao_luc) = CURDATE()
     ORDER BY p.tao_luc DESC LIMIT ?`, [gioiHan]);
  return rows;
}

async function tongQuan() {
  const ts = await thamSo();
  const [bang, [[dem]], nhatKy] = await Promise.all([
    bangShipper(ts),
    db.query(`SELECT SUM(trang_thai = 'cho_phan') AS cho_phan,
                     SUM(trang_thai = 'da_phan' AND phan_tu_dong = 1 AND xac_nhan_luc IS NULL) AS cho_xac_nhan,
                     SUM(trang_thai IN ('da_phan','dang_lay','dang_giao')) AS dang_chay
                FROM don_giao_hang WHERE trang_thai NOT IN ('da_giao','huy')`),
    nhatKyHomNay(),
  ]);
  const trongCa = bang.filter((s) => s.trong_ca);
  const tai = trongCa.map((s) => s.tai);
  return {
    ts, bang,
    cho_phan: Number(dem.cho_phan) || 0, cho_xac_nhan: Number(dem.cho_xac_nhan) || 0, dang_chay: Number(dem.dang_chay) || 0,
    chenh_lech: tai.length ? Math.max(...tai) - Math.min(...tai) : 0,
    thu_tu_tiep: xepHang(bang).map((s) => s.id_shipper),
    nhat_ky: nhatKy,
  };
}

// ------------------------------------------------------------------ tac vu nen

let henGio = null;
function batDau() {
  if (henGio) return;
  henGio = setInterval(async () => {
    try {
      await quetHetHan();
      await phanHangCho();
    } catch (e) {
      console.error('[phan-cong-giao] tác vụ nền lỗi:', e.message);
    }
  }, 30000);
  if (henGio.unref) henGio.unref();
}

module.exports = {
  thamSo, luuThamSo, bangShipper, xepHang, tuDongPhan, phanHangCho, ghiPhanTay,
  xacNhan, tuChoi, quetHetHan, tongQuan, batDau,
};
