/**
 * Bon so do quy trinh nghiep vu (BPMN), moi so do mot pool chia thanh bon lan.
 *
 * Quy uoc ky hieu dung chung cho ca bon hinh:
 *   vong tron mong   su kien bat dau      vong tron day   su kien ket thuc
 *   vong tron kep    su kien trung gian   hinh thoi       cong re nhanh XOR
 *   hop bo goc       cong viec cua nguoi  hop co bieu tuong   buoc he thong tu chay
 *
 * Toa do KHONG go tay: moi diem noi luong deu suy tu tam hinh qua `c.*`, nen
 * doi be rong hop cong viec mot cho la ca bon so do tu khop lai.
 */
const v = require('./ve');
const c = v.canh;

const COT = [120, 268, 416, 564, 712, 860, 1008, 1156];
const X = (i) => COT[i - 1];
const W = X(8) + v.VIEC_RONG / 2 + 24;   // 1249
const LAN_Y = [8, 158, 308, 458];
const TAM = LAN_Y.map((y) => y + 75);    // tam bon lan: 83, 233, 383, 533
const CAO = LAN_Y[3] + v.LAN_CAO + 30;

/* ======================================================================== */
/* A. PHUC VU & CHE BIEN TAI BAN                                            */
/* ======================================================================== */

function phucVu() {
  const [L1, L2, L3, L4] = TAM;
  const id = 'bpA';
  let s = '';

  s += v.lan(LAN_Y[0], 'Khách hàng', W);
  s += v.lan(LAN_Y[1], 'Phục vụ', W);
  s += v.lan(LAN_Y[2], 'Bếp (KDS)', W);
  s += v.lan(LAN_Y[3], 'Hệ thống', W);

  s += v.suKien(X(1), L1, 'Khách tới nhà hàng', 'dau', true);
  s += v.viec(X(2), L2, ['Xếp bàn, xác nhận', 'khách đã đặt trước']);
  s += v.cong(X(3), L2, 'Khách tự gọi món?');
  s += v.viec(X(4), L1, ['Quét mã QR tại bàn,', 'chọn món']);
  s += v.viec(X(4), L2, ['Nhập đơn hộ khách', 'trên máy POS']);
  s += v.viec(X(5), L4, ['Ghi đơn, gắn bàn,', 'bàn → Đang phục vụ'], 'tu-dong');
  s += v.viec(X(6), L3, ['Nhận món,', 'bắt đầu chế biến']);
  s += v.viec(X(7), L3, 'Hoàn thành chế biến');
  s += v.viec(X(7), L4, ['Trừ tồn kho theo', 'công thức, ghi xuất kho'], 'tu-dong');
  s += v.viec(X(8), L2, 'Mang món ra bàn');
  s += v.suKien(X(8), L1, 'Món đã lên bàn', 'cuoi', true);

  s += v.luong([[X(1) + c.sk, L1], [X(1) + 42, L1], [X(1) + 42, L2], [c.vTrai(X(2)), L2]], id);
  s += v.luong([[c.vPhai(X(2)), L2], [c.cTrai(X(3)), L2]], id);
  s += v.luong([[X(3), c.cTren(L2)], [X(3), L1], [c.vTrai(X(4)), L1]], id, 'Có', [X(3) + 14, L1 + 58]);
  s += v.luong([[c.cPhai(X(3)), L2], [c.vTrai(X(4)), L2]], id, 'Không', [X(3) + 42, L2 - 9]);
  s += v.luong([[c.vPhai(X(4)), L1], [X(5) - 40, L1], [X(5) - 40, c.vTren(L4)]], id);
  s += v.luong([[c.vPhai(X(4)), L2], [X(5) + 40, L2], [X(5) + 40, c.vTren(L4)]], id);
  s += v.luong([[c.vPhai(X(5)), L4], [c.vPhai(X(5)) + 10, L4], [c.vPhai(X(5)) + 10, L3], [c.vTrai(X(6)), L3]], id);
  s += v.luong([[c.vPhai(X(6)), L3], [c.vTrai(X(7)), L3]], id);
  s += v.luong([[X(7), c.vDuoi(L3)], [X(7), c.vTren(L4)]], id);
  s += v.luong([[c.vPhai(X(7)), L4], [c.vPhai(X(7)) + 5, L4], [c.vPhai(X(7)) + 5, L2], [c.vTrai(X(8)), L2]], id);
  s += v.luong([[X(8), c.vTren(L2)], [X(8), L1 + c.sk]], id);

  return v.khung(
    id, W, CAO,
    'Sơ đồ BPMN quy trình phục vụ và chế biến tại bàn với bốn lằn: khách hàng, phục vụ, bếp và hệ thống',
    s
  );
}

