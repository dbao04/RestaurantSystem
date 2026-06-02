const db = require('./config/db');

async function test() {
  const [rows] = await db.query('SELECT id, id_user, tinhtrang FROM hopdong WHERE id_user=10');
  console.log('Orders for user 10:', rows);
  process.exit(0);
}

test();
