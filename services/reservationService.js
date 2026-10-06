/**
 * Module DAT BAN - tang dieu phoi.
 *
 * File nay giu VONG DOI cua mot luot dat ban: tao, doi lich, gan ban, chuyen
 * trang thai, huy, hoan tien, thong ke. No khong tu quyet dinh luat (hoi
 * `reservationRules`) va khong tu tim ban (hoi `reservationTables`).
 *
 * ---------------------------------------------------------------------------
 * BA NGUYEN TAC XUYEN SUOT
 * ---------------------------------------------------------------------------
 * 1. MOI THAY DOI DEU DE LAI DAU VET.
 *    Khong co lenh UPDATE nao doi trang thai ma khong ghi kem mot dong vao
 *    `reservation_history`. Khi khach goi len hoi "sao ban toi bi huy", cau tra
 *    loi phai co trong CSDL chu khong nam trong tri nho cua ai do.
 *
 * 2. GIU CHO BAN VA GHI RESERVATION LA MOT GIAO DICH.
 *    Ban duoc giu bang cach ghi vao `reservation_slot_locks` trong CUNG
 *    transaction voi dong `reservations`. Khong bao gio co reservation ma khong
 *    giu ban, cung khong bao gio co ban bi giu boi mot reservation khong ton tai.
 *
 * 3. TRANG THAI CHI DI THEO MAY TRANG THAI.
 *    Moi buoc chuyen deu qua `qt.batBuocChuyenDuoc`. Khong route nao duoc phep
 *    UPDATE thang cot `status` - neu can trang thai moi thi them vao
 *    CHUYEN_TRANG_THAI, de moi nguoi cung nhin thay.
 */
const db = require('../config/db');
const qt = require('./reservationRules');
const xb = require('./reservationTables');
const { ngayCucBo } = require('../utils/thoiGian');

const { LoiDatBan } = qt;

/** Cot cua `reservations` duoc tra ve moi noi - giu mot cho de khong lech nhau. */
const COT_RSV = `
  r.id, r.reservation_code, r.branch_id, r.customer_id, r.customer_name, r.phone, r.email,
  r.reservation_date, r.start_time, r.expected_end_time, r.duration_minutes, r.turnaround_minutes,
  r.guest_count, r.area_id, r.customer_type, r.source, r.status,
  r.deposit_status, r.deposit_amount, r.deposit_due_at,
  r.special_requests, r.occasion, r.tags, r.notes, r.manual_tables,
  r.assigned_staff_id, r.created_by, r.updated_by,
  r.hold_until, r.confirmed_at, r.arrived_at, r.seated_at, r.completed_at, r.closed_at,
  r.cancel_reason, r.cancelled_by, r.refund_percent, r.refund_amount,
  r.no_show_count_at_booking, r.reminder_sent_at, r.no_show_warned_at,
  r.created_at, r.updated_at`;

// ------------------------------------------------------------- tien ich

/** JSON tu CSDL co the la chuoi (MariaDB) hoac object (MySQL 8) - chuan hoa. */
function docJson(gt, macDinh = []) {
  if (gt == null) return macDinh;
  if (typeof gt === 'object') return gt;
  try { return JSON.parse(gt); } catch (e) { return macDinh; }
}

/**
 * Bo sung cac truong tinh toan ma moi man hinh deu can.
 *
 * Tinh o day thay vi trong View: bon man hinh (khach, nhan vien, quan ly, API)
 * cung phai tra loi "con bao lau nua den gio" giong het nhau. De moi View tu
 * tinh la de bon cau tra loi khac nhau.
 */
function lamGiau(r) {
  if (!r) return null;
  const ngay = qt.ngayChuoi(r.reservation_date);
  const batDau = qt.ghepMoc(ngay, String(r.start_time));
  const ketThuc = qt.ghepMoc(ngay, String(r.expected_end_time));
  if (ketThuc <= batDau) ketThuc.setDate(ketThuc.getDate() + 1);
  const bayGio = Date.now();

  return {
    ...r,
    reservation_date: ngay,
    start_time: String(r.start_time),
    expected_end_time: String(r.expected_end_time),
    gio: qt.gioNgan(String(r.start_time)),
    gio_ket_thuc: qt.gioNgan(String(r.expected_end_time)),
    tags: docJson(r.tags, []),
    ban: r.table_names ? String(r.table_names).split(', ') : [],
    nhan_trang_thai: qt.NHAN_TRANG_THAI[r.status] || r.status,
    dang_hieu_luc: qt.TRANG_THAI_GIU_CHO.includes(r.status),
    /** Am = da qua gio. Dung cho dong ho dem nguoc va canh bao no-show. */
    con_lai_phut: Math.round((batDau.getTime() - bayGio) / 60000),
    /** Da qua han giu ban chua? Nhan vien nhin cot nay de goi dien cho khach. */
    qua_han_giu: !!r.hold_until && new Date(r.hold_until).getTime() < bayGio
      && ['CONFIRMED', 'PENDING'].includes(r.status),
    con_giu_phut: r.hold_until ? Math.round((new Date(r.hold_until).getTime() - bayGio) / 60000) : null,
    /** Bàn dang duoc dung, con bao lau thi het gio (case "bàn sap het thoi gian"). */
    con_tren_ban_phut: r.status === 'SEATED' ? Math.round((ketThuc.getTime() - bayGio) / 60000) : null,
  };
}

/**
 * Ghi mot dong nhat ky. Luon goi TRONG transaction cua thao tac tuong ung.
 *
 * Ghi ngoai transaction se tao ra nhat ky ke ve mot su kien da bi rollback -
 * te hon la khong co nhat ky, vi no lam nguoi doc tin vao dieu khong xay ra.
 */
async function ghiNhatKy(conn, reservationId, tu, den, ghiChu, boi) {
  await conn.query(
    `INSERT INTO reservation_history (reservation_id, from_status, to_status, note, changed_by)
     VALUES (?,?,?,?,?)`, [reservationId, tu, den, ghiChu || null, boi || null]);
}

/**
 * Xep hang mot thong bao. Bo phat that do `reservationJobs` lo.
 *
 * Khong gui email/socket ngay tai day vi hai ly do: (1) gui mail cham va co the
 * loi, khong duoc phep lam hong mot transaction dat ban da thanh cong;
 * (2) thong bao phai gui SAU khi commit - gui truoc roi rollback thi khach nhan
 * duoc mail xac nhan cho mot reservation khong ton tai.
 */
async function xepThongBao(conn, { reservationId, suKien, nguoiNhan = null, kenh = 'IN_APP', duLieu = null }) {
  await conn.query(
    `INSERT INTO reservation_notifications (reservation_id, channel, event_key, recipient, status, payload)
     VALUES (?,?,?,?, 'PENDING', ?)`,
    [reservationId || null, kenh, suKien, nguoiNhan, duLieu ? JSON.stringify(duLieu) : null]);
}

// ------------------------------------------------------------ ho so khach

/**
 * Doc ho so khach theo so dien thoai. Tra ve ho so rong neu chua tung dat.
 *
 * Ho so nay quyet dinh ba thu: co bi chan dat khong, loai khach (VIP...), va
 * canh bao rui ro no-show cho nhan vien.
 */
async function hoSoKhach(dienThoai) {
  const so = qt.chuanHoaDienThoai(dienThoai);
  if (!so) return null;
  const [rows] = await db.query('SELECT * FROM reservation_customers WHERE phone = ?', [so]);
  if (!rows.length) {
    return {
      phone: so, full_name: null, customer_type: 'NEW', total_reservations: 0,
      completed_count: 0, no_show_count: 0, cancelled_count: 0,
      preferences: {}, is_blocked: 0, la_khach_moi: true,
    };
  }
  const ho = rows[0];
  return {
    ...ho,
    preferences: docJson(ho.preferences, {}),
    la_khach_moi: false,
    ty_le_no_show: ho.total_reservations
      ? Math.round((ho.no_show_count / ho.total_reservations) * 100)
      : 0,
  };
}

/** Cap nhat bo dem ho so khach sau moi thay doi trang thai. */
async function capNhatHoSoKhach(conn, dienThoai) {
  await conn.query(
    `INSERT INTO reservation_customers
       (phone, customer_id, full_name, email, customer_type,
        total_reservations, completed_count, no_show_count, cancelled_count, last_visit_date)
     SELECT r.phone, MAX(r.customer_id),
            SUBSTRING_INDEX(GROUP_CONCAT(r.customer_name ORDER BY r.created_at DESC), ',', 1),
            MAX(r.email),
            CASE
              WHEN SUM(r.customer_type = 'VIP') > 0 THEN 'VIP'
              WHEN SUM(r.customer_type = 'CORPORATE') > 0 THEN 'CORPORATE'
              WHEN SUM(r.customer_type = 'MEMBER') > 0 THEN 'MEMBER'
              WHEN COUNT(*) > 1 THEN 'REGULAR'
              ELSE 'NEW'
            END,
            COUNT(*), SUM(r.status = 'COMPLETED'), SUM(r.status = 'NO_SHOW'),
            SUM(r.status = 'CANCELLED'),
            MAX(CASE WHEN r.status = 'COMPLETED' THEN r.reservation_date END)
       FROM reservations r
      WHERE r.phone = ?
      GROUP BY r.phone
     ON DUPLICATE KEY UPDATE
        full_name = VALUES(full_name),
        email = COALESCE(VALUES(email), email),
        /* KHONG ha loai khach: quan ly da gan VIP thi mot don dat moi voi loai
           REGULAR khong duoc phep xoa nhan do. Chi nang len. */
        customer_type = CASE
          WHEN reservation_customers.customer_type = 'VIP' THEN 'VIP'
          WHEN reservation_customers.customer_type = 'CORPORATE'
               AND VALUES(customer_type) <> 'VIP' THEN 'CORPORATE'
          ELSE VALUES(customer_type) END,
        total_reservations = VALUES(total_reservations),
        completed_count = VALUES(completed_count),
        no_show_count = VALUES(no_show_count),
        cancelled_count = VALUES(cancelled_count),
        last_visit_date = VALUES(last_visit_date)`, [dienThoai]);
}