/* ======================================================================== */
/* B. THANH TOAN & DOI SOAT NGAN HANG                                       */
/* ======================================================================== */

function thanhToan() {
  const [L1, L2, L3, L4] = TAM;
  const id = 'bpB';
  let s = '';

  s += v.lan(LAN_Y[0], 'Khách hàng', W);
  s += v.lan(LAN_Y[1], 'Thu ngân', W);
  s += v.lan(LAN_Y[2], 'Hệ thống', W);
  s += v.lan(LAN_Y[3], 'Ngân hàng', W);

  s += v.suKien(X(1), L2, 'Khách xin tính tiền', 'dau');
  s += v.viec(X(2), L2, ['Mở phiên thanh toán', 'cho bàn']);
  s += v.cong(X(3), L2, 'Hình thức trả?');
  s += v.viec(X(4), L2, ['Thu tiền mặt,', 'xác nhận trên POS']);
  s += v.viec(X(4), L3, ['Sinh mã VietQR', 'đúng số tiền'], 'tu-dong');
  s += v.viec(X(6), L1, ['Quét mã, chuyển', 'khoản trên app']);
  s += v.suKien(X(6), L4, 'Ngân hàng báo có', 'giua');
  s += v.viec(X(7), L3, ['Đối soát tự động,', 'khớp phiên đang chờ'], 'tu-dong');
  s += v.viec(X(8), L3, ['Đóng đơn, bàn trống,', 'cộng điểm tích luỹ'], 'tu-dong');
  s += v.suKien(X(8), L1, 'Đã thanh toán', 'cuoi', true);

  s += v.luong([[X(1) + c.sk, L2], [c.vTrai(X(2)), L2]], id);
  s += v.luong([[c.vPhai(X(2)), L2], [c.cTrai(X(3)), L2]], id);
  s += v.luong([[c.cPhai(X(3)), L2], [c.vTrai(X(4)), L2]], id, 'Tiền mặt', [X(3) + 42, L2 - 9]);
  s += v.luong([[X(3), c.cDuoi(L2)], [X(3), L3], [c.vTrai(X(4)), L3]], id, 'Chuyển khoản', [X(3) + 46, L2 + 66]);
  s += v.luong([[c.vPhai(X(4)), L3], [X(5), L3], [X(5), L1], [c.vTrai(X(6)), L1]], id);
  s += v.luong([[X(6), c.vDuoi(L1)], [X(6), L4 - c.sk]], id);
  s += v.luong([[X(6) + c.sk, L4], [X(6) + 60, L4], [X(6) + 60, L3], [c.vTrai(X(7)), L3]], id);
  s += v.luong([[c.vPhai(X(4)), L2], [X(8) - 40, L2], [X(8) - 40, c.vTren(L3)]], id, 'đã thu đủ', [X(8) - 96, L2 - 9]);
  s += v.luong([[c.vPhai(X(7)), L3], [c.vTrai(X(8)), L3]], id);
  s += v.luong([[X(8), c.vTren(L3)], [X(8), L1 + c.sk]], id);

  return v.khung(
    id, W, CAO,
    'Sơ đồ BPMN quy trình thanh toán với nhánh tiền mặt và nhánh chuyển khoản VietQR được đối soát tự động từ thông báo của ngân hàng',
    s
  );
}

