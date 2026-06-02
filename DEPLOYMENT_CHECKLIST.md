# 📋 Nâng Cấp Hệ Thống - Danh Sách Kiểm Tra & Hướng Dẫn Triển Khai

## ✅ Danh Sách Kiểm Tra Hoàn Chỉnh

### Phase 1: Chuẩn Bị (15 phút)

- [ ] **Backup Database**
  ```sql
  -- MySQL Command Line
  BACKUP DATABASE restaurant TO DISK = 'C:\\backup\\restaurant.bak';
  ```

- [ ] **Backup Project Files**
  - Copy toàn bộ thư mục `c:\xampp\htdocs\restaurant` sang vị trí an toàn

- [ ] **Kiểm Tra Node.js & npm**
  ```bash
  node --version
  npm --version
  ```

- [ ] **Kiểm Tra Kết Nối Database**
  ```bash
  # Trong project folder
  node -e "require('./config/db').query('SELECT 1').then(() => console.log('✓ Database OK')).catch(e => console.error('✗ Error:' + e.message))"
  ```

### Phase 2: Cơ Sở Hạ Tầng (30 phút)

**Các tệp mới đã được tạo:**

- [ ] ✅ `middleware/auth.js` - Enhanced Authentication & Authorization
- [ ] ✅ `middleware/errorHandler.js` - Global Error Handling
- [ ] ✅ `utils/validation.js` - Input Validation Utilities
- [ ] ✅ `services/auditService.js` - Audit Logging
- [ ] ✅ `services/loyaltyService.js` - Loyalty Points Management
- [ ] ✅ `services/discountService.js` - Discount & Payment Processing
- [ ] ✅ `services/generalStaffService.js` - General Staff Features
- [ ] ✅ `routes/generalStaff.js` - General Staff Routes
- [ ] ✅ `routes/loyalty.js` - Customer Loyalty Routes
- [ ] ✅ `routes/adminLoyalty.js` - Admin Loyalty Management
- [ ] ✅ `config/migrate.js` - Database Migration Script
- [ ] ✅ `IMPLEMENTATION_GUIDE.md` - Detailed Documentation
- [ ] ✅ `SERVER_UPDATES.md` - Code Updates Guide

**Bước thực hiện:**

```bash
# Tất cả các tệp đã được tạo. Kiểm tra sự tồn tại:
ls middleware/
ls routes/
ls services/
```

### Phase 3: Database Migration (10 phút)

- [ ] **Chạy Migration Script**
  ```bash
  cd c:\xampp\htdocs\restaurant
  node config/migrate.js
  ```

- [ ] **Xác Nhận Các Bảng Mới Được Tạo**
  ```sql
  SHOW TABLES;
  -- Tìm: audit_logs, loyalty_points, discount_codes, payments, v.v.
  
  DESC audit_logs;
  DESC loyalty_points;
  DESC discount_codes;
  DESC order_cancellations;
  DESC shift_closings;
  DESC payment_methods;
  ```

- [ ] **Kiểm Tra Alter Table (Nếu Cần)**
  ```sql
  -- Kiểm tra chucvu field hỗ trợ 'Nhan vien chung'
  DESCRIBE nhan_vien;
  ```

### Phase 4: Cập Nhật server.js (45 phút)

**Quan trọng: Đọc kỹ SERVER_UPDATES.md trước!**

- [ ] **Bước 1: Backup server.js**
  ```bash
  cp server.js server.js.backup
  ```

- [ ] **Bước 2: Thêm Imports (Dòng 7-10)**
  Thêm vào sau các require hiện tại
  ```javascript
  const authMiddleware = require('./middleware/auth');
  const errorMiddleware = require('./middleware/errorHandler');
  const { validateAndSanitize, validatePassword } = require('./utils/validation');
  const auditService = require('./services/auditService');
  const loyaltyService = require('./services/loyaltyService');
  const generalStaffService = require('./services/generalStaffService');
  ```

- [ ] **Bước 3: Thêm Route Modules**
  ```javascript
  const generalStaffRoutes = require('./routes/generalStaff');
  const loyaltyRoutes = require('./routes/loyalty');
  const adminLoyaltyRoutes = require('./routes/adminLoyalty');
  ```

- [ ] **Bước 4: Thay Thế Auth Middleware (Dòng ~130)**
  ```javascript
  const requireLogin = authMiddleware.requireCustomerLogin;
  const requireAdmin = authMiddleware.requireAdminLogin;
  const requireStaff = authMiddleware.requireStaffLogin;
  const requireRole = authMiddleware.requireStaffRole;
  ```

- [ ] **Bước 5: Thêm Error Handler (Dòng ~105)**
  ```javascript
  app.use(errorMiddleware.handleValidationErrors);
  ```

- [ ] **Bước 6: Thêm Các Routes Mới (Trước Server.listen)**
  ```javascript
  app.use('/staff/general', generalStaffRoutes);
  app.use('/customer', loyaltyRoutes);
  app.use('/admin', adminLoyaltyRoutes);
  ```