/** Quan ly sua ho so khach: gan VIP, ghi chu, so thich, chan dat. */
async function luuHoSoKhach(dienThoai, input) {
  const so = qt.chuanHoaDienThoai(dienThoai);
  if (!so) throw new LoiDatBan('Số điện thoại không hợp lệ', 'BAD_PHONE');
  const loai = String(input.customer_type || '').toUpperCase();
  await db.query(
    `INSERT INTO reservation_customers (phone, full_name, customer_type, internal_note, preferences, is_blocked)
     VALUES (?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       full_name = COALESCE(VALUES(full_name), full_name),
       customer_type = COALESCE(VALUES(customer_type), customer_type),
       internal_note = VALUES(internal_note),
       preferences = VALUES(preferences),
       is_blocked = VALUES(is_blocked)`,
    [so, String(input.full_name || '').trim() || 'Khách',
      qt.LOAI_KHACH.includes(loai) ? loai : null,
      input.internal_note || null,
      JSON.stringify(input.preferences || {}),
      input.is_blocked ? 1 : 0]);
  return hoSoKhach(so);
}

// ------------------------------------------------------------------ doc

/**
 * Danh sach reservation theo bo loc.
 *
 * `gioi_han` mac dinh 500: mot ngay dong khach cua nha hang 40 ban khong the
 * vuot con so nay, con man hinh phan tich thi da co ham rieng - khong ai can
 * keo ca chuc nghin dong vao bo nho de dem.
 */
async function danhSach(loc = {}) {
  const dieuKien = [];
  const thamSo = [];

  if (loc.id) { dieuKien.push('r.id = ?'); thamSo.push(loc.id); }
  if (loc.ma) { dieuKien.push('r.reservation_code = ?'); thamSo.push(String(loc.ma).trim().toUpperCase()); }
  if (loc.ngay) { dieuKien.push('r.reservation_date = ?'); thamSo.push(qt.ngayChuoi(loc.ngay)); }
  if (loc.tu_ngay) { dieuKien.push('r.reservation_date >= ?'); thamSo.push(qt.ngayChuoi(loc.tu_ngay)); }
  if (loc.den_ngay) { dieuKien.push('r.reservation_date <= ?'); thamSo.push(qt.ngayChuoi(loc.den_ngay)); }
  if (loc.dien_thoai) { dieuKien.push('r.phone = ?'); thamSo.push(qt.chuanHoaDienThoai(loc.dien_thoai)); }
  if (loc.khu_vuc) { dieuKien.push('r.area_id = ?'); thamSo.push(loc.khu_vuc); }
  if (loc.chi_nhanh) { dieuKien.push('r.branch_id = ?'); thamSo.push(loc.chi_nhanh); }
  if (loc.nguon) { dieuKien.push('r.source = ?'); thamSo.push(String(loc.nguon).toUpperCase()); }
  if (loc.loai_khach) { dieuKien.push('r.customer_type = ?'); thamSo.push(String(loc.loai_khach).toUpperCase()); }

  if (loc.trang_thai) {
    const ds = String(loc.trang_thai).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (ds.length) { dieuKien.push('r.status IN (?)'); thamSo.push(ds); }
  }
  if (loc.dang_hieu_luc) { dieuKien.push('r.status IN (?)'); thamSo.push(qt.TRANG_THAI_GIU_CHO); }

  if (loc.tim) {
    // Tim theo ten, so dien thoai hoac ma - mot o tim kiem duy nhat tren giao dien.
    const t = `%${String(loc.tim).trim()}%`;
    dieuKien.push('(r.customer_name LIKE ? OR r.phone LIKE ? OR r.reservation_code LIKE ?)');
    thamSo.push(t, t, t.toUpperCase());
  }

  const gioiHan = Math.min(1000, Math.max(1, Number(loc.gioi_han) || 500));

  const [rows] = await db.query(
    `SELECT ${COT_RSV},
            GROUP_CONCAT(b.number_ban ORDER BY b.number_ban SEPARATOR ', ') AS table_names,
            GROUP_CONCAT(b.Id_ban ORDER BY b.number_ban) AS table_ids,
            COALESCE(SUM(rt.seats), 0) AS tong_cho,
            v.Name_vitri AS area_name,
            kh.no_show_count AS khach_no_show,
            kh.total_reservations AS khach_tong_luot
       FROM reservations r
       LEFT JOIN reservation_tables rt ON rt.reservation_id = r.id
       LEFT JOIN ban b ON b.Id_ban = rt.table_id
       LEFT JOIN vitri v ON v.id_vitri = r.area_id
       LEFT JOIN reservation_customers kh ON kh.phone = r.phone
      ${dieuKien.length ? `WHERE ${dieuKien.join(' AND ')}` : ''}
      GROUP BY r.id
      ORDER BY r.reservation_date ${loc.moi_nhat ? 'DESC' : 'ASC'}, r.start_time ${loc.moi_nhat ? 'DESC' : 'ASC'}
      LIMIT ${gioiHan}`, thamSo);

  return rows.map(lamGiau);
}

async function chiTiet(id) {
  const ds = await danhSach({ id, gioi_han: 1 });
  if (!ds.length) return null;
  const r = ds[0];

  const [[nhatKy], [coc], [thongBao]] = await Promise.all([
    db.query(
      `SELECT h.*, nv.ten AS ten_nhan_vien
         FROM reservation_history h
         LEFT JOIN nhan_vien nv ON nv.id_nv = h.changed_by
        WHERE h.reservation_id = ? ORDER BY h.created_at ASC, h.id ASC`, [id]),
    db.query('SELECT * FROM reservation_deposits WHERE reservation_id = ? ORDER BY id DESC', [id]),
    db.query(
      'SELECT event_key, channel, status, created_at, sent_at FROM reservation_notifications WHERE reservation_id = ? ORDER BY id DESC LIMIT 30',
      [id]),
  ]);

  return {
    ...r,
    nhat_ky: nhatKy,
    coc: coc,
    thong_bao: thongBao,
    ho_so_khach: await hoSoKhach(r.phone),
  };
}

/**
 * Tra cuu cho KHACH: bat buoc phai co ca ma lan so dien thoai.
 *
 * Ma reservation mot minh la khong du: no ngan, in tren mail va co the bi doan
 * hoac nhin trom. Ghep them so dien thoai bien no thanh mot cap kho doan ma
 * khach van nho duoc, khong can tao tai khoan.
 */
async function traCuuChoKhach(ma, dienThoai) {
  const so = qt.chuanHoaDienThoai(dienThoai);
  const [rows] = await db.query(
    `SELECT ${COT_RSV},
            GROUP_CONCAT(b.number_ban ORDER BY b.number_ban SEPARATOR ', ') AS table_names,
            v.Name_vitri AS area_name
       FROM reservations r
       LEFT JOIN reservation_tables rt ON rt.reservation_id = r.id
       LEFT JOIN ban b ON b.Id_ban = rt.table_id
       LEFT JOIN vitri v ON v.id_vitri = r.area_id
      WHERE r.reservation_code = ? AND r.phone = ?
      GROUP BY r.id LIMIT 1`, [String(ma || '').trim().toUpperCase(), so]);
  if (!rows.length) return null;
  const resObj = lamGiau(rows[0]);
  const [preorders] = await db.query(
    `SELECT dish_id, dish_name, price, quantity, note FROM reservation_preorders WHERE reservation_id = ?`,
    [resObj.id]
  ).catch(() => [[]]);
  resObj.mon_dat_truoc = preorders;
  return resObj;
}

/** Lich su cua mot so dien thoai - dung o man hinh nhan vien va trang tra cuu. */
async function lichSuKhach(dienThoai, { gioiHan = 50 } = {}) {
  const so = qt.chuanHoaDienThoai(dienThoai);
  const [rows] = await db.query(
    `SELECT r.reservation_code, r.reservation_date, r.start_time, r.guest_count,
            r.customer_type, r.source, r.status, r.deposit_status, r.deposit_amount,
            r.occasion, r.cancel_reason,
            GROUP_CONCAT(b.number_ban ORDER BY b.number_ban SEPARATOR ', ') AS table_names
       FROM reservations r
       LEFT JOIN reservation_tables rt ON rt.reservation_id = r.id
       LEFT JOIN ban b ON b.Id_ban = rt.table_id
      WHERE r.phone = ?
      GROUP BY r.id
      ORDER BY r.reservation_date DESC, r.start_time DESC
      LIMIT ${Math.min(200, Number(gioiHan) || 50)}`, [so]);
  return rows.map((r) => ({
    ...r,
    reservation_date: qt.ngayChuoi(r.reservation_date),
    gio: qt.gioNgan(String(r.start_time)),
    nhan_trang_thai: qt.NHAN_TRANG_THAI[r.status] || r.status,
  }));
}

