const db = require('../config/db');

const kitchenService = {
  getKitchenOrders: async () => {
    const [rows] = await db.query(`
      SELECT h.id, h.sesis, h.name_mon, h.soluong, h.trangthai_bep, h.tg, h.dates, k.ten as ten_khach
      FROM hopdong h
      JOIN khach_hang k ON h.id_user = k.id
      WHERE h.id_mon > 0 AND h.tinhtrang = 1
      ORDER BY h.trangthai_bep ASC, h.id ASC
    `);
    return rows;
  },

  markKitchenDone: async (id) => {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('UPDATE hopdong SET trangthai_bep = 1 WHERE id = ?', [id]);
      const [orderRows] = await connection.query('SELECT id_mon, soluong FROM hopdong WHERE id = ?', [id]);
      if (orderRows.length > 0 && orderRows[0].id_mon > 0) {
        const { id_mon, soluong } = orderRows[0];
        const [recipe] = await connection.query('SELECT id_nl, so_luong_tieu_hao FROM cong_thuc WHERE id_mon = ?', [id_mon]);
        for (const item of recipe) {
          const totalConsume = item.so_luong_tieu_hao * soluong;
          await connection.query('UPDATE nguyen_lieu SET so_luong = so_luong - ? WHERE id_nl = ?', [totalConsume, item.id_nl]);
        }
      }
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
};

module.exports = kitchenService;
