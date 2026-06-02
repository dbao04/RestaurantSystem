const db = require('./config/db');

async function fixFinal() {
  try {
    console.log('--- STARTING FINAL FIX ---');

    // 1. Fix Database and Table Collation to utf8_unicode_ci for better searching
    console.log('1. Altering Database to utf8_unicode_ci...');
    await db.query("ALTER DATABASE gs_restaurant CHARACTER SET utf8 COLLATE utf8_unicode_ci");

    const [tables] = await db.query("SHOW TABLES");
    const tableNames = tables.map(t => Object.values(t)[0]);

    for (const tableName of tableNames) {
      console.log(`- Converting table ${tableName} to utf8_unicode_ci...`);
      await db.query(`ALTER TABLE ${tableName} CONVERT TO CHARACTER SET utf8 COLLATE utf8_unicode_ci`);
    }

    // 2. Fix the specific category naming issue
    console.log('2. Forcing ID 10 to Heo and ID 11 to Khai vị...');
    await db.query("UPDATE loai_mon SET name_loai = 'Heo' WHERE id_loai = 10");
    await db.query("UPDATE loai_mon SET name_loai = 'Khai vị' WHERE id_loai = 11");

    // Double check if there are duplicate Khai vị
    const [rows] = await db.query("SELECT * FROM loai_mon");
    console.log('New categories state:');
    console.log(JSON.stringify(rows));

    console.log('--- FINAL FIX COMPLETED ---');
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

fixFinal();
