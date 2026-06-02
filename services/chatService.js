const db = require('../config/db');

const chatService = {
  // [BẢO VỆ]: Lưu tin nhắn chat vào database (Quy trình Chat Real-time)
  sendMessage: async (id_kh, id_nv, noi_dung, nguoi_gui) => {
    const [result] = await db.query(
      'INSERT INTO chat (id_kh, id_nv, noi_dung, nguoi_gui) VALUES (?, ?, ?, ?)',
      [id_kh, id_nv || null, noi_dung, nguoi_gui]
    );
    return result.insertId;
  },

  // [BẢO VỆ]: Truy xuất lịch sử tin nhắn chat của khách hàng
  getConversation: async (id_kh) => {
    const [rows] = await db.query(
      `SELECT c.*, nv.ten AS ten_nv 
       FROM chat c 
       LEFT JOIN nhan_vien nv ON c.id_nv = nv.id_nv
       WHERE c.id_kh = ?
       ORDER BY c.thoigian ASC`,
      [id_kh]
    );
    return rows;
  },

  getMessagesForCustomer: async (id_kh) => {
    const [rows] = await db.query(
      `SELECT c.*, k.ten AS ten_kh, nv.ten AS ten_nv
       FROM chat c
       JOIN khach_hang k ON c.id_kh = k.id
       LEFT JOIN nhan_vien nv ON c.id_nv = nv.id_nv
       WHERE c.id_kh = ?
       ORDER BY c.thoigian ASC`,
      [id_kh]
    );
    return rows;
  },

  markChatAsRead: async (id_kh, nguoi_gui) => {
    await db.query(`UPDATE chat SET da_doc = 1 WHERE id_kh = ? AND nguoi_gui = ?`, [id_kh, nguoi_gui]);
  },

  getChatCustomers: async () => {
    const [rows] = await db.query(
      `SELECT k.id, k.ten, k.sodienthoai,
        (SELECT noi_dung FROM chat WHERE id_kh = k.id ORDER BY thoigian DESC LIMIT 1) AS last_msg,
        (SELECT thoigian FROM chat WHERE id_kh = k.id ORDER BY thoigian DESC LIMIT 1) AS last_time,
        (SELECT COUNT(*) FROM chat WHERE id_kh = k.id AND nguoi_gui = 'khach' AND da_doc = 0) AS unread
       FROM khach_hang k
       WHERE EXISTS (SELECT 1 FROM chat WHERE id_kh = k.id)
       ORDER BY last_time DESC`
    );
    return rows;
  }
};

module.exports = chatService;
