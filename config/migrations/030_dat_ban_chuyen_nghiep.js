/**
 * Migration 030 - Nang cap module DAT BAN len muc van hanh that.
 *
 * Chay: node config/migrations/030_dat_ban_chuyen_nghiep.js
 *       (hoac `npm run datban:setup`)
 *
 * Idempotent: moi cau lenh deu kiem tra truoc khi tao/them, chay lai nhieu lan
 * khong mat du lieu. Phai chay SAU 028 va 029.
 *
 * ---------------------------------------------------------------------------
 * DIEM QUAN TRONG NHAT: CHONG DAT TRUNG BANG CHINH CO SO DU LIEU
 * ---------------------------------------------------------------------------
 * Ban 028 chi chong dat trung o tang ung dung: doc bang `NOT EXISTS ... OVERLAP`
 * roi ghi. Giua doc va ghi luon co mot khe thoi gian; hai request vao cung mot
 * giay van co the cung thay "ban con trong" roi cung ghi. `SELECT ... FOR UPDATE`
 * tren bang `ban` co thu hep khe do, nhung no khoa NHAM doi tuong (khoa cai ban,
 * trong khi thu can bao ve la CAP ban+khung gio) va bat ky doan ma moi nao quen
 * lay khoa deu pha duoc.
 *
 * MySQL/MariaDB khong co EXCLUDE constraint tren khoang thoi gian nhu PostgreSQL.
 * Cach chac chan duy nhat con lai la BAM KHOANG THOI GIAN THANH LUOI O RO roi
 * dat UNIQUE tren (ban, o). Do la bang `reservation_slot_locks`:
 *
 *     PRIMARY KEY (table_id, slot_start)
 *
 * Mot reservation 19:00-21:00 tren ban B05 se chiem cac o 19:00, 19:15, ..., 21:00.
 * Reservation thu hai muon B05 luc 20:00 se dam vao o 20:00 da co chu -> MySQL
 * tra ve loi 1062 (ER_DUP_ENTRY) NGAY TRONG TRANSACTION. Khong co khe thoi gian
 * nao lot qua duoc, ke ca khi tang ung dung viet sai.
 *
 * Kich thuoc o = 15 phut (RESERVATION_SLOT_MINUTES trong services/reservationRules.js).
 * Doi so nay thi phai chay lai script backfill o cuoi file nay.
 *
 * ---------------------------------------------------------------------------
 * VI SAO THEM COT VAO `ban` VA `vitri` THAY VI TAO BANG MOI
 * ---------------------------------------------------------------------------
 * `ban`/`vitri` da la nguon su that cua so do ban thoi gian thuc (so_cho,
 * toa_do_x, toa_do_y, trangthai) va duoc dung o /staff/so-do-ban, KDS, thanh
 * toan. Tach thuoc tinh dat ban ("gan cua so", "phong rieng", "co the ghep")
 * sang bang rieng se tao ra hai nguon su that cho cung mot cai ban - kieu loi
 * kho tim nhat khi van hanh. Them cot la lua chon dung o day.
 */
const db = require('../db');

/** Kich thuoc o luoi thoi gian, phai khop RESERVATION_SLOT_MINUTES. */
const SLOT_MINUTES = 15;

async function coBang(ten) {
  const [rows] = await db.query(
    'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [ten]);
  return rows.length > 0;
}

async function coCot(bang, cot) {
  const [rows] = await db.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [bang, cot]);
  return rows.length > 0;
}

async function coChiMuc(bang, ten) {
  const [rows] = await db.query(
    'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
    [bang, ten]);
  return rows.length > 0;
}

/**
 * Them cot neu chua co. Khong dung `ADD COLUMN IF NOT EXISTS` vi cu phap do chi
 * co tren MariaDB; kiem tra information_schema thi chay dung tren ca MySQL 8.
 */
async function themCot(bang, cot, dinhNghia) {
  if (await coCot(bang, cot)) return false;
  await db.query(`ALTER TABLE \`${bang}\` ADD COLUMN \`${cot}\` ${dinhNghia}`);
  console.log(`  + ${bang}.${cot}`);
  return true;
}

async function themChiMuc(bang, ten, dinhNghia) {
  if (await coChiMuc(bang, ten)) return false;
  await db.query(`ALTER TABLE \`${bang}\` ADD INDEX \`${ten}\` ${dinhNghia}`);
  console.log(`  + index ${bang}.${ten}`);
  return true;
}

