/**
 * Bon so do tuan tu (UML sequence diagram) cho cac luong loi cua he thong.
 *
 * Khac voi so do BPMN - ta ve NGHIEP VU chay qua nhung ai - so do tuan tu ve
 * PHAN MEM: doi tuong nao goi ham nao cua doi tuong nao, theo dung thu tu thoi
 * gian. Vi vay ten thong diep o day la ten ham va duong dan that trong ma
 * nguon (`services/`, `routes/`, `ml_service/`), doi chieu duoc khi bao ve.
 *
 * Toa do khong go tay: `veTuanTu` tu tinh khoang cach giua cac duong doi sao
 * cho nhan dai nhat cua moi thong diep van du cho, va tu suy thanh kich hoat
 * tu cap thong diep goi - tra.
 */
const v = require('./ve');

const BUOC_Y = 42;      // khoang cach doc giua hai thong diep
const LE = 26;          // le trai / le phai cua khung ve
const KHE = 40;         // khe ho toi thieu giua hai hop dinh danh

/**
 * Ve mot so do tuan tu.
 *
 *   doiTuong: [{ ten: 'Khách' | ['Khách','(điện thoại)'], lop: 'ngoai' }]
 *   buoc:     [{ tu, den, nhan, loai }]  loai: 'goi' | 'tra' | 'tu'
 *   khoi:     [{ ten, dieuKien, tu, den, trai, phai, chia: [[buoc, 'điều kiện']] }]
 */
function veTuanTu({ id, nhan, doiTuong, buoc, khoi = [], ghiChu = [] }) {
  const n = doiTuong.length;

  // 1. Do be rong tung hop dinh danh (goi thu voi cx = 0).
  const dau = doiTuong.map((d) => v.doiTuong(0, 10, d.ten, { lop: d.lop || '' }));
  const caoDau = Math.max(...dau.map((d) => d.h));

  // 2. Khoang cach giua cac cot: du cho hop, va du cho nhan dai nhat.
  const khe = [];
  for (let i = 0; i < n - 1; i++) khe.push(KHE + (dau[i].w + dau[i + 1].w) / 2);
  for (const b of buoc) {
    const rong = Math.max(...[].concat(b.nhan).map((t) => v.rongChu(t, 10.5)));
    if (b.loai === 'tu') {
      if (b.tu < n - 1) khe[b.tu] = Math.max(khe[b.tu], 46 + rong + 24);
      continue;
    }
    const [a, c] = [Math.min(b.tu, b.den), Math.max(b.tu, b.den)];
    const can = rong + 30;
    const dangCo = khe.slice(a, c).reduce((s, x) => s + x, 0);
    if (dangCo < can) {
      const them = (can - dangCo) / (c - a);
      for (let k = a; k < c; k++) khe[k] += them;
    }
  }

  const cx = [LE + dau[0].w / 2];
  for (let i = 1; i < n; i++) cx.push(cx[i - 1] + khe[i - 1]);
  const W = Math.ceil(cx[n - 1] + dau[n - 1].w / 2 + LE);

  const Y0 = 10 + caoDau + 34;                        // y cua thong diep dau tien
  const yCua = (i) => Y0 + i * BUOC_Y;
  const yCuoi = yCua(buoc.length - 1) + 34;
  const H = Math.ceil(yCuoi + 18 + (ghiChu.length ? ghiChu.length * 13 + 14 : 0));

  let s = '';

  // 3. Duong doi cua tung doi tuong.
  for (let i = 0; i < n; i++) s += v.duongDoi(cx[i], 10 + caoDau, yCuoi);

  // 4. Khung tuong tac (ve truoc de nam duoi cac mui ten).
  for (const k of khoi) {
    const x1 = cx[k.trai] - dau[k.trai].w / 2 - 22;
    const x2 = cx[k.phai] + dau[k.phai].w / 2 + 22;
    // -36 / -32: chua nhan cua khoi va nhan cua nhanh tren mot dong RIENG, khong
    // de chong len nhan cua thong diep (nhan thong diep nam o y - 6).
    s += v.khoiTuongTac(x1, yCua(k.tu) - 36, x2 - x1, yCua(k.den) - yCua(k.tu) + 54,
      k.ten, k.dieuKien, { chia: (k.chia || []).map(([b, dk]) => [yCua(b) - 32, dk]) });
  }

  // 5. Thanh kich hoat: suy tu cap goi - tra, khong khai bao tay.
  const dangMo = doiTuong.map(() => []);
  const thanh = [];
  buoc.forEach((b, i) => {
    if (b.loai === 'tra') {
      const dp = dangMo[b.tu];
      if (dp.length) thanh.push({ o: b.tu, tu: dp.pop(), den: i });
    } else if (b.loai !== 'tu') {
      dangMo[b.den].push(i);
    }
  });
  dangMo.forEach((ds, o) => ds.forEach((tu) => thanh.push({ o, tu, den: buoc.length - 1 })));
  for (const t of thanh) s += v.kichHoat(cx[t.o], yCua(t.tu) - 7, yCua(t.den) + 8);

  // 6. Thong diep.
  for (let i = 0; i < buoc.length; i++) {
    const b = buoc[i];
    const y = yCua(i);
    if (b.loai === 'tu') { s += v.thongDiep(cx[b.tu], cx[b.tu], y, b.nhan, id, { loai: 'tu' }); continue; }
    const nguoc = b.den < b.tu;
    const x1 = cx[b.tu] + (nguoc ? -6 : 6);
    const x2 = cx[b.den] + (nguoc ? 7 : -7);
    s += v.thongDiep(x1, x2, y, b.nhan, id, { loai: b.loai || 'goi' });
  }

  // 7. Hop dinh danh ve sau cung de nam tren duong doi.
  for (let i = 0; i < n; i++) {
    s += v.doiTuong(cx[i], 10, doiTuong[i].ten, { lop: doiTuong[i].lop || '', w: dau[i].w }).svg;
  }

  if (ghiChu.length) s += v.ghiChu(LE, yCuoi + 26, ghiChu);

  return v.khung(id, W, H, nhan, s);
}

