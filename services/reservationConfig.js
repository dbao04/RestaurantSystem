/**
 * Cau hinh module dat ban - phan GHI, danh cho quan ly va quan tri.
 *
 * `reservationRules.js` chi DOC cau hinh. File nay ghi. Tach doi vi tang doc
 * duoc goi hang tram lan moi phut (moi lan kiem tra ban trong) con tang ghi
 * duoc goi vai lan mot thang - hai vong doi hoan toan khac nhau, va tach ra thi
 * khong the vo tinh goi mot ham ghi tu trong duong doc.
 *
 * Moi ham ghi deu goi `qt.xoaDemCauHinh()` de lan doc ke tiep thay ngay gia tri
 * moi. Quen buoc nay thi quan ly bam Luu, trang bao thanh cong, ma he thong van
 * chay theo cau hinh cu them 30 giay - kieu loi lam nguoi dung mat long tin vao
 * nut Luu.
 */
const db = require('../config/db');
const qt = require('./reservationRules');

const { LoiDatBan } = qt;

/**
 * Cac khoa duoc phep sua qua giao dien, kem kieu va mien gia tri.
 *
 * Danh sach trang (allowlist) chu khong phai danh sach den: mot khoa moi them
 * vao CSDL khong tu dong tro thanh sua duoc tu web. Va mien gia tri o day chan
 * cac cau hinh vo nghia truoc khi chung kip gay ra su co - vi du thoi gian giu
 * ban 0 phut se bien moi khach thanh no-show ngay khi den gio.
 */
const KHOA_CHO_PHEP = {
  default_duration_1_2: { kieu: 'so', min: 30, max: 480, nhan: 'Thời lượng 1–2 khách (phút)' },
  default_duration_3_6: { kieu: 'so', min: 30, max: 480, nhan: 'Thời lượng 3–6 khách (phút)' },
  default_duration_7_10: { kieu: 'so', min: 30, max: 480, nhan: 'Thời lượng 7–10 khách (phút)' },
  default_duration_over_10: { kieu: 'so', min: 30, max: 480, nhan: 'Thời lượng trên 10 khách (phút)' },
  turnaround_minutes: { kieu: 'so', min: 0, max: 120, nhan: 'Thời gian dọn bàn giữa hai lượt (phút)' },
  occupied_hold_minutes: { kieu: 'so', min: 0, max: 240, nhan: 'Không hứa bàn đang có khách trong (phút)' },
  grace_period_minutes: { kieu: 'so', min: 5, max: 120, nhan: 'Giữ bàn sau giờ đặt (phút)' },
  auto_no_show_minutes: { kieu: 'so', min: 0, max: 240, nhan: 'Tự động no-show sau (phút, 0 = tắt)' },
  allow_table_combination: { kieu: 'bool', nhan: 'Cho phép ghép bàn' },
  combine_same_area_only: { kieu: 'bool', nhan: 'Chỉ ghép bàn trong cùng khu vực' },
  max_tables_per_reservation: { kieu: 'so', min: 1, max: 10, nhan: 'Số bàn tối đa mỗi lượt đặt' },
  minimum_lead_minutes: { kieu: 'so', min: 0, max: 1440, nhan: 'Đặt trước tối thiểu (phút)' },
  max_advance_days: { kieu: 'so', min: 1, max: 365, nhan: 'Đặt trước tối đa (ngày)' },
  slot_step_minutes: { kieu: 'chon', chon: [15, 30], nhan: 'Bước chọn giờ (phút)' },
  auto_confirm_online: { kieu: 'bool', nhan: 'Tự động xác nhận đơn online' },
  auto_confirm_member: { kieu: 'bool', nhan: 'Tự động xác nhận khách thành viên/VIP' },
  deposit_due_minutes: { kieu: 'so', min: 15, max: 10080, nhan: 'Hạn thanh toán cọc (phút)' },
  peak_hours: { kieu: 'khung_gio', nhan: 'Khung giờ cao điểm' },
  large_group_threshold: { kieu: 'so', min: 2, max: 100, nhan: 'Từ bao nhiêu khách tính là nhóm đông' },
  max_guests_online: { kieu: 'so', min: 1, max: 200, nhan: 'Số khách tối đa đặt online' },
  no_show_block_threshold: { kieu: 'so', min: 0, max: 20, nhan: 'Chặn đặt online sau N lần no-show (0 = tắt)' },
  allow_customer_pick_table: { kieu: 'bool', nhan: 'Cho khách tự chọn bàn trên sơ đồ' },
  last_seating_minutes: { kieu: 'so', min: 0, max: 240, nhan: 'Ngừng nhận đặt trước giờ đóng cửa (phút)' },
  reminder_lead_minutes: { kieu: 'so', min: 0, max: 1440, nhan: 'Nhắc khách trước giờ đặt (phút, 0 = tắt)' },
};

