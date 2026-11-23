/**
 * QUY TRINH DAT TIEC ONLINE (Sanh Gala) - chinh sach, lich trong, thuc don tuy
 * chinh, coc online, thanh toan phan con lai, huy & hoan coc theo moc ngay.
 *
 *   Khach: doc & dong y CHINH SACH -> loai tiec + so khach (>= toi thieu sanh Gala,
 *   it hon -> chuyen sang dat ban thuong) -> chon NGAY tren lich (ngay kin bao do)
 *   -> chon GIO (gio trong xanh, gio da co tiec do) -> THUC DON co san hoac tuy
 *   chinh (bo mon / them mon / yeu cau) -> DICH VU them -> lien he -> gui.
 *
 *   Thuc don co san  -> 'CHO_COC'     giu sanh `giu_cho_coc_phut` phut cho khach chuyen coc
 *   Thuc don tuy chinh -> 'CHO_BAO_GIA' giu sanh `giu_cho_bao_gia_gio` gio cho nha hang bao gia
 *        nhan vien bao gia -> 'CHO_COC' (giu tiep `giu_cho_bao_gia_gio` gio)
 *   Coc (VietQR / SePay tu khop "TIEC <ma>", hoac thu tai quay) -> 'DA_COC'
 *   Sau tiec nha hang chot hoa don thuc te -> 'CHO_THANH_TOAN'
 *   Khach tra phan con lai (online / tai quay) -> 'HOAN_THANH'
 *   Het han giu cho ma chua coc -> 'HET_HAN' (sanh tra lai cho nguoi khac).
 *
 * Gia LUON tinh lai o may chu tu CSDL (khong tin so trinh duyet gui).
 */
const db = require('../config/db');
const { ngayCucBo } = require('../utils/thoiGian');

const MAC_DINH = {
  ty_le_coc: 30,
  giu_cho_coc_phut: 60,
  giu_cho_bao_gia_gio: 24,
  hoan_tien_som_ngay: 7,
  hoan_tien_giua_ngay: 3,
  hoan_tien_giua_phan_tram: 50,
  chot_so_khach_truoc_ngay: 3,
  dao_dong_so_khach_phan_tram: 10,
};
const MO_TA = {
  ty_le_coc: 'Tỷ lệ cọc (%) trên dự toán tiệc',
  giu_cho_coc_phut: 'Số phút giữ sảnh chờ khách chuyển cọc online',
  giu_cho_bao_gia_gio: 'Số giờ giữ sảnh chờ nhà hàng báo giá thực đơn tùy chỉnh / khách cọc sau báo giá',
  hoan_tien_som_ngay: 'Hủy trước ít nhất N ngày: hoàn 100% cọc',
  hoan_tien_giua_ngay: 'Hủy trước ít nhất N ngày: hoàn theo tỷ lệ giữa',
  hoan_tien_giua_phan_tram: 'Tỷ lệ hoàn (%) khi hủy ở mốc giữa',
  chot_so_khach_truoc_ngay: 'Chốt số khách / số bàn trước ngày tiệc N ngày',
  dao_dong_so_khach_phan_tram: 'Số bàn thực tế được giảm tối đa (%) so với số đã chốt',
};

let daCo = false;
async function damBaoCauTruc() {
  if (daCo) return;
  await require('./datTiecService').damBaoCotTien();
  const cot = [
    ['thuc_don_tuy_chinh', "JSON NULL COMMENT 'Bo mon / them mon / yeu cau rieng'"],
    ['tien_dieu_chinh', "DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT 'Tien mon them (thuc don tuy chinh)'"],
    ['han_giu_cho', "DATETIME NULL COMMENT 'Giu sanh tam toi luc nay (cho coc / cho bao gia)'"],
    ['dong_y_chinh_sach_luc', 'DATETIME NULL'],
    ['bao_gia_luc', 'DATETIME NULL'],
    ['tien_hoan_du_kien', "DECIMAL(14,2) NULL COMMENT 'Hoan coc theo chinh sach khi huy'"],
    ['so_khach_thuc_te', 'INT NULL'],
  ];
  for (const [ten, kieu] of cot) {
    const [r] = await db.query(
      'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', ['dat_tiec', ten]);
    if (!r.length) await db.query(`ALTER TABLE dat_tiec ADD COLUMN ${ten} ${kieu}`);
  }
  // Trang thai la VARCHAR / ENUM? Neu ENUM thi mo rong de nhan trang thai moi.
  const [[ct]] = await db.query(
    "SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dat_tiec' AND COLUMN_NAME = 'trang_thai'");
  if (ct && /^enum/i.test(ct.t) && !/CHO_THANH_TOAN/.test(ct.t)) {
    await db.query(`ALTER TABLE dat_tiec MODIFY trang_thai ENUM('MOI','DA_LIEN_HE','CHO_BAO_GIA','CHO_COC','DA_XAC_NHAN','DA_COC','CHO_THANH_TOAN','HOAN_THANH','HUY','HET_HAN') NOT NULL DEFAULT 'MOI'`);
  }
  for (const [k, v] of Object.entries(MAC_DINH)) {
    await db.query('INSERT IGNORE INTO dat_tiec_cau_hinh (setting_key, setting_value) VALUES (?, ?)', [k, String(v)]);
  }
  daCo = true;
}

