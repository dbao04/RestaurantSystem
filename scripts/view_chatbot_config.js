const db = require('../config/db');

async function main() {
  try {
    const [rows] = await db.query("SELECT khoa, gia_tri FROM cau_hinh WHERE khoa LIKE 'chatbot%' ORDER BY khoa");
    console.log(`Found ${rows.length} chatbot config entries:`);
    for (const r of rows) {
      console.log(`--- [${r.khoa}] ---`);
      console.log(r.gia_tri);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
