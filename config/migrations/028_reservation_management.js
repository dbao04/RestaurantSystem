/**
 * Migration 028 - Reservation management.
 *
 * Chay: node config/migrations/028_reservation_management.js
 * Idempotent: khong xoa du lieu va co the chay lai an toan.
 */
const db = require('../db');

const sql = [
  `CREATE TABLE IF NOT EXISTS reservation_settings (
    setting_key VARCHAR(80) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS reservations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reservation_code VARCHAR(24) NOT NULL UNIQUE,
    branch_id INT NULL,
    customer_id INT NULL,
    customer_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(190) NULL,
    reservation_date DATE NOT NULL,
    start_time TIME NOT NULL,
    expected_end_time TIME NOT NULL,
    duration_minutes SMALLINT UNSIGNED NOT NULL,
    guest_count SMALLINT UNSIGNED NOT NULL,
    area_id INT NULL,
    customer_type ENUM('REGULAR','MEMBER','VIP','CORPORATE','NEW') NOT NULL DEFAULT 'REGULAR',
    source ENUM('ONLINE','STAFF','WALK_IN') NOT NULL DEFAULT 'ONLINE',
    status ENUM('PENDING','CONFIRMED','ARRIVED','SEATED','COMPLETED','CANCELLED','NO_SHOW','REJECTED') NOT NULL DEFAULT 'PENDING',
    deposit_status ENUM('NOT_REQUIRED','UNPAID','PENDING_PAYMENT','PAID','REFUNDED') NOT NULL DEFAULT 'NOT_REQUIRED',
    deposit_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    special_requests TEXT NULL,
    notes TEXT NULL,
    assigned_staff_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_reservation_slot (reservation_date, start_time, expected_end_time, status),
    INDEX idx_reservation_customer (phone, customer_id),
    INDEX idx_reservation_status (status, reservation_date),
    CONSTRAINT chk_reservation_guests CHECK (guest_count > 0),
    CONSTRAINT chk_reservation_duration CHECK (duration_minutes > 0 AND expected_end_time > start_time)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS reservation_tables (
    reservation_id BIGINT UNSIGNED NOT NULL,
    table_id INT NOT NULL,
    seats SMALLINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (reservation_id, table_id),
    INDEX idx_reservation_tables_table (table_id, reservation_id),
    CONSTRAINT fk_rt_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS reservation_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reservation_id BIGINT UNSIGNED NOT NULL,
    from_status VARCHAR(20) NULL,
    to_status VARCHAR(20) NOT NULL,
    note VARCHAR(500) NULL,
    changed_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_rh_reservation (reservation_id, created_at),
    CONSTRAINT fk_rh_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS reservation_deposits (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reservation_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    status ENUM('UNPAID','PENDING_PAYMENT','PAID','REFUNDED') NOT NULL DEFAULT 'UNPAID',
    paid_at DATETIME NULL,
    refunded_at DATETIME NULL,
    transaction_id VARCHAR(120) NULL,
    INDEX idx_rd_reservation (reservation_id),
    CONSTRAINT fk_rd_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS cancellation_policies (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL,
    hours_before DECIMAL(6,2) NOT NULL, refund_percent DECIMAL(5,2) NOT NULL,
    applies_to ENUM('ALL','VIP','LARGE_GROUP','PEAK_HOUR') DEFAULT 'ALL',
    is_active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cp_active (is_active, hours_before)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS customer_preferences (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, customer_id INT NOT NULL,
    preference_key VARCHAR(60) NOT NULL, preference_value VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_customer_preference (customer_id, preference_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS reservation_notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, reservation_id BIGINT UNSIGNED NULL,
    channel ENUM('IN_APP','EMAIL','SMS') DEFAULT 'IN_APP', event_key VARCHAR(60) NOT NULL,
    recipient VARCHAR(190) NULL, status ENUM('PENDING','SENT','FAILED') DEFAULT 'PENDING',
    payload JSON NULL, sent_at DATETIME NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_rn_reservation (reservation_id, created_at), INDEX idx_rn_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `INSERT IGNORE INTO reservation_settings (setting_key, setting_value) VALUES
    ('default_duration_1_2','90'),('default_duration_3_6','120'),
    ('default_duration_7_10','150'),('grace_period_minutes','15'),
    ('allow_table_combination','1'),('minimum_lead_minutes','30'),
    ('opening_hours','08:00-22:00'),('holidays','[]')`,
  `INSERT INTO cancellation_policies (name, hours_before, refund_percent, applies_to)
   SELECT 'Hủy trước 24 giờ', 24, 100, 'ALL' FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM cancellation_policies)`,
].map((statement) => `${statement};`);

async function main() {
  for (const statement of sql) await db.query(statement);
  console.log('Migration 028 hoan tat: reservation management');
  await db.end();
}

if (require.main === module) main().catch((error) => {
  console.error('Migration 028 loi:', error.message);
  process.exitCode = 1;
});

module.exports = { main, sql };