async function cauHinh() {
  await damBaoCauTruc();
  const [rows] = await db.query('SELECT setting_key, setting_value FROM dat_tiec_cau_hinh');
  const c = { ...MAC_DINH };
  for (const r of rows) if (r.setting_key in MAC_DINH && Number.isFinite(Number(r.setting_value))) c[r.setting_key] = Number(r.setting_value);
  const dt = require('./datTiecService');
  const sanh = await sanhGala();
  return {
    ...c,
    dat_truoc_toi_thieu_ngay: dt.DAT_TRUOC_TOI_THIEU_NGAY,
    dat_truoc_toi_da_ngay: dt.DAT_TRUOC_TOI_DA_NGAY,
    khach_moi_ban: dt.KHACH_MOI_BAN,
    sanh,
    khach_toi_thieu: sanh ? sanh.tiec_toi_thieu : 50,
    khach_toi_da: sanh ? sanh.tiec_toi_da : 300,
  };
}

/** Tiec online chi to chuc o Sanh Gala (khu co la_sanh_tiec; khong co thi khu lon nhat). */
async function sanhGala() {
  const ds = await require('./datTiecService').docSanhTiec();
  return ds.find((s) => s.la_sanh_tiec) || ds[0] || null;
}

const tien = (n) => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')}đ`;

/** Noi dung chinh sach dat tiec (tu cau hinh) - hien o buoc 1, trang thanh toan, lich su. */
function chinhSach(ch) {
  const ban = (k) => Math.ceil(k / ch.khach_moi_ban);
  return [
    { ma: 'dieu_kien', tieu_de: 'Điều kiện đặt tiệc', muc: [
      `Đặt tiệc online áp dụng cho tiệc lớn tổ chức tại ${ch.sanh ? ch.sanh.ten : 'Sảnh Gala'}: từ ${ch.khach_toi_thieu} đến ${ch.khach_toi_da} khách (${ban(ch.khach_toi_thieu)}–${ban(ch.khach_toi_da)} bàn, ${ch.khach_moi_ban} khách/bàn).`,
      `Dưới ${ch.khach_toi_thieu} khách, quý khách vui lòng dùng chức năng Đặt bàn (có khu VIP và bàn ghép cho nhóm).`,
      `Đặt trước ít nhất ${ch.dat_truoc_toi_thieu_ngay} ngày và tối đa 12 tháng. Tiệc gấp hơn vui lòng gọi Hotline.`,
      'Mỗi buổi (trưa / tối) sảnh chỉ nhận một tiệc. Lịch trên trang luôn là lịch thực tế.',
    ] },
    { ma: 'thuc_don', tieu_de: 'Thực đơn & dịch vụ', muc: [
      `Giá thực đơn tính theo bàn ${ch.khach_moi_ban} khách, số bàn = số khách chia ${ch.khach_moi_ban}, làm tròn lên.`,
      'Thực đơn có sẵn: đặt cọc được ngay sau khi gửi.',
      `Thực đơn tùy chỉnh (bỏ / thêm món, yêu cầu riêng): nhà hàng báo giá trong ${ch.giu_cho_bao_gia_gio} giờ, quý khách đặt cọc sau khi nhận báo giá. Món thêm tính theo phần mỗi bàn.`,
      'Dịch vụ (trang trí, MC, âm thanh...) tính theo gói, theo bàn hoặc theo khách như ghi ở từng dịch vụ.',
    ] },
    { ma: 'coc', tieu_de: 'Đặt cọc & giữ sảnh', muc: [
      `Cọc ${ch.ty_le_coc}% dự toán để giữ sảnh, chuyển khoản qua mã VietQR (hệ thống tự xác nhận) hoặc nộp tại quầy.`,
      `Sau khi gửi yêu cầu, sảnh được giữ tạm ${ch.giu_cho_coc_phut} phút để quý khách chuyển cọc. Quá hạn chưa cọc, sảnh được nhả cho khách khác.`,
      'Tiệc chỉ được xác nhận chính thức khi nhà hàng đã nhận đủ tiền cọc.',
    ] },
    { ma: 'thanh_toan', tieu_de: 'Chốt số khách & thanh toán', muc: [
      `Chốt số khách / số bàn chậm nhất ${ch.chot_so_khach_truoc_ngay} ngày trước tiệc. Sau mốc này số bàn chỉ được giảm tối đa ${ch.dao_dong_so_khach_phan_tram}%; bàn chuẩn bị mà không dùng vẫn tính tiền.`,
      'Món, đồ uống, dịch vụ phát sinh trong tiệc tính theo thực tế.',
      'Kết thúc tiệc, nhà hàng chốt hóa đơn thực tế. Phần còn lại (hóa đơn trừ tiền đã cọc) thanh toán ngay trong ngày tiệc: chuyển khoản theo mã VietQR trên trang "Lịch sử đặt tiệc" hoặc tại quầy.',
    ] },
    { ma: 'huy', tieu_de: 'Đổi lịch, hủy tiệc & hoàn cọc', muc: [
      `Hủy trước ngày tiệc từ ${ch.hoan_tien_som_ngay} ngày trở lên: hoàn 100% tiền cọc.`,
      `Hủy trước từ ${ch.hoan_tien_giua_ngay} đến dưới ${ch.hoan_tien_som_ngay} ngày: hoàn ${ch.hoan_tien_giua_phan_tram}% tiền cọc.`,
      `Hủy trước dưới ${ch.hoan_tien_giua_ngay} ngày hoặc không đến: không hoàn cọc.`,
      'Yêu cầu chưa đặt cọc có thể tự hủy bất cứ lúc nào, không mất phí. Đổi ngày tiệc (nếu sảnh còn trống) được 1 lần miễn phí khi báo trước ít nhất 7 ngày.',
      'Tiền hoàn chuyển về tài khoản quý khách trong 3–5 ngày làm việc.',
    ] },
  ];
}

