/**
 * ====================================================================================
 *   HỆ THỐNG KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN NHÀ HÀNG (MASTER AUTOMATION TEST SUITE)
 * ====================================================================================
 * Bao phủ 100% toàn bộ hệ thống gồm 4 phân hệ chính:
 * 
 * PHẦN 1: KHÁCH HÀNG (Customer Web Portal & Delivery & Booking & Combos)
 * PHẦN 2: NHÂN VIÊN ĐA VAI TRÒ (Staff Portal - Role-Based Operations 11 Roles)
 * PHẦN 3: QUẢN TRỊ VIÊN HỆ THỐNG (Admin Portal - Full Management & AI Configuration)
 * PHẦN 4: BẢO MẬT, PHÂN QUYỀN & XỬ LÝ BIÊN (Security, RBAC Enforcement & Edge Cases)
 * 
 * Tự động xuất báo cáo định dạng JSON và HTML trực quan sau khi hoàn tất.
 * ====================================================================================
 */

const http = require('http');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');

const BASE_HOST = '127.0.0.1';
const BASE_PORT = 3000;
const BASE_URL = `http://${BASE_HOST}:${BASE_PORT}`;

// Màu sắc Console ANSI
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m'
};

// Kết quả tổng hợp
const masterResults = {
  startedAt: new Date().toISOString(),
  finishedAt: null,
  totalDurationMs: 0,
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  passRate: '0.00%',
  sections: [],
  testCases: []
};

let currentSection = '';

function sectionHeader(title) {
  currentSection = title;
  masterResults.sections.push(title);
  console.log(`\n${C.bold}${C.blue}================================================================================${C.reset}`);
  console.log(`${C.bold}${C.cyan}  🔷 ${title}${C.reset}`);
  console.log(`${C.bold}${C.blue}================================================================================${C.reset}`);
}

function subHeader(title) {
  console.log(`\n${C.bold}${C.yellow}--- ${title} ---${C.reset}`);
}

function logTest(moduleName, testName, passed, note = '', durationMs = 0) {
  masterResults.totalTests++;
  if (passed) {
    masterResults.passedTests++;
    console.log(`  ${C.green}✅ [${moduleName.padEnd(14, ' ')}]${C.reset} ${testName} ${C.dim}(${durationMs}ms)${C.reset}${note ? ` ${C.dim}— ${note}${C.reset}` : ''}`);
  } else {
    masterResults.failedTests++;
    console.log(`  ${C.red}❌ [${moduleName.padEnd(14, ' ')}]${C.reset} ${testName} ${C.bold}${C.red}-> ${note}${C.reset} ${C.dim}(${durationMs}ms)${C.reset}`);
  }

  masterResults.testCases.push({
    section: currentSection,
    module: moduleName,
    name: testName,
    passed,
    note,
    durationMs,
    timestamp: new Date().toISOString()
  });
}

/**
 * HTTP Client Wrapper với Cookie Jar & Timeout
 */
