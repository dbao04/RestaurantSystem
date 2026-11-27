/**
 * CHINH SACH GIAO HANG - noi DUY NHAT quyet dinh ba cau hoi tien bac cua don giao:
 *
 *   1. Phi ship bao nhieu?          -> tinhPhiDonVi()   (bac thang, cang xa don gia/km cang giam)
 *   2. Khi nao don duoc nau / giao? -> sauKhiThanhToan() (phai tra truoc 100% mon + ship)
 *   3. Huy thi ai chiu?             -> huyDon() / sauKhiHuy() / hoanDiem()
 *
 * Nguyen tac huy:
 *   - LOI DO KHACH (doi y, khong nghe may, sai dia chi, tu choi nhan, qua han
 *     thanh toan): KHONG hoan tien, KHONG hoan diem. Diem da dung cho don cung
 *     khong tra lai.
 *   - LOI DO NHA HANG (het mon, bep qua tai, khong co shipper, shipper su co,
 *     giao tre, sai/thieu mon...): KHONG hoan tien mat, ma HOAN DIEM 100% so
 *     tien khach da tra (mon + ship), cong lai diem khach da dung. Diem dung
 *     duoc cho don giao lan sau hoac tru vao hoa don khi an tai nha hang.
 *
 * Moi lan hoan diem ghi mot dong `hoan_diem_giao_hang` - tra loi duoc "khach
 * nay da duoc den bu bao nhieu cho don nao, ai duyet".
 */
const db = require('../config/db');
const loyaltyService = require('./loyaltyService');

/* ========================================================================== */
/* DANH MUC LY DO HUY                                                          */
/* ========================================================================== */

const LY_DO_HUY = {
  // ---- Loi do khach: khong hoan ----
  khach_doi_y:          { ben_loi: 'khach', nhan: 'Khách đổi ý / tự hủy đơn' },
  khach_khong_nghe_may: { ben_loi: 'khach', nhan: 'Không liên lạc được người nhận' },
  sai_dia_chi:          { ben_loi: 'khach', nhan: 'Khách cung cấp sai địa chỉ / số điện thoại' },
  khach_tu_choi_nhan:   { ben_loi: 'khach', nhan: 'Khách từ chối nhận hàng (món đúng và đủ)' },
  qua_han_thanh_toan:   { ben_loi: 'khach', nhan: 'Quá hạn thanh toán', heThong: true },
  // ---- Loi do nha hang: hoan diem ----
  het_mon:              { ben_loi: 'nha_hang', nhan: 'Nhà hàng hết món / hết nguyên liệu' },
  bep_qua_tai:          { ben_loi: 'nha_hang', nhan: 'Bếp quá tải, không kịp chế biến' },
  khong_co_shipper:     { ben_loi: 'nha_hang', nhan: 'Không có shipper nhận đơn' },
  shipper_su_co:        { ben_loi: 'nha_hang', nhan: 'Shipper gặp sự cố (hỏng xe, tai nạn...)' },
  giao_tre:             { ben_loi: 'nha_hang', nhan: 'Giao trễ quá thời gian cam kết' },
  sai_thieu_mon:        { ben_loi: 'nha_hang', nhan: 'Giao sai / thiếu món, món bị đổ vỡ, hư hỏng' },
  nha_hang_ngung:       { ben_loi: 'nha_hang', nhan: 'Nhà hàng tạm ngưng phục vụ đột xuất' },
};

/** Trang thai ma KHACH con tu huy duoc (truoc khi shipper toi lay hang). */
const KHACH_HUY_DUOC = ['cho_thanh_toan', 'cho_phan', 'da_phan'];

const MAC_DINH_BAC = [{ tu_km: 5, he_so: 0.8 }, { tu_km: 8, he_so: 0.6 }];

/* ========================================================================== */
/* CAU HINH                                                                    */
/* ========================================================================== */

let _cache = null;
let _cacheLuc = 0;

function soTrong(v, macDinh, min, max) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v !== null && v !== '' ? Math.min(max, Math.max(min, n)) : macDinh;
}

