const db = require('../config/db');

const cartService = {
  getCart: async (sessionId) => {
    const [rows] = await db.query('SELECT * FROM cart WHERE sesid = ?', [sessionId]);
    return rows;
  },

  addToCart: async (sessionId, dishId, quantity) => {
    const [dishes] = await db.query('SELECT * FROM monan WHERE id_mon = ?', [dishId]);
    if (dishes.length === 0) throw new Error('Dish not found');
    const dish = dishes[0];
    const [existing] = await db.query('SELECT * FROM cart WHERE sesid = ? AND id_mon = ?', [sessionId, dishId]);
    if (existing.length > 0) {
      const newQuantity = parseInt(existing[0].soluong) + parseInt(quantity);
      await db.query('UPDATE cart SET soluong = ? WHERE cart_id = ?', [newQuantity, existing[0].cart_id]);
    } else {
      await db.query(
        'INSERT INTO cart (id_mon, sesid, name_mon, gia_mon, soluong, images) VALUES (?, ?, ?, ?, ?, ?)',
        [dishId, sessionId, dish.name_mon, dish.gia_mon, quantity, dish.images]
      );
    }
  },

  updateCartQuantity: async (cartId, quantity) => {
    await db.query('UPDATE cart SET soluong = ? WHERE cart_id = ?', [quantity, cartId]);
  },

  removeFromCart: async (cartId) => {
    await db.query('DELETE FROM cart WHERE cart_id = ?', [cartId]);
  },

  clearCart: async (sessionId) => {
    await db.query('DELETE FROM cart WHERE sesid = ?', [sessionId]);
  },

  getCartTotal: async (sessionId) => {
    const [rows] = await db.query('SELECT SUM(gia_mon * soluong) as total FROM cart WHERE sesid = ?', [sessionId]);
    return rows[0].total || 0;
  }
};

module.exports = cartService;
