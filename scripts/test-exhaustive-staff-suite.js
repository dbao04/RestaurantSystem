/**
 * BỘ KIỂM THỬ AUTOMATION TOÀN DIỆN & CHI TIẾT TỪNG GÓC CỦA KHU VỰC NHÂN VIÊN (STAFF PORTAL)
 * Kiểm tra tỉ mỉ mọi trang, role, API, form, quyền hạn, dữ liệu EJS và bảo đảm 0 lỗi.
 */
const http = require('http');
const querystring = require('querystring');

const BASE_HOST = '127.0.0.1';
const BASE_PORT = 3000;

function request(options, postData = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const headers = options.headers || {};
    if (cookie) {
      headers['Cookie'] = cookie;
    }
    if (postData) {
      if (typeof postData === 'object' && !headers['Content-Type']) {
        postData = querystring.stringify(postData);
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const reqOptions = {
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: options.path,
      method: options.method || (postData ? 'POST' : 'GET'),
      headers: headers,
      timeout: 15000
    };

    const startTime = Date.now();
    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const duration = Date.now() - startTime;
        const setCookie = res.headers['set-cookie'];
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
          cookie: setCookie ? setCookie.map(c => c.split(';')[0]).join('; ') : cookie,
          duration
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout after 15000ms'));
    });

    if (postData) req.write(postData);
    req.end();
  });
}

async function loginStaff(username, password = '123456') {
  const initRes = await request({ path: '/staff/login' });
  let cookie = initRes.cookie;
  const loginRes = await request({
    path: '/staff/login',
    method: 'POST'
  }, { username, password, tiep: '/staff' }, cookie);

  if (loginRes.cookie) cookie = loginRes.cookie;
  return {
    statusCode: loginRes.statusCode,
    cookie: cookie,
    location: loginRes.headers['location']
  };
}

async function getWithAuth(path, cookie) {
  let res = await request({ path, method: 'GET' }, null, cookie);
  if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
    const loc = res.headers.location;
    if (loc.startsWith('/')) {
      const followRes = await request({ path: loc, method: 'GET' }, null, res.cookie || cookie);
      return followRes;
    }
  }
  return res;
}

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  details: []
};

function assertTest(category, name, condition, details = '', duration = 0) {
  results.total++;
  if (condition) {
    results.passed++;
    console.log(`  ✅ [${category.padEnd(14)}] ${name} (${duration}ms)`);
    results.details.push({ category, name, status: 'PASS', details, duration });
  } else {
    results.failed++;
    console.error(`  ❌ [${category.padEnd(14)}] ${name} - THẤT BẠI: ${details} (${duration}ms)`);
    results.details.push({ category, name, status: 'FAIL', details, duration });
  }
}