- [ ] **Bước 7: Thêm Global Error Handlers (Cuối cùng, trước server.listen)**
  ```javascript
  app.use(errorMiddleware.notFoundHandler);
  app.use(errorMiddleware.errorHandler);
  ```

- [ ] **Bước 8: Cập Nhật POST /register (Xem SERVER_UPDATES.md)**
  - Thêm validation sử dụng validateAndSanitize
  - Thêm loyalty initialization
  - Thêm audit logging

- [ ] **Bước 9: Cập Nhật POST /datban (Xem SERVER_UPDATES.md)**
  - Thêm loyalty points calculation
  - Thêm apply discount support

- [ ] **Bước 10: Cập Nhật POST /cancel-order (Xem SERVER_UPDATES.md)**
  - Thêm order_cancellations table
  - Thêm audit logging

- [ ] **Kiểm Tra Syntax**
  ```bash
  node -c server.js
  # Nếu không có lỗi, "server.js" is OK.
  ```

### Phase 5: Khởi Tạo Dữ Liệu (20 phút)

- [ ] **Khởi Tạo Loyalty Cho Khách Hàng Hiện Tại** (Optional)
  ```bash
  node -e "
  const db = require('./config/db');
  const loyaltyService = require('./services/loyaltyService');
  
  (async () => {
    try {
      const [customers] = await db.query('SELECT id FROM khach_hang');
      let count = 0;
      for (const c of customers) {
        await loyaltyService.createLoyaltyAccount(c.id);
        count++;
      }
      console.log('✓ Đã tạo ' + count + ' loyalty accounts');
      process.exit(0);
    } catch(e) {
      console.error('✗ Error:', e.message);
      process.exit(1);
    }
  })();
  "
  ```

- [ ] **Tạo Payment Methods Mặc Định**
  ```bash
  node -e "
  const db = require('./config/db');
  
  (async () => {
    try {
      const methods = [
        ['Tiền Mặt', 'CASH', 'cash'],
        ['Thẻ Tín Dụng', 'CARD', 'card'],
        ['Ví Điện Tử', 'WALLET', 'wallet']
      ];
      
      for (const [name, code, type] of methods) {
        await db.query(
          'INSERT INTO payment_methods (name, code, type, is_active) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE is_active=1',
          [name, code, type]
        );
      }
      console.log('✓ Đã tạo payment methods');
      process.exit(0);
    } catch(e) {
      console.error('✗ Error:', e.message);
      process.exit(1);
    }
  })();
  "
  ```

- [ ] **Tạo Discount Code Mẫu (Optional)**
  ```sql
  INSERT INTO discount_codes (code, description, discount_type, discount_value, max_usage, valid_from, valid_until, is_active, created_by)
  VALUES 
  ('WELCOME10', 'Giảm 10% cho khách mới', 'percentage', 10, 100, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 1, 1),
  ('SUMMER20', 'Giảm 20% mùa hè', 'percentage', 20, 50, NOW(), DATE_ADD(NOW(), INTERVAL 90 DAY), 1, 1),
  ('SAVE50K', 'Giảm 50.000 VNĐ', 'fixed_amount', 50000, 30, NOW(), DATE_ADD(NOW(), INTERVAL 60 DAY), 1, 1);
  ```

### Phase 6: Testing (30 phút)

- [ ] **Test Server Start**
  ```bash
  npm start
  # Hoặc
  node server.js
  ```

- [ ] **Test Middleware Auth**
  - Truy cập `/staff/login` (không đăng nhập)
  - Truy cập `/staff/general` (thử truy cập không quyền)

- [ ] **Test General Staff Features**
  - [ ] Login as staff member (Nhan vien chung role)
  - [ ] Access `/staff/general` dashboard ✓
  - [ ] Test `/staff/general/check-in` ✓
  - [ ] Test `/staff/general/check-out` ✓
  - [ ] Test `/staff/general/schedule-register` ✓
  - [ ] Test `/staff/general/attendance` ✓

- [ ] **Test Loyalty Features (Customer)**
  - [ ] Login as customer
  - [ ] Register new account (check loyalty init) ✓
  - [ ] Access `/customer/loyalty` ✓
  - [ ] Create order (check points awarded) ✓
  - [ ] Access `/customer/discounts` ✓

- [ ] **Test Discount Features**
  - [ ] Apply discount code POST `/customer/discount/validate` ✓
  - [ ] Validate multiple codes ✓
  - [ ] Check min order value enforcement ✓

- [ ] **Test Admin Functions**
  - [ ] Access `/admin/discounts` ✓
  - [ ] Add new discount code ✓
  - [ ] Edit discount code ✓
  - [ ] View loyalty stats `/admin/loyalty/stats` ✓

- [ ] **Test Audit Logging**
  ```bash
  # In MySQL
  SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;
  ```

- [ ] **Test Error Handling**
  - [ ] Access non-existent route (should show 404) ✓
  - [ ] Try API with missing required fields (validation error) ✓
  - [ ] Check console for proper error logs ✓

### Phase 7: Production Preparation (15 phút)

