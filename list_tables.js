const db = require('./config/db');

async function list() {
  try {
    const [rows] = await db.query('SHOW TABLES');
    const tables = rows.map(r => Object.values(r)[0]);
    console.log('--- TABLES ---');
    console.log(tables.join(', '));
    console.log('--------------');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

list();
