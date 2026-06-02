/**
 * AUDIT LOG SERVICE
 * Logs all sensitive operations for compliance and debugging
 */

const db = require('../config/db');

const auditLogService = {
  /**
   * Create audit log entry
   */
  log: async (data) => {
    const {
      action,           // e.g., 'create_order', 'delete_staff', 'update_salary'
      actor_type,       // 'customer', 'admin', 'staff'
      actor_id,
      actor_name,
      resource_type,    // 'order', 'staff', 'dish', etc
      resource_id,
      status,           // 'success', 'failed'
      details,          // JSON object with details
      ip_address,
      user_agent
    } = data;
    
    try {
      await db.query(
        `INSERT INTO audit_logs (
          action, actor_type, actor_id, actor_name, 
          resource_type, resource_id, status, details,
          ip_address, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          action,
          actor_type,
          actor_id,
          actor_name,
          resource_type,
          resource_id,
          status,
          JSON.stringify(details),
          ip_address,
          user_agent
        ]
      );
    } catch (err) {
      console.error('Error creating audit log:', err);
      // Don't throw - audit logs should not break application flow
    }
  },
  
  /**
   * Get audit logs with filters
   */
  getLogs: async (filters = {}) => {
    const {
      action,
      actor_type,
      actor_id,
      resource_type,
      resource_id,
      status,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = filters;
    
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    
    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }
    
    if (actor_type) {
      query += ' AND actor_type = ?';
      params.push(actor_type);
    }
    
    if (actor_id) {
      query += ' AND actor_id = ?';
      params.push(actor_id);
    }
    
    if (resource_type) {
      query += ' AND resource_type = ?';
      params.push(resource_type);
    }
    
    if (resource_id) {
      query += ' AND resource_id = ?';
      params.push(resource_id);
    }
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    try {
      const [rows] = await db.query(query, params);
      return rows.map(row => ({
        ...row,
        details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details
      }));
    } catch (err) {
      console.error('Error getting audit logs:', err);
      return [];
    }
  },
  
  /**
   * Get activity summary
   */
  getActivitySummary: async (days = 7) => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const [rows] = await db.query(`
        SELECT 
          action,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM audit_logs
        WHERE created_at >= ?
        GROUP BY action
        ORDER BY total DESC
      `, [startDate]);
      
      return rows;
    } catch (err) {
      console.error('Error getting activity summary:', err);
      return [];
    }
  },
  
  /**
   * Get user activity
   */
  getUserActivity: async (actor_id, actor_type = null, limit = 50) => {
    try {
      let query = `
        SELECT * FROM audit_logs
        WHERE actor_id = ?
      `;
      const params = [actor_id];
      
      if (actor_type) {
        query += ' AND actor_type = ?';
        params.push(actor_type);
      }
      
      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);
      
      const [rows] = await db.query(query, params);
      return rows.map(row => ({
        ...row,
        details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details
      }));
    } catch (err) {
      console.error('Error getting user activity:', err);
      return [];
    }
  }
};

module.exports = auditLogService;
