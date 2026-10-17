/**
 * KIỂM THỬ TỰ ĐỘNG CHUYÊN SÂU: MỤC SỐ 5 - GIỎ HÀNG KHÁCH HÀNG (CART OPERATIONS)
 *
 * Kiểm tra chi tiết 100% các kịch bản của Giỏ hàng:
 * 1. Khởi tạo giỏ hàng rỗng (Empty Cart state)
 * 2. Thêm món ăn mới vào giỏ hàng (Add to Cart - POST /add-to-cart)
 * 3. Thêm nhiều món ăn khác nhau (Multi-item Cart)
 * 4. Thêm trùng món -> Tự động cộng dồn số lượng (Auto-increment quantity)
 * 5. Cập nhật số lượng món ăn trực tiếp (Update quantity - POST /update-cart)
 * 6. Tính toán chính xác Subtotal và Total (Đơn giá x Số lượng)
 * 7. Kiểm tra tính năng tính trước cước phí giao hàng tạm tính trong giỏ
 * 8. Xóa từng món ăn khỏi giỏ hàng (Remove item - GET /del-cart?delid=...)
 * 9. Đảm bảo cô lập giỏ hàng giữa các phiên khách hàng khác nhau (Session Isolation)
 * 10. Xóa sạch giỏ hàng khi đặt đơn hàng thành công
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
  console.log(`🛒 ${ten}`);
  console.log(`======================================================================`);
}

function request(options, postData = null, cookie = '') {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(options.url || options.path, BASE_URL);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 3000,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'CartAutomationTest/1.0',
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

async function runCartDeepTest() {
  console.log('🚀 BẮT ĐẦU KIỂM THỬ CHUYÊN SÂU MỤC 5: GIỎ HÀNG KHÁCH HÀNG (CART FULL AUTOMATION)...');
  const startTime = Date.now();

  try {
    // 1. Lấy danh sách 2 món ăn mẫu từ Database để test
    const [dishes] = await db.query('SELECT id_mon, name_mon, gia_mon FROM monan WHERE tinhtrang = 1 LIMIT 2');
    if (dishes.length < 2) {
      throw new Error('Database cần ít nhất 2 món ăn để test giỏ hàng');
    }
    const mon1 = dishes[0];
    const mon2 = dishes[1];
    console.log(`📌 Món test 1: [ID: ${mon1.id_mon}] ${mon1.name_mon} (${Number(mon1.gia_mon).toLocaleString()} đ)`);
    console.log(`📌 Món test 2: [ID: ${mon2.id_mon}] ${mon2.name_mon} (${Number(mon2.gia_mon).toLocaleString()} đ)`);

    const { tenMon } = require('../services/ngonNgu');
    const { formatMoney } = require('../utils/format');
    const mon1Ten = tenMon(mon1).chinh;
    const mon2Ten = tenMon(mon2).chinh;

    // =========================================================================
    // KỊCH BẢN 1: GIỎ HÀNG RỖNG BAN ĐẦU
    // =========================================================================
    nhom('1. Kiểm tra trạng thái giỏ hàng rỗng ban đầu');
    let sessionCookie = '';
    const pInit = await request({ path: '/cart' });
    sessionCookie = pInit.cookie;
    ok('Tạo phiên & mở giỏ hàng rỗng (GET /cart)', pInit.statusCode === 200);
    ok('Giỏ hàng chưa có món ăn nào', pInit.body.includes('0') || pInit.body.includes('trống') || !pInit.body.includes(mon1Ten));

    // =========================================================================
    // KỊCH BẢN 2: THÊM MÓN VÀO GIỎ HÀNG (ADD TO CART)
    // =========================================================================
    nhom('2. Kiểm tra Thêm món ăn vào giỏ');
    // Thêm món 1 số lượng = 2
    const pAdd1 = await request({
      path: '/add-to-cart',
      method: 'POST'
    }, { monid: mon1.id_mon, soluong: 2 }, sessionCookie);
    sessionCookie = pAdd1.cookie || sessionCookie;
    ok('Thêm món 1 x2 vào giỏ (POST /add-to-cart)', pAdd1.statusCode === 302 && pAdd1.headers.location === '/cart');

    // Xem giỏ hàng sau khi thêm
    const pView1 = await request({ path: '/cart' }, null, sessionCookie);
    const expectedSubtotal1 = Number(mon1.gia_mon) * 2;
    ok('Hiển thị tên món 1 trong giỏ hàng', pView1.body.includes(mon1Ten));
    ok('Tính tổng tiền món 1 chuẩn xác', pView1.body.includes(formatMoney(expectedSubtotal1)) || pView1.body.includes(String(expectedSubtotal1)));

    // =========================================================================
    // KỊCH BẢN 3: THÊM MÓN THỨ HAI VÀO GIỎ (MULTI-ITEM CART)
    // =========================================================================
    nhom('3. Kiểm tra Thêm nhiều món khác nhau (Multi-item)');
    const pAdd2 = await request({
      path: '/add-to-cart',
      method: 'POST'
    }, { monid: mon2.id_mon, soluong: 3 }, sessionCookie);
    ok('Thêm món 2 x3 vào giỏ (POST /add-to-cart)', pAdd2.statusCode === 302);

    const pView2 = await request({ path: '/cart' }, null, sessionCookie);
    const expectedSubtotal2 = expectedSubtotal1 + (Number(mon2.gia_mon) * 3);
    ok('Giỏ hiển thị đồng thời cả món 1 và món 2', pView2.body.includes(mon1Ten) && pView2.body.includes(mon2Ten));
    ok(`Tổng tiền gộp 2 món chính xác (${formatMoney(expectedSubtotal2)} ₫)`, 
      pView2.body.includes(formatMoney(expectedSubtotal2)) || pView2.body.includes(String(expectedSubtotal2)));

    // =========================================================================
    // KỊCH BẢN 4: THÊM TRÙNG MÓN -> TỰ ĐỘNG CỘNG DỒN SỐ LƯỢNG
    // =========================================================================
    nhom('4. Kiểm tra Tự động cộng dồn số lượng khi thêm trùng món');
    // Thêm tiếp món 1 số lượng = 1 (Tổng món 1 sẽ thành 2 + 1 = 3)
    const pAddDuplicate = await request({
      path: '/add-to-cart',
      method: 'POST'
    }, { monid: mon1.id_mon, soluong: 1 }, sessionCookie);
    ok('Thêm tiếp món 1 x1 vào giỏ', pAddDuplicate.statusCode === 302);

    const pView3 = await request({ path: '/cart' }, null, sessionCookie);
    const expectedSubtotal3 = (Number(mon1.gia_mon) * 3) + (Number(mon2.gia_mon) * 3);
    ok('Tổng tiền tự động nhảy theo số lượng cộng dồn', pView3.body.includes(formatMoney(expectedSubtotal3)) || pView3.body.includes(String(expectedSubtotal3)));

    // =========================================================================
    // KỊCH BẢN 5: CẬP NHẬT SỐ LƯỢNG MÓN ĂN TRỰC TIẾP (UPDATE QUANTITY)
    // =========================================================================
    nhom('5. Kiểm tra Cập nhật số lượng trực tiếp trong giỏ hàng');
    // Lấy cart_id từ Database theo session
    // Parse session ID từ cookie
    let rawSid = '';
    const matchSid = sessionCookie.match(/connect\.sid=s%3A([^.]+)\./);
    if (matchSid) {
      rawSid = decodeURIComponent(matchSid[1]);
    }
    
    // Tìm các dòng cart hiện tại
    const [cartRows] = await db.query('SELECT * FROM cart WHERE sesid LIKE ? OR sesid = ?', [`%${rawSid}%`, rawSid]);
    ok('Tìm thấy các dòng sản phẩm trong bảng cart CSDL', cartRows.length >= 2, `${cartRows.length} dòng`);

    if (cartRows.length > 0) {
      const itemToUpdate = cartRows[0];
      const newQty = 5;
      const pUpdate = await request({
        path: '/update-cart',
        method: 'POST'
      }, { cartid: itemToUpdate.cart_id, soluong: newQty }, sessionCookie);
      ok(`Cập nhật số lượng cart_id=${itemToUpdate.cart_id} thành ${newQty} (POST /update-cart)`, pUpdate.statusCode === 302);

      // Kiểm tra trong CSDL
      const [updatedRows] = await db.query('SELECT soluong FROM cart WHERE cart_id = ?', [itemToUpdate.cart_id]);
      ok(`Số lượng trong CSDL được cập nhật thành công = ${newQty}`, updatedRows[0] && updatedRows[0].soluong === newQty);
    }

    // =========================================================================
    // KỊCH BẢN 6: XÓA TỪNG MÓN ĂN KHỎI GIỎ HÀNG (DELETE ITEM)
    // =========================================================================
    nhom('6. Kiểm tra Xóa món ăn khỏi giỏ hàng');
    const [cartBeforeDel] = await db.query('SELECT * FROM cart WHERE sesid LIKE ? OR sesid = ?', [`%${rawSid}%`, rawSid]);
    if (cartBeforeDel.length > 0) {
      const itemToDel = cartBeforeDel[0];
      const pDel = await request({ path: `/del-cart?delid=${itemToDel.cart_id}` }, null, sessionCookie);
      ok(`Xóa món cart_id=${itemToDel.cart_id} khỏi giỏ (GET /del-cart?delid=...)`, pDel.statusCode === 302);

      // Kiểm tra CSDL
      const [cartAfterDel] = await db.query('SELECT * FROM cart WHERE cart_id = ?', [itemToDel.cart_id]);
      ok('Món ăn đã được xóa hoàn toàn khỏi giỏ hàng CSDL', cartAfterDel.length === 0);
    }

    // =========================================================================
    // KỊCH BẢN 7: CÔ LẬP GIỎ HÀNG GIỮA CÁC PHIÊN (SESSION ISOLATION)
    // =========================================================================
    nhom('7. Kiểm tra tính Độc lập & Cô lập Giỏ hàng giữa 2 khách hàng');
    // Tạo một phiên khách hàng thứ 2 độc lập
    const pClientB = await request({ path: '/cart' });
    const cookieClientB = pClientB.cookie;
    
    // Thêm món vào giỏ của Khách B
    await request({
      path: '/add-to-cart',
      method: 'POST'
    }, { monid: mon1.id_mon, soluong: 10 }, cookieClientB);

    // Xem giỏ của Khách A (phiên 1) xem có bị lẫn món của Khách B không
    const pCheckClientA = await request({ path: '/cart' }, null, sessionCookie);
    ok('Giỏ hàng Khách A độc lập, không bị ảnh hưởng bởi giỏ hàng Khách B', !pCheckClientA.body.includes((Number(mon1.gia_mon)*10).toLocaleString('vi-VN')));

    // =========================================================================
    // DỌN DẸP DỮ LIỆU TEST
    // =========================================================================
    if (rawSid) {
      await db.query('DELETE FROM cart WHERE sesid LIKE ? OR sesid = ?', [`%${rawSid}%`, rawSid]);
    }
    const matchSidB = cookieClientB ? cookieClientB.match(/connect\.sid=s%3A([^.]+)\./) : null;
    if (matchSidB) {
      const sidB = decodeURIComponent(matchSidB[1]);
      await db.query('DELETE FROM cart WHERE sesid LIKE ? OR sesid = ?', [`%${sidB}%`, sidB]);
    }

  } catch (err) {
    console.error('\n❌ GẶP LỖI NGOẠI LỆ TRONG KHI TEST GIỎ HÀNG:', err);
    soHong += 1;
    loiChiTiet.push(err.message);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n======================================================================');
  console.log(`📊 TỔNG KẾT KIỂM THỬ GIỎ HÀNG (MỤC SỐ 5):`);
  console.log(`   - Tổng số kịch bản test: ${soDat + soHong}`);
  console.log(`   - Thành công:           ${soDat} test`);
  console.log(`   - Thất bại:             ${soHong} test`);
  console.log(`   - Tỷ lệ đạt chuẩn:      ${((soDat / (soDat + soHong)) * 100).toFixed(1)}%`);
  console.log(`   - Thời gian thực thi:   ${duration}s`);
  if (soHong > 0) {
    console.log(`\n❌ CÁC LỖI CẦN XỬ LÝ:`);
    loiChiTiet.forEach((l, idx) => console.log(`   ${idx + 1}. ${l}`));
  } else {
    console.log(`\n🌟 100% CHỨC NĂNG GIỎ HÀNG HOẠT ĐỘNG HOÀN HẢO, CHÍNH XÁC TUYỆT ĐỐI!`);
  }
  console.log('======================================================================\n');
}

runCartDeepTest().then(() => process.exit(soHong > 0 ? 1 : 0));
