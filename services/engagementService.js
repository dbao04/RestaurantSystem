/**
 * ENGAGEMENT SERVICE
 * Handles customer engagement: chat, messaging, and ratings
 * Combines chatService and ratingService functionality
 */

const db = require('../config/db');

const engagementService = {
  // ============ CHAT / MESSAGING OPERATIONS ============
  sendMessage: async (id_kh, id_nv, noi_dung, nguoi_gui) => {
    const [result] = await db.query(
      'INSERT INTO chat (id_kh, id_nv, noi_dung, nguoi_gui) VALUES (?, ?, ?, ?)',
      [id_kh, id_nv || null, noi_dung, nguoi_gui]
    );
    return result.insertId;
  },

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

  markAsRead: async (id, nguoi_gui) => {
    // Handle both customer and staff ids
    // If nguoi_gui is 'nhanvien', id is customer id; if 'khach', id is customer id
    await db.query(
      `UPDATE chat SET da_doc = 1 WHERE id_kh = ? AND nguoi_gui = ?`,
      [id, nguoi_gui]
    );
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
  },

  getUnreadMessages: async (id_kh) => {
    const [rows] = await db.query(
      `SELECT COUNT(*) as unread_count FROM chat 
       WHERE id_kh = ? AND da_doc = 0`,
      [id_kh]
    );
    return rows[0].unread_count || 0;
  },

  getConversationCount: async () => {
    const [rows] = await db.query(
      'SELECT COUNT(DISTINCT id_kh) as count FROM chat'
    );
    return rows[0].count || 0;
  },

  // ============ RATING / REVIEW OPERATIONS ============
  addRating: async (id_kh, sao, noi_dung) => {
    const [result] = await db.query(
      'INSERT INTO danh_gia (id_kh, sao, noi_dung) VALUES (?, ?, ?)',
      [id_kh, sao, noi_dung || null]
    );
    return result.insertId;
  },

  getUserRatings: async (id_kh) => {
    const [rows] = await db.query(
      `SELECT dg.*, k.ten FROM danh_gia dg 
       JOIN khach_hang k ON dg.id_kh = k.id 
       WHERE dg.id_kh = ? 
       ORDER BY dg.thoigian DESC`,
      [id_kh]
    );
    return rows;
  },

  getAllRatings: async () => {
    const [rows] = await db.query(
      `SELECT dg.*, k.ten FROM danh_gia dg 
       JOIN khach_hang k ON dg.id_kh = k.id 
       ORDER BY dg.thoigian DESC`
    );
    return rows;
  },

  getAverageRating: async () => {
    const [rows] = await db.query(
      'SELECT AVG(CAST(sao AS DECIMAL(2,1))) AS avg_sao, COUNT(*) AS total FROM danh_gia'
    );
    return rows[0] || { avg_sao: 0, total: 0 };
  },

  getRatingsByScore: async (sao) => {
    const [rows] = await db.query(
      `SELECT dg.*, k.ten FROM danh_gia dg 
       JOIN khach_hang k ON dg.id_kh = k.id 
       WHERE dg.sao = ? 
       ORDER BY dg.thoigian DESC`,
      [sao]
    );
    return rows;
  },

  getRatingStats: async () => {
    const [stats] = await db.query(`
      SELECT 
        COUNT(*) as total_ratings,
        AVG(CAST(sao AS DECIMAL(2,1))) as avg_rating,
        COUNT(CASE WHEN sao = 5 THEN 1 END) as five_star,
        COUNT(CASE WHEN sao = 4 THEN 1 END) as four_star,
        COUNT(CASE WHEN sao = 3 THEN 1 END) as three_star,
        COUNT(CASE WHEN sao = 2 THEN 1 END) as two_star,
        COUNT(CASE WHEN sao = 1 THEN 1 END) as one_star
      FROM danh_gia
    `);
    return stats[0] || null;
  },

  deleteRating: async (id_danh_gia) => {
    await db.query('DELETE FROM danh_gia WHERE id_dg = ?', [id_danh_gia]);
  },

  // ============ FEEDBACK SUMMARY ============
  getCustomerEngagement: async (id_kh) => {
    const [messages] = await db.query(
      'SELECT COUNT(*) as count FROM chat WHERE id_kh = ?',
      [id_kh]
    );
    
    const [ratings] = await db.query(
      'SELECT COUNT(*) as count, AVG(CAST(sao AS DECIMAL(2,1))) as avg_rating FROM danh_gia WHERE id_kh = ?',
      [id_kh]
    );

    return {
      messages: messages[0].count || 0,
      ratings: ratings[0].count || 0,
      avg_rating: ratings[0].avg_rating || 0
    };
  },

  getEngagementSummary: async () => {
    const [chatStats] = await db.query(
      `SELECT COUNT(*) as total_messages, COUNT(DISTINCT id_kh) as unique_customers FROM chat`
    );
    
    const [ratingStats] = await db.query(
      `SELECT COUNT(*) as total_ratings, AVG(CAST(sao AS DECIMAL(2,1))) as avg_rating FROM danh_gia`
    );

    return {
      chat: chatStats[0] || { total_messages: 0, unique_customers: 0 },
      ratings: ratingStats[0] || { total_ratings: 0, avg_rating: 0 }
    };
  }
};

module.exports = engagementService;