/* ======================================================================== */
/* 1. KHACH QUET MA QR GOI MON                                              */
/* ======================================================================== */

function goiMonQR() {
  return veTuanTu({
    id: 'sqA',
    nhan: 'Sơ đồ tuần tự luồng khách quét mã QR gọi món tại bàn cho tới khi món hiện trên màn hình bếp',
    doiTuong: [
      { ten: ['Khách', '(điện thoại)'], lop: 'ngoai' },
      { ten: ['Trang gọi món', 'qr-menu.ejs'] },
      { ten: ['Web (Node)', 'server.js'] },
      { ten: 'orderService' },
      { ten: ['MySQL', 'gs_restaurant'], lop: 'ngoai' },
      { ten: ['Màn hình bếp', 'kds.ejs'], lop: 'ngoai' },
    ],
    buoc: [
      { tu: 0, den: 1, nhan: 'chọn món, ghi chú, bấm “Gửi bếp”' },
      { tu: 1, den: 2, nhan: 'POST /qr/add-dish {tableId, items}' },
      { tu: 2, den: 3, nhan: 'layBanQR(tableId)' },
      { tu: 3, den: 4, nhan: 'SELECT * FROM qr_tables WHERE table_id = ?' },
      { tu: 4, den: 3, nhan: 'bản ghi bàn', loai: 'tra' },
      { tu: 2, den: 3, nhan: 'phienDangMoCuaBan(tableId)' },
      { tu: 3, den: 4, nhan: 'INSERT hopdong — mở phiên mới cho bàn' },
      { tu: 3, den: 4, nhan: 'UPDATE hopdong SET id_ban — gắn phiên cũ với bàn' },
      { tu: 2, den: 3, nhan: 'addMultipleDishesToOrder(sesis, items)' },
      { tu: 3, den: 4, nhan: 'BEGIN; INSERT từng dòng món; COMMIT' },
      { tu: 4, den: 3, nhan: 'commit thành công', loai: 'tra' },
      { tu: 3, den: 2, nhan: 'sesis của bàn', loai: 'tra' },
      { tu: 2, den: 5, nhan: "emit 'new-order-to-kitchen' (Socket.IO)" },
      { tu: 2, den: 1, nhan: '{ success: true, sesis }', loai: 'tra' },
      { tu: 1, den: 0, nhan: 'màn hình “Đã gửi bếp” + theo dõi trạng thái', loai: 'tra' },
    ],
    khoi: [
      {
        ten: 'alt', dieuKien: 'bàn chưa có phiên mở', tu: 6, den: 7, trai: 3, phai: 4,
        chia: [[7, 'bàn đang có phiên']],
      },
    ],
    ghiChu: [
      'Mã phiên sesis KHÔNG nhận từ điện thoại khách mà luôn do máy chủ tra lại theo mã bàn (bước 3 và 6).',
      'Nếu nhận từ client, người biết mã phiên của bàn khác có thể gọi món vào hoá đơn của bàn đó.',
    ],
  });
}

/* ======================================================================== */
/* 2. THANH TOAN VIETQR VA DOI SOAT TU DONG                                 */
/* ======================================================================== */