async function docThamSo() {
  if (_cache && Date.now() - _cacheLuc < 30000) return _cache;
  const [rows] = await db.query(
    `SELECT khoa, gia_tri FROM cau_hinh WHERE khoa IN
       ('giao_hang.bac_giam_km','giao_hang.phut_giu_thanh_toan','giao_hang.ty_le_hoan_diem','giao_hang.mien_phi_tu',
        'giao_hang.phut_ngung_truoc_dong','giao_hang.so_ngay_hen_toi_da','giao_hang.phut_len_bep_truoc',
        'giao_hang.phut_canh_bao_cho_shipper','giao_hang.phut_tu_huy_cho_shipper')`
  );
  const c = Object.fromEntries(rows.map((r) => [r.khoa, r.gia_tri]));
  let bac = MAC_DINH_BAC;
  try {
    const p = JSON.parse(c['giao_hang.bac_giam_km'] || 'null');
    if (Array.isArray(p)) {
      bac = p.map((b) => ({ tu_km: Number(b.tu_km), he_so: Number(b.he_so) }))
        .filter((b) => b.tu_km > 0 && b.he_so > 0 && b.he_so <= 1)
        .sort((a, b) => a.tu_km - b.tu_km);
    }
  } catch (e) { /* JSON hong -> dung mac dinh */ }

  const tt = await require('./thanhToanService').layCauHinh();
  _cache = {
    bac_giam_km: bac,
    phut_giu_thanh_toan: Math.max(5, Number(c['giao_hang.phut_giu_thanh_toan']) || 15),
    ty_le_hoan_diem: Math.min(100, Math.max(0, Number(c['giao_hang.ty_le_hoan_diem'] ?? 100))),
    mien_phi_tu: Number(c['giao_hang.mien_phi_tu']) || 0,
    // Rang buoc thoi gian don giao (quan ly doi trong cau_hinh):
    phut_ngung_truoc_dong: soTrong(c['giao_hang.phut_ngung_truoc_dong'], 45, 0, 240),       // ngung nhan don truoc gio dong cua
    so_ngay_hen_toi_da: soTrong(c['giao_hang.so_ngay_hen_toi_da'], 3, 0, 30),             // hen giao xa nhat
    phut_len_bep_truoc: soTrong(c['giao_hang.phut_len_bep_truoc'], 60, 15, 240),          // don hen gio: len bep / phan shipper truoc gio hen
    phut_canh_bao_cho_shipper: soTrong(c['giao_hang.phut_canh_bao_cho_shipper'], 10, 1, 120),
    phut_tu_huy_cho_shipper: soTrong(c['giao_hang.phut_tu_huy_cho_shipper'], 20, 2, 240),
    gia_tri_1_diem: Number(tt.gia_tri_1_diem) || 1000,
    toi_da_diem_moi_don: Number(tt.toi_da_diem_moi_don) || 50,
  };
  _cacheLuc = Date.now();
  return _cache;
}

function xoaCache() { _cache = null; }

/* ========================================================================== */
/* 1. PHI SHIP BAC THANG                                                       */
/* ========================================================================== */

/**
 * Phi ship cua MOT don vi cho quang duong `km`, kem bang chi tiet tung chang.
 *
 * Cach tinh (vi du doi nha: 15.000d cho 2 km dau, 5.000d/km, bac giam 5km x0.8,
 * 8km x0.6):
 *   - `so_km_dau` km dau: tron goi `phi_co_ban`.
 *   - Phan vuot lam tron len tung 0,5 km.
 *   - Tu so_km_dau den bac 1: phi_moi_km.  Tu bac 1: phi_moi_km x he_so ...
 *   - Tong lam tron len bội 1.000d cho de doc.
 *
 * Vi du 6,3 km -> tinh 6,5 km: 15.000 + 3 x 5.000 + 1,5 x 4.000 = 36.000d.
 */
