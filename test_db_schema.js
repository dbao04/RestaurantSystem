const db = require('./config/db');

(async () => {
  try {
    console.log('=== Testing menu dependencies ===\n');
    
    // Test categories
    const [cats] = await db.query('DESCRIBE loai_mon');
    console.log('✓ loai_mon columns:', cats.map(c => c.Field).join(', '));
    
    // Test monan table
    const [dishes] = await db.query('DESCRIBE monan');
    console.log('✓ monan columns:', dishes.map(d => d.Field).join(', '));
    
    // Test actual category query
    const [categories] = await db.query('SELECT * FROM loai_mon ORDER BY id_loai DESC LIMIT 1');
    console.log('\n✓ Sample category:', categories);
    
    // Test actual dish query
    if (categories.length > 0) {
      const cid = categories[0].id_loai;
      const [dishdata] = await db.query(
        `SELECT m.*, l.ten_loai 
         FROM monan m 
         LEFT JOIN loai_mon l ON m.id_loai = l.id_loai 
         WHERE m.id_loai = ? AND m.tinhtrang = 1 LIMIT 1`,
        [cid]
      );
      console.log('✓ Sample dish query result:', dishdata);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('✗ Error:', err.message);
    console.error('SQL:', err.sql);
    process.exit(1);
  }
})();