/** % coc duoc hoan khi huy vao hom nay cho tiec ngay `ngayToChuc`. */
function phanTramHoan(ngayToChuc, ch) {
  const homNay = new Date(`${ngayCucBo()}T00:00:00`);
  // MySQL tra DATE ve dang Date (gio dia phuong) - doi ve 'YYYY-MM-DD' truoc khi so.
  const chuoi = ngayToChuc instanceof Date ? ngayCucBo(ngayToChuc) : String(ngayToChuc).slice(0, 10);
  const ngay = new Date(`${chuoi}T00:00:00`);
  const con = Math.round((ngay - homNay) / 86400000);
  if (con >= ch.hoan_tien_som_ngay) return { phan_tram: 100, con_ngay: con };
  if (con >= ch.hoan_tien_giua_ngay) return { phan_tram: ch.hoan_tien_giua_phan_tram, con_ngay: con };
  return { phan_tram: 0, con_ngay: con };
}

// ------------------------------------------------------------------ lich

/** Don giu sanh: da chot / da coc / dang cho thanh toan, hoac dang giu tam con han. */
const DIEU_KIEN_GIU = `(t.trang_thai IN ('DA_XAC_NHAN','DA_COC','CHO_THANH_TOAN','HOAN_THANH')
  OR (t.trang_thai IN ('CHO_COC','CHO_BAO_GIA') AND t.han_giu_cho > NOW()))`;

/** Giu tam qua han ma chua coc -> HET_HAN (nha sanh). Goi truoc moi lan doc lich. */
async function hetHanGiuCho() {
  await damBaoCauTruc();
  const [kq] = await db.query(
    `UPDATE dat_tiec SET trang_thai = 'HET_HAN'
      WHERE trang_thai IN ('CHO_COC','CHO_BAO_GIA') AND han_giu_cho IS NOT NULL AND han_giu_cho < NOW()`);
  return kq.affectedRows;
}

