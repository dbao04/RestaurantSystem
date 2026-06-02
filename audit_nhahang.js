const mysql = require('mysql2/promise');
require('dotenv').config();

async function audit() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: 'nhahang',
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0
  });

  try {
    const [cols] = await pool.query('DESCRIBE khach_hang');
    console.log('--- NHÀ HÀNG COLUMNS ---');
    console.log(cols.map(c => c.Field).join(', '));
    console.log('------------------------');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

audit();
