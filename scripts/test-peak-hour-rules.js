const assert = require('assert');
const qt = require('../services/reservationRules');
const xb = require('../services/reservationTables');
const dv = require('../services/reservationService');

async function runTests() {
  console.log('========================================================');
  console.log(' KIỂM THỬ RÀNG BUỘC SỐ NGƯỜI ĐẶT BÀN THEO KHUNG GIỜ');
  console.log('========================================================\n');

  // Test 1: Kiểm tra hàm laGioCaoDiem
  const ch = { peak_hours: '18:00-21:00' };
  assert.strictEqual(qt.laGioCaoDiem('14:00', ch), false, '14:00 phải là giờ bình thường');
  assert.strictEqual(qt.laGioCaoDiem('17:59', ch), false, '17:59 phải là giờ bình thường');
  assert.strictEqual(qt.laGioCaoDiem('18:00', ch), true, '18:00 phải là giờ cao điểm');
  assert.strictEqual(qt.laGioCaoDiem('19:30', ch), true, '19:30 phải là giờ cao điểm');
  assert.strictEqual(qt.laGioCaoDiem('20:59', ch), true, '20:59 phải là giờ cao điểm');
  assert.strictEqual(qt.laGioCaoDiem('21:00', ch), false, '21:00 phải là giờ bình thường');
  console.log('✓ Test 1: Hàm laGioCaoDiem xác định chuẩn xác khung giờ cao điểm (18:00-21:00).');

  // Test 2: Kiểm tra kiemTraSucChuaHopLe
  // GIỜ BÌNH THƯỜNG (laCaoDiem = false)
  // - 2 người ngồi bàn 2: hợp lệ
  assert.strictEqual(qt.kiemTraSucChuaHopLe(2, 2, false).hopLe, true);
  // - 2 người ngồi bàn 4: HỢP LỆ ("giờ bình thường thì 2 người ngồi bàn 4 vẫn được")
  assert.strictEqual(qt.kiemTraSucChuaHopLe(4, 2, false).hopLe, true);
  // - 2 người ngồi bàn 6: không hợp lệ (quá cỡ)
  assert.strictEqual(qt.kiemTraSucChuaHopLe(6, 2, false).hopLe, false);

  // GIỜ CAO ĐIỂM (laCaoDiem = true)
  // - 2 người ngồi bàn 2: hợp lệ
  assert.strictEqual(qt.kiemTraSucChuaHopLe(2, 2, true).hopLe, true);
  // - 2 người ngồi bàn 4: BỊ CHẶN ("conf giờ cao điểm thì chỉ được ngồi đúng số chỗ ngồi và bàn luôn")
  const ktrCaoDiem2nguoiBan4 = qt.kiemTraSucChuaHopLe(4, 2, true);
  assert.strictEqual(ktrCaoDiem2nguoiBan4.hopLe, false);
  console.log('✓ Test 2: kiemTraSucChuaHopLe:');
  console.log('    • Giờ thường: 2 người ngồi bàn 4 -> HỢP LỆ.');
  console.log('    • Giờ cao điểm: 2 người ngồi bàn 4 -> BỊ TỪ CHỐI (' + ktrCaoDiem2nguoiBan4.lyDo + ')');

  // Test 3: Sơ đồ bàn (soDoBan) trả về đúng danh sách bàn cho khách
  const ngayMai = new Date();
  ngayMai.setDate(ngayMai.getDate() + 2);
  const ngayStr = ngayMai.toISOString().slice(0, 10);

  // Gọi soDoBan lúc 14:00 (giờ thường) cho 2 khách
  const soDoThuong = await xb.soDoBan({
    ngay: ngayStr,
    gio: '14:00',
    soKhach: 2,
    choKhach: true
  });
  assert.strictEqual(soDoThuong.cao_diem, false);
  const ban2Thuong = soDoThuong.ban.find(b => b.so_cho === 2 && b.trang_thai_ban === 0);
  const ban4Thuong = soDoThuong.ban.find(b => b.so_cho === 4 && b.trang_thai_ban === 0);
  assert.ok(ban2Thuong && ban2Thuong.kha_dung, 'Giờ thường: bàn 2 người phải khả dụng');
  assert.ok(ban4Thuong && ban4Thuong.kha_dung, 'Giờ thường: 2 người ngồi bàn 4 phải khả dụng');
  console.log('✓ Test 3: soDoBan lúc 14:00 (giờ thường) cho 2 khách: cả bàn 2 chỗ (' + ban2Thuong.ten + ') và bàn 4 chỗ (' + ban4Thuong.ten + ') đều khả dụng.');

  // Gọi soDoBan lúc 19:00 (giờ cao điểm) cho 2 khách
  const soDoCaoDiem = await xb.soDoBan({
    ngay: ngayStr,
    gio: '19:00',
    soKhach: 2,
    choKhach: true
  });
  assert.strictEqual(soDoCaoDiem.cao_diem, true);
  const ban2CaoDiem = soDoCaoDiem.ban.find(b => b.so_cho === 2 && b.trang_thai_ban === 0);
  const ban4CaoDiem = soDoCaoDiem.ban.find(b => b.so_cho === 4);
  assert.ok(ban2CaoDiem && ban2CaoDiem.kha_dung, 'Giờ cao điểm: bàn 2 người phải khả dụng');
  assert.strictEqual(ban4CaoDiem.kha_dung, false, 'Giờ cao điểm: bàn 4 người KHÔNG được khả dụng cho 2 khách');
  assert.strictEqual(ban4CaoDiem.ly_do.ma, 'PEAK_HOUR_MISMATCH');
  console.log('✓ Test 4: soDoBan lúc 19:00 (giờ cao điểm) cho 2 khách:');
  console.log('    • Bàn 2 chỗ (' + ban2CaoDiem.ten + '): khả dụng.');
  console.log('    • Bàn 4 chỗ (' + ban4CaoDiem.ten + '): bị khóa với lý do "' + ban4CaoDiem.ly_do.mo_ta + '"');

  // Test 5: Backend API (goiYXepBan) chặn 2 người đặt bàn 4 trong giờ cao điểm
  const cauHinh = await qt.docCauHinh();
  const khungCaoDiem = qt.phanTichKhungGio({
    reservation_date: ngayStr,
    start_time: '19:00',
    guest_count: 2
  }, cauHinh);

  let biChan = false;
  try {
    await xb.goiYXepBan(khungCaoDiem, {
      soKhach: 2,
      banChiDinh: [ban4CaoDiem.id] // Khách chọn bàn 4 chỗ trong giờ cao điểm
    });
  } catch (err) {
    biChan = true;
    assert.strictEqual(err.ma, 'PEAK_HOUR_SEAT_MISMATCH');
    console.log('✓ Test 5: Đặt bàn backend: Khách đi 2 người cố tình chọn bàn 4 (' + ban4CaoDiem.ten + ') lúc 19:00 bị chặn với mã lỗi PEAK_HOUR_SEAT_MISMATCH:');
    console.log('    -> ' + err.message);
  }
  assert.ok(biChan, 'Phải ném lỗi khi 2 người chọn bàn 4 vào giờ cao điểm');

  // Test 6: Backend API cho phép 2 người đặt bàn 4 trong giờ thường
  const khungThuong = qt.phanTichKhungGio({
    reservation_date: ngayStr,
    start_time: '14:00',
    guest_count: 2
  }, cauHinh);

  const goiYThuong = await xb.goiYXepBan(khungThuong, {
    soKhach: 2,
    banChiDinh: [ban4Thuong.id] // Khách chọn bàn 4 chỗ trong giờ thường
  });
  assert.ok(goiYThuong.chon, 'Giờ thường 2 người chọn bàn 4 phải thành công');
  console.log('✓ Test 6: Đặt bàn backend: Khách đi 2 người chọn bàn 4 (' + ban4Thuong.ten + ') lúc 14:00 THÀNH CÔNG.');

  console.log('\n========================================================');
  console.log(' TẤT CẢ CÁC BÀI KIỂM THỬ ĐỀU ĐẠT 100%!');
  console.log('========================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('LỖI KIỂM THỬ:', err);
  process.exit(1);
});