async function buoiDaKin(tuNgay, denNgay, khuVucId, { truId = 0 } = {}) {
  await hetHanGiuCho();
  const [rows] = await db.query(
    `SELECT DATE_FORMAT(t.ngay_to_chuc, '%Y-%m-%d') AS ngay, t.buoi FROM dat_tiec t
      WHERE t.ngay_to_chuc BETWEEN ? AND ? AND t.khu_vuc_id = ? AND t.id <> ? AND ${DIEU_KIEN_GIU}`,
    [tuNgay, denNgay, khuVucId, truId]);
  const kin = new Set(rows.map((r) => `${r.ngay}|${r.buoi}`));
  return kin;
}

/** Lich mot thang cua Sanh Gala: moi ngay trong / con mot buoi / kin / khong nhan. */
async function lichThang(thang) {
  if (!/^\d{4}-\d{2}$/.test(String(thang || ''))) thang = ngayCucBo().slice(0, 7);
  const ch = await cauHinh();
  const dt = require('./datTiecService');
  const [y, m] = thang.split('-').map(Number);
  const soNgay = new Date(y, m, 0).getDate();
  const tu = `${thang}-01`, den = `${thang}-${String(soNgay).padStart(2, '0')}`;
  const kin = ch.sanh ? await buoiDaKin(tu, den, ch.sanh.id) : new Set();
  const homNay = ngayCucBo();
  const min = dt.cong(homNay, ch.dat_truoc_toi_thieu_ngay), max = dt.cong(homNay, ch.dat_truoc_toi_da_ngay);
  const ngay = [];
  for (let d = 1; d <= soNgay; d++) {
    const n = `${thang}-${String(d).padStart(2, '0')}`;
    const buoi = Object.keys(dt.BUOI).map((b) => ({ ma: b, kin: kin.has(`${n}|${b}`) }));
    const soKin = buoi.filter((b) => b.kin).length;
    ngay.push({
      ngay: n,
      trang: n < min || n > max ? 'khong_nhan' : soKin === buoi.length ? 'kin' : soKin ? 'mot_buoi' : 'trong',
      buoi,
    });
  }
  return { thang, ngay_min: min, ngay_max: max, ngay };
}

/** Chi tiet mot ngay: tung buoi, tung gio trong / da co tiec. */
async function lichNgay(ngay) {
  const ch = await cauHinh();
  const dt = require('./datTiecService');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ngay || ''))) return { ngay, nhan: false, ly_do: 'Ngày không hợp lệ.' };
  const homNay = ngayCucBo();
  if (ngay < dt.cong(homNay, ch.dat_truoc_toi_thieu_ngay)) {
    return { ngay, nhan: false, ly_do: `Tiệc cần đặt trước ít nhất ${ch.dat_truoc_toi_thieu_ngay} ngày. Tiệc gấp vui lòng gọi Hotline.` };
  }
  if (ngay > dt.cong(homNay, ch.dat_truoc_toi_da_ngay)) return { ngay, nhan: false, ly_do: 'Chỉ nhận đặt tiệc trong vòng 12 tháng tới.' };
  const kin = ch.sanh ? await buoiDaKin(ngay, ngay, ch.sanh.id) : new Set();
  const buoi = Object.entries(dt.BUOI).map(([ma, b]) => {
    const k = kin.has(`${ngay}|${ma}`);
    return { ma, ten: b.ten, khung: b.khung, kin: k, gio: b.gio.map((g) => ({ gio: g, trong: !k })) };
  });
  const hetCho = buoi.every((b) => b.kin);
  return {
    ngay, nhan: true, het_cho: hetCho, buoi,
    ly_do: hetCho ? `${ch.sanh ? ch.sanh.ten : 'Sảnh'} đã kín lịch cả buổi trưa và buổi tối ngày này. Vui lòng chọn ngày khác.` : null,
  };
}

// ------------------------------------------------------------------ mon le cho thuc don tuy chinh

async function docMonLe() {
  const [rows] = await db.query(
    `SELECT m.id_mon, m.name_mon, m.gia_mon, m.images, l.name_loai
       FROM monan m JOIN loai_mon l ON l.id_loai = m.id_loai
      WHERE m.tinhtrang = 1 AND l.name_loai NOT LIKE '%Test%' AND l.name_loai NOT LIKE 'LoaiTest%'
      ORDER BY l.name_loai, m.name_mon`);
  return rows.map((r) => ({ id: r.id_mon, ten: String(r.name_mon).trim(), gia: Number(r.gia_mon), loai: r.name_loai,
    anh: r.images ? `/food/${r.images}` : null }));
}

/**
 * Gan anh cho tung mon cua thuc don tiec: thuc don chi luu TEN mon -> ghep voi mon
 * that trong thuc don nha hang (tiecVanHanhService.ghepMon, dung chung voi ke hoach
 * nguyen lieu) de lay anh. Khong ghep duoc thi de trong (giao dien hien bieu tuong).
 */