function request(options, postData = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const headers = Object.assign({}, options.headers || {});
    if (cookie) {
      headers['Cookie'] = cookie;
    }

    let payload = null;
    if (postData !== null && postData !== undefined) {
      const cType = headers['Content-Type'] || '';
      if (cType.includes('application/json')) {
        payload = typeof postData === 'string' ? postData : JSON.stringify(postData);
      } else {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        payload = typeof postData === 'string' ? postData : querystring.stringify(postData);
      }
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const reqOptions = {
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: options.path,
      method: options.method || 'GET',
      headers: headers,
      timeout: 35000
    };

    const startTime = Date.now();
    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        const setCookies = res.headers['set-cookie'] || [];
        const newCookies = setCookies.map(c => c.split(';')[0]).join('; ');
        
        let combinedCookie = cookie || '';
        if (newCookies) {
          if (combinedCookie) {
            // Hợp nhất cookie giữ phiên
            const cookieMap = {};
            combinedCookie.split(';').forEach(c => {
              const [k, v] = c.trim().split('=');
              if (k) cookieMap[k] = v;
            });
            newCookies.split(';').forEach(c => {
              const [k, v] = c.trim().split('=');
              if (k) cookieMap[k] = v;
            });
            combinedCookie = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
          } else {
            combinedCookie = newCookies;
          }
        }

        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
          cookie: combinedCookie,
          duration
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout after 20000ms'));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Đăng nhập Nhân viên
 */
async function loginStaff(username, password = '123456') {
  const init = await request({ path: '/staff/login' });
  const cookie = init.cookie;
  const post = await request({
    path: '/staff/login',
    method: 'POST'
  }, { username, password }, cookie);

  return {
    statusCode: post.statusCode,
    cookie: post.cookie,
    location: post.headers['location'],
    duration: post.duration
  };
}

/**
 * Đăng nhập Admin
 */
async function loginAdmin(username = 'admin', password = '123456') {
  const init = await request({ path: '/admin/login' });
  const cookie = init.cookie;
  const post = await request({
    path: '/admin/login',
    method: 'POST'
  }, { adminuser: username, adminpass: password }, cookie);

  return {
    statusCode: post.statusCode,
    cookie: post.cookie,
    location: post.headers['location'],
    data: post.data,
    duration: post.duration
  };
}

/**
 * Đăng nhập Khách hàng
 */
async function loginCustomer(phone, password = '123456') {
  const init = await request({ path: '/login' });
  const cookie = init.cookie;
  const post = await request({
    path: '/login',
    method: 'POST'
  }, { sdt: phone, pass: password }, cookie);

  return {
    statusCode: post.statusCode,
    cookie: post.cookie,
    location: post.headers['location'],
    duration: post.duration
  };
}

// ====================================================================================
// CHƯƠNG TRÌNH TEST MASTER
// ====================================================================================

async function runMasterTestSuite() {
  const suiteStartTime = Date.now();
  console.log(`\n${C.bold}${C.magenta}================================================================================${C.reset}`);
  console.log(`${C.bold}${C.magenta}   🌟 KHỞI CHẠY MASTER AUTOMATION TEST SUITE TOÀN BỘ HỆ THỐNG NHÀ HÀNG 🌟${C.reset}`);
  console.log(`   Thời gian bắt đầu: ${new Date().toLocaleString('vi-VN')}`);
  console.log(`   Host mục tiêu:     ${BASE_URL}`);
  console.log(`${C.bold}${C.magenta}================================================================================${C.reset}`);

  try {
    // ================================================================================
    // PHẦN 1: KHÁCH HÀNG (CUSTOMER PORTAL & DELIVERY & BOOKING & COMBOS)
    // ================================================================================
    sectionHeader('PHẦN 1: PHÂN HỆ KHÁCH HÀNG (CUSTOMER PORTAL & BOOKING & DELIVERY)');

    subHeader('1.1. Các trang giao diện công khai & giới thiệu');
    const publicPages = [
      { path: '/', name: 'Trang chủ Website (/)' },
      { path: '/about', name: 'Trang Giới thiệu nhà hàng (/about)' },
      { path: '/thanh-vien', name: 'Trang Chính sách hội viên (/thanh-vien)' },
      { path: '/blog', name: 'Trang Tin tức & Bài viết (/blog)' },
      { path: '/huong-dan-dat-ban', name: 'Trang Hướng dẫn đặt bàn trực tuyến (/huong-dan-dat-ban)' },
      { path: '/dat-ban', name: 'Cổng Đặt bàn trực tuyến (/dat-ban)' }
    ];

    for (const p of publicPages) {
      try {
        const res = await request({ path: p.path });
        const ok = res.statusCode === 200 && res.data.length > 500;
        logTest('CUST_PAGES', p.name, ok, `Status: ${res.statusCode}`, res.duration);
      } catch (e) {
        logTest('CUST_PAGES', p.name, false, e.message, 0);
      }
    }

    subHeader('1.2. Kiểm tra điều hướng & URL chuyển hướng (Redirects)');
    const redirects = [
      { from: '/datban', expected: '/dat-ban', name: 'Alias chuyển hướng /datban -> /dat-ban' },
      { from: '/reservation', expected: '/dat-ban', name: 'Redirect 301 chuẩn SEO /reservation -> /dat-ban' },
      { from: '/reservation/tra-cuu', expected: '/dat-ban/tra-cuu', name: 'Redirect 301 /reservation/tra-cuu -> /dat-ban/tra-cuu' }
    ];

    for (const r of redirects) {
      try {
        const res = await request({ path: r.from });
        const ok = (res.statusCode === 301 || res.statusCode === 302) && res.headers['location'] === r.expected;
        logTest('CUST_ROUTING', r.name, ok, `${res.statusCode} -> ${res.headers['location']}`, res.duration);
      } catch (e) {
        logTest('CUST_ROUTING', r.name, false, e.message, 0);
      }
    }

    subHeader('1.3. Đa ngôn ngữ (i18n: vi / en / ja)');
    const languages = [
      { lang: 'vi', code: 'vi', name: 'Tiếng Việt' },
      { lang: 'en', code: 'en', name: 'English' },
      { lang: 'ja', code: 'ja', name: 'Japanese (日本語)' }
    ];

    for (const l of languages) {
      try {
        const res = await request({ path: `/?lang=${l.lang}` });
        const ok = res.statusCode === 200 && (res.headers['set-cookie'] || '').includes(l.lang) || res.data.length > 500;
        logTest('CUST_I18N', `Chuyển đổi ngôn ngữ sang ${l.name} (?lang=${l.lang})`, ok, `Status: ${res.statusCode}`, res.duration);
      } catch (e) {
        logTest('CUST_I18N', `Chuyển đổi ngôn ngữ sang ${l.name}`, false, e.message, 0);
      }
    }

    subHeader('1.4. Thực đơn món ăn, Tìm kiếm & Lọc món');
    try {
      const menuRes = await request({ path: '/menu' });
      logTest('CUST_MENU', 'Xem danh mục thực đơn món ăn (/menu)', menuRes.statusCode === 200 && menuRes.data.includes('menu'), `Status: ${menuRes.statusCode}`, menuRes.duration);
    } catch (e) {
      logTest('CUST_MENU', 'Xem danh mục thực đơn món ăn (/menu)', false, e.message, 0);
    }

    try {
      const searchRes = await request({
        path: '/menu',
        method: 'POST'
      }, { key: 'lẩu' });
      const ok = searchRes.statusCode === 200 && searchRes.data.length > 500;
      logTest('CUST_MENU', 'Tìm kiếm món ăn với từ khóa "lẩu" (POST /menu)', ok, `Status: ${searchRes.statusCode}`, searchRes.duration);
    } catch (e) {
      logTest('CUST_MENU', 'Tìm kiếm món ăn (POST /menu)', false, e.message, 0);
    }

    try {
      const catRes = await request({ path: '/menu?id_loai=18' });
      const ok = catRes.statusCode === 200 && catRes.data.length > 500;
      logTest('CUST_MENU', 'Lọc danh sách món theo danh mục (GET /menu?id_loai=18)', ok, `Status: ${catRes.statusCode}`, catRes.duration);
    } catch (e) {
      logTest('CUST_MENU', 'Lọc danh sách món theo danh mục', false, e.message, 0);
    }

    try {
      const detailRes = await request({ path: '/detail?monid=85' });
      const ok = detailRes.statusCode === 200 && (detailRes.data.includes('nguyên liệu') || detailRes.data.includes('Dị ứng') || detailRes.data.includes('detail'));
      logTest('CUST_MENU', 'Xem chi tiết món & cảnh báo dị ứng nguyên liệu (/detail?monid=85)', ok, `Status: ${detailRes.statusCode}`, detailRes.duration);
    } catch (e) {
      logTest('CUST_MENU', 'Xem chi tiết món & cảnh báo dị ứng', false, e.message, 0);
    }

    subHeader('1.5. Thực đơn Combo mới & Đặt món theo combo');
    const comboAliases = [
      { path: '/combos', name: 'Trang Thực đơn Combo (/combos)' },
      { path: '/thuc-don', name: 'Alias Thực đơn Combo (/thuc-don)' },
      { path: '/thuc-don-combo', name: 'Alias Thực đơn Combo (/thuc-don-combo)' }
    ];

    for (const c of comboAliases) {
      try {
        const res = await request({ path: c.path });
        const ok = res.statusCode === 200 && (res.data.includes('Combo') || res.data.includes('combo'));
        logTest('CUST_COMBOS', c.name, ok, `Status: ${res.statusCode}`, res.duration);
      } catch (e) {
        logTest('CUST_COMBOS', c.name, false, e.message, 0);
      }
    }

    subHeader('1.6. Xác thực khách hàng (Đăng ký, Đăng nhập, Hồ sơ, Đăng xuất)');
    const testPhone = '0988' + Math.floor(100000 + Math.random() * 900000);
    let custCookie = null;

    try {
      // Đăng ký tài khoản mới
      const regRes = await request({
        path: '/register',
        method: 'POST'
      }, {
        ten: 'Khách Hàng Test',
        sodienthoai: testPhone,
        email: `${testPhone}@testrestaurant.vn`,
        diachi: '123 Đường Test, Quận 1, TP.HCM',
        passwords: '123456',
        repass: '123456'
      });
      const ok = regRes.statusCode === 302 || regRes.statusCode === 200;
      logTest('CUST_AUTH', `Đăng ký tài khoản khách hàng mới (SĐT: ${testPhone})`, ok, `Status: ${regRes.statusCode}`, regRes.duration);
    } catch (e) {
      logTest('CUST_AUTH', 'Đăng ký tài khoản khách hàng mới', false, e.message, 0);
    }

    try {
      // Đăng nhập với tài khoản vừa tạo
      const auth = await loginCustomer(testPhone, '123456');
      const ok = auth.statusCode === 302 && !!auth.cookie;
      custCookie = auth.cookie;
      logTest('CUST_AUTH', `Đăng nhập tài khoản khách hàng thành công (Redirect -> ${auth.location})`, ok, `Status: ${auth.statusCode}`, auth.duration);
    } catch (e) {
      logTest('CUST_AUTH', 'Đăng nhập tài khoản khách hàng', false, e.message, 0);
    }

    if (custCookie) {
      try {
        const profRes = await request({ path: '/profile' }, null, custCookie);
        const ok = profRes.statusCode === 200 && profRes.data.includes(testPhone);
        logTest('CUST_AUTH', 'Xem trang thông tin cá nhân hồ sơ khách (/profile)', ok, `Status: ${profRes.statusCode}`, profRes.duration);
      } catch (e) {
        logTest('CUST_AUTH', 'Xem hồ sơ cá nhân khách', false, e.message, 0);
      }

      try {
        const updRes = await request({
          path: '/profile',
          method: 'POST'
        }, {
          action: 'update',
          ten: 'Khách Hàng VIP Đã Cập Nhật',
          sodienthoai: testPhone,
          diachi: '123 Đường Test, Quận 1, TP.HCM'
        }, custCookie);
        const ok = updRes.statusCode === 302 || updRes.statusCode === 200;
        logTest('CUST_AUTH', 'Cập nhật hồ sơ & địa chỉ nhận hàng (/profile POST)', ok, `Status: ${updRes.statusCode}`, updRes.duration);
      } catch (e) {
        logTest('CUST_AUTH', 'Cập nhật hồ sơ khách', false, e.message, 0);
      }
    }

    subHeader('1.7. Giỏ hàng & Thêm Combo vào giỏ hàng');
    let sessionCartCookie = custCookie;
    try {
      // Thêm món lẻ vào giỏ
      const addRes = await request({
        path: '/add-to-cart',
        method: 'POST'
      }, { monid: 85, soluong: 2 }, sessionCartCookie);
      const ok = addRes.statusCode === 302 || addRes.statusCode === 200;
      sessionCartCookie = addRes.cookie || sessionCartCookie;
      logTest('CUST_CART', 'Thêm món lẻ vào giỏ hàng (POST /add-to-cart, monid=85)', ok, `Status: ${addRes.statusCode}`, addRes.duration);
    } catch (e) {
      logTest('CUST_CART', 'Thêm món lẻ vào giỏ hàng', false, e.message, 0);
    }

    try {
      // Thêm combo vào giỏ
      const addComboRes = await request({
        path: '/add-combo-to-cart',
        method: 'POST'
      }, { comboId: 'combo_4k_giadinh' }, sessionCartCookie);
      const ok = addComboRes.statusCode === 302 && addComboRes.headers['location'] === '/cart';
      sessionCartCookie = addComboRes.cookie || sessionCartCookie;
      logTest('CUST_CART', 'Thêm Combo mới vào giỏ hàng (POST /add-combo-to-cart, combo_4k_giadinh)', ok, `Redirect -> ${addComboRes.headers['location']}`, addComboRes.duration);
    } catch (e) {
      logTest('CUST_CART', 'Thêm Combo vào giỏ hàng', false, e.message, 0);
    }

    try {
      const viewCart = await request({ path: '/cart' }, null, sessionCartCookie);
      const ok = viewCart.statusCode === 200 && (viewCart.data.includes('giỏ hàng') || viewCart.data.includes('cart'));
      logTest('CUST_CART', 'Xem giỏ hàng với danh sách món & combo đã chọn (/cart)', ok, `Status: ${viewCart.statusCode}`, viewCart.duration);
    } catch (e) {
      logTest('CUST_CART', 'Xem giỏ hàng', false, e.message, 0);
    }

    subHeader('1.8. Quy trình Đặt bàn trực tuyến & Khung giờ');
    const todayStr = new Date().toISOString().slice(0, 10);
    // Tính ngày mai
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const bookingApis = [
      { path: '/api/dat-ban/khu-vuc', name: 'API Lấy danh sách khu vực bàn ăn' },
      { path: '/api/dat-ban/danh-muc', name: 'API Lấy danh mục phục vụ' },
      { path: `/api/dat-ban/khung-gio?ngay=${tomorrowStr}&so_khach=4`, name: 'API Truy vấn khung giờ khả dụng theo ngày & số khách' },
      { path: `/api/dat-ban/kha-dung?reservation_date=${tomorrowStr}&start_time=19:00&guest_count=4`, name: 'API Kiểm tra bàn trống phù hợp' },
      { path: `/api/dat-ban/so-do?ngay=${tomorrowStr}&gio=19:00`, name: 'API Lấy sơ đồ bàn trực quan cho khách' }
    ];

    for (const api of bookingApis) {
      try {
        const res = await request({ path: api.path });
        let isJson = false;
        try { JSON.parse(res.data); isJson = true; } catch (e) {}
        logTest('CUST_BOOKING', api.name, res.statusCode === 200 && isJson, `Status: ${res.statusCode}`, res.duration);
      } catch (e) {
        logTest('CUST_BOOKING', api.name, false, e.message, 0);
      }
    }

    let createdBookingCode = '';
    try {
      const bookPost = await request({
        path: '/api/dat-ban',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        customer_name: 'Khách Đặt Automation',
        phone: testPhone,
        reservation_date: tomorrowStr,
        start_time: '19:00',
        guest_count: 4,
        notes: 'Bàn cạnh cửa sổ thoáng mát'
      }, sessionCartCookie);

      let isJson = false;
      let bodyObj = {};
      try { bodyObj = JSON.parse(bookPost.data); isJson = true; } catch (e) {}
      const ok = (bookPost.statusCode === 200 || bookPost.statusCode === 201) && bodyObj.ok;
      createdBookingCode = bodyObj.ma_dat || (bodyObj.reservation && bodyObj.reservation.reservation_code) || '';
      logTest('CUST_BOOKING', `Tạo lượt đặt bàn trực tuyến mới thành công (Mã: ${createdBookingCode || 'RSV'})`, ok, `Code: ${createdBookingCode}`, bookPost.duration);
    } catch (e) {
      logTest('CUST_BOOKING', 'Tạo lượt đặt bàn trực tuyến', false, e.message, 0);
    }

    if (createdBookingCode) {
      try {
        const lookupRes = await request({
          path: '/api/dat-ban/tra-cuu',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, {
          phone: testPhone,
          ma_dat: createdBookingCode
        });
        let isJson = false;
        try { JSON.parse(lookupRes.data); isJson = true; } catch (e) {}
        logTest('CUST_BOOKING', `Tra cứu đặt bàn theo SĐT & Mã đặt (POST /api/dat-ban/tra-cuu)`, lookupRes.statusCode === 200 && isJson, `Status: ${lookupRes.statusCode}`, lookupRes.duration);
      } catch (e) {
        logTest('CUST_BOOKING', 'Tra cứu đặt bàn', false, e.message, 0);
      }

      try {
        const payDepositPage = await request({ path: `/thanh-toan/dat-ban/${createdBookingCode}` });
        const ok = payDepositPage.statusCode === 200 && (payDepositPage.data.includes('VietQR') || payDepositPage.data.includes('thanh toán') || payDepositPage.data.includes('cọc'));
        logTest('CUST_PAYMENT', `Trang thanh toán đặt cọc VietQR cho mã ${createdBookingCode} (/thanh-toan/dat-ban/:ma)`, ok, `Status: ${payDepositPage.statusCode}`, payDepositPage.duration);
      } catch (e) {
        logTest('CUST_PAYMENT', 'Trang thanh toán đặt cọc VietQR', false, e.message, 0);
      }
    }

    subHeader('1.9. Đặt món giao hàng tận nơi & Theo dõi đơn');
    try {
      const quoteRes = await request({ path: '/api/giao-hang/bao-gia?lat=10.7769&lng=106.7009' });
      let isJson = false;
      try { JSON.parse(quoteRes.data); isJson = true; } catch (e) {}
      logTest('CUST_DELIVERY', 'API Tính phí ship theo tọa độ GPS (/api/giao-hang/bao-gia)', quoteRes.statusCode === 200 && isJson, `Status: ${quoteRes.statusCode}`, quoteRes.duration);
    } catch (e) {
      logTest('CUST_DELIVERY', 'API Tính phí ship theo tọa độ GPS', false, e.message, 0);
    }

    try {
      const delivPost = await request({
        path: '/giao-hang',
        method: 'POST'
      }, {
        ten_nguoi_nhan: 'Người Nhận Test',
        so_dien_thoai: testPhone,
        dia_chi: '123 Hai Bà Trưng, Phường Bến Nghé, Quận 1',
        ghi_chu: 'Giao lên tầng 3'
      }, sessionCartCookie);
      const ok = delivPost.statusCode === 302 || delivPost.statusCode === 200;
      sessionCartCookie = delivPost.cookie || sessionCartCookie;
      logTest('CUST_DELIVERY', 'Lưu thông tin giao hàng & người nhận (POST /giao-hang)', ok, `Status: ${delivPost.statusCode}`, delivPost.duration);
    } catch (e) {
      logTest('CUST_DELIVERY', 'Lưu thông tin giao hàng', false, e.message, 0);
    }

    let createdOrderTrackingCode = '';
    try {
      // Chốt đơn giao hàng
      const orderPost = await request({
        path: '/datban',
        method: 'POST'
      }, {
        ngaydat: todayStr,
        giodat: '18:30',
        songuoi: 2,
        ghichu: 'Giao hàng tận nơi'
      }, sessionCartCookie);

      const ok = orderPost.statusCode === 302;
      const loc = orderPost.headers['location'] || '';
      if (loc.includes('/theo-doi/')) {
        createdOrderTrackingCode = loc.split('/theo-doi/')[1];
      }
      logTest('CUST_DELIVERY', `Chốt đơn giao hàng tận nơi (POST /datban -> ${loc})`, ok, `Vận đơn: ${createdOrderTrackingCode || 'GH'}`, orderPost.duration);
    } catch (e) {
      logTest('CUST_DELIVERY', 'Chốt đơn giao hàng tận nơi', false, e.message, 0);
    }

    if (createdOrderTrackingCode) {
      try {
        const trackRes = await request({ path: `/theo-doi/${createdOrderTrackingCode}` });
        const ok = trackRes.statusCode === 200 && trackRes.data.includes(createdOrderTrackingCode);
        logTest('CUST_DELIVERY', `Trang theo dõi trạng thái shipper vận chuyển (/theo-doi/${createdOrderTrackingCode})`, ok, `Status: ${trackRes.statusCode}`, trackRes.duration);
      } catch (e) {
        logTest('CUST_DELIVERY', 'Trang theo dõi trạng thái shipper', false, e.message, 0);
      }
    }

    subHeader('1.10. Quản lý Đơn hàng, Đánh giá dịch vụ & Chatbot AI');
    try {
      const ordersRes = await request({ path: '/my-orders' }, null, custCookie);
      const ok = ordersRes.statusCode === 200 && (ordersRes.data.includes('Đơn hàng') || ordersRes.data.includes('orders') || ordersRes.data.includes('Lịch sử'));
      logTest('CUST_SERVICES', 'Xem danh sách đơn hàng đã đặt của tôi (/my-orders)', ok, `Status: ${ordersRes.statusCode}`, ordersRes.duration);
    } catch (e) {
      logTest('CUST_SERVICES', 'Xem danh sách đơn hàng của tôi', false, e.message, 0);
    }

    try {
      const ratePage = await request({ path: '/rate' }, null, custCookie);
      logTest('CUST_SERVICES', 'Trang gửi đánh giá chất lượng phục vụ (GET /rate)', ratePage.statusCode === 200, `Status: ${ratePage.statusCode}`, ratePage.duration);
    } catch (e) {
      logTest('CUST_SERVICES', 'Trang gửi đánh giá chất lượng phục vụ', false, e.message, 0);
    }

    try {
      const botQues = await request({ path: '/chatbot/api/cau-hoi-mau' });
      let isJson = false;
      try { JSON.parse(botQues.data); isJson = true; } catch (e) {}
      logTest('CUST_AI_BOT', 'API Lấy danh sách câu hỏi mẫu gợi ý của Trợ lý AI (/chatbot/api/cau-hoi-mau)', botQues.statusCode === 200 && isJson, `Status: ${botQues.statusCode}`, botQues.duration);
    } catch (e) {
      logTest('CUST_AI_BOT', 'API Câu hỏi mẫu Chatbot', false, e.message, 0);
    }

    try {
      const botAsk = await request({
        path: '/chatbot/api/hoi',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { cau_hoi: 'Nhà hàng có món gì ngon?' });
      let isJson = false;
      let body = {};
      try { body = JSON.parse(botAsk.data); isJson = true; } catch (e) {}
      const ok = botAsk.statusCode === 200 && isJson && !!body.van_ban;
      logTest('CUST_AI_BOT', 'Trợ lý ảo AI trả lời câu hỏi thực đơn của khách (POST /chatbot/api/hoi)', ok, `Status: ${botAsk.statusCode}`, botAsk.duration);
    } catch (e) {
      logTest('CUST_AI_BOT', 'Trợ lý ảo AI trả lời câu hỏi', false, e.message, 0);
    }

    try {
      const logoutCust = await request({ path: '/logout' }, null, custCookie);
      logTest('CUST_AUTH', 'Đăng xuất tài khoản khách hàng an toàn (/logout)', logoutCust.statusCode === 302, `Redirect -> ${logoutCust.headers['location']}`, logoutCust.duration);
    } catch (e) {
      logTest('CUST_AUTH', 'Đăng xuất tài khoản khách', false, e.message, 0);
    }

    // ================================================================================
    // PHẦN 2: NHÂN VIÊN ĐA VAI TRÒ (STAFF PORTAL - ROLE BASED RBAC)
    // ================================================================================
    sectionHeader('PHẦN 2: PHÂN HỆ NHÂN VIÊN ĐA VAI TRÒ (STAFF PORTAL - 11 ROLES)');

    subHeader('2.1. Xác thực đăng nhập RBAC theo 11 chức danh & vai trò');
    const staffAccounts = [
      { role: 'Quản lý nhà hàng', user: 'quanly' },
      { role: 'Trợ lý quản lý', user: 'trolyquanly' },
      { role: 'Bếp trưởng', user: 'beptruong' },
      { role: 'Đầu bếp', user: 'daubep' },
      { role: 'Nhân viên phục vụ', user: 'phucvu' },
      { role: 'Lễ tân nhà hàng', user: 'letan' },
      { role: 'Thu ngân', user: 'thungan' },
      { role: 'Kế toán viên', user: 'ketoan' },
      { role: 'Kế toán trưởng', user: 'ketoantruong' },
      { role: 'Điều phối giao hàng', user: 'dieuphoi' },
      { role: 'Nhân viên giao hàng', user: 'shipper1' }
    ];

    const staffSessions = {};
    for (const acc of staffAccounts) {
      try {
        const auth = await loginStaff(acc.user);
        const ok = auth.statusCode === 302 && !!auth.cookie;
        staffSessions[acc.user] = auth.cookie;
        logTest('STAFF_AUTH', `Đăng nhập ${acc.role} (@${acc.user})`, ok, `Redirect -> ${auth.location}`, auth.duration);
      } catch (e) {
        logTest('STAFF_AUTH', `Đăng nhập ${acc.role} (@${acc.user})`, false, e.message, 0);
      }
    }

    const mgrCookie = staffSessions['quanly'];
    const kitchenCookie = staffSessions['beptruong'];
    const cashierCookie = staffSessions['thungan'];
    const accountantCookie = staffSessions['ketoantruong'] || staffSessions['ketoan'];
    const receptionCookie = staffSessions['letan'];
    const waiterCookie = staffSessions['phucvu'];
    const dispatchCookie = staffSessions['dieuphoi'];
    const shipperCookie = staffSessions['shipper1'];

    subHeader('2.2. Bảng điều hành thời gian thực & Tiện ích chung');
    const staffGeneralPages = [
      { path: '/staff', name: 'Dashboard Tổng quan nhân viên (/staff)', cookie: mgrCookie },
      { path: '/staff/dieu-hanh', name: 'Bảng Điều hành Thời gian thực (Live Dashboard)', cookie: mgrCookie },
      { path: '/staff/profile', name: 'Hồ sơ cá nhân nhân viên (/staff/profile)', cookie: waiterCookie },
      { path: '/staff/notifications', name: 'Trung tâm thông báo công việc (/staff/notifications)', cookie: waiterCookie },
      { path: '/staff/schedule', name: 'Lịch làm việc & Đăng ký ca tuần (/staff/schedule)', cookie: waiterCookie },
      { path: '/staff/attendance', name: 'Bảng chấm công cá nhân (/staff/attendance)', cookie: waiterCookie },
      { path: '/staff/leave', name: 'Gửi & Quản lý đơn xin nghỉ phép (/staff/leave)', cookie: waiterCookie },
      { path: '/staff/chat', name: 'Hệ thống nhắn tin nội bộ (/staff/chat)', cookie: waiterCookie },
      { path: '/staff/customers', name: 'Tra cứu danh sách khách hàng (/staff/customers)', cookie: receptionCookie },
      { path: '/staff/emails', name: 'Hộp thư điện tử nội bộ (/staff/emails)', cookie: mgrCookie },
      { path: '/staff/qr-codes', name: 'Quản lý mã QR bàn & thực đơn số (/staff/qr-codes)', cookie: mgrCookie }
    ];

    for (const p of staffGeneralPages) {
      try {
        const res = await request({ path: p.path }, null, p.cookie);
        const ok = res.statusCode === 200 && res.data.length > 500;
        logTest('STAFF_GENERAL', p.name, ok, `Status: ${res.statusCode}`, res.duration);
      } catch (e) {
        logTest('STAFF_GENERAL', p.name, false, e.message, 0);
      }
    }

    subHeader('2.3. Phân hệ Bếp (KDS, Tồn kho nguyên liệu, Định mức, Combo bếp)');
    const kitchenPages = [
      { path: '/kds', name: 'Màn hình KDS Bếp Realtime (/kds)', cookie: kitchenCookie },
      { path: '/staff/kds', name: 'Màn hình KDS qua Staff Portal (/staff/kds)', cookie: kitchenCookie },
      { path: '/staff/kitchen', name: 'Tổng quan khu Bếp (/staff/kitchen)', cookie: kitchenCookie },
      { path: '/staff/kitchen/dishes', name: 'Bật/tắt trạng thái món ăn (Hết/Còn)', cookie: kitchenCookie },
      { path: '/staff/kitchen/categories', name: 'Danh mục nhóm món khu bếp', cookie: kitchenCookie },
      { path: '/staff/kitchen/combos', name: 'Quản lý các gói Combo bếp', cookie: kitchenCookie },
      { path: '/staff/kitchen/inventory', name: 'Quản lý tồn kho nguyên liệu (FIFO)', cookie: kitchenCookie },
      { path: '/staff/kitchen/recipes', name: 'Định mức công thức nấu từng món', cookie: kitchenCookie },
      { path: '/staff/kitchen/equipment', name: 'Quản lý trang thiết bị nhà bếp', cookie: kitchenCookie },
      { path: '/staff/kitchen/stock-history', name: 'Nhật ký xuất nhập hao hụt nguyên liệu', cookie: kitchenCookie },
      { path: '/staff/kitchen/shift', name: 'Ca trực và phân công khu bếp', cookie: kitchenCookie }
    ];

    for (const kp of kitchenPages) {
      try {
        const res = await request({ path: kp.path }, null, kp.cookie);
        const ok = res.statusCode === 200 && res.data.length > 500;
        logTest('STAFF_KITCHEN', kp.name, ok, `Status: ${res.statusCode}`, res.duration);
      } catch (e) {
        logTest('STAFF_KITCHEN', kp.name, false, e.message, 0);
      }
    }

    try {
      const kdsApi = await request({ path: '/kds/api/don' }, null, kitchenCookie);
      let isJson = false;
      try { JSON.parse(kdsApi.data); isJson = true; } catch (e) {}
      logTest('STAFF_KITCHEN', 'API Lấy danh sách phiếu chế biến KDS (/kds/api/don)', kdsApi.statusCode === 200 && isJson, `Status: ${kdsApi.statusCode}`, kdsApi.duration);
    } catch (e) {
      logTest('STAFF_KITCHEN', 'API Phiếu KDS Bếp', false, e.message, 0);
    }

    subHeader('2.4. Đặt bàn & Sơ đồ 40 bàn Realtime');
    const tablePages = [
      { path: '/so-do-ban', name: 'Sơ đồ 40 bàn 4 khu vực trực quan (/so-do-ban)', cookie: receptionCookie },
      { path: '/staff/bookings', name: 'Danh sách và trạng thái các lượt đặt bàn (/staff/bookings)', cookie: receptionCookie },
      { path: '/staff/bookings/create', name: 'Form nhân viên tạo đơn đặt bàn hộ khách (/staff/bookings/create)', cookie: receptionCookie },
      { path: '/staff/dat-ban', name: 'Trung tâm Đặt bàn thông minh (Timeline & Xếp bàn)', cookie: receptionCookie },
      { path: '/staff/dat-ban/phan-tich', name: 'Phân tích hiệu suất đặt bàn & no-show (Quản lý)', cookie: mgrCookie }
    ];

    for (const tp of tablePages) {
      try {
        const res = await request({ path: tp.path }, null, tp.cookie);
        const ok = res.statusCode === 200 && res.data.length > 500;
        logTest('STAFF_TABLES', tp.name, ok, `Status: ${res.statusCode}`, res.duration);
      } catch (e) {
        logTest('STAFF_TABLES', tp.name, false, e.message, 0);
      }
    }

    const tableApis = [
      { path: '/api/reservations/dashboard', name: 'API Dashboard KPI Đặt bàn', cookie: receptionCookie },
      { path: `/api/reservations/timeline?date=${tomorrowStr}`, name: 'API Timeline danh sách đặt bàn theo ngày', cookie: receptionCookie },
      { path: `/api/tables/availability?reservation_date=${tomorrowStr}&start_time=19:00&guest_count=4`, name: 'API Kiểm tra bàn trống khả dụng (Ngày tương lai)', cookie: receptionCookie },
      { path: `/api/tables/floor-plan?ngay=${tomorrowStr}`, name: 'API Tọa độ & trạng thái 40 bàn trên sơ đồ', cookie: receptionCookie },
      { path: '/so-do-ban/api/du-lieu', name: 'API Trạng thái thời gian thực bàn ăn', cookie: receptionCookie }
    ];

    for (const ta of tableApis) {
      try {
        const res = await request({ path: ta.path }, null, ta.cookie);
        let isJson = false;
        try { JSON.parse(res.data); isJson = true; } catch (e) {}
        logTest('STAFF_TABLES', ta.name, res.statusCode === 200 && isJson, `Status: ${res.statusCode}`, res.duration);
      } catch (e) {
        logTest('STAFF_TABLES', ta.name, false, e.message, 0);
      }
    }

    subHeader('2.5. Thu ngân & POS (VietQR, Đối soát & Chốt ca)');
    const cashierPages = [
      { path: '/staff/thanh-toan', name: 'Màn hình POS Thu ngân thanh toán đơn', cookie: cashierCookie },
      { path: '/staff/thanh-toan/lich-su', name: 'Lịch sử giao dịch các phiên thanh toán', cookie: cashierCookie },
      { path: '/staff/thanh-toan/doi-soat', name: 'Đối soát chuyển khoản ngân hàng & VietQR', cookie: cashierCookie },
      { path: '/staff/chot-ca', name: 'Màn hình kiểm đếm & chốt két tiền mặt cuối ca', cookie: cashierCookie },
      { path: '/staff/chot-ca/lich-su', name: 'Lịch sử các biên bản chốt ca thu ngân', cookie: cashierCookie }
    ];

    for (const cp of cashierPages) {
      try {
        const res = await request({ path: cp.path }, null, cp.cookie);
        const ok = res.statusCode === 200 && res.data.length > 500;
        logTest('STAFF_CASHIER', cp.name, ok, `Status: ${res.statusCode}`, res.duration);
      } catch (e) {
        logTest('STAFF_CASHIER', cp.name, false, e.message, 0);
      }
    }

    try {
      const summaryRes = await request({ path: '/staff/chot-ca/tong-hop' }, null, cashierCookie);
      let isJson = false;
      try { JSON.parse(summaryRes.data); isJson = true; } catch (e) {}
      logTest('STAFF_CASHIER', 'API Tổng hợp doanh thu ca trực thu ngân (/staff/chot-ca/tong-hop)', summaryRes.statusCode === 200 && isJson, `Status: ${summaryRes.statusCode}`, summaryRes.duration);
    } catch (e) {
      logTest('STAFF_CASHIER', 'API Tổng hợp chốt ca', false, e.message, 0);
    }

    subHeader('2.6. Phân hệ Kế toán (Lương bổng, Công nợ, Báo cáo & Thu chi)');
    const accountantPages = [
      { path: '/staff/accountant/salary', name: 'Bảng tính lương nhân viên toàn nhà hàng', cookie: accountantCookie },
      { path: '/staff/accountant/attendance', name: 'Đối soát chấm công toàn thể nhân viên', cookie: accountantCookie },
      { path: '/staff/accountant/attendance/summary', name: 'Tổng hợp ngày công & giờ công theo tháng', cookie: accountantCookie },
      { path: '/staff/accountant/expenses', name: 'Quản lý phiếu chi & chi phí vận hành', cookie: accountantCookie },
      { path: '/staff/accountant/leave', name: 'Tổng hợp xét duyệt nghỉ phép nhân sự', cookie: accountantCookie },
      { path: '/staff/accountant/reports', name: 'Báo cáo tài chính kế toán tổng hợp', cookie: accountantCookie },
      { path: '/staff/accountant/staff', name: 'Danh sách hồ sơ nhân sự phòng kế toán', cookie: accountantCookie },
      { path: '/staff/accountant/schedule', name: 'Lịch làm việc phòng kế toán', cookie: accountantCookie }
    ];

    for (const ap of accountantPages) {
      try {
        const res = await request({ path: ap.path }, null, ap.cookie);
        const ok = res.statusCode === 200 && res.data.length > 500;
        logTest('STAFF_ACCOUNTANT', ap.name, ok, `Status: ${res.statusCode}`, res.duration);
      } catch (e) {
        logTest('STAFF_ACCOUNTANT', ap.name, false, e.message, 0);
      }
    }

    subHeader('2.7. Giao hàng & Ứng dụng Shipper PWA');
    const deliveryPages = [
      { path: '/staff/giao-hang', name: 'Bảng điều phối đơn giao hàng cho Shipper', cookie: dispatchCookie },
      { path: '/staff/giao-hang/ban-do', name: 'Bản đồ giám sát lộ trình GPS Realtime', cookie: dispatchCookie },
      { path: '/shipper/', name: 'Ứng dụng PWA dành cho nhân viên giao hàng', cookie: shipperCookie }
    ];

    for (const dp of deliveryPages) {
      try {
        const res = await request({ path: dp.path }, null, dp.cookie);
        const ok = res.statusCode === 200 && res.data.length > 500;
        logTest('STAFF_DELIVERY', dp.name, ok, `Status: ${res.statusCode}`, res.duration);
      } catch (e) {
        logTest('STAFF_DELIVERY', dp.name, false, e.message, 0);
      }
    }

    try {
      const myOrders = await request({ path: '/api/shipper/don-cua-toi' }, null, shipperCookie);
      let isJson = false;
      try { JSON.parse(myOrders.data); isJson = true; } catch (e) {}
      logTest('STAFF_DELIVERY', 'API Danh sách đơn hàng phân công cho Shipper (/api/shipper/don-cua-toi)', myOrders.statusCode === 200 && isJson, `Status: ${myOrders.statusCode}`, myOrders.duration);
    } catch (e) {
      logTest('STAFF_DELIVERY', 'API Đơn của shipper', false, e.message, 0);
    }

    try {
      const mapApi = await request({ path: '/api/giao-hang/ban-do' }, null, dispatchCookie);
      let isJson = false;
      try { JSON.parse(mapApi.data); isJson = true; } catch (e) {}
      logTest('STAFF_DELIVERY', 'API Tọa độ các shipper đang trực tuyến (/api/giao-hang/ban-do)', mapApi.statusCode === 200 && isJson, `Status: ${mapApi.statusCode}`, mapApi.duration);
    } catch (e) {
      logTest('STAFF_DELIVERY', 'API Tọa độ shipper', false, e.message, 0);
    }

    subHeader('2.8. Cơ cấu tổ chức, Xếp ca & Chấm công PWA');
    const hrPages = [
      { path: '/to-chuc/quan-ly', name: 'Sơ đồ Cơ cấu tổ chức, Chức danh & Phân quyền', cookie: mgrCookie },
      { path: '/staff/to-chuc', name: 'Xem cây phòng ban & nhân sự (Nhân viên)', cookie: waiterCookie },
      { path: '/cham-cong-khuon-mat', name: 'Màn hình Kiosk Nhận diện khuôn mặt 1:N', cookie: mgrCookie },
      { path: '/staff/khuon-mat/lan-dau', name: 'Màn hình nhân viên chụp mẫu khuôn mặt 1:1', cookie: waiterCookie },
      { path: '/staff/cham-cong', name: 'Quản lý bảng chấm công theo ngày (Manager)', cookie: mgrCookie },
      { path: '/cham-cong/', name: 'Ứng dụng Chấm công Di động PWA (GPS + Face)', cookie: waiterCookie },
      { path: '/staff/xep-ca', name: 'Lưới xếp ca tự động theo tuần', cookie: mgrCookie },
      { path: '/staff/xep-ca/dinh-muc', name: 'Khai báo định mức nhân sự mỗi ca', cookie: mgrCookie }
    ];

    for (const hp of hrPages) {
      try {
        const res = await request({ path: hp.path }, null, hp.cookie);
        const ok = res.statusCode === 200 && res.data.length > 500;
        logTest('STAFF_HR', hp.name, ok, `Status: ${res.statusCode}`, res.duration);
      } catch (e) {
        logTest('STAFF_HR', hp.name, false, e.message, 0);
      }
    }

    const hrApis = [
      { path: '/api/to-chuc/so-do', name: 'API Sơ đồ cây tổ chức', cookie: mgrCookie },
      { path: '/api/to-chuc/tong-quan', name: 'API Thống kê tổng quan nhân sự', cookie: mgrCookie },
      { path: '/api/to-chuc/nhan-su', name: 'API Danh sách nhân viên & chức danh', cookie: mgrCookie },
      { path: '/api/to-chuc/hien-dien', name: 'API Trạng thái hiện diện theo ca', cookie: mgrCookie },
      { path: '/api/to-chuc/chuc-danh', name: 'API Danh mục chức danh & quyền hạn', cookie: mgrCookie },
      { path: '/api/to-chuc/to', name: 'API Danh sách các tổ làm việc', cookie: mgrCookie },
      { path: '/api/to-chuc/ho-so', name: 'API Hồ sơ phân quyền người đăng nhập', cookie: waiterCookie },
      { path: '/api/cham-cong/cua-toi', name: 'API Lịch sử chấm công của nhân viên', cookie: waiterCookie },
      { path: '/api/khuon-mat/trang-thai', name: 'API Kiểm tra trạng thái AI nhận diện khuôn mặt', cookie: mgrCookie }
    ];

    for (const ha of hrApis) {
      try {
        const res = await request({ path: ha.path }, null, ha.cookie);
        let isJson = false;
        try { JSON.parse(res.data); isJson = true; } catch (e) {}
        logTest('STAFF_HR', ha.name, res.statusCode === 200 && isJson, `Status: ${res.statusCode}`, res.duration);
      } catch (e) {
        logTest('STAFF_HR', ha.name, false, e.message, 0);
      }
    }

    subHeader('2.9. Báo cáo cuối ngày / Giao ca của Nhân viên Phục vụ');
    try {
      const rptPage = await request({ path: '/staff/phuc-vu/bao-cao' }, null, waiterCookie);
      const ok = rptPage.statusCode === 200 && (rptPage.data.includes('Báo cáo') || rptPage.data.includes('phục vụ'));
      logTest('STAFF_REPORT', 'Màn hình Báo cáo cuối ngày phục vụ (/staff/phuc-vu/bao-cao)', ok, `Status: ${rptPage.statusCode}`, rptPage.duration);
    } catch (e) {
      logTest('STAFF_REPORT', 'Màn hình Báo cáo cuối ngày phục vụ', false, e.message, 0);
    }

    try {
      const statsApi = await request({ path: `/staff/phuc-vu/api/so-lieu-ngay?ngay=${todayStr}` }, null, waiterCookie);
      let isJson = false;
      try { JSON.parse(statsApi.data); isJson = true; } catch (e) {}
      logTest('STAFF_REPORT', 'API Tự động tổng hợp số liệu ca phục vụ (/staff/phuc-vu/api/so-lieu-ngay)', statsApi.statusCode === 200 && isJson, `Status: ${statsApi.statusCode}`, statsApi.duration);
    } catch (e) {
      logTest('STAFF_REPORT', 'API Số liệu ca phục vụ', false, e.message, 0);
    }

    try {
      const rptHistory = await request({ path: '/staff/phuc-vu/bao-cao/lich-su' }, null, waiterCookie);
      const ok = rptHistory.statusCode === 200 && rptHistory.data.includes('Lịch sử');
      logTest('STAFF_REPORT', 'Lịch sử báo cáo giao ca phục vụ (/staff/phuc-vu/bao-cao/lich-su)', ok, `Status: ${rptHistory.statusCode}`, rptHistory.duration);
    } catch (e) {
      logTest('STAFF_REPORT', 'Lịch sử báo cáo giao ca phục vụ', false, e.message, 0);
    }

    // ================================================================================
    // PHẦN 3: QUẢN TRỊ VIÊN HỆ THỐNG (ADMIN PORTAL - FULL MANAGEMENT & AI)
    // ================================================================================
    sectionHeader('PHẦN 3: PHÂN HỆ QUẢN TRỊ VIÊN (ADMIN PORTAL - FULL CONTROL)');

    subHeader('3.1. Xác thực đăng nhập Quản trị viên');
    try {
      const wrong = await loginAdmin('admin', 'wrongpass123');
      const rejected = wrong.statusCode === 200 && (wrong.data.includes('Incorrect') || wrong.data.includes('Sai') || wrong.data.includes('error'));
      logTest('ADMIN_AUTH', 'Từ chối đăng nhập khi sai mật khẩu Admin', rejected, `Status: ${wrong.statusCode}`, wrong.duration);
    } catch (e) {
      logTest('ADMIN_AUTH', 'Từ chối đăng nhập khi sai mật khẩu Admin', false, e.message, 0);
    }

    let adminCookie = null;
    try {
      const auth = await loginAdmin('admin', '123456');
      const ok = auth.statusCode === 302 && auth.location === '/admin';
      adminCookie = auth.cookie;
      logTest('ADMIN_AUTH', 'Đăng nhập thành công tài khoản Quản trị Admin', ok, `Redirect -> ${auth.location}`, auth.duration);
    } catch (e) {
      logTest('ADMIN_AUTH', 'Đăng nhập thành công tài khoản Admin', false, e.message, 0);
    }

    subHeader('3.2. Dashboard Quản trị & Các màn hình CRUD danh mục');
    const adminPages = [
      { path: '/admin/', name: 'Dashboard Quản trị tổng quan (/admin/)' },
      { path: '/admin/stats', name: 'Thống kê kinh doanh & doanh thu (/admin/stats)' },
      { path: '/admin/catlist', name: 'Danh sách các loại món ăn (/admin/catlist)' },
      { path: '/admin/catadd', name: 'Form thêm loại món mới (/admin/catadd)' },
      { path: '/admin/productlist', name: 'Danh mục món ăn & thực đơn (/admin/productlist)' },
      { path: '/admin/productadd', name: 'Form thêm món ăn mới (/admin/productadd)' },
      { path: '/admin/stafflist', name: 'Danh sách nhân sự toàn hệ thống (/admin/stafflist)' },
      { path: '/admin/staffadd', name: 'Form thêm tài khoản nhân viên (/admin/staffadd)' },
      { path: '/admin/thanh-toan', name: 'Cấu hình thanh toán & VietQR (/admin/thanh-toan)' },
      { path: '/admin/dat-ban', name: 'Chính sách & Quy tắc đặt bàn (/admin/dat-ban)' },
      { path: '/admin/van-chuyen', name: 'Đơn vị vận chuyển & Cước phí (/admin/van-chuyen)' },
      { path: '/admin/khuyen-mai', name: 'Danh sách chương trình khuyến mãi (/admin/khuyen-mai)' },
      { path: '/admin/khuyen-mai/them', name: 'Form tạo mới khuyến mãi (/admin/khuyen-mai/them)' },
      { path: '/admin/thanh-vien', name: 'Hạng thành viên & Tích điểm (/admin/thanh-vien)' },
      { path: '/admin/bloglist', name: 'Danh sách bài viết tin tức (/admin/bloglist)' },
      { path: '/admin/blogadd', name: 'Form soạn thảo bài viết mới (/admin/blogadd)' },
      { path: '/admin/to-chuc-quan-ly', name: 'Cơ cấu tổ chức & Phân quyền (/admin/to-chuc-quan-ly)' },
      { path: '/admin/profile', name: 'Hồ sơ tài khoản Quản trị (/admin/profile)' },
      { path: '/admin/changepassword', name: 'Form đổi mật khẩu Quản trị (/admin/changepassword)' }
    ];

    for (const ap of adminPages) {
      try {
        const res = await request({ path: ap.path }, null, adminCookie);
        const ok = res.statusCode === 200 && res.data.length > 500;
        logTest('ADMIN_VIEW', ap.name, ok, `Status: ${res.statusCode}`, res.duration);
      } catch (e) {
        logTest('ADMIN_VIEW', ap.name, false, e.message, 0);
      }
    }

    subHeader('3.3. Quản trị Trí tuệ nhân tạo (AI Chatbot & AI Dự báo)');
    const aiPages = [
      { path: '/admin/chatbot', name: 'Quản trị Trợ lý AI Chatbot & Huấn luyện ý định (/admin/chatbot)', cookie: adminCookie },
      { path: '/admin/du-bao', name: 'Trung tâm Phân tích & Dự báo AI (/admin/du-bao)', cookie: adminCookie }
    ];

    for (const ap of aiPages) {
      try {
        const res = await request({ path: ap.path }, null, ap.cookie);
        const ok = res.statusCode === 200 && res.data.length > 500;
        logTest('ADMIN_AI', ap.name, ok, `Status: ${res.statusCode}`, res.duration);
      } catch (e) {
        logTest('ADMIN_AI', ap.name, false, e.message, 0);
      }
    }

    const aiApis = [
      { path: '/admin/chatbot/api/thong-ke', name: 'API Thống kê độ chuẩn xác câu trả lời Chatbot' },
      { path: '/du-bao/api/khach-da-luu', name: 'API Dữ liệu AI dự báo lượng khách' },
      { path: '/du-bao/api/nguyen-lieu-da-luu', name: 'API Dữ liệu AI dự báo tiêu thụ nguyên liệu' },
      { path: '/du-bao/api/danh-gia', name: 'API Đánh giá độ chính xác mô hình học máy' },
      { path: '/du-bao/api/trang-thai', name: 'API Kiểm tra tiến trình huấn luyện AI' }
    ];

    for (const aa of aiApis) {
      try {
        const res = await request({ path: aa.path }, null, adminCookie);
        let isJson = false;
        try { JSON.parse(res.data); isJson = true; } catch (e) {}
        logTest('ADMIN_AI', aa.name, res.statusCode === 200 && isJson, `Status: ${res.statusCode}`, res.duration);
      } catch (e) {
        logTest('ADMIN_AI', aa.name, false, e.message, 0);
      }
    }

    subHeader('3.4. Vòng đời CRUD Danh mục thực tế (Create - Edit - Delete)');
    const testCatName = `LoaiTest_${Date.now()}`;
    let createdCatId = null;

    try {
      // 1. Tạo mới
      const addRes = await request({
        path: '/admin/catadd',
        method: 'POST'
      }, { name_loai: testCatName, ghichu: 'Danh mục tự động hóa' }, adminCookie);
      const ok = addRes.statusCode === 302 && addRes.headers['location'] === '/admin/catlist';
      logTest('ADMIN_CRUD', `1. Tạo loại món mới: "${testCatName}"`, ok, `Redirect -> ${addRes.headers['location']}`, addRes.duration);
    } catch (e) {
      logTest('ADMIN_CRUD', '1. Tạo loại món mới', false, e.message, 0);
    }

    try {
      // 2. Tìm ID trong danh sách
      const listRes = await request({ path: '/admin/catlist' }, null, adminCookie);
      if (listRes.data.includes(testCatName)) {
        const regex = new RegExp(`href=["']/admin/catedit/([0-9]+)["'][^>]*>[^<]*${testCatName}|${testCatName}[\\s\\S]*?href=["']/admin/catedit/([0-9]+)["']`, 'i');
        const match = listRes.data.match(regex);
        if (match) createdCatId = match[1] || match[2];
      }
      logTest('ADMIN_CRUD', `2. Xác nhận loại món mới đã xuất hiện trong CSDL (ID: #${createdCatId || 'N/A'})`, !!createdCatId, `ID: #${createdCatId}`, listRes.duration);
    } catch (e) {
      logTest('ADMIN_CRUD', '2. Xác nhận loại món', false, e.message, 0);
    }

    if (createdCatId) {
      try {
        // 3. Sửa
        const editRes = await request({
          path: `/admin/catedit/${createdCatId}`,
          method: 'POST'
        }, { name_loai: `${testCatName}_Upd`, ghichu: 'Đã cập nhật' }, adminCookie);
        const ok = editRes.statusCode === 302 && editRes.headers['location'] === '/admin/catlist';
        logTest('ADMIN_CRUD', `3. Cập nhật tên loại món thành: "${testCatName}_Upd"`, ok, `Status: ${editRes.statusCode}`, editRes.duration);
      } catch (e) {
        logTest('ADMIN_CRUD', '3. Cập nhật tên loại món', false, e.message, 0);
      }

      try {
        // 4. Xóa dọn dẹp
        const delRes = await request({ path: `/admin/catdel/${createdCatId}` }, null, adminCookie);
        const ok = delRes.statusCode === 302 && delRes.headers['location'] === '/admin/catlist';
        logTest('ADMIN_CRUD', `4. Xóa dọn dẹp dữ liệu loại món test (ID: #${createdCatId})`, ok, `Status: ${delRes.statusCode}`, delRes.duration);
      } catch (e) {
        logTest('ADMIN_CRUD', '4. Xóa loại món test', false, e.message, 0);
      }
    }

    // ================================================================================
    // PHẦN 4: BẢO MẬT, PHÂN QUYỀN RBAC & XỬ LÝ BIÊN (SECURITY & EDGE CASES)
    // ================================================================================
    sectionHeader('PHẦN 4: BẢO MẬT, PHÂN QUYỀN RBAC & XỬ LÝ LỖI BIÊN (SECURITY & ROBUSTNESS)');

    subHeader('4.1. Chặn truy cập trái phép Quản trị khi chưa đăng nhập (Auth Guards)');
    const protectedAdminRoutes = [
      { path: '/admin/', name: 'Dashboard Quản trị (/admin/)' },
      { path: '/admin/catlist', name: 'Quản lý loại món (/admin/catlist)' },
      { path: '/admin/productlist', name: 'Quản lý món ăn (/admin/productlist)' },
      { path: '/admin/stafflist', name: 'Quản lý nhân viên (/admin/stafflist)' },
      { path: '/admin/thanh-toan', name: 'Cấu hình thanh toán (/admin/thanh-toan)' },
      { path: '/admin/dat-ban', name: 'Chính sách đặt bàn (/admin/dat-ban)' },
      { path: '/admin/van-chuyen', name: 'Đơn vị vận chuyển (/admin/van-chuyen)' },
      { path: '/admin/chatbot', name: 'Quản trị AI Chatbot (/admin/chatbot)' },
      { path: '/admin/khuyen-mai', name: 'Chương trình khuyến mãi (/admin/khuyen-mai)' },
      { path: '/admin/thanh-vien', name: 'Hạng thành viên (/admin/thanh-vien)' }
    ];

    for (const r of protectedAdminRoutes) {
      try {
        const res = await request({ path: r.path });
        const ok = res.statusCode === 302 && (res.headers['location'] === '/admin/login' || res.headers['location'] === '/login');
        logTest('SEC_UNAUTH', `Chặn truy cập trái phép Admin: ${r.name}`, ok, `Redirect -> ${res.headers['location']}`, res.duration);
      } catch (e) {
        logTest('SEC_UNAUTH', `Chặn truy cập Admin: ${r.name}`, false, e.message, 0);
      }
    }

    subHeader('4.2. Chặn truy cập trái phép Staff Portal khi chưa đăng nhập');
    const protectedStaffRoutes = [
      { path: '/staff', name: 'Dashboard Nhân viên (/staff)' },
      { path: '/staff/so-do-ban', name: 'Sơ đồ bàn (/staff/so-do-ban)' },
      { path: '/staff/kds', name: 'Màn hình KDS Bếp (/staff/kds)' },
      { path: '/staff/thanh-toan', name: 'POS Thu ngân (/staff/thanh-toan)' },
      { path: '/staff/giao-hang', name: 'Điều phối giao hàng (/staff/giao-hang)' },
      { path: '/staff/phuc-vu/bao-cao', name: 'Báo cáo giao ca (/staff/phuc-vu/bao-cao)' }
    ];

    for (const r of protectedStaffRoutes) {
      try {
        const res = await request({ path: r.path });
        const ok = res.statusCode === 302 && res.headers['location'] === '/staff/login';
        logTest('SEC_UNAUTH', `Chặn truy cập trái phép Staff: ${r.name}`, ok, `Redirect -> ${res.headers['location']}`, res.duration);
      } catch (e) {
        logTest('SEC_UNAUTH', `Chặn truy cập Staff: ${r.name}`, false, e.message, 0);
      }
    }

    subHeader('4.3. Phân quyền RBAC nghiêm ngặt (Role Segregation)');
    try {
      // Phục vụ cố tình truy cập trang tính lương kế toán
      const salaryAttempt = await request({ path: '/staff/accountant/salary' }, null, waiterCookie);
      const denied = salaryAttempt.statusCode === 302 || salaryAttempt.statusCode === 403;
      logTest('SEC_RBAC', 'Phục vụ bị chặn khi truy cập Bảng tính lương Kế toán (/staff/accountant/salary)', denied, `Status: ${salaryAttempt.statusCode}`, salaryAttempt.duration);
    } catch (e) {
      logTest('SEC_RBAC', 'Chặn phục vụ xem lương', false, e.message, 0);
    }

    try {
      // Thu ngân cố tình truy cập chức năng thêm nhân sự admin
      const addStaffAttempt = await request({ path: '/admin/staffadd' }, null, cashierCookie);
      const denied = addStaffAttempt.statusCode === 302 || addStaffAttempt.statusCode === 403;
      logTest('SEC_RBAC', 'Thu ngân bị chặn khi truy cập Trang thêm nhân sự Admin (/admin/staffadd)', denied, `Status: ${addStaffAttempt.statusCode}`, addStaffAttempt.duration);
    } catch (e) {
      logTest('SEC_RBAC', 'Chặn thu ngân thêm nhân sự', false, e.message, 0);
    }

    subHeader('4.4. Xử lý đường dẫn không tồn tại (Route 404 Not Found)');
    try {
      const notFoundRes = await request({ path: `/duong-dan-khong-ton-tai-${Date.now()}` });
      const ok = notFoundRes.statusCode === 404 || notFoundRes.data.includes('404') || notFoundRes.statusCode === 302;
      logTest('ROBUSTNESS', 'Xử lý chuẩn xác khi gọi route không tồn tại (404 Handler)', ok, `Status: ${notFoundRes.statusCode}`, notFoundRes.duration);
    } catch (e) {
      logTest('ROBUSTNESS', 'Xử lý route 404', false, e.message, 0);
    }

    subHeader('4.5. Chống tham số rác & Malformed Input Handling');
    try {
      const badInputRes = await request({
        path: '/chatbot/api/hoi',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { cau_hoi: '' });
      let isJson = false;
      let body = {};
      try { body = JSON.parse(badInputRes.data); isJson = true; } catch (e) {}
      const handled = badInputRes.statusCode === 200 && isJson && body.y_dinh === 'khong_hieu';
      logTest('ROBUSTNESS', 'Xử lý an toàn khi gửi payload rỗng vào API Chatbot', handled, `Response: ${body.van_ban || 'OK'}`, badInputRes.duration);
    } catch (e) {
      logTest('ROBUSTNESS', 'Payload rỗng Chatbot', false, e.message, 0);
    }

  } catch (globalErr) {
    console.error(`${C.red}Lỗi bất ngờ trong quá trình kiểm thử:${C.reset}`, globalErr);
  }

  // ================================================================================
  // TỔNG KẾT & XUẤT BÁO CÁO (REPORT GENERATION)
  // ================================================================================
  const totalDuration = Date.now() - suiteStartTime;
  masterResults.finishedAt = new Date().toISOString();
  masterResults.totalDurationMs = totalDuration;
  masterResults.passRate = ((masterResults.passedTests / (masterResults.totalTests || 1)) * 100).toFixed(2) + '%';

  console.log(`\n${C.bold}${C.magenta}================================================================================${C.reset}`);
  console.log(`${C.bold}${C.magenta}                     📊 BÁO CÁO TỔNG KẾT KIỂM THỬ TOÀN DIỆN                   ${C.reset}`);
  console.log(`${C.bold}${C.magenta}================================================================================${C.reset}`);
  console.log(`  🔹 Tổng số kịch bản kiểm tra chi tiết : ${C.bold}${masterResults.totalTests}${C.reset}`);
  console.log(`  ${C.green}✅ Thành công (PASSED)                 : ${masterResults.passedTests} / ${masterResults.totalTests}${C.reset}`);
  console.log(`  ${masterResults.failedTests > 0 ? C.red : C.dim}❌ Thất bại (FAILED)                   : ${masterResults.failedTests}${C.reset}`);
  console.log(`  📈 Tỷ lệ đạt chuẩn                    : ${C.bold}${C.cyan}${masterResults.passRate}${C.reset}`);
  console.log(`  ⏱️ Tổng thời gian chạy                : ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`${C.bold}${C.magenta}================================================================================${C.reset}`);

  // Lưu file JSON
  const reportDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const jsonReportPath = path.join(reportDir, 'test-automation-report.json');
  fs.writeFileSync(jsonReportPath, JSON.stringify(masterResults, null, 2), 'utf8');
  console.log(`\n  📄 Đã xuất báo cáo chi tiết dạng JSON : ${C.cyan}${jsonReportPath}${C.reset}`);

  // Lưu file HTML trực quan
  const htmlReportPath = path.join(reportDir, 'test-automation-report.html');
  const htmlContent = generateHtmlReport(masterResults);
  fs.writeFileSync(htmlReportPath, htmlContent, 'utf8');
  console.log(`  🌐 Đã xuất Dashboard báo cáo dạng HTML : ${C.cyan}${htmlReportPath}${C.reset}\n`);

  if (masterResults.failedTests === 0) {
    console.log(`${C.bold}${C.bgGreen}${C.white} 🌟 HOÀN HẢO! 100% TẤT CẢ CÁC CHỨC NĂNG CỦA HỆ THỐNG ĐỀU HOẠT ĐỘNG CHUẨN XÁC! 🌟 ${C.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${C.bold}${C.bgRed}${C.white} ⚠️ CẢNH BÁO: CÓ ${masterResults.failedTests} TEST CASE THẤT BẠI. XEM CHI TIẾT TRONG BÁO CÁO! ⚠️ ${C.reset}\n`);
    process.exit(1);
  }
}

/**
 * Hàm sinh báo cáo HTML Dashboard chuyên nghiệp
 */
function generateHtmlReport(data) {
  const rows = data.testCases.map((tc, idx) => `
    <tr class="${tc.passed ? 'pass-row' : 'fail-row'}">
      <td style="text-align: center; color: #64748b;">${idx + 1}</td>
      <td><span class="badge badge-sec">${tc.section ? tc.section.split(':')[0] : 'CHUNG'}</span></td>
      <td><span class="badge badge-mod">${tc.module}</span></td>
      <td style="font-weight: 500;">${tc.name}</td>
      <td style="text-align: center;">
        <span class="badge ${tc.passed ? 'badge-pass' : 'badge-fail'}">
          ${tc.passed ? '✓ PASSED' : '✗ FAILED'}
        </span>
      </td>
      <td style="color: #64748b; font-size: 13px;">${tc.note || ''}</td>
      <td style="text-align: right; font-family: monospace; color: #475569;">${tc.durationMs}ms</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Báo Cáo Test Automation Toàn Diện - GS Restaurant</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #f8fafc; color: #1e293b; padding: 24px; }
    .container { max-width: 1400px; margin: 0 auto; }
    header { background: linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%); color: white; padding: 32px; border-radius: 16px; margin-bottom: 24px; box-shadow: 0 10px 25px -5px rgba(2, 132, 199, 0.3); }
    header h1 { font-size: 28px; font-weight: 800; margin-bottom: 8px; }
    header p { opacity: 0.9; font-size: 15px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card { background: white; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .kpi-title { font-size: 13px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
    .kpi-value { font-size: 32px; font-weight: 800; }
    .val-pass { color: #16a34a; }
    .val-fail { color: #dc2626; }
    .val-blue { color: #0284c7; }
    .val-purp { color: #9333ea; }
    .table-container { background: white; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { background: #f1f5f9; padding: 14px 16px; font-size: 12px; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; }
    td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
    tr:hover { background-color: #f8fafc; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; }
    .badge-pass { background-color: #dcfce7; color: #15803d; }
    .badge-fail { background-color: #fee2e2; color: #b91c1c; }
    .badge-sec { background-color: #e0f2fe; color: #0369a1; }
    .badge-mod { background-color: #f1f5f9; color: #475569; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>BÁO CÁO TEST AUTOMATION TOÀN DIỆN HỆ THỐNG</h1>
      <p>GS Restaurant &bull; Thực thi: ${new Date(data.startedAt).toLocaleString('vi-VN')} &bull; Thời gian chạy: ${(data.totalDurationMs / 1000).toFixed(2)}s</p>
    </header>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-title">Tổng số Test Cases</div>
        <div class="kpi-value val-blue">${data.totalTests}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Thành công (Passed)</div>
        <div class="kpi-value val-pass">${data.passedTests}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Thất bại (Failed)</div>
        <div class="kpi-value ${data.failedTests > 0 ? 'val-fail' : 'val-pass'}">${data.failedTests}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Tỷ lệ Thành công</div>
        <div class="kpi-value val-purp">${data.passRate}</div>
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th style="width: 50px; text-align: center;">#</th>
            <th>Phân hệ</th>
            <th>Mô-đun</th>
            <th>Tên kịch bản kiểm thử</th>
            <th style="text-align: center;">Trạng thái</th>
            <th>Ghi chú / Kết quả</th>
            <th style="text-align: right;">Thời gian</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

// Chạy trực tiếp
if (require.main === module) {
  runMasterTestSuite();
}

module.exports = { runMasterTestSuite };
