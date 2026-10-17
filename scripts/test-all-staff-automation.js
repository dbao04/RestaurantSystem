/**
 * Kịch bản Test Automation toàn diện chuyên sâu cho toàn bộ hệ thống nhân viên (Staff Portal).
 * Kiểm tra từng màn hình, từng vai trò (Role-Based Testing), từng API endpoint và các hành vi nghiệp vụ.
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
      method: options.method || 'GET',
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
          setCookie: setCookie ? setCookie.map(c => c.split(';')[0]).join('; ') : null,
          duration
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout after 15000ms'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function loginStaff(username, password = '123456') {
  const loginRes = await request({
    path: '/staff/login',
    method: 'POST'
  }, { username, password });

  let cookie = loginRes.setCookie;
  if (!cookie && loginRes.statusCode === 302) {
    const initRes = await request({ path: '/staff/login' });
    cookie = initRes.setCookie;
    const postRes = await request({
      path: '/staff/login',
      method: 'POST'
    }, { username, password }, cookie);
    if (postRes.setCookie) cookie = postRes.setCookie;
  }
  return {
    statusCode: loginRes.statusCode,
    cookie: cookie,
    location: loginRes.headers['location']
  };
}

async function runFullStaffAutomation() {
  console.log('================================================================================');
  console.log('  🚀 BẮT ĐẦU TEST AUTOMATION TOÀN DIỆN MỌI CHI TIẾT TRANG NHÂN VIÊN (STAFF PORTAL)');
  console.log('================================================================================\n');

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
  };

  function logTest(module, name, passed, note, duration) {
    results.total++;
    if (passed) {
      results.passed++;
      console.log(`  ✅ [${module.padEnd(12, ' ')}] ${name} (${duration}ms)`);
    } else {
      results.failed++;
      console.log(`  ❌ [${module.padEnd(12, ' ')}] ${name} -> ${note} (${duration}ms)`);
    }
    results.details.push({ module, name, passed, note, duration });
  }

  // -------------------------------------------------------------
  // PHẦN 1: TEST ĐĂNG NHẬP VÀ PHÂN QUYỀN TOÀN BỘ 10 VAI TRÒ CHÍNH
  // -------------------------------------------------------------
  console.log('--- PHẦN 1: XÁC THỰC & ĐĂNG NHẬP THEO TỪNG VAI TRÒ (RBAC AUTH) ---');
  const staffAccounts = [
    { role: 'Quản lý', user: 'quanly', expectedHome: '/staff' },
    { role: 'Trợ lý QL', user: 'trolyquanly', expectedHome: '/staff' },
    { role: 'Bếp trưởng', user: 'beptruong', expectedHome: '/staff' },
    { role: 'Đầu bếp', user: 'daubep', expectedHome: '/staff' },
    { role: 'Phục vụ', user: 'phucvu', expectedHome: '/staff' },
    { role: 'Lễ tân', user: 'letan', expectedHome: '/staff' },
    { role: 'Thu ngân', user: 'thungan', expectedHome: '/staff' },
    { role: 'Kế toán', user: 'ketoan', expectedHome: '/staff' },
    { role: 'Kế toán trưởng', user: 'ketoantruong', expectedHome: '/staff' },
    { role: 'Điều phối GH', user: 'dieuphoi', expectedHome: '/staff' },
    { role: 'Shipper', user: 'shipper1', expectedHome: '/staff' }
  ];

  const sessions = {};
  for (const acc of staffAccounts) {
    const t0 = Date.now();
    try {
      const auth = await loginStaff(acc.user);
      const ok = auth.statusCode === 302 && !!auth.cookie;
      sessions[acc.user] = auth.cookie;
      logTest('AUTH_LOGIN', `Đăng nhập ${acc.role} (@${acc.user})`, ok, `Status ${auth.statusCode}`, Date.now() - t0);
    } catch (e) {
      logTest('AUTH_LOGIN', `Đăng nhập ${acc.role} (@${acc.user})`, false, e.message, Date.now() - t0);
    }
  }

  const mgrCookie = sessions['quanly'];
  const kitchenCookie = sessions['beptruong'];
  const cashierCookie = sessions['thungan'];
  const accountantCookie = sessions['ketoantruong'] || sessions['ketoan'];
  const receptionCookie = sessions['letan'];
  const waiterCookie = sessions['phucvu'];
  const dispatchCookie = sessions['dieuphoi'];
  const shipperCookie = sessions['shipper1'];

  // -------------------------------------------------------------
  // PHẦN 2: TRANG ĐIỀU HÀNH & DASHBOARD CHUNG
  // -------------------------------------------------------------
  console.log('\n--- PHẦN 2: BẢNG ĐIỀU HÀNH, DASHBOARD & TIỆN ÍCH CHUNG ---');
  const generalSuites = [
    { path: '/staff', name: 'Trang chủ Dashboard Nhân viên', cookie: mgrCookie },
    { path: '/staff/dieu-hanh', name: 'Bảng Điều hành Thời gian thực (Live Dashboard)', cookie: mgrCookie },
    { path: '/staff/profile', name: 'Trang thông tin cá nhân nhân viên', cookie: waiterCookie },
    { path: '/staff/notifications', name: 'Trung tâm thông báo công việc', cookie: waiterCookie },
    { path: '/staff/schedule', name: 'Lịch làm việc & Đăng ký ca tuần', cookie: waiterCookie },
    { path: '/staff/attendance', name: 'Bảng chấm công cá nhân của nhân viên', cookie: waiterCookie },
    { path: '/staff/leave', name: 'Gửi và theo dõi đơn xin nghỉ phép', cookie: waiterCookie },
    { path: '/staff/chat', name: 'Hệ thống Chat nội bộ nhân viên', cookie: waiterCookie },
    { path: '/staff/customers', name: 'Tra cứu danh sách & thông tin khách hàng', cookie: receptionCookie },
    { path: '/staff/emails', name: 'Danh sách thư điện tử nội bộ', cookie: mgrCookie },
    { path: '/staff/qr-codes', name: 'Quản lý mã QR bàn & menu gọi món', cookie: mgrCookie }
  ];

  for (const s of generalSuites) {
    try {
      const res = await request({ path: s.path }, null, s.cookie);
      const passed = res.statusCode === 200 && res.data.length > 500;
      logTest('GENERAL_PAGE', s.name, passed, `Status: ${res.statusCode}`, res.duration);
    } catch (e) {
      logTest('GENERAL_PAGE', s.name, false, e.message, 0);
    }
  }

  // -------------------------------------------------------------
  // PHẦN 3: PHÂN HỆ BẾP (KDS, THỰC ĐƠN, NGUYÊN LIỆU, CÔNG THỨC)
  // -------------------------------------------------------------
  console.log('\n--- PHẦN 3: PHÂN HỆ BẾP (KDS & QUẢN TRỊ BẾP) ---');
  const kitchenSuites = [
    { path: '/kds', name: 'Màn hình KDS Bếp Realtime (/kds)', cookie: kitchenCookie },
    { path: '/staff/kds', name: 'Màn hình KDS Bếp qua Portal (/staff/kds)', cookie: kitchenCookie },
    { path: '/staff/kitchen', name: 'Tổng quan khu Bếp (/staff/kitchen)', cookie: kitchenCookie },
    { path: '/staff/kitchen/dishes', name: 'Quản lý trạng thái món ăn bếp (Hết món / Còn món)', cookie: kitchenCookie },
    { path: '/staff/kitchen/categories', name: 'Danh mục nhóm món ăn bếp', cookie: kitchenCookie },
    { path: '/staff/kitchen/combos', name: 'Quản lý Combo món ăn bếp', cookie: kitchenCookie },
    { path: '/staff/kitchen/inventory', name: 'Quản lý tồn kho nguyên liệu bếp (FIFO)', cookie: kitchenCookie },
    { path: '/staff/kitchen/recipes', name: 'Định mức công thức chế biến từng món', cookie: kitchenCookie },
    { path: '/staff/kitchen/equipment', name: 'Trang thiết bị & máy móc khu bếp', cookie: kitchenCookie },
    { path: '/staff/kitchen/stock-history', name: 'Nhật ký xuất nhập hao hụt nguyên liệu', cookie: kitchenCookie },
    { path: '/staff/kitchen/shift', name: 'Ca trực và phân công khu bếp', cookie: kitchenCookie }
  ];

  for (const s of kitchenSuites) {
    try {
      const res = await request({ path: s.path }, null, s.cookie);
      const passed = res.statusCode === 200 && res.data.length > 500;
      logTest('KITCHEN_KDS', s.name, passed, `Status: ${res.statusCode}`, res.duration);
    } catch (e) {
      logTest('KITCHEN_KDS', s.name, false, e.message, 0);
    }
  }

  // -------------------------------------------------------------
  // PHẦN 4: PHÂN HỆ ĐẶT BÀN & SƠ ĐỒ BÀN (TABLE FLOOR PLAN)
  // -------------------------------------------------------------
  console.log('\n--- PHẦN 4: ĐẶT BÀN & SƠ ĐỒ BÀN REALTIME ---');
  const bookingSuites = [
    { path: '/so-do-ban', name: 'Sơ đồ 40 bàn 4 khu vực thời gian thực', cookie: receptionCookie },
    { path: '/staff/bookings', name: 'Danh sách và trạng thái các lượt đặt bàn', cookie: receptionCookie },
    { path: '/staff/bookings/create', name: 'Form nhân viên tạo đơn đặt bàn hộ khách', cookie: receptionCookie },
    { path: '/staff/dat-ban', name: 'Trung tâm Đặt bàn thông minh (Timeline & Xếp bàn)', cookie: receptionCookie },
    { path: '/staff/dat-ban/phan-tich', name: 'Phân tích hiệu suất đặt bàn & tỷ lệ no-show (Quản lý)', cookie: mgrCookie }
  ];

  for (const s of bookingSuites) {
    try {
      const res = await request({ path: s.path }, null, s.cookie);
      const passed = res.statusCode === 200 && res.data.length > 500;
      logTest('RESERVATIONS', s.name, passed, `Status: ${res.statusCode}`, res.duration);
    } catch (e) {
      logTest('RESERVATIONS', s.name, false, e.message, 0);
    }
  }

  // -------------------------------------------------------------
  // PHẦN 5: PHÂN HỆ THU NGÂN & THANH TOÁN (POS, VIETQR, CHỐT CA)
  // -------------------------------------------------------------
  console.log('\n--- PHẦN 5: THU NGÂN & THANH TOÁN (POS & CHỐT CA) ---');
  const cashierSuites = [
    { path: '/staff/thanh-toan', name: 'Màn hình POS Thu ngân thanh toán đơn', cookie: cashierCookie },
    { path: '/staff/thanh-toan/lich-su', name: 'Lịch sử giao dịch các phiên thanh toán', cookie: cashierCookie },
    { path: '/staff/thanh-toan/doi-soat', name: 'Đối soát chuyển khoản ngân hàng & VietQR', cookie: cashierCookie },
    { path: '/staff/chot-ca', name: 'Màn hình kiểm đếm & chốt két tiền mặt cuối ca', cookie: cashierCookie },
    { path: '/staff/chot-ca/lich-su', name: 'Lịch sử các biên bản chốt ca thu ngân', cookie: cashierCookie }
  ];

  for (const s of cashierSuites) {
    try {
      const res = await request({ path: s.path }, null, s.cookie);
      const passed = res.statusCode === 200 && res.data.length > 500;
      logTest('POS_CASHIER', s.name, passed, `Status: ${res.statusCode}`, res.duration);
    } catch (e) {
      logTest('POS_CASHIER', s.name, false, e.message, 0);
    }
  }

  // -------------------------------------------------------------
  // PHẦN 6: PHÂN HỆ KẾ TOÁN (LƯƠNG, CÔNG, THU CHI, BÁO CÁO)
  // -------------------------------------------------------------
  console.log('\n--- PHẦN 6: PHÂN HỆ KẾ TOÁN & LƯƠNG BỔNG ---');
  const accountantSuites = [
    { path: '/staff/accountant/salary', name: 'Bảng tính lương nhân viên toàn nhà hàng', cookie: accountantCookie },
    { path: '/staff/accountant/attendance', name: 'Đối soát chấm công toàn thể nhân viên', cookie: accountantCookie },
    { path: '/staff/accountant/attendance/summary', name: 'Tổng hợp ngày công & giờ công theo tháng', cookie: accountantCookie },
    { path: '/staff/accountant/expenses', name: 'Quản lý phiếu chi & chi phí vận hành', cookie: accountantCookie },
    { path: '/staff/accountant/leave', name: 'Tổng hợp xét duyệt nghỉ phép nhân sự', cookie: accountantCookie },
    { path: '/staff/accountant/reports', name: 'Báo cáo doanh thu & lợi nhuận kế toán', cookie: accountantCookie },
    { path: '/staff/accountant/staff', name: 'Danh sách hồ sơ nhân viên phòng kế toán', cookie: accountantCookie },
    { path: '/staff/accountant/schedule', name: 'Lịch làm việc phòng kế toán', cookie: accountantCookie }
  ];

  for (const s of accountantSuites) {
    try {
      const res = await request({ path: s.path }, null, s.cookie);
      const passed = res.statusCode === 200 && res.data.length > 500;
      logTest('ACCOUNTANT', s.name, passed, `Status: ${res.statusCode}`, res.duration);
    } catch (e) {
      logTest('ACCOUNTANT', s.name, false, e.message, 0);
    }
  }

  // -------------------------------------------------------------
  // PHẦN 7: PHÂN HỆ GIAO HÀNG & APP SHIPPER
  // -------------------------------------------------------------
  console.log('\n--- PHẦN 7: GIAO HÀNG & ỨNG DỤNG SHIPPER ---');
  const deliverySuites = [
    { path: '/staff/giao-hang', name: 'Bảng điều phối đơn giao hàng cho Shipper', cookie: dispatchCookie },
    { path: '/staff/giao-hang/ban-do', name: 'Bản đồ giám sát lộ trình Shipper GPS Realtime', cookie: dispatchCookie },
    { path: '/shipper/', name: 'Ứng dụng PWA dành cho nhân viên giao hàng (/shipper/)', cookie: shipperCookie },
    { path: '/api/shipper/don-cua-toi', name: 'API Lấy danh sách đơn hàng được phân công', cookie: shipperCookie, isApi: true },
    { path: '/api/giao-hang/ban-do', name: 'API Lấy tọa độ vị trí các shipper đang trực', cookie: dispatchCookie, isApi: true }
  ];

  for (const s of deliverySuites) {
    try {
      const res = await request({ path: s.path }, null, s.cookie);
      let passed = res.statusCode === 200;
      if (s.isApi) {
        try { JSON.parse(res.data); } catch (e) { passed = false; }
      } else {
        passed = passed && res.data.length > 500;
      }
      logTest('DELIVERY', s.name, passed, `Status: ${res.statusCode}`, res.duration);
    } catch (e) {
      logTest('DELIVERY', s.name, false, e.message, 0);
    }
  }

  // -------------------------------------------------------------
  // PHẦN 8: CƠ CẤU TỔ CHỨC, KHUÔN MẶT, XẾP CA & CHẤM CÔNG DI ĐỘNG
  // -------------------------------------------------------------
  console.log('\n--- PHẦN 8: CƠ CẤU TỔ CHỨC, KHUÔN MẶT, XẾP CA & CHẤM CÔNG ---');
  const hrSuites = [
    { path: '/to-chuc/quan-ly', name: 'Sơ đồ Cơ cấu tổ chức, Chức danh & Phân quyền', cookie: mgrCookie },
    { path: '/staff/to-chuc', name: 'Xem sơ đồ tổ chức cây phòng ban (Nhân viên)', cookie: waiterCookie },
    { path: '/cham-cong-khuon-mat', name: 'Màn hình Kiosk Nhận diện khuôn mặt 1:N', cookie: mgrCookie },
    { path: '/staff/khuon-mat/lan-dau', name: 'Màn hình nhân viên tự chụp mẫu khuôn mặt 1:1', cookie: waiterCookie },
    { path: '/staff/cham-cong', name: 'Quản lý bảng chấm công theo ngày (Manager)', cookie: mgrCookie },
    { path: '/cham-cong/', name: 'Ứng dụng Chấm công Di động PWA (GPS + Face)', cookie: waiterCookie },
    { path: '/staff/xep-ca', name: 'Lưới xếp ca tự động theo tuần', cookie: mgrCookie },
    { path: '/staff/xep-ca/dinh-muc', name: 'Khai báo định mức nhân sự mỗi ca', cookie: mgrCookie }
  ];

  for (const s of hrSuites) {
    try {
      const res = await request({ path: s.path }, null, s.cookie);
      const passed = res.statusCode === 200 && res.data.length > 500;
      logTest('HR_SYSTEM', s.name, passed, `Status: ${res.statusCode}`, res.duration);
    } catch (e) {
      logTest('HR_SYSTEM', s.name, false, e.message, 0);
    }
  }

  // -------------------------------------------------------------
  // PHẦN 9: KIỂM THỬ CHI TIẾT CÁC API DỮ LIỆU BACKEND DÀNH CHO NHÂN VIÊN
  // -------------------------------------------------------------
  console.log('\n--- PHẦN 9: KIỂM THỬ CÁC API DỮ LIỆU BACKEND NHÂN VIÊN ---');
  const apiSuites = [
    { path: '/api/to-chuc/so-do', name: 'API Sơ đồ cây tổ chức', cookie: mgrCookie },
    { path: '/api/to-chuc/tong-quan', name: 'API Thống kê tổng quan nhân sự', cookie: mgrCookie },
    { path: '/api/to-chuc/nhan-su', name: 'API Danh sách nhân viên & chức danh', cookie: mgrCookie },
    { path: '/api/to-chuc/hien-dien', name: 'API Trạng thái hiện diện theo ca', cookie: mgrCookie },
    { path: '/api/to-chuc/chuc-danh', name: 'API Danh mục chức danh & quyền hạn', cookie: mgrCookie },
    { path: '/api/to-chuc/to', name: 'API Danh sách các tổ làm việc', cookie: mgrCookie },
    { path: '/api/to-chuc/ho-so', name: 'API Hồ sơ phân quyền người đăng nhập', cookie: waiterCookie },
    { path: '/api/reservations/dashboard', name: 'API Dashboard KPI Đặt bàn', cookie: receptionCookie },
    { path: '/api/reservations/timeline?date=2026-10-07', name: 'API Timeline danh sách đặt bàn theo ngày', cookie: receptionCookie },
    { path: '/api/tables/availability?reservation_date=2026-10-08&start_time=19:00&guest_count=4', name: 'API Kiểm tra bàn trống khả dụng theo giờ & số khách', cookie: receptionCookie },
    { path: '/api/tables/floor-plan?ngay=2026-10-07', name: 'API Tọa độ & trạng thái 40 bàn trên sơ đồ', cookie: receptionCookie },
    { path: '/api/cham-cong/cua-toi', name: 'API Lịch sử chấm công của nhân viên', cookie: waiterCookie },
    { path: '/api/khuon-mat/trang-thai', name: 'API Kiểm tra trạng thái AI nhận diện khuôn mặt', cookie: mgrCookie },
    { path: '/so-do-ban/api/du-lieu', name: 'API Trạng thái thời gian thực bàn ăn', cookie: receptionCookie },
    { path: '/api/dat-ban/khu-vuc', name: 'API Danh sách các khu vực bàn ăn', cookie: receptionCookie },
    { path: '/api/dat-ban/khung-gio', name: 'API Khung giờ đặt bàn khả dụng', cookie: receptionCookie }
  ];

  for (const s of apiSuites) {
    try {
      const res = await request({ path: s.path }, null, s.cookie);
      let isJson = false;
      try {
        const parsed = JSON.parse(res.data);
        isJson = typeof parsed === 'object';
      } catch (e) {}
      const passed = (res.statusCode === 200 || res.statusCode === 304) && isJson;
      logTest('STAFF_API', s.name, passed, `Status: ${res.statusCode}, IsJSON: ${isJson}`, res.duration);
    } catch (e) {
      logTest('STAFF_API', s.name, false, e.message, 0);
    }
  }

  // -------------------------------------------------------------
  // TỔNG KẾT
  // -------------------------------------------------------------
  console.log('\n================================================================================');
  console.log('                          📊 BÁO CÁO TỔNG KẾT KIỂM THỬ');
  console.log('================================================================================');
  console.log(`  🔹 Tổng số test cases kiểm tra chi tiết : ${results.total}`);
  console.log(`  ✅ Thành công                            : ${results.passed} / ${results.total} (${Math.round((results.passed / results.total) * 100)}%)`);
  console.log(`  ❌ Thất bại                              : ${results.failed}`);
  console.log('================================================================================\n');

  return results;
}

runFullStaffAutomation().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