async function ganAnhThucDon(dsThucDon) {
  const { ghepMon } = require('./tiecVanHanhService');
  const [dsMon] = await db.query("SELECT id_mon, name_mon, images FROM monan WHERE tinhtrang = 1 AND images IS NOT NULL AND images <> ''");
  const anhTheoId = new Map(dsMon.map((m) => [Number(m.id_mon), `/food/${m.images}`]));
  return dsThucDon.map((td) => ({
    ...td,
    mon: (td.mon || []).map((m) => {
      const g = ghepMon(m.ten, dsMon);
      return { ...m, anh: g ? anhTheoId.get(g.id_mon) || null : null };
    }),
  }));
}

/** Chuan hoa yeu cau tuy chinh + tinh tien mon them (gia mon x so phan / ban x so ban). */
async function tinhTuyChinh(raw, thucDon, soBan) {
  const tc = raw && typeof raw === 'object' ? raw : {};
  const monNen = (thucDon.mon || []).map((m) => String(m.ten));
  const boMon = [...new Set((Array.isArray(tc.bo_mon) ? tc.bo_mon : []).map(String).filter((t) => monNen.includes(t)))].slice(0, 20);
  const dsLe = await docMonLe();
  const themMon = [];
  for (const x of (Array.isArray(tc.them_mon) ? tc.them_mon : []).slice(0, 20)) {
    const mon = dsLe.find((m) => Number(m.id) === Number(x.id_mon));
    const sl = Math.min(5, Math.max(1, Math.floor(Number(x.so_phan) || 1)));
    if (mon && !themMon.some((t) => t.id_mon === mon.id)) {
      themMon.push({ id_mon: mon.id, ten: mon.ten, don_gia: mon.gia, so_phan: sl, thanh_tien: mon.gia * sl * soBan });
    }
  }
  const yeuCau = String(tc.yeu_cau || '').trim().slice(0, 1000);
  const coTuyChinh = boMon.length > 0 || themMon.length > 0 || yeuCau.length > 0;
  return {
    co: coTuyChinh,
    du_lieu: coTuyChinh ? { bo_mon: boMon, them_mon: themMon, yeu_cau: yeuCau } : null,
    tien: themMon.reduce((s, m) => s + m.thanh_tien, 0),
  };
}

// ------------------------------------------------------------------ tien

const cocCan = (don, ch) => Math.ceil((Number(don.tong_du_toan) || 0) * ch.ty_le_coc / 100);

/** Khach can tra bao nhieu luc nay (coc / phan con lai) - null neu khong co khoan nao cho. */
function khoanCanTra(don, ch) {
  const daThu = Number(don.da_thu) || 0;
  if (don.trang_thai === 'CHO_COC') return { loai: 'dat_coc', so_tien: Math.max(0, cocCan(don, ch) - daThu), ten: 'Tiền cọc giữ sảnh' };
  if (don.trang_thai === 'CHO_THANH_TOAN') {
    const tong = don.tong_thuc_te == null ? Number(don.tong_du_toan) : Number(don.tong_thuc_te);
    return { loai: 'thanh_toan', so_tien: Math.max(0, Math.round(tong - daThu)), ten: 'Thanh toán phần còn lại' };
  }
  return null;
}

/**
 * Ghi nhan tien khach chuyen (webhook SePay hoac nut gia lap demo).
 * Coc du -> DA_COC. Tra du phan con lai -> HOAN_THANH. Thieu / sai trang thai -> tu choi
 * (giao dich de thu ngan xu ly tay).
 */
