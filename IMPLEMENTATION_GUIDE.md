# 🏪 Restaurant Management System - Tài Liệu Nâng Cấp v2

## 📋 Mục Lục
1. [Cài Đặt & Khởi Tạo](#cài-đặt--khởi-tạo)
2. [Các Tính Năng Mới](#các-tính-năng-mới)
3. [Cấu Trúc Authentication Cải Thiện](#cấu-trúc-authentication-cải-thiện)
4. [API Endpoints](#api-endpoints)
5. [Triển Khai & Hướng Dẫn](#triển-khai--hướng-dẫn)

---

## 🚀 Cài Đặt & Khởi Tạo

### 1. Chạy Database Migration

```bash
# Di chuyển đến thư mục project
cd c:\xampp\htdocs\restaurant

# Chạy migration script
node config/migrate.js
```

**Điều này sẽ tạo các bảng mới:**
- `audit_logs` - Ghi nhật ký hoạt động
- `loyalty_points` - Điểm tích lũy khách hàng
- `loyalty_transactions` - Lịch sử giao dịch điểm
- `discount_codes` - Mã giảm giá
- `payment_methods` - Phương thức thanh toán
- `payments` - Lịch sử thanh toán
- `order_cancellations` - Yêu cầu hủy đơn
- `shift_closings` - Chốt ca làm việc

### 2. Cập Nhật server.js

Thêm vào đầu file server.js (sau các require cơ bản):

```javascript
// Import new middleware and services
const authMiddleware = require('./middleware/auth');
const errorMiddleware = require('./middleware/errorHandler');
const generalStaffRoutes = require('./routes/generalStaff');
const loyaltyRoutes = require('./routes/loyalty');
const adminLoyaltyRoutes = require('./routes/adminLoyalty');

// ... existing code ...

// Apply new middleware BEFORE routes
app.use(errorMiddleware.handleValidationErrors);

// Use new routes
app.use('/staff/general', authMiddleware.requireStaffLogin, generalStaffRoutes);
app.use('/customer', loyaltyRoutes);
app.use('/admin', adminLoyaltyRoutes);

// Error handlers AFTER all routes
app.use(errorMiddleware.notFoundHandler);
app.use(errorMiddleware.errorHandler);
```

### 3. Cấu Hình Environment Variables

Thêm vào file `.env`:

```env
# Payment Gateway (Optional - cho Payment feature)
STRIPE_KEY=your_stripe_key_here
PAYPAL_CLIENT_ID=your_paypal_client_id_here

# SMS Service (Optional - cho SMS Notifications)
TWILIO_ACCOUNT_SID=your_twilio_sid_here
TWILIO_AUTH_TOKEN=your_twilio_token_here
TWILIO_PHONE_NUMBER=+1234567890

# Audit Logging
AUDIT_LOG_ENABLED=true

# Session Security
SESSION_SECRET=your_secure_random_string_here
NODE_ENV=production
```

---

## ✨ Các Tính Năng Mới

### 1. Loyalty Points System (Hệ thống Điểm Tích Lũy)

**Tính năng:**
- Khách hàng tích lũy điểm từ mỗi đơn hàng (1 điểm = 1.000 VNĐ)
- Điểm được phân theo level: Bronze (đồng), Silver (bạc), Gold (vàng), Platinum (bạch kim)
- Sử dụng điểm để giảm giá hoặc nhận ưu đãi
- Xem lịch sử giao dịch điểm

**Cách sử dụng:**
```javascript
const loyaltyService = require('./services/loyaltyService');

// Thêm điểm cho khách hàng
await loyaltyService.addPoints(customerId, 100, 'Đơn hàng #12345');

// Sử dụng điểm
await loyaltyService.redeemPoints(customerId, 50, 'Giảm giá đơn hàng');

// Lấy thông tin tích lũy
const loyalty = await loyaltyService.getLoyaltyInfo(customerId);
```

**Route cho Khách hàng:**
- `GET /customer/loyalty` - Xem dashboard điểm
- `GET /customer/loyalty/history` - Xem lịch sử
- `POST /customer/loyalty/redeem` - Sử dụng điểm

### 2. Discount Code System (Hệ thống Mã Giảm Giá)

**Tính năng:**
- Admin tạo mã giảm giá theo phần trăm hoặc số tiền cố định
- Hỗ trợ giới hạn số lần sử dụng
- Tự động kiểm tra thời gian hiệu lực
- Áp dụng tối thiểu và tối đa giá trị đơn hàng

**Ví dụ tạo mã giảm giá:**
```javascript
const { discountService } = require('./services/discountService');

await discountService.createCode({
  code: 'SUMMER20',
  description: 'Giảm 20% mùa hè',
  discount_type: 'percentage',
  discount_value: 20,
  max_usage: 100,
  valid_from: '2024-01-01',
  valid_until: '2024-12-31',
  min_order_value: 500000,
  max_discount_amount: 200000,
  created_by: admin_id
});
```

**Route cho Admin:**
- `GET /admin/discounts` - Danh sách mã
- `GET /admin/discounts/add` - Thêm mã mới
- `POST /admin/discounts/:id` - Cập nhật mã

### 3. Nhân Viên Chung (General Staff) Features

**Tính năng:**
- Dashboard tổng quan với số liệu chính
- Chấm công vào/ra
- Đăng ký lịch làm việc
- Xem thông báo

**Route:**
- `GET /staff/general` - Dashboard
- `POST /staff/general/check-in` - Chấm công vào
- `POST /staff/general/check-out` - Chấm công ra
- `GET /staff/general/attendance` - Lịch sử chấm công
- `GET /staff/general/schedule-register` - Đăng ký lịch
- `GET /staff/general/notifications` - Xem thông báo

### 4. Audit Logging System (Hệ thống Ghi Nhật Ký)

**Tính năng:**
- Tự động ghi lại tất cả các hành động quan trọng
- Theo dõi người dùng, loại hành động, tài nguyên
- Hỗ trợ lọc theo thời gian, loại, người thực hiện

**Ví dụ ghi nhật ký:**
```javascript
const auditService = require('./services/auditService');

await auditService.log({
  action: 'create_order',
  actor_type: 'customer',
  actor_id: 123,
  actor_name: 'Nguyễn Văn A',
  resource_type: 'order',
  resource_id: 456,
  status: 'success',
  details: { amount: 500000, table: 5 },
  ip_address: req.ip,
  user_agent: req.get('user-agent')
});

// Lấy logs
const logs = await auditService.getLogs({
  actor_type: 'customer',
  action: 'create_order',
  limit: 50
});
```

### 5. Validation System Cải Tiến

**Tính năng:**
- Kiểm tra input toàn diện (email, số điện thoại, mật khẩu, ngày tháng)
- Vệ sinh dữ liệu (sanitize) để chống XSS
- Thông báo lỗi chi tiết cho người dùng

**Sử dụng:**
```javascript
const { validateAndSanitize } = require('./utils/validation');

const schema = {
  email: { required: true, type: 'email' },
  phone: { required: true, type: 'phone' },
  password: { 
    required: true, 
    minLength: 6,
    label: 'Mật khẩu'
  }
};

const result = validateAndSanitize(req.body, schema);

if (!result.valid) {
  return res.status(400).json({
    error: true,
    errors: result.errors
  });
}

// result.data contains sanitized data
```

### 6. Error Handling Cải Tiến

**Tính năng:**
- Global error handler
- Async handler wrapper (bắt lỗi từ async functions)
- Các view lỗi thân thiện
- 404 handler

**Sử dụng:**
```javascript
// Bọc các route async
const { asyncHandler } = require('./middleware/errorHandler');

app.get('/api/data', asyncHandler(async (req, res) => {
  const data = await someAsyncOperation();
  res.json(data);
  // Lỗi sẽ tự động được xử lý
}));
```

---

## 🔐 Cấu Trúc Authentication Cải Thiện

### Middleware Auth Mới

**File:** `middleware/auth.js`

```javascript
// Sử dụng middleware tương ứng:

// Cho khách hàng
requireCustomerLogin       // Yêu cầu đăng nhập
requireCustomerNotLogin    // Yêu cầu chưa đăng nhập

// Cho admin
requireAdminLogin          // Yêu cầu admin
requireAdminNotLogin       // Yêu cầu chưa đăng nhập

// Cho nhân viên
requireStaffLogin          // Yêu cầu đăng nhập
requireStaffNotLogin       // Yêu cầu chưa đăng nhập
requireStaffRole(['Bep'])  // Yêu cầu role cụ thể
requirePermission('manage_kitchen')  // Yêu cầu quyền cụ thể
```

**Ví dụ sử dụng:**
```javascript
// Cho nhân viên bếp
app.post('/staff/kitchen/add', 
  requireStaffRole(['Bep']),
  auditLog('add_dish'),
  asyncHandler(async (req, res) => {
    // code here
  })
);
```

### Role-Based Access Control (RBAC)

**Các role có sẵn:**
- `Phuc vu` - Nhân viên phục vụ
- `Bep` - Nhân viên bếp
- `Ke toan` - Nhân viên kế toán
- `Quay` - Nhân viên quầy/thu ngân
- `Nhan vien chung` - Nhân viên chung (role mới)

**Quyền (permissions):**
```javascript
const PERMISSIONS = {
  'view_bookings': ['Phuc vu', 'Ke toan', 'Quay'],
  'manage_kitchen': ['Bep', 'Quay'],
  'manage_inventory': ['Bep'],
  'manage_finances': ['Ke toan'],
  'manage_staff': ['Ke toan'],
  'manage_menu': ['Bep'],
  'view_reports': ['Ke toan']
};
```

---

## 📡 API Endpoints

### Khách Hàng - Loyalty & Discount

| Method | Route | Mô Tả |
|--------|-------|-------|
| GET | `/customer/loyalty` | Xem dashboard điểm |
| GET | `/customer/loyalty/history` | Lịch sử giao dịch |
| GET | `/customer/discounts` | Danh sách mã giảm giá |
| POST | `/customer/discount/validate` | Kiểm tra mã (không áp dụng) |
| POST | `/customer/discount/apply` | Áp dụng mã giảm giá |
| POST | `/customer/loyalty/redeem` | Sử dụng điểm |

### Nhân Viên - General Staff

| Method | Route | Mô Tả |
|--------|-------|-------|
| GET | `/staff/general` | Dashboard |
| POST | `/staff/general/check-in` | Chấm công vào |
| POST | `/staff/general/check-out` | Chấm công ra |
| GET | `/staff/general/attendance` | Lịch sử chấm công |
| GET | `/staff/general/schedule-register` | Đăng ký lịch |
| POST | `/staff/general/schedule-register` | Lưu đăng ký lịch |
| GET | `/staff/general/notifications` | Xem thông báo |

### Admin - Loyalty & Discount Management

| Method | Route | Mô Tả |
|--------|-------|-------|
| GET | `/admin/discounts` | Danh sách mã |
| GET | `/admin/discounts/add` | Form thêm mã |
| POST | `/admin/discounts/add` | Tạo mã mới |
| GET | `/admin/discounts/:id` | Sửa mã |
| POST | `/admin/discounts/:id` | Cập nhật mã |
| GET | `/admin/discounts/:id/delete` | Xóa mã |
| GET | `/admin/loyalty/stats` | Thống kê tích lũy |
| GET | `/admin/payment-methods` | Quản lý phương thức TT |

---

## 🔧 Triển Khai & Hướng Dẫn

### Bước 1: Backup Database (Quan Trọng!)

```sql
-- Chạy từ MySQL command line
BACKUP DATABASE restaurant TO DISK = 'C:\\backup\\restaurant.bak';
```

### Bước 2: Chạy Migration

```bash
node config/migrate.js
```

### Bước 3: Cập Nhật server.js

Xem phần [Cập Nhật server.js](#2-cập-nhật-serverjs)

### Bước 4: Khởi Tạo Loyalty cho Khách Hàng Hiện Tại (Optional)

```bash
node -e "
const db = require('./config/db');
const loyaltyService = require('./services/loyaltyService');

(async () => {
  const [customers] = await db.query('SELECT id FROM khach_hang');
  for (const c of customers) {
    await loyaltyService.createLoyaltyAccount(c.id);
  }
  console.log('Đã tạo loyalty accounts cho tất cả khách hàng');
  process.exit(0);
})();
"
```

### Bước 5: Test Các Tính Năng Mới

**Test Loyalty Points:**
```javascript
// In console hoặc Postman
fetch('/customer/loyalty', {
  headers: { 'Cookie': 'session=...' }
}).then(r => r.text()).then(console.log);
```

**Test Discount Code:**
```javascript
fetch('/customer/discount/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    code: 'SUMMER20', 
    orderValue: 1000000 
  })
}).then(r => r.json()).then(console.log);
```

---

## 📊 Database Schema

### loyalty_points
```sql
- id (PK)
- id_kh (FK khach_hang)
- points (int)
- tier (enum: bronze, silver, gold, platinum)
- total_spent (decimal)
- redeemed_points (int)
- created_at, updated_at
```

### discount_codes
```sql
- id (PK)
- code (varchar, unique)
- description
- discount_type (percentage, fixed_amount)
- discount_value (decimal)
- max_usage (int)
- valid_from, valid_until (datetime)
- min_order_value (decimal)
- is_active (boolean)
```

### audit_logs
```sql
- id (PK)
- action (varchar)
- actor_type (enum: customer, admin, staff, system)
- actor_id, resource_id (int)
- status (enum: success, failed)
- details (JSON)
- created_at
```

---

## 🎯 Danh Sách Kiểm Tra Triển Khai

- [ ] Backup database
- [ ] Chạy migration
- [ ] Cập nhật server.js
- [ ] Cài đặt environment variables
- [ ] Khởi tạo loyalty cho khách hàng cũ
- [ ] Test tất cả routes mới
- [ ] Tạo discount codes cho khuyến mãi
- [ ] Đào tạo nhân viên về tính năng mới
- [ ] Monitor audit logs trong 2 tuần đầu
- [ ] Backup lại database sau khi test xong

---

## ❓ Câu Hỏi Thường Gặp

**Q: Tôi có thể rollback không?**
A: Có, backup database trước khi chạy migration. Nếu có vấn đề, restore database từ backup.

**Q: Payment Gateway có bắt buộc không?**
A: Không, hiện tại chỉ là framework. Để sử dụng, tích hợp Stripe hoặc PayPal.

**Q: Làm sao để tắt Audit Logging?**
A: Thêm `AUDIT_LOG_ENABLED=false` vào `.env`

**Q: Có support SMS không?**
A: Framework đã chuẩn bị, cần tích hợp Twilio API.

---

## 📞 Hỗ Trợ

Nếu gặp lỗi, kiểm tra:
1. Database connection
2. Logs trong console
3. Error file logs (`forgot_err.txt`, `server_log.txt`)
4. Check .env variables

---

## 📈 Nâng Cấp Tiếp Theo

1. **Payment Gateway** - Tiếp hợp Stripe/PayPal
2. **SMS Notifications** - Twilio SMS
3. **Advanced Reports** - BI dashboard
4. **Mobile App** - React Native
5. **Multi-location** - Hỗ trợ nhiều chi nhánh

---

**Version:** 2.0
**Last Updated:** 2024-04-05
**Maintained by:** Development Team
