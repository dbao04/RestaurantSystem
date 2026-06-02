const db = require('./config/db');

async function check() {
  try {
    const [rows] = await db.query('SHOW TABLES');
    const tables = rows.map(r => Object.values(r)[0]);
    console.log('--- TABLES ---');
    tables.forEach(t => console.log('- ' + t));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
