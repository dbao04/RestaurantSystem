const mysql = require('mysql2/promise');
require('dotenv').config();

async function audit() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: 'quanly_nhahang',
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0
  });

  try {
    const [rows] = await pool.query('SELECT * FROM khach_hang LIMIT 1');
    const cols = Object.keys(rows[0]);
    console.log('--- QUẢN LÝ NHÀ HÀNG COLUMNS ---');
    console.log(cols.join(', '));
    console.log('-------------------------------');
    process.exit(0);
  } catch (err) {
    // If SELECT fails, try DESCRIBE
    try {
      const [cols] = await pool.query('DESCRIBE khach_hang');
      console.log('--- QUẢN LÝ NHÀ HÀNG COLUMNS ---');
      console.log(cols.map(c => c.Field).join(', '));
      console.log('-------------------------------');
      process.exit(0);
    } catch (err2) {
      console.error(err2.message);
      process.exit(1);
    }
  }
}

audit();