/* ======================================================================== */
/* C. DU BAO BANG HOC MAY                                                   */
/* ======================================================================== */

function duBao() {
  const [L1, L2, L3, L4] = TAM;
  const id = 'bpC';
  const w = W + 30;
  let s = '';

  s += v.lan(LAN_Y[0], 'Quản lý', w);
  s += v.lan(LAN_Y[1], 'Web (Node)', w);
  s += v.lan(LAN_Y[2], 'Dịch vụ ML', w);
  s += v.lan(LAN_Y[3], 'CSDL', w);

  s += v.suKien(X(1), L1, 'Mở trang Dự báo AI', 'dau', true);
  s += v.viec(X(2), L1, ['Chọn số ngày,', 'bấm Chạy dự báo']);
  s += v.viec(X(3), L2, ['Gọi API dịch vụ ML', 'POST /du-bao/luot-khach']);
  s += v.cong(X(4), L2, 'Dịch vụ ML trả lời?');
  s += v.viec(X(5), L2, ['Hiện dự báo đã lưu,', 'báo dịch vụ chưa bật']);
  s += v.viec(X(5), L4, ['Đọc 368 ngày', 'lịch sử bán hàng'], 'tu-dong');
  s += v.viec(X(6), L3, ['Sinh đặc trưng: thứ,', 'tháng, lễ Tết,', 'trung bình trượt']);
  s += v.viec(X(7), L3, ['Huấn luyện 4 mô hình', 'trên 60 ngày cuối']);
  s += v.viec(X(8), L3, ['Chọn mô hình MAE', 'thấp nhất, dự báo']);
  s += v.viec(X(8), L4, ['Lưu dự báo và', 'chỉ số đánh giá'], 'tu-dong');
  s += v.suKien(X(8), L1, 'Xem dự báo', 'cuoi', true);

  s += v.luong([[X(1) + c.sk, L1], [c.vTrai(X(2)), L1]], id);
  s += v.luong([[X(2), c.vDuoi(L1)], [X(2), L2], [c.vTrai(X(3)), L2]], id);
  s += v.luong([[c.vPhai(X(3)), L2], [c.cTrai(X(4)), L2]], id);
  s += v.luong([[c.cPhai(X(4)), L2], [c.vTrai(X(5)), L2]], id, 'Không', [X(4) + 42, L2 - 9]);
  s += v.luong([[X(4), c.cDuoi(L2)], [X(4), L4], [c.vTrai(X(5)), L4]], id, 'Có', [X(4) + 14, L2 + 66]);
  s += v.luong([[c.vPhai(X(5)), L4], [c.vPhai(X(5)) + 5, L4], [c.vPhai(X(5)) + 5, L3], [c.vTrai(X(6)), L3]], id);
  s += v.luong([[c.vPhai(X(6)), L3], [c.vTrai(X(7)), L3]], id);
  s += v.luong([[c.vPhai(X(7)), L3], [c.vTrai(X(8)), L3]], id);
  s += v.luong([[X(8), c.vDuoi(L3)], [X(8), c.vTren(L4)]], id);
  s += v.luong([[c.vPhai(X(8)), L4], [w - 12, L4], [w - 12, L1], [X(8) + c.sk, L1]], id);
  s += v.luong([[c.vPhai(X(5)), L2], [X(8) - 46, L2], [X(8) - 46, L1], [X(8) - c.sk, L1]], id);

  return v.khung(
    id, w, CAO,
    'Sơ đồ BPMN quy trình dự báo bằng học máy: web gọi dịch vụ Python, dịch vụ đọc lịch sử, huấn luyện bốn mô hình rồi chọn mô hình có sai số thấp nhất',
    s
  );
}

