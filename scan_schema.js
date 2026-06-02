const db = require('./config/db');

(async () => {
  try {
    const tables = [
      'khach_hang', 'monan', 'loai_mon', 'hopdong', 'nhan_vien', 'cart',
      'chat', 'danh_gia', 'lich_lam_viec', 'cham_cong', 'luong', 'chi_phi'
    ];

    for (const table of tables) {
      try {
        const [cols] = await db.query(`DESCRIBE ${table}`);
        console.log(`\n${table}:`);
        console.log(cols.map(c => c.Field).join(', '));
      } catch (e) {
        console.log(`\n${table}: [TABLE NOT EXISTS]`);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
})();
