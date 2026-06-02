const mysql = require('mysql2/promise');

async function test() {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'gs_restaurant'
    });
    console.log('Successfully connected to gs_restaurant on port 3306!');
    const [rows] = await conn.query('SHOW TABLES');
    console.log('Tables:', rows.map(r => Object.values(r)[0]).join(', '));
    await conn.end();
  } catch (err) {
    console.error('Error connecting:', err);
  }
}

test();
