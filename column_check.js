const db = require('./config/db');

async function check() {
  const tables = ['nguyen_lieu', 'cong_thuc', 'luong', 'hopdong', 'nhan_vien'];
  for (const table of tables) {
    try {
      const [rows] = await db.query(`DESCRIBE ${table}`);
      console.log(`--- COLUMNS OF ${table} ---`);
      rows.forEach(r => console.log(`- ${r.Field}: ${r.Type}`));
    } catch (err) {
      console.error(`Error describing ${table}:`, err.message);
    }
  }
  process.exit(0);
}

check();
