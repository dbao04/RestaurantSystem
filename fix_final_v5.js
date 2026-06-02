const db = require('./config/db');

async function fixFinalV5() {
  try {
    console.log('--- STARTING FINAL FIX V5 ---');

    // 1. Swap the names to match the dishes
    console.log('1. Correcting swapped names for ID 10 and 11...');
    // id 10 contains appetizers (Khai vị dishes)
    // id 11 contains pork (Heo dishes)
    await db.query("UPDATE loai_mon SET name_loai = 'Khai vị' WHERE id_loai = 10");
    await db.query("UPDATE loai_mon SET name_loai = 'Heo' WHERE id_loai = 11");

    // 2. Ensure case-insensitive collation (utf8_general_ci) for all tables
    console.log('2. Setting collation to utf8_general_ci for case-insensitivity...');
    await db.query("ALTER DATABASE gs_restaurant CHARACTER SET utf8 COLLATE utf8_general_ci");
    
    const [tables] = await db.query("SHOW TABLES");
    const tableNames = tables.map(t => Object.values(t)[0]);

    for (const tableName of tableNames) {
      console.log(`- Converting table ${tableName} to utf8_general_ci...`);
      await db.query(`ALTER TABLE ${tableName} CONVERT TO CHARACTER SET utf8 COLLATE utf8_general_ci`);
    }

    // 3. Verify
    const [rows] = await db.query("SELECT id_loai, name_loai FROM loai_mon WHERE id_loai IN (10, 11)");
    console.log('Current state of IDs 10, 11:');
    console.log(JSON.stringify(rows));

    console.log('--- FINAL FIX V5 COMPLETED ---');
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

fixFinalV5();