const TEN_THU = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

function kiemTraGiaTri(khoa, gtRaw) {
  const dinhNghia = KHOA_CHO_PHEP[khoa];
  if (!dinhNghia) throw new LoiDatBan(`Khóa cấu hình "${khoa}" không được phép sửa`, 'BAD_KEY');

  if (dinhNghia.kieu === 'bool') return gtRaw && gtRaw !== '0' && gtRaw !== 'false' ? '1' : '0';

  if (dinhNghia.kieu === 'so' || dinhNghia.kieu === 'chon') {
    const so = Number(gtRaw);
    if (!Number.isFinite(so)) throw new LoiDatBan(`"${dinhNghia.nhan}" phải là số`, 'BAD_VALUE');
    if (dinhNghia.chon && !dinhNghia.chon.includes(so)) {
      throw new LoiDatBan(`"${dinhNghia.nhan}" chỉ nhận: ${dinhNghia.chon.join(', ')}`, 'BAD_VALUE');
    }
    if (dinhNghia.min !== undefined && so < dinhNghia.min) {
      throw new LoiDatBan(`"${dinhNghia.nhan}" tối thiểu là ${dinhNghia.min}`, 'BAD_VALUE');
    }
    if (dinhNghia.max !== undefined && so > dinhNghia.max) {
      throw new LoiDatBan(`"${dinhNghia.nhan}" tối đa là ${dinhNghia.max}`, 'BAD_VALUE');
    }
    return String(Math.round(so));
  }

  if (dinhNghia.kieu === 'khung_gio') {
    const s = String(gtRaw || '').trim();
    if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(s)) {
      throw new LoiDatBan(`"${dinhNghia.nhan}" phải có dạng HH:MM-HH:MM`, 'BAD_VALUE');
    }
    return s;
  }
  return String(gtRaw);
}

/** Doc cau hinh kem mo ta de dung ve giao dien - View khong phai tu viet nhan. */
async function docChoGiaoDien() {
  const hienTai = await qt.docCauHinh();
  return Object.entries(KHOA_CHO_PHEP).map(([khoa, d]) => ({
    khoa,
    ...d,
    gia_tri: hienTai[khoa],
  }));
}