function tinhPhiDonVi(km, dv, bac = MAC_DINH_BAC) {
  const kmDau = Number(dv.so_km_dau) || 0;
  const phiCoBan = Number(dv.phi_co_ban) || 0;
  const giaKm = Number(dv.phi_moi_km) || 0;
  const kmTinh = kmDau + Math.ceil(Math.max(0, Number(km) - kmDau) * 2) / 2;

  const chiTiet = [{
    nhan: kmDau > 0 ? `${kmDau} km đầu (trọn gói)` : 'Phí mở chuyến',
    // loai/tu/den de khu khach tu dung nhan theo ngon ngu (xem views/cart.ejs).
    loai: kmDau > 0 ? 'km_dau' : 'mo_chuyen', tu: 0, den: kmDau,
    so_km: kmDau, don_gia: null, tien: phiCoBan,
  }];

  // Cac moc doi don gia, chi lay moc nam SAU so_km_dau.
  const moc = [{ tu_km: kmDau, he_so: 1 }, ...bac.filter((b) => b.tu_km > kmDau)];
  let tong = phiCoBan;
  for (let i = 0; i < moc.length; i++) {
    const tu = moc[i].tu_km;
    const den = i + 1 < moc.length ? moc[i + 1].tu_km : Infinity;
    const soKm = Math.max(0, Math.min(kmTinh, den) - tu);
    if (soKm <= 0) continue;
    const donGia = Math.round(giaKm * moc[i].he_so);
    const tien = soKm * donGia;
    tong += tien;
    chiTiet.push({
      nhan: den === Infinity ? `Từ km ${tu} trở đi` : `Km ${tu} – ${den}`,
      loai: den === Infinity ? 'tu_km' : 'khoang', tu, den: den === Infinity ? null : den,
      so_km: soKm, don_gia: donGia, tien,
      giam_phan_tram: Math.round((1 - moc[i].he_so) * 100),
    });
  }
  return { phi: Math.ceil(tong / 1000) * 1000, km_tinh_phi: kmTinh, chi_tiet: chiTiet };
}

/** Bang gia mau 1/3/5/8/10 km cho trang chinh sach. */
async function bangGiaMau(dsDv) {
  const ts = await docThamSo();
  const moc = [1, 2, 3, 5, 7, 10];
  return dsDv.map((dv) => ({
    ten_dv: dv.ten_dv,
    ban_kinh_km: Number(dv.ban_kinh_km),
    phi_co_ban: Number(dv.phi_co_ban),
    so_km_dau: Number(dv.so_km_dau),
    phi_moi_km: Number(dv.phi_moi_km),
    bac: [{ tu_km: Number(dv.so_km_dau), he_so: 1 }, ...ts.bac_giam_km.filter((b) => b.tu_km > Number(dv.so_km_dau))]
      .map((b) => ({ tu_km: b.tu_km, don_gia: Math.round(Number(dv.phi_moi_km) * b.he_so), giam: Math.round((1 - b.he_so) * 100) })),
    vi_du: moc.filter((k) => k <= Number(dv.ban_kinh_km)).map((k) => ({ km: k, phi: tinhPhiDonVi(k, dv, ts.bac_giam_km).phi })),
  }));
}

/* ========================================================================== */
/* 2. THANH TOAN TRUOC                                                         */
/* ========================================================================== */

/** Tong tien that su khach da chuyen (khong tinh phan tru bang diem / ma giam). */
async function tienDaTra(sesis) {
  const [[r]] = await db.query(
    `SELECT COALESCE(SUM(amount),0) AS tien, COALESCE(SUM(loyalty_points_used),0) AS diem
       FROM payments WHERE sesis = ? AND status = 'success' AND loai = 'thanh_toan'`, [sesis]
  );
  return { tien: Number(r.tien) || 0, diem: Number(r.diem) || 0 };
}

/**
 * Goi sau MOI phien thanh toan thanh cong cua mot sesis (tu hauKyThanhToan, nen
 * ca webhook ngan hang, thu ngan xac nhan tay va gia lap deu di qua day).
 *
 * Du tien -> don roi 'cho_thanh_toan' sang 'cho_phan': bep bat dau nau, he
 * thong tu phan shipper. Tien ve SAU khi don da tu huy vi qua han -> khach da
 * mat tien ma khong co mon: coi la phia nha hang giu tien, hoan diem du.
 */