async function ghiNhanChuyenKhoan(maTiec, soTien, { maGiaoDich = null, phuongThuc = 'vietqr', nguon = 'webhook' } = {}) {
  await damBaoCauTruc();
  const ch = await cauHinh();
  const tienNhan = Math.round(Number(soTien) || 0);
  const conn = await db.getConnection();
  let kq;
  try {
    await conn.beginTransaction();
    const [[don]] = await conn.query('SELECT * FROM dat_tiec WHERE ma_tiec = ? FOR UPDATE', [maTiec]);
    if (!don) throw Object.assign(new Error(`Không có tiệc ${maTiec}`), { ma: 'NOT_FOUND' });
    // Coc toi sau khi het han giu cho: van nhan neu sanh van trong buoi do.
    if (don.trang_thai === 'HET_HAN') {
      const [[trung]] = await conn.query(
        `SELECT t.ma_tiec FROM dat_tiec t WHERE t.id <> ? AND t.khu_vuc_id = ? AND t.ngay_to_chuc = ? AND t.buoi = ? AND ${DIEU_KIEN_GIU} LIMIT 1`,
        [don.id, don.khu_vuc_id, don.ngay_to_chuc, don.buoi]);
      if (trung) throw Object.assign(new Error(`Tiệc ${maTiec} đã hết hạn giữ chỗ và sảnh đã có tiệc ${trung.ma_tiec} - cần hoàn tiền thủ công`), { ma: 'CONFLICT' });
      don.trang_thai = 'CHO_COC';
    }
    const can = khoanCanTra(don, ch);
    if (!can) throw Object.assign(new Error(`Tiệc ${maTiec} đang ở trạng thái ${don.trang_thai}, không có khoản chờ thanh toán`), { ma: 'TRANG_THAI' });
    if (tienNhan < can.so_tien) throw Object.assign(new Error(`Chuyển thiếu: nhận ${tien(tienNhan)} / cần ${tien(can.so_tien)} (tiệc ${maTiec})`), { ma: 'THIEU' });
    const [[pt]] = await conn.query('SELECT id FROM payment_methods WHERE code = ? LIMIT 1', [phuongThuc]);
    await conn.query(
      `INSERT INTO payments (sesis, amount, payment_method_id, status, loai, nguon, processed_by, thanh_cong_luc, notes)
       VALUES (?, ?, ?, 'success', ?, ?, NULL, NOW(), ?)`,
      [maTiec, tienNhan, pt ? pt.id : null, can.loai, nguon === 'web' ? 'web' : 'webhook', `${can.ten} tiệc ${maTiec}${maGiaoDich ? ' · GD ' + maGiaoDich : ''}`]);
    const moi = can.loai === 'dat_coc' ? 'DA_COC' : 'HOAN_THANH';
    await conn.query(
      `UPDATE dat_tiec SET trang_thai = ?, da_thu = da_thu + ?, han_giu_cho = NULL
         ${can.loai === 'dat_coc' ? ', tien_coc = tien_coc + ?' : ''} WHERE id = ?`,
      can.loai === 'dat_coc' ? [moi, tienNhan, tienNhan, don.id] : [moi, tienNhan, don.id]);
    await conn.query(
      'INSERT INTO dat_tiec_lich_su (dat_tiec_id, tu_trang_thai, den_trang_thai, ghi_chu, nguoi_doi) VALUES (?, ?, ?, ?, NULL)',
      [don.id, don.trang_thai, moi, `Khách chuyển khoản ${tien(tienNhan)} (${can.ten})`]).catch(() => {});
    await conn.commit();
    kq = { ok: true, ma: maTiec, trang_thai: moi, loai: can.loai, so_tien: tienNhan, id: don.id, customer_id: don.customer_id };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  baoDaThanhToan(kq);
  return kq;
}

function baoDaThanhToan(kq) {
  Promise.resolve().then(async () => {
    const tb = require('./thongBaoService');
    if (kq.loai === 'dat_coc') {
      await tb.gui('dat_tiec_chot', {
        tieuDe: `Tiệc ${kq.ma} đã nhận cọc online ${tien(kq.so_tien)} - chuẩn bị nguyên liệu`,
        noiDung: 'Sảnh đã được giữ chính thức. Xem "Kế hoạch nguyên liệu" ở trang Đặt tiệc.', link: '/staff/dat-tiec',
      });
    }
    if (kq.customer_id) {
      await tb.gui('dat_tiec_khach', {
        kh: [kq.customer_id], nguoiGui: 'Nhà hàng Bảo Đoàn', link: '/my-orders?tab=tiec',
        tieuDe: kq.loai === 'dat_coc' ? `Đã nhận cọc tiệc ${kq.ma} - sảnh đã được giữ` : `Tiệc ${kq.ma} đã thanh toán đủ. Cảm ơn quý khách!`,
      });
    }
  }).catch((e) => console.error('[dat-tiec] bao thanh toan:', e.message));
}

module.exports = {
  MAC_DINH, MO_TA, DIEU_KIEN_GIU,
  damBaoCauTruc, cauHinh, sanhGala, chinhSach, phanTramHoan, hetHanGiuCho, buoiDaKin, lichThang, lichNgay,
  docMonLe, ganAnhThucDon, tinhTuyChinh, cocCan, khoanCanTra, ghiNhanChuyenKhoan,
};
