const db = require('./config/db');

async function fixFont() {
  try {
    console.log('--- STARTING FONT FIX (MySQL 5.1 Compatible) ---');

    // 1. Alter Database
    console.log('1. Altering Database charset to utf8...');
    await db.query("ALTER DATABASE gs_restaurant CHARACTER SET utf8 COLLATE utf8_general_ci");

    // 2. Identify tables
    const [tables] = await db.query("SHOW TABLES");
    const tableNames = tables.map(t => Object.values(t)[0]);

    // 3. Alter each table
    for (const tableName of tableNames) {
      console.log(`- Converting table: ${tableName}`);
      await db.query(`ALTER TABLE ${tableName} CONVERT TO CHARACTER SET utf8 COLLATE utf8_general_ci`);
    }

    // 4. Update specific corrupted data in loai_mon
    console.log('2. Updating loai_mon data...');
    const categories = [
      { id: 11, name: 'Khai vị' },
      { id: 12, name: 'Bò' },
      { id: 13, name: 'Gà' },
      { id: 14, name: 'Cơm / Bún / Miến' },
      { id: 16, name: 'Tráng miệng' }
    ];

    for (const cat of categories) {
      await db.query("UPDATE loai_mon SET name_loai = ? WHERE id_loai = ?", [cat.name, cat.id]);
    }

    console.log('--- FONT FIX COMPLETED ---');
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

fixFont();
