const db = require('./config/db');
async function run() {
  const [rows] = await db.query('SHOW TABLES');
  rows.forEach(r => console.log(Object.values(r)[0]));
  process.exit(0);
}
run();
