const db = require('../db');

async function main() {
  await db.query(`CREATE TABLE IF NOT EXISTS branches (
    id INT AUTO_INCREMENT PRIMARY KEY, code VARCHAR(20) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
    address VARCHAR(255), phone VARCHAR(30), timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    is_active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`INSERT IGNORE INTO branches (code,name,address) VALUES ('MAIN','Nhà Hàng Bảo Đoàn','12 Nguyễn Văn Bảo, TP. Hồ Chí Minh')`);
  console.log('Migration 029 hoan tat: branches');
  await db.end();
}
if (require.main === module) main().catch((error) => { console.error('Migration 029 loi:', error.message); process.exitCode = 1; });
module.exports = { main };