function thanhToanVietQR() {
  return veTuanTu({
    id: 'sqB',
    nhan: 'Sơ đồ tuần tự luồng thanh toán chuyển khoản VietQR và đối soát tự động khi ngân hàng gọi webhook',
    doiTuong: [
      { ten: ['Khách', '(điện thoại)'], lop: 'ngoai' },
      { ten: ['Trang thanh toán', 'thanh-toan-qr.ejs'] },
      { ten: ['Web (Node)', 'routes/thanhToan.js'] },
      { ten: 'thanhToanService' },
      { ten: ['MySQL', 'payments'], lop: 'ngoai' },
      { ten: ['Ngân hàng', '(webhook)'], lop: 'ngoai' },
    ],
    buoc: [
      { tu: 0, den: 1, nhan: 'bấm “Thanh toán”' },
      { tu: 1, den: 2, nhan: 'POST /qr/thanh-toan/:sesis/tao-phien' },
      { tu: 2, den: 3, nhan: "taoPhien({sesis, soTien, maPhuongThuc: 'vietqr'})" },
      { tu: 3, den: 3, nhan: ['sinhMaDoiSoat()', 'vietQR.tlv() → chuỗi EMVCo'], loai: 'tu' },
      { tu: 3, den: 4, nhan: "INSERT payments (status = 'cho_thanh_toan')" },
      { tu: 4, den: 3, nhan: 'id phiên thanh toán', loai: 'tra' },
      { tu: 3, den: 2, nhan: '{ payment, anhQR, het_han_luc }', loai: 'tra' },
      { tu: 2, den: 1, nhan: 'ảnh mã QR + đồng hồ đếm ngược', loai: 'tra' },
      { tu: 0, den: 5, nhan: 'quét mã, chuyển khoản trên app ngân hàng' },
      { tu: 5, den: 2, nhan: 'POST /api/webhook/ngan-hang (Apikey)' },
      { tu: 2, den: 3, nhan: 'ghiNhanGiaoDichNganHang({so_tien, noi_dung})' },
      { tu: 3, den: 4, nhan: 'INSERT giao_dich_ngan_hang' },
      { tu: 3, den: 4, nhan: 'UPDATE payments SET status = thanh_cong (khớp ma_doi_soat)' },
      { tu: 3, den: 2, nhan: '{ khop: true, payment }', loai: 'tra' },
      { tu: 2, den: 1, nhan: "emit 'tt:da-thanh-toan' (Socket.IO)" },
      { tu: 1, den: 0, nhan: 'màn hình “Đã thanh toán”', loai: 'tra' },
    ],
    khoi: [
      { ten: 'opt', dieuKien: 'nội dung chuyển khoản khớp một phiên đang chờ', tu: 12, den: 15, trai: 1, phai: 4 },
    ],
    ghiChu: [
      'Webhook luôn được trả HTTP 200 khi giao dịch đã được ghi vào hộp thư, kể cả khi không khớp phiên nào:',
      'ngân hàng sẽ bắn lại liên tục nếu nhận mã khác 200, mà giao dịch đó thì vẫn đối soát tay được sau.',
    ],
  });
}

/* ======================================================================== */
/* 3. DU BAO LUOT KHACH BANG HOC MAY                                        */
/* ======================================================================== */

function duBaoLuotKhach() {
  return veTuanTu({
    id: 'sqC',
    nhan: 'Sơ đồ tuần tự luồng chạy dự báo lượt khách, gồm cả nhánh dự phòng khi dịch vụ học máy không phản hồi',
    doiTuong: [
      { ten: ['Quản lý', '(trình duyệt)'], lop: 'ngoai' },
      { ten: ['Trang Dự báo AI', 'du-bao.ejs'] },
      { ten: ['Web (Node)', 'routes/forecast.js'] },
      { ten: 'mlService' },
      { ten: ['Dịch vụ ML', 'FastAPI :8000'], lop: 'ngoai' },
      { ten: ['MySQL', 'gs_restaurant'], lop: 'ngoai' },
    ],
    buoc: [
      { tu: 0, den: 1, nhan: 'chọn số ngày, bấm “Chạy dự báo”' },
      { tu: 1, den: 2, nhan: 'POST /du-bao/api/chay-du-bao-khach {so_ngay}' },
      { tu: 2, den: 3, nhan: 'duBaoLuotKhach(soNgay)' },
      { tu: 3, den: 4, nhan: 'POST /du-bao/luot-khach?so_ngay=14' },
      { tu: 4, den: 5, nhan: '_nap_chuoi_ngay(): SELECT lịch sử theo ngày' },
      { tu: 5, den: 4, nhan: '368 ngày dữ liệu', loai: 'tra' },
      { tu: 4, den: 4, nhan: ['features.chuan_bi(): lịch, lễ Tết,', 'trung bình trượt 7/14/28 ngày'], loai: 'tu' },
      { tu: 4, den: 4, nhan: ['huan_luyen_va_danh_gia(): 4 mô hình,', 'chọn mô hình có MAE thấp nhất'], loai: 'tu' },
      { tu: 4, den: 5, nhan: 'INSERT du_bao_luot_khach, danh_gia_mo_hinh' },
      { tu: 4, den: 3, nhan: '{ du_bao[], danh_gia[], mo_hinh }', loai: 'tra' },
      { tu: 3, den: 2, nhan: 'kết quả dự báo', loai: 'tra' },
      { tu: 3, den: 5, nhan: 'duBaoKhachDaLuu(): SELECT du_bao_luot_khach' },
      { tu: 3, den: 2, nhan: 'dự báo của lần chạy trước + cảnh báo', loai: 'tra' },
      { tu: 2, den: 1, nhan: 'JSON vẽ biểu đồ', loai: 'tra' },
    ],
    khoi: [
      {
        ten: 'alt', dieuKien: 'dịch vụ ML trả lời trong 30 giây', tu: 3, den: 12, trai: 3, phai: 5,
        chia: [[11, 'dịch vụ ML không chạy hoặc quá hạn']],
      },
    ],
    ghiChu: [
      'Nhánh thứ hai của khối alt là ràng buộc thiết kế quan trọng nhất của phân hệ AI: dịch vụ Python có thể tắt,',
      'nhưng trang web vẫn phải mở được. Khi đó hệ thống hiển thị kết quả dự báo đã lưu lần chạy gần nhất.',
    ],
  });
}