/** Lich su dat ban cua tai khoan khach hang (tim theo customer_id hoac phone) */
async function lichSuKhachTheoTaiKhoan(userId, phone, { gioiHan = 50 } = {}) {
  const so = phone ? qt.chuanHoaDienThoai(phone) : '';
  const [rows] = await db.query(
    `SELECT r.id, r.reservation_code, r.reservation_date, r.start_time, r.expected_end_time, r.duration_minutes,
            r.guest_count, r.customer_name, r.phone, r.email, r.customer_type, r.source, r.status,
            r.deposit_status, r.deposit_amount, r.occasion, r.special_requests, r.cancel_reason,
            v.Name_vitri AS area_name,
            GROUP_CONCAT(b.number_ban ORDER BY b.number_ban SEPARATOR ', ') AS table_names
       FROM reservations r
       LEFT JOIN reservation_tables rt ON rt.reservation_id = r.id
       LEFT JOIN ban b ON b.Id_ban = rt.table_id
       LEFT JOIN vitri v ON v.id_vitri = r.area_id
      WHERE (r.customer_id = ? OR (r.phone = ? AND ? != ''))
      GROUP BY r.id
      ORDER BY r.reservation_date DESC, r.start_time DESC, r.id DESC
      LIMIT ${Math.min(200, Number(gioiHan) || 50)}`,
    [userId || 0, so, so]
  );

  const rsvIds = rows.map((r) => r.id);
  let preordersByRsv = {};
  if (rsvIds.length > 0) {
    const [preorderRows] = await db.query(
      `SELECT reservation_id, dish_id, dish_name, price, quantity, note
         FROM reservation_preorders
        WHERE reservation_id IN (?)`,
      [rsvIds]
    ).catch(() => [[]]);
    preorderRows.forEach((p) => {
      if (!preordersByRsv[p.reservation_id]) preordersByRsv[p.reservation_id] = [];
      preordersByRsv[p.reservation_id].push(p);
    });
  }

  return rows.map((r) => ({
    ...r,
    reservation_date: qt.ngayChuoi(r.reservation_date),
    gio: qt.gioNgan(String(r.start_time)),
    gio_ket_thuc: qt.gioNgan(String(r.expected_end_time)),
    ban: r.table_names ? String(r.table_names).split(', ') : [],
    nhan_trang_thai: qt.NHAN_TRANG_THAI[r.status] || r.status,
    mon_dat_truoc: preordersByRsv[r.id] || [],
  }));
}

// --------------------------------------------------------------- kiem tra

/**
 * Kiem tra kha dung + goi y ban, KHONG ghi gi.
 *
 * Day la ham dung sau nut "Kiem tra ban trong" cua khach va sau man hinh chon
 * ban cua nhan vien. Khi het ban, no khong dung lai o mot cau bao loi ma tra
 * ve luon khung gio thay the va khu vuc thay the (case 1 cua de bai) - vi cau
 * hoi tiep theo cua khach chac chan se la "vay con gio nao?".
 */
async function kiemTraKhaDung(input, { laOnline = true, boQuaId = null } = {}) {
  const ch = await qt.docCauHinh();
  const khach = qt.kiemTraThongTinKhach(
    { ...input, customer_name: input.customer_name || 'Khách', phone: input.phone || '0000000000' },
    ch, { laOnline });
  const khung = qt.phanTichKhungGio(input, ch);

  qt.kiemTraQuaKhu(khung);
  qt.kiemTraDatQuaXa(khung, ch);
  await qt.kiemTraGioMoCua(khung, input.branch_id || null);
  qt.kiemTraDatSatGio(khung, ch, { boQua: !laOnline });

  const dsThe = await qt.chuanHoaThe(input.tags);
  const goi = await xb.goiYXepBan(khung, {
    soKhach: khach.soKhach,
    areaId: input.area_id || null,
    dsThe,
    loaiKhach: khach.loaiKhach,
    boQuaId,
  });

  const coc = await qt.tinhTienCoc({
    soKhach: khach.soKhach,
    gioBatDau: khung.batDau,
    loaiKhach: khach.loaiKhach,
  });

  const kq = {
    khung: {
      ngay: khung.ngay,
      tu: qt.gioNgan(khung.batDau),
      den: qt.gioNgan(khung.ketThuc),
      thoi_luong: khung.thoiLuong,
      dem_don: khung.demDon,
    },
    so_khach: khach.soKhach,
    con_ban: !!goi.chon,
    goi_y: goi.chon,
    phuong_an: goi.phuongAn,
    ban_trong: goi.banTrong.map((b) => ({ id: b.id, ten: b.ten, so_cho: b.so_cho, khu_vuc: b.khu_vuc })),
    so_thich: goi.soThich || [],
    coc,
    cho_khach_chon_ban: Number(ch.allow_customer_pick_table) === 1,
  };

  if (!goi.chon) {
    kq.thong_diep = input.area_id
      ? 'Khu vực bạn chọn đã kín trong khung giờ này.'
      : 'Rất tiếc, nhà hàng đã kín bàn trong khung giờ này.';
    kq.gio_thay_the = await xb.khungGioThayThe(khung, {
      soKhach: khach.soKhach, areaId: input.area_id || null, dsThe, loaiKhach: khach.loaiKhach,
    });
    kq.khu_thay_the = input.area_id
      ? await xb.khuVucThayThe(khung, { soKhach: khach.soKhach, boQuaAreaId: input.area_id, dsThe, loaiKhach: khach.loaiKhach })
      : [];
  }
  return kq;
}

// -------------------------------------------------------------------- tao

/**
 * Quyet dinh trang thai khoi tao.
 *
 * Nhan vien tao thi da co nguoi that xac nhan roi - vao thang CONFIRMED. Khach
 * dat online thi mac dinh cho nhan vien duyet, tru khi quan ly bat tu dong
 * duyet, hoac khach la thanh vien/VIP quen thuoc.
 */
function trangThaiKhoiTao(nguon, loaiKhach, ch) {
  if (nguon === 'WALK_IN') return 'ARRIVED';
  if (nguon === 'STAFF' || nguon === 'PHONE') return 'CONFIRMED';
  if (Number(ch.auto_confirm_online) === 1) return 'CONFIRMED';
  if (Number(ch.auto_confirm_member) === 1 && ['MEMBER', 'VIP', 'CORPORATE'].includes(loaiKhach)) return 'CONFIRMED';
  return 'PENDING';
}

/**
 * Tao mot luot dat ban.
 *
 * `ctx`:
 *   nhanVienId  - nguoi thao tac (null neu khach tu dat)
 *   laNhanVien  - duoc bo qua rang buoc dat sat gio va tran so khach online
 *   choWaitlist - khi het ban thi dua vao danh sach cho thay vi bao loi
 */
