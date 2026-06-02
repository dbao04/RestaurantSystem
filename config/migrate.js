/**
 * DATABASE MIGRATION - Add missing tables for new features
 * Run this script once to create new tables
 */

const db = require('./db');

const migrations = [
  {
    name: 'audit_logs',
    sql: `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        action VARCHAR(100) NOT NULL,
        actor_type ENUM('customer', 'admin', 'staff', 'system') DEFAULT 'system',
        actor_id INT,
        actor_name VARCHAR(255),
        resource_type VARCHAR(100),
        resource_id INT,
        status ENUM('success', 'failed') DEFAULT 'success',
        details LONGTEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_action (action),
        INDEX idx_actor (actor_type, actor_id),
        INDEX idx_resource (resource_type, resource_id),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
    `
  },
  {
    name: 'loyalty_points',
    sql: `
      CREATE TABLE IF NOT EXISTS loyalty_points (
        id INT PRIMARY KEY AUTO_INCREMENT,
        id_kh INT NOT NULL,
        points INT DEFAULT 0,
        tier ENUM('bronze', 'silver', 'gold', 'platinum') DEFAULT 'bronze',
        total_spent DECIMAL(12, 2) DEFAULT 0,
        redeemed_points INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        FOREIGN KEY (id_kh) REFERENCES khach_hang(id) ON DELETE CASCADE,
        UNIQUE KEY uq_customer (id_kh),
        INDEX idx_tier (tier)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
    `
  },
  {
    name: 'loyalty_transactions',
    sql: `
      CREATE TABLE IF NOT EXISTS loyalty_transactions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        id_kh INT NOT NULL,
        type ENUM('earn', 'redeem', 'expire', 'bonus') DEFAULT 'earn',
        points INT,
        description VARCHAR(255),
        sesis VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_kh) REFERENCES khach_hang(id) ON DELETE CASCADE,
        INDEX idx_customer (id_kh),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
    `
  },
  {
    name: 'discount_codes',
    sql: `
      CREATE TABLE IF NOT EXISTS discount_codes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        discount_type ENUM('percentage', 'fixed_amount') DEFAULT 'percentage',
        discount_value DECIMAL(10, 2) NOT NULL,
        max_usage INT,
        current_usage INT DEFAULT 0,
        valid_from DATETIME NOT NULL,
        valid_until DATETIME NOT NULL,
        min_order_value DECIMAL(10, 2),
        max_discount_amount DECIMAL(10, 2),
        is_active BOOLEAN DEFAULT TRUE,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        INDEX idx_code (code),
        INDEX idx_active (is_active),
        INDEX idx_valid (valid_from, valid_until)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
    `
  },
  {
    name: 'payment_methods',
    sql: `
      CREATE TABLE IF NOT EXISTS payment_methods (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        type ENUM('cash', 'card', 'online', 'wallet') DEFAULT 'cash',
        is_active BOOLEAN DEFAULT TRUE,
        settings LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        INDEX idx_code (code),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
    `
  },
  {
    name: 'payments',
    sql: `
      CREATE TABLE IF NOT EXISTS payments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        sesis VARCHAR(50) NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        payment_method_id INT,
        status ENUM('pending', 'success', 'failed', 'refunded') DEFAULT 'pending',
        transaction_id VARCHAR(100),
        discount_code_used VARCHAR(50),
        discount_amount DECIMAL(10, 2) DEFAULT 0,
        loyalty_points_used INT DEFAULT 0,
        notes TEXT,
        processed_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
        INDEX idx_sesis (sesis),
        INDEX idx_status (status),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
    `
  },
  {
    name: 'order_cancellations',
    sql: `
      CREATE TABLE IF NOT EXISTS order_cancellations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        sesis VARCHAR(50) NOT NULL,
        id_kh INT,
        reason TEXT,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        approved_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        FOREIGN KEY (id_kh) REFERENCES khach_hang(id),
        INDEX idx_sesis (sesis),
        INDEX idx_status (status),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
    `
  },
  {
    name: 'shift_closings',
    sql: `
      CREATE TABLE IF NOT EXISTS shift_closings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        id_nv INT NOT NULL,
        shift_date DATE NOT NULL,
        shift_start DATETIME,
        shift_end DATETIME,
        total_orders INT DEFAULT 0,
        total_revenue DECIMAL(12, 2) DEFAULT 0,
        total_expenses DECIMAL(12, 2) DEFAULT 0,
        cash_in DECIMAL(12, 2) DEFAULT 0,
        cash_out DECIMAL(12, 2) DEFAULT 0,
        notes TEXT,
        status ENUM('open', 'closed', 'verified') DEFAULT 'open',
        verified_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        FOREIGN KEY (id_nv) REFERENCES nhan_vien(id_nv),
        INDEX idx_date (shift_date),
        INDEX idx_staff (id_nv),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
    `
  },
  {
    name: 'general_staff_role',
    sql: `
      ALTER TABLE nhan_vien MODIFY chucvu ENUM('Phuc vu', 'Bep', 'Ke toan', 'Quay', 'Thu ngan', 'Nhan vien chung') DEFAULT 'Nhan vien chung';
    `
  }
];

const runMigrations = async () => {
  console.log('Starting database migrations...');
  
  for (const migration of migrations) {
    try {
      console.log(`Migrating: ${migration.name}...`);
      await db.query(migration.sql);
      console.log(`✓ ${migration.name} migrated successfully`);
    } catch (err) {
      // Check if error is because table already exists
      if (err.message.includes('already exists') || err.message.includes('Duplicate column')) {
        console.log(`✓ ${migration.name} already exists, skipping...`);
      } else {
        console.error(`✗ Error migrating ${migration.name}:`, err.message);
      }
    }
  }
  
  console.log('Migrations completed!');
};

// Run if executed directly
if (require.main === module) {
  runMigrations().then(() => process.exit(0)).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { runMigrations, migrations };