async function luuCauHinh(values, ctx = {}) {
  const doi = [];
  const hienTai = await qt.docCauHinh();

  for (const [khoa, dinhNghia] of Object.entries(KHOA_CHO_PHEP)) {
    if (values[khoa] === undefined) {
      // O tich (checkbox) khong duoc gui khi bo tich - phai suy ra la '0',
      // neu khong thi khong bao gio TAT duoc mot tuy chon dang bat.
      if (dinhNghia.kieu !== 'bool' || !values.__form) continue;
      values[khoa] = '0';
    }
    const moi = kiemTraGiaTri(khoa, values[khoa]);
    if (String(hienTai[khoa]) !== moi) doi.push([khoa, moi, String(hienTai[khoa])]);
  }

  // Kiem tra cheo: giu ban lau hon thoi luong ngan nhat la vo ly.
  const cuoi = { ...hienTai };
  for (const [k, v] of doi) cuoi[k] = Number.isNaN(Number(v)) ? v : Number(v);
  if (Number(cuoi.grace_period_minutes) >= Number(cuoi.default_duration_1_2)) {
    throw new LoiDatBan(
      'Thời gian giữ bàn phải nhỏ hơn thời lượng sử dụng bàn ngắn nhất', 'BAD_COMBINATION');
  }

  for (const [khoa, moi] of doi) {
    await db.query(
      `INSERT INTO reservation_settings (setting_key, setting_value) VALUES (?,?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [khoa, moi]);
  }

  qt.xoaDemCauHinh();
  return { da_doi: doi.map(([k, moi, cu]) => ({ khoa: k, cu, moi, nhan: KHOA_CHO_PHEP[k].nhan })), boi: ctx.nhanVienId || null };
}

// ---------------------------------------------------------- gio mo cua

async function docGioMoCua(chiNhanhId = null) {
  const [rows] = await db.query(
    `SELECT * FROM reservation_opening_hours
      WHERE branch_id <=> ? ORDER BY weekday`, [chiNhanhId]);
  const theoThu = new Map(rows.map((r) => [Number(r.weekday), r]));
  return TEN_THU.map((ten, thu) => {
    const r = theoThu.get(thu);
    return {
      weekday: thu,
      ten,
      open_time: r ? qt.gioNgan(String(r.open_time)) : '08:00',
      close_time: r ? qt.gioNgan(String(r.close_time)) : '22:00',
      is_closed: r ? !!r.is_closed : false,
    };
  });
}

/**
 * Luu ca 7 ngay mot lan.
 *
 * Nhan tron ca tuan chu khong tung ngay: gio mo cua la mot the thong nhat, sua
 * le tung ngay qua 7 request rieng se co luc chi mot nua di qua - va nha hang
 * chay voi lich mo cua nua cu nua moi.
 */
async function luuGioMoCua(dsNgay, chiNhanhId = null) {
  if (!Array.isArray(dsNgay) || dsNgay.length !== 7) {
    throw new LoiDatBan('Cần đủ cấu hình cho cả 7 ngày trong tuần', 'BAD_INPUT');
  }
  const chuanBi = dsNgay.map((n, i) => {
    const thu = Number(n.weekday ?? i);
    const dong = !!(n.is_closed && n.is_closed !== '0');
    const mo = qt.phutTuChuoi(n.open_time);
    const dg = qt.phutTuChuoi(n.close_time);
    if (!dong && (mo === null || dg === null)) {
      throw new LoiDatBan(`${TEN_THU[thu]}: giờ mở/đóng cửa không hợp lệ`, 'BAD_TIME');
    }
    // Cho phep dong cua sau nua dem (mo 17:00 dong 02:00) - quan bar/lau dem.
    if (!dong && mo === dg) {
      throw new LoiDatBan(`${TEN_THU[thu]}: giờ mở và giờ đóng cửa không được trùng nhau`, 'BAD_TIME');
    }
    return [chiNhanhId, thu, qt.chuoiTuPhut(mo ?? 480), qt.chuoiTuPhut(dg ?? 1320), dong ? 1 : 0];
  });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const hang of chuanBi) {
      await conn.query(
        `INSERT INTO reservation_opening_hours (branch_id, weekday, open_time, close_time, is_closed)
         VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE open_time=VALUES(open_time), close_time=VALUES(close_time),
           is_closed=VALUES(is_closed)`, hang);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  qt.xoaDemCauHinh();
  return docGioMoCua(chiNhanhId);
}

// -------------------------------------------------------- ngay dong cua

async function docNgayNghi({ tuNgay = null } = {}) {
  const tu = tuNgay || qt.ngayChuoi(new Date());
  const [rows] = await db.query(
    `SELECT d.*, nv.ten AS nguoi_tao
       FROM reservation_closed_dates d LEFT JOIN nhan_vien nv ON nv.id_nv = d.created_by
      WHERE d.closed_date >= ? ORDER BY d.closed_date`, [tu]);
  return rows.map((r) => ({ ...r, closed_date: qt.ngayChuoi(r.closed_date) }));
}

async function themNgayNghi(ngay, lyDo, ctx = {}) {
  const n = qt.ngayChuoi(ngay);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(n)) throw new LoiDatBan('Ngày không hợp lệ', 'BAD_DATE');

  // Canh bao neu ngay do da co khach dat - khong chan, vi quan ly co the that
  // su phai dong cua (mat dien, tang le), nhung phai biet la co bao nhieu luot
  // can goi dien bao khach.
  const [[{ n: soLuot }]] = await db.query(
    `SELECT COUNT(*) n FROM reservations WHERE reservation_date = ? AND status IN (?)`,
    [n, qt.TRANG_THAI_GIU_CHO]);

  await db.query(
    `INSERT INTO reservation_closed_dates (branch_id, closed_date, reason, created_by)
     VALUES (NULL, ?, ?, ?) ON DUPLICATE KEY UPDATE reason = VALUES(reason)`,
    [n, String(lyDo || '').trim() || null, ctx.nhanVienId || null]);

  qt.xoaDemCauHinh();
  return { ngay: n, luot_dat_hien_co: Number(soLuot) };
}

async function xoaNgayNghi(id) {
  await db.query('DELETE FROM reservation_closed_dates WHERE id = ?', [id]);
  qt.xoaDemCauHinh();
}

// -------------------------------------------------------- chinh sach huy

async function docChinhSachHuy() {
  const [rows] = await db.query('SELECT * FROM cancellation_policies ORDER BY hours_before DESC');
  return rows;
}

async function luuChinhSachHuy(input) {
  const gio = Number(input.hours_before);
  const phanTram = Number(input.refund_percent);
  if (!Number.isFinite(gio) || gio < 0 || gio > 720) throw new LoiDatBan('Số giờ không hợp lệ', 'BAD_VALUE');
  if (!Number.isFinite(phanTram) || phanTram < 0 || phanTram > 100) {
    throw new LoiDatBan('Phần trăm hoàn tiền phải từ 0 đến 100', 'BAD_VALUE');
  }
  const apDung = ['ALL', 'VIP', 'LARGE_GROUP', 'PEAK_HOUR'].includes(String(input.applies_to).toUpperCase())
    ? String(input.applies_to).toUpperCase() : 'ALL';
  const ten = String(input.name || '').trim() || `Hủy trước ${gio} giờ — hoàn ${phanTram}%`;

  if (input.id) {
    await db.query(
      `UPDATE cancellation_policies SET name=?, hours_before=?, refund_percent=?, applies_to=?, is_active=?
        WHERE id=?`, [ten, gio, phanTram, apDung, input.is_active ? 1 : 0, input.id]);
    return { id: Number(input.id) };
  }
  const [kq] = await db.query(
    `INSERT INTO cancellation_policies (name, hours_before, refund_percent, applies_to, is_active)
     VALUES (?,?,?,?,?)`, [ten, gio, phanTram, apDung, input.is_active === undefined ? 1 : (input.is_active ? 1 : 0)]);
  return { id: kq.insertId };
}

async function xoaChinhSachHuy(id) {
  // Khong xoa han: chinh sach da tung duoc ap cho cac lan huy trong qua khu, va
  // ke toan can tra lai duoc "hoi do hoan 50% theo quy tac nao".
  await db.query('UPDATE cancellation_policies SET is_active = 0 WHERE id = ?', [id]);
}

// ---------------------------------------------------------- quy tac coc

async function docQuyTacCoc() {
  const [rows] = await db.query('SELECT * FROM reservation_deposit_rules ORDER BY priority, id');
  return rows.map((r) => ({
    ...r,
    from_time: r.from_time ? qt.gioNgan(String(r.from_time)) : null,
    to_time: r.to_time ? qt.gioNgan(String(r.to_time)) : null,
  }));
}

async function luuQuyTacCoc(input) {
  const kieu = ['NONE', 'FIXED', 'PER_GUEST'].includes(String(input.amount_type).toUpperCase())
    ? String(input.amount_type).toUpperCase() : 'FIXED';
  const apDung = ['ALL', 'VIP', 'CORPORATE', 'MEMBER', 'LARGE_GROUP', 'PEAK_HOUR']
    .includes(String(input.applies_to).toUpperCase()) ? String(input.applies_to).toUpperCase() : 'ALL';
  const soTien = Number(input.amount) || 0;
  if (soTien < 0 || soTien > 100000000) throw new LoiDatBan('Số tiền cọc không hợp lệ', 'BAD_VALUE');
  const minKhach = Math.max(1, Number(input.min_guests) || 1);
  const uuTien = Number(input.priority);
  const ten = String(input.name || '').trim();
  if (!ten) throw new LoiDatBan('Vui lòng đặt tên cho quy tắc', 'BAD_VALUE');

  const tu = input.from_time ? qt.chuoiTuPhut(qt.phutTuChuoi(input.from_time)) : null;
  const den = input.to_time ? qt.chuoiTuPhut(qt.phutTuChuoi(input.to_time)) : null;

  if (input.id) {
    await db.query(
      `UPDATE reservation_deposit_rules SET name=?, applies_to=?, min_guests=?, from_time=?, to_time=?,
         amount_type=?, amount=?, priority=?, is_active=? WHERE id=?`,
      [ten, apDung, minKhach, tu, den, kieu, soTien,
        Number.isFinite(uuTien) ? uuTien : 100, input.is_active ? 1 : 0, input.id]);
    return { id: Number(input.id) };
  }
  const [kq] = await db.query(
    `INSERT INTO reservation_deposit_rules (name, applies_to, min_guests, from_time, to_time,
       amount_type, amount, priority, is_active) VALUES (?,?,?,?,?,?,?,?,?)`,
    [ten, apDung, minKhach, tu, den, kieu, soTien,
      Number.isFinite(uuTien) ? uuTien : 100, input.is_active === undefined ? 1 : (input.is_active ? 1 : 0)]);
  return { id: kq.insertId };
}

async function xoaQuyTacCoc(id) {
  await db.query('UPDATE reservation_deposit_rules SET is_active = 0 WHERE id = ?', [id]);
}

// --------------------------------------------------------- thuoc tinh ban

/**
 * Sua thuoc tinh dat ban cua mot ban (muc 20 - quyen cua Admin).
 *
 * KHONG dong den `so_cho`, `toa_do_x/y`, `trangthai`: ba thu do thuoc man hinh
 * so do ban va luong goi mon. Mot trang cau hinh dat ban ma sua duoc suc chua
 * ban se tao ra hai cho sua cung mot so, va som muon chung se lech nhau.
 */
const THUOC_TINH_BAN = ['cho_dat_truoc', 'co_the_ghep', 'gan_cua_so', 'yen_tinh', 'phong_rieng', 'xe_lan', 'uu_tien_vip'];

async function luuThuocTinhBan(banId, input) {
  const dat = [];
  const gt = [];
  for (const cot of THUOC_TINH_BAN) {
    if (input[cot] === undefined) continue;
    dat.push(`\`${cot}\` = ?`);
    gt.push(input[cot] && input[cot] !== '0' ? 1 : 0);
  }
  if (input.nhom_ghep !== undefined) {
    dat.push('nhom_ghep = ?');
    gt.push(String(input.nhom_ghep || '').trim().slice(0, 20) || null);
  }
  if (input.ghi_chu_bao_tri !== undefined) {
    dat.push('ghi_chu_bao_tri = ?');
    gt.push(String(input.ghi_chu_bao_tri || '').trim().slice(0, 255) || null);
  }
  // Trang thai bao tri: cho phep bat/tat vi no la trang thai "ban khong dung
  // duoc", khac han bon trang thai kia (thuoc luong phuc vu). Chi chuyen giua
  // 0 va 4 - khong dung vao ban dang co khach.
  if (input.bao_tri !== undefined) {
    const bat = input.bao_tri && input.bao_tri !== '0';
    const [[b]] = await db.query('SELECT trangthai FROM ban WHERE Id_ban = ?', [banId]);
    if (!b) throw new LoiDatBan('Không tìm thấy bàn', 'NOT_FOUND');
    if (bat && Number(b.trangthai) === 1) {
      throw new LoiDatBan('Bàn đang có khách, không thể chuyển sang bảo trì', 'TABLE_BUSY');
    }
    if (bat) { dat.push('trangthai = 4'); }
    else if (Number(b.trangthai) === 4) { dat.push('trangthai = 0'); }
  }

  if (!dat.length) return;
  await db.query(`UPDATE ban SET ${dat.join(', ')} WHERE Id_ban = ?`, [...gt, banId]);
}

