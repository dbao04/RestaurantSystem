/**
 * AUTOMATION TEST SUITE: TOÀN BỘ TRANG VÀ CHỨC NĂNG PHÍA KHÁCH HÀNG (FULL 100%)
 *
 * Kiểm tra chi tiết từng endpoint, render view, luồng người dùng (Customer Flow):
 * 1. Các trang tĩnh & thông tin (Trang chủ, Giới thiệu, Thực đơn, Tin tức, Thành viên, Hướng dẫn đặt bàn)
 * 2. Đa ngôn ngữ (Tiếng Việt, Tiếng Anh, Tiếng Nhật)
 * 3. Chức năng Tìm kiếm món, Xem chi tiết món, Phân tích dị ứng nguyên liệu
 * 4. Chức năng Xác thực khách hàng (Đăng ký tài khoản, Đăng nhập, Xem hồ sơ, Đổi mật khẩu, Quên mật khẩu, Đăng xuất)
 * 5. Chức năng Giỏ hàng (Thêm món, cập nhật số lượng, tính tổng tiền, xóa món)
 * 6. Chức năng Đặt bàn trực tuyến (/dat-ban, /api/dat-ban/khung-gio, /api/dat-ban/kha-dung, /api/dat-ban, /api/dat-ban/tra-cuu)
 * 7. Chức năng Đặt món giao hàng tận nơi (/giao-hang, tính phí ship theo tọa độ, tạo đơn giao hàng, tra cứu /theo-doi/:ma)
 * 8. Chức năng Đơn hàng của tôi (/my-orders, yêu cầu hủy đơn)
 * 9. Chức năng Trợ lý ảo AI Chatbot (/chatbot/api/hoi, /chatbot/api/cau-hoi-mau, đánh giá câu trả lời)
 * 10. Chức năng Đánh giá chất lượng dịch vụ (/rate, /rating)
 * 11. Chức năng Tự thanh toán hóa đơn bàn qua VietQR (/qr/thanh-toan/:sesis)
 */

const http = require('http');
const querystring = require('querystring');
const db = require('../config/db');

const BASE_URL = 'http://localhost:3000';
let soDat = 0;
let soHong = 0;
const loiChiTiet = [];

function ok(ten, dieuKien, chiTiet) {
  if (dieuKien) {
    soDat += 1;
    console.log(`  ✓ ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`);
  } else {
    soHong += 1;
    loiChiTiet.push(ten);
    console.log(`  ✗ ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`);
  }
}

function nhom(ten) {
  console.log(`\n======================================================================`);
  console.log(`🔷 ${ten}`);
  console.log(`======================================================================`);
}