/* ======================================================================== */
/* D. CHAM CONG BANG KHUON MAT + GPS                                        */
/* ======================================================================== */

function chamCong() {
  const [L1, L2, L3, L4] = TAM;
  const id = 'bpD';
  let s = '';

  s += v.lan(LAN_Y[0], 'Nhân viên', W);
  s += v.lan(LAN_Y[1], 'Trình duyệt', W);
  s += v.lan(LAN_Y[2], 'Web (Node)', W);
  s += v.lan(LAN_Y[3], 'Dịch vụ ML', W);

  s += v.suKien(X(1), L1, 'Nhân viên tới ca', 'dau', true);
  s += v.viec(X(2), L2, ['Mở trang chấm công,', 'lấy GPS + webcam']);
  s += v.cong(X(3), L3, ['Trong bán kính', 'cho phép?']);
  s += v.viec(X(4), L3, ['Ghi nhật ký', 'sai vị trí'], 'tu-dong');
  s += v.suKien(X(5), L3, 'Bị chặn vì sai vị trí', 'cuoi');
  s += v.viec(X(4), L4, ['Kiểm tra ảnh sống', '(thử thách gật đầu)']);
  s += v.viec(X(5), L4, ['Nhận diện 1:N', 'hoặc xác minh 1:1']);
  s += v.cong(X(6), L4, ['Đạt ngưỡng', 'tin cậy?'], false);
  s += v.viec(X(6), L2, ['Báo thất bại, mời', 'chấm công thủ công']);
  s += v.suKien(X(7), L2, 'Chờ quản lý duyệt', 'cuoi');
  s += v.viec(X(7), L3, ['Ghi bảng công,', 'lưu ảnh và toạ độ'], 'tu-dong');
  s += v.suKien(X(8), L1, 'Đã chấm công', 'cuoi', true);

  s += v.luong([[X(1) + c.sk, L1], [X(1) + 42, L1], [X(1) + 42, L2], [c.vTrai(X(2)), L2]], id);
  s += v.luong([[X(2), c.vDuoi(L2)], [X(2), L3], [c.cTrai(X(3)), L3]], id);
  s += v.luong([[c.cPhai(X(3)), L3], [c.vTrai(X(4)), L3]], id, 'Không', [X(3) + 42, L3 - 9]);
  s += v.luong([[X(3), c.cDuoi(L3)], [X(3), L4], [c.vTrai(X(4)), L4]], id, 'Có', [X(3) + 14, L3 + 66]);
  s += v.luong([[c.vPhai(X(4)), L3], [X(5) - c.sk, L3]], id);
  s += v.luong([[c.vPhai(X(4)), L4], [c.vTrai(X(5)), L4]], id);
  s += v.luong([[c.vPhai(X(5)), L4], [c.cTrai(X(6)), L4]], id);
  s += v.luong([[X(6), c.cTren(L4)], [X(6), c.vDuoi(L2)]], id, 'Không đạt', [X(6) + 46, L3 + 4]);
  s += v.luong([[c.vPhai(X(6)), L2], [X(7) - c.sk, L2]], id);
  s += v.luong([[c.cPhai(X(6)), L4], [X(6) + 60, L4], [X(6) + 60, L3], [c.vTrai(X(7)), L3]], id, 'Đạt', [X(6) + 42, L4 - 9]);
  s += v.luong([[c.vPhai(X(7)), L3], [X(8) - 44, L3], [X(8) - 44, L1], [X(8) - c.sk, L1]], id);

  return v.khung(
    id, W, CAO,
    'Sơ đồ BPMN quy trình chấm công bằng khuôn mặt: kiểm tra vị trí GPS trước, sau đó kiểm tra ảnh sống rồi nhận diện khuôn mặt',
    s
  );
}

module.exports = { phucVu, thanhToan, duBao, chamCong };