async function luuThuocTinhKhuVuc(khuVucId, input) {
  const dat = [];
  const gt = [];
  for (const cot of ['cho_dat_truoc', 'la_vip', 'ngoai_troi']) {
    if (input[cot] === undefined) continue;
    dat.push(`\`${cot}\` = ?`);
    gt.push(input[cot] && input[cot] !== '0' ? 1 : 0);
  }
  if (input.mau_sac !== undefined) {
    const mau = String(input.mau_sac || '').trim();
    if (mau && !/^#[0-9a-fA-F]{6}$/.test(mau)) throw new LoiDatBan('Mã màu phải có dạng #RRGGBB', 'BAD_VALUE');
    dat.push('mau_sac = ?');
    gt.push(mau || '#c8a24b');
  }
  if (!dat.length) return;
  await db.query(`UPDATE vitri SET ${dat.join(', ')} WHERE id_vitri = ?`, [...gt, khuVucId]);
}

// ------------------------------------------------------------- danh muc

/** Danh muc dung chung cho moi man hinh: trang thai, the yeu cau, khu vuc. */
async function docDanhMuc() {
  const [trangThai, theBan, theYeuCau] = await Promise.all([
    db.query('SELECT * FROM reservation_status_catalog ORDER BY sort_order').then((r) => r[0]),
    db.query('SELECT * FROM table_status_catalog ORDER BY code').then((r) => r[0]),
    db.query('SELECT * FROM reservation_tag_catalog WHERE is_active = 1 ORDER BY sort_order').then((r) => r[0]),
  ]);
  return { trang_thai: trangThai, trang_thai_ban: theBan, the_yeu_cau: theYeuCau };
}

module.exports = {
  KHOA_CHO_PHEP,
  TEN_THU,
  docChoGiaoDien,
  luuCauHinh,
  docGioMoCua,
  luuGioMoCua,
  docNgayNghi,
  themNgayNghi,
  xoaNgayNghi,
  docChinhSachHuy,
  luuChinhSachHuy,
  xoaChinhSachHuy,
  docQuyTacCoc,
  luuQuyTacCoc,
  xoaQuyTacCoc,
  luuThuocTinhBan,
  luuThuocTinhKhuVuc,
  docDanhMuc,
};
