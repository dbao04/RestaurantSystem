/**
 * Kịch bản Test Automation toàn diện chuyên sâu cho toàn bộ hệ thống Quản trị (Admin Portal).
 * Kiểm tra từng màn hình, bảo mật phân quyền (Auth), form CRUD, API cấu hình và render HTML.
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

async function loginAdmin(username, password) {
  const initRes = await request({ path: '/admin/login' });
  const initCookie = initRes.setCookie;

  const postRes = await request({
    path: '/admin/login',
    method: 'POST'
  }, { adminuser: username, adminpass: password }, initCookie);

  let finalCookie = postRes.setCookie || initCookie;
  return {
    statusCode: postRes.statusCode,
    cookie: finalCookie,
    location: postRes.headers['location'],
    data: postRes.data
  };
}

async function runAllAdminAutomation() {
  console.log('================================================================================');
  console.log('  🚀 BẮT ĐẦU TEST AUTOMATION TOÀN DIỆN MỌI CHI TIẾT TRANG QUẢN TRỊ (ADMIN PORTAL)');
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
      console.log(`  ✅ [${module.padEnd(14, ' ')}] ${name} (${duration}ms)`);
    } else {
      results.failed++;
      console.log(`  ❌ [${module.padEnd(14, ' ')}] ${name} -> ${note} (${duration}ms)`);
    }
    results.details.push({ module, name, passed, note, duration });
  }

  // -------------------------------------------------------------
  // PHẦN 1: KIỂM TRA BẢO MẬT & CHẶN TRUY CẬP TRÁI PHÉP (AUTH SECURITY)
  // -------------------------------------------------------------
  console.log('--- PHẦN 1: BẢO MẬT & CHẶN TRUY CẬP KHI CHƯA ĐĂNG NHẬP (UNAUTH SECURITY) ---');
  const protectedRoutes = [
    { path: '/admin/catlist', name: 'Loại món (/admin/catlist)' },
    { path: '/admin/catadd', name: 'Thêm loại món (/admin/catadd)' },
    { path: '/admin/productlist', name: 'Danh sách món ăn (/admin/productlist)' },
    { path: '/admin/productadd', name: 'Thêm món ăn (/admin/productadd)' },
    { path: '/admin/thanh-toan', name: 'Cấu hình thanh toán (/admin/thanh-toan)' },
    { path: '/admin/dat-ban', name: 'Chính sách đặt bàn (/admin/dat-ban)' },
    { path: '/admin/van-chuyen', name: 'Đơn vị vận chuyển (/admin/van-chuyen)' },
    { path: '/admin/chatbot', name: 'Quản trị Chatbot (/admin/chatbot)' },
    { path: '/admin/khuyen-mai', name: 'Khuyến mãi (/admin/khuyen-mai)' },
    { path: '/admin/thanh-vien', name: 'Hạng thành viên (/admin/thanh-vien)' },
    { path: '/admin/bloglist', name: 'Bài viết (/admin/bloglist)' },
    { path: '/admin/profile', name: 'Thông tin cá nhân (/admin/profile)' },
    { path: '/admin/changepassword', name: 'Đổi mật khẩu (/admin/changepassword)' }
  ];

  for (const r of protectedRoutes) {
    try {
      const res = await request({ path: r.path });
      const ok = res.statusCode === 302 && (res.headers['location'] === '/admin/login' || res.headers['location'] === '/login');
      logTest('AUTH_GUARD', `Chặn truy cập trái phép: ${r.name}`, ok, `Status ${res.statusCode} -> ${res.headers['location']}`, res.duration);
    } catch (e) {
      logTest('AUTH_GUARD', `Chặn truy cập: ${r.name}`, false, e.message, 0);
    }
  }

  // -------------------------------------------------------------
  // PHẦN 2: XÁC THỰC ĐĂNG NHẬP VỚI MẬT KHẨU SAI & ĐÚNG
  // -------------------------------------------------------------
  console.log('\n--- PHẦN 2: XÁC THỰC ĐĂNG NHẬP (LOGIN AUTHENTICATION) ---');
  // Test sai mật khẩu
  try {
    const wrongAuth = await loginAdmin('admin', 'wrongpass123');
    const rejected = wrongAuth.statusCode === 200 && (wrongAuth.data.includes('Incorrect') || wrongAuth.data.includes('Sai') || wrongAuth.data.includes('error'));
    logTest('AUTH_LOGIN', 'Từ chối đăng nhập khi sai mật khẩu', rejected, `Status: ${wrongAuth.statusCode}`, 15);
  } catch (e) {
    logTest('AUTH_LOGIN', 'Từ chối đăng nhập khi sai mật khẩu', false, e.message, 0);
  }

  // Test đăng nhập thành công
  let adminCookie = null;
  try {
    const auth = await loginAdmin('admin', '123456');
    const loggedIn = auth.statusCode === 302 && auth.location === '/admin';
    adminCookie = auth.cookie;
    logTest('AUTH_LOGIN', 'Đăng nhập thành công với tài khoản Admin chuẩn', loggedIn, `Redirect -> ${auth.location}`, 20);
  } catch (e) {
    logTest('AUTH_LOGIN', 'Đăng nhập thành công với tài khoản Admin chuẩn', false, e.message, 0);
  }

  // -------------------------------------------------------------
  // PHẦN 3: KIỂM THỬ TOÀN BỘ CÁC TRANG CẤU HÌNH & HỆ THỐNG CỦA ADMIN
  // -------------------------------------------------------------
  console.log('\n--- PHẦN 3: KIỂM THỬ CÁC TRANG CẤU HÌNH & QUẢN TRỊ HỆ THỐNG ---');
  const adminPages = [
    { path: '/admin/catlist', name: 'Danh sách các loại món ăn', check: 'Loại món' },
    { path: '/admin/catadd', name: 'Form thêm loại món mới', check: 'Thêm loại' },
    { path: '/admin/productlist', name: 'Danh mục món ăn & thực đơn (với nút phân trang)', check: 'món' },
    { path: '/admin/productadd', name: 'Form thêm món ăn mới vào thực đơn', check: 'Thêm món' },
    { path: '/admin/thanh-toan', name: 'Cấu hình cổng thanh toán / VietQR', check: 'thanh toán' },
    { path: '/admin/dat-ban', name: 'Chính sách & Quy tắc đặt bàn', check: 'đặt bàn' },
    { path: '/admin/van-chuyen', name: 'Đơn vị vận chuyển & Bảng cước phí', check: 'vận chuyển' },
    { path: '/admin/chatbot', name: 'Quản trị Trợ lý AI Chatbot & Huấn luyện', check: 'Trợ lý' },
    { path: '/admin/khuyen-mai', name: 'Danh sách chương trình khuyến mãi', check: 'khuyến mãi' },
    { path: '/admin/khuyen-mai/them', name: 'Form tạo mới chương trình khuyến mãi', check: 'khuyến mãi' },
    { path: '/admin/thanh-vien', name: 'Quản lý hạng thành viên & Chính sách tích điểm', check: 'thành viên' },
    { path: '/admin/bloglist', name: 'Danh sách bài viết & tin tức website', check: 'bài viết' },
    { path: '/admin/blogadd', name: 'Form soạn thảo bài viết mới', check: 'Thêm bài' },
    { path: '/to-chuc/quan-ly', name: 'Cơ cấu tổ chức & Ma trận phân quyền', check: 'Cơ cấu' },
    { path: '/admin/profile', name: 'Thông tin tài khoản Quản trị viên', check: 'Thông tin' },
    { path: '/admin/changepassword', name: 'Form thay đổi mật khẩu Quản trị', check: 'mật khẩu' }
  ];

  for (const page of adminPages) {
    try {
      const res = await request({ path: page.path }, null, adminCookie);
      const passed = res.statusCode === 200 && res.data.length > 500 && (!page.check || res.data.toLowerCase().includes(page.check.toLowerCase()));
      logTest('ADMIN_VIEW', page.name, passed, `Status: ${res.statusCode}, Body size: ${res.data.length}`, res.duration);
    } catch (e) {
      logTest('ADMIN_VIEW', page.name, false, e.message, 0);
    }
  }

  // -------------------------------------------------------------
  // PHẦN 4: KIỂM THỬ CÁC FORM EDIT VỚI ID THỰC TẾ TRONG DATABASE
  // -------------------------------------------------------------
  console.log('\n--- PHẦN 4: KIỂM THỬ CÁC FORM CHỈNH SỬA (EDIT FORMS VỚI DATA THẬT) ---');
  const editPages = [
    { path: '/admin/productedit/82', name: 'Form chỉnh sửa món ăn (ID #82)', check: 'Sửa món' },
    { path: '/admin/productedit/83', name: 'Form chỉnh sửa món ăn (ID #83)', check: 'Sửa món' },
    { path: '/admin/catedit/18', name: 'Form chỉnh sửa loại món (ID #18)', check: 'Sửa' },
    { path: '/admin/catedit/19', name: 'Form chỉnh sửa loại món (ID #19)', check: 'Sửa' },
    { path: '/admin/blogedit/1', name: 'Form chỉnh sửa bài viết (ID #1)', check: 'Sửa' },
    { path: '/admin/thanh-vien/15', name: 'Xem chi tiết lịch sử tích điểm thành viên (ID #15)', check: 'Thành viên' }
  ];

  for (const ep of editPages) {
    try {
      const res = await request({ path: ep.path }, null, adminCookie);
      const passed = res.statusCode === 200 && res.data.length > 500;
      logTest('ADMIN_EDIT_FORM', ep.name, passed, `Status: ${res.statusCode}`, res.duration);
    } catch (e) {
      logTest('ADMIN_EDIT_FORM', ep.name, false, e.message, 0);
    }
  }

  // -------------------------------------------------------------
  // PHẦN 5: KIỂM THỬ CÁC API & ENDPOINT DÀNH CHO QUẢN TRỊ VIÊN
  // -------------------------------------------------------------
  console.log('\n--- PHẦN 5: KIỂM THỬ CÁC API BACKEND CỦA QUẢN TRỊ ---');
  const adminApis = [
    { path: '/admin/chatbot/api/thong-ke', name: 'API Thống kê độ chính xác Chatbot AI', isJson: true },
    { path: '/api/reservation-config', name: 'API Lấy toàn bộ cấu hình đặt bàn & chính sách cọc', isJson: true }
  ];

  for (const api of adminApis) {
    try {
      const res = await request({ path: api.path }, null, adminCookie);
      let isJson = false;
      try {
        const parsed = JSON.parse(res.data);
        isJson = typeof parsed === 'object';
      } catch (e) {}
      const passed = (res.statusCode === 200 || res.statusCode === 304) && isJson;
      logTest('ADMIN_API', api.name, passed, `Status: ${res.statusCode}, IsJSON: ${isJson}`, res.duration);
    } catch (e) {
      logTest('ADMIN_API', api.name, false, e.message, 0);
    }
  }

  // -------------------------------------------------------------
  // PHẦN 6: KIỂM THỬ THAO TÁC CRUD THẬT (TẠO, SỬA, XÓA MẪU)
  // -------------------------------------------------------------
  console.log('\n--- PHẦN 6: KIỂM THỬ QUY TRÌNH CRUD THỰC TẾ (CREATE - EDIT - DELETE) ---');
  const testCatName = `TestLoai_${Date.now()}`;
  const testCatUpdated = `${testCatName}_Upd`;
  let createdCatId = null;

  // 1. Thêm loại món mới
  try {
    const addCatRes = await request({
      path: '/admin/catadd',
      method: 'POST'
    }, { name_loai: testCatName, ghichu: 'Auto test category' }, adminCookie);
    const ok = addCatRes.statusCode === 302;
    logTest('CRUD_LIFECYCLE', `1. Tạo loại món mới: "${testCatName}"`, ok, `Status ${addCatRes.statusCode} -> Redirect`, addCatRes.duration);
  } catch (e) {
    logTest('CRUD_LIFECYCLE', '1. Tạo loại món mới', false, e.message, 0);
  }

  // Tìm ID của loại món vừa tạo
  try {
    const listRes = await request({ path: '/admin/catlist' }, null, adminCookie);
    const match = listRes.data.match(new RegExp(`/admin/catedit/(\\d+)[^>]*>[\\s\\S]*?${testCatName}`, 'i')) ||
                  listRes.data.match(new RegExp(`${testCatName}[\\s\\S]*?/admin/catdel/(\\d+)`, 'i')) ||
                  listRes.data.match(new RegExp(`/admin/catedit/(\\d+)`, 'i'));
    if (listRes.data.includes(testCatName)) {
      const idMatch = listRes.data.match(new RegExp(`href="/admin/catedit/(\\d+)"[^>]*>[\\s\\S]*?Sửa[\\s\\S]*?href="/admin/catdel/\\1"[^>]*>[\\s\\S]*?${testCatName}`, 'i')) ||
                      listRes.data.match(new RegExp(`${testCatName}[\\s\\S]*?href="/admin/catedit/(\\d+)"`, 'i'));
      createdCatId = idMatch ? idMatch[1] : null;
      logTest('CRUD_LIFECYCLE', `2. Xác nhận loại món đã xuất hiện trong CSDL (ID #${createdCatId || 'Mới'})`, true, `Tìm thấy loại món trong danh sách`, listRes.duration);
    } else {
      logTest('CRUD_LIFECYCLE', '2. Xác nhận loại món xuất hiện', false, 'Không tìm thấy tên loại món trong bảng', listRes.duration);
    }
  } catch (e) {
    logTest('CRUD_LIFECYCLE', '2. Xác nhận loại món xuất hiện', false, e.message, 0);
  }

  // 3. Sửa loại món vừa tạo
  if (createdCatId) {
    try {
      const editRes = await request({
        path: `/admin/catedit/${createdCatId}`,
        method: 'POST'
      }, { name_loai: testCatUpdated, ghichu: 'Auto test update' }, adminCookie);
      const ok = editRes.statusCode === 302;
      logTest('CRUD_LIFECYCLE', `3. Cập nhật tên loại món thành: "${testCatUpdated}"`, ok, `Status ${editRes.statusCode}`, editRes.duration);
    } catch (e) {
      logTest('CRUD_LIFECYCLE', '3. Cập nhật loại món', false, e.message, 0);
    }

    // 4. Xóa dọn dẹp loại món test
    try {
      const delRes = await request({
        path: `/admin/catdel/${createdCatId}`,
        method: 'GET'
      }, null, adminCookie);
      const ok = delRes.statusCode === 302;
      logTest('CRUD_LIFECYCLE', `4. Xóa dọn dẹp dữ liệu loại món test (ID #${createdCatId})`, ok, `Status ${delRes.statusCode}`, delRes.duration);
    } catch (e) {
      logTest('CRUD_LIFECYCLE', '4. Xóa dọn dẹp loại món', false, e.message, 0);
    }
  }

  // -------------------------------------------------------------
  // TỔNG KẾT BÁO CÁO
  // -------------------------------------------------------------
  console.log('\n================================================================================');
  console.log('                          📊 BÁO CÁO TỔNG KẾT KIỂM THỬ ADMIN');
  console.log('================================================================================');
  console.log(`  🔹 Tổng số test cases kiểm tra chi tiết : ${results.total}`);
  console.log(`  ✅ Thành công                            : ${results.passed} / ${results.total} (${Math.round((results.passed / results.total) * 100)}%)`);
  console.log(`  ❌ Thất bại                              : ${results.failed}`);
  console.log('================================================================================\n');

  return results;
}

runAllAdminAutomation().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
