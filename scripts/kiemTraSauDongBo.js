const db = require('../config/db');
const reservationService = require('../services/reservationService');
const thanhToanService = require('../services/thanhToanService');
const kdsService = require('../services/kdsService');

async function testMergedFlows() {
  console.log('========================================================');
  console.log('  KIỂM TRA CHUYÊN SÂU CÁC LUỒNG ĐỒNG BỘ SAU KHI MERGE  ');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message} -> ${details}`);
      failed++;
    }
  }

  try {
    // ------------------------------------------------------------------
    // TEST 1: LUỒNG ĐỒNG BỘ ĐẶT BÀN -> HỢP ĐỒNG -> THANH TOÁN (BẢO + ĐOAN)
    // ------------------------------------------------------------------
    console.log('--- TEST 1: Đồng bộ Đặt bàn cọc trước -> Hợp đồng -> POS Thu ngân ---');
    
    // Tìm 1 bàn khả dụng
    const [[table]] = await db.query('SELECT Id_ban, number_ban FROM ban LIMIT 1');
    assert(table && table.Id_ban, 'Tìm thấy bàn để kiểm thử', `Bàn: ${table ? table.number_ban : 'none'}`);

    const testPhone = '0987654321';
    const testCode = 'RSV-TEST-SYNC-' + Date.now().toString().slice(-4);
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 1);
    const testDateStr = testDate.toISOString().slice(0, 10);

    // 1.1 Tạo lượt đặt bàn có cọc 200.000đ
    const [rsvIns] = await db.query(
      `INSERT INTO reservations 
        (reservation_code, customer_name, phone, guest_count, reservation_date, start_time, expected_end_time, duration_minutes, status, deposit_amount, deposit_status)
       VALUES (?, 'Nguyễn Văn Test', ?, 4, ?, '18:00:00', '20:00:00', 120, 'CONFIRMED', 200000, 'PAID')`,
      [testCode, testPhone, testDateStr]
    );
    const rsvId = rsvIns.insertId;
    assert(rsvId > 0, `Tạo reservation test thành công (ID: ${rsvId}, Code: ${testCode})`);

    // Gán bàn
    await db.query('INSERT INTO reservation_tables (reservation_id, table_id) VALUES (?, ?)', [rsvId, table.Id_ban]);

    // Thêm món preorder
    const [[monSample]] = await db.query('SELECT id_mon, name_mon, gia_mon FROM monan WHERE tinhtrang = 1 LIMIT 1');
    if (monSample) {
      await db.query(
        'INSERT INTO reservation_preorders (reservation_id, dish_id, dish_name, quantity, price) VALUES (?, ?, ?, 2, ?)',
        [rsvId, monSample.id_mon, monSample.name_mon, monSample.gia_mon]
      );
    }

    // 1.2 Chạy hàm dongBoHopDong
    const conn = await db.getConnection();
    try {
      await reservationService.dongBoHopDong(conn, rsvId);
      console.log('  Đã gọi reservationService.dongBoHopDong()');
    } finally {
      conn.release();
    }

    // 1.3 Kiểm tra dữ liệu trong hopdong
    const [hdRows] = await db.query('SELECT * FROM hopdong WHERE sesis = ?', [testCode]);
    assert(hdRows.length > 0, `Đã đồng bộ sang bảng hopdong (${hdRows.length} món)`, `sesis: ${testCode}`);
    assert(hdRows[0].id_ban === table.Id_ban, 'Bàn trong hopdong khớp với reservation_tables', `Bàn ID: ${hdRows[0].id_ban}`);

    // 1.4 Kiểm tra dữ liệu payments (cọc trước)
    const [payRows] = await db.query("SELECT * FROM payments WHERE sesis = ? AND loai = 'dat_coc'", [testCode]);
    assert(payRows.length > 0 && Number(payRows[0].amount) === 200000, 'Đã ghi nhận tiền cọc 200.000đ vào payments', `Amount: ${payRows[0] ? payRows[0].amount : 0}`);

    // 1.5 Kiểm tra tính toán hóa đơn trong thanhToanService.layHoaDon()
    const hoaDon = await thanhToanService.layHoaDon(testCode, {});
    const tienHd = hoaDon && hoaDon.tien;
    assert(tienHd && tienHd.da_dat_coc === 200000, 'layHoaDon() nhận diện đúng số tiền cọc 200.000đ', `da_dat_coc: ${tienHd ? tienHd.da_dat_coc : 'none'}`);
    assert(tienHd && tienHd.da_thanh_toan === 200000, 'da_thanh_toan bao gồm tiền cọc', `da_thanh_toan: ${tienHd ? tienHd.da_thanh_toan : 'none'}`);
    const expectedConLai = Math.max(0, tienHd.tong_cong - 200000);
    assert(tienHd.con_phai_tra === expectedConLai, `Số tiền còn lại chính xác (Tổng: ${tienHd.tong_cong} - Cọc: 200k = Còn: ${tienHd.con_phai_tra})`);

    // 1.6 Kiểm tra danhSachCanThanhToan()
    const dsCanThu = await thanhToanService.danhSachCanThanhToan();
    const donTrongDs = dsCanThu.find(d => d.sesis === testCode);
    assert(donTrongDs !== undefined, 'Hóa đơn xuất hiện trong danhSachCanThanhToan() của POS Thu ngân');
    if (donTrongDs) {
      assert(donTrongDs.da_thanh_toan === 200000, 'POS hiển thị đúng số tiền đã thanh toán trước (cọc: 200k)');
    }

    // 1.7 Chuyển khách sang SEATED (ngồi vào bàn)
    await reservationService.doiTrangThai(rsvId, 'SEATED', { nhanVienId: 1 });
    const [[banUpdated]] = await db.query('SELECT sesis_hien_tai FROM ban WHERE Id_ban = ?', [table.Id_ban]);
    assert(banUpdated.sesis_hien_tai === testCode, 'Khi khách SEATED: Cập nhật sesis_hien_tai cho bàn thành công', `sesis: ${banUpdated.sesis_hien_tai}`);

    // Dọn dẹp dữ liệu test 1
    await db.query('DELETE FROM reservation_preorders WHERE reservation_id = ?', [rsvId]);
    await db.query('DELETE FROM reservation_tables WHERE reservation_id = ?', [rsvId]);
    await db.query('DELETE FROM reservations WHERE id = ?', [rsvId]);
    await db.query('DELETE FROM hopdong WHERE sesis = ?', [testCode]);
    await db.query('DELETE FROM payments WHERE sesis = ?', [testCode]);
    await db.query('UPDATE ban SET sesis_hien_tai = NULL WHERE Id_ban = ?', [table.Id_ban]);
    console.log('  -> Đã dọn dẹp dữ liệu test đặt bàn & thanh toán.\n');

    // ------------------------------------------------------------------
    // TEST 2: LUỒNG BẾP KDS & KÉO THẢ TRẢ LẠI HÀNG CHỜ (MỚI TỪ NHÁNH BẢO)
    // ------------------------------------------------------------------
    console.log('--- TEST 2: Luồng KDS Bếp & Tính năng traLaiChoCheBien ---');
    const sesisKds = 'KDS-TEST-' + Date.now().toString().slice(-4);
    const [kdsItemIns] = await db.query(
      `INSERT INTO hopdong (sesis, id_mon, name_mon, soluong, gia, thanhtien, tinhtrang, trangthai_bep, ngay_dat, gio_dat)
       VALUES (?, 85, 'Món Test KDS', 1, 100000, 100000, 1, 0, CURDATE(), CURTIME())`,
      [sesisKds]
    );
    const kdsItemId = kdsItemIns.insertId;
    assert(kdsItemId > 0, `Tạo món ăn trong hàng đợi bếp (ID: ${kdsItemId}, trangthai_bep = 0)`);

    // 2.1 Bắt đầu nấu: 0 -> 1
    await kdsService.batDauCheBien(kdsItemId);
    const [[itemCooking]] = await db.query('SELECT trangthai_bep, bep_bat_dau FROM hopdong WHERE id = ?', [kdsItemId]);
    assert(itemCooking.trangthai_bep === 1 && itemCooking.bep_bat_dau !== null, 'Bắt đầu nấu: trangthai_bep = 1, có bep_bat_dau');

    // 2.2 Trả lại chờ chế biến: 1 -> 0 (Hàm mới Bảo viết)
    await kdsService.traLaiChoCheBien(kdsItemId);
    const [[itemReverted]] = await db.query('SELECT trangthai_bep, bep_bat_dau FROM hopdong WHERE id = ?', [kdsItemId]);
    assert(itemReverted.trangthai_bep === 0 && itemReverted.bep_bat_dau === null, 'Trả lại hàng chờ (traLaiChoCheBien): trangthai_bep = 0, bep_bat_dau = NULL');

    // 2.3 Bắt đầu lại & Hoàn thành: 0 -> 1 -> 2
    await kdsService.batDauCheBien(kdsItemId);
    await kdsService.hoanThanhCheBien(kdsItemId);
    const [[itemFinished]] = await db.query('SELECT trangthai_bep, bep_ket_thuc FROM hopdong WHERE id = ?', [kdsItemId]);
    assert(itemFinished.trangthai_bep === 2 && itemFinished.bep_ket_thuc !== null, 'Hoàn thành chế biến: trangthai_bep = 2, có bep_ket_thuc');

    // 2.4 Phục vụ: 2 -> 3
    await kdsService.danhDauDaPhucVu(kdsItemId);
    const [[itemServed]] = await db.query('SELECT trangthai_bep FROM hopdong WHERE id = ?', [kdsItemId]);
    assert(itemServed.trangthai_bep === 3, 'Đánh dấu đã phục vụ lên bàn: trangthai_bep = 3');

    // Dọn dẹp kds test
    await db.query('DELETE FROM hopdong WHERE id = ?', [kdsItemId]);
    console.log('  -> Đã dọn dẹp dữ liệu test KDS.\n');

    // ------------------------------------------------------------------
    // TEST 3: CÁC ROUTE QUẢN TRỊ & KHUYẾN MÃI MỚI (NHÁNH ĐOAN)
    // ------------------------------------------------------------------
    console.log('--- TEST 3: Kiểm tra route Khuyến mãi & Phân quyền Admin ---');
    const [kmRows] = await db.query('SELECT id, code, discount_type, discount_value, is_active FROM discount_codes LIMIT 5');
    assert(kmRows !== undefined, `Bảng discount_codes hoạt động tốt, hiện có ${kmRows.length} mã khuyến mãi`);

    const [adminCheck] = await db.query("SELECT id_nv, ten, chucvu FROM nhan_vien WHERE chucvu LIKE '%Admin%' OR chucvu LIKE '%Quan Ly%' LIMIT 1");
    assert(adminCheck.length > 0, `Tài khoản quản trị/admin khả dụng (${adminCheck[0].ten} - ${adminCheck[0].chucvu})`);

    // ------------------------------------------------------------------
    // TEST 4: TÍNH TOÀN VẸN CƠ SỞ DỮ LIỆU & BẢNG CẤU HÌNH
    // ------------------------------------------------------------------
    console.log('\n--- TEST 4: Kiểm tra tính toàn vẹn CSDL & Cấu hình ---');
    const [cfgRows] = await db.query("SELECT COUNT(*) AS total FROM cau_hinh WHERE khoa LIKE 'chatbot%' OR khoa LIKE 'thanh_toan%'");
    assert(cfgRows[0].total > 0, `Đọc được cấu hình hệ thống: ${cfgRows[0].total} khóa cấu hình`);

    const [[countMon]] = await db.query('SELECT COUNT(*) AS total FROM monan WHERE tinhtrang = 1');
    assert(countMon.total > 0, `Thực đơn đang phục vụ: ${countMon.total} món ăn`);

    const [[countBan]] = await db.query('SELECT COUNT(*) AS total FROM ban');
    assert(countBan.total > 0, `Sơ đồ bàn nhà hàng: ${countBan.total} bàn`);

    console.log('\n========================================================');
    console.log(` KẾT QUẢ KIỂM THỬ: ${passed} ĐẠT | ${failed} HỎNG`);
    console.log('========================================================');

  } catch (err) {
    console.error('Lỗi trong quá trình kiểm thử:', err);
    failed++;
  } finally {
    process.exit(failed > 0 ? 1 : 0);
  }
}

testMergedFlows();