async function sauKhiThanhToan(sesis, conPhaiTra) {
  const [[don]] = await db.query('SELECT * FROM don_giao_hang WHERE sesis = ? LIMIT 1', [sesis]);
  if (!don) return null;
  const daTra = await tienDaTra(sesis);
  await db.query('UPDATE don_giao_hang SET da_thanh_toan = ?, tien_thu_ho = 0 WHERE id_giao = ?', [daTra.tien, don.id_giao]);

  if (don.trang_thai === 'cho_thanh_toan' && conPhaiTra <= 0) {
    const vc = require('./vanChuyenService');
    await db.query(
      "UPDATE don_giao_hang SET trang_thai = 'cho_phan', han_thanh_toan = NULL, cho_phan_luc = NOW() WHERE id_giao = ? AND trang_thai = 'cho_thanh_toan'",
      [don.id_giao]
    );
    // Xac nhan don goc de bep (KDS) bat dau nau.
    await db.query('UPDATE hopdong SET tinhtrang = 1 WHERE sesis = ? AND tinhtrang = 0', [sesis]);
    await damBaoCotThoiGian();
    await vc.ghiNhatKy(don.id_giao, 'cho_thanh_toan', 'cho_phan', { ten: 'Hệ thống' },
      `Khách đã thanh toán đủ ${daTra.tien.toLocaleString('vi-VN')}đ — chuyển xuống bếp`);
    setImmediate(() => require('./phanCongGiaoService').tuDongPhan(don.id_giao).catch(() => {}));
    baoThayDoi();
    return 'da_xac_nhan';
  }

  if (don.trang_thai === 'huy' && don.ma_ly_do === 'qua_han_thanh_toan') {
    // Tien toi tre: hoan diem phan vua nhan.
    const daHoan = await tongDaHoan(don.id_giao);
    const conLai = daTra.tien - daHoan;
    if (conLai > 0) {
      await ghiHoanDiem(don, {
        loai: 'toan_phan', soTien: conLai, ma_ly_do: 'qua_han_thanh_toan',
        ly_do: 'Tiền chuyển khoản về sau khi đơn đã tự hủy vì quá hạn — hoàn điểm',
        nguoi: { ten: 'Hệ thống' },
      });
    }
    return 'hoan_diem_tre';
  }
  return null;
}

/* ========================================================================== */
/* 3. HUY DON + HOAN DIEM                                                      */
/* ========================================================================== */

async function tongDaHoan(idGiao) {
  const [[r]] = await db.query('SELECT COALESCE(SUM(so_tien),0) AS t FROM hoan_diem_giao_hang WHERE id_giao = ?', [idGiao]);
  return Number(r.t) || 0;
}

/**
 * Ghi mot lan hoan diem: cong diem vao vi khach + dong nhat ky.
 * soTien la gia tri DEN BU tinh bang tien; so diem = soTien x ty_le / gia_tri_1_diem.
 */