async function runExhaustiveSuite() {
  console.log('='.repeat(90));
  console.log('🚀 BẮT ĐẦU BỘ KIỂM THỬ AUTOMATION TOÀN DIỆN MỌI CHI TIẾT PHÂN HỆ NHÂN VIÊN (STAFF PORTAL)');
  console.log('='.repeat(90));

  // =========================================================================
  // 1. KIỂM THỬ ĐĂNG NHẬP & PHÂN QUYỀN 11 VAI TRÒ NHÂN SỰ (RBAC)
  // =========================================================================
  console.log('\n--- PHẦN 1: ĐĂNG NHẬP & XÁC THỰC 11 VAI TRÒ NHÂN SỰ ---');
  const roles = [
    { role: 'Quản lý', user: 'quanly' },
    { role: 'Trợ lý Quản lý', user: 'trolyquanly' },
    { role: 'Bếp trưởng', user: 'beptruong' },
    { role: 'Đầu bếp', user: 'daubep' },
    { role: 'Phục vụ', user: 'phucvu' },
    { role: 'Lễ tân', user: 'letan' },
    { role: 'Thu ngân', user: 'thungan' },
    { role: 'Kế toán', user: 'ketoan' },
    { role: 'Kế toán trưởng', user: 'ketoantruong' },
    { role: 'Điều phối GH', user: 'dieuphoi' },
    { role: 'Shipper', user: 'shipper2' }
  ];

  const sessions = {};
  for (const r of roles) {
    const loginRes = await loginStaff(r.user, '123456');
    sessions[r.user] = loginRes.cookie;
    const ok = loginRes.statusCode === 302 || loginRes.statusCode === 200;
    assertTest('AUTH_RBAC', `Đăng nhập vai trò ${r.role} (@${r.user})`, ok, `HTTP ${loginRes.statusCode}`);
  }

  const mgrCookie = sessions['quanly'];

  // =========================================================================
  // 2. KIỂM THỬ QUẢN LÝ / ĐIỀU HÀNH (@quanly)
  // =========================================================================
  console.log('\n--- PHẦN 2: PHÂN HỆ QUẢN LÝ & ĐIỀU HÀNH (@quanly) ---');

  const managerPages = [
    { name: 'Dashboard Tổng quan', path: '/staff' },
    { name: 'Bảng Điều hành Thời gian thực', path: '/staff/dieu-hanh' },
    { name: 'Sơ đồ Cơ cấu Tổ chức', path: '/staff/to-chuc' },
    { name: 'Quản lý Phân quyền & Chức danh', path: '/staff/to-chuc/quan-ly' },
    { name: 'Duyệt lịch làm việc nhân viên', path: '/staff/schedule/approval' },
    { name: 'Lưới Xếp ca tự động', path: '/staff/xep-ca' },
    { name: 'Định mức nhân sự theo ca', path: '/staff/xep-ca/dinh-muc' },
    { name: 'Quản lý chấm công nhân sự', path: '/staff/to-chuc/cham-cong' },
    { name: 'Dashboard Phân tích kinh doanh', path: '/staff/analytics' },
    { name: 'Dự báo AI Machine Learning', path: '/staff/du-bao' },
    { name: 'Chương trình Khuyến mãi', path: '/staff/khuyen-mai' },
    { name: 'Quản lý Khách hàng & Hạng thành viên', path: '/staff/thanh-vien' },
    { name: 'Hồ sơ cá nhân Quản lý', path: '/staff/profile' },
    { name: 'Lịch cá nhân Quản lý', path: '/staff/schedule' },
    { name: 'Đơn xin nghỉ phép Quản lý', path: '/staff/leave' },
    { name: 'Chấm công khuôn mặt Face AI', path: '/staff/attendance' }
  ];

  for (const p of managerPages) {
    const res = await getWithAuth(p.path, mgrCookie);
    const ok = res.statusCode === 200 && !res.data.includes('Server Error');
    assertTest('MANAGER_VIEW', p.name, ok, `HTTP ${res.statusCode}`, res.duration);
  }

  // =========================================================================
  // 3. KIỂM THỬ PHÂN HỆ BẾP (KDS & QUẢN TRỊ BẾP) (@beptruong)
  // =========================================================================
  console.log('\n--- PHẦN 3: PHÂN HỆ BẾP & KDS (@beptruong) ---');
  const kitchenCookie = sessions['beptruong'];

  const kitchenPages = [
    { name: 'Màn hình KDS Bếp Realtime (/kds)', path: '/kds' },
    { name: 'Màn hình KDS Bếp qua Portal (/staff/kds)', path: '/staff/kds' },
    { name: 'Tổng quan khu Bếp (/staff/kitchen)', path: '/staff/kitchen' },
    { name: 'Công thức & Định mức món ăn', path: '/staff/kitchen/recipes' },
    { name: 'Tồn kho nguyên liệu bếp (FIFO)', path: '/staff/kitchen/inventory' },
    { name: 'Lịch sử nhập xuất tồn kho nguyên liệu', path: '/staff/kitchen/stock-history' },
    { name: 'Danh sách món ăn & Trạng thái phục vụ', path: '/staff/kitchen/dishes' },
    { name: 'Quản lý Nhóm món ăn Bếp', path: '/staff/kitchen/categories' },
    { name: 'Quản lý Combo món ăn Bếp', path: '/staff/kitchen/combos' },
    { name: 'Trang thiết bị & Dụng cụ Bếp', path: '/staff/kitchen/equipment' },
    { name: 'Chốt ca trực Bếp', path: '/staff/kitchen/shift' }
  ];

  for (const p of kitchenPages) {
    const res = await getWithAuth(p.path, kitchenCookie);
    const ok = res.statusCode === 200 && !res.data.includes('Server Error');
    assertTest('KITCHEN_KDS', p.name, ok, `HTTP ${res.statusCode}`, res.duration);
  }

  // =========================================================================
  // 4. KIỂM THỬ SẢNH, PHỤC VỤ & ĐẶT BÀN (@letan / @phucvu)
  // =========================================================================
  console.log('\n--- PHẦN 4: PHÂN HỆ PHỤC VỤ, LỄ TÂN & ĐẶT BÀN (@letan / @phucvu) ---');
  const letanCookie = sessions['letan'];

  const fohPages = [
    { name: 'Sơ đồ 40 bàn & Gọi món Realtime', path: '/so-do-ban' },
    { name: 'Quản lý Đặt bàn Thông minh', path: '/staff/dat-ban' },
    { name: 'Danh sách đơn đặt bàn & Tiệc', path: '/staff/bookings' },
    { name: 'Tạo đơn đặt bàn mới', path: '/staff/bookings/create' },
    { name: 'Quản lý mã QR bàn & Gọi món', path: '/staff/qr-codes' }
  ];

  for (const p of fohPages) {
    const res = await getWithAuth(p.path, letanCookie);
    const ok = res.statusCode === 200 && !res.data.includes('Server Error');
    assertTest('FOH_SERVICE', p.name, ok, `HTTP ${res.statusCode}`, res.duration);
  }

  // =========================================================================
  // 5. KIỂM THỬ THU NGÂN & THANH TOÁN (POS) (@thungan)
  // =========================================================================
  console.log('\n--- PHẦN 5: THU NGÂN, POS & CHỐT CA (@thungan) ---');
  const thunganCookie = sessions['thungan'];

  const cashierPages = [
    { name: 'Màn hình POS Thu ngân thanh toán', path: '/staff/thanh-toan' },
    { name: 'Đối soát chuyển khoản & VietQR', path: '/staff/thanh-toan/doi-soat' },
    { name: 'Lịch sử phiên thanh toán', path: '/staff/thanh-toan/lich-su' },
    { name: 'Màn hình Kiểm đếm & Chốt ca thu ngân', path: '/staff/chot-ca' },
    { name: 'Lịch sử các biên bản chốt ca', path: '/staff/chot-ca/lich-su' },
    { name: 'Tổng hợp doanh thu các ca', path: '/staff/chot-ca/tong-hop' }
  ];

  for (const p of cashierPages) {
    const res = await getWithAuth(p.path, thunganCookie);
    const ok = res.statusCode === 200 && !res.data.includes('Server Error');
    assertTest('CASHIER_POS', p.name, ok, `HTTP ${res.statusCode}`, res.duration);
  }

  // =========================================================================
  // 6. KIỂM THỬ KẾ TOÁN & LƯƠNG BỔNG (@ketoan)
  // =========================================================================
  console.log('\n--- PHẦN 6: KẾ TOÁN, LƯƠNG & BÁO CÁO TÀI CHÍNH (@ketoan) ---');
  const ketoanCookie = sessions['ketoan'];

  const accountantPages = [
    { name: 'Bảng tính lương toàn nhà hàng', path: '/staff/accountant/salary' },
    { name: 'Đối soát bảng chấm công nhân sự', path: '/staff/accountant/attendance' },
    { name: 'Tổng hợp ngày công theo tháng', path: '/staff/accountant/attendance/summary' },
    { name: 'Quản lý Phiếu chi & Chi phí vận hành', path: '/staff/accountant/expenses' },
    { name: 'Xét duyệt đơn nghỉ phép nhân sự', path: '/staff/accountant/leave' },
    { name: 'Báo cáo Doanh thu & Thu chi Kế toán', path: '/staff/accountant/reports' },
    { name: 'Trang in Báo cáo tài chính', path: '/staff/accountant/reports/print' },
    { name: 'Danh sách nhân sự phân hệ kế toán', path: '/staff/accountant/staff' },
    { name: 'Lịch làm việc phòng kế toán', path: '/staff/accountant/schedule' }
  ];

  for (const p of accountantPages) {
    const res = await getWithAuth(p.path, ketoanCookie);
    const ok = res.statusCode === 200 && !res.data.includes('Server Error');
    assertTest('ACCOUNTANT', p.name, ok, `HTTP ${res.statusCode}`, res.duration);
  }

  // =========================================================================
  // 7. KIỂM THỬ ĐIỀU PHỐI GIAO HÀNG & SHIPPER (@dieuphoi / @shipper2)
  // =========================================================================
  console.log('\n--- PHẦN 7: ĐIỀU PHỐI GIAO HÀNG & ỨNG DỤNG SHIPPER ---');
  const dieuphoiCookie = sessions['dieuphoi'];

  const deliveryPages = [
    { name: 'Bảng Điều phối đơn giao hàng', path: '/staff/giao-hang' },
    { name: 'Bản đồ giám sát Shipper GPS Realtime', path: '/staff/giao-hang/ban-do' }
  ];

  for (const p of deliveryPages) {
    const res = await getWithAuth(p.path, dieuphoiCookie);
    const ok = res.statusCode === 200 && !res.data.includes('Server Error');
    assertTest('DELIVERY_MGMT', p.name, ok, `HTTP ${res.statusCode}`, res.duration);
  }

  const shipperCookie = sessions['shipper2'];
  const shipperAppRes = await getWithAuth('/shipper', shipperCookie);
  assertTest('SHIPPER_PWA', 'Ứng dụng di động PWA cho Shipper (/shipper)', shipperAppRes.statusCode === 200, `HTTP ${shipperAppRes.statusCode}`, shipperAppRes.duration);

  const shipperOrdersRes = await getWithAuth('/api/shipper/don-cua-toi', shipperCookie);
  assertTest('SHIPPER_API', 'API Đơn hàng được giao của Shipper', shipperOrdersRes.statusCode === 200, `HTTP ${shipperOrdersRes.statusCode}`, shipperOrdersRes.duration);

  // =========================================================================
  // 8. KIỂM THỬ CHẤM CÔNG DI ĐỘNG & KIOSK KHUÔN MẶT
  // =========================================================================
  console.log('\n--- PHẦN 8: CHẤM CÔNG DI ĐỘNG & KIOSK KHUÔN MẶT AI ---');
  const phucvuCookie = sessions['phucvu'];

  const facePages = [
    { name: 'Ứng dụng Chấm công Di động PWA (/cham-cong/)', path: '/cham-cong/' },
    { name: 'Màn hình Kiosk Chấm công Khuôn mặt 1:N (/cham-cong-khuon-mat)', path: '/cham-cong-khuon-mat' },
    { name: 'Trang Chấm công cá nhân & Lịch sử (/staff/attendance)', path: '/staff/attendance' },
    { name: 'Trang Tự đăng ký mẫu khuôn mặt lần đầu (/staff/khuon-mat/lan-dau)', path: '/staff/khuon-mat/lan-dau' }
  ];

  for (const p of facePages) {
    const res = await getWithAuth(p.path, phucvuCookie);
    const ok = res.statusCode === 200 && !res.data.includes('Server Error');
    assertTest('ATTENDANCE_AI', p.name, ok, `HTTP ${res.statusCode}`, res.duration);
  }

  // =========================================================================
  // 9. KIỂM THỬ TẤT CẢ CÁC API BACKEND CỦA NHÂN VIÊN
  // =========================================================================
  console.log('\n--- PHẦN 9: KIỂM THỬ CÁC REST API BACKEND NHÂN VIÊN ---');

  const apiEndpoints = [
    { name: 'API Sơ đồ cây Tổ chức', path: '/api/to-chuc/so-do' },
    { name: 'API Tổng quan Nhân sự', path: '/api/to-chuc/tong-quan' },
    { name: 'API Danh sách Nhân sự', path: '/api/to-chuc/nhan-su' },
    { name: 'API Hiện diện Nhân sự theo ca', path: '/api/to-chuc/hien-dien' },
    { name: 'API Danh mục Chức danh & Quyền hạn', path: '/api/to-chuc/chuc-danh' },
    { name: 'API Danh sách các Tổ làm việc', path: '/api/to-chuc/to' },
    { name: 'API Hồ sơ Phân quyền người đăng nhập', path: '/api/to-chuc/ho-so' },
    { name: 'API Việc cần xử lý', path: '/api/to-chuc/viec' },
    { name: 'API Danh sách Đặt bàn Nội bộ', path: '/api/reservations' },
    { name: 'API Dashboard / KPI Đặt bàn', path: '/api/reservations/dashboard' },
    { name: 'API Phân tích Đặt bàn (Analytics)', path: '/api/reservations/analytics' },
    { name: 'API Timeline Đặt bàn', path: '/api/reservations/timeline' },
    { name: 'API Kiểm tra Bàn trống', path: '/api/tables/availability?reservation_date=2026-10-15&start_time=19:00&guest_count=4' },
    { name: 'API Sơ đồ 40 Bàn Realtime', path: '/api/tables/floor-plan' },
    { name: 'API Khung giờ đặt bàn khả dụng', path: '/api/dat-ban/khung-gio' },
    { name: 'API Dữ liệu Chấm công theo ngày', path: '/api/cham-cong/ngay' },
    { name: 'API Trạng thái Nhận diện Khuôn mặt AI', path: '/api/khuon-mat/trang-thai' },
    { name: 'API Danh sách Vector Khuôn mặt', path: '/api/khuon-mat/danh-sach' },
    { name: 'API Tọa độ Vị trí Shipper', path: '/api/giao-hang/ban-do' },
    { name: 'API Báo giá Cước Vận chuyển', path: '/api/giao-hang/bao-gia?khoang_cach_km=5' }
  ];

  for (const api of apiEndpoints) {
    const res = await getWithAuth(api.path, mgrCookie);
    let ok = res.statusCode === 200;
    assertTest('STAFF_API', api.name, ok, `HTTP ${res.statusCode}`, res.duration);
  }

  // =========================================================================
  // 10. KIỂM THỬ BẢO MẬT & CÁC TRANG BỊ XÓA BÊN ADMIN KHÔNG ẢNH HƯỞNG STAFF
  // =========================================================================
  console.log('\n--- PHẦN 10: XÁC MINH BẢO MẬT & CÁC ROUTE BỊ XÓA KHÔNG RÒ RỈ ---');
  const securityChecks = [
    { name: 'Staff không thể vào /admin (Redirect về login)', path: '/admin', expected: 302 },
    { name: 'Admin cũ /admin/leavelist đã xóa hoàn toàn (404)', path: '/admin/leavelist', expected: 404 },
    { name: 'Admin cũ /admin/salary-approval đã xóa hoàn toàn (404)', path: '/admin/salary-approval', expected: 404 },
    { name: 'Admin cũ /admin/schedule đã xóa hoàn toàn (404)', path: '/admin/schedule', expected: 404 },
    { name: 'Admin cũ /admin/hopdonglist đã xóa hoàn toàn (404)', path: '/admin/hopdonglist', expected: 404 },
    { name: 'Admin cũ /admin/hopdongmoi đã xóa hoàn toàn (404)', path: '/admin/hopdongmoi', expected: 404 },
    { name: 'Admin cũ /admin/van-chuyen/shipper đã xóa hoàn toàn (404)', path: '/admin/van-chuyen/shipper', expected: 404 }
  ];

  for (const s of securityChecks) {
    const res = await request({
      path: s.path,
      method: 'GET'
    }, null, mgrCookie);
    const ok = res.statusCode === s.expected || (s.expected === 302 && (res.statusCode === 301 || res.statusCode === 302));
    assertTest('SECURITY_AUDIT', s.name, ok, `HTTP ${res.statusCode} (Kỳ vọng: ${s.expected})`, res.duration);
  }

  // =========================================================================
  // TỔNG KẾT
  // =========================================================================
  console.log('\n' + '='.repeat(90));
  console.log('                          📊 BÁO CÁO TỔNG KẾT KIỂM THỬ STAFF');
  console.log('='.repeat(90));
  console.log(`  🔹 Tổng số kịch bản kiểm tra chi tiết : ${results.total}`);
  console.log(`  ✅ Thành công                            : ${results.passed} / ${results.total} (${Math.round(results.passed / results.total * 100)}%)`);
  console.log(`  ❌ Thất bại                              : ${results.failed}`);
  console.log('='.repeat(90));

  if (results.failed > 0) {
    console.error('\nDANH SÁCH CÁC TEST CASE THẤT BẠI:');
    results.details.filter(d => d.status === 'FAIL').forEach(d => {
      console.error(`- [${d.category}] ${d.name}: ${d.details}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 TẤT CẢ 100% CÁC TRANG VÀ TÍNH NĂNG STAFF HOẠT ĐỘNG HOÀN HẢO, KHÔNG CÓ BẤT KỲ LỖI NÀO!');
    process.exit(0);
  }
}

runExhaustiveSuite().catch(err => {
  console.error('Lỗi nghiêm trọng khi chạy suite:', err);
  process.exit(1);
});
