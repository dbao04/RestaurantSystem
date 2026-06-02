const db = require('./config/db');

async function checkCollation() {
  try {
    console.log('--- Database Collation ---');
    const [dbInfo] = await db.query("SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = 'gs_restaurant'");
    console.log(dbInfo);

    console.log('\n--- Table Collation ---');
    const [tables] = await db.query("SELECT TABLE_NAME, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'gs_restaurant'");
    console.log(tables);

    console.log('\n--- Column Collation ---');
    const [columns] = await db.query("SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'gs_restaurant' AND (CHARACTER_SET_NAME IS NOT NULL)");
    columns.forEach(c => {
      if (c.CHARACTER_SET_NAME !== 'utf8mb4') {
        console.log(`[WARNING] ${c.TABLE_NAME}.${c.COLUMN_NAME}: ${c.CHARACTER_SET_NAME} (${c.COLLATION_NAME})`);
      }
    });

    console.log('\n--- Data Sample (Categories) ---');
    const [rows] = await db.query("SELECT id_loai, name_loai FROM loai_mon");
    console.log(rows);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkCollation();