async function ghiHoanDiem(don, { loai, soTien, ma_ly_do, ly_do, nguoi = {} }) {
  const ts = await docThamSo();
  const [[hd]] = await db.query('SELECT id_user FROM hopdong WHERE sesis = ? LIMIT 1', [don.sesis]);
  if (!hd || !hd.id_user) throw new Error('Đơn không gắn với tài khoản khách nên không hoàn điểm được.');

  const soDiem = Math.ceil((Number(soTien) * ts.ty_le_hoan_diem / 100) / ts.gia_tri_1_diem);
  if (soDiem <= 0) return 0;

  await loyaltyService.addPoints(hd.id_user, soDiem,
    `Hoàn điểm đơn giao ${don.ma_giao}: ${ly_do || (LY_DO_HUY[ma_ly_do] || {}).nhan || 'lỗi nhà hàng'}`, don.sesis);
  await db.query(
    `INSERT INTO hoan_diem_giao_hang (id_giao, sesis, id_kh, loai, so_tien, so_diem, ma_ly_do, ly_do, id_nv, ten_nguoi)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [don.id_giao, don.sesis, hd.id_user, loai, Math.round(soTien), soDiem, ma_ly_do || null,
     ly_do || null, nguoi.id_nv || null, nguoi.ten || null]
  );
  await db.query('UPDATE don_giao_hang SET diem_hoan = diem_hoan + ? WHERE id_giao = ?', [soDiem, don.id_giao]);
  return soDiem;
}

/**
 * Thu hoi diem da TICH tu don nay (don khong hoan thanh thi khong duoc tich).
 * Khach da tieu bot diem thi chi thu duoc toi so dang co.
 */
async function thuHoiDiemTich(sesis, idKh) {
  const [[r]] = await db.query(
    `SELECT COALESCE(SUM(points),0) AS d FROM loyalty_transactions
      WHERE id_kh = ? AND sesis = ? AND type = 'earn' AND description LIKE 'Tích điểm%'`, [idKh, sesis]
  );
  const [[v]] = await db.query('SELECT points FROM loyalty_points WHERE id_kh = ?', [idKh]);
  const thu = Math.min(Number(r.d) || 0, Number(v && v.points) || 0);
  if (thu > 0) await loyaltyService.redeemPoints(idKh, thu, `Thu hồi điểm tích của đơn đã hủy ${sesis}`, sesis);
  return thu;
}

/**
 * Hau ky khi don chuyen sang 'huy' - goi tu vanChuyenService.doiTrangThai.
 * Tra ve { ben_loi, diem_hoan } de man hinh bao cho nguoi bam.
 */
async function sauKhiHuy(idGiao, nguoi = {}) {
  const [[don]] = await db.query('SELECT * FROM don_giao_hang WHERE id_giao = ?', [idGiao]);
  if (!don) return null;
  const lyDo = LY_DO_HUY[don.ma_ly_do] || null;

  // Don goc: huy (4) de bep, thu ngan, bao cao deu biet.
  await db.query('UPDATE hopdong SET tinhtrang = 4 WHERE sesis = ? AND tinhtrang <> 3', [don.sesis]);
  // Phien QR con treo thi dong lai, tranh khach quet tiep.
  await db.query(
    "UPDATE payments SET status = 'failed', notes = CONCAT(COALESCE(notes,''), ' | đơn giao đã hủy') WHERE sesis = ? AND status = 'pending'",
    [don.sesis]
  );

  const [[hd]] = await db.query('SELECT id_user FROM hopdong WHERE sesis = ? LIMIT 1', [don.sesis]);
  const daTra = await tienDaTra(don.sesis);
  const kq = { ben_loi: don.ben_loi, da_tra: daTra.tien, diem_hoan: 0, diem_tra_lai: 0, diem_thu_hoi: 0 };
  if (!hd || !hd.id_user) return kq;

  kq.diem_thu_hoi = await thuHoiDiemTich(don.sesis, hd.id_user).catch(() => 0);

  if (don.ben_loi === 'nha_hang') {
    const conLai = daTra.tien - (await tongDaHoan(don.id_giao));
    if (conLai > 0) {
      kq.diem_hoan = await ghiHoanDiem(don, {
        loai: 'toan_phan', soTien: conLai, ma_ly_do: don.ma_ly_do,
        ly_do: lyDo ? lyDo.nhan : don.ly_do, nguoi,
      });
    }
    // Diem khach da dung cho don nay: tra lai nguyen.
    if (daTra.diem > 0) {
      await loyaltyService.addPoints(hd.id_user, daTra.diem, `Trả lại điểm đã dùng cho đơn giao ${don.ma_giao}`, don.sesis);
      kq.diem_tra_lai = daTra.diem;
    }
  }
  return kq;
}

/**
 * Huy don theo chinh sach. Dung cho ca khach (laKhach) lan dieu phoi.
 * Khach chi duoc chon 'khach_doi_y' va chi truoc khi shipper toi lay hang.
 */
async function huyDon(idGiao, { ma_ly_do, ghi_chu = '', nguoi = {}, laKhach = false } = {}) {
  const vc = require('./vanChuyenService');
  const don = await vc.donGiao(idGiao);
  if (!don) throw new Error('Không tìm thấy đơn giao hàng.');

  if (laKhach) {
    ma_ly_do = 'khach_doi_y';
    if (!KHACH_HUY_DUOC.includes(don.trang_thai)) {
      throw new Error('Shipper đã tới lấy hàng, đơn không thể hủy nữa. Vui lòng liên hệ hotline nhà hàng.');
    }
  }
  const lyDo = LY_DO_HUY[ma_ly_do];
  if (!lyDo) throw new Error('Hãy chọn lý do hủy đơn.');
  if (lyDo.heThong && !nguoi.heThong) throw new Error('Lý do này chỉ hệ thống được dùng.');

  const lyDoGhi = [lyDo.nhan, String(ghi_chu || '').trim()].filter(Boolean).join(' — ');
  const sau = await vc.doiTrangThai(idGiao, 'huy', nguoi, {
    laDieuPhoi: true, ly_do: lyDoGhi, ma_ly_do, ben_loi: lyDo.ben_loi,
  });
  return { don: sau, chinh_sach: sau.ket_qua_huy || null };
}

/**
 * Hoan diem MOT PHAN cho don da giao (giao thieu mon, mon do...) hoac bo sung.
 * Chi cho loi nha hang; tong da hoan khong vuot so tien khach da tra.
 */
async function hoanDiemMotPhan(idGiao, { so_tien, ma_ly_do, ghi_chu = '', nguoi = {} }) {
  const [[don]] = await db.query('SELECT * FROM don_giao_hang WHERE id_giao = ?', [idGiao]);
  if (!don) throw new Error('Không tìm thấy đơn giao hàng.');
  const lyDo = LY_DO_HUY[ma_ly_do];
  if (!lyDo || lyDo.ben_loi !== 'nha_hang') throw new Error('Chỉ hoàn điểm khi lỗi thuộc về nhà hàng — hãy chọn đúng lý do.');
  const tien = Math.round(Number(so_tien) || 0);
  if (tien <= 0) throw new Error('Số tiền hoàn phải lớn hơn 0.');

  const daTra = (await tienDaTra(don.sesis)).tien;
  const toiDa = daTra - (await tongDaHoan(idGiao));
  if (toiDa <= 0) throw new Error('Đơn này đã được hoàn điểm đủ số tiền khách đã trả.');
  if (tien > toiDa) throw new Error(`Chỉ còn hoàn được tối đa ${toiDa.toLocaleString('vi-VN')}đ cho đơn này.`);

  const soDiem = await ghiHoanDiem(don, {
    loai: 'mot_phan', soTien: tien, ma_ly_do,
    ly_do: [lyDo.nhan, String(ghi_chu || '').trim()].filter(Boolean).join(' — '), nguoi,
  });
  await require('./vanChuyenService').ghiNhatKy(idGiao, don.trang_thai, don.trang_thai, nguoi,
    `Hoàn ${soDiem} điểm (${tien.toLocaleString('vi-VN')}đ): ${lyDo.nhan}`);
  return { so_diem: soDiem, so_tien: tien };
}

async function lichSuHoan(idGiao) {
  const [rows] = await db.query('SELECT * FROM hoan_diem_giao_hang WHERE id_giao = ? ORDER BY id', [idGiao]);
  return rows;
}

/* ========================================================================== */
/* VONG QUET: tu huy don qua han thanh toan                                    */
/* ========================================================================== */

async function quetQuaHan() {
  const [ds] = await db.query(
    "SELECT id_giao, sesis FROM don_giao_hang WHERE trang_thai = 'cho_thanh_toan' AND han_thanh_toan IS NOT NULL AND han_thanh_toan < NOW() LIMIT 50"
  );
  let n = 0;
  for (const d of ds) {
    try {
      // Tien vua ve dung luc het han thi uu tien xac nhan don.
      const hoaDon = await require('./thanhToanService').layHoaDon(d.sesis, { goiY: false });
      // Goi qua module.exports (khong goi ham noi bo) de lop thong bao bat duoc
      // "don cho phan shipper" ca khi tien ve muon va duoc quet lai o day.
      if (hoaDon.tien.con_phai_tra <= 0) { await module.exports.sauKhiThanhToan(d.sesis, 0); continue; }
      await huyDon(d.id_giao, { ma_ly_do: 'qua_han_thanh_toan', nguoi: { ten: 'Hệ thống', heThong: true } });
      n++;
    } catch (e) {
      console.error('[chinh-sach-giao] tu huy loi:', d.id_giao, (e.message || e.code || String(e)));
    }
  }
  if (n) baoThayDoi();
  return n;
}

let _vong = null;
/* ========================================================================== */
/* RANG BUOC THOI GIAN DON GIAO                                                */
/* ========================================================================== */

let _cotTg = null;
/** Cot moc thoi gian cho don giao - tu them 1 lan. */
function damBaoCotThoiGian() {
  if (!_cotTg) {
    _cotTg = (async () => {
      for (const [ten, kieu] of [['cho_phan_luc', 'DATETIME NULL'], ['canh_bao_shipper_luc', 'DATETIME NULL']]) {
        const [c] = await db.query('SHOW COLUMNS FROM don_giao_hang LIKE ?', [ten]);
        if (!c.length) await db.query(`ALTER TABLE don_giao_hang ADD COLUMN ${ten} ${kieu}`);
      }
    })().catch((e) => { _cotTg = null; throw e; });
  }
  return _cotTg;
}

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const ngayStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Khung mo cua cua mot ngay -> { dong, lyDo, mo: Date, dongCua: Date }. */
async function khungMoCua(ngay) {
  const qt = require('./reservationRules');
  const l = await qt.lichMoCua(ngay);
  if (l.dong) return { dong: true, lyDo: l.lyDo || 'Nhà hàng nghỉ trong ngày này' };
  const mo = qt.ghepMoc(ngay, String(l.mo));
  let dongCua = qt.ghepMoc(ngay, String(l.dong_cua));
  if (dongCua <= mo) dongCua = new Date(dongCua.getTime() + 86400000);
  return { dong: false, mo, dongCua };
}

/**
 * Kiem tra luc DAT va gio NHAN cua don giao. Nem Error (thong diep cho khach) neu sai.
 *   - Luc dat: trong gio mo cua hom nay, ngung nhan phut_ngung_truoc_dong phut truoc gio dong.
 *   - Gio nhan: trong gio mo cua cua ngay do, hen xa nhat so_ngay_hen_toi_da ngay.
 *   - Gio nhan som hon bay gio -> coi la "giao ngay" (doi gio nhan thanh bay gio).
 * Tra ve { ngay, gio, giaoNgay } da chuan hoa.
 */
async function kiemTraGioGiao(ngay, gio, bayGio = new Date()) {
  const ts = await docThamSo();
  const homNay = ngayStr(bayGio);
  const k0 = await khungMoCua(homNay);
  if (k0.dong) throw new Error(`Hôm nay nhà hàng không nhận đơn giao (${k0.lyDo}).`);
  const chotNhan = new Date(k0.dongCua.getTime() - ts.phut_ngung_truoc_dong * 60000);
  if (bayGio < k0.mo || bayGio > chotNhan) {
    throw new Error(`Nhà hàng nhận đơn giao từ ${hhmm(k0.mo)} đến ${hhmm(chotNhan)} (ngừng nhận ${ts.phut_ngung_truoc_dong} phút trước giờ đóng cửa ${hhmm(k0.dongCua)}). Vui lòng đặt lại trong khung giờ này.`);
  }
  const ngayNhan = /^\d{4}-\d{2}-\d{2}$/.test(String(ngay || '')) ? String(ngay) : homNay;
  const gioNhan = /^\d{1,2}:\d{2}/.test(String(gio || '')) ? String(gio).slice(0, 5).padStart(5, '0') : hhmm(bayGio);
  const xaNhat = new Date(bayGio); xaNhat.setHours(0, 0, 0, 0); xaNhat.setDate(xaNhat.getDate() + ts.so_ngay_hen_toi_da);
  if (ngayNhan < homNay) throw new Error('Ngày nhận hàng không được ở quá khứ.');
  if (ngayNhan > ngayStr(xaNhat)) throw new Error(`Chỉ nhận hẹn giao trước tối đa ${ts.so_ngay_hen_toi_da} ngày.`);
  const k = ngayNhan === homNay ? k0 : await khungMoCua(ngayNhan);
  if (k.dong) throw new Error(`Ngày ${ngayNhan.split('-').reverse().join('/')} nhà hàng nghỉ (${k.lyDo}).`);
  const moc = require('./reservationRules').ghepMoc(ngayNhan, `${gioNhan}:00`);
  if (moc <= bayGio) return { ngay: homNay, gio: hhmm(bayGio), giaoNgay: true };
  if (moc < k.mo || moc > k.dongCua) {
    throw new Error(`Giờ nhận hàng phải trong giờ mở cửa ${hhmm(k.mo)} – ${hhmm(k.dongCua)}.`);
  }
  return { ngay: ngayNhan, gio: gioNhan, giaoNgay: false };
}

/** Gio hen nhan cua don (tu hopdong.ngay_dat + gio_dat). */
async function henCuaSesis(sesis) {
  const [[r]] = await db.query(
    "SELECT MIN(TIMESTAMP(ngay_dat, COALESCE(gio_dat, '00:00:00'))) AS hen FROM hopdong WHERE sesis = ? AND ngay_dat IS NOT NULL", [sesis]);
  return r && r.hen ? new Date(r.hen) : null;
}

/** Don hen gio chua toi luc len bep / phan shipper -> tra ve moc bat dau; da toi -> null. */
async function henChuaToi(sesis, bayGio = new Date()) {
  const ts = await docThamSo();
  const hen = await henCuaSesis(sesis);
  if (!hen) return null;
  const batDau = new Date(hen.getTime() - ts.phut_len_bep_truoc * 60000);
  return bayGio < batDau ? batDau : null;
}

/**
 * Don da thanh toan ma chua co shipper NHAN: canh bao sau phut_canh_bao_cho_shipper,
 * tu huy (ly do "khong co shipper", loi nha hang -> hoan diem 100%, bao khach) sau
 * phut_tu_huy_cho_shipper. Tinh tu khi don duoc phep phan:
 *     max(luc vao hang cho, gio hen - phut_len_bep_truoc).
 * Chi xet don co cho_phan_luc (don tao tu khi co rang buoc nay).
 */
async function quetChoShipper(bayGio = new Date()) {
  await damBaoCotThoiGian();
  const ts = await docThamSo();
  const [ds] = await db.query(
    `SELECT d.id_giao, d.ma_giao, d.sesis, d.cho_phan_luc, d.canh_bao_shipper_luc,
            (SELECT MIN(TIMESTAMP(h.ngay_dat, COALESCE(h.gio_dat, '00:00:00'))) FROM hopdong h WHERE h.sesis = d.sesis AND h.ngay_dat IS NOT NULL) AS hen
       FROM don_giao_hang d
      WHERE d.cho_phan_luc IS NOT NULL
        AND (d.trang_thai = 'cho_phan' OR (d.trang_thai = 'da_phan' AND d.xac_nhan_luc IS NULL))
      LIMIT 100`);
  const kq = { canh_bao: 0, tu_huy: 0 };
  for (const d of ds) {
    let moc = new Date(d.cho_phan_luc);
    if (d.hen) { const len = new Date(new Date(d.hen).getTime() - ts.phut_len_bep_truoc * 60000); if (len > moc) moc = len; }
    const phut = (bayGio - moc) / 60000;
    try {
      if (phut >= ts.phut_tu_huy_cho_shipper) {
        await huyDon(d.id_giao, {
          ma_ly_do: 'khong_co_shipper',
          ghi_chu: `Tự hủy: quá ${ts.phut_tu_huy_cho_shipper} phút không có shipper nhận đơn`,
          nguoi: { ten: 'Hệ thống', heThong: true },
        });
        kq.tu_huy++;
      } else if (phut >= ts.phut_canh_bao_cho_shipper && !d.canh_bao_shipper_luc) {
        await db.query('UPDATE don_giao_hang SET canh_bao_shipper_luc = NOW() WHERE id_giao = ?', [d.id_giao]);
        await require('./thongBaoService').gui('giao_cho_shipper_lau', {
          tieuDe: `Đơn ${d.ma_giao} chờ shipper ${Math.floor(phut)} phút`,
          noiDung: `Chưa có shipper nhận. Phân tay hoặc gọi thêm shipper - quá ${ts.phut_tu_huy_cho_shipper} phút hệ thống tự hủy và hoàn điểm cho khách.`,
          link: '/staff/giao-hang', mucDo: 'khan',
        }).catch(() => {});
        kq.canh_bao++;
      }
    } catch (e) {
      console.error('[chinh-sach-giao] quet cho shipper loi:', d.id_giao, (e.message || String(e)));
    }
  }
  if (kq.tu_huy || kq.canh_bao) baoThayDoi();
  return kq;
}

function batVongQuet() {
  if (_vong) return;
  _vong = setInterval(() => {
    quetQuaHan().catch((e) => console.error('[chinh-sach-giao]', (e.message || e.code || String(e))));
    quetChoShipper().catch((e) => console.error('[chinh-sach-giao] cho shipper:', (e.message || e.code || String(e))));
  }, 60000);
  console.log('[giao-hang] vòng quét đơn quá hạn thanh toán đã bật (mỗi 60s)');
}

function baoThayDoi() {
  try {
    const realtime = require('./realtime');
    realtime.doi(realtime.MIEN.GIAO_HANG, { duong_dan: '/staff/giao-hang' });
  } catch (e) { /* realtime chua khoi tao (script le) */ }
}

/** Toan bo chinh sach o dang du lieu - cho trang /chinh-sach-giao-hang va gio hang. */
async function docChinhSach() {
  const ts = await docThamSo();
  const [dsDv] = await db.query('SELECT * FROM don_vi_van_chuyen WHERE trang_thai = 1 ORDER BY thu_tu, id_dv');
  return {
    ...ts,
    bang_gia: await bangGiaMau(dsDv),
    ly_do_khach: Object.entries(LY_DO_HUY).filter(([, v]) => v.ben_loi === 'khach').map(([ma, v]) => ({ ma, ...v })),
    ly_do_nha_hang: Object.entries(LY_DO_HUY).filter(([, v]) => v.ben_loi === 'nha_hang').map(([ma, v]) => ({ ma, ...v })),
    khach_huy_duoc: KHACH_HUY_DUOC,
  };
}

module.exports = {
  LY_DO_HUY, KHACH_HUY_DUOC,
  docThamSo, xoaCache, docChinhSach,
  tinhPhiDonVi, bangGiaMau,
  tienDaTra, sauKhiThanhToan,
  huyDon, sauKhiHuy, hoanDiemMotPhan, lichSuHoan, tongDaHoan,
  quetQuaHan, batVongQuet,
  damBaoCotThoiGian, kiemTraGioGiao, henCuaSesis, henChuaToi, quetChoShipper,
};