async function taoLuotDat(input, ctx = {}) {
  const ch = await qt.docCauHinh();
  const laNhanVien = !!ctx.laNhanVien;

  const khach = qt.kiemTraThongTinKhach(input, ch, { laOnline: !laNhanVien });
  const khung = qt.phanTichKhungGio({ ...input, guest_count: khach.soKhach }, ch);

  // Khach vang lai duoc phep nam trong qua khu gan - xem chu thich cua kiemTraQuaKhu.
  qt.kiemTraQuaKhu(khung, { luiToiDaPhut: khach.nguon === 'WALK_IN' ? 60 : 1 });
  qt.kiemTraDatQuaXa(khung, ch);
  await qt.kiemTraGioMoCua(khung, input.branch_id || null);
  qt.kiemTraDatSatGio(khung, ch, { boQua: laNhanVien });

  const ho = await hoSoKhach(khach.dienThoai);

  // Khach bi chan: chan o dau vao chu khong de tao roi huy - de nhan vien khong
  // phai don, va de khach nhan duoc cau tra loi ngay lap tuc.
  if (ho && ho.is_blocked && !laNhanVien) {
    throw new LoiDatBan(
      'Số điện thoại này hiện không đặt bàn trực tuyến được. '
      + 'Vui lòng liên hệ trực tiếp nhà hàng để được hỗ trợ.', 'BLOCKED');
  }

  /*
    Chan dat online voi khach co lich su no-show day (case 25).

    Khong chan vinh vien va khong chan nhan vien: nguoi that van co the nhan
    don sau khi noi chuyen voi khach, hoac yeu cau dat coc. Chan may moc mot
    khach hang that la cai gia dat hon mot ban trong.
  */
  const nguongNoShow = Number(ch.no_show_block_threshold) || 0;
  if (!laNhanVien && nguongNoShow > 0 && ho && ho.no_show_count >= nguongNoShow) {
    throw new LoiDatBan(
      `Số điện thoại này có ${ho.no_show_count} lần đặt bàn nhưng không đến. `
      + 'Vui lòng gọi trực tiếp cho nhà hàng để đặt bàn — chúng tôi vẫn rất mong được đón bạn.',
      'NO_SHOW_RISK');
  }

  // Loai khach: ho so da co (VIP quan ly gan) thang gia tri client gui len.
  const loaiKhach = (ho && ho.customer_type && ho.customer_type !== 'NEW')
    ? ho.customer_type
    : khach.loaiKhach;

  const dsThe = await qt.chuanHoaThe(input.tags);
  const banChiDinh = Array.isArray(input.table_ids) && input.table_ids.length
    ? input.table_ids
    : (input.table_ids ? String(input.table_ids).split(',').filter(Boolean) : null);

  // Khach chi duoc tu chon ban khi quan ly cho phep.
  if (banChiDinh && !laNhanVien && Number(ch.allow_customer_pick_table) !== 1) {
    throw new LoiDatBan('Nhà hàng đang tự sắp xếp bàn cho khách', 'PICK_DISABLED');
  }

  const coc = await qt.tinhTienCoc({ soKhach: khach.soKhach, gioBatDau: khung.batDau, loaiKhach });

  /*
    VONG THU LAI KHI MAT BAN DO DUA.

    Kiem tra ban trong va ghi o luoi khong nam trong cung mot khoanh khac: giua
    hai buoc do, mot khach khac co the da lay mat dung cai ban he thong vua dinh
    xep. CSDL bat duoc (loi RACE_LOST) - nhung bao khach "ban vua co nguoi dat
    mat" trong khi nha hang con 30 ban trong la mot cau tra loi te.

    Nen: neu BAN DO HE THONG TU CHON, thu lai - lan sau se chon ban khac. Neu
    KHACH TU CHON ban tren so do thi KHONG thu lai: doi ban cua ho sang ban khac
    ma khong hoi la lam sai y ho, luc do phai bao de ho chon lai.

    Ba lan la du: thua ba lan lien tiep tren cung mot khung gio gan nhu khong
    xay ra, va tran nay bao dam vong lap khong bao gio quay man.
  */
  const SO_LAN_THU = (banChiDinh && banChiDinh.length) ? 1 : 3;
  let loiCuoi = null;

  for (let lan = 1; lan <= SO_LAN_THU; lan += 1) {
    try {
      let goi;
      try {
        goi = await xb.goiYXepBan(khung, {
          soKhach: khach.soKhach,
          areaId: input.area_id || null,
          dsThe,
          loaiKhach,
          banChiDinh,
        });
      } catch (e) {
        // Ban khach chon vua bi lay mat: van cho phep vao danh sach cho neu duoc yeu cau.
        if (!ctx.choWaitlist) throw e;
        goi = { chon: null };
      }

      // Het ban.
      if (!goi.chon && !ctx.choWaitlist) {
        const loi = new LoiDatBan(
          input.area_id
            ? 'Khu vực bạn chọn đã kín trong khung giờ này. Vui lòng chọn khu vực hoặc giờ khác.'
            : 'Rất tiếc, nhà hàng đã kín bàn trong khung giờ này.',
          'FULL');
        loi.chiTiet = {
          gio_thay_the: await xb.khungGioThayThe(khung, {
            soKhach: khach.soKhach, areaId: input.area_id || null, dsThe, loaiKhach,
          }),
          khu_thay_the: input.area_id
            ? await xb.khuVucThayThe(khung, { soKhach: khach.soKhach, boQuaAreaId: input.area_id, dsThe, loaiKhach })
            : [],
        };
        throw loi;
      }

      const vaoWaitlist = !goi.chon;
      const trangThai = vaoWaitlist ? 'WAITLIST' : trangThaiKhoiTao(khach.nguon, loaiKhach, ch);

      // Han giu ban: chi co nghia khi da co ban. Trong danh sach cho thi khong giu gi.
      const hanGiu = vaoWaitlist ? null
        : qt.moc(new Date(khung.mocBatDau.getTime() + Number(ch.grace_period_minutes) * 60000));
      const hanCoc = coc.soTien > 0
        ? qt.moc(new Date(Math.min(
          Date.now() + Number(ch.deposit_due_minutes) * 60000,
          khung.mocBatDau.getTime())))
        : null;

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        // Sinh ma - thu lai neu dung ma da co. Xac suat gan bang khong nhung
        // `reservation_code` la UNIQUE nen mot lan trung se lam hong ca don dat.
        let ma = qt.taoMa(khung.ngay);
        for (let i = 0; i < 5; i += 1) {
          const [[da]] = await conn.query('SELECT 1 AS co FROM reservations WHERE reservation_code = ?', [ma]);
          if (!da) break;
          ma = qt.taoMa(khung.ngay);
        }

        const [ketQua] = await conn.query(
          `INSERT INTO reservations
            (reservation_code, branch_id, customer_id, customer_name, phone, email,
             reservation_date, start_time, expected_end_time, duration_minutes, turnaround_minutes,
             guest_count, area_id, customer_type, source, status,
             deposit_status, deposit_amount, deposit_due_at,
             special_requests, occasion, tags, notes, manual_tables,
             assigned_staff_id, created_by, updated_by, hold_until,
             confirmed_at, arrived_at, no_show_count_at_booking)
           VALUES (?,?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?,?, ?,?,?,?,?, ?,?,?,?, ?,?,?)`,
          [ma, input.branch_id || null, input.customer_id || null, khach.ten, khach.dienThoai, khach.email,
            khung.ngay, khung.batDau, khung.ketThuc, khung.thoiLuong, khung.demDon,
            khach.soKhach, input.area_id || null, loaiKhach, khach.nguon, trangThai,
            coc.soTien > 0 ? 'UNPAID' : 'NOT_REQUIRED', coc.soTien, hanCoc,
            String(input.special_requests || '').trim() || null,
            String(input.occasion || '').trim() || null,
            JSON.stringify(dsThe),
            String(input.notes || '').trim() || null,
            banChiDinh ? 1 : 0,
            ctx.nhanVienId || null, ctx.nhanVienId || null, ctx.nhanVienId || null, hanGiu,
            trangThai === 'CONFIRMED' ? new Date() : null,
            trangThai === 'ARRIVED' ? new Date() : null,
            ho ? ho.no_show_count : 0]);

        const id = ketQua.insertId;

        if (!vaoWaitlist) {
          // Hai lenh nay phai di lien nhau va trong cung transaction: chiemO la cai
          // giu cho that (CSDL chan trung), ghiBan chi la ban doc de hien thi.
          await xb.chiemO(conn, id, goi.chon.ban.map((b) => b.id), khung);
          await xb.ghiBan(conn, id, goi.chon.ban);
        }

        // Luu danh sach mon goi truoc (neu co)
        const dsMon = Array.isArray(input.items) ? input.items : [];
        if (dsMon.length > 0) {
          for (const item of dsMon) {
            const dishId = Number(item.dish_id || item.id_mon) || 0;
            const dishName = String(item.dish_name || item.name_mon || '').trim();
            const price = Number(item.price || item.gia_mon) || 0;
            const qty = Math.max(1, Number(item.quantity || item.soluong) || 1);
            const note = String(item.note || item.ghichu || '').trim() || null;
            if (dishId > 0 && dishName) {
              await conn.query(
                `INSERT INTO reservation_preorders (reservation_id, dish_id, dish_name, price, quantity, note)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, dishId, dishName, price, qty, note]
              );
            }
          }
        }

        await ghiNhatKy(conn, id, null, trangThai,
          vaoWaitlist ? 'Vào danh sách chờ (hết bàn)' : `Tạo lượt đặt · ${goi.chon.ban.map((b) => b.ten).join(', ')}` + (dsMon.length > 0 ? ` (Gồm ${dsMon.length} món gọi trước)` : ''),
          ctx.nhanVienId);

        await capNhatHoSoKhach(conn, khach.dienThoai);
        await xepThongBao(conn, {
          reservationId: id,
          suKien: vaoWaitlist ? 'RESERVATION_WAITLISTED' : 'RESERVATION_CREATED',
          nguoiNhan: khach.email,
          duLieu: { ma, ngay: khung.ngay, gio: qt.gioNgan(khung.batDau), so_khach: khach.soKhach },
        });

        await conn.commit();
        return {
          id,
          ma,
          trang_thai: trangThai,
          vao_danh_sach_cho: vaoWaitlist,
          ban: vaoWaitlist ? [] : goi.chon.ban,
          khung: {
            ngay: khung.ngay,
            tu: qt.gioNgan(khung.batDau),
            den: qt.gioNgan(khung.ketThuc),
            thoi_luong: khung.thoiLuong,
          },
          so_khach: khach.soKhach,
          coc,
          han_coc: hanCoc,
          khach: { ten: khach.ten, dien_thoai: khach.dienThoai, email: khach.email, loai: loaiKhach },
        };
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    } catch (e) {
      // Chi thu lai dung loi mat ban do dua. Moi loi khac (het ban, sai du lieu,
      // CSDL hong) phai bao ra ngay - thu lai chi lam cham them.
      if (e.ma !== 'RACE_LOST' || lan === SO_LAN_THU) throw e;
      loiCuoi = e;
      console.warn(`[dat-ban] mất bàn do đua, thử lại lần ${lan + 1}/${SO_LAN_THU}`);
    }
  }
  throw loiCuoi;
}

/**
 * Khach den truc tiep khong dat truoc (muc 6).
 *
 * Khac biet duy nhat so voi taoLuotDat: gio bat dau la BAY GIO va trang thai
 * vao thang ARRIVED. Nhan vien chi con bam mot nut "Xep ban" nua la xong.
 */
async function taoWalkIn(input, ctx = {}) {
  const ch = await qt.docCauHinh();
  const bayGio = new Date();
  // Lam tron xuong dau o de walk-in xep vao dung luoi voi cac luot dat truoc.
  const batDau = qt.troVeDauO(bayGio);

  const kq = await taoLuotDat({
    ...input,
    reservation_date: ngayCucBo(batDau),
    start_time: `${String(batDau.getHours()).padStart(2, '0')}:${String(batDau.getMinutes()).padStart(2, '0')}`,
    source: 'WALK_IN',
    duration_minutes: input.duration_minutes || qt.thoiLuongMacDinh(Number(input.guest_count), ch),
    customer_name: input.customer_name || 'Khách vãng lai',
    phone: input.phone || `WI${Date.now().toString().slice(-9)}`,
  }, { ...ctx, laNhanVien: true });

  // Da o ARRIVED; day thang sang SEATED vi khach dang dung o cua, khong co
  // khoang cho nao giua "den" va "ngoi xuong".
  if (!kq.vao_danh_sach_cho && input.seat_now !== false) {
    await doiTrangThai(kq.id, 'SEATED', { ...ctx, ghiChu: 'Khách vãng lai — xếp bàn ngay' });
    kq.trang_thai = 'SEATED';
  }
  return kq;
}

/**
 * Dat dinh ky (case 23): mot lich lap lai theo tuan/hai tuan/thang.
 *
 * Khong dung transaction chung cho ca chuoi: neu tuan thu 5 het ban thi 4 tuan
 * dau van la nhung luot dat hop le va khach van muon giu. Tra ve ca danh sach
 * tao duoc lan danh sach that bai de nhan vien biet phai goi dien tuan nao.
 */
async function taoLichLap(input, ctx = {}) {
  const soLan = Math.min(52, Math.max(1, Number(input.occurrences) || 1));
  const buoc = Number(input.interval_days) || 7;
  if (![1, 7, 14, 28].includes(buoc)) {
    throw new LoiDatBan('Chu kỳ lặp chỉ nhận 1, 7, 14 hoặc 28 ngày', 'BAD_INTERVAL');
  }

  const thanhCong = [];
  const thatBai = [];
  const goc = qt.ghepMoc(qt.ngayChuoi(input.reservation_date), '00:00:00');

  for (let i = 0; i < soLan; i += 1) {
    const ngay = new Date(goc.getTime());
    ngay.setDate(ngay.getDate() + i * buoc);
    const ngayChuoi = ngayCucBo(ngay);
    try {
      thanhCong.push(await taoLuotDat({ ...input, reservation_date: ngayChuoi }, ctx));
    } catch (e) {
      thatBai.push({ ngay: ngayChuoi, ly_do: e.message, ma: e.ma || 'ERROR' });
    }
  }
  return { thanh_cong: thanhCong, that_bai: thatBai };
}

// ------------------------------------------------------------- cap nhat

/**
 * Doi lich / doi so khach / doi khu vuc (muc 12).
 *
 * Diem then chot: MOI thay doi deu keo theo kiem tra lai bàn (BR-007). Doi tu
 * 4 len 8 khach ma giu nguyen ban 4 cho la mot loi khong duoc phep xay ra, ke
 * ca khi nhan vien co y bam nhanh cho xong.
 *
 * Ban duoc gan tay (`manual_tables`) van bi kiem tra lai, nhung neu van du cho
 * va van trong thi GIU NGUYEN - khong tu dong xep lai. Nhan vien da co ly do
 * khi chon dung ban do (khach quen thich ban gan cua so), he thong khong nen
 * am tham lat lai quyet dinh cua ho.
 */
async function capNhat(id, input, ctx = {}) {
  const ch = await qt.docCauHinh();
  const laNhanVien = !!ctx.laNhanVien;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[hienTai]] = await conn.query('SELECT * FROM reservations WHERE id = ? FOR UPDATE', [id]);
    if (!hienTai) throw new LoiDatBan('Không tìm thấy lượt đặt bàn', 'NOT_FOUND');
    if (!qt.TRANG_THAI_GIU_CHO.includes(hienTai.status)) {
      throw new LoiDatBan(
        `Lượt đặt đang ở trạng thái "${qt.NHAN_TRANG_THAI[hienTai.status]}", không thể đổi lịch`,
        'CLOSED_RESERVATION');
    }
    if (hienTai.status === 'SEATED') {
      throw new LoiDatBan('Khách đã ngồi vào bàn — hãy dùng chức năng chuyển bàn thay vì đổi lịch', 'ALREADY_SEATED');
    }

    // Truong nao khong gui len thi giu nguyen gia tri cu.
    const gop = {
      customer_name: input.customer_name ?? hienTai.customer_name,
      phone: input.phone ?? hienTai.phone,
      email: input.email ?? hienTai.email,
      guest_count: input.guest_count ?? hienTai.guest_count,
      reservation_date: input.reservation_date ?? qt.ngayChuoi(hienTai.reservation_date),
      start_time: input.start_time ?? qt.gioNgan(String(hienTai.start_time)),
      duration_minutes: input.duration_minutes ?? hienTai.duration_minutes,
      area_id: input.area_id !== undefined ? input.area_id : hienTai.area_id,
      customer_type: input.customer_type ?? hienTai.customer_type,
      source: hienTai.source,
    };

    const khach = qt.kiemTraThongTinKhach(gop, ch, { laOnline: !laNhanVien });
    const khung = qt.phanTichKhungGio(gop, ch);
    qt.kiemTraQuaKhu(khung);
    qt.kiemTraDatQuaXa(khung, ch);
    await qt.kiemTraGioMoCua(khung, hienTai.branch_id);
    qt.kiemTraDatSatGio(khung, ch, { boQua: laNhanVien });

    const dsThe = input.tags !== undefined ? await qt.chuanHoaThe(input.tags) : docJson(hienTai.tags, []);

    // Ban dang giu: con dung duoc thi giu nguyen.
    const [banCu] = await conn.query(
      `SELECT b.Id_ban AS id, b.number_ban AS ten, COALESCE(b.so_cho,4) AS so_cho, b.id_vitri AS khu_vuc_id
         FROM reservation_tables rt JOIN ban b ON b.Id_ban = rt.table_id
        WHERE rt.reservation_id = ?`, [id]);

    const banChiDinh = input.table_ids !== undefined
      ? (Array.isArray(input.table_ids) ? input.table_ids : String(input.table_ids || '').split(',').filter(Boolean))
      : null;

    let banMoi = null;

    if (banChiDinh && banChiDinh.length) {
      // Nguoi dung chon ban cu the.
      const goi = await xb.goiYXepBan(khung, {
        soKhach: khach.soKhach, areaId: gop.area_id || null, dsThe,
        loaiKhach: khach.loaiKhach, banChiDinh, boQuaId: id, client: conn,
      });
      banMoi = goi.chon.ban;
    } else {
      const tongChoCu = banCu.reduce((s, b) => s + Number(b.so_cho), 0);
      const doiKhuVuc = String(gop.area_id || '') !== String(hienTai.area_id || '');
      const conDuoc = banCu.length && tongChoCu >= khach.soKhach && !doiKhuVuc;

      if (conDuoc) {
        // Van phai kiem tra lai o luoi: gio moi co the da bi luot khac chiem.
        const { trong } = await xb.banKhaDung(khung, { boQuaId: id, client: conn });
        const idTrong = new Set(trong.map((b) => b.id));
        if (banCu.every((b) => idTrong.has(Number(b.id)))) {
          banMoi = banCu.map((b) => ({ ...b, id: Number(b.id), so_cho: Number(b.so_cho) }));
        }
      }
      if (!banMoi) {
        const goi = await xb.goiYXepBan(khung, {
          soKhach: khach.soKhach, areaId: gop.area_id || null, dsThe,
          loaiKhach: khach.loaiKhach, boQuaId: id, client: conn,
        });
        if (!goi.chon) {
          throw new LoiDatBan(
            'Không còn bàn phù hợp cho lịch mới. Lượt đặt cũ vẫn được giữ nguyên.', 'FULL');
        }
        banMoi = goi.chon.ban;
      }
    }

    // Tinh lai tien coc theo so khach/gio moi. Da thanh toan roi thi khong doi
    // so tien - doi tien coc cua mot khoan da thu la viec cua ke toan, khong
    // phai cua mot lan bam nut doi gio.
    let soTienCoc = Number(hienTai.deposit_amount) || 0;
    let trangThaiCoc = hienTai.deposit_status;
    if (trangThaiCoc !== 'PAID' && trangThaiCoc !== 'REFUNDED') {
      const coc = await qt.tinhTienCoc({
        soKhach: khach.soKhach, gioBatDau: khung.batDau, loaiKhach: khach.loaiKhach,
      });
      soTienCoc = coc.soTien;
      trangThaiCoc = coc.soTien > 0 ? 'UNPAID' : 'NOT_REQUIRED';
    }

    // Doi o luoi: nha het roi chiem lai. Trong cung transaction nen khong co
    // khoang thoi gian nao ban bi "vo chu" ma nguoi khac chen vao duoc.
    await xb.nhaO(conn, id);
    await xb.chiemO(conn, id, banMoi.map((b) => b.id), khung);
    await xb.ghiBan(conn, id, banMoi);

    const hanGiu = qt.moc(new Date(khung.mocBatDau.getTime() + Number(ch.grace_period_minutes) * 60000));

    await conn.query(
      `UPDATE reservations SET
         customer_name = ?, phone = ?, email = ?,
         reservation_date = ?, start_time = ?, expected_end_time = ?,
         duration_minutes = ?, turnaround_minutes = ?, guest_count = ?, area_id = ?,
         customer_type = ?, special_requests = ?, occasion = ?, tags = ?, notes = ?,
         deposit_amount = ?, deposit_status = ?, manual_tables = ?,
         hold_until = ?, updated_by = ?, no_show_warned_at = NULL, reminder_sent_at = NULL,
         updated_at = NOW()
       WHERE id = ?`,
      [khach.ten, khach.dienThoai, khach.email,
        khung.ngay, khung.batDau, khung.ketThuc,
        khung.thoiLuong, khung.demDon, khach.soKhach, gop.area_id || null,
        khach.loaiKhach,
        input.special_requests !== undefined ? (String(input.special_requests).trim() || null) : hienTai.special_requests,
        input.occasion !== undefined ? (String(input.occasion).trim() || null) : hienTai.occasion,
        JSON.stringify(dsThe),
        input.notes !== undefined ? (String(input.notes).trim() || null) : hienTai.notes,
        soTienCoc, trangThaiCoc,
        (banChiDinh && banChiDinh.length) ? 1 : hienTai.manual_tables,
        hanGiu, ctx.nhanVienId || null, id]);

    // Ghi nhat ky ke ra dung nhung gi doi - "cap nhat" chung chung khong giup
    // duoc ai khi tra lai su co ba tuan sau.
    const doi = [];
    if (qt.ngayChuoi(hienTai.reservation_date) !== khung.ngay) {
      doi.push(`ngày ${qt.ngayChuoi(hienTai.reservation_date)} → ${khung.ngay}`);
    }
    if (qt.gioNgan(String(hienTai.start_time)) !== qt.gioNgan(khung.batDau)) {
      doi.push(`giờ ${qt.gioNgan(String(hienTai.start_time))} → ${qt.gioNgan(khung.batDau)}`);
    }
    if (Number(hienTai.guest_count) !== khach.soKhach) {
      doi.push(`số khách ${hienTai.guest_count} → ${khach.soKhach}`);
    }
    const tenBanCu = banCu.map((b) => b.ten).sort().join(', ');
    const tenBanMoi = banMoi.map((b) => b.ten).sort().join(', ');
    if (tenBanCu !== tenBanMoi) doi.push(`bàn ${tenBanCu || '—'} → ${tenBanMoi}`);

    await ghiNhatKy(conn, id, hienTai.status, hienTai.status,
      doi.length ? `Cập nhật: ${doi.join('; ')}` : 'Cập nhật thông tin', ctx.nhanVienId);

    await capNhatHoSoKhach(conn, khach.dienThoai);
    if (doi.length) {
      await xepThongBao(conn, {
        reservationId: id,
        suKien: 'RESERVATION_RESCHEDULED',
        nguoiNhan: khach.email,
        duLieu: { thay_doi: doi, ma: hienTai.reservation_code },
      });
    }

    await conn.commit();
    return chiTiet(id);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Gan/doi ban thu cong (nhan vien keo tha tren so do).
 *
 * Khac `capNhat`: khong dong den lich, chi doi ban. Dung cho case 10 (khach
 * muon doi ban) va cho luc xep ban cho reservation dang o WAITLIST.
 */
async function ganBan(id, dsBanId, ctx = {}) {
  const ds = (Array.isArray(dsBanId) ? dsBanId : String(dsBanId || '').split(','))
    .map((x) => Number(String(x).trim())).filter((n) => Number.isInteger(n) && n > 0);
  if (!ds.length) throw new LoiDatBan('Vui lòng chọn ít nhất một bàn', 'NO_TABLE');

  const ch = await qt.docCauHinh();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[r]] = await conn.query('SELECT * FROM reservations WHERE id = ? FOR UPDATE', [id]);
    if (!r) throw new LoiDatBan('Không tìm thấy lượt đặt bàn', 'NOT_FOUND');
    if (!qt.TRANG_THAI_GIU_CHO.includes(r.status)) {
      throw new LoiDatBan('Lượt đặt đã kết thúc, không thể đổi bàn', 'CLOSED_RESERVATION');
    }

    const khung = qt.phanTichKhungGio({
      reservation_date: qt.ngayChuoi(r.reservation_date),
      start_time: qt.gioNgan(String(r.start_time)),
      guest_count: r.guest_count,
      duration_minutes: r.duration_minutes,
    }, ch);

    const goi = await xb.goiYXepBan(khung, {
      soKhach: Number(r.guest_count),
      dsThe: docJson(r.tags, []),
      loaiKhach: r.customer_type,
      banChiDinh: ds,
      boQuaId: id,
      client: conn,
    });

    const [banCu] = await conn.query(
      `SELECT b.number_ban AS ten FROM reservation_tables rt JOIN ban b ON b.Id_ban = rt.table_id
        WHERE rt.reservation_id = ?`, [id]);

    await xb.nhaO(conn, id);
    await xb.chiemO(conn, id, goi.chon.ban.map((b) => b.id), khung);
    await xb.ghiBan(conn, id, goi.chon.ban);
    await conn.query('UPDATE reservations SET manual_tables = 1, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [ctx.nhanVienId || null, id]);

    await ghiNhatKy(conn, id, r.status, r.status,
      `Đổi bàn: ${banCu.map((b) => b.ten).join(', ') || '—'} → ${goi.chon.ban.map((b) => b.ten).join(', ')}`,
      ctx.nhanVienId);

    await conn.commit();
    return { ban: goi.chon.ban };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** Giu ban them N phut khi khach goi bao den tre (muc 7). */
async function giuThem(id, soPhut, ctx = {}) {
  const phut = Math.min(120, Math.max(5, Number(soPhut) || 15));
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[r]] = await conn.query('SELECT * FROM reservations WHERE id = ? FOR UPDATE', [id]);
    if (!r) throw new LoiDatBan('Không tìm thấy lượt đặt bàn', 'NOT_FOUND');
    if (!['PENDING', 'CONFIRMED'].includes(r.status)) {
      throw new LoiDatBan('Chỉ giữ thêm bàn được với lượt đặt chưa đến', 'BAD_STATUS');
    }
    // Moc tinh tu HAN CU chu khong tu bay gio: bam nut hai lan phai duoc 30
    // phut, khong phai van 15 phut ke tu lan bam sau.
    const goc = r.hold_until ? new Date(r.hold_until) : new Date();
    const moi = qt.moc(new Date(Math.max(goc.getTime(), Date.now()) + phut * 60000));
    await conn.query('UPDATE reservations SET hold_until = ?, no_show_warned_at = NULL WHERE id = ?', [moi, id]);
    await ghiNhatKy(conn, id, r.status, r.status, `Giữ bàn thêm ${phut} phút`, ctx.nhanVienId);
    await conn.commit();
    return { hold_until: moi };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// -------------------------------------------------------- doi trang thai

/**
 * Chuyen trang thai - cua duy nhat de doi `reservations.status`.
 *
 * Ngoai viec ghi cot `status`, ham nay con lo cac he qua di kem cua tung buoc:
 *   - moc thoi gian (arrived_at, seated_at...)
 *   - nha o luoi khi luot dat khong con giu ban
 *   - dong bo `ban.trangthai` de so do ban thoi gian thuc dung ngay
 *   - tinh hoan tien khi huy
 *   - cap nhat bo dem no-show cua khach
 *
 * Nam chung mot cho vi day la nhung viec KHONG duoc phep quen. Rai ra tung
 * route thi som muon cung co mot loi ra quen nha o, va ban do bi khoa vinh vien.
 */
async function doiTrangThai(id, trangThaiMoi, ctx = {}) {
  const den = String(trangThaiMoi || '').toUpperCase();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[r]] = await conn.query('SELECT * FROM reservations WHERE id = ? FOR UPDATE', [id]);
    if (!r) throw new LoiDatBan('Không tìm thấy lượt đặt bàn', 'NOT_FOUND');
    qt.batBuocChuyenDuoc(r.status, den);

    const dat = ['status = ?', 'updated_by = ?', 'updated_at = NOW()'];
    const gt = [den, ctx.nhanVienId || null];
    let hoan = null;

    if (den === 'CONFIRMED') { dat.push('confirmed_at = NOW()'); }
    if (den === 'ARRIVED') { dat.push('arrived_at = NOW()'); }
    if (den === 'SEATED') {
      dat.push('seated_at = NOW()');
      // Khach den som ma ngoi vao ban luc 18:40 cho luot 19:00 thi ban thuc su
      // ban tu 18:40. Khong doi gio bat dau (lich su phai giu nguyen cai da hua)
      // nhung xoa han giu vi khach da o day roi.
      dat.push('hold_until = NULL');
      if (!r.arrived_at) dat.push('arrived_at = NOW()');
    }
    if (den === 'COMPLETED') { dat.push('completed_at = NOW()', 'closed_at = NOW()'); }

    if (['CANCELLED', 'REJECTED', 'NO_SHOW'].includes(den)) {
      dat.push('closed_at = NOW()');
      if (den === 'CANCELLED') {
        dat.push('cancel_reason = ?', 'cancelled_by = ?');
        gt.push(String(ctx.lyDo || '').trim() || null, ctx.boiAi || (ctx.nhanVienId ? 'STAFF' : 'CUSTOMER'));
      }

      // Hoan tien: tinh mot lan tai day va LUU lai. Tinh lai luc ke toan mo ra
      // se cho so khac (thoi gian da troi qua) - va con so hua voi khach luc
      // huy moi la con so dung.
      const ch = await qt.docCauHinh();
      const mocBatDau = qt.ghepMoc(qt.ngayChuoi(r.reservation_date), String(r.start_time));
      /*
        CHI hoan lai tien DA THU that.

        `deposit_amount` la so tien PHAI coc theo quy tac, ton tai ngay ca khi
        khach chua tra dong nao (deposit_status = 'UNPAID'). Lay thang cot do ma
        hoan se hua tra lai khach mot khoan nha hang chua bao gio nhan - va ke
        toan se phai di tim khoan chenh do vao cuoi thang.
      */
      const daThu = r.deposit_status === 'PAID' ? Number(r.deposit_amount) || 0 : 0;
      hoan = den === 'NO_SHOW'
        ? qt.hoanTienKhiNoShow(daThu)
        : await qt.tinhHoanTien({
          mocBatDau,
          soTienCoc: daThu,
          loaiKhach: r.customer_type,
          soKhach: r.guest_count,
          laCaoDiem: qt.laGioCaoDiem(String(r.start_time), ch),
        });
      dat.push('refund_percent = ?', 'refund_amount = ?');
      gt.push(hoan.phanTram, hoan.soTien);

      if (daThu > 0 && hoan.soTien > 0) {
        dat.push("deposit_status = 'REFUNDED'");
        await conn.query(
          `INSERT INTO reservation_deposits (reservation_id, amount, status, refunded_at)
           VALUES (?,?, 'REFUNDED', NOW())`, [id, hoan.soTien]);
      }

      // Nha ban ra ngay: mot ban bi giu boi luot dat da huy la mot ban khong ban
      // duoc cho ai - loi ton tien nhat ma module nay co the gay ra.
      await xb.nhaO(conn, id);
    }

    if (den === 'COMPLETED') {
      // Giu nguyen o luoi cua luot da hoan tat: khung gio do da duoc dung. Nha
      // ra se cho phep dat de len chinh khung vua phuc vu, bo qua ca thoi gian
      // don ban.
      await conn.query(
        `UPDATE ban SET trangthai = 3
          WHERE Id_ban IN (SELECT table_id FROM reservation_tables WHERE reservation_id = ?)
            AND trangthai = 1`, [id]);
    }

    await conn.query(`UPDATE reservations SET ${dat.join(', ')} WHERE id = ?`, [...gt, id]);

    // Dong bo trang thai vat ly cua ban.
    //
    // CHI dong tu 0 (Trong) sang 2 (Da dat truoc) va nguoc lai. Khong bao gio
    // dung vao ban dang 1 (Dang phuc vu) hay 3 (Dang don): hai trang thai do
    // thuoc luong goi mon/thanh toan, module dat ban ghi de len se lam bien mat
    // mot ban dang co khach khoi man hinh thu ngan.
    if (den === 'SEATED') {
      await conn.query(
        `UPDATE ban SET trangthai = 1
          WHERE Id_ban IN (SELECT table_id FROM reservation_tables WHERE reservation_id = ?)
            AND trangthai IN (0, 2)`, [id]);
    }
    if (['CANCELLED', 'REJECTED', 'NO_SHOW'].includes(den)) {
      await conn.query(
        `UPDATE ban SET trangthai = 0
          WHERE Id_ban IN (SELECT table_id FROM reservation_tables WHERE reservation_id = ?)
            AND trangthai = 2`, [id]);
    }

    const nhan = {
      CONFIRMED: 'Xác nhận lượt đặt',
      ARRIVED: 'Khách đã đến',
      SEATED: 'Đã xếp khách vào bàn',
      COMPLETED: 'Khách dùng bữa xong',
      CANCELLED: `Hủy lượt đặt${hoan && hoan.soTien ? ` — hoàn ${hoan.soTien.toLocaleString('vi-VN')}đ` : ''}`,
      NO_SHOW: 'Khách không đến (no-show)',
      REJECTED: 'Nhà hàng từ chối lượt đặt',
      WAITLIST: 'Chuyển vào danh sách chờ',
    }[den] || `Chuyển sang ${den}`;

    await ghiNhatKy(conn, id, r.status, den,
      ctx.ghiChu ? `${nhan} — ${ctx.ghiChu}` : nhan, ctx.nhanVienId);
    await capNhatHoSoKhach(conn, r.phone);
    await xepThongBao(conn, {
      reservationId: id,
      suKien: `RESERVATION_${den}`,
      nguoiNhan: r.email,
      duLieu: { ma: r.reservation_code, hoan_tien: hoan },
    });

    await conn.commit();
    return { id: Number(id), tu: r.status, den, hoan_tien: hoan, ma: r.reservation_code, phone: r.phone };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Xem truoc ket qua huy TRUOC khi huy that.
 *
 * Man hinh xac nhan phai noi duoc "ban se duoc hoan 250.000d" chu khong chi
 * "ban co chac khong?" - khach can biet cai gia truoc khi bam.
 */
async function xemTruocHuy(id) {
  const [[r]] = await db.query(
    'SELECT status, reservation_date, start_time, deposit_amount, deposit_status, customer_type, guest_count FROM reservations WHERE id = ?',
    [id]);
  if (!r) throw new LoiDatBan('Không tìm thấy lượt đặt bàn', 'NOT_FOUND');
  if (!qt.TRANG_THAI_GIU_CHO.includes(r.status)) {
    throw new LoiDatBan('Lượt đặt này đã kết thúc', 'CLOSED_RESERVATION');
  }
  const ch = await qt.docCauHinh();
  const mocBatDau = qt.ghepMoc(qt.ngayChuoi(r.reservation_date), String(r.start_time));
  const hoan = await qt.tinhHoanTien({
    mocBatDau,
    // Da hoan roi thi khong con gi de hoan nua.
    soTienCoc: r.deposit_status === 'PAID' ? r.deposit_amount : 0,
    loaiKhach: r.customer_type,
    soKhach: r.guest_count,
    laCaoDiem: qt.laGioCaoDiem(String(r.start_time), ch),
  });
  return {
    ...hoan,
    da_coc: Number(r.deposit_amount) || 0,
    trang_thai_coc: r.deposit_status,
    gio_con_lai: Math.max(0, Math.round((mocBatDau.getTime() - Date.now()) / 3600000 * 10) / 10),
  };
}

// ------------------------------------------------------------- tien coc

/** Ghi nhan thanh toan / hoan tien coc (muc 10). */
async function luuCoc(id, input, ctx = {}) {
  const soTien = Number(input.amount);
  const trangThai = String(input.status || 'PENDING_PAYMENT').toUpperCase();
  if (!Number.isFinite(soTien) || soTien < 0) throw new LoiDatBan('Số tiền cọc không hợp lệ', 'BAD_AMOUNT');
  if (!['UNPAID', 'PENDING_PAYMENT', 'PAID', 'REFUNDED'].includes(trangThai)) {
    throw new LoiDatBan('Trạng thái tiền cọc không hợp lệ', 'BAD_STATUS');
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[r]] = await conn.query('SELECT * FROM reservations WHERE id = ? FOR UPDATE', [id]);
    if (!r) throw new LoiDatBan('Không tìm thấy lượt đặt bàn', 'NOT_FOUND');

    await conn.query(
      `INSERT INTO reservation_deposits (reservation_id, amount, status, paid_at, refunded_at, transaction_id)
       VALUES (?,?,?,?,?,?)`,
      [id, soTien, trangThai,
        trangThai === 'PAID' ? new Date() : null,
        trangThai === 'REFUNDED' ? new Date() : null,
        String(input.transaction_id || '').trim() || null]);

    await conn.query(
      'UPDATE reservations SET deposit_amount = ?, deposit_status = ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [soTien, trangThai, ctx.nhanVienId || null, id]);

    // Da coc thi tu dong xac nhan: khach da tra tien, de ho o "cho xac nhan"
    // them mot buoc nua khong con y nghia gi.
    if (trangThai === 'PAID' && r.status === 'PENDING') {
      await conn.query(
        "UPDATE reservations SET status = 'CONFIRMED', confirmed_at = NOW() WHERE id = ?", [id]);
      await ghiNhatKy(conn, id, 'PENDING', 'CONFIRMED', 'Tự động xác nhận sau khi nhận cọc', ctx.nhanVienId);
    }

    await ghiNhatKy(conn, id, r.status, r.status,
      `Tiền cọc: ${soTien.toLocaleString('vi-VN')}đ · ${trangThai}`, ctx.nhanVienId);
    await xepThongBao(conn, {
      reservationId: id, suKien: `DEPOSIT_${trangThai}`, nguoiNhan: r.email,
      duLieu: { so_tien: soTien, ma: r.reservation_code },
    });
    await conn.commit();
    return chiTiet(id);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// ------------------------------------------------------- bang dieu khien

/**
 * So lieu mot ngay cho man hinh nhan vien (muc 17).
 *
 * `ty_le_lap_day` tinh theo GHE-GIO chu khong theo so luot dat: 40 luot dat 2
 * khach va 10 luot dat 8 khach la hai buc tranh hoan toan khac nhau ve muc do
 * ban rộn cua nha hang, nhung dem theo luot thi cai dau lai trong "dong" hon.
 */
async function bangDieuKhien(ngay) {
  const n = qt.ngayChuoi(ngay || ngayCucBo());
  const ds = await danhSach({ ngay: n });

  const dem = {};
  for (const ma of Object.keys(qt.NHAN_TRANG_THAI)) dem[ma] = 0;
  for (const r of ds) dem[r.status] = (dem[r.status] || 0) + 1;

  const dangGiu = ds.filter((r) => r.dang_hieu_luc);
  const gheGio = dangGiu.reduce((s, r) => s + Number(r.guest_count) * Number(r.duration_minutes) / 60, 0);

  const [[{ tong_cho: tongCho }]] = await db.query(
    'SELECT COALESCE(SUM(so_cho),0) AS tong_cho FROM ban WHERE cho_dat_truoc = 1');

  let soGioMo = 12;
  try {
    const lich = await qt.lichMoCua(n);
    if (!lich.dong) {
      let dong = qt.phutTuChuoi(lich.dong_cua);
      const mo = qt.phutTuChuoi(lich.mo);
      if (dong <= mo) dong += 1440;
      soGioMo = (dong - mo) / 60;
    } else soGioMo = 0;
  } catch (e) { /* Cau hinh gio mo cua hong - dung mac dinh, khong lam sap trang. */ }

  const tongGheGio = tongCho * soGioMo;
  const daKetThuc = dem.COMPLETED + dem.CANCELLED + dem.NO_SHOW + dem.REJECTED;

  // Canh bao no-show: khach da qua han giu ban ma van chua den.
  const canhBao = ds.filter((r) => r.qua_han_giu);
  // Ban sap het gio: khach dang ngoi, con duoi 15 phut.
  const sapHetGio = ds.filter((r) => r.status === 'SEATED' && r.con_tren_ban_phut !== null && r.con_tren_ban_phut <= 15);
  // Sap den gio: trong 60 phut toi, da xac nhan nhung chua den.
  const sapDen = ds.filter((r) => r.status === 'CONFIRMED' && r.con_lai_phut > 0 && r.con_lai_phut <= 60);

  return {
    ngay: n,
    ds,
    dem,
    tong_luot: ds.length,
    tong_khach: ds.reduce((s, r) => s + Number(r.guest_count), 0),
    khach_dang_giu: dangGiu.reduce((s, r) => s + Number(r.guest_count), 0),
    walk_in: ds.filter((r) => r.source === 'WALK_IN').length,
    online: ds.filter((r) => r.source === 'ONLINE').length,
    vip: ds.filter((r) => r.customer_type === 'VIP').length,
    ty_le_lap_day: tongGheGio > 0 ? Math.round((gheGio / tongGheGio) * 100) : 0,
    ty_le_no_show: daKetThuc ? Math.round((dem.NO_SHOW / daKetThuc) * 100) : 0,
    ty_le_huy: daKetThuc ? Math.round(((dem.CANCELLED + dem.REJECTED) / daKetThuc) * 100) : 0,
    quy_mo_trung_binh: ds.length ? Math.round((ds.reduce((s, r) => s + Number(r.guest_count), 0) / ds.length) * 10) / 10 : 0,
    tong_cho: Number(tongCho),
    canh_bao: canhBao,
    sap_het_gio: sapHetGio,
    sap_den: sapDen,
    cho_duyet: ds.filter((r) => r.status === 'PENDING'),
    danh_sach_cho: ds.filter((r) => r.status === 'WAITLIST'),
  };
}

/**
 * Duong thoi gian mot ngay: moi ban mot hang, moi luot dat mot thanh ngang (muc 18).
 *
 * Tra ve san du lieu da tinh vi tri (phan tram) de View chi con ve. Tinh trong
 * View bang EJS se phai lam lai o ca ban nhan vien lan ban quan ly.
 */
async function duongThoiGian(ngay, { areaId = null } = {}) {
  const n = qt.ngayChuoi(ngay || ngayCucBo());
  let mo = 8 * 60;
  let dong = 22 * 60;
  try {
    const lich = await qt.lichMoCua(n);
    if (!lich.dong) {
      mo = qt.phutTuChuoi(lich.mo);
      dong = qt.phutTuChuoi(lich.dong_cua);
      if (dong <= mo) dong += 1440;
    }
  } catch (e) { /* dung khung mac dinh */ }

  const dsBan = await xb.docBan({ areaId, chiChoDat: false });
  const [rows] = await db.query(
    `SELECT rt.table_id, r.id, r.reservation_code, r.customer_name, r.guest_count,
            r.start_time, r.expected_end_time, r.status, r.customer_type, r.source, r.turnaround_minutes
       FROM reservation_tables rt
       JOIN reservations r ON r.id = rt.reservation_id
      WHERE r.reservation_date = ? AND r.status NOT IN ('CANCELLED','REJECTED','NO_SHOW')
      ORDER BY r.start_time`, [n]);

  const tong = dong - mo;
  const theoBan = new Map(dsBan.map((b) => [b.id, []]));
  for (const r of rows) {
    const batDau = qt.phutTuChuoi(String(r.start_time));
    let ketThuc = qt.phutTuChuoi(String(r.expected_end_time));
    if (ketThuc <= batDau) ketThuc += 1440;
    const hang = theoBan.get(Number(r.table_id));
    if (!hang) continue;
    hang.push({
      id: r.id,
      ma: r.reservation_code,
      khach: r.customer_name,
      so_khach: r.guest_count,
      trang_thai: r.status,
      loai_khach: r.customer_type,
      nguon: r.source,
      tu: qt.gioNgan(String(r.start_time)),
      den: qt.gioNgan(String(r.expected_end_time)),
      trai: Math.max(0, ((batDau - mo) / tong) * 100),
      rong: Math.min(100, ((ketThuc - batDau) / tong) * 100),
      rong_don: Math.min(100, ((Number(r.turnaround_minutes) || 0) / tong) * 100),
    });
  }

  const moc = [];
  for (let p = mo; p <= dong; p += 60) {
    moc.push({ nhan: qt.gioNgan(qt.chuoiTuPhut(p)), trai: ((p - mo) / tong) * 100 });
  }

  const bayGio = new Date();
  const phutBayGio = bayGio.getHours() * 60 + bayGio.getMinutes();

  return {
    ngay: n,
    mo: qt.gioNgan(qt.chuoiTuPhut(mo)),
    dong: qt.gioNgan(qt.chuoiTuPhut(dong)),
    moc,
    /** Vach "bay gio" - chi ve khi dang xem dung ngay hom nay. */
    vach_hien_tai: (n === ngayCucBo() && phutBayGio >= mo && phutBayGio <= dong)
      ? ((phutBayGio - mo) / tong) * 100 : null,
    hang: dsBan.map((b) => ({
      ban_id: b.id,
      ten: b.ten,
      so_cho: b.so_cho,
      khu_vuc: b.khu_vuc,
      khu_vuc_id: b.khu_vuc_id,
      trang_thai_ban: Number(b.trang_thai),
      luot: theoBan.get(b.id) || [],
    })),
  };
}

/**
 * Phan tich cho quan ly (muc 17) - gom theo gio, theo ngay, theo nguon.
 *
 * Gom bang SQL chu khong keo ca chuc nghin dong ve Node: khoang thoi gian o
 * day co the la ca nam.
 */
async function phanTich(tuNgay, denNgay, { chiNhanh = null } = {}) {
  const tu = qt.ngayChuoi(tuNgay);
  const den = qt.ngayChuoi(denNgay);
  const locCn = chiNhanh ? 'AND branch_id = ?' : '';
  const ts = chiNhanh ? [tu, den, chiNhanh] : [tu, den];

  const [[tongQuan], theoNgay, theoGio, theoNguon, theoLoai, theoKhu, theoDip, topKhach] = await Promise.all([
    db.query(
      `SELECT COUNT(*) AS tong,
              SUM(status='COMPLETED') AS hoan_tat,
              SUM(status='CANCELLED') AS huy,
              SUM(status='NO_SHOW') AS no_show,
              SUM(status='REJECTED') AS tu_choi,
              SUM(source='WALK_IN') AS walk_in,
              SUM(source='ONLINE') AS online,
              SUM(guest_count) AS tong_khach,
              AVG(guest_count) AS quy_mo_tb,
              AVG(duration_minutes) AS thoi_luong_tb,
              SUM(deposit_status='PAID') AS da_coc,
              COALESCE(SUM(CASE WHEN deposit_status='PAID' THEN deposit_amount END),0) AS tien_coc,
              COALESCE(SUM(refund_amount),0) AS tien_hoan
         FROM reservations WHERE reservation_date BETWEEN ? AND ? ${locCn}`, ts).then((r) => r[0]),
    db.query(
      `SELECT reservation_date AS ngay, COUNT(*) AS so_luot, SUM(guest_count) AS so_khach,
              SUM(status='NO_SHOW') AS no_show, SUM(status='CANCELLED') AS huy
         FROM reservations WHERE reservation_date BETWEEN ? AND ? ${locCn}
        GROUP BY reservation_date ORDER BY reservation_date`, ts).then((r) => r[0]),
    db.query(
      `SELECT HOUR(start_time) AS gio, COUNT(*) AS so_luot, SUM(guest_count) AS so_khach
         FROM reservations WHERE reservation_date BETWEEN ? AND ? ${locCn}
          AND status NOT IN ('CANCELLED','REJECTED')
        GROUP BY HOUR(start_time) ORDER BY gio`, ts).then((r) => r[0]),
    db.query(
      `SELECT source AS nguon, COUNT(*) AS so_luot, SUM(guest_count) AS so_khach
         FROM reservations WHERE reservation_date BETWEEN ? AND ? ${locCn}
        GROUP BY source`, ts).then((r) => r[0]),
    db.query(
      `SELECT customer_type AS loai, COUNT(*) AS so_luot, SUM(guest_count) AS so_khach
         FROM reservations WHERE reservation_date BETWEEN ? AND ? ${locCn}
        GROUP BY customer_type`, ts).then((r) => r[0]),
    db.query(
      `SELECT COALESCE(v.Name_vitri, 'Không chỉ định') AS khu_vuc, COUNT(*) AS so_luot,
              SUM(r.guest_count) AS so_khach
         FROM reservations r LEFT JOIN vitri v ON v.id_vitri = r.area_id
        WHERE r.reservation_date BETWEEN ? AND ? ${chiNhanh ? 'AND r.branch_id = ?' : ''}
        GROUP BY r.area_id ORDER BY so_luot DESC`, ts).then((r) => r[0]),
    db.query(
      `SELECT occasion AS dip, COUNT(*) AS so_luot
         FROM reservations WHERE reservation_date BETWEEN ? AND ? ${locCn}
          AND occasion IS NOT NULL AND occasion <> ''
        GROUP BY occasion ORDER BY so_luot DESC LIMIT 10`, ts).then((r) => r[0]),
    db.query(
      `SELECT r.phone, MAX(r.customer_name) AS ten, COUNT(*) AS so_luot,
              SUM(r.guest_count) AS so_khach, SUM(r.status='NO_SHOW') AS no_show,
              MAX(kh.customer_type) AS loai
         FROM reservations r LEFT JOIN reservation_customers kh ON kh.phone = r.phone
        WHERE r.reservation_date BETWEEN ? AND ? ${chiNhanh ? 'AND r.branch_id = ?' : ''}
        GROUP BY r.phone ORDER BY so_luot DESC LIMIT 15`, ts).then((r) => r[0]),
  ]);

  const daKetThuc = Number(tongQuan.hoan_tat) + Number(tongQuan.huy)
    + Number(tongQuan.no_show) + Number(tongQuan.tu_choi);

  // Thu trong tuan: gom o Node vi ten thu can tieng Viet, va bo du lieu chi co
  // 7 dong - khong dang mot vong SQL rieng.
  const TEN_THU = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  const theoThu = TEN_THU.map((ten, i) => ({ thu: i, ten, so_luot: 0, so_khach: 0 }));
  for (const d of theoNgay) {
    const thu = qt.ghepMoc(qt.ngayChuoi(d.ngay), '00:00:00').getDay();
    theoThu[thu].so_luot += Number(d.so_luot);
    theoThu[thu].so_khach += Number(d.so_khach || 0);
  }

  return {
    tu, den,
    tong_quan: {
      ...tongQuan,
      quy_mo_tb: Math.round((Number(tongQuan.quy_mo_tb) || 0) * 10) / 10,
      thoi_luong_tb: Math.round(Number(tongQuan.thoi_luong_tb) || 0),
      ty_le_no_show: daKetThuc ? Math.round((Number(tongQuan.no_show) / daKetThuc) * 1000) / 10 : 0,
      ty_le_huy: daKetThuc ? Math.round(((Number(tongQuan.huy) + Number(tongQuan.tu_choi)) / daKetThuc) * 1000) / 10 : 0,
    },
    theo_ngay: theoNgay.map((d) => ({ ...d, ngay: qt.ngayChuoi(d.ngay) })),
    theo_gio: theoGio,
    theo_thu: theoThu,
    theo_nguon: theoNguon,
    theo_loai_khach: theoLoai,
    theo_khu_vuc: theoKhu,
    theo_dip: theoDip,
    top_khach: topKhach,
    gio_cao_diem: theoGio.length
      ? theoGio.reduce((a, b) => (Number(b.so_luot) > Number(a.so_luot) ? b : a)).gio
      : null,
  };
}

module.exports = {
  // doc
  danhSach,
  chiTiet,
  traCuuChoKhach,
  lichSuKhach,
  lichSuKhachTheoTaiKhoan,
  hoSoKhach,
  luuHoSoKhach,
  kiemTraKhaDung,

  // ghi
  taoLuotDat,
  taoWalkIn,
  taoLichLap,
  capNhat,
  ganBan,
  giuThem,
  doiTrangThai,
  xemTruocHuy,
  luuCoc,

  // bao cao
  bangDieuKhien,
  duongThoiGian,
  phanTich,

  // tien ich cho cac module khac dung lai
  lamGiau,
  ghiNhatKy,
  xepThongBao,
};