- [ ] **Set Environment Variables**
  ```bash
  # Add to .env
  NODE_ENV=production
  AUDIT_LOG_ENABLED=true
  SESSION_SECRET=your_very_secure_random_string_here_min_32_chars
  ```

- [ ] **Test HTTPS/SSL** (if applicable)
  - Verify certificate validity
  - Check secure cookie settings

- [ ] **Performance Testing**
  ```bash
  # Test with multiple users
  # Monitor database connections
  # Check server memory usage
  ```

- [ ] **Security Scan**
  - [ ] Check for hardcoded passwords ✓
  - [ ] Verify SQL injection prevention ✓
  - [ ] Check XSS prevention (sanitization) ✓
  - [ ] Verify CSRF tokens (if applicable) ✓

### Phase 8: Deployment (Varies)

- [ ] **Stop Current Server**
  ```bash
  # If using PM2
  pm2 stop restaurant
  
  # Or manually stop the process
  ```

- [ ] **Deploy Updated Code**
  ```bash
  # If using Git
  git pull origin main
  
  # Or copy files manually
  cp -r /path/to/new/* /path/to/production/
  ```

- [ ] **Run Database Migration on Production**
  ```bash
  node config/migrate.js
  ```

- [ ] **Start Server**
  ```bash
  npm start
  # Or
  pm2 start server.js --name "restaurant"
  ```

- [ ] **Verify All Services**
  - [ ] Website loads ✓
  - [ ] Database connected ✓
  - [ ] All routes working ✓
  - [ ] Audit logs recording ✓

- [ ] **Monitor Logs**
  ```bash
  tail -f server_log.txt
  # Or use PM2
  pm2 logs restaurant
  ```

### Phase 9: Documentation & Rollout (30 phút)

- [ ] **Create Runbook for Operations Team**
  - Key endpoints
  - Common issues & solutions
  - Emergency procedures

- [ ] **Train Admin Users**
  - How to create discount codes
  - How to view loyalty statistics
  - How to manage payment methods

- [ ] **Train Staff Users**
  - New general staff dashboard
  - Check-in/out procedures
  - Schedule registration process

- [ ] **Communicate Changes to Customers**
  - Email about loyalty program launch
  - In-app notifications
  - Website announcements

---

## 🚨 Troubleshooting

### Error: "Cannot find module 'middleware/auth'"
```bash
# Verify files exist
ls -la middleware/auth.js
# If missing, recreate from provided code
```

### Error: "Table 'audit_logs' doesn't exist"
```bash
# Run migration again
node config/migrate.js
# If still fails, manually create (see config/migrate.js for SQL)
```

### Error: "Session secret is not set"
```bash
# Add to .env
SESSION_SECRET=your_random_string_32_chars_or_more
# Restart server
```

### No Loyalty Points Being Added
```bash
# Check:
# 1. Database migration ran
# 2. Customer has loyalty_points record
# 3. Server logs show no errors
SQL: SELECT * FROM loyalty_points WHERE id_kh = 1;
```

### Discount Code Not Applying
```bash
# Check:
# 1. Code is active
# 2. Still within valid date range
# 3. Order value meets min_order_value requirement
# 4. Usage count not exceeded
SELECT * FROM discount_codes WHERE code = 'SUMMER20';
```

---

## 📊 Database Verification Queries

```sql
-- Verify all new tables created
SHOW TABLES LIKE '%audit%';
SHOW TABLES LIKE '%loyalty%';
SHOW TABLES LIKE '%discount%';
SHOW TABLES LIKE '%payment%';

-- Check row counts
SELECT 'audit_logs' as table_name, COUNT(*) as count FROM audit_logs
UNION ALL
SELECT 'loyalty_points', COUNT(*) FROM loyalty_points
UNION ALL
SELECT 'discount_codes', COUNT(*) FROM discount_codes
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'order_cancellations', COUNT(*) FROM order_cancellations;

-- Check recent activities
SELECT action, COUNT(*) FROM audit_logs GROUP BY action ORDER BY COUNT(*) DESC;
```

---

## 📞 Support & Next Steps

### If Everything Works ✅
- Proceed to Phase 9 (Documentation & Rollout)
- Monitor system for 7 days
- Check audit logs daily

### If Issues Occur ❌
1. Check error logs: `console output` and `server_log.txt`
2. Verify database migrations: `SHOW TABLES`
3. Review server.js updates: Check for syntax errors
4. Restore from backup if necessary: `RESTORE DATABASE restaurant FROM DISK = 'backup.bak'`

### Contact Support
- Review IMPLEMENTATION_GUIDE.md for FAQ
- Check GitHub issues (if applicable)
- Contact development team with:
  - Error message
  - Log files
  - Steps to reproduce

---

## 🎯 Expected Outcomes After Upgrade

✅ Enhanced security with RBAC
✅ Audit trail for all sensitive operations
✅ Loyalty points system with customer engagement
✅ Flexible discount code system for promotions
✅ Better error handling and validation
✅ General staff features for common tasks
✅ Improved data integrity through validation
✅ Better staff management with new role support

---

**Checklist Version:** 1.0
**Last Updated:** 2024-04-05
**Estimated Total Time:** 3-4 hours
