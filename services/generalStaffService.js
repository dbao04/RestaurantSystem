/**
 * GENERAL STAFF SERVICE
 * For 'Nhân viên chung' role - common features for all staff
 */

const db = require('../config/db');

const generalStaffService = {
  /**
   * Get dashboard stats for general staff
   */
  getDashboardStats: async (staffId) => {
    try {
      const [rows] = await db.query(
        `SELECT 
          (SELECT COUNT(*) FROM hopdong WHERE trangthai = 1) as scheduled_orders,
          (SELECT COUNT(*) FROM cham_cong WHERE ngay = CURDATE() AND id_nv = ?) as today_checked_in,
          (SELECT COUNT(*) FROM thong_bao WHERE id_nv = ? OR id_nv IS NULL AND da_doc = 0) as unread_notifications,
          (SELECT COUNT(*) FROM lich_lam_viec WHERE id_nv = ? AND ngay >= CURDATE() AND trangthai = 1) as upcoming_shifts
        `,
        [staffId, staffId, staffId]
      );
      
      return rows[0] || {};
    } catch (err) {
      console.error('Error getting dashboard stats:', err);
      return {};
    }
  },
  
  /**
   * Get upcoming work schedule
   */
  getUpcomingSchedule: async (staffId, days = 7) => {
    try {
      const [rows] = await db.query(
        `SELECT * FROM lich_lam_viec 
        WHERE id_nv = ? AND ngay >= CURDATE() AND ngay <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
        ORDER BY ngay ASC`,
        [staffId, days]
      );
      
      return rows;
    } catch (err) {
      console.error('Error getting upcoming schedule:', err);
      return [];
    }
  },
  
  /**
   * Check in / Clock in
   */
  checkIn: async (staffId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Check if already checked in today
      const [existing] = await db.query(
        'SELECT id FROM cham_cong WHERE id_nv = ? AND ngay = ? LIMIT 1',
        [staffId, today]
      );
      
      if (existing.length > 0) {
        throw new Error('Bạn đã chấm công vào hôm nay rồi');
      }
      
      await db.query(
        'INSERT INTO cham_cong (id_nv, ngay, gio_vao) VALUES (?, ?, NOW())',
        [staffId, today]
      );
      
      return true;
    } catch (err) {
      console.error('Error checking in:', err);
      throw err;
    }
  },
  
  /**
   * Check out / Clock out
   */
  checkOut: async (staffId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Find today's check in
      const [rows] = await db.query(
        'SELECT id FROM cham_cong WHERE id_nv = ? AND ngay = ? LIMIT 1',
        [staffId, today]
      );
      
      if (rows.length === 0) {
        throw new Error('Bạn chưa chấm công vào hôm nay');
      }
      
      await db.query(
        'UPDATE cham_cong SET gio_ra = NOW() WHERE id = ?',
        [rows[0].id]
      );
      
      return true;
    } catch (err) {
      console.error('Error checking out:', err);
      throw err;
    }
  },
  
  /**
   * Get today's attendance
   */
  getTodayAttendance: async (staffId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const [rows] = await db.query(
        'SELECT * FROM cham_cong WHERE id_nv = ? AND ngay = ?',
        [staffId, today]
      );
      
      return rows[0] || null;
    } catch (err) {
      console.error('Error getting today attendance:', err);
      return null;
    }
  },
  
  /**
   * Get personal availability (for shift registration)
   */
  getPersonalAvailability: async (staffId, month, year) => {
    try {
      const [rows] = await db.query(
        `SELECT * FROM lich_lam_viec 
        WHERE id_nv = ? AND MONTH(ngay) = ? AND YEAR(ngay) = ?
        ORDER BY ngay ASC`,
        [staffId, month, year]
      );
      
      return rows;
    } catch (err) {
      console.error('Error getting personal availability:', err);
      return [];
    }
  },
  
  /**
   * Register for a shift
   */
  registerShift: async (staffId, date, shift, notes = '') => {
    try {
      // Validate date is future
      const shiftDate = new Date(date);
      if (shiftDate < new Date(new Date().toISOString().split('T')[0])) {
        throw new Error('Không thể đăng ký lịch trong quá khứ');
      }
      
      // Check if already registered
      const [existing] = await db.query(
        'SELECT id FROM lich_lam_viec WHERE id_nv = ? AND ngay = ? AND ca = ?',
        [staffId, date, shift]
      );
      
      if (existing.length > 0) {
        throw new Error('Bạn đã đăng ký ca này rồi');
      }
      
      await db.query(
        `INSERT INTO lich_lam_viec (id_nv, ngay, ca, ghi_chu, trangthai) 
        VALUES (?, ?, ?, ?, 1)`,
        [staffId, date, shift, notes]
      );
      
      return true;
    } catch (err) {
      console.error('Error registering shift:', err);
      throw err;
    }
  },
  
  /**
   * Cancel shift registration
   */
  cancelShiftRegistration: async (staffId, scheduleId) => {
    try {
      // Verify ownership
      const [rows] = await db.query(
        'SELECT id, ngay FROM lich_lam_viec WHERE id = ? AND id_nv = ?',
        [scheduleId, staffId]
      );
      
      if (rows.length === 0) {
        throw new Error('Không tìm thấy lịch làm việc');
      }
      
      // Check if not in past
      const scheduleDate = new Date(rows[0].ngay);
      if (scheduleDate < new Date(new Date().toISOString().split('T')[0])) {
        throw new Error('Không thể hủy lịch trong quá khứ');
      }
      
      await db.query(
        'DELETE FROM lich_lam_viec WHERE id = ?',
        [scheduleId]
      );
      
      return true;
    } catch (err) {
      console.error('Error canceling shift:', err);
      throw err;
    }
  },
  
  /**
   * Get personal notifications
   */
  getPersonalNotifications: async (staffId, limit = 20) => {
    try {
      const [rows] = await db.query(
        `SELECT * FROM thong_bao 
        WHERE (id_nv = ? OR id_nv IS NULL) 
        ORDER BY created_at DESC 
        LIMIT ?`,
        [staffId, limit]
      );
      
      return rows;
    } catch (err) {
      console.error('Error getting notifications:', err);
      return [];
    }
  },
  
  /**
   * Mark notification as read
   */
  markNotificationAsRead: async (notificationId, staffId) => {
    try {
      await db.query(
        'UPDATE thong_bao SET da_doc = 1 WHERE id = ? AND (id_nv = ? OR id_nv IS NULL)',
        [notificationId, staffId]
      );
      
      return true;
    } catch (err) {
      console.error('Error marking notification:', err);
      throw err;
    }
  },
  
  /**
   * Get monthly attendance report
   */
  getMonthlyAttendanceReport: async (staffId, month, year) => {
    try {
      const [rows] = await db.query(
        `SELECT 
          DAY(ngay) as day,
          COUNT(*) as records,
          SUM(CASE WHEN gio_vao IS NOT NULL THEN 1 ELSE 0 END) as checked_in,
          SUM(CASE WHEN gio_ra IS NOT NULL THEN 1 ELSE 0 END) as checked_out,
          SUM(
            CASE WHEN gio_vao IS NOT NULL AND gio_ra IS NOT NULL 
            THEN TIMESTAMPDIFF(HOUR, gio_vao, gio_ra) 
            ELSE 0 END
          ) as total_hours
        FROM cham_cong
        WHERE id_nv = ? AND MONTH(ngay) = ? AND YEAR(ngay) = ?
        GROUP BY DAY(ngay)
        ORDER BY day ASC`,
        [staffId, month, year]
      );
      
      return rows;
    } catch (err) {
      console.error('Error getting monthly attendance:', err);
      return [];
    }
  }
};

module.exports = generalStaffService;
