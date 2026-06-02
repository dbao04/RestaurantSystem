const db = require('./config/db');

async function diagnose() {
  try {
    console.log('--- DIAGNOSING TABLE: cart ---');
    const [cols] = await db.query('SHOW COLUMNS FROM cart');
    cols.forEach(c => console.log(`${c.Field} (${c.Type}) - Null: ${c.Null}`));
    
    console.log('--- DIAGNOSING TABLE: monan ---');
    const [mcols] = await db.query('SHOW COLUMNS FROM monan');
    mcols.forEach(c => console.log(`${c.Field} (${c.Type}) - Null: ${c.Null}`));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

diagnose();