/**
 * Noi rong danh sach gia tri cua mot cot ENUM.
 *
 * `status` va `source` cua reservation duoc bo sung them gia tri (WAITLIST,
 * WALK_IN). MODIFY COLUMN chay lai nhieu lan khong sao vi ket qua giong nhau.
 */
async function datEnum(bang, cot, dinhNghia) {
  if (!(await coCot(bang, cot))) return;
  await db.query(`ALTER TABLE \`${bang}\` MODIFY COLUMN \`${cot}\` ${dinhNghia}`);
}

// ---------------------------------------------------------------- bang moi

const BANG_MOI = {
  /*
    Luoi o thoi gian - "hang rao" chong dat trung. Xem chu thich dau file.

    KHONG co cot ngay/gio ket thuc: mot dong = mot o 15 phut. Reservation dai
    hon thi chiem nhieu dong. Nho vay UNIQUE la du de chong trung, khong can
    so sanh khoang.
  */
  reservation_slot_locks: `CREATE TABLE reservation_slot_locks (
    table_id INT NOT NULL,
    slot_start DATETIME NOT NULL,
    reservation_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (table_id, slot_start),
    INDEX idx_rsl_reservation (reservation_id),
    INDEX idx_rsl_time (slot_start),
    CONSTRAINT fk_rsl_reservation FOREIGN KEY (reservation_id)
      REFERENCES reservations(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  /*
    Ho so khach theo SO DIEN THOAI, khong theo tai khoan.
    Phan lon khach dat ban qua dien thoai/website khong co tai khoan; so dien
    thoai la thu duy nhat luon co. Bang nay tra loi ba cau hoi van hanh:
      - Khach nay da no-show may lan? (case 25)
      - Khach nay thich cho ngoi nao? (case 15 - VIP preference)
      - Co dang bi chan dat ban khong?
  */
  reservation_customers: `CREATE TABLE reservation_customers (
    phone VARCHAR(30) NOT NULL PRIMARY KEY,
    customer_id INT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(190) NULL,
    customer_type ENUM('REGULAR','MEMBER','VIP','CORPORATE','NEW') NOT NULL DEFAULT 'NEW',
    total_reservations INT NOT NULL DEFAULT 0,
    completed_count INT NOT NULL DEFAULT 0,
    no_show_count INT NOT NULL DEFAULT 0,
    cancelled_count INT NOT NULL DEFAULT 0,
    preferences JSON NULL,
    internal_note VARCHAR(500) NULL,
    is_blocked TINYINT(1) NOT NULL DEFAULT 0,
    last_visit_date DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_rc_type (customer_type),
    INDEX idx_rc_risk (no_show_count)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  /*
    Gio mo cua theo THU trong tuan. Bang nay thay khoa cai
    `reservation_settings.opening_hours` dang la mot chuoi '08:00-22:00' cho ca
    tuan - khong ta duoc nha hang nghi thu Hai hay mo muon hon vao cuoi tuan.
    Khoa cu van duoc giu lam ban du phong khi bang nay rong.

    weekday: 0=Chu Nhat ... 6=Thu Bay (khop Date.getDay() cua JavaScript, de
    khong phai doi so o tang ung dung - cho de sai lam nhat).
  */
  reservation_opening_hours: `CREATE TABLE reservation_opening_hours (
    id INT AUTO_INCREMENT PRIMARY KEY,
    branch_id INT NULL,
    weekday TINYINT NOT NULL,
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    is_closed TINYINT(1) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_roh (branch_id, weekday),
    CONSTRAINT chk_roh_weekday CHECK (weekday BETWEEN 0 AND 6)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  /** Ngay nghi le / dong cua dot xuat. */
  reservation_closed_dates: `CREATE TABLE reservation_closed_dates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    branch_id INT NULL,
    closed_date DATE NOT NULL,
    reason VARCHAR(255) NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_rcd (branch_id, closed_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  /*
    Quy tac tien coc. Nhieu quy tac cung ap dung thi lay quy tac co `priority`
    NHO nhat (uu tien cao nhat) - khong cong don, vi cong don se cho ra con so
    khach khong hieu noi ("sao toi phai coc 1.5 trieu cho ban 12 nguoi?").
  */
  reservation_deposit_rules: `CREATE TABLE reservation_deposit_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    applies_to ENUM('ALL','VIP','CORPORATE','MEMBER','LARGE_GROUP','PEAK_HOUR') NOT NULL DEFAULT 'ALL',
    min_guests SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    from_time TIME NULL,
    to_time TIME NULL,
    amount_type ENUM('NONE','FIXED','PER_GUEST') NOT NULL DEFAULT 'FIXED',
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    priority SMALLINT NOT NULL DEFAULT 100,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_rdr_active (is_active, priority)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  /** Danh muc trang thai reservation - de View/API lay nhan va mau tu mot noi. */
  reservation_status_catalog: `CREATE TABLE reservation_status_catalog (
    code VARCHAR(20) NOT NULL PRIMARY KEY,
    label_vi VARCHAR(60) NOT NULL,
    label_en VARCHAR(60) NOT NULL,
    color VARCHAR(20) NOT NULL,
    icon VARCHAR(40) NOT NULL,
    is_active_state TINYINT(1) NOT NULL DEFAULT 0,
    sort_order SMALLINT NOT NULL DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  /*
    Danh muc trang thai BAN. Ma so trung voi `ban.trangthai` dang co:
      0 Trong, 1 Dang phuc vu, 2 Da dat truoc, 3 Dang don
    Migration nay bo sung 4 = Bao tri (muc 21 cua de bai).
  */
  table_status_catalog: `CREATE TABLE table_status_catalog (
    code TINYINT NOT NULL PRIMARY KEY,
    key_name VARCHAR(20) NOT NULL,
    label_vi VARCHAR(60) NOT NULL,
    label_en VARCHAR(60) NOT NULL,
    color VARCHAR(20) NOT NULL,
    icon VARCHAR(40) NOT NULL,
    bookable TINYINT(1) NOT NULL DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  /** Danh muc yeu cau dac biet (muc 9) - de form khach tich chon thay vi go tay. */
  reservation_tag_catalog: `CREATE TABLE reservation_tag_catalog (
    code VARCHAR(30) NOT NULL PRIMARY KEY,
    label_vi VARCHAR(80) NOT NULL,
    label_en VARCHAR(80) NOT NULL,
    icon VARCHAR(40) NOT NULL,
    kind ENUM('OCCASION','ACCESSIBILITY','SEATING','DIETARY') NOT NULL DEFAULT 'OCCASION',
    /* Goi y bo loc ban tuong ung, vi du 'gan_cua_so'. NULL = khong anh huong xep ban. */
    table_hint VARCHAR(30) NULL,
    needs_prep TINYINT(1) NOT NULL DEFAULT 0,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
};

// ------------------------------------------------------- du lieu danh muc

const TRANG_THAI_RSV = [
  ['PENDING', 'Chờ xác nhận', 'Pending', '#f59e0b', 'fa-hourglass-half', 1, 10],
  ['WAITLIST', 'Danh sách chờ', 'Waitlist', '#8b5cf6', 'fa-list-ol', 1, 15],
  ['CONFIRMED', 'Đã xác nhận', 'Confirmed', '#2563eb', 'fa-check-circle', 1, 20],
  ['ARRIVED', 'Khách đã đến', 'Arrived', '#0891b2', 'fa-walking', 1, 30],
  ['SEATED', 'Đã xếp bàn', 'Seated', '#16a34a', 'fa-chair', 1, 40],
  ['COMPLETED', 'Hoàn tất', 'Completed', '#334155', 'fa-flag-checkered', 0, 50],
  ['CANCELLED', 'Đã hủy', 'Cancelled', '#dc2626', 'fa-ban', 0, 60],
  ['NO_SHOW', 'Không đến', 'No-show', '#b45309', 'fa-user-slash', 0, 70],
  ['REJECTED', 'Từ chối', 'Rejected', '#7f1d1d', 'fa-times-circle', 0, 80],
];

const TRANG_THAI_BAN = [
  [0, 'AVAILABLE', 'Trống', 'Available', '#22c55e', 'fa-check-circle', 1],
  [1, 'OCCUPIED', 'Đang phục vụ', 'Occupied', '#ef4444', 'fa-utensils', 0],
  [2, 'RESERVED', 'Đã đặt trước', 'Reserved', '#f59e0b', 'fa-bookmark', 0],
  [3, 'CLEANING', 'Đang dọn', 'Cleaning', '#64748b', 'fa-broom', 0],
  [4, 'MAINTENANCE', 'Bảo trì', 'Maintenance', '#0f172a', 'fa-tools', 0],
];

const THE_YEU_CAU = [
  ['BIRTHDAY', 'Sinh nhật', 'Birthday', 'fa-birthday-cake', 'OCCASION', null, 1, 10],
  ['ANNIVERSARY', 'Kỷ niệm', 'Anniversary', 'fa-glass-cheers', 'OCCASION', null, 1, 20],
  ['PROPOSAL', 'Cầu hôn', 'Proposal', 'fa-ring', 'OCCASION', 'yen_tinh', 1, 30],
  ['CORPORATE', 'Tiệc công ty', 'Corporate party', 'fa-briefcase', 'OCCASION', 'phong_rieng', 1, 40],
  ['KIDS', 'Có trẻ em', 'With children', 'fa-child', 'ACCESSIBILITY', null, 1, 50],
  ['ELDERLY', 'Có người lớn tuổi', 'With elderly guests', 'fa-hand-holding-heart', 'ACCESSIBILITY', null, 0, 60],
  ['WHEELCHAIR', 'Cần lối đi xe lăn', 'Wheelchair access', 'fa-wheelchair', 'ACCESSIBILITY', 'xe_lan', 1, 70],
  ['ALLERGY', 'Dị ứng thực phẩm', 'Food allergy', 'fa-exclamation-triangle', 'DIETARY', null, 1, 80],
  ['WINDOW', 'Bàn gần cửa sổ', 'Window seat', 'fa-window-maximize', 'SEATING', 'gan_cua_so', 0, 90],
  ['PRIVATE', 'Phòng riêng', 'Private room', 'fa-door-closed', 'SEATING', 'phong_rieng', 0, 100],
  ['QUIET', 'Không gian yên tĩnh', 'Quiet area', 'fa-volume-off', 'SEATING', 'yen_tinh', 0, 110],
];

/*
  Cau hinh mac dinh. Chi INSERT IGNORE - khong ghi de gia tri quan ly da doi.

  Ba khoa dang chu y:
    turnaround_minutes    - dem dem giua hai luot tren cung mot ban (case 22).
                            Khong co no thi khach 21:00 den luc ban 19:00-21:00
                            vua dung day ban va chua ai kip don.
    allow_customer_pick_table - cho khach TU CHON ban tren so do. Bat mac dinh
                            vi de bai yeu cau; tat di thi he thong tu xep.
    last_seating_minutes  - khong nhan dat trong N phut cuoi truoc gio dong cua.
*/
const CAU_HINH = [
  ['default_duration_1_2', '90'],
  ['default_duration_3_6', '120'],
  ['default_duration_7_10', '150'],
  ['default_duration_over_10', '180'],
  ['turnaround_minutes', '15'],
  ['occupied_hold_minutes', '90'],
  ['grace_period_minutes', '15'],
  ['auto_no_show_minutes', '30'],
  ['allow_table_combination', '1'],
  ['combine_same_area_only', '1'],
  ['max_tables_per_reservation', '4'],
  ['minimum_lead_minutes', '30'],
  ['max_advance_days', '90'],
  ['slot_step_minutes', '15'],
  ['auto_confirm_online', '0'],
  ['auto_confirm_member', '1'],
  ['deposit_due_minutes', '120'],
  ['peak_hours', '18:00-21:00'],
  ['large_group_threshold', '10'],
  ['max_guests_online', '30'],
  ['no_show_block_threshold', '3'],
  ['allow_customer_pick_table', '1'],
  ['last_seating_minutes', '60'],
  ['reminder_lead_minutes', '120'],
  ['opening_hours', '08:00-22:00'],
  ['holidays', '[]'],
];

const CHINH_SACH_HUY = [
  ['Hủy trước 24 giờ - hoàn 100%', 24, 100, 'ALL'],
  ['Hủy trước 6 giờ - hoàn 50%', 6, 50, 'ALL'],
  ['Hủy dưới 2 giờ - không hoàn', 2, 0, 'ALL'],
];

const QUY_TAC_COC = [
  // ten, ap_dung, min_khach, tu_gio, den_gio, kieu, so_tien, uu_tien
  ['Nhóm đông từ 10 khách', 'LARGE_GROUP', 10, null, null, 'PER_GUEST', 100000, 10],
  ['Khách VIP', 'VIP', 1, null, null, 'FIXED', 500000, 20],
  ['Khách doanh nghiệp', 'CORPORATE', 1, null, null, 'PER_GUEST', 150000, 20],
  ['Giờ cao điểm 18:00-21:00', 'PEAK_HOUR', 6, '18:00:00', '21:00:00', 'FIXED', 300000, 50],
  ['Khách thường - không cần cọc', 'ALL', 1, null, null, 'NONE', 0, 900],
];

// ---------------------------------------------------------------- backfill

/**
 * Sinh lai luoi o cho cac reservation dang con hieu luc.
 *
 * Chay duoc nhieu lan: INSERT IGNORE bo qua o da co. Neu co reservation cu bi
 * trung nhau (du lieu tao truoc khi co hang rao nay) thi dong sau se bi bo qua
 * va duoc bao ra man hinh de nguoi van hanh xu ly tay - KHONG tu dong xoa, vi
 * xoa mot reservation that cua khach la viec khong duoc phep tu quyet.
 */
async function napLuoiO() {
  const [rows] = await db.query(
    `SELECT r.id, r.reservation_date, r.start_time, r.expected_end_time, rt.table_id
       FROM reservations r
       JOIN reservation_tables rt ON rt.reservation_id = r.id
      WHERE r.status IN ('PENDING','WAITLIST','CONFIRMED','ARRIVED','SEATED','COMPLETED')`);

  const [[{ dem: buffer }]] = await db.query(
    `SELECT COALESCE(MAX(CAST(setting_value AS SIGNED)), 15) AS dem
       FROM reservation_settings WHERE setting_key = 'turnaround_minutes'`);

  let them = 0;
  const xungDot = new Map();

  for (const row of rows) {
    const ngay = row.reservation_date instanceof Date
      ? row.reservation_date.toISOString().slice(0, 10)
      : String(row.reservation_date).slice(0, 10);
    const batDau = new Date(`${ngay}T${String(row.start_time)}`);
    const ketThuc = new Date(`${ngay}T${String(row.expected_end_time)}`);
    // Qua nua dem: gio ket thuc nho hon gio bat dau -> sang ngay hom sau.
    if (ketThuc <= batDau) ketThuc.setDate(ketThuc.getDate() + 1);
    const chan = new Date(ketThuc.getTime() + Number(buffer) * 60000);

    for (let t = batDau.getTime(); t < chan.getTime(); t += SLOT_MINUTES * 60000) {
      const o = new Date(t);
      const chuoi = `${o.getFullYear()}-${String(o.getMonth() + 1).padStart(2, '0')}-${String(o.getDate()).padStart(2, '0')} `
        + `${String(o.getHours()).padStart(2, '0')}:${String(o.getMinutes()).padStart(2, '0')}:00`;
      const [kq] = await db.query(
        'INSERT IGNORE INTO reservation_slot_locks (table_id, slot_start, reservation_id) VALUES (?,?,?)',
        [row.table_id, chuoi, row.id]);
      if (kq.affectedRows) them += 1;
      else {
        const [[chu]] = await db.query(
          'SELECT reservation_id FROM reservation_slot_locks WHERE table_id = ? AND slot_start = ?',
          [row.table_id, chuoi]);
        if (chu && String(chu.reservation_id) !== String(row.id)) {
          xungDot.set(row.id, `bàn #${row.table_id} lúc ${chuoi} đã thuộc reservation #${chu.reservation_id}`);
        }
      }
    }
  }

  console.log(`  + ${them} ô lưới thời gian`);
  if (xungDot.size) {
    console.log(`  ! ${xungDot.size} reservation cũ bị trùng bàn, cần xử lý tay:`);
    for (const [id, mo] of xungDot) console.log(`      reservation #${id}: ${mo}`);
  }
}

/** Dong bo lai bo dem no-show / so lan dat cho bang ho so khach. */
async function napHoSoKhach() {
  await db.query(
    `INSERT INTO reservation_customers
       (phone, customer_id, full_name, email, customer_type, total_reservations,
        completed_count, no_show_count, cancelled_count, last_visit_date)
     SELECT r.phone,
            MAX(r.customer_id),
            SUBSTRING_INDEX(GROUP_CONCAT(r.customer_name ORDER BY r.created_at DESC), ',', 1),
            MAX(r.email),
            /* Loai khach cao nhat tung duoc gan cho so dien thoai nay. */
            CASE
              WHEN SUM(r.customer_type = 'VIP') > 0 THEN 'VIP'
              WHEN SUM(r.customer_type = 'CORPORATE') > 0 THEN 'CORPORATE'
              WHEN SUM(r.customer_type = 'MEMBER') > 0 THEN 'MEMBER'
              WHEN COUNT(*) > 1 THEN 'REGULAR'
              ELSE 'NEW'
            END,
            COUNT(*),
            SUM(r.status = 'COMPLETED'),
            SUM(r.status = 'NO_SHOW'),
            SUM(r.status = 'CANCELLED'),
            MAX(CASE WHEN r.status = 'COMPLETED' THEN r.reservation_date END)
       FROM reservations r
      WHERE r.phone IS NOT NULL AND r.phone <> ''
      GROUP BY r.phone
     ON DUPLICATE KEY UPDATE
        total_reservations = VALUES(total_reservations),
        completed_count    = VALUES(completed_count),
        no_show_count      = VALUES(no_show_count),
        cancelled_count    = VALUES(cancelled_count),
        last_visit_date    = VALUES(last_visit_date)`);
}

// -------------------------------------------------------------------- main

async function main() {
  console.log('Migration 030 - nâng cấp module đặt bàn');

  // 1. Bang moi
  for (const [ten, sql] of Object.entries(BANG_MOI)) {
    if (await coBang(ten)) continue;
    await db.query(sql);
    console.log(`  + bảng ${ten}`);
  }

  // 2. Mo rong `reservations`
  console.log('  · cột bổ sung cho reservations');
  await datEnum('reservations', 'status',
    `ENUM('PENDING','WAITLIST','CONFIRMED','ARRIVED','SEATED','COMPLETED','CANCELLED','NO_SHOW','REJECTED')
     NOT NULL DEFAULT 'PENDING'`);
  await datEnum('reservations', 'source',
    `ENUM('ONLINE','STAFF','WALK_IN','PHONE','PARTNER') NOT NULL DEFAULT 'ONLINE'`);

  await themCot('reservations', 'created_by', 'INT NULL AFTER assigned_staff_id');
  await themCot('reservations', 'updated_by', 'INT NULL AFTER created_by');
  await themCot('reservations', 'confirmed_at', 'DATETIME NULL');
  await themCot('reservations', 'arrived_at', 'DATETIME NULL');
  await themCot('reservations', 'seated_at', 'DATETIME NULL');
  await themCot('reservations', 'completed_at', 'DATETIME NULL');
  await themCot('reservations', 'closed_at', 'DATETIME NULL');
  // Han giu ban. Sinh tu grace_period luc tao, nhung LUU lai chu khong tinh
  // lai moi lan doc: nhan vien co the bam "giu them 10 phut" cho rieng mot
  // reservation, va quyet dinh do phai song sot qua moi lan doc trang.
  await themCot('reservations', 'hold_until', 'DATETIME NULL');
  await themCot('reservations', 'turnaround_minutes', 'SMALLINT UNSIGNED NOT NULL DEFAULT 15');
  await themCot('reservations', 'occasion', 'VARCHAR(40) NULL');
  await themCot('reservations', 'tags', 'JSON NULL');
  // Bàn do nhân viên gán tay: các lần cập nhật sau KHÔNG được tự xếp lại.
  await themCot('reservations', 'manual_tables', 'TINYINT(1) NOT NULL DEFAULT 0');
  await themCot('reservations', 'cancel_reason', 'VARCHAR(255) NULL');
  await themCot('reservations', 'cancelled_by', "ENUM('CUSTOMER','STAFF','SYSTEM') NULL");
  await themCot('reservations', 'refund_percent', 'DECIMAL(5,2) NULL');
  await themCot('reservations', 'refund_amount', 'DECIMAL(12,2) NULL');
  await themCot('reservations', 'deposit_due_at', 'DATETIME NULL');
  await themCot('reservations', 'no_show_count_at_booking', 'SMALLINT UNSIGNED NOT NULL DEFAULT 0');
  // Ma tra cuu cho khach: ho co ma reservation, nhung ma do doan duoc theo thoi
  // gian tao. Ghep them so dien thoai khi tra cuu la du, nen khong tao token rieng.
  await themCot('reservations', 'reminder_sent_at', 'DATETIME NULL');
  await themCot('reservations', 'no_show_warned_at', 'DATETIME NULL');
  await themChiMuc('reservations', 'idx_reservation_phone_date', '(phone, reservation_date)');
  await themChiMuc('reservations', 'idx_reservation_branch', '(branch_id, reservation_date, status)');

  // 3. Mo rong `ban` - thuoc tinh phuc vu xep ban tu dong
  console.log('  · thuộc tính đặt bàn cho bàn');
  await themCot('ban', 'cho_dat_truoc', 'TINYINT(1) NOT NULL DEFAULT 1');
  await themCot('ban', 'co_the_ghep', 'TINYINT(1) NOT NULL DEFAULT 1');
  // Chi cac ban CUNG nhom_ghep moi ghep duoc voi nhau. NULL = ghep tu do trong
  // cung khu vuc. Dung cho truong hop hai ban ke nhau ve so hieu nhung bi cach
  // boi loi di / cot nha - ghep tren giay ma khong ghep duoc ngoai doi.
  await themCot('ban', 'nhom_ghep', 'VARCHAR(20) NULL');
  await themCot('ban', 'gan_cua_so', 'TINYINT(1) NOT NULL DEFAULT 0');
  await themCot('ban', 'yen_tinh', 'TINYINT(1) NOT NULL DEFAULT 0');
  await themCot('ban', 'phong_rieng', 'TINYINT(1) NOT NULL DEFAULT 0');
  await themCot('ban', 'xe_lan', 'TINYINT(1) NOT NULL DEFAULT 1');
  await themCot('ban', 'uu_tien_vip', 'TINYINT(1) NOT NULL DEFAULT 0');
  await themCot('ban', 'ghi_chu_bao_tri', 'VARCHAR(255) NULL');
  await themChiMuc('ban', 'idx_ban_dat_truoc', '(cho_dat_truoc, trangthai, so_cho)');

  // 4. Mo rong `vitri` - thuoc tinh khu vuc
  console.log('  · thuộc tính đặt bàn cho khu vực');
  await themCot('vitri', 'cho_dat_truoc', 'TINYINT(1) NOT NULL DEFAULT 1');
  await themCot('vitri', 'la_vip', 'TINYINT(1) NOT NULL DEFAULT 0');
  await themCot('vitri', 'ngoai_troi', 'TINYINT(1) NOT NULL DEFAULT 0');
  await themCot('vitri', 'mau_sac', "VARCHAR(20) NOT NULL DEFAULT '#c8a24b'");

  // 5. Nap danh muc
  console.log('  · danh mục');
  for (const r of TRANG_THAI_RSV) {
    await db.query(
      `INSERT INTO reservation_status_catalog (code,label_vi,label_en,color,icon,is_active_state,sort_order)
       VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE label_vi=VALUES(label_vi), color=VALUES(color), icon=VALUES(icon),
         is_active_state=VALUES(is_active_state), sort_order=VALUES(sort_order)`, r);
  }
  for (const r of TRANG_THAI_BAN) {
    await db.query(
      `INSERT INTO table_status_catalog (code,key_name,label_vi,label_en,color,icon,bookable)
       VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE key_name=VALUES(key_name), label_vi=VALUES(label_vi),
         color=VALUES(color), icon=VALUES(icon), bookable=VALUES(bookable)`, r);
  }
  for (const r of THE_YEU_CAU) {
    await db.query(
      `INSERT INTO reservation_tag_catalog (code,label_vi,label_en,icon,kind,table_hint,needs_prep,sort_order)
       VALUES (?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE label_vi=VALUES(label_vi), icon=VALUES(icon), kind=VALUES(kind),
         table_hint=VALUES(table_hint), needs_prep=VALUES(needs_prep), sort_order=VALUES(sort_order)`, r);
  }
  for (const [k, v] of CAU_HINH) {
    await db.query('INSERT IGNORE INTO reservation_settings (setting_key, setting_value) VALUES (?,?)', [k, v]);
  }

  // 6. Gio mo cua mac dinh: mo ca tuan 08:00-22:00 (khop khoa cu de khong doi
  //    hanh vi cua he thong dang chay). Quan ly sua lai o trang cau hinh.
  for (let thu = 0; thu <= 6; thu += 1) {
    await db.query(
      `INSERT IGNORE INTO reservation_opening_hours (branch_id, weekday, open_time, close_time, is_closed)
       VALUES (NULL, ?, '08:00:00', '22:00:00', 0)`, [thu]);
  }

  // 7. Chinh sach huy + quy tac coc mac dinh (chi khi bang con trong, de khong
  //    dap len cau hinh nguoi dung da tu dieu chinh)
  const [[{ n: soChinhSach }]] = await db.query('SELECT COUNT(*) n FROM cancellation_policies');
  if (soChinhSach <= 1) {
    for (const [ten, gio, phanTram, apDung] of CHINH_SACH_HUY) {
      await db.query(
        `INSERT INTO cancellation_policies (name, hours_before, refund_percent, applies_to, is_active)
         SELECT ?,?,?,?,1 FROM DUAL
          WHERE NOT EXISTS (SELECT 1 FROM cancellation_policies WHERE hours_before = ? AND applies_to = ?)`,
        [ten, gio, phanTram, apDung, gio, apDung]);
    }
  }
  const [[{ n: soQuyTac }]] = await db.query('SELECT COUNT(*) n FROM reservation_deposit_rules');
  if (!soQuyTac) {
    for (const r of QUY_TAC_COC) {
      await db.query(
        `INSERT INTO reservation_deposit_rules
           (name, applies_to, min_guests, from_time, to_time, amount_type, amount, priority)
         VALUES (?,?,?,?,?,?,?,?)`, r);
    }
  }

  // 8. Gan chi nhanh mac dinh cho reservation cu (029 da tao branch MAIN)
  const [[chiNhanh]] = await db.query("SELECT id FROM branches WHERE code = 'MAIN'");
  if (chiNhanh) await db.query('UPDATE reservations SET branch_id = ? WHERE branch_id IS NULL', [chiNhanh.id]);

  // 9. Suy ra thuoc tinh ban tu du lieu dang co, de he thong dung duoc ngay ma
  //    khong bat quan ly ngoi tich 40 o vuong truoc khi thu tinh nang.
  //    Phong VIP -> phong rieng + yen tinh + uu tien VIP. San vuon -> ngoai troi.
  /*
    CAY BAY: `ban` va `vitri` dung collation utf8_general_ci - collation nay BO
    DAU khi so sanh. Nen dieu kien `Name_vitri LIKE '%Sân%'` khong chi khop
    "Sân vườn" ma khop CA "Sảnh chính": ca hai deu rut ve "san" sau khi bo dau.

    Hau qua khi de nguyen: ca 14 ban cua Sanh chinh bi danh dau ngoai troi va
    "gan cua so", roi thuat toan xep ban uu tien nham chung cho khach xin ban
    canh cua so. Loi im lang - khong ai bao gio thay thong bao nao.

    Bo han menh de '%Sân%'. '%vườn%' la du: no rut ve "vuon", chi co "Sân vườn"
    chua chuoi do.
  */
  await db.query("UPDATE vitri SET la_vip = 1 WHERE Name_vitri LIKE '%VIP%'");
  await db.query("UPDATE vitri SET ngoai_troi = 1 WHERE Name_vitri LIKE '%vườn%'");
  await db.query(`UPDATE ban b JOIN vitri v ON v.id_vitri = b.id_vitri
                     SET b.phong_rieng = 1, b.yen_tinh = 1, b.uu_tien_vip = 1, b.co_the_ghep = 0
                   WHERE v.la_vip = 1`);
  await db.query(`UPDATE ban b JOIN vitri v ON v.id_vitri = b.id_vitri
                     SET b.gan_cua_so = 1
                   WHERE v.ngoai_troi = 1`);
  // Nhom ghep mac dinh = khu vuc: hai ban chi ghep duoc khi cung khu.
  await db.query("UPDATE ban SET nhom_ghep = CONCAT('KV', id_vitri) WHERE nhom_ghep IS NULL");

  // 10. Backfill
  console.log('  · dựng lưới ô thời gian và hồ sơ khách');
  await napLuoiO();
  await napHoSoKhach();

  console.log('Migration 030 hoàn tất.');
  await db.end();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Migration 030 lỗi:', error.message);
    console.error(error.stack);
    process.exitCode = 1;
  });
}

module.exports = { main, SLOT_MINUTES };