/* ======================================================================== */
/* 4. CHAM CONG BANG KHUON MAT                                              */
/* ======================================================================== */

function chamCongKhuonMat() {
  return veTuanTu({
    id: 'sqD',
    nhan: 'Sơ đồ tuần tự luồng chấm công bằng khuôn mặt: kiểm tra vị trí GPS trước, sau đó mới nhận diện',
    doiTuong: [
      { ten: ['Nhân viên', '(webcam)'], lop: 'ngoai' },
      { ten: ['Trang chấm công', 'khuon-mat-kiosk.ejs'] },
      { ten: ['Web (Node)', 'routes/khuonMat.js'] },
      { ten: 'faceService' },
      { ten: ['Dịch vụ ML', 'khuon_mat.py'], lop: 'ngoai' },
      { ten: ['MySQL', 'cham_cong'], lop: 'ngoai' },
    ],
    buoc: [
      { tu: 0, den: 1, nhan: 'đứng trước webcam, làm thử thách gật đầu' },
      { tu: 1, den: 2, nhan: 'POST /api/khuon-mat/cham-cong {khung, GPS}' },
      { tu: 2, den: 3, nhan: 'chamCong(khung, {thuThach, viTri})' },
      { tu: 3, den: 5, nhan: 'docThamSo(): SELECT cau_hinh (bán kính, ngưỡng)' },
      { tu: 3, den: 3, nhan: 'kiemTraViTri(): khoảng cách Haversine', loai: 'tu' },
      { tu: 3, den: 5, nhan: "ghiNhatKy(ket_qua = 'sai_vi_tri') + ghiViTri()" },
      { tu: 3, den: 1, nhan: 'từ chối: “bạn đang ở cách nhà hàng 4 km”', loai: 'tra' },
      { tu: 3, den: 4, nhan: 'POST /khuon-mat/cham-cong (ảnh + thử thách)' },
      { tu: 4, den: 4, nhan: ['kiểm tra ảnh sống, trích vector', 'đặc trưng 128 chiều'], loai: 'tu' },
      { tu: 4, den: 5, nhan: 'so khớp 1:N với khuon_mat_nv' },
      { tu: 4, den: 3, nhan: '{ id_nv, do_tuong_dong }', loai: 'tra' },
      { tu: 3, den: 5, nhan: 'INSERT cham_cong, cham_cong_gps, nhat_ky_nhan_dien' },
      { tu: 3, den: 2, nhan: '{ thanh_cong, ten_nv, gio_vao }', loai: 'tra' },
      { tu: 2, den: 1, nhan: 'màn hình chào tên nhân viên', loai: 'tra' },
    ],
    khoi: [
      {
        ten: 'alt', dieuKien: 'ngoài bán kính cho phép', tu: 5, den: 12, trai: 1, phai: 5,
        chia: [[7, 'trong bán kính và đạt ngưỡng tin cậy']],
      },
    ],
    ghiChu: [
      'Thứ tự hai kiểm tra là có chủ đích: vị trí kiểm trước, khuôn mặt kiểm sau. Người chấm công từ xa bị chặn',
      'trong một phần giây mà hệ thống không cần biết người đó là ai, và không tốn một lượt gọi dịch vụ nhận diện.',
    ],
  });
}

module.exports = { veTuanTu, goiMonQR, thanhToanVietQR, duBaoLuotKhach, chamCongKhuonMat };