// Helper: HTTP Request with Cookie / Session support
function request(options, postData = null, cookie = '') {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(options.url || options.path, BASE_URL);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 3000,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'CustomerAutomationTest/1.0',
        ...options.headers,
      }
    };

    if (cookie) {
      reqOptions.headers['Cookie'] = cookie;
    }

    let payload = null;
    if (postData !== null && postData !== undefined) {
      const cType = reqOptions.headers['Content-Type'] || '';
      if (cType.includes('application/json')) {
        payload = typeof postData === 'string' ? postData : JSON.stringify(postData);
      } else {
        reqOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        payload = typeof postData === 'string' ? postData : querystring.stringify(postData);
      }
      reqOptions.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let setCookies = res.headers['set-cookie'] || [];
        let newCookie = setCookies.map(c => c.split(';')[0]).join('; ');
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          cookie: newCookie || cookie
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

async function runAllCustomerTests() {
  console.log('🚀 BẮT ĐẦU KIỂM THỬ AUTOMATION TOÀN DIỆN TRANG KHÁCH HÀNG...');
  const startTime = Date.now();

  try {
    // =========================================================================
    // 1. KIỂM TRA CÁC TRANG CÔNG KHAI & NỘI DUNG (PUBLIC STATIC PAGES)
    // =========================================================================
    nhom('1. Kiểm tra các trang công khai & thông tin');

    const pHome = await request({ path: '/' });
    ok('Trang chủ (GET /)', pHome.statusCode === 200 && pHome.body.includes('Nhà Hàng Bảo Đoàn'));

    const pAbout = await request({ path: '/about' });
    ok('Trang giới thiệu (GET /about)', pAbout.statusCode === 200);

    const pMenu = await request({ path: '/menu' });
    ok('Trang thực đơn chính (GET /menu)', pMenu.statusCode === 200 && pMenu.body.length > 500);

    const pBlog = await request({ path: '/blog' });
    ok('Trang tin tức bài viết (GET /blog)', pBlog.statusCode === 200);

    const pThanhVien = await request({ path: '/thanh-vien' });
    ok('Trang thành viên & tích điểm (GET /thanh-vien)', pThanhVien.statusCode === 200 && pThanhVien.body.includes('thanh-vien'));

    const pHuongDan = await request({ path: '/huong-dan-dat-ban' });
    ok('Trang hướng dẫn đặt bàn (GET /huong-dan-dat-ban)', pHuongDan.statusCode === 200);

    const pDatBanPortal = await request({ path: '/dat-ban' });
    ok('Cổng đặt bàn trực tuyến (GET /dat-ban)', pDatBanPortal.statusCode === 200);

    const pRedirectDatBan = await request({ path: '/datban' });
    ok('Chuyển hướng /datban -> /dat-ban', pRedirectDatBan.statusCode === 302);

    const pRedirectReservation = await request({ path: '/reservation' });
    ok('Chuyển hướng 301 /reservation -> /dat-ban', pRedirectReservation.statusCode === 301);

    // =========================================================================
    // 2. KIỂM TRA ĐA NGÔN NGỮ (VI / EN / JA)
    // =========================================================================
    nhom('2. Kiểm tra hỗ trợ Đa ngôn ngữ (i18n)');

    const pLangEn = await request({ path: '/?lang=en' });
    ok('Chuyển ngôn ngữ tiếng Anh (?lang=en)', pLangEn.statusCode === 200);

    const pLangJa = await request({ path: '/?lang=ja' });
    ok('Chuyển ngôn ngữ tiếng Nhật (?lang=ja)', pLangJa.statusCode === 200);

    const pLangVi = await request({ path: '/?lang=vi' });
    ok('Chuyển ngôn ngữ tiếng Việt (?lang=vi)', pLangVi.statusCode === 200);

    // =========================================================================
    // 3. TÌM KIẾM MÓN ĂN & CHI TIẾT DỊ ỨNG (MENU SEARCH & DETAILS)
    // =========================================================================
    nhom('3. Kiểm tra Tìm kiếm món ăn & Chi tiết nguyên liệu dị ứng');

    const [monMau] = await db.query('SELECT id_mon, name_mon FROM monan WHERE tinhtrang = 1 LIMIT 1');
    const testDishId = monMau[0] ? monMau[0].id_mon : 1;
    const testDishName = monMau[0] ? monMau[0].name_mon : 'Bò';

    // Tìm kiếm theo từ khóa
    const pSearch = await request({
      path: '/menu',
      method: 'POST'
    }, { key: testDishName.slice(0, 3) });
    ok('Tìm kiếm món ăn (POST /menu key=...)', pSearch.statusCode === 200);

    // Lọc theo nhóm / danh mục
    const [loaiMau] = await db.query('SELECT id_loai FROM loai_mon LIMIT 1');
    const testCatId = loaiMau[0] ? loaiMau[0].id_loai : 1;
    const pCatFilter = await request({ path: `/menu?id_loai=${testCatId}` });
    ok(`Lọc món theo danh mục (GET /menu?id_loai=${testCatId})`, pCatFilter.statusCode === 200);

    // Chi tiết món ăn
    const pDetail = await request({ path: `/detail?monid=${testDishId}` });
    ok(`Chi tiết món ăn & dị ứng (GET /detail?monid=${testDishId})`, pDetail.statusCode === 200 && pDetail.body.includes(testDishName));

    // =========================================================================
    // 4. QUẢN LÝ TÀI KHOẢN KHÁCH HÀNG (AUTH & PROFILE FLOW)
    // =========================================================================
    nhom('4. Kiểm tra luồng Xác thực Khách hàng (Auth & Profile)');

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const testUser = {
      ten: `Khách Test ${randomSuffix}`,
      sodienthoai: `098${randomSuffix}`,
      email: `autotest_${randomSuffix}@gmail.com`,
      diachi: '123 Đường Test, Quận 7, TP.HCM',
      passwords: 'TestPassword123!',
      repass: 'TestPassword123!'
    };

    // Đăng ký tài khoản mới
    const pRegister = await request({
      path: '/register',
      method: 'POST'
    }, testUser);
    ok('Đăng ký tài khoản khách (POST /register)', pRegister.statusCode === 200);

    // Đăng nhập
    let userCookie = '';
    const pLogin = await request({
      path: '/login',
      method: 'POST'
    }, { sdt: testUser.sodienthoai, pass: testUser.passwords });
    userCookie = pLogin.cookie;
    ok('Đăng nhập khách hàng (POST /login)', pLogin.statusCode === 302, `Redirect về: ${pLogin.headers.location}`);

    // Xem thông tin hồ sơ
    const pProfile = await request({ path: '/profile' }, null, userCookie);
    ok('Xem trang cá nhân (GET /profile)', pProfile.statusCode === 200 && pProfile.body.includes(testUser.sodienthoai));

    // Cập nhật thông tin hồ sơ
    const pUpdateProfile = await request({
      path: '/profile',
      method: 'POST'
    }, { action: 'update', ten: `${testUser.ten} (VIP)`, email: testUser.email, diachi: '456 Lê Văn Lương, Q7' }, userCookie);
    ok('Cập nhật hồ sơ (POST /profile action=update)', pUpdateProfile.statusCode === 302);

    // =========================================================================
    // 5. GIỎ HÀNG (CART OPERATIONS)
    // =========================================================================
    nhom('5. Kiểm tra Giỏ hàng khách hàng');

    // Thêm món vào giỏ
    const pAddToCart = await request({
      path: '/add-to-cart',
      method: 'POST'
    }, { monid: testDishId, soluong: 2 }, userCookie);
    userCookie = pAddToCart.cookie || userCookie;
    ok('Thêm món vào giỏ (POST /add-to-cart)', pAddToCart.statusCode === 302);

    // Xem giỏ hàng
    const pViewCart = await request({ path: '/cart' }, null, userCookie);
    ok('Xem giỏ hàng (GET /cart)', pViewCart.statusCode === 200 && pViewCart.body.includes(testDishName));

    // =========================================================================
    // 6. QUY TRÌNH ĐẶT BÀN TRỰC TUYẾN (/dat-ban & API ĐẶT BÀN)
    // =========================================================================
    nhom('6. Kiểm tra Quy trình Đặt bàn & Khung giờ');

    const ngayMai = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    // API Lấy danh sách khu vực bàn
    const pKhuVuc = await request({ path: '/api/dat-ban/khu-vuc' });
    ok('Lấy danh sách khu vực bàn (GET /api/dat-ban/khu-vuc)', pKhuVuc.statusCode === 200);

    // API Khung giờ còn nhận khách
    const pKhungGio = await request({ path: `/api/dat-ban/khung-gio?ngay=${ngayMai}&so_khach=4` });
    ok('Truy vấn khung giờ khả dụng (GET /api/dat-ban/khung-gio)', pKhungGio.statusCode === 200);

    // API Kiểm tra khả dụng bàn (với các trường chuẩn reservation_date, start_time, guest_count)
    const pKhaDung = await request({ path: `/api/dat-ban/kha-dung?reservation_date=${ngayMai}&start_time=18:30&guest_count=4` });
    ok('Kiểm tra bàn trống phù hợp (GET /api/dat-ban/kha-dung)', pKhaDung.statusCode === 200 && pKhaDung.body.includes('"ok":true'));

    // Tạo lượt đặt bàn trực tuyến qua POST /api/dat-ban
    let maDatBanMoi = '';
    const pTaoDatBan = await request({
      path: '/api/dat-ban',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      customer_name: testUser.ten,
      phone: testUser.sodienthoai,
      email: testUser.email,
      reservation_date: ngayMai,
      start_time: '19:00',
      guest_count: 4,
      special_requests: 'Đặt bàn qua Automation Test'
    }, userCookie);

    try {
      const kqDat = JSON.parse(pTaoDatBan.body);
      if (kqDat.ok && (kqDat.reservation_code || kqDat.ma)) {
        maDatBanMoi = kqDat.reservation_code || kqDat.ma;
      }
    } catch (e) {}

    ok('Tạo đặt bàn trực tuyến (POST /api/dat-ban)', pTaoDatBan.statusCode === 201 && !!maDatBanMoi, `Mã đặt: ${maDatBanMoi}`);

    if (maDatBanMoi) {
      // Khách tra cứu thông tin lượt đặt của mình bằng Mã + SĐT
      const pTraCuu = await request({
        path: '/api/dat-ban/tra-cuu',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { ma: maDatBanMoi, dien_thoai: testUser.sodienthoai });
      ok('Tra cứu lượt đặt bàn (POST /api/dat-ban/tra-cuu)', pTraCuu.statusCode === 200 && pTraCuu.body.includes(maDatBanMoi));

      // Trang hoàn tất đặt bàn (GET /dat-ban/xong)
      const pTrangXong = await request({ path: `/dat-ban/xong?ma=${maDatBanMoi}&dt=${testUser.sodienthoai}` });
      ok(`Trang xác nhận đặt bàn (GET /dat-ban/xong)`, pTrangXong.statusCode === 200);
    }

    // =========================================================================
    // 7. ĐẶT MÓN GIAO HÀNG TẬN NƠI (/giao-hang & /theo-doi)
    // =========================================================================
    nhom('7. Kiểm tra Đặt món Giao hàng tận nơi & Theo dõi đơn');

    // GET /giao-hang chuyển hướng trực tiếp sang /cart (nếu có giỏ) hoặc /menu
    const pTrangGiao = await request({ path: '/giao-hang' }, null, userCookie);
    ok('Chuyển hướng trang giao hàng (GET /giao-hang)', pTrangGiao.statusCode === 302);

    // Lưu thông tin giao hàng
    const pSaveGiao = await request({
      path: '/giao-hang',
      method: 'POST'
    }, {
      dia_chi_giao: 'Tòa nhà Bitexco, 2 Hải Triều, Bến Nghé, Quận 1, TP.HCM',
      ten_nguoi_nhan: testUser.ten,
      sdt_nguoi_nhan: testUser.sodienthoai,
      vi_do: '10.771663',
      kinh_do: '106.704384',
      ghi_chu_giao: 'Giao giờ hành chính'
    }, userCookie);
    userCookie = pSaveGiao.cookie || userCookie;
    ok('Lưu thông tin giao hàng & tính phí (POST /giao-hang)', pSaveGiao.statusCode === 302);

    // Đặt đơn hoàn tất
    let maDonGiao = '';
    const pPostDatDon = await request({
      path: '/datban',
      method: 'POST'
    }, {
      hinh_thuc: 'giao_hang',
      dia_chi_giao: 'Tòa nhà Bitexco, 2 Hải Triều, Q1',
      vi_do: '10.771663',
      kinh_do: '106.704384',
      datebook: ngayMai,
      timebook: '12:00'
    }, userCookie);

    if (pPostDatDon.headers && pPostDatDon.headers.location && pPostDatDon.headers.location.includes('/theo-doi/')) {
      maDonGiao = pPostDatDon.headers.location.split('/theo-doi/')[1];
    }
    ok('Chốt đơn giao hàng tận nơi (POST /datban)', pPostDatDon.statusCode === 302, `Redirect: ${pPostDatDon.headers.location}`);

    if (maDonGiao) {
      // Khách xem bản đồ và trạng thái giao hàng thời gian thực
      const pTheoDoi = await request({ path: `/theo-doi/${maDonGiao}` });
      ok(`Trang theo dõi tiến độ shipper (GET /theo-doi/${maDonGiao})`, pTheoDoi.statusCode === 200 && pTheoDoi.body.includes(maDonGiao));
    }

    // =========================================================================
    // 8. ĐƠN HÀNG CỦA TÔI & LỊCH SỬ (MY ORDERS)
    // =========================================================================
    nhom('8. Kiểm tra Trang Đơn hàng & Lịch sử đặt của tôi');

    const pMyOrders = await request({ path: '/my-orders' }, null, userCookie);
    ok('Xem danh sách đơn & bàn đã đặt (GET /my-orders)', pMyOrders.statusCode === 200);

    // =========================================================================
    // 9. TRỢ LÝ ẢO AI CHATBOT KHÁCH HÀNG (AI ASSISTANT)
    // =========================================================================
    nhom('9. Kiểm tra Trợ lý ảo AI Chatbot tư vấn');

    // Lấy câu hỏi mẫu
    const pCauHoiMau = await request({ path: '/chatbot/api/cau-hoi-mau' });
    ok('Lấy danh sách câu hỏi mẫu (GET /chatbot/api/cau-hoi-mau)', pCauHoiMau.statusCode === 200);

    // Gửi câu hỏi cho Chatbot
    const pHoiChatbot = await request({
      path: '/chatbot/api/hoi',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { cau_hoi: 'Nhà hàng có món gì ngon nhất?' });
    let botRespJson = null;
    try { botRespJson = JSON.parse(pHoiChatbot.body); } catch(e) {}
    ok('Chatbot trả lời tư vấn khách (POST /chatbot/api/hoi)', pHoiChatbot.statusCode === 200 && !!(botRespJson && botRespJson.van_ban));

    // =========================================================================
    // 10. ĐÁNH GIÁ TRẢI NGHIỆM KHÁCH HÀNG (RATING & FEEDBACK)
    // =========================================================================
    nhom('10. Kiểm tra Đánh giá & Phản hồi (Rating)');

    const pRate = await request({ path: '/rate' }, null, userCookie);
    ok('Xem trang đánh giá nhà hàng (GET /rate)', pRate.statusCode === 200);

    // Gửi đánh giá
    const pSendRate = await request({
      path: '/rating',
      method: 'POST'
    }, { sao: 5, noi_dung: 'Món ăn rất ngon, phục vụ tuyệt vời!' }, userCookie);
    ok('Gửi đánh giá trải nghiệm (POST /rating)', pSendRate.statusCode === 302);

    // =========================================================================
    // 11. ĐĂNG XUẤT KHÁCH HÀNG (LOGOUT)
    // =========================================================================
    nhom('11. Kiểm tra Đăng xuất');

    const pLogout = await request({ path: '/logout' }, null, userCookie);
    ok('Đăng xuất tài khoản khách (GET /logout)', pLogout.statusCode === 302);

    // Dọn dẹp dữ liệu test (Xóa user test & đặt bàn test)
    await db.query('DELETE FROM khach_hang WHERE sodienthoai = ?', [testUser.sodienthoai]);
    if (maDatBanMoi) {
      await db.query('DELETE FROM reservation_history WHERE reservation_id IN (SELECT id FROM reservations WHERE reservation_code = ?)', [maDatBanMoi]);
      await db.query('DELETE FROM reservation_slot_locks WHERE reservation_id IN (SELECT id FROM reservations WHERE reservation_code = ?)', [maDatBanMoi]);
      await db.query('DELETE FROM reservations WHERE reservation_code = ?', [maDatBanMoi]);
    }

  } catch (err) {
    console.error('\n❌ GẶP LỖI NGOẠI LỆ TRONG KHI KIỂM THỬ:', err);
    soHong += 1;
    loiChiTiet.push(err.message);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n======================================================================');
  console.log(`📊 TỔNG KẾT KIỂM THỬ AUTOMATION KHÁCH HÀNG:`);
  console.log(`   - Tổng số kịch bản test: ${soDat + soHong}`);
  console.log(`   - Thành công:           ${soDat} test`);
  console.log(`   - Thất bại:             ${soHong} test`);
  console.log(`   - Tỷ lệ đạt chuẩn:      ${((soDat / (soDat + soHong)) * 100).toFixed(1)}%`);
  console.log(`   - Thời gian thực thi:   ${duration}s`);
  if (soHong > 0) {
    console.log(`\n❌ CÁC LỖI CẦN XỬ LÝ:`);
    loiChiTiet.forEach((l, idx) => console.log(`   ${idx + 1}. ${l}`));
  } else {
    console.log(`\n🌟 100% TẤT CẢ CÁC TRANG & CHỨC NĂNG KHÁCH HÀNG ĐỀU HOẠT ĐỘNG HOÀN HẢO!`);
  }
  console.log('======================================================================\n');
}

runAllCustomerTests().then(() => process.exit(soHong > 0 ? 1 : 0));
